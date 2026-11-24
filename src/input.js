// Input system: keyboard + gamepad, 6-button layout, motion history, menus.
export const BTN = { LP: 1, MP: 2, HP: 4, LK: 8, MK: 16, HK: 32 };
export const ACTIONS = ['up', 'down', 'left', 'right', 'lp', 'mp', 'hp', 'lk', 'mk', 'hk'];
export const ACTION_LABEL = {
  up: 'UP', down: 'DOWN', left: 'LEFT', right: 'RIGHT',
  lp: 'LIGHT PUNCH', mp: 'MEDIUM PUNCH', hp: 'HEAVY PUNCH',
  lk: 'LIGHT KICK', mk: 'MEDIUM KICK', hk: 'HEAVY KICK',
};

export const PAD_DEFAULT = {
  lp: 2, mp: 3, hp: 5, lk: 0, mk: 1, hk: 7,
};

export function defaultBindings() {
  const toArr = (arr) => arr.map((code) => ({ type: 'key', code }));
  const p1 = {
    up: toArr(['KeyW']), down: toArr(['KeyS']), left: toArr(['KeyA']), right: toArr(['KeyD']),
    lp: toArr(['KeyU']), mp: toArr(['KeyI']), hp: toArr(['KeyO']),
    lk: toArr(['KeyJ']), mk: toArr(['KeyK']), hk: toArr(['KeyL']),
  };
  const p2 = {
    up: toArr(['ArrowUp']), down: toArr(['ArrowDown']), left: toArr(['ArrowLeft']), right: toArr(['ArrowRight']),
    lp: toArr(['Numpad4', 'KeyN']), mp: toArr(['Numpad5', 'KeyM']), hp: toArr(['Numpad6', 'Comma']),
    lk: toArr(['Numpad1', 'Period']), mk: toArr(['Numpad2', 'Slash']), hk: toArr(['Numpad3', 'ShiftRight']),
  };
  return { p1, p2 };
}

const CODE_LABEL = {
  ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
  Space: 'SPACE', ShiftLeft: 'L-SHIFT', ShiftRight: 'R-SHIFT', ControlLeft: 'L-CTRL', ControlRight: 'R-CTRL',
  AltLeft: 'L-ALT', AltRight: 'R-ALT', Enter: 'ENTER', NumpadEnter: 'NUM-ENTER', Escape: 'ESC',
  Backspace: 'BKSP', Tab: 'TAB', Comma: ',', Period: '.', Slash: '/', Semicolon: ';', Quote: "'",
  BracketLeft: '[', BracketRight: ']', Backslash: '\\', Minus: '-', Equal: '=', Backquote: '`',
  Numpad0: 'NUM0', Numpad1: 'NUM1', Numpad2: 'NUM2', Numpad3: 'NUM3', Numpad4: 'NUM4', Numpad5: 'NUM5',
  Numpad6: 'NUM6', Numpad7: 'NUM7', Numpad8: 'NUM8', Numpad9: 'NUM9', NumpadAdd: 'NUM+', NumpadSubtract: 'NUM-',
  CapsLock: 'CAPS', Delete: 'DEL', Home: 'HOME', End: 'END', PageUp: 'PGUP', PageDown: 'PGDN', Insert: 'INS',
};
export function codeLabel(code) {
  if (!code) return '—';
  if (CODE_LABEL[code]) return CODE_LABEL[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return 'NUM' + code.slice(6);
  return code.toUpperCase();
}
const PAD_LABEL = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'SELECT', 'START', 'L3', 'R3', 'D↑', 'D↓', 'D←', 'D→', 'HOME'];
export function bindingLabel(b) {
  if (!b) return '—';
  if (b.type === 'pad') return 'PAD·' + (PAD_LABEL[b.code] ?? b.code);
  return codeLabel(b.code);
}

// Numpad direction: right=6, up=8
function dirFromButtons(up, down, left, right) {
  let x = right - left, y = up - down;
  if (x === 0 && y === 0) return 5;
  if (y > 0) return x > 0 ? 9 : x < 0 ? 7 : 8;
  if (y < 0) return x > 0 ? 3 : x < 0 ? 1 : 2;
  return x > 0 ? 6 : 4;
}

export const KEY_MAP_NAV = {
  up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'], left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'],
  confirm: ['Enter', 'Space', 'NumpadEnter'], cancel: ['Escape', 'Backspace'],
};

export class InputSystem {
  constructor() {
    this.keys = new Set();
    this.pads = [];
    this.bindings = defaultBindings();
    this.hist = { p1: [], p2: [] };
    this.samples = { p1: null, p2: null };
    this.frame = 0;
    this.listeners = [];
    this.recording = null; // {player, action}
    this.padPressQueue = [];
    this.repeat = { up: { timer: 0.34, first: true }, down: { timer: 0.34, first: true }, left: { timer: 0.34, first: true }, right: { timer: 0.34, first: true }, confirm: 0 };
    this.navQueue = [];
    this.frameNav = [];
    this.lastPadButtons = [];
    this.enabled = true;
    this.padConnected = false;
    this._install();
  }

  _install() {
    const down = (e) => {
      if (e.repeat) return;
      // keep browser from scrolling
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab', 'Numpad0'].includes(e.code)) e.preventDefault();
      if (this.recording) {
        if (e.code === 'Escape') { const r = this.recording; this.recording = null; r.done(null); e.preventDefault(); return; }
        this.keys.add(e.code);
        const r = this.recording; this.recording = null;
        r.done({ type: 'key', code: e.code });
        e.preventDefault();
        return;
      }
      this.keys.add(e.code);
      this._navKey(e.code, true);
    };
    const up = (e) => {
      this.keys.delete(e.code);
      if (this.recording) return;
      this._navKey(e.code, false);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', () => this.keys.clear());
    window.addEventListener('gamepadconnected', () => { this.padConnected = true; this._pollPads(true); });
    window.addEventListener('gamepaddisconnected', () => { this.padConnected = this._anyPad(); });
  }

  captureNext(cb) {
    this.recording = { done: (b) => cb(b) };
    // gamepad binding happens in poll
    this._recordCb = cb;
  }

  _navKey(code, pressed) {
    if (this.recording) return;
    if (pressed) {
      for (const a of ['up', 'down', 'left', 'right']) {
        if (KEY_MAP_NAV[a].includes(code)) this.navQueue.push({ action: a, player: code === 'KeyW' || code === 'KeyA' || code === 'KeyS' || code === 'KeyD' ? 1 : 0 });
      }
      if (KEY_MAP_NAV.confirm.includes(code)) this.navQueue.push({ action: 'confirm', player: 0 });
      if (KEY_MAP_NAV.cancel.includes(code)) this.navQueue.push({ action: 'cancel', player: 0 });
    }
  }

  setBindings(b) { this.bindings = b; }

  _anyPad() {
    for (const p of navigator.getGamepads?.() ?? []) if (p && p.connected) return true;
    return false;
  }

  _pollPads(force) {
    const raw = navigator.getGamepads?.() ?? [];
    this.pads = [];
    for (const p of raw) if (p && p.connected) this.pads.push(p);
    this.padConnected = this.pads.length > 0;
    if (!this.padConnected) return;
    for (let i = 0; i < this.pads.length; i++) {
      const p = this.pads[i];
      const btns = p.buttons.map((b) => !!b.pressed || b.value > 0.5);
      const prev = this.lastPadButtons[i] || [];
      for (let bi = 0; bi < btns.length; bi++) {
        if (btns[bi] && !prev[bi]) {
          if (this.recording) {
            const r = this.recording; this.recording = null; this._recordCb = null;
            r.done({ type: 'pad', code: bi });
            return;
          }
          this.padPressQueue.push({ pad: i, button: bi });
          // menu nav from dpad/face buttons
          if (bi === 12) this.navQueue.push({ action: 'up', player: i });
          if (bi === 13) this.navQueue.push({ action: 'down', player: i });
          if (bi === 14) this.navQueue.push({ action: 'left', player: i });
          if (bi === 15) this.navQueue.push({ action: 'right', player: i });
          if (bi === 0) this.navQueue.push({ action: 'confirm', player: i });
          if (bi === 1) this.navQueue.push({ action: 'cancel', player: i });
          if (bi === 9) this.navQueue.push({ action: 'pause', player: i });
        }
      }
      // stick nav with debounce
      const ax = p.axes[0] ?? 0, ay = p.axes[1] ?? 0;
      this._stickNav(i, ax, ay, force);
      this.lastPadButtons[i] = btns;
    }
    if (this.recording && this._recordCb) { /* waiting */ }
  }

  _stickNav(i, ax, ay, force) {
    const th = 0.6;
    const now = performance.now();
    this._stickState = this._stickState || {};
    const st = (this._stickState[i] = this._stickState[i] || { x: 0, y: 0, tx: 0, ty: 0 });
    const sx = Math.abs(ax) > th ? Math.sign(ax) : 0;
    const sy = Math.abs(ay) > th ? Math.sign(ay) : 0;
    if (sx !== st.x || sy !== st.y) {
      if (sx > 0) this.navQueue.push({ action: 'right', player: i });
      if (sx < 0) this.navQueue.push({ action: 'left', player: i });
      if (sy > 0) this.navQueue.push({ action: 'down', player: i });
      if (sy < 0) this.navQueue.push({ action: 'up', player: i });
      st.x = sx; st.y = sy; st.tx = now; st.ty = now;
    } else if ((sx || sy) && now - st.tx > 380) { // repeat
      if (sx > 0) this.navQueue.push({ action: 'right', player: i });
      if (sx < 0) this.navQueue.push({ action: 'left', player: i });
      if (sy > 0) this.navQueue.push({ action: 'down', player: i });
      if (sy < 0) this.navQueue.push({ action: 'up', player: i });
      st.tx = now;
    }
  }

  // Called once per animation frame (menus)
  pollMenus() {
    this._pollPads();
    const out = this.navQueue;
    this.navQueue = [];
    return out;
  }

  // Called once per fixed combat frame
  sampleFrame() {
    this._pollPads();
    this.frame++;
    const out = [];
    for (let pi = 0; pi < 2; pi++) {
      const key = pi === 0 ? 'p1' : 'p2';
      const b = this.bindings[key];
      let up = false, down = false, left = false, right = false, buttons = 0;
      for (const action of ACTIONS) {
        const list = b[action] || [];
        let on = false;
        for (const bind of list) {
          if (bind.type === 'key') { if (this.keys.has(bind.code)) { on = true; break; } }
          else {
            const pad = this.pads[pi === 0 ? 0 : 1] || (pi === 1 ? this.pads[1] : null);
            if (pad && (pad.buttons[bind.code]?.pressed || pad.buttons[bind.code]?.value > 0.5)) { on = true; break; }
          }
        }
        // allow either pad to drive P1 in single-pad setups
        if (!on && this.pads.length === 1 && pi === 0) {
          for (const bind of list) if (bind.type === 'pad') {
            const pad = this.pads[0];
            if (pad.buttons[bind.code]?.pressed || pad.buttons[bind.code]?.value > 0.5) { on = true; break; }
          }
        }
        if (action === 'up') up = on;
        else if (action === 'down') down = on;
        else if (action === 'left') left = on;
        else if (action === 'right') right = on;
        else if (on) buttons |= BTN[action.toUpperCase()];
      }
      // analog stick movement for the pad assigned to this player
      const pad = this.pads[pi] || (this.pads.length === 1 ? this.pads[0] : null);
      if (pad) {
        const ax = pad.axes[0] ?? 0, ay = pad.axes[1] ?? 0;
        if (ax < -0.4) left = true;
        if (ax > 0.4) right = true;
        if (ay < -0.4) up = true;
        if (ay > 0.4) down = true;
      }
      const dir = dirFromButtons(up, down, left, right);
      const prev = this.samples[key];
      const pressed = prev ? (buttons & ~prev.buttons) : buttons;
      const released = prev ? (prev.buttons & ~buttons) : 0;
      const s = { dir, buttons, pressed, released, frame: this.frame };
      this.samples[key] = s;
      const hist = this.hist[key];
      hist.push(s);
      if (hist.length > 100) hist.shift();
      out.push(s);
    }
    return out;
  }

  getSample(player) { return this.samples[player === 0 ? 'p1' : 'p2']; }
  getHistory(player, n) {
    const h = this.hist[player === 0 ? 'p1' : 'p2'];
    return h.slice(Math.max(0, h.length - n));
  }
  clearHistory() { this.hist.p1.length = 0; this.hist.p2.length = 0; this.samples.p1 = null; this.samples.p2 = null; }

  // nav directions with keyboard repeat
  updateMenuRepeat(dt) {
    // keyboard repeat handled by OS keydown repeat? we ignore e.repeat, so implement here
    for (const a of ['up', 'down', 'left', 'right']) {
      const held = KEY_MAP_NAV[a].some((c) => this.keys.has(c));
      const st = this.repeat[a];
      if (held) {
        st.timer -= dt;
        if (st.timer <= 0) { this.navQueue.push({ action: a, player: 0 }); st.timer = st.first ? 0.2 : 0.085; st.first = false; }
      } else { st.timer = 0.34; st.first = true; }
    }
  }
}

// ---------- motion parsing ----------
export function facingDir(rawDir, facing) {
  // facing: +1 right, -1 left → mirror horizontally
  if (facing >= 0) return rawDir;
  const mirror = { 1: 3, 2: 2, 3: 1, 4: 6, 5: 5, 6: 4, 7: 9, 8: 8, 9: 7 };
  return mirror[rawDir];
}

const MOTIONS = {
  qcf: [[1, 2, 3], [2, 3, 6], [3, 6, 9]],   // lenient: 2→3→6 (any down, any downforward, fwd)
  qcb: [[3, 2, 1], [2, 1, 4], [1, 4, 7]],
  dp: [[6, 3, 2], [3, 2, 6], [6]],
  hcf: [[4, 1, 2], [1, 2, 3], [2, 3, 6], [3, 6, 9]],
  hcb: [[6, 3, 2], [3, 2, 1], [2, 1, 4], [1, 4, 7]],
  qcf2: [[1, 2, 3], [2, 3, 6], [3, 6], [4, 2, 1], [2, 1, 4], [1, 4, 7]], // placeholder, custom below
  down: [[1, 2, 3]],
};

// Generic lenient sequence matcher. seq: array of arrays of accepted dirs, in chronological order.
// The last element must occur within `tail` frames.
export function matchSequence(hist, seq, window, tail = 6) {
  const n = hist.length;
  if (!n) return false;
  let idx = n - 1;
  let lastFound = -1;
  for (let s = seq.length - 1; s >= 0; s--) {
    let found = -1;
    for (let i = idx; i >= 0 && n - 1 - i <= window; i--) {
      if (seq[s].includes(hist[i].dir)) { found = i; break; }
    }
    if (found < 0) return false;
    if (s === seq.length - 1) { lastFound = found; if (n - 1 - found > tail) return false; }
    idx = found - 1;
  }
  return true;
}

export function detectMotion(hist, facing, type) {
  const n = hist.length;
  if (n < 2) return false;
  // hist is oldest -> newest (index n-1 is the current frame)
  // helper: nearest index at or before `from` (searching backwards in time) matching dirs
  const near = (dirs, from, window) => {
    if (from < 0) return -1;
    for (let i = from; i >= 0 && from - i <= window; i--) if (dirs.includes(hist[i].dir)) return i;
    return -1;
  };
  const last = n - 1;
  switch (type) {
    case 'qcf': { // 236
      const f = near([6, 9, 3], last, 8);
      if (f < 0) return false;
      return near([2, 1, 3], f - 1, 16) >= 0;
    }
    case 'qcb': { // 214
      const b = near([4, 7], last, 8);
      if (b < 0) return false;
      return near([2, 1, 3], b - 1, 16) >= 0;
    }
    case 'dp': { // dragon punch: 623 or 632 (forward then down, with a down-forward)
      // The key discriminator vs a quarter-circle (236/214) is that the forward
      // comes BEFORE the down, not after it.
      const f = near([6, 9], last, 10);
      const d = near([2, 1], last, 10);
      if (f < 0 || d < 0) return false;
      if (!near([3], last, 8)) return false; // must pass through down-forward
      return f < d;
    }
    case 'hcf': { // 41236
      const f = near([6, 9], last, 8);
      if (f < 0) return false;
      const d = near([2, 1, 3], f - 1, 16);
      if (d < 0) return false;
      return near([4, 1], d - 1, 16) >= 0;
    }
    case 'hcb': { // 63214
      const b = near([4, 7], last, 8);
      if (b < 0) return false;
      const d = near([2, 1, 3], b - 1, 16);
      if (d < 0) return false;
      return near([6, 3, 9], d - 1, 16) >= 0;
    }
    case 'qcfx2': { // 236236
      const f1 = near([6, 9], last, 8);
      if (f1 < 0) return false;
      const d1 = near([2, 1, 3], f1 - 1, 16); if (d1 < 0) return false;
      const d2 = near([2, 1, 3], d1 - 1, 20); if (d2 < 0) return false;
      return near([6, 9], d2 - 1, 20) >= 0;
    }
    case 'qcbx2': {
      const b1 = near([4, 7], last, 8);
      if (b1 < 0) return false;
      const d1 = near([2, 1, 3], b1 - 1, 16); if (d1 < 0) return false;
      const d2 = near([2, 1, 3], d1 - 1, 20); if (d2 < 0) return false;
      return near([4, 7], d2 - 1, 20) >= 0;
    }
    default: return false;
  }
}

function lastDirIn(hist, dirs, n) {
  for (let i = hist.length - 1; i >= Math.max(0, hist.length - n); i--) if (dirs.includes(hist[i].dir)) return true;
  return false;
}
