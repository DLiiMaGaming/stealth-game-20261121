// Camera: a wall-mounted security camera sweeping its cone back and forth.
// Being seen by a live camera fills the camera alert fast; at 100 the whole
// floor goes to ALARM. A control panel (X) disables every camera on the floor.
import {
  CAMERA_RANGE,
  CAMERA_HALF_ANGLE,
  SUSPICION_FILL_CAMERA,
  SHADOW_FILL_FACTOR,
} from './config.js';

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

export class Camera {
  constructor(def) {
    this.x = def.x + 0.5;
    this.y = def.y + 0.5;
    this.baseAngle = def.baseAngle;
    this.sweep = def.sweep; // radians either side of baseAngle
    this.speed = def.speed; // sweep radians per second
    this.phase = 0;
    this.angle = def.baseAngle;
    this.alert = 0; // 0..100, shared trigger for the floor alarm
    this.disabled = false;
  }

  reset() {
    this.phase = 0;
    this.angle = this.baseAngle;
    this.alert = 0;
    this.disabled = false;
  }

  canSee(level, px, py) {
    if (this.disabled) return false;
    const dx = px - this.x;
    const dy = py - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist > CAMERA_RANGE) return false;
    if (dist > 0.01) {
      const toPlayer = Math.atan2(dy, dx);
      if (Math.abs(angleDiff(toPlayer, this.angle)) > CAMERA_HALF_ANGLE) return false;
    }
    return level.hasLineOfSight(this.x, this.y, px, py);
  }

  update(dt, world) {
    if (this.disabled) {
      this.alert = Math.max(0, this.alert - 40 * dt);
      return;
    }
    this.phase += dt * this.speed;
    this.angle = this.baseAngle + Math.sin(this.phase) * this.sweep;
    const { level, player } = world;
    if (this.canSee(level, player.x, player.y)) {
      let rate = SUSPICION_FILL_CAMERA;
      if (level.isShadow(Math.floor(player.x), Math.floor(player.y))) rate *= SHADOW_FILL_FACTOR;
      if (player.sneaking) rate *= 0.7;
      this.alert = clamp(this.alert + rate * dt, 0, 100);
      if (this.alert >= 100) world.onCameraAlarm(this);
    } else {
      this.alert = clamp(this.alert - 20 * dt, 0, 100);
    }
  }

  /** Cone corners in tile units, for rendering. */
  conePolygon() {
    const pts = [[this.x, this.y]];
    const steps = 14;
    for (let i = 0; i <= steps; i += 1) {
      const a = this.angle - CAMERA_HALF_ANGLE + ((CAMERA_HALF_ANGLE * 2 * i) / steps);
      pts.push([this.x + Math.cos(a) * CAMERA_RANGE, this.y + Math.sin(a) * CAMERA_RANGE]);
    }
    return pts;
  }
}
