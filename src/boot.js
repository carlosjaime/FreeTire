import { Engine } from './core/engine.js';
import { createConfig } from './core/config.js';

import { RenderSystem } from './render/index.js';
import { MaterialSystem } from './materials/index.js';
import { SkySystem } from './sky/index.js';
import { WorldSystem } from './world/index.js';
import { PhysicsSystem } from './physics/index.js';
import { PlayerSystem } from './player/index.js';
import { WeaponSystem } from './weapons/index.js';
import { FxSystem } from './fx/index.js';
import { AiSystem } from './ai/index.js';
import { UiSystem } from './ui/index.js';
import { AudioSystem } from './audio/index.js';
import { MultiplayerSystem } from './multiplayer/index.js';

import { installShotApi } from './dev/shots.js';
import { prewarm } from './core/prewarm.js';

/**
 * Boot the engine onto a canvas. Framework-agnostic — called once from a
 * client-only React effect (see components/GameShell.jsx) instead of running
 * as a bare module side effect, which is what let this move from a Vite HTML
 * entry point to a Next.js app without touching a single subsystem.
 *
 * `opts.multiplayer` is forwarded straight to `MultiplayerSystem`'s
 * constructor: `{ host, room, name }`. Omit it (or leave `room`/`host` unset)
 * to boot single-player, exactly like before.
 *
 * Query params on the page URL still work for the capture/perf harness
 * (`?capture=1&q=ultra&prewarm=0&lockstep=1`), same as the old Vite entry.
 */
export async function bootGame(canvas, opts = {}) {
  const params = new URLSearchParams(location.search);
  const capture = params.get('capture') === '1';
  const lockstep = capture && params.get('lockstep') === '1';

  const config = createConfig({
    quality: params.get('q') ?? opts.quality ?? 'ultra',
    deterministic: capture,
  });

  const engine = new Engine({ canvas, config });

  // Registration order is irrelevant — Registry topo-sorts on static deps.
  engine
    .add(RenderSystem)
    .add(MaterialSystem)
    .add(SkySystem)
    .add(WorldSystem)
    .add(PhysicsSystem)
    .add(PlayerSystem)
    .add(WeaponSystem)
    .add(FxSystem)
    .add(AiSystem)
    .add(UiSystem)
    .add(AudioSystem)
    .add(MultiplayerSystem, opts.multiplayer ?? {});

  await engine.init();

  const shotApi = installShotApi(engine, { capture, lockstep });

  // Compile every shader permutation before the frame loop starts — see
  // src/core/prewarm.js. ON by default; opt out with `?prewarm=0`.
  const warmup =
    params.get('prewarm') === '0' ? { ok: false, reason: 'disabled by ?prewarm=0' } : await prewarm(engine);
  console.info('[boot] prewarm', warmup);
  window.__PREWARM__ = warmup;

  engine.start();

  // Capture harness handshake: only flag ready once a frame has actually landed.
  const BOOT_FRAMES = 3;
  if (lockstep) {
    await shotApi.pump(BOOT_FRAMES);
    window.__READY__ = true;
  } else {
    let warm = 0;
    const readyProbe = () => {
      if (++warm >= BOOT_FRAMES) {
        window.__READY__ = true;
        return;
      }
      requestAnimationFrame(readyProbe);
    };
    requestAnimationFrame(readyProbe);
  }

  window.__ENGINE__ = engine;

  return engine;
}
