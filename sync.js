/* Speicherung im Konto (Firebase Firestore, Frankfurt). Die Daten bleiben zusätzlich in diesem Browser (auch ohne Internet). */
(function () {
  'use strict';
  try { if (localStorage.getItem('stundenchecker.probe.active') === '1') { // Ausprobier-Modus: keine Verbindung zum Konto
    window.StundenSync = { changed: function () {}, beforeLogout: function () { return Promise.resolve(false); } }; return; } } catch (e) { }
  var cfg = window.FIREBASE_CONFIG;
  if (!cfg || !cfg.apiKey || /HIER/.test(cfg.apiKey) || !window.firebase || !firebase.firestore || !firebase.apps.length) return;

  var KEY = 'stundenchecker.v1', META = 'stundenchecker.sync';
  var db = firebase.firestore(), uid = null, timer = null, laedt = true, weg = false;
  function fertig() { if (!laedt || weg) return; laedt = false; document.dispatchEvent(new Event('sc-geladen')); }
  setTimeout(fertig, 8000);

  function rd(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function wr(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function del(k) { try { localStorage.removeItem(k); } catch (e) {} }
  function standWeg() { try { Object.keys(localStorage).forEach(function (k) { if (k.indexOf(KEY + '.stand-') === 0) localStorage.removeItem(k); }); } catch (e) {} } // Sicherheitsstände gehören nur zum angemeldeten Konto
  function meta() { try { return JSON.parse(rd(META)) || {}; } catch (e) { return {}; } }
  function setMeta(m) { wr(META, JSON.stringify(m)); }
  function localData() { try { var d = JSON.parse(rd(KEY)); return d && typeof d.days === 'object' ? d : null; } catch (e) { return null; } }
  function empty(d) {
    return !d || (!Object.keys(d.days || {}).length && !(d.settings || []).length && !Object.keys(d.abgleich || {}).length); // nur App-Merker im Profil zählen nicht als eigene Daten
  }
  function status(t, cls) { var el = document.getElementById('a-sync'); if (el) { el.textContent = t; el.className = 'a-sync ' + (cls || ''); } }
  function reload(daten) { weg = true;
    var l = []; try { l = JSON.parse(sessionStorage.getItem('sc.rl2') || '[]').filter(function (x) { return Date.now() - x < 30000; }); } catch (e) {}
    if (l.length >= (daten ? 3 : 1)) { weg = false; return false; } // Schutz gegen Endlos-Neuladen
    l.push(Date.now()); try { sessionStorage.setItem('sc.rl2', JSON.stringify(l)); } catch (e) {}
    location.reload(); return true;
  }
  function stash() { var raw = rd(KEY); if (raw) wr(KEY + '.vor-anmeldung-' + Date.now(), raw); } // Sicherheitskopie, falls Daten eines anderen Kontos auf dem Gerät lagen

  // Abgleich zwischen Geräten: Basis = Stand beim letzten Speichern im Konto. Was nur ein Gerät geändert hat, bleibt erhalten;
  // was beide geändert haben, gilt die Fassung von diesem Gerät. So löscht ein altes Gerät nicht mehr die Eingaben vom anderen.
  var BASIS = KEY + '.basis';
  function isObj(x) { return x && typeof x === 'object' && !Array.isArray(x); }
  function nachAb(x) { return Array.isArray(x) && x.length && x.every(function (e) { return isObj(e) && typeof e.gueltigAb === 'string'; }); }
  function nachId(x) { return Array.isArray(x) && x.length > 0 && x.every(function (e) { return isObj(e) && (typeof e.id === 'string' || typeof e.id === 'number') && e.id !== ''; }); }
  function mId(b, a, t) { // Listen mit Einträgen (Ausweise, Prämien, Dienste, Berichte …): je Eintrag zusammenführen, damit nichts verschwindet
    var bm = {}, am = {}, tm = {}, ord = [], hatB = Array.isArray(b);
    (nachId(b) ? b : []).forEach(function (e) { bm[e.id] = e; });
    a.forEach(function (e) { am[e.id] = e; if (ord.indexOf(e.id) < 0) ord.push(e.id); }); t.forEach(function (e) { tm[e.id] = e; if (ord.indexOf(e.id) < 0) ord.push(e.id); });
    return ord.map(function (k) {
      if (!hatB) return am[k] && tm[k] ? m3(undefined, am[k], tm[k]) : (am[k] || tm[k]); // ohne gemeinsamen Stand: alles behalten
      return m3(bm[k], am[k], tm[k]);
    }).filter(function (e) { return e !== undefined; });
  }
  function m3(b, a, t) {
    var sa = JSON.stringify(a), sb = JSON.stringify(b), st = JSON.stringify(t);
    if (sa === sb) return t;
    if (st === sb || sa === st) return a;
    if ((nachId(a) || (Array.isArray(a) && !a.length)) && (nachId(t) || (Array.isArray(t) && !t.length)) && (nachId(a) || nachId(t)) && !(typeof nachAb === 'function' && (nachAb(a) || nachAb(t)))) return mId(b, a, t);
    if (isObj(a) && isObj(t) && (b === undefined || isObj(b))) {
      var r = {}, ks = {}; [a, t, b || {}].forEach(function (o) { Object.keys(o).forEach(function (k) { ks[k] = 1; }); });
      Object.keys(ks).forEach(function (k) { var v = m3((b || {})[k], a[k], t[k]); if (v !== undefined) r[k] = v; });
      return r;
    }
    if (nachAb(a) && nachAb(t)) { // Werte je Gültigkeitsdatum zusammenführen
      var mb = {}, ma = {}, mt = {}, all = {};
      (nachAb(b) ? b : []).forEach(function (e) { mb[e.gueltigAb] = e; });
      a.forEach(function (e) { ma[e.gueltigAb] = e; all[e.gueltigAb] = 1; }); t.forEach(function (e) { mt[e.gueltigAb] = e; all[e.gueltigAb] = 1; });
      return Object.keys(all).sort().map(function (k) { return m3(mb[k], ma[k], mt[k]); }).filter(function (e) { return e !== undefined; });
    }
    return a;
  }
  function zusammen(remoteJson) {
    var loc = null, rem = null, bas; try { loc = JSON.parse(rd(KEY)); } catch (e) { } try { rem = JSON.parse(remoteJson); } catch (e) { }
    try { bas = JSON.parse(rd(BASIS)); } catch (e) { bas = undefined; } if (bas === null) bas = undefined;
    if (!loc) return remoteJson; if (!rem) return rd(KEY);
    return JSON.stringify(m3(bas, loc, rem));
  }
  function nDays(d) { var n = d && d.days ? Object.keys(d.days).length : 0; return n + (n === 1 ? ' Tag' : ' Tage'); }
  function ask(title, text, labels) { // Auswahl-Fenster: gibt die Nummer des gewählten Knopfs zurück
    return new Promise(function (res) {
      var o = document.createElement('div'); o.className = 'overlay'; o.setAttribute('role', 'dialog'); o.setAttribute('aria-modal', 'true');
      var h = '<div class="sheet"><h3></h3><p></p><div class="btns"></div></div>'; o.innerHTML = h;
      o.querySelector('h3').textContent = title; o.querySelector('p').textContent = text;
      labels.forEach(function (l, i) {
        var b = document.createElement('button'); b.type = 'button'; b.className = 'btn' + (i === 0 ? ' primary' : ''); b.textContent = l;
        b.onclick = function () { o.remove(); res(i); }; o.querySelector('.btns').appendChild(b);
      });
      document.body.appendChild(o);
    });
  }
  // Daten aus dem Konto: sofort in die laufende App übernehmen (auch wenn das Neuladen der Seite gerade gesperrt ist), dann neu laden
  function useRemote(remote) { wr(KEY, remote.json); wr(BASIS, remote.json); setMeta({ uid: uid, t: remote.t || 0, syncedT: remote.t || 0 }); if (!reload(true)) { document.dispatchEvent(new Event('sc-fremd')); fertig(); } } // Neuladen gesperrt: Daten direkt in die laufende App übernehmen

  function push() {
    var raw = rd(KEY), m = meta(), cut = new Date().toISOString();
    if (!uid || !raw || m.uid !== uid) return Promise.resolve(false);
    if (raw.length > 900000) { status('Es sind zu viele Daten für die Speicherung im Konto.', 'bad'); return Promise.resolve(false); }
    var t = m.t || Date.now(), ref = db.collection('users').doc(uid), gemischt = false, raw0 = raw;
    status('Wird gespeichert …');
    return db.runTransaction(function (tx) {
      return tx.get(ref).then(function (sn) {
        var r = sn.exists ? sn.data() : null, out = raw;
        // Hat ein anderes Gerät seit meinem letzten Speichern etwas ins Konto geschrieben? Dann zusammenführen statt überschreiben.
        if (r && r.json && (r.t || 0) > (m.syncedT || 0) && r.json !== raw) { out = zusammen(r.json); gemischt = out !== raw; t = Math.max(t, (r.t || 0) + 1); }
        raw = out;
        tx.set(ref, { json: out, t: t, v: 1, updated: firebase.firestore.FieldValue.serverTimestamp() });
      });
    }).then(function () {
      wr(BASIS, raw);
      var neu = rd(KEY) !== raw0; // während des Speicherns hier schon wieder etwas geändert: nächste Runde führt es zusammen
      if (gemischt && !neu) { wr(KEY, raw); document.dispatchEvent(new Event('sc-fremd')); }
      else if (gemischt && neu) { try { wr(KEY, JSON.stringify(m3(JSON.parse(raw0), JSON.parse(rd(KEY)), JSON.parse(raw)))); document.dispatchEvent(new Event('sc-fremd')); } catch (e) { } }
      var mm = meta(); if (!neu) { mm.t = Math.max(mm.t || 0, t); mm.syncedT = t; setMeta(mm); } else { mm.syncedT = t; setMeta(mm); }
      status('In deinem Konto gespeichert ✓', 'ok');
      // Serverzeit lesen: Notizen, die in diesem Speichervorgang schon enthalten waren, bekommen damit einen Zeitpunkt, den das Handy nicht verstellen kann
      db.collection('users').doc(uid).get({ source: 'server' }).then(function (sn) {
        var u = sn.get('updated'); if (u && u.toMillis) document.dispatchEvent(new CustomEvent('sc-servertime', { detail: { ms: u.toMillis(), cutoff: cut } }));
      }).catch(function () {});
      return true;
    }, function () { status('Noch nicht im Konto gespeichert. Es fehlt die Verbindung. Deine Daten sind auf diesem Gerät sicher.', 'bad'); return false; });
  }

  // Profilbild, Unterschrift und App-Symbol bleiben nur auf dem Gerät. Meldet sich hier ein anderes Konto an, gehören sie nicht zu ihm.
  function geraetFremd() {
    var GU = 'stundenchecker.geraetUid', gu = rd(GU), weg = false;
    if (gu !== uid && (gu || empty(localData()))) ['stundenchecker.foto', 'stundenchecker.sig', 'stundenchecker.iconimg'].forEach(function (k) { if (rd(k)) { del(k); weg = true; } }); if (weg && rd('stundenchecker.icon') === 'foto') del('stundenchecker.icon');
    if (gu !== uid) { if (gu) standWeg(); wr(GU, uid); }
    return weg;
  }
  function start() {
    if (geraetFremd()) reload();
    status('Daten werden geladen …');
    db.collection('users').doc(uid).get().then(function (snap) {
      var m = meta(), loc = localData(), locEmpty = empty(loc), mine = m.uid === uid;
      var remote = snap.exists ? snap.data() : null, rd0 = null;
      if (remote) { try { rd0 = JSON.parse(remote.json); } catch (e) { rd0 = null; } }
      if (!remote) {
        if (locEmpty) { setMeta({ uid: uid, t: 0, syncedT: 0 }); status('In deinem Konto gespeichert ✓', 'ok'); return; }
        if (mine) { setMeta({ uid: uid, t: m.t || Date.now(), syncedT: m.syncedT || 0 }); return push(); }
        return ask('Daten übernehmen?', 'Auf diesem Gerät sind schon Einträge gespeichert (' + nDays(loc) + '). Dein Konto ist noch leer. Sollen diese Einträge ins Konto übernommen werden?', ['Ja, übernehmen', 'Nein, leer starten']).then(function (i) {
          if (i === 0) { setMeta({ uid: uid, t: Date.now(), syncedT: 0 }); return push(); }
          stash(); del(KEY); setMeta({ uid: uid, t: 0, syncedT: 0 }); reload();
        });
      }
      if (locEmpty) { return useRemote(remote); }
      if (!mine) { // auf diesem Gerät und im Konto gibt es Daten, die nichts voneinander wissen
        return ask('Welche Daten behalten?', 'In deinem Konto sind schon Einträge (' + nDays(rd0) + '). Auf diesem Gerät gibt es auch Einträge (' + nDays(loc) + '). Welche sollen gelten? Die anderen werden als Sicherheitskopie im Browser aufgehoben.', ['Die aus dem Konto', 'Die von diesem Gerät']).then(function (i) {
          stash();
          if (i === 0) return useRemote(remote);
          wr(KEY + '.konto-kopie-' + Date.now(), remote.json);
          setMeta({ uid: uid, t: Date.now(), syncedT: 0 }); return push();
        });
      }
      if ((m.t || 0) > (m.syncedT || 0)) return push(); // auf diesem Gerät gibt es noch nicht gespeicherte Änderungen; ist das Konto neuer, führt push() beides zusammen
      if ((remote.t || 0) > (m.syncedT || 0)) return useRemote(remote); // neuere Daten von einem anderen Gerät
      status('In deinem Konto gespeichert ✓', 'ok');
    }, function () { status('Keine Verbindung zum Konto. Deine Daten bleiben auf diesem Gerät.', 'bad'); }).then(fertig, fertig);
  }

  window.StundenSync = {
    changed: function () {
      var m = meta(); m.t = Date.now(); if (uid && !m.uid) m.uid = uid; setMeta(m);
      if (!uid) return;
      status('Wird gespeichert …'); clearTimeout(timer); timer = setTimeout(push, 1500);
    },
    angemeldet: function () { return !!uid; },
    laedt: function () { return laedt; },
    sichern: function () { clearTimeout(timer); return uid ? push() : Promise.resolve(false); },
    beforeLogout: function () { // alles sichern, danach die Daten von diesem Gerät entfernen (wichtig, wenn mehrere Personen ein Gerät benutzen)
      clearTimeout(timer);
      return push().then(function (ok) { if (ok) { del(KEY); del(META); standWeg(); } return ok; });
    }
  };

  firebase.auth().onAuthStateChanged(function (u) { uid = u ? u.uid : null; if (uid) { laedt = true; start(); } else fertig(); });
})();
