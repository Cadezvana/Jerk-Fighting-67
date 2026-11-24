# JERK FIGHTING 67 — World Warrior Circuit

A complete 3D fighting game in the browser (Three.js + Vite), inspired by Street Fighter 6.

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build
npm run preview
```

## Modes

| Mode | Description |
| --- | --- |
| **Arcade** | Fight the 12-fighter circuit with per-opponent stages |
| **Versus** | 1P vs CPU, four difficulty tiers |
| **Local** | Two players, one keyboard (P1 WASD/UIOJKL, P2 arrows + numpad) |
| **Training** | Unlimited-health dummy, frame data, input history, recording/playback |
| **Survival** | Endless gauntlet with escalating CPU difficulty |

Plus **Options** (rounds, timer, CPU level, audio, hit FX, screen shake, full control rebinding)
and a **Move List** browsable per character.

## Roster

12 original fighters — rivet, ember, kaze, grizz, vesper, rook, sable, titan, nova, bruiser,
oracle, butcher — each with its own stats, six normals, four specials (incl. EX), three Super
Arts and two throws.

## Combat systems

- Six-button layout (LP/MP/HP/LK/MK/HK), walk, dash (double-tap), jump, crouch, block
- Frame-based simulation at 60 Hz with real startup/active/recovery, hitboxes and hurtboxes
- Motion inputs: QCF, QCB, DP, HCF, HCB (single and double), parsed relative to facing
- Throws (LP+LK), command grabs, high/low/overhead blocking rules
- Combo system: hitstun, blockstun, cancels, chain normals, juggles, combo scaling
- Punish counters, counter hits, knockdowns and wake-up
- **Drive system**: Drive Gauge, Drive Impact, Drive Rush, Drive Parry (with perfect parry),
  Drive Reversal, burnout
- **Super Arts**: three levels per character with cinematic supers
- Cinematic camera work, dynamic zoom, screen shake, hit sparks, KO slow-motion

## Controls (defaults, fully rebindable)

| Action | P1 | P2 |
| --- | --- | --- |
| Move | `W A S D` | Arrow keys |
| LP / MP / HP | `U` / `I` / `O` | `Numpad 4` / `5` / `6` |
| LK / MK / HK | `J` / `K` / `L` | `Numpad 1` / `2` / `3` |
| Pause | `Esc` | — |

`LP+LK` throw · `HP+HK` Drive Impact · `MP+MK` Drive Parry · `MP+MK` during blockstun = Drive Reversal.

Gamepads are supported and rebindable from Options → Configure.

## Testing

```bash
node test/sim.cjs    # 20 deterministic combat tests driven straight through Game.simulate()
node test/e2e.cjs    # 30 end-to-end UI tests (menus, every mode, real keyboard combat)
./test/run-sim.sh    # sim suite with a one-line verdict
```

`test/sim.cjs` covers normals, blocking, low/high rules, all 12 characters' specials, combo
scaling, Drive Impact / Parry / burnout, throws, supers, KO → next round, the timer, training
tools, CPU behaviour, knockback-damage, projectiles and per-character damage.

`test/e2e.cjs` drives the real DOM: title → mode → character select → match, HUD, pause/resume,
training hotkeys, options, move list and results — and fires genuine keyboard input
(movement, normals, a QCF special and a Super Art).

Both suites need a Chromium binary; see the launch recipe in `test/*.cjs`.
