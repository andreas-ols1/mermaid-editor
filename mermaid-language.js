// Monaco language definition for Mermaid (Monarch tokenizer).
// Covers architecture-beta in detail and the common keywords of other diagram types.
export function registerMermaid(monaco) {
  monaco.languages.register({ id: 'mermaid' });

  monaco.languages.setLanguageConfiguration('mermaid', {
    comments: { lineComment: '%%' },
    brackets: [['(', ')'], ['[', ']'], ['{', '}']],
    autoClosingPairs: [
      { open: '(', close: ')' },
      { open: '[', close: ']' },
      { open: '{', close: '}' },
      { open: '"', close: '"' },
    ],
    surroundingPairs: [
      { open: '(', close: ')' },
      { open: '[', close: ']' },
      { open: '"', close: '"' },
    ],
  });

  monaco.languages.setMonarchTokensProvider('mermaid', {
    diagramTypes: [
      'architecture-beta', 'flowchart', 'graph', 'sequenceDiagram', 'classDiagram',
      'stateDiagram', 'stateDiagram-v2', 'erDiagram', 'gantt', 'pie', 'journey',
      'mindmap', 'timeline', 'gitGraph', 'quadrantChart', 'xychart-beta', 'block-beta',
      'sankey-beta', 'packet-beta', 'kanban', 'requirementDiagram', 'C4Context',
    ],
    keywords: [
      // architecture-beta
      'group', 'service', 'junction', 'in', 'align', 'row', 'column',
      // flowchart / general
      'subgraph', 'end', 'direction', 'style', 'classDef', 'class', 'click', 'linkStyle',
      // sequence
      'participant', 'actor', 'activate', 'deactivate', 'loop', 'alt', 'else', 'opt',
      'par', 'and', 'note', 'over', 'of', 'autonumber', 'title',
      // state / class / er / gantt
      'state', 'section', 'dateFormat', 'axisFormat',
    ],
    directions: ['TB', 'TD', 'BT', 'RL', 'LR'],

    tokenizer: {
      root: [
        // Frontmatter block: --- ... ---
        [/^---\s*$/, { token: 'comment.frontmatter', next: '@frontmatter' }],
        [/%%.*$/, 'comment'],

        // Icon: (cloud) or (logos:aws-lambda)
        [/\(([\w-]+(?::[\w-]+)?)\)/, 'type'],
        // Label: [Some text]
        [/\[[^\]]*\]/, 'string'],
        [/"[^"]*"/, 'string'],

        // Port sides: id:R  or  L:id
        [/:[TBLR](?=\s|$)/, 'constant'],
        [/\b[TBLR](?=:[\w-])/, 'constant'],

        // Edge operators
        [/<?--+>?|~~~+|==+>?|-\.+->?/, 'operator'],

        // Words
        [/[A-Za-z][\w-]*/, {
          cases: {
            '@diagramTypes': 'keyword.control',
            '@keywords': 'keyword',
            '@directions': 'constant',
            '@default': 'identifier',
          },
        }],
        [/\d+(\.\d+)?/, 'number'],
        [/[{}()\[\]]/, '@brackets'],
      ],
      frontmatter: [
        [/^---\s*$/, { token: 'comment.frontmatter', next: '@pop' }],
        [/^\s*[\w-]+(?=:)/, 'variable'],
        [/-?\d+(\.\d+)?/, 'number'],
        [/(true|false)/, 'keyword'],
        [/.*/, 'string'],
      ],
    },
  });
}
