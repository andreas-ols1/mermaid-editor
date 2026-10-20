// flowchart / graph completions.
import schema from './config-schema.js';
import { uniq } from './util.js';

const DIRECTIONS = [['TB', 'top to bottom'], ['TD', 'top down (same as TB)'], ['BT', 'bottom to top'], ['LR', 'left to right'], ['RL', 'right to left']];

// [arrow, description]. Every arrow is checked with mermaid.parse().
const ARROWS = [
  ['-->', 'arrow'], ['---', 'open link'], ['-.->', 'dotted arrow'], ['-.-', 'dotted link'],
  ['==>', 'thick arrow'], ['===', 'thick link'], ['--o', 'circle end'], ['--x', 'cross end'],
  ['<-->', 'arrows on both ends'], ['o--o', 'circles on both ends'], ['x--x', 'crosses on both ends'],
  ['~~~', 'invisible link (only for layout)'], ['---->', 'longer arrow (one more rank)'],
];
const LABELED_ARROWS = [
  ['-->|text|', '-->|${1:text}|', 'arrow with a label'],
  ['-- text -->', '-- ${1:text} -->', 'arrow with a label (long form)'],
  ['-. text .->', '-. ${1:text} .->', 'dotted arrow with a label'],
  ['== text ==>', '== ${1:text} ==>', 'thick arrow with a label'],
  ['e1@-->', '${1:e1}@-->', 'arrow with an id (for animation or curve)'],
];

// [label, snippet, description]
const SHAPES = [
  ['[text]', '${1:id}[${2:text}]', 'rectangle'],
  ['(text)', '${1:id}(${2:text})', 'rounded'],
  ['([text])', '${1:id}([${2:text}])', 'stadium'],
  ['[[text]]', '${1:id}[[${2:text}]]', 'subroutine'],
  ['[(text)]', '${1:id}[(${2:text})]', 'cylinder (database)'],
  ['((text))', '${1:id}((${2:text}))', 'circle'],
  ['(((text)))', '${1:id}(((${2:text})))', 'double circle'],
  ['>text]', '${1:id}>${2:text}]', 'asymmetric'],
  ['{text}', '${1:id}{${2:text}}', 'diamond (decision)'],
  ['{{text}}', '${1:id}{{${2:text}}}', 'hexagon'],
  ['[/text/]', '${1:id}[/${2:text}/]', 'parallelogram'],
  ['[\\text\\]', '${1:id}[\\\\${2:text}\\\\]', 'parallelogram (alt)'],
  ['[/text\\]', '${1:id}[/${2:text}\\\\]', 'trapezoid'],
  ['[\\text/]', '${1:id}[\\\\${2:text}/]', 'trapezoid (alt)'],
];

// Names for @{ shape: ... }. Each name is checked with mermaid.parse().
const SHAPE_NAMES = [
  ['rect', 'process'], ['rounded', 'event'], ['stadium', 'terminal point'], ['fr-rect', 'subprocess'],
  ['cyl', 'database'], ['circle', 'start'], ['dbl-circ', 'double circle'], ['diam', 'decision'],
  ['hex', 'prepare'], ['lean-r', 'input/output'], ['lean-l', 'output/input'], ['trap-b', 'priority action'],
  ['trap-t', 'manual operation'], ['odd', 'asymmetric'], ['sl-rect', 'manual input'], ['doc', 'document'],
  ['docs', 'multiple documents'], ['st-rect', 'multiple processes'], ['delay', 'delay'], ['h-cyl', 'direct access storage'],
  ['lin-cyl', 'disk storage'], ['curv-trap', 'display'], ['div-rect', 'divided process'], ['tri', 'extract'],
  ['win-pane', 'internal storage'], ['f-circ', 'junction'], ['lin-doc', 'lined document'], ['notch-pent', 'loop limit'],
  ['flip-tri', 'manual file'], ['text', 'text block'], ['brace', 'comment (left brace)'], ['brace-r', 'comment (right brace)'],
  ['braces', 'comment (both braces)'], ['bolt', 'communication link'], ['cross-circ', 'summary'], ['fork', 'fork or join'],
  ['hourglass', 'collate'], ['lin-rect', 'lined process'], ['notch-rect', 'card'], ['bow-rect', 'stored data'],
  ['tag-doc', 'tagged document'], ['tag-rect', 'tagged process'], ['sm-circ', 'small start'],
];

export const STYLE_PROPS = [
  ['fill', 'background color'], ['stroke', 'border color'], ['stroke-width', 'border width'],
  ['stroke-dasharray', 'dashed border, e.g. 5 5'], ['color', 'text color'], ['font-size', 'text size'],
  ['font-weight', 'bold, normal, 700 ...'], ['font-style', 'italic, normal'], ['font-family', 'font'], ['opacity', '0 to 1'],
];

const KEYWORDS = new Set(['subgraph', 'end', 'direction', 'classDef', 'class', 'style', 'linkStyle', 'click', 'flowchart', 'graph', 'flowchart-elk',
  'TB', 'TD', 'BT', 'LR', 'RL', 'default', 'call', 'href', 'callback', 'shape', 'label', 'icon', 'img', 'animate', 'animation', 'curve']);
const LINE_KEYWORD = /^\s*(subgraph|end|direction|classDef|class|style|linkStyle|click)\b/;

// Remove everything that is not an id: labels, shapes, comments, classes.
function stripLine(line) {
  let s = line.replace(/%%.*$/, '').replace(/@\{[^}]*\}/g, ' ').replace(/:::[\w-]+/g, ' ').replace(/"[^"]*"/g, ' ').replace(/\|[^|]*\|/g, ' ');
  s = s.replace(/\[[^\]]*\]/g, ' ').replace(/>[^\]\n]*\]/g, ' ');
  for (let prev; prev !== s;) { prev = s; s = s.replace(/\([^()]*\)/g, ' ').replace(/\{[^{}]*\}/g, ' '); }
  return s;
}

function nodesIn(ctx) {
  const lines = ctx.model.getLinesContent();
  const labels = new Map();
  const ids = [];
  lines.forEach((line, i) => {
    if (i + 1 === ctx.pos.lineNumber || i + 1 === ctx.header.line) return;
    const sub = /^\s*subgraph\s+([A-Za-z_]\w*)/.exec(line);
    if (sub) { ids.push(sub[1]); return; }
    if (LINE_KEYWORD.test(line)) return;
    for (const m of line.matchAll(/([A-Za-z_]\w*)\s*(?:\[\[|\[\(|\(\(\(|\(\(|\(\[|\{\{|\[|\(|\{|>)\s*["`]*([^\]\)\}"`]*)/g)) {
      if (!labels.has(m[1])) labels.set(m[1], m[2].trim());
    }
    for (const t of stripLine(line).matchAll(/[A-Za-z_]\w*/g)) if (!KEYWORDS.has(t[0])) ids.push(t[0]);
  });
  return uniq(ids).map((id) => ({ id, label: labels.get(id) ?? '' }));
}

// Node shape templates are offered on an empty word, or when the user types "new".
const showShapes = (typed) => typed === '' || 'new'.startsWith(typed);

const classesIn = (ctx) => ctx.collect(/^\s*classDef\s+([\w-]+)/gm).map((c) => c.id);

const ARROW_TOKEN = /^(?:[<xo]-{2,}[>xo-]?|[<xo]?(?:-{2,}|={2,}|-\.+)-?[>xo]?|~{3,})(?:\|[^|]*\|)?$/;

export const SNIPPETS = {
  subgraph: 'subgraph ${1:id} [${2:Title}]\n    direction ${3|TB,BT,LR,RL|}\n    ${4:A} --> ${5:B}\nend',
  classDef: 'classDef ${1:name} fill:${2:#f96},stroke:${3:#333},stroke-width:${4:2px}',
  class: 'class ${1:A,B} ${2:name}',
  style: 'style ${1:A} fill:${2:#f9f},stroke:${3:#333},stroke-width:${4:2px}',
  linkStyle: 'linkStyle ${1:0} stroke:${2:#ff3},stroke-width:${3:2px}',
  click: 'click ${1:A} href "${2:https://example.com}" ${3|_blank,_self,_parent,_top|}',
  clickCallback: 'click ${1:A} callback "${2:tooltip}"',
  animate: '${1:e1}@{ animate: true }',
};
export const VALIDATE = { prefix: 'flowchart LR\n  A --> B\n  A --> C\n', shapeCases: SHAPE_NAMES.map(([n]) => `flowchart LR\n  A@{ shape: ${n}, label: "x" }`) };
export const EXPORTS_FOR_TESTS = { ARROWS, LABELED_ARROWS, SHAPES, SHAPE_NAMES, ARROW_TOKEN };

export default {
  matches: /^(flowchart|graph)/,

  provide(ctx) {
    const { before, Kind } = ctx;
    let m;
    const props = (typed) => STYLE_PROPS.map(([p, d], i) => ctx.item(typed)(p, { kind: Kind.Property, insert: p + ':', detail: d, sort: String(i).padStart(2, '0') }));

    // Header direction: "flowchart <here>"
    if (ctx.isHeaderLine && (m = /^\s*(?:flowchart(?:-elk)?|graph)\s+(\w*)$/.exec(before))) {
      const mk = ctx.item(m[1]);
      return DIRECTIONS.map(([d, desc], i) => mk(d, { kind: Kind.EnumMember, detail: desc, sort: String(i) }));
    }
    // direction inside a subgraph
    if ((m = /^\s*direction\s+(\w*)$/.exec(before))) {
      const mk = ctx.item(m[1]);
      return DIRECTIONS.filter(([d]) => d !== 'TD').map(([d, desc], i) => mk(d, { kind: Kind.EnumMember, detail: desc, sort: String(i) }));
    }

    // Shape settings: id@{ shape: <here>, ... }
    if ((m = /@\{[^}]*\bshape:\s*([\w-]*)$/.exec(before))) {
      const mk = ctx.item(m[1]);
      return SHAPE_NAMES.map(([n, d], i) => mk(n, { kind: Kind.EnumMember, detail: d, sort: String(i).padStart(2, '0') }));
    }
    const enumItems = (typed, values) => values.map((v, i) => ctx.item(typed)(v, { kind: Kind.EnumMember, sort: String(i).padStart(3, '0') }));
    if ((m = /@\{[^}]*\banimation:\s*(\w*)$/.exec(before))) return enumItems(m[1], ['fast', 'slow']);
    if ((m = /@\{[^}]*\banimate:\s*(\w*)$/.exec(before))) return enumItems(m[1], ['true', 'false']);
    if ((m = /@\{[^}]*\bcurve:\s*(\w*)$/.exec(before))) return enumItems(m[1], schema.flowchart.children.curve.values ?? []);
    if ((m = /@\{[^}]*\bpos:\s*(\w*)$/.exec(before))) return enumItems(m[1], ['t', 'b']);
    if ((m = /@\{\s*(?:[^}]*,\s*)?(\w*)$/.exec(before))) {
      const mk = ctx.item(m[1]);
      return [
        ['shape', 'node shape'], ['label', 'node text'], ['icon', 'icon name (icon shape)'], ['img', 'image url (image shape)'],
        ['pos', 'label position t or b'], ['w', 'width'], ['h', 'height'], ['constraint', 'image constraint'],
        ['animate', 'animate an edge'], ['animation', 'fast or slow (edge)'], ['curve', 'edge curve'],
      ].map(([k, d], i) => mk(k, { kind: Kind.Property, insert: k + ': ', detail: d, sort: String(i).padStart(2, '0'), next: ['shape', 'animate', 'animation', 'curve'].includes(k) }));
    }

    // :::className
    if ((m = /:::([\w-]*)$/.exec(before))) return classesIn(ctx).map((c) => ctx.item(m[1])(c, { kind: Kind.Class, detail: 'class' }));

    // classDef name <props>
    if ((m = /^\s*classDef\s+[\w,-]+\s+(?:[^\s]*,)?([\w-]*)$/.exec(before))) return props(m[1]);
    // style id <props> | style <id>
    if ((m = /^\s*style\s+[\w-]+\s+(?:[^\s]*,)?([\w-]*)$/.exec(before))) return props(m[1]);
    if ((m = /^\s*style\s+(\w*)$/.exec(before))) return nodesIn(ctx).map(({ id, label }) => ctx.item(m[1])(id, { kind: Kind.Variable, detail: label, insert: id + ' ', next: true }));
    // linkStyle <index|default> <props>
    if ((m = /^\s*linkStyle\s+[\w,]+\s+(?:[^\s]*,)?([\w-]*)$/.exec(before))) return props(m[1]);
    if ((m = /^\s*linkStyle\s+([\w,]*)$/.exec(before))) {
      const mk = ctx.item(m[1].split(',').pop());
      const count = Math.max(1, (ctx.text.match(/(?:<?-{2,}|={2,}|-\.+|~{3,})/g) ?? []).length);
      return [mk('default', { kind: Kind.EnumMember, detail: 'all links', insert: 'default ', next: true, sort: '000' }),
        ...Array.from({ length: Math.min(count, 50) }, (_, i) => mk(String(i), { kind: Kind.Value, detail: `link ${i} (order of appearance)`, insert: i + ' ', next: true, sort: '1' + String(i).padStart(3, '0') }))];
    }
    // class A,B <name> | class <ids>
    if ((m = /^\s*class\s+[\w,-]+\s+([\w-]*)$/.exec(before))) return classesIn(ctx).map((c) => ctx.item(m[1])(c, { kind: Kind.Class, detail: 'class' }));
    if ((m = /^\s*class\s+(?:[\w-]+,)*([\w-]*)$/.exec(before))) return nodesIn(ctx).map(({ id, label }) => ctx.item(m[1])(id, { kind: Kind.Variable, detail: label }));
    // click
    if ((m = /^\s*click\s+\w+\s+(\w*)$/.exec(before))) {
      const mk = ctx.item(m[1]);
      return [
        mk('href', { kind: Kind.Snippet, insert: 'href "${1:https://example.com}" ${2|_blank,_self,_parent,_top|}', snippet: true, detail: 'open a link', sort: '0' }),
        mk('callback', { kind: Kind.Snippet, insert: 'callback "${1:tooltip}"', snippet: true, detail: 'call a JavaScript function', sort: '1' }),
        mk('call', { kind: Kind.Snippet, insert: 'call ${1:fn}() "${2:tooltip}"', snippet: true, detail: 'call a function with the node id', sort: '2' }),
      ];
    }
    if ((m = /^\s*click\s+(\w*)$/.exec(before))) return nodesIn(ctx).map(({ id, label }) => ctx.item(m[1])(id, { kind: Kind.Variable, detail: label, insert: id + ' ', next: true }));

    if (LINE_KEYWORD.test(before) && /^\s*(subgraph|direction|classDef|class|style|linkStyle|click)\s/.test(before)) return [];

    // After an arrow: offer nodes and node shapes.
    const trimmed = before.replace(/\s+$/, '');
    const lastToken = /\S+$/.exec(trimmed)?.[0] ?? '';
    const trailingSpace = trimmed.length < before.length;
    const typedWord = /[\w-]*$/.exec(before)[0];
    const afterArrow = (trailingSpace && ARROW_TOKEN.test(lastToken)) || /(^|\s)\S+\s+(?:[<xo]?(?:-{2,}|={2,}|-\.+)[->.xo=]*|~{3,})\s*\|[^|]*\|\s*[\w-]*$/.test(before) || (/[&]\s*[\w-]*$/.test(before));
    if (afterArrow) {
      const mk = ctx.item(typedWord);
      return [
        ...nodesIn(ctx).map(({ id, label }) => mk(id, { kind: Kind.Variable, detail: label, sort: '0' + id })),
        ...(showShapes(typedWord) ? SHAPES.map(([l, s, d], i) => mk('new ' + l, { kind: Kind.Snippet, insert: s, snippet: true, detail: d, sort: '1' + String(i).padStart(2, '0') })) : []),
      ];
    }

    // After a node: offer arrows ("A <here>", "A[Text] <here>").
    if ((m = /(?:^|[;&\s])[\w-]+(?:\s*(?:\[[^\]]*\]|\([^)]*\)|\{[^}]*\}|>[^\]]*\]))?\s+([<xo=.~-]*)$/.exec(before)) && !LINE_KEYWORD.test(before) && /\S\s+[<xo=.~-]*$/.test(before)) {
      const typed = m[1];
      const mk = ctx.item(typed);
      return [
        ...ARROWS.map(([a, d], i) => mk(a, { kind: Kind.Operator, insert: a + ' ', detail: d, next: true, sort: String(i).padStart(2, '0') })),
        ...LABELED_ARROWS.map(([l, s, d], i) => mk(l, { kind: Kind.Snippet, insert: s + ' ', snippet: true, detail: d, filter: l, sort: '1' + String(i), next: true })),
      ];
    }

    // Start of a line: keywords, node shapes and existing ids.
    if ((m = /^\s*([\w-]*)$/.exec(before))) {
      const mk = ctx.item(m[1]);
      const snip = (label, key, detail) => mk(label, { kind: Kind.Snippet, insert: SNIPPETS[key], snippet: true, detail, sort: '1' + label });
      return [
        snip('subgraph', 'subgraph', 'group nodes in a box'),
        mk('end', { kind: Kind.Keyword, detail: 'close a subgraph', sort: '1end' }),
        mk('direction', { kind: Kind.Keyword, insert: 'direction ', detail: 'direction inside a subgraph', next: true, sort: '1direction' }),
        snip('classDef', 'classDef', 'define a style class'),
        snip('class', 'class', 'apply a class to nodes'),
        snip('style', 'style', 'style one node'),
        snip('linkStyle', 'linkStyle', 'style one link'),
        snip('click', 'click', 'make a node clickable (link)'),
        snip('click callback', 'clickCallback', 'make a node clickable (function)'),
        snip('edge animation', 'animate', 'animate an edge that has an id'),
        ...nodesIn(ctx).map(({ id, label }) => mk(id, { kind: Kind.Variable, insert: id + ' ', detail: label ? `${label} (node)` : 'node', next: true, sort: '0' + id })),
        ...(showShapes(m[1]) ? SHAPES.map(([l, s, d], i) => mk('new ' + l, { kind: Kind.Snippet, insert: s, snippet: true, detail: d, sort: '2' + String(i).padStart(2, '0') })) : []),
      ];
    }
    return [];
  },
};
