// World: one floor in play — the level, the player, the guards, the cameras,
// the loot, the coins in flight and the score. Owns the rules: what fills
// suspicion, what opens the exit, what ends the floor.
import {
  TILE,
  PLAY_X,
  PLAY_Y,
  COINS_PER_FLOOR,
  SCORE_LOOT,
  SCORE_KEYCARD,
  SCORE_FLOOR,
  SCORE_GHOST,
  FLOORS,
} from './config.js';
import { Level } from './level.js';
import { Player } from './player.js';
import { Guard, GUARD_ALARM, GUARD_SUSPICIOUS } from './guard.js';
import { Camera } from './camera.js';

export const WORLD_PLAYING = 'playing';
export const WORLD_CAUGHT = 'caught';
export const WORLD_FLOOR_DONE = 'floorDone';
export const WORLD_VICTORY = 'victory';

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

export class World {
  constructor(sound) {
    this.sound = sound;
    this.floorIndex = 0;
    this.level = null;
    this.player = new Player();
    this.guards = [];
    this.cameras = [];
    this.loot = []; // {x, y, taken}
    this.keycard = null; // {x, y, taken}
    this.exit = null; // {x, y}
    this.panel = null; // {x, y}
    this.panelHold = 0; // seconds the player has stood at the panel
    this.camerasDisabled = false;
    this.coinsInFlight = []; // {x, y, tx, ty, t}
    this.rings = []; // noise rings {x, y, r, maxR, alpha}
    this.particles = []; // {x, y, vx, vy, life, color, size}
    this.events = []; // ticker lines {text, t, color}
    this.score = 0;
    this.lootTaken = 0;
    this.lootTotal = 0;
    this.hasKeycard = false;
    this.exitOpen = false;
    this.time = 0;
    this.state = WORLD_PLAYING;
    this.stateTimer = 0;
    this.alarm = false;
    this.alarmRaised = false; // any alarm at all on this floor (kills GHOST)
    this.attempts = 1;
    this.caughtBy = null;
    this.floorBonus = 0;
    this.ghostBonus = 0;
    this.timeBonus = 0;
    this.totalTime = 0;
    this.totalDetections = 0;
    this.lastPlayerStep = 0;
    this.lastGuardStep = new Map();
  }

  get floorDef() {
    return FLOORS[this.floorIndex];
  }

  get floorName() {
    return this.floorDef.name;
  }

  loadFloor(index) {
    this.floorIndex = index;
    const def = FLOORS[index];
    this.level = new Level(def.map);
    const start = this.level.findFirst('P');
    this.player.reset(start[0], start[1], COINS_PER_FLOOR);
    this.guards = def.guards.map((g) => new Guard(g));
    this.cameras = def.cameras.map((c) => new Camera(c));
    this.loot = this.level.findAll('L').map(([x, y]) => ({ x: x + 0.5, y: y + 0.5, taken: false }));
    this.lootTotal = this.loot.length;
    this.lootTaken = 0;
    const key = this.level.findFirst('K');
    this.keycard = { x: key[0] + 0.5, y: key[1] + 0.5, taken: false };
    const exit = this.level.findFirst('E');
    this.exit = { x: exit[0] + 0.5, y: exit[1] + 0.5 };
    const panel = this.level.findFirst('X');
    this.panel = { x: panel[0] + 0.5, y: panel[1] + 0.5 };
    this.panelHold = 0;
    this.camerasDisabled = false;
    this.coinsInFlight = [];
    this.rings = [];
    this.particles = [];
    this.hasKeycard = false;
    this.exitOpen = false;
    this.time = 0;
    this.state = WORLD_PLAYING;
    this.stateTimer = 0;
    this.alarm = false;
    this.alarmRaised = false;
    this.caughtBy = null;
    this.lastPlayerStep = 0;
    this.lastGuardStep = new Map();
    this.log(`${def.name} — find the keycard, then reach the exit unseen.`, '#e8e4d8');
  }

  log(text, color) {
    this.events.unshift({ text, t: 0, color: color || '#9aa3c0' });
    if (this.events.length > 4) this.events.length = 4;
  }

  /** The loudest current suspicion on the floor, 0..100. */
  alertLevel() {
    let top = 0;
    for (const g of this.guards) top = Math.max(top, g.suspicion);
    for (const c of this.cameras) top = Math.max(top, c.alert);
    return top;
  }

  onAlarm(guard) {
    if (!this.alarm) {
      this.alarm = true;
      this.alarmRaised = true;
      this.totalDetections += 1;
      this.log(`SPOTTED by ${guard.name}! Every guard is converging.`, '#ff5a5a');
      this.sound.alertSting();
      this.sound.alarmStart();
      // The other guards join the hunt at once.
      for (const g of this.guards) {
        if (g !== guard && g.state !== GUARD_ALARM) {
          g.state = GUARD_ALARM;
          g.suspicion = 100;
          g.lastSeen = [this.player.x, this.player.y];
        }
      }
    }
  }

  onCameraAlarm(camera) {
    if (!this.alarm) {
      this.alarm = true;
      this.alarmRaised = true;
      this.totalDetections += 1;
      this.log('Camera locked on! The floor is on ALARM.', '#ff5a5a');
      this.sound.alertSting();
      this.sound.alarmStart();
      for (const g of this.guards) {
        if (g.state !== GUARD_ALARM) {
          g.state = GUARD_ALARM;
          g.suspicion = 100;
          g.lastSeen = [this.player.x, this.player.y];
        }
      }
    }
  }

  onCaught(guard) {
    if (this.state !== WORLD_PLAYING) return;
    this.state = WORLD_CAUGHT;
    this.stateTimer = 0;
    this.caughtBy = guard.name;
    this.sound.alarmStop();
    this.sound.caught();
    this.log(`Caught by ${guard.name}. The floor resets.`, '#ff5a5a');
  }

  throwCoin(tx, ty) {
    if (this.state !== WORLD_PLAYING) return;
    if (this.player.coins <= 0) {
      this.log('No coins left — slip past instead.', '#ffd34d');
      return;
    }
    const [lx, ly] = this.player.coinLanding(tx, ty);
    this.player.coins -= 1;
    this.coinsInFlight.push({ x: this.player.x, y: this.player.y, tx: lx, ty: ly, t: 0 });
    this.sound.coin();
  }

  burst(x, y, color, n) {
    for (let i = 0; i < n; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const sp = 1 + Math.random() * 2.5;
      this.particles.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0.5 + Math.random() * 0.4,
        maxLife: 0.9,
        color,
        size: 2 + Math.random() * 3,
      });
    }
  }

  step(dt, keys, mouse) {
    if (this.state === WORLD_CAUGHT) {
      this.stateTimer += dt;
      return;
    }
    if (this.state === WORLD_FLOOR_DONE || this.state === WORLD_VICTORY) {
      this.stateTimer += dt;
      this.updateParticles(dt);
      return;
    }
    this.time += dt;
    this.totalTime += dt;

    // Player movement + footsteps.
    const travelled = this.player.update(dt, this.level, keys);
    if (travelled > 0.01) {
      const stride = this.player.sneaking ? 0.55 : 0.75;
      if (this.player.stepPhase - this.lastPlayerStep > stride) {
        this.lastPlayerStep = this.player.stepPhase;
        this.sound.step(0, this.player.sneaking ? 0.05 : 0.14, true);
      }
      // Running is loud: guards in earshot come to look.
      if (!this.player.sneaking) {
        for (const g of this.guards) {
          if (g.state === GUARD_ALARM) continue;
          const d = Math.hypot(g.x - this.player.x, g.y - this.player.y);
          if (d < 2.6 && g.suspicion < 45) {
            g.suspicion = Math.min(45, g.suspicion + 30 * dt);
            g.lastSeen = [this.player.x, this.player.y];
          }
        }
      }
    }

    // Coin throw (mouse click, edge-triggered by main.js through mouse.clicked).
    if (mouse && mouse.clicked) {
      const tx = (mouse.x - PLAY_X) / TILE;
      const ty = (mouse.y - PLAY_Y) / TILE;
      this.throwCoin(tx, ty);
      mouse.clicked = false;
    }

    // Coins in flight: land, ping, lure guards.
    for (let i = this.coinsInFlight.length - 1; i >= 0; i -= 1) {
      const c = this.coinsInFlight[i];
      c.t += dt * 2.2;
      if (c.t >= 1) {
        this.coinsInFlight.splice(i, 1);
        this.rings.push({ x: c.tx, y: c.ty, r: 0.2, maxR: 5, alpha: 0.9 });
        this.sound.coinLand();
        for (const g of this.guards) {
          if (g.state === GUARD_ALARM) continue;
          const d = Math.hypot(g.x - c.tx, g.y - c.ty);
          if (d < 5) {
            g.lastSeen = [c.tx, c.ty];
            g.suspicion = Math.max(g.suspicion, 45);
            g.state = GUARD_SUSPICIOUS;
          }
        }
        this.log('Coin clinks on the marble — a guard turns toward it.', '#ffd34d');
      }
    }

    // Guards and cameras.
    for (const g of this.guards) g.update(dt, this);
    for (const c of this.cameras) c.update(dt, this);

    // Guard footsteps: audible when a guard walks near the player (stereo by side).
    for (const g of this.guards) {
      const d = Math.hypot(g.x - this.player.x, g.y - this.player.y);
      if (d < 7 && g.moved > 0) {
        const last = this.lastGuardStep.get(g.name) || 0;
        if (g.stepPhase - last > 0.75) {
          this.lastGuardStep.set(g.name, g.stepPhase);
          const pan = clamp((g.x - this.player.x) / 7, -1, 1);
          const vol = clamp(0.22 * (1 - d / 7), 0.03, 0.22);
          this.sound.step(pan, vol, false);
        }
      }
    }

    // Alarm ends when every guard has calmed down.
    if (this.alarm) {
      const anyAlarmed = this.guards.some((g) => g.state === GUARD_ALARM);
      const anyHot = this.alertLevel() > 25;
      if (!anyAlarmed && !anyHot) {
        this.alarm = false;
        this.sound.alarmStop();
        this.log('The floor calms down. Stay out of the cones.', '#9aa3c0');
      }
    }

    // Camera control panel: stand next to it to kill the cameras.
    if (!this.camerasDisabled) {
      const d = Math.hypot(this.player.x - this.panel.x, this.player.y - this.panel.y);
      if (d < 1.2) {
        this.panelHold += dt;
        if (this.panelHold >= 2) {
          this.camerasDisabled = true;
          for (const c of this.cameras) c.disabled = true;
          this.sound.door();
          this.log('Panel held — every camera on this floor is dark.', '#58e08a');
          this.burst(this.panel.x, this.panel.y, '#58e08a', 14);
        }
      } else {
        this.panelHold = 0;
      }
    }

    // Loot pickup.
    for (const l of this.loot) {
      if (!l.taken && Math.hypot(this.player.x - l.x, this.player.y - l.y) < 0.7) {
        l.taken = true;
        this.lootTaken += 1;
        this.score += SCORE_LOOT;
        this.sound.pickup();
        this.burst(l.x, l.y, '#ffd34d', 12);
        this.log(`Loot secured (${this.lootTaken}/${this.lootTotal}).`, '#ffd34d');
      }
    }

    // Keycard pickup.
    if (!this.keycard.taken && Math.hypot(this.player.x - this.keycard.x, this.player.y - this.keycard.y) < 0.7) {
      this.keycard.taken = true;
      this.hasKeycard = true;
      this.exitOpen = true;
      this.score += SCORE_KEYCARD;
      this.sound.keycard();
      this.burst(this.keycard.x, this.keycard.y, '#5ad1ff', 16);
      this.log('Keycard taken — the exit is open. Get out unseen.', '#5ad1ff');
    }

    // Exit.
    if (this.exitOpen && Math.hypot(this.player.x - this.exit.x, this.player.y - this.exit.y) < 0.7) {
      this.completeFloor();
    }

    this.updateParticles(dt);
    this.updateRings(dt);
    for (const e of this.events) e.t += dt;
  }

  completeFloor() {
    const def = this.floorDef;
    this.timeBonus = Math.max(0, Math.round((def.parSeconds - this.time) * 5));
    this.ghostBonus = this.alarmRaised ? 0 : SCORE_GHOST;
    this.floorBonus = SCORE_FLOOR + this.timeBonus + this.ghostBonus;
    this.score += this.floorBonus;
    this.sound.floorClear();
    this.sound.alarmStop();
    this.burst(this.exit.x, this.exit.y, '#58e08a', 24);
    if (this.floorIndex + 1 < FLOORS.length) {
      this.state = WORLD_FLOOR_DONE;
      this.stateTimer = 0;
      this.log(`${def.name} cleared — ${this.ghostBonus ? 'GHOST bonus!' : 'spotted once.'}`, '#58e08a');
    } else {
      this.state = WORLD_VICTORY;
      this.stateTimer = 0;
      this.sound.victory();
    }
  }

  nextFloor() {
    this.loadFloor(this.floorIndex + 1);
  }

  retryFloor() {
    this.attempts += 1;
    this.loadFloor(this.floorIndex);
  }

  updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i -= 1) {
      const p = this.particles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
  }

  updateRings(dt) {
    for (let i = this.rings.length - 1; i >= 0; i -= 1) {
      const r = this.rings[i];
      r.r += dt * 6;
      r.alpha -= dt * 0.9;
      if (r.alpha <= 0 || r.r > r.maxR) this.rings.splice(i, 1);
    }
  }
}
