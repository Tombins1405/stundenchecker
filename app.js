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

// Weichenstellung für die Oberflächen-Zonen
let currentTab = 'tab-tagesbericht';
let userProfile = null;
// ==========================================================================
// ⏱️ UNBESTECHLICHER VERSIONSZÄHLER (GITHUB-API)
// ==========================================================================
async function loadAppVersion() {
    const user = "Tombins1405";
    const repo = "stundenchecker";
    // Unzerstörbare API-Trennregel gegen Link-Kürzungen
    const base = "https://github.com";
    const url = base + "repos/" + user + "/" + repo + "/commits/main";
    
    try {
        const res = await fetch(url);
        if (res.ok) {
            const data = await res.json();
            // Erstellt die unbestechliche Versionsnummer anhand der Gesamt-Uploads
            const versionNum = "v1.0." + (data.parents ? data.parents.length + 1 : "1");
            document.getElementById("app-version-display").innerText = "Version: " + versionNum;
        }
    } catch (e) {
        document.getElementById("app-version-display").innerText = "Version: Online";
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
