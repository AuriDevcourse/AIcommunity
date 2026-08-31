/*
 * Applies the saved theme before first paint, so a user who chose a theme that
 * differs from their OS does not see a flash of the wrong one.
 *
 * Deliberately a separate same-origin file rather than an inline <script>. The
 * CSP in vercel.json is `script-src 'self'` (Report-Only today, so an inline
 * script would only be reported, not blocked, but the point of Report-Only is
 * that it becomes enforcing). A hash would then have to be reissued every time
 * a byte of this file changes. A same-origin file needs no hash at all.
 *
 * Must stay in sync with src/lib/theme.js (same key, same attribute).
 */
(function () {
  try {
    var theme = localStorage.getItem('aiw.theme');
    if (theme === 'light' || theme === 'dark') {
      document.documentElement.setAttribute('data-theme', theme);
    } else {
      theme = 'system';
    }
    var dark = theme === 'dark' || (theme === 'system'
      && window.matchMedia
      && window.matchMedia('(prefers-color-scheme: dark)').matches);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', dark ? '#0B2E1E' : '#F8F0E4');
  } catch (e) {
    /* Storage blocked (private mode). The CSS media query still handles it. */
  }
})();
