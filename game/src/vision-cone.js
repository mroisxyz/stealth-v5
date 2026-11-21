// vision-cone.js — cone geometry, occlusion raycasts and the calm/amber/red cone palette.
// v2 extension: cameras reuse the exact same cover-clipped polygon builder, but draw
// in cyan so a player can tell a wall camera from a warden at a glance.

import { circleIntersectsRect } from './level-data.js';

export function normalizeAngle(angle) {
  let result = angle;
  while (result > Math.PI) result -= Math.PI * 2;
  while (result < -Math.PI) result += Math.PI * 2;
  return result;
}

export function angleFromTo(fromX, fromY, toX, toY) {
  return Math.atan2(toY - fromY, toX - fromX);
}

export function turnTowardAngle(currentAngle, targetAngle, maxStep) {
  const difference = normalizeAngle(targetAngle - currentAngle);
  return currentAngle + Math.max(-maxStep, Math.min(maxStep, difference));
}

export function isTargetInsideCone(guardAngle, targetAngle, coneFovRadians) {
  return Math.abs(normalizeAngle(targetAngle - guardAngle)) <= coneFovRadians * 0.5;
}

// Liang-Barsky segment clipping against an axis-aligned obstacle.
function segmentTouchesRect(x1, y1, x2, y2, rect) {
  const deltaX = x2 - x1;
  const deltaY = y2 - y1;
  const p = [-deltaX, deltaX, -deltaY, deltaY];
  const q = [x1 - rect.x, rect.x + rect.w - x1, y1 - rect.y, rect.y + rect.h - y1];
  let entering = 0;
  let leaving = 1;
  for (let i = 0; i < 4; i += 1) {
    if (p[i] === 0) {
      if (q[i] < 0) return false;
    } else {
      const ratio = q[i] / p[i];
      if (p[i] < 0) {
        if (ratio > leaving) return false;
        if (ratio > entering) entering = ratio;
      } else {
        if (ratio < entering) return false;
        if (ratio < leaving) leaving = ratio;
      }
    }
  }
  return true;
}

export function hasLineOfSight(level, fromX, fromY, toX, toY) {
  for (const obstacle of level.obstaclesPx) {
    if (segmentTouchesRect(fromX, fromY, toX, toY, obstacle)) return false;
  }
  return true;
}

// Binary-search the first blocked point along a cone ray, then step back one pixel.
function castConeRayToCover(level, originX, originY, rayAngle, maxDistance) {
  const directionX = Math.cos(rayAngle);
  const directionY = Math.sin(rayAngle);
  let clearDistance = 0;
  let blockedDistance = maxDistance;
  for (let step = 0; step < 9; step += 1) {
    const middle = (clearDistance + blockedDistance) / 2;
    const sampleX = originX + directionX * middle;
    const sampleY = originY + directionY * middle;
    let blocked = false;
    for (const obstacle of level.obstaclesPx) {
      if (circleIntersectsRect(sampleX, sampleY, 0, obstacle)) {
        blocked = true;
        break;
      }
    }
    if (blocked) blockedDistance = middle;
    else clearDistance = middle;
  }
  return Math.max(0, clearDistance - 1);
}

// The visible wedge is clipped by glass and planters, so cover reads instantly.
// Works unchanged for guards and cameras: both expose x, y, angle, coneFov, coneRange.
export function buildVisionConePolygon(level, guard, sampleCount = 26) {
  const halfFov = guard.coneFov * 0.5;
  const points = [{ x: guard.x, y: guard.y }];
  for (let index = 0; index <= sampleCount; index += 1) {
    const fraction = index / sampleCount;
    const rayAngle = guard.angle - halfFov + guard.coneFov * fraction;
    const distance = castConeRayToCover(level, guard.x, guard.y, rayAngle, guard.coneRange);
    points.push({
      x: guard.x + Math.cos(rayAngle) * distance,
      y: guard.y + Math.sin(rayAngle) * distance,
    });
  }
  return points;
}

export function getConePalette(guard) {
  const suspicion = guard.suspicion;
  if (guard.state === 'ALERT') {
    return { fill: 'rgba(255,64,72,0.20)', edge: 'rgba(255,96,96,0.85)', core: 'rgba(255,72,64,0.55)' };
  }
  if (guard.state === 'SEARCH') {
    return { fill: 'rgba(255,146,58,0.15)', edge: 'rgba(255,170,80,0.65)', core: 'rgba(255,150,60,0.36)' };
  }
  if (guard.state === 'SUSPICIOUS' || suspicion > 4) {
    const heat = Math.min(1, suspicion / 100);
    const red = Math.round(110 + 145 * heat);
    const green = Math.round(220 - 120 * heat);
    return {
      fill: `rgba(${red},${green},70,${(0.12 + heat * 0.14).toFixed(3)})`,
      edge: `rgba(${red},${green},90,0.72)`,
      core: `rgba(${red},${green},70,${(0.20 + heat * 0.42).toFixed(3)})`,
    };
  }
  return { fill: 'rgba(72,226,164,0.11)', edge: 'rgba(96,240,180,0.60)', core: 'rgba(72,226,164,0.20)' };
}

// Camera cones are cyan while sweeping, hot cyan while tracking, grey while smoked.
export function getCameraConePalette(camera, blinded) {
  if (blinded) return { fill: 'rgba(150,170,180,0.04)', edge: 'rgba(170,190,200,0.22)', core: 'rgba(170,190,200,0.06)' };
  if (camera.seesPlayer) return { fill: 'rgba(64,238,255,0.22)', edge: 'rgba(150,250,255,0.95)', core: 'rgba(120,245,255,0.52)' };
  return { fill: 'rgba(56,206,232,0.10)', edge: 'rgba(92,226,248,0.58)', core: 'rgba(80,222,244,0.22)' };
}

// Split an rgba(r,g,b,a) palette string into numeric channels. Falls back to a
// calm green if a palette ever uses an unexpected format.
function parseRgba(color) {
  const open = color.indexOf('(');
  const close = color.indexOf(')');
  const parts = color.slice(open + 1, close).split(',');
  const r = Number(parts[0]);
  const g = Number(parts[1]);
  const b = Number(parts[2]);
  const parsedAlpha = parts.length > 3 ? Number(parts[3]) : 1;
  if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) {
    return { r: 72, g: 226, b: 164, a: 0.11 };
  }
  return { r, g, b, a: Number.isFinite(parsedAlpha) ? parsedAlpha : 1 };
}

// Build a soft cone fill: roughly 3x the fill alpha at the origin (capped at 0.5),
// easing through the original alpha, down to 0.35x at the cone tip.
function makeConeGradient(ctx, fillColor, originX, originY, radius) {
  const { r, g, b, a } = parseRgba(fillColor);
  const innerAlpha = Math.min(0.5, a * 3);
  const tipAlpha = a * 0.35;
  const gradient = ctx.createRadialGradient(originX, originY, 0, originX, originY, Math.max(1, radius));
  gradient.addColorStop(0, `rgba(${r},${g},${b},${innerAlpha.toFixed(3)})`);
  gradient.addColorStop(0.55, `rgba(${r},${g},${b},${a.toFixed(3)})`);
  gradient.addColorStop(1, `rgba(${r},${g},${b},${tipAlpha.toFixed(3)})`);
  return gradient;
}

// Draw the clipped wedge plus the Shadow-Tactics-style fill that grows toward the player.
export function drawVisionCone(ctx, level, guard, time, blinded = false) {
  const polygon = buildVisionConePolygon(level, guard);
  const palette = blinded
    ? { fill: 'rgba(150,170,180,0.05)', edge: 'rgba(175,195,205,0.30)', core: 'rgba(175,195,205,0.06)' }
    : getConePalette(guard);

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(polygon[0].x, polygon[0].y);
  for (let index = 1; index < polygon.length; index += 1) ctx.lineTo(polygon[index].x, polygon[index].y);
  ctx.closePath();
  ctx.fillStyle = makeConeGradient(ctx, palette.fill, guard.x, guard.y, guard.coneRange);
  ctx.fill();
  ctx.strokeStyle = palette.edge;
  ctx.lineWidth = 1.4;
  if (blinded) ctx.setLineDash([5, 6]);
  ctx.stroke();
  ctx.setLineDash([]);

  if (!blinded && guard.canSeePlayer && guard.sensedExposure > 0) {
    const halfFov = guard.coneFov * 0.5;
    const targetAngle = angleFromTo(guard.x, guard.y, guard.playerTargetX, guard.playerTargetY);
    const fillSpread = halfFov * (0.08 + 0.62 * Math.min(1, guard.suspicion / 100));
    const reach = Math.min(guard.coneRange, Math.hypot(guard.playerTargetX - guard.x, guard.playerTargetY - guard.y));
    ctx.beginPath();
    ctx.moveTo(guard.x, guard.y);
    ctx.lineTo(guard.x + Math.cos(targetAngle - fillSpread) * reach, guard.y + Math.sin(targetAngle - fillSpread) * reach);
    ctx.lineTo(guard.x + Math.cos(targetAngle + fillSpread) * reach, guard.y + Math.sin(targetAngle + fillSpread) * reach);
    ctx.closePath();
    ctx.fillStyle = palette.core;
    ctx.fill();
  }

  if (!blinded && guard.state === 'ALERT') {
    const pulse = 0.45 + 0.35 * Math.sin(time * 12);
    ctx.strokeStyle = `rgba(255,80,80,${pulse.toFixed(3)})`;
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  ctx.restore();
}

// Camera cone uses the same occluded polygon, but a narrow tracking spear and a
// blinking mount so the cyan wedge is unmistakable next to green/amber guard cones.
export function drawCameraCone(ctx, level, camera, time, blinded) {
  const polygon = buildVisionConePolygon(level, camera, 22);
  const palette = getCameraConePalette(camera, blinded);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(polygon[0].x, polygon[0].y);
  for (let index = 1; index < polygon.length; index += 1) ctx.lineTo(polygon[index].x, polygon[index].y);
  ctx.closePath();
  ctx.fillStyle = makeConeGradient(ctx, palette.fill, camera.x, camera.y, camera.coneRange);
  ctx.fill();
  ctx.strokeStyle = palette.edge;
  ctx.lineWidth = 1.4;
  if (blinded) ctx.setLineDash([5, 6]);
  ctx.stroke();
  ctx.setLineDash([]);

  if (camera.seesPlayer && !blinded) {
    const reach = Math.min(camera.coneRange, Math.hypot(camera.playerX - camera.x, camera.playerY - camera.y));
    ctx.beginPath();
    ctx.moveTo(camera.x, camera.y);
    ctx.lineTo(
      camera.x + Math.cos(camera.angle - 0.07) * reach,
      camera.y + Math.sin(camera.angle - 0.07) * reach,
    );
    ctx.lineTo(
      camera.x + Math.cos(camera.angle + 0.07) * reach,
      camera.y + Math.sin(camera.angle + 0.07) * reach,
    );
    ctx.closePath();
    ctx.fillStyle = palette.core;
    ctx.fill();
  }
  ctx.restore();
}
