// audio-rings.js — sound made visible. Footsteps, coins and smoke expand as world-space rings.
// v2 note: the 'smoke' kind is drawn in pale grey so it reads differently from a coin.

export function createNoiseRingSystem() {
  return { rings: [], nextRingId: 1 };
}

export function spawnNoiseRing(system, x, y, options = {}) {
  const ring = {
    id: system.nextRingId,
    x,
    y,
    age: 0,
    life: options.life ?? 1,
    maxRadius: options.maxRadius ?? 120,
    loudness: options.loudness ?? 0.5,
    kind: options.kind ?? 'step',
    heardBy: new Set(),
  };
  system.nextRingId += 1;
  system.rings.push(ring);
  return ring;
}

export function updateNoiseRings(system, deltaTime) {
  for (const ring of system.rings) ring.age += deltaTime;
  system.rings = system.rings.filter((ring) => ring.age < ring.life);
}

export function getRingCurrentRadius(ring) {
  const progress = Math.min(1, ring.age / ring.life);
  const eased = 1 - (1 - progress) * (1 - progress);
  return 6 + ring.maxRadius * eased;
}

export function drawNoiseRings(ctx, system, time) {
  for (const ring of system.rings) {
    const progress = Math.min(1, ring.age / ring.life);
    const radius = getRingCurrentRadius(ring);
    const alpha = (1 - progress) * (ring.kind === 'distract' ? 0.75 : 0.45);
    const rgb = ring.kind === 'distract'
      ? '255,205,90'
      : ring.kind === 'smoke'
        ? '198,218,224'
        : '210,238,235';

    ctx.save();
    ctx.beginPath();
    ctx.arc(ring.x, ring.y, radius, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(${rgb},${alpha.toFixed(3)})`;
    ctx.lineWidth = ring.kind === 'distract' ? 2.6 : 1.8;
    ctx.setLineDash(ring.kind === 'distract' ? [9, 7] : []);
    ctx.lineDashOffset = -time * 24;
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.beginPath();
    ctx.arc(ring.x, ring.y, Math.max(2, radius * 0.22), 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${rgb},${(alpha * 0.22).toFixed(3)})`;
    ctx.fill();

    if (ring.kind === 'distract') {
      ctx.fillStyle = `rgba(255,215,110,${Math.min(1, alpha + 0.2).toFixed(3)})`;
      ctx.font = 'bold 14px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('!', ring.x, ring.y + 5);
    }
    ctx.restore();
  }
}
