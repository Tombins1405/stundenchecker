/* Eigene Auswahlliste für alle Auswahlfelder: sieht auf jedem Handy gleich aus.
   Das normale Feld bleibt im Code bestehen (Wert, Optionen, change-Ereignis), nur das Antippen öffnet unsere Liste. */
(function () {
  'use strict';
  var ov = null, cur = null;
  function labelOf(sel) {
    var t = sel.getAttribute('aria-label');
    if (!t && sel.id) { var l = document.querySelector('label[for="' + sel.id + '"]'); if (l) t = l.textContent; }
    if (!t) { var p = sel.closest('.field'); var l2 = p && p.querySelector('label,.lbl'); if (l2) t = l2.textContent; }
    return (t || '').replace(/\s+/g, ' ').trim();
  }
  function upgrade(sel) { if (sel._sp || sel.multiple) return; sel._sp = true; sel.setAttribute('data-sp', '1'); }
  function scan(root) {
    var l = root.querySelectorAll ? root.querySelectorAll('select') : []; for (var i = 0; i < l.length; i++) upgrade(l[i]);
    if (root.matches && root.matches('select')) upgrade(root);
  }
  function hit(x, y) {
    var l = document.querySelectorAll('select[data-sp]'), best = null;
    for (var i = 0; i < l.length; i++) {
      var s = l[i]; if (s.disabled || s.offsetParent === null) continue;
      var r = s.getBoundingClientRect(); if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) best = s;
    }
    return best;
  }
  function open(sel) {
    cur = sel;
    if (!ov) {
      ov = document.createElement('div'); ov.className = 'cropov sp-ov'; ov.hidden = true;
      ov.innerHTML = '<div class="lzbox sp-box" role="dialog" aria-modal="true"><h3 id="sp-h"></h3><div class="sp-list" id="sp-list" role="listbox"></div><div class="btns"><button type="button" class="btn" data-sp-x="1">Abbrechen</button></div></div>';
      document.body.appendChild(ov);
      ov.addEventListener('click', function (ev) {
        if (ev.target === ov) { close(); return; }
        var b = ev.target.closest('[data-i]');
        if (b && cur) {
          var o = cur.options[+b.dataset.i]; if (o && !o.disabled) { var changed = cur.selectedIndex !== +b.dataset.i; cur.selectedIndex = +b.dataset.i; if (changed) { cur.dispatchEvent(new Event('input', { bubbles: true })); cur.dispatchEvent(new Event('change', { bubbles: true })); } }
          close(); return;
        }
        if (ev.target.closest('[data-sp-x]')) close();
      });
    }
    document.getElementById('sp-h').textContent = labelOf(sel);
    var h = '';
    for (var i = 0; i < sel.options.length; i++) {
      var o = sel.options[i];
      h += '<button type="button" class="sp-opt' + (i === sel.selectedIndex ? ' on' : '') + '" data-i="' + i + '" role="option"' + (o.disabled ? ' disabled' : '') + (i === sel.selectedIndex ? ' aria-selected="true"' : '') + '>' + String(o.textContent).replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }) + '</button>';
    }
    document.getElementById('sp-list').innerHTML = h;
    ov.hidden = false;
    var on = ov.querySelector('.sp-opt.on'); if (on) on.scrollIntoView({ block: 'center' });
  }
  function close() { if (ov) ov.hidden = true; cur = null; }
  document.addEventListener('click', function (ev) {
    if (ov && !ov.hidden) return;
    var t = ev.target, s = (t && t.closest && t.closest('select[data-sp]')) || hit(ev.clientX, ev.clientY);
    if (!s || ev.defaultPrevented || !(t === s || (t.contains && t.contains(s)))) return;
    ev.preventDefault(); open(s);
  }, true);
  // Tastatur: Enter oder Leertaste öffnet die Liste
  document.addEventListener('keydown', function (ev) {
    var s = document.activeElement; if (!s || !s.matches || !s.matches('select[data-sp]') || (ov && !ov.hidden)) return;
    if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); open(s); }
  });
  scan(document);
  new MutationObserver(function (ms) { ms.forEach(function (m) { m.addedNodes.forEach(function (n) { if (n.nodeType === 1) scan(n); }); }); }).observe(document.documentElement, { childList: true, subtree: true });
})();
