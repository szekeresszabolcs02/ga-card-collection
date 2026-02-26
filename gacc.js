import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, collection, doc, getDocs, writeBatch, serverTimestamp, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

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

// Adatok betöltése
async function loadCollection() {
    try {
        const querySnapshot = await getDocs(collection(db, "cards"));
        allCards = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        updateDashboard();
        renderView();
    } catch (e) {
        console.error("Hiba a betöltésnél:", e);
    }
}

// Statisztikák frissítése
function updateDashboard() {
    const total = allCards.length;
    const owned = allCards.filter(c => c.owned === true).length;
    const percent = total === 0 ? 0 : Math.round((owned / total) * 100);
    
    document.getElementById("totalCount").textContent = total;
    document.getElementById("ownedCount").textContent = owned;
    document.getElementById("missingCount").textContent = total - owned;
    document.getElementById("percentCount").textContent = percent + "%";
    document.getElementById("globalProgress").style.width = percent + "%";
}

// --- KERESŐ FUNKCIÓ (Most már benne van!) ---
function setupSearch() {
    const searchInput = document.getElementById("searchInput");
    if (!searchInput) return;

    searchInput.addEventListener("input", (e) => {
        const term = e.target.value.toLowerCase().trim();
        const container = document.getElementById("folderContainer");

        if (term === "") {
            renderView(); // Ha üres, visszatérünk a mappákhoz
            return;
        }

        const filtered = allCards.filter(c => 
            (c.baseName && c.baseName.toLowerCase().includes(term)) || 
            (c.brand && c.brand.toLowerCase().includes(term)) ||
            (c.year && c.year.toString().includes(term))
        );

        container.innerHTML = "";
        container.className = "card-grid";
        
        if (filtered.length === 0) {
            container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #94a3b8;">Nincs találat: "${term}"</div>`;
            return;
        }

        filtered.forEach(c => renderSingleCard(c, container));
    });
}

// Navigáció és Mappák megjelenítése
function renderView() {
    const container = document.getElementById("folderContainer");
    if (!container) return;
    container.innerHTML = "";
    container.className = "folder-grid";
    updateBreadcrumb();

    if (currentLevel === 'teams') {
        const teams = [...new Set(allCards.map(c => c.team))].filter(Boolean).sort();
        teams.forEach(t => createFolder(t, true, null, () => { 
            currentPath.team = t; currentLevel = 'years'; renderView(); 
        }));
    } else if (currentLevel === 'years') {
        const filtered = allCards.filter(c => c.team === currentPath.team);
        const years = [...new Set(filtered.map(c => c.year))].filter(Boolean).sort().reverse();
        years.forEach(y => createFolder(y, false, "🗓️", () => { 
            currentPath.year = y; currentLevel = 'brands'; renderView(); 
        }));
    } else if (currentLevel === 'brands') {
        const filtered = allCards.filter(c => c.team === currentPath.team && c.year == currentPath.year);
        const brands = [...new Set(filtered.map(c => c.brand))].sort();
        brands.forEach(b => createFolder(b, false, "🏦", () => { 
            currentPath.brand = b; currentLevel = 'series'; renderView(); 
        }));
    } else if (currentLevel === 'series') {
        const filtered = allCards.filter(c => c.team === currentPath.team && c.year == currentPath.year && c.brand === currentPath.brand);
        const series = [...new Set(filtered.map(c => c.series))].sort();
        series.forEach(s => createFolder(s, false, "🏀", () => { 
            currentPath.series = s; currentLevel = 'cards'; renderView(); 
        }));
    } else if (currentLevel === 'cards') {
        renderCards(container);
    }
}

function createFolder(name, isTeam, emoji, onClick) {
    const div = document.createElement("div");
    div.className = "folder";
    const config = isTeam ? (teamConfig[name] || teamConfig.default) : teamConfig.default;
    div.style.setProperty('--team-color', config.color);
    div.onclick = onClick;

    let content = `<div class="folder-tab"></div>`;
    if (isTeam) {
        content += `<img src="${config.logo}" class="folder-logo" onerror="this.src='nba.png'"><div class="folder-name">${name}</div>`;
    } else {
        content += `<div style="font-size:40px; margin-bottom:10px;">${emoji}</div><div class="folder-name">${name}</div>`;
    }
    div.innerHTML = content;
    document.getElementById("folderContainer").appendChild(div);
}

function renderCards(container) {
    const cards = allCards.filter(c => 
        c.team === currentPath.team && 
        c.year == currentPath.year && 
        c.brand === currentPath.brand && 
        c.series === currentPath.series
    );
    container.innerHTML = "";
    container.className = "card-grid";
    cards.sort((a,b) => String(a.cardNumber).localeCompare(String(b.cardNumber), undefined, {numeric:true}))
         .forEach(c => renderSingleCard(c, container));
}

// --- EGY KÁRTYA MEGJELENÍTÉSE (Ez hiányzott!) ---
function renderSingleCard(c, container) {
    const div = document.createElement("div");
    // Ha megvan a kártya, megkapja az 'owned' osztályt a stílushoz
    div.className = `card-item ${c.owned ? 'owned' : ''}`;
    
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

    // Interaktív pipa kezelés
    const checkbox = div.querySelector('input');
    checkbox.addEventListener('change', (e) => {
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

function updateBreadcrumb() {
    const el = document.getElementById("breadcrumb");
    if (!el) return;
    el.innerHTML = `<span onclick="resetNav()">Gyűjtemény</span>`;
    if (currentPath.team) el.innerHTML += ` / <span onclick="goToLevel('years')">${currentPath.team}</span>`;
    if (currentPath.year) el.innerHTML += ` / <span onclick="goToLevel('brands')">${currentPath.year}</span>`;
    if (currentPath.brand) el.innerHTML += ` / <span onclick="goToLevel('series')">${currentPath.brand}</span>`;
}

window.resetNav = () => { 
    currentPath = { team: null, year: null, brand: null, series: null }; 
    currentLevel = 'teams'; 
    renderView(); 
};

window.goToLevel = (lvl) => { 
    currentLevel = lvl; 
    if(lvl==='years') { currentPath.year=null; currentPath.brand=null; currentPath.series=null; }
    if(lvl==='brands') { currentPath.brand=null; currentPath.series=null; }
    renderView(); 
};

// CSV Import
async function handleCSV(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
        const rows = event.target.result.split(/\r?\n/).filter(r => r.trim() !== "").slice(1);
        const batch = writeBatch(db);
        rows.forEach(row => {
            const p = row.split(";").map(s => s.trim());
            if (p.length < 7) return;
            const [team, year, brand, series, cardNum, cardRaw, ownedStr] = p;
            const name = cardRaw.split("/")[0].trim();
            const key = `${year}-${brand}-${series}-${cardNum}-${name}`.replace(/[^a-zA-Z0-9]/g, '_');
            batch.set(doc(db, "cards", key), {
                team, year, brand, series, cardNumber: cardNum, baseName: name,
                owned: ownedStr.toUpperCase() === "TRUE" || ownedStr.toUpperCase() === "IGAZ",
                updatedAt: serverTimestamp()
            });
        });
        await batch.commit();
        loadCollection();
    };
    reader.readAsText(file);
}

document.addEventListener("DOMContentLoaded", () => {
    loadCollection();
    setupSearch(); // Ez most már működni fog!
    document.getElementById("csvInput")?.addEventListener("change", handleCSV);
});