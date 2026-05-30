import { useState } from 'react';
import { Calculator } from 'lucide-react';

// Rough heuristic: ~4 characters per token. Good enough for ballpark cost.
export default function TokenEstimator() {
  const [text, setText] = useState('');
  const [price, setPrice] = useState('3.00'); // $ per 1M input tokens

  const chars = text.length;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const tokens = Math.ceil(chars / 4);
  const cost = (tokens / 1_000_000) * (parseFloat(price) || 0);

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-1.5 h-section">
        <Calculator size={11} strokeWidth={2.2} />
        <span>Token & cost estimator</span>
      </div>
      <h2 className="text-3xl font-semibold tracking-tight mt-1">Estimate tokens & cost</h2>
      <p className="text-sm text-muted mt-1 max-w-2xl">Paste a prompt to get a rough token count (about 4 characters per token) and what it would cost at a given price.</p>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={8}
        placeholder="Paste your prompt or text here…"
        className="mt-5 w-full bg-background border border-border rounded-xl p-4 text-sm focus:outline-none focus:border-foreground resize-y"
      />

      <div className="mt-4 grid grid-cols-3 gap-3">
        <Stat label="Characters" value={chars.toLocaleString()} />
        <Stat label="Words" value={words.toLocaleString()} />
        <Stat label="~ Tokens" value={tokens.toLocaleString()} />
      </div>

      <div className="mt-4 card card-pad flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted">Price</span>
          <span className="text-muted">$</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="w-24 bg-background border border-border rounded-md px-2.5 py-1.5 text-sm num focus:outline-none focus:border-foreground"
          />
          <span className="text-muted">/ 1M tokens</span>
        </label>
        <div className="text-right">
          <div className="text-xs text-muted">Estimated cost</div>
          <div className="text-xl font-semibold num">${cost < 0.01 && cost > 0 ? cost.toFixed(5) : cost.toFixed(4)}</div>
        </div>
      </div>
      <p className="mt-2 text-[11px] text-muted">Estimate only. Real tokenizers vary by model; set the price to your model's input rate.</p>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="card card-pad text-center">
      <div className="text-2xl font-semibold num">{value}</div>
      <div className="text-xs text-muted mt-0.5">{label}</div>
    </div>
  );
}
