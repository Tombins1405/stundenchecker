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
    [/zs$/, null], // „Überstunden 50% ZS“: Zuschlag auf dieselben Stunden, zählt nicht noch einmal
    [/sonderurlaub/, 'sonder'],
    [/^uberstunden|^uberstd|^mehrarbeit|^ust/, 'ueber'],
    [/feiertag/, 'feiertag'],
    [/urlaub/, 'urlaub'],
    [/krank|entgeltfortzahlung|krst/, 'krank'],
    [/pflege/, 'pflege'],
    [/diaten|aufwandsentsch|taggeld|tagesgeld|reisekosten/, 'dStd'],
    [/^lohn$|^stundenlohn|^normalstunden|^arbeitszeit|^normalarbeitszeit|^gehalt|^lohn/, 'lohn']
  ];
  var NAMEN = { lohn: 'Lohn', ueber: 'Überstunden', feiertag: 'Feiertagslohn', urlaub: 'Urlaub', krank: 'Krankenstand', pflege: 'Pflegefreistellung', dStd: 'Diäten (Stunden)', dEuro: 'Diäten (Betrag in Euro)', sonder: 'Sonderurlaub' };
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
      var menge = zahl(m[2]); if (isNaN(menge)) return;
      var dup = n + '|' + menge; if (seen[dup]) return; seen[dup] = 1;
      zeilen.push({ label: label, norm: n, menge: menge, key: key });
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
      if (!/[A-Za-zÄÖÜäöüß]{3}/.test(label) || label.length > 48) return;
      var n = norm(label); if (n.length < 3 || schon[n] || /^(bem|sv|lst|bv)/.test(n)) return;
      var key = null, pos = 0, rk = null;
      if (gelernt[n] !== undefined) { if (gelernt[n] === '-') return; key = gelernt[n]; pos = gelernt['#' + n] | 0; if (pos >= nums.length) pos = 0; }
      else { for (var i = 0; i < REGELN.length; i++) if (REGELN[i][0].test(n)) { rk = REGELN[i]; break; } if (rk && rk[1] === null) return; }
      var menge = zahl(nums[pos]); if (isNaN(menge)) return;
      if (key === null && rk) { if (rk[1] === 'dStd' && nums.length === 1) key = 'dEuro'; else if (menge <= 400) key = rk[1]; }
      if (key && !(gelernt[n] !== undefined) && used[key]) key = null; // dieselbe Art nie zweimal vorbelegen
      if (key === null && gelernt[n] === undefined && (menge > 400 || /^summe/.test(n))) return; // Beträge und Summen sind nie Stunden
      if (key) used[key] = 1;
      var dup = n + '|' + nums.join(' '); if (schon[dup]) return; schon[dup] = 1;
      kand.push({ label: label, norm: n, menge: menge, key: key, nums: nums, pos: pos, unsicher: true });
    });
    kand.slice(0, 25).forEach(function (q) { zeilen.push(q); });
    return { monat: monat(lines), zeilen: zeilen, lines: lines };
  }
  // Aus pdf.js-Textstücken Zeilen bauen (gleiche Höhe = eine Zeile).
  function zeilenAus(items) {
    var rows = [];
    items.forEach(function (it) { if (!it.str || !it.str.trim()) return; var y = Math.round(it.transform[5] / 3) * 3, r = rows.filter(function (q) { return Math.abs(q.y - it.transform[5]) < 2.5; })[0]; if (!r) { r = { y: it.transform[5], p: [] }; rows.push(r); } r.p.push({ x: it.transform[4], s: it.str }); });
    rows.sort(function (a, b) { return b.y - a.y; });
    return rows.map(function (r) { r.p.sort(function (a, b) { return a.x - b.x; }); return r.p.map(function (q) { return q.s; }).join(' ').replace(/\s+/g, ' ').trim(); });
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
          var all = [], p = Promise.resolve();
          for (var i = 1; i <= doc.numPages; i++) (function (n) { p = p.then(function () { return doc.getPage(n).then(function (pg) { return pg.getTextContent(); }).then(function (tc) { all = all.concat(zeilenAus(tc.items)); }); }); })(i);
          p.then(function () { ok({ lines: all, hatText: all.join('').replace(/\s/g, '').length > 50 }); }, fail);
        }, fail);
      });
    });
  }
  var api = { parse: parse, norm: norm, zahl: zahl, NAMEN: NAMEN, zeilenAus: zeilenAus, lesePdf: lesePdf };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.StundenLz = api;
})(typeof window !== 'undefined' ? window : globalThis);
