// Night Shift at the Glasshouse entry builder: copies game/ and screenshots/
// into the grader output directory and writes dossier.json with the vendored,
// unchanged buildDossier. Outside the grader: MAKEFUN_OUTPUT_DIR=out node main.ts

// Authored v5 build note: this pass keeps the proven stealth HUD fully intact while
// upgrading how a scene reads at a glance. Vision cones now use radial-gradient
// falloff so a guard's sight line fades softly toward its edges instead of cutting
// off hard, and the lamp pools are stronger and broader, giving lamp-lit cover more
// presence so light-versus-shadow stays a clear stealth cue across every level.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Authored helper: report the assembled output once, including its byte size.
function reportBuild(outDir: string, bytes: number): void {
  console.log(`Wrote dossier.json in ${outDir} (${bytes} bytes)`);
}

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

const dossier = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(out, 'dossier.json'), dossier);
reportBuild(out, dossier.byteLength);
