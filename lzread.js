/* Lohnzettel lesen: alles direkt im Handy. Es wird nichts hochgeladen.
   Aus dem Text werden nur Zeilenbezeichnung und Menge in Stunden gelesen, nie Name, Adresse, Sozialversicherungsnummer oder Bankdaten. */
(function (root) {
  var MON = { 'jaenner': 1, 'januar': 1, 'februar': 2, 'maerz': 3, 'april': 4, 'mai': 5, 'juni': 6, 'juli': 7, 'august': 8, 'september': 9, 'oktober': 10, 'november': 11, 'dezember': 12 };
  function norm(s) { return String(s || '').toLowerCase().replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 'ss').replace(/[^a-z]/g, ''); }
  function normMon(s) { return String(s || '').toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss'); }
  // Bezeichnung -> Zeile im Lohnzettel-Abgleich. Reihenfolge zählt. null = nicht übernehmen.
  var REGELN = [
    [/zuschl|zusch|zuschlag/, null],
    [/lohnsteuer|sozialvers|brutto|netto|auszahlung|beitrag|kosten|sechstel|pendler|bemessung/, null],
    [/^monatlveranderung|^zeitausgleichveranderung|^zaveranderung/, 'zaKonto'], // Block „Zeitausgleich“ unten links: Veränderung des Kontos in diesem Monat
    [/urlaubsanspruch|urlaubsverbrauch|urlaubssaldo|urlaubsstand|resturlaub/, null], // Urlaubstage (Arbeitstage), keine Stunden
    [/^anfangsstand|^endsaldo|^anfangssaldo/, null], // Kontostände (Zeitausgleich und Urlaub) werden nicht als Stunden übernommen
    [/zs$/, null], // „Überstunden 50% ZS“: Zuschlag auf dieselben Stunden, zählt nicht noch einmal
    [/sonderurlaub/, 'sonder'],
    [/^uberstunden|^uberstd|^mehrarbeit|^ust/, 'ueber'],
    [/(feiertag|urlaub)\w*ds$|durchschnitt/, null], // „Feiertagsentgelt DS“ und „Urlaubsentgelt DS“: Zuschlag auf den Durchschnitt (Menge = Tage oder Einheiten, Satz = Aufschlag), keine Stunden
    [/feiertag/, 'feiertag'],
    [/urlaub/, 'urlaub'],
    [/krank|entgeltfortzahlung|krst/, 'krank'],
    [/pflege/, 'pflege'],
    [/diaten|aufwandsentsch|taggeld|tagesgeld|reisekosten|verpflegung|ubernacht|spesen|auslosung/, 'dStd'],
    [/^lohn$|^stundenlohn|^normalstunden|^arbeitszeit|^normalarbeitszeit|^gehalt|^lohn/, 'lohn']
  ];
  var NAMEN = { lohn: 'Lohn', ueber: 'Überstunden', feiertag: 'Feiertagslohn', urlaub: 'Urlaub', krank: 'Krankenstand', pflege: 'Pflegefreistellung', dStd: 'Diäten (Stunden)', dEuro: 'Diäten (Betrag in Euro)', sonder: 'Sonderurlaub', zaKonto: 'Zeitausgleich-Konto (Zuwachs)', urlaubSaldo: 'Resturlaub (Arbeitstage)' };
  function zahl(s) { return parseFloat(String(s).replace(/\./g, '').replace(',', '.')); }
  function monat(lines) {
    for (var i = 0; i < lines.length; i++) {
      var t = normMon(lines[i]), m = /(jaenner|januar|februar|maerz|april|mai|juni|juli|august|september|oktober|november|dezember)\s*(20\d\d)/.exec(t);
      if (m && /abrechnung|lohn|gehalt/.test(t)) return { y: +m[2], m: MON[m[1]] };
    }
    for (var j = 0; j < lines.length; j++) { var t2 = normMon(lines[j]), m2 = /(jaenner|januar|februar|maerz|april|mai|juni|juli|august|september|oktober|november|dezember)\s*(20\d\d)/.exec(t2); if (m2) return { y: +m2[2], m: MON[m2[1]] }; }
    for (var k = 0; k < lines.length; k++) { // Schreibweise 09/2026 oder 9.2026, nur in Zeilen über die Abrechnung
      var t3 = normMon(lines[k]); if (!/abrechnung|lohn|gehalt|monat|zeitraum/.test(t3)) continue;
      var m3 = /(?:^|\D)(0?[1-9]|1[0-2])\s*[\/.\-]\s*(20\d\d)(?!\d)/.exec(lines[k]); if (m3) return { y: +m3[2], m: +m3[1] };
    }
    return null;
  }
  // lines: Textzeilen. gelernt: { normierteBezeichnung: key|'-' } aus früheren bestätigten Lohnzetteln.
  function parse(lines, gelernt) {
    gelernt = gelernt || {};
    var zeilen = [], seen = {};
    lines.forEach(function (ln) {
      var m = /^(.*?)\s+(\d{1,3}(?:\.\d{3})*,\d{1,2}|\d+,\d{1,2})\s*(?:h|Std\.?)(?:\s|$)/i.exec(ln.trim());
      if (!m) return;
      var label = m[1].replace(/\s+/g, ' ').trim(), n = norm(label);
      if (n.length < 3 || /^(bem|sv|lst|bv)/.test(n)) return;
      var key = null;
      if (gelernt[n] !== undefined) key = gelernt[n] === '-' ? null : gelernt[n];
      else for (var i = 0; i < REGELN.length; i++) if (REGELN[i][0].test(n)) { key = REGELN[i][1]; break; }
      if (key === null && gelernt[n] === undefined && /^(anfangs|endsaldo|urlaubsanspruch|urlaubsverbrauch|urlaubssaldo|resturlaub)/.test(n)) return; // Kontostände zeigt die App nicht als Zeile
      var menge = zahl(m[2]); if (isNaN(menge)) return;
      if (key === 'zaKonto' && /[-−–]\s*$/.test(m[1])) menge = -menge; // „monatl. Veränderung -5,00 h“ ist ein Abzug vom Konto
      var dup = n + '|' + menge; if (seen[dup]) return; seen[dup] = 1;
      zeilen.push({ label: label, norm: n, menge: menge, key: key });
    });
    // Urlaubsstand in Arbeitstagen („End - Saldo 2,34 Arbeitstage“, „Resturlaub 2,34 Tage“): geht in die Urlaubskartei
    var us = false;
    lines.forEach(function (ln) {
      if (us) return;
      var mu = /^(.*?)\s+(\d{1,3}(?:\.\d{3})*,\d{1,2}|\d+,\d{1,2})\s*(?:arbeitstag\w*|tage?\b)/i.exec(String(ln).trim());
      if (!mu) return;
      var nu = norm(mu[1]);
      if (!/^(endsaldo|resturlaub|urlaubssaldo|urlaubsstand|restanspruch)$/.test(nu)) return;
      var vu = zahl(mu[2]); if (isNaN(vu) || vu > 400) return;
      us = true; zeilen.push({ label: 'Resturlaub (Arbeitstage)', norm: 'resturlaubarbeitstage', menge: vu, key: 'urlaubSaldo' });
    });
    // Zeilen ohne „h“ (zum Beispiel „Lohn 160,00 13,34 2.134,82“): der Nutzer wählt einmal die Art und die Zahl, die App merkt es sich
    var NUM = /\d{1,3}(?:\.\d{3})*,\d{1,2}|\d+,\d{1,2}/g, PERS = /iban|bic\b|@|tel\.|sv-?nr|geb\.|\bstr(asse|aße)?\b|platz|gasse|weg\b|gmbh|\bag\b/i, schon = {};
    zeilen.forEach(function (q) { schon[q.norm] = 1; });
    var kand = [], used = {};
    zeilen.forEach(function (q) { if (q.key) used[q.key] = 1; });
    lines.forEach(function (ln) {
      if (/€/.test(ln) || PERS.test(ln)) return;
      var nums = String(ln).match(NUM); if (!nums) return;
      var i0 = String(ln).search(NUM), label = String(ln).slice(0, i0).replace(/^[\s\d.,:\-–/]+/, '').replace(/\s+/g, ' ').trim();
      if (!/[A-Za-zÄÖÜäöüß]{3}/.test(label) || label.length > 48 || /§/.test(label)) return; // Zeilen mit Paragraf sind Steuerangaben, keine Lohnzeilen
      var n = norm(label); if (n.length < 3 || schon[n] || /^(bem|sv|lst|bv)/.test(n)) return;
      var key = null, pos = 0, rk = null;
      if (gelernt[n] !== undefined) { if (gelernt[n] === '-') return; key = gelernt[n]; pos = gelernt['#' + n] | 0; if (pos >= nums.length || (gelernt['@' + n] !== undefined && gelernt['@' + n] !== nums.length)) pos = 0; }
      else { for (var i = 0; i < REGELN.length; i++) if (REGELN[i][0].test(n)) { rk = REGELN[i]; break; } if (rk && rk[1] === null) return; }
      var euroZ = rk && rk[1] === 'dStd' && /verpfleg|ubernacht|spesen|auslos/.test(n); if (euroZ && key === null && nums.length > 1) pos = nums.length - 1; // „12 Tage × 28,00 = 336,00“: der Betrag steht hinten
      var menge = zahl(nums[pos]); if (isNaN(menge)) return;
      if (key === null && rk) { if (rk[1] === 'dStd' && (nums.length === 1 || euroZ)) { key = 'dEuro'; } else if (menge <= 400) key = rk[1]; }
      if (key && !(gelernt[n] !== undefined) && used[key]) key = null; // dieselbe Art nie zweimal vorbelegen
      if (key === null && gelernt[n] === undefined && (menge > 400 || /^summe/.test(n))) return; // Beträge und Summen sind nie Stunden
      if (key) used[key] = 1;
      var dup = n + '|' + nums.join(' '); if (schon[dup]) return; schon[dup] = 1;
      kand.push({ label: label, norm: n, menge: menge, key: key, nums: nums, pos: pos, unsicher: true });
    });
    kand.slice(0, 25).forEach(function (q) { zeilen.push(q); });
    // Sonderzahlungen (Urlaubszuschuss, Weihnachtsremuneration, 13./14. Gehalt): Zeile ohne Stunden, der Euro-Betrag steht am Zeilenende („Urlaubszuschuss 1 804,15“)
    var sonder = [];
    lines.forEach(function (ln) {
      var t = String(ln).trim(), mb = /(\d{1,3}(?:[. \u00a0]\d{3})*,\d{2})\s*€?\s*$/.exec(t); if (!mb || PERS.test(t)) return;
      var lab = norm(t.slice(0, mb.index)), art = /^urlaubszuschuss|^urlaubsgeld|^urlaubsbeihilfe/.test(lab) ? 'urlaub' : /^weihnachts(remuneration|geld|zuwendung)|^weihnachtsgratifikation/.test(lab) ? 'weihnacht' : /^13(gehalt|monatsgehalt|monatslohn)|^dreizehnt/.test(lab) ? 'd13' : /^14(gehalt|monatsgehalt|monatslohn)|^vierzehnt/.test(lab) ? 'd14' : /^sonderzahlung/.test(lab) ? 'andere' : null;
      if (!art || /\d{1,3},\d{2}\s*h\b/i.test(t)) return;
      var b = zahl(mb[1].replace(/[ \u00a0]/g, '')); if (isNaN(b) || b <= 0) return;
      sonder.push({ art: art, betrag: b, label: t.slice(0, mb.index).replace(/\s+/g, ' ').trim() });
    });
    return { monat: monat(lines), zeilen: zeilen, sonder: sonder, lines: lines };
  }
  // Aus pdf.js-Textstücken Zeilen bauen (gleiche Höhe = eine Zeile).
  function zeilenAus(items) {
    var rows = [];
    items.forEach(function (it) { if (!it.str || !it.str.trim()) return; var y = Math.round(it.transform[5] / 3) * 3, r = rows.filter(function (q) { return Math.abs(q.y - it.transform[5]) < 2.5; })[0]; if (!r) { r = { y: it.transform[5], p: [] }; rows.push(r); } r.p.push({ x: it.transform[4], s: it.str }); });
    rows.sort(function (a, b) { return b.y - a.y; });
    var cells = [];
    var lines = rows.map(function (r) { r.p.sort(function (a, b) { return a.x - b.x; }); cells.push(r.p.map(function (q) { return String(q.s).replace(/\s+/g, ' ').trim(); }).filter(Boolean)); return r.p.map(function (q) { return q.s; }).join(' ').replace(/\s+/g, ' ').trim(); });
    lines.cells = cells; return lines;
  }
  var libP = null;
  function ladeLib(basis) {
    if (libP) return libP;
    libP = new Promise(function (ok, fail) {
      if (root.pdfjsLib) return ok(root.pdfjsLib);
      var s = document.createElement('script'); s.src = (basis || '') + 'lib/pdf.js'; s.onload = function () { try { root.pdfjsLib.GlobalWorkerOptions.workerSrc = (basis || '') + 'lib/pdf.worker.js'; ok(root.pdfjsLib); } catch (e) { fail(e); } }; s.onerror = function () { libP = null; fail(new Error('lib')); };
      document.head.appendChild(s);
    });
    return libP;
  }
  // Datei lesen. fragePasswort(grund) liefert ein Promise mit dem Kennwort oder lehnt ab. Das Kennwort bleibt nur im Arbeitsspeicher.
  function lesePdf(buf, fragePasswort, basis) {
    return ladeLib(basis).then(function (lib) {
      return new Promise(function (ok, fail) {
        var task = lib.getDocument({ data: buf.slice(0) });
        task.onPassword = function (cb, grund) { fragePasswort(grund === 2 ? 'falsch' : 'noetig').then(function (pw) { cb(pw); }, function () { fail(new Error('abgebrochen')); }); };
        task.promise.then(function (doc) {
          var all = [], allCells = [], p = Promise.resolve();
          for (var i = 1; i <= doc.numPages; i++) (function (n) { p = p.then(function () { return doc.getPage(n).then(function (pg) { return pg.getTextContent(); }).then(function (tc) { var zl = zeilenAus(tc.items); allCells = allCells.concat(zl.cells || []); all = all.concat(zl); }); }); })(i);
          p.then(function () { all.cells = allCells; ok({ lines: all, hatText: all.join('').replace(/\s/g, '').length > 50 }); }, fail);
        }, fail);
      });
    });
  }
  // PDF-Seiten als Bilder in einen Behälter zeichnen (Vorschau). Auf jedem Gerät gleich, ohne das PDF-Fenster des Browsers.
  function zeigePdf(bytes, behaelter, breite, basis) {
    return ladeLib(basis).then(function (lib) {
      return lib.getDocument({ data: bytes.slice(0) }).promise.then(function (doc) {
        behaelter.innerHTML = '';
        var chain = Promise.resolve(), n = Math.min(doc.numPages, 3);
        for (var i = 1; i <= n; i++) (function (nr) {
          chain = chain.then(function () {
            return doc.getPage(nr).then(function (pg) {
              var v0 = pg.getViewport({ scale: 1 }), sc = (breite / v0.width) * (window.devicePixelRatio > 1 ? 2 : 1.5), vp = pg.getViewport({ scale: sc });
              var c = document.createElement('canvas'); c.width = Math.round(vp.width); c.height = Math.round(vp.height); c.style.width = '100%'; c.style.height = 'auto'; c.style.display = 'block';
              behaelter.appendChild(c);
              return pg.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
            });
          });
        })(i);
        return chain;
      });
    });
  }

  // Kopfdaten für die Einrichtung: Kollektivvertrag, Einstufung, Stundenlohn. Name, Adresse, SV-Nummer und Bankdaten werden nie gelesen.
  var KVMAP = [
    [/gueterbefoerd|güterbefördr|kraftfahr|spedition|transportgewerbe|gueterbeford/, 'gueter'],
    [/kleintransport|personenbefoerd|taxi/, 'klein'],
    [/handel/, 'handel'],
    [/bauindustrie|baugewerbe|bauhilfsgewerbe|baunebengewerbe|\bbau\b/, 'bau'],
    [/metall|kfz|fahrzeug/, 'metall'],
    [/gastgewerbe|hotel|gastronomie/, 'gastro'],
    [/sozialwirtschaft|swoe|swö|pflege|gesundheit/, 'sozial'],
    [/reinigung|denkmal|fassaden/, 'reinigung'],
    [/bewachung|sicherheit|security/, 'bewachung'],
    [/holzbau/, 'holzbau'], [/dachdecker/, 'dachdecker'], [/pflasterer/, 'pflasterer'], [/fliesenleger/, 'fliesenleger'],
    [/tischler|holzverarbeit/, 'tischler'], [/maler|lackierer|anstreicher/, 'maler'],
    [/bank/, 'banken_ang'], [/versicherung/, 'versicherung_ang'], [/informationstechn|it-|edv/, 'it_ang'],
    [/industrie/, 'industrie_ang'], [/angestellte|gewerbe/, 'gewerbe_ang']
  ];
  function kopf(lines, LG) {
    var out = { kv: null, paket: null, einstufung: '', stundenlohn: null, monatslohn: null, treffer: [] }, PERS = /iban|bic\b|@|tel\.|sv-?nr|sozialvers|geb\.|\bstr(asse|aße)?\b|platz|gasse|\bweg\b|gmbh|\bag\b/i;
    function iso(d, m, y) { d = +d; m = +m; y = +y; if (y < 1900 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null; return y + '-' + (m < 10 ? '0' : '') + m + '-' + (d < 10 ? '0' : '') + d; }
    var DATUM = /(\d{1,2})\.(\d{1,2})\.(\d{4})/;
    var cl = (lines && lines.cells) || [];
    cl.forEach(function (cs) {
      for (var ci = 0; ci < cs.length - 1; ci++) {
        var lab = cs[ci].toLowerCase().replace(/\s+/g, ' ').replace(/[:\.]/g, ''), val = cs[ci + 1];
        if (/^(besch als|beschaeftigt als|beschäftigt als|verwendet als)$/.test(lab) && !out.beschaeftigt && val && !/\d{1,3}(?:\.\d{3})*,\d\d/.test(val) && !PERS.test(val)) { out.beschaeftigt = val.slice(0, 40); if (!out.einstufung) out.einstufung = val.slice(0, 60); if (!out.paket) { var nz = normMon(val); for (var qz = 0; qz < KVMAP.length; qz++) if (KVMAP[qz][0].test(nz)) { out.paket = KVMAP[qz][1]; break; } } }
        if (lab === 'tarifgruppe' && !out.tarifgruppe && /^[A-Za-z0-9\-\.]{1,12}$/.test(val)) out.tarifgruppe = val;
      }
    });
    cl.forEach(function (cs) {
      for (var cj = 0; cj < cs.length - 1; cj++) {
        var lb = cs[cj].toLowerCase().replace(/[:\.\s]+/g, ''), dm = DATUM.exec(cs[cj + 1]);
        if (!dm) continue;
        if (!out.eintritt && /^(eintritt|eintrittsdatum|eintrittam|eindatum)$/.test(lb)) out.eintritt = iso(dm[1], dm[2], dm[3]);
        if (!out.geb && /^(geb|gebdatum|geburtsdatum|geboren|gebam)$/.test(lb)) out.geb = iso(dm[1], dm[2], dm[3]);
      }
    });
    (lines || []).forEach(function (ln, li) {
      var t = String(ln).replace(/\s+/g, ' ').trim().replace(/^\d{3,5}\s+(?=[A-Za-zÄÖÜäöü])/, ''), lo = t.toLowerCase();
      if (!out.firma && li < 25 && !/iban|bic\b|@|www\.|sv-?nr/i.test(t)) {
        var mf = /(?:^|[:\s])((?:[A-ZÄÖÜ&][\wÄÖÜäöüß&\.\-]*\s){1,5}?(?:GmbH(?:\s*&\s*Co\.?\s*KG)?|Ges\.?\s?m\.?\s?b\.?\s?H\.?|KG|OG|AG|e\.\s?U\.))(?=\s|,|$)/.exec(t);
        if (mf && mf[1].length <= 60) out.firma = mf[1].replace(/\s+/g, ' ').trim();
      }
      if (!out.kv && /kollektivvertrag|\bkv\b/.test(lo) && !PERS.test(t)) {
        var rest = t.replace(/^.*?(kollektivvertrag|\bkv\b)\s*[:\-]?\s*/i, '').slice(0, 80);
        if (rest && !/\d{4,}/.test(rest)) { out.kv = rest; var n = normMon(rest); for (var i = 0; i < KVMAP.length; i++) if (KVMAP[i][0].test(n)) { out.paket = KVMAP[i][1]; break; } }
      }
      var me2 = /(?:^|\s)(?:eintritt(?:sdatum)?|ein\.?\s*datum)\s*[:\-]?\s*(\d{1,2})\.(\d{1,2})\.(\d{4})/i.exec(t); if (me2 && !out.eintritt) out.eintritt = iso(me2[1], me2[2], me2[3]);
      var mg2 = /(?:^|\s)(?:geb\.?(?:urts)?\s*(?:datum|dat\.?)?|geboren(?:\s+am)?)\s*[:\-]?\s*(\d{1,2})\.(\d{1,2})\.(\d{4})/i.exec(t); if (mg2 && !out.geb) out.geb = iso(mg2[1], mg2[2], mg2[3]);
      var mn = /^DN:?\s*\d+\s+([A-Za-zÄÖÜäöüß\-]{2,25})\s+([A-Za-zÄÖÜäöüß\-]{2,30})(?=\s|$)/.exec(t);
      if (mn && !out.vorname) { out.vorname = mn[1]; out.nachname = mn[2].charAt(0).toUpperCase() + mn[2].slice(1).toLowerCase(); }
      var mb = /(?:^|\s)(besch\.?\s*als|beschaeftigt\s+als|beschäftigt\s+als|verwendet\s+als)\s*[:\-]?\s+(.{2,40}?)(?=\s+(?:LSt|AV\b|AE\b|Pendler|Pendl|FA\b|Familien|Kinder|Freibetrag|SV\b|IBAN)|$)/i.exec(t);
      if (mb && !PERS.test(t) && !/\d{1,3}(?:\.\d{3})*,\d\d/.test(mb[2])) {
        out.beschaeftigt = mb[2].trim();
        if (!out.einstufung) out.einstufung = mb[2].trim().slice(0, 60);
        if (!out.paket) { var nb = normMon(mb[2]); for (var q = 0; q < KVMAP.length; q++) if (KVMAP[q][0].test(nb)) { out.paket = KVMAP[q][1]; break; } }
      }
      var mt = /(?:^|\s)tarifgruppe\s*[:\-]?\s+([A-Za-z0-9\-\.]{1,12})(?:\s|$)/i.exec(t);
      if (mt) out.tarifgruppe = mt[1];
      if (!out.einstufung) {
        var me = /^(einstufung|lohngruppe|verwendungsgruppe|beschaeftigungsgruppe|beschäftigungsgruppe|gehaltsgruppe|entlohnungsgruppe|lohnstufe|kategorie|gruppe)\b\s*[:\-]?\s*(.{1,40})$/i.exec(t);
        if (me && !PERS.test(t) && !/\d{1,3}(?:\.\d{3})*,\d\d/.test(me[2])) out.einstufung = (me[1] + ' ' + me[2]).replace(/\s+/g, ' ').trim().slice(0, 60);
      }
      if (out.stundenlohn === null) {
        var ms = /^(stundenlohn|grundlohn|stundensatz|lohn)\b[^\d€]{0,30}?(\d{1,3}(?:\.\d{3})*,\d{1,4})/i.exec(t);
        if (ms) { var v = zahl(ms[2]); if (v >= 5 && v <= 80) out.stundenlohn = v; else if (v >= 500 && v <= 20000 && /^(grundlohn|lohn)$/i.test(ms[1]) && out.monatslohn === null) out.monatslohn = v; }
      }
      if (out.stundenlohn === null && /^(lohn|stundenlohn|normalstunden|normalarbeitszeit|arbeitszeit|grundlohn|normallohn)\b/i.test(t) && !/zuschl|uberst|überst|mehr/i.test(t)) {
        var ns = t.match(/\d{1,3}(?:\.\d{3})*,\d{1,4}/g) || [];
        if (ns.length >= 3) { var a = zahl(ns[0]), r = zahl(ns[1]), c = zahl(ns[2]); if (r >= 5 && r <= 80 && Math.abs(a * r - c) <= Math.max(1, c * 0.01)) out.stundenlohn = r; }
        else if (ns.length === 2) { var r2 = zahl(ns[1]); if (r2 >= 5 && r2 <= 80 && zahl(ns[0]) > 20) out.stundenlohn = r2; }
      }
      if (out.monatslohn === null) {
        var mm = /^(monatslohn|monatsgehalt|gehalt|grundgehalt|bruttogehalt|grundbezug|monatsbezug)\b[^\d€]{0,30}?(\d{1,3}(?:\.\d{3})*,\d\d)/i.exec(t);
        if (mm) { var v2 = zahl(mm[2]); if (v2 >= 500 && v2 <= 20000) out.monatslohn = v2; }
      }
    });
    if (LG && (out.stundenlohn !== null || out.monatslohn !== null)) {
      Object.keys(LG).forEach(function (pk) {
        if (out.paket && out.paket !== pk) return;
        LG[pk].gruppen.forEach(function (g) { var tabs = [g.l]; (LG[pk].folgt || []).forEach(function (f) { if (f.gruppen && f.gruppen[g.id]) tabs.push(f.gruppen[g.id]); }); tabs.forEach(function (tab) { tab.forEach(function (val, si) {
          if (val == null) return;
          var hit = g.m ? (out.monatslohn !== null && Math.abs(out.monatslohn - val) < 0.005) : (out.stundenlohn !== null && Math.abs(out.stundenlohn - val) < 0.005);
          if (hit && !out.treffer.some(function (t0) { return t0.paket === pk && t0.lg === g.id && t0.ls === (LG[pk].stufen && g.l.length > 1 ? si : null); })) out.treffer.push({ paket: pk, lg: g.id, name: g.name, ls: LG[pk].stufen && g.l.length > 1 ? si : null, lehrling: !!g.lehrling });
        }); }); });
      });
    }
    return out;
  }
  var api = { kopf: kopf,  zeigePdf: zeigePdf, parse: parse, norm: norm, zahl: zahl, NAMEN: NAMEN, zeilenAus: zeilenAus, lesePdf: lesePdf };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.StundenLz = api;
})(typeof window !== 'undefined' ? window : globalThis);
