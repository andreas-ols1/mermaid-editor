// stateDiagram / stateDiagram-v2 completions.
import { uniq } from './util.js';
import { STYLE_PROPS } from './flowchart.js';

const DIRECTIONS = [['TB', 'top to bottom'], ['BT', 'bottom to top'], ['LR', 'left to right'], ['RL', 'right to left']];
const PSEUDO = [['choice', 'decision (one way out)'], ['fork', 'split into parallel states'], ['join', 'merge parallel states']];

export const SNIPPETS = {
  'state described': 'state "${1:Description}" as ${2:id}',
  'state composite': 'state ${1:Name} {\n    [*] --> ${2:Inner}\n    ${2:Inner} --> [*]\n}',
  'state choice': 'state ${1:id} <<choice>>',
  'state fork': 'state ${1:id} <<fork>>',
  'state join': 'state ${1:id} <<join>>',
  'note right of': 'note right of ${1:A}: ${2:text}',
  'note left of': 'note left of ${1:A}: ${2:text}',
  'note block': 'note right of ${1:A}\n    ${2:text}\nend note',
  description: '${1:A}: ${2:description}',
  direction: 'direction ${1|TB,BT,LR,RL|}',
  concurrency: '--',
  transition: '${1:A} --> ${2:B}: ${3:event}',
  classDef: 'classDef ${1:name} fill:${2:#f96},stroke:${3:#333}',
  class: 'class ${1:A} ${2:name}',
};
export const VALIDATE = { prefix: 'stateDiagram-v2\n  [*] --> A\n  A --> B\n' };

function statesIn(ctx) {
  const ids = [];
  ctx.model.getLinesContent().forEach((line, i) => {
    if (i + 1 === ctx.pos.lineNumber) return;
    let m = /^\s*state\s+"[^"]*"\s+as\s+([\w-]+)/.exec(line) ?? /^\s*state\s+([\w-]+)/.exec(line);
    if (m) { ids.push(m[1]); return; }
    m = /^\s*([\w-]+|\[\*\])\s*-->\s*([\w-]+|\[\*\])/.exec(line);
    if (m) { ids.push(m[1], m[2]); return; }
    m = /^\s*([\w-]+)\s*:/.exec(line);
    if (m && !/^(note|direction|classDef|class|state)$/.test(m[1])) ids.push(m[1]);
  });
  return uniq(ids.filter((s) => s !== '[*]'));
}
const cssClassesIn = (ctx) => ctx.collect(/^\s*classDef\s+([\w-]+)/gm).map((c) => c.id);

export default {
  matches: /^stateDiagram/,

  provide(ctx) {
    const { before, Kind } = ctx;
    let m;
    const states = (typed, extra = {}) => statesIn(ctx).map((s, i) => ctx.item(typed)(s, { kind: Kind.Variable, detail: 'state', sort: '1' + String(i).padStart(3, '0'), ...extra }));
    const start = (typed) => ctx.item(typed)('[*]', { kind: Kind.Constant, detail: 'start or end', filter: typed ? '[*]' : '', sort: '0' });
    const props = (typed) => STYLE_PROPS.map(([p, d], i) => ctx.item(typed)(p, { kind: Kind.Property, insert: p + ':', detail: d, sort: String(i).padStart(2, '0') }));

    if ((m = /<<(\w*)$/.exec(before))) return PSEUDO.map(([p, d], i) => ctx.item(m[1])(p, { kind: Kind.EnumMember, insert: p + '>>', detail: d, sort: String(i) }));
    if ((m = /^\s*direction\s+(\w*)$/.exec(before))) return DIRECTIONS.map(([d, desc], i) => ctx.item(m[1])(d, { kind: Kind.EnumMember, detail: desc, sort: String(i) }));
    if ((m = /:::([\w-]*)$/.exec(before))) return cssClassesIn(ctx).map((c) => ctx.item(m[1])(c, { kind: Kind.Class, detail: 'style class' }));
    if ((m = /^\s*classDef\s+[\w,-]+\s+(?:[^\s]*,)?([\w-]*)$/.exec(before))) return props(m[1]);
    if ((m = /^\s*class\s+[\w,-]+\s+([\w-]*)$/.exec(before))) return cssClassesIn(ctx).map((c) => ctx.item(m[1])(c, { kind: Kind.Class, detail: 'style class' }));
    if ((m = /^\s*class\s+(?:[\w-]+,)*([\w-]*)$/.exec(before))) return states(m[1]);
    if ((m = /^\s*state\s+"[^"]*"\s+(\w*)$/.exec(before))) return [ctx.item(m[1])('as', { insert: 'as ', detail: 'state id' })];
    if ((m = /^\s*note\s+(\w*)$/.exec(before))) {
      return [['right of', 'note on the right'], ['left of', 'note on the left']].map(([w, d], i) => ctx.item(m[1])(w, { insert: w + ' ', detail: d, sort: String(i), next: true }));
    }
    if ((m = /^\s*note\s+(?:right|left) of\s+(\w*)$/.exec(before))) return states(m[1]);

    // After "-->": target state.
    if ((m = /^\s*(?:[\w-]+|\[\*\])\s*-->\s+([\w-]*)$/.exec(before))) return [start(m[1]), ...states(m[1])];
    // After a state: arrow.
    if ((m = /^\s*(?:[\w-]+|\[\*\])\s+([-<>]*)$/.exec(before)) && !/^\s*(state|note|class|classDef|direction)\s/.test(before)) {
      return [ctx.item(m[1])('-->', { kind: Kind.Operator, insert: '--> ', detail: 'transition', next: true })];
    }

    // Start of a line
    if ((m = /^\s*([\w\[\]*-]*)$/.exec(before))) {
      const mk = ctx.item(m[1]);
      const snip = (label, detail) => mk(label, { kind: Kind.Snippet, insert: SNIPPETS[label], snippet: true, detail, sort: '2' + label });
      return [
        mk('[*]', { kind: Kind.Constant, insert: '[*] ', detail: 'start or end state', next: true, sort: '0' }),
        ...statesIn(ctx).map((s, i) => mk(s, { kind: Kind.Variable, insert: s + ' ', detail: 'state', next: true, sort: '1' + String(i).padStart(3, '0') })),
        snip('transition', 'transition between two states'), snip('state described', 'state with a long description'),
        snip('state composite', 'state that contains states'), snip('state choice', 'choice (decision)'), snip('state fork', 'fork'),
        snip('state join', 'join'), snip('description', 'state description'), snip('note right of', 'note'), snip('note left of', 'note'),
        snip('note block', 'multi-line note'), snip('direction', 'layout direction'), snip('concurrency', 'split a composite state into parallel regions'),
        snip('classDef', 'define a style class'), snip('class', 'apply a style class'),
      ];
    }
    return [];
  },
};
