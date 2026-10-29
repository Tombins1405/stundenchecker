/* Eigene Uhr für alle Zeitfelder: zwei Drehwalzen (Stunde, Minute), große Knöpfe OK / Abbrechen / Löschen.
   Sieht auf jedem Handy gleich aus. Man kann die Zeit auch eintippen (zum Beispiel 730 oder 7:30).
   Zeitfelder im Code: <input type="text" readonly data-time="1">. Der Wert steht als "HH:MM" im Feld. */
(function () {
  'use strict';
  var ROW = 44, ROWS = 5, overlay = null, cur = null; // cur = { input, h, m, wh, wm }

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function parseTime(s) {
    s = String(s || '').trim();
    if (!s) return null;
    var h, m, mt = s.match(/^(\d{1,2})\s*[:.,hH]\s*(\d{1,2})$/);
    if (mt) { h = +mt[1]; m = +mt[2]; }
    else if (/^\d{1,2}$/.test(s)) { h = +s; m = 0; }
    else if (/^\d{3}$/.test(s)) { h = +s.slice(0, 1); m = +s.slice(1); }
    else if (/^\d{4}$/.test(s)) { h = +s.slice(0, 2); m = +s.slice(2); }
    else return null;
    if (h < 0 || h > 23 || m < 0 || m > 59) return null;
    return { h: h, m: m };
  }
  function nowRounded() { var d = new Date(), m = Math.round(d.getMinutes() / 5) * 5, h = d.getHours(); if (m === 60) { m = 0; h = (h + 1) % 24; } return { h: h, m: m }; }

  function makeWheel(count, label, step) {
    step = step || 1;
    var box = document.createElement('div'); box.className = 'tp-wheel'; box.setAttribute('role', 'listbox'); box.setAttribute('aria-label', label); box.tabIndex = 0;
    var spacerA = document.createElement('div'), spacerB = document.createElement('div');
    spacerA.className = spacerB.className = 'tp-spacer'; spacerA.style.height = spacerB.style.height = (ROW * 2) + 'px';
    box.appendChild(spacerA);
    var items = [];
    for (var i = 0; i < count; i++) {
      var it = document.createElement('div'); it.className = 'tp-item'; it.textContent = pad(i * step); it.dataset.i = i; it.setAttribute('role', 'option');
      box.appendChild(it); items.push(it);
    }
    box.appendChild(spacerB);
    var w = { box: box, items: items, raf: 0 };
    function paint() {
      w.raf = 0;
      var pos = box.scrollTop / ROW;
      for (var i = 0; i < items.length; i++) {
        var d = i - pos, ad = Math.abs(d);
        if (ad > 3.2) { items[i].style.transform = 'none'; items[i].style.opacity = '0'; continue; }
        items[i].style.transform = 'rotateX(' + (-d * 24).toFixed(1) + 'deg) scale(' + (1 - Math.min(ad, 3) * 0.08).toFixed(3) + ')';
        items[i].style.opacity = (1 - Math.min(ad, 3) * 0.28).toFixed(2);
        items[i].classList.toggle('sel', ad < 0.5);
      }
    }
    box.addEventListener('scroll', function () { if (!w.raf) w.raf = requestAnimationFrame(paint); });
    box.addEventListener('click', function (ev) { var it = ev.target.closest('.tp-item'); if (it) w.set(+it.dataset.i, true); });
    box.addEventListener('keydown', function (ev) {
      if (ev.key === 'ArrowUp') { w.set(Math.max(0, w.get() - 1), true); ev.preventDefault(); }
      else if (ev.key === 'ArrowDown') { w.set(Math.min(count - 1, w.get() + 1), true); ev.preventDefault(); }
    });
    w.get = function () { return Math.max(0, Math.min(count - 1, Math.round(box.scrollTop / ROW))); };
    w.set = function (i, smooth) { box.scrollTo ? box.scrollTo({ top: i * ROW, behavior: smooth ? 'smooth' : 'auto' }) : (box.scrollTop = i * ROW); if (!smooth) paint(); };
    w.paint = paint;
    return w;
  }

  function build() {
    var o = document.createElement('div'); o.className = 'tp-overlay'; o.hidden = true; o.setAttribute('role', 'dialog'); o.setAttribute('aria-modal', 'true'); o.setAttribute('aria-label', 'Uhrzeit wählen');
    o.innerHTML =
      '<div class="tp-sheet">' +
        '<div class="tp-title" id="tp-title">Uhrzeit</div>' +
        '<input class="tp-type" id="tp-type" type="text" inputmode="numeric" autocomplete="off" aria-label="Uhrzeit eintippen, zum Beispiel 730" maxlength="5">' +
        '<div class="tp-wheels">' +
          '<div class="tp-col" id="tp-hcol"></div><div class="tp-colon">:</div><div class="tp-col" id="tp-mcol"></div>' +
          '<div class="tp-band" aria-hidden="true"></div>' +
        '</div>' +
        '<div class="tp-btns">' +
          '<button type="button" class="btn primary" id="tp-ok">OK</button>' +
          '<button type="button" class="btn" id="tp-cancel">Abbrechen</button>' +
          '<button type="button" class="btn danger" id="tp-clear">Löschen</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(o);
    var wh = makeWheel(24, 'Stunde'), wm = makeWheel(12, 'Minute', 5);
    o.querySelector('#tp-hcol').appendChild(wh.box); o.querySelector('#tp-mcol').appendChild(wm.box);
    var typ = o.querySelector('#tp-type');
    function sync() { typ.value = pad(wh.get()) + ':' + pad(wm.get() * 5); }
    function onScrollEnd() { clearTimeout(onScrollEnd.t); onScrollEnd.t = setTimeout(sync, 80); }
    wh.box.addEventListener('scroll', onScrollEnd); wm.box.addEventListener('scroll', onScrollEnd);
    function applyTyped() {
      var t = parseTime(typ.value);
      if (!t) { sync(); typ.classList.add('bad'); setTimeout(function () { typ.classList.remove('bad'); }, 600); return false; }
      wh.set(t.h, true); wm.set(Math.min(11, Math.round(t.m / 5)), true); typ.value = pad(t.h) + ':' + pad(t.m); overlay.pending = t; return true;
    }
    ['touchstart', 'mousedown', 'wheel'].forEach(function (n) { wh.box.addEventListener(n, function () { if (overlay) overlay.pending = null; }, { passive: true }); wm.box.addEventListener(n, function () { if (overlay) overlay.pending = null; }, { passive: true }); });
    typ.addEventListener('change', applyTyped);
    typ.addEventListener('focus', function () { setTimeout(function () { typ.select(); }, 0); });
    typ.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); if (applyTyped()) commit(); } });
    o.querySelector('#tp-ok').addEventListener('click', function () { if (document.activeElement === typ && !applyTyped()) return; commit(); });
    o.querySelector('#tp-cancel').addEventListener('click', close);
    o.querySelector('#tp-clear').addEventListener('click', function () { setValue(''); close(); });
    o.addEventListener('click', function (ev) { if (ev.target === o) close(); });
    o.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') { ev.preventDefault(); close(); } });
    overlay = { el: o, wh: wh, wm: wm, typ: typ, sync: sync };
  }

  function setValue(v) {
    var inp = cur && cur.input; if (!inp) return;
    inp.value = v;
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    inp.dispatchEvent(new Event('change', { bubbles: true }));
  }
  function commit() { var p = overlay.pending; setValue(p ? pad(p.h) + ':' + pad(p.m) : pad(overlay.wh.get()) + ':' + pad(overlay.wm.get() * 5)); close(); }
  function close() {
    if (!overlay || overlay.el.hidden) return;
    overlay.el.hidden = true; document.body.classList.remove('tp-open');
    var inp = cur && cur.input; cur = null; if (inp && inp.focus) inp.focus({ preventScroll: true });
  }
  function open(input) {
    if (!overlay) build();
    cur = { input: input };
    var lab = input.id ? document.querySelector('label[for="' + input.id + '"]') : null;
    var txt = lab ? lab.textContent.trim() : 'Uhrzeit';
    var par = input.closest('.pause'); if (par && /^[pk]-b/.test(input.id || '')) txt = (txt === 'bis' ? 'Ende' : txt);
    overlay.el.querySelector('#tp-title').textContent = txt;
    overlay.el.querySelector('#tp-clear').hidden = !input.value; overlay.el.querySelector('.tp-btns').classList.toggle('noclear', !input.value);
    var t = parseTime(input.value) || nowRounded();
    overlay.el.hidden = false; document.body.classList.add('tp-open');
    overlay.wh.set(t.h, false); overlay.wm.set(Math.min(11, Math.round(t.m / 5)), false); overlay.sync();
    overlay.pending = (t.m % 5 === 0) ? null : t; if (overlay.pending) overlay.typ.value = pad(t.h) + ':' + pad(t.m); // genaue Minute bleibt erhalten, wenn man nichts ändert
    setTimeout(function () { overlay.el.querySelector('#tp-ok').focus({ preventScroll: true }); }, 0);
  }

  document.addEventListener('click', function (ev) {
    var t = ev.target.closest ? ev.target.closest('input[data-time]') : null;
    if (t) { ev.preventDefault(); open(t); }
  });
  document.addEventListener('keydown', function (ev) {
    var t = ev.target;
    if (t && t.matches && t.matches('input[data-time]') && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); open(t); }
  });
  window.TimePicker = { open: open, parse: parseTime };
})();
