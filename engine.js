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
        zuschlag: { art: 'kv', sa: 0, so: 0, ft: 0 },
        schlechtwetter: false
      }
    },
    bau: {
      name: 'Bau (Baugewerbe/Bauindustrie, Maschinist, Bagger)',
      hinweis: 'KV Baugewerbe und Bauindustrie, Arbeiter, ab 1.5.2026 (Quelle: wko.at): 39-Stunden-Woche, die 40. Stunde ist Mehrarbeit (50 %, zählt nicht zu den Überstunden). Überstunde ist jede Stunde über 9 Stunden am Tag und jede Stunde über einer Stunde Mehrarbeit in der Woche. Zuschlag 50 %, von 20 bis 5 Uhr 100 %, Sonntag 100 %, Feiertagsarbeit 50 % (100 %, wenn an dem Tag sonst nicht gearbeitet wird), mehr als 16 Stunden am Stück 150 %. Es gilt immer nur der höchste Zuschlag. Taggeld pro Tag mit Stufen, Schlechtwetter über die BUAK. Kurze und lange Woche: Viele Betriebe arbeiten abwechselnd lange Wochen (bis 43 Stunden, bei Durchrechnung 43 bis 45) und kurze Wochen (35 bis 36 Stunden), im Schnitt 39. Die Stunden über 39 sind dann Zeitguthaben und keine Überstunden. Das rechnet die App noch nicht: In langen Wochen kann sie deshalb Überstunden anzeigen, die nach deiner Wochenverteilung Zeitguthaben sind. Frag in deinem Büro nach dem Arbeitszeitmodell. Lehrlinge: Stufen VI a bis VI e der Lohntafel (Hochbau, Tiefbau, Beton); Zimmerer haben einen eigenen Kollektivvertrag (Holzbau).',
      pruefen: true,
      werte: {
        diaeten: { modell: 'tag', satz: 0, maxStd: null, minStd: 0, vorschlag: 'anwesenheit',
          stufen: [{ ab: 3, satz: 12.85 }, { ab: 9, satz: 20.70 }] },
        ueberstunden: { modell: 'bau', wochenStd: 39, tagesGrenze: 9, zuschlagPct: 50 },
        stundenlohn: null,
        betriebFrei: 'urlaub',
        zuschlag: { art: 'kv', sa: 0, so: 100, ft: 50 },
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
        zuschlag: { art: 'kv', sa: 0, so: 0, ft: 0 },
        schlechtwetter: false
      }
    },
    handel: {
      name: 'Handel (Angestellte)',
      hinweis: 'KV Handel, Angestellte, ab 1.1.2026 (Quellen: gpa.at und wko.at): 38,5 Stunden/Woche ohne Pausen. Grundstunde = 1/158 des Bruttomonatsgehalts (Arbeiter: 1/167). Überstunden: 50 %; 70 % bei erweiterten Öffnungszeiten (Mo bis Fr 18:30 bis 20 Uhr, Sa 13 bis 18 Uhr); 100 % von 20 bis 6 Uhr sowie an Sonn- und Feiertagen. Arbeit an Sonn- und Feiertagen zählt immer als Überstunde. Zeitausgleich statt Bezahlung: 1:1,5 bei 50 %, 1:1,7 bei 70 %, 1:2 bei 100 %; bei 1:1 bleibt der Zuschlag. Mehrarbeit: 1,5 Stunden pro Woche bis zur alten 40-Stunden-Grenze, zuschlagsfrei und nicht auf die Überstunden angerechnet. Die App rechnet Überstunden mit einem einheitlichen Zuschlag und kann 50 %, 70 % und 100 % je Uhrzeit nicht trennen. Vergleiche deshalb am Lohnzettel die Zeilen „Überstunden 50 %“, „70 %“ und „100 %“ einzeln. Weil die Überstunden von der Einteilung der Firma abhängen, gilt hier die Monatsrechnung als Vorschlag.',
      pruefen: true,
      werte: {
        diaeten: { modell: 'aus', satz: 0, maxStd: null, minStd: 0, vorschlag: 'anwesenheit', stufen: [] },
        ueberstunden: { modell: 'monat', wochenStd: 38.5, tagesGrenze: null, zuschlagPct: 50 },
        stundenlohn: null,
        betriebFrei: 'urlaub',
        zuschlag: { art: 'kv', sa: 0, so: 100, ft: 100 },
        schlechtwetter: false
      }
    },
    handel_arb: {
      name: 'Handel (Arbeiter)',
      hinweis: 'KV Handel, Arbeiter/innen, ab 1.1.2026 (Quelle: wko.at): 38,5 Stunden/Woche. Der Stundenlohn ist der Monatslohn geteilt durch 167. Überstunden: 50 %; 70 % bei erweiterten Öffnungszeiten (Mo bis Fr 18:30 bis 20 Uhr, Sa 13 bis 18 Uhr); 100 % von 20 bis 6 Uhr sowie an Sonn- und Feiertagen. Die Lohnstufe richtet sich nach der Zeit im Betrieb (bis 1 Jahr, bis 10, bis 17, über 17 Jahre). Bitte trage Zulagen (Nacht, Kälte, Vorarbeiter) und Sonderzahlungen laut deinem Lohnzettel ein. Bei Abweichungen gilt dein Dienstvertrag.',
      pruefen: true,
      werte: {
        diaeten: { modell: 'aus', satz: 0, maxStd: null, minStd: 0, vorschlag: 'anwesenheit', stufen: [] },
        ueberstunden: { modell: 'monat', wochenStd: 38.5, tagesGrenze: null, zuschlagPct: 50 },
        stundenlohn: null,
        betriebFrei: 'urlaub',
        zuschlag: { art: 'kv', sa: 0, so: 100, ft: 100 },
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
        zuschlag: { art: 'kv', sa: 0, so: 0, ft: 0 },
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
        zuschlag: { art: 'kv', sa: 0, so: 100, ft: 100 },
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
        zuschlag: { art: 'kv', sa: 0, so: 0, ft: 0 },
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
        zuschlag: { art: 'kv', sa: 0, so: 0, ft: 0 },
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
        zuschlag: { art: 'kv', sa: 0, so: 100, ft: 100 },
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
        zuschlag: { art: 'kv', sa: 0, so: 100, ft: 100 },
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
        zuschlag: { art: 'kv', sa: 0, so: 0, ft: 0 },
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
        zuschlag: { art: 'kv', sa: 0, so: 100, ft: 100 },
        schlechtwetter: false
      }
    },
    metall_ang: {
      name: 'Metallgewerbe (Angestellte)',
      hinweis: 'KV Metallgewerbe, Angestellte, Gehaltsordnung 2026/2027 (Quelle: wko.at): Mindestgrundgehälter der Verwendungsgruppen I bis V und der Meistergruppe nach Verwendungsgruppenjahren, die Gehälter ab 1.1.2027 sind mit Datum hinterlegt, dazu die Lehrlingseinkommen. Auch die Sonderverläufe (Verwendungsgruppe IV für Meister, Obermeister, Verwendungsgruppe VI) sind hinterlegt. Arbeitszeit, Überstundenzuschläge und Teiler stehen nicht in der Gehaltsordnung: die Werte hier (38,5 Stunden, Überstunden 50 %, Sonn- und Feiertag 100 %) sind nur ein Vorschlag, bitte laut Dienstzettel prüfen. Sondervergütung Nachtarbeit 2,71 € je Stunde (ab 2027: 2,76 €): lege sie bei Bedarf als Prämie an.',
      pruefen: true,
      werte: {
        diaeten: { modell: 'aus', satz: 0, maxStd: null, minStd: 0, vorschlag: 'anwesenheit', stufen: [] },
        ueberstunden: { modell: 'monat', wochenStd: 38.5, tagesGrenze: null, zuschlagPct: 50 },
        stundenlohn: null,
        betriebFrei: 'urlaub',
        zuschlag: { art: 'kv', sa: 0, so: 100, ft: 100 },
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
        zuschlag: { art: 'kv', sa: 0, so: 100, ft: 100 },
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
        zuschlag: { art: 'kv', sa: 0, so: 100, ft: 100 },
        schlechtwetter: false
      }
    },
    holzbau: {
      name: 'Holzbau (Zimmerer, Dachstuhl)',
      hinweis: 'KV Holzbau-Meistergewerbe (Zimmerer), Arbeiter, ab 1.5.2026 (Quelle: wko.at): 39 Stunden/Woche, mit Zeitausgleich in ganzen Tagen auf 40 Stunden ausdehnbar oder bis 45 Stunden in 26 von 52 Wochen (höchstens 156 Zeitguthaben-Stunden). Überstunde ist jede Stunde über 9 Stunden pro Tag oder über der ersten Mehrarbeitsstunde pro Woche. Zuschläge: Überstunden von 5 bis 20 Uhr und Mehrarbeit 50 %, Überstunden von 20 bis 5 Uhr 100 %, Normalstunden von 20 bis 5 Uhr 50 %, Sonntag 100 %, Feiertag 50 % (100 % an einem sonst freien Tag), über 16 Stunden am Stück 150 %; bei mehreren Zuschlägen zählt nur der höchste. Taggeld 12,10 € je Arbeitstag (mehr als 3 Stunden, tägliche Heimkehr), 30 € bei notwendiger Übernachtung (ab 100 km), Übernachtungsgeld 17,53 € ohne Quartier vom Betrieb. Zulagen: Aufsicht 10 %, Schmutz 10 %, Abbruch 15 %, angeseilt 10 %, Gebirge 12 % oder 20 % (höchstens zwei Zulagen gleichzeitig). Lehrlingsentschädigung je Stunde als Lohngruppe hinterlegt. Schlechtwetter über die BUAK.',
      pruefen: true,
      werte: {
        diaeten: { modell: 'tag', satz: 0, maxStd: null, minStd: 0, vorschlag: 'anwesenheit', stufen: [{ ab: 3, satz: 12.10 }] },
        ueberstunden: { modell: 'bau', wochenStd: 39, tagesGrenze: 9, zuschlagPct: 50 },
        stundenlohn: null,
        betriebFrei: 'urlaub',
        zuschlag: { art: 'kv', sa: 0, so: 100, ft: 50 },
        schlechtwetter: true
      }
    },
    dachdecker: {
      name: 'Dachdecker',
      hinweis: 'KV Dachdecker, Arbeiter, ab 1.5.2026 (Quelle: wko.at): 39 Stunden/Woche, im Winter (November bis März) auf bis zu 32 Stunden verkürzbar, höchstens 9 Stunden pro Tag. Überstunden 50 %, am Sonntag und von 20 bis 5 Uhr 100 %, Feiertag: Feiertagsentgelt plus Bezahlung der geleisteten Arbeit, Überstunden am Feiertag 100 %, am Samstag kein eigener Zuschlag. Taggeld 8,30 € je Arbeitstag (mehr als 3 Stunden, tägliche Heimkehr), Trennungsgeld 30 € je Kalendertag, Lenkzeitvergütung 15,42 € je Stunde. Gefahren- und Schmutzzulagen sind je Bundesland verschieden (zum Beispiel Turm- und Fahrstuhlarbeiten 30 bis 40 %, Schneearbeiten 15 %): lege sie bei Bedarf als Prämie an. Die Löhne gelten für alle Bundesländer außer Kärnten, dort sind sie niedriger: gib dann deinen Stundenlohn selbst ein. Schlechtwetter über die BUAK.',
      pruefen: true,
      werte: {
        diaeten: { modell: 'tag', satz: 0, maxStd: null, minStd: 0, vorschlag: 'anwesenheit', stufen: [{ ab: 3, satz: 8.30 }] },
        ueberstunden: { modell: 'bau', wochenStd: 39, tagesGrenze: 9, zuschlagPct: 50 },
        stundenlohn: null,
        betriebFrei: 'urlaub',
        zuschlag: { art: 'kv', sa: 0, so: 100, ft: 0 },
        schlechtwetter: true
      }
    },
    pflasterer: {
      name: 'Pflasterer',
      hinweis: 'KV Pflasterergewerbe, Arbeiter, ab 1.5.2026 (Quelle: wko.at): 39 Stunden/Woche, höchstens 10 Stunden pro Tag, im Winter (Dezember bis Februar) verkürzbar, aber nicht unter 32 Stunden. Überstunden 50 %, am Sonntag und von 20 bis 5 Uhr 100 %, über 16 Stunden am Stück 150 %, Feiertag: Feiertagsentgelt plus Bezahlung der geleisteten Arbeit, am Samstag kein eigener Zuschlag. Taggeld 15,10 € je Arbeitstag mit mehr als 3 Stunden und 20,40 € bei mehr als 8 Stunden, 30 € bei auswärtiger Übernachtung, Übernachtungsgeld 17,55 € je Kalendertag, Lenkzeitvergütung 15,42 € je Stunde. Akkord mindestens 30 % über dem Stundenlohn. Schlechtwetter über die BUAK.',
      pruefen: true,
      werte: {
        diaeten: { modell: 'tag', satz: 0, maxStd: null, minStd: 0, vorschlag: 'anwesenheit', stufen: [{ ab: 3, satz: 15.10 }, { ab: 8, satz: 20.40 }] },
        ueberstunden: { modell: 'bau', wochenStd: 39, tagesGrenze: 10, zuschlagPct: 50 },
        stundenlohn: null,
        betriebFrei: 'urlaub',
        zuschlag: { art: 'kv', sa: 0, so: 100, ft: 0 },
        schlechtwetter: true
      }
    },
    fliesenleger: {
      name: 'Fliesenleger / Hafner / Plattenleger',
      hinweis: 'KV Hafner, Platten- und Fliesenleger, Arbeiter, ab 1.5.2026 (Quelle: wko.at): 39 Stunden/Woche, mit Zeitausgleich bis 40 Stunden, höchstens 9 Stunden pro Tag. Überstunden werktags 50 %, nachts (22 bis 6 Uhr) und am Sonntag 100 %, am Samstag kein eigener Zuschlag, Arbeit am Feiertag ohne Zuschlag, Überstunden am Feiertag 100 %. Taggeld 8,30 € je Arbeitstag (mehr als 3 Stunden, tägliche Heimkehr), 30 € bei auswärtiger Arbeit, Nächtigungsgeld 12 € je Nacht, Lenkzeitvergütung 15,31 € je Stunde. Helfer beim Akkord-Fliesenleger bekommen in Oberösterreich, Wien und der Steiermark einen Zuschlag (18 %, in der Steiermark 13 %). Keramiker haben eigene Löhne: gib dann deinen Stundenlohn selbst ein.',
      pruefen: true,
      werte: {
        diaeten: { modell: 'tag', satz: 0, maxStd: null, minStd: 0, vorschlag: 'anwesenheit', stufen: [{ ab: 3, satz: 8.30 }] },
        ueberstunden: { modell: 'bau', wochenStd: 39, tagesGrenze: 9, zuschlagPct: 50 },
        stundenlohn: null,
        betriebFrei: 'urlaub',
        zuschlag: { art: 'kv', sa: 0, so: 100, ft: 0 },
        schlechtwetter: false
      }
    },
    tischler: {
      name: 'Tischler und Holzgestalter (Gewerbe)',
      hinweis: 'KV Tischler und Holzgestalter, Arbeiter, Löhne ab 1.5.2026 (Quelle: wko.at): 40 Stunden/Woche, meist auf 5 Tage, mit Bandbreite 35 bis 45 Stunden im Durchschnitt von 52 Wochen (höchstens 9 Stunden pro Tag, bis 130 Zeitguthaben-Stunden ohne Zuschlag). Überstunden von 6 bis 20 Uhr 50 %, von 20 bis 6 Uhr 100 %, Sonntag 100 %. Am Feiertag wird das Entgelt weiterbezahlt, gearbeitete Stunden gibt es ohne Zuschlag, Stunden über die Normalarbeitszeit des Tages 100 %. Zeitausgleich für Überstunden 1:1,5. Der 24. und 31. Dezember sind frei bei vollem Lohn. Taggeld bei Außerhausarbeit über 5 Stunden 2,50 € je angefangener Stunde, bei auswärtiger Nächtigung 39 €, Nächtigungsgeld 15 € ohne Quartier: lege sie bei Bedarf als Prämie an. Löhne und Lehrlingseinkommen sind als Lohngruppe hinterlegt.',
      pruefen: true,
      werte: {
        diaeten: { modell: 'aus', satz: 0, maxStd: null, minStd: 0, vorschlag: 'anwesenheit', stufen: [] },
        ueberstunden: { modell: 'monat', wochenStd: 40, tagesGrenze: null, zuschlagPct: 50 },
        stundenlohn: null,
        betriebFrei: 'urlaub',
        zuschlag: { art: 'kv', sa: 0, so: 100, ft: 0 },
        schlechtwetter: false
      }
    },
    maler: {
      name: 'Maler, Lackierer und Schilderhersteller',
      hinweis: 'KV Maler, Lackierer und Schilderhersteller, Arbeiter, ab 1.5.2026 (Quelle: wko.at): 39 Stunden/Woche, höchstens 9 Stunden pro Tag, Überstunden 50 %, nachts (20 bis 6 Uhr) und Sonntag 100 %. Schmutz- und Erschwerniszulagen 10 % oder 20 % des Stundenlohns (zum Beispiel ab 4 m Standhöhe oder Dächer ab 20° Neigung), Taggeld 30 € bei auswärtiger Arbeit, 8,30 € je Arbeitstag auf Baustellen mit täglicher Heimkehr. Bei Wetterausfall 60 % des Lohns. Die Berufsschule zählt als Arbeitszeit.',
      pruefen: true,
      werte: {
        diaeten: { modell: 'tag', satz: 0, maxStd: null, minStd: 0, vorschlag: 'anwesenheit', stufen: [{ ab: 3, satz: 8.30 }] },
        ueberstunden: { modell: 'monat', wochenStd: 39, tagesGrenze: null, zuschlagPct: 50 },
        stundenlohn: null,
        betriebFrei: 'urlaub',
        zuschlag: { art: 'kv', sa: 0, so: 100, ft: 0 },
        schlechtwetter: false
      }
    },
    metall: {
      name: 'Metallgewerbe / Mechaniker',
      hinweis: 'KV Eisen- und metallverarbeitendes Gewerbe (Metallgewerbe), Arbeiter, ab 1.1.2026 (Quellen: wko.at, k3-blatt.at): 38,5 Stunden/Woche ohne Pausen, Mehrarbeit 50 %, Überstunden 50 %, zwischen 20 und 6 Uhr 100 %, Sonntag 100 %, am Samstag kein eigener Zuschlag. Zeitausgleich 1:1,5 bei 50 %, 1:2 bei 100 %, Mehrarbeit 1:1,25. Nachtarbeitszulage (22 bis 6 Uhr, nicht für Überstunden) 3,348 € je Stunde, Schichtzulage 2. Schicht 1,065 €, 3. Schicht 3,348 €, Schmutz-, Erschwernis- und Gefahrenzulage je 0,746 € je Stunde, Vorarbeiterzulage 10 %. Feiertagsarbeit: laut Quelle 100 % nur am Werktag, der als Sonntag gilt, sonst gelten die gesetzlichen Bestimmungen. Arbeit am 24. und 31. Dezember nach 12 Uhr 100 %. Ob dein Betrieb darunter fällt (zum Beispiel Kfz-Werkstatt, Elektro, Installation, Spengler), steht auf deinem Lohnzettel. Die Mindestgrundlöhne und Lehrlingseinkommen 2026 sind als Lohngruppe hinterlegt. Montagezulage mindestens 1,155 € je Stunde (nicht für Lehrlinge), Entfernungszulage 11,94 € bei mehr als 6 Stunden, 30,00 € bei mehr als 11 Stunden und 62,04 € mit Nächtigung, Nächtigungsgeld 22,05 €: lege sie bei Bedarf als Prämie an.',
      pruefen: true,
      werte: {
        diaeten: { modell: 'aus', satz: 0, maxStd: null, minStd: 0, vorschlag: 'anwesenheit', stufen: [] },
        ueberstunden: { modell: 'monat', wochenStd: 38.5, tagesGrenze: null, zuschlagPct: 50 },
        stundenlohn: null,
        betriebFrei: 'urlaub',
        zuschlag: { art: 'kv', sa: 0, so: 100, ft: 0 },
        schlechtwetter: false
      }
    },
    gastro: {
      name: 'Hotel- und Gastgewerbe, Niederösterreich',
      hinweis: 'KV Hotel- und Gastgewerbe, Arbeiter, Lohnordnung des Bundeslandes ab 1.10.2026 (Quelle: wko.at): 40 Stunden/Woche, Überstunden 50 %, Normalstunde = 1/173 des Monatslohns. Die Löhne sind je Bundesland verschieden: wähle den Kollektivvertrag deines Bundeslandes. Nachtarbeitszuschlag 9,50 € je begonnenem Zeitfenster (0 bis 2, 2 bis 4 und 4 bis 6 Uhr), bei Arbeitsbeginn ab 5 Uhr 4,75 €, ab 5:30 Uhr keiner; Fremdsprachenzulage 40 € im Monat: bitte als Prämie eintragen. Für Beschäftigte mit mindestens 20 Dienstjahren am 30.4.2025 gibt es eine Übergangsregelung mit eigenen Stufen, die hier nicht hinterlegt ist. Sonn- und Feiertage hängen vom Betrieb ab, stelle sie bei Bedarf selbst ein.',
      pruefen: true,
      werte: {
        diaeten: { modell: 'aus', satz: 0, maxStd: null, minStd: 0, vorschlag: 'anwesenheit', stufen: [] },
        ueberstunden: { modell: 'monat', wochenStd: 40, tagesGrenze: null, zuschlagPct: 50 },
        stundenlohn: null,
        betriebFrei: 'urlaub',
        zuschlag: { art: 'kv', sa: 0, so: 0, ft: 0 },
        schlechtwetter: false
      }
    },
    reinigung: {
      name: 'Gebäudereinigung (Denkmal-, Fassaden- und Gebäudereinigung)',
      hinweis: 'KV Denkmal-, Fassaden- und Gebäudereinigung, Arbeiter, ab 1.1.2026 (Quelle: wko.at): 40 Stunden/Woche ohne Pausen, Überstunden 50 % (Montag bis Samstag 6 bis 21 Uhr), in der Nacht (21 bis 6 Uhr) 100 %, Sonntag 150 %, am Feiertag 100 %. Normalstunden in der Nacht 50 %, am Sonntag 100 %, am Feiertag ohne Zuschlag. Mehrarbeit bei Teilzeit 25 %. Wegzeiten im Dienst zählen als Arbeitszeit. Zehrgeld 11,71 € je Tag (außerhalb der Gemeinde, mindestens 6 Stunden), Trennungszulage 19,67 €, gefährliche Arbeiten 10 %: lege sie bei Bedarf als Prämie an. Lehrlingseinkommen 2026 als Lohngruppe hinterlegt. In der Hotelreinigung (Lohngruppe 3) gelten am Sonntag andere Zuschläge, bitte laut Lohnzettel prüfen.',
      pruefen: true,
      werte: {
        diaeten: { modell: 'aus', satz: 0, maxStd: null, minStd: 0, vorschlag: 'anwesenheit', stufen: [] },
        ueberstunden: { modell: 'monat', wochenStd: 40, tagesGrenze: null, zuschlagPct: 50 },
        stundenlohn: null,
        betriebFrei: 'urlaub',
        zuschlag: { art: 'kv', sa: 0, so: 100, ft: 0 },
        schlechtwetter: false
      }
    },
    baecker: {
      name: 'Bäckergewerbe (Arbeiter)',
      hinweis: 'KV Bäckergewerbe, Arbeiter, ab 1.10.2026 (Quelle: wko.at): 40 Stunden/Woche, der Stundenlohn ist der Monatslohn geteilt durch 167. Überstunden werktags 50 %, nachts 100 %. Für Bäckereiarbeiter nach dem Bäckereiarbeiter/innengesetz gilt als Nacht 20 bis 4 Uhr: Überstunden 125 %, von 4 bis 6 Uhr 100 %. Normalstunden in der Nacht 50 % (22 bis 6 Uhr), nach dem Bäckereiarbeiter/innengesetz 75 % (20 bis 4 Uhr) und 50 % (4 bis 6 Uhr). Sonntag: die ersten 8 Stunden 100 %, weitere Stunden und Sonntagsnacht 150 %. Feiertag 100 % (Nacht 150 %, Überstunden 200 %), dazu der ungekürzte Monatslohn. Mehrere Zuschläge: es gilt nur der höchste. Samstag endet die Normalarbeitszeit um 12 Uhr. Erschwerniszulage Tiefkühlanlage 32,90 € je Woche und Taggeld Kraftfahrer 15,79 €: lege sie bei Bedarf als Prämie an. Die App rechnet Überstunden mit 50 % und Sonntag und Feiertag mit 100 %, die Nachtzuschläge bitte laut Lohnzettel prüfen.',
      pruefen: true,
      werte: {
        diaeten: { modell: 'aus', satz: 0, maxStd: null, minStd: 0, vorschlag: 'anwesenheit', stufen: [] },
        ueberstunden: { modell: 'monat', wochenStd: 40, tagesGrenze: null, zuschlagPct: 50 },
        stundenlohn: null,
        betriebFrei: 'urlaub',
        zuschlag: { art: 'kv', sa: 0, so: 100, ft: 100 },
        schlechtwetter: false
      }
    },
    konditor: {
      name: 'Konditorgewerbe (Arbeiter), Niederösterreich',
      hinweis: 'KV Konditoren, Arbeiter, Lohnordnung des Bundeslandes ab 2026 (Quelle: wko.at). Arbeitszeit und Zuschläge laut Rahmen-KV: 38,5 Stunden/Woche, Überstunden werktags 50 %, von 4 bis 6 Uhr 100 %, von 20 bis 4 Uhr 125 %. Normalstunden in der Nacht 50 % (20 bis 22 und 4 bis 6 Uhr) und 75 % (22 bis 4 Uhr). Sonntag: die ersten 8 Stunden 100 %, weitere Stunden und 4 bis 6 Uhr 150 %, Nacht 175 %. Feiertag 100 % (Nacht 150 % bzw. 175 %, Überstunden 200 %), dazu der ungekürzte Lohn. Mehrere Zuschläge: es gilt nur der höchste. Samstag endet die Normalarbeitszeit mit der Ladenschlusszeit. Der Stundenlohn ist der Monatslohn geteilt durch 167 (Salzburg: Monatslohn durch 4,33 und durch 38,5). In Kärnten steht der Teiler nicht in der Lohnordnung, die App nimmt 167. Für Tirol ist der Lohnvertrag ab 1.11.2025 der letzte, den ich gefunden habe, bitte vergleiche mit deinem Lohnzettel. Zulagen wie die Tiefkühlzulage und der Meisterzuschlag stehen in der Lohnordnung deines Bundeslandes: lege sie bei Bedarf als Prämie an. Die App rechnet Überstunden mit 50 % und Sonntag und Feiertag mit 100 %, die Nachtzuschläge bitte laut Lohnzettel prüfen.',
      pruefen: true,
      werte: {
        diaeten: { modell: 'aus', satz: 0, maxStd: null, minStd: 0, vorschlag: 'anwesenheit', stufen: [] },
        ueberstunden: { modell: 'monat', wochenStd: 38.5, tagesGrenze: null, zuschlagPct: 50 },
        stundenlohn: null,
        betriebFrei: 'urlaub',
        zuschlag: { art: 'kv', sa: 0, so: 100, ft: 100 },
        schlechtwetter: false
      }
    },
    friseur: {
      name: 'Friseurgewerbe (Arbeiter)',
      hinweis: 'KV Friseure, Arbeiter, Lohnordnung ab 1.4.2026 (Quelle: wko.at): Monatslöhne, für Teilzeit wird der Monatslohn durch 173 geteilt. 40 Stunden/Woche. Überstunden 50 %, Sonntag 100 %, Überstunden am Feiertag 100 % (so steht es im zuletzt gefundenen KV-Text, bitte laut Lohnzettel prüfen). Haararbeiten-Zulage 2,31 € je Stunde, Salonleiter 15 %, Ausbilder 10 %, Friseurmeister 10 % vom Lohn der Lohngruppe 5: lege sie bei Bedarf als Prämie an.',
      pruefen: true,
      werte: {
        diaeten: { modell: 'aus', satz: 0, maxStd: null, minStd: 0, vorschlag: 'anwesenheit', stufen: [] },
        ueberstunden: { modell: 'monat', wochenStd: 40, tagesGrenze: null, zuschlagPct: 50 },
        stundenlohn: null,
        betriebFrei: 'urlaub',
        zuschlag: { art: 'kv', sa: 0, so: 100, ft: 0 },
        schlechtwetter: false
      }
    },
    bewachung: {
      name: 'Bewachung / Sicherheitsdienst (Wachorgane)',
      hinweis: 'KV Wachorgane im Bewachungsgewerbe, Arbeiter, ab 1.1.2026 (Quelle: wko.at): Vollzeit mindestens 40 Stunden/Woche an 4 oder 5 Tagen, Durchrechnung ab 40 Stunden bis 60 Stunden in einer Woche mit Zeitausgleich 1:1. Stunden über dem Monatslimit, über 12 Stunden am Tag oder 60 Stunden in der Woche 50 %, Arbeit am wöchentlichen Ruhetag 100 %. Nachtzulage 1,26 € je Stunde, Erschwerniszulage Revierdienst 0,80 € je Stunde, Diensthund 18,74 € je Schicht: lege sie bei Bedarf als Prämie an. Zuschläge für Sonn- und Feiertage konnte ich in der Quelle nicht belegen, bitte laut Lohnzettel einstellen. Stundenlöhne je Verwendungsgruppe als Lohngruppe hinterlegt.',
      pruefen: true,
      werte: {
        diaeten: { modell: 'aus', satz: 0, maxStd: null, minStd: 0, vorschlag: 'anwesenheit', stufen: [] },
        ueberstunden: { modell: 'monat', wochenStd: 40, tagesGrenze: null, zuschlagPct: 50 },
        stundenlohn: null,
        betriebFrei: 'urlaub',
        zuschlag: { art: 'kv', sa: 0, so: 0, ft: 0 },
        schlechtwetter: false
      }
    },
    sozial: {
      name: 'Sozialwirtschaft Österreich (Pflege, Betreuung, Soziales)',
      hinweis: 'SWÖ-KV (Sozialwirtschaft Österreich), Stand 1.4.2026 (Quelle: gpa.at): 37 Stunden/Woche, 8 Stunden/Tag, Überstunden 50 % (100 % nachts von 22 bis 6 Uhr und an Sonn- und Feiertagen), statt Geld ist Zeitausgleich möglich. Mehrstunden bei Teilzeit 33,3 %. Grundstundenlohn = Monatsgehalt geteilt durch 160,21. Nachtarbeit 9,45 € je Stunde, Rufbereitschaft 4,37 € je Stunde, Flexibilisierungszuschlag 51,30 € je Tag: lege sie bei Bedarf als Prämie an. Krankenhäuser und Pflegeheime der Länder und Gemeinden haben oft eigene Kollektivverträge: dann nimm „Eigene Werte“. Sonn- und Feiertagsarbeit: 50 % Zuschlag, mehrere Zuschläge zählen nur einmal. Lehrlingseinkommen der Pflegelehre ab 1.4.2026 (Quelle: vida.at, Abschlussprotokoll): 966,30 / 1.228,20 / 1.460,40 / 1.909,20 € im 1. bis 4. Lehrjahr.',
      pruefen: true,
      werte: {
        diaeten: { modell: 'aus', satz: 0, maxStd: null, minStd: 0, vorschlag: 'anwesenheit', stufen: [] },
        ueberstunden: { modell: 'monat', wochenStd: 37, tagesGrenze: null, zuschlagPct: 50, ueberTeiler: 160.21 },
        stundenlohn: null,
        betriebFrei: 'urlaub',
        zuschlag: { art: 'kv', sa: 0, so: 50, ft: 50 },
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
        zuschlag: { art: 'kv', sa: 0, so: 0, ft: 0 },
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
      stundenlohn: null, betriebFrei: 'urlaub', zuschlag: { art: 'kv', sa: 0, so: 0, ft: 0 }, schlechtwetter: false
    };
    for (var k in o) w[k] = o[k];
    return w;
  }
  var DE_VERPFL = { modell: 'tag', satz: 0, maxStd: null, minStd: 0, vorschlag: 'anwesenheit', stufen: [{ ab: 8, satz: 14 }, { ab: 23.99, satz: 28 }] };
  PAKETE.de_spedition = {
    name: 'Deutschland: Spedition und Logistik, Berlin (Kraftfahrer)', land: 'DE', pruefen: true,
    hinweis: 'Tarif Spedition und Logistik Berlin, gewerbliche Arbeitnehmer (Quelle: Tarifbroschüre des Landes Berlin, Entgelt ab 1.2.2026, mindestens bis 31.12.2026): 38 Stunden/Woche (Brandenburg 39). Monatsentgelt je Gruppe und Dauer, für Zuschläge gilt Monatsentgelt ÷ 165. Überstunden 25 % (von 22 bis 6 Uhr 60 %), Nachtarbeit außerhalb von Schichtarbeit 50 %, Sonntag 70 %, Feiertag 120 %, 24. und 31.12. ab 12 Uhr 70 %; beim Zusammentreffen zählt nur der höchste Zuschlag. Wichtig: Dieser Tarif gilt nicht für Fahrer im Güterfernverkehr, dafür gibt es eigene Verträge (in Brandenburg zuletzt 12,65 € Berufskraftfahrer und 12,30 € Kraftfahrer je Stunde, Stand 10.2022, vermutlich überholt): trage dann deinen Lohn selbst ein. Verpflegung: 14 € bei mehr als 8 Stunden, 28 € bei 24 Stunden unterwegs, dazu 9 € je Nacht im Lkw (selbst eintragen). Gilt nur, wenn dein Betrieb tarifgebunden ist. Bitte vergleiche alles mit deiner Abrechnung.',
    werte: deWerte({ diaeten: DE_VERPFL, ueberstunden: { modell: 'monat', wochenStd: 38, tagesGrenze: null, zuschlagPct: 25 }, zuschlag: { art: 'kv', sa: 0, so: 70, ft: 120 } })
  };
  // Tarifregister Nordrhein-Westfalen (Speditions-, Logistik- und Transportwirtschaft): Lohntarif ab 1.10.2026, Manteltarif Stand 29.4.2024
  var NRW_VERPFL = { modell: 'tag', satz: 0, maxStd: null, minStd: 0, vorschlag: 'anwesenheit', stufen: [{ ab: 8, satz: 12 }, { ab: 23.99, satz: 24 }] };
  PAKETE.de_spedition_nrw = {
    name: 'Deutschland: Spedition und Logistik, Nordrhein-Westfalen (Kraftfahrer)', land: 'DE', pruefen: true,
    hinweis: 'Tarif Speditions-, Logistik- und Transportwirtschaft Nordrhein-Westfalen (Quelle: Tarifregister NRW, Lohntarif ab 1.10.2026, kündbar zum 28.2.2027): Kraftfahrer 40 Stunden/Woche (39 bei Fahrten unter 100 km Luftlinie vom Standort). Mehrarbeit 25 % für jede Stunde über 40 pro Woche. Nachtarbeit (22 bis 6 Uhr) 25 %; Fernfahrer (über 100 km) bekommen stattdessen 5 € je Nachtschicht mit mehr als 2 Stunden Arbeit. Sonntag 75 % (ab 1.1.2026), Feiertag 100 % (ab 1.1.2027 125 %), beim Zusammentreffen zählt nur der höhere Zuschlag, Nacht kommt dazu. Warte- und Anwesenheitszeiten zählen 100 %, Kabinen- und Beifahrerzeit 70 %. Verpflegung laut Tarif 12 € bei mehr als 8 Stunden, 24 € bei 24 Stunden Abwesenheit. Weihnachtsgeld ein Monatsverdienst, Urlaubsgeld und Zulagen je Betrieb: lege sie als Prämie an. Die Nachtzuschläge sind nicht hinterlegt: lege sie als Prämie an. Von den Stundenlöhnen sind die unterste und die oberste Stufe hinterlegt: trage bei Zwischenstufen deinen Lohn laut Lohnzettel ein. Gilt nur, wenn dein Betrieb tarifgebunden ist. Bitte vergleiche alles mit deiner Abrechnung.',
    werte: deWerte({ diaeten: NRW_VERPFL, ueberstunden: { modell: 'monat', wochenStd: 40, tagesGrenze: null, zuschlagPct: 25 }, zuschlag: { art: 'kv', sa: 0, so: 75, ft: 100 } })
  };

  // Bayern: ver.di Bayern und Landesverein Bayerischer Spediteure, Lohntarif ab 1.1.2026 (läuft bis 30.11.2026). Zuschläge des Manteltarifs nicht belegt: Überstunden 25 % und 40 Stunden nur angenommen.
  PAKETE.de_spedition_by = {
    name: 'Deutschland: Spedition und Logistik, Bayern (Kraftfahrer)', land: 'DE', pruefen: true,
    hinweis: 'Tarif Speditions- und Logistikgewerbe Bayern, gewerbliche Arbeitnehmer (Quellen: ver.di Bayern, Landesverein Bayerischer Spediteure): Stundenlöhne ab 1.1.2026 (plus 3,5 %). Der Lohntarif läuft bis 30.11.2026, danach wird neu verhandelt (ver.di fordert 230 € mehr ab 1.12.2026): Nach einem Abschluss musst du den Lohn selbst anpassen. Dazu gibt es eine Betriebszugehörigkeitszulage von 80, 100 oder 110 € im Monat, je nach Dauer im Betrieb: lege sie als Prämie an. Die Zuschläge laut Manteltarif konnte ich nicht belegen: Überstunden 25 % und 40 Stunden/Woche sind nur angenommen, Nacht-, Sonn- und Feiertagszuschläge stehen bei 0: trage sie nach deinem Arbeitsvertrag oder Lohnzettel ein. Verpflegung: 14 € bei mehr als 8 Stunden, 28 € bei 24 Stunden unterwegs, dazu 9 € je Nacht im Lkw (selbst eintragen). Gilt nur, wenn dein Betrieb tarifgebunden ist. Für Fahrer im Fernverkehr gibt es oft eigene Regeln. Bitte vergleiche alles mit deiner Abrechnung.',
    werte: deWerte({ diaeten: DE_VERPFL, ueberstunden: { modell: 'monat', wochenStd: 40, tagesGrenze: null, zuschlagPct: 25 }, zuschlag: { art: 'kv', sa: 0, so: 0, ft: 0 } })
  };
  // Sachsen: ZEFAS Sachsen, Lohntarif Verkehrsgewerbe Logistikunternehmen (gültig ab 1.10.2025). Zuschläge nicht im Auszug.
  PAKETE.de_logistik_sn = {
    name: 'Deutschland: Logistikunternehmen, Sachsen (Kraftfahrer)', land: 'DE', pruefen: true,
    hinweis: 'Lohntarif für das Verkehrsgewerbe Sachsen, Bereich Logistikunternehmen (Quelle: Tarifdaten der ZEFAS Sachsen, Stand Dezember 2025): Stundenlöhne ab 1.11.2026. Am 1.7.2027 steigen sie um knapp 3 %, dann musst du den Lohn selbst anpassen. Der Auszug nennt nur die Entgeltgruppen 2 und 3: in Gruppe 2 fahren Kraftfahrer im Shuttle- oder Nahverkehr, in Gruppe 3 Kraftfahrer mit höheren Anforderungen (Fernverkehr, ADR) und Berufskraftfahrer. Regelarbeitszeit sind 173 Stunden im Monat, ich rechne mit 40 Stunden pro Woche. Zuschläge (Überstunden, Nacht, Sonn- und Feiertag) stehen nicht im Auszug und sind auf 0: trage sie nach deinem Arbeitsvertrag oder Lohnzettel ein. Lehrlinge bekommen 37, 42 und 47 % des Ecklohns, die Beträge habe ich daraus berechnet. Verpflegung: 14 € bei mehr als 8 Stunden, 28 € bei 24 Stunden (Steuerrecht, nicht Tarif). Gilt nur, wenn dein Betrieb tarifgebunden ist. Bitte vergleiche alles mit deiner Abrechnung.',
    werte: deWerte({ diaeten: DE_VERPFL, ueberstunden: { modell: 'monat', wochenStd: 40, tagesGrenze: null, zuschlagPct: 25 }, zuschlag: { art: 'kv', sa: 0, so: 0, ft: 0 } })
  };
  // Andere Bundesländer: kein öffentlicher Lohntarif gefunden, Lohn selbst eintragen.
  PAKETE.de_spedition_sonst = {
    name: 'Deutschland: Spedition und Logistik, anderes Bundesland (Lohn selbst eintragen)', land: 'DE', pruefen: true,
    hinweis: 'Für dein Bundesland habe ich keinen öffentlich nachlesbaren Lohntarif gefunden, die Tabellen gibt es oft nur für Mitglieder der Verbände. Trage deinen Stundenlohn und die Zuschläge aus Arbeitsvertrag oder Lohnzettel selbst ein. Bekannte Erhöhungen laut ver.di: Baden-Württemberg (Württemberg und Nordbaden): plus 2,5 % ab 1.5.2026, mindestens 100 € im Monat, und plus 2 % ab 1.5.2027. Thüringen: plus 3,7 % ab 1.1.2026, plus 3,4 % ab 1.10.2026, plus 2,9 % ab 1.6.2027. Sachsen-Anhalt: plus 3,7 % ab Dezember 2025, plus 3,4 % ab September 2026, plus 2,9 % ab Juni 2027. Schleswig-Holstein: zweimal plus 3,5 %. Niedersachsen: Abschluss im Oktober 2025, Zahlen nur für Mitglieder. Für Bayern, Sachsen, Berlin und Nordrhein-Westfalen gibt es eigene Tarife in der Liste. Verpflegung: 14 € bei mehr als 8 Stunden, 28 € bei 24 Stunden (Steuerrecht). 40 Stunden pro Woche und 25 % Überstundenzuschlag sind nur angenommen. Bitte vergleiche alles mit deiner Abrechnung.',
    werte: deWerte({ diaeten: DE_VERPFL, ueberstunden: { modell: 'monat', wochenStd: 40, tagesGrenze: null, zuschlagPct: 25 }, zuschlag: { art: 'kv', sa: 0, so: 0, ft: 0 } })
  };
  PAKETE.de_bau = {
    name: 'Deutschland: Bauhauptgewerbe (Baumaschinenführer, Bau)', land: 'DE', pruefen: true,
    hinweis: 'Bundesweiter Tarif für das Bauhauptgewerbe, Löhne ab 1.4.2026 (Gesamttarifstundenlohn): Lohngruppe 2 (Maschinenführer) 18,73 €, Lohngruppe 4 (Baumaschinenführer) 26,05 € je Stunde. Zuschläge laut einer Auskunft zum Tarif: Überstunden 25 %, Nacht 20 %, Sonntag 75 %, Feiertag 200 %. Wochenarbeitszeit 40 Stunden angenommen, bitte prüfen. Schlechtwetter läuft in Deutschland nicht über die BUAK, sondern über Saison-Kurzarbeitergeld; das ist hier nicht abgebildet. Verpflegungspauschale: 14 € bei mehr als 8 Stunden unterwegs, 28 € bei 24 Stunden.',
    werte: deWerte({ diaeten: DE_VERPFL, ueberstunden: { modell: 'monat', wochenStd: 40, tagesGrenze: null, zuschlagPct: 25 }, zuschlag: { art: 'kv', sa: 0, so: 75, ft: 200 } })
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
  // Zeitausgleich-Konto: Wie viele Überstunden stecken in einem Zuwachs? Bei 1:1,5 (Zuschlag im Zeitausgleich enthalten) sind es 2/3 davon. Abzüge (Freinehmen) zählen immer Stunde für Stunde.
  function zaUeber(za, umr) { za = +za || 0; return (za > 0 && umr === 'eingerechnet') ? r2(za / 1.5) : za; }
  function freiModus(day, w) { if (w && w.kvFrei) return 'bezahlt'; var m = (day && day.fv) || (w && w.freiVerr) || 'offen'; return ['bezahlt', 'za', 'unbezahlt', 'offen'].indexOf(m) >= 0 ? m : 'offen'; }
  var UNBEZAHLT_FREI = ['frei', 'mutterschutz', 'karenz', 'papamonat']; // kein Lohn von der Firma, keine Sollstunden
  // Status eines Tages. credit = Tag wird mit den Sollstunden gutgeschrieben (bezahlte Abwesenheit).
  var STATUS = {
    arbeit:        { name: 'Arbeit',                  credit: false },
    urlaub:        { name: 'Urlaub',                  credit: true },
    sonderurlaub:  { name: 'Sonderurlaub',            credit: true },
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
  var STUFEN_HANDEL_ARB = ['bis 1 Jahr im Betrieb', 'bis 10 Jahre', 'bis 17 Jahre', 'über 17 Jahre'];
  var STUFEN_HANDEL = ['Berufsjahr 1 bis 3', 'Berufsjahr 4 bis 6', 'Berufsjahr 7 bis 9', 'Berufsjahr 10 bis 12', 'ab Berufsjahr 13'];
  var LOHNGRUPPEN = {
    gueter: { stand: 'ab 1.1.2026', stufen: STUFEN_AT, eintritt: true, gruppen: [
      { id: '1', name: 'Gruppe 1: Hilfsarbeiter, Garage, Mitfahrer, Lkw bis 3,5 t, Stapler', l: [12.34, 12.63, 12.96, 13.27, 13.60] },
      { id: '2', name: 'Gruppe 2: Lkw über 3,5 t, bis 3 Achsen', l: [12.59, 12.92, 13.23, 13.63, 13.94] },
      { id: '3', name: 'Gruppe 3: Lkw über 3,5 t, mehr als 3 Achsen', l: [12.78, 13.07, 13.44, 13.79, 14.12] },
      { id: '4', name: 'Gruppe 4: Zug, Sattelzug, selbstfahrende Arbeitsmaschine, Partieführer', l: [12.92, 13.23, 13.63, 13.94, 14.27] },
      { id: '5a', name: 'Gruppe 5a: Gefahrgut-Einsatztage oder Kran ab 10 Metertonnen', l: [13.23, 13.63, 13.94, 14.27, 14.58] },
      { id: '6.1', name: 'Gruppe 6.1: Berufskraftfahrer (Lehre), Lkw bis 3 Achsen', lehrling: true, nur: ['lkw', 'klein'], l: [12.92, 13.23, 13.63, 13.94, 14.27] },
      { id: '6.2', name: 'Gruppe 6.2: Berufskraftfahrer (Lehre), Lkw mehr als 3 Achsen', lehrling: true, nur: ['lkw', 'klein'], l: [13.29, 13.56, 13.94, 14.29, 14.58] },
      { id: '6.3', name: 'Gruppe 6.3: Berufskraftfahrer (Lehre), Zug und Sattelzug', lehrling: true, nur: ['lkw', 'klein'], l: [13.63, 13.94, 14.27, 14.59, 14.92] },
      { id: '7', name: 'Gruppe 7: Tankstellenbelieferung (Treibstoff, Heizöl)', l: [13.94, 14.27, 14.60, 14.92, 15.22] }
    ] },
    de_spedition: { stand: 'ab 1.2.2026, Berlin', stufen: ['Einstieg', 'nach 2 Jahren', 'nach 4 Jahren'], teiler: 165, gruppen: [
      { id: 'B1', m: true, name: 'Gruppe 1: Handwerker', l: [2950.40, 3000.40, 3050.40] },
      { id: 'B2', m: true, name: 'Gruppe 2: Berufskraftfahrer mit dreijähriger Ausbildung', l: [2907.87, 2957.87, 3007.87] },
      { id: 'B3', m: true, name: 'Gruppe 3: Lkw über 7,5 t, Hallen- und Lagermeister, Schichtleiter', l: [2838.09, 2888.09, 2938.09] },
      { id: 'B4', m: true, name: 'Gruppe 4: Fahrer bis 7,5 t, Kurier, Stapler im Hochregallager', l: [2710.46, 2760.46, 2810.46] },
      { id: 'B5', m: true, name: 'Gruppe 5: Fachkraft Lagerlogistik, Verlade- und Lagerarbeiter', l: [2516.45, 2566.45, 2616.45] },
      { id: 'B6', m: true, name: 'Gruppe 6: Einfache Tätigkeiten nach Anweisung', l: [2397.34, 2447.34, 2497.34] }
    ] },
    de_spedition_nrw: { stand: 'ab 1.10.2026, Nordrhein-Westfalen', stufen: ['unterste Stufe (Einstieg)', 'oberste Stufe (längste Beschäftigung)'], gruppen: [
      { id: 'K1', name: 'Kraftfahrer ohne ausreichende Lkw-Fahrpraxis', l: [15.81, 17.03] },
      { id: 'K2', name: 'Kraftfahrer', l: [16.46, 17.69] },
      { id: 'K3', name: 'Kraftfahrer mit Berufskraftfahrer-Qualifikation', l: [16.92, 18.18] },
      { id: 'G1', name: 'Lohngruppe I (unterste), Lager und Hilfsarbeit', l: [15.71, 16.97] },
      { id: 'G3', name: 'Lohngruppe III (Einstieg nach Ausbildung)', l: [17.07, 18.34] },
      { id: 'G4', name: 'Lohngruppe IV (höchste)', l: [17.55, 18.85] },
      { id: 'A1', m: true, lehrling: true, nur: ['lkw', 'klein', 'lager'], name: 'Lehrling, 1. Lehrjahr', l: [1140] },
      { id: 'A2', m: true, lehrling: true, nur: ['lkw', 'klein', 'lager'], name: 'Lehrling, 2. Lehrjahr', l: [1240] },
      { id: 'A3', m: true, lehrling: true, nur: ['lkw', 'klein', 'lager'], name: 'Lehrling, 3. Lehrjahr', l: [1340] },
      { id: 'A4', m: true, lehrling: true, nur: ['lkw', 'klein'], name: 'Berufskraftfahrer-Lehrling, 3. Lehrjahr nach Erwerb der Klasse CE', l: [1490] }
    ] },
    de_spedition_by: { stand: 'ab 1.1.2026, Bayern', stufen: null, teiler: 167, gruppen: [
      { id: 'Y1', name: 'Lohngruppe 1 (nur in Einweisung)', l: [16.82] },
      { id: 'Y2', name: 'Lohngruppe 2 (zum Beispiel Verladekraft im Paketzentrum)', l: [17.28] },
      { id: 'Y3', name: 'Lohngruppe 3 (zum Beispiel Gabelstaplerfahrer)', l: [17.63] },
      { id: 'Y4', name: 'Lohngruppe 4 (Kraftfahrer)', l: [17.56] },
      { id: 'YA1', m: true, lehrling: true, nur: ['lkw', 'klein', 'lager'], name: 'Lehrling, 1. Lehrjahr', l: [1270] },
      { id: 'YA2', m: true, lehrling: true, nur: ['lkw', 'klein', 'lager'], name: 'Lehrling, 2. Lehrjahr', l: [1333] },
      { id: 'YA3', m: true, lehrling: true, nur: ['lkw', 'klein', 'lager'], name: 'Lehrling, 3. Lehrjahr', l: [1401] }
    ] },
    de_logistik_sn: { stand: 'ab 1.11.2026, Sachsen', stufen: ['ab dem 1. Jahr', 'ab dem 3. Jahr', 'ab dem 5. Jahr'], gruppen: [
      { id: 'S2', name: 'Entgeltgruppe 2: Kraftfahrer im Shuttle- oder Nahverkehr', l: [15.03, 15.37, 16.06] },
      { id: 'S3', name: 'Entgeltgruppe 3: Kraftfahrer mit höheren Anforderungen (Fernverkehr, ADR) und Berufskraftfahrer', l: [16.40, 17.08, 17.77] },
      { id: 'SA1', m: true, lehrling: true, nur: ['lkw', 'klein', 'lager'], name: 'Lehrling, 1. Lehrjahr', l: [1093.29] },
      { id: 'SA2', m: true, lehrling: true, nur: ['lkw', 'klein', 'lager'], name: 'Lehrling, 2. Lehrjahr', l: [1241.03] },
      { id: 'SA3', m: true, lehrling: true, nur: ['lkw', 'klein', 'lager'], name: 'Lehrling, 3. Lehrjahr', l: [1388.77] }
    ] },
    handel_arb: { stand: 'ab 1.1.2026', stufen: STUFEN_HANDEL_ARB, eintritt: true, schwellen: [1, 10, 17], gruppen: [
      { id: 'LG1', name: 'Lohngruppe 1 (einfache Tätigkeiten, Lohn ÷ 167)', l: [12.85, 12.88, 13.01, 13.14] },
      { id: 'LG2', name: 'Lohngruppe 2 (Lohn ÷ 167)', l: [13.04, 13.24, 13.45, 13.60] },
      { id: 'LG3', name: 'Lohngruppe 3 (Lohn ÷ 167)', l: [13.52, 13.64, 14.06, 14.25] },
      { id: 'LG4', name: 'Lohngruppe 4 (Lohn ÷ 167)', l: [13.90, 13.96, 14.50, 14.75] },
      { id: 'LG5', name: 'Lohngruppe 5 (Lohn ÷ 167)', l: [14.12, 14.22, 14.75, 15.01] },
      { id: 'L1', m: true, lehrling: true, name: 'Lehrling, 1. Lehrjahr', l: [1026] },
      { id: 'L2', m: true, lehrling: true, name: 'Lehrling, 2. Lehrjahr', l: [1200] },
      { id: 'L3', m: true, lehrling: true, name: 'Lehrling, 3. Lehrjahr', l: [1518] },
      { id: 'L4', m: true, lehrling: true, name: 'Lehrling, 4. Lehrjahr', l: [1580] }
    ] },
    handel: { stand: 'ab 1.1.2026', stufen: STUFEN_HANDEL, gruppen: [
      { id: 'A', name: 'Beschäftigungsgruppe A: Hilfstätigkeiten, z. B. Lagerhilfe (Angestellte, Gehalt ÷ 158)', l: [13.23, 13.56, 13.88, null, null] },
      { id: 'B', name: 'Beschäftigungsgruppe B: einfache Verkaufs- und Warentätigkeit, z. B. Regalbetreuer (Angestellte, Gehalt ÷ 158)', l: [13.65, 14.06, 14.46, null, null] },
      { id: 'C', name: 'Beschäftigungsgruppe C: Standardaufgaben, z. B. Verkauf und Kassa mit Lehre (Angestellte, Gehalt ÷ 158)', l: [14.25, 14.77, 15.52, 16.23, 17.01] },
      { id: 'D', name: 'Beschäftigungsgruppe D: eigenverantwortliche Aufgaben, z. B. Verkauf mit Zusatzaufgaben (Angestellte, Gehalt ÷ 158)', l: [14.95, 15.88, 16.94, 17.99, 19.06] },
      { id: 'E', name: 'Beschäftigungsgruppe E: Fachberatung und eingeschränkte Führung, z. B. Abteilungsleitung (Angestellte, Gehalt ÷ 158)', l: [16.04, 17.47, 18.90, 20.34, 21.75] },
      { id: 'F', name: 'Beschäftigungsgruppe F: Fach- und Führungsaufgaben, z. B. Filialleitung (Angestellte, Gehalt ÷ 158)', l: [18.22, 20.38, 22.53, 24.70, 26.86] },
      { id: 'G', name: 'Beschäftigungsgruppe G: Führung größerer Einheiten (Angestellte, Gehalt ÷ 158)', l: [22.53, 24.91, 27.30, 29.68, 32.06] },
      { id: 'H', name: 'Beschäftigungsgruppe H (Angestellte, Gehalt ÷ 158)', l: [27.72, 30.32, 32.93, 35.52, 38.11] },
      { id: 'L1', m: true, lehrling: true, name: 'Lehrling, 1. Lehrjahr', l: [1026] },
      { id: 'L2', m: true, lehrling: true, name: 'Lehrling, 2. Lehrjahr', l: [1200] },
      { id: 'L3', m: true, lehrling: true, name: 'Lehrling, 3. Lehrjahr', l: [1518] },
      { id: 'L4', m: true, lehrling: true, name: 'Lehrling, 4. Lehrjahr', l: [1580] }
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
      { id: 'IV', name: 'IV Bauhilfsarbeiter', l: [17.03] },
      { id: 'VIa', lehrling: true, name: 'VI a Lehrling Hochbau/Tiefbau/Beton, 1. Lehrjahr', l: [8.00] },
      { id: 'VIb', lehrling: true, name: 'VI b Lehrling, 2. Lehrjahr', l: [11.99] },
      { id: 'VIc', lehrling: true, name: 'VI c Lehrling, 3. Lehrjahr', l: [15.99] },
      { id: 'VId', lehrling: true, name: 'VI d Lehrling, 4. Lehrjahr', l: [17.99] },
      { id: 'VIe', lehrling: true, name: 'VI e Lehrling, Sonderstufe laut Lohntafel', l: [15.99] }
    ] },
    holzbau: { stand: 'ab 1.5.2026', stufen: null, gruppen: [
      { id: 'I', name: 'I Vizepolier', l: [21.94] },
      { id: 'II', name: 'II Vorarbeiter', l: [20.27] },
      { id: 'III', name: 'III Bundzimmerer, Zimmereitechniker mit Lehrabschlussprüfung', l: [19.50] },
      { id: 'IV', name: 'IV Zimmerer oder Facharbeiter mit Lehrabschlussprüfung', l: [18.92] },
      { id: 'V', name: 'V Zimmerer/Zimmereitechniker ohne Lehrabschlussprüfung, angelernt', l: [17.56] },
      { id: 'VI', name: 'VI Zimmererhelfer', l: [16.50] },
      { id: 'L1', lehrling: true, name: 'Lehrling, 1. Lehrjahr', l: [6.17] },
      { id: 'L2', lehrling: true, name: 'Lehrling, 2. Lehrjahr', l: [8.24] },
      { id: 'L3', lehrling: true, name: 'Lehrling, 3. Lehrjahr', l: [11.66] },
      { id: 'L4', lehrling: true, name: 'Lehrling, 4. Lehrjahr', l: [15.51] }
    ] },
    dachdecker: { stand: 'ab 1.5.2026', stufen: null, gruppen: [
      { id: 'I', name: 'I Facharbeiter mit Lehrabschlussprüfung, oder ohne ab dem 3. Jahr Praxis', l: [19.60] },
      { id: 'II', name: 'II Facharbeiter ohne Lehrabschlussprüfung in den ersten zwei Jahren nach der Lehre', l: [19.01] },
      { id: 'III', name: 'III Dachdeckerhelfer (Steiger)', l: [17.65] },
      { id: 'IV', name: 'IV Hilfsarbeiter', l: [16.08] },
      { id: 'L1', lehrling: true, name: 'Lehrling, 1. Lehrjahr', l: [7.50] },
      { id: 'L2', lehrling: true, name: 'Lehrling, 2. Lehrjahr', l: [9.50] },
      { id: 'L3', lehrling: true, name: 'Lehrling, 3. Lehrjahr', l: [11.20] },
      { id: 'L4', lehrling: true, name: 'Lehrling, 4. Lehrjahr', l: [12.90] }
    ] },
    pflasterer: { stand: 'ab 1.5.2026', stufen: null, gruppen: [
      { id: 'I', name: 'I Facharbeiter mit Lehrabschlussprüfung, oder ohne ab dem 3. Jahr Praxis', l: [21.01] },
      { id: 'II', name: 'II Facharbeiter ohne Lehrabschlussprüfung in den ersten zwei Jahren nach der Lehre', l: [19.32] },
      { id: 'III', name: 'III Maschinenführer mit Berechtigung', l: [18.18] },
      { id: 'IV', name: 'IV Pflastererhelfer', l: [17.99] },
      { id: 'V', name: 'V Hilfsarbeiter', l: [16.69] },
      { id: 'L1', lehrling: true, name: 'Lehrling, 1. Lehrjahr', l: [8.40] },
      { id: 'L2', lehrling: true, name: 'Lehrling, 2. Lehrjahr', l: [12.61] },
      { id: 'L3', lehrling: true, name: 'Lehrling, 3. Lehrjahr', l: [16.81] }
    ] },
    fliesenleger: { stand: 'ab 1.5.2026', stufen: null, gruppen: [
      { id: 'F3', name: 'Facharbeiter nach dem 2. Verwendungsjahr', l: [18.75] },
      { id: 'F2', name: 'Facharbeiter im 2. Verwendungsjahr', l: [17.82] },
      { id: 'F1', name: 'Facharbeiter im 1. Verwendungsjahr', l: [16.81] },
      { id: 'FQ', name: 'Qualifizierter Helfer', l: [15.96] },
      { id: 'FH', name: 'Helfer', l: [15.33] },
      { id: 'L1', lehrling: true, name: 'Lehrling, 1. Lehrjahr', l: [5.50] },
      { id: 'L2', lehrling: true, name: 'Lehrling, 2. Lehrjahr', l: [7.10] },
      { id: 'L3', lehrling: true, name: 'Lehrling, 3. Lehrjahr', l: [8.70] },
      { id: 'L4', lehrling: true, name: 'Lehrling, 4. Lehrjahr', l: [10.50] }
    ] },
    metall_ang: { stand: 'ab 1.1.2026', stufen: ['im 1. und 2. Jahr', 'nach 2 Jahren', 'nach 4 Jahren', 'nach 6 Jahren', 'nach 8 Jahren', 'nach 10 Jahren', 'nach 12 Jahren', 'nach 15 Jahren'], gruppen: [
      { id: 'GI', m: true, name: 'Verwendungsgruppe I', l: [1960.54, 2058.43, 2190.76, 2323.12, 2455.45, 2588.72, 2703.75, 2914.69] },
      { id: 'GII', m: true, name: 'Verwendungsgruppe II', l: [2199.15, 2350.62, 2502.07, 2655.45, 2809.08, 2962.72, 3094.32, 3335.74] },
      { id: 'GIII', m: true, name: 'Verwendungsgruppe III', l: [2727.40, 2918.34, 3109.21, 3300.16, 3491.06, 3682.00, 3845.61, 4145.62] },
      { id: 'GIV', m: true, name: 'Verwendungsgruppe IV', l: [3415.01, 3654.05, 3893.09, 4132.15, 4371.19, 4610.26, 4815.15, 5190.77] },
      { id: 'GV', m: true, name: 'Verwendungsgruppe V', l: [4299.70, 4594.04, 4888.37, 5182.71, 5477.00, 5771.34, 6023.65, 6486.15] },
      { id: 'GMG', m: true, name: 'Meistergruppe', l: [4130.76, 4130.76, 4303.13, 4475.48, 4647.84, 4820.17, 4992.53, 5270.29] },
      { id: 'GIVM', m: true, name: 'Verwendungsgruppe IV für Meister', stufen: ['im 1. bis 4. Jahr', 'nach 4 Jahren', 'nach 6 Jahren', 'nach 8 Jahren', 'nach 10 Jahren', 'nach 12 Jahren', 'nach 14 Jahren', 'nach 17 Jahren'], l: [3415.01, 3654.05, 3893.09, 4132.15, 4371.19, 4610.26, 4815.15, 5047.10] },
      { id: 'GVO', m: true, name: 'Verwendungsgruppe V: Obermeister', stufen: ['im 1. bis 6. Jahr', 'nach 6 Jahren', 'nach 8 Jahren', 'nach 10 Jahren', 'nach 12 Jahren'], l: [4299.70, 4594.04, 4888.37, 5182.71, 5477.00] },
      { id: 'GVI', m: true, name: 'Verwendungsgruppe VI', stufen: ['im 1. und 2. Jahr', 'nach 2 Jahren', 'nach 5 Jahren'], l: [6021.80, 6762.62, 7503.50] },
      { id: 'L1', m: true, lehrling: true, name: 'Lehrling, 1. Lehrjahr', l: [935.66] },
      { id: 'L2', m: true, lehrling: true, name: 'Lehrling, 2. Lehrjahr', l: [1097.97] },
      { id: 'L3', m: true, lehrling: true, name: 'Lehrling, 3. Lehrjahr', l: [1443.27] },
      { id: 'L4', m: true, lehrling: true, name: 'Lehrling, 4. Lehrjahr', l: [1948.23] }
    ], folgt: [{ ab: '2027-01-01', stand: 'ab 1.1.2027', gruppen: {
      GI: [1999.75, 2099.60, 2234.58, 2369.58, 2504.56, 2640.49, 2757.83, 2972.98],
      GII: [2243.13, 2397.63, 2552.11, 2708.56, 2865.26, 3021.97, 3156.21, 3402.45],
      GIII: [2781.95, 2976.71, 3171.39, 3366.16, 3560.88, 3755.64, 3922.52, 4228.53],
      GIV: [3483.31, 3727.13, 3970.95, 4214.79, 4458.61, 4702.47, 4911.45, 5294.59],
      GV: [4385.69, 4685.92, 4986.14, 5286.36, 5586.54, 5886.77, 6144.12, 6615.87],
      GMG: [4213.38, 4213.38, 4389.19, 4564.99, 4740.80, 4916.57, 5092.38, 5375.70],
      GIVM: [3483.31, 3727.13, 3970.95, 4214.79, 4458.61, 4702.47, 4911.45, 5148.04],
      GVO: [4385.69, 4685.92, 4986.14, 5286.36, 5586.54],
      GVI: [6142.24, 6897.87, 7653.57],
      L1: [954.37],
      L2: [1119.93],
      L3: [1472.14],
      L4: [1987.19] } }] },
    gewerbe_ang: { stand: 'ab 1.1.2026', stufen: null, gruppen: [
      { id: 'L1', m: true, lehrling: true, name: 'Lehrling, 1. Lehrjahr', l: [856.14] },
      { id: 'L2', m: true, lehrling: true, name: 'Lehrling, 2. Lehrjahr', l: [1080.87] },
      { id: 'L3', m: true, lehrling: true, name: 'Lehrling, 3. Lehrjahr', l: [1273.50] },
      { id: 'L4', m: true, lehrling: true, name: 'Lehrling, 4. Lehrjahr', l: [1690.87] }
    ] },
    banken_ang: { stand: 'ab 1.4.2026', stufen: null, gruppen: [
      { id: 'L1', m: true, lehrling: true, name: 'Lehrling, 1. Lehrjahr', l: [1168.68] },
      { id: 'L2', m: true, lehrling: true, name: 'Lehrling, 2. Lehrjahr', l: [1401.34] },
      { id: 'L3', m: true, lehrling: true, name: 'Lehrling, 3. Lehrjahr', l: [1635.41] }
    ] },
    gueter_ang: { stand: 'ab 1.1.2026', stufen: null, gruppen: [
      { id: 'L1', m: true, lehrling: true, name: 'Lehrling, 1. Lehrjahr', l: [907] },
      { id: 'L2', m: true, lehrling: true, name: 'Lehrling, 2. Lehrjahr', l: [1209] },
      { id: 'L3', m: true, lehrling: true, name: 'Lehrling, 3. Lehrjahr', l: [1512] }
    ] },
    bau_ang: { stand: 'ab 1.5.2026', stufen: null, gruppen: [
      { id: 'L1', m: true, lehrling: true, name: 'Lehrling, 1. Lehrjahr', l: [1064] },
      { id: 'L2', m: true, lehrling: true, name: 'Lehrling, 2. Lehrjahr', l: [1325] },
      { id: 'L3', m: true, lehrling: true, name: 'Lehrling, 3. Lehrjahr', l: [1645] },
      { id: 'L4', m: true, lehrling: true, name: 'Lehrling, 4. Lehrjahr', l: [1957] }
    ] },
    it_ang: { stand: 'ab 1.1.2026', stufen: null, gruppen: [
      { id: 'L1', m: true, lehrling: true, name: 'Lehrling, 1. Lehrjahr', l: [960] },
      { id: 'L2', m: true, lehrling: true, name: 'Lehrling, 2. Lehrjahr', l: [1210] },
      { id: 'L3', m: true, lehrling: true, name: 'Lehrling, 3. Lehrjahr', l: [1410] },
      { id: 'L4', m: true, lehrling: true, name: 'Lehrling, 4. Lehrjahr', l: [1750] }
    ] },
    tischler: { stand: 'ab 1.5.2026', stufen: null, gruppen: [
      { id: 'T1', name: 'Tischler I Spitzenfacharbeiter', l: [17.39] },
      { id: 'T2', name: 'Tischler II Qualifizierter Facharbeiter', l: [16.72] },
      { id: 'T3', name: 'Tischler III Facharbeiter mit Lehrabschlussprüfung Tischlereitechnik', l: [15.99] },
      { id: 'T4', name: 'Tischler IV Facharbeiter oder Professionist mit Lehrabschlussprüfung', l: [15.17] },
      { id: 'T5', name: 'Tischler V Facharbeiter ohne Lehrabschlussprüfung', l: [14.55] },
      { id: 'T6', name: 'Tischler VI Angelernte Tätigkeiten oder Kraftfahrer', l: [14.45] },
      { id: 'T7', name: 'Tischler VII Hilfsarbeiten', l: [14.14] },
      { id: 'H1', name: 'Holzgestalter I Spitzenfacharbeiter', l: [14.55] },
      { id: 'H2', name: 'Holzgestalter II Qualifizierter Facharbeiter', l: [13.98] },
      { id: 'H3', name: 'Holzgestalter III Facharbeiter mit Lehrabschlussprüfung', l: [12.66] },
      { id: 'H4', name: 'Holzgestalter IV Facharbeiter ohne Lehrabschlussprüfung, angelernt', l: [12.15] },
      { id: 'H5', name: 'Holzgestalter V Hilfsarbeiten', l: [12.09] },
      { id: 'LT1', m: true, lehrling: true, name: 'Lehrling Tischlereitechnik, 1. Lehrjahr', l: [921] },
      { id: 'LT2', m: true, lehrling: true, name: 'Lehrling Tischlereitechnik, 2. Lehrjahr', l: [1107] },
      { id: 'LT3', m: true, lehrling: true, name: 'Lehrling Tischlereitechnik, 3. Lehrjahr', l: [1666] },
      { id: 'LT4', m: true, lehrling: true, name: 'Lehrling Tischlereitechnik, 4. Lehrjahr', l: [2091] },
      { id: 'LH1', m: true, lehrling: true, name: 'Lehrling Holzgestalter, 1. Lehrjahr', l: [881] },
      { id: 'LH2', m: true, lehrling: true, name: 'Lehrling Holzgestalter, 2. Lehrjahr', l: [1077] },
      { id: 'LH3', m: true, lehrling: true, name: 'Lehrling Holzgestalter, 3. Lehrjahr', l: [1254] },
      { id: 'LH4', m: true, lehrling: true, name: 'Lehrling Holzgestalter, 4. Lehrjahr', l: [1369] }
    ] },
    maler: { stand: 'ab 1.5.2026', stufen: null, gruppen: [
      { id: 'M1', name: 'Facharbeiter mit Lehrabschlussprüfung, nach dem 3. Verwendungsjahr', l: [16.81] },
      { id: 'M2', name: 'Facharbeiter mit Lehrabschlussprüfung, ab dem 1. Verwendungsjahr', l: [15.30] },
      { id: 'M3', name: 'Qualifizierter Arbeitnehmer nach dem 3. Verwendungsjahr, oder Facharbeiter ohne Lehrabschlussprüfung', l: [15.12] },
      { id: 'M4', name: 'Qualifizierter Arbeitnehmer ab dem 1. Verwendungsjahr', l: [14.09] },
      { id: 'M5', name: 'Helfer', l: [13.53] },
      { id: 'L1', m: true, lehrling: true, name: 'Lehrling, 1. Lehrjahr', l: [910] },
      { id: 'L2', m: true, lehrling: true, name: 'Lehrling, 2. Lehrjahr', l: [1090] },
      { id: 'L3', m: true, lehrling: true, name: 'Lehrling, 3. Lehrjahr', l: [1370] },
      { id: 'L4', m: true, lehrling: true, name: 'Lehrling, 4. Lehrjahr', l: [1650] }
    ] },
    metall: { stand: 'ab 1.1.2026', stufen: null, gruppen: [
      { id: 'MT', m: true, name: 'Techniker', l: [4160.28] },
      { id: 'M1', m: true, name: 'Lohngruppe 1 Spitzenfacharbeiter', l: [3808.83] },
      { id: 'M2', m: true, name: 'Lohngruppe 2 Qualifizierter Facharbeiter', l: [3397.52] },
      { id: 'M3', m: true, name: 'Lohngruppe 3 Facharbeiter', l: [2948.85] },
      { id: 'M4', m: true, name: 'Lohngruppe 4 Besonders qualifizierter Arbeitnehmer', l: [2759.39] },
      { id: 'M5', m: true, name: 'Lohngruppe 5 Qualifizierter Arbeitnehmer', l: [2627.28] },
      { id: 'M6', m: true, name: 'Lohngruppe 6 Arbeitnehmer mit Zweckausbildung', l: [2571.94] },
      { id: 'M7', m: true, name: 'Lohngruppe 7 Arbeitnehmer ohne Zweckausbildung', l: [2571.94] },
      { id: 'L1', m: true, lehrling: true, name: 'Lehrling, 1. Lehrjahr', l: [1000.00] },
      { id: 'L2', m: true, lehrling: true, name: 'Lehrling, 2. Lehrjahr', l: [1148.75] },
      { id: 'L3', m: true, lehrling: true, name: 'Lehrling, 3. Lehrjahr', l: [1493.38] },
      { id: 'L4', m: true, lehrling: true, name: 'Lehrling, 4. Lehrjahr', l: [2000.00] }
    ], folgt: [{ ab: '2027-01-01', stand: 'ab 1.1.2027', gruppen: {
      MT: [4243.49], M1: [3885.01], M2: [3465.47], M3: [3007.83], M4: [2814.58], M5: [2679.83], M6: [2623.38], M7: [2623.38],
      L1: [1006.30], L2: [1171.73], L3: [1523.25], L4: [2037.20] } }] },
    reinigung: { stand: 'ab 1.1.2026', stufen: null, gruppen: [
      { id: 'LG1', name: 'LG 1 Facharbeiter mit Lehrabschluss Reinigungstechnik', l: [15.12] },
      { id: 'LG2', name: 'LG 2 Sonderreinigung, ohne Lehrabschluss, Chauffeur, Magazin', l: [13.30] },
      { id: 'LG3', name: 'LG 3 Hotelreinigung', l: [12.99] },
      { id: 'LG4', name: 'LG 4 Hausbetreuung, Wohnhausanlagen, Privathaushalte', l: [13.03] },
      { id: 'LG5', name: 'LG 5 Senioreneinrichtungen, Pflege- und Krankenanstalten, Labor', l: [12.73] },
      { id: 'LG6', name: 'LG 6 Ständige Unterhaltsreinigung, Botengänge, Küche', l: [12.37] },
      { id: 'L1', m: true, lehrling: true, name: 'Lehrling, 1. Lehrjahr', l: [1099.89] },
      { id: 'L2', m: true, lehrling: true, name: 'Lehrling, 2. Lehrjahr', l: [1361.77] },
      { id: 'L3', m: true, lehrling: true, name: 'Lehrling, 3. Lehrjahr', l: [1623.64] },
      { id: 'L4', m: true, lehrling: true, name: 'Lehrling, 4. Lehrjahr', l: [1885.52] }
    ] },
    baecker: { stand: 'ab 1.10.2026', stufen: null, teiler: 167, gruppen: [
      { id: 'P1', m: true, name: 'Produktion 1: Mischer/in, Ofenarbeiter/in', l: [2798.69] },
      { id: 'P2', m: true, name: 'Produktion 2: Vizemischer/in, Tafelarbeiter/in', l: [2547.90] },
      { id: 'P3', m: true, name: 'Produktion 3: Qualifizierte/r Arbeiter/in', l: [2295.77] },
      { id: 'P4', m: true, name: 'Produktion 4: Arbeiter/in nach der Lehrzeit (Behaltepflicht)', l: [2006.26] },
      { id: 'P5', m: true, name: 'Produktion 5: Sonstige Arbeitnehmer/innen', l: [2012.12] },
      { id: 'V6', m: true, name: 'Außerhalb der Produktion 6: Ladner/in nach dem 1. Dienstjahr', l: [2064.10] },
      { id: 'V7', m: true, name: 'Außerhalb der Produktion 7: Ladner/in im 1. Dienstjahr', l: [2006.38] },
      { id: 'V8', m: true, name: 'Außerhalb der Produktion 8: Sonstige Arbeitnehmer/innen', l: [2007.39] },
      { id: 'V9', m: true, name: 'Außerhalb der Produktion 9: Kraftfahrer/in', l: [2541.23] },
      { id: 'V10', m: true, name: 'Außerhalb der Produktion 10: Brot- und Gebäckausführer/in', l: [2295.77] },
      { id: 'L1', m: true, lehrling: true, name: 'Lehrling, 1. Lehrjahr', l: [708.85] },
      { id: 'L2', m: true, lehrling: true, name: 'Lehrling, 2. Lehrjahr', l: [888.93] },
      { id: 'L3', m: true, lehrling: true, name: 'Lehrling, 3. Lehrjahr', l: [1243.93] },
      { id: 'L4', m: true, lehrling: true, name: 'Lehrling, 4. Lehrjahr (Doppellehre Bäcker und Konditor)', l: [1357.12] }
    ] },
    konditor: { stand: 'ab 1.6.2026, Niederösterreich', stufen: null, teiler: 167, gruppen: [
      { id: 'K1', m: true, name: 'Lohngruppe 1: Abteilungsleitung oder Konditor/in mit Meisterprüfung', l: [2473.00] },
      { id: 'K2', m: true, name: 'Lohngruppe 2: Konditor/in nach dem 4. Gesellenjahr', l: [2460.00] },
      { id: 'K2a', m: true, name: 'Lohngruppe 2a: Konditor/in im 2. bis 4. Gesellenjahr', l: [2156.00] },
      { id: 'K2b', m: true, name: 'Lohngruppe 2b: Konditor/in im 1. Gesellenjahr', l: [1968.00] },
      { id: 'K2c', m: true, name: 'Lohngruppe 2c: Geselle/Gesellin während der Behaltepflicht', l: [1943.00] },
      { id: 'K3', m: true, name: 'Lohngruppe 3: Professionisten, Heizer, Kraftfahrer', l: [2174.00] },
      { id: 'K4', m: true, name: 'Lohngruppe 4: Qualifizierte Arbeiter/innen, Ausführer, Portiere, Wächter, Waffel- und Tütenbäcker/innen', l: [2020.00] },
      { id: 'K5', m: true, name: 'Lohngruppe 5: Arbeiter/innen bis 2 Jahre im Betrieb, Reinigungskräfte', l: [1943.00] },
      { id: 'K6', m: true, name: 'Lohngruppe 6: Arbeiter/innen bis 4 Monate im Betrieb', l: [1943.00] },
      { id: 'K7a', m: true, name: 'Lohngruppe 7a: Servierer/in und Ladner/in, 1. Praxisjahr', l: [1943.00] },
      { id: 'K7b', m: true, name: 'Lohngruppe 7b: Servierer/in und Ladner/in nach dem 1. Praxisjahr', l: [1943.00] },
      { id: 'L1', m: true, lehrling: true, name: 'Lehrling, 1. Lehrjahr', l: [603.00] },
      { id: 'L2', m: true, lehrling: true, name: 'Lehrling, 2. Lehrjahr', l: [804.00] },
      { id: 'L3', m: true, lehrling: true, name: 'Lehrling, 3. Lehrjahr', l: [1006.00] }
    ] },
    friseur: { stand: 'ab 1.4.2026', stufen: null, teiler: 173, gruppen: [
      { id: 'F1', m: true, name: 'Lohngruppe 1: Angelernte Arbeitnehmer/innen', l: [2020.00] },
      { id: 'F2', m: true, name: 'Lohngruppe 2: Friseur/in, 1. Jahr der Berufstätigkeit', l: [2071.00] },
      { id: 'F3', m: true, name: 'Lohngruppe 3: Friseur/in, 2. und 3. Jahr', l: [2087.00] },
      { id: 'F4', m: true, name: 'Lohngruppe 4: Friseur/in, 4. und 5. Jahr', l: [2133.00] },
      { id: 'F5', m: true, name: 'Lohngruppe 5: Friseur/in, ab dem 6. Jahr', l: [2287.00] },
      { id: 'L1', m: true, lehrling: true, name: 'Lehrling, 1. Lehrjahr', l: [804.00] },
      { id: 'L2', m: true, lehrling: true, name: 'Lehrling, 2. Lehrjahr', l: [921.00] },
      { id: 'L3', m: true, lehrling: true, name: 'Lehrling, 3. Lehrjahr', l: [1244.00] },
      { id: 'L4', m: true, lehrling: true, name: 'Lehrling, 4. Lehrjahr', l: [1350.00] }
    ] },
    bewachung: { stand: 'ab 1.1.2026', stufen: null, gruppen: [
      { id: 'A', name: 'A Wachdienst', l: [12.63] },
      { id: 'B', name: 'B Service- und Sicherheitsdienst', l: [13.87] },
      { id: 'B6', name: 'B 6 Museumsaufsichtsdienst', l: [12.63] },
      { id: 'C', name: 'C Sonderdienst', l: [15.46] },
      { id: 'D', name: 'D Mobiler Dienst', l: [13.95] },
      { id: 'E', name: 'E Veranstaltungssicherheit', l: [12.67] },
      { id: 'F', name: 'F Flughafensicherheitsdienst', l: [16.56] }
    ] },
    sozial: { stand: 'ab 1.4.2026', stufen: ['Dienstjahre 1–2', 'Dienstjahre 3–4', 'Dienstjahre 5–6', 'Dienstjahre 7–8', 'Dienstjahre 9–10', 'Dienstjahre 11–12', 'Dienstjahre 13–14', 'Dienstjahre 15–16', 'Dienstjahre 17–18', 'Dienstjahre 19–20', 'Dienstjahre 21–22', 'Dienstjahre 23–24', 'Dienstjahre 25–26', 'Dienstjahre 27–28', 'Dienstjahre 29–30', 'Dienstjahre 31–32', 'Dienstjahre 33–34', 'Dienstjahre 35–36'], teiler: 160.21, gruppen: [
      { id: 'VG1', m: true, name: 'VG 1', l: [2206.00, 2229.80, 2267.60, 2303.30, 2342.60, 2379.90, 2417.60, 2455.30, 2492.80, 2530.40, 2560.10, 2589.90, 2616.30, 2646.00, 2673.20, 2702.30, 2731.70, 2761.50] },
      { id: 'VG2', m: true, name: 'VG 2', l: [2286.20, 2325.20, 2364.50, 2403.70, 2445.90, 2485.00, 2524.20, 2563.30, 2602.30, 2644.60, 2673.20, 2702.30, 2734.90, 2765.20, 2801.80, 2833.50, 2867.20, 2900.50] },
      { id: 'VG3', m: true, name: 'VG 3', l: [2390.80, 2430.10, 2474.00, 2516.20, 2556.70, 2599.30, 2641.50, 2682.70, 2726.70, 2772.10, 2807.40, 2840.60, 2877.70, 2912.80, 2948.00, 2982.80, 3018.30, 3053.50] },
      { id: 'VG4', m: true, name: 'VG 4', l: [2494.30, 2539.80, 2603.90, 2649.70, 2692.40, 2739.80, 2787.70, 2835.60, 2886.30, 2935.60, 2982.80, 3034.20, 3069.40, 3106.20, 3143.20, 3181.80, 3217.00, 3255.70] },
      { id: 'VG5', m: true, name: 'VG 5 Pflegeassistenz', l: [2676.40, 2726.70, 2803.90, 2896.90, 2963.90, 3016.40, 3069.40, 3123.80, 3178.50, 3232.90, 3283.90, 3336.60, 3391.20, 3444.40, 3496.90, 3551.30, 3606.00, 3658.20] },
      { id: 'VG6', m: true, name: 'VG 6 Pflegefachassistenz', l: [2867.20, 2923.30, 3009.60, 3123.80, 3210.00, 3294.10, 3382.40, 3468.70, 3522.70, 3581.20, 3639.20, 3697.10, 3755.30, 3809.60, 3867.80, 3925.80, 3983.50, 4040.50] },
      { id: 'VG7', m: true, name: 'VG 7 Diplomierte Gesundheits- und Krankenpflege', l: [3074.80, 3138.00, 3231.10, 3352.60, 3444.40, 3538.90, 3630.30, 3721.90, 3813.10, 3904.50, 3966.30, 4027.60, 4089.40, 4151.10, 4212.40, 4272.10, 4334.00, 4396.90] },
      { id: 'VG8', m: true, name: 'VG 8', l: [3348.90, 3447.50, 3583.00, 3749.90, 3918.70, 4050.30, 4152.70, 4253.10, 4349.30, 4451.60, 4520.10, 4585.30, 4652.00, 4719.00, 4785.80, 4852.60, 4919.50, 4986.30] },
      { id: 'VG9', m: true, name: 'VG 9', l: [3886.80, 4041.70, 4237.00, 4469.40, 4703.20, 4898.20, 5053.20, 5169.10, 5285.30, 5403.10, 5519.40, 5637.30, 5714.30, 5792.00, 5871.20, 5946.60, 6024.20, 6101.30] },
      { id: 'L1', m: true, lehrling: true, name: 'Lehrling Pflege, 1. Lehrjahr', l: [966.30] },
      { id: 'L2', m: true, lehrling: true, name: 'Lehrling Pflege, 2. Lehrjahr', l: [1228.20] },
      { id: 'L3', m: true, lehrling: true, name: 'Lehrling Pflege, 3. Lehrjahr', l: [1460.40] },
      { id: 'L4', m: true, lehrling: true, name: 'Lehrling Pflege, 4. Lehrjahr', l: [1909.20] }
    ] },
    gastro: { stand: 'ab 1.10.2026, Niederösterreich', stufen: ['bis 5 Dienstjahre', 'ab dem 6. Dienstjahr', 'ab dem 11. Dienstjahr', 'ab dem 16. Dienstjahr', 'ab dem 21. Dienstjahr'], teiler: 173, gruppen: [
      { id: 'G1', m: true, name: 'Lohngruppe 1: Restaurant- oder Küchenchef/in, Abteilungsverantwortliche', l: [2724.00, 2792.10, 2860.20, 2928.30, 2996.40] },
      { id: 'G2', m: true, name: 'Lohngruppe 2: Stellvertretung, Chef de rang, Chef de partie, Barchef/in', l: [2500.00, 2562.50, 2625.00, 2687.50, 2750.00] },
      { id: 'G3', m: true, name: 'Lohngruppe 3: Facharbeiter/in (z. B. Koch/Köchin, Restaurantfachkraft)', l: [2304.00, 2361.60, 2419.20, 2476.80, 2534.40] },
      { id: 'G4', m: true, name: 'Lohngruppe 4: ohne Lehrabschluss nach voller Lehrzeit oder Hilfskraft mit mindestens 10 Jahren Branchenerfahrung', l: [2153.00, 2206.80, 2260.70, 2314.50, 2368.30] },
      { id: 'G5', m: true, name: 'Lohngruppe 5: Hilfskraft mit weniger als 10 Jahren Branchenerfahrung', stufen: ['bis 5 Dienstjahre', 'ab dem 6. Dienstjahr'], l: [2096.50, 2148.90] },
      { id: 'L1', m: true, lehrling: true, name: 'Lehrling, 1. Lehrjahr', l: [1090] },
      { id: 'L2', m: true, lehrling: true, name: 'Lehrling, 2. Lehrjahr', l: [1220] },
      { id: 'L3', m: true, lehrling: true, name: 'Lehrling, 3. Lehrjahr', l: [1445] },
      { id: 'L4', m: true, lehrling: true, name: 'Lehrling, 4. Lehrjahr oder Doppellehre', l: [1550] }
    ] }
  };

  // Österreichische Bundesländer und welcher Kollektivvertrag (Paket) zu welchem Bundesland gehört
  var LAENDER_AT = { w: 'Wien', noe: 'Niederösterreich', bgld: 'Burgenland', ooe: 'Oberösterreich', stmk: 'Steiermark', ktn: 'Kärnten', sbg: 'Salzburg', t: 'Tirol', vbg: 'Vorarlberg' };
  var KV_LAND_SUF = { w: 'w', wh: 'w', noe: 'noe', st: 'stmk', stmk: 'stmk', ooe: 'ooe', sbg: 'sbg', k: 'ktn', ktn: 'ktn', v: 'vbg', vbg: 'vbg', b: 'bgld', bgld: 'bgld', t: 't' };
  var KV_LAND_FIX = { taxi_t: ['t'], taxi_vbg: ['vbg'], taxi_sbg: ['sbg'], taxi_stmk: ['stmk'], textil_t: ['t'], textil_vbg: ['vbg'], textil: ['w', 'noe', 'bgld', 'ooe', 'sbg', 'stmk', 'ktn'], konditor: ['noe'], fleischer: ['noe'], gastro: ['noe'], gastro_ang_c: ['bgld', 'ktn', 'noe', 'ooe', 'stmk'], gastro_ang_d: ['sbg', 't', 'vbg'], gastro_ang_w: ['w'], gastro_ang_wh: ['w'] };
  function kvLand(paket) {
    paket = String(paket || ''); if (KV_LAND_FIX[paket]) return KV_LAND_FIX[paket];
    var m = /^(konditor|fleischer|ordination|rk|gastro|kino|rettung)_([a-z]+)$/.exec(paket); return m && KV_LAND_SUF[m[2]] ? [KV_LAND_SUF[m[2]]] : null;
  }
  /* ---------------------------------------------------------------- Berufe und Bausteine */
  // b = Voreinstellung, welche Bausteine der Beruf braucht (fahrzeug, kunden, praemien), diaeten = ob Diäten üblich sind.
  // Konditoren: Lohnordnungen der anderen Bundesländer (Quelle: wko.at, Arbeiter/innen), Zuschläge und Arbeitszeit wie in Niederösterreich
  var KONDITOR_BL = {"w": {"n": "Wien", "s": "ab 1.4.2026", "t": 167, "l": [621.57, 832.51, 1043.46], "g": [["W1a", "Lohngruppe 1a: Konditor/in, ab dem 5. Gesellenjahr", 2577.41], ["W1b", "Lohngruppe 1b: Konditor/in, bis zum 4. Gesellenjahr", 2207.74], ["W1c", "Lohngruppe 1c: Konditor/in, bis zum 2. Gesellenjahr", 2001.92], ["W2", "Lohngruppe 2: Professionisten und Kraftfahrer/innen", 2207.74], ["W3", "Lohngruppe 3: Qualifizierte Arbeiter/innen", 2001.92], ["W4", "Lohngruppe 4: Arbeiter/innen, bis zu 3 Jahren im Betrieb", 1910.78], ["W5a", "Lohngruppe 5a: Servierer/in und Ladner/in, im 1. Jahr der Praxis", 1849.34], ["W5b", "Lohngruppe 5b: Servierer/in und Ladner/in, nach dem 1. Jahr der Praxis", 1910.78]]}, "st": {"n": "Steiermark", "s": "ab 1.7.2026", "t": 167, "l": [580.0, 721.0, 973.0], "g": [["S1", "Lohngruppe 1: Backstubenleitung, in Betrieben mit mehr als 10 Produktionsbeschäftigten", 2593.51], ["S2", "Lohngruppe 2a: Geselle/Gesellin, nach dem 12. Gesellenjahr", 2394.78], ["S3", "Lohngruppe 2b: Geselle/Gesellin, nach dem 5. Gesellenjahr", 2227.78], ["S4", "Lohngruppe 2c: Geselle/Gesellin, nach dem 3. Gesellenjahr", 2160.98], ["S5", "Lohngruppe 2d: Geselle/Gesellin, im 3. Gesellenjahr", 2019.03], ["S6", "Lohngruppe 2e: Geselle/Gesellin, bis zum 2. Gesellenjahr", 1950.56], ["S7", "Lohngruppe 2f: Geselle/Gesellin, während der Behaltepflicht", 1923.84], ["S8", "Lohngruppe 3: Professionisten und Kraftfahrer/innen", 2219.43], ["S9", "Lohngruppe 4: Qualifizierte Arbeiter/innen", 1950.56], ["S10", "Lohngruppe 5: Arbeiter/innen", 1923.84], ["S11", "Lohngruppe 6a: Servierer/in und Ladner/in, nach dem 2. Jahr der Praxis", 1950.56], ["S12", "Lohngruppe 6b: Servierer/in und Ladner/in, im 1. Jahr der Praxis", 1923.84]]}, "ooe": {"n": "Oberösterreich", "s": "ab 1.2.2026", "t": 167, "l": [605.18, 769.02, 1054.72], "g": [["O1", "Lohngruppe 1: Backstubenleitung, in Betrieben mit mehr als 10 Produktionsbeschäftigten", 2457.6], ["O2a", "Lohngruppe 2a: Geselle/Gesellin, ab dem 5. Gesellenjahr", 2440.19], ["O2b", "Lohngruppe 2b: Geselle/Gesellin, im 4. bis 5. Gesellenjahr", 2297.86], ["O2c", "Lohngruppe 2c: Geselle/Gesellin, im 2. bis 3. Gesellenjahr", 2048.0], ["O2d", "Lohngruppe 2d: Geselle/Gesellin, im 1. Gesellenjahr", 1917.95], ["O2e", "Lohngruppe 2e: Geselle/Gesellin, während der Behaltepflicht", 1833.98], ["O3", "Lohngruppe 3: Kraftfahrer/innen", 2048.0], ["O4a", "Lohngruppe 4a: Sonstige Arbeiter/innen, nach 6 Monaten im Betrieb", 1889.28], ["O4b", "Lohngruppe 4b: Sonstige Arbeiter/innen, in den ersten 6 Monaten im Betrieb", 1843.2], ["O5a", "Lohngruppe 5a: Servierer/in und Ladner/in, nach dem 3. Jahr der Praxis", 1980.42], ["O5b", "Lohngruppe 5b: Servierer/in und Ladner/in, nach dem 1. Jahr der Praxis", 1905.66], ["O5c", "Lohngruppe 5c: Servierer/in und Ladner/in, im 1. Jahr der Praxis", 1882.11], ["O5d", "Lohngruppe 5d: Servierer/in und Ladner/in, in den ersten 6 Monaten im Betrieb", 1844.22]]}, "sbg": {"n": "Salzburg", "s": "ab 1.9.2026", "t": 166.705, "l": [645.12, 819.2, 1008.64], "g": [["Z1", "Lohngruppe 1: Erstgeselle/Erstgesellin", 2461.7], ["Z2", "Lohngruppe 2: Geselle/Gesellin, nach dem 3. Gesellenjahr", 2264.06], ["Z3", "Lohngruppe 3: Geselle/Gesellin, im 1. bis 3. Gesellenjahr", 2089.98], ["Z4", "Lohngruppe 4: Arbeiter/innen", 1983.49], ["Z4a", "Lohngruppe 4a: Arbeiter/innen, ab 5 Jahren im Betrieb", 2009.09], ["Z5", "Lohngruppe 5: Servierer/in und Ladner/in", 1983.49]]}, "k": {"n": "Kärnten", "s": "ab 1.5.2026", "t": 167, "l": [530.43, 727.04, 947.2], "g": [["K1", "Lohngruppe 1: Backstubenleitung, in Betrieben mit mehr als 8 Produktionsbeschäftigten", 2700.29], ["K1a", "Lohngruppe 1a: Backstubenleitung", 2370.56], ["K2a", "Lohngruppe 2a: Geselle/Gesellin, ab dem 4. Gesellenjahr", 2319.36], ["K2b", "Lohngruppe 2b: Geselle/Gesellin, im 2. bis 3. Gesellenjahr", 2072.06], ["K2c", "Lohngruppe 2c: Geselle/Gesellin, in der Behaltepflicht und im 1. Berufsjahr", 1944.58], ["K3", "Lohngruppe 3: Kraftfahrer/innen", 2022.4], ["K4", "Lohngruppe 4: Qualifizierte Arbeiter/innen", 1932.29], ["K5", "Lohngruppe 5: Arbeiter/innen", 1924.61], ["K6a", "Lohngruppe 6a: Servierer/in und Ladner/in, im 1. Jahr der Praxis", 1924.61], ["K6b", "Lohngruppe 6b: Servierer/in und Ladner/in, nach dem 1. Jahr der Praxis", 1934.34]]}, "v": {"n": "Vorarlberg", "s": "ab 1.5.2026", "t": 167, "l": [641.47, 813.57, 1002.46], "g": [["V1", "Lohngruppe 1: Backstubenleitung, mit verantwortlicher Tätigkeit", 2494.39], ["V2a", "Lohngruppe 2a: Konditor/in, ab dem 4. Gesellenjahr", 2371.46], ["V2b", "Lohngruppe 2b: Konditor/in, im 2. bis 3. Gesellenjahr", 2164.05], ["V2c", "Lohngruppe 2c: Konditor/in, im 1. Gesellenjahr", 2017.34], ["V2d", "Lohngruppe 2d: Konditor/in, während der Behaltepflicht", 1799.29], ["V2e", "Lohngruppe 2e: Mitarbeiter/innen mit dreijähriger Lehre, aber ohne Lehrabschlussprüfung", 1870.79], ["V3", "Lohngruppe 3: Kraftfahrer/innen", 2041.79], ["V4a", "Lohngruppe 4a: Sonstige Arbeiter/innen, nach 9 Monaten im Betrieb", 2011.64], ["V4b", "Lohngruppe 4b: Sonstige Arbeiter/innen, in den ersten 9 Monaten im Betrieb", 1810.48], ["V5", "Lohngruppe 5: Servierer/in und Ladner/in, nach dem 1. Jahr der Praxis", 2011.64]], "lx": [["LV1", "Lehrling, verkürzte Ausbildung, erste 6 Monate", 835.29], ["LV2", "Lehrling, verkürzte Ausbildung, weitere 12 Monate", 1029.23]]}, "b": {"n": "Burgenland", "s": "ab 1.5.2026", "t": 167, "l": [672.0, 840.0, 1030.0], "g": [["B1", "Lohngruppe 1: Partieführer/in", 2452.0], ["B2a", "Lohngruppe 2a: Konditor/in, nach dem 2. Gesellenjahr", 2359.0], ["B2b", "Lohngruppe 2b: Konditor/in, im 2. Gesellenjahr", 2181.0], ["B2c", "Lohngruppe 2c: Konditor/in, im 1. Gesellenjahr", 1974.0], ["B2d", "Lohngruppe 2d: Geselle/Gesellin, während der Behaltepflicht", 1924.0], ["B3", "Lohngruppe 3: Professionisten, Kraftfahrer/innen und qualifizierte Arbeiter/innen", 2153.0], ["B4", "Lohngruppe 4: Hilfskraft in der Produktion", 1929.0], ["B5", "Lohngruppe 5: Sonstige Arbeiter/innen", 1924.0], ["B6a", "Lohngruppe 6a: Servierer/in und Ladner/in, im 1. Jahr der Praxis", 1924.0], ["B6b", "Lohngruppe 6b: Servierer/in und Ladner/in, nach dem 1. Jahr der Praxis", 1944.0], ["B6c", "Lohngruppe 6c: Servierer/in und Ladner/in, nach dem 2. Jahr der Praxis", 1961.0]]}, "t": {"n": "Tirol", "s": "ab 1.11.2025", "t": 167, "l": [664.15, 845.84, 1026.5], "g": [["T1", "Lohngruppe 1: Erstgeselle/Erstgesellin, mit verantwortlicher Tätigkeit", 2301.26], ["T2", "Lohngruppe 2a: Geselle/Gesellin, mit speziellen Kenntnissen, ab dem 5. Gesellenjahr", 2197.72], ["T3", "Lohngruppe 2b: Geselle/Gesellin, im 4. Gesellenjahr", 2137.6], ["T4", "Lohngruppe 2c: Geselle/Gesellin, im 2. bis 3. Gesellenjahr", 2024.04], ["T5", "Lohngruppe 2d: Geselle/Gesellin, im 1. Gesellenjahr, nach der Behaltepflicht", 1940.54], ["T6", "Lohngruppe 2e: Geselle/Gesellin, während der Behaltepflicht", 1940.54], ["T6b", "Lohngruppe 2e: Mitarbeiter/innen mit dreijähriger Lehre, aber ohne Lehrabschlussprüfung", 1940.54], ["T7", "Lohngruppe 3: Professionisten und Kraftfahrer/innen", 1958.91], ["T8", "Lohngruppe 4: Arbeiter/innen, inklusive Reinigungskräfte", 1922.17], ["T9", "Lohngruppe 5: Servierer/in und Ladner/in", 1922.17]]}};
  Object.keys(KONDITOR_BL).forEach(function (k) {
    var d = KONDITOR_BL[k], p = clone(PAKETE.konditor);
    p.name = 'Konditorgewerbe (Arbeiter), ' + d.n;
    PAKETE['konditor_' + k] = p;
    var gr = d.g.map(function (g) { return { id: g[0], m: true, name: g[1], l: [g[2]] }; });
    d.l.forEach(function (v, i) { gr.push({ id: 'L' + (i + 1), m: true, lehrling: true, name: 'Lehrling, ' + (i + 1) + '. Lehrjahr', l: [v] }); });
    (d.lx || []).forEach(function (x) { gr.push({ id: x[0], m: true, lehrling: true, name: x[1], l: [x[2]] }); });
    LOHNGRUPPEN['konditor_' + k] = { stand: d.s, stufen: null, teiler: d.t, gruppen: gr };
  });
  // Hotel- und Gastgewerbe: Lohnordnungen der anderen Bundesländer ab 1.10.2026 (Quelle: wko.at). Lohngruppen 4 und 5 und die Lehrlinge sind überall gleich.
  var GASTRO_BL = {
    w: { n: 'Gastronomie, Wien (ohne Kaffeehäuser)', s: 'Wien, Gastronomie', g: [[2571.00, 2635.30, 2699.60, 2763.80, 2828.10], [2328.00, 2386.20, 2444.40, 2502.60, 2560.80], [2232.00, 2287.80, 2343.60, 2399.40, 2455.20]] },
    wh: { n: 'Hotellerie und Kaffeehäuser, Wien', s: 'Wien, Hotellerie und Kaffeehäuser', g: [[2771.00, 2840.30, 2909.60, 2978.80, 3048.10], [2557.00, 2620.90, 2684.90, 2748.80, 2812.70], [2330.00, 2388.30, 2446.50, 2504.80, 2563.00]] },
    bgld: { n: 'Hotel- und Gastgewerbe, Burgenland', s: 'Burgenland', g: [[2724.00, 2792.10, 2860.20, 2928.30, 2996.40], [2500.00, 2562.50, 2625.00, 2687.50, 2750.00], [2282.00, 2339.10, 2396.10, 2453.20, 2510.20]] },
    ooe: { n: 'Hotel- und Gastgewerbe, Oberösterreich', s: 'Oberösterreich', g: [[2760.00, 2829.00, 2898.00, 2967.00, 3036.00], [2542.00, 2605.60, 2669.10, 2732.70, 2796.20], [2304.00, 2361.60, 2419.20, 2476.80, 2534.40]] },
    stmk: { n: 'Hotel- und Gastgewerbe, Steiermark', s: 'Steiermark', g: [[2571.00, 2635.30, 2699.60, 2763.80, 2828.10], [2328.00, 2386.20, 2444.40, 2502.60, 2560.80], [2232.00, 2287.80, 2343.60, 2399.40, 2455.20]] },
    ktn: { n: 'Hotel- und Gastgewerbe, Kärnten', s: 'Kärnten', g: [[2713.00, 2780.80, 2848.70, 2916.50, 2984.30], [2440.00, 2501.00, 2562.00, 2623.00, 2684.00], [2232.00, 2287.80, 2343.60, 2399.40, 2455.20]] },
    sbg: { n: 'Hotel- und Gastgewerbe, Salzburg', s: 'Salzburg', g: [[2713.00, 2780.80, 2848.70, 2916.50, 2984.30], [2440.00, 2501.00, 2562.00, 2623.00, 2684.00], [2232.00, 2287.80, 2343.60, 2399.40, 2455.20]] },
    t: { n: 'Hotel- und Gastgewerbe, Tirol', s: 'Tirol', g: [[2713.00, 2780.80, 2848.70, 2916.50, 2984.30], [2440.00, 2501.00, 2562.00, 2623.00, 2684.00], [2232.00, 2287.80, 2343.60, 2399.40, 2455.20]] },
    vbg: { n: 'Hotel- und Gastgewerbe, Vorarlberg', s: 'Vorarlberg', g: [[2713.00, 2780.80, 2848.70, 2916.50, 2984.30], [2440.00, 2501.00, 2562.00, 2623.00, 2684.00], [2232.00, 2287.80, 2343.60, 2399.40, 2455.20]] }
  };
  Object.keys(GASTRO_BL).forEach(function (k) {
    var d = GASTRO_BL[k], p = clone(PAKETE.gastro), l = clone(LOHNGRUPPEN.gastro);
    p.name = d.n; PAKETE['gastro_' + k] = p;
    l.stand = 'ab 1.10.2026, ' + d.s; [0, 1, 2].forEach(function (i) { l.gruppen[i].l = d.g[i]; });
    LOHNGRUPPEN['gastro_' + k] = l;
  });
  // Fleischer: Lohnordnungen aller Bundesländer ab 1.7.2026 (Quelle: wko.at, Arbeiter/innen), Zuschläge aus dem Rahmen-KV
  var FLEISCHER_BASIS = {
    hinweis: 'KV Fleischer, Arbeiter, Lohnordnung des Bundeslandes ab 1.7.2026 (Quelle: wko.at, Rahmen-KV): 40 Stunden/Woche, am Samstag endet die Normalarbeitszeit um 13 Uhr. Überstunden werktags 50 %, Nachtarbeit (20 bis 5 Uhr) 100 %, Nachtüberstunden 150 %. Sonntag: die ersten 7 Stunden tagsüber 100 %, weitere Stunden und Sonntagsnacht 150 %. Feiertag: das regelmäßige Entgelt plus 150 % (Nacht 200 %, Überstunden 100 %, Nachtüberstunden 200 %). Mehrere Zuschläge: es gilt nur der höchste. Der Stundenlohn ist der Monatslohn geteilt durch 4,33 und durch 40. Dienstalterszulage und Zehrgelder sind bei den Prämien als Vorschläge hinterlegt. Angelernte bekommen nach 1 Jahr 5 % und nach 2 Jahren 10 % Zulage, Aushilfen unter einer Woche 20 % Aufschlag: lege sie bei Bedarf als Prämie an. Für den Lehrberuf Fleischverkauf gelten die Lehrlingssätze des Angestellten-KV, die ich nicht hinterlegt habe: trage sie selbst ein. Die App rechnet Überstunden mit 50 %, Sonntag mit 100 % und Feiertag mit 150 %, die Nachtzuschläge bitte laut Lohnzettel prüfen.',
    pruefen: true,
    werte: {
      diaeten: { modell: 'aus', satz: 0, maxStd: null, minStd: 0, vorschlag: 'anwesenheit', stufen: [] },
      ueberstunden: { modell: 'monat', wochenStd: 40, tagesGrenze: null, zuschlagPct: 50 },
      stundenlohn: null,
      betriebFrei: 'urlaub',
      zuschlag: { art: 'kv', sa: 0, so: 100, ft: 150 },
      schlechtwetter: false
    }
  };
  var FLEISCHER_BL = {"n": {"n": "Niederösterreich", "l": [974.96, 1243.22, 1656.67, 1758.58], "g": [["F1", "Lohngruppe 1: Facharbeiter/in in Betrieben mit mehr als 2.000 kg Wurstfleisch pro Woche (Wurster/in, Salzer/in, Ausschneider/in, Selcher/in), Partieführer/in", 3352.85], ["F2", "Lohngruppe 2: Facharbeiter/in (Ausbeinler/in, Schmalzer/in)", 3081.83], ["F3", "Lohngruppe 3: Facharbeiter/in nach dem 2. Berufsjahr, Maschinist/in, Heizer/in, Stockarbeiter/in, Professionist/in, Kraftfahrer/in", 2895.98], ["F4", "Lohngruppe 4: Facharbeiter/in, im 2. Berufsjahr", 2727.77], ["F5", "Lohngruppe 5: Facharbeiter/in, im 1. Berufsjahr", 2450.1], ["F6", "Lohngruppe 6: Angelernte Arbeitnehmer/innen", 2370.72], ["F7", "Lohngruppe 7: Arbeiter/innen", 2277.18], ["F8", "Lohngruppe 8: Arbeiter/innen, in den ersten 3 Monaten im Betrieb, inklusive Reinigungskräfte", 2064.61], ["F9", "Lohngruppe 9: Ladner/in, nach dem 2. Jahr der Praxis", 2277.18], ["F10", "Lohngruppe 10: Ladner/in, im 1. und 2. Jahr der Praxis", 2062.15], ["F11", "Lohngruppe 11: Ladner/in, in den ersten 3 Monaten im Betrieb", 2061.54]]}, "w": {"n": "Wien", "l": [974.96, 1243.22, 1656.67, 1758.58], "g": [["F1", "Lohngruppe 1: Facharbeiter/in in Betrieben mit mehr als 2.000 kg Wurstfleisch pro Woche (Wurster/in, Salzer/in, Ausschneider/in, Selcher/in), Partieführer/in", 3352.85], ["F2", "Lohngruppe 2: Facharbeiter/in (Ausbeinler/in, Schmalzer/in)", 3081.83], ["F3", "Lohngruppe 3: Facharbeiter/in nach dem 2. Berufsjahr, Maschinist/in, Heizer/in, Stockarbeiter/in, Professionist/in, Kraftfahrer/in", 2895.98], ["F4", "Lohngruppe 4: Facharbeiter/in, im 2. Berufsjahr", 2741.77], ["F5", "Lohngruppe 5: Facharbeiter/in, im 1. Berufsjahr", 2450.1], ["F6", "Lohngruppe 6: Angelernte Arbeitnehmer/innen", 2370.72], ["F7", "Lohngruppe 7: Arbeiter/innen", 2277.18], ["F8", "Lohngruppe 8: Arbeiter/innen, in den ersten 3 Monaten im Betrieb, inklusive Reinigungskräfte", 2061.54], ["F9", "Lohngruppe 9: Ladner/in, nach dem 2. Jahr der Praxis", 2277.18], ["F10", "Lohngruppe 10: Ladner/in, im 1. und 2. Jahr der Praxis", 2065.15], ["F11", "Lohngruppe 11: Ladner/in, in den ersten 3 Monaten im Betrieb", 2061.54]]}, "st": {"n": "Steiermark", "l": [974.96, 1243.22, 1656.67, 1758.58], "g": [["F1", "Lohngruppe 1: Facharbeiter/in in Betrieben mit mehr als 2.000 kg Wurstfleisch pro Woche (Wurster/in, Salzer/in, Ausschneider/in, Selcher/in), Partieführer/in", 3358.18], ["F2", "Lohngruppe 2: Facharbeiter/in (Ausbeinler/in, Schmalzer/in)", 3091.25], ["F3", "Lohngruppe 3: Facharbeiter/in nach dem 2. Berufsjahr, Maschinist/in, Heizer/in, Stockarbeiter/in, Professionist/in, Kraftfahrer/in", 2900.33], ["F4", "Lohngruppe 4: Facharbeiter/in, im 2. Berufsjahr", 2751.17], ["F5", "Lohngruppe 5: Facharbeiter/in, im 1. Berufsjahr", 2453.24], ["F6", "Lohngruppe 6: Angelernte Arbeitnehmer/innen", 2373.86], ["F7", "Lohngruppe 7: Arbeiter/innen", 2281.85], ["F8", "Lohngruppe 8: Arbeiter/innen, in den ersten 3 Monaten im Betrieb, inklusive Reinigungskräfte", 2068.1], ["F9", "Lohngruppe 9: Ladner/in, nach dem 2. Jahr der Praxis", 2281.85], ["F10", "Lohngruppe 10: Ladner/in, im 1. und 2. Jahr der Praxis", 2065.15], ["F11", "Lohngruppe 11: Ladner/in, in den ersten 3 Monaten im Betrieb", 2061.54]]}, "k": {"n": "Kärnten", "l": [974.43, 1245.09, 1654.56, 1758.58], "g": [["F1", "Lohngruppe 1: Facharbeiter/in in Betrieben mit mehr als 2.000 kg Wurstfleisch pro Woche (Wurster/in, Salzer/in, Ausschneider/in, Selcher/in), Partieführer/in", 3352.74], ["F2", "Lohngruppe 2: Facharbeiter/in (Ausbeinler/in, Schmalzer/in)", 3082.25], ["F3", "Lohngruppe 3: Facharbeiter/in nach dem 2. Berufsjahr, Maschinist/in, Heizer/in, Stockarbeiter/in, Professionist/in, Kraftfahrer/in", 2895.54], ["F4", "Lohngruppe 4: Facharbeiter/in, im 2. Berufsjahr", 2742.72], ["F5", "Lohngruppe 5: Facharbeiter/in, im 1. Berufsjahr", 2449.0], ["F6", "Lohngruppe 6: Angelernte Arbeitnehmer/innen", 2369.64], ["F7", "Lohngruppe 7: Arbeiter/innen", 2278.73], ["F8", "Lohngruppe 8: Arbeiter/innen, in den ersten 3 Monaten im Betrieb, inklusive Reinigungskräfte", 2064.61], ["F9", "Lohngruppe 9: Ladner/in, nach dem 2. Jahr der Praxis", 2278.73], ["F10", "Lohngruppe 10: Ladner/in, im 1. und 2. Jahr der Praxis", 2066.87], ["F11", "Lohngruppe 11: Ladner/in, in den ersten 3 Monaten im Betrieb", 2061.54]]}, "sbg": {"n": "Salzburg", "l": [974.96, 1243.22, 1656.67, 1758.58], "g": [["F1", "Lohngruppe 1: Facharbeiter/in in Betrieben mit mehr als 2.000 kg Wurstfleisch pro Woche (Wurster/in, Salzer/in, Ausschneider/in, Selcher/in), Partieführer/in", 3352.39], ["F2", "Lohngruppe 2: Facharbeiter/in (Ausbeinler/in, Schmalzer/in)", 3081.18], ["F3", "Lohngruppe 3: Facharbeiter/in nach dem 2. Berufsjahr, Maschinist/in, Heizer/in, Stockarbeiter/in, Professionist/in, Kraftfahrer/in", 2897.12], ["F4", "Lohngruppe 4: Facharbeiter/in, im 2. Berufsjahr", 2742.55], ["F5", "Lohngruppe 5: Facharbeiter/in, im 1. Berufsjahr", 2450.1], ["F6", "Lohngruppe 6: Angelernte Arbeitnehmer/innen", 2370.72], ["F7", "Lohngruppe 7: Arbeiter/innen", 2276.19], ["F8", "Lohngruppe 8: Arbeiter/innen, in den ersten 3 Monaten im Betrieb, inklusive Reinigungskräfte", 2061.54], ["F9", "Lohngruppe 9: Ladner/in, nach dem 2. Jahr der Praxis", 2277.22], ["F10", "Lohngruppe 10: Ladner/in, im 1. und 2. Jahr der Praxis", 2065.15], ["F11", "Lohngruppe 11: Ladner/in, in den ersten 3 Monaten im Betrieb", 2061.54]]}, "b": {"n": "Burgenland", "l": [974.96, 1243.22, 1656.67, 1758.58], "g": [["F1", "Lohngruppe 1: Facharbeiter/in in Betrieben mit mehr als 2.000 kg Wurstfleisch pro Woche (Wurster/in, Salzer/in, Ausschneider/in, Selcher/in), Partieführer/in", 3352.85], ["F2", "Lohngruppe 2: Facharbeiter/in (Ausbeinler/in, Schmalzer/in)", 3081.83], ["F3", "Lohngruppe 3: Facharbeiter/in nach dem 2. Berufsjahr, Maschinist/in, Heizer/in, Stockarbeiter/in, Professionist/in, Kraftfahrer/in", 2895.98], ["F4", "Lohngruppe 4: Facharbeiter/in, im 2. Berufsjahr", 2741.77], ["F5", "Lohngruppe 5: Facharbeiter/in, im 1. Berufsjahr", 2450.1], ["F6", "Lohngruppe 6: Angelernte Arbeitnehmer/innen", 2370.72], ["F7", "Lohngruppe 7: Arbeiter/innen", 2277.18], ["F8", "Lohngruppe 8: Arbeiter/innen, in den ersten 3 Monaten im Betrieb, inklusive Reinigungskräfte", 2061.54], ["F9", "Lohngruppe 9: Ladner/in, nach dem 2. Jahr der Praxis", 2277.18], ["F10", "Lohngruppe 10: Ladner/in, im 1. und 2. Jahr der Praxis", 2065.15], ["F11", "Lohngruppe 11: Ladner/in, in den ersten 3 Monaten im Betrieb", 2061.54]]}, "ooe": {"n": "Oberösterreich", "l": [974.96, 1243.22, 1656.67, 1758.58], "g": [["F1", "Lohngruppe 1: Facharbeiter/in in Betrieben mit mehr als 2.000 kg Wurstfleisch pro Woche (Wurster/in, Salzer/in, Ausschneider/in, Selcher/in), Partieführer/in", 3358.83], ["F2", "Lohngruppe 2: Facharbeiter/in (Ausbeinler/in, Schmalzer/in)", 3089.69], ["F3", "Lohngruppe 3: Facharbeiter/in nach dem 2. Berufsjahr, Maschinist/in, Heizer/in, Stockarbeiter/in", 2897.87], ["F4", "Lohngruppe 4: Kraftfahrer/innen", 2754.23], ["F5", "Lohngruppe 5: Facharbeiter/in, im 2. Berufsjahr", 2559.86], ["F6", "Lohngruppe 6: Facharbeiter/in, im 1. Berufsjahr", 2450.73], ["F7", "Lohngruppe 7: Angelernte Arbeitnehmer/innen", 2371.35], ["F8", "Lohngruppe 8: Arbeiter/innen", 2280.64], ["F9", "Lohngruppe 9: Arbeiter/innen, in den ersten 3 Monaten im Betrieb, inklusive Reinigungskräfte", 2064.61], ["F10", "Lohngruppe 10: Ladner/in, nach dem 2. Jahr der Praxis", 2280.64], ["F11", "Lohngruppe 11: Ladner/in, im 1. und 2. Jahr der Praxis", 2064.84], ["F12", "Lohngruppe 12: Ladner/in, in den ersten 3 Monaten im Betrieb", 2061.54]]}, "v": {"n": "Vorarlberg", "l": [989.54, 1262.51, 1686.97, 1758.88], "g": [["F1", "Lohngruppe 1: Vorarbeiter/in, Obermetzger/in", 3350.29], ["F2", "Lohngruppe 2: Stocker/in, Selcher/in, Salzer/in", 3069.36], ["F3", "Lohngruppe 3: Kraftfahrer/innen", 2868.39], ["F4", "Lohngruppe 4: Facharbeiter/in, nach dem 1. Berufsjahr", 2770.67], ["F5", "Lohngruppe 5: Facharbeiter/in, im 1. Berufsjahr", 2449.74], ["F6", "Lohngruppe 6: Qualifizierte Arbeiter/innen", 2365.27], ["F7", "Lohngruppe 7: Arbeiter/innen", 2273.83], ["F8", "Lohngruppe 8: Arbeiter/innen, in den ersten 3 Monaten im Betrieb, inklusive Reinigungskräfte", 2061.54], ["F9", "Lohngruppe 9: Ladner/in, nach dem 2. Dienstjahr", 2273.83], ["F10", "Lohngruppe 10: Ladner/in, im 1. und 2. Jahr der Praxis", 2065.15], ["F11", "Lohngruppe 11: Ladner/in, in den ersten 3 Monaten im Betrieb", 2061.54]]}, "t": {"n": "Tirol", "l": [974.96, 1243.22, 1656.67, 1758.58], "g": [["F1", "Lohngruppe 1: Vorarbeiter/in, Obermetzger/in", 3375.35], ["F2", "Lohngruppe 2: Stocker/in, Selcher/in, Salzer/in, Tafelbursch/in", 3102.16], ["F3", "Lohngruppe 3: Facharbeiter/in nach dreijähriger Lehrzeit", 2759.11], ["F4", "Lohngruppe 4: Gehilfe/Gehilfin nach dreijähriger Lehrzeit", 2429.64], ["F5", "Lohngruppe 5: Kraftfahrer/innen", 2838.07], ["F7", "Lohngruppe 7: Qualifizierte Arbeiter/innen", 2385.61], ["F8", "Lohngruppe 8: Arbeiter/innen", 2291.78], ["F9", "Lohngruppe 9: Arbeiter/innen, in den ersten 3 Monaten im Betrieb, inklusive Reinigungskräfte", 2061.54], ["F10a", "Lohngruppe 10a: Ladner/in, nach dem 3. Dienstjahr", 2291.78], ["F10b", "Lohngruppe 10b: Ladner/in, vom 4. Monat bis Ende des 3. Dienstjahres", 2074.98], ["F10c", "Lohngruppe 10c: Ladner/in, in den ersten 3 Monaten im Betrieb", 2061.54]]}};
  Object.keys(FLEISCHER_BL).forEach(function (k) {
    var d = FLEISCHER_BL[k], key = k === 'n' ? 'fleischer' : 'fleischer_' + k, p = clone(FLEISCHER_BASIS);
    p.name = 'Fleischergewerbe (Arbeiter), ' + d.n;
    PAKETE[key] = p;
    var gr = d.g.map(function (g) { return { id: g[0], m: true, name: g[1], l: [g[2]] }; });
    d.l.forEach(function (v, i) { gr.push({ id: 'L' + (i + 1), m: true, lehrling: true, name: 'Lehrling, ' + (i + 1) + '. Lehrjahr', l: [v] }); });
    LOHNGRUPPEN[key] = { stand: 'ab 1.7.2026', stufen: null, teiler: 173.2, gruppen: gr };
  });
  // Eisenbahn-KV (Kollektivvertrag Eisenbahnunternehmen, Arbeiter/innen und Angestellte, Gehaltsordnung ab 1.12.2025, Quelle: wko.at)
  PAKETE.bahn = {
    name: 'Eisenbahn (ÖBB, Westbahn und andere Eisenbahnunternehmen)',
    hinweis: 'Eisenbahn-KV für Arbeiter/innen und Angestellte, Gehaltsordnung ab 1.12.2025 (Quelle: wko.at). Er gilt österreichweit für Eisenbahnunternehmen mit Berechtigung nach dem Eisenbahngesetz, zum Beispiel ÖBB-Gesellschaften und die Westbahn, für Dienstverhältnisse, die nach dem 31.12.2010 begonnen haben. Nicht erfasst sind unter anderem Lehrlinge teilweise, die städtischen Verkehrsbetriebe und die Privatbahnen mit eigener Dienst- und Besoldungsordnung (zum Beispiel Wiener Lokalbahnen): dafür habe ich die Tabellen noch nicht hinterlegt. 40 Stunden/Woche (38,5 mit Betriebsvereinbarung), Stundenlohn = Monatsgehalt geteilt durch 173. Nachtarbeitszulage 4,10 € je Stunde (22 bis 5 Uhr) und Sonn- und Feiertagszulage 7,00 € je Stunde sind bei den Prämien als Vorschlag hinterlegt. Die Verwendungsgruppen A bis J und ihre Stufen (Vorrückung nach 3, dann alle 4 Jahre) sind hinterlegt. Welche Tätigkeit in welche Gruppe fällt, konnte ich nicht belegen: die Gruppe steht auf deinem Dienstzettel oder Lohnzettel. Die Höhe des Überstundenzuschlags steht nicht in der Quelle, die App rechnet mit 50 %: bitte laut Lohnzettel prüfen. Die Bordgastronomie (Anlage 7A) und die Schlaf- und Liegewagen (Anlage 8A) haben eigene Tabellen, beide sind hinterlegt. Für Küche und Kantine gibt es im Eisenbahn-KV keine eigenen Berufsbezeichnungen wie Küchenchef oder Koch: Du wirst einer Verwendungsgruppe (A bis J) zugeordnet, die auf deinem Dienstzettel oder Lohnzettel steht.',
    pruefen: true,
    werte: {
      diaeten: { modell: 'aus', satz: 0, maxStd: null, minStd: 0, vorschlag: 'anwesenheit', stufen: [] },
      ueberstunden: { modell: 'monat', wochenStd: 40, tagesGrenze: null, zuschlagPct: 50 },
      stundenlohn: null,
      betriebFrei: 'urlaub',
      zuschlag: { art: 'kv', sa: 0, so: 0, ft: 100 },
      schlechtwetter: false
    }
  };
  LOHNGRUPPEN.bahn = { stand: 'ab 1.12.2025', stufen: ['Stufe 1 (3 Jahre)', 'Stufe 2 (4 Jahre)', 'Stufe 3 (4 Jahre)', 'Stufe 4 (4 Jahre)', 'Stufe 5 (danach)'], teiler: 173, gruppen: [
      { id: 'A', m: true, name: 'Verwendungsgruppe A: sehr einfache Tätigkeiten ohne Zweckausbildung (zum Beispiel Reinigungskraft, Portier)', l: [2528.58, 2563.09, 2581.70, 2614.89, 2633.48] },
      { id: 'B', m: true, name: 'Verwendungsgruppe B: einfache Tätigkeiten nach Anweisung, mit Zweckausbildung', l: [2816.97, 2950.72, 3018.29, 3153.50, 3219.67] },
      { id: 'C', m: true, name: 'Verwendungsgruppe C: einfache Tätigkeiten, selbständig, mit längerer Zweckausbildung', l: [2996.74, 3130.46, 3198.10, 3333.29, 3400.85] },
      { id: 'D', m: true, name: 'Verwendungsgruppe D: mit abgeschlossener Berufsausbildung (Lehrabschluss)', l: [3146.32, 3280.07, 3347.65, 3481.41, 3549.00] },
      { id: 'E', m: true, name: 'Verwendungsgruppe E: schwierige Tätigkeiten, selbständig', l: [3369.23, 3520.25, 3595.84, 3749.18, 3826.74] },
      { id: 'F', m: true, name: 'Verwendungsgruppe F: schwierige und verantwortungsvolle Tätigkeiten, selbständig', l: [3717.85, 3874.49, 3952.05, 4105.71, 4183.31] },
      { id: 'G', m: true, name: 'Verwendungsgruppe G: sehr schwierige Tätigkeiten mit Entscheidungsspielraum', l: [4074.40, 4308.86, 4425.91, 4674.05, 4800.49] },
      { id: 'H', m: true, name: 'Verwendungsgruppe H: sehr schwierige Tätigkeiten mit beträchtlichem Entscheidungsspielraum', l: [4435.05, 4851.36, 5066.45, 5481.74, 5688.96] },
      { id: 'I', m: true, name: 'Verwendungsgruppe I: besonders verantwortungsvolle Tätigkeiten mit hohem Entscheidungsspielraum', l: [5441.87, 5888.20, 6112.99, 6559.27, 6784.06] },
      { id: 'J', m: true, name: 'Verwendungsgruppe J: leitende Stellung', l: [6434.95, 7064.60, 7378.60, 8008.24, 8323.87] },
      { id: 'L1', m: true, lehrling: true, name: 'Lehrling, 1. Lehrjahr', l: [1080.83] },
      { id: 'L2', m: true, lehrling: true, name: 'Lehrling, 2. Lehrjahr', l: [1272.83] },
      { id: 'L3', m: true, lehrling: true, name: 'Lehrling, 3. Lehrjahr', l: [1616.67] },
      { id: 'L4', m: true, lehrling: true, name: 'Lehrling, 4. Lehrjahr', l: [2162.95] },
      { id: 'G1', m: true, lehrling: true, name: 'Lehrling (Gleisbautechnik), 1. Lehrjahr', l: [1115.98] },
      { id: 'G2', m: true, lehrling: true, name: 'Lehrling (Gleisbautechnik), 2. Lehrjahr', l: [1550.31] },
      { id: 'G3', m: true, lehrling: true, name: 'Lehrling (Gleisbautechnik), 3. Lehrjahr', l: [2065.23] },
      { id: 'K1', m: true, lehrling: true, name: 'Lehrling (Büro und Mobilitätsservice), 1. Lehrjahr', l: [952.42] },
      { id: 'K2', m: true, lehrling: true, name: 'Lehrling (Büro und Mobilitätsservice), 2. Lehrjahr', l: [1037.56] },
      { id: 'K3', m: true, lehrling: true, name: 'Lehrling (Büro und Mobilitätsservice), 3. Lehrjahr', l: [1387.44] },
      { id: 'K4', m: true, lehrling: true, name: 'Lehrling (Büro und Mobilitätsservice), 4. Lehrjahr', l: [1869.78] },
      { id: 'G7U', m: true, name: 'Gastronomische Betreuung (Anlage 7A), ungelernt', l: [2491.25, 2540.87, 2589.23, 2637.63, 2688.31] },
      { id: 'G7G', m: true, name: 'Gastronomische Betreuung (Anlage 7A), gelernt', l: [2631.43, 2685.62, 2740.72, 2797.14, 2853.55] },
      { id: 'S8A', m: true, name: 'Schlaf- und Liegewagen 8A: einfache Service- und Hilfstätigkeiten', l: [2310.66, 2353.55, 2396.44, 2450.05, 2503.66] },
      { id: 'S8B', m: true, name: 'Schlaf- und Liegewagen 8B: Service mit abgeschlossener Zweckausbildung', l: [2332.11, 2374.99, 2417.88, 2471.5, 2525.11] },
      { id: 'S8C', m: true, name: 'Schlaf- und Liegewagen 8C: Service und Sicherheitsaufgaben, mit eisenbahnspezifischer Ausbildung', l: [2808.93, 2937.89, 3003.1, 3133.48, 3198.63] },
      { id: 'S8D', m: true, name: 'Schlaf- und Liegewagen 8D: stationäre Tätigkeiten (Büro, Kontrolle, Ausbildung)', l: [2825.73, 2948.65, 3010.62, 3133.53, 3198.63] },
      { id: 'S8E', m: true, name: 'Schlaf- und Liegewagen 8E: selbständige Tätigkeiten', l: [3132.52, 3276.37, 3352.86, 3510.7, 3587.45] },
      { id: 'S8F', m: true, name: 'Schlaf- und Liegewagen 8F: schwierige und verantwortungsvolle Tätigkeiten, selbständig', l: [3455.43, 3615.43, 3694.55, 3851.77, 3931.08] },
      { id: 'S8G', m: true, name: 'Schlaf- und Liegewagen 8G: sehr schwierige Tätigkeiten mit hohem Entscheidungsspielraum', l: [4093.94, 4350.75, 4486.99, 4748.41, 4876.56] }
  ] };
  // Privatbahnen: Dienst- und Besoldungsordnung (DBO), Gehaltstabelle ab 1.12.2025, nur Dienstverhältnisse vor 2011 (Quelle: wko.at)
  PAKETE.bahn_dbo = {
    name: 'Privatbahnen (Dienst- und Besoldungsordnung, Eintritt vor 2011)',
    hinweis: 'Dienst- und Besoldungsordnung der Privatbahnen, Gehaltstabelle ab 1.12.2025 (Quelle: wko.at). Sie gilt für Haupt-, Neben- und Straßenbahnen außerhalb der ÖBB (zum Beispiel Wiener Lokalbahnen), aber nur für Dienstverhältnisse, die vor dem 1.1.2011 begonnen haben. Wer später eingetreten ist, fällt unter den Eisenbahn-KV. 40 Stunden/Woche (38,5 mit Betriebsvereinbarung). Vorrückung alle zwei Jahre in die nächste Gehaltsstufe, danach zwei Dienstalterszulagen. Deine Gehaltsgruppe und Gehaltsstufe stehen auf dem Lohnzettel. Sonn- und Feiertagszulage 7,00 € je Stunde, als Vorschlag bei den Prämien hinterlegt. Überstundenzuschlag, Stundenteiler und Nachtdienstzulage stehen nicht in der Quelle: die App rechnet mit 50 % und teilt das Monatsgehalt durch 173, bitte laut Lohnzettel prüfen.',
    pruefen: true,
    werte: {
      diaeten: { modell: 'aus', satz: 0, maxStd: null, minStd: 0, vorschlag: 'anwesenheit', stufen: [] },
      ueberstunden: { modell: 'monat', wochenStd: 40, tagesGrenze: null, zuschlagPct: 50 },
      stundenlohn: null,
      betriebFrei: 'urlaub',
      zuschlag: { art: 'kv', sa: 0, so: 0, ft: 100 },
      schlechtwetter: false
    }
  };
  LOHNGRUPPEN.bahn_dbo = { stand: 'ab 1.12.2025', stufen: ['Gehaltsstufe 1'], teiler: 173, gruppen: [
      { id: 'DI', m: true, name: 'Gehaltsgruppe I', stufen: ['Gehaltsstufe 1', 'Gehaltsstufe 2', 'Gehaltsstufe 3', 'Gehaltsstufe 4', 'Gehaltsstufe 5', 'Gehaltsstufe 6', 'Gehaltsstufe 7', 'Gehaltsstufe 8', 'Gehaltsstufe 9', 'Gehaltsstufe 10', 'Gehaltsstufe 11', 'Gehaltsstufe 12', '1. Dienstalterszulage', '2. Dienstalterszulage'], l: [2856.72, 2873.13, 2889.41, 2906.15, 2920.70, 2933.18, 2945.54, 2958.27, 2972.71, 2986.98, 3001.53, 3018.40, 3043.71, 3081.03] },
      { id: 'DIIa', m: true, name: 'Gehaltsgruppe IIa', stufen: ['Gehaltsstufe 1', 'Gehaltsstufe 2', 'Gehaltsstufe 3', 'Gehaltsstufe 4', 'Gehaltsstufe 5', 'Gehaltsstufe 6', 'Gehaltsstufe 7', 'Gehaltsstufe 8', 'Gehaltsstufe 9', 'Gehaltsstufe 10', 'Gehaltsstufe 11', 'Gehaltsstufe 12', '1. Dienstalterszulage', '2. Dienstalterszulage'], l: [2886.28, 2903.88, 2921.11, 2938.93, 2954.67, 2968.10, 2981.71, 2995.59, 3011.05, 3026.26, 3041.72, 3060.20, 3088.39, 3129.05] },
      { id: 'DIIb', m: true, name: 'Gehaltsgruppe IIb', stufen: ['Gehaltsstufe 1', 'Gehaltsstufe 2', 'Gehaltsstufe 3', 'Gehaltsstufe 4', 'Gehaltsstufe 5', 'Gehaltsstufe 6', 'Gehaltsstufe 7', 'Gehaltsstufe 8', 'Gehaltsstufe 9', 'Gehaltsstufe 10', 'Gehaltsstufe 11', 'Gehaltsstufe 12', '1. Dienstalterszulage', '2. Dienstalterszulage'], l: [2930.06, 2949.26, 2968.50, 2987.97, 3005.57, 3021.12, 3036.73, 3051.94, 3069.29, 3086.61, 3103.83, 3123.83, 3155.00, 3198.81] },
      { id: 'DIIIa', m: true, name: 'Gehaltsgruppe IIIa', stufen: ['Gehaltsstufe 1', 'Gehaltsstufe 2', 'Gehaltsstufe 3', 'Gehaltsstufe 4', 'Gehaltsstufe 5', 'Gehaltsstufe 6', 'Gehaltsstufe 7', 'Gehaltsstufe 8', 'Gehaltsstufe 9', 'Gehaltsstufe 10', 'Gehaltsstufe 11', 'Gehaltsstufe 12', '1. Dienstalterszulage', '2. Dienstalterszulage'], l: [2987.81, 3009.06, 3029.72, 3050.97, 3070.02, 3086.91, 3103.47, 3120.47, 3139.20, 3157.77, 3176.72, 3200.67, 3239.85, 3291.98] },
      { id: 'DIIIb', m: true, name: 'Gehaltsgruppe IIIb', stufen: ['Gehaltsstufe 1', 'Gehaltsstufe 2', 'Gehaltsstufe 3', 'Gehaltsstufe 4', 'Gehaltsstufe 5', 'Gehaltsstufe 6', 'Gehaltsstufe 7', 'Gehaltsstufe 8', 'Gehaltsstufe 9', 'Gehaltsstufe 10', 'Gehaltsstufe 11', 'Gehaltsstufe 12', '1. Dienstalterszulage', '2. Dienstalterszulage'], l: [3052.58, 3076.17, 3099.88, 3123.19, 3144.67, 3163.59, 3182.83, 3201.89, 3223.13, 3244.43, 3265.40, 3292.13, 3336.77, 3394.44] },
      { id: 'DIVa', m: true, name: 'Gehaltsgruppe IVa', stufen: ['Gehaltsstufe 1', 'Gehaltsstufe 2', 'Gehaltsstufe 3', 'Gehaltsstufe 4', 'Gehaltsstufe 5', 'Gehaltsstufe 6', 'Gehaltsstufe 7', 'Gehaltsstufe 8', 'Gehaltsstufe 9', 'Gehaltsstufe 10', 'Gehaltsstufe 11', 'Gehaltsstufe 12', '1. Dienstalterszulage', '2. Dienstalterszulage'], l: [3126.30, 3155.91, 3185.06, 3214.26, 3241.09, 3265.91, 3290.59, 3315.31, 3342.13, 3368.35, 3395.15, 3431.11, 3494.61, 3573.34] },
      { id: 'DIVb', m: true, name: 'Gehaltsgruppe IVb', stufen: ['Gehaltsstufe 1', 'Gehaltsstufe 2', 'Gehaltsstufe 3', 'Gehaltsstufe 4', 'Gehaltsstufe 5', 'Gehaltsstufe 6', 'Gehaltsstufe 7', 'Gehaltsstufe 8', 'Gehaltsstufe 9', 'Gehaltsstufe 10', 'Gehaltsstufe 11', 'Gehaltsstufe 12', '1. Dienstalterszulage', '2. Dienstalterszulage'], l: [3206.29, 3241.21, 3276.14, 3310.99, 3343.78, 3373.97, 3404.39, 3434.34, 3467.40, 3501.72, 3537.39, 3584.70, 3669.53, 3771.22] },
      { id: 'DVa', m: true, name: 'Gehaltsgruppe Va', stufen: ['Gehaltsstufe 1', 'Gehaltsstufe 2', 'Gehaltsstufe 3', 'Gehaltsstufe 4', 'Gehaltsstufe 5', 'Gehaltsstufe 6', 'Gehaltsstufe 7', 'Gehaltsstufe 8', 'Gehaltsstufe 9', 'Gehaltsstufe 10', 'Gehaltsstufe 11', 'Gehaltsstufe 12', '1. Dienstalterszulage', '2. Dienstalterszulage'], l: [3282.74, 3326.30, 3369.45, 3413.28, 3454.94, 3494.95, 3537.39, 3580.76, 3629.15, 3678.56, 3728.14, 3791.70, 3906.22, 4037.95] },
      { id: 'DVb', m: true, name: 'Gehaltsgruppe Vb', stufen: ['Gehaltsstufe 2', 'Gehaltsstufe 3', 'Gehaltsstufe 4', 'Gehaltsstufe 5', 'Gehaltsstufe 6', 'Gehaltsstufe 7', 'Gehaltsstufe 8', 'Gehaltsstufe 9', 'Gehaltsstufe 10', 'Gehaltsstufe 11', 'Gehaltsstufe 12', '1. Dienstalterszulage', '2. Dienstalterszulage'], l: [3357.02, 3415.51, 3475.25, 3534.66, 3595.16, 3659.32, 3724.41, 3791.80, 3859.78, 3926.92, 3999.69, 4131.41, 4283.06] },
      { id: 'DVIa', m: true, name: 'Gehaltsgruppe VIa', stufen: ['Gehaltsstufe 2', 'Gehaltsstufe 3', 'Gehaltsstufe 4', 'Gehaltsstufe 5', 'Gehaltsstufe 6', 'Gehaltsstufe 7', 'Gehaltsstufe 8', 'Gehaltsstufe 9', 'Gehaltsstufe 10', 'Gehaltsstufe 11', 'Gehaltsstufe 12', '1. Dienstalterszulage', '2. Dienstalterszulage'], l: [3441.58, 3462.41, 3540.24, 3620.61, 3703.81, 3787.15, 3869.98, 3955.55, 4040.09, 4127.14, 4213.49, 4376.60, 4563.70] },
      { id: 'DVIb', m: true, name: 'Gehaltsgruppe VIb', stufen: ['Gehaltsstufe 3', 'Gehaltsstufe 4', 'Gehaltsstufe 5', 'Gehaltsstufe 6', 'Gehaltsstufe 7', 'Gehaltsstufe 8', 'Gehaltsstufe 9', 'Gehaltsstufe 10', 'Gehaltsstufe 11', 'Gehaltsstufe 12', '1. Dienstalterszulage', '2. Dienstalterszulage'], l: [3547.62, 3648.30, 3752.73, 3853.84, 3954.74, 4054.78, 4159.33, 4264.74, 4374.36, 4482.78, 4695.13, 4936.47] },
      { id: 'DVIIa', m: true, name: 'Gehaltsgruppe VIIa', stufen: ['Gehaltsstufe 3', 'Gehaltsstufe 4', 'Gehaltsstufe 5', 'Gehaltsstufe 6', 'Gehaltsstufe 7', 'Gehaltsstufe 8', 'Gehaltsstufe 9', 'Gehaltsstufe 10', 'Gehaltsstufe 11', 'Gehaltsstufe 12', '1. Dienstalterszulage', '2. Dienstalterszulage'], l: [3636.23, 3773.54, 3907.39, 4039.61, 4170.32, 4306.56, 4447.99, 4593.57, 4747.06, 4900.36, 5185.81, 5489.87] },
      { id: 'DVIIb', m: true, name: 'Gehaltsgruppe VIIb', stufen: ['Gehaltsstufe 3', 'Gehaltsstufe 4', 'Gehaltsstufe 5', 'Gehaltsstufe 6', 'Gehaltsstufe 7', 'Gehaltsstufe 8', 'Gehaltsstufe 9', 'Gehaltsstufe 10', 'Gehaltsstufe 11', 'Gehaltsstufe 12', 'Gehaltsstufe 13', '1. Dienstalterszulage', '2. Dienstalterszulage'], l: [4046.72, 4103.68, 4158.02, 4209.83, 4382.11, 4557.50, 4749.56, 4940.10, 5131.89, 5317.69, 5478.23, 5856.19, 6234.11] },
      { id: 'DVIIIa', m: true, name: 'Gehaltsgruppe VIIIa', stufen: ['Gehaltsstufe 4', 'Gehaltsstufe 5', 'Gehaltsstufe 6', 'Gehaltsstufe 7', 'Gehaltsstufe 8', 'Gehaltsstufe 9', 'Gehaltsstufe 10', 'Gehaltsstufe 11', 'Gehaltsstufe 12', 'Gehaltsstufe 13', 'Gehaltsstufe 14', '1. Dienstalterszulage', '2. Dienstalterszulage'], l: [4108.17, 4184.98, 4408.05, 4641.51, 4883.87, 5131.34, 5370.75, 5609.40, 5847.42, 6058.03, 6299.12, 6780.72, 7206.73] },
      { id: 'DVIIIb', m: true, name: 'Gehaltsgruppe VIIIb', stufen: ['Gehaltsstufe 5', 'Gehaltsstufe 6', 'Gehaltsstufe 7', 'Gehaltsstufe 8', 'Gehaltsstufe 9', 'Gehaltsstufe 10', 'Gehaltsstufe 11', 'Gehaltsstufe 12', 'Gehaltsstufe 13', 'Gehaltsstufe 14', '1. Dienstalterszulage', '2. Dienstalterszulage'], l: [4391.13, 4621.68, 4865.99, 5179.36, 5489.02, 5797.65, 6105.96, 6410.08, 6682.15, 6932.36, 7451.55, 8249.25] },
      { id: 'DIXa', m: true, name: 'Gehaltsgruppe IXa', stufen: ['Gehaltsstufe 7', 'Gehaltsstufe 8', 'Gehaltsstufe 9', 'Gehaltsstufe 10', 'Gehaltsstufe 11', 'Gehaltsstufe 12', 'Gehaltsstufe 13', 'Gehaltsstufe 14', 'Gehaltsstufe 15', '1. Dienstalterszulage', '2. Dienstalterszulage'], l: [5089.95, 5466.57, 5845.51, 6223.72, 6601.49, 6915.80, 7249.22, 7620.01, 8176.71, 9289.74, 10402.85] },
      { id: 'DIXb', m: true, name: 'Gehaltsgruppe IXb', stufen: ['Gehaltsstufe 7', 'Gehaltsstufe 8', 'Gehaltsstufe 9', 'Gehaltsstufe 10', 'Gehaltsstufe 11', 'Gehaltsstufe 12', 'Gehaltsstufe 13', 'Gehaltsstufe 14', 'Gehaltsstufe 15', 'Gehaltsstufe 16', '1. Dienstalterszulage', '2. Dienstalterszulage'], l: [5470.93, 5848.23, 6228.52, 6609.01, 6926.07, 7295.98, 7628.91, 8184.91, 8740.56, 9296.86, 10409.59, 11522.18] },
      { id: 'DX', m: true, name: 'Gehaltsgruppe X', stufen: ['Gehaltsstufe 9', 'Gehaltsstufe 10', 'Gehaltsstufe 11', 'Gehaltsstufe 12', 'Gehaltsstufe 13', 'Gehaltsstufe 14', 'Gehaltsstufe 15', 'Gehaltsstufe 16', '1. Dienstalterszulage', '2. Dienstalterszulage'], l: [7067.91, 7625.44, 8182.04, 8736.95, 9248.15, 9944.80, 10641.13, 11336.71, 12727.42, 14118.49] }
    ] };
  // Autobus und Taxi (KV private Autobusbetriebe und KV Personenbeförderung mit Pkw, beide ab 1.1.2026, Quelle: wko.at)
  PAKETE.autobus = {
    name: 'Autobus, Linienverkehr (Arbeiter)',
    hinweis: 'KV private Autobusbetriebe, Arbeiter, Lohnordnung ab 1.1.2026 (Quelle: wko.at): 40 Stunden/Woche, Überstunden ab der 41. Wochenstunde 50 %, zwischen 22 und 6 Uhr 100 %. Arbeit am wöchentlichen Ruhetag und Überstunden am Feiertag 100 %. Nachtstunden: im Linienverkehr 22 bis 24 Uhr 50 %, von 0 bis 5 Uhr 100 %. Stehzeiten bis 6 Stunden am Tag zählen voll, darüber nach 1 Stunde Abzug zur Hälfte. Tagesgeld je 24 Stunden: Linienverkehr 25,44 €, Gelegenheitsverkehr 30,00 € (Ausland 31,44 € und 34,68 €), bei mehr als 3 Stunden Abwesenheit ein Zwölftel je angefangener Stunde, Nächtigung 6,26 €. Urlaubs- und Weihnachtsgeld je 4,33 Wochenlöhne plus 30 %. Vordienstzeiten als Buslenker zählen bis 10 Jahre. Lehrlingseinkommen stehen nicht in der Lohnordnung. Die App rechnet Überstunden mit 50 % und Feiertag mit 100 %: Ruhetags- und Nachtzuschläge bitte laut Lohnzettel prüfen.',
    pruefen: true,
    werte: {
      diaeten: { modell: 'stunde', satz: 2.12, maxStd: 12, minStd: 3, vorschlag: 'anwesenheit', stufen: [] },
      ueberstunden: { modell: 'monat', wochenStd: 40, tagesGrenze: null, zuschlagPct: 50 },
      stundenlohn: null,
      betriebFrei: 'urlaub',
      zuschlag: { art: 'kv', sa: 0, so: 0, ft: 100 },
      schlechtwetter: false
    }
  };
  PAKETE.autobus_g = {
    name: 'Autobus, Gelegenheitsverkehr und Reisebus (Arbeiter)',
    hinweis: 'KV private Autobusbetriebe, Arbeiter, Lohnordnung ab 1.1.2026 (Quelle: wko.at): 40 Stunden/Woche, Überstunden ab der 41. Wochenstunde 50 %, zwischen 22 und 6 Uhr 100 %. Arbeit am wöchentlichen Ruhetag und Überstunden am Feiertag 100 %. Nachtstunden: im Linienverkehr 22 bis 24 Uhr 50 %, von 0 bis 5 Uhr 100 %. Stehzeiten bis 6 Stunden am Tag zählen voll, darüber nach 1 Stunde Abzug zur Hälfte. Tagesgeld je 24 Stunden: Linienverkehr 25,44 €, Gelegenheitsverkehr 30,00 € (Ausland 31,44 € und 34,68 €), bei mehr als 3 Stunden Abwesenheit ein Zwölftel je angefangener Stunde, Nächtigung 6,26 €. Urlaubs- und Weihnachtsgeld je 4,33 Wochenlöhne plus 30 %. Vordienstzeiten als Buslenker zählen bis 10 Jahre. Lehrlingseinkommen stehen nicht in der Lohnordnung. Die App rechnet Überstunden mit 50 % und Feiertag mit 100 %: Ruhetags- und Nachtzuschläge bitte laut Lohnzettel prüfen.',
    pruefen: true,
    werte: {
      diaeten: { modell: 'stunde', satz: 2.50, maxStd: 12, minStd: 3, vorschlag: 'anwesenheit', stufen: [] },
      ueberstunden: { modell: 'monat', wochenStd: 40, tagesGrenze: null, zuschlagPct: 50 },
      stundenlohn: null,
      betriebFrei: 'urlaub',
      zuschlag: { art: 'kv', sa: 0, so: 0, ft: 100 },
      schlechtwetter: false
    }
  };
  LOHNGRUPPEN.autobus = { stand: 'ab 1.1.2026', stufen: ['1. bis 10. Jahr im Betrieb', '11. bis 20. Jahr im Betrieb', 'ab dem 21. Jahr im Betrieb'], gruppen: [
      { id: 'B1', name: 'Kraftfahrer/in (Buslenker/in)', stufen: ['1. bis 10. Jahr im Betrieb', '11. bis 20. Jahr im Betrieb', 'ab dem 21. Jahr im Betrieb'], l: [17.14, 17.25, 17.40] },
      { id: 'B2', name: 'Berufskraftfahrer/in mit Lehrabschlussprüfung', stufen: ['1. bis 10. Jahr im Betrieb', '11. bis 20. Jahr im Betrieb', 'ab dem 21. Jahr im Betrieb'], l: [17.25, 17.40, 17.57] },
      { id: 'B3', name: 'Facharbeiter/in', stufen: ['1. Jahr im Betrieb', '2. bis 10. Jahr im Betrieb', '11. bis 20. Jahr im Betrieb', 'ab dem 21. Jahr im Betrieb'], l: [15.73, 15.80, 15.94, 16.01] },
      { id: 'B4', name: 'Angelernte Arbeiter/innen im Werkstättenbetrieb', l: [15.03] },
      { id: 'B5', name: 'Garagenvorarbeiter/in', l: [15.73] },
      { id: 'B6', name: 'Garagenarbeiter/innen, Tankwarte, Kassiere', l: [13.43] }
    ] };
  LOHNGRUPPEN.autobus_g = LOHNGRUPPEN.autobus;
  PAKETE.taxi = {
    name: 'Taxi und Mietwagen (Arbeiter)',
    hinweis: 'KV Personenbeförderungsgewerbe mit Pkw (Taxi), Arbeiter, ab 1.1.2026 (Quelle: wko.at): bundesweiter Mindestlohn 2.060,00 € brutto im Monat, bei kürzerer Arbeitszeit anteilig. Lohngruppen gibt es nicht. Normalarbeitszeit im Taxi bis 55 Stunden/Woche (Grundstundenlohn 1/238 des Monatslohns), bei Schülertransport, Krankenbeförderung und ähnlichen Fahrten 45 Stunden (1/173). Überstunden 50 %. Für Nacht, Sonntag und Feiertag nennt der KV keine eigenen Zuschläge, es gilt das Gesetz. Urlaubs- und Weihnachtsgeld je ein Mindestmonatslohn (fällig 1. Juni und 1. Dezember). In manchen Bundesländern gibt es eigene Landes-KVs mit Tagesgeldern, die ich nicht hinterlegt habe: bitte laut Lohnzettel prüfen. Lehrlinge sind nicht geregelt.',
    pruefen: true,
    werte: {
      diaeten: { modell: 'aus', satz: 0, maxStd: null, minStd: 0, vorschlag: 'anwesenheit', stufen: [] },
      ueberstunden: { modell: 'monat', wochenStd: 55, tagesGrenze: null, zuschlagPct: 50 },
      stundenlohn: null,
      betriebFrei: 'urlaub',
      zuschlag: { art: 'kv', sa: 0, so: 0, ft: 100 },
      schlechtwetter: false
    }
  };
  PAKETE.taxi_b = {
    name: 'Schülertransport und Krankenbeförderung mit Pkw (Arbeiter)',
    hinweis: 'KV Personenbeförderungsgewerbe mit Pkw (Taxi), Arbeiter, ab 1.1.2026 (Quelle: wko.at): bundesweiter Mindestlohn 2.060,00 € brutto im Monat, bei kürzerer Arbeitszeit anteilig. Lohngruppen gibt es nicht. Normalarbeitszeit im Taxi bis 55 Stunden/Woche (Grundstundenlohn 1/238 des Monatslohns), bei Schülertransport, Krankenbeförderung und ähnlichen Fahrten 45 Stunden (1/173). Überstunden 50 %. Für Nacht, Sonntag und Feiertag nennt der KV keine eigenen Zuschläge, es gilt das Gesetz. Urlaubs- und Weihnachtsgeld je ein Mindestmonatslohn (fällig 1. Juni und 1. Dezember). In manchen Bundesländern gibt es eigene Landes-KVs mit Tagesgeldern, die ich nicht hinterlegt habe: bitte laut Lohnzettel prüfen. Lehrlinge sind nicht geregelt.',
    pruefen: true,
    werte: {
      diaeten: { modell: 'aus', satz: 0, maxStd: null, minStd: 0, vorschlag: 'anwesenheit', stufen: [] },
      ueberstunden: { modell: 'monat', wochenStd: 45, tagesGrenze: null, zuschlagPct: 50 },
      stundenlohn: null,
      betriebFrei: 'urlaub',
      zuschlag: { art: 'kv', sa: 0, so: 0, ft: 100 },
      schlechtwetter: false
    }
  };
  LOHNGRUPPEN.taxi = { stand: 'ab 1.1.2026', stufen: null, teiler: 238, gruppen: [
      { id: 'T1', m: true, name: 'Mindestlohn (alle Arbeiter/innen)', l: [2060.00] }
    ] };
  LOHNGRUPPEN.taxi_b = { stand: 'ab 1.1.2026', stufen: null, teiler: 173, gruppen: [
      { id: 'T1', m: true, name: 'Mindestlohn (alle Arbeiter/innen)', l: [2060.00] }
    ] };
  // Gärtner/Landschaftsgärtner und gewerbliche Forstunternehmen (Lohnordnungen 1.3.2026 bis 28.2.2027, Quelle: wko.at)
  PAKETE.gaertner = {
    name: 'Gärtner und Landschaftsgärtner (Arbeiter)',
    hinweis: 'KV Gärtner und Landschaftsgärtner, Arbeiter, Lohnordnung von 1.3.2026 bis 28.2.2027 (Quelle: wko.at): 39 Stunden/Woche, in der Saison ungleich verteilbar (32 bis 48 Stunden, im Schnitt 39). Überstunden 50 %, zwischen 20 und 5 Uhr 100 %, Sonntagsarbeit 100 %, Feiertag nach dem Gesetz. Es zählt nur der höchste Zuschlag. Taggeld auf Baustellen außerhalb des Betriebs: 11,00 € bei mehr als 3 Stunden, 17,50 € bei mehr als 9 Stunden, Übernachtungsgeld 17,00 €. Bei Schlechtwetter wird der begonnene Halbtag bezahlt. Weihnachtsgeld und Urlaubszuschuss je 4,3 Wochenlöhne (im ersten Jahr 3). Pflichtpraktikanten bekommen das Lehrlingseinkommen des 2. Lehrjahres. Einen Teiler für das Lehrlingseinkommen nennt der KV nicht, die App teilt durch 169.',
    pruefen: true,
    werte: {
      diaeten: { modell: 'tag', satz: 0, maxStd: null, minStd: 0, vorschlag: 'anwesenheit', stufen: [{ ab: 3, satz: 11.00 }, { ab: 9, satz: 17.50 }] },
      ueberstunden: { modell: 'monat', wochenStd: 39, tagesGrenze: null, zuschlagPct: 50 },
      stundenlohn: null,
      betriebFrei: 'urlaub',
      zuschlag: { art: 'kv', sa: 0, so: 100, ft: 100 },
      schlechtwetter: true
    }
  };
  LOHNGRUPPEN.gaertner = { stand: '1.3.2026 bis 28.2.2027', stufen: null, teiler: 169, gruppen: [
      { id: 'G1', name: 'Position 1: Obergärtner/in, Greenkeeper/in', l: [18.55] },
      { id: 'G2', name: 'Position 2: Anlagenleiter/in, gewerbliche/r Gärtnermeister/in', l: [17.15] },
      { id: 'G3', name: 'Position 3: 1. Gärtner/in und Kraftwagenlenker/in', l: [16.07] },
      { id: 'G4', name: 'Position 4: 2. Gärtner/in mit Lehrabschluss, ab dem 2. Verwendungsjahr', l: [15.60] },
      { id: 'G5', name: 'Position 5: Gärtner/in mit Lehrabschluss, im 1. Verwendungsjahr', l: [15.28] },
      { id: 'G6', name: 'Position 6: Vorarbeiter/in (qualifizierte Gartenarbeiter/innen ohne Lehrabschluss)', l: [14.82] },
      { id: 'G7', name: 'Position 7: Gartenarbeiter/in ohne Lehrabschluss', l: [14.14] },
      { id: 'G8', name: 'Position 8: Gartenarbeiter/in in den ersten 6 Monaten im Betrieb', l: [13.20] },
      { id: 'L1', m: true, lehrling: true, name: 'Lehrling, 1. Lehrjahr', l: [800.00] },
      { id: 'L2', m: true, lehrling: true, name: 'Lehrling, 2. Lehrjahr', l: [1045.00] },
      { id: 'L3', m: true, lehrling: true, name: 'Lehrling, 3. Lehrjahr', l: [1455.00] }
    ] };
  PAKETE.forst = {
    name: 'Gewerbliche Forstunternehmen (Arbeiter)',
    hinweis: 'KV gewerbliche Forstunternehmen, Arbeiter, von 1.3.2026 bis 28.2.2027 (Quelle: wko.at): 40 Stunden/Woche. Überstunden 50 %, Nacht- und Sonntagsarbeit 100 %, Feiertag nach dem Gesetz. Hinterlegt sind die Zeitlöhne, im Akkord gelten um ein Viertel höhere Sätze. Gerätefahrer- und Partieführerzulage je 1,85 € pro Stunde, Motorsägenpauschale 2,15 € je Festmeter bei eigener Motorsäge, Werkzeugpauschale 8 % des Barlohns. Taggeld bei Dienstreisen mit Quartier: 30,00 € je 24 Stunden (über 5 Stunden ein Drittel, über 8 Stunden zwei Drittel, über 12 Stunden voll), Nächtigungsgeld 17,00 €. Bei Schlechtwetter wird mindestens ein halber Tag bezahlt. Urlaubszuschuss und Weihnachtsgeld je ein Monatslohn (das 173-Fache des Stundenverdienstes), Anspruch erst nach 60 Arbeitstagen. Der KV gilt nicht für land- und forstwirtschaftliche Betriebe nach dem Landarbeitsgesetz.',
    pruefen: true,
    werte: {
      diaeten: { modell: 'tag', satz: 0, maxStd: null, minStd: 0, vorschlag: 'anwesenheit', stufen: [{ ab: 5, satz: 10.00 }, { ab: 8, satz: 20.00 }, { ab: 12, satz: 30.00 }] },
      ueberstunden: { modell: 'monat', wochenStd: 40, tagesGrenze: null, zuschlagPct: 50 },
      stundenlohn: null,
      betriebFrei: 'urlaub',
      zuschlag: { art: 'kv', sa: 0, so: 100, ft: 100 },
      schlechtwetter: true
    }
  };
  LOHNGRUPPEN.forst = { stand: '1.3.2026 bis 28.2.2027', stufen: null, teiler: 173, gruppen: [
      { id: 'F1', name: 'Kategorie 1: Hilfsarbeiter/in', l: [11.92] },
      { id: 'F2', name: 'Kategorie 2: Waldarbeiter/in mit Zweckausbildung', l: [12.22] },
      { id: 'F3', name: 'Kategorie 3: Waldarbeiter/in mit Forstfacharbeiterprüfung', l: [14.08] },
      { id: 'F4', name: 'Kategorie 4: Professionist/in (Mechaniker, Schlosser, Schmied)', l: [14.36] },
      { id: 'F5', name: 'Kategorie 5: Maschinist/in für Holzerntemaschinen (Harvester, Forwarder, Seilkran)', l: [17.55] },
      { id: 'F6', m: true, name: 'Forsttechniker/in', l: [2487.15] },
      { id: 'L1', m: true, lehrling: true, name: 'Lehrling, 1. Lehrjahr', l: [1507.52] },
      { id: 'L2', m: true, lehrling: true, name: 'Lehrling, 2. Lehrjahr', l: [1832.22] },
      { id: 'L3', m: true, lehrling: true, name: 'Lehrling, 3. Lehrjahr', l: [2156.93] }
    ] };
  // Metalltechnische Industrie: einheitliche Mindestlohn- und Mindestgehaltstabelle (Arbeiter und Angestellte), ab 1.11.2025 und 1.11.2026
  PAKETE.metall_ind = {
    name: 'Metalltechnische Industrie (Arbeiter)',
    hinweis: 'KV Metalltechnische Industrie, Arbeiter, Mindestlöhne ab 1.11.2025 und ab 1.11.2026 (Quellen: wko.at, metalltechnischeindustrie.at): 38,5 Stunden/Woche. Überstunden 50 %, die dritte und jede weitere Überstunde am Tag, Überstunden zwischen 20 und 6 Uhr und ab der 51. Wochenstunde 100 %. Sonntagsarbeit 100 %. Überstunden-Grundlohn 1/143 des Monatslohns. Nachtarbeitszulage (22 bis 6 Uhr) und Schichtzulage 3. Schicht 3,754 € je Stunde, 2. Schicht 1,085 €, Schmutz-, Erschwernis- und Gefahrenzulage je 0,741 €, Montagezulage 1,146 €, Vorarbeiterzuschlag 10 %: als Vorschläge bei den Prämien hinterlegt. Aufwandsentschädigung bei Arbeit außer Haus: 21,99 € bei mehr als 5 Stunden, 36,24 € bei mehr als 11 Stunden, 72,41 € mit Nächtigung, Nächtigungsgeld 24,41 €. Urlaubszuschuss und Weihnachtsremuneration je ein Monatsverdienst. Die Gruppe und die Vorrückungsstufe stehen auf deinem Lohnzettel. Gilt nicht für die Gießereiindustrie. Die Sondergruppe I für Meister (M III minus 5 %) ist nicht hinterlegt.',
    pruefen: true,
    werte: {
      diaeten: { modell: 'tag', satz: 0, maxStd: null, minStd: 0, vorschlag: 'anwesenheit', stufen: [{ ab: 5, satz: 21.99 }, { ab: 11, satz: 36.24 }] },
      ueberstunden: { modell: 'monat', wochenStd: 38.5, tagesGrenze: null, zuschlagPct: 50, ueberTeiler: 143 },
      stundenlohn: null,
      betriebFrei: 'urlaub',
      zuschlag: { art: 'kv', sa: 0, so: 100, ft: 100 },
      schlechtwetter: false
    }
  };
  LOHNGRUPPEN.metall_ind = { stand: 'ab 1.11.2025', stufen: ['Grundstufe', 'nach 2 Jahren', 'nach 4 Jahren', 'nach 6 Jahren', 'nach 9 Jahren', 'nach 12 Jahren'], teiler: 167, gruppen: [
      { id: 'IA', m: true, name: 'Beschäftigungsgruppe A: ohne Zweckausbildung, sehr einfache Tätigkeiten', stufen: ['Grundstufe', 'nach 2 Jahren', 'nach 4 Jahren'], l: [2568.80, 2608.44, 2648.08] },
      { id: 'IB', m: true, name: 'Beschäftigungsgruppe B: mit Zweckausbildung, einfache Tätigkeiten', l: [2568.80, 2608.73, 2648.66, 2668.62, 2688.58, 2708.54] },
      { id: 'IC', m: true, name: 'Beschäftigungsgruppe C: nach arbeitsspezifischen Anweisungen, mit längerer Zweckausbildung', l: [2698.59, 2741.24, 2783.89, 2805.23, 2826.57, 2847.91] },
      { id: 'ID', m: true, name: 'Beschäftigungsgruppe D: mit Berufsausbildung (Lehrabschluss)', l: [2947.89, 3001.51, 3055.13, 3081.96, 3108.79, 3135.62] },
      { id: 'IE', m: true, name: 'Beschäftigungsgruppe E: selbständige Tätigkeiten mit zusätzlichen Fachkenntnissen', l: [3396.21, 3458.06, 3519.91, 3550.81, 3581.71, 3612.61] },
      { id: 'IF', m: true, name: 'Beschäftigungsgruppe F: selbständige schwierige Tätigkeiten', l: [3802.93, 3893.31, 3983.69, 4028.89, 4074.09, 4119.29] },
      { id: 'IG', m: true, name: 'Beschäftigungsgruppe G: schwierige, verantwortungsvolle Tätigkeiten, Projektleitung', l: [4354.45, 4492.58, 4630.71, 4699.78, 4768.85, 4837.92] },
      { id: 'IH', m: true, name: 'Beschäftigungsgruppe H: schwierige Tätigkeiten mit beträchtlichem Entscheidungsspielraum', l: [4767.21, 4918.43, 5069.65, 5145.23, 5220.81, 5296.39] },
      { id: 'II', m: true, name: 'Beschäftigungsgruppe I: sehr schwierige Tätigkeiten mit hohem Entscheidungsspielraum', l: [5804.36, 5988.46, 6172.56, 6264.60, 6356.64, 6448.68] },
      { id: 'IJ', m: true, name: 'Beschäftigungsgruppe J: leitende Stellung', l: [6372.64, 6574.97, 6777.30, 6878.45, 6979.60, 7080.75] },
      { id: 'IK', m: true, name: 'Beschäftigungsgruppe K: leitende Stellung mit entscheidendem Einfluss auf das Unternehmen', stufen: ['Grundstufe', 'nach 2 Jahren', 'nach 4 Jahren', 'nach 6 Jahren', 'nach 9 Jahren'], l: [8424.77, 8692.26, 8825.98, 8959.70, 9093.42] },
      { id: 'L1', m: true, lehrling: true, name: 'Lehrling, 1. Lehrjahr', l: [1071.00] },
      { id: 'L2', m: true, lehrling: true, name: 'Lehrling, 2. Lehrjahr', l: [1295.40] },
      { id: 'L3', m: true, lehrling: true, name: 'Lehrling, 3. Lehrjahr', l: [1657.50] },
      { id: 'L4', m: true, lehrling: true, name: 'Lehrling, 4. Lehrjahr', l: [2152.20] }
    ], folgt: [{ ab: '2026-11-01', stand: 'ab 1.11.2026', gruppen: {
      IA: [2622.74, 2662.38, 2702.02], IB: [2622.74, 2662.67, 2702.60, 2722.56, 2742.52, 2762.48], IC: [2755.26, 2797.91, 2840.56, 2861.90, 2883.24, 2904.58], ID: [3009.80, 3063.42, 3117.04, 3143.87, 3170.70, 3197.53], IE: [3467.53, 3529.38, 3591.23, 3622.13, 3653.03, 3683.93], IF: [3882.79, 3973.17, 4063.55, 4108.75, 4153.95, 4199.15], IG: [4445.89, 4584.02, 4722.15, 4791.22, 4860.29, 4929.36], IH: [4867.32, 5018.54, 5169.76, 5245.34, 5320.92, 5396.50], II: [5926.25, 6110.35, 6294.45, 6386.49, 6478.53, 6570.57], IJ: [6506.47, 6708.80, 6911.13, 7012.28, 7113.43, 7214.58], IK: [8601.69, 8869.18, 9002.90, 9136.62, 9270.34], L1: [1093.49], L2: [1322.60], L3: [1692.31], L4: [2197.40] } }] };
  LOHNGRUPPEN.industrie_ang = LOHNGRUPPEN.metall_ind;
  // Chemische Industrie, Papierindustrie, Textilindustrie (Arbeiter), Lohnordnungen 2026 (Quelle: wko.at)
  PAKETE.chemie = {
    name: 'Chemische Industrie (Arbeiter)',
    hinweis: 'KV Chemische Industrie, Arbeiter, Lohnordnung von 1.5.2026 bis 30.4.2027 (Quelle: wko.at): 38 Stunden/Woche, Grundvergütung für Überstunden, Sonn- und Feiertagsstunden 1/165 des Monatsbezugs. Überstunden 50 %, zwischen 20 und 6 Uhr, ab der dritten Überstunde am Tag und ab der 51. Wochenstunde 100 %. Sonntagsarbeit 100 %, Feiertagsarbeit doppeltes Entgelt zusätzlich. Es zählt nur der höchste Zuschlag. Nachmittagsschichtzulage 2,0728 € und Nachtschichtzulage 4,1409 € je Stunde, Vorarbeiter 15 % Zuschlag: als Vorschläge bei den Prämien hinterlegt. Urlaubszuschuss und Weihnachtsremuneration je ein Monatsverdienst.',
    pruefen: true,
    werte: {
      diaeten: { modell: 'aus', satz: 0, maxStd: null, minStd: 0, vorschlag: 'anwesenheit', stufen: [] },
      ueberstunden: { modell: 'monat', wochenStd: 38, tagesGrenze: null, zuschlagPct: 50, ueberTeiler: 165 },
      stundenlohn: null,
      betriebFrei: 'urlaub',
      zuschlag: { art: 'kv', sa: 0, so: 100, ft: 200 },
      schlechtwetter: false
    }
  };
  LOHNGRUPPEN.chemie = { stand: '1.5.2026 bis 30.4.2027', stufen: null, teiler: 165, gruppen: [
      { id: 'C2', m: true, name: 'Kategorie 2: Arbeiten nach kurzer Anweisung', l: [2626.26] },
      { id: 'C2a', m: true, name: 'Kategorie 2a: Arbeiten nach kurzer Anweisung, höhere Komplexität', l: [2735.62] },
      { id: 'C3', m: true, name: 'Kategorie 3: angelernte Arbeiten, in den ersten 6 Monaten', l: [2735.62] },
      { id: 'C4', m: true, name: 'Kategorie 4: angelernte Arbeiten, nach 6 Monaten', l: [2827.96] },
      { id: 'C5', m: true, name: 'Kategorie 5: Maschinenverantwortliche, geprüfte Kesselwärter, qualifizierte Staplerfahrer', l: [3055.51] },
      { id: 'C6', m: true, name: 'Kategorie 6: Professionisten im 1. Jahr im Betrieb, Spezialarbeiter, Chauffeure', l: [3187.48] },
      { id: 'C7', m: true, name: 'Kategorie 7: Professionisten und Spezialarbeiter mit qualifizierten Fachkenntnissen', l: [3482.11] },
      { id: 'C8', m: true, name: 'Kategorie 8: Professionisten und Spezialarbeiter mit hervorragenden Fachkenntnissen', l: [3752.90] },
      { id: 'L1', m: true, lehrling: true, name: 'Lehrling, 1. Lehrjahr', l: [1275.00] },
      { id: 'L2', m: true, lehrling: true, name: 'Lehrling, 2. Lehrjahr', l: [1594.00] },
      { id: 'L3', m: true, lehrling: true, name: 'Lehrling, 3. Lehrjahr', l: [1912.50] },
      { id: 'L4', m: true, lehrling: true, name: 'Lehrling, 4. Lehrjahr', l: [2231.50] }
    ] };
  PAKETE.papier = {
    name: 'Papierindustrie (Arbeiter)',
    hinweis: 'KV Papierindustrie, Arbeiter, Monatslöhne ab 1.5.2026 für Papier-, Zellstoff- und Maschinenkartonfabriken (Quelle: wko.at). In Betrieben mit negativem Ergebnis gelten die neuen Löhne erst ab 1.9. oder 1.11.2026, für Pappenfabriken und Holzschleifereien gibt es eine eigene, niedrigere Tabelle, die nicht hinterlegt ist. Die Regeln stammen aus dem Rahmen-KV in der Fassung 2022: 38 Stunden/Woche (Teiler 165), im durchgehenden Schichtbetrieb 36 Stunden (Teiler 156). Überstunden 50 %, zwischen 20 und 6 Uhr, ab der 11. Arbeitsstunde am Tag und ab der 51. Wochenstunde 100 %. Sonntagsarbeit 100 %, Feiertagsarbeit insgesamt das Dreifache. Nachtarbeitszulage 29,74 € und Nachmittagsschichtzulage 12,33 € je voll geleisteter Schicht: als Vorschläge bei den Prämien hinterlegt. Das Lehrlingseinkommen ist ein Prozentsatz der Lohngruppe 1 (40, 50, 55 und 75,5 %), die App hat daraus die Beträge berechnet. Urlaubszuschuss und Weihnachtsremuneration je ein Monatsverdienst.',
    pruefen: true,
    werte: {
      diaeten: { modell: 'aus', satz: 0, maxStd: null, minStd: 0, vorschlag: 'anwesenheit', stufen: [] },
      ueberstunden: { modell: 'monat', wochenStd: 38, tagesGrenze: null, zuschlagPct: 50, ueberTeiler: 165 },
      stundenlohn: null,
      betriebFrei: 'urlaub',
      zuschlag: { art: 'kv', sa: 0, so: 100, ft: 200 },
      schlechtwetter: false
    }
  };
  LOHNGRUPPEN.papier = { stand: 'ab 1.5.2026', stufen: null, teiler: 165, gruppen: [
      { id: 'PS', m: true, name: 'Spezialarbeiter/in (zum Beispiel Papiermaschinenführer/in)', l: [3407.30] },
      { id: 'P1', m: true, name: 'Lohngruppe 1: Fachkräfte mit Lehrabschluss, selbständig nach allgemeinen Anweisungen', l: [3119.45] },
      { id: 'P2', m: true, name: 'Lohngruppe 2: Fachkräfte mit Lehrabschluss, selbständig nach speziellen Anweisungen', l: [2914.27] },
      { id: 'P3', m: true, name: 'Lohngruppe 3: qualifizierte Tätigkeiten, mehr als 12 Monate Betriebspraxis', l: [2859.35] },
      { id: 'P4', m: true, name: 'Lohngruppe 4: Tätigkeiten mit 3 bis 12 Monaten Betriebspraxis', l: [2732.41] },
      { id: 'P5', m: true, name: 'Lohngruppe 5: Tätigkeiten mit kurzer Betriebspraxis', l: [2627.98] },
      { id: 'P6', m: true, name: 'Lohngruppe 6: Ferialarbeit (höchstens 3 Monate)', l: [2296.05] },
      { id: 'L1', m: true, lehrling: true, name: 'Lehrling, 1. Lehrjahr', l: [1247.78] },
      { id: 'L2', m: true, lehrling: true, name: 'Lehrling, 2. Lehrjahr', l: [1559.73] },
      { id: 'L3', m: true, lehrling: true, name: 'Lehrling, 3. Lehrjahr', l: [1715.70] },
      { id: 'L4', m: true, lehrling: true, name: 'Lehrling, 4. Lehrjahr', l: [2355.18] }
    ] };
  PAKETE.textil = {
    name: 'Textilindustrie (Arbeiter)',
    hinweis: 'KV Textilindustrie, Arbeiter, Lohnordnung ab 1.4.2026 (Quelle: wko.at). Gilt in Wien, Niederösterreich, Burgenland, Oberösterreich, Salzburg, Steiermark und Kärnten, Tirol und Vorarlberg haben eigene Verträge. 38,5 Stunden/Woche, Stundenlohn = Monatslohn durch 167, Überstunden-Grundlohn 1/143. Überstunden von 6 bis 20 Uhr 50 %, von 20 bis 6 Uhr 100 %, ebenso die 11. und 12. Arbeitsstunde am Tag und ab der 51. Wochenstunde. Sonntagsarbeit 100 %, Feiertag nach dem Gesetz. Nachtschicht (22 bis 6 Uhr): 30 % bei ständiger, 20 % bei wechselnder Nachtschicht. Es zählt nur der höchste Zuschlag. Urlaubszuschuss und Weihnachtsremuneration je ein Monatsverdienst. Bei zweijähriger Lehrzeit gilt im 2. Lehrjahr ein höherer Satz (1.246,00 €), der nicht hinterlegt ist.',
    pruefen: true,
    werte: {
      diaeten: { modell: 'aus', satz: 0, maxStd: null, minStd: 0, vorschlag: 'anwesenheit', stufen: [] },
      ueberstunden: { modell: 'monat', wochenStd: 38.5, tagesGrenze: null, zuschlagPct: 50, ueberTeiler: 143 },
      stundenlohn: null,
      betriebFrei: 'urlaub',
      zuschlag: { art: 'kv', sa: 0, so: 100, ft: 100 },
      schlechtwetter: false
    }
  };
  LOHNGRUPPEN.textil = { stand: 'ab 1.4.2026', stufen: null, teiler: 167, gruppen: [
      { id: 'TA', m: true, name: 'Lohngruppe A: einfache Tätigkeiten', l: [2058.00] },
      { id: 'TB', m: true, name: 'Lohngruppe B: Tätigkeiten mit kurzer Zweckausbildung', l: [2090.00] },
      { id: 'TC', m: true, name: 'Lohngruppe C: Tätigkeiten mit längerer Zweckausbildung und Fachkenntnissen', l: [2123.00] },
      { id: 'TD', m: true, name: 'Lohngruppe D: Fachkenntnisse, selbständige Ausführung, Verantwortung', l: [2163.00] },
      { id: 'TE', m: true, name: 'Lohngruppe E: Facharbeiter/innen', l: [2206.00] },
      { id: 'TF', m: true, name: 'Lohngruppe F: Spitzenfacharbeiter/innen', l: [2255.00] },
      { id: 'L1', m: true, lehrling: true, name: 'Lehrling, 1. Lehrjahr', l: [916.00] },
      { id: 'L2', m: true, lehrling: true, name: 'Lehrling, 2. Lehrjahr', l: [1116.00] },
      { id: 'L3', m: true, lehrling: true, name: 'Lehrling, 3. Lehrjahr', l: [1417.00] },
      { id: 'L4', m: true, lehrling: true, name: 'Lehrling, 4. Lehrjahr', l: [1743.00] },
      { id: 'M1', m: true, lehrling: true, name: 'Lehrling, 1. Lehrjahr (Lehrbeginn ab 18 Jahren oder mit Matura)', l: [1124.00] },
      { id: 'M2', m: true, lehrling: true, name: 'Lehrling, 2. Lehrjahr (Lehrbeginn ab 18 Jahren oder mit Matura)', l: [1481.00] },
      { id: 'M3', m: true, lehrling: true, name: 'Lehrling, 3. Lehrjahr (Lehrbeginn ab 18 Jahren oder mit Matura)', l: [1829.00] },
      { id: 'M4', m: true, lehrling: true, name: 'Lehrling, 4. Lehrjahr (Lehrbeginn ab 18 Jahren oder mit Matura)', l: [2108.00] }
    ] };
  // Post AG (KV Neu Teil 2, Gehaltsflyer GPF ab 15.9.2026)
  PAKETE.post = {
    name: 'Post AG (KV Neu Teil 2)',
    hinweis: 'KV Post AG, Angestellte, "KV Neu Teil 2" laut Gehaltsflyer der Gewerkschaft GPF, gültig ab 15.9.2026: Mindestgehalt nach Funktionsgruppe und Dienstjahren, Lehrlinge nach Lehrjahr. Welche Funktionsgruppe für dich gilt, steht im Dienstzettel. Die Tabellen "KV Neu Teil 1" (Gebiet A und B) und die Beamten-Schemata sind nicht hinterlegt. Zuschläge nicht in der Quelle: es gilt das Gesetz (Überstunden 50 %). Private Paketdienste und Kurierdienste laufen unter Güterbeförderung.',
    pruefen: true,
    werte: {
      diaeten: { modell: 'aus', satz: 0, maxStd: null, minStd: 0, vorschlag: 'anwesenheit', stufen: [] },
      ueberstunden: { modell: 'monat', wochenStd: 40, tagesGrenze: null, zuschlagPct: 50 },
      stundenlohn: null,
      betriebFrei: 'urlaub',
      zuschlag: { art: 'kv', sa: 0, so: 0, ft: 100 },
      schlechtwetter: false
    }
  };
  LOHNGRUPPEN.post = { stand: '15.9.2026', stufen: ['bis 5 Dienstjahre', 'über 5 bis 10 Dienstjahre', 'über 10 bis 15 Dienstjahre', 'über 15 bis 20 Dienstjahre', 'über 20 Dienstjahre'], gruppen: [
      { id: 'A0', m: true, name: 'Funktionsgruppe A0', stufen: ['bis 5 Dienstjahre', 'über 5 bis 10 Dienstjahre', 'über 10 bis 15 Dienstjahre', 'über 15 bis 20 Dienstjahre', 'über 20 Dienstjahre'], l: [2061.50, 2098.88, 2144.08, 2186.77, 2237.03] },
      { id: 'A', m: true, name: 'Funktionsgruppe A', stufen: ['bis 5 Dienstjahre', 'über 5 bis 10 Dienstjahre', 'über 10 bis 15 Dienstjahre', 'über 15 bis 20 Dienstjahre', 'über 20 Dienstjahre'], l: [2123.35, 2161.85, 2208.40, 2252.37, 2304.14] },
      { id: 'B1', m: true, name: 'Funktionsgruppe B1', stufen: ['bis 5 Dienstjahre', 'über 5 bis 10 Dienstjahre', 'über 10 bis 15 Dienstjahre', 'über 15 bis 20 Dienstjahre', 'über 20 Dienstjahre'], l: [2123.35, 2161.85, 2208.40, 2252.37, 2304.13] },
      { id: 'B2', m: true, name: 'Funktionsgruppe B2', stufen: ['bis 5 Dienstjahre', 'über 5 bis 10 Dienstjahre', 'über 10 bis 15 Dienstjahre', 'über 15 bis 20 Dienstjahre', 'über 20 Dienstjahre'], l: [2170.11, 2208.40, 2252.37, 2311.90, 2363.64] },
      { id: 'B3', m: true, name: 'Funktionsgruppe B3', stufen: ['bis 5 Dienstjahre', 'über 5 bis 10 Dienstjahre', 'über 10 bis 15 Dienstjahre', 'über 15 bis 20 Dienstjahre', 'über 20 Dienstjahre'], l: [2216.85, 2252.37, 2311.90, 2363.64, 2407.64] },
      { id: 'B4', m: true, name: 'Funktionsgruppe B4', stufen: ['bis 5 Dienstjahre', 'über 5 bis 10 Dienstjahre', 'über 10 bis 15 Dienstjahre', 'über 15 bis 20 Dienstjahre', 'über 20 Dienstjahre'], l: [2216.85, 2252.37, 2311.90, 2363.64, 2407.64] },
      { id: 'B5', m: true, name: 'Funktionsgruppe B5', stufen: ['bis 5 Dienstjahre', 'über 5 bis 10 Dienstjahre', 'über 10 bis 15 Dienstjahre', 'über 15 bis 20 Dienstjahre', 'über 20 Dienstjahre'], l: [2320.74, 2363.64, 2407.64, 2461.97, 2508.54] },
      { id: 'L1', m: true, lehrling: true, name: 'Lehrling, 1. Lehrjahr', l: [1058.84] },
      { id: 'L2', m: true, lehrling: true, name: 'Lehrling, 2. Lehrjahr', l: [1368.80] },
      { id: 'L3', m: true, lehrling: true, name: 'Lehrling, 3. Lehrjahr', l: [1737.70] },
      { id: 'L4', m: true, lehrling: true, name: 'Lehrling, 4. Lehrjahr', l: [1919.10] }
    ] };
  // Angestellte bei Ärzten, Niederösterreich (Mindestgehälter ab 1.1.2026, Ärztekammer NÖ)
  PAKETE.ordination_noe = {
    name: 'Angestellte bei Ärzten, Niederösterreich',
    hinweis: 'KV für Angestellte bei Ärzten in Niederösterreich (Quelle: Ärztekammer NÖ, Mindestgehälter ab 1.1.2026): Mindestgehalt nach Beschäftigungsgruppe und Berufsjahren. Hinterlegt ist nur Niederösterreich, andere Bundesländer haben eigene Tabellen: dort bitte Eigene Werte verwenden. Lehrlinge, Wochenstunden und Zuschläge stehen nicht in der Quelle: es gilt das Gesetz (Überstunden 50 %). Von der Ist-Erhöhung ab 1.7.2026 bleibt dein Ist-Gehalt unberührt, die App meldet nur eine Abweichung unter dem Mindestgehalt.',
    pruefen: true,
    werte: {
      diaeten: { modell: 'aus', satz: 0, maxStd: null, minStd: 0, vorschlag: 'anwesenheit', stufen: [] },
      ueberstunden: { modell: 'monat', wochenStd: 40, tagesGrenze: null, zuschlagPct: 50 },
      stundenlohn: null,
      betriebFrei: 'urlaub',
      zuschlag: { art: 'kv', sa: 0, so: 0, ft: 100 },
      schlechtwetter: false
    }
  };
  LOHNGRUPPEN.ordination_noe = { stand: '1.1.2026', stufen: ['ab dem 1. Berufsjahr', 'ab dem 4. Berufsjahr', 'ab dem 7. Berufsjahr', 'ab dem 11. Berufsjahr', 'ab dem 15. Berufsjahr', 'ab dem 20. Berufsjahr'], gruppen: [
      { id: 'BG1', m: true, name: 'Beschäftigungsgruppe 1: Schreibkräfte, Sekretariat, Beschäftigte ohne medizinische Ausbildung', l: [2138.00, 2175.00, 2193.00, 2226.00, 2256.00, 2287.00] },
      { id: 'BG2', m: true, name: 'Beschäftigungsgruppe 2: Ordinationsassistenz, Pflegehilfe, Heilmasseur, Sanitätshilfsdienst', l: [2174.00, 2254.00, 2338.00, 2429.00, 2515.00, 2610.00] },
      { id: 'BG3', m: true, name: 'Beschäftigungsgruppe 3: Labor- und Röntgenassistenz, Medizinische Fachassistenz', l: [2218.00, 2309.00, 2391.00, 2482.00, 2570.00, 2665.00] },
      { id: 'BG4', m: true, name: 'Beschäftigungsgruppe 4: Gehobener medizinisch-technischer Dienst, Krankenpflege, Hebamme', l: [2286.00, 2372.00, 2458.00, 2532.00, 2610.00, 2695.00] }
    ] };
  // Angestellte bei Ärzten, alle Bundesländer (Quelle: GPA)
  PAKETE.ordination_w = {
    name: 'Angestellte bei Ärzten, Wien',
    hinweis: 'KV für Angestellte bei Ärzten, Wien (Quelle: Gewerkschaft GPA), Mindestgehälter ab 1.6.2026: Mindestgehalt nach Berufsgruppe und Berufsjahren. Lehrlinge nicht in der Quelle. Zuschläge: es gilt das Gesetz (Überstunden 50 %).',
    pruefen: true,
    werte: {
      diaeten: { modell: 'aus', satz: 0, maxStd: null, minStd: 0, vorschlag: 'anwesenheit', stufen: [] },
      ueberstunden: { modell: 'monat', wochenStd: 40, tagesGrenze: null, zuschlagPct: 50 },
      stundenlohn: null,
      betriebFrei: 'urlaub',
      zuschlag: { art: 'kv', sa: 0, so: 0, ft: 100 },
      schlechtwetter: false
    }
  };
  LOHNGRUPPEN.ordination_w = { stand: '1.6.2026', stufen: ['Berufsjahre 1–3', 'Berufsjahre 4–6', 'Berufsjahre 7–9', 'Berufsjahre 10–12', 'Berufsjahre 13–15', 'ab dem 16. Berufsjahr'], teiler: 173, gruppen: [
      { id: 'WA', m: true, name: 'Berufsgruppe A: Schreibkräfte, Sprechstundenhilfen, Sekretariat', stufen: ['Berufsjahre 1–3', 'Berufsjahre 4–6', 'Berufsjahre 7–9', 'Berufsjahre 10–12', 'Berufsjahre 13–15', 'ab dem 16. Berufsjahr'], l: [2198.00, 2315.00, 2423.00, 2533.00, 2647.00, 2755.00] },
      { id: 'WB', m: true, name: 'Berufsgruppe B: Ordinationsassistenz, Pflegeassistenz, Masseur/in', stufen: ['Berufsjahre 1–3', 'Berufsjahre 4–6', 'Berufsjahre 7–9', 'Berufsjahre 10–12', 'Berufsjahre 13–15', 'ab dem 16. Berufsjahr'], l: [2268.00, 2399.00, 2516.00, 2633.00, 2725.00, 2840.00] },
      { id: 'WC', m: true, name: 'Berufsgruppe C: Medizinische Fachassistenz, Pflegefachassistenz, medizinisch-technischer Fachdienst', stufen: ['Berufsjahre 1–3', 'Berufsjahre 4–6', 'Berufsjahre 7–9', 'Berufsjahre 10–12', 'Berufsjahre 13–15', 'ab dem 16. Berufsjahr'], l: [2411.00, 2555.00, 2702.00, 2850.00, 3001.00, 3146.00] },
      { id: 'WD', m: true, name: 'Berufsgruppe D: Gehobener medizinisch-technischer Dienst, diplomierte Krankenpflege, Hebamme', stufen: ['Berufsjahre 1–3', 'Berufsjahre 4–6', 'Berufsjahre 7–9', 'Berufsjahre 10–12', 'Berufsjahre 13–15', 'ab dem 16. Berufsjahr'], l: [2502.00, 2677.00, 2846.00, 3014.00, 3185.00, 3360.00] },
      { id: 'WE', m: true, name: 'Berufsgruppe E: Medizinische Masseur/in, Heilmasseur/in', stufen: ['Berufsjahr 1', 'Berufsjahre 2–6', 'ab dem 7. Berufsjahr'], l: [2198.00, 2344.00, 2359.00] }
    ] };
  PAKETE.ordination_sbg = {
    name: 'Angestellte bei Ärzten, Salzburg',
    hinweis: 'KV für Angestellte bei Ärzten, Salzburg (Quelle: Gewerkschaft GPA), Mindestgehälter ab 1.1.2026: Mindestgehalt nach Berufsgruppe und Berufsjahren. Lehrlinge nicht in der Quelle. Zuschläge: es gilt das Gesetz (Überstunden 50 %).',
    pruefen: true,
    werte: {
      diaeten: { modell: 'aus', satz: 0, maxStd: null, minStd: 0, vorschlag: 'anwesenheit', stufen: [] },
      ueberstunden: { modell: 'monat', wochenStd: 40, tagesGrenze: null, zuschlagPct: 50 },
      stundenlohn: null,
      betriebFrei: 'urlaub',
      zuschlag: { art: 'kv', sa: 0, so: 0, ft: 100 },
      schlechtwetter: false
    }
  };
  LOHNGRUPPEN.ordination_sbg = { stand: '1.1.2026', stufen: ['Berufsjahre 1–4', 'Berufsjahre 5–8', 'Berufsjahre 9–12', 'ab dem 13. Berufsjahr'], teiler: 173, gruppen: [
      { id: 'S1', m: true, name: 'Berufsgruppe 1: Schreibkräfte, Sprechstundenhilfen, Sekretariat', stufen: ['Berufsjahre 1–4', 'Berufsjahre 5–8', 'Berufsjahre 9–12', 'ab dem 13. Berufsjahr'], l: [2160.00, 2217.00, 2272.00, 2330.00] },
      { id: 'S2', m: true, name: 'Berufsgruppe 2: Ordinationsassistenz, Pflegeassistenz, Masseur/in', stufen: ['Berufsjahre 1–4', 'Berufsjahre 5–8', 'Berufsjahre 9–12', 'ab dem 13. Berufsjahr'], l: [2233.00, 2321.00, 2413.00, 2509.00] },
      { id: 'S3', m: true, name: 'Berufsgruppe 3: Medizinische Fachassistenz, Pflegefachassistenz, medizinisch-technischer Fachdienst; Gehobener medizinisch-technischer Dienst, diplomierte Krankenpflege, Hebamme', stufen: ['Berufsjahre 1–4', 'Berufsjahre 5–8', 'Berufsjahre 9–12', 'ab dem 13. Berufsjahr'], l: [2371.00, 2492.00, 2616.00, 2744.00] }
    ] };
  PAKETE.ordination_t = {
    name: 'Angestellte bei Ärzten, Tirol',
    hinweis: 'KV für Angestellte bei Ärzten, Tirol (Quelle: Gewerkschaft GPA), Mindestgehälter ab 1.1.2026: Mindestgehalt nach Berufsgruppe und Berufsjahren. Lehrlinge nicht in der Quelle. Zuschläge: es gilt das Gesetz (Überstunden 50 %).',
    pruefen: true,
    werte: {
      diaeten: { modell: 'aus', satz: 0, maxStd: null, minStd: 0, vorschlag: 'anwesenheit', stufen: [] },
      ueberstunden: { modell: 'monat', wochenStd: 40, tagesGrenze: null, zuschlagPct: 50 },
      stundenlohn: null,
      betriebFrei: 'urlaub',
      zuschlag: { art: 'kv', sa: 0, so: 0, ft: 100 },
      schlechtwetter: false
    }
  };
  LOHNGRUPPEN.ordination_t = { stand: '1.1.2026', stufen: ['Berufsjahr 1', 'Berufsjahr 2', 'Berufsjahr 3', 'Berufsjahr 4', 'Berufsjahr 5', 'Berufsjahr 6', 'Berufsjahr 7', 'Berufsjahr 8', 'Berufsjahr 9', 'Berufsjahr 10', 'Berufsjahr 11', 'Berufsjahr 12', 'Berufsjahr 13', 'Berufsjahr 14', 'Berufsjahr 15', 'Berufsjahr 16', 'Berufsjahr 17', 'Berufsjahr 18', 'Berufsjahr 19', 'Berufsjahr 20', 'Berufsjahr 21', 'Berufsjahr 22', 'Berufsjahr 23', 'Berufsjahr 24', 'Berufsjahr 25'], teiler: 173, gruppen: [
      { id: 'T1', m: true, name: 'Berufsgruppe 1: Schreibkräfte, Sprechstundenhilfen, Sekretariat', stufen: ['Berufsjahr 1', 'Berufsjahr 2', 'Berufsjahr 3', 'Berufsjahr 4', 'Berufsjahr 5', 'Berufsjahr 6', 'Berufsjahr 7', 'Berufsjahr 8', 'Berufsjahr 9', 'Berufsjahr 10', 'Berufsjahr 11', 'Berufsjahr 12', 'Berufsjahr 13', 'Berufsjahr 14', 'Berufsjahr 15', 'Berufsjahr 16', 'Berufsjahr 17', 'Berufsjahr 18', 'Berufsjahr 19', 'Berufsjahr 20', 'Berufsjahr 21', 'Berufsjahr 22', 'Berufsjahr 23', 'Berufsjahr 24', 'Berufsjahr 25'], l: [2082.00, 2099.00, 2122.00, 2135.00, 2153.00, 2171.00, 2188.00, 2205.00, 2225.00, 2243.00, 2258.00, 2275.00, 2295.00, 2310.00, 2329.00, 2348.00, 2368.00, 2384.00, 2403.00, 2423.00, 2443.00, 2464.00, 2485.00, 2508.00, 2529.00] },
      { id: 'T2', m: true, name: 'Berufsgruppe 2: Ordinationsassistenz, Pflegeassistenz, Masseur/in', stufen: ['Berufsjahr 1', 'Berufsjahr 2', 'Berufsjahr 3', 'Berufsjahr 4', 'Berufsjahr 5', 'Berufsjahr 6', 'Berufsjahr 7', 'Berufsjahr 8', 'Berufsjahr 9', 'Berufsjahr 10', 'Berufsjahr 11', 'Berufsjahr 12', 'Berufsjahr 13', 'Berufsjahr 14', 'Berufsjahr 15', 'Berufsjahr 16', 'Berufsjahr 17', 'Berufsjahr 18', 'Berufsjahr 19', 'Berufsjahr 20', 'Berufsjahr 21', 'Berufsjahr 22', 'Berufsjahr 23', 'Berufsjahr 24', 'Berufsjahr 25'], l: [2146.00, 2164.00, 2187.00, 2199.00, 2218.00, 2234.00, 2252.00, 2270.00, 2289.00, 2306.00, 2323.00, 2340.00, 2358.00, 2374.00, 2395.00, 2412.00, 2431.00, 2450.00, 2467.00, 2486.00, 2508.00, 2527.00, 2550.00, 2571.00, 2594.00] },
      { id: 'T3', m: true, name: 'Berufsgruppe 3: Medizinische Fachassistenz, medizinisch-technischer Fachdienst', stufen: ['Berufsjahr 1', 'Berufsjahr 2', 'Berufsjahr 3', 'Berufsjahr 4', 'Berufsjahr 5', 'Berufsjahr 6', 'Berufsjahr 7', 'Berufsjahr 8', 'Berufsjahr 9', 'Berufsjahr 10', 'Berufsjahr 11', 'Berufsjahr 12', 'Berufsjahr 13', 'Berufsjahr 14', 'Berufsjahr 15', 'Berufsjahr 16', 'Berufsjahr 17', 'Berufsjahr 18', 'Berufsjahr 19', 'Berufsjahr 20', 'Berufsjahr 21', 'Berufsjahr 22', 'Berufsjahr 23', 'Berufsjahr 24', 'Berufsjahr 25'], l: [2275.00, 2296.00, 2319.00, 2342.00, 2363.00, 2383.00, 2408.00, 2429.00, 2450.00, 2475.00, 2497.00, 2521.00, 2542.00, 2566.00, 2588.00, 2613.00, 2638.00, 2661.00, 2685.00, 2709.00, 2736.00, 2761.00, 2786.00, 2814.00, 2841.00] },
      { id: 'T4', m: true, name: 'Berufsgruppe 4: Gehobener medizinisch-technischer Dienst, diplomierte Krankenpflege, Hebamme', stufen: ['Berufsjahr 1', 'Berufsjahr 2', 'Berufsjahr 3', 'Berufsjahr 4', 'Berufsjahr 5', 'Berufsjahr 6', 'Berufsjahr 7', 'Berufsjahr 8', 'Berufsjahr 9', 'Berufsjahr 10', 'Berufsjahr 11', 'Berufsjahr 12', 'Berufsjahr 13', 'Berufsjahr 14', 'Berufsjahr 15', 'Berufsjahr 16', 'Berufsjahr 17', 'Berufsjahr 18', 'Berufsjahr 19', 'Berufsjahr 20', 'Berufsjahr 21', 'Berufsjahr 22', 'Berufsjahr 23', 'Berufsjahr 24', 'Berufsjahr 25'], l: [2340.00, 2363.00, 2391.00, 2414.00, 2437.00, 2466.00, 2490.00, 2515.00, 2542.00, 2567.00, 2592.00, 2618.00, 2644.00, 2670.00, 2695.00, 2720.00, 2747.00, 2770.00, 2796.00, 2822.00, 2849.00, 2876.00, 2904.00, 2932.00, 2962.00] }
    ] };
  PAKETE.ordination_vbg = {
    name: 'Angestellte bei Ärzten, Vorarlberg',
    hinweis: 'KV für Angestellte bei Ärzten, Vorarlberg (Quelle: Gewerkschaft GPA), Mindestgehälter ab 1.1.2026: Mindestgehalt nach Berufsgruppe und Berufsjahren. Überstunden mit Teiler 174: 50 %, nachts (22 bis 6 Uhr) und an Sonn- und Feiertagen 100 %. Lehrlinge nicht in der Quelle.',
    pruefen: true,
    werte: {
      diaeten: { modell: 'aus', satz: 0, maxStd: null, minStd: 0, vorschlag: 'anwesenheit', stufen: [] },
      ueberstunden: { modell: 'monat', wochenStd: 40, tagesGrenze: null, zuschlagPct: 50 },
      stundenlohn: null,
      betriebFrei: 'urlaub',
      zuschlag: { art: 'kv', sa: 0, so: 0, ft: 100 },
      schlechtwetter: false
    }
  };
  LOHNGRUPPEN.ordination_vbg = { stand: '1.1.2026', stufen: ['Berufsjahre 1–3', 'Berufsjahre 4–6', 'Berufsjahre 7–9', 'Berufsjahre 10–12'], teiler: 174, gruppen: [
      { id: 'VA', m: true, name: 'Berufsgruppe A: Angestellte ohne Fachkenntnisse', stufen: ['Berufsjahre 1–3', 'Berufsjahre 4–6', 'Berufsjahre 7–9', 'Berufsjahre 10–12'], l: [2073.00, 2152.00, 2260.00, 2394.00] },
      { id: 'VB', m: true, name: 'Berufsgruppe B: Ordinationsassistenz, Sekretariat', stufen: ['Berufsjahre 1–3', 'Berufsjahre 4–6', 'Berufsjahre 7–9', 'Berufsjahre 10–12'], l: [2149.00, 2263.00, 2394.00, 2517.00] },
      { id: 'VC', m: true, name: 'Berufsgruppe C: Gehobener medizinisch-technischer Dienst, diplomierte Krankenpflege, Hebamme', stufen: ['Berufsjahre 1–3', 'Berufsjahre 4–6', 'Berufsjahre 7–9', 'Berufsjahre 10–12'], l: [2301.00, 2484.00, 2686.00, 2891.00] }
    ] };
  PAKETE.ordination_ktn = {
    name: 'Angestellte bei Ärzten, Kärnten',
    hinweis: 'KV für Angestellte bei Ärzten, Kärnten (Quelle: Gewerkschaft GPA), Mindestgehälter ab 1.7.2026: Mindestgehalt nach Berufsgruppe und Berufsjahren. Die Stände ab 1.1.2027 und 1.7.2027 sind hinterlegt. Lehrlinge nicht in der Quelle. Zuschläge: es gilt das Gesetz (Überstunden 50 %).',
    pruefen: true,
    werte: {
      diaeten: { modell: 'aus', satz: 0, maxStd: null, minStd: 0, vorschlag: 'anwesenheit', stufen: [] },
      ueberstunden: { modell: 'monat', wochenStd: 40, tagesGrenze: null, zuschlagPct: 50 },
      stundenlohn: null,
      betriebFrei: 'urlaub',
      zuschlag: { art: 'kv', sa: 0, so: 0, ft: 100 },
      schlechtwetter: false
    }
  };
  LOHNGRUPPEN.ordination_ktn = { stand: '1.7.2026', stufen: ['Berufsjahre 1–2', 'Berufsjahre 3–4', 'Berufsjahre 5–6', 'Berufsjahre 7–8', 'Berufsjahre 9–10', 'Berufsjahre 11–12', 'ab dem 13. Berufsjahr'], teiler: 172, gruppen: [
      { id: 'K1', m: true, name: 'Berufsgruppe 1: Schreibkräfte, Sprechstundenhilfen, Sekretariat', stufen: ['Berufsjahre 1–2', 'Berufsjahre 3–4', 'Berufsjahre 5–6', 'Berufsjahre 7–8', 'Berufsjahre 9–10', 'Berufsjahre 11–12', 'ab dem 13. Berufsjahr'], l: [2180.00, 2243.00, 2307.00, 2370.00, 2435.00, 2499.00, 2562.00] },
      { id: 'K2', m: true, name: 'Berufsgruppe 2: Ordinationsassistenz, Pflegeassistenz, Masseur/in', stufen: ['Berufsjahre 1–2', 'Berufsjahre 3–4', 'Berufsjahre 5–6', 'Berufsjahre 7–8', 'Berufsjahre 9–10', 'Berufsjahre 11–12', 'ab dem 13. Berufsjahr'], l: [2243.00, 2307.00, 2370.00, 2435.00, 2499.00, 2562.00, 2627.00] },
      { id: 'K3', m: true, name: 'Berufsgruppe 3: Medizinische Fachassistenz, Pflegefachassistenz, medizinisch-technischer Fachdienst; Gehobener medizinisch-technischer Dienst, diplomierte Krankenpflege, Hebamme', stufen: ['Berufsjahre 1–2', 'Berufsjahre 3–4', 'Berufsjahre 5–6', 'Berufsjahre 7–8', 'Berufsjahre 9–10', 'Berufsjahre 11–12', 'ab dem 13. Berufsjahr'], l: [2370.00, 2435.00, 2499.00, 2562.00, 2627.00, 2755.00, 2819.00] }
    ], folgt: [{ ab: '2027-01-01', stand: 'ab 1.1.2027', gruppen: {K1: [2330.00, 2393.00, 2457.00, 2520.00, 2585.00, 2649.00, 2712.00], K2: [2393.00, 2457.00, 2520.00, 2585.00, 2649.00, 2712.00, 2777.00], K3: [2520.00, 2585.00, 2649.00, 2712.00, 2777.00, 2905.00, 2969.00]} }, { ab: '2027-07-01', stand: 'ab 1.7.2027', gruppen: {K1: [2480.00, 2543.00, 2607.00, 2670.00, 2735.00, 2799.00, 2862.00], K2: [2543.00, 2607.00, 2670.00, 2735.00, 2799.00, 2862.00, 2927.00], K3: [2670.00, 2735.00, 2799.00, 2862.00, 2927.00, 3055.00, 3119.00]} }] };
  PAKETE.ordination_ooe = {
    name: 'Angestellte bei Ärzten, Oberösterreich',
    hinweis: 'KV für Angestellte bei Ärzten, Oberösterreich (Quelle: Gewerkschaft GPA), Mindestgehälter ab 1.2.2026: Mindestgehalt nach Berufsgruppe und Berufsjahren. Überstunden und Mehrarbeit mit Teiler 165: 50 %, nachts (20 bis 6 Uhr) und an Sonn- und Feiertagen 100 %. Lehrlinge: kaufmännische Lehrlinge laut Tabelle.',
    pruefen: true,
    werte: {
      diaeten: { modell: 'aus', satz: 0, maxStd: null, minStd: 0, vorschlag: 'anwesenheit', stufen: [] },
      ueberstunden: { modell: 'monat', wochenStd: 40, tagesGrenze: null, zuschlagPct: 50 },
      stundenlohn: null,
      betriebFrei: 'urlaub',
      zuschlag: { art: 'kv', sa: 0, so: 0, ft: 100 },
      schlechtwetter: false
    }
  };
  LOHNGRUPPEN.ordination_ooe = { stand: '1.2.2026', stufen: ['ab dem 1. Berufsjahr', 'ab dem 3. Berufsjahr', 'ab dem 5. Berufsjahr', 'ab dem 7. Berufsjahr', 'ab dem 9. Berufsjahr', 'ab dem 11. Berufsjahr', 'ab dem 13. Berufsjahr', 'ab dem 15. Berufsjahr', 'ab dem 17. Berufsjahr', 'ab dem 19. Berufsjahr', 'ab dem 21. Berufsjahr'], teiler: 165, gruppen: [
      { id: 'O1', m: true, name: 'Berufsgruppe 1: Angestellte ohne Fachkenntnisse', stufen: ['Berufsjahr 1'], l: [2079.00] },
      { id: 'O2', m: true, name: 'Berufsgruppe 2: Ordinationsassistenz, Pflegeassistenz, Masseur/in', stufen: ['ab dem 1. Berufsjahr', 'ab dem 3. Berufsjahr', 'ab dem 5. Berufsjahr', 'ab dem 7. Berufsjahr', 'ab dem 9. Berufsjahr', 'ab dem 11. Berufsjahr', 'ab dem 13. Berufsjahr', 'ab dem 15. Berufsjahr', 'ab dem 17. Berufsjahr', 'ab dem 19. Berufsjahr', 'ab dem 21. Berufsjahr'], l: [2153.50, 2242.00, 2334.50, 2424.00, 2519.00, 2609.00, 2655.50, 2702.50, 2743.00, 2789.50, 2831.00] },
      { id: 'O3', m: true, name: 'Berufsgruppe 3: Gehobener medizinisch-technischer Dienst, diplomierte Krankenpflege, Hebamme', stufen: ['ab dem 1. Berufsjahr', 'ab dem 3. Berufsjahr', 'ab dem 5. Berufsjahr', 'ab dem 7. Berufsjahr', 'ab dem 9. Berufsjahr', 'ab dem 11. Berufsjahr', 'ab dem 13. Berufsjahr', 'ab dem 15. Berufsjahr', 'ab dem 17. Berufsjahr', 'ab dem 19. Berufsjahr', 'ab dem 21. Berufsjahr'], l: [2271.50, 2377.50, 2482.00, 2591.50, 2694.50, 2800.50, 2852.50, 2906.00, 2961.00, 3016.00, 3069.00] },
      { id: 'OL1', m: true, lehrling: true, name: 'Lehrling, 1. Lehrjahr', l: [932.50] },
      { id: 'OL2', m: true, lehrling: true, name: 'Lehrling, 2. Lehrjahr', l: [1250.50] },
      { id: 'OL3', m: true, lehrling: true, name: 'Lehrling, 3. Lehrjahr', l: [1534.00] }
    ] };
  PAKETE.ordination_bgld = {
    name: 'Angestellte bei Ärzten, Burgenland',
    hinweis: 'KV für Angestellte bei Ärzten, Burgenland (Quelle: Gewerkschaft GPA), Mindestgehälter ab 1.1.2026: Mindestgehalt nach Berufsgruppe und Berufsjahren. Lehrlinge nicht in der Quelle. Zuschläge: es gilt das Gesetz (Überstunden 50 %).',
    pruefen: true,
    werte: {
      diaeten: { modell: 'aus', satz: 0, maxStd: null, minStd: 0, vorschlag: 'anwesenheit', stufen: [] },
      ueberstunden: { modell: 'monat', wochenStd: 40, tagesGrenze: null, zuschlagPct: 50 },
      stundenlohn: null,
      betriebFrei: 'urlaub',
      zuschlag: { art: 'kv', sa: 0, so: 0, ft: 100 },
      schlechtwetter: false
    }
  };
  LOHNGRUPPEN.ordination_bgld = { stand: '1.1.2026', stufen: ['Berufsjahr 1', 'Berufsjahr 2', 'Berufsjahr 3', 'Berufsjahr 4', 'Berufsjahr 5', 'Berufsjahr 6', 'Berufsjahr 7', 'Berufsjahr 8', 'Berufsjahr 9', 'Berufsjahr 10', 'Berufsjahr 11', 'Berufsjahr 12', 'Berufsjahr 13', 'Berufsjahr 14', 'Berufsjahr 15', 'Berufsjahr 16', 'Berufsjahr 17', 'Berufsjahr 18', 'Berufsjahr 19', 'Berufsjahr 20', 'Berufsjahr 25'], teiler: 173, gruppen: [
      { id: 'B1', m: true, name: 'Berufsgruppe 1: Angestellte ohne Fachkenntnisse', stufen: ['Berufsjahr 1', 'Berufsjahr 2', 'Berufsjahr 3', 'Berufsjahr 4', 'Berufsjahr 5', 'Berufsjahr 6', 'Berufsjahr 7', 'Berufsjahr 8', 'Berufsjahr 9', 'Berufsjahr 10', 'Berufsjahr 11', 'Berufsjahr 12', 'Berufsjahr 13', 'Berufsjahr 14', 'Berufsjahr 15', 'Berufsjahr 16'], l: [1959.00, 1968.00, 1974.00, 1982.00, 1990.00, 1995.00, 2003.00, 2010.00, 2016.00, 2025.00, 2032.00, 2045.00, 2058.00, 2073.00, 2087.00, 2101.00] },
      { id: 'B2', m: true, name: 'Berufsgruppe 2: Ordinationsassistenz, Pflegeassistenz, Masseur/in', stufen: ['Berufsjahr 1', 'Berufsjahr 2', 'Berufsjahr 3', 'Berufsjahr 4', 'Berufsjahr 5', 'Berufsjahr 6', 'Berufsjahr 7', 'Berufsjahr 8', 'Berufsjahr 9', 'Berufsjahr 10', 'Berufsjahr 11', 'Berufsjahr 12', 'Berufsjahr 13', 'Berufsjahr 14', 'Berufsjahr 15', 'Berufsjahr 16', 'Berufsjahr 17', 'Berufsjahr 18', 'Berufsjahr 19', 'Berufsjahr 20', 'Berufsjahr 25'], l: [2027.00, 2040.00, 2050.00, 2062.00, 2071.00, 2081.00, 2095.00, 2103.00, 2115.00, 2125.00, 2137.00, 2143.00, 2150.00, 2158.00, 2164.00, 2172.00, 2179.00, 2185.00, 2192.00, 2199.00, 2207.00] },
      { id: 'B3', m: true, name: 'Berufsgruppe 3: Medizinische Fachassistenz, medizinisch-technischer Fachdienst, Heilmasseur/in', stufen: ['Berufsjahr 1', 'Berufsjahr 2', 'Berufsjahr 3', 'Berufsjahr 4', 'Berufsjahr 5', 'Berufsjahr 6', 'Berufsjahr 7', 'Berufsjahr 8', 'Berufsjahr 9', 'Berufsjahr 10', 'Berufsjahr 11', 'Berufsjahr 12', 'Berufsjahr 13', 'Berufsjahr 14', 'Berufsjahr 15', 'Berufsjahr 16', 'Berufsjahr 17', 'Berufsjahr 18', 'Berufsjahr 19', 'Berufsjahr 20', 'Berufsjahr 25'], l: [2096.00, 2109.00, 2119.00, 2130.00, 2140.00, 2152.00, 2162.00, 2173.00, 2184.00, 2195.00, 2205.00, 2217.00, 2228.00, 2238.00, 2249.00, 2260.00, 2271.00, 2282.00, 2292.00, 2304.00, 2314.00] },
      { id: 'B4', m: true, name: 'Berufsgruppe 4: Gehobener medizinisch-technischer Dienst, diplomierte Krankenpflege, Hebamme', stufen: ['Berufsjahr 1', 'Berufsjahr 2', 'Berufsjahr 3', 'Berufsjahr 4', 'Berufsjahr 5', 'Berufsjahr 6', 'Berufsjahr 7', 'Berufsjahr 8', 'Berufsjahr 9', 'Berufsjahr 10', 'Berufsjahr 11', 'Berufsjahr 12', 'Berufsjahr 13', 'Berufsjahr 14', 'Berufsjahr 15', 'Berufsjahr 16', 'Berufsjahr 17', 'Berufsjahr 18', 'Berufsjahr 19', 'Berufsjahr 20', 'Berufsjahr 25'], l: [2165.00, 2179.00, 2192.00, 2206.00, 2219.00, 2233.00, 2246.00, 2259.00, 2272.00, 2285.00, 2300.00, 2314.00, 2328.00, 2341.00, 2356.00, 2370.00, 2384.00, 2399.00, 2414.00, 2427.00, 2441.00] },
      { id: 'B5', m: true, name: 'Berufsgruppe 5: wie Gruppe 4, mit Bakkalaureat', stufen: ['Berufsjahr 1', 'Berufsjahr 2', 'Berufsjahr 3', 'Berufsjahr 4', 'Berufsjahr 5', 'Berufsjahr 6', 'Berufsjahr 7', 'Berufsjahr 8', 'Berufsjahr 9', 'Berufsjahr 10', 'Berufsjahr 11', 'Berufsjahr 12', 'Berufsjahr 13', 'Berufsjahr 14', 'Berufsjahr 15', 'Berufsjahr 16', 'Berufsjahr 17', 'Berufsjahr 18', 'Berufsjahr 19', 'Berufsjahr 20', 'Berufsjahr 25'], l: [2417.00, 2433.00, 2448.00, 2463.00, 2480.00, 2495.00, 2510.00, 2525.00, 2542.00, 2557.00, 2572.00, 2588.00, 2604.00, 2619.00, 2635.00, 2650.00, 2666.00, 2682.00, 2697.00, 2712.00, 2728.00] }
    ] };
  PAKETE.ordination_stmk = {
    name: 'Angestellte bei Ärzten, Steiermark',
    hinweis: 'KV für Angestellte bei Ärzten, Steiermark (Quelle: Gewerkschaft GPA), Mindestgehälter ab 1.12.2025: Mindestgehalt nach Berufsgruppe und Berufsjahren. Hinterlegt ist der Stand 1.12.2025, der Stand für 2026 war nicht auffindbar. Normalarbeitszeit 38,5 Stunden, Überstunden mit Teiler 167. Lehrlinge nicht in der Quelle. Zuschläge: es gilt das Gesetz (Überstunden 50 %).',
    pruefen: true,
    werte: {
      diaeten: { modell: 'aus', satz: 0, maxStd: null, minStd: 0, vorschlag: 'anwesenheit', stufen: [] },
      ueberstunden: { modell: 'monat', wochenStd: 38.5, tagesGrenze: null, zuschlagPct: 50 },
      stundenlohn: null,
      betriebFrei: 'urlaub',
      zuschlag: { art: 'kv', sa: 0, so: 0, ft: 100 },
      schlechtwetter: false
    }
  };
  LOHNGRUPPEN.ordination_stmk = { stand: '1.12.2025', stufen: ['Berufsjahr 1', 'Berufsjahr 2', 'Berufsjahr 3', 'Berufsjahr 4', 'Berufsjahr 5', 'Berufsjahr 6', 'Berufsjahr 7', 'Berufsjahr 8', 'Berufsjahr 9', 'Berufsjahr 10', 'Berufsjahr 11', 'Berufsjahr 12', 'Berufsjahr 13', 'Berufsjahr 14', 'Berufsjahr 15', 'Berufsjahr 16'], teiler: 167, gruppen: [
      { id: 'M0', m: true, name: 'Ausbildungsstufe: Angestellte in Ausbildung zum Assistenzberuf', stufen: ['Berufsjahr 1', 'Berufsjahr 2', 'Berufsjahr 3', 'Berufsjahr 4', 'Berufsjahr 5', 'Berufsjahr 6', 'Berufsjahr 7', 'Berufsjahr 8', 'Berufsjahr 9', 'Berufsjahr 10', 'Berufsjahr 11', 'Berufsjahr 12', 'Berufsjahr 13', 'Berufsjahr 14', 'Berufsjahr 15', 'Berufsjahr 16'], l: [1600.00, 1618.00, 1633.00, 1639.00, 1642.00, 1644.00, 1646.00, 1648.00, 1672.00, 1695.00, 1723.00, 1762.00, 1803.00, 1843.00, 1872.00, 1901.00] },
      { id: 'M1', m: true, name: 'Berufsgruppe 1: Schreibkräfte, Sprechstundenhilfen, Sekretariat; Ordinationsassistenz, Pflegeassistenz, Masseur/in', stufen: ['Berufsjahr 1', 'Berufsjahr 2', 'Berufsjahr 3', 'Berufsjahr 4', 'Berufsjahr 5', 'Berufsjahr 6', 'Berufsjahr 7', 'Berufsjahr 8', 'Berufsjahr 9', 'Berufsjahr 10', 'Berufsjahr 11', 'Berufsjahr 12', 'Berufsjahr 13', 'Berufsjahr 14', 'Berufsjahr 15', 'Berufsjahr 16'], l: [1811.00, 1820.00, 1826.00, 1835.00, 1842.00, 1849.00, 1856.00, 1864.00, 1873.00, 1879.00, 1886.00, 1893.00, 1914.00, 1957.00, 2000.00, 2033.00] },
      { id: 'M2', m: true, name: 'Berufsgruppe 2: Medizinische Fachassistenz, Pflegefachassistenz, medizinisch-technischer Fachdienst; Heilmasseur/in', stufen: ['Berufsjahr 1', 'Berufsjahr 2', 'Berufsjahr 3', 'Berufsjahr 4', 'Berufsjahr 5', 'Berufsjahr 6', 'Berufsjahr 7', 'Berufsjahr 8', 'Berufsjahr 9', 'Berufsjahr 10', 'Berufsjahr 11', 'Berufsjahr 12', 'Berufsjahr 13', 'Berufsjahr 14', 'Berufsjahr 15', 'Berufsjahr 16'], l: [1853.00, 1861.00, 1870.00, 1878.00, 1885.00, 1891.00, 1902.00, 1910.00, 1917.00, 1925.00, 1932.00, 1941.00, 1949.00, 1964.00, 2006.00, 2051.00] },
      { id: 'M3', m: true, name: 'Berufsgruppe 3: Gehobener medizinisch-technischer Dienst, diplomierte Krankenpflege, Hebamme', stufen: ['Berufsjahr 1', 'Berufsjahr 2', 'Berufsjahr 3', 'Berufsjahr 4', 'Berufsjahr 5', 'Berufsjahr 6', 'Berufsjahr 7', 'Berufsjahr 8', 'Berufsjahr 9', 'Berufsjahr 10', 'Berufsjahr 11', 'Berufsjahr 12', 'Berufsjahr 13', 'Berufsjahr 14', 'Berufsjahr 15', 'Berufsjahr 16'], l: [1886.00, 1895.00, 1906.00, 1914.00, 1923.00, 1930.00, 1937.00, 1944.00, 1951.00, 1964.00, 2007.00, 2067.00, 2142.00, 2219.00, 2288.00, 2367.00] }
    ] };
  // Zahntechnikergewerbe (Lohn-/Gehaltsordnung ab 1.1.2026, Quelle: wko.at)
  PAKETE.zahntechnik = {
    name: 'Zahntechnikergewerbe (Arbeiter und Angestellte)',
    hinweis: 'KV Zahntechnikergewerbe, Arbeiter und Angestellte, Lohn- und Gehaltsordnung ab 1.1.2026 (Quelle: wko.at): Mindestlöhne und Mindestgehälter als Monatsbeträge, Lehrlinge nach Lehrjahr. Wochenstunden (hier 40) und Teiler stehen nicht in der Quelle: bitte mit dem Dienstzettel vergleichen. Die Zulage für Nacht- und Sonntagsarbeit (3,82 € je angefangene Stunde) ist als Prämie vorgeschlagen. Zuschläge sonst: es gilt das Gesetz (Überstunden 50 %).',
    pruefen: true,
    werte: {
      diaeten: { modell: 'aus', satz: 0, maxStd: null, minStd: 0, vorschlag: 'anwesenheit', stufen: [] },
      ueberstunden: { modell: 'monat', wochenStd: 40, tagesGrenze: null, zuschlagPct: 50 },
      stundenlohn: null,
      betriebFrei: 'urlaub',
      zuschlag: { art: 'kv', sa: 0, so: 0, ft: 100 },
      schlechtwetter: false
    }
  };
  LOHNGRUPPEN.zahntechnik = { stand: '1.1.2026', stufen: null, gruppen: [
      { id: 'ZL1', m: true, name: 'Lohngruppe I: Facharbeiter/in mit Meisterprüfung', l: [3693.53] },
      { id: 'ZL2', m: true, name: 'Lohngruppe II: Facharbeiter/in mit besonderen Qualifikationen', l: [2572.78] },
      { id: 'ZL3', m: true, name: 'Lohngruppe III: Facharbeiter/in Zahntechniker/in', l: [2323.03] },
      { id: 'ZL4', m: true, name: 'Lohngruppe IV: Zahntechnische Fachassistenz', l: [2139.34] },
      { id: 'ZL5', m: true, name: 'Lohngruppe V: Hilfsarbeiter/in, angelernte Tätigkeiten ohne Lehrabschluss', l: [1971.12] },
      { id: 'ZA1', m: true, name: 'Verwendungsgruppe I: Laborleiter/in', l: [5013.46] },
      { id: 'ZA2', m: true, name: 'Verwendungsgruppe II: Meister/in', l: [3693.53] },
      { id: 'ZA3', m: true, name: 'Verwendungsgruppe III: Weitere Angestellte', l: [2572.78] },
      { id: 'ZZ1', m: true, lehrling: true, name: 'Lehrling Zahntechniker/in, 1. Lehrjahr', l: [756.46] },
      { id: 'ZZ2', m: true, lehrling: true, name: 'Lehrling Zahntechniker/in, 2. Lehrjahr', l: [949.44] },
      { id: 'ZZ3', m: true, lehrling: true, name: 'Lehrling Zahntechniker/in, 3. Lehrjahr', l: [1276.58] },
      { id: 'ZZ4', m: true, lehrling: true, name: 'Lehrling Zahntechniker/in, 4. Lehrjahr', l: [1499.50] },
      { id: 'ZF1', m: true, lehrling: true, name: 'Lehrling Zahntechnische Fachassistenz, 1. Lehrjahr', l: [756.46] },
      { id: 'ZF2', m: true, lehrling: true, name: 'Lehrling Zahntechnische Fachassistenz, 2. Lehrjahr', l: [949.44] },
      { id: 'ZF3', m: true, lehrling: true, name: 'Lehrling Zahntechnische Fachassistenz, 3. Lehrjahr', l: [1276.58] }
    ] };
  // Glaser, Tapezierer, Steinmetz, Bodenleger, Textilreinigung (wko.at, Stand 2026)
  PAKETE.glaser = {
    name: 'Glaser (Arbeiter)',
    hinweis: 'KV Glaser, Arbeiter, Löhne ab 1.5.2026 (Quelle: wko.at): Löhne und Lehrlingseinkommen. Wochenstunden und Zuschläge stehen nicht in der Quelle: die App rechnet mit 40 Stunden pro Woche und 50 % Überstundenzuschlag (Gesetz), bitte mit dem Dienstzettel und dem Lohnzettel vergleichen. Dachzulagen je Bundesland sind als Prämie vorgeschlagen. Hohlglasveredler haben eigene Löhne: gib dann deinen Stundenlohn selbst ein.',
    pruefen: true,
    werte: {
      diaeten: { modell: 'aus', satz: 0, maxStd: null, minStd: 0, vorschlag: 'anwesenheit', stufen: [] },
      ueberstunden: { modell: 'monat', wochenStd: 40, tagesGrenze: null, zuschlagPct: 50 },
      stundenlohn: null,
      betriebFrei: 'urlaub',
      zuschlag: { art: 'kv', sa: 0, so: 100, ft: 100 },
      schlechtwetter: false
    }
  };
  LOHNGRUPPEN.glaser = { stand: 'ab 1.5.2026', stufen: null, gruppen: [
      { id: 'GL1', name: 'Glaser/in nach dem 3. Gesellen- und Gehilfenjahr', l: [17.54] },
      { id: 'GL2', name: 'Glaser/in im 3. Gesellen- und Gehilfenjahr', l: [16.06] },
      { id: 'GL3', name: 'Glaser/in im 1. und 2. Gesellen- und Gehilfenjahr', l: [14.83] },
      { id: 'GLQ', name: 'Qualifizierte/r Hilfsarbeiter/in (Glaser)', l: [15.39] },
      { id: 'GLH', name: 'Hilfsarbeiter/in (Glaser)', l: [14.11] },
      { id: 'LG1', lehrling: true, name: 'Lehrling, 1. Lehrjahr', l: [5.70] },
      { id: 'LG2', lehrling: true, name: 'Lehrling, 2. Lehrjahr', l: [7.40] },
      { id: 'LG3', lehrling: true, name: 'Lehrling, 3. Lehrjahr', l: [11.10] },
      { id: 'LG4', lehrling: true, name: 'Lehrling, 4. Lehrjahr', l: [12.90] }
    ] };
  PAKETE.tapezierer = {
    name: 'Tapezierer (Arbeiter)',
    hinweis: 'KV Tapezierer, Arbeiter, Löhne ab 1.5.2026 (Quelle: wko.at): Löhne und Lehrlingseinkommen. Wochenstunden und Zuschläge stehen nicht in der Quelle: die App rechnet mit 40 Stunden pro Woche und 50 % Überstundenzuschlag (Gesetz), bitte mit dem Dienstzettel und dem Lohnzettel vergleichen.',
    pruefen: true,
    werte: {
      diaeten: { modell: 'aus', satz: 0, maxStd: null, minStd: 0, vorschlag: 'anwesenheit', stufen: [] },
      ueberstunden: { modell: 'monat', wochenStd: 40, tagesGrenze: null, zuschlagPct: 50 },
      stundenlohn: null,
      betriebFrei: 'urlaub',
      zuschlag: { art: 'kv', sa: 0, so: 100, ft: 100 },
      schlechtwetter: false
    }
  };
  LOHNGRUPPEN.tapezierer = { stand: 'ab 1.5.2026', stufen: null, gruppen: [
      { id: 'TP1', name: 'Spezialfacharbeiter/in (Tapezierer)', l: [17.38] },
      { id: 'TP2', name: 'Facharbeiter/in nach dem 2. Jahr nach der Auslehre', l: [15.76] },
      { id: 'TP3', name: 'Facharbeiter/in nach dem 1. Jahr nach der Auslehre', l: [14.44] },
      { id: 'TP4', name: 'Facharbeiter/in im 1. Jahr nach der Auslehre', l: [13.96] },
      { id: 'TP5', name: 'Hilfsarbeiter/in (Tapezierer)', l: [13.93] },
      { id: 'LT1', m: true, lehrling: true, name: 'Lehrling, 1. Lehrjahr', l: [900.00] },
      { id: 'LT2', m: true, lehrling: true, name: 'Lehrling, 2. Lehrjahr', l: [1120.00] },
      { id: 'LT3', m: true, lehrling: true, name: 'Lehrling, 3. Lehrjahr', l: [1340.00] }
    ] };
  PAKETE.steinmetz = {
    name: 'Steinmetz / Steinarbeiter (Arbeiter)',
    hinweis: 'KV Steinarbeiter und Steinmetze, Arbeiter, Löhne ab 1.5.2026 (Quelle: wko.at): Löhne und Lehrlingseinkommen. Wochenstunden und Zuschläge stehen nicht in der Quelle: die App rechnet mit 40 Stunden pro Woche und 50 % Überstundenzuschlag (Gesetz), bitte mit dem Dienstzettel und dem Lohnzettel vergleichen. Gerüstzulage (7,5 %) und Staubzulage (8 %) sind als Prämien vorgeschlagen, den Betrag nimmst du vom Lohnzettel. Kunststeinerzeuger haben eigene Gruppen.',
    pruefen: true,
    werte: {
      diaeten: { modell: 'aus', satz: 0, maxStd: null, minStd: 0, vorschlag: 'anwesenheit', stufen: [] },
      ueberstunden: { modell: 'monat', wochenStd: 40, tagesGrenze: null, zuschlagPct: 50 },
      stundenlohn: null,
      betriebFrei: 'urlaub',
      zuschlag: { art: 'kv', sa: 0, so: 100, ft: 100 },
      schlechtwetter: false
    }
  };
  LOHNGRUPPEN.steinmetz = { stand: 'ab 1.5.2026', stufen: null, gruppen: [
      { id: 'SM1', name: 'Spezialfacharbeiter/in (Steinmetzmeister, Partieführer, Vorarbeiter, Sprengmeister)', l: [20.11] },
      { id: 'SM2', name: 'Facharbeiter/in mit Lehrabschluss Steinmetztechnik', l: [19.70] },
      { id: 'SM3', name: 'Facharbeiter/in mit Lehrabschluss im erlernten Beruf', l: [19.25] },
      { id: 'SM4', name: 'Facharbeiter/in ohne Lehrabschluss im erlernten Beruf', l: [18.67] },
      { id: 'SM5', name: 'Angelernte (Schleifer, Säger, Fräser, Kranführer, Helfer)', l: [18.01] },
      { id: 'SM6', name: 'Hilfsarbeiter/in und Reinigungspersonal', l: [16.22] },
      { id: 'SM7a', name: 'Steinbildhauer/in, Modelleur/in', l: [22.94] },
      { id: 'SM7b', name: 'Gipsbildhauer/in, Former/in, Gießer/in', l: [20.11] },
      { id: 'KS1', name: 'Kunststein: Vorarbeiter/in, Partieführer/in', l: [19.24] },
      { id: 'KS2', name: 'Kunststein: Facharbeiter/in mit Lehrabschluss', l: [18.71] },
      { id: 'KS3', name: 'Kunststein: Facharbeiter/in ohne Lehrabschluss', l: [17.85] },
      { id: 'KS4', name: 'Kunststein: Angelernte (Former, Einschaler, Eisenbieger)', l: [17.22] },
      { id: 'KS5', name: 'Kunststein: Hilfsarbeiter/in', l: [15.77] },
      { id: 'KS6', name: 'Kunststein: Sonstiges Hilfspersonal', l: [14.16] },
      { id: 'LS1', lehrling: true, name: 'Lehrling, 1. Lehrjahr', l: [7.70] },
      { id: 'LS2', lehrling: true, name: 'Lehrling, 2. Lehrjahr', l: [9.90] },
      { id: 'LS3', lehrling: true, name: 'Lehrling, 3. Lehrjahr', l: [14.20] },
      { id: 'LS4', lehrling: true, name: 'Lehrling, 4. Lehrjahr', l: [16.40] }
    ] };
  PAKETE.bodenleger = {
    name: 'Bodenleger (Arbeiter)',
    hinweis: 'KV Bodenleger, Arbeiter, Löhne ab 1.5.2026 (Quelle: wko.at): Löhne und Lehrlingseinkommen. Wochenstunden und Zuschläge stehen nicht in der Quelle: die App rechnet mit 40 Stunden pro Woche und 50 % Überstundenzuschlag (Gesetz), bitte mit dem Dienstzettel und dem Lohnzettel vergleichen.',
    pruefen: true,
    werte: {
      diaeten: { modell: 'aus', satz: 0, maxStd: null, minStd: 0, vorschlag: 'anwesenheit', stufen: [] },
      ueberstunden: { modell: 'monat', wochenStd: 40, tagesGrenze: null, zuschlagPct: 50 },
      stundenlohn: null,
      betriebFrei: 'urlaub',
      zuschlag: { art: 'kv', sa: 0, so: 100, ft: 100 },
      schlechtwetter: false
    }
  };
  LOHNGRUPPEN.bodenleger = { stand: 'ab 1.5.2026', stufen: null, gruppen: [
      { id: 'BL1', name: 'Facharbeiter/in mit Lehrabschluss ab dem 3. Praxisjahr', l: [18.14] },
      { id: 'BL2', name: 'Facharbeiter/in mit Lehrabschluss, ohne Lehrabschluss ab dem 2. Praxisjahr', l: [17.29] },
      { id: 'BL3', name: 'Facharbeiter/in ohne Lehrabschluss (Bodenleger)', l: [16.87] },
      { id: 'BL4', name: 'Bodenlegerhelfer/in', l: [16.18] },
      { id: 'BL5', name: 'Hilfsarbeiter/in (Bodenleger)', l: [14.88] },
      { id: 'LB1', lehrling: true, name: 'Lehrling, 1. Lehrjahr', l: [6.85] },
      { id: 'LB2', lehrling: true, name: 'Lehrling, 2. Lehrjahr', l: [8.40] },
      { id: 'LB3', lehrling: true, name: 'Lehrling, 3. Lehrjahr', l: [9.95] },
      { id: 'LB4', lehrling: true, name: 'Lehrling, 4. Lehrjahr', l: [11.60] }
    ] };
  PAKETE.textilreinigung = {
    name: 'Textilreinigung und Wäscherei (Arbeiter)',
    hinweis: 'KV Textilreiniger, Wäscher und Färber, Arbeiter, Löhne ab 1.1.2026 (Quelle: wko.at): Stundenlöhne und Lehrlingseinkommen (monatlich). Wochenstunden und Teiler stehen nicht in der Quelle: die App rechnet mit 40 Stunden pro Woche und 50 % Überstundenzuschlag, bitte mit dem Dienstzettel und dem Lohnzettel vergleichen. Sonntagsarbeit zählt 100 %. Die Außer-Haus-Zulage (10 %, nur Teppichreinigung) ist als Prämie vorgeschlagen, Sonntagsarbeit zählt 100 %.',
    pruefen: true,
    werte: {
      diaeten: { modell: 'aus', satz: 0, maxStd: null, minStd: 0, vorschlag: 'anwesenheit', stufen: [] },
      ueberstunden: { modell: 'monat', wochenStd: 40, tagesGrenze: null, zuschlagPct: 50 },
      stundenlohn: null,
      betriebFrei: 'urlaub',
      zuschlag: { art: 'kv', sa: 0, so: 100, ft: 100 },
      schlechtwetter: false
    }
  };
  LOHNGRUPPEN.textilreinigung = { stand: 'ab 1.1.2026', stufen: null, gruppen: [
      { id: 'TX1', name: 'Lohngruppe I: Waschmeister, gelernte Kräfte', l: [11.87] },
      { id: 'TX2', name: 'Lohngruppe II: Chauffeure, Heizer, Professionisten, erste Kräfte', l: [11.61] },
      { id: 'TX3', name: 'Lohngruppe III: Maschin- und Handwaschen, Sortieren, Nähen, erste Ladnerkraft, Angelernte nach einem halben Jahr', l: [11.35] },
      { id: 'TX4', name: 'Lohngruppe IV: Pressen, Legen, Zentrifugieren, Angelernte bis zu einem halben Jahr', l: [11.22] },
      { id: 'TX5', name: 'Lohngruppe V: Hilfsarbeiten, Mitfahren, zweite Ladnerkraft, Aufsichtspersonen', l: [11.22] },
      { id: 'LT1', m: true, lehrling: true, name: 'Lehrling, 1. Lehrjahr', l: [804.96] },
      { id: 'LT2', m: true, lehrling: true, name: 'Lehrling, 2. Lehrjahr', l: [912.29] },
      { id: 'LT3', m: true, lehrling: true, name: 'Lehrling, 3. Lehrjahr', l: [1180.61] },
      { id: 'LT4', m: true, lehrling: true, name: 'Lehrling, 4. Lehrjahr', l: [1341.60] }
    ] };
  // Rauchfangkehrer (Lohnordnungen je Bundesland, wko.at 2026)
  PAKETE.rk_noe = {
    name: 'Rauchfangkehrer Niederösterreich (Arbeiter)',
    hinweis: 'KV Rauchfangkehrer Niederösterreich, Arbeiter, Löhne ab 1.1.2026 (Quelle: wko.at): Monatslöhne und Lehrlingseinkommen. Durchschnittlich 40 Stunden pro Woche (bis 48 möglich). Die Schmutzzulage und weitere Zulagen sind als Prämien vorgeschlagen, den Betrag nimmst du vom Lohnzettel. Nachtzuschlag und Stundenteiler stehen nicht überall in der Quelle: die App rechnet mit 50 % Überstundenzuschlag, bitte mit dem Dienstzettel und dem Lohnzettel vergleichen.',
    pruefen: true,
    werte: {
      diaeten: { modell: 'aus', satz: 0, maxStd: null, minStd: 0, vorschlag: 'anwesenheit', stufen: [] },
      ueberstunden: { modell: 'monat', wochenStd: 40, tagesGrenze: null, zuschlagPct: 50 },
      stundenlohn: null,
      betriebFrei: 'urlaub',
      zuschlag: { art: 'kv', sa: 0, so: 0, ft: 100 },
      schlechtwetter: false
    }
  };
  LOHNGRUPPEN.rk_noe = { stand: 'ab 1.1.2026', stufen: ['Berufsjahre 1–2', 'Berufsjahre 3–4', 'ab dem 5. Berufsjahr'], gruppen: [
      { id: 'RN1', m: true, name: 'Geselle/Gesellin mit Meisterprüfung', l: [2932.50, 2932.50, 2932.50] },
      { id: 'RN2', m: true, name: 'Geselle/Gesellin mit den Modulen 1 bis 3 der Meisterprüfung', l: [2821.00, 2821.00, 2821.00] },
      { id: 'RN3', m: true, name: 'Geselle/Gesellin mit Lehrabschluss', l: [2291.50, 2613.50, 2686.00] },
      { id: 'RN4', m: true, name: 'Arbeitnehmer/in ohne Lehrabschluss (Rauchfangkehrer)', l: [2102.50, 2613.50, 2613.50] },
      { id: 'RLn1', m: true, lehrling: true, name: 'Lehrling, 1. Lehrjahr', l: [888.50] },
      { id: 'RLn2', m: true, lehrling: true, name: 'Lehrling, 2. Lehrjahr', l: [1106.50] },
      { id: 'RLn3', m: true, lehrling: true, name: 'Lehrling, 3. Lehrjahr', l: [1408.50] }
    ] };
  PAKETE.rk_w = {
    name: 'Rauchfangkehrer Wien (Arbeiter)',
    hinweis: 'KV Rauchfangkehrer Wien, Arbeiter, Löhne ab 1.1.2026 (Quelle: wko.at): Monatslöhne und Lehrlingseinkommen. Durchschnittlich 40 Stunden pro Woche (bis 48 möglich). Die Schmutzzulage und weitere Zulagen sind als Prämien vorgeschlagen, den Betrag nimmst du vom Lohnzettel. Nachtzuschlag und Stundenteiler stehen nicht überall in der Quelle: die App rechnet mit 50 % Überstundenzuschlag, bitte mit dem Dienstzettel und dem Lohnzettel vergleichen.',
    pruefen: true,
    werte: {
      diaeten: { modell: 'aus', satz: 0, maxStd: null, minStd: 0, vorschlag: 'anwesenheit', stufen: [] },
      ueberstunden: { modell: 'monat', wochenStd: 40, tagesGrenze: null, zuschlagPct: 50 },
      stundenlohn: null,
      betriebFrei: 'urlaub',
      zuschlag: { art: 'kv', sa: 0, so: 0, ft: 100 },
      schlechtwetter: false
    }
  };
  LOHNGRUPPEN.rk_w = { stand: 'ab 1.1.2026', stufen: null, gruppen: [
      { id: 'RW1', m: true, name: 'Geselle/Gesellin mit Lehrabschluss', l: [2926.00] },
      { id: 'RW2', m: true, name: 'Arbeitnehmer/in ohne Lehrabschluss (Rauchfangkehrer)', l: [2000.00] },
      { id: 'RLw1', m: true, lehrling: true, name: 'Lehrling, 1. Lehrjahr', l: [1172.00] },
      { id: 'RLw2', m: true, lehrling: true, name: 'Lehrling, 2. Lehrjahr', l: [1318.00] },
      { id: 'RLw3', m: true, lehrling: true, name: 'Lehrling, 3. Lehrjahr', l: [1610.00] }
    ] };
  PAKETE.rk_stmk = {
    name: 'Rauchfangkehrer Steiermark (Arbeiter)',
    hinweis: 'KV Rauchfangkehrer Steiermark, Arbeiter, Löhne ab 1.1.2026 (Quelle: wko.at): Monatslöhne und Lehrlingseinkommen. Durchschnittlich 40 Stunden pro Woche (bis 48 möglich). Die Schmutzzulage und weitere Zulagen sind als Prämien vorgeschlagen, den Betrag nimmst du vom Lohnzettel. Nachtzuschlag und Stundenteiler stehen nicht überall in der Quelle: die App rechnet mit 50 % Überstundenzuschlag, bitte mit dem Dienstzettel und dem Lohnzettel vergleichen.',
    pruefen: true,
    werte: {
      diaeten: { modell: 'stunde', satz: 1.37, maxStd: null, minStd: 3, vorschlag: 'anwesenheit', stufen: [] },
      ueberstunden: { modell: 'monat', wochenStd: 40, tagesGrenze: null, zuschlagPct: 50 },
      stundenlohn: null,
      betriebFrei: 'urlaub',
      zuschlag: { art: 'kv', sa: 0, so: 100, ft: 100 },
      schlechtwetter: false
    }
  };
  LOHNGRUPPEN.rk_stmk = { stand: 'ab 1.1.2026', stufen: null, gruppen: [
      { id: 'RS1', m: true, name: 'Qualifizierte/r Geselle/Gesellin', l: [2631.42] },
      { id: 'RS2', m: true, name: 'Geselle/Gesellin mit besonderen Fähigkeiten', l: [2447.39] },
      { id: 'RS3', m: true, name: 'Geselle/Gesellin mit Lehrabschluss', l: [2265.48] },
      { id: 'RS4', m: true, name: 'Arbeitnehmer/in ohne Lehrabschluss (Rauchfangkehrer)', l: [2062.41] },
      { id: 'RS5', m: true, name: 'Geschäftsführer/in (Rauchfangkehrer)', l: [3272.02] },
      { id: 'RLs1', m: true, lehrling: true, name: 'Lehrling, 1. Lehrjahr', l: [800.00] },
      { id: 'RLs2', m: true, lehrling: true, name: 'Lehrling, 2. Lehrjahr', l: [1000.00] },
      { id: 'RLs3', m: true, lehrling: true, name: 'Lehrling, 3. Lehrjahr', l: [1300.00] }
    ] };
  PAKETE.rk_ktn = {
    name: 'Rauchfangkehrer Kärnten (Arbeiter)',
    hinweis: 'KV Rauchfangkehrer Kärnten, Arbeiter, Löhne ab 1.1.2026 (Quelle: wko.at): Monatslöhne und Lehrlingseinkommen. Durchschnittlich 40 Stunden pro Woche (bis 48 möglich). Die Schmutzzulage und weitere Zulagen sind als Prämien vorgeschlagen, den Betrag nimmst du vom Lohnzettel. Nachtzuschlag und Stundenteiler stehen nicht überall in der Quelle: die App rechnet mit 50 % Überstundenzuschlag, bitte mit dem Dienstzettel und dem Lohnzettel vergleichen.',
    pruefen: true,
    werte: {
      diaeten: { modell: 'aus', satz: 0, maxStd: null, minStd: 0, vorschlag: 'anwesenheit', stufen: [] },
      ueberstunden: { modell: 'monat', wochenStd: 40, tagesGrenze: null, zuschlagPct: 50 },
      stundenlohn: null,
      betriebFrei: 'urlaub',
      zuschlag: { art: 'kv', sa: 0, so: 0, ft: 100 },
      schlechtwetter: false
    }
  };
  LOHNGRUPPEN.rk_ktn = { stand: 'ab 1.1.2026', stufen: null, gruppen: [
      { id: 'RK1', m: true, name: 'Geselle/Gesellin mit Meisterprüfung', l: [2236.88] },
      { id: 'RK2', m: true, name: 'Geselle/Gesellin, darf Überprüfungs- und Wartungsarbeiten selbständig ausführen', l: [2182.97] },
      { id: 'RK3', m: true, name: 'Geselle/Gesellin mit Lehrabschluss', l: [2091.81] },
      { id: 'RK4', m: true, name: 'Arbeitnehmer/in ohne Lehrabschluss (Rauchfangkehrer)', l: [2037.90] },
      { id: 'RLk1', m: true, lehrling: true, name: 'Lehrling, 1. Lehrjahr', l: [970.33] },
      { id: 'RLk2', m: true, lehrling: true, name: 'Lehrling, 2. Lehrjahr', l: [1078.14] },
      { id: 'RLk3', m: true, lehrling: true, name: 'Lehrling, 3. Lehrjahr', l: [1185.95] }
    ] };
  PAKETE.rk_sbg = {
    name: 'Rauchfangkehrer Salzburg (Arbeiter)',
    hinweis: 'KV Rauchfangkehrer Salzburg, Arbeiter, Löhne ab 1.9.2026 (Quelle: wko.at): Monatslöhne und Lehrlingseinkommen. Durchschnittlich 40 Stunden pro Woche (bis 48 möglich). Die Schmutzzulage und weitere Zulagen sind als Prämien vorgeschlagen, den Betrag nimmst du vom Lohnzettel. Nachtzuschlag und Stundenteiler stehen nicht überall in der Quelle: die App rechnet mit 50 % Überstundenzuschlag, bitte mit dem Dienstzettel und dem Lohnzettel vergleichen.',
    pruefen: true,
    werte: {
      diaeten: { modell: 'tag', satz: 0, maxStd: null, minStd: 0, vorschlag: 'anwesenheit', stufen: [{ ab: 3, satz: 9.00 }, { ab: 5, satz: 13.00 }, { ab: 7, satz: 16.00 }] },
      ueberstunden: { modell: 'monat', wochenStd: 40, tagesGrenze: null, zuschlagPct: 50 },
      stundenlohn: null,
      betriebFrei: 'urlaub',
      zuschlag: { art: 'kv', sa: 0, so: 0, ft: 100 },
      schlechtwetter: false
    }
  };
  LOHNGRUPPEN.rk_sbg = { stand: 'ab 1.9.2026', stufen: ['Berufsjahre 1–2', 'Berufsjahre 3–4', 'ab dem 5. Berufsjahr'], gruppen: [
      { id: 'RZ1', m: true, name: 'Geselle/Gesellin mit Lehrabschluss', l: [2245.68, 2445.58, 2629.92] },
      { id: 'RZ2', m: true, name: 'Gehilfe/Gehilfin (85 % des Gesellenlohns)', l: [1908.83, 2078.74, 2235.43] },
      { id: 'RLs1', m: true, lehrling: true, name: 'Lehrling, 1. Lehrjahr', l: [1000.00] },
      { id: 'RLs2', m: true, lehrling: true, name: 'Lehrling, 2. Lehrjahr', l: [1200.00] },
      { id: 'RLs3', m: true, lehrling: true, name: 'Lehrling, 3. Lehrjahr', l: [1400.00] }
    ] };
  PAKETE.rk_bgld = {
    name: 'Rauchfangkehrer Burgenland (Arbeiter)',
    hinweis: 'KV Rauchfangkehrer Burgenland, Arbeiter, Löhne ab 1.1.2026 (Quelle: wko.at): Monatslöhne und Lehrlingseinkommen. Durchschnittlich 40 Stunden pro Woche (bis 48 möglich). Die Schmutzzulage und weitere Zulagen sind als Prämien vorgeschlagen, den Betrag nimmst du vom Lohnzettel. Nachtzuschlag und Stundenteiler stehen nicht überall in der Quelle: die App rechnet mit 50 % Überstundenzuschlag, bitte mit dem Dienstzettel und dem Lohnzettel vergleichen.',
    pruefen: true,
    werte: {
      diaeten: { modell: 'aus', satz: 0, maxStd: null, minStd: 0, vorschlag: 'anwesenheit', stufen: [] },
      ueberstunden: { modell: 'monat', wochenStd: 40, tagesGrenze: null, zuschlagPct: 50 },
      stundenlohn: null,
      betriebFrei: 'urlaub',
      zuschlag: { art: 'kv', sa: 0, so: 0, ft: 100 },
      schlechtwetter: false
    }
  };
  LOHNGRUPPEN.rk_bgld = { stand: 'ab 1.1.2026', stufen: null, gruppen: [
      { id: 'RB1', m: true, name: 'Geselle/Gesellin mit Meisterprüfung', l: [3224.68] },
      { id: 'RB2', m: true, name: 'Geselle/Gesellin, darf Überprüfungs- und Wartungsarbeiten selbständig ausführen', l: [3030.14] },
      { id: 'RB3', m: true, name: 'Geselle/Gesellin mit Lehrabschluss', l: [2946.31] },
      { id: 'RB4', m: true, name: 'Arbeitnehmer/in ohne Lehrabschluss (Rauchfangkehrer)', l: [2453.98] },
      { id: 'RLb1', m: true, lehrling: true, name: 'Lehrling, 1. Lehrjahr', l: [883.89] },
      { id: 'RLb2', m: true, lehrling: true, name: 'Lehrling, 2. Lehrjahr', l: [1325.84] },
      { id: 'RLb3', m: true, lehrling: true, name: 'Lehrling, 3. Lehrjahr', l: [1767.79] }
    ] };
  PAKETE.rk_ooe = {
    name: 'Rauchfangkehrer Oberösterreich (Arbeiter)',
    hinweis: 'KV Rauchfangkehrer Oberösterreich, Arbeiter, Löhne ab 1.1.2026 (Quelle: wko.at): Monatslöhne und Lehrlingseinkommen. Durchschnittlich 40 Stunden pro Woche (bis 48 möglich). Die Schmutzzulage und weitere Zulagen sind als Prämien vorgeschlagen, den Betrag nimmst du vom Lohnzettel. Nachtzuschlag und Stundenteiler stehen nicht überall in der Quelle: die App rechnet mit 50 % Überstundenzuschlag, bitte mit dem Dienstzettel und dem Lohnzettel vergleichen.',
    pruefen: true,
    werte: {
      diaeten: { modell: 'tag', satz: 0, maxStd: null, minStd: 0, vorschlag: 'anwesenheit', stufen: [{ ab: 1, satz: 20.00 }] },
      ueberstunden: { modell: 'monat', wochenStd: 40, tagesGrenze: null, zuschlagPct: 50 },
      stundenlohn: null,
      betriebFrei: 'urlaub',
      zuschlag: { art: 'kv', sa: 0, so: 100, ft: 100 },
      schlechtwetter: false
    }
  };
  LOHNGRUPPEN.rk_ooe = { stand: 'ab 1.1.2026', stufen: ['Berufsjahre 1–2', 'Berufsjahre 3–4', 'ab dem 5. Berufsjahr'], gruppen: [
      { id: 'RO1', m: true, name: 'Qualifizierte/r Geselle/Gesellin', l: [2647.60, 2647.60, 2647.60] },
      { id: 'RO2', m: true, name: 'Geselle/Gesellin mit Lehrabschluss', l: [2377.30, 2459.80, 2531.00] },
      { id: 'RO3', m: true, name: 'Arbeitnehmer/in ohne Lehrabschluss (Rauchfangkehrer)', l: [2277.10, 2352.80, 2419.00] },
      { id: 'RLo1', m: true, lehrling: true, name: 'Lehrling, 1. Lehrjahr', l: [718.50] },
      { id: 'RLo2', m: true, lehrling: true, name: 'Lehrling, 2. Lehrjahr', l: [980.40] },
      { id: 'RLo3', m: true, lehrling: true, name: 'Lehrling, 3. Lehrjahr', l: [1250.70] }
    ] };
  // Bauhilfsgewerbe, Schädlingsbekämpfung, Kunststoffverarbeiter (wko.at 2026)
  PAKETE.bauhilfsgewerbe = {
    name: 'Bauhilfsgewerbe (Arbeiter)',
    hinweis: 'KV Bauhilfsgewerbe (Fassader, Stuckateure, Gipser, Dämmung), Arbeiter, Löhne ab 1.5.2026 (Quelle: wko.at): Löhne und Lehrlingseinkommen. Wochenstunden und Zuschläge stehen nicht in der Quelle: die App rechnet mit 40 Stunden pro Woche und 50 % Überstundenzuschlag (Gesetz), bitte mit dem Dienstzettel und dem Lohnzettel vergleichen. Die Zulagen sind in Prozent angegeben (zum Beispiel Schmutzzulage 10 %, nur die zwei höchsten werden gezahlt), den Betrag nimmst du vom Lohnzettel.',
    pruefen: true,
    werte: {
      diaeten: { modell: 'aus', satz: 0, maxStd: null, minStd: 0, vorschlag: 'anwesenheit', stufen: [] },
      ueberstunden: { modell: 'monat', wochenStd: 40, tagesGrenze: null, zuschlagPct: 50 },
      stundenlohn: null,
      betriebFrei: 'urlaub',
      zuschlag: { art: 'kv', sa: 0, so: 100, ft: 100 },
      schlechtwetter: false
    }
  };
  LOHNGRUPPEN.bauhilfsgewerbe = { stand: 'ab 1.5.2026', stufen: null, gruppen: [
      { id: 'BH1', name: 'Vorarbeiter/in (Bauhilfsgewerbe)', l: [19.63] },
      { id: 'BH2', name: 'Fassader/in, Stuckateur/in, Gipser/in', l: [19.63] },
      { id: 'BH3', name: 'Facharbeiter/in mit Lehrabschluss im erlernten Beruf', l: [18.70] },
      { id: 'BH4', name: 'Facharbeiter/in ohne Lehrabschluss im erlernten Beruf', l: [18.32] },
      { id: 'BH5', name: 'Angelernte/r Arbeiter/in', l: [17.22] },
      { id: 'BH6', name: 'Hilfsarbeiter/in (Bauhilfsgewerbe)', l: [15.45] },
      { id: 'BH7', name: 'Aufsteller/in und Monteur/in mobiler Trennwände', l: [19.63] },
      { id: 'LB1', lehrling: true, name: 'Lehrling, 1. Lehrjahr', l: [6.42] },
      { id: 'LB2', lehrling: true, name: 'Lehrling, 2. Lehrjahr', l: [9.63] },
      { id: 'LB3', lehrling: true, name: 'Lehrling, 3. Lehrjahr', l: [14.18] }
    ] };
  PAKETE.schaedling = {
    name: 'Schädlingsbekämpfung (Arbeiter)',
    hinweis: 'KV Schädlingsbekämpfung, Arbeiter, Löhne ab 1.3.2026 (Quelle: wko.at): Löhne und Lehrlingseinkommen. Wochenstunden und Zuschläge stehen nicht in der Quelle: die App rechnet mit 40 Stunden pro Woche und 50 % Überstundenzuschlag (Gesetz), bitte mit dem Dienstzettel und dem Lohnzettel vergleichen.',
    pruefen: true,
    werte: {
      diaeten: { modell: 'aus', satz: 0, maxStd: null, minStd: 0, vorschlag: 'anwesenheit', stufen: [] },
      ueberstunden: { modell: 'monat', wochenStd: 40, tagesGrenze: null, zuschlagPct: 50 },
      stundenlohn: null,
      betriebFrei: 'urlaub',
      zuschlag: { art: 'kv', sa: 0, so: 100, ft: 100 },
      schlechtwetter: false
    }
  };
  LOHNGRUPPEN.schaedling = { stand: 'ab 1.3.2026', stufen: null, gruppen: [
      { id: 'SB1', name: 'Absolvent/in der Lehre ohne Lehrabschluss, Beschäftigte/r in der Schädlingsbekämpfung', l: [12.54] },
      { id: 'SB2', name: 'Schädlingsbekämpfer/in, Facharbeiter/in', l: [15.15] },
      { id: 'LS1', m: true, lehrling: true, name: 'Lehrling, 1. Lehrjahr', l: [974.00] },
      { id: 'LS2', m: true, lehrling: true, name: 'Lehrling, 2. Lehrjahr', l: [1218.00] },
      { id: 'LS3', m: true, lehrling: true, name: 'Lehrling, 3. Lehrjahr', l: [1497.00] }
    ] };
  PAKETE.kunststoff = {
    name: 'Kunststoffverarbeitung (Arbeiter)',
    hinweis: 'KV Kunststoffverarbeiter, Arbeiter, Löhne ab 1.5.2026 (Quelle: wko.at): Löhne und Lehrlingseinkommen. Wochenstunden und Zuschläge stehen nicht in der Quelle: die App rechnet mit 40 Stunden pro Woche und 50 % Überstundenzuschlag (Gesetz), bitte mit dem Dienstzettel und dem Lohnzettel vergleichen. Der Monatslohn wird aus dem Stundenlohn mit dem Faktor 173,2 berechnet; Lehrlinge bekommen monatliche Beträge.',
    pruefen: true,
    werte: {
      diaeten: { modell: 'aus', satz: 0, maxStd: null, minStd: 0, vorschlag: 'anwesenheit', stufen: [] },
      ueberstunden: { modell: 'monat', wochenStd: 40, tagesGrenze: null, zuschlagPct: 50 },
      stundenlohn: null,
      betriebFrei: 'urlaub',
      zuschlag: { art: 'kv', sa: 0, so: 100, ft: 100 },
      schlechtwetter: false
    }
  };
  LOHNGRUPPEN.kunststoff = { stand: '1.5.2026 bis 30.4.2027', stufen: null, teiler: 173.2, gruppen: [
      { id: 'KU1', name: 'Lohngruppe I: Spitzenfacharbeiter/in', l: [14.97] },
      { id: 'KU2', name: 'Lohngruppe II: Facharbeiter/in mit Lehrabschluss', l: [13.97] },
      { id: 'KU3', name: 'Lohngruppe III: Angelernte Tätigkeiten, Maschinenarbeiter/in, Kraftfahrer/in', l: [13.17] },
      { id: 'KU4', name: 'Lohngruppe IV: Arbeitnehmer/in ohne Zweckausbildung (Hilfs- und Reinigungsarbeiten)', l: [12.37] },
      { id: 'LK1', m: true, lehrling: true, name: 'Lehrling, 1. Lehrjahr', l: [955.54] },
      { id: 'LK2', m: true, lehrling: true, name: 'Lehrling, 2. Lehrjahr', l: [1231.59] },
      { id: 'LK3', m: true, lehrling: true, name: 'Lehrling, 3. Lehrjahr', l: [1603.20] },
      { id: 'LK4', m: true, lehrling: true, name: 'Lehrling, 4. Lehrjahr', l: [2049.12] }
    ] };
  /* ---- Schnell erfassen: Text oder Sprache in einen Tageseintrag verwandeln (Deutsch und Englisch) ---- */
  // Fremdsprachen: Schlüsselwörter der gewählten App-Sprache werden vor dem Lesen in die englischen Wörter umgesetzt,
  // die der Leser kennt. Nur die Regeln der einen Sprache laufen, damit deutsche Sätze und Kundennamen unberührt bleiben.
  var FREMD_W = {
    pl: { von: 'od', bis: 'do', std: 'godz(?:in\\p{L}*)?\\.?', min: 'minut\\p{L}*|min\\.?', ohne: 'bez\\s+przerw\\p{L}*', pause: 'przerw\\p{L}*', vg: 'przedwczoraj', g: 'wczoraj', h: 'dziś|dzis|dzisiaj', tage: 'niedziel\\p{L}*|poniedziałek|wtorek|środ\\p{L}*|czwartek|piątek|sobot\\p{L}*', urlaub: 'urlop\\p{L}*', krank: 'chorobow\\p{L}*|zwolnieni\\p{L}*\\s+lekarsk\\p{L}*|chor\\p{L}{1,2}', za: 'odbiór\\s+nadgodzin', schule: 'szkoł\\p{L}*', kunde: 'u\\s+klienta|klient\\p{L}*', task: 'czynność|zadanie|praca' },
    hu: { std: 'órá?\\p{L}*', min: 'perc\\p{L}*', ohne: 'nincs\\s+szünet|szünet\\s+nélkül', pause: 'szünet\\p{L}*', vg: 'tegnapelőtt', g: 'tegnap', h: 'ma', tage: 'vasárnap|hétfő\\p{L}*|kedd\\p{L}*|szerd\\p{L}*|csütörtök\\p{L}*|péntek\\p{L}*|szombat\\p{L}*', urlaub: 'szabadság\\p{L}*', krank: 'betegszabadság\\p{L}*|beteg\\p{L}*|táppénz\\p{L}*', za: 'szabadidő', schule: 'iskol\\p{L}*', kunde: 'ügyfél\\p{L}*', task: 'tevékenység|feladat|munka' },
    tr: { std: 'saat', min: 'dakika|dk\\.?', ohne: 'mola\\s+yok|molasız', pause: 'mola\\p{L}*', vg: 'evvelsi\\s+gün|önceki\\s+gün', g: 'dün', h: 'bugün|bugun', tage: 'pazar|pazartesi|salı/sali|çarşamba/carsamba|perşembe/persembe|cuma|cumartesi', urlaub: 'izin\\p{L}*|tatil', krank: 'hasta\\p{L}*|rapor\\p{L}*', za: 'zaman\\s+izni', schule: 'okul\\p{L}*', kunde: 'müşteri\\p{L}*|musteri\\p{L}*', task: 'faaliyet|görev|iş' },
    cs: { von: 'od', bis: 'do|až|az|až\\s+do', std: 'hodin\\p{L}*|hod\\.?', min: 'minut\\p{L}*|min\\.?', ohne: 'bez\\s+přestávk\\p{L}*|bez\\s+pauz\\p{L}*', pause: 'přestávk\\p{L}*|pauz\\p{L}*', vg: 'předevčírem', g: 'včera', h: 'dnes', tage: 'neděl\\p{L}*|pondělí|úterý|střed\\p{L}*|čtvrtek|pátek|sobot\\p{L}*', urlaub: 'dovolen\\p{L}*', krank: 'nemocensk\\p{L}*|nemoc\\p{L}*', za: 'náhradní\\s+volno', schule: 'škol\\p{L}*', kunde: 'zákazník\\p{L}*', task: 'činnost|úkol|práce' },
    sk: { von: 'od', bis: 'do|až|az|až\\s+do', std: 'hodin\\p{L}*|hod\\.?', min: 'minút\\p{L}*|minut\\p{L}*|min\\.?', ohne: 'bez\\s+prestávk\\p{L}*|bez\\s+pauz\\p{L}*', pause: 'prestávk\\p{L}*|pauz\\p{L}*', vg: 'predvčerom', g: 'včera', h: 'dnes', tage: 'nedeľ\\p{L}*|pondelok|utorok|stred\\p{L}*|štvrtok|piatok|sobot\\p{L}*', urlaub: 'dovolenk\\p{L}*', krank: 'péenk\\p{L}*|chor\\p{L}*', za: 'náhradné\\s+voľno', schule: 'škol\\p{L}*', kunde: 'zákazník\\p{L}*', task: 'činnosť|úloha|práca' },
    hr: { von: 'od', bis: 'do', std: 'sati|sata|sat', min: 'minut\\p{L}*|min\\.?', ohne: 'bez\\s+stank\\p{L}*|bez\\s+pauz\\p{L}*', pause: 'stank\\p{L}*|pauz\\p{L}*', vg: 'prekjučer|prekjucer', g: 'jučer|jucer', h: 'danas', tage: 'nedjelj\\p{L}*|ponedjeljak|utorak|srijed\\p{L}*|četvrtak|petak|subot\\p{L}*', urlaub: 'godišnji(?:\\s+odmor)?', krank: 'bolovanj\\p{L}*|bolest\\p{L}*', za: 'slobodni\\s+dani?', schule: 'škol\\p{L}*', kunde: 'klijent\\p{L}*|kupac|kupca', task: 'aktivnost|zadatak|posao' },
    sr: { von: 'od', bis: 'do', std: 'sati|sata|sat|časova|časa|čas', min: 'minut\\p{L}*|min\\.?', ohne: 'bez\\s+pauz\\p{L}*', pause: 'pauz\\p{L}*', vg: 'prekjuče|prekjuce', g: 'juče|juce', h: 'danas', tage: 'nedelj\\p{L}*|ponedeljak|utorak|sred\\p{L}*|četvrtak|petak|subot\\p{L}*', urlaub: 'godišnji(?:\\s+odmor)?|odmor', krank: 'bolovanj\\p{L}*|bolest\\p{L}*', za: 'slobodni\\s+dani?', schule: 'škol\\p{L}*', kunde: 'klijent\\p{L}*|kupac|kupca', task: 'aktivnost|zadatak|posao' },
    it: { von: 'dalle(?:\\s+ore)?|da', bis: 'alle(?:\\s+ore)?|a', std: 'ore', min: 'minut[oi]|min\\.?', ohne: 'senza\\s+pausa', pause: 'pausa', vg: 'l.altro\\s+ieri|ieri\\s+l.altro', g: 'ieri', h: 'oggi', tage: 'domenica|lunedì/lunedi|martedì/martedi|mercoledì/mercoledi|giovedì/giovedi|venerdì/venerdi|sabato', urlaub: 'ferie|vacanz[ae]', krank: 'malattia|malat[oa]', za: 'riposo\\s+compensativo', schule: 'scuola', kunde: 'cliente', task: 'attività|attivita|lavoro|compito' },
    ro: { von: 'de\\s+la', bis: 'la|până\\s+la|pana\\s+la', std: 'ore|ora|ceasuri|ceas', min: '(?:de\\s+)?minute|min\\.?', ohne: 'fără\\s+pauză|fara\\s+pauza', pause: 'pauză|pauza|pauze', vg: 'alaltăieri|alaltaieri', g: 'ieri', h: 'azi|astăzi|astazi', tage: 'duminică/duminica|luni|marți/marti|miercuri|joi|vineri|sâmbătă/sambata', urlaub: 'concediu(?!\\s+medical)', krank: 'concediu\\s+medical|boală|bolnav\\p{L}*', za: 'timp\\s+liber', schule: 'școală|scoala|școala', kunde: 'client\\p{L}*', task: 'activitate|lucrare|sarcină' },
    ru: { von: 'с|от', bis: 'до|по', std: 'часов|часа|час|ч\\.?', min: 'минут\\p{L}*|мин\\.?', ohne: 'без\\s+перерыв\\p{L}*|без\\s+обед\\p{L}*', pause: 'перерыв\\p{L}*|обед\\p{L}*', vg: 'позавчера', g: 'вчера', h: 'сегодня', tage: 'воскресень\\p{L}*|понедельник\\p{L}*|вторник\\p{L}*|сред\\p{L}*|четверг\\p{L}*|пятниц\\p{L}*|суббот\\p{L}*', urlaub: 'отпуск\\p{L}*', krank: 'больничн\\p{L}*|боле\\p{L}*', za: 'отгул\\p{L}*', schule: 'школ\\p{L}*|учеб\\p{L}*', kunde: 'клиент\\p{L}*|заказчик\\p{L}*', task: 'деятельность|задача|работа' },
    uk: { von: 'з|від', bis: 'до|по', std: 'годин\\p{L}*|год\\.?', min: 'хвилин\\p{L}*|хв\\.?', ohne: 'без\\s+перерв\\p{L}*|без\\s+обід\\p{L}*', pause: 'перерв\\p{L}*|обід\\p{L}*', vg: 'позавчора', g: 'вчора|учора', h: 'сьогодні', tage: 'неділ\\p{L}*|понеділ\\p{L}*|вівтор\\p{L}*|серед\\p{L}*|четвер\\p{L}*|п.ятниц\\p{L}*|субот\\p{L}*', urlaub: 'відпустк\\p{L}*', krank: 'лікарнян\\p{L}*|хворі\\p{L}*', za: 'відгул\\p{L}*', schule: 'школ\\p{L}*|навчанн\\p{L}*', kunde: 'клієнт\\p{L}*|замовник\\p{L}*', task: 'діяльність|завдання|робота' }
  };
  // Zahlwörter je Sprache (0 bis 20; 21 bis 24, 30 und 45 werden daraus gebildet bzw. stehen in x). c = Grundzahl, g = Form bei Uhrzeiten
  // („od szóstej“, „с шести“). Die 1 fehlt dort, wo das Wort auch „ein/eine“ heißt (hu, tr, it, ro), sonst würde jeder Artikel zur Zahl.
  var FREMD_Z = {
    pl: { c: 'zero|jeden/jedna|dwa/dwie|trzy|cztery|pięć|sześć|siedem|osiem|dziewięć|dziesięć|jedenaście|dwanaście|trzynaście|czternaście|piętnaście|szesnaście|siedemnaście|osiemnaście|dziewiętnaście|dwadzieścia', g: '|pierwszej|drugiej|trzeciej|czwartej|piątej|szóstej|siódmej|ósmej|dziewiątej|dziesiątej|jedenastej|dwunastej|trzynastej|czternastej|piętnastej|szesnastej|siedemnastej|osiemnastej|dziewiętnastej|dwudziestej', x: { 'trzydzieści': 30, 'czterdzieści pięć': 45, 'dwudziestej pierwszej': 21, 'dwudziestej drugiej': 22, 'dwudziestej trzeciej': 23, 'dwudziestej czwartej': 24 } },
    hu: { c: 'nulla||kettő/két|három|négy|öt|hat|hét|nyolc|kilenc|tíz|tizenegy|tizenkettő/tizenkét|tizenhárom|tizennégy|tizenöt|tizenhat|tizenhét|tizennyolc|tizenkilenc|húsz', x: { 'huszonegy': 21, 'huszonkettő': 22, 'huszonkét': 22, 'huszonhárom': 23, 'huszonnégy': 24, 'harminc': 30, 'negyvenöt': 45 }, suf: '(?:tól|től|ig|kor|ra|re)?' },
    tr: { c: 'sıfır||iki|üç|dört|beş|altı|yedi|sekiz|dokuz|on|on bir|on iki|on üç|on dört|on beş|on altı|on yedi|on sekiz|on dokuz|yirmi', x: { 'otuz': 30, 'kırk beş': 45 }, suf: "(?:['’]?(?:dan|den|tan|ten|ye|ya|e|a|de|da))?" },
    cs: { c: 'nula|jedna|dvě|tři|čtyři|pět|šest|sedm|osm|devět|deset|jedenáct|dvanáct|třináct|čtrnáct|patnáct|šestnáct|sedmnáct|osmnáct|devatenáct|dvacet', g: '|jedné|dvou|tří|čtyř|pěti|šesti|sedmi|osmi|devíti|deseti|jedenácti|dvanácti|třinácti|čtrnácti|patnácti|šestnácti|sedmnácti|osmnácti|devatenácti|dvaceti', x: { 'třicet': 30, 'čtyřicet pět': 45 } },
    sk: { c: 'nula|jedna|dve|tri|štyri|päť|šesť|sedem|osem|deväť|desať|jedenásť|dvanásť|trinásť|štrnásť|pätnásť|šestnásť|sedemnásť|osemnásť|devätnásť|dvadsať', g: '|jednej|druhej|tretej|štvrtej|piatej|šiestej|siedmej|ôsmej|deviatej|desiatej|jedenástej|dvanástej|trinástej|štrnástej|pätnástej|šestnástej|sedemnástej|osemnástej|devätnástej|dvadsiatej', x: { 'tridsať': 30, 'štyridsaťpäť': 45 } },
    hr: { c: 'nula|jedan|dva|tri|četiri|pet|šest|sedam|osam|devet|deset|jedanaest|dvanaest|trinaest|četrnaest|petnaest|šesnaest|sedamnaest|osamnaest|devetnaest|dvadeset', x: { 'trideset': 30, 'četrdeset pet': 45 } },
    sr: { c: 'nula|jedan|dva|tri|četiri|pet|šest|sedam|osam|devet|deset|jedanaest|dvanaest|trinaest|četrnaest|petnaest|šesnaest|sedamnaest|osamnaest|devetnaest|dvadeset', x: { 'trideset': 30, 'četrdeset pet': 45 } },
    it: { c: 'zero||due|tre|quattro|cinque|sei|sette|otto|nove|dieci|undici|dodici|tredici|quattordici|quindici|sedici|diciassette|diciotto|diciannove|venti', x: { 'ventuno': 21, 'ventidue': 22, 'ventitré': 23, 'ventitre': 23, 'ventiquattro': 24, 'trenta': 30, 'quarantacinque': 45 } },
    ro: { c: 'zero||două/doi|trei|patru|cinci|șase/sase|șapte/sapte|opt|nouă|zece|unsprezece|doisprezece/douăsprezece|treisprezece|paisprezece|cincisprezece|șaisprezece/saisprezece|șaptesprezece|optsprezece|nouăsprezece|douăzeci', x: { 'douăzeci și unu': 21, 'douăzeci și două': 22, 'douăzeci și trei': 23, 'douăzeci și patru': 24, 'treizeci': 30, 'patruzeci și cinci': 45 } },
    ru: { c: 'ноль|один/одна|два/две|три|четыре|пять|шесть|семь|восемь|девять|десять|одиннадцать|двенадцать|тринадцать|четырнадцать|пятнадцать|шестнадцать|семнадцать|восемнадцать|девятнадцать|двадцать', g: '|одного/часу|двух|трёх/трех|четырёх/четырех|пяти|шести|семи|восьми|девяти|десяти|одиннадцати|двенадцати|тринадцати|четырнадцати|пятнадцати|шестнадцати|семнадцати|восемнадцати|девятнадцати|двадцати', x: { 'тридцать': 30, 'сорок пять': 45, 'двадцати одного': 21, 'двадцати двух': 22, 'двадцати трёх': 23, 'двадцати трех': 23, 'двадцати четырёх': 24, 'двадцати четырех': 24 } },
    uk: { c: "нуль|один/одна|два/дві|три|чотири|п'ять|шість|сім|вісім|дев'ять|десять|одинадцять|дванадцять|тринадцять|чотирнадцять|п'ятнадцять|шістнадцять|сімнадцять|вісімнадцять|дев'ятнадцять|двадцять", g: "|першої|другої|третьої|четвертої|п'ятої|шостої|сьомої|восьмої|дев'ятої|десятої|одинадцятої|дванадцятої|тринадцятої|чотирнадцятої|п'ятнадцятої|шістнадцятої|сімнадцятої|вісімнадцятої|дев'ятнадцятої|двадцятої", x: { 'тридцять': 30, "сорок п'ять": 45, 'двадцять першої': 21, 'двадцять другої': 22, 'двадцять третьої': 23, 'двадцять четвертої': 24 } }
  };
  function fremdZahlen(l) {
    var z = FREMD_Z[l], P = [], M = {}; if (!z) return null;
    function put(w, v) { if (w) { M[w.toLowerCase()] = v; P.push(w); } }
    var c = z.c.split('|'); c.forEach(function (t, i) { t.split('/').forEach(function (w) { put(w, i); }); });
    (z.g || '').split('|').forEach(function (t, i) { t.split('/').forEach(function (w) { put(w, i); }); });
    // 21 bis 24 aus „zwanzig“ + Einer, wenn die Sprache sie getrennt schreibt
    if (!z.x || !Object.keys(z.x).some(function (k) { return z.x[k] === 21 && k.indexOf(c[20].split('/')[0]) === 0; })) [1, 2, 3, 4].forEach(function (n) { (c[n] || '').split('/').forEach(function (w) { if (w) put(c[20].split('/')[0] + ' ' + w, 20 + n); }); });
    Object.keys(z.x || {}).forEach(function (k) { put(k, z.x[k]); });
    P.sort(function (a, b) { return b.length - a.length; });
    var esc = function (w) { return w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+'); };
    // Nur im Zusammenhang mit einer Uhrzeit oder Dauer umsetzen (davor „von/bis“, danach „bis“, Stunde, Minute, Pause oder eine Endung wie „-tól“),
    // damit Zahlwörter in Kundennamen und Tätigkeiten stehen bleiben („casă nouă“, „Hat Kft“).
    var w = FREMD_W[l], vb = [w.von, w.bis].filter(Boolean).join('|'), nach = [w.bis, w.std, w.min, w.pause].filter(Boolean).join('|');
    var reVor = vb ? new RegExp('(?:^|[^\\p{L}])(?:' + vb + ')\\s*$', 'iu') : null, reNach = new RegExp('^(' + (z.suf || '') + ')\\s*(?:(?:' + nach + ')(?![\\p{L}])|[-–]\\s*\\d|\\d)', 'iu'), reSuf = z.suf ? new RegExp('^' + z.suf.replace(/\)\?$/, ')') + '(?![\\p{L}\\d])', 'iu') : null;
    return [new RegExp('(^|[^\\p{L}\\d])(' + P.map(esc).join('|') + ')(?=' + (z.suf || '') + '(?![\\p{L}\\d]))', 'giu'), function (m, a, wd, off, str) {
      var v = M[wd.toLowerCase().replace(/\s+/g, ' ')]; if (v == null) return m;
      var davor = str.slice(0, off + a.length), danach = str.slice(off + m.length);
      return (reVor && reVor.test(davor)) || reNach.test(danach) || (reSuf && reSuf.test(danach)) ? a + v : m;
    }];
  }
  var FREMD_C = {};
  function fremdBau(l) {
    var w = FREMD_W[l], dig = '(\\d{1,2}(?:[:.]\\d{2})?)', NB = '(^|[^\\p{L}\\d])', NA = '(?![\\p{L}\\d])', L = [], EN = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    function W(alts, rep) { L.push([new RegExp(NB + '(?:' + alts + ')' + NA, 'giu'), function (m, a) { return a + rep; }]); }
    var zr = fremdZahlen(l); if (zr) L.push(zr);
    var H = '(?:\\s*(?:' + w.std + '))?';
    // Uhrzeitbereiche zuerst (Sonderformen je Sprache)
    if (l === 'hu') L.push([new RegExp(dig + '\\s*-?\\s*(?:órá)?(?:tól|től)\\s+' + dig + '\\s*-?\\s*(?:órá)?ig' + NA, 'giu'), '$1 to $2']);
    if (l === 'tr') { L.push([new RegExp(dig + "\\s*['’]?\\s*(?:dan|den|tan|ten)\\s+" + dig + "\\s*['’]?\\s*(?:e|a|ye|ya)(?:\\s+kadar)?" + NA, 'giu'), '$1 to $2']); L.push([new RegExp('(?:saat\\s+)?' + dig + '\\s+ile\\s+' + dig + '\\s+aras\\p{L}*', 'giu'), '$1 to $2']); }
    if (l === 'ro') L.push([new RegExp('(?:între|intre)\\s+' + dig + '\\s+(?:și|si)\\s+' + dig, 'giu'), '$1 to $2']);
    if (w.bis) L.push([new RegExp(dig + H + '\\s+(?:' + w.bis + ')\\s+' + dig + H + NA, 'giu'), '$1 to $2']);
    if (w.von) L.push([new RegExp(NB + '(?:' + w.von + ')\\s+(?=\\d{1,2}(?:[:.]\\d{2})?\\s+to\\s)', 'giu'), function (m, a) { return a + 'from '; }]);
    W(w.ohne, 'no break'); W(w.pause, 'break');
    L.push([new RegExp('(\\d)\\s*(?:' + w.min + ')' + NA, 'giu'), '$1 minutes']);
    W(w.vg, 'day before yesterday'); W(w.g, 'yesterday'); W(w.h, '');
    // Wochentage: von lang nach kurz, damit z. B. „pazartesi“ vor „pazar“ greift
    var TG = []; w.tage.split('|').forEach(function (t, i) { t.split('/').forEach(function (x) { TG.push([x, i]); }); }); TG.sort(function (a, b) { return b[0].length - a[0].length; }).forEach(function (t) { W(t[0], EN[t[1]]); });
    W(w.krank, 'sick'); W(w.urlaub, 'vacation'); W(w.za, 'time off in lieu'); W(w.schule, 'school');
    L.push([new RegExp(NB + '(?:' + w.task + ')\\s*:', 'giu'), function (m, a) { return a + 'task:'; }]);
    W(w.kunde, 'customer');
    return L;
  }
  function normFremd(s, lang) {
    if (!lang || !FREMD_W[lang]) return s;
    var L = FREMD_C[lang] || (FREMD_C[lang] = fremdBau(lang)), o = ' ' + s.replace(/[’ʼ`´]/g, "'") + ' ';
    L.forEach(function (p) { o = o.replace(p[0], p[1]); });
    o = o.replace(/\s(?:di|de)\s+break(?![\p{L}])/giu, ' break');
    return o.replace(/\s+/g, ' ').trim();
  }
  function parseSchnell(text, heute, bekannt, lang) {
    var res = { datum: heute, status: 'arbeit', von: '', bis: '', pause: null, pauseVon: '', pauseBis: '', kunden: [], gefunden: 0 };
    var s = String(text || '').replace(/\s+/g, ' ').trim();
    if (!s) return res;
    s = normFremd(s, lang);
    var W = { null: 0, eins: 1, zwei: 2, drei: 3, vier: 4, fuenf: 5, 'fünf': 5, sechs: 6, sieben: 7, acht: 8, neun: 9, zehn: 10, elf: 11, 'zwölf': 12, zwoelf: 12, dreizehn: 13, vierzehn: 14, fuenfzehn: 15, 'fünfzehn': 15, sechzehn: 16, siebzehn: 17, achtzehn: 18, neunzehn: 19, zwanzig: 20, einundzwanzig: 21, zweiundzwanzig: 22, dreiundzwanzig: 23, vierundzwanzig: 24, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 };
    // „halb sieben“ = 6:30
    s = s.replace(/\bhalb\s+(\d{1,2}|[a-zäöüß]+)\b(?!\s*(?:stunde|std))/gi, function (m, w) { var n = /^\d/.test(w) ? +w : W[w.toLowerCase()]; return n === undefined || n < 1 ? m : (n - 1) + ':30'; });
    s = s.replace(/\b([a-zäöüß]+)(?=\s*(?:uhr\b|bis\b|-|–|\s+(?:minuten|min)\b))/gi, function (m, w) { var n = W[w.toLowerCase()]; return n === undefined ? m : String(n); });
    s = s.replace(/\bvon\s+([a-zäöüß]+)\s+bis\s+([a-zäöüß]+)\b/gi, function (m, a, b) { var x = W[a.toLowerCase()], y = W[b.toLowerCase()]; return (x === undefined || y === undefined) ? m : 'von ' + x + ' bis ' + y; });
    s = s.replace(/(\d{1,2})\s*(?:uhr|h|o'clock)\s*(\d{2})\b/gi, '$1:$2');
    var rest = s;
    function nimm(rx, fn) { var m = rx.exec(rest); if (!m) return false; rest = rest.slice(0, m.index) + ' ' + rest.slice(m.index + m[0].length); fn(m); return true; }
    function zeit(h, mi) { h = +h; mi = mi === undefined || mi === '' ? 0 : +mi; if (h > 24 || mi > 59) return ''; return (h < 10 ? '0' : '') + h + ':' + (mi < 10 ? '0' : '') + mi; }
    // Datum
    var ISO = function (y, m, d) { return y + '-' + (m < 10 ? '0' : '') + m + '-' + (d < 10 ? '0' : '') + d; };
    if (!nimm(/\b(\d{1,2})\.\s?(\d{1,2})\.(?:\s?(\d{4}|\d{2}))?(?!\d)/, function (m) { var y = m[3] ? (+m[3] < 100 ? 2000 + +m[3] : +m[3]) : +heute.slice(0, 4), d = +m[1], mo = +m[2]; if (d >= 1 && d <= 31 && mo >= 1 && mo <= 12) { res.datum = ISO(y, mo, d); if (!m[3] && res.datum > heute) res.datum = ISO(y - 1, mo, d); res.gefunden++; } })) {
      if (nimm(/\bvorgestern\b|\bday before yesterday\b/i, function () { res.datum = addDays(heute, -2); res.gefunden++; })) { } else if (nimm(/\bgestern\b|\byesterday\b/i, function () { res.datum = addDays(heute, -1); res.gefunden++; })) { } else if (nimm(/\bheute\b|\btoday\b/i, function () { res.gefunden++; })) { } else {
        var WT = [['sonntag', 0], ['sunday', 0], ['montag', 1], ['monday', 1], ['dienstag', 2], ['tuesday', 2], ['mittwoch', 3], ['wednesday', 3], ['donnerstag', 4], ['thursday', 4], ['freitag', 5], ['friday', 5], ['samstag', 6], ['saturday', 6]];
        for (var i = 0; i < WT.length; i++) { if (nimm(new RegExp('\\b' + WT[i][0] + '\\b', 'i'), function () { var d = heute, g = 0; while (weekday(d) !== WT[i][1] && g++ < 7) d = addDays(d, -1); res.datum = d; res.gefunden++; })) break; }
      }
    }
    // Pause (zuerst, damit ihre Zahlen nicht als Arbeitszeit gelesen werden)
    var T = '(\\d{1,2})(?:[:.](\\d{2}))?';
    if (nimm(/\b(?:keine|ohne|no)\s+(?:pause|break)\b/i, function () { res.pause = 0; res.gefunden++; })) { }
    else if (nimm(new RegExp('\\b(?:pause|break)\\s*(?:von|:|from)?\\s*' + T + '\\s*(?:uhr)?\\s*(?:bis|-|–|to|until)\\s*' + T + '\\s*(?:uhr)?', 'i'), function (m) { var a = zeit(m[1], m[2]), b = zeit(m[3], m[4]); if (a && b) { res.pauseVon = a; res.pauseBis = b; var x = a.split(':'), y = b.split(':'); res.pause = (+y[0] * 60 + +y[1]) - (+x[0] * 60 + +x[1]); if (res.pause < 0) res.pause += 1440; res.gefunden++; } })) { }
    else {
      var P = function (n, u) { u = (u || 'min').toLowerCase(); return u.charAt(0) === 's' || u.charAt(0) === 'h' ? Math.round(+String(n).replace(',', '.') * 60) : Math.round(+String(n).replace(',', '.')); };
      var okp = function (v) { return v >= 0 && v <= 300; };
      if (nimm(/\b(?:pause|break)\s*(?:von|:|of)?\s*(\d+(?:[.,]\d+)?)\s*(min(?:uten|utes)?|stunden?|std\.?|h(?:ours?)?)?(?![:\d])/i, function (m) { var v = P(m[1], m[2]); if (okp(v)) { res.pause = v; res.gefunden++; } })) { }
      else if (nimm(/\b(\d+(?:[.,]\d+)?)\s*(min(?:uten|utes)?|stunden?|std\.?|h(?:ours?)?)\s*(?:pause|break)\b/i, function (m) { var v = P(m[1], m[2]); if (okp(v)) { res.pause = v; res.gefunden++; } })) { }
      else if (nimm(/\b(?:eine\s+)?(halbe|dreiviertel|viertel|eine|half an?|an|one)\s*(?:stunde|hour)?\s*(?:pause|break)\b|\b(?:pause|break)\s*(?:von|:|of)?\s*(?:eine\s+)?(halbe|dreiviertel|viertel|eine|half an?|an|one)\s*(?:stunde|hour)\b/i, function (m) { var w = (m[1] || m[2] || '').toLowerCase(); res.pause = /^halbe|^half/.test(w) ? 30 : /^dreiviertel/.test(w) ? 45 : /^viertel/.test(w) ? 15 : 60; res.gefunden++; })) { }
    }
    // Art des Tages ohne Arbeitszeit
    var ST = [[/\b(?:urlaub|vacation|holiday)\b/i, 'urlaub'], [/\b(?:krankenstand|krank|sick)\b/i, 'krank'], [/\b(?:zeitausgleich|time off in lieu)\b/i, 'za'], [/\b(?:berufsschule|schulung|schule|training)\b/i, 'schule'], [/\b(?:arztbesuch|arzt|doctor)\b/i, 'arzt'], [/\b(?:pflegefreistellung)\b/i, 'pflege'], [/\b(?:feiertag|public holiday)\b/i, 'feiertag']];
    // Arbeitszeit
    var sawRange = nimm(new RegExp('(?:\\bvon\\s+|\\bfrom\\s+|\\b)' + T + '\\s*(?:uhr|h)?\\s*(?:bis|-|–|to|until|till)\\s*' + T + '\\s*(?:uhr|h)?', 'i'), function (m) { var a = zeit(m[1], m[2]), b = zeit(m[3], m[4]); if (a && b) { res.von = a; res.bis = b; res.gefunden += 2; } });
    if (!sawRange) {
      nimm(new RegExp('\\b(?:ab|beginn|start(?:ed)?|von|from|at)[:\\s]+' + T + '\\s*(?:uhr)?', 'i'), function (m) { var a = zeit(m[1], m[2]); if (a) { res.von = a; res.gefunden++; } });
      nimm(new RegExp('\\b(?:bis|ende|end(?:ed)?|until)[:\\s]+' + T + '\\s*(?:uhr)?', 'i'), function (m) { var b = zeit(m[1], m[2]); if (b) { res.bis = b; res.gefunden++; } });
    }
    if (!res.von) for (var k = 0; k < ST.length; k++) { if (ST[k][0].test(rest)) { res.status = ST[k][1]; res.gefunden++; rest = rest.replace(ST[k][0], ' '); break; } }
    if (res.von && res.bis && res.bis < res.von && +res.bis.slice(0, 2) <= 12 && +res.bis.slice(0, 2) + 12 > +res.von.slice(0, 2) && +res.bis.slice(0, 2) + 12 <= 24) res.bis = ((+res.bis.slice(0, 2) + 12) + '').padStart(2, '0') + res.bis.slice(2);
    // Pause in die Schicht legen, wenn keine Uhrzeit genannt wurde
    if (res.pause && !res.pauseVon && res.von && res.bis) {
      var v = res.von.split(':'), b2 = res.bis.split(':'), vm = +v[0] * 60 + +v[1], bm = +b2[0] * 60 + +b2[1]; if (bm <= vm) bm += 1440;
      var pm = (vm < 720 && bm > 720 + res.pause) ? 720 : Math.round((vm + (bm - vm - res.pause) / 2) / 5) * 5;
      var f = function (x) { x = x % 1440; var h = Math.floor(x / 60), mi = x % 60; return (h < 10 ? '0' : '') + h + ':' + (mi < 10 ? '0' : '') + mi; };
      res.pauseVon = f(pm); res.pauseBis = f(pm + res.pause);
    }
    // Kunden und Tätigkeiten
    rest = rest.replace(/\b(?:und dann|und|and|dann|then)\b(?=\s+(?:kunde|bei|customer|for))/gi, ',');
    var teile = rest.split(/[,;\n]+/), bk = (bekannt || []).filter(Boolean).sort(function (a, b) { return b.length - a.length; });
    teile.forEach(function (t) {
      t = t.replace(/\b(?:war|waren|habe|hab|ich|am|um|den|der|die|das|heute|gearbeitet|worked|i|was|at)\b/gi, ' ').replace(/\s+/g, ' ').trim();
      var tl = /^(?:t(?:ä|ae)tigkeit|arbeit|beschreibung|work|task)\s*:\s*(.+)$/i.exec(t);
      if (tl && res.kunden.length) { var lk = res.kunden[res.kunden.length - 1]; lk.tat = (lk.tat ? lk.tat + ' ' : '') + tl[1].trim(); return; }
      var m = /^(?:kunden?|bei|für|fuer|auftrag|baustelle|customer|for|at|site)(\s*:\s*|\s+)(.+)$/i.exec(t), body = m ? m[2] : null, mitDoppelpunkt = !!(m && /:/.test(m[1]));
      if (!body) return;
      body = body.replace(/^[:\s]+/, '').trim(); if (!body) return;
      var name = '', tat = '', low = body.toLowerCase();
      for (var j = 0; j < bk.length; j++) { var bl = bk[j].toLowerCase(); if (low.indexOf(bl) === 0) { name = bk[j]; tat = body.slice(bk[j].length).replace(/^[:\s,-]+/, '').trim(); break; } }
      if (!name && mitDoppelpunkt) { name = body; }
      else if (!name) { var parts = body.split(/\s+/); name = parts.shift(); if (/^(?:firma|fa\.?|herr|frau|company|mr|mrs)$/i.test(name) && parts.length) name += ' ' + parts.shift(); tat = parts.join(' '); }
      name = name.replace(/[:,;]+$/, ''); res.kunden.push({ name: name, tat: tat }); res.gefunden++;
    });
    return res;
  }
  // Garagen/Tankstellen/Service und Fußpfleger/Kosmetiker/Masseure (wko.at 2026)
  PAKETE.garage = {
    name: 'Garagen, Tankstellen, Service (Arbeiter und Angestellte)',
    hinweis: 'KV Garagen, Tankstellen und Serviceunternehmungen, Arbeiter, Löhne ab 1.1.2026 (Quelle: wko.at): Löhne und Lehrlingseinkommen. Wochenstunden und Zuschläge stehen nicht in der Quelle: die App rechnet mit 40 Stunden pro Woche und 50 % Überstundenzuschlag (Gesetz), bitte mit dem Dienstzettel und dem Lohnzettel vergleichen. Die Lehrlinge stehen nicht in der Quelle: gib dann deinen Lehrlingslohn selbst ein.',
    pruefen: true,
    werte: {
      diaeten: { modell: 'aus', satz: 0, maxStd: null, minStd: 0, vorschlag: 'anwesenheit', stufen: [] },
      ueberstunden: { modell: 'monat', wochenStd: 40, tagesGrenze: null, zuschlagPct: 50 },
      stundenlohn: null,
      betriebFrei: 'urlaub',
      zuschlag: { art: 'kv', sa: 0, so: 100, ft: 100 },
      schlechtwetter: false
    }
  };
  LOHNGRUPPEN.garage = { stand: 'ab 1.1.2026', stufen: ['bis zum vollendeten 3. Dienstjahr', 'bis zum vollendeten 6. Dienstjahr', 'bis zum vollendeten 9. Dienstjahr', 'ab dem 10. Dienstjahr'], gruppen: [
      { id: 'GA1', m: true, name: 'Verwendungsgruppe 1 (Arbeiter/innen)', l: [2081.00, 2133.00, 2186.00, 2239.00] },
      { id: 'GA2', m: true, name: 'Verwendungsgruppe 2 (Arbeiter/innen)', l: [2117.00, 2192.00, 2268.00, 2345.00] },
      { id: 'GA3', m: true, name: 'Verwendungsgruppe 3 (Angestellte)', l: [2161.00, 2250.00, 2341.00, 2429.00] },
      { id: 'GA4', m: true, name: 'Verwendungsgruppe 4 (Angestellte)', l: [2210.00, 2312.00, 2414.00, 2517.00] },
      { id: 'GA5', m: true, name: 'Verwendungsgruppe 5 (Angestellte)', l: [2376.00, 2484.00, 2597.00, 2705.00] },
      { id: 'GA6', m: true, name: 'Verwendungsgruppe 6 (Angestellte)', l: [2564.00, 2685.00, 2803.00, 2922.00] }
    ] };
  PAKETE.kosmetik = {
    name: 'Fußpfleger-, Kosmetiker- und Masseurgewerbe (Arbeiter)',
    hinweis: 'KV Fußpfleger, Kosmetiker und Masseure, Arbeiter, Löhne ab 1.7.2026 (Quelle: wko.at): Löhne und Lehrlingseinkommen. Wochenstunden und Zuschläge stehen nicht in der Quelle: die App rechnet mit 40 Stunden pro Woche und 50 % Überstundenzuschlag (Gesetz), bitte mit dem Dienstzettel und dem Lohnzettel vergleichen. Gilt in allen Bundesländern; Tirol hat eine eigene Lohnordnung mit denselben Löhnen. Die Lehrlingssätze steigen am 1.9.2026 (in Tirol bitte mit dem Lohnzettel vergleichen).',
    pruefen: true,
    werte: {
      diaeten: { modell: 'aus', satz: 0, maxStd: null, minStd: 0, vorschlag: 'anwesenheit', stufen: [] },
      ueberstunden: { modell: 'monat', wochenStd: 40, tagesGrenze: null, zuschlagPct: 50 },
      stundenlohn: null,
      betriebFrei: 'urlaub',
      zuschlag: { art: 'kv', sa: 0, so: 100, ft: 100 },
      schlechtwetter: false
    }
  };
  LOHNGRUPPEN.kosmetik = { stand: 'ab 1.7.2026', stufen: ['Berufsjahre 1–2', 'Berufsjahre 3–5', 'ab dem 6. Berufsjahr'], gruppen: [
      { id: 'KF1', m: true, name: 'Facharbeiter/in mit Prüfung (Kosmetik, Fußpflege, Massage)', l: [2078.28, 2143.41, 2208.54] },
      { id: 'KF2', m: true, name: 'Facharbeiter/in mit mehreren Prüfungen (Kosmetik, Fußpflege, Massage, Friseur)', l: [2131.57, 2196.70, 2273.67] },
      { id: 'KF3', m: true, name: 'Angelernte/r mit fachspezifischer Ausbildung, ohne Lehrabschluss', l: [2042.75, 2042.75, 2042.75] },
      { id: 'KF4', m: true, name: 'Mit Ausbildung laut Fußpflege- oder Massage-Verordnung (Kosmetik: mindestens 650 Stunden)', stufen: ['Berufsjahr 1', 'Berufsjahre 2–3', 'ab dem 4. Berufsjahr'], l: [2013.15, 2066.44, 2143.41] },
      { id: 'KF5', m: true, name: 'Handpflege, Nagelmodellage, Visagistik, Wickeltechniken, Haarentfernung, Schlankheitsstudio', l: [2054.59, 2054.59, 2054.59] },
      { id: 'KF6', m: true, name: 'Hilfskraft ohne fachspezifische Ausbildung (Reinigung, Hilfsarbeiten)', l: [2001.30, 2001.30, 2001.30] },
      { id: 'KFL1', m: true, lehrling: true, name: 'Lehrling, 1. Lehrjahr', l: [800.00] },
      { id: 'KFL2', m: true, lehrling: true, name: 'Lehrling, 2. Lehrjahr', l: [900.00] },
      { id: 'KFL3', m: true, lehrling: true, name: 'Lehrling, 3. Lehrjahr', l: [1200.00] },
      { id: 'KFL4', m: true, lehrling: true, name: 'Lehrling, 4. Lehrjahr', l: [1400.00] }
    ], folgt: [{ ab: '2026-09-01', stand: 'ab 1.9.2026', gruppen: { KFL1: [816.00], KFL2: [930.00], KFL3: [1240.00], KFL4: [1445.00] } }] };
  // Fable 12.11.2026: Seilbahnen, Reisebüros, Immobilienverwalter, Steuerberatung, Information und Consulting
  PAKETE.seilbahn = {
    name: 'Seilbahnen (Arbeiter und Angestellte)',
    hinweis: 'KV Seilbahnen, Arbeiter und Angestellte, ab 1.5.2026 (Quelle: wko.at): 40 Stunden/Woche im Durchschnitt (Durchrechnung 1.10. bis 30.9.), Stundenlohn = Monatslohn ÷ 173. Überstunden 50 %, zwischen 19 und 7 Uhr 100 %. Nachtarbeit in der Normalarbeitszeit (19 bis 7 Uhr) 10 % und der Sonntagszuschlag im Sommer (25 %, nur in bestimmten Betrieben) sind nicht eingerechnet: bitte selbst als Prämie eintragen. Stufe 0 beim Eintritt, Stufe 1 nach 12 Monaten, danach alle 6 Jahre eine Stufe; Fachkräfte beginnen in Stufe 2. Bitte vergleiche mit deinem Dienstzettel.',
    pruefen: true,
    werte: {
      diaeten: { modell: 'aus', satz: 0, maxStd: null, minStd: 0, vorschlag: 'anwesenheit', stufen: [] },
      ueberstunden: { modell: 'monat', wochenStd: 40, tagesGrenze: null, zuschlagPct: 50 },
      stundenlohn: null,
      betriebFrei: 'urlaub',
      zuschlag: { art: 'kv', sa: 0, so: 0, ft: 100 },
      schlechtwetter: false
    }
  };
  LOHNGRUPPEN.seilbahn = { stand: 'ab 1.5.2026', stufen: ['Stufe 0 (im 1. Jahr)', 'Stufe 1 (nach 12 Monaten)', 'Stufe 2', 'Stufe 3', 'Stufe 4', 'Stufe 5', 'Stufe 13 (altes Schema, Eintritt vor 1.9.1998)', 'Stufe 14 (altes Schema, Eintritt vor 1.9.1998)', 'Stufe 15 (altes Schema, Eintritt vor 1.9.1998)', 'Stufe 16 (altes Schema, Eintritt vor 1.9.1998)', 'Stufe 17 (altes Schema, Eintritt vor 1.9.1998)', 'Stufe 18 (altes Schema, Eintritt vor 1.9.1998)', 'Stufe 19 (altes Schema, Eintritt vor 1.9.1998)', 'Stufe 20 (altes Schema, Eintritt vor 1.9.1998)'], teiler: 173, gruppen: [
      { id: 'SBA', m: true, name: 'Gruppe A: ohne besondere Vorkenntnisse', stufen: ['Stufe 0 (im 1. Jahr)', 'Stufe 1 (nach 12 Monaten)'], l: [2218.00, 2366.00] },
      { id: 'SBB', m: true, name: 'Gruppe B: mit fachspezifischen Vorkenntnissen (z. B. Stationsdienst, Kassa, Pistenrettung, Pistengerät im 1. und 2. Dienstjahr)', l: [2255.00, 2478.00, 2656.00, 2833.00, 2957.00, 3019.00, 3085.00, 3151.00, 3222.00, 3288.00, 3367.00, 3430.00, 3496.00, 3567.00] },
      { id: 'SBC', m: true, name: 'Gruppe C: qualifizierte Tätigkeit (z. B. Maschinist mit Prüfung, Beschneier, Pistengerät ab dem 3. Dienstjahr, Fachkraft mit Lehrabschluss)', l: [2360.00, 2599.00, 2806.00, 3014.00, 3167.00, 3243.00, 3326.00, 3405.00, 3488.00, 3566.00, 3648.00, 3728.00, 3811.00, 3885.00] },
      { id: 'SBD', m: true, name: 'Gruppe D: besonders qualifiziert mit großer Verantwortung (z. B. Obermaschinist, Vorarbeiter)', l: [2427.00, 2702.00, 2925.00, 3171.00, 3342.00, 3430.00, 3514.00, 3600.00, 3685.00, 3772.00, 3860.00, 3943.00, 4022.00, 4111.00] },
      { id: 'SBE', m: true, name: 'Gruppe E: sehr große Verantwortung (z. B. Betriebsleitung)', l: [2511.00, 2795.00, 3028.00, 3282.00, 3459.00, 3550.00, 3637.00, 3726.00, 3815.00, 3902.00, 3994.00, 4080.00, 4163.00, 4255.00] },
      { id: 'SBL1', m: true, lehrling: true, name: 'Lehrling, 1. Lehrjahr', l: [1331.00] },
      { id: 'SBL2', m: true, lehrling: true, name: 'Lehrling, 2. Lehrjahr', l: [1553.00] },
      { id: 'SBL3', m: true, lehrling: true, name: 'Lehrling, 3. Lehrjahr', l: [1774.00] },
      { id: 'SBL4', m: true, lehrling: true, name: 'Lehrling, 4. Lehrjahr', l: [2218.00] }
    ] };
  PAKETE.reisebuero_ang = {
    name: 'Büro: Reisebüros (Angestellte)',
    hinweis: 'KV Reisebüros, Angestellte, ab 1.1.2026 (Quelle: wko.at): Mindestgehälter nach Verwendungsgruppe und Gruppendienstjahren, Lehrlingseinkommen. Wochenstunden und Zuschläge stehen nicht in der Gehaltsordnung: die App rechnet mit 40 Stunden pro Woche und 50 % Überstundenzuschlag (Gesetz), bitte mit dem Dienstzettel vergleichen.',
    pruefen: true,
    werte: {
      diaeten: { modell: 'aus', satz: 0, maxStd: null, minStd: 0, vorschlag: 'anwesenheit', stufen: [] },
      ueberstunden: { modell: 'monat', wochenStd: 40, tagesGrenze: null, zuschlagPct: 50 },
      stundenlohn: null,
      betriebFrei: 'urlaub',
      zuschlag: { art: 'kv', sa: 0, so: 100, ft: 100 },
      schlechtwetter: false
    }
  };
  LOHNGRUPPEN.reisebuero_ang = { stand: 'ab 1.1.2026', stufen: ['Gruppendienstjahr 1 bis 3', 'Gruppendienstjahr 4 bis 7', 'Gruppendienstjahr 8 bis 11', 'Gruppendienstjahr 12 bis 15', 'Gruppendienstjahr 16 bis 19', 'ab Gruppendienstjahr 20'], gruppen: [
      { id: 'RBA', m: true, name: 'Verwendungsgruppe A', l: [2018.00, 2070.00, 2120.00, 2206.00, 2307.00, 2424.00] },
      { id: 'RBB', m: true, name: 'Verwendungsgruppe B', l: [2099.00, 2162.00, 2225.00, 2327.00, 2443.00, 2572.00] },
      { id: 'RBC', m: true, name: 'Verwendungsgruppe C', l: [2225.00, 2314.00, 2417.00, 2546.00, 2700.00, 2907.00] },
      { id: 'RBD', m: true, name: 'Verwendungsgruppe D', l: [2365.00, 2520.00, 2712.00, 2971.00, 3227.00, 3548.00] },
      { id: 'RBE', m: true, name: 'Verwendungsgruppe E', l: [2623.00, 2880.00, 3177.00, 3509.00, 3883.00, 4334.00] },
      { id: 'RBL1', m: true, lehrling: true, name: 'Lehrling, 1. Lehrjahr', l: [900.00] },
      { id: 'RBL2', m: true, lehrling: true, name: 'Lehrling, 2. Lehrjahr', l: [1050.00] },
      { id: 'RBL3', m: true, lehrling: true, name: 'Lehrling, 3. Lehrjahr', l: [1400.00] },
      { id: 'RBL4', m: true, lehrling: true, name: 'Lehrling, 4. Lehrjahr', l: [1700.00] }
    ] };
  PAKETE.immobilien_ang = {
    name: 'Büro: Immobilienverwalter (Angestellte)',
    hinweis: 'KV Immobilienverwalter, Angestellte, ab 1.4.2026 (Quelle: wko.at): Mindestgehälter nach Verwendungsgruppe und Verwendungsgruppenjahren, Lehrlingseinkommen mit und ohne Matura. Wochenstunden und Zuschläge stehen nicht in der Gehaltsordnung: die App rechnet mit 40 Stunden pro Woche und 50 % Überstundenzuschlag (Gesetz), bitte mit dem Dienstzettel vergleichen.',
    pruefen: true,
    werte: {
      diaeten: { modell: 'aus', satz: 0, maxStd: null, minStd: 0, vorschlag: 'anwesenheit', stufen: [] },
      ueberstunden: { modell: 'monat', wochenStd: 40, tagesGrenze: null, zuschlagPct: 50 },
      stundenlohn: null,
      betriebFrei: 'urlaub',
      zuschlag: { art: 'kv', sa: 0, so: 100, ft: 100 },
      schlechtwetter: false
    }
  };
  LOHNGRUPPEN.immobilien_ang = { stand: 'ab 1.4.2026', stufen: ['im 1. und 2. Verwendungsgruppenjahr', 'nach 2 Verwendungsgruppenjahren', 'nach 4 Verwendungsgruppenjahren', 'nach 6 Verwendungsgruppenjahren', 'nach 8 Verwendungsgruppenjahren', 'nach 10 Verwendungsgruppenjahren', 'nach 12 Verwendungsgruppenjahren'], gruppen: [
      { id: 'IM2', m: true, name: 'Verwendungsgruppe II', l: [2005.00, 2071.00, 2137.00, 2206.00, 2272.00, 2418.00, 2518.00] },
      { id: 'IM3', m: true, name: 'Verwendungsgruppe III', l: [2268.00, 2400.00, 2534.00, 2734.00, 2868.00, 2998.00, 3133.00] },
      { id: 'IM4', m: true, name: 'Verwendungsgruppe IV', l: [2793.00, 2926.00, 3125.00, 3326.00, 3489.00, 3691.00, 3857.00] },
      { id: 'IM5', m: true, name: 'Verwendungsgruppe V', l: [3401.00, 3634.00, 3872.00, 4106.00, 4339.00, 4574.00, 4777.00] },
      { id: 'IML1', m: true, lehrling: true, name: 'Lehrling ohne Matura, 1. Lehrjahr', l: [871.00] },
      { id: 'IML2', m: true, lehrling: true, name: 'Lehrling ohne Matura, 2. Lehrjahr', l: [1179.00] },
      { id: 'IML3', m: true, lehrling: true, name: 'Lehrling ohne Matura, 3. Lehrjahr', l: [1435.00] },
      { id: 'IMM1', m: true, lehrling: true, name: 'Lehrling mit Matura, 1. Lehrjahr', l: [1076.00] },
      { id: 'IMM2', m: true, lehrling: true, name: 'Lehrling mit Matura, 2. Lehrjahr', l: [1435.00] },
      { id: 'IMM3', m: true, lehrling: true, name: 'Lehrling mit Matura, 3. Lehrjahr', l: [1743.00] }
    ] };
  PAKETE.ic_ang = {
    name: 'Büro: Information und Consulting (Angestellte)',
    hinweis: 'KV Information und Consulting, Angestellte, ab 1.1.2026 (Quelle: wko.at): gilt für Entsorgungs- und Ressourcenmanagement, Finanzdienstleister, Ingenieurbüros, Buchhaltungsberufe und Unternehmensberatung (nicht für IT). Wochenstunden und Zuschläge stehen nicht in der Gehaltsordnung: die App rechnet mit 40 Stunden pro Woche und 50 % Überstundenzuschlag (Gesetz), bitte mit dem Dienstzettel vergleichen.',
    pruefen: true,
    werte: {
      diaeten: { modell: 'aus', satz: 0, maxStd: null, minStd: 0, vorschlag: 'anwesenheit', stufen: [] },
      ueberstunden: { modell: 'monat', wochenStd: 40, tagesGrenze: null, zuschlagPct: 50 },
      stundenlohn: null,
      betriebFrei: 'urlaub',
      zuschlag: { art: 'kv', sa: 0, so: 100, ft: 100 },
      schlechtwetter: false
    }
  };
  LOHNGRUPPEN.ic_ang = { stand: 'ab 1.1.2026', stufen: ['im 1. und 2. Verwendungsgruppenjahr', 'nach 2 Verwendungsgruppenjahren', 'nach 4 Verwendungsgruppenjahren', 'nach 6 Verwendungsgruppenjahren', 'nach 8 Verwendungsgruppenjahren', 'nach 10 Verwendungsgruppenjahren', 'nach 12 Verwendungsgruppenjahren', 'nach 15 Verwendungsgruppenjahren'], gruppen: [
      { id: 'IC1', m: true, name: 'Verwendungsgruppe I', stufen: ['im 1. und 2. Verwendungsgruppenjahr', 'nach 2 Verwendungsgruppenjahren'], l: [2136.19, 2136.19] },
      { id: 'IC2', m: true, name: 'Verwendungsgruppe II', l: [2173.58, 2303.13, 2446.61, 2596.81, 2747.07, 2897.29, 3026.08, 3262.11] },
      { id: 'IC3', m: true, name: 'Verwendungsgruppe III', l: [2534.74, 2712.15, 2889.59, 3067.03, 3241.27, 3418.51, 3570.46, 3848.99] },
      { id: 'IC4', m: true, name: 'Verwendungsgruppe IV', l: [3157.47, 3378.48, 3599.52, 3820.52, 4041.55, 4262.61, 4452.04, 4799.37] },
      { id: 'IC5', m: true, name: 'Verwendungsgruppe V', l: [3933.50, 4208.81, 4484.17, 4759.51, 5034.87, 5310.23, 5546.19, 5978.89] },
      { id: 'IC6', m: true, name: 'Verwendungsgruppe VI', stufen: ['im 1. und 2. Verwendungsgruppenjahr', 'nach 2 Verwendungsgruppenjahren', 'nach 5 Verwendungsgruppenjahren'], l: [5491.52, 6177.96, 6864.42] },
      { id: 'ICL1', m: true, lehrling: true, name: 'Lehrling, 1. Lehrjahr', l: [1000.00] },
      { id: 'ICL2', m: true, lehrling: true, name: 'Lehrling, 2. Lehrjahr', l: [1236.00] },
      { id: 'ICL3', m: true, lehrling: true, name: 'Lehrling, 3. Lehrjahr', l: [1526.00] },
      { id: 'ICL4', m: true, lehrling: true, name: 'Lehrling, 4. Lehrjahr', l: [1752.00] }
    ] };
  PAKETE.steuerberatung_ang = {
    name: 'Büro: Steuerberatung und Wirtschaftsprüfung (Angestellte)',
    hinweis: 'KV Steuerberatung und Wirtschaftsprüfung, Angestellte, ab 1.1.2026 (Quelle: gpa.at): Tabelle für Dienstverhältnisse ab 1.1.2015. 40 Stunden/Woche, Überstunden 50 %, zwischen 20 und 7 Uhr sowie an Sonn- und Feiertagen 100 %, Überstundenteiler 1/160. Wer vor 2015 eingetreten ist, hat eine eigene Tabelle: dann bitte „Eigene Werte“ verwenden. Bitte vergleiche mit deinem Dienstzettel.',
    pruefen: true,
    werte: {
      diaeten: { modell: 'aus', satz: 0, maxStd: null, minStd: 0, vorschlag: 'anwesenheit', stufen: [] },
      ueberstunden: { modell: 'monat', wochenStd: 40, tagesGrenze: null, zuschlagPct: 50, ueberTeiler: 160 },
      stundenlohn: null,
      betriebFrei: 'urlaub',
      zuschlag: { art: 'kv', sa: 0, so: 100, ft: 100 },
      schlechtwetter: false
    }
  };
  LOHNGRUPPEN.steuerberatung_ang = { stand: 'ab 1.1.2026', stufen: ['Berufsjahr 1', 'Berufsjahr 2', 'Berufsjahr 3', 'Berufsjahr 4', 'Berufsjahr 5', 'Berufsjahr 6', 'Berufsjahr 7', 'Berufsjahr 8', 'Berufsjahr 9', 'Berufsjahr 10', 'Berufsjahr 11', 'Berufsjahr 12', 'Berufsjahr 13', 'Berufsjahr 14', 'Berufsjahr 15'], gruppen: [
      { id: 'STI', m: true, name: 'Gruppe I: Angestellte ohne die Voraussetzungen der Gruppen II bis IV (Einstieg)', l: [2110.00, 2140.00, 2170.00, 2220.00, 2270.00, 2310.00, 2360.00, 2400.00, 2440.00, 2480.00, 2510.00, 2540.00, 2570.00, 2600.00, 2620.00] },
      { id: 'STIIa', m: true, name: 'Gruppe IIa: einfache Buchhaltung, Verwaltung, Assistenz', l: [2340.00, 2370.00, 2420.00, 2480.00, 2550.00, 2610.00, 2680.00, 2730.00, 2780.00, 2830.00, 2870.00, 2900.00, 2930.00, 2970.00, 3000.00] },
      { id: 'STIIb', m: true, name: 'Gruppe IIb: einfache Buchhaltung, Verwaltung, Assistenz', l: [2370.00, 2420.00, 2480.00, 2540.00, 2600.00, 2670.00, 2730.00, 2790.00, 2840.00, 2890.00, 2930.00, 2960.00, 3000.00, 3030.00, 3060.00] },
      { id: 'STIIIa', m: true, name: 'Gruppe IIIa: Buchhaltung, Lohnverrechnung, qualifizierte Assistenz', l: [2510.00, 2570.00, 2630.00, 2700.00, 2780.00, 2850.00, 2930.00, 2990.00, 3050.00, 3110.00, 3160.00, 3210.00, 3250.00, 3290.00, 3320.00] },
      { id: 'STIIIb', m: true, name: 'Gruppe IIIb: Buchhaltung, Lohnverrechnung, qualifizierte Assistenz', l: [2560.00, 2620.00, 2680.00, 2760.00, 2840.00, 2920.00, 2990.00, 3060.00, 3130.00, 3190.00, 3240.00, 3290.00, 3340.00, 3380.00, 3410.00] },
      { id: 'STIVa', m: true, name: 'Gruppe IVa: Bilanzbuchhaltung, Steuersachbearbeitung, prüfende Tätigkeit', stufen: ['Berufsjahr 2', 'Berufsjahr 3', 'Berufsjahr 4', 'Berufsjahr 5', 'Berufsjahr 6', 'Berufsjahr 7', 'Berufsjahr 8', 'Berufsjahr 9', 'Berufsjahr 10', 'Berufsjahr 11', 'Berufsjahr 12', 'Berufsjahr 13', 'Berufsjahr 14', 'Berufsjahr 15'], l: [3080.00, 3170.00, 3280.00, 3400.00, 3520.00, 3630.00, 3750.00, 3860.00, 3960.00, 4050.00, 4110.00, 4170.00, 4220.00, 4260.00] },
      { id: 'STIVb', m: true, name: 'Gruppe IVb: Bilanzbuchhaltung, Steuersachbearbeitung, prüfende Tätigkeit', stufen: ['Berufsjahr 2', 'Berufsjahr 3', 'Berufsjahr 4', 'Berufsjahr 5', 'Berufsjahr 6', 'Berufsjahr 7', 'Berufsjahr 8', 'Berufsjahr 9', 'Berufsjahr 10', 'Berufsjahr 11', 'Berufsjahr 12', 'Berufsjahr 13', 'Berufsjahr 14', 'Berufsjahr 15'], l: [3150.00, 3250.00, 3360.00, 3480.00, 3610.00, 3730.00, 3840.00, 3960.00, 4060.00, 4150.00, 4220.00, 4270.00, 4320.00, 4370.00] },
      { id: 'STL1', m: true, lehrling: true, name: 'Lehrling, 1. Lehrjahr', l: [1080.00] },
      { id: 'STL2', m: true, lehrling: true, name: 'Lehrling, 2. Lehrjahr', l: [1290.00] },
      { id: 'STL3', m: true, lehrling: true, name: 'Lehrling, 3. Lehrjahr', l: [1520.00] },
      { id: 'STL4', m: true, lehrling: true, name: 'Lehrling, 4. Lehrjahr', l: [1870.00] }
    ] };
  // Fable 12.11.2026: Kuranstalten/Reha und Agrarservice (wko.at)
  PAKETE.kur_reha = {
    name: 'Kuranstalten und Rehabilitationseinrichtungen',
    hinweis: 'KV Kuranstalten und Rehabilitationseinrichtungen, 1.5.2026 bis 30.4.2027 (Quelle: wko.at): Mindestlöhne und Mindestgehälter nach Verwendungsgruppe und Dienstjahren. Zulage für Nachtdienst (20 bis 6 Uhr) sowie für Sonn- und Feiertagsdienst: 7,29 € je Stunde, bei mehr als 4 Stunden pauschal 48,56 €: bitte als Prämie eintragen. Ärztezulagen (590 € bzw. 655 € im Monat) sind nicht eingerechnet. Wochenstunden stehen nicht in der Quelle: die App rechnet mit 40 Stunden pro Woche und 50 % Überstundenzuschlag (Gesetz), bitte mit dem Dienstzettel vergleichen.',
    pruefen: true,
    werte: {
      diaeten: { modell: 'aus', satz: 0, maxStd: null, minStd: 0, vorschlag: 'anwesenheit', stufen: [] },
      ueberstunden: { modell: 'monat', wochenStd: 40, tagesGrenze: null, zuschlagPct: 50 },
      stundenlohn: null,
      betriebFrei: 'urlaub',
      zuschlag: { art: 'kv', sa: 0, so: 0, ft: 100 },
      schlechtwetter: false
    }
  };
  LOHNGRUPPEN.kur_reha = { stand: '1.5.2026 bis 30.4.2027', stufen: ['Dienstjahre 1–2', 'Dienstjahre 3–4', 'Dienstjahre 5–6', 'Dienstjahre 7–8', 'Dienstjahre 9–10', 'Dienstjahre 11–12', 'Dienstjahre 13–14', 'Dienstjahre 15–16', 'Dienstjahre 17–18', 'Dienstjahre 19–20', 'Dienstjahre 21–22', 'Dienstjahre 23–24', 'Dienstjahre 25–26', 'Dienstjahre 27–28', 'Dienstjahre 29–30', 'Dienstjahre 31–32', 'Dienstjahre 33–34', 'ab dem 35. Dienstjahr'], gruppen: [
      { id: 'KRV1', m: true, name: 'Verwaltung VG 1: Sekretariat und Verwaltung', l: [2218.00, 2319.00, 2361.00, 2409.00, 2454.00, 2503.00, 2549.00, 2599.00, 2644.00, 2692.00, 2739.00, 2786.00, 2837.00, 2882.00, 2928.00, 2975.00, 3026.00, 3072.00] },
      { id: 'KRV2', m: true, name: 'Verwaltung VG 2: Fachkraft mit Lehrabschluss', l: [2361.00, 2413.00, 2462.00, 2514.00, 2561.00, 2612.00, 2664.00, 2712.00, 2764.00, 2811.00, 2863.00, 2912.00, 2962.00, 3013.00, 3061.00, 3113.00, 3163.00, 3215.00] },
      { id: 'KRV3', m: true, name: 'Verwaltung VG 3: Sachbearbeitung mit Spezialwissen (z. B. IT, Buchhaltung, Lohnverrechnung)', l: [2593.00, 2698.00, 2749.00, 2803.00, 2858.00, 2912.00, 2965.00, 3020.00, 3073.00, 3126.00, 3183.00, 3235.00, 3290.00, 3345.00, 3400.00, 3458.00, 3512.00, 3568.00] },
      { id: 'KRV4', m: true, name: 'Verwaltung VG 4: Abteilungsleitung', l: [3005.00, 3136.00, 3205.00, 3277.00, 3343.00, 3411.00, 3479.00, 3550.00, 3616.00, 3685.00, 3751.00, 3823.00, 3893.00, 3964.00, 4034.00, 4104.00, 4173.00, 4243.00] },
      { id: 'KRM1', m: true, name: 'Medizin VG 1: Masseur/in, Heilmasseur/in, Ordinationsassistenz', stufen: ['Dienstjahre 1–2', 'Dienstjahre 3–4', 'Dienstjahre 5–6', 'Dienstjahre 7–8', 'Dienstjahre 9–10', 'Dienstjahre 11–15', 'Dienstjahre 16–20', 'Dienstjahre 21–25', 'Dienstjahre 26–30', 'Dienstjahre 31–35', 'ab dem 36. Dienstjahr'], l: [2316.00, 2361.00, 2413.00, 2462.00, 2514.00, 2624.00, 2734.00, 2845.00, 2957.00, 3067.00, 3179.00] },
      { id: 'KRM2', m: true, name: 'Medizin VG 2: Pflegeassistenz, Labor- und Röntgenassistenz', l: [2475.00, 2523.00, 2574.00, 2624.00, 2675.00, 2726.00, 2776.00, 2828.00, 2876.00, 2926.00, 2977.00, 3028.00, 3078.00, 3127.00, 3179.00, 3229.00, 3280.00, 3330.00] },
      { id: 'KRM3', m: true, name: 'Medizin VG 3: Pflegefachassistenz, medizinische Fachassistenz', l: [2639.00, 2689.00, 2738.00, 2785.00, 2837.00, 2884.00, 2935.00, 2984.00, 3032.00, 3083.00, 3132.00, 3182.00, 3229.00, 3278.00, 3328.00, 3377.00, 3427.00, 3476.00] },
      { id: 'KRM4', m: true, name: 'Medizin VG 4: Diplomierte Gesundheits- und Krankenpflege', stufen: ['Dienstjahre 1–3', 'Dienstjahre 4–5', 'Dienstjahre 6–7', 'Dienstjahre 8–9', 'Dienstjahre 10–11', 'Dienstjahre 12–13', 'Dienstjahre 14–15', 'Dienstjahre 16–17', 'Dienstjahre 18–19', 'Dienstjahre 20–21', 'Dienstjahre 22–23', 'Dienstjahre 24–25', 'Dienstjahre 26–27', 'Dienstjahre 28–29', 'Dienstjahre 30–31', 'Dienstjahre 32–33', 'Dienstjahre 34–35', 'ab dem 36. Dienstjahr'], l: [3095.00, 3157.00, 3221.00, 3284.00, 3347.00, 3409.00, 3473.00, 3537.00, 3599.00, 3661.00, 3724.00, 3787.00, 3849.00, 3914.00, 3977.00, 4042.00, 4105.00, 4170.00] },
      { id: 'KRM5', m: true, name: 'Medizin VG 5: Therapie (MTD), Sportwissenschaft, Sozialarbeit', stufen: ['Dienstjahre 1–3', 'Dienstjahre 4–5', 'Dienstjahre 6–7', 'Dienstjahre 8–9', 'Dienstjahre 10–11', 'Dienstjahre 12–13', 'Dienstjahre 14–15', 'Dienstjahre 16–17', 'Dienstjahre 18–19', 'Dienstjahre 20–21', 'Dienstjahre 22–23', 'Dienstjahre 24–25', 'Dienstjahre 26–27', 'Dienstjahre 28–29', 'Dienstjahre 30–31', 'Dienstjahre 32–33', 'Dienstjahre 34–35', 'ab dem 36. Dienstjahr'], l: [3114.00, 3178.00, 3239.00, 3302.00, 3366.00, 3429.00, 3490.00, 3554.00, 3618.00, 3681.00, 3743.00, 3806.00, 3869.00, 3932.00, 3995.00, 4059.00, 4123.00, 4187.00] },
      { id: 'KRM6', m: true, name: 'Medizin VG 6: Psychotherapie, klinische Psychologie', stufen: ['Dienstjahre 1–2', 'Dienstjahre 3–4', 'Dienstjahre 5–6', 'Dienstjahre 7–8', 'Dienstjahre 9–10', 'Dienstjahre 11–15', 'Dienstjahre 16–20', 'Dienstjahre 21–25', 'Dienstjahre 26–30', 'Dienstjahre 31–35', 'ab dem 36. Dienstjahr'], l: [3560.00, 3623.00, 3687.00, 3748.00, 3830.00, 3912.00, 3995.00, 4077.00, 4159.00, 4242.00, 4365.00] },
      { id: 'KRM7', m: true, name: 'Medizin VG 7: Allgemeinmedizin', stufen: ['Dienstjahre 1–2', 'Dienstjahre 3–4', 'Dienstjahre 5–6', 'Dienstjahre 7–8', 'Dienstjahre 9–10', 'Dienstjahre 11–15', 'Dienstjahre 16–20', 'Dienstjahre 21–25', 'Dienstjahre 26–30', 'Dienstjahre 31–35', 'ab dem 36. Dienstjahr'], l: [4522.00, 4606.00, 4689.00, 4833.00, 4977.00, 5129.00, 5280.00, 5432.00, 5584.00, 5736.00, 5963.00] },
      { id: 'KRM8', m: true, name: 'Medizin VG 8: Facharzt/Fachärztin', stufen: ['Dienstjahre 1–2', 'Dienstjahre 3–4', 'Dienstjahre 5–6', 'Dienstjahre 7–8', 'Dienstjahre 9–10', 'Dienstjahre 11–15', 'Dienstjahre 16–20', 'Dienstjahre 21–25', 'Dienstjahre 26–30', 'Dienstjahre 31–35', 'ab dem 36. Dienstjahr'], l: [6029.00, 6175.00, 6319.00, 6512.00, 6704.00, 6926.00, 7151.00, 7375.00, 7598.00, 7823.00, 8155.00] }
    ] };
  PAKETE.agrar = {
    name: 'Agrarservice (Arbeiter)',
    hinweis: 'KV Agrarservice (gewerbliche Agrarunternehmer), Arbeiter, 1.3.2026 bis 28.2.2027 (Quelle: wko.at): 38,5 Stunden/Woche, Stundenlohn = Monatslohn ÷ 167,4. Überstunden 50 %, an Sonn- und Feiertagen und in der Nacht 100 %, Sonntagsarbeit 100 %. Nachtzulage 3,13 € je Stunde (22 bis 5 Uhr), Taggeld 30 €, Nächtigungsgeld 17 €. Bei betrieblicher 40-Stunden-Woche gelten höhere Monatslöhne: bitte mit dem Dienstzettel vergleichen.',
    pruefen: true,
    werte: {
      diaeten: { modell: 'tag', satz: 0, maxStd: null, minStd: 0, vorschlag: 'anwesenheit', stufen: [{ ab: 1, satz: 30 }] },
      ueberstunden: { modell: 'monat', wochenStd: 38.5, tagesGrenze: null, zuschlagPct: 50 },
      stundenlohn: null,
      betriebFrei: 'urlaub',
      zuschlag: { art: 'kv', sa: 0, so: 100, ft: 100 },
      schlechtwetter: false
    }
  };
  LOHNGRUPPEN.agrar = { stand: '1.3.2026 bis 28.2.2027', stufen: null, teiler: 167.4, gruppen: [
      { id: 'AG1', name: 'Lohngruppe 1: einfache Tätigkeiten (z. B. Pflanzarbeiten, händische Ernte)', l: [12.05] },
      { id: 'AG2', name: 'Lohngruppe 2: angelernte Arbeiter/innen', l: [12.43] },
      { id: 'AG3', name: 'Lohngruppe 3: Facharbeiter/in mit landwirtschaftlichem Lehrabschluss', l: [13.17] },
      { id: 'AG4', name: 'Lohngruppe 4: Maschinenführer/in (Traktor, Arbeitsmaschinen)', l: [14.07] },
      { id: 'AG5', name: 'Lohngruppe 5: Professionist/in im erlernten Beruf (z. B. Landmaschinentechnik)', l: [14.67] }
    ] };
  // Rauchfangkehrer Tirol und Vorarlberg: letzte veröffentlichte Lohnordnung (1.1.2025), wko.at
  PAKETE.rk_t = {
    name: 'Rauchfangkehrer Tirol (Arbeiter)',
    hinweis: 'KV Rauchfangkehrer Tirol, Arbeiter, Löhne ab 1.1.2025 (Quelle: wko.at): Monatslöhne und Lehrlingseinkommen. Durchschnittlich 40 Stunden pro Woche (bis 48 möglich). Die Schmutzzulage und weitere Zulagen sind als Prämien vorgeschlagen, den Betrag nimmst du vom Lohnzettel. Nachtzuschlag und Stundenteiler stehen nicht überall in der Quelle: die App rechnet mit 50 % Überstundenzuschlag, bitte mit dem Dienstzettel und dem Lohnzettel vergleichen. Für 2026 ist noch keine neue Lohnordnung veröffentlicht: das sind die letzten bekannten Mindestlöhne.',
    pruefen: true,
    werte: {
      diaeten: { modell: 'aus', satz: 0, maxStd: null, minStd: 0, vorschlag: 'anwesenheit', stufen: [] },
      ueberstunden: { modell: 'monat', wochenStd: 40, tagesGrenze: null, zuschlagPct: 50 },
      stundenlohn: null,
      betriebFrei: 'urlaub',
      zuschlag: { art: 'kv', sa: 0, so: 0, ft: 100 },
      schlechtwetter: false
    }
  };
  LOHNGRUPPEN.rk_t = { stand: 'ab 1.1.2025', stufen: ['Berufsjahre 1–2', 'Berufsjahre 3–4', 'ab dem 5. Berufsjahr'], gruppen: [
      { id: 'RT1', m: true, name: 'Geselle/Gesellin mit Meisterprüfung', l: [2671.05, 2671.05, 2671.05] },
      { id: 'RT2', m: true, name: 'Geselle/Gesellin, darf Überprüfungs- und Wartungsarbeiten selbständig ausführen', l: [2671.05, 2671.05, 2671.05] },
      { id: 'RT3', m: true, name: 'Geselle/Gesellin mit Lehrabschluss', l: [2439.20, 2516.50, 2586.36] },
      { id: 'RT4', m: true, name: 'Arbeitnehmer/in ohne Lehrabschluss (Rauchfangkehrer)', l: [2251.38, 2251.38, 2439.20] },
      { id: 'RLt1', m: true, lehrling: true, name: 'Lehrling, 1. Lehrjahr', l: [675.77] },
      { id: 'RLt2', m: true, lehrling: true, name: 'Lehrling, 2. Lehrjahr', l: [943.72] },
      { id: 'RLt3', m: true, lehrling: true, name: 'Lehrling, 3. Lehrjahr', l: [1188.94] }
    ] };
  PAKETE.rk_vbg = {
    name: 'Rauchfangkehrer Vorarlberg (Arbeiter)',
    hinweis: 'KV Rauchfangkehrer Vorarlberg, Arbeiter, Löhne ab 1.1.2025 (Quelle: wko.at): Monatslöhne und Lehrlingseinkommen. Durchschnittlich 40 Stunden pro Woche (bis 48 möglich). Die Schmutzzulage und weitere Zulagen sind als Prämien vorgeschlagen, den Betrag nimmst du vom Lohnzettel. Nachtzuschlag und Stundenteiler stehen nicht überall in der Quelle: die App rechnet mit 50 % Überstundenzuschlag, bitte mit dem Dienstzettel und dem Lohnzettel vergleichen. Für 2026 ist noch keine neue Lohnordnung veröffentlicht: das sind die letzten bekannten Mindestlöhne.',
    pruefen: true,
    werte: {
      diaeten: { modell: 'aus', satz: 0, maxStd: null, minStd: 0, vorschlag: 'anwesenheit', stufen: [] },
      ueberstunden: { modell: 'monat', wochenStd: 40, tagesGrenze: null, zuschlagPct: 50 },
      stundenlohn: null,
      betriebFrei: 'urlaub',
      zuschlag: { art: 'kv', sa: 0, so: 0, ft: 100 },
      schlechtwetter: false
    }
  };
  LOHNGRUPPEN.rk_vbg = { stand: 'ab 1.1.2025', stufen: ['Berufsjahre 1–2', 'Berufsjahre 3–4', 'ab dem 5. Berufsjahr'], gruppen: [
      { id: 'RV1', m: true, name: 'Geselle/Gesellin mit Lehrabschluss', l: [2000.00, 2100.00, 2100.00] },
      { id: 'RV2', m: true, name: 'Arbeitnehmer/in ohne Lehrabschluss (Rauchfangkehrer)', l: [2000.00, 2100.00, 2100.00] },
      { id: 'RLv1', m: true, lehrling: true, name: 'Lehrling, 1. Lehrjahr', l: [1000.00] },
      { id: 'RLv2', m: true, lehrling: true, name: 'Lehrling, 2. Lehrjahr', l: [1200.00] },
      { id: 'RLv3', m: true, lehrling: true, name: 'Lehrling, 3. Lehrjahr', l: [1400.00] }
    ] };
  // Hotel- und Gastgewerbe, Angestellte: Gehaltsordnungen ab 1.10.2026 (wko.at), vier Tabellen je nach Bundesland
  PAKETE.gastro_ang_wh = {
    name: 'Hotel- und Gastgewerbe, Angestellte: Wien (Hotellerie)',
    hinweis: 'KV Hotel- und Gastgewerbe, Angestellte, Gehaltsordnung ab 1.10.2026 (Quelle: wko.at): Mindestgehälter nach Beschäftigungsgruppe und Dienstjahren, je nach Bundesland verschieden. Wochenstunden und Zuschläge stehen nicht in der Gehaltsordnung: die App rechnet mit 40 Stunden pro Woche und 50 % Überstundenzuschlag (Gesetz), bitte mit dem Dienstzettel vergleichen.',
    pruefen: true,
    werte: {
      diaeten: { modell: 'aus', satz: 0, maxStd: null, minStd: 0, vorschlag: 'anwesenheit', stufen: [] },
      ueberstunden: { modell: 'monat', wochenStd: 40, tagesGrenze: null, zuschlagPct: 50 },
      stundenlohn: null,
      betriebFrei: 'urlaub',
      zuschlag: { art: 'kv', sa: 0, so: 0, ft: 0 },
      schlechtwetter: false
    }
  };
  LOHNGRUPPEN.gastro_ang_wh = { stand: 'ab 1.10.2026', stufen: ['bis 5 Dienstjahre', 'ab dem 6. Dienstjahr', 'ab dem 11. Dienstjahr', 'ab dem 16. Dienstjahr', 'ab dem 21. Dienstjahr'], gruppen: [
      { id: 'A0', m: true, name: 'Beschäftigungsgruppe 0', l: [3050.00, 3126.30, 3202.50, 3278.80, 3355.00] },
      { id: 'A1', m: true, name: 'Beschäftigungsgruppe 1', l: [2771.00, 2840.30, 2909.60, 2978.80, 3048.10] },
      { id: 'A2', m: true, name: 'Beschäftigungsgruppe 2', l: [2557.00, 2620.90, 2684.90, 2748.80, 2812.70] },
      { id: 'A3', m: true, name: 'Beschäftigungsgruppe 3', l: [2330.00, 2388.30, 2446.50, 2504.80, 2563.00] },
      { id: 'A4', m: true, name: 'Beschäftigungsgruppe 4', l: [2153.00, 2206.80, 2260.70, 2314.50, 2368.30] },
      { id: 'A5', m: true, name: 'Beschäftigungsgruppe 5', stufen: ['bis 5 Dienstjahre', 'ab dem 6. Dienstjahr'], l: [2096.50, 2148.90] },
      { id: 'AL1', m: true, lehrling: true, name: 'Lehrling, 1. Lehrjahr', l: [1090.00] },
      { id: 'AL2', m: true, lehrling: true, name: 'Lehrling, 2. Lehrjahr', l: [1220.00] },
      { id: 'AL3', m: true, lehrling: true, name: 'Lehrling, 3. Lehrjahr', l: [1445.00] },
      { id: 'AL4', m: true, lehrling: true, name: 'Lehrling, 4. Lehrjahr oder Doppellehre', l: [1550.00] }
    ] };
  PAKETE.gastro_ang_w = {
    name: 'Hotel- und Gastgewerbe, Angestellte: Wien (Gastronomie und Kaffeehäuser)',
    hinweis: 'KV Hotel- und Gastgewerbe, Angestellte, Gehaltsordnung ab 1.10.2026 (Quelle: wko.at): Mindestgehälter nach Beschäftigungsgruppe und Dienstjahren, je nach Bundesland verschieden. Wochenstunden und Zuschläge stehen nicht in der Gehaltsordnung: die App rechnet mit 40 Stunden pro Woche und 50 % Überstundenzuschlag (Gesetz), bitte mit dem Dienstzettel vergleichen.',
    pruefen: true,
    werte: {
      diaeten: { modell: 'aus', satz: 0, maxStd: null, minStd: 0, vorschlag: 'anwesenheit', stufen: [] },
      ueberstunden: { modell: 'monat', wochenStd: 40, tagesGrenze: null, zuschlagPct: 50 },
      stundenlohn: null,
      betriebFrei: 'urlaub',
      zuschlag: { art: 'kv', sa: 0, so: 0, ft: 0 },
      schlechtwetter: false
    }
  };
  LOHNGRUPPEN.gastro_ang_w = { stand: 'ab 1.10.2026', stufen: ['bis 5 Dienstjahre', 'ab dem 6. Dienstjahr', 'ab dem 11. Dienstjahr', 'ab dem 16. Dienstjahr', 'ab dem 21. Dienstjahr'], gruppen: [
      { id: 'A0', m: true, name: 'Beschäftigungsgruppe 0', l: [2924.00, 2997.10, 3070.20, 3143.30, 3216.40] },
      { id: 'A1', m: true, name: 'Beschäftigungsgruppe 1', l: [2771.00, 2840.30, 2909.60, 2978.80, 3048.10] },
      { id: 'A2', m: true, name: 'Beschäftigungsgruppe 2', l: [2328.00, 2386.20, 2444.40, 2502.60, 2560.80] },
      { id: 'A3', m: true, name: 'Beschäftigungsgruppe 3', l: [2232.00, 2287.80, 2343.60, 2399.40, 2455.20] },
      { id: 'A4', m: true, name: 'Beschäftigungsgruppe 4', l: [2153.00, 2206.80, 2260.70, 2314.50, 2368.30] },
      { id: 'A5', m: true, name: 'Beschäftigungsgruppe 5', stufen: ['bis 5 Dienstjahre', 'ab dem 6. Dienstjahr'], l: [2096.50, 2148.90] },
      { id: 'AL1', m: true, lehrling: true, name: 'Lehrling, 1. Lehrjahr', l: [1090.00] },
      { id: 'AL2', m: true, lehrling: true, name: 'Lehrling, 2. Lehrjahr', l: [1220.00] },
      { id: 'AL3', m: true, lehrling: true, name: 'Lehrling, 3. Lehrjahr', l: [1445.00] },
      { id: 'AL4', m: true, lehrling: true, name: 'Lehrling, 4. Lehrjahr oder Doppellehre', l: [1550.00] }
    ] };
  PAKETE.gastro_ang_c = {
    name: 'Hotel- und Gastgewerbe, Angestellte: Burgenland, Kärnten, Niederösterreich, Oberösterreich, Steiermark',
    hinweis: 'KV Hotel- und Gastgewerbe, Angestellte, Gehaltsordnung ab 1.10.2026 (Quelle: wko.at): Mindestgehälter nach Beschäftigungsgruppe und Dienstjahren, je nach Bundesland verschieden. Wochenstunden und Zuschläge stehen nicht in der Gehaltsordnung: die App rechnet mit 40 Stunden pro Woche und 50 % Überstundenzuschlag (Gesetz), bitte mit dem Dienstzettel vergleichen.',
    pruefen: true,
    werte: {
      diaeten: { modell: 'aus', satz: 0, maxStd: null, minStd: 0, vorschlag: 'anwesenheit', stufen: [] },
      ueberstunden: { modell: 'monat', wochenStd: 40, tagesGrenze: null, zuschlagPct: 50 },
      stundenlohn: null,
      betriebFrei: 'urlaub',
      zuschlag: { art: 'kv', sa: 0, so: 0, ft: 0 },
      schlechtwetter: false
    }
  };
  LOHNGRUPPEN.gastro_ang_c = { stand: 'ab 1.10.2026', stufen: ['bis 5 Dienstjahre', 'ab dem 6. Dienstjahr', 'ab dem 11. Dienstjahr', 'ab dem 16. Dienstjahr', 'ab dem 21. Dienstjahr'], gruppen: [
      { id: 'A0', m: true, name: 'Beschäftigungsgruppe 0', l: [2745.00, 2813.60, 2882.30, 2950.90, 3019.50] },
      { id: 'A1', m: true, name: 'Beschäftigungsgruppe 1', l: [2618.00, 2683.50, 2748.90, 2814.40, 2879.80] },
      { id: 'A2', m: true, name: 'Beschäftigungsgruppe 2', l: [2304.00, 2361.60, 2419.20, 2476.80, 2534.40] },
      { id: 'A3', m: true, name: 'Beschäftigungsgruppe 3', l: [2226.00, 2281.70, 2337.30, 2393.00, 2448.60] },
      { id: 'A4', m: true, name: 'Beschäftigungsgruppe 4', l: [2153.00, 2206.80, 2260.70, 2314.50, 2368.30] },
      { id: 'A5', m: true, name: 'Beschäftigungsgruppe 5', stufen: ['bis 5 Dienstjahre', 'ab dem 6. Dienstjahr'], l: [2096.50, 2148.90] },
      { id: 'AL1', m: true, lehrling: true, name: 'Lehrling, 1. Lehrjahr', l: [1090.00] },
      { id: 'AL2', m: true, lehrling: true, name: 'Lehrling, 2. Lehrjahr', l: [1220.00] },
      { id: 'AL3', m: true, lehrling: true, name: 'Lehrling, 3. Lehrjahr', l: [1445.00] },
      { id: 'AL4', m: true, lehrling: true, name: 'Lehrling, 4. Lehrjahr oder Doppellehre', l: [1550.00] }
    ] };
  PAKETE.gastro_ang_d = {
    name: 'Hotel- und Gastgewerbe, Angestellte: Salzburg, Tirol, Vorarlberg',
    hinweis: 'KV Hotel- und Gastgewerbe, Angestellte, Gehaltsordnung ab 1.10.2026 (Quelle: wko.at): Mindestgehälter nach Beschäftigungsgruppe und Dienstjahren, je nach Bundesland verschieden. Wochenstunden und Zuschläge stehen nicht in der Gehaltsordnung: die App rechnet mit 40 Stunden pro Woche und 50 % Überstundenzuschlag (Gesetz), bitte mit dem Dienstzettel vergleichen.',
    pruefen: true,
    werte: {
      diaeten: { modell: 'aus', satz: 0, maxStd: null, minStd: 0, vorschlag: 'anwesenheit', stufen: [] },
      ueberstunden: { modell: 'monat', wochenStd: 40, tagesGrenze: null, zuschlagPct: 50 },
      stundenlohn: null,
      betriebFrei: 'urlaub',
      zuschlag: { art: 'kv', sa: 0, so: 0, ft: 0 },
      schlechtwetter: false
    }
  };
  LOHNGRUPPEN.gastro_ang_d = { stand: 'ab 1.10.2026', stufen: ['bis 5 Dienstjahre', 'ab dem 6. Dienstjahr', 'ab dem 11. Dienstjahr', 'ab dem 16. Dienstjahr', 'ab dem 21. Dienstjahr'], gruppen: [
      { id: 'A0', m: true, name: 'Beschäftigungsgruppe 0', l: [3050.00, 3126.30, 3202.50, 3278.80, 3355.00] },
      { id: 'A1', m: true, name: 'Beschäftigungsgruppe 1', l: [2646.00, 2712.20, 2778.30, 2844.50, 2910.60] },
      { id: 'A2', m: true, name: 'Beschäftigungsgruppe 2', l: [2395.00, 2454.90, 2514.80, 2574.60, 2634.50] },
      { id: 'A3', m: true, name: 'Beschäftigungsgruppe 3', l: [2330.00, 2388.30, 2446.50, 2504.80, 2563.00] },
      { id: 'A4', m: true, name: 'Beschäftigungsgruppe 4', l: [2153.00, 2206.80, 2260.70, 2314.50, 2368.30] },
      { id: 'A5', m: true, name: 'Beschäftigungsgruppe 5', stufen: ['bis 5 Dienstjahre', 'ab dem 6. Dienstjahr'], l: [2096.50, 2148.90] },
      { id: 'AL1', m: true, lehrling: true, name: 'Lehrling, 1. Lehrjahr', l: [1090.00] },
      { id: 'AL2', m: true, lehrling: true, name: 'Lehrling, 2. Lehrjahr', l: [1220.00] },
      { id: 'AL3', m: true, lehrling: true, name: 'Lehrling, 3. Lehrjahr', l: [1445.00] },
      { id: 'AL4', m: true, lehrling: true, name: 'Lehrling, 4. Lehrjahr oder Doppellehre', l: [1550.00] }
    ] };
  // Taxi: Landes-KVs mit Tagesgeld (Tirol 2023, Vorarlberg 2025, Salzburg 2023, Steiermark 2015; unbefristet)
  var TAXI_BL = { t: [12, 'Tirol'], vbg: [30, 'Vorarlberg'], sbg: [18, 'Salzburg'], stmk: [16.80, 'Steiermark'] }, TAXI_H = { t: 'KV Personenbeförderungsgewerbe mit Pkw (Taxi), Arbeiter, ab 1.1.2026 (Quelle: wko.at): bundesweiter Mindestlohn 2.060,00 € brutto im Monat, bei kürzerer Arbeitszeit anteilig. Lohngruppen gibt es nicht. Normalarbeitszeit im Taxi bis 55 Stunden/Woche (Grundstundenlohn 1/238 des Monatslohns), bei Schülertransport, Krankenbeförderung und ähnlichen Fahrten 45 Stunden (1/173). Überstunden 50 %. Für Nacht, Sonntag und Feiertag nennt der KV keine eigenen Zuschläge, es gilt das Gesetz. Urlaubs- und Weihnachtsgeld je ein Mindestmonatslohn (fällig 1. Juni und 1. Dezember). Landes-KV Tirol: Tagesgeld 12,00 € je Kalendertag bei mehr als 3 Stunden Fahrt oder Abwesenheit, für jede angefangene Stunde 1/12 (höchstens ein Tagessatz am Tag), sofern keine Betriebsvereinbarung etwas anderes regelt. Lehrlinge sind nicht geregelt.', vbg: 'KV Personenbeförderungsgewerbe mit Pkw (Taxi), Arbeiter, ab 1.1.2026 (Quelle: wko.at): bundesweiter Mindestlohn 2.060,00 € brutto im Monat, bei kürzerer Arbeitszeit anteilig. Lohngruppen gibt es nicht. Normalarbeitszeit im Taxi bis 55 Stunden/Woche (Grundstundenlohn 1/238 des Monatslohns), bei Schülertransport, Krankenbeförderung und ähnlichen Fahrten 45 Stunden (1/173). Überstunden 50 %. Für Nacht, Sonntag und Feiertag nennt der KV keine eigenen Zuschläge, es gilt das Gesetz. Urlaubs- und Weihnachtsgeld je ein Mindestmonatslohn (fällig 1. Juni und 1. Dezember). Landes-KV Vorarlberg: Tagesgeld 30,00 € je Kalendertag bei mehr als 3 Stunden Fahrt oder Abwesenheit, für jede angefangene Stunde 1/12 (höchstens ein Tagessatz am Tag), sofern keine Betriebsvereinbarung etwas anderes regelt. Lehrlinge sind nicht geregelt.', sbg: 'KV Personenbeförderungsgewerbe mit Pkw (Taxi), Arbeiter, ab 1.1.2026 (Quelle: wko.at): bundesweiter Mindestlohn 2.060,00 € brutto im Monat, bei kürzerer Arbeitszeit anteilig. Lohngruppen gibt es nicht. Normalarbeitszeit im Taxi bis 55 Stunden/Woche (Grundstundenlohn 1/238 des Monatslohns), bei Schülertransport, Krankenbeförderung und ähnlichen Fahrten 45 Stunden (1/173). Überstunden 50 %. Für Nacht, Sonntag und Feiertag nennt der KV keine eigenen Zuschläge, es gilt das Gesetz. Urlaubs- und Weihnachtsgeld je ein Mindestmonatslohn (fällig 1. Juni und 1. Dezember). Landes-KV Salzburg: Tagesgeld 18,00 € je Kalendertag bei mehr als 3 Stunden Fahrt oder Abwesenheit, für jede angefangene Stunde 1/12 (höchstens ein Tagessatz am Tag), sofern keine Betriebsvereinbarung etwas anderes regelt. Lehrlinge sind nicht geregelt.', stmk: 'KV Personenbeförderungsgewerbe mit Pkw (Taxi), Arbeiter, ab 1.1.2026 (Quelle: wko.at): bundesweiter Mindestlohn 2.060,00 € brutto im Monat, bei kürzerer Arbeitszeit anteilig. Lohngruppen gibt es nicht. Normalarbeitszeit im Taxi bis 55 Stunden/Woche (Grundstundenlohn 1/238 des Monatslohns), bei Schülertransport, Krankenbeförderung und ähnlichen Fahrten 45 Stunden (1/173). Überstunden 50 %. Für Nacht, Sonntag und Feiertag nennt der KV keine eigenen Zuschläge, es gilt das Gesetz. Urlaubs- und Weihnachtsgeld je ein Mindestmonatslohn (fällig 1. Juni und 1. Dezember). Landes-KV Steiermark: Tagesgeld 16,80 € je Kalendertag bei mehr als 3 Stunden Fahrt oder Abwesenheit, für jede angefangene Stunde 1/12 (höchstens ein Tagessatz am Tag), sofern keine Betriebsvereinbarung etwas anderes regelt. Lehrlinge sind nicht geregelt.' };
  Object.keys(TAXI_BL).forEach(function (k) {
    var p = clone(PAKETE.taxi); p.name = 'Taxi und Mietwagen (Arbeiter), ' + TAXI_BL[k][1]; p.hinweis = TAXI_H[k];
    p.werte.diaeten = { modell: 'stunde', satz: Math.round(TAXI_BL[k][0] / 12 * 100) / 100, maxStd: 12, minStd: 3, vorschlag: 'anwesenheit', stufen: [] };
    PAKETE['taxi_' + k] = p; LOHNGRUPPEN['taxi_' + k] = clone(LOHNGRUPPEN.taxi);
  });
  // Textilindustrie: eigene Lohnordnungen für Tirol und Vorarlberg ab 1.4.2026 (wko.at), Arbeitszeit und Zuschläge wie im Rahmen-KV
  [['t', 'Tirol', [2058, 2104, 2152, 2295, 2498, 2926]], ['vbg', 'Vorarlberg', [2058, 2138, 2233, 2351, 2539, 2940]]].forEach(function (x) {
    var p = clone(PAKETE.textil); p.name = 'Textilindustrie (Arbeiter), ' + x[1]; PAKETE['textil_' + x[0]] = p;
    var l = clone(LOHNGRUPPEN.textil); l.stand = 'ab 1.4.2026, ' + x[1]; ['TA', 'TB', 'TC', 'TD', 'TE', 'TF'].forEach(function (id, i) { l.gruppen.filter(function (g) { return g.id === id; })[0].l = [x[2][i]]; }); LOHNGRUPPEN['textil_' + x[0]] = l;
  });
  // Lebensmittelindustrie (Fable/Opus 12.11.2026): Obst/Gemüse/Tiefkühl, Getränke mit Kohlensäure, Fleischwarenindustrie
  PAKETE.lm_obst = {
    name: 'Lebensmittelindustrie: Obst, Gemüse, Tiefkühlwaren (Arbeiter)',
    hinweis: 'KV Obst- und Gemüseverarbeitung, Tiefkühlwarenerzeugung, Arbeiter, ab 1.1.2026 (Quelle: wko.at), österreichweit: Stunden- und Monatslöhne (Stundenlohn = Monatslohn ÷ 173,2, also 40 Stunden/Woche), Lehrlingseinkommen. Überstunden 50 %. Dienstalterszulagen sind als Stufen eingerechnet. Schicht-, Nacht- und Kältezuschläge stehen nicht in der Lohnordnung (Rahmen-KV): bitte mit Dienstzettel und Lohnzettel vergleichen.',
    pruefen: true,
    werte: {
      diaeten: { modell: 'aus', satz: 0, maxStd: null, minStd: 0, vorschlag: 'anwesenheit', stufen: [] },
      ueberstunden: { modell: 'monat', wochenStd: 40, tagesGrenze: null, zuschlagPct: 50 },
      stundenlohn: null,
      betriebFrei: 'urlaub',
      zuschlag: { art: 'kv', sa: 0, so: 100, ft: 100 },
      schlechtwetter: false
    }
  };
  LOHNGRUPPEN.lm_obst = { stand: 'ab 1.1.2026', stufen: ['bis 3 Dienstjahre', 'nach dem 3. Dienstjahr', 'nach dem 5. Dienstjahr', 'nach dem 10. Dienstjahr', 'nach dem 15. Dienstjahr', 'nach dem 20. Dienstjahr', 'nach dem 25. Dienstjahr'], teiler: 173.2, gruppen: [
      { id: 'LO1', m: true, name: 'Lohngruppe 1: Vorarbeiter/in mit eigenem Verantwortungsbereich', l: [2691.00, 2710.66, 2721.38, 2726.75, 2735.69, 2746.41, 2754.71] },
      { id: 'LO2', m: true, name: 'Lohngruppe 2: Professionist/in, Kraftfahrer/in, Maschinenführer/in mit größerer Verantwortung', l: [2551.00, 2570.66, 2581.38, 2586.75, 2595.69, 2606.41, 2614.71] },
      { id: 'LO3', m: true, name: 'Lohngruppe 3: qualifizierte Arbeit, Portier/in, Staplerfahrer/in, Maschinenführer/in', l: [2307.00, 2326.66, 2337.38, 2342.75, 2351.69, 2362.41, 2370.71] },
      { id: 'LO3a', m: true, name: 'Lohngruppe 3a: Ladner/in', l: [2246.00, 2265.66, 2276.38, 2281.75, 2290.69, 2301.41, 2309.71] },
      { id: 'LO4', m: true, name: 'Lohngruppe 4: sonstige Arbeitnehmer/innen ab dem 2. Beschäftigungsjahr', l: [2195.00, 2214.66, 2225.38, 2230.75, 2239.69, 2250.41, 2258.71] },
      { id: 'LO5', m: true, name: 'Lohngruppe 5: Arbeitnehmer/innen im 1. Beschäftigungsjahr', stufen: ['bis 3 Dienstjahre'], l: [2078.00] },
      { id: 'LOL1', m: true, lehrling: true, name: 'Lehrling, 1. Lehrjahr', l: [1000.90] },
      { id: 'LOL2', m: true, lehrling: true, name: 'Lehrling, 2. Lehrjahr', l: [1293.00] },
      { id: 'LOL3', m: true, lehrling: true, name: 'Lehrling, 3. Lehrjahr', l: [1585.00] }
    ] };
  PAKETE.lm_getraenke = {
    name: 'Lebensmittelindustrie: Getränke mit Kohlensäure (Arbeiter)',
    hinweis: 'KV kohlensäurehaltige Getränkeerzeugung, Arbeiter, ab 1.1.2026 (Quelle: wko.at): gilt in allen Bundesländern außer Salzburg. 38,5 Stunden/Woche, Stundenlohn = Monatslohn ÷ 167. Zehrgeld für Fahrpersonal 22,62 € ab 6 Stunden Abwesenheit (als Prämie vorgeschlagen). Dienstalterszulagen sind als Stufen eingerechnet. Schicht-, Nacht- und Kältezuschläge stehen nicht in der Lohnordnung (Rahmen-KV): bitte mit Dienstzettel und Lohnzettel vergleichen.',
    pruefen: true,
    werte: {
      diaeten: { modell: 'aus', satz: 0, maxStd: null, minStd: 0, vorschlag: 'anwesenheit', stufen: [] },
      ueberstunden: { modell: 'monat', wochenStd: 38.5, tagesGrenze: null, zuschlagPct: 50 },
      stundenlohn: null,
      betriebFrei: 'urlaub',
      zuschlag: { art: 'kv', sa: 0, so: 100, ft: 100 },
      schlechtwetter: false
    }
  };
  LOHNGRUPPEN.lm_getraenke = { stand: 'ab 1.1.2026', stufen: ['bis 3 Dienstjahre', 'nach dem 3. Dienstjahr', 'nach dem 5. Dienstjahr', 'nach dem 10. Dienstjahr', 'nach dem 15. Dienstjahr', 'nach dem 20. Dienstjahr', 'nach dem 25. Dienstjahr'], teiler: 167, gruppen: [
      { id: 'LG1', m: true, name: 'Lohngruppe 1: Facharbeiter/in', l: [2892.00, 2934.26, 2939.54, 2948.00, 2954.86, 2960.67, 2965.43] },
      { id: 'LG2', m: true, name: 'Lohngruppe 2: Kraftfahrer/in, Fahrverkäufer/in', l: [2458.00, 2500.26, 2505.54, 2514.00, 2520.86, 2526.67, 2531.43] },
      { id: 'LG3', m: true, name: 'Lohngruppe 3: Füller/in, Siruper/in', l: [2403.00, 2445.26, 2450.54, 2459.00, 2465.86, 2471.67, 2476.43] },
      { id: 'LG4', m: true, name: 'Lohngruppe 4: angelernte Arbeit (z. B. Staplerfahrer/in, Mitfahrer/in nach 1 Jahr)', l: [2373.00, 2415.26, 2420.54, 2429.00, 2435.86, 2441.67, 2446.43] },
      { id: 'LG5', m: true, name: 'Lohngruppe 5: Arbeitnehmer/in', l: [2265.00, 2307.26, 2312.54, 2321.00, 2327.86, 2333.67, 2338.43] },
      { id: 'LGL1', m: true, lehrling: true, name: 'Lehrling, 1. Lehrjahr', l: [867.60] },
      { id: 'LGL2', m: true, lehrling: true, name: 'Lehrling, 2. Lehrjahr', l: [1156.80] },
      { id: 'LGL3', m: true, lehrling: true, name: 'Lehrling, 3. Lehrjahr', l: [1735.20] }
    ] };
  PAKETE.lm_fleisch = {
    name: 'Lebensmittelindustrie: Fleischwaren (Arbeiter)',
    hinweis: 'KV Fleischwarenindustrie, Arbeiter, ab 1.7.2026 (Quelle: dielebensmittel.at, Verband der Fleischwarenindustrie), österreichweit für Mitgliedsfirmen: 38,5 Stunden/Woche, Stundenlohn = Monatslohn ÷ 167. Zehrgeld bei betriebsbedingter Abwesenheit über 6 Stunden 13,38 €, über 9 Stunden 23,66 €; Staplerzulage 7,5 % (als Prämie vorgeschlagen). Für Fleischer im Gewerbe gilt der Beruf „Fleischer“. Dienstalterszulagen sind als Stufen eingerechnet. Schicht-, Nacht- und Kältezuschläge stehen nicht in der Lohnordnung (Rahmen-KV): bitte mit Dienstzettel und Lohnzettel vergleichen.',
    pruefen: true,
    werte: {
      diaeten: { modell: 'aus', satz: 0, maxStd: null, minStd: 0, vorschlag: 'anwesenheit', stufen: [] },
      ueberstunden: { modell: 'monat', wochenStd: 38.5, tagesGrenze: null, zuschlagPct: 50 },
      stundenlohn: null,
      betriebFrei: 'urlaub',
      zuschlag: { art: 'kv', sa: 0, so: 100, ft: 100 },
      schlechtwetter: false
    }
  };
  LOHNGRUPPEN.lm_fleisch = { stand: 'ab 1.7.2026', stufen: ['bis 5 Dienstjahre', 'nach 5 Dienstjahren', 'nach 10 Dienstjahren', 'nach 15 Dienstjahren', 'nach 20 Dienstjahren', 'nach 25 Dienstjahren'], teiler: 167, gruppen: [
      { id: 'LF1', m: true, name: 'Kategorie 1: Partieführer/in, Gehilf/in, selbständige Stockarbeit, Selcher/in, Ausschneider/in', l: [3373.73, 3403.88, 3412.57, 3431.32, 3451.87, 3475.36] },
      { id: 'LF2', m: true, name: 'Kategorie 2: Facharbeiter/in, Mechaniker/in, Elektriker/in, Schlosser/in (nach 2 Jahren im Betrieb)', l: [3101.07, 3131.22, 3139.91, 3158.66, 3179.21, 3202.70] },
      { id: 'LF3', m: true, name: 'Kategorie 3: Maschinist/in, geprüfte/r Heizer/in, Professionist/in, Kraftfahrer/in', l: [2911.92, 2942.07, 2950.76, 2969.51, 2990.06, 3013.55] },
      { id: 'LF4', m: true, name: 'Kategorie 4: Facharbeiter/in im 1. Berufsjahr', l: [2824.59, 2854.74, 2863.43, 2882.18, 2902.73, 2926.22] },
      { id: 'LF5', m: true, name: 'Kategorie 5: Angelernte/r, Staplerfahrer/in', l: [2385.56, 2415.71, 2424.40, 2443.15, 2463.70, 2487.19] },
      { id: 'LF6', m: true, name: 'Kategorie 6: Arbeitnehmer/in', l: [2295.86, 2326.01, 2334.70, 2353.45, 2374.00, 2397.49] },
      { id: 'LF7', m: true, name: 'Kategorie 7: Arbeitnehmer/in in den ersten 3 Monaten', stufen: ['bis 5 Dienstjahre'], l: [2094.52] },
      { id: 'LF8', m: true, name: 'Kategorie 8: Ladner/in nach dem 1. Jahr', l: [2294.76, 2324.91, 2333.60, 2352.35, 2372.90, 2396.39] },
      { id: 'LF9', m: true, name: 'Kategorie 9: Ladner/in im 1. Jahr', l: [2075.04, 2105.19, 2113.88, 2132.63, 2153.18, 2176.67] },
      { id: 'LFL1', m: true, lehrling: true, name: 'Lehrling, 1. Lehrjahr', l: [998.69] },
      { id: 'LFL2', m: true, lehrling: true, name: 'Lehrling, 2. Lehrjahr', l: [1283.09] },
      { id: 'LFL3', m: true, lehrling: true, name: 'Lehrling, 3. Lehrjahr', l: [1853.35] },
      { id: 'LFL4', m: true, lehrling: true, name: 'Lehrling, 4. Lehrjahr', l: [1995.91] }
    ] };
  // Kinobetriebe: Lohnordnungen aller Bundesländer 1.4.2026 bis 31.3.2027 (wko.at), Stundenlöhne für Eintritte ab 1.4.2019
  PAKETE.kino_w = {
    name: 'Kinobetriebe (Arbeiter), Wien',
    hinweis: 'KV Kinobetriebe, Arbeiter, Lohnordnung Wien vom 1.4.2026 bis 31.3.2027 (Quelle: wko.at): Bruttomindeststundenlöhne nach Lohngruppe für Eintritte ab 1.4.2019. Wer vorher eingetreten ist, hat teils höhere Sätze nach Tätigkeit (z. B. Filmvorführer nach Saalanzahl): dann bitte „Eigene Werte“ mit dem Stundenlohn laut Lohnzettel. Wochenstunden und Zuschläge stehen nicht in der Lohnordnung: die App rechnet mit 40 Stunden pro Woche und 50 % Überstundenzuschlag (Gesetz). Lehrlinge sind nicht geregelt.',
    pruefen: true,
    werte: {
      diaeten: { modell: 'aus', satz: 0, maxStd: null, minStd: 0, vorschlag: 'anwesenheit', stufen: [] },
      ueberstunden: { modell: 'monat', wochenStd: 40, tagesGrenze: null, zuschlagPct: 50 },
      stundenlohn: null,
      betriebFrei: 'urlaub',
      zuschlag: { art: 'kv', sa: 0, so: 0, ft: 100 },
      schlechtwetter: false
    }
  };
  LOHNGRUPPEN.kino_w = { stand: '1.4.2026 bis 31.3.2027', stufen: null, gruppen: [
      { id: 'KI1', name: 'Lohngruppe I: einfache Tätigkeiten (Billeteur/in, Kassa, Büffet, Reinigung)', l: [10.05] },
      { id: 'KI2', name: 'Lohngruppe II (Wien, Eintritt ab 1.4.2026)', l: [13.10] },
      { id: 'KI3', name: 'Lohngruppe III (Wien, Eintritt ab 1.4.2026)', l: [16.24] },
      { id: 'KI4', name: 'Lohngruppe II (Wien, Eintritt 1.4.2019 bis 31.3.2026)', l: [16.24] }
    ] };
  PAKETE.kino_noe = {
    name: 'Kinobetriebe (Arbeiter), Niederösterreich',
    hinweis: 'KV Kinobetriebe, Arbeiter, Lohnordnung Niederösterreich vom 1.4.2026 bis 31.3.2027 (Quelle: wko.at): Bruttomindeststundenlöhne nach Lohngruppe für Eintritte ab 1.4.2019. Wer vorher eingetreten ist, hat teils höhere Sätze nach Tätigkeit (z. B. Filmvorführer nach Saalanzahl): dann bitte „Eigene Werte“ mit dem Stundenlohn laut Lohnzettel. Wochenstunden und Zuschläge stehen nicht in der Lohnordnung: die App rechnet mit 40 Stunden pro Woche und 50 % Überstundenzuschlag (Gesetz). Lehrlinge sind nicht geregelt.',
    pruefen: true,
    werte: {
      diaeten: { modell: 'aus', satz: 0, maxStd: null, minStd: 0, vorschlag: 'anwesenheit', stufen: [] },
      ueberstunden: { modell: 'monat', wochenStd: 40, tagesGrenze: null, zuschlagPct: 50 },
      stundenlohn: null,
      betriebFrei: 'urlaub',
      zuschlag: { art: 'kv', sa: 0, so: 0, ft: 100 },
      schlechtwetter: false
    }
  };
  LOHNGRUPPEN.kino_noe = { stand: '1.4.2026 bis 31.3.2027', stufen: null, gruppen: [
      { id: 'KI1', name: 'Lohngruppe I: einfache Tätigkeiten (Billeteur/in, Kassa, Büffet, Reinigung)', l: [10.05] },
      { id: 'KI2', name: 'Lohngruppe II: Filmvorführung oder Haustechnik mit Berufsabschluss', l: [10.68] }
    ] };
  PAKETE.kino_bgld = {
    name: 'Kinobetriebe (Arbeiter), Burgenland',
    hinweis: 'KV Kinobetriebe, Arbeiter, Lohnordnung Burgenland vom 1.4.2026 bis 31.3.2027 (Quelle: wko.at): Bruttomindeststundenlöhne nach Lohngruppe für Eintritte ab 1.4.2019. Wer vorher eingetreten ist, hat teils höhere Sätze nach Tätigkeit (z. B. Filmvorführer nach Saalanzahl): dann bitte „Eigene Werte“ mit dem Stundenlohn laut Lohnzettel. Wochenstunden und Zuschläge stehen nicht in der Lohnordnung: die App rechnet mit 40 Stunden pro Woche und 50 % Überstundenzuschlag (Gesetz). Lehrlinge sind nicht geregelt.',
    pruefen: true,
    werte: {
      diaeten: { modell: 'aus', satz: 0, maxStd: null, minStd: 0, vorschlag: 'anwesenheit', stufen: [] },
      ueberstunden: { modell: 'monat', wochenStd: 40, tagesGrenze: null, zuschlagPct: 50 },
      stundenlohn: null,
      betriebFrei: 'urlaub',
      zuschlag: { art: 'kv', sa: 0, so: 0, ft: 100 },
      schlechtwetter: false
    }
  };
  LOHNGRUPPEN.kino_bgld = { stand: '1.4.2026 bis 31.3.2027', stufen: null, gruppen: [
      { id: 'KI1', name: 'Lohngruppe I: einfache Tätigkeiten (Billeteur/in, Kassa, Büffet, Reinigung)', l: [10.05] },
      { id: 'KI2', name: 'Lohngruppe II: Filmvorführung oder Haustechnik mit Berufsabschluss', l: [10.68] }
    ] };
  PAKETE.kino_ooe = {
    name: 'Kinobetriebe (Arbeiter), Oberösterreich',
    hinweis: 'KV Kinobetriebe, Arbeiter, Lohnordnung Oberösterreich vom 1.4.2026 bis 31.3.2027 (Quelle: wko.at): Bruttomindeststundenlöhne nach Lohngruppe für Eintritte ab 1.4.2019. Wer vorher eingetreten ist, hat teils höhere Sätze nach Tätigkeit (z. B. Filmvorführer nach Saalanzahl): dann bitte „Eigene Werte“ mit dem Stundenlohn laut Lohnzettel. Wochenstunden und Zuschläge stehen nicht in der Lohnordnung: die App rechnet mit 40 Stunden pro Woche und 50 % Überstundenzuschlag (Gesetz). Lehrlinge sind nicht geregelt.',
    pruefen: true,
    werte: {
      diaeten: { modell: 'aus', satz: 0, maxStd: null, minStd: 0, vorschlag: 'anwesenheit', stufen: [] },
      ueberstunden: { modell: 'monat', wochenStd: 40, tagesGrenze: null, zuschlagPct: 50 },
      stundenlohn: null,
      betriebFrei: 'urlaub',
      zuschlag: { art: 'kv', sa: 0, so: 0, ft: 100 },
      schlechtwetter: false
    }
  };
  LOHNGRUPPEN.kino_ooe = { stand: '1.4.2026 bis 31.3.2027', stufen: null, gruppen: [
      { id: 'KI1', name: 'Lohngruppe I: einfache Tätigkeiten (Billeteur/in, Kassa, Büffet, Reinigung)', l: [10.05] },
      { id: 'KI2', name: 'Lohngruppe II: Filmvorführung oder Haustechnik mit Berufsabschluss', l: [10.68] }
    ] };
  PAKETE.kino_stmk = {
    name: 'Kinobetriebe (Arbeiter), Steiermark',
    hinweis: 'KV Kinobetriebe, Arbeiter, Lohnordnung Steiermark vom 1.4.2026 bis 31.3.2027 (Quelle: wko.at): Bruttomindeststundenlöhne nach Lohngruppe für Eintritte ab 1.4.2019. Wer vorher eingetreten ist, hat teils höhere Sätze nach Tätigkeit (z. B. Filmvorführer nach Saalanzahl): dann bitte „Eigene Werte“ mit dem Stundenlohn laut Lohnzettel. Wochenstunden und Zuschläge stehen nicht in der Lohnordnung: die App rechnet mit 40 Stunden pro Woche und 50 % Überstundenzuschlag (Gesetz). Lehrlinge sind nicht geregelt.',
    pruefen: true,
    werte: {
      diaeten: { modell: 'aus', satz: 0, maxStd: null, minStd: 0, vorschlag: 'anwesenheit', stufen: [] },
      ueberstunden: { modell: 'monat', wochenStd: 40, tagesGrenze: null, zuschlagPct: 50 },
      stundenlohn: null,
      betriebFrei: 'urlaub',
      zuschlag: { art: 'kv', sa: 0, so: 0, ft: 100 },
      schlechtwetter: false
    }
  };
  LOHNGRUPPEN.kino_stmk = { stand: '1.4.2026 bis 31.3.2027', stufen: null, gruppen: [
      { id: 'KI1', name: 'Lohngruppe I: einfache Tätigkeiten (Billeteur/in, Kassa, Büffet, Reinigung)', l: [10.05] },
      { id: 'KI2', name: 'Lohngruppe II: Filmvorführung oder Haustechnik mit Berufsabschluss', l: [10.68] }
    ] };
  PAKETE.kino_ktn = {
    name: 'Kinobetriebe (Arbeiter), Kärnten',
    hinweis: 'KV Kinobetriebe, Arbeiter, Lohnordnung Kärnten vom 1.4.2026 bis 31.3.2027 (Quelle: wko.at): Bruttomindeststundenlöhne nach Lohngruppe für Eintritte ab 1.4.2019. Wer vorher eingetreten ist, hat teils höhere Sätze nach Tätigkeit (z. B. Filmvorführer nach Saalanzahl): dann bitte „Eigene Werte“ mit dem Stundenlohn laut Lohnzettel. Wochenstunden und Zuschläge stehen nicht in der Lohnordnung: die App rechnet mit 40 Stunden pro Woche und 50 % Überstundenzuschlag (Gesetz). Lehrlinge sind nicht geregelt.',
    pruefen: true,
    werte: {
      diaeten: { modell: 'aus', satz: 0, maxStd: null, minStd: 0, vorschlag: 'anwesenheit', stufen: [] },
      ueberstunden: { modell: 'monat', wochenStd: 40, tagesGrenze: null, zuschlagPct: 50 },
      stundenlohn: null,
      betriebFrei: 'urlaub',
      zuschlag: { art: 'kv', sa: 0, so: 0, ft: 100 },
      schlechtwetter: false
    }
  };
  LOHNGRUPPEN.kino_ktn = { stand: '1.4.2026 bis 31.3.2027', stufen: null, gruppen: [
      { id: 'KI1', name: 'Lohngruppe I: einfache Tätigkeiten (Billeteur/in, Kassa, Büffet, Reinigung)', l: [10.05] },
      { id: 'KI2', name: 'Lohngruppe II: Filmvorführung oder Haustechnik mit Berufsabschluss', l: [10.05] }
    ] };
  PAKETE.kino_sbg = {
    name: 'Kinobetriebe (Arbeiter), Salzburg',
    hinweis: 'KV Kinobetriebe, Arbeiter, Lohnordnung Salzburg vom 1.4.2026 bis 31.3.2027 (Quelle: wko.at): Bruttomindeststundenlöhne nach Lohngruppe für Eintritte ab 1.4.2019. Wer vorher eingetreten ist, hat teils höhere Sätze nach Tätigkeit (z. B. Filmvorführer nach Saalanzahl): dann bitte „Eigene Werte“ mit dem Stundenlohn laut Lohnzettel. Wochenstunden und Zuschläge stehen nicht in der Lohnordnung: die App rechnet mit 40 Stunden pro Woche und 50 % Überstundenzuschlag (Gesetz). Lehrlinge sind nicht geregelt.',
    pruefen: true,
    werte: {
      diaeten: { modell: 'aus', satz: 0, maxStd: null, minStd: 0, vorschlag: 'anwesenheit', stufen: [] },
      ueberstunden: { modell: 'monat', wochenStd: 40, tagesGrenze: null, zuschlagPct: 50 },
      stundenlohn: null,
      betriebFrei: 'urlaub',
      zuschlag: { art: 'kv', sa: 0, so: 0, ft: 100 },
      schlechtwetter: false
    }
  };
  LOHNGRUPPEN.kino_sbg = { stand: '1.4.2026 bis 31.3.2027', stufen: null, gruppen: [
      { id: 'KI1', name: 'Lohngruppe I: einfache Tätigkeiten (Billeteur/in, Kassa, Büffet, Reinigung)', l: [10.05] },
      { id: 'KI2', name: 'Lohngruppe II: Filmvorführung oder Haustechnik mit Berufsabschluss', l: [10.05] }
    ] };
  PAKETE.kino_t = {
    name: 'Kinobetriebe (Arbeiter), Tirol',
    hinweis: 'KV Kinobetriebe, Arbeiter, Lohnordnung Tirol vom 1.4.2026 bis 31.3.2027 (Quelle: wko.at): Bruttomindeststundenlöhne nach Lohngruppe für Eintritte ab 1.4.2019. Wer vorher eingetreten ist, hat teils höhere Sätze nach Tätigkeit (z. B. Filmvorführer nach Saalanzahl): dann bitte „Eigene Werte“ mit dem Stundenlohn laut Lohnzettel. Wochenstunden und Zuschläge stehen nicht in der Lohnordnung: die App rechnet mit 40 Stunden pro Woche und 50 % Überstundenzuschlag (Gesetz). Lehrlinge sind nicht geregelt.',
    pruefen: true,
    werte: {
      diaeten: { modell: 'aus', satz: 0, maxStd: null, minStd: 0, vorschlag: 'anwesenheit', stufen: [] },
      ueberstunden: { modell: 'monat', wochenStd: 40, tagesGrenze: null, zuschlagPct: 50 },
      stundenlohn: null,
      betriebFrei: 'urlaub',
      zuschlag: { art: 'kv', sa: 0, so: 0, ft: 100 },
      schlechtwetter: false
    }
  };
  LOHNGRUPPEN.kino_t = { stand: '1.4.2026 bis 31.3.2027', stufen: null, gruppen: [
      { id: 'KI1', name: 'Lohngruppe I: einfache Tätigkeiten (Billeteur/in, Kassa, Büffet, Reinigung)', l: [10.05] },
      { id: 'KI2', name: 'Lohngruppe II: Filmvorführung oder Haustechnik mit Berufsabschluss', l: [10.05] }
    ] };
  PAKETE.kino_vbg = {
    name: 'Kinobetriebe (Arbeiter), Vorarlberg',
    hinweis: 'KV Kinobetriebe, Arbeiter, Lohnordnung Vorarlberg vom 1.4.2026 bis 31.3.2027 (Quelle: wko.at): Bruttomindeststundenlöhne nach Lohngruppe für Eintritte ab 1.4.2019. Wer vorher eingetreten ist, hat teils höhere Sätze nach Tätigkeit (z. B. Filmvorführer nach Saalanzahl): dann bitte „Eigene Werte“ mit dem Stundenlohn laut Lohnzettel. Wochenstunden und Zuschläge stehen nicht in der Lohnordnung: die App rechnet mit 40 Stunden pro Woche und 50 % Überstundenzuschlag (Gesetz). Lehrlinge sind nicht geregelt.',
    pruefen: true,
    werte: {
      diaeten: { modell: 'aus', satz: 0, maxStd: null, minStd: 0, vorschlag: 'anwesenheit', stufen: [] },
      ueberstunden: { modell: 'monat', wochenStd: 40, tagesGrenze: null, zuschlagPct: 50 },
      stundenlohn: null,
      betriebFrei: 'urlaub',
      zuschlag: { art: 'kv', sa: 0, so: 0, ft: 100 },
      schlechtwetter: false
    }
  };
  LOHNGRUPPEN.kino_vbg = { stand: '1.4.2026 bis 31.3.2027', stufen: null, gruppen: [
      { id: 'KI1', name: 'Lohngruppe I: einfache Tätigkeiten (Billeteur/in, Kassa, Büffet, Reinigung)', l: [10.05] },
      { id: 'KI2', name: 'Lohngruppe II: Filmvorführung oder Haustechnik mit Berufsabschluss', l: [10.68] }
    ] };
  // Rettungsdienst (ÖRK-KV 2026, Landesanhänge NÖ, Burgenland, Steiermark, Salzburg, Tirol; roteskreuz.at)
  PAKETE.rettung_noe = {
    name: 'Rettungsdienst (Rotes Kreuz), Niederösterreich',
    hinweis: 'KV Österreichisches Rotes Kreuz 2026, Rettungsdienst, Anhang Niederösterreich (Quelle: roteskreuz.at): Monatsgehälter nach Verwendungsgruppe und Stufe, gültig ab 1.7.2026. Die Löhne sind je Landesverband verschieden. Normalarbeitszeit 40 Stunden/Woche (Durchrechnung möglich), Überstundenteiler 1/173, Überstunden 50 %, in der Nacht und an Sonn- und Feiertagen 100 %. Zulagen des Landesverbands sind als Prämie vorgeschlagen. Bitte mit Dienstzettel und Lohnzettel vergleichen.',
    pruefen: true,
    werte: {
      diaeten: { modell: 'aus', satz: 0, maxStd: null, minStd: 0, vorschlag: 'anwesenheit', stufen: [] },
      ueberstunden: { modell: 'monat', wochenStd: 40, tagesGrenze: null, zuschlagPct: 50 },
      stundenlohn: null,
      betriebFrei: 'urlaub',
      zuschlag: { art: 'kv', sa: 0, so: 0, ft: 100 },
      schlechtwetter: false
    }
  };
  LOHNGRUPPEN.rettung_noe = { stand: 'ab 1.7.2026, Niederösterreich', stufen: ['Dienstjahre 1–2', 'Dienstjahre 3–4', 'Dienstjahre 5–6', 'Dienstjahre 7–8', 'Dienstjahre 9–10', 'Dienstjahre 11–12', 'Dienstjahre 13–14', 'Dienstjahre 15–16', 'Dienstjahre 17–18', 'Dienstjahre 19–20', 'Dienstjahre 21–22', 'Dienstjahre 23–24', 'Dienstjahre 25–26', 'Dienstjahre 27–28', 'Dienstjahre 29–30', 'Dienstjahre 31–32', 'Dienstjahre 33–34', 'Dienstjahre 35–36', 'Dienstjahre 37–38', 'Dienstjahre 39–40', 'Dienstjahre 41–42'], teiler: 173, gruppen: [
      { id: 'RN1', m: true, name: 'A1: Hilfskräfte (Werkstatt, Reinigung, Küche, Betreuungsfahrten)', l: [2233.66, 2257.52, 2282.10, 2306.79, 2332.10, 2357.82, 2384.06, 2410.92, 2437.98, 2467.00, 2498.01, 2529.79, 2562.81, 2596.54, 2630.84, 2665.85, 2701.56, 2736.70, 2772.06, 2807.29, 2842.54] },
      { id: 'RN2', m: true, name: 'A2: Rettungssanitäter/in, Einsatzfahrer/in (BKTW, KTW, RTW)', l: [2543.33, 2580.20, 2617.54, 2655.82, 2694.80, 2734.47, 2774.97, 2816.98, 2859.81, 2903.22, 2947.45, 2994.64, 3045.03, 3096.42, 3148.56, 3201.96, 3256.73, 3310.62, 3364.76, 3418.78, 3472.80] },
      { id: 'RN3', m: true, name: 'A3: Notfallsanitäter/in, Einsatzfahrer/in NEF/NAW, Lehrbeauftragte', l: [2734.59, 2775.21, 2817.33, 2860.04, 2903.45, 2947.69, 2994.88, 3045.40, 3096.67, 3148.81, 3202.21, 3256.98, 3313.12, 3370.14, 3428.16, 3487.55, 3547.69, 3607.34, 3666.98, 3726.75, 3786.40] },
      { id: 'RN4', m: true, name: 'A4: Dienstführende (Haupttätigkeit), Fachbereichsleitung', l: [2849.54, 2892.95, 2936.94, 2982.88, 3033.15, 3084.29, 3136.19, 3189.33, 3243.47, 3299.36, 3356.26, 3414.28, 3473.05, 3533.19, 3593.59, 3655.49, 3718.25, 3780.40, 3842.67, 3904.95, 3967.09] }
    ] };
  PAKETE.rettung_bgld = {
    name: 'Rettungsdienst (Rotes Kreuz), Burgenland',
    hinweis: 'KV Österreichisches Rotes Kreuz 2026, Rettungsdienst, Anhang Burgenland (Quelle: roteskreuz.at): Monatsgehälter nach Verwendungsgruppe und Stufe, gültig ab 1.7.2026. Die Löhne sind je Landesverband verschieden. Normalarbeitszeit 40 Stunden/Woche (Durchrechnung möglich), Überstundenteiler 1/173, Überstunden 50 %, in der Nacht und an Sonn- und Feiertagen 100 %. Zulagen des Landesverbands sind als Prämie vorgeschlagen. Bitte mit Dienstzettel und Lohnzettel vergleichen.',
    pruefen: true,
    werte: {
      diaeten: { modell: 'aus', satz: 0, maxStd: null, minStd: 0, vorschlag: 'anwesenheit', stufen: [] },
      ueberstunden: { modell: 'monat', wochenStd: 40, tagesGrenze: null, zuschlagPct: 50 },
      stundenlohn: null,
      betriebFrei: 'urlaub',
      zuschlag: { art: 'kv', sa: 0, so: 0, ft: 100 },
      schlechtwetter: false
    }
  };
  LOHNGRUPPEN.rettung_bgld = { stand: 'ab 1.7.2026, Burgenland', stufen: ['Berufsjahre 1–2', 'Berufsjahre 3–4', 'Berufsjahre 5–6', 'Berufsjahre 7–8', 'Berufsjahre 9–10', 'Berufsjahre 11–12', 'Berufsjahre 13–14', 'Berufsjahre 15–16', 'Berufsjahre 17–18', 'Berufsjahre 19–20', 'Berufsjahre 21–22', 'Berufsjahre 23–24', 'Berufsjahre 25–26', 'Berufsjahre 27–28', 'Berufsjahre 29–30', 'Berufsjahre 31–32', 'Berufsjahre 33–34', 'Berufsjahre 35–36'], teiler: 173, gruppen: [
      { id: 'RB4a', m: true, name: 'VG 4a: Urlaubs- und Krankenstandsvertretung', l: [2374.21, 2403.79, 2436.19, 2467.38, 2498.32, 2532.49, 2563.10, 2592.18, 2624.33, 2660.69, 2694.10, 2723.57, 2757.00, 2792.20, 2822.82, 2851.91, 2882.52, 2915.82] },
      { id: 'RB4', m: true, name: 'VG 4: Rettungssanitäter/in', l: [2724.96, 2777.28, 2827.98, 2878.67, 2929.35, 2978.44, 3031.25, 3078.07, 3153.37, 3211.15, 3263.55, 3466.29, 3522.67, 3581.20, 3638.73, 3696.62, 3753.92, 3811.33] },
      { id: 'RB5', m: true, name: 'VG 5: Notfallsanitäter/in (NFS-Planposten)', l: [2838.59, 2890.91, 2941.61, 2992.30, 3042.98, 3092.07, 3144.88, 3191.70, 3267.00, 3324.78, 3377.18, 3579.92, 3636.30, 3694.83, 3752.36, 3810.25, 3867.55, 3924.96] }
    ] };
  PAKETE.rettung_stmk = {
    name: 'Rettungsdienst (Rotes Kreuz), Steiermark',
    hinweis: 'KV Österreichisches Rotes Kreuz 2026, Rettungsdienst, Anhang Steiermark (Quelle: roteskreuz.at): Monatsgehälter nach Verwendungsgruppe und Stufe, gültig ab 1.7.2026. Die Löhne sind je Landesverband verschieden. Normalarbeitszeit 40 Stunden/Woche (Durchrechnung möglich), Überstundenteiler 1/173, Überstunden 50 %, in der Nacht und an Sonn- und Feiertagen 100 %. Zulagen des Landesverbands sind als Prämie vorgeschlagen. Bitte mit Dienstzettel und Lohnzettel vergleichen.',
    pruefen: true,
    werte: {
      diaeten: { modell: 'aus', satz: 0, maxStd: null, minStd: 0, vorschlag: 'anwesenheit', stufen: [] },
      ueberstunden: { modell: 'monat', wochenStd: 40, tagesGrenze: null, zuschlagPct: 50 },
      stundenlohn: null,
      betriebFrei: 'urlaub',
      zuschlag: { art: 'kv', sa: 0, so: 0, ft: 100 },
      schlechtwetter: false
    }
  };
  LOHNGRUPPEN.rettung_stmk = { stand: 'ab 1.7.2026, Steiermark', stufen: ['Stufe 1 (Vorrückung alle 2 Jahre)', 'Stufe 2 (Vorrückung alle 2 Jahre)', 'Stufe 3 (Vorrückung alle 2 Jahre)', 'Stufe 4 (Vorrückung alle 2 Jahre)', 'Stufe 5 (Vorrückung alle 2 Jahre)', 'Stufe 6 (Vorrückung alle 2 Jahre)', 'Stufe 7 (Vorrückung alle 2 Jahre)', 'Stufe 8 (Vorrückung alle 2 Jahre)', 'Stufe 9 (Vorrückung alle 2 Jahre)', 'Stufe 10 (Vorrückung alle 2 Jahre)', 'Stufe 11 (Vorrückung alle 2 Jahre)', 'Stufe 12 (Vorrückung alle 2 Jahre)', 'Stufe 13 (Vorrückung alle 2 Jahre)', 'Stufe 14 (Vorrückung alle 2 Jahre)', 'Stufe 15 (Vorrückung alle 2 Jahre)', 'Stufe 16 (Vorrückung alle 2 Jahre)', 'Stufe 17 (Vorrückung alle 2 Jahre)', 'Stufe 18 (Vorrückung alle 2 Jahre)', 'Stufe 19 (Vorrückung alle 2 Jahre)', 'Stufe 20 (Vorrückung alle 2 Jahre)', 'Stufe 21 (Vorrückung alle 2 Jahre)'], teiler: 173, gruppen: [
      { id: 'RS2', m: true, name: 'Stufe II: Reinigung und überwiegend manuelle Tätigkeit', l: [2377.40, 2397.90, 2426.70, 2450.90, 2474.90, 2480.50, 2484.80, 2486.00, 2494.50, 2496.10, 2522.70, 2547.20, 2575.50, 2604.60, 2631.00, 2661.20, 2693.30, 2725.40, 2758.30, 2792.30, 2827.00] },
      { id: 'RS3', m: true, name: 'Stufe III: Rettungssanitäter/in in Ausbildung', l: [2452.00, 2481.70, 2514.00, 2546.20, 2578.40, 2589.70, 2596.90, 2602.80, 2611.60, 2624.40, 2657.90, 2687.40, 2720.70, 2756.00, 2786.50, 2815.70, 2846.20, 2879.50, 2914.30, 2950.10, 2988.70] },
      { id: 'RS4', m: true, name: 'Stufe IV: Rettungs- und Notfallsanitäter/in, Leitstelle, Kfz-Mechanik', l: [2557.80, 2592.70, 2626.10, 2661.40, 2692.10, 2700.40, 2705.00, 2716.40, 2725.50, 2734.10, 2767.60, 2799.10, 2830.10, 2862.40, 2888.40, 2926.20, 2961.10, 3003.30, 3044.70, 3087.40, 3132.70] },
      { id: 'RS5', m: true, name: 'Stufe V: wie Stufe IV nach 15 Jahren beim selben Arbeitgeber', l: [2663.00, 2696.20, 2729.70, 2764.90, 2799.70, 2811.70, 2820.30, 2837.60, 2848.00, 2859.00, 2894.60, 2930.80, 2965.60, 3005.00, 3045.20, 3077.00, 3113.70, 3156.90, 3198.30, 3240.00, 3284.80] }
    ] };
  PAKETE.rettung_sbg = {
    name: 'Rettungsdienst (Rotes Kreuz), Salzburg',
    hinweis: 'KV Österreichisches Rotes Kreuz 2026, Rettungsdienst, Anhang Salzburg (Quelle: roteskreuz.at): Monatsgehälter nach Verwendungsgruppe und Stufe, gültig für 2026. Die Löhne sind je Landesverband verschieden. Normalarbeitszeit 40 Stunden/Woche (Durchrechnung möglich), Überstundenteiler 1/173, Überstunden 50 %, in der Nacht und an Sonn- und Feiertagen 100 %. Zulagen des Landesverbands sind als Prämie vorgeschlagen. Bitte mit Dienstzettel und Lohnzettel vergleichen.',
    pruefen: true,
    werte: {
      diaeten: { modell: 'aus', satz: 0, maxStd: null, minStd: 0, vorschlag: 'anwesenheit', stufen: [] },
      ueberstunden: { modell: 'monat', wochenStd: 40, tagesGrenze: null, zuschlagPct: 50 },
      stundenlohn: null,
      betriebFrei: 'urlaub',
      zuschlag: { art: 'kv', sa: 0, so: 0, ft: 100 },
      schlechtwetter: false
    }
  };
  LOHNGRUPPEN.rettung_sbg = { stand: 'für 2026, Salzburg', stufen: ['Stufe 1 (Vorrückung alle 2 Jahre)', 'Stufe 2 (Vorrückung alle 2 Jahre)', 'Stufe 3 (Vorrückung alle 2 Jahre)', 'Stufe 4 (Vorrückung alle 2 Jahre)', 'Stufe 5 (Vorrückung alle 2 Jahre)', 'Stufe 6 (Vorrückung alle 2 Jahre)', 'Stufe 7 (Vorrückung alle 2 Jahre)', 'Stufe 8 (Vorrückung alle 2 Jahre)', 'Stufe 9 (Vorrückung alle 2 Jahre)', 'Stufe 10 (Vorrückung alle 2 Jahre)', 'Stufe 11 (Vorrückung alle 2 Jahre)', 'Stufe 12 (Vorrückung alle 2 Jahre)', 'Stufe 13 (Vorrückung alle 2 Jahre)', 'Stufe 14 (Vorrückung alle 2 Jahre)', 'Stufe 15 (Vorrückung alle 2 Jahre)', 'Stufe 16 (Vorrückung alle 2 Jahre)', 'Stufe 17 (Vorrückung alle 2 Jahre)', 'Stufe 18 (Vorrückung alle 2 Jahre)'], teiler: 173, gruppen: [
      { id: 'RZ10', m: true, name: 'VG X: Helfer/in', l: [2333.96, 2351.17, 2368.38, 2384.02, 2443.50, 2502.84, 2562.19, 2618.77, 2676.79, 2736.27, 2792.98, 2852.32, 2910.34, 2969.84, 3027.71, 3088.53, 3145.11, 3203.12] },
      { id: 'RZ7', m: true, name: 'VG VII: Rettungs- und Notfallsanitäter/in', l: [2751.39, 2853.64, 2944.83, 3037.46, 3131.28, 3221.15, 3303.77, 3397.60, 3488.79, 3581.42, 3673.92, 3766.43, 3857.63, 3950.24, 4042.77, 4133.95, 4226.58, 4320.38] },
      { id: 'RZ5', m: true, name: 'VG V: Dienstführende', l: [3378.27, 3516.43, 3654.59, 3789.98, 3929.47, 4066.30, 4204.47, 4342.63, 4479.33, 4617.52, 4755.68, 4892.39, 5030.56, 5167.26, 5304.11, 5442.25, 5580.43, 5687.17] }
    ] };
  PAKETE.rettung_t = {
    name: 'Rettungsdienst (Rotes Kreuz), Tirol',
    hinweis: 'KV Österreichisches Rotes Kreuz 2026, Rettungsdienst, Anhang Tirol (Quelle: roteskreuz.at): Monatsgehälter nach Verwendungsgruppe und Stufe, gültig ab 1.4.2026. Die Löhne sind je Landesverband verschieden. Normalarbeitszeit 40 Stunden/Woche (Durchrechnung möglich), Überstundenteiler 1/173, Überstunden 50 %, in der Nacht und an Sonn- und Feiertagen 100 %. Zulagen des Landesverbands sind als Prämie vorgeschlagen. Bitte mit Dienstzettel und Lohnzettel vergleichen.',
    pruefen: true,
    werte: {
      diaeten: { modell: 'aus', satz: 0, maxStd: null, minStd: 0, vorschlag: 'anwesenheit', stufen: [] },
      ueberstunden: { modell: 'monat', wochenStd: 40, tagesGrenze: null, zuschlagPct: 50 },
      stundenlohn: null,
      betriebFrei: 'urlaub',
      zuschlag: { art: 'kv', sa: 0, so: 0, ft: 100 },
      schlechtwetter: false
    }
  };
  LOHNGRUPPEN.rettung_t = { stand: 'ab 1.4.2026, Tirol', stufen: ['Dienstjahre 1–2', 'Dienstjahre 3–4', 'Dienstjahre 5–6', 'Dienstjahre 7–8', 'Dienstjahre 9–10', 'Dienstjahre 11–12', 'Dienstjahre 13–14', 'Dienstjahre 15–16', 'Dienstjahre 17–18', 'Dienstjahre 19–20', 'Dienstjahre 21–22', 'Dienstjahre 23–24', 'Dienstjahre 25–26', 'Dienstjahre 27–28', 'Dienstjahre 29–30', 'Dienstjahre 31–32', 'Dienstjahre 33–34', 'Dienstjahre 35–36'], teiler: 173, gruppen: [
      { id: 'RT1', m: true, name: 'VWG 1: Botendienst, Reinigung, Küchenhilfe', l: [2260.03, 2284.44, 2323.33, 2359.95, 2400.28, 2438.69, 2477.34, 2516.11, 2554.65, 2593.18, 2623.69, 2654.33, 2681.37, 2711.89, 2739.89, 2771.04, 2803.74, 2836.05] },
      { id: 'RT4', m: true, name: 'VWG 4: Rettungssanitäter/in', l: [2556.20, 2602.87, 2668.69, 2715.84, 2760.18, 2812.78, 2863.06, 2912.04, 2964.25, 3014.91, 3063.38, 3116.11, 3152.30, 3190.04, 3228.03, 3267.71, 3303.90, 3343.57] },
      { id: 'RT5', m: true, name: 'VWG 5: Notfallsanitäter/in, Leitstelle (Rettungssanitäter/in)', l: [2743.24, 2798.18, 2879.60, 2975.11, 3043.99, 3097.76, 3152.30, 3208.13, 3264.22, 3320.18, 3372.52, 3426.67, 3482.76, 3537.30, 3591.33, 3647.16, 3703.38, 3757.01] },
      { id: 'RT6', m: true, name: 'VWG 6: Leitstelle (Notfallsanitäter/in), Wachführung', l: [2944.48, 3002.25, 3090.91, 3208.13, 3296.66, 3382.99, 3473.72, 3562.38, 3617.82, 3677.79, 3737.50, 3796.95, 3856.66, 3912.49, 3972.20, 4031.65, 4091.23, 4149.51] }
    ] };
  var BERUFE = {
    lkw: { name: 'Lkw-Fahrer', paket: 'gueter', kvs: ['gueter', 'klein', 'de_spedition_nrw', 'de_spedition_by', 'de_logistik_sn', 'de_spedition', 'de_spedition_sonst', 'eigen'], diaeten: true, sw: false, b: { fahrzeug: true, kunden: true, praemien: true },
      arten: {
        baustelle: { name: 'Baustelle / Kurzstrecke', b: { fahrzeug: true, kunden: true, praemien: true } },
        tour: { name: 'Zustellung / Tour / Filiale', tour: true, b: { fahrzeug: true, kunden: true, praemien: true } },
        fern: { name: 'Fernverkehr', b: { fahrzeug: true, kunden: false, praemien: true } },
        muell: { name: 'Müllabfuhr', b: { fahrzeug: true, kunden: false, praemien: true } },
        kipper: { name: 'Kipper / Erdtransport', b: { fahrzeug: true, kunden: true, praemien: true } },
        kran: { name: 'Kran / Kranfahrer', b: { fahrzeug: true, kunden: true, praemien: true } },
        lehrling: { name: 'Berufskraftfahrer (Lehrling)', b: { fahrzeug: true, kunden: true, praemien: false } }
      } },
    handwerk: { name: 'Bau und Handwerk', paket: 'bau', kvs: ['bau', 'holzbau', 'dachdecker', 'pflasterer', 'fliesenleger', 'tischler', 'maler', 'glaser', 'tapezierer', 'steinmetz', 'bodenleger', 'bauhilfsgewerbe', 'metall', 'de_bau', 'de_metall', 'eigen'], diaeten: true, sw: true, b: { fahrzeug: false, kunden: true, praemien: true },
      arten: {
        maurer: { name: 'Maurer / Hochbau / Tiefbau / Bauarbeiter', kv: 'bau', sw: true, diaeten: true, b: { fahrzeug: false, kunden: true, praemien: true } },
        zimmerer: { name: 'Zimmerer / Holzbau / Dachstuhl', kv: 'holzbau', sw: true, diaeten: true, b: { fahrzeug: false, kunden: true, praemien: true } },
        elektro: { name: 'Elektriker / Elektrotechniker', kv: 'metall', sw: false, diaeten: false, b: { fahrzeug: false, kunden: true, praemien: true } },
        installateur: { name: 'Installateur / Sanitär / Heizung', kv: 'metall', sw: false, diaeten: false, b: { fahrzeug: false, kunden: true, praemien: true } },
        spengler: { name: 'Spengler / Dachspengler', kv: 'metall', sw: false, diaeten: false, b: { fahrzeug: false, kunden: true, praemien: true } },
        tischler: { name: 'Tischler / Holzgestalter', kv: 'tischler', sw: false, diaeten: false, b: { fahrzeug: false, kunden: true, praemien: true } },
        maler: { name: 'Maler / Lackierer / Anstreicher', kv: 'maler', sw: false, diaeten: true, b: { fahrzeug: false, kunden: true, praemien: true } },
        dachdecker: { name: 'Dachdecker', kv: 'dachdecker', sw: true, diaeten: true, b: { fahrzeug: false, kunden: true, praemien: true } },
        pflasterer: { name: 'Pflasterer', kv: 'pflasterer', sw: true, diaeten: true, b: { fahrzeug: false, kunden: true, praemien: true } },
        fliesenleger: { name: 'Fliesenleger / Hafner / Plattenleger', kv: 'fliesenleger', sw: false, diaeten: true, b: { fahrzeug: false, kunden: true, praemien: true } },
        glaser: { name: 'Glaser', kv: 'glaser', sw: false, diaeten: false, b: { fahrzeug: false, kunden: true, praemien: true } },
        tapezierer: { name: 'Tapezierer', kv: 'tapezierer', sw: false, diaeten: false, b: { fahrzeug: false, kunden: true, praemien: true } },
        steinmetz: { name: 'Steinmetz / Steinarbeiter', kv: 'steinmetz', sw: false, diaeten: false, b: { fahrzeug: false, kunden: true, praemien: true } },
        bodenleger: { name: 'Bodenleger', kv: 'bodenleger', sw: false, diaeten: false, b: { fahrzeug: false, kunden: true, praemien: true } },
        bauhilfsgewerbe: { name: 'Fassader / Stuckateur / Gipser / Dämmung', kv: 'bauhilfsgewerbe', sw: true, diaeten: true, b: { fahrzeug: false, kunden: true, praemien: true } },
        anderes: { name: 'Anderes Handwerk (Eigene Werte)', kv: 'eigen', sw: false, diaeten: false, b: { fahrzeug: false, kunden: true, praemien: true } },
        lehrling: { name: 'Lehrling (Bau und Handwerk)', sw: false, diaeten: false, b: { fahrzeug: false, kunden: true, praemien: false } }
      } },
    bagger: { name: 'Baggerfahrer / Maschinist', paket: 'bau', kvs: ['bau', 'de_bau', 'eigen'], diaeten: true, sw: true, b: { fahrzeug: false, kunden: true, praemien: true },
      arten: {
        bagger: { name: 'Baggerfahrer', b: { fahrzeug: false, kunden: true, praemien: true } },
        lader: { name: 'Laderfahrer (Radlader)', b: { fahrzeug: false, kunden: true, praemien: true } },
        kran: { name: 'Kran / Kranfahrer', b: { fahrzeug: false, kunden: true, praemien: true } }
      } },
    klein: { name: 'Kleintransport (bis 3,5 t)', paket: 'gueter', kvs: ['gueter', 'klein', 'de_spedition_nrw', 'de_spedition_by', 'de_logistik_sn', 'de_spedition', 'de_spedition_sonst', 'eigen'], diaeten: true, sw: false, b: { fahrzeug: true, kunden: true, praemien: false },
      arten: {
        tour: { name: 'Zustellung / Tour / Filiale', tour: true, b: { fahrzeug: true, kunden: true, praemien: false } },
        baustelle: { name: 'Baustelle / Handwerker', b: { fahrzeug: true, kunden: true, praemien: false } },
        fern: { name: 'Express / Kurier (Strecke)', b: { fahrzeug: true, kunden: false, praemien: false } }
      } },
    aussendienst: { name: 'Außendienst / Vertrieb', paket: 'buero', kvs: ['gueter_ang', 'gleit_buero', 'buero', 'handel', 'gewerbe_ang', 'industrie_ang', 'bau_ang', 'it_ang', 'banken_ang', 'versicherung_ang', 'steuerberatung_ang', 'immobilien_ang', 'reisebuero_ang', 'ic_ang', 'de_buero', 'de_handel', 'eigen'], diaeten: true, sw: false, b: { fahrzeug: true, kunden: true, praemien: true } },
    lager: { name: 'Lager / Stapler / Hilfsarbeiter', paket: 'gueter', kvs: ['gueter', 'klein', 'handel_arb', 'handel', 'de_spedition_nrw', 'de_spedition_by', 'de_logistik_sn', 'de_spedition', 'de_spedition_sonst', 'eigen'], einfach: true, diaeten: false, sw: false, b: { fahrzeug: false, kunden: false, praemien: false },
      arten: {
        lager: { name: 'Lager / Stapler / Hilfsarbeiter', b: { fahrzeug: false, kunden: false, praemien: false } },
        lehrling: { name: 'Lehrling (Lagerlogistik)', b: { fahrzeug: false, kunden: false, praemien: false } }
      } },
    mechaniker: { name: 'Mechaniker / Werkstatt', paket: 'metall', kvs: ['metall', 'metall_ind', 'gueter', 'de_metall', 'eigen'], einfach: true, diaeten: false, sw: false, b: { fahrzeug: false, kunden: false, praemien: false },
      arten: {
        kfz: { name: 'Kfz-Mechaniker / Werkstatt', b: { fahrzeug: false, kunden: false, praemien: false } },
        schlosser: { name: 'Schlosser / Schweißer', b: { fahrzeug: false, kunden: false, praemien: false } },
        spengler: { name: 'Spengler / Karosseriebauer', b: { fahrzeug: false, kunden: false, praemien: false } },
        lackierer: { name: 'Lackierer', b: { fahrzeug: false, kunden: false, praemien: false } },
        leiter: { name: 'Werkstattleiter / Meister', b: { fahrzeug: false, kunden: false, praemien: false } },
        lehrling: { name: 'Lehrling', b: { fahrzeug: false, kunden: false, praemien: false } }
      } },
    bund: { name: 'Bundesdienst / Ministerium', verborgen: true, paket: 'bund', kvs: ['bund', 'gleit_buero', 'buero', 'eigen'], einfach: true, diaeten: false, sw: false, b: { fahrzeug: false, kunden: false, praemien: false } },
    buero: { name: 'Büro (Angestellte)', paket: 'buero', kvs: ['gueter_ang', 'gleit_buero', 'buero', 'handel', 'gewerbe_ang', 'industrie_ang', 'bau_ang', 'it_ang', 'banken_ang', 'versicherung_ang', 'steuerberatung_ang', 'immobilien_ang', 'reisebuero_ang', 'ic_ang', 'de_buero', 'de_handel', 'eigen'], einfach: true, diaeten: false, sw: false, b: { fahrzeug: false, kunden: false, praemien: false } ,
      arten: {
        buero: { name: 'Büro / Verwaltung / Disposition', b: { fahrzeug: false, kunden: false, praemien: false } },
        lehrling: { name: 'Lehrling (Bürokaufmann/-frau, Verwaltung)', b: { fahrzeug: false, kunden: false, praemien: false } }
      } },
    handel: { name: 'Handel / Verkauf', paket: 'handel', kvs: ['handel', 'handel_arb', 'de_handel', 'eigen'], einfach: true, diaeten: false, sw: false, b: { fahrzeug: false, kunden: false, praemien: true },
      arten: {
        verkauf: { name: 'Verkauf / Kassa', b: { fahrzeug: false, kunden: false, praemien: true } },
        lehrling: { name: 'Lehrling (Einzelhandel)', b: { fahrzeug: false, kunden: false, praemien: true } },
        theke: { name: 'Feinkost / Bedientheke / Bäckerei', b: { fahrzeug: false, kunden: false, praemien: true } },
        lager: { name: 'Lager / Warenübernahme', kv: 'handel_arb', b: { fahrzeug: false, kunden: false, praemien: true } },
        leitung: { name: 'Filialleitung / Stellvertretung', b: { fahrzeug: false, kunden: false, praemien: true } }
      } },
    gastro: { name: 'Gastronomie / Hotel', paket: 'gastro', kvs: ['gastro', 'gastro_w', 'gastro_wh', 'gastro_bgld', 'gastro_ooe', 'gastro_stmk', 'gastro_ktn', 'gastro_sbg', 'gastro_t', 'gastro_vbg', 'gastro_ang_wh', 'gastro_ang_w', 'gastro_ang_c', 'gastro_ang_d', 'de_gastro', 'eigen'], einfach: true, diaeten: false, sw: false, b: { fahrzeug: false, kunden: false, praemien: false },
      arten: {
        service: { name: 'Service (Kellner, Bar)', b: { fahrzeug: false, kunden: false, praemien: true } },
        lehrling: { name: 'Lehrling (Koch, Restaurantfachmann, Hotel)', b: { fahrzeug: false, kunden: false, praemien: false } },
        kueche: { name: 'Küche', b: { fahrzeug: false, kunden: false, praemien: false } },
        chef: { name: 'Küchenchef / Koch', b: { fahrzeug: false, kunden: false, praemien: true } },
        rezeption: { name: 'Rezeption / Empfang', b: { fahrzeug: false, kunden: false, praemien: false } },
        housekeeping: { name: 'Zimmerservice / Housekeeping', b: { fahrzeug: false, kunden: false, praemien: false } },
        betrieb: { name: 'Betriebsküche / Catering / Kantine', b: { fahrzeug: false, kunden: false, praemien: true } }
      } },
    reinigung: { name: 'Reinigung / Gebäudeservice', paket: 'reinigung', kvs: ['reinigung', 'eigen'], einfach: true, diaeten: false, sw: false, b: { fahrzeug: false, kunden: true, praemien: true },
      arten: {
        unterhalt: { name: 'Unterhaltsreinigung (Büro, Objekt)', b: { fahrzeug: false, kunden: true, praemien: true } },
        hotel: { name: 'Hotelreinigung', b: { fahrzeug: false, kunden: false, praemien: true } },
        haus: { name: 'Hausbetreuung / Wohnhausanlage / Privathaushalt', b: { fahrzeug: false, kunden: true, praemien: true } },
        pflegeheim: { name: 'Senioren-, Pflege- und Krankenhausreinigung', b: { fahrzeug: false, kunden: false, praemien: true } },
        sonder: { name: 'Fassaden-, Fenster- und Sonderreinigung', b: { fahrzeug: false, kunden: true, praemien: true } },
        lehrling: { name: 'Lehrling (Reinigungstechnik)', b: { fahrzeug: false, kunden: false, praemien: true } }
      } },
    security: { name: 'Security / Sicherheitsdienst', paket: 'bewachung', kvs: ['bewachung', 'eigen'], einfach: true, diaeten: false, sw: false, b: { fahrzeug: false, kunden: true, praemien: true },
      arten: {
        wach: { name: 'Objektschutz / Wachdienst / Portier', b: { fahrzeug: false, kunden: true, praemien: true } },
        service: { name: 'Service- und Sicherheitsdienst (Empfang, Kassa)', b: { fahrzeug: false, kunden: true, praemien: true } },
        mobil: { name: 'Mobiler Dienst / Streife', b: { fahrzeug: true, kunden: true, praemien: true } },
        veranstaltung: { name: 'Veranstaltungssicherheit', b: { fahrzeug: false, kunden: true, praemien: true } },
        flughafen: { name: 'Flughafensicherheit', b: { fahrzeug: false, kunden: false, praemien: true } }
      } },
    lebensmittel: { name: 'Bäckerei (Backstube, Verkauf, Zustellung)', paket: 'baecker', kvs: ['baecker', 'eigen'], einfach: true, diaeten: false, sw: false, b: { fahrzeug: false, kunden: false, praemien: true },
      arten: {
        backstube: { name: 'Backstube / Produktion', b: { fahrzeug: false, kunden: false, praemien: true } },
        verkauf: { name: 'Verkauf / Ladner', b: { fahrzeug: false, kunden: false, praemien: true } },
        fahrer: { name: 'Zustellung / Brotausführer / Kraftfahrer', b: { fahrzeug: true, kunden: true, praemien: true } },
        lehrling: { name: 'Lehrling (Bäcker)', b: { fahrzeug: false, kunden: false, praemien: true } }
      } },
    konditor: { name: 'Konditorei (Backstube, Verkauf, Zustellung)', paket: 'konditor', kvs: ['konditor', 'konditor_w', 'konditor_st', 'konditor_ooe', 'konditor_sbg', 'konditor_k', 'konditor_v', 'konditor_b', 'konditor_t', 'gewerbe_ang', 'eigen'], einfach: true, diaeten: false, sw: false, b: { fahrzeug: false, kunden: false, praemien: true },
      arten: {
        backstube: { name: 'Backstube / Produktion', b: { fahrzeug: false, kunden: false, praemien: true } },
        verkauf: { name: 'Verkauf / Ladner', b: { fahrzeug: false, kunden: false, praemien: true } },
        fahrer: { name: 'Zustellung / Kraftfahrer', b: { fahrzeug: true, kunden: true, praemien: true } },
        lehrling: { name: 'Lehrling (Konditor)', b: { fahrzeug: false, kunden: false, praemien: true } }
      } },
    optiker: { name: 'Augenoptik (Beratung, Werkstatt)', paket: 'metall_ang', kvs: ['metall_ang', 'metall', 'eigen'], einfach: true, diaeten: false, sw: false, b: { fahrzeug: false, kunden: false, praemien: true },
      arten: {
        beratung: { name: 'Beratung / Verkauf', b: { fahrzeug: false, kunden: false, praemien: true } },
        werkstatt: { name: 'Werkstatt / Brillenfertigung', kv: 'metall', b: { fahrzeug: false, kunden: false, praemien: true } },
        leitung: { name: 'Filialleitung / Stellvertretung', b: { fahrzeug: false, kunden: false, praemien: true } },
        lehrling: { name: 'Lehrling (Augenoptik)', b: { fahrzeug: false, kunden: false, praemien: true } }
      } },
    fleischer: { name: 'Fleischerei (Produktion, Verkauf, Zustellung)', paket: 'fleischer', kvs: ['fleischer', 'fleischer_w', 'fleischer_st', 'fleischer_ooe', 'fleischer_sbg', 'fleischer_k', 'fleischer_v', 'fleischer_b', 'fleischer_t', 'gewerbe_ang', 'eigen'], einfach: true, diaeten: false, sw: false, b: { fahrzeug: false, kunden: false, praemien: true },
      arten: {
        produktion: { name: 'Fleischer / Wurstherstellung', b: { fahrzeug: false, kunden: false, praemien: true } },
        verkauf: { name: 'Verkauf / Ladner', b: { fahrzeug: false, kunden: false, praemien: true } },
        fahrer: { name: 'Zustellung / Kraftfahrer', b: { fahrzeug: true, kunden: true, praemien: true } },
        lehrling: { name: 'Lehrling (Fleischer)', b: { fahrzeug: false, kunden: false, praemien: true } }
      } },
    bahn: { name: 'Bahn (Fahrdienst, Zug, Bahnhof, Werkstätte, Bordservice)', paket: 'bahn', kvs: ['bahn', 'bahn_dbo', 'eigen'], einfach: true, diaeten: false, sw: false, b: { fahrzeug: false, kunden: false, praemien: true },
      arten: {
        lokfuehrer: { name: 'Triebfahrzeugführer / Lokführer', b: { fahrzeug: false, kunden: false, praemien: true } },
        zugbegleiter: { name: 'Zugbegleiter / Schaffner', b: { fahrzeug: false, kunden: false, praemien: true } },
        fahrdienst: { name: 'Fahrdienstleiter / Verschub', b: { fahrzeug: false, kunden: false, praemien: true } },
        bahnhof: { name: 'Bahnhof, Service und Verkauf', b: { fahrzeug: false, kunden: false, praemien: true } },
        technik: { name: 'Werkstätte, Gleisbau und Technik', b: { fahrzeug: false, kunden: false, praemien: true } },
        buero: { name: 'Büro und Verwaltung', b: { fahrzeug: false, kunden: false, praemien: true } },
        kueche: { name: 'Küche und Kantine (Küchenchef, Stellvertretung, Koch, Küchenhilfe)', b: { fahrzeug: false, kunden: false, praemien: true } },
        bordgastro: { name: 'Bordgastronomie und Schlafwagen', b: { fahrzeug: false, kunden: false, praemien: true } },
        lehrling: { name: 'Lehrling (Bahn)', b: { fahrzeug: false, kunden: false, praemien: true } }
      } },
    bus: { name: 'Bus und Taxi', paket: 'autobus', kvs: ['autobus', 'autobus_g', 'taxi', 'taxi_t', 'taxi_vbg', 'taxi_sbg', 'taxi_stmk', 'taxi_b', 'eigen'], einfach: true, diaeten: true, sw: false, b: { fahrzeug: true, kunden: false, praemien: true },
      arten: {
        linie: { name: 'Linienbus', b: { fahrzeug: true, kunden: false, praemien: true } },
        reise: { name: 'Reisebus / Gelegenheitsverkehr', b: { fahrzeug: true, kunden: false, praemien: true } },
        taxi: { name: 'Taxi / Mietwagen', b: { fahrzeug: true, kunden: false, praemien: true } },
        schueler: { name: 'Schülertransport / Krankenbeförderung', b: { fahrzeug: true, kunden: false, praemien: true } },
        werkstatt: { name: 'Werkstätte und Garage (Bus)', b: { fahrzeug: true, kunden: false, praemien: true } }
      } },
    gaertner: { name: 'Gärtner und Forst', paket: 'gaertner', kvs: ['gaertner', 'forst', 'agrar', 'eigen'], einfach: true, diaeten: true, sw: true, b: { fahrzeug: true, kunden: true, praemien: true },
      arten: {
        garten: { name: 'Garten- und Landschaftsbau', b: { fahrzeug: true, kunden: true, praemien: true } },
        gaertnerei: { name: 'Gärtnerei / Pflanzenproduktion', b: { fahrzeug: true, kunden: true, praemien: true } },
        greenkeeper: { name: 'Greenkeeper / Sportplatz', b: { fahrzeug: true, kunden: true, praemien: true } },
        forst: { name: 'Forstarbeit / Holzernte', b: { fahrzeug: true, kunden: true, praemien: true } },
        agrar: { name: 'Agrarservice / landwirtschaftliches Lohnunternehmen', kv: 'agrar', b: { fahrzeug: true, kunden: true, praemien: true } },
        lehrling: { name: 'Lehrling (Gärtner / Forst)', b: { fahrzeug: true, kunden: true, praemien: true } }
      } },
    industrie: { name: 'Industrie und Produktion (Arbeiter)', paket: 'metall_ind', kvs: ['metall_ind', 'chemie', 'papier', 'textil', 'textil_t', 'textil_vbg', 'metall', 'eigen'], einfach: true, diaeten: false, sw: false, b: { fahrzeug: false, kunden: false, praemien: true },
      arten: {
        produktion: { name: 'Produktion / Maschinenbedienung', b: { fahrzeug: false, kunden: false, praemien: true } },
        schicht: { name: 'Schichtarbeit', b: { fahrzeug: false, kunden: false, praemien: true } },
        instandhaltung: { name: 'Instandhaltung / Werkstätte', b: { fahrzeug: false, kunden: false, praemien: true } },
        montage: { name: 'Montage', b: { fahrzeug: false, kunden: false, praemien: true } },
        lager: { name: 'Lager / Logistik (Industrie)', b: { fahrzeug: false, kunden: false, praemien: true } },
        lehrling: { name: 'Lehrling (Industrie)', b: { fahrzeug: false, kunden: false, praemien: true } }
      } },
    post: { name: 'Post und Paketdienst', paket: 'post', kvs: ['post', 'gueter', 'klein', 'eigen'], einfach: true, diaeten: false, sw: false, b: { fahrzeug: true, kunden: true, praemien: true },
      arten: {
        zustellung: { name: 'Zustellung (Brief, Paket)', b: { fahrzeug: true, kunden: true, praemien: true } },
        verteil: { name: 'Verteilzentrum / Sortierung', b: { fahrzeug: true, kunden: true, praemien: true } },
        filiale: { name: 'Postpartner / Schalter / Filiale', b: { fahrzeug: true, kunden: true, praemien: true } },
        lehrling: { name: 'Lehrling (Post, Logistik)', b: { fahrzeug: true, kunden: true, praemien: true } }
      } },
    ordination: { name: 'Ordination und Praxis', paket: 'ordination_noe', kvs: ['ordination_noe', 'ordination_w', 'ordination_sbg', 'ordination_t', 'ordination_vbg', 'ordination_ktn', 'ordination_ooe', 'ordination_bgld', 'ordination_stmk', 'eigen'], einfach: true, diaeten: false, sw: false, b: { fahrzeug: false, kunden: false, praemien: true },
      arten: {
        sekretariat: { name: 'Ordination / Sekretariat / Anmeldung', b: { fahrzeug: false, kunden: false, praemien: true } },
        assistenz: { name: 'Ordinationsassistenz / Medizinische Assistenz', b: { fahrzeug: false, kunden: false, praemien: true } },
        labor: { name: 'Labor / Röntgen / Therapie / Pflege in der Praxis', b: { fahrzeug: false, kunden: false, praemien: true } },
        lehrling: { name: 'Lehrling (Ordination, Praxis)', b: { fahrzeug: false, kunden: false, praemien: true } }
      } },
    zahntechnik: { name: 'Zahntechnik (Labor)', paket: 'zahntechnik', kvs: ['zahntechnik', 'eigen'], einfach: true, diaeten: false, sw: false, b: { fahrzeug: false, kunden: false, praemien: true },
      arten: {
        labor: { name: 'Zahntechniker/in (Labor)', b: { fahrzeug: false, kunden: false, praemien: true } },
        assistenz: { name: 'Zahntechnische Fachassistenz / Hilfskraft', b: { fahrzeug: false, kunden: false, praemien: true } },
        leitung: { name: 'Laborleitung / Meister / Büro', b: { fahrzeug: false, kunden: false, praemien: true } },
        lehrling: { name: 'Lehrling (Zahntechnik)', b: { fahrzeug: false, kunden: false, praemien: true } }
      } },
    textilreinigung: { name: 'Wäscherei und Textilreinigung', paket: 'textilreinigung', kvs: ['textilreinigung', 'eigen'], einfach: true, diaeten: false, sw: false, b: { fahrzeug: false, kunden: false, praemien: true },
      arten: {
        reiniger: { name: 'Textilreiniger/in / Wäscher/in / Färber/in', b: { fahrzeug: false, kunden: false, praemien: true } },
        hilfskraft: { name: 'Hilfskraft / Ladner/in / Bügler/in', b: { fahrzeug: false, kunden: false, praemien: true } },
        lehrling: { name: 'Lehrling (Textilreinigung)', b: { fahrzeug: false, kunden: false, praemien: true } }
      } },
    rauchfangkehrer: { name: 'Rauchfangkehrer', paket: 'rk_noe', kvs: ['rk_noe', 'rk_w', 'rk_stmk', 'rk_ktn', 'rk_sbg', 'rk_bgld', 'rk_ooe', 'rk_t', 'rk_vbg', 'eigen'], einfach: true, diaeten: false, sw: false, b: { fahrzeug: false, kunden: false, praemien: true },
      arten: {
        geselle: { name: 'Geselle/Gesellin mit Lehrabschluss', b: { fahrzeug: false, kunden: false, praemien: true } },
        ohne: { name: 'Arbeitnehmer/in ohne Lehrabschluss (Rauchfangkehrer)', b: { fahrzeug: false, kunden: false, praemien: true } },
        lehrling: { name: 'Lehrling (Rauchfangkehrer)', b: { fahrzeug: false, kunden: false, praemien: true } }
      } },
    schaedling: { name: 'Schädlingsbekämpfung', paket: 'schaedling', kvs: ['schaedling', 'eigen'], einfach: true, diaeten: true, sw: false, b: { fahrzeug: false, kunden: false, praemien: true },
      arten: {
        bekaempfer: { name: 'Schädlingsbekämpfer/in', b: { fahrzeug: false, kunden: false, praemien: true } },
        lehrling: { name: 'Lehrling (Schädlingsbekämpfung)', b: { fahrzeug: false, kunden: false, praemien: true } }
      } },
    kunststoff: { name: 'Kunststoffverarbeitung', paket: 'kunststoff', kvs: ['kunststoff', 'eigen'], einfach: true, diaeten: false, sw: false, b: { fahrzeug: false, kunden: false, praemien: true },
      arten: {
        maschine: { name: 'Maschinenarbeiter/in / Facharbeiter/in (Kunststoff)', b: { fahrzeug: false, kunden: false, praemien: true } },
        hilfskraft: { name: 'Hilfskraft (Verpacken, Reinigung, Lager)', b: { fahrzeug: false, kunden: false, praemien: true } },
        lehrling: { name: 'Lehrling (Kunststoffverarbeitung)', b: { fahrzeug: false, kunden: false, praemien: true } }
      } },
    garage: { name: 'Garage, Tankstelle, Service', paket: 'garage', kvs: ['garage', 'eigen'], einfach: true, diaeten: false, sw: false, b: { fahrzeug: false, kunden: false, praemien: true },
      arten: {
        arbeiter: { name: 'Garage / Tankstelle (Arbeiter/in)', b: { fahrzeug: false, kunden: false, praemien: true } },
        angestellte: { name: 'Garage / Tankstelle (Angestellte/r)', b: { fahrzeug: false, kunden: false, praemien: true } }
      } },
    kosmetik: { name: 'Kosmetik, Fußpflege, Massage', paket: 'kosmetik', kvs: ['kosmetik', 'eigen'], einfach: true, diaeten: false, sw: false, b: { fahrzeug: false, kunden: false, praemien: true },
      arten: {
        kosmetik: { name: 'Kosmetiker/in', b: { fahrzeug: false, kunden: false, praemien: true } },
        fusspflege: { name: 'Fußpfleger/in', b: { fahrzeug: false, kunden: false, praemien: true } },
        massage: { name: 'Masseur/in', b: { fahrzeug: false, kunden: false, praemien: true } },
        lehrling: { name: 'Lehrling (Kosmetik, Fußpflege, Massage)', b: { fahrzeug: false, kunden: false, praemien: true } }
      } },
    seilbahn: { name: 'Seilbahn und Schilift', paket: 'seilbahn', kvs: ['seilbahn', 'eigen'], einfach: true, diaeten: false, sw: false, b: { fahrzeug: false, kunden: false, praemien: true },
      arten: {
        betrieb: { name: 'Seilbahn- und Liftbetrieb', b: { fahrzeug: false, kunden: false, praemien: true } },
        piste: { name: 'Pistendienst und Beschneiung', b: { fahrzeug: false, kunden: false, praemien: true } },
        kassa: { name: 'Kassa und Büro (Seilbahn)', b: { fahrzeug: false, kunden: false, praemien: true } },
        lehrling: { name: 'Lehrling (Seilbahntechnik)', b: { fahrzeug: false, kunden: false, praemien: true } }
      } },
    lmindustrie: { name: 'Lebensmittelindustrie', paket: 'lm_obst', kvs: ['lm_obst', 'lm_getraenke', 'lm_fleisch', 'eigen'], einfach: true, diaeten: false, sw: false, b: { fahrzeug: false, kunden: false, praemien: true },
      arten: {
        produktion: { name: 'Produktion und Verpackung', b: { fahrzeug: false, kunden: false, praemien: true } },
        fleisch: { name: 'Fleisch- und Wurstwaren', kv: 'lm_fleisch', b: { fahrzeug: false, kunden: false, praemien: true } },
        getraenke: { name: 'Getränkeerzeugung', kv: 'lm_getraenke', b: { fahrzeug: false, kunden: false, praemien: true } },
        lager: { name: 'Lager, Stapler, Zustellung (Lebensmittel)', b: { fahrzeug: false, kunden: false, praemien: true } },
        lehrling: { name: 'Lehrling (Lebensmitteltechnik)', b: { fahrzeug: false, kunden: false, praemien: true } }
      } },
    kino: { name: 'Kino', paket: 'kino_w', kvs: ['kino_w', 'kino_noe', 'kino_bgld', 'kino_ooe', 'kino_stmk', 'kino_ktn', 'kino_sbg', 'kino_t', 'kino_vbg', 'eigen'], einfach: true, diaeten: false, sw: false, b: { fahrzeug: false, kunden: false, praemien: true },
      arten: {
        vorfuehrung: { name: 'Filmvorführung und Haustechnik', b: { fahrzeug: false, kunden: false, praemien: true } },
        kassa: { name: 'Kassa, Büffet, Einlass', b: { fahrzeug: false, kunden: false, praemien: true } }
      } },
    rettung: { name: 'Rettungsdienst', paket: 'rettung_noe', kvs: ['rettung_noe', 'rettung_bgld', 'rettung_stmk', 'rettung_sbg', 'rettung_t', 'sozial', 'eigen'], einfach: true, diaeten: false, sw: false, b: { fahrzeug: false, kunden: false, praemien: true },
      arten: {
        rs: { name: 'Rettungssanitäter/in, Einsatzfahrer/in', b: { fahrzeug: false, kunden: false, praemien: true } },
        nfs: { name: 'Notfallsanitäter/in', b: { fahrzeug: false, kunden: false, praemien: true } },
        leitstelle: { name: 'Leitstelle und Dienstführung', b: { fahrzeug: false, kunden: false, praemien: true } },
        hilfe: { name: 'Hilfsdienste (Rettung)', b: { fahrzeug: false, kunden: false, praemien: true } }
      } },
    friseur: { name: 'Friseur / Friseurin', paket: 'friseur', kvs: ['friseur', 'eigen'], einfach: true, diaeten: false, sw: false, b: { fahrzeug: false, kunden: false, praemien: true },
      arten: {
        friseur: { name: 'Friseur / Friseurin', b: { fahrzeug: false, kunden: false, praemien: true } },
        angelernt: { name: 'Angelernte Hilfskraft (Waschen, Empfang)', b: { fahrzeug: false, kunden: false, praemien: true } },
        salon: { name: 'Salonleitung / Meister', b: { fahrzeug: false, kunden: false, praemien: true } },
        lehrling: { name: 'Lehrling (Friseur)', b: { fahrzeug: false, kunden: false, praemien: true } }
      } },
    pflege: { name: 'Pflege / Betreuung / Soziales', paket: 'sozial', kvs: ['sozial', 'kur_reha', 'eigen'], einfach: true, diaeten: false, sw: false, b: { fahrzeug: false, kunden: false, praemien: true },
      arten: {
        pa: { name: 'Pflegeassistenz', b: { fahrzeug: false, kunden: false, praemien: true } },
        pfa: { name: 'Pflegefachassistenz', b: { fahrzeug: false, kunden: false, praemien: true } },
        dgkp: { name: 'Diplomierte Gesundheits- und Krankenpflege', b: { fahrzeug: false, kunden: false, praemien: true } },
        heimhilfe: { name: 'Heimhilfe / Betreuung / Sozialbetreuung', b: { fahrzeug: false, kunden: false, praemien: true } },
        mobil: { name: 'Mobile Pflege / Hauskrankenpflege', b: { fahrzeug: true, kunden: true, praemien: true } },
        lehrling: { name: 'Lehrling (Pflegelehre)', b: { fahrzeug: false, kunden: false, praemien: false } }
      } },
    anderes: { name: 'Etwas anderes', paket: 'eigen', einfach: true, diaeten: false, sw: false, b: { fahrzeug: false, kunden: false, praemien: false } }
  };
  function berufName(w) {
    var b = w && BERUFE[w.beruf]; if (!b) return null;
    var a = b.arten && w.art && b.arten[w.art];
    return b.name + (a ? ' (' + a.name + ')' : '');
  }
  // Ist die Arbeitsart eine Tour? Dann heißen "Kunde / Baustelle" in der Erfassung "Tour".
  function istBau(w) { return !!w && (w.paket === 'bau' || w.paket === 'de_bau' || w.paket === 'holzbau' || w.paket === 'dachdecker' || w.paket === 'pflasterer'); }
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
    if (!w.zaUmr) w.zaUmr = 'offen';
    return w;
  }

  // Lohntabelle eines Kollektivvertrags, wie sie an einem Datum gilt (berücksichtigt "folgt"). Ein neuer Stand muss alle Gruppen enthalten.
  function lgFuer(lg, ab) {
    if (!lg || !lg.folgt || !lg.folgt.length) return lg;
    var f = null; lg.folgt.forEach(function (x) { if (x.ab <= ab && (!f || x.ab > f.ab)) f = x; });
    if (!f) return lg;
    var c = {}; Object.keys(lg).forEach(function (k) { c[k] = lg[k]; });
    c.stand = f.stand || lg.stand;
    c.gruppen = lg.gruppen.map(function (g) { var a = f.gruppen && f.gruppen[g.id]; if (!a) return g; var n = {}; Object.keys(g).forEach(function (k) { n[k] = g[k]; }); n.l = a; return n; });
    return c;
  }
  // Kommende Lohnstände eines Kollektivvertrags (Feld "folgt": [{ab, stand, gruppen:{id:[Werte]}}]).
  // Gibt den nächsten Stand zurück, der in den nächsten "tage" Tagen gilt und für den noch keine Werte angelegt sind.
  function lgAnstehend(settings, heute, tage) {
    if (!settings || !settings.length) return null;
    var w = wertAt(settings, heute), lg0 = LOHNGRUPPEN[w.paket], lg = lgFuer(lg0, heute);
    if (!lg0 || !lg0.folgt || !lg0.folgt.length || !w.lg) return null;
    var g = null; lg.gruppen.forEach(function (x) { if (x.id === w.lg) g = x; });
    if (!g) return null;
    var grenze = addDays(heute, tage == null ? 45 : tage), hit = null;
    lg0.folgt.slice().sort(function (a, b) { return a.ab < b.ab ? -1 : 1; }).forEach(function (f) {
      if (hit || f.ab > grenze || f.ab <= w.gueltigAb) return;
      if (settings.some(function (e) { return e.gueltigAb >= f.ab; })) return;
      var arr = f.gruppen && f.gruppen[w.lg]; if (!arr) return;
      var i = lg.stufen && g.l.length > 1 ? (w.ls == null || w.ls === '' ? -1 : +w.ls) : 0;
      var val = i >= 0 ? arr[i] : null, alt = i >= 0 ? g.l[i] : null; if (val == null) return;
      hit = { ab: f.ab, stand: f.stand || ('ab ' + f.ab), val: val, alt: alt, mon: !!g.m, auto: w.lgAuto === true, gruppe: g.name, paket: w.paket };
    });
    return hit;
  }
  // Vergleichsrechnung "nach Kollektivvertrag und Gesetz": dieselben Tage, aber ohne die Handhabung der Firma.
  // opts.kvRef = true (alle Regeln) oder eine Liste: 'zu' Zuschläge nach KV, 'betrieb' Betrieb geschlossen ist bezahlte Zeit,
  // 'frei' Freistellung durch die Firma ist bezahlt, 'rund' Zeiten ungerundet, 'lohn' mindestens der Lohn der hinterlegten Lohngruppe.
  var KV_REGELN = ['zu', 'betrieb', 'frei', 'rund', 'lohn', 'diaet']; // 'diaet': Diäten nach den Werten des Kollektivvertrags, ohne die von Hand geänderten Diätenstunden
  function kvLohn(w, dateStr) { // Mindestlohn laut hinterlegter Lohngruppe: { std, mon } oder null
    var lg0 = w && LOHNGRUPPEN[w.paket]; if (!lg0 || !w.lg) return null;
    var lg = lgFuer(lg0, dateStr || w.gueltigAb || '0000-00-00'), g = null; lg.gruppen.forEach(function (x) { if (x.id === w.lg) g = x; }); if (!g) return null;
    var i = lg.stufen && g.l.length > 1 ? (w.ls == null || w.ls === '' ? -1 : Math.min(+w.ls, g.l.length - 1)) : 0, v = i >= 0 ? g.l[i] : null; if (v == null) return null; // Stufe über der letzten der Gruppe: höchste Stufe der Gruppe
    if (!g.m) return { std: v, mon: null };
    var tl = lg.teiler || Math.round((wochenStd(w.ueberstunden) > 0 ? wochenStd(w.ueberstunden) : 38.5) * 52 / 12 * 100) / 100, vz = +w.ueberstunden.vollzeitStd > wochenStd(w.ueberstunden) ? wochenStd(w.ueberstunden) / +w.ueberstunden.vollzeitStd : 1;
    return { std: Math.round(v / tl * 100) / 100, mon: Math.round(v * vz * 100) / 100 };
  }
  function unterKv(w, dateStr) { // { lohn: {ist, kv}, diaet: {ist, kv} } oder null
    if (!w) return null; var out = {}, kl = kvLohn(w, dateStr), p = PAKETE[w.paket];
    if (kl) { if (+w.monatslohn > 0 && kl.mon && +w.monatslohn < kl.mon - 0.005) out.lohn = { ist: +w.monatslohn, kv: kl.mon, monat: true }; else if (!(+w.monatslohn > 0) && +w.stundenlohn > 0 && +w.stundenlohn < kl.std - 0.005) out.lohn = { ist: +w.stundenlohn, kv: kl.std }; }
    if (p && w.paket !== 'eigen' && p.werte.diaeten && w.diaeten && p.werte.diaeten.modell === 'stunde' && +p.werte.diaeten.satz > 0 && (w.diaeten.modell === 'aus' || (w.diaeten.modell === 'stunde' && +w.diaeten.satz < +p.werte.diaeten.satz - 0.005))) out.diaet = { ist: w.diaeten.modell === 'aus' ? 0 : +w.diaeten.satz, kv: +p.werte.diaeten.satz };
    return out.lohn || out.diaet ? out : null;
  }
  function wRef(w, opts, dateStr) {
    if (!opts || !opts.kvRef || !w) return w;
    var keys = opts.kvRef === true ? KV_REGELN : opts.kvRef, c = null;
    function kopie() { if (!c) { c = {}; Object.keys(w).forEach(function (k) { c[k] = w[k]; }); } return c; }
    function hat(k) { return keys.indexOf(k) >= 0; }
    var p = PAKETE[w.paket];
    if (hat('zu') && w.zuschlag && w.zuschlag.art !== 'kv' && p && w.paket !== 'eigen' && p.werte && p.werte.zuschlag) kopie().zuschlag = clone(p.werte.zuschlag);
    if (hat('betrieb') && w.betriebFrei === 'ueberstunden') kopie().betriebFrei = 'urlaub';
    if (hat('frei')) kopie().kvFrei = true;
    if (hat('rund') && w.runAn) kopie().runAn = false;
    if (hat('diaet') && p && w.paket !== 'eigen' && p.werte && p.werte.diaeten && w.diaeten) {
      // Zählregeln des Kollektivvertrags, aber eigene Sätze bleiben, wenn sie gleich hoch oder höher sind (Bezahlung über dem Kollektivvertrag ist kein Unterschied).
      var kd = clone(p.werte.diaeten), ud = w.diaeten, maxS = function (d) { var x = 0; (d.stufen || []).forEach(function (q) { if (+q.satz > x) x = +q.satz; }); return x; };
      if (kd.modell === ud.modell) { if (kd.modell === 'stunde' && +ud.satz >= +kd.satz) kd.satz = +ud.satz; if (kd.modell === 'tag' && maxS(ud) >= maxS(kd) && (ud.stufen || []).length) kd.stufen = clone(ud.stufen); }
      kopie().diaeten = kd; c.kvDiaet = true;
    }
    if (hat('lohn')) { var kl = kvLohn(w, dateStr); if (kl) { if (+w.monatslohn > 0 && kl.mon && +w.monatslohn < kl.mon - 0.005) { kopie().monatslohn = kl.mon; c.stundenlohn = kl.std; } else if (!(+w.monatslohn > 0) && w.stundenlohn != null && +w.stundenlohn > 0 && +w.stundenlohn < kl.std - 0.005) kopie().stundenlohn = kl.std; } }
    return c || w;
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
  // Zeitumstellung (Österreich): letzter Sonntag im März 02:00 -> 03:00 (eine Stunde fehlt), letzter Sonntag im Oktober 03:00 -> 02:00 (eine Stunde kommt dazu).
  function letzterSonntag(y, m) { var d = new Date(Date.UTC(y, m, 0)); return d.getUTCDate() - d.getUTCDay(); }
  function dstKorrektur(dateStr, von, bis) {
    if (!dateStr || von === null || bis === null) return 0;
    var p = parseISO(dateStr), wd = weekday(dateStr), mar = letzterSonntag(p.y, 3), okt = letzterSonntag(p.y, 10);
    var istSo = wd === 0, istSa = wd === 6;
    var umMar = p.m === 3 && ((istSo && p.d === mar) || (istSa && p.d === mar - 1));
    var umOkt = p.m === 10 && ((istSo && p.d === okt) || (istSa && p.d === okt - 1));
    if (!umMar && !umOkt) return 0;
    var ueberMitternacht = bis <= von; // Dienst geht über Mitternacht
    var tag = istSo && p.d === (umMar ? mar : okt);
    var schnitt; // der Dienst umfasst die Umstellung (um 03:00 Uhr)
    if (tag) schnitt = !ueberMitternacht && von < (umMar ? 120 : 180) && bis >= 180;
    else schnitt = ueberMitternacht && bis >= 180;
    if (!schnitt) return 0;
    return umMar ? -60 : 60;
  }
  function dayMinutes(day, w, dateStr) {
    var von = toMin(day && day.von), bis = toMin(day && day.bis), warn = [];
    if (von === null || bis === null) return { brutto: 0, pausen: 0, netto: 0, warn: warn };
    // Rundung der Zeiten laut Einstellung (nur die Berechnung, der eingetragene Wert bleibt stehen)
    var rm = w && w.runAn && +w.runMin > 0 ? +w.runMin : 0;
    if (rm) { von = rundZeit(von, w.runBeg, rm); bis = rundZeit(bis, w.runEnd, rm); }
    var brutto = bis - von;
    if (brutto < 0) brutto += 1440;
    if (brutto === 0) warn.push('Von und Bis sind gleich.');
    var dst = dstKorrektur(dateStr, von, bis);
    if (dst && brutto + dst > 0) brutto += dst; else dst = 0;
    var pausen = 0;
    (day.pausen || []).forEach(function (p) {
      var s = toMin(p.von), e = toMin(p.bis);
      if (s === null || e === null) return;
      if (s < von) s += 1440;
      if (e < s) e += 1440;
      if (e < s) { warn.push('Eine Pause endet vor ihrem Beginn. Sie wird nicht gezählt.'); return; } // falsch eingetragene Pause darf die Arbeitszeit nie verlängern
      pausen += e - s;
    });
    // Automatischer Pausenabzug (zum Beispiel 60 Minuten), wenn der Tag keine eigene Pause hat. Die Diäten zählen weiter ab Beginn bis Ende.
    if (pausen === 0 && w && +w.pauseAutoMin > 0 && brutto > 0) pausen = Math.min(brutto, Math.round(+w.pauseAutoMin));
    var netto = brutto - pausen;
    if (netto < 0) { warn.push('Die Pausen sind länger als die Arbeitszeit.'); netto = 0; }
    return { brutto: brutto, pausen: pausen, netto: netto, warn: warn, dst: dst };
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
    if (status === 'betriebsurlaub' && w.betriebFrei === 'ueberstunden') res.betriebAbzugMin = sollMin;

    // Betrieb geschlossen: je nach Firma als Urlaub bezahlt oder aus den Überstunden (dann keine Gutschrift in den Stunden).
    var credit = STATUS[status].credit && !(status === 'betriebsurlaub' && w.betriebFrei === 'ueberstunden');
    var mitArbeit = status !== 'arbeit' && status !== 'feiertag' && !!(day && day.von && day.bis); // an jedem freien Tag darf trotzdem gearbeitet worden sein: dann Tag plus Arbeit
    if (status === 'freistellung') { res.freiModus = freiModus(day, w); res.freiSollMin = sollMin; if (res.freiModus === 'bezahlt' || res.freiModus === 'offen') res.creditMin = sollMin; if (!mitArbeit) return res; } // Firma schickt heim: bezahlt = Sollstunden gutgeschrieben, sonst keine Gutschrift (Zeitausgleich oder unbezahlt)
    if (status === 'ersatzruhe') { var exr = +day.extra; if (isNaN(exr) || exr < 0) exr = 0; res.extraMin = Math.round(exr * 60); res.creditMin = res.extraMin; if (!mitArbeit) return res; } // Ersatzruhetag: ohne Angabe zählt er aus den Überstunden, mit Angabe hat die Firma die Stunden bezahlt
    var credBase = res.creditMin || 0;
    if (credit && status !== 'freistellung' && status !== 'ersatzruhe') { res.creditMin = sollMin; credBase = sollMin; if (!mitArbeit) return res; }
    else if (status !== 'arbeit' && !mitArbeit) return res;

    var m = dayMinutes(day, w, dateStr);
    if (mitArbeit && !(m.netto > 0)) return res;
    res.dstMin = m.dst || 0;
    res.bruttoMin = m.brutto; res.pausenMin = m.pausen; res.nettoMin = m.netto; res.warn = m.warn;

    var z = w.zuschlag, pct = 0;
    if (typ === 'sonntag') pct = z.so; else if (typ === 'feiertag') pct = z.ft; else if (typ === 'samstag') pct = z.sa;
    pct = +pct || 0;
    if (z.art === 'kv') {
      // Nach Kollektivvertrag: Die Stunden zählen einfach. Der Zuschlag steht in einer eigenen Zeile und wird nicht zu Überstunden.
      res.kv = true; res.faktor = 1; res.wertMin = m.netto; res.zuPct = pct; res.zuMin = pct > 0 ? m.netto : 0;
      var solltag = istSollTag(w.ueberstunden, wd), de = !!(PAKETE[w.paket] && PAKETE[w.paket].land === 'DE');
      if (typ === 'feiertag' && status === 'arbeit' && solltag && !de) {
        // Österreich (§ 9 Arbeitsruhegesetz): Feiertagsentgelt für die ausgefallenen Sollstunden plus Bezahlung der gearbeiteten Stunden.
        // Gearbeitete Stunden bis zum Tagessoll sind "Feiertagsarbeit" (einfach bezahlt), nur die Stunden darüber zählen in die Überstunden.
        res.ftArbeitMin = Math.min(m.netto, sollMin); res.ftCreditMin = sollMin;
        res.wertMin = m.netto - res.ftArbeitMin; res.hochMin = res.wertMin;
      } else if ((typ === 'sonntag' || typ === 'feiertag' || typ === 'samstag') && !solltag) res.hochMin = m.netto; // Arbeit an einem freien Tag: kommt als Mehrstunden in den Monat
      if (!(pct >= (w.ueberstunden.zuschlagPct != null ? +w.ueberstunden.zuschlagPct : 50)) || !(pct > 0)) res.hochMin = 0; // nur wenn der Tageszuschlag den Überstundenzuschlag ersetzt (es gilt der höhere)
    } else {
      res.faktor = 1 + pct / 100;
      res.wertMin = m.netto * res.faktor;
    }
    // Zusätzlich bezahlte Stunden am selben Tag (zum Beispiel Sonderurlaub plus Arbeit): werden einfach dazugezählt.
    var ex = +day.extra; if (isNaN(ex) || ex < 0) ex = 0;
    if (status === 'ersatzruhe') ex = 0; // beim Ersatzruhetag ist "extra" schon die Gutschrift des Tages
    if (status !== 'ersatzruhe') res.extraMin = Math.round(ex * 60); res.creditMin = credBase + (status === 'ersatzruhe' ? 0 : res.extraMin) + (res.ftCreditMin || 0);

    // Überstunden-Beitrag des Tages (Modell "tag-saldo": Arbeitsstunden minus Tagessoll, kürzere Tage gleichen aus)
    if (w.ueberstunden.modell === 'tag-saldo' && (res.wertMin > 0 || res.swMin > 0 || res.extraMin > 0)) {
      res.saldoMin = res.wertMin + res.creditMin - Math.max(0, sollMin - res.swMin);
    }

    // Diäten
    var d = w.diaeten;
    if (d.modell !== 'aus' && m.brutto > 0) {
      var std;
      if (day.diaeten !== null && day.diaeten !== undefined && day.diaeten !== '' && !w.kvDiaet) std = +day.diaeten;
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
  function kundenZeiten(day, w, dateStr) {
    var pausen = ((day && day.pausen) || []).map(function (p) { return [toMin(p.von), toMin(p.bis), p.von + '–' + p.bis]; }).filter(function (p) { return p[0] !== null && p[1] !== null; });
    var abz = 0, pl = []; // Minuten Pause, die bei der zuletzt berechneten Zeit abgezogen wurden
    function dauer(von, bis) {
      abz = 0; pl = [];
      var a = toMin(von), b = toMin(bis); if (a === null || b === null) return null;
      if (b < a) b += 1440;
      var min = b - a;
      pausen.forEach(function (p) {
        var s = p[0], e = p[1]; if (e < s) e += 1440;
        [0, 1440].forEach(function (off) { var o = Math.min(b, e + off) - Math.max(a, s + off); if (o > 0) { min -= o; abz += o; if (pl.indexOf(p[2]) < 0) pl.push(p[2]); } });
      });
      return Math.max(0, min);
    }
    var rows = [];
    ((day && day.kunden) || []).forEach(function (k, ki) {
      if (!k) return;
      var tl = k.taet || ((k.tat || k.von || k.bis) ? [{ tat: k.tat, von: k.von, bis: k.bis }] : []);
      tl = tl.map(function (t, j) { return { t: t, j: j }; }).filter(function (o) { return (o.t.tat || '').trim() || o.t.von || o.t.bis; });
      if (!(k.name || '').trim() && !tl.length) return;
      var taet = tl.map(function (o) { var m = dauer(o.t.von, o.t.bis); return { tat: (o.t.tat || '').trim(), min: m, pau: abz, j: o.j, von: o.t.von || '', bis: o.t.bis || '', pl: pl.slice() }; });
      var min = null, pau = 0; taet.forEach(function (t) { if (t.min !== null) { min = (min || 0) + t.min; pau += t.pau; } });
      rows.push({ name: (k.name || '').trim(), taet: taet, min: min, pau: pau, ki: ki });
    });
    // Nur ein Kunde und keine Zeiten: es zählt die Arbeitszeit des Tages.
    if (rows.length === 1 && rows[0].min === null) {
      var dm = dayMinutes(day, w, dateStr); if (dm.netto > 0) { rows[0].min = dm.netto; rows[0].quelle = 'tag'; }
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
        if (kw) kundenZeiten(day, w, r.datum).rows.forEach(function (k) { k.taet.forEach(function (t) { if (t.min && t.tat.toLowerCase().indexOf(kw) >= 0) mm += t.min; }); });
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
      arbeitstage: 0, urlaub: 0, krank: 0, pflege: 0, schule: 0, za: 0, freiTage: 0, freiListe: [], betriebListe: [], feiertageBezahlt: 0, zuschlagMin: 0,
      feMin: 0, urMin: 0, krMin: 0, pfMin: 0, soMin: 0, sonderTage: 0, feExtraMin: 0, zuTagMin: 0, zuEqMin: 0, ftArbMin: 0, hochKandMin: 0, kvTage: 0, altTage: 0 };
    var bauWochen = false, monatModell = false, gleitModell = false, anyEntry = false;
    var prList = (data.profil && data.profil.praemien) || [], prSum = {};

    for (var d = 1; d <= n; d++) {
      var ds = iso(y, m, d), w = wRef(wertAt(settings, ds), opts, ds), r = calcDay(days[ds], ds, w);
      tage.push(r);
      if (r.leer) continue;
      // Automatischer Feiertag ohne Eintrag: vor dem ersten Eintrag und in der Zukunft noch nicht mitzählen (nur Modell "monat").
      if (!days[ds] && (w.ueberstunden.modell === 'monat' || w.ueberstunden.modell === 'gleit') && ((heute && ds > heute) || (live && firstKey && ds < firstKey))) continue;
      s.istMin += r.nettoMin;
      s.lohnMin += r.wertMin + r.creditMin;
      if (r.kv) { s.zuTagMin += r.zuMin || 0; s.zuEqMin += (r.zuMin || 0) * (r.zuPct || 0) / 100; s.ftArbMin += r.ftArbeitMin || 0; s.hochKandMin += r.hochMin || 0; if (r.zuPct > (s.hochPct || 0) && r.hochMin > 0) s.hochPct = r.zuPct; if (r.nettoMin > 0) s.kvTage++; }
      else { s.zuschlagMin += r.wertMin - r.nettoMin; if (r.nettoMin > 0 && r.faktor !== 1) s.altTage++; }
      s.swMin += r.swMin;
      s.diaetenStd += r.diaetenStd;
      s.diaetenBetrag += r.diaetenBetrag;
      if (r.nettoMin > 0) s.arbeitstage++;
      if (r.status === 'urlaub' || r.status === 'betriebsurlaub') s.urlaub++;
      if (r.status === 'sonderurlaub') s.sonderTage++;
      if (r.status === 'krank') s.krank++;
      if (r.status === 'pflege') s.pflege++;
      if (r.status === 'schule') s.schule++;
      if (r.status === 'za') s.za++;
      if (r.betriebAbzugMin > 0) s.betriebListe.push({ datum: ds, std: h2(r.betriebAbzugMin) });
      if (r.status === 'freistellung') { s.freiTage++; s.freiListe.push({ datum: ds, modus: r.freiModus, std: h2(r.freiSollMin || 0) }); }
      if (r.status === 'feiertag') { s.feiertageBezahlt++; s.feMin += r.creditMin; }
      if (r.ftCreditMin) s.feMin += r.ftCreditMin; // nach KV: Feiertagsentgelt zählt wie ein bezahlter Feiertag
      else if (!r.kv && r.status === 'arbeit' && r.typ === 'feiertag' && r.nettoMin > 0) s.feExtraMin += Math.round(tagesSoll(w.ueberstunden) * 60); // Bisherige Rechenweise (Zuschlag als Stunden): bleibt genau wie vor der Umstellung, damit sich bei bestehenden Nutzern keine Zahl ändert.
      if (r.status === 'urlaub' || r.status === 'betriebsurlaub') s.urMin += Math.min(r.creditMin, Math.round(sollFuer(w.ueberstunden, weekday(ds)) * 60));
      if (r.status === 'sonderurlaub') s.soMin += Math.min(r.creditMin, Math.round(sollFuer(w.ueberstunden, weekday(ds)) * 60));
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
        if (istSollTag(wRef(wertAt(settings, dq), opts, dq).ueberstunden, wq) && !(days[dq] && (UNBEZAHLT_FREI.indexOf(days[dq].status) >= 0 || (days[dq].status === 'freistellung' && freiModus(days[dq], wRef(wertAt(settings, dq), opts, dq)) === 'unbezahlt')))) sollMin += Math.round(sollFuer(wRef(wertAt(settings, dq), opts, dq).ueberstunden, wq) * 60); // unbezahlter freier Tag zählt nicht zum Soll
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
            var oz = { noQ: true, noZa: true }; if (opts && opts.ohneSpaeter) oz.ohneSpaeter = true; if (opts && opts.kvRef) oz.kvRef = opts.kvRef;
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
          var dk = addDays(sonntag, k), rk = calcDay(days[dk], dk, wRef(wertAt(settings, dk), opts, dk));
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
    var credMin = s.feMin + s.urMin + s.krMin + s.pfMin + s.soMin;
    // Überstunden, die auf einen Sonn- oder Feiertag fallen: Dort gilt der höhere Tageszuschlag statt des Überstundenzuschlags (nicht beide).
    s.ueberHochMin = Math.min(Math.max(0, s.ueberMin - (s.mehrMin || 0) - (s.mehrFreiMin || 0)), s.hochKandMin);
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
        arbeitstage: s.arbeitstage, urlaub: s.urlaub, krank: s.krank, pflege: s.pflege, schule: s.schule, za: s.za, freiTage: s.freiTage, betriebListe: s.betriebListe, freiListe: s.freiListe, zaUmr: (wertAt(settings, iso(y, m, n)) || {}).zaUmr || 'offen',
        feiertageBezahlt: s.feiertageBezahlt, sollStd: h2(s.sollMin || 0), sollAb: s.sollAb || 1,
        zuArt: s.kvTage > 0 || !s.altTage ? 'kv' : 'stunden', zuTagStd: h2(s.zuTagMin), zuEqStd: h2(s.zuEqMin), ftArbeitStd: h2(s.ftArbMin), ueberHochStd: h2(s.ueberHochMin || 0), hochPct: s.hochPct || 0, zuAltTage: s.altTage,
        normalStd: h2(normalMin), feiertagStd: h2(s.feMin + s.feExtraMin), urlaubStd: h2(s.urMin), krankStd: h2(s.krMin), pflegeStd: h2(s.pfMin), sonderStd: h2(s.soMin), sonderTage: s.sonderTage
      },
      schlechtwetter: { verbrauchtStd: h2(sw.min), kontingentStd: sw.kontingentStd, von: sw.vonDatum, bis: sw.bisDatum }
    };
  }

  // Monatsabgleich: eigene Rechnung gegen die Zeilen auf dem Lohnzettel (gleiche Namen, gleiche Aufteilung).
  // diff = Lohnzettel minus App. Negativ heißt: Der Lohnzettel hat weniger als deine Aufzeichnung.
  var AB_ZEILEN = [
    { key: 'lohn',     label: 'Lohn',          pflicht: true,  faktor: 1, hole: function (s) { return s.normalStd; } },
    { key: 'ueber',    label: 'Überstunden',   pflicht: true,  faktor: 'ueber', hole: function (s) { return Math.max(0, s.ueberStd - (s.mehrStd || 0) - (s.mehrFreiStd || 0)); } },
    { key: 'ueberHoch', label: 'davon Überstunden mit höherem Zuschlag (Sonntag, Feiertag)', pflicht: false, faktor: 'hoch', hole: function (s) { return s.ueberHochStd || 0; } },
    { key: 'mehr',     label: 'Mehrarbeit (Teilzeit)', pflicht: false, faktor: 'mehr', hole: function (s) { return s.mehrStd || 0; } },
    { key: 'feiertag', label: 'Feiertagslohn', pflicht: false, faktor: 1, hole: function (s) { return s.feiertagStd; } },
    { key: 'ftarbeit', label: 'Feiertagsarbeit (gearbeitete Stunden am Feiertag)', pflicht: false, faktor: 1, hole: function (s) { return s.ftArbeitStd || 0; } },
    { key: 'zuschlag', label: 'Sonn- und Feiertagszuschlag (Stunden mit Zuschlag)', pflicht: false, faktor: 'zu', hole: function (s) { return s.zuTagStd || 0; } },
    { key: 'urlaub',   label: 'Urlaub',        pflicht: false, faktor: 1, hole: function (s) { return s.urlaubStd; } },
    { key: 'krank',    label: 'Krankenstand',  pflicht: false, faktor: 1, hole: function (s) { return s.krankStd; } },
    { key: 'pflege',   label: 'Pflegefreistellung', pflicht: false, faktor: 1, hole: function (s) { return s.pflegeStd; } },
    { key: 'dStd',     label: 'Diäten',        pflicht: true,  faktor: 'diaeten', hole: function (s) { return s.diaetenStd; } },
    // Manche Lohnzettel zeigen bei Diäten nur den Betrag in Euro, keine Stunden.
    { key: 'dEuro',    label: 'Diäten (Betrag in Euro)', unit: '€', pflicht: false, nurAlle: true, faktor: 'euro', hole: function (s) { return s.diaetenBetrag; } },
    // Zeitausgleich-Konto: Überstunden, die nicht ausbezahlt, sondern auf das Konto gebucht wurden. Wird zur Überstundenzeile dazugezählt.
    { key: 'zaKonto',  label: 'Zeitausgleich-Konto (Zuwachs)', pflicht: false, info: true, hole: function () { return null; } },
    // Sonderurlaub: wird von manchen Firmen aus den Überstunden bezahlt und zählt dann zur Zeile "Lohn" dazu.
    { key: 'sonder',   label: 'Sonderurlaub (aus Überstunden bezahlt)', pflicht: false, info: true, hole: function (s) { return s && s.sonderStd > 0 ? s.sonderStd : null; } },
    // Urlaubszuschuss / Sonderzahlung: steht auf dem Lohnzettel meist nur als Bruttobetrag. Reine Eingabezeile, wird mit der Sonderzahlung im Profil verglichen.
    { key: 'urlaubszuschuss', label: 'Urlaubszuschuss (Brutto)', unit: '€', pflicht: false, info: true, hole: function () { return null; } }
  ];
  function hasNum(v) { return !(v === null || v === undefined || v === '' || isNaN(+v)); }
  function abgleich(summe, lz, alle, fix, alles) { // fix: Fixlohn (Monatsgehalt): Lohn, Feiertag, Urlaub, Krank und Pflege stehen dann ohne Stunden auf dem Lohnzettel
    if (summe && summe.gleit) { // Gleitzeit (Bundesdienst): ein Saldo statt Lohn und Überstunden
      var gv = lz && lz.gleit, gh = hasNum(gv), ga = r2(summe.ueberStd || 0), grow;
      if (!gh) grow = { key: 'gleit', label: 'Gleitzeitsaldo des Monats', app: ga, lz: null, diff: null, status: 'offen', faktor: 0 };
      else { var gd = r2(+gv - ga), gb = Math.abs(gd); grow = { key: 'gleit', label: 'Gleitzeitsaldo des Monats', app: ga, lz: +gv, lzGesamt: +gv, diff: gd, faktor: 0, status: gb < 0.005 ? 'gleich' : gb <= 0.5 ? 'klein' : gd < 0 ? 'weniger' : 'mehr' }; }
      return [grow];
    }
    var rows = [], za = lz && hasNum(lz.zaKonto) ? zaUeber(+lz.zaKonto, summe && summe.zaUmr) : 0, so = lz && hasNum(lz.sonder) && !(summe && summe.sonderStd > 0) ? +lz.sonder : 0;
    var ueberWeniger = !!(lz && hasNum(lz.ueber) && summe && +lz.ueber < (summe.ueberStd || 0) - 0.25); // Lohnzettel hat weniger Überstunden: vielleicht aufs Zeitausgleich-Konto gebucht, dann die Zeile gleich zeigen
    AB_ZEILEN.forEach(function (z) {
      var v = lz && lz[z.key], has = hasNum(v);
      var eigenSo = z.key === 'sonder' && summe && summe.sonderStd > 0; // eigene Sonderurlaubstage: dann echter Vergleich statt reiner Eingabezeile
      if (z.info && !eigenSo) { // reine Eingabezeile, nur sichtbar wenn eingetragen oder "alle Zeilen"
        if (has || alle || (z.key === 'zaKonto' && ueberWeniger)) rows.push({ key: z.key, label: z.label, unit: z.unit, app: null, lz: has ? +v : null, diff: null, status: 'info' });
        return;
      }
      if (fix && !alle && !has && ['lohn', 'feiertag', 'urlaub', 'krank', 'pflege', 'sonder'].indexOf(z.key) >= 0) return;
      if (alles && !has && ['feiertag', 'urlaub', 'krank', 'pflege', 'sonder'].indexOf(z.key) >= 0) return; // alles steckt in der Zeile Lohn
      var app = r2(z.hole(summe) || 0);
      if (alles && z.key === 'lohn') app = r2((summe.normalStd || 0) + (summe.feiertagStd || 0) + (summe.urlaubStd || 0) + (summe.krankStd || 0) + (summe.pflegeStd || 0) + (summe.sonderStd || 0));
      var eingetragenOhneApp = has && +v > 0 && app === 0;
      if ((!z.pflicht || (z.key === 'dStd' && app === 0)) && !alle && app === 0 && !eingetragenOhneApp) return; // Zeile nur zeigen, wenn sie vorkommt
      if (z.nurAlle && !alle && !(has && +v > 0)) return; // Euro-Zeile nur auf Wunsch oder wenn eingetragen
      if (!has) { rows.push({ key: z.key, label: eigenSo ? 'Sonderurlaub' : z.label, unit: z.unit, app: app, lz: null, diff: null, status: 'offen', faktor: z.faktor }); return; }
      var lzWert = +v + (z.key === 'ueber' ? za : 0) + (z.key === 'lohn' ? so : 0); // Überstunden + Zeitausgleich-Konto, Lohn + Sonderurlaub
      var diff = r2(lzWert - app), a = Math.abs(diff);
      rows.push({ key: z.key, label: eigenSo ? 'Sonderurlaub' : z.label, unit: z.unit, app: app, lz: +v, lzGesamt: lzWert, diff: diff, faktor: z.faktor, rate: z.key === 'zuschlag' ? (summe.zuTagStd > 0 ? summe.zuEqStd / summe.zuTagStd : 1) : z.key === 'ueberHoch' ? (summe.hochPct || 100) / 100 : undefined,
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
      else if (f === 'zu') eur = -r.diff * lohn * (r.rate != null ? r.rate : 1);
      else if (f === 'hoch') eur = -r.diff * lohnUeber * Math.max(0, (r.rate != null ? r.rate : 1) - zus / 100); // nur der Unterschied zwischen dem höheren und dem normalen Überstundenzuschlag
      else eur = -r.diff * (f === 'ueber' ? lohnUeber : lohn) * (f === 'ueber' ? 1 + zus / 100 : f === 'mehr' ? 1 + (w && w.ueberstunden && w.ueberstunden.mehrPct != null ? +w.ueberstunden.mehrPct : 25) / 100 : f);
      if (eur === null) return;
      eur = Math.round(eur * 100) / 100; out.zeilen[r.key] = eur; out.summe = Math.round((out.summe + eur) * 100) / 100;
    });
    return out;
  }

  // Voraussichtliches Brutto eines Monats (Schätzung): Lohn, Überstunden, Mehrarbeit, Prämien und Dienste. Diäten werden getrennt ausgewiesen.
  // Nicht enthalten: Sonderzahlungen, Nachzahlungen, Schlechtwetter-Entschädigung und alle Abzüge (Netto hängt von vielen persönlichen Faktoren ab).
  // laufend = Monat läuft noch: Überstunden entstehen erst am Monatsende und werden dann nicht mitgezählt.
  function bruttoVorschau(summe, w, laufend) {
    if (!summe || summe.gleit) return { ok: false, grund: 'gleit' };
    var fix = w && +w.monatslohn > 0 ? +w.monatslohn : null, lohn = w && w.stundenlohn != null && !isNaN(+w.stundenlohn) && +w.stundenlohn > 0 ? +w.stundenlohn : null;
    if (fix === null && lohn === null) return { ok: false, grund: 'lohn' };
    var zus = w.ueberstunden && w.ueberstunden.zuschlagPct != null ? +w.ueberstunden.zuschlagPct : 50, teile = [];
    var lohnUeber = lohn;
    if (w.ueberstunden && +w.ueberstunden.ueberTeiler > 0 && +w.monatslohn > 0) {
      var wo = wochenStd(w.ueberstunden), vz = +w.ueberstunden.vollzeitStd > wo ? +w.ueberstunden.vollzeitStd : wo;
      lohnUeber = Math.round(+w.monatslohn / (+w.ueberstunden.ueberTeiler * (wo > 0 ? wo / vz : 1)) * 10000) / 10000;
    }
    if (fix !== null) teile.push({ key: 'lohn', euro: r2(fix) });
    else teile.push({ key: 'lohn', euro: r2(((summe.normalStd || 0) + (summe.feiertagStd || 0) + (summe.urlaubStd || 0) + (summe.krankStd || 0) + (summe.pflegeStd || 0) + (summe.sonderStd || 0)) * lohn) });
    if (!laufend && lohnUeber) {
      var u = Math.max(0, (summe.ueberStd || 0) - (summe.mehrStd || 0) - (summe.mehrFreiStd || 0));
      var hoch = Math.min(u, summe.ueberHochStd || 0);
      if (u > 0) teile.push({ key: 'ueber', euro: r2((u - hoch) * lohnUeber * (1 + zus / 100) + hoch * lohnUeber) }); // Überstunden am Sonn- oder Feiertag: Grundlohn hier, der höhere Zuschlag steht in der Zuschlagszeile
      if ((summe.mehrStd || 0) > 0 && (lohn || lohnUeber)) teile.push({ key: 'mehr', euro: r2(summe.mehrStd * (lohn || lohnUeber) * (1 + (w.ueberstunden.mehrPct != null ? +w.ueberstunden.mehrPct : 25) / 100)) });
    }
    var lz1 = lohn || lohnUeber;
    if ((summe.ftArbeitStd || 0) > 0 && lz1) teile.push({ key: 'ftarbeit', euro: r2(summe.ftArbeitStd * lz1) });
    if ((summe.zuEqStd || 0) > 0 && lz1) teile.push({ key: 'zuschlag', euro: r2(summe.zuEqStd * lz1) });
    if (summe.praemienEuro > 0) teile.push({ key: 'praemien', euro: r2(summe.praemienEuro) });
    var dEuro = 0; (summe.dienste || []).forEach(function (x) { dEuro += +x.euro || 0; });
    if (dEuro > 0) teile.push({ key: 'dienste', euro: r2(dEuro) });
    var brutto = 0; teile.forEach(function (t) { brutto += t.euro; });
    return { ok: true, brutto: r2(brutto), teile: teile, diaeten: r2(summe.diaetenBetrag || 0), fix: fix !== null, laufend: !!laufend };
  }

  return {
    abgleich: abgleich, abgleichEuro: abgleichEuro, bruttoVorschau: bruttoVorschau, tagesZeilen: tagesZeilen, lzMitKorr: lzMitKorr, aufrollSumme: aufrollSumme, sonderAnteil: sonderAnteil, sonderSoll: sonderSoll, korrEuroZeile: korrEuroZeile, urlaubKartei: urlaubKartei, PAKETE: PAKETE, STATUS: STATUS, BUAK_KONTINGENT: BUAK_KONTINGENT,
    iso: iso, parseISO: parseISO, weekday: weekday, addDays: addDays, daysInMonth: daysInMonth, toMin: toMin,
    LAENDER_AT: LAENDER_AT, kvLand: kvLand, rundZeit: rundZeit, easter: easter, setRegion: setRegion, BUNDESLAENDER: BUNDESLAENDER, feiertage: feiertage, feiertagName: feiertagName, dayTyp: dayTyp,
    neuerWertesatz: neuerWertesatz, lgAnstehend: lgAnstehend, lgFuer: lgFuer, kvWert: function (w, dateStr, keys) { return wRef(w, { kvRef: keys || true }, dateStr); }, kvLohn: kvLohn, unterKv: unterKv, KV_REGELN: KV_REGELN, praemienDay: praemienDay, freiModus: freiModus, zaUeber: zaUeber, BERUFE: BERUFE, berufName: berufName, LOHNGRUPPEN: LOHNGRUPPEN, istTour: istTour, istBau: istBau, bausteine: bausteine, wertAt: wertAt, dayMinutes: dayMinutes, kundenZeiten: kundenZeiten, praemienDay: praemienDay, calcDay: calcDay,
    parseSchnell: parseSchnell, wochenStd: wochenStd, tagesSoll: tagesSoll, sollTage: sollTage, istSollTag: istSollTag, calcMonth: calcMonth, sollFuer: sollFuer, swVerbraucht: swVerbraucht, buakStart: buakStart, h2: h2, r2: r2, clone: clone
  };
});
