// Autocomplete entry point. Picks the right module for the cursor position.
import { makeCtx } from './util.js';
import { HEADERS, FRONTMATTER_SNIPPET } from './headers.js';
import { frontmatterPath, frontmatterItems, INIT_SNIPPET } from './frontmatter.js';
import architecture from './architecture.js';
import flowchart from './flowchart.js';
import sequence from './sequence.js';
import classDiagram from './class.js';
import state from './state.js';
import er from './er.js';
import charts from './charts.js';
import structure from './structure.js';

// Each module: { matches: RegExp for the diagram type word, provide(ctx) -> items | null }
const MODULES = [architecture, flowchart, sequence, classDiagram, state, er, ...charts, ...structure];

export function registerCompletions(monaco, packs) {
  const mods = MODULES.map((m) => (m.init ? m.init(monaco, packs) ?? m : m));

  monaco.languages.registerCompletionItemProvider('mermaid', {
    triggerCharacters: ['(', ':', ' ', '-', '>', '<', '[', '{', '|', '"', '.', '/', ',', '@', '%', '=', '+'],
    async provideCompletionItems(model, pos) {
      const ctx = makeCtx(monaco, model, pos);
      const { Kind, before } = ctx;
      const done = (suggestions) => ({ suggestions });

      // 1. YAML frontmatter
      const path = frontmatterPath(model, pos);
      if (path) return done(frontmatterItems(ctx, path));

      // 2. Diagram header (first content line)
      if ((ctx.isHeaderLine || ctx.header.line === 0) && /^[\w-]*$/.test(before)) {
        const mk = ctx.item(before);
        const items = HEADERS.map((h) => mk(h.label, {
          kind: Kind.Class, insert: h.snippet ?? h.label, snippet: !!h.snippet, detail: h.detail,
        }));
        if (pos.lineNumber === 1) {
          items.push(mk('---', { kind: Kind.Snippet, insert: FRONTMATTER_SNIPPET, snippet: true, detail: 'frontmatter config', filter: '---' }));
        }
        items.push(mk('%%{init', { kind: Kind.Snippet, insert: INIT_SNIPPET, snippet: true, detail: 'init directive', filter: '%%{init', sort: 'zz' }));
        return done(items);
      }

      // 3. Diagram-specific module
      const mod = mods.find((m) => m.matches.test(ctx.header.type));
      const items = (await mod?.provide(ctx)) ?? []; // provide may return a Promise (architecture icons)

      // 4. Directive and comment starters on an empty line
      if (/^\s*(%|%%\{?\w*)?$/.test(before) && /^\s*%/.test(before)) {
        const mk = ctx.item(/%.*$/.exec(before)?.[0] ?? '');
        items.push(mk('%%{init', { kind: Kind.Snippet, insert: INIT_SNIPPET, snippet: true, detail: 'init directive', filter: '%%{init', sort: '0' }));
        items.push(mk('%% comment', { kind: Kind.Snippet, insert: '%% ${1:comment}', snippet: true, detail: 'comment', filter: '%%' }));
      }
      return done(items);
    },
  });
}
