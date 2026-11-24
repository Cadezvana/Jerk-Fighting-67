// Entry point: renderer, options, state routing, game loop.
import * as THREE from 'three';
import { InputSystem, defaultBindings } from './input.js';
import { AudioSys } from './audio.js';
import { Game } from './game.js';
import { UI } from './ui.js';
import { Rig } from './rig.js';
import { CHARACTERS } from './characters.js';
import { pick } from './utils.js';

const OPTIONS_KEY = 'jf67_options_v2';
const DEFAULT_OPTIONS = {
  rounds: 3, timer: 99, cpuLevel: 2, difficulty: 1, hitFx: 1, shake: 2,
  audioOn: true, volMaster: 0.8, volMusic: 0.4, volSfx: 0.9,
  trainingDummy: 'stand', trainingCpu: 1, showFps: false,
};

class App {
  constructor() {
    this.canvas = document.getElementById('viewport');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.06;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.audio = new AudioSys();
    this.input = new InputSystem();
    this.options = this.loadOptions();
    this.bindings = this.loadBindings();
    this.input.setBindings(this.bindings);
    this.menuScene = new THREE.Scene();
    this.menuCamera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.1, 200);
    this.menuCamera.position.set(0, 2.2, 6.2);
    this.menuCamera.lookAt(0, 1.15, 0);
    this.menuFighters = [];
    this.menuTime = 0;
    this.game = null;
    this.paused = false;
    this.lastTime = performance.now();
    this.frameTimes = [];
    this.fpsEl = document.getElementById('fps');
    this.mode = 'menu';
    this.acc = 0;
    this.applyAudioOptions();
    this.setupMenuScene();
    this.ui = new UI(this);
    this.setupResize();
    this.setupKeyHandlers();
    this.hideLoading();
    this.ui.showTitle();
    this.clock = new THREE.Clock();
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  // ---------- persistence ----------
  loadOptions() {
    try {
      const raw = localStorage.getItem(OPTIONS_KEY);
      if (raw) return { ...DEFAULT_OPTIONS, ...JSON.parse(raw) };
    } catch (e) { /* ignore */ }
    return { ...DEFAULT_OPTIONS };
  }
  saveOptions() {
    try {
      localStorage.setItem(OPTIONS_KEY, JSON.stringify(this.options));
      localStorage.setItem(OPTIONS_KEY + '_bind', JSON.stringify(this.bindings));
    } catch (e) { /* ignore */ }
  }
  loadBindings() {
    try {
      const raw = localStorage.getItem(OPTIONS_KEY + '_bind');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.p1 && parsed.p2) return parsed;
      }
    } catch (e) { }
    return defaultBindings();
  }
  resetOptions() {
    this.options = { ...DEFAULT_OPTIONS };
    this.bindings = defaultBindings();
    this.input.setBindings(this.bindings);
    this.applyAudioOptions();
    this.saveOptions();
  }
  applyAudioOptions() {
    this.audio.setVolumes(this.options.volMaster, this.options.volMusic, this.options.volSfx);
    this.audio.setMuted(!this.options.audioOn);
  }
  hideLoading() {
    const el = document.getElementById('loading');
    document.getElementById('load-fill').style.width = '100%';
    setTimeout(() => { el.classList.add('fade'); setTimeout(() => el.classList.add('hidden'), 520); }, 260);
  }

  // ---------- menu 3D background ----------
  setupMenuScene() {
    const s = this.menuScene;
    s.background = new THREE.Color(0x070a13);
    s.fog = new THREE.Fog(0x070a13, 9, 26);
    const hemi = new THREE.HemisphereLight(0x6688cc, 0x1a0e1e, 0.9);
    s.add(hemi);
    const key = new THREE.SpotLight(0xffffff, 60, 30, 0.7, 0.5, 1.6);
    key.position.set(3, 8, 4);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    s.add(key);
    const rim = new THREE.PointLight(0xff2d6e, 34, 22, 2);
    rim.position.set(-4, 2.4, -3); s.add(rim);
    const rim2 = new THREE.PointLight(0x35a0ff, 26, 22, 2);
    rim2.position.set(4.5, 2.0, -3); s.add(rim2);
    // floor
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x11151f, roughness: 0.4, metalness: 0.7 });
    const floor = new THREE.Mesh(new THREE.CircleGeometry(7, 48), floorMat);
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; s.add(floor);
    // grid ring
    for (let i = 0; i < 3; i++) {
      const m = new THREE.Mesh(new THREE.RingGeometry(2.2 + i * 1.4, 2.26 + i * 1.4, 64),
        new THREE.MeshBasicMaterial({ color: i === 0 ? 0xff2d6d : 0x2f6dff, transparent: true, opacity: 0.5 - i * 0.12, side: THREE.DoubleSide }));
      m.rotation.x = -Math.PI / 2; m.position.y = 0.01; s.add(m);
    }
    // background pillars
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const geo = new THREE.BoxGeometry(0.35, 6, 0.35);
      const mat = new THREE.MeshStandardMaterial({ color: 0x1a2233, roughness: 0.6, metalness: 0.5, emissive: 0x0a1428, emissiveIntensity: 0.6 });
      const p = new THREE.Mesh(geo, mat);
      p.position.set(Math.cos(a) * 8.5, 3, Math.sin(a) * 8.5 - 2);
      s.add(p);
    }
    // fighter showcase rigs: p1 left, p2 right
    for (let i = 0; i < 2; i++) {
      const c = CHARACTERS[i === 0 ? 0 : 3];
      const rig = new Rig(c);
      rig.group.position.set(i === 0 ? -1.55 : 1.55, 0, -0.6);
      rig.group.rotation.y = i === 0 ? 0.5 : -0.5;
      rig.group.scale.setScalar(1.12);
      s.add(rig.group);
      this.menuFighters.push({ rig, cfg: c, baseX: rig.group.position.x, phase: i * Math.PI });
    }
    this.menuPose = null;
    import('./poses.js').then(({ getPose, mixPose }) => {
      this.menuPose = mixPose(getPose('stance'), getPose('victoryPoint'), 0.35);
      for (const mf of this.menuFighters) mf.rig.snapPose(this.menuPose);
    });
    // particles
    const geo = new THREE.BufferGeometry();
    const N = 220;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 20;
      pos[i * 3 + 1] = Math.random() * 9;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 16 - 2;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.menuDust = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0x9fbfef, size: 0.05, transparent: true, opacity: 0.55, depthWrite: false }));
    s.add(this.menuDust);
  }

  setMenuChar(idx1, idx2) {
    const swap = (mf, idx) => {
      const c = CHARACTERS[idx];
      if (mf.cfg.id === c.id) return;
      const nx = mf.rig.group.position.x;
      this.menuScene.remove(mf.rig.group);
      mf.rig.dispose?.();
      const rig = new Rig(c);
      rig.group.position.set(nx, 0, -0.6);
      rig.group.rotation.y = mf.baseX < 0 ? 0.5 : -0.5;
      rig.group.scale.setScalar(1.12);
      this.menuScene.add(rig.group);
      mf.rig = rig; mf.cfg = c;
      if (this.menuPose) rig.snapPose(this.menuPose);
    };
    swap(this.menuFighters[0], idx1);
    swap(this.menuFighters[1], idx2);
  }

  enterMenuScene() {
    if (this.mode === 'menu') return;
    this.leaveGame();
  }

  // ---------- flow ----------
  showGameView() {
    document.getElementById('screen-title').classList.add('hidden');
    document.getElementById('screen-select').classList.add('hidden');
    document.getElementById('screen-setup').classList.add('hidden');
    document.getElementById('screen-moves').classList.add('hidden');
    document.getElementById('results').classList.add('hidden');
    document.getElementById('hud').classList.remove('hidden');
    this.mode = 'game';
    this.paused = false;
  }

  startMatch(config) {
    this.audio.init();
    if (this.game) { this.game.f1?.dispose(); this.game.f2?.dispose(); this.game.stage?.dispose(); }
    document.getElementById('screen-select').classList.add('hidden');
    document.getElementById('screen-setup').classList.add('hidden');
    this.game = new Game(this);
    this.game.onMatchEnd = null;
    this.game.startMatch(config);
    document.body.classList.toggle('training-mode', config.mode === 'training');
    this.mode = 'game';
    this.paused = false;
    this.ui.screen = 'game';
  }

  onMatchEnd(game, winnerIdx) {
    // handled per-mode by examining mode
    setTimeout(() => this._handleMatchEnd(game, winnerIdx), 2600);
  }

  _handleMatchEnd(game, winnerIdx) {
    const mode = game.currentMode;
    const win = game.fighters[winnerIdx];
    const lose = game.fighters[1 - winnerIdx];
    const st = game.stats[winnerIdx];
    const statRows = [
      ['DAMAGE DEALT', st.damage.toLocaleString()],
      ['MAX COMBO', st.maxCombo + ' hits'],
      ['HITS LANDED', st.hits],
      ['SPECIALS', st.specials],
      ['SUPER ARTS', st.supers],
      ['PARRY / DRIVE', game.stats[0].parries + game.stats[1].parries + ' / ' + game.stats[0].drives],
    ];
    if (mode === 'arcade') {
      if (winnerIdx === 0) {
        // advance arcade
        const nextStage = game.arcadeStage + 1;
        if (nextStage >= 6) {
          this.ui.showResults({
            title: 'CIRCUIT COMPLETE', sub: 'YOU ARE THE WORLD WARRIOR',
            stats: statRows,
            buttons: [{ label: 'NEW RUN', fn: () => { this.ui.sel.arcadeStage = 0; this.ui.sel.survivalRound = 1; this.ui.showSelect('arcade'); this.hideGameAndResults(); } },
              { label: 'TITLE', fn: () => { this.hideGameAndResults(); this.quitToTitle(); } }],
            buttons2: null,
          });
        } else {
          this.ui.showResults({
            title: 'STAGE CLEAR', sub: 'A NEW CHALLENGER',
            stats: statRows,
            buttons: [{ label: 'NEXT OPPONENT', fn: () => {
              this.ui.sel.arcadeStage = nextStage;
              this.hideGameAndResults();
              this.startArcadeNext();
            } }, { label: 'TITLE', fn: () => { this.hideGameAndResults(); this.quitToTitle(); } }],
          });
        }
      } else {
        this.ui.showResults({
          title: 'DEFEATED', sub: 'CONTINUE?',
          stats: statRows,
          buttons: [{ label: 'RETRY', fn: () => { this.hideGameAndResults(); this.retryMatch(game); } },
            { label: 'TITLE', fn: () => { this.hideGameAndResults(); this.quitToTitle(); } }],
        });
      }
      return;
    }
    if (mode === 'survival') {
      if (winnerIdx === 0) {
        const round = game.survivalRound + 1;
        this.ui.showResults({
          title: 'SURVIVED ×' + game.survivalRound,
          sub: 'OPPONENT ' + round + ' INCOMING',
          stats: statRows,
          buttons: [{ label: 'FIGHT ON', fn: () => { this.hideGameAndResults(); this.startSurvivalRound(round); } },
            { label: 'RETIRE', fn: () => { this.hideGameAndResults(); this.quitToTitle(); } }],
        });
      } else {
        this.ui.showResults({
          title: 'GAUNTLET OVER', sub: 'YOU LASTED ' + game.survivalRound + ' OPPONENTS',
          stats: statRows,
          buttons: [{ label: 'TRY AGAIN', fn: () => { this.hideGameAndResults(); this.startSurvivalRound(1); } },
            { label: 'TITLE', fn: () => { this.hideGameAndResults(); this.quitToTitle(); } }],
        });
      }
      return;
    }
    if (mode === 'training') {
      this.ui.showResults({ title: 'SESSION', sub: 'TRAINING COMPLETE', stats: statRows, buttons: [{ label: 'BACK TO FIGHT', fn: () => { this.hideGameAndResults(); this.resumeGame(); } }] });
      return;
    }
    // versus/local
    this.ui.showResults({
      title: game.fighters[winnerIdx].cfg.name + ' WINS',
      sub: mode === 'local' ? 'PLAYER ' + (winnerIdx + 1) + ' VICTORY' : 'YOU WIN',
      stats: statRows,
      buttons: [{ label: 'REMATCH', fn: () => { this.hideGameAndResults(); this.restartMatch(); } },
        { label: 'TITLE', fn: () => { this.hideGameAndResults(); this.quitToTitle(); } }],
    });
  }

  hideGameAndResults() {
    document.getElementById('results').classList.add('hidden');
  }

  startArcadeNext() {
    const ui = this.ui;
    const p1 = CHARACTERS[ui.sel.p1].id;
    // pick a fresh opponent
    const order = ['grizz', 'ember', 'kaze', 'rook', 'sable', 'butcher'];
    const opp = order[Math.min(ui.sel.arcadeStage, order.length - 1)];
    const stage = ui.sel.arcadeStage % 6;
    this.startMatch({
      p1Char: p1, p2Char: opp,
      stageId: ['neon-docks', 'market', 'foundry', 'temple', 'skydeck', 'dojo'][stage],
      mode: 'arcade', cpuLevel: Math.min(3, 1 + Math.floor(stage / 2)),
      arcadeStage: ui.sel.arcadeStage,
    });
    document.getElementById('hud').classList.remove('hidden');
  }

  startSurvivalRound(round) {
    const ui = this.ui;
    const p1 = CHARACTERS[ui.sel.p1].id;
    const opps = CHARACTERS.filter((c) => c.id !== p1);
    const opp = opps[(round * 3) % opps.length];
    this.startMatch({
      p1Char: p1, p2Char: opp.id, stageId: ['neon-docks', 'foundry', 'skydeck', 'market'][round % 4],
      mode: 'survival', cpuLevel: Math.min(3, 1 + Math.floor(round / 2)), survivalRound: round,
    });
    document.getElementById('hud').classList.remove('hidden');
  }

  retryMatch(game) {
    const cfg = { ...game.config };
    this.startMatch(cfg);
    document.getElementById('hud').classList.remove('hidden');
  }

  restartMatch() {
    if (!this.game) return;
    const cfg = { ...this.game.config };
    this.startMatch(cfg);
    this.paused = false;
    document.getElementById('pause').classList.add('hidden');
  }

  resumeGame() {
    this.paused = false;
    if (this.game) this.game.paused = false;
    document.getElementById('pause').classList.add('hidden');
  }

  pauseGame() {
    if (!this.game || this.mode !== 'game') return;
    this.paused = true;
    this.game.paused = true;
    document.getElementById('pause').classList.remove('hidden');
  }

  leaveGame() {
    document.body.classList.remove('training-mode');
    this.mode = 'menu';
    this.paused = false;
    document.getElementById('hud').classList.add('hidden');
    document.getElementById('pause').classList.add('hidden');
    document.getElementById('results').classList.add('hidden');
    document.getElementById('controls-overlay').classList.add('hidden');
    if (this.game) {
      this.game.f1?.dispose();
      this.game.f2?.dispose();
      this.game.stage?.dispose();
      for (const p of this.game.fx.projectiles) this.game.fx._removeProj?.(p);
      this.game = null;
    }
    this.audio.setMusicMode('menu', 108);
    this.audio.startMusic('menu', 108);
  }

  quitToTitle() {
    this.leaveGame();
    this.audio.stopMusic();
    this.ui.showTitle();
  }

  onResultsContinue() {
    // default handled by UI
  }

  // ---------- resize ----------
  setupResize() {
    window.addEventListener('resize', () => {
      const w = window.innerWidth, h = window.innerHeight;
      this.renderer.setSize(w, h);
      this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
      const aspect = w / h;
      this.menuCamera.aspect = aspect; this.menuCamera.updateProjectionMatrix();
      if (this.game) this.game.camera.setAspect(aspect);
    });
  }

  setupKeyHandlers() {
    window.addEventListener('keydown', (e) => {
      if (this.input.recording) return;
      if (e.code === 'Escape') {
        if (this.mode === 'game' && this.ui.screen === 'game') {
          if (this.paused) { this.resumeGame(); } else { this.pauseGame(); }
          e.preventDefault();
          return;
        }
      }
      if (this.mode === 'game' && this.game && this.ui.screen === 'game') {
        if (e.code === 'F1') { this.game.trainingState.display = !this.game.trainingState.display; }
        if (e.code === 'F2') { this.game.trainingReset(); }
        if (e.code === 'F3') { this.game.trainingToggleRecPlay(); }
        if (e.code === 'F4') { this.game.trainingCycleDummy(); }
        if (e.code === 'F5') { this.game.trainingReset(); }
        if (e.code === 'F6') { this.game.trainingToggleHealth(); }
        if (e.code === 'F7') { this.game.trainingSetDummy('record'); }
      }
    });
  }

  // ---------- loop ----------
  loop(now) {
    requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, (now - this.lastTime) / 1000 || 0.016);
    this.lastTime = now;
    this.menuTime += dt;

    // input nav for menus
    this.input.updateMenuRepeat(dt);
    const navs = this.input.pollMenus();
    for (const ev of navs) {
      if (this.mode === 'game') {
        if (ev.action === 'pause' && this.ui.screen === 'game') { if (this.paused) this.resumeGame(); else this.pauseGame(); }
        continue;
      }
      if (this.ui.screen === 'pause') {
        if (ev.action === 'cancel' || ev.action === 'confirm' || ev.action === 'pause') { this.resumeGame(); }
        continue;
      }
      if (!document.getElementById('controls-overlay').classList.contains('hidden')) {
        if (ev.action === 'cancel' || ev.action === 'confirm' || ev.action === 'pause') document.getElementById('controls-overlay').classList.add('hidden');
        continue;
      }
      if (!document.getElementById('results').classList.contains('hidden')) {
        if (ev.action === 'confirm') document.getElementById('results-continue')?.click();
        continue;
      }
      this.ui.handleNav(ev);
    }

    if (this.game && this.mode === 'game') {
      this.game.update(dt);
      this.renderer.render(this.game.scene, this.game.camera.camera);
      this.game.fx.update(dt);
    } else {
      // menu scene
      this.menuTime2 = (this.menuTime2 || 0) + dt;
      const t = this.menuTime2;
      this.menuCamera.position.x = Math.sin(t * 0.16) * 1.1;
      this.menuCamera.position.y = 2.25 + Math.sin(t * 0.34) * 0.12;
      this.menuCamera.position.z = 6.0 + Math.sin(t * 0.22) * 0.4;
      this.menuCamera.lookAt(0, 1.12, -0.5);
      for (const mf of this.menuFighters) {
        mf.rig.update(dt);
        mf.rig.group.position.y = Math.sin(t * 1.2 + mf.phase) * 0.02;
        mf.rig.group.rotation.y = (mf.baseX < 0 ? 0.5 : -0.5) + Math.sin(t * 0.6 + mf.phase) * 0.06;
      }
      if (this.menuDust) this.menuDust.rotation.y += dt * 0.02;
      this.renderer.render(this.menuScene, this.menuCamera);
      if (this.ui.screen === 'select') this.ui.renderPortraits(dt);
    }
    // fps
    this.frameTimes.push(dt);
    if (this.frameTimes.length > 30) this.frameTimes.shift();
    const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    if (this.options.showFps) this.fpsEl.textContent = Math.round(1 / avg) + ' FPS';
    else this.fpsEl.textContent = '';
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.__app = new App();
});
// module scripts may run after DOMContentLoaded
if (document.readyState !== 'loading' && !window.__app) {
  window.__app = new App();
}
