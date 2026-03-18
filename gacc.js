import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, collection, doc, getDocs, writeBatch, serverTimestamp, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// --- FIREBASE KONFIGURÁCIÓ ---
const firebaseConfig = {
    apiKey: "AIzaSyBd--_OmOvCXTfuAQ-D96IS6NgRssCMavg",
    authDomain: "grayson-card-collection.firebaseapp.com",
    projectId: "grayson-card-collection",
    storageBucket: "grayson-card-collection.firebasestorage.app",
    messagingSenderId: "868175520778",
    appId: "1:868175520778:web:0cabbf5d88912c35aaabf3"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --- CSAPAT KONFIGURÁCIÓ ---
const teamConfig = {
    "Memphis Grizzlies": { color: "#5D76A9", logo: "grizzlies.png" },
    "Milwaukee Bucks": { color: "#00471B", logo: "bucks.png" },
    "Phoenix Suns": { color: "#E56020", logo: "suns.png" },
    "Utah Jazz": { color: "#002B5C", logo: "jazz.png" },
    "default": { color: "#334155", logo: "nba.png" }
};

let allCards = [];
let currentPath = { team: null, year: null, brand: null, series: null };
let currentLevel = 'teams';

// --- ADATOK BETÖLTÉSE ---
async function loadCollection() {
    try {
        const querySnapshot = await getDocs(collection(db, "cards"));
        allCards = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        updateDashboard();
        renderView();
    } catch (e) {
        console.error("Betöltési hiba:", e);
    }
}

// --- DASHBOARD FRISSÍTÉSE ---
function updateDashboard() {
    const total = allCards.length;
    const owned = allCards.filter(c => c.owned === true).length;
    const missing = total - owned;
    const percent = total === 0 ? 0 : Math.round((owned / total) * 100);

    const totalEl = document.getElementById("totalCount");
    const ownedEl = document.getElementById("ownedCount");
    const missingEl = document.getElementById("missingCount");
    const percentEl = document.getElementById("percentCount");
    const barEl = document.getElementById("globalProgress");

    if (totalEl) totalEl.textContent = total;
    if (ownedEl) ownedEl.textContent = owned;
    if (missingEl) missingEl.textContent = missing;
    if (percentEl) percentEl.textContent = percent + "%";
    if (barEl) barEl.style.width = percent + "%";
}

// --- KERESÉS ---
function setupSearch() {
    const searchInput = document.getElementById("searchInput");
    if (!searchInput) return;

    searchInput.addEventListener("input", (e) => {
        const term = e.target.value.toLowerCase().trim();
        const container = document.getElementById("folderContainer");

        if (term === "") {
            renderView();
            return;
        }

        const filtered = allCards.filter(c => 
            (c.baseName && c.baseName.toLowerCase().includes(term)) || 
            (c.brand && c.brand.toLowerCase().includes(term)) ||
            (c.year && c.year.toString().includes(term)) ||
            (c.series && c.series.toLowerCase().includes(term))
        );

        container.innerHTML = "";
        container.className = "card-grid";
        
        filtered.forEach(c => renderSingleCard(c, container));
    });
}

// --- DINAMIKUS NAVIGÁCIÓ (BREADCRUMB) JAVÍTÁSA ---
function updateBreadcrumb() {
    const container = document.getElementById("breadcrumbContainer");
    if (!container) return;
    container.innerHTML = "";

    // 1. HOME
    const homeSpan = document.createElement("span");
    homeSpan.textContent = "HOME";
    homeSpan.onclick = () => resetNav();
    container.appendChild(homeSpan);

    // 2. CSAPAT SZINT
    if (currentPath.team) {
        appendCrumb(container, currentPath.team, () => {
            currentPath.year = null; currentPath.brand = null; currentPath.series = null;
            currentLevel = 'years'; renderView();
        });
    }

    // 3. ÉV SZINT
    if (currentPath.year) {
        appendCrumb(container, currentPath.year, () => {
            currentPath.brand = null; currentPath.series = null;
            currentLevel = 'brands'; renderView();
        });
    }

    // 4. MÁRKA SZINT
    if (currentPath.brand) {
        appendCrumb(container, currentPath.brand, () => {
            currentPath.series = null;
            currentLevel = 'series'; renderView();
        });
    }

    // Aktuális elem megjelölése
    if (container.lastElementChild) {
        container.lastElementChild.classList.add("active-crumb");
    }
}

function appendCrumb(container, text, onClick) {
    const sep = document.createElement("span");
    sep.textContent = " / ";
    sep.className = "separator";
    container.appendChild(sep);

    const span = document.createElement("span");
    span.textContent = text.toString().toUpperCase();
    span.onclick = onClick;
    container.appendChild(span);
}

// --- NÉZET KEZELÉSE ---
function renderView() {
    const container = document.getElementById("folderContainer");
    if (!container) return;
    container.innerHTML = "";
    container.className = "folder-grid";
    updateBreadcrumb();

    if (currentLevel === 'teams') {
        const teams = [...new Set(allCards.map(c => c.team))].sort();
        teams.forEach(t => createFolder(t, true, null, () => { 
            currentPath.team = t; currentLevel = 'years'; renderView(); 
        }));
    } else if (currentLevel === 'years') {
        const filtered = allCards.filter(c => c.team === currentPath.team);
        const years = [...new Set(filtered.map(c => c.year))].filter(Boolean).sort().reverse();
        years.forEach(y => createFolder(y, false, "📅", () => { 
            currentPath.year = y; currentLevel = 'brands'; renderView(); 
        }));
    } else if (currentLevel === 'brands') {
        const filtered = allCards.filter(c => c.team === currentPath.team && c.year == currentPath.year);
        const brands = [...new Set(filtered.map(c => c.brand))].sort();
        brands.forEach(b => createFolder(b, false, "🏢", () => { 
            currentPath.brand = b; currentLevel = 'series'; renderView(); 
        }));
    } else if (currentLevel === 'series') {
        const filtered = allCards.filter(c => c.team === currentPath.team && c.year == currentPath.year && c.brand === currentPath.brand);
        const series = [...new Set(filtered.map(c => c.series))].sort();
        series.forEach(s => createFolder(s, false, "🏷️", () => { 
            currentPath.series = s; currentLevel = 'cards'; renderView(); 
        }));
    } else if (currentLevel === 'cards') {
        renderCards(container);
    }
}

// --- MAPPA GENERÁLÁSA ---
function createFolder(name, isTeam, emoji, onClick) {
    const div = document.createElement("div");
    div.className = "folder metal-bg";
    
    div.onclick = onClick;

    let content = "";
    if (isTeam) {
        const config = teamConfig[name] || teamConfig.default;
        const count = allCards.filter(c => c.team === name).length;
        content = `
            <img src="${config.logo}" class="folder-logo" onerror="this.src='nba.png'">
            <div class="folder-name">${name.toUpperCase()}</div>
            <div class="folder-count">${count} CARDS</div>
        `;
    } else {
        content = `
            <div style="font-size:40px; margin-bottom:10px;">${emoji}</div>
            <div class="folder-name">${name.toUpperCase()}</div>
        `;
    }
    
    div.innerHTML = content;
    document.getElementById("folderContainer").appendChild(div);
}

// --- KÁRTYÁK LISTÁZÁSA ---
function renderCards(container) {
    const cards = allCards.filter(c => 
        c.team === currentPath.team && 
        c.year == currentPath.year && 
        c.brand === currentPath.brand && 
        c.series === currentPath.series
    );
    
    container.innerHTML = "";
    container.className = "card-grid";

    cards.sort((a, b) => {
        const runA = parseInt(a.printRun) || 0;
        const runB = parseInt(b.printRun) || 0;
        if (runA === 0 && runB === 0) {
            return String(a.cardNumber).localeCompare(String(b.cardNumber), undefined, {numeric:true});
        }
        if (runA === 0) return -1;
        if (runB === 0) return 1;
        return runB - runA; 
    });

    cards.forEach(c => renderSingleCard(c, container));
}

function renderSingleCard(c, container) {
    const div = document.createElement("div");
    const isNumbered = c.printRun ? 'numbered-card' : '';
    div.className = `card-item ${c.owned ? 'owned' : ''} ${isNumbered}`.trim();
    
    const checkboxId = `check-${c.id}`; 
    div.innerHTML = `
        <div class="card-info">
            <input type="checkbox" id="${checkboxId}" ${c.owned ? 'checked' : ''} class="card-checkbox">
            <label for="${checkboxId}" style="display: flex; flex-direction: column; cursor: pointer;">
                <div style="display: flex; align-items: center; gap: 15px;">
                    <span class="card-num">#${c.cardNumber}</span>
                    <span class="card-name">${c.baseName}</span>
                </div>
                <span class="card-subtext">${c.year} | ${c.brand} | ${c.series}</span>
            </label>
        </div>
        <div class="card-meta">${c.printRun ? '/' + c.printRun : ''}</div>
    `;

    div.querySelector('input').addEventListener('change', (e) => {
        toggleOwnedStatus(c.id, e.target.checked, div);
    });

    container.appendChild(div);
}

async function toggleOwnedStatus(cardId, isOwned, element) {
    try {
        await updateDoc(doc(db, "cards", cardId), {
            owned: isOwned,
            updatedAt: serverTimestamp()
        });
        const card = allCards.find(c => c.id === cardId);
        if (card) card.owned = isOwned;
        isOwned ? element.classList.add('owned') : element.classList.remove('owned');
        updateDashboard();
    } catch (e) {
        console.error("Mentési hiba:", e);
    }
}

window.resetNav = () => { 
    currentPath = { team: null, year: null, brand: null, series: null }; 
    currentLevel = 'teams'; 
    renderView(); 
};

document.addEventListener("DOMContentLoaded", () => {
    loadCollection();
    setupSearch();
});

// Menü kapcsoló (Toggle)
window.toggleAdminMenu = (event) => {
    event.stopPropagation(); // Megállítja az eseményt, hogy ne záródjon be azonnal
    const dropdown = document.getElementById("adminDropdown");
    dropdown.classList.toggle("show");
};

// Menü bezárása, ha máshová kattintasz
document.addEventListener("click", () => {
    const dropdown = document.getElementById("adminDropdown");
    if (dropdown) dropdown.classList.remove("show");
});

// CSV Import eseménykezelő összekötése
document.addEventListener("DOMContentLoaded", () => {
    const csvInput = document.getElementById("csvInput");
    if (csvInput) {
        csvInput.addEventListener("change", handleCSV);
    }
});
