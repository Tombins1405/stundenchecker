/* Stunden-Checker – Oberfläche (Meilenstein A)
 * Alle Rechenregeln liegen in engine.js. Diese Datei zeigt an, nimmt Eingaben entgegen und speichert.
 * Gespeichert wird in dieser Datei nur über load() und save(): später wird genau diese Stelle durch Firestore ersetzt. */
(function () {
  'use strict';
  var E = window.Engine;
  /* Ausprobier-Modus: eigener Speicher, getrennt von den echten Daten (für alle Tester) */
  var PROBE_DEV = false, PROBE = false;
  try {
    if (/[?&]ausprobieren(=|&|$)/.test(location.search)) { localStorage.setItem('stundenchecker.probe.dev', '1'); history.replaceState(null, '', location.pathname + location.hash); }
    PROBE_DEV = true; /* Ausprobier-Modus für alle Tester freigeschaltet */
    PROBE = PROBE_DEV && localStorage.getItem('stundenchecker.probe.active') === '1';
  } catch (e) { }
  var KEY = PROBE ? 'stundenchecker.probe.v1' : 'stundenchecker.v1';

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
  var PAKET_KURZ = { gueter: 'Güterbeförderung', klein: 'Kleintransport', bau: 'Bau', handel: 'Handel', buero: 'Büro (Angestellte)', gastro: 'Gastgewerbe', metall: 'Metallgewerbe', dachdecker: 'Dachdecker', pflasterer: 'Pflasterer', fliesenleger: 'Fliesenleger / Hafner', gewerbe_ang: 'Büro Gewerbe (Angestellte)', reinigung: 'Gebäudereinigung', bewachung: 'Bewachung', sozial: 'Sozialwirtschaft (SWÖ)', de_handel: 'Einzelhandel (Deutschland)', de_gastro: 'Gastgewerbe (Deutschland)', eigen: 'Eigene Werte' };
  function todayISO() { var d = new Date(); return E.iso(d.getFullYear(), d.getMonth() + 1, d.getDate()); }
  function fmtDate(s) { var p = E.parseISO(s); return p.d + '.' + p.m + '.' + p.y; }
  function fmtShort(s) { var p = E.parseISO(s); return WD[E.weekday(s)] + ' ' + p.d + '.' + p.m + '.'; }
  function fmtLong(s) { var p = E.parseISO(s); return WDL[E.weekday(s)] + ', ' + p.d + '. ' + MON[p.m - 1] + ' ' + p.y; }
  function validISO(s) { return /^\d{4}-\d{2}-\d{2}$/.test(s || ''); }

  var toastTimer = null;
  function toast(msg, ms) {
    var t = $('#toast'); t.textContent = msg; t.hidden = false;
    if (!t._tap) { t._tap = true; t.addEventListener('click', function () { clearTimeout(toastTimer); t.hidden = true; }); }
    var dauer = Math.max(ms || 0, 4500, 1500 + String(msg).length * 70);
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.hidden = true; }, dauer);
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
  function probeUmschalten(an) {
    try {
      if (an) { localStorage.removeItem('stundenchecker.probe.v1'); localStorage.setItem('stundenchecker.probe.active', '1'); }
      else { localStorage.removeItem('stundenchecker.probe.active'); localStorage.removeItem('stundenchecker.probe.v1'); }
    } catch (e) { return; }
    location.reload();
  }
  (function probeInit() {
    var box = $('#s-probe'); if (box) box.hidden = !PROBE_DEV;
    var go = $('#s-probe-go'); if (go) { go.hidden = PROBE; go.addEventListener('click', function () { probeUmschalten(true); }); }
    var back = $('#s-probe-back'); if (back) { back.hidden = !PROBE; back.addEventListener('click', function () { probeUmschalten(false); }); }
    var bn = $('#probe-banner'); if (bn) bn.hidden = !PROBE;
    var bb = $('#probe-banner-back'); if (bb) bb.addEventListener('click', function () { probeUmschalten(false); });
  })();
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
    if (!e.freiVerr) e.freiVerr = 'offen';
    if (!e.zaUmr) e.zaUmr = 'offen';
    if (e.runAn === undefined) e.runAn = +e.runMin > 0;
    if (!(+e.runMin > 0)) e.runMin = 15;
    if (!e.runBeg) e.runBeg = 'nahe';
    if (!e.runEnd) e.runEnd = 'nahe';
  });
  applyRegion();
  try { localStorage.setItem(KEY + '.probe', '1'); localStorage.removeItem(KEY + '.probe'); } catch (e) { speicherOk = false; }

  /* ------------------------------------------------------------ Zustand */
  var now = new Date();
  var ui = { view: 'monat', y: now.getFullYear(), m: now.getMonth() + 1, edDate: null, edDraft: null, edFrom: 'erfassen', setKey: null };

  function sortedSettings() { return data.settings.slice().sort(function (a, b) { return a.gueltigAb < b.gueltigAb ? -1 : 1; }); }
  function wAt(d) { return E.wertAt(data.settings, d); }
  /* grobe Geräteangabe für den Admin (nur mit Zustimmung bei „Mithelfen“): Betriebssystem, Modellcode, Browser, Bildschirm */
  function geraetInfo() {
    try {
      var ua = navigator.userAgent || '', os = '', mo = '', br = '', m;
      if ((m = ua.match(/Android ([\d.]+)/))) { os = 'Android ' + m[1].split('.')[0]; var mm = ua.match(/Android [\d.]+; ([^;)]+?)(?: Build|\))/); if (mm && mm[1] !== 'K' && mm[1].length < 30) mo = mm[1]; }
      else if ((m = ua.match(/(?:iPhone|CPU) OS ([\d_]+)/))) os = (/iPad/.test(ua) ? 'iPadOS ' : 'iOS ') + m[1].split('_')[0];
      else if (/Windows/.test(ua)) os = 'Windows'; else if (/Mac OS X/.test(ua)) os = 'macOS'; else if (/Linux/.test(ua)) os = 'Linux';
      if ((m = ua.match(/SamsungBrowser\/(\d+)/))) br = 'Samsung Internet ' + m[1];
      else if ((m = ua.match(/EdgA?\/(\d+)/))) br = 'Edge ' + m[1];
      else if ((m = ua.match(/(?:CriOS|Chrome)\/(\d+)/))) br = 'Chrome ' + m[1];
      else if ((m = ua.match(/(?:FxiOS|Firefox)\/(\d+)/))) br = 'Firefox ' + m[1];
      else if ((m = ua.match(/Version\/(\d+).*Safari/))) br = 'Safari ' + m[1];
      var sa = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
      return [os, mo, br, window.innerWidth + 'x' + window.innerHeight + ' @' + (window.devicePixelRatio || 1), sa ? 'als App installiert' : 'im Browser'].filter(Boolean).join(' · ').slice(0, 140);
    } catch (e) { return null; }
  }
  window.StundenApp = {
    profil: function () { return data.profil || {}; },
    info: function () {
      var w = wAt(todayISO()), pk = E.PAKETE[w.paket];
      return { beruf: w.beruf || null, paket: w.paket || null, land: pk && pk.land === 'DE' ? 'DE' : 'AT', lang: (window.localStorage && localStorage.getItem('stundenchecker.lang')) || (navigator.language || '').slice(0, 2), tage: Object.keys(data.days).length, view: ui.view, geraet: data.profil && data.profil.consent && data.profil.consent.statistik ? geraetInfo() : null };
    }
  };
  function ins(name) { try { if (window.StundenInsights) window.StundenInsights.count(name); } catch (e) {} }

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
    ui.view = view; ins('ansicht_' + view);
    ['monat', 'lohn', 'erfassen', 'konten', 'einstellungen'].forEach(function (v) { $('#v-' + v).hidden = v !== view; });
    $$('.tab').forEach(function (b) { if (b.dataset.view === view) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    if (view === 'monat') { renderMonat(); if (ui.mseg === 'konten') renderKonten(); }
    if (view === 'lohn') renderLohn();
    if (view === 'erfassen') renderEditor();
    if (view === 'konten') renderKonten();
    if (view === 'einstellungen') { renderPraemienSettings(); renderDiensteSettings(); renderSettings(); fillBackup(); renderCheck(); }
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
  /* Tagessymbole (Kalenderliste): Form und Farbe zeigen die Art des Tages, ohne den Text zu ersetzen */
  var DAY_ICO = {
    arbeit: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    urlaub: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5"/>',
    krank: '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
    arzt: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M12 8v8M8 12h8"/>',
    schule: '<path d="M2 9l10-5 10 5-10 5zM6 11v5c3 2 9 2 12 0v-5"/>',
    frist: '<path d="M6 3v18M6 4h12l-2.500 4L18 12H6"/>',
    pflege: '<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.500-7 10-7 10z"/>',
    feiertag: '<path d="M12 3l2.700 5.600 6.100.9-4.400 4.300 1 6.100L12 17l-5.400 2.900 1-6.100L3.200 9.500l6.100-.9z"/>',
    betriebsurlaub: '<path d="M4 11l8-7 8 7M6 10v9h12v-9"/>',
    za: '<path d="M4 8h14l-3-3M20 16H6l3 3"/>',
    ersatzruhe: '<path d="M3 18V7M3 14h18v4M21 14v-2a3 3 0 0 0-3-3h-7v5"/>',
    freistellung: '<path d="M5 3h9v18H5zM14 5l5 2v12l-5 2M10 12h.01"/>',
    frei: '<path d="M20 14.500A8 8 0 1 1 9.500 4 6.500 6.500 0 0 0 20 14.500z"/>',
    mutterschutz: '<path d="M12 20s-7-4.400-7-10a4 4 0 0 1 7-2.600A4 4 0 0 1 19 10c0 5.600-7 10-7 10z"/>',
    karenz: '<circle cx="8" cy="19" r="1.500"/><circle cx="17" cy="19" r="1.500"/><path d="M4 5h3l2 9h9a5 5 0 0 0-5-6H8"/>',
    papamonat: '<circle cx="12" cy="12" r="8"/><path d="M9 10h.01M15 10h.01M9 15c1.500 1.200 4.500 1.200 6 0"/>',
    sw: '<path d="M7 15a4 4 0 0 1 .5-8 5.500 5.500 0 0 1 10.500 1.500A3.500 3.500 0 0 1 17.500 15zM9 18l-1 2M13 18l-1 2M17 18l-1 2"/>',
    dienst: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0"/>'
  };
  function dayIco(k) { return DAY_ICO[k] ? '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + DAY_ICO[k] + '</svg>' : ''; }
  var LEGENDE = [
    ['urlaub', 'Urlaub', 'Bezahlter Urlaubstag.'],
    ['krank', 'Krankenstand', 'Du warst krank. Der Tag wird als bezahlte Abwesenheit gutgeschrieben.'],
    ['arzt', 'Frei wegen Arztbesuch', 'Frei für einen Arztbesuch. Ob er bezahlt wird, hängt von deiner Firma ab.'],
    ['pflege', 'Pflegefreistellung', 'Frei, um ein krankes Kind oder einen Angehörigen zu pflegen.'],
    ['schule', 'Schulung / Berufsschule', 'Berufsschule, Kurs oder Seminar. Der Tag zählt wie ein Arbeitstag mit Sollstunden.'],
    ['frist', 'Frist läuft ab', 'An diesem Tag läuft ein Ausweis, Kurs oder eine Prüfung ab.'],
    ['feiertag', 'Feiertag', 'Gesetzlicher Feiertag.'],
    ['betriebsurlaub', 'Betrieb geschlossen / Betriebsurlaub', 'Deine Firma hatte zu, zum Beispiel zwischen den Feiertagen.'],
    ['za', 'Zeitausgleich', 'Du hast Überstunden in freie Zeit umgewandelt.'],
    ['freistellung', 'Keine Arbeit (von der Firma freigestellt)', 'Die Firma hat dich für diesen Tag freigestellt oder heimgeschickt, weil es keine Arbeit gab. Wie sie den Tag verrechnet, stellst du ein.'],
    ['ersatzruhe', 'Ersatzruhetag', 'Ein freier Tag als Ausgleich für Arbeit am Wochenende oder zu viele Arbeitstage hintereinander. Ob und wie die Firma ihn bezahlt, trägst du beim Tag ein.'],
    ['mutterschutz', 'Mutterschutz / Wochengeld', 'Zeit vor und nach der Geburt. Die Firma zahlt in dieser Zeit keinen Lohn, das Wochengeld kommt von der Krankenkasse. Es zählen keine Stunden.'],
    ['karenz', 'Karenz', 'Elternkarenz für Mütter und Väter. Die Firma zahlt in dieser Zeit keinen Lohn. Es zählen keine Stunden.'],
    ['papamonat', 'Papamonat', 'Frühkarenz für Väter nach der Geburt. Die Firma zahlt in dieser Zeit keinen Lohn. Es zählen keine Stunden.'],
    ['frei', 'Frei', 'Ein freier Tag ohne Bezahlung und ohne Stunden.'],
    ['sw', 'Ausfall / Schlechtwetter', 'Du wurdest heimgeschickt, weil es keine Arbeit gab oder das Wetter schlecht war.'],
    ['dienst', 'Bereitschaft / Dienst', 'An diesem Tag hattest du Bereitschaft oder Notdienst.']
  ];
  function legendeName(k) { var r = LEGENDE.filter(function (x) { return x[0] === k; })[0]; return r ? r[1] : ''; }
  function legendeOpen() {
    var dlg = $('#leg-dlg');
    if (!dlg) {
      dlg = document.createElement('div'); dlg.id = 'leg-dlg'; dlg.className = 'cropov'; dlg.hidden = true;
      dlg.innerHTML = '<div class="lzbox" role="dialog" aria-modal="true" aria-labelledby="leg-h"><h3 id="leg-h">Legende: Was bedeuten die Symbole?</h3><ul class="legende" id="leg-list"></ul><div class="btns"><button type="button" class="btn primary" id="leg-x">Schließen</button></div></div>';
      document.body.appendChild(dlg);
      dlg.addEventListener('click', function (ev) { if (ev.target === dlg || ev.target.id === 'leg-x') dlg.hidden = true; });
    }
    $('#leg-list').innerHTML = LEGENDE.map(function (r) { return '<li class="st-' + r[0] + '"><span class="d-ico">' + dayIco(r[0]) + '</span><span><strong>' + esc(r[1]) + '</strong><br>' + esc(r[2]) + '</span></li>'; }).join('');
    dlg.hidden = false;
  }
  document.addEventListener('click', function (ev) {
    var ic = ev.target.closest && ev.target.closest('.d-ico[data-ik]');
    if (ic) { ev.preventDefault(); ev.stopPropagation(); toast(legendeName(ic.dataset.ik) || ''); return; }
    if (ev.target.closest && ev.target.closest('#m-legende')) { ev.preventDefault(); legendeOpen(); }
  }, true);
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
      (s.gleit ? '<div><dt>Gleitzeitsaldo</dt><dd class="hl">' + (s.ueberStd > 0 ? '+' : '') + fh(s.ueberStd) + '<small>h</small></dd></div>' + (s.gleitQuartalStd != null ? '<div><dt>Im Quartal</dt><dd>' + (s.gleitQuartalStd > 0 ? '+' : '') + fh(s.gleitQuartalStd) + '<small>h</small></dd></div>' : '') + (s.gleitKontoStd != null ? '<div><dt>Gleitzeitkonto</dt><dd class="hl">' + (s.gleitKontoStd > 0 ? '+' : '') + fh(s.gleitKontoStd) + '<small>h</small></dd></div>' : '') + (s.gleitVerfallStd > 0 ? '<div><dt>Über der Grenze</dt><dd>' + fh(s.gleitVerfallStd) + '<small>h</small></dd></div>' : '') : '<div><dt>Überstunden</dt>' + (laufend ? '<dd class="hl">–<small class="later">am Monatsende</small></dd>' : '<dd class="hl">' + fh(s.ueberStd - (s.mehrStd || 0)) + '<small>h</small></dd>') + '</div>' + (!laufend && s.mehrStd > 0 ? '<div><dt>Mehrarbeit</dt><dd class="hl">' + fh(s.mehrStd) + '<small>h</small></dd></div>' : '') + (!laufend && s.mehrFreiStd > 0 ? '<div><dt>Mehrarbeit ohne Zuschlag</dt><dd class="hl">' + fh(s.mehrFreiStd) + '<small>h</small></dd></div>' : '')) +
      (w.diaeten.modell === 'aus' ? '' : '<div><dt>Diätenstd.</dt><dd>' + fh(s.diaetenStd) + '<small>h</small></dd></div>' +
      '<div><dt>Diäten</dt><dd>' + esc(diaetenBetrag) + '</dd></div>') +
      (s.praemien && s.praemien.length ? '<div><dt>Prämien</dt><dd>' + eur.format(s.praemienEuro) + '</dd></div>' : '') +
      (s.dienste || []).map(function (x) { return '<div><dt>' + esc(x.name) + '</dt><dd>' + String(x.menge).replace('.', ',') + '<small> ' + (DS_KURZ[x.einheit] || '') + '</small></dd></div>'; }).join('') +
      '</dl>';
    if (w.schlechtwetter || s.swStd > 0) {
      var sw = cm.schlechtwetter, pct = Math.min(100, sw.verbrauchtStd / sw.kontingentStd * 100);
      if (!E.istBau(w)) html += '<div class="sw"><div class="row"><span>Ausfallstunden im Monat</span><strong class="num">' + fh(s.swStd) + ' h</strong></div></div>'; else
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
    if (s.schule) parts.push(s.schule + ' Schulung / Berufsschule');
    if (s.za) parts.push(s.za + ' Zeitausgleich');
    if (s.freiTage) parts.push(s.freiTage + ' Freistellung');
    if (s.feiertageBezahlt) parts.push(s.feiertageBezahlt + ' bezahlter Feiertag' + (s.feiertageBezahlt > 1 ? 'e' : ''));
    $('#m-counts').textContent = parts.join(' · ');
    (function () { // Freistellung: Unterschied zwischen Grundregel (bezahlt) und dem, was die Firma macht
      var l = s.freiListe || [], za = 0, ub = 0, el = $('#m-frei');
      l.forEach(function (x) { if (x.modus === 'za') za += x.std; else if (x.modus === 'unbezahlt') ub += x.std; });
      if (!el) return;
      el.hidden = !(za || ub);
      el.innerHTML = (za ? '<span>Laut AK-Grundregel wäre die Freistellung bezahlt. Deine Firma zieht vom Zeitausgleich ab:</span> <b>' + fh(za) + ' h</b>' : '') + (za && ub ? '<br>' : '') + (ub ? '<span>Laut AK-Grundregel wäre die Freistellung bezahlt. Deine Firma zahlt nicht:</span> <b>' + fh(ub) + ' h</b>' : '');
    })();
    $('#m-ab').hidden = true;

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
        else main = '<strong>' + (r.swMin ? (E.istBau(wAt(r.datum)) ? 'Schlechtwetter' : 'Ausfall') : 'Ohne Zeiten') + '</strong>';
        if (r.pausenMin) small.push('Pause ' + hm(r.pausenMin));
        if (r.diaetenStd) small.push('Diäten ' + fh(r.diaetenStd) + ' h');
        if (r.swMin) small.push((E.istBau(wAt(r.datum)) ? 'Schlechtwetter ' : 'Ausfall ') + fh(r.swMin / 60) + ' h');
        if (r.extraMin) small.push('+ ' + fh(r.extraMin / 60) + ' h zusätzlich bezahlt');
        if (d.swOn && d.swGrund) small.push(esc(d.swGrund));
        if (d.notiz) small.push(esc(d.notiz));
        if (d.an && (d.an.t || d.an.w)) chips += '<span class="chip">Notiz</span>';
        if (r.nettoMin > 0) {
          val = fh(r.nettoMin / 60) + ' h';
          if (r.faktor !== 1) val += '<small>zählt ' + fh(r.wertMin / 60) + ' h</small>';
          if (r.saldoMin !== null) val += '<small><span class="' + (r.saldoMin >= 0 ? 'pos' : 'neg') + '">ÜST ' + (r.saldoMin > 0 ? '+' : '') + fh(r.saldoMin / 60) + '</span></small>';
        }
      } else {
        main = '<strong>' + esc(E.STATUS[r.status].name) + (r.auto ? ' (bezahlt)' : '') + '</strong>';
        if (r.creditMin) val = fh(r.creditMin / 60) + ' h';
      }
      var ik = r.leer ? '' : (r.status === 'arbeit' && r.swMin && !r.nettoMin ? 'sw' : r.status), dn = false;
      if (!r.leer && d.dienste) Object.keys(d.dienste).forEach(function (q) { if (+d.dienste[q] > 0) dn = true; });
      if (r.feiertag && r.leer === false && r.status === 'arbeit') ik = 'arbeit';
      var frs = fristenAm(r.datum); if (frs.length) small.push('Frist: ' + esc(frs.join(', ')));
      var cls = 'day' + (rest ? ' rest' : '') + (r.datum === today ? ' today' : '') + (ik ? ' st-' + ik : '');
      return '<li><button type="button" class="' + cls + '" data-date="' + r.datum + '">' +
        '<span class="d-date"><b>' + p.d + '</b><i>' + WD[E.weekday(r.datum)] + '</i><span class="d-icos">' + (ik && ik !== 'arbeit' ? '<span class="d-ico" data-ik="' + ik + '">' + dayIco(ik) + '</span>' : '') + (dn ? '<span class="d-ico st-dienst-i" data-ik="dienst">' + dayIco('dienst') + '</span>' : '') + (frs.length ? '<span class="d-ico st-frist-i" data-ik="frist">' + dayIco('frist') + '</span>' : '') + '</span></span>' +
        '<span class="d-main' + (r.leer ? ' none' : '') + '">' + main +
        ((chips || small.length) ? '<small>' + chips + small.join(' · ') + '</small>' : '') + '</span>' +
        '<span class="d-val">' + val + '</span></button></li>';
    }).join('');
    // Ansicht: Liste, Monatsraster oder beides (Einstellung)
    var an = (data.profil && data.profil.monatAnsicht) || 'liste', first = cm.tage.length ? E.weekday(cm.tage[0].datum) : 1, off = (first + 6) % 7;
    $('#m-days').hidden = an === 'raster'; $('#m-grid').hidden = an === 'liste';
    if (an !== 'liste') {
      var g = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map(function (n) { return '<div class="mg-h">' + n + '</div>'; }).join('');
      for (var q = 0; q < off; q++) g += '<div class="mg-c mg-e"></div>';
      cm.tage.forEach(function (r) {
        var d = data.days[r.datum] || {}, ik = r.leer ? '' : (r.status === 'arbeit' && r.swMin && !r.nettoMin ? 'sw' : r.status), v = '';
        if (!r.leer) { if (r.status === 'arbeit' && r.nettoMin > 0) v = fh(r.nettoMin / 60); else if (r.creditMin) v = fh(r.creditMin / 60); }
        var gdn = false; if (!r.leer && d.dienste) Object.keys(d.dienste).forEach(function (q) { if (+d.dienste[q] > 0) gdn = true; });
        if (!ik && r.feiertag) ik = 'feiertag';
        var gfr = fristenAm(r.datum).length > 0;
        var ic = (ik && ik !== 'arbeit' ? '<span class="d-ico">' + dayIco(ik) + '</span>' : '') + (gdn ? '<span class="d-ico st-dienst-i">' + dayIco('dienst') + '</span>' : '') + (gfr ? '<span class="d-ico st-frist-i">' + dayIco('frist') + '</span>' : ''), dd = E.parseISO(r.datum).d;
        g += '<button type="button" class="mg-c' + (r.typ !== 'werktag' ? ' rest' : '') + (r.datum === today ? ' today' : '') + (ik ? ' st-' + ik : '') + '" data-date="' + r.datum + '" aria-label="' + esc(fmtShort(r.datum) + (r.feiertag ? ', ' + r.feiertag : '')) + '"><b>' + dd + '</b><span class="mg-ic">' + ic + '</span>' + (v ? '<small>' + v + '</small>' : '') + '</button>';
      });
      $('#m-grid').innerHTML = g;
    }
  }

  // Wie steht der bezahlte Krankenstand, Urlaub und Feiertag auf dem Lohnzettel? In eigenen Zeilen oder alles in der Zeile "Lohn" (zum Beispiel RZL-Lohnzettel)?
  function uzSoll(v) { // Urlaubszuschuss vom Lohnzettel gegen die Sonderzahlung im Profil
    var p = data.profil || {}, l = (p.sonder || []).filter(function (x) { return x.art === 'urlaub' && +x.jahr === ui.y; })[0];
    if (!l) return '<small class="abhint">Noch keine Sonderzahlung „Urlaubszuschuss“ im Profil eingetragen. Dann kann die App den Betrag vergleichen.</small>';
    var soll = E.sonderSoll(l.voll, E.sonderAnteil(p.eintritt, +l.jahr));
    if (soll === null) return '';
    var h = '<small class="abhint">Soll laut Profil: <b>' + eur.format(soll) + '</b>';
    if (hasN(v)) { var d = Math.round((+v - soll) * 100) / 100; h += Math.abs(d) < 0.5 ? ' – passt.' : d < 0 ? ' – es fehlen ' + eur.format(-d) + '.' : ' – es sind ' + eur.format(d) + ' mehr.'; }
    return h + '</small>';
  }
  function lzAlles() { return !!(data.profil && data.profil.lzAlles === true); }
  function renderAbArt() {
    var el = $('#ab-art'); if (!el) return;
    var c = miaCfg(), fig = '<div class="lkfig">' + miaSvg(c.figur, miaFor(), '') + '</div>', pr = data.profil || {};
    if (pr.lzAlles === undefined) {
      el.innerHTML = '<div class="lkmia">' + fig + '<div class="lkbub"><span>Wie stehen Krankenstand, Urlaub und Feiertag auf deinem Lohnzettel? Steht bei „Lohn“ zum Beispiel 168 Stunden für den ganzen Monat, dann steckt alles in dieser Zeile.</span></div></div>' +
        '<div class="chips"><button type="button" class="chip pick" id="ab-art-a" aria-pressed="false">In eigenen Zeilen</button><button type="button" class="chip pick" id="ab-art-b" aria-pressed="false">Alles steckt in der Zeile „Lohn“</button></div>';
    } else {
      el.innerHTML = '<div class="chips"><button type="button" class="chip pick" id="ab-art-a" aria-pressed="' + (!pr.lzAlles) + '">Krankenstand, Urlaub, Feiertag in eigenen Zeilen</button><button type="button" class="chip pick" id="ab-art-b" aria-pressed="' + (!!pr.lzAlles) + '">Alles steckt in der Zeile „Lohn“</button></div>';
    }
  }
  function fixLohn() { var w = wAt(monthKey() + '-01'); return !!(w && +w.monatslohn > 0); }
  function monthKey() { return ui.y + '-' + pad(ui.m); }
  var AB_HINT = {
    gleit: 'Dein Gleitzeitsaldo für diesen Monat, so wie ihn deine Zeiterfassung oder dein Zeitnachweis zeigt (Plus oder Minus in Stunden).',
    lohn: 'Zeile „Lohn“, Spalte „Menge“. Das sind die normalen Stunden, ohne Überstunden und ohne Feiertag.',
    lohnAlles: 'Zeile „Lohn“, Spalte „Menge“. Hier steckt alles drin: normale Stunden, Feiertag, Urlaub und Krankenstand.',
    ueber: 'Zeile „Überstunden Grundlohn“. Nicht die Zeile mit „Zuschlag“ oder „Zusch.“.',
    feiertag: 'Zeile „Feiertagslohn“.',
    urlaub: 'Zeile „Urlaubslohn“.',
    krank: 'Zeile „Krankenstand“ oder „Entgeltfortzahlung“.',
    pflege: 'Zeile „Pflegefreistellung“.',
    dStd: 'Zeile „Diäten“ oder „Aufwandsentschädigung“, Menge in Stunden.',
    sonder: 'Nur wenn dein Lohnzettel eine Zeile „Sonderurlaub“ hat und die Firma diesen Tag aus deinen Überstunden bezahlt hat. Trage hier die Stunden ein. Sie werden zur Zeile „Lohn“ dazugezählt.',
    urlaubszuschuss: 'Nur wenn dein Lohnzettel eine Zeile „Urlaubszuschuss“ hat. Meist steht dort nur ein Bruttobetrag. Trage ihn in Euro ein.',
    zaKonto: 'Nur wenn dein Lohnzettel ein Zeitausgleich-Konto zeigt: der Zuwachs in diesem Monat. Diese Stunden wurden nicht ausbezahlt, sondern aufs Konto gebucht. Sie werden zu den Überstunden dazugezählt.'
  };
  // Firmen, die Diäten und Überstunden erst im Folgemonat abrechnen: der Lohnzettel von Monat N zeigt die Aufzeichnung von Monat N-1.
  function ueberRows() {
    return Object.keys(data.abgleich).sort().filter(function (k) { return data.abgleich[k].ueber != null; }).map(function (k) {
      var y = +k.slice(0, 4), m = +k.slice(5, 7), lz = data.abgleich[k];
      var s = abSumme(E.calcMonth(data, y, m, todayISO(), { ohneSpaeter: true }).summe, y, m), app = Math.max(0, s.ueberStd), paid = +E.lzMitKorr(data.abgleich, k).lz.ueber, konto = E.zaUeber(+lz.zaKonto || 0, s.zaUmr);
      return { y: y, m: m, app: app, paid: paid, konto: konto, diff: Math.round((paid + konto - app) * 100) / 100 };
    });
  }
  /* ============================================================ LOHNZETTEL (eigener Reiter) */
  function renderLohn() {
    $('#lm-title').textContent = MON[ui.m - 1] + ' ' + ui.y;
    var cm = E.calcMonth(data, ui.y, ui.m, todayISO()), s = cm.summe;
    renderAbgleich(cm.spaeter.length ? E.calcMonth(data, ui.y, ui.m, todayISO(), { ohneSpaeter: true }).summe : s, cm.spaeter);
    renderKonten();
  }
  function neuZeichnen() { if (ui.view === 'lohn') renderLohn(); else renderMonat(); }
  function setSeg(seg) {
    ui.mseg = seg === 'konten' ? 'konten' : 'monat';
    $('#m-pane-monat').hidden = ui.mseg !== 'monat'; $('#m-pane-konten').hidden = ui.mseg !== 'konten';
    $$('#m-seg .segb').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.seg === ui.mseg ? 'true' : 'false'); });
    if (ui.mseg === 'konten') renderKonten();
    window.scrollTo(0, 0);
  }
  function abSumme(summe, y, m) {
    var wm = wAt(y + '-' + (m < 10 ? '0' : '') + m + '-01');
    if (!wm || !wm.folgemonat) return summe;
    var py = m === 1 ? y - 1 : y, pm = m === 1 ? 12 : m - 1;
    var pv = E.calcMonth(data, py, pm, todayISO(), { ohneSpaeter: true }).summe, o = {};
    Object.keys(summe).forEach(function (k) { o[k] = summe[k]; });
    o.ueberStd = pv.ueberStd; o.diaetenStd = pv.diaetenStd; o.diaetenBetrag = pv.diaetenBetrag; o.folge = true;
    return o;
  }
  function renderAbgleich(summe, spaeter) {
    summe = abSumme(summe, ui.y, ui.m);
    ui.summe = summe;
    $('#ab-spaeter').innerHTML = (spaeter && spaeter.length) ? '<div class="notice warn"><strong>Nicht mitgerechnet, weil später abgerechnet:</strong> ' + spaeter.map(function (x) { return esc(fmtShort(x.datum)) + ' (' + fh(x.std) + ' h)'; }).join(', ') + '. Merke dir diesen Tag. Er sollte auf einem späteren Lohnzettel auftauchen. Wenn nicht, reklamiere ihn.</div>' : '';
    if (summe.folge) $('#ab-spaeter').innerHTML += '<div class="notice">Diäten und Überstunden vergleicht die App mit deiner Aufzeichnung vom Vormonat.</div>';
    var lz = data.abgleich[monthKey()] || {};
    var le = E.lzMitKorr(data.abgleich, monthKey());
    var rows = E.abgleich(summe, le.lz, ui.abAlle, fixLohn(), lzAlles());
    renderAbArt();
    $('#ab-more').hidden = !!ui.abAlle;
    $('#ab-rows').innerHTML = rows.map(function (r) {
      var v = lz[r.key];
      if (r.status === 'info') return '<div class="abrow">' +
        '<label class="what" for="ab-' + r.key + '">' + esc(r.label) + '</label>' +
        '<small class="abhint">' + esc(r.key.indexOf('ds_') === 0 ? 'Steht dafür eine Zeile auf dem Lohnzettel? Dann trage den Betrag in Euro ein.' : AB_HINT[r.key]) + '</small>' + (r.key === 'urlaubszuschuss' ? uzSoll(v) : '') +
        '<div class="abline"><div class="abin"><input type="number" id="ab-' + r.key + '" inputmode="decimal" step="' + (r.unit === '€' ? '0.01' : '0.25') + '" value="' + (v == null ? '' : esc(v)) + '" placeholder="' + (r.unit === '€' ? 'Betrag' : 'Zuwachs') + '"><span>' + (r.unit === '€' ? '€' : 'h') + '</span></div></div></div>';
      var isE = r.unit === '€';
      return '<div class="abrow">' +
        '<label class="what" for="ab-' + r.key + '">' + esc(r.label) + '</label>' +
        '<small class="abhint">' + esc(isE ? (r.key === 'dEuro' ? 'Der Betrag bei Diäten auf dem Lohnzettel, in Euro.' : (r.key.indexOf('ds_') === 0 ? 'Betrag in Euro, so wie auf dem Lohnzettel.' : 'Prämie in Euro, so wie auf dem Lohnzettel.')) : (r.key === 'lohn' && lzAlles() ? AB_HINT.lohnAlles : AB_HINT[r.key])) + '</small>' +
        '<div class="abline"><div class="abin"><input type="number" id="ab-' + r.key + '" inputmode="decimal" step="' + (isE ? '0.01' : '0.25') + '" value="' + (v == null ? '' : esc(v)) + '" placeholder="vom Lohnzettel"><span>' + (isE ? '€' : 'h') + '</span></div>' +
        '<div class="abapp">Deine Aufzeichnung<br><b>' + (isE ? eur.format(r.app) : fh(r.app) + ' h') + '</b></div>' +
        '<span class="chip" data-chip="' + r.key + '"></span></div></div>';
    }).join('');
    renderAbExtra();
    renderAbSatz();
    renderAbKorr();
    paintAbgleich();
  }
  /* ---- Weitere Zeilen vom Lohnzettel (frei benannt) ---- */
  function abExtra(neu) { var k = monthKey(), o = data.abgleich[k]; if (!o && !neu) return []; if (!o) o = data.abgleich[k] = {}; if (!o.extra && neu) o.extra = []; return o.extra || []; }
  function abExtraClean() { var k = monthKey(), o = data.abgleich[k]; if (!o) return; if (o.extra && !o.extra.length) delete o.extra; if (!Object.keys(o).some(function (q) { return q !== 'test' && q !== 'gelesen' && o[q] != null; })) delete data.abgleich[k]; }
  function renderAbExtra() {
    var el = $('#ab-extra'); if (!el) return;
    el.innerHTML = '<h4 class="abx-h">Weitere Zeilen vom Lohnzettel</h4>' + abExtra().map(function (x, i) {
      return '<div class="abx" data-i="' + i + '"><div class="abx-top"><input type="text" data-f="name" maxlength="50" value="' + esc(x.name || '') + '" placeholder="Name der Zeile, wie auf dem Lohnzettel" aria-label="Name der Zeile"><button type="button" class="btn" data-act="x" aria-label="Entfernen">×</button></div>' +
        '<div class="abx-val"><input type="number" data-f="wert" inputmode="decimal" step="0.01" value="' + (x.wert == null ? '' : esc(x.wert)) + '" placeholder="Wert" aria-label="Wert"><select data-f="einheit" aria-label="Einheit"><option value="€"' + (x.einheit !== 'h' ? ' selected' : '') + '>€</option><option value="h"' + (x.einheit === 'h' ? ' selected' : '') + '>h</option></select></div>' +
        '<label class="check"><input type="checkbox" data-f="senden"' + (x.senden ? ' checked' : '') + '><span>Bezeichnung an die Entwickler schicken (ohne Betrag)</span></label></div>';
    }).join('') + '<button type="button" class="btn" id="abx-add">+ Weitere Zeile</button>' + (abExtra().length ? '<p class="hint">Diese Zeilen kann die App noch nicht prüfen. Sie sind für dich notiert.</p>' : '');
  }
  (function () {
    var el = $('#ab-extra'); if (!el) return;
    function sendName(x) { if (!x.senden || !x.name || x.gesendet === x.name + '|' + x.einheit) return; try { window.StundenInsights.feedback('wunsch', '[Lohnzettel-Zeile fehlt] ' + x.name + ' (' + x.einheit + ')', null).then(function () { x.gesendet = x.name + '|' + x.einheit; save(); toast('Danke! Die Bezeichnung ist bei den Entwicklern angekommen.'); }, function () { }); } catch (e) { } }
    el.addEventListener('change', function (ev) {
      var t = ev.target, r = t.closest('.abx'); if (!r || !t.dataset.f) return; var x = abExtra()[+r.dataset.i]; if (!x) return;
      if (t.dataset.f === 'wert') { var n = parseFloat(String(t.value).replace(',', '.')); x.wert = isNaN(n) ? null : n; }
      else if (t.dataset.f === 'senden') x.senden = t.checked;
      else x[t.dataset.f] = t.value;
      delete data.abgleich[monthKey()].test; save(); sendName(x); renderAbExtra();
    });
    el.addEventListener('click', function (ev) {
      var b = ev.target.closest('button'); if (!b) return;
      if (b.id === 'abx-add') { abExtra(true).push({ name: '', wert: null, einheit: '€', senden: true }); save(); renderAbExtra(); var ii = el.querySelectorAll('.abx [data-f=name]'); if (ii.length) ii[ii.length - 1].focus(); }
      else if (b.dataset.act === 'x') { var r = b.closest('.abx'); abExtra().splice(+r.dataset.i, 1); abExtraClean(); save(); renderAbExtra(); }
    });
  })();

  /* ---- Nachzahlungen, Rückverrechnung, Stundenlohn aufgerollt (gehören zum Lohnzettel-Monat, wirken auf den Bezugsmonat) ---- */
  function hasN(v) { return !(v === null || v === undefined || v === '' || isNaN(+v)); }
  function korrList(neu) { var k = monthKey(), o = data.abgleich[k]; if (!o && !neu) return []; if (!o) o = data.abgleich[k] = {}; if (!o.korr && neu) o.korr = []; return o.korr || []; }
  function korrClean() { var k = monthKey(), o = data.abgleich[k]; if (!o) return; if (o.korr && !o.korr.length) delete o.korr; if (!Object.keys(o).some(function (q) { return q !== 'test' && q !== 'gelesen' && o[q] != null; })) delete data.abgleich[k]; }
  function monthList() {
    var first = Object.keys(data.days || {}).sort()[0], t = todayISO(), out = [], y, m, ey = +t.slice(0, 4), em = +t.slice(5, 7);
    if (first) { y = +first.slice(0, 4); m = +first.slice(5, 7); } else { y = ey; m = em; }
    while ((y < ey || (y === ey && m <= em)) && out.length < 60) { out.push(y + '-' + pad(m)); m++; if (m > 12) { m = 1; y++; } }
    var cur = monthKey(); if (out.indexOf(cur) < 0) out.push(cur);
    return out;
  }
  function monName(k) { return MON[+k.slice(5, 7) - 1] + ' ' + k.slice(0, 4); }
  function monOpts(sel) { return monthList().map(function (k) { return '<option value="' + k + '"' + (k === sel ? ' selected' : '') + '>' + esc(monName(k)) + '</option>'; }).join(''); }
  function zeilenOpts(sel) {
    var rows = ui.summe ? E.abgleich(ui.summe, {}, true, false) : [];
    return rows.filter(function (r) { return r.status !== 'info' && r.key !== 'gleit'; }).map(function (r) { return '<option value="' + esc(r.key) + '"' + (r.key === sel ? ' selected' : '') + '>' + esc(r.label) + '</option>'; }).join('') + '<option value="sonst"' + (sel === 'sonst' ? ' selected' : '') + '>Sonstiges (nur Notiz)</option>';
  }
  function aufrollMonate(e) {
    var von = e.bezug, bis = e.bis || e.bezug, out = [];
    if (!von) return out;
    var ml = monthList().filter(function (k) { return k >= von && k <= bis; });
    ml.forEach(function (k) {
      var y = +k.slice(0, 4), m = +k.slice(5, 7), lz = data.abgleich[k] || {};
      var s = abSumme(E.calcMonth(data, y, m, todayISO(), { ohneSpaeter: true }).summe, y, m);
      var normal, ueber;
      var sum = function (keys) { return keys.reduce(function (a, q) { return a + (hasN(lz[q]) ? +lz[q] : 0); }, 0); };
      if (hasN(lz.lohn)) normal = sum(['lohn', 'sonder', 'feiertag', 'urlaub', 'krank', 'pflege']);
      else normal = (s.normalStd || 0) + (s.feiertagStd || 0) + (s.urlaubStd || 0) + (s.krankStd || 0) + (s.pflegeStd || 0);
      if (hasN(lz.ueber)) ueber = +lz.ueber + (hasN(lz.zaKonto) ? E.zaUeber(+lz.zaKonto, s.zaUmr) : 0); else ueber = Math.max(0, s.ueberStd || 0);
      out.push({ monat: k, normalStd: normal, ueberStd: ueber, alt: hasN(lz.satz) ? +lz.satz : (hasN(e.alt) ? +e.alt : 0), neu: hasN(e.neu) ? +e.neu : 0 });
    });
    return out;
  }
  function renderAbSatz() {
    var el = $('#ab-satzwrap'); if (!el) return;
    if (fixLohn()) { el.innerHTML = ''; return; }
    var v = (data.abgleich[monthKey()] || {}).satz;
    el.innerHTML = '<div class="abrow"><label class="what" for="ab-satz">Stundenlohn laut Lohnzettel (optional)</label>' +
      '<small class="abhint">Der Satz pro Stunde, so wie auf dem Lohnzettel bei der Zeile „Lohn“. Damit sieht die App, ob dein Stundenlohn richtig angewendet wurde.</small>' +
      '<div class="abline"><div class="abin"><input type="number" id="ab-satz" inputmode="decimal" step="0.01" value="' + (v == null ? '' : esc(v)) + '" placeholder="vom Lohnzettel"><span>€</span></div></div></div>';
  }
  function renderAbKorr() {
    var el = $('#ab-korr'); if (!el) return;
    var list = korrList(), mk = monthKey();
    var h = '<h4 class="abx-h">Nachzahlungen und Korrekturen</h4>' +
      '<small class="abhint">Hat dieser Lohnzettel etwas für einen früheren Monat nachgezahlt oder zurückverrechnet? Dann trage es hier ein. Die App rechnet es dem früheren Monat zu, damit dort alles passt. Bei „Stundenlohn aufgerollt“ zeigt sie dir den Rechengang.</small>';
    h += list.map(function (e, i) {
      var top = '<div class="abx-top"><select data-f="art" aria-label="Art"><option value="nach"' + (e.art === 'nach' ? ' selected' : '') + '>Nachzahlung</option><option value="rueck"' + (e.art === 'rueck' ? ' selected' : '') + '>Rückverrechnung (Abzug)</option><option value="aufroll"' + (e.art === 'aufroll' ? ' selected' : '') + '>Stundenlohn aufgerollt</option></select><button type="button" class="btn" data-act="x" aria-label="Entfernen">×</button></div>';
      var note = '<input type="text" data-f="notiz" maxlength="200" value="' + esc(e.notiz || '') + '" placeholder="Notiz, zum Beispiel: nach Einspruch nachbezahlt" aria-label="Notiz">';
      if (e.art === 'aufroll') {
        var rg = E.aufrollSumme(aufrollMonate(e), (wAt(mk + '-01').ueberstunden || {}).zuschlagPct);
        var paid = hasN(e.betrag) ? +e.betrag : null, diff = paid == null ? null : Math.round((paid - rg.summe) * 100) / 100, chip = '';
        if (diff !== null && rg.zeilen.length) chip = Math.abs(diff) < 0.5 ? '<span class="chip good">Passt</span>' : (diff < 0 ? '<span class="chip bad">Es fehlen ' + eur.format(-diff) + '</span>' : '<span class="chip warn">Zu viel bezahlt ' + eur.format(diff) + '</span>');
        var tbl = rg.zeilen.length ? '<div class="rgw"><table class="rg"><thead><tr><th>Monat</th><th>Normal</th><th>Überstunden</th><th>je Stunde</th><th>Betrag</th></tr></thead><tbody>' + rg.zeilen.map(function (z) { return '<tr><td>' + esc(monName(z.monat).slice(0, 3) + ' ' + z.monat.slice(2, 4)) + '</td><td>' + fh(z.normalStd) + ' h</td><td>' + fh(z.ueberStd) + ' h</td><td>' + nf2.format(z.delta) + ' €</td><td>' + nf2.format(z.euro) + ' €</td></tr>'; }).join('') + '</tbody></table></div><p><strong>Fällig laut Rechnung: ' + eur.format(rg.summe) + '</strong> ' + chip + '</p><small class="abhint">Die Rechnung nimmt die Stunden von deinem Lohnzettel, wenn du sie eingetragen hast, sonst deine Aufzeichnung. Überstunden zählen mit Zuschlag.</small>' : '';
        return '<div class="abx" data-i="' + i + '">' + top +
          '<div class="abx-val"><div class="abf"><span class="abl">Von Monat</span><select data-f="bezug" aria-label="Von Monat">' + monOpts(e.bezug) + '</select></div><div class="abf"><span class="abl">Bis Monat</span><select data-f="bis" aria-label="Bis Monat">' + monOpts(e.bis || e.bezug) + '</select></div></div>' +
          '<div class="abx-val"><div class="abf"><span class="abl">Alter Stundenlohn</span><input type="number" data-f="alt" inputmode="decimal" step="0.01" value="' + (e.alt == null ? '' : esc(e.alt)) + '" aria-label="Alter Stundenlohn"></div><div class="abf"><span class="abl">Neuer Stundenlohn</span><input type="number" data-f="neu" inputmode="decimal" step="0.01" value="' + (e.neu == null ? '' : esc(e.neu)) + '" aria-label="Neuer Stundenlohn"></div></div>' +
          '<div class="abx-val"><div class="abf"><span class="abl">Auf diesem Lohnzettel bezahlt (€)</span><input type="number" data-f="betrag" inputmode="decimal" step="0.01" value="' + (e.betrag == null ? '' : esc(e.betrag)) + '" aria-label="Auf diesem Lohnzettel bezahlt (€)"></div></div>' + note + tbl + '</div>';
      }
      var euro = e.zeile === 'sonst' ? e.einheit === '€' : E.korrEuroZeile(e.zeile);
      return '<div class="abx" data-i="' + i + '">' + top +
        '<div class="abx-val"><select data-f="bezug" aria-label="Für welchen Monat?">' + monOpts(e.bezug) + '</select></div>' +
        '<div class="abx-val"><select data-f="zeile" aria-label="Welche Zeile?">' + zeilenOpts(e.zeile) + '</select></div>' +
        '<div class="abx-val"><input type="number" data-f="wert" inputmode="decimal" step="0.01" value="' + (e.wert == null ? '' : esc(e.wert)) + '" placeholder="Wert" aria-label="Wert">' +
        (e.zeile === 'sonst' ? '<select data-f="einheit" aria-label="Einheit"><option value="€"' + (e.einheit !== 'h' ? ' selected' : '') + '>€</option><option value="h"' + (e.einheit === 'h' ? ' selected' : '') + '>h</option></select>' : '<span class="unit">' + (euro ? '€' : 'h') + '</span>') + '</div>' + note + '</div>';
    }).join('');
    h += '<button type="button" class="btn" id="abk-add">+ Nachzahlung oder Korrektur</button>';
    el.innerHTML = h;
  }
  (function () {
    var el = $('#ab-korr'); if (!el) return;
    function after() { delete data.abgleich[monthKey()].test; save(); try { document.activeElement.blur(); } catch (e) {} setTimeout(function () { renderAbKorr(); paintAbgleich(); }, 0); }
    el.addEventListener('change', function (ev) {
      var t = ev.target, r = t.closest('.abx'); if (!r || !t.dataset.f) return; var e = korrList()[+r.dataset.i]; if (!e) return;
      var f = t.dataset.f;
      if (['wert', 'alt', 'neu', 'betrag'].indexOf(f) >= 0) { var n = parseFloat(String(t.value).replace(',', '.')); e[f] = isNaN(n) ? null : n; }
      else if (f === 'art') {
        e.art = t.value;
        if (t.value === 'aufroll') { e.bis = e.bis || e.bezug; if (e.neu == null) { var w = wAt(e.bezug + '-01'); e.neu = w && w.stundenlohn != null ? +w.stundenlohn : null; } }
      } else if (f === 'zeile') { e.zeile = t.value; e.einheit = t.value === 'sonst' ? (e.einheit || '€') : (E.korrEuroZeile(t.value) ? '€' : 'h'); }
      else if (f === 'bezug') { e.bezug = t.value; if (e.bis && e.bis < t.value) e.bis = t.value; }
      else e[f] = t.value;
      if (f === 'zeile' || f === 'wert') e.einheit = e.zeile === 'sonst' ? (e.einheit || '€') : (E.korrEuroZeile(e.zeile) ? '€' : 'h');
      after();
    });
    el.addEventListener('click', function (ev) {
      var b = ev.target.closest('button'); if (!b) return;
      if (b.id === 'abk-add') {
        var pk = ui.m === 1 ? (ui.y - 1) + '-12' : ui.y + '-' + pad(ui.m - 1), rows = ui.summe ? E.abgleich(ui.summe, {}, true, false).filter(function (r) { return r.status !== 'info' && r.key !== 'gleit'; }) : [];
        var z = rows.length ? rows[0].key : 'sonst';
        korrList(true).push({ art: 'nach', bezug: pk, zeile: z, wert: null, einheit: E.korrEuroZeile(z) ? '€' : 'h', notiz: '' }); save(); renderAbKorr();
      } else if (b.dataset.act === 'x') { var r = b.closest('.abx'); korrList().splice(+r.dataset.i, 1); korrClean(); save(); renderAbKorr(); paintAbgleich(); }
    });
  })();
  function korrUeberblick() {
    var out = [];
    Object.keys(data.abgleich).sort().forEach(function (zk) { ((data.abgleich[zk] || {}).korr || []).forEach(function (e) { out.push({ zk: zk, e: e }); }); });
    var el = $('#k-nach'); if (!el) return;
    if (!out.length) { el.innerHTML = '<p class="hint">Noch keine Nachzahlung eingetragen.</p>'; return; }
    var zl = {}; (ui.summe ? E.abgleich(ui.summe, {}, true, false) : []).forEach(function (r) { zl[r.key] = r.label; });
    el.innerHTML = '<table class="cmp"><thead><tr><th>Lohnzettel</th><th>Art</th><th>Für Monat</th><th>Zeile</th><th>Betrag</th></tr></thead><tbody>' + out.map(function (x) {
      var e = x.e, art = e.art === 'rueck' ? 'Rückverrechnung (Abzug)' : e.art === 'aufroll' ? 'Stundenlohn aufgerollt' : 'Nachzahlung';
      var wert = e.art === 'aufroll' ? (hasN(e.betrag) ? nf2.format(e.betrag) + ' €' : '') : (hasN(e.wert) ? (e.art === 'rueck' ? '−' : '+') + nf2.format(e.wert) + ' ' + (e.einheit === 'h' ? 'h' : '€') : '');
      var zeile = e.art === 'aufroll' ? 'Lohn' : (e.zeile === 'sonst' ? 'Sonstiges' : (zl[e.zeile] || e.zeile || ''));
      var bez = e.art === 'aufroll' && e.bis && e.bis !== e.bezug ? monName(e.bezug).slice(0, 3) + '–' + monName(e.bis).slice(0, 3) + ' ' + e.bis.slice(2, 4) : monName(e.bezug || '').slice(0, 3) + ' ' + String(e.bezug || '').slice(2, 4);
      return '<tr><td>' + esc(monName(x.zk).slice(0, 3) + ' ' + x.zk.slice(2, 4)) + '</td><td>' + esc(art) + '</td><td>' + esc(bez) + '</td><td>' + esc(zeile) + '</td><td>' + wert + '</td></tr>' + (e.notiz ? '<tr><td colspan="5" class="hint">' + esc(e.notiz) + '</td></tr>' : '');
    }).join('') + '</tbody></table>';
  }
  /* ---- Sonderzahlungen (13./14. Gehalt, Urlaubszuschuss, Weihnachtsgeld) ---- */
  var SND_ART = [['urlaub', 'Urlaubszuschuss / Urlaubsgeld'], ['weihnacht', 'Weihnachtsremuneration / Weihnachtsgeld'], ['d13', '13. Gehalt'], ['d14', '14. Gehalt'], ['andere', 'Andere Sonderzahlung']];
  function sndList() { if (!data.profil) data.profil = {}; if (!data.profil.sonder) data.profil.sonder = []; return data.profil.sonder; }
  function renderSonder() {
    var el = $('#k-sonder'); if (!el) return;
    var list = (data.profil && data.profil.sonder) || [], p = data.profil || {}, y0 = +todayISO().slice(0, 4);
    if (!list.length) { el.innerHTML = '<p class="hint">Noch keine Sonderzahlung eingetragen.</p>'; return; }
    el.innerHTML = list.map(function (s, i) {
      var an = E.sonderAnteil(p.eintritt, +s.jahr), soll = E.sonderSoll(s.voll, an), chip = '';
      if (soll !== null && hasN(s.ist)) { var d = Math.round((+s.ist - soll) * 100) / 100; chip = Math.abs(d) < 0.5 ? '<span class="chip good">Passt</span>' : (d < 0 ? '<span class="chip bad">Es fehlen ' + eur.format(-d) + '</span>' : '<span class="chip warn">Zu viel bezahlt ' + eur.format(d) + '</span>'); }
      var yo = ''; for (var y = y0 + 1; y >= y0 - 5; y--) yo += '<option value="' + y + '"' + (+s.jahr === y ? ' selected' : '') + '>' + y + '</option>';
      return '<div class="sndrow" data-i="' + i + '"><div class="abx-top"><select data-f="art" aria-label="Art">' + SND_ART.map(function (a) { return '<option value="' + a[0] + '"' + (s.art === a[0] ? ' selected' : '') + '>' + esc(a[1]) + '</option>'; }).join('') + '</select><select data-f="jahr" aria-label="Jahr" style="max-width:90px">' + yo + '</select><button type="button" class="btn" data-act="x" aria-label="Entfernen">×</button></div>' +
        '<div class="abx-val"><input type="number" data-f="voll" inputmode="decimal" step="0.01" value="' + (s.voll == null ? '' : esc(s.voll)) + '" placeholder="Betrag laut Vertrag (€ pro Jahr)" aria-label="Betrag laut Vertrag (€ pro Jahr)"></div>' +
        (soll !== null ? '<p class="hint">Anteil im Jahr: ' + Math.round(an * 100) + ' %. Soll: <strong>' + eur.format(soll) + '</strong></p>' : '') +
        '<div class="abx-val"><input type="number" data-f="ist" inputmode="decimal" step="0.01" value="' + (s.ist == null ? '' : esc(s.ist)) + '" placeholder="Laut Lohnzettel (€)" aria-label="Laut Lohnzettel (€)"></div>' + (chip ? '<p>' + chip + '</p>' : '') +
        '<input type="text" data-f="notiz" maxlength="200" value="' + esc(s.notiz || '') + '" placeholder="Notiz" aria-label="Notiz"></div>';
    }).join('');
  }
  (function () {
    var el = $('#k-sonder'), add = $('#snd-add'); if (!el || !add) return;
    add.addEventListener('click', function () { sndList().push({ art: 'weihnacht', jahr: +todayISO().slice(0, 4), voll: null, ist: null, notiz: '' }); delete data.profil.test; save(); renderSonder(); });
    el.addEventListener('change', function (ev) {
      var t = ev.target, r = t.closest('.sndrow'); if (!r || !t.dataset.f) return; var s = sndList()[+r.dataset.i]; if (!s) return;
      var f = t.dataset.f;
      if (f === 'voll' || f === 'ist') { var n = parseFloat(String(t.value).replace(',', '.')); s[f] = isNaN(n) ? null : n; } else if (f === 'jahr') s.jahr = +t.value; else s[f] = t.value;
      delete data.profil.test; save(); try { t.blur(); } catch (e) {} setTimeout(renderSonder, 0);
    });
    el.addEventListener('click', function (ev) { var b = ev.target.closest('button'); if (b && b.dataset.act === 'x') { var r = b.closest('.sndrow'); sndList().splice(+r.dataset.i, 1); save(); renderSonder(); } });
  })();
  function freiFrage(rows) { // Lohnzettel zeigt, dass die Firma die Freistellung anders verrechnet hat als eingestellt: Frage, ob die Tage richtig gestellt werden sollen
    var el = $('#ab-frei'); if (!el) return; el.innerHTML = '';
    var l = (ui.summe && ui.summe.freiListe) || []; if (!l.length) return;
    var key = monthKey(); if (ui.freiNein && ui.freiNein[key]) return;
    var row = null; rows.forEach(function (r) { if ((r.key === 'ueber' || r.key === 'gleit') && r.status !== 'offen' && r.status !== 'info' && r.diff !== null && !row) row = r; });
    if (!row) return;
    var za = l.filter(function (x) { return x.modus === 'za'; }), bz = l.filter(function (x) { return x.modus !== 'za' && x.modus !== 'unbezahlt'; });
    function sum(a) { return a.reduce(function (t, x) { return t + x.std; }, 0); }
    var neu = null, liste = null, text = '';
    if (za.length && row.diff > 0.1 && Math.abs(row.diff - sum(za)) <= 0.26) { neu = 'bezahlt'; liste = za; text = 'Dein Lohnzettel hat mehr Stunden, als die App abzieht. Die Firma hat diese Freistellung wahrscheinlich bezahlt:'; }
    else if (bz.length && row.diff < -0.1 && Math.abs(-row.diff - sum(bz)) <= 0.26) { neu = 'za'; liste = bz; text = 'Dein Lohnzettel hat weniger Stunden. Die Firma hat diese Freistellung wahrscheinlich vom Zeitausgleich abgezogen:'; }
    if (!neu) return;
    el.innerHTML = '<div class="notice warn"><strong>Freistellung: Deine Firma hat es anders gemacht als in deiner Einstellung</strong><p style="margin:6px 0"><span>' + text + '</span> <b>' + liste.map(function (x) { return esc(fmtShort(x.datum)); }).join(', ') + '</b></p><p style="margin:6px 0"><span>Soll ich die Einträge für diese Tage richtig stellen?</span></p><div class="row" style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn" id="ab-fr-ja">Ja, richtig stellen</button><button type="button" class="btn ghost" id="ab-fr-nein">Nein, so lassen</button></div></div>';
    $('#ab-fr-ja').onclick = function () { liste.forEach(function (x) { if (data.days[x.datum]) data.days[x.datum].fv = neu; }); save(); el.innerHTML = ''; toast('Die Tage sind richtig gestellt.'); renderMonat(); };
    $('#ab-fr-nein').onclick = function () { (ui.freiNein || (ui.freiNein = {}))[key] = true; el.innerHTML = ''; };
  }
  function abBericht(rows, given, lz, bad) { // Kontrollbericht: Aufzeichnung, Lohnzettel, Unterschied, wie gerechnet, was zu klären ist
    var el = $('#ab-bericht'); if (!el) return;
    var sm = ui.summe || {};
    if (!given) { el.innerHTML = ''; return; }
    var chipOf = { gleich: ['good', 'Passt'], klein: ['warn', 'Fast gleich'], mehr: ['bad', 'Unterschied'], weniger: ['bad', 'Unterschied'], offen: ['', 'Noch nicht eingetragen'] };
    function val(x, u) { return u === '€' ? eur.format(x) : '<span>' + fh(x) + '</span> h'; }
    var tr = rows.filter(function (r) { return r.status !== 'info'; }).map(function (r) {
      var c = chipOf[r.status] || ['', ''], u = r.unit, lzv = r.lzGesamt != null ? r.lzGesamt : r.lz;
      var d = r.diff === null ? '' : (r.diff > 0 ? '+' : r.diff < 0 ? '−' : '') + (u === '€' ? eur.format(Math.abs(r.diff)) : fh(Math.abs(r.diff)) + ' h');
      return '<tr><td>' + esc(r.label) + '</td><td>' + (r.app == null ? '' : val(r.app, u)) + '</td><td>' + (lzv == null ? '' : val(lzv, u)) + '</td><td>' + d + '<br><span class="chip ' + c[0] + '">' + esc(c[1]) + '</span></td></tr>';
    }).join('');
    var how = [], fl = sm.freiListe || [];
    if (fl.length) {
      var fm = {}, t = 0; fl.forEach(function (x) { fm[x.modus] = (fm[x.modus] || 0) + x.std; t += x.std; });
      var MT = { bezahlt: 'Freistellung bezahlt, nichts abgezogen', za: 'Freistellung vom Zeitausgleich abgezogen', unbezahlt: 'Freistellung unbezahlt, Soll entfällt', offen: 'Freistellung noch nicht geklärt, nichts abgezogen' };
      Object.keys(fm).forEach(function (k) { how.push('<li><span>' + esc(MT[k] || MT.offen) + '</span>: <b>' + fh(fm[k]) + '</b> h</li>'); });
    }
    if (lz.zaKonto != null || (sm.zaUmr && sm.zaUmr !== 'offen')) {
      var ZT = { offen: 'Weiß ich noch nicht', eingerechnet: '1 Überstunde = 1,5 Stunden Zeitausgleich (Zuschlag ist drin)', getrennt: '1 Überstunde = 1 Stunde Zeitausgleich, der Zuschlag wird ausbezahlt' };
      how.push('<li><span>Zeitausgleich-Umrechnung</span>: <span>' + esc(ZT[sm.zaUmr] || ZT.offen) + '</span></li>');
    }
    var todo = bad.map(function (r) { return '<li><span>Frag im Büro nach dieser Zeile:</span> <b>' + esc(r.label) + '</b></li>'; });
    if (bad.length) {
      if (fl.some(function (x) { return x.modus === 'offen'; })) todo.push('<li><span>Frag, ob die Freistellung bezahlt oder vom Zeitausgleich abgezogen wurde.</span></li>');
      if (lz.zaKonto != null && (!sm.zaUmr || sm.zaUmr === 'offen')) todo.push('<li><span>Frag, wie der Zeitausgleich gutgeschrieben wird: 1:1,5 oder 1:1.</span></li>');
      todo.push('<li><span>Prüfe, ob alle Tage und Pausen richtig eingetragen sind.</span></li>');
    }
    el.innerHTML = '<div class="notice"><strong>Kontrollbericht dieses Monats</strong>' +
      '<table class="cmp" style="margin-top:8px"><thead><tr><th>Zeile</th><th>Aufzeichnung</th><th>Lohnzettel</th><th>Unterschied</th></tr></thead><tbody>' + tr + '</tbody></table>' +
      (how.length ? '<p style="margin:10px 0 2px"><strong>So hat die App gerechnet</strong></p><ul style="margin:0;padding-left:20px">' + how.join('') + '</ul>' : '') +
      '<p style="margin:10px 0 2px"><strong>Das kannst du klären</strong></p>' +
      (todo.length ? '<ul style="margin:0;padding-left:20px">' + todo.join('') + '</ul>' : '<p style="margin:0"><span>Nichts zu klären. Alles stimmt mit deiner Aufzeichnung überein.</span></p>') + '</div>';
  }
  function paintAbgleich() {
    var lz = data.abgleich[monthKey()] || {}, le = E.lzMitKorr(data.abgleich, monthKey()), rows = E.abgleich(ui.summe, le.lz, ui.abAlle, fixLohn(), lzAlles()), given = 0, bad = [];
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
      var rowEl = chip.closest('.abrow'); if (rowEl) Array.prototype.forEach.call(rowEl.querySelectorAll('.abnach'), function (o) { o.remove(); });
      if (rowEl && le.nach[r.key]) { var nn = document.createElement('div'); nn.className = 'abnach'; nn.textContent = 'Darin enthalten (Nachzahlung oder Rückverrechnung): ' + (le.nach[r.key].sum >= 0 ? '+' : '−') + (r.unit === '€' ? eur.format(Math.abs(le.nach[r.key].sum)) : fh(Math.abs(le.nach[r.key].sum)) + ' h'); rowEl.appendChild(nn); }
      var so8 = +(le.lz && le.lz.sonder) || 0;
      if (rowEl && so8 > 0 && r.status !== 'offen') {
        var sn = null;
        if (r.key === 'lohn') sn = '<span>Dazugezählt: Sonderurlaub</span> <b>' + fh(so8) + ' h</b>';
        if (sn) { var sd = document.createElement('div'); sd.className = 'abnach'; sd.innerHTML = sn; rowEl.appendChild(sd); }
      }
    });
    freiFrage(rows);
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
      var rl = rows.filter(function (r) { return r.key === 'lohn'; })[0], ru = rows.filter(function (r) { return r.key === 'ueber'; })[0];
      if (rl && ru && (rl.status === 'gleich' || rl.status === 'klein') && (ru.status === 'weniger' || ru.status === 'mehr')) html += '<p style="margin-top:8px">' + (ru.status === 'weniger' ? 'Deine normalen Stunden stimmen. Nur bei den Überstunden steht auf dem Lohnzettel weniger. Mögliche Gründe: Die Stunden werden erst im Folgemonat abgerechnet, sie wurden als Zeitausgleich gutgeschrieben, sie sind in einer Überstundenpauschale enthalten oder sie wurden nicht bezahlt. Frag im Büro nach dieser Zeile.' : 'Deine normalen Stunden stimmen. Nur bei den Überstunden steht auf dem Lohnzettel mehr. Mögliche Gründe: Überstunden aus dem Vormonat wurden nachgezahlt, deine Firma zählt Überstunden anders (zum Beispiel pro Woche statt pro Tag) oder es ist eine Pauschale eingerechnet. Frag im Büro nach dieser Zeile.') + '</p>';
      if (ok && Math.abs(sumApp - sumLz) < 0.005) html += '<p style="margin-top:8px">Die Gesamtstunden passen. Nur die Aufteilung auf die Zeilen ist anders.</p>';
      html += '<p style="margin-top:8px">Prüfe zuerst: Sind alle Tage und Pausen richtig eingetragen? Gibt es Zeitausgleich, oder rechnet deine Firma manche Stunden erst im Folgemonat ab? Passen Zuschläge und die Zählweise der Überstunden in den Einstellungen? Bleibt der Unterschied, frage mit deiner Aufzeichnung im Büro nach. Die App ersetzt keine Rechtsberatung.</p></div>';
    }
    if (given && !E.istBau(wm) && ui.summe && ui.summe.swStd > 0 && lz.zaKonto != null && +lz.zaKonto < 0) html += '<div class="notice warn"><strong>Ausfallstunden und Zeitausgleich.</strong> In diesem Monat hast du ' + fh(ui.summe.swStd) + ' Ausfallstunden aufgeschrieben, und dein Zeitausgleich-Konto ist gesunken. Wenn dich die Firma wegen Wetter oder fehlender Arbeit heimgeschickt hat, trägt sie nach § 1155 ABGB grundsätzlich das Risiko, und Zeitausgleich muss in der Regel vereinbart sein. Das hängt vom Einzelfall und vom Kollektivvertrag ab, deshalb ist das ein Hinweis und keine Rechtsberatung. Frag bei Betriebsrat, Gewerkschaft (vida) oder Arbeiterkammer nach.</div>';
    if (lz.gelesen) html = '<div class="notice warn"><strong>Aus der PDF gelesen.</strong> Beim Lesen können Fehler passieren. Bitte vergleiche die Zahlen mit deinem Lohnzettel, bevor du dich darauf verlässt.</div>' + html;
    if (hasN(lz.satz) && wm && hasN(wm.stundenlohn) && Math.abs(+lz.satz - +wm.stundenlohn) > 0.004 && !fixLohn()) html += '<div class="notice warn"><strong>Der Stundenlohn auf dem Lohnzettel ist anders als in deinen Einstellungen.</strong><br>Lohnzettel: ' + eur.format(+lz.satz) + ' · Einstellungen: ' + eur.format(+wm.stundenlohn) + '<br>Wurde das später aufgerollt? Dann trage es bei „Nachzahlungen und Korrekturen“ ein.</div>';
    $('#ab-result').innerHTML = html;
    abBericht(rows, given, lz, bad);
    var kz = $('#ab-korr'); if (kz && !kz.contains(document.activeElement) && kz.querySelector('.rg')) renderAbKorr();
    if (given) { ins('abgleich_geprueft'); try { if (window.StundenInsights) window.StundenInsights.statistik(monthKey(), rows.filter(function (r) { return r.status !== 'offen' && r.status !== 'info'; }).map(function (r) { return { z: r.key.indexOf('pr_') === 0 ? 'praemie' : r.key, s: r.status, d: r.diff == null ? null : Math.round(r.diff * 2) / 2, e: r.unit === '€' ? 1 : 0 }; })); } catch (e) {} }
  }


  /* ============================================================ KONTEN */
  function lastMonthKey() {
    var keys = Object.keys(data.days).map(function (k) { return k.slice(0, 7); }).concat(Object.keys(data.abgleich)).sort();
    var k = keys.length ? keys[keys.length - 1] : '', t = todayISO().slice(0, 7);
    return k > t ? k : t;
  }
  function monKurz(y, m) { return '<span>' + MON[m - 1].slice(0, 3) + '</span> ' + String(y).slice(2); }
  function numIn(id, val, ph) { return '<input type="number" class="kin" id="' + id + '" inputmode="decimal" step="0.01" value="' + (val == null ? '' : esc(val)) + '" placeholder="' + (ph || '') + '" aria-label="' + esc(ph || 'Wert') + '">'; }
  function renderJahr() { // Stunden je Monat des Jahres als Balken
    var box = $('#k-jahr-chart'); if (!box) return;
    var y = ui.y, hh = [], mx = 0, i;
    for (i = 1; i <= 12; i++) { var v = 0; try { v = E.calcMonth(data, y, i, todayISO(), { ohneSpaeter: true }).summe.istStd || 0; } catch (e) { } hh.push(v); if (v > mx) mx = v; }
    if (!mx) { box.parentNode.hidden = true; return; }
    box.parentNode.hidden = false;
    var W = 340, H = 150, bw = 20, g = (W - 12 * bw) / 13, o = '<svg viewBox="0 0 ' + W + ' ' + (H + 22) + '" role="img" aria-label="' + y + '">';
    hh.forEach(function (v, k) { var bh = Math.round(v / mx * (H - 18)), bx = g + k * (bw + g); o += '<rect class="jb' + (k + 1 === ui.m ? ' cur' : '') + '" x="' + bx + '" y="' + (H - bh) + '" width="' + bw + '" height="' + bh + '" rx="3"/>' + (v ? '<text x="' + (bx + bw / 2) + '" y="' + (H - bh - 4) + '">' + Math.round(v) + '</text>' : '') + '<text x="' + (bx + bw / 2) + '" y="' + (H + 15) + '">' + (k + 1) + '</text>'; });
    box.innerHTML = o + '</svg>';
  }
  function renderKonten() {
    renderJahr();
    anRender();
    renderMia();
    renderNews();
    var p = data.profil || {};
    var kbl = $('#k-bl'), pkc = E.PAKETE[wAt(todayISO()).paket];
    if (kbl) { $('#k-blwrap').hidden = !(pkc && pkc.land === 'DE'); kbl.innerHTML = '<option value="">Bitte wählen</option>' + Object.keys(E.BUNDESLAENDER).map(function (k) { return '<option value="' + k + '"' + (p.bl === k ? ' selected' : '') + '>' + E.BUNDESLAENDER[k] + '</option>'; }).join(''); }
    $('#k-eintritt').value = p.eintritt || '';
    $('#k-urlaubjahr').value = p.urlaubJahr == null ? '' : p.urlaubJahr;
    $('#k-lztag').value = p.lzTag == null ? '' : p.lzTag;
    $('#k-urlaubstart').value = p.urlaubStart == null ? '' : p.urlaubStart;
    $('#k-zastart').value = p.zaStart == null ? '' : p.zaStart;
    $('#k-kmvortag').checked = p.kmVortag !== false;
    try { var kl = $('#k-kmvortag').closest('label'); if (kl) kl.hidden = !E.bausteine(wAt(todayISO())).fahrzeug; } catch (e) { }
    var lk = lastMonthKey(), ly = +lk.slice(0, 4), lm = +lk.slice(5, 7);
    // Urlaubskartei
    var uk = E.urlaubKartei(data, p, ly, lm);
    if (!uk.length) $('#k-urlaub').innerHTML = '<p class="hint">Trage oben dein Eintrittsdatum ein, dann erscheint die Kartei.</p>';
    else $('#k-urlaub').innerHTML = '<table class="cmp"><thead><tr><th>Monat</th><th>Anspruch</th><th>Genommen</th><th>Resturlaub</th><th>Laut Lohnzettel</th></tr></thead><tbody>' +
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
    $('#k-za').innerHTML = zrows.length ? '<table class="cmp"><thead><tr><th>Monat</th><th>Stunden dazu/weg</th><th>Konto neu</th><th>Laut Lohnzettel</th></tr></thead><tbody>' +
      zrows.map(function (r) {
        var chk = r.zettel != null ? (Math.abs(r.zettel - r.saldo) < 0.005 ? ' <span class="ok">✓</span>' : ' <span class="no">✗</span>') : '';
        return '<tr><td>' + monKurz(+r.key.slice(0, 4), +r.key.slice(5, 7)) + '</td><td>' + (r.ver >= 0 ? '+' : '−') + fh(Math.abs(r.ver)) + ' h</td><td><strong>' + fh(r.saldo) + ' h</strong></td><td>' + numIn('kz-' + r.key, r.zettel, 'Stand') + chk + '</td></tr>';
      }).join('') + '</tbody></table>' : '<p class="hint">Noch keine Buchung. Trage im Monatsabgleich die Zeile „Zeitausgleich-Konto“ ein, wenn dein Lohnzettel Zeitausgleich-Stunden zeigt.</p>';
    korrUeberblick(); renderSonder();
    // Überstunden im Überblick
    var orows = ueberRows();
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
    if (id === 'k-lztag') { data.profil.lzTag = (val >= 1 && val <= 31) ? Math.round(val) : null; delete data.profil.test; save(); return true; }
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
  var PR_EINHEIT = [['stunde', 'je Stunde (automatisch)'], ['taet', 'je Stunde einer Tätigkeit (z. B. Kran)'], ['tag', 'je Tag (Ein/Aus)'], ['stueck', 'je Stück (Anzahl)'], ['tour', 'je Tour (Anzahl)'], ['monat', 'einmal pro Monat']];
  function praemienListe() { if (!data.profil) data.profil = {}; if (!data.profil.praemien) data.profil.praemien = []; return data.profil.praemien; }
  function renderPraemienSettings() {
    var list = praemienListe();
    $('#pr-list').innerHTML = list.length ? list.map(function (p, i) {
      return '<div class="prblock">' +
        '<div class="field pn"><label for="pr-n' + i + '">Name der Prämie</label><input type="text" id="pr-n' + i + '" data-pr="' + i + '" data-pf="name" maxlength="60" autocomplete="off" value="' + esc(p.name || '') + '"></div>' +
        '<button type="button" class="rm" data-rmpr="' + i + '" aria-label="Prämie ' + (i + 1) + ' entfernen">×</button>' +
        '<div class="field"><label for="pr-b' + i + '">' + (p.teile && p.teile.length ? 'Summe der Teile (€)' : 'Betrag (€)') + '</label><input type="number" id="pr-b' + i + '" data-pr="' + i + '" data-pf="betrag" inputmode="decimal" step="0.01" min="0"' + (p.teile && p.teile.length ? ' readonly' : '') + ' value="' + esc(p.betrag == null ? '' : p.betrag) + '"></div>' +
        (p.teile && p.teile.length ? p.teile.map(function (tl, j) { return '<div class="field pn"><label for="pr-tn' + i + '-' + j + '">Name des Teils</label><input type="text" id="pr-tn' + i + '-' + j + '" data-pr="' + i + '" data-pj="' + j + '" data-pf="name" maxlength="60" autocomplete="off" value="' + esc(tl.name || '') + '"></div><div class="field"><label for="pr-tb' + i + '-' + j + '">Betrag des Teils (€)</label><input type="number" id="pr-tb' + i + '-' + j + '" data-pr="' + i + '" data-pj="' + j + '" data-pf="betrag" inputmode="decimal" step="0.01" min="0" value="' + (+tl.betrag > 0 ? esc(tl.betrag) : '') + '"></div><button type="button" class="btn" data-rmtl="' + i + '.' + j + '">Teil entfernen</button>'; }).join('') : '') +
        (p.einheit === 'monat' ? '<button type="button" class="btn" data-addtl="' + i + '">' + (p.teile && p.teile.length ? '+ Teil hinzufügen' : 'Aus mehreren Teilen zusammensetzen') + '</button>' : '') +
        '<div class="field"><label for="pr-e' + i + '">Wofür</label><select id="pr-e' + i + '" data-pr="' + i + '" data-pf="einheit">' + PR_EINHEIT.map(function (e) { return '<option value="' + e[0] + '"' + (p.einheit === e[0] ? ' selected' : '') + '>' + e[1] + '</option>'; }).join('') + '</select></div>' +
        (p.einheit === 'taet' ? '<div class="field pn"><label for="pr-t' + i + '">Name der Tätigkeit (so wie du sie beim Kunden einträgst)</label><input type="text" id="pr-t' + i + '" data-pr="' + i + '" data-pf="taet" maxlength="40" autocomplete="off" value="' + esc(p.taet || '') + '"><small>Diese Tätigkeit trägst du beim Kunden ein. Beim Eintragen erscheint sie als Button zum Antippen, so passiert kein Tippfehler.</small></div>' : '') +
        '<div class="field pn"><label for="pr-r' + i + '">Wann zählt sie? (nur für dich zur Erinnerung)</label><input type="text" id="pr-r' + i + '" data-pr="' + i + '" data-pf="regel" maxlength="160" autocomplete="off" value="' + esc(p.regel || '') + '"></div>' +
        '</div>';
    }).join('') : '<p class="hint">Noch keine Prämie angelegt.</p>';
    renderPrVor();
  }
  // Häufige Zulagen je Branche zum Anklicken. Betrag bewusst leer: er steht auf dem Lohnzettel und ist je Firma verschieden.
  // Beträge Güterbeförderung: Kollektivvertrag ab 1.1.2026, Lohn- und Zulagenordnung (wko.at). Wo kein Betrag steht, ist er je Firma verschieden.
  var PR_VOR = {
    gueter: [['Nächtigungsgeld', 'tag', 'Nächte außer Haus', 15], ['Möbeltransportzulage', 'tag', 'Einsatztage mit händischer Be- und Entladung von Stücken ab 40 kg', 7.33], ['Autotransportzulage (Spezialfahrzeug)', 'tag', 'Einsatztage mit Spezialfahrzeug für Autotransporte', 7.33], ['Abfalleinsammlungszulage', 'tag', 'Einsatztage mit Abfalleinsammlung', 20.01], ['Tieflader-Zulage', 'tag', 'Einsatztage mit Tieflader, Betrag laut Lohnzettel'], ['Schwergüterzulage (250 bis 500 kg)', 'stueck', 'Je Stück und Arbeitspartie', 19.71], ['Klavier- oder Kassentransport', 'stueck', 'Je Stück und Arbeitspartie', 23.41], ['Schmutzzulage', 'tag', '10 % des KV-Lohns bei Müll, Fäkalien oder offenen Schüttgütern'], ['Leistungsprämie', 'monat', 'einmal pro Monat']],
    klein: [['Nächtigungsgeld', 'tag', 'Nächte außer Haus'], ['Leistungsprämie', 'monat', 'einmal pro Monat']],
    handel: [['Provision / Umsatzprämie', 'monat', 'einmal pro Monat'], ['Sonn- und Feiertagszuschlag', 'stunde', 'Stunden an Sonn- und Feiertagen'], ['Nachtzuschlag', 'stunde', 'Stunden nach 20 Uhr'], ['Leistungsprämie', 'monat', 'einmal pro Monat']],
    gastro: [['Nachtzuschlag', 'stunde', 'Stunden in der Nacht'], ['Sonn- und Feiertagszuschlag', 'stunde', 'Stunden an Sonn- und Feiertagen'], ['Servicepauschale / Umsatzbeteiligung', 'monat', 'einmal pro Monat'], ['Schmutzzulage', 'tag', 'Einsatztage']],
    de_handel: [['Sonn- und Feiertagszuschlag', 'stunde', 'Stunden an Sonn- und Feiertagen'], ['Nachtzuschlag', 'stunde', 'Stunden nach 20 Uhr'], ['Leistungsprämie', 'monat', 'einmal pro Monat']],
    de_gastro: [['Nachtzuschlag', 'stunde', 'Stunden in der Nacht'], ['Sonn- und Feiertagszuschlag', 'stunde', 'Stunden an Sonn- und Feiertagen'], ['Servicepauschale', 'monat', 'einmal pro Monat']],
    bau: [['SEG-Zulage (Schmutz, Erschwernis, Gefahr)', 'stunde', 'Stunden mit erschwerten Bedingungen'], ['Tieflader-Zulage', 'tag', 'Einsatztage mit Tieflader, Betrag laut Lohnzettel'], ['Nächtigungsgeld', 'tag', 'Nächte außer Haus'], ['Leistungsprämie', 'monat', 'einmal pro Monat']]
  };
  PR_VOR.holzbau = [['Aufsichtszulage', 'stunde', 'Stunden mit Aufsicht über mehrere Mitarbeiter'], ['Schmutzzulage (10 %)', 'stunde', 'Stunden mit Schmutzarbeiten'], ['Höhen- und Gefahrenzulage', 'stunde', 'Stunden angeseilt (10 %), auf Türmen ab 16 m (15 %) oder im Gebirge'], ['Taggeld mit Übernachtung', 'tag', 'Arbeitstage mit notwendiger Übernachtung, ab 100 km', 30], ['Übernachtungsgeld', 'tag', 'Kalendertage ohne Quartier vom Betrieb, mit Nachweis', 17.53], ['Lenkzeitvergütung Mannschaftstransporter', 'stunde', 'Stunden am Steuer des Mannschaftstransporters', 15.26], ['Leistungsprämie', 'monat', 'einmal pro Monat']];
  PR_VOR.reinigung = [['Zehrgeld', 'tag', 'Einsatztage außerhalb deiner Gemeinde, mindestens 6 Stunden', 11.71], ['Trennungszulage', 'tag', 'Tage mit notwendiger Übernachtung', 19.67], ['Gefahrenzulage (10 %)', 'stunde', 'Stunden mit gefährlicher Arbeit, zum Beispiel am Seil oder mit Atemschutz'], ['Nachtzuschlag', 'stunde', 'Stunden in der Nacht'], ['Sonn- und Feiertagszuschlag', 'stunde', 'Stunden an Sonn- und Feiertagen'], ['Leistungsprämie', 'monat', 'einmal pro Monat']];
  PR_VOR.bewachung = [['Nachtzulage', 'stunde', 'Stunden in der Nacht', 1.26], ['Erschwerniszulage Revierdienst', 'stunde', 'Stunden im Revierdienst', 0.80], ['Diensthund-Aufwandsersatz', 'tag', 'Schichten mit Diensthund', 18.74], ['Sonn- und Feiertagszuschlag', 'stunde', 'Stunden an Sonn- und Feiertagen'], ['Leistungsprämie', 'monat', 'einmal pro Monat']];
  PR_VOR.sozial = [['Nachtarbeitszuschlag', 'stunde', 'Stunden von 22 bis 6 Uhr', 9.45], ['Rufbereitschaft', 'stunde', 'Stunden in Rufbereitschaft', 4.37], ['Flexibilisierungszuschlag', 'tag', 'Dienste, die kurzfristig geändert wurden', 51.30], ['SEG-Zulage (Schmutz, Erschwernis, Gefahr)', 'stunde', 'Stunden mit erschwerten Bedingungen']];
  PR_VOR.tischler = [['Montagezulage', 'stunde', 'Stunden auf Montage'], ['Taggeld Außerhausarbeit', 'stunde', 'Abwesenheitsstunden bei Außerhausarbeit über 5 Stunden', 2.50], ['Taggeld mit Übernachtung', 'tag', 'Arbeitstage mit notwendiger Übernachtung, ab 100 km', 39], ['Nächtigungsgeld', 'tag', 'Nächte außer Haus', 15], ['Leistungsprämie', 'monat', 'einmal pro Monat']];
  PR_VOR.dachdecker = [['Gefahren- und Erschwerniszulage', 'stunde', 'Stunden auf Türmen, am Fahrstuhl oder im Schnee, Prozentsatz je Bundesland'], ['Schmutzzulage', 'stunde', 'Stunden mit Schmutzarbeiten'], ['Werkzeugzulage', 'stunde', 'Stunden mit eigenem Werkzeug'], ['Trennungsgeld', 'tag', 'Kalendertage ohne tägliche Heimkehr', 30], ['Lenkzeitvergütung Mannschaftstransporter', 'stunde', 'Stunden am Steuer des Mannschaftstransporters', 15.42], ['Leistungsprämie', 'monat', 'einmal pro Monat']];
  PR_VOR.pflasterer = [['Taggeld mit Übernachtung', 'tag', 'Arbeitstage mit notwendiger Übernachtung, ab 100 km', 30], ['Übernachtungsgeld', 'tag', 'Kalendertage ohne Quartier vom Betrieb, mit Nachweis', 17.55], ['Lenkzeitvergütung Mannschaftstransporter', 'stunde', 'Stunden am Steuer des Mannschaftstransporters', 15.42], ['Akkordzuschlag', 'stunde', 'Stunden in Akkordarbeit'], ['Leistungsprämie', 'monat', 'einmal pro Monat']];
  PR_VOR.fliesenleger = [['Helferzulage bei Akkord-Fliesenleger', 'stunde', 'Stunden als Helfer beim Akkord-Fliesenleger'], ['Taggeld mit Übernachtung', 'tag', 'Arbeitstage mit notwendiger Übernachtung', 30], ['Nächtigungsgeld', 'tag', 'Nächte außer Haus', 12], ['Lenkzeitvergütung Mannschaftstransporter', 'stunde', 'Stunden am Steuer des Mannschaftstransporters', 15.31], ['Leistungsprämie', 'monat', 'einmal pro Monat']];
  PR_VOR.maler = [['Schmutz- und Erschwerniszulage (10 % oder 20 %)', 'stunde', 'Stunden mit Erschwernis, zum Beispiel ab 4 m Standhöhe, Betrag laut Lohnzettel'], ['Aufsichtszulage', 'stunde', 'Stunden mit Aufsicht über mehrere Mitarbeiter'], ['Nächtigungsgeld', 'tag', 'Nächte außer Haus', 10], ['Lenkzeitvergütung Mannschaftstransporter', 'stunde', 'Stunden am Steuer des Mannschaftstransporters', 15.42], ['Leistungsprämie', 'monat', 'einmal pro Monat']];
  PR_VOR.metall = [['Montagezulage', 'stunde', 'Stunden auf Montage (mindestens 1,155 € laut KV, nicht für Lehrlinge)', 1.155], ['Nachtarbeitszulage', 'stunde', 'Normalstunden von 22 bis 6 Uhr, nicht für Überstunden', 3.348], ['Schichtzulage 2. Schicht', 'stunde', 'Stunden in der 2. Schicht', 1.065], ['Schichtzulage 3. Schicht', 'stunde', 'Stunden in der 3. Schicht', 3.348], ['Schmutz-, Erschwernis- oder Gefahrenzulage', 'stunde', 'Stunden mit erschwerten Bedingungen', 0.746], ['Entfernungszulage über 6 Stunden', 'tag', 'Einsatztage mit mehr als 6 Stunden Abwesenheit', 11.94], ['Entfernungszulage über 11 Stunden', 'tag', 'Einsatztage mit mehr als 11 Stunden Abwesenheit', 30], ['Entfernungszulage mit Nächtigung', 'tag', 'Einsatztage mit auswärtiger Nächtigung', 62.04], ['Nächtigungsgeld', 'tag', 'Nächte außer Haus', 22.05], ['Leistungsprämie', 'monat', 'einmal pro Monat']];
  function renderPrVor() {
    var w = wAt(todayISO()), k = w && PR_VOR[w.paket] ? w.paket : null, box = $('#pr-vor'), h = $('#pr-vorh');
    if (!box) return;
    var have = praemienListe().map(function (p) { return p.name; }), list = k ? PR_VOR[k].filter(function (x) { return have.indexOf(x[0]) < 0; }) : [];
    h.hidden = !list.length;
    box.innerHTML = list.map(function (x, i) { return '<button type="button" class="chip" data-prvor="' + i + '">' + esc(x[0]) + '</button>'; }).join('');
    box._list = list;
  }
  /* ---- Dienste: Bereitschaft, Notdiensteinsatz und eigene, frei bezahlt ---- */
  var DS_EINHEIT = [['tag', 'je Tag (Ein/Aus)'], ['stunde', 'je Stunde (Anzahl)'], ['einsatz', 'je Einsatz (Anzahl)']];
  var DS_KURZ = { tag: 'Tage', stunde: 'Stunden', einsatz: 'Einsätze' };
  function diensteListe() { if (!data.profil) data.profil = {}; if (!data.profil.dienste) data.profil.dienste = []; return data.profil.dienste; }
  function dsNeu(art, name) {
    diensteListe().push({ id: 'd' + Date.now().toString(36) + Math.floor(Math.random() * 1000).toString(36), name: name, art: art, einheit: art === 'notdienst' ? 'einsatz' : 'tag', betrag: 0, regel: '' });
    ins('dienst_neu_' + art); save(); renderDiensteSettings();
  }
  function renderDiensteSettings() {
    var list = diensteListe();
    $('#ds-list').innerHTML = list.length ? list.map(function (p, i) {
      return '<div class="prblock">' +
        '<div class="field pn"><label for="ds-n' + i + '">Name des Dienstes</label><input type="text" id="ds-n' + i + '" data-ds="' + i + '" data-df="name" maxlength="60" autocomplete="off" value="' + esc(p.name || '') + '"></div>' +
        '<button type="button" class="rm" data-rmds="' + i + '" aria-label="Dienst ' + (i + 1) + ' entfernen">×</button>' +
        '<div class="field"><label for="ds-b' + i + '">Betrag (€), wenn bekannt</label><input type="number" id="ds-b' + i + '" data-ds="' + i + '" data-df="betrag" inputmode="decimal" step="0.01" min="0" value="' + (+p.betrag > 0 ? esc(p.betrag) : '') + '"></div>' +
        '<div class="field"><label for="ds-e' + i + '">Wofür</label><select id="ds-e' + i + '" data-ds="' + i + '" data-df="einheit">' + DS_EINHEIT.map(function (e) { return '<option value="' + e[0] + '"' + (p.einheit === e[0] ? ' selected' : '') + '>' + e[1] + '</option>'; }).join('') + '</select></div>' +
        '<div class="field pn"><label for="ds-r' + i + '">Wann zählt er? (nur für dich zur Erinnerung)</label><input type="text" id="ds-r' + i + '" data-ds="' + i + '" data-df="regel" maxlength="160" autocomplete="off" value="' + esc(p.regel || '') + '"></div>' +
        '</div>';
    }).join('') : '<p class="hint">Noch kein Dienst angelegt.</p>';
    var have = list.map(function (p) { return p.name; });
    $$('#ds-vor [data-dsneu]').forEach(function (b) { b.hidden = have.indexOf(b.textContent) >= 0; });
  }
  function renderDiensteTag() {
    var list = diensteListe().filter(function (p) { return p.name; }), d = ui.edDraft, dm = d.dienste || {};
    $('#e-dienstgroup').hidden = !list.length;
    $('#e-dienste').innerHTML = list.map(function (p) {
      var v = dm[p.id];
      if (p.einheit === 'tag') return '<label class="check"><input type="checkbox" data-dd="' + esc(p.id) + '"' + (v > 0 ? ' checked' : '') + '> ' + esc(p.name) + '</label>';
      return '<div class="field"><label for="dd-' + esc(p.id) + '">' + esc(p.name) + (p.einheit === 'stunde' ? ' (Stunden)' : ' (Anzahl)') + '</label><input type="number" id="dd-' + esc(p.id) + '" data-dd="' + esc(p.id) + '" inputmode="decimal" min="0" step="' + (p.einheit === 'stunde' ? '0.5' : '1') + '" value="' + (v > 0 ? esc(v) : '') + '"></div>';
    }).join('');
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
  // Tätigkeiten aus deinen Prämien zum Antippen, damit kein Tippfehler die Prämie verpasst
  function tatChips(cur, sfx) {
    var c = String(cur || '').trim().toLowerCase(), seen = {};
    return praemienListe().filter(function (p) { return p.einheit === 'taet' && p.name && (p.taet || '').trim(); }).filter(function (p) {
      var kw = p.taet.trim().toLowerCase(); if (seen[kw]) return false; seen[kw] = 1; return c.indexOf(kw) < 0;
    }).map(function (p) { return '<button type="button" class="chip" data-tchip="' + esc(p.taet.trim()) + '" data-tcs="' + sfx + '">' + esc(p.taet.trim()) + '</button>'; }).join('');
  }
  function renderKunden() {
    var tour = E.istTour(wAt(ui.edDate || todayISO()));
    $('#e-kunden').innerHTML = ui.edDraft.kunden.map(function (k, i) {
      var rows = (k.taet || []).map(function (t, j) {
        var sfx = i + '-' + j;
        return '<div class="taet">' +
          '<div class="field kn"><label for="k-t' + sfx + '">Tätigkeit' + (k.taet.length > 1 ? ' ' + (j + 1) : '') + '</label><input type="text" id="k-t' + sfx + '" data-k="' + i + '" data-j="' + j + '" data-f="tat" maxlength="120" list="e-tat-list" autocomplete="off" value="' + esc(t.tat || '') + '"><div class="chips tchips" data-tc="' + sfx + '">' + tatChips(t.tat, sfx) + '</div></div>' +
          '<div class="field"><label for="k-v' + sfx + '">von</label><input type="text" readonly inputmode="none" data-time="1" placeholder="--:--" id="k-v' + sfx + '" data-k="' + i + '" data-j="' + j + '" data-f="von" value="' + esc(t.von || '') + '"></div>' +
          '<div class="field"><label for="k-b' + sfx + '">bis</label><input type="text" readonly inputmode="none" data-time="1" placeholder="--:--" id="k-b' + sfx + '" data-k="' + i + '" data-j="' + j + '" data-f="bis" value="' + esc(t.bis || '') + '"></div>' +
          (k.taet.length > 1 ? '<button type="button" class="rm" data-rmt="' + i + '-' + j + '" aria-label="Tätigkeit ' + (j + 1) + ' entfernen">×</button>' : '<span></span>') + '</div>';
      }).join('');
      return '<div class="kunde2">' +
        '<div class="khead"><div class="field kn"><label for="k-n' + i + '">' + (tour ? 'Tour' : 'Kunde / Baustelle') + ' ' + (i + 1) + '</label><input type="text" id="k-n' + i + '" data-k="' + i + '" data-f="name" maxlength="120" list="e-notiz-list" autocomplete="off" value="' + esc(k.name || '') + '"></div>' +
        '<button type="button" class="rm" data-rmk="' + i + '" aria-label="' + (tour ? 'Tour' : 'Kunde') + ' ' + (i + 1) + ' entfernen">×</button></div>' +
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
    if (d.swOn === undefined && +d.sw > 0) { d.swOn = true; d.swAuto = false; } // alte Einträge: Wert nicht überschreiben
    $('#e-sw').value = d.sw ? d.sw : ''; $('#e-swon').checked = !!d.swOn; $('#e-swgrund').value = d.swGrund || ''; $('#e-swbox').hidden = !d.swOn;
    $('#e-erx').value = d.status === 'ersatzruhe' && d.extra ? d.extra : ''; $('#e-erbox').hidden = d.status !== 'ersatzruhe';
    $('#e-fv').value = d.status === 'freistellung' && d.fv ? d.fv : ''; $('#e-frbox').hidden = d.status !== 'freistellung';
    $('#e-extra').value = d.extra ? d.extra : ''; $('#e-extra-box').open = !!d.extra; $('#e-extra-box').hidden = !d.extra;
    renderAn();
    var seen = {}, opts = '';
    Object.keys(data.days).forEach(function (k) { var dd = data.days[k]; (dd.kunden ? kundenNamen(dd) : (dd.notiz ? [dd.notiz.trim()] : [])).forEach(function (n) { seen[n] = (seen[n] || 0) + 1; }); });
    Object.keys(seen).sort(function (x, y) { return seen[y] - seen[x] || (x < y ? -1 : 1); }).slice(0, 30).forEach(function (n) { opts += '<option value="' + esc(n) + '">'; });
    var ts = {}, ks = {}, topt = '', kopt = '';
    Object.keys(data.days).forEach(function (k) { var dd = data.days[k]; (dd.kunden || []).forEach(function (x) { (x.taet || [x]).forEach(function (y) { if (y.tat) ts[y.tat] = (ts[y.tat] || 0) + 1; }); }); fahrzeugeVon(dd).forEach(function (f) { if (f.kfz) ks[f.kfz] = (ks[f.kfz] || 0) + 1; }); });
    praemienListe().forEach(function (p) { if (p.einheit === 'taet' && (p.taet || '').trim()) { topt += '<option value="' + esc(p.taet.trim()) + '">'; delete ts[p.taet.trim()]; } });
    Object.keys(ts).sort(function (x, y) { return ts[y] - ts[x]; }).slice(0, 30).forEach(function (n) { topt += '<option value="' + esc(n) + '">'; });
    Object.keys(ks).sort(function (x, y) { return ks[y] - ks[x]; }).slice(0, 10).forEach(function (n) { kopt += '<option value="' + esc(n) + '">'; });
    if (!$('#e-tat-list')) { var dl = document.createElement('datalist'); dl.id = 'e-tat-list'; $('#e-kunden').parentNode.appendChild(dl); }
    $('#e-tat-list').innerHTML = topt; $('#f-kfz-list').innerHTML = kopt;
    renderFahrzeuge(); renderPraemienTag(); renderDiensteTag();
    $('#e-notiz-list').innerHTML = opts; // Vorschläge aus früheren Einträgen
    if ($('#e-spaeter')) $('#e-spaeter').checked = !!d.spaeter;
    $('#e-swgroup').hidden = !w.schlechtwetter;
    var bau = E.istBau(w); $('#e-swlbl').textContent = bau ? 'Schlechtwetterstunden' : 'Ausfallstunden'; $('#e-swonl').textContent = bau ? 'Schlechtwetter an diesem Tag' : 'Ich wurde früher heimgeschickt';
    var bsx = E.bausteine(w); $('#e-fzgroup').hidden = !bsx.fahrzeug; $('#e-kgroup').hidden = !bsx.kunden;
    var tr1 = E.istTour(w); $('#e-klbl').textContent = tr1 ? 'Touren mit Tätigkeiten (optional)' : 'Kunden / Baustellen mit Tätigkeiten (optional)'; $('#e-addkunde').textContent = tr1 ? '+ Tour hinzufügen' : '+ Kunde / Baustelle hinzufügen';
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
    if (d.swOn && d.swAuto !== false && w.schlechtwetter && d.status === 'arbeit') { // Ausfallstunden = normale Tagesstunden minus gearbeitete Stunden
      var restSw = Math.max(0, Math.floor((Math.round(E.sollFuer(w.ueberstunden, E.weekday(ui.edDate)) * 60) - r.nettoMin) / 30) / 2);
      if (+d.sw !== restSw) { d.sw = restSw; r = E.calcDay(d, ui.edDate, w); }
      var swi = $('#e-sw'); if (swi && document.activeElement !== swi) swi.value = d.sw || '';
    }
    $('#e-diaeten').placeholder = 'Vorschlag';
    (function () {
      var kh = '', kz = E.kundenZeiten(d, w, ui.edDate);
      if (kz.rows.some(function (x) { return x.min !== null; })) {
        kh += '<div class="kz-title">' + (E.istTour(w) ? 'Zeit pro Tour' : 'Zeit pro Kunde') + '</div>';
        kz.rows.forEach(function (x) {
          kh += line('<button type="button" class="kzlink" data-kz="' + x.ki + '"><strong>' + esc(x.name || (E.istTour(w) ? 'Ohne Tour' : 'Ohne Kunde')) + '</strong></button>', x.min === null ? 'Zeit fehlt' : hm(x.min) + ' h');
          if (x.taet.length > 1 || (x.taet.length === 1 && x.taet[0].tat && x.min !== null)) x.taet.forEach(function (y) { if (y.tat || y.min !== null) kh += line('<button type="button" class="kzlink kz-sub" data-kz="' + x.ki + '" data-kj="' + y.j + '">' + esc(y.tat || 'Tätigkeit') + '</button>', y.min === null ? '–' : hm(y.min) + ' h'); });
        });
        if (kz.rows.length > 1) kh += line('Zusammen', hm(kz.totalMin) + ' h', true);
      }
      $('#e-kz').innerHTML = d.status === 'arbeit' ? kh : '';
    })();
    var sg = $('#e-bis-sugg'), te = (d.status === 'arbeit' && d.von && !d.bis) ? typischesEnde(ui.edDate) : null;
    sg.hidden = !te; if (te) { sg.textContent = 'Meistens bis ' + te + ' (übernehmen)'; sg.dataset.t = te; }
    if (d.status !== 'arbeit') {
      if (r.creditMin) html = line('Gutgeschrieben', fh(r.creditMin / 60) + ' h', true) + '<p class="hint">Bezahlte Abwesenheit. Sie erzeugt keine Überstunden.</p>';
      else if (d.status === 'freistellung' && r.freiModus === 'za') html = '<p class="hint">Deine Firma zieht diesen Tag vom Zeitausgleich ab. Laut AK-Grundregel wäre er bezahlt.</p>';
      else if (d.status === 'freistellung' && r.freiModus === 'unbezahlt') html = '<p class="hint">Deine Firma zahlt diesen Tag nicht. Laut AK-Grundregel wäre er bezahlt.</p>';
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
        if (w.ueberstunden.modell === 'gleit') html += line('Gleitzeitsaldo', 'wird je Monat berechnet');
        if (w.diaeten.modell !== 'aus') {
          var auto = E.calcDay(Object.assign({}, d, { diaeten: null }), ui.edDate, w).diaetenStd;
          html += line('Diätenstunden', fh(r.diaetenStd) + ' h');
          html += line('Diäten', eur.format(r.diaetenBetrag));
          $('#e-diaeten').placeholder = 'Vorschlag ' + fh(auto);
        }
      }
      var prl = E.praemienDay(d, r, praemienListe(), w);
      if (prl.length) { html += '<div class="kz-title">Prämien</div>'; prl.forEach(function (x) { html += line(esc(x.name) + (x.einheit === 'stunde' ? ' · ' + fh(x.menge) + ' h' : x.menge !== 1 ? ' · ' + nfp.format(x.menge) + 'x' : ''), eur.format(x.euro)); }); }
      if (r.swMin) html += line(E.istBau(w) ? 'Schlechtwetter' : 'Ausfallstunden', fh(r.swMin / 60) + ' h');
      if (r.extraMin) html += line('Zusätzlich bezahlt', '+ ' + fh(r.extraMin / 60) + ' h');
      if (r.nettoMin / 60 > 12) warn += '<div class="notice warn">Mehr als 12 Arbeitsstunden an einem Tag. Bitte prüfe die Zeiten.</div>';
      if (r.dstMin) warn += '<div class="notice">' + (r.dstMin > 0 ? 'Zeitumstellung: In dieser Nacht wird die Uhr um eine Stunde zurückgestellt, die zusätzliche Stunde ist mitgerechnet.' : 'Zeitumstellung: In dieser Nacht wird die Uhr um eine Stunde vorgestellt, die fehlende Stunde ist abgezogen.') + '</div>';
      r.warn.forEach(function (m) { warn += '<div class="notice warn">' + esc(m) + '</div>'; });
    }
    $('#e-preview').innerHTML = html;
    $('#e-warn').innerHTML = warn;
  }

  /* ---- Notiz zum Tag: Text, wie es zu dem Tag kam, und Zeitstempel (damit man Monate später noch weiß, was war) ---- */
  function anBraucht(d) { return ['urlaub', 'za', 'freistellung', 'ersatzruhe', 'betriebsurlaub', 'frei'].indexOf(d.status) >= 0 || (d.status === 'arbeit' && +d.sw > 0); }
  function fmtStamp(iso) { var x = new Date(iso); if (isNaN(x)) return ''; return x.toLocaleDateString('de-AT') + ' um ' + x.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' }); }
  var FREI_ALT = [ // frühere Vorschlagstexte (ohne "Ich war arbeitsbereit."), damit schon gespeicherte Vorschläge weiter mitwechseln
    'Die Firma hat mich für diesen Tag freigestellt, weil es keine Arbeit gab.',
    'Die Firma hat mich für diesen Tag in Zeitausgleich geschickt, weil es keine Arbeit gab. Der Tag wird von meinem Zeitausgleichskonto abgezogen. Angeordnet von der Firma.',
    'Die Firma hat mich für diesen Tag freigestellt, weil es keine Arbeit gab. Die Firma zahlt den Tag normal weiter.',
    'Die Firma hat mich für diesen Tag freigestellt, weil es keine Arbeit gab. Der Tag ist unbezahlt.'
  ];
  var AN_TEXT = { wunsch: 'Dieser Tag war mein Wunsch.', verein: 'Dieser Tag wurde mit der Firma vereinbart.', firma: 'Die Firma hat diesen Tag angeordnet.' };
  function anIstVorlage(t) {
    t = (t || '').trim();
    return !t || Object.keys(AN_TEXT).some(function (k) { return AN_TEXT[k] === t; }) || Object.keys(FREI_NOTE).some(function (k) { return FREI_NOTE[k] === t; }) || FREI_ALT.indexOf(t) >= 0;
  }
  function anVorschlag(w) { // Notiztext passt sich der Auswahl an, aber nur wenn er leer oder noch ein Vorschlag ist (eigener Text bleibt)
    var d = ui.edDraft; if (!d.an) d.an = {};
    if (!anIstVorlage(d.an.t)) return;
    var neu = !w ? '' : (w === 'firma' && d.status === 'freistellung') ? FREI_NOTE[freiMode()] : AN_TEXT[w];
    if (neu) d.an.t = neu; else delete d.an.t;
    $('#e-an').value = d.an.t || '';
  }
  function freiMode() {
    var d = ui.edDraft, w = wAt(ui.edDate || todayISO()), m = d.fv || (w && w.freiVerr) || 'offen';
    return m;
  }
  var FREI_NOTE = {
    za: 'Die Firma hat mich für diesen Tag in Zeitausgleich geschickt, weil es keine Arbeit gab. Der Tag wird von meinem Zeitausgleichskonto abgezogen. Angeordnet von der Firma. Ich war arbeitsbereit.',
    bezahlt: 'Die Firma hat mich für diesen Tag freigestellt, weil es keine Arbeit gab. Die Firma zahlt den Tag normal weiter. Ich war arbeitsbereit.',
    unbezahlt: 'Die Firma hat mich für diesen Tag freigestellt, weil es keine Arbeit gab. Der Tag ist unbezahlt. Ich war arbeitsbereit.',
    offen: 'Die Firma hat mich für diesen Tag freigestellt, weil es keine Arbeit gab. Ich war arbeitsbereit.'
  };
  function freiNote() {
    var d = ui.edDraft, w = wAt(ui.edDate || todayISO()), m = d.fv || (w && w.freiVerr) || 'offen';
    var an = d.an || {}, t = (an.t || '').trim(), preset = Object.keys(FREI_NOTE).some(function (k) { return FREI_NOTE[k] === t; }) || t === 'Die Firma hat mich für diesen Tag freigestellt, weil es keine Arbeit gab.';
    if (t && !preset) return;
    d.an = { w: 'firma', t: FREI_NOTE[m] }; renderAn();
  }
  function renderAn() {
    var d = ui.edDraft, an = d.an || {};
    $('#e-an').value = an.t || '';
    $('#e-an-box').open = !!(an.t || an.w);
    anChips();
    $('#e-an-ts').textContent = an.ts ? ('Eingetragen am ' + fmtStamp(an.ts) + (an.tm ? ', zuletzt geändert am ' + fmtStamp(an.tm) : '')) : '';
  }
  function anChips() {
    var d = ui.edDraft, an = d.an || {};
    $('#e-an-art').hidden = !anBraucht(d);
    $$('#e-an-art [data-an]').forEach(function (b) { b.setAttribute('aria-pressed', an.w === b.dataset.an ? 'true' : 'false'); });
  }
  function anSet(k, v) {
    var d = ui.edDraft; if (!d.an) d.an = {};
    if (v) d.an[k] = v; else delete d.an[k];
  }
  function anFinal(out, alt) { // Zeitstempel setzen: beim ersten Eintrag "ts", bei späterer Änderung "tm"
    var an = out.an || {}, t = (an.t || '').trim(), w = an.w || '';
    if (!t && !w) { delete out.an; return; }
    var n = { w: w || undefined, t: t || undefined }, now = new Date().toISOString();
    var oa = (alt && alt.an) || null;
    if (!oa || (!oa.t && !oa.w)) n.ts = now;
    else { n.ts = oa.ts || now; if (oa.st) n.st = oa.st; if ((oa.t || '') !== t || (oa.w || '') !== w) n.tm = now; else { if (oa.tm) n.tm = oa.tm; if (oa.sm) n.sm = oa.sm; } }
    if (!n.w) delete n.w; if (!n.t) delete n.t;
    out.an = n;
  }

  var AN_ART = { wunsch: 'Ich habe es gewünscht', verein: 'Mit der Firma vereinbart', firma: 'Die Firma hat es angeordnet' };
  function anListe() {
    return Object.keys(data.days).sort().filter(function (k) { var x = data.days[k].an; return x && (x.t || x.w); }).map(function (k) {
      var d = data.days[k], x = d.an;
      return { datum: k, art: E.STATUS[d.status] ? E.STATUS[d.status].name : '', w: x.w ? AN_ART[x.w] : '', t: x.t || '', ts: x.ts ? fmtStamp(x.ts) : '', tm: x.tm ? fmtStamp(x.tm) : '', sv: (x.tm ? x.sm : x.st) ? fmtStamp(x.tm ? x.sm : x.st) : '' };
    });
  }
  function anRender() {
    var box = $('#an-list'); if (!box) return;
    var l = anListe();
    box.innerHTML = l.length ? l.map(function (x) {
      return '<div class="anrow"><strong>' + esc(fmtShort(x.datum)) + ' · ' + esc(x.art) + '</strong>' + (x.w ? '<div>' + esc(x.w) + '</div>' : '') + (x.t ? '<div>' + esc(x.t) + '</div>' : '') + '<small>Eingetragen am ' + esc(x.ts) + (x.tm ? ', geändert am ' + esc(x.tm) : '') + '</small>' + (x.sv ? '<small>Vom Server bestätigt am ' + esc(x.sv) + '</small>' : '') + '</div>';
    }).join('') : '<p class="hint">Noch keine Notizen. Du findest das Notizfeld in Erfassen bei jedem Tag.</p>';
  }
  function anText() {
    return 'Notizen zu meinen Arbeitstagen (aus dem Stunden-Checker)\n\n' + anListe().map(function (x) {
      return fmtShort(x.datum) + ' · ' + x.art + (x.w ? '\n' + x.w : '') + (x.t ? '\n' + x.t : '') + '\nEingetragen am ' + x.ts + (x.tm ? ', geändert am ' + x.tm : '') + (x.sv ? '\nVom Server bestätigt am ' + x.sv : '');
    }).join('\n\n');
  }

  document.addEventListener('sc-servertime', function (ev) { // Serverzeit für Notizen
    var d = ev.detail || {}, iso = new Date(d.ms).toISOString(), ch = false;
    Object.keys(data.days).forEach(function (k) {
      var x = data.days[k].an; if (!x) return;
      if (x.ts && !x.st && x.ts <= d.cutoff) { x.st = iso; ch = true; }
      if (x.tm && !x.sm && x.tm <= d.cutoff) { x.sm = iso; ch = true; }
    });
    if (ch) { save(); anRender(); }
  });
  /* ---- Nachfrage zu Tagen ohne Eintrag: eine Frage für den ganzen Zeitraum ---- */
  function lkKopf(t, info) {
    var h = $('#lk-h'); h.textContent = t;
    var sm = document.createElement('small'); sm.hidden = true; sm.textContent = info;
    var b = document.createElement('button'); b.type = 'button'; b.className = 'info'; b.setAttribute('aria-label', 'Info'); b._sm = sm; h.appendChild(b);
  }
  function lkMia(html) { var c = miaCfg(); setTimeout(function () { var el = $('#lk-bub'); if (el) miaSag(el.textContent); }, 50); return '<div class="lkmia"><div class="lkfig">' + miaSvg(c.figur, miaFor(), '') + '</div><div class="lkbub" id="lk-bub">' + html + '</div></div>'; }
  function artenListe() { return Object.keys(E.STATUS).filter(function (k) { return k !== 'arbeit' && k !== 'feiertag'; }).map(function (k) { return [k, E.STATUS[k].name]; }); }
  /* Feste freie Tage (z. B. Berufsschule jeden Dienstag): werden für Tage ohne Eintrag automatisch eingetragen */
  function festeAnwenden(von, bis) {
    var fl = (data.profil && data.profil.festTage) || []; if (!fl.length) return 0;
    var n = 0, d = von;
    while (d < bis) {
      if (!data.days[d]) {
        var wd = E.weekday(d), typ = E.dayTyp(d);
        fl.forEach(function (r) { if (r.von && d < r.von) return; if (r.bis && d > r.bis) return; if (!data.days[d] && +r.wd === wd && typ !== 'feiertag' && E.STATUS[r.art]) { data.days[d] = { status: r.art, fest: true }; n++; } });
      }
      d = E.addDays(d, 1);
    }
    if (n) save();
    return n;
  }
  function mehrTage() {
    var dlg = $('#lk-dlg'), body = $('#lk-body'), btns = $('#lk-btns');
    function zu() { dlg.hidden = true; }
    function neu() {
      lkKopf('Mehrere Tage eintragen', 'Trage Urlaub, Krankenstand und andere freie Tage für einen ganzen Zeitraum auf einmal ein, auch im Voraus. Tage, an denen schon etwas steht, sowie Sonntage und Feiertage bleiben unverändert.');
      body.innerHTML = lkMia('<span>Was möchtest du eintragen?</span>') + '<div class="wzlist">' + artenListe().map(function (x) { return '<button type="button" class="btn wzopt" data-mt="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div>';
      btns.innerHTML = '<button type="button" class="btn" id="lk-x">Abbrechen</button>';
      dlg.hidden = false; $('#lk-x').onclick = zu;
      body.querySelectorAll('[data-mt]').forEach(function (b) { b.onclick = function () { zeitraum(b.dataset.mt, b.textContent); }; });
    }
    function tage(a, z, st) {
      var out = [], d = a, g = 0;
      while (d <= z && g++ < 400) { var w = wAt(d), typ = E.dayTyp(d); if (!data.days[d] && typ !== 'sonntag' && typ !== 'feiertag' && E.istSollTag(w.ueberstunden, E.weekday(d))) out.push(d); d = E.addDays(d, 1); }
      return out;
    }
    function zeitraum(st, name) {
      lkKopf(name, 'Wähle den ersten und den letzten Tag. Die App trägt nur Arbeitstage ein, an denen noch nichts steht.');
      body.innerHTML = lkMia('<span>Von wann bis wann?</span>') + '<div class="field"><label for="lk-von">Von</label><input type="date" id="lk-von" value="' + todayISO() + '"></div><div class="field"><label for="lk-bis">Bis</label><input type="date" id="lk-bis" value="' + todayISO() + '"></div><p class="hint"><b id="lk-n">1</b> <span>Tage</span></p>';
      btns.innerHTML = '<button type="button" class="btn primary" id="lk-ok">Eintragen</button><button type="button" class="btn" id="lk-zur">Zurück</button>';
      function neuZahl() { var a = $('#lk-von').value, z = $('#lk-bis').value; $('#lk-n').textContent = (a && z && a <= z) ? tage(a, z, st).length : 0; }
      $('#lk-von').addEventListener('change', function () { if ($('#lk-bis').value < this.value) $('#lk-bis').value = this.value; neuZahl(); });
      $('#lk-bis').addEventListener('change', neuZahl); neuZahl();
      $('#lk-zur').onclick = neu;
      $('#lk-ok').onclick = function () {
        var a = $('#lk-von').value, z = $('#lk-bis').value; if (!a || !z || a > z) { toast('Bitte Von und Bis prüfen.'); return; }
        var l = tage(a, z, st); if (!l.length) { toast('In diesem Zeitraum gibt es nichts einzutragen.'); return; }
        l.forEach(function (t) { data.days[t] = { status: st }; }); save(); ins('mehrtage_' + st); zu(); toast('Eingetragen.'); try { renderMonat(); renderOpenDay(); } catch (e) { }
      };
    }
    neu();
  }
  function lueckenSuche(saved) {
    var ks = Object.keys(data.days).filter(function (k) { return /^\d{4}-\d{2}-\d{2}$/.test(k); }).sort();
    if (ks.length < 2 || ks[ks.length - 1] !== saved) return []; // nur wenn der neueste Tag gespeichert wurde
    var erster = ks[0], von = E.addDays(saved, -60); if (von <= erster) von = E.addDays(erster, 1);
    festeAnwenden(von, saved);
    var lk = (data.profil && data.profil.lkDone) || {}, runs = [], cur = null, d = von;
    while (d < saved) {
      var w = wAt(d), wd = E.weekday(d), typ = E.dayTyp(d);
      if (data.days[d]) cur = null;
      else if (!lk[d] && typ !== 'sonntag' && typ !== 'feiertag' && E.istSollTag(w.ueberstunden, wd)) { if (!cur) { cur = []; runs.push(cur); } cur.push(d); }
      d = E.addDays(d, 1);
    }
    return runs;
  }
  function lueckenFrage(saved) {
    if (data.profil && data.profil.lueckenFrage === false) return false;
    var runs = lueckenSuche(saved); if (!runs.length) return false;
    var dlg = $('#lk-dlg'), body = $('#lk-body'), btns = $('#lk-btns'), n = 0;
    function zu() { dlg.hidden = true; }
    function merken(tage) { if (!data.profil) data.profil = {}; var lk = data.profil.lkDone || (data.profil.lkDone = {}); tage.forEach(function (t) { lk[t] = 1; }); }
    function weiter() { runs.shift(); if (runs.length) zeigen(); else { zu(); toast('Eingetragen.'); try { renderMonat(); renderOpenDay(); } catch (e) { } } }
    function eintragen(tage, st) { tage.forEach(function (t) { if (!data.days[t]) data.days[t] = { status: st }; }); merken(tage); save(); ins('luecke_' + st); }
    var kopf = lkKopf, mia = lkMia;
    function zeigen() {
      var r = runs[0], a = r[0], z = r[r.length - 1];
      kopf('Nichts eingetragen', 'Wähle, was an diesen Tagen war. Ich trage sie dann so ein. Wenn du gearbeitet hast, bringe ich dich zum ersten fehlenden Tag, damit du ihn nachtragen kannst.');
      var arten = artenListe(); arten.push(['arbeit', 'Ich habe gearbeitet']);
      body.innerHTML = mia('<b>' + esc(r.length > 1 ? fmtShort(a) + ' – ' + fmtShort(z) : fmtShort(a)) + '</b>' + (r.length > 1 ? '<br><span class="hint"><b>' + r.length + '</b> <span>Arbeitstage</span></span>' : '') + '<br><span>Was war da?</span>') +
        '<div class="wzlist">' + arten.map(function (x) { return '<button type="button" class="btn wzopt" data-lk="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div>';
      btns.innerHTML = '<button type="button" class="btn" id="lk-spaeter">Später</button>';
      dlg.hidden = false; $('#lk-spaeter').onclick = zu;
      body.querySelectorAll('[data-lk]').forEach(function (b) { b.onclick = function () { wahl(b.dataset.lk, b.textContent); }; });
    }
    function wahl(st, name) {
      var r = runs[0];
      if (st === 'arbeit') { merken(r); save(); zu(); openEditor(r[0], 'erfassen'); toast('Hier kannst du den Tag nachtragen.'); return; }
      if (r.length === 1) { eintragen(r, st); weiter(); return; }
      kopf(name, 'Wenn nur ein Teil der Tage so war, wähle den letzten Tag davon. Nach den übrigen Tagen frage ich gleich noch einmal.');
      body.innerHTML = mia('<span>Bis wann?</span>') + '<select id="lk-bis" aria-label="Bis wann?">' + r.map(function (t, i) { return '<option value="' + i + '"' + (i === r.length - 1 ? ' selected' : '') + '>' + esc(fmtShort(t)) + '</option>'; }).join('') + '</select><p class="hint"><b id="lk-n">' + r.length + '</b> <span>Tage</span></p>';
      btns.innerHTML = '<button type="button" class="btn primary" id="lk-ok">Eintragen</button><button type="button" class="btn" id="lk-zur">Zurück</button>';
      $('#lk-bis').onchange = function () { $('#lk-n').textContent = (+this.value + 1); };
      $('#lk-zur').onclick = zeigen;
      $('#lk-ok').onclick = function () { var k = +$('#lk-bis').value + 1; eintragen(r.slice(0, k), st); var rest = r.slice(k); runs.shift(); if (rest.length) runs.unshift(rest); if (runs.length) zeigen(); else { zu(); toast('Eingetragen.'); try { renderMonat(); renderOpenDay(); } catch (e) { } } };
    }
    zeigen(); return true;
  }
  /* ---- Feste freie Tage (Einstellungen) ---- */
  var FEST_TAGE = [[1, 'Montag'], [2, 'Dienstag'], [3, 'Mittwoch'], [4, 'Donnerstag'], [5, 'Freitag'], [6, 'Samstag'], [0, 'Sonntag']];
  function festListe() { if (!data.profil) data.profil = {}; return data.profil.festTage || (data.profil.festTage = []); }
  function renderFest() {
    var el = $('#fest-list'); if (!el) return;
    el.innerHTML = festListe().map(function (r, i) {
      return '<div class="festrow"><select data-fi="' + i + '" data-f="wd" aria-label="Wochentag">' + FEST_TAGE.map(function (x) { return '<option value="' + x[0] + '"' + (+r.wd === x[0] ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') + '</select>' +
        '<select data-fi="' + i + '" data-f="art" aria-label="Art des Tages">' + artenListe().map(function (x) { return '<option value="' + x[0] + '"' + (r.art === x[0] ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') + '</select>' +
        '<button type="button" class="btn" data-fx="' + i + '" aria-label="Entfernen">×</button>' +
        '<div class="festdates"><label>Gilt von (optional)<input type="date" data-fi="' + i + '" data-f="von" value="' + esc(r.von || '') + '"></label><label>Gilt bis (optional)<input type="date" data-fi="' + i + '" data-f="bis" value="' + esc(r.bis || '') + '"></label></div></div>';
    }).join('');
  }
  (function () {
    var el = $('#fest-list'); if (!el) return;
    el.addEventListener('change', function (ev) { var s = ev.target.closest('[data-fi]'); if (!s) return; var r = festListe()[+s.dataset.fi]; if (!r) return; if (s.dataset.f === 'von' || s.dataset.f === 'bis') { if (s.value) r[s.dataset.f] = s.value; else delete r[s.dataset.f]; delete r.ende; } else r[s.dataset.f] = s.dataset.f === 'wd' ? +s.value : s.value; save(); });
    el.addEventListener('click', function (ev) { var b = ev.target.closest('[data-fx]'); if (!b) return; festListe().splice(+b.dataset.fx, 1); save(); renderFest(); });
    $('#fest-add').addEventListener('click', function () { festListe().push({ wd: 2, art: 'schule' }); save(); renderFest(); });
    $('#e-mehr').addEventListener('click', mehrTage);
  })();
  function saveDay() {
    var d = ui.edDraft, st = d.status;
    if (st === 'arbeit') {
      if (!d.von && d.bis) { toast('Es fehlt der Beginn.'); return false; }
      if (!d.von && !(+d.sw > 0)) { toast(data.days[ui.edDate] ? 'Beginn fehlt. Soll der Tag leer sein? Dann tippe unten auf „Tag löschen“.' : 'Bitte mindestens den Beginn eintragen.'); return false; } // das Ende darf noch fehlen: Dienst läuft
    }
    var out = E.clone(d);
    if (st !== 'freistellung') delete out.fv;
    out.sw = out.swOn ? (+out.sw || 0) : 0; if (!out.swOn) { delete out.swOn; delete out.swGrund; delete out.swAuto; }
    out.diaeten = (out.diaeten === null || out.diaeten === '' || isNaN(+out.diaeten)) ? null : +out.diaeten;
    out.pausen = (out.pausen || []).filter(function (p) { return p.von && p.bis; });
    if (st !== 'arbeit') { out.von = ''; out.bis = ''; out.pausen = []; out.kunden = []; out.diaeten = null; out.sw = 0; delete out.swOn; delete out.swGrund; delete out.swAuto; out.notiz = ''; out.spaeter = false; }
    out.kunden = (out.kunden || []).map(function (k) { return { name: (k.name || '').trim(), taet: (k.taet || []).map(function (t) { return { tat: (t.tat || '').trim(), von: t.von || '', bis: t.bis || '' }; }).filter(function (t) { return t.tat || t.von || t.bis; }) }; }).filter(function (k) { return k.name || k.taet.length; });
    out.notiz = kundenNamen(out).join(', ');
    anFinal(out, data.days[ui.edDate]);
    var prx = {}; Object.keys(out.praemien || {}).forEach(function (k) { if (+out.praemien[k] > 0) prx[k] = +out.praemien[k]; });
    if (st !== 'arbeit' || !Object.keys(prx).length) delete out.praemien; else out.praemien = prx;
    var dsx = {}; Object.keys(out.dienste || {}).forEach(function (k) { if (+out.dienste[k] > 0) dsx[k] = +out.dienste[k]; });
    if (!Object.keys(dsx).length) delete out.dienste; else { out.dienste = dsx; ins('dienst_erfasst'); }
    var fzl = fahrzeugeSpeichern(out.fahrzeuge); delete out.fz;
    if (st !== 'arbeit' || !fzl.length) delete out.fahrzeuge; else out.fahrzeuge = fzl;
    if (!out.kunden.length) delete out.kunden;
    if (!out.spaeter) delete out.spaeter;
    delete out.test;
    ins('tag_gespeichert'); if (out.an) ins('notiz');
    data.days[ui.edDate] = out;
    ui.edBase = JSON.stringify(ui.edDraft);
    save();
    var saved = ui.edDate;
    setTimeout(function () { try { if (lueckenFrage(saved)) return; if (window.berichtFrage) window.berichtFrage(saved); } catch (e) { } }, 400);
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
  var MIA_OUT = { 'lkw:baustelle': ['barhaupt', 'weste', 'lenkrad'], 'lkw:tour': ['kappe', 'paket', 'lenkrad'], 'lkw:fern': ['kappe', 'lenkrad'], 'lkw:muell': ['kappe', 'weste', 'lenkrad'], lkw: ['kappe', 'lenkrad'],
    bagger: ['barhaupt', 'weste', 'ohren', 'joystick'], klein: ['kappe', 'klemmbrett'], mechaniker: ['overall', 'maulschluessel'], lager: ['weste', 'paket'], handel: ['schuerze'], buero: ['krawatte', 'laptop'], aussendienst: ['krawatte', 'koffer'],
    'gastro:service': ['schuerze', 'tablett_glas'], 'gastro:kueche': ['kochhaube', 'schuerze', 'pfanne'], 'gastro:chef': ['kochhaube', 'schuerze', 'messer'], 'gastro:rezeption': ['krawatte', 'mappe'], 'gastro:housekeeping': ['schuerze'], 'gastro:betrieb': ['kochhaube', 'schuerze'],
    handwerk: ['helm', 'weste'], 'handwerk:maurer': ['helm', 'weste', 'kelle'], 'handwerk:zimmerer': ['helm', 'weste', 'hammer'], 'handwerk:elektro': ['helm', 'overall', 'maulschluessel'], 'handwerk:tischler': ['kappe', 'overall', 'hammer'], 'handwerk:maler': ['kappe', 'overall', 'eimer'], 'handwerk:anderes': ['helm', 'weste', 'wasserwaage'], 'handwerk:lehrling': ['helm', 'weste', 'hammer'],
    reinigung: ['schuerze', 'eimer'], 'reinigung:sonder': ['helm', 'overall', 'eimer'], 'reinigung:lehrling': ['schuerze', 'eimer'], security: ['kappe', 'weste', 'klemmbrett'], 'security:mobil': ['kappe', 'weste', 'lenkrad'], pflege: ['kittel'], 'pflege:heimhilfe': ['schuerze'], 'pflege:mobil': ['kittel', 'koffer'],
    'handel:verkauf': ['schuerze', 'scanner'], 'handel:theke': ['kochhaube', 'schuerze'], 'handel:lager': ['weste', 'paket'], 'handel:leitung': ['krawatte', 'klemmbrett'] };
  function miaOutfit(beruf, art) { return MIA_OUT[beruf + ':' + art] || MIA_OUT[beruf] || []; }
  var MIA_TEILE = {
    kopf: [['', 'Nichts'], ['helm', 'Schutzhelm'], ['kappe', 'Kappe'], ['kochhaube', 'Kochmütze'], ['ohren', 'Kopfhörer'], ['muetze', 'Wollmütze'], ['strohhut', 'Strohhut'], ['stirnband', 'Stirnband']],
    oben: [['', 'Nichts'], ['weste', 'Warnweste'], ['overall', 'Overall'], ['schuerze', 'Schürze'], ['krawatte', 'Hemd mit Krawatte'], ['trikot', 'Trikot'], ['kittel', 'Kittel'], ['jacke', 'Arbeitsjacke']],
    unten: [['', 'Nichts'], ['hose_jeans', 'Jeans'], ['hose_arbeit', 'Arbeitshose'], ['hose_kurz', 'Kurze Hose'], ['hose_rock', 'Rock'], ['hose_jogging', 'Jogginghose']],
    zubehoer: [['', 'Nichts'], [null, 'Fahrer und Transport'], ['paket', 'Paket'], ['karre', 'Sackkarre mit Paketen'], ['lenkrad', 'Lenkrad'], ['warndreieck', 'Warndreieck'], ['kaffeebecher', 'Kaffeebecher'], ['zapfpistole', 'Zapfpistole'], ['klemmbrett', 'Klemmbrett'], [null, 'Bau und Maschinen'], ['joystick', 'Joystick'], ['schaufel', 'Schaufel'], ['wasserwaage', 'Wasserwaage'], ['eimer', 'Eimer'], ['kelle', 'Maurerkelle'], ['hammer', 'Hammer'], [null, 'Küche und Service'], ['tablett', 'Tablett'], ['tablett_glas', 'Tablett mit Gläsern'], ['tablett_flasche', 'Tablett mit Flasche'], ['flasche', 'Flasche'], ['glas', 'Glas'], ['teller', 'Teller'], ['pfanne', 'Pfanne'], ['messer', 'Küchenmesser'], ['schneebesen', 'Schneebesen'], ['kochloeffel', 'Kochlöffel'], ['topf', 'Topf'], [null, 'Handel und Lager'], ['scanner', 'Handscanner'], ['korb', 'Einkaufskorb'], ['kiste', 'Kiste'], [null, 'Werkstatt'], ['schluessel', 'Schlüssel'], ['maulschluessel', 'Maulschlüssel'], ['oelkanne', 'Ölkanne'], ['reifen', 'Reifen'], [null, 'Büro und Außendienst'], ['mappe', 'Mappe'], ['handy', 'Handy'], ['laptop', 'Laptop'], ['bildschirm', 'Bildschirm'], ['ordner', 'Ordner'], ['notizblock', 'Notizblock mit Stift'], ['koffer', 'Aktenkoffer'], ['tablet', 'Tablet'], ['kamera', 'Kamera'], [null, 'Freizeit und Fans'], ['fussball', 'Fußball'], ['wimpel', 'Wimpel'], ['eishockey', 'Eishockeyschläger'], ['gitarre', 'Gitarre'], ['bierkrug', 'Bierkrug'], ['buch', 'Buch'], ['megafon', 'Megafon']]
  };
  function miaLook() { var m = (data.profil && data.profil.mia) || {}; return m.look || {}; }
  function miaLookAus(outfit) { // aktuelle Berufs-Ausstattung als Startwert für „selbst gestalten“
    var o = {}; Object.keys(MIA_TEILE).forEach(function (k) { var hit = MIA_TEILE[k].filter(function (x) { return x[0] && outfit.indexOf(x[0]) >= 0; })[0]; o[k] = hit ? hit[0] : ''; }); return o;
  }
  function miaOutfitEigen() {
    var l = miaLook(), out = [];
    if (!l.kopf) out.push('barhaupt'); else { out.push(l.kopf); if (l.kopf === 'ohren') out.push('barhaupt'); }
    ['oben', 'unten', 'zubehoer'].forEach(function (k) { if (l[k]) out.push(l[k]); });
    return out;
  }
  function miaCfg() { var m = (data.profil && data.profil.mia) || {}; var f = m.figur === 'm' ? 'm' : 'w'; return { figur: f, name: (m.name || '').trim() || (f === 'm' ? 'Milo' : 'Mia'), ruhig: !!m.ruhig, spricht: m.spricht === true, skip: m.skip || {} }; }
  function miaSvg(f, outfit, pose) {
    outfit = outfit || []; var w = f !== 'm', has = function (x) { return outfit.indexOf(x) >= 0; };
    var sh0 = w ? '#f58aa5' : '#4fc0cf', sh1 = w ? '#c4476a' : '#237a89';
    var item = ['paket', 'tablett', 'schluessel', 'klemmbrett', 'mappe', 'kochloeffel', 'topf', 'joystick', 'handy', 'fussball', 'wimpel', 'karre'].concat(['flasche', 'glas', 'teller', 'tablett_glas', 'tablett_flasche', 'pfanne', 'messer', 'schneebesen', 'scanner', 'korb', 'kiste', 'maulschluessel', 'hammer', 'oelkanne', 'reifen', 'schaufel', 'wasserwaage', 'eimer', 'kelle', 'warndreieck', 'kaffeebecher', 'zapfpistole', 'laptop', 'bildschirm', 'ordner', 'notizblock', 'koffer', 'tablet', 'kamera', 'eishockey', 'gitarre', 'bierkrug', 'buch', 'megafon']).some(has);
    var s = '<svg class="miasvg' + (pose ? ' p-' + pose : '') + (item ? ' hasitem' : '') + '" viewBox="0 -26 120 156" aria-hidden="true"><defs>' +
      '<radialGradient id="mgFur" cx=".35" cy=".28" r=".95"><stop offset="0" stop-color="#c58a5c"/><stop offset=".6" stop-color="#8d5b3a"/><stop offset="1" stop-color="#5e3a20"/></radialGradient>' +
      '<radialGradient id="mgFace" cx=".4" cy=".28" r=".95"><stop offset="0" stop-color="#fff0d8"/><stop offset=".7" stop-color="#f1d3b0"/><stop offset="1" stop-color="#d9ac7f"/></radialGradient>' +
      '<linearGradient id="mgSh' + f + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + sh0 + '"/><stop offset="1" stop-color="' + sh1 + '"/></linearGradient>' +
      '<linearGradient id="mgYel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe066"/><stop offset="1" stop-color="#e5a800"/></linearGradient>' +
      '<linearGradient id="mgRed" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff6b5e"/><stop offset="1" stop-color="#b91c1c"/></linearGradient>' +
      '<linearGradient id="mgOra" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4ff4a"/><stop offset="1" stop-color="#c9dc00"/></linearGradient>' +
      '<linearGradient id="mgBlu" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4f8ff7"/><stop offset="1" stop-color="#1b4fb0"/></linearGradient>' +
      '</defs><ellipse cx="60" cy="127" rx="30" ry="4.5" fill="rgba(0,0,0,.18)" class="mia-shadow"/>' +
      '<g class="mia-bob"><g class="mia-swing">';
    // Schwanz zum Aufhängen (nur in der Pose "hang") und normaler Schwanz
    s += '<g class="mia-hang"><rect x="2" y="-24" width="116" height="8" rx="4" fill="#9a6a3a" stroke="#6b4423" stroke-width="1.5"/><path d="M86 112C122 100 112 36 70 -14" fill="none" stroke="#5e3a20" stroke-width="9" stroke-linecap="round"/><path d="M86 112C122 100 112 36 70 -14" fill="none" stroke="#8d5b3a" stroke-width="5.5" stroke-linecap="round"/><circle cx="70" cy="-15" r="6" fill="none" stroke="#5e3a20" stroke-width="4"/></g>';
    s += '<g class="mia-tail"><path d="M84 114C114 120 122 90 106 82C98 78 92 86 99 92" fill="none" stroke="#5e3a20" stroke-width="9" stroke-linecap="round"/><path d="M84 114C114 120 122 90 106 82C98 78 92 86 99 92" fill="none" stroke="url(#mgFur)" stroke-width="5.5" stroke-linecap="round"/></g>';
    // Körper
    s += '<rect x="32" y="80" width="56" height="44" rx="20" fill="url(#mgSh' + f + ')"/><ellipse cx="46" cy="92" rx="8" ry="12" fill="rgba(255,255,255,.22)"/>' +
      '<g class="mia-arml"><rect x="21" y="84" width="14" height="32" rx="7" fill="url(#mgFur)" stroke="#5e3a20" stroke-width="1.500" transform="rotate(10 28 88)"/><circle cx="23" cy="116" r="7.500" fill="url(#mgFur)" stroke="#5e3a20" stroke-width="1.500"/></g>';
    var arm = '';
    if (has('paket')) arm += '<rect x="90" y="44" width="28" height="24" rx="3" fill="#d9954a" stroke="#8b5a2b" stroke-width="2"/><path d="M90 56h28M104 44v24" stroke="#8b5a2b" stroke-width="3"/><rect x="95" y="49" width="8" height="5" fill="#fff" opacity=".8"/>';
    if (has('tablett')) arm += '<ellipse cx="104" cy="54" rx="19" ry="4.5" fill="#b8c0cc" stroke="#6b7280" stroke-width="1.5"/><rect x="99" y="36" width="9" height="17" rx="3" fill="#cfe8ff" stroke="#60a5fa" stroke-width="1.5"/>';
    if (has('schluessel')) arm += '<rect x="99" y="34" width="7" height="32" rx="3.5" fill="#cbd5e1" stroke="#64748b" stroke-width="1.5" transform="rotate(22 102 52)"/><circle cx="109" cy="34" r="8" fill="none" stroke="#cbd5e1" stroke-width="5"/><circle cx="109" cy="34" r="8" fill="none" stroke="#64748b" stroke-width="1" />';
    if (has('klemmbrett')) arm += '<rect x="94" y="38" width="24" height="32" rx="3" fill="#b4730f" stroke="#7a4d09" stroke-width="2"/><rect x="98" y="44" width="16" height="22" fill="#fff"/><path d="M101 50h10M101 55h10M101 60h7" stroke="#94a3b8" stroke-width="1.6"/><rect x="101" y="36" width="10" height="6" rx="2" fill="#94a3b8"/>';
    if (has('mappe')) arm += '<rect x="92" y="42" width="28" height="26" rx="3" fill="#2f5fa8" stroke="#1e3a6e" stroke-width="2"/><rect x="92" y="42" width="12" height="5" rx="2" fill="#4a7fd6"/><rect x="100" y="52" width="12" height="3" rx="1.5" fill="#cfe0ff"/>';
    if (has('kochloeffel')) arm += '<rect x="106" y="34" width="5" height="34" rx="2.5" fill="#b45309" stroke="#78350f" stroke-width="1.2" transform="rotate(12 108 50)"/><ellipse cx="100" cy="36" rx="8" ry="6" fill="#d97706" stroke="#78350f" stroke-width="1.2" transform="rotate(12 100 36)"/>';
    if (has('topf')) arm += '<path d="M100 34q-3-5 0-9M108 34q-3-5 0-9" fill="none" stroke="#94a3b8" stroke-width="2"/><rect x="94" y="42" width="24" height="20" rx="3" fill="#94a3b8" stroke="#475569" stroke-width="2"/><rect x="91" y="42" width="30" height="4" rx="2" fill="#cbd5e1" stroke="#475569" stroke-width="1.2"/><path d="M92 52h-4M120 52h4" stroke="#475569" stroke-width="3" stroke-linecap="round"/>';
    if (has('joystick')) arm += '<rect x="94" y="58" width="22" height="10" rx="3" fill="#374151" stroke="#111827" stroke-width="1.5"/><rect x="103" y="40" width="4" height="20" rx="2" fill="#9ca3af"/><circle cx="105" cy="38" r="6" fill="#ef4444" stroke="#7f1d1d" stroke-width="1.5"/>';
    if (has('handy')) arm += '<rect x="97" y="38" width="16" height="28" rx="3" fill="#1f2937" stroke="#9ca3af" stroke-width="1.5"/><rect x="99.500" y="42" width="11" height="18" fill="#60a5fa"/>';
    if (has('fussball')) arm += '<circle cx="104" cy="52" r="13" fill="#fff" stroke="#1f2937" stroke-width="2"/><path d="M104 45l6 4-2 7h-8l-2-7z" fill="#1f2937"/>';
    if (has('wimpel')) arm += '<rect x="99" y="28" width="3" height="44" fill="#78350f"/><path d="M102 30l15 7-15 7z" fill="#facc15" stroke="#a16207" stroke-width="1.2"/>';
    if (has('karre')) arm += '<path d="M96 28v62" stroke="#475569" stroke-width="4" stroke-linecap="round"/><path d="M96 88h16" stroke="#475569" stroke-width="4" stroke-linecap="round"/><circle cx="104" cy="92" r="6" fill="#1f2937"/><rect x="99" y="58" width="16" height="14" fill="#d9954a" stroke="#8b5a2b" stroke-width="1.5"/><rect x="99" y="44" width="14" height="14" fill="#e3a860" stroke="#8b5a2b" stroke-width="1.5"/>';
    if (has('flasche')) arm += '<rect x="100" y="40" width="9" height="26" rx="3" fill="#15803d" stroke="#14532d" stroke-width="1.500"/><rect x="102" y="32" width="5" height="10" rx="1.500" fill="#15803d" stroke="#14532d" stroke-width="1.500"/><rect x="100" y="50" width="9" height="8" fill="#fef9c3"/>';
    if (has('glas')) arm += '<path d="M97 40h16l-3 24h-10z" fill="#e0f2fe" fill-opacity=".8" stroke="#0284c7" stroke-width="1.500"/><path d="M99 46h12l-1.500 14h-9z" fill="#fbbf24"/>';
    if (has('teller')) arm += '<g transform="translate(96 52) scale(1.3) translate(-100 -52)"><ellipse cx="104" cy="58" rx="14" ry="5" fill="#fff" stroke="#9ca3af" stroke-width="1.500"/><ellipse cx="104" cy="57" rx="8" ry="2.600" fill="#f3f4f6" stroke="#d1d5db"/><path d="M96 54q8-12 16 0z" fill="#d97706"/></g>';
    if (has('tablett_glas')) arm += '<ellipse cx="104" cy="58" rx="17" ry="4.500" fill="#b8c0cc" stroke="#6b7280" stroke-width="1.500"/><path d="M91 56l2-14h6l2 14zM102 56l2-16h6l2 16zM113 56l2-12h4l1 12z" fill="#e0f2fe" stroke="#0284c7" stroke-width="1.200"/>';
    if (has('tablett_flasche')) arm += '<ellipse cx="104" cy="58" rx="17" ry="4.500" fill="#b8c0cc" stroke="#6b7280" stroke-width="1.500"/><rect x="99" y="32" width="9" height="24" rx="3" fill="#15803d" stroke="#14532d" stroke-width="1.500"/><rect x="101" y="24" width="5" height="9" rx="1.500" fill="#15803d" stroke="#14532d" stroke-width="1.500"/>';
    if (has('pfanne')) arm += '<ellipse cx="102" cy="48" rx="14" ry="6" fill="#374151" stroke="#111827" stroke-width="2"/><path d="M110 52l6 12" stroke="#111827" stroke-width="4" stroke-linecap="round"/>';
    if (has('messer')) arm += '<path d="M104 30l6 4-2 22h-4z" fill="#e5e7eb" stroke="#6b7280" stroke-width="1.500"/><rect x="103" y="56" width="7" height="12" rx="2" fill="#78350f"/>';
    if (has('schneebesen')) arm += '<ellipse cx="104" cy="38" rx="6" ry="11" fill="none" stroke="#9ca3af" stroke-width="2"/><ellipse cx="104" cy="38" rx="2.500" ry="11" fill="none" stroke="#9ca3af" stroke-width="1.500"/><rect x="101.500" y="48" width="5" height="18" rx="2.500" fill="#374151"/>';
    if (has('scanner')) arm += '<path d="M96 40h18v10h-6v16h-8V50h-4z" fill="#374151" stroke="#111827" stroke-width="1.500"/><rect x="98" y="42" width="14" height="5" fill="#f87171"/>';
    if (has('korb')) arm += '<path d="M92 50h24l-3 16H95z" fill="#ef4444" stroke="#991b1b" stroke-width="1.500"/><path d="M96 50q8-14 16 0" fill="none" stroke="#991b1b" stroke-width="2.500"/>';
    if (has('kiste')) arm += '<g transform="translate(96 52) scale(1.3) translate(-100 -52)"><rect x="92" y="44" width="24" height="20" rx="2" fill="#a3e635" stroke="#4d7c0f" stroke-width="2"/><path d="M92 52h24M92 58h24" stroke="#4d7c0f" stroke-width="1.500"/></g>';
    if (has('maulschluessel')) arm += '<g transform="translate(96 52) scale(1.3) translate(-100 -52)"><rect x="103" y="42" width="5" height="26" rx="2.500" fill="#cbd5e1" stroke="#64748b" stroke-width="1.500"/><path d="M98 32q0-6 7-6t7 6l-3 4h-8z" fill="#cbd5e1" stroke="#64748b" stroke-width="1.500"/><rect x="102" y="26" width="6" height="8" fill="#fff" opacity=".0"/></g>';
    if (has('hammer')) arm += '<rect x="103" y="38" width="5" height="30" rx="2" fill="#92400e" stroke="#451a03" stroke-width="1.200"/><rect x="94" y="30" width="22" height="10" rx="2" fill="#6b7280" stroke="#374151" stroke-width="1.500"/>';
    if (has('oelkanne')) arm += '<path d="M94 66V50q0-4 6-4h10q6 0 6 4v16z" fill="#f59e0b" stroke="#92400e" stroke-width="1.500"/><path d="M110 46l6-8" fill="none" stroke="#92400e" stroke-width="3" stroke-linecap="round"/>';
    if (has('reifen')) arm += '<circle cx="104" cy="52" r="15" fill="#1f2937" stroke="#111827" stroke-width="2"/><circle cx="104" cy="52" r="7" fill="#9ca3af" stroke="#6b7280" stroke-width="1.500"/><circle cx="104" cy="52" r="2" fill="#374151"/>';
    if (has('schaufel')) arm += '<rect x="103" y="30" width="4" height="36" rx="2" fill="#92400e"/><path d="M95 62h20l-3 12H98z" fill="#9ca3af" stroke="#4b5563" stroke-width="1.500"/>';
    if (has('wasserwaage')) arm += '<rect x="92" y="48" width="26" height="9" rx="2" fill="#facc15" stroke="#a16207" stroke-width="1.500"/><ellipse cx="105" cy="52.500" rx="5" ry="2.800" fill="#fff" stroke="#a16207"/><circle cx="105" cy="52.500" r="1.600" fill="#22c55e"/>';
    if (has('eimer')) arm += '<path d="M95 44h18l-3 22H98z" fill="#3b82f6" stroke="#1e3a8a" stroke-width="1.500"/><path d="M95 44q9-14 18 0" fill="none" stroke="#1e3a8a" stroke-width="2"/>';
    if (has('kelle')) arm += '<path d="M98 34l14 8-12 18z" fill="#9ca3af" stroke="#4b5563" stroke-width="1.500"/><rect x="103" y="58" width="5" height="10" rx="2" fill="#92400e"/>';
    if (has('warndreieck')) arm += '<path d="M104 30l13 24h-26z" fill="#fff" stroke="#dc2626" stroke-width="5" stroke-linejoin="round"/>';
    if (has('kaffeebecher')) arm += '<path d="M97 44h16l-2 22H99z" fill="#f8fafc" stroke="#94a3b8" stroke-width="1.500"/><rect x="96" y="40" width="18" height="5" rx="2" fill="#475569"/><rect x="98" y="52" width="14" height="6" fill="#a16207"/><path d="M101 36q-3-5 0-8M108 36q-3-5 0-8" fill="none" stroke="#94a3b8" stroke-width="2"/>';
    if (has('zapfpistole')) arm += '<g transform="translate(96 52) scale(1.3) translate(-100 -52)"><path d="M96 46h18l4 6v6h-6v-4h-8v14h-8z" fill="#16a34a" stroke="#14532d" stroke-width="1.500"/><rect x="112" y="40" width="6" height="8" fill="#374151"/></g>';
    if (has('laptop')) arm += '<rect x="95" y="38" width="20" height="14" rx="1.500" fill="#1f2937" stroke="#6b7280" stroke-width="1.500"/><rect x="97" y="40" width="16" height="10" fill="#60a5fa"/><path d="M91 54h28l-3 5H94z" fill="#cbd5e1" stroke="#64748b" stroke-width="1.500"/>';
    if (has('bildschirm')) arm += '<rect x="94" y="34" width="22" height="16" rx="2" fill="#111827" stroke="#6b7280" stroke-width="1.500"/><rect x="96" y="36" width="18" height="12" fill="#38bdf8"/><path d="M105 50v8M98 60h14" stroke="#64748b" stroke-width="3" stroke-linecap="round"/>';
    if (has('ordner')) arm += '<rect x="96" y="32" width="16" height="34" rx="2" fill="#1d4ed8" stroke="#1e3a8a" stroke-width="1.500"/><rect x="99" y="38" width="10" height="8" fill="#fff"/><ellipse cx="104" cy="32" rx="3" ry="2" fill="#93c5fd"/>';
    if (has('notizblock')) arm += '<rect x="95" y="38" width="18" height="26" rx="2" fill="#fef9c3" stroke="#ca8a04" stroke-width="1.500"/><path d="M98 46h12M98 52h12M98 58h8" stroke="#a16207" stroke-width="1.300"/><rect x="109" y="28" width="3" height="26" rx="1.500" fill="#2563eb" transform="rotate(15 110 40)"/>';
    if (has('koffer')) arm += '<rect x="93" y="46" width="24" height="18" rx="3" fill="#7c4a1d" stroke="#451a03" stroke-width="2"/><path d="M101 46v-4h8v4" fill="none" stroke="#451a03" stroke-width="2.500"/><rect x="102" y="52" width="6" height="4" fill="#fbbf24"/>';
    if (has('tablet')) arm += '<g transform="translate(96 52) scale(1.3) translate(-100 -52)"><rect x="95" y="34" width="20" height="28" rx="3" fill="#111827" stroke="#9ca3af" stroke-width="1.500"/><rect x="98" y="38" width="14" height="20" fill="#a78bfa"/></g>';
    if (has('kamera')) arm += '<rect x="93" y="42" width="24" height="16" rx="3" fill="#374151" stroke="#111827" stroke-width="1.500"/><circle cx="105" cy="50" r="6" fill="#9ca3af" stroke="#111827" stroke-width="1.500"/><circle cx="105" cy="50" r="2.500" fill="#1d4ed8"/><rect x="98" y="39" width="8" height="4" fill="#374151"/>';
    if (has('eishockey')) arm += '<path d="M108 28v36q0 4-4 4h-10" fill="none" stroke="#92400e" stroke-width="4" stroke-linecap="round"/><ellipse cx="112" cy="68" rx="5" ry="2.500" fill="#111827"/>';
    if (has('gitarre')) arm += '<ellipse cx="104" cy="58" rx="10" ry="9" fill="#d97706" stroke="#78350f" stroke-width="1.500"/><circle cx="104" cy="58" r="3" fill="#451a03"/><rect x="102" y="28" width="4" height="26" fill="#78350f"/><rect x="100" y="24" width="8" height="7" rx="1" fill="#451a03"/>';
    if (has('bierkrug')) arm += '<path d="M92 38h16l-2 26H94z" fill="#fbbf24" stroke="#92400e" stroke-width="1.500"/><path d="M92 38q8-8 16 0" fill="#fff" stroke="#d1d5db"/><path d="M108 44q9 0 9 8t-9 8" fill="none" stroke="#92400e" stroke-width="3"/>';
    if (has('buch')) arm += '<rect x="94" y="40" width="22" height="24" rx="2" fill="#7c3aed" stroke="#4c1d95" stroke-width="1.500"/><rect x="97" y="44" width="16" height="6" fill="#ede9fe"/><path d="M94 60h22" stroke="#4c1d95"/>';
    if (has('megafon')) arm += '<g transform="translate(96 52) scale(1.3) translate(-100 -52)"><path d="M94 46l16-10v28l-16-10z" fill="#f97316" stroke="#9a3412" stroke-width="1.500"/><rect x="88" y="46" width="8" height="10" rx="2" fill="#374151"/><path d="M114 42q4 6 0 14" fill="none" stroke="#f97316" stroke-width="2"/></g>';
    var armG = '<g transform="translate(9 5)"><g class="mia-arm"><rect x="82" y="78" width="32" height="13" rx="6.5" fill="url(#mgFur)" stroke="#5e3a20" stroke-width="1.500" transform="rotate(-50 86 84)"/>' + (arm ? '<g transform="translate(86 56) scale(1.4) translate(-100 -56)">' + arm + '</g>' : '') + '</g></g>';
    if (has('hose_jeans')) s += '<path d="M32 106h56v6q0 12-20 12H52q-20 0-20-12z" fill="#2563eb"/><path d="M60 106v18" stroke="#1e3a8a" stroke-width="2"/>';
    if (has('hose_arbeit')) s += '<path d="M32 104h56v8q0 12-20 12H52q-20 0-20-12z" fill="#64748b"/><rect x="36" y="110" width="11" height="7" rx="1.500" fill="#475569"/><rect x="73" y="110" width="11" height="7" rx="1.500" fill="#475569"/><path d="M60 104v20" stroke="#334155" stroke-width="2"/>';
    if (has('hose_kurz')) s += '<path d="M32 113h56v1q0 10-20 10H52q-20 0-20-10z" fill="#0d9488"/><path d="M60 113v11" stroke="#115e59" stroke-width="2"/>';
    if (has('hose_rock')) s += '<path d="M33 106q27 8 54 0l7 18H26z" fill="#db2777" stroke="#9d174d" stroke-width="1.500"/>';
    if (has('hose_jogging')) s += '<path d="M32 106h56v6q0 12-20 12H52q-20 0-20-12z" fill="#9ca3af"/><path d="M36 108v14M84 108v14" stroke="#fff" stroke-width="2.500"/>';
    if (has('trikot')) s += '<rect x="32" y="80" width="56" height="44" rx="20" fill="#dc2626"/><path d="M50 82l10 10l10-10" fill="none" stroke="#fff" stroke-width="3"/><text x="60" y="114" font-size="22" font-weight="700" text-anchor="middle" fill="#fff" font-family="Arial,sans-serif">7</text>';
    if (has('kittel')) s += '<rect x="32" y="80" width="56" height="44" rx="20" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.500"/><path d="M60 82v42" stroke="#cbd5e1" stroke-width="2"/><rect x="66" y="100" width="12" height="9" rx="1.500" fill="none" stroke="#94a3b8" stroke-width="1.500"/><circle cx="55" cy="94" r="1.800" fill="#94a3b8"/><circle cx="55" cy="106" r="1.800" fill="#94a3b8"/>';
    if (has('jacke')) s += '<rect x="32" y="80" width="56" height="44" rx="20" fill="#475569"/><path d="M60 82v42" stroke="#1e293b" stroke-width="2.500"/><path d="M48 82l12 10l12-10" fill="none" stroke="#1e293b" stroke-width="2.500"/><rect x="38" y="104" width="12" height="9" rx="2" fill="#334155"/><rect x="70" y="104" width="12" height="9" rx="2" fill="#334155"/>';
    if (has('weste')) s += '<rect x="32" y="80" width="56" height="44" rx="20" fill="url(#mgOra)"/><path d="M60 82v42" stroke="#8a9a00" stroke-width="2"/><rect x="34" y="97" width="52" height="6" fill="#f3f4f6"/><rect x="36" y="109" width="48" height="6" fill="#f3f4f6"/><path d="M34 97h52M36 109h48" stroke="rgba(0,0,0,.12)" stroke-width="1"/>';
    if (has('overall')) s += '<rect x="32" y="80" width="56" height="44" rx="20" fill="url(#mgBlu)"/><rect x="38" y="80" width="7" height="22" fill="#1b4fb0"/><rect x="75" y="80" width="7" height="22" fill="#1b4fb0"/><rect x="48" y="100" width="24" height="14" rx="3" fill="#6ea4ff" stroke="#1b4fb0" stroke-width="1.5"/><circle cx="41.500" cy="103" r="2.2" fill="#facc15"/><circle cx="78.500" cy="103" r="2.2" fill="#facc15"/>';
    if (has('schuerze')) s += '<path d="M42 90h36l4 34H38z" fill="#fafafa" stroke="#d1d5db" stroke-width="1.5"/><path d="M42 90q18-6 36 0" fill="none" stroke="#d1d5db" stroke-width="2"/><rect x="50" y="102" width="20" height="10" rx="2" fill="#bfdbfe" stroke="#93c5fd" stroke-width="1.2"/>';
    if (has('krawatte')) s += '<path d="M48 82l12 14l12-14z" fill="#fff" stroke="#d1d5db" stroke-width="1.2"/><path d="M60 88l-7 7l7 6l7-6z" fill="#1e3a8a"/><path d="M60 100l-6 22h12z" fill="#1e40af" stroke="#172554" stroke-width="1"/>';
    // Kopf
    s += '<circle cx="24" cy="48" r="14" fill="url(#mgFur)"/><circle cx="96" cy="48" r="14" fill="url(#mgFur)"/><circle cx="24" cy="48" r="8" fill="url(#mgFace)"/><circle cx="96" cy="48" r="8" fill="url(#mgFace)"/>' +
      '<circle cx="60" cy="52" r="39" fill="url(#mgFur)"/><ellipse cx="60" cy="63" rx="28" ry="25" fill="url(#mgFace)"/><ellipse cx="46" cy="32" rx="13" ry="7" fill="rgba(255,255,255,.22)" transform="rotate(-25 46 32)"/>' +
      '<g class="mia-eyes"><ellipse cx="47" cy="53" rx="6.5" ry="8" fill="#fff" stroke="#6b4226" stroke-width="1.2"/><ellipse cx="73" cy="53" rx="6.5" ry="8" fill="#fff" stroke="#6b4226" stroke-width="1.2"/><circle cx="48.500" cy="54.500" r="4.300" fill="#1f2937"/><circle cx="74.500" cy="54.500" r="4.300" fill="#1f2937"/><circle cx="50" cy="52.500" r="1.600" fill="#fff"/><circle cx="76" cy="52.500" r="1.600" fill="#fff"/></g>' +
      (w ? '<path d="M40 45l-5-3M44 43l-2-5M80 45l5-3M76 43l2-5" stroke="#1f2937" stroke-width="2" stroke-linecap="round"/>' : '<path d="M40 43q7-4 13 0M67 43q7-4 13 0" fill="none" stroke="#5e3a20" stroke-width="2.4" stroke-linecap="round"/>') +
      '<circle cx="38" cy="66" r="5.500" fill="#f4a3b5" opacity=".65"/><circle cx="82" cy="66" r="5.500" fill="#f4a3b5" opacity=".65"/>' +
      '<ellipse cx="60" cy="64" rx="4.500" ry="3.300" fill="#6b4226"/><path d="M49 71q11 11 22 0" fill="#fff" stroke="#6b4226" stroke-width="2.600" stroke-linecap="round" stroke-linejoin="round"/>';
    if (has('barhaupt')) s += '';
    else if (has('helm')) s += '<path d="M21 46q2-40 39-40t39 40z" fill="url(#mgYel)" stroke="#a16207" stroke-width="2"/><rect x="17" y="42" width="86" height="9" rx="4.500" fill="#f5b400" stroke="#a16207" stroke-width="2"/><path d="M60 7v34" stroke="#c98a00" stroke-width="5"/><path d="M34 22q6-9 16-12" fill="none" stroke="#fff6c2" stroke-width="3" stroke-linecap="round" opacity=".8"/>';
    else if (has('kappe')) s += '<path d="M22 40q38-38 76 0z" fill="url(#mgRed)" stroke="#7f1d1d" stroke-width="2"/><path d="M58 36q20-6 48 4q-10 8-48 2z" fill="#991b1b" stroke="#7f1d1d" stroke-width="1.500"/><circle cx="60" cy="7" r="3.500" fill="#991b1b"/><path d="M36 22q8-8 20-10" fill="none" stroke="#ffb4aa" stroke-width="3" stroke-linecap="round" opacity=".8"/>';
    else if (has('muetze')) s += '<path d="M23 44q-2-38 37-38t37 38z" fill="#7c3aed" stroke="#4c1d95" stroke-width="2"/><rect x="21" y="38" width="78" height="9" rx="4" fill="#a78bfa" stroke="#4c1d95" stroke-width="2"/><circle cx="60" cy="5" r="6" fill="#ede9fe" stroke="#4c1d95" stroke-width="1.500"/>';
    else if (has('strohhut')) s += '<ellipse cx="60" cy="36" rx="53" ry="10" fill="#f6d77a" stroke="#a16207" stroke-width="2"/><path d="M34 34q2-30 26-30t26 30z" fill="#f9e29a" stroke="#a16207" stroke-width="2"/><rect x="34" y="27" width="52" height="6" fill="#b91c1c"/>';
    else if (has('stirnband')) s += '<path d="M22 40q38-12 76 0v9q-38-12-76 0z" fill="#ef4444" stroke="#7f1d1d" stroke-width="2"/>';
    else if (has('kochhaube')) s += '<path d="M28 36q-12-20 8-24q5-12 24-8q18-4 24 8q20 4 8 24z" fill="#fff" stroke="#cbd5e1" stroke-width="2"/><rect x="30" y="30" width="60" height="12" rx="4" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="1.500"/>';
    else if (w) s += '<path d="M54 22q-10-16 -24-6q4 14 24 6z M66 22q10-16 24-6q-4 14 -24 6z" fill="#f06292" stroke="#ad1457" stroke-width="1.500"/><circle cx="60" cy="22" r="6" fill="#ec407a" stroke="#ad1457" stroke-width="1.500"/>';
    else s += '<path d="M22 38q38-38 76 0z" fill="url(#mgBlu)" stroke="#1e3a8a" stroke-width="2"/><path d="M58 34q20-6 48 4q-10 8-48 2z" fill="#1e40af" stroke="#1e3a8a" stroke-width="1.500"/>';
    if (has('ohren')) s += '<path d="M19 50q41-58 82 0" stroke="#374151" stroke-width="6" fill="none"/><circle cx="21" cy="52" r="11" fill="#4b5563" stroke="#1f2937" stroke-width="2"/><circle cx="99" cy="52" r="11" fill="#4b5563" stroke="#1f2937" stroke-width="2"/>';
    if (has('lenkrad')) s += '<g class="mia-wheel"><circle cx="60" cy="108" r="17" fill="none" stroke="#1f2937" stroke-width="6"/><circle cx="60" cy="108" r="17" fill="none" stroke="#6b7280" stroke-width="1.500"/><path d="M60 108v17M43 108h34" stroke="#1f2937" stroke-width="4"/><circle cx="60" cy="108" r="4.500" fill="#374151"/></g>';
    s += armG;
    s += '<g class="hand h-eyes"><circle cx="46" cy="52" r="11" fill="url(#mgFur)" stroke="#5e3a20" stroke-width="2"/><circle cx="74" cy="52" r="11" fill="url(#mgFur)" stroke="#5e3a20" stroke-width="2"/></g>' +
      '<g class="hand h-ears"><circle cx="20" cy="52" r="11" fill="url(#mgFur)" stroke="#5e3a20" stroke-width="2"/><circle cx="100" cy="52" r="11" fill="url(#mgFur)" stroke="#5e3a20" stroke-width="2"/></g>' +
      '<g class="hand h-mouth"><circle cx="54" cy="73" r="11" fill="url(#mgFur)" stroke="#5e3a20" stroke-width="2"/><circle cx="66" cy="73" r="11" fill="url(#mgFur)" stroke="#5e3a20" stroke-width="2"/></g>';
    return s + '</g></g></svg>';
  }
  function miaInner(f, outfit) { return miaSvg(f, outfit, '').replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, ''); }
  /* Szene: Mia sitzt im Fahrzeug ihres Berufs (eigene Zeichnung, neutral, ohne Marke und Firmenlogo) */
  function miaScene(kind, f) {
    if (kind === 'bagger') return miaSceneBagger(f);
    if (kind === 'transporter') return miaSceneTransporter(f);
    if (kind !== 'kipper') return '';
    var mia = '<g transform="translate(211 39) scale(.48)">' + miaInner(f, ['kappe']) + '</g>';
    var wheel = function (cx) { return '<g transform="translate(' + cx + ' 112)"><circle r="17" fill="#262626"/><circle r="17" fill="none" stroke="#111" stroke-width="2"/><g class="sc-spin"><circle r="10" fill="#d1d5db" stroke="#9ca3af" stroke-width="2"/><path d="M0-9v18M-9 0h18M-6.400-6.400l12.800 12.800M6.400-6.400l-12.800 12.800" stroke="#9ca3af" stroke-width="1.500"/></g><circle r="3" fill="#6b7280"/></g>'; };
    var ribs = ''; for (var x = 40; x < 180; x += 20) ribs += '<path d="M' + x + ' 56v42" stroke="#7b8494" stroke-width="2"/>';
    return '<svg class="scenesvg" viewBox="0 0 300 150" role="img" aria-label="Mia im Kipper"><defs><linearGradient id="scSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#bfe3f7"/><stop offset="1" stop-color="#eaf6fd"/></linearGradient><linearGradient id="scWin" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#cfeefb"/><stop offset="1" stop-color="#8ec9e6"/></linearGradient><linearGradient id="scCab" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#dfe5ec"/></linearGradient><clipPath id="scClip"><path d="M220 46H244Q248 46 251 50L262 76H220Z"/></clipPath></defs>' +
      '<rect width="300" height="150" rx="14" fill="url(#scSky)"/><path d="M0 108q40-34 90-10t110-14q50-8 100 14v50H0z" fill="#9bbf8a" opacity=".7"/><rect y="126" width="300" height="24" fill="#cdb998"/><path d="M0 126h300" stroke="#b49f7b" stroke-width="2"/>' +
      '<ellipse cx="150" cy="130" rx="125" ry="5" fill="rgba(0,0,0,.2)"/>' +
      '<g class="sc-truck"><rect x="14" y="98" width="272" height="11" rx="3" fill="#374151"/>' +
      '<g class="sc-tip"><path d="M20 50h162v48H20z" fill="#a7b0bd" stroke="#6b7280" stroke-width="2.500"/><rect x="18" y="46" width="166" height="7" rx="3" fill="#c3cad5" stroke="#6b7280" stroke-width="1.500"/>' + ribs + '<rect x="20" y="92" width="162" height="6" fill="#7b8494"/></g>' +
      '<path d="M186 98V50Q186 40 196 40H238Q250 40 256 50L286 80V98Z" fill="url(#scCab)" stroke="#9aa3af" stroke-width="2.500"/>' +
      '<path d="M220 46H244Q248 46 251 50L262 76H220Z" fill="url(#scWin)"/><g clip-path="url(#scClip)">' + mia + '</g><path d="M220 46H244Q248 46 251 50L262 76H220Z" fill="none" stroke="#6b7280" stroke-width="2.500"/>' +
      '<path d="M217 48V98" stroke="#b6bec9" stroke-width="2"/><rect x="209" y="78" width="7" height="3" rx="1.500" fill="#6b7280"/>' +
      '<rect x="271" y="80" width="17" height="19" rx="3" fill="#1f2937"/><path d="M273 85h13M273 90h13M273 95h13" stroke="#e5e7eb" stroke-width="1.600"/><circle cx="281" cy="76" r="3.500" fill="#fde047" stroke="#a16207" stroke-width="1"/><rect x="268" y="98" width="22" height="8" rx="2" fill="#111827"/>' +
      '<rect x="188" y="12" width="6" height="30" rx="2" fill="#1f2937"/><g class="sc-smoke"><circle cx="191" cy="10" r="4" fill="#cbd5e1"/><circle cx="191" cy="10" r="4" fill="#cbd5e1"/><circle cx="191" cy="10" r="4" fill="#cbd5e1"/></g>' +
      wheel(62) + wheel(92) + wheel(228) + wheel(258) + '</g></svg>';
  }
  function miaSceneBagger(f) {
    var mia = '<g transform="translate(176 46) scale(.46)">' + miaInner(f, ['kappe']) + '</g>';
    var links = '', i; for (i = 0; i < 6; i++) links += '<circle cx="' + (118 + i * 24) + '" cy="124" r="9" fill="#3b4350" stroke="#1f2937" stroke-width="2"/>';
    return '<svg class="scenesvg" viewBox="0 0 300 150" role="img" aria-label="Mia im Bagger"><defs><linearGradient id="scSky2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#bfe3f7"/><stop offset="1" stop-color="#eaf6fd"/></linearGradient><linearGradient id="scTeal" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#31c4c0"/><stop offset="1" stop-color="#0f8f94"/></linearGradient><linearGradient id="scWin2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#cfeefb"/><stop offset="1" stop-color="#8ec9e6"/></linearGradient><clipPath id="scClip2"><path d="M176 52H226Q230 52 232 56V90H176Z"/></clipPath></defs>' +
      '<rect width="300" height="150" rx="14" fill="url(#scSky2)"/><path d="M0 100q40-30 90-8t110-12q50-8 100 12v58H0z" fill="#9bbf8a" opacity=".7"/><rect y="132" width="300" height="18" fill="#cdb998"/><path d="M0 132h300" stroke="#b49f7b" stroke-width="2"/>' +
      '<path d="M8 132q14-26 36-26t36 26z" fill="#a98f6b" stroke="#8a7452" stroke-width="2"/>' +
      '<ellipse cx="190" cy="136" rx="105" ry="5" fill="rgba(0,0,0,.2)"/>' +
      '<g class="sc-bag"><rect x="106" y="112" width="156" height="24" rx="12" fill="#2d3440" stroke="#1f2937" stroke-width="2"/><g class="sc-links">' + links + '</g>' +
      '<rect x="128" y="96" width="112" height="18" rx="4" fill="#4b5563"/>' +
      '<g class="sc-cabbody"><path d="M130 96V66Q130 52 144 52H172V96Z" fill="url(#scTeal)" stroke="#0b6b70" stroke-width="2.500"/><rect x="132" y="84" width="38" height="12" rx="2" fill="#0b7b80"/><path d="M136 90h26M136 94h26" stroke="#7fe0dc" stroke-width="1.500"/>' +
      '<path d="M172 96V50Q172 40 182 40H226Q238 40 238 52V96Z" fill="url(#scTeal)" stroke="#0b6b70" stroke-width="2.500"/><path d="M176 52H226Q230 52 232 56V90H176Z" fill="url(#scWin2)"/><g clip-path="url(#scClip2)">' + mia + '</g><path d="M176 52H226Q230 52 232 56V90H176Z" fill="none" stroke="#0b6b70" stroke-width="2.500"/><rect x="225" y="32" width="4" height="12" fill="#374151"/></g>' +
      '<g class="sc-arm"><path d="M178 78L116 40L104 54L168 94Z" fill="url(#scTeal)" stroke="#0b6b70" stroke-width="2.500"/><circle cx="110" cy="46" r="6" fill="#9ca3af" stroke="#4b5563" stroke-width="2"/>' +
      '<g class="sc-stick"><path d="M110 46L52 62L56 76L114 58Z" fill="url(#scTeal)" stroke="#0b6b70" stroke-width="2.500"/><circle cx="54" cy="69" r="5" fill="#9ca3af" stroke="#4b5563" stroke-width="2"/>' +
      '<g class="sc-bucket"><path d="M54 69L34 74Q26 92 40 100L62 96Q66 82 54 69Z" fill="#4b5563" stroke="#1f2937" stroke-width="2.500"/><path d="M36 99l-5 4M43 100l-4 5M51 98l-3 5" stroke="#9ca3af" stroke-width="2.500" stroke-linecap="round"/></g></g></g>' +
      '</g></svg>';
  }
  function miaSceneTransporter(f) {
    var mia = '<g transform="translate(176 44) scale(.44)">' + miaInner(f, ['kappe']) + '</g>';
    var wheel = function (cx) { return '<g transform="translate(' + cx + ' 111)"><circle r="16" fill="#262626"/><g class="sc-spin"><circle r="9" fill="#d1d5db" stroke="#9ca3af" stroke-width="2"/><path d="M0-8v16M-8 0h16M-5.600-5.600l11.200 11.200M5.600-5.600l-11.200 11.200" stroke="#9ca3af" stroke-width="1.500"/></g><circle r="2.800" fill="#6b7280"/></g>'; };
    return '<svg class="scenesvg" viewBox="0 0 300 150" role="img" aria-label="Mia im Kleintransporter"><defs><linearGradient id="scSky3" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#bfe3f7"/><stop offset="1" stop-color="#eaf6fd"/></linearGradient><linearGradient id="scBox" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#e3e8ef"/></linearGradient><linearGradient id="scWin3" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#cfeefb"/><stop offset="1" stop-color="#8ec9e6"/></linearGradient><clipPath id="scClip3"><path d="M180 52H208Q212 52 214 56L220 80H180Z"/></clipPath></defs>' +
      '<rect width="300" height="150" rx="14" fill="url(#scSky3)"/><path d="M0 104q40-30 90-8t110-12q50-8 100 12v54H0z" fill="#9bbf8a" opacity=".7"/><rect y="126" width="300" height="24" fill="#d9d2c3"/><path d="M0 126h300" stroke="#bdb5a3" stroke-width="2"/>' +
      '<ellipse cx="150" cy="128" rx="118" ry="5" fill="rgba(0,0,0,.2)"/>' +
      '<g class="sc-truck"><rect x="14" y="98" width="256" height="9" rx="3" fill="#374151"/>' +
      '<path d="M18 100V46Q18 34 30 34H150Q164 34 168 46V100Z" fill="url(#scBox)" stroke="#9aa3af" stroke-width="2.500"/><path d="M34 40V96M58 40V96M82 40V96M106 40V96M130 40V96" stroke="#e5e7eb" stroke-width="2"/><rect x="18" y="92" width="150" height="8" fill="#cfd6df"/>' +
      '<path d="M168 100V48Q168 40 176 40H196Q206 40 212 48L226 70L262 80Q270 82 270 92V100Z" fill="url(#scBox)" stroke="#9aa3af" stroke-width="2.500"/>' +
      '<path d="M180 52H208Q212 52 214 56L220 80H180Z" fill="url(#scWin3)"/><g clip-path="url(#scClip3)">' + mia + '</g><path d="M180 52H208Q212 52 214 56L220 80H180Z" fill="none" stroke="#6b7280" stroke-width="2.500"/>' +
      '<path d="M176 84H224" stroke="#b6bec9" stroke-width="2"/><path d="M174 46V98" stroke="#b6bec9" stroke-width="2"/><rect x="168" y="62" width="6" height="12" rx="2" fill="#374151"/><rect x="190" y="86" width="9" height="3" rx="1.500" fill="#6b7280"/>' +
      '<path d="M262 84h6q3 0 3 4v6h-9z" fill="#fde047" stroke="#a16207" stroke-width="1"/><rect x="262" y="94" width="10" height="9" rx="2" fill="#1f2937"/><path d="M265 98h5" stroke="#9ca3af" stroke-width="1.500"/>' +
      '<rect x="14" y="96" width="6" height="10" rx="2" fill="#374151"/>' +
      wheel(60) + wheel(228) + '</g></svg>';
  }
  var MIA_PAKET = { gueter: ['kappe'], bau: ['helm', 'weste'], klein: ['kappe', 'klemmbrett'], handel: ['schuerze'], buero: ['krawatte'], metall: ['overall', 'schluessel'], gastro: ['schuerze'] };
  function miaFor(date) { if (data.profil && data.profil.mia && data.profil.mia.eigen === true) return miaOutfitEigen(); var w = wAt(date || todayISO()); return w.beruf ? miaOutfit(w.beruf, w.art) : (MIA_PAKET[String(w.paket).replace(/^de_/, '')] || MIA_PAKET[{ spedition: 'gueter' }[String(w.paket).replace(/^de_/, '')]] || []); }
  function miaSet(k, v) { if (!data.profil) data.profil = {}; if (!data.profil.mia) data.profil.mia = {}; data.profil.mia[k] = v; delete data.profil.test; save(); renderMia(); }
  function miaSkipInc(k) { if (!data.profil) data.profil = {}; if (!data.profil.mia) data.profil.mia = {}; var s = data.profil.mia.skip || (data.profil.mia.skip = {}); s[k] = (s[k] || 0) + 1; save(); }
  function miaPrevKey() { var y = now.getFullYear(), m = now.getMonth(); if (m === 0) { y--; m = 12; } return { y: y, m: m, key: y + '-' + (m < 10 ? '0' : '') + m }; }
  /* ---------------- Neuigkeiten (Mia) ---------------- */
  var NEWS = [
    { id: 'n7', d: '2026-11-04', text: 'Neu: Die Art des Tages „Keine Arbeit (von der Firma freigestellt)“, wenn dich die Firma wegen fehlender Arbeit heimschickt. Mit Notiz und einer Einstellung, wie deine Firma den Tag verrechnet.' },
    { id: 'n6', d: '2026-11-03', text: 'Neu: Kollektivvertrag für Büro-Angestellte im Transport und in der Güterbeförderung.' },
    { id: 'n5', d: '2026-11-03', text: 'Neu: Mehrarbeit bei Teilzeit wird erkannt, und sie ist ohne Zuschlag, wenn du sie im selben Quartal 1:1 als Zeitausgleich nimmst.' },
    { id: 'n4', d: '2026-11-03', text: 'Neu: Karenz, Mutterschutz und Papamonat gibt es als Tagesart, für alle Berufe.' },
    { id: 'n3', d: '2026-11-03', text: 'Neu: Kollektivverträge für Büro-Angestellte in Gewerbe, Metall-Industrie und Bau. Fehlt deiner, kannst du ihn melden.' },
    { id: 'n2', d: '2026-11-02', text: 'Ein Tester hat sich gewünscht, bei „Zeit pro Kunde“ den Kunden antippen zu können. Das geht jetzt.' },
    { id: 'n1', d: '2026-11-02', text: 'Ein Tester hat sich „Sonntag“ bei den festen freien Tagen gewünscht. Ist da.' }
  ];
  var NEWS_B = { n7: null, n5: null, n4: null, n3: ['buero', 'aussendienst', 'bund'], n6: ['buero', 'aussendienst', 'bund'], n2: ['lkw', 'bagger', 'handwerk', 'klein', 'aussendienst'], n1: null }; // null = für alle Berufe
  function newsListe() { var c = newsCfg(), b = (wAt(todayISO()) || {}).beruf; return NEWS.filter(function (x) { var f = NEWS_B[x.id]; return c.alle === true || !f || !b || f.indexOf(b) >= 0; }); }
  function newsCfg() { var p = data.profil || {}; var n = p.news || {}; return { an: n.an, alle: n.alle, freq: n.freq || 'woche', gesehen: n.gesehen || '', gelesen: n.gelesen || [] }; }
  function newsSet(k, v) { if (!data.profil) data.profil = {}; if (!data.profil.news) data.profil.news = {}; data.profil.news[k] = v; save(); }
  function newsUnseen() { var g = newsCfg().gelesen; return newsListe().filter(function (x) { return g.indexOf(x.id) < 0; }); }
  function newsDue() {
    var c = newsCfg(); if (c.an !== true || !newsUnseen().length || c.gesehen === todayISO()) return false;
    if (c.freq === 'sofort' || !c.gesehen) return true;
    var tage = Math.round((new Date(todayISO()) - new Date(c.gesehen)) / 86400000);
    return tage >= (c.freq === 'woche' ? 7 : 30);
  }
  function renderNews() {
    var c = newsCfg(), an = $('#news-an'); if (!an) return;
    an.checked = c.an === true; $('#news-opt').hidden = c.an !== true;
    $$('#news-freq .segb').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.nf === c.freq)); });
    $('#news-alle').checked = c.alle === true;
    $('#news-list').innerHTML = newsListe().map(function (x) { var neu = c.gelesen.indexOf(x.id) < 0; return '<div class="newsli' + (neu ? ' neu' : '') + '"><strong>' + esc(x.text) + '</strong>' + (neu ? '<span class="nbadge">Neu!</span>' : '') + '<small>' + fmtDate(x.d) + '</small></div>'; }).join('');
  }
  function mitHelfenFaellig() {
    var co = (data.profil && data.profil.consent) || {};
    return !!(window.StundenInsights && window.StundenInsights.on) && !!data.settings.length && !co.statistik && !co.miaFragen && !(data.profil && data.profil.mithelfenNein);
  }
  function miaNext() {
    if (!data.settings.length) return null;
    var w = wAt(todayISO()), bs = E.bausteine(w), c = miaCfg(), out = [], pk = miaPrevKey();
    if (ui.fbNeu && ui.fbNeu.length) out.push({ k: 'fberledigt', text: 'Gute Nachricht: Deine Meldung an den Entwickler ist erledigt. Danke fürs Melden!' });
    if (!(data.profil && data.profil.assistDone)) out.push({ k: 'assist', text: 'Sollen wir kurz das Wichtigste deiner Einstellungen durchgehen? Das dauert etwa eine Minute, du trägst gleich mit ein.' });
    if (data.profil && data.profil.assistKurz && !data.profil.assistLang && !data.profil.assistMehrNein && Object.keys(data.days).length >= 5) out.push({ k: 'assistmehr', text: 'Magst du jetzt die genaueren Einstellungen mit mir durchgehen (Zuschläge, Pausen, Diäten)? Dann wird der Vergleich mit deinem Lohnzettel genauer.' });
    if (data.profil && data.profil.tagesfuehrung === true && data.profil.tagGefuehrt !== todayISO() && !(data.days[todayISO()] && data.days[todayISO()].von)) out.push({ k: 'tagfuehren', text: 'Sollen wir deinen heutigen Tag gemeinsam eintragen? Ich sage dir bei jedem Feld, was du tust.' });
    if (data.profil && data.profil.assistDone && !data.profil.lzEinstFrage) out.push({ k: 'lzeinst', text: 'Soll ich deine Einstellungen mit deinem Lohnzettel prüfen? Du zeigst mir die PDF-Datei, ich lese sie nur hier auf deinem Handy, und du bestätigst jede Änderung.' });
    if (!(data.profil && data.profil.tourDone)) out.push({ k: 'rundgang', text: 'Soll ich dir in einer Minute zeigen, wie du Tage einträgst und wo du alles findest?' });
    if (w.stundenlohn == null) out.push({ k: 'lohn', pose: 'eyes', text: 'Mir fehlt noch dein Stundenlohn. Dann sage ich dir, was ein Unterschied in Euro wert ist.' });
    if (!Object.keys(data.days).length) out.push({ k: 'tag', text: 'Trag jetzt deinen ersten Tag ein. Beginn und Ende reichen.' });
    if (bs.praemien && !praemienListe().length) out.push({ k: 'praemien', text: 'Steht auf deinem Lohnzettel eine Prämie oder Zulage? Lege sie an, dann prüfe ich sie auch.' });
    if (data.profil && data.profil.lzLesen === undefined && Object.keys(data.days).length >= 3) out.push({ k: 'lzlesen', text: 'Darf ich dir künftig das Abtippen vom Lohnzettel abnehmen? Du zeigst mir die PDF-Datei, ich lese sie nur hier auf deinem Handy, und du musst nichts mehr eintippen. Du entscheidest und kannst es jederzeit ausschalten.' });
    var cnt = Object.keys(data.days).filter(function (k) { return k.slice(0, 7) === pk.key; }).length;
    var lzt = (data.profil && data.profil.lzTag) || 10; // Mia fragt erst ab dem Tag, an dem der Lohnzettel meist kommt
    if (cnt >= 5 && now.getDate() >= lzt && !(data.abgleich && data.abgleich[pk.key])) out.push({ k: 'lohnzettel', text: 'Dein Lohnzettel für ' + MON[pk.m - 1] + ' müsste da sein. Tippe die Zeilen ab, und ich vergleiche sie mit deiner Aufzeichnung.' });
    var ur = ueberRows().slice(-4), neg = ur.filter(function (x) { return x.diff < -1.5; }).length, pos = ur.filter(function (x) { return x.diff > 1.5; }).length;
    if (ur.length >= 3 && (neg >= 3 || pos >= 3)) out.push({ k: 'abweichung', pose: 'eyes', text: 'Deine Überstunden weichen in mehreren Monaten vom Lohnzettel ab. Schau bitte nach, ob diese Einstellungen stimmen: Überstunden-Modell, Betrieb geschlossen und Rundung.' });
    fristenMia(out);
    festMia(out);
    if (mitHelfenFaellig()) out.unshift({ k: 'mithelfen', text: 'Du testest die App gratis. Hilfst du mit, sie besser zu machen? Ich melde nur anonym, in welchem Beruf du bist und wie stark Lohnzettel und Aufzeichnung abweichen, dazu Fragen, die ich nicht beantworten kann. Keine Namen, keine Beträge. Du kannst es jederzeit im Profil ausschalten.' });
    if (newsCfg().an === undefined && !mitHelfenFaellig() && (data.profil && data.profil.tourDone) && Object.keys(data.days).length >= 3) out.push({ k: 'newsfrage', text: 'Soll ich dir Neuigkeiten zur App sagen, zum Beispiel neue Funktionen oder was sich Tester gewünscht haben? Wie oft, kannst du jederzeit im Profil ändern.' });
    if (newsDue()) out.push({ k: 'news_' + newsUnseen()[0].id, text: newsUnseen()[0].text });
    var vn = ((data.profil && data.profil.vorname) || '').trim();
    if (vn) out.forEach(function (o) { if (['assist', 'rundgang', 'lzlesen', 'tag', 'praemien', 'tagfuehren'].indexOf(o.k) >= 0) o.text = vn + ', ' + o.text.charAt(0).toLowerCase() + o.text.slice(1); });
    return out.filter(function (s) { return s.k.indexOf('frist_') === 0 || s.k.indexOf('news_') === 0 || (c.skip[s.k] || 0) < 2; })[0] || null;
  }
  function miaGo(k) {
    if (k === 'mithelfen') { if (!data.profil) data.profil = {}; data.profil.consent = { statistik: true, miaFragen: true }; save(); try { window.StundenInsights.push(true); } catch (e) { } renderFeedback(); toast('Danke, das hilft sehr!'); return; }
    if (k === 'fberledigt') { var pf = data.profil || (data.profil = {}); pf.fbGesehen = (pf.fbGesehen || []).concat(ui.fbNeu || []); ui.fbNeu = []; save(); return; }
    if (k === 'newsfrage') { newsSet('an', true); newsSet('freq', 'woche'); toast('Gern. Wie oft, stellst du im Profil ein.'); return; }
    if (k.indexOf('news_') === 0) { newsSet('gelesen', newsListe().map(function (x) { return x.id; })); show('konten'); renderNews(); setTimeout(function () { var el = $('#news-card'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 120); return; }
    if (k === 'lzeinst') { var pz = data.profil || (data.profil = {}); pz.lzEinstFrage = true; save(); lzUi.modus = 'pruef'; lzOpen(); return; }
    if (k === 'rundgang') { tourStart(); }
    else if (k === 'tagfuehren') { show('erfassen'); tourStart('tag'); }
    else if (k === 'assist') { tourStart(true, 'kurz'); }
    else if (k === 'assistmehr') { tourStart(true); }
    else if (k === 'lohn') { show('einstellungen'); setTimeout(function () { var el = $('#s-lohn'); if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.focus(); } }, 120); }
    else if (k === 'abweichung') { show('einstellungen'); setTimeout(function () { var el = $('#s-umodell'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 120); }
    else if (k === 'tag') { show('erfassen'); }
    else if (k.indexOf('fest_') === 0) { show('einstellungen'); setTimeout(function () { var el = $('#fest-card'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 120); }
    else if (k.indexOf('frist_') === 0) { show('konten'); setTimeout(function () { var el = $('#fr-card'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 120); }
    else if (k === 'praemien') { show('einstellungen'); setTimeout(function () { var el = $('#s-praemien'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 120); }
    else if (k === 'lzlesen') { lzOpen('erlaubnis'); }
    else if (k === 'lohnzettel' && data.profil && data.profil.lzLesen === true) { lzOpen('datei'); }
    else if (k === 'lohnzettel') { var pk = miaPrevKey(); ui.y = pk.y; ui.m = pk.m; show('lohn'); setTimeout(function () { var el = $('#m-abgleich'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 120); }
  }
  function miaPose(p) { var b = $('#mia-btn'); if (b && $('#mia-float')) b.innerHTML = miaSvg(miaCfg().figur, miaFor(), p); }
  function renderMia() {
    var c = miaCfg(), f = $('#mia-float'); if (f) f.hidden = !data.settings.length || !!ui.wiz;
    var ch = $('#mia-choose'); if (ch) ch.innerHTML = ['w', 'm'].map(function (x) { return '<button type="button" class="miaopt' + (c.figur === x ? ' on' : '') + '" data-mia="' + x + '" aria-label="' + (x === 'w' ? 'Weiblich' : 'Männlich') + '">' + miaSvg(x, miaFor(), '') + '<span>' + (x === 'w' ? 'Weiblich' : 'Männlich') + '</span></button>'; }).join('');
    var n = $('#mia-name'); if (n && document.activeElement !== n) n.value = (data.profil && data.profil.mia && data.profil.mia.name) || ''; if (n) n.placeholder = c.figur === 'm' ? 'Milo' : 'Mia';
    var ak = $('#mia-aktiv'); if (ak) ak.checked = !c.ruhig;
    var eg = $('#mia-eigen'); if (eg) { eg.checked = !!(data.profil && data.profil.mia && data.profil.mia.eigen === true); $('#mia-look').hidden = !eg.checked; var lk = miaLook(); ['kopf', 'oben', 'unten', 'zubehoer'].forEach(function (k) { var se = $('#mia-l-' + k); if (!se) return; if (!se.options.length) se.innerHTML = MIA_TEILE[k].map(function (x) { return x[0] === null ? '<option disabled>' + x[1] + '</option>' : '<option value="' + x[0] + '">' + x[1] + '</option>'; }).join(''); se.value = lk[k] || ''; }); }
    var sp = $('#mia-spricht'); if (sp) { sp.checked = !!c.spricht; $('#mia-vwrap').hidden = !c.spricht || !('speechSynthesis' in window); }
    miaStimmenFuellen();
    if (!ui.miaPose) miaPose(c.ruhig || !miaNext() ? 'mouth' : '');
  }
  /* ---- Mia spricht (Stimmen des Geräts, nichts wird hochgeladen) ---- */
  var MIA_KLANG = [['normal', 'Normal', 1, 1], ['hell', 'Heller', 1.35, 1.05], ['tief', 'Tiefer', 0.75, 0.95], ['ruhig', 'Langsam und ruhig', 1, 0.8], ['flott', 'Flott', 1, 1.25]];
  function miaKlang() {
    var m = (data.profil && data.profil.mia) || {}, pr = MIA_KLANG.filter(function (x) { return x[0] === (m.klang || 'normal'); })[0] || MIA_KLANG[0];
    var p = +m.pitch, r = +m.rate; return [p >= 0.3 && p <= 2 ? p : pr[2], r >= 0.5 && r <= 2 ? r : pr[3]];
  }
  function miaStimmen() {
    if (!('speechSynthesis' in window)) return [];
    var lg = miaLang(), vs = speechSynthesis.getVoices().filter(function (v) { return v.lang.slice(0, 2).toLowerCase() === lg; });
    function pkt(v) { return /natural|neural|enhanced|premium|online/i.test(v.name) ? 0 : (v.localService ? 2 : 1); }
    return vs.sort(function (a, b) { return pkt(a) - pkt(b); });
  }
  function miaStimmenFuellen() {
    var sel = $('#mia-stimme'); if (!sel) return; var vs = miaStimmen(), cur = (data.profil && data.profil.mia && data.profil.mia.stimme) || '';
    var sig = vs.map(function (v) { return v.voiceURI; }).join('|') + '#' + cur + '#' + miaLang(); if (sel.dataset.sig === sig) return; sel.dataset.sig = sig;
    sel.innerHTML = '<option value="">Automatisch</option>' + vs.map(function (v, i) { return '<option value="' + esc(v.voiceURI) + '"' + (v.voiceURI === cur ? ' selected' : '') + '>' + (vs.length > 1 ? (i + 1) + ': ' : '') + esc(v.name.replace(/^(Microsoft|Google)\s+/i, '')) + '</option>'; }).join('');
    var kl = $('#mia-klang'); if (kl && !kl.options.length) kl.innerHTML = MIA_KLANG.map(function (x) { return '<option value="' + x[0] + '">' + x[1] + '</option>'; }).join('');
    if (kl) kl.value = (data.profil && data.profil.mia && data.profil.mia.klang) || 'normal';
    var kv = miaKlang(), rp = $('#mia-pitch'), rr = $('#mia-rate'); if (rp && document.activeElement !== rp) rp.value = kv[0]; if (rr && document.activeElement !== rr) rr.value = kv[1];
    try { sel.dispatchEvent(new Event('sp-refresh')); } catch (e) { }
  }
  function miaSag(text, erzwingen) {
    try {
      var c = miaCfg(); if (!('speechSynthesis' in window) || !text || (!c.spricht && !erzwingen)) return;
      var LG = miaLang(), tl = window.UI_LANGS && window.UI_LANGS[LG]; if (tl && tl[text]) text = tl[text]; speechSynthesis.cancel(); var u = new SpeechSynthesisUtterance(text); u.lang = (MIA_LANGS[LG] || MIA_LANGS.de).sr;
      var vs = miaStimmen(), id = (data.profil && data.profil.mia && data.profil.mia.stimme) || '', v = vs.filter(function (x) { return x.voiceURI === id; })[0] || vs[0]; if (v) u.voice = v; var kk = miaKlang(); u.pitch = kk[0]; u.rate = kk[1]; speechSynthesis.speak(u);
    } catch (e) { }
  }
  function miaOpen(auto) { if (!$('#mia-go')) return;
    var c = miaCfg(), nx = miaNext(), bb = $('#mia-bubble'); ui.miaPose = null;
    if (nx) { $('#mia-text').textContent = nx.text; $('#mia-go').hidden = false; $('#mia-later').hidden = false; $('#mia-go').dataset.k = nx.k; $('#mia-go').textContent = (nx.k === 'mithelfen' || nx.k === 'newsfrage') ? 'Ja, bitte' : nx.k.indexOf('news_') === 0 ? 'Mehr dazu' : 'Zeig mir'; if (nx.k.indexOf('news_') === 0) newsSet('gesehen', todayISO()); miaPose(nx.pose || ''); ui.miaStep = nx.k; }
    else { $('#mia-text').textContent = 'Im Moment gibt es nichts zu tun. Trag einfach deine Tage ein, ich rechne mit.'; $('#mia-go').hidden = true; $('#mia-later').hidden = true; miaPose(''); ui.miaStep = null; }
    $('#mia-quiet').textContent = c.ruhig ? 'Mia wieder aktiv stellen' : 'Mia ruhig stellen';
    bb.hidden = false;
    miaSag($('#mia-text').textContent);
  }
  function miaClose(pose) {
    $('#mia-bubble').hidden = true; ui.miaPose = pose || null; miaPose(pose || 'mouth');
    if (pose === 'ears') setTimeout(function () { ui.miaPose = null; miaPose('mouth'); }, 2200);
  }
  function miaAuto() {
    if (ui.wiz || ui.miaAuto || TOUR) return; var c = miaCfg(); if (c.ruhig || !miaNext()) return;
    ui.miaAuto = true; setTimeout(function () { if (!ui.wiz && !TOUR && !miaCfg().ruhig) miaOpen(true); }, 1200);
  }
  (function () {
    function on(id, ev, fn) { var el = $(id); if (el) el.addEventListener(ev, fn); }
    setInterval(function () { // ab und zu hängt Mia am Schwanz
      try {
        var sv = document.querySelector('#mia-btn .miasvg'), bb2 = $('#mia-bubble');
        if (!sv || ($('#mia-ask') && !$('#mia-ask').hidden) || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) return;
        sv.classList.add('p-hang'); setTimeout(function () { var s2 = document.querySelector('#mia-btn .miasvg'); if (s2) s2.classList.remove('p-hang'); }, 6500);
      } catch (e) {}
    }, 26000);
    on('#mia-btn', 'click', function () { if (!$('#mia-bubble').hidden) { miaClose('mouth'); return; } miaOpen(false); });
    on('#mia-go', 'click', function () { var k = this.dataset.k; miaClose('mouth'); miaGo(k); });
    on('#mia-assist', 'click', function () { miaClose('mouth'); tourStart(true); });
    on('#mia-tour', 'click', function () { miaClose('mouth'); tourStart(); });
    on('#mia-later', 'click', function () { if (ui.miaStep && ui.miaStep.indexOf('frist_') === 0) fristSpaet(ui.miaStep.slice(6)); else if (ui.miaStep) miaSkipInc(ui.miaStep); ui.miaAuto = true; miaClose('ears'); });
    on('#mia-quiet', 'click', function () { var r = !miaCfg().ruhig; miaSet('ruhig', r); if (r) { ui.miaAuto = true; miaClose('ears'); } else miaOpen(false); });
    on('#mia-choose', 'click', function (ev) { var b = ev.target.closest('[data-mia]'); if (b) miaSet('figur', b.dataset.mia); });
    on('#mia-name', 'input', function () { miaSet('name', this.value.slice(0, 20)); });
    on('#mia-eigen', 'change', function () { var on = this.checked; if (on && !miaLook().kopf && !Object.keys(miaLook()).length) { miaSet('look', miaLookAus(miaOutfit((wAt(todayISO()) || {}).beruf, (wAt(todayISO()) || {}).art))); } miaSet('eigen', on); });
    ['kopf', 'oben', 'unten', 'zubehoer'].forEach(function (k) { on('#mia-l-' + k, 'change', function () { var l = Object.assign({}, miaLook()); l[k] = this.value; miaSet('look', l); }); });
    on('#mia-spricht', 'change', function () { miaSet('spricht', this.checked); if (this.checked) miaSag('Hallo, so klinge ich.', true); });
    on('#mia-stimme', 'change', function () { miaSet('stimme', this.value); miaSag('Hallo, so klinge ich.', true); });
    on('#mia-klang', 'change', function () { var pr = MIA_KLANG.filter(function (x) { return x[0] === this.value; }.bind(this))[0] || MIA_KLANG[0], m = data.profil && data.profil.mia; if (m) { delete m.pitch; delete m.rate; } miaSet('klang', this.value); miaSag('Hallo, so klinge ich.', true); });
    on('#mia-pitch', 'change', function () { miaSet('pitch', +this.value); miaSag('Hallo, so klinge ich.', true); });
    on('#mia-rate', 'change', function () { miaSet('rate', +this.value); miaSag('Hallo, so klinge ich.', true); });
    on('#mia-probe', 'click', function () { miaSag('Hallo, so klinge ich.', true); });
    try { if ('speechSynthesis' in window) speechSynthesis.addEventListener('voiceschanged', miaStimmenFuellen); } catch (e) { }
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
    en: [["Entering hours", "Open Erfassen (Log). Enter Start (Beginn) and End (Ende), add your breaks (Pausen) and tap Speichern (Save). \"Jetzt\" (Now) fills in the current time.", "hour enter log time work start end save"], ["Adding a bonus", "Go to Einstellungen (Settings), then Prämien (Bonuses), and add your bonus, for example per hour, per day or per piece. Then you enter it on the day. The app calculates it and compares it with your payslip.", "bonus premium allowance extra"], ["Checking my payslip", "Open Übersicht (Overview) and scroll to \"Stimmt mein Lohnzettel?\". Type the hours and amounts from your payslip. The app shows what matches and where a difference remains in hours or euros. You do not have to fill in every line.", "payslip check match compare wage slip"], ["Overtime and surcharges", "In Einstellungen you find weekly hours, the overtime model and surcharges. They come from your collective agreement (Kollektivvertrag). Your payslip shows whether they are right. You can change them at any time, also from a date onwards.", "overtime surcharge sunday saturday holiday night"], ["Daily allowance (Diäten)", "Diäten is the daily allowance, extra money paid per day. In Einstellungen, Diäten, you set whether it is paid per hour or per day in steps. You find the amount on your payslip.", "allowance diaeten diat per diem expenses meal"], ["Changing pay or job", "In Einstellungen you can change your wage or job from a date onwards. Old days stay calculated with the old values.", "wage change job raise salary"], ["Holiday or sick leave", "In Erfassen choose, at \"Art des Tages\" (Type of day), for example Urlaub (holiday), Krankenstand (sick leave) or Zeitausgleich (time off in lieu). Then you do not need to enter times.", "holiday vacation sick leave off"], ["My data", "Your entries are on your phone. With your account they are also stored on a secured server in Frankfurt so nothing gets lost. Technically the operator of the app could view them. Encryption that rules this out is being worked on. You type in your payslip numbers yourself.", "data privacy safe secure account personal"], ["Backup", "Under Profil you find \"Sicherung speichern oder teilen\". It saves a file with all your data. With it you can restore everything on a new phone.", "backup restore lost save file new phone"], ["Installing the app", "Open the page in the browser and tap \"App installieren\" (menu, top right). If Android warns you, tap \"Trotzdem installieren\" (install anyway). The app is safe, it is just this website.", "install icon home screen app"], ["Speech and reading aloud", "At the question field tap the microphone and speak. With the read button I read my answer aloud. The microphone needs internet and your permission in the browser.", "speech voice microphone read language"], ["Quieting Mia", "Tap \"Mia ruhig stellen\" and I will not speak up by myself. Under Profil you can switch me on again and change the figure and name.", "mia milo quiet silence name figure"], ["Deadlines and licences", "Open Profil (Profile) and scroll to \"Fristen und Ausweise\" (Deadlines and licences). Add Code 95, driver card, forklift licence or your own deadlines with an expiry date. I will remind you in time, and the date can go into your phone calendar if you like.", "deadline deadlines licence license code 95 driver card forklift crane expiry course training reminder"], ["Back payments, retroactive wage, special payments", "If the company paid something later or charged it back, enter it in the monthly check under “Nachzahlungen und Korrekturen” (back payments and corrections): which month, which line and how much. The app adds it to the earlier month. For “Stundenlohn aufgerollt” (hourly wage back-calculated) it shows you the calculation and whether the amount fits. Enter holiday bonus, Christmas bonus, 13th and 14th salary in the “Lohnzettel” tab under “Sonderzahlungen” (special payments).", "back payment nachzahlung retroactive aufroll correction christmas holiday bonus 13th 14th special hourly wage"]],
    pl: [
      ['Wpisywanie godzin', 'Otwórz Erfassen (wpisywanie). Wpisz początek (Beginn) i koniec (Ende), dodaj przerwy (Pausen) i dotknij Speichern (zapisz). Przyciskiem "Jetzt" wstawisz aktualną godzinę.', 'godzin godzine wpis czas praca poczatek koniec zapis'],
      ['Dodanie premii', 'Wejdź w Einstellungen (ustawienia), potem Prämien (premie) i dodaj swoją premię, np. za godzinę, dzień lub sztukę. Potem wpisujesz ją w danym dniu. Aplikacja ją policzy i porówna z paskiem wypłaty.', 'premi dodatek bonus'],
      ['Sprawdzenie paska wypłaty', 'Otwórz Übersicht (przegląd) i przewiń do "Stimmt mein Lohnzettel?". Przepisz godziny i kwoty z paska wypłaty. Aplikacja pokaże, co się zgadza i gdzie jest różnica w godzinach lub euro. Nie musisz wypełniać wszystkich wierszy.', 'pasek wyplat rozlicz sprawdz zgadza porown'],
      ['Nadgodziny i dodatki', 'W Einstellungen znajdziesz godziny tygodniowo, model nadgodzin i dodatki. Pochodzą z układu zbiorowego (Kollektivvertrag). Czy się zgadzają, widzisz na pasku wypłaty. Możesz je zmienić w każdej chwili, także od wybranej daty.', 'nadgodzin dodatek niedziel sobot swiet nocn'],
      ['Diety (Diäten)', 'Diäten to dieta, czyli dodatek dzienny. W Einstellungen, Diäten, ustawiasz, czy jest płacona za godzinę czy za dzień. Kwotę znajdziesz na pasku wypłaty.', 'diet diaet dzienn delegac'],
      ['Zmiana stawki lub zawodu', 'W Einstellungen możesz zmienić stawkę lub zawód od wybranej daty. Stare dni zostają policzone po starych wartościach.', 'stawk zmien zawod podwyzk wynagrodz'],
      ['Urlop lub zwolnienie', 'W Erfassen wybierz przy "Art des Tages" np. Urlaub (urlop), Krankenstand (zwolnienie) lub Zeitausgleich (odbiór nadgodzin). Wtedy nie musisz wpisywać godzin.', 'urlop zwolnien chorob l4 wolne'],
      ['Moje dane', 'Twoje wpisy są na Twoim telefonie. Z kontem są dodatkowo zapisywane na zabezpieczonym serwerze we Frankfurcie, żeby nic nie zginęło. Technicznie operator aplikacji mógłby je zobaczyć. Szyfrowanie, które to wyklucza, jest w przygotowaniu. Liczby z paska wypłaty wpisujesz sam.', 'dane ochron prywat bezpiecz konto'],
      ['Kopia zapasowa', 'W Profil znajdziesz "Sicherung speichern oder teilen". Zapisuje plik z wszystkimi danymi. Dzięki niemu odtworzysz wszystko na nowym telefonie.', 'kopia zapas backup odtworz zgubi'],
      ['Instalacja aplikacji', 'Otwórz stronę w przeglądarce i dotknij "App installieren" (menu u góry po prawej). Jeśli Android ostrzega, dotknij "Trotzdem installieren" (mimo to zainstaluj). Aplikacja jest bezpieczna, to po prostu ta strona.', 'instal ikon ekran aplikacj'],
      ['Mowa i czytanie', 'Przy pytaniu dotknij mikrofonu i mów. Przyciskiem czytania przeczytam odpowiedź na głos. Mikrofon potrzebuje internetu i Twojej zgody w przeglądarce.', 'mow mikrofon glos czyta jezyk'],
      ['Wyciszenie Mii', 'Dotknij "Mia ruhig stellen", a nie będę się odzywać sama. W Profil możesz mnie znów włączyć i zmienić postać oraz imię.', 'mia milo cisz wylacz imie postac'],
      ['Terminy i uprawnienia', 'Otwórz Profil i przewiń do "Fristen und Ausweise" (Terminy i uprawnienia). Dodaj Code 95, kartę kierowcy, uprawnienia na wózek lub własne terminy z datą ważności. Przypomnę ci na czas, a termin może trafić do kalendarza w telefonie.', 'termin terminy uprawnienia code 95 karta kierowcy wozek dzwig waznosc kurs szkolenie przypomnienie'],
      ["Dopłaty, wyrównanie stawki, wypłaty specjalne", "Jeśli firma później coś dopłaciła lub cofnęła, wpisz to w miesięcznym sprawdzeniu w „Nachzahlungen und Korrekturen” (dopłaty i korekty): za który miesiąc, który wiersz i ile. Aplikacja doliczy to do wcześniejszego miesiąca. Przy „Stundenlohn aufgerollt” (stawka przeliczona wstecz) pokaże obliczenie i czy kwota się zgadza. Ekwiwalent urlopowy, premię świąteczną, 13. i 14. pensję wpisz w zakładce „Lohnzettel” w „Sonderzahlungen” (wypłaty specjalne).", "doplata nachzahlung wyrownanie stawki korekta swiateczna urlopowy 13 14 specjalne stawka"],
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
      ['Mentés', 'A Profil részben van a "Sicherung speichern oder teilen". Ez egy fájlba menti az összes adatod. Ezzel új telefonon visszaállíthatsz mindent.', 'mentes backup visszaallit elveszett'],
      ['App telepítése', 'Nyisd meg az oldalt a böngészőben, és koppints az "App installieren" gombra (menü jobb felül). Ha az Android figyelmeztet, koppints a "Trotzdem installieren" (mégis telepít) gombra. Az app biztonságos, csak ez az oldal.', 'telepit ikon kezdokepernyo alkalmazas'],
      ['Beszéd és felolvasás', 'A kérdésmezőnél koppints a mikrofonra, és beszélj. A felolvasás gombbal hangosan felolvasom a választ. A mikrofonhoz internet és a böngészőben engedély kell.', 'beszed mikrofon hang felolvas nyelv'],
      ['Mia elnémítása', 'Koppints a "Mia ruhig stellen" gombra, és nem szólok magamtól. A Profil részben újra bekapcsolhatsz, és ott módosíthatod az alakot és a nevet.', 'mia milo nemit kikapcsol nev alak'],
      ['Határidők és igazolványok', 'Nyisd meg a Profilt, és görgess a "Fristen und Ausweise" (Határidők és igazolványok) részhez. Vedd fel a Code 95-öt, a sofőrkártyát, a targoncavezetői igazolványt vagy saját határidőket lejárati dátummal. Időben emlékeztetlek, és az időpont kérésre a telefon naptárába is kerül.', 'hatarido igazolvany code 95 sofor kartya targonca daru lejarat tanfolyam kepzes emlekezteto'],
      ["Utólagos kifizetés, visszamenőleges órabér, különleges kifizetések", "Ha a cég később fizetett vagy visszaszámolt valamit, add meg a havi ellenőrzésnél a „Nachzahlungen und Korrekturen” (utólagos kifizetések és javítások) alatt: melyik hónapra, melyik sorra és mennyit. Az app hozzáadja a korábbi hónaphoz. A „Stundenlohn aufgerollt” (visszamenőleg átszámolt órabér) esetén megmutatja a számítást és hogy stimmel-e az összeg. A szabadságpénzt, karácsonyi pénzt, 13. és 14. havi fizetést a „Lohnzettel” fülön a „Sonderzahlungen” (különleges kifizetések) alatt add meg.", "utolagos nachzahlung visszamenoleges orber javitas karacsonyi szabadsagpenz 13 14 kulonleges"],
    ],
    tr: [
      ['Saat girmek', 'Erfassen (kayıt) bölümünü aç. Başlangıcı (Beginn) ve bitişi (Ende) yaz, molaları (Pausen) ekle ve Speichern (kaydet) düğmesine dokun. "Jetzt" ile şu anki saat girilir.', 'saat gir kayit calisma baslangic bitis kaydet'],
      ['Prim eklemek', 'Einstellungen (ayarlar), sonra Prämien (primler) bölümüne git ve primini ekle, örneğin saat, gün veya adet başına. Sonra o günde girersin. Uygulama hesaplar ve maaş bordrosuyla karşılaştırır.', 'prim ek odeme bonus'],
      ['Maaş bordrosunu kontrol', 'Übersicht (genel bakış) bölümünü aç ve "Stimmt mein Lohnzettel?" kartına kadar kaydır. Bordrodaki saatleri ve tutarları yaz. Uygulama neyin tuttuğunu, saat veya euro olarak nerede fark olduğunu gösterir. Tüm satırları doldurman gerekmez.', 'bordro maas kontrol tutuyor karsilastir'],
      ['Fazla mesai ve zamlar', 'Einstellungen içinde haftalık saatleri, fazla mesai modelini ve zamları bulursun. Bunlar toplu iş sözleşmesinden (Kollektivvertrag) gelir. Doğru olup olmadığını bordrodan görürsün. İstediğin zaman, hatta bir tarihten itibaren değiştirebilirsin.', 'fazla mesai zam pazar cumartesi tatil gece'],
      ['Harcırah (Diäten)', 'Diäten günlük harcırahtır, yani ek günlük ödeme. Einstellungen, Diäten bölümünde saat başına mı yoksa gün başına kademeli mi ödendiğini ayarlarsın. Tutarı bordronda bulursun.', 'harcirah diaet gunluk yemek'],
      ['Ücret veya meslek değiştirmek', 'Einstellungen bölümünde ücreti veya mesleği bir tarihten itibaren değiştirebilirsin. Eski günler eski değerlerle hesaplanmış kalır.', 'ucret meslek degistir zam saatlik'],
      ['İzin veya hastalık', 'Erfassen içinde "Art des Tages" alanında örneğin Urlaub (izin), Krankenstand (hastalık izni) veya Zeitausgleich (mesai karşılığı izin) seç. O zaman saat girmen gerekmez.', 'izin hasta rapor tatil'],
      ['Verilerim', 'Kayıtların telefonunda durur. Hesabınla ayrıca Frankfurt’taki güvenli bir sunucuya da kaydedilir, hiçbir şey kaybolmasın diye. Teknik olarak uygulamanın işletmecisi bunları görebilir. Bunu engelleyen bir şifreleme üzerinde çalışılıyor. Bordrodaki sayıları kendin yazarsın.', 'veri gizlilik guvenlik hesap kisisel'],
      ['Yedekleme', 'Profil bölümünde "Sicherung speichern oder teilen" vardır. Tüm verilerini bir dosyaya kaydeder. Yeni telefonda her şeyi bununla geri yükleyebilirsin.', 'yedek yedekleme backup geri yukle kayboldu'],
      ['Uygulamayı kurmak', 'Siteyi tarayıcıda aç ve "App installieren" düğmesine dokun (sağ üstte menü). Android uyarırsa "Trotzdem installieren" (yine de kur) düğmesine dokun. Uygulama güvenlidir, sadece bu web sitesidir.', 'kur yukle ikon ana ekran uygulama'],
      ['Konuşma ve sesli okuma', 'Soru alanında mikrofona dokun ve konuş. Sesli okuma düğmesiyle cevabı yüksek sesle okurum. Mikrofon için internet ve tarayıcıda izin gerekir.', 'konus mikrofon ses oku dil'],
      ['Mia’yı susturmak', '"Mia ruhig stellen" düğmesine dokun, kendiliğimden konuşmam. Profil bölümünden beni tekrar açabilir, figürü ve adı değiştirebilirsin.', 'mia milo sustur kapat isim figur'],
      ['Süreler ve belgeler', 'Profil bölümünü aç ve "Fristen und Ausweise" (Süreler ve belgeler) kısmına kaydır. Code 95, sürücü kartı, forklift belgesi veya kendi sürelerini bitiş tarihiyle ekle. Seni zamanında uyarırım, tarih istersen telefon takvimine de girer.', 'sure belge code 95 surucu karti forklift vinc bitis kurs egitim hatirlatma'],
      ["Sonradan ödeme, geriye dönük ücret, özel ödemeler", "Şirket sonradan bir şey ödediyse veya geri aldıysa, bunu aylık kontrolde „Nachzahlungen und Korrekturen“ (sonradan ödemeler ve düzeltmeler) altına gir: hangi ay, hangi satır ve ne kadar. Uygulama bunu önceki aya ekler. „Stundenlohn aufgerollt“ (saatlik ücret geriye dönük hesaplandı) için hesabı ve tutarın uyup uymadığını gösterir. Tatil parasını, Noel ikramiyesini, 13. ve 14. maaşı „Lohnzettel“ sekmesinde „Sonderzahlungen“ (özel ödemeler) altına gir.", "sonradan odeme nachzahlung geriye donuk aufroll duzeltme noel tatil ikramiye 13 14 ozel saatlik ucret"],
    ]
  };
  function miaLang() { return uiLang(); }

  var MIA_X = {"en": ["What the app can do", "The app calculates your working time, breaks, overtime, allowances and bonuses and compares everything with your payslip. You can enter holiday, sick leave and time off in lieu, write notes on days, use the app in 13 languages and ask me anything. Tap a topic below for details.", "what can app everything function does features overview help"], "pl": ["Co potrafi aplikacja", "Aplikacja liczy Twój czas pracy, przerwy, nadgodziny, diety i premie i porównuje wszystko z Twoim paskiem wypłaty. Możesz wpisywać urlop, zwolnienie chorobowe i odbiór czasu wolnego, pisać notatki do dni, używać aplikacji w 13 językach i pytać mnie o wszystko. Dotknij tematu poniżej, aby poznać szczegóły.", "co potrafi aplikacja wszystko funkcje pomoc"], "hu": ["Mit tud az alkalmazás", "A Az alkalmazás kiszámolja a munkaidődet, a szüneteket, a túlórát, a napidíjat és a prémiumokat, és mindent összevet a bérjegyzékeddel. Rögzíthetsz szabadságot, betegszabadságot és szabadnapot, megjegyzéseket írhatsz a napokhoz, 13 nyelven használhatod az alkalmazást, és bármit megkérdezhetsz tőlem. Koppints lent egy témára a részletekért.", "mit tud alkalmazas minden funkcio segitseg"], "tr": ["Uygulama neler yapabilir", "Uygulama çalışma sürenizi, molaları, fazla mesaiyi, harcırahı ve primleri hesaplar ve hepsini bordronuzla karşılaştırır. İzin, hastalık ve serbest zaman girebilir, günlere not yazabilir, uygulamayı 13 dilde kullanabilir ve bana her şeyi sorabilirsin. Ayrıntı için aşağıdaki bir konuya dokun.", "uygulama neler yapabilir her sey ozellik yardim"], "hr": ["Što aplikacija može", "Aplikacija izračunava tvoje radno vrijeme, stanke, prekovremene sate, dnevnice i premije i sve uspoređuje s tvojom platnom listom. Možeš upisati godišnji odmor, bolovanje i slobodno vrijeme, pisati bilješke uz dane, koristiti aplikaciju na 13 jezika i pitati me bilo što. Dodirni temu ispod za više pojedinosti.", "sto aplikacija moze sve funkcije pomoc"], "sr": ["Šta aplikacija može", "Aplikacija izračunava tvoje radno vreme, pauze, prekovremene sate, dnevnice i premije i sve poredi sa tvojim platnim spiskom. Možeš upisati godišnji odmor, bolovanje i slobodno vreme, pisati beleške uz dane, koristiti aplikaciju na 13 jezika i pitati me bilo šta. Dodirni temu ispod za više detalja.", "sta aplikacija moze sve funkcije pomoc"], "it": ["Cosa sa fare l'app", "L'app calcola il tuo orario di lavoro, le pause, gli straordinari, le diarie e i premi e confronta tutto con la tua busta paga. Puoi inserire ferie, malattia e riposo compensativo, scrivere note sui giorni, usare l'app in 13 lingue e chiedermi qualsiasi cosa. Tocca un argomento qui sotto per i dettagli.", "cosa sa fare app tutto funzioni aiuto"], "ro": ["Ce poate aplicația", "Aplicația calculează timpul tău de lucru, pauzele, orele suplimentare, diurnele și primele și compară totul cu fluturașul de salariu. Poți introduce concediu, boală și timp liber compensatoriu, scrie notițe la zile, folosi aplicația în 13 limbi și mă poți întreba orice. Atinge un subiect mai jos pentru detalii.", "ce poate aplicatia tot functii ajutor"], "uk": ["Що вміє застосунок", "Застосунок розраховує твій робочий час, перерви, понаднормові, добові та премії й порівнює все з розрахунковим листком. Ти можеш вносити відпустку, лікарняний і відгул, писати нотатки до днів, користуватися застосунком 13 мовами й питати мене про що завгодно. Торкнись теми нижче, щоб дізнатися більше.", "що вміє застосунок все функції допомога"], "ru": ["Что умеет приложение", "Приложение рассчитывает твоё рабочее время, перерывы, сверхурочные, суточные и премии и сравнивает всё с расчётным листком. Ты можешь вносить отпуск, больничный и отгул, писать заметки к дням, пользоваться приложением на 13 языках и спрашивать меня о чём угодно. Коснись темы ниже, чтобы узнать подробнее.", "что умеет приложение все функции помощь"], "cs": ["Co aplikace umí", "Aplikace počítá tvou pracovní dobu, přestávky, přesčasy, diety a prémie a vše porovnává s výplatní páskou. Můžeš zapisovat dovolenou, nemoc a náhradní volno, psát poznámky ke dnům, používat aplikaci v 13 jazycích a ptát se mě na cokoli. Klepni na téma níže pro podrobnosti.", "co aplikace umi vse funkce pomoc"], "sk": ["Čo aplikácia vie", "Aplikácia počíta tvoj pracovný čas, prestávky, nadčasy, diéty a prémie a všetko porovnáva s výplatnou páskou. Môžeš zapisovať dovolenku, chorobu a náhradné voľno, písať poznámky ku dňom, používať aplikáciu v 13 jazykoch a pýtať sa ma na čokoľvek. Klepni na tému nižšie pre podrobnosti.", "co aplikacia vie vsetko funkcie pomoc"]};
  Object.keys(MIA_X).forEach(function (L) { if (MIA_TR[L]) MIA_TR[L].unshift(MIA_X[L]); });
  var MIA_X2 = {"en": [["News", "In your profile you find the \"News\" card. There you switch on that Mia tells you the news and set how often: right away, weekly or monthly. You only get what fits your job. If you want to see everything else too, switch on \"Also news for other jobs\".", "news notification new features"], ["Part-time, extra hours and time off in lieu", "If you work part-time and more than agreed, up to the full-time limit of your collective agreement that is extra work, not overtime. It carries a 25 % surcharge, unless you take the hours as time off 1:1 in the same calendar quarter. The app calculates this automatically. Your collective agreement may regulate it differently.", "part-time extra hours time off lieu surcharge quarter"], ["Parental leave, maternity protection, dad month", "In Erfassen choose parental leave, maternity protection or dad month at \"Art des Tages\". These days are unpaid and have no target hours. Parental leave reduces your holiday entitlement proportionally, maternity protection does not.", "parental leave karenz maternity papamonat dad baby"]], "pl": [["Nowości", "W profilu znajdziesz kartę „Nowości”. Tam włączasz, żeby Mia mówiła Ci nowości, i ustawiasz, jak często: od razu, co tydzień lub co miesiąc. Dostajesz tylko to, co pasuje do Twojego zawodu. Jeśli chcesz widzieć też resztę, włącz „Także nowości dla innych zawodów”.", "nowosci wiadomosci funkcje"], ["Niepełny etat, dodatkowa praca i czas wolny", "Jeśli pracujesz w niepełnym wymiarze i więcej niż uzgodniono, to do granicy pełnego etatu według Twojego układu zbiorowego jest to praca dodatkowa, a nie nadgodziny. Dodatek wynosi 25 %, chyba że odbierzesz godziny 1:1 jako czas wolny w tym samym kwartale. Aplikacja liczy to automatycznie. Twój układ zbiorowy może to regulować inaczej.", "niepelny etat dodatkowa praca czas wolny kwartal"], ["Urlop wychowawczy, ochrona macierzyństwa, miesiąc dla taty", "W Erfassen wybierz przy „Art des Tages” Karenz, Mutterschutz lub Papamonat. Te dni są niepłatne i nie mają godzin do przepracowania. Karenz proporcjonalnie skraca prawo do urlopu, Mutterschutz nie.", "urlop wychowawczy macierzynstwo tata karenz"]], "hu": [["Újdonságok", "A profilban megtalálod az „Újdonságok” kártyát. Ott kapcsolod be, hogy Mia elmondja az újdonságokat, és ott állítod be, milyen gyakran: azonnal, hetente vagy havonta. Csak azt kapod, ami a szakmádhoz illik. Ha mindent látni szeretnél, kapcsold be a „Más szakmák újdonságai is” opciót.", "ujdonsag hirek funkcio"], ["Részmunkaidő, többletmunka és szabadidő-kiegyenlítés", "Ha részmunkaidőben dolgozol, és többet az megállapodottnál, a kollektív szerződésed teljes munkaidős határáig ez többletmunka, nem túlóra. Pótléka 25 %, kivéve, ha az órákat ugyanabban a negyedévben 1:1 arányban szabadidőként veszed ki. Az app ezt automatikusan számolja. A kollektív szerződésed ezt másképp is szabályozhatja.", "reszmunkaido tobbletmunka szabadido negyedev"], ["Szülői szabadság, anyavédelem, apahónap", "Az Erfassen részben az „Art des Tages” mezőnél válaszd a Karenz, Mutterschutz vagy Papamonat lehetőséget. Ezek a napok fizetetlenek, és nincs kötelező óraszám. A Karenz arányosan csökkenti a szabadságot, a Mutterschutz nem.", "szuloi szabadsag anyavedelem apahonap karenz"]], "tr": [["Yenilikler", "Profilde „Yenilikler“ kartını bulursun. Orada Mia'nın sana yenilikleri söylemesini açar ve ne sıklıkla olacağını ayarlarsın: hemen, haftalık veya aylık. Sadece mesleğine uyanları alırsın. Geri kalanı da görmek istersen „Diğer meslekler için de yenilikler“i aç.", "yenilik haber ozellik"], ["Yarı zamanlı çalışma, ek çalışma ve izin", "Yarı zamanlı çalışıp anlaşılandan fazla çalışırsan, toplu sözleşmendeki tam zaman sınırına kadar bu fazla mesai değil ek çalışmadır. %25 zam vardır; saatleri aynı çeyrekte 1:1 izin olarak kullanırsan zam yoktur. Uygulama bunu otomatik hesaplar. Toplu sözleşmen bunu farklı düzenleyebilir.", "yari zamanli ek calisma izin ceyrek"], ["Ebeveyn izni, anne koruması, baba ayı", "Erfassen içinde „Art des Tages“ alanında Karenz, Mutterschutz veya Papamonat seç. Bu günler ücretsizdir ve hedef saati yoktur. Karenz yıllık izin hakkını orantılı kısaltır, Mutterschutz kısaltmaz.", "ebeveyn izni anne baba karenz"]]};
  Object.keys(MIA_X2).forEach(function (L) { if (MIA_TR[L]) MIA_X2[L].forEach(function (e) { MIA_TR[L].push(e); }); });
  Object.keys({"en": ["Flextime", "With flextime the app counts plus and minus hours on a flextime account. When setting up choose \"Office with flextime\", or in Einstellungen choose the overtime model \"Flextime\". There you enter the target time per weekday, optionally a starting balance and a carry-over limit. A flextime day (time off in lieu) takes the target time off the account, holiday and sick leave do not.", "flextime flex account balance plus minus hours"], "pl": ["Czas ruchomy", "Przy czasie ruchomym aplikacja liczy plusowe i minusowe godziny na koncie. Przy konfiguracji wybierz „Biuro z czasem ruchomym” lub w Einstellungen model nadgodzin „Gleitzeit”. Tam wpisujesz planowany czas na dzień, opcjonalnie saldo początkowe i limit przeniesienia. Dzień wolny w czasie ruchomym (odbiór) odejmuje planowany czas z konta, urlop i choroba nie.", "czas ruchomy konto saldo plus minus godziny"], "hu": ["Rugalmas munkaidő", "Rugalmas munkaidőnél az app a plusz és mínusz órákat egy számlán számolja. Beállításkor válaszd az „Iroda rugalmas munkaidővel” lehetőséget, vagy az Einstellungenben a „Gleitzeit” túlóra-modellt. Ott adod meg a napi előírt időt, opcionálisan a kezdő egyenleget és az átviteli határt. Egy rugalmas szabadnap (szabadidő-kiegyenlítés) levonja az előírt időt a számláról, a szabadság és a betegség nem.", "rugalmas munkaido szamla egyenleg plusz minusz"], "tr": ["Esnek çalışma saati", "Esnek çalışma saatinde uygulama artı ve eksi saatleri bir hesapta sayar. Kurulumda „Esnek mesaili ofis“i ya da Einstellungen içinde „Gleitzeit“ fazla mesai modelini seç. Orada günlük hedef süreyi, isteğe bağlı başlangıç bakiyesini ve devir sınırını girersin. Esnek izin günü (mesai karşılığı izin) hedef süreyi hesaptan düşer, yıllık izin ve hastalık düşmez.", "esnek mesai hesap bakiye artı eksi saat"]}).forEach(function (L) { if (MIA_TR[L]) MIA_TR[L].push(({"en": ["Flextime", "With flextime the app counts plus and minus hours on a flextime account. When setting up choose \"Office with flextime\", or in Einstellungen choose the overtime model \"Flextime\". There you enter the target time per weekday, optionally a starting balance and a carry-over limit. A flextime day (time off in lieu) takes the target time off the account, holiday and sick leave do not.", "flextime flex account balance plus minus hours"], "pl": ["Czas ruchomy", "Przy czasie ruchomym aplikacja liczy plusowe i minusowe godziny na koncie. Przy konfiguracji wybierz „Biuro z czasem ruchomym” lub w Einstellungen model nadgodzin „Gleitzeit”. Tam wpisujesz planowany czas na dzień, opcjonalnie saldo początkowe i limit przeniesienia. Dzień wolny w czasie ruchomym (odbiór) odejmuje planowany czas z konta, urlop i choroba nie.", "czas ruchomy konto saldo plus minus godziny"], "hu": ["Rugalmas munkaidő", "Rugalmas munkaidőnél az app a plusz és mínusz órákat egy számlán számolja. Beállításkor válaszd az „Iroda rugalmas munkaidővel” lehetőséget, vagy az Einstellungenben a „Gleitzeit” túlóra-modellt. Ott adod meg a napi előírt időt, opcionálisan a kezdő egyenleget és az átviteli határt. Egy rugalmas szabadnap (szabadidő-kiegyenlítés) levonja az előírt időt a számláról, a szabadság és a betegség nem.", "rugalmas munkaido szamla egyenleg plusz minusz"], "tr": ["Esnek çalışma saati", "Esnek çalışma saatinde uygulama artı ve eksi saatleri bir hesapta sayar. Kurulumda „Esnek mesaili ofis“i ya da Einstellungen içinde „Gleitzeit“ fazla mesai modelini seç. Orada günlük hedef süreyi, isteğe bağlı başlangıç bakiyesini ve devir sınırını girersin. Esnek izin günü (mesai karşılığı izin) hedef süreyi hesaptan düşer, yıllık izin ve hastalık düşmez.", "esnek mesai hesap bakiye artı eksi saat"]})[L]); });
  var MIA_X3 = {"en": ["No work / released by the company", "Choose “No work (released by the company)” under “Day type” in Erfassen when your company sends you home for lack of work. The note for the day is set automatically. How your company accounts for the day you set in Einstellungen under “Release from work (no work)”: company keeps paying, deducted from time off in lieu, or unpaid. If you do not know, the app deducts nothing. The AK also sees this as the basic rule: if you are ready to work and are sent home, you keep your pay. Your payslip shows whether it is right.", "released freistellung no work sent home lack of work time off in lieu"], "pl": ["Brak pracy / zwolnienie przez firmę", "W Erfassen wybierz przy „Art des Tages” „Brak pracy (zwolniony przez firmę)”, gdy firma odsyła cię do domu z braku pracy. Notatka do dnia ustawia się sama. Jak firma rozlicza ten dzień, ustawiasz w Einstellungen w „Zwolnienie z pracy (brak pracy)”: firma płaci dalej, odliczenie od czasu wolnego albo bezpłatnie. Jeśli nie wiesz, aplikacja niczego nie odlicza. AK też uznaje to za zasadę podstawową: kto jest gotowy do pracy i zostaje odesłany do domu, zachowuje wynagrodzenie. Na pasku wypłaty zobaczysz, czy się zgadza.", "zwolnienie brak pracy do domu czas wolny"], "hu": ["Nincs munka / a cég felmentette", "Az Erfassen-ben az „Art des Tages” mezőnél válaszd a „Nincs munka (a cég felmentette)” lehetőséget, ha a cég munkahiány miatt hazaküld. A naphoz tartozó jegyzet magától beállítódik. Hogy a cég hogyan számolja el a napot, az Einstellungen-ben a „Felmentés a munka alól (nincs munka)” alatt állíthatod be: a cég tovább fizet, levonás a szabadidőből, vagy fizetetlen. Ha nem tudod, az alkalmazás semmit nem von le. Az AK is ezt tekinti alapszabálynak: aki munkára kész és hazaküldik, megtartja a bérét. A bérszámfejtésen látod, hogy stimmel-e.", "felmentes nincs munka hazakuldott szabadido munkahiany"], "tr": ["İş yok / şirket serbest bıraktı", "Erfassen içinde „Art des Tages“ alanında şirket iş olmadığı için seni eve gönderdiğinde „İş yok (şirket serbest bıraktı)“ seçeneğini seç. Güne ait not otomatik ayarlanır. Şirketin günü nasıl hesapladığını Einstellungen içinde „İşten serbest bırakma (iş yok)“ altında ayarlarsın: şirket ödemeye devam eder, izinden düşülür ya da ücretsiz. Bilmiyorsan uygulama hiçbir şey düşmez. AK da bunu temel kural olarak görür: çalışmaya hazır olup eve gönderilen maaşını korur. Maaş bordronda doğru olup olmadığını görürsün.", "serbest birakma is yok eve gonderildi izin"]};
  Object.keys(MIA_X3).forEach(function (L) { if (MIA_TR[L]) MIA_TR[L].push(MIA_X3[L]); });
  var MIA_X4 = {"en": ["Time off in lieu: 1:1.5 or 1:1?", "The Working Time Act (§ 10) says: the overtime surcharge must be taken into account in the time off in lieu or paid out separately. With a 50 % surcharge that means either 1 overtime hour = 1.5 hours of time off, or 1:1 and the surcharge appears on your payslip. Your collective agreement may regulate it differently. Set it in Einstellungen under “How does your company credit overtime as time off in lieu?”. When you take the time off, it is deducted hour for hour. In Germany there is no statutory ratio, your contract applies.", "time off in lieu overtime surcharge 1:1.5 ratio"], "pl": ["Czas wolny: 1:1,5 czy 1:1?", "Ustawa o czasie pracy (§ 10) mówi: dodatek za nadgodziny trzeba uwzględnić przy czasie wolnym albo wypłacić osobno. Przy dodatku 50 % to albo 1 nadgodzina = 1,5 godziny wolnego, albo 1:1 i dodatek trafia na pasek wypłaty. Układ zbiorowy może to regulować inaczej. Ustaw w Einstellungen w „Jak twoja firma zapisuje nadgodziny jako czas wolny?”. Przy wykorzystaniu czas wolny jest odliczany godzina za godzinę. W Niemczech nie ma ustawowego stosunku, obowiązuje twoja umowa.", "czas wolny nadgodziny dodatek 1:1,5 stosunek"], "hu": ["Szabadidő: 1:1,5 vagy 1:1?", "A munkaidőtörvény (10. §) szerint: a túlóra-pótlékot figyelembe kell venni a szabadidőnél, vagy külön ki kell fizetni. 50 % pótléknál ez vagy 1 túlóra = 1,5 óra szabadidő, vagy 1:1 és a pótlék a bérszámfejtésen jelenik meg. A kollektív szerződés másként is szabályozhatja. Állítsd be az Einstellungen-ben: „Hogyan írja jóvá a cége a túlórát szabadidőként?“. Kivételkor a szabadidőt óráról órára vonják le. Németországban nincs törvényes arány, a szerződésed érvényes.", "szabadido tulora potlek 1:1,5 arany"], "tr": ["İzin: 1:1,5 mi 1:1 mi?", "Çalışma Süresi Yasası (§ 10) der ki: fazla mesai zammı izinde dikkate alınmalı veya ayrıca ödenmelidir. %50 zamda ya 1 fazla mesai saati = 1,5 saat izin, ya da 1:1 ve zam bordroya yansır. Toplu sözleşme bunu farklı düzenleyebilir. Einstellungen içinde „Şirketiniz fazla mesaiyi izin olarak nasıl yazıyor?“ altında ayarlayın. İzin kullanılırken saat saat düşülür. Almanya'da yasal oran yoktur, sözleşmeniz geçerlidir.", "izin fazla mesai zam 1:1,5 oran"]};
  Object.keys(MIA_X4).forEach(function (L) { if (MIA_TR[L]) MIA_TR[L].push(MIA_X4[L]); });
  var MIA_X5 = {"en": ["Where do I find this on my payslip?", "At the top of your payslip there is usually your name, the company, the month and often your grading, pay group and collective agreement (sometimes abbreviated “KV”). You find your hourly wage in the line “Lohn” or “Stundenlohn”, the hours next to it in the column “Menge”. Overtime is often on its own lines with 50 % or 100 %, time off in lieu on a line like “Zeitausgleich” or “Zeitkonto”, leave often as “Resturlaub”. Weekly hours are in your employment contract. If something is not on it, ask the office or payroll. If you do not know something, leave the field empty in the app. Until then the app calculates with the values of your collective agreement.", "payslip where find grading pay group collective agreement kv"], "pl": ["Gdzie to znajdę na pasku wypłaty?", "U góry paska wypłaty zwykle jest twoje imię, firma, miesiąc i często zaszeregowanie, grupa płacowa i układ zbiorowy (czasem skrót „KV”). Stawkę godzinową znajdziesz w wierszu „Lohn” lub „Stundenlohn”, godziny obok w kolumnie „Menge”. Nadgodziny często mają osobne wiersze z 50 % lub 100 %, czas wolny wiersz typu „Zeitausgleich” lub „Zeitkonto”, urlop często jako „Resturlaub”. Godziny tygodniowo są w umowie o pracę. Jeśli czegoś nie ma, zapytaj w biurze lub w księgowości płac. Jeśli czegoś nie wiesz, zostaw pole puste w aplikacji. Do tego czasu aplikacja liczy z wartościami z układu zbiorowego.", "pasek wyplaty gdzie znalezc zaszeregowanie grupa platnicza uklad zbiorowy kv"], "hu": ["Hol találom ezt a bérjegyzéken?", "A bérjegyzék tetején általában a neved, a cég, a hónap és gyakran a besorolás, a bércsoport és a kollektív szerződés áll (néha „KV” rövidítéssel). Az órabért a „Lohn” vagy „Stundenlohn” sorban találod, mellette az órákat a „Menge” oszlopban. A túlóra gyakran külön sorokban van 50 % vagy 100 %, a szabadidő egy „Zeitausgleich” vagy „Zeitkonto” jellegű sorban, a szabadság gyakran „Resturlaub” néven. A heti óraszám a munkaszerződésben áll. Ha valami nincs rajta, kérdezd meg az irodát vagy a bérszámfejtést. Amit nem tudsz, hagyd üresen az alkalmazásban. Addig az alkalmazás a kollektív szerződésed értékeivel számol.", "berjegyzek hol talalom besorolas bercsoport kollektiv szerzodes kv"], "tr": ["Bunu maaş bordrosunda nerede bulurum?", "Maaş bordrosunun üstünde genellikle adın, şirket, ay ve çoğu zaman sınıflandırma, ücret grubu ve toplu sözleşme yazar (bazen „KV“ kısaltmasıyla). Saatlik ücreti „Lohn“ veya „Stundenlohn“ satırında, yanındaki saatleri „Menge“ sütununda bulursun. Fazla mesai çoğu zaman 50 % veya 100 % ile ayrı satırlarda, izin „Zeitausgleich“ veya „Zeitkonto“ gibi bir satırda, yıllık izin çoğu zaman „Resturlaub“ olarak görünür. Haftalık saatler iş sözleşmesindedir. Bir şey yoksa ofise veya bordro birimine sor. Bir şeyi bilmiyorsan uygulamada alanı boş bırak. O zamana kadar uygulama toplu sözleşmenin değerleriyle hesaplar.", "bordro nerede bulurum siniflandirma ucret grubu toplu sozlesme kv"]};
  Object.keys(MIA_X5).forEach(function (L) { if (MIA_TR[L]) MIA_TR[L].push(MIA_X5[L]); });
  var MIA_X6 = {"en": [["I am an apprentice", "As an apprentice you get an apprentice's pay, usually a fixed monthly amount per year of training. In the settings, under “My job”, choose the type “Apprentice”. The app then shows only the training years of your collective agreement under the pay group, and with “Use minimum pay from the collective agreement” it enters the amount. If your training contract says a different amount, enter it under “Fixed monthly pay”. Vocational school counts as working time: enter the day as “Training / vocational school”, and a fixed school day every week under “Fixed days off”. Under 18 the youth employment law applies, as a rule at most 8 hours a day and 40 a week. The Chamber of Labour (Arbeiterkammer) helps with questions.", "apprentice trainee vocational school apprenticeship pay"], ["Allowances in construction and trades", "In construction and trades your payslip often shows allowances: dirt, hardship and danger allowance, daily allowance or distance allowance for work away from home, overnight allowance and assembly allowance. Create them under Settings, Bonuses; Mia gives you suggestions. In bad weather in construction and timber construction the BUAK pays part of the wage, and the app keeps bad-weather hours separate. In the painters’ trade you get 60 % of your pay when work is cancelled by weather. The amounts differ by collective agreement, please compare them with your payslip.", "allowance construction trade bad weather overnight assembly buak"]], "pl": [["Jestem uczniem (praktykantem)", "Jako uczeń dostajesz wynagrodzenie ucznia, zwykle stałą kwotę miesięczną za rok nauki. W ustawieniach w „Mój zawód” wybierz rodzaj „Uczeń”. Aplikacja pokaże wtedy przy grupie płacowej tylko lata nauki Twojego układu zbiorowego, a po wybraniu „Użyj płacy minimalnej z układu zbiorowego” wpisze kwotę. Jeśli w umowie o naukę jest inna kwota, wpisz ją w „Stała płaca miesięczna”. Szkoła zawodowa liczy się jako czas pracy: wpisz ten dzień jako „Szkolenie / szkoła zawodowa”, stały dzień szkolny w każdym tygodniu w „Stałe dni wolne”. Poniżej 18 lat obowiązuje ustawa o ochronie młodzieży, zasadniczo najwyżej 8 godzin dziennie i 40 tygodniowo. W razie pytań pomoże Izba Pracy (Arbeiterkammer).", "uczen praktykant szkola zawodowa nauka wynagrodzenie"], ["Dodatki w budownictwie i rzemiośle", "W budownictwie i rzemiośle na pasku wypłaty często są dodatki: za brudną, uciążliwą i niebezpieczną pracę, dieta lub dodatek za odległość przy pracy poza domem, dodatek za nocleg i za montaż. Dodaj je w Ustawienia, Premie, Mia podpowie Ci pasujące. Przy złej pogodzie w budownictwie i budownictwie drewnianym część płacy wypłaca BUAK, aplikacja prowadzi godziny złej pogody osobno. W malarstwie przy odwołaniu pracy z powodu pogody dostaje się 60 % płacy. Kwoty są różne w zależności od układu zbiorowego, porównaj je z paskiem wypłaty.", "dodatek budownictwo rzemioslo zla pogoda nocleg montaz buak"]], "hu": [["Tanuló vagyok", "Tanulóként tanulói juttatást kapsz, általában tanévenként fix havi összeget. A beállításokban a „Szakmám” alatt válaszd a „Tanuló” típust. Az app ekkor a bérkategóriánál csak a kollektív szerződésed tanéveit mutatja, a „Kollektív szerződés szerinti minimálbér használata” gombbal pedig beírja az összeget. Ha a tanszerződésedben más összeg áll, írd be a „Fix havi bér” mezőbe. A szakiskola munkaidőnek számít: a napot „Képzés / szakiskola” néven írd be, a heti fix iskolanapot a „Fix szabadnapok” alatt. 18 év alatt az ifjúságvédelmi törvény érvényes, főszabály szerint legfeljebb napi 8 és heti 40 óra. Kérdés esetén az Arbeiterkammer segít.", "tanulo tanonc szakiskola kepzes juttatas"], ["Pótlékok az építőiparban és a kisiparban", "Az építőiparban és a kisiparban a bérjegyzéken gyakran szerepelnek pótlékok: piszok-, megterhelési és veszélyességi pótlék, napidíj vagy távolsági pótlék házon kívüli munkánál, szállásdíj és szerelési pótlék. Vedd fel őket a Beállítások, Prémiumok alatt, Mia javaslatokat tesz. Rossz időben az építőiparban és a faépítésben a BUAK fizeti a bér egy részét, az app a rossz idő óráit külön vezeti. A festőiparban időjárás miatti kiesésnél a bér 60 %-a jár. Az összegek kollektív szerződésenként eltérnek, hasonlítsd össze őket a bérjegyzékeddel.", "potlek epitoipar kisipar rossz ido szallas szereles buak"]], "tr": [["Çırağım (stajyer)", "Çırak olarak çıraklık ücreti alırsın, genelde öğrenim yılı başına sabit aylık tutar. Ayarlarda „Mesleğim“ altında „Çırak“ türünü seç. Uygulama ücret grubunda yalnızca toplu sözleşmenin öğrenim yıllarını gösterir ve „Toplu sözleşmedeki asgari ücreti kullan“ ile tutarı kendisi yazar. Çıraklık sözleşmende başka bir tutar varsa „Sabit aylık ücret“ alanına yaz. Meslek okulu çalışma süresi sayılır: günü „Eğitim / meslek okulu“ olarak gir, her hafta sabit okul gününü „Sabit boş günler“ altına gir. 18 yaşın altında gençlik koruma yasası geçerlidir, kural olarak günde en fazla 8 ve haftada 40 saat. Sorularda Arbeiterkammer yardımcı olur.", "cirak stajyer meslek okulu egitim ucret"], ["İnşaat ve zanaatta ödenekler", "İnşaat ve zanaatta maaş bordrosunda çoğu zaman ödenekler olur: kir, zorluk ve tehlike ödeneği, evden uzak çalışmada gündelik veya mesafe ödeneği, konaklama ve montaj ödeneği. Bunları Ayarlar, Primler altında ekle, Mia sana uygun öneriler yapar. İnşaat ve ahşap yapıda kötü havada ücretin bir kısmını BUAK öder, uygulama kötü hava saatlerini ayrı tutar. Boyacılıkta hava nedeniyle iş iptalinde ücretin %60’ı ödenir. Tutarlar toplu sözleşmeye göre değişir, lütfen maaş bordronla karşılaştır.", "odenek insaat zanaat kotu hava konaklama montaj buak"]]};
  Object.keys(MIA_X6).forEach(function (L) { if (MIA_TR[L]) MIA_X6[L].forEach(function (e) { MIA_TR[L].push(e); }); });
  var MIA_X7 = {"en": ["Cleaning, security and nursing", "In these jobs a lot happens in night, Sunday and public holiday shifts. Enter the times as you worked them, also past midnight: the hours count for the day the shift starts. Surcharges and allowances (for example night allowance, meal allowance, on-call duty) are on your payslip: create them under Settings, Bonuses, and Mia will suggest the right ones. If another collective agreement applies to you (for example a state hospital), choose “Own values”."], "pl": ["Sprzątanie, ochrona i pielęgniarstwo", "W tych zawodach wiele dzieje się na służbach nocnych, niedzielnych i świątecznych. Wpisuj czasy tak, jak pracowałeś, także po północy: godziny liczą się do dnia, w którym zaczęła się służba. Dodatki (na przykład dodatek nocny, dieta, dyżur pod telefonem) są na odcinku płacowym: załóż je w Ustawieniach w Premiach, Mia podpowie ci właściwe. Jeśli obowiązuje cię inny układ zbiorowy (na przykład szpital krajowy), wybierz „Własne wartości”."], "hu": ["Takarítás, biztonsági szolgálat és ápolás", "Ezekben a szakmákban sok minden éjszakai, vasárnapi és ünnepnapi szolgálatban történik. A időket úgy add meg, ahogy dolgoztál, éjfélen túl is: az órák arra a napra számítanak, amelyen a szolgálat kezdődött. A pótlékok (például éjszakai pótlék, étkezési pótlék, készenlét) a bérjegyzéken vannak: vedd fel őket a Beállítások, Prémiumok alatt, Mia megfelelőket javasol. Ha rád másik kollektív szerződés vonatkozik (például tartományi kórház), válaszd az „Egyéni értékek” lehetőséget."], "tr": ["Temizlik, güvenlik ve hemşirelik", "Bu mesleklerde çok şey gece, pazar ve resmi tatil vardiyalarında olur. Saatleri çalıştığın gibi gir, gece yarısından sonrasını da: saatler, vardiyanın başladığı güne sayılır. Zamlar ve ödenekler (örneğin gece ödeneği, yemek ödeneği, nöbet bekleme) bordronda yazar: bunları Ayarlar, Primler altında ekle, Mia sana uygun olanları önerir. Sana başka bir toplu sözleşme uygulanıyorsa (örneğin eyalet hastanesi) „Kendi değerlerim“i seç."]};
  Object.keys(MIA_X7).forEach(function (L) { if (MIA_TR[L]) MIA_TR[L].push(MIA_X7[L]); });
  var MIA_X8 = {"en": ["Clock change (summer time, winter time)", "The app includes the clock change automatically. In October the clocks go back from 3:00 to 2:00: anyone working that night has worked one hour more. A night shift from 22:00 to 6:00 then counts 9 instead of 8 hours. In March the clocks go forward from 2:00 to 3:00: one hour is missing and the shift counts 7 instead of 8 hours. Simply enter start and end as the clock showed them. Whether your company pays the extra hour is set in your collective agreement or works agreement: check your payslip. If it differs, you can adjust the hours in the day yourself."], "pl": ["Zmiana czasu (czas letni, czas zimowy)", "Aplikacja uwzględnia zmianę czasu automatycznie. W październiku zegar cofa się z 3:00 na 2:00: kto pracuje tej nocy, przepracował o godzinę więcej. Nocna zmiana od 22:00 do 6:00 liczy się wtedy jako 9 zamiast 8 godzin. W marcu zegar przesuwa się z 2:00 na 3:00: brakuje jednej godziny, zmiana liczy się jako 7 zamiast 8 godzin. Wpisz po prostu początek i koniec tak, jak pokazywał zegar. To, czy firma płaci za dodatkową godzinę, wynika z układu zbiorowego lub porozumienia zakładowego: sprawdź odcinek płacowy. W razie różnic możesz sam poprawić godziny w danym dniu."], "hu": ["Óraátállítás (nyári idő, téli idő)", "Az alkalmazás automatikusan beszámítja az óraátállítást. Októberben az órát 3 óráról 2 órára állítják vissza: aki ezen az éjszakán dolgozik, egy órával többet dolgozott. Egy 22-től 6 óráig tartó éjszakai műszak ekkor 8 helyett 9 órának számít. Márciusban az órát 2 óráról 3 órára állítják előre: egy óra hiányzik, a műszak 8 helyett 7 órának számít. Egyszerűen úgy add meg a kezdést és a végét, ahogy az óra mutatta. Hogy a cég kifizeti-e a többletórát, azt a kollektív szerződés vagy az üzemi megállapodás szabályozza: nézd meg a bérjegyzéket. Eltérés esetén magad is módosíthatod az órákat a napon belül."], "tr": ["Saat değişikliği (yaz saati, kış saati)", "Uygulama saat değişikliğini otomatik hesaba katar. Ekim ayında saat 3:00'ten 2:00'ye geri alınır: o gece çalışan bir saat fazla çalışmış olur. 22:00 ile 6:00 arası bir gece vardiyası bu durumda 8 yerine 9 saat sayılır. Mart ayında saat 2:00'den 3:00'e ileri alınır: bir saat eksiktir, vardiya 8 yerine 7 saat sayılır. Başlangıç ve bitişi saatin gösterdiği gibi gir. Şirketinin fazladan saati ödeyip ödemediği toplu sözleşmende veya işyeri anlaşmanda yazar: bordronda kontrol et. Fark varsa gün içindeki saatleri kendin düzeltebilirsin."]};
  Object.keys(MIA_X8).forEach(function (L) { if (MIA_TR[L]) MIA_TR[L].push(MIA_X8[L]); });
  var MIA_X9 = {"en": ["What is the pay group and do I need it?", "The pay group (or grade) decides which minimum wage the collective agreement gives you. You do not have to know it: just enter your hourly wage from the payslip. If you know it, the app can check whether your pay matches the collective agreement. You find it at the top of the payslip (under \"Einstufung\", \"Lohngruppe\" or \"Verwendungsgruppe\") or in your employment contract. If it is nowhere, ask at your company.", "pay group wage grade classification minimum wage need"], "pl": ["Czym jest grupa płacowa i czy jej potrzebuję?", "Grupa płacowa (lub zaszeregowanie) określa, jaką płacę minimalną przyznaje ci układ zbiorowy. Nie musisz jej znać: wpisz po prostu swoją stawkę godzinową z odcinka płacowego. Jeśli ją znasz, aplikacja może sprawdzić, czy twoje wynagrodzenie odpowiada układowi zbiorowemu. Znajdziesz ją na górze odcinka płacowego (przy „Einstufung”, „Lohngruppe” lub „Verwendungsgruppe”) albo w umowie o pracę. Jeśli nigdzie jej nie ma, zapytaj w firmie.", "grupa płacowa zaszeregowanie płaca minimalna"], "hu": ["Mi a bércsoport, és szükségem van rá?", "A bércsoport (vagy besorolás) határozza meg, milyen minimálbért biztosít neked a kollektív szerződés. Nem kell ismerned: add meg egyszerűen az órabéredet a bérjegyzékről. Ha ismered, az app ellenőrizheti, hogy a béred megfelel-e a kollektív szerződésnek. A bérjegyzék tetején találod („Einstufung”, „Lohngruppe” vagy „Verwendungsgruppe” mellett) vagy a munkaszerződésben. Ha sehol nincs, kérdezd meg a cégnél.", "bércsoport besorolás minimálbér"], "tr": ["Ücret grubu nedir ve buna ihtiyacım var mı?", "Ücret grubu (veya sınıflandırma), toplu sözleşmenin sana hangi asgari ücreti tanıdığını belirler. Bilmek zorunda değilsin: bordrondaki saatlik ücretini gir. Biliyorsan uygulama ücretinin toplu sözleşmeye uygun olup olmadığını kontrol edebilir. Bordronun üstünde („Einstufung“, „Lohngruppe“ veya „Verwendungsgruppe“ yanında) ya da iş sözleşmende bulursun. Hiçbir yerde yoksa şirketinde sor.", "ücret grubu sınıflandırma asgari ücret"], "cs": ["Co je mzdová skupina a potřebuji ji?", "Mzdová skupina (nebo zařazení) určuje, jakou minimální mzdu ti přiznává kolektivní smlouva. Nemusíš ji znát: stačí zadat hodinovou mzdu z výplatní pásky. Pokud ji znáš, aplikace může zkontrolovat, zda tvoje mzda odpovídá kolektivní smlouvě. Najdeš ji nahoře na výplatní pásce (u „Einstufung“, „Lohngruppe“ nebo „Verwendungsgruppe“) nebo v pracovní smlouvě. Pokud není nikde uvedena, zeptej se ve firmě."], "sk": ["Čo je mzdová skupina a potrebujem ju?", "Mzdová skupina (alebo zaradenie) určuje, akú minimálnu mzdu ti priznáva kolektívna zmluva. Nemusíš ju poznať: stačí zadať hodinovú mzdu z výplatnej pásky. Ak ju poznáš, aplikácia môže skontrolovať, či tvoja mzda zodpovedá kolektívnej zmluve. Nájdeš ju hore na výplatnej páske (pri „Einstufung“, „Lohngruppe“ alebo „Verwendungsgruppe“) alebo v pracovnej zmluve. Ak nie je nikde uvedená, spýtaj sa vo firme."], "hr": ["Što je platna skupina i trebam li je?", "Platna skupina (ili razvrstavanje) određuje koju minimalnu plaću ti jamči kolektivni ugovor. Ne moraš je znati: samo upiši svoju satnicu s platne liste. Ako je znaš, aplikacija može provjeriti odgovara li tvoja plaća kolektivnom ugovoru. Pronaći ćeš je na vrhu platne liste (uz „Einstufung“, „Lohngruppe“ ili „Verwendungsgruppe“) ili u ugovoru o radu. Ako je nigdje nema, pitaj u firmi."], "sr": ["Šta je platna grupa i da li mi treba?", "Platna grupa (ili razvrstavanje) određuje koju minimalnu platu ti garantuje kolektivni ugovor. Ne moraš da je znaš: samo upiši svoju satnicu sa platne liste. Ako je znaš, aplikacija može da proveri da li tvoja plata odgovara kolektivnom ugovoru. Naći ćeš je na vrhu platne liste (uz „Einstufung“, „Lohngruppe“ ili „Verwendungsgruppe“) ili u ugovoru o radu. Ako je nigde nema, pitaj u firmi."], "it": ["Che cos'è il gruppo retributivo e mi serve?", "Il gruppo retributivo (o inquadramento) stabilisce quale retribuzione minima ti spetta secondo il contratto collettivo. Non devi conoscerlo: inserisci semplicemente la tua paga oraria dalla busta paga. Se lo conosci, l'app può verificare se la tua paga corrisponde al contratto collettivo. Lo trovi in alto sulla busta paga (alla voce „Einstufung“, „Lohngruppe“ o „Verwendungsgruppe“) o nel contratto di lavoro. Se non c'è da nessuna parte, chiedi in azienda."], "ro": ["Ce este grupa salarială și am nevoie de ea?", "Grupa salarială (sau încadrarea) stabilește ce salariu minim ți se cuvine conform contractului colectiv. Nu trebuie să o cunoști: introdu pur și simplu salariul tău orar din fluturașul de salariu. Dacă o cunoști, aplicația poate verifica dacă salariul tău corespunde contractului colectiv. O găsești sus pe fluturașul de salariu (la „Einstufung”, „Lohngruppe” sau „Verwendungsgruppe”) sau în contractul de muncă. Dacă nu apare nicăieri, întreabă la firmă."], "ru": ["Что такое тарифная группа и нужна ли она мне?", "Тарифная группа (или разряд) определяет, какую минимальную зарплату тебе гарантирует коллективный договор. Знать её не обязательно: просто введи свою почасовую ставку из расчётного листка. Если ты её знаешь, приложение может проверить, соответствует ли твоя оплата коллективному договору. Ты найдёшь её вверху расчётного листка (у «Einstufung», «Lohngruppe» или «Verwendungsgruppe») или в трудовом договоре. Если её нигде нет, спроси в фирме."], "uk": ["Що таке тарифна група і чи вона мені потрібна?", "Тарифна група (або розряд) визначає, яку мінімальну зарплату тобі гарантує колективний договір. Знати її необов'язково: просто введи свою погодинну ставку з розрахункового листка. Якщо ти її знаєш, застосунок може перевірити, чи відповідає твоя оплата колективному договору. Ти знайдеш її вгорі розрахункового листка (біля «Einstufung», «Lohngruppe» або «Verwendungsgruppe») або в трудовому договорі. Якщо її ніде немає, запитай у фірмі."]};
  Object.keys(MIA_X9).forEach(function (L) { if (MIA_TR[L]) MIA_TR[L].push(MIA_X9[L]); });
  var MIA_X10 = {"en": ["I am missing some data, can I still start?", "Yes, you can start right away, even if wage, grade or other details are still missing. Enter what you already have, for example your working hours. You can add missing values in the settings at any time. The app then automatically recalculates all days you have already entered, correctly. Only the comparison with the payslip in euros has to wait until your hourly wage is entered.", "missing data start incomplete later add retroactive"], "pl": ["Brakuje mi jeszcze danych, czy mogę zacząć?", "Tak, możesz zacząć od razu, nawet jeśli brakuje stawki, zaszeregowania lub innych danych. Wpisz to, co już masz, na przykład godziny pracy. Brakujące wartości możesz uzupełnić w ustawieniach w każdej chwili. Aplikacja automatycznie i poprawnie przeliczy wtedy wszystkie dni, które już wpisałeś. Tylko porównanie z odcinkiem płacowym w euro musi poczekać, aż wpiszesz stawkę godzinową.", "brakuje dane zacząć niekompletne później"], "hu": ["Még hiányzik néhány adatom, elkezdhetem mégis?", "Igen, azonnal elkezdheted, akkor is, ha a bér, a besorolás vagy más még hiányzik. Add meg, amid már van, például a munkaidődet. A hiányzó értékeket bármikor pótolhatod a beállításokban. Az app ekkor automatikusan és helyesen újraszámolja az összes már beírt napot is. Csak a bérjegyzékkel való euró-összehasonlításhoz kell megadni az órabért.", "hiányzik adat elkezdeni később pótol"], "tr": ["Bazı verilerim eksik, yine de başlayabilir miyim?", "Evet, ücret, sınıflandırma veya başka bilgiler eksik olsa bile hemen başlayabilirsin. Elindekini gir, örneğin çalışma saatlerini. Eksik değerleri istediğin zaman ayarlardan ekleyebilirsin. Uygulama daha önce girdiğin tüm günleri otomatik ve doğru olarak yeniden hesaplar. Yalnızca bordroyla euro karşılaştırması saatlik ücretin girilmesini bekler.", "eksik veri başlamak sonra ekle"], "cs": ["Chybí mi ještě údaje, mohu přesto začít?", "Ano, můžeš začít hned, i když ještě chybí mzda, zařazení nebo jiné údaje. Zadej, co už máš, například pracovní dobu. Chybějící hodnoty můžeš kdykoli doplnit v nastavení. Aplikace pak automaticky a správně přepočítá všechny dny, které jsi už zadal. Jen porovnání s výplatní páskou v eurech počká, až zadáš hodinovou mzdu."], "sk": ["Chýbajú mi ešte údaje, môžem aj tak začať?", "Áno, môžeš začať hneď, aj keď ešte chýba mzda, zaradenie alebo iné údaje. Zadaj, čo už máš, napríklad pracovný čas. Chýbajúce hodnoty môžeš kedykoľvek doplniť v nastaveniach. Aplikácia potom automaticky a správne prepočíta všetky dni, ktoré si už zadal. Len porovnanie s výplatnou páskou v eurách počká, kým zadáš hodinovú mzdu."], "hr": ["Nedostaju mi još podaci, mogu li ipak početi?", "Da, možeš odmah početi, čak i ako još nedostaju plaća, razvrstavanje ili drugi podaci. Upiši što već imaš, na primjer radno vrijeme. Nedostajuće vrijednosti možeš u bilo kojem trenutku dodati u postavkama. Aplikacija će tada automatski i ispravno ponovno izračunati sve dane koje si već upisao. Samo usporedba s platnom listom u eurima čeka dok ne upišeš satnicu."], "sr": ["Nedostaju mi još podaci, mogu li ipak da počnem?", "Da, možeš odmah da počneš, čak i ako još nedostaju plata, razvrstavanje ili drugi podaci. Upiši šta već imaš, na primer radno vreme. Nedostajuće vrednosti možeš bilo kada da dodaš u podešavanjima. Aplikacija će tada automatski i ispravno ponovo izračunati sve dane koje si već upisao. Samo poređenje sa platnom listom u evrima čeka dok ne upišeš satnicu."], "it": ["Mi mancano ancora dei dati, posso comunque iniziare?", "Sì, puoi iniziare subito, anche se mancano ancora paga, inquadramento o altro. Inserisci ciò che hai già, per esempio l'orario di lavoro. I valori mancanti puoi aggiungerli in qualsiasi momento nelle impostazioni. L'app ricalcola poi automaticamente e in modo corretto tutti i giorni già inseriti. Solo il confronto in euro con la busta paga deve aspettare che tu inserisca la paga oraria."], "ro": ["Îmi lipsesc încă date, pot totuși să încep?", "Da, poți începe imediat, chiar dacă încă lipsesc salariul, încadrarea sau altele. Introdu ce ai deja, de exemplu orele de lucru. Valorile lipsă le poți adăuga oricând în setări. Aplicația recalculează apoi automat și corect toate zilele pe care le-ai introdus deja. Doar compararea în euro cu fluturașul de salariu așteaptă până introduci salariul orar."], "ru": ["Мне ещё не хватает данных, можно ли всё равно начать?", "Да, можно начать сразу, даже если ещё не хватает ставки, разряда или другого. Введи то, что уже есть, например рабочее время. Недостающие значения можно в любой момент добавить в настройках. Приложение тогда автоматически и правильно пересчитает все уже введённые дни. Только сравнение с расчётным листком в евро ждёт, пока ты введёшь почасовую ставку."], "uk": ["Мені ще бракує даних, чи можна все одно почати?", "Так, можна почати одразу, навіть якщо ще бракує ставки, розряду чи іншого. Введи те, що вже є, наприклад робочий час. Відсутні значення можна будь-коли додати в налаштуваннях. Застосунок тоді автоматично й правильно перерахує всі вже введені дні. Лише порівняння з розрахунковим листком у євро чекає, доки ти введеш погодинну ставку."]};
  Object.keys(MIA_X10).forEach(function (L) { if (MIA_TR[L]) MIA_TR[L].push(MIA_X10[L]); });
  var MIA_X11 = {"en": ["Where do I find the feedback to the developer?", "At the bottom left of the app is the \"Report a problem\" button. Tap it, choose for example \"Something is wrong\" or \"Suggestion\" under \"What is it about?\", write your message and tap Send. The app also sends a picture of the current page, which you can switch off. Afterwards you see a confirmation. You also find the feedback in your profile under \"Feedback to the developer\".", "feedback developer report problem suggestion contact where"], "pl": ["Gdzie znajdę wiadomość do twórcy?", "W lewym dolnym rogu aplikacji jest przycisk „Zgłoś problem”. Dotknij go, wybierz przy „O co chodzi?” na przykład „Coś się nie zgadza” lub „Sugestia”, napisz wiadomość i dotknij Wyślij. Aplikacja dołącza zdjęcie bieżącej strony, możesz to wyłączyć. Potem zobaczysz potwierdzenie. Wiadomość do twórcy znajdziesz też w profilu.", "opinia twórca zgłoś problem sugestia kontakt gdzie"], "hu": ["Hol találom a fejlesztőnek szóló visszajelzést?", "Az app bal alsó sarkában van a „Probléma jelentése” gomb. Koppints rá, válaszd ki a „Miről van szó?” alatt például a „Valami nem stimmel” vagy a „Javaslat” lehetőséget, írd meg az üzeneted, és koppints a Küldés gombra. Az app elküldi az aktuális oldal képét is, ezt kikapcsolhatod. Utána megerősítést látsz. A visszajelzést a profilban is megtalálod.", "visszajelzés fejlesztő probléma javaslat kontakt hol"], "tr": ["Geliştiriciye geri bildirimi nerede bulurum?", "Uygulamanın sol altında „Sorun bildir“ düğmesi var. Dokun, „Konu nedir?“ altında örneğin „Bir şey yanlış“ veya „Öneri“yi seç, mesajını yaz ve Gönder'e dokun. Uygulama geçerli sayfanın bir görüntüsünü de gönderir, bunu kapatabilirsin. Sonra bir onay görürsün. Geri bildirimi profilinde de bulursun.", "geri bildirim geliştirici sorun öneri iletişim nerede"], "cs": ["Kde najdu zpětnou vazbu pro vývojáře?", "Vlevo dole v aplikaci je tlačítko „Nahlásit problém“. Klepni na něj, u „O co jde?“ vyber například „Něco nesedí“ nebo „Podnět“, napiš zprávu a klepni na Odeslat. Aplikace přiloží i obrázek aktuální stránky, můžeš to vypnout. Potom uvidíš potvrzení. Zpětnou vazbu najdeš i v profilu."], "sk": ["Kde nájdem spätnú väzbu pre vývojára?", "Vľavo dole v aplikácii je tlačidlo „Nahlásiť problém“. Klepni naň, pri „O čo ide?“ vyber napríklad „Niečo nesedí“ alebo „Podnet“, napíš správu a klepni na Odoslať. Aplikácia priloží aj obrázok aktuálnej stránky, môžeš to vypnúť. Potom uvidíš potvrdenie. Spätnú väzbu nájdeš aj v profile."], "hr": ["Gdje nalazim povratnu informaciju za razvojnog programera?", "Dolje lijevo u aplikaciji je gumb „Prijavi problem“. Dodirni ga, kod „O čemu je riječ?“ odaberi na primjer „Nešto ne stoji“ ili „Prijedlog“, napiši poruku i dodirni Pošalji. Aplikacija šalje i sliku trenutne stranice, to možeš isključiti. Zatim vidiš potvrdu. Povratnu informaciju nalaziš i u profilu."], "sr": ["Gde nalazim povratnu informaciju za programera?", "Dole levo u aplikaciji je dugme „Prijavi problem“. Dodirni ga, kod „O čemu je reč?“ izaberi na primer „Nešto ne stoji“ ili „Predlog“, napiši poruku i dodirni Pošalji. Aplikacija šalje i sliku trenutne stranice, to možeš da isključiš. Zatim vidiš potvrdu. Povratnu informaciju nalaziš i u profilu."], "it": ["Dove trovo il feedback allo sviluppatore?", "In basso a sinistra nell'app c'è il pulsante „Segnala un problema“. Toccalo, alla voce „Di cosa si tratta?“ scegli per esempio „Qualcosa non torna“ o „Suggerimento“, scrivi il messaggio e tocca Invia. L'app invia anche un'immagine della pagina attuale, che puoi disattivare. Poi vedi una conferma. Il feedback lo trovi anche nel profilo."], "ro": ["Unde găsesc feedback-ul către dezvoltator?", "În stânga jos în aplicație este butonul „Raportează o problemă“. Atinge-l, la „Despre ce este vorba?“ alege de exemplu „Ceva nu e în regulă“ sau „Sugestie“, scrie mesajul și atinge Trimite. Aplicația trimite și o imagine a paginii curente, pe care o poți dezactiva. Apoi vezi o confirmare. Feedback-ul îl găsești și în profil."], "ru": ["Где найти отзыв разработчику?", "Внизу слева в приложении есть кнопка «Сообщить о проблеме». Нажми её, в разделе «О чём речь?» выбери, например, «Что-то не так» или «Предложение», напиши сообщение и нажми «Отправить». Приложение также отправляет снимок текущей страницы, его можно отключить. Потом ты увидишь подтверждение. Отзыв можно найти и в профиле."], "uk": ["Де знайти відгук для розробника?", "Внизу ліворуч у застосунку є кнопка «Повідомити про проблему». Натисни її, у розділі «Про що йдеться?» вибери, наприклад, «Щось не так» або «Пропозиція», напиши повідомлення й натисни «Надіслати». Застосунок також надсилає знімок поточної сторінки, його можна вимкнути. Потім ти побачиш підтвердження. Відгук можна знайти й у профілі."]};
  Object.keys(MIA_X11).forEach(function (L) { if (MIA_TR[L]) MIA_TR[L].push(MIA_X11[L]); });
  /* ---- Mia beantwortet Fragen (feste Antworten, kein Server) + Spracheingabe + Vorlesen ---- */
  var MIA_FAQ = [
    { t: 'Was die App kann', k: ['kann', 'alles', 'funktion', 'macht', 'leistet', 'wofuer', 'nutzen', 'ueberblick', 'was ist', 'hilfe'], a: 'Die App rechnet deine Arbeitszeit, Pausen, Überstunden, Diäten und Prämien aus und vergleicht alles mit deinem Lohnzettel. Du kannst Urlaub, Krankenstand und Zeitausgleich eintragen, Notizen zu Tagen schreiben, die App in 13 Sprachen nutzen und mich alles fragen. Tippe unten auf ein Thema, wenn du Genaueres wissen willst.' },
    { t: 'Stunden eintragen', k: ['eintrag', 'stunden', 'beginn', 'ende', 'arbeitszeit', 'tag speichern', 'erfassen', 'zeit'], a: 'Öffne Erfassen. Tippe bei Beginn und Ende die Uhrzeit ein, trage die Pausen ein und tippe auf Speichern. Mit "Jetzt" nimmt die App die aktuelle Uhrzeit.' },
    { t: 'Prämie anlegen', k: ['prämie', 'praemie', 'zulage', 'bonus', 'kran', 'anlegen'], a: 'Gehe zu Einstellungen, dann Prämien, und lege deine Prämie an (zum Beispiel pro Stunde, pro Tag oder pro Stück). Danach trägst du sie im Tag ein. Die App rechnet sie aus und vergleicht sie mit dem Lohnzettel.' },
    { t: 'Lohnzettel prüfen', k: ['lohnzettel', 'abrechnung', 'prüfen', 'pruefen', 'stimmt', 'vergleich', 'abgleich', 'kontrol'], a: 'Öffne Übersicht und scrolle zu "Stimmt mein Lohnzettel?". Tippe die Stunden und Beträge von deinem Lohnzettel ab. Die App zeigt dir, was gleich ist und wo ein Unterschied in Stunden oder Euro bleibt. Du musst nicht alle Zeilen ausfüllen.' },
    { t: 'Überstunden und Zuschläge', k: ['überstunden', 'ueberstunden', 'zuschlag', 'sonntag', 'samstag', 'feiertag', 'nacht', 'mehrarbeit'], a: 'Unter Einstellungen stehen Wochenstunden, Überstundenmodell und Zuschläge. Sie kommen aus deinem Kollektivvertrag. Ob sie stimmen, siehst du auf deinem Lohnzettel. Du kannst sie jederzeit ändern, auch ab einem Datum.' },
    { t: 'Diäten / Taggeld', k: ['diäten', 'diaeten', 'taggeld', 'spesen', 'tagesgeld'], a: 'Diäten sind das Taggeld, das du zusätzlich bekommst. Unter Einstellungen, Diäten, stellst du ein, ob es pro Stunde oder pro Tag nach Stufen gezahlt wird. Den Betrag findest du auf deinem Lohnzettel.' },
    { t: 'Lohn oder Beruf ändern', k: ['lohn ändern', 'lohn aendern', 'beruf', 'wechsel', 'neuer lohn', 'erhöhung', 'erhoehung', 'ab datum', 'stundenlohn'], a: 'Unter Einstellungen kannst du den Lohn oder den Beruf ab einem Datum ändern. Alte Tage bleiben mit den alten Werten gerechnet. So passt es auch nach einer Lohnerhöhung oder einem Jobwechsel.' },
    { t: 'Urlaub oder Krankenstand', k: ['urlaub', 'krank', 'zeitausgleich', 'feiertag', 'frei', 'art des tages'], a: 'Wähle in Erfassen bei "Art des Tages" zum Beispiel Urlaub, Krankenstand oder Zeitausgleich. Dann musst du keine Uhrzeiten eintragen.' },
    { t: 'Meine Daten und Datenschutz', k: ['daten', 'datenschutz', 'sicher', 'konto', 'speicher', 'weitergegeben', 'privat'], a: 'Deine Einträge liegen auf deinem Handy. Mit deinem Konto werden sie zusätzlich auf einem gesicherten Server in Frankfurt gespeichert, damit nichts verloren geht. Technisch könnte der Betreiber der App sie einsehen. Eine Verschlüsselung, die das ausschließt, ist in Arbeit. Deine Lohnzettel-Zahlen tippst du selbst ab.' },
    { t: 'Sicherung', k: ['sicherung', 'backup', 'verloren', 'wiederherstellen', 'handy wechsel'], a: 'Unter Profil findest du "Sicherung speichern oder teilen". Das speichert eine Datei mit allen deinen Daten. Damit kannst du alles auf einem neuen Handy wiederherstellen.' },
    { t: 'App installieren', k: ['installier', 'startbildschirm', 'icon', 'symbol', 'link'], a: 'Öffne die Seite im Browser und tippe auf "App installieren" (Menü oben rechts). Falls Android warnt, tippe auf "Trotzdem installieren". Die App ist ungefährlich, sie ist nur diese Webseite.' },
    { t: 'Sprache und Vorlesen', k: ['sprache', 'sprechen', 'mikrofon', 'diktier', 'vorlesen', 'deutsch'], a: 'Tippe bei deiner Frage an mich auf das Mikrofon und sprich. Mit "Vorlesen" lese ich dir meine Antwort vor. Das Mikrofon braucht Internet und deine Erlaubnis im Browser.' },
    { t: 'Mia ruhig stellen', k: ['mia', 'milo', 'ruhig', 'weg', 'nervt', 'ausschalten', 'figur', 'name'], a: 'Tippe auf "Mia ruhig stellen", dann melde ich mich nicht mehr von selbst. Du kannst mich unter Profil wieder aktivieren, und dort auch Figur und Namen ändern.' },
    { t: 'Fristen und Ausweise', k: ['frist', 'code 95', 'code95', 'fahrerkarte', 'staplerschein', 'kranschein', 'ablauf', 'ausweis', 'erinnerung', 'schulung', 'kurs'], a: 'Öffne Profil und scrolle zu "Fristen und Ausweise". Lege Code 95, Fahrerkarte, Staplerschein oder eigene Fristen mit Ablaufdatum an. Ich erinnere dich rechtzeitig, und der Termin kommt auf Wunsch in den Kalender deines Handys.' },
    { t: 'Nachzahlung, Aufrollung, Sonderzahlungen', k: ['nachzahlung', 'nachzahlen', 'aufroll', 'rückverrechnung', 'rueckverrechnung', 'korrektur', 'weihnachtsgeld', 'urlaubszuschuss', 'urlaubsgeld', 'sonderzahlung', '13.', '14.', 'remuneration', 'stundenlohn'], a: 'Hat die Firma später etwas nachgezahlt oder zurückverrechnet, trägst du es im Monatsabgleich bei „Nachzahlungen und Korrekturen“ ein: für welchen Monat, welche Zeile und wie viel. Die App rechnet es dem früheren Monat zu. Bei „Stundenlohn aufgerollt“ zeigt sie dir den Rechengang und ob der Betrag passt. Urlaubszuschuss, Weihnachtsgeld, 13. und 14. Gehalt trägst du im Reiter „Lohnzettel“ bei „Sonderzahlungen“ ein.' },
    { t: 'Neuigkeiten', k: ['neuigkeit', 'neuigkeiten', 'news', 'neue funktion', 'mitteilung'], a: 'Unter Profil findest du die Karte "Neuigkeiten". Dort schaltest du ein, dass Mia dir Neuigkeiten sagt, und stellst ein, wie oft: sofort, wöchentlich oder monatlich. Du bekommst nur, was zu deinem Beruf passt. Willst du auch alles andere sehen, schalte "Auch Neuigkeiten für andere Berufe" ein.' },
    { t: 'Teilzeit, Mehrarbeit und Zeitausgleich', k: ['teilzeit', 'mehrarbeit', 'zeitausgleich', 'quartal', 'vollzeit', '25'], a: 'Arbeitest du Teilzeit und mehr als vereinbart, ist das bis zur Vollzeit-Grenze deines Kollektivvertrags Mehrarbeit und keine Überstunde. Dafür gibt es 25 % Zuschlag, außer du nimmst die Stunden im selben Kalendervierteljahr 1:1 als Zeitausgleich. Die App rechnet das automatisch. Dein Kollektivvertrag kann es anders regeln.' },
    { t: 'Karenz, Mutterschutz, Papamonat', k: ['karenz', 'mutterschutz', 'papamonat', 'baby', 'elternzeit', 'mutter'], a: 'Wähle in Erfassen bei "Art des Tages" Karenz, Mutterschutz oder Papamonat. Diese Tage sind unbezahlt und haben keine Sollstunden. Die Karenz kürzt deinen Urlaubsanspruch anteilig, der Mutterschutz nicht.' },
    { t: 'Gleitzeit', k: ['gleitzeit','gleittag','gleitzeitkonto','saldo','plusstunden','minusstunden','kernzeit'], a: 'Bei Gleitzeit zählt die App Plus- und Minusstunden auf einem Gleitzeitkonto. Wähle beim Einrichten „Büro mit Gleitzeit“ oder in Einstellungen das Überstunden-Modell „Gleitzeit“. Dort trägst du die Sollzeit je Wochentag ein, optional Startsaldo und Übertragungsgrenze. Ein Gleittag (Zeitausgleich) zieht die Sollzeit vom Konto ab, Urlaub und Krankenstand nicht.' },
    { t: 'Keine Arbeit / Freistellung', k: ['freistellung', 'freigestellt', 'keine arbeit', 'heimgeschickt', 'nach hause', 'auftragsmangel', 'zeitausgleich geschickt'], a: 'Wähle in Erfassen bei "Art des Tages" „Keine Arbeit (von der Firma freigestellt)“, wenn dich die Firma wegen fehlender Arbeit heimschickt. Die Notiz zum Tag setzt sich automatisch. Wie die Firma den Tag verrechnet, stellst du in den Einstellungen unter „Freistellung (keine Arbeit)“ ein: Firma zahlt weiter, Abzug vom Zeitausgleich oder unbezahlt. Weißt du es nicht, zieht die App nichts ab. So sieht es auch die AK als Grundregel: Wer arbeitsbereit ist und heimgeschickt wird, behält den Lohn. Auf deinem Lohnzettel siehst du, ob es stimmt.' },
    { t: 'Zeitausgleich: 1:1,5 oder 1:1?', k: ['zeitausgleich', 'zeitausgleich 1:1', 'überstundenzuschlag', 'ueberstundenzuschlag', '1:1,5', '1,5', 'freizeitausgleich', 'zuschlag', 'verhältnis', 'verhaeltnis'], a: 'Das Arbeitszeitgesetz (§ 10) sagt: Der Überstundenzuschlag ist beim Zeitausgleich zu berücksichtigen oder gesondert auszuzahlen. Bei 50 % Zuschlag also entweder 1 Überstunde = 1,5 Stunden Zeitausgleich oder 1:1 und der Zuschlag kommt auf den Lohnzettel. Dein Kollektivvertrag kann es anders regeln. Stell es in Einstellungen unter „Wie schreibt deine Firma Überstunden als Zeitausgleich gut?“ ein. Beim Freinehmen wird der Zeitausgleich Stunde für Stunde abgezogen. In Deutschland gibt es kein gesetzliches Verhältnis, es gilt dein Vertrag.' },
    { t: 'Wo finde ich das auf dem Lohnzettel?', k: ['lohnzettel', 'wo finde', 'wo steht', 'einstufung', 'lohngruppe', 'kollektivvertrag', 'kv', 'abrechnung', 'gehaltszettel', 'finde ich'], a: 'Oben auf dem Lohnzettel stehen meist dein Name, die Firma, der Monat und oft Einstufung, Lohngruppe und Kollektivvertrag (manchmal mit „KV“ abgekürzt). Den Stundenlohn findest du in der Zeile „Lohn“ oder „Stundenlohn“, die Stunden daneben in der Spalte „Menge“. Überstunden stehen oft in eigenen Zeilen mit 50 % oder 100 %, Zeitausgleich in einer Zeile wie „Zeitausgleich“ oder „Zeitkonto“, der Urlaub oft als „Resturlaub“. Die Wochenstunden stehen im Dienstvertrag. Steht etwas nicht drauf, frag im Büro oder in der Lohnverrechnung. Weißt du etwas nicht, lass das Feld in der App leer. Bis dahin rechnet die App mit den Werten deines Kollektivvertrags.' },
    { t: 'Ich bin Lehrling', k: ['lehrling', 'lehrjahr', 'berufsschule', 'lehrlingsentschädigung', 'lehrlingsentschaedigung', 'lehrlingseinkommen', 'lehre', 'lehrvertrag', 'azubi', 'ausbildung'], a: 'Als Lehrling bekommst du eine Lehrlingsentschädigung, meist als fester Monatsbetrag je Lehrjahr. Wähle in den Einstellungen bei „Mein Beruf“ die Art „Lehrling“. Dann zeigt dir die App bei der Lohngruppe nur die Lehrjahre deines Kollektivvertrags, und mit „Mindestlohn laut Kollektivvertrag verwenden“ trägt sie den Betrag ein. Steht in deinem Lehrvertrag ein anderer Betrag, trage ihn bei „Fixer Monatslohn“ ein. Die Berufsschule zählt als Arbeitszeit: Trage den Tag als „Schulung / Berufsschule“ ein, einen festen Schultag jede Woche bei „Feste freie Tage“. Unter 18 gilt das Jugendschutzgesetz, in der Regel höchstens 8 Stunden am Tag und 40 in der Woche. Bei Fragen hilft dir die Arbeiterkammer.' },
    { t: 'Zulagen am Bau und im Handwerk', k: ['bau', 'handwerk', 'zulage', 'zulagen', 'schlechtwetter', 'taggeld', 'montage', 'montagezulage', 'erschwernis', 'schmutzzulage', 'buak', 'nächtigung', 'naechtigung', 'maurer', 'zimmerer', 'tischler', 'maler', 'elektriker', 'installateur'], a: 'Am Bau und im Handwerk stehen auf dem Lohnzettel oft Zulagen: Schmutz-, Erschwernis- und Gefahrenzulage, Taggeld oder Entfernungszulage bei Arbeit außer Haus, Nächtigungsgeld und Montagezulage. Lege sie unter Einstellungen, Prämien an, Mia macht dir passende Vorschläge. Bei Schlechtwetter am Bau und im Holzbau zahlt die BUAK einen Teil des Lohns, die App führt die Schlechtwetterstunden getrennt. Im Malergewerbe gibt es bei Wetterausfall 60 % des Lohns. Die Beträge sind je Kollektivvertrag verschieden, bitte vergleiche sie mit deinem Lohnzettel.' },
    { t: 'Reinigung, Security und Pflege', k: ['reinigung', 'reinigungskraft', 'gebäudereinigung', 'security', 'sicherheitsdienst', 'wachdienst', 'bewachung', 'pflege', 'pflegeassistenz', 'pflegefachassistenz', 'krankenpflege', 'heimhilfe', 'betreuung', 'swö', 'sozialwirtschaft', 'nachtdienst', 'rufbereitschaft'], a: 'In diesen Berufen läuft vieles über Nacht-, Sonn- und Feiertagsdienste. Trage die Zeiten so ein, wie du gearbeitet hast, auch über Mitternacht: Die Stunden zählen zu dem Tag, an dem der Dienst beginnt. Zuschläge und Zulagen (zum Beispiel Nachtzulage, Zehrgeld, Rufbereitschaft) stehen auf dem Lohnzettel: lege sie unter Einstellungen, Prämien an, Mia macht dir passende Vorschläge. Gilt bei dir ein anderer Kollektivvertrag (zum Beispiel Landeskrankenhaus), nimm „Eigene Werte“.' },
    { t: 'Zeitumstellung (Sommerzeit, Winterzeit)', k: ['zeitumstellung', 'sommerzeit', 'winterzeit', 'umstellung', 'uhrumstellung', 'extra stunde', 'zusätzliche stunde'], a: 'Die App rechnet die Zeitumstellung automatisch mit. Im Oktober wird die Uhr um 3 Uhr auf 2 Uhr zurückgestellt: Wer in dieser Nacht arbeitet, hat eine Stunde mehr gearbeitet. Eine Nachtschicht von 22 bis 6 Uhr zählt dann 9 statt 8 Stunden. Im März wird die Uhr um 2 Uhr auf 3 Uhr vorgestellt: Dann fehlt eine Stunde, die Schicht zählt 7 statt 8 Stunden. Trage einfach Beginn und Ende so ein, wie die Uhr es gezeigt hat. Ob deine Firma die zusätzliche Stunde bezahlt, steht in deinem Kollektivvertrag oder deiner Betriebsvereinbarung: Schau auf deinen Lohnzettel. Bei Abweichungen kannst du die Stunden im Tag selbst anpassen.' },
    { t: 'Was ist die Lohngruppe und brauche ich sie?', k: ['lohngruppe', 'einstufung', 'verwendungsgruppe', 'was ist die lohngruppe', 'brauche ich', 'lohngruppe brauchen', 'mindestlohn', 'stufe'], a: 'Die Lohngruppe (oder Einstufung) bestimmt, welchen Mindestlohn dir der Kollektivvertrag zusteht. Du musst sie nicht kennen: Trage einfach deinen Stundenlohn vom Lohnzettel ein. Kennst du sie, kann die App prüfen, ob dein Lohn dem Kollektivvertrag entspricht. Du findest sie oben auf dem Lohnzettel (bei „Einstufung“, „Lohngruppe“ oder „Verwendungsgruppe“) oder im Dienstvertrag. Steht sie nirgends, frag in der Firma nach.' },
    { t: 'Mir fehlen noch Daten, kann ich trotzdem anfangen?', k: ['daten fehlen', 'fehlen noch', 'unvollständig', 'noch nicht fertig', 'anfangen', 'starten', 'nachtragen', 'später eintragen', 'rückwirkend', 'trotzdem'], a: 'Ja, du kannst sofort anfangen, auch wenn Lohn, Einstufung oder anderes noch fehlt. Trage ein, was du schon hast, zum Beispiel deine Arbeitszeiten. Fehlende Werte kannst du jederzeit in den Einstellungen nachtragen. Die App rechnet dann auch alle Tage, die du schon eingetragen hast, automatisch neu und richtig. Nur der Vergleich mit dem Lohnzettel in Euro geht erst, wenn dein Stundenlohn eingetragen ist.' },
    { t: 'Wo finde ich die Rückmeldung an den Entwickler?', k: ['rückmeldung', 'problem melden', 'fehler melden', 'melden', 'feedback', 'anregung', 'entwickler', 'verbesserung', 'vorschlag', 'wunsch', 'kontakt', 'wo finde ich'], a: 'Unten links in der App ist der Knopf „Problem melden“. Tippe darauf, wähle bei „Worum geht es?“ zum Beispiel „Etwas stimmt nicht“ oder „Anregung“, schreibe deine Nachricht und tippe auf Senden. Ein Bild der aktuellen Seite schickt die App mit, du kannst es ausschalten. Danach siehst du eine Bestätigung. Du findest die Rückmeldung auch im Profil unter „Rückmeldung an den Entwickler“.' }
  ];
  function miaFaqText(i, w) { var tr = MIA_TR[miaLang()]; return tr ? tr[i][w === 'a' ? 1 : 0] : MIA_FAQ[i][w]; }
  function miaNorm(s) { return (s || '').toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/ł/g, 'l').replace(/ı/g, 'i').normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
  function miaTopic(i) { return String(MIA_FAQ[i].t).replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/Ä/g, 'Ae').replace(/Ö/g, 'Oe').replace(/Ü/g, 'Ue').replace(/ß/g, 'ss').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, ''); }
  function miaAnswer(q) {
    var n = miaNorm(q), best = null, bs = 0;
    var L = miaLang(), tr = MIA_TR[L];
    MIA_FAQ.forEach(function (e, i) { var sc = 0, ks = e.k.concat(tr && tr[i] && tr[i][2] ? tr[i][2].split(' ') : []); ks.forEach(function (k) { var nk = miaNorm(k); if (nk.length > 2 && n.indexOf(nk) >= 0) sc += nk.length > 5 ? 2 : 1; }); if (sc > bs) { bs = sc; best = i; } });
    ins('mia_frage');
    if (best == null) { try { if (window.StundenInsights) window.StundenInsights.miaOffen(q, L); } catch (e) {} }
    else { ins('mia_antwort'); ins('mia_t_' + miaTopic(best)); }
    return best != null ? miaFaqText(best, 'a') : (MIA_UI[L] || MIA_UI.de).unk;
  }
  function miaShowAns(t) { var el = $('#mia-ans'); if (!el) return; el.textContent = t; el.hidden = false; var r = $('#mia-read'); if (r) r.hidden = !('speechSynthesis' in window); miaPose(''); }
  (function () {
    function on(id, ev, fn) { var el = $(id); if (el) el.addEventListener(ev, fn); }
    function paintAsk() {
      var L = miaLang(), u = MIA_UI[L] || MIA_UI.de, chips = $('#mia-chips');
      var gl = false, le = false, hw = false; try { var ww = wAt(todayISO()); gl = !!(ww && ww.ueberstunden && ww.ueberstunden.modell === 'gleit'); le = !!(ww && ww.art === 'lehrling'); hw = !!(ww && (['bau', 'holzbau', 'dachdecker', 'pflasterer', 'fliesenleger', 'maler', 'tischler', 'metall', 'de_bau', 'de_metall'].indexOf(ww.paket) >= 0 || ww.beruf === 'handwerk')); } catch (e) { }
      if (chips) chips.innerHTML = MIA_FAQ.map(function (e, i) { return ((e.t === 'Gleitzeit' && !gl) || (e.t === 'Ich bin Lehrling' && !le) || (e.t === 'Zulagen am Bau und im Handwerk' && !hw)) ? '' : '<button type="button" class="chip" data-faq="' + i + '">' + esc(miaFaqText(i, 't')) + '</button>'; }).join('');
      $('#mia-q').placeholder = u.q; $('#mia-send').textContent = u.go; $('#mia-read').textContent = u.read; $('#mia-askbtn').textContent = u.ask;
      var sel = $('#mia-lang'); if (sel) sel.value = L;
    }
    var ls = $('#mia-lang'); if (ls) { ls.innerHTML = Object.keys(MIA_LANGS).map(function (k) { return '<option value="' + k + '">' + MIA_LANGS[k].n + '</option>'; }).join(''); ls.addEventListener('change', function () { uiSetLang(this.value); $('#mia-ans').hidden = true; paintAsk(); }); }
    paintAsk(); ui.miaPaint = paintAsk;
    on('#mia-askbtn', 'click', function () { var p = $('#mia-ask'); paintAsk(); p.hidden = !p.hidden; if (!p.hidden) { var q = $('#mia-q'); if (q) q.focus(); } });
    on('#mia-chips', 'click', function (ev) { var b = ev.target.closest('[data-faq]'); if (b) { var qa2 = $('#mia-asked'); if (qa2) qa2.hidden = true; ins('mia_chip'); ins('mia_t_' + miaTopic(+b.dataset.faq)); miaShowAns(miaFaqText(+b.dataset.faq, 'a')); } });
    function send() { var q = $('#mia-q').value.trim(); if (q) { var qa = $('#mia-asked'); if (qa) { qa.textContent = '„' + q + '“'; qa.hidden = false; } miaShowAns(miaAnswer(q)); } }
    on('#mia-q', 'input', function () { this.style.height = 'auto'; this.style.height = Math.min(this.scrollHeight, 160) + 'px'; });
    on('#mia-send', 'click', send);
    on('#mia-q', 'keydown', function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); send(); } });
    on('#mia-read', 'click', function () {
      miaSag($('#mia-ans').textContent, true);
    });
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition, mic = $('#mia-mic');
    if (SR && mic) {
      mic.hidden = false; var rec = null;
      mic.addEventListener('click', function () {
        if (rec) { try { rec.stop(); } catch (e) {} return; }
        try {
          rec = new SR(); rec.lang = MIA_LANGS[miaLang()].sr; rec.interimResults = false; rec.maxAlternatives = 1;
          rec.onresult = function (ev) { ins('mia_sprache'); var t = ev.results[0][0].transcript; var qe = $('#mia-q'); qe.value = t; qe.style.height = 'auto'; qe.style.height = Math.min(qe.scrollHeight, 160) + 'px'; send(); };
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
    var cur = mode === 'change' ? wAt(ab) : null, w = { mode: mode, ab: ab, cStat: mode === 'start', cMia: mode === 'start', step: mode === 'start' ? 'mia' : 'beruf', hist: [], beruf: null, art: null, b: { fahrzeug: true, kunden: true, praemien: true }, diaeten: true, sw: false, paket: 'gueter', eintritt: '', lohn: '', wochen: '', dsatz: '' };
    if (cur) {
      w.beruf = cur.beruf || null; w.art = cur.art || null; var bb = E.bausteine(cur); w.b = { fahrzeug: bb.fahrzeug, kunden: bb.kunden, praemien: bb.praemien };
      w.diaeten = cur.diaeten.modell !== 'aus'; w.sw = !!cur.schlechtwetter; w.paket = cur.paket || 'gueter'; w.kvGewaehlt = !!cur.paket; w.bl = (data.profil && data.profil.bl) || '';
      w.einst = cur.einstufung || ''; w.lohn = cur.stundenlohn == null ? '' : cur.stundenlohn; w.wochen = E.wochenStd(cur.ueberstunden); w.dsatz = cur.diaeten.satz || '';
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
    if (n === 'bausteine' && w.mode === 'start') n = 'kv';
    if (!n) { wzFinish(); return; }
    w.step = n; wzRender();
  }
  function wzBack() { var w = ui.wiz; if (!w.hist.length) { wzClose(true); return; } w.step = w.hist.pop(); wzRender(); }
  function wzClose(dismiss) { $('#wiz').hidden = true; if (dismiss && ui.wiz && ui.wiz.mode === 'start') ui.wizDismissed = true; ui.wiz = null; }
  /* ---- Rundgang mit Mia: ein heller Rahmen zeigt auf das, was Mia gerade erklärt ----
     Zwei Arten: "Rundgang" (erklärt, sperrt die Seite) und "Einstellungsassistentin" (führt Feld für Feld, du trägst gleich mit ein). */
  var TOUR = null;
  function tourSteps() {
    var w = wAt(todayISO()), b = w.beruf || '', gl = w.ueberstunden && w.ueberstunden.modell === 'gleit';
    var s = [{ t: 'Ich zeige dir in einer Minute, wie du jeden Tag einträgst und wo du alles findest. Du kannst dabei gleich ausprobieren und etwas eintragen, dann tippst du auf Weiter. Du kannst jederzeit beenden.' },
      { v: 'erfassen', sel: '#e-status', t: 'Hier wählst du die Art des Tages: Arbeit, Urlaub, Krankenstand oder Zeitausgleich. Bei Urlaub und Krankenstand brauchst du keine Uhrzeiten.' },
      { v: 'erfassen', sel: '#e-von', t: 'Trage Beginn und Ende ein. Mit „Jetzt“ nimmt die App die aktuelle Uhrzeit. Das Ende kannst du später nachtragen.' },
      { v: 'erfassen', sel: '#e-addpause', t: 'Pausen trägst du hier ein. Die App zieht sie von deiner Arbeitszeit ab.' }];
    if (b === 'lkw' || b === 'klein') s.push({ v: 'erfassen', sel: '#e-fzgroup', t: 'Dein Fahrzeug und die Kilometer. Den Kilometerstand vom letzten Mal setzt die App schon ein.' }, { v: 'erfassen', sel: '#e-kgroup', t: 'Kunden oder Baustellen mit dem, was du dort gemacht hast. Das braucht die App für Prämien und Zulagen.' });
    if (b === 'bagger' || (b === 'handwerk' && w.schlechtwetter)) s.push({ v: 'erfassen', sel: '#e-swgroup', t: 'Schlechtwetter: Trage ausgefallene Stunden hier in halben Stunden ein.' }, { v: 'erfassen', sel: '#e-kgroup', t: 'Baustellen mit deiner Tätigkeit. Das braucht die App für Prämien und Zulagen.' });
    s.push({ v: 'erfassen', sel: '#e-an-box', t: 'Mit einer Notiz hältst du fest, wie es zu einem Tag kam. Die App merkt sich, wann du sie geschrieben hast.' });
    s.push({ v: 'monat', sel: '#m-summary', t: gl ? 'Hier siehst du deinen Gleitzeitsaldo: Plus oder Minus im Monat und im Quartal.' : 'Hier siehst du deine Stunden des Monats auf einen Blick.' });
    s.push({ v: 'lohn', sel: '#m-abgleich', t: 'Stimmt mein Lohnzettel? Tippe die Zeilen deines Lohnzettels ab, die App zeigt dir, wo etwas abweicht.' });
    s.push({ v: 'konten', sel: '[data-view=konten]', t: 'Unter Profil: Fristen und Ausweise, mein Aussehen, deine Notizen zu den Tagen, die Rückmeldung an den Entwickler und die Sicherung.' });
    s.push({ sel: '#mia-btn', t: 'Und ich bin immer hier unten. Tippe auf mich, wenn du etwas wissen willst. Viel Erfolg!' });
    return s;
  }
  function tagSteps() {
    var w = wAt(todayISO()), b = w.beruf || '', V = 'erfassen';
    var s = [{ v: V, t: 'Wir tragen deinen Tag gemeinsam ein. Bei jedem Feld sage ich dir, was du tust. Trage es ein, dann tippst du auf Weiter. Was du nicht hast, lässt du leer.' },
      { v: V, sel: '#e-status', t: 'Welche Art von Tag ist heute? Wähle Arbeit, Urlaub, Krankenstand oder Zeitausgleich.' },
      { v: V, sel: '#e-von', t: 'Trage deinen Beginn ein. Mit „Jetzt“ nimmt die App die aktuelle Uhrzeit.' },
      { v: V, sel: '#e-bis', t: 'Das Ende trägst du ein, wenn du fertig bist. Noch nicht so weit? Dann lass es leer und trage es später nach.' },
      { v: V, sel: '#e-addpause', t: 'Hattest du eine Pause? Tippe auf „+ Pause hinzufügen“ und trage sie ein. Sonst tippe auf Weiter.' }];
    if (b === 'lkw' || b === 'klein') s.push({ v: V, sel: '#e-fzgroup', t: 'Dein Fahrzeug und die Kilometer. Den Kilometerstand vom letzten Mal setzt die App schon ein.' });
    if (b === 'lkw' || b === 'klein' || b === 'bagger' || b === 'handwerk') s.push({ v: V, sel: '#e-kgroup', t: 'Für wen hast du gearbeitet und was hast du gemacht? Trage Kunden oder Baustellen ein. Das ist optional.' });
    s.push({ v: V, sel: '#e-save', t: 'Tippe jetzt auf „Speichern“. Danach bist du für heute fertig.' });
    return s;
  }
  function assistKurz() { // Erster Durchgang: nur das Wichtigste, der Rest später
    var all = assistBase(), sels = ['#s-vorname', '#k-eintritt', '#s-umodell', '#s-lohn'];
    var s = sels.map(function (q) { return all.filter(function (x) { return x.sel === q; })[0]; }).filter(Boolean);
    s.push({ t: 'Das Wichtigste ist erledigt. Die genaueren Einstellungen (Zuschläge, Pausen, Diäten, Prämien) kannst du jederzeit in den Einstellungen machen. Oder tippe unten auf mich und dann auf die Einstellungshilfe. Bis dahin rechnet die App mit den Werten deines Kollektivvertrags.' });
    return s;
  }
  function assistSteps() {
    var all = assistBase(), first = all[0], last = all[all.length - 1], mid = all.slice(1, -1), E1 = 'einstellungen', f = '.field', k = 'label.check';
    var g1 = ['#s-vorname', '#s-geb', '#s-firma', '#k-eintritt', '#s-beruf', '#s-einst', '#s-lgbox', '#s-monat', '#s-monatstd', '#s-lohn'], g2 = ['#s-umodell', '#s-gleitbox', '#s-woche', '#s-tagsollfield', '#s-grenzefield', '#s-uzus', '#s-pauseauto', '#s-runan', '#s-zsa', '#s-praemien'];
    function pick(l) { return l.map(function (q) { return mid.filter(function (x) { return x.sel === q; })[0]; }).filter(Boolean); }
    var p3 = mid.filter(function (x) { return g1.indexOf(x.sel) < 0 && g2.indexOf(x.sel) < 0; });
    var ti = p3.map(function (x) { return x.sel; }).indexOf('#s-tagf'); if (ti < 0) ti = p3.length;
    p3.splice(ti, 0, { v: E1, sel: '#mia-aktiv', up: k, t: 'Soll ich mich von selbst melden, wenn etwas zu tun ist? Dann lass den Schalter an.' });
    return [first].concat(pick(g1),
      [{ t: 'Teil 2 von 4: Arbeitszeit und Zuschläge. Du kannst jederzeit auf Beenden tippen. Ich merke mir, wo wir waren.', kap: 2 }], pick(g2),
      [{ t: 'Teil 3 von 4: Diäten, Berichte und Extras. Du kannst jederzeit auf Beenden tippen. Ich merke mir, wo wir waren.', kap: 3 }], p3,
      [{ ask: true, kap: 4, t: 'Deine Einstellungen sind durch. Möchtest du jetzt auch gleich dein Profil mit mir durchgehen? Dort kannst du mich verkleiden, mir einen Namen und eine Stimme geben und deine Ausweise mit Ablaufdatum anlegen.' },
        { t: 'Teil 4 von 4: Dein Profil mit mir und deinen Fristen. Du kannst jederzeit auf Beenden tippen. Ich merke mir, wo wir waren.', kap: 4 },
        { v: 'konten', sel: '#s-foto', up: f, t: 'Optional: ein Profilbild. Du kannst es überspringen.' },
        { v: 'konten', sel: '#mia-choose', t: 'Hier wählst du, ob ich Mia oder Milo bin.' },
        { v: 'konten', sel: '#mia-name', up: f, t: 'Wenn du magst, gib mir einen eigenen Namen. Sonst bleibe ich Mia oder Milo.' },
        { v: 'konten', sel: '#mia-eigen', up: k, t: 'Schalte ein, wenn du mein Aussehen selbst zusammenstellen willst: Kopf, Oberteil, Unterteil und Zubehör.' },
        { v: 'konten', sel: '#mia-spricht', up: k, t: 'Soll ich auch sprechen? Wenn du es einschaltest, kannst du danach meine Stimme einstellen.' },
        { v: 'konten', sel: '#mia-vwrap', t: 'Hier wählst du meine Stimme und den Klang. Mit den Reglern mache ich höher oder tiefer, schneller oder langsamer. Tippe unten auf „Probe hören“.' },
        { v: 'konten', sel: '#fr-add', t: 'Hier legst du Ausweise, Kurse und Prüfungen mit Ablaufdatum an, zum Beispiel Code 95 oder Staplerschein. Ich erinnere dich rechtzeitig.' }], [last]);
  }
  function assistBase() {
    var E1 = 'einstellungen', f = '.field', k = 'label.check';
    return [{ t: 'Ich führe dich jetzt durch deine Einstellungen. Bei jedem Feld kannst du gleich etwas eintragen, dann tippst du auf Weiter. Was du nicht weißt, lässt du leer. Du kannst es später nachholen.' },
      { v: E1, sel: '#s-vorname', to: '#s-nachname', up: f, t: 'Dein Vorname und Nachname. Beides kommt oben auf deine Berichte.' },
      { v: E1, sel: '#s-geb', up: f, t: 'Optional: dein Geburtsdatum. Du kannst es überspringen.' },
      { v: E1, sel: '#k-eintritt', up: f, t: 'Seit wann bist du in deiner Firma? Das Eintrittsdatum braucht die App für den Urlaub. Weißt du es nicht, lass das Feld leer.' },
      { v: E1, sel: '#s-firma', up: f, t: 'Der Name deiner Firma. Er steht auf den Berichten. Weißt du ihn nicht auswendig, lass das Feld leer.' },
      { v: E1, sel: '#s-beruf', t: 'Hier steht dein Beruf. Stimmt das? Wenn nicht, ändere ihn hier. Sonst tippe auf Weiter.' },
      { v: E1, sel: '#s-umodell', up: f, t: 'Wie zählt deine Firma Überstunden? Wähle es aus. Weißt du es nicht, nimm „Pro Monat“ und frage später im Büro nach.' },
      { v: E1, sel: '#s-zau', up: f, t: 'Wie schreibt deine Firma Überstunden als Zeitausgleich gut? 1:1,5 oder 1:1 mit ausbezahltem Zuschlag. Schau auf dein Zeitausgleich-Konto auf dem Lohnzettel.' },
      { v: E1, sel: '#s-gleitbox', t: 'Die Sollzeit für jeden Wochentag. Zum Beispiel Montag bis Donnerstag 8,5 Stunden und Freitag 6. Leer lassen geht auch.' },
      { v: E1, sel: '#s-einst', up: f, t: 'Die Einstufung steht auf deinem Lohnzettel, zum Beispiel „Kraftfahrer 3a“. Sie zeigt, welcher Kollektivvertrag für dich gilt.' },
      { v: E1, sel: '#s-lgbox', t: 'Die Lohngruppe laut Kollektivvertrag. Wähle sie, wenn du sie kennst.' },
      { v: E1, sel: '#s-monat', up: f, t: 'Steht auf deinem Lohnzettel ein fester Monatslohn? Dann trage ihn hier ein. Wenn nicht, lass das Feld leer.' },
      { v: E1, sel: '#s-monatstd', up: f, t: 'Durch wie viele Stunden wird dein Monatslohn geteilt? Meistens steht es auf dem Lohnzettel, oft 173.' },
      { v: E1, sel: '#s-lohn', to: '#s-lgtake', up: f, t: 'Dein Stundenlohn steht auf dem Lohnzettel bei „Lohn“. Kennst du deine Lohngruppe, kannst du darunter den Schalter für den Mindestlohn einschalten. Eine Erhöhung trägst du danach „ab Datum“ ein.' },
      { v: E1, sel: '#s-woche', up: f, t: 'Wie viele Stunden pro Woche sind bei dir normale Arbeitszeit? Zum Beispiel 40, im Bau 39.' },
      { v: E1, sel: '#s-tagsollfield', t: 'Stunden pro Arbeitstag. Leer lassen, dann rechnet die App Wochenstunden geteilt durch deine Arbeitstage.' },
      { v: E1, sel: '#s-grenzefield', t: 'Ab wie vielen Stunden pro Tag zählt jede weitere als Überstunde? Zum Beispiel 9.' },
      { v: E1, sel: '#s-uzus', up: f, t: 'Der Zuschlag auf Überstunden in Prozent. Auf dem Lohnzettel steht zum Beispiel „Überstd.-Zusch. 50 %“.' },
      { v: E1, sel: '#s-pauseauto', up: f, t: 'Zieht deine Firma jeden Tag automatisch eine Pause ab? Dann trage die Minuten ein, zum Beispiel 60. Sonst lass es leer.' },
      { v: E1, sel: '#s-runan', up: k, t: 'Rundet deine Firma Beginn und Ende, zum Beispiel auf 15 Minuten? Dann schalte es ein und wähle die Minuten. Sonst lass es aus.' },
      { v: E1, sel: '#s-zsa', to: '#s-zft', up: '.grid3', t: 'Zuschläge für Samstag, Sonntag und Feiertag in Prozent. Bei 100 % zählt eine Stunde doppelt. Weißt du es nicht, lass 0 stehen.' },
      { v: E1, sel: '#s-praemien', t: 'Hier legst du Prämien und Zulagen an, zum Beispiel pro Mulde, pro Tour oder pro Stunde. Schau auf deinen Lohnzettel, dort stehen sie meistens. Tippe auf „+ Prämie hinzufügen“.' },
      { v: E1, sel: '#s-dmodell', up: f, t: 'Wie werden bei dir Diäten gezahlt? Pro Stunde, pro Tag nach Stufen oder gar nicht. Wähle es aus.' },
      { v: E1, sel: '#s-d-stunde', t: 'Der Diätensatz je Stunde steht auf dem Lohnzettel. Dazu die Höchststunden pro Tag, falls es eine Grenze gibt.' },
      { v: E1, sel: '#s-d-tag', t: 'Die Stufen für das Taggeld: Ab wie vielen Stunden gibt es welchen Betrag?' },
      { v: E1, sel: '#s-d-vorschlag', t: 'Womit soll die App die Diätenstunden vorschlagen? Sie schlägt es dir bei jedem Tag vor, du kannst es jederzeit ändern.' },
      { v: E1, sel: '#s-folge', up: k, t: 'Schalte ein, wenn deine Firma Diäten und Überstunden erst im Folgemonat abrechnet.' },
      { v: E1, sel: '#s-bfz', to: '#s-bpr', up: k, t: 'Was möchtest du aufzeichnen? Fahrzeug und Kilometer, Kunden oder Baustellen, Prämien. Schalte nur ein, was du brauchst.' },
      { v: E1, sel: '#s-fv', up: f, t: 'Wie verrechnet deine Firma Tage, an denen sie dich wegen fehlender Arbeit freistellt? Schau auf deinen Lohnzettel, wenn du unsicher bist.' },
      { v: E1, sel: '#s-bf', up: f, t: 'Wie bezahlt deine Firma Tage, an denen der Betrieb geschlossen ist? Schau auf deinen Lohnzettel, wenn du unsicher bist.' },
      { v: E1, sel: '#s-sw', up: k, t: 'Schalte ein, wenn die Schlechtwetterregelung oder Ausfallstunden für dich gelten.' },
      { v: E1, sel: '#s-ansichtsel', up: f, t: 'Wie möchtest du den Monat sehen? Als Liste, als Raster wie ein Kalender oder beides.' },
      { v: E1, sel: '#rb-rhythmus', up: f, t: 'Wann verlangt deine Firma einen Bericht? Wähle es aus. Dann frage ich dich zur richtigen Zeit, ob du ihn gleich senden willst.' },
      { v: E1, sel: '#rb-mail', up: f, t: 'Die E-Mail-Adresse deiner Firma für die Berichte. Das ist optional.' },
      { v: E1, sel: '#rb-sigon', up: k, t: 'Schalte ein, wenn deine Unterschrift auf den Berichten stehen soll. Danach unterschreibst du mit dem Finger.' },
      { v: E1, sel: '#fest-add', up: k, t: 'Hast du jede Woche am gleichen Tag frei oder Berufsschule? Dann lege hier einen festen Tag an. Ich trage ihn dir dann ein.' },
      { v: E1, sel: '#s-tagf', up: k, t: 'Möchtest du, dass ich dich jeden Tag Schritt für Schritt durch das Eintragen führe? Dann schalte es ein.' },
      { v: E1, sel: '#s-luecke', up: k, t: 'Soll ich nachfragen, wenn Tage ohne Eintrag bleiben, zum Beispiel bei Urlaub oder Krankenstand? Dann lass den Schalter an.' },
      { v: E1, sel: '#s-help', t: 'Möchtest du anonym mithelfen, die App besser zu machen? Das ist optional. Schalte nur ein, was du willst.' },
      { v: 'lohn', sel: '#s-lz', t: 'Hier schaltest du ein, dass ich deinen Lohnzettel auf diesem Handy lese. Das ist optional.' },
      { t: 'Das war alles. Du kannst jederzeit zurückkommen: Tippe in den Einstellungen oben auf „Mia hilft mir beim Einstellen“. Ich bin immer hier unten.' }];
  }
  function tourEl(st) {
    if (!st.sel) return null;
    var el = document.querySelector(st.sel); if (!el || el.offsetParent === null) return null;
    if (st.up) { var u = el.closest(st.up); if (u && u.offsetParent !== null) el = u; }
    return el;
  }
  function tourRect(st, el) {
    var r = el.getBoundingClientRect(), o = { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    if (st.to) {
      var e2 = document.querySelector(st.to);
      if (e2 && e2.offsetParent !== null) { if (st.up) { var u2 = e2.closest(st.up); if (u2) e2 = u2; } var r2 = e2.getBoundingClientRect(); o.left = Math.min(o.left, r2.left); o.top = Math.min(o.top, r2.top); o.right = Math.max(o.right, r2.right); o.bottom = Math.max(o.bottom, r2.bottom); }
    }
    return o;
  }
  function tourReduced() { return !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); }
  /* Rahmen und Sprechblase an die aktuelle Stelle setzen (auch während die Seite scrollt oder die Tastatur aufgeht) */
  function tourPlace() {
    var T = TOUR; if (!T || !T.el || !T.ready) return;
    var st = T.s[T.i], r = tourRect(st, T.el), pad = 6, hl = $('#tour-hl'), box = $('#tour-box'); if (!hl || !box) return;
    hl.hidden = false; hl.style.left = (r.left - pad) + 'px'; hl.style.top = (r.top - pad) + 'px'; hl.style.width = (r.right - r.left + 2 * pad) + 'px'; hl.style.height = (r.bottom - r.top + 2 * pad) + 'px';
    if (T.assist) { box.style.top = '8px'; box.style.bottom = 'auto'; return; }
    var below = (r.top + r.bottom) / 2 < window.innerHeight / 2;
    box.style.top = below ? Math.min(window.innerHeight - 190, r.bottom + 16) + 'px' : 'auto';
    box.style.bottom = below ? 'auto' : Math.max(12, window.innerHeight - r.top + 16) + 'px';
  }
  /* wartet, bis die Seite fertig gescrollt hat */
  function tourSettle(T, idx, cb) {
    var prev = -1, same = 0, n = 0;
    var iv = setInterval(function () {
      if (!TOUR || TOUR !== T || T.i !== idx) { clearInterval(iv); return; }
      var y = window.pageYOffset; same = Math.abs(y - prev) < 1 ? same + 1 : 0; prev = y; n++;
      if (same >= 2 || n > 30) { clearInterval(iv); cb(); }
    }, 70);
  }
  function tourOnMove() {
    var T = TOUR; if (!T || !T.ready) return;
    var ov = $('#tour'); if (ov) { ov.classList.add('moving'); clearTimeout(T.mv); T.mv = setTimeout(function () { var o2 = $('#tour'); if (o2) o2.classList.remove('moving'); }, 160); }
    if (T.raf) return; T.raf = requestAnimationFrame(function () { if (TOUR) TOUR.raf = 0; tourPlace(); });
  }
  function tourRender() {
    var T = TOUR; if (!T) return;
    var idx = T.i, st = T.s[idx], ov = $('#tour');
    if (T.assist && st.kap) { if (!data.profil) data.profil = {}; data.profil.assistKap = st.kap; save(); }
    if (!ov) { ov = document.createElement('div'); ov.id = 'tour'; ov.className = 'tour' + (T.assist || T.live ? ' assist' : ''); document.body.appendChild(ov); }
    if (st.v && ui.view !== st.v) show(st.v, true);
    T.el = null; T.ready = false;
    ov.innerHTML = '<div class="tour-hl" id="tour-hl" hidden></div><div class="tour-box" id="tour-box"></div>';
    var last = idx === T.s.length - 1, first = idx === 0;
    $('#tour-box').innerHTML = '<div class="tour-mia">' + miaSvg(miaCfg().figur, miaFor(), '') + '</div><div class="tour-body"><p></p><div class="tour-btns">' +
      (first ? '' : '<button type="button" class="btn" data-tour="prev">Zurück</button>') + '<button type="button" class="btn primary" data-tour="next">' + (st.ask ? 'Ja, gleich' : last ? 'Fertig' : (first && (T.assist || T.tag) ? 'Los geht’s' : 'Weiter')) + '</button>' + (st.ask ? '<button type="button" class="btn" data-tour="later">Später</button><button type="button" class="btn" data-tour="nein">Nein danke</button>' : '<button type="button" class="linkbtn" data-tour="end">Beenden</button>') + '</div></div>';
    $('#tour-box p').textContent = st.t;
    if (T.assist && st.sel) { // Einrichtung: Mia sagt bei jedem Feld, ob es unbedingt nötig oder optional ist
      var must = ['#s-beruf', '#s-lohn'].indexOf(st.sel) >= 0, bd = document.createElement('span');
      bd.className = 'need ' + (must ? 'must' : 'opt'); bd.textContent = must ? 'Unbedingt nötig' : 'Optional';
      $('#tour-box p').parentNode.insertBefore(bd, $('#tour-box p'));
    }
    $('#tour-box').style.top = (T.assist || T.live) ? '8px' : '30%'; $('#tour-box').style.bottom = 'auto';
    setTimeout(function () {
      if (!TOUR || TOUR !== T || T.i !== idx) return;
      var el = tourEl(st);
      if (st.sel && !el) { tourStep(T.dir || 1); return; }
      if (!el) { T.ready = false; return; }
      T.el = el;
      var r = tourRect(st, el), H = window.innerHeight, boxH = $('#tour-box').offsetHeight, h = r.bottom - r.top;
      var want = (T.assist || T.live) ? boxH + 24 : Math.max(70, (H - h) / 2);
      var y = Math.max(0, window.pageYOffset + r.top - want);
      if (Math.abs(y - window.pageYOffset) > 4) window.scrollTo({ top: y, behavior: tourReduced() ? 'auto' : 'smooth' });
      tourSettle(T, idx, function () { T.ready = true; tourPlace(); var hl = $('#tour-hl'); if (hl) { hl.classList.remove('pop'); void hl.offsetWidth; hl.classList.add('pop'); } });
    }, 90);
  }
  function tourStep(d) {
    if (!TOUR) return;
    TOUR.dir = d; TOUR.i += d;
    if (TOUR.i < 0) TOUR.i = 0;
    if (TOUR.i >= TOUR.s.length) { tourEnd(true); return; }
    tourRender();
  }
  function tourEnd(done) {
    var as = TOUR && TOUR.assist, tg = TOUR && TOUR.tag, ku = TOUR && TOUR.kurz; TOUR = null; var ov = $('#tour'); if (ov) ov.remove();
    window.removeEventListener('scroll', tourOnMove); window.removeEventListener('resize', tourOnMove);
    if (!data.profil) data.profil = {};
    if (tg) { save(); ins(done ? 'tagfuehrung_fertig' : 'tagfuehrung_abbruch'); return; }
    if (as) { if (done) { data.profil.assistDone = true; delete data.profil.assistKap; if (ku) data.profil.assistKurz = true; else data.profil.assistLang = true; } save(); ins(done ? 'assistentin_fertig' : 'assistentin_abbruch'); if (done) toast('Deine Einstellungen sind durch. Du kannst sie jederzeit ändern.'); window.scrollTo(0, 0); return; }
    data.profil.tourDone = true; save();
    ins(done ? 'rundgang_fertig' : 'rundgang_abbruch');
    show('erfassen', true);
  }
  function tourStart(assist, intro) {
    if (ui.wiz || TOUR) return;
    var tag = assist === 'tag'; assist = assist === true;
    ins(assist ? 'assistentin' : tag ? 'tagfuehrung' : 'rundgang');
    if (tag) { if (!data.profil) data.profil = {}; data.profil.tagGefuehrt = todayISO(); save(); }
    TOUR = { s: assist ? (intro === 'kurz' ? assistKurz() : intro ? [{ t: 'Schön, dass du da bist. Mit dem Stunden-Checker trägst du deine Arbeitszeiten ein. Die App rechnet Überstunden, Zuschläge und Urlaub mit und zeigt dir, ob dein Lohnzettel stimmt. Jetzt richten wir nur das Wichtigste ein, das dauert etwa eine Minute. Was du gerade nicht weißt, überspringst du mit Weiter. Alles Weitere machen wir später, wenn du magst.' }].concat(assistKurz()) : assistSteps()) : tag ? tagSteps() : tourSteps(), i: 0, dir: 1, assist: assist, tag: tag, live: !assist };
    if (assist && intro) TOUR.kurz = true;
    if (assist && !intro && data.profil && data.profil.assistKap > 1) { var ki = TOUR.s.map(function (x) { return x.kap; }).indexOf(data.profil.assistKap); if (ki > 0) TOUR.i = ki; }
    window.addEventListener('scroll', tourOnMove, { passive: true }); window.addEventListener('resize', tourOnMove);
    tourRender();
  }

  function wzFinish() {
    var w = ui.wiz;
    ins(w.mode === 'start' ? 'assistent' : 'beruf_geaendert');
    var ab = w.mode === 'start' ? '2026-01-01' : w.ab, old = w.mode === 'change' ? wAt(ab) : null, set;
    if (old && old.paket === w.paket) { set = E.clone(old); } else { set = E.neuerWertesatz(w.paket, ab); if (old) { set.betriebFrei = old.betriebFrei; set.freiVerr = old.freiVerr; set.zaUmr = old.zaUmr; set.pauseAutoMin = old.pauseAutoMin; set.runAn = old.runAn; set.runMin = old.runMin; set.runBeg = old.runBeg; set.runEnd = old.runEnd; } }
    set.gueltigAb = ab; delete set.test; set.beruf = w.beruf; set.art = w.art || null; set.bausteine = { fahrzeug: !!w.b.fahrzeug, kunden: !!w.b.kunden, praemien: !!w.b.praemien };
    set.schlechtwetter = !!w.sw; set.einstufung = String(w.einst || '').trim().slice(0, 60);
    if (!w.diaeten) set.diaeten.modell = 'aus';
    else if (set.diaeten.modell === 'aus') { set.diaeten.modell = E.PAKETE[w.paket].werte.diaeten.modell; if (set.diaeten.modell === 'aus') { set.diaeten.modell = 'stunde'; set.diaeten.maxStd = 12; } }
    var lo = parseFloat(String(w.lohn).replace(',', '.')); set.stundenlohn = isNaN(lo) ? null : lo;
    var wo = parseFloat(String(w.wochen).replace(',', '.')); if (wo > 0) set.ueberstunden.wochenStd = wo;
    var vzp = E.PAKETE[w.paket].werte.ueberstunden.wochenStd; if (wo > 0 && vzp > wo && String(w.paket).indexOf('de_') !== 0 && set.ueberstunden.modell !== 'bau') set.ueberstunden.vollzeitStd = vzp;
    var mo = parseFloat(String(w.monat || '').replace(',', '.'));
    if (mo > 0) { var wsd = set.ueberstunden.wochenStd > 0 ? set.ueberstunden.wochenStd : 38.5; set.monatslohn = mo; set.monatsStd = Math.round(wsd * 52 / 12 * 100) / 100; set.stundenlohn = Math.round(mo / set.monatsStd * 100) / 100; set.lgAuto = false; }
    var lgW = E.LOHNGRUPPEN[w.paket], gW = lgW && w.lg ? lgW.gruppen.filter(function (x) { return x.id === w.lg; })[0] : null;
    set.lg = gW ? gW.id : null; set.ls = gW && lgW.stufen && gW.l.length > 1 && w.ls !== '' && w.ls != null ? +w.ls : null;
    if (gW) { var iW = set.ls != null ? set.ls : 0, vW = gW.l[iW]; if (vW != null && (gW.m ? mo === vW : (!(mo > 0) && lo === vW))) set.lgAuto = true; }
    var ds = parseFloat(String(w.dsatz).replace(',', '.')); if (w.diaeten && set.diaeten.modell === 'stunde' && ds >= 0) set.diaeten.satz = ds;
    data.settings = data.settings.filter(function (e) { return e.gueltigAb !== ab; }); data.settings.push(set);
    if (w.mode === 'start') { if (!data.profil) data.profil = {}; data.profil.mia = { figur: w.mia === 'm' ? 'm' : 'w', name: (w.miaName || '').trim() }; data.profil.vorname = String(w.vorname || '').trim().slice(0, 40); data.profil.nachname = String(w.nachname || '').trim().slice(0, 60); }
    if (String(w.paket).indexOf('de_') === 0 && w.bl) { if (!data.profil) data.profil = {}; data.profil.bl = w.bl; }
    if (w.eintritt && validISO(w.eintritt)) { if (!data.profil) data.profil = {}; if (!data.profil.eintritt) data.profil.eintritt = w.eintritt; }
    if (w.firma && !(data.profil && data.profil.firma)) { if (!data.profil) data.profil = {}; data.profil.firma = String(w.firma).slice(0, 60); }
    if (w.geb && validISO(w.geb)) { if (!data.profil) data.profil = {}; if (!data.profil.geb) data.profil.geb = w.geb; }
    if (w.mode === 'start' && (w.cStat || w.cMia)) { if (!data.profil) data.profil = {}; data.profil.consent = { statistik: !!w.cStat, miaFragen: !!w.cMia }; }
    save(); ui.setKey = ab; var start = w.mode === 'start';
    if (start && data.profil && data.profil.consent) { try { window.StundenInsights.push(true); } catch (e) {} }
    wzClose(false); ui.miaAuto = false; renderMia(); miaAuto();
    if (start) { show('einstellungen', true); setTimeout(function () { tourStart(true, true); }, 500); }
    else {
      var spaet = data.settings.filter(function (e) { return e.gueltigAb > ab && (e.beruf !== set.beruf || (e.art || null) !== (set.art || null)); }).sort(function (x, y) { return x.gueltigAb < y.gueltigAb ? -1 : 1; })[0];
      if (spaet) toast('Gespeichert: ab ' + fmtDate(ab) + ' gilt ' + (E.berufName(set) || 'der neue Beruf') + '. Aber ab ' + fmtDate(spaet.gueltigAb) + ' gilt noch ' + (E.berufName(spaet) || 'ein anderer Beruf') + ', darum ändert sich heute nichts. Wähle dafür das spätere Datum.', 8000);
      else toast('Gespeichert: ab ' + fmtDate(ab) + ' gilt ' + (E.berufName(set) || 'der neue Beruf') + '.');
      renderSettings();
    }
  }
  // Lohngruppen für die Auswahl: Lehrlinge sehen nur Lehrlingsstufen, alle anderen nur die Lohngruppen der Beschäftigten (die schon gewählte bleibt immer sichtbar).
  function lgListe(lg, art, wahl, beruf) { return lg.gruppen.filter(function (x) { return x.id === wahl || (!!x.lehrling === (art === 'lehrling') && (!x.nur || x.nur.indexOf(beruf) >= 0)); }); }
  function lgTeiler(lg, wochenStd) { return lg.teiler || Math.round((+wochenStd > 0 ? +wochenStd : 38.5) * 52 / 12 * 100) / 100; }
  function lohnGruppenHtml(w) {
    var lg = E.LOHNGRUPPEN[w.paket]; if (!lg) return '';
    var gl = lgListe(lg, w.art, w.lg, w.beruf); if (!gl.length) return '';
    var g = lg.gruppen.filter(function (x) { return x.id === w.lg; })[0];
    var h = '<div class="field"><label for="wz-lg">' + (w.art === 'lehrling' ? 'Lehrjahr laut Kollektivvertrag' : 'Lohngruppe laut Kollektivvertrag') + ' (' + esc(lg.stand) + ')</label><small>Die Lohngruppe (oder Einstufung) bestimmt, welchen Mindestlohn dir der Kollektivvertrag zusteht. Du musst sie nicht kennen: Trage einfach deinen Stundenlohn vom Lohnzettel ein. Kennst du sie, kann die App prüfen, ob dein Lohn dem Kollektivvertrag entspricht. Du findest sie oben auf dem Lohnzettel (bei „Einstufung“, „Lohngruppe“ oder „Verwendungsgruppe“) oder im Dienstvertrag. Steht sie nirgends, frag in der Firma nach.</small><select id="wz-lg" data-wf="lg"><option value="">Nicht sicher / selbst eintragen</option>' +
      gl.map(function (x) { return '<option value="' + esc(x.id) + '"' + (w.lg === x.id ? ' selected' : '') + '>' + esc(x.name) + '</option>'; }).join('') + '</select></div>';
    if (g && lg.stufen && g.l.length > 1) h += '<div class="field"><label for="wz-ls">Stufe</label><select id="wz-ls" data-wf="ls"><option value="">Bitte wählen</option>' + lg.stufen.map(function (s, i) { return '<option value="' + i + '"' + (String(w.ls) === String(i) ? ' selected' : '') + '>' + esc(s) + '</option>'; }).join('') + '</select></div>';
    return h;
  }
  function lohnVorschlag(w) {
    var lg = E.LOHNGRUPPEN[w.paket]; if (!lg) return;
    var g = lg.gruppen.filter(function (x) { return x.id === w.lg; })[0]; if (!g) return;
    var i = lg.stufen && g.l.length > 1 ? (w.ls === '' || w.ls == null ? -1 : +w.ls) : 0; if (i < 0 || g.l[i] == null) return;
    if (g.m) { w.monat = g.l[i]; w.monatAuto = true; w.lohn = Math.round(g.l[i] / lgTeiler(lg, w.wochen) * 100) / 100; }
    else { if (w.monatAuto) { w.monat = ''; w.monatAuto = false; } w.lohn = g.l[i]; }
  }
  // Berufe alphabetisch, „Etwas anderes“ immer zuletzt
  function berufeSortiert() {
    return Object.keys(E.BERUFE).sort(function (a, b) {
      if (a === 'anderes') return 1; if (b === 'anderes') return -1;
      return E.BERUFE[a].name.localeCompare(E.BERUFE[b].name, 'de');
    });
  }
  function wzRender() {
    var w = ui.wiz, el = $('#wiz-body'), i = WZ_ORDER.indexOf(w.step), nSteps = 4, html = '';
    var shown = Math.min(i, 3) + (w.step === 'art' ? 0 : 1) + (i > 1 ? -1 : 0); // Schritt 1 (Beruf+Art), 2, 3, 4
    var einf = E.BERUFE[w.beruf] && E.BERUFE[w.beruf].einfach;
    var off = w.mode === 'start' ? 1 : 0, num = w.step === 'mia' ? 1 : (w.step === 'beruf' || w.step === 'art' ? 1 : w.step === 'bausteine' ? 2 : w.step === 'kv' ? 3 : 4) + off;
    if (w.mode === 'start') { nSteps = 4; if (w.step === 'kv' || w.step === 'lohn') num -= 1; }
    var say = { mia: 'Hallo! Wen möchtest du an deiner Seite haben?', beruf: 'Damit ich alles passend einrichte: Was machst du?', art: 'Noch eine Frage, dann weiß ich es.', bausteine: 'Sag mir, was du aufzeichnen willst. Den Rest blende ich aus.', kv: 'Der Kollektivvertrag steht auf deinem Lohnzettel.', lohn: 'Fast fertig. Jetzt noch dein Lohn.' }[w.step] || '';
    var wo = E.BERUFE[w.beruf] ? miaOutfit(w.beruf, w.art) : [];
    var sc = ''; // keine Fahrzeug-Szene mehr: nur Mia
    if (sc) html += '<div class="wzscene">' + sc + '<div class="wzsay">' + esc(say) + '</div></div>';
    else html += '<div class="wzmia">' + miaSvg(w.mia === 'm' ? 'm' : 'w', wo, '') + '<div class="wzsay">' + esc(say) + '</div></div>';
    html += '<p class="wzstep"><span>Schritt ' + num + ' von ' + nSteps + '</span>' + (w.mode === 'change' ? '<span> · gilt ab ' + esc(fmtDate(w.ab)) + '</span>' : '') + (w.step === 'mia' || w.step === 'bausteine' ? '<span class="need opt">Optional</span>' : '<span class="need must">Unbedingt nötig</span>') + '</p>';
    if (w.step === 'beruf') {
      html += '<h3>Was machst du beruflich?</h3><div class="btns"><button type="button" class="btn" id="wz-scan">Mit Lohnzettel einrichten (optional)</button></div><div class="wzlist">' + berufeSortiert().filter(function (k) { return !E.BERUFE[k].verborgen || w.beruf === k; }).map(function (k) { return '<button type="button" class="btn wzopt' + (w.beruf === k ? ' on' : '') + '" data-wb="' + k + '">' + esc(E.BERUFE[k].name) + '</button>'; }).join('') + '</div>' +
        '<details class="wzfehlt"><summary>Mein Beruf ist nicht dabei</summary><div class="field"><label for="wz-bf">Welcher Beruf fehlt, und was brauchst du dafür?</label><textarea id="wz-bf" rows="3" maxlength="600"></textarea></div><button type="button" class="btn" data-wbf="1">Senden</button><p class="hint">Bis dahin passt „Etwas anderes“. Mia schlägt dir später etwas Passendes vor.</p></details>';
    } else if (w.step === 'art') {
      var ar = E.BERUFE[w.beruf].arten;
      html += '<h3>Was beschreibt deine Arbeit am besten?</h3><div class="wzlist">' + Object.keys(ar).map(function (k) { return '<button type="button" class="btn wzopt' + (w.art === k ? ' on' : '') + '" data-wa="' + k + '">' + esc(ar[k].name) + '</button>'; }).join('') + '</div>';
    } else if (w.step === 'bausteine') {
      html += '<h3>Was möchtest du aufzeichnen?</h3><p class="hint">Du kannst das jederzeit ändern.</p>' +
        (einf ? '' : '<label class="check"><input type="checkbox" data-wc="fahrzeug"' + (w.b.fahrzeug ? ' checked' : '') + '><span>Fahrzeug und Kilometer</span></label>' +
        '<label class="check"><input type="checkbox" data-wc="kunden"' + (w.b.kunden ? ' checked' : '') + '><span>' + (E.istTour({ beruf: w.beruf, art: w.art }) ? 'Touren und Tätigkeiten' : 'Kunden, Baustellen und Tätigkeiten') + '</span></label>') +
        '<label class="check"><input type="checkbox" data-wc="praemien"' + (w.b.praemien ? ' checked' : '') + '><span>Prämien</span></label>' +
        '<label class="check"><input type="checkbox" data-wc="diaeten"' + (w.diaeten ? ' checked' : '') + '><span>Diäten</span></label>' +
        ('<label class="check"><input type="checkbox" data-wc="sw"' + (w.sw ? ' checked' : '') + '><span>' + (E.istBau({ paket: w.paket }) ? 'Schlechtwetter (Bau)' : 'Ausfallstunden (Firma schickt mich heim)') + '</span></label>');
    } else if (w.step === 'kv') {
      var kvs = ((E.BERUFE[w.beruf] && E.BERUFE[w.beruf].kvs) || ['gueter', 'bau', 'eigen']).slice(), ak = E.BERUFE[w.beruf] && E.BERUFE[w.beruf].arten && w.art && E.BERUFE[w.beruf].arten[w.art] && E.BERUFE[w.beruf].arten[w.art].kv;
      if (ak && kvs.indexOf(ak) > 0) { kvs.splice(kvs.indexOf(ak), 1); kvs.unshift(ak); }
      if (w.scan && !w.scanDone) { w.scanDone = true; lzAnwenden(w, w.scan.k, w.scan.tr); }
      if (!w.kvGewaehlt && kvs.indexOf(w.paket) !== 0) { w.paket = kvs[0]; var pv = E.PAKETE[w.paket].werte; w.wochen = pv.ueberstunden.wochenStd; w.dsatz = pv.diaeten.modell === 'stunde' ? pv.diaeten.satz : ''; w.lg = null; w.ls = null; }
      var cp = E.PAKETE[w.paket];
      html += '<h3>Welcher Kollektivvertrag gilt für dich?</h3><p class="hint">Steht auf deinem Lohnzettel. Weißt du es nicht, nimm „Weiß ich nicht“ und stelle alles selbst ein.</p><div class="btns"><button type="button" class="btn" id="wz-scan">Mit Lohnzettel einrichten (optional)</button></div><div class="wzlist">' +
        kvs.map(function (k) { return '<button type="button" class="btn wzopt' + (w.paket === k ? ' on' : '') + '" data-wk="' + k + '">' + (k === 'eigen' ? 'Weiß ich nicht / eigene Werte' : esc(E.PAKETE[k].name)) + '</button>'; }).join('') + '</div>' +
        '<details class="wzfehlt"><summary>Wo finde ich das?</summary><p class="hint">Auf deinem Lohnzettel oder im Dienstvertrag, meist oben unter „Kollektivvertrag“ oder „KV“. Sonst frag im Büro. Weißt du es nicht, nimm „Weiß ich nicht“. Du kannst es später ändern, nichts geht verloren.</p></details>' +
        '<details class="wzfehlt"><summary>Mein Kollektivvertrag ist nicht dabei</summary><div class="field"><label for="wz-kvf">Ich brauche bitte den Kollektivvertrag für …</label><input type="text" id="wz-kvf" maxlength="120" autocomplete="off"></div><button type="button" class="btn" data-wkf="1">An den Entwickler schicken</button></details>' +
        (cp && cp.pruefen && w.paket !== 'eigen' ? '<p class="hint"><strong>Noch nicht an einem echten Lohnzettel geprüft.</strong> Bitte vergleiche die Werte später mit deinem Lohnzettel.</p>' : '') +
        (String(w.paket).indexOf('de_') === 0 ? '<div class="field"><label for="wz-bl">Bundesland (für die Feiertage)</label><select id="wz-bl" data-wf="bl"><option value="">Bitte wählen</option>' + Object.keys(E.BUNDESLAENDER).map(function (k) { return '<option value="' + k + '"' + (w.bl === k ? ' selected' : '') + '>' + E.BUNDESLAENDER[k] + '</option>'; }).join('') + '</select></div>' : '') +
        (w.mode === 'start' ? '<div class="field"><label for="wz-ein">Eintritt in die Firma (optional)</label><input type="date" id="wz-ein" data-wf="eintritt" value="' + esc(w.eintritt) + '"></div>' : '');
    } else if (w.step === 'mia') {
      var mc = miaCfg();
      html += '<h3>Wer bist du, und wer soll dich begleiten?</h3><div class="miachoose">' +
        ['w', 'm'].map(function (f) { return '<button type="button" class="miaopt' + (w.mia === f ? ' on' : '') + '" data-wm="' + f + '">' + miaSvg(f) + '<span>' + (f === 'w' ? 'Weiblich' : 'Männlich') + '</span></button>'; }).join('') + '</div>' +
        '<div class="field"><label for="wz-vn">Dein Vorname</label><input type="text" id="wz-vn" maxlength="40" autocomplete="given-name" data-wf="vorname" value="' + esc(w.vorname || '') + '"></div><div class="field"><label for="wz-nn">Dein Nachname (kommt auf deine Berichte)</label><input type="text" id="wz-nn" maxlength="60" autocomplete="family-name" data-wf="nachname" value="' + esc(w.nachname || '') + '"></div>' +
        '<div class="field"><label for="wz-mianame">Wie soll sie oder er heißen?</label><input type="text" id="wz-mianame" maxlength="20" autocomplete="off" data-wf="miaName" placeholder="' + (w.mia === 'm' ? 'Milo' : 'Mia') + '" value="' + esc(w.miaName || '') + '"></div>';
    } else {
      var pw = E.PAKETE[w.paket].werte;
      html += '<h3>Dein Lohn</h3>' +
        lohnGruppenHtml(w) +
        '<div class="field"><label for="wz-einst">' + (['handel', 'gastro', 'buero', 'de_handel', 'de_gastro', 'de_buero'].indexOf(w.paket) >= 0 ? 'Einstufung auf deinem Lohnzettel (zum Beispiel „Gruppe 3“)' : 'Einstufung auf deinem Lohnzettel (zum Beispiel „Kraftfahrer 3a“ oder „LG 1/A“)') + '</label><input type="text" id="wz-einst" maxlength="60" data-wf="einst" value="' + esc(w.einst || '') + '"></div>' +
        ((E.BERUFE[w.beruf] || {}).einfach || w.monat ? '<div class="field"><label for="wz-monat">Fixer Monatslohn (€ brutto, optional)</label><input type="number" id="wz-monat" inputmode="decimal" step="0.01" min="0" data-wf="monat" value="' + esc(w.monat || '') + '"></div>' : '') +
        '<div class="field"><label for="wz-lohn">Stundenlohn (€ pro Stunde)</label><input type="number" id="wz-lohn" inputmode="decimal" step="0.01" min="0" data-wf="lohn" value="' + esc(w.lohn) + '"></div>' +
        '<div class="field"><label for="wz-wo">Wochenstunden</label><input type="number" id="wz-wo" inputmode="decimal" step="0.5" min="0" data-wf="wochen" value="' + esc(w.wochen) + '"></div>' +
        (w.diaeten && (pw.diaeten.modell === 'stunde' || pw.diaeten.modell === 'aus') ? '<div class="field"><label for="wz-ds">Diäten (€ pro Stunde)</label><input type="number" id="wz-ds" inputmode="decimal" step="0.01" min="0" data-wf="dsatz" value="' + esc(w.dsatz) + '"></div>' : '') +
        (w.mode === 'start' ? '<h4>Mithelfen (optional)</h4><label class="check"><input type="checkbox" data-wfc="statistik"' + (w.cStat ? ' checked' : '') + '><span>Anonym melden, in welchem Beruf und wie stark mein Lohnzettel von meiner Aufzeichnung abweicht. Ohne Namen, E-Mail und genaue Beträge.</span></label><label class="check"><input type="checkbox" data-wfc="miaFragen"' + (w.cMia ? ' checked' : '') + '><span>Fragen, die Mia nicht beantworten kann, an den Entwickler schicken, damit sie dazulernt.</span></label>' : '') +
        '<details class="wzfehlt"><summary>Wo finde ich das?</summary><p class="hint">Alles steht auf deinem Lohnzettel: Lohngruppe oder Einstufung oben, Stundenlohn in der Zeile „Lohn“ oder „Stundenlohn“, Wochenstunden im Dienstvertrag. Weißt du etwas nicht, lass es leer. Du kannst es später nachtragen.</p></details>' +
        '<p class="hint">Fehlt dir noch etwas? Kein Problem: Du kannst schon starten und alles später in den Einstellungen nachtragen. Die App rechnet dann auch deine bisherigen Tage damit neu.</p>';
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
      if (t.dataset.wbf) {
        var bf = ($('#wz-bf') && $('#wz-bf').value || '').trim(); if (bf.length < 3) { toast('Bitte schreib kurz, welcher Beruf fehlt.'); return; }
        try { window.StundenInsights.feedback('wunsch', '[Mein Beruf fehlt] ' + bf, null).then(function () { toast('Danke! Wir melden uns, sobald es deinen Beruf gibt.'); if ($('#wz-bf')) $('#wz-bf').value = ''; ins('beruf_fehlt'); }, function () { toast('Das Senden hat nicht geklappt. Bitte später noch einmal probieren.'); }); } catch (e) { toast('Das Senden hat nicht geklappt. Bitte später noch einmal probieren.'); }
        return;
      }
      if (t.dataset.wkf) {
        var kf = ($('#wz-kvf') && $('#wz-kvf').value || '').trim(); if (kf.length < 3) { toast('Bitte schreib kurz, welcher Kollektivvertrag fehlt.'); return; }
        var kb = (E.BERUFE[w.beruf] && E.BERUFE[w.beruf].name) || '';
        try { window.StundenInsights.feedback('wunsch', '[Mein Kollektivvertrag] Kollektivvertrag: ' + kf + ' | Beruf: ' + kb, null).then(function () { toast('Danke! Wir prüfen deinen Kollektivvertrag und melden uns.'); if ($('#wz-kvf')) $('#wz-kvf').value = ''; ins('kv_gemeldet'); }, function () { toast('Das Senden hat nicht geklappt. Bitte später noch einmal probieren.'); }); } catch (e) { toast('Das Senden hat nicht geklappt. Bitte später noch einmal probieren.'); }
        return;
      }
      if (t.dataset.wb) { wzSetBeruf(t.dataset.wb); wzNext(); return; }
      if (t.dataset.wa) { w.art = t.dataset.wa; var a = E.BERUFE[w.beruf].arten[w.art]; w.b = { fahrzeug: a.b.fahrzeug, kunden: a.b.kunden, praemien: a.b.praemien }; if (a.sw !== undefined) w.sw = a.sw; if (a.diaeten !== undefined) w.diaeten = a.diaeten; w.kvGewaehlt = false; w.lg = null; w.ls = null; wzNext(); return; }
      if (t.dataset.wm) { w.mia = t.dataset.wm; wzRender(); return; }
      if (t.dataset.wk) { w.paket = t.dataset.wk; w.kvGewaehlt = true; var p = E.PAKETE[w.paket].werte; w.wochen = p.ueberstunden.wochenStd; w.dsatz = p.diaeten.modell === 'stunde' ? p.diaeten.satz : ''; wzRender(); return; }
      if (t.id === 'wz-scan') { lzUi.modus = 'einr'; lzOpen(); return; }
      if (t.id === 'wz-next') { wzNext(); return; }
      if (t.id === 'wz-back') { wzBack(); return; }
    });
    ov.addEventListener('change', function (ev) { var t = ev.target; if (!ui.wiz) return; if (t.dataset.wc) { var k = t.dataset.wc; if (k === 'diaeten' || k === 'sw') ui.wiz[k] = t.checked; else ui.wiz.b[k] = t.checked; } });
    ov.addEventListener('input', function (ev) { var t = ev.target; if (ui.wiz && t.dataset.wf && t.tagName !== 'SELECT') ui.wiz[t.dataset.wf] = t.value; });
    ov.addEventListener('change', function (ev) { var t = ev.target; if (ui.wiz && t.dataset && t.dataset.wfc) { if (t.dataset.wfc === 'statistik') ui.wiz.cStat = t.checked; else ui.wiz.cMia = t.checked; return; } if (ui.wiz && t.tagName === 'SELECT' && (t.dataset.wf === 'lg' || t.dataset.wf === 'ls')) { ui.wiz[t.dataset.wf] = t.value; if (t.dataset.wf === 'lg') ui.wiz.ls = ''; lohnVorschlag(ui.wiz); wzRender(); } });
    $('#kv-send').addEventListener('click', function () {
      var f = { name: $('#kv-name').value.trim(), gruppe: $('#kv-gruppe').value.trim(), branche: $('#kv-branche').value.trim(), wst: $('#kv-wst').value.trim() };
      if (!f.name && !f.gruppe) { toast('Bitte trage mindestens den Kollektivvertrag oder die Einstufung ein.'); return; }
      if (!data.profil) data.profil = {}; data.profil.kv = f; save();
      var tx = 'Kollektivvertrag: ' + (f.name || '-') + ' | Einstufung: ' + (f.gruppe || '-') + ' | Branche: ' + (f.branche || '-') + ' | Wochenstunden: ' + (f.wst || '-');
      try { window.StundenInsights.feedback('wunsch', '[Mein Kollektivvertrag] ' + tx, null).then(function () { toast('Danke! Wir prüfen deinen Kollektivvertrag und melden uns.'); ins('kv_gemeldet'); }, function () { toast('Gespeichert. Das Senden hat nicht geklappt, bitte später noch einmal probieren.'); }); } catch (e) { toast('Gespeichert. Das Senden hat nicht geklappt, bitte später noch einmal probieren.'); }
    });
    [['s-vorname', 'vorname'], ['s-nachname', 'nachname']].forEach(function (q) { $('#' + q[0]).addEventListener('change', function () { if (!data.profil) data.profil = {}; data.profil[q[1]] = this.value.trim(); save(); }); });
    $('#s-geb').addEventListener('change', function () { if (!data.profil) data.profil = {}; if (this.value) data.profil.geb = this.value; else delete data.profil.geb; delete data.profil.gebGruss; save(); });
    ['#s-foto', '#s-kamera'].forEach(function (q) { $(q).addEventListener('change', function () { var f = this.files && this.files[0]; this.value = ''; if (f) fotoLaden(f); }); });
    function fotoLaden(f) {
      var rd = new FileReader();
      rd.onload = function () { var im = new Image(); im.onload = function () { var c = document.createElement('canvas'), z = 160, q = Math.min(im.width, im.height), cx = c.getContext('2d'); c.width = c.height = z; cx.drawImage(im, (im.width - q) / 2, (im.height - q) / 2, q, q, 0, 0, z, z); try { localStorage.setItem('stundenchecker.foto', c.toDataURL('image/jpeg', 0.8)); } catch (e) { } fotoZeigen(); toast('Profilbild gespeichert (nur auf diesem Handy).'); }; im.src = rd.result; };
      rd.readAsDataURL(f);
    }
    $('#s-fotobox').addEventListener('click', function (ev) { if (ev.target.id === 'foto-weg') { try { localStorage.removeItem('stundenchecker.foto'); } catch (e) { } fotoZeigen(); } });
    $('#s-ansichtsel').addEventListener('change', function () { if (!data.profil) data.profil = {}; data.profil.monatAnsicht = this.value; save(); });
    $('#s-luecke').addEventListener('change', function () { if (!data.profil) data.profil = {}; data.profil.lueckenFrage = this.checked; save(); });
    $('#s-tagf').addEventListener('change', function () { if (!data.profil) data.profil = {}; data.profil.tagesfuehrung = this.checked; save(); });
    $('#s-firma').addEventListener('change', function () { if (!data.profil) data.profil = {}; data.profil.firma = this.value.trim(); save(); });
    $('#s-beruf-go').addEventListener('click', function () { var d = $('#s-beruf-ab').value; if (!validISO(d)) { toast('Bitte ein Datum wählen.'); return; } wzOpen('change', d); });
  })();

  /* ============================================================ EINSTELLUNGEN */
  function getPath(o, p) { return p.split('.').reduce(function (a, k) { return a == null ? a : a[k]; }, o); }
  function setPath(o, p, v) { var ks = p.split('.'), last = ks.pop(); var t = ks.reduce(function (a, k) { return a[k]; }, o); t[last] = v; }
  function curEntry() { return data.settings.filter(function (e) { return e.gueltigAb === ui.setKey; })[0] || null; }

  function renderFeedback() {
    var c = $('#fb-card'); if (!c) return;
    c.hidden = !(window.StundenInsights && window.StundenInsights.on);
    var sh = $('#s-help'); if (sh) sh.hidden = c.hidden;
    var ff = $('#fb-float'); if (ff) ff.hidden = c.hidden;
    var co = (data.profil && data.profil.consent) || {};
    if ($('#c-stat')) $('#c-stat').checked = !!co.statistik;
    if ($('#c-mia')) $('#c-mia').checked = !!co.miaFragen;
  }
  function renderSettings() {
    try { renderFest(); } catch (e) { }
    renderFeedback();
    var list = sortedSettings(), cur = list.length ? E.wertAt(list, todayISO()) : null;
    if (!curEntry() && list.length) ui.setKey = (cur || list[0]).gueltigAb;
    $('#s-list').innerHTML = list.length ? list.map(function (e) {
      return '<button type="button" class="pick" data-key="' + e.gueltigAb + '" aria-pressed="' + (e.gueltigAb === ui.setKey) + '">ab ' + fmtDate(e.gueltigAb) + ' · ' + esc((E.BERUFE[e.beruf] && E.BERUFE[e.beruf].name) || (PAKET_KURZ[e.paket] || (E.PAKETE[e.paket] && E.PAKETE[e.paket].name) || '')) + (e === cur ? ' · aktuell' : '') + '</button>';
    }).join('') : '<p class="hint">Du hast noch keine eigenen Werte. Bis dahin rechnet die App mit den Werten für Güterbeförderung.</p>';
    if (!$('#s-newdate').value) { var n = new Date(); $('#s-newdate').value = E.iso(n.getFullYear(), n.getMonth() + 1, 1); }
    $('#s-new').textContent = list.length ? 'Neue Werte ab diesem Datum anlegen' : 'Erste Werte anlegen';

    var cwb = cur ? E.berufName(cur) : null;
    $('#s-beruf-now').textContent = cur ? 'Aktuell: ' + (cwb || PAKET_KURZ[cur.paket] || (E.PAKETE[cur.paket] && E.PAKETE[cur.paket].name) || 'Eigene Werte') + ' (gilt seit ' + fmtDate(cur.gueltigAb) + ').' : 'Noch nicht eingerichtet.';
    if (document.activeElement !== $('#s-beruf-ab')) $('#s-beruf-ab').value = todayISO();
    var kvp = (data.profil && data.profil.kv) || {}, kvv = {};
    if (cur) { // schon gewählte Angaben gleich anzeigen
      var lgx = E.LOHNGRUPPEN[cur.paket], gx = lgx && lgx.gruppen.filter(function (x) { return x.id === cur.lg; })[0];
      kvv.name = (E.PAKETE[cur.paket] && E.PAKETE[cur.paket].name) || '';
      kvv.gruppe = cur.einstufung || (gx ? gx.name + (lgx.stufen && cur.ls != null && cur.ls !== '' ? ', ' + lgx.stufen[+cur.ls] : '') : '');
      kvv.branche = cwb || PAKET_KURZ[cur.paket] || '';
      kvv.wst = String(E.wochenStd(cur.ueberstunden) || '');
    }
    [['name', '#kv-name'], ['gruppe', '#kv-gruppe'], ['branche', '#kv-branche'], ['wst', '#kv-wst']].forEach(function (q) { if (document.activeElement !== $(q[1])) $(q[1]).value = kvp[q[0]] || kvv[q[0]] || ''; });
    var kvc = $('#s-kv-cur'); if (kvc) kvc.textContent = kvv.name ? ': ' + (PAKET_KURZ[cur.paket] || kvv.name) : '';
    $('#lz-chk').checked = !!(data.profil && data.profil.lzLesen === true);
    [['s-vorname', 'vorname'], ['s-nachname', 'nachname']].forEach(function (q) { if (document.activeElement !== $('#' + q[0])) $('#' + q[0]).value = (data.profil && data.profil[q[1]]) || ''; });
    if (document.activeElement !== $('#s-geb')) $('#s-geb').value = (data.profil && data.profil.geb) || '';
    $('#s-ansichtsel').value = (data.profil && data.profil.monatAnsicht) || 'liste';
    fotoZeigen(); $('#s-luecke').checked = !(data.profil && data.profil.lueckenFrage === false); $('#s-tagf').checked = !!(data.profil && data.profil.tagesfuehrung === true);
    if (document.activeElement !== $('#s-firma')) $('#s-firma').value = (data.profil && data.profil.firma) || '';
    var en = curEntry();
    if (en && !en.bausteine) en.bausteine = { fahrzeug: true, kunden: true, praemien: true };
    $('#s-praemien').hidden = !!(en && en.bausteine && en.bausteine.praemien === false);
    $('#s-form').hidden = !en; $('#s-form2').hidden = !en || !!(en.diaeten && en.diaeten.modell === 'aus' && E.BERUFE[en.beruf] && E.BERUFE[en.beruf].diaeten === false);
    if (!en) return;
    if (en.ueberstunden && !en.ueberstunden.sollProTag) en.ueberstunden.sollProTag = {};
    var bauS = E.istBau(en); $('#s-sw-t').textContent = bauS ? 'Die Schlechtwetterregelung (BUAK) gilt für mich' : 'Ich zeichne Ausfallstunden auf (Firma schickt mich wegen Wetter oder fehlender Arbeit heim)'; $('#s-sw-h').textContent = bauS ? 'Schlechtwetter' : 'Ausfallstunden';
    $('#s-bku-t').textContent = E.istTour(en) ? 'Touren und Tätigkeiten' : 'Kunden, Baustellen und Tätigkeiten';
    $('#s-formtitle').textContent = 'Meine Werte ab ' + fmtDate(en.gueltigAb);
    $$('#s-form [data-path], #s-form2 [data-path]').forEach(function (inp) {
      var v = getPath(en, inp.dataset.path);
      if (inp.type === 'checkbox') inp.checked = inp.dataset.path === 'ueberstunden.zaAusgleich' ? v !== false : !!v;
      else inp.value = (v === null || v === undefined) ? '' : v;
    });
    
    $('#s-paket').innerHTML = Object.keys(E.PAKETE).map(function (k) { return '<option value="' + k + '"' + (en.paket === k ? ' selected' : '') + '>' + esc(E.PAKETE[k].name) + '</option>'; }).join('');
    paketInfo(en);
    renderStufen(en);
    (function () { // Hinweis: Was fehlt für den Lohnzettel-Vergleich
      var c = $('#s-need'), l = $('#s-needl'); if (!c || !l) return;
      var cu = cur || en, okB = !!(cu && cu.beruf), okL = !!(cu && ((cu.stundenlohn != null && cu.stundenlohn !== '' && +cu.stundenlohn > 0) || (+cu.monatslohn > 0)));
      c.hidden = false;
      l.innerHTML = [[okB, 'Beruf und Kollektivvertrag'], [okL, 'Stundenlohn oder Monatslohn']].map(function (r) { return '<li class="' + (r[0] ? 'ok' : 'miss') + '"><span aria-hidden="true">' + (r[0] ? '✓' : '✗') + '</span> <span>' + r[1] + '</span>' + (r[0] ? '' : ' <b><span>fehlt</span></b>') + '</li>'; }).join('') + (okB && okL ? '<li class="ok"><span>Alles da. Der Vergleich rechnet mit deinen Werten.</span></li>' : '');
    })();
    renderStufen(en);
    renderLgBox(en);
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
    sorted.forEach(function (e) { if (e.gueltigAb >= ab && (!bis || e.gueltigAb < bis)) { setPath(e, path, prev); delete e.test; if (path === 'stundenlohn' || path === 'monatslohn') e.lgAuto = false; } });
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
    setPath(target, path, val); delete target.test; if (path === 'stundenlohn') target.lgAuto = false;
    // spätere Wertesätze mit dem alten Wert übernehmen den neuen Betrag gleich mit
    sortedSettings().forEach(function (e) { if (e.gueltigAb > date && getPath(e, path) === getPath(E.wertAt(sortedSettings(), E.addDays(date, -1)) || {}, path)) setPath(e, path, val); });
    ui.setKey = date; save(); renderSettings(); toast('Gespeichert: ab ' + fmtDate(date) + ' gilt ' + eur.format(val) + '.');
  }

  function paketInfo(en) {
    var p = E.PAKETE[en.paket] || E.PAKETE.gueter;
    $('#s-paketinfo').innerHTML = esc(p.hinweis) + (p.pruefen ? '<br><strong>Noch nicht an einem echten Lohnzettel geprüft.</strong> Bitte kontrolliere die Werte mit deinem Lohnzettel.' : '');
    $('#s-paketinfo').className = 'notice' + (p.pruefen ? ' warn' : '');
    var ZG = { handel: 1, it_ang: 1, versicherung_ang: 1, gewerbe_ang: 1, metall: 3, bund: 4, de_spedition: 5, de_bau: 5, de_handel: 5, de_buero: 5, de_metall: 5, de_gastro: 5, eigen: 0 };
    var zg = en.paket in ZG ? ZG[en.paket] : 2;
    $('#s-zauinfo').hidden = !zg;
    Array.prototype.forEach.call($('#s-zauinfo').children, function (sp) { sp.hidden = +sp.getAttribute('data-g') !== zg; });
  }
  function settingsVisibility(en) {
    var dm = en.diaeten.modell, um = en.ueberstunden.modell;
    $('#s-runbox').hidden = !en.runAn;
    $('#s-d-stunde').hidden = dm !== 'stunde';
    $('#s-d-tag').hidden = dm !== 'tag';
    $('#s-d-vorschlag').hidden = dm === 'aus';
    $('#s-grenzefield').hidden = um !== 'bau';
    var vzh = um !== 'monat' || String(en.paket).indexOf('de_') === 0; $('#s-vollzeitfield').hidden = vzh; $('#s-mehrfield').hidden = vzh || !(+en.ueberstunden.vollzeitStd > E.wochenStd(en.ueberstunden)); $('#s-zaafield').hidden = $('#s-mehrfield').hidden;
    $('#s-gleitbox').hidden = um !== 'gleit';
    if (!en.ueberstunden.sollProTag) en.ueberstunden.sollProTag = {};
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
    $('#s-uinfo').textContent = um === 'gleit'
      ? 'Jeder Tag zählt Arbeitsstunden minus Sollzeit des Wochentags. Der Saldo aus Plus und Minus ist dein Gleitzeitkonto. Überstunden und Mehrdienstleistungen musst du dir anordnen lassen, sie zählen nicht automatisch.'
      : um === 'tag-saldo'
      ? 'Jeder Tag wird einzeln gerechnet: Arbeitsstunden minus Tagessoll (' + fh(soll) + ' Stunden). Beispiel: ein Tag mit ' + fh(soll + 2) + ' Stunden ergibt +2,0 Überstunden, ein kürzerer Tag mit ' + fh(soll - 1.5) + ' Stunden ergibt −1,5. Die Monatssumme ist die Summe aller Tage. So rechnet deine Excel.'
      : um === 'monat'
        ? 'Alle Stunden des Monats werden zusammengezählt, auch bezahlter Urlaub, Krankenstand und Feiertage. Davon werden die Sollstunden des Monats abgezogen: alle deine Arbeitstage: ' + E.sollTage(en.ueberstunden).slice().sort(function (x, y) { return ((x + 6) % 7) - ((y + 6) % 7); }).map(function (d) { return WD[d]; }).join(', ') + ' (Feiertage eingeschlossen) mal ' + fh(soll) + ' Stunden. Beispiel: ' + tage22 + ' Werktage ergeben ' + fh(tage22 * soll) + ' Sollstunden. Bei ' + fh(tage22 * soll + 11) + ' Stunden sind es 11,0 Überstunden. Im laufenden Monat wird nur bis heute gerechnet. Ein Tag ohne Eintrag, an dem du frei hattest, zieht Sollstunden ab. Trage ihn deshalb als Urlaub, Zeitausgleich oder Frei ein.'
        : 'Die Woche (Montag bis Sonntag) wird gerechnet. Stunden über der Tagesgrenze sind Überstunden, zum Beispiel alles ab Stunde ' + fh(gr) + ' an einem Tag. Dazu kommen Stunden, die über den Wochenstunden liegen. Beispiel: Tagesgrenze ' + fh(gr) + ' Stunden, Wochenstunden ' + fh(wo) + '. Fünf Tage mit je ' + fh(gr) + ' Stunden sind ' + fh(5 * gr) + ' Stunden, minus ' + fh(wo) + ' = ' + fh(Math.max(0, 5 * gr - wo)) + ' Überstunden. Sonntage und Feiertage zählen über den Zuschlag.';
  }
  // Lohngruppe laut Kollektivvertrag auch in den Einstellungen: Gruppe und Stufe wählen, Stundenlohn übernehmen.
  function stufeAusEintritt(ref) {
    var e = data.profil && data.profil.eintritt; if (!e || !validISO(e)) return '';
    var y = (new Date(ref + 'T00:00:00') - new Date(e + 'T00:00:00')) / 31557600000; if (!(y >= 0)) return '';
    return y < 5 ? 0 : y < 10 ? 1 : y < 15 ? 2 : y < 20 ? 3 : 4;
  }
  function renderLgBox(en) {
    var box = $('#s-lgbox'); if (!box) return;
    var lg = E.LOHNGRUPPEN[en.paket], gl = lg ? lgListe(lg, en.art, en.lg, en.beruf) : [];
    if (!lg || !gl.length) { box.innerHTML = ''; box.dataset.val = ''; var tk0 = $('#s-lgtake'); if (tk0) tk0.innerHTML = ''; return; }
    var g = lg.gruppen.filter(function (x) { return x.id === en.lg; })[0];
    var h = '<div class="field"><label for="s-lg">' + (en.art === 'lehrling' ? 'Lehrjahr laut Kollektivvertrag' : 'Lohngruppe laut Kollektivvertrag') + ' (' + esc(lg.stand) + ')</label><small>Die Lohngruppe (oder Einstufung) bestimmt, welchen Mindestlohn dir der Kollektivvertrag zusteht. Du musst sie nicht kennen: Trage einfach deinen Stundenlohn vom Lohnzettel ein. Kennst du sie, kann die App prüfen, ob dein Lohn dem Kollektivvertrag entspricht. Du findest sie oben auf dem Lohnzettel (bei „Einstufung“, „Lohngruppe“ oder „Verwendungsgruppe“) oder im Dienstvertrag. Steht sie nirgends, frag in der Firma nach.</small><select id="s-lg"><option value="">Nicht gewählt</option>' +
      gl.map(function (x) { return '<option value="' + esc(x.id) + '"' + (en.lg === x.id ? ' selected' : '') + '>' + esc(x.name) + '</option>'; }).join('') + '</select></div>';
    var stuf = !!(g && lg.stufen && g.l.length > 1);
    if (stuf) {
      var ls = en.ls == null || en.ls === '' ? (lg.eintritt ? stufeAusEintritt(en.gueltigAb) : '') : en.ls;
      h += '<div class="field"><label for="s-ls">Stufe</label><select id="s-ls"><option value="">Bitte wählen</option>' + lg.stufen.map(function (s, i) { return '<option value="' + i + '"' + (String(ls) === String(i) ? ' selected' : '') + '>' + esc(s) + '</option>'; }).join('') + '</select></div>';
      en._lsVor = ls;
    }
    var i = stuf ? (en._lsVor === '' || en._lsVor == null ? -1 : +en._lsVor) : 0, val = g && i >= 0 ? g.l[i] : null, mon = !!(g && g.m);
    delete en._lsVor;
    box.innerHTML = h; box.dataset.val = val != null ? val : ''; box.dataset.m = mon ? '1' : '';
    var ist = mon ? en.monatslohn : en.stundenlohn;
    var on = val != null && (en.lgAuto === true || (en.lgAuto === undefined && ist != null && Math.abs(ist - val) < 0.005));
    if (on) lgNehmen(en, val, mon, true);
    var tk = $('#s-lgtake'); if (tk) tk.innerHTML = val != null ? '<label class="check" for="s-lg-take"><input type="checkbox" id="s-lg-take"' + (on ? ' checked' : '') + '><span>' + ((mon ? 'Monatslohn' : 'Mindestlohn') + ' laut Kollektivvertrag verwenden: ' + esc(eur.format(val))) + '</span></label>' : '';
    var sl = $('#s-lohn'); if (sl) { sl.disabled = on; if (on) sl.value = en.stundenlohn; }
    var sm = $('#s-monat'); if (sm) { sm.disabled = on && mon; if (on && mon) sm.value = val; }
  }
  // Mindestlohn laut Kollektivvertrag übernehmen: Stundenlohn, bei Monatslöhnen (Lehrlinge, Metall) Monatslohn und Teiler dazu
  function lgNehmen(en, val, mon, still) {
    var lg = E.LOHNGRUPPEN[en.paket], ch = false;
    if (mon) {
      var ms = lgTeiler(lg, en.ueberstunden && en.ueberstunden.wochenStd), sh = Math.round(val / ms * 100) / 100;
      if (en.monatslohn !== val || en.monatsStd !== ms || en.stundenlohn !== sh) { en.monatslohn = val; en.monatsStd = ms; en.stundenlohn = sh; ch = true; }
    } else if (en.stundenlohn !== val) { en.stundenlohn = val; ch = true; }
    if (en.lgAuto !== true) { en.lgAuto = true; ch = true; }
    if (ch && still !== undefined) save();
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
    setPath(en, inp.dataset.path, v); if (inp.dataset.path === 'stundenlohn' || inp.dataset.path === 'monatslohn') en.lgAuto = false;
    if (inp.dataset.path === 'monatslohn' || inp.dataset.path === 'monatsStd') {
      var ms = en.monatsStd > 0 ? en.monatsStd : 173;
      if (en.monatslohn > 0) { en.stundenlohn = Math.round(en.monatslohn / ms * 100) / 100; var sl = $('#s-lohn'); if (sl) sl.value = en.stundenlohn; }
    }
    if (inp.dataset.path === 'ueberstunden.wochenStd' && en.ueberstunden.vollzeitStd == null && String(en.paket).indexOf('de_') !== 0) {
      var pkw = E.PAKETE[en.paket] && E.PAKETE[en.paket].werte.ueberstunden.wochenStd;
      if (pkw > en.ueberstunden.wochenStd && en.ueberstunden.wochenStd > 0) { en.ueberstunden.vollzeitStd = pkw; var vz = $('#s-vollzeit'); if (vz) vz.value = pkw; }
    }
    delete en.test;
    save();
    settingsVisibility(en);
  }
  function onDateChange(inp) {
    var en = curEntry(); if (!en) return;
    var v = inp.value;
    if (!validISO(v)) { inp.value = en.gueltigAb; return; }
    if (data.settings.some(function (e) { return e !== en && e.gueltigAb === v; })) { toast('Für dieses Datum gibt es schon Werte.'); inp.value = en.gueltigAb; return; }
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
    if (t.dataset.tour) { if (t.dataset.tour === 'next') tourStep(1); else if (t.dataset.tour === 'prev') tourStep(-1); else if (t.dataset.tour === 'nein') tourEnd(true); else tourEnd(false); return; }
    if (t.dataset.seg && t.classList.contains('segb')) { setSeg(t.dataset.seg); return; }
    if (t.dataset.kz !== undefined && t.classList.contains('kzlink')) {
      var kid = t.dataset.kj !== undefined ? 'k-t' + t.dataset.kz + '-' + t.dataset.kj : 'k-n' + t.dataset.kz, ke = document.getElementById(kid) || document.getElementById('k-n' + t.dataset.kz);
      if (ke) { var kb = ke.closest('.taet') || ke.closest('.kunde2') || ke; ke.scrollIntoView({ behavior: 'smooth', block: 'center' }); kb.classList.add('kzflash'); setTimeout(function () { kb.classList.remove('kzflash'); }, 1800); }
      return;
    }
    if (t.id === 'tour-start') { tourStart(); return; }
    if (t.id === 'assist-start') { tourStart(true); return; }
    if (t.id === 'an-share') { var tx = anText(); if (navigator.share) { navigator.share({ text: tx }).catch(function () {}); } else if (navigator.clipboard) { navigator.clipboard.writeText(tx).then(function () { toast('Kopiert.'); }, function () { toast('Kopieren hat nicht geklappt.'); }); } return; }
    if (t.dataset.an) { var cur = (ui.edDraft.an || {}).w, neu = cur === t.dataset.an ? '' : t.dataset.an; anSet('w', neu); anVorschlag(neu); anChips(); return; }
    if (t.dataset.prvor != null) {
      var bx = $('#pr-vor'), it = bx && bx._list && bx._list[+t.dataset.prvor];
      if (it) { praemienListe().push({ id: 'p' + Date.now().toString(36) + Math.floor(Math.random() * 1000).toString(36), name: it[0], betrag: it[3] || 0, einheit: it[1], regel: it[2], taet: '' }); save(); renderPraemienSettings(); var nn = $('#pr-b' + (praemienListe().length - 1)); if (nn) nn.focus(); }
      return;
    }
    if (t.id === 's-lg-take') {
      var enx = curEntry(), vx = parseFloat(($('#s-lgbox') || {}).dataset && $('#s-lgbox').dataset.val);
      if (enx && !isNaN(vx)) { if (t.checked) lgNehmen(enx, vx, !!$('#s-lgbox').dataset.m); else enx.lgAuto = false; delete enx.test; save(); renderSettings(); }
      return;
    }
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
      case 'lm-prev': ui.abAlle = false; ui.m--; if (ui.m < 1) { ui.m = 12; ui.y--; } renderLohn(); return;
      case 'lm-next': ui.abAlle = false; ui.m++; if (ui.m > 12) { ui.m = 1; ui.y++; } renderLohn(); return;
      case 'lm-today': ui.y = now.getFullYear(); ui.m = now.getMonth() + 1; renderLohn(); return;
      case 'ab-more': ui.abAlle = true; renderAbgleich(ui.summe); return;
      case 'ab-art-a': case 'ab-art-b': if (!data.profil) data.profil = {}; data.profil.lzAlles = t.id === 'ab-art-b'; save(); renderAbgleich(ui.summe); return;
      case 'e-prev': openEditor(E.addDays(ui.edDate, -1), ui.edFrom); return;
      case 'e-next': openEditor(E.addDays(ui.edDate, 1), ui.edFrom); return;
      case 'ds-add': dsNeu('eigen', ''); var dn = $('#ds-n' + (diensteListe().length - 1)); if (dn) dn.focus(); return;
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
        if (data.settings.some(function (e) { return e.gueltigAb === date; })) { toast('Für dieses Datum gibt es schon Werte.'); return; }
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
        data.settings = data.settings.filter(function (e) { return e.gueltigAb !== ui.setKey; }); ui.setKey = null; save(); renderSettings(); toast('Werte gelöscht.');
      }); return;
      case 'b-save': ins('sicherung'); {
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
      case 'ab-clear': arm(t, 'Wirklich alle löschen?', function () { var key = ui.y + '-' + pad(ui.m); if (data.abgleich) delete data.abgleich[key]; save(); neuZeichnen(); toast('Die Eingaben dieses Monats sind gelöscht.'); }); return;
      case 'b-wipe': arm(t, 'Wirklich alles löschen?', function () { data = { version: 1, settings: [], days: {}, abgleich: {}, profil: {} }; save(); ui.setKey = null; ui.edDate = null; toast('Alle Daten gelöscht.'); show('monat'); }); return;
      case 't-load': loadTest(); return;
      case 't-remove': removeTest(); return;
    }
    if (t.dataset.key) { ui.setKey = t.dataset.key; renderSettings(); return; }
    if (t.dataset.rmds !== undefined) { arm(t, 'Sicher?', function () { diensteListe().splice(+t.dataset.rmds, 1); save(); renderDiensteSettings(); }); return; }
    if (t.dataset.dsneu) { dsNeu(t.dataset.dsneu, t.textContent); return; }
    if (t.dataset.addtl !== undefined) { var pa = praemienListe()[+t.dataset.addtl]; if (pa) { if (!pa.teile || !pa.teile.length) pa.teile = [{ name: '', betrag: +pa.betrag || 0 }]; pa.teile.push({ name: '', betrag: 0 }); save(); renderPraemienSettings(); var tn = $('#pr-tn' + t.dataset.addtl + '-' + (pa.teile.length - 1)); if (tn) tn.focus(); } return; }
    if (t.dataset.rmtl !== undefined) { var rp = t.dataset.rmtl.split('.'), pb = praemienListe()[+rp[0]]; if (pb && pb.teile) { pb.teile.splice(+rp[1], 1); if (pb.teile.length) pb.betrag = Math.round(pb.teile.reduce(function (a, x) { return a + (+x.betrag || 0); }, 0) * 100) / 100; else delete pb.teile; save(); renderPraemienSettings(); } return; }
    if (t.dataset.rmpr !== undefined) { arm(t, 'Sicher?', function () { praemienListe().splice(+t.dataset.rmpr, 1); save(); renderPraemienSettings(); }); return; }
    if (t.dataset.rmfz !== undefined) { ui.edDraft.fahrzeuge.splice(+t.dataset.rmfz, 1); renderFahrzeuge(); return; }
    if (t.dataset.tchip !== undefined) { var tp = String(t.dataset.tcs).split('-'), tk = ui.edDraft.kunden[+tp[0]]; if (tk && tk.taet[+tp[1]]) { tk.taet[+tp[1]].tat = t.dataset.tchip; var ti2 = $('#k-t' + t.dataset.tcs); if (ti2) ti2.value = t.dataset.tchip; var tc2 = $('#e-kunden [data-tc="' + t.dataset.tcs + '"]'); if (tc2) tc2.innerHTML = tatChips(t.dataset.tchip, t.dataset.tcs); updatePreview(); } return; }
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
      if (t.dataset.pj !== undefined) {
        var tl = po.teile && po.teile[+t.dataset.pj]; if (!tl) return;
        if (t.dataset.pf === 'betrag') { var tv = parseFloat(String(t.value).replace(',', '.')); tl.betrag = isNaN(tv) ? 0 : tv; } else tl.name = t.value;
        po.betrag = Math.round(po.teile.reduce(function (a, x) { return a + (+x.betrag || 0); }, 0) * 100) / 100;
        var sb = $('#pr-b' + t.dataset.pr); if (sb) sb.value = po.betrag;
        save(); return;
      }
      if (t.dataset.pf === 'einheit' && t.value !== 'monat' && po.teile) { delete po.teile; }
      if (t.dataset.pf === 'einheit') { po.einheit = t.value; save(); renderPraemienSettings(); return; }
      if (t.dataset.pf === 'betrag') { var bv = parseFloat(String(t.value).replace(',', '.')); po.betrag = isNaN(bv) ? 0 : bv; } else po[t.dataset.pf] = t.value;
      save(); return;
    }
    if (t.dataset && t.dataset.ds !== undefined && t.closest('#ds-list')) {
      var dso = diensteListe()[+t.dataset.ds]; if (!dso) return;
      if (t.dataset.df === 'einheit') { dso.einheit = t.value; save(); renderDiensteSettings(); return; }
      if (t.dataset.df === 'betrag') { var dbv = parseFloat(String(t.value).replace(',', '.')); dso.betrag = isNaN(dbv) ? 0 : dbv; } else dso[t.dataset.df] = t.value;
      save(); return;
    }
    if (t.dataset && t.dataset.dd !== undefined && t.closest('#e-dienste')) {
      if (!ui.edDraft.dienste) ui.edDraft.dienste = {};
      var dv = t.type === 'checkbox' ? (t.checked ? 1 : 0) : parseFloat(String(t.value).replace(',', '.'));
      if (dv > 0) ui.edDraft.dienste[t.dataset.dd] = dv; else delete ui.edDraft.dienste[t.dataset.dd];
      return;
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
    if (t.dataset && t.dataset.k !== undefined && t.closest('#e-kunden')) { var ko = ui.edDraft.kunden[+t.dataset.k]; if (t.dataset.j !== undefined) { ko.taet[+t.dataset.j][t.dataset.f] = t.value; if (t.dataset.f === 'tat') { var tc = $('#e-kunden [data-tc="' + t.dataset.k + '-' + t.dataset.j + '"]'); if (tc) tc.innerHTML = tatChips(t.value, t.dataset.k + '-' + t.dataset.j); } } else ko[t.dataset.f] = t.value; updatePreview(); return; }
    if (t.dataset && t.dataset.i !== undefined && t.closest('#e-pausen')) { ui.edDraft.pausen[+t.dataset.i][t.dataset.f] = t.value; updatePreview(); return; }
    if (t.dataset && t.dataset.si !== undefined) { var en = curEntry(); var v = parseFloat(String(t.value).replace(',', '.')); en.diaeten.stufen[+t.dataset.si][t.dataset.sf] = isNaN(v) ? 0 : v; delete en.test; save(); return; }
    if (id && id.indexOf('s-wd-') === 0) { var ew = curEntry(); if (ew) { var set = E.sollTage(ew.ueberstunden), wdn = +id.slice(5), ix = set.indexOf(wdn); if (t.checked && ix < 0) set.push(wdn); if (!t.checked && ix >= 0) set.splice(ix, 1); ew.ueberstunden.sollTage = set.sort(function (x, y) { return x - y; }); delete ew.test; save(); settingsVisibility(ew); } return; }
    if (t.dataset && t.dataset.path) { if (ev.type === 'change' && t.dataset.path === 'gueltigAb') onDateChange(t); else onSettingInput(t); return; }
    if (ev.type === 'change' && id === 's-paket') { var e = curEntry(); if (e) { e.paket = t.value; delete e.test; save(); paketInfo(e); renderSettings(); } return; }
    switch (id) {
      case 'e-date': if (validISO(t.value)) openEditor(t.value, ui.edFrom); return;
      case 'e-fv': if (t.value) ui.edDraft.fv = t.value; else delete ui.edDraft.fv; freiNote(); updatePreview(); return;
      case 'e-status': ui.edDraft.status = t.value; $('#e-work').hidden = t.value !== 'arbeit'; $('#e-frbox').hidden = t.value !== 'freistellung'; if (t.value !== 'freistellung') { delete ui.edDraft.fv; $('#e-fv').value = ''; } else { freiNote(); } $('#e-erbox').hidden = t.value !== 'ersatzruhe'; if (t.value !== 'ersatzruhe' && t.value !== 'arbeit') delete ui.edDraft.extra; $('#e-erx').value = t.value === 'ersatzruhe' && ui.edDraft.extra ? ui.edDraft.extra : ''; renderPraemienTag(); anChips(); updatePreview(); return;
      case 'e-von': ui.edDraft.von = t.value; updatePreview(); return;
      case 'e-bis': ui.edDraft.bis = t.value; updatePreview(); return;
      case 'e-diaeten': ui.edDraft.diaeten = t.value === '' ? null : parseFloat(String(t.value).replace(',', '.')); updatePreview(); return;
      case 'e-erx': { var ev2 = parseFloat(String(t.value).replace(',', '.')); if (ev2 > 0) ui.edDraft.extra = ev2; else delete ui.edDraft.extra; updatePreview(); return; }
      case 'e-extra': { var xv = parseFloat(String(t.value).replace(',', '.')); if (xv > 0) ui.edDraft.extra = xv; else delete ui.edDraft.extra; updatePreview(); return; }
      case 'e-sw': ui.edDraft.sw = parseFloat(String(t.value).replace(',', '.')) || 0; ui.edDraft.swAuto = false; anChips(); updatePreview(); return;
      case 'e-swon': ui.edDraft.swOn = t.checked; if (t.checked) ui.edDraft.swAuto = true; else { ui.edDraft.sw = 0; $('#e-sw').value = ''; } $('#e-swbox').hidden = !t.checked; anChips(); updatePreview(); return;
      case 'e-swgrund': ui.edDraft.swGrund = t.value; return;
      case 'e-an': anSet('t', t.value); return;
      case 'e-spaeter': ui.edDraft.spaeter = t.checked; return;
    }
    if (t.tagName === 'INPUT' && id && id.indexOf('ab-') === 0) {
      var key = monthKey(), f = id.slice(3), o = data.abgleich[key] || (data.abgleich[key] = {});
      var num = parseFloat(String(t.value).replace(',', '.'));
      o[f] = (t.value === '' || isNaN(num)) ? null : num; delete o.test;
      var any = Object.keys(o).some(function (k) { return k !== 'test' && k !== 'gelesen' && o[k] != null; });
      if (!any) delete data.abgleich[key];
      save(); paintAbgleich(); return;
    }
  }
  document.addEventListener('input', function (ev) { if (ev.target.id === 'e-date') return; onInput(ev); });
  document.addEventListener('change', function (ev) {
    var t = ev.target;
    if (t.id === 's-lg-take') {
      var enx = curEntry(), vx = parseFloat(($('#s-lgbox') || {}).dataset && $('#s-lgbox').dataset.val);
      if (enx && !isNaN(vx)) { if (t.checked) lgNehmen(enx, vx, !!$('#s-lgbox').dataset.m); else enx.lgAuto = false; delete enx.test; save(); renderSettings(); }
      return;
    }
    if (t.id === 's-lg' || t.id === 's-ls') {
      var en0 = curEntry(); if (en0) { if (t.id === 's-lg') { en0.lg = t.value || null; en0.ls = null; } else en0.ls = t.value === '' ? null : +t.value; delete en0.test; save(); renderLgBox(en0); } return;
    }
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
  (function feedbackInit() {
    var img = null;
    function msg(t, bad) { var m = $('#fb-msg'); if (!m) return; m.textContent = t; m.hidden = !t; m.style.color = bad ? 'var(--bad, #b3261e)' : ''; }
    function on2(id, ev, fn) { var el = $(id); if (el) el.addEventListener(ev, fn); }
    on2('#fb-img', 'change', function () {
      var f = this.files && this.files[0]; img = null; $('#fb-prev').hidden = true; if (!f) return;
      window.StundenInsights.verkleinern(f).then(function (d) { img = d; $('#fb-prev').src = d; $('#fb-prev').hidden = false; msg(''); }, function () { msg('Das Bild konnte nicht verwendet werden.', true); });
    });
    on2('#fb-send', 'click', function () {
      var tx = ($('#fb-text').value || '').trim(); if (!tx && !img) { msg('Bitte schreib etwas oder hänge ein Bild an.', true); return; }
      var b = this; b.disabled = true;
      window.StundenInsights.feedback($('#fb-art').value, tx, img).then(function () {
        $('#fb-text').value = ''; $('#fb-img').value = ''; $('#fb-prev').hidden = true; img = null; msg('Danke! Deine Rückmeldung ist angekommen.'); b.disabled = false;
      }, function () { msg('Das Senden hat nicht geklappt. Bitte später noch einmal probieren.', true); b.disabled = false; });
    });
    function cons(key) { return function () { if (!data.profil) data.profil = {}; if (!data.profil.consent) data.profil.consent = {}; data.profil.consent[key] = !!this.checked; data.profil.mithelfenNein = !data.profil.consent.statistik && !data.profil.consent.miaFragen; save(); try { window.StundenInsights.push(true); } catch (e) {} }; }
    /* Rückmeldung direkt von der Seite: Bild vom Bildschirm machen, Fenster darüber öffnen, Text darunter schreiben */
    function shotSeite() {
      return new Promise(function (res) {
        try {
          var W = window.innerWidth, H = window.innerHeight, sx = window.scrollX, sy = window.scrollY;
          var wrap = document.createElement('div'); wrap.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
          wrap.style.cssText = 'position:absolute;left:' + (-sx) + 'px;top:' + (-sy) + 'px;width:' + document.documentElement.scrollWidth + 'px;';
          var bodyCs = getComputedStyle(document.body), bg = bodyCs.backgroundColor;
          function kopie(o) {
            if (o.nodeType === 3) return o.cloneNode(false);
            if (o.nodeType !== 1) return null;
            var tag = o.tagName.toLowerCase();
            if (tag === 'script' || tag === 'style' || tag === 'link' || tag === 'noscript' || tag === 'iframe' || tag === 'video') return null;
            var cs = getComputedStyle(o);
            if (cs.display === 'none' || o.hidden) return null;
            var c;
            if (tag === 'canvas') { c = document.createElement('img'); try { c.setAttribute('src', o.toDataURL('image/png')); } catch (e) { } }
            else c = o.cloneNode(false);
            var css = '', i;
            for (i = 0; i < cs.length; i++) css += cs[i] + ':' + cs.getPropertyValue(cs[i]) + ';';
            c.setAttribute('style', css);
            c.removeAttribute('id'); c.removeAttribute('class');
            if (tag === 'input') { if (o.type === 'checkbox' || o.type === 'radio') { if (o.checked) c.setAttribute('checked', 'checked'); else c.removeAttribute('checked'); } else c.setAttribute('value', o.value); }
            if (tag === 'textarea') c.textContent = o.value;
            if (tag === 'select') { for (i = 0; i < o.options.length; i++) { /* nur gewählte Option zeigen */ } var t = document.createElement('span'); t.setAttribute('style', css); t.textContent = o.options[o.selectedIndex] ? o.options[o.selectedIndex].text : ''; return t; }
            if (tag === 'canvas') return c;
            for (var ch = o.firstChild; ch; ch = ch.nextSibling) { var k = kopie(ch); if (k) c.appendChild(k); }
            return c;
          }
          var b = kopie(document.body); if (!b) { res(null); return; }
          b.style.margin = '0'; b.style.position = 'static'; b.style.minHeight = '0';
          wrap.appendChild(b);
          var holder = document.createElement('div'); holder.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
          holder.setAttribute('style', 'position:relative;overflow:hidden;width:' + W + 'px;height:' + H + 'px;background:' + (bg && bg !== 'rgba(0, 0, 0, 0)' ? bg : '#fff') + ';');
          holder.appendChild(wrap);
          var xml = new XMLSerializer().serializeToString(holder);
          var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '"><foreignObject x="0" y="0" width="100%" height="100%">' + xml + '</foreignObject></svg>';
          var im = new Image();
          var fertig = false, to = setTimeout(function () { if (!fertig) { fertig = true; res(null); } }, 6000);
          im.onload = function () {
            if (fertig) return;
            try {
              var z = Math.min(1, 900 / Math.max(W, H)), cv = document.createElement('canvas'); cv.width = Math.round(W * z); cv.height = Math.round(H * z);
              var cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height); cx.drawImage(im, 0, 0, cv.width, cv.height);
              var q = 0.75, d = cv.toDataURL('image/jpeg', q);
              while (d.length > 600000 && q > 0.3) { q -= 0.1; d = cv.toDataURL('image/jpeg', q); }
              fertig = true; clearTimeout(to); res(d.length > 700000 ? null : d);
            } catch (e) { fertig = true; clearTimeout(to); res(null); }
          };
          im.onerror = function () { if (!fertig) { fertig = true; clearTimeout(to); res(null); } };
          im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
        } catch (e) { res(null); }
      });
    }
    var sheet = null, sheetImg = null, sheetSeite = '';
    function sheetBauen() {
      sheet = document.createElement('div'); sheet.id = 'fb-sheet'; sheet.className = 'cropov fbov'; sheet.hidden = true;
      sheet.innerHTML = '<div class="lzbox" role="dialog" aria-modal="true" aria-labelledby="fs-h"><h3 id="fs-h">Rückmeldung an den Entwickler</h3>' +
        '<div id="fs-bildbox"><img id="fs-prev" alt="" style="width:100%;max-height:200px;object-fit:contain;border:1px solid var(--line);border-radius:8px;background:#fff"><label class="check" for="fs-mit"><input type="checkbox" id="fs-mit" checked><span>Bild dieser Seite mitschicken</span></label><p class="hint">Bitte keine Beträge, Namen oder Sozialversicherungsnummer auf dem Bild.</p></div>' +
        '<div class="field"><label for="fs-art">Worum geht es?</label><select id="fs-art"><option value="fehler">Etwas stimmt nicht</option><option value="wunsch">Anregung</option><option value="frage">Ich habe eine Frage</option><option value="lob">Das gefällt mir</option></select></div>' +
        '<div class="field"><label for="fs-text">Deine Nachricht</label><textarea id="fs-text" rows="4" maxlength="4000"></textarea></div>' +
        '<p id="fs-msg" class="hint" hidden></p>' +
        '<div class="btns"><button type="button" class="btn" id="fs-x">Schließen</button><button type="button" class="btn primary" id="fs-send">Senden</button></div></div>';
      document.body.appendChild(sheet);
      function m(t, bad) { var e = $('#fs-msg'); e.textContent = t; e.hidden = !t; e.style.color = bad ? 'var(--bad, #b3261e)' : ''; }
      $('#fs-x').addEventListener('click', function () { sheet.hidden = true; });
      $('#fs-send').addEventListener('click', function () {
        var tx = ($('#fs-text').value || '').trim(), mit = sheetImg && $('#fs-mit').checked ? sheetImg : null;
        if (!tx && !mit) { m('Bitte schreib etwas oder hänge ein Bild an.', true); return; }
        var b = this; b.disabled = true;
        window.StundenInsights.feedback($('#fs-art').value, tx, mit, sheetSeite).then(function () {
          b.disabled = false; sheet.querySelector('.lzbox').innerHTML = '<h3>Danke für deine Rückmeldung!</h3><p>Die Nachricht wurde erfolgreich übertragen.</p><div class="btns"><button type="button" class="btn primary" id="fs-ok">Schließen</button></div>'; $('#fs-ok').onclick = function () { sheet.remove(); sheet = null; };
        }, function () { m('Das Senden hat nicht geklappt. Bitte später noch einmal probieren.', true); b.disabled = false; });
      });
    }
    on2('#fb-float', 'click', function () {
      if (!window.StundenInsights || !window.StundenInsights.on) return;
      if (!sheet) sheetBauen();
      var ff = $('#fb-float'); ff.hidden = true;
      sheetSeite = '';
      try {
        var tops = Array.prototype.slice.call(document.querySelectorAll('#lz-dlg, #wiz, .cropov, .lzov, [role=dialog]')).filter(function (e) { return e.offsetParent !== null || (e.getClientRects && e.getClientRects().length); });
        var qel = tops.filter(function (e) { return !e.hidden && !e.closest('#fb-sheet') && e.id !== 'fb-sheet'; }).pop() || document.querySelector('.view:not([hidden])');
        if (qel) sheetSeite = String(qel.innerText || '').replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim().slice(0, 1800);
      } catch (e) { }
      shotSeite().then(function (d) {
        ff.hidden = false; sheetImg = d;
        $('#fs-bildbox').hidden = !d; if (d) { $('#fs-prev').src = d; $('#fs-mit').checked = true; }
        $('#fs-msg').hidden = true; sheet.hidden = false; setTimeout(function () { var t = $('#fs-text'); if (t) t.focus(); }, 100);
      });
    });
    on2('#news-an', 'change', function () { newsSet('an', this.checked); if (this.checked && !newsCfg().gesehen) newsSet('gesehen', ''); renderNews(); });
    on2('#news-alle', 'change', function () { newsSet('alle', this.checked); renderNews(); });
    on2('#news-freq', 'click', function (ev) { var b = ev.target.closest('[data-nf]'); if (!b) return; newsSet('freq', b.dataset.nf); renderNews(); });
    on2('#c-stat', 'change', cons('statistik'));
    on2('#c-mia', 'change', cons('miaFragen'));
    try { renderFeedback(); } catch (e) { }
    window.addEventListener('load', function () { try { renderFeedback(); } catch (e) { } }); // insights.js wird erst nach app.js geladen: Feedback-Knopf danach zeigen
    if (document.readyState === 'complete') { try { renderFeedback(); } catch (e) { } }
  })();
  setTimeout(function () { try { if (((mitHelfenFaellig() && (miaCfg().skip.mithelfen || 0) < 2) || (newsDue() && (miaNext() || {}).k && miaNext().k.indexOf('news_') === 0)) && !miaCfg().ruhig) { ui.miaAuto = true; if (!ui.wiz && !TOUR) miaOpen(true); } } catch (e) { } }, 2500);
  show(data.settings.length === 0 && Object.keys(data.days).length === 0 ? 'monat' : 'erfassen'); // Wer schon Daten hat, startet direkt mit der Eingabe


  /* ---- Eigenes App-Symbol ---- */
  var APPICONS = [
    ['uhr', 'Uhr', '<circle cx="48" cy="48" r="29" fill="none" stroke="#64b5f6" stroke-width="7"/><path d="M48 30v19l12 8" fill="none" stroke="#f3f4f6" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>'],
    ['lkw', 'Lkw', '<rect x="12" y="30" width="44" height="30" rx="3" fill="#64b5f6"/><path d="M58 40h14l12 12v8H58z" fill="#f3f4f6"/><circle cx="28" cy="64" r="7" fill="#f3f4f6" stroke="#1f2937" stroke-width="3"/><circle cx="70" cy="64" r="7" fill="#f3f4f6" stroke="#1f2937" stroke-width="3"/>'],
    ['lkwkran', 'Lkw mit Kran', '<rect x="10" y="48" width="42" height="14" rx="3" fill="#64b5f6"/><path d="M54 48h12l10 10v4H54z" fill="#f3f4f6"/><circle cx="24" cy="66" r="6" fill="#f3f4f6" stroke="#1f2937" stroke-width="3"/><circle cx="66" cy="66" r="6" fill="#f3f4f6" stroke="#1f2937" stroke-width="3"/><path d="M22 48L60 16" stroke="#f3f4f6" stroke-width="5" stroke-linecap="round"/><path d="M60 16v18" stroke="#64b5f6" stroke-width="3"/><rect x="56" y="34" width="8" height="6" rx="1.5" fill="#64b5f6"/>'],
    ['bagger', 'Bagger', '<rect x="14" y="62" width="48" height="12" rx="6" fill="#f3f4f6"/><rect x="22" y="44" width="28" height="18" rx="3" fill="#64b5f6"/><path d="M48 50L66 28l14 12" fill="none" stroke="#f3f4f6" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><path d="M76 40l8 10-12 2z" fill="#64b5f6"/>'],
    ['kran', 'Kran', '<rect x="14" y="62" width="40" height="11" rx="3" fill="#f3f4f6"/><rect x="20" y="48" width="16" height="14" rx="2" fill="#64b5f6"/><path d="M34 52L78 20" stroke="#f3f4f6" stroke-width="6" stroke-linecap="round"/><path d="M78 20v26" stroke="#64b5f6" stroke-width="4"/><rect x="73" y="46" width="10" height="8" rx="2" fill="#64b5f6"/>'],
    ['euro', 'Euro', '<circle cx="48" cy="48" r="30" fill="#64b5f6"/><text x="48" y="61" font-size="40" font-weight="700" text-anchor="middle" fill="#1f2937" font-family="Arial,sans-serif">€</text>'],
    ['laptop', 'Laptop', '<rect x="22" y="26" width="52" height="34" rx="4" fill="#64b5f6"/><path d="M12 66h72l-6 8H18z" fill="#f3f4f6"/>'],
    ['ordner', 'Ordner', '<path d="M14 28h24l8 8h36v38H14z" fill="#64b5f6"/><rect x="14" y="44" width="68" height="30" rx="3" fill="#f3f4f6"/>'],
    ['wagen', 'Einkaufswagen', '<path d="M12 26h12l8 32h38l8-24H28" fill="none" stroke="#f3f4f6" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><circle cx="38" cy="70" r="6" fill="#64b5f6"/><circle cx="64" cy="70" r="6" fill="#64b5f6"/>'],
    ['schluessel', 'Schraubenschlüssel', '<path d="M64 18a18 18 0 0 0-16 26L18 74l6 6 30-30a18 18 0 0 0 26-16l-11 11-9-2-2-9z" fill="#64b5f6"/>'],
    ['haube', 'Kochhaube', '<path d="M28 58V46a14 14 0 0 1 4-27 18 18 0 0 1 32 0 14 14 0 0 1 4 27v12z" fill="#f3f4f6"/><rect x="28" y="62" width="40" height="12" rx="3" fill="#64b5f6"/>'],
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

  /* ---- Info-Zeichen (i): Beschreibungen unter Feldern werden zu einem Fenster, das auf Tipp aufgeht ---- */
  (function () {
    var dlg = document.createElement('div'); dlg.id = 'info-dlg'; dlg.className = 'cropov'; dlg.hidden = true;
    dlg.innerHTML = '<div class="lzbox" role="dialog" aria-modal="true" aria-labelledby="info-h"><h3 id="info-h"></h3><p id="info-t"></p><div class="btns"><button type="button" class="btn primary" id="info-x">Schließen</button></div></div>';
    document.body.appendChild(dlg);
    function close() { dlg.hidden = true; }
    function nearLabel(el) { var f = el.closest('.field, .abrow'); return f ? f.querySelector('label') : null; }
    function infoTarget(sm) {
      if (sm.matches('.field > small, .abrow > small.abhint')) return nearLabel(sm);
      var isHint = sm.tagName === 'SMALL' || (sm.tagName === 'P' && sm.classList.contains('hint') && !sm.id);
      if (!isHint) return null;
      var pv = sm.previousElementSibling;
      if (pv && pv.tagName === 'H3') return pv;
      if (pv && pv.matches('label.check')) return pv;
      var par = sm.parentElement, pp = par && par.previousElementSibling;
      if (par && par.id && /box$/.test(par.id) && pp && pp.matches('label.check')) return pp;
      return null;
    }
    function infoify() {
      var list = document.querySelectorAll('.field > small, .abrow > small.abhint, .card > p.hint:not([id]), .card small');
      for (var i = 0; i < list.length; i++) {
        var sm = list[i], lb = infoTarget(sm);
        if (!lb || !String(sm.textContent).trim()) continue;
        if (sm.getAttribute('data-ifi') && [].some.call(lb.querySelectorAll('button.info'), function (x) { return x._sm === sm; })) continue;
        sm.setAttribute('data-ifi', '1'); sm.hidden = true;
        var b = document.createElement('button'); b.type = 'button'; b.className = 'info'; b.setAttribute('aria-label', 'Info'); b._sm = sm;
        lb.appendChild(b);
      }
    }
    document.addEventListener('click', function (ev) {
      var b = ev.target.closest && ev.target.closest('button.info');
      if (b) {
        ev.preventDefault(); ev.stopPropagation();
        var lb = b.parentNode, c = lb.cloneNode(true), x = c.querySelector('button.info'); if (x) x.remove();
        $('#info-h').textContent = String(c.textContent).replace(/\s+/g, ' ').trim();
        $('#info-t').textContent = String(b._sm.textContent).trim();
        dlg.hidden = false; return;
      }
      if (ev.target.id === 'info-x' || ev.target === dlg) close();
    }, true);
    var tm = null;
    new MutationObserver(function () { clearTimeout(tm); tm = setTimeout(infoify, 60); }).observe(document.body, { childList: true, subtree: true });
    infoify();
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
    ins('sprache_' + l);
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
  /* ---- Profilbild und Geburtstagsgruß (optional) ---- */
  function fotoGet() { try { return localStorage.getItem('stundenchecker.foto') || ''; } catch (e) { return ''; } }
  function fotoZeigen() { var b = $('#s-fotobox'); if (!b) return; var f = fotoGet(); b.innerHTML = f ? '<img src="' + f + '" alt="Dein Profilbild" style="width:72px;height:72px;border-radius:50%;object-fit:cover;margin-top:6px"> <button type="button" class="linkbtn" id="foto-weg">Bild entfernen</button>' : ''; }
  function feier(h, t) {
    var conf = '', i, b, k, hue;
    for (i = 0; i < 90; i++) conf += '<i style="left:' + Math.round(Math.random() * 100) + '%;animation-delay:' + (Math.random() * 3).toFixed(2) + 's;animation-duration:' + (2.6 + Math.random() * 2).toFixed(1) + 's;background:hsl(' + Math.round(Math.random() * 360) + ',80%,60%)"></i>';
    for (b = 0; b < 6; b++) {
      hue = Math.round(Math.random() * 360);
      var x = 12 + Math.random() * 76, y = 12 + Math.random() * 38;
      for (k = 0; k < 16; k++) { var an = k / 16 * 6.2832, r = 55 + Math.random() * 55; conf += '<u style="left:' + x.toFixed(0) + '%;top:' + y.toFixed(0) + '%;--dx:' + Math.round(Math.cos(an) * r) + 'px;--dy:' + Math.round(Math.sin(an) * r) + 'px;animation-delay:' + (b * 0.55).toFixed(2) + 's;background:hsl(' + ((hue + k * 7) % 360) + ',90%,60%)"></u>'; }
    }
    $('#bd-conf').innerHTML = conf;
    var f = fotoGet(), fig = ''; try { fig = miaSvg(miaCfg().figur, miaFor(), 'happy'); } catch (e) { }
    $('#bd-mia').innerHTML = (f ? '<img src="' + f + '" alt="" class="bdfoto">' : '') + '<div class="bdtanz">' + fig + '</div>';
    $('#bd-h').textContent = h; $('#bd-t').textContent = t;
    $('#bd-dlg').hidden = false;
  }
  function geburtstagPruefen() {
    var p = data.profil; if (!p || !p.geb || !/^\d{4}-\d{2}-\d{2}$/.test(p.geb)) return;
    var t = todayISO(); if (p.geb.slice(5) !== t.slice(5) || p.gebGruss === t) return;
    p.gebGruss = t; save();
    var vn = (p.vorname || '').trim(), alt = +t.slice(0, 4) - +p.geb.slice(0, 4);
    feier('Alles Gute zum Geburtstag' + (vn ? ', ' + vn : '') + '!', (alt > 0 && alt < 120 ? 'Heute wirst du ' + alt + '. ' : '') + 'Ich wünsche dir einen schönen Tag. Komm gut und gesund durch die Stunden!');
    ins('geburtstag');
  }
  $('#bd-ok').addEventListener('click', function () { $('#bd-dlg').hidden = true; });

  /* ---- Fristen und Ausweise (Code 95, Fahrerkarte, Staplerschein ...) ---- */
  var FR_VOR = [
    ['Für alle', [['Führerschein', 0], ['Erste-Hilfe-Auffrischung', 4], ['Brandschutz-Unterweisung', 0], ['Sicherheitsunterweisung', 0], ['Arbeitsmedizinische Untersuchung', 0]]],
    ['Fahrer', [['Code 95 (Weiterbildung für Berufskraftfahrer)', 5], ['Fahrerkarte', 5], ['ADR-Bescheinigung (Gefahrgut)', 5], ['Ladekran-Berechtigung', 0], ['Ladungssicherung-Schulung', 0]]],
    ['Bau und Maschinen', [['Baggerschein / Maschinenführer', 0], ['Kranschein', 0], ['Staplerschein', 0], ['Hebebühnen-Berechtigung', 0], ['Absturzsicherung-Schulung', 0]]],
    ['Werkstatt und Metall', [['Pickerl-Ermächtigung (§ 57a)', 0], ['Schweißerprüfung', 0], ['Hochvolt-Schulung', 0], ['Kältemittel-Sachkunde', 0]]],
    ['Küche und Gastro', [['Hygieneschulung', 0], ['Allergen-Schulung', 0]]],
    ['Lager und Handel', [['Prüfung des Staplers (jährlich)', 1]]],
    ['Büro', [['Datenschutz-Schulung', 0], ['Brandschutzwart-Ausbildung', 0]]]
  ];
  function fristListe() { if (!data.profil) data.profil = {}; return data.profil.fristen || (data.profil.fristen = []); }
  function fristTage(f) { if (!f.ablauf) return null; var a = E.parseISO(f.ablauf), t = E.parseISO(todayISO()); return Math.round((Date.UTC(a.y, a.m - 1, a.d) - Date.UTC(t.y, t.m - 1, t.d)) / 86400000); }
  function fristenAm(datum) { return (data.profil && data.profil.fristen || []).filter(function (f) { return f.ablauf === datum; }).map(function (f) { return f.name || 'Frist'; }); }
  function festMia(out) {
    festListe().forEach(function (r, i) {
      if (!r.bis || r.bis >= todayISO()) return;
      if (!r.id) r.id = 'f' + Date.now().toString(36) + i;
      var nm = (FEST_TAGE.filter(function (x) { return x[0] === +r.wd; })[0] || [0, ''])[1], art = E.STATUS[r.art] ? E.STATUS[r.art].name : '';
      out.unshift({ k: 'fest_' + r.id, pose: 'eyes', text: art + ', ' + nm + ': Der Zeitraum ist abgelaufen. Gilt der feste Tag weiter, stell den Zeitraum neu ein. Gilt er nicht mehr, lösche ihn.' });
    });
  }
  function fristSpaet(id) { fristListe().forEach(function (f) { if (f.id === id) f.spaet = todayISO(); }); save(); }
  function fristenMia(out) {
    fristListe().forEach(function (f) {
      var n = fristTage(f); if (n === null || f.mia === 'nie' || n > (+f.vorlauf || 30) || f.spaet === todayISO()) return;
      if (f.mia === 'einmal') { if (n <= 0 ? f.m2 : f.m1) return; }
      var txt = (f.name || 'Frist') + ': ' + (n < 0 ? 'ist abgelaufen. Erneuere es so bald wie möglich.' : n === 0 ? 'läuft heute ab. Erneuere es jetzt.' : 'läuft bald ab. Plane die Erneuerung ein.') + ' ' + fmtDate(f.ablauf);
      out.unshift({ k: 'frist_' + f.id, pose: 'eyes', text: txt });
      if (f.mia === 'einmal') { if (n <= 0) f.m2 = true; else f.m1 = true; save(); }
    });
  }
  function fristIcs(f) {
    var d = f.ablauf.replace(/-/g, ''), v = +f.vorlauf || 30, pad = function (x) { return (x < 10 ? '0' : '') + x; }, n = new Date(), st = n.getUTCFullYear() + pad(n.getUTCMonth() + 1) + pad(n.getUTCDate()) + 'T' + pad(n.getUTCHours()) + pad(n.getUTCMinutes()) + '00Z';
    var e = E.parseISO(f.ablauf), nx = new Date(e.y, e.m - 1, e.d + 1), dn = nx.getFullYear() + pad(nx.getMonth() + 1) + pad(nx.getDate());
    var nm = String(f.name || 'Frist').replace(/[\;,]/g, ' ').replace(/[\r\n]+/g, ' ');
    var al = function (trig, t) { return 'BEGIN:VALARM\r\nACTION:DISPLAY\r\nDESCRIPTION:' + t + '\r\nTRIGGER:' + trig + '\r\nEND:VALARM\r\n'; };
    var alarme = [[v * 24 - 9, v + ' Tagen'], [7 * 24 - 9, '7 Tagen'], [24 - 9, '1 Tag']].filter(function (a, i, arr) { return a[0] > 0 && arr.map(function (x) { return x[0]; }).indexOf(a[0]) === i && (i === 0 || a[0] < arr[0][0]); });
    var s = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Stunden-Checker//DE\r\nBEGIN:VEVENT\r\nUID:' + f.id + '@stunden-checker\r\nDTSTAMP:' + st + '\r\nDTSTART;VALUE=DATE:' + d + '\r\nDTEND;VALUE=DATE:' + dn + '\r\nSUMMARY:' + nm + ' läuft ab\r\nDESCRIPTION:Erinnerung vom Stunden-Checker\r\n';
    alarme.forEach(function (a) { s += al('-PT' + a[0] + 'H', nm + ' läuft in ' + a[1] + ' ab'); });
    s += al('PT9H', nm + ' läuft heute ab') + 'END:VEVENT\r\nEND:VCALENDAR\r\n';
    return s;
  }
  function renderFristen() {
    var el = $('#fr-list'); if (!el) return;
    var opt = function (arr, cur) { return arr.map(function (x) { return '<option value="' + x[0] + '"' + (String(cur) === String(x[0]) ? ' selected' : '') + '>' + x[1] + '</option>'; }).join(''); };
    var vl = [[7, '7 Tage vorher'], [14, '14 Tage vorher'], [30, '30 Tage vorher'], [60, '60 Tage vorher'], [90, '90 Tage vorher']];
    var ml = [['taeglich', 'Jeden Tag, bis es erledigt ist'], ['einmal', 'Einmal vorher und am Ablauftag'], ['nie', 'Nur im Kalender, ohne Meldung']];
    el.innerHTML = fristListe().map(function (f) {
      var n = fristTage(f), v = +f.vorlauf || 30, st = n === null ? '' : n < 0 ? ['bad', 'Abgelaufen'] : n === 0 ? ['bad', 'Heute fällig'] : n <= v ? ['warn', 'Bald fällig'] : ['ok', 'Gültig'];
      return '<div class="frrow" data-id="' + esc(f.id) + '"><div class="frtop"><input type="text" data-f="name" maxlength="60" value="' + esc(f.name || '') + '" aria-label="Name der Frist"><button type="button" class="btn" data-act="del" aria-label="Entfernen">×</button></div>' +
        '<div class="field"><label>Läuft ab am</label><input type="date" data-f="ablauf" value="' + esc(f.ablauf || '') + '"></div>' +
        (st ? '<p class="frstat fr-' + st[0] + '">' + st[1] + '</p>' : '') +
        '<div class="field"><label>Erinnern ab</label><select data-f="vorlauf">' + opt(vl, v) + '</select></div>' +
        '<div class="field"><label>Meldung in der App</label><select data-f="mia">' + opt(ml, f.mia || 'taeglich') + '</select></div>' +
        '<label class="check"><input type="checkbox" data-f="kal"' + (f.kal ? ' checked' : '') + '><span>In meinem Handy-Kalender eingetragen</span></label>' +
        '<div class="btns"><button type="button" class="btn" data-act="ics"' + (f.ablauf ? '' : ' disabled') + '>Kalenderdatei laden</button><button type="button" class="btn primary" data-act="neu">Erneuert / bestanden</button></div></div>';
    }).join('');
    var vo = $('#fr-vorl'); if (vo && !vo.dataset.f) { vo.dataset.f = 1; vo.innerHTML = FR_VOR.map(function (g) { return '<p class="frgrp">' + g[0] + '</p><div class="frchips">' + g[1].map(function (x) { return '<button type="button" class="btn" data-n="' + esc(x[0]) + '" data-y="' + x[1] + '">' + x[0] + '</button>'; }).join('') + '</div>'; }).join(''); }
  }
  function fristNeu(name, jahre) { fristListe().push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), name: name || 'Neue Frist', laufzeit: jahre || 0, ablauf: '', vorlauf: 30, mia: 'taeglich', kal: false }); save(); renderFristen(); }
  (function () {
    var el = $('#fr-list'); if (!el) return;
    function row(t) { var r = t.closest('.frrow'); if (!r) return null; var f = fristListe().filter(function (x) { return x.id === r.dataset.id; })[0]; return f ? { f: f, r: r } : null; }
    function fertig(f, neu) { f.ablauf = neu; f.kal = false; delete f.m1; delete f.m2; delete f.spaet; save(); renderFristen(); feier('Geschafft!', (f.name || 'Frist') + ' ist wieder gültig bis ' + fmtDate(neu)); ins('frist_erneuert'); }
    el.addEventListener('change', function (ev) {
      var t = ev.target, o = row(t); if (!o || !t.dataset.f) return; var k = t.dataset.f;
      if (k === 'ablauf') { var alt = o.f.ablauf; if (t.value && alt && t.value > alt) { fertig(o.f, t.value); return; } o.f.ablauf = t.value; o.f.kal = false; delete o.f.m1; delete o.f.m2; delete o.f.spaet; }
      else if (k === 'kal') o.f.kal = t.checked;
      else if (k === 'vorlauf') { o.f.vorlauf = +t.value; o.f.kal = false; delete o.f.m1; delete o.f.m2; }
      else o.f[k] = t.value;
      save(); renderFristen();
    });
    el.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-act]'); if (!b) return; var o = row(b); if (!o) return;
      if (b.dataset.act === 'del') { var l = fristListe(); l.splice(l.indexOf(o.f), 1); save(); renderFristen(); }
      else if (b.dataset.act === 'ics') {
        try { var bl = new Blob([fristIcs(o.f)], { type: 'text/calendar' }), u = URL.createObjectURL(bl), a = document.createElement('a'); a.href = u; a.download = 'frist.ics'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(u); }, 4000); toast('Kalenderdatei geladen. Öffne sie und tippe auf Hinzufügen.'); } catch (e) { toast('Das hat nicht geklappt.'); }
      } else if (b.dataset.act === 'neu') {
        if (+o.f.laufzeit > 0) { var t0 = todayISO(), bs = o.f.ablauf && o.f.ablauf >= t0 ? o.f.ablauf : t0, p = E.parseISO(bs), d = new Date(p.y + (+o.f.laufzeit), p.m - 1, p.d); fertig(o.f, E.iso(d.getFullYear(), d.getMonth() + 1, d.getDate())); }
        else {
          var ff = o.f; $('#lz-h').textContent = 'Wie lange ist es jetzt gültig?';
          $('#lz-body').innerHTML = miaKopf() + '<p>Schau auf deinem neuen Ausweis oder deiner Bestätigung nach, bis wann sie gilt. Dieses Datum trage ich dir ein.</p><div class="field"><label for="fr-neu-d">Neues Ablaufdatum</label><input type="date" id="fr-neu-d"></div>';
          $('#lz-btns').innerHTML = '<button type="button" class="btn primary" id="fr-neu-ok">Speichern</button><button type="button" class="btn" id="fr-neu-x">Abbrechen</button>';
          $('#lz-dlg').hidden = false;
          $('#fr-neu-x').onclick = function () { $('#lz-dlg').hidden = true; };
          $('#fr-neu-ok').onclick = function () { var v = $('#fr-neu-d').value; if (!v || v <= todayISO()) { toast('Bitte gib ein Datum in der Zukunft ein.'); return; } $('#lz-dlg').hidden = true; fertig(ff, v); };
        }
      }
    });
    $('#fr-add').addEventListener('click', function () { var v = $('#fr-vorl'); v.hidden = !v.hidden; });
    $('#fr-eigen').addEventListener('click', function () { fristNeu('Neue Frist', 0); $('#fr-vorl').hidden = true; });
    $('#fr-vorl').addEventListener('click', function (ev) { var b = ev.target.closest('[data-n]'); if (!b) return; fristNeu(b.dataset.n, +b.dataset.y); $('#fr-vorl').hidden = true; });
    renderFristen();
  })();
  /* ---- Berichte als PDF (Tag, Woche, Monat) ---- */
  (function () {
    var card = $('#rb-card'); if (!card) return;
    function hh(min) { return fh(min / 60) + ' h'; }
    function bName() { var p = data.profil || {}; return ($('#rb-name').value || '').trim() || ((p.vorname || '') + ' ' + (p.nachname || '')).trim() || p.berichtName || ''; }
    function addDays(s, n) { var p = E.parseISO(s), d = new Date(p.y, p.m - 1, p.d + n); return E.iso(d.getFullYear(), d.getMonth() + 1, d.getDate()); }
    function tageVon(von, bis) {
      var res = [], cache = {};
      for (var s = von; s <= bis; s = addDays(s, 1)) {
        var p = E.parseISO(s), key = p.y + '-' + p.m;
        if (!cache[key]) cache[key] = E.calcMonth(data, p.y, p.m, todayISO());
        var r = cache[key].tage.filter(function (x) { return x.datum === s; })[0]; if (r) res.push(r);
      }
      return res;
    }
    function art(r) { var d = data.days[r.datum] || {}; return r.leer ? (r.typ !== 'werktag' ? (r.feiertag || (r.typ === 'sonntag' ? 'Sonntag' : r.typ === 'samstag' ? 'Samstag' : 'frei')) : '') : (r.status === 'arbeit' ? (r.swMin ? (E.istBau(wAt(r.datum)) ? 'Schlechtwetter' : 'Ausfall') : 'Arbeit') : E.STATUS[r.status].name) + (r.feiertag ? ' (' + r.feiertag + ')' : ''); }
    function kopf(titel, zeitraum) {
      var nm = bName(), pr = data.profil || {};
      return [{ t: 'h1', text: titel }, { t: 'kv', rows: [['Name', nm || '____________________']].concat(pr.firma ? [['Firma', pr.firma]] : [], [[titel === 'Tagesbericht' ? 'Datum' : 'Zeitraum', zeitraum], ['Erstellt am', fmtDate(todayISO())]]) }];
    }
    function tabelleTage(tage) {
      var sum = 0, rows = tage.map(function (r) {
        var d = data.days[r.datum] || {}; sum += r.nettoMin || 0;
        var nm = []; (d.kunden || []).forEach(function (k) { if (k.name) nm.push(k.name); });
        return [WD[E.weekday(r.datum)] + ' ' + fmtDate(r.datum).replace(/\.\d{4}$/, '.'), art(r), d.von && d.bis ? d.von + '–' + d.bis : '', r.pausenMin ? hm(r.pausenMin) : '', r.nettoMin ? hh(r.nettoMin) : '', nm.join(', ')];
      }).filter(function (c) { return c[1] || c[2] || c[4]; });
      var mitK = rows.some(function (c) { return c[5]; });
      rows.push({ cells: ['Summe', '', '', '', hh(sum), ''], bold: true });
      if (!mitK) rows = rows.map(function (r) { var c = (r.cells || r).slice(0, 5); return r.cells ? { cells: c, bold: r.bold } : c; });
      return { t: 'table', cols: mitK ? [{ w: 70 }, { w: 85 }, { w: 75 }, { w: 45 }, { w: 55, al: 'r' }, { w: 120 }] : [{ w: 90 }, { w: 130 }, { w: 100 }, { w: 60 }, { w: 70, al: 'r' }], head: mitK ? ['Tag', 'Art', 'Zeit', 'Pause', 'Stunden', 'Kunden'] : ['Tag', 'Art', 'Zeit', 'Pause', 'Stunden'], rows: rows };
    }
    function kw(s) { var p = E.parseISO(s), d = new Date(Date.UTC(p.y, p.m - 1, p.d)), n = d.getUTCDay() || 7; d.setUTCDate(d.getUTCDate() + 4 - n); var y0 = new Date(Date.UTC(d.getUTCFullYear(), 0, 1)); return Math.ceil(((d - y0) / 86400000 + 1) / 7); }
    function zeitblatt(von, bis) {
      var nm = bName(), rows = [], sN = 0, sU = 0, sU50 = 0, sU100 = 0, sD = 0;
      tageVon(von, bis).forEach(function (r) {
        var d = data.days[r.datum] || {}; if (r.leer && !(d.von || d.bis)) return;
        var w = wAt(r.datum), soll = Math.round(E.sollFuer(w.ueberstunden, E.weekday(r.datum)) * 60), net = r.nettoMin || 0;
        var frei = r.typ !== 'werktag', nor = frei ? 0 : Math.min(net, soll), ue = net - nor; if (r.status !== 'arbeit') { nor = 0; ue = 0; }
        sN += nor; sU += ue; if (frei) sU100 += ue; else sU50 += ue; sD += r.diaetenStd || 0;
        var ps = (d.pausen || []).filter(function (x) { return x.von && x.bis; }).map(function (x) { return x.von + '-' + x.bis; }).join(', ');
        var tour = (d.kunden || []).map(function (k) { return k.name; }).filter(Boolean).join(', ');
        var fz = fahrzeugeVon(d).filter(function (f) { return f.kfz; }); if (!fz.length) fz = [{}];
        fz.forEach(function (f, i) {
          var first = i === 0, wk = WD[E.weekday(r.datum)];
          rows.push([first ? '' + kw(r.datum) : '', first ? wk : '', first ? fmtDate(r.datum).replace(/\.(\d{4})$/, '.' + String(r.datum).slice(2, 4)) : '', first ? (d.von || (r.status !== 'arbeit' ? art(r) : '')) : '', first ? (d.bis || '') : '', f.kmVon == null ? '' : f.kmVon, f.kmBis == null ? '' : f.kmBis, f.kfz || '', first ? tour : '', first ? ps : '', first && nor ? fh(nor / 60) : '', first && ue ? fh(ue / 60) : '', first && r.diaetenStd ? fh(r.diaetenStd) : '']);
        });
      });
      var fi = (data.profil && data.profil.firma) || '', kopfz = [{ t: 'h1', text: 'Zeitaufzeichnung Fahrer/in' }].concat(fi ? [{ t: 'p', text: fi, size: 13, bold: true }] : [], [{ t: 'kv', rows: [['Name', nm || ' '], ['Zeitraum', fmtDate(von) + ' bis ' + fmtDate(bis)]] }]);
      rows.push({ cells: ['', '', 'Summe', '', '', '', '', '', '', '', fh(sN / 60), fh(sU / 60), fh(sD)], bold: true });
      rows.push(['', '', 'davon Üst. 50 %', '', '', '', '', '', '', '', '', fh(sU50 / 60), '']);
      rows.push(['', '', 'davon Üst. 100 %', '', '', '', '', '', '', '', '', fh(sU100 / 60), '']);
      kopfz.push({ t: 'table', fs: 8, cols: [{ w: 22 }, { w: 24 }, { w: 52 }, { w: 40 }, { w: 36 }, { w: 48, al: 'r' }, { w: 48, al: 'r' }, { w: 56 }, { w: 60 }, { w: 70 }, { w: 40, al: 'r' }, { w: 36, al: 'r' }, { w: 40, al: 'r' }], head: ['KW', 'Tag', 'Datum', 'Beginn', 'Ende', 'km Beginn', 'km Ende', 'KFZ', 'Tour', 'Ruhepause', 'Normal Std.', 'Über-Std.', 'Tagesgeld Std.'], rows: rows });
      kopfz.push({ t: 'sig', l: 'Unterschrift Fahrer/in', r: ' ', img: sigImg() });
      return kopfz;
    }

    /* Unterschrift mit dem Finger: bleibt nur auf diesem Gerät (nicht in der Cloud) */
    var sg = $('#rb-sig'), sx = sg.getContext('2d'), sDraw = false, sHas = false;
    function sgWhite() { sx.fillStyle = '#fff'; sx.fillRect(0, 0, sg.width, sg.height); sx.strokeStyle = '#111'; sx.lineWidth = 3; sx.lineCap = 'round'; sx.lineJoin = 'round'; }
    sgWhite();
    try { var sv0 = localStorage.getItem('stundenchecker.sig'); if (sv0) { var im0 = new Image(); im0.onload = function () { sx.drawImage(im0, 0, 0); sHas = true; }; im0.src = sv0; } } catch (e) { }
    function sgPos(ev) { var r = sg.getBoundingClientRect(); return [(ev.clientX - r.left) * sg.width / r.width, (ev.clientY - r.top) * sg.height / r.height]; }
    sg.addEventListener('pointerdown', function (ev) { sDraw = true; sHas = true; var q = sgPos(ev); sx.beginPath(); sx.moveTo(q[0], q[1]); sx.lineTo(q[0] + 0.1, q[1]); sx.stroke(); try { sg.setPointerCapture(ev.pointerId); } catch (e) { } ev.preventDefault(); });
    sg.addEventListener('pointermove', function (ev) { if (!sDraw) return; var q = sgPos(ev); sx.lineTo(q[0], q[1]); sx.stroke(); ev.preventDefault(); });
    function sgEnd() { if (!sDraw) return; sDraw = false; try { localStorage.setItem('stundenchecker.sig', sg.toDataURL('image/png')); } catch (e) { } }
    sg.addEventListener('pointerup', sgEnd); sg.addEventListener('pointercancel', sgEnd);
    var sfi = $('#rb-sigfile'); if (sfi) sfi.addEventListener('change', function () { // Bild der Unterschrift (zum Beispiel am Laptop)
      var f = this.files && this.files[0]; if (!f) return; var u = URL.createObjectURL(f), im = new Image();
      im.onload = function () { sgWhite(); sx.fillStyle = '#fff'; sx.fillRect(0, 0, sg.width, sg.height); var k = Math.min(sg.width / im.width, sg.height / im.height); sx.drawImage(im, (sg.width - im.width * k) / 2, (sg.height - im.height * k) / 2, im.width * k, im.height * k); sHas = true; try { localStorage.setItem('stundenchecker.sig', sg.toDataURL('image/png')); } catch (e) { } URL.revokeObjectURL(u); sfi.value = ''; toast('Unterschrift übernommen.'); };
      im.onerror = function () { toast('Das Bild konnte nicht gelesen werden.'); URL.revokeObjectURL(u); };
      im.src = u;
    });
    $('#rb-sigclr').addEventListener('click', function () { sgWhite(); sHas = false; try { localStorage.removeItem('stundenchecker.sig'); } catch (e) { } });
    var sigOv; function sigImg() { if (sigOv !== undefined) return sigOv; if (!sHas || !$('#rb-sigon').checked) return null; var id = sx.getImageData(0, 0, sg.width, sg.height), g = new Uint8Array(sg.width * sg.height); for (var i = 0; i < g.length; i++) g[i] = id.data[i * 4]; return { w: sg.width, h: sg.height, data: g }; }
    function bauen() {
      var typ = $('#rb-art').value, ds = $('#rb-datum').value || todayISO(), p = E.parseISO(ds), b, name;
      if (typ === 'tag') {
        var r = tageVon(ds, ds)[0], d = data.days[ds] || {}; name = 'Tagesbericht-' + ds;
        var fz = fahrzeugeVon(d).filter(function (f) { return f.kfz; }), nm = bName(), fi = (data.profil && data.profil.firma) || '';
        function zs(f, k) { return fz.map(function (x) { return x[k] == null || x[k] === '' ? '' : (fz.length > 1 ? x.kfz + ': ' : '') + x[k]; }).filter(Boolean).join(', '); }
        var kmA = zs(fz, 'kmVon'), kmE = zs(fz, 'kmBis');
        b = [{ t: 'h1', text: 'Tagesbericht' }].concat(fi ? [{ t: 'p', text: fi, size: 12, bold: true }] : []);
        b.push({ t: 'table', fs: 12, minRow: 26, cols: [{ w: 3 }, { w: 2 }, { w: 1.4 }, { w: 1.4 }], head: ['Name', 'KFZ-Kennzeichen', 'Type', 'Datum'], rows: [[nm, fz.map(function (f) { return f.kfz; }).join(', '), '', fmtDate(ds)]] });
        b.push({ t: 'table', fs: 12, minRow: 26, cols: [{ w: 1.4 }, { w: 1.4 }, { w: 1 }, { w: 1 }, { w: 1 }], head: ['Anfangs-km-Stand', 'End-km-Stand', 'Diesel l', 'AdBlue l', 'Motoröl l'], rows: [[kmA, kmE, zs(fz, 'diesel'), zs(fz, 'adblue'), zs(fz, 'oel')]] });
        var zl = E.tagesZeilen(d);
        var tr = zl.map(function (z) { return [z.von, z.bis, z.k, z.t]; }); while (tr.length < 8) tr.push(['', '', '', '']);
        b.push({ t: 'table', fs: 12, minRow: 26, fill: true, reserve: 112, cols: [{ w: 1 }, { w: 1 }, { w: 4 }, { w: 4 }], head: ['Uhrzeit von', 'Uhrzeit bis', 'Kunde, Baustelle', 'Tätigkeit'], rows: tr });
        b.push({ t: 'table', fs: 12, minRow: 26, cols: [{ w: 2 }, { w: 4 }, { w: 4 }], head: ['Gesamtstd.', 'Unterschrift Fahrer', 'Unterschrift Büro'], rows: [{ cells: [r.nettoMin ? fh(r.nettoMin / 60) : '', ' ', ' '], minH: 64, img: sigImg(), col: 1 }] });
        return { bytes: window.StundenPdf.build(b, { landscape: true }), name: name + '.pdf', typ: typ };
      } else if (typ === 'woche') {
        var wd = E.weekday(ds), mo = addDays(ds, -((wd + 6) % 7)), so = addDays(mo, 6); name = 'Wochenbericht-' + mo;
        b = kopf('Wochenbericht', fmtDate(mo) + ' bis ' + fmtDate(so)); b.push(tabelleTage(tageVon(mo, so)));
        b.push({ t: 'sig', l: 'Unterschrift Fahrer/in', r: 'Unterschrift Firma', img: sigImg() });
      } else if (typ === 'halb') {
        var h1 = p.d <= 15, v2 = E.iso(p.y, p.m, h1 ? 1 : 16), b2 = E.iso(p.y, p.m, h1 ? 15 : new Date(p.y, p.m, 0).getDate()); name = 'Halbmonatsbericht-' + v2;
        return { bytes: window.StundenPdf.build(zeitblatt(v2, b2), { landscape: true }), name: name + '.pdf', typ: typ };
      } else {
        var von = E.iso(p.y, p.m, 1), bis = E.iso(p.y, p.m, new Date(p.y, p.m, 0).getDate()), cm = E.calcMonth(data, p.y, p.m, todayISO()), s = cm.summe; name = 'Monatsbericht-' + p.y + '-' + pad(p.m);
        b = kopf('Monatsbericht', MON[p.m - 1] + ' ' + p.y);
        var kv = [['Gearbeitet', fh(s.istStd) + ' h']]; if (s.lohnStd !== s.istStd) kv.push(['Lohnstunden', fh(s.lohnStd) + ' h']);
        if (s.arbeitstage) kv.push(['Arbeitstage', '' + s.arbeitstage]); if (s.urlaub) kv.push(['Urlaubstage', '' + s.urlaub]); if (s.krank) kv.push(['Krankenstand', s.krank + ' Tage']);
        b.push({ t: 'kv', rows: kv }); b.push(tabelleTage(cm.tage)); b.push({ t: 'sig', l: 'Unterschrift Fahrer/in', r: 'Unterschrift Firma', img: sigImg() });
      }
      return { bytes: window.StundenPdf.build(b), name: name + '.pdf', typ: typ };
    }
    function speichern(erg) {
      var bl = new Blob([erg.bytes], { type: 'application/pdf' }), ur = URL.createObjectURL(bl), an = document.createElement('a');
      an.href = ur; an.download = erg.name; document.body.appendChild(an); an.click(); document.body.removeChild(an); setTimeout(function () { URL.revokeObjectURL(ur); }, 4000);
      toast('Gespeichert: ' + erg.name + ' (Ordner „Downloads“).');
    }
    function merken() { var p = data.profil || (data.profil = {}); p.berichtName = $('#rb-name').value.trim(); p.berichtRhythmus = $('#rb-rhythmus').value; p.berichtMail = $('#rb-mail').value.trim(); p.berichtArt = $('#rb-art').value; try { save(); } catch (e) { } }
    function fuellen() { var pr = data.profil || {}, hat = !!((pr.vorname || '') + (pr.nachname || '')).trim(); if (!$('#rb-name').value) $('#rb-name').value = pr.berichtName || ((pr.vorname || '') + ' ' + (pr.nachname || '')).trim(); if (!$('#rb-mail').value) $('#rb-mail').value = pr.berichtMail || ''; if (pr.berichtArt) $('#rb-art').value = pr.berichtArt; $('#rb-rhythmus').value = pr.berichtRhythmus || 'nie'; $('#rb-sigon').checked = pr.sigAn === true; $('#rb-sigwrap').hidden = !$('#rb-sigon').checked; }
    fuellen();
    var vorgabe = null; card.addEventListener('toggle', function () { if (!card.open) return; fuellen(); $('#rb-datum').value = vorgabe || (ui.edDate && /^\d{4}-\d{2}-\d{2}$/.test(ui.edDate) ? ui.edDate : todayISO()); vorgabe = null; });
    $('#rb-sigon').addEventListener('change', function () { $('#rb-sigwrap').hidden = !this.checked; (data.profil || (data.profil = {})).sigAn = this.checked; merken(); });
    $('#rb-name').addEventListener('change', merken); $('#rb-mail').addEventListener('change', merken);
    $('#rb-rhythmus').addEventListener('change', function () { merken(); var v = this.value; if (v !== 'nie') $('#rb-art').value = v; });
    $('#rb-art').addEventListener('change', function () { $('#rb-datum').value = $('#rb-datum').value || todayISO(); });
    /* Nach dem Speichern eines Tages: ist heute der Tag für den Bericht? */
    function arbeitstag(s) { var p = E.parseISO(s), r = tageVon(s, s)[0]; return !!r && r.typ === 'werktag' && !r.feiertag; }
    function periodenEnde(rh, s) { var p = E.parseISO(s), dim = E.daysInMonth(p.y, p.m); if (rh === 'woche') { var wd = E.weekday(s); return addDays(s, wd === 0 ? 0 : 7 - wd); } if (rh === 'monat') return E.iso(p.y, p.m, dim); if (rh === 'halb') return E.iso(p.y, p.m, p.d <= 15 ? 15 : dim); return s; }
    function bFrage(s) {
      var pr = data.profil || {}, rh = pr.berichtRhythmus || 'nie'; if (rh === 'nie') return;
      var st = data.days[s]; if (!st || st.status !== 'arbeit' || !st.von || !st.bis) return;
      var ende = periodenEnde(rh, s), fertig = true;
      for (var d = addDays(s, 1); d <= ende; d = addDays(d, 1)) { if (arbeitstag(d)) { fertig = false; break; } }
      if (!fertig || pr.berichtGefragt === rh + ende) return;
      pr.berichtGefragt = rh + ende; save();
      var nm = (pr.vorname || '').trim(), txt = { tag: 'Tagesbericht', woche: 'Wochenbericht', halb: 'Halbmonatsbericht', monat: 'Monatsbericht' }[rh];
      $('#rb-dh').textContent = (nm ? nm + ', s' : 'S') + 'oll ich den ' + txt + ' gleich fertig machen?';
      $('#rb-dbody').innerHTML = miaKopf() + '<p>Heute ist der Tag dafür. Ich bereite ihn vor, du musst nur noch auf „PDF erstellen und senden“ tippen.</p>';
      $('#rb-dbtns').innerHTML = '<button type="button" class="btn primary" id="rb-ja">Ja, bitte</button><button type="button" class="btn" id="rb-spaeter">Später</button>';
      $('#rb-dlg').hidden = false;
      $('#rb-spaeter').onclick = function () { $('#rb-dlg').hidden = true; };
      $('#rb-ja').onclick = function () { $('#rb-dlg').hidden = true; show('erfassen', true); vorgabe = s; card.open = false; card.open = true; setTimeout(function () { $('#rb-art').value = rh; $('#rb-datum').value = s; }, 0); setTimeout(function () { card.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 150); };
    }
    window.berichtFrage = bFrage;
    function frageName(weiter) {
      if (bName()) return weiter();
      $('#rb-dh').textContent = 'Wie heißt du?';
      $('#rb-dbody').innerHTML = miaKopf() + '<p>Auf dem Bericht fehlt dein Name. Ohne Namen kann ihn niemand dir zuordnen.</p><div class="field"><label for="rb-dname">Vor- und Nachname</label><input type="text" id="rb-dname" maxlength="80" autocomplete="name"></div>';
      $('#rb-dbtns').innerHTML = '<button type="button" class="btn primary" id="rb-dok">Weiter</button><button type="button" class="btn" id="rb-dohne">Ohne Namen weiter</button><button type="button" class="btn" id="rb-dx">Abbrechen</button>';
      $('#rb-dlg').hidden = false; $('#rb-dx').onclick = zu;
      $('#rb-dok').onclick = function () { var v = $('#rb-dname').value.trim(); if (!v) { toast('Bitte gib deinen Namen ein.'); return; } var pr0 = data.profil || (data.profil = {}); if (!(pr0.vorname || pr0.nachname)) { var ix = v.lastIndexOf(' '); pr0.vorname = ix > 0 ? v.slice(0, ix) : v; pr0.nachname = ix > 0 ? v.slice(ix + 1) : ''; } $('#rb-name').value = v; merken(); weiter(); };
      $('#rb-dohne').onclick = function () { toast('Schreibe deinen Namen auf dem Bericht von Hand dazu.'); weiter(); };
    }
    $('#rb-dl').addEventListener('click', function () { merken(); frageName(function () { zu(); try { speichern(bauen()); ins('bericht_' + $('#rb-art').value); } catch (e) { toast('Der Bericht konnte nicht erstellt werden.'); } }); });
    $('#rb-share').addEventListener('click', function () {
      merken(); var pr = data.profil || (data.profil = {});
      frageName(function () {
        if (pr.sigAn === true && sHas) return zeigeBericht(); // Unterschrift ist gespeichert: gleich anzeigen
        frageUnterschrift();
      });
    });
    function zu() { $('#rb-dlg').hidden = true; sigOv = undefined; }
    function kopieren(c) { var i = c.getContext('2d').getImageData(0, 0, c.width, c.height), g = new Uint8Array(c.width * c.height); for (var k = 0; k < g.length; k++) g[k] = i.data[k * 4]; return { w: c.width, h: c.height, data: g }; }
    /* Schritt 1: unterschreiben (nur wenn nicht schon automatisch gespeichert) */
    function frageUnterschrift() {
      var pr = data.profil, erstes = pr.sigAn !== true && pr.sigAn !== false;
      $('#rb-dh').textContent = 'Bitte unterschreiben';
      $('#rb-dbody').innerHTML = miaKopf() + '<canvas id="rb-dsig" width="600" height="240" style="width:100%;height:auto;background:#fff;border:1px solid var(--line);border-radius:10px;touch-action:none"></canvas>' +
        '<p class="hint">Unterschreibe mit dem Finger oder der Maus. Wenn du lieber auf Papier unterschreibst, lass das Feld leer.</p>' +
        (erstes ? '<label class="check"><input type="checkbox" id="rb-dauto"> Diese Unterschrift merken und künftig automatisch einsetzen</label>' : '');
      $('#rb-dbtns').innerHTML = '<button type="button" class="btn" id="rb-dclr">Löschen</button><button type="button" class="btn primary" id="rb-dweiter">Weiter</button><button type="button" class="btn" id="rb-dx">Abbrechen</button>';
      $('#rb-dlg').hidden = false;
      var c = $('#rb-dsig'), x = c.getContext('2d'), dr = false, has = false;
      function weiss() { x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.strokeStyle = '#111'; x.lineWidth = 3; x.lineCap = 'round'; x.lineJoin = 'round'; }
      weiss();
      function pos(ev) { var r = c.getBoundingClientRect(); return [(ev.clientX - r.left) * c.width / r.width, (ev.clientY - r.top) * c.height / r.height]; }
      c.addEventListener('pointerdown', function (ev) { dr = true; has = true; var q = pos(ev); x.beginPath(); x.moveTo(q[0], q[1]); x.lineTo(q[0] + 0.1, q[1]); x.stroke(); try { c.setPointerCapture(ev.pointerId); } catch (e) { } ev.preventDefault(); });
      c.addEventListener('pointermove', function (ev) { if (!dr) return; var q = pos(ev); x.lineTo(q[0], q[1]); x.stroke(); ev.preventDefault(); });
      c.addEventListener('pointerup', function () { dr = false; }); c.addEventListener('pointercancel', function () { dr = false; });
      $('#rb-dclr').onclick = function () { weiss(); has = false; };
      $('#rb-dx').onclick = zu;
      $('#rb-dweiter').onclick = function () {
        var auto = !!($('#rb-dauto') && $('#rb-dauto').checked);
        sigOv = has ? kopieren(c) : null;
        if (erstes) {
          pr.sigAn = auto && has;
          if (auto && has) { sgWhite(); sx.drawImage(c, 0, 0, sg.width, sg.height); sHas = true; try { localStorage.setItem('stundenchecker.sig', sg.toDataURL('image/png')); } catch (e) { } $('#rb-sigon').checked = true; $('#rb-sigwrap').hidden = false; }
          else if (!has) pr.sigAn = undefined; // ohne Unterschrift nichts festlegen, beim nächsten Mal wieder fragen
          try { save(); } catch (e) { }
        }
        zeigeBericht(true);
      };
    }
    /* Schritt 2: Bericht anzeigen, ein Knopf „Senden“ */
    function zeigeBericht(mitOv) {
      var erg; try { erg = bauen(); } catch (e) { zu(); toast('Der Bericht konnte nicht erstellt werden.'); return; }
      sigOv = undefined; ins('bericht_' + erg.typ);
      var flx = null; try { flx = new File([erg.bytes], erg.name, { type: 'application/pdf' }); } catch (e) { }
      var kannTeilen = !!(flx && navigator.share && (!navigator.canShare || navigator.canShare({ files: [flx] })));
      $('#rb-dh').textContent = 'Dein Bericht';
      $('#rb-dbody').innerHTML = '<div id="rb-vor" style="max-height:52vh;overflow:auto;border:1px solid var(--line);border-radius:10px;background:#fff"><p class="hint" style="padding:12px">Bericht wird angezeigt …</p></div>';
      $('#rb-dbtns').innerHTML = '<button type="button" class="btn primary" id="rb-send">' + (kannTeilen ? 'Senden' : 'Speichern') + '</button><button type="button" class="btn" id="rb-dx">Schließen</button>';
      $('#rb-dlg').hidden = false;
      $('#rb-dx').onclick = zu;
      $('#rb-send').onclick = function () {
        if (kannTeilen) {
          var p; try { p = navigator.share({ files: [flx], title: 'Stundenbericht', text: 'Hallo, anbei mein Bericht.' }); } catch (e) { p = null; }
          if (p && p.then) { p.then(function () { zu(); }, function (er) { if (er && er.name === 'AbortError') return; ins('bericht_share_fehler'); speichern(erg); }); return; }
        }
        ins('bericht_share_fehlt'); speichern(erg);
      };
      var vb = $('#rb-vor').clientWidth || 400;
      try { window.StundenLz.zeigePdf(erg.bytes, $('#rb-vor'), vb).catch(function () { $('#rb-vor').innerHTML = '<p class="hint" style="padding:12px"><b>' + esc(erg.name) + '</b></p>'; }); } catch (e) { }
    }
  })();
  /* ---- Lohnzettel automatisch lesen (nur mit Zustimmung, nur auf dem Gerät) ---- */
  var lzUi = { step: '', res: null, buf: null, pwOk: null };
  function lzProfil() { if (!data.profil) data.profil = {}; return data.profil; }
  function miaKopf() { try { return '<div class="lzfig">' + miaSvg(miaCfg().figur, miaFor(), '') + '</div>'; } catch (e) { return ''; } }
  function lzOpen(step) { lzUi.step = step || (lzProfil().lzLesen === true ? 'datei' : 'erlaubnis'); lzRender(); $('#lz-dlg').hidden = false; }
  function lzClose() { $('#lz-dlg').hidden = true; lzUi.buf = null; lzUi.pwOk = null; lzUi.pwMem = null; lzUi.queue = []; }
  function lzBtn(txt, id, cls) { return '<button type="button" class="btn' + (cls ? ' ' + cls : '') + '" id="' + id + '">' + txt + '</button>'; }
  function lzRender() {
    var h = $('#lz-h'), b = $('#lz-body'), bt = $('#lz-btns'), s = lzUi.step, svg = '';
    try { svg = '<div class="lzfig">' + miaSvg(miaCfg().figur, miaFor(), '') + '</div>'; } catch (e) { }
    if (s === 'erlaubnis') {
      h.textContent = 'Darf ich dir das Abtippen abnehmen?';
      b.innerHTML = svg + '<p>Wenn du magst, lese ich künftig deinen Lohnzettel für dich ab. Dann musst du die Stunden nicht mehr von Hand eintragen, und ich vergleiche sie gleich mit deiner Aufzeichnung.</p>' +
        '<p>Das passiert nur hier auf deinem Handy, es wird nichts hochgeladen. Beim Abtippen der Stunden lese ich keine persönlichen Daten. Nur wenn du deine Einstellungen mit dem Lohnzettel einrichtest oder prüfst, lese ich auch Name, Firma, Geburtsdatum und Eintrittsdatum, und du bestätigst jedes einzeln. Du kannst es jederzeit in den Einstellungen ausschalten.</p>' +
        '<label class="check"><input type="checkbox" id="lz-ok"> Ja, der Stunden-Checker darf meinen Lohnzettel auf diesem Handy lesen.</label>';
      bt.innerHTML = lzBtn('Weiter', 'lz-weiter', 'primary') + lzBtn('Nein danke', 'lz-nein'); $('#lz-weiter').disabled = true;
    } else if (s === 'datei') {
      h.textContent = 'Zeig mir deinen Lohnzettel';
      b.innerHTML = svg + '<p>Such jetzt die PDF-Datei deines Lohnzettels aus. Am besten die Datei, die du von deiner Firma bekommen hast. Bitte nicht ausdrucken oder neu speichern, sonst kann ich sie nicht lesen.</p><p class="hint">Wenn die Datei ein Kennwort hat, frage ich dich danach.</p><p class="hint">Ein Foto oder ein Scan kann ich nicht lesen, auch wenn du es als PDF speicherst. Frag in deiner Firma nach der PDF-Datei.</p>' +
        '<input type="file" id="lz-file" accept="application/pdf,.pdf" multiple hidden>';
      bt.innerHTML = lzBtn('PDF auswählen', 'lz-pick', 'primary') + lzBtn('Abbrechen', 'lz-cancel');
    } else if (s === 'warten') {
      h.textContent = 'Ich lese …'; b.innerHTML = svg + '<p>Einen Moment bitte.</p>'; bt.innerHTML = '';
    } else if (s === 'kennwort') {
      h.textContent = 'Die Datei hat ein Kennwort';
      b.innerHTML = svg + '<p>' + (lzUi.pwFalsch ? 'Das Kennwort war leider falsch. Bitte noch einmal.' : 'Gib das Kennwort deiner Datei ein. Ich brauche es nur jetzt zum Öffnen und speichere es nicht.') + '</p><div class="field"><label for="lz-pw">Kennwort</label><div class="a-pwrow"><input type="password" id="lz-pw" autocomplete="off"><button type="button" class="eyebtn" data-eye="lz-pw" aria-label="Passwort anzeigen" aria-pressed="false"><svg class="eye-on" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg><svg class="eye-off" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4.2M6.6 6.7A17 17 0 0 0 2 12s3.6 7 10 7a9.6 9.6 0 0 0 4.3-1M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg></button></div></div>';
      bt.innerHTML = lzBtn('Öffnen', 'lz-pwok', 'primary') + lzBtn('Abbrechen', 'lz-cancel');
    } else if (s === 'keintext') {
      h.textContent = 'Das kann ich nicht lesen';
      b.innerHTML = svg + '<p>In dieser Datei steckt nur ein Bild und kein Text. Das passiert, wenn man sie ausdruckt oder mit „Als PDF drucken“ neu speichert. Nimm bitte die ursprüngliche PDF-Datei deiner Firma. Wenn du nur ein Foto oder die Papierversion hast, tippe die Zeilen im Abgleich einfach ab.</p>';
      bt.innerHTML = lzBtn('Andere Datei', 'lz-pick2', 'primary') + lzBtn('Bezeichnungen eintippen', 'lz-hand') + lzBtn('Schließen', 'lz-cancel');
    } else if (s === 'ergebnis') {
      h.textContent = 'Das habe ich übernommen';
      b.innerHTML = svg + '<div class="notice warn">Beim Lesen können Fehler passieren. Bitte prüfe die Zahlen mit deinem Lohnzettel.</div><ul class="legende">' + (lzUi.erg || []).filter(function (x) { return x.n && data.abgleich[x.y + '-' + pad(x.m)]; }).map(function (x) { return '<li><span style="flex:1"><strong>' + MON[x.m - 1] + ' ' + x.y + '</strong></span><button type="button" class="btn" data-lzdel="' + x.y + '-' + pad(x.m) + '">Löschen</button></li>'; }).join('') + '</ul>';
      bt.innerHTML = lzBtn('Fertig', 'lz-done', 'primary');
    } else if (s === 'einr') {
      var k = lzUi.kopf || {}, tr = lzUi.treff, pk = k.paket && E.PAKETE[k.paket] ? E.PAKETE[k.paket].name : null, rows = [], pr = lzUi.modus === 'pruef', en = pr ? lzUi.en : null;
      h.textContent = pr ? 'Deine Einstellungen und dein Lohnzettel' : 'Das habe ich auf deinem Lohnzettel gefunden';
      function zl(t, lz, app, id) { var gl = app !== undefined && app !== null && String(app) !== String(lz); return '<li><span style="flex:1"><strong>' + esc(t) + '</strong><br><span>Lohnzettel:</span> <b>' + esc(lz) + '</b>' + (pr ? (app === null || app === undefined || app === '' ? '<br><span>In der App:</span> <i>nichts eingetragen</i>' : '<br><span>In der App:</span> <b>' + esc(app) + '</b>') : '') + '</span>' + (pr ? (gl ? (id ? '<button type="button" class="btn" data-lzc="' + id + '">Ändern</button>' : '<span class="hint">Bitte über „Beruf ändern“ anpassen</span>') : '<span class="hint">Passt</span>') : '') + '</li>'; }
      if (pk) rows.push(zl('Kollektivvertrag', pk, pr ? (E.PAKETE[en.paket] ? E.PAKETE[en.paket].name : en.paket) : null, null));
      if (k.stundenlohn !== null) rows.push(zl('Stundenlohn', fmtNum(k.stundenlohn) + ' €', pr ? fmtNum(en.stundenlohn) + ' €' : null, 'lohn'));
      if (k.monatslohn !== null && k.stundenlohn === null) rows.push(zl('Monatslohn', fmtNum(k.monatslohn) + ' €', pr ? (en.monatslohn ? fmtNum(en.monatslohn) + ' €' : '') : null, 'monat'));
      if (k.einstufung) rows.push(zl('Einstufung', k.einstufung, pr ? en.einstufung || '' : null, 'einst'));
      var P = data.profil || {};
      if (k.vorname) rows.push(zl('Name', k.vorname + ' ' + (k.nachname || ''), pr ? ((P.vorname || '') + ' ' + (P.nachname || '')).trim() : null, 'name'));
      if (k.firma) rows.push(zl('Firma', k.firma, pr ? (P.firma || '') : null, 'firma'));
      if (k.eintritt) rows.push(zl('Eintritt in die Firma', fmtDate(k.eintritt), pr ? (P.eintritt ? fmtDate(P.eintritt) : '') : null, 'eintritt'));
      if (k.geb) rows.push(zl('Geburtsdatum', fmtDate(k.geb), pr ? (P.geb ? fmtDate(P.geb) : '') : null, 'geb'));
      if (tr) rows.push('<li><span style="flex:1"><strong>Lohngruppe laut Tabelle</strong><br>' + esc(tr.name) + (tr.ls != null && E.LOHNGRUPPEN[tr.paket].stufen ? ', ' + esc(E.LOHNGRUPPEN[tr.paket].stufen[tr.ls]) : '') + '</span></li>');
      b.innerHTML = svg + (lzUi.msg2 ? '<div class="notice"><strong>Geändert.</strong></div>' : '') + (lzUi.msg ? '<div class="notice"><strong>Geändert.</strong> <span>Das gilt für alle Monate ab dem</span> <b>' + esc(lzUi.msg) + '</b></div>' : '') + (rows.length ? '<div class="notice warn">Beim Lesen können Fehler passieren. Bitte vergleiche mit deinem Lohnzettel.</div><ul class="legende">' + rows.join('') + '</ul>' + (lzUi.treff === null && (lzUi.kopf.treffer || []).length > 1 ? '<p class="hint">Der Stundenlohn passt zu mehreren Lohngruppen. Bitte wähle die Lohngruppe danach selbst aus.</p>' : '') : '<p>Auf diesem Lohnzettel habe ich keinen Kollektivvertrag und keinen Stundenlohn gefunden. Bitte stelle alles selbst ein. Ich helfe dir dabei.</p>') +
        '<p class="hint">Gelesen wurde nur hier auf deinem Handy. Es wurde nichts hochgeladen und nichts gespeichert, außer was du übernimmst.</p>' + (rows.length ? '<p class="hint">Wenn du übernimmst, merke ich mir die Namen der Zeilen auf deinem Lohnzettel, ohne Zahlen. Dann lese ich ihn nächstes Mal sofort.</p>' : '');
      bt.innerHTML = (!pr && rows.length ? lzBtn('Übernehmen', 'lz-einr-ok', 'primary') : '') + lzBtn(pr ? 'Schließen' : 'Selbst einstellen', 'lz-cancel');
    } else if (s === 'fehler') {
      h.textContent = 'Das hat nicht geklappt';
      b.innerHTML = svg + '<p>Ich konnte die Datei nicht öffnen. Prüfe bitte deine Internetverbindung, sie wird beim ersten Mal kurz gebraucht, um das Lesemodul zu laden. Du kannst die Zeilen auch von Hand im Abgleich eintragen.</p>';
      bt.innerHTML = lzBtn('Noch einmal', 'lz-pick2', 'primary') + lzBtn('Schließen', 'lz-cancel');
    } else if (s === 'vorlage') {
      h.textContent = 'Diesen Lohnzettel kenne ich noch nicht';
      var lb = lzUi.labels || [];
      b.innerHTML = svg + (lb.length ? '<p>Darf ich ihn kennenlernen? Dann klappt es beim nächsten Mal. Ich schicke nur die Namen der Lohnzeilen, keine Zahlen und keine persönlichen Daten.</p><details><summary>Das wird gesendet</summary><ul class="lzlabels">' + lb.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul></details>' :
        '<p>Aus dieser Datei kann ich nichts Brauchbares schicken. Du kannst die Zeilen von Hand im Abgleich eintragen.</p>');
      bt.innerHTML = (lb.length ? lzBtn('Ja, bitte', 'lz-vsend', 'primary') : lzBtn('Bezeichnungen eintippen', 'lz-hand', 'primary')) + lzBtn('Nein danke', 'lz-cancel');
    } else if (s === 'hand') {
      h.textContent = 'Zeilenbezeichnungen eintippen';
      b.innerHTML = svg + '<p>Schreibe die Bezeichnungen so ab, wie sie auf deinem Lohnzettel stehen, eine pro Zeile. Zum Beispiel „Überstunden Grundlohn“. Bitte ohne Zahlen, ohne Namen und ohne Adresse.</p><div class="field"><label for="lz-hand-t">Bezeichnungen</label><textarea id="lz-hand-t" rows="8" maxlength="1500"></textarea></div><p class="hint">Der Text geht an den Entwickler, damit er deinen Lohnzettel einbauen kann.</p>';
      bt.innerHTML = lzBtn('Schicken', 'lz-hsend', 'primary') + lzBtn('Abbrechen', 'lz-cancel');
    } else if (s === 'pruefen') {
      var r = lzUi.res, mo = r.monat || { y: new Date().getFullYear(), m: 0 };
      h.textContent = 'Eingelesene Lohnzetteldaten';
      var opts = [['', 'Nicht übernehmen']].concat(Object.keys(window.StundenLz.NAMEN).map(function (k) { return [k, window.StundenLz.NAMEN[k]]; }));
      b.innerHTML = svg + '<div class="field"><span class="lbl">Für welchen Monat ist dieser Lohnzettel?</span><div class="grid2"><select id="lz-mo" aria-label="Monat">' + [ 'Monat wählen'].concat(MON).map(function (mn, k) { return '<option value="' + k + '"' + (k === mo.m ? ' selected' : '') + '>' + mn + '</option>'; }).join('') + '</select><select id="lz-jr" aria-label="Jahr">' + [0, 1, 2, 3].map(function (d) { return new Date().getFullYear() - 2 + d; }).concat([mo.y]).filter(function (y, k, ar) { return ar.indexOf(y) === k; }).sort().map(function (y) { return '<option value="' + y + '"' + (y === mo.y ? ' selected' : '') + '>' + y + '</option>'; }).join('') + '</select></div></div><p>Die Zahlen kommen direkt aus deinem Lohnzettel. Bitte schau nur, ob jede Zeile zur richtigen Art passt.</p>' + (r.zeilen.some(function (z) { return z.nums && z.nums.length > 1; }) ? '<p>Steht in einer Zeile mehr als eine Zahl, wähle die Stundenzahl aus.</p>' : '') +
        (r.zeilen.length ? r.zeilen.map(function (z, i) { return '<div class="lzrow"><span>' + esc(z.label) + '</span>' + (z.nums && z.nums.length > 1 ? '<select data-lzp="' + i + '" aria-label="' + esc(z.label) + '">' + z.nums.map(function (nn, k) { return '<option value="' + k + '"' + (k === z.pos ? ' selected' : '') + '>' + esc(nn) + '</option>'; }).join('') + '</select>' : '<input type="text" inputmode="decimal" class="lzv" data-lzv="' + i + '" value="' + esc(z.unsicher ? z.nums[0] : String(z.menge).replace('.', ',')) + '" aria-label="Wert">') + '<select data-lzz="' + i + '" aria-label="' + esc(z.label) + '">' + opts.map(function (o) { return '<option value="' + o[0] + '"' + ((z.key || '') === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select></div>'; }).join('') : '<p>Ich habe keine Stundenzeilen gefunden. Du kannst die Zeilen von Hand im Abgleich eintragen.</p>') + (r.zeilen.length ? '<label class="check"><input type="checkbox" id="lz-stimmt"><span>Ich habe alle Werte mit meinem Lohnzettel verglichen. Alles stimmt.</span></label>' : '');
      bt.innerHTML = (r.zeilen.length ? lzBtn('Übernehmen', 'lz-apply', 'primary') : '') + lzBtn('Abbrechen', 'lz-cancel');
      if ($('#lz-apply')) $('#lz-apply').disabled = true;
    }
  }
  function lzLabels(lines) {
    var out = [], seen = {};
    (lines || []).forEach(function (ln) {
      var m = /^(.*?)\d[\d.]*[.,]\d\d(?!\d)/.exec(String(ln)); if (!m) return;
      var t = m[1].replace(/^[\d\s.\-:]+/, '').replace(/\s+/g, ' ').trim();
      if (!/[A-Za-zÄÖÜäöüß]{3}/.test(t) || /\d/.test(t) || t.length > 40 || t.split(' ').length > 5 || seen[t.toLowerCase()]) return;
      if (/iban|bic\b|@|tel\.|sv-?nr|sozialvers|geb\.|\bstr(asse|aße)?\b|platz|gasse|weg\b|gmbh|\bkg\b|\bag\b|wien|graz|linz|salzburg|innsbruck|klagenfurt|bregenz|eisenstadt|st\. pölten/i.test(t)) return;
      seen[t.toLowerCase()] = 1; out.push(t);
    });
    return out.slice(0, 60);
  }
  function lzFragePw(grund) { if (grund !== 'falsch' && lzUi.pwMem) return Promise.resolve(lzUi.pwMem); lzUi.pwMem = null; return new Promise(function (ok, fail) { lzUi.pwFalsch = grund === 'falsch'; lzUi.pwOk = ok; lzUi.pwFail = fail; lzUi.step = 'kennwort'; lzRender(); setTimeout(function () { var p = $('#lz-pw'); if (p) p.focus(); }, 60); }); }
  /* Mehrere Lohnzettel hintereinander: was die App schon kennt, übernimmt sie selbst, nur Neues wird gefragt */
  function lzLese(files) { lzUi.queue = Array.prototype.slice.call(files); lzUi.erg = []; lzNext(); }
  function lzBekannt(res) {
    var lm = lzProfil().lzMap || {};
    return !!(res.monat && res.zeilen.length && res.zeilen.every(function (z) { return lm[z.norm] !== undefined && (!z.nums || lm['@' + z.norm] === z.nums.length); }));
  }
  function lzApply(res, mo, items) {
    var key = mo.y + '-' + pad(mo.m), n = 0, sum = {};
    if (!data.abgleich) data.abgleich = {}; var cur = data.abgleich[key] || (data.abgleich[key] = {}); var lm = lzProfil().lzMap || (lzProfil().lzMap = {});
    items.forEach(function (it) {
      var z = it.z, menge = it.edit != null ? it.edit : z.menge;
      if (z.nums && it.edit == null) { menge = window.StundenLz.zahl(z.nums[it.pos]); if (it.key) { lm['#' + z.norm] = it.pos; lm['@' + z.norm] = z.nums.length; } }
      lm[z.norm] = it.key || '-'; if (it.key) sum[it.key] = (sum[it.key] || 0) + menge;
    });
    Object.keys(sum).forEach(function (k) { cur[k] = Math.round(sum[k] * 100) / 100; n++; }); if (n) cur.gelesen = true;
    save(); lzUi.erg.push({ y: mo.y, m: mo.m, n: n });
    return n;
  }
  function lzFertig() {
    var e = lzUi.erg || [];
    if (e.length > 1 && e.some(function (x) { return x.n; })) { lzUi.queue = []; lzUi.step = 'ergebnis'; lzRender(); return; } // mehrere Monate: Liste mit Löschknopf je Monat
    lzClose();
    if (!e.length) return;
    var l = e[e.length - 1]; ui.y = l.y; ui.m = l.m; show('lohn');
    var txt = e.some(function (x) { return x.n; }) ? 'Übernommen. Bitte prüfe die Zahlen mit deinem Lohnzettel. Das Ergebnis siehst du unter „Stimmt mein Lohnzettel?“.' : 'Nichts übernommen.';
    toast(txt, 7000);
    setTimeout(function () { var el = $('#m-abgleich'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 200);
  }
  function lzFertig2(e) {
    lzClose(); var l = e[e.length - 1]; ui.y = l.y; ui.m = l.m; show('lohn');
    toast('Übernommen. Bitte prüfe die Zahlen mit deinem Lohnzettel. Das Ergebnis siehst du unter „Stimmt mein Lohnzettel?“.', 7000);
    setTimeout(function () { var el = $('#m-abgleich'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 200);
  }
  function fmtNum(x) { return (Math.round(x * 100) / 100).toFixed(2).replace('.', ','); }
  function lzIdPasst(id, text) { var e = String(id).replace(/\./g, '\\.'); return new RegExp('(^|\\s)' + e + (/^\d+$/.test(id) ? '[a-z]?' : '') + '(\\s|$|[:,])', 'i').test(text); }
  function lzEinrAus(lines) {
    var k = window.StundenLz.kopf(lines, E.LOHNGRUPPEN), tr = null, ts = k.treffer || [];
    if (ts.length === 1) tr = ts[0];
    else if (ts.length > 1 && k.einstufung) { var m = ts.filter(function (x) { return lzIdPasst(x.lg, k.einstufung); }); if (m.length === 1) tr = m[0]; }
    if (!tr && !ts.length && k.paket && k.einstufung && E.LOHNGRUPPEN[k.paket]) {
      var gm = E.LOHNGRUPPEN[k.paket].gruppen.filter(function (g) { return lzIdPasst(g.id, k.einstufung); });
      if (gm.length === 1) tr = { paket: k.paket, lg: gm[0].id, name: gm[0].name, ls: null, lehrling: !!gm[0].lehrling, hinweis: true };
    }
    lzUi.kopf = k; lzUi.treff = tr; ins('lz_einrichten');
    if (lzUi.modus === 'pruef') lzUi.en = wAt(todayISO());
    lzUi.step = 'einr'; lzUi.msg = ''; lzUi.msg2 = false; lzRender();
  }
  function lzVorlageMerken() {
    try {
      var res = window.StundenLz.parse(lzUi.lines || [], lzProfil().lzMap || {}), lm = lzProfil().lzMap || (lzProfil().lzMap = {}), n = 0;
      res.zeilen.forEach(function (z) {
        if (!z.key || lm[z.norm] !== undefined) return;
        lm[z.norm] = z.key; n++;
        if (z.nums) { lm['#' + z.norm] = z.pos | 0; lm['@' + z.norm] = z.nums.length; }
      });
      if (n) save();
      return n;
    } catch (e) { return 0; }
  }
  function lzAnwenden(w, k, tr) {
    var kvs = (E.BERUFE[w.beruf] && E.BERUFE[w.beruf].kvs) || [], gleich = k.paket && kvs.indexOf(k.paket) >= 0, pak = gleich ? k.paket : (tr && kvs.indexOf(tr.paket) >= 0 ? tr.paket : null);
    if (pak && pak !== w.paket) { var pv = E.PAKETE[pak].werte; w.paket = pak; w.wochen = pv.ueberstunden.wochenStd; w.dsatz = pv.diaeten.modell === 'stunde' ? pv.diaeten.satz : ''; w.lg = null; w.ls = null; }
    if (pak) w.kvGewaehlt = true;
    if (k.stundenlohn !== null) w.lohn = k.stundenlohn;
    if (k.monatslohn !== null && k.stundenlohn === null) w.monat = k.monatslohn;
    if (k.einstufung) w.einst = k.einstufung;
    if (k.eintritt && !w.eintritt) w.eintritt = k.eintritt;
    if (k.geb) w.geb = k.geb;
    if (k.firma && !w.firma) w.firma = k.firma;
    if (k.vorname && !w.vorname) { w.vorname = k.vorname; w.nachname = k.nachname || ''; }
    if (tr && tr.paket === w.paket) { w.lg = tr.lg; w.ls = tr.ls == null ? '' : tr.ls; }
    return !!(pak || k.stundenlohn !== null || k.einstufung || k.eintritt || k.geb || k.vorname || k.firma);
  }
  function lzEinrOk() {
    var w = ui.wiz, k = lzUi.kopf, tr = lzUi.treff; if (!w || !k) { lzClose(); return; }
    if (!w.beruf) { w.scan = { k: k, tr: tr }; w.scanDone = false; lzVorlageMerken(); lzClose(); toast('Gemerkt. Ich trage es im Schritt Kollektivvertrag ein, sobald du deinen Beruf gewählt hast.', 5000); return; }
    var ok = lzAnwenden(w, k, tr); lzVorlageMerken();
    lzClose(); wzRender(); toast(ok ? 'Übernommen. Bitte prüfe die Werte noch einmal.' : 'Dazu habe ich nichts gefunden.', 4000);
  }
  function lzEinrAendern(was) {
    var en = lzUi.en, k = lzUi.kopf, tr = lzUi.treff; if (!en || !k) return;
    if (was === 'name' || was === 'eintritt' || was === 'geb' || was === 'firma') {
      var pp = data.profil || (data.profil = {});
      if (was === 'name') { pp.vorname = k.vorname; pp.nachname = k.nachname || ''; } else if (was === 'firma') pp.firma = k.firma; else if (was === 'eintritt') pp.eintritt = k.eintritt; else { pp.geb = k.geb; delete pp.gebGruss; }
      save(); lzUi.msg = ''; lzUi.msg2 = true; renderSettings(); lzRender(); return;
    }
    var sorted = data.settings.slice().sort(function (x, y) { return x.gueltigAb < y.gueltigAb ? -1 : 1; }), idx = -1;
    sorted.forEach(function (x, n) { if (x.gueltigAb === en.gueltigAb) idx = n; }); if (idx < 0) return;
    function wert(r) { return was === 'einst' ? String(r.einstufung || '') : was === 'monat' ? +r.monatslohn || 0 : +r.stundenlohn || 0; }
    function gleich(a, b) { return was === 'einst' ? a === b : Math.abs(a - b) < 0.005; }
    var alt = wert(sorted[idx]), kette = [sorted[idx]], n = idx - 1;
    while (n >= 0 && gleich(wert(sorted[n]), alt)) { kette.push(sorted[n]); n--; } // frühere Einträge mit demselben (falschen) Wert gehören mit korrigiert
    kette.forEach(function (rec) {
      if (was === 'lohn') { rec.stundenlohn = k.stundenlohn; rec.monatslohn = null; rec.lgAuto = false; if (tr && !tr.hinweis && tr.paket === rec.paket) { rec.lg = tr.lg; rec.ls = tr.ls; rec.lgAuto = true; } }
      else if (was === 'monat') { var ms = rec.monatsStd || 166.83; rec.monatslohn = k.monatslohn; rec.monatsStd = ms; rec.stundenlohn = Math.round(k.monatslohn / ms * 100) / 100; rec.lgAuto = false; }
      else if (was === 'einst') rec.einstufung = k.einstufung.slice(0, 60);
    });
    var ab = kette[kette.length - 1].gueltigAb;
    lzVorlageMerken(); save(); lzUi.en = sorted[idx]; lzUi.msg = fmtDate(ab); renderSettings(); lzRender();
  }
  function lzNext() {
    if (!lzUi.queue || !lzUi.queue.length) { lzFertig(); return; }
    var file = lzUi.queue.shift();
    lzUi.step = 'warten'; lzRender();
    var fr = new FileReader();
    fr.onload = function () {
      window.StundenLz.lesePdf(fr.result, lzFragePw).then(function (o) {
        if (!o.hatText) { lzUi.queue = []; lzUi.step = 'keintext'; lzRender(); return; }
        if (lzUi.modus === 'einr' || lzUi.modus === 'pruef') { lzUi.queue = []; lzUi.lines = o.lines; lzEinrAus(o.lines); return; }
        var res = window.StundenLz.parse(o.lines, lzProfil().lzMap || {}); lzUi.res = res; ins('lz_gelesen');
        if (lzBekannt(res)) { lzApply(res, res.monat, res.zeilen.map(function (z) { return { z: z, key: z.key, pos: z.pos | 0 }; })); lzNext(); return; }
        lzUi.step = res.zeilen.length ? 'pruefen' : 'vorlage'; if (!res.zeilen.length) lzUi.labels = lzLabels(o.lines); lzRender();
      }, function (e) { lzUi.queue = []; if (e && e.message === 'abgebrochen') { lzClose(); return; } lzUi.step = 'fehler'; lzRender(); });
    };
    fr.onerror = function () { lzUi.queue = []; lzUi.step = 'fehler'; lzRender(); };
    fr.readAsArrayBuffer(file);
  }
  (function () {
    var dlg = $('#lz-dlg'); if (!dlg) return;
    dlg.addEventListener('change', function (ev) {
      var t = ev.target;
      if (t.id === 'lz-ok') { $('#lz-weiter').disabled = !t.checked; return; }
      if (t.id === 'lz-stimmt') { $('#lz-apply').disabled = !t.checked; return; }
      if (t.id === 'lz-file' && t.files && t.files[0]) { var fl = Array.prototype.slice.call(t.files); t.value = ''; lzLese(fl); }
    });
    dlg.addEventListener('click', function (ev) {
      var t = ev.target.closest('button'); if (!t) return;
      if (t.id === 'lz-cancel') { if (lzUi.pwFail && lzUi.step === 'kennwort') { var f = lzUi.pwFail; lzUi.pwFail = null; f(new Error('abgebrochen')); } lzClose(); }
      else if (t.id === 'lz-einr-ok') lzEinrOk();
      else if (t.dataset && t.dataset.lzc) lzEinrAendern(t.dataset.lzc);
      else if (t.id === 'lz-hand') { lzUi.step = 'hand'; lzRender(); }
      else if (t.id === 'lz-hsend') {
        var tx = ($('#lz-hand-t').value || '').replace(/\d/g, '#').trim(); if (!tx) { lzClose(); return; }
        try { window.StundenInsights.feedback('wunsch', '[Lohnzettel-Vorlage von Hand] ' + tx.replace(/\s*\n+\s*/g, ' | ').slice(0, 1800), null).then(function () { toast('Danke! Ich lerne diesen Lohnzettel kennen.', 5000); ins('lz_vorlage_hand'); }, function () { toast('Das Senden hat nicht geklappt. Bitte später noch einmal probieren.'); }); } catch (e) { toast('Das Senden hat nicht geklappt. Bitte später noch einmal probieren.'); }
        lzClose();
      }
      else if (t.id === 'lz-vsend') {
        var sel = lzUi.labels || [];
        if (!sel.length) { lzClose(); return; }
        try { window.StundenInsights.feedback('wunsch', '[Lohnzettel-Vorlage] ' + sel.join(' | ').slice(0, 1800), null).then(function () { toast('Danke! Ich lerne diesen Lohnzettel kennen.', 5000); ins('lz_vorlage'); }, function () { toast('Das Senden hat nicht geklappt. Bitte später noch einmal probieren.'); }); } catch (e) { toast('Das Senden hat nicht geklappt. Bitte später noch einmal probieren.'); }
        lzClose();
      }
      else if (t.dataset && t.dataset.lzdel) { delete data.abgleich[t.dataset.lzdel]; save(); lzRender(); }
      else if (t.id === 'lz-done') { lzUi.step = 'x'; lzUi.queue = []; var e2 = (lzUi.erg || []).filter(function (x) { return data.abgleich[x.y + '-' + pad(x.m)]; }); lzUi.erg = e2.length ? e2.map(function (x) { return { y: x.y, m: x.m, n: 1 }; }) : []; if (e2.length) lzFertig2(e2); else lzClose(); }
      else if (t.id === 'lz-nein') { lzProfil().lzLesen = false; save(); lzClose(); renderSettings(); }
      else if (t.id === 'lz-weiter') { lzProfil().lzLesen = true; save(); ins('lz_erlaubt'); lzUi.step = 'datei'; lzRender(); renderSettings(); }
      else if (t.id === 'lz-pick' || t.id === 'lz-pick2') { lzUi.step = 'datei'; lzRender(); var fi = $('#lz-file'); if (fi) fi.click(); }
      else if (t.id === 'lz-pwok') { var pw = $('#lz-pw').value; if (!pw) return; lzUi.pwMem = pw; var ok = lzUi.pwOk; lzUi.pwOk = null; lzUi.step = 'warten'; lzRender(); if (ok) ok(pw); }
      else if (t.id === 'lz-apply') {
        var r = lzUi.res, mo = { y: +$('#lz-jr').value, m: +$('#lz-mo').value }; if (!mo.m) { toast('Bitte wähl zuerst den Monat.'); return; } var items = $$('#lz-body [data-lzz]').map(function (sl) {
          var ps = document.querySelector('#lz-body [data-lzp="' + sl.dataset.lzz + '"]'), z = r.zeilen[+sl.dataset.lzz];
          var vi = document.querySelector('#lz-body [data-lzv="' + sl.dataset.lzz + '"]'), ed = null;
          if (vi && !ps) { var tx = String(vi.value).trim(); tx = tx.indexOf(',') >= 0 ? tx.replace(/\./g, '').replace(',', '.') : tx; var nv = parseFloat(tx); if (!isNaN(nv)) ed = nv; }
          return { z: z, key: sl.value, pos: ps ? +ps.value : (z.pos | 0), edit: ed };
        });
        lzApply(r, mo, items); lzNext();
      }
    });
    $('#lz-start').addEventListener('click', function () { lzUi.modus = ''; lzOpen(); });
    var bE = $('#lz-einst'); if (bE) bE.addEventListener('click', function () { lzUi.modus = 'pruef'; lzOpen(); });
    $('#lz-chk').addEventListener('change', function () { lzProfil().lzLesen = this.checked; save(); if (this.checked) lzOpen('erlaubnis'); });
    $('#lz-wipe').addEventListener('click', function (e) { arm(e.currentTarget, 'Wirklich alle löschen?', function () { data.abgleich = {}; save(); toast('Alle Lohnzettel-Eingaben sind gelöscht.'); }); });
    $('#lz-forget').addEventListener('click', function () { lzProfil().lzMap = {}; save(); toast('Gemerkte Bezeichnungen gelöscht.'); });
  })();
  /* Hinweis, wenn eine Rückmeldung erledigt ist: beim ersten Mal werden schon erledigte still als gesehen gemerkt */
  function fbErledigtPruefen() {
    if (PROBE || !window.StundenInsights || !window.StundenInsights.on || !data.settings.length) return;
    window.StundenInsights.erledigt().then(function (ids) {
      if (!ids) return;
      var pf = data.profil || (data.profil = {});
      if (!pf.fbGesehen) { pf.fbGesehen = ids.slice(); save(); return; }
      ui.fbNeu = ids.filter(function (id) { return pf.fbGesehen.indexOf(id) < 0; });
      if (ui.fbNeu.length && !miaCfg().ruhig && !ui.wiz && !TOUR) { ui.miaAuto = true; miaOpen(true); }
    });
  }
  /* Grundeinstellung: "Anonym mithelfen" ist an, wer nicht selbst entschieden hat (Testphase, Tester sind informiert). Wer Nein gesagt hat, bleibt auf Nein. */
  function standardMithelfen() {
    if (PROBE || !window.StundenInsights || !window.StundenInsights.on || !data.settings.length) return;
    var p = data.profil || (data.profil = {}), co = p.consent || {};
    if (co.statistik || co.miaFragen || p.mithelfenNein || p.mithelfenStd) return;
    p.consent = { statistik: true, miaFragen: true }; p.mithelfenStd = true; save();
    try { window.StundenInsights.push(true); } catch (e) { }
    toast('Anonym mithelfen ist eingeschaltet. Du kannst es jederzeit in den Einstellungen ausschalten.');
  }
  setTimeout(function () { try { geburtstagPruefen(); } catch (e) { } }, 1800);
  setTimeout(function () { try { standardMithelfen(); } catch (e) { } }, 3500);
  setTimeout(function () { try { fbErledigtPruefen(); } catch (e) { } }, 6000);
  window.__scBoot = true;
})();
