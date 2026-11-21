// main.js — boots the stealth game, applies demo URL states, and runs the frame loop.
// v2 adds the Aurora Prism two-step objective, wall cameras, paid gadgets and a
// diagnostic mission log. The guard AI and detection staircase are unchanged.

import {
  GUARD_STATE, getLevelDefinitions, getLevelDefinition, isCircleBlocked,
  isPlayerNearPoint, WORLD_WIDTH, WORLD_HEIGHT,
} from './level-data.js';
import { createGuard, advanceAllGuards } from './guard-ai.js';
import { hasLineOfSight } from './vision-cone.js';
import { createNoiseRingSystem, updateNoiseRings } from './audio-rings.js';
import { updateDetectionSystem } from './detection.js';
import { createCamera, updateCameras } from './camera-system.js';
import { createGadgets, throwCoin, deploySmoke, updateGadgets, isSmokeActive } from './gadgets.js';
import { createLootState, tryCollectLoot } from './loot.js';
import { createMissionLog, seedMissionLog, pushLog } from './mission-log.js';
import {
  createPlayer, updatePlayerMovement, isPlayerInsideExit,
} from './player.js';
import { createCanvasView, renderScene } from './render.js';
import { createInput } from './input.js';

const query = new URLSearchParams(window.location.search);
const demoMode = query.get('demo') ?? '';
const requestedLevel = Number.parseInt(query.get('level') ?? '1', 10);

function clampToWorld(point) {
  return {
    x: Math.max(24, Math.min(WORLD_WIDTH - 24, point.x)),
    y: Math.max(24, Math.min(WORLD_HEIGHT - 24, point.y)),
  };
}

// Find a spot inside a guard's cone with a clear line of sight, for reliable demo screenshots.
function findSpotInGuardView(level, guard, preferredDistance) {
  for (const distance of [preferredDistance, 120, 165, 90, 200]) {
    for (const offset of [0, 0.16, -0.16, 0.32, -0.32]) {
      const angle = guard.angle + offset;
      const candidate = clampToWorld({
        x: guard.x + Math.cos(angle) * distance,
        y: guard.y + Math.sin(angle) * distance,
      });
      if (
        !isCircleBlocked(level, candidate.x, candidate.y, 12) &&
        hasLineOfSight(level, guard.x, guard.y, candidate.x, candidate.y)
      ) return candidate;
    }
  }
  return clampToWorld({
    x: guard.x + Math.cos(guard.angle) * 110,
    y: guard.y + Math.sin(guard.angle) * 110,
  });
}

// ?demo=play is a populated near-miss: loot still visible, one warden suspicious,
// a camera tracking, the alarm partly filled and every sidebar section showing data.
function applyDemoSetup(game) {
  if (!demoMode) return;
  const firstGuard = game.guards[0];
  const secondGuard = game.guards[1] ?? firstGuard;
  const firstCamera = game.cameras[0];

  if (demoMode === 'win') {
    game.player.x = game.level.exitPx.x + game.level.exitPx.w / 2;
    game.player.y = game.level.exitPx.y + game.level.exitPx.h / 2;
    game.loot.secured = true;
    game.loot.collectedAt = 70.1;
    game.won = true;
    game.stats.elapsed = 74.2;
    game.stats.nearMisses = 3;
    game.stats.alerts = 1;
    game.stats.cameraSpots = 2;
    game.stats.alarm = 22;
    game.stats.exposure = 0.28;
    pushLog(game.log, 'Loot secured.', 'loot');
    pushLog(game.log, 'Extraction complete.', 'loot');
    pushLog(game.log, 'Shift closed with one alarm.', 'sys');
    return;
  }

  const spot = findSpotInGuardView(game.level, firstGuard, 150);
  game.player.x = spot.x;
  game.player.y = spot.y;

  if (demoMode === 'alert') {
    firstGuard.state = GUARD_STATE.ALERT;
    firstGuard.suspicion = 100;
    firstGuard.alertTimer = 4;
    firstGuard.bark = 'Intruder!';
    firstGuard.barkTimer = 3;
    firstGuard.demoFloor = 100;
    secondGuard.state = GUARD_STATE.SUSPICIOUS;
    secondGuard.suspicion = 58;
    secondGuard.demoFloor = 58;
    secondGuard.bark = 'Footprints.';
    secondGuard.barkTimer = 3;
    game.stats.alerts = 1;
    game.stats.alarm = 88;
    game.stats.cameraSpots = 2;
    game.stats.nearMisses = 3;
    game.stats.noiseInvestigations = 2;
    game.stats.elapsed = 63.4;
    game.stats.exposure = 0.82;
    if (firstCamera) {
      firstCamera.demoSees = true;
      firstCamera.seesPlayer = true;
      firstCamera.state = 'TRACK';
    }
    pushLog(game.log, 'Intruder confirmed.', 'alarm');
    pushLog(game.log, 'Camera pinged the nearest warden.', 'cam');
    pushLog(game.log, 'Alarm climbing — find cover.', 'alarm');
    game.demoHold = 28;
  } else {
    firstGuard.state = GUARD_STATE.SUSPICIOUS;
    firstGuard.suspicion = 64;
    firstGuard.demoFloor = 64;
    firstGuard.bark = 'Footprints.';
    firstGuard.barkTimer = 3.2;
    secondGuard.suspicion = 26;
    secondGuard.demoFloor = 26;
    game.stats.alarm = 46;
    game.stats.cameraSpots = 1;
    game.stats.noiseInvestigations = 1;
    game.stats.nearMisses = 2;
    game.stats.elapsed = 42.7;
    game.stats.exposure = 0.58;
    if (firstCamera) {
      firstCamera.demoSees = true;
      firstCamera.seesPlayer = true;
      firstCamera.state = 'TRACK';
    }
    game.stats.markers = game.level.distractorsPx.slice(0, 2).map((point, index) => ({
      x: point.x, y: point.y, label: index === 0 ? 'A' : 'B',
    }));
    pushLog(game.log, 'He heard you on the tile.', 'noise');
    pushLog(game.log, 'Aurora Prism visible — take it with E.', 'loot');
    pushLog(game.log, 'Camera sweeping the east wing.', 'cam');
    game.demoHold = 28;
  }
  game.stats.demoAlarmFloor = game.stats.alarm;
}

export function createGame(levelNumber) {
  const level = getLevelDefinition(levelNumber);
  const guards = level.guards.map(createGuard);
  const cameras = level.cameraSpawns.map(createCamera);
  const player = createPlayer(level.playerStartPx.x, level.playerStartPx.y);
  const gadgets = createGadgets();
  const loot = createLootState(level);
  const log = createMissionLog();
  seedMissionLog(log, level);
  const game = {
    level,
    levelDefinitions: getLevelDefinitions(),
    guards,
    cameras,
    player,
    gadgets,
    loot,
    log,
    noiseSystem: createNoiseRingSystem(),
    stats: {
      elapsed: 0,
      nearMisses: 0,
      alerts: 0,
      noiseInvestigations: 0,
      cameraSpots: 0,
      cameraExposure: 0,
      alarm: 0,
      demoAlarmFloor: 0,
      exposure: 0,
      flashTimer: 0,
      markers: [],
      lastPlayerX: player.x,
      lastPlayerY: player.y,
    },
    usedCaches: new Set(),
    demoMode,
    demoHold: 0,
    time: 0,
    caughtTimer: 0,
    won: false,
    lost: false,
  };
  applyDemoSetup(game);
  return game;
}

function checkEndConditions(game, deltaTime) {
  if (game.won || game.lost) return;
  const alertedGuards = game.guards.filter((guard) => guard.state === GUARD_STATE.ALERT);
  let nearestAlert = 9999;
  for (const guard of alertedGuards) {
    nearestAlert = Math.min(nearestAlert, Math.hypot(guard.x - game.player.x, guard.y - game.player.y));
  }
  game.caughtTimer = nearestAlert < 68
    ? game.caughtTimer + deltaTime
    : Math.max(0, game.caughtTimer - deltaTime * 0.7);
  if (game.caughtTimer > 0.75) game.lost = true;

  // The gate only opens once the Aurora Prism is secured.
  if (game.loot.secured && isPlayerInsideExit(game.player, game.level) && alertedGuards.length === 0) {
    game.won = true;
    pushLog(game.log, 'Extraction complete.', 'loot');
  }
}

// E takes the prism; if it is not in reach it picks up an unclaimed coin cache.
function handleInteraction(game) {
  if (tryCollectLoot(game.loot, game.player, game.log, game.stats.elapsed)) return;
  for (let index = 0; index < game.level.distractorsPx.length; index += 1) {
    const cache = game.level.distractorsPx[index];
    if (game.usedCaches.has(index)) continue;
    if (isPlayerNearPoint(game.player, cache, 32)) {
      game.usedCaches.add(index);
      game.gadgets.coins += 1;
      pushLog(game.log, 'Coin recovered from the floor.', 'gadget');
      return;
    }
  }
}

const canvas = document.getElementById('game');
const view = createCanvasView(canvas);
const input = createInput(canvas, view.screenToWorld);
let game = createGame(Number.isFinite(requestedLevel) ? requestedLevel : 1);

function resizeAll() {
  view.resize();
}
window.addEventListener('resize', resizeAll);
resizeAll();

let previousTime = performance.now();
function runFrame(now) {
  const deltaTime = Math.min(0.05, Math.max(0, (now - previousTime) / 1000));
  previousTime = now;
  game.time += deltaTime;

  const frame = input.readFrame(game.player.x, game.player.y);

  if (frame.levelRequest) {
    game = createGame(frame.levelRequest);
  } else if (frame.restart) {
    game = createGame(game.level.id);
  } else if (input.consumeAnyInput() && game.demoHold > 0) {
    game.demoHold = 0;
    game.stats.demoAlarmFloor = 0;
  }

  if (!game.won && !game.lost) {
    updatePlayerMovement(game.player, frame, game.level, game.noiseSystem, deltaTime);
    updateGadgets(game.gadgets, deltaTime);

    if (frame.interact) handleInteraction(game);
    if (frame.smoke) deploySmoke(game.gadgets, game.player, game.log);
    let throwPoint = frame.throwPoint;
    if (frame.coin && !throwPoint) {
      const distance = Math.hypot(frame.mouseX - game.player.x, frame.mouseY - game.player.y);
      throwPoint = distance > 24
        ? { x: frame.mouseX, y: frame.mouseY }
        : {
            x: game.player.x + Math.cos(game.player.angle) * 180,
            y: game.player.y + Math.sin(game.player.angle) * 180,
          };
    }
    if (throwPoint) throwCoin(game.gadgets, game.player, throwPoint.x, throwPoint.y, game.noiseSystem, game.log);

    updateNoiseRings(game.noiseSystem, deltaTime);

    const holdDemo = game.demoHold > 0;
    if (game.demoHold > 0) game.demoHold = Math.max(0, game.demoHold - deltaTime);

    const smokeActive = isSmokeActive(game.gadgets);
    updateDetectionSystem(game.guards, game.player, game.level, deltaTime, game.noiseSystem, game.stats, holdDemo, game.log, smokeActive);
    updateCameras(game.cameras, game.guards, game.level, game.player, deltaTime, smokeActive, game.stats, game.log, holdDemo);
    advanceAllGuards(game.guards, game.level, deltaTime, holdDemo);
    checkEndConditions(game, deltaTime);
    game.stats.elapsed += deltaTime;
  } else {
    updateNoiseRings(game.noiseSystem, deltaTime);
    updateGadgets(game.gadgets, deltaTime);
  }

  game.stats.flashTimer = Math.max(0, game.stats.flashTimer - deltaTime);
  renderScene(view, game);
  requestAnimationFrame(runFrame);
}
requestAnimationFrame(runFrame);
