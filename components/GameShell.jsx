'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Lobby from './Lobby.jsx';
import TouchControls from './TouchControls.jsx';

const PARTY_HOST = process.env.NEXT_PUBLIC_PARTYKIT_HOST || '';

/**
 * The whole client-side app: a full-bleed canvas the engine owns directly
 * (it runs its own rAF loop and DOM HUD, see src/core/engine.js), a React
 * lobby shown before boot, and a touch control layer laid over the canvas on
 * touch devices. Next.js/React never re-renders the game itself — this
 * component's job ends at "mount the canvas and get out of the way".
 */
export default function GameShell() {
  const canvasRef = useRef(null);
  const engineRef = useRef(null);
  const [status, setStatus] = useState('menu'); // menu | loading | connecting | playing | error
  const [isTouch, setIsTouch] = useState(false);
  const [portraitWarning, setPortraitWarning] = useState(false);

  useEffect(() => {
    const coarse = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    setIsTouch(coarse);
    if (!coarse) return;
    const mq = matchMedia('(orientation: portrait)');
    const update = () => setPortraitWarning(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    return () => {
      engineRef.current?.dispose();
      engineRef.current = null;
    };
  }, []);

  const deploy = useCallback(async (opts) => {
    setStatus(opts.multiplayer ? 'connecting' : 'loading');
    try {
      const { bootGame } = await import('../src/boot.js');
      const engine = await bootGame(canvasRef.current, opts);
      engineRef.current = engine;
      setStatus('playing');
    } catch (err) {
      console.error('[FreeTire] boot failed', err);
      setStatus('error');
    }
  }, []);

  return (
    <div id="freetire-root">
      <canvas id="game" ref={canvasRef} className={status === 'playing' ? 'pointer-active' : ''} />
      <div id="ui" />

      {status !== 'playing' && (
        <Lobby onDeploy={deploy} partyHost={PARTY_HOST} status={status} />
      )}

      {status === 'playing' && isTouch && <TouchControls input={engineRef.current.input} />}

      {status === 'playing' && portraitWarning && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 30,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '8vw',
            textAlign: 'center',
            background: 'rgba(2,4,6,0.94)',
            color: '#eef4f7',
            fontSize: '16px',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          Rotate your device to landscape to deploy
        </div>
      )}
    </div>
  );
}
