// detection.js — the suspicion staircase: seeing, hearing, near misses and state promotion.
// v2 extension: guard barks also feed the shared alarm meter (slowly) and the diagnostic
// mission log. The proven state transitions and suspicion rates are unchanged.

import { GUARD_STATE, getLightLevelAt } from './level-data.js';
import { angleFromTo, hasLineOfSight, isTargetInsideCone } from './vision-cone.js';
import { getRingCurrentRadius } from './audio-rings.js';
import { issueGuardBark } from './guard-ai.js';
import { pushLog } from './mission-log.js';

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

// One sentence of rules: brighter, closer and louder makes a guard certain faster.
export function computeSensesForGuard(level, player, guard) {
  const distance = Math.hypot(player.x - guard.x, player.y - guard.y);
  const targetAngle = angleFromTo(guard.x, guard.y, player.x, player.y);
  const insideCone = distance <= guard.coneRange && isTargetInsideCone(guard.angle, targetAngle, guard.coneFov);
  const unobstructed = insideCone && hasLineOfSight(level, guard.x, guard.y, player.x, player.y);

  let exposure = 0;
  if (unobstructed) {
    const light = getLightLevelAt(level, player.x, player.y);
    const stance = player.crouching ? 0.5 : player.running ? 1.15 : 0.85;
    const proximity = 1.28 - 0.5 * (distance / guard.coneRange);
    exposure = clamp(light * stance * proximity, 0.05, 1);
  }
  return { distance, targetAngle, insideCone, unobstructed, exposure };
}

function applyHeardNoise(guard, ring, stats, log) {
  if (ring.heardBy.has(guard.id)) return;
  const distance = Math.hypot(ring.x - guard.x, ring.y - guard.y);
  if (distance > getRingCurrentRadius(ring)) return;

  ring.heardBy.add(guard.id);
  if (ring.kind === 'distract') {
    if (guard.state === GUARD_STATE.ALERT) return;
    guard.state = GUARD_STATE.SEARCH;
    guard.searchTimer = 5.5;
    guard.searchTargetX = ring.x;
    guard.searchTargetY = ring.y;
    guard.searchBarkDone = false;
    guard.suspicion = Math.max(guard.suspicion, 34);
    issueGuardBark(guard, 'Heard something.', 2.4);
    stats.noiseInvestigations += 1;
    return;
  }

  if (ring.kind !== 'step' || ring.loudness < 0.2) return;
  guard.suspicion = Math.min(100, guard.suspicion + 11 * ring.loudness);
  guard.lastSeenX = ring.x;
  guard.lastSeenY = ring.y;
  if (guard.state === GUARD_STATE.PATROL || guard.state === GUARD_STATE.STAND_DOWN) {
    guard.state = GUARD_STATE.SUSPICIOUS;
    issueGuardBark(guard, 'Footprints.', 2.2);
    pushLog(log, 'He heard you on the tile.', 'noise');
  }
}

function handleNearMiss(guard, stats) {
  if (guard.state === GUARD_STATE.ALERT || guard.suspicion >= 100) {
    guard.peakSuspicion = Math.max(guard.peakSuspicion, guard.suspicion);
    return;
  }
  if (guard.peakSuspicion >= 55 && guard.suspicion < 26 && !guard.nearMissCredited) {
    guard.nearMissCredited = true;
    stats.nearMisses += 1;
    stats.flashTimer = 2.1;
  }
  if (guard.suspicion < 12) {
    guard.peakSuspicion = 0;
    guard.nearMissCredited = false;
  }
}

// Advances every guard's awareness for one frame. holdDemo freezes demo states for screenshots.
export function updateDetectionSystem(guards, player, level, deltaTime, noiseSystem, stats, holdDemo, log, smokeActive = false) {
  let strongestExposure = 0;
  let strongestGuardSuspicion = 0;

  for (const guard of guards) {
    const senses = computeSensesForGuard(level, player, guard);
    // Smoke blinds every cone: a warden can still hear you, but cannot confirm sight.
    guard.canSeePlayer = senses.unobstructed && !smokeActive;
    guard.sensedExposure = senses.exposure;
    guard.distanceToPlayer = senses.distance;
    guard.playerTargetX = player.x;
    guard.playerTargetY = player.y;
    if (!smokeActive) strongestExposure = Math.max(strongestExposure, senses.exposure);

    for (const ring of noiseSystem.rings) applyHeardNoise(guard, ring, stats, log);

    if (holdDemo && guard.demoFloor !== undefined && guard.demoFloor !== null) {
      guard.suspicion = Math.max(guard.suspicion, guard.demoFloor);
      guard.lastSeenX = player.x;
      guard.lastSeenY = player.y;
      guard.peakSuspicion = Math.max(guard.peakSuspicion, guard.suspicion);
      continue;
    }

    if (senses.unobstructed && !smokeActive) {
      const gain = (14 + 30 * senses.exposure) * deltaTime;
      guard.suspicion = Math.min(100, guard.suspicion + gain);
      guard.lastSeenX = player.x;
      guard.lastSeenY = player.y;
      guard.peakSuspicion = Math.max(guard.peakSuspicion, guard.suspicion);
    } else {
      const drain = guard.state === GUARD_STATE.ALERT ? 9 : guard.state === GUARD_STATE.SEARCH ? 16 : 15;
      guard.suspicion = Math.max(0, guard.suspicion - drain * deltaTime);
    }

    if (guard.suspicion >= 100 && guard.state !== GUARD_STATE.ALERT) {
      guard.state = GUARD_STATE.ALERT;
      guard.alertTimer = 3.6;
      issueGuardBark(guard, 'Intruder!', 2.6);
      stats.alerts += 1;
      pushLog(log, 'Intruder confirmed.', 'alarm');
    } else if (guard.suspicion <= 0 && guard.state === GUARD_STATE.SUSPICIOUS) {
      guard.state = GUARD_STATE.STAND_DOWN;
      guard.standDownTimer = 1.5;
      issueGuardBark(guard, 'False alarm.', 2.2);
      pushLog(log, 'False alarm.', 'guard');
    }

    strongestGuardSuspicion = Math.max(strongestGuardSuspicion, guard.suspicion);
    handleNearMiss(guard, stats);
  }

  // Wardens nudge the alarm meter; cameras (in camera-system.js) fill it much faster.
  if (!holdDemo && strongestGuardSuspicion > 12) {
    stats.alarm = Math.min(100, stats.alarm + (strongestGuardSuspicion / 100) * 9 * deltaTime);
  }
  if (holdDemo) stats.alarm = Math.max(stats.alarm, stats.demoAlarmFloor ?? 0);

  const ambient = getLightLevelAt(level, player.x, player.y) * 0.34;
  player.exposure = Math.max(strongestExposure, stats.cameraExposure ?? 0, ambient);
  stats.exposure = player.exposure;
}

export function anyGuardAlerted(guards) {
  return guards.some((guard) => guard.state === GUARD_STATE.ALERT);
}
