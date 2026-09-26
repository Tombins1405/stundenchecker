// ==========================================================================
// 🔥 FIREBASE SERVER-ANBINDUNG & RECHTE-ENGINE
// ==========================================================================
// Die Verbindungsschlüssel stammen direkt aus dem funktionierenden Prototyp
const firebaseConfig = {
    apiKey: "AIzaSyA5Hw0oY4WRbZErr0F7Y8umC6S7wmFqWxI",
    authDomain: "stunden-checker.firebaseapp.com",
    projectId: "stunden-checker",
    storageBucket: "stunden-checker.firebasestorage.app",
    messagingSenderId: "1086750675976",
    appId: "1:1086750675976:web:141b66edcdc14261ce6dbd"
};

// Initialisierung absichern
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const db = firebase.firestore();

// Globale Variablen für das Systemgedächtnis
var masterDB = {};
let aktuellerUser = null;

// ==========================================================================
// ⏱️ GITHUB VERSIONSZÄHLER (GECACHTER LIVE-UPTIME-TICKER)
// ==========================================================================
function initAppVersionTicker() {
    var liveVersion = "2.82 Pro";
    var vSpan = document.getElementById('live-version-balken');
    var cacheBuster = new Date().getTime();
    
    // Unzerstörbarer API-Pfad ohne doppelte Schrägstriche
    var url = 'https://api.' + 'github.com/repos/Tombins1405/stundenchecker/commits?path=index.html&per_page=1&_cb=' + cacheBuster;
    
    fetch(url)
        .then(function(res) { return res.json(); })
        .then(function(data) {
            if (data && data.length > 0) {
                var commitDate = new Date(data[0].commit.committer.date);
                var optionen = { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' };
                var zeitText = commitDate.toLocaleString('de-AT', optionen) + " Uhr";
                if (vSpan) { vSpan.innerText = 'v' + liveVersion + ' (Upload: ' + zeitText + ')'; }
            } else {
                if (vSpan) { vSpan.innerText = 'v' + liveVersion + ' (Live)'; }
            }
        })
        .catch(function(error) {
            if (vSpan) { vSpan.innerText = 'v' + liveVersion + ' (Aktiv)'; }
        });
}

// ==========================================================================
// 🔐 SERVER-LOGIN & REGISTRIERUNGS-LOGIK
// ==========================================================================
function serverRegistrierung() {
    var email = document.getElementById('auth-email').value;
    var pass = document.getElementById('auth-passwort').value;
    if (!email || !pass) return alert("Bitte E-Mail und Passwort eingeben!");
    if (pass.length < 6) return alert("Das Passwort muss mindestens 6 Zeichen lang sein!");

    document.getElementById('auth-status').style.color = "var(--purple)";
    document.getElementById('auth-status').innerText = "⏳ Erstelle Server-Account...";

    auth.createUserWithEmailAndPassword(email, pass)
        .then(function(userCredential) {
            alert("🎯 ACCOUNT ERFOLGREICH ERSTELLT!\nBitte klicke jetzt auf 'Anmelden', um das System freizuschalten.");
            document.getElementById('auth-status').style.color = "var(--success)";
            document.getElementById('auth-status').innerText = "✅ Account registriert. Bitte Anmelden klicken.";
        })
        .catch(function(error) {
            document.getElementById('auth-status').style.color = "red";
            document.getElementById('auth-status').innerText = "❌ Fehler: " + error.message;
            alert("Registrierung fehlgeschlagen: " + error.message);
        });
}

function serverAnmeldung() {
    var email = document.getElementById('auth-email').value;
    var pass = document.getElementById('auth-passwort').value;
    if (!email || !pass) return alert("Bitte E-Mail und Passwort eingeben!");

    document.getElementById('auth-status').style.color = "var(--purple)";
    document.getElementById('auth-status').innerText = "⏳ Prüfe Server-Anmeldung...";

    auth.signInWithEmailAndPassword(email, pass)
        .then(function(userCredential) {
            aktuellerUser = email;
            var userUid = userCredential.user.uid; 
            
            document.getElementById('auth-status').style.color = "var(--success)";
            document.getElementById('auth-status').innerText = "🔓 Angemeldet als: " + email;
            document.getElementById('auth-box').style.borderColor = "var(--success)";
            
            // B2B Admin- & Rechteprüfung über den europäischen Firestore-Server
            db.collection("users").doc(userUid).get()
                .then(function(doc) {
                    // Benutzeroberfläche freischalten (Gäste-Zone aus, Interne Zone ein)
                    document.getElementById('guest-zone').classList.add('hidden');
                    document.getElementById('internal-tabs-nav').classList.remove('hidden');
                    document.getElementById('profil-box-container').classList.remove('hidden');
                    
                    if (doc.exists && doc.data().rolle === "admin") {
                        document.getElementById('auth-title').innerText = "👑 Admin-Zentrale aktiv";
                        alert("👑 WILLKOMMEN CHEF!\nAdmin-Rechte aktiv. Der Excel-CSV-Import wurde exakt für dich freigeschaltet.");
                        
                        var importBox = document.getElementById('import-box-container');
                        importBox.classList.remove('hidden');
                        importBox.style.display = "block";
                    } else {
                        document.getElementById('auth-title').innerText = "✅ Server-Verbindung aktiv";
                        alert("🔓 LOGIN ERFOLGREICH!\nWillkommen zurück. Deine Daten sind jetzt servergesichert.");
                        document.getElementById('import-box-container').style.display = "none";
                    }
                    ladeTag();
                })
                .catch(function(err) {
                    // Fallback bei Offline-Modus
                    document.getElementById('guest-zone').classList.add('hidden');
                    document.getElementById('internal-tabs-nav').classList.remove('hidden');
                    document.getElementById('profil-box-container').classList.remove('hidden');
                    ladeTag();
                    alert("🔓 LOGIN ERFOLGREICH!\n(Hinweis: Rechteprüfung im Offline-Modus)");
                });
        })
        .catch(function(error) {
            document.getElementById('auth-status').style.color = "red";
            document.getElementById('auth-status').innerText = "❌ Fehler: " + error.message;
            alert("Anmeldung fehlgeschlagen: " + error.message);
        });
}

// ==========================================================================
// 📦 3D-KARUSSELL STEUERUNG
// ==========================================================================
function selectPackage(type) {
    const basisCard = document.querySelector(".card-basis");
    const premiumCard = document.querySelector(".card-premium");
    
    if (type === 'basis') {
        basisCard.classList.add("selected");
        premiumCard.classList.remove("selected");
    } else {
        premiumCard.classList.add("selected");
        basisCard.classList.remove("selected");
    }
}

// ==========================================================================
// 🐒 MIA STEUERUNG (ANIMATION & PASSWORT-WÄCHTER)
// ==========================================================================
function toggleChatbot() {
    const bubble = document.getElementById("mia-speech-bubble");
    bubble.classList.toggle("chat-hidden");
}

// Sabines Passwort-Auge & Äffchen-Wechsler (Interaktiver UI-Schutz)
function togglePasswordVisibility(fieldId) {
    const input = document.getElementById(fieldId);
    const eyeIcon = document.getElementById(fieldId === 'auth-passwort' ? 'eye-icon-login' : 'eye-icon-register');
    const monkeyIcon = document.getElementById(fieldId === 'auth-passwort' ? 'monkey-auth-login' : 'monkey-auth-register');
    
    if (input.type === "password") {
        input.type = "text";
        eyeIcon.classList.remove("fa-eye");
        eyeIcon.classList.add("fa-eye-slash");
        if (monkeyIcon) monkeyIcon.innerText = "🙊"; // Schaut durch die Finger
    } else {
        input.type = "password";
        eyeIcon.classList.remove("fa-eye-slash");
        eyeIcon.classList.add("fa-eye");
        if (monkeyIcon) monkeyIcon.innerText = "🐒"; // Normales Äffchen
    }
}

// Echtzeit-Stärke-Farbwächter für Passwörter
function validatePasswordStrength() {
    const pass = document.getElementById("auth-passwort").value;
    const authCard = document.getElementById("auth-box");
    
    if (pass.length === 0) {
        authCard.classList.remove("pwd-weak", "pwd-strong");
    } else if (pass.length < 6) {
        authCard.classList.add("pwd-weak");
        authCard.classList.remove("pwd-strong");
        document.getElementById("monkey-auth-login").innerText = "🙈"; // Hält die Augen zu bei schwachem PW
    } else {
        authCard.classList.add("pwd-strong");
        authCard.classList.remove("pwd-weak");
        document.getElementById("monkey-auth-login").innerText = "😎"; // Cooles Äffchen bei starkem PW
    }
}

// ==========================================================================
// 🗺️ COCKPIT TAB-UMSCHALTUNG (STAMMDATEN, ERFASSUNG, RECHNER)
// ==========================================================================
function switchTab(tabId) {
    document.getElementById('sec-reg').classList.add('hidden');
    document.getElementById('sec-input').classList.add('hidden');
    document.getElementById('sec-lohni').classList.add('hidden');
    document.getElementById('tab-reg').classList.remove('active');
    document.getElementById('tab-input').classList.remove('active');
    document.getElementById('tab-lohni').classList.remove('active');

    document.getElementById('sec-' + tabId).classList.remove('hidden');
    document.getElementById('tab-' + tabId).classList.add('active');
    
    berechneLive();
    if(tabId === 'lohni') { berechneMonatlicheAbrechnung(); }
}

// ==========================================================================
// 📊 MATHEMATISCHE RECHEN-ENGINE (DIÄTEN & LOHNSTEUER ÖSTERREICH)
// ==========================================================================
function timeToHours(t) { 
    if (!t) return 0; 
    var parts = t.split(':'); 
    return parseInt(parts[0], 10) + (parseInt(parts[1], 10) / 60); 
}

function getKalenderwoche(dateStr) {
    if (!dateStr) return 0;
    var d = new Date(dateStr); d.setHours(0,0,0,0);
    d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
    var week1 = new Date(d.getFullYear(), 0, 4);
    return 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
}

function berechneWochenStunden(zielDatum) {
    if (!zielDatum) return 0;
    var zielWoche = getKalenderwoche(zielDatum);
    var zielJahr = new Date(zielDatum).getFullYear();
    var summe = 0;
    for (var tag in masterDB) {
        if (masterDB.hasOwnProperty(tag)) {
            if (getKalenderwoche(tag) === zielWoche && new Date(tag).getFullYear() === zielJahr) {
                summe += masterDB[tag].calc.netto;
            }
        }
    }
    return summe;
}

function berechneLive() {
    var von = document.getElementById('von').value; 
    var bis = document.getElementById('bis').value;
    var info = document.getElementById('info').value; 
    var zFelder = document.getElementById('zeit-felder');
    var datum = document.getElementById('datum').value;

    var t = { netto: 0, uest: 0, gesamt: 0, p: 0, diaete: 0, naecht: 0 };

    if (info === "Urlaub" || info === "Sonderurlaub" || info === "Krankenstand" || info === "Feiertag") {
        zFelder.style.display = "none";
        document.getElementById('res-netto').innerText = "8.00 Std"; 
        document.getElementById('res-uest').innerText = "0.00 Std";
        t = { netto: 8, uest: 0, gesamt: 8, p: 0, diaete: 0, naecht: 0 };
    } else if (info === "Zeitausgleich") {
        zFelder.style.display = "none";
        document.getElementById('res-netto').innerText = "0.00 Std"; 
        document.getElementById('res-uest').innerText = "-8.00 Std";
        t = { netto: 0, uest: -8, gesamt: 0, p: 0, diaete: 0, naecht: 0 };
    } else if (info === "Frei") {
        zFelder.style.display = "none";
        document.getElementById('res-netto').innerText = "0.00 Std"; 
        document.getElementById('res-uest').innerText = "0.00 Std";
        t = { netto: 0, uest: 0, gesamt: 0, p: 0, diaete: 0, naecht: 0 };
    } else {
        zFelder.style.display = "block";
        if (von && bis) {
            var g = timeToHours(bis) - timeToHours(von); if (g < 0) g += 24;
            var p = timeToHours(document.getElementById('p_bis').value) - timeToHours(document.getElementById('p_von').value); if (p < 0) p = 0;
            var netto = Math.max(0, g - p);
            var uest = info === "Wochendarbeit" ? netto : Math.max(0, netto - 8);

            document.getElementById('res-netto').innerText = netto.toFixed(2) + " Std";
            document.getElementById('res-uest').innerText = uest.toFixed(2) + " Std";
            
            var nPauschale = parseInt(document.getElementById('naechstung').value, 10) ? 15.00 : 0;
            t = { netto: netto, uest: uest, gesamt: g, p: p, diaete: netto > 0 ? 1 : 0, naecht: nPauschale };
        }
    }

    var wStunden = berechneWochenStunden(datum);
    if (!masterDB[datum]) wStunden += t.netto;
    document.getElementById('res-woche').innerText = wStunden.toFixed(2) + " Std";
    return t;
}

function speichereTag() {
    var datum = document.getElementById('datum').value; if (!datum) return;
    masterDB[datum] = {
        von: document.getElementById('von').value, 
        bis: document.getElementById('bis').value,
        p_von: document.getElementById('p_von').value, 
        p_bis: document.getElementById('p_bis').value,
        info: document.getElementById('info').value,
        naechstung: document.getElementById('naechstung').value,
        calc: berechneLive()
    };
    alert("Tag erfolgreich gesichert!");
    
    // Cloud Backup bei aktivem User
    if (auth.currentUser) {
        var userEmail = auth.currentUser.email;
        var bereinigteEmail = userEmail.replace(/\./g, '_');
        db.collection("monate").doc(bereinigteEmail).set({
            daten: JSON.stringify(masterDB)
        }).then(() => console.log("☁️ Backup gesichert."));
    }

    var n = new Date(datum); n.setDate(n.getDate() + 1);
    document.getElementById('datum').value = n.toISOString().substring(0,10);
    ladeTag();
}

function ladeTag() {
    var datum = document.getElementById('datum').value;
    if (masterDB[datum]) {
        var d = masterDB[datum];
        document.getElementById('von').value = d.von; 
        document.getElementById('bis').value = d.bis;
        document.getElementById('p_von').value = d.p_von; 
        document.getElementById('p_bis').value = d.p_bis;
        document.getElementById('info').value = d.info; 
        document.getElementById('naechstung').value = d.naechstung || "0";
    } else {
        document.getElementById('von').value = "06:30"; 
        document.getElementById('bis').value = "17:00";
        document.getElementById('p_von').value = "12:00"; 
        document.getElementById('p_bis').value = "12:30";
        document.getElementById('info').value = "Arbeit"; 
        document.getElementById('naechstung').value = "0";
    }
    berechneLive();
}

function berechneMonatlicheAbrechnung() {
    var lohn = parseFloat(document.getElementById('reg-lohn').value) || 14.30;
    var dSatz = parseFloat(document.getElementById('reg-diaet').value) || 24.15;
    var zaSchieber = parseFloat(document.getElementById('za-schieber').value) || 0;
    var datum = document.getElementById('datum').value;
    var zielMonat = datum.substring(0, 7);

    var grundStunden = 0; var uestGesamt = 0; var diaetenGesamt = 0; var naechtGesamt = 0;

    for (var tag in masterDB) {
        if (masterDB.hasOwnProperty(tag)) {
            if (!tag.startsWith(zielMonat)) continue;
            var d = masterDB[tag];
            if (d.info === "Urlaub" || d.info === "Sonderurlaub" || d.info === "Krankenstand" || d.info === "Feiertag") {
                grundStunden += 8;
            } else {
                grundStunden += Math.min(8, d.calc.netto);
                uestGesamt += d.calc.uest || 0;
                if (d.calc.diaete) diaetenGesamt += dSatz;
                naechtGesamt += d.calc.naecht || 0;
            }
        }
    }

    var zaGebucht = Math.min(uestGesamt, zaSchieber);
    if(zaGebucht < 0) zaGebucht = 0;
    var uestAuszahlung = Math.max(0, uestGesamt - zaGebucht);
    
    var bruttoVerdienst = (grundStunden * lohn) + (uestAuszahlung * lohn * 1.5);

    var svBeitrag = bruttoVerdienst * 0.1812; 
    var lohnsteuerBasis = bruttoVerdienst - svBeitrag - 300; 
    var lohnsteuer = 0;

    // Österreichische Lohnsteuer-Progressionsstufen (Monatliche Näherung)
    if (lohnsteuerBasis > 0) {
        if (lohnsteuerBasis <= 11693 / 12) {
            lohnsteuer = 0;
        } else if (lohnsteuerBasis <= 19134 / 12) {
            lohnsteuer = (lohnsteuerBasis - (11693 / 12)) * 0.20;
        } else if (lohnsteuerBasis <= 32075 / 12) {
            lohnsteuer = (7441 / 12 * 0.20) + (lohnsteuerBasis - (19134 / 12)) * 0.30;
        } else {
            lohnsteuer = (7441 / 12 * 0.20) + (12941 / 12 * 0.30) + (lohnsteuerBasis - (32075 / 12)) * 0.40;
        }
    }
    if (lohnsteuer < 0) lohnsteuer = 0;

    var nettoLohn = Math.max(0, bruttoVerdienst - svBeitrag - lohnsteuer);
    var gesamtNettoVorschau = nettoLohn + diaetenGesamt + naechtGesamt;

    document.getElementById('l-grund-std').innerText = grundStunden.toFixed(2) + " h";
    document.getElementById('l-uest-gesamt').innerText = uestGesamt.toFixed(2) + " h";
    document.getElementById('l-za-gebuche').innerText = zaGebucht.toFixed(2) + " h";
    document.getElementById('l-uest-auszahl').innerText = uestAuszahlung.toFixed(2) + " h";
    
    document.getElementById('l-brutto').innerText = bruttoVerdienst.toLocaleString('de-AT', {minimumFractionDigits: 2}) + " €";
    document.getElementById('l-diaeten').innerText = diaetenGesamt.toLocaleString('de-AT', {minimumFractionDigits: 2}) + " €";
    document.getElementById('l-naecht').innerText = naechtGesamt.toLocaleString('de-AT', {minimumFractionDigits: 2}) + " €";
    document.getElementById('l-gesamt').innerText = gesamtNettoVorschau.toLocaleString('de-AT', {minimumFractionDigits: 2}) + " €";
}

// ==========================================================================
// 📤 ADMINISTRATIVE CHEF-EXCEL-SCHNITTSTELLE (CSV-IMPORT & TEXT-EXPORT)
// ==========================================================================
function importiereCSV() {
    var fileInput = document.getElementById('csv-file');
    if (!fileInput.files.length) return alert("Bitte wähle zuerst eine CSV-Datei aus!");

    var file = fileInput.files[0];
    var reader = new FileReader();

    reader.onload = function(e) {
        var text = e.target.result;
        var zeilen = text.split('\n');
        var geladeneTage = 0;

        zeilen.forEach(function(zeile) {
            if (!zeile.trim()) return;
            var spalten = zeile.split(';');
            if (spalten.length < 5) return;

            var datumSpalte = spalten[0] ? spalten[0].trim() : "";
            if (!/^\d{2}\.\d{2}\.\d{2}$/.test(datumSpalte)) return;

            var von = spalten[1] ? spalten[1].trim() : "";
            var bis = spalten[2] ? spalten[2].trim() : "";
            var infoText = spalten[4] ? spalten[4].trim() : "";

            var dateParts = datumSpalte.split('.');
            var systemDatum = "20" + dateParts[2] + "-" + dateParts[1] + "-" + dateParts[0];

            var infoStatus = "Arbeit";
            if (infoText.toLowerCase().indexOf("urlaub") !== -1) infoStatus = "Urlaub";
            else if (infoText.toLowerCase().indexOf("sonderurlaub") !== -1) infoStatus = "Sonderurlaub";
            else if (infoText.toLowerCase().indexOf("krank") !== -1) infoStatus = "Krankenstand";
            else if (infoText.toLowerCase().indexOf("frei") !== -1) infoStatus = "Frei";
            else if (infoText.toLowerCase().indexOf("zeitausgleich") !== -1 || infoText.toLowerCase().indexOf("za") !== -1) infoStatus = "Zeitausgleich";

            var netto = parseFloat(spalten[3] ? spalten[3].trim().replace(',', '.') : 0) || 0;
            var uest = netto > 8 ? netto - 8 : 0;

            masterDB[systemDatum] = {
                von: von || "--", bis: bis || "--",
                p_von: "12:00", p_bis: "12:30",
                info: infoStatus, naechstung: "0",
                calc: { netto: netto, uest: uest, gesamt: netto, p: 0.5, diaete: netto > 0 ? 1 : 0, naecht: 0 }
            };
            geladeneTage++;
        });

        alert("📅 IMPORT ERFOLGREICH!\nEs wurden " + geladeneTage + " Tage aus deiner Excel-CSV für den März eingelesen.");
        berechneMonatlicheAbrechnung();

        if (auth.currentUser) {
            var userEmail = auth.currentUser.email;
            var bereinigteEmail = userEmail.replace(/\./g, '_');
            db.collection("monate").doc(bereinigteEmail).set({
                daten: JSON.stringify(masterDB)
            }).then(() => console.log("☁️ CSV-Cloud-Backup aktiv."));
        }
    };
    reader.readAsText(file, "UTF-8");
}

function generiereExcelText() {
    var lines = [];
    for (var tag in masterDB) {
        if (masterDB.hasOwnProperty(tag)) {
            var d = masterDB[tag];
            lines.push(tag + "\t" + d.von + "\t" + d.bis + "\t" + d.calc.netto + "\t" + d.info);
        }
    }
    document.getElementById('export-text-area').value = lines.join("\n");
    document.getElementById('export-card').style.style.display = "block";
}

// Start-Trigger beim App-Boot
window.addEventListener("DOMContentLoaded", () => {
    initAppVersionTicker();
    ladeTag();
});
