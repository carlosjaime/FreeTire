/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  // The engine is a hand-rolled WebGL2 game loop that owns its own canvas and
  // frame timing — it is mounted client-side only (see components/GameShell)
  // and never needs server rendering or React reconciliation.
};

export default nextConfig;
