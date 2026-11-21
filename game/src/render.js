// render.js — procedural art and the wide virtual stage: header, two dense sidebars,
// a cover-clipped top-down world and a legend/controls strip beneath the playfield.

import {
  TILE_SIZE, WORLD_WIDTH, WORLD_HEIGHT, VIRTUAL_WIDTH, VIRTUAL_HEIGHT,
  WORLD_VIEW, GUARD_STATE,
} from './level-data.js';
import { drawVisionCone, drawCameraCone } from './vision-cone.js';
import { drawNoiseRings } from './audio-rings.js';
import { getGuardStateLabel } from './guard-ai.js';
import { drawSmokeCloud, isSmokeActive } from './gadgets.js';
import { drawLoot } from './loot.js';
import {
  drawHud, drawBarkBubble, drawDemoMarkers, drawNearMissBanner, drawEndOverlay,
} from './hud.js';

export function createCanvasView(canvas) {
  const ctx = canvas.getContext('2d');
  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;
  let pixelRatio = 1;

  function resize() {
    pixelRatio = Math.min(2, window.devicePixelRatio || 1);
    const cssWidth = canvas.clientWidth || window.innerWidth;
    const cssHeight = canvas.clientHeight || window.innerHeight;
    canvas.width = Math.round(cssWidth * pixelRatio);
    canvas.height = Math.round(cssHeight * pixelRatio);
    scale = Math.min(cssWidth / VIRTUAL_WIDTH, cssHeight / VIRTUAL_HEIGHT);
    offsetX = (cssWidth - VIRTUAL_WIDTH * scale) / 2;
    offsetY = (cssHeight - VIRTUAL_HEIGHT * scale) / 2;
  }

  function applyTransform() {
    ctx.setTransform(pixelRatio * scale, 0, 0, pixelRatio * scale, pixelRatio * offsetX, pixelRatio * offsetY);
  }

  // Convert a browser pointer position into world coordinates through the virtual stage.
  function screenToWorld(clientX, clientY) {
    const bounds = canvas.getBoundingClientRect();
    const virtualX = (clientX - bounds.left - offsetX) / scale;
    const virtualY = (clientY - bounds.top - offsetY) / scale;
    return {
      x: (virtualX - WORLD_VIEW.x) / WORLD_VIEW.scale,
      y: (virtualY - WORLD_VIEW.y) / WORLD_VIEW.scale,
    };
  }

  return { canvas, ctx, resize, applyTransform, screenToWorld };
}

function traceRoundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export function drawFloor(ctx, level) {
  ctx.fillStyle = '#0b1518';
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  for (let row = 0; row < WORLD_HEIGHT / TILE_SIZE; row += 1) {
    for (let column = 0; column < WORLD_WIDTH / TILE_SIZE; column += 1) {
      const alternate = (column + row) % 2 === 0;
      ctx.fillStyle = alternate ? 'rgba(38,72,74,0.16)' : 'rgba(18,42,48,0.16)';
      ctx.fillRect(column * TILE_SIZE, row * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    }
  }
  ctx.strokeStyle = 'rgba(108,196,186,0.075)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let column = 0; column <= WORLD_WIDTH / TILE_SIZE; column += 1) {
    ctx.moveTo(column * TILE_SIZE + 0.5, 0);
    ctx.lineTo(column * TILE_SIZE + 0.5, WORLD_HEIGHT);
  }
  for (let row = 0; row <= WORLD_HEIGHT / TILE_SIZE; row += 1) {
    ctx.moveTo(0, row * TILE_SIZE + 0.5);
    ctx.lineTo(WORLD_WIDTH, row * TILE_SIZE + 0.5);
  }
  ctx.stroke();

  ctx.fillStyle = 'rgba(120,180,150,0.06)';
  for (let index = 0; index < 260; index += 1) {
    const x = (index * 173 + 31) % WORLD_WIDTH;
    const y = (index * 419 + 77) % WORLD_HEIGHT;
    ctx.fillRect(x, y, 2, 2);
  }
}

export function drawLightZones(ctx, level, time) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const light of level.lightsPx) {
    const centerX = light.x + light.w / 2;
    const centerY = light.y + light.h / 2;
    const radius = Math.max(light.w, light.h) * 1.15;
    const gradient = ctx.createRadialGradient(centerX, centerY, 8, centerX, centerY, radius);
    gradient.addColorStop(0, 'rgba(255,211,132,0.30)');
    gradient.addColorStop(0.55, 'rgba(240,175,92,0.16)');
    gradient.addColorStop(1, 'rgba(190,120,60,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(centerX - radius, centerY - radius, radius * 2, radius * 2);

    ctx.beginPath();
    ctx.arc(centerX, centerY, 5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,232,170,0.85)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(centerX, centerY, 14 + Math.sin(time * 2 + centerX) * 1.5, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,214,140,0.20)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.restore();
}

export function drawWalls(ctx, level) {
  for (const wall of level.wallsPx) {
    ctx.fillStyle = 'rgba(4,10,12,0.55)';
    ctx.fillRect(wall.x + 5, wall.y + 6, wall.w, wall.h);
    ctx.fillStyle = '#16262c';
    ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
    ctx.fillStyle = 'rgba(64,142,144,0.12)';
    ctx.fillRect(wall.x + 3, wall.y + 3, Math.max(0, wall.w - 6), Math.max(0, wall.h - 6));
    ctx.strokeStyle = '#3b5c63';
    ctx.lineWidth = 2;
    ctx.strokeRect(wall.x + 1, wall.y + 1, wall.w - 2, wall.h - 2);
    ctx.strokeStyle = 'rgba(126,222,214,0.30)';
    ctx.lineWidth = 1;
    if (wall.w > wall.h) {
      for (let x = wall.x + TILE_SIZE; x < wall.x + wall.w; x += TILE_SIZE) {
        ctx.beginPath(); ctx.moveTo(x, wall.y + 3); ctx.lineTo(x, wall.y + wall.h - 3); ctx.stroke();
      }
      ctx.beginPath(); ctx.moveTo(wall.x + 3, wall.y + 3); ctx.lineTo(wall.x + wall.w - 3, wall.y + 3); ctx.stroke();
    } else {
      for (let y = wall.y + TILE_SIZE; y < wall.y + wall.h; y += TILE_SIZE) {
        ctx.beginPath(); ctx.moveTo(wall.x + 3, y); ctx.lineTo(wall.x + wall.w - 3, y); ctx.stroke();
      }
      ctx.beginPath(); ctx.moveTo(wall.x + 3, wall.y + 3); ctx.lineTo(wall.x + 3, wall.y + wall.h - 3); ctx.stroke();
    }
  }
}

function drawPlanter(ctx, cover) {
  ctx.fillStyle = 'rgba(3,8,8,0.5)';
  ctx.fillRect(cover.x + 5, cover.y + 6, cover.w, cover.h);
  ctx.fillStyle = '#4a3b2a';
  traceRoundedRect(ctx, cover.x, cover.y, cover.w, cover.h, 5);
  ctx.fill();
  ctx.strokeStyle = '#8a6a45';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#263c2d';
  ctx.fillRect(cover.x + 6, cover.y + 6, Math.max(0, cover.w - 12), Math.max(0, cover.h - 12));
  const blobs = Math.max(3, Math.floor((cover.w * cover.h) / 900));
  for (let index = 0; index < blobs; index += 1) {
    const x = cover.x + 14 + ((index * 47) % Math.max(1, cover.w - 26));
    const y = cover.y + 14 + ((index * 29) % Math.max(1, cover.h - 26));
    ctx.beginPath();
    ctx.arc(x, y, 8 + (index % 3) * 2, 0, Math.PI * 2);
    ctx.fillStyle = index % 2 === 0 ? '#3d8a5c' : '#2f704d';
    ctx.fill();
    ctx.fillStyle = 'rgba(150,220,150,0.22)';
    ctx.fillRect(x - 2, y - 4, 3, 2);
  }
}

function drawCrate(ctx, cover) {
  ctx.fillStyle = 'rgba(3,8,8,0.5)';
  ctx.fillRect(cover.x + 5, cover.y + 6, cover.w, cover.h);
  ctx.fillStyle = '#795734';
  ctx.fillRect(cover.x, cover.y, cover.w, cover.h);
  ctx.fillStyle = '#9b7447';
  ctx.fillRect(cover.x + 3, cover.y + 3, Math.max(0, cover.w - 6), Math.max(0, cover.h - 6));
  ctx.strokeStyle = '#4d3520';
  ctx.lineWidth = 3;
  ctx.strokeRect(cover.x + 2, cover.y + 2, cover.w - 4, cover.h - 4);
  ctx.beginPath();
  ctx.moveTo(cover.x + 4, cover.y + 4);
  ctx.lineTo(cover.x + cover.w - 4, cover.y + cover.h - 4);
  ctx.moveTo(cover.x + cover.w - 4, cover.y + 4);
  ctx.lineTo(cover.x + 4, cover.y + cover.h - 4);
  ctx.stroke();
  ctx.fillStyle = '#c9a26a';
  for (const [dx, dy] of [[7, 7], [cover.w - 7, 7], [7, cover.h - 7], [cover.w - 7, cover.h - 7]]) {
    ctx.fillRect(cover.x + dx - 1, cover.y + dy - 1, 2, 2);
  }
}

export function drawCover(ctx, level) {
  for (const cover of level.coverPx) {
    if (cover.kind === 'planter') drawPlanter(ctx, cover);
    else drawCrate(ctx, cover);
  }
}

export function drawExit(ctx, level, time, locked) {
  const exit = level.exitPx;
  const pulse = 0.5 + 0.5 * Math.sin(time * 3.4);
  const color = locked ? '255,150,80' : '94,242,214';
  ctx.save();
  ctx.shadowColor = `rgba(${color},${0.5 + pulse * 0.4})`;
  ctx.shadowBlur = 18 + pulse * 16;
  ctx.fillStyle = `rgba(${color},${0.10 + pulse * 0.14})`;
  traceRoundedRect(ctx, exit.x + 3, exit.y + 3, exit.w - 6, exit.h - 6, 6);
  ctx.fill();
  ctx.strokeStyle = `rgba(${color},${0.65 + pulse * 0.35})`;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.fillStyle = `rgba(${color},0.92)`;
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(locked ? 'LOCKED' : 'EXIT', exit.x + exit.w / 2, exit.y - 10);
  ctx.font = '10px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(210,240,235,0.72)';
  ctx.fillText(locked ? 'NEED THE AURORA PRISM' : 'SERVICE GATE', exit.x + exit.w / 2, exit.y + exit.h + 16);
  const chevrons = locked ? 1 : 3;
  for (let index = 0; index < chevrons; index += 1) {
    const cx = exit.x + exit.w / 2 + (index - (chevrons - 1) / 2) * 17;
    const cy = exit.y + exit.h / 2 + Math.sin(time * 3 + index) * 2;
    ctx.beginPath();
    ctx.moveTo(cx - 5, cy - 6);
    ctx.lineTo(cx + 5, cy);
    ctx.lineTo(cx - 5, cy + 6);
    ctx.strokeStyle = `rgba(${color},0.9)`;
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }
  ctx.restore();
}

export function drawDistractors(ctx, level, time) {
  for (const point of level.distractorsPx) {
    const pulse = 0.6 + 0.4 * Math.sin(time * 2 + point.x * 0.02);
    ctx.save();
    ctx.strokeStyle = `rgba(238,196,110,${(0.55 + pulse * 0.35).toFixed(3)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(point.x, point.y, 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(point.x - 11, point.y); ctx.lineTo(point.x + 11, point.y);
    ctx.moveTo(point.x, point.y - 11); ctx.lineTo(point.x, point.y + 11);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,220,150,0.9)';
    ctx.beginPath();
    ctx.arc(point.x, point.y, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// Wall-mounted camera housing: a cyan bracket with a blinking status LED.
export function drawCameraBodies(ctx, cameras, time, blinded) {
  for (const camera of cameras) {
    ctx.save();
    ctx.translate(camera.x, camera.y);
    ctx.rotate(camera.angle);
    ctx.fillStyle = 'rgba(4,12,16,0.85)';
    ctx.fillRect(-10, -8, 20, 16);
    ctx.strokeStyle = blinded ? 'rgba(170,190,200,0.5)' : 'rgba(110,236,255,0.95)';
    ctx.lineWidth = 2;
    ctx.strokeRect(-10, -8, 20, 16);
    ctx.beginPath();
    ctx.arc(8, 0, 4, 0, Math.PI * 2);
    ctx.fillStyle = blinded
      ? 'rgba(180,195,205,0.6)'
      : camera.seesPlayer
        ? '#ff7676'
        : `rgba(120,245,255,${(0.5 + 0.5 * Math.sin(time * 6 + camera.id)).toFixed(2)})`;
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = blinded ? 'rgba(180,200,210,0.6)' : 'rgba(140,240,255,0.85)';
    ctx.font = '9px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(camera.name, camera.x, camera.y - 16);
    ctx.textAlign = 'left';
  }
}

function guardColor(guard) {
  switch (guard.state) {
    case GUARD_STATE.ALERT: return '#ff5b5f';
    case GUARD_STATE.SEARCH: return '#ffab52';
    case GUARD_STATE.SUSPICIOUS: return '#ffd15e';
    case GUARD_STATE.STAND_DOWN: return '#9cb4b6';
    default: return '#59e6a8';
  }
}

export function drawGuards(ctx, guards, time) {
  for (const guard of guards) {
    const color = guardColor(guard);
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.42)';
    ctx.beginPath();
    ctx.ellipse(guard.x + 3, guard.y + 5, 15, 9, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowColor = color;
    ctx.shadowBlur = guard.state === GUARD_STATE.ALERT ? 20 : 9;
    ctx.beginPath();
    ctx.arc(guard.x, guard.y, 13, 0, Math.PI * 2);
    ctx.fillStyle = '#101c20';
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.beginPath();
    ctx.moveTo(guard.x + Math.cos(guard.angle) * 20, guard.y + Math.sin(guard.angle) * 20);
    ctx.lineTo(guard.x + Math.cos(guard.angle + 2.5) * 10, guard.y + Math.sin(guard.angle + 2.5) * 10);
    ctx.lineTo(guard.x + Math.cos(guard.angle - 2.5) * 10, guard.y + Math.sin(guard.angle - 2.5) * 10);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(guard.x, guard.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#dfeef0';
    ctx.fill();

    if (guard.state !== GUARD_STATE.PATROL) {
      ctx.fillStyle = color;
      ctx.font = 'bold 17px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(getGuardStateLabel(guard), guard.x, guard.y - 20);
    }

    ctx.font = '9px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(226,240,238,0.65)';
    ctx.fillText(guard.name.replace('Warden ', ''), guard.x, guard.y + 27);

    if (guard.state === GUARD_STATE.ALERT) {
      const blink = 0.35 + 0.35 * Math.sin(time * 13);
      ctx.beginPath();
      ctx.arc(guard.x, guard.y, 20 + blink * 5, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255,90,90,${blink.toFixed(2)})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.restore();
  }
}

export function drawPlayer(ctx, player, time) {
  const exposureColor = player.exposure > 0.7 ? '#ff8c6a' : player.exposure > 0.38 ? '#ffd16b' : '#b9fff0';
  ctx.save();
  for (let index = player.trail.length - 1; index >= 0; index -= 2) {
    const point = player.trail[index];
    const alpha = Math.max(0, 0.2 * (1 - point.age * 3));
    if (alpha <= 0) continue;
    ctx.beginPath();
    ctx.arc(point.x, point.y, player.radius * 0.7, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(130,240,220,${alpha.toFixed(3)})`;
    ctx.fill();
  }

  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath();
  ctx.ellipse(player.x + 2, player.y + 4, player.radius + 3, player.radius - 1, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowColor = exposureColor;
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
  ctx.fillStyle = '#e8fffa';
  ctx.fill();
  ctx.strokeStyle = exposureColor;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.shadowBlur = 0;

  ctx.beginPath();
  ctx.moveTo(player.x + Math.cos(player.angle) * (player.radius + 8), player.y + Math.sin(player.angle) * (player.radius + 8));
  ctx.lineTo(player.x + Math.cos(player.angle + 2.3) * (player.radius + 1), player.y + Math.sin(player.angle + 2.3) * (player.radius + 1));
  ctx.lineTo(player.x + Math.cos(player.angle - 2.3) * (player.radius + 1), player.y + Math.sin(player.angle - 2.3) * (player.radius + 1));
  ctx.closePath();
  ctx.fillStyle = '#2b6f7c';
  ctx.fill();

  if (player.crouching) {
    ctx.strokeStyle = 'rgba(150,255,225,0.8)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius + 5, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawVignette(ctx) {
  const gradient = ctx.createRadialGradient(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, 260, WORLD_WIDTH / 2, WORLD_HEIGHT / 2, 820);
  gradient.addColorStop(0, 'rgba(0,0,0,0)');
  gradient.addColorStop(1, 'rgba(2,7,10,0.55)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  ctx.fillStyle = 'rgba(180,230,220,0.018)';
  for (let y = 0; y < WORLD_HEIGHT; y += 4) ctx.fillRect(0, y, WORLD_WIDTH, 1);
}

export function renderScene(view, game) {
  const { ctx, canvas } = view;
  const { level, guards, cameras, player, noiseSystem, gadgets, loot, stats, time } = game;
  const blinded = isSmokeActive(gadgets);
  const alerted = guards.some((guard) => guard.state === GUARD_STATE.ALERT);
  const exitLocked = !loot.secured || alerted;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#04080a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  view.applyTransform();
  ctx.fillStyle = '#060c10';
  ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);

  // The world is painted in its own scaled, clipped viewport between the sidebars.
  ctx.save();
  ctx.beginPath();
  ctx.rect(WORLD_VIEW.x, WORLD_VIEW.y, WORLD_VIEW.w, WORLD_VIEW.h);
  ctx.clip();
  ctx.translate(WORLD_VIEW.x, WORLD_VIEW.y);
  ctx.scale(WORLD_VIEW.scale, WORLD_VIEW.scale);

  drawFloor(ctx, level);
  drawLightZones(ctx, level, time);
  drawWalls(ctx, level);
  drawCover(ctx, level);
  drawExit(ctx, level, time, exitLocked);
  drawDistractors(ctx, level, time);

  for (const camera of cameras) drawCameraCone(ctx, level, camera, time, blinded);
  for (const guard of guards) drawVisionCone(ctx, level, guard, time, blinded);
  drawNoiseRings(ctx, noiseSystem, time);
  drawSmokeCloud(ctx, gadgets, time);
  drawCameraBodies(ctx, cameras, time, blinded);
  drawLoot(ctx, loot, player, time);
  drawGuards(ctx, guards, time);
  drawPlayer(ctx, player, time);
  for (const guard of guards) drawBarkBubble(ctx, guard);
  drawDemoMarkers(ctx, stats.markers, time);
  drawVignette(ctx);
  ctx.restore();

  drawNearMissBanner(ctx, stats.flashTimer, stats.nearMisses);
  drawHud(ctx, game);
  drawEndOverlay(ctx, game);
}
