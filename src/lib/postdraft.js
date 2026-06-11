import { authedFetch } from './supabase.js';

// Stream a generated social post for `notes` from /api/generate-post (the same
// auth-gated, rate-limited endpoint the Post Maker uses). Calls onDelta(piece) as
// tokens arrive; resolves to { text } (full cleaned post), or { configured:false }
// when no LLM key is set. Pass an AbortSignal to cancel (stops generation + spend).
export async function streamDraft({ notes, format = 'linkedin', signal, onDelta }) {
  const r = await authedFetch('/api/generate-post', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notes, format, stream: true }),
    signal,
  });

  const ct = r.headers.get('content-type') || '';
  if (!ct.includes('text/event-stream')) {
    // Not a stream: either a JSON error, or { configured:false } (200).
    const j = await r.json().catch(() => ({}));
    if (j.configured === false) return { configured: false };
    if (!r.ok) throw new Error(j.error || `Request failed (${r.status})`);
    if (j.text) { onDelta?.(j.text); return { text: j.text }; }
    throw new Error(j.error || 'Generation failed.');
  }

  const reader = r.body.getReader();
  const dec = new TextDecoder();
  let buf = '', full = '', finalText = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop(); // keep the partial last line
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith('data:')) continue;
      let o;
      try { o = JSON.parse(t.slice(5).trim()); } catch { continue; }
      if (o.error) throw new Error(o.error);
      if (o.delta) { full += o.delta; onDelta?.(o.delta); }
      else if (o.done) finalText = o.text || full;
    }
  }
  return { text: finalText || full };
}
