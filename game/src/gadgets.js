// gadgets.js — three budget points of toys: a 1-point coin and a 2-point smoke canister.
// Coins expand a loud noise ring that pulls a warden toward the landing point; smoke
// blinds every guard and camera cone for five seconds and is visible in the world.

import { spawnNoiseRing } from './audio-rings.js';
import { pushLog } from './mission-log.js';

export const GADGET_BUDGET = 3;
export const COIN_COST = 1;
export const SMOKE_COST = 2;
export const SMOKE_DURATION = 5;

export function createGadgets() {
  return {
    coins: 2,
    smoke: 1,
    budget: GADGET_BUDGET,
    spent: 0,
    smokeTimer: 0,
    smokeX: 0,
    smokeY: 0,
    coinCooldown: 0,
  };
}

export function canAfford(gadgets, cost) {
  return gadgets.spent + cost <= gadgets.budget;
}

// Returns 'ok' | 'empty' | 'budget' | 'cooldown' so the HUD can explain the refusal.
export function throwCoin(gadgets, player, targetX, targetY, noiseSystem, log) {
  if (gadgets.coinCooldown > 0) return 'cooldown';
  if (gadgets.coins <= 0) {
    pushLog(log, 'No coins left.', 'gadget');
    return 'empty';
  }
  if (!canAfford(gadgets, COIN_COST)) {
    pushLog(log, 'Gadget budget spent.', 'gadget');
    return 'budget';
  }
  const distance = Math.hypot(targetX - player.x, targetY - player.y);
  const clamped = Math.min(280, distance);
  const angle = Math.atan2(targetY - player.y, targetX - player.x);
  const landingX = player.x + Math.cos(angle) * clamped;
  const landingY = player.y + Math.sin(angle) * clamped;
  gadgets.coins -= 1;
  gadgets.spent += COIN_COST;
  gadgets.coinCooldown = 0.45;
  spawnNoiseRing(noiseSystem, landingX, landingY, {
    kind: 'distract',
    maxRadius: 340,
    life: 1.8,
    loudness: 1,
  });
  pushLog(log, 'Coin clattered on the tile.', 'noise');
  return 'ok';
}

// Smoke blinds cones globally for five seconds — both wardens and wall cameras.
export function deploySmoke(gadgets, player, log) {
  if (gadgets.smoke <= 0) {
    pushLog(log, 'No smoke canisters left.', 'gadget');
    return false;
  }
  if (!canAfford(gadgets, SMOKE_COST)) {
    pushLog(log, 'Need 2 points for smoke.', 'gadget');
    return false;
  }
  gadgets.smoke -= 1;
  gadgets.spent += SMOKE_COST;
  gadgets.smokeTimer = SMOKE_DURATION;
  gadgets.smokeX = player.x;
  gadgets.smokeY = player.y;
  pushLog(log, 'Smoke deployed — cones blinded.', 'gadget');
  return true;
}

export function updateGadgets(gadgets, deltaTime) {
  gadgets.coinCooldown = Math.max(0, gadgets.coinCooldown - deltaTime);
  gadgets.smokeTimer = Math.max(0, gadgets.smokeTimer - deltaTime);
}

export function isSmokeActive(gadgets) {
  return gadgets.smokeTimer > 0;
}

// Procedural smoke puff: soft radial haze plus drifting rings, no external art.
export function drawSmokeCloud(ctx, gadgets, time) {
  if (gadgets.smokeTimer <= 0) return;
  const { smokeX, smokeY, smokeTimer } = gadgets;
  const strength = Math.min(1, smokeTimer / 0.8);
  const pulse = 1 + Math.sin(time * 2.2) * 0.04;
  const radius = 126 * pulse;
  ctx.save();
  ctx.globalAlpha = 0.62 * strength;
  const gradient = ctx.createRadialGradient(smokeX, smokeY, 8, smokeX, smokeY, radius);
  gradient.addColorStop(0, 'rgba(196,214,218,0.78)');
  gradient.addColorStop(0.55, 'rgba(146,170,180,0.52)');
  gradient.addColorStop(1, 'rgba(120,150,160,0)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(smokeX, smokeY, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(222,238,240,0.30)';
  ctx.lineWidth = 2;
  for (let index = 0; index < 3; index += 1) {
    const swirl = time * 0.8 + index * 2.1;
    ctx.beginPath();
    ctx.arc(
      smokeX + Math.cos(swirl) * 22,
      smokeY + Math.sin(swirl * 1.3) * 18,
      radius * (0.34 + index * 0.2),
      swirl,
      swirl + 4.2,
    );
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(236,248,250,0.85)';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`SMOKE ${smokeTimer.toFixed(1)}s`, smokeX, smokeY - radius - 8);
  ctx.restore();
}
