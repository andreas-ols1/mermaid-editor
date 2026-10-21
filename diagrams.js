// Reads the diagram list from storage (localStorage in the app, a fake in scripts/check-diagrams.js).
// Keys: `diagrams` ([{ id, name, text }]) and `current` (an id). No DOM or Monaco here, so it can be tested in Node.

export const newId = () => Math.random().toString(36).slice(2); // crypto.randomUUID needs https, preview over LAN may not have it

const isDiagram = (d) => typeof d?.id === 'string' && typeof d.name === 'string' && typeof d.text === 'string';

// The old single `diagram` key becomes the first diagram. A list that can't be read is copied to
// `diagrams-broken` first, because the next save replaces `diagrams` with the new list.
export function loadDiagrams(storage, fallbackText) {
  const raw = storage.getItem('diagrams');
  let diagrams = null;
  try { diagrams = JSON.parse(raw); } catch { /* handled below */ }
  if (raw !== null && !(Array.isArray(diagrams) && diagrams.every(isDiagram))) {
    storage.setItem('diagrams-broken', raw);
    diagrams = null;
  }
  if (!diagrams?.length) diagrams = [{ id: newId(), name: 'Diagram 1', text: storage.getItem('diagram') ?? fallbackText }];
  const current = diagrams.find((d) => d.id === storage.getItem('current')) ?? diagrams[0];
  return { diagrams, current };
}
