import './globals.css';

export const metadata = {
  title: 'FreeTire — Tactical Shooter',
  description:
    'FreeTire: a browser-native tactical FPS built with Three.js — procedural everything, real-time WebSocket multiplayer, no installs.',
  applicationName: 'FreeTire',
  formatDetection: { telephone: false },
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'FreeTire' },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#000000',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
