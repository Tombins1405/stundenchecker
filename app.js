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
  var PAKET_KURZ = { gueter: 'Güterbeförderung', klein: 'Kleintransport', bau: 'Bau', handel: 'Handel', buero: 'Büro (Angestellte)', gastro: 'Gastgewerbe', metall: 'Metallgewerbe', eigen: 'Eigene Werte' };
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
  function applyRegion() {
    var p = data.profil || {}, cur = E.wertAt(data.settings, todayISO()), pk = cur && E.PAKETE[cur.paket];
    E.setRegion(pk && pk.land === 'DE' ? 'DE' : 'AT', p.bl || '');
  }
  function save() {
    applyRegion();
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
  applyRegion();
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
    if (view === 'einstellungen') { renderPraemienSettings(); renderSettings(); fillBackup(); renderCheck(); }
    renderOpenDay();
    window.scrollTo(0, 0);
    if (wzNeeds() && !ui.wiz) wzOpen('start', '2026-01-01');
    renderMia();
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
      (s.praemien && s.praemien.length ? '<div><dt>Prämien</dt><dd>' + eur.format(s.praemienEuro) + '</dd></div>' : '') +
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
      var isE = r.unit === '€';
      return '<div class="abrow">' +
        '<label class="what" for="ab-' + r.key + '">' + esc(r.label) + '</label>' +
        '<small class="abhint">' + esc(isE ? 'Prämie in Euro, so wie auf dem Lohnzettel.' : AB_HINT[r.key]) + '</small>' +
        '<div class="abline"><div class="abin"><input type="number" id="ab-' + r.key + '" inputmode="decimal" step="' + (isE ? '0.01' : '0.25') + '" value="' + (v == null ? '' : esc(v)) + '" placeholder="vom Lohnzettel"><span>' + (isE ? '€' : 'h') + '</span></div>' +
        '<div class="abapp">Deine Aufzeichnung<br><b>' + (isE ? eur.format(r.app) : fh(r.app) + ' h') + '</b></div>' +
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
        else if (r.status === 'klein') { txt = 'Fast gleich (' + (r.unit === '€' ? eur.format(Math.abs(r.diff)) : fh(Math.abs(r.diff)) + ' h') + ')'; cls += ' warn'; }
        else { txt = 'Lohnzettel hat ' + (r.unit === '€' ? eur.format(Math.abs(r.diff)) : fh(Math.abs(r.diff)) + ' h') + ' ' + (r.diff < 0 ? 'weniger' : 'mehr'); cls += ' bad'; bad.push(r); }
      }
      chip.className = cls; chip.textContent = txt;
    });
    var html = '';
    if (!given) html = '<p class="hint">Tippe ab, was auf deinem Lohnzettel steht. Die App zeigt dir sofort, ob es zu deiner Aufzeichnung passt.</p>';
    else if (!bad.length) html = '<div class="notice">Alle eingetragenen Zeilen stimmen mit deiner Aufzeichnung überein.</div>';
    else {
      html = '<div class="notice warn"><strong>Es gibt einen Unterschied.</strong><ul style="margin:6px 0 0;padding-left:20px">' +
        bad.map(function (r) { return '<li><strong>' + esc(r.label) + ':</strong> Auf dem Lohnzettel stehen ' + (r.unit === '€' ? eur.format(Math.abs(r.diff)) : fh(Math.abs(r.diff)) + ' Stunden') + ' ' + (r.diff < 0 ? 'weniger' : 'mehr') + ' als bei dir' + (r.app === 0 ? ' (in deiner Aufzeichnung gibt es diese Zeile nicht)' : '') + (eu.zeilen[r.key] != null ? ', ungefähr ' + eur.format(Math.abs(eu.zeilen[r.key])) + ' brutto' : '') + '.</li>'; }).join('') + '</ul>';
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
    renderMia();
    var p = data.profil || {};
    var kbl = $('#k-bl'), pkc = E.PAKETE[wAt(todayISO()).paket];
    if (kbl) { $('#k-blwrap').hidden = !(pkc && pkc.land === 'DE'); kbl.innerHTML = '<option value="">Bitte wählen</option>' + Object.keys(E.BUNDESLAENDER).map(function (k) { return '<option value="' + k + '"' + (p.bl === k ? ' selected' : '') + '>' + E.BUNDESLAENDER[k] + '</option>'; }).join(''); }
    $('#k-eintritt').value = p.eintritt || '';
    $('#k-urlaubjahr').value = p.urlaubJahr == null ? '' : p.urlaubJahr;
    $('#k-urlaubstart').value = p.urlaubStart == null ? '' : p.urlaubStart;
    $('#k-zastart').value = p.zaStart == null ? '' : p.zaStart;
    $('#k-kmvortag').checked = p.kmVortag !== false;
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
    if (id === 'k-bl') { data.profil.bl = t.value || ''; save(); renderKonten(); return true; }
    if (id === 'k-urlaubjahr') { data.profil.urlaubJahr = val; delete data.profil.test; save(); return true; }
    if (id === 'k-urlaubstart') { data.profil.urlaubStart = val; delete data.profil.test; save(); return true; }
    if (id === 'k-kmvortag') { data.profil.kmVortag = !!t.checked; delete data.profil.test; save(); return true; }
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
    if (!d.fahrzeuge) d.fahrzeuge = d.fz ? [E.clone(d.fz)] : []; // alte Einträge mit einem Fahrzeug
    delete d.fz;
    if (!d.kunden) d.kunden = d.notiz ? [{ name: d.notiz, von: '', bis: '' }] : []; // alte Einträge mit einem Kundentext
    d.kunden = d.kunden.map(function (k) { // alte Form (ein Kunde mit einer Tätigkeit) in die neue Form mit mehreren Tätigkeiten umwandeln
      if (k.taet) return k;
      return { name: k.name || '', taet: (k.tat || k.von || k.bis) ? [{ tat: k.tat || '', von: k.von || '', bis: k.bis || '' }] : [{ tat: '', von: '', bis: '' }] };
    });
  }
  function kundenNamen(d) { return (d.kunden || []).map(function (k) { return (k.name || '').trim(); }).filter(Boolean); }

  /* ---- Fahrzeuge: beliebig viele pro Tag, km-Stand vom letzten Mal vorbelegen ---- */
  function fahrzeugeVon(dd) { return dd.fahrzeuge || (dd.fz ? [dd.fz] : []); }
  function lastKm(kfz, date) {
    var best = null, bk = '';
    Object.keys(data.days).forEach(function (k) {
      if (k >= date || k <= bk) return;
      fahrzeugeVon(data.days[k]).forEach(function (f) { if (f.kfz === kfz && f.kmBis !== undefined && f.kmBis !== null && f.kmBis !== '') { best = +f.kmBis; bk = k; } });
    });
    return best;
  }
  function prefillFahrzeuge(draft, date) {
    if (!data.profil || data.profil.kmVortag === false) return;
    var prev = '';
    Object.keys(data.days).forEach(function (k) { if (k < date && k > prev && data.days[k].status === 'arbeit' && fahrzeugeVon(data.days[k]).length) prev = k; });
    if (!prev) return;
    draft.fahrzeuge = fahrzeugeVon(data.days[prev]).filter(function (f) { return f.kfz; }).map(function (f) {
      var km = lastKm(f.kfz, date); return { kfz: f.kfz, kmVon: km === null ? '' : km };
    });
  }
  function renderFahrzeuge() {
    $('#e-fahrzeuge').innerHTML = ui.edDraft.fahrzeuge.map(function (f, i) {
      function v(x) { return (f[x] === undefined || f[x] === null) ? '' : esc(f[x]); }
      function num(x, lab, step) { return '<div class="field"><label for="fz-' + x + i + '">' + lab + '</label><input type="number" id="fz-' + x + i + '" data-fi="' + i + '" data-ff="' + x + '" inputmode="' + (step === '1' ? 'numeric' : 'decimal') + '" min="0" step="' + step + '" value="' + v(x) + '"></div>'; }
      return '<div class="fzblock">' +
        '<div class="field fk"><label for="fz-kfz' + i + '">Kennzeichen ' + (i + 1) + '</label><input type="text" id="fz-kfz' + i + '" data-fi="' + i + '" data-ff="kfz" maxlength="15" autocapitalize="characters" autocomplete="off" list="f-kfz-list" value="' + v('kfz') + '"></div>' +
        '<button type="button" class="rm" data-rmfz="' + i + '" aria-label="Fahrzeug ' + (i + 1) + ' entfernen">×</button>' +
        num('kmVon', 'km-Stand Anfang', '1') + num('kmBis', 'km-Stand Ende', '1') +
        '<details class="fzmore"' + ((f.von || f.bis || f.diesel || f.adblue || f.oel) ? ' open' : '') + '><summary>Uhrzeiten und Betriebsflüssigkeiten (optional)</summary><div class="grid2">' +
        '<div class="field"><label for="fz-von' + i + '">Uhrzeit von</label><input type="text" readonly inputmode="none" data-time="1" placeholder="--:--" id="fz-von' + i + '" data-fi="' + i + '" data-ff="von" value="' + v('von') + '"></div>' +
        '<div class="field"><label for="fz-bis' + i + '">Uhrzeit bis</label><input type="text" readonly inputmode="none" data-time="1" placeholder="--:--" id="fz-bis' + i + '" data-fi="' + i + '" data-ff="bis" value="' + v('bis') + '"></div>' +
        num('diesel', 'Diesel (Liter)', '0.1') + num('adblue', 'AdBlue (Liter)', '0.1') + num('oel', 'Motoröl (Liter)', '0.1') +
        '</div></details></div>';
    }).join('');
  }
  function fahrzeugeSpeichern(list) {
    return (list || []).map(function (f) {
      var o = {};
      var kfz = String(f.kfz || '').trim().toUpperCase(); if (kfz) o.kfz = kfz;
      ['kmVon', 'kmBis', 'diesel', 'adblue', 'oel'].forEach(function (x) { if (f[x] !== undefined && f[x] !== null && f[x] !== '' && !isNaN(+f[x])) o[x] = +f[x]; });
      if (f.von) o.von = f.von; if (f.bis) o.bis = f.bis;
      return o;
    }).filter(function (o) { return Object.keys(o).length; });
  }

  /* ---- Prämien ---- */
  var PR_EINHEIT = [['stunde', 'je Stunde (automatisch)'], ['taet', 'je Stunde einer Tätigkeit (z. B. Kran)'], ['tag', 'je Tag (Haken)'], ['stueck', 'je Stück (Anzahl)'], ['tour', 'je Tour (Anzahl)'], ['monat', 'einmal pro Monat']];
  function praemienListe() { if (!data.profil) data.profil = {}; if (!data.profil.praemien) data.profil.praemien = []; return data.profil.praemien; }
  function renderPraemienSettings() {
    var list = praemienListe();
    $('#pr-list').innerHTML = list.length ? list.map(function (p, i) {
      return '<div class="prblock">' +
        '<div class="field pn"><label for="pr-n' + i + '">Name der Prämie</label><input type="text" id="pr-n' + i + '" data-pr="' + i + '" data-pf="name" maxlength="60" autocomplete="off" value="' + esc(p.name || '') + '"></div>' +
        '<button type="button" class="rm" data-rmpr="' + i + '" aria-label="Prämie ' + (i + 1) + ' entfernen">×</button>' +
        '<div class="field"><label for="pr-b' + i + '">Betrag (€)</label><input type="number" id="pr-b' + i + '" data-pr="' + i + '" data-pf="betrag" inputmode="decimal" step="0.01" min="0" value="' + esc(p.betrag == null ? '' : p.betrag) + '"></div>' +
        '<div class="field"><label for="pr-e' + i + '">Wofür</label><select id="pr-e' + i + '" data-pr="' + i + '" data-pf="einheit">' + PR_EINHEIT.map(function (e) { return '<option value="' + e[0] + '"' + (p.einheit === e[0] ? ' selected' : '') + '>' + e[1] + '</option>'; }).join('') + '</select></div>' +
        (p.einheit === 'taet' ? '<div class="field pn"><label for="pr-t' + i + '">Name der Tätigkeit (so wie du sie beim Kunden einträgst)</label><input type="text" id="pr-t' + i + '" data-pr="' + i + '" data-pf="taet" maxlength="40" autocomplete="off" value="' + esc(p.taet || '') + '"></div>' : '') +
        '<div class="field pn"><label for="pr-r' + i + '">Wann zählt sie? (nur für dich zur Erinnerung)</label><input type="text" id="pr-r' + i + '" data-pr="' + i + '" data-pf="regel" maxlength="160" autocomplete="off" value="' + esc(p.regel || '') + '"></div>' +
        '</div>';
    }).join('') : '<p class="hint">Noch keine Prämie angelegt.</p>';
  }
  function renderPraemienTag() {
    var list = praemienListe().filter(function (p) { return p.name && (p.einheit === 'tag' || p.einheit === 'stueck' || p.einheit === 'tour'); }), d = ui.edDraft;
    $('#e-praemiengroup').hidden = !list.length || d.status !== 'arbeit' || !E.bausteine(wAt(ui.edDate)).praemien;
    var pm = d.praemien || {};
    $('#e-praemien').innerHTML = list.map(function (p) {
      var v = pm[p.id], lab = esc(p.name) + ' (' + eur.format(+p.betrag || 0) + (p.einheit === 'tag' ? ' pro Tag' : p.einheit === 'tour' ? ' je Tour' : ' je Stück') + ')';
      if (p.einheit === 'tag') return '<label class="check"><input type="checkbox" data-pd="' + esc(p.id) + '"' + (v > 0 ? ' checked' : '') + '> ' + lab + '</label>';
      return '<div class="field"><label for="pd-' + esc(p.id) + '">' + lab + '</label><input type="number" id="pd-' + esc(p.id) + '" data-pd="' + esc(p.id) + '" inputmode="numeric" min="0" step="1" value="' + (v > 0 ? esc(v) : '') + '"></div>';
    }).join('');
  }
  function renderKunden() {
    $('#e-kunden').innerHTML = ui.edDraft.kunden.map(function (k, i) {
      var rows = (k.taet || []).map(function (t, j) {
        var sfx = i + '-' + j;
        return '<div class="taet">' +
          '<div class="field kn"><label for="k-t' + sfx + '">Tätigkeit' + (k.taet.length > 1 ? ' ' + (j + 1) : '') + '</label><input type="text" id="k-t' + sfx + '" data-k="' + i + '" data-j="' + j + '" data-f="tat" maxlength="120" list="e-tat-list" autocomplete="off" value="' + esc(t.tat || '') + '"></div>' +
          '<div class="field"><label for="k-v' + sfx + '">von</label><input type="text" readonly inputmode="none" data-time="1" placeholder="--:--" id="k-v' + sfx + '" data-k="' + i + '" data-j="' + j + '" data-f="von" value="' + esc(t.von || '') + '"></div>' +
          '<div class="field"><label for="k-b' + sfx + '">bis</label><input type="text" readonly inputmode="none" data-time="1" placeholder="--:--" id="k-b' + sfx + '" data-k="' + i + '" data-j="' + j + '" data-f="bis" value="' + esc(t.bis || '') + '"></div>' +
          (k.taet.length > 1 ? '<button type="button" class="rm" data-rmt="' + i + '-' + j + '" aria-label="Tätigkeit ' + (j + 1) + ' entfernen">×</button>' : '<span></span>') + '</div>';
      }).join('');
      return '<div class="kunde2">' +
        '<div class="khead"><div class="field kn"><label for="k-n' + i + '">Kunde / Baustelle ' + (i + 1) + '</label><input type="text" id="k-n' + i + '" data-k="' + i + '" data-f="name" maxlength="120" list="e-notiz-list" autocomplete="off" value="' + esc(k.name || '') + '"></div>' +
        '<button type="button" class="rm" data-rmk="' + i + '" aria-label="Kunde ' + (i + 1) + ' entfernen">×</button></div>' +
        rows + '<button type="button" class="linkbtn" data-addt="' + i + '">+ Tätigkeit zu diesem Kunden</button></div>';
    }).join('');
  }
  function openEditor(date, from, force) {
    if (!force && ui.edDraft && date !== ui.edDate && isDirty()) { askLeave(function () { openEditor(date, from, true); }); return; }
    ui.edDate = date; ui.edFrom = from || 'erfassen';
    ui.edDraft = data.days[date] ? E.clone(data.days[date]) : blankDay();
    normKunden(ui.edDraft);
    if (!data.days[date]) prefillFahrzeuge(ui.edDraft, date);
    ui.edBase = JSON.stringify(ui.edDraft);
    show('erfassen', true);
  }

  function renderEditor() {
    if (!ui.edDate) { ui.edDate = todayISO(); ui.edDraft = data.days[ui.edDate] ? E.clone(data.days[ui.edDate]) : blankDay(); normKunden(ui.edDraft); if (!data.days[ui.edDate]) prefillFahrzeuge(ui.edDraft, ui.edDate); ui.edBase = JSON.stringify(ui.edDraft); }
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
    Object.keys(data.days).forEach(function (k) { var dd = data.days[k]; (dd.kunden || []).forEach(function (x) { (x.taet || [x]).forEach(function (y) { if (y.tat) ts[y.tat] = (ts[y.tat] || 0) + 1; }); }); fahrzeugeVon(dd).forEach(function (f) { if (f.kfz) ks[f.kfz] = (ks[f.kfz] || 0) + 1; }); });
    Object.keys(ts).sort(function (x, y) { return ts[y] - ts[x]; }).slice(0, 30).forEach(function (n) { topt += '<option value="' + esc(n) + '">'; });
    Object.keys(ks).sort(function (x, y) { return ks[y] - ks[x]; }).slice(0, 10).forEach(function (n) { kopt += '<option value="' + esc(n) + '">'; });
    if (!$('#e-tat-list')) { var dl = document.createElement('datalist'); dl.id = 'e-tat-list'; $('#e-kunden').parentNode.appendChild(dl); }
    $('#e-tat-list').innerHTML = topt; $('#f-kfz-list').innerHTML = kopt;
    renderFahrzeuge(); renderPraemienTag();
    $('#e-notiz-list').innerHTML = opts; // Vorschläge aus früheren Einträgen
    if ($('#e-spaeter')) $('#e-spaeter').checked = !!d.spaeter;
    $('#e-swgroup').hidden = !w.schlechtwetter;
    var bsx = E.bausteine(w); $('#e-fzgroup').hidden = !bsx.fahrzeug; $('#e-kgroup').hidden = !bsx.kunden;
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
      var prl = E.praemienDay(d, r, praemienListe(), w);
      if (prl.length) { html += '<div class="kz-title">Prämien</div>'; prl.forEach(function (x) { html += line(esc(x.name) + (x.einheit === 'stunde' ? ' · ' + fh(x.menge) + ' h' : x.menge !== 1 ? ' · ' + nfp.format(x.menge) + 'x' : ''), eur.format(x.euro)); }); }
      var kz = E.kundenZeiten(d, w);
      if (kz.rows.some(function (x) { return x.min !== null; })) {
        html += '<div class="kz-title">Zeit pro Kunde</div>';
        kz.rows.forEach(function (x) {
          html += line('<strong>' + esc(x.name || 'Ohne Kunde') + '</strong>', x.min === null ? 'Zeit fehlt' : hm(x.min) + ' h');
          if (x.taet.length > 1 || (x.taet.length === 1 && x.taet[0].tat && x.min !== null)) x.taet.forEach(function (y) { if (y.tat || y.min !== null) html += line('<span class="kz-sub">' + esc(y.tat || 'Tätigkeit') + '</span>', y.min === null ? '–' : hm(y.min) + ' h'); });
        });
        if (kz.rows.length > 1) html += line('Zusammen', hm(kz.totalMin) + ' h', true);
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
      if (!d.von && !(+d.sw > 0)) { toast(data.days[ui.edDate] ? 'Beginn fehlt. Soll der Tag leer sein? Dann tippe unten auf „Tag löschen“.' : 'Bitte mindestens den Beginn eintragen.'); return false; } // das Ende darf noch fehlen: Dienst läuft
    }
    var out = E.clone(d);
    out.sw = +out.sw || 0;
    out.diaeten = (out.diaeten === null || out.diaeten === '' || isNaN(+out.diaeten)) ? null : +out.diaeten;
    out.pausen = (out.pausen || []).filter(function (p) { return p.von && p.bis; });
    if (st !== 'arbeit') { out.von = ''; out.bis = ''; out.pausen = []; out.kunden = []; out.diaeten = null; out.sw = 0; out.notiz = ''; out.spaeter = false; }
    out.kunden = (out.kunden || []).map(function (k) { return { name: (k.name || '').trim(), taet: (k.taet || []).map(function (t) { return { tat: (t.tat || '').trim(), von: t.von || '', bis: t.bis || '' }; }).filter(function (t) { return t.tat || t.von || t.bis; }) }; }).filter(function (k) { return k.name || k.taet.length; });
    out.notiz = kundenNamen(out).join(', ');
    var prx = {}; Object.keys(out.praemien || {}).forEach(function (k) { if (+out.praemien[k] > 0) prx[k] = +out.praemien[k]; });
    if (st !== 'arbeit' || !Object.keys(prx).length) delete out.praemien; else out.praemien = prx;
    var fzl = fahrzeugeSpeichern(out.fahrzeuge); delete out.fz;
    if (st !== 'arbeit' || !fzl.length) delete out.fahrzeuge; else out.fahrzeuge = fzl;
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



  /* ============================================================ MIA (Begleiterin, weiblich oder männlich, eigener Name, Outfit je Beruf, aktiv bis ruhiggestellt) */
  var MIA_OUT = { 'lkw:baustelle': ['helm', 'weste'], 'lkw:tour': ['kappe', 'paket'], 'lkw:fern': ['kappe'], 'lkw:muell': ['kappe', 'weste'], lkw: ['kappe'],
    bagger: ['helm', 'weste', 'ohren'], klein: ['kappe', 'klemmbrett'], mechaniker: ['overall', 'schluessel'], handel: ['schuerze'], buero: ['krawatte'],
    'gastro:service': ['schuerze', 'tablett'], 'gastro:kueche': ['kochhaube', 'schuerze'] };
  function miaOutfit(beruf, art) { return MIA_OUT[beruf + ':' + art] || MIA_OUT[beruf] || []; }
  function miaCfg() { var m = (data.profil && data.profil.mia) || {}; var f = m.figur === 'm' ? 'm' : 'w'; return { figur: f, name: (m.name || '').trim() || (f === 'm' ? 'Milo' : 'Mia'), ruhig: !!m.ruhig, skip: m.skip || {} }; }
  function miaSvg(f, outfit, pose) {
    outfit = outfit || []; var w = f !== 'm', has = function (x) { return outfit.indexOf(x) >= 0; };
    var shirt = w ? '#e8708a' : '#2f8f9d', fur = '#8d5b3a', face = '#f1d3b0', hat = has('helm') || has('kappe') || has('kochhaube');
    var item = has('paket') || has('tablett') || has('schluessel') || has('klemmbrett');
    var arm = '';
    if (has('paket')) arm += '<rect x="94" y="46" width="22" height="18" rx="2" fill="#c68642"/><path d="M94 55h22M105 46v18" stroke="#8b5a2b" stroke-width="2"/>';
    if (has('tablett')) arm += '<ellipse cx="104" cy="52" rx="15" ry="3.5" fill="#9ca3af"/><rect x="101" y="38" width="6" height="13" rx="2" fill="#bfdbfe"/>';
    if (has('schluessel')) arm += '<rect x="100" y="38" width="5" height="26" rx="2.5" fill="#9ca3af" transform="rotate(20 102 52)"/><circle cx="107" cy="38" r="6" fill="none" stroke="#9ca3af" stroke-width="4"/>';
    if (has('klemmbrett')) arm += '<rect x="96" y="42" width="18" height="24" rx="2" fill="#a16207"/><rect x="99" y="46" width="12" height="17" fill="#f8fafc"/>';
    var s = '<svg class="miasvg' + (pose ? ' p-' + pose : '') + (item ? ' hasitem' : '') + '" viewBox="0 0 120 130" aria-hidden="true"><g class="mia-bob">' +
      '<g class="mia-arm"><rect x="82" y="78" width="30" height="12" rx="6" fill="' + fur + '" transform="rotate(-50 86 84)"/>' + arm + '</g>' +
      '<rect x="34" y="82" width="52" height="40" rx="18" fill="' + shirt + '"/>' +
      '<rect x="8" y="80" width="30" height="12" rx="6" fill="' + fur + '" transform="rotate(25 36 86)"/>';
    if (has('weste')) s += '<rect x="34" y="82" width="52" height="40" rx="18" fill="#f97316"/><rect x="40" y="97" width="40" height="5" fill="#e5e7eb"/><rect x="40" y="108" width="40" height="5" fill="#e5e7eb"/>';
    if (has('krawatte')) s += '<path d="M60 84l-6 6 6 5 6-5z" fill="#1e3a8a"/><path d="M60 95l-5 20h10z" fill="#1e3a8a"/>';
    if (has('overall')) s += '<rect x="34" y="82" width="52" height="40" rx="18" fill="#2563eb"/><rect x="50" y="98" width="20" height="12" rx="2" fill="#3b82f6"/>';
    if (has('schuerze')) s += '<path d="M44 88h32v32h-32z" fill="#f8fafc"/><rect x="54" y="92" width="12" height="6" rx="1" fill="#93c5fd"/>';
    s += '<circle cx="24" cy="48" r="13" fill="' + fur + '"/><circle cx="96" cy="48" r="13" fill="' + fur + '"/><circle cx="24" cy="48" r="7" fill="' + face + '"/><circle cx="96" cy="48" r="7" fill="' + face + '"/>' +
      '<circle cx="60" cy="52" r="38" fill="' + fur + '"/><ellipse cx="60" cy="62" rx="27" ry="24" fill="' + face + '"/>' +
      '<g class="mia-eyes"><ellipse cx="48" cy="52" rx="4.5" ry="5.5" fill="#1f2937"/><ellipse cx="72" cy="52" rx="4.5" ry="5.5" fill="#1f2937"/></g>' +
      (w ? '<path d="M42 46l-4-3M46 44l-2-4M78 46l4-3M74 44l2-4" stroke="#1f2937" stroke-width="2" stroke-linecap="round"/><circle cx="40" cy="64" r="5" fill="#f4a3b5" opacity=".7"/><circle cx="80" cy="64" r="5" fill="#f4a3b5" opacity=".7"/>' : '') +
      '<ellipse cx="60" cy="62" rx="4" ry="3" fill="#6b4226"/><path d="M50 70q10 9 20 0" fill="none" stroke="#6b4226" stroke-width="3" stroke-linecap="round"/>';
    if (has('helm')) s += '<path d="M23 44q4-36 37-36t37 36z" fill="#facc15"/><rect x="20" y="40" width="80" height="8" rx="4" fill="#eab308"/>';
    else if (has('kappe')) s += '<path d="M24 38q36-34 72 0z" fill="#dc2626"/><rect x="58" y="34" width="46" height="8" rx="4" fill="#b91c1c"/>';
    else if (has('kochhaube')) s += '<path d="M30 32q-10-18 8-22q6-10 22-6q16-4 22 6q18 4 8 22z" fill="#fff" stroke="#e5e7eb" stroke-width="1.5"/><rect x="32" y="28" width="56" height="10" rx="3" fill="#f3f4f6"/>';
    else if (w) s += '<path d="M52 22q-8-12 -20-6q4 12 20 6z M68 22q8-12 20-6q-4 12 -20 6z" fill="#f06292"/><circle cx="60" cy="22" r="5" fill="#ec407a"/>';
    else s += '<path d="M24 36q36-34 72 0z" fill="#2563eb"/><rect x="58" y="32" width="46" height="8" rx="4" fill="#1d4ed8"/>';
    if (has('ohren')) s += '<path d="M20 48q40-52 80 0" stroke="#374151" stroke-width="5" fill="none"/><circle cx="22" cy="50" r="10" fill="#374151"/><circle cx="98" cy="50" r="10" fill="#374151"/>';
    s += '<g class="hand h-eyes"><circle cx="46" cy="52" r="10" fill="' + fur + '" stroke="#6b4226" stroke-width="2"/><circle cx="74" cy="52" r="10" fill="' + fur + '" stroke="#6b4226" stroke-width="2"/></g>' +
      '<g class="hand h-ears"><circle cx="20" cy="52" r="10" fill="' + fur + '" stroke="#6b4226" stroke-width="2"/><circle cx="100" cy="52" r="10" fill="' + fur + '" stroke="#6b4226" stroke-width="2"/></g>' +
      '<g class="hand h-mouth"><circle cx="54" cy="72" r="10" fill="' + fur + '" stroke="#6b4226" stroke-width="2"/><circle cx="66" cy="72" r="10" fill="' + fur + '" stroke="#6b4226" stroke-width="2"/></g>';
    return s + '</g></svg>';
  }
  var MIA_PAKET = { gueter: ['kappe'], bau: ['helm', 'weste'], klein: ['kappe', 'klemmbrett'], handel: ['schuerze'], buero: ['krawatte'], metall: ['overall', 'schluessel'], gastro: ['schuerze'] };
  function miaFor(date) { var w = wAt(date || todayISO()); return w.beruf ? miaOutfit(w.beruf, w.art) : (MIA_PAKET[String(w.paket).replace(/^de_/, '')] || MIA_PAKET[{ spedition: 'gueter' }[String(w.paket).replace(/^de_/, '')]] || []); }
  function miaSet(k, v) { if (!data.profil) data.profil = {}; if (!data.profil.mia) data.profil.mia = {}; data.profil.mia[k] = v; delete data.profil.test; save(); renderMia(); }
  function miaSkipInc(k) { if (!data.profil) data.profil = {}; if (!data.profil.mia) data.profil.mia = {}; var s = data.profil.mia.skip || (data.profil.mia.skip = {}); s[k] = (s[k] || 0) + 1; save(); }
  function miaPrevKey() { var y = now.getFullYear(), m = now.getMonth(); if (m === 0) { y--; m = 12; } return { y: y, m: m, key: y + '-' + (m < 10 ? '0' : '') + m }; }
  function miaNext() {
    if (!data.settings.length) return null;
    var w = wAt(todayISO()), bs = E.bausteine(w), c = miaCfg(), out = [], pk = miaPrevKey();
    if (w.stundenlohn == null) out.push({ k: 'lohn', pose: 'eyes', text: 'Mir fehlt noch dein Stundenlohn. Dann sage ich dir, was ein Unterschied in Euro wert ist.' });
    if (!Object.keys(data.days).length) out.push({ k: 'tag', text: 'Trag jetzt deinen ersten Tag ein. Beginn und Ende reichen.' });
    if (bs.praemien && !praemienListe().length) out.push({ k: 'praemien', text: 'Steht auf deinem Lohnzettel eine Prämie oder Zulage? Lege sie an, dann prüfe ich sie auch.' });
    var cnt = Object.keys(data.days).filter(function (k) { return k.slice(0, 7) === pk.key; }).length;
    if (cnt >= 5 && !(data.abgleich && data.abgleich[pk.key])) out.push({ k: 'lohnzettel', text: 'Dein Lohnzettel für ' + MON[pk.m - 1] + ' müsste da sein. Tippe die Zeilen ab, und ich vergleiche sie mit deiner Aufzeichnung.' });
    return out.filter(function (s) { return (c.skip[s.k] || 0) < 2; })[0] || null;
  }
  function miaGo(k) {
    if (k === 'lohn') { show('einstellungen'); setTimeout(function () { var el = $('#s-lohn'); if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.focus(); } }, 120); }
    else if (k === 'tag') { show('erfassen'); }
    else if (k === 'praemien') { show('einstellungen'); setTimeout(function () { var el = $('#s-praemien'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 120); }
    else if (k === 'lohnzettel') { var pk = miaPrevKey(); ui.y = pk.y; ui.m = pk.m; show('monat'); setTimeout(function () { var el = $('#m-abgleich'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 120); }
  }
  function miaPose(p) { var b = $('#mia-btn'); if (b && $('#mia-float')) b.innerHTML = miaSvg(miaCfg().figur, miaFor(), p); }
  function renderMia() {
    var c = miaCfg(), f = $('#mia-float'); if (f) f.hidden = !data.settings.length || !!ui.wiz;
    var ch = $('#mia-choose'); if (ch) ch.innerHTML = ['w', 'm'].map(function (x) { return '<button type="button" class="miaopt' + (c.figur === x ? ' on' : '') + '" data-mia="' + x + '" aria-label="' + (x === 'w' ? 'Weiblich' : 'Männlich') + '">' + miaSvg(x, miaFor(), '') + '<span>' + (x === 'w' ? 'Weiblich' : 'Männlich') + '</span></button>'; }).join('');
    var n = $('#mia-name'); if (n && document.activeElement !== n) n.value = (data.profil && data.profil.mia && data.profil.mia.name) || ''; if (n) n.placeholder = c.figur === 'm' ? 'Milo' : 'Mia';
    var ak = $('#mia-aktiv'); if (ak) ak.checked = !c.ruhig;
    if (!ui.miaPose) miaPose(c.ruhig || !miaNext() ? 'mouth' : '');
  }
  function miaOpen(auto) { if (!$('#mia-go')) return;
    var c = miaCfg(), nx = miaNext(), bb = $('#mia-bubble'); ui.miaPose = null;
    if (nx) { $('#mia-text').textContent = nx.text; $('#mia-go').hidden = false; $('#mia-later').hidden = false; $('#mia-go').dataset.k = nx.k; miaPose(nx.pose || ''); ui.miaStep = nx.k; }
    else { $('#mia-text').textContent = 'Im Moment gibt es nichts zu tun. Trag einfach deine Tage ein, ich rechne mit.'; $('#mia-go').hidden = true; $('#mia-later').hidden = true; miaPose(''); ui.miaStep = null; }
    $('#mia-quiet').textContent = c.ruhig ? 'Mia wieder aktiv stellen' : 'Mia ruhig stellen';
    bb.hidden = false;
  }
  function miaClose(pose) {
    $('#mia-bubble').hidden = true; ui.miaPose = pose || null; miaPose(pose || 'mouth');
    if (pose === 'ears') setTimeout(function () { ui.miaPose = null; miaPose('mouth'); }, 2200);
  }
  function miaAuto() {
    if (ui.wiz || ui.miaAuto) return; var c = miaCfg(); if (c.ruhig || !miaNext()) return;
    ui.miaAuto = true; setTimeout(function () { if (!ui.wiz && !miaCfg().ruhig) miaOpen(true); }, 1200);
  }
  (function () {
    function on(id, ev, fn) { var el = $(id); if (el) el.addEventListener(ev, fn); }
    on('#mia-btn', 'click', function () { if (!$('#mia-bubble').hidden) { miaClose('mouth'); return; } miaOpen(false); });
    on('#mia-go', 'click', function () { var k = this.dataset.k; miaClose('mouth'); miaGo(k); });
    on('#mia-later', 'click', function () { if (ui.miaStep) miaSkipInc(ui.miaStep); ui.miaAuto = true; miaClose('ears'); });
    on('#mia-quiet', 'click', function () { var r = !miaCfg().ruhig; miaSet('ruhig', r); if (r) { ui.miaAuto = true; miaClose('ears'); } else miaOpen(false); });
    on('#mia-choose', 'click', function (ev) { var b = ev.target.closest('[data-mia]'); if (b) miaSet('figur', b.dataset.mia); });
    on('#mia-name', 'input', function () { miaSet('name', this.value.slice(0, 20)); });
    on('#mia-aktiv', 'change', function () { miaSet('ruhig', !this.checked); });
  })();



  /* ---- Sprachen für Mia: Spracheingabe, Vorlesen, Antworten ---- */
  var UI_RTL = { fa: 1 };
  var UI_ALIAS = { bs: 'hr', sh: 'hr', ps: 'fa', prs: 'fa', nb: 'de', gsw: 'de' };
  var MIA_LANGS = { de: { n: 'Deutsch', sr: 'de-DE' }, en: { n: 'English', sr: 'en-GB' }, pl: { n: 'Polski', sr: 'pl-PL' }, hu: { n: 'Magyar', sr: 'hu-HU' }, tr: { n: 'Türkçe', sr: 'tr-TR' },
    hr: { n: 'Hrvatski', sr: 'hr-HR' }, sr: { n: 'Srpski', sr: 'sr-RS' }, it: { n: 'Italiano', sr: 'it-IT' }, ro: { n: 'Română', sr: 'ro-RO' }, uk: { n: 'Українська', sr: 'uk-UA' }, ru: { n: 'Русский', sr: 'ru-RU' },
    cs: { n: 'Čeština', sr: 'cs-CZ' }, sk: { n: 'Slovenčina', sr: 'sk-SK' } };
  var MIA_UI = {
    de: { q: 'Deine Frage', go: 'Los', read: 'Vorlesen', ask: 'Frag mich etwas', unk: 'Das weiß ich noch nicht. Tippe auf eines der Themen unten, oder frage mit anderen Worten.', mic: 'Das Mikrofon geht gerade nicht. Erlaube es im Browser oder tippe deine Frage.' },
    pl: { q: 'Twoje pytanie', go: 'Dalej', read: 'Przeczytaj', ask: 'Zapytaj mnie', unk: 'Tego jeszcze nie wiem. Dotknij jednego z tematów poniżej albo zapytaj innymi słowami.', mic: 'Mikrofon teraz nie działa. Zezwól na niego w przeglądarce albo wpisz pytanie.' },
    hu: { q: 'A kérdésed', go: 'Mehet', read: 'Felolvasás', ask: 'Kérdezz tőlem', unk: 'Ezt még nem tudom. Koppints az alábbi témák egyikére, vagy kérdezz más szavakkal.', mic: 'A mikrofon most nem működik. Engedélyezd a böngészőben, vagy írd be a kérdést.' },
    en: { q: 'Your question', go: 'Go', read: 'Read aloud', ask: 'Ask me', unk: 'I do not know that yet. Tap one of the topics below, or ask in other words.', mic: 'The microphone is not working right now. Allow it in the browser or type your question.' },
    tr: { q: 'Sorun', go: 'Tamam', read: 'Sesli oku', ask: 'Bana sor', unk: 'Bunu henüz bilmiyorum. Aşağıdaki konulardan birine dokun ya da başka sözcüklerle sor.', mic: 'Mikrofon şu an çalışmıyor. Tarayıcıda izin ver ya da sorunu yaz.' }
  };
  var MIA_TR = {
    en: [["Entering hours", "Open Erfassen (Log). Enter Start (Beginn) and End (Ende), add your breaks (Pausen) and tap Speichern (Save). \"Jetzt\" (Now) fills in the current time.", "hour enter log time work start end save"], ["Adding a bonus", "Go to Einstellungen (Settings), then Prämien (Bonuses), and add your bonus, for example per hour, per day or per piece. Then you enter it on the day. The app calculates it and compares it with your payslip.", "bonus premium allowance extra"], ["Checking my payslip", "Open Übersicht (Overview) and scroll to \"Stimmt mein Lohnzettel?\". Type the hours and amounts from your payslip. The app shows what matches and where a difference remains in hours or euros. You do not have to fill in every line.", "payslip check match compare wage slip"], ["Overtime and surcharges", "In Einstellungen you find weekly hours, the overtime model and surcharges. They come from your collective agreement (Kollektivvertrag). Your payslip shows whether they are right. You can change them at any time, also from a date onwards.", "overtime surcharge sunday saturday holiday night"], ["Daily allowance (Diäten)", "Diäten is the daily allowance, extra money paid per day. In Einstellungen, Diäten, you set whether it is paid per hour or per day in steps. You find the amount on your payslip.", "allowance diaeten diat per diem expenses meal"], ["Changing pay or job", "In Einstellungen you can change your wage or job from a date onwards. Old days stay calculated with the old values.", "wage change job raise salary"], ["Holiday or sick leave", "In Erfassen choose, at \"Art des Tages\" (Type of day), for example Urlaub (holiday), Krankenstand (sick leave) or Zeitausgleich (time off in lieu). Then you do not need to enter times.", "holiday vacation sick leave off"], ["My data", "Your entries are on your phone. With your account they are also stored on a secured server in Frankfurt so nothing gets lost. Technically the operator of the app could view them. Encryption that rules this out is being worked on. You type in your payslip numbers yourself.", "data privacy safe secure account personal"], ["Backup", "Under Konto you find \"Sicherung speichern oder teilen\". It saves a file with all your data. With it you can restore everything on a new phone.", "backup restore lost save file new phone"], ["Installing the app", "Open the page in the browser and tap \"App installieren\" (menu, top right). If Android warns you, tap \"Trotzdem installieren\" (install anyway). The app is safe, it is just this website.", "install icon home screen app"], ["Speech and reading aloud", "At the question field tap the microphone and speak. With the read button I read my answer aloud. The microphone needs internet and your permission in the browser.", "speech voice microphone read language"], ["Quieting Mia", "Tap \"Mia ruhig stellen\" and I will not speak up by myself. Under Konto you can switch me on again and change the figure and name.", "mia milo quiet silence name figure"]],
    pl: [
      ['Wpisywanie godzin', 'Otwórz Erfassen (wpisywanie). Wpisz początek (Beginn) i koniec (Ende), dodaj przerwy (Pausen) i dotknij Speichern (zapisz). Przyciskiem "Jetzt" wstawisz aktualną godzinę.', 'godzin godzine wpis czas praca poczatek koniec zapis'],
      ['Dodanie premii', 'Wejdź w Einstellungen (ustawienia), potem Prämien (premie) i dodaj swoją premię, np. za godzinę, dzień lub sztukę. Potem wpisujesz ją w danym dniu. Aplikacja ją policzy i porówna z paskiem wypłaty.', 'premi dodatek bonus'],
      ['Sprawdzenie paska wypłaty', 'Otwórz Übersicht (przegląd) i przewiń do "Stimmt mein Lohnzettel?". Przepisz godziny i kwoty z paska wypłaty. Aplikacja pokaże, co się zgadza i gdzie jest różnica w godzinach lub euro. Nie musisz wypełniać wszystkich wierszy.', 'pasek wyplat rozlicz sprawdz zgadza porown'],
      ['Nadgodziny i dodatki', 'W Einstellungen znajdziesz godziny tygodniowo, model nadgodzin i dodatki. Pochodzą z układu zbiorowego (Kollektivvertrag). Czy się zgadzają, widzisz na pasku wypłaty. Możesz je zmienić w każdej chwili, także od wybranej daty.', 'nadgodzin dodatek niedziel sobot swiet nocn'],
      ['Diety (Diäten)', 'Diäten to dieta, czyli dodatek dzienny. W Einstellungen, Diäten, ustawiasz, czy jest płacona za godzinę czy za dzień. Kwotę znajdziesz na pasku wypłaty.', 'diet diaet dzienn delegac'],
      ['Zmiana stawki lub zawodu', 'W Einstellungen możesz zmienić stawkę lub zawód od wybranej daty. Stare dni zostają policzone po starych wartościach.', 'stawk zmien zawod podwyzk wynagrodz'],
      ['Urlop lub zwolnienie', 'W Erfassen wybierz przy "Art des Tages" np. Urlaub (urlop), Krankenstand (zwolnienie) lub Zeitausgleich (odbiór nadgodzin). Wtedy nie musisz wpisywać godzin.', 'urlop zwolnien chorob l4 wolne'],
      ['Moje dane', 'Twoje wpisy są na Twoim telefonie. Z kontem są dodatkowo zapisywane na zabezpieczonym serwerze we Frankfurcie, żeby nic nie zginęło. Technicznie operator aplikacji mógłby je zobaczyć. Szyfrowanie, które to wyklucza, jest w przygotowaniu. Liczby z paska wypłaty wpisujesz sam.', 'dane ochron prywat bezpiecz konto'],
      ['Kopia zapasowa', 'W Konto znajdziesz "Sicherung speichern oder teilen". Zapisuje plik z wszystkimi danymi. Dzięki niemu odtworzysz wszystko na nowym telefonie.', 'kopia zapas backup odtworz zgubi'],
      ['Instalacja aplikacji', 'Otwórz stronę w przeglądarce i dotknij "App installieren" (menu u góry po prawej). Jeśli Android ostrzega, dotknij "Trotzdem installieren" (mimo to zainstaluj). Aplikacja jest bezpieczna, to po prostu ta strona.', 'instal ikon ekran aplikacj'],
      ['Mowa i czytanie', 'Przy pytaniu dotknij mikrofonu i mów. Przyciskiem czytania przeczytam odpowiedź na głos. Mikrofon potrzebuje internetu i Twojej zgody w przeglądarce.', 'mow mikrofon glos czyta jezyk'],
      ['Wyciszenie Mii', 'Dotknij "Mia ruhig stellen", a nie będę się odzywać sama. W Konto możesz mnie znów włączyć i zmienić postać oraz imię.', 'mia milo cisz wylacz imie postac']
    ],
    hu: [
      ['Órák rögzítése', 'Nyisd meg az Erfassen (rögzítés) részt. Írd be a kezdést (Beginn) és a végét (Ende), add meg a szüneteket (Pausen), és koppints a Speichern (mentés) gombra. A "Jetzt" gombbal a pontos idő kerül be.', 'ora rogzit ido munka kezdes vege mentes'],
      ['Prémium felvétele', 'Menj az Einstellungen (beállítások), majd a Prämien (prémiumok) részre, és vedd fel a prémiumot, például óránként, naponta vagy darabonként. Utána a napnál rögzíted. Az app kiszámolja, és összeveti a bérjegyzékkel.', 'premium potlek bonus'],
      ['Bérjegyzék ellenőrzése', 'Nyisd meg az Übersicht (áttekintés) részt, és görgess a "Stimmt mein Lohnzettel?" kártyáig. Írd be az órákat és összegeket a bérjegyzékről. Az app megmutatja, mi egyezik, és hol van eltérés órában vagy euróban. Nem kell minden sort kitölteni.', 'berjegyzek ellenor stimmel egyezik osszevet'],
      ['Túlóra és pótlékok', 'Az Einstellungen részben találod a heti órákat, a túlóramodellt és a pótlékokat. Ezek a kollektív szerződésből (Kollektivvertrag) jönnek. Hogy egyeznek-e, a bérjegyzéken látod. Bármikor módosíthatod, akár egy dátumtól kezdve is.', 'tulora potlek vasarnap szombat unnep ejszaka'],
      ['Napidíj (Diäten)', 'A Diäten a napidíj, vagyis a kiegészítő napi pénz. Az Einstellungen, Diäten alatt állítod be, hogy óránként vagy napi lépcsők szerint fizetik. Az összeget a bérjegyzéken találod.', 'napidij diaet etkezes kiszallas'],
      ['Bér vagy foglalkozás váltása', 'Az Einstellungen részben egy dátumtól kezdve átállíthatod a bért vagy a foglalkozást. A régi napok a régi értékekkel maradnak kiszámolva.', 'ber valt foglalkozas fizetesemeles oraber'],
      ['Szabadság vagy betegség', 'Az Erfassen részben az "Art des Tages" mezőnél válaszd például az Urlaub (szabadság), Krankenstand (betegszabadság) vagy Zeitausgleich (szabadidő-kiegyenlítés) lehetőséget. Ekkor nem kell időt megadni.', 'szabadsag beteg tappenz szabi'],
      ['Az adataim', 'A bejegyzéseid a telefonodon vannak. A fiókoddal ezen kívül egy védett frankfurti szerveren is mentődnek, hogy ne vesszen el semmi. Technikailag az alkalmazás üzemeltetője láthatná őket. Egy ezt kizáró titkosítás készül. A bérjegyzék számait te írod be.', 'adat adatved biztonsag fiok magan'],
      ['Mentés', 'A Konto részben van a "Sicherung speichern oder teilen". Ez egy fájlba menti az összes adatod. Ezzel új telefonon visszaállíthatsz mindent.', 'mentes backup visszaallit elveszett'],
      ['App telepítése', 'Nyisd meg az oldalt a böngészőben, és koppints az "App installieren" gombra (menü jobb felül). Ha az Android figyelmeztet, koppints a "Trotzdem installieren" (mégis telepít) gombra. Az app biztonságos, csak ez az oldal.', 'telepit ikon kezdokepernyo alkalmazas'],
      ['Beszéd és felolvasás', 'A kérdésmezőnél koppints a mikrofonra, és beszélj. A felolvasás gombbal hangosan felolvasom a választ. A mikrofonhoz internet és a böngészőben engedély kell.', 'beszed mikrofon hang felolvas nyelv'],
      ['Mia elnémítása', 'Koppints a "Mia ruhig stellen" gombra, és nem szólok magamtól. A Konto részben újra bekapcsolhatsz, és ott módosíthatod az alakot és a nevet.', 'mia milo nemit kikapcsol nev alak']
    ],
    tr: [
      ['Saat girmek', 'Erfassen (kayıt) bölümünü aç. Başlangıcı (Beginn) ve bitişi (Ende) yaz, molaları (Pausen) ekle ve Speichern (kaydet) düğmesine dokun. "Jetzt" ile şu anki saat girilir.', 'saat gir kayit calisma baslangic bitis kaydet'],
      ['Prim eklemek', 'Einstellungen (ayarlar), sonra Prämien (primler) bölümüne git ve primini ekle, örneğin saat, gün veya adet başına. Sonra o günde girersin. Uygulama hesaplar ve maaş bordrosuyla karşılaştırır.', 'prim ek odeme bonus'],
      ['Maaş bordrosunu kontrol', 'Übersicht (genel bakış) bölümünü aç ve "Stimmt mein Lohnzettel?" kartına kadar kaydır. Bordrodaki saatleri ve tutarları yaz. Uygulama neyin tuttuğunu, saat veya euro olarak nerede fark olduğunu gösterir. Tüm satırları doldurman gerekmez.', 'bordro maas kontrol tutuyor karsilastir'],
      ['Fazla mesai ve zamlar', 'Einstellungen içinde haftalık saatleri, fazla mesai modelini ve zamları bulursun. Bunlar toplu iş sözleşmesinden (Kollektivvertrag) gelir. Doğru olup olmadığını bordrodan görürsün. İstediğin zaman, hatta bir tarihten itibaren değiştirebilirsin.', 'fazla mesai zam pazar cumartesi tatil gece'],
      ['Harcırah (Diäten)', 'Diäten günlük harcırahtır, yani ek günlük ödeme. Einstellungen, Diäten bölümünde saat başına mı yoksa gün başına kademeli mi ödendiğini ayarlarsın. Tutarı bordronda bulursun.', 'harcirah diaet gunluk yemek'],
      ['Ücret veya meslek değiştirmek', 'Einstellungen bölümünde ücreti veya mesleği bir tarihten itibaren değiştirebilirsin. Eski günler eski değerlerle hesaplanmış kalır.', 'ucret meslek degistir zam saatlik'],
      ['İzin veya hastalık', 'Erfassen içinde "Art des Tages" alanında örneğin Urlaub (izin), Krankenstand (hastalık izni) veya Zeitausgleich (mesai karşılığı izin) seç. O zaman saat girmen gerekmez.', 'izin hasta rapor tatil'],
      ['Verilerim', 'Kayıtların telefonunda durur. Hesabınla ayrıca Frankfurt'taki güvenli bir sunucuya da kaydedilir, hiçbir şey kaybolmasın diye. Teknik olarak uygulamanın işletmecisi bunları görebilir. Bunu engelleyen bir şifreleme üzerinde çalışılıyor. Bordrodaki sayıları kendin yazarsın.', 'veri gizlilik guvenlik hesap kisisel'],
      ['Yedekleme', 'Konto bölümünde "Sicherung speichern oder teilen" vardır. Tüm verilerini bir dosyaya kaydeder. Yeni telefonda her şeyi bununla geri yükleyebilirsin.', 'yedek yedekleme backup geri yukle kayboldu'],
      ['Uygulamayı kurmak', 'Siteyi tarayıcıda aç ve "App installieren" düğmesine dokun (sağ üstte menü). Android uyarırsa "Trotzdem installieren" (yine de kur) düğmesine dokun. Uygulama güvenlidir, sadece bu web sitesidir.', 'kur yukle ikon ana ekran uygulama'],
      ['Konuşma ve sesli okuma', 'Soru alanında mikrofona dokun ve konuş. Sesli okuma düğmesiyle cevabı yüksek sesle okurum. Mikrofon için internet ve tarayıcıda izin gerekir.', 'konus mikrofon ses oku dil'],
      ['Mia’yı susturmak', '"Mia ruhig stellen" düğmesine dokun, kendiliğimden konuşmam. Konto bölümünden beni tekrar açabilir, figürü ve adı değiştirebilirsin.', 'mia milo sustur kapat isim figur']
    ]
  };
  function miaLang() { return uiLang(); }

  /* ---- Mia beantwortet Fragen (feste Antworten, kein Server) + Spracheingabe + Vorlesen ---- */
  var MIA_FAQ = [
    { t: 'Stunden eintragen', k: ['eintrag', 'stunden', 'beginn', 'ende', 'arbeitszeit', 'tag speichern', 'erfassen', 'zeit'], a: 'Öffne Erfassen. Tippe bei Beginn und Ende die Uhrzeit ein, trage die Pausen ein und tippe auf Speichern. Mit "Jetzt" nimmt die App die aktuelle Uhrzeit.' },
    { t: 'Prämie anlegen', k: ['prämie', 'praemie', 'zulage', 'bonus', 'kran', 'anlegen'], a: 'Gehe zu Einstellungen, dann Prämien, und lege deine Prämie an (zum Beispiel pro Stunde, pro Tag oder pro Stück). Danach trägst du sie im Tag ein. Die App rechnet sie aus und vergleicht sie mit dem Lohnzettel.' },
    { t: 'Lohnzettel prüfen', k: ['lohnzettel', 'abrechnung', 'prüfen', 'pruefen', 'stimmt', 'vergleich', 'abgleich', 'kontrol'], a: 'Öffne Übersicht und scrolle zu "Stimmt mein Lohnzettel?". Tippe die Stunden und Beträge von deinem Lohnzettel ab. Die App zeigt dir, was gleich ist und wo ein Unterschied in Stunden oder Euro bleibt. Du musst nicht alle Zeilen ausfüllen.' },
    { t: 'Überstunden und Zuschläge', k: ['überstunden', 'ueberstunden', 'zuschlag', 'sonntag', 'samstag', 'feiertag', 'nacht', 'mehrarbeit'], a: 'Unter Einstellungen stehen Wochenstunden, Überstundenmodell und Zuschläge. Sie kommen aus deinem Kollektivvertrag. Ob sie stimmen, siehst du auf deinem Lohnzettel. Du kannst sie jederzeit ändern, auch ab einem Datum.' },
    { t: 'Diäten / Taggeld', k: ['diäten', 'diaeten', 'taggeld', 'spesen', 'tagesgeld'], a: 'Diäten sind das Taggeld, das du zusätzlich bekommst. Unter Einstellungen, Diäten, stellst du ein, ob es pro Stunde oder pro Tag nach Stufen gezahlt wird. Den Betrag findest du auf deinem Lohnzettel.' },
    { t: 'Lohn oder Beruf ändern', k: ['lohn ändern', 'lohn aendern', 'beruf', 'wechsel', 'neuer lohn', 'erhöhung', 'erhoehung', 'ab datum', 'stundenlohn'], a: 'Unter Einstellungen kannst du den Lohn oder den Beruf ab einem Datum ändern. Alte Tage bleiben mit den alten Werten gerechnet. So passt es auch nach einer Lohnerhöhung oder einem Jobwechsel.' },
    { t: 'Urlaub oder Krankenstand', k: ['urlaub', 'krank', 'zeitausgleich', 'feiertag', 'frei', 'art des tages'], a: 'Wähle in Erfassen bei "Art des Tages" zum Beispiel Urlaub, Krankenstand oder Zeitausgleich. Dann musst du keine Uhrzeiten eintragen.' },
    { t: 'Meine Daten und Datenschutz', k: ['daten', 'datenschutz', 'sicher', 'konto', 'speicher', 'weitergegeben', 'privat'], a: 'Deine Einträge liegen auf deinem Handy. Mit deinem Konto werden sie zusätzlich auf einem gesicherten Server in Frankfurt gespeichert, damit nichts verloren geht. Technisch könnte der Betreiber der App sie einsehen. Eine Verschlüsselung, die das ausschließt, ist in Arbeit. Deine Lohnzettel-Zahlen tippst du selbst ab.' },
    { t: 'Sicherung', k: ['sicherung', 'backup', 'verloren', 'wiederherstellen', 'handy wechsel'], a: 'Unter Konto findest du "Sicherung speichern oder teilen". Das speichert eine Datei mit allen deinen Daten. Damit kannst du alles auf einem neuen Handy wiederherstellen.' },
    { t: 'App installieren', k: ['installier', 'startbildschirm', 'icon', 'symbol', 'app', 'link'], a: 'Öffne die Seite im Browser und tippe auf "App installieren" (Menü oben rechts). Falls Android warnt, tippe auf "Trotzdem installieren". Die App ist ungefährlich, sie ist nur diese Webseite.' },
    { t: 'Sprache und Vorlesen', k: ['sprache', 'sprechen', 'mikrofon', 'diktier', 'vorlesen', 'deutsch'], a: 'Tippe bei deiner Frage an mich auf das Mikrofon und sprich. Mit "Vorlesen" lese ich dir meine Antwort vor. Das Mikrofon braucht Internet und deine Erlaubnis im Browser.' },
    { t: 'Mia ruhig stellen', k: ['mia', 'milo', 'ruhig', 'weg', 'nervt', 'ausschalten', 'figur', 'name'], a: 'Tippe auf "Mia ruhig stellen", dann melde ich mich nicht mehr von selbst. Du kannst mich unter Konto wieder aktivieren, und dort auch Figur und Namen ändern.' }
  ];
  function miaFaqText(i, w) { var tr = MIA_TR[miaLang()]; return tr ? tr[i][w === 'a' ? 1 : 0] : MIA_FAQ[i][w]; }
  function miaNorm(s) { return (s || '').toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/ł/g, 'l').replace(/ı/g, 'i').normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
  function miaAnswer(q) {
    var n = miaNorm(q), best = null, bs = 0;
    var L = miaLang(), tr = MIA_TR[L];
    MIA_FAQ.forEach(function (e, i) { var sc = 0, ks = e.k.concat(tr ? tr[i][2].split(' ') : []); ks.forEach(function (k) { var nk = miaNorm(k); if (nk.length > 2 && n.indexOf(nk) >= 0) sc += nk.length > 5 ? 2 : 1; }); if (sc > bs) { bs = sc; best = i; } });
    return best != null ? miaFaqText(best, 'a') : (MIA_UI[L] || MIA_UI.de).unk;
  }
  function miaShowAns(t) { var el = $('#mia-ans'); if (!el) return; el.textContent = t; el.hidden = false; var r = $('#mia-read'); if (r) r.hidden = !('speechSynthesis' in window); miaPose(''); }
  (function () {
    function on(id, ev, fn) { var el = $(id); if (el) el.addEventListener(ev, fn); }
    function paintAsk() {
      var L = miaLang(), u = MIA_UI[L] || MIA_UI.de, chips = $('#mia-chips');
      if (chips) chips.innerHTML = MIA_FAQ.map(function (e, i) { return '<button type="button" class="chip" data-faq="' + i + '">' + esc(miaFaqText(i, 't')) + '</button>'; }).join('');
      $('#mia-q').placeholder = u.q; $('#mia-send').textContent = u.go; $('#mia-read').textContent = u.read; $('#mia-askbtn').textContent = u.ask;
      var sel = $('#mia-lang'); if (sel) sel.value = L;
    }
    var ls = $('#mia-lang'); if (ls) { ls.innerHTML = Object.keys(MIA_LANGS).map(function (k) { return '<option value="' + k + '">' + MIA_LANGS[k].n + '</option>'; }).join(''); ls.addEventListener('change', function () { uiSetLang(this.value); $('#mia-ans').hidden = true; paintAsk(); }); }
    paintAsk(); ui.miaPaint = paintAsk;
    on('#mia-askbtn', 'click', function () { var p = $('#mia-ask'); p.hidden = !p.hidden; if (!p.hidden) { var q = $('#mia-q'); if (q) q.focus(); } });
    on('#mia-chips', 'click', function (ev) { var b = ev.target.closest('[data-faq]'); if (b) miaShowAns(miaFaqText(+b.dataset.faq, 'a')); });
    function send() { var q = $('#mia-q').value.trim(); if (q) miaShowAns(miaAnswer(q)); }
    on('#mia-send', 'click', send);
    on('#mia-q', 'keydown', function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); send(); } });
    on('#mia-read', 'click', function () {
      try { speechSynthesis.cancel(); var u = new SpeechSynthesisUtterance($('#mia-ans').textContent); var LG = miaLang(); u.lang = MIA_LANGS[LG].sr; var vs = speechSynthesis.getVoices().filter(function (v) { return v.lang.slice(0, 2).toLowerCase() === LG; }); if (vs.length) u.voice = vs[0]; speechSynthesis.speak(u); } catch (e) {}
    });
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition, mic = $('#mia-mic');
    if (SR && mic) {
      mic.hidden = false; var rec = null;
      mic.addEventListener('click', function () {
        if (rec) { try { rec.stop(); } catch (e) {} return; }
        try {
          rec = new SR(); rec.lang = MIA_LANGS[miaLang()].sr; rec.interimResults = false; rec.maxAlternatives = 1;
          rec.onresult = function (ev) { var t = ev.results[0][0].transcript; $('#mia-q').value = t; send(); };
          rec.onerror = function () { miaShowAns((MIA_UI[miaLang()] || MIA_UI.de).mic); };
          rec.onend = function () { rec = null; mic.classList.remove('rec'); };
          mic.classList.add('rec'); rec.start();
        } catch (e) { rec = null; mic.classList.remove('rec'); }
      });
    }
  })();

  /* ============================================================ ERSTE FRAGEN (Beruf, Bausteine, Kollektivvertrag, Lohn) */
  var WZ_ORDER = ['mia', 'beruf', 'art', 'bausteine', 'kv', 'lohn'];
  function wzNeeds() { return data.settings.length === 0 && Object.keys(data.days).length === 0 && !ui.wizDismissed; }
  function wzOpen(mode, ab) {
    var cur = mode === 'change' ? wAt(ab) : null, w = { mode: mode, ab: ab, step: mode === 'start' ? 'mia' : 'beruf', hist: [], beruf: null, art: null, b: { fahrzeug: true, kunden: true, praemien: true }, diaeten: true, sw: false, paket: 'gueter', eintritt: '', lohn: '', wochen: '', dsatz: '' };
    if (cur) {
      w.beruf = cur.beruf || null; w.art = cur.art || null; var bb = E.bausteine(cur); w.b = { fahrzeug: bb.fahrzeug, kunden: bb.kunden, praemien: bb.praemien };
      w.diaeten = cur.diaeten.modell !== 'aus'; w.sw = !!cur.schlechtwetter; w.paket = cur.paket || 'gueter'; w.bl = (data.profil && data.profil.bl) || '';
      w.lohn = cur.stundenlohn == null ? '' : cur.stundenlohn; w.wochen = E.wochenStd(cur.ueberstunden); w.dsatz = cur.diaeten.satz || '';
    }
    w.mia = (miaCfg().figur); ui.wiz = w; wzRender(); $('#wiz').hidden = false;
  }
  function wzSetBeruf(k) {
    var b = E.BERUFE[k], w = ui.wiz; w.beruf = k; w.art = null; w.b = { fahrzeug: b.b.fahrzeug, kunden: b.b.kunden, praemien: b.b.praemien };
    w.diaeten = b.diaeten; w.sw = b.sw; w.paket = b.paket;
    var p = E.PAKETE[w.paket].werte; w.wochen = p.ueberstunden.wochenStd; w.dsatz = p.diaeten.modell === 'stunde' ? p.diaeten.satz : '';
  }
  function wzNext() {
    var w = ui.wiz, i = WZ_ORDER.indexOf(w.step); w.hist.push(w.step);
    var n = WZ_ORDER[i + 1];
    if (n === 'art' && !(E.BERUFE[w.beruf] && E.BERUFE[w.beruf].arten)) n = 'bausteine';
    if (!n) { wzFinish(); return; }
    w.step = n; wzRender();
  }
  function wzBack() { var w = ui.wiz; if (!w.hist.length) { wzClose(true); return; } w.step = w.hist.pop(); wzRender(); }
  function wzClose(dismiss) { $('#wiz').hidden = true; if (dismiss && ui.wiz && ui.wiz.mode === 'start') ui.wizDismissed = true; ui.wiz = null; }
  function wzFinish() {
    var w = ui.wiz, ab = w.mode === 'start' ? '2026-01-01' : w.ab, old = w.mode === 'change' ? wAt(ab) : null, set;
    if (old && old.paket === w.paket) { set = E.clone(old); } else { set = E.neuerWertesatz(w.paket, ab); if (old) { set.betriebFrei = old.betriebFrei; set.pauseAutoMin = old.pauseAutoMin; } }
    set.gueltigAb = ab; delete set.test; set.beruf = w.beruf; set.art = w.art || null; set.bausteine = { fahrzeug: !!w.b.fahrzeug, kunden: !!w.b.kunden, praemien: !!w.b.praemien };
    set.schlechtwetter = !!w.sw;
    if (!w.diaeten) set.diaeten.modell = 'aus';
    else if (set.diaeten.modell === 'aus') { set.diaeten.modell = E.PAKETE[w.paket].werte.diaeten.modell; if (set.diaeten.modell === 'aus') { set.diaeten.modell = 'stunde'; set.diaeten.maxStd = 12; } }
    var lo = parseFloat(String(w.lohn).replace(',', '.')); set.stundenlohn = isNaN(lo) ? null : lo;
    var wo = parseFloat(String(w.wochen).replace(',', '.')); if (wo > 0) set.ueberstunden.wochenStd = wo;
    var ds = parseFloat(String(w.dsatz).replace(',', '.')); if (w.diaeten && set.diaeten.modell === 'stunde' && ds >= 0) set.diaeten.satz = ds;
    data.settings = data.settings.filter(function (e) { return e.gueltigAb !== ab; }); data.settings.push(set);
    if (w.mode === 'start') { if (!data.profil) data.profil = {}; data.profil.mia = { figur: w.mia === 'm' ? 'm' : 'w', name: (w.miaName || '').trim() }; }
    if (String(w.paket).indexOf('de_') === 0 && w.bl) { if (!data.profil) data.profil = {}; data.profil.bl = w.bl; }
    if (w.eintritt && validISO(w.eintritt)) { if (!data.profil) data.profil = {}; if (!data.profil.eintritt) data.profil.eintritt = w.eintritt; }
    save(); ui.setKey = ab; var start = w.mode === 'start';
    wzClose(false); ui.miaAuto = false; renderMia(); miaAuto();
    if (start) { toast('Fertig. Du kannst jetzt deinen ersten Tag eintragen.'); show('erfassen', true); }
    else { toast('Gespeichert: ab ' + fmtDate(ab) + ' gilt ' + (E.berufName(set) || 'der neue Beruf') + '.'); renderSettings(); }
  }
  function wzRender() {
    var w = ui.wiz, el = $('#wiz-body'), i = WZ_ORDER.indexOf(w.step), nSteps = 4, html = '';
    var shown = Math.min(i, 3) + (w.step === 'art' ? 0 : 1) + (i > 1 ? -1 : 0); // Schritt 1 (Beruf+Art), 2, 3, 4
    var einf = E.BERUFE[w.beruf] && E.BERUFE[w.beruf].einfach;
    var off = w.mode === 'start' ? 1 : 0, num = w.step === 'mia' ? 1 : (w.step === 'beruf' || w.step === 'art' ? 1 : w.step === 'bausteine' ? 2 : w.step === 'kv' ? 3 : 4) + off;
    if (w.mode === 'start') nSteps = 5;
    var say = { mia: 'Hallo! Wen möchtest du an deiner Seite haben?', beruf: 'Damit ich alles passend einrichte: Was machst du?', art: 'Noch eine Frage, dann weiß ich es.', bausteine: 'Sag mir, was du aufzeichnen willst. Den Rest blende ich aus.', kv: 'Der Kollektivvertrag steht auf deinem Lohnzettel.', lohn: 'Fast fertig. Jetzt noch dein Lohn.' }[w.step] || '';
    var wo = E.BERUFE[w.beruf] ? miaOutfit(w.beruf, w.art) : [];
    html += '<div class="wzmia">' + miaSvg(w.mia === 'm' ? 'm' : 'w', wo, '') + '<div class="wzsay">' + esc(say) + '</div></div>';
    html += '<p class="wzstep"><span>Schritt ' + num + ' von ' + nSteps + '</span>' + (w.mode === 'change' ? '<span> · gilt ab ' + esc(fmtDate(w.ab)) + '</span>' : '') + '</p>';
    if (w.step === 'beruf') {
      html += '<h3>Was machst du beruflich?</h3><div class="wzlist">' + Object.keys(E.BERUFE).map(function (k) { return '<button type="button" class="btn wzopt' + (w.beruf === k ? ' on' : '') + '" data-wb="' + k + '">' + esc(E.BERUFE[k].name) + '</button>'; }).join('') + '</div>';
    } else if (w.step === 'art') {
      var ar = E.BERUFE[w.beruf].arten;
      html += '<h3>Was beschreibt deine Arbeit am besten?</h3><div class="wzlist">' + Object.keys(ar).map(function (k) { return '<button type="button" class="btn wzopt' + (w.art === k ? ' on' : '') + '" data-wa="' + k + '">' + esc(ar[k].name) + '</button>'; }).join('') + '</div>';
    } else if (w.step === 'bausteine') {
      html += '<h3>Was möchtest du aufzeichnen?</h3><p class="hint">Du kannst das jederzeit ändern.</p>' +
        (einf ? '' : '<label class="check"><input type="checkbox" data-wc="fahrzeug"' + (w.b.fahrzeug ? ' checked' : '') + '><span>Fahrzeug und Kilometer</span></label>' +
        '<label class="check"><input type="checkbox" data-wc="kunden"' + (w.b.kunden ? ' checked' : '') + '><span>Kunden, Baustellen und Tätigkeiten</span></label>') +
        '<label class="check"><input type="checkbox" data-wc="praemien"' + (w.b.praemien ? ' checked' : '') + '><span>Prämien</span></label>' +
        '<label class="check"><input type="checkbox" data-wc="diaeten"' + (w.diaeten ? ' checked' : '') + '><span>Diäten</span></label>' +
        (einf ? '' : '<label class="check"><input type="checkbox" data-wc="sw"' + (w.sw ? ' checked' : '') + '><span>Schlechtwetter (Bau)</span></label>');
    } else if (w.step === 'kv') {
      var kvs = (E.BERUFE[w.beruf] && E.BERUFE[w.beruf].kvs) || ['gueter', 'bau', 'eigen'], cp = E.PAKETE[w.paket];
      html += '<h3>Welcher Kollektivvertrag gilt für dich?</h3><p class="hint">Steht auf deinem Lohnzettel. Weißt du es nicht, nimm „Weiß ich nicht“ und stelle alles selbst ein.</p><div class="wzlist">' +
        kvs.map(function (k) { return '<button type="button" class="btn wzopt' + (w.paket === k ? ' on' : '') + '" data-wk="' + k + '">' + (k === 'eigen' ? 'Weiß ich nicht / eigene Werte' : esc(E.PAKETE[k].name)) + '</button>'; }).join('') + '</div>' +
        (cp && cp.pruefen && w.paket !== 'eigen' ? '<p class="hint"><strong>Noch nicht an einem echten Lohnzettel geprüft.</strong> Bitte vergleiche die Werte später mit deinem Lohnzettel.</p>' : '') +
        (String(w.paket).indexOf('de_') === 0 ? '<div class="field"><label for="wz-bl">Bundesland (für die Feiertage)</label><select id="wz-bl" data-wf="bl"><option value="">Bitte wählen</option>' + Object.keys(E.BUNDESLAENDER).map(function (k) { return '<option value="' + k + '"' + (w.bl === k ? ' selected' : '') + '>' + E.BUNDESLAENDER[k] + '</option>'; }).join('') + '</select></div>' : '') +
        (w.mode === 'start' ? '<div class="field"><label for="wz-ein">Eintritt in die Firma (optional)</label><input type="date" id="wz-ein" data-wf="eintritt" value="' + esc(w.eintritt) + '"></div>' : '');
    } else if (w.step === 'mia') {
      var mc = miaCfg();
      html += '<h3>Wer soll dich begleiten?</h3><div class="miachoose">' +
        ['w', 'm'].map(function (f) { return '<button type="button" class="miaopt' + (w.mia === f ? ' on' : '') + '" data-wm="' + f + '">' + miaSvg(f) + '<span>' + (f === 'w' ? 'Weiblich' : 'Männlich') + '</span></button>'; }).join('') + '</div>' +
        '<div class="field"><label for="wz-mianame">Wie soll sie oder er heißen?</label><input type="text" id="wz-mianame" maxlength="20" autocomplete="off" data-wf="miaName" placeholder="' + (w.mia === 'm' ? 'Milo' : 'Mia') + '" value="' + esc(w.miaName || '') + '"></div>';
    } else {
      var pw = E.PAKETE[w.paket].werte;
      html += '<h3>Dein Lohn</h3>' +
        '<div class="field"><label for="wz-lohn">Stundenlohn (€ pro Stunde)</label><input type="number" id="wz-lohn" inputmode="decimal" step="0.01" min="0" data-wf="lohn" value="' + esc(w.lohn) + '"></div>' +
        '<div class="field"><label for="wz-wo">Wochenstunden</label><input type="number" id="wz-wo" inputmode="decimal" step="0.5" min="0" data-wf="wochen" value="' + esc(w.wochen) + '"></div>' +
        (w.diaeten && (pw.diaeten.modell === 'stunde' || pw.diaeten.modell === 'aus') ? '<div class="field"><label for="wz-ds">Diäten (€ pro Stunde)</label><input type="number" id="wz-ds" inputmode="decimal" step="0.01" min="0" data-wf="dsatz" value="' + esc(w.dsatz) + '"></div>' : '') +
        '<p class="hint">Alles Weitere kannst du später in den Einstellungen nachtragen.</p>';
    }
    var canNext = (w.step === 'beruf' && w.beruf) || (w.step === 'art' && w.art) || w.step === 'bausteine' || w.step === 'kv' || w.step === 'lohn' || w.step === 'mia';
    html += '<div class="btns">' + '<button type="button" class="btn primary" id="wz-next"' + (canNext ? '' : ' disabled') + '>' + (w.step === 'lohn' ? 'Fertig' : 'Weiter') + '</button>' +
      '<button type="button" class="btn" id="wz-back">' + (w.hist.length ? 'Zurück' : (w.mode === 'start' ? 'Später' : 'Abbrechen')) + '</button></div>';
    el.innerHTML = html;
  }
  (function () {
    var ov = $('#wiz');
    ov.addEventListener('click', function (ev) {
      var t = ev.target.closest('button'); if (!t || !ui.wiz) return; var w = ui.wiz;
      if (t.dataset.wb) { wzSetBeruf(t.dataset.wb); wzNext(); return; }
      if (t.dataset.wa) { w.art = t.dataset.wa; var a = E.BERUFE[w.beruf].arten[w.art]; w.b = { fahrzeug: a.b.fahrzeug, kunden: a.b.kunden, praemien: a.b.praemien }; wzNext(); return; }
      if (t.dataset.wm) { w.mia = t.dataset.wm; wzRender(); return; }
      if (t.dataset.wk) { w.paket = t.dataset.wk; var p = E.PAKETE[w.paket].werte; w.wochen = p.ueberstunden.wochenStd; w.dsatz = p.diaeten.modell === 'stunde' ? p.diaeten.satz : ''; wzRender(); return; }
      if (t.id === 'wz-next') { wzNext(); return; }
      if (t.id === 'wz-back') { wzBack(); return; }
    });
    ov.addEventListener('change', function (ev) { var t = ev.target; if (!ui.wiz) return; if (t.dataset.wc) { var k = t.dataset.wc; if (k === 'diaeten' || k === 'sw') ui.wiz[k] = t.checked; else ui.wiz.b[k] = t.checked; } });
    ov.addEventListener('input', function (ev) { var t = ev.target; if (ui.wiz && t.dataset.wf) ui.wiz[t.dataset.wf] = t.value; });
    $('#s-beruf-go').addEventListener('click', function () { var d = $('#s-beruf-ab').value; if (!validISO(d)) { toast('Bitte ein Datum wählen.'); return; } wzOpen('change', d); });
  })();

  /* ============================================================ EINSTELLUNGEN */
  function getPath(o, p) { return p.split('.').reduce(function (a, k) { return a == null ? a : a[k]; }, o); }
  function setPath(o, p, v) { var ks = p.split('.'), last = ks.pop(); var t = ks.reduce(function (a, k) { return a[k]; }, o); t[last] = v; }
  function curEntry() { return data.settings.filter(function (e) { return e.gueltigAb === ui.setKey; })[0] || null; }

  function renderSettings() {
    var list = sortedSettings(), cur = list.length ? E.wertAt(list, todayISO()) : null;
    if (!curEntry() && list.length) ui.setKey = (cur || list[0]).gueltigAb;
    $('#s-list').innerHTML = list.length ? list.map(function (e) {
      return '<button type="button" class="pick" data-key="' + e.gueltigAb + '" aria-pressed="' + (e.gueltigAb === ui.setKey) + '">ab ' + fmtDate(e.gueltigAb) + ' · ' + esc((E.BERUFE[e.beruf] && E.BERUFE[e.beruf].name) || (PAKET_KURZ[e.paket] || (E.PAKETE[e.paket] && E.PAKETE[e.paket].name) || '')) + (e === cur ? ' · aktuell' : '') + '</button>';
    }).join('') : '<p class="hint">Du hast noch keine eigenen Werte. Bis dahin rechnet die App mit den Werten für Güterbeförderung.</p>';
    if (!$('#s-newdate').value) { var n = new Date(); $('#s-newdate').value = E.iso(n.getFullYear(), n.getMonth() + 1, 1); }
    $('#s-new').textContent = list.length ? 'Neue Werte ab diesem Datum anlegen' : 'Ersten Wertesatz anlegen';

    var cwb = cur ? E.berufName(cur) : null;
    $('#s-beruf-now').textContent = cur ? 'Aktuell: ' + (cwb || PAKET_KURZ[cur.paket] || (E.PAKETE[cur.paket] && E.PAKETE[cur.paket].name) || 'Eigene Werte') + ' (gilt seit ' + fmtDate(cur.gueltigAb) + ').' : 'Noch nicht eingerichtet.';
    if (!$('#s-beruf-ab').value) { var nb = new Date(); $('#s-beruf-ab').value = E.iso(nb.getFullYear(), nb.getMonth() + 1, 1); }
    var en = curEntry();
    if (en && !en.bausteine) en.bausteine = { fahrzeug: true, kunden: true, praemien: true };
    $('#s-praemien').hidden = !!(en && en.bausteine && en.bausteine.praemien === false);
    $('#s-form').hidden = !en; $('#s-form2').hidden = !en;
    if (!en) return;
    $('#s-formtitle').textContent = 'Wertesatz ab ' + fmtDate(en.gueltigAb);
    $$('#s-form [data-path], #s-form2 [data-path]').forEach(function (inp) {
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
        return '<li' + (cur ? ' class="cur"' : '') + '><span>' + (next ? fmtDate(r.ab) + ' bis ' + fmtDate(bis) : 'ab ' + fmtDate(r.ab)) + '</span><strong>' + eur.format(r.v) + (cur ? ' · aktuell' : '') + '</strong>' + (i > 0 ? '<button type="button" class="vl-x" data-act="v-del" data-ab="' + esc(r.ab) + '" aria-label="Diese Änderung ab ' + fmtDate(r.ab) + ' entfernen">×</button>' : '') + '</li>';
      }).join('') + '</ul>' : '<p class="hint">Noch kein Wert eingetragen.</p>';
      html += '<div class="vl-new"><div class="field"><label>' + esc(box.dataset.label) + ' (€)</label><input type="number" inputmode="decimal" step="0.01" min="0" class="vl-val"></div>' +
        '<div class="field"><label>gilt ab</label><input type="date" class="vl-date" value="' + esc(box.dataset.date || '') + '"></div>' +
        '<button type="button" class="btn" data-act="v-add">Ab diesem Datum ändern</button></div>';
      box.innerHTML = html;
      var di = box.querySelector('.vl-date'); if (!di.value) { var n = new Date(); di.value = E.iso(n.getFullYear(), n.getMonth() + 1, 1); }
    });
  }

  // Eine Änderung im Verlauf rückgängig machen: der Wert ab diesem Datum wird wieder der vorherige Wert.
  function verlaufDel(btn) {
    var box = btn.closest('.verlauf'), path = box.dataset.vf, ab = btn.dataset.ab, row = verlaufListe(path), i = -1;
    row.forEach(function (r, k) { if (r.ab === ab) i = k; });
    if (i < 1) return;
    var prev = row[i - 1].v, bis = row[i + 1] ? row[i + 1].ab : null, sorted = sortedSettings();
    sorted.forEach(function (e) { if (e.gueltigAb >= ab && (!bis || e.gueltigAb < bis)) { setPath(e, path, prev); delete e.test; } });
    // Wertesätze, die jetzt genau dem vorherigen gleichen, überflüssig geworden sind: entfernen
    var again = sortedSettings(), keep = [];
    again.forEach(function (e, k) {
      var before = keep[keep.length - 1];
      if (before && k > 0 && JSON.stringify(Object.assign({}, e, { gueltigAb: '', test: 0 })) === JSON.stringify(Object.assign({}, before, { gueltigAb: '', test: 0 }))) return;
      keep.push(e);
    });
    data.settings = keep; ui.setKey = null; save(); renderSettings(); toast('Änderung ab ' + fmtDate(ab) + ' entfernt.');
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
    if (t.dataset.act === 'v-del') { arm(t, 'Sicher?', function () { verlaufDel(t); }); return; }
    if (t.dataset.date) { openEditor(t.dataset.date, 'monat'); return; }
    switch (t.id) {
      case 'm-prev': ui.abAlle = false; ui.m--; if (ui.m < 1) { ui.m = 12; ui.y--; } renderMonat(); return;
      case 'm-next': ui.abAlle = false; ui.m++; if (ui.m > 12) { ui.m = 1; ui.y++; } renderMonat(); return;
      case 'm-today': ui.y = now.getFullYear(); ui.m = now.getMonth() + 1; renderMonat(); return;
      case 'ab-more': ui.abAlle = true; renderAbgleich(ui.summe); return;
      case 'e-prev': openEditor(E.addDays(ui.edDate, -1), ui.edFrom); return;
      case 'e-next': openEditor(E.addDays(ui.edDate, 1), ui.edFrom); return;
      case 'pr-add': praemienListe().push({ id: 'p' + Date.now().toString(36) + Math.floor(Math.random() * 1000).toString(36), name: '', betrag: 0, einheit: 'stueck', regel: '' }); save(); renderPraemienSettings(); var pn = $('#pr-n' + (praemienListe().length - 1)); if (pn) pn.focus(); return;
      case 'e-addfz': ui.edDraft.fahrzeuge.push({ kfz: '', kmVon: '', kmBis: '' }); renderFahrzeuge(); var fi = $('#fz-kfz' + (ui.edDraft.fahrzeuge.length - 1)); if (fi) fi.focus(); return;
      case 'e-addkunde': ui.edDraft.kunden.push({ name: '', taet: [{ tat: '', von: '', bis: '' }] }); renderKunden(); var ki = $('#k-n' + (ui.edDraft.kunden.length - 1)); if (ki) ki.focus(); return;
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
      case 's-paketload': arm(t, 'Wirklich alle Werte ersetzen?', function () {
        var en = curEntry(); if (!en) return;
        var pk = $('#s-paket').value, nw = E.neuerWertesatz(pk, en.gueltigAb);
        Object.keys(en).forEach(function (k) { delete en[k]; }); Object.assign(en, nw); save(); renderSettings(); toast('Werte aus dem Paket geladen.');
      }); return;
      case 's-addstufe': { var e2 = curEntry(); if (!e2) return; e2.diaeten.stufen.push({ ab: 0, satz: 0 }); save(); renderStufen(e2); return; }
      case 's-delete': arm(t, 'Wirklich löschen?', function () {
        data.settings = data.settings.filter(function (e) { return e.gueltigAb !== ui.setKey; }); ui.setKey = null; save(); renderSettings(); toast('Wertesatz gelöscht.');
      }); return;
      case 'b-save': {
        var txt = JSON.stringify(data), dd = new Date(), fn = 'stunden-checker-sicherung-' + E.iso(dd.getFullYear(), dd.getMonth() + 1, dd.getDate()) + '.json';
        function dl() {
          try {
            var bl = new Blob([txt], { type: 'application/json' }), ur = URL.createObjectURL(bl), an = document.createElement('a');
            an.href = ur; an.download = fn; document.body.appendChild(an); an.click(); document.body.removeChild(an);
            setTimeout(function () { URL.revokeObjectURL(ur); }, 4000); toast('Gespeichert: ' + fn + ' (Ordner „Downloads“).');
          } catch (e) { toast('Speichern ging nicht. Öffne „Für Fortgeschrittene“ und tippe auf Kopieren.'); }
        }
        try {
          var fl = new File([txt], fn, { type: 'application/json' });
          if (navigator.canShare && navigator.canShare({ files: [fl] })) { navigator.share({ files: [fl], title: 'Stunden-Checker Sicherung' }).then(function () { toast('Sicherung geteilt.'); }).catch(function (er) { if (er && er.name !== 'AbortError') dl(); }); return; }
        } catch (e) { }
        dl(); return;
      }
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
    if (t.dataset.rmpr !== undefined) { arm(t, 'Sicher?', function () { praemienListe().splice(+t.dataset.rmpr, 1); save(); renderPraemienSettings(); }); return; }
    if (t.dataset.rmfz !== undefined) { ui.edDraft.fahrzeuge.splice(+t.dataset.rmfz, 1); renderFahrzeuge(); return; }
    if (t.dataset.addt !== undefined) { var kk = ui.edDraft.kunden[+t.dataset.addt]; kk.taet.push({ tat: '', von: '', bis: '' }); renderKunden(); var ti = $('#k-t' + t.dataset.addt + '-' + (kk.taet.length - 1)); if (ti) ti.focus(); return; }
    if (t.dataset.rmt !== undefined) { var pr = t.dataset.rmt.split('-'); ui.edDraft.kunden[+pr[0]].taet.splice(+pr[1], 1); renderKunden(); updatePreview(); return; }
    if (t.dataset.rmk !== undefined) { ui.edDraft.kunden.splice(+t.dataset.rmk, 1); renderKunden(); updatePreview(); return; }
    if (t.dataset.rm !== undefined) { ui.edDraft.pausen.splice(+t.dataset.rm, 1); renderPausen(); updatePreview(); return; }
    if (t.dataset.srm !== undefined) { var e3 = curEntry(); e3.diaeten.stufen.splice(+t.dataset.srm, 1); save(); renderStufen(e3); return; }
  });

  function onInput(ev) {
    var t = ev.target, id = t.id;
    if (id && id.charAt(0) === 'k' && id.charAt(1) === '-' || id.indexOf('ku-') === 0 || id.indexOf('kz-') === 0) { if (id === 'k-eintritt' && ev.type !== 'change') return; if (konInput(t)) return; }
    if (t.dataset && t.dataset.pr !== undefined && t.closest('#pr-list')) {
      var po = praemienListe()[+t.dataset.pr]; if (!po) return;
      if (t.dataset.pf === 'einheit') { po.einheit = t.value; save(); renderPraemienSettings(); return; }
      if (t.dataset.pf === 'betrag') { var bv = parseFloat(String(t.value).replace(',', '.')); po.betrag = isNaN(bv) ? 0 : bv; } else po[t.dataset.pf] = t.value;
      save(); return;
    }
    if (t.dataset && t.dataset.pd !== undefined && t.closest('#e-praemien')) {
      if (!ui.edDraft.praemien) ui.edDraft.praemien = {};
      var pv = t.type === 'checkbox' ? (t.checked ? 1 : 0) : parseFloat(String(t.value).replace(',', '.'));
      if (pv > 0) ui.edDraft.praemien[t.dataset.pd] = pv; else delete ui.edDraft.praemien[t.dataset.pd];
      updatePreview(); return;
    }
    if (t.dataset && t.dataset.fi !== undefined && t.closest('#e-fahrzeuge')) {
      var fo = ui.edDraft.fahrzeuge[+t.dataset.fi]; if (!fo) return;
      fo[t.dataset.ff] = t.value;
      if (t.dataset.ff === 'kfz' && ev.type === 'change') {
        fo.kfz = String(t.value).trim().toUpperCase(); t.value = fo.kfz;
        if ((fo.kmVon === undefined || fo.kmVon === '' || fo.kmVon === null) && fo.kfz && data.profil && data.profil.kmVortag !== false) {
          var km = lastKm(fo.kfz, ui.edDate), ki = $('#fz-kmVon' + t.dataset.fi);
          if (km !== null && ki && ki !== document.activeElement) { fo.kmVon = km; ki.value = km; }
        }
      }
      return;
    }
    if (t.dataset && t.dataset.k !== undefined && t.closest('#e-kunden')) { var ko = ui.edDraft.kunden[+t.dataset.k]; if (t.dataset.j !== undefined) ko.taet[+t.dataset.j][t.dataset.f] = t.value; else ko[t.dataset.f] = t.value; updatePreview(); return; }
    if (t.dataset && t.dataset.i !== undefined && t.closest('#e-pausen')) { ui.edDraft.pausen[+t.dataset.i][t.dataset.f] = t.value; updatePreview(); return; }
    if (t.dataset && t.dataset.si !== undefined) { var en = curEntry(); var v = parseFloat(String(t.value).replace(',', '.')); en.diaeten.stufen[+t.dataset.si][t.dataset.sf] = isNaN(v) ? 0 : v; delete en.test; save(); return; }
    if (id && id.indexOf('s-wd-') === 0) { var ew = curEntry(); if (ew) { var set = E.sollTage(ew.ueberstunden), wdn = +id.slice(5), ix = set.indexOf(wdn); if (t.checked && ix < 0) set.push(wdn); if (!t.checked && ix >= 0) set.splice(ix, 1); ew.ueberstunden.sollTage = set.sort(function (x, y) { return x - y; }); delete ew.test; save(); settingsVisibility(ew); } return; }
    if (t.dataset && t.dataset.path) { if (ev.type === 'change' && t.dataset.path === 'gueltigAb') onDateChange(t); else onSettingInput(t); return; }
    if (ev.type === 'change' && id === 's-paket') { var e = curEntry(); if (e) { e.paket = t.value; delete e.test; save(); paketInfo(e); renderSettings(); } return; }
    switch (id) {
      case 'e-date': if (validISO(t.value)) openEditor(t.value, ui.edFrom); return;
      case 'e-status': ui.edDraft.status = t.value; $('#e-work').hidden = t.value !== 'arbeit'; renderPraemienTag(); updatePreview(); return;
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
      var any = Object.keys(o).some(function (k) { return k !== 'test' && o[k] != null; });
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


  /* ---- Eigenes App-Symbol ---- */
  var APPICONS = [
    ['uhr', 'Uhr', '<circle cx="48" cy="48" r="29" fill="none" stroke="#64b5f6" stroke-width="7"/><path d="M48 30v19l12 8" fill="none" stroke="#f3f4f6" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>'],
    ['lkw', 'Lkw', '<rect x="12" y="30" width="44" height="30" rx="3" fill="#64b5f6"/><path d="M58 40h14l12 12v8H58z" fill="#f3f4f6"/><circle cx="28" cy="64" r="7" fill="#f3f4f6" stroke="#1f2937" stroke-width="3"/><circle cx="70" cy="64" r="7" fill="#f3f4f6" stroke="#1f2937" stroke-width="3"/>'],
    ['lkwkran', 'Lkw mit Kran', '<rect x="10" y="48" width="42" height="14" rx="3" fill="#64b5f6"/><path d="M54 48h12l10 10v4H54z" fill="#f3f4f6"/><circle cx="24" cy="66" r="6" fill="#f3f4f6" stroke="#1f2937" stroke-width="3"/><circle cx="66" cy="66" r="6" fill="#f3f4f6" stroke="#1f2937" stroke-width="3"/><path d="M22 48L60 16" stroke="#f3f4f6" stroke-width="5" stroke-linecap="round"/><path d="M60 16v18" stroke="#64b5f6" stroke-width="3"/><rect x="56" y="34" width="8" height="6" rx="1.5" fill="#64b5f6"/>'],
    ['bagger', 'Bagger', '<rect x="14" y="62" width="48" height="12" rx="6" fill="#f3f4f6"/><rect x="22" y="44" width="28" height="18" rx="3" fill="#64b5f6"/><path d="M48 50L66 28l14 12" fill="none" stroke="#f3f4f6" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><path d="M76 40l8 10-12 2z" fill="#64b5f6"/>'],
    ['kran', 'Kran', '<rect x="14" y="62" width="40" height="11" rx="3" fill="#f3f4f6"/><rect x="20" y="48" width="16" height="14" rx="2" fill="#64b5f6"/><path d="M34 52L78 20" stroke="#f3f4f6" stroke-width="6" stroke-linecap="round"/><path d="M78 20v26" stroke="#64b5f6" stroke-width="4"/><rect x="73" y="46" width="10" height="8" rx="2" fill="#64b5f6"/>'],
    ['euro', 'Euro', '<circle cx="48" cy="48" r="30" fill="#64b5f6"/><text x="48" y="61" font-size="40" font-weight="700" text-anchor="middle" fill="#1f2937" font-family="Arial,sans-serif">€</text>'],
    ['stern', 'Stern', '<path d="M48 16l10 22 24 3-18 16 5 24-21-12-21 12 5-24-18-16 24-3z" fill="#fbbf24"/>']
  ];
  function iconSvg(key) {
    var ic = APPICONS.filter(function (x) { return x[0] === key; })[0] || APPICONS[0];
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="512" height="512"><rect width="96" height="96" rx="20" fill="#1f2937"/>' + ic[2] + '</svg>';
  }
  function iconPng(key, size, cb) {
    var img = new Image();
    img.onload = function () { var c = document.createElement('canvas'); c.width = c.height = size; c.getContext('2d').drawImage(img, 0, 0, size, size); cb(c.toDataURL('image/png')); };
    img.onerror = function () { cb(null); };
    if (key === 'foto') {
      var st = null; try { st = localStorage.getItem('stundenchecker.iconimg'); } catch (e) { }
      if (!st) { cb(null); return; }
      img.onload = function () { var c = document.createElement('canvas'); c.width = c.height = size; c.getContext('2d').drawImage(img, 0, 0, size, size); cb(c.toDataURL('image/png')); };
      img.src = st; return;
    }
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(iconSvg(key));
  }
  function applyAppIcon(key) {
    iconPng(key, 512, function (p512) {
      if (!p512) return;
      iconPng(key, 192, function (p192) {
        var set = function (sel, href) { var el = document.querySelector(sel); if (el) el.setAttribute('href', href); };
        set('link[rel="apple-touch-icon"]', p192 || p512);
        set('link[rel="icon"]', p192 || p512);
        var base = new URL('./', location.href).href;
        var man = { id: base + 'index.html', name: 'Stunden-Checker', short_name: 'Stunden', start_url: base + 'index.html', scope: base, display: 'standalone', background_color: '#1f2937', theme_color: '#1f2937', lang: 'de',
          icons: [{ src: p192 || p512, sizes: '192x192', type: 'image/png', purpose: 'any' }, { src: p512, sizes: '512x512', type: 'image/png', purpose: 'any' }, { src: p512, sizes: '512x512', type: 'image/png', purpose: 'maskable' }] };
        try { set('link[rel="manifest"]', URL.createObjectURL(new Blob([JSON.stringify(man)], { type: 'application/manifest+json' }))); } catch (e) { }
      });
    });
  }
  function renderIconPick() {
    var cur = 'uhr'; try { cur = localStorage.getItem('stundenchecker.icon') || 'uhr'; } catch (e) { }
    var fotoOn = ''; try { fotoOn = localStorage.getItem('stundenchecker.iconimg') || ''; } catch (e) { }
    var html = APPICONS.map(function (x) {
      return '<button type="button" class="ipk' + (x[0] === cur ? ' on' : '') + '" data-icon="' + x[0] + '" aria-label="' + x[1] + '" title="' + x[1] + '"><svg viewBox="0 0 96 96"><rect width="96" height="96" rx="20" fill="#1f2937"/>' + x[2] + '</svg></button>';
    }).join('') + (fotoOn ? '<button type="button" class="ipk' + (cur === 'foto' ? ' on' : '') + '" data-icon="foto" aria-label="Eigenes Foto" title="Eigenes Foto"><img src="' + fotoOn + '" alt=""></button>' : '');
    ['#icon-pick', '#icon-pick2'].forEach(function (s) { var el = $(s); if (el) el.innerHTML = html; });
  }
  (function () {
    var cur = null; try { cur = localStorage.getItem('stundenchecker.icon'); } catch (e) { }
    renderIconPick();
    if (cur && cur !== 'uhr') applyAppIcon(cur);
    function pickClick(ev) {
      var b = ev.target.closest('[data-icon]'); if (!b) return;
      try { localStorage.setItem('stundenchecker.icon', b.dataset.icon); } catch (e) { }
      renderIconPick(); applyAppIcon(b.dataset.icon);
    }
    $('#icon-pick').addEventListener('click', pickClick);
    $('#icon-pick2').addEventListener('click', pickClick);
    var cr = { img: null, s: 1, min: 1, x: 0, y: 0 }, cv = $('#crop-c'), cx = cv.getContext('2d');
    function crClamp() {
      var w = cr.img.width * cr.s, hh = cr.img.height * cr.s;
      cr.x = Math.min(0, Math.max(280 - w, cr.x)); cr.y = Math.min(0, Math.max(280 - hh, cr.y));
    }
    function crDraw() { cx.fillStyle = '#1f2937'; cx.fillRect(0, 0, 280, 280); cx.drawImage(cr.img, cr.x, cr.y, cr.img.width * cr.s, cr.img.height * cr.s); }
    $('#icon-file').addEventListener('change', function () {
      var f = this.files && this.files[0]; if (!f) return;
      var rd = new FileReader();
      rd.onload = function () {
        var im = new Image();
        im.onload = function () {
          cr.img = im; cr.min = Math.max(280 / im.width, 280 / im.height); cr.s = cr.min;
          cr.x = (280 - im.width * cr.s) / 2; cr.y = (280 - im.height * cr.s) / 2;
          $('#crop-z').value = 100; $('#crop').hidden = false; crDraw();
        };
        im.src = rd.result;
      };
      rd.readAsDataURL(f);
      this.value = '';
    });
    $('#crop-z').addEventListener('input', function () {
      var old = cr.s, ns = cr.min * (+this.value / 100), px = 140, py = 140;
      cr.x = px - (px - cr.x) * ns / old; cr.y = py - (py - cr.y) * ns / old; cr.s = ns; crClamp(); crDraw();
    });
    var drag = null;
    cv.style.touchAction = 'none';
    cv.addEventListener('pointerdown', function (ev) { drag = { x: ev.clientX, y: ev.clientY, ox: cr.x, oy: cr.y }; try { cv.setPointerCapture(ev.pointerId); } catch (e) { } });
    cv.addEventListener('pointermove', function (ev) { if (!drag || !cr.img) return; cr.x = drag.ox + (ev.clientX - drag.x) * 280 / cv.clientWidth; cr.y = drag.oy + (ev.clientY - drag.y) * 280 / cv.clientHeight; crClamp(); crDraw(); });
    cv.addEventListener('pointerup', function () { drag = null; });
    cv.addEventListener('pointercancel', function () { drag = null; });
    $('#crop-x').addEventListener('click', function () { $('#crop').hidden = true; cr.img = null; });
    $('#crop-ok').addEventListener('click', function () {
      if (!cr.img) return;
      var c = document.createElement('canvas'); c.width = c.height = 256; var k = 256 / 280, g = c.getContext('2d');
      g.fillStyle = '#1f2937'; g.fillRect(0, 0, 256, 256); g.drawImage(cr.img, cr.x * k, cr.y * k, cr.img.width * cr.s * k, cr.img.height * cr.s * k);
      try { localStorage.setItem('stundenchecker.iconimg', c.toDataURL('image/jpeg', 0.88)); localStorage.setItem('stundenchecker.icon', 'foto'); } catch (e) { toast('Das Bild konnte nicht gespeichert werden.'); return; }
      $('#crop').hidden = true; cr.img = null; renderIconPick(); applyAppIcon('foto'); toast('Dein Foto ist jetzt das App-Symbol.');
    });
  })();


  /* ---- Update-Meldung ---- */
  (function () {
    var cur = window.APP_VERSION; if (!cur || location.protocol.indexOf('http') !== 0) return;
    var bar = $('#updatebar'), last = 0;
    function check() {
      if (Date.now() - last < 60000) return; last = Date.now();
      fetch('version.json?t=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (j) { if (j && j.v && j.v !== cur) bar.hidden = false; }).catch(function () { });
    }
    document.addEventListener('visibilitychange', function () { if (!document.hidden) check(); });
    setTimeout(check, 4000);
    $('#update-go').addEventListener('click', function () { try { if (isDirty()) { toast('Bitte zuerst den Tag speichern.'); return; } } catch (e) { } location.reload(); });
  })();

  /* ---- Als App installieren ---- */
  (function () {
    var deferred = null, bar = $('#installbar');
    function gone() { try { return localStorage.getItem('stundenchecker.noinstall') === '1'; } catch (e) { return false; } }
    function standalone() { return (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone; }
    if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) { navigator.serviceWorker.register('sw.js').catch(function () {}); }
    window.addEventListener('beforeinstallprompt', function (ev) { ev.preventDefault(); deferred = ev; if (!gone() && !standalone()) bar.hidden = false; });
    window.addEventListener('appinstalled', function () { bar.hidden = true; });
    var ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !standalone();
    if (ios && !gone()) { bar.hidden = false; bar.querySelector('span').textContent = 'Zum Installieren unten auf „Teilen“ tippen, dann „Zum Home-Bildschirm“.'; $('#install-go').hidden = true; }
    $('#install-go').addEventListener('click', function () { if (!deferred) return; deferred.prompt(); deferred.userChoice.then(function () { deferred = null; bar.hidden = true; }); });
    $('#install-x').addEventListener('click', function () { bar.hidden = true; try { localStorage.setItem('stundenchecker.noinstall', '1'); } catch (e) { } });
  })();
  /* ---- Oberfläche in vielen Sprachen: ersetzt deutsche Texte anhand der Dateien lang-xx.js; was fehlt, bleibt deutsch ---- */
  var UI_ORIG = new WeakMap(), UI_SET = new WeakMap(), UI_RX = {}, uiBusy = false;
  function uiLang() {
    try { var l = localStorage.getItem('stundenchecker.lang'); if (l && MIA_LANGS[l]) return l; } catch (e) {}
    var n = ((navigator.language || 'de').slice(0, 2)).toLowerCase(); n = UI_ALIAS[n] || n; return MIA_LANGS[n] ? n : 'de';
  }
  function uiDict(L) { return (window.UI_LANGS && window.UI_LANGS[L]) || null; }
  function uiRx(L) {
    if (UI_RX[L]) return UI_RX[L]; var d = uiDict(L); if (!d) return null;
    var ks = Object.keys(d).filter(function (k) { return k.length >= 4 && d[k]; }).sort(function (x, y) { return y.length - x.length; });
    var src = ks.map(function (k) { return k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('|');
    try { UI_RX[L] = new RegExp('(?<![\\p{L}\\p{N}])(?:' + src + ')(?![\\p{L}])', 'gu'); } catch (e) { UI_RX[L] = null; }
    return UI_RX[L];
  }
  function uiTr(de, L) {
    var d = uiDict(L); if (!d) return null; var key = de.trim(); if (!key) return null;
    var t = d[key]; if (t) return de.replace(key, t);
    var mm = /^Schritt (\d+) von (\d+)$/.exec(key); if (mm && d['Schritt {1} von {2}']) return de.replace(key, d['Schritt {1} von {2}'].replace('{1}', mm[1]).replace('{2}', mm[2]));
    var rx = uiRx(L); if (!rx) return null; var ch = false;
    var out = de.replace(rx, function (k) { var v = d[k]; if (v) { ch = true; return v; } return k; });
    return ch ? out : null;
  }
  function uiTextNode(n, L) {
    var cur = n.nodeValue, de = UI_ORIG.get(n);
    if (de !== undefined && UI_SET.get(n) !== cur) de = undefined;
    if (de === undefined) de = cur;
    var t = L !== 'de' ? uiTr(de, L) : null;
    if (t) { UI_ORIG.set(n, de); UI_SET.set(n, t); if (cur !== t) n.nodeValue = t; }
    else if (UI_ORIG.has(n) && UI_SET.get(n) === cur) { n.nodeValue = de; UI_ORIG.delete(n); UI_SET.delete(n); }
  }
  var UI_ATTR = ['placeholder', 'aria-label', 'title'];
  function uiAttrs(root, L) {
    var els = root.nodeType === 1 ? [root].concat([].slice.call(root.querySelectorAll('[placeholder],[aria-label],[title]'))) : [];
    els.forEach(function (el) {
      UI_ATTR.forEach(function (at) {
        if (!el.hasAttribute(at)) return; var k = 'uio' + at.replace('-', ''), set = 'uis' + at.replace('-', ''), cur = el.getAttribute(at), de = el.dataset[k];
        if (de !== undefined && el.dataset[set] !== cur) de = undefined; if (de === undefined) de = cur;
        var t = L !== 'de' ? uiTr(de, L) : null;
        if (t) { el.dataset[k] = de; el.dataset[set] = t; if (cur !== t) el.setAttribute(at, t); }
        else if (el.dataset[k] !== undefined && el.dataset[set] === cur) { el.setAttribute(at, de); delete el.dataset[k]; delete el.dataset[set]; }
      });
    });
  }
  function uiWalk(root, L) {
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null), n, list = [];
    while ((n = w.nextNode())) { var p = n.parentNode; if (p && (/^(SCRIPT|STYLE|H1)$/.test(p.nodeName) || (p.closest && p.closest('h1, .brand, .nott')))) continue; list.push(n); }
    list.forEach(function (x) { uiTextNode(x, L); });
    if (root.nodeType === 1) uiAttrs(root, L);
  }
  function uiApply(root) { if (uiBusy) return; uiBusy = true; try { uiWalk(root || document.body, uiLang()); } finally { uiBusy = false; } }
  function uiLoad(L, cb) {
    if (L === 'de' || uiDict(L)) { cb(); return; }
    var s = document.createElement('script'); s.src = 'lang-' + L + '.js' + (window.APP_VERSION ? '?v=' + window.APP_VERSION : '');
    s.onload = function () { cb(); }; s.onerror = function () { cb(); }; document.head.appendChild(s);
  }
  function uiSetLang(l) {
    try { localStorage.setItem('stundenchecker.lang', l); } catch (e) {}
    var sl = $('#ui-lang'); if (sl) sl.value = l; var ml = $('#mia-lang'); if (ml) ml.value = l;
    document.documentElement.lang = l; document.documentElement.dir = UI_RTL[l] ? 'rtl' : 'ltr';
    uiLoad(l, function () { uiApply(document.body); if (ui.miaPaint) ui.miaPaint(); });
  }
  (function () {
    var sl = $('#ui-lang'); if (sl) { sl.innerHTML = Object.keys(MIA_LANGS).map(function (k) { return '<option value="' + k + '">' + MIA_LANGS[k].n + '</option>'; }).join(''); sl.value = uiLang(); sl.addEventListener('change', function () { uiSetLang(this.value); }); }
    document.documentElement.lang = uiLang(); document.documentElement.dir = UI_RTL[uiLang()] ? 'rtl' : 'ltr';
    if (window.MutationObserver) {
      var mo = new MutationObserver(function (ms) {
        if (uiBusy || uiLang() === 'de' && !uiDict('de')) { if (uiLang() === 'de') return; }
        if (uiBusy) return; uiBusy = true; mo.disconnect();
        try { ms.forEach(function (m) { if (m.type === 'characterData') uiTextNode(m.target, uiLang()); else if (m.type === 'attributes') uiAttrs(m.target, uiLang()); else m.addedNodes.forEach(function (nd) { if (nd.nodeType === 3) uiTextNode(nd, uiLang()); else if (nd.nodeType === 1) uiWalk(nd, uiLang()); }); }); }
        finally { mo.observe(document.body, { childList: true, subtree: true, characterData: true }); uiBusy = false; }
      });
      mo.observe(document.body, { childList: true, subtree: true, characterData: true });
    }
    uiLoad(uiLang(), function () { if (uiLang() !== 'de') { uiApply(document.body); if (ui.miaPaint) ui.miaPaint(); } });
  })();
})();
