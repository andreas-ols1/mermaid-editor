// sequenceDiagram completions.
import { uniq } from './util.js';

// [arrow, description]. Each arrow is checked with mermaid.parse().
const ARROWS = [
  ['->>', 'solid line, arrow head'], ['-->>', 'dotted line, arrow head'], ['->', 'solid line, no arrow head'],
  ['-->', 'dotted line, no arrow head'], ['-x', 'solid line, cross (lost message)'], ['--x', 'dotted line, cross'],
  ['-)', 'solid line, open arrow (async)'], ['--)', 'dotted line, open arrow (async)'],
  ['<<->>', 'solid line, arrows on both ends'], ['<<-->>', 'dotted line, arrows on both ends'],
];
// Arrows that are complete: after one of these the user types the target participant.
const COMPLETE = new Set(['->>', '-->>', '-x', '--x', '-)', '--)', '<<->>', '<<-->>']);
const ARROW_ALT = '<<-->>|<<->>|-->>|->>|--x|-x|--\\)|-\\)|-->|->';

const PARTICIPANT_TYPES = [
  ['boundary', 'boundary object'], ['control', 'controller'], ['entity', 'entity'],
  ['database', 'database'], ['collections', 'collection'], ['queue', 'queue'],
];

const BLOCK_OPENERS = /^\s*(loop|alt|opt|par|critical|break|rect|box)\b/;
const LINE_KEYWORDS = new Set(['participant', 'actor', 'activate', 'deactivate', 'Note', 'note', 'loop', 'alt', 'else', 'opt', 'par', 'and',
  'critical', 'option', 'break', 'rect', 'box', 'end', 'autonumber', 'title', 'create', 'destroy', 'link', 'links', 'sequenceDiagram']);

export const SNIPPETS = {
  participant: 'participant ${1:A}',
  'participant as': 'participant ${1:A} as ${2:Alias}',
  actor: 'actor ${1:A}',
  'actor as': 'actor ${1:A} as ${2:Alias}',
  'participant type': 'participant ${1:A}@{ "type": "${2|boundary,control,entity,database,collections,queue|}" }',
  'Note right of': 'Note right of ${1:A}: ${2:text}',
  'Note left of': 'Note left of ${1:A}: ${2:text}',
  'Note over': 'Note over ${1:A},${2:B}: ${3:text}',
  loop: 'loop ${1:Every minute}\n    ${2:A}->>${3:B}: ${4:message}\nend',
  alt: 'alt ${1:condition}\n    ${2:A}->>${3:B}: ${4:message}\nelse ${5:otherwise}\n    ${3:B}->>${2:A}: ${6:message}\nend',
  opt: 'opt ${1:optional}\n    ${2:A}->>${3:B}: ${4:message}\nend',
  par: 'par ${1:first}\n    ${2:A}->>${3:B}: ${4:message}\nand ${5:second}\n    ${3:B}->>${2:A}: ${6:message}\nend',
  critical: 'critical ${1:action}\n    ${2:A}->>${3:B}: ${4:message}\noption ${5:failure}\n    ${3:B}->>${2:A}: ${6:message}\nend',
  break: 'break ${1:condition}\n    ${2:A}->>${3:B}: ${4:message}\nend',
  rect: 'rect ${1:rgb(200, 150, 255)}\n    ${2:A}->>${3:B}: ${4:message}\nend',
  box: 'box ${1:Purple} ${2:Group}\n    participant ${3:A}\n    participant ${4:B}\nend',
  autonumber: 'autonumber',
  activate: 'activate ${1:A}',
  deactivate: 'deactivate ${1:A}',
  title: 'title ${1:Title}',
  'create participant': 'create participant ${1:C}',
  'create actor': 'create actor ${1:C}',
  destroy: 'destroy ${1:C}',
  link: 'link ${1:A}: ${2:Label} @ ${3:https://example.com}',
  links: 'links ${1:A}: {"${2:Label}": "${3:https://example.com}"}',
};
export const VALIDATE = {
  prefix: 'sequenceDiagram\n  participant A\n  participant B\n  participant C\n',
  // [before, after] for snippets that only parse in context.
  around: {
    deactivate: ['sequenceDiagram\n  participant A\n  activate A\n', ''],
    'create participant': ['sequenceDiagram\n  participant A\n', '\n  A->>C: hi'],
    'create actor': ['sequenceDiagram\n  participant A\n', '\n  A->>C: hi'],
  },
};

function participantsIn(ctx) {
  const out = [];
  const arrow = new RegExp(`^\\s*(\\w+)\\s*(?:${ARROW_ALT})\\s*[+-]?\\s*(\\w+)\\s*:`);
  ctx.model.getLinesContent().forEach((line, i) => {
    if (i + 1 === ctx.pos.lineNumber) return;
    let m = /^\s*(?:create\s+)?(?:participant|actor)\s+(\w+)(?:@\{[^}]*\})?(?:\s+as\s+(.*))?\s*$/.exec(line);
    if (m) { out.push({ id: m[1], alias: (m[2] ?? '').trim() }); return; }
    m = arrow.exec(line);
    if (m) { out.push({ id: m[1], alias: '' }, { id: m[2], alias: '' }); }
  });
  // First declaration wins, so an alias is kept.
  const seen = new Map();
  for (const p of out) if (!seen.has(p.id) || (!seen.get(p.id).alias && p.alias)) seen.set(p.id, p);
  return [...seen.values()];
}

// The innermost block that is still open before the cursor ('' when none).
function openBlock(ctx) {
  const stack = [];
  ctx.model.getLinesContent().slice(0, ctx.pos.lineNumber - 1).forEach((line) => {
    const m = BLOCK_OPENERS.exec(line);
    if (m) stack.push(m[1]);
    else if (/^\s*end\b/.test(line)) stack.pop();
  });
  return stack[stack.length - 1] ?? '';
}

export default {
  matches: /^sequenceDiagram/,

  provide(ctx) {
    const { before, Kind } = ctx;
    let m;
    const people = (typed, extra = {}) => participantsIn(ctx).map((p, i) => ctx.item(typed)(p.id, {
      kind: Kind.Variable, detail: p.alias || 'participant', sort: String(i).padStart(3, '0'), ...extra,
    }));

    // participant types: A@{ "type": "<here>" }
    if ((m = /@\{\s*"type":\s*"(\w*)$/.exec(before))) {
      return PARTICIPANT_TYPES.map(([t, d], i) => ctx.item(m[1])(t, { kind: Kind.EnumMember, detail: d, sort: String(i) }));
    }
    if (/^\s*(?:create\s+)?(?:participant|actor)\s+\w+@$/.test(before)) {
      return [ctx.item('')('{ "type": ... }', {
        kind: Kind.Snippet, insert: '{ "type": "${1|boundary,control,entity,database,collections,queue|}" }', snippet: true, detail: 'participant shape', filter: '',
      })];
    }
    // participant A <as>
    if ((m = /^\s*(?:create\s+)?(?:participant|actor)\s+\w+(?:@\{[^}]*\})?\s+(\w*)$/.exec(before))) {
      return [ctx.item(m[1])('as', { kind: Kind.Keyword, insert: 'as ', detail: 'display name' })];
    }
    // activate / deactivate / destroy
    if ((m = /^\s*(?:activate|deactivate|destroy)\s+(\w*)$/.exec(before))) return people(m[1]);
    // Note <side> of / over
    if ((m = /^\s*[Nn]ote\s+(\w*)$/.exec(before))) {
      return [['right of', 'right of a participant'], ['left of', 'left of a participant'], ['over', 'over one or two participants']]
        .map(([w, d], i) => ctx.item(m[1])(w, { insert: w + ' ', detail: d, sort: String(i), next: true }));
    }
    if ((m = /^\s*[Nn]ote\s+(?:right of|left of|over)\s+(?:\w+,)*(\w*)$/.exec(before))) return people(m[1]);
    // rect color
    if ((m = /^\s*(?:rect|box)\s+(\w*)$/.exec(before))) {
      return [
        ctx.item(m[1])('rgb(…)', { kind: Kind.Snippet, insert: 'rgb(${1:200}, ${2:150}, ${3:255})', snippet: true, detail: 'color', filter: m[1] }),
        ctx.item(m[1])('rgba(…)', { kind: Kind.Snippet, insert: 'rgba(${1:0}, ${2:0}, ${3:255}, ${4:.1})', snippet: true, detail: 'color with opacity', filter: m[1] }),
      ];
    }

    // After a complete arrow: "A->>" -> target participant, with + / - for activation.
    const afterArrow = new RegExp(`^\\s*(\\w+)\\s*(${ARROW_ALT})\\s*([+-]?)\\s*(\\w*)$`).exec(before);
    if (afterArrow && COMPLETE.has(afterArrow[2]) && !LINE_KEYWORDS.has(afterArrow[1])) {
      const typed = afterArrow[4];
      const sign = afterArrow[3];
      const items = people(typed);
      if (!sign && !typed) {
        items.push(
          ctx.item('')('+', { kind: Kind.Operator, detail: 'activate the target', insert: '+', next: true, sort: '900' }),
          ctx.item('')('-', { kind: Kind.Operator, detail: 'deactivate the sender', insert: '-', next: true, sort: '901' }),
        );
      }
      return items;
    }
    // Typing an arrow: "A " or "A-" or "A->"
    m = /^\s*(\w+)(?:\s+([<\->x)]*)|([<\->)]+x?))$/.exec(before);
    if (m && !LINE_KEYWORDS.has(m[1])) {
      const typed = m[2] ?? m[3] ?? '';
      return ARROWS.map(([a, d], i) => ctx.item(typed)(a, { kind: Kind.Operator, detail: d, sort: String(i).padStart(2, '0'), next: COMPLETE.has(a) }));
    }

    // Start of a line
    if ((m = /^\s*([\w-]*)$/.exec(before))) {
      const mk = ctx.item(m[1]);
      const snip = (label, detail, sort = '1') => mk(label, { kind: Kind.Snippet, insert: SNIPPETS[label], snippet: true, detail, sort: sort + label });
      const open = openBlock(ctx);
      const items = [
        ...participantsIn(ctx).map((p, i) => mk(p.id, { kind: Kind.Variable, insert: p.id + ' ', detail: p.alias || 'participant', next: true, sort: '0' + String(i).padStart(3, '0') })),
        snip('participant', 'declare a participant'), snip('participant as', 'participant with a display name'),
        snip('actor', 'declare an actor (stick figure)'), snip('actor as', 'actor with a display name'),
        snip('participant type', 'participant with a shape (database, queue, ...)'),
        snip('Note right of', 'note'), snip('Note left of', 'note'), snip('Note over', 'note over two participants'),
        snip('loop', 'repeat block'), snip('alt', 'if / else block'), snip('opt', 'optional block'), snip('par', 'parallel block'),
        snip('critical', 'critical region with options'), snip('break', 'break block'), snip('rect', 'colored background block'),
        snip('box', 'group participants in a box'), snip('autonumber', 'number the messages'),
        snip('activate', 'activation bar on'), snip('deactivate', 'activation bar off'), snip('title', 'diagram title'),
        snip('create participant', 'create a participant mid-diagram'), snip('create actor', 'create an actor mid-diagram'),
        snip('destroy', 'destroy a participant'), snip('link', 'popup menu link'), snip('links', 'popup menu links'),
      ];
      if (open) items.push(mk('end', { kind: Kind.Keyword, detail: `close the ${open} block`, sort: '00end' }));
      if (open === 'alt') items.push(mk('else', { kind: Kind.Keyword, insert: 'else ', detail: 'other branch', sort: '00else' }));
      if (open === 'par') items.push(mk('and', { kind: Kind.Keyword, insert: 'and ', detail: 'next parallel branch', sort: '00and' }));
      if (open === 'critical') items.push(mk('option', { kind: Kind.Keyword, insert: 'option ', detail: 'failure branch', sort: '00option' }));
      return uniq(items, (i) => i.label + i.sortText);
    }
    return [];
  },
};
