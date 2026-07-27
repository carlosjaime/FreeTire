'use client';

import { useEffect, useState } from 'react';
import styles from './Lobby.module.css';
import { playUiClick } from './uiSound.js';

const NAME_KEY = 'freetire.name';
const ROOM_KEY = 'freetire.room';
const QUALITY_KEY = 'freetire.quality';

function randomName() {
  const adj = ['Silent', 'Iron', 'Ghost', 'Rapid', 'Night', 'Steel', 'Rogue', 'Alpha'];
  const noun = ['Wolf', 'Viper', 'Hawk', 'Fox', 'Bear', 'Cobra', 'Raven', 'Reaper'];
  return adj[Math.floor(Math.random() * adj.length)] + noun[Math.floor(Math.random() * noun.length)];
}

/**
 * Pre-boot menu: callsign, solo/multiplayer, room, quality preset. Deliberately
 * a plain React overlay (not the in-engine PauseMenu) since it has to exist
 * before the engine — and its 55 MB of procedural asset generation — boots.
 */
export default function Lobby({ onDeploy, partyHost, status }) {
  const [name, setName] = useState('');
  const [mode, setMode] = useState('multiplayer');
  const [room, setRoom] = useState('public');
  const [quality, setQuality] = useState('ultra');

  useEffect(() => {
    setName(localStorage.getItem(NAME_KEY) || randomName());
    setRoom(localStorage.getItem(ROOM_KEY) || 'public');
    setQuality(localStorage.getItem(QUALITY_KEY) || 'ultra');
  }, []);

  const deploying = status === 'loading' || status === 'connecting';
  const mpUnavailable = mode === 'multiplayer' && !partyHost;

  const deploy = () => {
    playUiClick('deploy');
    const cleanName = (name || randomName()).trim().slice(0, 16) || 'Recruit';
    const cleanRoom = (room || 'public').trim().toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 24) || 'public';
    localStorage.setItem(NAME_KEY, cleanName);
    localStorage.setItem(ROOM_KEY, cleanRoom);
    localStorage.setItem(QUALITY_KEY, quality);
    onDeploy({
      quality,
      multiplayer: mode === 'multiplayer' && partyHost ? { host: partyHost, room: cleanRoom, name: cleanName } : null,
    });
  };

  return (
    <div className={styles.root}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <div className={styles.brandMark}>FREETIRE</div>
          <div className={styles.brandSub}>Tactical Operations</div>
        </div>

        <div className={styles.panel}>
          <div className={styles.field}>
            <div className={styles.label}>Callsign</div>
            <input
              className={styles.input}
              value={name}
              maxLength={16}
              onChange={(e) => setName(e.target.value)}
              placeholder="RECRUIT"
              disabled={deploying}
            />
          </div>

          <div className={styles.field}>
            <div className={styles.label}>Mode</div>
            <div className={styles.seg}>
              <button
                type="button"
                className={mode === 'multiplayer' ? styles.on : ''}
                onClick={() => {
                  playUiClick('toggle');
                  setMode('multiplayer');
                }}
                disabled={deploying}
              >
                Multiplayer
              </button>
              <button
                type="button"
                className={mode === 'solo' ? styles.on : ''}
                onClick={() => {
                  playUiClick('toggle');
                  setMode('solo');
                }}
                disabled={deploying}
              >
                Solo
              </button>
            </div>
          </div>

          {mode === 'multiplayer' && (
            <div className={styles.field}>
              <div className={styles.label}>Room Code</div>
              <input
                className={styles.input}
                value={room}
                maxLength={24}
                onChange={(e) => setRoom(e.target.value)}
                placeholder="PUBLIC"
                disabled={deploying}
              />
              <div className={styles.hint}>Same code, same match — share it with a squad.</div>
              {mpUnavailable && (
                <div className={styles.warn}>
                  No multiplayer server configured (NEXT_PUBLIC_PARTYKIT_HOST) — deploying solo instead.
                </div>
              )}
            </div>
          )}

          <div className={styles.field}>
            <div className={styles.label}>Graphics</div>
            <div className={styles.seg}>
              {['low', 'medium', 'high', 'ultra'].map((p) => (
                <button
                  type="button"
                  key={p}
                  className={quality === p ? styles.on : ''}
                  onClick={() => {
                    playUiClick('tap');
                    setQuality(p);
                  }}
                  disabled={deploying}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <button className={styles.deploy} onClick={deploy} disabled={deploying}>
            {deploying ? (status === 'connecting' ? 'Connecting…' : 'Loading…') : 'Deploy'}
          </button>

          {status === 'error' && <div className={styles.warn}>Boot failed — see console for details.</div>}
        </div>

        <div className={styles.controlsHint}>
          WASD move · Mouse aim · LMB fire · RMB ADS · R reload · Shift sprint · Space jump
          <br />
          Touch: virtual stick + on-screen buttons
        </div>
      </div>
    </div>
  );
}
