/**
 * MULTIPLAYER — deathmatch networking over PartyKit.
 *
 * ARCHITECTURE
 *   Every other connected human is a real `ai.spawn()` Agent flagged
 *   `agent.remote = true` (see the guard in `ai/index.js#update`) so it gets
 *   the exact rig, materials, per-bone hitboxes, animator and ragdoll a
 *   single-player enemy gets — it is simply never handed to the AI brain.
 *   Each frame this system damps that agent's transform toward the latest
 *   network snapshot and drives it through `Agent._drive()` directly
 *   (see puppet.js).
 *
 *   Hit registration is shooter-authoritative: the existing bullet ->
 *   `damage:dealt` -> `Agent.applyDamage()` pipeline already runs against a
 *   puppet's real hitboxes exactly like it would against an AI enemy —
 *   headshots included — with zero changes. This system only listens for
 *   that event, and when the target is one of its puppets, tells the room
 *   who got hit. The PartyKit room relays that to the victim's own client,
 *   which is the only client allowed to reduce the *real* player health
 *   (`ctx.get('player').applyDamage`). Every other client updates its local
 *   puppet + killfeed + scoreboard from the same message.
 *
 * PUBLIC API — `const mp = ctx.peek('multiplayer')`
 *   mp.enabled            true once a room/host was supplied at boot
 *   mp.localId             this client's connection id, once known
 *   mp.playerCount()        connected player count including self
 *   mp.scoreboard()         [{id,name,kills,deaths}], sorted by kills desc
 *
 * EVENTS consumed: weapon:fire, damage:dealt, player:health
 */

import * as THREE from 'three';
import PartySocket from 'partysocket';
import { RemotePuppet } from './puppet.js';

const SEND_HZ = 15;
const RESPAWN_DELAY = 3.2;
const VARIANTS = ['vanguard', 'irregular', 'breacher'];

function hashId(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}
const r2 = (n) => Math.round(n * 100) / 100;
const r3 = (n) => Math.round(n * 1000) / 1000;

export class MultiplayerSystem {
  static id = 'multiplayer';
  static deps = ['physics', 'world', 'player', 'ai', 'ui', 'audio'];

  constructor(opts = {}) {
    this.opts = opts;
    this.enabled = !!(opts.room && opts.host);
  }

  async init(ctx) {
    this.ctx = ctx;
    this.puppets = new Map(); // id -> RemotePuppet
    this._pendingNames = new Map(); // id -> name, for puppets not spawned yet
    this.scores = new Map(); // id -> {name, kills, deaths}
    this.localId = null;
    this.socket = null;
    this._sendAccum = 0;
    this._dead = false;
    this._respawnTimer = 0;
    this._off = [];
    this._v = new THREE.Vector3();
    this._v2 = new THREE.Vector3();

    if (!this.enabled) return;

    ctx.config.multiplayer = true;

    this.socket = new PartySocket({ host: this.opts.host, room: this.opts.room });
    this.socket.addEventListener('message', (ev) => {
      try {
        this._onMessage(JSON.parse(ev.data));
      } catch (err) {
        console.warn('[multiplayer] bad message', err);
      }
    });
    this.socket.addEventListener('open', () => {
      this.socket.send(JSON.stringify({ type: 'name', name: this.opts.name || 'Recruit' }));
      ctx.get('ui').banner?.show('CONNECTED', this.opts.room, 2.5);
    });
    this.socket.addEventListener('close', () => {
      ctx.peek('ui')?.banner?.show('DISCONNECTED', 'attempting to reconnect…', 3);
    });

    const on = (t, fn) => this._off.push(ctx.events.on(t, fn));
    on('weapon:fire', (e) => this._onLocalFire(e));
    on('damage:dealt', (e) => this._onLocalDamageDealt(e));
    on('player:health', (e) => this._onLocalHealth(e));

    console.info(`[multiplayer] connecting to ${this.opts.host} room "${this.opts.room}" as "${this.opts.name}"`);
  }

  /* ================================================================== */
  /* outgoing                                                            */
  /* ================================================================== */

  update(dt, ctx) {
    if (!this.enabled) return;

    this._sendAccum += dt;
    if (this._sendAccum >= 1 / SEND_HZ) {
      this._sendAccum = 0;
      this._sendLocalState();
    }

    for (const p of this.puppets.values()) p.step(dt);

    if (this._dead) {
      this._respawnTimer -= dt;
      if (this._respawnTimer <= 0) {
        this._dead = false;
        this._send({ type: 'respawn' });
      }
    }
  }

  _send(obj) {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(obj));
  }

  _sendLocalState() {
    const player = this.ctx.peek('player');
    if (!player || player.dead) return;
    const p = player.position;
    this._send({
      type: 'state',
      s: {
        p: [r2(p.x), r2(p.y), r2(p.z)],
        y: r3(player.yaw),
        pitch: r3(player.pitch),
        speed: r2(player.horizontalSpeed),
        crouch: player.stance !== 'stand',
        ads: player.adsProgress > 0.5,
      },
    });
  }

  _onLocalFire(e) {
    if (!e || e.mpRemote || e.weapon === 'ai_rifle' || !e.origin || !e.dir) return;
    this._send({
      type: 'fire',
      weapon: typeof e.weapon === 'string' ? e.weapon : 'rifle',
      origin: [e.origin.x, e.origin.y, e.origin.z],
      dir: [e.dir.x, e.dir.y, e.dir.z],
      seed: e.seed ?? 0,
    });
  }

  /** The shooter's own client is authoritative for its own hits. */
  _onLocalDamageDealt(e) {
    if (!e || !e.target) return;
    let targetId = null;
    for (const [id, p] of this.puppets) {
      if (p.agent === e.target) {
        targetId = id;
        break;
      }
    }
    if (!targetId) return;
    const from = this.ctx.peek('player')?.position;
    this._send({
      type: 'hit',
      targetId,
      amount: e.amount ?? 0,
      headshot: !!e.headshot,
      killed: !!e.killed,
      point: e.point ? [e.point.x, e.point.y, e.point.z] : null,
      from: from ? [from.x, from.y, from.z] : null,
    });
  }

  _onLocalHealth(e) {
    if (e?.dead && !this._dead) this._scheduleRespawn();
  }

  _scheduleRespawn() {
    this._dead = true;
    this._respawnTimer = RESPAWN_DELAY;
    this.ctx.peek('player')?.setControlEnabled?.(false);
  }

  /* ================================================================== */
  /* incoming                                                            */
  /* ================================================================== */

  _onMessage(msg) {
    switch (msg.type) {
      case 'welcome':
        this._onWelcome(msg);
        break;
      case 'join':
        this._spawnPuppet(msg.player);
        break;
      case 'leave':
        this._removePuppet(msg.id);
        break;
      case 'rename': {
        const p = this.puppets.get(msg.id);
        if (p) p.agent.name = msg.name;
        const sc = this.scores.get(msg.id);
        if (sc) sc.name = msg.name;
        break;
      }
      case 'state': {
        const p = this.puppets.get(msg.id);
        if (p) p.pushSnapshot(msg.s);
        break;
      }
      case 'fire':
        this._onRemoteFire(msg);
        break;
      case 'hit':
        this._onHit(msg);
        break;
      case 'respawn':
        this._onRespawn(msg);
        break;
      case 'full':
        this.ctx.peek('ui')?.banner?.show('SERVER FULL', 'try again shortly', 4);
        break;
      default:
        break;
    }
  }

  _onWelcome(msg) {
    this.localId = msg.id;
    const player = this.ctx.get('player');
    player.respawn(msg.spawn ?? 0);
    for (const info of msg.roster ?? []) {
      if (info.id === this.localId) continue;
      this._spawnPuppet(info);
      const s = this.scores.get(info.id) ?? { name: info.name, kills: 0, deaths: 0 };
      s.name = info.name;
      s.kills = info.kills ?? 0;
      s.deaths = info.deaths ?? 0;
      this.scores.set(info.id, s);
    }
  }

  _spawnPuppet(info, spawnIndex) {
    if (!info || info.id === this.localId || this.puppets.has(info.id)) return;
    const ai = this.ctx.get('ai');
    const world = this.ctx.peek('world');
    const variant = VARIANTS[hashId(info.id) % VARIANTS.length];
    const sp = world?.spawn?.(spawnIndex ?? info.spawn ?? 0);
    const pos = sp?.position ? sp.position.clone() : new THREE.Vector3(0, 0, 0);
    const agent = ai.spawn(variant, pos, sp?.yaw ?? 0);
    agent.remote = true;
    agent.name = info.name || 'Recruit';
    this.puppets.set(info.id, new RemotePuppet(agent, agent.name));
    this.scores.set(info.id, { name: agent.name, kills: info.kills ?? 0, deaths: info.deaths ?? 0 });
  }

  _removePuppet(id) {
    const p = this.puppets.get(id);
    if (!p) return;
    this.ctx.get('ai').despawn(p.agent);
    this.puppets.delete(id);
    this.scores.delete(id);
  }

  _onRemoteFire(msg) {
    if (msg.id === this.localId) return;
    this.ctx.events.emit('weapon:fire', {
      weapon: msg.weapon || 'rifle',
      origin: new THREE.Vector3(msg.origin[0], msg.origin[1], msg.origin[2]),
      dir: new THREE.Vector3(msg.dir[0], msg.dir[1], msg.dir[2]),
      seed: msg.seed ?? 0,
      intensity: 0.3,
      light: 0.03,
      mpRemote: true,
    });
  }

  _nameOf(id) {
    if (id === this.localId) return 'YOU';
    return this.scores.get(id)?.name ?? this.puppets.get(id)?.name ?? 'RECRUIT';
  }

  _onHit(msg) {
    const ctx = this.ctx;
    const ui = ctx.peek('ui');

    if (msg.targetId === this.localId) {
      const player = ctx.get('player');
      if (!player.dead) {
        const from = msg.from ? this._v.set(msg.from[0], msg.from[1], msg.from[2]) : null;
        player.applyDamage(msg.amount, from, { type: 'bullet' });
        if (player.dead) {
          ui?.killfeed.push({ attacker: this._nameOf(msg.attackerId), victim: 'YOU', headshot: !!msg.headshot });
          ui?.banner.show('ELIMINATED', `by ${this._nameOf(msg.attackerId)}`, 3);
        }
      }
    } else if (msg.attackerId !== this.localId) {
      // A bystander: our own local copy of the victim never ran the raycast
      // that killed them, so force it to match what actually happened.
      const p = this.puppets.get(msg.targetId);
      if (p?.agent.alive && msg.killed) {
        if (ui) ui._lastKillAt = ctx.time.elapsed; // suppress the generic actor:death row below
        const point = msg.point ? this._v2.set(msg.point[0], msg.point[1], msg.point[2]) : p.agent.position;
        let dir = null;
        if (msg.from) {
          dir = this._v
            .set(msg.point[0] - msg.from[0], msg.point[1] - msg.from[1], msg.point[2] - msg.from[2])
            .normalize();
        }
        p.agent.applyDamage(9999, msg.headshot ? 'head' : 'torso', point, dir);
      }
      ui?.killfeed.push({
        attacker: this._nameOf(msg.attackerId),
        victim: this._nameOf(msg.targetId),
        headshot: !!msg.headshot,
      });
    }
    // attacker echo (msg.attackerId === this.localId, target !== self): the
    // shooter's own client already showed this the instant the local hit
    // landed — nothing left to do but sync the scoreboard below.

    this._applyScores(msg.scores);
  }

  _onRespawn(msg) {
    if (msg.id === this.localId) {
      const player = this.ctx.get('player');
      player.respawn(msg.spawn ?? 0);
      player.setControlEnabled(true);
    } else {
      const old = this.puppets.get(msg.id);
      const name = old?.name;
      if (old) {
        this.ctx.get('ai').despawn(old.agent);
        this.puppets.delete(msg.id);
      }
      this._spawnPuppet({ id: msg.id, name, spawn: msg.spawn }, msg.spawn);
    }
  }

  _applyScores(list) {
    if (!Array.isArray(list)) return;
    for (const row of list) {
      const s = this.scores.get(row.id) ?? { name: row.name, kills: 0, deaths: 0 };
      s.name = row.name;
      s.kills = row.kills;
      s.deaths = row.deaths;
      this.scores.set(row.id, s);
    }
  }

  /* ================================================================== */
  /* public                                                              */
  /* ================================================================== */

  playerCount() {
    return this.puppets.size + 1;
  }

  scoreboard() {
    const out = [];
    for (const [id, s] of this.scores) out.push({ id, name: s.name, kills: s.kills, deaths: s.deaths });
    if (this.localId) {
      const me = this.scores.get(this.localId);
      if (!out.find((r) => r.id === this.localId)) {
        out.push({ id: this.localId, name: 'YOU', kills: me?.kills ?? 0, deaths: me?.deaths ?? 0 });
      }
    }
    out.sort((a, b) => b.kills - a.kills);
    return out;
  }

  dispose() {
    for (const off of this._off) off();
    this._off.length = 0;
    for (const p of this.puppets.values()) this.ctx.peek('ai')?.despawn(p.agent);
    this.puppets.clear();
    this.socket?.close();
  }
}
