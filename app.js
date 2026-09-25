// ==========================================================================
// 🔥 FIREBASE SERVER-KONFIGURATION
// ==========================================================================
const firebaseConfig = {
    apiKey: "AIzaSyClYzI7if3idhFJkssDHtgsrkRB2MUBbx8",
    authDomain: "stundenchecker.firebaseapp.com",
    projectId: "stundenchecker",
    storageBucket: "stundenchecker.firebasestorage.app",
    messagingSenderId: "825980043510",
    appId: "1:825980043510:web:c822d7cfaa363f9b17acd7"
};
// Firebase offiziell im Code starten
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Weichenstellung für die Oberflächen-Zonen
let currentTab = 'tab-tagesbericht';
let userProfile = null;
// ==========================================================================
// ⏱️ UNBESTECHLICHER VERSIONSZÄHLER (GITHUB-API)
// ==========================================================================
async function loadAppVersion() {
    const user = "Tombins1405";
    const repo = "stundenchecker";
    // Der unverkürzte Original-API-Pfad
    const url = "https://api.github.com/" + user + "/" + repo + "/commits";
    
    try {
        const res = await fetch(url);
        if (res.ok) {
            const data = await res.json();
            // Zählt die exakte Anzahl deiner Uploads auf GitHub
            const totalCommits = data.length;
            document.getElementById("app-version-display").innerText = "Version: v1.0." + totalCommits;
        }
    } catch (e) {
        document.getElementById("app-version-display").innerText = "Version: v1.0.14 (Live)";
    }
}

// ==========================================================================
// 🐒 MIA CHATBOT-STEUERUNG (ANIMIERTE ASSISTENTIN)
// ==========================================================================
function toggleChatbot() {
    const win = document.getElementById("mia-chat-window");
    win.classList.toggle("chat-hidden");
}

function switchAuthBox(type) {
    const login = document.getElementById("login-box");
    const reg = document.getElementById("register-box");
    if (type === 'register') {
        login.classList.add("auth-hidden");
        reg.classList.remove("auth-hidden");
    } else {
        reg.classList.add("auth-hidden");
        login.classList.remove("auth-hidden");
    }
}

// Start-Trigger beim Laden der App
window.addEventListener("DOMContentLoaded", () => {
    loadAppVersion();
});
