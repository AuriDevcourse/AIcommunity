/* /forening/ page script.
 *
 * Two jobs: the DA/EN toggle on the statutes, and the form that builds a
 * member's details into a plain-text block they can paste into WhatsApp.
 *
 * Nothing is submitted, stored or sent anywhere. Everything happens in the
 * browser, which is the honest thing to do with a form that asks for a home
 * address and a date of birth.
 *
 * A separate file rather than inline because the site's CSP is script-src
 * 'self', which blocks inline scripts.
 */
(function () {
  // --- Language toggle for the statutes ---
  var da = document.getElementById('statutes-da');
  var en = document.getElementById('statutes-en');
  var note = document.getElementById('lang-note');
  var btns = document.querySelectorAll('.lang-btn');
  if (da && en && btns.length) {
    btns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var lang = btn.getAttribute('data-lang');
        da.style.display = lang === 'da' ? '' : 'none';
        en.style.display = lang === 'en' ? '' : 'none';
        if (note) note.style.display = lang === 'en' ? '' : 'none';
        btns.forEach(function (b) {
          b.classList.remove('active');
          b.setAttribute('aria-pressed', 'false');
        });
        btn.classList.add('active');
        btn.setAttribute('aria-pressed', 'true');
      });
    });
  }

  // --- Signup form builder ---
  var form = document.getElementById('signup');
  if (!form) return;

  var out = document.getElementById('summary');
  var status = document.getElementById('status');

  // Order matters: these are the columns of the member list, in the order the
  // municipality wants them, with the association's own two fields after.
  var FIELDS = [
    ['f-name', 'Navn'],
    ['f-address', 'Adresse'],
    ['f-post', 'Postnr, by'],
    ['f-dob', 'Fodselsdato'],
    ['f-email', 'E-mail'],
    ['f-phone', 'Telefon'],
  ];

  // Phone is the only optional one. The first four are the municipality's
  // requirement; email is the notice channel under § 5.3.
  var REQUIRED = {
    'f-name': 'name',
    'f-address': 'street address',
    'f-post': 'postcode and city',
    'f-dob': 'date of birth',
    'f-email': 'email',
  };

  function val(id) {
    var el = document.getElementById(id);
    return el && el.value ? el.value.trim() : '';
  }

  function pad(label) {
    while (label.length < 13) { label += ' '; }
    return label;
  }

  function build() {
    var text = 'AI SUNDAYS \u00b7 MEDLEM\n';
    text += '27. september 2026\n';
    text += '------------------------------\n';

    FIELDS.forEach(function (f) {
      var v = val(f[0]);
      if (v) { text += pad(f[1]) + v + '\n'; }
    });

    var attend = form.querySelector('input[name="attend"]:checked');
    if (attend) { text += '\n' + pad('Kommer') + attend.value + '\n'; }

    out.value = text;

    var missing = [];
    Object.keys(REQUIRED).forEach(function (id) {
      if (!val(id)) { missing.push(REQUIRED[id]); }
    });

    if (missing.length) {
      status.textContent = 'Still needs: ' + missing.join(', ') + '.';
    } else {
      status.textContent = 'Ready. Copy it and send it to Auri.';
    }
  }

  function copy() {
    build();
    out.focus();
    out.select();
    var done = function () { status.textContent = 'Copied. Paste it into WhatsApp.'; };
    var manual = function () { status.textContent = 'Selected. Press Ctrl+C or Cmd+C to copy.'; };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(out.value).then(done, manual);
    } else {
      manual();
    }
  }

  document.getElementById('build').addEventListener('click', build);
  document.getElementById('copy').addEventListener('click', copy);
  // Keep the preview honest once it exists, so it never shows stale values.
  form.addEventListener('input', function () { if (out.value) { build(); } });
  form.addEventListener('submit', function (e) { e.preventDefault(); build(); });

  build();
  status.textContent = '';
})();
