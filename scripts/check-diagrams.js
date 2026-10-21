// Checks loadDiagrams (diagrams.js): the only code that decides what happens to saved diagrams.
// Run with `pnpm check`.
import assert from 'node:assert/strict';
import { loadDiagrams } from '../diagrams.js';

// A fake localStorage over a plain object, so each case can look at what was written.
const storage = (data = {}) => ({ data, getItem: (k) => data[k] ?? null, setItem: (k, v) => { data[k] = String(v); } });
const a = { id: 'a', name: 'A', text: 'flowchart LR\n  A' };
const b = { id: 'b', name: 'B', text: 'pie' };

const cases = {
  'empty storage starts with the default text'() {
    const { diagrams, current } = loadDiagrams(storage(), 'DEFAULT');
    assert.equal(diagrams.length, 1);
    assert.equal(current.text, 'DEFAULT');
  },
  'the old diagram key becomes the first diagram'() {
    const { current } = loadDiagrams(storage({ diagram: 'old text' }), 'DEFAULT');
    assert.equal(current.text, 'old text');
  },
  'a saved list and current id are restored'() {
    const { diagrams, current } = loadDiagrams(storage({ diagrams: JSON.stringify([a, b]), current: 'b' }), 'DEFAULT');
    assert.deepEqual(diagrams, [a, b]);
    assert.equal(current, diagrams[1]);
  },
  'an unknown current id falls back to the first diagram'() {
    const { current } = loadDiagrams(storage({ diagrams: JSON.stringify([a, b]), current: 'gone' }), 'DEFAULT');
    assert.equal(current.id, 'a');
  },
  'an empty list starts over without a backup'() {
    const s = storage({ diagrams: '[]' });
    assert.equal(loadDiagrams(s, 'DEFAULT').diagrams.length, 1);
    assert.equal(s.data['diagrams-broken'], undefined);
  },
};
// Unreadable lists are copied to diagrams-broken before anything can overwrite them.
for (const [name, raw] of [['broken JSON', '[{"id":'], ['not a list', '{}'], ['an item without text', '[{"id":"x","name":"X"}]']]) {
  cases[`${name} is kept in diagrams-broken`] = () => {
    const s = storage({ diagrams: raw, diagram: 'old text' });
    const { current } = loadDiagrams(s, 'DEFAULT');
    assert.equal(s.data['diagrams-broken'], raw);
    assert.equal(current.text, 'old text');
  };
}

let failed = 0;
for (const [name, run] of Object.entries(cases)) {
  try { run(); } catch (e) { failed++; console.log(`FAIL ${name}: ${e.message}`); }
}
console.log(`${Object.keys(cases).length} diagram storage cases, ${failed} failed`);
process.exit(failed ? 1 : 0);
