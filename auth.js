/* Anmeldung (Firebase Authentication): E-Mail + Passwort und Google. Daten-Synchronisierung folgt im nächsten Schritt. */
(function () {
  'use strict';
  var cfg = window.FIREBASE_CONFIG, box = document.getElementById('auth');
  if (!box) return;
  // Ohne ausgefüllte Verbindungsdaten (oder ohne Firebase-Skripte) läuft die App wie bisher ohne Anmeldung.
  if (!cfg || !cfg.apiKey || /HIER/.test(cfg.apiKey) || !window.firebase) return;

  firebase.initializeApp(cfg);
  var auth = firebase.auth();
  auth.languageCode = 'de';
  var mode = 'login';
  var $ = function (s) { return document.querySelector(s); };

  var FEHLER = {
    'auth/invalid-email': 'Diese E-Mail-Adresse sieht nicht richtig aus. Bitte prüfen.',
    'auth/missing-email': 'Bitte die E-Mail-Adresse eintragen.',
    'auth/missing-password': 'Bitte das Passwort eintragen.',
    'auth/weak-password': 'Das Passwort ist zu kurz. Bitte mindestens 6 Zeichen.',
    'auth/email-already-in-use': 'Mit dieser E-Mail gibt es schon ein Konto. Bitte oben auf „Anmelden“ tippen.',
    'auth/user-not-found': 'Mit dieser E-Mail gibt es noch kein Konto. Bitte oben auf „Neu hier“ tippen.',
    'auth/wrong-password': 'Das Passwort stimmt nicht. Tipp: mit „Passwort vergessen?“ bekommst du ein neues.',
    'auth/invalid-credential': 'E-Mail oder Passwort stimmt nicht. Tipp: mit „Passwort vergessen?“ bekommst du ein neues.',
    'auth/invalid-login-credentials': 'E-Mail oder Passwort stimmt nicht. Tipp: mit „Passwort vergessen?“ bekommst du ein neues.',
    'auth/too-many-requests': 'Zu viele Versuche. Bitte ein paar Minuten warten und noch einmal probieren.',
    'auth/network-request-failed': 'Keine Internetverbindung. Bitte prüfen und noch einmal probieren.',
    'auth/popup-closed-by-user': 'Die Anmeldung mit Google wurde abgebrochen.',
    'auth/cancelled-popup-request': 'Die Anmeldung mit Google wurde abgebrochen.',
    'auth/popup-blocked': 'Dein Browser hat das Google-Fenster blockiert. Bitte Pop-ups für diese Seite erlauben.',
    'auth/unauthorized-domain': 'Diese Webseite ist für die Anmeldung nicht freigegeben.',
    'auth/admin-restricted-operation': 'Neue Konten sind im Moment nicht erlaubt.',
    'auth/operation-not-allowed': 'Diese Anmeldeart ist noch nicht eingeschaltet.'
  };
  function msg(e) { return FEHLER[e && e.code] || ('Das hat leider nicht geklappt. Bitte noch einmal probieren. (Fehlercode: ' + ((e && e.code) || (e && e.message) || 'unbekannt') + ')'); }
  function say(t, ok) { var m = $('#a-msg'); m.textContent = t || ''; m.className = 'a-msg' + (ok ? ' ok' : ''); m.hidden = !t; }
  function busy(on) { ['a-go', 'a-google', 'a-forgot'].forEach(function (i) { var b = document.getElementById(i); if (b) b.disabled = on; }); }

  function paintMode() {
    var reg = mode === 'register';
    $('#a-tab-login').classList.toggle('on', !reg);
    $('#a-tab-reg').classList.toggle('on', reg);
    $('#a-go').textContent = reg ? 'Konto anlegen' : 'Anmelden';
    $('#a-pw').autocomplete = reg ? 'new-password' : 'current-password';
    $('#a-forgot').hidden = reg;
    $('#a-pwhint').hidden = !reg;
    $('#a-pw2box').hidden = !reg;
    if (!reg) $('#a-pw2').value = '';
    say('');
  }

  function go() {
    var mail = $('#a-mail').value.trim(), pw = $('#a-pw').value;
    if (!mail) { say('Bitte die E-Mail-Adresse eintragen.'); return; }
    if (!pw) { say('Bitte das Passwort eintragen.'); return; }
    if (mode === 'register' && pw !== $('#a-pw2').value) { say('Die beiden Passwörter sind nicht gleich. Bitte noch einmal eintippen.'); return; }
    say(''); busy(true);
    var p = mode === 'register'
      ? auth.createUserWithEmailAndPassword(mail, pw).then(function (c) { return c.user.sendEmailVerification().catch(function () {}); })
      : auth.signInWithEmailAndPassword(mail, pw);
    p.catch(function (e) { say(msg(e)); }).then(function () { busy(false); });
  }

  document.addEventListener('click', function (ev) {
    var eb = ev.target && ev.target.closest && ev.target.closest('[data-eye]');
    if (eb) { var f0 = document.getElementById(eb.dataset.eye), show = f0.type === 'password'; f0.type = show ? 'text' : 'password'; eb.classList.toggle('on', show); eb.setAttribute('aria-pressed', show ? 'true' : 'false'); eb.setAttribute('aria-label', show ? 'Passwort verbergen' : 'Passwort anzeigen'); return; }
    var id = ev.target && ev.target.id;
    if (id === 'a-tab-login') { mode = 'login'; paintMode(); }
    else if (id === 'a-tab-reg') { mode = 'register'; paintMode(); }
    else if (id === 'a-go') { ev.preventDefault(); go(); }
    else if (id === 'a-google') {
      say(''); busy(true);
      auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()).catch(function (e) { say(msg(e)); }).then(function () { busy(false); });
    }
    else if (id === 'a-forgot') {
      var mail = $('#a-mail').value.trim();
      if (!mail) { say('Bitte oben deine E-Mail-Adresse eintragen und dann noch einmal „Passwort vergessen?“ tippen.'); return; }
      busy(true);
      auth.sendPasswordResetEmail(mail).then(function () { say('Wir haben dir eine E-Mail geschickt. Schau auch im Spam-Ordner nach.', true); }, function (e) { say(msg(e)); }).then(function () { busy(false); });
    }
    else if (id === 'a-logout') { auth.signOut(); }
  });
  $('#a-form').addEventListener('submit', function (ev) { ev.preventDefault(); go(); });

  auth.onAuthStateChanged(function (u) {
    box.hidden = !!u;
    document.body.classList.toggle('auth-open', !u);
    var card = $('#a-account');
    if (card) { card.hidden = !u; $('#a-user').textContent = u ? (u.email || u.displayName || '') : ''; }
    if (u) { $('#a-pw').value = ''; $('#a-pw2').value = ''; say(''); }
  });
  paintMode();
})();
