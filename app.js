// ==========================================================================
// 🔥 FIREBASE SERVER-KONFIGURATION (AUS THOMAS ORIGINAL-SKRIPT)
// ==========================================================================
const firebaseConfig = {
    apiKey: "AIzaSyA5Hw0oY4WRbZErr0F7Y8umC6S7wmFqWxI",
    authDomain: "://firebaseapp.com",
    projectId: "stunden-checker",
    storageBucket: "stunden-checker.firebasestorage.app",
    messagingSenderId: "1086750675976",
    appId: "1:1086750675976:web:141b66edcdc14261ce6dbd"
};
firebase.initializeApp(firebaseConfig);

// Globale System-Variablen
var masterDB = {};
var aktuellerUser = null;
var carouselAngle = 0; // Steuert die Rotation des 3D-Cubes

// ==========================================================================
// 📦 3D-CUBE-KARUSSELL STEUERUNG (KLICK & WISCH-EFFEKT)
// ==========================================================================
function rotateCarousel(direction) {
    const carousel = document.querySelector('.carousel-3d');
    const cards = document.querySelectorAll('.carousel-card');
    
    if (direction === 'next') {
        carouselAngle -= 120; // Dreht um 120 Grad weiter (3 Karten = 360 Grad)
    } else {
        carouselAngle += 120;
    }
    
    carousel.style.transform = `rotateY(${carouselAngle}deg)`;
    
    // Berechnet mathematisch, welche Karte nach dem Drehen vorne steht
    let normalizedAngle = ((carouselAngle % 360) + 360) % 360;
    cards.forEach(card => card.classList.remove('active'));
    
    if (normalizedAngle === 0) {
        document.querySelector('.card-basis').classList.add('active');
    } else if (normalizedAngle === 240 || normalizedAngle === -120) {
        document.querySelector('.card-premium').classList.add('active');
    } else if (normalizedAngle === 120 || normalizedAngle === -240) {
        document.querySelector('.card-test').classList.add('active');
    }
}

// Erkennung für das Auswählen einer Karte per Direktklick
function selectPackage(type) {
    const cards = document.querySelectorAll('.carousel-card');
    cards.forEach(card => card.classList.remove('active'));
    
    const carousel = document.querySelector('.carousel-3d');
    if (type === 'basis') {
        carouselAngle = 0;
        document.querySelector('.card-basis').classList.add('active');
    } else if (type === 'premium') {
        carouselAngle = -120;
        document.querySelector('.card-premium').classList.add('active');
    } else if (type === 'test') {
        carouselAngle = -240;
        document.querySelector('.card-test').classList.add('active');
    }
    carousel.style.transform = `rotateY(${carouselAngle}deg)`;
}
// ==========================================================================
// 📱 HANDY-WISCHGESTEN-ERKENNUNG (TOUCH-STEUTERUNG)
// ==========================================================================
let touchStartX = 0;
let touchEndX = 0;

function handleTouchStart(e) {
    touchStartX = e.changedTouches[0].screenX;
}

function handleTouchEnd(e) {
    touchEndX = e.changedTouches[0].screenX;
    handleSwipe();
}

function handleSwipe() {
    const swipeThreshold = 50; // Mindestweite für den Wisch in Pixeln
    if (touchEndX < touchStartX - swipeThreshold) {
        rotateCarousel('next'); // Nach links gewischt -> Nächste Karte
    }
    if (touchEndX > touchStartX + swipeThreshold) {
        rotateCarousel('prev'); // Nach rechts gewischt -> Vorherige Karte
    }
}

// ==========================================================================
// 🐒 MIA CHATBOT-STEUERUNG (ANIMATION & SPRECHBLASE)
// ==========================================================================
function toggleChatbot() {
    const bubble = document.getElementById("mia-speech-bubble");
    bubble.classList.toggle("hidden");
}

function sendMessageToMia() {
    const input = document.getElementById("chat-input-field");
    const output = document.getElementById("chat-output");
    const text = input.value.trim();
    if (!text) return;
    
    // Benutzernachricht anzeigen
    output.innerText = text;
    input.value = "";
    
    // Unbestechliche, lernfähige Antwort von Mia
    setTimeout(() => {
        output.innerText = "🐒 Uh-Ah! Ich lerne gerade deine Arbeitszeiten. Sobald du eingeloggt bist, wache ich über deinen Lohnzettel! Frag mich ruhig zu den Abos.";
    }, 1000);
}

function handleChatKey(e) {
    if (e.key === 'Enter') sendMessageToMia();
}

// ==========================================================================
// 🔐 INTERNE WEICHEN: ANMELDUNG VS. REGISTRIERUNG
// ==========================================================================
function switchAuthBox(type) {
    const loginBox = document.getElementById("login-box");
    const regBox = document.getElementById("register-box");
    if (type === 'register') {
        loginBox.classList.add("hidden");
        regBox.classList.remove("hidden");
    } else {
        regBox.classList.add("hidden");
        loginBox.classList.remove("hidden");
    }
}
// ==========================================================================
// 👀 PASSWORT-AUGE & SABINES WÄCHTER-ÄFFCHEN
// ==========================================================================
function togglePasswordVisibility(id) {
    const input = document.getElementById(id);
    const eyeIcon = id === 'login-password' ? document.getElementById('eye-icon-login') : document.getElementById('eye-icon-register');
    const monkey = id === 'login-password' ? document.getElementById('monkey-auth-login') : document.getElementById('monkey-auth-register');
    
    if (input.type === "password") {
        input.type = "text";
        eyeIcon.classList.remove("fa-eye");
        eyeIcon.classList.add("fa-eye-slash");
        monkey.innerText = "🙊"; // Macht die Ohren zu beim Hinsehen
    } else {
        input.type = "password";
        eyeIcon.classList.remove("fa-eye-slash");
        eyeIcon.classList.add("fa-eye");
        monkey.innerText = "🐒"; // Normales Äffchen
    }
}

// Überprüfung der Passwortstärke für das Registrierungs-Äffchen
function validatePasswordStrength() {
    const pass = document.getElementById("register-password").value;
    const monkey = document.getElementById("monkey-auth-register");
    const box = document.getElementById("register-box");
    
    if (pass.length === 0) {
        monkey.innerText = "🐒";
        box.style.borderColor = "#1e293b";
    } else if (pass.length < 6) {
        monkey.innerText = "🙈"; // Hält sich vor Schreck die Augen zu
        box.style.borderColor = "#ef4444"; // Sanftes Alarm-Rot
    } else {
        monkey.innerText = "😎"; // Cooles Äffchen bei starkem Passwort
        box.style.borderColor = "#22c55e"; // Signal-Grün
    }
}

// ==========================================================================
// 📊 MATHEMATISCHE RECHEN-FUNKTIONEN (AUS THOMAS ORIGINAL-SKRIPT)
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
// ==========================================================================
// 📅 EXCEL / CSV DATEN-IMPORT & LIVE-BERECHNUNG (ORIGINAL-LOGIK)
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

        var userEmail = firebase.auth().currentUser.email;
        var bereinigteEmail = userEmail.replace(/\./g, '_');
        firebase.firestore().collection("monate").doc(bereinigteEmail).set({
            daten: JSON.stringify(masterDB)
        })
        .then(function() { console.log("☁️ CSV-Daten erfolgreich in der Cloud gesichert!"); })
        .catch(function(error) { console.error("❌ Fehler beim Cloud-Backup: ", error); });
    };
    reader.readAsText(file, "UTF-8");
}

function berechneLive() {
    var von = document.getElementById('von').value; 
    var bis = document.getElementById('bis').value;
    var info = document.getElementById('info').value; 
    var zFelder = document.getElementById('zeit-felder');
    var datum = document.getElementById('datum').value;

    var t = { netto: 0, uest: 0, gesamt: 0, p: 0, diaete: 0, naecht: 0 };

    if (!zFelder) return t; // Sicherheitssperre falls noch im Gastmodus

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
            t = { netto: netto, uest: uest, gesamt: g, p: p, diaete: 1, naecht: nPauschale };
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
    var n = new Date(datum); n.setDate(n.getDate() + 1);
    document.getElementById('datum').value = n.toISOString().substring(0,10);
    ladeTag();
}

function ladeTag() {
    var datum = document.getElementById('datum').value;
    if (!datum || !document.getElementById('von')) return;
    
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

    var zaGebucht = Math.min(uestGesamt, zaSchieber); if(zaGebucht < 0) zaGebucht = 0;
    var uestAuszahlung = Math.max(0, uestGesamt - zaGebucht);
    var bruttoVerdienst = (grundStunden * lohn) + (uestAuszahlung * lohn * 1.5);

    var svBeitrag = bruttoVerdienst * 0.1812; 
    var lohnsteuerBasis = bruttoVerdienst - svBeitrag - 300; var lohnsteuer = 0;

    if (lohnsteuerBasis > 0) {
        if (lohnsteuerBasis <= 11693 / 12) lohnsteuer = 0;
        else if (lohnsteuerBasis <= 19134 / 12) lohnsteuer = (lohnsteuerBasis - (11693 / 12)) * 0.20;
        else if (lohnsteuerBasis <= 32075 / 12) lohnsteuer = (7441 / 12 * 0.20) + (19134 / 12 * 0.30) + (lohnsteuerBasis - (32075 / 12)) * 0.40;
        else lohnsteuer = (7441 / 12 * 0.20) + (12941 / 12 * 0.30) + (30005 / 12 * 0.40) + (lohnsteuerBasis - (62080 / 12)) * 0.48;
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
// 📅 EXCEL / CSV DATEN-IMPORT & LIVE-BERECHNUNG (ORIGINAL-LOGIK)
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

        var userEmail = firebase.auth().currentUser.email;
        var bereinigteEmail = userEmail.replace(/\./g, '_');
        firebase.firestore().collection("monate").doc(bereinigteEmail).set({
            daten: JSON.stringify(masterDB)
        })
        .then(function() { console.log("☁️ CSV-Daten erfolgreich in der Cloud gesichert!"); })
        .catch(function(error) { console.error("❌ Fehler beim Cloud-Backup: ", error); });
    };
    reader.readAsText(file, "UTF-8");
}

function berechneLive() {
    var von = document.getElementById('von').value; 
    var bis = document.getElementById('bis').value;
    var info = document.getElementById('info').value; 
    var zFelder = document.getElementById('zeit-felder');
    var datum = document.getElementById('datum').value;

    var t = { netto: 0, uest: 0, gesamt: 0, p: 0, diaete: 0, naecht: 0 };

    if (!zFelder) return t; // Sicherheitssperre falls noch im Gastmodus

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
            t = { netto: netto, uest: uest, gesamt: g, p: p, diaete: 1, naecht: nPauschale };
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
    var n = new Date(datum); n.setDate(n.getDate() + 1);
    document.getElementById('datum').value = n.toISOString().substring(0,10);
    ladeTag();
}

function ladeTag() {
    var datum = document.getElementById('datum').value;
    if (!datum || !document.getElementById('von')) return;
    
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

    var zaGebucht = Math.min(uestGesamt, zaSchieber); if(zaGebucht < 0) zaGebucht = 0;
    var uestAuszahlung = Math.max(0, uestGesamt - zaGebucht);
    var bruttoVerdienst = (grundStunden * lohn) + (uestAuszahlung * lohn * 1.5);

    var svBeitrag = bruttoVerdienst * 0.1812; 
    var lohnsteuerBasis = bruttoVerdienst - svBeitrag - 300; var lohnsteuer = 0;

    if (lohnsteuerBasis > 0) {
        if (lohnsteuerBasis <= 11693 / 12) lohnsteuer = 0;
        else if (lohnsteuerBasis <= 19134 / 12) lohnsteuer = (lohnsteuerBasis - (11693 / 12)) * 0.20;
        else if (lohnsteuerBasis <= 32075 / 12) lohnsteuer = (7441 / 12 * 0.20) + (19134 / 12 * 0.30) + (lohnsteuerBasis - (32075 / 12)) * 0.40;
        else lohnsteuer = (7441 / 12 * 0.20) + (12941 / 12 * 0.30) + (30005 / 12 * 0.40) + (lohnsteuerBasis - (62080 / 12)) * 0.48;
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

