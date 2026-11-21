/* Rückmeldungen und Nutzungs-Kennkarte (nur Zahlen, keine Stunden/Beträge). Läuft nur, wenn in firebase-config.js "insights: true" steht
   und Firebase-Regeln gesetzt sind. Jeder Fehler wird verschluckt: die App darf davon nie gestört werden. */
(function () {
  'use strict';
  var cfg = window.FIREBASE_CONFIG || {};
  var ON = !!cfg.insights && !!window.firebase && !!firebase.firestore && firebase.apps && firebase.apps.length;
  var SK = 'stundenchecker.stats';
  function rd(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function wr(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function stats() { try { return JSON.parse(rd(SK)) || {}; } catch (e) { return {}; } }
  function db() { return window.__insightsTestDb || firebase.firestore(); }
  function stamp() { return window.__insightsTestDb ? Date.now() : firebase.firestore.FieldValue.serverTimestamp(); }
  function now() { return new Date().toISOString(); }
  function user() { try { return firebase.auth().currentUser; } catch (e) { return null; } }
  function app() { return window.StundenApp || {}; }
  function consent() { var a = app(); return (a.profil && a.profil().consent) || {}; }
  function anonId() { var id = rd('stundenchecker.anon'); if (!id) { id = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10); wr('stundenchecker.anon', id); } return id; }

  var api = {
    on: ON,
    // Zähler: nur lokal, geht mit der Kennkarte mit
    count: function (name) { try { var s = stats(); s[name] = (s[name] || 0) + 1; wr(SK, JSON.stringify(s)); } catch (e) {} },
    push: function (force) {
      if (!ON) return; try { if (localStorage.getItem('stundenchecker.probe.active') === '1') return; } catch (e) {} // Ausprobier-Modus darf das Profil nicht überschreiben
      var u = user(); if (!u) return;
      var last = +rd('stundenchecker.profpush') || 0, gnow = ((app().info && app().info()) || {}).geraet || '', gold = rd('stundenchecker.profdev') || ''; if (!force && gnow === gold && Date.now() - last < 6 * 3600 * 1000) return;
      try {
        var a = app(), info = a.info ? a.info() : {};
        var doc = {
          uid: u.uid, email: u.email || null, created: u.metadata && u.metadata.creationTime || null, lastLogin: u.metadata && u.metadata.lastSignInTime || null,
          lastSeen: stamp(), lang: info.lang || null, version: window.APP_VERSION || null, beruf: info.beruf || null, paket: info.paket || null, land: info.land || null,
          tage: info.tage || 0, geraet: info.geraet || null, mia: info.mia || null, features: stats(), consent: consent()
        };
        db().collection('profiles').doc(u.uid).set(doc, { merge: true }).then(function () { wr('stundenchecker.profpush', String(Date.now())); wr('stundenchecker.profdev', info.geraet || ''); }, function () {});
      } catch (e) {}
    },
    // Hinweis nur an den Admin (ntfy.sh, kostenlos). Enthält nie Texte, Beträge oder Namen von Nutzern.
    admin: function (text) {
      try { if (!ON) return; fetch('https://ntfy.sh/stundenchecker-admin-72ab2bfe2a9e265a', { method: 'POST', mode: 'no-cors', body: String(text).slice(0, 120), headers: { 'Title': 'Stunden-Checker' } }).catch(function () {}); } catch (e) {}
    },
    // Feedback mit Text und optional Bild (schon verkleinert)
    feedback: function (art, text, img, seite) {
      return new Promise(function (res, rej) {
        if (!ON) { rej(new Error('off')); return; }
        try {
          var u = user(), a = app(), info = a.info ? a.info() : {};
          db().collection('feedback').add({ uid: u ? u.uid : null, email: u ? u.email : null, art: art, text: String(text).slice(0, 4000), img: img || null, seite: seite ? String(seite).slice(0, 1800) : null, view: info.view || null, geraet: info.geraet || null, lang: info.lang || null, version: window.APP_VERSION || null, t: stamp(), neu: true }).then(function (x) { api.admin('Neues Feedback: ' + art); res(x); }, rej);
        } catch (e) { rej(e); }
      });
    },
    // Eigene Rückmeldungen, die du als erledigt markiert hast (nur Nummern), damit Mia Danke sagen kann
    erledigt: function () {
      return new Promise(function (res) {
        try {
          var u = user(); if (!ON || !u) { res(null); return; }
          db().collection('feedback').where('uid', '==', u.uid).limit(30).get().then(function (sn) {
            var o = []; sn.forEach(function (d) { var x = d.data() || {}; if (x.status === 'erledigt') o.push(d.id); }); res(o);
          }, function () { res(null); });
        } catch (e) { res(null); }
      });
    },
    // Mia: Frage ohne Antwort. Wortlaut nur mit Einwilligung.
    miaOffen: function (text, lang) {
      api.count('mia_offen');
      if (!ON || !consent().miaFragen) return;
      try { db().collection('miaOffen').add({ text: String(text).slice(0, 300), lang: lang || null, t: stamp(), anon: anonId() }).catch(function () {}); } catch (e) {}
    },
    // Namen selbst angelegter Prämien (ohne Beträge), nur mit Einwilligung; je Gerät ein Dokument, wird überschrieben
    praemien: function (liste) {
      if (!ON || !consent().praemien || !liste || !liste.length) return;
      try { if (localStorage.getItem('stundenchecker.probe.active') === '1') return; } catch (e) {}
      try {
        var info = (app().info && app().info()) || {}, sig = JSON.stringify(liste) + (info.beruf || ''), k = 'stundenchecker.praemsig';
        if (rd(k) === sig) return; wr(k, sig);
        db().collection('statistik').doc(anonId() + '_praemien').set({ monat: 'praemien', beruf: info.beruf || null, paket: info.paket || null, land: info.land || null, praemien: liste, t: stamp() }).catch(function () {});
      } catch (e) {}
    },
    // Lernen aus dem Lohnzettel, nur mit Einwilligung „Lohnzettel“: Lohnprogramm, Bezeichnungen und Zeilennamen ohne Zahlen,
    // was erkannt wurde und was der Nutzer gewählt hat. Firmenname nur mit eigener Einwilligung „Firma“. Nie Namen, Beträge, Adresse.
    // Liegt in „statistik“ (monat = 'lz'), damit die bestehenden Datenbank-Regeln reichen. Je Gerät und Lohnzettel-Art ein Dokument.
    lernen: function (p) {
      var co = consent(); if (!ON || !co.lohnzettel || !p) return;
      try { if (localStorage.getItem('stundenchecker.probe.active') === '1') return; } catch (e) {}
      try {
        var info = (app().info && app().info()) || {}, z = [], txt = function (v, n) { return String(v == null ? '' : v).replace(/\d{1,3}(?:\.\d{3})*,\d\d/g, '').replace(/\s+/g, ' ').trim().slice(0, n || 60); };
        if (p.programm) z.push({ a: 'programm', w: txt(p.programm, 30) });
        if (p.kv) z.push({ a: 'kv', w: txt(p.kv, 80), p: p.kvPaket || null });
        if (p.als) z.push({ a: 'als', w: txt(p.als, 40), b: p.berufErkannt || null });
        if (p.einst) z.push({ a: 'einst', w: txt(p.einst, 60) });
        if (p.firma && co.firma) z.push({ a: 'firma', w: txt(p.firma, 60) });
        if (p.gewaehlt) z.push({ a: 'gewaehlt', w: txt(p.gewaehlt, 80) });
        (p.zeilen || []).slice(0, 150).forEach(function (r) { var w = txt(r.l, 48); if (w) z.push({ a: 'zeile', w: w, k: r.k || null }); });
        if (!z.length) return;
        var sig = JSON.stringify(z), h = 0; for (var i = 0; i < sig.length; i++) h = (h * 31 + sig.charCodeAt(i)) | 0;
        var k = 'stundenchecker.lzsig.' + (h >>> 0).toString(36); if (rd(k)) return; wr(k, '1');
        var form = (p.programm || '') + '|' + (p.kv || '') + '|' + (p.zeilen || []).map(function (r) { return r.l; }).join('|'), hf = 0; for (var j = 0; j < form.length; j++) hf = (hf * 31 + form.charCodeAt(j)) | 0;
        db().collection('statistik').doc(anonId() + '_lz_' + (hf >>> 0).toString(36)).set({ monat: 'lz', beruf: info.beruf || null, paket: info.paket || null, land: info.land || null, zeilen: z, t: stamp() }).catch(function () {});
      } catch (e) {}
    },
    // Welche Berichte eine Firma verlangt (was, wie oft, was draufsteht), nur mit Einwilligung „Mithelfen“; Firmenname nur mit eigener Einwilligung „Firma“.
    // Damit lernt die App, was in einer Firma üblich ist. Je Gerät ein Dokument, wird überschrieben.
    berichte: function (liste, firma) {
      var co = consent(); if (!ON || !co.statistik || !liste) return;
      try { if (localStorage.getItem('stundenchecker.probe.active') === '1') return; } catch (e) {}
      try {
        var info = (app().info && app().info()) || {}, fi = co.firma && firma ? String(firma).replace(/\s+/g, ' ').trim().slice(0, 60) : null;
        var l = liste.slice(0, 12).map(function (e) { return { was: e.was, oft: e.oft, mit: (e.mit || []).slice(0, 6) }; }), sig = JSON.stringify([l, fi, info.beruf]), k = 'stundenchecker.bersig';
        if (rd(k) === sig) return; wr(k, sig);
        db().collection('statistik').doc(anonId() + '_berichte').set({ monat: 'berichte', beruf: info.beruf || null, paket: info.paket || null, land: info.land || null, firma: fi, berichte: l, t: stamp() }).catch(function () {});
      } catch (e) {}
    },
    // Anonyme Abweichungs-Statistik, nur mit Einwilligung: Beruf, Zeilen, Status, Größe grob (0,5 h)
    statistik: function (monat, rows) {
      if (!ON || !consent().statistik || !rows || !rows.length) return;
      try { if (localStorage.getItem('stundenchecker.probe.active') === '1') return; } catch (e) {} // Ausprobier-Modus meldet nichts
      try {
        var info = (app().info && app().info()) || {}, sig = JSON.stringify(rows), k = 'stundenchecker.statsig.' + monat;
        if (rd(k) === sig) return; wr(k, sig);
        db().collection('statistik').doc(anonId() + '_' + monat).set({ monat: monat, beruf: info.beruf || null, paket: info.paket || null, land: info.land || null, zeilen: rows, t: stamp() }).catch(function () {});
      } catch (e) {}
    },
    // Bild verkleinern: längste Seite 900 px, JPEG, damit es in ein Datenbank-Dokument (max. 1 MB) passt
    verkleinern: function (file) {
      return new Promise(function (res, rej) {
        var fr = new FileReader();
        fr.onerror = function () { rej(new Error('read')); };
        fr.onload = function () {
          var im = new Image();
          im.onerror = function () { rej(new Error('img')); };
          im.onload = function () {
            var s = Math.min(1, 900 / Math.max(im.width, im.height)), c = document.createElement('canvas');
            c.width = Math.round(im.width * s); c.height = Math.round(im.height * s);
            c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
            var q = 0.7, d = c.toDataURL('image/jpeg', q);
            while (d.length > 600000 && q > 0.3) { q -= 0.1; d = c.toDataURL('image/jpeg', q); }
            if (d.length > 700000) { rej(new Error('big')); return; }
            res(d);
          };
          im.src = fr.result;
        };
        fr.readAsDataURL(file);
      });
    }
  };
  // aktive Tage (nur das Datum, ohne Uhrzeit), die letzten 90
  api.tag = function () { try { var s = stats(), t = new Date().toISOString().slice(0, 10), l = s.aktiv || []; if (l[l.length - 1] !== t) { l.push(t); s.aktiv = l.slice(-90); wr(SK, JSON.stringify(s)); } } catch (e) {} };
  api.tag();
  window.StundenInsights = api;
  if (ON) { try { firebase.auth().onAuthStateChanged(function (u) { if (u) setTimeout(function () { api.push(false); }, 5000); }); } catch (e) {} }
})();
