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
      if (!ON) return; var u = user(); if (!u) return;
      var last = +rd('stundenchecker.profpush') || 0; if (!force && Date.now() - last < 6 * 3600 * 1000) return;
      try {
        var a = app(), info = a.info ? a.info() : {};
        var doc = {
          uid: u.uid, email: u.email || null, created: u.metadata && u.metadata.creationTime || null, lastLogin: u.metadata && u.metadata.lastSignInTime || null,
          lastSeen: stamp(), lang: info.lang || null, version: window.APP_VERSION || null, beruf: info.beruf || null, paket: info.paket || null, land: info.land || null,
          tage: info.tage || 0, features: stats(), consent: consent()
        };
        db().collection('profiles').doc(u.uid).set(doc, { merge: true }).then(function () { wr('stundenchecker.profpush', String(Date.now())); }, function () {});
      } catch (e) {}
    },
    // Feedback mit Text und optional Bild (schon verkleinert)
    feedback: function (art, text, img) {
      return new Promise(function (res, rej) {
        if (!ON) { rej(new Error('off')); return; }
        try {
          var u = user(), a = app(), info = a.info ? a.info() : {};
          db().collection('feedback').add({ uid: u ? u.uid : null, email: u ? u.email : null, art: art, text: String(text).slice(0, 4000), img: img || null, view: info.view || null, lang: info.lang || null, version: window.APP_VERSION || null, t: stamp(), neu: true }).then(res, rej);
        } catch (e) { rej(e); }
      });
    },
    // Mia: Frage ohne Antwort. Wortlaut nur mit Einwilligung.
    miaOffen: function (text, lang) {
      api.count('mia_offen');
      if (!ON || !consent().miaFragen) return;
      try { db().collection('miaOffen').add({ text: String(text).slice(0, 300), lang: lang || null, t: stamp(), anon: anonId() }).catch(function () {}); } catch (e) {}
    },
    // Anonyme Abweichungs-Statistik, nur mit Einwilligung: Beruf, Zeilen, Status, Größe grob (0,5 h)
    statistik: function (monat, rows) {
      if (!ON || !consent().statistik || !rows || !rows.length) return;
      try {
        var info = (app().info && app().info()) || {}, sig = monat + JSON.stringify(rows);
        if (rd('stundenchecker.statsig') === sig) return; wr('stundenchecker.statsig', sig);
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
  window.StundenInsights = api;
  if (ON) { try { firebase.auth().onAuthStateChanged(function (u) { if (u) setTimeout(function () { api.push(false); }, 5000); }); } catch (e) {} }
})();
