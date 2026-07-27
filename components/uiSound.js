'use client';

/**
 * Tiny synthesized UI click, in the spirit of the rest of the game: no sound
 * files, everything generated at the moment it's needed. Lazy singleton
 * AudioContext because browsers refuse to start one before a user gesture —
 * the same gesture that calls this is what unlocks it.
 */
let ctx = null;

function context() {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

export function playUiClick(kind = 'tap') {
  const c = context();
  if (!c) return;
  const now = c.currentTime;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.connect(gain).connect(c.destination);
  osc.type = 'square';
  const freq = kind === 'deploy' ? 220 : kind === 'toggle' ? 520 : 720;
  osc.frequency.setValueAtTime(freq, now);
  osc.frequency.exponentialRampToValueAtTime(Math.max(60, freq * 0.55), now + 0.09);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.16, now + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
  osc.start(now);
  osc.stop(now + 0.13);
}
