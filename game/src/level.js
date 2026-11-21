// Level: the tile grid of one floor, with movement collision and line of sight.
// Tiles are addressed in tile units; one tile is TILE pixels (see config.js).
import { COLS, ROWS, TILE } from './config.js';

/** Tiles that stop the player and the guards. */
export const BLOCK_MOVE = new Set(['#', 'C', 'D']);
/** Tiles that stop a vision cone (walls and tall cover). */
export const BLOCK_SIGHT = new Set(['#', 'C', 'D']);

export class Level {
  constructor(mapRows) {
    this.rows = mapRows.map((row) => row.split(''));
    this.width = COLS;
    this.height = ROWS;
  }

  tileAt(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return '#';
    return this.rows[ty][tx];
  }

  setTile(tx, ty, ch) {
    if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return;
    this.rows[ty][tx] = ch;
  }

  isWalkable(tx, ty) {
    return !BLOCK_MOVE.has(this.tileAt(tx, ty));
  }

  blocksSight(tx, ty) {
    return BLOCK_SIGHT.has(this.tileAt(tx, ty));
  }

  isShadow(tx, ty) {
    return this.tileAt(tx, ty) === ',';
  }

  /** All tiles holding `ch`, as [x, y] pairs in reading order. */
  findAll(ch) {
    const out = [];
    for (let y = 0; y < ROWS; y += 1) {
      for (let x = 0; x < COLS; x += 1) {
        if (this.rows[y][x] === ch) out.push([x, y]);
      }
    }
    return out;
  }

  findFirst(ch) {
    const found = this.findAll(ch);
    return found.length ? found[0] : null;
  }

  /**
   * True when the segment from (x0, y0) to (x1, y1), in tile units, crosses
   * no sight-blocking tile. Samples along the segment; the endpoints' own
   * tiles never block (a guard sees out of its tile, the player out of his).
   */
  hasLineOfSight(x0, y0, x1, y1) {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const dist = Math.hypot(dx, dy);
    const steps = Math.max(1, Math.ceil(dist * 4));
    for (let i = 1; i < steps; i += 1) {
      const t = i / steps;
      const tx = Math.floor(x0 + dx * t);
      const ty = Math.floor(y0 + dy * t);
      if (this.blocksSight(tx, ty)) return false;
    }
    return true;
  }

  /**
   * Circle-vs-grid collision: try to move a circle of `radius` tiles from
   * (x, y) by (dx, dy); slide along each axis separately so the mover can
   * hug walls. Returns the new [x, y].
   */
  moveCircle(x, y, dx, dy, radius) {
    const nx = this.circleFits(x + dx, y, radius) ? x + dx : x;
    const ny = this.circleFits(nx, y + dy, radius) ? y + dy : y;
    return [nx, ny];
  }

  circleFits(x, y, radius) {
    const x0 = Math.floor(x - radius);
    const x1 = Math.floor(x + radius);
    const y0 = Math.floor(y - radius);
    const y1 = Math.floor(y + radius);
    for (let ty = y0; ty <= y1; ty += 1) {
      for (let tx = x0; tx <= x1; tx += 1) {
        if (!this.isWalkable(tx, ty)) {
          // Circle-vs-tile AABB test on the tile's square.
          const cx = Math.max(tx, Math.min(x, tx + 1));
          const cy = Math.max(ty, Math.min(y, ty + 1));
          if ((x - cx) * (x - cx) + (y - cy) * (y - cy) < radius * radius) return false;
        }
      }
    }
    return true;
  }

  /** Centre of a tile in pixels, for rendering. */
  tileCentrePx(tx, ty) {
    return [(tx + 0.5) * TILE, (ty + 0.5) * TILE];
  }
}
