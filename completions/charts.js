// Completions for: gantt, pie, journey, timeline, quadrantChart, xychart, sankey, packet, kanban.
import { snips, enums, expandSnippet as ex } from './util.js';

const KEYWORD_LINE = /^\s*(title|section|dateFormat|axisFormat|tickInterval|excludes|includes|todayMarker|weekday|click|accTitle|accDescr|classDef|x-axis|y-axis|quadrant-\d)\b/;

// ---------- gantt ----------
const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const GANTT_TAGS = [['done', 'finished task'], ['active', 'task in progress'], ['crit', 'critical task'], ['milestone', 'milestone (duration 0)']];
const GANTT = [
  ['title', 'title ${1:Project plan}', 'chart title'],
  ['dateFormat', 'dateFormat ${1|YYYY-MM-DD,DD-MM-YYYY,MM/DD/YYYY,YYYY-MM-DD HH:mm,HH:mm|}', 'how dates are written in the tasks'],
  ['axisFormat', 'axisFormat ${1|%Y-%m-%d,%d/%m,%b %d,%H:%M,%a %d|}', 'how dates are shown on the axis'],
  ['tickInterval', 'tickInterval ${1|1day,1week,1month|}', 'distance between axis ticks'],
  ['excludes', 'excludes ${1|weekends,sunday,saturday|}', 'days that do not count'],
  ['includes', 'includes ${1:2024-01-06}', 'days that count again'],
  ['todayMarker', 'todayMarker ${1|off,stroke-width:5px|}', 'style or hide the today line'],
  ['weekday', 'weekday ${1|monday,tuesday,wednesday,thursday,friday,saturday,sunday|}', 'first day of the week'],
  ['inclusiveEndDates', 'inclusiveEndDates', 'end date is part of the task'],
  ['section', 'section ${1:Section}', 'group of tasks'],
  ['task', '${1:Task} :${2:t1}, ${3:2024-01-01}, ${4:3d}', 'task with id, start and duration'],
  ['task after', '${1:Task} :${2:t2}, after ${3:t1}, ${4:3d}', 'task that starts after another'],
  ['task done', '${1:Task} :done, ${2:t1}, ${3:2024-01-01}, ${4:3d}', 'finished task'],
  ['task active', '${1:Task} :active, ${2:t1}, ${3:2024-01-01}, ${4:3d}', 'task in progress'],
  ['task crit', '${1:Task} :crit, ${2:t1}, ${3:2024-01-01}, ${4:3d}', 'critical task'],
  ['milestone', '${1:Milestone} :milestone, ${2:m1}, ${3:2024-01-01}, 0d', 'milestone'],
];
const GANTT_VALUES = {
  dateFormat: [['YYYY-MM-DD', '2024-01-31'], ['DD-MM-YYYY', '31-01-2024'], ['MM/DD/YYYY', '01/31/2024'], ['YYYY-MM-DD HH:mm', 'date and time'], ['HH:mm', 'time only'], ['YYYY', 'year']],
  axisFormat: [['%Y-%m-%d', '2024-01-31'], ['%d/%m', '31/01'], ['%b %d', 'Jan 31'], ['%H:%M', 'time'], ['%a %d', 'Wed 31'], ['%Y', 'year']],
  excludes: [['weekends', 'saturday and sunday'], ...DAYS.map((d) => [d, 'day'])],
  includes: DAYS.map((d) => [d, 'day']),
  weekday: DAYS.map((d) => [d, 'day']),
  tickInterval: [['1day', ''], ['1week', ''], ['1month', ''], ['1hour', ''], ['2week', '']],
  todayMarker: [['off', 'hide the line'], ['stroke-width:5px', 'style the line']],
};

function ganttIds(ctx) {
  const ids = [];
  ctx.model.getLinesContent().forEach((line, i) => {
    if (i + 1 === ctx.pos.lineNumber || KEYWORD_LINE.test(line)) return;
    const m = /^[^:]+:(.*)$/.exec(line);
    if (!m) return;
    m[1].split(',').map((t) => t.trim()).forEach((t) => {
      if (/^[A-Za-z_]\w*$/.test(t) && !GANTT_TAGS.some(([g]) => g === t)) ids.push(t);
    });
  });
  return [...new Set(ids)];
}

const gantt = {
  matches: /^gantt/,
  docs: () => Object.fromEntries(GANTT.map(([l, s]) => [`gantt ${l}`, `gantt\n  dateFormat YYYY-MM-DD\n  section S\n  First :done, t1, 2024-01-01, 3d\n  ${ex(s)}`])),
  provide(ctx) {
    const { before } = ctx;
    let m;
    if ((m = /^\s*(dateFormat|axisFormat|excludes|includes|weekday|tickInterval|todayMarker)\s+(.*)$/.exec(before))) {
      return enums(ctx, /\S*$/.exec(before)[0], GANTT_VALUES[m[1]] ?? []);
    }
    if (!KEYWORD_LINE.test(before) && (m = /^\s*[^:%]+:\s*((?:[^,]*,\s*)*)([\w-]*)$/.exec(before))) {
      const typed = m[2];
      return [
        ...enums(ctx, typed, GANTT_TAGS, { suffix: ', ', next: true }),
        ...ganttIds(ctx).map((id, i) => ctx.item(typed)(`after ${id}`, { kind: ctx.Kind.Reference, insert: `after ${id}, `, detail: 'start after this task', sort: '5' + String(i).padStart(3, '0'), next: true })),
      ];
    }
    if ((m = /^\s*([\w-]*)$/.exec(before))) return snips(ctx, m[1], GANTT);
    return [];
  },
};

// ---------- pie ----------
const PIE = [
  ['title', 'title ${1:Title}', 'chart title'],
  ['slice', '"${1:Label}" : ${2:10}', 'slice with a value'],
];
const pie = {
  matches: /^pie/,
  docs: () => ({ 'pie title line': `pie\n  ${ex(PIE[0][1])}\n  ${ex(PIE[1][1])}`, 'pie slice': `pie\n  ${ex(PIE[1][1])}`, 'pie header showData': 'pie showData\n  "A" : 1', 'pie header both': 'pie showData title X\n  "A" : 1' }),
  provide(ctx) {
    const { before } = ctx;
    let m;
    if (ctx.isHeaderLine && (m = /^\s*pie\s+(?:showData\s+)?(\w*)$/.exec(before))) {
      return enums(ctx, m[1], [['showData', 'show the values in the legend'], ['title', 'chart title']], { suffix: ' ' });
    }
    if ((m = /^\s*([\w-"]*)$/.exec(before))) return snips(ctx, m[1], PIE);
    return [];
  },
};

// ---------- journey ----------
const JOURNEY = [
  ['title', 'title ${1:My day}', 'journey title'],
  ['section', 'section ${1:Section}', 'group of tasks'],
  ['task', '${1:Task}: ${2|5,4,3,2,1|}: ${3:Actor}', 'task with score and actors'],
];
const SCORES = [['5', 'very happy'], ['4', 'happy'], ['3', 'neutral'], ['2', 'unhappy'], ['1', 'very unhappy']];
const journey = {
  matches: /^journey/,
  docs: () => Object.fromEntries(JOURNEY.map(([l, s]) => [`journey ${l}`, `journey\n  section S\n    ${ex(s)}`])),
  provide(ctx) {
    const { before } = ctx;
    let m;
    if ((m = /^\s*(?!title|section)[^:]+:\s*\d\s*:\s*(?:[^,]*,\s*)*([\w ]*)$/.exec(before))) {
      const actors = new Set();
      ctx.model.getLinesContent().forEach((l, i) => {
        const a = /^\s*(?!title|section)[^:]+:\s*\d\s*:\s*(.*)$/.exec(l);
        if (a && i + 1 !== ctx.pos.lineNumber) a[1].split(',').forEach((x) => x.trim() && actors.add(x.trim()));
      });
      return [...actors].map((a, i) => ctx.item(m[1].trimStart())(a, { kind: ctx.Kind.Variable, detail: 'actor', sort: String(i).padStart(3, '0') }));
    }
    if ((m = /^\s*(?!title|section)[^:]+:\s*(\d?)$/.exec(before))) return enums(ctx, m[1], SCORES, { suffix: ': ', next: true });
    if ((m = /^\s*([\w-]*)$/.exec(before))) return snips(ctx, m[1], JOURNEY);
    return [];
  },
};

// ---------- timeline ----------
const TIMELINE = [
  ['title', 'title ${1:History}', 'timeline title'],
  ['section', 'section ${1:Section}', 'group of periods'],
  ['period', '${1:2024} : ${2:Event}', 'period with one event'],
  ['period two events', '${1:2024} : ${2:Event} : ${3:Other event}', 'period with two events'],
  ['more events', ': ${1:Event}', 'extra event for the line above'],
];
const timeline = {
  matches: /^timeline/,
  docs: () => Object.fromEntries(TIMELINE.map(([l, s]) => [`timeline ${l}`, `timeline\n  ${l === 'more events' ? '2020 : A\n  ' : ''}${ex(s)}`])),
  provide(ctx) {
    const m = /^\s*([\w:-]*)$/.exec(ctx.before);
    return m ? snips(ctx, m[1], TIMELINE) : [];
  },
};

// ---------- quadrantChart ----------
const QUADRANT = [
  ['title', 'title ${1:Title}', 'chart title'],
  ['x-axis', 'x-axis ${1:Low} --> ${2:High}', 'horizontal axis'],
  ['y-axis', 'y-axis ${1:Low} --> ${2:High}', 'vertical axis'],
  ['quadrant-1', 'quadrant-1 ${1:Top right}', 'top right label'],
  ['quadrant-2', 'quadrant-2 ${1:Top left}', 'top left label'],
  ['quadrant-3', 'quadrant-3 ${1:Bottom left}', 'bottom left label'],
  ['quadrant-4', 'quadrant-4 ${1:Bottom right}', 'bottom right label'],
  ['point', '${1:Point}: [${2:0.5}, ${3:0.5}]', 'point (x and y from 0 to 1)'],
  ['styled point', '${1:Point}: [${2:0.5}, ${3:0.5}] radius: ${4:8}, color: ${5:#ff3300}', 'point with style'],
  ['class point', '${1:Point}:::${2:name}: [${3:0.5}, ${4:0.5}]', 'point with a style class'],
  ['classDef', 'classDef ${1:name} color: ${2:#109060}, radius: ${3:8}', 'style class'],
];
const quadrant = {
  matches: /^quadrantChart/,
  docs: () => Object.fromEntries(QUADRANT.map(([l, s]) => [`quadrant ${l}`, `quadrantChart\n  ${ex(s)}\n  A: [0.5, 0.5]${l === 'class point' ? '\n  classDef name color: #109060' : ''}`])),
  provide(ctx) {
    const { before } = ctx;
    let m;
    if ((m = /^\s*[xy]-axis\s+\S.*\s+(-*>?)$/.exec(before)) && !before.includes('-->')) return [ctx.item(m[1])('-->', { kind: ctx.Kind.Operator, insert: '--> ', detail: 'axis range separator' })];
    if ((m = /^\s*([\w-]*)$/.exec(before))) return snips(ctx, m[1], QUADRANT);
    return [];
  },
};

// ---------- xychart ----------
const XYCHART = [
  ['title', 'title "${1:Title}"', 'chart title'],
  ['x-axis categories', 'x-axis [${1:jan, feb, mar}]', 'x axis with names'],
  ['x-axis range', 'x-axis "${1:Year}" ${2:2020} --> ${3:2024}', 'x axis with a number range'],
  ['y-axis', 'y-axis "${1:Revenue}" ${2:0} --> ${3:100}', 'y axis with a range'],
  ['bar', 'bar [${1:10, 40, 70}]', 'bar series'],
  ['line', 'line [${1:15, 35, 60}]', 'line series'],
];
const xychart = {
  matches: /^xychart/,
  docs: () => Object.fromEntries(XYCHART.map(([l, s]) => [`xychart ${l}`, `xychart-beta\n  ${l === 'x-axis range' ? '' : 'x-axis [a, b, c]\n  '}${ex(s)}${/bar|line/.test(l) ? '' : '\n  line [1, 2, 3]'}`])),
  provide(ctx) {
    const { before } = ctx;
    let m;
    if (ctx.isHeaderLine && (m = /^\s*xychart(?:-beta)?\s+(\w*)$/.exec(before))) return enums(ctx, m[1], [['horizontal', 'bars go to the right']]);
    if ((m = /^\s*([\w-]*)$/.exec(before))) return snips(ctx, m[1], XYCHART);
    return [];
  },
};

// ---------- sankey ----------
const SANKEY = [['flow', '${1:Source},${2:Target},${3:10}', 'flow from source to target']];
const sankey = {
  matches: /^sankey/,
  docs: () => ({ 'sankey flow': `sankey-beta\n\n${ex(SANKEY[0][1])}` }),
  provide(ctx) {
    const m = /^\s*([\w-]*)$/.exec(ctx.before);
    return m ? snips(ctx, m[1], SANKEY) : [];
  },
};

// ---------- packet ----------
const PACKET = [
  ['title', 'title ${1:Packet}', 'diagram title'],
  ['bits', '${1:0}-${2:15}: "${3:Label}"', 'field from bit to bit'],
  ['relative bits', '+${1:16}: "${2:Label}"', 'field of N bits after the last one'],
  ['single bit', '${1:0}: "${2:Flag}"', 'one bit'],
];
const packet = {
  matches: /^packet/,
  docs: () => Object.fromEntries(PACKET.map(([l, s]) => [`packet ${l}`, `packet-beta\n  ${ex(s)}`])),
  provide(ctx) {
    const m = /^\s*([\w+-]*)$/.exec(ctx.before);
    return m ? snips(ctx, m[1], PACKET) : [];
  },
};

// ---------- kanban ----------
const KANBAN = [
  ['column', '${1:todo}[${2:Todo}]', 'column'],
  ['task', '${1:task1}[${2:Task}]', 'task (indent it under a column)'],
  ['task with details', "${1:task1}[${2:Task}]@{ ticket: ${3:ID-1}, assigned: '${4:name}', priority: '${5|Very High,High,Low,Very Low|}' }", 'task with ticket, owner and priority'],
];
const kanban = {
  matches: /^kanban/,
  docs: () => Object.fromEntries(KANBAN.map(([l, s]) => [`kanban ${l}`, `kanban\n  c1[C]\n${l === 'column' ? ex(s) : '    ' + ex(s)}`])),
  provide(ctx) {
    const { before } = ctx;
    let m;
    if ((m = /@\{[^}]*\bpriority:\s*'?([\w ]*)$/.exec(before))) return enums(ctx, m[1], ['Very High', 'High', 'Low', 'Very Low']);
    if ((m = /@\{\s*(?:[^}]*,\s*)?(\w*)$/.exec(before))) return enums(ctx, m[1], [['ticket', 'ticket id'], ['assigned', 'owner'], ['priority', 'Very High, High, Low or Very Low']].map(([k, d]) => [k, d]), { suffix: ': ' });
    if ((m = /^\s*([\w-]*)$/.exec(before))) return snips(ctx, m[1], KANBAN);
    return [];
  },
};

export default [gantt, pie, journey, timeline, quadrant, xychart, sankey, packet, kanban];
