/*
 * Stunden-Checker – Rechenkern (Meilenstein A)
 *
 * Reine Rechenlogik ohne Oberfläche und ohne Speicher. Alle Regeln stehen in
 * "Regelpaketen" (Daten), nicht im Code: Wochenstunden, Tagesgrenze, Zuschläge,
 * Diätenmodell, Schlechtwetter. Werte gelten ab einem Datum ("Gültig ab").
 * Gerechnet wird in ganzen Minuten, damit keine Rundungsfehler entstehen.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Engine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------------------------------------------------------------- Regelpakete */
  // Quellen und Prüfstand stehen in "hinweis". "pruefen" heißt: noch nicht an einem echten Lohnzettel bestätigt.
  var PAKETE = {
    gueter: {
      name: 'Güterbeförderung (Lkw)',
      hinweis: 'KV Güterbeförderungsgewerbe, Arbeiter, ab 1.1.2026: 40 Stunden/Woche, Überstunden 50 % (nachts 100 %), Tagesgeld 27,60 € = 2,30 € je Stunde. Überstunden werden pro Monat gerechnet: alle Stunden minus Sollstunden des Monats (Montag bis Freitag, Feiertage eingeschlossen). Zuschläge für Samstag/Sonntag nennt der KV nicht, sie hängen von der Firma ab. Feiertagsarbeit: gesetzlich doppelt bezahlt.',
      pruefen: false,
      werte: {
        diaeten: { modell: 'stunde', satz: 2.30, maxStd: 12, minStd: 0, vorschlag: 'anwesenheit', stufen: [] },
        ueberstunden: { modell: 'monat', wochenStd: 40, tagesGrenze: null, zuschlagPct: 50 },
        stundenlohn: null,
        betriebFrei: 'urlaub',
        zuschlag: { sa: 0, so: 0, ft: 100 },
        schlechtwetter: false
      }
    },
    bau: {
      name: 'Bau (Baugewerbe/Bauindustrie, Maschinist, Bagger)',
      hinweis: 'KV Baugewerbe und Bauindustrie, Arbeiter, ab 1.5.2026: 39-Stunden-Woche (die 40. Stunde ist Mehrarbeit), Überstunde ab mehr als 9 Stunden pro Tag, Zuschlag 50 % (nachts 100 %), Sonntag 100 %, Taggeld pro Tag mit Stufen, Schlechtwetter über die BUAK. Verteilung der Normalarbeitszeit (kurze/lange Woche) ist noch nicht abgebildet.',
      pruefen: true,
      werte: {
        diaeten: { modell: 'tag', satz: 0, maxStd: null, minStd: 0, vorschlag: 'anwesenheit',
          stufen: [{ ab: 3, satz: 12.85 }, { ab: 9, satz: 20.70 }] },
        ueberstunden: { modell: 'bau', wochenStd: 39, tagesGrenze: 9, zuschlagPct: 50 },
        stundenlohn: null,
        betriebFrei: 'urlaub',
        zuschlag: { sa: 0, so: 100, ft: 50 },
        schlechtwetter: true
      }
    },
    eigen: {
      name: 'Eigene Werte',
      hinweis: 'Alle Werte stellst du selbst ein (zum Beispiel nach deinem Kollektivvertrag oder deiner Vereinbarung).',
      pruefen: false,
      werte: {
        diaeten: { modell: 'stunde', satz: 0, maxStd: 12, minStd: 0, vorschlag: 'anwesenheit', stufen: [] },
        ueberstunden: { modell: 'monat', wochenStd: 40, tagesGrenze: null, zuschlagPct: 50 },
        stundenlohn: null,
        betriebFrei: 'urlaub',
        zuschlag: { sa: 0, so: 0, ft: 0 },
        schlechtwetter: false
      }
    }
  };

  // Status eines Tages. credit = Tag wird mit den Sollstunden gutgeschrieben (bezahlte Abwesenheit).
  var STATUS = {
    arbeit:        { name: 'Arbeit',                  credit: false },
    urlaub:        { name: 'Urlaub',                  credit: true },
    krank:         { name: 'Krankenstand',            credit: true },
    pflege:        { name: 'Pflegefreistellung',      credit: true },
    feiertag:      { name: 'Feiertag',                credit: true },
    betriebsurlaub:{ name: 'Betrieb geschlossen / Betriebsurlaub', credit: true },
    za:            { name: 'Zeitausgleich',           credit: false },
    arzt:          { name: 'Frei wegen Arztbesuch',   credit: false },
    frei:          { name: 'Frei',                    credit: false }
  };

  var BUAK_KONTINGENT = 320; // Stunden pro Zeitraum 1. November bis 31. Oktober (BUAK, Stand Okt. 2026)

  /* ---------------------------------------------------------------- Datum */
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function iso(y, m, d) { return y + '-' + pad(m) + '-' + pad(d); }
  function parseISO(s) { var p = s.split('-'); return { y: +p[0], m: +p[1], d: +p[2] }; }
  function weekday(s) { var p = parseISO(s); return new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay(); } // 0 = Sonntag
  function addDays(s, n) {
    var p = parseISO(s), dt = new Date(Date.UTC(p.y, p.m - 1, p.d + n));
    return iso(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
  }
  function daysInMonth(y, m) { return new Date(Date.UTC(y, m, 0)).getUTCDate(); }
  function toMin(t) {
    if (!t) return null;
    var p = String(t).split(':');
    if (p.length < 2 || isNaN(+p[0]) || isNaN(+p[1])) return null;
    return (+p[0]) * 60 + (+p[1]);
  }

  function easter(y) { // Gaußsche Osterformel (gregorianisch)
    var a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4,
      f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30,
      i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7,
      m = Math.floor((a + 11 * h + 22 * l) / 451),
      month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
    return iso(y, month, day);
  }
  var feiertagCache = {};
  function feiertage(y) { // gesetzliche Feiertage Österreich (Karfreitag ist kein allgemeiner Feiertag)
    if (feiertagCache[y]) return feiertagCache[y];
    var o = easter(y), map = {};
    map[iso(y, 1, 1)] = 'Neujahr';
    map[iso(y, 1, 6)] = 'Heilige Drei Könige';
    map[addDays(o, 1)] = 'Ostermontag';
    map[iso(y, 5, 1)] = 'Staatsfeiertag';
    map[addDays(o, 39)] = 'Christi Himmelfahrt';
    map[addDays(o, 50)] = 'Pfingstmontag';
    map[addDays(o, 60)] = 'Fronleichnam';
    map[iso(y, 8, 15)] = 'Mariä Himmelfahrt';
    map[iso(y, 10, 26)] = 'Nationalfeiertag';
    map[iso(y, 11, 1)] = 'Allerheiligen';
    map[iso(y, 12, 8)] = 'Mariä Empfängnis';
    map[iso(y, 12, 25)] = 'Christtag';
    map[iso(y, 12, 26)] = 'Stefanitag';
    feiertagCache[y] = map;
    return map;
  }
  function feiertagName(s) { return feiertage(parseISO(s).y)[s] || null; }
  function dayTyp(s) {
    var wd = weekday(s);
    if (wd === 0) return 'sonntag';
    if (feiertagName(s)) return 'feiertag';
    if (wd === 6) return 'samstag';
    return 'werktag';
  }

  // Wochenstunden (Normalarbeitszeit) und daraus das Tagessoll: Wochenstunden geteilt durch 5 Arbeitstage.
  // Ältere gespeicherte Werte kennen "wochenNormal"; sie werden weiter verstanden.
  function wochenStd(u) { return u.wochenStd != null ? +u.wochenStd : (u.wochenNormal != null ? +u.wochenNormal : 40); }
  function tagesSoll(u) { return wochenStd(u) / 5; }

  /* ---------------------------------------------------------------- Werte "Gültig ab" */
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function neuerWertesatz(paketKey, gueltigAb) {
    var p = PAKETE[paketKey] || PAKETE.gueter, w = clone(p.werte);
    w.paket = PAKETE[paketKey] ? paketKey : 'gueter';
    w.gueltigAb = gueltigAb;
    return w;
  }
  function wertAt(settings, dateStr) {
    if (!settings || !settings.length) return neuerWertesatz('gueter', '1900-01-01');
    var list = settings.slice().sort(function (a, b) { return a.gueltigAb < b.gueltigAb ? -1 : 1; });
    var hit = list[0];
    for (var i = 0; i < list.length; i++) if (list[i].gueltigAb <= dateStr) hit = list[i];
    return hit;
  }

  /* ---------------------------------------------------------------- Arbeitszeit eines Tages */
  // Nachtdienste über Mitternacht: die Stunden gehören zum Tag, an dem der Dienst beginnt (kein Doppelzählen).
  function dayMinutes(day) {
    var von = toMin(day && day.von), bis = toMin(day && day.bis), warn = [];
    if (von === null || bis === null) return { brutto: 0, pausen: 0, netto: 0, warn: warn };
    var brutto = bis - von;
    if (brutto < 0) brutto += 1440;
    if (brutto === 0) warn.push('Von und Bis sind gleich.');
    var pausen = 0;
    (day.pausen || []).forEach(function (p) {
      var s = toMin(p.von), e = toMin(p.bis);
      if (s === null || e === null) return;
      if (s < von) s += 1440;
      if (e < s) e += 1440;
      pausen += e - s;
    });
    var netto = brutto - pausen;
    if (netto < 0) { warn.push('Die Pausen sind länger als die Arbeitszeit.'); netto = 0; }
    return { brutto: brutto, pausen: pausen, netto: netto, warn: warn };
  }

  /* ---------------------------------------------------------------- Ein Tag */
  function calcDay(day, dateStr, w) {
    var typ = dayTyp(dateStr), wd = weekday(dateStr);
    var res = { datum: dateStr, typ: typ, feiertag: feiertagName(dateStr), status: 'arbeit', auto: false, leer: false,
      bruttoMin: 0, pausenMin: 0, nettoMin: 0, faktor: 1, wertMin: 0, creditMin: 0, swMin: 0,
      diaetenStd: 0, diaetenBetrag: 0, saldoMin: null, warn: [] };

    if (!day) {
      if (typ === 'feiertag' && wd >= 1 && wd <= 5) { // Feiertag unter der Woche ohne Eintrag: bezahlt
        day = { status: 'feiertag' };
        res.auto = true;
      } else { res.leer = true; return res; }
    }
    var status = STATUS[day.status] ? day.status : 'arbeit';
    res.status = status;
    var sollMin = Math.round(tagesSoll(w.ueberstunden) * 60);
    res.swMin = w.schlechtwetter ? Math.round((+day.sw || 0) * 60) : 0;

    // Betrieb geschlossen: je nach Firma als Urlaub bezahlt oder aus den Überstunden (dann keine Gutschrift in den Stunden).
    var credit = STATUS[status].credit && !(status === 'betriebsurlaub' && w.betriebFrei === 'ueberstunden');
    if (credit) { res.creditMin = sollMin; return res; }
    if (status !== 'arbeit') return res;

    var m = dayMinutes(day);
    res.bruttoMin = m.brutto; res.pausenMin = m.pausen; res.nettoMin = m.netto; res.warn = m.warn;

    var z = w.zuschlag, pct = 0;
    if (typ === 'sonntag') pct = z.so; else if (typ === 'feiertag') pct = z.ft; else if (typ === 'samstag') pct = z.sa;
    res.faktor = 1 + (pct || 0) / 100;
    res.wertMin = m.netto * res.faktor;

    // Überstunden-Beitrag des Tages (Modell "tag-saldo": Arbeitsstunden minus Tagessoll, kürzere Tage gleichen aus)
    if (w.ueberstunden.modell === 'tag-saldo' && (res.wertMin > 0 || res.swMin > 0)) {
      res.saldoMin = res.wertMin - Math.max(0, sollMin - res.swMin);
    }

    // Diäten
    var d = w.diaeten;
    if (d.modell !== 'aus' && m.brutto > 0) {
      var std;
      if (day.diaeten !== null && day.diaeten !== undefined && day.diaeten !== '') std = +day.diaeten;
      else if (d.vorschlag === 'netto') std = m.netto / 60;
      else if (d.vorschlag === 'leer') std = 0;
      else std = m.brutto / 60;
      if (isNaN(std) || std < 0) std = 0;
      if (d.maxStd) std = Math.min(std, d.maxStd);
      if (std < (d.minStd || 0)) std = 0;
      res.diaetenStd = std;
      if (d.modell === 'tag') {
        var satz = 0;
        (d.stufen || []).forEach(function (s) { if (std > s.ab) satz = s.satz; });
        res.diaetenBetrag = satz;
      } else res.diaetenBetrag = std * d.satz;
    }
    return res;
  }

  /* ---------------------------------------------------------------- BUAK-Zeitraum */
  function buakStart(dateStr) { var p = parseISO(dateStr); return (p.m >= 11 ? p.y : p.y - 1) + '-11-01'; }
  function buakEnde(dateStr) { var s = parseISO(buakStart(dateStr)); return (s.y + 1) + '-10-31'; }
  function swVerbraucht(data, dateStr) {
    var von = buakStart(dateStr), bis = buakEnde(dateStr), sum = 0;
    Object.keys(data.days || {}).forEach(function (k) {
      if (k < von || k > bis) return;
      var w = wertAt(data.settings, k);
      if (w.schlechtwetter) sum += Math.round((+data.days[k].sw || 0) * 60);
    });
    return { vonDatum: von, bisDatum: bis, min: sum, kontingentStd: BUAK_KONTINGENT };
  }


  /* ---------------------------------------------------------------- Urlaubskartei */
  // Anspruch pro Monat = Urlaubstage pro Jahr / 12. Im Eintrittsmonat anteilig nach Kalendertagen (höchstens 30, wie die Lohnverrechnung).
  // Beispiel Lohnzettel: 25 Tage / 12 = 2,08 pro Monat, im Eintrittsmonat (28 Tage) 1,94.
  // Genommen: Tage mit Status Urlaub, und Betrieb geschlossen, wenn die Firma ihn als Urlaub verrechnet.
  function urlaubKartei(data, profil, bisY, bisM) {
    var ein = profil && profil.eintritt;
    if (!ein || !/^\d{4}-\d{2}-\d{2}$/.test(ein)) return [];
    var p = parseISO(ein), jahr = profil.urlaubJahr != null && profil.urlaubJahr !== '' ? +profil.urlaubJahr : 25;
    var saldo = +profil.urlaubStart || 0, out = [], y = p.y, m = p.m, settings = data.settings || [], days = data.days || {};
    while (y < bisY || (y === bisY && m <= bisM)) {
      var tage = (y === p.y && m === p.m) ? Math.min(30, daysInMonth(y, m) - p.d + 1) : 30;
      var anspruch = r2(jahr / 12 * tage / 30), genommen = 0;
      for (var d = 1; d <= daysInMonth(y, m); d++) {
        var ds = iso(y, m, d), day = days[ds];
        if (!day) continue;
        if (day.status === 'urlaub' || (day.status === 'betriebsurlaub' && wertAt(settings, ds).betriebFrei !== 'ueberstunden')) genommen++;
      }
      saldo = r2(saldo + anspruch - genommen);
      out.push({ jahr: y, monat: m, anspruch: anspruch, genommen: genommen, saldo: saldo });
      m++; if (m > 12) { m = 1; y++; }
    }
    return out;
  }

  /* ---------------------------------------------------------------- Ein Monat */
  function h2(min) { return Math.round(min / 60 * 100) / 100; }
  function r2(x) { return Math.round(x * 100) / 100; }

  function calcMonth(data, y, m, heute, opts) {
    var settings = data.settings || [], days = data.days || {};
    // Tage, die erst später abgerechnet werden (zum Beispiel erster Arbeitstag vor der Anmeldung), auf Wunsch weglassen.
    var spaeter = [];
    Object.keys(days).forEach(function (k) {
      var pk = parseISO(k);
      if (days[k] && days[k].spaeter && pk.y === y && pk.m === m) {
        var rr = calcDay(days[k], k, wertAt(settings, k));
        spaeter.push({ datum: k, std: h2(rr.wertMin + rr.creditMin) });
      }
    });
    spaeter.sort(function (a, b) { return a.datum < b.datum ? -1 : 1; });
    if (opts && opts.ohneSpaeter) {
      var ohne = {};
      Object.keys(days).forEach(function (k) { if (!(days[k] && days[k].spaeter)) ohne[k] = days[k]; });
      days = ohne;
    }
    var n = daysInMonth(y, m), tage = [];
    // Beginn der Aufzeichnung: der erste eingetragene Tag. Davor gibt es kein Soll (wichtig, wenn man mitten im Monat anfängt).
    var firstKey = null, live = false;
    if (heute) { var hq = parseISO(heute); live = hq.y === y && hq.m === m; }
    Object.keys(days).forEach(function (k) { if (days[k] && (!firstKey || k < firstKey)) firstKey = k; });
    var s = { istMin: 0, lohnMin: 0, ueberMin: 0, diaetenStd: 0, diaetenBetrag: 0, swMin: 0,
      arbeitstage: 0, urlaub: 0, krank: 0, pflege: 0, za: 0, feiertageBezahlt: 0, zuschlagMin: 0,
      feMin: 0, urMin: 0, krMin: 0, pfMin: 0, feExtraMin: 0 };
    var bauWochen = false, monatModell = false, anyEntry = false;

    for (var d = 1; d <= n; d++) {
      var ds = iso(y, m, d), w = wertAt(settings, ds), r = calcDay(days[ds], ds, w);
      tage.push(r);
      if (r.leer) continue;
      // Automatischer Feiertag ohne Eintrag: vor dem ersten Eintrag und in der Zukunft noch nicht mitzählen (nur Modell "monat").
      if (!days[ds] && w.ueberstunden.modell === 'monat' && ((heute && ds > heute) || (live && firstKey && ds < firstKey))) continue;
      s.istMin += r.nettoMin;
      s.lohnMin += r.wertMin + r.creditMin;
      s.zuschlagMin += r.wertMin - r.nettoMin;
      s.swMin += r.swMin;
      s.diaetenStd += r.diaetenStd;
      s.diaetenBetrag += r.diaetenBetrag;
      if (r.nettoMin > 0) s.arbeitstage++;
      if (r.status === 'urlaub' || r.status === 'betriebsurlaub') s.urlaub++;
      if (r.status === 'krank') s.krank++;
      if (r.status === 'pflege') s.pflege++;
      if (r.status === 'za') s.za++;
      if (r.status === 'feiertag') { s.feiertageBezahlt++; s.feMin += r.creditMin; }
      if (r.status === 'arbeit' && r.typ === 'feiertag' && r.nettoMin > 0) s.feExtraMin += Math.round(tagesSoll(w.ueberstunden) * 60); // Feiertagslohn gibt es auch, wenn man am Feiertag arbeitet (nur Anzeige, nicht in den Stunden)
      if (r.status === 'urlaub' || r.status === 'betriebsurlaub') s.urMin += r.creditMin;
      if (r.status === 'krank') s.krMin += r.creditMin;
      if (r.status === 'pflege') s.pfMin += r.creditMin;
      if (r.saldoMin !== null) s.ueberMin += r.saldoMin;
      anyEntry = true;
      if (w.ueberstunden.modell === 'bau') bauWochen = true;
      if (w.ueberstunden.modell === 'monat') monatModell = true;
    }

    // Modell "monat": alle Stunden des Monats (mit bezahlter Abwesenheit) minus Sollstunden des Monats.
    // Soll = Montag bis Freitag (Feiertage eingeschlossen) mal Tagessoll. Im laufenden Monat nur bis heute.
    if (monatModell && anyEntry) {
      var bis = n;
      if (heute) { var hp = parseISO(heute); if (hp.y === y && hp.m === m) bis = hp.d; else if (hp.y < y || (hp.y === y && hp.m < m)) bis = 0; }
      var sollMin = 0;
      var ab = 1; if (live && firstKey) { var fp = parseISO(firstKey); if (fp.y === y && fp.m === m) ab = fp.d; else if (fp.y > y || (fp.y === y && fp.m > m)) ab = n + 1; }
      for (var q = ab; q <= bis; q++) {
        var dq = iso(y, m, q), wq = weekday(dq);
        if (wq >= 1 && wq <= 5 && !(days[dq] && days[dq].status === 'frei')) sollMin += Math.round(tagesSoll(wertAt(settings, dq).ueberstunden) * 60); // unbezahlter freier Tag zählt nicht zum Soll
      }
      s.ueberMin = s.lohnMin + s.swMin - sollMin;
      s.sollMin = sollMin; s.sollAb = ab;
    }

    // Modell "bau": Überstunden je Woche (Montag bis Sonntag), die Woche zählt in dem Monat, in dem ihr Sonntag liegt.
    if (bauWochen) {
      s.ueberMin = 0;
      for (var dd = 1; dd <= n; dd++) {
        var sonntag = iso(y, m, dd);
        if (weekday(sonntag) !== 0) continue;
        var tagesSumme = 0, ueber = 0, wb = wertAt(settings, sonntag).ueberstunden;
        var grenze = Math.round((wb.tagesGrenze || 9) * 60), normal = Math.round(wochenStd(wb) * 60);
        for (var k = -6; k <= 0; k++) {
          var dk = addDays(sonntag, k), rk = calcDay(days[dk], dk, wertAt(settings, dk));
          if (rk.leer || rk.typ === 'sonntag' || rk.typ === 'feiertag') { // Zuschlagstage zählen nicht doppelt
            if (!rk.leer && rk.creditMin) tagesSumme += Math.min(rk.creditMin, grenze);
            continue;
          }
          var tag = rk.nettoMin + rk.creditMin + rk.swMin;
          ueber += Math.max(0, tag - grenze);
          tagesSumme += Math.min(tag, grenze);
        }
        s.ueberMin += ueber + Math.max(0, tagesSumme - normal);
      }
    }

    // Aufteilung wie auf dem Lohnzettel: Lohn = alle Stunden minus Überstunden minus Feiertag, Urlaub, Krankenstand, Pflege.
    var credMin = s.feMin + s.urMin + s.krMin + s.pfMin;
    var normalMin = Math.max(0, s.lohnMin - Math.max(0, s.ueberMin) - credMin);
    var sw = swVerbraucht(data, iso(y, m, 1));
    return {
      jahr: y, monat: m, tage: tage, spaeter: spaeter,
      summe: {
        istStd: h2(s.istMin), lohnStd: h2(s.lohnMin), zuschlagStd: h2(s.zuschlagMin), ueberStd: h2(s.ueberMin),
        diaetenStd: r2(s.diaetenStd), diaetenBetrag: r2(s.diaetenBetrag), swStd: h2(s.swMin),
        arbeitstage: s.arbeitstage, urlaub: s.urlaub, krank: s.krank, pflege: s.pflege, za: s.za,
        feiertageBezahlt: s.feiertageBezahlt, sollStd: h2(s.sollMin || 0), sollAb: s.sollAb || 1,
        normalStd: h2(normalMin), feiertagStd: h2(s.feMin + s.feExtraMin), urlaubStd: h2(s.urMin), krankStd: h2(s.krMin), pflegeStd: h2(s.pfMin)
      },
      schlechtwetter: { verbrauchtStd: h2(sw.min), kontingentStd: sw.kontingentStd, von: sw.vonDatum, bis: sw.bisDatum }
    };
  }

  // Monatsabgleich: eigene Rechnung gegen die Zeilen auf dem Lohnzettel (gleiche Namen, gleiche Aufteilung).
  // diff = Lohnzettel minus App. Negativ heißt: Der Lohnzettel hat weniger als deine Aufzeichnung.
  var AB_ZEILEN = [
    { key: 'lohn',     label: 'Lohn',          pflicht: true,  faktor: 1, hole: function (s) { return s.normalStd; } },
    { key: 'ueber',    label: 'Überstunden',   pflicht: true,  faktor: 'ueber', hole: function (s) { return Math.max(0, s.ueberStd); } },
    { key: 'feiertag', label: 'Feiertagslohn', pflicht: false, faktor: 1, hole: function (s) { return s.feiertagStd; } },
    { key: 'urlaub',   label: 'Urlaub',        pflicht: false, faktor: 1, hole: function (s) { return s.urlaubStd; } },
    { key: 'krank',    label: 'Krankenstand',  pflicht: false, faktor: 1, hole: function (s) { return s.krankStd; } },
    { key: 'pflege',   label: 'Pflegefreistellung', pflicht: false, faktor: 1, hole: function (s) { return s.pflegeStd; } },
    { key: 'dStd',     label: 'Diäten',        pflicht: true,  faktor: 'diaeten', hole: function (s) { return s.diaetenStd; } },
    // Zeitausgleich-Konto: Überstunden, die nicht ausbezahlt, sondern auf das Konto gebucht wurden. Wird zur Überstundenzeile dazugezählt.
    { key: 'zaKonto',  label: 'Zeitausgleich-Konto (Zuwachs)', pflicht: false, info: true, hole: function () { return null; } },
    // Sonderurlaub: wird von manchen Firmen aus den Überstunden bezahlt und zählt dann zur Zeile "Lohn" dazu.
    { key: 'sonder',   label: 'Sonderurlaub (aus Überstunden bezahlt)', pflicht: false, info: true, hole: function () { return null; } }
  ];
  function hasNum(v) { return !(v === null || v === undefined || v === '' || isNaN(+v)); }
  function abgleich(summe, lz, alle) {
    var rows = [], za = lz && hasNum(lz.zaKonto) ? +lz.zaKonto : 0, so = lz && hasNum(lz.sonder) ? +lz.sonder : 0;
    AB_ZEILEN.forEach(function (z) {
      var v = lz && lz[z.key], has = hasNum(v);
      if (z.info) { // reine Eingabezeile, nur sichtbar wenn eingetragen oder "alle Zeilen"
        if (has || alle) rows.push({ key: z.key, label: z.label, app: null, lz: has ? +v : null, diff: null, status: 'info' });
        return;
      }
      var app = r2(z.hole(summe) || 0);
      var eingetragenOhneApp = has && +v > 0 && app === 0;
      if (!z.pflicht && !alle && app === 0 && !eingetragenOhneApp) return; // Zeile nur zeigen, wenn sie vorkommt
      if (!has) { rows.push({ key: z.key, label: z.label, app: app, lz: null, diff: null, status: 'offen', faktor: z.faktor }); return; }
      var lzWert = +v + (z.key === 'ueber' ? za : 0) + (z.key === 'lohn' ? so : 0); // Überstunden + Zeitausgleich-Konto, Lohn + Sonderurlaub
      var diff = r2(lzWert - app), a = Math.abs(diff);
      rows.push({ key: z.key, label: z.label, app: app, lz: +v, lzGesamt: lzWert, diff: diff, faktor: z.faktor,
        status: a < 0.005 ? 'gleich' : a <= 0.5 ? 'klein' : diff < 0 ? 'weniger' : 'mehr' });
    });
    return rows;
  }
  // Wert der Unterschiede in Euro (brutto, grobe Schätzung). Positiv = dir fehlt Geld, negativ = zu viel bezahlt.
  // Braucht den Stundenlohn aus den Einstellungen. Überstunden zählen mit Zuschlag (Standard 50 %), Diäten mit dem Satz je Stunde.
  function abgleichEuro(rows, w) {
    var lohn = w && w.stundenlohn != null && !isNaN(+w.stundenlohn) ? +w.stundenlohn : null;
    var zus = w && w.ueberstunden && w.ueberstunden.zuschlagPct != null ? +w.ueberstunden.zuschlagPct : 50;
    var out = { ok: true, fehltStundenlohn: false, summe: 0, zeilen: {} };
    rows.forEach(function (r) {
      if (r.status === 'info' || r.status === 'offen' || r.status === 'gleich' || r.diff === null) return;
      var f = r.faktor, eur = null;
      if (f === 'diaeten') { if (w && w.diaeten && w.diaeten.modell === 'stunde' && w.diaeten.satz) eur = -r.diff * w.diaeten.satz; }
      else if (lohn === null) { out.fehltStundenlohn = true; return; }
      else eur = -r.diff * lohn * (f === 'ueber' ? 1 + zus / 100 : f);
      if (eur === null) return;
      eur = Math.round(eur * 100) / 100; out.zeilen[r.key] = eur; out.summe = Math.round((out.summe + eur) * 100) / 100;
    });
    return out;
  }

  return {
    abgleich: abgleich, abgleichEuro: abgleichEuro, urlaubKartei: urlaubKartei, PAKETE: PAKETE, STATUS: STATUS, BUAK_KONTINGENT: BUAK_KONTINGENT,
    iso: iso, parseISO: parseISO, weekday: weekday, addDays: addDays, daysInMonth: daysInMonth, toMin: toMin,
    easter: easter, feiertage: feiertage, feiertagName: feiertagName, dayTyp: dayTyp,
    neuerWertesatz: neuerWertesatz, wertAt: wertAt, dayMinutes: dayMinutes, calcDay: calcDay,
    wochenStd: wochenStd, tagesSoll: tagesSoll, calcMonth: calcMonth, swVerbraucht: swVerbraucht, buakStart: buakStart, h2: h2, r2: r2, clone: clone
  };
});
