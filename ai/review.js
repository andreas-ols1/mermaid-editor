// Review overlay: a read-only diff of the current text and the AI's suggestion.
// review({ original, modified, font }) -> Promise<'accept' | 'new' | 'reject'>.
// font: { fontFamily, fontSize }, the main editor's, so the diff looks the same.
// Ctrl/Cmd+Enter accepts, Esc rejects. The temporary models are disposed on close.
import * as monaco from 'monaco-editor';

const overlay = document.getElementById('review');
const host = document.getElementById('review-diff');

export function review({ original, modified, font }) {
  const models = { original: monaco.editor.createModel(original, 'mermaid'), modified: monaco.editor.createModel(modified, 'mermaid') };
  overlay.hidden = false;
  const diff = monaco.editor.createDiffEditor(host, {
    readOnly: true,
    originalEditable: false,
    automaticLayout: true,
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    renderOverviewRuler: false,
    ...font,
  });
  diff.setModel(models);

  return new Promise((resolve) => {
    const close = (choice) => {
      removeEventListener('keydown', onKey, true);
      overlay.removeEventListener('click', onClick);
      diff.dispose();
      models.original.dispose();
      models.modified.dispose();
      overlay.hidden = true;
      resolve(choice);
    };
    // Capture phase, so the diff editor does not handle these keys first.
    const onKey = (e) => {
      if (e.key === 'Escape') close('reject');
      else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) close('accept');
      else return;
      e.preventDefault();
      e.stopPropagation();
    };
    const onClick = (e) => {
      const act = e.target.closest('button[data-act]')?.dataset.act;
      if (act) close(act);
    };
    addEventListener('keydown', onKey, true);
    overlay.addEventListener('click', onClick);
    overlay.querySelector('[data-act="accept"]').focus();
  });
}
