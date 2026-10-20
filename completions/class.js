// classDiagram completions.
import { uniq, openBraceLine } from './util.js';
import { STYLE_PROPS } from './flowchart.js';

const DIRECTIONS = [['TB', 'top to bottom'], ['BT', 'bottom to top'], ['LR', 'left to right'], ['RL', 'right to left']];
const RELATIONS = [
  ['<|--', 'inheritance (right inherits left)'], ['*--', 'composition'], ['o--', 'aggregation'], ['-->', 'association'],
  ['--', 'link (solid)'], ['..>', 'dependency'], ['..|>', 'realization'], ['..', 'link (dashed)'],
  ['<--', 'association (reverse)'], ['--*', 'composition (reverse)'], ['--o', 'aggregation (reverse)'],
  ['--|>', 'inheritance (left inherits right)'], ['<|..', 'realization (reverse)'], ['<..', 'dependency (reverse)'], ['<-->', 'two-way association'],
];
const REL_ALT = RELATIONS.map(([r]) => r).sort((a, b) => b.length - a.length).map((r) => r.replace(/[|*.()]/g, '\\$&')).join('|');
const ANNOTATIONS = [['interface', 'interface'], ['abstract', 'abstract class'], ['service', 'service'], ['enumeration', 'enumeration']];
const CARDINALITY = ['1', '0..1', '1..*', '*', 'n', '0..n'];
const KEYWORDS = new Set(['class', 'namespace', 'note', 'direction', 'classDef', 'cssClass', 'style', 'link', 'click', 'callback', 'call', 'classDiagram']);

export const SNIPPETS = {
  class: 'class ${1:Name}',
  'class with members': 'class ${1:Name} {\n    +${2:String} ${3:field}\n    +${4:method}() ${5:void}\n}',
  'class generic': 'class ${1:List}~${2:T}~ {\n    +add(${2:T} item)\n}',
  namespace: 'namespace ${1:Name} {\n    class ${2:A}\n    class ${3:B}\n}',
  note: 'note "${1:text}"',
  'note for': 'note for ${1:A} "${2:text}"',
  direction: 'direction ${1|TB,BT,LR,RL|}',
  annotation: '<<${1|interface,abstract,service,enumeration|}>> ${2:A}',
  classDef: 'classDef ${1:name} fill:${2:#f96},stroke:${3:#333}',
  cssClass: 'cssClass "${1:A,B}" ${2:name}',
  style: 'style ${1:A} fill:${2:#f9f},stroke:${3:#333}',
  link: 'link ${1:A} "${2:https://example.com}" "${3:tooltip}"',
  click: 'click ${1:A} href "${2:https://example.com}"',
  member: '${1:A} : +${2:String} ${3:name}',
  relation: '${1:A} ${2|<\\|--,*--,o--,-->,--,..>,..\\|>,..|} ${3:B}',
};
export const MEMBER_SNIPPETS = {
  field: '+${1:String} ${2:name}',
  'private field': '-${1:String} ${2:name}',
  'protected field': '#${1:String} ${2:name}',
  'package field': '~${1:String} ${2:name}',
  method: '+${1:name}(${2}) ${3:void}',
  'static method': '+${1:name}(${2}) ${3:void}$',
  'abstract method': '+${1:name}(${2}) ${3:void}*',
  annotation: '<<${1|interface,abstract,service,enumeration|}>>',
};
export const VALIDATE = { prefix: 'classDiagram\n  class A\n  class B\n' };
export const EXPORTS_FOR_TESTS = { RELATIONS, REL_ALT, ANNOTATIONS };

function classesIn(ctx) {
  const ids = [];
  const rel = new RegExp(`^\\s*(\\w+)\\s+(?:"[^"]*"\\s+)?(?:${REL_ALT})\\s+(?:"[^"]*"\\s+)?(\\w+)`);
  ctx.model.getLinesContent().forEach((line, i) => {
    if (i + 1 === ctx.pos.lineNumber) return;
    let m = /^\s*class\s+(\w+)/.exec(line);
    if (m) { ids.push(m[1]); return; }
    m = rel.exec(line);
    if (m) { ids.push(m[1], m[2]); return; }
    m = /^\s*(\w+)\s*:\s*[+\-#~]/.exec(line);
    if (m && !KEYWORDS.has(m[1])) ids.push(m[1]);
  });
  return uniq(ids);
}
const cssClassesIn = (ctx) => ctx.collect(/^\s*classDef\s+([\w-]+)/gm).map((c) => c.id);

export default {
  matches: /^classDiagram/,

  provide(ctx) {
    const { before, Kind } = ctx;
    let m;
    const classes = (typed, extra = {}) => classesIn(ctx).map((c, i) => ctx.item(typed)(c, { kind: Kind.Class, detail: 'class', sort: String(i).padStart(3, '0'), ...extra }));
    const props = (typed) => STYLE_PROPS.map(([p, d], i) => ctx.item(typed)(p, { kind: Kind.Property, insert: p + ':', detail: d, sort: String(i).padStart(2, '0') }));

    // <<annotation>>
    if ((m = /<<(\w*)$/.exec(before))) {
      return ANNOTATIONS.map(([a, d], i) => ctx.item(m[1])(a, { kind: Kind.EnumMember, insert: a + '>>', detail: d, sort: String(i), next: false }));
    }
    if ((m = /^\s*direction\s+(\w*)$/.exec(before))) {
      return DIRECTIONS.map(([d, desc], i) => ctx.item(m[1])(d, { kind: Kind.EnumMember, detail: desc, sort: String(i) }));
    }
    if ((m = /:::([\w-]*)$/.exec(before))) return cssClassesIn(ctx).map((c) => ctx.item(m[1])(c, { kind: Kind.Class, detail: 'style class' }));
    if ((m = /^\s*(?:classDef|style)\s+[\w,-]+\s+(?:[^\s]*,)?([\w-]*)$/.exec(before))) return props(m[1]);
    if ((m = /^\s*(?:note for|style|link|click|cssClass\s+"[^"]*")\s+(\w*)$/.exec(before)) && !/cssClass/.test(before)) return classes(m[1]);
    if ((m = /^\s*cssClass\s+"[^"]*"\s+(\w*)$/.exec(before))) return cssClassesIn(ctx).map((c) => ctx.item(m[1])(c, { kind: Kind.Class, detail: 'style class' }));

    // Inside a class body: members.
    if (/^\s*class\s+[\w~]+\s*\{/.test(openBraceLine(ctx)) && (m = /^\s*([+\-#~<]*\w*)$/.exec(before))) {
      const mk = ctx.item(m[1]);
      return [
        ...Object.entries(MEMBER_SNIPPETS).map(([l, s], i) => mk(l, { kind: Kind.Snippet, insert: s, snippet: true, detail: 'member', sort: String(i).padStart(2, '0'), filter: /^[+\-#~<]/.test(m[1]) ? m[1] : undefined })),
        mk('}', { kind: Kind.Keyword, detail: 'close the class', sort: '99' }),
      ];
    }
    if (/^\s*namespace\s+\w+\s*\{/.test(openBraceLine(ctx)) && (m = /^\s*(\w*)$/.exec(before))) {
      return [ctx.item(m[1])('class', { kind: Kind.Snippet, insert: SNIPPETS.class, snippet: true, detail: 'class in the namespace' }),
        ctx.item(m[1])('}', { kind: Kind.Keyword, detail: 'close the namespace' })];
    }

    // After a relation: target class and cardinality.
    const afterRel = new RegExp(`^\\s*\\w+\\s+(?:"[^"]*"\\s+)?(?:${REL_ALT})\\s+(?:"[^"]*"\\s+)?([\\w"]*)$`).exec(before);
    if (afterRel) {
      const typed = afterRel[1];
      return [
        ...classes(typed),
        ...CARDINALITY.map((c, i) => ctx.item(typed)(`"${c}"`, { kind: Kind.Value, insert: `"${c}" `, detail: 'cardinality', sort: '5' + i, next: true })),
      ];
    }
    // After a class name: relations.
    m = new RegExp(`^\\s*(\\w+)\\s+(?:"[^"]*"\\s+)?(${'[<|*o.\\->()]*'})$`).exec(before);
    if (m && !KEYWORDS.has(m[1])) {
      return RELATIONS.map(([r, d], i) => ctx.item(m[2])(r, { kind: Kind.Operator, insert: r + ' ', detail: d, sort: String(i).padStart(2, '0'), next: true }));
    }

    // Start of a line
    if ((m = /^\s*([\w-]*)$/.exec(before))) {
      const mk = ctx.item(m[1]);
      const snip = (label, detail) => mk(label, { kind: Kind.Snippet, insert: SNIPPETS[label], snippet: true, detail, sort: '1' + label });
      return [
        ...classes(m[1], { insert: undefined }).map((it) => ({ ...it, insertText: it.label + ' ', command: { id: 'editor.action.triggerSuggest', title: '' } })),
        snip('class', 'class'), snip('class with members', 'class with members'), snip('class generic', 'generic class'),
        snip('namespace', 'group classes'), snip('relation', 'relation between two classes'), snip('member', 'add a member to a class'),
        snip('note', 'general note'), snip('note for', 'note for one class'), snip('direction', 'layout direction'),
        snip('annotation', 'annotation like <<interface>>'), snip('classDef', 'define a style class'), snip('cssClass', 'apply a style class'),
        snip('style', 'style one class'), snip('link', 'make a class clickable'), snip('click', 'make a class clickable'),
      ];
    }
    return [];
  },
};
