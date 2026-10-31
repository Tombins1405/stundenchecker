/* Speicherung im Konto (Firebase Firestore, Frankfurt). Die Daten bleiben zusätzlich in diesem Browser (auch ohne Internet). */
(function () {
  'use strict';
  var cfg = window.FIREBASE_CONFIG;
  if (!cfg || !cfg.apiKey || /HIER/.test(cfg.apiKey) || !window.firebase || !firebase.firestore || !firebase.apps.length) return;

  var KEY = 'stundenchecker.v1', META = 'stundenchecker.sync';
  var db = firebase.firestore(), uid = null, timer = null;

  function rd(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function wr(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function del(k) { try { localStorage.removeItem(k); } catch (e) {} }
  function meta() { try { return JSON.parse(rd(META)) || {}; } catch (e) { return {}; } }
  function setMeta(m) { wr(META, JSON.stringify(m)); }
  function localData() { try { var d = JSON.parse(rd(KEY)); return d && typeof d.days === 'object' ? d : null; } catch (e) { return null; } }
  function empty(d) {
    return !d || (!Object.keys(d.days || {}).length && !(d.settings || []).length && !Object.keys(d.abgleich || {}).length && !Object.keys(d.profil || {}).length);
  }
  function status(t, cls) { var el = document.getElementById('a-sync'); if (el) { el.textContent = t; el.className = 'a-sync ' + (cls || ''); } }
  function reload() {
    var last = 0; try { last = +sessionStorage.getItem('sc.rl') || 0; } catch (e) {}
    if (Date.now() - last < 15000) return;
    try { sessionStorage.setItem('sc.rl', String(Date.now())); } catch (e) {}
    location.reload();
  }
  function stash() { var raw = rd(KEY); if (raw) wr(KEY + '.vor-anmeldung-' + Date.now(), raw); } // Sicherheitskopie, falls Daten eines anderen Kontos auf dem Gerät lagen

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
  function useRemote(remote) { wr(KEY, remote.json); setMeta({ uid: uid, t: remote.t || 0, syncedT: remote.t || 0 }); reload(); }

  function push() {
    var raw = rd(KEY), m = meta(), cut = new Date().toISOString();
    if (!uid || !raw || m.uid !== uid) return Promise.resolve(false);
    if (raw.length > 900000) { status('Es sind zu viele Daten für die Speicherung im Konto.', 'bad'); return Promise.resolve(false); }
    var t = m.t || Date.now();
    status('Wird gespeichert …');
    return db.collection('users').doc(uid).set({ json: raw, t: t, v: 1, updated: firebase.firestore.FieldValue.serverTimestamp() }).then(function () {
      var mm = meta(); if ((mm.t || 0) <= t) { mm.syncedT = t; setMeta(mm); }
      status('In deinem Konto gespeichert ✓', 'ok');
      // Serverzeit lesen: Notizen, die in diesem Speichervorgang schon enthalten waren, bekommen damit einen Zeitpunkt, den das Handy nicht verstellen kann
      db.collection('users').doc(uid).get({ source: 'server' }).then(function (sn) {
        var u = sn.get('updated'); if (u && u.toMillis) document.dispatchEvent(new CustomEvent('sc-servertime', { detail: { ms: u.toMillis(), cutoff: cut } }));
      }).catch(function () {});
      return true;
    }, function () { status('Noch nicht im Konto gespeichert. Es fehlt die Verbindung. Deine Daten sind auf diesem Gerät sicher.', 'bad'); return false; });
  }

  function start() {
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
      if ((m.t || 0) > (m.syncedT || 0)) return push(); // auf diesem Gerät gibt es noch nicht gespeicherte Änderungen
      if ((remote.t || 0) > (m.syncedT || 0)) return useRemote(remote); // neuere Daten von einem anderen Gerät
      status('In deinem Konto gespeichert ✓', 'ok');
    }, function () { status('Keine Verbindung zum Konto. Deine Daten bleiben auf diesem Gerät.', 'bad'); });
  }

  window.StundenSync = {
    changed: function () {
      var m = meta(); m.t = Date.now(); if (uid && !m.uid) m.uid = uid; setMeta(m);
      if (!uid) return;
      status('Wird gespeichert …'); clearTimeout(timer); timer = setTimeout(push, 1500);
    },
    beforeLogout: function () { // alles sichern, danach die Daten von diesem Gerät entfernen (wichtig, wenn mehrere Personen ein Gerät benutzen)
      clearTimeout(timer);
      return push().then(function (ok) { if (ok) { del(KEY); del(META); } return ok; });
    }
  };

  firebase.auth().onAuthStateChanged(function (u) { uid = u ? u.uid : null; if (uid) start(); });
})();
