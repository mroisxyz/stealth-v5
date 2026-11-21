// player.js — the intruder's stance, movement, footstep timing and noisemaker throwing.
// v2 note: E is now reserved for the Aurora Prism; coins are thrown from gadgets.js.
// Movement, stride lengths and step-ring loudness are unchanged from v1.

import { moveCircleWithCollision } from './level-data.js';
import { spawnNoiseRing } from './audio-rings.js';
import { turnTowardAngle } from './vision-cone.js';

export function createPlayer(startX, startY) {
  return {
    x: startX,
    y: startY,
    angle: -Math.PI / 2,
    radius: 11,
    crouching: false,
    running: false,
    moving: false,
    stepDistance: 0,
    distractCooldown: 0,
    trail: [],
    exposure: 0,
  };
}

function strideLength(player) {
  if (player.crouching) return 46;
  if (player.running) return 34;
  return 30;
}

export function updatePlayerMovement(player, inputFrame, level, noiseSystem, deltaTime) {
  player.crouching = inputFrame.crouch;
  player.running = inputFrame.run && !player.crouch;
  player.distractCooldown = Math.max(0, player.distractCooldown - deltaTime);
  player.radius = player.crouching ? 8 : 11;

  let directionX = inputFrame.moveX;
  let directionY = inputFrame.moveY;
  const inputLength = Math.hypot(directionX, directionY);
  if (inputLength > 1) {
    directionX /= inputLength;
    directionY /= inputLength;
  }

  const speed = player.crouching ? 92 : player.running ? 210 : 146;
  const next = moveCircleWithCollision(
    level,
    player.x,
    player.y,
    directionX * speed * deltaTime,
    directionY * speed * deltaTime,
    player.radius,
  );
  const travelled = Math.hypot(next.x - player.x, next.y - player.y);
  player.x = next.x;
  player.y = next.y;
  player.moving = travelled > 0.15;

  if (player.moving && inputLength > 0) {
    player.angle = turnTowardAngle(player.angle, Math.atan2(directionY, directionX), deltaTime * 12);
    player.stepDistance += travelled;
    const stride = strideLength(player);
    if (player.stepDistance >= stride) {
      player.stepDistance -= stride;
      spawnNoiseRing(noiseSystem, player.x, player.y, {
        kind: 'step',
        maxRadius: player.running ? 220 : player.crouching ? 54 : 112,
        life: player.running ? 1.3 : 0.95,
        loudness: player.running ? 1.0 : player.crouching ? 0.16 : 0.48,
      });
    }
  }

  player.trail.unshift({ x: player.x, y: player.y, age: 0 });
  if (player.trail.length > 16) player.trail.pop();
  for (const point of player.trail) point.age += deltaTime;
}

// Kept from v1 for compatibility; the paid coin throw lives in gadgets.js.
export function dropNoisemakerAtPlayer(player, noiseSystem) {
  if (player.distractCooldown > 0) return false;
  player.distractCooldown = 1.4;
  spawnNoiseRing(noiseSystem, player.x, player.y, {
    kind: 'distract',
    maxRadius: 330,
    life: 1.7,
    loudness: 1,
  });
  return true;
}

export function throwNoisemakerToward(player, targetX, targetY, noiseSystem) {
  if (player.distractCooldown > 0) return false;
  const distance = Math.hypot(targetX - player.x, targetY - player.y);
  const clamped = Math.min(240, distance);
  const angle = Math.atan2(targetY - player.y, targetX - player.x);
  const landingX = player.x + Math.cos(angle) * clamped;
  const landingY = player.y + Math.sin(angle) * clamped;
  player.distractCooldown = 1.4;
  spawnNoiseRing(noiseSystem, landingX, landingY, {
    kind: 'distract',
    maxRadius: 320,
    life: 1.7,
    loudness: 1,
  });
  return true;
}

export function isPlayerInsideExit(player, level) {
  const { exitPx } = level;
  return (
    player.x > exitPx.x + 6 &&
    player.x < exitPx.x + exitPx.w - 6 &&
    player.y > exitPx.y + 6 &&
    player.y < exitPx.y + exitPx.h - 6
  );
}
