// One provider-agnostic call: complete({ system, messages, signal }) -> reply text.
// The format (VITE_AI_FORMAT) picks the request shape. Requests go to /ai/*, the same-origin
// proxy in vite.config.js, because the API sends no CORS headers.
import { ai } from './config.js';
import { authHeader, signOut, SignInRequired } from './auth.js';

const FORMATS = {
  // OpenAI-compatible: the system prompt is the first message.
  openai: {
    path: '/v1/chat/completions',
    body: ({ system, messages }) => ({ model: ai.model, max_tokens: 4096, messages: [{ role: 'system', content: system }, ...messages] }),
    text: (data) => data?.choices?.[0]?.message?.content,
  },
  // Anthropic-compatible: top-level system prompt, the reply is a list of content blocks.
  anthropic: {
    path: '/v1/messages',
    body: ({ system, messages }) => ({ model: ai.model, max_tokens: 4096, system, messages }),
    text: (data) => data?.content?.filter((b) => b.type === 'text').map((b) => b.text).join(''),
  },
};

export class AIError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export async function complete({ system, messages, signal }) {
  const format = FORMATS[ai.format];
  const send = async (force) => fetch('/ai' + format.path, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json', ...(await authHeader({ force })) },
    body: JSON.stringify(format.body({ system, messages })),
  });
  let res = await send(false);
  if (res.status === 401) res = await send(true); // refresh the token once and retry
  if (res.status === 401) {
    signOut();
    throw new SignInRequired('Your session expired. Sign in again.');
  }
  if (!res.ok) throw new AIError(await statusMessage(res), res.status);
  const text = format.text(await res.json());
  if (typeof text !== 'string' || !text.trim()) throw new AIError('The AI returned an empty reply.', res.status);
  return text;
}

async function statusMessage(res) {
  const retry = res.headers.get('Retry-After');
  const later = !retry ? ' Try again later.' : /^\d+$/.test(retry) ? ` Try again in ${retry} s.` : ` Try again after ${retry}.`;
  switch (res.status) {
    case 403: return 'The AI endpoint denied access (403). Your account may not have access to this model.';
    case 429: return 'Too many requests (429).' + later;
    case 503: return 'The AI endpoint is unavailable (503).' + later;
    default: {
      // Show the server's own error message if it has one (as text only, it is untrusted).
      const detail = await res.json().then((d) => d?.error?.message ?? d?.message, () => null);
      return `The AI request failed (${res.status})` + (typeof detail === 'string' ? `: ${detail.slice(0, 300)}` : '.');
    }
  }
}
