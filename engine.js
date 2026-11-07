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
      hinweis: 'KV Baugewerbe und Bauindustrie, Arbeiter, ab 1.5.2026: 39-Stunden-Woche (die 40. Stunde ist Mehrarbeit), Überstunde ab mehr als 9 Stunden pro Tag, Zuschlag 50 % (nachts 100 %), Sonntag 100 %, Taggeld pro Tag mit Stufen, Schlechtwetter über die BUAK. Verteilung der Normalarbeitszeit (kurze/lange Woche) ist noch nicht abgebildet. Lehrlinge: Stufen VI a bis VI e der Lohntafel (Hochbau, Tiefbau, Beton); Zimmerer haben einen eigenen Kollektivvertrag (Holzbau).',
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
    holzbau: {
      name: 'Holzbau (Zimmerer, Dachstuhl)',
      hinweis: 'KV Holzbau-Meistergewerbe (Zimmerer), Arbeiter, ab 1.5.2026 (Quelle: wko.at): 39 Stunden/Woche, mit Zeitausgleich in ganzen Tagen auf 40 Stunden ausdehnbar oder bis 45 Stunden in 26 von 52 Wochen (höchstens 156 Zeitguthaben-Stunden). Überstunde ist jede Stunde über 9 Stunden pro Tag oder über der ersten Mehrarbeitsstunde pro Woche. Zuschläge: Überstunden von 5 bis 20 Uhr und Mehrarbeit 50 %, Überstunden von 20 bis 5 Uhr 100 %, Normalstunden von 20 bis 5 Uhr 50 %, Sonntag 100 %, Feiertag 50 % (100 % an einem sonst freien Tag), über 16 Stunden am Stück 150 %; bei mehreren Zuschlägen zählt nur der höchste. Taggeld 12,10 € je Arbeitstag (mehr als 3 Stunden, tägliche Heimkehr), 30 € bei notwendiger Übernachtung (ab 100 km), Übernachtungsgeld 17,53 € ohne Quartier vom Betrieb. Zulagen: Aufsicht 10 %, Schmutz 10 %, Abbruch 15 %, angeseilt 10 %, Gebirge 12 % oder 20 % (höchstens zwei Zulagen gleichzeitig). Lehrlingsentschädigung je Stunde als Lohngruppe hinterlegt. Schlechtwetter über die BUAK.',
      pruefen: true,
      werte: {
        diaeten: { modell: 'tag', satz: 0, maxStd: null, minStd: 0, vorschlag: 'anwesenheit', stufen: [{ ab: 3, satz: 12.10 }] },
        ueberstunden: { modell: 'bau', wochenStd: 39, tagesGrenze: 9, zuschlagPct: 50 },
        stundenlohn: null,
        betriebFrei: 'urlaub',
        zuschlag: { sa: 0, so: 100, ft: 50 },
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
        zuschlag: { sa: 0, so: 100, ft: 0 },
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
        zuschlag: { sa: 0, so: 100, ft: 0 },
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
        zuschlag: { sa: 0, so: 100, ft: 0 },
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
        zuschlag: { sa: 0, so: 100, ft: 0 },
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
        zuschlag: { sa: 0, so: 100, ft: 100 },
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
        zuschlag: { sa: 0, so: 100, ft: 0 },
        schlechtwetter: false
      }
    },
    gastro: {
      name: 'Hotel- und Gastgewerbe',
      hinweis: 'KV Hotel- und Gastgewerbe, Arbeiter (Quellen: wko.at, WKO Niederösterreich): 40 Stunden/Woche, Überstunden 50 %, Normalstunde = 1/173 des Monatslohns. Die Löhne sind je Bundesland verschieden. Hinterlegt sind die Lohngruppen 1 bis 5 für Niederösterreich (Tabelle vom 1.5.2025 plus Erhöhung ab 1.10.2026 laut Abschluss, nach Dienstjahren) und die Lehrlingseinkommen ab 1.10.2026. In anderen Bundesländern trage deinen Lohn laut Lohnzettel ein. Ein Wert der Quelle (Lohngruppe 1, ab 11. Dienstjahr) war offensichtlich verrutscht und wurde nach dem Stufenabstand ergänzt: bitte laut Lohnzettel prüfen. Nachtarbeit (0 bis 6 Uhr) hat einen pauschalen Zuschlag, gestaffelt in Dritteln je begonnene 2 Stunden; die Höhe steht im Lohnabkommen, die App kennt sie nicht, trage sie als Prämie ein. Sonn- und Feiertage hängen vom Betrieb ab, stelle sie bei Bedarf selbst ein.',
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
    reinigung: {
      name: 'Gebäudereinigung (Denkmal-, Fassaden- und Gebäudereinigung)',
      hinweis: 'KV Denkmal-, Fassaden- und Gebäudereinigung, Arbeiter, ab 1.1.2026 (Quelle: wko.at): 40 Stunden/Woche ohne Pausen, Überstunden 50 % (Montag bis Samstag 6 bis 21 Uhr), in der Nacht (21 bis 6 Uhr) 100 %, Sonntag 150 %, am Feiertag 100 %. Normalstunden in der Nacht 50 %, am Sonntag 100 %, am Feiertag ohne Zuschlag. Mehrarbeit bei Teilzeit 25 %. Wegzeiten im Dienst zählen als Arbeitszeit. Zehrgeld 11,71 € je Tag (außerhalb der Gemeinde, mindestens 6 Stunden), Trennungszulage 19,67 €, gefährliche Arbeiten 10 %: lege sie bei Bedarf als Prämie an. Lehrlingseinkommen 2026 als Lohngruppe hinterlegt. In der Hotelreinigung (Lohngruppe 3) gelten am Sonntag andere Zuschläge, bitte laut Lohnzettel prüfen.',
      pruefen: true,
      werte: {
        diaeten: { modell: 'aus', satz: 0, maxStd: null, minStd: 0, vorschlag: 'anwesenheit', stufen: [] },
        ueberstunden: { modell: 'monat', wochenStd: 40, tagesGrenze: null, zuschlagPct: 50 },
        stundenlohn: null,
        betriebFrei: 'urlaub',
        zuschlag: { sa: 0, so: 100, ft: 0 },
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
        zuschlag: { sa: 0, so: 0, ft: 0 },
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
        zuschlag: { sa: 0, so: 50, ft: 50 },
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
    name: 'Deutschland: Spedition und Logistik, Berlin (Kraftfahrer)', land: 'DE', pruefen: true,
    hinweis: 'Tarif Spedition und Logistik Berlin, gewerbliche Arbeitnehmer (Quelle: Tarifbroschüre des Landes Berlin, Entgelt ab 1.2.2026, mindestens bis 31.12.2026): 38 Stunden/Woche (Brandenburg 39). Monatsentgelt je Gruppe und Dauer, für Zuschläge gilt Monatsentgelt ÷ 165. Überstunden 25 % (von 22 bis 6 Uhr 60 %), Nachtarbeit außerhalb von Schichtarbeit 50 %, Sonntag 70 %, Feiertag 120 %, 24. und 31.12. ab 12 Uhr 70 %; beim Zusammentreffen zählt nur der höchste Zuschlag. Wichtig: Dieser Tarif gilt nicht für Fahrer im Güterfernverkehr, dafür gibt es eigene Verträge (in Brandenburg zuletzt 12,65 € Berufskraftfahrer und 12,30 € Kraftfahrer je Stunde, Stand 10.2022, vermutlich überholt): trage dann deinen Lohn selbst ein. Verpflegung: 14 € bei mehr als 8 Stunden, 28 € bei 24 Stunden unterwegs, dazu 9 € je Nacht im Lkw (selbst eintragen). Gilt nur, wenn dein Betrieb tarifgebunden ist. Bitte vergleiche alles mit deiner Abrechnung.',
    werte: deWerte({ diaeten: DE_VERPFL, ueberstunden: { modell: 'monat', wochenStd: 38, tagesGrenze: null, zuschlagPct: 25 }, zuschlag: { sa: 0, so: 70, ft: 120 } })
  };
  // Tarifregister Nordrhein-Westfalen (Speditions-, Logistik- und Transportwirtschaft): Lohntarif ab 1.10.2026, Manteltarif Stand 29.4.2024
  var NRW_VERPFL = { modell: 'tag', satz: 0, maxStd: null, minStd: 0, vorschlag: 'anwesenheit', stufen: [{ ab: 8, satz: 12 }, { ab: 23.99, satz: 24 }] };
  PAKETE.de_spedition_nrw = {
    name: 'Deutschland: Spedition und Logistik, Nordrhein-Westfalen (Kraftfahrer)', land: 'DE', pruefen: true,
    hinweis: 'Tarif Speditions-, Logistik- und Transportwirtschaft Nordrhein-Westfalen (Quelle: Tarifregister NRW, Lohntarif ab 1.10.2026, kündbar zum 28.2.2027): Kraftfahrer 40 Stunden/Woche (39 bei Fahrten unter 100 km Luftlinie vom Standort). Mehrarbeit 25 % für jede Stunde über 40 pro Woche. Nachtarbeit (22 bis 6 Uhr) 25 %; Fernfahrer (über 100 km) bekommen stattdessen 5 € je Nachtschicht mit mehr als 2 Stunden Arbeit. Sonntag 75 % (ab 1.1.2026), Feiertag 100 % (ab 1.1.2027 125 %), beim Zusammentreffen zählt nur der höhere Zuschlag, Nacht kommt dazu. Warte- und Anwesenheitszeiten zählen 100 %, Kabinen- und Beifahrerzeit 70 %. Verpflegung laut Tarif 12 € bei mehr als 8 Stunden, 24 € bei 24 Stunden Abwesenheit. Weihnachtsgeld ein Monatsverdienst, Urlaubsgeld und Zulagen je Betrieb: lege sie als Prämie an. Die Nachtzuschläge sind nicht hinterlegt: lege sie als Prämie an. Von den Stundenlöhnen sind die unterste und die oberste Stufe hinterlegt: trage bei Zwischenstufen deinen Lohn laut Lohnzettel ein. Gilt nur, wenn dein Betrieb tarifgebunden ist. Bitte vergleiche alles mit deiner Abrechnung.',
    werte: deWerte({ diaeten: NRW_VERPFL, ueberstunden: { modell: 'monat', wochenStd: 40, tagesGrenze: null, zuschlagPct: 25 }, zuschlag: { sa: 0, so: 75, ft: 100 } })
  };

  // Bayern: ver.di Bayern und Landesverein Bayerischer Spediteure, Lohntarif ab 1.1.2026 (läuft bis 30.11.2026). Zuschläge des Manteltarifs nicht belegt: Überstunden 25 % und 40 Stunden nur angenommen.
  PAKETE.de_spedition_by = {
    name: 'Deutschland: Spedition und Logistik, Bayern (Kraftfahrer)', land: 'DE', pruefen: true,
    hinweis: 'Tarif Speditions- und Logistikgewerbe Bayern, gewerbliche Arbeitnehmer (Quellen: ver.di Bayern, Landesverein Bayerischer Spediteure): Stundenlöhne ab 1.1.2026 (plus 3,5 %). Der Lohntarif läuft bis 30.11.2026, danach wird neu verhandelt (ver.di fordert 230 € mehr ab 1.12.2026): Nach einem Abschluss musst du den Lohn selbst anpassen. Dazu gibt es eine Betriebszugehörigkeitszulage von 80, 100 oder 110 € im Monat, je nach Dauer im Betrieb: lege sie als Prämie an. Die Zuschläge laut Manteltarif konnte ich nicht belegen: Überstunden 25 % und 40 Stunden/Woche sind nur angenommen, Nacht-, Sonn- und Feiertagszuschläge stehen bei 0: trage sie nach deinem Arbeitsvertrag oder Lohnzettel ein. Verpflegung: 14 € bei mehr als 8 Stunden, 28 € bei 24 Stunden unterwegs, dazu 9 € je Nacht im Lkw (selbst eintragen). Gilt nur, wenn dein Betrieb tarifgebunden ist. Für Fahrer im Fernverkehr gibt es oft eigene Regeln. Bitte vergleiche alles mit deiner Abrechnung.',
    werte: deWerte({ diaeten: DE_VERPFL, ueberstunden: { modell: 'monat', wochenStd: 40, tagesGrenze: null, zuschlagPct: 25 }, zuschlag: { sa: 0, so: 0, ft: 0 } })
  };
  // Sachsen: ZEFAS Sachsen, Lohntarif Verkehrsgewerbe Logistikunternehmen (gültig ab 1.10.2025). Zuschläge nicht im Auszug.
  PAKETE.de_logistik_sn = {
    name: 'Deutschland: Logistikunternehmen, Sachsen (Kraftfahrer)', land: 'DE', pruefen: true,
    hinweis: 'Lohntarif für das Verkehrsgewerbe Sachsen, Bereich Logistikunternehmen (Quelle: Tarifdaten der ZEFAS Sachsen, Stand Dezember 2025): Stundenlöhne ab 1.11.2026. Am 1.7.2027 steigen sie um knapp 3 %, dann musst du den Lohn selbst anpassen. Der Auszug nennt nur die Entgeltgruppen 2 und 3: in Gruppe 2 fahren Kraftfahrer im Shuttle- oder Nahverkehr, in Gruppe 3 Kraftfahrer mit höheren Anforderungen (Fernverkehr, ADR) und Berufskraftfahrer. Regelarbeitszeit sind 173 Stunden im Monat, ich rechne mit 40 Stunden pro Woche. Zuschläge (Überstunden, Nacht, Sonn- und Feiertag) stehen nicht im Auszug und sind auf 0: trage sie nach deinem Arbeitsvertrag oder Lohnzettel ein. Lehrlinge bekommen 37, 42 und 47 % des Ecklohns, die Beträge habe ich daraus berechnet. Verpflegung: 14 € bei mehr als 8 Stunden, 28 € bei 24 Stunden (Steuerrecht, nicht Tarif). Gilt nur, wenn dein Betrieb tarifgebunden ist. Bitte vergleiche alles mit deiner Abrechnung.',
    werte: deWerte({ diaeten: DE_VERPFL, ueberstunden: { modell: 'monat', wochenStd: 40, tagesGrenze: null, zuschlagPct: 25 }, zuschlag: { sa: 0, so: 0, ft: 0 } })
  };
  // Andere Bundesländer: kein öffentlicher Lohntarif gefunden, Lohn selbst eintragen.
  PAKETE.de_spedition_sonst = {
    name: 'Deutschland: Spedition und Logistik, anderes Bundesland (Lohn selbst eintragen)', land: 'DE', pruefen: true,
    hinweis: 'Für dein Bundesland habe ich keinen öffentlich nachlesbaren Lohntarif gefunden, die Tabellen gibt es oft nur für Mitglieder der Verbände. Trage deinen Stundenlohn und die Zuschläge aus Arbeitsvertrag oder Lohnzettel selbst ein. Bekannte Erhöhungen laut ver.di: Baden-Württemberg (Württemberg und Nordbaden): plus 2,5 % ab 1.5.2026, mindestens 100 € im Monat, und plus 2 % ab 1.5.2027. Thüringen: plus 3,7 % ab 1.1.2026, plus 3,4 % ab 1.10.2026, plus 2,9 % ab 1.6.2027. Sachsen-Anhalt: plus 3,7 % ab Dezember 2025, plus 3,4 % ab September 2026, plus 2,9 % ab Juni 2027. Schleswig-Holstein: zweimal plus 3,5 %. Niedersachsen: Abschluss im Oktober 2025, Zahlen nur für Mitglieder. Für Bayern, Sachsen, Berlin und Nordrhein-Westfalen gibt es eigene Tarife in der Liste. Verpflegung: 14 € bei mehr als 8 Stunden, 28 € bei 24 Stunden (Steuerrecht). 40 Stunden pro Woche und 25 % Überstundenzuschlag sind nur angenommen. Bitte vergleiche alles mit deiner Abrechnung.',
    werte: deWerte({ diaeten: DE_VERPFL, ueberstunden: { modell: 'monat', wochenStd: 40, tagesGrenze: null, zuschlagPct: 25 }, zuschlag: { sa: 0, so: 0, ft: 0 } })
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
  // Zeitausgleich-Konto: Wie viele Überstunden stecken in einem Zuwachs? Bei 1:1,5 (Zuschlag im Zeitausgleich enthalten) sind es 2/3 davon. Abzüge (Freinehmen) zählen immer Stunde für Stunde.
  function zaUeber(za, umr) { za = +za || 0; return (za > 0 && umr === 'eingerechnet') ? r2(za / 1.5) : za; }
  function freiModus(day, w) { var m = (day && day.fv) || (w && w.freiVerr) || 'offen'; return ['bezahlt', 'za', 'unbezahlt', 'offen'].indexOf(m) >= 0 ? m : 'offen'; }
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
    handel: { stand: 'ab 1.1.2026', stufen: STUFEN_HANDEL, gruppen: [
      { id: 'A', name: 'Beschäftigungsgruppe A (Angestellte, Gehalt ÷ 158)', l: [13.23, 13.56, 13.88, null, null] },
      { id: 'B', name: 'Beschäftigungsgruppe B (Angestellte, Gehalt ÷ 158)', l: [13.65, 14.06, 14.46, null, null] },
      { id: 'C', name: 'Beschäftigungsgruppe C (Angestellte, Gehalt ÷ 158)', l: [14.25, 14.77, 15.52, 16.23, 17.01] },
      { id: 'D', name: 'Beschäftigungsgruppe D (Angestellte, Gehalt ÷ 158)', l: [14.95, 15.88, 16.94, 17.99, 19.06] },
      { id: 'E', name: 'Beschäftigungsgruppe E (Angestellte, Gehalt ÷ 158)', l: [16.04, 17.47, 18.90, 20.34, 21.75] },
      { id: 'F', name: 'Beschäftigungsgruppe F (Angestellte, Gehalt ÷ 158)', l: [18.22, 20.38, 22.53, 24.70, 26.86] },
      { id: 'G', name: 'Beschäftigungsgruppe G (Angestellte, Gehalt ÷ 158)', l: [22.53, 24.91, 27.30, 29.68, 32.06] },
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
    ] },
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
      { id: 'G1', m: true, name: 'Lohngruppe 1', l: [2724.00, 2790.30, 2856.60, 2922.90, 2989.20] },
      { id: 'G2', m: true, name: 'Lohngruppe 2', l: [2500.00, 2560.90, 2621.80, 2682.60, 2743.50] },
      { id: 'G3', m: true, name: 'Lohngruppe 3', l: [2304.00, 2359.90, 2415.90, 2471.80, 2527.70] },
      { id: 'G4', m: true, name: 'Lohngruppe 4', l: [2153.00, 2205.20, 2257.40, 2309.60, 2361.80] },
      { id: 'G5', m: true, name: 'Lohngruppe 5', l: [2096.50, 2147.20, 2147.20, 2147.20, 2147.20] },
      { id: 'L1', m: true, lehrling: true, name: 'Lehrling, 1. Lehrjahr', l: [1090] },
      { id: 'L2', m: true, lehrling: true, name: 'Lehrling, 2. Lehrjahr', l: [1220] },
      { id: 'L3', m: true, lehrling: true, name: 'Lehrling, 3. Lehrjahr', l: [1445] },
      { id: 'L4', m: true, lehrling: true, name: 'Lehrling, 4. Lehrjahr (nur Doppellehre)', l: [1550] }
    ] }
  };

  /* ---------------------------------------------------------------- Berufe und Bausteine */
  // b = Voreinstellung, welche Bausteine der Beruf braucht (fahrzeug, kunden, praemien), diaeten = ob Diäten üblich sind.
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
    handwerk: { name: 'Bau und Handwerk', paket: 'bau', kvs: ['bau', 'holzbau', 'dachdecker', 'pflasterer', 'fliesenleger', 'tischler', 'maler', 'metall', 'de_bau', 'de_metall', 'eigen'], diaeten: true, sw: true, b: { fahrzeug: false, kunden: true, praemien: true },
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
    aussendienst: { name: 'Außendienst / Vertrieb', paket: 'buero', kvs: ['gueter_ang', 'gleit_buero', 'buero', 'handel', 'gewerbe_ang', 'industrie_ang', 'bau_ang', 'it_ang', 'banken_ang', 'versicherung_ang', 'de_buero', 'de_handel', 'eigen'], diaeten: true, sw: false, b: { fahrzeug: true, kunden: true, praemien: true } },
    lager: { name: 'Lager / Stapler / Hilfsarbeiter', paket: 'gueter', kvs: ['gueter', 'klein', 'handel', 'de_spedition_nrw', 'de_spedition_by', 'de_logistik_sn', 'de_spedition', 'de_spedition_sonst', 'eigen'], einfach: true, diaeten: false, sw: false, b: { fahrzeug: false, kunden: false, praemien: false },
      arten: {
        lager: { name: 'Lager / Stapler / Hilfsarbeiter', b: { fahrzeug: false, kunden: false, praemien: false } },
        lehrling: { name: 'Lehrling (Lagerlogistik)', b: { fahrzeug: false, kunden: false, praemien: false } }
      } },
    mechaniker: { name: 'Mechaniker / Werkstatt', paket: 'metall', kvs: ['metall', 'gueter', 'de_metall', 'eigen'], einfach: true, diaeten: false, sw: false, b: { fahrzeug: false, kunden: false, praemien: false },
      arten: {
        kfz: { name: 'Kfz-Mechaniker / Werkstatt', b: { fahrzeug: false, kunden: false, praemien: false } },
        schlosser: { name: 'Schlosser / Schweißer', b: { fahrzeug: false, kunden: false, praemien: false } },
        spengler: { name: 'Spengler / Karosseriebauer', b: { fahrzeug: false, kunden: false, praemien: false } },
        lackierer: { name: 'Lackierer', b: { fahrzeug: false, kunden: false, praemien: false } },
        leiter: { name: 'Werkstattleiter / Meister', b: { fahrzeug: false, kunden: false, praemien: false } },
        lehrling: { name: 'Lehrling', b: { fahrzeug: false, kunden: false, praemien: false } }
      } },
    bund: { name: 'Bundesdienst / Ministerium', verborgen: true, paket: 'bund', kvs: ['bund', 'gleit_buero', 'buero', 'eigen'], einfach: true, diaeten: false, sw: false, b: { fahrzeug: false, kunden: false, praemien: false } },
    buero: { name: 'Büro (Angestellte)', paket: 'buero', kvs: ['gueter_ang', 'gleit_buero', 'buero', 'handel', 'gewerbe_ang', 'industrie_ang', 'bau_ang', 'it_ang', 'banken_ang', 'versicherung_ang', 'de_buero', 'de_handel', 'eigen'], einfach: true, diaeten: false, sw: false, b: { fahrzeug: false, kunden: false, praemien: false } ,
      arten: {
        buero: { name: 'Büro / Verwaltung / Disposition', b: { fahrzeug: false, kunden: false, praemien: false } },
        lehrling: { name: 'Lehrling (Bürokaufmann/-frau, Verwaltung)', b: { fahrzeug: false, kunden: false, praemien: false } }
      } },
    handel: { name: 'Handel / Verkauf', paket: 'handel', kvs: ['handel', 'de_handel', 'eigen'], einfach: true, diaeten: false, sw: false, b: { fahrzeug: false, kunden: false, praemien: true },
      arten: {
        verkauf: { name: 'Verkauf / Kassa', b: { fahrzeug: false, kunden: false, praemien: true } },
        lehrling: { name: 'Lehrling (Einzelhandel)', b: { fahrzeug: false, kunden: false, praemien: true } },
        theke: { name: 'Feinkost / Bedientheke / Bäckerei', b: { fahrzeug: false, kunden: false, praemien: true } },
        lager: { name: 'Lager / Warenübernahme', b: { fahrzeug: false, kunden: false, praemien: true } },
        leitung: { name: 'Filialleitung / Stellvertretung', b: { fahrzeug: false, kunden: false, praemien: true } }
      } },
    gastro: { name: 'Gastronomie / Hotel', paket: 'gastro', kvs: ['gastro', 'de_gastro', 'eigen'], einfach: true, diaeten: false, sw: false, b: { fahrzeug: false, kunden: false, praemien: false },
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
    pflege: { name: 'Pflege / Betreuung / Soziales', paket: 'sozial', kvs: ['sozial', 'eigen'], einfach: true, diaeten: false, sw: false, b: { fahrzeug: false, kunden: false, praemien: true },
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
    res.faktor = 1 + (pct || 0) / 100;
    res.wertMin = m.netto * res.faktor;
    // Zusätzlich bezahlte Stunden am selben Tag (zum Beispiel Sonderurlaub plus Arbeit): werden einfach dazugezählt.
    var ex = +day.extra; if (isNaN(ex) || ex < 0) ex = 0;
    if (status === 'ersatzruhe') ex = 0; // beim Ersatzruhetag ist "extra" schon die Gutschrift des Tages
    if (status !== 'ersatzruhe') res.extraMin = Math.round(ex * 60); res.creditMin = credBase + (status === 'ersatzruhe' ? 0 : res.extraMin);

    // Überstunden-Beitrag des Tages (Modell "tag-saldo": Arbeitsstunden minus Tagessoll, kürzere Tage gleichen aus)
    if (w.ueberstunden.modell === 'tag-saldo' && (res.wertMin > 0 || res.swMin > 0 || res.extraMin > 0)) {
      res.saldoMin = res.wertMin + res.creditMin - Math.max(0, sollMin - res.swMin);
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
      arbeitstage: 0, urlaub: 0, krank: 0, pflege: 0, schule: 0, za: 0, freiTage: 0, freiListe: [], feiertageBezahlt: 0, zuschlagMin: 0,
      feMin: 0, urMin: 0, krMin: 0, pfMin: 0, soMin: 0, sonderTage: 0, feExtraMin: 0 };
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
      if (r.status === 'sonderurlaub') s.sonderTage++;
      if (r.status === 'krank') s.krank++;
      if (r.status === 'pflege') s.pflege++;
      if (r.status === 'schule') s.schule++;
      if (r.status === 'za') s.za++;
      if (r.status === 'freistellung') { s.freiTage++; s.freiListe.push({ datum: ds, modus: r.freiModus, std: h2(r.freiSollMin || 0) }); }
      if (r.status === 'feiertag') { s.feiertageBezahlt++; s.feMin += r.creditMin; }
      if (r.status === 'arbeit' && r.typ === 'feiertag' && r.nettoMin > 0) s.feExtraMin += Math.round(tagesSoll(w.ueberstunden) * 60); // Feiertagslohn gibt es auch, wenn man am Feiertag arbeitet (nur Anzeige, nicht in den Stunden)
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
    var credMin = s.feMin + s.urMin + s.krMin + s.pfMin + s.soMin;
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
        arbeitstage: s.arbeitstage, urlaub: s.urlaub, krank: s.krank, pflege: s.pflege, schule: s.schule, za: s.za, freiTage: s.freiTage, freiListe: s.freiListe, zaUmr: (wertAt(settings, iso(y, m, n)) || {}).zaUmr || 'offen',
        feiertageBezahlt: s.feiertageBezahlt, sollStd: h2(s.sollMin || 0), sollAb: s.sollAb || 1,
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
      rows.push({ key: z.key, label: eigenSo ? 'Sonderurlaub' : z.label, unit: z.unit, app: app, lz: +v, lzGesamt: lzWert, diff: diff, faktor: z.faktor,
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
      if (u > 0) teile.push({ key: 'ueber', euro: r2(u * lohnUeber * (1 + zus / 100)) });
      if ((summe.mehrStd || 0) > 0 && (lohn || lohnUeber)) teile.push({ key: 'mehr', euro: r2(summe.mehrStd * (lohn || lohnUeber) * (1 + (w.ueberstunden.mehrPct != null ? +w.ueberstunden.mehrPct : 25) / 100)) });
    }
    if (summe.praemienEuro > 0) teile.push({ key: 'praemien', euro: r2(summe.praemienEuro) });
    var dEuro = 0; (summe.dienste || []).forEach(function (x) { dEuro += +x.euro || 0; });
    if (dEuro > 0) teile.push({ key: 'dienste', euro: r2(dEuro) });
    var brutto = 0; teile.forEach(function (t) { brutto += t.euro; });
    return { ok: true, brutto: r2(brutto), teile: teile, diaeten: r2(summe.diaetenBetrag || 0), fix: fix !== null, laufend: !!laufend };
  }

  return {
    abgleich: abgleich, abgleichEuro: abgleichEuro, bruttoVorschau: bruttoVorschau, tagesZeilen: tagesZeilen, lzMitKorr: lzMitKorr, aufrollSumme: aufrollSumme, sonderAnteil: sonderAnteil, sonderSoll: sonderSoll, korrEuroZeile: korrEuroZeile, urlaubKartei: urlaubKartei, PAKETE: PAKETE, STATUS: STATUS, BUAK_KONTINGENT: BUAK_KONTINGENT,
    iso: iso, parseISO: parseISO, weekday: weekday, addDays: addDays, daysInMonth: daysInMonth, toMin: toMin,
    rundZeit: rundZeit, easter: easter, setRegion: setRegion, BUNDESLAENDER: BUNDESLAENDER, feiertage: feiertage, feiertagName: feiertagName, dayTyp: dayTyp,
    neuerWertesatz: neuerWertesatz, praemienDay: praemienDay, freiModus: freiModus, zaUeber: zaUeber, BERUFE: BERUFE, berufName: berufName, LOHNGRUPPEN: LOHNGRUPPEN, istTour: istTour, istBau: istBau, bausteine: bausteine, wertAt: wertAt, dayMinutes: dayMinutes, kundenZeiten: kundenZeiten, praemienDay: praemienDay, calcDay: calcDay,
    wochenStd: wochenStd, tagesSoll: tagesSoll, sollTage: sollTage, istSollTag: istSollTag, calcMonth: calcMonth, sollFuer: sollFuer, swVerbraucht: swVerbraucht, buakStart: buakStart, h2: h2, r2: r2, clone: clone
  };
});
