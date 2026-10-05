import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'api-proxy-plugin',
        configureServer(server) {
          server.middlewares.use('/api/health', (_req, res) => {
            res.setHeader('Content-Type', 'text/plain');
            res.end('ok');
          });
          server.middlewares.use('/api/proxy', async (req, res) => {
            try {
              const reqUrl = new URL(req.url || '', `http://${req.headers.host}`);
              const targetUrlStr = reqUrl.searchParams.get('url');
              if (!targetUrlStr) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                return res.end(JSON.stringify({ error: { message: 'Missing url parameter' } }));
              }
              const target = new URL(targetUrlStr);
              const ALLOWED = new Set([
                'api.openai.com',
                'api.anthropic.com',
                'generativelanguage.googleapis.com',
                'api.x.ai',
                'api.tavily.com',
                'en.wikipedia.org',
              ]);
              if (target.protocol !== 'https:' || !ALLOWED.has(target.hostname)) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                return res.end(JSON.stringify({ error: { message: 'Host not allowed' } }));
              }

              const headers: Record<string, string> = {};
              const PASS = [
                'authorization',
                'x-api-key',
                'anthropic-version',
                'anthropic-dangerous-direct-browser-access',
                'x-goog-api-key',
                'content-type',
              ];
              for (const h of PASS) {
                if (req.headers[h]) headers[h] = req.headers[h] as string;
              }

              const chunks: Buffer[] = [];
              for await (const chunk of req) {
                chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
              }
              const bodyBuffer = chunks.length > 0 ? Buffer.concat(chunks) : undefined;

              const upstream = await fetch(target.href, {
                method: req.method,
                headers,
                body: ['GET', 'HEAD'].includes(req.method || '') ? undefined : bodyBuffer,
              });

              res.statusCode = upstream.status;
              const ct = upstream.headers.get('content-type');
              if (ct) res.setHeader('content-type', ct);
              res.setHeader('cache-control', 'no-store');

              if (!upstream.body) return res.end();
              const { Readable } = await import('node:stream');
              Readable.fromWeb(upstream.body as any).pipe(res);
            } catch (e: any) {
              if (!res.headersSent) {
                res.statusCode = 502;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: { message: e?.message || 'Proxy error' } }));
              } else {
                res.end();
              }
            }
          });
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
