// Checks that every autocomplete snippet expands to text mermaid.parse() accepts.
// Run with `pnpm check`, for example after upgrading Mermaid.
import { JSDOM } from 'jsdom';

// Mermaid needs a DOM. Option: sequence `box` colors fall back to it when window.CSS is missing.
const { window } = new JSDOM('');
Object.assign(globalThis, { window, document: window.document, Option: window.Option });

const { default: mermaid } = await import('mermaid');
const { expandSnippet: ex } = await import('../completions/util.js');
const { HEADERS } = await import('../completions/headers.js');

const cases = {};
for (const h of HEADERS) if (h.snippet) cases['header ' + h.label] = ex(h.snippet);

// charts.js and structure.js modules build their own full examples.
for (const f of ['charts', 'structure']) {
  for (const m of (await import(`../completions/${f}.js`)).default) Object.assign(cases, m.docs?.() ?? {});
}

// The other modules export SNIPPETS plus a VALIDATE prefix that makes them parse.
const indent = (s) => s.replace(/\n/g, '\n  ');
for (const f of ['flowchart', 'sequence', 'class', 'state', 'er']) {
  const { SNIPPETS, VALIDATE } = await import(`../completions/${f}.js`);
  for (const [label, s] of Object.entries(SNIPPETS)) {
    const [before, after] = VALIDATE.around?.[label] ?? [VALIDATE.prefix, ''];
    cases[`${f} ${label}`] = before + '  ' + indent(ex(s)) + after;
  }
  (VALIDATE.shapeCases ?? []).forEach((text, i) => (cases[`${f} shape ${i}`] = text));
}
const { MEMBER_SNIPPETS } = await import('../completions/class.js');
for (const [label, s] of Object.entries(MEMBER_SNIPPETS)) cases['class member ' + label] = `classDiagram\n  class A {\n    ${ex(s)}\n  }`;

let failed = 0;
for (const [name, text] of Object.entries(cases)) {
  try {
    await mermaid.parse(text);
  } catch (e) {
    failed++;
    console.log(`FAIL ${name}: ${String(e.message ?? e).split('\n')[0]}\n${indent('  ' + text)}\n`);
  }
}
console.log(`${Object.keys(cases).length} snippets, ${failed} failed`);
process.exit(failed ? 1 : 0);
