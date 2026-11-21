// SoundEngine: every sound is synthesized with WebAudio — no audio files.
// Footsteps (yours and the guards') tell you where people are; the alert
// sting, the alarm siren and the pickup chimes mark what just happened.
export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.alarmNodes = null;
    this.master = null;
  }

  /** Call from a user gesture; browsers block audio before one. */
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
    } catch {
      this.ctx = null;
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.5;
  }

  tone(freq, dur, type, vol, when = 0, slideTo = null) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(vol, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  /** A soft thump: `pan` -1..1, `vol` 0..1. */
  step(pan, vol, low) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const panner = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(low ? 70 : 95, t0);
    osc.frequency.exponentialRampToValueAtTime(45, t0 + 0.07);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.08);
    osc.connect(gain);
    if (panner) {
      panner.pan.value = Math.max(-1, Math.min(1, pan));
      gain.connect(panner);
      panner.connect(this.master);
    } else {
      gain.connect(this.master);
    }
    osc.start(t0);
    osc.stop(t0 + 0.1);
  }

  pickup() {
    this.tone(880, 0.09, 'sine', 0.25);
    this.tone(1318, 0.14, 'sine', 0.22, 0.07);
  }

  keycard() {
    this.tone(659, 0.1, 'triangle', 0.25);
    this.tone(988, 0.1, 'triangle', 0.25, 0.09);
    this.tone(1318, 0.18, 'triangle', 0.25, 0.18);
  }

  coin() {
    this.tone(2400, 0.05, 'square', 0.08);
    this.tone(1800, 0.12, 'sine', 0.15, 0.02);
  }

  coinLand() {
    this.tone(1200, 0.06, 'sine', 0.2);
    this.tone(900, 0.1, 'sine', 0.15, 0.05);
  }

  alertSting() {
    this.tone(220, 0.35, 'sawtooth', 0.16, 0, 440);
    this.tone(233, 0.35, 'sawtooth', 0.12, 0, 466);
  }

  caught() {
    this.tone(160, 0.5, 'sawtooth', 0.25, 0, 55);
    this.tone(110, 0.6, 'square', 0.12, 0.05, 40);
  }

  door() {
    this.tone(180, 0.4, 'sine', 0.2, 0, 720);
  }

  floorClear() {
    [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.16, 'triangle', 0.22, i * 0.09));
  }

  victory() {
    [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.2, 'triangle', 0.22, i * 0.11));
  }

  alarmStart() {
    if (!this.ctx || this.muted || this.alarmNodes) return;
    const osc = this.ctx.createOscillator();
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = 620;
    lfo.type = 'sine';
    lfo.frequency.value = 2.2;
    lfoGain.gain.value = 180;
    gain.gain.value = 0.045;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start();
    lfo.start();
    this.alarmNodes = { osc, lfo, gain };
  }

  alarmStop() {
    if (!this.alarmNodes) return;
    try {
      this.alarmNodes.osc.stop();
      this.alarmNodes.lfo.stop();
    } catch {
      // Already stopped.
    }
    this.alarmNodes = null;
  }
}
