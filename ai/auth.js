// OAuth 2.0 authorization code flow with PKCE (S256) for a public client: no client secret.
// Endpoints come from RFC 8414 discovery. Sign-in runs in a popup that returns to /callback
// (callback.html). Tokens live in sessionStorage, so they last for this tab only.
// Never log tokens.
import { ai } from './config.js';

const TOKENS = 'ai-tokens';
const PKCE = 'ai-pkce';
const redirectUri = () => location.origin + '/callback';

// Thrown when the user has to sign in (again).
export class SignInRequired extends Error {}

const listeners = new Set();
export const onAuthChange = (f) => listeners.add(f);
const changed = () => listeners.forEach((f) => f(isSignedIn()));

let discovery;
function discover() {
  discovery ??= fetch(`${ai.issuer}/.well-known/oauth-authorization-server`)
    .then((r) => {
      if (!r.ok) throw new Error(`OAuth discovery failed (${r.status})`);
      return r.json();
    })
    .catch((e) => { discovery = null; throw e; }); // try again next time
  return discovery;
}

const b64url = (bytes) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const random = (n) => b64url(crypto.getRandomValues(new Uint8Array(n)));

const load = () => JSON.parse(sessionStorage.getItem(TOKENS) || 'null');
export const isSignedIn = () => Boolean(load());

export function signOut() {
  sessionStorage.removeItem(TOKENS);
  changed();
}

async function tokenRequest(params) {
  const { token_endpoint } = await discover();
  const res = await fetch(token_endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: ai.clientId, ...params }),
  });
  if (!res.ok) throw new Error(`Token request failed (${res.status})`);
  const t = await res.json();
  if (!t.access_token) throw new Error('Token response has no access token');
  sessionStorage.setItem(TOKENS, JSON.stringify({
    access: t.access_token,
    refresh: t.refresh_token ?? load()?.refresh, // keep the old one if the server does not rotate it
    expiresAt: Date.now() + (t.expires_in ?? 3600) * 1000,
  }));
  changed();
}

// --- Sign in ---------------------------------------------------------------
// The popup is opened right away (before any await), or the browser blocks it as not user-initiated.
// callback.html posts { code, state } to the opener, and also on a BroadcastChannel in case the
// sign-in page cut the opener link. Both are same-origin only.
let pending = null; // AbortController of the sign-in in progress
// signal (optional) cancels it, for example the chat's Stop button.
export async function signIn({ signal } = {}) {
  pending?.abort(); // a new click starts over (the old popup may have been closed)
  const popup = window.open('about:blank', 'ai-sign-in', 'popup,width=520,height=680');
  if (!popup) throw new Error('The sign-in popup was blocked. Allow popups for this page.');
  const ctrl = (pending = new AbortController());
  signal?.addEventListener('abort', () => ctrl.abort());
  try {
    const { authorization_endpoint } = await discover();
    const verifier = random(32);
    const state = random(16);
    sessionStorage.setItem(PKCE, JSON.stringify({ verifier, state }));
    const challenge = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
    const url = new URL(authorization_endpoint);
    url.search = new URLSearchParams({
      response_type: 'code',
      client_id: ai.clientId,
      redirect_uri: redirectUri(),
      code_challenge: challenge,
      code_challenge_method: 'S256',
      state,
      ...(ai.scope && { scope: ai.scope }),
    });
    popup.location.href = url.href;
    const code = await waitForCode(ctrl.signal);
    const saved = JSON.parse(sessionStorage.getItem(PKCE) || 'null');
    if (!saved) throw new Error('Sign-in state was lost. Try again.');
    await tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: redirectUri(), code_verifier: saved.verifier });
  } catch (e) {
    if (pending === ctrl) popup.close(); // a newer sign-in reuses the same popup window
    throw e;
  } finally {
    if (pending === ctrl) { pending = null; sessionStorage.removeItem(PKCE); }
  }
}

function waitForCode(signal) {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new Error('Sign-in was cancelled'));
    const channel = new BroadcastChannel('ai-auth');
    const timeout = setTimeout(() => done(new Error('Sign-in timed out')), 5 * 60_000);
    const done = (err, code) => {
      clearTimeout(timeout);
      removeEventListener('message', onMessage);
      channel.close();
      err ? reject(err) : resolve(code);
    };
    const handle = (data) => {
      if (data?.type !== 'ai-auth') return;
      const saved = JSON.parse(sessionStorage.getItem(PKCE) || 'null');
      if (!saved || data.state !== saved.state) return; // not our sign-in: ignore
      if (data.error || !data.code) done(new Error(`Sign-in failed: ${data.error || 'no code'}`));
      else done(null, data.code);
    };
    const onMessage = (e) => { if (e.origin === location.origin) handle(e.data); };
    addEventListener('message', onMessage);
    channel.onmessage = (e) => handle(e.data);
    signal.addEventListener('abort', () => done(new Error('Sign-in was cancelled')));
  });
}

// --- Access token ----------------------------------------------------------
// Refreshes 60 s before expiry, or when forced (after a 401). A failed refresh signs out.
let refreshing = null;
function refresh() {
  refreshing ??= (async () => {
    const t = load();
    try {
      if (!t?.refresh) throw new Error('no refresh token');
      await tokenRequest({ grant_type: 'refresh_token', refresh_token: t.refresh });
      return load();
    } catch {
      signOut();
      throw new SignInRequired('Your session expired. Sign in again.');
    }
  })().finally(() => (refreshing = null));
  return refreshing;
}

export async function authHeader({ force = false } = {}) {
  let t = load();
  if (!t) throw new SignInRequired('Sign in to use AI.');
  if (force || Date.now() > t.expiresAt - 60_000) t = await refresh();
  return { Authorization: `Bearer ${t.access}` };
}
