import { useState } from 'react';
import { Braces, Copy, Check } from 'lucide-react';

export default function JsonFormatter() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  function run(minify) {
    setError(''); setCopied(false);
    if (!input.trim()) { setOutput(''); return; }
    try {
      const parsed = JSON.parse(input);
      setOutput(JSON.stringify(parsed, null, minify ? 0 : 2));
    } catch (e) {
      setOutput('');
      setError(e.message || 'Invalid JSON');
    }
  }

  async function copy() {
    try { await navigator.clipboard.writeText(output); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-1.5 h-section">
        <Braces size={11} strokeWidth={2.2} />
        <span>JSON formatter</span>
      </div>
      <h1 className="text-3xl font-semibold tracking-tight mt-1">Format & validate JSON</h1>
      <p className="text-sm text-muted mt-1 max-w-2xl">Pretty-print or minify JSON, and catch errors. Runs in your browser.</p>

      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        rows={8}
        placeholder='{"paste":"your JSON here"}'
        className="mt-5 w-full bg-background border border-border rounded-xl p-4 text-sm num focus:outline-none focus:border-foreground resize-y"
      />

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={() => run(false)} className="rounded-full bg-foreground text-background px-4 py-2 text-sm font-semibold transition-transform hover:scale-[1.02]">Format</button>
        <button onClick={() => run(true)} className="rounded-full border border-border bg-pill px-4 py-2 text-sm font-medium hover:bg-accent transition-colors">Minify</button>
        {error && <span className="text-xs text-err">{error}</span>}
        {!error && output && <span className="inline-flex items-center gap-1 text-xs text-ok"><Check size={12} strokeWidth={2.5} /> Valid</span>}
      </div>

      {output && (
        <div className="mt-4 relative">
          <pre className="rounded-xl bg-accent border border-border p-4 pr-12 text-xs num overflow-x-auto max-h-[420px] overflow-y-auto"><code>{output}</code></pre>
          <button onClick={copy} className="absolute top-2.5 right-2.5 grid place-items-center w-8 h-8 rounded-lg bg-background border border-border text-muted hover:text-foreground transition-colors" aria-label="Copy">
            {copied ? <Check size={15} strokeWidth={2.5} className="text-ok" /> : <Copy size={15} />}
          </button>
        </div>
      )}
    </div>
  );
}
