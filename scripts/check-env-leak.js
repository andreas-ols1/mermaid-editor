// Fails if a value from .env.local appears in a file that git tracks or would add (not ignored).
// The repo is public, so real endpoint, client and model values must stay in .env.local.
// Run with `pnpm check`.
import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

if (!existsSync('.env.local')) process.exit(0);

// The format is a generic word ("openai") that the code itself uses, so it is not checked.
const SKIP_KEYS = new Set(['VITE_AI_FORMAT']);

const needles = [];
for (const raw of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(raw);
  if (!m || SKIP_KEYS.has(m[1])) continue;
  const value = m[2].replace(/\s+#.*$/, '').trim().replace(/^(['"])(.*)\1$/, '$2');
  if (!value) continue;
  needles.push({ key: m[1], value });
  // Also catch partial copies: the host of a URL, and a model name without its vendor prefix.
  try { needles.push({ key: m[1] + ' (host)', value: new URL(value).hostname }); } catch {}
  if (value.includes('/') && !value.includes('://')) needles.push({ key: m[1] + ' (name)', value: value.split('/').pop() });
}

const files = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { encoding: 'utf8' }).split('\0')
  .filter((f) => f && f !== 'pnpm-lock.yaml' && existsSync(f));
const leaks = [];
for (const file of files) {
  const text = readFileSync(file, 'utf8').toLowerCase();
  for (const { key, value } of needles) {
    if (text.includes(value.toLowerCase())) leaks.push(`${file}: contains the value of ${key}`);
  }
}

// Print only the key names, never the values.
if (leaks.length) {
  console.error('Values from .env.local found in files git tracks or would add:\n  ' + leaks.join('\n  '));
  process.exit(1);
}
console.log(`env leak check: ${needles.length} values, ${files.length} files, ok`);
