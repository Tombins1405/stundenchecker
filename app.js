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
  var PAKET_KURZ = { gueter: 'Güterbeförderung', klein: 'Kleintransport', bau: 'Bau', handel: 'Handel (Angestellte)', handel_arb: 'Handel (Arbeiter)', buero: 'Büro (Angestellte)', gastro: 'Gastgewerbe', metall: 'Metallgewerbe', dachdecker: 'Dachdecker', pflasterer: 'Pflasterer', fliesenleger: 'Fliesenleger / Hafner', gewerbe_ang: 'Büro Gewerbe (Angestellte)', reinigung: 'Gebäudereinigung', bewachung: 'Bewachung', baecker: 'Bäckergewerbe', konditor: 'Konditorgewerbe', metall_ang: 'Metallgewerbe (Angestellte)', friseur: 'Friseurgewerbe', sozial: 'Sozialwirtschaft (SWÖ)', de_spedition: 'Spedition Berlin (Deutschland)', de_spedition_nrw: 'Spedition NRW (Deutschland)', de_spedition_by: 'Spedition Bayern (Deutschland)', de_logistik_sn: 'Logistik Sachsen (Deutschland)', de_spedition_sonst: 'Spedition, anderes Bundesland (Deutschland)', de_handel: 'Einzelhandel (Deutschland)', de_gastro: 'Gastgewerbe (Deutschland)', eigen: 'Eigene Werte' };
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
      localStorage.removeItem('stundenchecker.profpush'); // beim Wechsel das Profil sofort mit den echten Daten melden
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
      return { beruf: w.beruf || null, paket: w.paket || null, land: pk && pk.land === 'DE' ? 'DE' : 'AT', lang: (window.localStorage && localStorage.getItem('stundenchecker.lang')) || (navigator.language || '').slice(0, 2), tage: Object.keys(data.days).length, view: ui.view, geraet: data.profil && data.profil.consent && data.profil.consent.statistik ? geraetInfo() : null, mia: data.profil && data.profil.consent && data.profil.consent.statistik ? miaInfo() : null };
    }
  };
  function miaInfo() { try { var m = (data.profil && data.profil.mia) || {}; return (m.figur === 'm' ? 'Milo' : 'Mia') + ((m.name || '').trim() ? ', eigener Name' : '') + (m.eigen === true ? ', selbst gestaltet' : '') + (m.spricht === true ? ', spricht' : '') + (m.ruhig ? ', ruhig gestellt' : ''); } catch (e) { return null; } }
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
    sonderurlaub: '<path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.5l-5.4 3 1.2-6L3.3 9.3l6.1-.7z"/>',
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
    ['sonderurlaub', 'Sonderurlaub', 'Bezahlter freier Tag aus wichtigem Grund, zum Beispiel Hochzeit, Todesfall oder Umzug. Er zählt wie ein Urlaubstag mit den Sollstunden. Hast du an dem Tag trotzdem gearbeitet, trage die Zeiten ein: Dann zählt der Tag als Sonderurlaub plus Arbeit.'],
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
  // Voraussichtliches Brutto (Schätzung) und Auszahlungstag
  var BRUTTO_INFO = 'Das ist eine Schätzung des Bruttos aus deinen Aufzeichnungen: Lohn, Überstunden, Prämien und Dienste. Das Netto hängt von mehreren Faktoren ab, die die App nicht berücksichtigen kann, zum Beispiel Sozialversicherung, Lohnsteuer, Familienbonus, Pendlerpauschale, Gewerkschaftsbeitrag und Sonderzahlungen. Sonderzahlungen, Nachzahlungen und die Schlechtwetter-Entschädigung sind nicht enthalten. Tipp: Auf deinem letzten Lohnzettel stehen Brutto und Auszahlung. Teilst du die Auszahlung durch das Brutto, siehst du ungefähr, wie viel vom Brutto bei dir netto ankommt.';
  var NETTO_INFO = 'Das Netto rechnet die App nicht selbst. Der Knopf öffnet den Brutto-Netto-Rechner des Finanzministeriums (BMF) in einem neuen Fenster. Das ist eine unverbindliche Modellrechnung. Gib dort das Brutto von oben ein und stelle ein: Zeitraum Monatlich, Beitragsgruppe wie auf deinem Lohnzettel (Arbeiter oder Angestellter), Jahr, Bundesland deines Arbeitsplatzes, Pendlerpauschale und Kinder wie bei dir. Vergleiche das Netto mit der Zeile Auszahlung auf deinem Lohnzettel. Kleine Unterschiede sind normal, zum Beispiel durch Diäten, Gewerkschaftsbeitrag oder Vorschüsse. Der Rechner kennt außerdem nicht, welche Teile deines Lohns steuerlich begünstigt sind, zum Beispiel steuerfreie Überstundenzuschläge. Dann ist die Lohnsteuer auf deinem Lohnzettel niedriger, als der Rechner sie zeigt. Die genaue Bemessungsgrundlage kennt nur deine Lohnverrechnung.';
  function bruttoBlock(s, w, laufend) {
    if (laufend) return '';
    if (!(s.lohnStd > 0) && !(s.arbeitstage > 0)) return '';
    var bv = E.bruttoVorschau(s, w, laufend); if (!bv.ok) return '';
    var zt = data.profil && +data.profil.zahltag, zl = '';
    if (zt >= 1 && zt <= 31) { var ny = ui.m === 12 ? ui.y + 1 : ui.y, nm = ui.m === 12 ? 1 : ui.m + 1, dd = Math.min(zt, E.daysInMonth(ny, nm)); zl = '<p class="sub"><span>Auszahlung voraussichtlich am</span> ' + esc(fmtDate(E.iso(ny, nm, dd))) + '</p>'; }
    return '<div class="brutto"><p class="eyebrow"><span>Brutto (geschätzt)</span><button type="button" class="info" id="br-info" aria-label="Info"></button></p><p class="big">' + eur.format(bv.brutto) + '</p>' +
      '<p class="sub">' + (laufend ? '<span>Stand heute, Überstunden kommen am Monatsende dazu</span>' : '<span>für den ganzen Monat</span>') + '</p>' +
      (bv.diaeten > 0 ? '<p class="sub"><span>plus Diäten</span> ' + eur.format(bv.diaeten) + '</p>' : '') + zl +
      (function () { var kg = kvVergleich(ui.y, ui.m, s, w); return kg ? '<p class="sub kvz">' + esc(abw1('Nach Kollektivvertrag und Gesetz gerechnet: etwa {0}. Einzelheiten stehen unter „Jahr und Konten“ bei den Abweichungen.', [eur.format(kg.kv)])) + '</p>' : ''; })() +
      '<div class="nbrow"><a class="btn" id="nb-link" href="https://www.bmf.gv.at/services/berechnungsprogramme.html" target="_blank" rel="noopener noreferrer">'+ esc('Netto im BMF-Rechner prüfen') +'</a> <button type="button" class="info" id="nb-info" aria-label="Info"></button></div></div>';
  }
  function renderMonat() {
    $('#storage-warn').hidden = speicherOk;
    $('#onboard').hidden = !(data.settings.length === 0 && Object.keys(data.days).length === 0);
    $('#m-title').textContent = MON[ui.m - 1] + ' ' + ui.y;
    var cm = E.calcMonth(data, ui.y, ui.m, todayISO()), s = cm.summe, w = wAt(E.iso(ui.y, ui.m, 1));

    var sub = '';
    if (s.ftArbeitStd > 0 || s.zuTagStd > 0) sub = abw1(s.zuTagStd > 0 ? '{0} h gearbeitet, davon {1} h mit Sonn- oder Feiertagszuschlag' : '{0} h gearbeitet, mit bezahltem Feiertag', [fh(s.istStd), fh(s.zuTagStd)]);
    else if (s.zuschlagStd !== 0) sub = fh(s.istStd) + ' h gearbeitet, dazu ' + fh(s.zuschlagStd) + ' h Zuschlag';
    else if (s.lohnStd !== s.istStd) sub = fh(s.istStd) + ' h gearbeitet, dazu bezahlte Abwesenheit';
    else sub = 'tatsächlich gearbeitet';
    var jetzt = new Date(), laufend = ui.y > jetzt.getFullYear() || (ui.y === jetzt.getFullYear() && ui.m >= jetzt.getMonth() + 1); // Überstunden gibt es erst, wenn der Monat vorbei ist
    var diaetenBetrag = w.diaeten.modell === 'aus' ? '–' : eur.format(s.diaetenBetrag);
    var html = '<div class="panel">' +
      '<div><p class="eyebrow">Lohnstunden</p><p class="big">' + fh(Math.round((s.lohnStd + (s.ftArbeitStd || 0)) * 100) / 100) + '<small>h</small></p><p class="sub">' + esc(sub) + '</p></div>' +
      '<dl class="figs">' +
      (s.gleit ? '<div><dt>Gleitzeitsaldo</dt><dd class="hl">' + (s.ueberStd > 0 ? '+' : '') + fh(s.ueberStd) + '<small>h</small></dd></div>' + (s.gleitQuartalStd != null ? '<div><dt>Im Quartal</dt><dd>' + (s.gleitQuartalStd > 0 ? '+' : '') + fh(s.gleitQuartalStd) + '<small>h</small></dd></div>' : '') + (s.gleitKontoStd != null ? '<div><dt>Gleitzeitkonto</dt><dd class="hl">' + (s.gleitKontoStd > 0 ? '+' : '') + fh(s.gleitKontoStd) + '<small>h</small></dd></div>' : '') + (s.gleitVerfallStd > 0 ? '<div><dt>Über der Grenze</dt><dd>' + fh(s.gleitVerfallStd) + '<small>h</small></dd></div>' : '') : '<div><dt>Überstunden</dt>' + (laufend ? '<dd class="hl">–<small class="later">am Monatsende</small></dd>' : '<dd class="hl">' + fh(s.ueberStd - (s.mehrStd || 0)) + '<small>h</small></dd>') + '</div>' + (!laufend && s.mehrStd > 0 ? '<div><dt>Mehrarbeit</dt><dd class="hl">' + fh(s.mehrStd) + '<small>h</small></dd></div>' : '') + (!laufend && s.mehrFreiStd > 0 ? '<div><dt>Mehrarbeit ohne Zuschlag</dt><dd class="hl">' + fh(s.mehrFreiStd) + '<small>h</small></dd></div>' : '')) +
      (w.diaeten.modell === 'aus' ? '' : '<div><dt>Diätenstd.</dt><dd>' + fh(s.diaetenStd) + '<small>h</small></dd></div>' +
      '<div><dt>Diäten</dt><dd>' + esc(diaetenBetrag) + '</dd></div>') +
      (s.praemien && s.praemien.length ? '<div><dt>Prämien</dt><dd>' + eur.format(s.praemienEuro) + '</dd></div>' : '') +
      (s.dienste || []).map(function (x) { return '<div><dt>' + esc(x.name) + '</dt><dd>' + String(x.menge).replace('.', ',') + '<small> ' + (DS_KURZ[x.einheit] || '') + '</small></dd></div>'; }).join('') +
      '</dl>' + bruttoBlock(s, w, laufend);
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
    var bri = $('#br-info'); if (bri) { var brs = document.createElement('small'); brs.hidden = true; brs.textContent = BRUTTO_INFO; bri._sm = brs; }
    var nbi = $('#nb-info'); if (nbi) { var nbs = document.createElement('small'); nbs.hidden = true; nbs.textContent = NETTO_INFO; nbi._sm = nbs; }

    var parts = [];
    if (s.arbeitstage) parts.push(s.arbeitstage + (s.arbeitstage === 1 ? ' Arbeitstag' : ' Arbeitstage'));
    if (s.urlaub) parts.push(s.urlaub + ' Urlaub');
    if (s.sonderTage) parts.push(s.sonderTage + ' Sonderurlaub');
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
        try { E.praemienDay(d, r, (data.profil && data.profil.praemien) || [], wAt(r.datum)).forEach(function (x) { small.push(esc(x.name) + ' ' + fh(x.menge) + (x.einheit === 'stunde' || x.einheit === 'taet' ? ' h' : ' ×')); }); } catch (e) { }
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
        if (r.nettoMin > 0) {
          chips += '<span class="chip acc">plus Arbeit</span>';
          small.push(esc(d.von) + '–' + esc(d.bis || ''));
          val = r.creditMin ? fh(r.creditMin / 60) + ' h<small>+ ' + fh(r.nettoMin / 60) + ' h</small>' : fh(r.nettoMin / 60) + ' h';
        }
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
  // Abweichungen, die die App festhält – auch wenn die Einstellung der Firmenpraxis entspricht.
  // kat: diaeten, praemien, stunden, ueber. fehl: so viel fehlt dir (Stunden oder Euro, nur positiv). eur: geschätzter Wert in Euro (ohne Gewähr).
  function abw1(tpl, a, de) { var d = !de && uiDict(uiLang()), t = (d && d[tpl]) || tpl; return t.replace(/\{(\d)\}/g, function (_, i) { return a[+i]; }); }
  function abwLab(l) { var t = uiTr(l, uiLang()); return t || l; }
  // Zwei Abrechnungen: nach der Handhabung der Firma (Einstellungen) und nach Kollektivvertrag und Gesetz. Liefert den Unterschied je Regel.
  var KV_GRUND = { zu: 'Zuschläge an Sonn- und Feiertagen', betrieb: 'Betrieb geschlossen als bezahlte Zeit', frei: 'Freistellung durch die Firma bezahlt', rund: 'Zeiten ohne Rundung', lohn: 'Lohn laut Lohngruppe im Kollektivvertrag', za: 'Zuschlag für Überstunden im Zeitausgleich', diaet: 'Diäten nach den Werten des Kollektivvertrags' };
  var KV_BRUTTO = ['zu', 'betrieb', 'frei', 'rund', 'lohn'];
  function kvVergleich(y, m, sm, wmm) {
    try {
      if (!wmm || !sm || sm.gleit) return null;
      var bF = E.bruttoVorschau(sm, wmm, false); if (!bF.ok) return null;
      var dat = E.iso(y, m, E.daysInMonth(y, m)), opt = function (k) { return { ohneSpaeter: true, kvRef: k }; };
      var sA = E.calcMonth(data, y, m, todayISO(), opt(KV_BRUTTO)).summe, bA = E.bruttoVorschau(sA, E.kvWert(wmm, dat, KV_BRUTTO), false); if (!bA.ok) return null;
      var teile = [], kv = bA.brutto;
      // Zeitausgleich 1:1 ohne Zuschlag: Der Zuschlag für die aufs Konto gebuchten Überstunden fehlt (§ 10 Arbeitszeitgesetz).
      var lzK = (data.abgleich || {})[y + '-' + (m < 10 ? '0' : '') + m] || {}, zaD = 0;
      if (wmm.zaUmr === 'ohne' && +lzK.zaKonto > 0 && +wmm.stundenlohn > 0) { zaD = Math.round(+lzK.zaKonto * (wmm.ueberstunden.zuschlagPct != null ? +wmm.ueberstunden.zuschlagPct : 50) / 100 * +wmm.stundenlohn * 100) / 100; kv = Math.round((kv + zaD) * 100) / 100; }
      var diff = Math.round((kv - bF.brutto) * 100) / 100; if (Math.abs(diff) < 0.5) return null;
      KV_BRUTTO.forEach(function (k) { var sk = E.calcMonth(data, y, m, todayISO(), opt([k])).summe, bk = E.bruttoVorschau(sk, E.kvWert(wmm, dat, [k]), false); if (!bk.ok) return; var d = Math.round((bk.brutto - bF.brutto) * 100) / 100; if (Math.abs(d) >= 0.5) teile.push({ key: k, delta: d }); });
      if (zaD >= 0.5) teile.push({ key: 'za', delta: zaD });
      return { firma: bF.brutto, kv: kv, diff: diff, teile: teile };
    } catch (e) { return null; }
  }
  // Diäten: Zählweise der Firma (eigene Einstellungen und von Hand geänderte Diätenstunden) gegen die Werte des Kollektivvertrags
  function kvDiaeten(y, m, sm) {
    try {
      if (!sm) return null; var sk = E.calcMonth(data, y, m, todayISO(), { ohneSpaeter: true, kvRef: ['diaet'] }).summe;
      var d = Math.round((sk.diaetenBetrag - sm.diaetenBetrag) * 100) / 100; return Math.abs(d) >= 0.5 ? { firma: sm.diaetenBetrag, kv: sk.diaetenBetrag, diff: d } : null;
    } catch (e) { return null; }
  }
  // Texte der Gegenüberstellung eines Monats (für Abweichungen, Kontrollbericht und die Liste für die Arbeiterkammer)
  function kvTexte(y, m, sm, wmm) {
    var out = [], kg = kvVergleich(y, m, sm, wmm), kd = kvDiaeten(y, m, sm);
    if (kg) { var fmtT = function (lab) { return kg.teile.map(function (t) { return lab(KV_GRUND[t.key]) + ' ' + (t.delta > 0 ? '+' : '−') + eur.format(Math.abs(t.delta)); }).join('; '); }, kgA = [eur.format(kg.firma), eur.format(kg.kv), eur.format(Math.abs(kg.diff))];
      var kgT = kg.diff > 0 ? 'Gegenüberstellung: Nach der Handhabung deiner Firma ergibt der Monat etwa {0} brutto. Nach Kollektivvertrag und Gesetz wären es etwa {1}, das sind {2} mehr. Im Einzelnen: {3}. Unter Vorbehalt: Schätzung aus deinen Eingaben und Einstellungen, prüfe bitte auch diese.' : 'Gegenüberstellung: Nach der Handhabung deiner Firma ergibt der Monat etwa {0} brutto. Nach Kollektivvertrag und Gesetz wären es etwa {1}, das sind {2} weniger. Im Einzelnen: {3}. Unter Vorbehalt: Schätzung aus deinen Eingaben und Einstellungen, prüfe bitte auch diese.';
      out.push({ y: y, m: m, kat: 'kvref', kvDiff: kg.diff, teile: kg.teile, text: abw1(kgT, kgA.concat([fmtT(abwLab)])), de: abw1(kgT, kgA.concat([fmtT(function (x) { return x; })]), 1) }); }
    if (kd) { var kdA = [eur.format(kd.firma), eur.format(kd.kv), eur.format(Math.abs(kd.diff))], kdT = kd.diff > 0 ? 'Gegenüberstellung Diäten: Nach der Handhabung deiner Firma sind es {0}. Nach den Werten des Kollektivvertrags wären es {1}, das sind {2} mehr. Unter Vorbehalt: Prüfe bitte deine Diäten-Einstellungen und die von Hand geänderten Diätenstunden.' : 'Gegenüberstellung Diäten: Nach der Handhabung deiner Firma sind es {0}. Nach den Werten des Kollektivvertrags wären es {1}, das sind {2} weniger. Unter Vorbehalt: Prüfe bitte deine Diäten-Einstellungen und die von Hand geänderten Diätenstunden.';
      out.push({ y: y, m: m, kat: 'kvref', kvDiff: kd.diff, teile: [{ key: 'diaet', delta: kd.diff }], text: abw1(kdT, kdA), de: abw1(kdT, kdA, 1) }); }
    return out;
  }
  function abwListe() {
    var out = [], mon = {};
    Object.keys(data.days).forEach(function (d) { mon[d.slice(0, 7)] = 1; });
    Object.keys(data.abgleich).forEach(function (k) { mon[k] = 1; });
    var ur = {}; ueberRows().forEach(function (r) { ur[r.y + '-' + r.m] = r; });
    function euroZeile(q, wmm) { var e = E.abgleichEuro([q], wmm); return e && e.ok && !e.fehltStundenlohn ? e.summe : null; }
    function euroStd(std, wmm) { return wmm && +wmm.stundenlohn > 0 ? Math.round(std * +wmm.stundenlohn * 100) / 100 : null; }
    Object.keys(mon).sort().forEach(function (k) {
      var y = +k.slice(0, 4), m = +k.slice(5, 7); if (!(y > 2000 && m >= 1 && m <= 12)) return;
      var sm = E.calcMonth(data, y, m, todayISO(), { ohneSpaeter: true }).summe, r = ur[y + '-' + m], sw = sm.swStd || 0, wmm = wAt(k + '-01');
      kvTexte(y, m, sm, wmm).forEach(function (x) { out.push(x); });
      var lzS = (data.abgleich || {})[k] || {};
      if (hasN(lzS.satz) && wmm && hasN(wmm.stundenlohn) && !(+wmm.monatslohn > 0) && Math.abs(+lzS.satz - +wmm.stundenlohn) > 0.004) { var sA = [eur.format(+lzS.satz), eur.format(+wmm.stundenlohn)], sT = 'Stundenlohn: auf dem Lohnzettel {0}, in deinen Einstellungen {1}.'; out.push({ y: y, m: m, kat: 'satz', text: abw1(sT, sA), de: abw1(sT, sA, 1) }); }
      if (hasN(lzS.dSatz) && wmm && wmm.diaeten && wmm.diaeten.modell === 'stunde' && Math.abs(+lzS.dSatz - +wmm.diaeten.satz) > 0.004) { var dA = [eur.format(+lzS.dSatz), eur.format(+wmm.diaeten.satz)], dT = 'Diätensatz: auf dem Lohnzettel {0} je Stunde, in deinen Einstellungen {1} je Stunde.'; out.push({ y: y, m: m, kat: 'satz', text: abw1(dT, dA), de: abw1(dT, dA, 1) }); }
      (sm.freiListe || []).forEach(function (x) {
        if (x.modus === 'za' && x.std > 0) out.push({ y: y, m: m, kat: 'firma', fehl: x.std, eur: euroStd(x.std, wmm), text: abw1('Am {0} hat dich die Firma freigestellt ({1} h) und die Stunden vom Zeitausgleich abgezogen.', [fmtShort(x.datum), fh(x.std)]), de: abw1('Am {0} hat dich die Firma freigestellt ({1} h) und die Stunden vom Zeitausgleich abgezogen.', [fmtShort(x.datum), fh(x.std)], 1) });
        if (x.modus === 'unbezahlt' && x.std > 0) out.push({ y: y, m: m, kat: 'firma', fehl: x.std, eur: euroStd(x.std, wmm), text: abw1('Am {0} hat dich die Firma freigestellt ({1} h) und den Tag nicht bezahlt.', [fmtShort(x.datum), fh(x.std)]), de: abw1('Am {0} hat dich die Firma freigestellt ({1} h) und den Tag nicht bezahlt.', [fmtShort(x.datum), fh(x.std)], 1) });
      });
      (sm.betriebListe || []).forEach(function (x) {
        out.push({ y: y, m: m, kat: 'firma', fehl: x.std, eur: euroStd(x.std, wmm), text: abw1('Am {0} war der Betrieb geschlossen ({1} h). Die Firma hat die Stunden vom Zeitausgleich bzw. von den Überstunden abgezogen und nicht als Urlaub oder bezahlte Zeit gerechnet.', [fmtShort(x.datum), fh(x.std)]), de: abw1('Am {0} war der Betrieb geschlossen ({1} h). Die Firma hat die Stunden vom Zeitausgleich bzw. von den Überstunden abgezogen und nicht als Urlaub oder bezahlte Zeit gerechnet.', [fmtShort(x.datum), fh(x.std)], 1) });
      });
      if (data.abgleich[k] && Object.keys(data.abgleich[k]).length) { // alle weiteren Zeilen (Lohn, Diäten, Prämien ...) gegen den Lohnzettel
        var sm2 = abSumme(sm, y, m), le2 = E.lzMitKorr(data.abgleich, k).lz, fx = !!(wmm && +wmm.monatslohn > 0);
        E.abgleich(sm2, le2, false, fx, lzAlles()).forEach(function (q) {
          if (q.key === 'ueber' || q.status === 'info' || q.diff === undefined) return;
          var ein = q.unit === '€' ? function (v) { return eur.format(Math.abs(v)); } : function (v) { return fh(Math.abs(v)) + ' h'; };
          var kat = q.key.indexOf('pr_') === 0 ? 'praemien' : (q.key === 'dStd' || q.key === 'dEuro') ? 'diaeten' : 'stunden';
          if ((q.status === 'weniger' || q.status === 'mehr') && q.diff !== null) out.push({ y: y, m: m, kat: kat, fehl: q.diff < 0 ? -q.diff : 0, eur: q.diff < 0 ? euroZeile(q, wmm) : null, text: abw1('{0}: Aufzeichnung {1}, Lohnzettel {2} (Unterschied {3}).', [abwLab(q.label), ein(q.app), ein(q.lz), (q.diff > 0 ? '+' : '−') + ein(q.diff)]), de: abw1('{0}: Aufzeichnung {1}, Lohnzettel {2} (Unterschied {3}).', [q.label, ein(q.app), ein(q.lz), (q.diff > 0 ? '+' : '−') + ein(q.diff)], 1) });
          else if (q.status === 'offen' && kat === 'praemien' && q.app > 0 && (le2.lohn != null || le2.ueber != null)) out.push({ y: y, m: m, kat: 'praemien', fehl: q.app, eur: q.app, text: abw1('{0}: {1} sind in der Aufzeichnung, auf dem Lohnzettel ist die Zeile nicht eingetragen oder fehlt.', [abwLab(q.label), eur.format(q.app)]), de: abw1('{0}: {1} sind in der Aufzeichnung, auf dem Lohnzettel ist die Zeile nicht eingetragen oder fehlt.', [q.label, eur.format(q.app)], 1) });
        });
      }
      if (r && Math.abs(r.diff) > 0.5) {
        var ew = r.diff < 0 ? euroZeile({ key: 'ueber', diff: r.diff, status: 'weniger', faktor: 'ueber' }, wmm) : null;
        out.push({ y: y, m: m, kat: 'ueber', fehl: r.diff < 0 ? -r.diff : 0, eur: ew, text: abw1('Überstunden: Du hast {0} h aufgeschrieben, auf dem Lohnzettel stehen {1} h (Unterschied {2} h).', [fh(r.app), fh(r.paid + r.konto), (r.diff > 0 ? '+' : '−') + fh(Math.abs(r.diff))]) + (r.diff < 0 && sw > 0 && Math.abs(Math.abs(r.diff) - sw) < 0.02 ? abw1(' Der Unterschied ist genau so groß wie deine Ausfallstunden ({0} h): Die Firma hat sie offenbar mit den Überstunden verrechnet.', [fh(sw)]) : ''), de: abw1('Überstunden: Du hast {0} h aufgeschrieben, auf dem Lohnzettel stehen {1} h (Unterschied {2} h).', [fh(r.app), fh(r.paid + r.konto), (r.diff > 0 ? '+' : '−') + fh(Math.abs(r.diff))], 1) + (r.diff < 0 && sw > 0 && Math.abs(Math.abs(r.diff) - sw) < 0.02 ? abw1(' Der Unterschied ist genau so groß wie deine Ausfallstunden ({0} h): Die Firma hat sie offenbar mit den Überstunden verrechnet.', [fh(sw)], 1) : '') });
      }
    });
    ((data.profil && data.profil.sonder) || []).forEach(function (sz) {
      var an = E.sonderAnteil(data.profil.eintritt, +sz.jahr), soll = E.sonderSoll(sz.voll, an);
      if (soll !== null && hasN(sz.ist) && +sz.ist - soll < -0.5) { var art = (SND_ART.filter(function (x) { return x[0] === sz.art; })[0] || [0, 'Sonderzahlung'])[1]; out.push({ y: +sz.jahr, m: 12, kat: 'sonder', fehl: soll - +sz.ist, eur: soll - +sz.ist, text: abw1('{0} {1}: laut Vertrag {2}, auf dem Lohnzettel {3} (es fehlen {4}).', [abwLab(art), sz.jahr, eur.format(soll), eur.format(+sz.ist), eur.format(soll - +sz.ist)]), de: abw1('{0} {1}: laut Vertrag {2}, auf dem Lohnzettel {3} (es fehlen {4}).', [art, sz.jahr, eur.format(soll), eur.format(+sz.ist), eur.format(soll - +sz.ist)], 1) }); }
    });
    return out;
  }
  // Zusammenfassung in Zahlen: was dir gegenüber deiner Aufzeichnung fehlt (nur Minus-Abweichungen). Sätze bewusst einzeln und ohne Zusammenbau, damit sie übersetzt werden können.
  function abwSumme(l) {
    var t = { diaeten: 0, stunden: 0, ueber: 0, sonder: 0, eur: 0, firma: 0, firmaTage: 0, firmaEur: 0, praem: {}, ohneEuro: false };
    l.forEach(function (x) {
      if (!(x.fehl > 0)) return;
      if (x.kat === 'firma') { t.firma += x.fehl; t.firmaTage++; if (x.eur != null) t.firmaEur += x.eur; return; }
      if (x.kat === 'praemien') { var n = (x.de || x.text).split(':')[0]; n = abwLab(n); t.praem[n] = (t.praem[n] || 0) + x.fehl; } else if (x.kat === 'sonder') t.sonder += x.fehl; else if (x.kat === 'diaeten') t.diaeten += x.fehl; else if (x.kat === 'ueber') t.ueber += x.fehl; else t.stunden += x.fehl;
      if (x.eur != null) t.eur += x.eur; else if (x.kat !== 'praemien' && x.kat !== 'sonder') t.ohneEuro = true;
    });
    return t;
  }
  function abwSummeZeilen(l) {
    var t = abwSumme(l), z = [];
    if (t.diaeten > 0) z.push(['Diäten', fh(t.diaeten) + ' h', 'diaeten']);
    Object.keys(t.praem).forEach(function (n) { z.push([n, eur.format(t.praem[n]), 'praemien']); });
    if (t.sonder > 0) z.push(['Sonderzahlungen', eur.format(t.sonder), 'sonder']);
    if (t.stunden > 0) z.push(['Stunden', fh(t.stunden) + ' h', 'stunden']);
    if (t.ueber > 0) z.push(['Überstunden', fh(t.ueber) + ' h', 'ueber']);
    if (z.length) z.push(['Summe der Differenzen in Euro (geschätzt)', eur.format(t.eur) + (t.ohneEuro ? ' (ohne Posten ohne Stundenlohn)' : ''), '']);
    return z;
  }
  // Zwei Blöcke, überall gleich: A = Aufzeichnung gegen Lohnzettel, B = Handhabung der Firma gegen Kollektivvertrag und Gesetz
  var ABW_A = 'Aufzeichnung gegen Lohnzettel', ABW_B = 'Handhabung der Firma gegen Kollektivvertrag und Gesetz', ABW_BV = 'Schätzung aus deinen Eingaben und Einstellungen, unter Vorbehalt. Prüfe bitte auch deine Eingaben.';
  function abwIstB(x) { return x.kat === 'firma' || x.kat === 'kvref'; }
  function abwEuroPm(d) { return (d > 0 ? '+' : d < 0 ? '−' : '') + eur.format(Math.abs(d)); }
  function abwKvZeilen(l, lab) {
    var sum = {}, tot = 0, hat = false, z = [], t = abwSumme(l);
    l.forEach(function (x) { if (x.kat !== 'kvref') return; hat = true; tot += x.kvDiff; (x.teile || []).forEach(function (p) { sum[p.key] = (sum[p.key] || 0) + p.delta; }); });
    if (t.firma > 0) z.push([lab('Stunden, die die Firma abgezogen hat (nicht bezahlt, nicht als Urlaub gerechnet)'), fh(t.firma) + ' h', 'kvref']);
    Object.keys(KV_GRUND).forEach(function (k) { if (sum[k] != null && Math.abs(sum[k]) >= 0.5) z.push([lab(KV_GRUND[k]), abwEuroPm(Math.round(sum[k] * 100) / 100), 'kvref']); });
    if (hat) z.push([lab('Unterschied gesamt: nach Kollektivvertrag und Gesetz gegenüber der Handhabung der Firma'), abwEuroPm(Math.round(tot * 100) / 100), 'kvref']);
    return z;
  }
  function abwSummeText(l) {
    var z = abwSummeZeilen(l), k = abwKvZeilen(l, function (x) { return x; });
    return (z.length ? ABW_A + '\nBislang fehlen mir gegenüber meinen Aufzeichnungen:\n' + z.map(function (r) { return '- ' + r[0] + ': ' + r[1]; }).join('\n') + '\n\n' : '') +
      (k.length ? ABW_B + '\n(' + ABW_BV + ')\n' + k.map(function (r) { return '- ' + r[0] + ': ' + r[1]; }).join('\n') + '\n\n' : '');
  }
  function abwListeText(l) {
    var a = l.filter(function (x) { return !abwIstB(x); }), b = l.filter(abwIstB), f = function (x) { return MON[x.m - 1] + ' ' + x.y + ': ' + (x.de || x.text); };
    return (a.length ? ABW_A + ':\n' + a.map(f).join('\n') + '\n\n' : '') + (b.length ? ABW_B + ':\n' + b.map(f).join('\n') + '\n' : '');
  }
  function abwSummeHtml(l) {
    var z = abwSummeZeilen(l), k = abwKvZeilen(l, abwLab); if (!z.length && !k.length) return '';
    function tr(r) { return '<tr' + (r[2] ? ' class="abwk" data-abw="' + r[2] + '"' : '') + '><td>' + esc(r[0]) + '</td><td class="no">' + esc(r[1]) + '</td></tr>'; }
    return (z.length ? '<div class="notice warn" style="margin-bottom:10px"><strong>' + esc(abwLab(ABW_A)) + '</strong><p style="margin:4px 0 0">Bislang fehlen dir gegenüber deinen Aufzeichnungen:</p><table class="cmp" style="margin-top:6px"><tbody>' + z.map(tr).join('') + '</tbody></table></div>' : '') +
      (k.length ? '<div class="notice kvb" style="margin-bottom:10px"><strong>' + esc(abwLab(ABW_B)) + '</strong><p class="hint" style="margin:4px 0 0">' + esc(abwLab(ABW_BV)) + '</p><table class="cmp" style="margin-top:6px"><tbody>' + k.map(tr).join('') + '</tbody></table></div>' : '');
  }
  function abwListeHtml(l) {
    var a = l.filter(function (x) { return !abwIstB(x); }), b = l.filter(abwIstB), li = function (x) { return '<li data-abw="' + (abwIstB(x) ? 'kvref' : x.kat) + '"><b>' + monKurz(x.y, x.m) + ':</b> ' + esc(x.text) + '</li>'; };
    return (a.length ? '<p class="abwh">' + esc(abwLab(ABW_A)) + '</p><ul class="rot" style="margin:0;padding-left:20px">' + a.map(li).join('') + '</ul>' : '') +
      (b.length ? '<p class="abwh">' + esc(abwLab(ABW_B)) + '</p><ul class="kvl" style="margin:0;padding-left:20px">' + b.map(li).join('') + '</ul>' : '');
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
    renderAbBrutto();
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
      else normal = (s.normalStd || 0) + (s.feiertagStd || 0) + (s.urlaubStd || 0) + (s.krankStd || 0) + (s.pflegeStd || 0) + (s.sonderStd || 0);
      if (hasN(lz.ueber)) ueber = +lz.ueber + (hasN(lz.zaKonto) ? E.zaUeber(+lz.zaKonto, s.zaUmr) : 0); else ueber = Math.max(0, s.ueberStd || 0);
      out.push({ monat: k, normalStd: normal, ueberStd: ueber, alt: hasN(lz.satz) ? +lz.satz : (hasN(e.alt) ? +e.alt : 0), neu: hasN(e.neu) ? +e.neu : 0 });
    });
    return out;
  }
  function bruttoSchaetzung() {
    var wm = wAt(ui.y + '-' + (ui.m < 10 ? '0' : '') + ui.m + '-01'), bv = ui.summe ? E.bruttoVorschau(ui.summe, wm, false) : null;
    return bv && bv.ok ? bv.brutto : null;
  }
  function renderAbBrutto() {
    var el = $('#ab-bruttowrap'); if (!el) return;
    var est = bruttoSchaetzung(); if (est === null) { el.innerHTML = ''; return; }
    var v = (data.abgleich[monthKey()] || {}).brutto;
    el.innerHTML = '<div class="abrow"><label class="what" for="ab-brutto">Brutto laut Lohnzettel (optional)</label>' +
      '<button type="button" class="info" id="ab-brutto-info" aria-label="Info"></button>' +
      '<div class="abline"><div class="abin"><input type="number" id="ab-brutto" inputmode="decimal" step="0.01" value="' + (v == null ? '' : esc(v)) + '" placeholder="vom Lohnzettel"><span>€</span></div>' +
      '<div class="abapp">Deine Aufzeichnung<br><b>' + eur.format(est) + '</b></div><span class="chip" id="ab-brutto-chip"></span></div></div>';
    var bi = $('#ab-brutto-info'); if (bi) { var bs = document.createElement('small'); bs.hidden = true; bs.textContent = 'Die Summe „Brutto“ auf dem Lohnzettel. Die App vergleicht sie mit ihrer Schätzung für den ganzen Monat. Sonderzahlungen, Nachzahlungen und Schlechtwetter-Entschädigung sind in der Schätzung nicht enthalten, ein Unterschied kann also einen guten Grund haben.'; bi._sm = bs; }
    paintBrutto();
  }
  function statBrutto() {
    var est = bruttoSchaetzung(), v = (data.abgleich[monthKey()] || {}).brutto; if (est === null || v == null) return [];
    var d = Math.round((v - est) * 100) / 100, a = Math.abs(d);
    return [{ z: 'brutto', s: a <= 0.5 ? 'gleich' : d < 0 ? 'weniger' : 'mehr', d: Math.round(d), e: 1 }];
  }
  function paintBrutto() {
    var chip = $('#ab-brutto-chip'); if (!chip) return;
    var est = bruttoSchaetzung(), v = (data.abgleich[monthKey()] || {}).brutto;
    if (est === null || v == null) { chip.className = 'chip'; chip.textContent = ''; return; }
    var d = Math.round((v - est) * 100) / 100;
    if (Math.abs(d) <= 0.5) { chip.className = 'chip good'; chip.textContent = 'Passt'; }
    else { chip.className = 'chip warn'; chip.innerHTML = '<span>Unterschied</span> <b>' + (d > 0 ? '+' : '−') + eur.format(Math.abs(d)) + '</b>'; }
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
      Object.keys(fm).forEach(function (k) { how.push('<li' + (k === 'za' || k === 'unbezahlt' ? ' class="rot"' : '') + '><span>' + esc(MT[k] || MT.offen) + '</span>: <b>' + fh(fm[k]) + '</b> h' + (k === 'za' || k === 'unbezahlt' ? ' <span>Wird als Abweichung festgehalten.</span>' : '') + '</li>'); });
    }
    kvTexte(ui.y, ui.m, sm, wAt(E.iso(ui.y, ui.m, 1))).forEach(function (x) { how.push('<li>' + esc(x.text) + '</li>'); });
    if (sm.zaUmr && sm.zaUmr !== 'offen') {
      var ZT = { offen: 'Weiß ich noch nicht', eingerechnet: '1 Überstunde = 1,5 Stunden Zeitausgleich (Zuschlag ist drin)', getrennt: '1 Überstunde = 1 Stunde Zeitausgleich, der Zuschlag wird ausbezahlt', ohne: '1 Überstunde = 1 Stunde Zeitausgleich, der Zuschlag wird nicht bezahlt' };
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
      (todo.length ? '<ul class="rot" style="margin:0;padding-left:20px">' + todo.join('') + '</ul>' : '<p style="margin:0"><span>Nichts zu klären. Alles stimmt mit deiner Aufzeichnung überein.</span></p>') + '</div>';
  }
  function paintAbgleich() {
    paintBrutto();
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
      if (eu.summe !== 0) html += '<p style="margin-top:8px"><strong>' + (eu.summe > 0 ? 'Mögliche Differenz zu deinen Ungunsten: ungefähr ' : 'Auf dem Lohnzettel ist mehr bezahlt als bei dir: ungefähr ') + eur.format(Math.abs(eu.summe)) + ' brutto.</strong> Grobe Schätzung mit deinem Stundenlohn (' + eur.format(+wm.stundenlohn) + ') aus den Einstellungen.</p>';
      else if (eu.fehltStundenlohn) html += '<p style="margin-top:8px">Trage in den Einstellungen deinen Stundenlohn ein, dann zeigt die App hier auch, was der Unterschied in Euro wert ist.</p>';
      var keys = ['lohn', 'ueber', 'feiertag', 'urlaub', 'krank', 'pflege', 'sonder'], sumApp = 0, sumLz = 0, ok = lz.lohn != null && lz.ueber != null;
      rows.forEach(function (r) { if (keys.indexOf(r.key) >= 0) { sumApp += r.app; sumLz += (r.lz == null ? 0 : r.lz); } });
      var rl = rows.filter(function (r) { return r.key === 'lohn'; })[0], ru = rows.filter(function (r) { return r.key === 'ueber'; })[0];
      if (rl && ru && (rl.status === 'gleich' || rl.status === 'klein') && (ru.status === 'weniger' || ru.status === 'mehr')) html += '<p style="margin-top:8px">' + (ru.status === 'weniger' ? 'Deine normalen Stunden stimmen. Nur bei den Überstunden steht auf dem Lohnzettel weniger. Mögliche Gründe: Die Stunden werden erst im Folgemonat abgerechnet, sie wurden als Zeitausgleich gutgeschrieben, sie sind in einer Überstundenpauschale enthalten oder sie wurden nicht bezahlt. Frag im Büro nach dieser Zeile.' : 'Deine normalen Stunden stimmen. Nur bei den Überstunden steht auf dem Lohnzettel mehr. Mögliche Gründe: Überstunden aus dem Vormonat wurden nachgezahlt, deine Firma zählt Überstunden anders (zum Beispiel pro Woche statt pro Tag) oder es ist eine Pauschale eingerechnet. Frag im Büro nach dieser Zeile.') + '</p>';
      if (ok && Math.abs(sumApp - sumLz) < 0.005) html += '<p style="margin-top:8px">Die Gesamtstunden passen. Nur die Aufteilung auf die Zeilen ist anders.</p>';
      var ausEr = !!(ru && !E.istBau(wm) && ru.diff < 0 && ui.summe && ui.summe.swStd > 0 && Math.abs(Math.abs(ru.diff) - ui.summe.swStd) < 0.02);
      if (!ausEr) html += '<p style="margin-top:8px">Prüfe zuerst: Sind alle Tage und Pausen richtig eingetragen? Gibt es Zeitausgleich, oder rechnet deine Firma manche Stunden erst im Folgemonat ab? Passen Zuschläge und die Zählweise der Überstunden in den Einstellungen? Bleibt der Unterschied, frage mit deiner Aufzeichnung im Büro nach. Die App ersetzt keine Rechtsberatung.</p></div>';
    }
    if (given && !E.istBau(wm) && ui.summe && ui.summe.swStd > 0 && lz.zaKonto != null && +lz.zaKonto < 0) html += '<div class="notice warn"><strong>Ausfallstunden und Zeitausgleich.</strong> In diesem Monat hast du ' + fh(ui.summe.swStd) + ' Ausfallstunden aufgeschrieben, und dein Zeitausgleich-Konto ist gesunken. Wenn dich die Firma wegen Wetter oder fehlender Arbeit heimgeschickt hat, trägt sie nach § 1155 ABGB grundsätzlich das Risiko, und Zeitausgleich muss in der Regel vereinbart sein. Das hängt vom Einzelfall und vom Kollektivvertrag ab, deshalb ist das ein Hinweis und keine Rechtsberatung. Frag bei Betriebsrat, Gewerkschaft (vida) oder Arbeiterkammer nach.</div>';
    (function () { var ru2 = rows.filter(function (r) { return r.key === 'ueber'; })[0]; if (given && !E.istBau(wm) && ru2 && ru2.diff < 0 && ui.summe && ui.summe.swStd > 0 && Math.abs(Math.abs(ru2.diff) - ui.summe.swStd) < 0.02) html += '<div class="notice warn"><strong>Ausfallstunden.</strong> Der Unterschied bei den Überstunden ist genau so groß wie deine Ausfallstunden in diesem Monat. Deine Firma hat diese Stunden offenbar nicht zusätzlich bezahlt, sondern mit den Überstunden verrechnet. Die Ausfallstunden bleiben in deiner Aufzeichnung stehen. Die Differenz bleibt als Abweichung stehen. Wenn du das nicht wusstest, frag bei Betriebsrat oder Arbeiterkammer nach.</div>'; })();
    if (lz.gelesen) html = '<div class="notice warn"><strong>Vom Lohnzettel eingelesen.</strong> Beim Lesen können Fehler passieren. Bitte vergleiche die Zahlen mit deinem Lohnzettel, bevor du dich darauf verlässt.</div>' + html;
    if (hasN(lz.dSatz) && wm && wm.diaeten && wm.diaeten.modell === 'stunde' && Math.abs(+lz.dSatz - +wm.diaeten.satz) > 0.004) html += '<div class="notice warn">' + esc(abw1('Der Diätensatz auf dem Lohnzettel ({0} je Stunde) ist anders als in deinen Einstellungen ({1} je Stunde). Prüfe, welcher stimmt.', [eur.format(+lz.dSatz), eur.format(+wm.diaeten.satz)])) + '</div>';
    if (hasN(lz.satz) && wm && hasN(wm.stundenlohn) && Math.abs(+lz.satz - +wm.stundenlohn) > 0.004 && !fixLohn()) html += '<div class="notice warn"><strong>Der Stundenlohn auf dem Lohnzettel ist anders als in deinen Einstellungen.</strong><br>Lohnzettel: ' + eur.format(+lz.satz) + ' · Einstellungen: ' + eur.format(+wm.stundenlohn) + '<br>Wurde das später aufgerollt? Dann trage es bei „Nachzahlungen und Korrekturen“ ein.</div>';
    $('#ab-result').innerHTML = html;
    abBericht(rows, given, lz, bad);
    var kz = $('#ab-korr'); if (kz && !kz.contains(document.activeElement) && kz.querySelector('.rg')) renderAbKorr();
    if (given) { ins('abgleich_geprueft'); try { if (window.StundenInsights && !(ui.y > new Date().getFullYear() || (ui.y === new Date().getFullYear() && ui.m >= new Date().getMonth() + 1))) window.StundenInsights.statistik(monthKey(), rows.filter(function (r) { return r.status !== 'offen' && r.status !== 'info'; }).map(function (r) { return { z: r.key.indexOf('pr_') === 0 ? 'praemie' : r.key, s: r.status, d: r.diff == null ? null : Math.round(r.diff * 2) / 2, e: r.unit === '€' ? 1 : 0 }; }).concat(statBrutto())); } catch (e) {} }
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
  function renderStdKartei() {
    var box = $('#k-std'); if (!box) return;
    var y = ui.y, now0 = new Date(), ur = {}, rows = [], m;
    ueberRows().forEach(function (r) { ur[r.y + '-' + r.m] = r; });
    for (m = 1; m <= 12; m++) {
      var fertig = y < now0.getFullYear() || (y === now0.getFullYear() && m < now0.getMonth() + 1), sm = null;
      if (!fertig) continue;
      try { sm = E.calcMonth(data, y, m, todayISO(), { ohneSpaeter: true }).summe; } catch (e) { }
      var pre = y + '-' + (m < 10 ? '0' : '') + m + '-';
      if (!sm || !Object.keys(data.days).some(function (k) { return k.indexOf(pre) === 0; })) continue;
      var r = ur[y + '-' + m];
      rows.push({ m: m, app: Math.round((sm.ueberStd || 0) * 100) / 100, lz: r ? Math.round((r.paid + r.konto) * 100) / 100 : null, diff: r ? r.diff : null });
    }
    box.parentNode.hidden = !rows.length;
    function sg(x) { return (x > 0 ? '+' : x < 0 ? '−' : '') + fh(Math.abs(x)); }
    var abw = rows.filter(function (r) { return r.diff != null && Math.abs(r.diff) > 0.5; }), passt = rows.filter(function (r) { return r.diff != null && Math.abs(r.diff) <= 0.5; }).length, ohne = rows.filter(function (r) { return r.diff == null; }).length;
    box.innerHTML = rows.length ? (abw.length ? '<table class="cmp"><thead><tr><th>Monat</th><th>Aufgezeichnet</th><th>Laut Lohnzettel</th><th>Unterschied</th></tr></thead><tbody>' + abw.map(function (r) {
      return '<tr><td>' + monKurz(y, r.m) + '</td><td>' + sg(r.app) + ' h</td><td>' + fh(r.lz) + ' h</td><td><span class="no">' + sg(r.diff) + ' h</span></td></tr>';
    }).join('') + '</tbody></table>' : (passt ? '<p class="hint"><span class="ok">✓</span> <span>Keine Abweichung zum Lohnzettel</span></p>' : '')) +
      (passt ? '<p class="sub"><span>Monate ohne Abweichung</span> ' + passt + '</p>' : '') + (ohne ? '<p class="sub"><span>Monate ohne Lohnzettel-Eingabe</span> ' + ohne + '</p>' : '') : '';
    var si = $('#sk-info'); if (si) { var ss = document.createElement('small'); ss.hidden = true; ss.textContent = 'Aufgezeichnet: deine Plus- und Minusstunden im Monat laut deiner Aufzeichnung. Laut Lohnzettel: ausbezahlte Überstunden plus aufs Zeitausgleich-Konto gebuchte Stunden. Unterschied: so viele Stunden fehlen oder sind zu viel. Das Häkchen heißt: Aufzeichnung und Lohnzettel stimmen überein. Ohne Lohnzettel-Eingabe steht ein Strich.'; si._sm = ss; }
  }
  function renderBruttoJahr() {
    var box = $('#k-brutto-chart'), card = $('#k-brutto'); if (!box || !card) return;
    var y = ui.y, now0 = new Date(), rows = [], mx = 0, i;
    for (i = 1; i <= 12; i++) {
      var fertig = y < now0.getFullYear() || (y === now0.getFullYear() && i < now0.getMonth() + 1), est = null, lz = null;
      if (fertig) {
        try {
          var sm = E.calcMonth(data, y, i, todayISO(), { ohneSpaeter: true }).summe, bv = sm && sm.istStd ? E.bruttoVorschau(sm, wAt(y + '-' + (i < 10 ? '0' : '') + i + '-01'), false) : null;
          if (bv && bv.ok) est = bv.brutto;
        } catch (e) { }
        var z = (data.abgleich[y + '-' + (i < 10 ? '0' : '') + i] || {}).brutto; if (z != null && z !== '' && !isNaN(+z)) lz = +z;
      }
      rows.push({ est: est, lz: lz }); mx = Math.max(mx, est || 0, lz || 0);
    }
    if (!mx) { card.hidden = true; return; }
    card.hidden = false;
    var W = 340, H = 150, bw = 10, g = (W - 12 * 2 * bw) / 13, o = '<svg viewBox="0 0 ' + W + ' ' + (H + 22) + '" role="img" aria-label="' + y + '">';
    rows.forEach(function (r, k) {
      var bx = g + k * (2 * bw + g);
      [['jb', r.est, 0], ['jb jl', r.lz, bw]].forEach(function (s2) {
        if (s2[1] == null) return; var bh = Math.max(2, Math.round(s2[1] / mx * (H - 18)));
        o += '<rect class="' + s2[0] + '" x="' + (bx + s2[2]) + '" y="' + (H - bh) + '" width="' + bw + '" height="' + bh + '" rx="2"/>';
      });
      o += '<text x="' + (bx + bw) + '" y="' + (H + 15) + '">' + (k + 1) + '</text>';
    });
    box.innerHTML = o + '</svg><p class="hint" style="margin-top:4px">' + rows.map(function (r, k) { return r.est == null ? '' : (k + 1) + ': ' + eur.format(r.est) + (r.lz != null ? ' / ' + eur.format(r.lz) : ''); }).filter(Boolean).join(' · ') + '</p>';
    var kb = $('#kb-info'); if (kb) { var ks = document.createElement('small'); ks.hidden = true; ks.textContent = 'Blau: Schätzung der App für abgeschlossene Monate. Grün: das Brutto, das du vom Lohnzettel eingetragen hast. So siehst du, wie nah die Schätzung liegt. Sonderzahlungen und Nachzahlungen sind in der Schätzung nicht enthalten.'; kb._sm = ks; }
  }
  /* ---- Freie Tage planen (Brückentage): wenige Urlaubs-/ZA-Tage, viele freie Tage am Stück ---- */
  function planerBerechne(y) {
    var fe = E.feiertage(y), fe2 = E.feiertage(y + 1), start = E.iso(y, 1, 1), n = 0, tage = [];
    for (var d = E.addDays(start, -10); d <= E.iso(y, 12, 31) || n < 12; d = E.addDays(d, 1)) { var wd = E.weekday(d), p = E.parseISO(d); tage.push({ d: d, frei: wd === 0 || wd === 6 || !!((p.y === y ? fe : fe2)[d] || (p.y === y - 1 ? E.feiertage(y - 1)[d] : null)) }); if (d > E.iso(y, 12, 31)) n++; if (tage.length > 400) break; }
    var res = [];
    for (var s = 0; s < tage.length; s++) {
      if (!tage[s].frei || (s > 0 && tage[s - 1].frei)) continue; // Fenster beginnt direkt nach einem Arbeitstag
      var k = 0, lst = [];
      for (var e = s; e < tage.length && e < s + 20; e++) {
        if (!tage[e].frei) { k++; lst.push(tage[e].d); if (k > 6) break; }
        if (tage[e].frei && k >= 1 && k <= 6 && (e + 1 >= tage.length || !tage[e + 1].frei) && tage[e].d >= start && tage[s].d <= E.iso(y, 12, 31)) { var len = e - s + 1; if (k === 1 ? len >= 4 : (len >= k + 4 && len >= 2 * k)) res.push({ von: tage[s].d, bis: tage[e].d, k: k, len: len, tage: lst.slice() }); }
      }
    }
    var bestK = {}; res.sort(function (a, b) { return b.len / b.k - a.len / a.k; });
    var out = [], used = {}; res.forEach(function (r) { if ((bestK[r.k] || 0) >= 3 || out.length >= 8) return; var ov = out.some(function (o) { return !(r.bis < o.von || r.von > o.bis); }); if (ov) return; bestK[r.k] = (bestK[r.k] || 0) + 1; out.push(r); });
    out.sort(function (a, b) { return a.von < b.von ? -1 : 1; });
    return out;
  }
  function plKw(d0) { var p = E.parseISO(d0), d = new Date(Date.UTC(p.y, p.m - 1, p.d)), n = d.getUTCDay() || 7; d.setUTCDate(d.getUTCDate() + 4 - n); var y0 = new Date(Date.UTC(d.getUTCFullYear(), 0, 1)); return Math.ceil(((d - y0) / 86400000 + 1) / 7); }
  function plFt(d0) { return E.feiertage(+d0.slice(0, 4))[d0] || ''; }
  function plKalender(r) {
    var wd0 = (E.weekday(r.von) + 6) % 7, mo = E.addDays(r.von, -wd0), wdE = (E.weekday(r.bis) + 6) % 7, so = E.addDays(r.bis, 6 - wdE);
    var h = '<div class="plkal"><span class="plh plkw">' + esc(abwLab('KW')) + '</span>' + [1, 2, 3, 4, 5, 6, 0].map(function (w) { return '<span class="plh">' + esc(abwLab(WD[w])) + '</span>'; }).join('');
    for (var d = mo; d <= so; d = E.addDays(d, 1)) {
      if (E.weekday(d) === 1) h += '<span class="plkw">' + plKw(d) + '</span>';
      var wd = E.weekday(d), ft = plFt(d), ur = r.tage.indexOf(d) >= 0, p = E.parseISO(d);
      h += '<span class="pld' + (ur ? ' ur' : ft ? ' ft' : (wd === 0 || wd === 6) ? ' we' : '') + (d < r.von || d > r.bis ? ' aus' : '') + '">' + p.d + '.' + p.m + '.</span>';
    }
    return h + '</div>';
  }
  function renderPlaner() {
    var box = $('#pl-liste'), jb = $('#pl-jahre'); if (!box || !jb) return;
    var y0 = +todayISO().slice(0, 4); if (!ui.plJahr) ui.plJahr = y0 + (+todayISO().slice(5, 7) >= 10 ? 1 : 0);
    jb.innerHTML = [y0, y0 + 1, y0 + 2].map(function (y) { return '<button type="button" class="btn wzopt' + (ui.plJahr === y ? ' on' : '') + '" data-plj="' + y + '">' + y + '</button>'; }).join('');
    var l = planerBerechne(ui.plJahr);
    var leg = '<div class="plleg"><span><i style="background:#1e6fd9"></i>' + esc(abwLab('Urlaub oder Zeitausgleich nötig')) + '</span><span><i style="background:#12b886"></i>' + esc(abwLab('Feiertag')) + '</span><span><i style="background:color-mix(in srgb,#12b886 22%,transparent)"></i>' + esc(abwLab('Wochenende')) + '</span></div>';
    box.innerHTML = l.length ? leg + l.map(function (r, i) {
      var fts = []; for (var d = r.von; d <= r.bis; d = E.addDays(d, 1)) { var f = plFt(d); if (f) fts.push(fmtShort(d) + ' ' + abwLab(f)); }
      var st = r.tage.map(function (d) { return data.days[d] ? data.days[d].status : ''; }), alle = st.every(function (x) { return x === 'urlaub' || x === 'za'; }), frei = st.filter(function (x) { return !x; }).length;
      var kn = alle ? '<p class="plok">✓ ' + esc(abwLab('Schon eingetragen')) + '</p>'
        : ui.plOffen === i ? '<div class="btns"><button type="button" class="btn primary" data-plgo="urlaub" data-pli="' + i + '">' + esc(abwLab('Als Urlaub eintragen')) + '</button><button type="button" class="btn primary" data-plgo="za" data-pli="' + i + '">' + esc(abwLab('Als Zeitausgleich eintragen')) + '</button><button type="button" class="btn" data-plx="1">' + esc(abwLab('Abbrechen')) + '</button></div>'
        : frei ? '<div class="btns"><button type="button" class="btn" data-plauf="' + i + '">' + esc(frei === 1 ? abwLab('Diesen Tag eintragen') : abwLab('Diese Tage eintragen')) + '</button></div>' : '';
      return '<div class="plrow"><b>' + esc(abw1('{0} Tage frei am Stück: {1} bis {2}', [r.len, fmtShort(r.von), fmtShort(r.bis)])) + '</b><span class="pltx">' + esc(r.k === 1 ? abw1('Du brauchst dafür 1 Tag Urlaub oder Zeitausgleich: {0}', [r.tage.map(fmtShort).join(', ')]) : abw1('Du brauchst dafür {0} Tage Urlaub oder Zeitausgleich: {1}', [r.k, r.tage.map(fmtShort).join(', ')])) + '</span>' +
        plKalender(r) + (fts.length ? '<p class="plft">' + esc(abw1('Feiertage in dieser Zeit: {0}', [fts.join(', ')])) + '</p>' : '') + kn + '</div>';
    }).join('') : '<p class="hint">Keine Vorschläge für dieses Jahr.</p>';
  }
  (function () {
    var jb = $('#pl-jahre'); if (jb) jb.addEventListener('click', function (ev) { var b = ev.target.closest('[data-plj]'); if (!b) return; ui.plJahr = +b.dataset.plj; ui.plOffen = null; renderPlaner(); });
    var dt = $('#pl-det'); if (dt) dt.addEventListener('toggle', function () { if (dt.open) renderPlaner(); });
    var li = $('#pl-liste'); if (li) li.addEventListener('click', function (ev) {
      var a = ev.target.closest('[data-plauf]'), x = ev.target.closest('[data-plx]'), g = ev.target.closest('[data-plgo]');
      if (a) { ui.plOffen = +a.dataset.plauf; renderPlaner(); return; }
      if (x) { ui.plOffen = null; renderPlaner(); return; }
      if (!g) return;
      var r = planerBerechne(ui.plJahr)[+g.dataset.pli]; if (!r) return;
      var n = 0, schon = 0; r.tage.forEach(function (d) { if (data.days[d]) { schon++; return; } data.days[d] = { status: g.dataset.plgo, an: { w: 'wunsch', t: AN_TEXT.wunsch, ts: new Date().toISOString() } }; n++; });
      ui.plOffen = null; if (n) { save(); ins('planer_eingetragen'); } renderPlaner();
      toast(abw1(schon ? '{0} Tage eingetragen. {1} Tage waren schon belegt und bleiben unverändert. Kläre die freien Tage noch mit deiner Firma.' : '{0} Tage eingetragen. Kläre die freien Tage noch mit deiner Firma.', [n, schon]), 7000);
    });
  })();
  function renderKonten() {
    renderJahr();
    try { renderBruttoJahr(); } catch (e) { }
    anRender();
    renderMia();
    renderNews();
    var p = data.profil || {};
    var kbl = $('#k-bl'), pkc = E.PAKETE[wAt(todayISO()).paket];
    if (kbl) { $('#k-blwrap').hidden = !(pkc && pkc.land === 'DE'); kbl.innerHTML = '<option value="">Bitte wählen</option>' + Object.keys(E.BUNDESLAENDER).map(function (k) { return '<option value="' + k + '"' + (p.bl === k ? ' selected' : '') + '>' + E.BUNDESLAENDER[k] + '</option>'; }).join(''); }
    $('#k-eintritt').value = p.eintritt || '';
    if (document.activeElement !== $('#k-zahltag')) $('#k-zahltag').value = p.zahltag || '';
    $('#k-urlaubjahr').value = p.urlaubJahr == null ? '' : p.urlaubJahr;
    $('#k-lztag').value = p.lzTag == null ? '' : p.lzTag;
    $('#k-urlaubstart').value = p.urlaubStart == null ? '' : p.urlaubStart;
    $('#k-zastart').value = p.zaStart == null ? '' : p.zaStart;
    $('#k-kmvortag').checked = p.kmVortag !== false;
    try { var kl = $('#k-kmvortag').closest('label'); if (kl) kl.hidden = !E.bausteine(wAt(todayISO())).fahrzeug; } catch (e) { }
    var lk = lastMonthKey(), ly = +lk.slice(0, 4), lm = +lk.slice(5, 7);
    try { renderStdKartei(); } catch (e) { }
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
    $('#k-za').innerHTML = zrows.length ? '<table class="cmp"><thead><tr><th>Monat</th><th>Stunden dazu/weg</th><th>Konto neu</th><th>Konto laut Lohnzettel (End-Saldo)</th></tr></thead><tbody>' +
      zrows.map(function (r) {
        var chk = r.zettel != null ? (Math.abs(r.zettel - r.saldo) < 0.005 ? ' <span class="ok">✓</span>' : ' <span class="no">✗</span>' + (Math.abs(r.zettel - r.ver) < 0.005 && r.ver !== r.saldo ? '<small class="no">Das ist die Veränderung im Monat. Trage den End-Saldo ein.</small>' : '')) : '';
        return '<tr><td>' + monKurz(+r.key.slice(0, 4), +r.key.slice(5, 7)) + '</td><td>' + (r.ver >= 0 ? '+' : '−') + fh(Math.abs(r.ver)) + ' h</td><td><strong>' + fh(r.saldo) + ' h</strong></td><td>' + numIn('kz-' + r.key, r.zettel, 'Stand') + chk + '</td></tr>';
      }).join('') + '</tbody></table>' : '<p class="hint">Noch keine Buchung. Trage im Monatsabgleich die Zeile „Zeitausgleich-Konto“ ein, wenn dein Lohnzettel Zeitausgleich-Stunden zeigt.</p>';
    korrUeberblick(); renderSonder();
    var ji = $('#jahr-info'); if (ji) { var js = document.createElement('small'); js.hidden = true; js.textContent = 'Jede Säule zeigt die Stunden eines Monats. Orange ist der Monat, den du gerade in der Monatsansicht offen hast.'; ji._sm = js; }
    var ui2 = $('#ue-info'); if (ui2) { var us = document.createElement('small'); us.hidden = true; us.textContent = 'Von dir: deine aufgeschriebenen Überstunden. Bezahlt: so viele stehen auf dem Lohnzettel. Konto: so viele wurden aufs Zeitausgleich-Konto gebucht. Unterschied = bezahlt plus Konto minus von dir. Plus (orange): Der Lohnzettel hat mehr als du aufgeschrieben hast. Minus (rot): weniger. Grün: passt.'; ui2._sm = us; }
    // Überstunden im Überblick
    var abw = abwListe();
    $('#k-abw').innerHTML = abw.length ? abwSummeHtml(abw) + abwListeHtml(abw) + '<button type="button" class="btn" id="abw-copy" style="margin-top:10px">Liste kopieren (für die Arbeiterkammer)</button>' : '<p class="hint">Keine Abweichungen festgehalten.</p>';
    var kb = $('#k-abw'); if (kb) kb.onclick = function (ev) { var r = ev.target.closest && ev.target.closest('tr.abwk'); if (!r) return; var k = r.dataset.abw, an = kb.dataset.hl === k; kb.dataset.hl = an ? '' : k; kb.classList.toggle('abwdim', !an); $$('#k-abw [data-abw]').forEach(function (e) { e.classList.toggle('abwhl', !an && e.dataset.abw === k); }); };
    var ac = $('#abw-copy'); if (ac) ac.onclick = function () {
      var txt = 'Abweichungen zwischen meiner Aufzeichnung und dem Lohnzettel\n(Stunden-Checker, Stand ' + fmtDate(todayISO()) + ')\n\n' + abwSummeText(abw) + abwListeText(abw) + '\nDie Liste zeigt nur, was die App aus meinen Eintragungen und Lohnzetteln sieht. Sie ersetzt keine Rechtsberatung.';
      var done = function () { ac.textContent = 'Kopiert'; };
      try { navigator.clipboard.writeText(txt).then(done, function () { window.prompt('Text markieren und kopieren:', txt); }); } catch (e) { window.prompt('Text markieren und kopieren:', txt); }
    };
    var orows = ueberRows();
    $('#k-ueber').innerHTML = orows.length ? '<table class="cmp"><thead><tr><th>Monat</th><th>Von dir</th><th>Bezahlt</th><th>Konto</th><th>Unterschied</th></tr></thead><tbody>' +
      orows.map(function (r) {
        var cls = Math.abs(r.diff) <= 0.5 ? 'ok' : (r.diff < 0 ? 'no' : 'warn');
        return '<tr><td>' + monKurz(r.y, r.m) + '</td><td>' + fh(r.app) + '</td><td>' + fh(r.paid) + '</td><td>' + fh(r.konto) + '</td><td class="' + cls + '">' + (r.diff > 0 ? '+' : r.diff < 0 ? '−' : '') + fh(Math.abs(r.diff)) + '</td></tr>';
      }).join('') + '</tbody></table>' : '<p class="hint">Sobald du Lohnzettel-Zeilen im Monatsabgleich einträgst, erscheint hier die Übersicht.</p>';
  }
  function konInput(t) {
    var id = t.id, num = parseFloat(String(t.value).replace(',', '.')), val = (t.value === '' || isNaN(num)) ? null : num;
    if (!data.profil) data.profil = {};
    if (id === 'k-eintritt') { if (t.value === '' || validISO(t.value)) { data.profil.eintritt = t.value || null; delete data.profil.test; save(); renderKonten(); } return true; }
    if (id === 'k-zahltag') { var zt0 = Math.round(num); if (val === null) delete data.profil.zahltag; else if (zt0 >= 1 && zt0 <= 31) data.profil.zahltag = zt0; save(); return true; }
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
    handel_arb: [['Nachtzulage', 'stunde', 'Stunden in der Nacht'], ['Kälte- oder Schmutzzulage', 'monat', 'einmal pro Monat'], ['Vorarbeiterzulage', 'monat', 'einmal pro Monat'], ['Sonn- und Feiertagszuschlag', 'stunde', 'Stunden an Sonn- und Feiertagen'], ['Leistungsprämie', 'monat', 'einmal pro Monat']],
    handel: [['Provision / Umsatzprämie', 'monat', 'einmal pro Monat'], ['Sonn- und Feiertagszuschlag', 'stunde', 'Stunden an Sonn- und Feiertagen'], ['Nachtzuschlag', 'stunde', 'Stunden nach 20 Uhr'], ['Leistungsprämie', 'monat', 'einmal pro Monat']],
    gastro: [['Nachtarbeitszuschlag (0 bis 6 Uhr)', 'stueck', 'begonnene Zeitfenster 0–2, 2–4 und 4–6 Uhr', 9.50], ['Fremdsprachenzulage', 'monat', 'einmal pro Monat', 40], ['Sonn- und Feiertagszuschlag', 'stunde', 'Stunden an Sonn- und Feiertagen'], ['Servicepauschale / Umsatzbeteiligung', 'monat', 'einmal pro Monat'], ['Schmutzzulage', 'tag', 'Einsatztage']],
    de_spedition: [['Übernachtung im Lkw (Pauschale)', 'tag', 'Nächte im Lkw', 9], ['Nachtzuschlag', 'stunde', 'Stunden zwischen 22 und 6 Uhr'], ['Leistungsprämie', 'monat', 'einmal pro Monat']],
    de_logistik_sn: [['Nachtzuschlag', 'stunde', 'Stunden zwischen 22 und 6 Uhr'], ['Leistungsprämie', 'monat', 'einmal pro Monat']],
    de_spedition_sonst: [['Nachtzuschlag', 'stunde', 'Stunden zwischen 22 und 6 Uhr'], ['Leistungsprämie', 'monat', 'einmal pro Monat']],
    de_spedition_by: [['Betriebszugehörigkeitszulage', 'monat', 'einmal pro Monat, 80, 100 oder 110 € je nach Dauer im Betrieb'], ['Übernachtung im Lkw (Pauschale)', 'tag', 'Nächte im Lkw', 9], ['Nachtzuschlag', 'stunde', 'Stunden zwischen 22 und 6 Uhr'], ['Leistungsprämie', 'monat', 'einmal pro Monat']],
    de_spedition_nrw: [['Nachtschicht Fernfahrer', 'tag', 'Nachtschichten mit mehr als 2 Stunden Arbeit, Fahrten über 100 km', 5], ['Nachtzuschlag Nahverkehr (25 %)', 'stunde', 'Stunden zwischen 22 und 6 Uhr, Betrag laut Lohnzettel'], ['Übernachtung im Lkw (Pauschale)', 'tag', 'Nächte im Lkw', 9], ['Leistungsprämie', 'monat', 'einmal pro Monat']],
    de_handel: [['Sonn- und Feiertagszuschlag', 'stunde', 'Stunden an Sonn- und Feiertagen'], ['Nachtzuschlag', 'stunde', 'Stunden nach 20 Uhr'], ['Leistungsprämie', 'monat', 'einmal pro Monat']],
    de_gastro: [['Nachtzuschlag', 'stunde', 'Stunden in der Nacht'], ['Sonn- und Feiertagszuschlag', 'stunde', 'Stunden an Sonn- und Feiertagen'], ['Servicepauschale', 'monat', 'einmal pro Monat']],
    bau: [['SEG-Zulage (Schmutz, Erschwernis, Gefahr)', 'stunde', 'Stunden mit erschwerten Bedingungen'], ['Tieflader-Zulage', 'tag', 'Einsatztage mit Tieflader, Betrag laut Lohnzettel'], ['Nächtigungsgeld', 'tag', 'Nächte außer Haus'], ['Leistungsprämie', 'monat', 'einmal pro Monat']]
  };
  PR_VOR.holzbau = [['Aufsichtszulage', 'stunde', 'Stunden mit Aufsicht über mehrere Mitarbeiter'], ['Schmutzzulage (10 %)', 'stunde', 'Stunden mit Schmutzarbeiten'], ['Höhen- und Gefahrenzulage', 'stunde', 'Stunden angeseilt (10 %), auf Türmen ab 16 m (15 %) oder im Gebirge'], ['Taggeld mit Übernachtung', 'tag', 'Arbeitstage mit notwendiger Übernachtung, ab 100 km', 30], ['Übernachtungsgeld', 'tag', 'Kalendertage ohne Quartier vom Betrieb, mit Nachweis', 17.53], ['Lenkzeitvergütung Mannschaftstransporter', 'stunde', 'Stunden am Steuer des Mannschaftstransporters', 15.26], ['Leistungsprämie', 'monat', 'einmal pro Monat']];
  PR_VOR.reinigung = [['Zehrgeld', 'tag', 'Einsatztage außerhalb deiner Gemeinde, mindestens 6 Stunden', 11.71], ['Trennungszulage', 'tag', 'Tage mit notwendiger Übernachtung', 19.67], ['Gefahrenzulage (10 %)', 'stunde', 'Stunden mit gefährlicher Arbeit, zum Beispiel am Seil oder mit Atemschutz'], ['Nachtzuschlag', 'stunde', 'Stunden in der Nacht'], ['Sonn- und Feiertagszuschlag', 'stunde', 'Stunden an Sonn- und Feiertagen'], ['Leistungsprämie', 'monat', 'einmal pro Monat']];
  PR_VOR.baecker = [['Erschwerniszulage Tiefkühlanlage', 'tag', 'Tage mit Arbeit in begehbaren Tiefkühlanlagen, mehr als 2,5 Stunden', 5.71], ['Taggeld Kraftfahrer', 'tag', 'Tage mit Zustellfahrt', 15.79], ['Nachtzuschlag', 'stunde', 'Stunden in der Nacht'], ['Mankogeld', 'monat', 'Zusteller mit Geldverrechnung, laut Vereinbarung'], ['Leistungsprämie', 'monat', 'einmal pro Monat']];
  PR_VOR.konditor = [['Erschwerniszulage Tiefkühlanlage', 'tag', 'Tage mit Arbeit in begehbaren Tiefkühlanlagen, mehr als 1,5 Stunden', 11], ['Nachtzuschlag', 'stunde', 'Stunden in der Nacht'], ['Mankogeld', 'monat', 'Zusteller mit Geldverrechnung, laut Vereinbarung'], ['Leistungsprämie', 'monat', 'einmal pro Monat']];
  ['w', 'st', 'ooe', 'sbg', 'k', 'v', 'b', 't'].forEach(function (k) {
    var z = PR_VOR.konditor.slice();
    z[0] = k === 'w' ? ['Erschwerniszulage Tiefkühlanlage', 'tag', 'Tage mit Arbeit in begehbaren Tiefkühlanlagen, mehr als 2 Stunden', 16] : k === 'b' ? ['Erschwerniszulage Tiefkühlanlage', 'tag', 'Tage mit Arbeit in begehbaren Tiefkühlanlagen, mehr als 1,5 Stunden', 11.29] : ['Erschwerniszulage Tiefkühlanlage', 'tag', 'Tage mit Arbeit in begehbaren Tiefkühlanlagen (Betrag und Mindestdauer laut Lohnordnung)'];
    if (k === 'w') z.splice(1, 0, ['Meisterzuschlag (Meisterprüfung und 5 Jahre Praxis)', 'monat', 'einmal pro Monat', 48]);
    PR_VOR['konditor_' + k] = z;
    PAKET_KURZ['konditor_' + k] = 'Konditorgewerbe';
  });
  [['', [38.21, 57.76, 76.13, 100.49]], ['_t', [40.19, 60.33, 80.48, 103.95]]].forEach(function (x) {
    var z = [10, 15, 20, 25].map(function (j, i) { return ['Dienstalterszulage ab dem ' + j + '. Dienstjahr', 'monat', 'einmal pro Monat', x[1][i]]; });
    z.push(['Zehrgeld, mehr als 6 Stunden Abwesenheit', 'tag', 'Tage mit betriebsbedingter Abwesenheit', 13.38], ['Zehrgeld, mehr als 9 Stunden Abwesenheit', 'tag', 'Tage mit betriebsbedingter Abwesenheit', 23.66], ['Zehrgeld ohne Mittagsmöglichkeit', 'tag', 'Tage ohne Mittagsmöglichkeit im Betrieb', 9.05], ['Nachtzuschlag', 'stunde', 'Stunden in der Nacht'], ['Leistungsprämie', 'monat', 'einmal pro Monat']);
    PR_VOR['fleischer' + x[0]] = z;
  });
  ['w', 'st', 'ooe', 'sbg', 'k', 'v', 'b'].forEach(function (k) { PR_VOR['fleischer_' + k] = PR_VOR.fleischer; });
  ['', '_w', '_st', '_ooe', '_sbg', '_k', '_v', '_b', '_t'].forEach(function (k) { PAKET_KURZ['fleischer' + k] = 'Fleischergewerbe'; });
  PR_VOR.bahn = [['Nachtarbeitszulage', 'stunde', 'Stunden zwischen 22 und 5 Uhr', 4.10], ['Sonn- und Feiertagszulage', 'stunde', 'Stunden an Sonn- und Feiertagen', 7], ['Leistungsprämie', 'monat', 'einmal pro Monat'], ['Zulage Schlafwagen 8C: grenzüberschreitender Einsatz', 'monat', 'einmal pro Monat', 62.71], ['Zulage Schlafwagen 8B: Verantwortung für mehrere Mitarbeiter', 'monat', 'einmal pro Monat', 125.41], ['Zulage Arbeitsunterbrechung (Bordgastronomie)', 'stueck', 'angefangene Viertelstunden über 180 Minuten Unterbrechung', 3.49]];
  PAKET_KURZ.bahn = 'Eisenbahn';
  PR_VOR.rettung_ktn = [['Nachtarbeitszuschlag', 'stunde', 'Stunden zwischen 22 und 6 Uhr', 4.56], ['Sonn- und Feiertagszuschlag', 'stunde', 'Stunden an Sonn- und Feiertagen', 4.73], ['SEW/RTW-Zulage', 'monat', 'einmal pro Monat', 85.12]];
  PR_VOR.rettung_w = [['Erschwerniszulage', 'monat', 'einmal pro Monat', 248.73], ['Gefahrenzulage je Dienst', 'stueck', 'Dienste in der Notfallrettung', 17.13], ['Nacht- und Sonntagszuschlag je Dienst', 'stueck', 'Nacht- oder Sonntagsdienste', 35.76]];
  PR_VOR.rettung_ooe = [['Notfallsanitäter-Zulage', 'monat', 'einmal pro Monat (überwiegend im Rettungsdienst)', 51.65], ['Schmutz-, Erschwernis- und Gefahrenzulage', 'monat', 'einmal pro Monat', 244.28]];
  PR_VOR.rettung_vbg = [['Nachtdienstzulage', 'stueck', 'Nachtdienste (22 bis 6 Uhr)', 89.82], ['Sonn- und Feiertagszuschlag', 'stunde', 'Stunden an Sonn- und Feiertagen', 7.05]];
  ['ktn', 'w', 'ooe', 'vbg'].forEach(function (k) { PAKET_KURZ['rettung_' + k] = 'Rotes Kreuz ' + ({ ktn: 'Kärnten', w: 'Wien', ooe: 'Oberösterreich', vbg: 'Vorarlberg' })[k]; });
  PR_VOR.rettung_noe = [['Notfallsanitäter-Zulage', 'monat', 'einmal pro Monat (überwiegend im Rettungsdienst)', 106.92], ['Leistungsprämie', 'monat', 'einmal pro Monat']];
  PR_VOR.rettung_bgld = [['Notfallsanitäter-Zulage je Dienst', 'stueck', 'Dienste auf NEF oder NAW', 11.36], ['Dienstführendenzulage', 'monat', 'einmal pro Monat', 202.39]];
  PR_VOR.rettung_stmk = [['Notfallsanitäter-Zulage je Dienst', 'stueck', 'Dienste auf NEF oder NAW', 11.00], ['Schmutz-, Erschwernis- und Gefahrenzulage', 'monat', 'einmal pro Monat', 175]];
  PR_VOR.rettung_sbg = [['Erschwerniszulage', 'monat', 'einmal pro Monat (Beschäftigte im Notfalldienst)', 232.74], ['Nachtdienstzulage', 'stueck', 'Nachtdienste (Salzburg-Stadt; übrige Bezirke 38,12 €)', 76.12]];
  PR_VOR.rettung_t = [['Nachtarbeitszuschlag', 'stunde', 'Stunden zwischen 22 und 6 Uhr', 9.45], ['Sonn- und Feiertagszuschlag', 'stunde', 'Stunden an Sonn- und Feiertagen', 6.22], ['Schmutz-, Erschwernis- und Gefahrenzulage', 'monat', 'einmal pro Monat', 253.94]];
  ['noe', 'bgld', 'stmk', 'sbg', 't'].forEach(function (k) { PAKET_KURZ['rettung_' + k] = 'Rotes Kreuz ' + ({ noe: 'Niederösterreich', bgld: 'Burgenland', stmk: 'Steiermark', sbg: 'Salzburg', t: 'Tirol' })[k]; });
  ['noe', 'bgld', 'stmk', 'ktn', 'sbg', 't', 'vbg'].forEach(function (k) { PR_VOR['asb_' + k] = PR_VOR['rettung_' + k]; });
  PR_VOR.asb_w = [['Erschwerniszulage', 'monat', 'einmal pro Monat', 248.74], ['Gefahrenzulage je Dienst', 'stueck', 'Dienste in der Notfallrettung', 17.14], ['Nacht- und Sonntagszuschlag je Dienst', 'stueck', 'Nacht- oder Sonntagsdienste', 35.76]];
  [['w', 'Wien'], ['noe', 'Niederösterreich'], ['bgld', 'Burgenland'], ['stmk', 'Steiermark'], ['ktn', 'Kärnten'], ['sbg', 'Salzburg'], ['t', 'Tirol'], ['vbg', 'Vorarlberg']].forEach(function (x) { PAKET_KURZ['asb_' + x[0]] = 'Samariterbund ' + x[1]; });
  ['w', 'noe', 'bgld', 'ooe', 'stmk', 'ktn', 'sbg', 't', 'vbg'].forEach(function (k) { PR_VOR['kino_' + k] = [['Leistungsprämie', 'monat', 'einmal pro Monat']]; PAKET_KURZ['kino_' + k] = 'Kino ' + ({ w: 'Wien', noe: 'Niederösterreich', bgld: 'Burgenland', ooe: 'Oberösterreich', stmk: 'Steiermark', ktn: 'Kärnten', sbg: 'Salzburg', t: 'Tirol', vbg: 'Vorarlberg' })[k]; });
  PR_VOR.kino_w = [['Fehlgeldentschädigung', 'monat', 'Kassa- und Büffetkräfte, höchstens pro Monat (Einsaalkino 40,95 €)', 50.29], ['Leistungsprämie', 'monat', 'einmal pro Monat']];
  PR_VOR.lm_obst = [['Leistungsprämie', 'monat', 'einmal pro Monat']];
  PR_VOR.lm_getraenke = [['Zehrgeld (Fahrpersonal)', 'tag', 'Tage mit mindestens 6 Stunden Abwesenheit', 22.62], ['Leistungsprämie', 'monat', 'einmal pro Monat']];
  PR_VOR.lm_fleisch = [['Zehrgeld über 6 Stunden', 'tag', 'Tage mit mehr als 6 Stunden auswärts', 13.38], ['Zehrgeld über 9 Stunden', 'tag', 'Tage mit mehr als 9 Stunden auswärts', 23.66], ['Staplerzulage (7,5 %)', 'stunde', 'Stunden auf dem Stapler (7,5 % des Stundenlohns)'], ['Leistungsprämie', 'monat', 'einmal pro Monat']];
  PAKET_KURZ.lm_obst = 'Obst, Gemüse, Tiefkühl'; PAKET_KURZ.lm_getraenke = 'Getränkeerzeugung'; PAKET_KURZ.lm_fleisch = 'Fleischwarenindustrie';
  PAKET_KURZ.taxi_t = 'Taxi Tirol'; PAKET_KURZ.taxi_vbg = 'Taxi Vorarlberg'; PAKET_KURZ.taxi_sbg = 'Taxi Salzburg'; PAKET_KURZ.taxi_stmk = 'Taxi Steiermark'; PAKET_KURZ.textil_t = 'Textilindustrie Tirol'; PAKET_KURZ.textil_vbg = 'Textilindustrie Vorarlberg';
  ['t', 'vbg', 'sbg', 'stmk'].forEach(function (k) { if (PR_VOR.taxi) PR_VOR['taxi_' + k] = PR_VOR.taxi; }); ['t', 'vbg'].forEach(function (k) { if (PR_VOR.textil) PR_VOR['textil_' + k] = PR_VOR.textil; });
  ['wh', 'w', 'c', 'd'].forEach(function (k) { PR_VOR['gastro_ang_' + k] = [['Fremdsprachenzulage', 'monat', 'einmal pro Monat', 40], ['Leistungsprämie', 'monat', 'einmal pro Monat']]; PAKET_KURZ['gastro_ang_' + k] = 'Gastgewerbe (Angestellte)'; });
  PR_VOR.rk_t = [['Schmutzzulage', 'stunde', 'Stunden mit Schmutzarbeit, Prozentsatz des Lohns, Betrag laut Lohnzettel'], ['Außerhauszulage', 'tag', 'Arbeitstage mit auswärtiger Mittagsverpflegung', 12.76], ['Leistungsprämie', 'monat', 'einmal pro Monat']];
  PR_VOR.rk_vbg = [['Schmutzzulage', 'stunde', 'Stunden mit Schmutzarbeit, Prozentsatz des Lohns, Betrag laut Lohnzettel'], ['Leistungsprämie', 'monat', 'einmal pro Monat']];
  PAKET_KURZ.rk_t = 'Rauchfangkehrer Tirol'; PAKET_KURZ.rk_vbg = 'Rauchfangkehrer Vorarlberg';
  ['w', 'wh', 'bgld', 'ooe', 'stmk', 'ktn', 'sbg', 't', 'vbg'].forEach(function (k) { PR_VOR['gastro_' + k] = PR_VOR.gastro; });
  PAKET_KURZ.gastro = 'Gastgewerbe Niederösterreich';  PAKET_KURZ.gastro_bgld = 'Gastgewerbe Burgenland';  PAKET_KURZ.gastro_ooe = 'Gastgewerbe Oberösterreich';  PAKET_KURZ.gastro_stmk = 'Gastgewerbe Steiermark';  PAKET_KURZ.gastro_ktn = 'Gastgewerbe Kärnten';  PAKET_KURZ.gastro_sbg = 'Gastgewerbe Salzburg';  PAKET_KURZ.gastro_t = 'Gastgewerbe Tirol';  PAKET_KURZ.gastro_vbg = 'Gastgewerbe Vorarlberg';  PAKET_KURZ.gastro_w = 'Gastronomie Wien'; PAKET_KURZ.gastro_wh = 'Hotellerie und Kaffeehäuser Wien';
  PR_VOR.kur_reha = [['Nachtdienstzulage', 'tag', 'Nachtdienste mit mehr als 4 Stunden (20 bis 6 Uhr)', 48.56], ['Sonn- und Feiertagszulage', 'tag', 'Sonn- und Feiertagsdienste mit mehr als 4 Stunden', 48.56]];
  PR_VOR.agrar = [['Nachtzulage', 'stunde', 'Stunden von 22 bis 5 Uhr', 3.13], ['Nächtigungsgeld', 'tag', 'Tage mit Nächtigung', 17], ['Leistungsprämie', 'monat', 'einmal pro Monat']];
  PAKET_KURZ.kur_reha = 'Kur und Reha'; PAKET_KURZ.agrar = 'Agrarservice';
  PR_VOR.seilbahn = [['Nächtigungsgebühr', 'tag', 'Nächte im Bergstationsbereich', 41.72], ['Leistungsprämie', 'monat', 'einmal pro Monat']];
  PR_VOR.reisebuero_ang = PR_VOR.immobilien_ang = PR_VOR.ic_ang = PR_VOR.steuerberatung_ang = [['Leistungsprämie', 'monat', 'einmal pro Monat']];
  PAKET_KURZ.seilbahn = 'Seilbahnen'; PAKET_KURZ.reisebuero_ang = 'Reisebüros'; PAKET_KURZ.immobilien_ang = 'Immobilienverwalter'; PAKET_KURZ.ic_ang = 'Information und Consulting'; PAKET_KURZ.steuerberatung_ang = 'Steuerberatung';
  PR_VOR.garage = [['Leistungsprämie', 'monat', 'einmal pro Monat']];
  PR_VOR.kosmetik = [['Leistungsprämie', 'monat', 'einmal pro Monat']];
  PAKET_KURZ.garage = 'Garage/Tankstelle'; PAKET_KURZ.kosmetik = 'Kosmetik/Fußpflege/Massage';
  PR_VOR.bauhilfsgewerbe = [['Schmutzzulage (10 %)', 'stunde', 'Stunden mit Schmutzarbeiten'], ['Erschwerniszulage', 'stunde', 'Stunden mit erschwerten Bedingungen'], ['Partieführerzulage', 'stunde', 'Stunden als Partieführer'], ['Leistungsprämie', 'monat', 'einmal pro Monat']];
  PR_VOR.schaedling = [['Trennungszulage', 'tag', 'Kalendertage ohne tägliche Heimkehr', 20.35], ['Leistungsprämie', 'monat', 'einmal pro Monat']];
  PR_VOR.kunststoff = [['Leistungsprämie', 'monat', 'einmal pro Monat']];
  PAKET_KURZ.bauhilfsgewerbe = 'Bauhilfsgewerbe'; PAKET_KURZ.schaedling = 'Schädlingsbekämpfung'; PAKET_KURZ.kunststoff = 'Kunststoff';
  PR_VOR.rk_noe = [['Schmutzzulage', 'monat', 'einmal pro Monat', 214], ['Leistungsprämie', 'monat', 'einmal pro Monat']];
  PAKET_KURZ.rk_noe = 'Rauchfangkehrer Niederösterreich';
  PR_VOR.rk_w = [['Schmutzzulage', 'stunde', 'Stunden mit Schmutzarbeit, 18 % des Normalstundenlohns, Betrag laut Lohnzettel'], ['Leistungsprämie', 'monat', 'einmal pro Monat']];
  PAKET_KURZ.rk_w = 'Rauchfangkehrer Wien';
  PR_VOR.rk_stmk = [['Schmutzzulage', 'monat', 'einmal pro Monat', 158.05], ['Leistungsprämie', 'monat', 'einmal pro Monat']];
  PAKET_KURZ.rk_stmk = 'Rauchfangkehrer Steiermark';
  PR_VOR.rk_ktn = [['Schmutzzulage', 'monat', 'einmal pro Monat', 153], ['Geschäftsführerzulage (Gewerbeberechtigung)', 'monat', 'einmal pro Monat', 597.25], ['Fahrradpauschale', 'monat', 'einmal pro Monat', 27.31], ['Trennungsgeld', 'tag', 'Kalendertage ohne tägliche Heimkehr'], ['Leistungsprämie', 'monat', 'einmal pro Monat']];
  PAKET_KURZ.rk_ktn = 'Rauchfangkehrer Kärnten';
  PR_VOR.rk_sbg = [['Schmutzzulage', 'monat', 'einmal pro Monat', 373.21], ['Leistungsprämie', 'monat', 'einmal pro Monat']];
  PAKET_KURZ.rk_sbg = 'Rauchfangkehrer Salzburg';
  PR_VOR.rk_bgld = [['Schmutzzulage', 'monat', 'einmal pro Monat', 100], ['Dampfkesselzulage', 'stunde', 'Stunden mit Dampfkesselarbeiten', 6.65], ['Leistungsprämie', 'monat', 'einmal pro Monat']];
  PAKET_KURZ.rk_bgld = 'Rauchfangkehrer Burgenland';
  PR_VOR.rk_ooe = [['Schmutzzulage', 'monat', 'einmal pro Monat', 203.20], ['Erschwerniszulage', 'stunde', 'Stunden an Dampfkesseln, Dampfrauchfängen oder Kanälen, Betrag laut Lohnzettel'], ['Leistungsprämie', 'monat', 'einmal pro Monat']];
  PAKET_KURZ.rk_ooe = 'Rauchfangkehrer Oberösterreich';
  PR_VOR.glaser = [['Dachzulage (Glaser)', 'stunde', 'Stunden auf Glasdächern, Gerüsten oder in Gondeln, Satz je Bundesland'], ['Leistungsprämie', 'monat', 'einmal pro Monat']];
  PR_VOR.tapezierer = [['Leistungsprämie', 'monat', 'einmal pro Monat']];
  PR_VOR.steinmetz = [['Gerüstzulage (7,5 %)', 'stunde', 'Stunden auf Gerüsten ab 4 m Arbeitshöhe, Betrag laut Lohnzettel'], ['Staubzulage (8 %)', 'stunde', 'Stunden mit außerordentlicher Staubentwicklung, Betrag laut Lohnzettel'], ['Leistungsprämie', 'monat', 'einmal pro Monat']];
  PR_VOR.bodenleger = [['Leistungsprämie', 'monat', 'einmal pro Monat']];
  PR_VOR.textilreinigung = [['Außer-Haus-Zulage (10 %)', 'stunde', 'Stunden bei Arbeiten außerhalb der Arbeitsstätte (Teppichreinigung), Betrag laut Lohnzettel'], ['Leistungsprämie', 'monat', 'einmal pro Monat']];
  PAKET_KURZ.glaser = 'Glaser'; PAKET_KURZ.tapezierer = 'Tapezierer'; PAKET_KURZ.steinmetz = 'Steinmetz'; PAKET_KURZ.bodenleger = 'Bodenleger'; PAKET_KURZ.textilreinigung = 'Textilreinigung';
  PR_VOR.zahntechnik = [['Nacht- und Sonntagszulage (Zahntechnik)', 'stunde', 'Stunden zwischen 22 und 6 Uhr und an Sonntagen', 3.82], ['Geschäftsführerzulage (Gewerbeberechtigung)', 'monat', 'einmal pro Monat', 1326.12]];
  PAKET_KURZ.zahntechnik = 'Zahntechnik';
  PR_VOR.ordination_w = [['Gefahrenzulage I (Strahlung)', 'monat', 'einmal pro Monat', 147], ['Infektionszulage', 'monat', 'einmal pro Monat', 125]];
  PAKET_KURZ.ordination_w = 'Arzt-KV W';
  PR_VOR.ordination_sbg = [['Gefahrenzulage I (Strahlung)', 'monat', 'einmal pro Monat', 188], ['Infektionszulage', 'monat', 'einmal pro Monat', 143]];
  PAKET_KURZ.ordination_sbg = 'Arzt-KV SBG';
  PR_VOR.ordination_t = [['Gefahrenzulage I (Strahlung)', 'monat', 'einmal pro Monat', 206], ['Infektionszulage', 'monat', 'einmal pro Monat', 161]];
  PAKET_KURZ.ordination_t = 'Arzt-KV T';
  PR_VOR.ordination_vbg = [['Gefahrenzulage I (Strahlung)', 'monat', 'einmal pro Monat', 143], ['Infektionszulage', 'monat', 'einmal pro Monat', 129]];
  PAKET_KURZ.ordination_vbg = 'Arzt-KV VBG';
  PR_VOR.ordination_ktn = [['Gefahrenzulage I (Strahlung)', 'monat', 'einmal pro Monat', 189.41], ['Infektionszulage', 'monat', 'einmal pro Monat', 148.01]];
  PAKET_KURZ.ordination_ktn = 'Arzt-KV KTN';
  PR_VOR.ordination_ooe = [['Infektionszulage', 'monat', 'einmal pro Monat', 192]];
  PAKET_KURZ.ordination_ooe = 'Arzt-KV OOE';
  PAKET_KURZ.ordination_bgld = 'Arzt-KV BGLD';
  PR_VOR.ordination_stmk = [['Gefahrenzulage I (Strahlung)', 'monat', 'einmal pro Monat', 160], ['Infektionszulage', 'monat', 'einmal pro Monat', 140]];
  PAKET_KURZ.ordination_stmk = 'Arzt-KV STMK';
  PR_VOR.ordination_noe = [['Gefahrenzulage I (Strahlung)', 'monat', 'einmal pro Monat', 146]];
  PAKET_KURZ.ordination_noe = 'Arzt-KV NÖ';
  PR_VOR.post = [['Sonn- und Feiertagszulage (Post)', 'stunde', 'Stunden an Sonn- und Feiertagen', 5.46]];
  PAKET_KURZ.post = 'Post AG';
  PR_VOR.chemie = [['Nachmittagsschichtzulage', 'stunde', 'Stunden in der Nachmittagsschicht', 2.0728], ['Nachtschichtzulage', 'stunde', 'Stunden in der Nachtschicht', 4.1409], ['Vorarbeiterzuschlag', 'monat', 'einmal pro Monat'], ['Leistungsprämie', 'monat', 'einmal pro Monat']];
  PAKET_KURZ.chemie = 'Chemische Industrie';
  PR_VOR.papier = [['Nachtarbeitszulage', 'tag', 'voll geleistete Nachtschichten', 29.74], ['Nachmittagsschichtzulage', 'tag', 'voll geleistete Nachmittagsschichten', 12.33], ['Leistungsprämie', 'monat', 'einmal pro Monat']];
  PAKET_KURZ.papier = 'Papierindustrie';
  PR_VOR.textil = [['Nachtzuschlag', 'stunde', 'Stunden in der Nacht'], ['Leistungsprämie', 'monat', 'einmal pro Monat']];
  PAKET_KURZ.textil = 'Textilindustrie';
  PR_VOR.metall_ind = [['Nachtarbeitszulage', 'stunde', 'Normalstunden von 22 bis 6 Uhr, nicht für Überstunden', 3.754], ['Schichtzulage 2. Schicht', 'stunde', 'Stunden in der 2. Schicht', 1.085], ['Schichtzulage 3. Schicht', 'stunde', 'Stunden in der 3. Schicht', 3.754], ['Schmutz-, Erschwernis- oder Gefahrenzulage', 'stunde', 'Stunden mit erschwerten Bedingungen', 0.741], ['Montagezulage', 'stunde', 'Stunden auf Montage', 1.146], ['Nächtigungsgeld', 'tag', 'Tage mit Nächtigung', 24.41], ['Vorarbeiterzuschlag', 'monat', 'einmal pro Monat'], ['Leistungsprämie', 'monat', 'einmal pro Monat']];
  PAKET_KURZ.metall_ind = 'Metallindustrie';
  PR_VOR.gaertner = [['Übernachtungsgeld', 'tag', 'Tage mit Nächtigung', 17], ['Leistungsprämie', 'monat', 'einmal pro Monat']];
  PAKET_KURZ.gaertner = 'Gärtner';
  PR_VOR.forst = [['Gerätefahrerzulage', 'stunde', 'Stunden an Tagen mit dieser Tätigkeit', 1.85], ['Partieführerzulage', 'stunde', 'Stunden an Tagen mit dieser Tätigkeit', 1.85], ['Motorsägenpauschale (eigene Motorsäge)', 'stueck', 'erzeugte Festmeter', 2.15], ['Nächtigungsgeld', 'tag', 'Tage mit Nächtigung', 17], ['Leistungsprämie', 'monat', 'einmal pro Monat']];
  PAKET_KURZ.forst = 'Forst';
  PR_VOR.autobus = [['Nächtigungsgeld', 'tag', 'Tage mit Nächtigung', 6.26], ['Schichtzulage Nachtschicht (Garage)', 'stunde', 'Stunden in der Nachtschicht', 1.39], ['Nachtzuschlag', 'stunde', 'Stunden in der Nacht'], ['Leistungsprämie', 'monat', 'einmal pro Monat']];
  PR_VOR.autobus_g = PR_VOR.autobus; PAKET_KURZ.autobus = 'Autobus'; PAKET_KURZ.autobus_g = 'Autobus';
  PR_VOR.taxi = [['Umsatzbeteiligung', 'monat', 'einmal pro Monat'], ['Leistungsprämie', 'monat', 'einmal pro Monat']];
  PR_VOR.taxi_b = PR_VOR.taxi; PAKET_KURZ.taxi = 'Taxi'; PAKET_KURZ.taxi_b = 'Taxi';
  PR_VOR.bahn_dbo = [['Sonn- und Feiertagszulage', 'stunde', 'Stunden an Sonn- und Feiertagen', 7], ['Leistungsprämie', 'monat', 'einmal pro Monat']];
  PAKET_KURZ.bahn_dbo = 'Privatbahnen';
  PR_VOR.friseur = [['Haararbeiten-Zulage', 'stunde', 'Stunden mit Tressieren, Knüpfen, Nähen', 2.31], ['Salonleiter-Zulage', 'monat', 'einmal pro Monat, 15 % laut Kollektivvertrag'], ['Ausbilder-Zulage', 'monat', 'einmal pro Monat, 10 % laut Kollektivvertrag'], ['Meister-Zulage', 'monat', 'einmal pro Monat, 10 % laut Kollektivvertrag'], ['Provision / Umsatzbeteiligung', 'monat', 'einmal pro Monat']];
  PR_VOR.bewachung = [['Nachtzulage', 'stunde', 'Stunden in der Nacht', 1.26], ['Erschwerniszulage Revierdienst', 'stunde', 'Stunden im Revierdienst', 0.80], ['Diensthund-Aufwandsersatz', 'tag', 'Schichten mit Diensthund', 18.74], ['Sonn- und Feiertagszuschlag', 'stunde', 'Stunden an Sonn- und Feiertagen'], ['Leistungsprämie', 'monat', 'einmal pro Monat']];
  PR_VOR.sozial = [['Nachtarbeitszuschlag', 'stunde', 'Stunden von 22 bis 6 Uhr', 9.45], ['Rufbereitschaft', 'stunde', 'Stunden in Rufbereitschaft', 4.37], ['Flexibilisierungszuschlag', 'tag', 'Dienste, die kurzfristig geändert wurden', 51.30], ['SEG-Zulage (Schmutz, Erschwernis, Gefahr)', 'stunde', 'Stunden mit erschwerten Bedingungen']];
  PR_VOR.tischler = [['Montagezulage', 'stunde', 'Stunden auf Montage'], ['Taggeld Außerhausarbeit', 'stunde', 'Abwesenheitsstunden bei Außerhausarbeit über 5 Stunden', 2.50], ['Taggeld mit Übernachtung', 'tag', 'Arbeitstage mit notwendiger Übernachtung, ab 100 km', 39], ['Nächtigungsgeld', 'tag', 'Nächte außer Haus', 15], ['Leistungsprämie', 'monat', 'einmal pro Monat']];
  PR_VOR.dachdecker = [['Gefahren- und Erschwerniszulage', 'stunde', 'Stunden auf Türmen, am Fahrstuhl oder im Schnee, Prozentsatz je Bundesland'], ['Schmutzzulage', 'stunde', 'Stunden mit Schmutzarbeiten'], ['Werkzeugzulage', 'stunde', 'Stunden mit eigenem Werkzeug'], ['Trennungsgeld', 'tag', 'Kalendertage ohne tägliche Heimkehr', 30], ['Lenkzeitvergütung Mannschaftstransporter', 'stunde', 'Stunden am Steuer des Mannschaftstransporters', 15.42], ['Leistungsprämie', 'monat', 'einmal pro Monat']];
  PR_VOR.pflasterer = [['Taggeld mit Übernachtung', 'tag', 'Arbeitstage mit notwendiger Übernachtung, ab 100 km', 30], ['Übernachtungsgeld', 'tag', 'Kalendertage ohne Quartier vom Betrieb, mit Nachweis', 17.55], ['Lenkzeitvergütung Mannschaftstransporter', 'stunde', 'Stunden am Steuer des Mannschaftstransporters', 15.42], ['Akkordzuschlag', 'stunde', 'Stunden in Akkordarbeit'], ['Leistungsprämie', 'monat', 'einmal pro Monat']];
  PR_VOR.fliesenleger = [['Helferzulage bei Akkord-Fliesenleger', 'stunde', 'Stunden als Helfer beim Akkord-Fliesenleger'], ['Taggeld mit Übernachtung', 'tag', 'Arbeitstage mit notwendiger Übernachtung', 30], ['Nächtigungsgeld', 'tag', 'Nächte außer Haus', 12], ['Lenkzeitvergütung Mannschaftstransporter', 'stunde', 'Stunden am Steuer des Mannschaftstransporters', 15.31], ['Leistungsprämie', 'monat', 'einmal pro Monat']];
  PR_VOR.maler = [['Schmutz- und Erschwerniszulage (10 % oder 20 %)', 'stunde', 'Stunden mit Erschwernis, zum Beispiel ab 4 m Standhöhe, Betrag laut Lohnzettel'], ['Aufsichtszulage', 'stunde', 'Stunden mit Aufsicht über mehrere Mitarbeiter'], ['Nächtigungsgeld', 'tag', 'Nächte außer Haus', 10], ['Lenkzeitvergütung Mannschaftstransporter', 'stunde', 'Stunden am Steuer des Mannschaftstransporters', 15.42], ['Leistungsprämie', 'monat', 'einmal pro Monat']];
  PR_VOR.metall = [['Montagezulage', 'stunde', 'Stunden auf Montage (mindestens 1,155 € laut KV, nicht für Lehrlinge)', 1.155], ['Nachtarbeitszulage', 'stunde', 'Normalstunden von 22 bis 6 Uhr, nicht für Überstunden', 3.348], ['Schichtzulage 2. Schicht', 'stunde', 'Stunden in der 2. Schicht', 1.065], ['Schichtzulage 3. Schicht', 'stunde', 'Stunden in der 3. Schicht', 3.348], ['Schmutz-, Erschwernis- oder Gefahrenzulage', 'stunde', 'Stunden mit erschwerten Bedingungen', 0.746], ['Entfernungszulage über 6 Stunden', 'tag', 'Einsatztage mit mehr als 6 Stunden Abwesenheit', 11.94], ['Entfernungszulage über 11 Stunden', 'tag', 'Einsatztage mit mehr als 11 Stunden Abwesenheit', 30], ['Entfernungszulage mit Nächtigung', 'tag', 'Einsatztage mit auswärtiger Nächtigung', 62.04], ['Nächtigungsgeld', 'tag', 'Nächte außer Haus', 22.05], ['Leistungsprämie', 'monat', 'einmal pro Monat']];
  /* ---- Bundesland (Arbeitsort): richtiger Kollektivvertrag und Zulagen des Bundeslandes ---- */
  function landAT() { return (data.profil && data.profil.land) || ''; }
  function landOpts(sel) { return '<option value="">Bitte wählen</option>' + Object.keys(E.LAENDER_AT).map(function (k) { return '<option value="' + k + '"' + (sel === k ? ' selected' : '') + '>' + E.LAENDER_AT[k] + '</option>'; }).join(''); }
  function berufHatLand(beruf) { var b = E.BERUFE[beruf]; return !!(b && (b.kvs || []).some(function (k) { return E.kvLand(k); })); }
  function kvPasstLand(paket, l) { var x = E.kvLand(paket); return !x || !l || x.indexOf(l) >= 0; }
  function landSetzen(l) { if (!data.profil) data.profil = {}; if (l) data.profil.land = l; else delete data.profil.land; save(); }
  // Zulagen, die je Bundesland verschieden sind (Quelle: wko.at, Lohnordnungen 2026). p = Prozent des Stundenlohns.
  var GL_DACH = function (b, h) { return ['Dachzulage (Glaser)', 'stunde', h, b]; }, GL_BLEI = function (b) { return ['Bleiglas- und Klebezulage (Glaser)', 'stunde', 'Stunden mit Bleiverglasung oder Klebearbeiten in geschlossenen Räumen', b]; }, GL_MARMOR = ['Marmorglaszulage (Glaser)', 'stunde', 'Stunden mit Marmorglasverlegung', 1.15], LP = ['Leistungsprämie', 'monat', 'einmal pro Monat'];
  var DD_ALLG = [['Trennungsgeld', 'tag', 'Kalendertage ohne tägliche Heimkehr', 30], ['Lenkzeitvergütung Mannschaftstransporter', 'stunde', 'Stunden am Steuer des Mannschaftstransporters', 15.42], LP];
  var FL_AKK = function (p) { return [['Zuschlag für Helfer beim Akkord-Fliesenleger', 'stunde', 'Stunden als Helfer eines Fliesenlegers im Akkord', null, p]].concat(PR_VOR.fliesenleger || [LP]); };
  var PR_VOR_LAND = {
    fliesenleger: { ooe: FL_AKK(18), w: FL_AKK(18), stmk: FL_AKK(13) },
    glaser: { bgld: [GL_DACH(0.61, 'Stunden auf Glasdächern, Gerüsten oder in Gondeln'), LP], ooe: [GL_DACH(0.88, 'Stunden auf Dächern, Gerüsten oder in Gondeln'), GL_BLEI(0.88), LP], sbg: [GL_DACH(0.93, 'Stunden auf Leitergerüsten, Dächern oder in Gondeln'), LP], stmk: [GL_DACH(1.05, 'Stunden mit Dacharbeiten (Glasergeselle)'), GL_MARMOR, LP], t: [GL_DACH(1.05, 'Stunden ab 4 m Höhe'), GL_BLEI(1.05), GL_MARMOR, LP], w: [GL_DACH(1.05, 'Stunden ab 4 m Höhe'), GL_BLEI(1.05), GL_MARMOR, LP], ktn: [LP], noe: [LP], vbg: [LP] },
    dachdecker: {
      ktn: [['Gefahrenzulage Turm- und Fahrstuhlarbeiten', 'stunde', 'Stunden an Türmen oder am Fahrstuhl', null, 40], ['Gefahrenzulage Schneearbeiten', 'stunde', 'Stunden mit Schneearbeiten (Rinnen auseisen, Lawinen abschaufeln)', null, 15], ['Schmutzzulage Schwarzarbeiten', 'stunde', 'Stunden mit Teer, Bitumen oder Dachpappe (10 % des Facharbeiterlohns)', null, 10]].concat(DD_ALLG),
      ooe: [['Erschwerniszulage Turm- und Fahrstuhlarbeiten', 'stunde', 'Stunden an Türmen ohne festes Gerüst oder am Fahrstuhl', null, 40], ['Erschwerniszulage Schneearbeiten', 'stunde', 'Stunden mit Schneearbeiten', null, 15], ['Vorarbeiterzulage', 'stunde', 'Stunden als Vorarbeiter', null, 10], ['Schmutzzulage Schwarzarbeiten', 'stunde', 'Stunden mit Teer, Bitumen oder Dachpappe', null, 10], ['Werkzeugzulage', 'stunde', 'Stunden mit eigenem Ziegel- und Schieferdeckerwerkzeug', null, 2.5]].concat(DD_ALLG),
      t: [['Turm- und Fahrstuhlzulage', 'stunde', 'Stunden an Türmen ohne festes Gerüst oder am Fahrstuhl', null, 30], ['Schmutzzulage Teerarbeiten', 'stunde', 'Stunden mit Teerarbeiten', null, 5], ['Schmutzzulage Umdeckarbeiten', 'stunde', 'Stunden mit Abtragen und Wiedereindecken alter Dächer', null, 10]].concat(DD_ALLG),
      w: [['Schmutz-, Erschwernis- oder Gefahrenzulage', 'stunde', 'Stunden mit starker Verschmutzung, Erschwernis oder Gefahr (nur eine Zulage)', 1.60], ['Partieführerzulage', 'stunde', 'Stunden als Partieführer (mehr als 3 Arbeitnehmer)', null, 5], ['Werkzeugzulage', 'stunde', 'Stunden mit eigenem Ziegel- und Schieferwerkzeug', null, 2.5]].concat(DD_ALLG),
      bgld: DD_ALLG, noe: DD_ALLG, sbg: DD_ALLG, stmk: DD_ALLG, vbg: DD_ALLG
    }
  };
  function prVorListe(paket) {
    var l = landAT(), x = PR_VOR_LAND[paket] && l ? PR_VOR_LAND[paket][l] : null; if (!x) return PR_VOR[paket] || null;
    var w = wAt(todayISO()), sl = w && (+w.stundenlohn > 0 ? +w.stundenlohn : (+w.monatslohn > 0 ? +w.monatslohn / ((w.ueberstunden && +w.ueberstunden.wochenStd || 40) * 4.33) : 0));
    return x.map(function (y) { if (y[4] == null) return y; return [y[0], y[1], y[2] + ' (' + String(y[4]).replace('.', ',') + ' % des Stundenlohns)', sl > 0 ? Math.round(sl * y[4]) / 100 : null]; });
  }
  function renderPrVor() {
    var w = wAt(todayISO()), k = w && prVorListe(w.paket) ? w.paket : null, box = $('#pr-vor'), h = $('#pr-vorh');
    if (!box) return;
    var have = praemienListe().map(function (p) { return p.name; }), list = k ? prVorListe(k).filter(function (x) { return have.indexOf(x[0]) < 0; }) : [];
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
    var arr = praemienListe().filter(function (p) { return p.einheit === 'taet' && p.name && (p.taet || '').trim(); }).filter(function (p) {
      var kw = p.taet.trim().toLowerCase(); if (seen[kw]) return false; seen[kw] = 1; return c.indexOf(kw) < 0;
    }).map(function (p) { return p.taet.trim(); });
    // dazu: zuletzt verwendete Tätigkeiten
    var seen2 = {}; var all = []; arr.concat(letzteTaetigkeiten()).forEach(function (n) { var l = n.toLowerCase(); if (!seen2[l] && c.indexOf(l) < 0) { seen2[l] = 1; all.push(n); } });
    return all.map(function (n) { return '<button type="button" class="chip" data-tchip="' + esc(n) + '" data-tcs="' + sfx + '">' + esc(n) + '</button>'; }).join('');
  }
  function letzteTage() { return Object.keys(data.days).filter(function (k) { return k < (ui.edDate || todayISO()); }).sort().reverse(); }
  function letzteKundenNamen(draft) { // zuletzt verwendete Kunden zum Antippen
    var out = [], have = {}; (draft.kunden || []).forEach(function (k) { have[(k.name || '').trim().toLowerCase()] = 1; });
    letzteTage().some(function (k) { kundenNamen(data.days[k]).forEach(function (n) { var l = n.toLowerCase(); if (!have[l]) { have[l] = 1; out.push(n); } }); return out.length >= 5; });
    return out.slice(0, 5);
  }
  function letzteTaetigkeiten() { // zuletzt verwendete Tätigkeiten zum Antippen
    var out = [], have = {};
    letzteTage().some(function (k) { var dd = E.clone(data.days[k]); normKunden(dd); (dd.kunden || []).forEach(function (x) { (x.taet || []).forEach(function (y) { var n = (y.tat || '').trim(), l = n.toLowerCase(); if (n && !have[l]) { have[l] = 1; out.push(n); } }); }); return out.length >= 4; });
    return out.slice(0, 4);
  }
  function kundenVomLetztenTag() {
    var tage = letzteTage(), i, dd;
    for (i = 0; i < tage.length; i++) { dd = E.clone(data.days[tage[i]]); normKunden(dd); if (kundenNamen(dd).length) return dd.kunden; }
    return null;
  }
  function kSumme(k, i, tour) {
    var tm = (k.taet || []).filter(function (t) { return t.von || t.bis; }), zeit = tm.length ? (tm[0].von || '?') + '–' + (tm[tm.length - 1].bis || '?') : '';
    return '<span class="ksn">' + esc((k.name || '').trim() || ((tour ? 'Tour ' : 'Kunde / Baustelle ') + (i + 1))) + '</span><span class="ksz">' + esc(zeit) + '</span>';
  }
  function kSummeFrisch() {
    var tour = E.istTour(wAt(ui.edDate || todayISO()));
    Array.prototype.forEach.call(document.querySelectorAll('#e-kunden details.kd'), function (dt) { var k = ui.edDraft.kunden[+dt.dataset.kd], sm = dt.firstElementChild; if (k && sm) sm.innerHTML = kSumme(k, +dt.dataset.kd, tour); });
  }
  document.addEventListener('toggle', function (ev) { var d0 = ev.target; if (d0 && d0.classList && d0.classList.contains('kd')) { (ui.kOpen = ui.kOpen || {})[+d0.dataset.kd] = d0.open; } }, true);
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
      var leerK = !(k.name || '').trim() && !(k.taet || []).some(function (t) { return (t.tat || '').trim() || t.von || t.bis; });
      var offenK = ui.kOpen && ui.kOpen[i] !== undefined ? ui.kOpen[i] : leerK;
      return '<details class="kunde2 kd" data-kd="' + i + '"' + (offenK ? ' open' : '') + '><summary>' + kSumme(k, i, tour) + '</summary>' +
        '<div class="khead"><div class="field kn"><label for="k-n' + i + '">' + (tour ? 'Tour' : 'Kunde / Baustelle') + ' ' + (i + 1) + '</label><input type="text" id="k-n' + i + '" data-k="' + i + '" data-f="name" maxlength="120" list="e-notiz-list" autocomplete="off" value="' + esc(k.name || '') + '"><div class="chips kchips">' + (k.name ? '' : letzteKundenNamen(ui.edDraft).map(function (n) { return '<button type="button" class="chip" data-kchip="' + esc(n) + '" data-kci="' + i + '">' + esc(n) + '</button>'; }).join('')) + '</div></div>' +
        '<button type="button" class="rm" data-rmk="' + i + '" aria-label="' + (tour ? 'Tour' : 'Kunde') + ' ' + (i + 1) + ' entfernen">×</button></div>' +
        rows + '<button type="button" class="linkbtn" data-addt="' + i + '">+ Tätigkeit zu diesem Kunden</button></details>';
    }).join('');
    copyKundeBtn();
  }
  function copyKundeBtn() {
    var b = $('#e-copykunde'); if (!b) return;
    var leer = !ui.edDraft.kunden.some(function (k) { return (k.name || '').trim() || (k.taet || []).some(function (t) { return (t.tat || '').trim() || t.von || t.bis; }); });
    b.hidden = !(leer && kundenVomLetztenTag());
  }
  function openEditor(date, from, force) {
    if (!force && ui.edDraft && date !== ui.edDate && isDirty()) { askLeave(function () { openEditor(date, from, true); }); return; }
    ui.edDate = date; ui.edFrom = from || 'erfassen'; ui.kOpen = {};
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
    $('#e-work').hidden = !mitArbeit(d.status);
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
    kSummeFrisch();
    $('#e-diaeten').placeholder = 'Vorschlag';
    (function () {
      var kh = '', kz = E.kundenZeiten(d, w, ui.edDate), tourK = E.istTour(w);
      var box = $('#e-kz-box'), offen = {}; if (box) Array.prototype.forEach.call(box.querySelectorAll('details[data-ki]'), function (x) { if (x.open) offen[x.dataset.ki] = 1; });
      if (kz.rows.some(function (x) { return x.min !== null; })) {
        kz.rows.forEach(function (x) {
          var tm = x.taet.filter(function (y) { return y.von || y.bis; }), zeit = tm.length ? (tm[0].von || '?') + '–' + (tm[tm.length - 1].bis || '?') : '';
          kh += '<details class="kzd" data-ki="' + x.ki + '"' + (offen[x.ki] ? ' open' : '') + '><summary><strong>' + esc(x.name || (tourK ? 'Ohne Tour' : 'Ohne Kunde')) + '</strong><span>' + (x.min === null ? 'Zeit fehlt' : hm(x.min) + ' h') + '</span></summary>';
          if (zeit) kh += '<div class="hint kz-zeit">' + esc(zeit) + '</div>';
          x.taet.forEach(function (y) {
            if (!(y.tat || y.von || y.bis)) return;
            kh += line('<button type="button" class="kzlink kz-sub" data-kz="' + x.ki + '" data-kj="' + y.j + '">' + esc(y.tat || 'Tätigkeit') + '</button><br><span class="kz-uhr">' + esc((y.von || '?') + '–' + (y.bis || '?')) + '</span>', y.min === null ? '–' : hm(y.min) + ' h');
            if (y.pau > 0) kh += '<div class="hint kz-pau"><span>Pause abgezogen:</span> ' + hm(y.pau) + ' h (' + esc(y.pl.join(', ')) + ')</div>';
          });
          kh += '</details>';
        });
        if (kz.rows.length > 1) kh += line('Zusammen', hm(kz.totalMin) + ' h', true);
      }
      var kzs = $('#e-kz-sum'); if (kzs) kzs.textContent = d.status === 'arbeit' && kh ? hm(kz.totalMin) + ' h' : '';
      if (box) { box.hidden = !(d.status === 'arbeit' && kh); var kt = $('#e-kz-title'); if (kt) kt.textContent = tourK ? 'Zeit pro Tour' : 'Zeit pro Kunde'; }
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
  function anBraucht(d) { return ['urlaub', 'sonderurlaub', 'za', 'freistellung', 'ersatzruhe', 'betriebsurlaub', 'frei'].indexOf(d.status) >= 0 || (d.status === 'arbeit' && +d.sw > 0); }
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
    var l = anListe(), sh = abwSummeHtml(abwListe());
    box.innerHTML = sh + (l.length ? l.map(function (x) {
      return '<div class="anrow"><strong>' + esc(fmtShort(x.datum)) + ' · ' + esc(x.art) + '</strong>' + (x.w ? '<div>' + esc(x.w) + '</div>' : '') + (x.t ? '<div>' + esc(x.t) + '</div>' : '') + '<small>Eingetragen am ' + esc(x.ts) + (x.tm ? ', geändert am ' + esc(x.tm) : '') + '</small>' + (x.sv ? '<small>Vom Server bestätigt am ' + esc(x.sv) + '</small>' : '') + '</div>';
    }).join('') : '<p class="hint">Noch keine Notizen. Du findest das Notizfeld in Erfassen bei jedem Tag.</p>');
  }
  function anText() {
    return 'Notizen zu meinen Arbeitstagen (aus dem Stunden-Checker)\n\n' + abwSummeText(abwListe()) + anListe().map(function (x) {
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
    $('#e-an-zeit').addEventListener('click', function () {
      var ta = $('#e-an'), n = new Date(), z = (n.getHours() < 10 ? '0' : '') + n.getHours() + ':' + (n.getMinutes() < 10 ? '0' : '') + n.getMinutes() + ' Uhr: ';
      var v = ta.value; ta.value = (v && !/\n$/.test(v) ? v + '\n' : v) + z; anSet('t', ta.value); ta.focus(); try { ta.setSelectionRange(ta.value.length, ta.value.length); } catch (e) {}
    });
  })();
  function mitArbeit(st) { return st !== 'feiertag'; } // an jedem freien Tag darf zusätzlich gearbeitet worden sein (Feiertag ist ohnehin ein Arbeitstag mit Zuschlag)
  // Sonderurlaub oder Urlaub mit Arbeitszeit: Mia fragt einmal nach, ob das wirklich beides stimmt (oder nur ein Versehen war)
  function paFrage() {
    var dlg = $('#lk-dlg'), body = $('#lk-body'), btns = $('#lk-btns'), d = ui.edDraft, nm = E.STATUS[d.status].name;
    lkKopf('Arbeitszeit eingetragen', 'Bei einem freien Tag trägst du Zeiten nur ein, wenn du an dem Tag trotzdem gearbeitet hast. Dann zählt der Tag als die gewählte Art plus Arbeit. Die Arbeitszeit kommt zu dem dazu, was der Tag sonst bringt, zum Beispiel bezahlte Sollstunden.');
    body.innerHTML = lkMia('<span>An diesem Tag steht</span> <b>' + esc(nm) + '</b> <span>und eine Arbeitszeit von</span> <b>' + esc(d.von) + '–' + esc(d.bis || '…') + '</b><br><span>Das ist normalerweise nicht möglich. Soll die Arbeitszeit trotzdem dazugerechnet werden? Dann schreibe ich den Fall als Notiz zu diesem Tag.</span>');
    btns.innerHTML = '<button type="button" class="btn primary" id="pa-ja">Ja, dazurechnen und Notiz schreiben</button><button type="button" class="btn" id="pa-nein">Nein, ohne Arbeitszeit</button><button type="button" class="btn" id="pa-zu">Zurück zur Eingabe</button>';
    dlg.hidden = false;
    $('#pa-ja').onclick = function () { dlg.hidden = true; ui.paOk = ui.edDate + d.status + d.von + d.bis; var nt = uiTr('Arbeit an einem freien Tag (zum Beispiel Urlaub, Krankenstand): normalerweise nicht möglich, hier aber bewusst dazugerechnet.', uiLang()) || 'Arbeit an einem freien Tag (zum Beispiel Urlaub, Krankenstand): normalerweise nicht möglich, hier aber bewusst dazugerechnet.'; if (!d.an) d.an = {}; if ((d.an.t || '').indexOf(nt) < 0) d.an.t = ((d.an.t || '') ? d.an.t + ' ' : '') + nt; saveDay(); };
    $('#pa-nein').onclick = function () { dlg.hidden = true; d.von = ''; d.bis = ''; d.pausen = []; ui.paOk = ''; renderEditor(); saveDay(); };
    $('#pa-zu').onclick = function () { dlg.hidden = true; };
  }
  function saveDay() {
    var d = ui.edDraft, st = d.status;
    if (st !== 'arbeit' && mitArbeit(st) && d.von) {
      var vor = data.days[ui.edDate], schonBestaetigt = vor && vor.status === st && vor.von === d.von && (vor.bis || '') === (d.bis || '');
      if (!schonBestaetigt && ui.paOk !== ui.edDate + st + d.von + d.bis) { paFrage(); return false; }
    }
    if (st === 'arbeit') {
      if (!d.von && d.bis) { toast('Es fehlt der Beginn.'); return false; }
      if (!d.von && !(+d.sw > 0)) { toast(data.days[ui.edDate] ? 'Beginn fehlt. Soll der Tag leer sein? Dann tippe unten auf „Tag löschen“.' : 'Bitte mindestens den Beginn eintragen.'); return false; } // das Ende darf noch fehlen: Dienst läuft
    }
    var out = E.clone(d);
    if (st !== 'freistellung') delete out.fv;
    out.sw = out.swOn ? (+out.sw || 0) : 0; if (!out.swOn) { delete out.swOn; delete out.swGrund; delete out.swAuto; }
    out.diaeten = (out.diaeten === null || out.diaeten === '' || isNaN(+out.diaeten)) ? null : +out.diaeten;
    out.pausen = (out.pausen || []).filter(function (p) { return p.von && p.bis; });
    if (!mitArbeit(st)) { out.von = ''; out.bis = ''; out.pausen = []; out.kunden = []; out.diaeten = null; out.sw = 0; delete out.swOn; delete out.swGrund; delete out.swAuto; out.notiz = ''; out.spaeter = false; }
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
  var MIA_OUT = { 'lkw:baustelle': ['barhaupt', 'weste', 'lenkrad'], 'lkw:tour': ['kappe', 'paket', 'lenkrad'], 'lkw:fern': ['kappe', 'lenkrad'], 'lkw:muell': ['kappe', 'weste', 'lenkrad'], lkw: ['kappe', 'lenkrad'], bund: ['krawatte', 'klemmbrett'], optiker: ['kittel'], bahn: ['kappe', 'weste', 'klemmbrett'], anderes: ['klemmbrett'],
    bagger: ['barhaupt', 'weste', 'ohren', 'joystick'], klein: ['kappe', 'klemmbrett'], mechaniker: ['overall', 'maulschluessel'], lager: ['weste', 'paket'], handel: ['schuerze'], buero: ['krawatte', 'laptop'], aussendienst: ['krawatte', 'koffer'],
    'gastro:service': ['schuerze', 'tablett_glas'], 'gastro:kueche': ['kochhaube', 'schuerze', 'pfanne'], 'gastro:chef': ['kochhaube', 'schuerze', 'messer'], 'gastro:rezeption': ['krawatte', 'mappe'], 'gastro:housekeeping': ['schuerze'], 'gastro:betrieb': ['kochhaube', 'schuerze'],
    handwerk: ['helm', 'weste'], 'handwerk:maurer': ['helm', 'weste', 'kelle'], 'handwerk:zimmerer': ['helm', 'weste', 'hammer'], 'handwerk:elektro': ['helm', 'overall', 'maulschluessel'], 'handwerk:installateur': ['helm', 'overall', 'maulschluessel'], 'handwerk:spengler': ['helm', 'overall', 'hammer'], 'handwerk:tischler': ['kappe', 'overall', 'hammer'], 'handwerk:maler': ['kappe', 'overall', 'eimer'], 'handwerk:anderes': ['helm', 'weste', 'wasserwaage'], 'handwerk:lehrling': ['helm', 'weste', 'hammer'],
    bus: ['kappe', 'lenkrad'], gaertner: ['kappe', 'weste'], industrie: ['helm', 'weste'], post: ['weste', 'kappe'], ordination: ['kittel'], zahntechnik: ['kittel'], textilreinigung: ['kittel'], rauchfangkehrer: ['kappe', 'weste'], schaedling: ['kittel', 'weste'], kunststoff: ['kittel', 'weste'], garage: ['weste', 'kappe'], kosmetik: ['kittel'], seilbahn: ['muetze', 'jacke'], lmindustrie: ['kochhaube', 'kittel'], kino: ['kappe'], rettung: ['weste', 'kappe'], lebensmittel: ['kochhaube', 'schuerze'], 'lebensmittel:fahrer': ['kappe', 'paket', 'lenkrad'], konditor: ['kochhaube', 'schuerze'], 'konditor:fahrer': ['kappe', 'paket', 'lenkrad'], fleischer: ['kochhaube', 'schuerze'], 'fleischer:fahrer': ['kappe', 'paket', 'lenkrad'], friseur: ['schuerze'], reinigung: ['schuerze', 'eimer'], 'reinigung:sonder': ['helm', 'overall', 'eimer'], 'reinigung:lehrling': ['schuerze', 'eimer'], security: ['kappe', 'weste', 'klemmbrett'], 'security:mobil': ['kappe', 'weste', 'lenkrad'], pflege: ['kittel'], 'pflege:heimhilfe': ['schuerze'], 'pflege:mobil': ['kittel', 'koffer'],
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
  var MIA_FARBEN = [['', 'Standard'], ['blau', 'Blau', '#2563eb'], ['dunkelblau', 'Dunkelblau', '#1e3a8a'], ['gruen', 'Grün', '#16a34a'], ['rot', 'Rot', '#dc2626'], ['schwarz', 'Schwarz', '#374151'], ['grau', 'Grau', '#94a3b8'], ['braun', 'Braun', '#92400e'], ['violett', 'Violett', '#7c3aed'], ['rosa', 'Rosa', '#ec4899'], ['weiss', 'Weiß', '#f1f5f9']];
  var MIA_WESTE = [['', 'Gelb'], ['orange', 'Orange']];
  var MIA_FARB_TEIL = { kopf: ['helm', 'kappe', 'muetze', 'stirnband'], oben: ['weste', 'jacke', 'overall', 'trikot'], unten: ['hose_jeans', 'hose_arbeit', 'hose_kurz', 'hose_rock', 'hose_jogging'] };
  function miaFarbOpts(teil, id) { return id === 'weste' ? MIA_WESTE : MIA_FARB_TEIL[teil].indexOf(id) >= 0 ? MIA_FARBEN : null; }
  function miaMix(h, t, a) { var c = function (i) { return Math.round(parseInt(h.substr(1 + i * 2, 2), 16) * (1 - a) + t * a); }; var x = function (v) { return (v < 16 ? '0' : '') + v.toString(16); }; return '#' + x(c(0)) + x(c(1)) + x(c(2)); }
  function miaFarbe(teil) { var m = (data.profil && data.profil.mia) || {}; return m.eigen === true && m.look ? m.look[teil + 'F'] || '' : ''; }
  // Färbt ein Kleidungsstück um: Grundfarben (haupt, dunkel, hell) werden durch die gewählte Farbe ersetzt
  function miaFaerbe(frag, teil, haupt, dunkel, hell) {
    var k = miaFarbe(teil); if (!k) return frag;
    var c = null; MIA_FARBEN.forEach(function (x) { if (x[0] === k) c = x[2]; }); if (!c) return frag;
    var rep = function (arr, to) { arr.forEach(function (b) { frag = frag.split(b).join(to); }); };
    rep(haupt, c); rep(dunkel || [], miaMix(c, 0, 0.4)); rep(hell || [], miaMix(c, 255, 0.45)); return frag;
  }
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
    if (has('hose_jeans')) s += miaFaerbe('<path d="M32 106h56v6q0 12-20 12H52q-20 0-20-12z" fill="#2563eb"/><path d="M60 106v18" stroke="#1e3a8a" stroke-width="2"/>', 'unten', ['#2563eb'], ['#1e3a8a'], []);
    if (has('hose_arbeit')) s += miaFaerbe('<path d="M32 104h56v8q0 12-20 12H52q-20 0-20-12z" fill="#64748b"/><rect x="36" y="110" width="11" height="7" rx="1.500" fill="#475569"/><rect x="73" y="110" width="11" height="7" rx="1.500" fill="#475569"/><path d="M60 104v20" stroke="#334155" stroke-width="2"/>', 'unten', ['#64748b'], ['#475569', '#334155'], []);
    if (has('hose_kurz')) s += miaFaerbe('<path d="M32 113h56v1q0 10-20 10H52q-20 0-20-10z" fill="#0d9488"/><path d="M60 113v11" stroke="#115e59" stroke-width="2"/>', 'unten', ['#0d9488'], ['#115e59'], []);
    if (has('hose_rock')) s += miaFaerbe('<path d="M33 106q27 8 54 0l7 18H26z" fill="#db2777" stroke="#9d174d" stroke-width="1.500"/>', 'unten', ['#db2777'], ['#9d174d'], []);
    if (has('hose_jogging')) s += miaFaerbe('<path d="M32 106h56v6q0 12-20 12H52q-20 0-20-12z" fill="#9ca3af"/><path d="M36 108v14M84 108v14" stroke="#fff" stroke-width="2.500"/>', 'unten', ['#9ca3af'], [], []);
    if (has('trikot')) s += miaFaerbe('<rect x="32" y="80" width="56" height="44" rx="20" fill="#dc2626"/><path d="M50 82l10 10l10-10" fill="none" stroke="#fff" stroke-width="3"/><text x="60" y="114" font-size="22" font-weight="700" text-anchor="middle" fill="#fff" font-family="Arial,sans-serif">7</text>', 'oben', ['#dc2626'], [], []);
    if (has('kittel')) s += '<rect x="32" y="80" width="56" height="44" rx="20" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.500"/><path d="M60 82v42" stroke="#cbd5e1" stroke-width="2"/><rect x="66" y="100" width="12" height="9" rx="1.500" fill="none" stroke="#94a3b8" stroke-width="1.500"/><circle cx="55" cy="94" r="1.800" fill="#94a3b8"/><circle cx="55" cy="106" r="1.800" fill="#94a3b8"/>';
    if (has('jacke')) s += miaFaerbe('<rect x="32" y="80" width="56" height="44" rx="20" fill="#475569"/><path d="M60 82v42" stroke="#1e293b" stroke-width="2.500"/><path d="M48 82l12 10l12-10" fill="none" stroke="#1e293b" stroke-width="2.500"/><rect x="38" y="104" width="12" height="9" rx="2" fill="#334155"/><rect x="70" y="104" width="12" height="9" rx="2" fill="#334155"/>', 'oben', ['#475569'], ['#1e293b', '#334155'], []);
    if (has('weste')) s += (miaFarbe('oben') === 'orange' ? ('<rect x="32" y="80" width="56" height="44" rx="20" fill="url(#mgOra)"/><path d="M60 82v42" stroke="#8a9a00" stroke-width="2"/><rect x="34" y="97" width="52" height="6" fill="#f3f4f6"/><rect x="36" y="109" width="48" height="6" fill="#f3f4f6"/><path d="M34 97h52M36 109h48" stroke="rgba(0,0,0,.12)" stroke-width="1"/>').split('url(#mgOra)').join('#ff9f1c').split('#8a9a00').join('#9a4d00') : ('<rect x="32" y="80" width="56" height="44" rx="20" fill="url(#mgOra)"/><path d="M60 82v42" stroke="#8a9a00" stroke-width="2"/><rect x="34" y="97" width="52" height="6" fill="#f3f4f6"/><rect x="36" y="109" width="48" height="6" fill="#f3f4f6"/><path d="M34 97h52M36 109h48" stroke="rgba(0,0,0,.12)" stroke-width="1"/>'));
    if (has('overall')) s += miaFaerbe('<rect x="32" y="80" width="56" height="44" rx="20" fill="url(#mgBlu)"/><rect x="38" y="80" width="7" height="22" fill="#1b4fb0"/><rect x="75" y="80" width="7" height="22" fill="#1b4fb0"/><rect x="48" y="100" width="24" height="14" rx="3" fill="#6ea4ff" stroke="#1b4fb0" stroke-width="1.5"/><circle cx="41.500" cy="103" r="2.2" fill="#facc15"/><circle cx="78.500" cy="103" r="2.2" fill="#facc15"/>', 'oben', ['url(#mgBlu)'], ['#1b4fb0'], ['#6ea4ff']);
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
    else if (has('helm')) s += miaFaerbe('<path d="M21 46q2-40 39-40t39 40z" fill="url(#mgYel)" stroke="#a16207" stroke-width="2"/><rect x="17" y="42" width="86" height="9" rx="4.500" fill="#f5b400" stroke="#a16207" stroke-width="2"/><path d="M60 7v34" stroke="#c98a00" stroke-width="5"/><path d="M34 22q6-9 16-12" fill="none" stroke="#fff6c2" stroke-width="3" stroke-linecap="round" opacity=".8"/>', 'kopf', ['url(#mgYel)', '#f5b400'], ['#a16207', '#c98a00'], []);
    else if (has('kappe')) s += miaFaerbe('<path d="M22 40q38-38 76 0z" fill="url(#mgRed)" stroke="#7f1d1d" stroke-width="2"/><path d="M58 36q20-6 48 4q-10 8-48 2z" fill="#991b1b" stroke="#7f1d1d" stroke-width="1.500"/><circle cx="60" cy="7" r="3.500" fill="#991b1b"/><path d="M36 22q8-8 20-10" fill="none" stroke="#ffb4aa" stroke-width="3" stroke-linecap="round" opacity=".8"/>', 'kopf', ['url(#mgRed)'], ['#991b1b', '#7f1d1d'], ['#ffb4aa']);
    else if (has('muetze')) s += miaFaerbe('<path d="M23 44q-2-38 37-38t37 38z" fill="#7c3aed" stroke="#4c1d95" stroke-width="2"/><rect x="21" y="38" width="78" height="9" rx="4" fill="#a78bfa" stroke="#4c1d95" stroke-width="2"/><circle cx="60" cy="5" r="6" fill="#ede9fe" stroke="#4c1d95" stroke-width="1.500"/>', 'kopf', ['#7c3aed'], ['#4c1d95'], ['#a78bfa']);
    else if (has('strohhut')) s += '<ellipse cx="60" cy="36" rx="53" ry="10" fill="#f6d77a" stroke="#a16207" stroke-width="2"/><path d="M34 34q2-30 26-30t26 30z" fill="#f9e29a" stroke="#a16207" stroke-width="2"/><rect x="34" y="27" width="52" height="6" fill="#b91c1c"/>';
    else if (has('stirnband')) s += miaFaerbe('<path d="M22 40q38-12 76 0v9q-38-12-76 0z" fill="#ef4444" stroke="#7f1d1d" stroke-width="2"/>', 'kopf', ['#ef4444'], ['#7f1d1d'], []);
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
  var MIA_PAKET = { gueter: ['kappe'], bau: ['helm', 'weste'], klein: ['kappe', 'klemmbrett'], handel: ['schuerze'], handel_arb: ['weste', 'paket'], buero: ['krawatte'], metall: ['overall', 'schluessel'], gastro: ['schuerze'] };
  function miaFor(date) { if (data.profil && data.profil.mia && data.profil.mia.eigen === true) return miaOutfitEigen(); var w = wAt(date || todayISO()); return w.beruf ? miaOutfit(w.beruf, w.art) : (MIA_PAKET[String(w.paket).replace(/^de_/, '')] || MIA_PAKET[{ spedition: 'gueter' }[String(w.paket).replace(/^de_/, '')]] || []); }
  function miaSet(k, v) { if (!data.profil) data.profil = {}; if (!data.profil.mia) data.profil.mia = {}; data.profil.mia[k] = v; delete data.profil.test; save(); renderMia(); if (k === 'name' || k === 'figur') uiMiaNamen(); }
  function lgSt(lg, g) { return (g && g.stufen) || (lg && lg.stufen) || null; }
  function miaSkipInc(k) { if (!data.profil) data.profil = {}; if (!data.profil.mia) data.profil.mia = {}; if (k === 'schnellneu') { data.profil.mia.spaetTag = todayISO(); save(); toast('Okay, ich frage dich am Abend nach Dienstschluss wieder.'); return; } var s = data.profil.mia.skip || (data.profil.mia.skip = {}); s[k] = (s[k] || 0) + 1; save(); }
  function miaPrevKey() { var y = now.getFullYear(), m = now.getMonth(); if (m === 0) { y--; m = 12; } return { y: y, m: m, key: y + '-' + (m < 10 ? '0' : '') + m }; }
  /* ---------------- Neuigkeiten (Mia) ---------------- */
  var NEWS = [
    { id: 'n11', d: '2026-11-11', text: 'Neu: „Schnell erfassen“. Du schreibst oder sprichst deine Arbeitszeit, oder du fotografierst den Tagesbericht (nur die Zeiten werden gelesen). Einschalten kannst du es in den Einstellungen bei „Eingabehilfen“. Probiere es aus und sag mir danach, wie es bei dir klappt, mit „Rückmeldung an den Entwickler“ im Profil. Das hilft mir sehr.' },
    { id: 'n10', d: '2026-11-06', text: 'Neu: Kollektivverträge für Lkw-Fahrer in Deutschland: Nordrhein-Westfalen, Bayern, Sachsen und Berlin, dazu eine Auswahl für alle anderen Länder.' },
    { id: 'n9', d: '2026-11-05', text: 'Neu: Zeitausgleich-Konto und Resturlaub werden vom Lohnzettel gelesen und mit deiner Aufzeichnung verglichen.' },
    { id: 'n8', d: '2026-11-05', text: 'Neu: Brutto (geschätzt) für abgeschlossene Monate. Trage das Brutto vom Lohnzettel ein, dann siehst du, wie weit die Schätzung danebenliegt.' },
    { id: 'n7', d: '2026-11-04', text: 'Neu: Die Art des Tages „Keine Arbeit (von der Firma freigestellt)“, wenn dich die Firma wegen fehlender Arbeit heimschickt. Mit Notiz und einer Einstellung, wie deine Firma den Tag verrechnet.' },
    { id: 'n6', d: '2026-11-03', text: 'Neu: Kollektivvertrag für Büro-Angestellte im Transport und in der Güterbeförderung.' },
    { id: 'n5', d: '2026-11-03', text: 'Neu: Mehrarbeit bei Teilzeit wird erkannt, und sie ist ohne Zuschlag, wenn du sie im selben Quartal 1:1 als Zeitausgleich nimmst.' },
    { id: 'n4', d: '2026-11-03', text: 'Neu: Karenz, Mutterschutz und Papamonat gibt es als Tagesart, für alle Berufe.' },
    { id: 'n3', d: '2026-11-03', text: 'Neu: Kollektivverträge für Büro-Angestellte in Gewerbe, Metall-Industrie und Bau. Fehlt deiner, kannst du ihn melden.' },
    { id: 'n2', d: '2026-11-02', text: 'Ein Tester hat sich gewünscht, bei „Zeit pro Kunde“ den Kunden antippen zu können. Das geht jetzt.' },
    { id: 'n1', d: '2026-11-02', text: 'Ein Tester hat sich „Sonntag“ bei den festen freien Tagen gewünscht. Ist da.' }
  ];
  var NEWS_B = { n11: null, n10: ['lkw', 'klein', 'lager'], n9: null, n8: null, n7: null, n5: null, n4: null, n3: ['buero', 'aussendienst', 'bund'], n6: ['buero', 'aussendienst', 'bund'], n2: ['lkw', 'bagger', 'handwerk', 'klein', 'aussendienst'], n1: null }; // null = für alle Berufe
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
    var nl = newsListe(), nli = function (x) { var neu = c.gelesen.indexOf(x.id) < 0; return '<div class="newsli' + (neu ? ' neu' : '') + '"><strong>' + esc(x.text) + '</strong>' + (neu ? '<span class="nbadge">Neu!</span>' : '') + '<small>' + fmtDate(x.d) + '</small></div>'; };
    $('#news-list').innerHTML = nl.slice(0, 3).map(nli).join('') + (nl.length > 3 ? '<details class="how"><summary>Ältere Neuigkeiten</summary>' + nl.slice(3).map(nli).join('') + '</details>' : '');
  }
  // Lernen aus Eingaben: Namen selbst angelegter Prämien (ohne Beträge) anonym melden, nur mit Einwilligung
  function praemNamen() { return praemienListe().filter(function (p) { return p && String(p.name || '').trim(); }).map(function (p) { return { n: String(p.name).trim().slice(0, 40), e: p.einheit || '' }; }).slice(0, 20); }
  function praemMelden() { try { if (!PROBE && window.StundenInsights && window.StundenInsights.praemien) window.StundenInsights.praemien(praemNamen()); } catch (e) { } }
  function praemFrageFaellig() { var co = (data.profil && data.profil.consent) || {}; return !!(window.StundenInsights && window.StundenInsights.on) && co.praemien === undefined && !(data.profil && (data.profil.praemFrageNein || data.profil.mithelfenNein)) && praemNamen().length > 0; }
  function mitHelfenFaellig() {
    var co = (data.profil && data.profil.consent) || {};
    return !!(window.StundenInsights && window.StundenInsights.on) && !!data.settings.length && !co.statistik && !co.miaFragen && !(data.profil && data.profil.mithelfenNein);
  }
  function miaNext() {
    if (!data.settings.length) return null;
    var w = wAt(todayISO()), bs = E.bausteine(w), c = miaCfg(), out = [], pk = miaPrevKey();
    if (ui.fbNeu && ui.fbNeu.length) out.push({ k: 'fberledigt', text: 'Gute Nachricht: Deine Meldung an den Entwickler ist erledigt. Danke fürs Melden!' });
    if (ui.neueVersion) out.push({ k: 'update', text: 'Es gibt eine neue Version der App. Soll ich sie jetzt laden? Deine Einträge bleiben erhalten.' });
    var wL = wAt(todayISO()), lL = landAT();
    if (wL && wL.paket && lL && !kvPasstLand(wL.paket, lL)) out.push({ k: 'kvland', text: abw1('Dein Kollektivvertrag ({0}) gilt für ein anderes Bundesland als dein Arbeitsort ({1}). Die Löhne sind je Bundesland verschieden. Soll ich dir zeigen, wo du ihn änderst?', [PAKET_KURZ[wL.paket] || (E.PAKETE[wL.paket] && E.PAKETE[wL.paket].name) || '', E.LAENDER_AT[lL]]) });
    else if (wL && wL.paket && lL && !E.kvLand(wL.paket)) { var eig = ((E.BERUFE[wL.beruf] || {}).kvs || []).filter(function (k) { var x = E.kvLand(k); return x && x.indexOf(lL) >= 0 && k.indexOf(wL.paket + '_') === 0; })[0]; if (eig) out.push({ k: 'kvland', text: abw1('Für dein Bundesland ({1}) gibt es einen eigenen Kollektivvertrag ({0}). Soll ich dir zeigen, wo du ihn änderst?', [PAKET_KURZ[eig] || E.PAKETE[eig].name, E.LAENDER_AT[lL]]) }); }
    else if (wL && !lL && (berufHatLand(wL.beruf) || PR_VOR_LAND[wL.paket])) out.push({ k: 'landfrage', text: 'In welchem Bundesland arbeitest du? Dann schlage ich dir den passenden Kollektivvertrag und die Zulagen deines Bundeslandes vor. Das ist optional. Soll ich dich hinführen?' });
    if (wL && wL.beruf === 'rettung' && !(data.profil && data.profil.rkKvHinweis)) out.push({ k: 'rettungkv', text: 'Für den Rettungsdienst gibt es mehrere Kollektivverträge: Beim Roten Kreuz gilt der Rotkreuz-KV, beim Samariterbund der Samariterbund-KV (BARS). Für private Rettungs- und Krankentransportfirmen ohne eigenen KV (zum Beispiel Grünes Kreuz) gilt ebenfalls der Rotkreuz-KV. Laut Oberstem Gerichtshof darf ein Krankentransport nicht nach dem Taxi-KV bezahlt werden. Soll ich dir zeigen, wo du deinen KV auswählst?' });
    if (wL && wL.beruf === 'bus' && /^taxi/.test(wL.paket || '') && !(data.profil && data.profil.taxiKtHinweis)) out.push({ k: 'taxikt', text: 'Fährst du Kranken- oder Rettungstransporte? Dann gilt laut Oberstem Gerichtshof meistens nicht der Taxi-KV, sondern der Rotkreuz-KV. In der App findest du ihn beim Beruf „Rettungsdienst“. Soll ich dir zeigen, wo du den Beruf änderst?' });
    if (!(data.profil && (data.profil.sqHinweis || data.profil.sqText === true))) out.push({ k: 'schnellneu', spaet: !!(data.profil && data.profil.mia && data.profil.mia.spaetTag === todayISO() && !((data.days[todayISO()] && data.days[todayISO()].bis) || new Date().getHours() >= 15)), text: 'Neu: „Schnell erfassen“. Du schreibst oder sprichst einfach, zum Beispiel „heute 6 bis 15 Uhr, 30 Minuten Pause“, oder du fotografierst deinen Tagesbericht (ich lese nur die Zeiten). Ich zeige dir, was ich verstanden habe, du prüfst es und speicherst. Du findest es beim Erfassen ganz oben. Es ist noch ausgeschaltet. Ein- und ausschalten kannst du es unter Einstellungen bei „Eingabehilfen“. Probiere es aus und sag mir danach über „Rückmeldung an den Entwickler“ im Profil, wie es bei dir klappt. Soll ich dich zu den Einstellungen bringen, damit du es dort einschalten kannst?' });
    if (!(data.profil && data.profil.assistDone)) out.push({ k: 'assist', text: 'Sollen wir kurz das Wichtigste deiner Einstellungen durchgehen? Das dauert etwa eine Minute, du trägst gleich mit ein.' });
    if (data.profil && data.profil.assistKurz && !data.profil.assistLang && !data.profil.assistMehrNein && Object.keys(data.days).length >= 5) out.push({ k: 'assistmehr', text: 'Magst du jetzt die genaueren Einstellungen mit mir durchgehen (Zuschläge, Pausen, Diäten)? Dann wird der Vergleich mit deinem Lohnzettel genauer.' });
    if (data.profil && data.profil.tagesfuehrung === true && data.profil.tagGefuehrt !== todayISO() && !(data.days[todayISO()] && data.days[todayISO()].von)) out.push({ k: 'tagfuehren', text: 'Sollen wir deinen heutigen Tag gemeinsam eintragen? Ich sage dir bei jedem Feld, was du tust.' });
    if (data.profil && data.profil.assistDone && !data.profil.lzEinstFrage) out.push({ k: 'lzeinst', text: 'Soll ich deine Einstellungen mit deinem Lohnzettel prüfen? Du zeigst mir die PDF-Datei oder ein Foto, ich lese es nur hier auf deinem Handy, und du bestätigst jede Änderung.' });
    var zuW = data.settings.length ? E.wertAt(data.settings, todayISO()) : null;
    if (zuW && zuW.zuschlag && zuW.zuschlag.art !== 'kv' && (+zuW.zuschlag.so > 0 || +zuW.zuschlag.ft > 0 || +zuW.zuschlag.sa > 0) && !(data.profil && data.profil.zuartFrage)) out.push({ k: 'zuart', text: 'Neu: Zuschläge für Sonn- und Feiertage kann ich jetzt nach Kollektivvertrag und Gesetz rechnen, in einer eigenen Zeile. Bei dir zählen sie noch als zusätzliche Stunden. Wenn deine Firma so zählt, lass es so: Ich zeige dir dann bei den Abweichungen daneben, was nach Kollektivvertrag herauskäme. Soll ich stattdessen ganz auf Kollektivvertrag umstellen? Das kannst du in den Einstellungen bei den Zuschlägen jederzeit ändern.' });
    if (zuW) { var ukT = unterKvTexte(zuW, todayISO()); if (ukT.length) out.push({ k: 'unterkv_' + (zuW.gueltigAb || ''), text: ukT.join(' ') }); }
    var kvn = E.lgAnstehend(data.settings, todayISO(), 45);
    if (kvn) out.push({ k: 'kvneu_' + kvn.ab, text: abw1(kvn.auto ? 'Dein Kollektivvertrag steigt ab {0}: In deiner Lohngruppe von {1} auf {2}. Soll ich die neuen Werte ab diesem Tag anlegen? Frühere Monate bleiben unverändert.' : 'Dein Kollektivvertrag steigt ab {0}: In deiner Lohngruppe laut Tabelle von {1} auf {2}. Dein Lohn im Programm folgt der Tabelle nicht von selbst. Soll ich neue Werte ab diesem Tag anlegen? Dann trägst du den Lohn laut Lohnzettel ein.', [fmtDate(kvn.ab), kvn.alt == null ? '–' : eur.format(kvn.alt), eur.format(kvn.val)]) });
    if (!(data.profil && data.profil.tourDone)) out.push({ k: 'rundgang', text: 'Soll ich dir in einer Minute zeigen, wie du Tage einträgst und wo du alles findest?' });
    if (w.stundenlohn == null) out.push({ k: 'lohn', pose: 'eyes', text: 'Mir fehlt noch dein Stundenlohn. Dann sage ich dir, was ein Unterschied in Euro wert ist.' });
    if (!Object.keys(data.days).length) out.push({ k: 'tag', text: 'Trag jetzt deinen ersten Tag ein. Beginn und Ende reichen.' });
    if (bs.praemien && !praemienListe().length) out.push({ k: 'praemien', text: 'Steht auf deinem Lohnzettel eine Prämie oder Zulage? Lege sie an, dann prüfe ich sie auch.' });
    if (data.profil && data.profil.lzLesen === undefined && Object.keys(data.days).length >= 3) out.push({ k: 'lzlesen', text: 'Darf ich dir künftig das Abtippen vom Lohnzettel abnehmen? Du zeigst mir die PDF-Datei oder ein Foto, ich lese es nur hier auf deinem Handy, und du musst fast nichts mehr eintippen. Du entscheidest und kannst es jederzeit ausschalten.' });
    var cnt = Object.keys(data.days).filter(function (k) { return k.slice(0, 7) === pk.key; }).length;
    var lzt = (data.profil && data.profil.lzTag) || 10; // Mia fragt erst ab dem Tag, an dem der Lohnzettel meist kommt
    if (cnt >= 5 && now.getDate() >= lzt && !(data.abgleich && data.abgleich[pk.key])) out.push({ k: 'lohnzettel', text: 'Dein Lohnzettel für ' + MON[pk.m - 1] + ' müsste da sein. Tippe die Zeilen ab, und ich vergleiche sie mit deiner Aufzeichnung.' });
    var ur = ueberRows().slice(-4), neg = ur.filter(function (x) { return x.diff < -1.5; }).length, pos = ur.filter(function (x) { return x.diff > 1.5; }).length;
    if (ur.length >= 3 && (neg >= 3 || pos >= 3)) out.push({ k: 'abweichung', pose: 'eyes', text: 'Deine Überstunden weichen in mehreren Monaten vom Lohnzettel ab. Schau bitte nach, ob diese Einstellungen stimmen: Überstunden-Modell, Betrieb geschlossen und Rundung.' });
    if (umfrageFaellig()) out.push({ k: 'umfrage', text: 'Du nutzt die App jetzt etwa einen Monat. Hilfst du mir mit drei kurzen Fragen, damit sie besser wird?' });
    fristenMia(out);
    festMia(out);
    if (praemFrageFaellig()) out.push({ k: 'praemhelfen', text: 'Du hast eigene Prämien angelegt. Darf ich ihre Namen anonym melden, ohne Beträge? Dann kann die App sie anderen in deinem Beruf vorschlagen. Das ist optional und jederzeit unter Einstellungen, „Mithelfen (optional)“, ausschaltbar.' });
    if (mitHelfenFaellig()) out.unshift({ k: 'mithelfen', text: 'Du testest die App gratis. Hilfst du mit, sie besser zu machen? Ich melde nur anonym, in welchem Beruf du bist und wie stark Lohnzettel und Aufzeichnung abweichen, dazu Fragen, die ich nicht beantworten kann. Keine Namen, keine Beträge. Du kannst es jederzeit im Profil ausschalten.' });
    if (newsCfg().an === undefined && !mitHelfenFaellig() && (data.profil && data.profil.tourDone) && Object.keys(data.days).length >= 3) out.push({ k: 'newsfrage', text: 'Soll ich dir Neuigkeiten zur App sagen, zum Beispiel neue Funktionen oder was sich Tester gewünscht haben? Wie oft, kannst du jederzeit im Profil ändern.' });
    if (newsDue()) out.push({ k: 'news_' + newsUnseen()[0].id, text: newsUnseen()[0].text });
    var vn = ((data.profil && data.profil.vorname) || '').trim();
    if (vn) out.forEach(function (o) { if (['assist', 'rundgang', 'lzlesen', 'tag', 'praemien', 'tagfuehren'].indexOf(o.k) >= 0) o.text = vn + ', ' + o.text.charAt(0).toLowerCase() + o.text.slice(1); });
    if (!ui.miaManuell) out = out.filter(function (x) { return !x.spaet; }).concat(out.filter(function (x) { return x.spaet; })); // „Später“: beim Start hinten, beim Antippen von Mia wieder vorne
    ui.miaListe = out.filter(function (s) { return s.k.indexOf('frist_') === 0 || s.k.indexOf('news_') === 0 || s.k === 'schnellneu' || s.k === 'update' || (c.skip[s.k] || 0) < 2; });
    return ui.miaListe[0] || null;
  }
  // Start-Karte: sind beim Start mindestens zwei Dinge offen, zeigt Mia alle auf einen Blick (statt nur eine Sprechblase)
  function miaKarte() {
    var L = (ui.miaListe || []).filter(function (o) { return o.k !== 'fberledigt' && o.k.indexOf('news_') !== 0 && o.k !== 'newsfrage'; }).slice(0, 4);
    if (L.length < 2 || $('#mia-karte')) return false;
    var c = miaCfg(), ov = document.createElement('div'); ov.id = 'mia-karte'; ov.className = 'miakarte';
    function zeichne() {
      ov.innerHTML = '<div class="mk-box" role="dialog" aria-modal="true"><div class="mk-kopf"><span class="mk-mia">' + miaSvg(c.figur, miaFor(), 'eyes') + '</span><div class="mk-titel"><b>Das wartet auf dich</b><span class="mk-zahl">' + L.length + '</span></div></div>' +
        L.map(function (o, i) { return '<div class="mk-zeile"><p' + (o.k.indexOf('unterkv_') === 0 ? ' class="mk-rot"' : '') + '>' + esc(o.text) + '</p><div class="mk-btns"><button type="button" class="btn primary" data-mg="' + i + '">' + (o.k === 'schnellneu' || o.k === 'landfrage' || o.k === 'kvland' || o.k === 'rettungkv' || o.k === 'taxikt' || o.k === 'update' || o.k === 'praemhelfen' ? 'Ja, bitte' : 'Zeig mir') + '</button><button type="button" class="btn" data-ms="' + i + '">Später</button></div></div>'; }).join('') +
        '<button type="button" class="btn mk-zu" data-mz="1">Schließen</button></div>';
      try { uiApply(ov); } catch (e) { }
    }
    function zu() { if (ov.parentNode) ov.parentNode.removeChild(ov); ui.miaAuto = true; }
    ov.addEventListener('click', function (ev) {
      var b = ev.target.closest('button'); if (!b) { if (ev.target === ov) zu(); return; }
      if (b.dataset.mz) { zu(); return; }
      if (b.dataset.mg != null) { var k = L[+b.dataset.mg].k; zu(); miaGo(k); return; }
      if (b.dataset.ms != null) { var o = L[+b.dataset.ms]; if (o.k.indexOf('frist_') === 0) fristSpaet(o.k.slice(6)); else miaSkipInc(o.k); L.splice(+b.dataset.ms, 1); if (L.length < 1) zu(); else zeichne(); }
    });
    zeichne(); document.body.appendChild(ov); miaSag('Das wartet auf dich'); return true;
  }
  function umfrageFaellig() {
    if (PROBE || !window.StundenInsights || !window.StundenInsights.on || !data.settings.length || (data.profil && data.profil.umfrage)) return false;
    var ks = Object.keys(data.days).sort(); if (ks.length < 15) return false;
    var p = E.parseISO(ks[0]), t = new Date(p.y, p.m - 1, p.d + 30);
    return todayISO() >= E.iso(t.getFullYear(), t.getMonth() + 1, t.getDate());
  }
  var UM_ZAHL = ['Nein', 'Ja, bis 2 € im Monat', 'Ja, bis 4 € im Monat', 'Ja, bis 6 € im Monat', 'Ja, mehr als 6 € im Monat'];
  function umOpen() {
    var u = { n: 0, z: -1 }, ov = document.createElement('div'); ov.className = 'cropov';
    function draw() {
      ov.innerHTML = '<div class="cropbox wizbox"><h3>Drei kurze Fragen</h3>' +
        '<div class="field"><label>Wie nützlich ist die App für dich?</label><div class="wzlist" style="flex-direction:row;gap:6px">' + [1, 2, 3, 4, 5].map(function (i) { return '<button type="button" class="btn wzopt' + (u.n === i ? ' on' : '') + '" data-un="' + i + '" style="flex:1;min-width:0">' + i + '</button>'; }).join('') + '</div><p class="hint" style="margin:8px 0 0">1 = gar nicht nützlich<br>5 = sehr nützlich</p></div>' +
        '<div class="field"><label>Würdest du dafür zahlen?</label><div class="wzlist">' + UM_ZAHL.map(function (t, i) { return '<button type="button" class="btn wzopt' + (u.z === i ? ' on' : '') + '" data-uz="' + i + '">' + esc(t) + '</button>'; }).join('') + '</div></div>' +
        '<div class="field"><label for="um-t">Was würdest du am meisten vermissen, wenn es die App nicht mehr gäbe? (optional)</label><textarea id="um-t" rows="3" maxlength="500">' + esc(u.t || '') + '</textarea></div>' +
        '<div class="btns"><button type="button" class="btn primary" id="um-send">Absenden</button><button type="button" class="btn" id="um-nein">Nein danke</button></div></div>';
    }
    ov.addEventListener('click', function (ev) {
      var b = ev.target.closest('button'); if (!b) return; var t = $('#um-t', ov) || ov.querySelector('#um-t'); if (t) u.t = t.value;
      if (b.dataset.un) { u.n = +b.dataset.un; draw(); return; }
      if (b.dataset.uz) { u.z = +b.dataset.uz; draw(); return; }
      var pf = data.profil || (data.profil = {});
      if (b.id === 'um-nein') { pf.umfrage = 'nein'; save(); ov.remove(); return; }
      if (b.id === 'um-send') {
        if (!u.n || u.z < 0) { toast('Bitte beantworte die ersten zwei Fragen.'); return; }
        var txt = '[Umfrage] Nutzen: ' + u.n + ' von 5 | Zahlen: ' + UM_ZAHL[u.z] + ' | Vermissen: ' + String(u.t || '').trim().slice(0, 500);
        try { window.StundenInsights.feedback('wunsch', txt, null).then(function () { pf.umfrage = todayISO(); save(); toast('Danke für deine Antwort!'); }, function () { toast('Das hat gerade nicht geklappt. Bitte versuche es später noch einmal.'); }); } catch (e) { }
        ov.remove();
      }
    });
    draw(); document.body.appendChild(ov);
  }
  // Neuer Kollektivvertrags-Stand: legt Werte "gültig ab" an. Frühere Monate behalten ihre alten Werte.
  function kvUebernehmen(ab) {
    var an = E.lgAnstehend(data.settings, todayISO(), 45); if (!an || an.ab !== ab) return;
    var w = E.wertAt(data.settings, todayISO()), ne = E.clone(w);
    ne.gueltigAb = ab; delete ne.test;
    if (an.auto) { ne.lgAuto = false; lgNehmen(ne, an.val, an.mon); }
    data.settings.push(ne); ui.setKey = ab; save(); renderSettings();
    toast(abw1(an.auto ? 'Neue Werte ab {0} angelegt. Der Lohn laut Kollektivvertrag ist übernommen. Frühere Monate bleiben unverändert.' : 'Neue Werte ab {0} angelegt. Trage jetzt deinen Lohn laut Lohnzettel ein.', [fmtDate(ab)]), 7000);
    if (!an.auto) { show('einstellungen'); setTimeout(function () { var el = $('#s-lohn'); if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } }, 150); }
  }
  function miaGo(k) {
    if (k === 'umfrage') { umOpen(); return; }
    if (k === 'praemhelfen') { var pc = data.profil || (data.profil = {}); if (!pc.consent) pc.consent = {}; pc.consent.praemien = true; save(); praemMelden(); try { window.StundenInsights.push(true); } catch (e) { } renderFeedback(); toast('Danke! Die Namen deiner Prämien werden anonym gemeldet.'); return; }
    if (k === 'update') { try { if (isDirty()) { toast('Bitte zuerst den Tag speichern.'); return; } } catch (e) { } location.reload(); return; }
    if (k === 'rettungkv' || k === 'taxikt') { var pr = data.profil || (data.profil = {}); pr[k === 'rettungkv' ? 'rkKvHinweis' : 'taxiKtHinweis'] = true; save(); show('einstellungen'); setTimeout(function () { var e2 = $(k === 'rettungkv' ? '#s-paket' : '#s-beruf'); if (e2) { e2.scrollIntoView({ behavior: 'smooth', block: 'center' }); e2.classList.add('mia-treffer'); setTimeout(function () { e2.classList.remove('mia-treffer'); }, 3200); } }, 250); return; }
    if (k === 'landfrage' || k === 'kvland') { show('einstellungen'); setTimeout(function () { var e2 = k === 'kvland' ? $('#s-beruf') : $('#s-land'); if (e2) { e2.scrollIntoView({ behavior: 'smooth', block: 'center' }); (k === 'kvland' ? e2 : e2.closest('.field')).classList.add('mia-treffer'); setTimeout(function () { (k === 'kvland' ? e2 : e2.closest('.field')).classList.remove('mia-treffer'); }, 3200); } }, 250); return; }
    if (k === 'schnellneu') { var ps = data.profil || (data.profil = {}); ps.sqHinweis = true; save(); show('einstellungen'); setTimeout(function () { var e2 = $('#s-eingabe'); if (e2) { e2.scrollIntoView({ behavior: 'smooth', block: 'center' }); e2.classList.add('mia-treffer'); setTimeout(function () { e2.classList.remove('mia-treffer'); }, 3000); } }, 250); return; }
    if (k.indexOf('kvneu_') === 0) { kvUebernehmen(k.slice(6)); return; }
    if (k.indexOf('unterkv_') === 0) { show('einstellungen'); setTimeout(function () { var el = $('#s-kvwarn'); if (el && !el.hidden) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 200); return; }
    if (k === 'zuart') {
      data.settings.forEach(function (en) { if (!en.zuschlag || en.zuschlag.art === 'kv') return; var p = E.PAKETE[en.paket]; if (p && en.paket !== 'eigen') en.zuschlag = E.clone(p.werte.zuschlag); else en.zuschlag.art = 'kv'; });
      if (!data.profil) data.profil = {}; data.profil.zuartFrage = true; save(); renderSettings(); neuZeichnen();
      toast('Umgestellt: Zuschläge werden jetzt nach Kollektivvertrag gerechnet. Prüfe die Prozentsätze in den Einstellungen.', 7000); return;
    }
    if (k === 'mithelfen') { if (!data.profil) data.profil = {}; data.profil.consent = { statistik: true, miaFragen: true }; save(); try { window.StundenInsights.push(true); } catch (e) { } renderFeedback(); toast('Danke, das hilft sehr!'); return; }
    if (k === 'fberledigt') { var pf = data.profil || (data.profil = {}); pf.fbGesehen = (pf.fbGesehen || []).concat(ui.fbNeu || []); ui.fbNeu = []; save(); return; }
    if (k === 'newsfrage') { newsSet('an', true); newsSet('freq', 'woche'); toast('Gern. Wie oft, stellst du im Profil ein.'); return; }
    if (k === 'news_n11') { newsSet('gelesen', newsListe().map(function (x) { return x.id; })); show('konten'); setTimeout(function () { var fc = $('#fb-card'), fd = $('#fb-det'), el = (fc && !fc.hidden) ? fc : $('#news-card'); if (fd && fc && !fc.hidden) { fd.open = true; var sel = $('#fb-art'); if (sel) sel.value = 'wunsch'; } if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 150); return; }
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
  function miaFarbUi() {
    var lk = miaLook();
    ['kopf', 'oben', 'unten'].forEach(function (t) {
      var se = $('#mia-l-' + t + 'F'), wrap = $('#mia-f-' + t); if (!se || !wrap) return;
      var o = miaFarbOpts(t, lk[t] || (t === 'kopf' ? 'barhaupt' : ''));
      wrap.hidden = !o; if (!o) return;
      var cur = lk[t + 'F'] || ''; se.innerHTML = o.map(function (x) { return '<option value="' + x[0] + '">' + x[1] + '</option>'; }).join('');
      se.value = o.some(function (x) { return x[0] === cur; }) ? cur : ''; try { uiApply(se); } catch (e) { }
    });
  }
  function renderMia() {
    var c = miaCfg(), f = $('#mia-float'); if (f) f.hidden = !data.settings.length || !!ui.wiz;
    var ch = $('#mia-choose'); if (ch) ch.innerHTML = ['w', 'm'].map(function (x) { return '<button type="button" class="miaopt' + (c.figur === x ? ' on' : '') + '" data-mia="' + x + '" aria-label="' + (x === 'w' ? 'Weiblich' : 'Männlich') + '">' + miaSvg(x, miaFor(), '') + '<span>' + (x === 'w' ? 'Weiblich' : 'Männlich') + '</span></button>'; }).join('');
    var n = $('#mia-name'); if (n && document.activeElement !== n) n.value = (data.profil && data.profil.mia && data.profil.mia.name) || ''; if (n) n.placeholder = c.figur === 'm' ? 'Milo' : 'Mia';
    var ak = $('#mia-aktiv'); if (ak) ak.checked = !c.ruhig;
    var eg = $('#mia-eigen'); if (eg) { eg.checked = !!(data.profil && data.profil.mia && data.profil.mia.eigen === true); $('#mia-look').hidden = !eg.checked; var lk = miaLook(); ['kopf', 'oben', 'unten', 'zubehoer'].forEach(function (k) { var se = $('#mia-l-' + k); if (!se) return; if (!se.options.length) se.innerHTML = MIA_TEILE[k].map(function (x) { return x[0] === null ? '<option disabled>' + x[1] + '</option>' : '<option value="' + x[0] + '">' + x[1] + '</option>'; }).join(''); se.value = lk[k] || ''; }); miaFarbUi(); }
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
    ui.miaManuell = !auto; var c = miaCfg(), nx = miaNext(), bb = $('#mia-bubble'); ui.miaManuell = false; ui.miaPose = null;
    if (nx) { $('#mia-text').textContent = nx.text; $('#mia-go').hidden = false; $('#mia-later').hidden = false; $('#mia-go').dataset.k = nx.k; $('#mia-go').textContent = (nx.k === 'mithelfen' || nx.k === 'newsfrage' || nx.k === 'schnellneu' || nx.k === 'landfrage' || nx.k === 'kvland' || nx.k === 'rettungkv' || nx.k === 'taxikt' || nx.k === 'update' || nx.k === 'praemhelfen') ? 'Ja, bitte' : nx.k.indexOf('kvneu_') === 0 ? 'Anlegen' : nx.k === 'zuart' ? 'Umstellen' : nx.k.indexOf('news_') === 0 ? 'Mehr dazu' : 'Zeig mir'; if (nx.k.indexOf('news_') === 0) newsSet('gesehen', todayISO()); miaPose(nx.pose || ''); ui.miaStep = nx.k; }
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
    ui.miaAuto = true; setTimeout(function () { if (!ui.wiz && !TOUR && !miaCfg().ruhig) { if (!(miaNext() && miaKarte())) miaOpen(true); } }, 1200);
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
    ['kopf', 'oben', 'unten', 'zubehoer'].forEach(function (k) { on('#mia-l-' + k, 'change', function () { var l = Object.assign({}, miaLook()); l[k] = this.value; if (k !== 'zubehoer') l[k + 'F'] = ''; miaSet('look', l); miaFarbUi(); }); });
    ['kopf', 'oben', 'unten'].forEach(function (k) { on('#mia-l-' + k + 'F', 'change', function () { var l = Object.assign({}, miaLook()); l[k + 'F'] = this.value; miaSet('look', l); }); });
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
  // Mias Hirn: Antworten je Sprache, gleiche Reihenfolge wie MIA_FAQ [Titel, Antwort, Schlüsselwörter]
  var MIA_TR = {
    en: [["What the app can do", "The Hours Checker shows you whether your pay is right. You enter your working time, I calculate overtime, surcharges, per diems and bonuses according to your collective agreement and the law and compare everything with your payslip. Differences stay recorded, even if the company handles it differently. On top: Quick entry by text, voice or a photo of your daily report, reading your payslip from a photo or PDF, holiday and time-off accounts, deadlines for licences, planning bridge days and reports for the company as PDF. There are more than 30 job areas with over 150 collective agreements for all federal states, and the app speaks 13 languages. Just ask me or tap a topic below.", "what can app do everything function features overview help purpose use"], ["Entering hours", "Open Erfassen (Log). Enter Start (Beginn) and End (Ende), add your breaks (Pausen) and tap Speichern (Save). \"Jetzt\" (Now) fills in the current time.", "hour enter log time work start end save"], ["Adding a bonus", "Go to Einstellungen (Settings), then Prämien (Bonuses), and add your bonus, for example per hour, per day or per piece. Then you enter it on the day. The app calculates it and compares it with your payslip.", "bonus premium allowance extra"], ["Checking your payslip", "Open the Payslip tab and scroll to “Is my payslip correct?”. Type in the hours and amounts, or let me read the payslip from a photo or PDF (at the top under “Read payslip automatically”). The app shows you what matches and where a difference in hours or euros remains. You don't have to fill in every line.", "payslip check correct compare wages salary statement"], ["Overtime and surcharges", "In Einstellungen you find weekly hours, the overtime model and surcharges. They come from your collective agreement (Kollektivvertrag). Your payslip shows whether they are right. You can change them at any time, also from a date onwards.", "overtime surcharge sunday saturday holiday night"], ["Daily allowance (Diäten)", "Diäten is the daily allowance, extra money paid per day. In Einstellungen, Diäten, you set whether it is paid per hour or per day in steps. You find the amount on your payslip.", "allowance diaeten diat per diem expenses meal"], ["Changing pay or job", "In Einstellungen you can change your wage or job from a date onwards. Old days stay calculated with the old values.", "wage change job raise salary"], ["Holiday or sick leave", "In Erfassen choose, at \"Art des Tages\" (Type of day), for example Urlaub (holiday), Krankenstand (sick leave) or Zeitausgleich (time off in lieu). Then you do not need to enter times.", "holiday vacation sick leave off"], ["My data and privacy", "Your entries are stored on your phone. With your account they are also stored on a secured server in Frankfurt so nothing gets lost. Technically the app operator could see them. Encryption that rules this out is in progress. Photos and PDF files of payslips and daily reports are read only on your phone, they are not uploaded. Only the numbers you confirm are saved. Your company sees none of it.", "data privacy safe secure stored account private shared"], ["Backup", "Under Einstellungen (Settings), at the very bottom, you find \"Sicherung speichern oder teilen\" (Save or share backup). It saves a file with all your data. With it you can restore everything on a new phone.", "backup restore lost save file new phone"], ["Installing the app", "Open the page in the browser and tap \"App installieren\" (menu, top right). If Android warns you, tap \"Trotzdem installieren\" (install anyway). The app is safe, it is just this website.", "install icon home screen app"], ["Language and reading aloud", "You choose the app language at the very top of the page. When you ask me something, tap the microphone and speak. With “Read aloud” I read my answer to you. The microphone needs internet and your permission in the browser.", "language speak microphone dictate read aloud translate english"], ["Quiet Mia", "Tap “Quiet Mia” and I will no longer pop up by myself, only when you tap me. Tap the same button again to make me active. You change my figure, name and look under Profile, “My companion”.", "mia milo quiet silent annoying off stop"], ["Deadlines and licences", "Open Profil (Profile) and scroll to \"Fristen und Ausweise\" (Deadlines and licences). Add Code 95, driver card, forklift licence or your own deadlines with an expiry date. I will remind you in time, and the date can go into your phone calendar if you like.", "deadline deadlines licence license code 95 driver card forklift crane expiry course training reminder"], ["Back payments, retroactive wage, special payments", "If the company paid something later or charged it back, enter it in the monthly check under “Nachzahlungen und Korrekturen” (back payments and corrections): which month, which line and how much. The app adds it to the earlier month. For “Stundenlohn aufgerollt” (hourly wage back-calculated) it shows you the calculation and whether the amount fits. Enter holiday bonus, Christmas bonus, 13th and 14th salary in the “Lohnzettel” tab under “Sonderzahlungen” (special payments).", "back payment nachzahlung retroactive aufroll correction christmas holiday bonus 13th 14th special hourly wage"], ["News", "In your profile you find the \"News\" card. There you switch on that Mia tells you the news and set how often: right away, weekly or monthly. You only get what fits your job. If you want to see everything else too, switch on \"Also news for other jobs\".", "news notification new features"], ["Part-time, extra hours and time off in lieu", "If you work part-time and more than agreed, up to the full-time limit of your collective agreement that is extra work, not overtime. It carries a 25 % surcharge, unless you take the hours as time off 1:1 in the same calendar quarter. The app calculates this automatically. Your collective agreement may regulate it differently.", "part-time extra hours time off lieu surcharge quarter"], ["Parental leave, maternity protection, dad month", "In Erfassen choose parental leave, maternity protection or dad month at \"Art des Tages\". These days are unpaid and have no target hours. Parental leave reduces your holiday entitlement proportionally, maternity protection does not.", "parental leave karenz maternity papamonat dad baby"], ["Flextime", "With flextime the app counts plus and minus hours on a flextime account. When setting up choose \"Office with flextime\", or in Einstellungen choose the overtime model \"Flextime\". There you enter the target time per weekday, optionally a starting balance and a carry-over limit. A flextime day (time off in lieu) takes the target time off the account, holiday and sick leave do not.", "flextime flex account balance plus minus hours"], ["No work / released by the company", "Choose “No work (released by the company)” under “Day type” in Erfassen when your company sends you home for lack of work. The note for the day is set automatically. How your company accounts for the day you set in Einstellungen under “Release from work (no work)”: company keeps paying, deducted from time off in lieu, or unpaid. If you do not know, the app deducts nothing. The AK also sees this as the basic rule: if you are ready to work and are sent home, you keep your pay. Your payslip shows whether it is right.", "released freistellung no work sent home lack of work time off in lieu"], ["Time off in lieu: 1:1.5 or 1:1?", "The Working Time Act (§ 10) says: the overtime surcharge must be taken into account in the time off in lieu or paid out separately. With a 50 % surcharge that means either 1 overtime hour = 1.5 hours of time off, or 1:1 and the surcharge appears on your payslip. Your collective agreement may regulate it differently. Set it in Einstellungen under “How does your company credit overtime as time off in lieu?”. When you take the time off, it is deducted hour for hour. In Germany there is no statutory ratio, your contract applies.", "time off in lieu overtime surcharge 1:1.5 ratio"], ["Where do I find this on my payslip?", "At the top of your payslip there is usually your name, the company, the month and often your grading, pay group and collective agreement (sometimes abbreviated “KV”). You find your hourly wage in the line “Lohn” or “Stundenlohn”, the hours next to it in the column “Menge”. Overtime is often on its own lines with 50 % or 100 %, time off in lieu on a line like “Zeitausgleich” or “Zeitkonto”, leave often as “Resturlaub”. Weekly hours are in your employment contract. If something is not on it, ask the office or payroll. If you do not know something, leave the field empty in the app. Until then the app calculates with the values of your collective agreement.", "payslip where find grading pay group collective agreement kv"], ["I am an apprentice", "As an apprentice you get an apprentice's pay, usually a fixed monthly amount per year of training. In the settings, under “My job”, choose the type “Apprentice”. The app then shows only the training years of your collective agreement under the pay group, and with “Use minimum pay from the collective agreement” it enters the amount. If your training contract says a different amount, enter it under “Fixed monthly pay”. Vocational school counts as working time: enter the day as “Training / vocational school”, and a fixed school day every week under “Fixed days off”. Under 18 the youth employment law applies, as a rule at most 8 hours a day and 40 a week. The Chamber of Labour (Arbeiterkammer) helps with questions.", "apprentice trainee vocational school apprenticeship pay"], ["Allowances in construction and trades", "In construction and trades your payslip often shows allowances: dirt, hardship and danger allowance, daily allowance or distance allowance for work away from home, overnight allowance and assembly allowance. Create them under Settings, Bonuses; Mia gives you suggestions. In bad weather in construction and timber construction the BUAK pays part of the wage, and the app keeps bad-weather hours separate. In the painters’ trade you get 60 % of your pay when work is cancelled by weather. The amounts differ by collective agreement, please compare them with your payslip.", "allowance construction trade bad weather overnight assembly buak"], ["Cleaning, security and nursing", "In these jobs a lot happens in night, Sunday and public holiday shifts. Enter the times as you worked them, also past midnight: the hours count for the day the shift starts. Surcharges and allowances (for example night allowance, meal allowance, on-call duty) are on your payslip: create them under Settings, Bonuses, and Mia will suggest the right ones. If another collective agreement applies to you (for example a state hospital), choose “Own values”."], ["Clock change (summer time, winter time)", "The app includes the clock change automatically. In October the clocks go back from 3:00 to 2:00: anyone working that night has worked one hour more. A night shift from 22:00 to 6:00 then counts 9 instead of 8 hours. In March the clocks go forward from 2:00 to 3:00: one hour is missing and the shift counts 7 instead of 8 hours. Simply enter start and end as the clock showed them. Whether your company pays the extra hour is set in your collective agreement or works agreement: check your payslip. If it differs, you can adjust the hours in the day yourself."], ["What is the pay group and do I need it?", "The pay group (or grade) decides which minimum wage the collective agreement gives you. You do not have to know it: just enter your hourly wage from the payslip. If you know it, the app can check whether your pay matches the collective agreement. You find it at the top of the payslip (under \"Einstufung\", \"Lohngruppe\" or \"Verwendungsgruppe\") or in your employment contract. If it is nowhere, ask at your company.", "pay group wage grade classification minimum wage need"], ["I am missing some data, can I still start?", "Yes, you can start right away, even if wage, grade or other details are still missing. Enter what you already have, for example your working hours. You can add missing values in the settings at any time. The app then automatically recalculates all days you have already entered, correctly. Only the comparison with the payslip in euros has to wait until your hourly wage is entered.", "missing data start incomplete later add retroactive"], ["Where do I find the feedback to the developer?", "At the bottom left of the app is the \"Report a problem\" button. Tap it, choose for example \"Something is wrong\" or \"Suggestion\" under \"What is it about?\", write your message and tap Send. The app also sends a picture of the current page, which you can switch off. Afterwards you see a confirmation. You also find the feedback in your profile under \"Feedback to the developer\".", "feedback developer report problem suggestion contact where"], ["Special leave and work on the same day", "Choose Special leave (Sonderurlaub) or Vacation under “Day type” in Erfassen. The day is credited with the target hours. If you worked that day anyway, enter start and end: the day then shows “plus work” and your working time is added to the paid target hours. On the payslip special leave usually has its own line, which the app compares separately.", "special leave sonderurlaub wedding funeral moving worked anyway plus work"], ["Expected gross pay and payout", "In the overview, below the hours, you see your expected gross pay calculated from your records: wages, overtime, bonuses and duties, per diems extra. The app does not show net pay because it depends on several factors, for example social insurance, income tax, family bonus and commuter allowance. If you enter your payday under “Auszahlung am” in the settings, the overview also shows the date. The gross pay appears only once the month is over, because entries may still be missing before that.", "gross net preview payout payday salary money earnings"], ["Truck driving in Germany: agreement, allowances and night", "Germany has no single collective agreement: it applies per federal state and only if your employer is bound by it. Forwarding and logistics for North Rhine-Westphalia, Bavaria, Saxony and Berlin are stored. If you choose Germany during setup, you enter your federal state for the public holidays. If your employer is not bound, take wage and surcharges from your employment contract and choose \"Own values\". Long-distance drivers often have their own agreements. Meal allowance is tax-free up to €14 (more than 8 hours) and €28 (24 hours), plus €9 per night in the truck: you enter the overnight stay as a bonus. Night surcharges too. Compare everything with your payslip.", "germany german forwarding long distance allowance agreement nrw berlin overnight night"], ["Words on the payslip", "Entgeltfortzahlung (continued pay): the company keeps paying your wage, mostly during sick leave. Aufrollung (recalculation): the payroll clerk recalculates earlier months, for example after a pay rise, and pays or offsets the difference. Rückverrechnung (reversal): something that was already settled is calculated back again. Vorschuss (advance): a payment in advance that is deducted at settlement. Pfändung (garnishment): on a court order the company withholds an amount and passes it on. Sachbezug (benefit in kind): an advantage from the company, for example a company car for private trips. Its value is added to your pay but not paid out. MA-Vorsorgekasse: the company pays into your severance fund. You only need to check that the line is there. The payslip often does not name the collective agreement at all. Look at “Tarifgruppe” and “Beschäftigt als” (employed as): that is your classification."], ["Check net pay with the BMF calculator", "The app does not calculate net pay itself. The button opens the gross-net calculator of the Austrian Ministry of Finance (BMF) in a new window. It is a non-binding model calculation. Enter the gross amount from above and set: period Monthly, contribution group as on your payslip (worker or employee), year, the federal state of your workplace, commuter allowance and children as they apply to you. Compare the net result with the line Auszahlung (payout) on your payslip. Small differences are normal, for example because of per diems, union dues or advances."], ["Quick entry (text, voice, photo)", "With “Quick entry” you simply write or say what you worked, for example “yesterday 6 to 15, 30 minutes break, customer Müller excavation”. I turn it into entries, you check them and save. You can also take a photo of your daily report and I take the times from it. The function is off at first: switch it on under Settings, “Input aids”. Then the card is at the very top of Log. The microphone needs internet and your permission.", "quick entry voice message dictate speak daily report photo text whatsapp"], ["Reading the payslip from a photo or PDF", "In the Payslip tab, allow the app once under “Read payslip automatically” to read your payslip. Then tap “Read payslip” and choose a photo or the PDF file. I read it only here on your phone, nothing is uploaded. You confirm every line, then everything is in “Is my payslip correct?”. If I don't know a line, you assign it once and I remember it for the next months. Under Settings, “Settings with the payslip”, I also use it to check your settings.", "photo picture pdf scan read payslip camera automatic"], ["Two calculations: collective agreement and company", "I always calculate twice: once as it should be under the collective agreement and the law, and once as your company handles it, according to your settings. The law and the collective agreement take priority. You see a difference in the overview and in the payslip comparison. Under Overview, “Year and accounts”, every deviation stays in “Recorded deviations”, even if the company always does it that way. You can copy the list and show it to the Chamber of Labour, for example. Everything is without guarantee: a difference can also come from a typing mistake.", "deviation difference company law two calculations recorded chamber labour rights underpaid"], ["Collective agreement and federal state", "Under Settings, “My job”, you choose your job and under “My collective agreement” the right agreement. Many collective agreements differ by federal state. Enter your federal state under Settings, “My details”, then I suggest the right agreement and the allowances of your state and tell you if something doesn't fit. If you can't find your agreement, choose “Own values” and enter wage and surcharges from your employment contract.", "federal state collective agreement which agreement contract tariff vienna tyrol styria carinthia salzburg"], ["Which jobs are there?", "Among others: truck, excavator, small transport, bus and taxi, construction and crafts, warehouse, workshop, industry, food industry, retail, office, field sales, restaurants and hotels, bakery, confectionery, butchery, cleaning, security, care and social work, ambulance service, doctor's practice, dental technology, opticians, hairdresser, cosmetics, post, railway, federal service, gardening and forestry, cable cars, cinema, chimney sweeps, garage and petrol station, laundry, plastics and pest control, each with apprentices where there are any. If yours is missing, choose “Something else” and enter your own values. Tell me via “Report a problem” which job is missing.", "jobs which job missing profession industry sector work as"], ["Report to the company (PDF)", "At the very bottom of Log you find “Report to the company”: choose day, week, half month or month and “Create PDF and send” or save it. Under Settings, “Reports to the company”, you set the name on it, when the company wants the report, the company's e-mail and whether your signature is printed. Then I remind you in time.", "report pdf timesheet send company signature print monthly weekly"], ["Holiday, time off and overtime at a glance", "Under Overview, “Year and accounts”, you find the hours record, the holiday card with entitlement, days taken and remaining holiday, the time-off account and “Overtime overview”: what you recorded, what was paid out and what went to the account. Enter the balance from your payslip and you see right away whether it fits. I calculate your holiday entitlement from the start date in your profile.", "remaining holiday entitlement balance time off account overtime overview record card"], ["Plan days off (bridge days)", "Under Overview, “Year and accounts”, “Plan days off” shows you the best bridge days: as many days off in a row as possible with few holiday or time-off days. Saturday and Sunday count as free. Ask at work beforehand whether people work on those days.", "bridge day plan days off long weekend holiday planning"], ["Designing Mia: figure, clothes, colours, voice", "Under Profile, “My companion”, you choose my figure and my name. With “Design Mia myself” you pick clothes, accessories and colours, for example a yellow or orange high-vis vest. Switched off, I dress to match your job. There you also set whether I speak with a voice, and below it you choose your app icon.", "look figure clothes colour colours vest voice design dress name milo icon picture"], ["Trial mode", "Under Settings you find Trial mode. With it you try other jobs or settings without changing your real data. A red notice is shown at the top. With “Back to my data” you return, and everything you tried is deleted.", "trial try test other job play mode"], ["Customers, sites, vehicle and kilometres", "Under Settings, “What I record”, you switch on what else you want to write down: vehicle and kilometres, customers, sites and tasks, or bonuses. Then the matching fields appear in Log, for example “+ Add customer / site” with the time per customer. In your profile you can set that the mileage from last time is filled in automatically.", "customer customers site construction task vehicle kilometres mileage plate truck order"], ["Company closed and fixed days off", "If the company is closed, choose “Company closed / company holiday” under “Type of day”. How the company pays it, as holiday or from your overtime, you set under Settings, “Company closed”. If you are off on the same day every week or have vocational school, set it up once under Settings, “Fixed days off”. Then I enter those days for you.", "company closed holiday shutdown fixed days off every week school day"], ["Account and several devices", "With your account (e-mail and password) your data is also backed up on the server. If you log in on another phone or computer, all entries are there too. Without internet the app saves on the device and syncs later. Under Settings, “Account”, you see whether everything is saved and you can log out.", "account login logout password new phone computer second device sync"], ["Ambulance service and patient transport", "At the Red Cross the Red Cross collective agreement applies, at the Samariterbund the Samariterbund agreement (BARS), both per federal state. For private ambulance and patient transport companies without their own agreement, for example Grünes Kreuz, the Red Cross agreement applies. According to the Supreme Court, patient transport must not be paid under the taxi agreement. Under Settings choose the job “Ambulance service” and your agreement.", "ambulance red cross samariter patient transport paramedic rescue johanniter malteser"], ["Note for the day: who wanted the day off?", "In Log you write everything important under “Note for the day”. For days off you also record there who wanted it: you yourself, agreed with the company or ordered by the company. This matters later for time off, holiday or pay, and the notes are shown with the deviations.", "note remark ordered who wanted agreed boss request"], ["Helping out and questions to the developer", "Under Settings, “Help out (optional)”, you can allow me to report anonymously which job you are in and how much payslip and records differ, without name, e-mail or exact amounts. You can also allow me to send questions I can't answer to the developer so I learn. Both are optional and can be switched off at any time.", "help anonymous statistics support learn developer"]],
    pl: [["Co potrafi aplikacja", "Stunden-Checker pokazuje, czy twoja wypłata się zgadza. Wpisujesz czas pracy, a ja liczę nadgodziny, dodatki, diety i premie według twojego układu zbiorowego i prawa oraz porównuję wszystko z paskiem wypłaty. Różnice zostają zapisane, nawet jeśli firma robi inaczej. Do tego: szybkie wprowadzanie tekstem, głosem lub zdjęciem raportu dziennego, czytanie paska wypłaty ze zdjęcia lub PDF, konto urlopu i odbioru nadgodzin, terminy ważności dokumentów, planowanie dni pomostowych i raporty dla firmy jako PDF. Jest ponad 30 branż z ponad 150 układami zbiorowymi dla wszystkich krajów związkowych, a aplikacja mówi w 13 językach. Po prostu zapytaj mnie albo dotknij tematu poniżej.", "co potrafi aplikacja wszystko funkcje przeglad pomoc do czego"], ["Wpisywanie godzin", "Otwórz Erfassen (wpisywanie). Wpisz początek (Beginn) i koniec (Ende), dodaj przerwy (Pausen) i dotknij Speichern (zapisz). Przyciskiem \"Jetzt\" wstawisz aktualną godzinę.", "godzin godzine wpis czas praca poczatek koniec zapis"], ["Dodanie premii", "Wejdź w Einstellungen (ustawienia), potem Prämien (premie) i dodaj swoją premię, np. za godzinę, dzień lub sztukę. Potem wpisujesz ją w danym dniu. Aplikacja ją policzy i porówna z paskiem wypłaty.", "premi dodatek bonus"], ["Sprawdzenie paska wypłaty", "Otwórz zakładkę „Odcinek płacy” i przewiń do „Czy mój pasek wypłaty się zgadza?”. Przepisz godziny i kwoty albo pozwól mi przeczytać pasek ze zdjęcia lub PDF (u góry w „Automatyczne czytanie paska płacowego”). Aplikacja pokaże, co się zgadza i gdzie zostaje różnica w godzinach lub euro. Nie musisz wypełniać wszystkich wierszy.", "pasek wyplaty odcinek sprawdzic zgadza porownac rozliczenie"], ["Nadgodziny i dodatki", "W Einstellungen znajdziesz godziny tygodniowo, model nadgodzin i dodatki. Pochodzą z układu zbiorowego (Kollektivvertrag). Czy się zgadzają, widzisz na pasku wypłaty. Możesz je zmienić w każdej chwili, także od wybranej daty.", "nadgodzin dodatek niedziel sobot swiet nocn"], ["Diety (Diäten)", "Diäten to dieta, czyli dodatek dzienny. W Einstellungen, Diäten, ustawiasz, czy jest płacona za godzinę czy za dzień. Kwotę znajdziesz na pasku wypłaty.", "diet diaet dzienn delegac"], ["Zmiana stawki lub zawodu", "W Einstellungen możesz zmienić stawkę lub zawód od wybranej daty. Stare dni zostają policzone po starych wartościach.", "stawk zmien zawod podwyzk wynagrodz"], ["Urlop lub zwolnienie", "W Erfassen wybierz przy \"Art des Tages\" np. Urlaub (urlop), Krankenstand (zwolnienie) lub Zeitausgleich (odbiór nadgodzin). Wtedy nie musisz wpisywać godzin.", "urlop zwolnien chorob l4 wolne"], ["Moje dane i ochrona danych", "Twoje wpisy są zapisane w telefonie. Z kontem są dodatkowo przechowywane na zabezpieczonym serwerze we Frankfurcie, żeby nic nie zginęło. Technicznie operator aplikacji mógłby je zobaczyć. Szyfrowanie, które to wyklucza, jest w przygotowaniu. Zdjęcia i pliki PDF pasków wypłaty i raportów dziennych czytam tylko w twoim telefonie, nie są wysyłane. Zapisywane są tylko liczby, które potwierdzisz. Twoja firma nic z tego nie widzi.", "dane ochrona bezpieczne konto zapisane prywatne przekazane"], ["Kopia zapasowa", "W Einstellungen (Ustawienia) na samym dole znajdziesz \"Sicherung speichern oder teilen\". Zapisuje plik z wszystkimi danymi. Dzięki niemu odtworzysz wszystko na nowym telefonie.", "kopia zapas backup odtworz zgubi"], ["Instalacja aplikacji", "Otwórz stronę w przeglądarce i dotknij \"App installieren\" (menu u góry po prawej). Jeśli Android ostrzega, dotknij \"Trotzdem installieren\" (mimo to zainstaluj). Aplikacja jest bezpieczna, to po prostu ta strona.", "instal ikon ekran aplikacj"], ["Język i czytanie na głos", "Język aplikacji wybierasz na samej górze strony. Gdy mnie o coś pytasz, dotknij mikrofonu i mów. Przyciskiem „Przeczytaj na głos” czytam ci odpowiedź. Mikrofon potrzebuje internetu i twojej zgody w przeglądarce.", "jezyk mowic mikrofon dyktowac przeczytaj glos polski tlumaczenie"], ["Wyciszenie Mii", "Dotknij „Wycisz Mię”, a nie będę się już sama odzywać, tylko gdy mnie dotkniesz. Ten sam przycisk włącza mnie z powrotem. Postać, imię i wygląd zmienisz w Profilu, „Mój towarzysz”.", "mia milo wycisz cicho denerwuje wylacz"], ["Terminy i uprawnienia", "Otwórz Profil i przewiń do \"Fristen und Ausweise\" (Terminy i uprawnienia). Dodaj Code 95, kartę kierowcy, uprawnienia na wózek lub własne terminy z datą ważności. Przypomnę ci na czas, a termin może trafić do kalendarza w telefonie.", "termin terminy uprawnienia code 95 karta kierowcy wozek dzwig waznosc kurs szkolenie przypomnienie"], ["Dopłaty, wyrównanie stawki, wypłaty specjalne", "Jeśli firma później coś dopłaciła lub cofnęła, wpisz to w miesięcznym sprawdzeniu w „Nachzahlungen und Korrekturen” (dopłaty i korekty): za który miesiąc, który wiersz i ile. Aplikacja doliczy to do wcześniejszego miesiąca. Przy „Stundenlohn aufgerollt” (stawka przeliczona wstecz) pokaże obliczenie i czy kwota się zgadza. Ekwiwalent urlopowy, premię świąteczną, 13. i 14. pensję wpisz w zakładce „Lohnzettel” w „Sonderzahlungen” (wypłaty specjalne).", "doplata nachzahlung wyrownanie stawki korekta swiateczna urlopowy 13 14 specjalne stawka"], ["Nowości", "W profilu znajdziesz kartę „Nowości”. Tam włączasz, żeby Mia mówiła Ci nowości, i ustawiasz, jak często: od razu, co tydzień lub co miesiąc. Dostajesz tylko to, co pasuje do Twojego zawodu. Jeśli chcesz widzieć też resztę, włącz „Także nowości dla innych zawodów”.", "nowosci wiadomosci funkcje"], ["Niepełny etat, dodatkowa praca i czas wolny", "Jeśli pracujesz w niepełnym wymiarze i więcej niż uzgodniono, to do granicy pełnego etatu według Twojego układu zbiorowego jest to praca dodatkowa, a nie nadgodziny. Dodatek wynosi 25 %, chyba że odbierzesz godziny 1:1 jako czas wolny w tym samym kwartale. Aplikacja liczy to automatycznie. Twój układ zbiorowy może to regulować inaczej.", "niepelny etat dodatkowa praca czas wolny kwartal"], ["Urlop wychowawczy, ochrona macierzyństwa, miesiąc dla taty", "W Erfassen wybierz przy „Art des Tages” Karenz, Mutterschutz lub Papamonat. Te dni są niepłatne i nie mają godzin do przepracowania. Karenz proporcjonalnie skraca prawo do urlopu, Mutterschutz nie.", "urlop wychowawczy macierzynstwo tata karenz"], ["Czas ruchomy", "Przy czasie ruchomym aplikacja liczy plusowe i minusowe godziny na koncie. Przy konfiguracji wybierz „Biuro z czasem ruchomym” lub w Einstellungen model nadgodzin „Gleitzeit”. Tam wpisujesz planowany czas na dzień, opcjonalnie saldo początkowe i limit przeniesienia. Dzień wolny w czasie ruchomym (odbiór) odejmuje planowany czas z konta, urlop i choroba nie.", "czas ruchomy konto saldo plus minus godziny"], ["Brak pracy / zwolnienie przez firmę", "W Erfassen wybierz przy „Art des Tages” „Brak pracy (zwolniony przez firmę)”, gdy firma odsyła cię do domu z braku pracy. Notatka do dnia ustawia się sama. Jak firma rozlicza ten dzień, ustawiasz w Einstellungen w „Zwolnienie z pracy (brak pracy)”: firma płaci dalej, odliczenie od czasu wolnego albo bezpłatnie. Jeśli nie wiesz, aplikacja niczego nie odlicza. AK też uznaje to za zasadę podstawową: kto jest gotowy do pracy i zostaje odesłany do domu, zachowuje wynagrodzenie. Na pasku wypłaty zobaczysz, czy się zgadza.", "zwolnienie brak pracy do domu czas wolny"], ["Czas wolny: 1:1,5 czy 1:1?", "Ustawa o czasie pracy (§ 10) mówi: dodatek za nadgodziny trzeba uwzględnić przy czasie wolnym albo wypłacić osobno. Przy dodatku 50 % to albo 1 nadgodzina = 1,5 godziny wolnego, albo 1:1 i dodatek trafia na pasek wypłaty. Układ zbiorowy może to regulować inaczej. Ustaw w Einstellungen w „Jak twoja firma zapisuje nadgodziny jako czas wolny?”. Przy wykorzystaniu czas wolny jest odliczany godzina za godzinę. W Niemczech nie ma ustawowego stosunku, obowiązuje twoja umowa.", "czas wolny nadgodziny dodatek 1:1,5 stosunek"], ["Gdzie to znajdę na pasku wypłaty?", "U góry paska wypłaty zwykle jest twoje imię, firma, miesiąc i często zaszeregowanie, grupa płacowa i układ zbiorowy (czasem skrót „KV”). Stawkę godzinową znajdziesz w wierszu „Lohn” lub „Stundenlohn”, godziny obok w kolumnie „Menge”. Nadgodziny często mają osobne wiersze z 50 % lub 100 %, czas wolny wiersz typu „Zeitausgleich” lub „Zeitkonto”, urlop często jako „Resturlaub”. Godziny tygodniowo są w umowie o pracę. Jeśli czegoś nie ma, zapytaj w biurze lub w księgowości płac. Jeśli czegoś nie wiesz, zostaw pole puste w aplikacji. Do tego czasu aplikacja liczy z wartościami z układu zbiorowego.", "pasek wyplaty gdzie znalezc zaszeregowanie grupa platnicza uklad zbiorowy kv"], ["Jestem uczniem (praktykantem)", "Jako uczeń dostajesz wynagrodzenie ucznia, zwykle stałą kwotę miesięczną za rok nauki. W ustawieniach w „Mój zawód” wybierz rodzaj „Uczeń”. Aplikacja pokaże wtedy przy grupie płacowej tylko lata nauki Twojego układu zbiorowego, a po wybraniu „Użyj płacy minimalnej z układu zbiorowego” wpisze kwotę. Jeśli w umowie o naukę jest inna kwota, wpisz ją w „Stała płaca miesięczna”. Szkoła zawodowa liczy się jako czas pracy: wpisz ten dzień jako „Szkolenie / szkoła zawodowa”, stały dzień szkolny w każdym tygodniu w „Stałe dni wolne”. Poniżej 18 lat obowiązuje ustawa o ochronie młodzieży, zasadniczo najwyżej 8 godzin dziennie i 40 tygodniowo. W razie pytań pomoże Izba Pracy (Arbeiterkammer).", "uczen praktykant szkola zawodowa nauka wynagrodzenie"], ["Dodatki w budownictwie i rzemiośle", "W budownictwie i rzemiośle na pasku wypłaty często są dodatki: za brudną, uciążliwą i niebezpieczną pracę, dieta lub dodatek za odległość przy pracy poza domem, dodatek za nocleg i za montaż. Dodaj je w Ustawienia, Premie, Mia podpowie Ci pasujące. Przy złej pogodzie w budownictwie i budownictwie drewnianym część płacy wypłaca BUAK, aplikacja prowadzi godziny złej pogody osobno. W malarstwie przy odwołaniu pracy z powodu pogody dostaje się 60 % płacy. Kwoty są różne w zależności od układu zbiorowego, porównaj je z paskiem wypłaty.", "dodatek budownictwo rzemioslo zla pogoda nocleg montaz buak"], ["Sprzątanie, ochrona i pielęgniarstwo", "W tych zawodach wiele dzieje się na służbach nocnych, niedzielnych i świątecznych. Wpisuj czasy tak, jak pracowałeś, także po północy: godziny liczą się do dnia, w którym zaczęła się służba. Dodatki (na przykład dodatek nocny, dieta, dyżur pod telefonem) są na odcinku płacowym: załóż je w Ustawieniach w Premiach, Mia podpowie ci właściwe. Jeśli obowiązuje cię inny układ zbiorowy (na przykład szpital krajowy), wybierz „Własne wartości”."], ["Zmiana czasu (czas letni, czas zimowy)", "Aplikacja uwzględnia zmianę czasu automatycznie. W październiku zegar cofa się z 3:00 na 2:00: kto pracuje tej nocy, przepracował o godzinę więcej. Nocna zmiana od 22:00 do 6:00 liczy się wtedy jako 9 zamiast 8 godzin. W marcu zegar przesuwa się z 2:00 na 3:00: brakuje jednej godziny, zmiana liczy się jako 7 zamiast 8 godzin. Wpisz po prostu początek i koniec tak, jak pokazywał zegar. To, czy firma płaci za dodatkową godzinę, wynika z układu zbiorowego lub porozumienia zakładowego: sprawdź odcinek płacowy. W razie różnic możesz sam poprawić godziny w danym dniu."], ["Czym jest grupa płacowa i czy jej potrzebuję?", "Grupa płacowa (lub zaszeregowanie) określa, jaką płacę minimalną przyznaje ci układ zbiorowy. Nie musisz jej znać: wpisz po prostu swoją stawkę godzinową z odcinka płacowego. Jeśli ją znasz, aplikacja może sprawdzić, czy twoje wynagrodzenie odpowiada układowi zbiorowemu. Znajdziesz ją na górze odcinka płacowego (przy „Einstufung”, „Lohngruppe” lub „Verwendungsgruppe”) albo w umowie o pracę. Jeśli nigdzie jej nie ma, zapytaj w firmie.", "grupa płacowa zaszeregowanie płaca minimalna"], ["Brakuje mi jeszcze danych, czy mogę zacząć?", "Tak, możesz zacząć od razu, nawet jeśli brakuje stawki, zaszeregowania lub innych danych. Wpisz to, co już masz, na przykład godziny pracy. Brakujące wartości możesz uzupełnić w ustawieniach w każdej chwili. Aplikacja automatycznie i poprawnie przeliczy wtedy wszystkie dni, które już wpisałeś. Tylko porównanie z odcinkiem płacowym w euro musi poczekać, aż wpiszesz stawkę godzinową.", "brakuje dane zacząć niekompletne później"], ["Gdzie znajdę wiadomość do twórcy?", "W lewym dolnym rogu aplikacji jest przycisk „Zgłoś problem”. Dotknij go, wybierz przy „O co chodzi?” na przykład „Coś się nie zgadza” lub „Sugestia”, napisz wiadomość i dotknij Wyślij. Aplikacja dołącza zdjęcie bieżącej strony, możesz to wyłączyć. Potem zobaczysz potwierdzenie. Wiadomość do twórcy znajdziesz też w profilu.", "opinia twórca zgłoś problem sugestia kontakt gdzie"], ["Urlop okolicznościowy i praca tego samego dnia", "W Erfassen w polu „Art des Tages” wybierz Sonderurlaub (urlop okolicznościowy) lub Urlaub. Dzień zostaje zaliczony w godzinach normatywnych. Jeśli tego dnia mimo to pracowałeś, wpisz początek i koniec: dzień pokaże „plus praca”, a czas pracy zostanie dodany do płatnych godzin normatywnych. Na pasku wypłaty urlop okolicznościowy ma zwykle osobny wiersz, który aplikacja porównuje oddzielnie.", "urlop okolicznosciowy sonderurlaub slub pogrzeb przeprowadzka praca"], ["Przewidywane brutto i wypłata", "W przeglądzie pod godzinami widzisz przewidywane brutto obliczone z Twoich zapisów: wynagrodzenie, nadgodziny, premie i dyżury, diety osobno. Aplikacja nie pokazuje netto, bo zależy ono od kilku czynników, na przykład ubezpieczenia społecznego, podatku dochodowego, ulgi rodzinnej i ryczałtu dla dojeżdżających. Jeśli w ustawieniach przy „Auszahlung am” wpiszesz dzień wypłaty, przegląd pokaże też datę. Brutto pojawia się dopiero po zakończeniu miesiąca, bo wcześniej mogą brakować wpisów.", "brutto netto podglad wyplata pensja zarobki"], ["Jazda ciężarówką w Niemczech: układ, diety i noc", "W Niemczech nie ma jednego układu zbiorowego: obowiązuje w danym kraju związkowym i tylko wtedy, gdy Twój zakład jest nim związany. Zapisane są spedycja i logistyka dla Nadrenii Północnej-Westfalii, Bawarii, Saksonii i Berlina. Jeśli przy ustawianiu wybierzesz Niemcy, wpisz swój kraj związkowy dla świąt. Jeśli Twój zakład nie jest związany, weź stawkę i dodatki z umowy o pracę i wybierz „Własne wartości”. Kierowcy dalekobieżni często mają własne umowy. Dieta jest wolna od podatku do 14 € (ponad 8 godzin) i 28 € (24 godziny), plus 9 € za noc w ciężarówce: nocleg wpisz jako premię. Dodatki nocne również. Porównaj wszystko z paskiem wypłaty.", "niemcy spedycja dalekobieżny dieta układ nrw berlin nocleg noc"], ["Pojęcia na pasku wypłaty", "Entgeltfortzahlung (dalsza wypłata): firma nadal płaci wynagrodzenie, najczęściej na zwolnieniu chorobowym. Aufrollung (przeliczenie): księgowy przelicza wcześniejsze miesiące, np. po podwyżce, i dopłaca lub potrąca różnicę. Rückverrechnung (cofnięcie rozliczenia): coś, co już rozliczono, zostaje rozliczone z powrotem. Vorschuss (zaliczka): wypłata z góry, potrącana przy rozliczeniu. Pfändung (zajęcie komornicze): na polecenie sądu firma zatrzymuje kwotę i przekazuje ją dalej. Sachbezug (świadczenie rzeczowe): korzyść od firmy, np. samochód służbowy do jazd prywatnych. Jego wartość jest doliczana do wynagrodzenia, ale nie jest wypłacana. MA-Vorsorgekasse: firma wpłaca na twoją odprawę. Wystarczy sprawdzić, czy ten wiersz jest. Układu zbiorowego pasek często w ogóle nie podaje. Sprawdź „Tarifgruppe“ i „Beschäftigt als“ (zatrudniony jako): to twoje zaszeregowanie."], ["Sprawdzanie netto w kalkulatorze BMF", "Aplikacja sama nie liczy netto. Przycisk otwiera w nowym oknie kalkulator brutto-netto austriackiego Ministerstwa Finansów (BMF). To niewiążące obliczenie modelowe. Wpisz tam kwotę brutto z góry i ustaw: okres miesięczny, grupę składkową jak na odcinku płacowym (pracownik fizyczny lub umysłowy), rok, kraj związkowy miejsca pracy, ryczałt dojazdowy i dzieci tak, jak u Ciebie. Porównaj netto z pozycją „Auszahlung” (wypłata) na odcinku płacowym. Małe różnice są normalne, na przykład przez diety, składkę związkową lub zaliczki."], ["Szybkie wprowadzanie (tekst, głos, zdjęcie)", "W „Szybkim wprowadzaniu” po prostu piszesz lub mówisz, co robiłeś, np. „wczoraj od 6 do 15, 30 minut przerwy, klient Müller wykop”. Robię z tego wpisy, ty je sprawdzasz i zapisujesz. Możesz też zrobić zdjęcie raportu dziennego, a ja przejmę z niego godziny. Funkcja jest na początku wyłączona: włącz ją w Ustawieniach, „Pomoce przy wprowadzaniu”. Potem karta jest na samej górze w zakładce Wpisywanie. Mikrofon potrzebuje internetu i twojej zgody.", "szybkie wprowadzanie wiadomosc glosowa dyktowac mowic raport dzienny zdjecie tekst"], ["Pasek wypłaty ze zdjęcia lub PDF", "W zakładce „Odcinek płacy” pozwól raz w „Automatyczne czytanie paska płacowego”, żeby aplikacja czytała twój pasek. Potem dotknij „Czytaj pasek płacowy” i wybierz zdjęcie lub plik PDF. Czytam go tylko tutaj w telefonie, nic nie jest wysyłane. Potwierdzasz każdy wiersz, potem wszystko jest w porównaniu „Czy mój pasek wypłaty się zgadza?”. Jeśli nie znam jakiegoś wiersza, przypisujesz go raz, a ja zapamiętam go na kolejne miesiące. W Ustawieniach, „Ustawienia z paskiem wypłaty”, sprawdzam nim też twoje ustawienia.", "zdjecie fotografia pdf skan czytac pasek aparat automatycznie"], ["Dwa rachunki: układ zbiorowy i firma", "Zawsze liczę dwa razy: raz tak, jak powinno być według układu zbiorowego i prawa, i raz tak, jak robi to twoja firma, czyli według twoich ustawień. Prawo i układ zbiorowy mają pierwszeństwo. Różnicę widzisz w przeglądzie i w porównaniu z paskiem. W Przeglądzie, „Rok i konta”, każde odchylenie zostaje w „Zapisane odchylenia”, nawet jeśli firma zawsze tak robi. Listę możesz skopiować i pokazać np. Izbie Pracy (Arbeiterkammer). Wszystko bez gwarancji: różnica może też wynikać z błędu przy wpisywaniu.", "odchylenie roznica firma prawo dwa rachunki zapisane izba pracy za malo"], ["Układ zbiorowy i kraj związkowy", "W Ustawieniach, „Mój zawód”, wybierasz zawód, a w „Mój układ zbiorowy” właściwy układ. Wiele układów różni się w zależności od kraju związkowego. Wpisz swój kraj związkowy w Ustawieniach, „Moje dane”, wtedy zaproponuję właściwy układ i dodatki twojego kraju i powiem, gdy coś nie pasuje. Jeśli nie znajdziesz swojego układu, wybierz „Własne wartości” i wpisz płacę i dodatki z umowy o pracę.", "kraj zwiazkowy uklad zbiorowy ktory umowa wieden tyrol styria karyntia salzburg"], ["Jakie zawody są w aplikacji?", "M.in. ciężarówka, koparka, mały transport, autobus i taksówka, budowa i rzemiosło, magazyn, warsztat, przemysł, przemysł spożywczy, handel, biuro, przedstawiciel handlowy, gastronomia i hotel, piekarnia, cukiernia, masarnia, sprzątanie, ochrona, opieka i sprawy socjalne, ratownictwo, gabinet lekarski, technika dentystyczna, optyka, fryzjer, kosmetyka, poczta, kolej, służba federalna, ogrodnictwo i leśnictwo, kolejki linowe, kino, kominiarz, warsztat i stacja benzynowa, pralnia, tworzywa sztuczne i dezynsekcja, wszędzie z uczniami, gdzie są. Jeśli twojego zawodu nie ma, wybierz „Coś innego” i wpisz własne wartości. Napisz mi przez „Zgłoś problem”, jakiego zawodu brakuje.", "zawody jaki zawod brakuje branza praca pracuje jako"], ["Raport dla firmy (PDF)", "Na samym dole zakładki Wpisywanie jest „Raport dla firmy”: wybierz dzień, tydzień, pół miesiąca lub miesiąc i „Utwórz PDF i wyślij” albo zapisz. W Ustawieniach, „Raporty dla firmy”, ustawiasz nazwisko na raporcie, kiedy firma chce raport, e-mail firmy i czy drukować twój podpis. Wtedy przypomnę ci w porę.", "raport pdf karta czasu pracy wyslac firma podpis drukowac miesieczny tygodniowy"], ["Urlop, odbiór nadgodzin i nadgodziny w skrócie", "W Przeglądzie, „Rok i konta”, znajdziesz kartę godzin, kartę urlopową z wymiarem, wykorzystanymi dniami i pozostałym urlopem, konto odbioru nadgodzin i „Nadgodziny w skrócie”: co zapisałeś, co wypłacono i co poszło na konto. Wpisz stan z paska wypłaty, a od razu zobaczysz, czy się zgadza. Wymiar urlopu liczę z daty zatrudnienia w profilu.", "pozostaly urlop wymiar karta urlopowa konto odbioru stan nadgodziny skrocie karta godzin"], ["Planowanie dni wolnych (dni pomostowe)", "W Przeglądzie, „Rok i konta”, „Planuj dni wolne” pokazuje najlepsze dni pomostowe: jak najwięcej wolnych dni z rzędu przy małej liczbie dni urlopu lub odbioru nadgodzin. Sobota i niedziela liczą się jako wolne. Zapytaj wcześniej w firmie, czy w te dni się pracuje.", "dzien pomostowy planowac dni wolne dlugi weekend urlop planowanie"], ["Wygląd Mii: postać, ubranie, kolory, głos", "W Profilu, „Mój towarzysz”, wybierasz moją postać i imię. Opcją „Zaprojektuj postać sam” wybierasz ubranie, dodatki i kolory, np. żółtą lub pomarańczową kamizelkę odblaskową. Gdy jest wyłączona, ubieram się pasująco do twojego zawodu. Tam też ustawiasz, czy mówię głosem, a niżej wybierasz ikonę aplikacji.", "wyglad postac ubranie kolor kamizelka glos zaprojektowac imie milo ikona zdjecie"], ["Tryb próbny", "W Ustawieniach jest tryb próbny. Możesz w nim wypróbować inne zawody lub ustawienia bez zmiany twoich prawdziwych danych. U góry widać wtedy czerwoną informację. Przyciskiem „Wróć do moich danych” wracasz, a wszystko, co próbowałeś, zostaje usunięte.", "tryb probny wyprobowac testowac inny zawod"], ["Klienci, budowy, pojazd i kilometry", "W Ustawieniach, „Co zapisuję”, włączasz, co jeszcze chcesz zapisywać: pojazd i kilometry, klientów, budowy i czynności albo premie. Wtedy w zakładce Wpisywanie pojawiają się odpowiednie pola, np. „+ Dodaj klienta / budowę” z czasem dla każdego klienta. W profilu możesz ustawić, żeby stan licznika z ostatniego razu wpisywał się automatycznie.", "klient klienci budowa czynnosc pojazd kilometry licznik rejestracja zlecenie"], ["Zakład zamknięty i stałe dni wolne", "Gdy zakład jest zamknięty, wybierz w „Rodzaj dnia” „Zakład zamknięty / urlop zakładowy”. Jak firma za to płaci, jako urlop czy z twoich nadgodzin, ustawiasz w Ustawieniach, „Zakład zamknięty”. Jeśli co tydzień masz wolne tego samego dnia albo szkołę zawodową, ustaw to raz w Ustawieniach, „Stałe dni wolne”. Wtedy wpiszę te dni za ciebie.", "urlop zakladowy zaklad zamkniety firma zamknieta stale dni wolne co tydzien szkola"], ["Konto i kilka urządzeń", "Z kontem (e-mail i hasło) twoje dane są dodatkowo zabezpieczone na serwerze. Gdy zalogujesz się na innym telefonie lub komputerze, wszystkie wpisy są też tam. Bez internetu aplikacja zapisuje na urządzeniu i synchronizuje później. W Ustawieniach, „Konto”, widzisz, czy wszystko jest zapisane, i możesz się wylogować.", "konto logowanie wyloguj haslo nowy telefon komputer drugie urzadzenie synchronizacja"], ["Ratownictwo i transport sanitarny", "W Czerwonym Krzyżu obowiązuje układ Czerwonego Krzyża, w Samariterbund układ Samariterbund (BARS), oba według kraju związkowego. Dla prywatnych firm ratownictwa i transportu sanitarnego bez własnego układu, np. Grünes Kreuz, obowiązuje układ Czerwonego Krzyża. Według Sądu Najwyższego transport sanitarny nie może być opłacany według układu dla taksówek. W Ustawieniach wybierz zawód „Ratownictwo” i swój układ.", "ratownictwo czerwony krzyz samariter transport sanitarny ratownik karetka johanniter malteser"], ["Notatka do dnia: kto chciał wolne?", "W zakładce Wpisywanie zapisujesz w „Notatka do dnia” wszystko, co ważne. Przy dniach wolnych zaznaczasz tam też, kto tego chciał: ty sam, uzgodnione z firmą czy zarządzone przez firmę. To ma znaczenie później przy odbiorze nadgodzin, urlopie lub płacy, a notatki są widoczne przy odchyleniach.", "notatka uwaga zarzadzone kto chcial uzgodnione szef zyczenie"], ["Pomoc i pytania do twórcy", "W Ustawieniach, „Pomóż (opcjonalnie)”, możesz pozwolić, żebym anonimowo zgłaszała, w jakim zawodzie jesteś i jak bardzo pasek wypłaty różni się od zapisów, bez imienia, e-maila i dokładnych kwot. Możesz też pozwolić, żebym wysyłała twórcy pytania, na które nie umiem odpowiedzieć, żebym się uczyła. Oba są opcjonalne i można je w każdej chwili wyłączyć.", "pomoc anonimowo statystyka wspierac uczyc tworca"]],
    hu: [["Mit tud az alkalmazás", "A Stunden-Checker megmutatja, hogy stimmel-e a béred. Te beírod a munkaidődet, én kiszámolom a túlórát, a pótlékokat, a napidíjat és a prémiumokat a kollektív szerződésed és a törvény szerint, és mindent összevetek a bérjegyzékkel. Az eltérések rögzítve maradnak, akkor is, ha a cég másképp kezeli. Ezen kívül: gyors rögzítés szöveggel, hanggal vagy a napi jelentés fotójával, bérjegyzék beolvasása fotóról vagy PDF-ből, szabadság- és időkiegyenlítési számla, igazolványok határideje, áthidaló napok tervezése és jelentések a cégnek PDF-ben. Több mint 30 szakterület van, több mint 150 kollektív szerződéssel minden tartományra, és az alkalmazás 13 nyelven beszél. Kérdezz bátran, vagy koppints lent egy témára.", "mit tud alkalmazas minden funkcio attekintes segitseg mire jo"], ["Órák rögzítése", "Nyisd meg az Erfassen (rögzítés) részt. Írd be a kezdést (Beginn) és a végét (Ende), add meg a szüneteket (Pausen), és koppints a Speichern (mentés) gombra. A \"Jetzt\" gombbal a pontos idő kerül be.", "ora rogzit ido munka kezdes vege mentes"], ["Prémium felvétele", "Menj az Einstellungen (beállítások), majd a Prämien (prémiumok) részre, és vedd fel a prémiumot, például óránként, naponta vagy darabonként. Utána a napnál rögzíted. Az app kiszámolja, és összeveti a bérjegyzékkel.", "premium potlek bonus"], ["Bérjegyzék ellenőrzése", "Nyisd meg a Bérjegyzék fület, és görgess a „Stimmel a fizetési jegyzékem?” részhez. Írd be az órákat és az összegeket, vagy hagyd, hogy fotóról vagy PDF-ből olvassam be (fent a „Bérjegyzék automatikus olvasása” résznél). Az alkalmazás megmutatja, mi egyezik, és hol marad eltérés órában vagy euróban. Nem kell minden sort kitöltened.", "berjegyzek ellenoriz stimmel osszevet elszamolas fizetes"], ["Túlóra és pótlékok", "Az Einstellungen részben találod a heti órákat, a túlóramodellt és a pótlékokat. Ezek a kollektív szerződésből (Kollektivvertrag) jönnek. Hogy egyeznek-e, a bérjegyzéken látod. Bármikor módosíthatod, akár egy dátumtól kezdve is.", "tulora potlek vasarnap szombat unnep ejszaka"], ["Napidíj (Diäten)", "A Diäten a napidíj, vagyis a kiegészítő napi pénz. Az Einstellungen, Diäten alatt állítod be, hogy óránként vagy napi lépcsők szerint fizetik. Az összeget a bérjegyzéken találod.", "napidij diaet etkezes kiszallas"], ["Bér vagy foglalkozás váltása", "Az Einstellungen részben egy dátumtól kezdve átállíthatod a bért vagy a foglalkozást. A régi napok a régi értékekkel maradnak kiszámolva.", "ber valt foglalkozas fizetesemeles oraber"], ["Szabadság vagy betegség", "Az Erfassen részben az \"Art des Tages\" mezőnél válaszd például az Urlaub (szabadság), Krankenstand (betegszabadság) vagy Zeitausgleich (szabadidő-kiegyenlítés) lehetőséget. Ekkor nem kell időt megadni.", "szabadsag beteg tappenz szabi"], ["Adataim és adatvédelem", "A bejegyzéseid a telefonodon vannak. A fiókoddal ezen felül egy védett frankfurti szerveren is tárolódnak, hogy semmi ne vesszen el. Technikailag az alkalmazás üzemeltetője láthatná őket. Az ezt kizáró titkosítás készül. A bérjegyzékek és napi jelentések fotóit és PDF-jeit csak a telefonodon olvasom, nem töltöm fel őket. Csak azokat a számokat mentjük, amelyeket jóváhagysz. A céged ebből semmit nem lát.", "adat adatvedelem biztonsag fiok tarolas privat tovabbad"], ["Mentés", "Az Einstellungen (Beállítások) legalján van a \"Sicherung speichern oder teilen\". Ez egy fájlba menti az összes adatod. Ezzel új telefonon visszaállíthatsz mindent.", "mentes backup visszaallit elveszett"], ["App telepítése", "Nyisd meg az oldalt a böngészőben, és koppints az \"App installieren\" gombra (menü jobb felül). Ha az Android figyelmeztet, koppints a \"Trotzdem installieren\" (mégis telepít) gombra. Az app biztonságos, csak ez az oldal.", "telepit ikon kezdokepernyo alkalmazas"], ["Nyelv és felolvasás", "Az alkalmazás nyelvét az oldal legtetején választod. Ha kérdezel tőlem, koppints a mikrofonra és beszélj. A „Felolvasás” gombbal felolvasom a válaszomat. A mikrofonhoz internet és a böngészőben adott engedélyed kell.", "nyelv beszel mikrofon diktal felolvas magyar forditas"], ["Mia elnémítása", "Koppints a „Mia elnémítása” gombra, és többé nem jelentkezem magamtól, csak ha megérintesz. Ugyanez a gomb újra bekapcsol. Az alakomat, a nevemet és a kinézetemet a Profilban, a „Társam” résznél változtatod meg.", "mia milo elnemit csendes zavar kikapcsol"], ["Határidők és igazolványok", "Nyisd meg a Profilt, és görgess a \"Fristen und Ausweise\" (Határidők és igazolványok) részhez. Vedd fel a Code 95-öt, a sofőrkártyát, a targoncavezetői igazolványt vagy saját határidőket lejárati dátummal. Időben emlékeztetlek, és az időpont kérésre a telefon naptárába is kerül.", "hatarido igazolvany code 95 sofor kartya targonca daru lejarat tanfolyam kepzes emlekezteto"], ["Utólagos kifizetés, visszamenőleges órabér, különleges kifizetések", "Ha a cég később fizetett vagy visszaszámolt valamit, add meg a havi ellenőrzésnél a „Nachzahlungen und Korrekturen” (utólagos kifizetések és javítások) alatt: melyik hónapra, melyik sorra és mennyit. Az app hozzáadja a korábbi hónaphoz. A „Stundenlohn aufgerollt” (visszamenőleg átszámolt órabér) esetén megmutatja a számítást és hogy stimmel-e az összeg. A szabadságpénzt, karácsonyi pénzt, 13. és 14. havi fizetést a „Lohnzettel” fülön a „Sonderzahlungen” (különleges kifizetések) alatt add meg.", "utolagos nachzahlung visszamenoleges orber javitas karacsonyi szabadsagpenz 13 14 kulonleges"], ["Újdonságok", "A profilban megtalálod az „Újdonságok” kártyát. Ott kapcsolod be, hogy Mia elmondja az újdonságokat, és ott állítod be, milyen gyakran: azonnal, hetente vagy havonta. Csak azt kapod, ami a szakmádhoz illik. Ha mindent látni szeretnél, kapcsold be a „Más szakmák újdonságai is” opciót.", "ujdonsag hirek funkcio"], ["Részmunkaidő, többletmunka és szabadidő-kiegyenlítés", "Ha részmunkaidőben dolgozol, és többet az megállapodottnál, a kollektív szerződésed teljes munkaidős határáig ez többletmunka, nem túlóra. Pótléka 25 %, kivéve, ha az órákat ugyanabban a negyedévben 1:1 arányban szabadidőként veszed ki. Az app ezt automatikusan számolja. A kollektív szerződésed ezt másképp is szabályozhatja.", "reszmunkaido tobbletmunka szabadido negyedev"], ["Szülői szabadság, anyavédelem, apahónap", "Az Erfassen részben az „Art des Tages” mezőnél válaszd a Karenz, Mutterschutz vagy Papamonat lehetőséget. Ezek a napok fizetetlenek, és nincs kötelező óraszám. A Karenz arányosan csökkenti a szabadságot, a Mutterschutz nem.", "szuloi szabadsag anyavedelem apahonap karenz"], ["Rugalmas munkaidő", "Rugalmas munkaidőnél az app a plusz és mínusz órákat egy számlán számolja. Beállításkor válaszd az „Iroda rugalmas munkaidővel” lehetőséget, vagy az Einstellungenben a „Gleitzeit” túlóra-modellt. Ott adod meg a napi előírt időt, opcionálisan a kezdő egyenleget és az átviteli határt. Egy rugalmas szabadnap (szabadidő-kiegyenlítés) levonja az előírt időt a számláról, a szabadság és a betegség nem.", "rugalmas munkaido szamla egyenleg plusz minusz"], ["Nincs munka / a cég felmentette", "Az Erfassen-ben az „Art des Tages” mezőnél válaszd a „Nincs munka (a cég felmentette)” lehetőséget, ha a cég munkahiány miatt hazaküld. A naphoz tartozó jegyzet magától beállítódik. Hogy a cég hogyan számolja el a napot, az Einstellungen-ben a „Felmentés a munka alól (nincs munka)” alatt állíthatod be: a cég tovább fizet, levonás a szabadidőből, vagy fizetetlen. Ha nem tudod, az alkalmazás semmit nem von le. Az AK is ezt tekinti alapszabálynak: aki munkára kész és hazaküldik, megtartja a bérét. A bérszámfejtésen látod, hogy stimmel-e.", "felmentes nincs munka hazakuldott szabadido munkahiany"], ["Szabadidő: 1:1,5 vagy 1:1?", "A munkaidőtörvény (10. §) szerint: a túlóra-pótlékot figyelembe kell venni a szabadidőnél, vagy külön ki kell fizetni. 50 % pótléknál ez vagy 1 túlóra = 1,5 óra szabadidő, vagy 1:1 és a pótlék a bérszámfejtésen jelenik meg. A kollektív szerződés másként is szabályozhatja. Állítsd be az Einstellungen-ben: „Hogyan írja jóvá a cége a túlórát szabadidőként?“. Kivételkor a szabadidőt óráról órára vonják le. Németországban nincs törvényes arány, a szerződésed érvényes.", "szabadido tulora potlek 1:1,5 arany"], ["Hol találom ezt a bérjegyzéken?", "A bérjegyzék tetején általában a neved, a cég, a hónap és gyakran a besorolás, a bércsoport és a kollektív szerződés áll (néha „KV” rövidítéssel). Az órabért a „Lohn” vagy „Stundenlohn” sorban találod, mellette az órákat a „Menge” oszlopban. A túlóra gyakran külön sorokban van 50 % vagy 100 %, a szabadidő egy „Zeitausgleich” vagy „Zeitkonto” jellegű sorban, a szabadság gyakran „Resturlaub” néven. A heti óraszám a munkaszerződésben áll. Ha valami nincs rajta, kérdezd meg az irodát vagy a bérszámfejtést. Amit nem tudsz, hagyd üresen az alkalmazásban. Addig az alkalmazás a kollektív szerződésed értékeivel számol.", "berjegyzek hol talalom besorolas bercsoport kollektiv szerzodes kv"], ["Tanuló vagyok", "Tanulóként tanulói juttatást kapsz, általában tanévenként fix havi összeget. A beállításokban a „Szakmám” alatt válaszd a „Tanuló” típust. Az app ekkor a bérkategóriánál csak a kollektív szerződésed tanéveit mutatja, a „Kollektív szerződés szerinti minimálbér használata” gombbal pedig beírja az összeget. Ha a tanszerződésedben más összeg áll, írd be a „Fix havi bér” mezőbe. A szakiskola munkaidőnek számít: a napot „Képzés / szakiskola” néven írd be, a heti fix iskolanapot a „Fix szabadnapok” alatt. 18 év alatt az ifjúságvédelmi törvény érvényes, főszabály szerint legfeljebb napi 8 és heti 40 óra. Kérdés esetén az Arbeiterkammer segít.", "tanulo tanonc szakiskola kepzes juttatas"], ["Pótlékok az építőiparban és a kisiparban", "Az építőiparban és a kisiparban a bérjegyzéken gyakran szerepelnek pótlékok: piszok-, megterhelési és veszélyességi pótlék, napidíj vagy távolsági pótlék házon kívüli munkánál, szállásdíj és szerelési pótlék. Vedd fel őket a Beállítások, Prémiumok alatt, Mia javaslatokat tesz. Rossz időben az építőiparban és a faépítésben a BUAK fizeti a bér egy részét, az app a rossz idő óráit külön vezeti. A festőiparban időjárás miatti kiesésnél a bér 60 %-a jár. Az összegek kollektív szerződésenként eltérnek, hasonlítsd össze őket a bérjegyzékeddel.", "potlek epitoipar kisipar rossz ido szallas szereles buak"], ["Takarítás, biztonsági szolgálat és ápolás", "Ezekben a szakmákban sok minden éjszakai, vasárnapi és ünnepnapi szolgálatban történik. A időket úgy add meg, ahogy dolgoztál, éjfélen túl is: az órák arra a napra számítanak, amelyen a szolgálat kezdődött. A pótlékok (például éjszakai pótlék, étkezési pótlék, készenlét) a bérjegyzéken vannak: vedd fel őket a Beállítások, Prémiumok alatt, Mia megfelelőket javasol. Ha rád másik kollektív szerződés vonatkozik (például tartományi kórház), válaszd az „Egyéni értékek” lehetőséget."], ["Óraátállítás (nyári idő, téli idő)", "Az alkalmazás automatikusan beszámítja az óraátállítást. Októberben az órát 3 óráról 2 órára állítják vissza: aki ezen az éjszakán dolgozik, egy órával többet dolgozott. Egy 22-től 6 óráig tartó éjszakai műszak ekkor 8 helyett 9 órának számít. Márciusban az órát 2 óráról 3 órára állítják előre: egy óra hiányzik, a műszak 8 helyett 7 órának számít. Egyszerűen úgy add meg a kezdést és a végét, ahogy az óra mutatta. Hogy a cég kifizeti-e a többletórát, azt a kollektív szerződés vagy az üzemi megállapodás szabályozza: nézd meg a bérjegyzéket. Eltérés esetén magad is módosíthatod az órákat a napon belül."], ["Mi a bércsoport, és szükségem van rá?", "A bércsoport (vagy besorolás) határozza meg, milyen minimálbért biztosít neked a kollektív szerződés. Nem kell ismerned: add meg egyszerűen az órabéredet a bérjegyzékről. Ha ismered, az app ellenőrizheti, hogy a béred megfelel-e a kollektív szerződésnek. A bérjegyzék tetején találod („Einstufung”, „Lohngruppe” vagy „Verwendungsgruppe” mellett) vagy a munkaszerződésben. Ha sehol nincs, kérdezd meg a cégnél.", "bércsoport besorolás minimálbér"], ["Még hiányzik néhány adatom, elkezdhetem mégis?", "Igen, azonnal elkezdheted, akkor is, ha a bér, a besorolás vagy más még hiányzik. Add meg, amid már van, például a munkaidődet. A hiányzó értékeket bármikor pótolhatod a beállításokban. Az app ekkor automatikusan és helyesen újraszámolja az összes már beírt napot is. Csak a bérjegyzékkel való euró-összehasonlításhoz kell megadni az órabért.", "hiányzik adat elkezdeni később pótol"], ["Hol találom a fejlesztőnek szóló visszajelzést?", "Az app bal alsó sarkában van a „Probléma jelentése” gomb. Koppints rá, válaszd ki a „Miről van szó?” alatt például a „Valami nem stimmel” vagy a „Javaslat” lehetőséget, írd meg az üzeneted, és koppints a Küldés gombra. Az app elküldi az aktuális oldal képét is, ezt kikapcsolhatod. Utána megerősítést látsz. A visszajelzést a profilban is megtalálod.", "visszajelzés fejlesztő probléma javaslat kontakt hol"], ["Rendkívüli szabadság és munka ugyanazon a napon", "Az Erfassen részben az „Art des Tages” alatt válaszd a Sonderurlaub (rendkívüli szabadság) vagy az Urlaub lehetőséget. A nap a kötelező óraszámmal kerül jóváírásra. Ha aznap mégis dolgoztál, add meg a kezdést és a befejezést: a nap mellett „plusz munka” áll, és a munkaidő hozzáadódik a fizetett kötelező órákhoz. A fizetési jegyzéken a rendkívüli szabadságnak általában saját sora van, amelyet az app külön hasonlít össze.", "rendkivuli szabadsag sonderurlaub eskuvo temetes koltozes munka"], ["Várható bruttó és kifizetés", "Az áttekintésben az órák alatt látod a várható bruttót, a feljegyzéseidből számolva: bér, túlóra, prémium és ügyelet, a napidíj külön. Az app nem mutatja a nettót, mert az több tényezőtől függ, például társadalombiztosítástól, jövedelemadótól, családi kedvezménytől és ingázási támogatástól. Ha a beállításokban az „Auszahlung am” mezőbe beírod a fizetésed napját, az áttekintés a dátumot is mutatja. A bruttó csak a hónap leteltével jelenik meg, mert addig még hiányozhatnak bejegyzések.", "brutto netto elonezet kifizetes fizetes kereset"], ["Kamionozás Németországban: szerződés, napidíj és éjszaka", "Németországban nincs egységes kollektív szerződés: tartományonként érvényes, és csak akkor, ha a munkáltatód kötve van hozzá. Elmentve a szállítmányozás és logisztika Észak-Rajna-Vesztfáliára, Bajorországra, Szászországra és Berlinre. Ha a beállításnál Németországot választod, add meg a tartományodat az ünnepnapokhoz. Ha a munkáltatód nincs kötve, a bért és a pótlékokat a munkaszerződésedből vedd, és válaszd a „Saját értékek” lehetőséget. A távolsági sofőröknek gyakran saját szerződésük van. A napidíj 14 €-ig (8 óránál hosszabb) és 28 €-ig (24 óra) adómentes, plusz 9 € éjszakánként a kamionban: az éjszakát prémiumként add meg. Az éjszakai pótlékot is. Hasonlíts össze mindent a bérlapoddal.", "németország német szállítmányozás távolsági napidíj szerződés nrw berlin éjszaka"], ["Szavak a bérjegyzéken", "Entgeltfortzahlung (továbbfizetés): a cég tovább fizeti a béredet, többnyire betegszabadság alatt. Aufrollung (újraszámolás): a bérelszámoló újraszámolja a korábbi hónapokat, például béremelés után, és utólag kifizeti vagy beszámítja a különbözetet. Rückverrechnung (visszaszámolás): ami már el volt számolva, azt visszaszámolják. Vorschuss (előleg): előre kifizetett összeg, amelyet az elszámoláskor levonnak. Pfändung (letiltás): bírósági végzésre a cég visszatart egy összeget és továbbítja. Sachbezug (természetbeni juttatás): a cégtől kapott előny, például céges autó magáncélú útra. Az értékét hozzászámolják a béredhez, de nem fizetik ki. MA-Vorsorgekasse: a cég befizet a végkielégítési alapodba. Csak azt kell ellenőrizned, hogy a sor megvan. A kollektív szerződést a bérjegyzék gyakran egyáltalán nem nevezi meg. Nézd a „Tarifgruppe“ és „Beschäftigt als“ (alkalmazva mint) sort: ez a besorolásod."], ["Nettó ellenőrzése a BMF-számológéppel", "Az app a nettót nem maga számolja. A gomb új ablakban megnyitja az osztrák pénzügyminisztérium (BMF) bruttó-nettó számológépét. Ez nem kötelező érvényű modellszámítás. Add meg ott a fenti bruttót, és állítsd be: havi időszak, járulékcsoport a bérjegyzék szerint (fizikai vagy szellemi dolgozó), év, a munkahelyed tartománya, ingázási támogatás és gyermekek a saját helyzeted szerint. Hasonlítsd össze a nettót a bérjegyzék „Auszahlung” (kifizetés) sorával. Kisebb eltérés normális, például napidíj, szakszervezeti tagdíj vagy előleg miatt."], ["Gyors rögzítés (szöveg, hang, fotó)", "A „Gyors rögzítés” résznél egyszerűen leírod vagy elmondod, mit dolgoztál, például „tegnap 6-tól 15-ig, 30 perc szünet, Müller ügyfél földkiemelés”. Én bejegyzéseket készítek belőle, te ellenőrzöd és mented. A napi jelentésedről is készíthetsz fotót, és átveszem belőle az időket. A funkció először ki van kapcsolva: kapcsold be a Beállítások, „Beviteli segédek” résznél. Utána a kártya a Rögzítés legtetején van. A mikrofonhoz internet és engedély kell.", "gyors rogzites hanguzenet diktal beszel napi jelentes foto szoveg"], ["Bérjegyzék beolvasása fotóról vagy PDF-ből", "A Bérjegyzék fülön a „Bérjegyzék automatikus olvasása” résznél egyszer engedélyezed, hogy az alkalmazás beolvassa a bérjegyzékedet. Utána koppints a „Bérjegyzék olvasása” gombra, és válassz fotót vagy PDF-fájlt. Csak itt a telefonodon olvasom, semmi nem kerül feltöltésre. Minden sort jóváhagysz, utána minden benne van a „Stimmel a fizetési jegyzékem?” összevetésben. Ha egy sort nem ismerek, egyszer hozzárendeled, és megjegyzem a következő hónapokra. A Beállítások, „Beállítások a fizetési jegyzékkel” résznél ezzel a beállításaidat is ellenőrzöm.", "foto fenykep pdf szkennel beolvas berjegyzek kamera automatikus"], ["Két számítás: kollektív szerződés és cég", "Mindig kétszer számolok: egyszer úgy, ahogy a kollektív szerződés és a törvény szerint kellene, és egyszer úgy, ahogy a céged kezeli, vagyis a beállításaid szerint. A törvény és a kollektív szerződés az elsődleges. Az eltérést az áttekintésben és a bérjegyzék-összevetésben látod. Az Áttekintés, „Év és számlák” részen minden eltérés a „Rögzített eltérések” között marad, akkor is, ha a cég mindig így csinálja. A listát kimásolhatod és megmutathatod például a Munkáskamarának (Arbeiterkammer). Minden fenntartással: az eltérés gépelési hibából is adódhat.", "elteres kulonbseg ceg torveny ket szamitas rogzitett munkaskamara jog keves"], ["Kollektív szerződés és tartomány", "A Beállítások, „A foglalkozásom” résznél választod a foglalkozásod, „Az én kollektív szerződésem” résznél pedig a megfelelő szerződést. Sok kollektív szerződés tartományonként eltér. Add meg a tartományodat a Beállítások, „Adataim” résznél, akkor javaslom a helyes szerződést és a tartományod pótlékait, és szólok, ha valami nem illik össze. Ha nem találod a szerződésed, válaszd a „Saját értékek” lehetőséget, és írd be a bért és a pótlékokat a munkaszerződésedből.", "tartomany kollektiv szerzodes melyik szerzodes becs tirol stajerorszag karintia salzburg"], ["Milyen foglalkozások vannak?", "Többek között: kamion, kotró, kisszállítás, busz és taxi, építőipar és kézművesség, raktár, műhely, ipar, élelmiszeripar, kereskedelem, iroda, külső értékesítés, vendéglátás és szálloda, pékség, cukrászda, hentesség, takarítás, biztonsági szolgálat, ápolás és szociális munka, mentőszolgálat, orvosi rendelő, fogtechnika, optika, fodrász, kozmetika, posta, vasút, szövetségi szolgálat, kertészet és erdészet, felvonók, mozi, kéményseprő, garázs és benzinkút, mosoda, műanyag és kártevőirtás, mindenhol tanulókkal, ahol vannak. Ha a tiéd hiányzik, válaszd a „Valami más” lehetőséget, és írd be a saját értékeidet. A „Probléma jelentése” gombbal írd meg, melyik foglalkozás hiányzik.", "foglalkozasok melyik hianyzik szakma agazat munka dolgozom milyen foglalkozasok vannak szakmak"], ["Jelentés a cégnek (PDF)", "A Rögzítés legalján találod a „Jelentés a cégnek” részt: válassz napot, hetet, fél hónapot vagy hónapot, és „PDF készítése és küldése” vagy mentés. A Beállítások, „Jelentések a cégnek” résznél állítod be, milyen név szerepeljen rajta, mikor kéri a cég a jelentést, a cég e-mail-címét és hogy az aláírásod is rákerüljön-e. Ekkor időben emlékeztetlek.", "jelentes pdf munkaidolap kuld ceg alairas nyomtat havi heti"], ["Szabadság, időkiegyenlítés és túlórák egy pillantásra", "Az Áttekintés, „Év és számlák” részen megtalálod az óranyilvántartást, a szabadságnyilvántartást a járandósággal, kivett napokkal és maradék szabadsággal, az időkiegyenlítési számlát és a „Túlórák áttekintése” részt: mit írtál fel, mit fizettek ki és mi került a számlára. Írd be a bérjegyzéked szerinti egyenleget, és azonnal látod, stimmel-e. A szabadságjárandóságot a profilodban megadott belépési dátumból számolom.", "maradek szabadsag jarandosag nyilvantartas idokiegyenlites szamla egyenleg tulorak attekintes"], ["Szabadnapok tervezése (áthidaló napok)", "Az Áttekintés, „Év és számlák” részen a „Szabadnapok tervezése” megmutatja a legjobb áthidaló napokat: kevés szabadság- vagy időkiegyenlítési nappal minél több szabadnap egyben. A szombat és a vasárnap szabadnak számít. Előtte kérdezd meg a munkahelyen, dolgoznak-e ezeken a napokon.", "athidalo nap tervez szabadnap hosszu hetvege szabadsag tervezes"], ["Mia kialakítása: alak, ruha, színek, hang", "A Profil, „Társam” résznél választod ki az alakomat és a nevemet. A „Mia saját kialakítása” kapcsolóval te választod a ruhát, a kiegészítőket és a színeket, például sárga vagy narancssárga láthatósági mellényt. Kikapcsolva a foglalkozásodhoz illően öltözöm. Ott állítod be azt is, hogy hanggal beszéljek-e, alatta pedig az alkalmazás ikonját választod.", "kinezet alak ruha szin mellény hang kialakit nev milo ikon kep"], ["Kipróbálás mód", "A Beállításokban találod a kipróbálás módot. Ezzel más foglalkozásokat vagy beállításokat próbálhatsz ki anélkül, hogy a valódi adataid megváltoznának. Ilyenkor fent piros figyelmeztetés látszik. A „Vissza az adataimhoz” gombbal térsz vissza, és minden kipróbált dolog törlődik.", "kiprobal teszt mas foglalkozas jatszik mod"], ["Ügyfelek, építkezések, jármű és kilométer", "A Beállítások, „Amit rögzítek” résznél kapcsolod be, mit akarsz még felírni: jármű és kilométerek, ügyfelek, építkezések és tevékenységek vagy prémiumok. Ekkor a Rögzítésnél megjelennek a megfelelő mezők, például „+ Ügyfél / építkezés hozzáadása” az ügyfelenkénti idővel. A profilban beállíthatod, hogy a legutóbbi kilométerállás automatikusan beíródjon.", "ugyfel ugyfelek epitkezes tevekenyseg jarmu kilometer rendszam megbizas"], ["Üzem zárva és állandó szabadnapok", "Ha az üzem zárva van, a „A nap típusa” résznél válaszd az „Üzem zárva / üzemi szabadság” lehetőséget. Hogy a cég hogyan fizeti, szabadságként vagy a túlóráidból, a Beállítások, „Üzem zárva” résznél állítod be. Ha minden héten ugyanazon a napon szabad vagy, vagy szakiskolába jársz, állítsd be egyszer a Beállítások, „Állandó szabadnapok” résznél. Akkor ezeket a napokat én írom be helyetted.", "uzemi szabadsag uzem zarva ceg zarva allando szabadnap minden heten iskola"], ["Fiók és több eszköz", "A fiókoddal (e-mail és jelszó) az adataid a szerveren is mentve vannak. Ha egy másik telefonon vagy számítógépen bejelentkezel, ott is megvan minden bejegyzés. Internet nélkül az alkalmazás az eszközön ment, és később szinkronizál. A Beállítások, „Fiók” résznél látod, hogy minden mentve van-e, és ki is jelentkezhetsz.", "fiok bejelentkezes kijelentkezes jelszo uj telefon szamitogep masodik eszkoz szinkron"], ["Mentőszolgálat és betegszállítás", "A Vöröskeresztnél a vöröskeresztes kollektív szerződés érvényes, a Samariterbundnál a Samariterbund-szerződés (BARS), mindkettő tartományonként. A saját szerződés nélküli magán mentő- és betegszállító cégekre, például a Grünes Kreuzra, a vöröskeresztes szerződés vonatkozik. A Legfelsőbb Bíróság szerint a betegszállítást nem szabad a taxis szerződés szerint fizetni. A Beállításokban válaszd a „Mentőszolgálat” foglalkozást és a szerződésedet.", "mentoszolgalat voroskereszt samariter betegszallitas mentoapolo mento johanniter malteser"], ["Megjegyzés a naphoz: ki akarta a szabadnapot?", "A Rögzítésnél a „Megjegyzés a naphoz” résznél mindent felírsz, ami fontos. Szabadnapoknál ott rögzíted azt is, ki akarta: te magad, a céggel megbeszélve vagy a cég rendelte el. Ez később számít az időkiegyenlítésnél, a szabadságnál vagy a bérnél, és a megjegyzések az eltéréseknél is látszanak.", "megjegyzes elrendelt ki akarta megbeszelt fonok kerés"], ["Segítség és kérdések a fejlesztőnek", "A Beállítások, „Segíts (nem kötelező)” résznél engedélyezheted, hogy névtelenül jelentsem, milyen foglalkozásban vagy, és mennyire tér el a bérjegyzék a feljegyzésektől, név, e-mail és pontos összegek nélkül. Azt is engedélyezheted, hogy a fejlesztőnek elküldjem azokat a kérdéseket, amelyekre nem tudok válaszolni, hogy tanuljak. Mindkettő nem kötelező, és bármikor kikapcsolható.", "segit nevtelen statisztika tamogat tanul fejleszto"]],
    tr: [["Uygulama neler yapabilir", "Stunden-Checker maaşının doğru olup olmadığını gösterir. Sen çalışma saatini girersin, ben fazla mesaiyi, zamları, harcırahı ve primleri toplu iş sözleşmene ve yasaya göre hesaplar ve hepsini bordronla karşılaştırırım. Farklar, firma başka türlü uygulasa bile kayıtlı kalır. Ayrıca: metin, ses veya günlük rapor fotoğrafıyla hızlı kayıt, bordroyu fotoğraftan veya PDF'den okuma, izin ve mesai karşılığı izin hesabı, belgelerin süreleri, köprü günleri planlama ve firmaya PDF raporlar. Tüm eyaletler için 150'den fazla toplu sözleşmeyle 30'dan fazla meslek alanı var ve uygulama 13 dil konuşuyor. Bana sor ya da aşağıdan bir konuya dokun.", "uygulama neler yapar hepsi fonksiyon ozellik genel yardim ne ise yarar"], ["Saat girmek", "Erfassen (kayıt) bölümünü aç. Başlangıcı (Beginn) ve bitişi (Ende) yaz, molaları (Pausen) ekle ve Speichern (kaydet) düğmesine dokun. \"Jetzt\" ile şu anki saat girilir.", "saat gir kayit calisma baslangic bitis kaydet"], ["Prim eklemek", "Einstellungen (ayarlar), sonra Prämien (primler) bölümüne git ve primini ekle, örneğin saat, gün veya adet başına. Sonra o günde girersin. Uygulama hesaplar ve maaş bordrosuyla karşılaştırır.", "prim ek odeme bonus"], ["Bordroyu kontrol etmek", "Bordro sekmesini aç ve „Maaş bordrom doğru mu?” bölümüne in. Saatleri ve tutarları yaz ya da bordroyu fotoğraftan veya PDF'den okumama izin ver (yukarıda „Bordroyu otomatik oku” bölümünde). Uygulama neyin tuttuğunu ve saat ya da euro olarak nerede fark kaldığını gösterir. Bütün satırları doldurman gerekmez.", "bordro kontrol dogru karsilastir hesap maas pusulasi"], ["Fazla mesai ve zamlar", "Einstellungen içinde haftalık saatleri, fazla mesai modelini ve zamları bulursun. Bunlar toplu iş sözleşmesinden (Kollektivvertrag) gelir. Doğru olup olmadığını bordrodan görürsün. İstediğin zaman, hatta bir tarihten itibaren değiştirebilirsin.", "fazla mesai zam pazar cumartesi tatil gece"], ["Harcırah (Diäten)", "Diäten günlük harcırahtır, yani ek günlük ödeme. Einstellungen, Diäten bölümünde saat başına mı yoksa gün başına kademeli mi ödendiğini ayarlarsın. Tutarı bordronda bulursun.", "harcirah diaet gunluk yemek"], ["Ücret veya meslek değiştirmek", "Einstellungen bölümünde ücreti veya mesleği bir tarihten itibaren değiştirebilirsin. Eski günler eski değerlerle hesaplanmış kalır.", "ucret meslek degistir zam saatlik"], ["İzin veya hastalık", "Erfassen içinde \"Art des Tages\" alanında örneğin Urlaub (izin), Krankenstand (hastalık izni) veya Zeitausgleich (mesai karşılığı izin) seç. O zaman saat girmen gerekmez.", "izin hasta rapor tatil"], ["Verilerim ve veri koruma", "Kayıtların telefonunda durur. Hesabınla ayrıca hiçbir şey kaybolmasın diye Frankfurt'taki güvenli bir sunucuda saklanır. Teknik olarak uygulamayı işleten kişi bunları görebilir. Bunu engelleyen şifreleme hazırlanıyor. Bordro ve günlük rapor fotoğraflarını ve PDF dosyalarını sadece telefonunda okurum, yüklenmezler. Sadece senin onayladığın sayılar kaydedilir. Firman bunların hiçbirini görmez.", "veri gizlilik guvenli hesap kayit ozel paylasim"], ["Yedekleme", "Einstellungen (Ayarlar) bölümünün en altında \"Sicherung speichern oder teilen\" vardır. Tüm verilerini bir dosyaya kaydeder. Yeni telefonda her şeyi bununla geri yükleyebilirsin.", "yedek yedekleme backup geri yukle kayboldu"], ["Uygulamayı kurmak", "Siteyi tarayıcıda aç ve \"App installieren\" düğmesine dokun (sağ üstte menü). Android uyarırsa \"Trotzdem installieren\" (yine de kur) düğmesine dokun. Uygulama güvenlidir, sadece bu web sitesidir.", "kur yukle ikon ana ekran uygulama"], ["Dil ve sesli okuma", "Uygulamanın dilini sayfanın en üstünden seçersin. Bana soru sorarken mikrofona dokun ve konuş. „Sesli oku” ile cevabımı sana okurum. Mikrofon internet ve tarayıcıda iznini gerektirir.", "dil konusmak mikrofon dikte sesli oku turkce ceviri"], ["Mia'yı susturmak", "„Mia’yı sustur” düğmesine dokun, artık kendiliğimden konuşmam, sadece bana dokunduğunda. Aynı düğme beni yeniden açar. Figürümü, adımı ve görünüşümü Profil, „Arkadaşım” bölümünde değiştirirsin.", "mia milo sustur sessiz rahatsiz kapat"], ["Süreler ve belgeler", "Profil bölümünü aç ve \"Fristen und Ausweise\" (Süreler ve belgeler) kısmına kaydır. Code 95, sürücü kartı, forklift belgesi veya kendi sürelerini bitiş tarihiyle ekle. Seni zamanında uyarırım, tarih istersen telefon takvimine de girer.", "sure belge code 95 surucu karti forklift vinc bitis kurs egitim hatirlatma"], ["Sonradan ödeme, geriye dönük ücret, özel ödemeler", "Şirket sonradan bir şey ödediyse veya geri aldıysa, bunu aylık kontrolde „Nachzahlungen und Korrekturen“ (sonradan ödemeler ve düzeltmeler) altına gir: hangi ay, hangi satır ve ne kadar. Uygulama bunu önceki aya ekler. „Stundenlohn aufgerollt“ (saatlik ücret geriye dönük hesaplandı) için hesabı ve tutarın uyup uymadığını gösterir. Tatil parasını, Noel ikramiyesini, 13. ve 14. maaşı „Lohnzettel“ sekmesinde „Sonderzahlungen“ (özel ödemeler) altına gir.", "sonradan odeme nachzahlung geriye donuk aufroll duzeltme noel tatil ikramiye 13 14 ozel saatlik ucret"], ["Yenilikler", "Profilde „Yenilikler“ kartını bulursun. Orada Mia'nın sana yenilikleri söylemesini açar ve ne sıklıkla olacağını ayarlarsın: hemen, haftalık veya aylık. Sadece mesleğine uyanları alırsın. Geri kalanı da görmek istersen „Diğer meslekler için de yenilikler“i aç.", "yenilik haber ozellik"], ["Yarı zamanlı çalışma, ek çalışma ve izin", "Yarı zamanlı çalışıp anlaşılandan fazla çalışırsan, toplu sözleşmendeki tam zaman sınırına kadar bu fazla mesai değil ek çalışmadır. %25 zam vardır; saatleri aynı çeyrekte 1:1 izin olarak kullanırsan zam yoktur. Uygulama bunu otomatik hesaplar. Toplu sözleşmen bunu farklı düzenleyebilir.", "yari zamanli ek calisma izin ceyrek"], ["Ebeveyn izni, anne koruması, baba ayı", "Erfassen içinde „Art des Tages“ alanında Karenz, Mutterschutz veya Papamonat seç. Bu günler ücretsizdir ve hedef saati yoktur. Karenz yıllık izin hakkını orantılı kısaltır, Mutterschutz kısaltmaz.", "ebeveyn izni anne baba karenz"], ["Esnek çalışma saati", "Esnek çalışma saatinde uygulama artı ve eksi saatleri bir hesapta sayar. Kurulumda „Esnek mesaili ofis“i ya da Einstellungen içinde „Gleitzeit“ fazla mesai modelini seç. Orada günlük hedef süreyi, isteğe bağlı başlangıç bakiyesini ve devir sınırını girersin. Esnek izin günü (mesai karşılığı izin) hedef süreyi hesaptan düşer, yıllık izin ve hastalık düşmez.", "esnek mesai hesap bakiye artı eksi saat"], ["İş yok / şirket serbest bıraktı", "Erfassen içinde „Art des Tages“ alanında şirket iş olmadığı için seni eve gönderdiğinde „İş yok (şirket serbest bıraktı)“ seçeneğini seç. Güne ait not otomatik ayarlanır. Şirketin günü nasıl hesapladığını Einstellungen içinde „İşten serbest bırakma (iş yok)“ altında ayarlarsın: şirket ödemeye devam eder, izinden düşülür ya da ücretsiz. Bilmiyorsan uygulama hiçbir şey düşmez. AK da bunu temel kural olarak görür: çalışmaya hazır olup eve gönderilen maaşını korur. Maaş bordronda doğru olup olmadığını görürsün.", "serbest birakma is yok eve gonderildi izin"], ["İzin: 1:1,5 mi 1:1 mi?", "Çalışma Süresi Yasası (§ 10) der ki: fazla mesai zammı izinde dikkate alınmalı veya ayrıca ödenmelidir. %50 zamda ya 1 fazla mesai saati = 1,5 saat izin, ya da 1:1 ve zam bordroya yansır. Toplu sözleşme bunu farklı düzenleyebilir. Einstellungen içinde „Şirketiniz fazla mesaiyi izin olarak nasıl yazıyor?“ altında ayarlayın. İzin kullanılırken saat saat düşülür. Almanya'da yasal oran yoktur, sözleşmeniz geçerlidir.", "izin fazla mesai zam 1:1,5 oran"], ["Bunu maaş bordrosunda nerede bulurum?", "Maaş bordrosunun üstünde genellikle adın, şirket, ay ve çoğu zaman sınıflandırma, ücret grubu ve toplu sözleşme yazar (bazen „KV“ kısaltmasıyla). Saatlik ücreti „Lohn“ veya „Stundenlohn“ satırında, yanındaki saatleri „Menge“ sütununda bulursun. Fazla mesai çoğu zaman 50 % veya 100 % ile ayrı satırlarda, izin „Zeitausgleich“ veya „Zeitkonto“ gibi bir satırda, yıllık izin çoğu zaman „Resturlaub“ olarak görünür. Haftalık saatler iş sözleşmesindedir. Bir şey yoksa ofise veya bordro birimine sor. Bir şeyi bilmiyorsan uygulamada alanı boş bırak. O zamana kadar uygulama toplu sözleşmenin değerleriyle hesaplar.", "bordro nerede bulurum siniflandirma ucret grubu toplu sozlesme kv"], ["Çırağım (stajyer)", "Çırak olarak çıraklık ücreti alırsın, genelde öğrenim yılı başına sabit aylık tutar. Ayarlarda „Mesleğim“ altında „Çırak“ türünü seç. Uygulama ücret grubunda yalnızca toplu sözleşmenin öğrenim yıllarını gösterir ve „Toplu sözleşmedeki asgari ücreti kullan“ ile tutarı kendisi yazar. Çıraklık sözleşmende başka bir tutar varsa „Sabit aylık ücret“ alanına yaz. Meslek okulu çalışma süresi sayılır: günü „Eğitim / meslek okulu“ olarak gir, her hafta sabit okul gününü „Sabit boş günler“ altına gir. 18 yaşın altında gençlik koruma yasası geçerlidir, kural olarak günde en fazla 8 ve haftada 40 saat. Sorularda Arbeiterkammer yardımcı olur.", "cirak stajyer meslek okulu egitim ucret"], ["İnşaat ve zanaatta ödenekler", "İnşaat ve zanaatta maaş bordrosunda çoğu zaman ödenekler olur: kir, zorluk ve tehlike ödeneği, evden uzak çalışmada gündelik veya mesafe ödeneği, konaklama ve montaj ödeneği. Bunları Ayarlar, Primler altında ekle, Mia sana uygun öneriler yapar. İnşaat ve ahşap yapıda kötü havada ücretin bir kısmını BUAK öder, uygulama kötü hava saatlerini ayrı tutar. Boyacılıkta hava nedeniyle iş iptalinde ücretin %60’ı ödenir. Tutarlar toplu sözleşmeye göre değişir, lütfen maaş bordronla karşılaştır.", "odenek insaat zanaat kotu hava konaklama montaj buak"], ["Temizlik, güvenlik ve hemşirelik", "Bu mesleklerde çok şey gece, pazar ve resmi tatil vardiyalarında olur. Saatleri çalıştığın gibi gir, gece yarısından sonrasını da: saatler, vardiyanın başladığı güne sayılır. Zamlar ve ödenekler (örneğin gece ödeneği, yemek ödeneği, nöbet bekleme) bordronda yazar: bunları Ayarlar, Primler altında ekle, Mia sana uygun olanları önerir. Sana başka bir toplu sözleşme uygulanıyorsa (örneğin eyalet hastanesi) „Kendi değerlerim“i seç."], ["Saat değişikliği (yaz saati, kış saati)", "Uygulama saat değişikliğini otomatik hesaba katar. Ekim ayında saat 3:00'ten 2:00'ye geri alınır: o gece çalışan bir saat fazla çalışmış olur. 22:00 ile 6:00 arası bir gece vardiyası bu durumda 8 yerine 9 saat sayılır. Mart ayında saat 2:00'den 3:00'e ileri alınır: bir saat eksiktir, vardiya 8 yerine 7 saat sayılır. Başlangıç ve bitişi saatin gösterdiği gibi gir. Şirketinin fazladan saati ödeyip ödemediği toplu sözleşmende veya işyeri anlaşmanda yazar: bordronda kontrol et. Fark varsa gün içindeki saatleri kendin düzeltebilirsin."], ["Ücret grubu nedir ve buna ihtiyacım var mı?", "Ücret grubu (veya sınıflandırma), toplu sözleşmenin sana hangi asgari ücreti tanıdığını belirler. Bilmek zorunda değilsin: bordrondaki saatlik ücretini gir. Biliyorsan uygulama ücretinin toplu sözleşmeye uygun olup olmadığını kontrol edebilir. Bordronun üstünde („Einstufung“, „Lohngruppe“ veya „Verwendungsgruppe“ yanında) ya da iş sözleşmende bulursun. Hiçbir yerde yoksa şirketinde sor.", "ücret grubu sınıflandırma asgari ücret"], ["Bazı verilerim eksik, yine de başlayabilir miyim?", "Evet, ücret, sınıflandırma veya başka bilgiler eksik olsa bile hemen başlayabilirsin. Elindekini gir, örneğin çalışma saatlerini. Eksik değerleri istediğin zaman ayarlardan ekleyebilirsin. Uygulama daha önce girdiğin tüm günleri otomatik ve doğru olarak yeniden hesaplar. Yalnızca bordroyla euro karşılaştırması saatlik ücretin girilmesini bekler.", "eksik veri başlamak sonra ekle"], ["Geliştiriciye geri bildirimi nerede bulurum?", "Uygulamanın sol altında „Sorun bildir“ düğmesi var. Dokun, „Konu nedir?“ altında örneğin „Bir şey yanlış“ veya „Öneri“yi seç, mesajını yaz ve Gönder'e dokun. Uygulama geçerli sayfanın bir görüntüsünü de gönderir, bunu kapatabilirsin. Sonra bir onay görürsün. Geri bildirimi profilinde de bulursun.", "geri bildirim geliştirici sorun öneri iletişim nerede"], ["Özel izin ve aynı gün çalışma", "Erfassen bölümünde „Art des Tages” altında Sonderurlaub (özel izin) veya Urlaub seç. Gün, hedef saatlerle yazılır. O gün yine de çalıştıysan başlangıç ve bitişi gir: gün „artı çalışma” gösterir ve çalışma süren ücretli hedef saatlere eklenir. Bordroda özel iznin genellikle ayrı bir satırı vardır, uygulama onu ayrı karşılaştırır.", "ozel izin sonderurlaub dugun cenaze tasinma calisma"], ["Tahmini brüt ve ödeme", "Genel bakışta saatlerin altında kayıtlarından hesaplanan tahmini brütü görürsün: ücret, fazla mesai, primler ve nöbetler, harcırah ayrıca. Uygulama neti göstermez, çünkü net birkaç etkene bağlıdır, örneğin sosyal sigorta, gelir vergisi, aile bonusu ve yol ödeneği. Ayarlarda „Auszahlung am“ alanına ödeme gününü yazarsan genel bakış tarihi de gösterir. Brüt, ay bitince görünür; çünkü o zamana kadar kayıtlar eksik olabilir.", "brut net onizleme odeme maas kazanc"], ["Almanya'da kamyon sürücülüğü: sözleşme, ödenekler ve gece", "Almanya'da tek bir toplu sözleşme yoktur: eyalete göre geçerlidir ve yalnızca işyerin ona bağlıysa. Kuzey Ren-Vestfalya, Bavyera, Saksonya ve Berlin için nakliye ve lojistik kayıtlıdır. Kurulumda Almanya'yı seçersen resmi tatiller için eyaletini girersin. İşyerin bağlı değilse ücret ve zamları iş sözleşmenden al ve „Kendi değerlerim“i seç. Uzun mesafe sürücülerinin çoğunlukla kendi sözleşmeleri vardır. Yemek ödeneği 14 €'ya (8 saatten uzun) ve 28 €'ya (24 saat) kadar vergisizdir, ayrıca kamyonda gece başına 9 €: geceleme ücretini prim olarak gir. Gece zamlarını da. Her şeyi bordronla karşılaştır.", "almanya alman nakliye uzun mesafe ödenek sözleşme nrw berlin gece"], ["Maaş bordrosundaki sözcükler", "Entgeltfortzahlung (ücretin devamı): şirket ücretini ödemeye devam eder, çoğunlukla hastalık izninde. Aufrollung (yeniden hesaplama): bordro uzmanı önceki ayları, örneğin zamdan sonra, yeniden hesaplar ve farkı öder ya da mahsup eder. Rückverrechnung (geri hesaplama): zaten hesaplanmış bir şey geri hesaplanır. Vorschuss (avans): önceden yapılan ödeme, hesaplamada düşülür. Pfändung (haciz): mahkeme kararıyla şirket bir tutarı keser ve başkasına aktarır. Sachbezug (ayni menfaat): şirketten sağlanan bir avantaj, örneğin özel yolculuklar için şirket aracı. Değeri ücrete eklenir ama ödenmez. MA-Vorsorgekasse: şirket kıdem tazminatı fonuna ödeme yapar. Yalnızca bu satırın olduğuna bakman yeterli. Bordro toplu iş sözleşmesini çoğu zaman hiç belirtmez. „Tarifgruppe“ ve „Beschäftigt als“ (şu işte çalışan) satırına bak: bu senin sınıflandırman."], ["BMF hesaplayıcısıyla net ücreti kontrol et", "Uygulama neti kendisi hesaplamaz. Düğme, Avusturya Maliye Bakanlığı'nın (BMF) brüt-net hesaplayıcısını yeni bir pencerede açar. Bu bağlayıcı olmayan bir model hesaptır. Yukarıdaki brüt tutarı oraya gir ve şunları ayarla: aylık dönem, bordrondaki gibi prim grubu (işçi veya memur/çalışan), yıl, iş yerinin bulunduğu eyalet, yol yardımı ve çocuklar kendi durumuna göre. Neti bordrodaki „Auszahlung“ (ödeme) satırıyla karşılaştır. Harcırah, sendika aidatı veya avanslar nedeniyle küçük farklar normaldir."], ["Hızlı kayıt (metin, ses, fotoğraf)", "„Hızlı kayıt” ile ne çalıştığını yazar ya da söylersin, örneğin „dün 6'dan 15'e, 30 dakika mola, müşteri Müller kazı”. Ben bundan kayıtlar yaparım, sen kontrol edip kaydedersin. Günlük raporunun fotoğrafını da çekebilirsin, saatleri oradan alırım. Fonksiyon başta kapalıdır: Ayarlar, „Giriş yardımcıları” bölümünden aç. Sonra kart Kayıt sekmesinin en üstündedir. Mikrofon internet ve iznini gerektirir.", "hizli kayit sesli mesaj dikte konusmak gunluk rapor fotograf metin"], ["Bordroyu fotoğraftan veya PDF'den okumak", "Bordro sekmesinde „Bordroyu otomatik oku” bölümünde uygulamanın bordronu okumasına bir kez izin ver. Sonra „Bordroyu oku” düğmesine dokun ve bir fotoğraf ya da PDF dosyası seç. Onu sadece burada, telefonunda okurum, hiçbir şey yüklenmez. Her satırı sen onaylarsın, sonra her şey „Maaş bordrom doğru mu?” karşılaştırmasında olur. Bir satırı tanımazsam bir kez eşleştirirsin, sonraki aylar için hatırlarım. Ayarlar, „Bordro ile ayarlar” bölümünde bununla ayarlarını da kontrol ederim.", "fotograf resim pdf tarama oku bordro kamera otomatik"], ["İki hesap: toplu sözleşme ve firma", "Her zaman iki kez hesaplarım: bir kez toplu sözleşmeye ve yasaya göre olması gerektiği gibi, bir kez de firmanın uyguladığı gibi, yani ayarlarına göre. Yasa ve toplu sözleşme önceliklidir. Farkı genel bakışta ve bordro karşılaştırmasında görürsün. Genel bakış, „Yıl ve hesaplar” bölümünde her sapma, firma hep böyle yapsa bile „Kaydedilen sapmalar” içinde kalır. Listeyi kopyalayıp örneğin İşçi Odası'na (Arbeiterkammer) gösterebilirsin. Her şey çekincelidir: bir fark yazım hatasından da kaynaklanabilir.", "sapma fark firma yasa iki hesap kayitli isci odasi hak eksik"], ["Toplu sözleşme ve eyalet", "Ayarlar, „Mesleğim” bölümünde mesleğini, „Toplu iş sözleşmem” bölümünde de uygun sözleşmeyi seçersin. Birçok toplu sözleşme eyalete göre farklıdır. Eyaletini Ayarlar, „Bilgilerim” bölümüne gir, o zaman sana doğru sözleşmeyi ve eyaletinin zamlarını öneririm ve bir şey uymazsa söylerim. Sözleşmeni bulamazsan „Kendi değerlerim” seçeneğini al ve ücreti ve zamları iş sözleşmenden gir.", "eyalet toplu sozlesme hangi sozlesme viyana tirol steiermark karinthia salzburg"], ["Hangi meslekler var?", "Diğerlerinin yanında: kamyon, ekskavatör, küçük nakliye, otobüs ve taksi, inşaat ve zanaat, depo, atölye, sanayi, gıda sanayi, ticaret, büro, saha satış, gastronomi ve otel, fırın, pastane, kasap, temizlik, güvenlik, bakım ve sosyal hizmet, ambulans hizmeti, muayenehane, diş teknisyenliği, optik, kuaför, kozmetik, posta, demiryolu, federal kamu hizmeti, bahçıvanlık ve ormancılık, teleferik, sinema, baca temizliği, garaj ve benzin istasyonu, çamaşırhane, plastik ve haşere kontrolü; çırak olan her yerde çıraklarla. Seninki yoksa „Başka bir şey” seçeneğini al ve kendi değerlerini gir. Hangi mesleğin eksik olduğunu bana „Sorun bildir” ile yaz.", "meslekler hangi meslek eksik sektor is calisiyorum"], ["Şirkete rapor (PDF)", "Kayıt sekmesinin en altında „Şirkete rapor” var: gün, hafta, yarım ay ya da ay seç ve „PDF oluştur ve gönder” ya da kaydet. Ayarlar, „Firmaya raporlar” bölümünde üzerinde hangi adın olacağını, firmanın raporu ne zaman istediğini, firmanın e-postasını ve imzanın basılıp basılmayacağını ayarlarsın. O zaman sana zamanında hatırlatırım.", "rapor pdf puantaj gonder firma imza yazdir aylik haftalik"], ["İzin, mesai karşılığı izin ve fazla mesaiye genel bakış", "Genel bakış, „Yıl ve hesaplar” bölümünde saat defterini, hak, kullanılan günler ve kalan izinle izin kartını, zaman dengeleme hesabını ve „Fazla mesaiye genel bakış” bölümünü bulursun: ne yazdığın, ne ödendiği ve ne hesaba gittiği. Bordrondaki bakiyeyi gir, uyup uymadığını hemen görürsün. İzin hakkını profildeki işe giriş tarihinden hesaplarım.", "kalan izin izin hakki izin karti zaman dengeleme hesap bakiye fazla mesai genel bakis saat defteri"], ["Boş günleri planla (köprü günleri)", "Genel bakış, „Yıl ve hesaplar” bölümünde „Boş günleri planla” sana en iyi köprü günlerini gösterir: az izin veya mesai karşılığı izin günüyle art arda olabildiğince çok boş gün. Cumartesi ve pazar boş sayılır. Önceden işyerinde o günlerde çalışılıp çalışılmadığını sor.", "kopru gunu planla bos gun uzun hafta sonu izin planlama"], ["Mia'yı tasarlamak: figür, kıyafet, renkler, ses", "Profil, „Arkadaşım” bölümünde figürümü ve adımı seçersin. „Mia'yı kendim tasarlayayım” ile kıyafeti, aksesuarları ve renkleri kendin seçersin, örneğin sarı veya turuncu reflektörlü yelek. Kapalıyken mesleğine uygun giyinirim. Orada sesle konuşup konuşmayacağımı da ayarlarsın, altında da uygulama simgeni seçersin.", "gorunus figur kiyafet renk yelek ses tasarla ad milo simge resim"], ["Deneme modu", "Ayarlar'da deneme modunu bulursun. Bununla gerçek verilerini değiştirmeden başka meslekleri veya ayarları denersin. Üstte kırmızı bir uyarı görünür. „Verilerime geri dön” ile geri dönersin ve denediğin her şey silinir.", "deneme dene test baska meslek mod"], ["Müşteriler, şantiyeler, araç ve kilometre", "Ayarlar, „Ne kaydediyorum” bölümünde ayrıca neyi yazmak istediğini açarsın: araç ve kilometre, müşteriler, şantiyeler ve işler veya primler. O zaman Kayıt sekmesinde uygun alanlar çıkar, örneğin müşteri başına süreyle „+ Müşteri / şantiye ekle”. Profilde son kilometre durumunun otomatik yazılmasını ayarlayabilirsin.", "musteri musteriler santiye is arac kilometre plaka siparis"], ["İşyeri kapalı ve sabit boş günler", "İşyeri kapalıysa „Günün türü” bölümünde „İşyeri kapalı / toplu izin” seç. Firmanın bunu nasıl ödediğini, izin olarak mı yoksa fazla mesainden mi, Ayarlar, „İşyeri kapalı” bölümünde ayarlarsın. Her hafta aynı gün boşsan veya meslek okuluna gidiyorsan, bunu bir kez Ayarlar, „Sabit boş günler” bölümünde kur. O zaman o günleri senin yerine girerim.", "toplu izin isyeri kapali firma kapali sabit bos gun her hafta okul"], ["Hesap ve birden fazla cihaz", "Hesabınla (e-posta ve şifre) verilerin ayrıca sunucuda yedeklenir. Başka bir telefonda veya bilgisayarda giriş yaparsan tüm kayıtlar orada da olur. İnternet yokken uygulama cihaza kaydeder ve sonra eşitler. Ayarlar, „Hesap” bölümünde her şeyin kaydedilip kaydedilmediğini görür ve çıkış yapabilirsin.", "hesap giris cikis sifre yeni telefon bilgisayar ikinci cihaz esitleme"], ["Ambulans hizmeti ve hasta nakli", "Kızılhaç'ta Kızılhaç toplu sözleşmesi, Samariterbund'da Samariterbund sözleşmesi (BARS) geçerlidir, ikisi de eyalete göre. Kendi sözleşmesi olmayan özel ambulans ve hasta nakil firmaları için, örneğin Grünes Kreuz, Kızılhaç sözleşmesi geçerlidir. Yüksek Mahkemeye göre hasta nakli taksi sözleşmesine göre ödenemez. Ayarlar'da „Ambulans hizmeti” mesleğini ve sözleşmeni seç.", "ambulans kizilhac samariter hasta nakli paramedik kurtarma johanniter malteser"], ["Güne not: boş günü kim istedi?", "Kayıt sekmesinde önemli olan her şeyi „Güne not” bölümüne yazarsın. Boş günlerde orada kimin istediğini de kaydedersin: sen, firmayla anlaşarak ya da firma tarafından verilen. Bu daha sonra mesai karşılığı izin, izin veya maaş konusunda önemlidir ve notlar sapmalarda da görünür.", "not aciklama emredildi kim istedi anlasma sef istek"], ["Yardım ve geliştiriciye sorular", "Ayarlar, „Yardım et (isteğe bağlı)” bölümünde hangi meslekte olduğunu ve bordronun kayıtlardan ne kadar saptığını isimsiz, e-postasız ve tam tutarlar olmadan bildirmeme izin verebilirsin. Cevaplayamadığım soruları öğrenmem için geliştiriciye göndermeme de izin verebilirsin. İkisi de isteğe bağlıdır ve her an kapatılabilir.", "yardim anonim istatistik destek ogren gelistirici"]],
    cs: [["Co aplikace umí", "Stunden-Checker ti ukáže, jestli tvoje mzda sedí. Ty zapíšeš pracovní dobu, já spočítám přesčasy, příplatky, diety a prémie podle tvé kolektivní smlouvy a zákona a všechno porovnám s výplatní páskou. Rozdíly zůstanou zaznamenané, i když to firma dělá jinak. Navíc: rychlé zadání textem, hlasem nebo fotkou denního výkazu, čtení výplatní pásky z fotky nebo PDF, konto dovolené a náhradního volna, lhůty průkazů, plánování mostů a hlášení pro firmu v PDF. Je tu přes 30 oborů s více než 150 kolektivními smlouvami pro všechny spolkové země a aplikace mluví 13 jazyky. Zeptej se mě nebo klepni dole na téma.", "co umi aplikace vsechno funkce prehled pomoc k cemu"], ["Zapsání hodin", "Otevři Zápis. U začátku a konce zadej čas, zapiš přestávky a klepni na Uložit. Tlačítkem „Teď“ vloží aplikace aktuální čas.", "hodiny zapsat zacatek konec pracovni doba ulozit cas den"], ["Přidání prémie", "Jdi do Nastavení, „Moje prémie“, a přidej svou prémii (například za hodinu, za den nebo za kus). Pak ji zapíšeš u dne. Aplikace ji spočítá a porovná s výplatní páskou.", "premie priplatek bonus jerab pridat"], ["Kontrola výplatní pásky", "Otevři záložku Výplatnice a sjeď k „Sedí můj výplatní lístek?“. Opiš hodiny a částky, nebo mě nech pásku přečíst z fotky či PDF (nahoře v „Automatické čtení výplatní pásky“). Aplikace ukáže, co sedí a kde zůstává rozdíl v hodinách nebo eurech. Nemusíš vyplnit všechny řádky.", "vyplatni paska vyplatnice kontrola sedi porovnat vyuctovani mzda"], ["Přesčasy a příplatky", "V Nastavení najdeš týdenní hodiny, model přesčasů a příplatky. Pocházejí z tvé kolektivní smlouvy. Jestli sedí, uvidíš na výplatní pásce. Můžeš je kdykoli změnit, i od určitého data.", "prescasy priplatek nedele sobota svatek noc prace navic"], ["Diety", "Diety (Diäten) jsou denní příspěvek, který dostáváš navíc. V Nastavení, Diety, nastavíš, jestli se platí za hodinu nebo za den podle stupňů. Částku najdeš na výplatní pásce.", "diety stravne denni prispevek cestovne"], ["Změna mzdy nebo povolání", "V Nastavení můžeš změnit mzdu nebo povolání od určitého data. Staré dny se dál počítají se starými hodnotami. Tak to sedí i po zvýšení mzdy nebo změně práce.", "zmena mzdy povolani nova mzda zvyseni od data hodinova mzda"], ["Dovolená nebo nemoc", "V Zápisu zvol u „Druh dne“ například Dovolená, Nemoc nebo Náhradní volno. Pak nemusíš zapisovat časy.", "dovolena nemoc nemocenska nahradni volno volno druh dne"], ["Moje údaje a ochrana dat", "Tvoje záznamy jsou v telefonu. S účtem se navíc ukládají na zabezpečený server ve Frankfurtu, aby se nic neztratilo. Technicky by je provozovatel aplikace mohl vidět. Šifrování, které to vylučuje, se připravuje. Fotky a PDF výplatních pásek a denních výkazů čtu jen v tvém telefonu, nenahrávají se. Uloží se jen čísla, která potvrdíš. Tvoje firma z toho nic nevidí.", "udaje ochrana dat bezpecne ucet ulozeno soukrome predano"], ["Záloha", "V Nastavení úplně dole najdeš „Uložit nebo sdílet zálohu“. Tím se uloží soubor se všemi tvými údaji. S ním můžeš všechno obnovit v novém telefonu.", "zaloha backup ztraceno obnovit novy telefon"], ["Instalace aplikace", "Otevři stránku v prohlížeči a klepni na „Nainstalovat aplikaci“ (menu vpravo nahoře). Pokud Android varuje, klepni na „Přesto nainstalovat“. Aplikace je neškodná, je to jen tato webová stránka.", "instalovat plocha ikona symbol odkaz"], ["Jazyk a čtení nahlas", "Jazyk aplikace vybereš úplně nahoře na stránce. Když se mě ptáš, klepni na mikrofon a mluv. Tlačítkem „Přečíst nahlas“ ti odpověď přečtu. Mikrofon potřebuje internet a tvé povolení v prohlížeči.", "jazyk mluvit mikrofon diktovat precist nahlas cesky preklad"], ["Ztišení Mii", "Klepni na „Ztišit Mii“ a už se nebudu ozývat sama, jen když na mě klepneš. Stejné tlačítko mě zase zapne. Postavu, jméno a vzhled změníš v Profilu, „Můj společník“.", "mia milo ztisit ticho otravuje vypnout"], ["Lhůty a průkazy", "Otevři Profil a sjeď k „Vzdělání, průkazy a lhůty“. Přidej Code 95, kartu řidiče, průkaz na vysokozdvižný vozík nebo vlastní lhůty s datem platnosti. Včas ti připomenu a termín se na přání uloží do kalendáře v telefonu.", "lhuta code 95 karta ridice vysokozdvizny jerab platnost prukaz pripominka skoleni kurz"], ["Doplatek, přepočet, zvláštní platby", "Pokud firma později něco doplatila nebo strhla, zapíšeš to v měsíčním porovnání u „Doplatky a opravy“: za který měsíc, který řádek a kolik. Aplikace to přičte k dřívějšímu měsíci. U „Přepočet hodinové mzdy“ ti ukáže výpočet a jestli částka sedí. Příspěvek na dovolenou, vánoční příspěvek, 13. a 14. plat zapíšeš na záložce Výplatnice u „Zvláštní platby“.", "doplatek doplatit prepocet oprava vanocni prispevek dovolena 13 14 plat zvlastni platby"], ["Novinky", "V Profilu najdeš kartu „Novinky“. Tam zapneš, aby ti Mia říkala novinky, a nastavíš jak často: hned, týdně nebo měsíčně. Dostaneš jen to, co se hodí k tvému povolání. Chceš-li vidět i ostatní, zapni „Novinky i pro jiná povolání“.", "novinky zpravy nova funkce oznameni"], ["Částečný úvazek, práce navíc a náhradní volno", "Pracuješ-li na částečný úvazek a víc, než je dohodnuto, je to až do hranice plného úvazku podle kolektivní smlouvy práce navíc (Mehrarbeit), ne přesčas. Za ni je příplatek 25 %, pokud hodiny nevybereš 1:1 jako náhradní volno ve stejném čtvrtletí. Aplikace to počítá automaticky. Tvoje kolektivní smlouva to může upravit jinak.", "castecny uvazek prace navic nahradni volno ctvrtleti plny uvazek 25"], ["Rodičovská, mateřská, otcovský měsíc", "V Zápisu zvol u „Druh dne“ rodičovskou dovolenou (Karenz), mateřskou ochranu nebo otcovský měsíc. Tyto dny jsou neplacené a nemají povinné hodiny. Rodičovská poměrně krátí nárok na dovolenou, mateřská ochrana ne.", "rodicovska materska otcovsky miminko"], ["Pružná pracovní doba", "Při pružné pracovní době (Gleitzeit) počítá aplikace plusové a minusové hodiny na kontě. Při nastavení zvol „Kancelář s pružnou dobou“ nebo v Nastavení model přesčasů „Gleitzeit“. Tam zapíšeš povinnou dobu pro každý den v týdnu, volitelně počáteční saldo a hranici převodu. Volný den za pružnou dobu odečte povinnou dobu z konta, dovolená a nemoc ne.", "pruzna doba gleitzeit konto saldo plusove minusove hodiny"], ["Žádná práce / uvolnění", "V Zápisu zvol u „Druh dne“ „Žádná práce (uvolněn firmou)“, když tě firma pošle domů pro nedostatek práce. Poznámka ke dni se nastaví sama. Jak firma den účtuje, nastavíš v Nastavení u „Uvolnění z práce (žádná práce)“: firma platí dál, odečet z náhradního volna nebo neplaceně. Pokud to nevíš, aplikace nic neodečte. Tak to vidí i Arbeiterkammer jako základní pravidlo: kdo je připraven pracovat a je poslán domů, mzdu si ponechá. Na výplatní pásce uvidíš, jestli to sedí.", "uvolneni zadna prace poslan domu nedostatek prace"], ["Náhradní volno: 1:1,5 nebo 1:1?", "Zákon o pracovní době (§ 10) říká: příplatek za přesčas se musí zohlednit v náhradním volnu nebo vyplatit zvlášť. Při 50% příplatku tedy buď 1 přesčas = 1,5 hodiny volna, nebo 1:1 a příplatek přijde na výplatní pásku. Tvoje kolektivní smlouva to může upravit jinak. Nastav to v Nastavení u „Jak tvoje firma připisuje přesčasy jako náhradní volno?“. Při čerpání se volno odečítá hodinu za hodinu. V Německu zákonný poměr není, platí tvoje smlouva.", "nahradni volno 1:1 prescasovy priplatek pomer cerpani"], ["Kde to najdu na výplatní pásce?", "Nahoře na pásce je většinou tvé jméno, firma, měsíc a často zařazení, mzdová skupina a kolektivní smlouva (někdy zkratka „KV“). Hodinovou mzdu najdeš v řádku „Lohn“ nebo „Stundenlohn“, hodiny vedle ve sloupci „Menge“. Přesčasy bývají ve vlastních řádcích s 50 % nebo 100 %, náhradní volno v řádku „Zeitausgleich“ nebo „Zeitkonto“, dovolená jako „Resturlaub“. Týdenní hodiny jsou v pracovní smlouvě. Pokud něco chybí, zeptej se v kanceláři nebo v mzdové účtárně. Co nevíš, nech v aplikaci prázdné. Do té doby počítá aplikace s hodnotami tvé kolektivní smlouvy.", "kde najdu paska kolektivni smlouva vyuctovani"], ["Jsem učeň", "Jako učeň dostáváš odměnu učně, většinou pevnou měsíční částku podle ročníku. V Nastavení u „Moje povolání“ zvol druh „Učeň“. Aplikace pak u mzdové skupiny ukáže jen ročníky tvé kolektivní smlouvy a s „Použít minimální mzdu podle kolektivní smlouvy“ částku zapíše. Je-li ve smlouvě jiná částka, zapiš ji u „Pevná měsíční mzda“. Odborná škola se počítá jako pracovní doba: zapiš den jako „Školení / odborná škola“, pevný školní den každý týden v „Pevné volné dny“. Do 18 let platí zákon o ochraně mladistvých, obvykle nejvýš 8 hodin denně a 40 týdně. S otázkami ti pomůže Arbeiterkammer.", "ucen rocnik odborna skola odmena ucne uceni smlouva"], ["Příplatky ve stavebnictví a řemesle", "Ve stavebnictví a řemesle bývají na pásce příplatky: za špínu, ztížené podmínky a nebezpečí, denní příspěvek nebo příplatek za vzdálenost při práci mimo dům, příspěvek na nocleh a montážní příplatek. Přidej je v Nastavení, „Moje prémie“, Mia ti navrhne vhodné. Při špatném počasí ve stavebnictví a dřevostavbách platí část mzdy BUAK, aplikace vede hodiny špatného počasí zvlášť. U malířů je při výpadku kvůli počasí 60 % mzdy. Částky se liší podle kolektivní smlouvy, porovnej je s výplatní páskou.", "stavba remeslo priplatek spatne pocasi montaz ztizeni spina"], ["Úklid, ostraha a péče", "V těchto povoláních je hodně nočních, nedělních a svátečních služeb. Zapiš časy tak, jak jsi pracoval, i přes půlnoc: hodiny se počítají ke dni, kdy služba začala. Příplatky (například noční, stravné, pohotovost) jsou na pásce: přidej je v Nastavení, „Moje prémie“, Mia ti navrhne vhodné. Platí-li u tebe jiná kolektivní smlouva (například zemská nemocnice), zvol „Vlastní hodnoty“.", "uklid ostraha bezpecnost pece nocni sluzba pohotovost"], ["Změna času (letní, zimní)", "Aplikace změnu času počítá automaticky. V říjnu se hodiny ve 3 vrací na 2: kdo tu noc pracuje, pracoval o hodinu déle. Noční směna od 22 do 6 pak má 9 místo 8 hodin. V březnu se hodiny ve 2 posouvají na 3: hodina chybí, směna má 7 místo 8 hodin. Zapiš začátek a konec tak, jak ukazovaly hodiny. Jestli firma hodinu navíc platí, stojí v kolektivní smlouvě nebo podnikové dohodě: podívej se na pásku. Při rozdílu můžeš hodiny u dne upravit.", "zmena casu letni zimni cas hodina navic"], ["Co je mzdová skupina a potřebuju ji?", "Mzdová skupina (zařazení) určuje, jakou minimální mzdu ti kolektivní smlouva přiznává. Nemusíš ji znát: zapiš jen hodinovou mzdu z pásky. Když ji znáš, aplikace zkontroluje, jestli tvoje mzda odpovídá kolektivní smlouvě. Najdeš ji nahoře na pásce (u „Einstufung“, „Lohngruppe“ nebo „Verwendungsgruppe“) nebo v pracovní smlouvě. Když nikde není, zeptej se ve firmě.", "mzdova skupina zarazeni potrebuji tarif co je"], ["Chybí mi ještě údaje, můžu začít?", "Ano, můžeš začít hned, i když mzda, zařazení nebo něco jiného chybí. Zapiš, co už máš, například pracovní dobu. Chybějící hodnoty doplníš kdykoli v Nastavení. Aplikace pak všechny už zapsané dny automaticky přepočítá. Jen porovnání s výplatní páskou v eurech jde až po zadání hodinové mzdy.", "chybi udaje nekompletni zacit doplnit"], ["Kde je zpětná vazba pro vývojáře?", "Vlevo dole v aplikaci je tlačítko „Nahlásit problém“. Klepni na něj, u „O co jde?“ zvol například „Něco nesedí“ nebo „Návrh“, napiš zprávu a klepni na Odeslat. Aplikace přiloží obrázek aktuální stránky, můžeš ho vypnout. Pak uvidíš potvrzení. Zpětnou vazbu najdeš i v Profilu.", "zpetna vazba nahlasit problem chyba navrh vyvojar"], ["Zvláštní volno a práce ve stejný den", "V Zápisu zvol u „Druh dne“ zvláštní volno (nebo Dovolená). Den se připíše s povinnými hodinami. Pokud jsi ten den přesto pracoval, zapiš začátek a konec: u dne pak stojí „plus práce“ a tvoje pracovní doba se přičte k placeným hodinám. Na pásce bývá pro zvláštní volno vlastní řádek, který aplikace porovnává zvlášť.", "zvlastni volno svatba umrti stehovani prace navic"], ["Předpokládaná hrubá mzda a výplata", "V Přehledu vidíš pod hodinami předpokládanou hrubou mzdu spočítanou z tvých záznamů: mzda, přesčasy, prémie a služby, diety zvlášť. Čistou mzdu aplikace neukazuje, protože závisí na více věcech, například na sociálním pojištění, dani, rodinném bonusu a paušálu na dojíždění. Když v Nastavení zapíšeš den výplaty, stojí v Přehledu i datum. Hrubá mzda se objeví až po skončení měsíce, protože předtím mohou chybět záznamy.", "hruba cista vyplata den vyplaty mzda vydelek kolik penize"], ["Kamion v Německu: tarif, diety a noc", "V Německu není jednotný tarif: platí podle spolkové země a jen když je firma tarifně vázaná. Uloženy jsou Spedition und Logistik pro Severní Porýní-Vestfálsko, Bavorsko, Sasko a Berlín. Když při nastavení zvolíš Německo, zadáš svou spolkovou zemi kvůli svátkům. Není-li firma tarifně vázaná, vezmi mzdu a příplatky z pracovní smlouvy a zvol „Vlastní hodnoty“. Řidiči dálkové dopravy mívají vlastní smlouvy. Stravné je osvobozeno od daně do 14 € (víc než 8 hodin) a 28 € (24 hodin), k tomu 9 € za noc v kamionu: nocleh přidáš jako prémii. Noční příplatky také. Všechno porovnej s vyúčtováním.", "nemecko spedice dalkova doprava diety tarif noc nocleh"], ["Slova na výplatní pásce", "Entgeltfortzahlung: firma ti dál platí mzdu, většinou při nemoci. Aufrollung: mzdová účetní přepočítá dřívější měsíce, například po zvýšení mzdy, a rozdíl doplatí nebo strhne. Rückverrechnung: něco už vyúčtovaného se zpětně odečte. Vorschuss: záloha, která se při vyúčtování odečte. Pfändung: na příkaz soudu firma zadrží částku a převede ji dál. Sachbezug: výhoda od firmy, například služební auto i pro soukromé jízdy; připočte se ke mzdě jako hodnota, ale nevyplácí se. MA-Vorsorgekasse: firma platí na tvé odstupné, stačí hlídat, že řádek tam je. Kolektivní smlouvu páska často vůbec neuvádí. Podívej se na „Tarifgruppe“ a „Beschäftigt als“, to je tvé zařazení.", "slova paska entgeltfortzahlung aufrollung vorschuss pfandung sachbezug vorsorgekasse odstupne"], ["Kontrola čisté mzdy kalkulačkou BMF", "Čistou mzdu aplikace sama nepočítá. Tlačítko otevře kalkulačku hrubé a čisté mzdy rakouského ministerstva financí (BMF) v novém okně. Je to nezávazný modelový výpočet. Zadej tam hrubou mzdu shora a nastav: období měsíčně, skupinu pojištění jako na pásce (dělník nebo zaměstnanec), rok, spolkovou zemi pracoviště, paušál na dojíždění a děti podle sebe. Čistou mzdu porovnej s řádkem výplaty na pásce. Malé rozdíly jsou normální, například kvůli dietám, odborovému příspěvku nebo zálohám.", "cista bmf kalkulacka ministerstvo financi vyplata prepocitat"], ["Rychlé zadání (text, hlas, fotka)", "V „Rychlém zadání“ jen napíšeš nebo řekneš, co jsi dělal, například „včera od 6 do 15, 30 minut přestávka, zákazník Müller výkop“. Udělám z toho záznamy, ty je zkontroluješ a uložíš. Můžeš i vyfotit denní výkaz a já z něj převezmu časy. Funkce je zpočátku vypnutá: zapni ji v Nastavení, „Pomůcky pro zadávání“. Pak je karta úplně nahoře v Zápisu. Mikrofon potřebuje internet a tvé povolení.", "rychle zadani hlasova zprava diktovat mluvit denni vykaz fotka text"], ["Výplatní páska z fotky nebo PDF", "Na záložce Výplatnice jednou povol v „Automatické čtení výplatní pásky“, aby aplikace četla tvou pásku. Pak klepni na „Číst výplatní pásku“ a vyber fotku nebo PDF. Čtu ji jen tady v telefonu, nic se nenahrává. Každý řádek potvrdíš, pak je všechno v porovnání „Sedí můj výplatní lístek?“. Když řádek neznám, jednou ho přiřadíš a já si ho zapamatuju na další měsíce. V Nastavení, „Nastavení s výplatním lístkem“, tím zkontroluji i tvá nastavení.", "fotka foto pdf sken cist paska fotoaparat automaticky"], ["Dva výpočty: kolektivní smlouva a firma", "Vždy počítám dvakrát: jednou tak, jak by to mělo být podle kolektivní smlouvy a zákona, a jednou tak, jak to dělá tvoje firma, tedy podle tvých nastavení. Zákon a kolektivní smlouva mají přednost. Rozdíl uvidíš v přehledu a v porovnání s výplatní páskou. V Přehledu, „Rok a účty“, zůstane každá odchylka v „Zaznamenané odchylky“, i když to firma dělá vždycky tak. Seznam můžeš zkopírovat a ukázat například v Arbeiterkammer. Vše s výhradou: rozdíl může vzniknout i chybou při zadávání.", "odchylka rozdil firma zakon dva vypocty zaznamenane arbeiterkammer pravo malo"], ["Kolektivní smlouva a spolková země", "V Nastavení, „Moje povolání“, zvolíš povolání a v „Má kolektivní smlouva“ správnou smlouvu. Mnoho kolektivních smluv se liší podle spolkové země. Zadej spolkovou zemi v Nastavení, „Moje údaje“, pak ti navrhnu správnou smlouvu a příplatky tvé země a řeknu, když něco nesedí. Když svou smlouvu nenajdeš, zvol „Vlastní hodnoty“ a zapiš mzdu a příplatky z pracovní smlouvy.", "spolkova zeme kolektivni smlouva ktera smlouva viden tyrolsko styrsko korutany salcburk"], ["Jaká povolání tu jsou?", "Mimo jiné: kamion, bagr, malá doprava, autobus a taxi, stavba a řemeslo, sklad, dílna, průmysl, potravinářský průmysl, obchod, kancelář, obchodní zástupce, gastronomie a hotel, pekárna, cukrárna, řeznictví, úklid, ostraha, péče a sociální služby, záchranná služba, ordinace, zubní technika, optika, kadeřník, kosmetika, pošta, železnice, spolková služba, zahradnictví a lesnictví, lanovky, kino, kominík, garáž a čerpací stanice, prádelna, plasty a deratizace, všude s učni, kde jsou. Pokud tvé chybí, zvol „Něco jiného“ a zapiš vlastní hodnoty. Napiš mi přes „Nahlásit problém“, které povolání chybí.", "povolani jake povolani chybi obor prace pracuji jako"], ["Hlášení pro firmu (PDF)", "Úplně dole v Zápisu najdeš „Hlášení pro firmu“: zvol den, týden, půl měsíce nebo měsíc a „Vytvořit PDF a odeslat“ nebo ulož. V Nastavení, „Hlášení pro firmu“, nastavíš jméno na hlášení, kdy ho firma chce, e-mail firmy a jestli se má tisknout tvůj podpis. Pak ti včas připomenu.", "hlaseni pdf vykaz prace poslat firma podpis tisk mesicni tydenni"], ["Dovolená, náhradní volno a přesčasy v přehledu", "V Přehledu, „Rok a účty“, najdeš evidenci hodin, kartu dovolené s nárokem, vybranými dny a zbytkem dovolené, konto náhradního volna a „Přesčasy v přehledu“: co jsi zapsal, co bylo vyplaceno a co šlo na konto. Zapiš stav z pásky a hned uvidíš, jestli sedí. Nárok na dovolenou počítám z data nástupu v profilu.", "zbytek dovolene narok karta dovolene konto nahradniho volna stav prescasy prehled evidence hodin"], ["Plánování volných dnů (mosty)", "V Přehledu, „Rok a účty“, ti „Plánování volných dnů“ ukáže nejlepší mosty: s málo dny dovolené nebo náhradního volna co nejvíc volných dnů v kuse. Sobota a neděle se počítají jako volné. Předem se zeptej v práci, jestli se v ty dny pracuje.", "most planovat volne dny prodlouzeny vikend dovolena planovani"], ["Vzhled Mii: postava, oblečení, barvy, hlas", "V Profilu, „Můj společník“, vybereš mou postavu a jméno. Volbou „Navrhnout Miu sám“ si vybereš oblečení, doplňky a barvy, například žlutou nebo oranžovou reflexní vestu. Když je vypnutá, oblékám se podle tvého povolání. Tam taky nastavíš, jestli mluvím hlasem, a pod tím vybereš ikonu aplikace.", "vzhled postava obleceni barva vesta hlas navrhnout jmeno milo ikona obrazek"], ["Zkušební režim", "V Nastavení najdeš zkušební režim. S ním vyzkoušíš jiná povolání nebo nastavení, aniž by se změnila tvá skutečná data. Nahoře pak svítí červené upozornění. Tlačítkem „Zpět k mým datům“ se vrátíš a všechno vyzkoušené se smaže.", "zkusebni rezim vyzkouset testovat jine povolani"], ["Zákazníci, stavby, vozidlo a kilometry", "V Nastavení, „Co zaznamenávám“, zapneš, co chceš navíc zapisovat: vozidlo a kilometry, zákazníky, stavby a činnosti nebo prémie. Pak se v Zápisu objeví potřebná pole, například „+ Přidat zákazníka / stavbu“ s časem na zákazníka. V profilu můžeš nastavit, aby se stav tachometru z minula zapsal automaticky.", "zakaznik zakaznici stavba cinnost vozidlo kilometry tachometr spz zakazka"], ["Provoz uzavřen a pevné volné dny", "Když je provoz zavřený, zvol u „Druh dne“ „Provoz uzavřen / hromadná dovolená“. Jak to firma platí, jako dovolenou nebo z tvých přesčasů, nastavíš v Nastavení, „Provoz uzavřen“. Máš-li volno každý týden ve stejný den nebo odbornou školu, nastav to jednou v Nastavení, „Pevné volné dny“. Pak ty dny zapíšu za tebe.", "hromadna dovolena provoz uzavren firma zavrena pevne volne dny kazdy tyden skola"], ["Účet a více zařízení", "S účtem (e-mail a heslo) jsou tvá data navíc zálohovaná na serveru. Když se přihlásíš na jiném telefonu nebo počítači, jsou tam všechny záznamy. Bez internetu aplikace ukládá do zařízení a později synchronizuje. V Nastavení, „Účet“, vidíš, jestli je všechno uložené, a můžeš se odhlásit.", "ucet prihlasit odhlasit heslo novy telefon pocitac druhe zarizeni synchronizace"], ["Záchranná služba a převoz pacientů", "U Červeného kříže platí kolektivní smlouva Červeného kříže, u Samariterbundu smlouva Samariterbundu (BARS), obě podle spolkové země. Pro soukromé firmy záchranné a dopravní zdravotní služby bez vlastní smlouvy, například Grünes Kreuz, platí smlouva Červeného kříže. Podle Nejvyššího soudu nesmí být převoz pacientů placen podle smlouvy pro taxi. V Nastavení zvol povolání „Záchranná služba“ a svou smlouvu.", "zachranna sluzba cerveny kriz samariter prevoz pacientu zachranar sanitka johanniter malteser"], ["Poznámka ke dni: kdo chtěl volno?", "V Zápisu napíšeš do „Poznámka ke dni“ všechno důležité. U volných dnů tam také zaznamenáš, kdo ho chtěl: ty sám, dohodnuto s firmou nebo nařízeno firmou. To se počítá později u náhradního volna, dovolené nebo mzdy a poznámky jsou vidět u odchylek.", "poznamka narizeno kdo chtel dohodnuto sef prani"], ["Pomoc a otázky pro vývojáře", "V Nastavení, „Pomoci (volitelné)“, můžeš povolit, abych anonymně hlásila, v jakém jsi povolání a jak moc se páska liší od záznamů, bez jména, e-mailu a přesných částek. Můžeš také povolit, abych vývojáři posílala otázky, na které neumím odpovědět, abych se učila. Obojí je volitelné a kdykoli vypnutelné.", "pomoci anonymne statistika podpora ucit vyvojar"]],
    sk: [["Čo aplikácia vie", "Stunden-Checker ti ukáže, či tvoja mzda sedí. Ty zapíšeš pracovný čas, ja spočítam nadčasy, príplatky, diéty a prémie podľa tvojej kolektívnej zmluvy a zákona a všetko porovnám s výplatnou páskou. Rozdiely zostanú zaznamenané, aj keď to firma robí inak. Navyše: rýchle zadanie textom, hlasom alebo fotkou denného výkazu, čítanie výplatnej pásky z fotky alebo PDF, konto dovolenky a náhradného voľna, lehoty preukazov, plánovanie predĺžených víkendov a hlásenia pre firmu v PDF. Je tu viac ako 30 odborov s viac ako 150 kolektívnymi zmluvami pre všetky spolkové krajiny a aplikácia hovorí 13 jazykmi. Spýtaj sa ma alebo ťukni dole na tému.", "co vie aplikacia vsetko funkcie prehlad pomoc na co"], ["Zápis hodín", "Otvor Zápis. Pri začiatku a konci zadaj čas, zapíš prestávky a ťukni na Uložiť. Tlačidlom „Teraz“ vloží aplikácia aktuálny čas.", "hodiny zapisat zaciatok koniec pracovny cas ulozit cas den"], ["Pridanie prémie", "Choď do Nastavení, „Moje prémie“, a pridaj svoju prémiu (napríklad za hodinu, za deň alebo za kus). Potom ju zapíšeš pri dni. Aplikácia ju vypočíta a porovná s výplatnou páskou.", "premia priplatok bonus zeriav pridat"], ["Kontrola výplatnej pásky", "Otvor záložku Výplatná páska a choď nadol k „Sedí môj výplatný lístok?“. Prepíš hodiny a sumy, alebo ma nechaj pásku prečítať z fotky či PDF (hore v „Automatické čítanie výplatnej pásky“). Aplikácia ukáže, čo sedí a kde zostáva rozdiel v hodinách alebo eurách. Nemusíš vyplniť všetky riadky.", "vyplatna paska kontrola sedi porovnat vyuctovanie mzda"], ["Nadčasy a príplatky", "V Nastaveniach nájdeš týždenné hodiny, model nadčasov a príplatky. Pochádzajú z tvojej kolektívnej zmluvy. Či sedia, uvidíš na výplatnej páske. Môžeš ich kedykoľvek zmeniť, aj od určitého dátumu.", "nadcasy priplatok nedela sobota sviatok noc praca navyse"], ["Diéty", "Diéty (Diäten) sú denný príspevok, ktorý dostávaš navyše. V Nastaveniach, Diéty, nastavíš, či sa platí za hodinu alebo za deň podľa stupňov. Sumu nájdeš na výplatnej páske.", "diety stravne denny prispevok cestovne"], ["Zmena mzdy alebo povolania", "V Nastaveniach môžeš zmeniť mzdu alebo povolanie od určitého dátumu. Staré dni sa ďalej počítajú so starými hodnotami. Tak to sedí aj po zvýšení mzdy alebo zmene práce.", "zmena mzdy povolania nova mzda zvysenie od datumu hodinova mzda"], ["Dovolenka alebo choroba", "V Zápise zvoľ pri „Druh dňa“ napríklad Dovolenka, Choroba alebo Náhradné voľno. Potom nemusíš zapisovať časy.", "dovolenka choroba nemocenska nahradne volno volno druh dna"], ["Moje údaje a ochrana údajov", "Tvoje záznamy sú v telefóne. S účtom sa navyše ukladajú na zabezpečený server vo Frankfurte, aby sa nič nestratilo. Technicky by ich prevádzkovateľ aplikácie mohol vidieť. Šifrovanie, ktoré to vylučuje, sa pripravuje. Fotky a PDF výplatných pások a denných výkazov čítam len v tvojom telefóne, nenahrávajú sa. Uložia sa len čísla, ktoré potvrdíš. Tvoja firma z toho nič nevidí.", "udaje ochrana bezpecne ucet ulozene sukromne odovzdane"], ["Záloha", "V Nastaveniach úplne dole nájdeš „Uložiť alebo zdieľať zálohu“. Tým sa uloží súbor so všetkými tvojimi údajmi. S ním môžeš všetko obnoviť v novom telefóne.", "zaloha backup stratene obnovit novy telefon"], ["Inštalácia aplikácie", "Otvor stránku v prehliadači a ťukni na „Nainštalovať aplikáciu“ (menu vpravo hore). Ak Android varuje, ťukni na „Napriek tomu nainštalovať“. Aplikácia je neškodná, je to len táto webová stránka.", "instalovat plocha ikona symbol odkaz"], ["Jazyk a čítanie nahlas", "Jazyk aplikácie vyberieš úplne hore na stránke. Keď sa ma pýtaš, ťukni na mikrofón a hovor. Tlačidlom „Prečítať nahlas“ ti odpoveď prečítam. Mikrofón potrebuje internet a tvoje povolenie v prehliadači.", "jazyk hovorit mikrofon diktovat precitat nahlas slovensky preklad"], ["Stíšenie Mie", "Ťukni na „Stíšiť Miu“ a už sa nebudem ozývať sama, len keď na mňa ťukneš. To isté tlačidlo ma znova zapne. Postavu, meno a vzhľad zmeníš v Profile, „Môj spoločník“.", "mia milo stisit ticho otravuje vypnut"], ["Lehoty a preukazy", "Otvor Profil a choď nadol k „Vzdelanie, preukazy a lehoty“. Pridaj Code 95, kartu vodiča, preukaz na vysokozdvižný vozík alebo vlastné lehoty s dátumom platnosti. Včas ti pripomeniem a termín sa na želanie uloží do kalendára v telefóne.", "lehota code 95 karta vodica vysokozdvizny zeriav platnost preukaz pripomienka skolenie kurz"], ["Doplatok, prepočet, zvláštne platby", "Ak firma neskôr niečo doplatila alebo zrazila, zapíšeš to v mesačnom porovnaní pri „Doplatky a opravy“: za ktorý mesiac, ktorý riadok a koľko. Aplikácia to pripočíta k skoršiemu mesiacu. Pri „Prepočet hodinovej mzdy“ ti ukáže výpočet a či suma sedí. Príspevok na dovolenku, vianočný príspevok, 13. a 14. plat zapíšeš na záložke Výplatná páska pri „Zvláštne platby“.", "doplatok prepocet oprava vianocny prispevok dovolenka 13 14 plat zvlastne platby"], ["Novinky", "V Profile nájdeš kartu „Novinky“. Tam zapneš, aby ti Mia hovorila novinky, a nastavíš, ako často: hneď, týždenne alebo mesačne. Dostaneš len to, čo sa hodí k tvojmu povolaniu. Ak chceš vidieť aj ostatné, zapni „Novinky aj pre iné povolania“.", "novinky spravy nova funkcia oznamenie"], ["Čiastočný úväzok, práca navyše a náhradné voľno", "Ak pracuješ na čiastočný úväzok a viac, než je dohodnuté, je to až po hranicu plného úväzku podľa kolektívnej zmluvy práca navyše (Mehrarbeit), nie nadčas. Za ňu je príplatok 25 %, ak hodiny nevyberieš 1:1 ako náhradné voľno v tom istom štvrťroku. Aplikácia to počíta automaticky. Tvoja kolektívna zmluva to môže upraviť inak.", "ciastocny uvazok praca navyse nahradne volno stvrtrok plny uvazok 25"], ["Rodičovská, materská, otcovský mesiac", "V Zápise zvoľ pri „Druh dňa“ rodičovskú dovolenku (Karenz), materskú ochranu alebo otcovský mesiac. Tieto dni sú neplatené a nemajú povinné hodiny. Rodičovská pomerne kráti nárok na dovolenku, materská ochrana nie.", "rodicovska materska otcovsky babatko"], ["Pružný pracovný čas", "Pri pružnom pracovnom čase (Gleitzeit) počíta aplikácia plusové a mínusové hodiny na konte. Pri nastavení zvoľ „Kancelária s pružným časom“ alebo v Nastaveniach model nadčasov „Gleitzeit“. Tam zapíšeš povinný čas pre každý deň v týždni, voliteľne počiatočné saldo a hranicu prenosu. Voľný deň za pružný čas odpočíta povinný čas z konta, dovolenka a choroba nie.", "pruzny cas gleitzeit konto saldo plusove minusove hodiny"], ["Žiadna práca / uvoľnenie", "V Zápise zvoľ pri „Druh dňa“ „Žiadna práca (uvoľnený firmou)“, keď ťa firma pošle domov pre nedostatok práce. Poznámka k dňu sa nastaví sama. Ako firma deň účtuje, nastavíš v Nastaveniach pri „Uvoľnenie z práce (žiadna práca)“: firma platí ďalej, odpočet z náhradného voľna alebo neplatene. Ak to nevieš, aplikácia nič neodpočíta. Tak to vidí aj Arbeiterkammer ako základné pravidlo: kto je pripravený pracovať a je poslaný domov, mzdu si ponechá. Na výplatnej páske uvidíš, či to sedí.", "uvolnenie ziadna praca poslany domov nedostatok prace"], ["Náhradné voľno: 1:1,5 alebo 1:1?", "Zákon o pracovnom čase (§ 10) hovorí: príplatok za nadčas sa musí zohľadniť v náhradnom voľne alebo vyplatiť zvlášť. Pri 50 % príplatku teda buď 1 nadčas = 1,5 hodiny voľna, alebo 1:1 a príplatok príde na výplatnú pásku. Tvoja kolektívna zmluva to môže upraviť inak. Nastav to v Nastaveniach pri „Ako tvoja firma pripisuje nadčasy ako náhradné voľno?“. Pri čerpaní sa voľno odpočítava hodinu za hodinu. V Nemecku zákonný pomer nie je, platí tvoja zmluva.", "nahradne volno 1:1 priplatok nadcas pomer cerpanie"], ["Kde to nájdem na výplatnej páske?", "Hore na páske je väčšinou tvoje meno, firma, mesiac a často zaradenie, mzdová skupina a kolektívna zmluva (niekedy skratka „KV“). Hodinovú mzdu nájdeš v riadku „Lohn“ alebo „Stundenlohn“, hodiny vedľa v stĺpci „Menge“. Nadčasy bývajú vo vlastných riadkoch s 50 % alebo 100 %, náhradné voľno v riadku „Zeitausgleich“ alebo „Zeitkonto“, dovolenka ako „Resturlaub“. Týždenné hodiny sú v pracovnej zmluve. Ak niečo chýba, spýtaj sa v kancelárii alebo v mzdovej účtárni. Čo nevieš, nechaj v aplikácii prázdne. Dovtedy počíta aplikácia s hodnotami tvojej kolektívnej zmluvy.", "kde najdem paska kolektivna zmluva vyuctovanie"], ["Som učeň", "Ako učeň dostávaš odmenu učňa, väčšinou pevnú mesačnú sumu podľa ročníka. V Nastaveniach pri „Moje povolanie“ zvoľ druh „Učeň“. Aplikácia potom pri mzdovej skupine ukáže len ročníky tvojej kolektívnej zmluvy a s „Použiť minimálnu mzdu podľa kolektívnej zmluvy“ sumu zapíše. Ak je v zmluve iná suma, zapíš ju pri „Pevná mesačná mzda“. Odborná škola sa počíta ako pracovný čas: zapíš deň ako „Školenie / odborná škola“, pevný školský deň každý týždeň v „Pevné voľné dni“. Do 18 rokov platí zákon o ochrane mladistvých, zvyčajne najviac 8 hodín denne a 40 týždenne. S otázkami ti pomôže Arbeiterkammer.", "ucen rocnik odborna skola odmena ucna ucenie zmluva"], ["Príplatky v stavebníctve a remesle", "V stavebníctve a remesle bývajú na páske príplatky: za špinu, sťažené podmienky a nebezpečenstvo, denný príspevok alebo príplatok za vzdialenosť pri práci mimo domu, príspevok na nocľah a montážny príplatok. Pridaj ich v Nastaveniach, „Moje prémie“, Mia ti navrhne vhodné. Pri zlom počasí v stavebníctve a drevostavbách platí časť mzdy BUAK, aplikácia vedie hodiny zlého počasia zvlášť. U maliarov je pri výpadku kvôli počasiu 60 % mzdy. Sumy sa líšia podľa kolektívnej zmluvy, porovnaj ich s výplatnou páskou.", "stavba remeslo priplatok zle pocasie montaz stazenie spina"], ["Upratovanie, ochrana a opatrovanie", "V týchto povolaniach je veľa nočných, nedeľných a sviatočných služieb. Zapíš časy tak, ako si pracoval, aj cez polnoc: hodiny sa počítajú ku dňu, keď služba začala. Príplatky (napríklad nočný, stravné, pohotovosť) sú na páske: pridaj ich v Nastaveniach, „Moje prémie“, Mia ti navrhne vhodné. Ak u teba platí iná kolektívna zmluva (napríklad krajinská nemocnica), zvoľ „Vlastné hodnoty“.", "upratovanie ochrana bezpecnost opatrovanie nocna sluzba pohotovost"], ["Zmena času (letný, zimný)", "Aplikácia zmenu času počíta automaticky. V októbri sa hodiny o 3:00 vracajú na 2:00: kto tú noc pracuje, pracoval o hodinu dlhšie. Nočná zmena od 22 do 6 má potom 9 namiesto 8 hodín. V marci sa hodiny o 2:00 posúvajú na 3:00: hodina chýba, zmena má 7 namiesto 8 hodín. Zapíš začiatok a koniec tak, ako ukazovali hodiny. Či firma hodinu navyše platí, je v kolektívnej zmluve alebo podnikovej dohode: pozri sa na pásku. Pri rozdiele môžeš hodiny pri dni upraviť.", "zmena casu letny zimny cas hodina navyse"], ["Čo je mzdová skupina a potrebujem ju?", "Mzdová skupina (zaradenie) určuje, akú minimálnu mzdu ti kolektívna zmluva priznáva. Nemusíš ju poznať: zapíš len hodinovú mzdu z pásky. Keď ju poznáš, aplikácia skontroluje, či tvoja mzda zodpovedá kolektívnej zmluve. Nájdeš ju hore na páske (pri „Einstufung“, „Lohngruppe“ alebo „Verwendungsgruppe“) alebo v pracovnej zmluve. Ak nikde nie je, spýtaj sa vo firme.", "mzdova skupina zaradenie potrebujem tarif co je"], ["Chýbajú mi ešte údaje, môžem začať?", "Áno, môžeš začať hneď, aj keď mzda, zaradenie alebo niečo iné chýba. Zapíš, čo už máš, napríklad pracovný čas. Chýbajúce hodnoty doplníš kedykoľvek v Nastaveniach. Aplikácia potom všetky už zapísané dni automaticky prepočíta. Len porovnanie s výplatnou páskou v eurách ide až po zadaní hodinovej mzdy.", "chybaju udaje nekompletne zacat doplnit"], ["Kde je spätná väzba pre vývojára?", "Vľavo dole v aplikácii je tlačidlo „Nahlásiť problém“. Ťukni naň, pri „O čo ide?“ zvoľ napríklad „Niečo nesedí“ alebo „Návrh“, napíš správu a ťukni na Odoslať. Aplikácia priloží obrázok aktuálnej stránky, môžeš ho vypnúť. Potom uvidíš potvrdenie. Spätnú väzbu nájdeš aj v Profile.", "spatna vazba nahlasit problem chyba navrh vyvojar"], ["Zvláštne voľno a práca v ten istý deň", "V Zápise zvoľ pri „Druh dňa“ zvláštne voľno (alebo Dovolenka). Deň sa pripíše s povinnými hodinami. Ak si v ten deň predsa pracoval, zapíš začiatok a koniec: pri dni potom stojí „plus práca“ a tvoj pracovný čas sa pripočíta k plateným hodinám. Na páske býva pre zvláštne voľno vlastný riadok, ktorý aplikácia porovnáva zvlášť.", "zvlastne volno svadba umrtie stahovanie praca navyse"], ["Predpokladaná hrubá mzda a výplata", "V Prehľade vidíš pod hodinami predpokladanú hrubú mzdu vypočítanú z tvojich záznamov: mzda, nadčasy, prémie a služby, diéty zvlášť. Čistú mzdu aplikácia neukazuje, lebo závisí od viacerých vecí, napríklad od sociálneho poistenia, dane, rodinného bonusu a paušálu na dochádzanie. Keď v Nastaveniach zapíšeš deň výplaty, je v Prehľade aj dátum. Hrubá mzda sa objaví až po skončení mesiaca, lebo predtým môžu chýbať záznamy.", "hruba cista vyplata den vyplaty mzda zarobok kolko peniaze"], ["Kamión v Nemecku: tarif, diéty a noc", "V Nemecku nie je jednotný tarif: platí podľa spolkovej krajiny a len keď je firma tarifne viazaná. Uložené sú Spedition und Logistik pre Severné Porýnie-Vestfálsko, Bavorsko, Sasko a Berlín. Keď pri nastavení zvolíš Nemecko, zadáš svoju spolkovú krajinu kvôli sviatkom. Ak firma nie je tarifne viazaná, vezmi mzdu a príplatky z pracovnej zmluvy a zvoľ „Vlastné hodnoty“. Vodiči diaľkovej dopravy mávajú vlastné zmluvy. Stravné je oslobodené od dane do 14 € (viac ako 8 hodín) a 28 € (24 hodín), k tomu 9 € za noc v kamióne: nocľah pridáš ako prémiu. Nočné príplatky tiež. Všetko porovnaj s vyúčtovaním.", "nemecko spedicia dialkova doprava diety tarif noc nocah"], ["Slová na výplatnej páske", "Entgeltfortzahlung: firma ti ďalej platí mzdu, väčšinou pri chorobe. Aufrollung: mzdová účtovníčka prepočíta skoršie mesiace, napríklad po zvýšení mzdy, a rozdiel doplatí alebo zrazí. Rückverrechnung: niečo už vyúčtované sa spätne odpočíta. Vorschuss: preddavok, ktorý sa pri vyúčtovaní odpočíta. Pfändung: na príkaz súdu firma zadrží sumu a prevedie ju ďalej. Sachbezug: výhoda od firmy, napríklad služobné auto aj na súkromné jazdy; pripočíta sa k mzde ako hodnota, ale nevypláca sa. MA-Vorsorgekasse: firma platí na tvoje odchodné, stačí sledovať, či je riadok na páske. Kolektívnu zmluvu páska často vôbec neuvádza. Pozri sa na „Tarifgruppe“ a „Beschäftigt als“, to je tvoje zaradenie.", "slova paska entgeltfortzahlung aufrollung vorschuss pfandung sachbezug vorsorgekasse odchodne"], ["Kontrola čistej mzdy kalkulačkou BMF", "Čistú mzdu aplikácia sama nepočíta. Tlačidlo otvorí kalkulačku hrubej a čistej mzdy rakúskeho ministerstva financií (BMF) v novom okne. Je to nezáväzný modelový výpočet. Zadaj tam hrubú mzdu zhora a nastav: obdobie mesačne, skupinu poistenia ako na páske (robotník alebo zamestnanec), rok, spolkovú krajinu pracoviska, paušál na dochádzanie a deti podľa seba. Čistú mzdu porovnaj s riadkom výplaty na páske. Malé rozdiely sú normálne, napríklad kvôli diétam, odborovému príspevku alebo preddavkom.", "cista bmf kalkulacka ministerstvo financii vyplata prepocitat"], ["Rýchle zadanie (text, hlas, fotka)", "V „Rýchlom zadaní“ len napíšeš alebo povieš, čo si robil, napríklad „včera od 6 do 15, 30 minút prestávka, zákazník Müller výkop“. Urobím z toho záznamy, ty ich skontroluješ a uložíš. Môžeš aj odfotiť denný výkaz a ja z neho prevezmem časy. Funkcia je spočiatku vypnutá: zapni ju v Nastaveniach, „Pomôcky na zadávanie“. Potom je karta úplne hore v Zápise. Mikrofón potrebuje internet a tvoje povolenie.", "rychle zadanie hlasova sprava diktovat hovorit denny vykaz fotka text"], ["Výplatná páska z fotky alebo PDF", "Na záložke Výplatná páska raz povoľ v „Automatické čítanie výplatnej pásky“, aby aplikácia čítala tvoju pásku. Potom ťukni na „Čítať výplatnú pásku“ a vyber fotku alebo PDF. Čítam ju len tu v telefóne, nič sa nenahráva. Každý riadok potvrdíš, potom je všetko v porovnaní „Sedí môj výplatný lístok?“. Keď riadok nepoznám, raz ho priradíš a ja si ho zapamätám na ďalšie mesiace. V Nastaveniach, „Nastavenia s výplatným lístkom“, tým skontrolujem aj tvoje nastavenia.", "fotka foto pdf sken citat paska fotoaparat automaticky"], ["Dva výpočty: kolektívna zmluva a firma", "Vždy počítam dvakrát: raz tak, ako by to malo byť podľa kolektívnej zmluvy a zákona, a raz tak, ako to robí tvoja firma, teda podľa tvojich nastavení. Zákon a kolektívna zmluva majú prednosť. Rozdiel uvidíš v prehľade a v porovnaní s výplatnou páskou. V Prehľade, „Rok a účty“, zostane každá odchýlka v „Zaznamenané odchýlky“, aj keď to firma robí vždy tak. Zoznam môžeš skopírovať a ukázať napríklad v Arbeiterkammer. Všetko s výhradou: rozdiel môže vzniknúť aj chybou pri zadávaní.", "odchylka rozdiel firma zakon dva vypocty zaznamenane arbeiterkammer pravo malo"], ["Kolektívna zmluva a spolková krajina", "V Nastaveniach, „Moje povolanie“, zvolíš povolanie a v „Moja kolektívna zmluva“ správnu zmluvu. Mnohé kolektívne zmluvy sa líšia podľa spolkovej krajiny. Zadaj spolkovú krajinu v Nastaveniach, „Moje údaje“, potom ti navrhnem správnu zmluvu a príplatky tvojej krajiny a poviem, keď niečo nesedí. Keď svoju zmluvu nenájdeš, zvoľ „Vlastné hodnoty“ a zapíš mzdu a príplatky z pracovnej zmluvy.", "spolkova krajina kolektivna zmluva ktora zmluva vieden tirolsko stajersko korutansko salzburg"], ["Aké povolania tu sú?", "Okrem iného: kamión, bager, malá doprava, autobus a taxi, stavba a remeslo, sklad, dielňa, priemysel, potravinársky priemysel, obchod, kancelária, obchodný zástupca, gastronómia a hotel, pekáreň, cukráreň, mäsiarstvo, upratovanie, ochrana, opatrovanie a sociálne služby, záchranná služba, ambulancia, zubná technika, optika, kaderník, kozmetika, pošta, železnica, spolková služba, záhradníctvo a lesníctvo, lanovky, kino, kominár, garáž a čerpacia stanica, práčovňa, plasty a deratizácia, všade s učňami, kde sú. Ak tvoje chýba, zvoľ „Niečo iné“ a zapíš vlastné hodnoty. Napíš mi cez „Nahlásiť problém“, ktoré povolanie chýba.", "povolania ake povolanie chyba obor praca pracujem ako"], ["Hlásenie pre firmu (PDF)", "Úplne dole v Zápise nájdeš „Hlásenie pre firmu“: zvoľ deň, týždeň, pol mesiaca alebo mesiac a „Vytvoriť PDF a odoslať“ alebo ulož. V Nastaveniach, „Hlásenia pre firmu“, nastavíš meno na hlásení, kedy ho firma chce, e-mail firmy a či sa má tlačiť tvoj podpis. Potom ti včas pripomeniem.", "hlasenie pdf vykaz prace poslat firma podpis tlac mesacny tyzdenny"], ["Dovolenka, náhradné voľno a nadčasy v prehľade", "V Prehľade, „Rok a účty“, nájdeš evidenciu hodín, kartu dovolenky s nárokom, vybranými dňami a zvyškom dovolenky, konto náhradného voľna a „Nadčasy v prehľade“: čo si zapísal, čo bolo vyplatené a čo išlo na konto. Zapíš stav z pásky a hneď uvidíš, či sedí. Nárok na dovolenku počítam z dátumu nástupu v profile.", "zvysok dovolenky narok karta dovolenky konto nahradneho volna stav nadcasy prehlad evidencia hodin"], ["Plánovanie voľných dní (predĺžené víkendy)", "V Prehľade, „Rok a účty“, ti „Plánovanie voľných dní“ ukáže najlepšie dni na predĺžené voľno: s málo dňami dovolenky alebo náhradného voľna čo najviac voľných dní za sebou. Sobota a nedeľa sa počítajú ako voľné. Vopred sa spýtaj v práci, či sa v tie dni pracuje.", "predlzeny vikend planovat volne dni dovolenka planovanie most"], ["Vzhľad Mie: postava, oblečenie, farby, hlas", "V Profile, „Môj spoločník“, vyberieš moju postavu a meno. Voľbou „Navrhnúť Miu sám“ si vyberieš oblečenie, doplnky a farby, napríklad žltú alebo oranžovú reflexnú vestu. Keď je vypnutá, obliekam sa podľa tvojho povolania. Tam tiež nastavíš, či hovorím hlasom, a pod tým vyberieš ikonu aplikácie.", "vzhlad postava oblecenie farba vesta hlas navrhnut meno milo ikona obrazok"], ["Skúšobný režim", "V Nastaveniach nájdeš skúšobný režim. S ním vyskúšaš iné povolania alebo nastavenia bez zmeny tvojich skutočných údajov. Hore potom svieti červené upozornenie. Tlačidlom „Späť k mojim údajom“ sa vrátiš a všetko vyskúšané sa zmaže.", "skusobny rezim vyskusat testovat ine povolanie"], ["Zákazníci, stavby, vozidlo a kilometre", "V Nastaveniach, „Čo zaznamenávam“, zapneš, čo chceš navyše zapisovať: vozidlo a kilometre, zákazníkov, stavby a činnosti alebo prémie. Potom sa v Zápise objavia potrebné polia, napríklad „+ Pridať zákazníka / stavbu“ s časom na zákazníka. V profile môžeš nastaviť, aby sa stav tachometra z minula zapísal automaticky.", "zakaznik zakaznici stavba cinnost vozidlo kilometre tachometer ecv zakazka"], ["Prevádzka zatvorená a pevné voľné dni", "Keď je prevádzka zatvorená, zvoľ pri „Druh dňa“ „Prevádzka zatvorená / hromadná dovolenka“. Ako to firma platí, ako dovolenku alebo z tvojich nadčasov, nastavíš v Nastaveniach, „Prevádzka zatvorená“. Ak máš voľno každý týždeň v ten istý deň alebo odbornú školu, nastav to raz v Nastaveniach, „Pevné voľné dni“. Potom tie dni zapíšem za teba.", "hromadna dovolenka prevadzka zatvorena firma zatvorena pevne volne dni kazdy tyzden skola"], ["Účet a viac zariadení", "S účtom (e-mail a heslo) sú tvoje údaje navyše zálohované na serveri. Keď sa prihlásiš na inom telefóne alebo počítači, sú tam všetky záznamy. Bez internetu aplikácia ukladá do zariadenia a neskôr synchronizuje. V Nastaveniach, „Účet“, vidíš, či je všetko uložené, a môžeš sa odhlásiť.", "ucet prihlasit odhlasit heslo novy telefon pocitac druhe zariadenie synchronizacia"], ["Záchranná služba a prevoz pacientov", "V Červenom kríži platí kolektívna zmluva Červeného kríža, v Samariterbunde zmluva Samariterbundu (BARS), obe podľa spolkovej krajiny. Pre súkromné firmy záchrannej a dopravnej zdravotnej služby bez vlastnej zmluvy, napríklad Grünes Kreuz, platí zmluva Červeného kríža. Podľa Najvyššieho súdu sa prevoz pacientov nesmie platiť podľa zmluvy pre taxi. V Nastaveniach zvoľ povolanie „Záchranná služba“ a svoju zmluvu.", "zachranna sluzba cerveny kriz samariter prevoz pacientov zachranar sanitka johanniter malteser"], ["Poznámka k dňu: kto chcel voľno?", "V Zápise napíšeš do „Poznámka k dňu“ všetko dôležité. Pri voľných dňoch tam tiež zaznamenáš, kto ho chcel: ty sám, dohodnuté s firmou alebo nariadené firmou. To sa počíta neskôr pri náhradnom voľne, dovolenke alebo mzde a poznámky sú vidieť pri odchýlkach.", "poznamka nariadene kto chcel dohodnute sef prianie"], ["Pomoc a otázky pre vývojára", "V Nastaveniach, „Pomôcť (voliteľné)“, môžeš povoliť, aby som anonymne hlásila, v akom si povolaní a ako veľmi sa páska líši od záznamov, bez mena, e-mailu a presných súm. Môžeš tiež povoliť, aby som vývojárovi posielala otázky, na ktoré neviem odpovedať, aby som sa učila. Oboje je voliteľné a kedykoľvek vypnuteľné.", "pomoct anonymne statistika podpora ucit vyvojar"]],
    hr: [["Što aplikacija može", "Stunden-Checker ti pokazuje je li tvoja plaća točna. Ti upisuješ radno vrijeme, a ja računam prekovremene sate, dodatke, dnevnice i premije prema tvom kolektivnom ugovoru i zakonu te sve uspoređujem s platnom listom. Razlike ostaju zabilježene, čak i ako tvrtka radi drugačije. Uz to: brzi unos tekstom, glasom ili fotografijom dnevnog izvještaja, čitanje platne liste s fotografije ili PDF-a, račun godišnjeg odmora i slobodnog vremena, rokovi za iskaznice, planiranje produženih vikenda i izvještaji za tvrtku u PDF-u. Postoji više od 30 područja rada s više od 150 kolektivnih ugovora za sve savezne zemlje, a aplikacija govori 13 jezika. Pitaj me ili dodirni temu ispod.", "sto moze aplikacija sve funkcije pregled pomoc cemu sluzi"], ["Upis sati", "Otvori Unos. Kod početka i kraja upiši vrijeme, upiši stanke i dodirni Spremi. Tipkom „Sada“ aplikacija uzima trenutno vrijeme.", "sati upis pocetak kraj radno vrijeme spremi vrijeme dan"], ["Dodavanje premije", "Idi u Postavke, „Moje premije“, i dodaj svoju premiju (na primjer po satu, po danu ili po komadu). Zatim je upisuješ kod dana. Aplikacija je izračuna i usporedi s platnom listom.", "premija dodatak bonus dizalica dodati"], ["Provjera platne liste", "Otvori karticu Platna lista i pomakni se do „Je li moja platna lista točna?“. Prepiši sate i iznose ili me pusti da pročitam platnu listu s fotografije ili PDF-a (gore kod „Automatsko čitanje platne liste“). Aplikacija pokazuje što se slaže i gdje ostaje razlika u satima ili eurima. Ne moraš ispuniti sve retke.", "platna lista provjera tocna usporedi obracun placa"], ["Prekovremeni sati i dodaci", "U Postavkama su tjedni sati, model prekovremenih i dodaci. Dolaze iz tvog kolektivnog ugovora. Jesu li točni, vidiš na platnoj listi. Možeš ih promijeniti bilo kada, i od određenog datuma.", "prekovremeni dodatak nedjelja subota blagdan noc dodatni rad"], ["Dnevnice", "Dnevnice (Diäten) su dnevni dodatak koji dobivaš uz plaću. U Postavkama, Dnevnice, namjestiš plaća li se po satu ili po danu prema stupnjevima. Iznos nalaziš na platnoj listi.", "dnevnice dnevnica putni troskovi"], ["Promjena plaće ili zanimanja", "U Postavkama možeš promijeniti plaću ili zanimanje od određenog datuma. Stari dani i dalje se računaju sa starim vrijednostima. Tako je točno i nakon povišice ili promjene posla.", "promjena place zanimanja nova placa povisica od datuma satnica"], ["Godišnji odmor ili bolovanje", "U Unosu kod „Vrsta dana“ odaberi na primjer Godišnji odmor, Bolovanje ili Slobodno vrijeme. Tada ne moraš upisivati vremena.", "godisnji odmor bolovanje slobodno vrijeme slobodan vrsta dana"], ["Moji podaci i zaštita podataka", "Tvoji unosi su na tvom mobitelu. S računom se dodatno spremaju na zaštićeni poslužitelj u Frankfurtu, da se ništa ne izgubi. Tehnički bi ih operater aplikacije mogao vidjeti. Šifriranje koje to isključuje je u pripremi. Fotografije i PDF-ove platnih lista i dnevnih izvještaja čitam samo na tvom mobitelu, ne učitavaju se. Spremaju se samo brojevi koje potvrdiš. Tvoja tvrtka ništa od toga ne vidi.", "podaci zastita sigurno racun spremljeno privatno proslijedeno"], ["Sigurnosna kopija", "U Postavkama sasvim dolje je „Spremi ili podijeli sigurnosnu kopiju“. Tako se sprema datoteka sa svim tvojim podacima. S njom možeš sve vratiti na novom mobitelu.", "sigurnosna kopija backup izgubljeno vratiti novi mobitel"], ["Instalacija aplikacije", "Otvori stranicu u pregledniku i dodirni „Instaliraj aplikaciju“ (izbornik gore desno). Ako Android upozori, dodirni „Svejedno instaliraj“. Aplikacija je bezopasna, to je samo ova web stranica.", "instalirati pocetni zaslon ikona simbol poveznica"], ["Jezik i čitanje naglas", "Jezik aplikacije biraš sasvim gore na stranici. Kad me nešto pitaš, dodirni mikrofon i govori. S „Pročitaj naglas“ čitam ti odgovor. Mikrofon treba internet i tvoje dopuštenje u pregledniku.", "jezik govoriti mikrofon diktirati procitaj naglas hrvatski prijevod"], ["Utišavanje Mie", "Dodirni „Utišaj Miu“ i više se neću javljati sama, samo kad me dodirneš. Isti gumb me opet uključuje. Lik, ime i izgled mijenjaš u Profilu, „Moj pratitelj“.", "mia milo utisaj tiho smeta iskljuci"], ["Rokovi i iskaznice", "Otvori Profil i pomakni se do „Obrazovanje, iskaznice i rokovi“. Dodaj Code 95, vozačku karticu, dozvolu za viličar ili vlastite rokove s datumom isteka. Podsjetit ću te na vrijeme, a termin po želji ide u kalendar na mobitelu.", "rok code 95 vozacka kartica vilicar dizalica istek iskaznica podsjetnik tecaj"], ["Doplata, obračun unatrag, posebna primanja", "Ako je tvrtka kasnije nešto doplatila ili obračunala unatrag, upisuješ to u mjesečnoj usporedbi kod „Doplate i ispravci“: za koji mjesec, koji redak i koliko. Aplikacija to pribraja ranijem mjesecu. Kod „Satnica obračunata unatrag“ pokazuje ti izračun i odgovara li iznos. Regres, božićnicu, 13. i 14. plaću upisuješ na kartici Platna lista kod „Posebna primanja“.", "doplata obracun unatrag ispravak bozicnica regres 13 14 placa posebna primanja"], ["Novosti", "U Profilu je kartica „Novosti“. Tamo uključiš da ti Mia govori novosti i namjestiš koliko često: odmah, tjedno ili mjesečno. Dobivaš samo ono što odgovara tvom zanimanju. Ako želiš vidjeti i ostalo, uključi „Novosti i za druga zanimanja“.", "novosti vijesti nova funkcija obavijest"], ["Skraćeno radno vrijeme, dodatni rad i slobodno vrijeme", "Ako radiš skraćeno i više nego što je dogovoreno, to je do granice punog radnog vremena iz kolektivnog ugovora dodatni rad (Mehrarbeit), a ne prekovremeni. Za njega ide dodatak od 25 %, osim ako sate u istom tromjesečju uzmeš 1:1 kao slobodno vrijeme. Aplikacija to računa automatski. Tvoj kolektivni ugovor može to urediti drugačije.", "skraceno radno vrijeme dodatni rad slobodno vrijeme tromjesecje puno radno 25"], ["Roditeljski dopust, rodiljni dopust, očinski mjesec", "U Unosu kod „Vrsta dana“ odaberi roditeljski dopust (Karenz), zaštitu majčinstva ili očinski mjesec. Ti dani su neplaćeni i nemaju obvezne sate. Roditeljski dopust razmjerno smanjuje pravo na godišnji odmor, zaštita majčinstva ne.", "roditeljski rodiljni ocinski beba"], ["Klizno radno vrijeme", "Kod kliznog radnog vremena (Gleitzeit) aplikacija broji plus i minus sate na računu. Pri postavljanju odaberi „Ured s kliznim radnim vremenom“ ili u Postavkama model prekovremenih „Gleitzeit“. Tamo upisuješ obvezno vrijeme za svaki dan u tjednu, po želji početni saldo i granicu prijenosa. Slobodan dan iz kliznog vremena oduzima obvezno vrijeme s računa, godišnji i bolovanje ne.", "klizno radno vrijeme gleitzeit racun saldo plus minus sati"], ["Nema posla / oslobođenje od rada", "U Unosu kod „Vrsta dana“ odaberi „Nema posla (tvrtka me oslobodila)“ kad te tvrtka pošalje kući zbog nedostatka posla. Bilješka uz dan postavlja se sama. Kako tvrtka obračunava dan, namjestiš u Postavkama kod „Oslobođenje od rada (nema posla)“: tvrtka plaća dalje, odbitak od slobodnog vremena ili neplaćeno. Ako ne znaš, aplikacija ništa ne oduzima. Tako to i Arbeiterkammer vidi kao osnovno pravilo: tko je spreman raditi i pošalju ga kući, zadržava plaću. Na platnoj listi vidiš je li točno.", "oslobodenje nema posla poslan kuci nedostatak posla"], ["Slobodno vrijeme: 1:1,5 ili 1:1?", "Zakon o radnom vremenu (§ 10) kaže: dodatak za prekovremeni rad mora se uzeti u obzir kod slobodnog vremena ili isplatiti posebno. Kod dodatka od 50 % dakle ili 1 prekovremeni sat = 1,5 sati slobodno, ili 1:1 i dodatak ide na platnu listu. Tvoj kolektivni ugovor može to urediti drugačije. Namjesti to u Postavkama kod „Kako tvoja tvrtka pripisuje prekovremene kao slobodno vrijeme?“. Kad uzimaš slobodno, oduzima se sat za sat. U Njemačkoj nema zakonskog omjera, vrijedi tvoj ugovor.", "slobodno vrijeme 1:1 dodatak prekovremeni omjer koristenje"], ["Gdje to nalazim na platnoj listi?", "Gore na platnoj listi uglavnom su tvoje ime, tvrtka, mjesec i često razvrstavanje, platni razred i kolektivni ugovor (ponekad kratica „KV“). Satnicu nalaziš u retku „Lohn“ ili „Stundenlohn“, sate pored u stupcu „Menge“. Prekovremeni su često u vlastitim recima s 50 % ili 100 %, slobodno vrijeme u retku „Zeitausgleich“ ili „Zeitkonto“, godišnji kao „Resturlaub“. Tjedni sati su u ugovoru o radu. Ako nešto nedostaje, pitaj u uredu ili u obračunu plaća. Što ne znaš, ostavi prazno u aplikaciji. Do tada aplikacija računa s vrijednostima tvog kolektivnog ugovora.", "gdje nalazim platna lista kolektivni ugovor obracun"], ["Ja sam naučnik", "Kao naučnik dobivaš naknadu za naukovanje, uglavnom fiksni mjesečni iznos po godini naukovanja. U Postavkama kod „Moje zanimanje“ odaberi vrstu „Naučnik“. Aplikacija tada kod platnog razreda pokazuje samo godine naukovanja tvog kolektivnog ugovora i s „Koristi minimalnu plaću iz kolektivnog ugovora“ upisuje iznos. Ako je u ugovoru drugi iznos, upiši ga kod „Fiksna mjesečna plaća“. Strukovna škola računa se kao radno vrijeme: upiši dan kao „Obuka / strukovna škola“, stalni školski dan svaki tjedan kod „Stalni slobodni dani“. Do 18 godina vrijedi zakon o zaštiti mladih, obično najviše 8 sati dnevno i 40 tjedno. S pitanjima ti pomaže Arbeiterkammer.", "naucnik godina naukovanja strukovna skola naknada naukovanje ugovor"], ["Dodaci u građevini i obrtu", "U građevini i obrtu na platnoj listi često su dodaci: za prljavštinu, otežane uvjete i opasnost, dnevnica ili dodatak za udaljenost pri radu izvan kuće, naknada za noćenje i montažni dodatak. Dodaj ih u Postavkama, „Moje premije“, Mia ti predlaže odgovarajuće. Kod lošeg vremena u građevini i drvogradnji dio plaće plaća BUAK, aplikacija vodi sate lošeg vremena posebno. Kod soboslikara je kod prekida zbog vremena 60 % plaće. Iznosi se razlikuju po kolektivnom ugovoru, usporedi ih s platnom listom.", "gradevina obrt dodatak lose vrijeme montaza otezani uvjeti prljavstina"], ["Čišćenje, zaštitarstvo i njega", "U tim zanimanjima mnogo je noćnih, nedjeljnih i blagdanskih smjena. Upiši vremena kako si radio, i preko ponoći: sati se računaju danu kad je smjena počela. Dodaci (na primjer noćni, za prehranu, pripravnost) su na platnoj listi: dodaj ih u Postavkama, „Moje premije“, Mia ti predlaže odgovarajuće. Ako kod tebe vrijedi drugi kolektivni ugovor (na primjer zemaljska bolnica), odaberi „Vlastite vrijednosti“.", "ciscenje zastitar sigurnost njega nocna smjena pripravnost"], ["Pomicanje sata (ljetno, zimsko)", "Aplikacija pomicanje sata računa automatski. U listopadu se sat u 3 vraća na 2: tko te noći radi, radio je sat duže. Noćna smjena od 22 do 6 tada ima 9 umjesto 8 sati. U ožujku se sat u 2 pomiče na 3: sat nedostaje, smjena ima 7 umjesto 8 sati. Upiši početak i kraj onako kako je pokazivao sat. Plaća li tvrtka dodatni sat, piše u kolektivnom ugovoru ili sporazumu: pogledaj platnu listu. Kod razlike možeš sate kod dana prilagoditi.", "pomicanje sata ljetno zimsko vrijeme dodatni sat"], ["Što je platni razred i trebam li ga?", "Platni razred (razvrstavanje) određuje koju ti minimalnu plaću daje kolektivni ugovor. Ne moraš ga znati: samo upiši satnicu s platne liste. Ako ga znaš, aplikacija može provjeriti odgovara li tvoja plaća kolektivnom ugovoru. Nalaziš ga gore na platnoj listi (kod „Einstufung“, „Lohngruppe“ ili „Verwendungsgruppe“) ili u ugovoru o radu. Ako ga nigdje nema, pitaj u tvrtki.", "platni razred razvrstavanje trebam tarifa"], ["Nedostaju mi još podaci, mogu li početi?", "Da, možeš odmah početi, čak i ako plaća, razvrstavanje ili nešto drugo nedostaje. Upiši što već imaš, na primjer radno vrijeme. Vrijednosti koje nedostaju možeš bilo kada dopuniti u Postavkama. Aplikacija tada sve već upisane dane automatski ponovno izračuna. Samo usporedba s platnom listom u eurima ide tek kad je upisana satnica.", "nedostaju podaci nepotpuno poceti dopuniti"], ["Gdje je povratna informacija za programera?", "Dolje lijevo u aplikaciji je gumb „Prijavi problem“. Dodirni ga, kod „O čemu se radi?“ odaberi na primjer „Nešto nije u redu“ ili „Prijedlog“, napiši poruku i dodirni Pošalji. Aplikacija šalje i sliku trenutne stranice, možeš to isključiti. Zatim vidiš potvrdu. Povratnu informaciju nalaziš i u Profilu.", "povratna informacija prijavi problem greska prijedlog programer"], ["Posebni dopust i rad istog dana", "U Unosu kod „Vrsta dana“ odaberi posebni dopust (ili Godišnji odmor). Dan se pripisuje s obveznim satima. Ako si taj dan ipak radio, upiši početak i kraj: kod dana tada piše „plus rad“, a tvoje radno vrijeme dodaje se plaćenim satima. Na platnoj listi za posebni dopust obično postoji vlastiti redak, koji aplikacija uspoređuje posebno.", "posebni dopust vjencanje smrt selidba rad dodatno"], ["Očekivana bruto plaća i isplata", "U Pregledu ispod sati vidiš očekivanu bruto plaću izračunanu iz tvojih zapisa: plaća, prekovremeni, premije i dežurstva, dnevnice posebno. Neto aplikacija ne pokazuje jer ovisi o više stvari, na primjer o socijalnom osiguranju, porezu, obiteljskom bonusu i paušalu za putovanje. Ako u Postavkama upišeš dan isplate, u Pregledu stoji i datum. Bruto se pojavljuje tek kad mjesec završi, jer prije mogu nedostajati unosi.", "bruto neto isplata dan isplate placa zarada koliko novac"], ["Kamion u Njemačkoj: tarifa, dnevnice i noć", "U Njemačkoj nema jedinstvene tarife: vrijedi po saveznoj zemlji i samo ako je tvrtka tarifno vezana. Spremljeni su Spedition und Logistik za Sjevernu Rajnu-Vestfaliju, Bavarsku, Sasku i Berlin. Kad pri postavljanju odabereš Njemačku, upisuješ saveznu zemlju zbog blagdana. Ako tvrtka nije tarifno vezana, uzmi plaću i dodatke iz ugovora o radu i odaberi „Vlastite vrijednosti“. Vozači u daljinskom prijevozu često imaju vlastite ugovore. Prehrana je oslobođena poreza do 14 € (više od 8 sati) i 28 € (24 sata), plus 9 € po noći u kamionu: noćenje dodaješ kao premiju. Noćne dodatke također. Sve usporedi s obračunom.", "njemacka spedicija daljinski prijevoz dnevnice tarifa noc nocenje"], ["Riječi na platnoj listi", "Entgeltfortzahlung: tvrtka ti i dalje plaća plaću, uglavnom na bolovanju. Aufrollung: obračunski referent ponovno obračunava ranije mjesece, na primjer nakon povišice, i razliku doplaćuje ili odbija. Rückverrechnung: nešto već obračunano ponovno se oduzima. Vorschuss: predujam koji se pri obračunu odbija. Pfändung: po nalogu suda tvrtka zadržava iznos i prosljeđuje ga dalje. Sachbezug: pogodnost od tvrtke, na primjer službeni auto i za privatne vožnje; dodaje se plaći kao vrijednost, ali se ne isplaćuje. MA-Vorsorgekasse: tvrtka uplaćuje za tvoju otpremninu, samo pazi da redak postoji. Kolektivni ugovor platna lista često uopće ne navodi. Pogledaj „Tarifgruppe“ i „Beschäftigt als“, to je tvoje razvrstavanje.", "rijeci platna lista entgeltfortzahlung aufrollung vorschuss pfandung sachbezug vorsorgekasse otpremnina"], ["Provjera neto plaće kalkulatorom BMF", "Neto aplikacija sama ne računa. Gumb otvara kalkulator bruto-neto austrijskog ministarstva financija (BMF) u novom prozoru. To je neobvezujući modelni izračun. Upiši tamo bruto odozgo i namjesti: razdoblje mjesečno, skupinu doprinosa kao na platnoj listi (radnik ili namještenik), godinu, saveznu zemlju radnog mjesta, paušal za putovanje i djecu kao kod tebe. Neto usporedi s retkom isplate na platnoj listi. Male razlike su normalne, na primjer zbog dnevnica, sindikalne članarine ili predujmova.", "neto bmf kalkulator ministarstvo financija isplata provjeriti"], ["Brzi unos (tekst, glas, fotografija)", "U „Brzom unosu“ samo napišeš ili kažeš što si radio, na primjer „jučer od 6 do 15, 30 minuta stanke, kupac Müller iskop“. Od toga radim unose, ti ih provjeriš i spremiš. Možeš i fotografirati dnevni izvještaj, a ja iz njega preuzimam vremena. Funkcija je na početku isključena: uključi je u Postavkama, „Pomoć pri unosu“. Zatim je kartica sasvim gore u Unosu. Mikrofon treba internet i tvoje dopuštenje.", "brzi unos glasovna poruka diktirati govoriti dnevni izvjestaj fotografija tekst"], ["Platna lista s fotografije ili PDF-a", "Na kartici Platna lista jednom dopusti kod „Automatsko čitanje platne liste“ da aplikacija čita tvoju platnu listu. Zatim dodirni „Čitaj platnu listu“ i odaberi fotografiju ili PDF. Čitam je samo ovdje na mobitelu, ništa se ne učitava. Potvrđuješ svaki redak, zatim je sve u usporedbi „Je li moja platna lista točna?“. Ako ne poznajem redak, jednom ga dodijeliš i zapamtit ću ga za sljedeće mjesece. U Postavkama, „Postavke s platnom listom“, s njom provjeravam i tvoje postavke.", "fotografija slika pdf skeniraj citati platna lista kamera automatski"], ["Dva izračuna: kolektivni ugovor i tvrtka", "Uvijek računam dvaput: jednom kako bi trebalo biti po kolektivnom ugovoru i zakonu, i jednom kako to radi tvoja tvrtka, dakle prema tvojim postavkama. Zakon i kolektivni ugovor imaju prednost. Razliku vidiš u pregledu i u usporedbi s platnom listom. U Pregledu, „Godina i računi“, svako odstupanje ostaje u „Zabilježena odstupanja“, čak i ako tvrtka uvijek tako radi. Popis možeš kopirati i pokazati na primjer Arbeiterkammer. Sve uz ogradu: razlika može nastati i zbog pogreške pri unosu.", "odstupanje razlika tvrtka zakon dva izracuna zabiljezeno arbeiterkammer pravo premalo"], ["Kolektivni ugovor i savezna zemlja", "U Postavkama, „Moje zanimanje“, biraš zanimanje, a kod „Moj kolektivni ugovor“ odgovarajući ugovor. Mnogi kolektivni ugovori razlikuju se po saveznoj zemlji. Upiši svoju saveznu zemlju u Postavkama, „Moji podaci“, pa ću ti predložiti pravi ugovor i dodatke tvoje zemlje i reći kad nešto ne odgovara. Ako ne nađeš svoj ugovor, odaberi „Vlastite vrijednosti“ i upiši plaću i dodatke iz ugovora o radu.", "savezna zemlja kolektivni ugovor koji ugovor bec tirol stajerska koruska salzburg"], ["Koja zanimanja postoje?", "Među ostalima: kamion, bager, mali prijevoz, autobus i taksi, građevina i obrt, skladište, radionica, industrija, prehrambena industrija, trgovina, ured, terenska prodaja, ugostiteljstvo i hotel, pekarnica, slastičarnica, mesnica, čišćenje, zaštitarstvo, njega i socijalna skrb, hitna služba, ordinacija, zubna tehnika, optika, frizer, kozmetika, pošta, željeznica, savezna služba, vrtlarstvo i šumarstvo, žičare, kino, dimnjačar, garaža i benzinska postaja, praonica, plastika i suzbijanje štetočina, svugdje s naučnicima gdje ih ima. Ako tvoga nema, odaberi „Nešto drugo“ i upiši vlastite vrijednosti. Javi mi preko „Prijavi problem“ koje zanimanje nedostaje.", "zanimanja koje zanimanje nedostaje struka posao radim kao koja postoje postoji"], ["Izvještaj za tvrtku (PDF)", "Sasvim dolje u Unosu je „Izvještaj za tvrtku“: odaberi dan, tjedan, pola mjeseca ili mjesec i „Izradi PDF i pošalji“ ili spremi. U Postavkama, „Izvješća za tvrtku“, namjestiš ime na izvještaju, kada ga tvrtka želi, e-mail tvrtke i ispisuje li se tvoj potpis. Tada te podsjetim na vrijeme.", "izvjestaj pdf evidencija rada poslati tvrtka potpis ispis mjesecni tjedni"], ["Godišnji, slobodno vrijeme i prekovremeni ukratko", "U Pregledu, „Godina i računi“, nalaziš evidenciju sati, karton godišnjeg odmora s pravom, iskorištenim danima i ostatkom godišnjeg, račun slobodnog vremena i „Prekovremeni sati ukratko“: što si zapisao, što je isplaćeno i što je otišlo na račun. Upiši stanje s platne liste i odmah vidiš je li točno. Pravo na godišnji računam iz datuma zaposlenja u profilu.", "ostatak godisnjeg pravo karton racun slobodnog vremena stanje prekovremeni ukratko evidencija sati"], ["Planiranje slobodnih dana (produženi vikendi)", "U Pregledu, „Godina i računi“, „Planiranje slobodnih dana“ pokazuje najbolje dane za produžene vikende: s malo dana godišnjeg ili slobodnog vremena što više slobodnih dana zaredom. Subota i nedjelja računaju se kao slobodne. Prije pitaj na poslu radi li se tih dana.", "produzeni vikend planirati slobodni dani godisnji planiranje"], ["Izgled Mie: lik, odjeća, boje, glas", "U Profilu, „Moj pratitelj“, biraš moj lik i ime. S „Sam/a oblikuj Miu“ biraš odjeću, dodatke i boje, na primjer žuti ili narančasti reflektirajući prsluk. Kad je isključeno, oblačim se prema tvom zanimanju. Tamo namjestiš i govorim li glasom, a ispod biraš ikonu aplikacije.", "izgled lik odjeca boja prsluk glas oblikovati ime milo ikona slika"], ["Probni način", "U Postavkama je probni način. S njim isprobavaš druga zanimanja ili postavke bez mijenjanja stvarnih podataka. Gore se tada vidi crvena obavijest. S „Natrag na moje podatke“ se vraćaš, a sve isprobano se briše.", "probni nacin isprobati testirati drugo zanimanje"], ["Kupci, gradilišta, vozilo i kilometri", "U Postavkama, „Što bilježim“, uključuješ što još želiš zapisivati: vozilo i kilometre, kupce, gradilišta i aktivnosti ili premije. Tada se u Unosu pojavljuju odgovarajuća polja, na primjer „+ Dodaj kupca / gradilište“ s vremenom po kupcu. U profilu možeš namjestiti da se stanje kilometara od zadnjeg puta upisuje automatski.", "kupac kupci gradiliste aktivnost vozilo kilometri registracija nalog"], ["Tvrtka zatvorena i stalni slobodni dani", "Kad je tvrtka zatvorena, kod „Vrsta dana“ odaberi „Tvrtka zatvorena / kolektivni godišnji odmor“. Kako tvrtka to plaća, kao godišnji ili iz tvojih prekovremenih, namjestiš u Postavkama, „Tvrtka zatvorena“. Ako svaki tjedan istog dana imaš slobodno ili strukovnu školu, postavi to jednom u Postavkama, „Stalni slobodni dani“. Tada te dane upisujem umjesto tebe.", "kolektivni godisnji tvrtka zatvorena stalni slobodni dani svaki tjedan skola"], ["Račun i više uređaja", "S računom (e-mail i lozinka) tvoji podaci su dodatno spremljeni na poslužitelju. Ako se prijaviš na drugom mobitelu ili računalu, svi unosi su i tamo. Bez interneta aplikacija sprema na uređaj i kasnije usklađuje. U Postavkama, „Račun“, vidiš je li sve spremljeno i možeš se odjaviti.", "racun prijava odjava lozinka novi mobitel racunalo drugi uredaj sinkronizacija"], ["Hitna služba i sanitetski prijevoz", "U Crvenom križu vrijedi kolektivni ugovor Crvenog križa, u Samariterbundu ugovor Samariterbunda (BARS), oba po saveznoj zemlji. Za privatne tvrtke hitne službe i sanitetskog prijevoza bez vlastitog ugovora, na primjer Grünes Kreuz, vrijedi ugovor Crvenog križa. Prema Vrhovnom sudu sanitetski prijevoz ne smije se plaćati po ugovoru za taksi. U Postavkama odaberi zanimanje „Hitna služba“ i svoj ugovor.", "hitna sluzba crveni kriz samariter sanitetski prijevoz spasilac vozilo hitne johanniter malteser"], ["Bilješka uz dan: tko je htio slobodan dan?", "U Unosu kod „Bilješka uz dan“ zapisuješ sve važno. Kod slobodnih dana tamo bilježiš i tko ga je htio: ti sam, dogovoreno s tvrtkom ili naređeno od tvrtke. To je važno kasnije kod slobodnog vremena, godišnjeg ili plaće, a bilješke se vide kod odstupanja.", "biljeska napomena naredeno tko je htio dogovoreno sef zelja"], ["Pomoć i pitanja za programera", "U Postavkama, „Pomozi (neobavezno)“, možeš dopustiti da anonimno javljam u kojem si zanimanju i koliko se platna lista razlikuje od zapisa, bez imena, e-maila i točnih iznosa. Možeš i dopustiti da programeru šaljem pitanja na koja ne znam odgovoriti, da učim. Oboje je neobavezno i može se isključiti bilo kada.", "pomoc anonimno statistika podrska uciti programer"]],
    sr: [["Šta aplikacija može", "Stunden-Checker ti pokazuje da li je tvoja plata tačna. Ti upisuješ radno vreme, a ja računam prekovremene sate, dodatke, dnevnice i premije prema tvom kolektivnom ugovoru i zakonu i sve upoređujem sa platnom listom. Razlike ostaju zabeležene, čak i ako firma radi drugačije. Pored toga: brzi unos tekstom, glasom ili fotografijom dnevnog izveštaja, čitanje platne liste sa fotografije ili PDF-a, račun godišnjeg odmora i slobodnog vremena, rokovi za isprave, planiranje produženih vikenda i izveštaji za firmu u PDF-u. Postoji više od 30 oblasti rada sa više od 150 kolektivnih ugovora za sve savezne države, a aplikacija govori 13 jezika. Pitaj me ili dodirni temu ispod.", "sta moze aplikacija sve funkcije pregled pomoc cemu sluzi"], ["Upis sati", "Otvori Unos. Kod početka i kraja upiši vreme, upiši pauze i dodirni Sačuvaj. Dugmetom „Sada“ aplikacija uzima trenutno vreme.", "sati upis pocetak kraj radno vreme sacuvaj vreme dan"], ["Dodavanje premije", "Idi u Podešavanja, „Moje premije“, i dodaj svoju premiju (na primer po satu, po danu ili po komadu). Zatim je upisuješ kod dana. Aplikacija je izračuna i uporedi sa platnom listom.", "premija dodatak bonus dizalica dodati"], ["Provera platne liste", "Otvori karticu Platna lista i pomeri se do „Da li je moja platna lista tačna?“. Prepiši sate i iznose ili me pusti da pročitam platnu listu sa fotografije ili PDF-a (gore kod „Automatsko čitanje platne liste“). Aplikacija pokazuje šta se slaže i gde ostaje razlika u satima ili evrima. Ne moraš da popuniš sve redove.", "platna lista provera tacna uporedi obracun plata"], ["Prekovremeni sati i dodaci", "U Podešavanjima su nedeljni sati, model prekovremenih i dodaci. Dolaze iz tvog kolektivnog ugovora. Da li su tačni, vidiš na platnoj listi. Možeš da ih promeniš bilo kada, i od određenog datuma.", "prekovremeni dodatak nedelja subota praznik noc dodatni rad"], ["Dnevnice", "Dnevnice (Diäten) su dnevni dodatak koji dobijaš uz platu. U Podešavanjima, Dnevnice, podesiš da li se plaća po satu ili po danu prema stepenima. Iznos nalaziš na platnoj listi.", "dnevnice dnevnica putni troskovi"], ["Promena plate ili zanimanja", "U Podešavanjima možeš da promeniš platu ili zanimanje od određenog datuma. Stari dani se i dalje računaju sa starim vrednostima. Tako je tačno i posle povišice ili promene posla.", "promena plate zanimanja nova plata povisica od datuma satnica"], ["Godišnji odmor ili bolovanje", "U Unosu kod „Vrsta dana“ izaberi na primer Godišnji odmor, Bolovanje ili Slobodno vreme. Tada ne moraš da upisuješ vremena.", "godisnji odmor bolovanje slobodno vreme slobodan vrsta dana"], ["Moji podaci i zaštita podataka", "Tvoji unosi su na tvom telefonu. Sa nalogom se dodatno čuvaju na zaštićenom serveru u Frankfurtu, da se ništa ne izgubi. Tehnički bi operater aplikacije mogao da ih vidi. Šifrovanje koje to isključuje je u pripremi. Fotografije i PDF-ove platnih lista i dnevnih izveštaja čitam samo na tvom telefonu, ne otpremaju se. Čuvaju se samo brojevi koje potvrdiš. Tvoja firma ništa od toga ne vidi.", "podaci zastita bezbedno nalog sacuvano privatno prosledeno"], ["Rezervna kopija", "U Podešavanjima sasvim dole je „Sačuvaj ili podeli rezervnu kopiju“. Tako se čuva datoteka sa svim tvojim podacima. Sa njom možeš sve da vratiš na novom telefonu.", "rezervna kopija backup izgubljeno vratiti novi telefon"], ["Instalacija aplikacije", "Otvori stranicu u pregledaču i dodirni „Instaliraj aplikaciju“ (meni gore desno). Ako Android upozori, dodirni „Ipak instaliraj“. Aplikacija je bezopasna, to je samo ova veb stranica.", "instalirati pocetni ekran ikona simbol link"], ["Jezik i čitanje naglas", "Jezik aplikacije biraš sasvim gore na stranici. Kad me nešto pitaš, dodirni mikrofon i govori. Sa „Pročitaj naglas“ čitam ti odgovor. Mikrofon traži internet i tvoju dozvolu u pregledaču.", "jezik govoriti mikrofon diktirati procitaj naglas srpski prevod"], ["Utišavanje Mije", "Dodirni „Utišaj Miju“ i više se neću javljati sama, samo kad me dodirneš. Isto dugme me ponovo uključuje. Lik, ime i izgled menjaš u Profilu, „Moj pratilac“.", "mia milo utisaj tiho smeta iskljuci"], ["Rokovi i isprave", "Otvori Profil i pomeri se do „Obrazovanje, iskaznice i rokovi“. Dodaj Code 95, vozačku karticu, dozvolu za viljuškar ili sopstvene rokove sa datumom isteka. Podsetiću te na vreme, a termin po želji ide u kalendar na telefonu.", "rok code 95 vozacka kartica viljuskar dizalica istek isprava podsetnik kurs"], ["Doplata, obračun unazad, posebna primanja", "Ako je firma kasnije nešto doplatila ili obračunala unazad, upisuješ to u mesečnom poređenju kod „Doplate i ispravke“: za koji mesec, koji red i koliko. Aplikacija to pripisuje ranijem mesecu. Kod „Satnica obračunata unazad“ pokazuje ti računicu i da li iznos odgovara. Regres, božićnicu, 13. i 14. platu upisuješ na kartici Platna lista kod „Posebna primanja“.", "doplata obracun unazad ispravka bozicnica regres 13 14 plata posebna primanja"], ["Novosti", "U Profilu je kartica „Novosti“. Tamo uključiš da ti Mia govori novosti i podesiš koliko često: odmah, nedeljno ili mesečno. Dobijaš samo ono što odgovara tvom zanimanju. Ako želiš da vidiš i ostalo, uključi „Novosti i za druga zanimanja“.", "novosti vesti nova funkcija obavestenje"], ["Nepuno radno vreme, dodatni rad i slobodno vreme", "Ako radiš nepuno radno vreme i više nego što je dogovoreno, to je do granice punog radnog vremena iz kolektivnog ugovora dodatni rad (Mehrarbeit), a ne prekovremeni. Za njega ide dodatak od 25 %, osim ako sate u istom tromesečju uzmeš 1:1 kao slobodno vreme. Aplikacija to računa automatski. Tvoj kolektivni ugovor može to da uredi drugačije.", "nepuno radno vreme dodatni rad slobodno vreme tromesecje puno radno 25"], ["Roditeljsko odsustvo, porodiljsko, očinski mesec", "U Unosu kod „Vrsta dana“ izaberi roditeljsko odsustvo (Karenz), zaštitu materinstva ili očinski mesec. Ti dani su neplaćeni i nemaju obavezne sate. Roditeljsko odsustvo srazmerno smanjuje pravo na godišnji odmor, zaštita materinstva ne.", "roditeljsko porodiljsko ocinski beba"], ["Klizno radno vreme", "Kod kliznog radnog vremena (Gleitzeit) aplikacija broji plus i minus sate na računu. Pri podešavanju izaberi „Kancelarija sa kliznim radnim vremenom“ ili u Podešavanjima model prekovremenih „Gleitzeit“. Tamo upisuješ obavezno vreme za svaki dan u nedelji, po želji početni saldo i granicu prenosa. Slobodan dan iz kliznog vremena oduzima obavezno vreme sa računa, godišnji i bolovanje ne.", "klizno radno vreme gleitzeit racun saldo plus minus sati"], ["Nema posla / oslobađanje od rada", "U Unosu kod „Vrsta dana“ izaberi „Nema posla (firma me oslobodila)“ kad te firma pošalje kući zbog nedostatka posla. Beleška uz dan se postavlja sama. Kako firma obračunava dan, podesiš u Podešavanjima kod „Oslobođenje od rada (nema posla)“: firma plaća dalje, odbitak od slobodnog vremena ili neplaćeno. Ako ne znaš, aplikacija ništa ne oduzima. Tako to i Arbeiterkammer vidi kao osnovno pravilo: ko je spreman da radi i pošalju ga kući, zadržava platu. Na platnoj listi vidiš da li je tačno.", "oslobadanje nema posla poslat kuci nedostatak posla"], ["Slobodno vreme: 1:1,5 ili 1:1?", "Zakon o radnom vremenu (§ 10) kaže: dodatak za prekovremeni rad mora da se uzme u obzir kod slobodnog vremena ili da se isplati posebno. Kod dodatka od 50 % dakle ili 1 prekovremeni sat = 1,5 sati slobodno, ili 1:1 i dodatak ide na platnu listu. Tvoj kolektivni ugovor može to da uredi drugačije. Podesi to u Podešavanjima kod „Kako tvoja firma upisuje prekovremene kao slobodno vreme?“. Kad uzimaš slobodno, oduzima se sat za sat. U Nemačkoj nema zakonskog odnosa, važi tvoj ugovor.", "slobodno vreme 1:1 dodatak prekovremeni odnos koriscenje"], ["Gde to nalazim na platnoj listi?", "Gore na platnoj listi uglavnom su tvoje ime, firma, mesec i često razvrstavanje, platna grupa i kolektivni ugovor (ponekad skraćenica „KV“). Satnicu nalaziš u redu „Lohn“ ili „Stundenlohn“, sate pored u koloni „Menge“. Prekovremeni su često u posebnim redovima sa 50 % ili 100 %, slobodno vreme u redu „Zeitausgleich“ ili „Zeitkonto“, godišnji kao „Resturlaub“. Nedeljni sati su u ugovoru o radu. Ako nešto nedostaje, pitaj u kancelariji ili u obračunu plata. Šta ne znaš, ostavi prazno u aplikaciji. Do tada aplikacija računa sa vrednostima tvog kolektivnog ugovora.", "gde nalazim lista kolektivni ugovor obracun"], ["Ja sam učenik na zanatu", "Kao učenik na zanatu dobijaš naknadu za učenje, uglavnom fiksni mesečni iznos po godini učenja. U Podešavanjima kod „Moje zanimanje“ izaberi vrstu „Učenik“. Aplikacija tada kod platne grupe pokazuje samo godine učenja tvog kolektivnog ugovora i sa „Koristi minimalnu platu iz kolektivnog ugovora“ upisuje iznos. Ako je u ugovoru drugi iznos, upiši ga kod „Fiksna mesečna plata“. Stručna škola se računa kao radno vreme: upiši dan kao „Obuka / stručna škola“, stalni školski dan svake nedelje kod „Stalni slobodni dani“. Do 18 godina važi zakon o zaštiti mladih, obično najviše 8 sati dnevno i 40 nedeljno. Sa pitanjima ti pomaže Arbeiterkammer.", "ucenik zanat godina ucenja strucna skola naknada ugovor"], ["Dodaci u građevini i zanatstvu", "U građevini i zanatstvu na platnoj listi često su dodaci: za prljavštinu, otežane uslove i opasnost, dnevnica ili dodatak za udaljenost pri radu van kuće, naknada za noćenje i montažni dodatak. Dodaj ih u Podešavanjima, „Moje premije“, Mia ti predlaže odgovarajuće. Kod lošeg vremena u građevini i drvogradnji deo plate plaća BUAK, aplikacija vodi sate lošeg vremena posebno. Kod molera je kod prekida zbog vremena 60 % plate. Iznosi se razlikuju po kolektivnom ugovoru, uporedi ih sa platnom listom.", "gradevina zanat dodatak lose vreme montaza otezani uslovi prljavstina"], ["Čišćenje, obezbeđenje i nega", "U tim zanimanjima mnogo je noćnih, nedeljnih i prazničnih smena. Upiši vremena kako si radio, i preko ponoći: sati se računaju danu kad je smena počela. Dodaci (na primer noćni, za ishranu, pripravnost) su na platnoj listi: dodaj ih u Podešavanjima, „Moje premije“, Mia ti predlaže odgovarajuće. Ako kod tebe važi drugi kolektivni ugovor (na primer pokrajinska bolnica), izaberi „Sopstvene vrednosti“.", "ciscenje obezbedenje bezbednost nega nocna smena pripravnost"], ["Pomeranje sata (letnje, zimsko)", "Aplikacija pomeranje sata računa automatski. U oktobru se sat u 3 vraća na 2: ko te noći radi, radio je sat duže. Noćna smena od 22 do 6 tada ima 9 umesto 8 sati. U martu se sat u 2 pomera na 3: sat nedostaje, smena ima 7 umesto 8 sati. Upiši početak i kraj onako kako je pokazivao sat. Da li firma plaća dodatni sat, piše u kolektivnom ugovoru ili sporazumu: pogledaj platnu listu. Kod razlike možeš da prilagodiš sate kod dana.", "pomeranje sata letnje zimsko vreme dodatni sat"], ["Šta je platna grupa i da li mi treba?", "Platna grupa (razvrstavanje) određuje koju ti minimalnu platu daje kolektivni ugovor. Ne moraš da je znaš: samo upiši satnicu sa platne liste. Ako je znaš, aplikacija može da proveri da li tvoja plata odgovara kolektivnom ugovoru. Nalaziš je gore na platnoj listi (kod „Einstufung“, „Lohngruppe“ ili „Verwendungsgruppe“) ili u ugovoru o radu. Ako je nigde nema, pitaj u firmi.", "platna grupa razvrstavanje treba tarifa"], ["Nedostaju mi još podaci, mogu li da počnem?", "Da, možeš odmah da počneš, čak i ako plata, razvrstavanje ili nešto drugo nedostaje. Upiši šta već imaš, na primer radno vreme. Vrednosti koje nedostaju možeš bilo kada da dopuniš u Podešavanjima. Aplikacija tada sve već upisane dane automatski ponovo izračuna. Samo poređenje sa platnom listom u evrima ide tek kad je upisana satnica.", "nedostaju podaci nepotpuno poceti dopuniti"], ["Gde je povratna informacija za programera?", "Dole levo u aplikaciji je dugme „Prijavi problem“. Dodirni ga, kod „O čemu se radi?“ izaberi na primer „Nešto nije u redu“ ili „Predlog“, napiši poruku i dodirni Pošalji. Aplikacija šalje i sliku trenutne stranice, možeš to da isključiš. Zatim vidiš potvrdu. Povratnu informaciju nalaziš i u Profilu.", "povratna informacija prijavi problem greska predlog programer"], ["Posebno odsustvo i rad istog dana", "U Unosu kod „Vrsta dana“ izaberi posebno odsustvo (ili Godišnji odmor). Dan se upisuje sa obaveznim satima. Ako si taj dan ipak radio, upiši početak i kraj: kod dana tada piše „plus rad“, a tvoje radno vreme se dodaje plaćenim satima. Na platnoj listi za posebno odsustvo obično postoji poseban red, koji aplikacija upoređuje posebno.", "posebno odsustvo vencanje smrt selidba rad dodatno"], ["Očekivana bruto plata i isplata", "U Pregledu ispod sati vidiš očekivanu bruto platu izračunatu iz tvojih zapisa: plata, prekovremeni, premije i dežurstva, dnevnice posebno. Neto aplikacija ne pokazuje jer zavisi od više stvari, na primer od socijalnog osiguranja, poreza, porodičnog bonusa i paušala za putovanje. Ako u Podešavanjima upišeš dan isplate, u Pregledu stoji i datum. Bruto se pojavljuje tek kad mesec završi, jer pre toga mogu da nedostaju unosi.", "bruto neto isplata dan isplate plata zarada koliko novac"], ["Kamion u Nemačkoj: tarifa, dnevnice i noć", "U Nemačkoj nema jedinstvene tarife: važi po saveznoj državi i samo ako je firma tarifno vezana. Sačuvani su Spedition und Logistik za Severnu Rajnu-Vestfaliju, Bavarsku, Saksoniju i Berlin. Kad pri podešavanju izabereš Nemačku, upisuješ saveznu državu zbog praznika. Ako firma nije tarifno vezana, uzmi platu i dodatke iz ugovora o radu i izaberi „Sopstvene vrednosti“. Vozači u međunarodnom prevozu često imaju posebne ugovore. Ishrana je oslobođena poreza do 14 € (više od 8 sati) i 28 € (24 sata), plus 9 € po noći u kamionu: noćenje dodaješ kao premiju. Noćne dodatke takođe. Sve uporedi sa obračunom.", "nemacka spedicija daljinski prevoz dnevnice tarifa noc nocenje"], ["Reči na platnoj listi", "Entgeltfortzahlung: firma ti i dalje plaća platu, uglavnom na bolovanju. Aufrollung: obračunski referent ponovo obračunava ranije mesece, na primer posle povišice, i razliku doplaćuje ili odbija. Rückverrechnung: nešto već obračunato ponovo se oduzima. Vorschuss: akontacija koja se pri obračunu odbija. Pfändung: po nalogu suda firma zadržava iznos i prosleđuje ga dalje. Sachbezug: pogodnost od firme, na primer službeni auto i za privatne vožnje; dodaje se plati kao vrednost, ali se ne isplaćuje. MA-Vorsorgekasse: firma uplaćuje za tvoju otpremninu, samo pazi da red postoji. Kolektivni ugovor platna lista često uopšte ne navodi. Pogledaj „Tarifgruppe“ i „Beschäftigt als“, to je tvoje razvrstavanje.", "reci platna lista entgeltfortzahlung aufrollung vorschuss pfandung sachbezug vorsorgekasse otpremnina"], ["Provera neto plate kalkulatorom BMF", "Neto aplikacija sama ne računa. Dugme otvara kalkulator bruto-neto austrijskog ministarstva finansija (BMF) u novom prozoru. To je neobavezujuća modelna računica. Upiši tamo bruto odozgo i podesi: period mesečno, grupu doprinosa kao na platnoj listi (radnik ili službenik), godinu, saveznu državu radnog mesta, paušal za putovanje i decu kao kod tebe. Neto uporedi sa redom isplate na platnoj listi. Male razlike su normalne, na primer zbog dnevnica, sindikalne članarine ili akontacija.", "neto bmf kalkulator ministarstvo finansija isplata proveriti"], ["Brzi unos (tekst, glas, fotografija)", "U „Brzom unosu“ samo napišeš ili kažeš šta si radio, na primer „juče od 6 do 15, 30 minuta pauze, kupac Müller iskop“. Od toga pravim unose, ti ih proveriš i sačuvaš. Možeš i da fotografišeš dnevni izveštaj, a ja iz njega preuzimam vremena. Funkcija je na početku isključena: uključi je u Podešavanjima, „Pomoć pri unosu“. Zatim je kartica sasvim gore u Unosu. Mikrofon traži internet i tvoju dozvolu.", "brzi unos glasovna poruka diktirati govoriti dnevni izvestaj fotografija tekst"], ["Platna lista sa fotografije ili PDF-a", "Na kartici Platna lista jednom dozvoli kod „Automatsko čitanje platne liste“ da aplikacija čita tvoju platnu listu. Zatim dodirni „Čitaj platnu listu“ i izaberi fotografiju ili PDF. Čitam je samo ovde na telefonu, ništa se ne otprema. Potvrđuješ svaki red, zatim je sve u poređenju „Da li je moja platna lista tačna?“. Ako ne poznajem red, jednom ga dodeliš i zapamtiću ga za sledeće mesece. U Podešavanjima, „Postavke s platnom listom“, sa njom proveravam i tvoja podešavanja.", "fotografija slika pdf skeniraj citati platna lista kamera automatski"], ["Dve računice: kolektivni ugovor i firma", "Uvek računam dvaput: jednom kako bi trebalo da bude po kolektivnom ugovoru i zakonu, i jednom kako to radi tvoja firma, dakle prema tvojim podešavanjima. Zakon i kolektivni ugovor imaju prednost. Razliku vidiš u pregledu i u poređenju sa platnom listom. U Pregledu, „Godina i računi“, svako odstupanje ostaje u „Zabilježena odstupanja“, čak i ako firma uvek tako radi. Spisak možeš da kopiraš i pokažeš na primer Arbeiterkammer. Sve uz ogradu: razlika može da nastane i zbog greške pri unosu.", "odstupanje razlika firma zakon dve racunice zabelezeno arbeiterkammer pravo premalo"], ["Kolektivni ugovor i savezna država", "U Podešavanjima, „Moje zanimanje“, biraš zanimanje, a kod „Moj kolektivni ugovor“ odgovarajući ugovor. Mnogi kolektivni ugovori se razlikuju po saveznoj državi. Upiši svoju saveznu državu u Podešavanjima, „Moji podaci“, pa ću ti predložiti pravi ugovor i dodatke tvoje države i reći kad nešto ne odgovara. Ako ne nađeš svoj ugovor, izaberi „Sopstvene vrednosti“ i upiši platu i dodatke iz ugovora o radu.", "savezna drzava kolektivni ugovor koji ugovor bec tirol stajerska koruska salcburg"], ["Koja zanimanja postoje?", "Između ostalog: kamion, bager, mali prevoz, autobus i taksi, građevina i zanatstvo, magacin, radionica, industrija, prehrambena industrija, trgovina, kancelarija, terenska prodaja, ugostiteljstvo i hotel, pekara, poslastičarnica, mesara, čišćenje, obezbeđenje, nega i socijalna zaštita, hitna služba, ordinacija, zubna tehnika, optika, frizer, kozmetika, pošta, železnica, savezna služba, baštovanstvo i šumarstvo, žičare, bioskop, dimničar, garaža i benzinska pumpa, perionica, plastika i suzbijanje štetočina, svuda sa učenicima gde ih ima. Ako tvog nema, izaberi „Nešto drugo“ i upiši sopstvene vrednosti. Javi mi preko „Prijavi problem“ koje zanimanje nedostaje.", "zanimanja koje zanimanje nedostaje struka posao radim kao koja postoje postoji"], ["Izveštaj za firmu (PDF)", "Sasvim dole u Unosu je „Izveštaj za firmu“: izaberi dan, nedelju, pola meseca ili mesec i „Napravi PDF i pošalji“ ili sačuvaj. U Podešavanjima, „Izveštaji za firmu“, podesiš ime na izveštaju, kada ga firma želi, e-mail firme i da li se štampa tvoj potpis. Tada te podsetim na vreme.", "izvestaj pdf evidencija rada poslati firma potpis stampa mesecni nedeljni"], ["Godišnji, slobodno vreme i prekovremeni ukratko", "U Pregledu, „Godina i računi“, nalaziš evidenciju sati, karton godišnjeg odmora sa pravom, iskorišćenim danima i ostatkom godišnjeg, račun slobodnog vremena i „Prekovremeni sati ukratko“: šta si zapisao, šta je isplaćeno i šta je otišlo na račun. Upiši stanje sa platne liste i odmah vidiš da li je tačno. Pravo na godišnji računam iz datuma zaposlenja u profilu.", "ostatak godisnjeg pravo karton racun slobodnog vremena stanje prekovremeni ukratko evidencija sati"], ["Planiranje slobodnih dana (produženi vikendi)", "U Pregledu, „Godina i računi“, „Planiranje slobodnih dana“ pokazuje najbolje dane za produžene vikende: sa malo dana godišnjeg ili slobodnog vremena što više slobodnih dana zaredom. Subota i nedelja se računaju kao slobodne. Pre toga pitaj na poslu da li se tih dana radi.", "produzeni vikend planirati slobodni dani godisnji planiranje"], ["Izgled Mije: lik, odeća, boje, glas", "U Profilu, „Moj pratilac“, biraš moj lik i ime. Sa „Sam/a oblikuj Miu“ biraš odeću, dodatke i boje, na primer žuti ili narandžasti reflektujući prsluk. Kad je isključeno, oblačim se prema tvom zanimanju. Tamo podešavaš i da li govorim glasom, a ispod biraš ikonu aplikacije.", "izgled lik odeca boja prsluk glas oblikovati ime milo ikona slika"], ["Probni režim", "U Podešavanjima je probni režim. Sa njim isprobavaš druga zanimanja ili podešavanja bez menjanja stvarnih podataka. Gore se tada vidi crveno obaveštenje. Sa „Nazad na moje podatke“ se vraćaš, a sve isprobano se briše.", "probni rezim isprobati testirati drugo zanimanje"], ["Kupci, gradilišta, vozilo i kilometri", "U Podešavanjima, „Šta beležim“, uključuješ šta još želiš da zapisuješ: vozilo i kilometre, kupce, gradilišta i aktivnosti ili premije. Tada se u Unosu pojavljuju odgovarajuća polja, na primer „+ Dodaj kupca / gradilište“ sa vremenom po kupcu. U profilu možeš da podesiš da se stanje kilometara od prošlog puta upisuje automatski.", "kupac kupci gradiliste aktivnost vozilo kilometri tablice nalog"], ["Firma zatvorena i stalni slobodni dani", "Kad je firma zatvorena, kod „Vrsta dana“ izaberi „Firma zatvorena / kolektivni godišnji odmor“. Kako firma to plaća, kao godišnji ili iz tvojih prekovremenih, podesiš u Podešavanjima, „Firma zatvorena“. Ako svake nedelje istog dana imaš slobodno ili stručnu školu, podesi to jednom u Podešavanjima, „Stalni slobodni dani“. Tada te dane upisujem umesto tebe.", "kolektivni godisnji firma zatvorena stalni slobodni dani svake nedelje skola"], ["Nalog i više uređaja", "Sa nalogom (e-mail i lozinka) tvoji podaci su dodatno sačuvani na serveru. Ako se prijaviš na drugom telefonu ili računaru, svi unosi su i tamo. Bez interneta aplikacija čuva na uređaju i kasnije usklađuje. U Podešavanjima, „Nalog“, vidiš da li je sve sačuvano i možeš da se odjaviš.", "nalog prijava odjava lozinka novi telefon racunar drugi uredaj sinhronizacija"], ["Hitna služba i sanitetski prevoz", "U Crvenom krstu važi kolektivni ugovor Crvenog krsta, u Samariterbundu ugovor Samariterbunda (BARS), oba po saveznoj državi. Za privatne firme hitne službe i sanitetskog prevoza bez sopstvenog ugovora, na primer Grünes Kreuz, važi ugovor Crvenog krsta. Prema Vrhovnom sudu sanitetski prevoz ne sme da se plaća po ugovoru za taksi. U Podešavanjima izaberi zanimanje „Hitna služba“ i svoj ugovor.", "hitna sluzba crveni krst samariter sanitetski prevoz spasilac kola hitne johanniter malteser"], ["Beleška uz dan: ko je hteo slobodan dan?", "U Unosu kod „Beleška uz dan“ zapisuješ sve važno. Kod slobodnih dana tamo beležiš i ko ga je hteo: ti sam, dogovoreno sa firmom ili naređeno od firme. To je važno kasnije kod slobodnog vremena, godišnjeg ili plate, a beleške se vide kod odstupanja.", "beleska napomena naredeno ko je hteo dogovoreno sef zelja"], ["Pomoć i pitanja za programera", "U Podešavanjima, „Pomozi (nije obavezno)“, možeš da dozvoliš da anonimno javljam u kom si zanimanju i koliko se platna lista razlikuje od zapisa, bez imena, e-maila i tačnih iznosa. Možeš i da dozvoliš da programeru šaljem pitanja na koja ne znam da odgovorim, da učim. Oboje nije obavezno i može da se isključi bilo kada.", "pomoc anonimno statistika podrska uciti programer"]],
    it: [["Cosa sa fare l'app", "Lo Stunden-Checker ti mostra se la tua paga è giusta. Tu inserisci l'orario di lavoro, io calcolo straordinari, maggiorazioni, diarie e premi secondo il tuo contratto collettivo e la legge e confronto tutto con la busta paga. Le differenze restano registrate, anche se l'azienda fa diversamente. In più: inserimento rapido con testo, voce o foto del rapporto giornaliero, lettura della busta paga da foto o PDF, conto ferie e ore di recupero, scadenze dei documenti, pianificazione dei ponti e rapporti per l'azienda in PDF. Ci sono oltre 30 settori con più di 150 contratti collettivi per tutti i Land, e l'app parla 13 lingue. Chiedimi pure o tocca un argomento qui sotto.", "cosa sa fare app tutto funzioni panoramica aiuto serve"], ["Inserire le ore", "Apri Inserisci. Inserisci l'ora d'inizio e di fine, aggiungi le pause e tocca Salva. Con „Adesso“ l'app prende l'ora attuale.", "ore inserire inizio fine orario lavoro salva giorno"], ["Aggiungere un premio", "Vai in Impostazioni, „I miei premi“, e aggiungi il tuo premio (per esempio all'ora, al giorno o al pezzo). Poi lo inserisci nel giorno. L'app lo calcola e lo confronta con la busta paga.", "premio indennita bonus gru aggiungere"], ["Controllare la busta paga", "Apri la scheda Busta paga e scorri fino a „La mia busta paga è corretta?“. Inserisci ore e importi, oppure lascia che io legga la busta paga da una foto o un PDF (in alto in „Lettura automatica della busta paga“). L'app ti mostra cosa coincide e dove resta una differenza in ore o euro. Non devi compilare tutte le righe.", "busta paga cedolino controllare corretta confrontare stipendio"], ["Straordinari e maggiorazioni", "In Impostazioni trovi ore settimanali, modello degli straordinari e maggiorazioni. Vengono dal tuo contratto collettivo. Se sono giusti lo vedi sulla busta paga. Puoi cambiarli in qualsiasi momento, anche da una certa data.", "straordinari maggiorazione domenica sabato festivo notte lavoro extra"], ["Diarie", "Le diarie (Diäten) sono l'indennità giornaliera che ricevi in più. In Impostazioni, Diarie, imposti se si paga all'ora o al giorno a scaglioni. L'importo lo trovi sulla busta paga.", "diaria diarie trasferta indennita giornaliera"], ["Cambiare paga o lavoro", "In Impostazioni puoi cambiare la paga o il lavoro a partire da una data. I giorni vecchi restano calcolati con i valori vecchi. Così è giusto anche dopo un aumento o un cambio di lavoro.", "cambiare paga lavoro nuova paga aumento da data paga oraria"], ["Ferie o malattia", "In Inserisci scegli in „Tipo di giorno“ per esempio Ferie, Malattia o Riposo compensativo. Allora non devi inserire orari.", "ferie malattia riposo compensativo libero tipo giorno"], ["I miei dati e la privacy", "Le tue registrazioni sono sul tuo telefono. Con l'account vengono salvate anche su un server protetto a Francoforte, così non si perde niente. Tecnicamente il gestore dell'app potrebbe vederle. Una cifratura che lo esclude è in preparazione. Foto e PDF di buste paga e rapporti giornalieri li leggo solo sul tuo telefono, non vengono caricati. Si salvano solo i numeri che confermi. La tua azienda non vede niente di tutto questo.", "dati privacy sicuro account salvato privato condiviso"], ["Backup", "In Impostazioni, in fondo, trovi „Salva o condividi il backup“. Salva un file con tutti i tuoi dati. Con questo puoi ripristinare tutto su un nuovo telefono.", "backup copia perso ripristinare nuovo telefono"], ["Installare l'app", "Apri la pagina nel browser e tocca „Installa app“ (menu in alto a destra). Se Android avvisa, tocca „Installa comunque“. L'app non è pericolosa, è solo questa pagina web.", "installare schermata home icona simbolo link"], ["Lingua e lettura ad alta voce", "La lingua dell'app la scegli in cima alla pagina. Quando mi fai una domanda, tocca il microfono e parla. Con „Leggi ad alta voce“ ti leggo la risposta. Il microfono richiede internet e il tuo permesso nel browser.", "lingua parlare microfono dettare leggi voce italiano traduzione"], ["Zittire Mia", "Tocca „Zittisci Mia“ e non mi faccio più vedere da sola, solo quando mi tocchi. Lo stesso pulsante mi riattiva. Figura, nome e aspetto li cambi in Profilo, „Il mio compagno“.", "mia milo zittisci silenzio disturba spegni"], ["Scadenze e documenti", "Apri Profilo e scorri fino a „Formazione, documenti e scadenze“. Aggiungi Code 95, carta del conducente, patentino del muletto o scadenze tue con la data. Ti avviso in tempo, e se vuoi l'appuntamento va nel calendario del telefono.", "scadenza code 95 carta conducente muletto gru documento promemoria corso"], ["Arretrati, ricalcolo, pagamenti speciali", "Se l'azienda più tardi ha pagato o trattenuto qualcosa, lo inserisci nel confronto mensile in „Arretrati e correzioni“: per quale mese, quale riga e quanto. L'app lo attribuisce al mese precedente. In „Paga oraria ricalcolata“ ti mostra il calcolo e se l'importo torna. Quattordicesima, tredicesima e premi di ferie li inserisci nella scheda Busta paga in „Pagamenti speciali“.", "arretrati ricalcolo correzione tredicesima quattordicesima pagamenti speciali"], ["Novità", "In Profilo trovi la scheda „Novità“. Lì attivi che Mia ti dica le novità e imposti quanto spesso: subito, ogni settimana o ogni mese. Ricevi solo ciò che riguarda il tuo lavoro. Se vuoi vedere anche il resto, attiva „Novità anche per altri lavori“.", "novita notizie nuova funzione avviso"], ["Part-time, lavoro supplementare e recupero", "Se lavori part-time e più del concordato, fino al limite del tempo pieno del contratto collettivo è lavoro supplementare (Mehrarbeit), non straordinario. Spetta una maggiorazione del 25 %, a meno che tu non prenda le ore 1:1 come recupero nello stesso trimestre. L'app lo calcola da sola. Il tuo contratto collettivo può regolarlo diversamente.", "part time lavoro supplementare recupero trimestre tempo pieno 25"], ["Congedo parentale, maternità, mese del papà", "In Inserisci scegli in „Tipo di giorno“ congedo parentale (Karenz), tutela della maternità o mese del papà. Questi giorni non sono pagati e non hanno ore dovute. Il congedo parentale riduce in proporzione le ferie, la tutela della maternità no.", "congedo parentale maternita papa neonato"], ["Orario flessibile", "Con l'orario flessibile (Gleitzeit) l'app conta ore in più e in meno su un conto. In configurazione scegli „Ufficio con orario flessibile“ o in Impostazioni il modello straordinari „Gleitzeit“. Lì inserisci l'orario dovuto per ogni giorno della settimana, facoltativamente saldo iniziale e limite di riporto. Un giorno di recupero toglie l'orario dovuto dal conto, ferie e malattia no.", "orario flessibile gleitzeit conto saldo ore piu meno"], ["Niente lavoro / esonero", "In Inserisci scegli in „Tipo di giorno“ „Niente lavoro (esonerato dall'azienda)“ quando l'azienda ti manda a casa per mancanza di lavoro. La nota del giorno si imposta da sola. Come l'azienda conteggia il giorno lo imposti in Impostazioni in „Esonero dal lavoro (nessun lavoro)“: l'azienda paga, scalato dal recupero o non pagato. Se non lo sai, l'app non toglie niente. Così la vede anche l'Arbeiterkammer come regola di base: chi è pronto a lavorare e viene mandato a casa mantiene la paga. Sulla busta paga vedi se è giusto.", "esonero niente lavoro mandato a casa mancanza lavoro"], ["Recupero: 1:1,5 o 1:1?", "La legge sull'orario di lavoro (§ 10) dice: la maggiorazione per straordinari va considerata nel recupero o pagata a parte. Con il 50 % quindi o 1 ora di straordinario = 1,5 ore di recupero, oppure 1:1 e la maggiorazione va in busta paga. Il tuo contratto collettivo può regolarlo diversamente. Impostalo in Impostazioni in „Come l'azienda accredita gli straordinari come recupero?“. Quando prendi libero, il recupero si scala ora per ora. In Germania non c'è un rapporto per legge, vale il tuo contratto.", "recupero 1:1 maggiorazione straordinari rapporto"], ["Dove lo trovo sulla busta paga?", "In alto sulla busta paga di solito ci sono il tuo nome, l'azienda, il mese e spesso inquadramento, gruppo salariale e contratto collettivo (a volte abbreviato „KV“). La paga oraria la trovi nella riga „Lohn“ o „Stundenlohn“, le ore accanto nella colonna „Menge“. Gli straordinari stanno spesso in righe proprie con 50 % o 100 %, il recupero in una riga come „Zeitausgleich“ o „Zeitkonto“, le ferie spesso come „Resturlaub“. Le ore settimanali sono nel contratto di lavoro. Se manca qualcosa, chiedi in ufficio o all'ufficio paghe. Quello che non sai, lascialo vuoto nell'app. Fino ad allora l'app calcola con i valori del tuo contratto collettivo.", "dove trovo busta paga contratto collettivo"], ["Sono apprendista", "Come apprendista ricevi un'indennità di apprendistato, di solito un importo mensile fisso per anno. In Impostazioni in „Il mio lavoro“ scegli il tipo „Apprendista“. L'app ti mostra allora nel gruppo salariale solo gli anni di apprendistato del tuo contratto collettivo e con „Usa la paga minima del contratto collettivo“ inserisce l'importo. Se nel contratto c'è un altro importo, inseriscilo in „Paga mensile fissa“. La scuola professionale conta come orario di lavoro: inserisci il giorno come „Formazione / scuola professionale“, un giorno fisso ogni settimana in „Giorni liberi fissi“. Sotto i 18 anni vale la legge sulla tutela dei giovani, di norma al massimo 8 ore al giorno e 40 a settimana. Per domande ti aiuta l'Arbeiterkammer.", "apprendista anno apprendistato scuola professionale indennita contratto"], ["Indennità nell'edilizia e nell'artigianato", "Nell'edilizia e nell'artigianato sulla busta paga ci sono spesso indennità: per sporco, disagio e pericolo, diaria o indennità di distanza per lavori fuori sede, indennità di pernottamento e di montaggio. Aggiungile in Impostazioni, „I miei premi“, Mia ti fa proposte adatte. Con il maltempo nell'edilizia e nelle costruzioni in legno una parte della paga la paga la BUAK, l'app tiene le ore di maltempo a parte. Per i pittori, in caso di fermo per maltempo, c'è il 60 % della paga. Gli importi cambiano per contratto collettivo, confrontali con la busta paga.", "edilizia artigianato indennita maltempo montaggio disagio sporco"], ["Pulizie, vigilanza e assistenza", "In questi lavori ci sono molti turni di notte, domenica e festivi. Inserisci gli orari come hai lavorato, anche oltre la mezzanotte: le ore contano per il giorno in cui inizia il turno. Maggiorazioni e indennità (per esempio notturna, vitto, reperibilità) sono in busta paga: aggiungile in Impostazioni, „I miei premi“, Mia ti fa proposte adatte. Se per te vale un altro contratto collettivo (per esempio ospedale regionale), scegli „Valori propri“.", "pulizie vigilanza sicurezza assistenza turno notte reperibilita"], ["Cambio dell'ora (legale, solare)", "L'app calcola il cambio dell'ora da sola. A ottobre alle 3 l'orologio torna alle 2: chi lavora quella notte ha lavorato un'ora in più. Un turno di notte dalle 22 alle 6 conta allora 9 ore invece di 8. A marzo alle 2 l'orologio va avanti alle 3: manca un'ora, il turno conta 7 invece di 8 ore. Inserisci inizio e fine come li mostrava l'orologio. Se l'azienda paga l'ora in più sta nel contratto collettivo o nell'accordo aziendale: guarda la busta paga. In caso di differenze puoi correggere le ore nel giorno.", "cambio ora legale solare ora in piu"], ["Cos'è il gruppo salariale e mi serve?", "Il gruppo salariale (inquadramento) stabilisce quale paga minima ti spetta per contratto collettivo. Non devi conoscerlo: inserisci semplicemente la paga oraria dalla busta paga. Se lo conosci, l'app può controllare se la tua paga corrisponde al contratto collettivo. Lo trovi in alto sulla busta paga (alla voce „Einstufung“, „Lohngruppe“ o „Verwendungsgruppe“) o nel contratto di lavoro. Se non c'è da nessuna parte, chiedi in azienda.", "gruppo salariale inquadramento serve categoria"], ["Mi mancano dati, posso iniziare lo stesso?", "Sì, puoi iniziare subito, anche se mancano paga, inquadramento o altro. Inserisci quello che hai già, per esempio gli orari. I valori mancanti li aggiungi quando vuoi in Impostazioni. L'app ricalcola poi in automatico tutti i giorni già inseriti. Solo il confronto con la busta paga in euro funziona dopo aver inserito la paga oraria.", "mancano dati incompleto iniziare aggiungere"], ["Dove trovo il messaggio per lo sviluppatore?", "In basso a sinistra nell'app c'è il pulsante „Segnala un problema“. Toccalo, in „Di cosa si tratta?“ scegli per esempio „Qualcosa non va“ o „Suggerimento“, scrivi il messaggio e tocca Invia. L'app allega un'immagine della pagina attuale, puoi disattivarla. Poi vedi una conferma. Il messaggio per lo sviluppatore lo trovi anche in Profilo.", "segnala problema errore suggerimento sviluppatore feedback"], ["Permesso speciale e lavoro nello stesso giorno", "In Inserisci scegli in „Tipo di giorno“ permesso speciale (o Ferie). Il giorno viene accreditato con le ore dovute. Se quel giorno hai lavorato lo stesso, inserisci inizio e fine: nel giorno appare „più lavoro“ e il tuo orario si aggiunge alle ore pagate. Sulla busta paga per il permesso speciale c'è di solito una riga propria, che l'app confronta a parte.", "permesso speciale matrimonio lutto trasloco lavoro extra"], ["Lordo previsto e pagamento", "Nella Panoramica, sotto le ore, vedi il lordo previsto calcolato dalle tue registrazioni: paga, straordinari, premi e servizi, le diarie a parte. Il netto l'app non lo mostra perché dipende da più fattori, per esempio previdenza, imposte, bonus famiglia e forfait pendolari. Se in Impostazioni inserisci il giorno di paga, nella Panoramica c'è anche la data. Il lordo appare solo a mese finito, perché prima possono mancare inserimenti.", "lordo netto pagamento giorno paga stipendio guadagno quanto soldi"], ["Camion in Germania: contratto, diarie e notte", "In Germania non c'è un contratto unico: vale per Land e solo se l'azienda è vincolata. Sono inseriti Spedition und Logistik per Renania Settentrionale-Vestfalia, Baviera, Sassonia e Berlino. Se in configurazione scegli la Germania, inserisci il tuo Land per i festivi. Se l'azienda non è vincolata, prendi paga e maggiorazioni dal contratto di lavoro e scegli „Valori propri“. Per gli autisti a lunga percorrenza ci sono spesso contratti propri. Il vitto è esente da imposte fino a 14 € (più di 8 ore) e 28 € (24 ore), più 9 € a notte nel camion: il pernottamento lo aggiungi come premio. Anche le maggiorazioni notturne. Confronta tutto con il conteggio.", "germania spedizione lunga percorrenza diaria contratto notte pernottamento"], ["Parole sulla busta paga", "Entgeltfortzahlung: l'azienda continua a pagarti, di solito in malattia. Aufrollung: l'ufficio paghe ricalcola mesi precedenti, per esempio dopo un aumento, e paga o trattiene la differenza. Rückverrechnung: qualcosa già conteggiato viene ritolto. Vorschuss: un anticipo che viene scalato nel conteggio. Pfändung: su ordine del tribunale l'azienda trattiene un importo e lo gira. Sachbezug: un vantaggio dall'azienda, per esempio l'auto aziendale anche per uso privato; si somma alla paga come valore ma non viene pagato. MA-Vorsorgekasse: l'azienda versa per la tua liquidazione, basta controllare che la riga ci sia. Spesso la busta paga non indica il contratto collettivo. Guarda „Tarifgruppe“ e „Beschäftigt als“: è il tuo inquadramento.", "parole busta paga entgeltfortzahlung aufrollung vorschuss pfandung sachbezug vorsorgekasse liquidazione"], ["Controllare il netto con il calcolatore BMF", "Il netto l'app non lo calcola da sola. Il pulsante apre il calcolatore lordo-netto del Ministero delle Finanze austriaco (BMF) in una nuova finestra. È un calcolo modello non vincolante. Inserisci lì il lordo indicato sopra e imposta: periodo mensile, gruppo contributivo come sulla busta paga (operaio o impiegato), anno, Land del posto di lavoro, forfait pendolari e figli come nel tuo caso. Confronta il netto con la riga del pagamento sulla busta paga. Piccole differenze sono normali, per esempio per diarie, quota sindacale o anticipi.", "netto bmf calcolatore ministero finanze pagamento controllare"], ["Inserimento rapido (testo, voce, foto)", "Con „Inserimento rapido“ scrivi o dici semplicemente cosa hai lavorato, per esempio „ieri dalle 6 alle 15, 30 minuti di pausa, cliente Müller scavo“. Io ne ricavo le registrazioni, tu le controlli e salvi. Puoi anche fotografare il rapporto giornaliero e io prendo gli orari da lì. La funzione all'inizio è spenta: attivala in Impostazioni, „Aiuti all'inserimento“. Poi la scheda è in cima a Inserisci. Il microfono richiede internet e il tuo permesso.", "inserimento rapido messaggio vocale dettare parlare rapporto giornaliero foto testo"], ["Busta paga da foto o PDF", "Nella scheda Busta paga autorizza una volta, in „Lettura automatica della busta paga“, che l'app legga la tua busta paga. Poi tocca „Leggi busta paga“ e scegli una foto o il PDF. La leggo solo qui sul telefono, non si carica niente. Confermi ogni riga, poi tutto è nel confronto „La mia busta paga è corretta?“. Se non conosco una riga, la assegni una volta e la ricordo per i mesi successivi. In Impostazioni, „Impostazioni con la busta paga“, con essa controllo anche le tue impostazioni.", "foto immagine pdf scansione leggere busta paga fotocamera automatica"], ["Due calcoli: contratto collettivo e azienda", "Calcolo sempre due volte: una come dovrebbe essere secondo contratto collettivo e legge, e una come fa la tua azienda, cioè secondo le tue impostazioni. Legge e contratto collettivo hanno la precedenza. La differenza la vedi nella panoramica e nel confronto con la busta paga. In Panoramica, „Anno e conti“, ogni scostamento resta in „Scostamenti registrati“, anche se l'azienda fa sempre così. Puoi copiare l'elenco e mostrarlo per esempio all'Arbeiterkammer. Tutto con riserva: una differenza può nascere anche da un errore di inserimento.", "scostamento differenza azienda legge due calcoli registrato arbeiterkammer diritto troppo poco"], ["Contratto collettivo e Land", "In Impostazioni, „Il mio lavoro“, scegli il lavoro e in „Il mio contratto collettivo“ quello giusto. Molti contratti collettivi cambiano da Land a Land. Inserisci il tuo Land in Impostazioni, „I miei dati“: ti propongo il contratto giusto e le indennità del tuo Land e ti dico se qualcosa non torna. Se non trovi il tuo contratto, scegli „Valori propri“ e inserisci paga e maggiorazioni dal contratto di lavoro.", "land contratto collettivo quale contratto vienna tirolo stiria carinzia salisburgo"], ["Quali lavori ci sono?", "Tra gli altri: camion, escavatore, piccoli trasporti, autobus e taxi, edilizia e artigianato, magazzino, officina, industria, industria alimentare, commercio, ufficio, vendita esterna, ristorazione e hotel, panetteria, pasticceria, macelleria, pulizie, vigilanza, assistenza e sociale, servizio di soccorso, studio medico, odontotecnica, ottica, parrucchiere, estetica, posta, ferrovia, servizio federale, giardinaggio e foreste, impianti a fune, cinema, spazzacamino, garage e distributore, lavanderia, plastica e disinfestazione, ovunque con apprendisti dove ci sono. Se il tuo manca, scegli „Altro“ e inserisci i tuoi valori. Scrivimi con „Segnala un problema“ quale lavoro manca.", "lavori quale lavoro manca settore professione lavoro come"], ["Rapporto per l'azienda (PDF)", "In fondo a Inserisci trovi „Rapporto per l'azienda“: scegli giorno, settimana, mezzo mese o mese e „Crea PDF e invia“ oppure salva. In Impostazioni, „Rapporti per l'azienda“, imposti il nome sul rapporto, quando l'azienda lo vuole, l'e-mail dell'azienda e se stampare la tua firma. Allora ti avviso in tempo.", "rapporto pdf foglio ore inviare azienda firma stampare mensile settimanale"], ["Ferie, recupero e straordinari in sintesi", "In Panoramica, „Anno e conti“, trovi il registro ore, la scheda ferie con diritto, giorni presi e ferie residue, il conto ore di recupero e „Straordinari in sintesi“: cosa hai registrato, cosa è stato pagato e cosa è andato sul conto. Inserisci il saldo della busta paga e vedi subito se torna. Il diritto alle ferie lo calcolo dalla data di assunzione nel profilo.", "ferie residue diritto scheda ferie conto recupero saldo straordinari sintesi registro ore"], ["Pianificare i giorni liberi (ponti)", "In Panoramica, „Anno e conti“, „Pianifica i giorni liberi“ ti mostra i ponti migliori: con pochi giorni di ferie o recupero, più giorni liberi di fila possibile. Sabato e domenica contano come liberi. Chiedi prima in azienda se in quei giorni si lavora.", "ponte pianificare giorni liberi weekend lungo ferie"], ["Personalizzare Mia: figura, vestiti, colori, voce", "In Profilo, „Il mio compagno“, scegli la mia figura e il mio nome. Con „Crea Mia a modo tuo“ scegli vestiti, accessori e colori, per esempio un gilet ad alta visibilità giallo o arancione. Se è spento, mi vesto adatta al tuo lavoro. Lì imposti anche se parlo con la voce, e sotto scegli l'icona dell'app.", "aspetto figura vestiti colore gilet voce personalizzare nome milo icona immagine"], ["Modalità prova", "In Impostazioni trovi la modalità prova. Con essa provi altri lavori o impostazioni senza cambiare i tuoi dati veri. In alto compare un avviso rosso. Con „Torna ai miei dati“ torni indietro e tutto quello che hai provato viene cancellato.", "modalita prova provare testare altro lavoro"], ["Clienti, cantieri, veicolo e chilometri", "In Impostazioni, „Cosa registro“, attivi cosa vuoi annotare in più: veicolo e chilometri, clienti, cantieri e attività o premi. Allora in Inserisci compaiono i campi adatti, per esempio „+ Aggiungi cliente / cantiere“ con il tempo per cliente. Nel profilo puoi impostare che i chilometri dell'ultima volta vengano inseriti da soli.", "cliente clienti cantiere attivita veicolo chilometri targa ordine"], ["Azienda chiusa e giorni liberi fissi", "Se l'azienda è chiusa, in „Tipo di giorno“ scegli „Azienda chiusa / ferie aziendali“. Come la paga l'azienda, come ferie o dai tuoi straordinari, lo imposti in Impostazioni, „Azienda chiusa“. Se ogni settimana hai libero lo stesso giorno o scuola professionale, impostalo una volta in Impostazioni, „Giorni liberi fissi“. Allora inserisco io quei giorni per te.", "ferie aziendali azienda chiusa giorni liberi fissi ogni settimana scuola"], ["Account e più dispositivi", "Con il tuo account (e-mail e password) i dati sono salvati anche sul server. Se accedi da un altro telefono o computer, tutte le registrazioni sono anche lì. Senza internet l'app salva sul dispositivo e sincronizza dopo. In Impostazioni, „Account“, vedi se è tutto salvato e puoi uscire.", "account accesso esci password nuovo telefono computer secondo dispositivo sincronizza"], ["Soccorso e trasporto infermi", "Alla Croce Rossa vale il contratto collettivo della Croce Rossa, al Samariterbund il contratto Samariterbund (BARS), entrambi per Land. Per le ditte private di soccorso e trasporto infermi senza contratto proprio, per esempio Grünes Kreuz, vale il contratto della Croce Rossa. Secondo la Corte suprema il trasporto infermi non può essere pagato con il contratto dei taxi. In Impostazioni scegli il lavoro „Servizio di soccorso“ e il tuo contratto.", "soccorso croce rossa samariter trasporto infermi soccorritore ambulanza johanniter malteser"], ["Nota del giorno: chi voleva il giorno libero?", "In Inserisci annoti in „Nota del giorno“ tutto ciò che conta. Per i giorni liberi registri lì anche chi l'ha voluto: tu, concordato con l'azienda o disposto dall'azienda. Conta più avanti per recupero, ferie o paga, e le note compaiono insieme agli scostamenti.", "nota annotazione disposto chi voleva concordato capo desiderio"], ["Aiutare e domande allo sviluppatore", "In Impostazioni, „Aiuta (facoltativo)“, puoi permettermi di segnalare in forma anonima in che lavoro sei e quanto busta paga e registrazioni differiscono, senza nome, e-mail e importi esatti. Puoi anche permettermi di inviare allo sviluppatore le domande a cui non so rispondere, così imparo. Entrambe le cose sono facoltative e disattivabili in qualsiasi momento.", "aiutare anonimo statistica sostenere imparare sviluppatore"]],
    ro: [["Ce poate face aplicația", "Stunden-Checker îți arată dacă salariul tău este corect. Tu introduci timpul de lucru, eu calculez orele suplimentare, sporurile, diurna și primele după contractul tău colectiv și după lege și compar totul cu fluturașul de salariu. Diferențele rămân înregistrate, chiar dacă firma procedează altfel. În plus: introducere rapidă prin text, voce sau poza raportului zilnic, citirea fluturașului din poză sau PDF, cont de concediu și de timp liber, termene pentru acte, planificarea zilelor-punte și rapoarte pentru firmă în PDF. Sunt peste 30 de domenii cu peste 150 de contracte colective pentru toate landurile, iar aplicația vorbește 13 limbi. Întreabă-mă sau atinge mai jos un subiect.", "ce poate face aplicatia tot functii prezentare ajutor la ce"], ["Introducerea orelor", "Deschide Înregistrare. Introdu ora de început și de sfârșit, adaugă pauzele și atinge Salvează. Cu „Acum” aplicația ia ora curentă.", "ore introducere inceput sfarsit timp lucru salveaza zi"], ["Adăugarea unei prime", "Mergi la Setări, „Primele mele”, și adaugă prima (de exemplu pe oră, pe zi sau pe bucată). Apoi o introduci la zi. Aplicația o calculează și o compară cu fluturașul.", "prima spor bonus macara adauga"], ["Verificarea fluturașului", "Deschide fila Fluturaș de salariu și derulează la „Este corect fluturașul meu de salariu?”. Introdu orele și sumele sau lasă-mă să citesc fluturașul din poză sau PDF (sus la „Citirea automată a fluturașului”). Aplicația îți arată ce se potrivește și unde rămâne o diferență în ore sau euro. Nu trebuie să completezi toate rândurile.", "fluturas salariu verifica corect compara decont"], ["Ore suplimentare și sporuri", "În Setări găsești orele pe săptămână, modelul de ore suplimentare și sporurile. Provin din contractul tău colectiv. Dacă sunt corecte vezi pe fluturaș. Le poți schimba oricând, și de la o anumită dată.", "ore suplimentare spor duminica sambata sarbatoare noapte munca in plus"], ["Diurna", "Diurna (Diäten) este indemnizația zilnică pe care o primești în plus. În Setări, Diurnă, alegi dacă se plătește pe oră sau pe zi pe trepte. Suma o găsești pe fluturaș.", "diurna deplasare indemnizatie zilnica"], ["Schimbarea salariului sau a meseriei", "În Setări poți schimba salariul sau meseria de la o anumită dată. Zilele vechi rămân calculate cu valorile vechi. Astfel e corect și după o mărire de salariu sau o schimbare de loc de muncă.", "schimbare salariu meserie salariu nou marire de la data salariu orar"], ["Concediu sau concediu medical", "În Înregistrare alege la „Tipul zilei” de exemplu Concediu, Concediu medical sau Timp liber compensatoriu. Atunci nu trebuie să introduci ore.", "concediu medical boala timp liber compensatoriu liber tipul zilei"], ["Datele mele și protecția datelor", "Înregistrările tale sunt pe telefon. Cu contul sunt salvate în plus pe un server securizat în Frankfurt, ca să nu se piardă nimic. Tehnic, operatorul aplicației le-ar putea vedea. O criptare care exclude asta este în lucru. Pozele și fișierele PDF ale fluturașilor și rapoartelor zilnice le citesc doar pe telefonul tău, nu se încarcă. Se salvează doar cifrele pe care le confirmi. Firma ta nu vede nimic din toate acestea.", "date protectie sigur cont salvat privat transmis"], ["Copie de rezervă", "În Setări, jos de tot, găsești „Salvează sau partajează copia de rezervă”. Se salvează un fișier cu toate datele tale. Cu el poți reface totul pe un telefon nou.", "copie rezerva backup pierdut restaurare telefon nou"], ["Instalarea aplicației", "Deschide pagina în browser și atinge „Instalează aplicația” (meniul din dreapta sus). Dacă Android avertizează, atinge „Instalează oricum”. Aplicația e inofensivă, e doar această pagină web.", "instalare ecran principal pictograma simbol link"], ["Limba și citirea cu voce tare", "Limba aplicației o alegi chiar sus pe pagină. Când mă întrebi ceva, atinge microfonul și vorbește. Cu „Citește cu voce tare” îți citesc răspunsul. Microfonul are nevoie de internet și de permisiunea ta în browser.", "limba vorbi microfon dicta citeste voce romana traducere"], ["Liniștirea Miei", "Atinge „Liniștește-o pe Mia” și nu mai apar singură, doar când mă atingi. Același buton mă pornește din nou. Figura, numele și aspectul le schimbi în Profil, „Însoțitorul meu”.", "mia milo linisteste tacere deranjeaza opreste"], ["Termene și acte", "Deschide Profil și derulează la „Formări, acte și termene”. Adaugă Code 95, cardul de șofer, permisul de stivuitor sau termene proprii cu data de expirare. Îți amintesc la timp, iar dacă vrei termenul intră în calendarul telefonului.", "termen code 95 card sofer stivuitor macara expirare act memento curs"], ["Plată ulterioară, recalculare, plăți speciale", "Dacă firma a plătit sau a reținut ceva mai târziu, introduci asta în comparația lunară la „Plăți ulterioare și corecturi”: pentru ce lună, ce rând și cât. Aplicația îl atribuie lunii anterioare. La „Salariu orar recalculat” îți arată calculul și dacă suma e corectă. Prima de concediu, prima de Crăciun, al 13-lea și al 14-lea salariu le introduci în fila Fluturaș de salariu la „Plăți speciale”.", "plata ulterioara recalculare corectura prima craciun concediu 13 14 salariu plati speciale"], ["Noutăți", "În Profil găsești cardul „Noutăți”. Acolo pornești ca Mia să-ți spună noutățile și alegi cât de des: imediat, săptămânal sau lunar. Primești doar ce se potrivește meseriei tale. Dacă vrei să vezi și restul, pornește „Noutăți și pentru alte meserii”.", "noutati stiri functie noua anunt"], ["Timp parțial, muncă suplimentară și timp liber", "Dacă lucrezi cu timp parțial și mai mult decât s-a convenit, până la limita normei întregi din contractul colectiv este muncă suplimentară (Mehrarbeit), nu oră suplimentară. Pentru ea se dă un spor de 25 %, dacă nu iei orele 1:1 ca timp liber în același trimestru. Aplicația calculează asta singură. Contractul tău colectiv poate prevedea altfel.", "timp partial munca suplimentara timp liber trimestru norma intreaga 25"], ["Concediu pentru creșterea copilului, maternitate, luna tatălui", "În Înregistrare alege la „Tipul zilei” concediul pentru creșterea copilului (Karenz), protecția maternității sau luna tatălui. Aceste zile sunt neplătite și nu au ore obligatorii. Concediul pentru creșterea copilului reduce proporțional concediul de odihnă, protecția maternității nu.", "concediu crestere copil maternitate luna tatalui bebelus"], ["Program flexibil", "La programul flexibil (Gleitzeit) aplicația numără orele în plus și în minus pe un cont. La configurare alege „Birou cu program flexibil” sau în Setări modelul de ore suplimentare „Gleitzeit”. Acolo introduci timpul obligatoriu pentru fiecare zi a săptămânii, opțional soldul inițial și limita de reportare. O zi liberă din programul flexibil scade timpul obligatoriu din cont, concediul și concediul medical nu.", "program flexibil gleitzeit cont sold ore plus minus"], ["Fără lucru / scutire de muncă", "În Înregistrare alege la „Tipul zilei” „Fără lucru (scutit de firmă)” când firma te trimite acasă din lipsă de lucru. Notița pentru zi se pune singură. Cum socotește firma ziua alegi în Setări la „Eliberare de la muncă (fără muncă)”: firma plătește în continuare, scădere din timpul liber sau neplătit. Dacă nu știi, aplicația nu scade nimic. Așa vede și Arbeiterkammer regula de bază: cine e gata de lucru și e trimis acasă își păstrează salariul. Pe fluturaș vezi dacă e corect.", "scutire fara lucru trimis acasa lipsa de lucru"], ["Timp liber: 1:1,5 sau 1:1?", "Legea timpului de lucru (§ 10) spune: sporul pentru ore suplimentare trebuie luat în calcul la timpul liber sau plătit separat. La un spor de 50 % deci fie 1 oră suplimentară = 1,5 ore libere, fie 1:1 și sporul apare pe fluturaș. Contractul tău colectiv poate prevedea altfel. Setează asta în Setări la „Cum trece firma orele suplimentare ca timp liber?”. Când iei liber, timpul se scade oră cu oră. În Germania nu există un raport legal, contează contractul tău.", "timp liber 1:1 spor ore suplimentare raport"], ["Unde găsesc asta pe fluturaș?", "Sus pe fluturaș sunt de obicei numele tău, firma, luna și adesea încadrarea, grupa de salarizare și contractul colectiv (uneori abreviat „KV”). Salariul orar îl găsești în rândul „Lohn” sau „Stundenlohn”, orele alături în coloana „Menge”. Orele suplimentare sunt adesea în rânduri proprii cu 50 % sau 100 %, timpul liber într-un rând ca „Zeitausgleich” sau „Zeitkonto”, concediul adesea ca „Resturlaub”. Orele pe săptămână sunt în contractul de muncă. Dacă lipsește ceva, întreabă la birou sau la salarizare. Ce nu știi, lasă gol în aplicație. Până atunci aplicația calculează cu valorile contractului tău colectiv.", "unde gasesc fluturas contract colectiv decont"], ["Sunt ucenic", "Ca ucenic primești o indemnizație de ucenicie, de obicei o sumă lunară fixă pe an de ucenicie. În Setări la „Meseria mea” alege tipul „Ucenic”. Aplicația îți arată atunci la grupa de salarizare doar anii de ucenicie ai contractului tău colectiv și cu „Folosește salariul minim din contractul colectiv” trece suma. Dacă în contract e altă sumă, introdu-o la „Salariu lunar fix”. Școala profesională contează ca timp de lucru: introdu ziua ca „Instruire / școală profesională”, o zi fixă de școală pe săptămână la „Zile libere fixe”. Sub 18 ani se aplică legea protecției tinerilor, de regulă cel mult 8 ore pe zi și 40 pe săptămână. Cu întrebări te ajută Arbeiterkammer.", "ucenic an ucenicie scoala profesionala indemnizatie contract"], ["Sporuri în construcții și meșteșuguri", "În construcții și meșteșuguri pe fluturaș apar adesea sporuri: pentru murdărie, condiții grele și pericol, diurnă sau spor de distanță la lucrul în afara sediului, indemnizație de cazare și spor de montaj. Adaugă-le în Setări, „Primele mele”, Mia îți face propuneri potrivite. La vreme rea în construcții și în construcțiile din lemn o parte din salariu o plătește BUAK, aplicația ține orele de vreme rea separat. La zugravi, la oprirea din cauza vremii, se plătește 60 % din salariu. Sumele diferă după contractul colectiv, compară-le cu fluturașul.", "constructii meserii spor vreme rea montaj conditii grele murdarie"], ["Curățenie, pază și îngrijire", "În aceste meserii sunt multe ture de noapte, duminica și de sărbători. Introdu orele cum ai lucrat, și peste miezul nopții: orele contează pentru ziua în care începe tura. Sporurile (de exemplu de noapte, de masă, de gardă) sunt pe fluturaș: adaugă-le în Setări, „Primele mele”, Mia îți face propuneri potrivite. Dacă la tine se aplică alt contract colectiv (de exemplu spital regional), alege „Valori proprii”.", "curatenie paza securitate ingrijire tura noapte garda"], ["Schimbarea orei (vară, iarnă)", "Aplicația calculează singură schimbarea orei. În octombrie, la 3 ceasul se dă înapoi la 2: cine lucrează în acea noapte a lucrat o oră în plus. O tură de noapte de la 22 la 6 are atunci 9 ore în loc de 8. În martie, la 2 ceasul se dă înainte la 3: lipsește o oră, tura are 7 ore în loc de 8. Introdu începutul și sfârșitul cum le arăta ceasul. Dacă firma plătește ora în plus scrie în contractul colectiv sau în acordul de firmă: uită-te pe fluturaș. La diferențe poți ajusta orele la zi.", "schimbarea orei ora de vara iarna ora in plus"], ["Ce e grupa de salarizare și am nevoie de ea?", "Grupa de salarizare (încadrarea) stabilește ce salariu minim îți dă contractul colectiv. Nu trebuie s-o știi: introdu doar salariul orar de pe fluturaș. Dacă o știi, aplicația poate verifica dacă salariul tău corespunde contractului colectiv. O găsești sus pe fluturaș (la „Einstufung”, „Lohngruppe” sau „Verwendungsgruppe”) sau în contractul de muncă. Dacă nu apare nicăieri, întreabă la firmă.", "grupa salarizare incadrare nevoie categorie"], ["Îmi lipsesc date, pot începe totuși?", "Da, poți începe imediat, chiar dacă lipsesc salariul, încadrarea sau altceva. Introdu ce ai deja, de exemplu orele de lucru. Valorile lipsă le completezi oricând în Setări. Aplicația recalculează apoi automat toate zilele deja introduse. Doar comparația cu fluturașul în euro merge după ce ai introdus salariul orar.", "lipsesc date incomplet incepe completa"], ["Unde găsesc mesajul pentru dezvoltator?", "Jos în stânga în aplicație e butonul „Raportează o problemă”. Atinge-l, la „Despre ce e vorba?” alege de exemplu „Ceva nu e în regulă” sau „Sugestie”, scrie mesajul și atinge Trimite. Aplicația atașează o imagine a paginii curente, o poți dezactiva. Apoi vezi o confirmare. Mesajul pentru dezvoltator îl găsești și în Profil.", "raporteaza problema eroare sugestie dezvoltator feedback"], ["Concediu special și muncă în aceeași zi", "În Înregistrare alege la „Tipul zilei” concediu special (sau Concediu). Ziua se trece cu orele obligatorii. Dacă totuși ai lucrat în ziua aceea, introdu începutul și sfârșitul: la zi scrie atunci „plus muncă”, iar timpul tău de lucru se adaugă la orele plătite. Pe fluturaș pentru concediul special există de obicei un rând propriu, pe care aplicația îl compară separat.", "concediu special nunta deces mutare munca in plus"], ["Brutul estimat și plata", "În Prezentare, sub ore, vezi brutul estimat calculat din înregistrările tale: salariu, ore suplimentare, prime și servicii, diurna separat. Netul aplicația nu îl arată, pentru că depinde de mai mulți factori, de exemplu asigurări sociale, impozit, bonus familial și paușal pentru navetă. Dacă în Setări introduci ziua de plată, în Prezentare apare și data. Brutul apare abia după ce luna s-a terminat, pentru că înainte pot lipsi înregistrări.", "brut net plata ziua platii salariu castig cat bani"], ["Camion în Germania: tarif, diurnă și noapte", "În Germania nu există un tarif unic: se aplică pe land și doar dacă firma e legată de tarif. Sunt salvate Spedition und Logistik pentru Renania de Nord-Westfalia, Bavaria, Saxonia și Berlin. Dacă la configurare alegi Germania, introduci landul pentru sărbători. Dacă firma nu e legată de tarif, ia salariul și sporurile din contractul de muncă și alege „Valori proprii”. Șoferii pe distanțe lungi au adesea contracte proprii. Masa e scutită de impozit până la 14 € (peste 8 ore) și 28 € (24 de ore), plus 9 € pe noapte în camion: cazarea o adaugi ca primă. Sporurile de noapte la fel. Compară totul cu decontul.", "germania expeditie transport lung diurna tarif noapte cazare"], ["Cuvinte de pe fluturaș", "Entgeltfortzahlung: firma îți plătește în continuare salariul, de obicei în concediu medical. Aufrollung: contabilul de salarii recalculează lunile anterioare, de exemplu după o mărire, și plătește sau reține diferența. Rückverrechnung: ceva deja decontat se scade înapoi. Vorschuss: un avans care se scade la decont. Pfändung: la ordinul instanței firma reține o sumă și o transferă mai departe. Sachbezug: un avantaj de la firmă, de exemplu mașina de serviciu și pentru drumuri private; se adaugă la salariu ca valoare, dar nu se plătește. MA-Vorsorgekasse: firma plătește pentru indemnizația ta de plecare, verifică doar că rândul există. Contractul colectiv adesea nu apare deloc pe fluturaș. Uită-te la „Tarifgruppe” și „Beschäftigt als”, aceea e încadrarea ta.", "cuvinte fluturas entgeltfortzahlung aufrollung vorschuss pfandung sachbezug vorsorgekasse indemnizatie"], ["Verificarea netului cu calculatorul BMF", "Netul aplicația nu îl calculează singură. Butonul deschide calculatorul brut-net al Ministerului de Finanțe austriac (BMF) într-o fereastră nouă. E un calcul model fără obligații. Introdu acolo brutul de mai sus și setează: perioada lunar, grupa de contribuții ca pe fluturaș (muncitor sau angajat), anul, landul locului de muncă, paușalul pentru navetă și copiii ca la tine. Compară netul cu rândul plății de pe fluturaș. Diferențele mici sunt normale, de exemplu din cauza diurnei, cotizației la sindicat sau avansurilor.", "net bmf calculator ministerul finantelor plata verifica"], ["Introducere rapidă (text, voce, poză)", "Cu „Introducere rapidă” doar scrii sau spui ce ai lucrat, de exemplu „ieri de la 6 la 15, 30 de minute pauză, client Müller săpătură”. Eu fac din asta înregistrări, tu le verifici și salvezi. Poți face și o poză raportului zilnic, iar eu preiau orele din el. Funcția e la început oprită: pornește-o în Setări, „Ajutoare de introducere”. Apoi cardul e chiar sus în Înregistrare. Microfonul are nevoie de internet și de permisiunea ta.", "introducere rapida mesaj vocal dicta vorbi raport zilnic poza text"], ["Fluturașul din poză sau PDF", "În fila Fluturaș de salariu permite o dată, la „Citirea automată a fluturașului”, ca aplicația să-ți citească fluturașul. Apoi atinge „Citește fluturașul” și alege o poză sau fișierul PDF. Îl citesc doar aici pe telefon, nu se încarcă nimic. Confirmi fiecare rând, apoi totul e în comparația „Este corect fluturașul meu de salariu?”. Dacă nu cunosc un rând, îl atribui o dată și îl țin minte pentru lunile următoare. În Setări, „Setări cu fluturașul de salariu”, verific cu el și setările tale.", "poza fotografie pdf scanare citeste fluturas camera automat"], ["Două calcule: contract colectiv și firmă", "Calculez mereu de două ori: o dată cum ar trebui să fie după contractul colectiv și lege, și o dată cum face firma ta, adică după setările tale. Legea și contractul colectiv au prioritate. Diferența o vezi în prezentare și în comparația cu fluturașul. În Prezentare, „An și conturi”, fiecare abatere rămâne în „Abateri înregistrate”, chiar dacă firma face mereu așa. Lista o poți copia și arăta de exemplu la Arbeiterkammer. Totul sub rezervă: o diferență poate apărea și dintr-o greșeală de introducere.", "abatere diferenta firma lege doua calcule inregistrat arbeiterkammer drept prea putin"], ["Contract colectiv și land", "În Setări, „Meseria mea”, alegi meseria, iar la „Contractul meu colectiv” contractul potrivit. Multe contracte colective diferă de la land la land. Introdu landul tău în Setări, „Datele mele”, atunci îți propun contractul corect și sporurile landului tău și îți spun dacă ceva nu se potrivește. Dacă nu găsești contractul, alege „Valori proprii” și introdu salariul și sporurile din contractul de muncă.", "land contract colectiv care contract viena tirol stiria carintia salzburg"], ["Ce meserii există?", "Printre altele: camion, excavator, transport mic, autobuz și taxi, construcții și meșteșuguri, depozit, atelier, industrie, industria alimentară, comerț, birou, vânzări pe teren, gastronomie și hotel, brutărie, cofetărie, măcelărie, curățenie, pază, îngrijire și asistență socială, serviciul de ambulanță, cabinet medical, tehnică dentară, optică, frizerie, cosmetică, poștă, cale ferată, serviciul federal, grădinărit și silvicultură, telecabine, cinema, coșerit, garaj și benzinărie, spălătorie, mase plastice și dezinsecție, peste tot cu ucenici unde există. Dacă a ta lipsește, alege „Altceva” și introdu valorile proprii. Scrie-mi prin „Raportează o problemă” ce meserie lipsește.", "meserii ce meserie lipseste domeniu munca lucrez ca exista meseriile"], ["Raport pentru firmă (PDF)", "Jos de tot în Înregistrare găsești „Raport pentru firmă”: alege zi, săptămână, jumătate de lună sau lună și „Creează PDF și trimite” sau salvează. În Setări, „Rapoarte pentru firmă”, setezi numele de pe raport, când îl vrea firma, e-mailul firmei și dacă se tipărește semnătura ta. Atunci îți amintesc la timp.", "raport pdf foaie de prezenta trimite firma semnatura tipari lunar saptamanal"], ["Concediu, timp liber și ore suplimentare pe scurt", "În Prezentare, „An și conturi”, găsești evidența orelor, fișa de concediu cu dreptul, zilele luate și concediul rămas, contul de timp liber și „Ore suplimentare pe scurt”: ce ai notat, ce s-a plătit și ce a mers în cont. Introdu soldul de pe fluturaș și vezi imediat dacă se potrivește. Dreptul la concediu îl calculez din data angajării din profil.", "concediu ramas drept fisa concediu cont timp liber sold ore suplimentare evidenta orelor"], ["Planificarea zilelor libere (punți)", "În Prezentare, „An și conturi”, „Planifică zilele libere” îți arată cele mai bune zile-punte: cu puține zile de concediu sau timp liber, cât mai multe zile libere la rând. Sâmbăta și duminica contează ca libere. Întreabă înainte la firmă dacă se lucrează în acele zile.", "punte planifica zile libere weekend prelungit concediu planificare"], ["Aspectul Miei: figură, haine, culori, voce", "În Profil, „Însoțitorul meu”, alegi figura și numele meu. Cu „Creează-o tu pe Mia” alegi haine, accesorii și culori, de exemplu o vestă reflectorizantă galbenă sau portocalie. Când e oprit, mă îmbrac potrivit meseriei tale. Tot acolo setezi dacă vorbesc cu voce, iar dedesubt alegi pictograma aplicației.", "aspect figura haine culoare vesta voce creeaza nume milo pictograma imagine"], ["Mod de încercare", "În Setări găsești modul de încercare. Cu el încerci alte meserii sau setări fără să-ți schimbi datele reale. Sus apare atunci un mesaj roșu. Cu „Înapoi la datele mele” te întorci, iar tot ce ai încercat se șterge.", "mod incercare incerca testa alta meserie"], ["Clienți, șantiere, vehicul și kilometri", "În Setări, „Ce înregistrez”, pornești ce mai vrei să notezi: vehicul și kilometri, clienți, șantiere și activități sau prime. Atunci în Înregistrare apar câmpurile potrivite, de exemplu „+ Adaugă client / șantier” cu timpul pe client. În profil poți seta ca kilometrajul de data trecută să se treacă automat.", "client clienti santier activitate vehicul kilometri numar comanda"], ["Firmă închisă și zile libere fixe", "Când firma e închisă, alege la „Tipul zilei” „Firmă închisă / concediu colectiv”. Cum plătește firma, drept concediu sau din orele tale suplimentare, setezi în Setări, „Firmă închisă”. Dacă în fiecare săptămână ai liber în aceeași zi sau școală profesională, setează asta o dată în Setări, „Zile libere fixe”. Atunci trec eu acele zile pentru tine.", "concediu colectiv firma inchisa zile libere fixe in fiecare saptamana scoala"], ["Cont și mai multe dispozitive", "Cu contul (e-mail și parolă) datele tale sunt salvate în plus pe server. Dacă te conectezi pe alt telefon sau calculator, toate înregistrările sunt și acolo. Fără internet aplicația salvează pe dispozitiv și sincronizează mai târziu. În Setări, „Cont”, vezi dacă totul e salvat și te poți deconecta.", "cont conectare deconectare parola telefon nou calculator al doilea dispozitiv sincronizare"], ["Ambulanță și transport pacienți", "La Crucea Roșie se aplică contractul colectiv al Crucii Roșii, la Samariterbund contractul Samariterbund (BARS), ambele pe land. Pentru firmele private de ambulanță și transport pacienți fără contract propriu, de exemplu Grünes Kreuz, se aplică contractul Crucii Roșii. Potrivit Curții Supreme, transportul pacienților nu poate fi plătit după contractul pentru taxi. În Setări alege meseria „Serviciul de ambulanță” și contractul tău.", "ambulanta crucea rosie samariter transport pacienti paramedic salvare johanniter malteser"], ["Notiță pentru zi: cine a vrut ziua liberă?", "În Înregistrare notezi la „Notiță pentru zi” tot ce contează. La zilele libere notezi acolo și cine a vrut-o: tu, convenit cu firma sau dispus de firmă. Asta contează mai târziu la timpul liber, concediu sau salariu, iar notițele apar la abateri.", "notita observatie dispus cine a vrut convenit sef dorinta"], ["Ajutor și întrebări pentru dezvoltator", "În Setări, „Ajută (opțional)”, poți permite să raportez anonim în ce meserie ești și cât de mult diferă fluturașul de înregistrări, fără nume, e-mail și sume exacte. Poți permite și să trimit dezvoltatorului întrebările la care nu știu să răspund, ca să învăț. Ambele sunt opționale și se pot opri oricând.", "ajuta anonim statistica sprijin invata dezvoltator"]],
    ru: [["Что умеет приложение", "Stunden-Checker показывает, правильна ли твоя зарплата. Ты вводишь рабочее время, а я считаю сверхурочные, надбавки, суточные и премии по твоему коллективному договору и закону и сравниваю всё с расчётным листком. Расхождения остаются зафиксированными, даже если фирма делает иначе. Кроме того: быстрый ввод текстом, голосом или фото дневного отчёта, чтение расчётного листка с фото или PDF, счёт отпуска и отгулов, сроки удостоверений, планирование «мостов» и отчёты для фирмы в PDF. Есть более 30 отраслей с более чем 150 коллективными договорами для всех федеральных земель, а приложение говорит на 13 языках. Просто спроси меня или нажми тему ниже.", "что умеет приложение всё функции обзор помощь зачем умеешь можешь"], ["Ввод часов", "Открой «Ввод». Введи время начала и конца, добавь перерывы и нажми «Сохранить». Кнопкой «Сейчас» приложение берёт текущее время.", "часы ввести начало конец рабочее время сохранить время день"], ["Добавить премию", "Открой «Настройки», «Мои премии», и добавь свою премию (например, за час, за день или за штуку). Потом вводишь её в нужный день. Приложение её посчитает и сравнит с расчётным листком.", "премия надбавка бонус кран добавить"], ["Проверка расчётного листка", "Открой вкладку «Расчётный листок» и пролистай до «Правильно ли составлен мой расчётный листок?». Перепиши часы и суммы или дай мне прочитать листок с фото или PDF (вверху в «Автоматическое чтение расчётного листка»). Приложение покажет, что совпадает и где остаётся разница в часах или евро. Заполнять все строки не обязательно.", "расчетный листок проверить правильно сравнить зарплата расчет"], ["Сверхурочные и надбавки", "В «Настройках» есть часы в неделю, модель сверхурочных и надбавки. Они берутся из твоего коллективного договора. Правильны ли они, видно на расчётном листке. Их можно изменить в любое время, и с определённой даты.", "сверхурочные надбавка воскресенье суббота праздник ночь переработка"], ["Суточные", "Суточные (Diäten) — это дневная доплата, которую ты получаешь дополнительно. В «Настройках», «Суточные», выбираешь, платят ли их за час или за день по ступеням. Сумму найдёшь на расчётном листке.", "суточные командировочные дневная доплата"], ["Изменить зарплату или профессию", "В «Настройках» можно изменить зарплату или профессию с определённой даты. Старые дни считаются со старыми значениями. Так всё верно и после повышения или смены работы.", "изменить зарплату профессию новая зарплата повышение с даты почасовая ставка"], ["Отпуск или больничный", "Во «Вводе» выбери в «Тип дня», например, «Отпуск», «Больничный» или «Отгул». Тогда время вводить не нужно.", "отпуск больничный отгул выходной тип дня"], ["Мои данные и защита данных", "Твои записи хранятся в телефоне. С аккаунтом они дополнительно сохраняются на защищённом сервере во Франкфурте, чтобы ничего не потерялось. Технически оператор приложения мог бы их увидеть. Шифрование, которое это исключает, готовится. Фото и PDF расчётных листков и дневных отчётов я читаю только в твоём телефоне, они не загружаются. Сохраняются только цифры, которые ты подтвердишь. Твоя фирма ничего из этого не видит.", "данные защита безопасно аккаунт сохранено личное передано"], ["Резервная копия", "В «Настройках» в самом низу есть «Сохранить или поделиться резервной копией». Так сохраняется файл со всеми твоими данными. С ним можно всё восстановить на новом телефоне.", "резервная копия бэкап потерял восстановить новый телефон"], ["Установка приложения", "Открой страницу в браузере и нажми «Установить приложение» (меню справа вверху). Если Android предупреждает, нажми «Всё равно установить». Приложение безопасное, это просто эта веб-страница.", "установить главный экран иконка значок ссылка"], ["Язык и чтение вслух", "Язык приложения выбирается в самом верху страницы. Когда спрашиваешь меня, нажми на микрофон и говори. Кнопкой «Прочитать вслух» я прочитаю ответ. Микрофону нужен интернет и твоё разрешение в браузере.", "язык говорить микрофон диктовать прочитать вслух русский перевод"], ["Успокоить Мию", "Нажми «Успокоить Мию», и я больше не буду появляться сама, только когда ты нажмёшь на меня. Та же кнопка снова меня включает. Фигуру, имя и внешний вид меняешь в «Профиле», «Мой помощник».", "мия мило тихо успокоить мешает выключить"], ["Сроки и удостоверения", "Открой «Профиль» и пролистай до «Обучение, удостоверения и сроки». Добавь Code 95, карту водителя, удостоверение на погрузчик или свои сроки с датой окончания. Я вовремя напомню, а по желанию срок попадёт в календарь телефона.", "срок code 95 карта водителя погрузчик кран окончание удостоверение напоминание курс"], ["Доплата, перерасчёт, особые выплаты", "Если фирма позже что-то доплатила или удержала, внеси это в месячном сравнении в «Доплаты и исправления»: за какой месяц, какая строка и сколько. Приложение отнесёт это к прошлому месяцу. В «Перерасчёт почасовой ставки» оно покажет расчёт и совпадает ли сумма. Отпускные, рождественские, 13-ю и 14-ю зарплату вносишь на вкладке «Расчётный листок» в «Особые выплаты».", "доплата перерасчет исправление рождественские отпускные 13 14 зарплата особые выплаты"], ["Новости", "В «Профиле» есть карточка «Новости». Там включаешь, чтобы Мия рассказывала новости, и выбираешь, как часто: сразу, раз в неделю или раз в месяц. Ты получаешь только то, что подходит к твоей профессии. Хочешь видеть и остальное — включи «Новости и для других профессий».", "новости новинки новая функция сообщение"], ["Неполный день, дополнительная работа и отгул", "Если ты работаешь неполный день и больше договорённого, то до границы полного дня по коллективному договору это дополнительная работа (Mehrarbeit), а не сверхурочные. За неё положена надбавка 25 %, если ты не берёшь эти часы 1:1 отгулом в том же квартале. Приложение считает это само. Твой коллективный договор может регулировать это иначе.", "неполный день дополнительная работа отгул квартал полный день 25"], ["Отпуск по уходу за ребёнком, декрет, папин месяц", "Во «Вводе» выбери в «Тип дня» отпуск по уходу за ребёнком (Karenz), охрану материнства или папин месяц. Эти дни не оплачиваются и не имеют нормы часов. Отпуск по уходу пропорционально уменьшает право на отпуск, охрана материнства — нет.", "отпуск по уходу декрет папин месяц ребенок"], ["Скользящий график", "При скользящем графике (Gleitzeit) приложение считает плюс- и минус-часы на счёте. При настройке выбери «Офис со скользящим графиком» или в «Настройках» модель сверхурочных «Gleitzeit». Там вводишь норму для каждого дня недели, по желанию начальное сальдо и лимит переноса. Выходной за счёт скользящего графика списывает норму со счёта, отпуск и больничный — нет.", "скользящий график gleitzeit счет сальдо плюс минус часы"], ["Нет работы / освобождение", "Во «Вводе» выбери в «Тип дня» «Нет работы (фирма освободила)», если фирма отправила тебя домой из-за отсутствия работы. Заметка ко дню ставится сама. Как фирма засчитывает день, выбираешь в «Настройках» в «Освобождение от работы (нет работы)»: фирма платит дальше, списание с отгулов или без оплаты. Если не знаешь, приложение ничего не списывает. Так и Arbeiterkammer видит основное правило: кто готов работать и отправлен домой, сохраняет зарплату. На расчётном листке видно, верно ли это.", "освобождение нет работы отправили домой нехватка работы"], ["Отгул: 1:1,5 или 1:1?", "Закон о рабочем времени (§ 10) говорит: надбавку за сверхурочные нужно учесть в отгуле или выплатить отдельно. При надбавке 50 % значит либо 1 сверхурочный час = 1,5 часа отгула, либо 1:1, а надбавка идёт в расчётный листок. Твой коллективный договор может регулировать иначе. Укажи это в «Настройках» в «Как фирма засчитывает сверхурочные как отгул?». При взятии отгула он списывается час за час. В Германии законного соотношения нет, действует твой договор.", "отгул 1:1 надбавка сверхурочные соотношение"], ["Где это на расчётном листке?", "Вверху листка обычно твоё имя, фирма, месяц и часто тарифная группа, разряд и коллективный договор (иногда сокращённо «KV»). Почасовую ставку найдёшь в строке «Lohn» или «Stundenlohn», часы рядом в столбце «Menge». Сверхурочные часто в отдельных строках с 50 % или 100 %, отгулы в строке вроде «Zeitausgleich» или «Zeitkonto», отпуск часто как «Resturlaub». Часы в неделю указаны в трудовом договоре. Если чего-то нет, спроси в бюро или в бухгалтерии. Чего не знаешь, оставь в приложении пустым. До тех пор приложение считает по значениям твоего коллективного договора.", "где найти листок коллективный договор расчет"], ["Я ученик", "Как ученик ты получаешь вознаграждение за обучение, обычно фиксированную сумму в месяц по году обучения. В «Настройках» в «Моя профессия» выбери вид «Ученик». Тогда приложение покажет в тарифной группе только годы обучения твоего коллективного договора и кнопкой «Использовать минимальную зарплату по коллективному договору» внесёт сумму. Если в договоре другая сумма, введи её в «Фиксированная месячная зарплата». Профессиональная школа считается рабочим временем: введи день как «Обучение / профшкола», постоянный учебный день каждую неделю — в «Постоянные выходные». До 18 лет действует закон о защите молодёжи, обычно не больше 8 часов в день и 40 в неделю. С вопросами поможет Arbeiterkammer.", "ученик год обучения профшкола вознаграждение обучение договор"], ["Надбавки в строительстве и ремесле", "В строительстве и ремесле на листке часто есть надбавки: за грязь, тяжёлые условия и опасность, суточные или надбавка за удалённость при работе вне базы, ночёвочные и монтажная надбавка. Добавь их в «Настройках», «Мои премии», Мия предложит подходящие. При плохой погоде в строительстве и деревянном строительстве часть зарплаты платит BUAK, приложение ведёт часы плохой погоды отдельно. У маляров при простое из-за погоды платят 60 % зарплаты. Суммы разные по коллективным договорам, сравни их с листком.", "стройка ремесло надбавка плохая погода монтаж тяжелые условия грязь"], ["Уборка, охрана и уход", "В этих профессиях много ночных, воскресных и праздничных смен. Вводи время так, как работал, и через полночь: часы считаются к дню, когда началась смена. Надбавки (например, ночная, на питание, дежурство) есть на листке: добавь их в «Настройках», «Мои премии», Мия предложит подходящие. Если у тебя действует другой коллективный договор (например, земельная больница), выбери «Свои значения».", "уборка охрана безопасность уход ночная смена дежурство"], ["Перевод часов (лето, зима)", "Приложение учитывает перевод часов само. В октябре в 3 часа часы переводят на 2: кто работает в ту ночь, отработал на час больше. Ночная смена с 22 до 6 тогда 9 часов вместо 8. В марте в 2 часа часы переводят на 3: часа не хватает, смена 7 часов вместо 8. Вводи начало и конец так, как показывали часы. Платит ли фирма лишний час, написано в коллективном договоре или соглашении: смотри листок. При расхождении можешь поправить часы в дне.", "перевод часов летнее зимнее время лишний час"], ["Что такое тарифная группа и нужна ли она?", "Тарифная группа (разряд) определяет, какую минимальную зарплату тебе положено по коллективному договору. Знать её не обязательно: просто введи почасовую ставку с листка. Если знаешь, приложение проверит, соответствует ли зарплата коллективному договору. Найдёшь её вверху листка (у «Einstufung», «Lohngruppe» или «Verwendungsgruppe») или в трудовом договоре. Если нигде нет, спроси на фирме.", "тарифная группа разряд нужна категория"], ["Не хватает данных, можно начинать?", "Да, начинай сразу, даже если зарплаты, разряда или чего-то другого ещё нет. Введи то, что есть, например рабочее время. Недостающее дополнишь в «Настройках» в любой момент. Приложение тогда автоматически пересчитает все уже введённые дни. Только сравнение с листком в евро работает после ввода почасовой ставки.", "не хватает данных неполные начать дополнить"], ["Где отзыв для разработчика?", "Внизу слева в приложении есть кнопка «Сообщить о проблеме». Нажми её, в «О чём речь?» выбери, например, «Что-то не так» или «Предложение», напиши сообщение и нажми «Отправить». Приложение прикладывает снимок текущей страницы, это можно выключить. Потом ты увидишь подтверждение. Отзыв для разработчика есть и в «Профиле».", "отзыв сообщить о проблеме ошибка предложение разработчик"], ["Особый отпуск и работа в тот же день", "Во «Вводе» выбери в «Тип дня» особый отпуск (или «Отпуск»). День засчитывается нормой часов. Если ты в этот день всё же работал, введи начало и конец: у дня появится «плюс работа», и твоё рабочее время добавится к оплачиваемым часам. На листке для особого отпуска обычно есть своя строка, приложение сравнивает её отдельно.", "особый отпуск свадьба смерть переезд работа дополнительно"], ["Ожидаемая зарплата брутто и выплата", "В «Обзоре» под часами видна ожидаемая зарплата брутто, посчитанная по твоим записям: зарплата, сверхурочные, премии и дежурства, суточные отдельно. Нетто приложение не показывает, потому что оно зависит от многих вещей, например соцстрахования, налога, семейного бонуса и надбавки за проезд. Если в «Настройках» указать день выплаты, в «Обзоре» будет и дата. Брутто появляется только после окончания месяца, потому что до этого могут не хватать записей.", "брутто нетто выплата день выплаты зарплата заработок сколько деньги"], ["Грузовик в Германии: тариф, суточные и ночь", "В Германии нет единого тарифа: он действует по федеральной земле и только если фирма связана тарифом. Внесены Spedition und Logistik для Северного Рейна-Вестфалии, Баварии, Саксонии и Берлина. Если при настройке выбрать Германию, указываешь землю для праздников. Если фирма не связана тарифом, возьми зарплату и надбавки из трудового договора и выбери «Свои значения». У водителей дальнобоя часто свои договоры. Питание не облагается налогом до 14 € (больше 8 часов) и 28 € (24 часа), плюс 9 € за ночь в грузовике: ночёвку добавь как премию. Ночные надбавки тоже. Всё сравни с расчётом.", "германия экспедиция дальнобой суточные тариф ночь ночевка"], ["Слова на расчётном листке", "Entgeltfortzahlung: фирма продолжает платить зарплату, обычно на больничном. Aufrollung: бухгалтер пересчитывает прошлые месяцы, например после повышения, и доплачивает или удерживает разницу. Rückverrechnung: уже начисленное снова вычитается. Vorschuss: аванс, который вычитается при расчёте. Pfändung: по решению суда фирма удерживает сумму и перечисляет её дальше. Sachbezug: льгота от фирмы, например служебная машина и для личных поездок; добавляется к зарплате как стоимость, но не выплачивается. MA-Vorsorgekasse: фирма платит на твоё выходное пособие, просто следи, чтобы строка была. Коллективный договор на листке часто вообще не указан. Смотри «Tarifgruppe» и «Beschäftigt als» — это твой разряд.", "слова листок entgeltfortzahlung aufrollung vorschuss pfandung sachbezug vorsorgekasse выходное пособие"], ["Проверить нетто калькулятором BMF", "Нетто приложение само не считает. Кнопка открывает калькулятор брутто-нетто австрийского министерства финансов (BMF) в новом окне. Это необязательный модельный расчёт. Введи там брутто сверху и укажи: период ежемесячно, группу взносов как на листке (рабочий или служащий), год, землю места работы, надбавку за проезд и детей как у тебя. Сравни нетто со строкой выплаты на листке. Небольшая разница — это нормально, например из-за суточных, профсоюзного взноса или авансов.", "нетто bmf калькулятор министерство финансов выплата проверить"], ["Быстрый ввод (текст, голос, фото)", "В «Быстром вводе» ты просто пишешь или говоришь, что делал, например «вчера с 6 до 15, перерыв 30 минут, клиент Мюллер выемка грунта». Я делаю из этого записи, ты проверяешь и сохраняешь. Можно также сфотографировать дневной отчёт, и я возьму оттуда время. Функция сначала выключена: включи её в «Настройках», «Помощь при вводе». Потом карточка будет в самом верху «Ввода». Микрофону нужен интернет и твоё разрешение.", "быстрый ввод голосовое сообщение диктовать говорить дневной отчет фото текст"], ["Расчётный листок с фото или PDF", "На вкладке «Расчётный листок» один раз разреши в «Автоматическое чтение расчётного листка», чтобы приложение читало твой листок. Потом нажми «Считать расчётный листок» и выбери фото или PDF. Я читаю его только здесь в телефоне, ничего не загружается. Ты подтверждаешь каждую строку, потом всё попадает в сравнение «Правильно ли составлен мой расчётный листок?». Если я не знаю строку, ты один раз её назначаешь, и я запомню её на следующие месяцы. В «Настройках», «Настройки по расчётному листку», я так же проверяю твои настройки.", "фото снимок pdf скан прочитать листок камера автоматически"], ["Два расчёта: коллективный договор и фирма", "Я всегда считаю дважды: один раз как должно быть по коллективному договору и закону, и один раз как делает твоя фирма, то есть по твоим настройкам. Закон и коллективный договор имеют приоритет. Разницу видно в обзоре и в сравнении с листком. В «Обзоре», «Год и счета», каждое отклонение остаётся в «Зафиксированные отклонения», даже если фирма всегда так делает. Список можно скопировать и показать, например, в Arbeiterkammer. Всё с оговоркой: разница может появиться и из-за ошибки при вводе.", "отклонение разница фирма закон два расчета зафиксировано arbeiterkammer право мало"], ["Коллективный договор и федеральная земля", "В «Настройках», «Моя профессия», выбираешь профессию, а в «Мой коллективный договор» — подходящий договор. Многие коллективные договоры различаются по федеральным землям. Укажи свою землю в «Настройках», «Мои данные», тогда я предложу правильный договор и надбавки твоей земли и скажу, если что-то не сходится. Если не найдёшь свой договор, выбери «Свои значения» и введи зарплату и надбавки из трудового договора.", "федеральная земля коллективный договор какой договор вена тироль штирия каринтия зальцбург"], ["Какие профессии есть?", "Среди прочих: грузовик, экскаватор, малые перевозки, автобус и такси, стройка и ремесло, склад, мастерская, промышленность, пищевая промышленность, торговля, офис, выездные продажи, гастрономия и отель, пекарня, кондитерская, мясная лавка, уборка, охрана, уход и соцработа, скорая помощь, врачебная практика, зубная техника, оптика, парикмахер, косметика, почта, железная дорога, федеральная служба, садоводство и лесное хозяйство, канатные дороги, кино, трубочист, гараж и заправка, прачечная, пластмассы и борьба с вредителями, везде с учениками, где они есть. Если твоей нет, выбери «Другое» и введи свои значения. Напиши мне через «Сообщить о проблеме», какой профессии не хватает.", "профессии какая профессия нет отрасль работа работаю"], ["Отчёт для фирмы (PDF)", "В самом низу «Ввода» есть «Отчёт для фирмы»: выбери день, неделю, полмесяца или месяц и «Создать PDF и отправить» или сохрани. В «Настройках», «Отчёты для фирмы», указываешь имя на отчёте, когда фирма его хочет, e-mail фирмы и печатать ли твою подпись. Тогда я вовремя напомню.", "отчет pdf табель отправить фирма подпись печать месячный недельный"], ["Отпуск, отгулы и сверхурочные в обзоре", "В «Обзоре», «Год и счета», есть учёт часов, карточка отпуска с правом, взятыми днями и остатком отпуска, счёт отгулов и «Сверхурочные в обзоре»: что ты записал, что выплачено и что ушло на счёт. Введи остаток с листка и сразу увидишь, сходится ли. Право на отпуск я считаю от даты поступления в профиле.", "остаток отпуска право карточка отпуска счет отгулов остаток сверхурочные обзор учет часов"], ["Планирование свободных дней (мосты)", "В «Обзоре», «Год и счета», «Планирование свободных дней» покажет лучшие «мосты»: при малом числе дней отпуска или отгулов как можно больше выходных подряд. Суббота и воскресенье считаются свободными. Заранее спроси на работе, работают ли в эти дни.", "мост планировать свободные дни длинные выходные отпуск планирование"], ["Внешний вид Мии: фигура, одежда, цвета, голос", "В «Профиле», «Мой помощник», выбираешь мою фигуру и имя. С «Оформить Мию самому» выбираешь одежду, аксессуары и цвета, например жёлтый или оранжевый светоотражающий жилет. Если выключено, я одеваюсь под твою профессию. Там же указываешь, говорю ли я голосом, а ниже выбираешь иконку приложения.", "внешний вид фигура одежда цвет жилет голос оформить имя мило иконка картинка"], ["Пробный режим", "В «Настройках» есть пробный режим. В нём ты пробуешь другие профессии или настройки, не меняя настоящие данные. Вверху тогда видно красное предупреждение. Кнопкой «Назад к моим данным» возвращаешься, а всё опробованное удаляется.", "пробный режим попробовать тест другая профессия"], ["Клиенты, объекты, транспорт и километры", "В «Настройках», «Что я записываю», включаешь, что ещё хочешь записывать: транспорт и километры, клиентов, объекты и работы или премии. Тогда во «Вводе» появятся нужные поля, например «+ Добавить клиента / объект» со временем по каждому клиенту. В профиле можно указать, чтобы пробег с прошлого раза подставлялся сам.", "клиент клиенты объект работа транспорт километры пробег номер заказ"], ["Предприятие закрыто и постоянные выходные", "Если предприятие закрыто, выбери в «Тип дня» «Предприятие закрыто / корпоративный отпуск». Как фирма это оплачивает, отпуском или из твоих сверхурочных, указываешь в «Настройках», «Предприятие закрыто». Если у тебя каждую неделю в один и тот же день выходной или профшкола, настрой это один раз в «Настройках», «Постоянные выходные». Тогда я буду вносить эти дни за тебя.", "корпоративный отпуск предприятие закрыто фирма закрыта постоянные выходные каждую неделю школа"], ["Аккаунт и несколько устройств", "С аккаунтом (e-mail и пароль) твои данные дополнительно сохраняются на сервере. Если войдёшь на другом телефоне или компьютере, все записи будут и там. Без интернета приложение сохраняет на устройстве и синхронизирует позже. В «Настройках», «Аккаунт», видно, всё ли сохранено, и там можно выйти.", "аккаунт вход выход пароль новый телефон компьютер второе устройство синхронизация"], ["Скорая помощь и перевозка больных", "В Красном Кресте действует коллективный договор Красного Креста, в Samariterbund — договор Samariterbund (BARS), оба по федеральным землям. Для частных фирм скорой помощи и перевозки больных без собственного договора, например Grünes Kreuz, действует договор Красного Креста. По решению Верховного суда перевозку больных нельзя оплачивать по договору для такси. В «Настройках» выбери профессию «Скорая помощь» и свой договор.", "скорая помощь красный крест самаритер перевозка больных санитар спасатель johanniter malteser"], ["Заметка ко дню: кто хотел выходной?", "Во «Вводе» в «Заметка ко дню» записываешь всё важное. Для выходных там же отмечаешь, кто его хотел: ты сам, по договорённости с фирмой или по распоряжению фирмы. Это важно потом при отгулах, отпуске или зарплате, а заметки видны рядом с отклонениями.", "заметка примечание распоряжение кто хотел договоренность начальник желание"], ["Помочь и вопросы разработчику", "В «Настройках», «Помочь (по желанию)», можно разрешить мне анонимно сообщать, в какой ты профессии и насколько листок отличается от записей, без имени, e-mail и точных сумм. Ещё можно разрешить мне отправлять разработчику вопросы, на которые я не могу ответить, чтобы я училась. И то и другое по желанию и выключается в любой момент.", "помочь анонимно статистика поддержка учиться разработчик"]],
    uk: [["Що вміє застосунок", "Stunden-Checker показує, чи правильна твоя зарплата. Ти вводиш робочий час, а я рахую понаднормові, надбавки, добові та премії за твоїм колективним договором і законом і порівнюю все з розрахунковим листком. Розбіжності залишаються зафіксованими, навіть якщо фірма робить інакше. Крім того: швидкий ввід текстом, голосом або фото денного звіту, читання розрахункового листка з фото чи PDF, рахунок відпустки та відгулів, строки посвідчень, планування «містків» і звіти для фірми в PDF. Є понад 30 галузей з понад 150 колективними договорами для всіх федеральних земель, а застосунок говорить 13 мовами. Просто запитай мене або натисни тему нижче.", "що вміє застосунок все функції огляд допомога навіщо вмієш можеш"], ["Введення годин", "Відкрий «Введення». Введи час початку й кінця, додай перерви і натисни «Зберегти». Кнопкою «Зараз» застосунок бере поточний час.", "години ввести початок кінець робочий час зберегти час день"], ["Додати премію", "Відкрий «Налаштування», «Мої премії», і додай свою премію (наприклад, за годину, за день або за штуку). Потім вводиш її в потрібний день. Застосунок її порахує і порівняє з розрахунковим листком.", "премія надбавка бонус кран додати"], ["Перевірка розрахункового листка", "Відкрий вкладку «Розрахунковий листок» і прокрути до «Чи правильний мій розрахунковий листок?». Перепиши години й суми або дай мені прочитати листок з фото чи PDF (угорі в «Автоматичне читання розрахункового листа»). Застосунок покаже, що збігається і де лишається різниця в годинах чи євро. Заповнювати всі рядки не обов'язково.", "розрахунковий листок перевірити правильний порівняти зарплата розрахунок"], ["Понаднормові та надбавки", "У «Налаштуваннях» є години на тиждень, модель понаднормових і надбавки. Вони беруться з твого колективного договору. Чи вони правильні, видно на розрахунковому листку. Їх можна змінити будь-коли, і з певної дати.", "понаднормові надбавка неділя субота свято ніч переробка"], ["Добові", "Добові (Diäten) — це щоденна доплата, яку ти отримуєш додатково. У «Налаштуваннях», «Добові», обираєш, чи платять їх за годину чи за день за ступенями. Суму знайдеш на розрахунковому листку.", "добові відрядні щоденна доплата"], ["Змінити зарплату або професію", "У «Налаштуваннях» можна змінити зарплату або професію з певної дати. Старі дні рахуються зі старими значеннями. Так усе правильно і після підвищення чи зміни роботи.", "змінити зарплату професію нова зарплата підвищення з дати погодинна ставка"], ["Відпустка або лікарняний", "У «Введенні» вибери в «Тип дня», наприклад, «Відпустка», «Лікарняний» або «Відгул». Тоді час вводити не потрібно.", "відпустка лікарняний відгул вихідний тип дня"], ["Мої дані та захист даних", "Твої записи зберігаються в телефоні. З акаунтом вони додатково зберігаються на захищеному сервері у Франкфурті, щоб нічого не загубилося. Технічно оператор застосунку міг би їх побачити. Шифрування, яке це виключає, готується. Фото й PDF розрахункових листків і денних звітів я читаю лише у твоєму телефоні, вони не завантажуються. Зберігаються лише цифри, які ти підтвердиш. Твоя фірма нічого з цього не бачить.", "дані захист безпечно акаунт збережено особисте передано"], ["Резервна копія", "У «Налаштуваннях» у самому низу є «Зберегти або поділитися резервною копією». Так зберігається файл з усіма твоїми даними. З ним можна все відновити на новому телефоні.", "резервна копія бекап загубив відновити новий телефон"], ["Встановлення застосунку", "Відкрий сторінку в браузері й натисни «Встановити застосунок» (меню вгорі праворуч). Якщо Android попереджає, натисни «Усе одно встановити». Застосунок безпечний, це просто ця вебсторінка.", "встановити головний екран іконка значок посилання"], ["Мова і читання вголос", "Мову застосунку обираєш у самому верху сторінки. Коли питаєш мене, натисни мікрофон і говори. Кнопкою «Прочитати вголос» я прочитаю відповідь. Мікрофону потрібен інтернет і твій дозвіл у браузері.", "мова говорити мікрофон диктувати прочитати вголос українська переклад"], ["Заспокоїти Мію", "Натисни «Заспокоїти Мію», і я більше не з'являтимусь сама, лише коли ти натиснеш на мене. Та сама кнопка знову мене вмикає. Фігуру, ім'я та вигляд змінюєш у «Профілі», «Мій помічник».", "мія міло тихо заспокоїти заважає вимкнути"], ["Строки та посвідчення", "Відкрий «Профіль» і прокрути до «Навчання, посвідчення та терміни». Додай Code 95, карту водія, посвідчення на навантажувач або власні строки з датою закінчення. Я вчасно нагадаю, а за бажанням строк потрапить у календар телефона.", "строк code 95 карта водія навантажувач кран закінчення посвідчення нагадування курс"], ["Доплата, перерахунок, особливі виплати", "Якщо фірма пізніше щось доплатила або утримала, внеси це в місячному порівнянні в «Доплати та виправлення»: за який місяць, який рядок і скільки. Застосунок віднесе це до минулого місяця. У «Перерахунок погодинної ставки» він покаже розрахунок і чи збігається сума. Відпускні, різдвяні, 13-ту і 14-ту зарплату вносиш на вкладці «Розрахунковий листок» в «Особливі виплати».", "доплата перерахунок виправлення різдвяні відпускні 13 14 зарплата особливі виплати"], ["Новини", "У «Профілі» є картка «Новини». Там вмикаєш, щоб Мія розповідала новини, і обираєш, як часто: одразу, щотижня чи щомісяця. Ти отримуєш лише те, що підходить до твоєї професії. Хочеш бачити й інше — увімкни «Новини і для інших професій».", "новини новинки нова функція повідомлення"], ["Неповний день, додаткова робота і відгул", "Якщо ти працюєш неповний день і більше домовленого, то до межі повного дня за колективним договором це додаткова робота (Mehrarbeit), а не понаднормові. За неї належить надбавка 25 %, якщо ти не береш ці години 1:1 відгулом у тому ж кварталі. Застосунок рахує це сам. Твій колективний договір може регулювати це інакше.", "неповний день додаткова робота відгул квартал повний день 25"], ["Відпустка по догляду за дитиною, декрет, татів місяць", "У «Введенні» вибери в «Тип дня» відпустку по догляду за дитиною (Karenz), охорону материнства або татів місяць. Ці дні не оплачуються і не мають норми годин. Відпустка по догляду пропорційно зменшує право на відпустку, охорона материнства — ні.", "відпустка по догляду декрет татів місяць дитина"], ["Гнучкий графік", "При гнучкому графіку (Gleitzeit) застосунок рахує плюс- і мінус-години на рахунку. Під час налаштування вибери «Офіс із гнучким графіком» або в «Налаштуваннях» модель понаднормових «Gleitzeit». Там вводиш норму для кожного дня тижня, за бажанням початкове сальдо і ліміт перенесення. Вихідний за рахунок гнучкого графіка списує норму з рахунку, відпустка й лікарняний — ні.", "гнучкий графік gleitzeit рахунок сальдо плюс мінус години"], ["Немає роботи / звільнення від роботи", "У «Введенні» вибери в «Тип дня» «Немає роботи (фірма звільнила)», якщо фірма відправила тебе додому через брак роботи. Нотатка до дня ставиться сама. Як фірма зараховує день, обираєш у «Налаштуваннях» у «Звільнення від роботи (немає роботи)»: фірма платить далі, списання з відгулів або без оплати. Якщо не знаєш, застосунок нічого не списує. Так і Arbeiterkammer бачить основне правило: хто готовий працювати і відправлений додому, зберігає зарплату. На розрахунковому листку видно, чи це правильно.", "звільнення немає роботи відправили додому брак роботи"], ["Відгул: 1:1,5 чи 1:1?", "Закон про робочий час (§ 10) каже: надбавку за понаднормові треба врахувати у відгулі або виплатити окремо. При надбавці 50 % отже або 1 понаднормова година = 1,5 години відгулу, або 1:1, а надбавка йде в розрахунковий листок. Твій колективний договір може регулювати інакше. Вкажи це в «Налаштуваннях» у «Як фірма зараховує понаднормові як відгул?». Коли береш відгул, він списується година за годину. У Німеччині законного співвідношення немає, діє твій договір.", "відгул 1:1 надбавка понаднормові співвідношення"], ["Де це на розрахунковому листку?", "Угорі листка зазвичай твоє ім'я, фірма, місяць і часто тарифна група, розряд і колективний договір (іноді скорочено «KV»). Погодинну ставку знайдеш у рядку «Lohn» або «Stundenlohn», години поруч у стовпці «Menge». Понаднормові часто в окремих рядках з 50 % чи 100 %, відгули в рядку на кшталт «Zeitausgleich» або «Zeitkonto», відпустка часто як «Resturlaub». Години на тиждень вказані в трудовому договорі. Якщо чогось немає, спитай в офісі або в бухгалтерії. Чого не знаєш, залиш у застосунку порожнім. До того часу застосунок рахує за значеннями твого колективного договору.", "де знайти листок колективний договір розрахунок"], ["Я учень", "Як учень ти отримуєш винагороду за навчання, зазвичай фіксовану суму на місяць за роком навчання. У «Налаштуваннях» у «Моя професія» вибери вид «Учень». Тоді застосунок покаже в тарифній групі лише роки навчання твого колективного договору і кнопкою «Використати мінімальну зарплату за колективним договором» внесе суму. Якщо в договорі інша сума, введи її в «Фіксована місячна зарплата». Професійна школа рахується робочим часом: введи день як «Навчання / профшкола», постійний навчальний день щотижня — у «Постійні вихідні». До 18 років діє закон про захист молоді, зазвичай не більше 8 годин на день і 40 на тиждень. З питаннями допоможе Arbeiterkammer.", "учень рік навчання профшкола винагорода навчання договір"], ["Надбавки в будівництві та ремеслі", "У будівництві та ремеслі на листку часто є надбавки: за бруд, важкі умови й небезпеку, добові або надбавка за віддаленість при роботі поза базою, нічліжні та монтажна надбавка. Додай їх у «Налаштуваннях», «Мої премії», Мія запропонує відповідні. При поганій погоді в будівництві й дерев'яному будівництві частину зарплати платить BUAK, застосунок веде години поганої погоди окремо. У малярів при простої через погоду платять 60 % зарплати. Суми різні за колективними договорами, порівняй їх із листком.", "будівництво ремесло надбавка погана погода монтаж важкі умови бруд"], ["Прибирання, охорона і догляд", "У цих професіях багато нічних, недільних і святкових змін. Вводь час так, як працював, і через північ: години рахуються до дня, коли почалася зміна. Надбавки (наприклад, нічна, на харчування, чергування) є на листку: додай їх у «Налаштуваннях», «Мої премії», Мія запропонує відповідні. Якщо в тебе діє інший колективний договір (наприклад, земельна лікарня), вибери «Власні значення».", "прибирання охорона безпека догляд нічна зміна чергування"], ["Переведення годинника (літо, зима)", "Застосунок враховує переведення годинника сам. У жовтні о 3 годині годинник переводять на 2: хто працює тієї ночі, відпрацював на годину більше. Нічна зміна з 22 до 6 тоді 9 годин замість 8. У березні о 2 годині годинник переводять на 3: години бракує, зміна 7 годин замість 8. Вводь початок і кінець так, як показував годинник. Чи платить фірма зайву годину, написано в колективному договорі або угоді: дивись листок. При розбіжності можеш поправити години в дні.", "переведення годинника літній зимовий час зайва година"], ["Що таке тарифна група і чи вона потрібна?", "Тарифна група (розряд) визначає, яка мінімальна зарплата тобі належить за колективним договором. Знати її не обов'язково: просто введи погодинну ставку з листка. Якщо знаєш, застосунок перевірить, чи відповідає зарплата колективному договору. Знайдеш її вгорі листка (біля «Einstufung», «Lohngruppe» чи «Verwendungsgruppe») або в трудовому договорі. Якщо ніде немає, спитай на фірмі.", "тарифна група розряд потрібна категорія"], ["Бракує даних, можна починати?", "Так, починай одразу, навіть якщо зарплати, розряду чи чогось іншого ще немає. Введи те, що є, наприклад робочий час. Відсутнє доповниш у «Налаштуваннях» будь-коли. Застосунок тоді автоматично перерахує всі вже введені дні. Лише порівняння з листком у євро працює після введення погодинної ставки.", "бракує даних неповні почати доповнити"], ["Де відгук для розробника?", "Унизу ліворуч у застосунку є кнопка «Повідомити про проблему». Натисни її, у «Про що йдеться?» вибери, наприклад, «Щось не так» або «Пропозиція», напиши повідомлення і натисни «Надіслати». Застосунок додає знімок поточної сторінки, це можна вимкнути. Потім побачиш підтвердження. Відгук для розробника є і в «Профілі».", "відгук повідомити про проблему помилка пропозиція розробник"], ["Особлива відпустка і робота того ж дня", "У «Введенні» вибери в «Тип дня» особливу відпустку (або «Відпустка»). День зараховується нормою годин. Якщо ти того дня все ж працював, введи початок і кінець: біля дня з'явиться «плюс робота», і твій робочий час додасться до оплачуваних годин. На листку для особливої відпустки зазвичай є свій рядок, застосунок порівнює його окремо.", "особлива відпустка весілля смерть переїзд робота додатково"], ["Очікувана зарплата брутто і виплата", "В «Огляді» під годинами видно очікувану зарплату брутто, пораховану за твоїми записами: зарплата, понаднормові, премії та чергування, добові окремо. Нетто застосунок не показує, бо воно залежить від багатьох речей, наприклад соцстрахування, податку, сімейного бонусу і доплати за проїзд. Якщо в «Налаштуваннях» вказати день виплати, в «Огляді» буде й дата. Брутто з'являється лише після закінчення місяця, бо до того можуть бракувати записи.", "брутто нетто виплата день виплати зарплата заробіток скільки гроші"], ["Вантажівка в Німеччині: тариф, добові й ніч", "У Німеччині немає єдиного тарифу: він діє за федеральною землею і лише якщо фірма пов'язана тарифом. Внесено Spedition und Logistik для Північного Рейну-Вестфалії, Баварії, Саксонії та Берліна. Якщо під час налаштування вибрати Німеччину, вказуєш землю для свят. Якщо фірма не пов'язана тарифом, візьми зарплату й надбавки з трудового договору і вибери «Власні значення». У водіїв далекобою часто свої договори. Харчування не оподатковується до 14 € (понад 8 годин) і 28 € (24 години), плюс 9 € за ніч у вантажівці: ночівлю додай як премію. Нічні надбавки теж. Усе порівняй із розрахунком.", "німеччина експедиція далекобій добові тариф ніч ночівля"], ["Слова на розрахунковому листку", "Entgeltfortzahlung: фірма далі платить зарплату, зазвичай на лікарняному. Aufrollung: бухгалтер перераховує минулі місяці, наприклад після підвищення, і доплачує чи утримує різницю. Rückverrechnung: уже нараховане знову віднімається. Vorschuss: аванс, який віднімається при розрахунку. Pfändung: за рішенням суду фірма утримує суму і перераховує її далі. Sachbezug: пільга від фірми, наприклад службова машина й для особистих поїздок; додається до зарплати як вартість, але не виплачується. MA-Vorsorgekasse: фірма платить на твою вихідну допомогу, просто стеж, щоб рядок був. Колективний договір на листку часто взагалі не вказаний. Дивись «Tarifgruppe» і «Beschäftigt als» — це твій розряд.", "слова листок entgeltfortzahlung aufrollung vorschuss pfandung sachbezug vorsorgekasse вихідна допомога"], ["Перевірити нетто калькулятором BMF", "Нетто застосунок сам не рахує. Кнопка відкриває калькулятор брутто-нетто австрійського міністерства фінансів (BMF) у новому вікні. Це необов'язковий модельний розрахунок. Введи там брутто згори і вкажи: період щомісяця, групу внесків як на листку (робітник чи службовець), рік, землю місця роботи, доплату за проїзд і дітей як у тебе. Порівняй нетто з рядком виплати на листку. Невелика різниця — це нормально, наприклад через добові, профспілковий внесок або аванси.", "нетто bmf калькулятор міністерство фінансів виплата перевірити"], ["Швидкий ввід (текст, голос, фото)", "У «Швидкому вводі» ти просто пишеш або кажеш, що робив, наприклад «вчора з 6 до 15, перерва 30 хвилин, клієнт Мюллер виїмка ґрунту». Я роблю з цього записи, ти перевіряєш і зберігаєш. Можна також сфотографувати денний звіт, і я візьму звідти час. Функція спочатку вимкнена: увімкни її в «Налаштуваннях», «Допомога під час вводу». Потім картка буде в самому верху «Введення». Мікрофону потрібен інтернет і твій дозвіл.", "швидкий ввід голосове повідомлення диктувати говорити денний звіт фото текст"], ["Розрахунковий листок з фото або PDF", "На вкладці «Розрахунковий листок» один раз дозволь в «Автоматичне читання розрахункового листа», щоб застосунок читав твій листок. Потім натисни «Читати розрахунковий лист» і вибери фото або PDF. Я читаю його лише тут у телефоні, нічого не завантажується. Ти підтверджуєш кожен рядок, потім усе потрапляє в порівняння «Чи правильний мій розрахунковий листок?». Якщо я не знаю рядка, ти один раз його призначаєш, і я запам'ятаю його на наступні місяці. У «Налаштуваннях», «Налаштування за розрахунковим листком», я так само перевіряю твої налаштування.", "фото знімок pdf скан прочитати листок камера автоматично"], ["Два розрахунки: колективний договір і фірма", "Я завжди рахую двічі: один раз як має бути за колективним договором і законом, і один раз як робить твоя фірма, тобто за твоїми налаштуваннями. Закон і колективний договір мають пріоритет. Різницю видно в огляді та в порівнянні з листком. В «Огляді», «Рік і рахунки», кожне відхилення лишається в «Зафіксовані відхилення», навіть якщо фірма завжди так робить. Список можна скопіювати й показати, наприклад, в Arbeiterkammer. Усе із застереженням: різниця може з'явитися і через помилку під час введення.", "відхилення різниця фірма закон два розрахунки зафіксовано arbeiterkammer право мало"], ["Колективний договір і федеральна земля", "У «Налаштуваннях», «Моя професія», обираєш професію, а в «Мій колективний договір» — відповідний договір. Багато колективних договорів різняться за федеральними землями. Вкажи свою землю в «Налаштуваннях», «Мої дані», тоді я запропоную правильний договір і надбавки твоєї землі й скажу, якщо щось не сходиться. Якщо не знайдеш свій договір, вибери «Власні значення» і введи зарплату й надбавки з трудового договору.", "федеральна земля колективний договір який договір відень тіроль штирія каринтія зальцбург"], ["Які професії є?", "Серед інших: вантажівка, екскаватор, малі перевезення, автобус і таксі, будівництво і ремесло, склад, майстерня, промисловість, харчова промисловість, торгівля, офіс, виїзні продажі, гастрономія і готель, пекарня, кондитерська, м'ясна крамниця, прибирання, охорона, догляд і соцробота, швидка допомога, лікарська практика, зубна техніка, оптика, перукар, косметика, пошта, залізниця, федеральна служба, садівництво і лісове господарство, канатні дороги, кіно, сажотрус, гараж і заправка, пральня, пластмаси й боротьба зі шкідниками, скрізь з учнями, де вони є. Якщо твоєї немає, вибери «Інше» і введи власні значення. Напиши мені через «Повідомити про проблему», якої професії бракує.", "професії яка професія немає галузь робота працюю"], ["Звіт для фірми (PDF)", "У самому низу «Введення» є «Звіт для фірми»: вибери день, тиждень, пів місяця або місяць і «Створити PDF і надіслати» або збережи. У «Налаштуваннях», «Звіти для фірми», вказуєш ім'я на звіті, коли фірма його хоче, e-mail фірми і чи друкувати твій підпис. Тоді я вчасно нагадаю.", "звіт pdf табель надіслати фірма підпис друк місячний тижневий"], ["Відпустка, відгули й понаднормові в огляді", "В «Огляді», «Рік і рахунки», є облік годин, картка відпустки з правом, взятими днями й залишком відпустки, рахунок відгулів і «Понаднормові в огляді»: що ти записав, що виплачено і що пішло на рахунок. Введи залишок з листка і одразу побачиш, чи сходиться. Право на відпустку я рахую від дати прийому в профілі.", "залишок відпустки право картка відпустки рахунок відгулів залишок понаднормові огляд облік годин"], ["Планування вільних днів (містки)", "В «Огляді», «Рік і рахунки», «Планування вільних днів» покаже найкращі «містки»: при малій кількості днів відпустки чи відгулів якомога більше вихідних поспіль. Субота й неділя вважаються вільними. Заздалегідь спитай на роботі, чи працюють у ці дні.", "місток планувати вільні дні довгі вихідні відпустка планування"], ["Вигляд Мії: фігура, одяг, кольори, голос", "У «Профілі», «Мій помічник», обираєш мою фігуру та ім'я. З «Оформити Мію самому» обираєш одяг, аксесуари й кольори, наприклад жовтий або помаранчевий світловідбивний жилет. Якщо вимкнено, я вдягаюся під твою професію. Там же вказуєш, чи говорю я голосом, а нижче обираєш іконку застосунку.", "вигляд фігура одяг колір жилет голос оформити ім'я міло іконка картинка"], ["Пробний режим", "У «Налаштуваннях» є пробний режим. У ньому ти пробуєш інші професії чи налаштування, не змінюючи справжніх даних. Угорі тоді видно червоне попередження. Кнопкою «Назад до моїх даних» повертаєшся, а все випробуване видаляється.", "пробний режим спробувати тест інша професія"], ["Клієнти, об'єкти, транспорт і кілометри", "У «Налаштуваннях», «Що я записую», вмикаєш, що ще хочеш записувати: транспорт і кілометри, клієнтів, об'єкти й роботи або премії. Тоді у «Введенні» з'являться потрібні поля, наприклад «+ Додати клієнта / об'єкт» із часом на кожного клієнта. У профілі можна вказати, щоб пробіг з минулого разу підставлявся сам.", "клієнт клієнти об'єкт робота транспорт кілометри пробіг номер замовлення"], ["Підприємство закрите і постійні вихідні", "Якщо підприємство закрите, вибери в «Тип дня» «Підприємство закрите / корпоративна відпустка». Як фірма це оплачує, відпусткою чи з твоїх понаднормових, вказуєш у «Налаштуваннях», «Підприємство закрите». Якщо в тебе щотижня в той самий день вихідний або профшкола, налаштуй це один раз у «Налаштуваннях», «Постійні вихідні». Тоді я вноситиму ці дні за тебе.", "корпоративна відпустка підприємство закрите фірма закрита постійні вихідні щотижня школа"], ["Акаунт і кілька пристроїв", "З акаунтом (e-mail і пароль) твої дані додатково зберігаються на сервері. Якщо увійдеш на іншому телефоні чи комп'ютері, всі записи будуть і там. Без інтернету застосунок зберігає на пристрої й синхронізує пізніше. У «Налаштуваннях», «Акаунт», видно, чи все збережено, і там можна вийти.", "акаунт вхід вихід пароль новий телефон комп'ютер другий пристрій синхронізація"], ["Швидка допомога і перевезення хворих", "У Червоному Хресті діє колективний договір Червоного Хреста, у Samariterbund — договір Samariterbund (BARS), обидва за федеральними землями. Для приватних фірм швидкої допомоги та перевезення хворих без власного договору, наприклад Grünes Kreuz, діє договір Червоного Хреста. За рішенням Верховного суду перевезення хворих не можна оплачувати за договором для таксі. У «Налаштуваннях» вибери професію «Швидка допомога» і свій договір.", "швидка допомога червоний хрест самаритер перевезення хворих санітар рятувальник johanniter malteser"], ["Нотатка до дня: хто хотів вихідний?", "У «Введенні» в «Нотатка до дня» записуєш усе важливе. Для вихідних там же позначаєш, хто його хотів: ти сам, за домовленістю з фірмою чи за розпорядженням фірми. Це важливо потім при відгулах, відпустці чи зарплаті, а нотатки видно поруч із відхиленнями.", "нотатка примітка розпорядження хто хотів домовленість начальник бажання"], ["Допомогти і питання розробнику", "У «Налаштуваннях», «Допомогти (необов'язково)», можна дозволити мені анонімно повідомляти, в якій ти професії і наскільки листок відрізняється від записів, без імені, e-mail і точних сум. Ще можна дозволити мені надсилати розробнику питання, на які я не можу відповісти, щоб я вчилася. І те, і інше необов'язкове та вимикається будь-коли.", "допомогти анонімно статистика підтримка вчитися розробник"]]
  };
  function miaLang() { return uiLang(); }
  /* ---- Mia beantwortet Fragen (feste Antworten, kein Server) + Spracheingabe + Vorlesen ---- */
  var MIA_FAQ = [
    {"t": "Was die App kann", "k": ["was kann", "kann die app", "app alles", "funktionen", "leistet", "wofuer", "wozu", "nutzen der app", "was ist das"], "a": "Der Stunden-Checker zeigt dir, ob dein Lohn stimmt. Du trägst deine Arbeitszeit ein, ich rechne Überstunden, Zuschläge, Diäten und Prämien nach deinem Kollektivvertrag und dem Gesetz und vergleiche alles mit deinem Lohnzettel. Unterschiede bleiben festgehalten, auch wenn die Firma es anders handhabt. Dazu kommen: Schnell erfassen mit Text, Sprache oder Foto vom Tagesbericht, Lohnzettel per Foto oder PDF einlesen, Urlaubs- und Zeitausgleich-Konto, Fristen für Ausweise, Brückentage planen und Berichte für die Firma als PDF. Es gibt über 30 Berufsbereiche mit mehr als 150 Kollektivverträgen für alle Bundesländer, und die App spricht 13 Sprachen. Frag mich einfach oder tippe unten auf ein Thema."},
    {"t": "Stunden eintragen", "k": ["eintrag", "stunden", "beginn", "ende", "arbeitszeit", "tag speichern", "erfassen", "zeit"], "a": "Öffne Erfassen. Tippe bei Beginn und Ende die Uhrzeit ein, trage die Pausen ein und tippe auf Speichern. Mit \"Jetzt\" nimmt die App die aktuelle Uhrzeit."},
    {"t": "Prämie anlegen", "k": ["prämie", "praemie", "zulage", "bonus", "kran", "anlegen"], "a": "Gehe zu Einstellungen, dann Prämien, und lege deine Prämie an (zum Beispiel pro Stunde, pro Tag oder pro Stück). Danach trägst du sie im Tag ein. Die App rechnet sie aus und vergleicht sie mit dem Lohnzettel."},
    {"t": "Lohnzettel prüfen", "k": ["lohnzettel", "abrechnung", "prüfen", "pruefen", "stimmt", "vergleich", "abgleich", "kontrol"], "a": "Öffne den Reiter Lohnzettel und scrolle zu „Stimmt mein Lohnzettel?“. Tippe die Stunden und Beträge ab oder lass mich den Lohnzettel per Foto oder PDF lesen (oben bei „Lohnzettel automatisch lesen“). Die App zeigt dir, was gleich ist und wo ein Unterschied in Stunden oder Euro bleibt. Du musst nicht alle Zeilen ausfüllen."},
    {"t": "Überstunden und Zuschläge", "k": ["überstunden", "ueberstunden", "zuschlag", "sonntag", "samstag", "feiertag", "nacht", "mehrarbeit"], "a": "Unter Einstellungen stehen Wochenstunden, Überstundenmodell und Zuschläge. Sie kommen aus deinem Kollektivvertrag. Ob sie stimmen, siehst du auf deinem Lohnzettel. Du kannst sie jederzeit ändern, auch ab einem Datum."},
    {"t": "Diäten / Taggeld", "k": ["diäten", "diaeten", "taggeld", "spesen", "tagesgeld"], "a": "Diäten sind das Taggeld, das du zusätzlich bekommst. Unter Einstellungen, Diäten, stellst du ein, ob es pro Stunde oder pro Tag nach Stufen gezahlt wird. Den Betrag findest du auf deinem Lohnzettel."},
    {"t": "Lohn oder Beruf ändern", "k": ["lohn ändern", "lohn aendern", "beruf", "wechsel", "neuer lohn", "erhöhung", "erhoehung", "ab datum", "stundenlohn"], "a": "Unter Einstellungen kannst du den Lohn oder den Beruf ab einem Datum ändern. Alte Tage bleiben mit den alten Werten gerechnet. So passt es auch nach einer Lohnerhöhung oder einem Jobwechsel."},
    {"t": "Urlaub oder Krankenstand", "k": ["urlaub", "krank", "zeitausgleich", "feiertag", "frei", "art des tages"], "a": "Wähle in Erfassen bei \"Art des Tages\" zum Beispiel Urlaub, Krankenstand oder Zeitausgleich. Dann musst du keine Uhrzeiten eintragen."},
    {"t": "Meine Daten und Datenschutz", "k": ["daten", "datenschutz", "sicher", "konto", "speicher", "weitergegeben", "privat"], "a": "Deine Einträge liegen auf deinem Handy. Mit deinem Konto werden sie zusätzlich auf einem gesicherten Server in Frankfurt gespeichert, damit nichts verloren geht. Technisch könnte der Betreiber der App sie einsehen. Eine Verschlüsselung, die das ausschließt, ist in Arbeit. Fotos und PDF-Dateien von Lohnzettel und Tagesbericht lese ich nur auf deinem Handy, sie werden nicht hochgeladen. Gespeichert werden nur die Zahlen, die du bestätigst. Deine Firma sieht nichts davon."},
    {"t": "Sicherung", "k": ["sicherung", "backup", "verloren", "wiederherstellen", "handy wechsel"], "a": "Unter Einstellungen findest du ganz unten \"Sicherung speichern oder teilen\". Das speichert eine Datei mit allen deinen Daten. Damit kannst du alles auf einem neuen Handy wiederherstellen."},
    {"t": "App installieren", "k": ["installier", "startbildschirm", "icon", "symbol", "link"], "a": "Öffne die Seite im Browser und tippe auf \"App installieren\" (Menü oben rechts). Falls Android warnt, tippe auf \"Trotzdem installieren\". Die App ist ungefährlich, sie ist nur diese Webseite."},
    {"t": "Sprache und Vorlesen", "k": ["sprache", "sprechen", "mikrofon", "diktier", "vorlesen", "deutsch", "uebersetz"], "a": "Die Sprache der App wählst du ganz oben auf der Seite. Bei deiner Frage an mich tippst du auf das Mikrofon und sprichst. Mit „Vorlesen“ lese ich dir meine Antwort vor. Das Mikrofon braucht Internet und deine Erlaubnis im Browser."},
    {"t": "Mia ruhig stellen", "k": ["mia ruhig", "milo ruhig", "ruhig stellen", "nervt", "mia ausschalten", "leise", "meldet sich dauernd"], "a": "Tippe auf „Mia ruhig stellen“, dann melde ich mich nicht mehr von selbst, nur noch, wenn du mich antippst. Mit „Mia wieder aktiv stellen“ an der gleichen Stelle bin ich wieder da. Figur, Namen und Aussehen änderst du unter Profil, „Mein Begleiter“."},
    {"t": "Fristen und Ausweise", "k": ["frist", "code 95", "code95", "fahrerkarte", "staplerschein", "kranschein", "ablauf", "ausweis", "erinnerung", "schulung", "kurs"], "a": "Öffne Profil und scrolle zu \"Fristen und Ausweise\". Lege Code 95, Fahrerkarte, Staplerschein oder eigene Fristen mit Ablaufdatum an. Ich erinnere dich rechtzeitig, und der Termin kommt auf Wunsch in den Kalender deines Handys."},
    {"t": "Nachzahlung, Aufrollung, Sonderzahlungen", "k": ["nachzahlung", "nachzahlen", "aufroll", "rückverrechnung", "rueckverrechnung", "korrektur", "weihnachtsgeld", "urlaubszuschuss", "urlaubsgeld", "sonderzahlung", "13.", "14.", "remuneration", "stundenlohn"], "a": "Hat die Firma später etwas nachgezahlt oder zurückverrechnet, trägst du es im Monatsabgleich bei „Nachzahlungen und Korrekturen“ ein: für welchen Monat, welche Zeile und wie viel. Die App rechnet es dem früheren Monat zu. Bei „Stundenlohn aufgerollt“ zeigt sie dir den Rechengang und ob der Betrag passt. Urlaubszuschuss, Weihnachtsgeld, 13. und 14. Gehalt trägst du im Reiter „Lohnzettel“ bei „Sonderzahlungen“ ein."},
    {"t": "Neuigkeiten", "k": ["neuigkeit", "neuigkeiten", "news", "neue funktion", "mitteilung"], "a": "Unter Profil findest du die Karte \"Neuigkeiten\". Dort schaltest du ein, dass Mia dir Neuigkeiten sagt, und stellst ein, wie oft: sofort, wöchentlich oder monatlich. Du bekommst nur, was zu deinem Beruf passt. Willst du auch alles andere sehen, schalte \"Auch Neuigkeiten für andere Berufe\" ein."},
    {"t": "Teilzeit, Mehrarbeit und Zeitausgleich", "k": ["teilzeit", "mehrarbeit", "zeitausgleich", "quartal", "vollzeit", "25"], "a": "Arbeitest du Teilzeit und mehr als vereinbart, ist das bis zur Vollzeit-Grenze deines Kollektivvertrags Mehrarbeit und keine Überstunde. Dafür gibt es 25 % Zuschlag, außer du nimmst die Stunden im selben Kalendervierteljahr 1:1 als Zeitausgleich. Die App rechnet das automatisch. Dein Kollektivvertrag kann es anders regeln."},
    {"t": "Karenz, Mutterschutz, Papamonat", "k": ["karenz", "mutterschutz", "papamonat", "baby", "elternzeit", "mutter"], "a": "Wähle in Erfassen bei \"Art des Tages\" Karenz, Mutterschutz oder Papamonat. Diese Tage sind unbezahlt und haben keine Sollstunden. Die Karenz kürzt deinen Urlaubsanspruch anteilig, der Mutterschutz nicht."},
    {"t": "Gleitzeit", "k": ["gleitzeit", "gleittag", "gleitzeitkonto", "saldo", "plusstunden", "minusstunden", "kernzeit"], "a": "Bei Gleitzeit zählt die App Plus- und Minusstunden auf einem Gleitzeitkonto. Wähle beim Einrichten „Büro mit Gleitzeit“ oder in Einstellungen das Überstunden-Modell „Gleitzeit“. Dort trägst du die Sollzeit je Wochentag ein, optional Startsaldo und Übertragungsgrenze. Ein Gleittag (Zeitausgleich) zieht die Sollzeit vom Konto ab, Urlaub und Krankenstand nicht."},
    {"t": "Keine Arbeit / Freistellung", "k": ["freistellung", "freigestellt", "keine arbeit", "heimgeschickt", "nach hause", "auftragsmangel", "zeitausgleich geschickt"], "a": "Wähle in Erfassen bei \"Art des Tages\" „Keine Arbeit (von der Firma freigestellt)“, wenn dich die Firma wegen fehlender Arbeit heimschickt. Die Notiz zum Tag setzt sich automatisch. Wie die Firma den Tag verrechnet, stellst du in den Einstellungen unter „Freistellung (keine Arbeit)“ ein: Firma zahlt weiter, Abzug vom Zeitausgleich oder unbezahlt. Weißt du es nicht, zieht die App nichts ab. So sieht es auch die AK als Grundregel: Wer arbeitsbereit ist und heimgeschickt wird, behält den Lohn. Auf deinem Lohnzettel siehst du, ob es stimmt."},
    {"t": "Zeitausgleich: 1:1,5 oder 1:1?", "k": ["zeitausgleich", "zeitausgleich 1:1", "überstundenzuschlag", "ueberstundenzuschlag", "1:1,5", "1,5", "freizeitausgleich", "zuschlag", "verhältnis", "verhaeltnis"], "a": "Das Arbeitszeitgesetz (§ 10) sagt: Der Überstundenzuschlag ist beim Zeitausgleich zu berücksichtigen oder gesondert auszuzahlen. Bei 50 % Zuschlag also entweder 1 Überstunde = 1,5 Stunden Zeitausgleich oder 1:1 und der Zuschlag kommt auf den Lohnzettel. Dein Kollektivvertrag kann es anders regeln. Stell es in Einstellungen unter „Wie schreibt deine Firma Überstunden als Zeitausgleich gut?“ ein. Beim Freinehmen wird der Zeitausgleich Stunde für Stunde abgezogen. In Deutschland gibt es kein gesetzliches Verhältnis, es gilt dein Vertrag."},
    {"t": "Wo finde ich das auf dem Lohnzettel?", "k": ["lohnzettel", "wo finde", "wo steht", "einstufung", "lohngruppe", "kollektivvertrag", "kv", "abrechnung", "gehaltszettel", "finde ich"], "a": "Oben auf dem Lohnzettel stehen meist dein Name, die Firma, der Monat und oft Einstufung, Lohngruppe und Kollektivvertrag (manchmal mit „KV“ abgekürzt). Den Stundenlohn findest du in der Zeile „Lohn“ oder „Stundenlohn“, die Stunden daneben in der Spalte „Menge“. Überstunden stehen oft in eigenen Zeilen mit 50 % oder 100 %, Zeitausgleich in einer Zeile wie „Zeitausgleich“ oder „Zeitkonto“, der Urlaub oft als „Resturlaub“. Die Wochenstunden stehen im Dienstvertrag. Steht etwas nicht drauf, frag im Büro oder in der Lohnverrechnung. Weißt du etwas nicht, lass das Feld in der App leer. Bis dahin rechnet die App mit den Werten deines Kollektivvertrags."},
    {"t": "Ich bin Lehrling", "k": ["lehrling", "lehrjahr", "berufsschule", "lehrlingsentschädigung", "lehrlingsentschaedigung", "lehrlingseinkommen", "lehre", "lehrvertrag", "azubi", "ausbildung"], "a": "Als Lehrling bekommst du eine Lehrlingsentschädigung, meist als fester Monatsbetrag je Lehrjahr. Wähle in den Einstellungen bei „Mein Beruf“ die Art „Lehrling“. Dann zeigt dir die App bei der Lohngruppe nur die Lehrjahre deines Kollektivvertrags, und mit „Mindestlohn laut Kollektivvertrag verwenden“ trägt sie den Betrag ein. Steht in deinem Lehrvertrag ein anderer Betrag, trage ihn bei „Fixer Monatslohn“ ein. Die Berufsschule zählt als Arbeitszeit: Trage den Tag als „Schulung / Berufsschule“ ein, einen festen Schultag jede Woche bei „Feste freie Tage“. Unter 18 gilt das Jugendschutzgesetz, in der Regel höchstens 8 Stunden am Tag und 40 in der Woche. Bei Fragen hilft dir die Arbeiterkammer."},
    {"t": "Zulagen am Bau und im Handwerk", "k": ["bau", "handwerk", "zulage", "zulagen", "schlechtwetter", "taggeld", "montage", "montagezulage", "erschwernis", "schmutzzulage", "buak", "nächtigung", "naechtigung", "maurer", "zimmerer", "tischler", "maler", "elektriker", "installateur"], "a": "Am Bau und im Handwerk stehen auf dem Lohnzettel oft Zulagen: Schmutz-, Erschwernis- und Gefahrenzulage, Taggeld oder Entfernungszulage bei Arbeit außer Haus, Nächtigungsgeld und Montagezulage. Lege sie unter Einstellungen, Prämien an, Mia macht dir passende Vorschläge. Bei Schlechtwetter am Bau und im Holzbau zahlt die BUAK einen Teil des Lohns, die App führt die Schlechtwetterstunden getrennt. Im Malergewerbe gibt es bei Wetterausfall 60 % des Lohns. Die Beträge sind je Kollektivvertrag verschieden, bitte vergleiche sie mit deinem Lohnzettel."},
    {"t": "Reinigung, Security und Pflege", "k": ["reinigung", "reinigungskraft", "gebäudereinigung", "security", "sicherheitsdienst", "wachdienst", "bewachung", "pflege", "pflegeassistenz", "pflegefachassistenz", "krankenpflege", "heimhilfe", "betreuung", "swö", "sozialwirtschaft", "nachtdienst", "rufbereitschaft"], "a": "In diesen Berufen läuft vieles über Nacht-, Sonn- und Feiertagsdienste. Trage die Zeiten so ein, wie du gearbeitet hast, auch über Mitternacht: Die Stunden zählen zu dem Tag, an dem der Dienst beginnt. Zuschläge und Zulagen (zum Beispiel Nachtzulage, Zehrgeld, Rufbereitschaft) stehen auf dem Lohnzettel: lege sie unter Einstellungen, Prämien an, Mia macht dir passende Vorschläge. Gilt bei dir ein anderer Kollektivvertrag (zum Beispiel Landeskrankenhaus), nimm „Eigene Werte“."},
    {"t": "Zeitumstellung (Sommerzeit, Winterzeit)", "k": ["zeitumstellung", "sommerzeit", "winterzeit", "umstellung", "uhrumstellung", "extra stunde", "zusätzliche stunde"], "a": "Die App rechnet die Zeitumstellung automatisch mit. Im Oktober wird die Uhr um 3 Uhr auf 2 Uhr zurückgestellt: Wer in dieser Nacht arbeitet, hat eine Stunde mehr gearbeitet. Eine Nachtschicht von 22 bis 6 Uhr zählt dann 9 statt 8 Stunden. Im März wird die Uhr um 2 Uhr auf 3 Uhr vorgestellt: Dann fehlt eine Stunde, die Schicht zählt 7 statt 8 Stunden. Trage einfach Beginn und Ende so ein, wie die Uhr es gezeigt hat. Ob deine Firma die zusätzliche Stunde bezahlt, steht in deinem Kollektivvertrag oder deiner Betriebsvereinbarung: Schau auf deinen Lohnzettel. Bei Abweichungen kannst du die Stunden im Tag selbst anpassen."},
    {"t": "Was ist die Lohngruppe und brauche ich sie?", "k": ["lohngruppe", "einstufung", "verwendungsgruppe", "was ist die lohngruppe", "brauche ich", "lohngruppe brauchen", "mindestlohn", "stufe"], "a": "Die Lohngruppe (oder Einstufung) bestimmt, welchen Mindestlohn dir der Kollektivvertrag zusteht. Du musst sie nicht kennen: Trage einfach deinen Stundenlohn vom Lohnzettel ein. Kennst du sie, kann die App prüfen, ob dein Lohn dem Kollektivvertrag entspricht. Du findest sie oben auf dem Lohnzettel (bei „Einstufung“, „Lohngruppe“ oder „Verwendungsgruppe“) oder im Dienstvertrag. Steht sie nirgends, frag in der Firma nach."},
    {"t": "Mir fehlen noch Daten, kann ich trotzdem anfangen?", "k": ["daten fehlen", "fehlen noch", "unvollständig", "noch nicht fertig", "anfangen", "starten", "nachtragen", "später eintragen", "rückwirkend", "trotzdem"], "a": "Ja, du kannst sofort anfangen, auch wenn Lohn, Einstufung oder anderes noch fehlt. Trage ein, was du schon hast, zum Beispiel deine Arbeitszeiten. Fehlende Werte kannst du jederzeit in den Einstellungen nachtragen. Die App rechnet dann auch alle Tage, die du schon eingetragen hast, automatisch neu und richtig. Nur der Vergleich mit dem Lohnzettel in Euro geht erst, wenn dein Stundenlohn eingetragen ist."},
    {"t": "Wo finde ich die Rückmeldung an den Entwickler?", "k": ["rückmeldung", "problem melden", "fehler melden", "melden", "feedback", "anregung", "entwickler", "verbesserung", "vorschlag", "wunsch", "kontakt", "wo finde ich"], "a": "Unten links in der App ist der Knopf „Problem melden“. Tippe darauf, wähle bei „Worum geht es?“ zum Beispiel „Etwas stimmt nicht“ oder „Anregung“, schreibe deine Nachricht und tippe auf Senden. Ein Bild der aktuellen Seite schickt die App mit, du kannst es ausschalten. Danach siehst du eine Bestätigung. Du findest die Rückmeldung auch im Profil unter „Rückmeldung an den Entwickler“."},
    {"t": "Sonderurlaub und Arbeit am selben Tag", "k": ["sonderurlaub", "sonder", "dienstverhinderung", "hochzeit", "todesfall", "umzug", "trotzdem gearbeitet", "plus arbeit", "urlaub und arbeit"], "a": "Wähle in Erfassen bei „Art des Tages“ Sonderurlaub (oder Urlaub). Der Tag wird mit den Sollstunden gutgeschrieben. Hast du an dem Tag trotzdem gearbeitet, trage Beginn und Ende ein: Dann steht beim Tag „plus Arbeit“, und deine Arbeitszeit kommt zu den bezahlten Sollstunden dazu. Auf dem Lohnzettel gibt es für Sonderurlaub meist eine eigene Zeile, die die App im Abgleich getrennt vergleicht."},
    {"t": "Voraussichtliches Brutto und Auszahlung", "k": ["brutto", "netto", "vorschau", "auszahlung", "zahltag", "gehalt", "verdienst", "wieviel", "geld"], "a": "In der Übersicht siehst du unter den Stunden dein voraussichtliches Brutto, aus deinen Aufzeichnungen gerechnet: Lohn, Überstunden, Prämien und Dienste, die Diäten extra. Das Netto zeigt die App nicht, weil es von mehreren Faktoren abhängt, zum Beispiel Sozialversicherung, Lohnsteuer, Familienbonus und Pendlerpauschale. Trägst du in den Einstellungen bei „Auszahlung am“ deinen Zahltag ein, steht in der Übersicht auch das Datum. Das Brutto erscheint erst, wenn der Monat vorbei ist, weil vorher noch Eintragungen fehlen können."},
    {"t": "Lkw in Deutschland: Tarif, Spesen und Nacht", "k": ["deutschland", "deutsch", "spedition", "fernfahrer", "fernverkehr", "spesen", "tarif", "nrw", "berlin", "übernachtung", "nacht"], "a": "In Deutschland gibt es keinen einheitlichen Tarif: Er gilt je Bundesland und nur, wenn dein Betrieb tarifgebunden ist. Hinterlegt sind Spedition und Logistik für Nordrhein-Westfalen, Bayern, Sachsen und Berlin. Wählst du beim Einrichten Deutschland, trägst du dein Bundesland für die Feiertage ein. Ist dein Betrieb nicht tarifgebunden, nimm Lohn und Zuschläge aus deinem Arbeitsvertrag und wähle „Eigene Werte“. Für Fahrer im Güterfernverkehr gibt es oft eigene Verträge. Verpflegung ist steuerfrei bis 14 € (mehr als 8 Stunden) und 28 € (24 Stunden), dazu 9 € je Nacht im Lkw: Die Übernachtung legst du als Prämie an. Nachtzuschläge ebenfalls. Vergleiche alles mit deiner Abrechnung."},
    {"t": "Wörter auf dem Lohnzettel", "k": ["entgeltfortzahlung", "aufrollung", "rückverrechnung", "vorschuss", "pfändung", "sachbezug", "vorsorgekasse", "abfertigung", "tarifgruppe", "beschäftigt als", "lohnzettel wort", "bedeutet"], "a": "Entgeltfortzahlung: Die Firma zahlt dir den Lohn weiter, meist im Krankenstand. Aufrollung: Der Lohnverrechner rechnet frühere Monate neu, zum Beispiel nach einer Lohnerhöhung, und zahlt die Differenz nach oder verrechnet sie. Rückverrechnung: Etwas, das schon abgerechnet war, wird wieder zurückgerechnet. Vorschuss: Eine Vorauszahlung, die bei der Abrechnung abgezogen wird. Pfändung: Auf Anordnung des Gerichts hält die Firma einen Betrag ein und überweist ihn weiter. Sachbezug: Ein Vorteil von der Firma, zum Beispiel ein Firmenauto für private Fahrten. Er wird als Wert zum Lohn gerechnet, aber nicht ausgezahlt. MA-Vorsorgekasse: Die Firma zahlt für deine Abfertigung ein. Du musst nur darauf achten, dass die Zeile da ist. Den Kollektivvertrag nennt der Lohnzettel oft gar nicht. Schau bei „Tarifgruppe“ und „Beschäftigt als“ nach, das ist deine Einstufung."},
    {"t": "Netto prüfen mit dem BMF-Rechner", "k": ["netto", "bmf", "rechner", "finanzministerium", "auszahlung", "nachrechnen", "pruefen"], "a": "Das Netto rechnet die App nicht selbst. Der Knopf öffnet den Brutto-Netto-Rechner des Finanzministeriums (BMF) in einem neuen Fenster. Das ist eine unverbindliche Modellrechnung. Gib dort das Brutto von oben ein und stelle ein: Zeitraum Monatlich, Beitragsgruppe wie auf deinem Lohnzettel (Arbeiter oder Angestellter), Jahr, Bundesland deines Arbeitsplatzes, Pendlerpauschale und Kinder wie bei dir. Vergleiche das Netto mit der Zeile Auszahlung auf deinem Lohnzettel. Kleine Unterschiede sind normal, zum Beispiel durch Diäten, Gewerkschaftsbeitrag oder Vorschüsse."},
    {"t": "Schnell erfassen (Text, Sprache, Foto)", "k": ["schnell erfassen", "sprachnachricht", "diktieren", "einsprechen", "tagesbericht", "foto vom tagesbericht", "schreiben statt", "whatsapp", "textnachricht"], "a": "Mit „Schnell erfassen“ schreibst oder sprichst du einfach, was du gearbeitet hast, zum Beispiel „gestern 6 bis 15 Uhr, 30 Minuten Pause, Kunde Müller Aushub“. Ich mache daraus die Einträge, du prüfst sie und speicherst. Du kannst auch ein Foto von deinem Tagesbericht machen, dann übernehme ich die Zeiten daraus. Die Funktion ist zuerst ausgeschaltet: Schalte sie unter Einstellungen, „Eingabehilfen“, ein. Danach ist die Karte ganz oben bei Erfassen. Das Mikrofon braucht Internet und deine Erlaubnis."},
    {"t": "Lohnzettel per Foto oder PDF einlesen", "k": ["foto", "fotografieren", "pdf", "scannen", "einlesen", "lohnzettel lesen", "automatisch lesen", "kamera"], "a": "Im Reiter Lohnzettel erlaubst du bei „Lohnzettel automatisch lesen“ einmal, dass die App deinen Lohnzettel liest. Dann tippst du auf „Lohnzettel lesen“ und wählst ein Foto oder die PDF-Datei. Ich lese ihn nur hier auf deinem Handy, nichts wird hochgeladen. Du bestätigst jede Zeile, dann steht alles im Vergleich „Stimmt mein Lohnzettel?“. Kenne ich eine Zeile nicht, ordnest du sie einmal zu, und ich merke sie mir für die nächsten Monate. Unter Einstellungen, „Einstellungen mit dem Lohnzettel“, prüfe ich damit auch deine Einstellungen."},
    {"t": "Zwei Rechnungen: Kollektivvertrag und Firma", "k": ["abweichung", "unterschied", "firma handhabt", "gesetz", "zwei rechnungen", "festgehalten", "arbeiterkammer", "ak ", "recht", "zu wenig"], "a": "Ich rechne immer zweimal: einmal so, wie es laut Kollektivvertrag und Gesetz sein müsste, und einmal so, wie deine Firma es handhabt, also nach deinen Einstellungen. Gesetz und Kollektivvertrag haben Vorrang. Einen Unterschied siehst du in der Übersicht und im Lohnzettel-Vergleich. Unter Übersicht, „Jahr und Konten“, bleibt in „Festgehaltene Abweichungen“ jede Abweichung stehen, auch wenn die Firma es immer so macht. Die Liste kannst du kopieren und zum Beispiel der Arbeiterkammer zeigen. Alles gilt unter Vorbehalt: Ein Unterschied kann auch durch einen Eingabefehler entstehen."},
    {"t": "Kollektivvertrag und Bundesland", "k": ["bundesland", "kollektivvertrag", "welcher kv", "kv", "vertrag", "tarif", "wien", "tirol", "steiermark", "kaernten", "salzburg", "vorarlberg", "burgenland", "niederoesterreich", "oberoesterreich"], "a": "Unter Einstellungen, „Mein Beruf“, wählst du deinen Beruf und bei „Mein Kollektivvertrag“ den passenden Vertrag. Viele Kollektivverträge sind je Bundesland verschieden. Trag unter Einstellungen, „Meine Daten“, dein Bundesland ein, dann schlage ich dir den richtigen Vertrag und die Zulagen deines Bundeslandes vor und sage dir, wenn etwas nicht zusammenpasst. Findest du deinen Vertrag nicht, nimm „Eigene Werte“ und trag Lohn und Zuschläge aus deinem Dienstvertrag ein."},
    {"t": "Welche Berufe gibt es?", "k": ["berufe", "welche berufe", "mein beruf fehlt", "branche", "job", "arbeite als", "gibt es"], "a": "Es gibt unter anderem Lkw, Bagger, Kleintransport, Bus und Taxi, Bau und Handwerk, Lager, Werkstatt, Industrie, Lebensmittelindustrie, Handel, Büro, Außendienst, Gastronomie und Hotel, Bäckerei, Konditorei, Fleischerei, Reinigung, Security, Pflege und Soziales, Rettungsdienst, Ordination, Zahntechnik, Augenoptik, Friseur, Kosmetik, Post, Bahn, Bundesdienst, Gärtner und Forst, Seilbahn, Kino, Rauchfangkehrer, Garage und Tankstelle, Wäscherei, Kunststoff und Schädlingsbekämpfung, jeweils mit Lehrlingen, wo es welche gibt. Ist deiner nicht dabei, wähle „Etwas anderes“ und trag deine eigenen Werte ein. Schreib mir über „Problem melden“, welcher Beruf fehlt."},
    {"t": "Bericht an die Firma (PDF)", "k": ["bericht", "stundenbericht", "pdf", "stundenzettel", "firma schicken", "unterschrift", "ausdrucken", "monatsbericht", "wochenbericht"], "a": "Ganz unten bei Erfassen findest du „Bericht an die Firma“: Tag, Woche, halber Monat oder Monat wählen und „PDF erstellen und senden“ oder speichern. Unter Einstellungen, „Berichte an die Firma“, stellst du ein, welcher Name draufsteht, wann die Firma den Bericht will, die E-Mail der Firma und ob deine Unterschrift mitgedruckt wird. Dann erinnere ich dich rechtzeitig."},
    {"t": "Urlaub, Zeitausgleich und Überstunden im Überblick", "k": ["resturlaub", "urlaubsanspruch", "urlaubskartei", "zeitausgleich konto", "za konto", "stand", "kartei", "ueberstunden ueberblick", "stundenkartei"], "a": "Unter Übersicht, „Jahr und Konten“, findest du die Stundenkartei, die Urlaubskartei mit Anspruch, genommenen Tagen und Resturlaub, das Zeitausgleich-Konto und „Überstunden im Überblick“: was du aufgeschrieben hast, was ausbezahlt wurde und was aufs Konto ging. Trag den Stand von deinem Lohnzettel ein, dann siehst du sofort, ob es passt. Den Urlaubsanspruch rechne ich aus dem Eintrittsdatum im Profil."},
    {"t": "Freie Tage planen (Brückentage)", "k": ["brueckentag", "fenstertag", "freie tage planen", "urlaub planen", "langes wochenende"], "a": "Unter Übersicht, „Jahr und Konten“, zeigt dir „Freie Tage planen“ die besten Brückentage: mit wenigen Urlaubs- oder Zeitausgleichstagen möglichst viele Tage am Stück frei. Samstag und Sonntag zählen als frei. Frag vorher im Betrieb nach, ob an diesen Tagen gearbeitet wird."},
    {"t": "Mia gestalten: Figur, Kleidung, Farben, Stimme", "k": ["aussehen", "figur", "kleidung", "farbe", "farben", "andere farbe", "mia anziehen", "warnweste", "stimme", "gestalten", "anziehen", "name aendern", "milo", "app symbol", "profilbild"], "a": "Unter Profil, „Mein Begleiter“, wählst du meine Figur und meinen Namen. Mit „Mia selbst gestalten“ suchst du Kleidung, Zubehör und Farben selbst aus, zum Beispiel eine gelbe oder orange Warnweste. Ausgeschaltet ziehe ich mich passend zu deinem Beruf an. Dort stellst du auch ein, ob ich mit Stimme spreche, und darunter wählst du dein App-Symbol."},
    {"t": "Ausprobier-Modus", "k": ["ausprobieren", "ausprobier", "testen", "anderen beruf testen", "probieren", "spielen"], "a": "Unter Einstellungen findest du den Ausprobier-Modus. Damit probierst du andere Berufe oder Einstellungen aus, ohne deine echten Daten zu verändern. Oben steht dann ein roter Hinweis. Mit „Zurück zu meinen Daten“ kommst du zurück, alles Ausprobierte wird gelöscht."},
    {"t": "Kunden, Baustellen, Fahrzeug und Kilometer", "k": ["kunde", "kunden", "baustelle", "taetigkeit", "fahrzeug", "kilometer", "km", "kennzeichen", "auftrag"], "a": "Unter Einstellungen, „Was ich aufzeichne“, schaltest du ein, was du zusätzlich aufschreiben willst: Fahrzeug und Kilometer, Kunden, Baustellen und Tätigkeiten oder Prämien. Dann erscheinen beim Erfassen die passenden Felder, zum Beispiel „+ Kunde / Baustelle hinzufügen“ mit der Zeit pro Kunde. Im Profil kannst du einstellen, dass der km-Stand vom letzten Mal automatisch eingetragen wird."},
    {"t": "Betrieb geschlossen und feste freie Tage", "k": ["betriebsurlaub", "betrieb geschlossen", "betrieb zu", "firma zu", "feste freie tage", "jede woche frei", "berufsschultag"], "a": "Ist der Betrieb zu, wähle beim Tag unter „Art des Tages“ „Betrieb geschlossen / Betriebsurlaub“. Wie die Firma das bezahlt, als Urlaub oder aus deinen Überstunden, stellst du unter Einstellungen, „Betrieb geschlossen“, ein. Hast du jede Woche am gleichen Tag frei oder Berufsschule, lege es einmal unter Einstellungen, „Feste freie Tage“, an. Dann trage ich diese Tage für dich ein."},
    {"t": "Konto und mehrere Geräte", "k": ["konto", "anmelden", "abmelden", "passwort", "neues handy", "computer", "zweites geraet", "synchron", "login"], "a": "Mit deinem Konto (E-Mail und Passwort) sind deine Daten zusätzlich auf dem Server gesichert. Meldest du dich auf einem anderen Handy oder Computer an, sind alle Einträge auch dort. Ohne Internet speichert die App auf dem Gerät und gleicht später ab. Unter Einstellungen, „Konto“, siehst du, ob alles gespeichert ist, und kannst dich abmelden."},
    {"t": "Rettungsdienst und Krankentransport", "k": ["rettung", "rotes kreuz", "samariter", "gruenes kreuz", "gruenen kreuz", "gruene kreuz", "taxi kv", "taxi-kv", "taxi kollektivvertrag", "krankentransport", "sanitaeter", "johanniter", "malteser", "rettungsdienst"], "a": "Beim Roten Kreuz gilt der Rotkreuz-Kollektivvertrag, beim Samariterbund der Samariterbund-Kollektivvertrag (BARS), beide je Bundesland. Für private Rettungs- und Krankentransportfirmen ohne eigenen Vertrag, zum Beispiel Grünes Kreuz, gilt der Rotkreuz-Kollektivvertrag. Laut Oberstem Gerichtshof darf ein Krankentransport nicht nach dem Taxi-Kollektivvertrag bezahlt werden. Wähle unter Einstellungen den Beruf „Rettungsdienst“ und deinen Vertrag."},
    {"t": "Notiz zum Tag: wer wollte den freien Tag?", "k": ["notiz", "bemerkung", "angeordnet", "wer wollte", "vereinbart", "mein wunsch", "chef hat"], "a": "Beim Erfassen schreibst du unter „Notiz zum Tag“ alles auf, was wichtig ist. Bei freien Tagen hältst du dort auch fest, wer ihn wollte: du selbst, mit der Firma vereinbart oder von der Firma angeordnet. Das zählt, wenn es später um Zeitausgleich, Urlaub oder Lohn geht, und die Notizen stehen bei den Abweichungen dabei."},
    {"t": "Mithelfen und Fragen an den Entwickler", "k": ["mithelfen", "anonym", "statistik", "helfen", "dazulernen", "unterstuetzen"], "a": "Unter Einstellungen, „Mithelfen (optional)“, kannst du erlauben, dass ich anonym melde, in welchem Beruf du bist und wie stark Lohnzettel und Aufzeichnung abweichen, ohne Namen, E-Mail und genaue Beträge. Und du kannst erlauben, dass ich Fragen, die ich nicht beantworten kann, an den Entwickler schicke, damit ich dazulerne. Beides ist optional und jederzeit ausschaltbar."}
  ];
  function miaFaqText(i, w) { var tr = MIA_TR[miaLang()]; return tr ? tr[i][w === 'a' ? 1 : 0] : MIA_FAQ[i][w]; }
  function miaNorm(s) { return (s || '').toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/ł/g, 'l').replace(/ı/g, 'i').normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
  function miaTopic(i) { return String(MIA_FAQ[i].t).replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/Ä/g, 'Ae').replace(/Ö/g, 'Oe').replace(/Ü/g, 'Ue').replace(/ß/g, 'ss').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, ''); }

  /* ---- Mia: "Wo finde ich ...?" Konkrete Antwort mit Pfad und Hinbringen ---- */
  var MIA_WO = [
    { id: 'lohn', k: ['stundenlohn', 'stundensatz', 'verdienst pro stunde', 'euro pro stunde', 'hourly', 'hourly rate', 'wage', 'stawka godzinowa', 'oraria'], sel: '#s-lohn', pfad: ['Einstellungen', 'Meine Werte', 'Stundenlohn (€ pro Stunde)'], unter: 'Mein Beruf' },
    { id: 'monatslohn', k: ['monatslohn', 'fixlohn', 'fixer lohn', 'monatsgehalt', 'fixgehalt', 'monthly salary'], sel: '#s-monat', pfad: ['Einstellungen', 'Meine Werte', 'Fixer Monatslohn (€ brutto, optional)'], unter: 'Mein Beruf' },
    { id: 'diaeten', k: ['diäten', 'diaeten', 'diaet', 'taggeld', 'tagesgeld', 'spesen', 'per diem', 'allowance', 'dieta'], sel: '#s-form2', pfad: ['Einstellungen', 'Diäten'], unter: 'Meine Werte' },
    { id: 'praemien', k: ['prämie', 'praemie', 'praemien', 'bonus', 'zulage', 'zulagen', 'schmutzzulage', 'bonuses'], sel: '#s-praemien', pfad: ['Einstellungen', 'Meine Prämien'], unter: 'Diäten' },
    { id: 'ueberstunden', k: ['überstunden', 'ueberstunden', 'überstundenmodell', 'tagessoll', 'overtime', 'nadgodziny'], sel: '#s-umodell', pfad: ['Einstellungen', 'Meine Werte', 'Wie zählt deine Firma Überstunden?'], unter: 'Mein Beruf' },
    { id: 'zuschlaege', k: ['zuschlag', 'zuschlaege', 'zuschläge', 'sonntagszuschlag', 'feiertagszuschlag', 'samstagszuschlag', 'surcharge'], sel: '#s-zsa', pfad: ['Einstellungen', 'Meine Werte', 'Zuschläge für Stunden'], unter: 'Mein Beruf' },
    { id: 'wochenstunden', k: ['wochenstunden', 'wochenarbeitszeit', 'normalarbeitszeit', 'weekly hours'], sel: '#s-woche', pfad: ['Einstellungen', 'Meine Werte', 'Wochenstunden'], unter: 'Mein Beruf' },
    { id: 'einstufung', k: ['einstufung', 'lohngruppe', 'verwendungsgruppe', 'beschaeftigungsgruppe', 'beschäftigungsgruppe', 'job group', 'classification'], sel: '#s-einst', pfad: ['Einstellungen', 'Meine Werte', 'Einstufung auf deinem Lohnzettel'], unter: 'Mein Beruf' },
    { id: 'beruf', k: ['beruf wechseln', 'beruf aendern', 'beruf ändern', 'berufswechsel', 'jobwechsel', 'job wechsel', 'neuer job', 'arbeitsweise', 'change job'], sel: '#s-beruf', pfad: ['Einstellungen', 'Mein Beruf'], unter: 'Meine Daten' },
    { id: 'kv', k: ['kollektivvertrag', 'kv wechseln', 'kv aendern', 'kv ändern', 'collective agreement'], sel: '#s-kv', open: true, pfad: ['Einstellungen', 'Mein Beruf', 'Mein Kollektivvertrag'], unter: 'Meine Daten' },
    { id: 'bereitschaft', k: ['bereitschaft', 'notdienst', 'rufbereitschaft', 'standby', 'on call'], sel: '#s-dienste', pfad: ['Einstellungen', 'Bereitschaft und Notdienst'], unter: 'Meine Prämien' },
    { id: 'pausen', k: ['pausenabzug', 'automatische pause', 'pause abziehen', 'pausen automatisch'], sel: '#s-pauseauto', pfad: ['Einstellungen', 'Meine Werte', 'Automatischer Pausenabzug (Minuten pro Tag)'], unter: 'Mein Beruf' },
    { id: 'runden', k: ['runden', 'aufrunden', 'abrunden', 'rounding'], sel: '#s-runan', pfad: ['Einstellungen', 'Meine Werte', 'Zeiten runden'], unter: 'Mein Beruf' },
    { id: 'lohnzettel', k: ['lohnzettel', 'stimmt mein lohnzettel', 'abrechnung vergleichen', 'payslip', 'abgleich'], sel: '#m-abgleich', pfad: ['Lohnzettel', 'Stimmt mein Lohnzettel?'] },
    { id: 'schnell', k: ['sprachnachricht', 'sprache', 'sprechen', 'diktieren', 'einsprechen', 'spracheingabe', 'whatsapp', 'per text', 'textnachricht', 'schnell erfassen', 'voice', 'dictate', 'quick entry'], sel: '#sq-card', pfad: ['Erfassen', 'Schnell erfassen'] },
    { id: 'eingabehilfen', k: ['eingabehilfen', 'schnell erfassen ausschalten', 'sprache ausschalten', 'foto ausschalten', 'tagesbericht foto', 'foto tagesbericht', 'foto einlesen', 'karte ausblenden'], sel: '#s-eingabe', pfad: ['Einstellungen', 'Eingabehilfen'], unter: 'Bereitschaft und Notdienst' },
    { id: 'erfassen', k: ['stunden eintragen', 'tag eintragen', 'arbeitszeit eintragen', 'tag erfassen', 'log hours'], sel: '#e-status', pfad: ['Erfassen'] },
    { id: 'urlaub', k: ['urlaub eintragen', 'krankenstand eintragen', 'art des tages', 'zeitausgleich eintragen', 'urlaub', 'krankenstand'], sel: '#e-status', pfad: ['Erfassen', 'Art des Tages'] },
    { id: 'fristen', k: ['fristen', 'code 95', 'code95', 'ausweise', 'fahrerkarte', 'staplerschein', 'ablaufdatum', 'ausbildungen'], sel: '#fr-card', pfad: ['Profil', 'Ausbildungen, Ausweise und Fristen'] },
    { id: 'news', k: ['neuigkeiten', 'news'], sel: '#news-card', pfad: ['Profil', 'Neuigkeiten'] },
    { id: 'bundesland', k: ['bundesland', 'arbeitsort', 'federal state', 'welches land'], sel: '#s-land', pfad: ['Einstellungen', 'Meine Daten', 'Bundesland'], unter: 'Meine Daten' },
    { id: 'sicherung', k: ['sicherung', 'backup', 'daten sichern', 'wiederherstellen'], sel: '#b-card', open: true, pfad: ['Einstellungen', 'Sicherung'], unter: true },
    { id: 'lzlesen', k: ["lohnzettel lesen", "lohnzettel fotografieren", "lohnzettel foto", "lohnzettel pdf", "lohnzettel einlesen", "payslip photo", "read payslip"], sel: '#s-lz', pfad: ["Lohnzettel", "Lohnzettel automatisch lesen"] },
    { id: 'urlaubskartei', k: ["resturlaub", "urlaubskartei", "urlaubsanspruch", "urlaubsstand", "holiday balance"], sel: '#k-urlaub', pfad: ["Übersicht", "Jahr und Konten", "Urlaubskartei"], seg: 'konten' },
    { id: 'zakonto', k: ["zeitausgleich-konto", "zeitausgleichskonto", "za-konto", "za konto", "zeitkonto", "time-off account"], sel: '#k-za', pfad: ["Übersicht", "Jahr und Konten", "Zeitausgleich-Konto"], seg: 'konten' },
    { id: 'abweichungen', k: ["abweichungen", "festgehaltene abweichungen", "liste fuer die arbeiterkammer", "deviations"], sel: '#k-abw', pfad: ["Übersicht", "Jahr und Konten", "Festgehaltene Abweichungen"], seg: 'konten' },
    { id: 'ueberblick', k: ["ueberstunden im ueberblick", "ueberstunden uebersicht", "overtime overview"], sel: '#ue-info', pfad: ["Übersicht", "Jahr und Konten", "Überstunden im Überblick"], seg: 'konten' },
    { id: 'freietage', k: ["brueckentag", "brueckentage", "fenstertag", "freie tage planen", "bridge days"], sel: '#pl-det', pfad: ["Übersicht", "Jahr und Konten", "Freie Tage planen"], seg: 'konten' },
    { id: 'berichte', k: ["bericht an die firma", "berichte an die firma", "stundenbericht", "unterschrift", "monatsbericht", "wochenbericht", "report to the company"], sel: '#s-berichte', pfad: ["Einstellungen", "Berichte an die Firma"], unter: "Ansicht" },
    { id: 'probe', k: ["ausprobier", "ausprobieren", "anderen beruf testen", "trial mode"], sel: '#s-probe-go', pfad: ["Einstellungen", "Ausprobier-Modus"] },
    { id: 'aufzeichnen', k: ["kunden aufzeichnen", "baustellen", "fahrzeug und kilometer", "kilometerstand", "km-stand", "kennzeichen", "what i record"], sel: '#s-bfz', pfad: ["Einstellungen", "Was ich aufzeichne"] },
    { id: 'betrieb', k: ["betriebsurlaub", "betrieb geschlossen", "company closed"], sel: '#s-bf', pfad: ["Einstellungen", "Betrieb geschlossen"], unter: "Was ich aufzeichne" },
    { id: 'feste', k: ["feste freie tage", "jede woche frei", "berufsschultag", "fixed days off"], sel: '#fest-card', pfad: ["Einstellungen", "Feste freie Tage"] },
    { id: 'konto', k: ["abmelden", "konto", "anmelden", "passwort", "log out", "account"], sel: '#a-sync', pfad: ["Einstellungen", "Konto"] },
    { id: 'mia', k: ["mia aussehen", "mia gestalten", "mia farbe", "figur", "begleiter", "warnweste farbe", "mia kleidung", "stimme von mia", "companion"], sel: '#mia-choose', pfad: ["Profil", "Mein Begleiter"] },
    { id: 'symbol', k: ["app-symbol", "app symbol", "icon", "app icon"], sel: '#icon-pick2', pfad: ["Profil", "Mein App-Symbol"] },
    { id: 'mithelfen', k: ["mithelfen", "anonym melden", "help out"], sel: '#s-help', pfad: ["Einstellungen", "Mithelfen (optional)"] },
    { id: 'sonderzahlungen', k: ["sonderzahlung", "urlaubszuschuss", "weihnachtsgeld", "urlaubsgeld", "13. gehalt", "14. gehalt", "special payments"], sel: '#ab-extra', pfad: ["Lohnzettel", "Sonderzahlungen"] },
    { id: 'notiz', k: ["notiz zum tag", "notiz", "bemerkung", "note for the day"], sel: '#e-an-box', pfad: ["Erfassen", "Notiz zum Tag"] }
  ];
  var MIA_WO_X = {
    bundesland: 'kraj związkowy|województwo|tartomány|eyalet|spolková země|spolková krajina|savezna zemlja|savezna država|regione|land federal|федеральная земля|федеральна земля',
    lohn: 'godzinowa|stawka za godzine|oraria|hodinova mzda|hodinova sadzba|satnica|paga oraria|salariu pe ora|tarif orar|zarplata v chas|pochasova|pochasova stavka|ставка в час|почасова|оплата за час|saatlik ucret|saat basi',
    monatslohn: 'pensja miesieczna|stala pensja|havi fizetes|havi ber|aylik maas|sabit maas|mesicni plat|mesacny plat|mjesecna placa|mesecna plata|stipendio mensile|salariu lunar|месячная зарплата|оклад|місячна зарплата|oklad',
    diaeten: 'dieta dzienna|dieta krajowa|napi dij|kiküldetési|kikuldetesi|harcirak|gundelik|yevmiye|dnevnice|dnevnica|indennita di trasferta|diurna|суточные|командировочные|добові|відрядні|gunluk harcirah',
    praemien: 'premia|dodatki|premie|bonusz|премия|надбавка|доплата|премія|надбавки|доплати',
    ueberstunden: 'orele suplimentare|suplimentare|nadgodziny|tulora|fazla mesai|prescas|nadcas|prekovremeni|sati viska|straordinari|ore suplimentare|сверхурочные|переработка|понаднормові|надурочні|tuloraszamitas',
    zuschlaege: 'dodatek za niedziele|dodatek za swieta|dodatek do nadgodzin|vasarnapi potlek|unnepnapi potlek|zamlar|pazar zammi|bayram zammi|priplatek za nedeli|priplatek za svatek|prirazka|dodatak za nedjelju|dodatak za praznik|dodatak za nedelju|maggiorazione|supplemento|spor de duminica|spor de sarbatoare|надбавка за воскресенье|надбавка за праздник|доплата за выходные|надбавка за неділю|доплата за свято',
    wochenstunden: 'godziny tygodniowo|tygodniowy czas pracy|heti oraszam|heti munkaido|haftalik saat|haftalik calisma|tydenni hodiny|tyzdenne hodiny|tjedni sati|nedeljni sati|sedmicni sati|ore settimanali|ore pe saptamana|saptamanale|часов в неделю|недельные часы|годин на тиждень|тижневі години|tydenni pracovni doba',
    einstufung: 'grupa placowa|zaszeregowanie|besorolas|berkategoria|bergrup|kademe|ucret grubu|kategoria platova|platova trida|platova skupina|placovy stupen|placovni razred|platni razred|inquadramento|categoria salariale|incadrare|grupa de salarizare|тарифная группа|разряд|категория|тарифна група|розряд|категорія',
    beruf: 'zmiana zawodu|zmienic zawod|foglalkozas valtas|munkakor valtas|meslek degistir|is degistir|zmena povolani|zmena zamestnani|promjena zanimanja|promena zanimanja|cambio lavoro|cambiare lavoro|schimbare meserie|schimba meseria|смена профессии|сменить профессию|змінити професію|зміна професії',
    kv: 'uklad zbiorowy|kollektiv szerzodes|kollektivvertrag|toplu sozlesme|kolektivni smlouva|kolektivna zmluva|kolektivni ugovor|kolektivni ugovor|contratto collettivo|ccnl|contract colectiv|коллективный договор|колективний договір|collective agreement',
    bereitschaft: 'dyzur|dyzur domowy|ugyelet|keszenlet|nobet|hazir bekleme|pohotovost|pohotovost|dezurstvo|pripravnost|reperibilita|disponibilita|permanenta|дежурство|дежурство на дому|чергування|черговий',
    pausen: 'automatyczna przerwa|przerwa automatycznie|automatikus szunet|szunet levonas|otomatik mola|mola kesinti|automaticka prestavka|automaticka pauza|automatska stanka|automatska pauza|pauza automatski|pausa automatica|pauza automata|scadere pauza|автоматический перерыв|вычет перерыва|автоматична перерва|вирахування перерви',
    runden: 'zaokraglanie|zaokraglic|kerekites|kerekit|yuvarlama|yuvarla|zaokrouhlovani|zaokruhlovanie|zaokruzivanje|zaokruzi|arrotondamento|arrotondare|rotunjire|rotunjeste|округление|округлять|округлення|округляти',
    lohnzettel: 'pasek wyplaty|odcinek wyplaty|berszamfejtes|fizetesi jegyzek|berlap|maas bordrosu|bordro|vyuctovani mzdy|vyplatna paska|vyuctovanie mzdy|obracun place|platna lista|isplatna lista|obracun plate|busta paga|cedolino|fluturas de salariu|stat de plata|расчетный листок|расчётный лист|зарплатная ведомость|розрахунковий листок|платіжна відомість',
    schnell: 'hlasovou zpravu|hlasovu spravu|mesajul vocal|inregistrarea rapida|gyors rogzit|hangosan|szybkie wpisywanie|wiadomosc glosowa|nagranie glosowe|dyktowanie|wpisz glosem|szybkie rogzites|hangüzenet|hanguzenet|diktalas|diktál|hizli kayit|sesli mesaj|sesli giris|yazarak|rychle zadani|hlasova zprava|diktovat|nadiktovat|rychle zadanie|hlasova sprava|diktovat|brzi unos|glasovna poruka|diktirati|izgovoriti|brzi unos|glasovna poruka|diktirati|registrazione rapida|messaggio vocale|dettare|inregistrare rapida|mesaj vocal|dictare|dicteaza|быстрая запись|голосовое сообщение|голосом|диктовать|продиктовать|швидкий запис|голосове повідомлення|голосом|диктувати|whatsapp',
    eingabehilfen: 'pomoc w wprowadzaniu|wylaczyc szybkie|wylacz foto|wylacz zdjecie|beviteli segedek|gyors rogzites kikapcsol|foto kikapcsol|giris yardimlari|hizli kayit kapat|fotografi kapat|pomucky pro zadavani|vypnout rychle|vypnut rychle|pomocky na zadavanie|pomagala za unos|iskljuci brzi|ugasiti brzi|aiuti all inserimento|disattiva registrazione|disattiva foto|ajutoare de introducere|dezactiveaza|помощники ввода|отключить быструю|выключить фото|помічники вводу|вимкнути швидкий|вимкнути фото|fotografia raportu|napi jelentes foto|gunluk rapor foto|foto denniho hlaseni|foto dnevnog izvjestaja|foto rapporto giornaliero|foto raport zilnic|фото дневного отчета|фото денного звіту',
    erfassen: 'wpisac godziny|wpisz dzien|zapisac godziny|rogzit|idot rogzit|munkaidot rogzit|saat gir|gun gir|calisma saati gir|zadat hodiny|zapsat hodiny|zadat den|zadat hodiny|upisati sate|unijeti sate|upisati dan|inserire le ore|inserire giornata|registrare ore|introdu orele|introdu ziua|inregistreaza ore|ввести часы|внести часы|записать день|ввести день|внести години|записати день|ввести години',
    urlaub: 'urlop|zwolnienie lekarskie|szabadsag|betegszabadsag|tappenz|hastalik izni|dovolena|nemocenska|dovolenka|godisnji odmor|congedo|malattia|concediu|concediu medical|отпуск|больничный|лист нетрудоспособности|відпустка|лікарняний',
    fristen: 'terminy waznosci|kod 95|legitymacja|prawo jazdy|karta kierowcy|hataridok|lejarat|lejarati datum|son kullanma|surucu karti|lhuty|termin platnosti|prukazy|kartu ridice|lehoty|platnost|vozacka kartica|patente|carta del conducente|termene|expirare|card sofer|сроки|срок действия|удостоверения|карта водителя|строки|термін дії|посвідчення|картка водія',
    news: 'nowosci|aktualnosci|ujdonsagok|hirek|yenilikler|haberler|novinky|novosti|vijesti|notizie|noutati|stiri|новости|новинки|новини',
    sicherung: 'kopia zapasowa|zabezpieczenie danych|przywracanie|biztonsagi mentes|adatmentes|visszaallitas|yedek|yedekleme|geri yukleme|zaloha|zalohovani|obnoveni|zaloha dat|obnovenie|sigurnosna kopija|pohrana|vracanje|rezervna kopija|backup dei dati|ripristino|salvataggio|copie de rezerva|restaurare|salvare date|резервная копия|бэкап|восстановление|резервна копія|відновлення',
    lzlesen: "read payslip|payslip photo|scan payslip|czytanie paska|zdjecie paska|pasek pdf|berjegyzek olvasasa|berjegyzek foto|bordroyu oku|bordro fotograf|cist vyplatni pasku|vyplatnice foto|citat vyplatnu pasku|citati platnu listu|platna lista foto|leggi busta paga|foto busta paga|citeste fluturasul|poza fluturas|считать расчетный|фото листка|читати розрахунковий|фото листка",
    urlaubskartei: "holiday card|remaining holiday|karta urlopowa|pozostaly urlop|szabadsagnyilvantartas|maradek szabadsag|izin karti|kalan izin|karta dovolene|zbytek dovolene|karta dovolenky|zvysok dovolenky|karton godisnjeg|ostatak godisnjeg|scheda ferie|ferie residue|fisa de concediu|concediu ramas|карточка отпуска|остаток отпуска|картка відпустки|залишок відпустки",
    zakonto: "time-off account|konto odbioru|idokiegyenlitesi szamla|zaman dengeleme hesabi|konto nahradniho volna|konto nahradneho volna|racun slobodnog vremena|conto ore di recupero|cont de timp liber|счет отгулов|рахунок відгулів",
    abweichungen: "recorded deviations|deviations|zapisane odchylenia|odchylenia|rogzitett elteresek|elteresek|kaydedilen sapmalar|sapmalar|zaznamenane odchylky|odchylky|zabiljezena odstupanja|zabelezena odstupanja|odstupanja|scostamenti|abateri inregistrate|abateri|зафиксированные отклонения|отклонения|зафіксовані відхилення|відхилення",
    ueberblick: "overtime overview|nadgodziny w skrocie|tulorak attekintese|fazla mesaiye genel bakis|prescasy v prehledu|nadcasy v prehlade|prekovremeni sati ukratko|straordinari in sintesi|ore suplimentare pe scurt|сверхурочные в обзоре|понаднормові в огляді",
    freietage: "bridge day|plan days off|dzien pomostowy|planuj dni wolne|athidalo nap|szabadnapok tervezese|kopru gunu|bos gunleri planla|planovani volnych dnu|planovanie volnych dni|produzeni vikend|planiranje slobodnih dana|ponte|ponti|pianifico|pianificare|pianifica i giorni liberi|zi punte|planifica zilele libere|мост|планирование свободных дней|місток|планування вільних днів",
    berichte: "report to the company|timesheet|raport dla firmy|raporty dla firmy|jelentes a cegnek|firmaya rapor|sirkete rapor|hlaseni pro firmu|hlasenie pre firmu|izvjestaj za tvrtku|izvestaj za firmu|rapporto per l azienda|raport pentru firma|отчет для фирмы|звіт для фірми|podpis|alairas|imza|potpis|semnatura|подпись|підпис",
    probe: "trial mode|tryb probny|kiprobalas mod|deneme modu|zkusebni rezim|skusobny rezim|probni nacin|probni rezim|modalita prova|mod de incercare|пробный режим|пробний режим",
    aufzeichnen: "what i record|kilometres|mileage|co zapisuje|kilometry|amit rogzitek|kilometer|ne kaydediyorum|kilometre|co zaznamenavam|cim zaznamenavam|sto biljezim|sta belezim|kilometri|cosa registro|chilometri|ce inregistrez|что я записываю|километры|пробег|що я записую|кілометри|пробіг",
    betrieb: "company closed|company holiday|zaklad zamkniety|urlop zakladowy|uzem zarva|uzemi szabadsag|isyeri kapali|toplu izin|provoz uzavren|hromadna dovolena|prevadzka zatvorena|hromadna dovolenka|tvrtka zatvorena|firma zatvorena|kolektivni godisnji|azienda chiusa|ferie aziendali|firma inchisa|concediu colectiv|предприятие закрыто|корпоративный отпуск|підприємство закрите|корпоративна відпустка",
    feste: "fixed days off|stale dni wolne|allando szabadnapok|sabit bos gunler|pevne volne dny|pevne volne dni|stalni slobodni dani|giorni liberi fissi|zile libere fixe|постоянные выходные|постійні вихідні",
    konto: "account|log out|konto|wyloguj|fiok|kijelentkez|hesap|cikis yap|ucet|odhlasit|nalog|odjava|deconectare|аккаунт|выйти|акаунт|вийти",
    mia: "companion|design mia|moj towarzysz|wyglad mii|tarsam|mia kinezete|arkadasim|mia gorunus|muj spolecnik|vzhled mie|moj spolocnik|vzhlad mie|moj pratitelj|moj pratilac|izgled mie|il mio compagno|aspetto di mia|insotitorul meu|aspectul miei|мой помощник|внешний вид мии|мій помічник|вигляд мії",
    symbol: "app icon|ikona aplikacji|alkalmazas ikonja|uygulama simgesi|ikona aplikace|ikona aplikacie|ikona aplikacije|icona dell app|pictograma aplicatiei|иконка приложения|іконка застосунку",
    mithelfen: "help out|pomoz opcjonalnie|segits|yardim et|pomoci volitelne|pomoct volitelne|pomozi|aiuta facoltativo|ajuta optional|помочь по желанию|допомогти",
    sonderzahlungen: "special payments|christmas bonus|holiday bonus|wyplaty specjalne|trzynastka|kulonleges kifizetesek|ozel odemeler|ikramiye|zvlastni platby|vanocni|zvlastne platby|vianocne|posebna primanja|bozicnica|regres|pagamenti speciali|tredicesima|quattordicesima|plati speciale|prima de craciun|особые выплаты|рождественские|отпускные|особливі виплати|різдвяні|відпускні",
    notiz: "note for the day|notatka do dnia|megjegyzes a naphoz|gune not|poznamka ke dni|poznamka k dnu|biljeska uz dan|beleska uz dan|nota del giorno|notita pentru zi|заметка ко дню|нотатка до дня"
  };
  MIA_WO.forEach(function (e) { var x = MIA_WO_X[e.id]; if (x) e.k = e.k.concat(x.split('|')); });
  var MIA_WO_FAQ = { 'Prämie anlegen': 'praemien', 'Überstunden und Zuschläge': 'ueberstunden', 'Diäten / Taggeld': 'diaeten', 'Lohn oder Beruf ändern': 'lohn', 'Urlaub oder Krankenstand': 'urlaub', 'Stunden eintragen': 'erfassen', 'Sicherung': 'sicherung', 'Fristen und Ausweise': 'fristen', 'Neuigkeiten': 'news', 'Lohnzettel prüfen': 'lohnzettel', 'Was ist die Lohngruppe und brauche ich sie?': 'einstufung', 'Gleitzeit': 'ueberstunden', 'Nachzahlung, Aufrollung, Sonderzahlungen': 'lohnzettel' , "Lohnzettel per Foto oder PDF einlesen": 'lzlesen', "Zwei Rechnungen: Kollektivvertrag und Firma": 'abweichungen', "Kollektivvertrag und Bundesland": 'kv', "Welche Berufe gibt es?": 'beruf', "Bericht an die Firma (PDF)": 'berichte', "Urlaub, Zeitausgleich und Überstunden im Überblick": 'urlaubskartei', "Freie Tage planen (Brückentage)": 'freietage', "Mia gestalten: Figur, Kleidung, Farben, Stimme": 'mia', "Ausprobier-Modus": 'probe', "Kunden, Baustellen, Fahrzeug und Kilometer": 'aufzeichnen', "Betrieb geschlossen und feste freie Tage": 'betrieb', "Konto und mehrere Geräte": 'konto', "Rettungsdienst und Krankentransport": 'kv', "Notiz zum Tag: wer wollte den freien Tag?": 'notiz', "Mithelfen und Fragen an den Entwickler": 'mithelfen', "Schnell erfassen (Text, Sprache, Foto)": 'schnell' };
  function miaWoGet(id) { for (var i = 0; i < MIA_WO.length; i++) if (MIA_WO[i].id === id) return MIA_WO[i]; return null; }
  function miaWoScore(n) {
    var best = null, bs = 0;
    var f = function (x) { return x.replace(/oe/g, 'o').replace(/ue/g, 'u'); }, nf = f(n);
    MIA_WO.forEach(function (e) { var sc = 0; e.k.forEach(function (k) { var nk = miaNorm(k); if (nk.length > 2 && (n.indexOf(nk) >= 0 || nf.indexOf(f(nk)) >= 0)) sc += nk.length > 5 ? 2 : 1; }); if (sc > bs) { bs = sc; best = e; } });
    if (best && best.id === 'schnell' && !(data.profil && data.profil.sqText === true)) best = miaWoGet('eingabehilfen'); // ausgeschaltet: zum Schalter führen
    if (best && best.id === 'schnell' && /ausschalt|abschalt|deaktiv|ausblend|turn off|switch off|disable|hide|wylacz|ukryj|kikapcs|kapcsolom ki|kapcsol ki|elrejt|kapat|gizle|vypn|vypin|skryt|iskljuc|ugasi|sakri|disattiv|spegn|nascond|dezactiv|ascund|отключ|выключ|скры|вимкн|вимик|сховат/.test(n)) best = miaWoGet('eingabehilfen');
    return { e: best, s: bs };
  }
  function miaPfadZeigen(e) {
    var g = $('#mia-goask'); if (!g) return;
    if (!e) { g.hidden = true; return; }
    var p = $('#mia-pfad'); if (p) p.innerHTML = e.pfad.map(function (x) { return '<b>' + esc(x) + '</b>'; }).join(' › ');
    if (e.unter) p.innerHTML += '<div class="miaunter">' + (e.unter === true ? esc('Ganz unten auf der Seite') : esc('Weiter unten, direkt unter der Karte') + ' <b>' + esc(e.unter) + '</b>') + '</div>';
    g.hidden = false;
  }
  function miaOrtGo(e) {
    try { miaClose(); } catch (x) { }
    var el = $(e.sel); if (!el) { toast('Das gibt es für deinen Beruf nicht.'); return; }
    var v = el.closest('section.view'); if (v) show(v.id.replace('v-', ''));
    if (e.seg) { var sb = $('[data-seg="' + e.seg + '"]'); if (sb) sb.click(); }
    setTimeout(function () {
      var t = $(e.sel); if (!t || t.closest('[hidden]')) { toast('Das gibt es für deinen Beruf nicht.'); return; }
      var d = t.closest('details'); while (d) { d.open = true; d = d.parentElement && d.parentElement.closest('details'); }
      var card = t.closest('.card'), anchor = t;
      if (card) {
        var hs = card.querySelectorAll('h3'), head = null, k;
        if (t === card) head = hs[0] || null;
        else for (k = 0; k < hs.length; k++) { if (hs[k] !== t && (hs[k].compareDocumentPosition(t) & 4)) head = hs[k]; }
        if (head) anchor = head; else if (t !== card) anchor = card;
      }
      window.scrollTo({ top: Math.max(0, anchor.getBoundingClientRect().top + window.pageYOffset - 70), behavior: 'smooth' });
      var box = (t.tagName === 'INPUT' || t.tagName === 'SELECT') ? (t.closest('.field') || t) : t;
      box.classList.add('mia-treffer'); setTimeout(function () { box.classList.remove('mia-treffer'); }, 3200);
      if (t.tagName === 'INPUT' || t.tagName === 'SELECT') { try { t.focus({ preventScroll: true }); } catch (x) { } }
    }, 220);
  }
  function miaAnswer(q) {
    var n = miaNorm(q), best = null, bs = 0;
    var L = miaLang(), tr = MIA_TR[L];
    MIA_FAQ.forEach(function (e, i) { var sc = 0, ks = e.k.concat(tr && tr[i] && tr[i][2] ? tr[i][2].split(' ') : []).concat(String(tr && tr[i] ? tr[i][0] : e.t).toLowerCase().split(/[^0-9a-z\u00c0-\u024f\u0400-\u04ff]+/).filter(function (w) { return w.length > 4; })); ks.forEach(function (k) { var nk = miaNorm(k); if (nk.length > 2 && n.indexOf(nk) >= 0) sc += nk.length > 9 ? 3 : nk.length > 5 ? 2 : 1; }); if (sc > bs) { bs = sc; best = i; } });
    var wo = miaWoScore(n), loc = /\bwo\b|finde|finden|anleg|einstell|eintrag|aender|zeig|komme|wohin|where|find|set up|gdzie|hol|hogyan|nerede|nasil|unde|gde|gdje|dove|kde|де|где|как|як/.test(n);
    ins('mia_frage'); ui.miaZiel = null;
    if (wo.e && wo.s >= 1 && (loc || wo.s > bs)) { ui.miaZiel = wo.e.id; ins('mia_wo_' + wo.e.id); return 'Das findest du hier:'; }
    if (best == null) { try { if (window.StundenInsights) window.StundenInsights.miaOffen(q, L); } catch (e) {} }
    else { ins('mia_antwort'); ins('mia_t_' + miaTopic(best)); ui.miaZiel = MIA_WO_FAQ[MIA_FAQ[best].t] || null; }
    return best != null ? miaFaqText(best, 'a') : (MIA_UI[L] || MIA_UI.de).unk;
  }
  function miaShowAns(t) { var el = $('#mia-ans'); if (!el) return; var nm = uiMiaName(); if (nm) t = String(t).replace(/\bMia\b/g, nm); el.textContent = t; el.hidden = false; miaPfadZeigen(miaWoGet(ui.miaZiel)); var r = $('#mia-read'); if (r) r.hidden = !('speechSynthesis' in window); miaPose(''); }
  (function () {
    function on(id, ev, fn) { var el = $(id); if (el) el.addEventListener(ev, fn); }
    function paintAsk() {
      var L = miaLang(), u = MIA_UI[L] || MIA_UI.de, chips = $('#mia-chips');
      var gl = false, le = false, hw = false; try { var ww = wAt(todayISO()); gl = !!(ww && ww.ueberstunden && ww.ueberstunden.modell === 'gleit'); le = !!(ww && ww.art === 'lehrling'); hw = !!(ww && (['bau', 'holzbau', 'dachdecker', 'pflasterer', 'fliesenleger', 'glaser', 'tapezierer', 'steinmetz', 'bodenleger', 'bauhilfsgewerbe', 'maler', 'tischler', 'metall', 'de_bau', 'de_metall'].indexOf(ww.paket) >= 0 || ww.beruf === 'handwerk')); } catch (e) { }
      if (chips) chips.innerHTML = MIA_FAQ.map(function (e, i) { return ((e.t === 'Gleitzeit' && !gl) || (e.t === 'Ich bin Lehrling' && !le) || (e.t === 'Zulagen am Bau und im Handwerk' && !hw) || (e.t === 'Rettungsdienst und Krankentransport' && !(ww && (ww.beruf === 'rettung' || ww.beruf === 'bus')))) ? '' : '<button type="button" class="chip" data-faq="' + i + '">' + esc(miaFaqText(i, 't')) + '</button>'; }).join('');
      $('#mia-q').placeholder = u.q; $('#mia-send').textContent = u.go; $('#mia-read').textContent = u.read; $('#mia-askbtn').textContent = u.ask;
      var sel = $('#mia-lang'); if (sel) sel.value = L;
    }
    var ls = $('#mia-lang'); if (ls) { ls.innerHTML = Object.keys(MIA_LANGS).map(function (k) { return '<option value="' + k + '">' + MIA_LANGS[k].n + '</option>'; }).join(''); ls.addEventListener('change', function () { uiSetLang(this.value); $('#mia-ans').hidden = true; paintAsk(); }); }
    paintAsk(); ui.miaPaint = paintAsk;
    on('#mia-askbtn', 'click', function () { var p = $('#mia-ask'); paintAsk(); p.hidden = !p.hidden; if (!p.hidden) { var q = $('#mia-q'); if (q) q.focus(); } });
    on('#mia-chips', 'click', function (ev) { var b = ev.target.closest('[data-faq]'); if (b) { var qa2 = $('#mia-asked'); if (qa2) qa2.hidden = true; ins('mia_chip'); ins('mia_t_' + miaTopic(+b.dataset.faq)); ui.miaZiel = MIA_WO_FAQ[MIA_FAQ[+b.dataset.faq].t] || null; miaShowAns(miaFaqText(+b.dataset.faq, 'a')); } });
    function send() { var q = $('#mia-q').value.trim(); if (q) { var qa = $('#mia-asked'); if (qa) { qa.textContent = '„' + q + '“'; qa.hidden = false; } miaShowAns(miaAnswer(q)); } }
    on('#mia-q', 'input', function () { this.style.height = 'auto'; this.style.height = Math.min(this.scrollHeight, 160) + 'px'; });
    on('#mia-send', 'click', send);
    on('#mia-q', 'keydown', function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); send(); } });
    on('#mia-goyes', 'click', function () { var e = miaWoGet(ui.miaZiel); if (e) { ins('mia_hin_' + e.id); miaOrtGo(e); } });
    on('#mia-gono', 'click', function () { ui.miaZiel = null; miaPfadZeigen(null); });
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
          rec.onerror = function () { ui.miaZiel = null; miaShowAns((MIA_UI[miaLang()] || MIA_UI.de).mic); };
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
    var cur = mode === 'change' ? wAt(ab) : null, w = { mode: mode, ab: ab, cStat: mode === 'start', cMia: mode === 'start', step: 'beruf', hist: [], beruf: null, art: null, b: { fahrzeug: true, kunden: true, praemien: true }, diaeten: true, sw: false, paket: 'gueter', eintritt: '', lohn: '', wochen: '', dsatz: '' };
    if (cur) {
      w.beruf = cur.beruf || null; w.art = cur.art || null; var bb = E.bausteine(cur); w.b = { fahrzeug: bb.fahrzeug, kunden: bb.kunden, praemien: bb.praemien };
      w.diaeten = cur.diaeten.modell !== 'aus'; w.sw = !!cur.schlechtwetter; w.paket = cur.paket || 'gueter'; w.kvGewaehlt = !!cur.paket; w.bl = (data.profil && data.profil.bl) || '';
      w.einst = cur.einstufung || ''; w.lohn = cur.stundenlohn == null ? '' : cur.stundenlohn; w.wochen = E.wochenStd(cur.ueberstunden); w.dsatz = cur.diaeten.satz || '';
    }
    w.mia = (miaCfg().figur); ui.wiz = w; wzRender(); $('#wiz').hidden = false;
  }
  function wzSetArt(k) { var w = ui.wiz; w.art = k; var a = E.BERUFE[w.beruf].arten[w.art]; w.b = { fahrzeug: a.b.fahrzeug, kunden: a.b.kunden, praemien: a.b.praemien }; if (a.sw !== undefined) w.sw = a.sw; if (a.diaeten !== undefined) w.diaeten = a.diaeten; w.kvGewaehlt = false; w.lg = null; w.ls = null; }
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
    s.push({ v: 'konten', sel: '[data-view=konten]', t: 'Unter Profil: Fristen und Ausweise, mein Aussehen, deine Notizen zu den Tagen und die Rückmeldung an den Entwickler.' });
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
    if (mo > 0) { var wsd = set.ueberstunden.wochenStd > 0 ? set.ueberstunden.wochenStd : 38.5; set.monatslohn = mo; var tlr = (E.LOHNGRUPPEN[w.paket] || {}).teiler; set.monatsStd = w.lg && tlr ? tlr : Math.round(wsd * 52 / 12 * 100) / 100; set.stundenlohn = Math.round(mo / set.monatsStd * 100) / 100; set.lgAuto = false; }
    var lgW = E.lgFuer(E.LOHNGRUPPEN[w.paket], ab), gW = lgW && w.lg ? lgW.gruppen.filter(function (x) { return x.id === w.lg; })[0] : null;
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
    var lg = E.lgFuer(E.LOHNGRUPPEN[w.paket], todayISO()); if (!lg) return '';
    var gl = lgListe(lg, w.art, w.lg, w.beruf); if (!gl.length) return '';
    var g = lg.gruppen.filter(function (x) { return x.id === w.lg; })[0];
    var h = '<div class="field"><label for="wz-lg">' + (w.art === 'lehrling' ? 'Lehrjahr laut Kollektivvertrag' : 'Lohngruppe laut Kollektivvertrag') + ' (' + esc(lg.stand) + ')</label><small>Die Lohngruppe (oder Einstufung) bestimmt, welchen Mindestlohn dir der Kollektivvertrag zusteht. Du musst sie nicht kennen: Trage einfach deinen Stundenlohn vom Lohnzettel ein. Kennst du sie, kann die App prüfen, ob dein Lohn dem Kollektivvertrag entspricht. Du findest sie oben auf dem Lohnzettel (bei „Einstufung“, „Lohngruppe“ oder „Verwendungsgruppe“) oder im Dienstvertrag. Steht sie nirgends, frag in der Firma nach.</small><select id="wz-lg" data-wf="lg"><option value="">Nicht sicher / selbst eintragen</option>' +
      gl.map(function (x) { return '<option value="' + esc(x.id) + '"' + (w.lg === x.id ? ' selected' : '') + '>' + esc(x.name) + '</option>'; }).join('') + '</select></div>';
    if (g && lg.stufen && g.l.length > 1) h += '<div class="field"><label for="wz-ls">Stufe</label><select id="wz-ls" data-wf="ls"><option value="">Bitte wählen</option>' + lgSt(lg, g).map(function (s, i) { return '<option value="' + i + '"' + (String(w.ls) === String(i) ? ' selected' : '') + '>' + esc(s) + '</option>'; }).join('') + '</select></div>';
    return h;
  }
  function lohnVorschlag(w) {
    var lg = E.lgFuer(E.LOHNGRUPPEN[w.paket], todayISO()); if (!lg) return;
    var g = lg.gruppen.filter(function (x) { return x.id === w.lg; })[0]; if (!g) return;
    var i = lg.stufen && g.l.length > 1 ? (w.ls === '' || w.ls == null ? -1 : +w.ls) : 0; if (i < 0 || g.l[i] == null) return;
    if (g.m) { w.monat = g.l[i]; w.monatAuto = true; w.lohn = Math.round(g.l[i] / lgTeiler(lg, w.wochen) * 100) / 100; }
    else { if (w.monatAuto) { w.monat = ''; w.monatAuto = false; } w.lohn = g.l[i]; }
  }
  // Berufe alphabetisch, „Etwas anderes“ immer zuletzt
  // Suche im Einrichtungs-Assistenten: Stichwörter je Beruf und Tätigkeit (klein geschrieben, ohne Umlaute)
  var BERUF_SYN = {
    'lkw:baustelle': 'lkw fahrer kipper muldenkipper baustelle kurzstrecke schotter beton', 'lkw:tour': 'lkw fahrer zusteller verteiler lieferfahrer paketdienst filiale getraenke', 'lkw:fern': 'lkw fahrer fernfahrer sattelzug kuehltransport tiefkuehl spedition international kuehlwagen', 'lkw:muell': 'lkw fahrer muellwagen muellabfuhr entsorgung', 'lkw:kipper': 'lkw fahrer kipper erdbau erdtransport aushub', 'lkw:kran': 'lkw fahrer ladekran kran hiab', 'lkw:lehrling': 'lehrling berufskraftfahrer lkw',
    'handwerk:maurer': 'maurer bau bauarbeiter polier betonbauer tiefbau hochbau strassenbau kanalbau schalung hilfsarbeiter', 'handwerk:zimmerer': 'zimmerer zimmermann holzbau dachstuhl', 'handwerk:elektro': 'elektriker elektroinstallateur elektrotechniker strom', 'handwerk:installateur': 'installateur sanitaer heizung klima gas wasser rohr gebaeudetechniker', 'handwerk:spengler': 'spengler dachspengler bauspengler flaschner klempner blech dach', 'handwerk:tischler': 'tischler schreiner moebel holz', 'handwerk:maler': 'maler anstreicher lackierer beschichter', 'handwerk:dachdecker': 'dachdecker dach ziegel', 'handwerk:pflasterer': 'pflasterer pflaster steine', 'handwerk:fliesenleger': 'fliesenleger hafner plattenleger fliesen', 'handwerk:lehrling': 'lehrling lehrjahr bau handwerk',
    'bagger:bagger': 'baggerfahrer bagger maschinist', 'bagger:lader': 'radlader laderfahrer lader', 'bagger:kran': 'kranfahrer kran', 'klein:tour': 'kleintransport kurier zusteller sprinter transporter', 'klein:baustelle': 'kleintransport handwerker transporter', 'klein:fern': 'kurier express transporter',
    'lager:lager': 'lager lagerarbeiter staplerfahrer stapler hilfsarbeiter kommissionierer', 'lager:lehrling': 'lehrling lagerlogistik',
    'mechaniker:kfz': 'kfz mechaniker mechatroniker werkstatt auto automechaniker', 'mechaniker:schlosser': 'schlosser schweisser metallbauer', 'mechaniker:spengler': 'karosseriebauer karosserie spengler', 'mechaniker:lackierer': 'lackierer autolackierer', 'mechaniker:leiter': 'werkstattleiter meister', 'mechaniker:lehrling': 'lehrling mechaniker kfz',
    'buero:buero': 'buero verwaltung disposition disponent sekretariat sachbearbeiter buchhaltung angestellte empfang reisebüro reisebuero reiseberater immobilien hausverwaltung makler steuerberater steuerberatung wirtschaftsprüfer lohnverrechnung bilanzbuchhalter ingenieurbüro unternehmensberatung finanzdienstleister entsorgung', 'buero:lehrling': 'lehrling buerokaufmann buerokauffrau verwaltung', 'aussendienst': 'aussendienst vertrieb verkauf vertreter',
    'handel:verkauf': 'verkaeufer verkauf kassa kassier einzelhandel supermarkt', 'handel:theke': 'baecker fleischer metzger feinkost theke baeckerei', 'handel:lager': 'warenuebernahme lager handel', 'handel:leitung': 'filialleiter filialleitung stellvertretung', 'handel:lehrling': 'lehrling einzelhandel',
    'gastro:service': 'kellner kellnerin service bar barkeeper', 'gastro:kueche': 'koch koechin kueche hilfskoch', 'gastro:chef': 'kuechenchef chefkoch koch', 'gastro:rezeption': 'rezeption empfang hotel', 'gastro:housekeeping': 'zimmermaedchen zimmerservice housekeeping', 'gastro:betrieb': 'kantine catering betriebskueche', 'gastro:lehrling': 'lehrling koch restaurantfachmann hotel',
    'reinigung:unterhalt': 'reinigung reinigungskraft putzfrau buero', 'reinigung:hotel': 'hotelreinigung reinigung zimmer', 'reinigung:haus': 'hausbetreuung hausbesorger wohnhausanlage privathaushalt', 'reinigung:pflegeheim': 'reinigung krankenhaus pflegeheim spital', 'reinigung:sonder': 'fensterputzer fassade glasreinigung sonderreinigung', 'reinigung:lehrling': 'lehrling reinigungstechnik',
    'lebensmittel:backstube': 'baecker backstube baeckerei produktion konditor teig ofen mischer', 'lebensmittel:verkauf': 'baeckerei verkauf ladner verkaeufer backwaren', 'lebensmittel:fahrer': 'brotausfahrer zustellung baeckerei fahrer kraftfahrer brot', 'lebensmittel:lehrling': 'lehrling baecker baeckerei',
    'konditor:backstube': 'konditor konditorei patissier torte kuchen backstube produktion', 'konditor:verkauf': 'konditorei verkauf ladner verkaeufer cafe', 'konditor:fahrer': 'konditorei zustellung fahrer kraftfahrer', 'konditor:lehrling': 'lehrling konditor konditorei',
    'optiker:beratung': 'optiker augenoptiker brille kontaktlinsen verkauf beratung', 'optiker:werkstatt': 'optiker werkstatt brillenfertigung schleifen augenoptik', 'optiker:leitung': 'filialleiter filialleitung stellvertretung optiker', 'optiker:lehrling': 'lehrling optiker augenoptik',
    'fleischer:produktion': 'fleischer metzger fleischerei wurst selcher schlachter fleischverarbeitung', 'fleischer:verkauf': 'fleischerei verkauf ladner fleischverkauf metzgerei', 'fleischer:fahrer': 'fleischerei zustellung fahrer kraftfahrer', 'fleischer:lehrling': 'lehrling fleischer metzger fleischverarbeitung',
    'bahn:lokfuehrer': 'wiener lokalbahnen badner bahn privatbahn straßenbahnfahrer strassenbahn lokführer lokfuehrer triebfahrzeugführer triebfahrzeugfuehrer lok zug oebb öbb westbahn bahn', 'bahn:zugbegleiter': 'schaffner zugbegleiter zugbegleiterin zug bahn oebb öbb westbahn', 'bahn:fahrdienst': 'fahrdienstleiter verschub rangierer verschieber bahnhof bahn oebb öbb', 'bahn:bahnhof': 'bahnhof service verkauf fahrkarten reisezentrum bahn oebb öbb', 'bahn:technik': 'werkstätte werkstaette gleisbau wagenmeister technik bahn oebb öbb', 'bahn:buero': 'büro buero verwaltung bahn oebb öbb', 'bahn:kueche': 'küchenchef kuechenchef küchenchefstellvertreter koch köchin kuechenhilfe küchenhilfe kantine küche kueche gastronomie speisesaal oebb öbb bahn', 'bahn:bordgastro': 'bordgastronomie zugkellner schlafwagen liegewagen nachtzug bordservice gastronomie oebb öbb bahn', 'bahn:lehrling': 'lehrling bahn oebb öbb gleisbau',
    'bus:linie': 'buslenker busfahrer busfahrerin linienbus postbus omnibus autobus chauffeur', 'bus:reise': 'reisebus busfahrer gelegenheitsverkehr ausflug fernreise omnibus', 'bus:taxi': 'taxi taxilenker taxifahrer mietwagen uber bolt chauffeur', 'bus:schueler': 'schülertransport schuelertransport krankentransport krankenbeförderung behindertentransport schulbus', 'bus:werkstatt': 'buswerkstatt busgarage tankwart garagenarbeiter',
    'gaertner:garten': 'gärtner gaertner landschaftsgärtner gartenbau galabau gartengestaltung baumpflege rasen pflaster gartenarbeiter', 'gaertner:gaertnerei': 'gärtnerei gaertnerei baumschule pflanzen glashaus gemüsebau zierpflanzen florist', 'gaertner:greenkeeper': 'greenkeeper golfplatz sportplatz platzwart rasenpflege', 'gaertner:forst': 'forstarbeiter waldarbeiter holzfäller holzernte harvester forwarder seilkran forsttechniker forst', 'gaertner:lehrling': 'lehrling gärtner gartenbau forsttechnik lehre',
    'industrie:produktion': 'chemiearbeiter chemie pharma kunststoff papierfabrik papiermacher zellstoff textilarbeiter weberei spinnerei näherei produktionsarbeiter maschinenbediener fabrik fabrikarbeiter industriearbeiter fertigung fließband cnc dreher fräser metallindustrie voest', 'industrie:schicht': 'schichtarbeiter schichtdienst nachtschicht dreischicht fabrik', 'industrie:instandhaltung': 'instandhalter betriebsschlosser betriebselektriker wartung instandhaltung', 'industrie:montage': 'monteur montage industriemontage anlagenbau', 'industrie:lager': 'staplerfahrer lagerarbeiter industrie versand', 'industrie:lehrling': 'lehrling metalltechnik mechatronik industrie lehre',
    'post:zustellung': 'post zusteller briefträger briefzusteller paketzusteller zustellung paket brief postauto dhl dpd gls hermes amazon', 'post:verteil': 'verteilzentrum sortierung sortierer postverteilzentrum paketzentrum logistikzentrum', 'post:filiale': 'postpartner postfiliale schalter postamt', 'post:lehrling': 'lehrling post logistik speditionslogistik',
    'ordination:sekretariat': 'ordination arztpraxis praxis sekretariat anmeldung empfang arzthelferin', 'ordination:assistenz': 'ordinationsassistenz assistenz arztassistentin zahnarzt zahnarztassistenz prophylaxe mfa', 'ordination:labor': 'labor röntgen radiologie physiotherapie therapie pflege masseur hebamme', 'ordination:lehrling': 'lehrling ordinationsassistenz ordination lehre',
    'zahntechnik:labor': 'zahntechniker zahntechnik dentallabor zahnersatz prothetik keramik zahnlabor', 'zahntechnik:assistenz': 'zahntechnische fachassistenz assistenz hilfskraft modellguss gips', 'zahntechnik:leitung': 'laborleiter laborleitung meister büro verwaltung zahntechnikermeister', 'zahntechnik:lehrling': 'lehrling zahntechniker zahntechnik lehre',
    'handwerk:glaser': 'glaser glasbau verglasung fensterglas isolierglas bleiglas', 'handwerk:tapezierer': 'tapezierer polsterer polstermöbel sitzmöbel möbelbezug dekorateur', 'handwerk:steinmetz': 'steinmetz steinarbeiter grabstein naturstein kunststein steinbildhauer granit marmor', 'handwerk:bodenleger': 'bodenleger parkett laminat teppichboden vinylboden bodenbelag', 'textilreinigung:reiniger': 'textilreiniger wäscher wäscherei reinigung chemischreinigung färber teppichreinigung', 'textilreinigung:hilfskraft': 'hilfskraft ladner annahme bügler bügeln pressen wäscherei', 'textilreinigung:lehrling': 'lehrling textilreinigung wäscherei lehre',
    'rauchfangkehrer:geselle': 'rauchfangkehrer kaminkehrer rauchfang kamin feuerstätte abgasmessung geselle', 'rauchfangkehrer:ohne': 'rauchfangkehrer hilfskraft gehilfe ohne lehrabschluss kamin', 'rauchfangkehrer:lehrling': 'lehrling rauchfangkehrer kaminkehrer lehre',
    'handwerk:bauhilfsgewerbe': 'fassader stuckateur gipser trockenbau dämmung isolierer wärmedämmung putz fassade', 'schaedling:bekaempfer': 'schädlingsbekämpfer kammerjäger schädlingsbekämpfung ratten ungeziefer deratisierung', 'schaedling:lehrling': 'lehrling schädlingsbekämpfung lehre', 'kunststoff:maschine': 'kunststoffverarbeiter spritzguss extruder maschinenarbeiter kunststofftechnik', 'kunststoff:hilfskraft': 'hilfskraft verpacken reinigung lager kunststoff', 'kunststoff:lehrling': 'lehrling kunststoff kunststofftechnik lehre',
    'garage:arbeiter': 'tankwart tankstelle garage werkstatthilfe autowäsche waschstraße parkgarage', 'garage:angestellte': 'tankstelle kassa kassier verkauf büro garage shop', 'kosmetik:kosmetik': 'kosmetiker kosmetik kosmetikstudio gesichtspflege visagistik nagelstudio', 'kosmetik:fusspflege': 'fußpfleger fusspflege pediküre podologie', 'kosmetik:massage': 'masseur massage massagepraxis wellness', 'kosmetik:lehrling': 'lehrling kosmetik fußpflege massage lehre',
    'seilbahn:betrieb': 'seilbahn schilift skilift lift gondel sessellift liftwart maschinist stationsbediensteter bergbahn', 'seilbahn:piste': 'pistenraupe pistengerät pistenrettung beschneiung schneekanone schneemacher pistendienst', 'seilbahn:kassa': 'liftkassa kassier skipass kartenverkauf seilbahn büro', 'seilbahn:lehrling': 'lehrling seilbahntechnik seilbahn lehre',
    'gaertner:agrar': 'landwirtschaft agrar lohnunternehmen lohndrusch traktorfahrer mähdrescher erntehelfer maschinenring agrarservice feldarbeit',
    'lmindustrie:produktion': 'lebensmittelindustrie lebensmittel produktion verpackung tiefkühl obst gemüse konserven fabrik fließband', 'lmindustrie:fleisch': 'fleischwaren wurst wurstwaren fleischindustrie zerlegung schlachthof selcher', 'lmindustrie:getraenke': 'getränke limonade mineralwasser abfüllung brauerei fruchtsaft', 'lmindustrie:lager': 'lager stapler kommissionierung zustellung lebensmittel', 'lmindustrie:lehrling': 'lehrling lebensmitteltechnik',
    'kino:vorfuehrung': 'kino filmvorführer vorführer operateur haustechnik lichtspiel', 'kino:kassa': 'kino kassa kinokasse büffet buffet billeteur einlass popcorn',
    'rettung:rs': 'rettung rettungssanitäter sanitäter rotes kreuz rettungsdienst krankentransport ktw rtw btw einsatzfahrer samariter samariterbund asb grünes kreuz johanniter malteser rettungsfahrer sanitätsdienst patiententransport', 'rettung:nfs': 'notfallsanitäter nfs nef naw notarztwagen notfall', 'rettung:leitstelle': 'leitstelle disponent dienstführer wachführer rettung', 'rettung:hilfe': 'rettung hilfskraft reinigung rotes kreuz werkstatt', 'rettung:lehrling': 'lehrling rotes kreuz samariterbund bürokaufmann bürokauffrau lehre',
    'friseur:friseur': 'friseur friseurin frisoer haare salon', 'friseur:angelernt': 'angelernt hilfskraft salon waschen friseur', 'friseur:salon': 'salonleiter salonleitung friseurmeister meister friseur', 'friseur:lehrling': 'lehrling friseur friseurin',
    'security:wach': 'security wachdienst portier objektschutz sicherheit', 'security:service': 'sicherheitsdienst empfang kassa', 'security:mobil': 'streife mobiler dienst security', 'security:veranstaltung': 'veranstaltung security ordner', 'security:flughafen': 'flughafen security passagierkontrolle',
    'pflege:pa': 'pflegeassistent pflegeassistenz pfleger altenpfleger kuranstalt kurhaus reha rehabilitation rehaklinik heilmasseur', 'pflege:pfa': 'pflegefachassistent pflegefachassistenz', 'pflege:dgkp': 'diplomierte krankenschwester krankenpfleger gesundheits krankenpflege dgkp', 'pflege:heimhilfe': 'heimhilfe betreuung sozialbetreuer altenbetreuer behindertenbetreuer', 'pflege:mobil': 'mobile pflege hauskrankenpflege hauskrankenschwester', 'pflege:lehrling': 'lehrling pflege pflegelehre',
    'bund': 'bund ministerium bundesdienst beamter vertragsbediensteter', 'handel': 'handel verkauf', 'anderes': 'etwas anderes sonstiges eigene werte'
  };
  function sNorm(t) { return String(t || '').toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9а-яёіїєґÀ-ɏЀ-ӿ֐-ۿ\s]/g, ' ').replace(/\s+/g, ' ').trim(); }
  function wzSuchListe() {
    var out = [], L = uiLang();
    function tx(t) { var x = L !== 'de' ? uiTr(t, L) : null; return x || t; }
    Object.keys(E.BERUFE).forEach(function (bk) {
      var b = E.BERUFE[bk]; if (b.verborgen) return;
      var keys = b.arten ? Object.keys(b.arten) : [null];
      keys.forEach(function (ak) {
        var nm = ak ? b.arten[ak].name : b.name, id = ak ? bk + ':' + ak : bk;
        out.push({ id: bk + (ak ? ':' + ak : ''), name: nm, feld: ak ? b.name : '', hay: sNorm(nm + ' ' + (ak ? b.name + ' ' : '') + tx(nm) + ' ' + (BERUF_SYN[id] || BERUF_SYN[bk] || '')) });
      });
    });
    return out;
  }
  function wzSuche(q) {
    var box = $('#wz-sres'); if (!box) return;
    var toks = sNorm(q).split(' ').filter(function (x) { return x.length >= 2; });
    if (!toks.length) { box.innerHTML = ''; return; }
    var res = wzSuchListe().filter(function (e) { return e.id !== 'anderes' && toks.every(function (t) { return e.hay.indexOf(t) >= 0; }); }).slice(0, 6);
    box.innerHTML = res.length ? res.map(function (e) { return '<button type="button" class="btn wzopt" data-ws="' + e.id + '">' + esc(e.name) + (e.feld ? '<small> · ' + esc(e.feld) + '</small>' : '') + '</button>'; }).join('') : '<p class="hint">Dazu habe ich nichts gefunden. Wähle unten dein Berufsfeld, oder tippe auf „Mein Beruf ist nicht dabei“.</p>';
    try { uiApply(box); } catch (e) { }
  }
  function berufeSortiert() {
    return Object.keys(E.BERUFE).sort(function (a, b) {
      if (a === 'anderes') return 1; if (b === 'anderes') return -1;
      return E.BERUFE[a].name.localeCompare(E.BERUFE[b].name, 'de');
    });
  }
  function miaFelder(w) {
    return '<div class="miachoose">' +
        ['w', 'm'].map(function (f) { return '<button type="button" class="miaopt' + (w.mia === f ? ' on' : '') + '" data-wm="' + f + '">' + miaSvg(f) + '<span>' + (f === 'w' ? 'Weiblich' : 'Männlich') + '</span></button>'; }).join('') + '</div>' +
        '<div class="field"><label for="wz-vn">Dein Vorname</label><input type="text" id="wz-vn" maxlength="40" autocomplete="given-name" data-wf="vorname" value="' + esc(w.vorname || '') + '"></div><div class="field"><label for="wz-nn">Dein Nachname (kommt auf deine Berichte)</label><input type="text" id="wz-nn" maxlength="60" autocomplete="family-name" data-wf="nachname" value="' + esc(w.nachname || '') + '"></div>' +
        '<div class="field"><label for="wz-mianame">Wie soll sie oder er heißen?</label><input type="text" id="wz-mianame" maxlength="20" autocomplete="off" data-wf="miaName" placeholder="' + (w.mia === 'm' ? 'Milo' : 'Mia') + '" value="' + esc(w.miaName || '') + '"></div>';
  }
  function wzRender() {
    var w = ui.wiz, el = $('#wiz-body'), i = WZ_ORDER.indexOf(w.step), nSteps = 4, html = '';
    var shown = Math.min(i, 3) + (w.step === 'art' ? 0 : 1) + (i > 1 ? -1 : 0); // Schritt 1 (Beruf+Art), 2, 3, 4
    var einf = E.BERUFE[w.beruf] && E.BERUFE[w.beruf].einfach;
    var off = w.mode === 'start' ? 1 : 0, num = w.step === 'mia' ? 1 : (w.step === 'beruf' || w.step === 'art' ? 1 : w.step === 'bausteine' ? 2 : w.step === 'kv' ? 3 : 4) + off;
    if (w.mode === 'start') { nSteps = 3; num = (w.step === 'beruf' || w.step === 'art') ? 1 : w.step === 'kv' ? 2 : 3; }
    var say = { mia: 'Hallo! Wen möchtest du an deiner Seite haben?', beruf: 'Damit ich alles passend einrichte: Was machst du?', art: 'Noch eine Frage, dann weiß ich es.', bausteine: 'Sag mir, was du aufzeichnen willst. Den Rest blende ich aus.', kv: 'Der Kollektivvertrag steht auf deinem Lohnzettel.', lohn: 'Fast fertig. Jetzt noch dein Lohn.' }[w.step] || '';
    var wo = E.BERUFE[w.beruf] ? miaOutfit(w.beruf, w.art) : [];
    var sc = ''; // keine Fahrzeug-Szene mehr: nur Mia
    if (sc) html += '<div class="wzscene">' + sc + '<div class="wzsay">' + esc(say) + '</div></div>';
    else html += '<div class="wzmia">' + miaSvg(w.mia === 'm' ? 'm' : 'w', wo, '') + '<div class="wzsay">' + esc(say) + '</div></div>';
    html += '<p class="wzstep"><span>Schritt ' + num + ' von ' + nSteps + '</span>' + (w.mode === 'change' ? '<span> · gilt ab ' + esc(fmtDate(w.ab)) + '</span>' : '') + (w.step === 'mia' || w.step === 'bausteine' ? '<span class="need opt">Optional</span>' : '<span class="need must">Unbedingt nötig</span>') + '</p>';
    if (w.step === 'beruf') {
      html += '<h3>Was machst du beruflich?</h3><div class="field"><label for="wz-such">Beruf suchen (optional)</label><input type="search" id="wz-such" maxlength="40" autocomplete="off" placeholder="zum Beispiel Spengler, Koch, Lkw"><div id="wz-sres" class="wzlist"></div></div><div class="btns"><button type="button" class="btn" id="wz-scan">Mit Lohnzettel einrichten (optional)</button></div><div class="wzlist">' + berufeSortiert().filter(function (k) { return !E.BERUFE[k].verborgen || w.beruf === k; }).map(function (k) { return '<button type="button" class="btn wzopt' + (w.beruf === k ? ' on' : '') + '" data-wb="' + k + '">' + esc(E.BERUFE[k].name) + '</button>'; }).join('') + '</div>' +
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
      var mitLand = berufHatLand(w.beruf), wl = landAT(), kvL = mitLand && wl ? kvs.filter(function (k) { var x = E.kvLand(k); return x && x.indexOf(wl) >= 0; }) : [];
      if (kvL.length) { kvs = kvL.concat(kvs.filter(function (k) { return kvL.indexOf(k) < 0; })); }
      if (w.scan && !w.scanDone) { w.scanDone = true; lzAnwenden(w, w.scan.k, w.scan.tr); }
      if (!w.kvGewaehlt && kvs.indexOf(w.paket) !== 0) { w.paket = kvs[0]; var pv = E.PAKETE[w.paket].werte; w.wochen = pv.ueberstunden.wochenStd; w.dsatz = pv.diaeten.modell === 'stunde' ? pv.diaeten.satz : ''; w.lg = null; w.ls = null; }
      var cp = E.PAKETE[w.paket];
      var kvAt = kvs.filter(function (k) { return k !== 'eigen' && String(k).indexOf('de_') !== 0; }), auto = (ak && String(ak).indexOf('de_') !== 0) ? ak : (kvL.length === 1 ? kvL[0] : (kvAt.length === 1 ? kvAt[0] : null));
      var kvListe = '<div class="wzlist">' + kvs.map(function (k) { return '<button type="button" class="btn wzopt' + (w.paket === k ? ' on' : '') + '" data-wk="' + k + '">' + (k === 'eigen' ? 'Weiß ich nicht / eigene Werte' : esc(E.PAKETE[k].name)) + '</button>'; }).join('') + '</div>';
      html += (auto ? '<h3>Dein Kollektivvertrag</h3><p class="hint">Ich habe ihn anhand deines Berufs ausgewählt. Passt er, tippe auf Weiter. Steht auf deinem Lohnzettel etwas anderes, wähle unten einen anderen.</p>' : '<h3>Welcher Kollektivvertrag gilt für dich?</h3><p class="hint">Steht auf deinem Lohnzettel. Weißt du es nicht, nimm „Weiß ich nicht“ und stelle alles selbst ein.</p>') + (mitLand ? '<div class="field"><label for="wz-land">In welchem Bundesland arbeitest du? (optional, hilft bei der Auswahl)</label><select id="wz-land">' + landOpts(wl) + '</select></div>' : '') + '<div class="btns"><button type="button" class="btn" id="wz-scan">Mit Lohnzettel einrichten (optional)</button></div>' +
        (auto ? '<div class="wzlist"><button type="button" class="btn wzopt on" data-wk="' + w.paket + '">' + (w.paket === 'eigen' ? 'Weiß ich nicht / eigene Werte' : esc(E.PAKETE[w.paket].name)) + '</button></div><details class="wzfehlt"><summary>Anderen Kollektivvertrag wählen</summary>' + kvListe + '</details>' : kvListe) +
        '<details class="wzfehlt"><summary>Wo finde ich das?</summary><p class="hint">Auf deinem Lohnzettel oder im Dienstvertrag, meist oben unter „Kollektivvertrag“ oder „KV“. Sonst frag im Büro. Weißt du es nicht, nimm „Weiß ich nicht“. Du kannst es später ändern, nichts geht verloren.</p></details>' +
        '<details class="wzfehlt"><summary>Mein Kollektivvertrag ist nicht dabei</summary><div class="field"><label for="wz-kvf">Ich brauche bitte den Kollektivvertrag für …</label><input type="text" id="wz-kvf" maxlength="120" autocomplete="off"></div><button type="button" class="btn" data-wkf="1">An den Entwickler schicken</button></details>' +
        (cp && cp.pruefen && w.paket !== 'eigen' ? '<p class="hint"><strong>Noch nicht an einem echten Lohnzettel geprüft.</strong> Bitte vergleiche die Werte später mit deinem Lohnzettel.</p>' : '') +
        (String(w.paket).indexOf('de_') === 0 ? '<div class="field"><label for="wz-bl">Bundesland (für die Feiertage)</label><select id="wz-bl" data-wf="bl"><option value="">Bitte wählen</option>' + Object.keys(E.BUNDESLAENDER).map(function (k) { return '<option value="' + k + '"' + (w.bl === k ? ' selected' : '') + '>' + E.BUNDESLAENDER[k] + '</option>'; }).join('') + '</select></div>' : '') +
        (w.mode === 'start' ? '<div class="field"><label for="wz-ein">Eintritt in die Firma (optional)</label><input type="date" id="wz-ein" data-wf="eintritt" value="' + esc(w.eintritt) + '"></div>' : '');
    } else if (w.step === 'mia') {
      html += '<h3>Wer bist du, und wer soll dich begleiten?</h3>' + miaFelder(w);
    } else {
      var pw = E.PAKETE[w.paket].werte;
      html += '<h3>Dein Lohn</h3>' +
        lohnGruppenHtml(w) +
        '<div class="field"><label for="wz-lohn">Stundenlohn (€ pro Stunde)</label><input type="number" id="wz-lohn" inputmode="decimal" step="0.01" min="0" data-wf="lohn" value="' + esc(w.lohn) + '"></div>' +
        '<details class="wzfehlt" data-wzmore' + (w.more ? ' open' : '') + '><summary>Weitere Angaben (optional)</summary><p class="hint">Alles andere kannst du später in den Einstellungen ändern. Mia hilft dir dabei.</p>' + (w.mode === 'start' ? miaFelder(w) : '') +
        '<div class="field"><label for="wz-einst">' + (['handel', 'gastro', 'buero', 'de_handel', 'de_gastro', 'de_buero'].indexOf(w.paket) >= 0 ? 'Einstufung auf deinem Lohnzettel (zum Beispiel „Gruppe 3“)' : 'Einstufung auf deinem Lohnzettel (zum Beispiel „Kraftfahrer 3a“ oder „LG 1/A“)') + '</label><input type="text" id="wz-einst" maxlength="60" data-wf="einst" value="' + esc(w.einst || '') + '"></div>' +
((E.BERUFE[w.beruf] || {}).einfach || w.monat || String(w.paket).indexOf('de_') === 0 ? '<div class="field"><label for="wz-monat">Fixer Monatslohn (€ brutto, optional)</label><input type="number" id="wz-monat" inputmode="decimal" step="0.01" min="0" data-wf="monat" value="' + esc(w.monat || '') + '"></div>' : '') +
'<div class="field"><label for="wz-wo">Wochenstunden</label><input type="number" id="wz-wo" inputmode="decimal" step="0.5" min="0" data-wf="wochen" value="' + esc(w.wochen) + '"></div>' +
(w.diaeten && (pw.diaeten.modell === 'stunde' || pw.diaeten.modell === 'aus') ? '<div class="field"><label for="wz-ds">Diäten (€ pro Stunde)</label><input type="number" id="wz-ds" inputmode="decimal" step="0.01" min="0" data-wf="dsatz" value="' + esc(w.dsatz) + '"></div>' : '') + '</details>' +
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
    ov.addEventListener('toggle', function (ev) { if (ui.wiz && ev.target.hasAttribute && ev.target.hasAttribute('data-wzmore')) ui.wiz.more = ev.target.open; }, true);
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
      if (t.dataset.wa) { wzSetArt(t.dataset.wa); wzNext(); return; }
      if (t.dataset.ws) { var sp = t.dataset.ws.split(':'); wzSetBeruf(sp[0]); wzNext(); if (sp[1]) { wzSetArt(sp[1]); wzNext(); } return; }
      if (t.dataset.wm) { w.mia = t.dataset.wm; wzRender(); return; }
      if (t.dataset.wk) { w.paket = t.dataset.wk; w.kvGewaehlt = true; var kl0 = E.kvLand(w.paket); if (kl0 && kl0.length === 1 && !landAT()) landSetzen(kl0[0]); var p = E.PAKETE[w.paket].werte; w.wochen = p.ueberstunden.wochenStd; w.dsatz = p.diaeten.modell === 'stunde' ? p.diaeten.satz : ''; wzRender(); return; }
      if (t.id === 'wz-scan') { lzUi.modus = 'einr'; lzOpen(); return; }
      if (t.id === 'wz-next') { wzNext(); return; }
      if (t.id === 'wz-back') { wzBack(); return; }
    });
    ov.addEventListener('change', function (ev) { var t = ev.target; if (!ui.wiz) return; if (t.dataset.wc) { var k = t.dataset.wc; if (k === 'diaeten' || k === 'sw') ui.wiz[k] = t.checked; else ui.wiz.b[k] = t.checked; } });
    ov.addEventListener('input', function (ev) { var t = ev.target; if (ui.wiz && t.id === 'wz-such') { wzSuche(t.value); return; } if (ui.wiz && t.dataset.wf && t.tagName !== 'SELECT') ui.wiz[t.dataset.wf] = t.value; });
    ov.addEventListener('change', function (ev) { var t = ev.target; if (ui.wiz && t.id === 'wz-land') { landSetzen(t.value); ui.wiz.kvGewaehlt = false; wzRender(); return; } if (ui.wiz && t.dataset && t.dataset.wfc) { if (t.dataset.wfc === 'statistik') ui.wiz.cStat = t.checked; else ui.wiz.cMia = t.checked; return; } if (ui.wiz && t.tagName === 'SELECT' && (t.dataset.wf === 'lg' || t.dataset.wf === 'ls')) { ui.wiz[t.dataset.wf] = t.value; if (t.dataset.wf === 'lg') ui.wiz.ls = ''; lohnVorschlag(ui.wiz); wzRender(); } });
    $('#kv-send').addEventListener('click', function () {
      var f = { name: $('#kv-name').value.trim(), gruppe: $('#kv-gruppe').value.trim(), branche: $('#kv-branche').value.trim(), wst: $('#kv-wst').value.trim() };
      if (!f.name && !f.gruppe) { toast('Bitte trage mindestens den Kollektivvertrag oder die Einstufung ein.'); return; }
      if (!data.profil) data.profil = {}; data.profil.kv = f; save();
      var tx = 'Kollektivvertrag: ' + (f.name || '-') + ' | Einstufung: ' + (f.gruppe || '-') + ' | Branche: ' + (f.branche || '-') + ' | Wochenstunden: ' + (f.wst || '-');
      try { window.StundenInsights.feedback('wunsch', '[Mein Kollektivvertrag] ' + tx, null).then(function () { toast('Danke! Wir prüfen deinen Kollektivvertrag und melden uns.'); ins('kv_gemeldet'); }, function () { toast('Gespeichert. Das Senden hat nicht geklappt, bitte später noch einmal probieren.'); }); } catch (e) { toast('Gespeichert. Das Senden hat nicht geklappt, bitte später noch einmal probieren.'); }
    });
    [['s-titelvor', 'titelVor'], ['s-vorname', 'vorname'], ['s-nachname', 'nachname'], ['s-titelnach', 'titelNach']].forEach(function (q) { $('#' + q[0]).addEventListener('change', function () { if (!data.profil) data.profil = {}; data.profil[q[1]] = this.value.trim(); save(); }); });
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
    $('#s-land').addEventListener('change', function () { landSetzen(this.value); renderSettings(); });
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
    if ($('#c-praem')) $('#c-praem').checked = !!co.praemien;
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
      var lgx = E.lgFuer(E.LOHNGRUPPEN[cur.paket], cur.gueltigAb), gx = lgx && lgx.gruppen.filter(function (x) { return x.id === cur.lg; })[0];
      kvv.name = (E.PAKETE[cur.paket] && E.PAKETE[cur.paket].name) || '';
      kvv.gruppe = cur.einstufung || (gx ? gx.name + (lgx.stufen && cur.ls != null && cur.ls !== '' ? ', ' + (lgSt(lgx, gx)[+cur.ls] || '') : '') : '');
      kvv.branche = cwb || PAKET_KURZ[cur.paket] || '';
      kvv.wst = String(E.wochenStd(cur.ueberstunden) || '');
    }
    [['name', '#kv-name'], ['gruppe', '#kv-gruppe'], ['branche', '#kv-branche'], ['wst', '#kv-wst']].forEach(function (q) { if (document.activeElement !== $(q[1])) $(q[1]).value = kvp[q[0]] || kvv[q[0]] || ''; });
    var kvc = $('#s-kv-cur'); if (kvc) kvc.textContent = kvv.name ? ': ' + (PAKET_KURZ[cur.paket] || kvv.name) : '';
    $('#lz-chk').checked = !!(data.profil && data.profil.lzLesen === true);
    [['s-titelvor', 'titelVor'], ['s-vorname', 'vorname'], ['s-nachname', 'nachname'], ['s-titelnach', 'titelNach']].forEach(function (q) { if (document.activeElement !== $('#' + q[0])) $('#' + q[0]).value = (data.profil && data.profil[q[1]]) || ''; });
    if (document.activeElement !== $('#s-geb')) $('#s-geb').value = (data.profil && data.profil.geb) || '';
    $('#s-ansichtsel').value = (data.profil && data.profil.monatAnsicht) || 'liste';
    fotoZeigen(); $('#s-luecke').checked = !(data.profil && data.profil.lueckenFrage === false); $('#s-tagf').checked = !!(data.profil && data.profil.tagesfuehrung === true);
    if (document.activeElement !== $('#s-firma')) $('#s-firma').value = (data.profil && data.profil.firma) || '';
    var sl0 = $('#s-land'); if (sl0) { if (!sl0.options.length) { sl0.innerHTML = landOpts(''); try { uiApply(sl0); } catch (e) { } } sl0.value = landAT(); }
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
      if (inp.dataset.type === 'zuart') inp.checked = v !== 'kv';
      else if (inp.type === 'checkbox') inp.checked = inp.dataset.path === 'ueberstunden.zaAusgleich' ? v !== false : !!v;
      else inp.value = (v === null || v === undefined) ? '' : v;
    });
    
    $('#s-paket').innerHTML = Object.keys(E.PAKETE).map(function (k) { return '<option value="' + k + '"' + (en.paket === k ? ' selected' : '') + '>' + esc(E.PAKETE[k].name) + '</option>'; }).join('');
    paketInfo(en); zuHint(en); kvWarn(en);
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
        return '<li' + (cur ? ' class="cur"' : '') + '><span>' + (next ? fmtDate(r.ab) + ' bis ' + fmtDate(bis) : 'ab ' + fmtDate(r.ab)) + '</span><strong>' + eur.format(r.v) + (cur ? ' · ' + uiTr('aktuell') : '') + '</strong>' + (i > 0 ? '<button type="button" class="vl-x" data-act="v-del" data-ab="' + esc(r.ab) + '" aria-label="Diese Änderung ab ' + fmtDate(r.ab) + ' entfernen">×</button>' : '') + '</li>';
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
    var ZG = { handel: 1, handel_arb: 1, it_ang: 1, versicherung_ang: 1, gewerbe_ang: 1, metall: 3, bund: 4, de_spedition: 5, de_spedition_nrw: 5, de_spedition_by: 5, de_logistik_sn: 5, de_spedition_sonst: 5, de_bau: 5, de_handel: 5, de_buero: 5, de_metall: 5, de_gastro: 5, eigen: 0 };
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
  function stufeAusEintritt(ref, ref2) {
    var e = data.profil && data.profil.eintritt; if (!e || !validISO(e)) return '';
    var y = (new Date(ref + 'T00:00:00') - new Date(e + 'T00:00:00')) / 31557600000; if (!(y >= 0)) return '';
    var sw = (ref2 && ref2.schwellen) || [5, 10, 15, 20], k = 0; while (k < sw.length && y >= sw[k]) k++; return k;
  }
  function renderLgBox(en) {
    var box = $('#s-lgbox'); if (!box) return;
    var lg = E.lgFuer(E.LOHNGRUPPEN[en.paket], en.gueltigAb), gl = lg ? lgListe(lg, en.art, en.lg, en.beruf) : [];
    if (!lg || !gl.length) { box.innerHTML = ''; box.dataset.val = ''; var tk0 = $('#s-lgtake'); if (tk0) tk0.innerHTML = ''; return; }
    var g = lg.gruppen.filter(function (x) { return x.id === en.lg; })[0];
    var h = '<div class="field"><label for="s-lg">' + (en.art === 'lehrling' ? 'Lehrjahr laut Kollektivvertrag' : 'Lohngruppe laut Kollektivvertrag') + ' (' + esc(lg.stand) + ')</label><small>Die Lohngruppe (oder Einstufung) bestimmt, welchen Mindestlohn dir der Kollektivvertrag zusteht. Du musst sie nicht kennen: Trage einfach deinen Stundenlohn vom Lohnzettel ein. Kennst du sie, kann die App prüfen, ob dein Lohn dem Kollektivvertrag entspricht. Du findest sie oben auf dem Lohnzettel (bei „Einstufung“, „Lohngruppe“ oder „Verwendungsgruppe“) oder im Dienstvertrag. Steht sie nirgends, frag in der Firma nach.</small><select id="s-lg"><option value="">Nicht gewählt</option>' +
      gl.map(function (x) { return '<option value="' + esc(x.id) + '"' + (en.lg === x.id ? ' selected' : '') + '>' + esc(x.name) + '</option>'; }).join('') + '</select></div>';
    var stuf = !!(g && lg.stufen && g.l.length > 1);
    if (stuf) {
      var ls = en.ls == null || en.ls === '' ? (lg.eintritt ? stufeAusEintritt(en.gueltigAb, lg) : '') : en.ls;
      h += '<div class="field"><label for="s-ls">Stufe</label><select id="s-ls"><option value="">Bitte wählen</option>' + lgSt(lg, g).map(function (s, i) { return '<option value="' + i + '"' + (String(ls) === String(i) ? ' selected' : '') + '>' + esc(s) + '</option>'; }).join('') + '</select></div>';
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

  var ZU_KV = 'Zuschlag in Prozent für Stunden an diesem Tag, wie im Kollektivvertrag. Die Stunden zählen einfach, der Zuschlag steht in einer eigenen Zeile. Überstunden am Sonntag bekommen nur den höheren Zuschlag, nicht beide. Am Feiertag kommt die gesetzliche Bezahlung von selbst dazu (Feiertagsentgelt plus gearbeitete Stunden), trage hier nur einen Zuschlag ein, den es darüber hinaus gibt. Wenn du es nicht weißt, lass 0 stehen.';
  var ZU_FIRMA = 'Deine Firma zählt die Zuschläge als zusätzliche Stunden: Bei 100 % zählt eine Stunde doppelt und läuft in die Überstunden. Die App rechnet so mit und zeigt bei den Abweichungen daneben, was nach Kollektivvertrag und Gesetz herauskäme.';
  function zuHint(en) { var h = $('#s-zu-hint'); if (h) h.textContent = en && en.zuschlag && en.zuschlag.art === 'kv' ? ZU_KV : ZU_FIRMA; }
  function unterKvTexte(en, dat) {
    var u = E.unterKv(en, dat), t = []; if (!u) return t;
    if (u.lohn) t.push(abw1(u.lohn.monat ? 'Dein Monatslohn ({0}) liegt unter dem Kollektivvertrag für deine Lohngruppe ({1}). Prüfe die Lohngruppe und deinen Lohnzettel. Stimmt beides, frag bei der Arbeiterkammer nach.' : 'Dein Stundenlohn ({0}) liegt unter dem Kollektivvertrag für deine Lohngruppe ({1}). Prüfe die Lohngruppe und deinen Lohnzettel. Stimmt beides, frag bei der Arbeiterkammer nach.', [eur.format(u.lohn.ist), eur.format(u.lohn.kv)]));
    if (u.diaet) t.push(abw1('Dein Diätensatz ({0} je Stunde) liegt unter dem Kollektivvertrag ({1} je Stunde). Prüfe deinen Lohnzettel. Stimmt es, frag bei der Arbeiterkammer nach.', [eur.format(u.diaet.ist), eur.format(u.diaet.kv)]));
    return t;
  }
  function kvWarn(en) { var b = $('#s-kvwarn'); if (!b) return; var t = en ? unterKvTexte(en, en.gueltigAb > todayISO() ? en.gueltigAb : todayISO()) : []; b.hidden = !t.length; b.innerHTML = t.map(function (x) { return '<p style="margin:0 0 4px">' + esc(x) + '</p>'; }).join(''); }
  function onSettingInput(inp) {
    var en = curEntry(); if (!en) return;
    var t = inp.dataset.type, v;
    if (inp.dataset.path === 'gueltigAb') return; // wird bei "change" behandelt
    if (t === 'zuart') v = inp.checked ? 'stunden' : 'kv';
    else if (t === 'bool') v = inp.checked;
    else if (t === 'num') { v = parseFloat(String(inp.value).replace(',', '.')); if (isNaN(v)) v = 0; }
    else if (t === 'numnull') { v = String(inp.value).trim() === '' ? null : parseFloat(String(inp.value).replace(',', '.')); if (v !== null && isNaN(v)) v = null; }
    else v = inp.value;
    setPath(en, inp.dataset.path, v);
    if (t === 'zuart' && v === 'kv') { // Umstellen auf Kollektivvertrag: auch die Prozentsätze des Kollektivvertrags nehmen (bei 'als Stunden' hieß 100 % am Feiertag "zählt doppelt")
      var pz = E.PAKETE[en.paket]; if (pz && en.paket !== 'eigen') en.zuschlag = E.clone(pz.werte.zuschlag);
      [['#s-zsa', 'sa'], ['#s-zso', 'so'], ['#s-zft', 'ft']].forEach(function (x) { var el = $(x[0]); if (el) el.value = en.zuschlag[x[1]]; });
    }
    if (inp.dataset.path === 'stundenlohn' || inp.dataset.path === 'monatslohn') en.lgAuto = false;
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
    settingsVisibility(en); zuHint(en); kvWarn(en);
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
    var ex = E.neuerWertesatz('gueter', '2026-01-01'); ex.zuschlag = { sa: 0, so: 100, ft: 100 }; ex.ueberstunden.modell = 'tag-saldo'; // so rechnet die Excel
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
      var kid = t.dataset.kj !== undefined ? 'k-t' + t.dataset.kz + '-' + t.dataset.kj : 'k-n' + t.dataset.kz, ke = document.getElementById(kid) || document.getElementById('k-n' + t.dataset.kz); if (ke && ke.closest) { var dk = ke.closest('details.kd'); if (dk) { dk.open = true; (ui.kOpen = ui.kOpen || {})[+dk.dataset.kd] = true; } }
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
      case 'e-copykunde': var kv = kundenVomLetztenTag(); if (kv) { ui.kOpen = {}; ui.edDraft.kunden = kv.map(function (k) { return { name: k.name || '', taet: (k.taet || [{}]).map(function (t) { return { tat: t.tat || '', von: '', bis: '' }; }) }; }); renderKunden(); copyKundeBtn(); updatePreview(); } return;
      case 'e-addkunde': (ui.kOpen = ui.kOpen || {})[ui.edDraft.kunden.length] = true; ui.edDraft.kunden.push({ name: '', taet: [{ tat: '', von: '', bis: '' }] }); renderKunden(); var ki = $('#k-n' + (ui.edDraft.kunden.length - 1)); if (ki) ki.focus(); return;
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
    if (t.dataset.kchip !== undefined) { var kc = ui.edDraft.kunden[+t.dataset.kci]; (ui.kOpen = ui.kOpen || {})[+t.dataset.kci] = true; if (kc) { kc.name = t.dataset.kchip; renderKunden(); updatePreview(); } return; }
    if (t.dataset.tchip !== undefined) { var tp = String(t.dataset.tcs).split('-'), tk = ui.edDraft.kunden[+tp[0]]; if (tk && tk.taet[+tp[1]]) { tk.taet[+tp[1]].tat = t.dataset.tchip; var ti2 = $('#k-t' + t.dataset.tcs); if (ti2) ti2.value = t.dataset.tchip; var tc2 = $('#e-kunden [data-tc="' + t.dataset.tcs + '"]'); if (tc2) tc2.innerHTML = tatChips(t.dataset.tchip, t.dataset.tcs); updatePreview(); } return; }
    if (t.dataset.addt !== undefined) { (ui.kOpen = ui.kOpen || {})[+t.dataset.addt] = true; var kk = ui.edDraft.kunden[+t.dataset.addt]; kk.taet.push({ tat: '', von: '', bis: '' }); renderKunden(); var ti = $('#k-t' + t.dataset.addt + '-' + (kk.taet.length - 1)); if (ti) ti.focus(); return; }
    if (t.dataset.rmt !== undefined) { var pr = t.dataset.rmt.split('-'); ui.edDraft.kunden[+pr[0]].taet.splice(+pr[1], 1); renderKunden(); updatePreview(); return; }
    if (t.dataset.rmk !== undefined) { ui.edDraft.kunden.splice(+t.dataset.rmk, 1); ui.kOpen = {}; renderKunden(); updatePreview(); return; }
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
      case 'e-status': ui.edDraft.status = t.value; $('#e-work').hidden = !mitArbeit(t.value); $('#e-frbox').hidden = t.value !== 'freistellung'; if (t.value !== 'freistellung') { delete ui.edDraft.fv; $('#e-fv').value = ''; } else { freiNote(); } $('#e-erbox').hidden = t.value !== 'ersatzruhe'; if (t.value !== 'ersatzruhe' && t.value !== 'arbeit') delete ui.edDraft.extra; $('#e-erx').value = t.value === 'ersatzruhe' && ui.edDraft.extra ? ui.edDraft.extra : ''; renderPraemienTag(); anChips(); updatePreview(); return;
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
      save(); paintAbgleich();
      if (f === 'ueber' && ui.summe && !ui.abAlle) { // die Zeile „Zeitausgleich-Konto“ kommt dazu oder fällt weg, sobald die Überstunden vom Lohnzettel abweichen
        var braucht = o.ueber != null && +o.ueber < (ui.summe.ueberStd || 0) - 0.25, hat = !!$('#ab-zaKonto');
        if (braucht !== hat && !(hat && o.zaKonto != null)) { renderAbgleich(ui.summe); var ue = $('#ab-ueber'); if (ue) { try { ue.focus(); } catch (e) { } } }
      }
      return;
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
    // Schriften der App in das Bild einbetten. Ohne sie nimmt das Bild eine Ersatzschrift mit anderen Breiten, dann brechen Wörter um und Zeilen überlappen.
    var shotFontCss = null;
    function shotFonts() {
      if (shotFontCss !== null) return Promise.resolve(shotFontCss);
      var lk = document.querySelector('link[rel="stylesheet"][href*="fonts.googleapis.com"]');
      if (!lk || !window.fetch) return Promise.resolve('');
      var zeit = new Promise(function (r) { setTimeout(function () { r(''); }, 4000); });
      var lade = fetch(lk.href).then(function (r) { return r.ok ? r.text() : ''; }).then(function (css) {
        var bl = (css.match(/\/\*[^*]*\*\/\s*@font-face\s*\{[^}]*\}/g) || css.match(/@font-face\s*\{[^}]*\}/g) || []).filter(function (x) { return !/^\/\*/.test(x) || /\/\*\s*latin(-ext)?\s*\*\//.test(x); });
        return Promise.all(bl.map(function (x) {
          var u = /url\((https:[^)]+)\)/.exec(x); if (!u) return '';
          return fetch(u[1]).then(function (r) { return r.blob(); }).then(function (b) { return new Promise(function (ok) { var fr = new FileReader(); fr.onload = function () { ok(x.replace(u[1], fr.result)); }; fr.onerror = function () { ok(''); }; fr.readAsDataURL(b); }); }).catch(function () { return ''; });
        })).then(function (a) { shotFontCss = a.join('\n'); return shotFontCss; });
      }).catch(function () { return ''; });
      return Promise.race([lade, zeit]);
    }
    function shotSeite() { return shotFonts().then(shotSeite2, function () { return shotSeite2(''); }); }
    function shotSeite2(fontCss) {
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
            for (i = 0; i < cs.length; i++) { if ((cs[i] === 'height' || cs[i] === 'block-size') && tag !== 'img' && tag !== 'svg' && tag !== 'canvas' && tag !== 'input' && !o.closest('svg') && cs.display !== 'inline-block' && !(o.children.length === 0 && !o.textContent.trim())) continue; css += cs[i] + ':' + cs.getPropertyValue(cs[i]) + ';'; }
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
          if (fontCss) { var stl = document.createElement('style'); stl.textContent = fontCss; holder.appendChild(stl); }
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
        '<div class="btns"><button type="button" class="btn" id="fs-x">Verwerfen</button><button type="button" class="btn" id="fs-weg">Kurz weglegen</button><button type="button" class="btn primary" id="fs-send">Senden</button></div></div>';
      document.body.appendChild(sheet);
      function m(t, bad) { var e = $('#fs-msg'); e.textContent = t; e.hidden = !t; e.style.color = bad ? 'var(--bad, #b3261e)' : ''; }
      var ffl = function (weg) { var f = $('#fb-float'); if (f && f.lastChild) f.lastChild.textContent = weg ? 'Meldung fortsetzen' : 'Problem melden'; };
      $('#fs-x').addEventListener('click', function () { sheet.hidden = true; sheet.dataset.weg = ''; $('#fs-text').value = ''; ffl(false); });
      $('#fs-weg').addEventListener('click', function () { sheet.hidden = true; sheet.dataset.weg = '1'; ffl(true); });
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
      if (sheet.dataset.weg === '1') { sheet.dataset.weg = ''; sheet.hidden = false; var f0 = $('#fb-float'); if (f0 && f0.lastChild) f0.lastChild.textContent = 'Problem melden'; return; }
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
    on2('#c-praem', 'change', function () { cons('praemien').call(this); praemMelden(); });
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
      fetch('version.json?t=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (j) { if (j && j.v && j.v !== cur) { bar.hidden = false; ui.neueVersion = true; } }).catch(function () { });
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

  /* ---- Schnell erfassen: Text oder Sprache ---- */
  var sqRec = null, sqLast = null, sqAusFoto = false;
  function sqInit() {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition, mic = $('#sq-mic');
    if (mic && SR) mic.hidden = false;
  }
  function sqNamen() { var out = []; try { Object.keys(data.days).sort().reverse().slice(0, 60).forEach(function (k) { kundenNamen(data.days[k]).forEach(function (n) { if (out.indexOf(n) < 0) out.push(n); }); }); } catch (e) { } return out; }
  function sqVerstehen() {
    var t = ($('#sq-text').value || '').trim(), box = $('#sq-res'); if (!t) return;
    var r = E.parseSchnell(t, todayISO(), sqNamen(), uiLang()); if (sqAusFoto) r.kunden = []; sqLast = r;
    var h = '';
    if (r.status === 'arbeit' ? !r.von : false) {
      h = '<div>Ich habe keine Uhrzeit und keine Art des Tages gefunden. Schreib zum Beispiel „von 6 bis 15 Uhr“.</div>'; sqLast = null;
    } else {
      var L = [['Datum', fmtLong(r.datum)]];
      if (r.status !== 'arbeit') L.push(['Art des Tages', E.STATUS[r.status] ? E.STATUS[r.status].name : r.status]);
      else {
        L.push(['Beginn', r.von]); if (r.bis) L.push(['Ende', r.bis]);
        if (r.pause === 0) L.push(['Pause', 'keine']); else if (r.pause) L.push(['Pause', r.pauseVon + ' – ' + r.pauseBis + ' (' + r.pause + ' min)']);
        if (r.kunden.length) L.push(['Kunden', r.kunden.map(function (k) { return k.name + (k.tat ? ' (' + k.tat + ')' : ''); }).join(', ')]);
      }
      h = '<div><strong>Habe ich das richtig verstanden?</strong></div><dl>' + L.map(function (x) { return '<dt>' + x[0] + '</dt><dd>' + esc(x[1]) + '</dd>'; }).join('') + '</dl><div class="btns"><button type="button" class="btn primary" id="sq-ja">Ja, übernehmen</button><button type="button" class="btn" id="sq-nein">Nein, ich ändere den Text</button></div>';
    }
    box.innerHTML = h; box.hidden = false;
  }
  function sqUebernehmen() {
    var r = sqLast; if (!r) return;
    openEditor(r.datum, 'erfassen', true);
    var d = ui.edDraft; d.status = r.status;
    if (r.status === 'arbeit') {
      d.von = r.von; if (r.bis) d.bis = r.bis;
      if (r.pause === 0) d.pausen = [];
      else if (r.pause && r.pauseVon) d.pausen = [{ von: r.pauseVon, bis: r.pauseBis }];
      if (r.kunden.length) d.kunden = r.kunden.map(function (k) { return { name: k.name, taet: [{ tat: k.tat || '', von: '', bis: '' }] }; });
    }
    renderEditor(); $('#sq-res').hidden = true; $('#sq-text').value = ''; sqLast = null;
    toast('Bitte prüfe die Angaben im Formular und tippe dann auf „Speichern“.');
  }
  function sqSprechen() {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition, mic = $('#sq-mic'), st = $('#sq-state');
    if (sqRec) { try { sqRec.stop(); } catch (e) { } return; }
    if (!SR) return;
    var rec = new SR(); sqRec = rec; rec.lang = (MIA_LANGS[uiLang()] || MIA_LANGS.de).sr; rec.interimResults = false; rec.maxAlternatives = 1;
    function ende() { sqRec = null; mic.classList.remove('live'); mic.textContent = uebersetzt('Sprechen'); st.hidden = true; }
    rec.onresult = function (ev) { var t = ''; for (var i = 0; i < ev.results.length; i++) t += ev.results[i][0].transcript + ' '; var ta = $('#sq-text'); ta.value = ((ta.value ? ta.value + ' ' : '') + t.trim()).trim(); sqVerstehen(); };
    rec.onerror = function () { ende(); toast('Die Spracheingabe hat nicht funktioniert. Du kannst auch tippen oder das Mikrofon deiner Tastatur benutzen.'); };
    rec.onend = ende;
    try { rec.start(); mic.classList.add('live'); mic.textContent = uebersetzt('Aufnahme beenden'); st.hidden = false; } catch (e) { ende(); }
  }
  function uebersetzt(t) { var d = uiDict(uiLang()); return (d && d[t]) || t; }
  document.addEventListener('click', function (ev) {
    var b = ev.target.closest && ev.target.closest('button'); if (!b) return;
    if (b.id === 'sq-go') sqVerstehen(); else if (b.id === 'sq-foto') { $('#sq-file').click(); } else if (b.id === 'sq-ja') sqUebernehmen(); else if (b.id === 'sq-nein') { $('#sq-res').hidden = true; $('#sq-text').focus(); } else if (b.id === 'sq-mic') sqSprechen();
  });

  function sqApply() {
    var p = data.profil || {}, t = p.sqText === true, f = p.sqFoto === true, c = $('#sq-card'); if (!c) return;
    c.hidden = !t; var fb = $('#sq-foto'), fp = $('#sq-fotop'); if (fb) fb.hidden = !f; if (fp) fp.hidden = !f;
    var a = $('#sq-set-text'), b = $('#sq-set-foto'); if (a) a.checked = t; if (b) { b.checked = f; b.disabled = !t; }
  }
  function sqFoto(file) {
    var st = $('#sq-fstate'); st.hidden = false; st.textContent = 'Das Foto wird gelesen …'; $('#sq-res').hidden = true;
    window.StundenLz.leseFotos([file]).then(function (o) {
      var t = (o.lines || []).join(', ').replace(/\s+/g, ' ').trim();
      if (!o.hatText || !t) { st.textContent = 'Auf dem Foto konnte ich nichts lesen. Versuche es mit mehr Licht und halte das Handy ruhig.'; return; }
      st.textContent = 'Das habe ich gelesen. Du kannst den Text ändern.'; $('#sq-text').value = t; sqAusFoto = true; sqVerstehen();
    }, function () { st.textContent = 'Auf dem Foto konnte ich nichts lesen. Versuche es mit mehr Licht und halte das Handy ruhig.'; });
  }
  document.addEventListener('input', function (ev) { if (ev.target && ev.target.id === 'sq-text') sqAusFoto = false; });
  document.addEventListener('change', function (ev) {
    var t = ev.target; if (!t || !t.id) return;
    if (t.id === 'sq-text') sqAusFoto = false;
    if (t.id === 'sq-set-text') { data.profil.sqText = !!t.checked; if (t.checked) data.profil.sqHinweis = true; save(); sqApply(); if (t.checked) toast('Fertig. Die Karte „Schnell erfassen“ findest du jetzt ganz oben beim Erfassen. Tippe darauf, dann klappt sie auf.'); }
    else if (t.id === 'sq-set-foto') { data.profil.sqFoto = !!t.checked; save(); sqApply(); }
    else if (t.id === 'sq-file' && t.files && t.files[0]) { var f = t.files[0]; t.value = ''; sqFoto(f); }
  });
  sqInit(); sqApply();
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
  // Eigener Name der Begleiterin: ersetzt „Mia“ in allen Beschriftungen (nicht in der Auswahl Mia/Milo und nicht im Namensfeld)
  function uiMiaName() { try { var c = miaCfg(); return c.name && c.name !== 'Mia' ? c.name : ''; } catch (e) { return ''; } }
  function uiMiaNamen() { if (!uiMiaName() && uiLang() === 'de') { try { uiApply(document.body); } catch (e) {} return; } uiLoad('en', function () { try { uiApply(document.body); } catch (e) {} }); }
  var UI_MIA_RX = /\bMia\b|Миа|Мія/g;
  function uiTextNode(n, L) {
    var pn = n.parentNode; if (pn && pn.closest && pn.closest('.nott')) return; // schon in der richtigen Sprache (z. B. Mias Antworten)
    var cur = n.nodeValue, de = UI_ORIG.get(n);
    if (de !== undefined && UI_SET.get(n) !== cur) de = undefined;
    if (de === undefined) de = cur;
    var t = L !== 'de' ? uiTr(de, L) : null;
    var nm = uiMiaName();
    if (nm && de.indexOf('Mia') >= 0 && de.indexOf('Milo') < 0 && (t || (uiDict('en') && uiTr(de, 'en'))) && !(n.parentNode && n.parentNode.closest && n.parentNode.closest('#mia-choose, .miachoose, [data-wf="mia"], .wzmia'))) { var bs = t || de; UI_MIA_RX.lastIndex = 0; if (UI_MIA_RX.test(bs)) { UI_MIA_RX.lastIndex = 0; t = bs.replace(UI_MIA_RX, nm); } }
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
        if (uiLang() === 'de' && !uiMiaName()) return;
        if (uiBusy) return; uiBusy = true; mo.disconnect();
        try { ms.forEach(function (m) { if (m.type === 'characterData') uiTextNode(m.target, uiLang()); else if (m.type === 'attributes') uiAttrs(m.target, uiLang()); else m.addedNodes.forEach(function (nd) { if (nd.nodeType === 3) uiTextNode(nd, uiLang()); else if (nd.nodeType === 1) uiWalk(nd, uiLang()); }); }); }
        finally { mo.observe(document.body, { childList: true, subtree: true, characterData: true }); uiBusy = false; }
      });
      mo.observe(document.body, { childList: true, subtree: true, characterData: true });
    }
    uiLoad(uiLang(), function () { if (uiLang() !== 'de') { uiApply(document.body); if (ui.miaPaint) ui.miaPaint(); } uiMiaNamen(); });
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
    ['Fahrer', [['Code 95 (Weiterbildung für Berufskraftfahrer)', 5], ['Fahrerkarte (Tachograph)', 5], ['Fahrerqualifizierungsnachweis (FQN)', 5], ['ADR-Bescheinigung (Gefahrgut)', 5], ['Ladekran-Berechtigung', 0], ['Ladungssicherung-Schulung', 0]]],
    ['Bau und Maschinen', [['Baggerschein / Maschinenführer', 0], ['Kranschein', 0], ['Staplerschein', 0], ['Hebebühnen-Berechtigung', 0], ['Absturzsicherung-Schulung', 0]]],
    ['Werkstatt und Metall', [['Pickerl-Ermächtigung (§ 57a)', 0], ['Schweißerprüfung', 0], ['Hochvolt-Schulung', 0], ['Kältemittel-Sachkunde', 0]]],
    ['Küche und Gastro', [['Hygieneschulung', 0], ['Allergen-Schulung', 0]]],
    ['Lager und Handel', [['Prüfung des Staplers (jährlich)', 1]]],
    ['Büro', [['Datenschutz-Schulung', 0], ['Brandschutzwart-Ausbildung', 0]]]
  ];
  // Ausbildungen und Abschlüsse: Laufzeit -1 = läuft nicht ab (nur "erreicht am"), 0 = Ablaufdatum selbst eintragen, sonst Jahre
  var AUSB_ALLG = ['Abschlüsse und Ausbildungen (laufen nicht ab)', [['Lehrabschlussprüfung', -1], ['Meisterprüfung', -1], ['Befähigungsprüfung', -1], ['Matura / Berufsreifeprüfung', -1], ['Studienabschluss', -1], ['Ausbilderprüfung', -1]]];
  var AUSB_BERUF = {
    lkw: [['Lehrabschluss Berufskraftfahrer', -1], ['Ecofahr-Training', -1], ['Tankwagen-Aufbaukurs (ADR)', 5], ['Kühltransport-Schulung', 0]],
    klein: [['Lehrabschluss Berufskraftfahrer', -1], ['Ecofahr-Training', -1]],
    handwerk: [['Gesellenprüfung / Facharbeiterbrief', -1], ['Meisterprüfung', -1], ['Schweißerprüfung', 0], ['Absturzsicherung-Schulung', 0]],
    bagger: [['Lehrabschluss Baumaschinentechnik', -1], ['Baggerschein / Maschinenführer', 0], ['Kranschein', 0]],
    lager: [['Lehrabschluss Lagerlogistik', -1], ['Staplerschein', 0], ['Ladungssicherung-Kurs', -1]],
    mechaniker: [['Lehrabschluss Kfz-Technik', -1], ['Meisterprüfung', -1], ['Pickerl-Ermächtigung (§ 57a)', 0], ['Hochvolt-Schulung', 0]],
    buero: [['Lehrabschluss Bürokaufmann / Bürokauffrau', -1], ['Handelsakademie / Matura', -1], ['Buchhaltungsprüfung', -1], ['Computerführerschein', -1]],
    aussendienst: [['Handelsakademie / Matura', -1], ['Verkaufstraining', -1]],
    handel: [['Lehrabschluss Einzelhandel', -1], ['Lehrabschluss Lebensmittelhandel', -1], ['Hygieneschulung', 0], ['Ausbilderprüfung', -1]],
    gastro: [['Lehrabschluss Koch / Restaurantfachkraft', -1], ['Konzessionsprüfung Gastgewerbe', -1], ['Hygieneschulung', 0], ['Allergen-Schulung', 0]],
    reinigung: [['Lehrabschluss Denkmal-, Fassaden- und Gebäudereinigung', -1], ['Desinfektionsschulung', 0]],
    lebensmittel: [['Lehrabschluss Bäcker', -1], ['Lehrabschluss Konditor', -1], ['Meisterprüfung Bäcker', -1], ['Hygieneschulung', 0], ['Allergen-Schulung', 0]],
    konditor: [['Lehrabschluss Konditor', -1], ['Meisterprüfung Konditor', -1], ['Hygieneschulung', 0], ['Allergen-Schulung', 0]],
    optiker: [['Lehrabschluss Augenoptik', -1], ['Meisterprüfung Augenoptik', -1], ['Hygieneschulung', 0]],
    bus: [['Lehrabschluss Berufskraftfahrer', -1], ['Führerschein D (Bus)', 5], ['Fahrerqualifizierungsnachweis D95', 5], ['Taxilenkerausweis', 5]],
    gaertner: [['Lehrabschluss Gärtner', -1], ['Forstfacharbeiterprüfung', -1], ['Motorsägenkurs', 0], ['Pflanzenschutz-Sachkundeausweis', 6], ['Staplerschein', 0]],
    industrie: [['Lehrabschlussprüfung', -1], ['Schweißerprüfung', 0], ['Staplerschein', 0], ['Kranschein', 0]],
    post: [['Führerschein', 0], ['Lehrabschluss Speditionskaufmann / Berufskraftfahrer', -1], ['Staplerschein', 0]],
    ordination: [['Lehrabschluss Ordinationsassistenz', -1]],
    zahntechnik: [['Lehrabschluss Zahntechniker/in', -1]],
    textilreinigung: [['Lehrabschluss Textilreiniger/in', -1]],
    rauchfangkehrer: [['Lehrabschluss Rauchfangkehrer', -1]],
    schaedling: [['Lehrabschluss Schädlingsbekämpfer/in', -1]],
    kunststoff: [['Lehrabschluss Kunststofftechnik', -1]],
    kosmetik: [['Lehrabschluss Kosmetik / Fußpflege / Massage', -1]],
    seilbahn: [['Lehrabschluss Seilbahntechnik', -1], ['Maschinistenprüfung (Seilbahn)', -1]],
    lmindustrie: [['Lehrabschluss Lebensmitteltechnik', -1]],
    rettung: [['Ausbildung Rettungssanitäter/in', -1], ['Ausbildung Notfallsanitäter/in', -1]],
    fleischer: [['Lehrabschluss Fleischer', -1], ['Meisterprüfung Fleischer', -1], ['Hygieneschulung', 0], ['Allergen-Schulung', 0]],
    friseur: [['Lehrabschluss Friseur und Perückenmacher', -1], ['Meisterprüfung Friseur', -1], ['Visagistik-Kurs', -1], ['Hygieneschulung', 0]],
    security: [['Sicherheitsgrundkurs', -1], ['Deeskalationstraining', -1], ['Erste-Hilfe-Auffrischung', 4]],
    pflege: [['Hygieneschulung', 0], ['Erste-Hilfe-Auffrischung', 4], ['Basale Stimulation', -1], ['Palliativ-Lehrgang', -1], ['Demenz-Schulung', -1], ['Wundmanagement-Kurs', -1], ['Medikamentenschulung', 0], ['Heimhilfe-Ausbildung', -1], ['Pflegeassistenz', -1], ['Pflegefachassistenz', -1], ['Diplom Gesundheits- und Krankenpflege', -1], ['Pflicht-Fortbildung Pflege', 0]],
    bund: [['Grundausbildung', -1], ['Dienstprüfung', -1]]
  };
  function ausbAbschluss(n) { return /Lehrabschluss|Gesellen|Meister|Befähigung|Diplom|Matura|Studium|Pflegeassistenz|Pflegefachassistenz|Heimhilfe|Dienstprüfung|Konzession/.test(n || ''); }
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
      var mitAb = !!f.ablauf || !f.ausb;
      if (f.ausb && !f.ablauf) st = f.datum ? ['ok', 'Läuft nicht ab'] : '';
      return '<div class="frrow" data-id="' + esc(f.id) + '"><div class="frtop"><input type="text" data-f="name" maxlength="60" value="' + esc(f.name || '') + '" aria-label="Name der Frist"><button type="button" class="btn" data-act="del" aria-label="Entfernen">×</button></div>' +
        (f.ausb || f.datum ? '<div class="field"><label>Erreicht / bestanden am</label><input type="date" data-f="datum" max="' + todayISO() + '" value="' + esc(f.datum || '') + '"></div>' : '') +
        '<div class="field"><label>' + (f.ausb ? 'Läuft ab am (leer lassen, wenn es nicht abläuft)' : 'Läuft ab am') + '</label><input type="date" data-f="ablauf" value="' + esc(f.ablauf || '') + '"></div>' +
        (st ? '<p class="frstat fr-' + st[0] + '">' + st[1] + '</p>' : '') +
        (mitAb ? '<div class="field"><label>Erinnern ab</label><select data-f="vorlauf">' + opt(vl, v) + '</select></div>' +
        '<div class="field"><label>Meldung in der App</label><select data-f="mia">' + opt(ml, f.mia || 'taeglich') + '</select></div>' +
        '<label class="check"><input type="checkbox" data-f="kal"' + (f.kal ? ' checked' : '') + '><span>In meinem Handy-Kalender eingetragen</span></label>' +
        '<div class="btns"><button type="button" class="btn" data-act="ics"' + (f.ablauf ? '' : ' disabled') + '>Kalenderdatei laden</button><button type="button" class="btn primary" data-act="neu">Erneuert / bestanden</button></div>' : '') + '</div>';
    }).join('');
    var vo = $('#fr-vorl'); if (vo) {
      var bw = wAt(todayISO()) || {}, bl = AUSB_BERUF[bw.beruf] || [], gr = (bl.length ? [[abw1('Für deinen Beruf: {0}', [abwLab(E.BERUFE[bw.beruf] ? E.BERUFE[bw.beruf].name : '')]), bl]] : []).concat([AUSB_ALLG], FR_VOR), sig = (bw.beruf || '') + '|' + uiLang();
      if (vo.dataset.f !== sig) { vo.dataset.f = sig; vo.innerHTML = gr.map(function (g) { return '<p class="frgrp">' + esc(g[0]) + '</p><div class="frchips">' + g[1].map(function (x) { return '<button type="button" class="btn" data-n="' + esc(x[0]) + '" data-y="' + x[1] + '">' + esc(x[0]) + '</button>'; }).join('') + '</div>'; }).join(''); }
    }
  }
  function fristNeu(name, jahre) { var ab = jahre < 0; fristListe().push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), name: name || 'Neue Frist', laufzeit: ab ? 0 : (jahre || 0), ausb: ab, datum: '', ablauf: '', vorlauf: 30, mia: 'taeglich', kal: false }); save(); renderFristen(); }
  (function () {
    var el = $('#fr-list'); if (!el) return;
    function row(t) { var r = t.closest('.frrow'); if (!r) return null; var f = fristListe().filter(function (x) { return x.id === r.dataset.id; })[0]; return f ? { f: f, r: r } : null; }
    function fertig(f, neu) { f.ablauf = neu; f.kal = false; delete f.m1; delete f.m2; delete f.spaet; save(); renderFristen(); feier('Geschafft!', (f.name || 'Frist') + ' ist wieder gültig bis ' + fmtDate(neu)); ins('frist_erneuert'); }
    el.addEventListener('change', function (ev) {
      var t = ev.target, o = row(t); if (!o || !t.dataset.f) return; var k = t.dataset.f;
      if (k === 'ablauf') { var alt = o.f.ablauf; if (t.value && alt && t.value > alt) { fertig(o.f, t.value); return; } o.f.ablauf = t.value; o.f.kal = false; delete o.f.m1; delete o.f.m2; delete o.f.spaet; }
      else if (k === 'datum') {
        o.f.datum = t.value; save(); renderFristen();
        if (t.value && t.value <= todayISO() && !o.f.gratuliert) { o.f.gratuliert = true; save(); feier('Gratulation!', abw1(ausbAbschluss(o.f.name) ? 'Gratulation zu „{0}“! Das hast du dir verdient. Prüfe auch, ob sich dadurch deine Lohngruppe ändert.' : 'Gratulation zu „{0}“! Das hast du dir verdient.', [o.f.name || ''])); ins('ausbildung'); }
        return;
      }
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
    $('#fr-eigen-a').addEventListener('click', function () { fristNeu('Neue Ausbildung', -1); $('#fr-vorl').hidden = true; });
    $('#fr-vorl').addEventListener('click', function (ev) { var b = ev.target.closest('[data-n]'); if (!b) return; fristNeu(b.dataset.n, +b.dataset.y); $('#fr-vorl').hidden = true; });
    renderFristen();
  })();
  /* ---- Berichte als PDF (Tag, Woche, Monat) ---- */
  (function () {
    var card = $('#rb-card'); if (!card) return;
    function hh(min) { return fh(min / 60) + ' h'; }
    function bName() { var p = data.profil || {}; return ($('#rb-name').value || '').trim() || ((p.titelVor ? p.titelVor + ' ' : '') + (p.vorname || '') + ' ' + (p.nachname || '') + (p.titelNach ? ', ' + p.titelNach : '')).trim() || p.berichtName || ''; }
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
      b.innerHTML = svg + '<p>Am besten nimmst du die PDF-Datei, die du von deiner Firma bekommen hast. Die lese ich am genauesten.</p><p>Hast du den Lohnzettel nur auf Papier? Dann mach ein Foto davon. Bei mehreren Blättern wählst du alle Fotos auf einmal aus.</p><p class="hint">So wird das Foto gut: gerade von oben, helles Licht ohne Schatten, das ganze Blatt im Bild, scharf.</p><p class="hint">Das Foto bleibt auf deinem Handy und wird nirgends hochgeladen. Wenn die PDF-Datei ein Kennwort hat, frage ich dich danach.</p>' +
        '<input type="file" id="lz-file" accept="application/pdf,.pdf" multiple hidden><input type="file" id="lz-foto" accept="image/*" multiple hidden>';
      bt.innerHTML = lzBtn('PDF auswählen', 'lz-pick', 'primary') + lzBtn('Foto auswählen oder aufnehmen', 'lz-pickf', 'primary') + lzBtn('Abbrechen', 'lz-cancel');
    } else if (s === 'warten') {
      h.textContent = 'Ich lese …'; b.innerHTML = svg + (lzUi.fotoLauf ? '<p>Ich lese das Bild. Das kann bis zu einer Minute dauern. Bitte lass die App so lange offen.</p>' : '<p>Einen Moment bitte.</p>'); bt.innerHTML = '';
    } else if (s === 'kennwort') {
      h.textContent = 'Die Datei hat ein Kennwort';
      b.innerHTML = svg + '<p>' + (lzUi.pwFalsch ? 'Das Kennwort war leider falsch. Bitte noch einmal.' : 'Gib das Kennwort deiner Datei ein. Ich brauche es nur jetzt zum Öffnen und speichere es nicht.') + '</p><div class="field"><label for="lz-pw">Kennwort</label><div class="a-pwrow"><input type="password" id="lz-pw" autocomplete="off"><button type="button" class="eyebtn" data-eye="lz-pw" aria-label="Passwort anzeigen" aria-pressed="false"><svg class="eye-on" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg><svg class="eye-off" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4.2M6.6 6.7A17 17 0 0 0 2 12s3.6 7 10 7a9.6 9.6 0 0 0 4.3-1M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg></button></div></div>';
      bt.innerHTML = lzBtn('Öffnen', 'lz-pwok', 'primary') + lzBtn('Abbrechen', 'lz-cancel');
    } else if (s === 'keintext') {
      h.textContent = 'Das kann ich nicht lesen';
      b.innerHTML = svg + '<p>Ich konnte auf diesem Bild keinen Lohnzettel erkennen. Probier es mit einem neuen Foto: gerade von oben, helles Licht ohne Schatten, das ganze Blatt im Bild, scharf. Oder nimm die PDF-Datei deiner Firma. Du kannst die Zeilen im Abgleich auch einfach abtippen.</p>';
      bt.innerHTML = lzBtn('Noch einmal', 'lz-pick2', 'primary') + lzBtn('Bezeichnungen eintippen', 'lz-hand') + lzBtn('Schließen', 'lz-cancel');
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
      if (tr) rows.push('<li><span style="flex:1"><strong>Lohngruppe laut Tabelle</strong><br>' + esc(tr.name) + (function () { var lgT = E.LOHNGRUPPEN[tr.paket], gT = (lgT.gruppen || []).filter(function (x) { return x.id === tr.lg; })[0], st = lgSt(lgT, gT); return tr.ls != null && st && st[tr.ls] ? ', ' + esc(st[tr.ls]) : ''; })() + '</span></li>');
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
      b.innerHTML = svg + '<div class="field"><span class="lbl">Für welchen Monat ist dieser Lohnzettel?</span><div class="grid2"><select id="lz-mo" aria-label="Monat">' + [ 'Monat wählen'].concat(MON).map(function (mn, k) { return '<option value="' + k + '"' + (k === mo.m ? ' selected' : '') + '>' + mn + '</option>'; }).join('') + '</select><select id="lz-jr" aria-label="Jahr">' + [0, 1, 2, 3].map(function (d) { return new Date().getFullYear() - 2 + d; }).concat([mo.y]).filter(function (y, k, ar) { return ar.indexOf(y) === k; }).sort().map(function (y) { return '<option value="' + y + '"' + (y === mo.y ? ' selected' : '') + '>' + y + '</option>'; }).join('') + '</select></div></div>' + (r.foto ? '<div class="notice warn">Vom Foto gelesen. Dabei können einzelne Ziffern falsch erkannt werden. Vergleiche bitte jede Zahl mit deinem Lohnzettel und bessere sie hier aus.</div>' : '<p>Die Zahlen kommen direkt aus deinem Lohnzettel. Bitte schau nur, ob jede Zeile zur richtigen Art passt.</p>') + (r.zeilen.some(function (z) { return z.nums && z.nums.length > 1; }) ? '<p>Steht in einer Zeile mehr als eine Zahl, wähle die Stundenzahl aus.</p>' : '') +
        (r.zeilen.length ? r.zeilen.map(function (z, i) { return '<div class="lzrow"><span>' + esc(z.label) + '' + '</span>' + (z.nums && z.nums.length > 1 ? '<select data-lzp="' + i + '" aria-label="' + esc(z.label) + '">' + z.nums.map(function (nn, k) { return '<option value="' + k + '"' + (k === z.pos ? ' selected' : '') + '>' + esc(nn) + '</option>'; }).join('') + '</select>' : '<input type="text" inputmode="decimal" class="lzv" data-lzv="' + i + '" value="' + esc(z.unsicher ? z.nums[0] : String(z.menge).replace('.', ',')) + '" aria-label="Wert">') + '<select data-lzz="' + i + '" aria-label="' + esc(z.label) + '">' + opts.map(function (o) { return '<option value="' + o[0] + '"' + ((z.key || '') === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select>' + (r.foto && z.pruef === true ? '<small class="lzok">✓ Rechenprobe stimmt: Menge mal Satz ergibt den Betrag</small>' : r.foto && z.pruef === false ? '<small class="lzbad">' + esc(z.pruefSoll != null ? abw1('Bitte genau vergleichen: Die Rechenprobe geht hier nicht auf. Aus Satz und Betrag ergäben sich {0}.', [String(z.pruefSoll).replace('.', ',')]) : abwLab('Bitte genau vergleichen: Die Rechenprobe geht hier nicht auf. Eine der Zahlen ist vielleicht falsch gelesen.')) + '</small>' : '') + '</div>'; }).join('') : '<p>Ich habe keine Stundenzeilen gefunden. Du kannst die Zeilen von Hand im Abgleich eintragen.</p>') + (r.zeilen.length ? '<label class="check"><input type="checkbox" id="lz-stimmt"><span>Ich habe alle Werte mit meinem Lohnzettel verglichen. Alles stimmt.</span></label>' : '');
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
    if (res.satz && sum.lohn != null) { cur.satz = res.satz; n++; } if (res.dSatz && sum.dStd != null) { cur.dSatz = res.dSatz; n++; }
    (res.sonder || []).forEach(function (q) { // Sonderzahlung vom Lohnzettel: „Laut Lohnzettel“ in der Karte Sonderzahlungen vorbelegen
      var l = sndList(), e = l.filter(function (x) { return x.art === q.art && +x.jahr === mo.y; })[0];
      if (!e) { e = { art: q.art, jahr: mo.y, voll: null, ist: null, notiz: '' }; l.push(e); }
      e.ist = q.betrag; n++; cur.gelesen = true;
    });
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
        if (!o.hatText) { // eingescanntes PDF: Seiten wie ein Foto lesen
          lzUi.fotoLauf = true; lzRender();
          return window.StundenLz.lesePdfBild(fr.result, lzFragePw).then(function (o2) { lzUi.fotoLauf = false; lzUi.queue = []; ins('lz_scan'); lzGelesen(o2); });
        }
        lzGelesen(o);
      }, function (e) { lzUi.fotoLauf = false; lzUi.queue = []; if (e && e.message === 'abgebrochen') { lzClose(); return; } lzUi.step = 'fehler'; lzRender(); }).then(null, function (e) { lzUi.fotoLauf = false; lzUi.queue = []; if (e && e.message === 'abgebrochen') { lzClose(); return; } lzUi.step = 'fehler'; lzRender(); });
    };
    fr.onerror = function () { lzUi.queue = []; lzUi.step = 'fehler'; lzRender(); };
    fr.readAsArrayBuffer(file);
  }
  // Fotos: alle gewählten Bilder sind Seiten desselben Lohnzettels. Nie ohne Prüfung übernehmen.
  function lzFotos(files) {
    lzUi.queue = []; lzUi.erg = []; lzUi.step = 'warten'; lzUi.fotoLauf = true; lzRender();
    window.StundenLz.leseFotos(files).then(function (o) { lzUi.fotoLauf = false; ins('lz_foto'); lzGelesen(o); }, function () { lzUi.fotoLauf = false; lzUi.step = 'fehler'; lzRender(); });
  }
  function lzGelesen(o) {
        if (!o.hatText) { lzUi.queue = []; lzUi.step = 'keintext'; lzRender(); return; }
        if (lzUi.modus === 'einr' || lzUi.modus === 'pruef') { lzUi.queue = []; lzUi.lines = o.lines; lzEinrAus(o.lines); return; }
        var res = window.StundenLz.parse(o.lines, lzProfil().lzMap || {}); lzUi.res = res; ins('lz_gelesen');
        res.foto = !!o.foto;
        if (!o.foto && lzBekannt(res)) { lzApply(res, res.monat, res.zeilen.map(function (z) { return { z: z, key: z.key, pos: z.pos | 0 }; })); lzNext(); return; }
        if (o.foto && !res.zeilen.length) { lzUi.step = 'keintext'; lzRender(); return; }
        lzUi.step = res.zeilen.length ? 'pruefen' : 'vorlage'; if (!res.zeilen.length) lzUi.labels = lzLabels(o.lines); lzRender();
  }
  (function () {
    var dlg = $('#lz-dlg'); if (!dlg) return;
    dlg.addEventListener('change', function (ev) {
      var t = ev.target;
      if (t.id === 'lz-ok') { $('#lz-weiter').disabled = !t.checked; return; }
      if (t.id === 'lz-stimmt') { $('#lz-apply').disabled = !t.checked; return; }
      if (t.id === 'lz-file' && t.files && t.files[0]) { var fl = Array.prototype.slice.call(t.files); t.value = ''; lzLese(fl); }
      if (t.id === 'lz-foto' && t.files && t.files[0]) { var ff = Array.prototype.slice.call(t.files, 0, 6); t.value = ''; lzFotos(ff); }
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
      else if (t.id === 'lz-pick2') { lzUi.step = 'datei'; lzRender(); }
      else if (t.id === 'lz-pick') { lzUi.step = 'datei'; lzRender(); var fi = $('#lz-file'); if (fi) fi.click(); }
      else if (t.id === 'lz-pickf') { var ff2 = $('#lz-foto'); if (ff2) ff2.click(); }
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
  // Beim Start (höchstens einmal pro Tag): Mia sagt, was offen ist. Mehrere Dinge als Karte, eines als Sprechblase.
  setTimeout(function () {
    try {
      if (PROBE || ui.miaAuto || ui.wiz || TOUR || miaCfg().ruhig || !data.settings.length) return;
      var pf = data.profil || (data.profil = {}), nx0 = miaNext(); if (pf.miaStartTag === todayISO() && !(nx0 && nx0.k === 'schnellneu')) return;
      if (!nx0 || nx0.spaet) return; pf.miaStartTag = todayISO(); save(); ui.miaAuto = true;
      if (!miaKarte()) miaOpen(true);
    } catch (e) { }
  }, 3200);
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
  // TESTPHASE: nur eingeladene Tester, Mithelfen ist von Anfang an an. Beim offiziellen Start auf false stellen: dann ist alles aus, bis der Nutzer selbst einschaltet.
  var TESTPHASE = true;
  function standardMithelfen() {
    if (!TESTPHASE || PROBE || !window.StundenInsights || !window.StundenInsights.on || !data.settings.length) return;
    var p = data.profil || (data.profil = {}), co = p.consent || {};
    if (TESTPHASE && !p.mithelfenNein && co.praemien === undefined && (co.statistik || co.miaFragen)) { co.praemien = true; p.consent = co; save(); try { window.StundenInsights.push(true); } catch (e) { } }
    if (co.statistik || co.miaFragen || p.mithelfenNein || p.mithelfenStd) return;
    p.consent = { statistik: true, miaFragen: true, praemien: true }; p.mithelfenStd = true; save();
    try { window.StundenInsights.push(true); } catch (e) { }
    toast('Anonym mithelfen ist eingeschaltet. Du kannst es jederzeit in den Einstellungen ausschalten.');
  }
  setTimeout(function () { try { geburtstagPruefen(); } catch (e) { } }, 1800);
  setTimeout(praemMelden, 5000);
  setTimeout(function () { try { standardMithelfen(); } catch (e) { } }, 3500);
  setTimeout(function () { try { fbErledigtPruefen(); } catch (e) { } }, 6000);
  window.__scBoot = true;
})();
