// erDiagram completions.
import { openBraceLine } from './util.js';
import { STYLE_PROPS } from './flowchart.js';

const DIRECTIONS = [['TB', 'top to bottom'], ['BT', 'bottom to top'], ['LR', 'left to right'], ['RL', 'right to left']];
const LEFT = [['||', 'exactly one'], ['|o', 'zero or one'], ['}o', 'zero or more'], ['}|', 'one or more']];
const RIGHT = [['||', 'exactly one'], ['o|', 'zero or one'], ['o{', 'zero or more'], ['|{', 'one or more']];
const LINES = [['--', 'identifying'], ['..', 'non-identifying']];
// All 32 relationship operators, e.g. ||--o{
export const OPERATORS = LINES.flatMap(([line, lt]) => LEFT.flatMap(([l, ld]) => RIGHT.map(([r, rd]) => ({
  op: l + line + r, detail: `${ld} to ${rd} (${lt})`,
}))));
const COMMON = ['||--o{', '||--|{', '||--||', '}o--o{', '}|--|{', '|o--o{', '||..o{'];
const TYPES = ['string', 'int', 'float', 'decimal', 'bigint', 'boolean', 'date', 'datetime', 'text', 'uuid', 'json', 'varchar'];
const KEYS = [['PK', 'primary key'], ['FK', 'foreign key'], ['UK', 'unique key']];

export const SNIPPETS = {
  entity: '${1:ENTITY} {\n    ${2:string} ${3:name} ${4|PK,FK,UK|}\n    ${5:int} ${6:count}\n}',
  relationship: '${1:A} ${2|\\|\\|--o{,\\|\\|--\\|{,\\|\\|--\\|\\|,}o--o{|} ${3:B} : ${4:label}',
  'entity alias': '${1:id}["${2:Display Name}"] {\n    ${3:string} ${4:name}\n}',
  direction: 'direction ${1|TB,BT,LR,RL|}',
  classDef: 'classDef ${1:name} fill:${2:#f96},stroke:${3:#333}',
  class: 'class ${1:A} ${2:name}',
};
export const VALIDATE = { prefix: 'erDiagram\n  A ||--o{ B : has\n' };

const OP_ALT = '[|o}][|o{}](?:--|\\.\\.)[|o{}][|o{}]';

function entitiesIn(ctx) {
  const ids = [];
  const rel = new RegExp(`^\\s*([\\w-]+)\\s+${OP_ALT}\\s+([\\w-]+)`);
  ctx.model.getLinesContent().forEach((line, i) => {
    if (i + 1 === ctx.pos.lineNumber) return;
    let m = /^\s*([\w-]+)(?:\[[^\]]*\])?\s*\{/.exec(line);
    if (m && !/^(classDef|class)$/.test(m[1])) { ids.push(m[1]); return; }
    m = rel.exec(line);
    if (m) ids.push(m[1], m[2]);
  });
  return [...new Set(ids)];
}

export default {
  matches: /^erDiagram/,

  provide(ctx) {
    const { before, Kind } = ctx;
    let m;
    const entities = (typed, extra = {}) => entitiesIn(ctx).map((e, i) => ctx.item(typed)(e, { kind: Kind.Class, detail: 'entity', sort: String(i).padStart(3, '0'), ...extra }));
    const cssClassesIn = () => ctx.collect(/^\s*classDef\s+([\w-]+)/gm).map((c) => c.id);

    if ((m = /^\s*direction\s+(\w*)$/.exec(before))) return DIRECTIONS.map(([d, desc], i) => ctx.item(m[1])(d, { kind: Kind.EnumMember, detail: desc, sort: String(i) }));
    if ((m = /:::([\w-]*)$/.exec(before))) return cssClassesIn().map((c) => ctx.item(m[1])(c, { kind: Kind.Class, detail: 'style class' }));
    if ((m = /^\s*classDef\s+[\w,-]+\s+(?:[^\s]*,)?([\w-]*)$/.exec(before))) {
      return STYLE_PROPS.map(([p, d], i) => ctx.item(m[1])(p, { kind: Kind.Property, insert: p + ':', detail: d, sort: String(i).padStart(2, '0') }));
    }
    if ((m = /^\s*class\s+[\w,-]+\s+([\w-]*)$/.exec(before))) return cssClassesIn().map((c) => ctx.item(m[1])(c, { kind: Kind.Class, detail: 'style class' }));
    if ((m = /^\s*class\s+(?:[\w-]+,)*([\w-]*)$/.exec(before))) return entities(m[1]);

    // Inside an entity body: attributes.
    if (/^\s*[\w-]+(?:\[[^\]]*\])?\s*\{/.test(openBraceLine(ctx))) {
      if ((m = /^\s*\w+\s+\w+\s+(?:(?:PK|FK|UK),\s*)*(\w*)$/.exec(before))) {
        const mk = ctx.item(m[1]);
        return [
          ...KEYS.map(([k, d], i) => mk(k, { kind: Kind.EnumMember, detail: d, sort: String(i) })),
          ...(m[1] === '' ? [mk('"comment"', { kind: Kind.Snippet, insert: '"${1:comment}"', snippet: true, detail: 'attribute comment', sort: '9', filter: '' })] : []),
        ];
      }
      if ((m = /^\s*(\w*)$/.exec(before))) {
        const mk = ctx.item(m[1]);
        return [
          ...TYPES.map((t, i) => mk(t, { kind: Kind.TypeParameter, insert: t + ' ', detail: 'attribute type', sort: String(i).padStart(2, '0') })),
          mk('}', { kind: Kind.Keyword, detail: 'close the entity', sort: '99' }),
        ];
      }
      return [];
    }

    // After a relationship operator: second entity.
    if ((m = new RegExp(`^\\s*[\\w-]+\\s+${OP_ALT}\\s+([\\w-]*)$`).exec(before))) return entities(m[1]);
    // After an entity: relationship operator.
    if ((m = /^\s*([\w-]+)\s+([|o}{.\-]*)$/.exec(before)) && !/^(entity|classDef|class|direction|erDiagram)$/.test(m[1])) {
      const mk = ctx.item(m[2]);
      return OPERATORS.map(({ op, detail }) => mk(op, {
        kind: Kind.Operator, insert: op + ' ', detail, next: true, sort: (COMMON.includes(op) ? '0' : '1') + String(OPERATORS.findIndex((o) => o.op === op)).padStart(2, '0'),
      }));
    }

    // Start of a line
    if ((m = /^\s*([\w-]*)$/.exec(before))) {
      const mk = ctx.item(m[1]);
      const snip = (label, detail) => mk(label, { kind: Kind.Snippet, insert: SNIPPETS[label], snippet: true, detail, sort: '1' + label });
      return [
        ...entitiesIn(ctx).map((e, i) => mk(e, { kind: Kind.Class, insert: e + ' ', detail: 'entity', next: true, sort: '0' + String(i).padStart(3, '0') })),
        snip('entity', 'entity with attributes'), snip('relationship', 'relationship between two entities'),
        snip('entity alias', 'entity with a display name'), snip('direction', 'layout direction'),
        snip('classDef', 'define a style class'), snip('class', 'apply a style class'),
      ];
    }
    return [];
  },
};
