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
    klein: {
      name: 'Kleintransportgewerbe (bis 3,5 t)',
      hinweis: 'KV Kleintransportgewerbe, Arbeiter, ab 1.1.2026 (Quelle: wko.at): 40 Stunden/Woche, 50 % Überstundenzuschlag ab der 41. Wochenstunde, Tagesgeld 27,12 € je Kalendertag, bei mehr als 3 Stunden Abwesenheit 1/12 je angefangene Stunde (2,26 € je Stunde). Samstagnachmittag-Zustellung: 50 % (13 bis 18 Uhr), 75 % (18 bis 22 Uhr), das stellst du bei Bedarf selbst ein.',
      pruefen: true,
      werte: {
        diaeten: { modell: 'stunde', satz: 2.26, maxStd: 12, minStd: 3, vorschlag: 'anwesenheit', stufen: [] },
        ueberstunden: { modell: 'monat', wochenStd: 40, tagesGrenze: null, zuschlagPct: 50 },
        stundenlohn: null,
        betriebFrei: 'urlaub',
        zuschlag: { sa: 0, so: 0, ft: 100 },
        schlechtwetter: false
      }
    },
    handel: {
      name: 'Handel (Angestellte und Arbeiter)',
      hinweis: 'KV Handel, ab 1.1.2026 (Quellen: gpa.at und wko.at): 38,5 Stunden/Woche ohne Pausen, Überstunden 50 %, nachts (20 bis 6 Uhr) sowie an Sonn- und Feiertagen 100 %, Überstunden bei erweiterten Öffnungszeiten 70 %. Zeitausgleich für Überstunden 1:1,5 bei 50 %, 1:2 bei 100 %. Bei Monatsgehalt ist die Grundstunde 1/158 (Angestellte) bzw. 1/167 (Arbeiter). Weil die Überstunden von der Einteilung der Firma abhängen, gilt hier die Monatsrechnung als Vorschlag.',
      pruefen: true,
      werte: {
        diaeten: { modell: 'aus', satz: 0, maxStd: null, minStd: 0, vorschlag: 'anwesenheit', stufen: [] },
        ueberstunden: { modell: 'monat', wochenStd: 38.5, tagesGrenze: null, zuschlagPct: 50 },
        stundenlohn: null,
        betriebFrei: 'urlaub',
        zuschlag: { sa: 0, so: 100, ft: 100 },
        schlechtwetter: false
      }
    },
    bund: {
      name: 'Bundesdienst (Österreich)',
      hinweis: 'Bundesdienst: 40 Stunden/Woche mit Gleitzeit. Plus- und Minusstunden laufen auf ein Gleitzeitkonto (Durchrechnung meist pro Quartal), Überstunden und Mehrdienstleistungen müssen angeordnet sein (§ 49 BDG, § 16 Gehaltsgesetz: Zuschlag 50 %, nachts 22 bis 6 Uhr 100 %). Sollzeit je Wochentag, Rahmenzeit, Blockzeit und Übertragungsgrenzen sind je Dienststelle verschieden. Bitte trage die Sollzeit je Wochentag nach deiner Dienstzeitregelung ein.',
      pruefen: true,
      werte: {
        diaeten: { modell: 'aus', satz: 0, maxStd: null, minStd: 0, vorschlag: 'anwesenheit', stufen: [] },
        ueberstunden: { modell: 'gleit', wochenStd: 40, tagesGrenze: null, zuschlagPct: 50, sollProTag: {} },
        stundenlohn: null,
        betriebFrei: 'urlaub',
        zuschlag: { sa: 0, so: 0, ft: 0 },
        schlechtwetter: false
      }
    },
    buero: {
      name: 'Büro (Angestellte), allgemeiner Vorschlag',
      hinweis: 'Für Büroangestellte gibt es keinen einzigen Kollektivvertrag: Er hängt von der Branche deines Betriebs ab (zum Beispiel Handel, Gewerbe, Industrie, IT oder Transport). Die Vorgaben hier sind nur ein Vorschlag nach dem Angestellten-KV Handel 2026 (38,5 Stunden/Woche, Überstunden 50 %, Sonn- und Feiertag 100 %). Den KV deiner Firma findest du auf dem Lohnzettel oder Dienstzettel. Passe die Werte dann an.',
      pruefen: true,
      werte: {
        diaeten: { modell: 'aus', satz: 0, maxStd: null, minStd: 0, vorschlag: 'anwesenheit', stufen: [] },
        ueberstunden: { modell: 'monat', wochenStd: 38.5, tagesGrenze: null, zuschlagPct: 50 },
        stundenlohn: null,
        betriebFrei: 'urlaub',
        zuschlag: { sa: 0, so: 100, ft: 100 },
        schlechtwetter: false
      }
    },
    gueter_ang: {
      name: 'Büro: Güterbeförderung / Transport (Angestellte)',
      hinweis: 'KV Güterbeförderungsgewerbe, Angestellte, ab 1.1.2026 (Quelle: wko.at): 40 Stunden/Woche ohne Pausen, Durchrechnung bis 32 Wochen möglich, Überstunden 50 %, nachts (22 bis 5 Uhr) 100 %. Grundstunde 1/165 des Monatsgehalts. Feiertagsarbeit: ab zwei Stunden 50 % Zuschlag, laut KV in Freizeit. Für Sonntag verweist der KV nur auf das Arbeitsruhegesetz, die App rechnet Sonntag ohne Zuschlag, stelle ihn bei Bedarf selbst ein. Bitte vergleiche mit deinem Dienstzettel.',
      pruefen: true,
      werte: {
        diaeten: { modell: 'aus', satz: 0, maxStd: null, minStd: 0, vorschlag: 'anwesenheit', stufen: [] },
        ueberstunden: { modell: 'monat', wochenStd: 40, tagesGrenze: null, zuschlagPct: 50, ueberTeiler: 165 },
        stundenlohn: null,
        betriebFrei: 'urlaub',
        zuschlag: { sa: 0, so: 0, ft: 100 },
        schlechtwetter: false
      }
    },
    gleit_buero: {
      name: 'Büro mit Gleitzeit (Saldo statt Überstunden)',
      hinweis: 'Bei Gleitzeit zählt die App Plus- und Minusstunden auf einem Gleitzeitkonto statt Überstunden. Du stellst die Sollzeit je Wochentag ein, optional ein Startsaldo und eine Übertragungsgrenze: Was am Quartalsende darüber liegt, verfällt oder wird laut Gleitzeitvereinbarung als Überstunde bezahlt. Überstunden gibt es erst, wenn deine Firma sie anordnet; trage sie dann als Prämie oder in der Zeile „Überstunden“ ein. Gesetzliche Grundlage: § 4b Arbeitszeitgesetz (Gleitzeitvereinbarung). Bitte vergleiche mit deiner Gleitzeitvereinbarung.',
      pruefen: true,
      werte: {
        diaeten: { modell: 'aus', satz: 0, maxStd: null, minStd: 0, vorschlag: 'anwesenheit', stufen: [] },
        ueberstunden: { modell: 'gleit', wochenStd: 38.5, tagesGrenze: null, zuschlagPct: 50, sollProTag: {} },
        stundenlohn: null,
        betriebFrei: 'urlaub',
        zuschlag: { sa: 0, so: 0, ft: 0 },
        schlechtwetter: false
      }
    },
    it_ang: {
      name: 'Büro: Informationstechnologie / IT (Angestellte)',
      hinweis: 'KV Informationstechnologie (Dienstleistungen in der automatischen Datenverarbeitung und Informationstechnik), Angestellte, ab 1.1.2026 (Quelle: wko.at): 38,5 Stunden/Woche, Überstunden 50 %, nachts (20 bis 6 Uhr) sowie Sonntag und Feiertag 100 %. Grundstunde 1/143 des Monatsgehalts. Mehrarbeit bei Teilzeit ist zuschlagsfrei, wenn sie innerhalb von vier Monaten 1:1 mit Zeitausgleich abgegolten wird (die App rechnet nach dem Gesetz mit dem Kalendervierteljahr). Es gibt auch einen Gleitzeitkonto-Zuschlag von 65 % auf Gutstunden, den die App nicht kennt. Bitte vergleiche mit deinem Dienstzettel.',
      pruefen: true,
      werte: {
        diaeten: { modell: 'aus', satz: 0, maxStd: null, minStd: 0, vorschlag: 'anwesenheit', stufen: [] },
        ueberstunden: { modell: 'monat', wochenStd: 38.5, tagesGrenze: null, zuschlagPct: 50, ueberTeiler: 143 },
        stundenlohn: null,
        betriebFrei: 'urlaub',
        zuschlag: { sa: 0, so: 100, ft: 100 },
        schlechtwetter: false
      }
    },
    banken_ang: {
      name: 'Büro: Banken und Bankiers (Angestellte)',
      hinweis: 'KV Banken und Bankiers, Angestellte, ab 2026 (Quelle: wko.at): 38,5 Stunden/Woche ohne Pausen, Überstunden 50 % bis 20 Uhr, zwischen 20 und 6 Uhr sowie Sonn- und Feiertag 100 %. Grundstunde 1/150 des Monatsbezugs. Mehrarbeit bei Teilzeit bis zur vollen Normalarbeitszeit: Stundenlohn plus 16,67 % (das bildet den Anteil von 13. und 14. Gehalt ab). Der Samstagszuschlag hängt von der Fünf-Tage-Woche ab, stelle ihn bei Bedarf selbst ein. Bitte vergleiche mit deinem Dienstzettel.',
      pruefen: true,
      werte: {
        diaeten: { modell: 'aus', satz: 0, maxStd: null, minStd: 0, vorschlag: 'anwesenheit', stufen: [] },
        ueberstunden: { modell: 'monat', wochenStd: 38.5, tagesGrenze: null, zuschlagPct: 50, ueberTeiler: 150, mehrPct: 16.67, zaAusgleich: false },
        stundenlohn: null,
        betriebFrei: 'urlaub',
        zuschlag: { sa: 0, so: 100, ft: 100 },
        schlechtwetter: false
      }
    },
    versicherung_ang: {
      name: 'Büro: Versicherungen, Innendienst (Angestellte)',
      hinweis: 'KV Versicherungsunternehmen, Innendienst, Stand 1.3.2026 (Quelle: wko.at): 38,5 Stunden/Woche, Überstunden 50 %, Grundstunde 1/143 des Bruttomonatsbezugs. Zuschläge für Nacht, Sonntag und Feiertag konnte ich in der Quelle nicht finden, die Feiertagsarbeit ist gesetzlich doppelt bezahlt. Stelle Nacht und Sonntag bei Bedarf selbst ein. Bitte vergleiche mit deinem Dienstzettel.',
      pruefen: true,
      werte: {
        diaeten: { modell: 'aus', satz: 0, maxStd: null, minStd: 0, vorschlag: 'anwesenheit', stufen: [] },
        ueberstunden: { modell: 'monat', wochenStd: 38.5, tagesGrenze: null, zuschlagPct: 50, ueberTeiler: 143 },
        stundenlohn: null,
        betriebFrei: 'urlaub',
        zuschlag: { sa: 0, so: 0, ft: 100 },
        schlechtwetter: false
      }
    },
    gewerbe_ang: {
      name: 'Büro: Gewerbe, Handwerk und Dienstleistung (Angestellte)',
      hinweis: 'KV Gewerbe, Handwerk und Dienstleistung, Angestellte, ab 1.1.2026 (Quelle: wko.at): 40 Stunden/Woche, Überstunden 50 %, zwischen 20 und 6 Uhr sowie an Sonn- und Feiertagen 100 %. Grundstunde 1/150 des Monatsgehalts. Mehrarbeit bei Teilzeit ist zuschlagsfrei, wenn sie 1:1 mit Zeitausgleich abgegolten wird (laut KV innerhalb von vier Monaten, die App rechnet nach dem Gesetz mit dem Kalendervierteljahr). Bitte vergleiche mit deinem Dienstzettel.',
      pruefen: true,
      werte: {
        diaeten: { modell: 'aus', satz: 0, maxStd: null, minStd: 0, vorschlag: 'anwesenheit', stufen: [] },
        ueberstunden: { modell: 'monat', wochenStd: 40, tagesGrenze: null, zuschlagPct: 50, ueberTeiler: 150 },
        stundenlohn: null,
        betriebFrei: 'urlaub',
        zuschlag: { sa: 0, so: 100, ft: 100 },
        schlechtwetter: false
      }
    },
    industrie_ang: {
      name: 'Büro: Metalltechnische Industrie (Angestellte)',
      hinweis: 'KV Metalltechnische Industrie, Angestellte, 2025/2026 (Quelle: metalltechnischeindustrie.at): 38,5 Stunden/Woche, Überstunden 50 %, zwischen 20 und 6 Uhr 100 %, ebenso die dritte und jede weitere Überstunde am Tag. Sonntag über der Wochennormalarbeitszeit 100 %. Grundstunde 1/143 des Monatsgehalts (Normalstunde 1/167). Zeitausgleich nach § 5 Abs. 3c. Bitte vergleiche mit deinem Dienstzettel.',
      pruefen: true,
      werte: {
        diaeten: { modell: 'aus', satz: 0, maxStd: null, minStd: 0, vorschlag: 'anwesenheit', stufen: [] },
        ueberstunden: { modell: 'monat', wochenStd: 38.5, tagesGrenze: null, zuschlagPct: 50, ueberTeiler: 143 },
        stundenlohn: null,
        betriebFrei: 'urlaub',
        zuschlag: { sa: 0, so: 100, ft: 100 },
        schlechtwetter: false
      }
    },
    bau_ang: {
      name: 'Büro: Baugewerbe und Bauindustrie (Angestellte)',
      hinweis: 'KV Baugewerbe und Bauindustrie, Angestellte, ab 2026 (Quelle: wko.at): 39 Stunden/Woche (die 40. Stunde bei Verteilung ist Mehrarbeit mit 50 %), Überstunden 50 %, zwischen 20 und 5 Uhr sowie Sonntag 100 %. Grundstunde 1/146 des Monatsgehalts. Bitte vergleiche mit deinem Dienstzettel.',
      pruefen: true,
      werte: {
        diaeten: { modell: 'aus', satz: 0, maxStd: null, minStd: 0, vorschlag: 'anwesenheit', stufen: [] },
        ueberstunden: { modell: 'monat', wochenStd: 39, tagesGrenze: null, zuschlagPct: 50, ueberTeiler: 146 },
        stundenlohn: null,
        betriebFrei: 'urlaub',
        zuschlag: { sa: 0, so: 100, ft: 100 },
        schlechtwetter: false
      }
    },
    metall: {
      name: 'Metallgewerbe / Mechaniker',
      hinweis: 'KV Eisen- und metallverarbeitendes Gewerbe (Metallgewerbe), Arbeiter, ab 1.1.2026 (Quelle: wko.at): 38,5 Stunden/Woche ohne Pausen, Überstunden mit 50 % oder 100 % Zuschlag, Zeitausgleich 1:1,5 bei 50 % und 1:2 bei 100 %. Welche Zuschläge nachts, am Samstag und am Sonntag gelten, konnte ich nicht belegen. Ob dein Betrieb darunter fällt (zum Beispiel Kfz-Werkstatt), steht auf deinem Lohnzettel.',
      pruefen: true,
      werte: {
        diaeten: { modell: 'aus', satz: 0, maxStd: null, minStd: 0, vorschlag: 'anwesenheit', stufen: [] },
        ueberstunden: { modell: 'monat', wochenStd: 38.5, tagesGrenze: null, zuschlagPct: 50 },
        stundenlohn: null,
        betriebFrei: 'urlaub',
        zuschlag: { sa: 0, so: 0, ft: 100 },
        schlechtwetter: false
      }
    },
    gastro: {
      name: 'Hotel- und Gastgewerbe',
      hinweis: 'KV Hotel- und Gastgewerbe (Quellen: vida.at für den Rahmen mit Stand 2024, wko.at für den Abschluss 2026): 40 Stunden/Woche, Überstunden 50 %, Normalstunde = 1/173 des Monatslohns. Löhne und Gehälter steigen ab 1.10.2026 im Durchschnitt um 3 %, dazu eine Einmalzahlung bis höchstens 275 € brutto (bis 31.12.2026 auszuzahlen). Nachtarbeit (0 bis 6 Uhr) hat einen pauschalen Zuschlag, gestaffelt in Dritteln je begonnene 2 Stunden; die Höhe steht im Lohnabkommen, die App kennt sie nicht, trage sie als Prämie ein. Sonn- und Feiertage hängen vom Betrieb ab, stelle sie bei Bedarf selbst ein.',
      pruefen: true,
      werte: {
        diaeten: { modell: 'aus', satz: 0, maxStd: null, minStd: 0, vorschlag: 'anwesenheit', stufen: [] },
        ueberstunden: { modell: 'monat', wochenStd: 40, tagesGrenze: null, zuschlagPct: 50 },
        stundenlohn: null,
        betriebFrei: 'urlaub',
        zuschlag: { sa: 0, so: 0, ft: 100 },
        schlechtwetter: false
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

  /* ---------------------------------------------------------------- Deutschland (Richtwerte, regional verschieden) */
  // In Deutschland gibt es keinen einheitlichen Kollektivvertrag: Tarifverträge gelten je Bundesland und nur, wenn der Betrieb tarifgebunden ist.
  // Die Vorgaben sind deshalb Richtwerte. Verpflegungspauschale: 14 € bei mehr als 8 Stunden Abwesenheit, 28 € bei 24 Stunden (steuerfrei, 2026).
  function deWerte(o) {
    var w = {
      diaeten: { modell: 'aus', satz: 0, maxStd: null, minStd: 0, vorschlag: 'anwesenheit', stufen: [] },
      ueberstunden: { modell: 'monat', wochenStd: 40, tagesGrenze: null, zuschlagPct: 25 },
      stundenlohn: null, betriebFrei: 'urlaub', zuschlag: { sa: 0, so: 0, ft: 0 }, schlechtwetter: false
    };
    for (var k in o) w[k] = o[k];
    return w;
  }
  var DE_VERPFL = { modell: 'tag', satz: 0, maxStd: null, minStd: 0, vorschlag: 'anwesenheit', stufen: [{ ab: 8, satz: 14 }, { ab: 23.99, satz: 28 }] };
  PAKETE.de_spedition = {
    name: 'Deutschland: Spedition und Logistik (Kraftfahrer)', land: 'DE', pruefen: true,
    hinweis: 'Richtwerte aus der Tarifbroschüre Berlin-Brandenburg (ab 2.2026): 38 Stunden/Woche, Überstunden 25 % (nachts 60 %), Sonntag 70 %, Feiertag 120 %, Entgelt zum Beispiel 2.710 bis 3.008 € im Monat je nach Gruppe. Die Tarifverträge unterscheiden sich je Bundesland und gelten nur, wenn dein Betrieb tarifgebunden ist. Für Fahrer im Güterfernverkehr gibt es eigene Regeln. Mindestlohn 2026: 13,90 € je Stunde. Verpflegungspauschale: 14 € bei mehr als 8 Stunden unterwegs, 28 € bei 24 Stunden, am An- und Abreisetag mehrtägiger Fahrten 14 € ohne Mindestdauer (das musst du selbst eintragen), dazu 9 € je Nacht im Lkw. Bitte vergleiche alles mit deiner Abrechnung.',
    werte: deWerte({ diaeten: DE_VERPFL, ueberstunden: { modell: 'monat', wochenStd: 38, tagesGrenze: null, zuschlagPct: 25 }, zuschlag: { sa: 0, so: 70, ft: 120 } })
  };
  PAKETE.de_bau = {
    name: 'Deutschland: Bauhauptgewerbe (Baumaschinenführer, Bau)', land: 'DE', pruefen: true,
    hinweis: 'Bundesweiter Tarif für das Bauhauptgewerbe, Löhne ab 1.4.2026 (Gesamttarifstundenlohn): Lohngruppe 2 (Maschinenführer) 18,73 €, Lohngruppe 4 (Baumaschinenführer) 26,05 € je Stunde. Zuschläge laut einer Auskunft zum Tarif: Überstunden 25 %, Nacht 20 %, Sonntag 75 %, Feiertag 200 %. Wochenarbeitszeit 40 Stunden angenommen, bitte prüfen. Schlechtwetter läuft in Deutschland nicht über die BUAK, sondern über Saison-Kurzarbeitergeld; das ist hier nicht abgebildet. Verpflegungspauschale: 14 € bei mehr als 8 Stunden unterwegs, 28 € bei 24 Stunden.',
    werte: deWerte({ diaeten: DE_VERPFL, ueberstunden: { modell: 'monat', wochenStd: 40, tagesGrenze: null, zuschlagPct: 25 }, zuschlag: { sa: 0, so: 75, ft: 200 } })
  };
  PAKETE.de_handel = {
    name: 'Deutschland: Einzelhandel', land: 'DE', pruefen: true,
    hinweis: 'Richtwerte für den Einzelhandel in Nordrhein-Westfalen, Tabelle ab 1.8.2026: 37,5 Stunden/Woche. Der Tarif wird je Bundesland verhandelt und gilt nur, wenn dein Betrieb tarifgebunden ist. Beispiele Gehaltsgruppe IV a: 4.014 bis 4.488 € im Monat, je nach Tätigkeitsjahr. Welche Zuschläge für Überstunden, Spätdienst und Sonntag gelten, konnte ich nicht belegen: Sie stehen bei 0, bitte trage sie nach deinem Arbeitsvertrag oder Lohnzettel ein. Bei Monatsgehalt sind Überstunden oft schon im Gehalt oder auf einem Arbeitszeitkonto.',
    werte: deWerte({ ueberstunden: { modell: 'monat', wochenStd: 37.5, tagesGrenze: null, zuschlagPct: 0 } })
  };
  PAKETE.de_buero = {
    name: 'Deutschland: Büro (Angestellte)', land: 'DE', pruefen: true,
    hinweis: 'Für diesen Bereich gibt es in Deutschland keinen einheitlichen Tarifvertrag: Er hängt von Branche und Bundesland ab, und viele Betriebe sind nicht tarifgebunden. Die Werte hier sind nur ein Vorschlag (40 Stunden/Woche, keine Zuschläge). Mindestlohn 2026: 13,90 € je Stunde. Trage Wochenstunden und Zuschläge nach deinem Arbeitsvertrag ein.',
    werte: deWerte({ ueberstunden: { modell: 'monat', wochenStd: 40, tagesGrenze: null, zuschlagPct: 0 } })
  };
  PAKETE.de_metall = {
    name: 'Deutschland: Metall und Kfz-Handwerk', land: 'DE', pruefen: true,
    hinweis: 'Für diesen Bereich gibt es in Deutschland keinen einheitlichen Tarifvertrag: Er hängt von Branche und Bundesland ab, und viele Betriebe sind nicht tarifgebunden. Die Werte hier sind nur ein Vorschlag (40 Stunden/Woche, keine Zuschläge). Mindestlohn 2026: 13,90 € je Stunde. Trage Wochenstunden und Zuschläge nach deinem Arbeitsvertrag ein.',
    werte: deWerte({ ueberstunden: { modell: 'monat', wochenStd: 40, tagesGrenze: null, zuschlagPct: 0 } })
  };
  PAKETE.de_gastro = {
    name: 'Deutschland: Hotel und Gastronomie', land: 'DE', pruefen: true,
    hinweis: 'Für diesen Bereich gibt es in Deutschland keinen einheitlichen Tarifvertrag: Er hängt von Branche und Bundesland ab, und viele Betriebe sind nicht tarifgebunden. Die Werte hier sind nur ein Vorschlag (40 Stunden/Woche, keine Zuschläge). Mindestlohn 2026: 13,90 € je Stunde. Trage Wochenstunden und Zuschläge nach deinem Arbeitsvertrag ein.',
    werte: deWerte({ ueberstunden: { modell: 'monat', wochenStd: 40, tagesGrenze: null, zuschlagPct: 0 } })
  };

  // Freistellung durch die Firma (keine Arbeit): Verrechnung je Tag (day.fv) oder laut Einstellung (w.freiVerr): bezahlt | za | unbezahlt | offen
  function freiModus(day, w) { var m = (day && day.fv) || (w && w.freiVerr) || 'offen'; return ['bezahlt', 'za', 'unbezahlt', 'offen'].indexOf(m) >= 0 ? m : 'offen'; }
  var UNBEZAHLT_FREI = ['frei', 'mutterschutz', 'karenz', 'papamonat']; // kein Lohn von der Firma, keine Sollstunden
  // Status eines Tages. credit = Tag wird mit den Sollstunden gutgeschrieben (bezahlte Abwesenheit).
  var STATUS = {
    arbeit:        { name: 'Arbeit',                  credit: false },
    urlaub:        { name: 'Urlaub',                  credit: true },
    krank:         { name: 'Krankenstand',            credit: true },
    pflege:        { name: 'Pflegefreistellung',      credit: true },
    schule:        { name: 'Schulung / Berufsschule',            credit: true },
    feiertag:      { name: 'Feiertag',                credit: true },
    betriebsurlaub:{ name: 'Betrieb geschlossen / Betriebsurlaub', credit: true },
    za:            { name: 'Zeitausgleich',           credit: false },
    freistellung:  { name: 'Keine Arbeit (von der Firma freigestellt)', credit: false },
    ersatzruhe:    { name: 'Ersatzruhetag',           credit: false },
    arzt:          { name: 'Frei wegen Arztbesuch',   credit: false },
    mutterschutz:  { name: 'Mutterschutz / Wochengeld', credit: false },
    karenz:        { name: 'Karenz',                  credit: false },
    papamonat:     { name: 'Papamonat',               credit: false },
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
  var region = { land: 'AT', bl: '' };
  var BUNDESLAENDER = { BW: 'Baden-Württemberg', BY: 'Bayern', BE: 'Berlin', BB: 'Brandenburg', HB: 'Bremen', HH: 'Hamburg', HE: 'Hessen', MV: 'Mecklenburg-Vorpommern', NI: 'Niedersachsen', NW: 'Nordrhein-Westfalen', RP: 'Rheinland-Pfalz', SL: 'Saarland', SN: 'Sachsen', ST: 'Sachsen-Anhalt', SH: 'Schleswig-Holstein', TH: 'Thüringen' };
  function setRegion(land, bl) { region = { land: land === 'DE' ? 'DE' : 'AT', bl: BUNDESLAENDER[bl] ? bl : '' }; }
  function inList(l, bl) { return !!bl && l.indexOf(bl) >= 0; }
  function feiertage(y) { // gesetzliche Feiertage: Österreich oder Deutschland (je Bundesland)
    var key = y + region.land + region.bl;
    if (feiertagCache[key]) return feiertagCache[key];
    var o = easter(y), map = {};
    if (region.land === 'DE') {
      var b = region.bl;
      map[iso(y, 1, 1)] = 'Neujahr';
      map[addDays(o, -2)] = 'Karfreitag';
      map[addDays(o, 1)] = 'Ostermontag';
      map[iso(y, 5, 1)] = 'Tag der Arbeit';
      map[addDays(o, 39)] = 'Christi Himmelfahrt';
      map[addDays(o, 50)] = 'Pfingstmontag';
      map[iso(y, 10, 3)] = 'Tag der Deutschen Einheit';
      map[iso(y, 12, 25)] = '1. Weihnachtstag';
      map[iso(y, 12, 26)] = '2. Weihnachtstag';
      if (inList(['BW', 'BY', 'ST'], b)) map[iso(y, 1, 6)] = 'Heilige Drei Könige';
      if (inList(['BW', 'BY', 'HE', 'NW', 'RP', 'SL'], b)) map[addDays(o, 60)] = 'Fronleichnam';
      if (inList(['BW', 'BY', 'NW', 'RP', 'SL'], b)) map[iso(y, 11, 1)] = 'Allerheiligen';
      if (inList(['SL'], b)) map[iso(y, 8, 15)] = 'Mariä Himmelfahrt';
      if (inList(['BB', 'MV', 'SN', 'ST', 'TH', 'HB', 'HH', 'NI', 'SH'], b)) map[iso(y, 10, 31)] = 'Reformationstag';
      if (inList(['BE', 'MV'], b) && y >= 2019) map[iso(y, 3, 8)] = 'Internationaler Frauentag';
      if (inList(['TH'], b) && y >= 2019) map[iso(y, 9, 20)] = 'Weltkindertag';
      if (inList(['SN'], b)) { // Buß- und Bettag: Mittwoch vor dem 23. November
        var d = new Date(Date.UTC(y, 10, 22)); while (d.getUTCDay() !== 3) d.setUTCDate(d.getUTCDate() - 1);
        map[iso(y, 11, d.getUTCDate())] = 'Buß- und Bettag';
      }
    } else {
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
    }
    feiertagCache[key] = map;
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
  // Arbeitstage der Woche (0 = Sonntag ... 6 = Samstag). Ohne Angabe: Montag bis Freitag.
  function sollTage(u) { return (u && Array.isArray(u.sollTage)) ? u.sollTage.slice() : [1, 2, 3, 4, 5]; }
  function istSollTag(u, wd) { return sollTage(u).indexOf(wd) >= 0; }
  // Tagessoll: eigener Wert, sonst Wochenstunden geteilt durch die Zahl der Arbeitstage.
  function tagesSoll(u) { return (u && +u.tagesSollStd > 0) ? +u.tagesSollStd : wochenStd(u) / Math.max(1, sollTage(u).length); }
  // Sollzeit je Wochentag (Gleitzeit im Bundesdienst: zum Beispiel Montag bis Donnerstag 8,5 und Freitag 6 Stunden). Leer: Wochenstunden durch Arbeitstage.
  function sollFuer(u, wd) { var p = u && u.sollProTag, v = p ? p[wd] : null; return (v !== null && v !== undefined && v !== '' && !isNaN(+v) && +v >= 0) ? +v : tagesSoll(u); }



  // Lohngruppen laut Kollektivvertrag als Vorschlag für den Stundenlohn (Arbeiter, 2026). Quelle: wko.at Lohnordnungen.
  var STUFEN_AT = ['bis 5 Jahre im Betrieb', 'über 5 bis 10 Jahre', 'über 10 bis 15 Jahre', 'über 15 bis 20 Jahre', 'über 20 Jahre'];
  var STUFEN_HANDEL = ['Berufsjahr 1 bis 3', 'Berufsjahr 4 bis 6', 'Berufsjahr 7 bis 9', 'Berufsjahr 10 bis 12', 'ab Berufsjahr 13'];
  var LOHNGRUPPEN = {
    gueter: { stand: 'ab 1.1.2026', stufen: STUFEN_AT, eintritt: true, gruppen: [
      { id: '1', name: 'Gruppe 1: Hilfsarbeiter, Garage, Mitfahrer, Lkw bis 3,5 t, Stapler', l: [12.34, 12.63, 12.96, 13.27, 13.60] },
      { id: '2', name: 'Gruppe 2: Lkw über 3,5 t, bis 3 Achsen', l: [12.59, 12.92, 13.23, 13.63, 13.94] },
      { id: '3', name: 'Gruppe 3: Lkw über 3,5 t, mehr als 3 Achsen', l: [12.78, 13.07, 13.44, 13.79, 14.12] },
      { id: '4', name: 'Gruppe 4: Zug, Sattelzug, selbstfahrende Arbeitsmaschine, Partieführer', l: [12.92, 13.23, 13.63, 13.94, 14.27] },
      { id: '5a', name: 'Gruppe 5a: Gefahrgut-Einsatztage oder Kran ab 10 Metertonnen', l: [13.23, 13.63, 13.94, 14.27, 14.58] },
      { id: '6.1', name: 'Gruppe 6.1: Berufskraftfahrer (Lehre), Lkw bis 3 Achsen', l: [12.92, 13.23, 13.63, 13.94, 14.27] },
      { id: '6.2', name: 'Gruppe 6.2: Berufskraftfahrer (Lehre), Lkw mehr als 3 Achsen', l: [13.29, 13.56, 13.94, 14.29, 14.58] },
      { id: '6.3', name: 'Gruppe 6.3: Berufskraftfahrer (Lehre), Zug und Sattelzug', l: [13.63, 13.94, 14.27, 14.59, 14.92] },
      { id: '7', name: 'Gruppe 7: Tankstellenbelieferung (Treibstoff, Heizöl)', l: [13.94, 14.27, 14.60, 14.92, 15.22] }
    ] },
    handel: { stand: 'ab 1.1.2026', stufen: STUFEN_HANDEL, gruppen: [
      { id: 'A', name: 'Beschäftigungsgruppe A (Angestellte, Gehalt ÷ 158)', l: [13.23, 13.56, 13.88, null, null] },
      { id: 'B', name: 'Beschäftigungsgruppe B (Angestellte, Gehalt ÷ 158)', l: [13.65, 14.06, 14.46, null, null] },
      { id: 'C', name: 'Beschäftigungsgruppe C (Angestellte, Gehalt ÷ 158)', l: [14.25, 14.77, 15.52, 16.23, 17.01] },
      { id: 'D', name: 'Beschäftigungsgruppe D (Angestellte, Gehalt ÷ 158)', l: [14.95, 15.88, 16.94, 17.99, 19.06] },
      { id: 'E', name: 'Beschäftigungsgruppe E (Angestellte, Gehalt ÷ 158)', l: [16.04, 17.47, 18.90, 20.34, 21.75] },
      { id: 'F', name: 'Beschäftigungsgruppe F (Angestellte, Gehalt ÷ 158)', l: [18.22, 20.38, 22.53, 24.70, 26.86] },
      { id: 'G', name: 'Beschäftigungsgruppe G (Angestellte, Gehalt ÷ 158)', l: [22.53, 24.91, 27.30, 29.68, 32.06] },
      { id: 'H', name: 'Beschäftigungsgruppe H (Angestellte, Gehalt ÷ 158)', l: [27.72, 30.32, 32.93, 35.52, 38.11] }
    ] },
    klein: { stand: 'ab 1.1.2026', stufen: STUFEN_AT, eintritt: true, gruppen: [
      { id: '1', name: 'Kraftfahrer bis 3,5 t und sonstige Arbeiter (Kleintransportgewerbe)', l: [11.20, 11.56, 11.80, 12.27, 12.87] }
    ] },
    bau: { stand: 'ab 1.5.2026', stufen: null, gruppen: [
      { id: 'I', name: 'I Vizepolier', l: [22.57] },
      { id: 'IIa', name: 'II a Facharbeiter', l: [21.96] },
      { id: 'IIb', name: 'II b Facharbeiter', l: [19.99] },
      { id: 'IIIa', name: 'III a Angelernte Bauarbeiter', l: [19.98] },
      { id: 'IIIb', name: 'III b Angelernte Bauarbeiter', l: [19.53] },
      { id: 'IIIc', name: 'III c Angelernte Bauarbeiter', l: [19.08] },
      { id: 'IIId', name: 'III d Angelernte Bauarbeiter', l: [18.59] },
      { id: 'IIIe', name: 'III e Angelernte Bauarbeiter', l: [17.91] },
      { id: 'IV', name: 'IV Bauhilfsarbeiter', l: [17.03] }
    ] }
  };

  /* ---------------------------------------------------------------- Berufe und Bausteine */
  // b = Voreinstellung, welche Bausteine der Beruf braucht (fahrzeug, kunden, praemien), diaeten = ob Diäten üblich sind.
  var BERUFE = {
    lkw: { name: 'Lkw-Fahrer', paket: 'gueter', kvs: ['gueter', 'klein', 'de_spedition', 'eigen'], diaeten: true, sw: false, b: { fahrzeug: true, kunden: true, praemien: true },
      arten: {
        baustelle: { name: 'Baustelle / Kurzstrecke', b: { fahrzeug: true, kunden: true, praemien: true } },
        tour: { name: 'Zustellung / Tour / Filiale', tour: true, b: { fahrzeug: true, kunden: true, praemien: true } },
        fern: { name: 'Fernverkehr', b: { fahrzeug: true, kunden: false, praemien: true } },
        muell: { name: 'Müllabfuhr', b: { fahrzeug: true, kunden: false, praemien: true } },
        kipper: { name: 'Kipper / Erdtransport', b: { fahrzeug: true, kunden: true, praemien: true } },
        kran: { name: 'Kran / Kranfahrer', b: { fahrzeug: true, kunden: true, praemien: true } }
      } },
    bagger: { name: 'Baggerfahrer / Maschinist', paket: 'bau', kvs: ['bau', 'de_bau', 'eigen'], diaeten: true, sw: true, b: { fahrzeug: false, kunden: true, praemien: true },
      arten: {
        bagger: { name: 'Baggerfahrer', b: { fahrzeug: false, kunden: true, praemien: true } },
        lader: { name: 'Laderfahrer (Radlader)', b: { fahrzeug: false, kunden: true, praemien: true } },
        kran: { name: 'Kran / Kranfahrer', b: { fahrzeug: false, kunden: true, praemien: true } }
      } },
    klein: { name: 'Kleintransport (bis 3,5 t)', paket: 'gueter', kvs: ['gueter', 'klein', 'de_spedition', 'eigen'], diaeten: true, sw: false, b: { fahrzeug: true, kunden: true, praemien: false },
      arten: {
        tour: { name: 'Zustellung / Tour / Filiale', tour: true, b: { fahrzeug: true, kunden: true, praemien: false } },
        baustelle: { name: 'Baustelle / Handwerker', b: { fahrzeug: true, kunden: true, praemien: false } },
        fern: { name: 'Express / Kurier (Strecke)', b: { fahrzeug: true, kunden: false, praemien: false } }
      } },
    aussendienst: { name: 'Außendienst / Vertrieb', paket: 'buero', kvs: ['gueter_ang', 'gleit_buero', 'buero', 'handel', 'gewerbe_ang', 'industrie_ang', 'bau_ang', 'it_ang', 'banken_ang', 'versicherung_ang', 'de_buero', 'de_handel', 'eigen'], diaeten: true, sw: false, b: { fahrzeug: true, kunden: true, praemien: true } },
    mechaniker: { name: 'Mechaniker / Werkstatt', paket: 'metall', kvs: ['metall', 'gueter', 'de_metall', 'eigen'], einfach: true, diaeten: false, sw: false, b: { fahrzeug: false, kunden: false, praemien: false },
      arten: {
        kfz: { name: 'Kfz-Mechaniker / Werkstatt', b: { fahrzeug: false, kunden: false, praemien: false } },
        schlosser: { name: 'Schlosser / Schweißer', b: { fahrzeug: false, kunden: false, praemien: false } },
        leiter: { name: 'Werkstattleiter / Meister', b: { fahrzeug: false, kunden: false, praemien: false } },
        lehrling: { name: 'Lehrling', b: { fahrzeug: false, kunden: false, praemien: false } }
      } },
    bund: { name: 'Bundesdienst / Ministerium', verborgen: true, paket: 'bund', kvs: ['bund', 'gleit_buero', 'buero', 'eigen'], einfach: true, diaeten: false, sw: false, b: { fahrzeug: false, kunden: false, praemien: false } },
    buero: { name: 'Büro (Angestellte)', paket: 'buero', kvs: ['gueter_ang', 'gleit_buero', 'buero', 'handel', 'gewerbe_ang', 'industrie_ang', 'bau_ang', 'it_ang', 'banken_ang', 'versicherung_ang', 'de_buero', 'de_handel', 'eigen'], einfach: true, diaeten: false, sw: false, b: { fahrzeug: false, kunden: false, praemien: false } },
    handel: { name: 'Handel / Verkauf', paket: 'handel', kvs: ['handel', 'de_handel', 'eigen'], einfach: true, diaeten: false, sw: false, b: { fahrzeug: false, kunden: false, praemien: true },
      arten: {
        verkauf: { name: 'Verkauf / Kassa', b: { fahrzeug: false, kunden: false, praemien: true } },
        theke: { name: 'Feinkost / Bedientheke / Bäckerei', b: { fahrzeug: false, kunden: false, praemien: true } },
        lager: { name: 'Lager / Warenübernahme', b: { fahrzeug: false, kunden: false, praemien: true } },
        leitung: { name: 'Filialleitung / Stellvertretung', b: { fahrzeug: false, kunden: false, praemien: true } }
      } },
    gastro: { name: 'Gastronomie / Hotel', paket: 'gastro', kvs: ['gastro', 'de_gastro', 'eigen'], einfach: true, diaeten: false, sw: false, b: { fahrzeug: false, kunden: false, praemien: false },
      arten: {
        service: { name: 'Service (Kellner, Bar)', b: { fahrzeug: false, kunden: false, praemien: true } },
        kueche: { name: 'Küche', b: { fahrzeug: false, kunden: false, praemien: false } },
        chef: { name: 'Küchenchef / Koch', b: { fahrzeug: false, kunden: false, praemien: true } },
        rezeption: { name: 'Rezeption / Empfang', b: { fahrzeug: false, kunden: false, praemien: false } },
        housekeeping: { name: 'Zimmerservice / Housekeeping', b: { fahrzeug: false, kunden: false, praemien: false } },
        betrieb: { name: 'Betriebsküche / Catering / Kantine', b: { fahrzeug: false, kunden: false, praemien: true } }
      } },
    anderes: { name: 'Etwas anderes', paket: 'eigen', einfach: true, diaeten: false, sw: false, b: { fahrzeug: false, kunden: false, praemien: false } }
  };
  function berufName(w) {
    var b = w && BERUFE[w.beruf]; if (!b) return null;
    var a = b.arten && w.art && b.arten[w.art];
    return b.name + (a ? ' (' + a.name + ')' : '');
  }
  // Ist die Arbeitsart eine Tour? Dann heißen "Kunde / Baustelle" in der Erfassung "Tour".
  function istBau(w) { return !!w && (w.paket === 'bau' || w.paket === 'de_bau'); }
  function istTour(w) { var b = w && BERUFE[w.beruf], a = b && b.arten && w.art && b.arten[w.art]; return !!(a && a.tour); }
  // Fehlt "bausteine" (ältere Konten), ist alles an: nichts verschwindet.
  function bausteine(w) {
    var s = (w && w.bausteine) || {};
    return { fahrzeug: s.fahrzeug !== false, kunden: s.kunden !== false, praemien: s.praemien !== false };
  }

  /* ---------------------------------------------------------------- Werte "Gültig ab" */
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function neuerWertesatz(paketKey, gueltigAb) {
    var p = PAKETE[paketKey] || PAKETE.gueter, w = clone(p.werte);
    w.paket = PAKETE[paketKey] ? paketKey : 'gueter';
    w.gueltigAb = gueltigAb;
    w.runAn = false; w.runMin = 15; w.runBeg = 'nahe'; w.runEnd = 'nahe';
    if (!w.freiVerr) w.freiVerr = 'offen';
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
  // art: 'nahe' = zur nächsten Marke, 'auf' = aufrunden, 'ab' = abrunden, sonst keine Rundung
  function rundZeit(min, art, schritt) {
    if (art !== 'nahe' && art !== 'auf' && art !== 'ab') return min;
    var q = min / schritt;
    return Math.round((art === 'nahe' ? Math.round(q) : art === 'auf' ? Math.ceil(q) : Math.floor(q)) * schritt);
  }
  function dayMinutes(day, w) {
    var von = toMin(day && day.von), bis = toMin(day && day.bis), warn = [];
    if (von === null || bis === null) return { brutto: 0, pausen: 0, netto: 0, warn: warn };
    // Rundung der Zeiten laut Einstellung (nur die Berechnung, der eingetragene Wert bleibt stehen)
    var rm = w && w.runAn && +w.runMin > 0 ? +w.runMin : 0;
    if (rm) { von = rundZeit(von, w.runBeg, rm); bis = rundZeit(bis, w.runEnd, rm); }
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
    // Automatischer Pausenabzug (zum Beispiel 60 Minuten), wenn der Tag keine eigene Pause hat. Die Diäten zählen weiter ab Beginn bis Ende.
    if (pausen === 0 && w && +w.pauseAutoMin > 0 && brutto > 0) pausen = Math.min(brutto, Math.round(+w.pauseAutoMin));
    var netto = brutto - pausen;
    if (netto < 0) { warn.push('Die Pausen sind länger als die Arbeitszeit.'); netto = 0; }
    return { brutto: brutto, pausen: pausen, netto: netto, warn: warn };
  }

  /* ---------------------------------------------------------------- Ein Tag */
  function calcDay(day, dateStr, w) {
    var typ = dayTyp(dateStr), wd = weekday(dateStr);
    var res = { datum: dateStr, typ: typ, feiertag: feiertagName(dateStr), status: 'arbeit', auto: false, leer: false,
      bruttoMin: 0, pausenMin: 0, nettoMin: 0, faktor: 1, wertMin: 0, creditMin: 0, extraMin: 0, swMin: 0,
      diaetenStd: 0, diaetenBetrag: 0, saldoMin: null, warn: [] };

    if (!day) {
      if (typ === 'feiertag' && istSollTag(w.ueberstunden, wd)) { // Feiertag an einem Arbeitstag ohne Eintrag: bezahlt
        day = { status: 'feiertag' };
        res.auto = true;
      } else { res.leer = true; return res; }
    }
    var status = STATUS[day.status] ? day.status : 'arbeit';
    res.status = status;
    var sollMin = Math.round(sollFuer(w.ueberstunden, wd) * 60);
    res.swMin = w.schlechtwetter ? Math.round((+day.sw || 0) * 60) : 0;

    // Betrieb geschlossen: je nach Firma als Urlaub bezahlt oder aus den Überstunden (dann keine Gutschrift in den Stunden).
    var credit = STATUS[status].credit && !(status === 'betriebsurlaub' && w.betriebFrei === 'ueberstunden');
    if (status === 'freistellung') { res.freiModus = freiModus(day, w); res.freiSollMin = sollMin; if (res.freiModus === 'bezahlt' || res.freiModus === 'offen') res.creditMin = sollMin; return res; } // Firma schickt heim: bezahlt = Sollstunden gutgeschrieben, sonst keine Gutschrift (Zeitausgleich oder unbezahlt)
    if (status === 'ersatzruhe') { var exr = +day.extra; if (isNaN(exr) || exr < 0) exr = 0; res.extraMin = Math.round(exr * 60); res.creditMin = res.extraMin; return res; } // Ersatzruhetag: ohne Angabe zählt er aus den Überstunden, mit Angabe hat die Firma die Stunden bezahlt
    if (credit) { res.creditMin = sollMin; return res; }
    if (status !== 'arbeit') return res;

    var m = dayMinutes(day, w);
    res.bruttoMin = m.brutto; res.pausenMin = m.pausen; res.nettoMin = m.netto; res.warn = m.warn;

    var z = w.zuschlag, pct = 0;
    if (typ === 'sonntag') pct = z.so; else if (typ === 'feiertag') pct = z.ft; else if (typ === 'samstag') pct = z.sa;
    res.faktor = 1 + (pct || 0) / 100;
    res.wertMin = m.netto * res.faktor;
    // Zusätzlich bezahlte Stunden am selben Tag (zum Beispiel Sonderurlaub plus Arbeit): werden einfach dazugezählt.
    var ex = +day.extra; if (isNaN(ex) || ex < 0) ex = 0;
    res.extraMin = Math.round(ex * 60); res.creditMin = res.extraMin;

    // Überstunden-Beitrag des Tages (Modell "tag-saldo": Arbeitsstunden minus Tagessoll, kürzere Tage gleichen aus)
    if (w.ueberstunden.modell === 'tag-saldo' && (res.wertMin > 0 || res.swMin > 0 || res.extraMin > 0)) {
      res.saldoMin = res.wertMin + res.extraMin - Math.max(0, sollMin - res.swMin);
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


  /* ---------------------------------------------------------------- Zeit pro Kunde */
  // Jeder Eintrag mit von und bis zählt seine Zeit abzüglich der Pausen, die darin liegen.
  // Gibt es an dem Tag nur einen Kunden und keine Zeiten dazu, zählt die Arbeitszeit des Tages (netto).
  function kundenZeiten(day, w) {
    var pausen = ((day && day.pausen) || []).map(function (p) { return [toMin(p.von), toMin(p.bis)]; }).filter(function (p) { return p[0] !== null && p[1] !== null; });
    function dauer(von, bis) {
      var a = toMin(von), b = toMin(bis); if (a === null || b === null) return null;
      if (b < a) b += 1440;
      var min = b - a;
      pausen.forEach(function (p) {
        var s = p[0], e = p[1]; if (e < s) e += 1440;
        [0, 1440].forEach(function (off) { var o = Math.min(b, e + off) - Math.max(a, s + off); if (o > 0) min -= o; });
      });
      return Math.max(0, min);
    }
    var rows = [];
    ((day && day.kunden) || []).forEach(function (k, ki) {
      if (!k) return;
      var tl = k.taet || ((k.tat || k.von || k.bis) ? [{ tat: k.tat, von: k.von, bis: k.bis }] : []);
      tl = tl.map(function (t, j) { return { t: t, j: j }; }).filter(function (o) { return (o.t.tat || '').trim() || o.t.von || o.t.bis; });
      if (!(k.name || '').trim() && !tl.length) return;
      var taet = tl.map(function (o) { return { tat: (o.t.tat || '').trim(), min: dauer(o.t.von, o.t.bis), j: o.j }; });
      var min = null; taet.forEach(function (t) { if (t.min !== null) min = (min || 0) + t.min; });
      rows.push({ name: (k.name || '').trim(), taet: taet, min: min, ki: ki });
    });
    // Nur ein Kunde und keine Zeiten: es zählt die Arbeitszeit des Tages.
    if (rows.length === 1 && rows[0].min === null) {
      var dm = dayMinutes(day, w); if (dm.netto > 0) { rows[0].min = dm.netto; rows[0].quelle = 'tag'; }
    }
    var total = 0; rows.forEach(function (r) { if (r.min !== null) total += r.min; });
    return { rows: rows, totalMin: total };
  }


  /* ---------------------------------------------------------------- Prämien */
  // Eine Prämie hat Name, Betrag und Einheit: stunde (zählt die Arbeitsstunden des Tages), tag (Haken am Tag), stueck oder tour (Anzahl am Tag),
  // monat (einmal pro Monat, wenn du in dem Monat gearbeitet hast). Die Prämien stehen in profil.praemien.
  function praemienDay(day, r, list, w) {
    var out = [];
    if (!day || !r || r.status !== 'arbeit') return out;
    (list || []).forEach(function (p) {
      var menge = 0, e = p.einheit;
      if (e === 'monat') return;
      if (e === 'stunde') menge = r.nettoMin / 60;
      else if (e === 'taet') {
        var kw = (p.taet || '').trim().toLowerCase(), mm = 0;
        if (kw) kundenZeiten(day, w).rows.forEach(function (k) { k.taet.forEach(function (t) { if (t.min && t.tat.toLowerCase().indexOf(kw) >= 0) mm += t.min; }); });
        menge = mm / 60;
      }
      else { var v = day.praemien && day.praemien[p.id]; menge = +v > 0 ? +v : 0; }
      if (menge > 0) out.push({ id: p.id, name: p.name, einheit: e, menge: menge, euro: menge * (+p.betrag || 0) });
    });
    return out;
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
      var anspruch = r2(jahr / 12 * tage / 30), genommen = 0, kTage = 0;
      for (var d = 1; d <= daysInMonth(y, m); d++) {
        var ds = iso(y, m, d), day = days[ds];
        if (!day) continue;
        if (day.status === 'karenz') kTage++; // § 15f MSchG: Karenz kürzt den Urlaub anteilig (Mutterschutz-Schutzfrist nicht)
        if (day.status === 'urlaub' || (day.status === 'betriebsurlaub' && wertAt(settings, ds).betriebFrei !== 'ueberstunden')) genommen++;
      }
      if (kTage) anspruch = r2(anspruch * (1 - Math.min(kTage, daysInMonth(y, m)) / daysInMonth(y, m)));
      saldo = r2(saldo + anspruch - genommen);
      out.push({ jahr: y, monat: m, anspruch: anspruch, genommen: genommen, saldo: saldo, karenzTage: kTage });
      m++; if (m > 12) { m = 1; y++; }
    }
    return out;
  }

  /* ---------------------------------------------------------------- Ein Monat */
  function h2(min) { return Math.round(min / 60 * 100) / 100; }
  function r2(x) { return Math.round(x * 100) / 100; }

  // Gleitzeitsaldo des laufenden Quartals bis einschließlich dieses Monats (Durchrechnung pro Quartal).
  function gleitQuartal(data, y, m, heute, opts) {
    var q0 = 3 * Math.floor((m - 1) / 3) + 1, sum = 0;
    for (var mm = q0; mm <= m; mm++) {
      var o = { noQ: true, noZa: true, noK: true }; if (opts && opts.ohneSpaeter) o.ohneSpaeter = true;
      sum += calcMonth(data, y, mm, heute, o).summe.ueberStd;
    }
    return Math.round(sum * 100) / 100;
  }
  // Gleitzeitkonto: Startsaldo plus alle Monatssalden seit dem ersten Eintrag. Ist eine Übertragungsgrenze (Plus) eingestellt, verfällt am Quartalsende, was darüber liegt.
  function gleitKonto(data, y, m, heute, opts) {
    var days = data.days || {}, first = null;
    Object.keys(days).forEach(function (k) { if (days[k] && (!first || k < first)) first = k; });
    if (!first) return { konto: 0, verfall: 0 };
    var f = parseISO(first); if (f.y > y || (f.y === y && f.m > m)) return { konto: 0, verfall: 0 };
    var w0 = wertAt(data.settings || [], first).ueberstunden || {};
    var sum = w0.gleitStart != null && w0.gleitStart !== '' && !isNaN(+w0.gleitStart) ? +w0.gleitStart * 60 : 0, verfall = 0, yy = f.y, mm = f.m, live = false;
    if (heute) { var hq = parseISO(heute); live = hq.y === y && hq.m === m; }
    while (yy < y || (yy === y && mm <= m)) {
      var o = { noQ: true, noZa: true, noK: true }; if (opts && opts.ohneSpaeter) o.ohneSpaeter = true;
      sum += Math.round(calcMonth(data, yy, mm, heute, o).summe.ueberStd * 60);
      var wl = wertAt(data.settings || [], iso(yy, mm, 1)).ueberstunden || {};
      if (mm % 3 === 0 && !(yy === y && mm === m && live) && wl.gleitMax != null && wl.gleitMax !== '' && !isNaN(+wl.gleitMax) && sum > +wl.gleitMax * 60) { verfall += sum - Math.round(+wl.gleitMax * 60); sum = Math.round(+wl.gleitMax * 60); }
      mm++; if (mm > 12) { mm = 1; yy++; }
    }
    return { konto: Math.round(sum / 60 * 100) / 100, verfall: Math.round(verfall / 60 * 100) / 100 };
  }
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
      arbeitstage: 0, urlaub: 0, krank: 0, pflege: 0, schule: 0, za: 0, freiTage: 0, freiListe: [], feiertageBezahlt: 0, zuschlagMin: 0,
      feMin: 0, urMin: 0, krMin: 0, pfMin: 0, feExtraMin: 0 };
    var bauWochen = false, monatModell = false, gleitModell = false, anyEntry = false;
    var prList = (data.profil && data.profil.praemien) || [], prSum = {};

    for (var d = 1; d <= n; d++) {
      var ds = iso(y, m, d), w = wertAt(settings, ds), r = calcDay(days[ds], ds, w);
      tage.push(r);
      if (r.leer) continue;
      // Automatischer Feiertag ohne Eintrag: vor dem ersten Eintrag und in der Zukunft noch nicht mitzählen (nur Modell "monat").
      if (!days[ds] && (w.ueberstunden.modell === 'monat' || w.ueberstunden.modell === 'gleit') && ((heute && ds > heute) || (live && firstKey && ds < firstKey))) continue;
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
      if (r.status === 'schule') s.schule++;
      if (r.status === 'za') s.za++;
      if (r.status === 'freistellung') { s.freiTage++; s.freiListe.push({ datum: ds, modus: r.freiModus, std: h2(r.freiSollMin || 0) }); }
      if (r.status === 'feiertag') { s.feiertageBezahlt++; s.feMin += r.creditMin; }
      if (r.status === 'arbeit' && r.typ === 'feiertag' && r.nettoMin > 0) s.feExtraMin += Math.round(tagesSoll(w.ueberstunden) * 60); // Feiertagslohn gibt es auch, wenn man am Feiertag arbeitet (nur Anzeige, nicht in den Stunden)
      if (r.status === 'urlaub' || r.status === 'betriebsurlaub') s.urMin += r.creditMin;
      if (r.status === 'krank') s.krMin += r.creditMin;
      if (r.status === 'pflege') s.pfMin += r.creditMin;
      if (r.saldoMin !== null) s.ueberMin += r.saldoMin;
      praemienDay(days[ds], r, prList, w).forEach(function (x) { var a = prSum[x.id] || (prSum[x.id] = { id: x.id, name: x.name, einheit: x.einheit, menge: 0, euro: 0 }); a.menge += x.menge; a.euro += x.euro; });
      anyEntry = true;
      if (w.ueberstunden.modell === 'bau') bauWochen = true;
      if (w.ueberstunden.modell === 'monat' || w.ueberstunden.modell === 'gleit') monatModell = true;
      if (w.ueberstunden.modell === 'gleit') gleitModell = true;
    }

    prList.forEach(function (p) { if (p.einheit === 'monat' && s.arbeitstage > 0) prSum[p.id] = { id: p.id, name: p.name, einheit: 'monat', menge: 1, euro: +p.betrag || 0 }; });
    var prArr = prList.filter(function (p) { return prSum[p.id]; }).map(function (p) { var a = prSum[p.id]; return { id: a.id, name: a.name, einheit: a.einheit, menge: Math.round(a.menge * 100) / 100, euro: Math.round(a.euro * 100) / 100 }; });
    var prEuro = 0; prArr.forEach(function (a) { prEuro += a.euro; });

    // Modell "monat": alle Stunden des Monats (mit bezahlter Abwesenheit) minus Sollstunden des Monats.
    // Soll = deine Arbeitstage (Standard Montag bis Freitag, Feiertage eingeschlossen) mal Tagessoll. Im laufenden Monat nur bis heute.
    if (monatModell && anyEntry) {
      var bis = n;
      if (heute) { var hp = parseISO(heute); if (hp.y === y && hp.m === m) bis = hp.d; else if (hp.y < y || (hp.y === y && hp.m < m)) bis = 0; }
      var sollMin = 0;
      var ab = 1; if (live && firstKey) { var fp = parseISO(firstKey); if (fp.y === y && fp.m === m) ab = fp.d; else if (fp.y > y || (fp.y === y && fp.m > m)) ab = n + 1; }
      for (var q = ab; q <= bis; q++) {
        var dq = iso(y, m, q), wq = weekday(dq);
        if (istSollTag(wertAt(settings, dq).ueberstunden, wq) && !(days[dq] && (UNBEZAHLT_FREI.indexOf(days[dq].status) >= 0 || (days[dq].status === 'freistellung' && freiModus(days[dq], wertAt(settings, dq)) === 'unbezahlt')))) sollMin += Math.round(sollFuer(wertAt(settings, dq).ueberstunden, wq) * 60); // unbezahlter freier Tag zählt nicht zum Soll
      }
      s.ueberMin = s.lohnMin + s.swMin - sollMin;
      s.sollMin = sollMin; s.sollAb = ab;
      // Teilzeit (AT, § 19d AZG): Stunden über das vereinbarte Ausmaß bis zur Vollzeit-Grenze des Kollektivvertrags sind Mehrarbeit, erst darüber Überstunden.
      var wzm = wertAt(settings, iso(y, m, n)).ueberstunden, woz = wochenStd(wzm), vzz = wzm.vollzeitStd != null ? +wzm.vollzeitStd : 0;
      if (s.ueberMin > 0 && vzz > woz && woz > 0) {
        s.mehrMin = Math.min(s.ueberMin, Math.round(sollMin * (vzz / woz - 1))); s.mehrPct = wzm.mehrPct != null ? +wzm.mehrPct : 25;
        // 1:1-Zeitausgleich im Kalendervierteljahr (§ 19d AZG): Wird die Mehrarbeit im selben Quartal durch Minusstunden ausgeglichen, entfällt der Zuschlag (anteilig).
        if (wzm.zaAusgleich !== false && !(opts && opts.noZa)) {
          var q0z = 3 * Math.floor((m - 1) / 3) + 1, qSum = 0, qMehr = 0;
          for (var mz = q0z; mz < q0z + 3; mz++) {
            if (mz === m) { qSum += s.ueberMin; qMehr += s.mehrMin; continue; }
            var pre = y + '-' + (mz < 10 ? '0' : '') + mz + '-', hat = Object.keys(days).some(function (k) { return k.indexOf(pre) === 0 && days[k]; });
            if (!hat) continue; // Monat ohne Einträge (noch nicht begonnen): zählt nicht als Minus
            var oz = { noQ: true, noZa: true }; if (opts && opts.ohneSpaeter) oz.ohneSpaeter = true;
            var cz = calcMonth(data, y, mz, heute, oz);
            qSum += Math.round(cz.summe.ueberStd * 60); qMehr += Math.round(cz.summe.mehrStd * 60);
          }
          var offs = Math.min(qMehr, Math.max(0, qMehr - Math.max(0, qSum)));
          if (offs > 0 && qMehr > 0) { s.mehrFreiMin = Math.round(s.mehrMin * offs / qMehr); s.mehrMin -= s.mehrFreiMin; }
        }
      }
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
    var normalMin = Math.max(0, s.lohnMin - Math.max(0, s.ueberMin) - credMin) + (s.mehrFreiMin || 0);
    // Dienste (Bereitschaft, Notdienst, frei benannt): zählen an jedem Tagestyp, auch ohne Arbeitszeit. Die Bezahlung legt der Nutzer fest.
    var dList = (data.profil && data.profil.dienste) || [], dSum = {};
    for (var dd = 1; dd <= n; dd++) {
      var dday = days[iso(y, m, dd)];
      if (!dday || !dday.dienste) continue;
      dList.forEach(function (p) {
        var v = +dday.dienste[p.id]; if (!(v > 0)) return;
        var a = dSum[p.id] || (dSum[p.id] = { id: p.id, name: p.name, art: p.art, einheit: p.einheit, menge: 0, euro: 0 });
        a.menge += v; a.euro += v * (+p.betrag || 0);
      });
    }
    var dArr = Object.keys(dSum).map(function (k) { dSum[k].menge = r2(dSum[k].menge); dSum[k].euro = r2(dSum[k].euro); return dSum[k]; });
    var sw = swVerbraucht(data, iso(y, m, 1));
    return {
      jahr: y, monat: m, tage: tage, spaeter: spaeter,
      summe: {
        istStd: h2(s.istMin), lohnStd: h2(s.lohnMin), zuschlagStd: h2(s.zuschlagMin), ueberStd: h2(s.ueberMin), mehrStd: h2(s.mehrMin || 0), mehrFreiStd: h2(s.mehrFreiMin || 0), mehrPct: s.mehrPct != null ? s.mehrPct : 25, gleit: gleitModell, gleitQuartalStd: gleitModell && !(opts && opts.noQ) ? gleitQuartal(data, y, m, heute, opts) : null, gleitKontoStd: gleitModell && !(opts && (opts.noQ || opts.noK)) ? gleitKonto(data, y, m, heute, opts).konto : null, gleitVerfallStd: gleitModell && !(opts && (opts.noQ || opts.noK)) ? gleitKonto(data, y, m, heute, opts).verfall : null,
        diaetenStd: r2(s.diaetenStd), diaetenBetrag: r2(s.diaetenBetrag), swStd: h2(s.swMin), dienste: dArr, dienstDef: dList.filter(function (p) { return p.name; }).map(function (p) { return { id: p.id, name: p.name, einheit: p.einheit, betrag: +p.betrag || 0 }; }), praemien: prArr, praemienDef: prList.filter(function (p) { return p.name; }).map(function (p) { return { id: p.id, name: p.name }; }), praemienEuro: r2(prEuro),
        arbeitstage: s.arbeitstage, urlaub: s.urlaub, krank: s.krank, pflege: s.pflege, schule: s.schule, za: s.za, freiTage: s.freiTage, freiListe: s.freiListe,
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
    { key: 'ueber',    label: 'Überstunden',   pflicht: true,  faktor: 'ueber', hole: function (s) { return Math.max(0, s.ueberStd - (s.mehrStd || 0) - (s.mehrFreiStd || 0)); } },
    { key: 'mehr',     label: 'Mehrarbeit (Teilzeit)', pflicht: false, faktor: 'mehr', hole: function (s) { return s.mehrStd || 0; } },
    { key: 'feiertag', label: 'Feiertagslohn', pflicht: false, faktor: 1, hole: function (s) { return s.feiertagStd; } },
    { key: 'urlaub',   label: 'Urlaub',        pflicht: false, faktor: 1, hole: function (s) { return s.urlaubStd; } },
    { key: 'krank',    label: 'Krankenstand',  pflicht: false, faktor: 1, hole: function (s) { return s.krankStd; } },
    { key: 'pflege',   label: 'Pflegefreistellung', pflicht: false, faktor: 1, hole: function (s) { return s.pflegeStd; } },
    { key: 'dStd',     label: 'Diäten',        pflicht: true,  faktor: 'diaeten', hole: function (s) { return s.diaetenStd; } },
    // Manche Lohnzettel zeigen bei Diäten nur den Betrag in Euro, keine Stunden.
    { key: 'dEuro',    label: 'Diäten (Betrag in Euro)', unit: '€', pflicht: false, nurAlle: true, faktor: 'euro', hole: function (s) { return s.diaetenBetrag; } },
    // Zeitausgleich-Konto: Überstunden, die nicht ausbezahlt, sondern auf das Konto gebucht wurden. Wird zur Überstundenzeile dazugezählt.
    { key: 'zaKonto',  label: 'Zeitausgleich-Konto (Zuwachs)', pflicht: false, info: true, hole: function () { return null; } },
    // Sonderurlaub: wird von manchen Firmen aus den Überstunden bezahlt und zählt dann zur Zeile "Lohn" dazu.
    { key: 'sonder',   label: 'Sonderurlaub (aus Überstunden bezahlt)', pflicht: false, info: true, hole: function () { return null; } }
  ];
  function hasNum(v) { return !(v === null || v === undefined || v === '' || isNaN(+v)); }
  function abgleich(summe, lz, alle, fix) { // fix: Fixlohn (Monatsgehalt): Lohn, Feiertag, Urlaub, Krank und Pflege stehen dann ohne Stunden auf dem Lohnzettel
    if (summe && summe.gleit) { // Gleitzeit (Bundesdienst): ein Saldo statt Lohn und Überstunden
      var gv = lz && lz.gleit, gh = hasNum(gv), ga = r2(summe.ueberStd || 0), grow;
      if (!gh) grow = { key: 'gleit', label: 'Gleitzeitsaldo des Monats', app: ga, lz: null, diff: null, status: 'offen', faktor: 0 };
      else { var gd = r2(+gv - ga), gb = Math.abs(gd); grow = { key: 'gleit', label: 'Gleitzeitsaldo des Monats', app: ga, lz: +gv, lzGesamt: +gv, diff: gd, faktor: 0, status: gb < 0.005 ? 'gleich' : gb <= 0.5 ? 'klein' : gd < 0 ? 'weniger' : 'mehr' }; }
      return [grow];
    }
    var rows = [], za = lz && hasNum(lz.zaKonto) ? +lz.zaKonto : 0, so = lz && hasNum(lz.sonder) ? +lz.sonder : 0;
    AB_ZEILEN.forEach(function (z) {
      var v = lz && lz[z.key], has = hasNum(v);
      if (z.info) { // reine Eingabezeile, nur sichtbar wenn eingetragen oder "alle Zeilen"
        if (has || alle) rows.push({ key: z.key, label: z.label, app: null, lz: has ? +v : null, diff: null, status: 'info' });
        return;
      }
      if (fix && !alle && !has && ['lohn', 'feiertag', 'urlaub', 'krank', 'pflege'].indexOf(z.key) >= 0) return;
      var app = r2(z.hole(summe) || 0);
      var eingetragenOhneApp = has && +v > 0 && app === 0;
      if ((!z.pflicht || (z.key === 'dStd' && app === 0)) && !alle && app === 0 && !eingetragenOhneApp) return; // Zeile nur zeigen, wenn sie vorkommt
      if (z.nurAlle && !alle && !(has && +v > 0)) return; // Euro-Zeile nur auf Wunsch oder wenn eingetragen
      if (!has) { rows.push({ key: z.key, label: z.label, unit: z.unit, app: app, lz: null, diff: null, status: 'offen', faktor: z.faktor }); return; }
      var lzWert = +v + (z.key === 'ueber' ? za : 0) + (z.key === 'lohn' ? so : 0); // Überstunden + Zeitausgleich-Konto, Lohn + Sonderurlaub
      var diff = r2(lzWert - app), a = Math.abs(diff);
      rows.push({ key: z.key, label: z.label, unit: z.unit, app: app, lz: +v, lzGesamt: lzWert, diff: diff, faktor: z.faktor,
        status: a < 0.005 ? 'gleich' : a <= 0.5 ? 'klein' : diff < 0 ? 'weniger' : 'mehr' });
    });
    // Prämien: Betrag in Euro gegen die Zeile auf dem Lohnzettel (Toleranz 50 Cent wegen Rundung)
    ((summe && summe.praemienDef) || []).forEach(function (p) {
      var key = 'pr_' + p.id, v = lz && lz[key], has = hasNum(v), hit = ((summe.praemien) || []).filter(function (x) { return x.id === p.id; })[0];
      var app = r2(hit ? hit.euro : 0);
      if (!alle && app === 0 && !(has && +v > 0)) return;
      if (!has) { rows.push({ key: key, label: p.name, unit: '€', app: app, lz: null, diff: null, status: 'offen', faktor: 'euro' }); return; }
      var diff = r2(+v - app), a = Math.abs(diff);
      rows.push({ key: key, label: p.name, unit: '€', app: app, lz: +v, lzGesamt: +v, diff: diff, faktor: 'euro', status: a < 0.005 ? 'gleich' : a <= 0.5 ? 'klein' : diff < 0 ? 'weniger' : 'mehr' });
    });
    // Dienste: mit Betrag gegen die Zeile auf dem Lohnzettel, ohne Betrag nur als Hinweis, ob es eine Zeile dafür gibt
    var DE_NAME = { tag: 'Tage', stunde: 'Stunden', einsatz: 'Einsätze' };
    ((summe && summe.dienstDef) || []).forEach(function (p) {
      var key = 'ds_' + p.id, v = lz && lz[key], has = hasNum(v), hit = ((summe.dienste) || []).filter(function (x) { return x.id === p.id; })[0];
      var menge = hit ? hit.menge : 0, app = r2(hit ? hit.euro : 0);
      if (!alle && menge === 0 && !(has && +v > 0)) return;
      if (!p.betrag) { rows.push({ key: key, label: p.name + ' (' + String(menge).replace('.', ',') + ' ' + (DE_NAME[p.einheit] || '') + ' eingetragen)', unit: '€', app: null, lz: has ? +v : null, diff: null, status: 'info' }); return; }
      if (!has) { rows.push({ key: key, label: p.name, unit: '€', app: app, lz: null, diff: null, status: 'offen', faktor: 'euro' }); return; }
      var diff = r2(+v - app), a = Math.abs(diff);
      rows.push({ key: key, label: p.name, unit: '€', app: app, lz: +v, lzGesamt: +v, diff: diff, faktor: 'euro', status: a < 0.005 ? 'gleich' : a <= 0.5 ? 'klein' : diff < 0 ? 'weniger' : 'mehr' });
    });
    return rows;
  }


  // Zeilen für den Tagesbericht: Kunde von bis, Pause, danach derselbe Kunde ab Pausenende. Alte und neue Form der Kunden werden verstanden.
  function tagesZeilen(day) {
    day = day || {};
    var segs = [], pausen = (day.pausen || []).filter(function (p) { return p && p.von && p.bis; }).map(function (p) { return { von: p.von, bis: p.bis, used: false }; });
    (day.kunden || []).forEach(function (k) {
      var ts = k.taet && k.taet.length ? k.taet : [{ tat: k.tat || '', von: k.von || '', bis: k.bis || '' }];
      ts.forEach(function (t) { segs.push({ von: t.von || '', bis: t.bis || '', k: (k.name || '').trim(), t: t.tat || '' }); });
    });
    if (!segs.length && !(day.notiz && !day.kunden) && (day.von || day.bis)) segs.push({ von: '', bis: '', k: '', t: '' });
    if (!segs.length && day.notiz && !day.kunden) segs.push({ von: '', bis: '', k: String(day.notiz).trim(), t: '' });
    if (segs.length === 1 && !segs[0].von && !segs[0].bis) { segs[0].von = day.von || ''; segs[0].bis = day.bis || ''; }
    segs.sort(function (a, b) { return (a.von || '99:99').localeCompare(b.von || '99:99'); });
    var out = [];
    segs.forEach(function (sg) {
      var cur = sg.von, hat = sg.von && sg.bis;
      if (hat) {
        pausen.filter(function (p) { return !p.used && p.von >= sg.von && p.bis <= sg.bis; }).sort(function (a, b) { return a.von.localeCompare(b.von); }).forEach(function (p) {
          if (p.von > cur) out.push({ von: cur, bis: p.von, k: sg.k, t: sg.t });
          out.push({ von: p.von, bis: p.bis, k: '', t: 'Pause' }); p.used = true; cur = p.bis;
        });
        if (cur < sg.bis || cur === sg.von) out.push({ von: cur, bis: sg.bis, k: sg.k, t: sg.t });
      } else out.push({ von: sg.von, bis: sg.bis, k: sg.k, t: sg.t });
    });
    pausen.forEach(function (p) { if (!p.used) out.push({ von: p.von, bis: p.bis, k: '', t: 'Pause' }); });
    out.sort(function (a, b) { return (a.von || '99:99').localeCompare(b.von || '99:99'); });
    return out;
  }

  // Nachzahlungen und Korrekturen: Einträge auf einem späteren Lohnzettel, die zu einem früheren Monat gehören.
  // lzAlle = data.abgleich. Liefert die Lohnzettel-Werte von Monat key inklusive Nachzahlung (plus) und Rückverrechnung (minus).
  function korrEuroZeile(k) { return k === 'dEuro' || String(k).indexOf('pr_') === 0 || String(k).indexOf('ds_') === 0; }
  function lzMitKorr(lzAlle, key) {
    var lz = {}, base = (lzAlle && lzAlle[key]) || {}, nach = {};
    Object.keys(base).forEach(function (k) { lz[k] = base[k]; });
    Object.keys(lzAlle || {}).sort().forEach(function (zk) {
      ((lzAlle[zk] && lzAlle[zk].korr) || []).forEach(function (e) {
        if (!e || e.bezug !== key || (e.art !== 'nach' && e.art !== 'rueck') || !e.zeile || e.zeile === 'sonst' || !hasNum(e.wert)) return;
        var euro = korrEuroZeile(e.zeile);
        if ((euro ? '€' : 'h') !== (e.einheit || (euro ? '€' : 'h'))) return;
        var w = (e.art === 'rueck' ? -1 : 1) * +e.wert;
        lz[e.zeile] = r2((hasNum(lz[e.zeile]) ? +lz[e.zeile] : 0) + w);
        var n = nach[e.zeile] || (nach[e.zeile] = { sum: 0, n: 0 }); n.sum = r2(n.sum + w); n.n++;
      });
    });
    return { lz: lz, nach: nach };
  }
  // Stundenlohn aufgerollt: Unterschied je Stunde mal Stunden. Überstunden zählen mit Zuschlag.
  // monate: [{ monat, normalStd, ueberStd, alt, neu }], zuschlagPct (Standard 50)
  function aufrollSumme(monate, zuschlagPct) {
    var zus = zuschlagPct == null || isNaN(+zuschlagPct) ? 50 : +zuschlagPct, summe = 0, zeilen = [];
    (monate || []).forEach(function (m) {
      var d = r2((+m.neu || 0) - (+m.alt || 0)), n = +m.normalStd || 0, u = +m.ueberStd || 0;
      var e1 = r2(n * d), e2 = r2(u * d * (1 + zus / 100)), e = r2(e1 + e2);
      summe = r2(summe + e);
      zeilen.push({ monat: m.monat, delta: d, normalStd: n, ueberStd: u, normalEuro: e1, ueberEuro: e2, euro: e });
    });
    return { summe: summe, zeilen: zeilen, zuschlagPct: zus };
  }
  // Sonderzahlungen (13./14. Gehalt, Urlaubszuschuss, Weihnachtsgeld): Soll = Jahresbetrag mal Anteil des Jahres. Anteil: Eintritt im selben Jahr, sonst 1.
  function sonderAnteil(eintritt, jahr) {
    if (!eintritt || !/^\d{4}-\d{2}-\d{2}$/.test(eintritt)) return 1;
    var y = +eintritt.slice(0, 4), m = +eintritt.slice(5, 7), d = +eintritt.slice(8, 10);
    if (y < jahr) return 1; if (y > jahr) return 0;
    var rest = 12 - m + 1 - (d > 1 ? (d - 1) / daysInMonth(y, m) : 0);
    return Math.max(0, Math.min(1, Math.round(rest / 12 * 10000) / 10000));
  }
  function sonderSoll(betrag, anteil) { return hasNum(betrag) ? r2(+betrag * (anteil == null ? 1 : anteil)) : null; }

  // Wert der Unterschiede in Euro (brutto, grobe Schätzung). Positiv = dir fehlt Geld, negativ = zu viel bezahlt.
  // Braucht den Stundenlohn aus den Einstellungen. Überstunden zählen mit Zuschlag (Standard 50 %), Diäten mit dem Satz je Stunde.
  function abgleichEuro(rows, w) {
    var lohn = w && w.stundenlohn != null && !isNaN(+w.stundenlohn) ? +w.stundenlohn : null;
    var zus = w && w.ueberstunden && w.ueberstunden.zuschlagPct != null ? +w.ueberstunden.zuschlagPct : 50;
    // Überstunden-Grundlohn laut Kollektivvertrag: Monatsgehalt durch den Teiler des KV (zum Beispiel 1/143), bei Teilzeit auf Vollzeit hochgerechnet.
    var lohnUeber = lohn;
    if (w && w.ueberstunden && +w.ueberstunden.ueberTeiler > 0 && +w.monatslohn > 0) {
      var wo = wochenStd(w.ueberstunden), vz = +w.ueberstunden.vollzeitStd > wo ? +w.ueberstunden.vollzeitStd : wo;
      lohnUeber = Math.round(+w.monatslohn / (+w.ueberstunden.ueberTeiler * (wo > 0 ? wo / vz : 1)) * 10000) / 10000;
    }
    var out = { ok: true, fehltStundenlohn: false, summe: 0, zeilen: {} };
    rows.forEach(function (r) {
      if (r.key === 'gleit' || r.status === 'info' || r.status === 'offen' || r.status === 'gleich' || r.diff === null) return;
      var f = r.faktor, eur = null;
      if (f === 'euro') eur = -r.diff;
      else if (f === 'diaeten') { if (w && w.diaeten && w.diaeten.modell === 'stunde' && w.diaeten.satz) eur = -r.diff * w.diaeten.satz; }
      else if (lohn === null) { out.fehltStundenlohn = true; return; }
      else eur = -r.diff * (f === 'ueber' ? lohnUeber : lohn) * (f === 'ueber' ? 1 + zus / 100 : f === 'mehr' ? 1 + (w && w.ueberstunden && w.ueberstunden.mehrPct != null ? +w.ueberstunden.mehrPct : 25) / 100 : f);
      if (eur === null) return;
      eur = Math.round(eur * 100) / 100; out.zeilen[r.key] = eur; out.summe = Math.round((out.summe + eur) * 100) / 100;
    });
    return out;
  }

  return {
    abgleich: abgleich, abgleichEuro: abgleichEuro, tagesZeilen: tagesZeilen, lzMitKorr: lzMitKorr, aufrollSumme: aufrollSumme, sonderAnteil: sonderAnteil, sonderSoll: sonderSoll, korrEuroZeile: korrEuroZeile, urlaubKartei: urlaubKartei, PAKETE: PAKETE, STATUS: STATUS, BUAK_KONTINGENT: BUAK_KONTINGENT,
    iso: iso, parseISO: parseISO, weekday: weekday, addDays: addDays, daysInMonth: daysInMonth, toMin: toMin,
    rundZeit: rundZeit, easter: easter, setRegion: setRegion, BUNDESLAENDER: BUNDESLAENDER, feiertage: feiertage, feiertagName: feiertagName, dayTyp: dayTyp,
    neuerWertesatz: neuerWertesatz, freiModus: freiModus, BERUFE: BERUFE, berufName: berufName, LOHNGRUPPEN: LOHNGRUPPEN, istTour: istTour, istBau: istBau, bausteine: bausteine, wertAt: wertAt, dayMinutes: dayMinutes, kundenZeiten: kundenZeiten, praemienDay: praemienDay, calcDay: calcDay,
    wochenStd: wochenStd, tagesSoll: tagesSoll, sollTage: sollTage, istSollTag: istSollTag, calcMonth: calcMonth, sollFuer: sollFuer, swVerbraucht: swVerbraucht, buakStart: buakStart, h2: h2, r2: r2, clone: clone
  };
});
