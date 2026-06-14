import { FileText, AlertTriangle } from 'lucide-react';

// Per-file breakdown for the "CLAUDE.md" topic: each file shows what it does and
// the risk of not having it. size='lg' is the presentation scale, 'sm' the panel.
export default function TopicFiles({ files = [], size = 'sm' }) {
  const lg = size === 'lg';
  return (
    <div className={`flex flex-col ${lg ? 'gap-3 mt-6' : 'gap-2 mt-3'}`}>
      {files.map((f, i) => (
        <div key={i} className={`rounded-xl border border-border bg-pill ${lg ? 'p-4' : 'p-3'}`}>
          <div className="flex items-center gap-2">
            <FileText size={lg ? 16 : 13} strokeWidth={2} className="text-foreground flex-shrink-0" />
            <span className={`font-semibold tracking-tight num ${lg ? 'text-base' : 'text-sm'}`}>{f.name}</span>
          </div>
          {f.does && <p className={`text-muted leading-snug ${lg ? 'text-sm mt-1.5' : 'text-[12px] mt-1'}`}>{f.does}</p>}
          {f.risk && (
            <p className={`inline-flex items-start gap-1.5 text-warn ${lg ? 'text-sm mt-2' : 'text-[12px] mt-1.5'}`}>
              <AlertTriangle size={lg ? 14 : 12} strokeWidth={2} className="mt-0.5 flex-shrink-0" />
              <span><span className="font-medium">Without it:</span> {f.risk}</span>
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
