// loot.js — the Aurora Prism: a visible gold diamond the player collects with E.
// The exit stays LOCKED until the prism is secured, giving the run a two-step objective.

import { isPlayerNearPoint } from './level-data.js';
import { pushLog } from './mission-log.js';

export const LOOT_PICKUP_RADIUS = 54;

export function createLootState(level) {
  return {
    secured: false,
    x: level.lootPx.x,
    y: level.lootPx.y,
    collectedAt: 0,
  };
}

export function isPlayerNearLoot(lootState, player) {
  return !lootState.secured && isPlayerNearPoint(player, lootState, LOOT_PICKUP_RADIUS);
}

export function tryCollectLoot(lootState, player, log, elapsed) {
  if (lootState.secured || !isPlayerNearLoot(lootState, player)) return false;
  lootState.secured = true;
  lootState.collectedAt = elapsed;
  pushLog(log, 'Loot secured.', 'loot');
  return true;
}

// Faceted gold diamond with a slow spin, a pulsing halo and an E prompt in range.
export function drawLoot(ctx, lootState, player, time) {
  if (lootState.secured) return;
  const { x, y } = lootState;
  const bob = Math.sin(time * 2.4) * 4;
  const pulse = 0.5 + 0.5 * Math.sin(time * 3.2);
  ctx.save();

  ctx.beginPath();
  ctx.arc(x, y, 30 + pulse * 10, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(255,214,102,${(0.22 + pulse * 0.35).toFixed(3)})`;
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 7]);
  ctx.lineDashOffset = -time * 18;
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.shadowColor = '#ffd465';
  ctx.shadowBlur = 16 + pulse * 12;
  ctx.translate(x, y + bob);
  ctx.rotate(Math.sin(time * 1.1) * 0.16);
  ctx.beginPath();
  ctx.moveTo(0, -20);
  ctx.lineTo(14, -5);
  ctx.lineTo(0, 20);
  ctx.lineTo(-14, -5);
  ctx.closePath();
  ctx.fillStyle = '#f5b93c';
  ctx.fill();
  ctx.strokeStyle = '#fff0b0';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(0, -20);
  ctx.lineTo(5, -5);
  ctx.lineTo(0, 20);
  ctx.lineTo(-5, -5);
  ctx.closePath();
  ctx.fillStyle = 'rgba(255,250,215,0.62)';
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.restore();

  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffe59a';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.fillText('AURORA PRISM', x, y - 44 + bob);
  if (isPlayerNearLoot(lootState, player)) {
    ctx.fillStyle = 'rgba(8,18,21,0.9)';
    ctx.fillRect(x - 46, y + 34, 92, 22);
    ctx.strokeStyle = '#ffd465';
    ctx.lineWidth = 1;
    ctx.strokeRect(x - 46, y + 34, 92, 22);
    ctx.fillStyle = '#fff1bc';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.fillText('[E] TAKE PRISM', x, y + 49);
  } else {
    ctx.fillStyle = 'rgba(255,229,154,0.72)';
    ctx.font = '10px system-ui, sans-serif';
    ctx.fillText('E TO COLLECT', x, y + 46 + bob);
  }
  ctx.restore();
}
