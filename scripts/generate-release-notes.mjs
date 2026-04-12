#!/usr/bin/env node
/**
 * Generiert src/generated/release-notes.json aus den Git-Commit-Messages
 * zwischen dem letzten Release-Tag (vX.Y.Z) und HEAD.
 *
 * Wird via `prebuild` und `predev` automatisch ausgeführt. Die erzeugte
 * Datei wird vom WhatsNewModal als Liste der "Was ist neu"-Einträge
 * verwendet, damit das Popup nach jedem Release automatisch die realen
 * Änderungen zeigt — ohne dass Übersetzungsdateien gepflegt werden müssen.
 */
import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const OUT_DIR = resolve(ROOT, 'src/generated');
const OUT_FILE = resolve(OUT_DIR, 'release-notes.json');

const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8'));
const version = pkg.version;

function sh(cmd) {
  try {
    return execSync(cmd, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

// Letzter Release-Tag (vX.Y.Z). Wenn keiner existiert → letzte 30 Commits.
const lastTag = sh('git describe --tags --abbrev=0 --match="v*"');
const range = lastTag ? `${lastTag}..HEAD` : 'HEAD';
const raw = sh(`git log ${range} --no-merges --format=%s%n%H`);

/** @type {{subject: string, sha: string}[]} */
const commits = [];
if (raw) {
  const lines = raw.split('\n');
  for (let i = 0; i < lines.length; i += 2) {
    const subject = lines[i]?.trim();
    const sha = lines[i + 1]?.trim();
    if (subject && sha) commits.push({ subject, sha });
  }
}

// Subjects bereinigen: conventional-commit-Präfix (feat:, fix:, chore: …)
// bleibt erhalten, nur doppelte Einträge und Claude-Session-Links rauswerfen.
const seen = new Set();
const items = [];
for (const { subject, sha } of commits) {
  const clean = subject.replace(/\s+/g, ' ').trim();
  if (!clean) continue;
  if (seen.has(clean.toLowerCase())) continue;
  seen.add(clean.toLowerCase());
  items.push({ message: clean, sha: sha.slice(0, 7) });
  if (items.length >= 30) break;
}

mkdirSync(OUT_DIR, { recursive: true });
const payload = {
  version,
  generatedAt: new Date().toISOString(),
  sinceTag: lastTag || null,
  items,
};
writeFileSync(OUT_FILE, JSON.stringify(payload, null, 2) + '\n', 'utf8');
console.log(
  `[release-notes] v${version}: ${items.length} Commits ` +
    (lastTag ? `seit ${lastTag}` : '(kein Tag gefunden)') +
    ` → ${OUT_FILE.replace(ROOT + '/', '')}`
);
