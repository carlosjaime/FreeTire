import { el, setStyle, damp, ease } from './util.js';

/**
 * Credits / legal card, shown from the pause menu.
 *
 * It is a second page of the menu column rather than a floating dialog: same
 * left rail, same amber border, so opening it reads as the panel turning a page
 * instead of a window appearing on top of one. The pause menu owns the
 * instance, swaps the panes, and drives `update()` with unscaled time (the game
 * clock is stopped while the menu is up).
 */

/** Everything user-visible in one place — the only thing to edit per release. */
export const ABOUT = {
  title: 'OVERWATCH',
  subtitle: 'TACTICAL OPERATIONS',
  rows: [
    ['Version', '1.0.0'],
    ['Engine', 'THREE.JS · WEBGL 2'],
    ['Build', 'PROCEDURAL · NO ASSET PACKS'],
  ],
  /* Mixed case on purpose (`RCMx`), so this line opts out of the HUD's
     global uppercase transform — see `.ow-about-copy` in style.js. */
  copyright: 'RCMx 2026 - Todos los derechos reservados',
};

export class AboutPanel {
  constructor(parent) {
    this.root = el('div', 'ow-menu-inner ow-about', parent);

    el('h1', null, this.root, ABOUT.title);
    el('div', 'sub', this.root, `${ABOUT.subtitle} — ACERCA DE`);
    el('div', 'rule', this.root);

    const rows = el('div', null, this.root);
    for (const [name, value] of ABOUT.rows) {
      const r = el('div', 'ow-row', rows);
      el('div', 'name', r, name.toUpperCase());
      el('div', 'val', r, value);
    }

    el('div', 'ow-about-copy', this.root, ABOUT.copyright);

    const btns = el('div', 'ow-btns', this.root);
    this.backBtn = el('button', 'ow-btn primary', btns, 'Back');
    this.backBtn.type = 'button';

    this.open = false;
    this.shown = 0;
    setStyle(this.root, 'display', 'none');
  }

  /** `fn` runs when the Back button is pressed. */
  onBack(fn) {
    this.backBtn.addEventListener('click', fn);
  }

  show() {
    this.open = true;
    setStyle(this.root, 'display', '');
  }

  hide() {
    this.open = false;
  }

  /** Unscaled dt — the page cross-fade has to run while the game is frozen. */
  update(rawDt) {
    this.shown = damp(this.shown, this.open ? 1 : 0, 18, rawDt);
    if (this.shown < 0.004) {
      setStyle(this.root, 'display', 'none');
      setStyle(this.root, 'pointer-events', 'none');
      return;
    }
    setStyle(this.root, 'display', '');
    setStyle(this.root, 'pointer-events', this.open ? 'auto' : 'none');
    setStyle(this.root, 'opacity', ease.outQuad(this.shown).toFixed(3));
    // slides in from the right of the rail, settling on the column
    const dx = (1 - ease.outQuad(this.shown)) * 22;
    setStyle(this.root, 'transform', `translateY(-50%) translateX(${dx.toFixed(2)}px)`);
  }

  dispose() {
    this.root.remove();
  }
}
