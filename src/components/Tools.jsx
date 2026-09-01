import { useState } from 'react';
import { Wrench, PenLine, Calculator, ImagePlus, Braces, Minimize2, ChevronLeft, ChevronRight } from 'lucide-react';
import PostMaker from './PostMaker.jsx';
import TokenEstimator from './TokenEstimator.jsx';
import ImageToLink from './ImageToLink.jsx';
import ImageCompressor from './ImageCompressor.jsx';
import JsonFormatter from './JsonFormatter.jsx';

const TOOLS = [
  { id: 'post', name: 'Post maker', desc: 'Turn a session into a LinkedIn or Instagram post.', icon: PenLine },
  { id: 'tokens', name: 'Token & cost estimator', desc: 'Estimate tokens and API cost for any prompt.', icon: Calculator },
  { id: 'compress', name: 'Image compressor', desc: 'Drop an image, download a lighter version. Auto-applied on every upload too.', icon: Minimize2 },
  { id: 'image', name: 'Image to link', desc: 'Drop an image or GIF, get a shareable URL.', icon: ImagePlus },
  { id: 'json', name: 'JSON formatter', desc: 'Format, validate, and minify JSON in your browser.', icon: Braces },
];

export default function Tools({ sessions = [] }) {
  // A recap can deep-link straight into the Post maker (sessionStorage handoff).
  const [active, setActive] = useState(() => {
    try { return sessionStorage.getItem('postmaker.session') ? 'post' : null; } catch { return null; }
  });

  if (active) {
    return (
      <div>
        <button
          onClick={() => setActive(null)}
          className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition-colors mb-5"
        >
          <ChevronLeft size={15} /> All tools
        </button>
        {active === 'post' && <PostMaker sessions={sessions} />}
        {active === 'tokens' && <TokenEstimator />}
        {active === 'compress' && <ImageCompressor />}
        {active === 'image' && <ImageToLink />}
        {active === 'json' && <JsonFormatter />}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-1.5 h-section">
        <Wrench size={11} strokeWidth={2.2} />
        <span>Tools</span>
      </div>
      <h1 className="text-3xl font-semibold tracking-tight mt-1">Free tools for builders</h1>
      <p className="text-sm text-muted mt-1 max-w-2xl">Free, no sign-up.</p>

      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {TOOLS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setActive(t.id)}
              className="warm-card card-interactive p-5 text-left flex flex-col h-full"
            >
              <div className="grid place-items-center w-10 h-10 rounded-xl bg-background border border-border">
                <Icon size={18} strokeWidth={2} />
              </div>
              <h2 className="mt-3 text-base font-semibold tracking-tight">{t.name}</h2>
              <p className="mt-1 text-sm text-muted leading-relaxed flex-1">{t.desc}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold">
                Open <ChevronRight size={13} strokeWidth={2.5} />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
