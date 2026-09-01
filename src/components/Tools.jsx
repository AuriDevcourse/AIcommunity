import { useState } from 'react';
import { Wrench, PenLine, ImagePlus, ChevronLeft, ChevronRight } from 'lucide-react';
import PostMaker from './PostMaker.jsx';
import ImageToLink from './ImageToLink.jsx';

// Two tools, both of which do something this community actually needs and
// neither of which duplicates a thing you can get in a browser tab. The token
// estimator, image compressor and JSON formatter were removed on 2026-09-01:
// generic utilities that any number of sites already do, and three more surfaces
// to keep accessible and secure for no gain.
//
// BOTH of these call auth-gated routes (/api/generate-post, /api/upload-image),
// so the page can no longer claim "no sign-up".
const TOOLS = [
  { id: 'post', name: 'Post maker', desc: 'Turn a session into a LinkedIn or Instagram post.', icon: PenLine },
  { id: 'image', name: 'Image to link', desc: 'Drop an image or GIF, get a shareable URL.', icon: ImagePlus },
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
        {active === 'image' && <ImageToLink />}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-1.5 h-section">
        <Wrench size={11} strokeWidth={2.2} />
        <span>Tools</span>
      </div>
      <h1 className="text-3xl font-semibold tracking-tight mt-1">Tools for the community</h1>
      {/* Both tools write through an authenticated route, so the old "Free, no
          sign-up" line was simply untrue: you filled the whole form in and then
          got a 401. Say it before they start, not after. */}
      <p className="text-sm text-muted mt-1 max-w-2xl">Free to use, sign in to run them.</p>

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
