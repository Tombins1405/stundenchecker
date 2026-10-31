/* Eigenes Datumsfeld für alle Datumsfelder: getippt (TT.MM.JJJJ, die Punkte setzt die App) oder über einen eigenen Kalender.
   Sieht auf jedem Handy gleich aus. Der Wert (.value) bleibt wie beim normalen Datumsfeld "JJJJ-MM-TT". */
(function () {
  'use strict';
  var setNative = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  var getNative = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').get;
  var ov = null, cur = null;
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function valid(y, m, d) { var t = new Date(y, m - 1, d); return y >= 1900 && y <= 2100 && t.getFullYear() === y && t.getMonth() === m - 1 && t.getDate() === d; }
  function toDisp(iso) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ''); return m ? m[3] + '.' + m[2] + '.' + m[1] : ''; }
  function parseDisp(t) { var m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(t); if (!m || !valid(+m[3], +m[2], +m[1])) return null; return m[3] + '-' + m[2] + '-' + m[1]; }
  function lang() { return document.documentElement.lang || 'de'; }
  function today() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }

  function fire(el) { el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }
  function setIso(el, iso, quiet) {
    el._iso = iso || ''; setNative.call(el, toDisp(el._iso));
    if (!quiet) fire(el);
  }

  function upgrade(el) {
    if (el._dp || el.type !== 'date') return;
    var init = getNative.call(el) || '';
    el._dp = true; el._iso = /^\d{4}-\d{2}-\d{2}$/.test(init) ? init : '';
    el.type = 'text'; el.setAttribute('inputmode', 'numeric'); el.setAttribute('autocomplete', 'off'); el.setAttribute('placeholder', 'TT.MM.JJJJ'); el.maxLength = 10;
    Object.defineProperty(el, 'value', {
      configurable: true,
      get: function () { return this._iso || ''; },
      set: function (v) { v = String(v == null ? '' : v); this._iso = /^\d{4}-\d{2}-\d{2}$/.test(v) && valid(+v.slice(0, 4), +v.slice(5, 7), +v.slice(8, 10)) ? v : ''; setNative.call(this, toDisp(this._iso)); }
    });
    setNative.call(el, toDisp(el._iso));
    var wrap = document.createElement('span'); wrap.className = 'dp-wrap';
    el.parentNode.insertBefore(wrap, el); wrap.appendChild(el);
    var b = document.createElement('button'); b.type = 'button'; b.className = 'dp-btn'; b.setAttribute('aria-label', 'Kalender');
    b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>';
    wrap.appendChild(b);
    b.addEventListener('click', function () { openCal(el); });
    el.addEventListener('input', function () {
      var d = getNative.call(el).replace(/\D/g, '').slice(0, 8), t = d;
      if (d.length > 4) t = d.slice(0, 2) + '.' + d.slice(2, 4) + '.' + d.slice(4); else if (d.length > 2) t = d.slice(0, 2) + '.' + d.slice(2);
      if (getNative.call(el) !== t) setNative.call(el, t);
      if (!d.length) { if (el._iso) { el._iso = ''; fire2(el); } return; }
      var iso = parseDisp(t); if (iso && iso !== el._iso) { el._iso = iso; fire2(el); }
    }, true);
    el.addEventListener('blur', function () { setNative.call(el, toDisp(el._iso)); });
  }
  // eigene Auslösung ohne Endlosschleife (die Eingabe selbst läuft im Capture-Handler oben)
  function fire2(el) { el._silent = true; el.dispatchEvent(new Event('change', { bubbles: true })); el._silent = false; }

  function openCal(el) {
    cur = { el: el, y: 0, m: 0 };
    var iso = el._iso || today(); cur.y = +iso.slice(0, 4); cur.m = +iso.slice(5, 7);
    if (!ov) {
      ov = document.createElement('div'); ov.className = 'cropov dp-ov'; ov.hidden = true;
      ov.innerHTML = '<div class="lzbox dp-box" role="dialog" aria-modal="true"><div class="dp-head"><button type="button" class="btn" data-dp="prev" aria-label="‹">‹</button><strong id="dp-title"></strong><button type="button" class="btn" data-dp="next" aria-label="›">›</button></div><div class="dp-grid" id="dp-grid"></div><div class="btns"><button type="button" class="btn" data-dp="today">Heute</button><button type="button" class="btn" data-dp="clear">Löschen</button><button type="button" class="btn" data-dp="cancel">Abbrechen</button></div></div>';
      document.body.appendChild(ov);
      ov.addEventListener('click', function (ev) {
        var t = ev.target.closest('[data-dp],[data-day]'); if (ev.target === ov) { close(); return; } if (!t) return;
        if (t.dataset.day) { setIso(cur.el, t.dataset.day); close(); return; }
        var a = t.dataset.dp;
        if (a === 'prev') { cur.m--; if (cur.m < 1) { cur.m = 12; cur.y--; } draw(); }
        else if (a === 'next') { cur.m++; if (cur.m > 12) { cur.m = 1; cur.y++; } draw(); }
        else if (a === 'today') { setIso(cur.el, today()); close(); }
        else if (a === 'clear') { setIso(cur.el, ''); close(); }
        else close();
      });
    }
    draw(); ov.hidden = false;
  }
  function close() { if (ov) ov.hidden = true; cur = null; }
  function draw() {
    var y = cur.y, m = cur.m, L = lang(), first = new Date(y, m - 1, 1), start = (first.getDay() + 6) % 7, dim = new Date(y, m, 0).getDate(), sel = cur.el._iso, t0 = today(), h = '';
    var title; try { title = new Intl.DateTimeFormat(L, { month: 'long', year: 'numeric' }).format(first); } catch (e) { title = pad(m) + '.' + y; }
    document.getElementById('dp-title').textContent = title;
    for (var i = 0; i < 7; i++) { var wd; try { wd = new Intl.DateTimeFormat(L, { weekday: 'short' }).format(new Date(2024, 0, 1 + i)); } catch (e) { wd = ''; } h += '<span class="dp-wd">' + wd.slice(0, 2) + '</span>'; }
    for (var k = 0; k < start; k++) h += '<span></span>';
    for (var d = 1; d <= dim; d++) { var iso = y + '-' + pad(m) + '-' + pad(d); h += '<button type="button" class="dp-day' + (iso === sel ? ' on' : '') + (iso === t0 ? ' now' : '') + '" data-day="' + iso + '">' + d + '</button>'; }
    document.getElementById('dp-grid').innerHTML = h;
  }

  function scan(root) { var l = (root.querySelectorAll ? root.querySelectorAll('input[type=date]') : []); for (var i = 0; i < l.length; i++) upgrade(l[i]); if (root.matches && root.matches('input[type=date]')) upgrade(root); }
  scan(document);
  new MutationObserver(function (ms) { ms.forEach(function (m) { m.addedNodes.forEach(function (n) { if (n.nodeType === 1) scan(n); }); }); }).observe(document.documentElement, { childList: true, subtree: true });
})();
