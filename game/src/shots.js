// Screenshot scenes: each one plays the real rules forward from a fresh floor
// for a fixed number of steps, steered by a small autopilot, so the frame is
// what a real game looks like — never a posed mock-up. Deterministic per
// scene: fixed timestep, fixed guard scan phases, no random steering.
import { TILE, PLAY_X, PLAY_Y } from './config.js';
import { WORLD_PLAYING } from './world.js';

const STEP = 1 / 60;
const DIRS = [
  [0, -1], [1, -1], [1, 0], [1, 1],
  [0, 1], [-1, 1], [-1, 0], [-1, -1],
];

/** Danger of standing at (x, y): 1 when any live cone can see the spot. */
function dangerAt(world, x, y) {
  for (const g of world.guards) {
    if (g.canSee(world.level, x, y)) return 1;
  }
  for (const c of world.cameras) {
    if (c.canSee(world.level, x, y)) return 1;
  }
  return 0;
}

/** Distance to the nearest unclaimed objective (loot, then keycard). */
function targetDistance(world, x, y, target) {
  if (target) return Math.hypot(target[0] - x, target[1] - y);
  let best = Infinity;
  for (const l of world.loot) {
    if (l.taken) continue;
    best = Math.min(best, Math.hypot(l.x - x, l.y - y));
  }
  if (best === Infinity && !world.keycard.taken) {
    best = Math.hypot(world.keycard.x - x, world.keycard.y - y);
  }
  if (best === Infinity) {
    best = Math.hypot(world.exit.x - x, world.exit.y - y);
  }
  return best;
}

/**
 * One autopilot step. Modes:
 * - cautious: steer toward the nearest loot/keycard while staying out of
 *   cones; when every way is watched, hold still in the dark and wait.
 * - bold: walk to the nearest guard's next waypoint and wait there, so the
 *   guard walks straight into the player head-on and raises the alarm.
 * - flee: run away from the nearest guard (used once the alarm is up).
 */
function autopilotKeys(world, mode, spot) {
  const p = world.player;
  let target = null;
  let fleeFrom = null;
  if (mode === 'bold') {
    if (spot) {
      target = spot;
    } else {
      let nearest = null;
      let best = Infinity;
      for (const g of world.guards) {
        const d = Math.hypot(g.x - p.x, g.y - p.y);
        if (d < best) {
          best = d;
          nearest = g;
        }
      }
      if (nearest) {
        const wp = nearest.waypoints[nearest.waypointIndex];
        target = [wp[0] + 0.5, wp[1] + 0.5];
      }
    }
  }
  if (mode === 'flee') {
    let nearest = null;
    let best = Infinity;
    for (const g of world.guards) {
      const d = Math.hypot(g.x - p.x, g.y - p.y);
      if (d < best) {
        best = d;
        nearest = g;
      }
    }
    if (nearest) fleeFrom = [nearest.x, nearest.y];
  }
  const keys = { up: false, down: false, left: false, right: false, sneak: mode === 'cautious', clicked: false };
  // Bold mode with no fixed spot: wait 2.5 tiles short of the waypoint —
  // close enough to be seen head-on, far enough to outrun the guard once
  // the alarm goes up. A fixed spot is chosen safe already: walk onto it.
  if (mode === 'bold' && !spot && target && Math.hypot(target[0] - p.x, target[1] - p.y) < 2.5) {
    return keys;
  }
  let bestScore = Infinity;
  let bestDir = null;
  for (const [dx, dy] of DIRS) {
    const nx = p.x + dx * 0.7;
    const ny = p.y + dy * 0.7;
    if (!world.level.circleFits(nx, ny, 0.32)) continue;
    let score;
    if (mode === 'flee' && fleeFrom) {
      score = -Math.hypot(fleeFrom[0] - nx, fleeFrom[1] - ny);
    } else {
      const danger = mode === 'bold' ? 0 : dangerAt(world, nx, ny) * 100;
      score = targetDistance(world, nx, ny, target) + danger;
    }
    if (score < bestScore) {
      bestScore = score;
      bestDir = [dx, dy];
    }
  }
  const stayScore = mode === 'flee' && fleeFrom
    ? -Math.hypot(fleeFrom[0] - p.x, fleeFrom[1] - p.y)
    : targetDistance(world, p.x, p.y, target) + (mode === 'bold' ? 0 : dangerAt(world, p.x, p.y) * 100);
  if (bestDir && bestScore < stayScore - 0.05) {
    const [dx, dy] = bestDir;
    if (dy < 0) keys.up = true;
    if (dy > 0) keys.down = true;
    if (dx < 0) keys.left = true;
    if (dx > 0) keys.right = true;
  }
  return keys;
}

function settleGuards(world) {
  world.guards.forEach((g, i) => {
    g.scanPhase = i * 1.7;
  });
}

function runSteps(world, seconds, mode, stopWhen, spot) {
  const mouse = { clicked: false, x: 0, y: 0 };
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    if (world.state !== WORLD_PLAYING) break;
    if (stopWhen && stopWhen(world)) break;
    world.step(STEP, autopilotKeys(world, mode, spot), mouse);
  }
}

/**
 * Stage a named scene on a fresh world and return the screen to draw.
 * cover: floor 1, sneaking past Mara's patrol with loot in hand.
 * gallery: floor 2, mid-aisle with a camera sweeping overhead.
 * alarm: floor 1, walked straight into a cone — guards converging, red cones.
 * vault: floor 3, inside the ring with the vault door ahead.
 */
export function stageShot(name, world) {
  if (name === 'gallery') {
    world.loadFloor(1);
    settleGuards(world);
    runSteps(world, 20, 'cautious');
    return { screen: 'play' };
  }
  if (name === 'alarm') {
    world.loadFloor(0);
    settleGuards(world);
    // Creep close, then wait two tiles south of Mara's patrol lane, in her
    // cone but off her walking line. The instant a guard's suspicion passes
    // halfway, sprint away — the alarm fires while the player is already
    // running, so the frame shows the chase, not the capture.
    runSteps(world, 6, 'cautious');
    runSteps(world, 14, 'bold', (w) => w.alarm || w.guards.some((g) => g.suspicion >= 55), [14.5, 10.5]);
    runSteps(world, 3, 'flee');
    return { screen: 'play' };
  }
  if (name === 'vault') {
    world.loadFloor(2);
    settleGuards(world);
    runSteps(world, 26, 'cautious');
    return { screen: 'play' };
  }
  // cover (and anything unknown): floor 1, careful sneak toward the loot.
  world.loadFloor(0);
  settleGuards(world);
  runSteps(world, 14, 'cautious');
  return { screen: 'play' };
}

/** Canvas pixel position of a tile centre (for debugging shots). */
export function tileToPx(tx, ty) {
  return [PLAY_X + (tx + 0.5) * TILE, PLAY_Y + (ty + 0.5) * TILE];
}
