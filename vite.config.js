import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { appendFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const FEEDBACK_FILE = join(process.cwd(), 'data', 'feedback.md');

function feedbackPlugin() {
  return {
    name: 'feedback-api',
    configureServer(server) {
      server.middlewares.use('/api/feedback', (req, res) => {
        if (req.method === 'GET') {
          const md = existsSync(FEEDBACK_FILE) ? readFileSync(FEEDBACK_FILE, 'utf8') : '';
          const entries = [...md.matchAll(/^## (.+?)\n\*\*(.+?)\*\* — (.+?)\n\n([\s\S]*?)(?=\n---|\n## |$)/gm)]
            .map((m) => ({ timestamp: m[1], category: m[2], from: m[3], text: m[4].trim() }));
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ entries: entries.reverse() }));
          return;
        }
        if (req.method === 'POST') {
          let body = '';
          req.on('data', (chunk) => { body += chunk; });
          req.on('end', () => {
            try {
              const { text, category = 'general', from = 'anon' } = JSON.parse(body);
              if (!text || typeof text !== 'string' || text.trim().length === 0) {
                res.statusCode = 400;
                res.end(JSON.stringify({ ok: false, error: 'empty text' }));
                return;
              }
              const ts = new Date().toISOString().replace('T', ' ').slice(0, 16);
              const safeText = text.trim().replace(/\r/g, '');
              const entry = `\n## ${ts}\n**${category}** — ${from || 'anon'}\n\n${safeText}\n\n---\n`;
              appendFileSync(FEEDBACK_FILE, entry);
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ ok: true, timestamp: ts }));
            } catch (e) {
              res.statusCode = 500;
              res.end(JSON.stringify({ ok: false, error: e.message }));
            }
          });
          return;
        }
        res.statusCode = 405;
        res.end();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), feedbackPlugin()],
  server: { port: 5280, open: true, strictPort: true },
});
