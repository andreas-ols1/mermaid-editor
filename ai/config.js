// AI settings, all from env (see .env.example). There are no defaults: with any value missing,
// or without the dev/preview proxy (AI_PROXY, set by vite.config.js), the app has no AI features.
const env = import.meta.env; // AI_PROXY is a define, so it is read literally below

export const ai = {
  issuer: env.VITE_AI_ISSUER?.trim().replace(/\/$/, ''),
  clientId: env.VITE_AI_CLIENT_ID?.trim(),
  scope: env.VITE_AI_SCOPE?.trim() ?? '',
  model: env.VITE_AI_MODEL?.trim(),
  format: env.VITE_AI_FORMAT?.trim(), // openai | anthropic
};

export const aiEnabled = Boolean(import.meta.env.AI_PROXY && ai.issuer && ai.clientId && ai.model)
  && ['openai', 'anthropic'].includes(ai.format);
