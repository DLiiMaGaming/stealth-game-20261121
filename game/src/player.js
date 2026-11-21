// Player: the infiltrator. WASD / arrows to move, Shift to sneak (slower,
// quieter, harder to spot), mouse click to throw a coin that pings and lures
// guards to where it lands. Running is loud: guards nearby hear it.
import {
  PLAYER_WALK_SPEED,
  PLAYER_SNEAK_SPEED,
  PLAYER_RADIUS,
  COIN_THROW_RANGE,
  NOISE_RUN_RADIUS,
  NOISE_SNEAK_RADIUS,
} from './config.js';

export class Player {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.facing = -Math.PI / 2;
    this.sneaking = false;
    this.moving = false;
    this.speed = 0;
    this.stepPhase = 0;
    this.coins = 0;
    this.noiseRadius = 0;
  }

  reset(x, y, coins) {
    this.x = x + 0.5;
    this.y = y + 0.5;
    this.facing = -Math.PI / 2;
    this.sneaking = false;
    this.moving = false;
    this.speed = 0;
    this.stepPhase = 0;
    this.coins = coins;
    this.noiseRadius = 0;
  }

  /**
   * Move from the held keys. `keys` holds booleans up/down/left/right/sneak.
   * Returns the distance travelled this step (for footstep sounds).
   */
  update(dt, level, keys) {
    let mx = 0;
    let my = 0;
    if (keys.left) mx -= 1;
    if (keys.right) mx += 1;
    if (keys.up) my -= 1;
    if (keys.down) my += 1;
    this.sneaking = !!keys.sneak;
    this.moving = mx !== 0 || my !== 0;
    if (!this.moving) {
      this.speed = 0;
      this.noiseRadius = 0;
      return 0;
    }
    const len = Math.hypot(mx, my);
    mx /= len;
    my /= len;
    this.speed = this.sneaking ? PLAYER_SNEAK_SPEED : PLAYER_WALK_SPEED;
    const step = this.speed * dt;
    const [nx, ny] = level.moveCircle(this.x, this.y, mx * step, my * step, PLAYER_RADIUS);
    const travelled = Math.hypot(nx - this.x, ny - this.y);
    this.x = nx;
    this.y = ny;
    this.facing = Math.atan2(my, mx);
    this.stepPhase += travelled;
    this.noiseRadius = this.sneaking ? NOISE_SNEAK_RADIUS : NOISE_RUN_RADIUS;
    return travelled;
  }

  /** The tile the coin would land on when thrown toward (tx, ty). */
  coinLanding(tx, ty) {
    const dx = tx - this.x;
    const dy = ty - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.01) return [this.x, this.y];
    const range = Math.min(dist, COIN_THROW_RANGE);
    return [this.x + (dx / dist) * range, this.y + (dy / dist) * range];
  }
}
