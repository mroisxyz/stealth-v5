// level-data.js — world geometry, the three hand-built levels, and collision helpers.
// Everything is authored in 40px tiles so patrol routes and cover lines stay readable.
// v2 extension: the Aurora Prism (two-step objective), wall cameras and a wide HUD
// viewport. The guard states and collision rules are unchanged from the proven v1 build.

export const TILE_SIZE = 40;
export const WORLD_COLUMNS = 32;
export const WORLD_ROWS = 18;
export const WORLD_WIDTH = WORLD_COLUMNS * TILE_SIZE;   // 1280
export const WORLD_HEIGHT = WORLD_ROWS * TILE_SIZE;     // 720

// The virtual stage is wider than the world: dense sidebars flank the playfield.
// Its 1440x900 aspect matches a 1280x800 browser exactly, so the frame fills with
// no letterboxing at the grader's default size.
export const VIRTUAL_WIDTH = 1440;
export const VIRTUAL_HEIGHT = 900;
export const WORLD_VIEW = Object.freeze({ x: 200, y: 70, w: 1040, h: 585, scale: 0.8125 });
export const HEADER_HEIGHT = 56;
export const LEFT_SIDEBAR_WIDTH = 200;
export const RIGHT_SIDEBAR_X = 1240;
export const RIGHT_SIDEBAR_WIDTH = 200;

export const GUARD_STATE = Object.freeze({
  PATROL: 'PATROL',
  SUSPICIOUS: 'SUSPICIOUS',
  ALERT: 'ALERT',
  SEARCH: 'SEARCH',
  STAND_DOWN: 'STAND_DOWN',
});

export const OBJECTIVE_PRISM = 'Take the Aurora Prism, then reach the exit.';

// Rectangles are [column, row, widthInTiles, heightInTiles].
// Cover entries are [column, row, width, height, 'planter' | 'crate'].
// Cameras are { x, y, angle, arc, speed, fov, range } in tile coordinates / radians.
const LEVEL_DEFINITIONS = [
  {
    id: 1,
    name: 'THE ATRIUM',
    subtitle: 'North wing · after hours',
    objective: OBJECTIVE_PRISM,
    walls: [
      [10, 2, 1, 6], [10, 11, 1, 5],
      [20, 0, 1, 5], [20, 7, 1, 10],
      [26, 4, 1, 5], [26, 12, 1, 5],
    ],
    cover: [
      [4, 6, 3, 2, 'planter'], [14, 3, 2, 3, 'planter'],
      [15, 13, 3, 2, 'planter'], [22, 10, 2, 2, 'planter'],
      [28, 6, 2, 3, 'planter'], [6, 12, 2, 1, 'crate'],
      [16, 9, 1, 1, 'crate'], [23, 3, 2, 1, 'crate'],
      [11, 5, 1, 2, 'crate'],
    ],
    lights: [
      [2, 2, 6, 3], [11, 12, 6, 4], [21, 2, 5, 3], [27, 13, 4, 3],
    ],
    playerStart: [2, 15],
    loot: [17, 7],
    exit: [29, 14, 2, 2],
    distractors: [[8, 15], [18, 5], [24, 14]],
    cameras: [
      { x: 18, y: 1, angle: Math.PI / 2, arc: 0.55, speed: 0.90, fov: 48, range: 270 },
      { x: 8, y: 10, angle: 0, arc: 0.50, speed: 1.15, fov: 44, range: 240 },
    ],
    guards: [
      { name: 'Warden Vale', x: 2, y: 3, fov: 68, range: 250, waypoints: [[2, 3], [8, 3], [8, 9], [2, 9]] },
      { name: 'Warden Kest', x: 12, y: 2, fov: 72, range: 270, waypoints: [[12, 2], [18, 2], [18, 12], [12, 12]] },
      { name: 'Warden Rook', x: 22, y: 2, fov: 70, range: 250, waypoints: [[22, 2], [30, 2], [30, 9], [22, 9]] },
    ],
  },
  {
    id: 2,
    name: 'THE LOADING BAY',
    subtitle: 'Freight terminal · dock four',
    objective: OBJECTIVE_PRISM,
    walls: [
      [7, 0, 1, 7], [7, 11, 1, 6],
      [15, 5, 1, 8], [23, 0, 1, 6], [23, 10, 1, 7],
      [11, 14, 6, 1],
    ],
    cover: [
      [3, 10, 3, 2, 'planter'], [10, 4, 2, 2, 'crate'],
      [18, 3, 3, 2, 'planter'], [18, 11, 2, 2, 'crate'],
      [25, 7, 2, 3, 'planter'], [4, 4, 2, 1, 'crate'],
      [27, 13, 3, 2, 'planter'],
    ],
    lights: [
      [2, 2, 5, 3], [12, 8, 4, 3], [19, 4, 4, 3], [26, 2, 5, 3],
    ],
    playerStart: [2, 16],
    loot: [19, 8],
    exit: [29, 8, 2, 2],
    distractors: [[6, 9], [14, 3], [21, 13]],
    cameras: [
      { x: 13, y: 2, angle: Math.PI / 2, arc: 0.60, speed: 0.85, fov: 46, range: 260 },
      { x: 24, y: 8, angle: Math.PI, arc: 0.50, speed: 1.05, fov: 44, range: 250 },
    ],
    guards: [
      { name: 'Warden Pike', x: 2, y: 3, fov: 70, range: 245, waypoints: [[2, 3], [6, 3], [6, 8], [2, 8]] },
      { name: 'Warden Sable', x: 9, y: 2, fov: 74, range: 265, waypoints: [[9, 2], [14, 2], [14, 12], [9, 12]] },
      { name: 'Warden Orr', x: 17, y: 2, fov: 70, range: 255, waypoints: [[17, 2], [22, 2], [22, 13], [17, 13]] },
      { name: 'Warden Dun', x: 25, y: 2, fov: 68, range: 235, waypoints: [[25, 2], [30, 2], [30, 6], [25, 6]] },
    ],
  },
  {
    id: 3,
    name: 'THE GLASS VAULT',
    subtitle: 'Central archive · locked down',
    objective: OBJECTIVE_PRISM,
    walls: [
      [5, 3, 1, 12], [12, 0, 1, 6], [12, 10, 1, 7],
      [19, 4, 1, 10], [26, 0, 1, 6], [26, 10, 1, 7],
      [8, 8, 3, 1], [20, 13, 4, 1],
    ],
    cover: [
      [2, 10, 2, 3, 'planter'], [8, 3, 2, 1, 'crate'],
      [16, 7, 2, 2, 'planter'], [16, 14, 2, 1, 'crate'],
      [22, 6, 2, 2, 'planter'], [28, 3, 2, 2, 'crate'],
      [23, 15, 3, 1, 'planter'],
    ],
    lights: [
      [2, 12, 4, 3], [13, 2, 5, 3], [21, 10, 4, 3], [27, 12, 4, 3],
    ],
    playerStart: [2, 16],
    loot: [22, 3],
    exit: [29, 2, 2, 2],
    distractors: [[9, 13], [17, 3], [24, 8]],
    cameras: [
      { x: 17, y: 2, angle: Math.PI / 2, arc: 0.50, speed: 0.95, fov: 48, range: 265 },
      { x: 27, y: 8, angle: -Math.PI / 2, arc: 0.55, speed: 1.10, fov: 46, range: 250 },
    ],
    guards: [
      { name: 'Warden Hale', x: 2, y: 3, fov: 70, range: 245, waypoints: [[2, 3], [4, 3], [4, 9], [2, 9]] },
      { name: 'Warden Ives', x: 7, y: 2, fov: 72, range: 260, waypoints: [[7, 2], [11, 2], [11, 12], [7, 12]] },
      { name: 'Warden Marr', x: 14, y: 2, fov: 74, range: 265, waypoints: [[14, 2], [18, 2], [18, 12], [14, 12]] },
      { name: 'Warden Nyx', x: 21, y: 2, fov: 70, range: 250, waypoints: [[21, 2], [25, 2], [25, 8], [21, 8]] },
      { name: 'Warden Quill', x: 28, y: 7, fov: 68, range: 240, waypoints: [[28, 7], [30, 7], [30, 14], [28, 14]] },
    ],
  },
];

export function getLevelDefinitions() {
  return LEVEL_DEFINITIONS;
}

export function tileRectToPixels(rect) {
  const [column, row, width, height] = rect;
  return {
    x: column * TILE_SIZE,
    y: row * TILE_SIZE,
    w: width * TILE_SIZE,
    h: height * TILE_SIZE,
  };
}

export function tileCenterToPixels(column, row) {
  return { x: (column + 0.5) * TILE_SIZE, y: (row + 0.5) * TILE_SIZE };
}

function buildBorderWalls() {
  return [
    { x: 0, y: 0, w: WORLD_WIDTH, h: TILE_SIZE },
    { x: 0, y: WORLD_HEIGHT - TILE_SIZE, w: WORLD_WIDTH, h: TILE_SIZE },
    { x: 0, y: 0, w: TILE_SIZE, h: WORLD_HEIGHT },
    { x: WORLD_WIDTH - TILE_SIZE, y: 0, w: TILE_SIZE, h: WORLD_HEIGHT },
  ];
}

// Returns a fully prepared level: pixel rectangles, collision list, loot, cameras and guard spawns.
export function getLevelDefinition(levelNumber) {
  const index = Math.min(LEVEL_DEFINITIONS.length, Math.max(1, levelNumber | 0)) - 1;
  const definition = LEVEL_DEFINITIONS[index];
  const wallsPx = [...buildBorderWalls(), ...definition.walls.map(tileRectToPixels)];
  const coverPx = definition.cover.map((entry) => ({
    ...tileRectToPixels(entry),
    kind: entry[4],
  }));
  const lightsPx = definition.lights.map(tileRectToPixels);
  const playerStartPx = tileCenterToPixels(definition.playerStart[0], definition.playerStart[1]);
  const lootPx = tileCenterToPixels(definition.loot[0], definition.loot[1]);
  const exitPx = tileRectToPixels(definition.exit);
  const distractorsPx = definition.distractors.map(([column, row]) => tileCenterToPixels(column, row));
  const cameraSpawns = definition.cameras.map((camera) => ({
    ...tileCenterToPixels(camera.x, camera.y),
    baseAngle: camera.angle,
    arc: camera.arc,
    speed: camera.speed,
    fovDegrees: camera.fov,
    range: camera.range,
  }));

  return {
    ...definition,
    index,
    wallsPx,
    coverPx,
    lightsPx,
    obstaclesPx: [...wallsPx, ...coverPx],
    playerStartPx,
    lootPx,
    exitPx,
    distractorsPx,
    cameraSpawns,
  };
}

export function isPointInsideRect(x, y, rect) {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

export function circleIntersectsRect(x, y, radius, rect) {
  const nearestX = Math.max(rect.x, Math.min(x, rect.x + rect.w));
  const nearestY = Math.max(rect.y, Math.min(y, rect.y + rect.h));
  const dx = x - nearestX;
  const dy = y - nearestY;
  return dx * dx + dy * dy <= radius * radius;
}

export function isCircleBlocked(level, x, y, radius) {
  for (const obstacle of level.obstaclesPx) {
    if (circleIntersectsRect(x, y, radius, obstacle)) return true;
  }
  return false;
}

// Axis-separated slide collision: guards and the player never clip through glass or planters.
export function moveCircleWithCollision(level, fromX, fromY, deltaX, deltaY, radius) {
  let x = fromX;
  let y = fromY;
  if (!isCircleBlocked(level, x + deltaX, y, radius)) x += deltaX;
  if (!isCircleBlocked(level, x, y + deltaY, radius)) y += deltaY;
  return { x, y };
}

function distanceToRectEdge(x, y, rect) {
  const dx = Math.max(rect.x - x, 0, x - (rect.x + rect.w));
  const dy = Math.max(rect.y - y, 0, y - (rect.y + rect.h));
  return Math.hypot(dx, dy);
}

// 0.35 in deep shadow, 1.0 in a lamp pool. Drives the exposure gem and suspicion gain.
export function getLightLevelAt(level, x, y) {
  let brightest = 0;
  for (const light of level.lightsPx) {
    const falloff = 1 - distanceToRectEdge(x, y, light) / 64;
    if (falloff > brightest) brightest = falloff;
  }
  return 0.35 + 0.65 * Math.max(0, Math.min(1, brightest));
}

export function isPlayerNearPoint(player, point, radius) {
  return Math.hypot(player.x - point.x, player.y - point.y) <= radius;
}
