import * as THREE from 'three';

/** Exponential approach — same shape as the damp() helper the UI uses, kept
 *  local here so this directory doesn't reach into `src/ui`. */
function damp(a, b, lambda, dt) {
  return b + (a - b) * Math.exp(-lambda * dt);
}

const LOOK_DIST = 9;

/**
 * A remote human player, rendered with the exact same skinned rig, materials,
 * animator and per-bone hitboxes as an AI soldier (via `ai.spawn`) — the only
 * difference is nothing decides where it goes. Every fixed interval it gets a
 * `state` snapshot over the network; every frame it damps its transform toward
 * the latest one and feeds the result into the same `Agent._drive()` call the
 * AI brain would have made, so locomotion blending, aim IK and foot IK all
 * still run for real.
 */
export class RemotePuppet {
  constructor(agent, name) {
    this.agent = agent;
    this.name = name;
    this.snap = null;
    this._inited = false;
    this._fwd = new THREE.Vector3();
  }

  pushSnapshot(s) {
    this.snap = s;
  }

  step(dt) {
    const a = this.agent;
    if (!a.alive) return;
    const s = this.snap;
    if (!s) return;

    if (!this._inited) {
      a.position.set(s.p[0], s.p[1], s.p[2]);
      a.yaw = s.y;
      this._inited = true;
    } else {
      const k = 14;
      a.position.x = damp(a.position.x, s.p[0], k, dt);
      a.position.y = damp(a.position.y, s.p[1], k, dt);
      a.position.z = damp(a.position.z, s.p[2], k, dt);
      let dy = s.y - a.yaw;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      a.yaw += dy * Math.min(1, dt * k);
    }

    a.crouch = !!s.crouch;
    a.speed = s.speed ?? 0;
    a.desiredSpeed = a.speed;
    a.aimWeight = s.ads ? 1 : 0.2;
    a.suppression = Math.max(0, a.suppression - dt * 0.5);
    a.hasTarget = false;
    a.lastKnownAge = Infinity;

    const pitch = s.pitch ?? 0;
    this._fwd.set(Math.sin(a.yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(a.yaw) * Math.cos(pitch));
    a.aimTarget.set(
      a.position.x + this._fwd.x * LOOK_DIST,
      a.position.y + a.eyeHeight + this._fwd.y * LOOK_DIST,
      a.position.z + this._fwd.z * LOOK_DIST
    );

    a._drive(dt);
  }
}
