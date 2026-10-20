// Completions for: mindmap, gitGraph, block-beta, requirementDiagram, C4.
import { snips, enums, openBraceLine, expandSnippet as ex } from './util.js';

// ---------- mindmap ----------
const MINDMAP = [
  ['node', '${1:text}', 'plain node (indent decides the parent)'],
  ['square', '${1:id}[${2:text}]', 'square'],
  ['rounded', '${1:id}(${2:text})', 'rounded'],
  ['circle', '${1:id}((${2:text}))', 'circle'],
  ['bang', '${1:id}))${2:text}((', 'bang'],
  ['cloud', '${1:id})${2:text}(', 'cloud'],
  ['hexagon', '${1:id}{{${2:text}}}', 'hexagon'],
  ['icon', '::icon(${1:fa fa-book})', 'icon for the node above'],
  ['class', ':::${1:urgent large}', 'style class for the node above'],
];
const mindmap = {
  matches: /^mindmap/,
  docs: () => Object.fromEntries(MINDMAP.map(([l, s]) => [`mindmap ${l}`, `mindmap\n  root((Root))\n    ${l === 'icon' || l === 'class' ? 'A\n    ' : ''}${ex(s)}`])),
  provide(ctx) {
    const m = /^\s*([\w:-]*)$/.exec(ctx.before);
    return m ? snips(ctx, m[1], MINDMAP) : [];
  },
};

// ---------- gitGraph ----------
const GIT = [
  ['commit', 'commit', 'commit on the current branch'],
  ['commit id', 'commit id: "${1:id}"', 'commit with an id'],
  ['commit tag', 'commit id: "${1:id}" tag: "${2:v1.0}"', 'commit with a tag'],
  ['commit type', 'commit type: ${1|NORMAL,REVERSE,HIGHLIGHT|}', 'commit with a look'],
  ['branch', 'branch ${1:develop}', 'new branch (and switch to it)'],
  ['branch order', 'branch ${1:develop} order: ${2:1}', 'new branch at a position'],
  ['checkout', 'checkout ${1:main}', 'switch branch'],
  ['switch', 'switch ${1:main}', 'switch branch'],
  ['merge', 'merge ${1:develop}', 'merge a branch into the current one'],
  ['merge tag', 'merge ${1:develop} id: "${2:id}" tag: "${3:v1.0}"', 'merge with id and tag'],
  ['cherry-pick', 'cherry-pick id: "${1:id}"', 'copy a commit from another branch'],
];
const COMMIT_TYPES = [['NORMAL', 'filled circle'], ['REVERSE', 'crossed circle'], ['HIGHLIGHT', 'filled square']];
const gitBranches = (ctx) => ['main', ...ctx.collect(/^\s*branch\s+([\w\/.-]+)/gm).map((b) => b.id)];

const git = {
  matches: /^gitGraph/,
  docs: () => Object.fromEntries(GIT.map(([l, s]) => {
    let text = `gitGraph\n  commit id: "A"\n  branch develop\n  checkout develop\n  commit id: "B"\n  checkout main\n  ${ex(s)}`;
    if (l === 'merge' || l === 'merge tag') text = `gitGraph\n  commit\n  branch develop\n  checkout develop\n  commit\n  checkout main\n  ${ex(s)}`;
    if (l === 'cherry-pick') text = `gitGraph\n  commit id: "A"\n  branch develop\n  checkout develop\n  commit id: "id"\n  checkout main\n  commit\n  ${ex(s)}`;
    if (l === 'checkout' || l === 'switch') text = `gitGraph\n  commit\n  branch develop\n  ${ex(s)}`;
    if (l === 'branch' || l === 'branch order') text = `gitGraph\n  commit\n  ${ex(s)}`;
    return [`git ${l}`, text];
  })),
  provide(ctx) {
    const { before, Kind } = ctx;
    let m;
    if (ctx.isHeaderLine && (m = /^\s*gitGraph\s+(\w*)$/.exec(before))) return enums(ctx, m[1], [['LR', 'left to right'], ['TB', 'top to bottom'], ['BT', 'bottom to top']], { suffix: ':' });
    if ((m = /\btype:\s*(\w*)$/.exec(before))) return enums(ctx, m[1], COMMIT_TYPES);
    if ((m = /\b(?:id|parent):\s*"([^"]*)$/.exec(before)) && /cherry-pick/.test(before)) {
      return ctx.collect(/\bid:\s*"([^"]+)"/g).map((c) => ctx.item(m[1])(c.id, { kind: Kind.Reference, detail: 'commit id' }));
    }
    if ((m = /^\s*(?:checkout|switch|merge)\s+([\w\/.-]*)$/.exec(before))) return gitBranches(ctx).map((b, i) => ctx.item(m[1])(b, { kind: Kind.Variable, detail: 'branch', sort: String(i).padStart(3, '0') }));
    if ((m = /^\s*(?:commit|merge\s+[\w\/.-]+)\s+(?:.*\s)?(\w*)$/.exec(before))) {
      const keys = /^\s*merge/.test(before) ? [['id', 'merge commit id'], ['tag', 'tag'], ['type', 'look']] : [['id', 'commit id'], ['tag', 'tag'], ['type', 'look']];
      return keys.map(([k, d], i) => ctx.item(m[1])(k + ':', { kind: Kind.Property, insert: k === 'type' ? 'type: ' : `${k}: "`, detail: d, sort: String(i), next: k === 'type' }));
    }
    if ((m = /^\s*([\w-]*)$/.exec(before))) return snips(ctx, m[1], GIT);
    return [];
  },
};

// ---------- block-beta ----------
const BLOCK = [
  ['columns', 'columns ${1:3}', 'number of columns'],
  ['block', '${1:a}["${2:Label}"]', 'block with a label'],
  ['block span', '${1:a}:${2:2}', 'block that spans columns'],
  ['space', 'space', 'empty cell'],
  ['group', 'block:${1:group}:${2:2}\n    columns ${3:2}\n    ${4:a} ${5:b}\nend', 'blocks inside a block'],
  ['edge', '${1:a} --> ${2:b}', 'link between blocks'],
  ['edge label', '${1:a}-- "${2:text}" -->${3:b}', 'link with a label'],
  ['arrow block', '${1:arrow}<["${2:text}"]>(${3|right,left,up,down,x,y|})', 'block shaped like an arrow'],
  ['style', 'style ${1:a} fill:${2:#f9f},stroke:${3:#333}', 'style one block'],
  ['classDef', 'classDef ${1:name} fill:${2:#f96}', 'style class'],
  ['class', 'class ${1:a} ${2:name}', 'apply a style class'],
];
const block = {
  matches: /^block/,
  docs: () => Object.fromEntries(BLOCK.map(([l, s]) => [`block ${l}`, `block-beta\n  columns 3\n  a b c\n  ${l === 'class' ? 'classDef name fill:#f96\n  ' : ''}${ex(s)}${l === 'arrow block' ? '' : ''}`])),
  provide(ctx) {
    const { before } = ctx;
    let m;
    if ((m = /\(\s*(\w*)$/.exec(before)) && /<\[/.test(before)) return enums(ctx, m[1], ['right', 'left', 'up', 'down', 'x', 'y']);
    if ((m = /^\s*([\w:-]*)$/.exec(before))) return snips(ctx, m[1], BLOCK);
    return [];
  },
};

// ---------- requirementDiagram ----------
const REQ_TYPES = ['requirement', 'functionalRequirement', 'interfaceRequirement', 'performanceRequirement', 'physicalRequirement', 'designConstraint'];
const REQ_RELATIONS = [['contains', 'parent contains child'], ['copies', 'copy of another'], ['derives', 'derived from'], ['satisfies', 'element satisfies a requirement'], ['verifies', 'element verifies a requirement'], ['refines', 'refines another'], ['traces', 'traces to another']];
const REQ = [
  ...REQ_TYPES.map((t) => [t, `${t} \${1:name} {\n    id: \${2:1}\n    text: \${3:the system shall work}\n    risk: \${4|low,medium,high|}\n    verifymethod: \${5|test,analysis,inspection,demonstration|}\n}`, 'requirement']),
  ['element', 'element ${1:name} {\n    type: ${2:simulation}\n    docref: ${3:doc1}\n}', 'element that satisfies or verifies requirements'],
  ['relationship', '${1:source} - ${2|contains,copies,derives,satisfies,verifies,refines,traces|} -> ${3:target}', 'relationship'],
];
const reqNames = (ctx) => ctx.collect(/^\s*(?:requirement|functionalRequirement|interfaceRequirement|performanceRequirement|physicalRequirement|designConstraint|element)\s+(\w+)/gm).map((n) => n.id);
const requirement = {
  matches: /^requirement/,
  docs: () => Object.fromEntries(REQ.map(([l, s]) => [`req ${l}`, l === 'relationship'
    ? `requirementDiagram\n  requirement source {\n    id: 1\n    text: t\n    risk: low\n    verifymethod: test\n  }\n  element target {\n    type: sim\n  }\n  ${ex(s).replace('target', 'source').replace('source - contains', 'target - satisfies').replace('contains', 'satisfies')}`
    : `requirementDiagram\n  ${ex(s)}`])),
  provide(ctx) {
    const { before, Kind } = ctx;
    let m;
    const body = openBraceLine(ctx);
    if (/^\s*element\s/.test(body) && (m = /^\s*(\w*)$/.exec(before))) return enums(ctx, m[1], [['type', 'kind of element'], ['docref', 'link to a document']], { suffix: ': ' });
    if (/^\s*\w*[Rr]equirement\s|^\s*designConstraint\s/.test(body)) {
      if ((m = /^\s*risk:\s*(\w*)$/.exec(before))) return enums(ctx, m[1], ['low', 'medium', 'high']);
      if ((m = /^\s*verifymethod:\s*(\w*)$/.exec(before))) return enums(ctx, m[1], ['test', 'analysis', 'inspection', 'demonstration']);
      if ((m = /^\s*(\w*)$/.exec(before))) return enums(ctx, m[1], [['id', 'requirement id'], ['text', 'requirement text'], ['risk', 'low, medium or high'], ['verifymethod', 'how to verify']], { suffix: ': ', next: true });
    }
    if ((m = /^\s*[\w-]+\s+-\s+(\w*)$/.exec(before))) return enums(ctx, m[1], REQ_RELATIONS, { suffix: ' -> ', next: true });
    if ((m = /^\s*[\w-]+\s+-\s+\w+\s+->\s+(\w*)$/.exec(before))) return reqNames(ctx).map((n, i) => ctx.item(m[1])(n, { kind: Kind.Variable, detail: 'requirement or element', sort: String(i).padStart(3, '0') }));
    if ((m = /^\s*(\w+)\s+(-?)$/.exec(before)) && reqNames(ctx).includes(m[1])) return [ctx.item(m[2])('- relation ->', { kind: Kind.Operator, insert: '- ', filter: m[2], detail: 'start a relationship', next: true })];
    if ((m = /^\s*([\w-]*)$/.exec(before))) {
      return [
        ...reqNames(ctx).map((n, i) => ctx.item(m[1])(n, { kind: Kind.Variable, insert: n + ' ', detail: 'name', next: true, sort: '0' + String(i).padStart(3, '0') })),
        ...snips(ctx, m[1], REQ),
      ];
    }
    return [];
  },
};

// ---------- C4 ----------
const q = (s) => `"\${${s}}"`;
const C4_ELEMENTS = [
  ['Person', 'Person(${1:alias}, "${2:Label}", "${3:Description}")'], ['Person_Ext', 'Person_Ext(${1:alias}, "${2:Label}", "${3:Description}")'],
  ['System', 'System(${1:alias}, "${2:Label}", "${3:Description}")'], ['System_Ext', 'System_Ext(${1:alias}, "${2:Label}", "${3:Description}")'],
  ['SystemDb', 'SystemDb(${1:alias}, "${2:Label}", "${3:Description}")'], ['SystemQueue', 'SystemQueue(${1:alias}, "${2:Label}", "${3:Description}")'],
  ['Container', 'Container(${1:alias}, "${2:Label}", "${3:Technology}", "${4:Description}")'], ['ContainerDb', 'ContainerDb(${1:alias}, "${2:Label}", "${3:Technology}", "${4:Description}")'],
  ['ContainerQueue', 'ContainerQueue(${1:alias}, "${2:Label}", "${3:Technology}", "${4:Description}")'],
  ['Component', 'Component(${1:alias}, "${2:Label}", "${3:Technology}", "${4:Description}")'], ['ComponentDb', 'ComponentDb(${1:alias}, "${2:Label}", "${3:Technology}", "${4:Description}")'],
  ['Enterprise_Boundary', 'Enterprise_Boundary(${1:alias}, "${2:Label}") {\n    ${3:System(s1, "System")}\n}'], ['System_Boundary', 'System_Boundary(${1:alias}, "${2:Label}") {\n    ${3:System(s1, "System")}\n}'],
  ['Container_Boundary', 'Container_Boundary(${1:alias}, "${2:Label}") {\n    ${3:System(s1, "System")}\n}'], ['Boundary', 'Boundary(${1:alias}, "${2:Label}", "${3:type}") {\n    ${4:System(s1, "System")}\n}'],
  ['Deployment_Node', 'Deployment_Node(${1:alias}, "${2:Label}", "${3:Type}") {\n    ${4:Container(c1, "App", "Java")}\n}'],
  ['Rel', 'Rel(${1:from}, ${2:to}, "${3:Label}", "${4:Technology}")'], ['BiRel', 'BiRel(${1:from}, ${2:to}, "${3:Label}", "${4:Technology}")'],
  ['Rel_U', 'Rel_U(${1:from}, ${2:to}, "${3:Label}")'], ['Rel_D', 'Rel_D(${1:from}, ${2:to}, "${3:Label}")'],
  ['Rel_L', 'Rel_L(${1:from}, ${2:to}, "${3:Label}")'], ['Rel_R', 'Rel_R(${1:from}, ${2:to}, "${3:Label}")'],
  ['RelIndex', 'RelIndex(${1:1}, ${2:from}, ${3:to}, "${4:Label}")'],
  ['UpdateElementStyle', 'UpdateElementStyle(${1:alias}, \\$bgColor="${2:grey}", \\$fontColor="${3:red}", \\$borderColor="${4:red}")'],
  ['UpdateRelStyle', 'UpdateRelStyle(${1:from}, ${2:to}, \\$textColor="${3:red}", \\$lineColor="${4:red}")'],
  ['UpdateLayoutConfig', 'UpdateLayoutConfig(\\$c4ShapeInRow="${1:3}", \\$c4BoundaryInRow="${2:1}")'],
  ['title', 'title ${1:Title}'],
];
const c4Aliases = (ctx) => ctx.collect(/^\s*(?!Rel|BiRel|Update|title)\w+\(\s*(\w+)\s*[,)]/gm).map((a) => a.id);
const c4 = {
  matches: /^C4/,
  docs: () => Object.fromEntries(C4_ELEMENTS.map(([l, s]) => [`c4 ${l}`, `C4Context\n  Person(a, "A")\n  System(b, "B")\n  ${ex(s)}\n  ${l.startsWith('Update') && l !== 'UpdateLayoutConfig' ? '' : ''}`.replace(/^$/, ''), ])
    .map(([n, t]) => [n, n === 'c4 RelIndex' ? t.replace('C4Context', 'C4Dynamic') : t])),
  provide(ctx) {
    const { before, Kind } = ctx;
    let m;
    if ((m = /^\s*(?:Rel\w*|BiRel)\(\s*(?:[\w$]+\s*,\s*)*(\w*)$/.exec(before)) || (m = /^\s*(?:UpdateRelStyle|UpdateElementStyle)\(\s*(?:\w+\s*,\s*)?(\w*)$/.exec(before))) {
      return c4Aliases(ctx).map((a, i) => ctx.item(m[1])(a, { kind: Kind.Variable, detail: 'element alias', sort: String(i).padStart(3, '0') }));
    }
    if ((m = /^\s*([\w-]*)$/.exec(before))) {
      return C4_ELEMENTS.map(([l, s], i) => ctx.item(m[1])(l, { kind: Kind.Snippet, insert: s, snippet: true, detail: 'C4 element', sort: String(i).padStart(3, '0') }));
    }
    return [];
  },
};

export default [mindmap, git, block, requirement, c4];
