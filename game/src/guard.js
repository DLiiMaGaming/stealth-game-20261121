// Guard: a patrolling night guard with a vision cone, a suspicion meter and
// four states — PATROL, SUSPICIOUS, ALARM and SEARCH. A guard that reaches
// full suspicion raises the alarm and chases the player; losing sight makes
// suspicion drain and the guard search, then return to patrol.
import {
  GUARD_PATROL_SPEED,
  GUARD_CHASE_SPEED,
  GUARD_SEARCH_SPEED,
  GUARD_VISION_RANGE,
  GUARD_VISION_HALF_ANGLE,
  SUSPICION_FILL_BASE,
  SUSPICION_DECAY,
  SNEAK_FILL_FACTOR,
  SHADOW_FILL_FACTOR,
  CATCH_DISTANCE,
} from './config.js';

export const GUARD_PATROL = 'PATROL';
export const GUARD_SUSPICIOUS = 'SUSPICIOUS';
export const GUARD_ALARM = 'ALARM';
export const GUARD_SEARCH = 'SEARCH';

function angleTo(x0, y0, x1, y1) {
  return Math.atan2(y1 - y0, x1 - x0);
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

export class Guard {
  constructor(def) {
    this.name = def.name;
    this.spawn = def.spawn;
    this.waypoints = def.waypoints;
    this.pause = def.pause || 1.5;
    this.x = def.spawn[0] + 0.5;
    this.y = def.spawn[1] + 0.5;
    this.facing = 0;
    this.waypointIndex = 1 % this.waypoints.length;
    this.pauseTimer = 0;
    this.state = GUARD_PATROL;
    this.suspicion = 0;
    this.lastSeen = null; // [x, y] of the player, when last seen
    this.searchTimer = 0;
    this.scanPhase = Math.random() * Math.PI * 2;
    this.stepPhase = 0;
    this.moved = 0;
  }

  reset() {
    this.x = this.spawn[0] + 0.5;
    this.y = this.spawn[1] + 0.5;
    this.facing = 0;
    this.waypointIndex = 1 % this.waypoints.length;
    this.pauseTimer = 0;
    this.state = GUARD_PATROL;
    this.suspicion = 0;
    this.lastSeen = null;
    this.searchTimer = 0;
  }

  /** True when the player stands inside this guard's vision cone with a clear line of sight. */
  canSee(level, px, py) {
    const dx = px - this.x;
    const dy = py - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist > GUARD_VISION_RANGE) return false;
    if (dist > 0.01) {
      const toPlayer = Math.atan2(dy, dx);
      if (Math.abs(angleDiff(toPlayer, this.facing)) > GUARD_VISION_HALF_ANGLE) return false;
    }
    return level.hasLineOfSight(this.x, this.y, px, py);
  }

  /** How fast suspicion fills right now (per second), before state rules. */
  suspicionRate(level, player) {
    const dist = Math.hypot(player.x - this.x, player.y - this.y);
    const closeness = 1.15 - dist / GUARD_VISION_RANGE;
    let rate = SUSPICION_FILL_BASE * Math.max(0.25, closeness);
    if (player.sneaking) rate *= SNEAK_FILL_FACTOR;
    if (level.isShadow(Math.floor(player.x), Math.floor(player.y))) rate *= SHADOW_FILL_FACTOR;
    return rate;
  }

  raiseAlarm(world) {
    if (this.state !== GUARD_ALARM) {
      this.state = GUARD_ALARM;
      this.suspicion = 100;
      world.onAlarm(this);
    }
  }

  update(dt, world) {
    const { level, player } = world;
    const sees = this.canSee(level, player.x, player.y);
    if (sees) {
      this.lastSeen = [player.x, player.y];
      // suspicionRate returns points per second on the 0..100 meter.
      this.suspicion = clamp(this.suspicion + this.suspicionRate(level, player) * dt, 0, 100);
    } else {
      this.suspicion = clamp(this.suspicion - SUSPICION_DECAY * dt, 0, 100);
    }

    if (this.state === GUARD_ALARM) {
      this.chase(dt, world);
      if (!sees && this.suspicion <= 0) {
        this.state = GUARD_SEARCH;
        this.searchTimer = 6;
      }
      return;
    }
    if (this.suspicion >= 100) {
      this.raiseAlarm(world);
      return;
    }
    if (this.suspicion >= 30) {
      if (this.state !== GUARD_SUSPICIOUS) this.state = GUARD_SUSPICIOUS;
      this.investigate(dt, world);
      return;
    }
    if (this.state === GUARD_SEARCH) {
      this.search(dt, world);
      return;
    }
    this.state = GUARD_PATROL;
    this.patrol(dt, world);
  }

  /** Walk toward (tx, ty); returns true when arrived. */
  stepToward(dt, level, tx, ty, speed) {
    const dx = tx - this.x;
    const dy = ty - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.05) return true;
    const step = Math.min(dist, speed * dt);
    const nx = this.x + (dx / dist) * step;
    const ny = this.y + (dy / dist) * step;
    const [mx, my] = level.moveCircle(this.x, this.y, nx - this.x, ny - this.y, 0.32);
    const travelled = Math.hypot(mx - this.x, my - this.y);
    this.moved += travelled;
    this.stepPhase += travelled;
    this.x = mx;
    this.y = my;
    this.facing = angleTo(this.x, this.y, tx, ty);
    return dist - step < 0.05;
  }

  patrol(dt, world) {
    const { level } = world;
    if (this.pauseTimer > 0) {
      this.pauseTimer -= dt;
      // Look around while paused at a waypoint: slow scan sweep.
      this.scanPhase += dt * 1.1;
      this.facing = this.facing + Math.sin(this.scanPhase) * dt * 0.9;
      return;
    }
    const wp = this.waypoints[this.waypointIndex];
    const arrived = this.stepToward(dt, level, wp[0] + 0.5, wp[1] + 0.5, GUARD_PATROL_SPEED);
    if (arrived) {
      this.waypointIndex = (this.waypointIndex + 1) % this.waypoints.length;
      this.pauseTimer = this.pause;
    }
  }

  investigate(dt, world) {
    const { level } = world;
    if (!this.lastSeen) {
      this.patrol(dt, world);
      return;
    }
    const arrived = this.stepToward(dt, level, this.lastSeen[0], this.lastSeen[1], GUARD_SEARCH_SPEED);
    if (arrived) {
      // Look around the spot where the player was last seen.
      this.scanPhase += dt * 2.2;
      this.facing += Math.sin(this.scanPhase) * dt * 1.4;
      if (this.suspicion < 30) {
        this.state = GUARD_PATROL;
        this.lastSeen = null;
      }
    }
  }

  chase(dt, world) {
    const { level, player } = world;
    const target = this.lastSeen || [player.x, player.y];
    this.stepToward(dt, level, target[0], target[1], GUARD_CHASE_SPEED);
    const dist = Math.hypot(player.x - this.x, player.y - this.y);
    if (dist < CATCH_DISTANCE) world.onCaught(this);
  }

  search(dt, world) {
    const { level } = world;
    this.searchTimer -= dt;
    if (this.lastSeen) {
      const arrived = this.stepToward(dt, level, this.lastSeen[0], this.lastSeen[1], GUARD_SEARCH_SPEED);
      if (arrived) {
        this.scanPhase += dt * 2.0;
        this.facing += Math.sin(this.scanPhase) * dt * 1.6;
      }
    }
    if (this.searchTimer <= 0) {
      this.state = GUARD_PATROL;
      this.lastSeen = null;
      this.suspicion = 0;
    }
  }

  /** Cone corners in tile units, for rendering. */
  conePolygon() {
    const range = GUARD_VISION_RANGE;
    const a0 = this.facing - GUARD_VISION_HALF_ANGLE;
    const a1 = this.facing + GUARD_VISION_HALF_ANGLE;
    const pts = [[this.x, this.y]];
    const steps = 14;
    for (let i = 0; i <= steps; i += 1) {
      const a = a0 + ((a1 - a0) * i) / steps;
      pts.push([this.x + Math.cos(a) * range, this.y + Math.sin(a) * range]);
    }
    return pts;
  }
}
