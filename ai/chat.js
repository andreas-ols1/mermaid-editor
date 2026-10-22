// One chat turn: ask the model, take the diagram out of the reply and check it with mermaid.parse.
// A diagram that does not parse goes back to the model, at most REPAIRS times.
// No DOM and no provider details here.
import mermaid from 'mermaid';
import { complete } from './provider.js';
import { SYSTEM, userTurn, repairTurn } from './prompts.js';

const REPAIRS = 2;

// The first ```mermaid block (an untagged ``` block also counts). Returns null if there is none.
export function extract(reply) {
  const m = /```(?:mermaid|mmd)?[ \t]*\r?\n([\s\S]*?)```/i.exec(reply);
  return m ? { code: m[1].replace(/\s+$/, '') + '\n', prose: reply.replace(m[0], '').trim() } : null;
}

// history: earlier [{ role, content }] messages. Returns { reply, candidate }: candidate is a
// diagram that parses, or null if the model only answered in text.
export async function ask({ request, text, error, history, signal }) {
  const messages = [...history, { role: 'user', content: userTurn({ request, text, error }) }];
  for (let round = 0; ; round++) {
    const reply = await complete({ system: SYSTEM, messages, signal });
    const block = extract(reply);
    if (!block) return { reply: reply.trim(), candidate: null };
    let problem;
    try {
      await mermaid.parse(block.code);
      return { reply: block.prose, candidate: block.code };
    } catch (e) {
      problem = e?.message ?? String(e);
    }
    if (round === REPAIRS) throw new Error(`Could not get a valid diagram from the AI. Last error:\n${problem}`);
    messages.push({ role: 'assistant', content: reply }, { role: 'user', content: repairTurn(problem) });
  }
}
