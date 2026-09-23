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
          btns.forEach(function (b) { b.classList.remove('active'); });
          btn.classList.add('active');
        });
      });
    }

    // --- Signup form builder ---
    var form = document.getElementById('signup');
    var out = document.getElementById('summary');
    var status = document.getElementById('status');

    function val(id) {
      var el = document.getElementById(id);
      return el && el.value ? el.value.trim() : '';
    }
    function radio(name) {
      var el = form.querySelector('input[name="' + name + '"]:checked');
      return el ? el.value : '';
    }
    function boxes(name) {
      return Array.prototype.map.call(
        form.querySelectorAll('input[name="' + name + '"]:checked'),
        function (el) { return el.value; }
      );
    }
    function pad(label) {
      while (label.length < 18) { label += ' '; }
      return label;
    }
    function line(label, value) {
      return value ? pad(label) + value + '\n' : '';
    }

    function build() {
      var name = val('f-name');
      var want = val('f-want');
      var roles = boxes('role');
      var help = boxes('help');

      var text = 'AI SUNDAYS · FOUNDING MEMBER\n';
      text += '27 September 2026\n';
      text += '------------------------------\n';
      text += line('Name', name);
      text += line('Address', val('f-address'));
      text += line('Postcode, city', val('f-post'));
      text += line('Date of birth', val('f-dob'));
      text += line('Email', val('f-email'));
      text += line('Phone', val('f-phone'));
      text += '\n';
      text += line('Membership', radio('member'));
      text += line('27 September', radio('attend'));
      text += line('Jobs', roles.length ? roles.join(', ') : 'None for now');
      text += line('Can help with', help.length ? help.join(', ') : 'Nothing specific yet');
      if (want) {
        text += '\nWhat I want out of it\n' + want + '\n';
      }

      out.value = text;

      var missing = [];
      if (!name) { missing.push('name'); }
      if (!val('f-address')) { missing.push('street address'); }
      if (!val('f-post')) { missing.push('postcode and city'); }
      if (!val('f-dob')) { missing.push('date of birth'); }
      if (!val('f-email')) { missing.push('email'); }

      if (missing.length) {
        status.textContent = 'Built, but the member list still needs: ' + missing.join(', ') + '.';
      } else {
        status.textContent = 'Built. Copy it and send it over.';
      }
    }

    function copy() {
      if (!out.value) { build(); }
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

    build();
    status.textContent = '';
  })();
