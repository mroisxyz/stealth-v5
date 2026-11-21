// guard-ai.js — deterministic patrols and the PATROL → SUSPICIOUS → ALERT → SEARCH → STAND_DOWN machine.
// v2 note: the state machine, timings and turn rates are preserved verbatim from the
// proven v1 build. Only a diagnostic-label helper was added for the new right sidebar.

import { GUARD_STATE, moveCircleWithCollision, tileCenterToPixels } from './level-data.js';
import { angleFromTo, turnTowardAngle } from './vision-cone.js';

const GUARD_BODY_RADIUS = 11;

export function createGuard(definition, index) {
  const start = tileCenterToPixels(definition.x, definition.y);
  const waypointsPx = definition.waypoints.map(([column, row]) => tileCenterToPixels(column, row));
  const nextWaypoint = waypointsPx[1] ?? waypointsPx[0];
  return {
    id: index + 1,
    name: definition.name,
    x: start.x,
    y: start.y,
    angle: angleFromTo(start.x, start.y, nextWaypoint.x, nextWaypoint.y),
    coneFov: ((definition.fov ?? 70) * Math.PI) / 180,
    coneRange: definition.range ?? 250,
    waypointsPx,
    waypointIndex: 1 % waypointsPx.length,
    state: GUARD_STATE.PATROL,
    suspicion: 0,
    lastSeenX: start.x,
    lastSeenY: start.y,
    searchTargetX: start.x,
    searchTargetY: start.y,
    alertTimer: 0,
    searchTimer: 0,
    standDownTimer: 0,
    bark: '',
    barkTimer: 0,
    barkCooldown: 0,
    peakSuspicion: 0,
    nearMissCredited: false,
    canSeePlayer: false,
    sensedExposure: 0,
    distanceToPlayer: 999,
    playerTargetX: start.x,
    playerTargetY: start.y,
    sweepPhase: index * 1.9,
    searchBarkDone: false,
    stuckTimer: 0,
    demoFloor: null,
  };
}

export function issueGuardBark(guard, text, duration = 2.2) {
  if (guard.barkCooldown > 0 && text !== 'Intruder!') return;
  if (guard.bark === text && guard.barkTimer > 0.7) return;
  guard.bark = text;
  guard.barkTimer = duration;
  guard.barkCooldown = 0.85;
}

function walkGuardToward(guard, targetX, targetY, speed, deltaTime, level, turnRate) {
  const distance = Math.hypot(targetX - guard.x, targetY - guard.y);
  if (distance < 9) {
    guard.stuckTimer = 0;
    return true;
  }
  const desiredAngle = angleFromTo(guard.x, guard.y, targetX, targetY);
  guard.angle = turnTowardAngle(guard.angle, desiredAngle, turnRate * deltaTime);
  const step = Math.min(speed * deltaTime, distance);
  const moved = moveCircleWithCollision(
    level,
    guard.x,
    guard.y,
    Math.cos(guard.angle) * step,
    Math.sin(guard.angle) * step,
    GUARD_BODY_RADIUS,
  );
  const actual = Math.hypot(moved.x - guard.x, moved.y - guard.y);
  guard.x = moved.x;
  guard.y = moved.y;
  guard.stuckTimer = actual < step * 0.3 ? guard.stuckTimer + deltaTime : 0;
  if (guard.stuckTimer > 1.1) {
    guard.stuckTimer = 0;
    return true;
  }
  return distance < 13;
}

function sweepGuardView(guard, deltaTime, amplitude) {
  guard.sweepPhase += deltaTime * 2.4;
  guard.angle += Math.sin(guard.sweepPhase) * amplitude * deltaTime;
}

function advanceGuardThroughPatrol(guard, level, deltaTime) {
  const waypoint = guard.waypointsPx[guard.waypointIndex];
  if (walkGuardToward(guard, waypoint.x, waypoint.y, 64, deltaTime, level, 4.2)) {
    guard.waypointIndex = (guard.waypointIndex + 1) % guard.waypointsPx.length;
  }
}

function advanceGuardThroughSuspicion(guard, level, deltaTime) {
  if (guard.canSeePlayer) {
    guard.angle = turnTowardAngle(
      guard.angle,
      angleFromTo(guard.x, guard.y, guard.playerTargetX, guard.playerTargetY),
      deltaTime * 3.4,
    );
    const distance = Math.hypot(guard.playerTargetX - guard.x, guard.playerTargetY - guard.y);
    if (distance > 76) {
      walkGuardToward(guard, guard.playerTargetX, guard.playerTargetY, 42, deltaTime, level, 3.4);
    }
  } else if (walkGuardToward(guard, guard.lastSeenX, guard.lastSeenY, 52, deltaTime, level, 3.2)) {
    sweepGuardView(guard, deltaTime, 1.1);
  }
}

function advanceGuardThroughAlert(guard, level, deltaTime) {
  guard.alertTimer -= deltaTime;
  const targetX = guard.canSeePlayer ? guard.playerTargetX : guard.lastSeenX;
  const targetY = guard.canSeePlayer ? guard.playerTargetY : guard.lastSeenY;
  walkGuardToward(guard, targetX, targetY, 134, deltaTime, level, 7.5);
  if (guard.alertTimer <= 0) {
    guard.state = GUARD_STATE.SEARCH;
    guard.searchTimer = 5.5;
    guard.searchTargetX = guard.lastSeenX;
    guard.searchTargetY = guard.lastSeenY;
    guard.searchBarkDone = false;
    issueGuardBark(guard, 'Lost him.', 2.4);
  }
}

function advanceGuardThroughSearch(guard, level, deltaTime) {
  guard.searchTimer -= deltaTime;
  if (!guard.searchBarkDone) {
    issueGuardBark(guard, 'Checking the shadows.', 2.2);
    guard.searchBarkDone = true;
  }
  if (walkGuardToward(guard, guard.searchTargetX, guard.searchTargetY, 94, deltaTime, level, 5.2)) {
    sweepGuardView(guard, deltaTime, 1.5);
  }
  if (guard.searchTimer <= 0) {
    guard.state = GUARD_STATE.STAND_DOWN;
    guard.standDownTimer = 1.8;
    issueGuardBark(guard, 'Stand down.', 2.4);
  }
}

function advanceGuardThroughStandDown(guard, deltaTime) {
  guard.standDownTimer -= deltaTime;
  guard.suspicion = Math.max(0, guard.suspicion - 24 * deltaTime);
  const waypoint = guard.waypointsPx[guard.waypointIndex];
  guard.angle = turnTowardAngle(guard.angle, angleFromTo(guard.x, guard.y, waypoint.x, waypoint.y), deltaTime * 1.8);
  if (guard.standDownTimer <= 0) {
    guard.state = GUARD_STATE.PATROL;
    guard.peakSuspicion = 0;
    guard.nearMissCredited = false;
    issueGuardBark(guard, 'Carry on.', 1.8);
  }
}

function advanceSingleGuard(guard, level, deltaTime, holdDemo) {
  guard.barkTimer = Math.max(0, guard.barkTimer - deltaTime);
  guard.barkCooldown = Math.max(0, guard.barkCooldown - deltaTime);

  if (holdDemo && guard.demoFloor !== null && guard.demoFloor !== undefined) {
    guard.sweepPhase += deltaTime * 2;
    guard.angle += Math.sin(guard.sweepPhase) * 0.09 * deltaTime * 60;
    return;
  }

  switch (guard.state) {
    case GUARD_STATE.SUSPICIOUS:
      advanceGuardThroughSuspicion(guard, level, deltaTime);
      break;
    case GUARD_STATE.ALERT:
      advanceGuardThroughAlert(guard, level, deltaTime);
      break;
    case GUARD_STATE.SEARCH:
      advanceGuardThroughSearch(guard, level, deltaTime);
      break;
    case GUARD_STATE.STAND_DOWN:
      advanceGuardThroughStandDown(guard, deltaTime);
      break;
    case GUARD_STATE.PATROL:
    default:
      advanceGuardThroughPatrol(guard, level, deltaTime);
      break;
  }
}

export function advanceAllGuards(guards, level, deltaTime, holdDemo = false) {
  for (const guard of guards) advanceSingleGuard(guard, level, deltaTime, holdDemo);
}

export function getGuardStateLabel(guard) {
  switch (guard.state) {
    case GUARD_STATE.SUSPICIOUS: return '?';
    case GUARD_STATE.ALERT: return '!';
    case GUARD_STATE.SEARCH: return '?';
    case GUARD_STATE.STAND_DOWN: return '✓';
    default: return '•';
  }
}

// Short, colour-ready description used by the DETECTION readout in the right sidebar.
export function getGuardDiagnostic(guard) {
  switch (guard.state) {
    case GUARD_STATE.ALERT: return 'Intruder confirmed — moving to intercept.';
    case GUARD_STATE.SEARCH: return 'Investigating the last known position.';
    case GUARD_STATE.SUSPICIOUS: return guard.bark || 'Something caught his eye.';
    case GUARD_STATE.STAND_DOWN: return 'False alarm — posture relaxing.';
    default: return guard.bark || 'Routine patrol, nothing unusual.';
  }
}
