// Vercel serverless function → /api/suggestions
//   GET  → list suggestions (sorted by score) + configured flag
//   POST → { action: 'create' | 'vote', ... }
import { handleSuggestions } from './_suggestions.js';

export default async function handler(req, res) {
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { status, json } = await handleSuggestions({ method: req.method, body });
    res.status(status).json(json);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
}
