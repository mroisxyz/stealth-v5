// hud.js — the dense informational shell that makes every stealth rule legible:
// top header, OBJECTIVES / GADGETS / PROGRESS / MISSION LOG sidebar, DETECTION /
// ALARM / VISIBILITY / NOISE / LOOT / SPOTTED / GOAL / GUARDS / CAMERAS sidebar,
// plus the LEGEND and CONTROLS strip. All coordinates are virtual-stage pixels.

import {
  VIRTUAL_WIDTH, VIRTUAL_HEIGHT, WORLD_VIEW, HEADER_HEIGHT,
  LEFT_SIDEBAR_WIDTH, RIGHT_SIDEBAR_X, RIGHT_SIDEBAR_WIDTH, GUARD_STATE,
} from './level-data.js';
import { getGuardStateLabel, getGuardDiagnostic } from './guard-ai.js';
import { activeCameraCount } from './camera-system.js';

const C = Object.freeze({
  bg: '#071216',
  panel: '#0b1a1f',
  panelAlt: '#0d2026',
  line: 'rgba(110,200,192,0.20)',
  border: 'rgba(104,214,202,0.30)',
  accent: '#6ef0ce',
  gold: '#ffd873',
  cyan: '#6fe4ff',
  red: '#ff6a72',
  amber: '#ffc15f',
  text: '#e8f8f3',
  dim: 'rgba(182,216,210,0.66)',
  faint: 'rgba(150,190,184,0.44)',
});

function roundedRect(ctx, x, y, width, height, radius) {
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

function formatTime(seconds) {
  const whole = Math.floor(seconds);
  return `${String(Math.floor(whole / 60)).padStart(2, '0')}:${String(whole % 60).padStart(2, '0')}`;
}

// Keeps dense diagnostic text inside a 212px sidebar without wrapping.
function fitText(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let result = text;
  while (result.length > 1 && ctx.measureText(`${result}…`).width > maxWidth) {
    result = result.slice(0, -1);
  }
  return `${result}…`;
}

function stateColor(guard) {
  switch (guard.state) {
    case GUARD_STATE.ALERT: return C.red;
    case GUARD_STATE.SEARCH: return C.amber;
    case GUARD_STATE.SUSPICIOUS: return C.gold;
    case GUARD_STATE.STAND_DOWN: return '#a6bfc0';
    default: return C.accent;
  }
}

function meter(ctx, x, y, width, height, fraction, color, track = 'rgba(4,12,15,0.8)') {
  ctx.fillStyle = track;
  ctx.fillRect(x, y, width, height);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, Math.max(0, Math.min(1, fraction)) * width, height);
  ctx.strokeStyle = 'rgba(132,196,188,0.36)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);
}

function sidebarBackground(ctx, x, y, width, height) {
  const gradient = ctx.createLinearGradient(x, y, x, y + height);
  gradient.addColorStop(0, C.panelAlt);
  gradient.addColorStop(1, C.bg);
  ctx.fillStyle = gradient;
  ctx.fillRect(x, y, width, height);
  ctx.fillStyle = C.border;
  if (x === 0) ctx.fillRect(x + width - 1, y, 1, height);
  else ctx.fillRect(x, y, 1, height);
}

function section(ctx, x, y, width, title, color = C.accent) {
  ctx.fillStyle = C.line;
  ctx.fillRect(x + 12, y - 4, width - 24, 1);
  ctx.fillStyle = color;
  ctx.font = 'bold 10px system-ui, sans-serif';
  ctx.fillText(title, x + 13, y + 12);
  return y + 26;
}

function rowLabel(ctx, text, x, y, color = C.dim, font = '10px system-ui, sans-serif') {
  ctx.fillStyle = color;
  ctx.font = font;
  ctx.fillText(text, x, y);
}

function checkbox(ctx, x, y, checked, label, color) {
  ctx.strokeStyle = checked ? color : 'rgba(150,196,188,0.55)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x + 0.5, y - 10.5, 13, 13);
  if (checked) {
    ctx.fillStyle = color;
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.fillText('✓', x + 2, y);
  }
  ctx.fillStyle = checked ? C.text : C.dim;
  ctx.font = checked ? 'bold 11px system-ui, sans-serif' : '11px system-ui, sans-serif';
  ctx.fillText(fitText(ctx, label, 158), x + 21, y);
}

// ---------------------------------------------------------------- HEADER ----
function drawHeader(ctx, game) {
  const { level, stats } = game;
  const gradient = ctx.createLinearGradient(0, 0, 0, HEADER_HEIGHT);
  gradient.addColorStop(0, '#10252b');
  gradient.addColorStop(1, '#08161b');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, VIRTUAL_WIDTH, HEADER_HEIGHT);
  ctx.fillStyle = 'rgba(110,240,206,0.45)';
  ctx.fillRect(0, HEADER_HEIGHT - 2, VIRTUAL_WIDTH, 2);

  ctx.fillStyle = 'rgba(110,240,206,0.10)';
  roundedRect(ctx, 14, 8, 92, 34, 6);
  ctx.fill();
  ctx.strokeStyle = 'rgba(110,240,206,0.45)';
  ctx.lineWidth = 1;
  ctx.stroke();
  rowLabel(ctx, `LEVEL ${level.id} / 3`, 26, 30, C.accent, 'bold 12px system-ui, sans-serif');

  ctx.fillStyle = C.text;
  ctx.font = 'bold 17px system-ui, sans-serif';
  ctx.fillText(level.name, 118, 31);
  ctx.fillStyle = C.faint;
  ctx.font = '10px system-ui, sans-serif';
  ctx.fillText(level.subtitle, 120, 45);

  ctx.fillStyle = C.line;
  ctx.fillRect(330, 9, 1, 34);
  rowLabel(ctx, 'OBJECTIVE', 348, 21, C.gold, 'bold 10px system-ui, sans-serif');
  ctx.fillStyle = C.text;
  ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.fillText(level.objective, 348, 41);

  rowLabel(ctx, 'NEAR MISSES', 976, 20, C.dim);
  ctx.fillStyle = C.gold;
  ctx.font = 'bold 17px system-ui, sans-serif';
  ctx.fillText(String(stats.nearMisses), 976, 40);
  rowLabel(ctx, 'ALARMS', 1064, 20, C.dim);
  ctx.fillStyle = C.red;
  ctx.font = 'bold 17px system-ui, sans-serif';
  ctx.fillText(String(stats.alerts), 1064, 40);

  ctx.fillStyle = 'rgba(110,240,206,0.08)';
  roundedRect(ctx, 1156, 7, 270, 38, 6);
  ctx.fill();
  ctx.strokeStyle = C.border;
  ctx.stroke();
  rowLabel(ctx, 'SHIFT TIME', 1170, 20, C.dim);
  ctx.fillStyle = C.text;
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillText(formatTime(stats.elapsed), 1170, 40);
  rowLabel(ctx, `CAMERAS ${activeCameraCount(game.cameras)}/${game.cameras.length}`, 1296, 20, C.cyan);
  ctx.fillStyle = C.cyan;
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillText(`ALARM ${Math.round(stats.alarm)}%`, 1296, 40);

  if (game.demoMode) {
    ctx.fillStyle = 'rgba(255,214,120,0.14)';
    roundedRect(ctx, 640, 10, 128, 26, 5);
    ctx.fill();
    rowLabel(ctx, `DEMO · ${game.demoMode.toUpperCase()}`, 650, 27, C.gold, 'bold 10px system-ui, sans-serif');
  }
}

// ---------------------------------------------------------- LEFT SIDEBAR ----
function drawObjectives(ctx, game, x, top, width) {
  let y = section(ctx, x, top, width, 'OBJECTIVES', C.gold);
  const lootDone = game.loot.secured;
  checkbox(ctx, x + 13, y + 3, lootDone, 'Take the Aurora Prism', C.gold);
  y += 22;
  rowLabel(ctx, lootDone ? 'LOOT 1/1 ✓' : 'LOOT 0/1 → 1/1', x + 34, y, lootDone ? C.accent : C.gold, 'bold 10px system-ui, sans-serif');
  y += 24;
  checkbox(ctx, x + 13, y + 3, game.won, 'Reach the exit unseen', C.accent);
  y += 22;
  rowLabel(
    ctx,
    game.won ? 'GOAL: EXTRACTED' : lootDone ? 'GOAL: EXTRACT' : 'GOAL: NOT YET → EXTRACT',
    x + 34, y,
    lootDone ? C.accent : C.dim,
    'bold 10px system-ui, sans-serif',
  );
  return y + 22;
}

function drawGadgets(ctx, game, x, top, width) {
  const { gadgets } = game;
  let y = section(ctx, x, top, width, 'GADGETS', C.gold);
  ctx.fillStyle = 'rgba(255,216,120,0.10)';
  roundedRect(ctx, x + 12, y - 8, width - 24, 25, 4);
  ctx.fill();
  rowLabel(ctx, '[Q / CLICK] COIN', x + 18, y + 8, C.text, 'bold 10px system-ui, sans-serif');
  rowLabel(ctx, `×${gadgets.coins} · 1pt`, x + width - 78, y + 8, C.gold, 'bold 10px system-ui, sans-serif');
  y += 34;

  ctx.fillStyle = 'rgba(130,228,255,0.10)';
  roundedRect(ctx, x + 12, y - 8, width - 24, 25, 4);
  ctx.fill();
  rowLabel(ctx, '[S] SMOKE', x + 18, y + 8, C.text, 'bold 10px system-ui, sans-serif');
  rowLabel(ctx, `×${gadgets.smoke} · 2pt`, x + width - 78, y + 8, C.cyan, 'bold 10px system-ui, sans-serif');
  y += 34;

  rowLabel(ctx, `BUDGET ${gadgets.budget} PTS · SPENT ${gadgets.spent}`, x + 16, y, C.dim, 'bold 10px system-ui, sans-serif');
  y += 18;
  if (gadgets.smokeTimer > 0) {
    rowLabel(ctx, `CONES BLINDED ${gadgets.smokeTimer.toFixed(1)}s`, x + 16, y, C.cyan, 'bold 10px system-ui, sans-serif');
  } else {
    rowLabel(ctx, 'CONES ACTIVE · SMOKE READY', x + 16, y, C.faint);
  }
  return y + 14;
}

function drawProgress(ctx, game, x, top, width) {
  let y = section(ctx, x, top, width, 'PROGRESS');
  const defs = game.levelDefinitions;
  for (let index = 0; index < defs.length; index += 1) {
    const definition = defs[index];
    const current = definition.id === game.level.id;
    ctx.fillStyle = current ? 'rgba(110,240,206,0.14)' : 'rgba(255,255,255,0.02)';
    roundedRect(ctx, x + 12, y - 11, width - 24, 19, 4);
    ctx.fill();
    rowLabel(
      ctx,
      `${current ? '▶' : '·'} ${String(definition.id).padStart(2, '0')} ${definition.name}`,
      x + 18, y + 2,
      current ? C.accent : C.faint,
      current ? 'bold 10px system-ui, sans-serif' : '10px system-ui, sans-serif',
    );
    y += 22;
  }
  return y + 8;
}

function drawMissionLog(ctx, game, x, top, width) {
  let y = section(ctx, x, top, width, 'MISSION LOG', C.gold);
  const lines = game.log.slice(0, 8);
  if (lines.length === 0) {
    rowLabel(ctx, 'Awaiting movement…', x + 16, y + 2, C.faint);
    return y + 20;
  }
  const tagColor = { noise: C.gold, loot: C.gold, cam: C.cyan, alarm: C.red, guard: C.accent, gadget: C.cyan };
  for (const line of lines) {
    ctx.fillStyle = tagColor[line.tag] ?? C.dim;
    ctx.fillRect(x + 14, y - 5, 3, 9);
    ctx.fillStyle = line.tag === 'alarm' ? '#ffb0b4' : C.dim;
    ctx.font = '10px system-ui, sans-serif';
    ctx.fillText(fitText(ctx, line.text, width - 44), x + 24, y + 2);
    y += 15;
  }
  return y + 8;
}

function drawShiftReport(ctx, game, x, top, width) {
  let y = section(ctx, x, top, width, 'SHIFT REPORT');
  const { stats } = game;
  const entries = [
    ['NEAR MISSES', String(stats.nearMisses), C.gold],
    ['ALARMS', String(stats.alerts), C.red],
    ['NOISE LEADS', String(stats.noiseInvestigations), C.dim],
    ['CAMERA SPOTS', String(stats.cameraSpots), C.cyan],
    ['ELAPSED', formatTime(stats.elapsed), C.text],
  ];
  for (const [label, value, color] of entries) {
    rowLabel(ctx, label, x + 16, y, C.dim);
    ctx.fillStyle = color;
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(value, x + width - 16, y);
    ctx.textAlign = 'left';
    y += 17;
  }
  return y + 8;
}

function drawLeftSidebar(ctx, game) {
  const x = 0;
  const width = LEFT_SIDEBAR_WIDTH;
  const top = HEADER_HEIGHT;
  sidebarBackground(ctx, x, top, width, VIRTUAL_HEIGHT - top);
  let y = drawObjectives(ctx, game, x, top + 14, width);
  y = drawGadgets(ctx, game, x, y + 16, width);
  y = drawProgress(ctx, game, x, y + 16, width);
  y = drawMissionLog(ctx, game, x, y + 16, width);
  drawShiftReport(ctx, game, x, y + 14, width);

  const tipY = 790;
  ctx.fillStyle = 'rgba(255,216,120,0.08)';
  roundedRect(ctx, 12, tipY, width - 24, 58, 5);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,216,120,0.28)';
  ctx.lineWidth = 1;
  ctx.stroke();
  rowLabel(ctx, 'FIELD NOTE', 20, tipY + 17, C.gold, 'bold 9px system-ui, sans-serif');
  rowLabel(ctx, 'Patrols repeat. Read a cone,', 20, tipY + 34, C.dim, '9px system-ui, sans-serif');
  rowLabel(ctx, 'then cross while it looks away.', 20, tipY + 49, C.dim, '9px system-ui, sans-serif');

  ctx.fillStyle = C.faint;
  ctx.font = '9px system-ui, sans-serif';
  ctx.fillText('NIGHT SHIFT · GLASSHOUSE SECURITY', 14, VIRTUAL_HEIGHT - 14);
}

// --------------------------------------------------------- RIGHT SIDEBAR ----
function globalDetection(game) {
  const alert = game.guards.find((guard) => guard.state === GUARD_STATE.ALERT);
  if (alert) return { label: 'ALERT !', color: C.red, diag: getGuardDiagnostic(alert) };
  const suspicious = game.guards.reduce((best, guard) => (guard.suspicion > best.suspicion ? guard : best), game.guards[0]);
  if (suspicious && suspicious.suspicion > 18) {
    return { label: 'SUSPICIOUS ?', color: C.gold, diag: getGuardDiagnostic(suspicious) };
  }
  return { label: 'CALM', color: C.accent, diag: 'Routine patrol. No contact logged.' };
}

function drawDetection(ctx, game, x, top, width) {
  let y = section(ctx, x, top, width, 'DETECTION', C.red);
  const detection = globalDetection(game);
  ctx.save();
  ctx.shadowColor = detection.color;
  ctx.shadowBlur = 10;
  ctx.fillStyle = detection.color;
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillText(detection.label, x + 13, y + 14);
  ctx.restore();
  y += 22;
  rowLabel(ctx, 'WARDENS + CAMERAS', x + 14, y, C.faint);
  y += 16;
  ctx.fillStyle = C.dim;
  ctx.font = '10px system-ui, sans-serif';
  ctx.fillText(fitText(ctx, detection.diag, width - 28), x + 14, y);
  y += 15;
  ctx.fillStyle = C.faint;
  ctx.font = '9px system-ui, sans-serif';
  ctx.fillText(fitText(ctx, game.log[0]?.text ?? 'No recent contact.', width - 28), x + 14, y);
  return y + 14;
}

function drawAlarm(ctx, game, x, top, width) {
  let y = section(ctx, x, top, width, 'ALARM', C.red);
  const alarm = Math.round(game.stats.alarm);
  const color = alarm > 75 ? C.red : alarm > 35 ? C.gold : C.accent;
  rowLabel(ctx, `${alarm}%`, x + width - 42, y - 1, color, 'bold 11px system-ui, sans-serif');
  meter(ctx, x + 13, y + 5, width - 26, 12, game.stats.alarm / 100, color);
  y += 26;
  rowLabel(ctx, 'CAMERAS FEED IT 3× FASTER', x + 14, y, C.faint, '9px system-ui, sans-serif');
  return y + 14;
}

function drawVisibility(ctx, game, x, top, width) {
  let y = section(ctx, x, top, width, 'VISIBILITY', C.cyan);
  const exposure = game.stats.exposure;
  const label = exposure > 0.55 ? 'EXPOSED' : exposure > 0.3 ? 'PARTLY LIT' : 'IN SHADOW';
  const color = exposure > 0.55 ? C.red : exposure > 0.3 ? C.gold : C.accent;
  rowLabel(ctx, label, x + 13, y + 2, color, 'bold 12px system-ui, sans-serif');
  rowLabel(ctx, `${Math.round(exposure * 100)}%`, x + width - 46, y + 2, color, 'bold 11px system-ui, sans-serif');
  y += 8;
  meter(ctx, x + 13, y + 5, width - 26, 9, exposure, color);
  return y + 24;
}

function drawNoise(ctx, game, x, top, width) {
  let y = section(ctx, x, top, width, 'NOISE', C.gold);
  const activeRings = game.noiseSystem.rings.length;
  const loud = game.player.running || game.noiseSystem.rings.some((ring) => ring.loudness > 0.7);
  rowLabel(ctx, loud ? 'LOUD' : 'SILENT', x + 13, y + 2, loud ? C.gold : C.accent, 'bold 12px system-ui, sans-serif');
  rowLabel(ctx, `${activeRings} rings`, x + width - 62, y + 2, C.dim, 'bold 10px system-ui, sans-serif');
  y += 8;
  meter(ctx, x + 13, y + 5, width - 26, 9, loud ? 0.88 : Math.min(0.5, activeRings * 0.12), loud ? C.gold : C.accent);
  return y + 24;
}

function drawGoals(ctx, game, x, top, width) {
  let y = section(ctx, x, top, width, 'LOOT / GOAL', C.gold);
  rowLabel(ctx, 'LOOT', x + 14, y, C.dim, 'bold 10px system-ui, sans-serif');
  rowLabel(ctx, game.loot.secured ? '1/1 ✓' : '0/1 → 1/1', x + 78, y, game.loot.secured ? C.accent : C.gold, 'bold 11px system-ui, sans-serif');
  y += 19;
  rowLabel(ctx, 'GOAL', x + 14, y, C.dim, 'bold 10px system-ui, sans-serif');
  rowLabel(ctx, game.loot.secured ? 'EXTRACT' : 'NOT YET → EXTRACT', x + 78, y, game.loot.secured ? C.accent : C.dim, 'bold 11px system-ui, sans-serif');
  return y + 16;
}

function drawCounts(ctx, game, x, top, width) {
  let y = section(ctx, x, top, width, 'SPOTTED / CAMERAS', C.cyan);
  const spotted = game.stats.cameraSpots + game.stats.alerts;
  rowLabel(ctx, 'SPOTTED', x + 14, y, C.dim, 'bold 10px system-ui, sans-serif');
  rowLabel(ctx, String(spotted), x + 84, y, spotted > 0 ? C.red : C.accent, 'bold 12px system-ui, sans-serif');
  y += 19;
  rowLabel(ctx, 'CAMERAS', x + 14, y, C.dim, 'bold 10px system-ui, sans-serif');
  rowLabel(ctx, `${activeCameraCount(game.cameras)} ACTIVE / ${game.cameras.length}`, x + 84, y, C.cyan, 'bold 11px system-ui, sans-serif');
  return y + 16;
}

function drawGuardRows(ctx, game, x, top, width) {
  let y = section(ctx, x, top, width, `GUARDS (${game.guards.length})`);
  for (const guard of game.guards.slice(0, 5)) {
    const color = stateColor(guard);
    ctx.fillStyle = 'rgba(255,255,255,0.025)';
    roundedRect(ctx, x + 11, y - 12, width - 22, 28, 4);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.fillText(getGuardStateLabel(guard), x + 16, y + 3);
    ctx.fillStyle = C.text;
    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.fillText(fitText(ctx, guard.name.replace('Warden ', ''), 52), x + 34, y + 2);
    ctx.fillStyle = color;
    ctx.font = '9px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(guard.state, x + width - 16, y + 2);
    ctx.textAlign = 'left';
    meter(ctx, x + 34, y + 7, width - 50, 5, guard.suspicion / 100, color);
    y += 30;
  }
  return y + 6;
}

function drawSensorFeed(ctx, game, x, top, width) {
  let y = section(ctx, x, top, width, 'SENSOR FEED', C.cyan);
  for (const camera of game.cameras) {
    const color = camera.state === 'BLIND' ? C.faint : camera.state === 'TRACK' ? C.red : C.cyan;
    rowLabel(ctx, camera.name, x + 14, y, C.dim, 'bold 10px system-ui, sans-serif');
    ctx.fillStyle = color;
    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(camera.state, x + width - 16, y);
    ctx.textAlign = 'left';
    y += 18;
  }
  const exitLocked = !game.loot.secured || game.guards.some((guard) => guard.state === GUARD_STATE.ALERT);
  rowLabel(ctx, 'EXIT', x + 14, y, C.dim, 'bold 10px system-ui, sans-serif');
  rowLabel(ctx, exitLocked ? 'LOCKED' : 'OPEN', x + width - 62, y, exitLocked ? C.red : C.accent, 'bold 10px system-ui, sans-serif');
  y += 18;
  rowLabel(ctx, 'SMOKE', x + 14, y, C.dim, 'bold 10px system-ui, sans-serif');
  rowLabel(ctx, game.gadgets.smokeTimer > 0 ? `${game.gadgets.smokeTimer.toFixed(1)}s` : 'READY', x + width - 62, y, C.cyan, 'bold 10px system-ui, sans-serif');
  return y + 12;
}

function drawRightSidebar(ctx, game) {
  const x = RIGHT_SIDEBAR_X;
  const width = RIGHT_SIDEBAR_WIDTH;
  sidebarBackground(ctx, x, HEADER_HEIGHT, width, VIRTUAL_HEIGHT - HEADER_HEIGHT);
  let y = drawDetection(ctx, game, x, HEADER_HEIGHT + 14, width);
  y = drawAlarm(ctx, game, x, y + 12, width);
  y = drawVisibility(ctx, game, x, y + 12, width);
  y = drawNoise(ctx, game, x, y + 12, width);
  y = drawGoals(ctx, game, x, y + 12, width);
  y = drawCounts(ctx, game, x, y + 12, width);
  y = drawGuardRows(ctx, game, x, y + 12, width);
  drawSensorFeed(ctx, game, x, y + 10, width);

  const sourceY = 812;
  section(ctx, x, sourceY, width, 'ALARM SOURCES', C.red);
  rowLabel(ctx, 'CAMERA SIGHT  +34/s', x + 14, sourceY + 22, C.cyan, '9px system-ui, sans-serif');
  rowLabel(ctx, 'GUARD GAZE    +9/s', x + 14, sourceY + 39, C.gold, '9px system-ui, sans-serif');
  rowLabel(ctx, 'NO CONTACT    -8/s', x + 14, sourceY + 56, C.accent, '9px system-ui, sans-serif');
}

// ------------------------------------------------------ LEGEND / CONTROLS ----
function legendSwatch(ctx, x, y, kind) {
  ctx.save();
  ctx.translate(x, y);
  if (kind === 'cone') {
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(20, -7); ctx.lineTo(20, 7); ctx.closePath();
    ctx.fillStyle = 'rgba(96,232,170,0.30)';
    ctx.fill();
    ctx.strokeStyle = '#60e8aa';
    ctx.lineWidth = 1;
    ctx.stroke();
  } else if (kind === 'camera') {
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(20, -7); ctx.lineTo(20, 7); ctx.closePath();
    ctx.fillStyle = 'rgba(90,220,255,0.30)';
    ctx.fill();
    ctx.strokeStyle = C.cyan;
    ctx.stroke();
  } else if (kind === 'cover') {
    ctx.fillStyle = '#795734';
    ctx.fillRect(0, -7, 18, 14);
    ctx.strokeStyle = '#b78a55';
    ctx.strokeRect(0.5, -6.5, 17, 13);
  } else if (kind === 'loot') {
    ctx.beginPath();
    ctx.moveTo(9, -9); ctx.lineTo(17, 0); ctx.lineTo(9, 9); ctx.lineTo(1, 0); ctx.closePath();
    ctx.fillStyle = '#f5b93c';
    ctx.fill();
    ctx.strokeStyle = '#fff0b0';
    ctx.stroke();
  } else if (kind === 'exit') {
    ctx.strokeStyle = C.accent;
    ctx.lineWidth = 2;
    ctx.strokeRect(1, -7, 16, 14);
    ctx.fillStyle = C.accent;
    ctx.font = 'bold 9px system-ui, sans-serif';
    ctx.fillText('→', 4, 3);
  } else if (kind === 'noise') {
    ctx.strokeStyle = C.gold;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.arc(9, 0, 9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.restore();
}

function drawLegendStrip(ctx, game) {
  const top = 672;
  const leftX = 204;
  const leftW = 504;
  const rightX = 716;
  const rightW = 508;
  const height = 118;

  ctx.fillStyle = C.panel;
  roundedRect(ctx, leftX, top, leftW, height, 6);
  ctx.fill();
  ctx.strokeStyle = C.border;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = C.panel;
  roundedRect(ctx, rightX, top, rightW, height, 6);
  ctx.fill();
  ctx.stroke();

  rowLabel(ctx, 'LEGEND', leftX + 14, top + 18, C.accent, 'bold 10px system-ui, sans-serif');
  const items1 = [
    ['cone', 'Guard cone'], ['camera', 'Camera sweep'], ['cover', 'Cover blocks sight'],
    ['loot', 'Aurora Prism'], ['exit', 'Exit (needs loot)'], ['noise', 'Coin noise ring'],
  ];
  items1.forEach(([kind, label], index) => {
    const column = index % 3;
    const row = Math.floor(index / 3);
    const x = leftX + 14 + column * 164;
    const y = top + 42 + row * 30;
    legendSwatch(ctx, x, y, kind);
    ctx.fillStyle = C.dim;
    ctx.font = '10px system-ui, sans-serif';
    ctx.fillText(label, x + 27, y + 4);
  });
  rowLabel(ctx, 'COVER CLIPS BOTH CONE TYPES', leftX + 14, top + 106, C.faint, '9px system-ui, sans-serif');
  rowLabel(ctx, '· SMOKE BLINDS ALL CONES FOR 5s', leftX + 182, top + 106, C.faint, '9px system-ui, sans-serif');

  rowLabel(ctx, 'CONTROLS', rightX + 14, top + 18, C.gold, 'bold 10px system-ui, sans-serif');
  rowLabel(ctx, 'W/A/D or ARROWS move  ·  SHIFT run (loud)  ·  CTRL / C crouch', rightX + 14, top + 40, C.dim, '10px system-ui, sans-serif');
  rowLabel(ctx, 'E take the Aurora Prism  ·  E near a cache picks up a coin', rightX + 14, top + 62, C.dim, '10px system-ui, sans-serif');
  rowLabel(ctx, 'Q / LEFT CLICK / RIGHT CLICK coin (1pt)  ·  S smoke (2pt, 5s)', rightX + 14, top + 84, C.dim, '10px system-ui, sans-serif');
  rowLabel(ctx, 'R restart  ·  1 / 2 / 3 choose level  ·  HOLD left mouse to walk', rightX + 14, top + 106, C.faint, '10px system-ui, sans-serif');
}

// ----------------------------------------------------------------- HUD API --
export function drawHud(ctx, game) {
  drawHeader(ctx, game);
  drawLeftSidebar(ctx, game);
  drawRightSidebar(ctx, game);
  drawLegendStrip(ctx, game);
}

export function drawBarkBubble(ctx, guard) {
  if (guard.barkTimer <= 0 || !guard.bark) return;
  ctx.save();
  ctx.font = 'bold 12px system-ui, sans-serif';
  const width = ctx.measureText(guard.bark).width + 22;
  const x = guard.x - width / 2;
  const y = guard.y - 64;
  const alpha = Math.min(1, guard.barkTimer * 2);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = 'rgba(8,18,21,0.9)';
  roundedRect(ctx, x, y - 19, width, 26, 7);
  ctx.fill();
  ctx.strokeStyle = guard.state === GUARD_STATE.ALERT ? '#ff6a6a' : '#e7d58b';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(guard.x - 5, y + 7);
  ctx.lineTo(guard.x, y + 15);
  ctx.lineTo(guard.x + 5, y + 7);
  ctx.fillStyle = 'rgba(8,18,21,0.9)';
  ctx.fill();
  ctx.fillStyle = '#f6f0d6';
  ctx.textAlign = 'center';
  ctx.fillText(guard.bark, guard.x, y);
  ctx.restore();
}

export function drawDemoMarkers(ctx, markers, time) {
  if (!markers || markers.length === 0) return;
  for (let index = 0; index < markers.length; index += 1) {
    const marker = markers[index];
    const pulse = 0.5 + 0.5 * Math.sin(time * 3.4 + index);
    ctx.save();
    ctx.beginPath();
    ctx.arc(marker.x, marker.y, 18 + pulse * 8, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255,216,120,${(0.3 + pulse * 0.4).toFixed(3)})`;
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 5]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.translate(marker.x, marker.y);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#ffd873';
    ctx.shadowColor = '#ffd873';
    ctx.shadowBlur = 12;
    ctx.fillRect(-7, -7, 14, 14);
    ctx.restore();
    ctx.fillStyle = '#18201b';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(marker.label, marker.x, marker.y + 4);
    ctx.textAlign = 'left';
  }
}

export function drawNearMissBanner(ctx, flashTimer, nearMisses) {
  if (flashTimer <= 0) return;
  const centerX = WORLD_VIEW.x + WORLD_VIEW.w / 2;
  ctx.save();
  ctx.globalAlpha = Math.min(1, flashTimer / 0.6);
  ctx.textAlign = 'center';
  ctx.shadowColor = '#ffb545';
  ctx.shadowBlur = 18;
  ctx.fillStyle = '#ffd47a';
  ctx.font = 'bold 32px system-ui, sans-serif';
  ctx.fillText('NEAR MISS', centerX, WORLD_VIEW.y + 92);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#fff0c8';
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.fillText(`HE ALMOST SAW YOU · ${nearMisses} TOTAL`, centerX, WORLD_VIEW.y + 114);
  ctx.restore();
}

export function drawEndOverlay(ctx, game) {
  if (!game.won && !game.lost) return;
  const won = game.won;
  const cx = WORLD_VIEW.x + WORLD_VIEW.w / 2;
  const cy = WORLD_VIEW.y + WORLD_VIEW.h / 2;
  ctx.save();
  ctx.fillStyle = 'rgba(3,9,12,0.72)';
  ctx.fillRect(WORLD_VIEW.x, WORLD_VIEW.y, WORLD_VIEW.w, WORLD_VIEW.h);
  roundedRect(ctx, cx - 270, cy - 130, 540, 264, 14);
  ctx.fillStyle = 'rgba(9,22,26,0.97)';
  ctx.fill();
  ctx.strokeStyle = won ? C.accent : C.red;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.shadowColor = won ? C.accent : C.red;
  ctx.shadowBlur = 16;
  ctx.fillStyle = won ? '#9fffe3' : '#ff8d8d';
  ctx.font = 'bold 34px system-ui, sans-serif';
  ctx.fillText(won ? 'SHIFT COMPLETE' : 'SPOTTED', cx, cy - 76);
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(214,238,232,0.88)';
  ctx.font = '14px system-ui, sans-serif';
  ctx.fillText(
    won ? 'Aurora Prism secured. Extraction clean.' : 'A warden confirmed your position. Try a quieter route.',
    cx, cy - 46,
  );

  const stats = game.stats;
  ctx.fillStyle = C.gold;
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillText(`LOOT ${game.loot.secured ? '1/1' : '0/1'}   NEAR MISSES ${stats.nearMisses}   ALARMS ${stats.alerts}`, cx, cy - 10);
  ctx.fillStyle = C.dim;
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText(`TIME ${formatTime(stats.elapsed)}   CAMERA SPOTS ${stats.cameraSpots}   COINS LEFT ${game.gadgets.coins}`, cx, cy + 16);
  ctx.fillStyle = C.accent;
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.fillText('R RETRY  ·  1 / 2 / 3 CHOOSE LEVEL', cx, cy + 62);
  ctx.restore();
}
