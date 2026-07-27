import { defineConfig } from 'vite';

// Used ONLY by the per-subsystem preview harnesses (src/*/preview.html +
// preview.js, driven by src/*/shoot.mjs and src/*/probe.mjs) — isolated pages
// each subsystem owner uses to inspect their own output without booting the
// whole game. The shipped app is Next.js (see app/, next.config.mjs) and never
// touches this file.
export default defineConfig({
  server: {
    host: '127.0.0.1',
    strictPort: true,
    hmr: process.env.OW_NO_HMR ? false : undefined,
  },
  preview: { host: '127.0.0.1' },
  build: { target: 'es2022', sourcemap: true, chunkSizeWarningLimit: 4096 },
  assetsInclude: ['**/*.ktx2', '**/*.hdr', '**/*.exr', '**/*.bin', '**/*.glb'],
});
