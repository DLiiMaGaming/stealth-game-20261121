// GILDED SHADOW — configuration: tuning constants and the three hand-built floors.
// Tile legend (30 columns x 20 rows each):
//   '#' wall (blocks movement and sight)   '.' lit floor
//   ',' shadow floor (dark: detection half rate, guards see poorly)
//   'C' crate / 'D' display case (cover: blocks movement and sight)
//   'L' loot cache   'K' keycard (opens the exit)   'E' exit door
//   'P' player start   'X' camera control panel   'M' security camera
export const TILE = 32;
export const COLS = 30;
export const ROWS = 20;
export const VIEW_W = 1280;
export const VIEW_H = 800;
export const PLAY_X = 8;
export const PLAY_Y = 72;
export const PLAY_W = COLS * TILE;
export const PLAY_H = ROWS * TILE;

export const PLAYER_WALK_SPEED = 3.4; // tiles per second
export const PLAYER_SNEAK_SPEED = 1.8;
export const PLAYER_RADIUS = 0.32; // tiles
export const GUARD_PATROL_SPEED = 1.6;
export const GUARD_CHASE_SPEED = 2.7;
export const GUARD_SEARCH_SPEED = 1.9;
export const GUARD_VISION_RANGE = 6.5; // tiles
export const GUARD_VISION_HALF_ANGLE = 0.61; // radians (~35 deg)
export const CAMERA_RANGE = 7.0;
export const CAMERA_HALF_ANGLE = 0.55;
export const COINS_PER_FLOOR = 5;
export const COIN_THROW_RANGE = 6.0;
export const NOISE_RUN_RADIUS = 2.6;
export const NOISE_SNEAK_RADIUS = 0.9;

// Suspicion 0..100 points. Fills while a guard or camera sees the player,
// drains when unseen. 100 = ALARM: every guard converges on the player.
export const SUSPICION_FILL_BASE = 38; // points per second at point-blank range
export const SUSPICION_FILL_CAMERA = 55;
export const SUSPICION_DECAY = 14; // points per second while unseen
export const SNEAK_FILL_FACTOR = 0.55;
export const SHADOW_FILL_FACTOR = 0.5;
export const CATCH_DISTANCE = 0.62; // tiles

export const SCORE_LOOT = 100;
export const SCORE_KEYCARD = 250;
export const SCORE_FLOOR = 500;
export const SCORE_GHOST = 500;

export const FLOORS = [
  {
    name: 'FLOOR 1 — THE LOBBY',
    subtitle: 'The Gilded Museum after closing.',
    parSeconds: 150,
    map: [
      '##############################',
      '#E,,,,#........M......#,,,,,,#',
      '#,,,,,#.......L.......#,,,K,,#',
      '#,,,,,.................,,,,,,#',
      '#,,,,,#...............#,,,,,,#',
      '###.###...............###.####',
      '#,,.....C...######...C.....,,#',
      '#,,........................,,#',
      '#,,.......................L,,#',
      '#,,...........DD...........,,#',
      '#,,..L.....................,M#',
      '#,,........................,,#',
      '#,,........................,,#',
      '#,,.....C............C.....,,#',
      '#,,........................,,#',
      '#,,........................L,#',
      '#,,.......L........L.......,,#',
      '#,P,,,,,,,,,,,,,,,,,,,,,,,,,X#',
      '#,,,,,,,,,,,,,,,,,,,,,,,,,,,,#',
      '##############################',
    ],
    guards: [
      { name: 'Mara', spawn: [10, 8], waypoints: [[10, 8], [19, 8], [19, 12], [10, 12]], pause: 1.6 },
      { name: 'Doss', spawn: [4, 8], waypoints: [[4, 8], [4, 15], [8, 15], [8, 8]], pause: 2.2 },
      { name: 'Kip', spawn: [24, 6], waypoints: [[24, 6], [24, 14], [27, 14], [27, 6]], pause: 1.2 },
    ],
    cameras: [
      { x: 15, y: 1, baseAngle: Math.PI / 2, sweep: 0.9, speed: 0.45 },
      { x: 28, y: 10, baseAngle: Math.PI, sweep: 0.8, speed: 0.55 },
    ],
  },
  {
    name: 'FLOOR 2 — THE GALLERY',
    subtitle: 'Glass cases. Every footstep echoes.',
    parSeconds: 170,
    map: [
      '##############################',
      '#,,.........#,,,,#.........,,#',
      '#,,.........#,K,,#.........,X#',
      '#,,...L.....##.###.........,,#',
      '#,,.......DDDD..DDDD....L..,,#',
      '#,,........................,,#',
      '#,,........................,,#',
      '#,,........................,,#',
      '#,,..DDDD..DDDD..DDDD..DDDD,,#',
      '#,,........................,,#',
      '#M,.....L.............L....,M#',
      '#,,........................,,#',
      '#,,.......DDDD..DDDD.......,,#',
      '#,,........................,,#',
      '#,,...L....................,,#',
      '###.###....................,,#',
      '#,,,,,#..................L.,,#',
      '#,E,,,.....................P,#',
      '#,,,,,#....................,,#',
      '##############################',
    ],
    guards: [
      { name: 'Vera', spawn: [10, 6], waypoints: [[10, 6], [19, 6], [19, 11], [10, 11]], pause: 1.4 },
      { name: 'Hale', spawn: [6, 9], waypoints: [[6, 9], [6, 13], [13, 13], [13, 9]], pause: 2.0 },
      { name: 'Juno', spawn: [23, 7], waypoints: [[23, 7], [23, 13], [27, 13], [27, 7]], pause: 1.0 },
    ],
    cameras: [
      { x: 1, y: 10, baseAngle: 0, sweep: 0.9, speed: 0.5 },
      { x: 28, y: 10, baseAngle: Math.PI, sweep: 0.8, speed: 0.6 },
    ],
  },
  {
    name: 'FLOOR 3 — THE VAULT',
    subtitle: 'Concentric rings of steel.',
    parSeconds: 190,
    map: [
      '##############################',
      '#,,............M...........,,#',
      '#,,.........L.....L........,,#',
      '#,,...K....................,,#',
      '#,,........................,,#',
      '#,,L......................L,,#',
      '#,,.......##.####.##.......,,#',
      '#,,.......#........#.......,,#',
      '#,,.......#..#.##..#.......,,#',
      '#,,.......#..#..#..........,,#',
      '#M,..........#.E#..#.......,,#',
      '#,,.......#..##.#..#.......,,#',
      '#,,.......#........#.......,,#',
      '#,,.......##.####.##.......,,#',
      '#,,........................,,#',
      '#,,.......L........L.......,,#',
      '#,,........................,,#',
      '#,,............P............X#',
      '#,,,,,,,,,,,,,,,,,,,,,,,,,,,,#',
      '##############################',
    ],
    guards: [
      { name: 'Sable', spawn: [5, 8], waypoints: [[5, 8], [5, 12], [9, 12], [9, 8]], pause: 1.8 },
      { name: 'Rook', spawn: [24, 8], waypoints: [[24, 8], [24, 12], [20, 12], [20, 8]], pause: 1.5 },
      { name: 'Fenn', spawn: [12, 15], waypoints: [[12, 15], [17, 15], [17, 14], [12, 14]], pause: 1.1 },
    ],
    cameras: [
      { x: 15, y: 1, baseAngle: Math.PI / 2, sweep: 1.0, speed: 0.5 },
      { x: 1, y: 10, baseAngle: 0, sweep: 0.9, speed: 0.55 },
    ],
  },
];

/** Colours for the night-museum palette. */
export const PALETTE = {
  floorLit: '#2b3350',
  floorLitAlt: '#272e48',
  floorShadow: '#171d33',
  floorShadowAlt: '#141a2e',
  wall: '#4a5470',
  wallTop: '#6b7699',
  crate: '#7a5a34',
  crateTop: '#9c7748',
  caseGlass: '#7fd4d9',
  caseFrame: '#3d4a6b',
  loot: '#ffd34d',
  keycard: '#5ad1ff',
  exit: '#58e08a',
  exitLocked: '#e05a5a',
  player: '#f2e6c9',
  playerCloak: '#2f6f5e',
  guardPatrol: '#8fa8ff',
  guardSuspicious: '#ffd34d',
  guardAlarm: '#ff5a5a',
  conePatrol: 'rgba(143,168,255,0.20)',
  coneSuspicious: 'rgba(255,211,77,0.28)',
  coneAlarm: 'rgba(255,90,90,0.30)',
  coneCamera: 'rgba(255,120,90,0.22)',
  hudPanel: '#10142a',
  hudBorder: '#39415f',
  hudText: '#e8e4d8',
  hudMuted: '#9aa3c0',
  gold: '#ffd34d',
};
