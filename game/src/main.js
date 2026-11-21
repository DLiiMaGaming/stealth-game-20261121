// Main: wires the world, the renderer, the input and the screens together.
// Screens: title -> intro -> play <-> paused; the world itself reports
// caught / floor clear / victory. A ?shot=cover|gallery|alarm|vault query
// stages a screenshot scene instead of starting the title screen.
import { VIEW_W, VIEW_H, PLAY_X, PLAY_Y, PLAY_W, PLAY_H } from './config.js';
import { World, WORLD_PLAYING, WORLD_CAUGHT, WORLD_FLOOR_DONE, WORLD_VICTORY } from './world.js';
import { Renderer } from './render.js';
import { SoundEngine } from './audio.js';
import { stageShot } from './shots.js';

const STEP = 1 / 60;
const BEST_KEY = 'gilded-shadow-best';

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.sound = new SoundEngine();
    this.world = new World(this.sound);
    this.renderer = new Renderer();
    this.screen = 'title';
    this.time = 0;
    this.introTimer = 0;
    this.muted = false;
    this.best = 0;
    try {
      this.best = Number(window.localStorage.getItem(BEST_KEY) || 0) || 0;
    } catch {
      this.best = 0;
    }
    this.keys = { up: false, down: false, left: false, right: false, sneak: false };
    this.mouse = { x: 0, y: 0, inside: false, clicked: false };
    this.frozen = false;
    this.last = 0;
    this.acc = 0;
    this.shotName = new URLSearchParams(window.location.search).get('shot');
  }

  saveBest() {
    if (this.world.score > this.best) {
      this.best = this.world.score;
      try {
        window.localStorage.setItem(BEST_KEY, String(this.best));
      } catch {
        // Storage unavailable (private mode, file://) — best score is a bonus.
      }
    }
  }

  startRun() {
    this.world.score = 0;
    this.world.totalTime = 0;
    this.world.totalDetections = 0;
    this.world.attempts = 1;
    this.world.loadFloor(0);
    this.screen = 'intro';
    this.introTimer = 0;
  }

  beginFloor() {
    this.screen = 'play';
  }

  togglePause() {
    if (this.screen === 'play') this.screen = 'paused';
    else if (this.screen === 'paused') this.screen = 'play';
  }

  attach() {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.sound.ensure();
      const k = e.key.toLowerCase();
      if (k === 'arrowup' || k === 'w') this.keys.up = true;
      if (k === 'arrowdown' || k === 's') this.keys.down = true;
      if (k === 'arrowleft' || k === 'a') this.keys.left = true;
      if (k === 'arrowright' || k === 'd') this.keys.right = true;
      if (k === 'shift') this.keys.sneak = true;
      if (k === 'm') {
        this.muted = !this.muted;
        this.sound.setMuted(this.muted);
      }
      if (k === 'p' || k === 'escape') {
        if (this.screen === 'play' || this.screen === 'paused') this.togglePause();
      }
      if (k === 'r') {
        if (this.world.state === WORLD_CAUGHT || this.screen === 'paused' || this.screen === 'play') {
          this.sound.alarmStop();
          this.world.retryFloor();
          this.screen = 'intro';
          this.introTimer = 0;
        }
      }
      if (k === 'enter' || k === ' ') {
        e.preventDefault();
        this.advance();
      }
    });
    window.addEventListener('keyup', (e) => {
      const k = e.key.toLowerCase();
      if (k === 'arrowup' || k === 'w') this.keys.up = false;
      if (k === 'arrowdown' || k === 's') this.keys.down = false;
      if (k === 'arrowleft' || k === 'a') this.keys.left = false;
      if (k === 'arrowright' || k === 'd') this.keys.right = false;
      if (k === 'shift') this.keys.sneak = false;
    });
    this.canvas.addEventListener('mousemove', (e) => {
      const r = this.canvas.getBoundingClientRect();
      this.mouse.x = ((e.clientX - r.left) / r.width) * VIEW_W;
      this.mouse.y = ((e.clientY - r.top) / r.height) * VIEW_H;
      this.mouse.inside = true;
    });
    this.canvas.addEventListener('mouseleave', () => {
      this.mouse.inside = false;
    });
    this.canvas.addEventListener('mousedown', (e) => {
      this.sound.ensure();
      const r = this.canvas.getBoundingClientRect();
      this.mouse.x = ((e.clientX - r.left) / r.width) * VIEW_W;
      this.mouse.y = ((e.clientY - r.top) / r.height) * VIEW_H;
      this.mouse.inside = true;
      if (this.screen === 'play' && this.world.state === WORLD_PLAYING) {
        // Inside the play field: throw a coin. Anywhere else: no-op.
        if (this.mouse.x > PLAY_X && this.mouse.x < PLAY_X + PLAY_W && this.mouse.y > PLAY_Y && this.mouse.y < PLAY_Y + PLAY_H) {
          this.mouse.clicked = true;
        }
      } else {
        this.advance();
      }
    });
    window.addEventListener('blur', () => {
      this.keys.up = this.keys.down = this.keys.left = this.keys.right = this.keys.sneak = false;
    });
  }

  /** Enter / click: move one screen forward. */
  advance() {
    if (this.screen === 'title') {
      this.startRun();
    } else if (this.screen === 'intro') {
      this.beginFloor();
    } else if (this.screen === 'paused') {
      this.screen = 'play';
    } else if (this.world.state === WORLD_FLOOR_DONE) {
      this.sound.alarmStop();
      this.world.nextFloor();
      this.screen = 'intro';
      this.introTimer = 0;
    } else if (this.world.state === WORLD_VICTORY) {
      this.saveBest();
      this.startRun();
    } else if (this.world.state === WORLD_CAUGHT) {
      this.sound.alarmStop();
      this.world.retryFloor();
      this.screen = 'intro';
      this.introTimer = 0;
    }
  }

  frame(now) {
    const dt = Math.min(0.1, (now - this.last) / 1000 || 0);
    this.last = now;
    this.time += dt;
    if (!this.frozen) {
      if (this.screen === 'intro') {
        this.introTimer += dt;
        if (this.introTimer > 4) this.beginFloor();
      }
      if (this.screen === 'play') {
        this.acc += dt;
        let n = 0;
        while (this.acc >= STEP && n < 5) {
          this.world.step(STEP, this.keys, this.mouse);
          this.acc -= STEP;
          n += 1;
        }
        if (this.world.state === WORLD_VICTORY) this.saveBest();
      }
    }
    this.renderer.draw(this.ctx, this);
    window.requestAnimationFrame((t) => this.frame(t));
  }

  start() {
    this.canvas.width = VIEW_W;
    this.canvas.height = VIEW_H;
    this.attach();
    if (this.shotName) {
      stageShot(this.shotName, this.world);
      this.screen = 'play';
      this.frozen = true;
    } else {
      this.world.loadFloor(0);
    }
    window.requestAnimationFrame((t) => {
      this.last = t;
      this.frame(t);
    });
  }
}

const canvas = document.getElementById('game');
const game = new Game(canvas);
game.start();
