/**
 * FreeTire deathmatch room (PartyKit).
 *
 * This server does not run physics or simulate gameplay — it is a thin,
 * validated relay. Hit registration is shooter-authoritative: a client only
 * ever reports hits it detected against its own local view of another player,
 * and this room trusts that report, applies it to the scoreboard, and relays
 * it to everyone (the target's own client is what actually reduces its real
 * health — see src/multiplayer/index.js). That keeps a browser FPS with no
 * server-side physics playable without reimplementing ballistics twice.
 *
 * One room == one match. Room ids are free-form strings chosen by players in
 * the lobby ("join code"), so a match is just whichever room they typed.
 */

const MAX_PLAYERS = 16;
const SPAWN_COUNT = 8;

export default class Deathmatch {
  constructor(party) {
    this.party = party;
    this.players = new Map(); // connectionId -> { id, name, kills, deaths, alive, spawn }
    this._spawnCursor = 0;
  }

  _nextSpawn() {
    const s = this._spawnCursor % SPAWN_COUNT;
    this._spawnCursor++;
    return s;
  }

  _scores() {
    return [...this.players.values()].map((p) => ({ id: p.id, name: p.name, kills: p.kills, deaths: p.deaths }));
  }

  onConnect(conn) {
    if (this.players.size >= MAX_PLAYERS) {
      conn.send(JSON.stringify({ type: 'full' }));
      conn.close();
      return;
    }
    const spawn = this._nextSpawn();
    const player = { id: conn.id, name: 'Recruit', kills: 0, deaths: 0, alive: true, spawn };
    this.players.set(conn.id, player);

    conn.send(JSON.stringify({ type: 'welcome', id: conn.id, spawn, roster: [...this.players.values()] }));
    this.party.broadcast(JSON.stringify({ type: 'join', player }), [conn.id]);
  }

  onMessage(message, sender) {
    let msg;
    try {
      msg = JSON.parse(typeof message === 'string' ? message : '');
    } catch {
      return;
    }
    const player = this.players.get(sender.id);
    if (!player || !msg || typeof msg.type !== 'string') return;

    switch (msg.type) {
      case 'name': {
        const name = String(msg.name ?? '').trim().slice(0, 16);
        player.name = name || 'Recruit';
        this.party.broadcast(JSON.stringify({ type: 'rename', id: sender.id, name: player.name }));
        break;
      }

      case 'state': {
        if (!msg.s || !Array.isArray(msg.s.p) || msg.s.p.length !== 3) return;
        this.party.broadcast(JSON.stringify({ type: 'state', id: sender.id, s: msg.s }), [sender.id]);
        break;
      }

      case 'fire': {
        if (!Array.isArray(msg.origin) || !Array.isArray(msg.dir)) return;
        this.party.broadcast(
          JSON.stringify({
            type: 'fire',
            id: sender.id,
            weapon: typeof msg.weapon === 'string' ? msg.weapon.slice(0, 24) : 'rifle',
            origin: msg.origin,
            dir: msg.dir,
            seed: Number(msg.seed) || 0,
          }),
          [sender.id]
        );
        break;
      }

      case 'hit': {
        const target = this.players.get(msg.targetId);
        if (!target || !target.alive || msg.targetId === sender.id) return;
        const killed = !!msg.killed;
        if (killed) {
          target.alive = false;
          target.deaths++;
          player.kills++;
        }
        this.party.broadcast(
          JSON.stringify({
            type: 'hit',
            attackerId: sender.id,
            targetId: msg.targetId,
            amount: Number(msg.amount) || 0,
            headshot: !!msg.headshot,
            killed,
            point: Array.isArray(msg.point) ? msg.point : null,
            from: Array.isArray(msg.from) ? msg.from : null,
            scores: this._scores(),
          })
        );
        break;
      }

      case 'respawn': {
        if (player.alive) break; // already up — ignore a stray/duplicate request
        player.alive = true;
        player.spawn = this._nextSpawn();
        this.party.broadcast(JSON.stringify({ type: 'respawn', id: sender.id, spawn: player.spawn }));
        break;
      }

      default:
        break;
    }
  }

  onClose(conn) {
    if (!this.players.has(conn.id)) return;
    this.players.delete(conn.id);
    this.party.broadcast(JSON.stringify({ type: 'leave', id: conn.id }));
  }

  onError(conn) {
    this.onClose(conn);
  }
}
