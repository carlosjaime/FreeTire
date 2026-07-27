<div align="center">

# CLAUDE OF DUTY

### A first-person shooter with **zero art assets**

Every texture, mesh, animation and sound is generated procedurally, in the browser,
at load time. No models. No HDRIs. No image files. No audio files.
The only runtime dependency is `three`.

![three.js](https://img.shields.io/badge/three.js-r180-000000?style=for-the-badge&logo=three.js&logoColor=white)
![WebGL](https://img.shields.io/badge/WebGL-2.0-990000?style=for-the-badge&logo=webgl&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-7-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![art assets](https://img.shields.io/badge/art_assets-0-1DB954?style=for-the-badge)
![lines](https://img.shields.io/badge/~55k_lines-11_subsystems-1DB954?style=for-the-badge)

<img src="docs/media/hero.jpg" alt="Wide establishing shot down the main street" width="100%">

<sub>Get updates <a href="https://shumer.dev/newsletter">here</a>.</sub>

</div>

---

## Play it

```bash
npm install
npm run dev          # http://127.0.0.1:5173
```

Click the canvas to lock the cursor.

| | | | |
|---|---|---|---|
| **WASD** move | **Mouse** aim | **LMB** fire | **RMB** ADS |
| **R** reload | **Shift** sprint | **Ctrl** crouch | **Space** jump |
| **Q/E** lean | **F** use | **Esc** pause / release | |

---

## Screenshots

Every pixel below is generated from code — there is not a single image file in the repository.

<table>
<tr>
<td width="50%"><img src="docs/media/sunset.jpg" alt="Low sun over the market street" width="100%"></td>
<td width="50%"><img src="docs/media/night.jpg" alt="The same street at night" width="100%"></td>
</tr>
<tr>
<td><b>Low sun</b><br><sub>Atmospheric scattering, long shadows, god rays, bloom.</sub></td>
<td><b>Night</b><br><sub>Artificial lights, exposure adaptation, shadows in the dark.</sub></td>
</tr>
<tr>
<td><img src="docs/media/interior.jpg" alt="Interior lit by window shafts" width="100%"></td>
<td><img src="docs/media/detail.jpg" alt="Close-up of procedural wall materials" width="100%"></td>
</tr>
<tr>
<td><b>Interiors</b><br><sub>Light shafts through windows — bounce, AO, volumetrics.</sub></td>
<td><b>Materials</b><br><sub>19 procedural surfaces, parallax occlusion, edge wear.</sub></td>
</tr>
<tr>
<td><img src="docs/media/ads.jpg" alt="Aiming down sights" width="100%"></td>
<td><img src="docs/media/impacts.jpg" alt="Bullet impacts on a plaster wall" width="100%"></td>
</tr>
<tr>
<td><b>Iron sights</b><br><sub>Procedural weapon geometry, optic alignment, viewmodel rig.</sub></td>
<td><b>Impacts</b><br><sub>Decals, debris, dust puffs, sparks — all GPU particles.</sub></td>
</tr>
<tr>
<td><img src="docs/media/combat.jpg" alt="Enemies mid-firefight" width="100%"></td>
<td><img src="docs/media/hud.jpg" alt="Full combat HUD" width="100%"></td>
</tr>
<tr>
<td><b>Firefight</b><br><sub>Skinned soldiers, navmesh pathing, cover behaviour, ragdolls.</sub></td>
<td><b>HUD</b><br><sub>Pure DOM/CSS overlay, integrated from <code>dt</code>, frame-deterministic.</sub></td>
</tr>
<tr>
<td><img src="docs/media/menu.jpg" alt="Pause menu" width="100%"></td>
<td><img src="docs/media/about.jpg" alt="About page" width="100%"></td>
</tr>
<tr>
<td><b>Pause menu</b><br><sub>Live quality, sensitivity and FOV, wired straight into the config.</sub></td>
<td><b>About</b><br><sub>Second page of the same column — credits and version.</sub></td>
</tr>
</table>

---

## What's in it

| subsystem | what it does |
|---|---|
| `render` | HDR pipeline, cascaded shadow maps in a `sampler2DArray` with texel snapping and PCSS contact hardening, MRT depth/normal/velocity prepass, GTAO, TAA with YCoCg variance clipping, tile-dilated motion blur, Karis bloom pyramid, GPU EV100 metering, procedural 33³ grade LUT, AgX composite |
| `materials` | GPU texture forge: 19 procedural surfaces (concrete, brick, plaster, asphalt, sand, rusted/painted/brushed metal, wood, fabric, burlap, glass…), periodic noise so everything tiles seamlessly, Sobel height→normal, parallax occlusion mapping, triplanar projection, curvature-driven edge wear |
| `sky` | Atmospheric scattering, time of day, PMREM environment generation, volumetric fog and light shafts |
| `world` | ~120×120 m market street: modular building kit with real wall thickness, enterable interiors, several hundred instanced props |
| `physics` | Written from scratch, no library. Binned-SAH BVH (29k tris → 14k nodes in 22 ms, 0.25 µs/raycast), swept-capsule character controller with a 5-plane crease stack, impulse rigid bodies with CCD, PBD ragdolls, multi-layer bullet penetration |
| `player` | Movement state machine, slide/mantle/lean, camera feel |
| `weapons` | Procedural weapon geometry, viewmodel rig, ADS, spring recoil, procedural reloads, ballistics with travel time and drop |
| `fx` | GPU particles, decals, tracers, muzzle flash, explosions |
| `ai` | Skinned soldiers, navmesh pathing, perception, cover behaviour, ragdoll death |
| `ui` | DOM/CSS HUD: crosshair, hitmarkers, minimap, compass, killfeed, pause menu |
| `audio` | Web Audio synthesis — no sound files. Layered weapon fire, convolution reverb, HRTF spatialisation, occlusion |

Roughly 55k lines across 11 subsystems, written by a fleet of AI agents under
orchestration. `ARCHITECTURE.md` is the contract they worked against: subsystem
interface, directory ownership, the cross-subsystem event vocabulary, and shared
surface types.

---

## Tooling

The interesting part of this repo is arguably the harness, not the game.

| tool | purpose |
|---|---|
| `tools/capture.mjs` | Screenshot one named shot via GPU-backed headless Chromium |
| `tools/shotset.mjs` | All 11 shots in one session — fast review set |
| `tools/baseline.mjs` | **Reproducible** capture: each shot in an isolated page, fixed frame budget. Bit-identical across runs |
| `tools/imagediff.mjs` | Per-pixel gate. Exits non-zero if any pixel moved |
| `tools/profile.mjs` | Gameplay profiler at real device pixel ratio. Frame-time *distribution* and hitch attribution via per-frame WebGL program counts |
| `tools/playtest.mjs` | Scripted movement/fire smoke test |

Two findings worth recording, because both invalidated earlier measurements:

> **Median frame time hides the actual problem.** A static-camera benchmark reported
> 94 fps while the game was unplayable. Real gameplay at Retina DPR (internal 3.34 MP,
> not 2.07) ran 12–17 fps with **728–1236 ms stalls** caused by 34+ WebGL programs
> compiling lazily mid-frame. `profile.mjs` reports p50/p95/p99 and attributes each
> hitch, which is what surfaced it.

> **Captures were not reproducible.** `shotset.mjs` reuses one page across all 11
> shots, so particle age, decal buffers and exposure state leak forward — two identical
> runs differed on 10 of 11 shots. `baseline.mjs` isolates each shot in a fresh page,
> which is bit-identical and is what makes `imagediff.mjs` a usable gate.

---

## Performance

Measured on an Apple silicon laptop at 1512×982, DPR 2 (3.34 MP internal), `ultra` preset,
3 runs, gameplay in motion with AI and firing active:

| | before optimization | after |
|---|---|---|
| fps p50 | 12–17 | **28–30** |
| fps p99 | 4–9 | **14–17** |
| worst frame | 728–1236 ms | **66–82 ms** |
| shader compiles during play | 34–35 | **0** |
| boot | ~9–12 s | **3.7–4.6 s** |

The optimization pass was constrained to produce **zero visual change**, enforced by
`imagediff.mjs` rather than by assertion — the shipped build is bit-identical to its
pre-optimization reference across all 11 shots.

Shader pre-warm (`src/core/prewarm.js`) is what removed the stalls. Making it
*provably* pixel-neutral required first fixing subsystems that animated off
`performance.now()` instead of the engine clock, since any change to boot duration
otherwise shifted output.

---

## Honest assessment

The goal was to match a modern Call of Duty. **It does not.**

Eleven independent adversarial critics scored the frames against that bar. Scores
went 3.59 → 4.14 → 4.05 → **5.05** out of 10. Two shots reached "CLOSE"; the rest
remain "AMATEUR". In a blind A/B, **every critic in every round picked the real Call
of Duty frame.**

Where it falls short, specifically:

- **Hands.** Blocky finger slabs that don't convincingly grip the weapon.
- **Material richness.** Surfaces read as procedural noise rather than photographed
  reality at close range — the ceiling of generating texture from code.
- **Characters.** Enemies read as mannequins at distance.
- **Indirect light.** An approximation, not real GI.
- **Frame rate.** 28–30 fps at Retina. The art passes tripled geometry cost
  (5.9M → 11.3M triangles) and optimization recovered about half.

A known root cause remains unfixed: the viewmodel light rig in `render/index.js`
delivers roughly 20× the irradiance per unit albedo that the world does — a plain
*black* material in the view scene renders at L=110 against a background of 91,
purely from F0=0.04. Every weapon albedo is cheated to a third of physical to
compensate, which caps material separation on the most-looked-at object in the game.

---

## Process note

Sequential single-owner passes beat parallel fan-out decisively. Three rounds of six
agents each owning one directory moved the score +0.46 and left frame-ruining defects
*higher* than they started (60 → 47 → 66), because tonemapping, sky and indirect light
are one coupled system and isolated agents kept breaking each other's assumptions.
One sequential pass with a single owner per coupled concern moved it +1.00 and cut
defects 66 → 26.

The most valuable single result came from an agent contradicting its own brief. Every
critic for three rounds reported the weapon as "untextured". It wasn't — it was
specular-dominated, with the diffuse term measured at L=26 against a shipped L=67.
Prior rounds had been crushing albedos to fight bright-part complaints, which killed
diffuse and made it worse. The fix was the opposite of what was asked for.

<div align="center">
<sub>Screenshots are the named shots in <code>src/dev/shots.js</code>, captured headless at 1920×1080 on the <code>ultra</code> preset.</sub>
</div>
