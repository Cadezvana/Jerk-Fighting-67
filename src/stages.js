// Arena stages: full 3D environments with dynamic lighting.
import * as THREE from 'three';
import { rand } from './utils.js';

export const STAGE_DEFS = [
  {
    id: 'neon-docks', name: 'NEON DOCKS', sub: '03:41 AM · PIER 67',
    sky: [0x0a1024, 0x2a1040], fog: 0x110a22, fogNear: 12, fogFar: 44,
    hemi: [0x7a8ccc, 0x2a2038, 0.95], sun: { color: 0xff7a9e, intensity: 1.9, pos: [-4, 9, -6] },
    fill: { color: 0x5588ff, intensity: 1.25, pos: [5, 4, 6] },
    rim: { color: 0xffa07a, intensity: 1.5 },
    floor: 0x1a1a28, accent: 0xff2d6e, accent2: 0x35d1ff,
    type: 'docks',
  },
  {
    id: 'temple', name: 'SUNKEN TEMPLE', sub: 'NOON · THE GALE SHRINE',
    sky: [0x8ac4e8, 0xdfe9d8], fog: 0xc8dcc8, fogNear: 18, fogFar: 62,
    hemi: [0xdff0ff, 0x6a6048, 0.78], sun: { color: 0xfff0d0, intensity: 2.1, pos: [6, 14, 5] },
    fill: { color: 0x88ccff, intensity: 0.5, pos: [-6, 5, 4] },
    rim: { color: 0xffd8a0, intensity: 0.6 },
    floor: 0xb8a888, accent: 0x3ab08a, accent2: 0xffd166,
    type: 'temple',
  },
  {
    id: 'foundry', name: 'IRON FOUNDRY', sub: 'SHIFT CHANGE · FURNACE B',
    sky: [0x1a0e0a, 0x3a1408], fog: 0x2a1208, fogNear: 10, fogFar: 40,
    hemi: [0xff6a3a, 0x201008, 0.42], sun: { color: 0xffaa55, intensity: 1.4, pos: [2, 10, -4] },
    fill: { color: 0xff3300, intensity: 0.9, pos: [-5, 3, 5] },
    rim: { color: 0xffcc66, intensity: 1.1 },
    floor: 0x2f2a26, accent: 0xff7a1a, accent2: 0xffcc33,
    type: 'foundry',
  },
  {
    id: 'skydeck', name: 'ORBITAL SKYDECK', sub: 'LOW ORBIT · STATION 67',
    sky: [0x05060f, 0x0a1830], fog: 0x081020, fogNear: 22, fogFar: 80,
    hemi: [0x8aa8ff, 0x101828, 0.55], sun: { color: 0xdff0ff, intensity: 1.7, pos: [-6, 12, 6] },
    fill: { color: 0x35a0ff, intensity: 0.7, pos: [6, 4, -4] },
    rim: { color: 0x66ffe0, intensity: 1.0 },
    floor: 0x1c2230, accent: 0x35e0ff, accent2: 0x9f6bff,
    type: 'skydeck',
  },
  {
    id: 'market', name: 'NIGHT MARKET', sub: 'FESTIVAL EVE · LANTERN ROW',
    sky: [0x2a0f2a, 0x4a1830], fog: 0x2a1020, fogNear: 14, fogFar: 52,
    hemi: [0xff9a6a, 0x1a0a18, 0.6], sun: { color: 0xffbb88, intensity: 1.2, pos: [4, 9, 5] },
    fill: { color: 0xff4488, intensity: 0.6, pos: [-5, 4, 3] },
    rim: { color: 0xffd166, intensity: 0.9 },
    floor: 0x3a2a24, accent: 0xff3a6a, accent2: 0xffd166,
    type: 'market',
  },
  {
    id: 'dojo', name: 'STORM DOJO', sub: 'DAWN · MOUNTAIN RETREAT',
    sky: [0x2a2a44, 0x8898b8], fog: 0x445066, fogNear: 16, fogFar: 58,
    hemi: [0xaabbdd, 0x303040, 0.66], sun: { color: 0xffd8b0, intensity: 1.6, pos: [-5, 11, 6] },
    fill: { color: 0x5588cc, intensity: 0.45, pos: [5, 4, 4] },
    rim: { color: 0xffaaaa, intensity: 0.7 },
    floor: 0x6a5a48, accent: 0xb03a3a, accent2: 0xddc090,
    type: 'dojo',
  },
];

function addBox(parent, w, h, d, x, y, z, mat, rotY = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.rotation.y = rotY;
  m.castShadow = true; m.receiveShadow = true;
  parent.add(m);
  return m;
}
function addCyl(parent, rt, rb, h, x, y, z, mat, seg = 16) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  parent.add(m);
  return m;
}

export class Stage {
  constructor(scene, def, renderer) {
    this.scene = scene;
    this.def = def;
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.lights = [];
    this.animated = [];
    this.build();
  }

  build() {
    const d = this.def;
    const s = this.scene;
    const g = this.group;

    // lighting
    const hemi = new THREE.HemisphereLight(d.hemi[0], d.hemi[1], d.hemi[2]);
    s.add(hemi); this.lights.push(hemi);
    const sun = new THREE.DirectionalLight(d.sun.color, d.sun.intensity);
    sun.position.set(...d.sun.pos);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -13; sun.shadow.camera.right = 13;
    sun.shadow.camera.top = 13; sun.shadow.camera.bottom = -13;
    sun.shadow.camera.near = 0.5; sun.shadow.camera.far = 60;
    sun.shadow.bias = -0.0008;
    sun.shadow.normalBias = 0.02;
    s.add(sun); s.add(sun.target); this.lights.push(sun);
    this.sun = sun;
    const fill = new THREE.PointLight(d.fill.color, d.fill.intensity * 18, 32, 2);
    fill.position.set(...d.fill.pos);
    s.add(fill); this.lights.push(fill);
    const rim = new THREE.DirectionalLight(d.rim.color, d.rim.intensity);
    rim.position.set(-2, 6, -9);
    s.add(rim); this.lights.push(rim);

    s.fog = new THREE.Fog(d.fog, d.fogNear, d.fogFar);
    s.background = new THREE.Color(d.sky[1]);

    // sky dome
    const skyGeo = new THREE.SphereGeometry(90, 24, 16);
    const skyMat = new THREE.ShaderMaterial({
      uniforms: { c1: { value: new THREE.Color(d.sky[0]) }, c2: { value: new THREE.Color(d.sky[1]) } },
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 c1; uniform vec3 c2; varying vec3 vP; void main(){ float h = normalize(vP).y*0.5+0.5; gl_FragColor = vec4(mix(c1,c2,pow(h,0.9)),1.0); }',
      side: THREE.BackSide, depthWrite: false,
    });
    g.add(new THREE.Mesh(skyGeo, skyMat));

    // main floor
    const floorMat = new THREE.MeshStandardMaterial({ color: d.floor, roughness: 0.78, metalness: 0.14 });
    const floor = new THREE.Mesh(new THREE.CylinderGeometry(9.4, 9.6, 0.24, 56), floorMat);
    floor.position.y = -0.12;
    floor.receiveShadow = true;
    g.add(floor);

    const ringMat = new THREE.MeshStandardMaterial({ color: 0x111216, roughness: 0.55, metalness: 0.35 });
    const ringB = new THREE.Mesh(new THREE.CylinderGeometry(9.0, 9.0, 0.06, 56), ringMat);
    ringB.position.y = 0.005; ringB.receiveShadow = true; g.add(ringB);

    // accent floor inlay
    const inlayMat = new THREE.MeshStandardMaterial({ color: d.accent, emissive: d.accent, emissiveIntensity: 0.5, roughness: 0.4, transparent: true, opacity: 0.6 });
    for (let i = 0; i < 2; i++) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(2.8 + i * 0.24, 2.9 + i * 0.24, 48), inlayMat);
      ring.rotation.x = -Math.PI / 2; ring.position.y = 0.035; g.add(ring);
      this.animated.push({ mesh: ring, type: 'pulse', phase: i });
    }
    const outerRing = new THREE.Mesh(new THREE.RingGeometry(8.4, 8.55, 64), inlayMat.clone());
    outerRing.rotation.x = -Math.PI / 2; outerRing.position.y = 0.04; g.add(outerRing);

    // center emblem
    const emblemMat = new THREE.MeshStandardMaterial({ color: d.accent2, emissive: d.accent2, emissiveIntensity: 0.35, roughness: 0.4, metalness: 0.5 });
    const emblem = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.02, 6), emblemMat);
    emblem.position.y = 0.04; g.add(emblem);

    this._buildEnvironment(d, g);

    // barrier posts around arena
    const postMat = new THREE.MeshStandardMaterial({ color: 0x2a2e3a, roughness: 0.5, metalness: 0.6 });
    const glowMat = new THREE.MeshBasicMaterial({ color: d.accent });
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      if (Math.abs(Math.sin(a)) < 0.2) continue;
      const px = Math.sin(a) * 9.7, pz = Math.cos(a) * 9.7;
      addCyl(g, 0.07, 0.09, 1.0, px, 0.5, pz, postMat, 8);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), glowMat);
      tip.position.set(px, 1.02, pz); g.add(tip);
    }
  }

  _buildEnvironment(d, g) {
    const accentMat = new THREE.MeshStandardMaterial({ color: d.accent, emissive: d.accent, emissiveIntensity: 1.2, roughness: 0.3 });
    const accent2Mat = new THREE.MeshStandardMaterial({ color: d.accent2, emissive: d.accent2, emissiveIntensity: 0.9, roughness: 0.4 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x15181f, roughness: 0.7, metalness: 0.3 });
    const midMat = new THREE.MeshStandardMaterial({ color: 0x2a2e3a, roughness: 0.65, metalness: 0.35 });

    if (d.type === 'docks') {
      // water plane
      const water = new THREE.Mesh(new THREE.PlaneGeometry(120, 120, 1, 1),
        new THREE.MeshStandardMaterial({ color: 0x0a1a2e, roughness: 0.15, metalness: 0.85 }));
      water.rotation.x = -Math.PI / 2; water.position.y = -1.1; g.add(water);
      // containers
      const cols = [0x2a4a6a, 0x6a2a3a, 0x3a5a3a, 0x4a3a2a];
      for (let i = 0; i < 16; i++) {
        const a = rand(0, Math.PI * 2), r = rand(11, 24);
        const w = rand(2.4, 4.2), h = rand(2.4, 3.0), dd = rand(2.4, 3.4);
        const m = new THREE.MeshStandardMaterial({ color: cols[i % 4], roughness: 0.8, metalness: 0.2 });
        const box = addBox(g, w, h, dd, Math.sin(a) * r, h / 2 - 0.2, Math.cos(a) * r, m, rand(0, 1.5));
        if (i % 3 === 0) box.position.y += rand(1.5, 3.2);
      }
      // cranes
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2 + 0.4, r = 26;
        const cx = Math.sin(a) * r, cz = Math.cos(a) * r;
        addCyl(g, 0.3, 0.5, 22, cx, 10, cz, darkMat, 8);
        const arm = addBox(g, 0.4, 0.4, 14, cx, 20, cz, darkMat, a);
        arm.rotation.x = 0.06;
        const light = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), accentMat);
        light.position.set(cx, 21, cz); g.add(light);
      }
      // neon signs
      for (let i = 0; i < 9; i++) {
        const a = rand(-1.4, 1.4) + (i < 5 ? 0 : Math.PI), r = rand(15, 30);
        const sign = addBox(g, rand(3, 6), rand(0.6, 2.4), 0.16, Math.sin(a) * r, rand(3, 12), Math.cos(a) * r, i % 2 ? accentMat : accent2Mat, a + Math.PI);
        sign.castShadow = false;
        this.animated.push({ mesh: sign, type: 'flicker', phase: rand(0, 6), base: 1.2 });
      }
      // volumetric light pillars
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + 0.5, r = 12;
        const beamMat = new THREE.MeshBasicMaterial({ color: d.accent, transparent: true, opacity: 0.09, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
        const beam = new THREE.Mesh(new THREE.ConeGeometry(1.6, 14, 12, 1, true), beamMat);
        beam.position.set(Math.sin(a) * r, 7, Math.cos(a) * r);
        beam.rotation.z = 0.12; beam.rotation.x = 0.08;
        g.add(beam);
        this.animated.push({ mesh: beam, type: 'sway', phase: i });
      }
    } else if (d.type === 'temple') {
      // stone columns
      const stoneMat = new THREE.MeshStandardMaterial({ color: 0xc8b898, roughness: 0.9, metalness: 0.05 });
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        const r = rand(13, 16);
        const h = rand(7, 11);
        addCyl(g, 0.7, 0.85, h, Math.sin(a) * r, h / 2 - 0.3, Math.cos(a) * r, stoneMat, 10);
      }
      // mountains
      for (let i = 0; i < 9; i++) {
        const a = rand(0, Math.PI * 2), r = rand(34, 62);
        const m = new THREE.Mesh(new THREE.ConeGeometry(rand(10, 20), rand(14, 30), 5), new THREE.MeshStandardMaterial({ color: 0x7a8a7a, roughness: 1 }));
        m.position.set(Math.sin(a) * r, rand(2, 8), Math.cos(a) * r); g.add(m);
      }
      // torii gate
      const gate = new THREE.Group();
      gate.position.set(0, 0, -13);
      const redMat = new THREE.MeshStandardMaterial({ color: 0xb03a3a, roughness: 0.7 });
      addCyl(gate, 0.4, 0.45, 8, -3, 4, 0, redMat, 10);
      addCyl(gate, 0.4, 0.45, 8, 3, 4, 0, redMat, 10);
      addBox(gate, 9, 0.5, 0.6, 0, 8.2, 0, redMat);
      addBox(gate, 7.6, 0.35, 0.5, 0, 7.3, 0, redMat);
      g.add(gate);
      // lanterns
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + 0.3, r = 11.5;
        const lan = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), new THREE.MeshStandardMaterial({ color: 0xffd8a0, emissive: 0xffbb66, emissiveIntensity: 1.6 }));
        lan.position.set(Math.sin(a) * r, rand(2.2, 3.4), Math.cos(a) * r);
        g.add(lan);
        this.animated.push({ mesh: lan, type: 'bob', phase: i, baseY: lan.position.y });
      }
      // petals
      this._petalSystem(g, 0xffb0c0);
    } else if (d.type === 'foundry') {
      // machinery
      for (let i = 0; i < 12; i++) {
        const a = rand(0, Math.PI * 2), r = rand(13, 30);
        const h = rand(3, 12);
        addBox(g, rand(2, 5), h, rand(2, 5), Math.sin(a) * r, h / 2, Math.cos(a) * r, darkMat, rand(0, 1.5));
      }
      // pipes
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const pipe = addCyl(g, 0.4, 0.4, 18, Math.sin(a) * 14, 6, Math.cos(a) * 14, midMat, 8);
        pipe.rotation.z = Math.PI / 2; pipe.rotation.y = a;
      }
      // furnace glow
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + 0.6, r = 12.5;
        const pitMat = new THREE.MeshBasicMaterial({ color: 0xff6a1a, transparent: true, opacity: 0.85 });
        const pit = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.5, 0.2, 12), pitMat);
        pit.position.set(Math.sin(a) * r, 0.05, Math.cos(a) * r); g.add(pit);
        const glow = new THREE.PointLight(0xff6a1a, 12, 14, 2);
        glow.position.set(Math.sin(a) * r, 1.2, Math.cos(a) * r); g.add(glow);
        this.animated.push({ mesh: pit, type: 'flicker', phase: rand(0, 6), base: 1 });
        this.emitters = this.emitters || [];
        this.emitters.push({ type: 'ember', x: Math.sin(a) * r, z: Math.cos(a) * r, t: rand(0, 1) });
      }
      this._emberSystem(g);
    } else if (d.type === 'skydeck') {
      // stars
      const starGeo = new THREE.BufferGeometry();
      const pos = new Float32Array(1600 * 3);
      for (let i = 0; i < 1600; i++) {
        const a = rand(0, Math.PI * 2), p = rand(0.05, Math.PI * 0.48), r = rand(60, 84);
        pos[i * 3] = Math.sin(a) * Math.cos(p) * r;
        pos[i * 3 + 1] = Math.sin(p) * r + 6;
        pos[i * 3 + 2] = Math.cos(a) * Math.cos(p) * r;
      }
      starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.28, sizeAttenuation: true, transparent: true, opacity: 0.85 }));
      g.add(stars);
      // planet
      const planet = new THREE.Mesh(new THREE.SphereGeometry(11, 24, 18), new THREE.MeshStandardMaterial({ color: 0x3a6a9a, emissive: 0x14304a, emissiveIntensity: 0.6, roughness: 0.9 }));
      planet.position.set(-30, 22, -46); g.add(planet);
      const ringP = new THREE.Mesh(new THREE.RingGeometry(14, 20, 40), new THREE.MeshBasicMaterial({ color: 0x88aadd, transparent: true, opacity: 0.3, side: THREE.DoubleSide }));
      ringP.position.copy(planet.position); ringP.rotation.set(1.2, 0.4, 0.2); g.add(ringP);
      // platform edges / railings
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2;
        const px = Math.sin(a) * 9.8, pz = Math.cos(a) * 9.8;
        addBox(g, 0.12, 0.9, 0.12, px, 0.45, pz, midMat);
        if (i % 2 === 0) {
          const light = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), accent2Mat);
          light.position.set(px, 0.95, pz); g.add(light);
        }
      }
      // distant station modules
      for (let i = 0; i < 6; i++) {
        const a = rand(0, Math.PI * 2), r = rand(20, 34);
        addBox(g, rand(3, 7), rand(1.5, 3.4), rand(3, 7), Math.sin(a) * r, rand(2, 10), Math.cos(a) * r, darkMat, rand(0, 3));
      }
    } else if (d.type === 'market') {
      // hanging lanterns
      for (let i = 0; i < 26; i++) {
        const a = rand(0, Math.PI * 2), r = rand(10.5, 22);
        const y = rand(2.4, 6.5);
        const col = [0xff3a5a, 0xffb03a, 0xff7a1a, 0xff5ab0][i % 4];
        const lan = new THREE.Mesh(new THREE.SphereGeometry(rand(0.16, 0.3), 10, 8),
          new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 2.0, roughness: 0.5 }));
        lan.position.set(Math.sin(a) * r, y, Math.cos(a) * r);
        g.add(lan);
        this.animated.push({ mesh: lan, type: 'bob', phase: rand(0, 6), baseY: y, amp: rand(0.06, 0.18) });
        const pt = new THREE.PointLight(col, 3.2, 6, 2);
        pt.position.copy(lan.position); g.add(pt);
      }
      // stalls
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 + 0.2, r = 12.5;
        const stall = new THREE.Group();
        stall.position.set(Math.sin(a) * r, 0, Math.cos(a) * r);
        stall.rotation.y = a + Math.PI;
        g.add(stall);
        addBox(stall, 2.2, 0.9, 1.0, 0, 0.45, 0, midMat);
        addBox(stall, 2.6, 0.12, 1.3, 0, 1.1, 0, new THREE.MeshStandardMaterial({ color: [0xb03a3a, 0x3a6ab0, 0xb08a3a][i % 3], roughness: 0.8 }));
        addBox(stall, 2.4, 0.1, 1.1, 0, 2.0, 0, new THREE.MeshStandardMaterial({ color: 0x8a2020, roughness: 0.9 }));
      }
      // banners
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + 0.5;
        const banner = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 4.2), new THREE.MeshStandardMaterial({ color: 0xb02a3a, side: THREE.DoubleSide, roughness: 0.9 }));
        banner.position.set(Math.sin(a) * 14, 4, Math.cos(a) * 14);
        banner.rotation.y = -a;
        g.add(banner);
        this.animated.push({ mesh: banner, type: 'wave', phase: i });
      }
    } else if (d.type === 'dojo') {
      // wooden dojo walls
      const woodMat = new THREE.MeshStandardMaterial({ color: 0x5a4030, roughness: 0.85 });
      const wallMat = new THREE.MeshStandardMaterial({ color: 0xd8ccb0, roughness: 0.95 });
      const dojo = new THREE.Group(); dojo.position.z = -14; g.add(dojo);
      addBox(dojo, 22, 6, 6, 0, 3, 0, wallMat);
      addBox(dojo, 23, 0.6, 7.4, 0, 6.4, 0, woodMat);
      for (let i = 0; i < 7; i++) addCyl(dojo, 0.24, 0.24, 6, -9 + i * 3, 3, 3.4, woodMat, 8);
      // torii
      const gate = new THREE.Group(); gate.position.set(0, 0, -10.6); g.add(gate);
      const redMat = new THREE.MeshStandardMaterial({ color: 0xa8322a, roughness: 0.7 });
      addCyl(gate, 0.32, 0.36, 7.4, -3.2, 3.7, 0, redMat, 10);
      addCyl(gate, 0.32, 0.36, 7.4, 3.2, 3.7, 0, redMat, 10);
      addBox(gate, 9.2, 0.44, 0.5, 0, 7.5, 0, redMat);
      // bamboo
      for (let i = 0; i < 16; i++) {
        const a = rand(-1.9, 1.9), r = rand(12, 19);
        const h = rand(5, 9);
        addCyl(g, 0.1, 0.12, h, Math.sin(a) * r, h / 2, Math.cos(a) * r - 2, new THREE.MeshStandardMaterial({ color: 0x4a7a3a, roughness: 0.8 }), 6);
      }
      this._petalSystem(g, 0xffe0a0);
    }
  }

  _petalSystem(g, color) {
    const geo = new THREE.BufferGeometry();
    const N = 140;
    const pos = new Float32Array(N * 3);
    const vel = [];
    for (let i = 0; i < N; i++) {
      pos[i * 3] = rand(-14, 14); pos[i * 3 + 1] = rand(0.5, 12); pos[i * 3 + 2] = rand(-14, 14);
      vel.push({ x: rand(-0.4, 0.4), y: rand(-0.7, -0.25), z: rand(-0.3, 0.3), ph: rand(0, 6) });
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color, size: 0.16, transparent: true, opacity: 0.8, depthWrite: false });
    const pts = new THREE.Points(geo, mat);
    g.add(pts);
    this.petals = { pts, vel, N };
  }

  _emberSystem(g) {
    const geo = new THREE.BufferGeometry();
    const N = 120;
    const pos = new Float32Array(N * 3);
    const vel = [];
    for (let i = 0; i < N; i++) {
      pos[i * 3] = rand(-14, 14); pos[i * 3 + 1] = rand(0, 8); pos[i * 3 + 2] = rand(-14, 14);
      vel.push({ y: rand(0.5, 2.2), ph: rand(0, 6) });
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color: 0xff8a3a, size: 0.13, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending });
    const pts = new THREE.Points(geo, mat);
    g.add(pts);
    this.embers = { pts, vel, N };
  }

  update(dt, t) {
    for (const a of this.animated) {
      if (a.type === 'flicker') {
        a.mesh.material.emissiveIntensity = a.base * (0.65 + Math.sin(t * 9 + a.phase) * 0.2 + Math.sin(t * 23 + a.phase * 3) * 0.15);
      } else if (a.type === 'pulse') {
        a.mesh.material.opacity = 0.4 + Math.sin(t * 2 + a.phase) * 0.2;
      } else if (a.type === 'bob') {
        a.mesh.position.y = a.baseY + Math.sin(t * 1.4 + a.phase) * (a.amp || 0.12);
      } else if (a.type === 'sway') {
        a.mesh.rotation.z = Math.sin(t * 0.8 + a.phase) * 0.05;
      } else if (a.type === 'wave') {
        a.mesh.rotation.z = Math.sin(t * 1.6 + a.phase) * 0.06;
        a.mesh.rotation.x = Math.sin(t * 1.1 + a.phase) * 0.03;
      }
    }
    if (this.petals) {
      const p = this.petals;
      const arr = p.pts.geometry.attributes.position.array;
      for (let i = 0; i < p.N; i++) {
        const v = p.vel[i];
        arr[i * 3] += (v.x + Math.sin(t * 0.8 + v.ph) * 0.35) * dt;
        arr[i * 3 + 1] += v.y * dt;
        arr[i * 3 + 2] += v.z * dt;
        if (arr[i * 3 + 1] < 0.1) { arr[i * 3 + 1] = 12; arr[i * 3] = rand(-14, 14); arr[i * 3 + 2] = rand(-14, 14); }
      }
      p.pts.geometry.attributes.position.needsUpdate = true;
    }
    if (this.embers) {
      const e = this.embers;
      const arr = e.pts.geometry.attributes.position.array;
      for (let i = 0; i < e.N; i++) {
        const v = e.vel[i];
        arr[i * 3] += Math.sin(t * 1.6 + v.ph) * 0.5 * dt;
        arr[i * 3 + 1] += v.y * dt;
        if (arr[i * 3 + 1] > 9) { arr[i * 3 + 1] = 0; arr[i * 3] = rand(-14, 14); arr[i * 3 + 2] = rand(-14, 14); }
      }
      e.pts.geometry.attributes.position.needsUpdate = true;
    }
  }

  dispose() {
    for (const l of this.lights) this.scene.remove(l);
    this.scene.traverse((o) => {
      if (o.geometry && !o.userData.keep) o.geometry.dispose();
      if (o.material && !Array.isArray(o.material) && !o.userData.keep) o.material.dispose?.();
    });
    this.scene.remove(this.group);
    this.scene.fog = null;
  }
}
