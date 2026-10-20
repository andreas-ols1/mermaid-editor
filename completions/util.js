// Shared helpers for all completion modules.

// Find the first line with content, ignoring frontmatter, blank lines, comments and %%{init}%% directives.
export function headerInfo(model) {
  const lines = model.getLinesContent();
  let i = 0;
  if (/^---\s*$/.test(lines[0] ?? '')) {
    const close = lines.findIndex((l, idx) => idx > 0 && /^---\s*$/.test(l));
    if (close === -1) return { line: 0, text: '', type: '' }; // still inside frontmatter
    i = close + 1;
  }
  while (i < lines.length && (/^\s*$/.test(lines[i]) || /^\s*%%/.test(lines[i]))) i++;
  const text = lines[i] ?? '';
  const type = /^\s*([A-Za-z][\w-]*)/.exec(text)?.[1] ?? '';
  return { line: i + 1, text, type };
}

// Build the context object that every module receives.
export function makeCtx(monaco, model, pos) {
  const { CompletionItemKind: Kind, CompletionItemInsertTextRule } = monaco.languages;
  const before = model.getValueInRange({
    startLineNumber: pos.lineNumber, startColumn: 1, endLineNumber: pos.lineNumber, endColumn: pos.column,
  });
  const header = headerInfo(model);
  const text = model.getValue();

  // Range that replaces the `typed` characters just before the cursor.
  const range = (typed = '') => ({
    startLineNumber: pos.lineNumber, endLineNumber: pos.lineNumber,
    startColumn: pos.column - typed.length, endColumn: pos.column,
  });

  const ctx = {
    monaco, model, pos, before, text, header, Kind, range,
    // Lines of the diagram body, without the header line.
    isHeaderLine: pos.lineNumber === header.line,
    // item(typed)(label, options) -> completion item
    item: (typed = '') => (label, o = {}) => ({
      label,
      kind: o.kind ?? Kind.Keyword,
      insertText: o.insert ?? label,
      insertTextRules: o.snippet ? CompletionItemInsertTextRule.InsertAsSnippet : undefined,
      range: range(typed),
      detail: o.detail,
      documentation: o.doc,
      sortText: o.sort,
      filterText: o.filter,
      command: o.next ? { id: 'editor.action.triggerSuggest', title: 'Suggest' } : undefined,
    }),
    // Collect captured ids from the document: collect(/^\s*node\s+(\w+)/gm)
    // The line with the cursor is skipped, so a node never suggests itself.
    collect: (re) => [...text.matchAll(re)]
      .filter((m) => model.getPositionAt(m.index).lineNumber !== pos.lineNumber)
      .map((m) => ({ id: m[1], extra: m[2] ?? '' })),
  };
  return ctx;
}

// Expand a snippet into plain text (default values), for validation scripts.
export function expandSnippet(s) {
  return s
    .replace(/\$\{\d+\|((?:\\.|[^|\\])*)\|\}/g, (_, list) => list.split(/(?<!\\),/)[0])
    .replace(/\$\{\d+:([^}]*)\}/g, '$1')
    .replace(/\$\{\d+\}/g, '')
    .replace(/\$\d+/g, '')
    .replace(/\\(.)/g, '$1'); // unescape \\ \| \, \$ \}
}

// Sort helper: keeps the order of an array.
export const order = (list, x) => String(list.indexOf(x)).padStart(3, '0');

// Unique values by key.
export const uniq = (arr, key = (x) => x) => {
  const seen = new Set();
  return arr.filter((x) => (seen.has(key(x)) ? false : seen.add(key(x))));
};

// The line that opened the innermost open "{" block before the cursor ('' when none).
export function openBraceLine(ctx) {
  const stack = [];
  ctx.model.getLinesContent().slice(0, ctx.pos.lineNumber - 1).forEach((line) => {
    const stripped = line.replace(/%%.*$/, '');
    const opens = (stripped.match(/\{/g) ?? []).length;
    const closes = (stripped.match(/\}/g) ?? []).length;
    if (/^\s*\}/.test(stripped)) stack.pop();
    else if (opens > closes) stack.push(stripped);
    else if (closes > opens) stack.pop();
  });
  return stack[stack.length - 1] ?? '';
}

// Turn [label, snippet, detail] entries into snippet completion items.
// `base` is a sort prefix, so groups stay in order.
export function snips(ctx, typed, entries, base = '1') {
  const mk = ctx.item(typed);
  return entries.map(([label, snippet, detail], i) => mk(label, {
    kind: ctx.Kind.Snippet, insert: snippet, snippet: true, detail, sort: base + String(i).padStart(3, '0'),
  }));
}

// Turn a list of [value, detail] into ordered enum items.
export function enums(ctx, typed, values, { next = false, suffix = '' } = {}) {
  const mk = ctx.item(typed);
  return values.map((v, i) => {
    const [value, detail] = Array.isArray(v) ? v : [v, undefined];
    return mk(value, { kind: ctx.Kind.EnumMember, insert: value + suffix, detail, sort: String(i).padStart(3, '0'), next });
  });
}
