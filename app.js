/* Stunden-Checker – Oberfläche (Meilenstein A)
 * Alle Rechenregeln liegen in engine.js. Diese Datei zeigt an, nimmt Eingaben entgegen und speichert.
 * Gespeichert wird in dieser Datei nur über load() und save(): später wird genau diese Stelle durch Firestore ersetzt. */
(function () {
  'use strict';
  var E = window.Engine;
  var KEY = 'stundenchecker.v1';

  /* ------------------------------------------------------------ Hilfen */
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  var nf = new Intl.NumberFormat('de-AT', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
  var nfp = new Intl.NumberFormat('de-AT', { maximumFractionDigits: 2 });
  var nf2 = new Intl.NumberFormat('de-AT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  var eur = new Intl.NumberFormat('de-AT', { style: 'currency', currency: 'EUR' });
  function fh(x) { return nf.format(x); }
  function hm(min) { return Math.floor(min / 60) + ':' + pad(min % 60); }
  var WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  var WDL = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  var MON = ['Jänner', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  var PAKET_KURZ = { gueter: 'Güterbeförderung', bau: 'Bau', eigen: 'Eigene Werte' };
  function todayISO() { var d = new Date(); return E.iso(d.getFullYear(), d.getMonth() + 1, d.getDate()); }
  function fmtDate(s) { var p = E.parseISO(s); return p.d + '.' + p.m + '.' + p.y; }
  function fmtShort(s) { var p = E.parseISO(s); return WD[E.weekday(s)] + ' ' + p.d + '.' + p.m + '.'; }
  function fmtLong(s) { var p = E.parseISO(s); return WDL[E.weekday(s)] + ', ' + p.d + '. ' + MON[p.m - 1] + ' ' + p.y; }
  function validISO(s) { return /^\d{4}-\d{2}-\d{2}$/.test(s || ''); }

  var toastTimer = null;
  function toast(msg) {
    var t = $('#toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.hidden = true; }, 2800);
  }
  // Zweistufiges Bestätigen ohne Pop-up: erster Tipp ändert die Beschriftung, zweiter Tipp führt aus.
  function arm(btn, armedText, fn) {
    if (btn.dataset.armed) { clearTimeout(btn._t); disarm(btn); fn(); return; }
    btn.dataset.armed = '1'; btn.dataset.label = btn.textContent; btn.textContent = armedText; btn.classList.add('armed');
    btn._t = setTimeout(function () { disarm(btn); }, 4000);
  }
  function disarm(btn) { if (!btn.dataset.armed) return; delete btn.dataset.armed; btn.textContent = btn.dataset.label; btn.classList.remove('armed'); }

  /* ------------------------------------------------------------ Speicher */
  var speicherOk = true;
  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) { var d = JSON.parse(raw); if (d && typeof d.days === 'object' && Array.isArray(d.settings)) return d; }
    } catch (e) { speicherOk = false; }
    return { version: 1, settings: [], days: {}, abgleich: {}, profil: {} };
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(data)); speicherOk = true; if (window.StundenSync) window.StundenSync.changed(); }
    catch (e) { speicherOk = false; $('#storage-warn').hidden = false; }
  }
  var data = load();
  if (!data.abgleich) data.abgleich = {};
  if (!data.profil) data.profil = {};
  // Ältere gespeicherte Wertesätze kannten Tagessoll und Normalwoche; jetzt gibt es nur die Wochenstunden.
  data.settings.forEach(function (e) {
    if (!e.ueberstunden) return;
    if (e.ueberstunden.wochenStd == null) e.ueberstunden.wochenStd = e.ueberstunden.wochenNormal != null ? e.ueberstunden.wochenNormal : 40;
    delete e.ueberstunden.wochenNormal; delete e.ueberstunden.tagesSoll;
    if (e.ueberstunden.zuschlagPct == null) e.ueberstunden.zuschlagPct = 50;
    if (e.stundenlohn === undefined) e.stundenlohn = null;
    if (!e.betriebFrei) e.betriebFrei = 'urlaub';
  });
  try { localStorage.setItem(KEY + '.probe', '1'); localStorage.removeItem(KEY + '.probe'); } catch (e) { speicherOk = false; }

  /* ------------------------------------------------------------ Zustand */
  var now = new Date();
  var ui = { view: 'monat', y: now.getFullYear(), m: now.getMonth() + 1, edDate: null, edDraft: null, edFrom: 'erfassen', setKey: null };

  function sortedSettings() { return data.settings.slice().sort(function (a, b) { return a.gueltigAb < b.gueltigAb ? -1 : 1; }); }
  function wAt(d) { return E.wertAt(data.settings, d); }

  /* Offener Dienst (Beginn da, Ende fehlt): Erinnerung beim Öffnen */
  function openDayKey() {
    var heute = todayISO(), best = null;
    Object.keys(data.days).forEach(function (k) {
      var d = data.days[k];
      if (k <= heute && d.status === 'arbeit' && d.von && !d.bis && (!best || k > best) && k >= E.addDays(heute, -7)) best = k;
    });
    return best;
  }
  function renderOpenDay() {
    var k = openDayKey(), box = $('#open-day');
    if (!k || (ui.view === 'erfassen' && ui.edDate === k) || (ui.view !== 'monat' && ui.view !== 'erfassen')) { box.hidden = true; return; }
    box.hidden = false; ui.openDay = k;
    $('#open-day-text').textContent = (k === todayISO() ? 'Dein Dienst von heute' : 'Dein Dienst vom ' + fmtShort(k)) + ' (ab ' + data.days[k].von + ') hat noch kein Ende.';
  }
  /* Übliches Ende: Median der letzten 10 Diensttage, auf 5 Minuten gerundet (mindestens 3 Tage nötig) */
  function typischesEnde(vor) {
    var ends = [];
    Object.keys(data.days).sort().reverse().forEach(function (k) {
      var d = data.days[k];
      if (k < vor && d.status === 'arbeit' && d.von && d.bis && ends.length < 10) {
        var vm = E.toMin(d.von), bm = E.toMin(d.bis);
        if (vm !== null && bm !== null && bm > vm) ends.push(bm);
      }
    });
    if (ends.length < 3) return null;
    ends.sort(function (x, y) { return x - y; });
    var r = Math.round(ends[Math.floor(ends.length / 2)] / 5) * 5;
    return String(Math.floor(r / 60)).padStart(2, '0') + ':' + String(r % 60).padStart(2, '0');
  }

  /* ------------------------------------------------------------ Ansichten */
  function isDirty() { return !!ui.edDraft && ui.edBase != null && JSON.stringify(ui.edDraft) !== ui.edBase; }
  function askLeave(go) {
    ui.leaveGo = go; $('#leave').hidden = false;
  }
  function show(view, force) {
    if (!force && ui.view === 'erfassen' && view !== 'erfassen' && isDirty()) { askLeave(function () { show(view, true); }); return; }
    ui.view = view;
    ['monat', 'erfassen', 'konten', 'einstellungen'].forEach(function (v) { $('#v-' + v).hidden = v !== view; });
    $$('.tab').forEach(function (b) { if (b.dataset.view === view) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    if (view === 'monat') renderMonat();
    if (view === 'erfassen') renderEditor();
    if (view === 'konten') renderKonten();
    if (view === 'einstellungen') { renderSettings(); fillBackup(); renderCheck(); }
    renderOpenDay();
    window.scrollTo(0, 0);
  }

  /* Diese Woche (Montag bis Sonntag): Stunden gegen die Wochenstunden. Eine einfache Orientierung, kein Lohnzettel-Wert. */
  function weekBox() {
    var heute = todayISO(), wd = E.weekday(heute), mo = E.addDays(heute, -((wd + 6) % 7)), sum = 0, any = false;
    for (var i = 0; i < 7; i++) {
      var ds = E.addDays(mo, i), r = E.calcDay(data.days[ds], ds, wAt(ds));
      if (r.leer) continue;
      any = true; sum += (r.wertMin + r.creditMin) / 60;
    }
    if (!any) return '';
    var wo = E.wochenStd(wAt(heute).ueberstunden), pct = Math.min(100, wo > 0 ? sum / wo * 100 : 100);
    var text = sum >= wo ? 'Wochenstunden erreicht, ' + fh(sum - wo) + ' h darüber' : 'Noch ' + fh(wo - sum) + ' h bis ' + fh(wo) + ' h';
    return '<div class="sw"><div class="row"><span>Diese Woche</span><strong class="num">' + fh(sum) + ' von ' + fh(wo) + ' h</strong></div>' +
      '<div class="bar" aria-hidden="true"><i style="width:' + pct.toFixed(1) + '%"></i></div>' +
      '<div class="row"><span>' + esc(text) + '</span></div></div>';
  }

  /* ============================================================ MONAT */
  function renderMonat() {
    $('#storage-warn').hidden = speicherOk;
    $('#onboard').hidden = !(data.settings.length === 0 && Object.keys(data.days).length === 0);
    $('#m-title').textContent = MON[ui.m - 1] + ' ' + ui.y;
    var cm = E.calcMonth(data, ui.y, ui.m, todayISO()), s = cm.summe, w = wAt(E.iso(ui.y, ui.m, 1));

    var sub = '';
    if (s.zuschlagStd !== 0) sub = fh(s.istStd) + ' h gearbeitet, dazu ' + fh(s.zuschlagStd) + ' h Zuschlag';
    else if (s.lohnStd !== s.istStd) sub = fh(s.istStd) + ' h gearbeitet, dazu bezahlte Abwesenheit';
    else sub = 'tatsächlich gearbeitet';
    var jetzt = new Date(), laufend = ui.y > jetzt.getFullYear() || (ui.y === jetzt.getFullYear() && ui.m >= jetzt.getMonth() + 1); // Überstunden gibt es erst, wenn der Monat vorbei ist
    var diaetenBetrag = w.diaeten.modell === 'aus' ? '–' : eur.format(s.diaetenBetrag);
    var html = '<div class="panel">' +
      '<div><p class="eyebrow">Lohnstunden</p><p class="big">' + fh(s.lohnStd) + '<small>h</small></p><p class="sub">' + esc(sub) + '</p></div>' +
      '<dl class="figs">' +
      '<div><dt>Überstunden</dt>' + (laufend ? '<dd class="hl">–<small class="later">am Monatsende</small></dd>' : '<dd class="hl">' + fh(s.ueberStd) + '<small>h</small></dd>') + '</div>' +
      '<div><dt>Diätenstd.</dt><dd>' + fh(s.diaetenStd) + '<small>h</small></dd></div>' +
      '<div><dt>Diäten</dt><dd>' + esc(diaetenBetrag) + '</dd></div>' +
      '</dl>';
    if (w.schlechtwetter || s.swStd > 0) {
      var sw = cm.schlechtwetter, pct = Math.min(100, sw.verbrauchtStd / sw.kontingentStd * 100);
      html += '<div class="sw"><div class="row"><span>Schlechtwetter im Monat</span><strong class="num">' + fh(s.swStd) + ' h</strong></div>' +
        '<div class="bar" aria-hidden="true"><i style="width:' + pct.toFixed(1) + '%"></i></div>' +
        '<div class="row"><span>Zeitraum ' + fmtDate(sw.von) + ' bis ' + fmtDate(sw.bis) + '</span><span class="num">' + fh(sw.verbrauchtStd) + ' von ' + sw.kontingentStd + ' h</span></div></div>';
    }
    var jetzt2 = new Date();
    if (ui.y === jetzt2.getFullYear() && ui.m === jetzt2.getMonth() + 1) html += weekBox();
    html += '</div>';
    $('#m-summary').innerHTML = html;

    var parts = [];
    if (s.arbeitstage) parts.push(s.arbeitstage + (s.arbeitstage === 1 ? ' Arbeitstag' : ' Arbeitstage'));
    if (s.urlaub) parts.push(s.urlaub + ' Urlaub');
    if (s.krank) parts.push(s.krank + ' Krankenstand');
    if (s.pflege) parts.push(s.pflege + ' Pflegefreistellung');
    if (s.za) parts.push(s.za + ' Zeitausgleich');
    if (s.feiertageBezahlt) parts.push(s.feiertageBezahlt + ' bezahlter Feiertag' + (s.feiertageBezahlt > 1 ? 'e' : ''));
    $('#m-counts').textContent = parts.join(' · ');
    $('#m-ab').hidden = true;
    renderAbgleich(cm.spaeter.length ? E.calcMonth(data, ui.y, ui.m, todayISO(), { ohneSpaeter: true }).summe : s, cm.spaeter);

    var today = todayISO();
    $('#m-days').innerHTML = cm.tage.map(function (r) {
      var p = E.parseISO(r.datum), d = data.days[r.datum] || {};
      var rest = r.typ !== 'werktag';
      var main, small = [], val = '';
      var chips = '';
      if (r.feiertag) chips += '<span class="chip good">' + esc(r.feiertag) + '</span>';
      if (r.faktor !== 1) chips += '<span class="chip acc">+' + nfp.format((r.faktor - 1) * 100) + ' %</span>';
      if (d.spaeter) chips += '<span class="chip warn">Wird später abgerechnet</span>';

      if (r.leer) { main = '<strong>–</strong>'; }
      else if (r.status === 'arbeit') {
        if (d.von && d.bis) main = '<strong>' + esc(d.von) + '–' + esc(d.bis) + '</strong>';
        else if (d.von && !d.bis) { main = '<strong>ab ' + esc(d.von) + '</strong>'; chips += '<span class="chip warn">Ende fehlt</span>'; }
        else main = '<strong>' + (r.swMin ? 'Schlechtwetter' : 'Ohne Zeiten') + '</strong>';
        if (r.pausenMin) small.push('Pause ' + hm(r.pausenMin));
        if (r.diaetenStd) small.push('Diäten ' + fh(r.diaetenStd) + ' h');
        if (r.swMin) small.push('Schlechtwetter ' + fh(r.swMin / 60) + ' h');
        if (r.extraMin) small.push('+ ' + fh(r.extraMin / 60) + ' h zusätzlich bezahlt');
        if (d.notiz) small.push(esc(d.notiz));
        if (r.nettoMin > 0) {
          val = fh(r.nettoMin / 60) + ' h';
          if (r.faktor !== 1) val += '<small>zählt ' + fh(r.wertMin / 60) + ' h</small>';
          if (r.saldoMin !== null) val += '<small><span class="' + (r.saldoMin >= 0 ? 'pos' : 'neg') + '">ÜST ' + (r.saldoMin > 0 ? '+' : '') + fh(r.saldoMin / 60) + '</span></small>';
        }
      } else {
        main = '<strong>' + esc(E.STATUS[r.status].name) + (r.auto ? ' (bezahlt)' : '') + '</strong>';
        if (r.creditMin) val = fh(r.creditMin / 60) + ' h';
      }
      var cls = 'day' + (rest ? ' rest' : '') + (r.datum === today ? ' today' : '');
      return '<li><button type="button" class="' + cls + '" data-date="' + r.datum + '">' +
        '<span class="d-date"><b>' + p.d + '</b><i>' + WD[E.weekday(r.datum)] + '</i></span>' +
        '<span class="d-main' + (r.leer ? ' none' : '') + '">' + main +
        ((chips || small.length) ? '<small>' + chips + small.join(' · ') + '</small>' : '') + '</span>' +
        '<span class="d-val">' + val + '</span></button></li>';
    }).join('');
  }

  function monthKey() { return ui.y + '-' + pad(ui.m); }
  var AB_HINT = {
    lohn: 'Zeile „Lohn“, Spalte „Menge“. Das sind die normalen Stunden, ohne Überstunden und ohne Feiertag.',
    ueber: 'Zeile „Überstunden Grundlohn“. Nicht die Zeile „Zuschlag“.',
    feiertag: 'Zeile „Feiertagslohn“.',
    urlaub: 'Zeile „Urlaubslohn“.',
    krank: 'Zeile „Krankenstand“ oder „Entgeltfortzahlung“.',
    pflege: 'Zeile „Pflegefreistellung“.',
    dStd: 'Zeile „Diäten“ oder „Aufwandsentschädigung“, Menge in Stunden.',
    sonder: 'Nur wenn dein Lohnzettel eine Zeile „Sonderurlaub“ hat und die Firma diesen Tag aus deinen Überstunden bezahlt hat. Trage hier die Stunden ein. Sie werden zur Zeile „Lohn“ dazugezählt.',
    zaKonto: 'Nur wenn dein Lohnzettel ein Zeitausgleich-Konto zeigt: der Zuwachs in diesem Monat. Diese Stunden wurden nicht ausbezahlt, sondern aufs Konto gebucht. Sie werden zu den Überstunden dazugezählt.'
  };
  function renderAbgleich(summe, spaeter) {
    ui.summe = summe;
    $('#ab-spaeter').innerHTML = (spaeter && spaeter.length) ? '<div class="notice warn"><strong>Nicht mitgerechnet, weil später abgerechnet:</strong> ' + spaeter.map(function (x) { return esc(fmtShort(x.datum)) + ' (' + fh(x.std) + ' h)'; }).join(', ') + '. Merke dir diesen Tag. Er sollte auf einem späteren Lohnzettel auftauchen. Wenn nicht, reklamiere ihn.</div>' : '';
    var lz = data.abgleich[monthKey()] || {};
    var rows = E.abgleich(summe, lz, ui.abAlle);
    $('#ab-more').hidden = !!ui.abAlle;
    $('#ab-rows').innerHTML = rows.map(function (r) {
      var v = lz[r.key];
      if (r.status === 'info') return '<div class="abrow">' +
        '<label class="what" for="ab-' + r.key + '">' + esc(r.label) + '</label>' +
        '<small class="abhint">' + esc(AB_HINT[r.key]) + '</small>' +
        '<div class="abline"><div class="abin"><input type="number" id="ab-' + r.key + '" inputmode="decimal" step="0.25" value="' + (v == null ? '' : esc(v)) + '" placeholder="Zuwachs"><span>h</span></div></div></div>';
      return '<div class="abrow">' +
        '<label class="what" for="ab-' + r.key + '">' + esc(r.label) + '</label>' +
        '<small class="abhint">' + esc(AB_HINT[r.key]) + '</small>' +
        '<div class="abline"><div class="abin"><input type="number" id="ab-' + r.key + '" inputmode="decimal" step="0.25" value="' + (v == null ? '' : esc(v)) + '" placeholder="vom Lohnzettel"><span>h</span></div>' +
        '<div class="abapp">Deine Aufzeichnung<br><b>' + fh(r.app) + ' h</b></div>' +
        '<span class="chip" data-chip="' + r.key + '"></span></div></div>';
    }).join('');
    paintAbgleich();
  }
  function paintAbgleich() {
    var lz = data.abgleich[monthKey()] || {}, rows = E.abgleich(ui.summe, lz, ui.abAlle), given = 0, bad = [];
    var wm = wAt(ui.y + '-' + (ui.m < 10 ? '0' : '') + ui.m + '-01'), eu = E.abgleichEuro(rows, wm);
    rows.forEach(function (r) {
      if (r.status === 'info') return;
      var chip = $('[data-chip="' + r.key + '"]'); if (!chip) return;
      var txt = '', cls = 'chip';
      if (r.status !== 'offen') {
        given++;
        if (r.status === 'gleich') { txt = 'Passt'; cls += ' good'; }
        else if (r.status === 'klein') { txt = 'Fast gleich (' + fh(Math.abs(r.diff)) + ' h)'; cls += ' warn'; }
        else { txt = 'Lohnzettel hat ' + fh(Math.abs(r.diff)) + ' h ' + (r.diff < 0 ? 'weniger' : 'mehr'); cls += ' bad'; bad.push(r); }
      }
      chip.className = cls; chip.textContent = txt;
    });
    var html = '';
    if (!given) html = '<p class="hint">Tippe ab, was auf deinem Lohnzettel steht. Die App zeigt dir sofort, ob es zu deiner Aufzeichnung passt.</p>';
    else if (!bad.length) html = '<div class="notice">Alle eingetragenen Zeilen stimmen mit deiner Aufzeichnung überein.</div>';
    else {
      html = '<div class="notice warn"><strong>Es gibt einen Unterschied.</strong><ul style="margin:6px 0 0;padding-left:20px">' +
        bad.map(function (r) { return '<li><strong>' + esc(r.label) + ':</strong> Auf dem Lohnzettel stehen ' + fh(Math.abs(r.diff)) + ' Stunden ' + (r.diff < 0 ? 'weniger' : 'mehr') + ' als bei dir' + (r.app === 0 ? ' (in deiner Aufzeichnung gibt es diese Zeile nicht)' : '') + (eu.zeilen[r.key] != null ? ', ungefähr ' + eur.format(Math.abs(eu.zeilen[r.key])) + ' brutto' : '') + '.</li>'; }).join('') + '</ul>';
      if (eu.summe !== 0) html += '<p style="margin-top:8px"><strong>' + (eu.summe > 0 ? 'Mögliche Differenz zu deinen Gunsten: ungefähr ' : 'Auf dem Lohnzettel ist mehr bezahlt als bei dir: ungefähr ') + eur.format(Math.abs(eu.summe)) + ' brutto.</strong> Grobe Schätzung mit deinem Stundenlohn (' + eur.format(+wm.stundenlohn) + ') aus den Einstellungen.</p>';
      else if (eu.fehltStundenlohn) html += '<p style="margin-top:8px">Trage in den Einstellungen deinen Stundenlohn ein, dann zeigt die App hier auch, was der Unterschied in Euro wert ist.</p>';
      var keys = ['lohn', 'ueber', 'feiertag', 'urlaub', 'krank', 'pflege'], sumApp = 0, sumLz = 0, ok = lz.lohn != null && lz.ueber != null;
      rows.forEach(function (r) { if (keys.indexOf(r.key) >= 0) { sumApp += r.app; sumLz += (r.lz == null ? 0 : r.lz); } });
      if (ok && Math.abs(sumApp - sumLz) < 0.005) html += '<p style="margin-top:8px">Die Gesamtstunden passen. Nur die Aufteilung auf die Zeilen ist anders.</p>';
      html += '<p style="margin-top:8px">Prüfe zuerst: Sind alle Tage und Pausen richtig eingetragen? Gibt es Zeitausgleich, oder rechnet deine Firma manche Stunden erst im Folgemonat ab? Passen Zuschläge und die Zählweise der Überstunden in den Einstellungen? Bleibt der Unterschied, frage mit deiner Aufzeichnung im Büro nach. Die App ersetzt keine Rechtsberatung.</p></div>';
    }
    $('#ab-result').innerHTML = html;
  }


  /* ============================================================ KONTEN */
  function lastMonthKey() {
    var keys = Object.keys(data.days).map(function (k) { return k.slice(0, 7); }).concat(Object.keys(data.abgleich)).sort();
    var k = keys.length ? keys[keys.length - 1] : '', t = todayISO().slice(0, 7);
    return k > t ? k : t;
  }
  function monKurz(y, m) { return MON[m - 1].slice(0, 3) + ' ' + String(y).slice(2); }
  function numIn(id, val, ph) { return '<input type="number" class="kin" id="' + id + '" inputmode="decimal" step="0.01" value="' + (val == null ? '' : esc(val)) + '" placeholder="' + (ph || '') + '" aria-label="' + esc(ph || 'Wert') + '">'; }
  function renderKonten() {
    var p = data.profil || {};
    $('#k-eintritt').value = p.eintritt || '';
    $('#k-urlaubjahr').value = p.urlaubJahr == null ? '' : p.urlaubJahr;
    $('#k-urlaubstart').value = p.urlaubStart == null ? '' : p.urlaubStart;
    $('#k-zastart').value = p.zaStart == null ? '' : p.zaStart;
    var lk = lastMonthKey(), ly = +lk.slice(0, 4), lm = +lk.slice(5, 7);
    // Urlaubskartei
    var uk = E.urlaubKartei(data, p, ly, lm);
    if (!uk.length) $('#k-urlaub').innerHTML = '<p class="hint">Trage oben dein Eintrittsdatum ein, dann erscheint die Kartei.</p>';
    else $('#k-urlaub').innerHTML = '<table class="cmp"><thead><tr><th>Monat</th><th>Anspruch</th><th>Genommen</th><th>Stand</th><th>Zettel</th></tr></thead><tbody>' +
      uk.map(function (r) {
        var key = r.jahr + '-' + (r.monat < 10 ? '0' : '') + r.monat, z = (data.abgleich[key] || {}).urlaubSaldo, chk = '';
        if (z != null) chk = Math.abs(z - r.saldo) < 0.005 ? ' <span class="ok">✓</span>' : ' <span class="no">✗</span>';
        return '<tr><td>' + monKurz(r.jahr, r.monat) + '</td><td>+' + nf2.format(r.anspruch) + '</td><td>' + (r.genommen ? '−' + r.genommen : '0') + '</td><td><strong>' + nf2.format(r.saldo) + '</strong></td><td>' + numIn('ku-' + key, z, 'Stand') + chk + '</td></tr>';
      }).join('') + '</tbody></table><p class="hint" style="margin-top:8px">Tage mit Status „Urlaub“ zählen als genommen. „Betrieb geschlossen“ zählt nur, wenn deine Firma ihn als Urlaub verrechnet (Einstellungen).</p>';
    // Zeitausgleich-Konto
    var keys = Object.keys(data.abgleich).sort(), saldo = +p.zaStart || 0, zrows = [];
    keys.forEach(function (k) {
      var lz = data.abgleich[k];
      if (lz.zaKonto == null && lz.zaSaldo == null) return;
      saldo = Math.round((saldo + (+lz.zaKonto || 0)) * 100) / 100;
      zrows.push({ key: k, ver: +lz.zaKonto || 0, saldo: saldo, zettel: lz.zaSaldo });
    });
    $('#k-za').innerHTML = zrows.length ? '<table class="cmp"><thead><tr><th>Monat</th><th>Veränderung</th><th>Stand</th><th>Zettel</th></tr></thead><tbody>' +
      zrows.map(function (r) {
        var chk = r.zettel != null ? (Math.abs(r.zettel - r.saldo) < 0.005 ? ' <span class="ok">✓</span>' : ' <span class="no">✗</span>') : '';
        return '<tr><td>' + monKurz(+r.key.slice(0, 4), +r.key.slice(5, 7)) + '</td><td>' + (r.ver >= 0 ? '+' : '−') + fh(Math.abs(r.ver)) + ' h</td><td><strong>' + fh(r.saldo) + ' h</strong></td><td>' + numIn('kz-' + r.key, r.zettel, 'Stand') + chk + '</td></tr>';
      }).join('') + '</tbody></table>' : '<p class="hint">Noch keine Buchung. Trage im Monatsabgleich die Zeile „Zeitausgleich-Konto“ ein, wenn dein Lohnzettel eine Veränderung zeigt.</p>';
    // Überstunden im Überblick
    var orows = Object.keys(data.abgleich).sort().filter(function (k) { return data.abgleich[k].ueber != null; }).map(function (k) {
      var y = +k.slice(0, 4), m = +k.slice(5, 7), lz = data.abgleich[k];
      var s = E.calcMonth(data, y, m, todayISO(), { ohneSpaeter: true }).summe, app = Math.max(0, s.ueberStd), paid = +lz.ueber, konto = +lz.zaKonto || 0;
      return { y: y, m: m, app: app, paid: paid, konto: konto, diff: Math.round((paid + konto - app) * 100) / 100 };
    });
    $('#k-ueber').innerHTML = orows.length ? '<table class="cmp"><thead><tr><th>Monat</th><th>Von dir</th><th>Bezahlt</th><th>Konto</th><th>Unterschied</th></tr></thead><tbody>' +
      orows.map(function (r) {
        var cls = Math.abs(r.diff) <= 0.5 ? 'ok' : (r.diff < 0 ? 'no' : '');
        return '<tr><td>' + monKurz(r.y, r.m) + '</td><td>' + fh(r.app) + '</td><td>' + fh(r.paid) + '</td><td>' + fh(r.konto) + '</td><td class="' + cls + '">' + (r.diff > 0 ? '+' : r.diff < 0 ? '−' : '') + fh(Math.abs(r.diff)) + '</td></tr>';
      }).join('') + '</tbody></table><p class="hint" style="margin-top:8px">Unterschied = bezahlt plus Konto minus deine Aufzeichnung. Minus heißt: Der Lohnzettel hat weniger als du aufgeschrieben hast. Plus heißt: mehr.</p>' : '<p class="hint">Sobald du Lohnzettel-Zeilen im Monatsabgleich einträgst, erscheint hier die Übersicht.</p>';
  }
  function konInput(t) {
    var id = t.id, num = parseFloat(String(t.value).replace(',', '.')), val = (t.value === '' || isNaN(num)) ? null : num;
    if (!data.profil) data.profil = {};
    if (id === 'k-eintritt') { if (t.value === '' || validISO(t.value)) { data.profil.eintritt = t.value || null; delete data.profil.test; save(); renderKonten(); } return true; }
    if (id === 'k-urlaubjahr') { data.profil.urlaubJahr = val; delete data.profil.test; save(); return true; }
    if (id === 'k-urlaubstart') { data.profil.urlaubStart = val; delete data.profil.test; save(); return true; }
    if (id === 'k-zastart') { data.profil.zaStart = val; delete data.profil.test; save(); return true; }
    if (id.indexOf('ku-') === 0 || id.indexOf('kz-') === 0) {
      var key = id.slice(3), o = data.abgleich[key] || (data.abgleich[key] = {});
      o[id.indexOf('ku-') === 0 ? 'urlaubSaldo' : 'zaSaldo'] = val; delete o.test; save(); return true;
    }
    return false;
  }

  /* ============================================================ ERFASSEN */
  function blankDay() { return { status: 'arbeit', von: '', bis: '', pausen: [], kunden: [], diaeten: null, sw: 0, notiz: '' }; }
  function normKunden(d) {
    if (!d.pausen) d.pausen = [];
    if (!d.kunden) d.kunden = d.notiz ? [{ name: d.notiz, von: '', bis: '' }] : []; // alte Einträge mit einem Kundentext
  }
  function kundenNamen(d) { return (d.kunden || []).map(function (k) { return (k.name || '').trim(); }).filter(Boolean); }
  function renderKunden() {
    $('#e-kunden').innerHTML = ui.edDraft.kunden.map(function (k, i) {
      return '<div class="kunde">' +
        '<div class="field kn"><label for="k-n' + i + '">Kunde / Baustelle ' + (i + 1) + '</label><input type="text" id="k-n' + i + '" data-k="' + i + '" data-f="name" maxlength="120" list="e-notiz-list" autocomplete="off" value="' + esc(k.name || '') + '"></div>' +
        '<div class="field kn"><label for="k-t' + i + '">Tätigkeit</label><input type="text" id="k-t' + i + '" data-k="' + i + '" data-f="tat" maxlength="120" list="e-tat-list" autocomplete="off" value="' + esc(k.tat || '') + '"></div>' +
        '<div class="field"><label for="k-v' + i + '">von</label><input type="text" readonly inputmode="none" data-time="1" placeholder="--:--" id="k-v' + i + '" data-k="' + i + '" data-f="von" value="' + esc(k.von || '') + '"></div>' +
        '<div class="field"><label for="k-b' + i + '">bis</label><input type="text" readonly inputmode="none" data-time="1" placeholder="--:--" id="k-b' + i + '" data-k="' + i + '" data-f="bis" value="' + esc(k.bis || '') + '"></div>' +
        '<button type="button" class="rm" data-rmk="' + i + '" aria-label="Kunde ' + (i + 1) + ' entfernen">×</button></div>';
    }).join('');
  }
  function openEditor(date, from, force) {
    if (!force && ui.edDraft && date !== ui.edDate && isDirty()) { askLeave(function () { openEditor(date, from, true); }); return; }
    ui.edDate = date; ui.edFrom = from || 'erfassen';
    ui.edDraft = data.days[date] ? E.clone(data.days[date]) : blankDay();
    normKunden(ui.edDraft);
    ui.edBase = JSON.stringify(ui.edDraft);
    show('erfassen', true);
  }

  function renderEditor() {
    if (!ui.edDate) { ui.edDate = todayISO(); ui.edDraft = data.days[ui.edDate] ? E.clone(data.days[ui.edDate]) : blankDay(); normKunden(ui.edDraft); ui.edBase = JSON.stringify(ui.edDraft); }
    var d = ui.edDraft, w = wAt(ui.edDate);
    $('#e-title').textContent = fmtLong(ui.edDate);
    var tags = '', typ = E.dayTyp(ui.edDate), ft = E.feiertagName(ui.edDate);
    if (ft) tags += '<span class="chip good">' + esc(ft) + '</span>';
    var z = typ === 'sonntag' ? w.zuschlag.so : typ === 'feiertag' ? w.zuschlag.ft : typ === 'samstag' ? w.zuschlag.sa : 0;
    if (typ === 'sonntag') tags += '<span class="chip">Sonntag</span>';
    if (typ === 'samstag') tags += '<span class="chip">Samstag</span>';
    if (z) tags += '<span class="chip acc">Zuschlag +' + nfp.format(z) + ' %</span>';
    $('#e-tags').innerHTML = tags;
    $('#e-date').value = ui.edDate;

    $('#e-status').innerHTML = Object.keys(E.STATUS).map(function (k) {
      return '<option value="' + k + '"' + (d.status === k ? ' selected' : '') + '>' + esc(E.STATUS[k].name) + '</option>';
    }).join('');
    $('#e-von').value = d.von || '';
    $('#e-bis').value = d.bis || '';
    $('#e-diaeten').value = (d.diaeten === null || d.diaeten === undefined) ? '' : d.diaeten;
    $('#e-sw').value = d.sw ? d.sw : '';
    $('#e-extra').value = d.extra ? d.extra : ''; $('#e-extra-box').open = !!d.extra;
    var seen = {}, opts = '';
    Object.keys(data.days).forEach(function (k) { var dd = data.days[k]; (dd.kunden ? kundenNamen(dd) : (dd.notiz ? [dd.notiz.trim()] : [])).forEach(function (n) { seen[n] = (seen[n] || 0) + 1; }); });
    Object.keys(seen).sort(function (x, y) { return seen[y] - seen[x] || (x < y ? -1 : 1); }).slice(0, 30).forEach(function (n) { opts += '<option value="' + esc(n) + '">'; });
    var ts = {}, ks = {}, topt = '', kopt = '';
    Object.keys(data.days).forEach(function (k) { var dd = data.days[k]; (dd.kunden || []).forEach(function (x) { if (x.tat) ts[x.tat] = (ts[x.tat] || 0) + 1; }); if (dd.fz && dd.fz.kfz) ks[dd.fz.kfz] = (ks[dd.fz.kfz] || 0) + 1; });
    Object.keys(ts).sort(function (x, y) { return ts[y] - ts[x]; }).slice(0, 30).forEach(function (n) { topt += '<option value="' + esc(n) + '">'; });
    Object.keys(ks).sort(function (x, y) { return ks[y] - ks[x]; }).slice(0, 10).forEach(function (n) { kopt += '<option value="' + esc(n) + '">'; });
    if (!$('#e-tat-list')) { var dl = document.createElement('datalist'); dl.id = 'e-tat-list'; $('#e-kunden').parentNode.appendChild(dl); }
    $('#e-tat-list').innerHTML = topt; $('#f-kfz-list').innerHTML = kopt;
    var fz = d.fz || {};
    ['kfz', 'kmVon', 'kmBis', 'diesel', 'adblue', 'oel'].forEach(function (f) { var el = document.querySelector('[data-fz="' + f + '"]'); if (el) el.value = (fz[f] === undefined || fz[f] === null) ? '' : fz[f]; });
    $('#e-fz-box').open = Object.keys(fz).length > 0;
    $('#e-notiz-list').innerHTML = opts; // Vorschläge aus früheren Einträgen
    if ($('#e-spaeter')) $('#e-spaeter').checked = !!d.spaeter;
    $('#e-swgroup').hidden = !w.schlechtwetter;
    $('#e-diaeten').closest('.field').hidden = w.diaeten.modell === 'aus';
    $('#e-work').hidden = d.status !== 'arbeit';
    $('#e-delete').hidden = !data.days[ui.edDate];
    disarm($('#e-delete'));
    renderPausen();
    renderKunden();
    updatePreview();
  }

  function renderPausen() {
    $('#e-pausen').innerHTML = ui.edDraft.pausen.map(function (p, i) {
      return '<div class="pause">' +
        '<div class="field"><label for="p-v' + i + '">Pause ' + (i + 1) + ' von</label><input type="text" readonly inputmode="none" data-time="1" placeholder="--:--" id="p-v' + i + '" data-i="' + i + '" data-f="von" value="' + esc(p.von) + '"></div>' +
        '<div class="field"><label for="p-b' + i + '">bis</label><input type="text" readonly inputmode="none" data-time="1" placeholder="--:--" id="p-b' + i + '" data-i="' + i + '" data-f="bis" value="' + esc(p.bis) + '"></div>' +
        '<button type="button" class="rm" data-rm="' + i + '" aria-label="Pause ' + (i + 1) + ' entfernen">×</button></div>';
    }).join('');
  }

  function line(label, value, main) { return '<div class="line' + (main ? ' main' : '') + '"><span>' + label + '</span><span>' + value + '</span></div>'; }
  function updatePreview() {
    var d = ui.edDraft, w = wAt(ui.edDate), r = E.calcDay(d, ui.edDate, w), html = '', warn = '';
    $('#e-diaeten').placeholder = 'Vorschlag';
    var sg = $('#e-bis-sugg'), te = (d.status === 'arbeit' && d.von && !d.bis) ? typischesEnde(ui.edDate) : null;
    sg.hidden = !te; if (te) { sg.textContent = 'Meistens bis ' + te + ' (übernehmen)'; sg.dataset.t = te; }
    if (d.status !== 'arbeit') {
      if (r.creditMin) html = line('Gutgeschrieben', fh(r.creditMin / 60) + ' h', true) + '<p class="hint">Bezahlte Abwesenheit. Sie erzeugt keine Überstunden.</p>';
      else if (d.status === 'za') html = '<p class="hint">Zeitausgleichstag: keine Arbeitsstunden. Das Zeitausgleichskonto kommt mit der Vollversion.</p>';
      else html = '<p class="hint">Dieser Tag zählt keine Stunden.</p>';
    } else if (d.von && !d.bis && !r.swMin) {
      html = '<p class="hint"><strong>Dein Dienst läuft.</strong> Beginn ' + esc(d.von) + '. Speichere jetzt, und trage das Ende später ein. Der Tag zählt erst, wenn das Ende da ist.</p>';
    } else if (!r.bruttoMin && !r.swMin) {
      html = '<p class="hint">Trage den Beginn ein. Das Ende kannst du später nachtragen.</p>';
    } else {
      if (r.bruttoMin) {
        html += line('Anwesenheit', hm(r.bruttoMin) + ' h');
        html += line('Pausen', r.pausenMin ? '− ' + hm(r.pausenMin) + ' h' : '0:00 h');
        html += line('Arbeitsstunden', fh(r.nettoMin / 60) + ' h', true);
        if (r.faktor !== 1) html += line('Zählwert mit Zuschlag', fh(r.wertMin / 60) + ' h');
        if (r.saldoMin !== null) html += line('Überstunden-Beitrag', (r.saldoMin > 0 ? '+' : '') + fh(r.saldoMin / 60) + ' h');
        if (w.ueberstunden.modell === 'bau') html += line('Überstunden', 'werden je Woche berechnet');
        if (w.ueberstunden.modell === 'monat') html += line('Überstunden', 'werden je Monat berechnet');
        if (w.diaeten.modell !== 'aus') {
          var auto = E.calcDay(Object.assign({}, d, { diaeten: null }), ui.edDate, w).diaetenStd;
          html += line('Diätenstunden', fh(r.diaetenStd) + ' h');
          html += line('Diäten', eur.format(r.diaetenBetrag));
          $('#e-diaeten').placeholder = 'Vorschlag ' + fh(auto);
        }
      }
      if (r.swMin) html += line('Schlechtwetter', fh(r.swMin / 60) + ' h');
      if (r.extraMin) html += line('Zusätzlich bezahlt', '+ ' + fh(r.extraMin / 60) + ' h');
      if (r.nettoMin / 60 > 12) warn += '<div class="notice warn">Mehr als 12 Arbeitsstunden an einem Tag. Bitte prüfe die Zeiten.</div>';
      r.warn.forEach(function (m) { warn += '<div class="notice warn">' + esc(m) + '</div>'; });
    }
    $('#e-preview').innerHTML = html;
    $('#e-warn').innerHTML = warn;
  }

  function saveDay() {
    var d = ui.edDraft, st = d.status;
    if (st === 'arbeit') {
      if (!d.von && d.bis) { toast('Es fehlt der Beginn.'); return false; }
      if (!d.von && !(+d.sw > 0)) { toast('Bitte mindestens den Beginn eintragen.'); return false; } // das Ende darf noch fehlen: Dienst läuft
    }
    var out = E.clone(d);
    out.sw = +out.sw || 0;
    out.diaeten = (out.diaeten === null || out.diaeten === '' || isNaN(+out.diaeten)) ? null : +out.diaeten;
    out.pausen = (out.pausen || []).filter(function (p) { return p.von && p.bis; });
    if (st !== 'arbeit') { out.von = ''; out.bis = ''; out.pausen = []; out.kunden = []; out.diaeten = null; out.sw = 0; out.notiz = ''; out.spaeter = false; }
    out.kunden = (out.kunden || []).map(function (k) { return { name: (k.name || '').trim(), tat: (k.tat || '').trim(), von: k.von || '', bis: k.bis || '' }; }).filter(function (k) { return k.name || k.tat || k.von || k.bis; });
    out.notiz = kundenNamen(out).join(', ');
    var fzo = {}, fzi = out.fz || {};
    ['kfz', 'kmVon', 'kmBis', 'diesel', 'adblue', 'oel'].forEach(function (f) {
      var v = fzi[f]; if (v === undefined || v === null || v === '') return;
      if (f === 'kfz') { v = String(v).trim().toUpperCase(); if (v) fzo.kfz = v; } else if (!isNaN(+v)) fzo[f] = +v;
    });
    if (st !== 'arbeit' || !Object.keys(fzo).length) delete out.fz; else out.fz = fzo;
    if (!out.kunden.length) delete out.kunden;
    if (!out.spaeter) delete out.spaeter;
    delete out.test;
    data.days[ui.edDate] = out;
    ui.edBase = JSON.stringify(ui.edDraft);
    save();
    var saved = ui.edDate;
    toast(out.von && !out.bis ? 'Gespeichert. Das Ende trägst du später nach.' : 'Gespeichert: ' + fmtShort(saved));
    if (ui.edFrom === 'monat') { var p = E.parseISO(saved); ui.y = p.y; ui.m = p.m; show('monat'); }
    else openEditor(out.von && !out.bis ? saved : E.addDays(saved, 1), 'erfassen'); // nach dem Speichern zum nächsten Tag, außer der Dienst läuft noch (Ende fehlt)
    return true;
  }

  function copyLast() {
    for (var i = 1; i <= 60; i++) {
      var k = E.addDays(ui.edDate, -i), x = data.days[k];
      if (x && x.status === 'arbeit' && x.von && x.bis) {
        ui.edDraft.von = x.von; ui.edDraft.bis = x.bis; ui.edDraft.pausen = E.clone(x.pausen || []);
        renderEditor(); toast('Zeiten von ' + fmtShort(k) + ' übernommen'); return;
      }
    }
    toast('Kein früherer Arbeitstag gefunden.');
  }

  /* ============================================================ EINSTELLUNGEN */
  function getPath(o, p) { return p.split('.').reduce(function (a, k) { return a == null ? a : a[k]; }, o); }
  function setPath(o, p, v) { var ks = p.split('.'), last = ks.pop(); var t = ks.reduce(function (a, k) { return a[k]; }, o); t[last] = v; }
  function curEntry() { return data.settings.filter(function (e) { return e.gueltigAb === ui.setKey; })[0] || null; }

  function renderSettings() {
    var list = sortedSettings(), cur = list.length ? E.wertAt(list, todayISO()) : null;
    if (!curEntry() && list.length) ui.setKey = (cur || list[0]).gueltigAb;
    $('#s-list').innerHTML = list.length ? list.map(function (e) {
      return '<button type="button" class="pick" data-key="' + e.gueltigAb + '" aria-pressed="' + (e.gueltigAb === ui.setKey) + '">ab ' + fmtDate(e.gueltigAb) + ' · ' + esc(PAKET_KURZ[e.paket] || '') + (e === cur ? ' · aktuell' : '') + '</button>';
    }).join('') : '<p class="hint">Du hast noch keine eigenen Werte. Bis dahin rechnet die App mit den Werten für Güterbeförderung.</p>';
    if (!$('#s-newdate').value) { var n = new Date(); $('#s-newdate').value = E.iso(n.getFullYear(), n.getMonth() + 1, 1); }
    $('#s-new').textContent = list.length ? 'Neue Werte ab diesem Datum anlegen' : 'Ersten Wertesatz anlegen';

    var en = curEntry();
    $('#s-form').hidden = !en;
    if (!en) return;
    $('#s-formtitle').textContent = 'Wertesatz ab ' + fmtDate(en.gueltigAb);
    $$('[data-path]', $('#s-form')).forEach(function (inp) {
      var v = getPath(en, inp.dataset.path);
      if (inp.type === 'checkbox') inp.checked = !!v;
      else inp.value = (v === null || v === undefined) ? '' : v;
    });
    
    $('#s-paket').innerHTML = Object.keys(E.PAKETE).map(function (k) { return '<option value="' + k + '"' + (en.paket === k ? ' selected' : '') + '>' + esc(E.PAKETE[k].name) + '</option>'; }).join('');
    paketInfo(en);
    renderStufen(en);
    renderVerlauf();
    settingsVisibility(en);
  }

  /* Verlauf eines Wertes (Stundenlohn, Diätensatz): von wann bis wann welcher Satz gegolten hat, plus "ab Datum ändern". */
  function verlaufListe(path) {
    var list = sortedSettings(), out = [];
    list.forEach(function (e) {
      var v = getPath(e, path); if (v === null || v === undefined || v === '') return;
      var last = out[out.length - 1];
      if (last && last.v === +v) return;
      out.push({ ab: e.gueltigAb, v: +v });
    });
    return out;
  }
  function renderVerlauf() {
    $$('.verlauf').forEach(function (box) {
      var path = box.dataset.vf, en = curEntry(), row = verlaufListe(path);
      var vis = !!en && !(path === 'diaeten.satz' && en.diaeten && en.diaeten.modell !== 'stunde');
      box.hidden = !vis; if (!vis) return;
      var today = todayISO(), html = '<div class="vl-title">So hat es bisher gegolten</div>';
      html += row.length ? '<ul class="vl">' + row.map(function (r, i) {
        var next = row[i + 1], bis = next ? E.addDays(next.ab, -1) : null, cur = (!next && r.ab <= today) || (next && r.ab <= today && next.ab > today);
        return '<li' + (cur ? ' class="cur"' : '') + '><span>' + (next ? fmtDate(r.ab) + ' bis ' + fmtDate(bis) : 'ab ' + fmtDate(r.ab)) + '</span><strong>' + eur.format(r.v) + (cur ? ' · aktuell' : '') + '</strong></li>';
      }).join('') + '</ul>' : '<p class="hint">Noch kein Wert eingetragen.</p>';
      html += '<div class="vl-new"><div class="field"><label>' + esc(box.dataset.label) + ' (€)</label><input type="number" inputmode="decimal" step="0.01" min="0" class="vl-val"></div>' +
        '<div class="field"><label>gilt ab</label><input type="date" class="vl-date" value="' + esc(box.dataset.date || '') + '"></div>' +
        '<button type="button" class="btn" data-act="v-add">Ab diesem Datum ändern</button></div>';
      box.innerHTML = html;
      var di = box.querySelector('.vl-date'); if (!di.value) { var n = new Date(); di.value = E.iso(n.getFullYear(), n.getMonth() + 1, 1); }
    });
  }
  function verlaufAdd(btn) {
    var box = btn.closest('.verlauf'), path = box.dataset.vf, val = parseFloat(String(box.querySelector('.vl-val').value).replace(',', '.')), date = box.querySelector('.vl-date').value;
    if (isNaN(val) || val < 0) { toast('Bitte den neuen Betrag eintragen.'); return; }
    if (!validISO(date)) { toast('Bitte ein Datum wählen.'); return; }
    var list = sortedSettings(), target = data.settings.filter(function (e) { return e.gueltigAb === date; })[0];
    if (!target) {
      var base = list.length ? (E.wertAt(list, date) || list[0]) : null;
      target = base ? E.clone(base) : E.neuerWertesatz('gueter', date);
      target.gueltigAb = date; delete target.test; data.settings.push(target);
    }
    setPath(target, path, val); delete target.test;
    // spätere Wertesätze mit dem alten Wert übernehmen den neuen Betrag gleich mit
    sortedSettings().forEach(function (e) { if (e.gueltigAb > date && getPath(e, path) === getPath(E.wertAt(sortedSettings(), E.addDays(date, -1)) || {}, path)) setPath(e, path, val); });
    ui.setKey = date; save(); renderSettings(); toast('Gespeichert: ab ' + fmtDate(date) + ' gilt ' + eur.format(val) + '.');
  }

  function paketInfo(en) {
    var p = E.PAKETE[en.paket] || E.PAKETE.gueter;
    $('#s-paketinfo').innerHTML = esc(p.hinweis) + (p.pruefen ? '<br><strong>Noch nicht an einem echten Lohnzettel geprüft.</strong> Bitte kontrolliere die Werte mit deinem Lohnzettel.' : '');
    $('#s-paketinfo').className = 'notice' + (p.pruefen ? ' warn' : '');
  }
  function settingsVisibility(en) {
    var dm = en.diaeten.modell, um = en.ueberstunden.modell;
    $('#s-d-stunde').hidden = dm !== 'stunde';
    $('#s-d-tag').hidden = dm !== 'tag';
    $('#s-d-vorschlag').hidden = dm === 'aus';
    $('#s-grenzefield').hidden = um !== 'bau';
    var sat = en.diaeten.satz || 0, wo = E.wochenStd(en.ueberstunden), soll = E.tagesSoll(en.ueberstunden), gr = en.ueberstunden.tagesGrenze || 9;
    var nT = E.sollTage(en.ueberstunden).length;
    $('#s-sollinfo').textContent = 'Normale Stunden pro Woche, zum Beispiel 40 (im Bau 39).';
    $('#s-tagsollinfo').textContent = 'Leer lassen: Wochenstunden ÷ Arbeitstage (' + fh(wo) + ' ÷ ' + nT + '). Jetzt gerechnet: ' + fh(soll) + ' Stunden. Das ist auch die Gutschrift für Urlaub und Krankenstand.';
    $('#s-dinfo').textContent = dm === 'stunde'
      ? 'Jede Diätenstunde zählt mit dem Satz. Beispiel: 10,5 Stunden × ' + eur.format(sat) + ' = ' + eur.format(10.5 * sat) + '.'
      : dm === 'tag'
        ? 'Pro Tag gibt es einen festen Betrag, je nachdem wie lange du unterwegs bist. Beispiel mit den Stufen unten: Wer länger als eine Stufe arbeitet, bekommt den Betrag dieser Stufe, nicht mehrere zusammen.'
        : 'Es werden keine Diäten berechnet.';
    var tage22 = 22;
    $('#s-uinfo').textContent = um === 'tag-saldo'
      ? 'Jeder Tag wird einzeln gerechnet: Arbeitsstunden minus Tagessoll (' + fh(soll) + ' Stunden). Beispiel: ein Tag mit ' + fh(soll + 2) + ' Stunden ergibt +2,0 Überstunden, ein kürzerer Tag mit ' + fh(soll - 1.5) + ' Stunden ergibt −1,5. Die Monatssumme ist die Summe aller Tage. So rechnet deine Excel.'
      : um === 'monat'
        ? 'Alle Stunden des Monats werden zusammengezählt, auch bezahlter Urlaub, Krankenstand und Feiertage. Davon werden die Sollstunden des Monats abgezogen: alle deine Arbeitstage (' + E.sollTage(en.ueberstunden).slice().sort(function (x, y) { return ((x + 6) % 7) - ((y + 6) % 7); }).map(function (d) { return WD[d]; }).join(', ') + '; Feiertage eingeschlossen) mal ' + fh(soll) + ' Stunden. Beispiel: ' + tage22 + ' Werktage ergeben ' + fh(tage22 * soll) + ' Sollstunden. Bei ' + fh(tage22 * soll + 11) + ' Stunden sind es 11,0 Überstunden. Im laufenden Monat wird nur bis heute gerechnet. Ein Tag ohne Eintrag, an dem du frei hattest, zieht Sollstunden ab. Trage ihn deshalb als Urlaub, Zeitausgleich oder Frei ein.'
        : 'Die Woche (Montag bis Sonntag) wird gerechnet. Stunden über der Tagesgrenze sind Überstunden, zum Beispiel alles ab Stunde ' + fh(gr) + ' an einem Tag. Dazu kommen Stunden, die über den Wochenstunden liegen. Beispiel bei Tagesgrenze ' + fh(gr) + ' und ' + fh(wo) + ' Wochenstunden: 5 Tage mit je ' + fh(gr) + ' Stunden sind ' + fh(5 * gr) + ' Stunden, minus ' + fh(wo) + ' = ' + fh(Math.max(0, 5 * gr - wo)) + ' Überstunden. Sonntage und Feiertage zählen über den Zuschlag.';
  }
  function renderStufen(en) {
    $('#s-stufen').innerHTML = (en.diaeten.stufen || []).map(function (s, i) {
      return '<div class="stufe">' +
        '<div class="field"><label for="st-a' + i + '">Mehr als (Std)</label><input type="number" id="st-a' + i + '" inputmode="decimal" step="0.5" min="0" data-si="' + i + '" data-sf="ab" value="' + s.ab + '"></div>' +
        '<div class="field"><label for="st-s' + i + '">Betrag (€)</label><input type="number" id="st-s' + i + '" inputmode="decimal" step="0.01" min="0" data-si="' + i + '" data-sf="satz" value="' + s.satz + '"></div>' +
        '<button type="button" class="rm" data-srm="' + i + '" aria-label="Stufe ' + (i + 1) + ' entfernen">×</button></div>';
    }).join('');
  }

  function onSettingInput(inp) {
    var en = curEntry(); if (!en) return;
    var t = inp.dataset.type, v;
    if (inp.dataset.path === 'gueltigAb') return; // wird bei "change" behandelt
    if (t === 'bool') v = inp.checked;
    else if (t === 'num') { v = parseFloat(String(inp.value).replace(',', '.')); if (isNaN(v)) v = 0; }
    else if (t === 'numnull') { v = String(inp.value).trim() === '' ? null : parseFloat(String(inp.value).replace(',', '.')); if (v !== null && isNaN(v)) v = null; }
    else v = inp.value;
    setPath(en, inp.dataset.path, v);
    delete en.test;
    save();
    settingsVisibility(en);
  }
  function onDateChange(inp) {
    var en = curEntry(); if (!en) return;
    var v = inp.value;
    if (!validISO(v)) { inp.value = en.gueltigAb; return; }
    if (data.settings.some(function (e) { return e !== en && e.gueltigAb === v; })) { toast('Für dieses Datum gibt es schon einen Wertesatz.'); inp.value = en.gueltigAb; return; }
    en.gueltigAb = v; ui.setKey = v; delete en.test; save(); renderSettings();
  }

  /* Sicherung */
  function fillBackup() { $('#b-text').value = JSON.stringify(data); }
  function restoreFrom(text) {
    var d;
    try { d = JSON.parse(text); } catch (e) { toast('Das ist kein gültiger Sicherungstext.'); return false; }
    if (!d || typeof d.days !== 'object' || !Array.isArray(d.settings)) { toast('Der Text enthält keine Stunden-Checker-Daten.'); return false; }
    data = { version: 1, settings: d.settings, days: d.days, abgleich: d.abgleich || {}, profil: d.profil || {} };
    save(); ui.setKey = null; toast('Daten wiederhergestellt.'); show('einstellungen');
    return true;
  }

  /* Testhilfe: März 2026 aus der Excel */
  var EXPECT = { lohn: 222, ueber: 54, dStd: 220.5, dEur: 507.15 };
  function hasTest() { return Object.keys(data.days).some(function (k) { return data.days[k].test; }); }
  function loadTest() {
    var T = window.TESTDATA_ALL, TD = T.days;
    Object.keys(TD).forEach(function (k) { if (!data.days[k] || data.days[k].test) { var d = E.clone(TD[k]); d.test = true; data.days[k] = d; } });
    var real = data.settings.filter(function (e) { return !e.test; });
    if (!real.some(function (e) { return e.gueltigAb <= '2026-03-01'; })) {
      var t1 = E.neuerWertesatz('gueter', '2026-03-01'); t1.test = true; // Standard Lkw: pro Monat, kein Sonn-/Feiertagszuschlag auf die Stunden
      t1.zuschlag.ft = 0; t1.betriebFrei = 'ueberstunden'; t1.stundenlohn = 14;            // Lohnzettel März: 14,00 € pro Stunde
      var t2 = E.clone(t1); t2.gueltigAb = '2026-06-01'; t2.stundenlohn = 14.38; // ab Juni 14,38 € (April und Mai wurden im Juni als Aufrollung nachverrechnet)
      data.settings = data.settings.filter(function (e) { return !e.test; });
      data.settings.push(t1, t2);
    }
    if (!data.profil || !data.profil.eintritt) { data.profil = E.clone(T.profil); data.profil.test = true; }
    Object.keys(T.lohnzettel).forEach(function (k) { if (!data.abgleich[k] || data.abgleich[k].test) { var o = E.clone(T.lohnzettel[k]); o.test = true; data.abgleich[k] = o; } });
    save(); ui.y = 2026; ui.m = 5; ui.setKey = null; ui.abAlle = false; toast('Beispieldaten März bis Oktober 2026 geladen.'); show('monat');
  }
  function removeTest() {
    Object.keys(data.days).forEach(function (k) { if (data.days[k].test) delete data.days[k]; });
    data.settings = data.settings.filter(function (e) { return !e.test; });
    Object.keys(data.abgleich).forEach(function (k) { if (data.abgleich[k].test) delete data.abgleich[k]; });
    if (data.profil && data.profil.test) data.profil = {};
    save(); ui.setKey = null; toast('Beispieldaten entfernt.'); show(ui.view);
  }
  function renderCheck() {
    var box = $('#t-check');
    if (!box) return;
    if (!hasTest()) { box.innerHTML = '<p class="hint">Noch keine Beispieldaten geladen.</p>'; return; }
    var ex = E.neuerWertesatz('gueter', '2026-01-01'); ex.zuschlag.so = 100; ex.ueberstunden.modell = 'tag-saldo'; // so rechnet die Excel
    var s = E.calcMonth({ settings: [ex], days: data.days }, 2026, 3).summe;
    var rows = [
      ['Lohnstunden', EXPECT.lohn, s.lohnStd, fh],
      ['Überstunden', EXPECT.ueber, s.ueberStd, fh],
      ['Diätenstunden', EXPECT.dStd, s.diaetenStd, fh],
      ['Diäten', EXPECT.dEur, s.diaetenBetrag, function (x) { return eur.format(x); }]
    ];
    box.innerHTML = '<table class="cmp"><thead><tr><th>März 2026</th><th>Excel</th><th>App</th><th></th></tr></thead><tbody>' +
      rows.map(function (r) {
        var ok = Math.abs(r[1] - r[2]) < 0.005;
        return '<tr><td>' + r[0] + '</td><td>' + r[3](r[1]) + '</td><td>' + r[3](r[2]) + '</td><td class="' + (ok ? 'ok' : 'no') + '">' + (ok ? '✓' : '✗') + '</td></tr>';
      }).join('') + '</tbody></table><p class="hint" style="margin-top:8px">Dieser Vergleich prüft den Rechenkern mit der Rechenart deiner Excel (pro Tag, Sonntag zählt doppelt), unabhängig von deinen Einstellungen.</p>';
  }

  /* ============================================================ Ereignisse */
  document.addEventListener('click', function (ev) {
    var t = ev.target.closest('button'); if (!t) return;
    if (t.classList.contains('tab')) {
      if (t.dataset.view === 'erfassen') openEditor(todayISO(), 'erfassen'); else show(t.dataset.view);
      return;
    }
    if (t.dataset.start) { data.settings = [E.neuerWertesatz(t.dataset.start, '2026-01-01')]; save(); ui.setKey = null; toast('Regeln geladen: ' + E.PAKETE[t.dataset.start].name); renderMonat(); return; }
    if (t.id === 'start-demo') { loadTest(); return; }
    if (t.dataset.act === 'v-add') { verlaufAdd(t); return; }
    if (t.dataset.date) { openEditor(t.dataset.date, 'monat'); return; }
    switch (t.id) {
      case 'm-prev': ui.abAlle = false; ui.m--; if (ui.m < 1) { ui.m = 12; ui.y--; } renderMonat(); return;
      case 'm-next': ui.abAlle = false; ui.m++; if (ui.m > 12) { ui.m = 1; ui.y++; } renderMonat(); return;
      case 'm-today': ui.y = now.getFullYear(); ui.m = now.getMonth() + 1; renderMonat(); return;
      case 'ab-more': ui.abAlle = true; renderAbgleich(ui.summe); return;
      case 'e-prev': openEditor(E.addDays(ui.edDate, -1), ui.edFrom); return;
      case 'e-next': openEditor(E.addDays(ui.edDate, 1), ui.edFrom); return;
      case 'e-addkunde': ui.edDraft.kunden.push({ name: '', tat: '', von: '', bis: '' }); renderKunden(); var ki = $('#k-n' + (ui.edDraft.kunden.length - 1)); if (ki) ki.focus(); return;
      case 'e-addpause': ui.edDraft.pausen.push({ von: '12:00', bis: '12:30' }); renderPausen(); updatePreview(); return;
      case 'e-copy': copyLast(); return;
      case 'od-go': if (ui.openDay) openEditor(ui.openDay, 'erfassen'); return;
      case 'e-bis-sugg': ui.edDraft.bis = t.dataset.t; $('#e-bis').value = t.dataset.t; updatePreview(); return;
      case 'e-von-now': case 'e-bis-now': {
        var nw = new Date(), hhmm = String(nw.getHours()).padStart(2, '0') + ':' + String(nw.getMinutes()).padStart(2, '0'), fld = t.id === 'e-von-now' ? 'von' : 'bis';
        ui.edDraft[fld] = hhmm; $('#e-' + fld).value = hhmm; updatePreview(); return;
      }
      case 'e-save': saveDay(); return;
      case 'l-save': {
        var go = ui.leaveGo;
        if (saveDay()) { $('#leave').hidden = true; ui.leaveGo = null; if (go) go(); }
        else $('#leave').hidden = true;
        return;
      }
      case 'l-discard': { var g2 = ui.leaveGo; ui.leaveGo = null; $('#leave').hidden = true; ui.edDraft = data.days[ui.edDate] ? E.clone(data.days[ui.edDate]) : blankDay(); if (!ui.edDraft.pausen) ui.edDraft.pausen = []; ui.edBase = JSON.stringify(ui.edDraft); if (g2) g2(); return; }
      case 'l-back': ui.leaveGo = null; $('#leave').hidden = true; if ($('#e-date')) $('#e-date').value = ui.edDate; return;
      case 'e-delete': arm(t, 'Wirklich löschen?', function () {
        delete data.days[ui.edDate]; save(); toast('Tag gelöscht.');
        if (ui.edFrom === 'monat') { var p = E.parseISO(ui.edDate); ui.y = p.y; ui.m = p.m; show('monat'); } else openEditor(ui.edDate, 'erfassen');
      }); return;
      case 's-new': {
        var date = $('#s-newdate').value;
        if (!validISO(date)) { toast('Bitte ein Datum wählen.'); return; }
        if (data.settings.some(function (e) { return e.gueltigAb === date; })) { toast('Für dieses Datum gibt es schon einen Wertesatz.'); return; }
        var base = curEntry(), ne = base ? E.clone(base) : E.neuerWertesatz('gueter', date);
        ne.gueltigAb = date; delete ne.test; data.settings.push(ne); ui.setKey = date; save(); renderSettings(); toast('Neue Werte ab ' + fmtDate(date) + ' angelegt. Ändere jetzt, was sich geändert hat.'); var fm = $('#s-form'); if (fm && fm.scrollIntoView) fm.scrollIntoView({ behavior: 'smooth', block: 'start' }); return;
      }
      case 's-paketload': {
        var en = curEntry(); if (!en) return;
        var pk = $('#s-paket').value, nw = E.neuerWertesatz(pk, en.gueltigAb);
        Object.keys(en).forEach(function (k) { delete en[k]; }); Object.assign(en, nw); save(); renderSettings(); toast('Werte aus dem Paket geladen.'); return;
      }
      case 's-addstufe': { var e2 = curEntry(); if (!e2) return; e2.diaeten.stufen.push({ ab: 0, satz: 0 }); save(); renderStufen(e2); return; }
      case 's-delete': arm(t, 'Wirklich löschen?', function () {
        data.settings = data.settings.filter(function (e) { return e.gueltigAb !== ui.setKey; }); ui.setKey = null; save(); renderSettings(); toast('Wertesatz gelöscht.');
      }); return;
      case 'b-copy': {
        var ta = $('#b-text'); ta.select();
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(ta.value).then(function () { toast('Sicherungstext kopiert.'); }, function () { toast('Text markiert. Bitte jetzt „Kopieren“ im Menü wählen.'); });
        else toast('Text markiert. Bitte jetzt „Kopieren“ im Menü wählen.');
        return;
      }
      case 'b-restore': arm(t, 'Daten wirklich ersetzen?', function () { restoreFrom($('#b-text').value); }); return;
      case 'b-wipe': arm(t, 'Wirklich alles löschen?', function () { data = { version: 1, settings: [], days: {}, abgleich: {}, profil: {} }; save(); ui.setKey = null; ui.edDate = null; toast('Alle Daten gelöscht.'); show('monat'); }); return;
      case 't-load': loadTest(); return;
      case 't-remove': removeTest(); return;
    }
    if (t.dataset.key) { ui.setKey = t.dataset.key; renderSettings(); return; }
    if (t.dataset.rmk !== undefined) { ui.edDraft.kunden.splice(+t.dataset.rmk, 1); renderKunden(); return; }
    if (t.dataset.rm !== undefined) { ui.edDraft.pausen.splice(+t.dataset.rm, 1); renderPausen(); updatePreview(); return; }
    if (t.dataset.srm !== undefined) { var e3 = curEntry(); e3.diaeten.stufen.splice(+t.dataset.srm, 1); save(); renderStufen(e3); return; }
  });

  function onInput(ev) {
    var t = ev.target, id = t.id;
    if (id && id.charAt(0) === 'k' && id.charAt(1) === '-' || id.indexOf('ku-') === 0 || id.indexOf('kz-') === 0) { if (id === 'k-eintritt' && ev.type !== 'change') return; if (konInput(t)) return; }
    if (t.dataset && t.dataset.fz) { if (!ui.edDraft.fz) ui.edDraft.fz = {}; ui.edDraft.fz[t.dataset.fz] = t.value; return; }
    if (t.dataset && t.dataset.k !== undefined && t.closest('#e-kunden')) { ui.edDraft.kunden[+t.dataset.k][t.dataset.f] = t.value; return; }
    if (t.dataset && t.dataset.i !== undefined && t.closest('#e-pausen')) { ui.edDraft.pausen[+t.dataset.i][t.dataset.f] = t.value; updatePreview(); return; }
    if (t.dataset && t.dataset.si !== undefined) { var en = curEntry(); var v = parseFloat(String(t.value).replace(',', '.')); en.diaeten.stufen[+t.dataset.si][t.dataset.sf] = isNaN(v) ? 0 : v; delete en.test; save(); return; }
    if (id && id.indexOf('s-wd-') === 0) { var ew = curEntry(); if (ew) { var set = E.sollTage(ew.ueberstunden), wdn = +id.slice(5), ix = set.indexOf(wdn); if (t.checked && ix < 0) set.push(wdn); if (!t.checked && ix >= 0) set.splice(ix, 1); ew.ueberstunden.sollTage = set.sort(function (x, y) { return x - y; }); delete ew.test; save(); settingsVisibility(ew); } return; }
    if (t.dataset && t.dataset.path) { if (ev.type === 'change' && t.dataset.path === 'gueltigAb') onDateChange(t); else onSettingInput(t); return; }
    if (ev.type === 'change' && id === 's-paket') { var e = curEntry(); if (e) { e.paket = t.value; delete e.test; save(); paketInfo(e); renderSettings(); } return; }
    switch (id) {
      case 'e-date': if (validISO(t.value)) openEditor(t.value, ui.edFrom); return;
      case 'e-status': ui.edDraft.status = t.value; $('#e-work').hidden = t.value !== 'arbeit'; updatePreview(); return;
      case 'e-von': ui.edDraft.von = t.value; updatePreview(); return;
      case 'e-bis': ui.edDraft.bis = t.value; updatePreview(); return;
      case 'e-diaeten': ui.edDraft.diaeten = t.value === '' ? null : parseFloat(String(t.value).replace(',', '.')); updatePreview(); return;
      case 'e-extra': { var xv = parseFloat(String(t.value).replace(',', '.')); if (xv > 0) ui.edDraft.extra = xv; else delete ui.edDraft.extra; updatePreview(); return; }
      case 'e-sw': ui.edDraft.sw = parseFloat(String(t.value).replace(',', '.')) || 0; updatePreview(); return;
      case 'e-spaeter': ui.edDraft.spaeter = t.checked; return;
    }
    if (t.tagName === 'INPUT' && id && id.indexOf('ab-') === 0) {
      var key = monthKey(), f = id.slice(3), o = data.abgleich[key] || (data.abgleich[key] = {});
      var num = parseFloat(String(t.value).replace(',', '.'));
      o[f] = (t.value === '' || isNaN(num)) ? null : num; delete o.test;
      var any = ['lohn', 'ueber', 'feiertag', 'urlaub', 'krank', 'pflege', 'dStd', 'zaKonto', 'sonder'].some(function (k) { return o[k] != null; });
      if (!any) delete data.abgleich[key];
      save(); paintAbgleich(); return;
    }
  }
  document.addEventListener('input', function (ev) { if (ev.target.id === 'e-date') return; onInput(ev); });
  document.addEventListener('change', function (ev) {
    var t = ev.target;
    if (t.id === 'b-file') {
      var f = t.files && t.files[0]; if (!f) return;
      var fr = new FileReader();
      fr.onload = function () { $('#b-text').value = String(fr.result || ''); toast('Datei gelesen. Tippe jetzt auf „Aus Text wiederherstellen“.'); };
      fr.onerror = function () { toast('Die Datei konnte nicht gelesen werden.'); };
      fr.readAsText(f); return;
    }
    onInput(ev);
  });
  $('#e-form').addEventListener('submit', function (ev) { ev.preventDefault(); saveDay(); });

  /* ============================================================ Start */
  window.addEventListener('beforeunload', function (ev) { if (isDirty()) { ev.preventDefault(); ev.returnValue = ''; } });
  show(data.settings.length === 0 && Object.keys(data.days).length === 0 ? 'monat' : 'erfassen'); // Wer schon Daten hat, startet direkt mit der Eingabe
})();
