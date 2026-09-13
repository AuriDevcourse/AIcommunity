// Which decks a reader has finished, and where they stopped in the ones they
// have not. Per-browser only: this is a convenience so a 22-slide deck can be
// picked up again, not a record worth syncing. Nothing here reaches the server.
//
// Every accessor is wrapped, because localStorage throws outright in private
// Safari and can come back empty after a site-data clear. A reader with storage
// blocked gets the deck with no memory of it, which is the correct degradation.

const KEY = 'ais.learn.progress.v1';

/** @returns {Record<string, {slide: number, done: boolean}>} */
export function readProgress() {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * Records the furthest slide reached. `done` latches on: revisiting a finished
 * deck and closing it at slide 2 should not un-finish it.
 */
export function saveProgress(id, slide, done) {
  try {
    const all = readProgress();
    const prev = all[id] || { slide: 0, done: false };
    all[id] = { slide: Math.max(prev.slide, slide), done: prev.done || done };
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch { /* storage blocked, carry on without memory */ }
}

export function clearProgress(id) {
  try {
    const all = readProgress();
    delete all[id];
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch { /* ignore */ }
}
