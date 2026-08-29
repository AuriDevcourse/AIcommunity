import { Component } from 'react';

// One malformed record in data.json / news.json used to throw during render and
// leave a blank white page with the reason only in the console. Catch it, show
// what broke, and keep the rest of the shell usable.
//
// Scope: render, lifecycle and constructor errors ONLY. React boundaries do NOT
// catch errors thrown in event handlers, promises, or timers — those still need
// local try/catch (see the fetch helpers in TopicPoll/FeedbackButton) and are
// surfaced by the unhandledrejection listener in main.jsx.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Dashboard crashed:', error, info?.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="min-h-full flex items-center justify-center p-6">
        <div className="card card-pad max-w-lg w-full">
          <div className="h-section">Something broke</div>
          <h1 className="mt-2 text-xl font-semibold tracking-tight">This view failed to render</h1>
          <p className="mt-2 text-sm text-muted">
            Usually a malformed record in <span className="font-mono text-foreground">data/</span>. Re-run{' '}
            <span className="font-mono text-foreground">npm run build:data</span> and check the JSON files.
          </p>
          <pre className="mt-4 max-h-48 overflow-auto rounded-md border border-border bg-accent p-3 text-xs text-foreground whitespace-pre-wrap">
            {String(error?.message || error)}
          </pre>
          {/* No "Try again": re-rendering the same children with the same data
              just throws again. Switching tabs remounts this boundary (it is
              keyed on the tab), and Reload is the only action that can help. */}
          <div className="mt-4">
            <button
              onClick={() => window.location.reload()}
              className="rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background transition-transform hover:scale-[1.02]"
            >
              Reload
            </button>
          </div>
        </div>
      </div>
    );
  }
}
