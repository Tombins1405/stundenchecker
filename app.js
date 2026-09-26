// ==========================================================================
// 🔥 FIREBASE SERVER-KONFIGURATION
// ==========================================================================
const firebaseConfig = {
    apiKey: "AIzaSyBsN7lV8p9R_RjE9h1vMvY0m-K_L7c8W2k",
    authDomain: "stundenchecker.firebaseapp.com",
    projectId: "stundenchecker",
    storageBucket: "stundenchecker.firebasestorage.app",
    messagingSenderId: "1234567890",
    appId: "1:1234567890:web:abcdef"
};

// Firebase offiziell im Code starten
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Weichenstellung für die Oberflächen-Zonen
let currentTab = 'tab-tagesbericht';
let userProfile = null;

// ==========================================================================
// ⏱️ UNBESTECHLICHER VERSIONSZÄHLER (GITHUB-API REPARIERT)
// ==========================================================================
async function loadAppVersion() {
    const user = "Tombins1405";
    const repo = "stundenchecker";
    const url = "https://api.github.com/repos/" + user + "/" + repo + "/commits";
    
    try {
        const res = await fetch(url);
        if (res.ok) {
            const data = await res.json();
            const totalCommits = data.length;
            document.getElementById("app-version-display").innerText = "Version: v1.0." + totalCommits;
        }
    } catch (e) {
        document.getElementById("app-version-display").innerText = "Version: v1.0.14 (Live)";
    }
}

// ==========================================================================
// 🐒 MIA CHATBOT-STEUERUNG (ANIMATION & FUNKTION)
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

// Paket-Auswahl im 3D-Karussell visualisieren
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

// Start-Trigger beim Laden der App
window.addEventListener("DOMContentLoaded", () => {
    loadAppVersion();
});
