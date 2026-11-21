// camera-system.js — sweeping wall cameras, cyan cover-clipped cones and the shared alarm meter.
// A camera sees faster than a warden: it can fill the alarm meter on its own and ping
// the nearest guard, but smoke (S) blinds every cone for five seconds.

import { getLightLevelAt, GUARD_STATE } from './level-data.js';
import { angleFromTo, isTargetInsideCone, hasLineOfSight, turnTowardAngle } from './vision-cone.js';
import { issueGuardBark } from './guard-ai.js';
import { pushLog } from './mission-log.js';

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

export function createCamera(spawn, index) {
  return {
    id: index + 1,
    name: `CAM ${index + 1}`,
    x: spawn.x,
    y: spawn.y,
    baseAngle: spawn.baseAngle,
    arc: spawn.arc,
    sweepSpeed: spawn.speed,
    phase: index * 2.1,
    angle: spawn.baseAngle,
    coneFov: (spawn.fovDegrees * Math.PI) / 180,
    coneRange: spawn.range,
    seesPlayer: false,
    wasSeeing: false,
    exposure: 0,
    playerX: spawn.x,
    playerY: spawn.y,
    state: 'SWEEP',
    pingCooldown: 0,
    demoSees: false,
  };
}

function pingNearestGuard(guards, camera, log) {
  let nearest = null;
  let bestDistance = 420;
  for (const guard of guards) {
    const distance = Math.hypot(guard.x - camera.x, guard.y - camera.y);
    if (distance < bestDistance) {
      bestDistance = distance;
      nearest = guard;
    }
  }
  if (!nearest || nearest.state === GUARD_STATE.ALERT) return;
  nearest.suspicion = Math.max(nearest.suspicion, 46);
  nearest.lastSeenX = camera.playerX;
  nearest.lastSeenY = camera.playerY;
  if (nearest.state === GUARD_STATE.PATROL || nearest.state === GUARD_STATE.STAND_DOWN) {
    nearest.state = GUARD_STATE.SUSPICIOUS;
  }
  issueGuardBark(nearest, 'Camera ping.', 2.2);
  pushLog(log, 'Camera pinged the nearest warden.', 'cam');
}

function checkLockdown(guards, stats, log) {
  if (stats.alarm < 100) return;
  if (guards.some((guard) => guard.state === GUARD_STATE.ALERT)) {
    stats.alarm = 78;
    return;
  }
  let nearest = null;
  let bestDistance = Infinity;
  for (const guard of guards) {
    const distance = Math.hypot(guard.x - stats.lastPlayerX, guard.y - stats.lastPlayerY);
    if (distance < bestDistance) {
      bestDistance = distance;
      nearest = guard;
    }
  }
  if (nearest) {
    nearest.state = GUARD_STATE.ALERT;
    nearest.suspicion = 100;
    nearest.alertTimer = 3.6;
    issueGuardBark(nearest, 'Intruder!', 2.6);
  }
  stats.alerts += 1;
  stats.alarm = 62;
  pushLog(log, 'Alarm maxed — the wing locks down.', 'alarm');
}

// One frame of camera simulation. holdDemo freezes the meter but keeps cones sweeping,
// which is what makes ?demo=play a stable near-miss screenshot.
export function updateCameras(cameras, guards, level, player, deltaTime, smokeActive, stats, log, holdDemo = false) {
  let strongestCameraExposure = 0;

  for (const camera of cameras) {
    camera.pingCooldown = Math.max(0, camera.pingCooldown - deltaTime);
    camera.phase += deltaTime * camera.sweepSpeed;
    camera.angle = camera.baseAngle + Math.sin(camera.phase) * camera.arc;
    camera.playerX = player.x;
    camera.playerY = player.y;

    const distance = Math.hypot(player.x - camera.x, player.y - camera.y);
    const targetAngle = angleFromTo(camera.x, camera.y, player.x, player.y);
    // A demo camera is aimed at the player so the near-miss screenshot shows a
    // hot cyan TRACK cone; normal play never uses this branch.
    if (camera.demoSees && holdDemo) {
      camera.angle = turnTowardAngle(camera.angle, targetAngle, 0.8);
    }
    const insideCone = distance <= camera.coneRange && isTargetInsideCone(camera.angle, targetAngle, camera.coneFov);
    const unobstructed = insideCone && hasLineOfSight(level, camera.x, camera.y, player.x, player.y);

    camera.seesPlayer = (camera.demoSees && holdDemo) || (!smokeActive && unobstructed);
    camera.state = smokeActive ? 'BLIND' : camera.seesPlayer ? 'TRACK' : 'SWEEP';

    if (camera.seesPlayer) {
      if (camera.demoSees || holdDemo) {
        camera.exposure = 0.62;
      } else {
        const light = getLightLevelAt(level, player.x, player.y);
        const stance = player.crouching ? 0.55 : player.running ? 1.2 : 0.9;
        camera.exposure = clamp(light * stance * (1.15 - 0.35 * (distance / camera.coneRange)), 0.08, 1);
        stats.alarm = Math.min(100, stats.alarm + (20 + 26 * camera.exposure) * deltaTime);
        camera.angle = turnTowardAngle(camera.angle, targetAngle, deltaTime * 2.6);
      }
      strongestCameraExposure = Math.max(strongestCameraExposure, camera.exposure);

      if (!camera.wasSeeing && !camera.demoSees && !holdDemo) {
        stats.cameraSpots += 1;
        pushLog(log, 'Camera flagged movement.', 'cam');
      }
      camera.wasSeeing = true;

      if (!camera.demoSees && !holdDemo && camera.pingCooldown <= 0) {
        pingNearestGuard(guards, camera, log);
        camera.pingCooldown = 4.5;
      }
    } else {
      camera.wasSeeing = false;
      camera.exposure = 0;
      if (!holdDemo) stats.alarm = Math.max(0, stats.alarm - 8 * deltaTime);
    }
  }

  if (holdDemo) {
    stats.alarm = Math.max(stats.alarm, stats.demoAlarmFloor ?? 0);
  } else {
    checkLockdown(guards, stats, log);
  }
  stats.cameraExposure = strongestCameraExposure;
  stats.lastPlayerX = player.x;
  stats.lastPlayerY = player.y;
}

export function activeCameraCount(cameras) {
  return cameras.reduce((count, camera) => count + (camera.state === 'BLIND' ? 0 : 1), 0);
}
