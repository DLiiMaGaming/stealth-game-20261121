// Render: everything the player sees — the night museum, the vision cones
// (clipped by walls, so a cone stops at a corner like a real line of sight),
// the lighting, the dense HUD, the minimap and every screen.
import {
  TILE,
  COLS,
  ROWS,
  VIEW_W,
  VIEW_H,
  PLAY_X,
  PLAY_Y,
  PLAY_W,
  PLAY_H,
  PALETTE,
  SCORE_FLOOR,
  GUARD_VISION_RANGE,
  GUARD_VISION_HALF_ANGLE,
  CAMERA_RANGE,
  CAMERA_HALF_ANGLE,
  FLOORS,
} from './config.js';
import { GUARD_PATROL, GUARD_SUSPICIOUS, GUARD_ALARM, GUARD_SEARCH } from './guard.js';
import { WORLD_CAUGHT, WORLD_FLOOR_DONE, WORLD_VICTORY } from './world.js';

const SIDEBAR_X = 976;
const SIDEBAR_W = 296;
const TOP_H = 64;
const BOTTOM_Y = 720;

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function fmtTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Vision cone clipped by walls: march each ray until a sight-blocking tile
 * and use the hit distance, so the cone hugs corners instead of bleeding
 * through them.
 */
export function clippedCone(level, x, y, facing, halfAngle, range) {
  const pts = [[x, y]];
  const steps = 18;
  for (let i = 0; i <= steps; i += 1) {
    const a = facing - halfAngle + ((halfAngle * 2 * i) / steps);
    let r = range;
    const stepLen = 0.12;
    for (let d = stepLen; d < range; d += stepLen) {
      const tx = Math.floor(x + Math.cos(a) * d);
      const ty = Math.floor(y + Math.sin(a) * d);
      if (level.blocksSight(tx, ty)) {
        r = d;
        break;
      }
    }
    pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r]);
  }
  return pts;
}

function drawCone(ctx, level, pts, fill) {
  ctx.beginPath();
  ctx.moveTo((pts[0][0]) * TILE + PLAY_X, (pts[0][1]) * TILE + PLAY_Y);
  for (let i = 1; i < pts.length; i += 1) {
    ctx.lineTo(pts[i][0] * TILE + PLAY_X, pts[i][1] * TILE + PLAY_Y);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

function guardColor(state) {
  if (state === GUARD_ALARM) return PALETTE.guardAlarm;
  if (state === GUARD_SUSPICIOUS || state === GUARD_SEARCH) return PALETTE.guardSuspicious;
  return PALETTE.guardPatrol;
}

function coneFill(state) {
  if (state === GUARD_ALARM) return PALETTE.coneAlarm;
  if (state === GUARD_SUSPICIOUS || state === GUARD_SEARCH) return PALETTE.coneSuspicious;
  return PALETTE.conePatrol;
}

export class Renderer {
  draw(ctx, game) {
    const { world } = game;
    ctx.fillStyle = '#0a0d1d';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    this.drawTopBar(ctx, game);
    this.drawPlayField(ctx, game);
    this.drawSidePanel(ctx, game);
    this.drawBottomBar(ctx, game);
    if (game.screen === 'title') this.drawTitle(ctx, game);
    else if (game.screen === 'intro') this.drawIntro(ctx, game);
    else if (game.screen === 'paused') this.drawPaused(ctx, game);
    else if (world.state === WORLD_CAUGHT) this.drawCaught(ctx, game);
    else if (world.state === WORLD_FLOOR_DONE) this.drawFloorDone(ctx, game);
    else if (world.state === WORLD_VICTORY) this.drawVictory(ctx, game);
  }

  drawTopBar(ctx, game) {
    const { world } = game;
    ctx.fillStyle = PALETTE.hudPanel;
    ctx.fillRect(0, 0, VIEW_W, TOP_H);
    ctx.fillStyle = PALETTE.hudBorder;
    ctx.fillRect(0, TOP_H - 1, VIEW_W, 1);
    ctx.fillStyle = PALETTE.gold;
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('GILDED SHADOW', 16, 22);
    ctx.fillStyle = PALETTE.hudMuted;
    ctx.font = '12px monospace';
    ctx.fillText('a night-museum stealth heist', 16, 46);
    ctx.fillStyle = PALETTE.hudText;
    ctx.font = 'bold 15px monospace';
    ctx.fillText(world.floorName, 330, 22);
    ctx.fillStyle = PALETTE.hudMuted;
    ctx.font = '12px monospace';
    ctx.fillText(world.floorDef.subtitle, 330, 46);

    // Score / loot / coins / time.
    ctx.textAlign = 'right';
    ctx.fillStyle = PALETTE.hudText;
    ctx.font = 'bold 15px monospace';
    ctx.fillText(`SCORE ${world.score}`, 1272, 18);
    ctx.font = '13px monospace';
    ctx.fillStyle = PALETTE.gold;
    ctx.fillText(`LOOT ${world.lootTaken}/${world.lootTotal}   COINS ${world.player.coins}   TIME ${fmtTime(world.time)}`, 1272, 42);

    // Alert meter.
    const ax = 700;
    const aw = 250;
    const level = world.alertLevel();
    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTE.hudMuted;
    ctx.font = '11px monospace';
    const label = world.alarm ? '!! ALARM !!' : level >= 30 ? 'SUSPICIOUS' : level > 0 ? 'WATCHED' : 'UNSEEN';
    ctx.fillText(`ALERT ${label}`, ax, 14);
    ctx.fillStyle = '#1c2340';
    rr(ctx, ax, 24, aw, 12, 6);
    ctx.fill();
    const frac = level / 100;
    ctx.fillStyle = world.alarm ? '#ff5a5a' : level >= 30 ? '#ffd34d' : '#58e08a';
    if (frac > 0) {
      rr(ctx, ax, 24, Math.max(8, aw * frac), 12, 6);
      ctx.fill();
    }
    ctx.strokeStyle = PALETTE.hudBorder;
    rr(ctx, ax, 24, aw, 12, 6);
    ctx.stroke();
    ctx.fillStyle = PALETTE.hudMuted;
    ctx.font = '11px monospace';
    ctx.fillText('break sight to cool down', ax, 52);
  }

  drawPlayField(ctx, game) {
    const { world } = game;
    const level = world.level;
    ctx.save();
    ctx.beginPath();
    ctx.rect(PLAY_X, PLAY_Y, PLAY_W, PLAY_H);
    ctx.clip();

    // Floor tiles.
    for (let y = 0; y < ROWS; y += 1) {
      for (let x = 0; x < COLS; x += 1) {
        const t = level.tileAt(x, y);
        const px = PLAY_X + x * TILE;
        const py = PLAY_Y + y * TILE;
        if (t === '#') {
          ctx.fillStyle = PALETTE.wall;
          ctx.fillRect(px, py, TILE, TILE);
          ctx.fillStyle = PALETTE.wallTop;
          ctx.fillRect(px, py, TILE, 5);
        } else if (t === ',') {
          ctx.fillStyle = (x + y) % 2 ? PALETTE.floorShadow : PALETTE.floorShadowAlt;
          ctx.fillRect(px, py, TILE, TILE);
        } else if (t === 'C') {
          ctx.fillStyle = PALETTE.crate;
          ctx.fillRect(px + 2, py + 2, TILE - 4, TILE - 4);
          ctx.fillStyle = PALETTE.crateTop;
          ctx.fillRect(px + 2, py + 2, TILE - 4, 7);
          ctx.strokeStyle = 'rgba(0,0,0,0.35)';
          ctx.strokeRect(px + 2.5, py + 2.5, TILE - 5, TILE - 5);
        } else if (t === 'D') {
          ctx.fillStyle = PALETTE.caseFrame;
          ctx.fillRect(px + 3, py + 3, TILE - 6, TILE - 6);
          ctx.fillStyle = PALETTE.caseGlass;
          ctx.globalAlpha = 0.75;
          ctx.fillRect(px + 7, py + 7, TILE - 14, TILE - 14);
          ctx.globalAlpha = 1;
          ctx.fillStyle = 'rgba(255,255,255,0.5)';
          ctx.fillRect(px + 9, py + 9, 4, TILE - 18);
        } else {
          ctx.fillStyle = (x + y) % 2 ? PALETTE.floorLit : PALETTE.floorLitAlt;
          ctx.fillRect(px, py, TILE, TILE);
        }
        // Subtle tile grid.
        ctx.strokeStyle = 'rgba(0,0,0,0.12)';
        ctx.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
      }
    }

    // Exit door, keycard, loot, panel.
    this.drawExit(ctx, world);
    this.drawKeycard(ctx, world);
    for (const l of world.loot) if (!l.taken) this.drawLoot(ctx, l, game.time);
    this.drawPanel(ctx, world);

    // Camera cones under the guards' cones.
    for (const c of world.cameras) {
      if (c.disabled) continue;
      const pts = clippedCone(level, c.x, c.y, c.angle, CAMERA_HALF_ANGLE, CAMERA_RANGE);
      drawCone(ctx, level, pts, PALETTE.coneCamera);
    }
    // Guard cones.
    for (const g of world.guards) {
      const pts = clippedCone(level, g.x, g.y, g.facing, GUARD_VISION_HALF_ANGLE, GUARD_VISION_RANGE);
      drawCone(ctx, level, pts, coneFill(g.state));
    }

    // Darkness: night falls away from the player and the lit cones.
    const ppx = PLAY_X + world.player.x * TILE;
    const ppy = PLAY_Y + world.player.y * TILE;
    const dark = ctx.createRadialGradient(ppx, ppy, 40, ppx, ppy, 340);
    dark.addColorStop(0, 'rgba(4,6,16,0)');
    dark.addColorStop(0.55, 'rgba(4,6,16,0.28)');
    dark.addColorStop(1, 'rgba(4,6,16,0.62)');
    ctx.fillStyle = dark;
    ctx.fillRect(PLAY_X, PLAY_Y, PLAY_W, PLAY_H);

    // Cameras, guards, player, coins, particles, rings.
    for (const c of world.cameras) this.drawCamera(ctx, c, game.time);
    for (const g of world.guards) this.drawGuard(ctx, g, game.time);
    for (const c of world.coinsInFlight) {
      const t = c.t;
      const cx = PLAY_X + (c.x + (c.tx - c.x) * t) * TILE;
      const cy = PLAY_Y + (c.y + (c.ty - c.y) * t) * TILE - Math.sin(t * Math.PI) * 14;
      ctx.fillStyle = PALETTE.gold;
      ctx.beginPath();
      ctx.arc(cx, cy, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    this.drawPlayer(ctx, game);
    for (const p of world.particles) {
      ctx.globalAlpha = clamp(p.life / p.maxLife, 0, 1);
      ctx.fillStyle = p.color;
      ctx.fillRect(PLAY_X + p.x * TILE - p.size / 2, PLAY_Y + p.y * TILE - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
    for (const r of world.rings) {
      ctx.globalAlpha = clamp(r.alpha, 0, 1);
      ctx.strokeStyle = '#ffd34d';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(PLAY_X + r.x * TILE, PLAY_Y + r.y * TILE, r.r * TILE, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // Alarm edge pulse.
    if (world.alarm) {
      const pulse = 0.25 + 0.15 * Math.sin(game.time * 6);
      ctx.strokeStyle = `rgba(255,90,90,${pulse})`;
      ctx.lineWidth = 4;
      ctx.strokeRect(PLAY_X + 2, PLAY_Y + 2, PLAY_W - 4, PLAY_H - 4);
    }
  }

  drawExit(ctx, world) {
    const ex = PLAY_X + world.exit.x * TILE;
    const ey = PLAY_Y + world.exit.y * TILE;
    ctx.fillStyle = world.exitOpen ? PALETTE.exit : '#3a3f55';
    rr(ctx, ex - 13, ey - 13, 26, 26, 4);
    ctx.fill();
    ctx.fillStyle = world.exitOpen ? '#0c2b16' : '#c9c2ae';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(world.exitOpen ? 'EXIT' : 'LOCK', ex, ey);
    if (world.exitOpen) {
      const pulse = 0.5 + 0.5 * Math.sin(world.time * 4 || 0);
      ctx.strokeStyle = `rgba(88,224,138,${0.4 + 0.4 * pulse})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ex, ey, 18 + 3 * pulse, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  drawKeycard(ctx, world) {
    if (world.keycard.taken) return;
    const kx = PLAY_X + world.keycard.x * TILE;
    const ky = PLAY_Y + world.keycard.y * TILE;
    const bob = Math.sin((world.time || 0) * 3) * 2;
    ctx.fillStyle = PALETTE.keycard;
    rr(ctx, kx - 8, ky - 5 + bob, 16, 10, 2);
    ctx.fill();
    ctx.fillStyle = '#0a2030';
    ctx.fillRect(kx - 4, ky - 2 + bob, 8, 2);
    ctx.fillStyle = 'rgba(90,209,255,0.35)';
    ctx.beginPath();
    ctx.arc(kx, ky + bob, 14, 0, Math.PI * 2);
    ctx.fill();
  }

  drawLoot(ctx, l, time) {
    const lx = PLAY_X + l.x * TILE;
    const ly = PLAY_Y + l.y * TILE;
    const pulse = 0.6 + 0.4 * Math.sin((time || 0) * 3 + l.x);
    ctx.save();
    ctx.translate(lx, ly);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = PALETTE.loot;
    ctx.globalAlpha = 0.65 + 0.35 * pulse;
    ctx.fillRect(-6, -6, 12, 12);
    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(255,211,77,0.25)';
    ctx.beginPath();
    ctx.arc(lx, ly, 12 + 3 * pulse, 0, Math.PI * 2);
    ctx.fill();
  }

  drawPanel(ctx, world) {
    const px = PLAY_X + world.panel.x * TILE;
    const py = PLAY_Y + world.panel.y * TILE;
    ctx.fillStyle = world.camerasDisabled ? '#2c4a3a' : '#8a6d2f';
    rr(ctx, px - 9, py - 9, 18, 18, 3);
    ctx.fill();
    ctx.fillStyle = world.camerasDisabled ? '#58e08a' : '#ffd34d';
    ctx.beginPath();
    ctx.arc(px, py, 4, 0, Math.PI * 2);
    ctx.fill();
    if (world.panelHold > 0 && !world.camerasDisabled) {
      ctx.strokeStyle = '#58e08a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(px, py, 14, -Math.PI / 2, -Math.PI / 2 + (world.panelHold / 2) * Math.PI * 2);
      ctx.stroke();
    }
  }

  drawCamera(ctx, c, time) {
    const cx = PLAY_X + c.x * TILE;
    const cy = PLAY_Y + c.y * TILE;
    ctx.fillStyle = c.disabled ? '#4a4a55' : '#c94f3d';
    ctx.beginPath();
    ctx.arc(cx, cy, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#20242f';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 7, 0, Math.PI * 2);
    ctx.stroke();
    if (!c.disabled) {
      ctx.strokeStyle = '#ffd9d0';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(c.angle) * 13, cy + Math.sin(c.angle) * 13);
      ctx.stroke();
      if (c.alert > 1) {
        ctx.fillStyle = `rgba(255,90,90,${0.5 + 0.5 * Math.sin((time || 0) * 8)})`;
        ctx.beginPath();
        ctx.arc(cx, cy - 11, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  drawGuard(ctx, g, time) {
    const gx = PLAY_X + g.x * TILE;
    const gy = PLAY_Y + g.y * TILE;
    const color = guardColor(g.state);
    // Body: a night guard in a dark uniform with a pale face.
    ctx.fillStyle = '#232a44';
    ctx.beginPath();
    ctx.arc(gx, gy, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(gx, gy, 11, 0, Math.PI * 2);
    ctx.globalAlpha = 0.25;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(gx, gy, 11, 0, Math.PI * 2);
    ctx.stroke();
    // Facing tick.
    ctx.strokeStyle = '#e8e4d8';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(gx, gy);
    ctx.lineTo(gx + Math.cos(g.facing) * 14, gy + Math.sin(g.facing) * 14);
    ctx.stroke();
    // Name + state.
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = '#dfe3f2';
    ctx.fillText(g.name.toUpperCase(), gx, gy - 15);
    // Suspicion arc over the head.
    if (g.suspicion > 1) {
      ctx.strokeStyle = g.suspicion >= 100 ? '#ff5a5a' : '#ffd34d';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(gx, gy, 15, -Math.PI / 2, -Math.PI / 2 + (g.suspicion / 100) * Math.PI * 2);
      ctx.stroke();
      if (g.suspicion >= 30 && g.suspicion < 100) {
        ctx.fillStyle = '#ffd34d';
        ctx.font = 'bold 13px monospace';
        ctx.fillText('?', gx, gy - 24);
      }
      if (g.suspicion >= 100) {
        ctx.fillStyle = '#ff5a5a';
        ctx.font = 'bold 14px monospace';
        ctx.fillText('!', gx, gy - 24);
      }
    }
  }

  drawPlayer(ctx, game) {
    const { world } = game;
    const p = world.player;
    const px = PLAY_X + p.x * TILE;
    const py = PLAY_Y + p.y * TILE;
    // Noise ring while running.
    if (p.moving && !p.sneaking) {
      ctx.strokeStyle = 'rgba(232,228,216,0.25)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(px, py, 2.6 * TILE, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Cloaked infiltrator: dark hood, pale face, gold trim.
    ctx.fillStyle = PALETTE.playerCloak;
    ctx.beginPath();
    ctx.arc(px, py, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = PALETTE.gold;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(px, py, 11, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = PALETTE.player;
    ctx.beginPath();
    ctx.arc(px + Math.cos(p.facing) * 3, py + Math.sin(p.facing) * 3, 5, 0, Math.PI * 2);
    ctx.fill();
    if (p.sneaking) {
      ctx.fillStyle = '#9aa3c0';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText('SNEAK', px, py - 14);
    }
    // Mouse aim: faint line to the coin landing spot.
    if (game.mouse && game.mouse.inside && game.screen === 'play') {
      const tx = (game.mouse.x - PLAY_X) / TILE;
      const ty = (game.mouse.y - PLAY_Y) / TILE;
      const [lx, ly] = p.coinLanding(tx, ty);
      ctx.strokeStyle = 'rgba(255,211,77,0.35)';
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(PLAY_X + lx * TILE, PLAY_Y + ly * TILE);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = 'rgba(255,211,77,0.7)';
      ctx.beginPath();
      ctx.arc(PLAY_X + lx * TILE, PLAY_Y + ly * TILE, 6, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  drawSidePanel(ctx, game) {
    const { world } = game;
    const x = SIDEBAR_X;
    const w = SIDEBAR_W;
    ctx.fillStyle = PALETTE.hudPanel;
    rr(ctx, x, PLAY_Y, w, PLAY_H, 8);
    ctx.fill();
    ctx.strokeStyle = PALETTE.hudBorder;
    rr(ctx, x, PLAY_Y, w, PLAY_H, 8);
    ctx.stroke();
    let y = PLAY_Y + 22;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    // Objectives.
    ctx.fillStyle = PALETTE.gold;
    ctx.font = 'bold 13px monospace';
    ctx.fillText('OBJECTIVES', x + 14, y);
    y += 22;
    ctx.font = '13px monospace';
    const objectives = [
      [`Find the keycard ${world.hasKeycard ? '✓' : '○'}`, world.hasKeycard],
      [`Loot the caches  ${world.lootTaken}/${world.lootTotal}`, world.lootTaken === world.lootTotal],
      [`Reach the exit ${world.exitOpen ? '(OPEN)' : '(LOCKED)'}`, world.exitOpen],
      [`Stay unseen — GHOST ${world.alarmRaised ? 'lost' : 'alive'}`, !world.alarmRaised],
    ];
    for (const [text, done] of objectives) {
      ctx.fillStyle = done ? '#58e08a' : PALETTE.hudText;
      ctx.fillText((done ? '✔ ' : '· ') + text, x + 14, y);
      y += 19;
    }
    y += 8;
    ctx.strokeStyle = PALETTE.hudBorder;
    ctx.beginPath();
    ctx.moveTo(x + 14, y);
    ctx.lineTo(x + w - 14, y);
    ctx.stroke();
    y += 20;

    // Guard roster.
    ctx.fillStyle = PALETTE.gold;
    ctx.font = 'bold 13px monospace';
    ctx.fillText('NIGHT SHIFT — GUARDS', x + 14, y);
    y += 22;
    ctx.font = '12px monospace';
    for (const g of world.guards) {
      ctx.fillStyle = guardColor(g.state);
      ctx.beginPath();
      ctx.arc(x + 20, y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.hudText;
      const stateLabel = g.state === GUARD_PATROL ? 'patrolling' : g.state === GUARD_SUSPICIOUS ? 'suspicious' : g.state === GUARD_ALARM ? 'HUNTING YOU' : 'searching';
      ctx.fillText(`${g.name} — ${stateLabel}`, x + 32, y);
      ctx.fillStyle = PALETTE.hudMuted;
      ctx.fillText(`${Math.round(g.suspicion)}%`, x + w - 40, y);
      y += 19;
    }
    y += 4;
    ctx.fillStyle = PALETTE.hudMuted;
    ctx.font = '12px monospace';
    const liveCams = world.cameras.filter((c) => !c.disabled).length;
    ctx.fillText(`Cameras: ${liveCams}/${world.cameras.length} live${world.camerasDisabled ? ' — PANEL HELD' : ''}`, x + 14, y);
    y += 18;
    ctx.fillText(`Coins: ${world.player.coins} (click to throw)`, x + 14, y);
    y += 18;
    ctx.fillText(`Attempts on this floor: ${world.attempts}`, x + 14, y);
    y += 12;
    ctx.strokeStyle = PALETTE.hudBorder;
    ctx.beginPath();
    ctx.moveTo(x + 14, y);
    ctx.lineTo(x + w - 14, y);
    ctx.stroke();
    y += 20;

    // Minimap.
    ctx.fillStyle = PALETTE.gold;
    ctx.font = 'bold 13px monospace';
    ctx.fillText('FLOOR PLAN', x + 14, y);
    y += 12;
    const mapW = w - 28;
    const mapH = Math.round((mapW * ROWS) / COLS);
    const mx = x + 14;
    const my = y;
    const sx = mapW / COLS;
    const sy = mapH / ROWS;
    ctx.fillStyle = '#0a0d1d';
    ctx.fillRect(mx, my, mapW, mapH);
    for (let ty = 0; ty < ROWS; ty += 1) {
      for (let tx = 0; tx < COLS; tx += 1) {
        const t = world.level.tileAt(tx, ty);
        if (t === '#') ctx.fillStyle = '#4a5470';
        else if (t === ',') ctx.fillStyle = '#1a2140';
        else if (t === 'C' || t === 'D') ctx.fillStyle = '#5a4a34';
        else ctx.fillStyle = '#2b3350';
        ctx.fillRect(mx + tx * sx, my + ty * sy, Math.ceil(sx), Math.ceil(sy));
      }
    }
    for (const l of world.loot) {
      if (l.taken) continue;
      ctx.fillStyle = PALETTE.loot;
      ctx.fillRect(mx + l.x * sx - 2, my + l.y * sy - 2, 4, 4);
    }
    if (!world.keycard.taken) {
      ctx.fillStyle = PALETTE.keycard;
      ctx.fillRect(mx + world.keycard.x * sx - 2, my + world.keycard.y * sy - 2, 4, 4);
    }
    ctx.fillStyle = world.exitOpen ? PALETTE.exit : PALETTE.exitLocked;
    ctx.fillRect(mx + world.exit.x * sx - 3, my + world.exit.y * sy - 3, 6, 6);
    for (const c of world.cameras) {
      ctx.fillStyle = c.disabled ? '#555' : '#ff7a5a';
      ctx.beginPath();
      ctx.arc(mx + c.x * sx, my + c.y * sy, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const g of world.guards) {
      ctx.fillStyle = guardColor(g.state);
      ctx.beginPath();
      ctx.arc(mx + g.x * sx, my + g.y * sy, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(mx + world.player.x * sx, my + world.player.y * sy, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.strokeRect(mx + 0.5, my + 0.5, mapW - 1, mapH - 1);
    y = my + mapH + 18;

    // Controls.
    ctx.fillStyle = PALETTE.gold;
    ctx.font = 'bold 13px monospace';
    ctx.fillText('CONTROLS', x + 14, y);
    y += 20;
    ctx.fillStyle = PALETTE.hudMuted;
    ctx.font = '12px monospace';
    const controls = [
      'WASD / arrows — move',
      'SHIFT — sneak (slow, quiet)',
      'CLICK — throw a coin',
      'Hold X panel — kill cameras',
      'P — pause · M — mute · R — retry',
    ];
    for (const line of controls) {
      ctx.fillText(line, x + 14, y);
      y += 17;
    }
  }

  drawBottomBar(ctx, game) {
    const { world } = game;
    ctx.fillStyle = PALETTE.hudPanel;
    ctx.fillRect(0, BOTTOM_Y, VIEW_W, VIEW_H - BOTTOM_Y);
    ctx.fillStyle = PALETTE.hudBorder;
    ctx.fillRect(0, BOTTOM_Y, VIEW_W, 1);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = '13px monospace';
    let y = BOTTOM_Y + 20;
    const fresh = world.events.filter((e) => e.t < 14);
    for (const e of fresh.slice(0, 3)) {
      ctx.fillStyle = e.color;
      ctx.fillText('› ' + e.text, 16, y);
      y += 18;
    }
    if (fresh.length === 0) {
      ctx.fillStyle = PALETTE.hudMuted;
      ctx.fillText('› Shadows halve detection. Crates and cases block sight. Coins lure guards.', 16, y);
    }
    ctx.textAlign = 'right';
    ctx.fillStyle = PALETTE.hudMuted;
    ctx.font = '12px monospace';
    ctx.fillText(`Floor ${world.floorIndex + 1} of ${FLOORS.length} · par ${fmtTime(world.floorDef.parSeconds)} · ${game.muted ? 'MUTED (M)' : 'sound on (M)'}`, 1272, BOTTOM_Y + 20);
  }

  dim(ctx, alpha) {
    ctx.fillStyle = `rgba(5,7,16,${alpha})`;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  panelBox(ctx, cx, cy, w, h) {
    ctx.fillStyle = 'rgba(10,13,29,0.94)';
    rr(ctx, cx - w / 2, cy - h / 2, w, h, 12);
    ctx.fill();
    ctx.strokeStyle = PALETTE.gold;
    ctx.lineWidth = 1.5;
    rr(ctx, cx - w / 2, cy - h / 2, w, h, 12);
    ctx.stroke();
  }

  drawTitle(ctx, game) {
    this.dim(ctx, 0.72);
    this.panelBox(ctx, 640, 400, 760, 560);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = PALETTE.gold;
    ctx.font = 'bold 52px monospace';
    ctx.fillText('GILDED SHADOW', 640, 190);
    ctx.fillStyle = PALETTE.hudText;
    ctx.font = '16px monospace';
    ctx.fillText('3 floors · 9 guards · 6 cameras · 18 loot caches · 1 vault exit', 640, 232);
    ctx.fillStyle = PALETTE.hudMuted;
    ctx.font = '14px monospace';
    ctx.fillText('The Gilded Museum, after closing. You are the shadow it never sees.', 640, 268);
    ctx.fillText('Take the keycard on every floor. Reach the exit unseen.', 640, 292);
    ctx.fillStyle = PALETTE.hudText;
    ctx.font = 'bold 14px monospace';
    ctx.fillText('HOW TO PLAY', 640, 336);
    ctx.font = '13px monospace';
    ctx.fillStyle = PALETTE.hudMuted;
    const lines = [
      'WASD / arrows — move        SHIFT — sneak (slow, quiet, half-seen)',
      'CLICK — throw a coin: the clink lures guards to the spot',
      'Vision cones fill the alert meter. Break line of sight to cool down.',
      'Shadow tiles (dark floor) halve detection. Crates & cases block sight.',
      'Running is LOUD — guards nearby will come to look.',
      'Hold the gold panel (X) for 2s to kill every camera on the floor.',
      'Caught = the floor resets. Finish all 3 floors without an alarm for GHOST.',
    ];
    lines.forEach((line, i) => ctx.fillText(line, 640, 366 + i * 22));
    ctx.fillStyle = PALETTE.exit;
    ctx.font = 'bold 18px monospace';
    const blink = 0.6 + 0.4 * Math.sin((game.time || 0) * 3);
    ctx.globalAlpha = blink;
    ctx.fillText('CLICK OR PRESS ENTER TO BEGIN THE HEIST', 640, 540);
    ctx.globalAlpha = 1;
    if (game.best > 0) {
      ctx.fillStyle = PALETTE.gold;
      ctx.font = '13px monospace';
      ctx.fillText(`Best score on this machine: ${game.best}`, 640, 578);
    }
    ctx.fillStyle = PALETTE.hudMuted;
    ctx.font = '11px monospace';
    ctx.fillText('An original game — no assets, no network, all sound synthesized live.', 640, 620);
  }

  drawIntro(ctx, game) {
    this.dim(ctx, 0.55);
    this.panelBox(ctx, 640, 400, 620, 220);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = PALETTE.gold;
    ctx.font = 'bold 30px monospace';
    ctx.fillText(game.world.floorName, 640, 350);
    ctx.fillStyle = PALETTE.hudText;
    ctx.font = '15px monospace';
    ctx.fillText(game.world.floorDef.subtitle, 640, 392);
    ctx.fillStyle = PALETTE.hudMuted;
    ctx.font = '13px monospace';
    ctx.fillText('Keycard first — then the exit. Unseen is worth 500.', 640, 428);
    ctx.fillStyle = PALETTE.exit;
    ctx.font = 'bold 14px monospace';
    ctx.fillText('PRESS ENTER OR CLICK TO START', 640, 466);
  }

  drawPaused(ctx, game) {
    this.dim(ctx, 0.6);
    this.panelBox(ctx, 640, 400, 420, 160);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = PALETTE.gold;
    ctx.font = 'bold 28px monospace';
    ctx.fillText('PAUSED', 640, 380);
    ctx.fillStyle = PALETTE.hudMuted;
    ctx.font = '14px monospace';
    ctx.fillText('P or ESC to resume · R to retry the floor', 640, 418);
  }

  drawCaught(ctx, game) {
    this.dim(ctx, 0.62);
    this.panelBox(ctx, 640, 400, 560, 240);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ff5a5a';
    ctx.font = 'bold 34px monospace';
    ctx.fillText('CAUGHT!', 640, 340);
    ctx.fillStyle = PALETTE.hudText;
    ctx.font = '15px monospace';
    ctx.fillText(`${game.world.caughtBy} grabbed you under the lights.`, 640, 384);
    ctx.fillStyle = PALETTE.hudMuted;
    ctx.font = '14px monospace';
    ctx.fillText(`Score so far: ${game.world.score} · Attempt ${game.world.attempts} on this floor`, 640, 414);
    ctx.fillStyle = PALETTE.exit;
    ctx.font = 'bold 16px monospace';
    ctx.fillText('PRESS R TO TRY THE FLOOR AGAIN', 640, 456);
  }

  drawFloorDone(ctx, game) {
    const w = game.world;
    this.dim(ctx, 0.55);
    this.panelBox(ctx, 640, 400, 600, 300);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = PALETTE.exit;
    ctx.font = 'bold 32px monospace';
    ctx.fillText('FLOOR CLEAR', 640, 300);
    ctx.fillStyle = PALETTE.hudText;
    ctx.font = '15px monospace';
    ctx.fillText(`${w.floorName} — out the door, pockets full.`, 640, 340);
    ctx.font = '14px monospace';
    ctx.fillStyle = PALETTE.hudMuted;
    const rows = [
      `Loot this floor: ${w.lootTaken}/${w.lootTotal}`,
      `Floor bonus: +${SCORE_FLOOR}   Time bonus: +${w.timeBonus}`,
      w.ghostBonus ? 'GHOST bonus: +500 — never spotted' : 'Spotted once — no GHOST bonus this floor',
      `Total score: ${w.score}`,
    ];
    rows.forEach((line, i) => ctx.fillText(line, 640, 376 + i * 24));
    ctx.fillStyle = PALETTE.exit;
    ctx.font = 'bold 16px monospace';
    ctx.fillText('PRESS ENTER FOR THE NEXT FLOOR', 640, 500);
  }

  drawVictory(ctx, game) {
    const w = game.world;
    this.dim(ctx, 0.7);
    this.panelBox(ctx, 640, 400, 680, 380);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = PALETTE.gold;
    ctx.font = 'bold 40px monospace';
    ctx.fillText('THE VAULT IS YOURS', 640, 268);
    ctx.fillStyle = PALETTE.hudText;
    ctx.font = '16px monospace';
    ctx.fillText('Three floors. Nine guards. Not a single alarm that mattered.', 640, 312);
    ctx.font = '15px monospace';
    ctx.fillStyle = PALETTE.hudMuted;
    const rows = [
      `Final score: ${w.score}`,
      `Total time: ${fmtTime(w.totalTime)}`,
      `Times spotted: ${w.totalDetections}`,
      `Best score on this machine: ${Math.max(game.best, w.score)}`,
    ];
    rows.forEach((line, i) => ctx.fillText(line, 640, 352 + i * 26));
    ctx.fillStyle = PALETTE.exit;
    ctx.font = 'bold 16px monospace';
    const blink = 0.6 + 0.4 * Math.sin((game.time || 0) * 3);
    ctx.globalAlpha = blink;
    ctx.fillText('PRESS ENTER TO RUN IT AGAIN', 640, 500);
    ctx.globalAlpha = 1;
  }
}
