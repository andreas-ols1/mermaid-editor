// One Dark Pro theme for Monaco (colors from the VS Code "One Dark Pro" theme).
export function registerOneDarkPro(monaco) {
  monaco.editor.defineTheme('one-dark-pro', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: '', foreground: 'abb2bf', background: '282c34' },
      { token: 'comment', foreground: '5c6370', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'c678dd' },
      { token: 'string', foreground: '98c379' },
      { token: 'number', foreground: 'd19a66' },
      { token: 'type', foreground: 'e5c07b' },
      { token: 'constant', foreground: 'd19a66' },
      { token: 'operator', foreground: '56b6c2' },
      { token: 'variable', foreground: 'e06c75' },
      { token: 'identifier', foreground: 'abb2bf' },
      { token: 'delimiter', foreground: 'abb2bf' },
    ],
    colors: {
      'editor.background': '#282c34',
      'editor.foreground': '#abb2bf',
      'editorLineNumber.foreground': '#4b5263',
      'editorLineNumber.activeForeground': '#abb2bf',
      'editor.lineHighlightBackground': '#2c313c',
      'editor.selectionBackground': '#3e4451',
      'editor.inactiveSelectionBackground': '#3a3f4b',
      'editorCursor.foreground': '#528bff',
      'editorIndentGuide.background1': '#3b4048',
      'editorIndentGuide.activeBackground1': '#c8c8c859',
      'editorWhitespace.foreground': '#3b4048',
      'editorBracketMatch.background': '#515a6b',
      'editorBracketMatch.border': '#515a6b',
      'editorWidget.background': '#21252b',
      'editorWidget.border': '#181a1f',
      'scrollbarSlider.background': '#4e566660',
      'scrollbarSlider.hoverBackground': '#5a637580',
    },
  });
}
