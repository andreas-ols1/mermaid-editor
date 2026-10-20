// architecture-beta completions.
const BUILTIN_ICONS = ['cloud', 'database', 'disk', 'internet', 'server'];
const SIDES = [['T', 'top'], ['B', 'bottom'], ['L', 'left'], ['R', 'right']];
const OPERATORS = [
  ['--', 'line'], ['-->', 'arrow to the right side'], ['<--', 'arrow to the left side'], ['<-->', 'arrows on both sides'],
];

export default {
  matches: /^architecture/,

  init(monaco, packs) {
    // Build the icon list once (mdi has thousands of names). Packs are loaders, so this is async.
    let iconCache;
    const icons = () =>
      (iconCache ??= Promise.all(Object.entries(packs).map(async ([pack, load]) => {
        const data = await load();
        return [...Object.keys(data.icons ?? {}), ...Object.keys(data.aliases ?? {})].map((name) => ({ pack, name: `${pack}:${name}` }));
      })).then((lists) => lists.flat()));

    const nodesIn = (ctx) => ctx.collect(/^\s*(?:service|junction)\s+([\w-]+)(?:\([^)]*\))?(?:\[([^\]]*)\])?/gm);
    const groupsIn = (ctx) => ctx.collect(/^\s*group\s+([\w-]+)(?:\([^)]*\))?(?:\[([^\]]*)\])?/gm);

    return {
      matches: this.matches,
      provide(ctx) {
        const { before, Kind } = ctx;
        let m;

        // Icon inside the parentheses: service id(<here>)
        if ((m = /^\s*(?:service|group)\s+[\w-]+\(([\w:-]*)$/.exec(before))) {
          const mk = ctx.item(m[1]);
          return icons().then((list) => [
            ...BUILTIN_ICONS.map((name) => mk(name, { kind: Kind.Value, detail: 'built-in icon', sort: '0' + name })),
            ...list.map(({ pack, name }) => mk(name, { kind: Kind.Value, detail: `${pack} icon`, sort: '1' + name })),
          ]);
        }

        // Parent group after "in": service id(icon)[Label] in <here>
        if ((m = /^\s*(?:service|junction|group)\s.*\bin\s+([\w-]*)$/.exec(before))) {
          const mk = ctx.item(m[1]);
          return groupsIn(ctx).map(({ id, extra }) => mk(id, { kind: Kind.Module, detail: extra ? `group: ${extra}` : 'group' }));
        }

        // align row|column
        if ((m = /^\s*align\s+([\w-]*)$/.exec(before))) {
          const mk = ctx.item(m[1]);
          return ['row', 'column'].map((w, i) => mk(w, {
            insert: w + ' ', next: true, sort: String(i), detail: w === 'row' ? 'same y, left to right' : 'same x, top to bottom',
          }));
        }
        if ((m = /^\s*align\s+(?:row|column)\s+(?:[\w-]+\s+)*([\w-]*)$/.exec(before))) {
          const mk = ctx.item(m[1]);
          return nodesIn(ctx).map(({ id, extra }) => mk(id, { kind: Kind.Variable, insert: id + ' ', detail: extra, next: true }));
        }

        // {group}: connect an edge to a group border:  a:R -- L:b{group}
        if ((m = /\{(\w*)$/.exec(before)) && /:[TBLR]|[TBLR]:/.test(before)) {
          return [ctx.item(m[1])('group', { kind: Kind.Keyword, detail: 'connect the edge to the group border' })];
        }

        // After "id:" or "SIDE:" in an edge.
        if ((m = /([\w-]+):([TBLR]?)$/.exec(before))) {
          const mk = ctx.item(m[2]);
          const secondEnd = /^[TBLR]$/.test(m[1]) && /(^|[\s>-])[TBLR]:$/.test(before.slice(0, before.length - m[2].length));
          if (secondEnd) {
            return nodesIn(ctx).map(({ id, extra }) => mk(id, { kind: Kind.Variable, detail: extra }));
          }
          return SIDES.map(([s, d], i) => mk(s, { kind: Kind.EnumMember, insert: s + ' ', detail: d, next: true, sort: String(i) }));
        }

        // Edge operator after the first side: "gw:R <here>"
        if ((m = /:[TBLR]\s+([<-]*)$/.exec(before))) {
          const mk = ctx.item(m[1]);
          return OPERATORS.map(([op, d], i) => mk(op, { kind: Kind.Operator, insert: op + ' ', detail: d, next: true, sort: String(i) }));
        }

        // Side of the second endpoint: "gw:R -- <here>"
        if ((m = /:[TBLR]\s+(?:<-+>?|-+>?)\s+([TBLR]?)$/.exec(before))) {
          const mk = ctx.item(m[1]);
          return SIDES.map(([s, d], i) => mk(s + ':', { kind: Kind.EnumMember, detail: d, next: true, sort: String(i) }));
        }

        // Start of a line: keywords, or the first id of an edge.
        if ((m = /^\s*([\w-]*)$/.exec(before))) {
          const mk = ctx.item(m[1]);
          const snip = (label, insert, detail) => mk(label, { kind: Kind.Snippet, insert, snippet: true, detail });
          return [
            snip('service', 'service ${1:id}(${2:server})[${3:Label}]', 'service'),
            snip('service in group', 'service ${1:id}(${2:server})[${3:Label}] in ${4:group}', 'service inside a group'),
            snip('group', 'group ${1:id}(${2:cloud})[${3:Label}]', 'group'),
            snip('junction', 'junction ${1:id}', 'invisible junction'),
            snip('align row', 'align row ${1:a} ${2:b}', 'align services in a row'),
            snip('align column', 'align column ${1:a} ${2:b}', 'align services in a column'),
            ...nodesIn(ctx).map(({ id, extra }) => mk(id, {
              kind: Kind.Variable, insert: id + ':', detail: `edge from ${extra || id}`, next: true, sort: 'z' + id,
            })),
          ];
        }
        return [];
      },
    };
  },
};
