'use client';

import { useRef, useState } from 'react';
import styles from './TouchControls.module.css';

const STICK_RADIUS = 54;
const LOOK_SCALE = 1.15;

/**
 * On-screen controls for touch devices. Everything here talks to `Input`
 * (src/core/input.js) through the same code-based edge detection real keys
 * and mouse buttons use — see touchDown/touchUp/touchLook/setTouchMove — so
 * no gameplay system needs to know a touchscreen is involved.
 */
export default function TouchControls({ input }) {
  const [stick, setStick] = useState(null); // { x, y, dx, dy } in screen px, or null
  const moveTouchId = useRef(null);
  const lookTouchId = useRef(null);
  const lookLast = useRef({ x: 0, y: 0 });
  const [downSet, setDownSet] = useState(() => new Set());

  const setBtnDown = (code, on) => {
    if (on) input.touchDown(code);
    else input.touchUp(code);
    setDownSet((s) => {
      const next = new Set(s);
      if (on) next.add(code);
      else next.delete(code);
      return next;
    });
  };

  const tap = (code) => {
    input.touchDown(code);
    input.touchUp(code);
  };

  /* ---------------------------------------------------------------- move */
  const onMoveStart = (e) => {
    if (moveTouchId.current !== null) return;
    const t = e.changedTouches ? e.changedTouches[0] : e;
    moveTouchId.current = t.identifier ?? 'mouse';
    setStick({ x: t.clientX, y: t.clientY, dx: 0, dy: 0 });
  };
  const onMoveMove = (e) => {
    if (moveTouchId.current === null) return;
    const touches = e.changedTouches ? [...e.changedTouches] : [e];
    for (const t of touches) {
      if ((t.identifier ?? 'mouse') !== moveTouchId.current) continue;
      setStick((s) => {
        if (!s) return s;
        let dx = t.clientX - s.x;
        let dy = t.clientY - s.y;
        const len = Math.hypot(dx, dy);
        if (len > STICK_RADIUS) {
          dx = (dx / len) * STICK_RADIUS;
          dy = (dy / len) * STICK_RADIUS;
        }
        input.setTouchMove(dx / STICK_RADIUS, -(dy / STICK_RADIUS));
        return { ...s, dx, dy };
      });
    }
  };
  const onMoveEnd = (e) => {
    const touches = e.changedTouches ? [...e.changedTouches] : [e];
    for (const t of touches) {
      if ((t.identifier ?? 'mouse') !== moveTouchId.current) continue;
      moveTouchId.current = null;
      input.setTouchMove(0, 0);
      setStick(null);
    }
  };

  /* ---------------------------------------------------------------- look */
  const onLookStart = (e) => {
    if (lookTouchId.current !== null) return;
    const t = e.changedTouches ? e.changedTouches[0] : e;
    lookTouchId.current = t.identifier ?? 'mouse';
    lookLast.current = { x: t.clientX, y: t.clientY };
  };
  const onLookMove = (e) => {
    if (lookTouchId.current === null) return;
    const touches = e.changedTouches ? [...e.changedTouches] : [e];
    for (const t of touches) {
      if ((t.identifier ?? 'mouse') !== lookTouchId.current) continue;
      const dx = (t.clientX - lookLast.current.x) * LOOK_SCALE;
      const dy = (t.clientY - lookLast.current.y) * LOOK_SCALE;
      lookLast.current = { x: t.clientX, y: t.clientY };
      input.touchLook(dx, dy);
    }
  };
  const onLookEnd = (e) => {
    const touches = e.changedTouches ? [...e.changedTouches] : [e];
    for (const t of touches) {
      if ((t.identifier ?? 'mouse') !== lookTouchId.current) continue;
      lookTouchId.current = null;
    }
  };

  const btn = (code, cls, label, opts = {}) => (
    <div
      className={`${styles.btn} ${styles[cls]} ${downSet.has(code) ? styles.down : ''}`}
      onPointerDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (opts.tap) tap(code);
        else setBtnDown(code, true);
      }}
      onPointerUp={(e) => {
        e.stopPropagation();
        if (!opts.tap) setBtnDown(code, false);
      }}
      onPointerCancel={(e) => {
        e.stopPropagation();
        if (!opts.tap) setBtnDown(code, false);
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {label}
    </div>
  );

  return (
    <div className={styles.layer}>
      <div
        className={styles.lookZone}
        onPointerDown={onLookStart}
        onPointerMove={onLookMove}
        onPointerUp={onLookEnd}
        onPointerCancel={onLookEnd}
      />
      <div
        className={styles.moveZone}
        onPointerDown={onMoveStart}
        onPointerMove={onMoveMove}
        onPointerUp={onMoveEnd}
        onPointerCancel={onMoveEnd}
      />
      {stick && (
        <>
          <div className={styles.stickBase} style={{ left: stick.x, top: stick.y }} />
          <div className={styles.stickKnob} style={{ left: stick.x + stick.dx, top: stick.y + stick.dy }} />
        </>
      )}
      <div className={styles.buttons}>
        {btn('Mouse0', 'fire', 'FIRE')}
        {btn('Mouse2', 'ads', 'ADS')}
        {btn('Space', 'jump', 'JUMP')}
        {btn('ControlLeft', 'crouch', 'CR')}
        {btn('KeyR', 'reload', 'RLD', { tap: true })}
        {btn('ShiftLeft', 'sprint', 'SPR')}
        {btn('Escape', 'pause', '≡', { tap: true })}
      </div>
    </div>
  );
}
