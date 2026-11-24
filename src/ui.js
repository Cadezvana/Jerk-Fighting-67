// Menus, character select, options, move list, results.
import * as THREE from 'three';
import { CHARACTERS, characterById, moveNameList, inputLabel } from './characters.js';
import { STAGE_DEFS } from './stages.js';
import { ACTIONS, ACTION_LABEL, bindingLabel, codeLabel } from './input.js';
import { clamp, pick, rand } from './utils.js';
import { Rig } from './rig.js';

function applySilhouette(root) {
  const mat = new THREE.MeshStandardMaterial({ color: 0x191d28, roughness: 0.55, metalness: 0.55, emissive: 0x0a0e18, emissiveIntensity: 0.6 });
  root.traverse((o) => { if (o.isMesh) { o.material = mat; o.castShadow = false; } });
}

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const ids = (s) => document.getElementById(s);

export class UI {
  constructor(app) {
    this.app = app;
    this.audio = app.audio;
    this.input = app.input;
    this.screen = 'title';
    this.sel = {
      mode: 'arcade', p1: 0, p2: 1, locked: [false, false], stage: 0,
      cpuLevel: 2, survivalRound: 1, arcadeStage: 0,
    };
    this.titleIndex = 0;
    this.setupRows = [];
    this.optionRows = [];
    this.portraitMeshes = [null, null];
    this.portraitScenes = [null, null];
    this.portraitRenderers = [];
    this.rebindTarget = null;
    this.menuNavCd = 0;
    this.lastNav = 0;
    this.bindAll();
    this.buildCharGrid();
    this.buildOptions();
    this._initPortraits();
  }

  bindAll() {
    $$('#screen-title [data-action]').forEach((b) => {
      b.addEventListener('click', () => this.onTitleAction(b.dataset.action));
      b.addEventListener('mouseenter', () => { this.titleIndex = [...$$('#screen-title [data-action]')].indexOf(b); this._refreshTitle(); this.audio.ui('move'); });
    });
    ids('setup-start').addEventListener('click', () => this._startSetup());
    ids('setup-back').addEventListener('click', () => this.showTitle());
    ids('options-back').addEventListener('click', () => { if (this._optionsReturn) this._optionsReturn(); else this.showTitle(); });
    ids('options-default').addEventListener('click', () => this._resetOptions());
    ids('moves-back').addEventListener('click', () => this._showFromMoves());
    ids('pause-resume').addEventListener('click', () => this.app.resumeGame());
    ids('pause-controls').addEventListener('click', () => this.showControls());
    ids('pause-moves').addEventListener('click', () => this.showMovelist(this.app.game?.f1?.cfg?.id || 'rivet', true));
    ids('pause-restart').addEventListener('click', () => this.app.restartMatch());
    ids('pause-quit').addEventListener('click', () => this.app.quitToTitle());
    ids('controls-close').addEventListener('click', () => { ids('controls-overlay').classList.add('hidden'); });
    ids('results-continue').addEventListener('click', () => this.app.onResultsContinue());
    ids('results-quit').addEventListener('click', () => this.app.quitToTitle());
    ids('trial-close').addEventListener('click', () => ids('combo-trial').classList.add('hidden'));
  }

  // ======== navigation ========
  _refreshTitle() {
    const btns = $$('#screen-title [data-action]');
    btns.forEach((b, i) => b.classList.toggle('sel', i === this.titleIndex));
  }

  handleNav(ev) {
    const now = performance.now();
    if (now - this.lastNav < 70) return;
    this.lastNav = now;
    const action = ev.action;
    if (this.screen === 'title') {
      const btns = $$('#screen-title [data-action]');
      if (action === 'up') { this.titleIndex = (this.titleIndex - 1 + btns.length) % btns.length; this.audio.ui('move'); this._refreshTitle(); }
      if (action === 'down') { this.titleIndex = (this.titleIndex + 1) % btns.length; this.audio.ui('move'); this._refreshTitle(); }
      if (action === 'confirm') this.onTitleAction(btns[this.titleIndex].dataset.action);
      return true;
    }
    if (this.screen === 'select') return this._navSelect(ev);
    if (this.screen === 'setup') return this._navSetup(ev);
    if (this.screen === 'options') return this._navOptions(ev);
    if (this.screen === 'moves') {
      if (action === 'cancel' || action === 'confirm') { this.audio.ui('cancel'); this._showFromMoves(); }
      return true;
    }
    return false;
  }

  // ======== TITLE ========
  showTitle() {
    this.screen = 'title';
    this.app.leaveGame();
    this._hideAll();
    ids('screen-title').classList.remove('hidden');
    ids('hud').classList.add('hidden');
    ids('pause').classList.add('hidden');
    ids('controls-overlay').classList.add('hidden');
    ids('results').classList.add('hidden');
    this._startBackground();
    this.audio.setMusicMode('menu', 108);
    this.audio.startMusic('menu', 108);
    this.audio.setIntensity(0.4);
  }

  onTitleAction(action) {
    this.audio.init();
    this.audio.ui('confirm');
    if (action === 'options') return this.showOptions();
    if (action === 'movelist') return this.showMovelist(this.sel.p1);
    this.sel.mode = action;
    if (action === 'training' || action === 'local') {
      // still go through character select
    }
    if (action === 'survival') this.sel.survivalRound = 1;
    if (action === 'arcade') this.sel.arcadeStage = 0;
    this.showSelect(action);
  }

  // ======== BACKGROUND (title / select 3D) ========
  _startBackground() {
    this.app.enterMenuScene();
  }

  // ======== CHARACTER SELECT ========
  _hideAll() {
    ['screen-title', 'screen-select', 'screen-setup', 'screen-options', 'screen-moves', 'loading'].forEach((id) => ids(id).classList.add('hidden'));
    ids('loading').classList.add('hidden');
  }

  showSelect(mode) {
    this.screen = 'select';
    this.sel.mode = mode;
    this.sel.locked = this.sel.mode === 'versus' || this.sel.mode === 'local' ? [false, false] : [false, true];
    if (this.sel.mode === 'local') this.sel.locked = [false, false];
    this._hideAll();
    ids('screen-select').classList.remove('hidden');
    ids('hud').classList.add('hidden');
    ids('sel-mode-label').textContent = { arcade: 'ARCADE', versus: 'VERSUS CPU', local: 'LOCAL 2P', training: 'TRAINING', survival: 'SURVIVAL' }[mode] || 'ARCADE';
    ids('sel-instructions').innerHTML = this.sel.mode === 'local'
      ? 'P1: <b>WASD</b> + <b>U/I/O/J/K/L</b> · P2: <b>ARROWS</b> + <b>NUM PAD</b> · confirm with attack buttons · <b>ESC</b> back'
      : 'P1: <b>WASD</b> or <b>ARROWS</b> move · <b>U/I/O/J/K/L</b> or <b>ENTER</b> confirm · <b>ESC</b> back';
    this.sel.p1 = 0;
    this.sel.p2 = mode === 'versus' || mode === 'local' ? 1 : 1;
    this._rebuildGrid();
    this.sel.locked = [false, this.sel.mode !== 'local'];
    if (this.sel.mode === 'local') this.sel.locked = [false, false];
    this._updateSel();
    this._startBackground();
    this.audio.setMusicMode('select', 124);
    this.audio.setIntensity(0.55);
  }

  buildCharGrid() {
    const grid = ids('sel-grid');
    grid.innerHTML = '';
    this.cells = CHARACTERS.map((c, i) => {
      const cell = document.createElement('div');
      cell.className = 'sel-cell';
      cell.innerHTML = `<canvas width="150" height="150"></canvas><div class="cell-name">${c.name}</div>`;
      cell.addEventListener('click', () => this._clickChar(i));
      cell.addEventListener('mouseenter', () => { this._hoverChar(i); });
      grid.appendChild(cell);
      return cell;
    });
  }

  _rebuildGrid() { this._updateSel(); }

  _hoverChar(i) {
    this.sel.p1 = i;
    this._updateSel();
    this._buildPortrait(0, i);
    this.audio.ui('move');
  }
  _clickChar(i) {
    this.audio.ui('confirm');
    if (!this.sel.locked[1] && this.sel.mode === 'local' && this._selTurn === 1) {
      this.sel.p2 = i; this._lock(1); return;
    }
    this.sel.p1 = i;
    this._lock(0);
  }

  _lock(pi) {
    if (pi === 1 && this.sel.mode !== 'local') return;
    this.sel.locked[pi] = true;
    this._updateSel();
    this.audio.ui('confirm');
    if (this.sel.locked[0] && this.sel.locked[1]) {
      if (this.sel.p1 === this.sel.p2 && this.sel.mode === 'local') {
        // allow mirror
      }
      this._afterBothLocked();
    }
  }

  _navSelect(ev) {
    const a = ev.action;
    const player = ev.player ?? 0;
    if (a === 'cancel') {
      if (this.sel.locked[0] || this.sel.locked[1]) {
        this.sel.locked = [false, this.sel.mode === 'local' ? false : true];
        this.audio.ui('cancel');
        this._updateSel();
      } else { this.audio.ui('cancel'); this.showTitle(); }
      return true;
    }
    const cols = 4;
    if (a === 'up' || a === 'down' || a === 'left' || a === 'right') {
      let i = this.sel.p1;
      if (player === 1 && this.sel.mode === 'local' && !this.sel.locked[1]) i = this.sel.p2;
      if (a === 'left') i = (i + CHARACTERS.length - 1) % CHARACTERS.length;
      if (a === 'right') i = (i + 1) % CHARACTERS.length;
      if (a === 'up') i = (i - cols + CHARACTERS.length) % CHARACTERS.length;
      if (a === 'down') i = (i + cols) % CHARACTERS.length;
      if (player === 1 && this.sel.mode === 'local') this.sel.p2 = i; else this.sel.p1 = i;
      this.audio.ui('move');
      this._updateSel();
      return true;
    }
    if (a === 'confirm') {
      const pi = player === 1 && this.sel.mode === 'local' ? 1 : 0;
      const cur = pi === 0 ? this.sel.p1 : this.sel.p2;
      this._lock(pi);
      return true;
    }
    return true;
  }

  _updateSel() {
    const mode = this.sel.mode;
    const multi = mode === 'local' || mode === 'versus';
    // highlight cells
    this.cells.forEach((c, i) => {
      c.className = 'sel-cell';
      if (mode === 'local' || mode === 'versus') {
        if (i === this.sel.p1 && i === this.sel.p2) c.classList.add('both');
        else if (i === this.sel.p1) c.classList.add('p1');
        else if (i === this.sel.p2) c.classList.add('p2');
      } else {
        if (i === this.sel.p1) c.classList.add('p1');
      }
    });
    // info panels
    const c1 = CHARACTERS[this.sel.p1];
    const c2 = CHARACTERS[this.sel.p2];
    ids('sel-name-p1').textContent = c1.name;
    ids('sel-style-p1').textContent = c1.style.toUpperCase();
    ids('stats-p1').innerHTML = this._statBars(c1);
    if (mode === 'local') {
      ids('sel-name-p2').textContent = c2.name;
      ids('sel-style-p2').textContent = c2.style.toUpperCase();
      ids('stats-p2').innerHTML = this._statBars(c2);
    } else if (mode === 'versus') {
      ids('sel-name-p2').textContent = c2.name;
      ids('sel-style-p2').textContent = c2.style.toUpperCase();
      ids('stats-p2').innerHTML = this._statBars(c2);
    } else {
      ids('sel-name-p2').textContent = '???';
      ids('sel-style-p2').textContent = mode === 'arcade' ? 'OPPONENT' : 'CPU';
      ids('stats-p2').innerHTML = '';
    }
    ids('sel-desc').textContent = `${c1.title} — ${c1.desc}`;
    ids('sel-controls').innerHTML = `ARCHETYPE: ${c1.archetype.toUpperCase()} · DIFFICULTY: ${c1.difficulty}<br>
      THROWS: LP+LK · DRIVE IMPACT: HP+HK · DRIVE PARRY: MP+MK<br>
      SC / DRIVE: →→ · REVERSAL: →+HP+HK`;
    this._buildPortrait(0, this.sel.p1);
    this._buildPortrait(1, this.sel.p2);
  }

  _statBars(c) {
    const names = { power: 'POWER', speed: 'SPEED', range: 'RANGE', defense: 'DEFENSE' };
    return Object.entries(c.stats).map(([k, v]) => `<div class="st"><label>${names[k]}</label><div class="bar"><i style="width:${v * 20}%"></i></div></div>`).join('');
  }

  _afterBothLocked() {
    const mode = this.sel.mode;
    if (mode === 'local') {
      this.audio.ui('confirm');
      setTimeout(() => this._launch(), 240);
      return;
    }
    if (mode === 'versus') {
      this.audio.ui('confirm');
      setTimeout(() => this._launch(), 240);
      return;
    }
    // single-player modes → setup screen
    this.audio.ui('confirm');
    setTimeout(() => this.showSetup(mode), 200);
  }

  // ======== SETUP ========
  showSetup(mode) {
    this.screen = 'setup';
    this.sel.mode = mode;
    this._hideAll();
    ids('screen-setup').classList.remove('hidden');
    ids('setup-title').textContent = { arcade: 'ARCADE SETUP', versus: 'VERSUS SETUP', training: 'TRAINING SETUP', survival: 'SURVIVAL SETUP' }[mode] || 'SETUP';
    const modeIdx = mode === 'training' ? 0 : mode === 'survival' ? 0 : 0;
    const stageLocked = mode === 'arcade' || mode === 'survival';
    this.setupRows = [];
    const rows = ids('setup-rows');
    rows.innerHTML = '';
    const addRow = (label, opts, value, onSet, full = false) => {
      const div = document.createElement('div');
      div.className = 'setup-row' + (full ? ' full' : '');
      div.innerHTML = `<label>${label}</label><div class="setup-opts"></div>`;
      const optsEl = div.querySelector('.setup-opts');
      const idx = this.setupRows.length;
      this.setupRows.push({ value, opts, onSet, el: optsEl, label });
      opts.forEach((o, i) => {
        const b = document.createElement('button');
        b.className = 'opt-btn' + (i === value ? ' on' : '');
        b.textContent = o;
        b.addEventListener('click', () => { this.setupRows[idx].value = i; this._refreshSetupRows(); this.audio.ui('move'); onSet(i); });
        optsEl.appendChild(b);
      });
      rows.appendChild(div);
    };
    addRow('OPPONENT', ['RANDOM', ...CHARACTERS.map((c) => c.name)], 0, (i) => { this.sel.cpuChar = i === 0 ? 'random' : CHARACTERS[i - 1].id; });
    addRow('CPU DIFFICULTY', ['BEGINNER', 'NORMAL', 'ADVANCED', 'EXPERT'], this.sel.cpuLevel, (i) => { this.sel.cpuLevel = i; });
    if (mode === 'training') {
      addRow('DUMMY', ['STAND', 'CROUCH', 'BLOCK', 'JUMP', 'CPU'], 0, (i) => { this.app.options.trainingDummy = ['stand', 'crouch', 'block', 'jump', 'cpu'][i]; this.app.saveOptions(); });
      addRow('DUMMY CPU', ['BEGINNER', 'NORMAL', 'ADVANCED', 'EXPERT'], 1, (i) => { this.app.options.trainingCpu = i; this.app.saveOptions(); });
    }
    addRow('STAGE', stageLocked ? ['AUTO'] : STAGE_DEFS.map((s) => s.name), stageLocked ? 0 : this.sel.stage + 1, (i) => { if (!stageLocked) this.sel.stage = i - 1; });
    addRow('ROUNDS', ['1', '3', '5'], 1, (i) => { this.app.options.rounds = [1, 3, 5][i]; this.app.saveOptions(); });
    addRow('TIMER', ['30', '60', '99', '∞'], 2, (i) => { this.app.options.timer = [30, 60, 99, 0][i]; this.app.saveOptions(); });
    this._refreshSetupRows();
  }

  _refreshSetupRows() {
    this.setupRows.forEach((r) => {
      [...r.el.children].forEach((b, i) => b.classList.toggle('on', i === r.value));
    });
  }

  _navSetup(ev) {
    const a = ev.action;
    if (a === 'cancel') { this.audio.ui('cancel'); this.showSelect(this.sel.mode); return true; }
    if (a === 'confirm') { this._startSetup(); return true; }
    // navigate rows
    if (!this.setupFocus) this.setupFocus = { row: 0, col: -1 };
    const f = this.setupFocus;
    if (a === 'down') { f.row = Math.min(this.setupRows.length - 1, f.row + 1); f.col = -1; this.audio.ui('move'); }
    if (a === 'up') { f.row = Math.max(0, f.row - 1); f.col = -1; this.audio.ui('move'); }
    if (a === 'right') {
      const r = this.setupRows[f.row];
      f.col = Math.min(r.opts.length - 1, (f.col < 0 ? r.value : f.col) + 1);
      r.value = f.col; r.onSet(f.col); this._refreshSetupRows(); this.audio.ui('move');
    }
    if (a === 'left') {
      const r = this.setupRows[f.row];
      f.col = Math.max(0, (f.col < 0 ? r.value : f.col) - 1);
      r.value = f.col; r.onSet(f.col); this._refreshSetupRows(); this.audio.ui('move');
    }
    return true;
  }

  _startSetup() {
    const mode = this.sel.mode;
    this.audio.ui('confirm');
    if (this.setupRows[0]) this.setupRows[0].onSet(this.setupRows[0].value);
    if (mode === 'training') {
      this.app.options.trainingDummy = ['stand', 'crouch', 'block', 'jump', 'cpu'][this.setupRows[2]?.value ?? 0];
    }
    this._launch();
  }

  _launch() {
    const mode = this.sel.mode;
    let p2 = this.sel.p2;
    let cpuChar = this._chosenCpuChar();
    if (mode !== 'local') {
      if (cpuChar === 'random') cpuChar = pick(CHARACTERS).id;
      p2 = CHARACTERS.findIndex((c) => c.id === cpuChar);
      if (p2 < 0) p2 = 1;
    }
    const stageId = (mode === 'arcade' || mode === 'survival')
      ? STAGE_DEFS[this.sel.arcadeStage % STAGE_DEFS.length].id
      : STAGE_DEFS[this.sel.stage] ? STAGE_DEFS[this.sel.stage].id : STAGE_DEFS[0].id;
    this.app.startMatch({
      p1Char: CHARACTERS[this.sel.p1].id,
      p2Char: CHARACTERS[p2].id,
      stageId,
      mode,
      cpuLevel: this.sel.cpuLevel,
      survivalRound: this.sel.survivalRound,
      arcadeStage: this.sel.arcadeStage,
    });
  }

  _chosenCpuChar() {
    if (this.sel.cpuChar) return this.sel.cpuChar;
    return 'random';
  }

  // ======== OPTIONS ========
  buildOptions() {
    const grid = ids('options-grid');
    grid.innerHTML = '';
    this.optionRows = [];
    const O = () => this.app.options;
    const addOpt = (label, opts, get, set, full = false) => {
      const row = document.createElement('div');
      row.className = 'opt-row' + (full ? ' full' : '');
      row.innerHTML = `<label>${label}</label><div class="setup-opts"></div>`;
      const wrap = row.querySelector('.setup-opts');
      const i = this.optionRows.length;
      this.optionRows.push({ el: wrap, opts, get });
      opts.forEach((o, k) => {
        const b = document.createElement('button');
        b.className = 'opt-btn';
        b.textContent = o;
        b.addEventListener('click', () => { set(k); this._refreshOptions(); this.audio.ui('move'); });
        wrap.appendChild(b);
      });
      grid.appendChild(row);
      return row;
    };
    addOpt('ROUNDS', ['1', '3', '5'], () => O().rounds, (k) => { O().rounds = [1, 3, 5][k]; this.app.saveOptions(); });
    addOpt('TIMER', ['30', '60', '99', '∞'], () => O().timer, (k) => { O().timer = [30, 60, 99, 0][k]; this.app.saveOptions(); });
    addOpt('CPU LEVEL', ['BEGINNER', 'NORMAL', 'ADVANCED', 'EXPERT'], () => O().cpuLevel, (k) => { O().cpuLevel = k; this.sel.cpuLevel = k; this.app.saveOptions(); });
    addOpt('DIFFICULTY', ['CHILL', 'STANDARD', 'BRUTAL'], () => O().difficulty, (k) => { O().difficulty = k; this.app.saveOptions(); });
    addOpt('HIT MARKERS', ['OFF', 'ON'], () => O().hitFx, (k) => { O().hitFx = k; this.app.saveOptions(); });
    addOpt('SCREEN SHAKE', ['OFF', 'LOW', 'FULL'], () => O().shake, (k) => { O().shake = k; this.app.saveOptions(); });
    addOpt('AUDIO', ['MUTE', 'ON'], () => O().audioOn ? 1 : 0, (k) => { O().audioOn = k === 1; this.app.saveOptions(); });
    // volume sliders
    const vol = document.createElement('div');
    vol.className = 'opt-row full slider-row';
    vol.innerHTML = `<label>MASTER VOL</label><input type="range" min="0" max="100" value="${Math.round(O().volMaster * 100)}"><span style="width:34px;text-align:right">${Math.round(O().volMaster * 100)}</span>`;
    vol.querySelector('input').addEventListener('input', (e) => {
      O().volMaster = e.target.value / 100;
      vol.querySelector('span').textContent = e.target.value;
      this.app.applyAudioOptions();
      this.app.saveOptions();
    });
    grid.appendChild(vol);
    const volM = document.createElement('div');
    volM.className = 'opt-row full slider-row';
    volM.innerHTML = `<label>MUSIC VOL</label><input type="range" min="0" max="100" value="${Math.round(O().volMusic * 100)}"><span style="width:34px;text-align:right">${Math.round(O().volMusic * 100)}</span>`;
    volM.querySelector('input').addEventListener('input', (e) => {
      O().volMusic = e.target.value / 100;
      volM.querySelector('span').textContent = e.target.value;
      this.app.applyAudioOptions();
      this.app.saveOptions();
    });
    grid.appendChild(volM);
    const volS = document.createElement('div');
    volS.className = 'opt-row full slider-row';
    volS.innerHTML = `<label>SFX VOL</label><input type="range" min="0" max="100" value="${Math.round(O().volSfx * 100)}"><span style="width:34px;text-align:right">${Math.round(O().volSfx * 100)}</span>`;
    volS.querySelector('input').addEventListener('input', (e) => {
      O().volSfx = e.target.value / 100;
      volS.querySelector('span').textContent = e.target.value;
      this.app.applyAudioOptions();
      this.app.saveOptions();
    });
    grid.appendChild(volS);
    // controls columns button
    const ctrlRow = document.createElement('div');
    ctrlRow.className = 'opt-row full';
    ctrlRow.innerHTML = '<label>CONTROLS</label>';
    const bw = document.createElement('div'); bw.className = 'setup-opts';
    const b1 = document.createElement('button'); b1.className = 'opt-btn'; b1.textContent = 'CONFIGURE P1 / P2';
    b1.addEventListener('click', () => this.showControls(true));
    bw.appendChild(b1);
    ctrlRow.appendChild(bw);
    grid.appendChild(ctrlRow);
    this._refreshOptions();
  }

  _refreshOptions() {
    this.optionRows.forEach((r) => {
      const v = r.get();
      [...r.el.children].forEach((b, i) => b.classList.toggle('on', i === v));
    });
  }

  _resetOptions() {
    this.app.resetOptions();
    this.audio.ui('confirm');
    // recreate sliders
    this.buildOptions();
  }

  showOptions(returnFn = null) {
    this.screen = 'options';
    this._optionsReturn = returnFn || (() => { if (this.app.game) this.app.resumeGame(); else this.showTitle(); });
    this._hideAll();
    ids('hud').classList.add('hidden');
    ids('screen-options').classList.remove('hidden');
    ids('pause').classList.add('hidden');
    this._refreshOptions();
    this._startBackground();
  }

  _navOptions(ev) {
    const a = ev.action;
    if (a === 'cancel' || a === 'confirm') { this.audio.ui('cancel'); if (this._optionsReturn) this._optionsReturn(); return true; }
    if (!this.optFocus) this.optFocus = { row: 0, col: 0 };
    const rows = this.optionRows;
    if (a === 'down') { this.optFocus.row = Math.min(rows.length - 1, this.optFocus.row + 1); this.audio.ui('move'); }
    if (a === 'up') { this.optFocus.row = Math.max(0, this.optFocus.row - 1); this.audio.ui('move'); }
    if (a === 'right' || a === 'left') {
      const r = rows[this.optFocus.row];
      if (r) {
        const cur = r.get();
        const next = clamp(cur + (a === 'right' ? 1 : -1), 0, r.opts.length - 1);
        [...r.el.children][next]?.click();
        this.audio.ui('move');
      }
    }
    return true;
  }

  // ======== CONTROLS ========
  showControls(fromOptions = false) {
    this._controlsFrom = fromOptions ? 'options' : 'pause';
    ids('controls-overlay').classList.remove('hidden');
    this._renderControls();
  }

  _renderControls() {
    const body = ids('controls-body');
    const pad = this.input.pads[0];
    const padInfo = pad ? `<span class="pad-dot on"></span>${pad.id.slice(0, 28)}` : '<span class="pad-dot"></span>NO GAMEPAD';
    let html = `<div class="ch">ACTION</div><div class="ch">PLAYER 1</div><div class="ch">PLAYER 2</div>`;
    for (const a of ACTIONS) {
      const k1 = this.app.bindings.p1[a]?.[0];
      const k2 = this.app.bindings.p2[a]?.[0];
      html += `<div class="keyrow"><span>${ACTION_LABEL[a]}</span></div>
        <div class="keyrow"><kbd class="rebind" data-p="p1" data-a="${a}">${bindingLabel(k1)}</kbd></div>
        <div class="keyrow"><kbd class="rebind" data-p="p2" data-a="${a}">${bindingLabel(k2)}</kbd></div>`;
    }
    html += `<div class="keyrow" style="grid-column:1/-1;margin-top:8px;color:#8b93a7;font-size:10.5px">
      GAMEPAD: ${padInfo} · Click a key to rebind, then press the new key or pad button.<br>
      D-PAD / LEFT STICK = move · face buttons LP/MP/HP · L1/L2 = LK/MK · R1/R2 = HK (defaults)<br>
      MENUS: arrows / dpad, ENTER or A confirm, ESC or B back, START pause.</div>`;
    body.innerHTML = html;
    body.querySelectorAll('kbd.rebind').forEach((k) => {
      k.addEventListener('click', () => {
        k.textContent = 'PRESS…';
        this.audio.ui('tick');
        this.input.captureNext((b) => {
          if (b) {
            const p = k.dataset.p, a = k.dataset.a;
            this.app.bindings[p][a] = [b];
            this.app.saveOptions();
            this.audio.ui('confirm');
          }
          this._renderControls();
        });
      });
    });
  }

  // ======== MOVE LIST ========
  showMovelist(charId = null, fromPause = false) {
    this.screen = 'moves';
    this._movesFrom = fromPause ? 'pause' : 'title';
    this._hideAll();
    ids('hud').classList.add('hidden');
    ids('pause').classList.add('hidden');
    ids('controls-overlay').classList.add('hidden');
    ids('screen-moves').classList.remove('hidden');
    this.moveChar = CHARACTERS.findIndex((c) => c.id === charId);
    if (this.moveChar < 0) this.moveChar = 0;
    const tabs = ids('moves-tabs');
    tabs.innerHTML = '';
    CHARACTERS.forEach((c, i) => {
      const t = document.createElement('button');
      t.className = 'mt' + (i === this.moveChar ? ' on' : '');
      t.textContent = c.name;
      t.addEventListener('click', () => { this.moveChar = i; this.showMovelist(c.id, fromPause); this.audio.ui('move'); });
      tabs.appendChild(t);
    });
    const c = CHARACTERS[this.moveChar];
    const list = moveNameList(c);
    let html = `<div class="mv-head"><span>MOVE</span><span>INPUT</span><span>TYPE</span><span>DMG</span><span>START</span><span>NOTES</span></div>`;
    for (const m of list) {
      if (m.section) { html += `<div class="mv-sect">${m.section}</div>`; continue; }
      const tg = m.type.startsWith('SA') ? 'sa' : m.type === 'SP' ? 'sp' : m.type === 'EX' ? 'ex' : '';
      html += `<div class="mv"><span class="nm">${m.name}</span><span class="in">${m.input}</span>
        <span class="tg ${tg}">${m.type}</span><span>${m.dmg}</span><span>${m.startup}</span><span class="cm">${m.cancel}</span></div>`;
    }
    ids('moves-body').innerHTML = html;
  }

  _showFromMoves() {
    if (this._movesFrom === 'pause') { ids('screen-moves').classList.add('hidden'); ids('pause').classList.remove('hidden'); this.screen = 'pause'; }
    else this.showTitle();
  }

  // ======== RESULTS ========
  showResults({ title, sub, stats, buttons }) {
    ids('results').classList.remove('hidden');
    ids('results-head').textContent = title;
    ids('results-sub').textContent = sub;
    ids('results-stats').innerHTML = stats.map((s) => `<div><span>${s[0]}</span><b>${s[1]}</b></div>`).join('');
    const cont = ids('results-continue');
    cont.textContent = buttons?.[0]?.label || 'CONTINUE';
    cont.onclick = buttons?.[0]?.fn || (() => this.app.quitToTitle());
    const quit = ids('results-quit');
    quit.style.display = buttons?.[1] ? '' : 'none';
    quit.onclick = buttons?.[1]?.fn || (() => this.app.quitToTitle());
  }

  hideResults() { ids('results').classList.add('hidden'); }

  // ======== PORTRAITS (single shared WebGL context) ========
  _initPortraits() {
    // One offscreen renderer shared by every portrait / thumbnail so we never
    // exceed the browser's WebGL context limit (the game canvas needs its own).
    this.prRenderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
    this.prRenderer.setPixelRatio(1);
    this.prRenderer.setSize(320, 400, false);
    this.prRenderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.prRenderer.outputColorSpace = THREE.SRGBColorSpace;

    const mkScene = (w, h) => {
      const scene = new THREE.Scene();
      const cam = new THREE.PerspectiveCamera(30, w / h, 0.1, 20);
      cam.position.set(0.72, 1.24, 3.35);
      cam.lookAt(0, 1.02, 0);
      scene.add(new THREE.HemisphereLight(0xaaccff, 0x221a2a, 1.5));
      const key = new THREE.DirectionalLight(0xffffff, 3.3); key.position.set(2, 4, 3); scene.add(key);
      const rim = new THREE.DirectionalLight(0xff6a9a, 2.4); rim.position.set(-3, 2, -2); scene.add(rim);
      const fill = new THREE.DirectionalLight(0x66aaff, 1.5); fill.position.set(1, 0.4, 3); scene.add(fill);
      return { scene, cam };
    };
    this.portraitRigs = [null, null];
    this.portraitKeys = [null, null];
    this.portraitScenes = [mkScene(320, 400), mkScene(320, 400)];
    this.thumbScene = mkScene(1, 1);
    this.thumbScene.cam.position.set(0.62, 1.16, 2.72);
    this.thumbScene.cam.lookAt(0, 1.0, 0);
    this._poseCache = null;
    import('./poses.js').then(({ getPose, mixPose }) => {
      this._poseCache = {
        portrait: mixPose(getPose('stance'), getPose('victoryPoint'), 0.6),
        thumb: mixPose(getPose('stance'), getPose('introFlex'), 0.42),
      };
      CHARACTERS.forEach((c, i) => this._drawThumb(i, c));
      this._buildPortrait(0, this.sel.p1);
      this._buildPortrait(1, this.sel.p2);
    });
  }

  _drawThumb(i, cfg) {
    const cell = this.cells[i];
    if (!cell || !this._poseCache) return;
    const canvas = cell.querySelector('canvas');
    const ctx = canvas.getContext('2d');
    const rig = new Rig(cfg);
    this.thumbScene.scene.add(rig.group);
    rig.snapPose(this._poseCache.thumb);
    rig.group.rotation.y = 0.62;
    this.prRenderer.setSize(150, 150, false);
    this.prRenderer.render(this.thumbScene.scene, this.thumbScene.cam);
    ctx.clearRect(0, 0, 150, 150);
    ctx.drawImage(this.prRenderer.domElement, 0, 0, 150, 150, 0, 0, 150, 150);
    this.thumbScene.scene.remove(rig.group);
    rig.dispose();
  }

  _buildPortrait(idx, charIdx) {
    if (!this._poseCache) return;
    const cfg = CHARACTERS[charIdx];
    const silhouette = idx === 1 && (this.sel.mode === 'arcade' || this.sel.mode === 'survival' || this.sel.mode === 'versus') && !this._revealP2;
    const key = cfg.id + (idx === 1 && this.sel.mode !== 'local' && !this._revealP2 ? ':sil' : '');
    if (this.portraitKeys[idx] === key) return;
    this.portraitKeys[idx] = key;
    const ps = this.portraitScenes[idx];
    if (this.portraitRigs[idx]) { ps.scene.remove(this.portraitRigs[idx].group); this.portraitRigs[idx].dispose(); }
    const rig = new Rig(cfg);
    rig.group.rotation.y = 0.42;
    ps.scene.add(rig.group);
    rig.snapPose(this._poseCache.portrait);
    if (silhouette) applySilhouette(rig.group);
    this.portraitRigs[idx] = rig;
    this._renderPortrait(idx);
  }

  _renderPortrait(idx) {
    const ps = this.portraitScenes[idx];
    const rig = this.portraitRigs[idx];
    if (!ps || !rig) return;
    const canvas = ids('portrait-canvas-p' + (idx + 1));
    const ctx = canvas.getContext('2d');
    this.prRenderer.setSize(320, 400, false);
    this.prRenderer.render(ps.scene, ps.cam);
    ctx.clearRect(0, 0, 320, 400);
    ctx.drawImage(this.prRenderer.domElement, 0, 0, 320, 400);
  }

  renderPortraits(dt) {
    const selVisible = !ids('screen-select').classList.contains('hidden');
    if (!selVisible || !this._poseCache) return;
    this.prTime = (this.prTime || 0) + dt;
    for (let i = 0; i < 2; i++) {
      const rig = this.portraitRigs[i];
      if (!rig) continue;
      rig.update(dt);
      rig.group.position.y = Math.sin(this.prTime * 1.5 + i) * 0.015;
      rig.group.rotation.y = 0.42 + Math.sin(this.prTime * 0.6 + i * 2) * 0.05;
      this._renderPortrait(i);
    }
  }
}
