// Vite config for the optional AI features. Without AI_TARGET (see .env.example) this is the
// plain default config: no proxy, no callback page, and the app shows no AI UI.
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const target = env.AI_TARGET?.trim();
  if (!target) return {};
  if (!target.startsWith('https://')) throw new Error('AI_TARGET must be an https URL');

  // The API sends no CORS headers, so the browser calls /ai/v1/* on its own origin and Vite forwards it.
  // Only /ai/v1/: a plain /ai prefix would also catch the app's own ai/*.js modules in dev.
  const proxy = {
    '^/ai/v1/': { target, changeOrigin: true, rewrite: (path) => path.replace(/^\/ai/, '') },
  };
  // The OAuth redirect URI is /callback (exact path), so serve callback.html there.
  const callback = (req, res, next) => {
    if (req.url === '/callback' || req.url.startsWith('/callback?')) req.url = '/callback.html' + req.url.slice(9);
    next();
  };
  return {
    // The app only shows AI UI when this is set: a static build has no proxy.
    define: { 'import.meta.env.AI_PROXY': 'true' },
    server: { proxy },
    preview: { proxy },
    build: { rolldownOptions: { input: { main: 'index.html', callback: 'callback.html' } } },
    plugins: [{
      name: 'ai-callback',
      configureServer: (server) => { server.middlewares.use(callback); },
      configurePreviewServer: (server) => { server.middlewares.use(callback); },
    }],
  };
});
