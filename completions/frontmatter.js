// Completion inside the YAML frontmatter block:
//   ---
//   title: ...
//   config:
//     theme: dark
//   ---
// and for %%{init: ...}%% directives.
import schema from './config-schema.js';

const TOP = {
  title: { type: 'string', doc: 'Title of the diagram.' },
  config: { children: schema, doc: 'Mermaid configuration for this diagram.' },
};

// Is the cursor inside the frontmatter block? Returns the key path, or null.
export function frontmatterPath(model, pos) {
  const lines = model.getLinesContent();
  if (!/^---\s*$/.test(lines[0] ?? '') || pos.lineNumber < 2) return null;
  const close = lines.findIndex((l, i) => i > 0 && /^---\s*$/.test(l));
  if (close !== -1 && pos.lineNumber > close + 1) return null; // after the block
  if (close !== -1 && pos.lineNumber === close + 1) return null; // on the closing ---

  const cur = lines[pos.lineNumber - 1] ?? '';
  const indent = /^\s*/.exec(cur)[0].length;
  const stack = []; // parents: { indent, key }
  for (let i = 1; i < pos.lineNumber - 1; i++) {
    const m = /^(\s*)([\w.-]+):\s*(.*)$/.exec(lines[i]);
    if (!m) continue;
    const ind = m[1].length;
    while (stack.length && stack[stack.length - 1].indent >= ind) stack.pop();
    if (m[3] === '') stack.push({ indent: ind, key: m[2] });
  }
  while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop();
  return stack.map((s) => s.key);
}

function nodeAt(path) {
  let children = TOP;
  let node = null;
  for (const key of path) {
    node = children?.[key];
    if (!node) return null;
    children = node.children;
  }
  return { node, children: path.length ? node.children : TOP };
}

export function frontmatterItems(ctx, path) {
  const { before, Kind } = ctx;

  // Value: "  theme: <here>"
  let m = /^(\s*)([\w.-]+):\s+([^\s]*)$/.exec(before);
  if (m) {
    const parent = nodeAt(path);
    const node = parent?.children?.[m[2]];
    if (!node) return [];
    const mk = ctx.item(m[3]);
    // Booleans are typed as boolean | null in the schema: offer true and false, not "null".
    const values = node.type === 'boolean'
      ? ['true', 'false', ...(node.values ?? []).filter((v) => v !== 'null')]
      : node.values ?? [];
    return values.map((v, i) => mk(String(v), { kind: Kind.EnumMember, detail: m[2], sort: String(i).padStart(3, '0') }));
  }

  // Key: "  <here>"
  m = /^(\s*)([\w.-]*)$/.exec(before);
  if (m) {
    const at = nodeAt(path);
    const children = at?.children;
    if (!children) return [];
    const mk = ctx.item(m[2]);
    const pad = ' '.repeat(m[1].length + 2);
    return Object.entries(children).map(([key, node]) => {
      const nested = node.children && !node.values && !node.type;
      const insert = nested ? `${key}:\n${pad}` : `${key}: `;
      return mk(key, {
        kind: nested ? Kind.Module : Kind.Property,
        insert,
        detail: node.values ? node.values.slice(0, 4).join(' | ') + (node.values.length > 4 ? ' | ...' : '') : node.type ?? (nested ? 'section' : ''),
        doc: node.doc,
        next: true,
        // Show the common keys first.
        sort: ['title', 'config', 'theme', 'look', 'layout', 'themeVariables'].includes(key) ? '0' + key : '1' + key,
      });
    });
  }
  return [];
}

// "%%{init: ...}%%" directive snippet, offered at the start of a line.
export const INIT_SNIPPET = '%%{init: {"theme": "${1|default,dark,forest,neutral,base|}"}}%%';
