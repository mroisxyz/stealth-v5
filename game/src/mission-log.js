// mission-log.js — the diagnostic one-liner feed shown in the LEFT sidebar.
// Every entry is a short, explainable sentence ("He heard you on the tile.",
// "False alarm.", "Loot secured.") so the stealth rules are readable at a glance.

const MAX_LINES = 8;

export function createMissionLog() {
  return [];
}

export function pushLog(lines, text, tag = 'sys') {
  if (!text) return;
  lines.unshift({ text, tag });
  if (lines.length > MAX_LINES) lines.length = MAX_LINES;
}

export function seedMissionLog(lines, level) {
  pushLog(lines, `Shift started — ${level.name}.`, 'sys');
  pushLog(lines, 'Aurora Prism reported in the north wing.', 'loot');
  pushLog(lines, 'Cameras sweep on a fixed arc.', 'cam');
}
