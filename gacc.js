import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, collection, doc, getDocs, writeBatch, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

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

let allCards = [];
let currentPath = { team: null, year: null, brand: null, series: null };
let currentLevel = 'teams';

// --- ADATBETÖLTÉS ---
async function loadCollection() {
    try {
        const querySnapshot = await getDocs(collection(db, "cards"));
        allCards = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        updateDashboard();
        renderView();
    } catch (e) { console.error("Hiba:", e); }
}

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

// --- CSV IMPORT (A beküldött card_collection_export.csv alapján) ---
async function handleCSV(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
        const rows = event.target.result.split(/\r?\n/).filter(r => r.trim() !== "");
        const dataRows = rows.slice(1); // Fejléc: Csapat;Ev;Brand;Sorozat;KartyaSzam;Kartya;Megvan
        
        let batch = writeBatch(db);
        let count = 0;

        for (const row of dataRows) {
            const p = row.split(";").map(s => s.trim().replace(/^["']|["']$/g, ''));
            if (p.length < 7) continue;

            // PONTOS INDEXELÉS A FÁJLOD ALAPJÁN
            const [c_team, c_year, c_brand, c_series, c_num, c_nameRaw, c_owned] = p;

            // Kártyanév bontása (pl. "Base /99" -> Base és 99)
            const nameParts = c_nameRaw.split(/\s\/\s|\//);
            const baseName = nameParts[0].trim();
            const printRun = nameParts[1] ? nameParts[1].trim() : "";

            // Unique ID generálás
            const key = `${c_year}-${c_brand}-${c_series}-${c_num}-${baseName}`.replace(/[^a-zA-Z0-9]/g, '_');
            
            batch.set(doc(db, "cards", key), {
                team: c_team || "Ismeretlen",
                year: c_year || "N/A",
                brand: c_brand || "Ismeretlen",
                series: c_series || "N/A",
                cardNumber: c_num || "?",
                baseName: baseName,
                printRun: printRun,
                owned: c_owned.toUpperCase() === "TRUE" || c_owned.toUpperCase() === "IGAZ",
                updatedAt: serverTimestamp()
            });

            count++;
            if (count % 500 === 0) { await batch.commit(); batch = writeBatch(db); }
        }
        await batch.commit();
        alert("Import kész! " + count + " kártya frissítve.");
        loadCollection();
    };
    reader.readAsText(file, "UTF-8");
}

// --- MEGJELENÍTÉS (Team -> Year -> Brand -> Series) ---
function renderView() {
    const container = document.getElementById("folderContainer");
    const breadcrumb = document.getElementById("breadcrumb");
    if (!container) return;
    
    container.innerHTML = "";
    container.className = "folder-grid";
    updateBreadcrumb(breadcrumb);

    if (currentLevel === 'teams') {
        const teams = [...new Set(allCards.map(c => c.team))].filter(Boolean).sort();
        teams.forEach(t => createFolder(t, "🏀", () => { currentPath.team = t; currentLevel = 'years'; renderView(); }));
    } else if (currentLevel === 'years') {
        const filtered = allCards.filter(c => c.team === currentPath.team);
        const years = [...new Set(filtered.map(c => c.year))].filter(Boolean).sort().reverse();
        years.forEach(y => createFolder(y, "📅", () => { currentPath.year = y; currentLevel = 'brands'; renderView(); }));
    } else if (currentLevel === 'brands') {
        const filtered = allCards.filter(c => c.team === currentPath.team && c.year === currentPath.year);
        const brands = [...new Set(filtered.map(c => c.brand))].filter(Boolean).sort();
        brands.forEach(b => createFolder(b, "🏢", () => { currentPath.brand = b; currentLevel = 'series'; renderView(); }));
    } else if (currentLevel === 'series') {
        const filtered = allCards.filter(c => c.team === currentPath.team && c.year === currentPath.year && c.brand === currentPath.brand);
        const series = [...new Set(filtered.map(c => c.series))].filter(Boolean).sort();
        series.forEach(s => createFolder(s, "🏷️", () => { currentPath.series = s; currentLevel = 'cards'; renderView(); }));
    } else if (currentLevel === 'cards') {
        const cards = allCards.filter(c => c.team === currentPath.team && c.year === currentPath.year && c.brand === currentPath.brand && c.series === currentPath.series);
        container.className = "card-grid";
        cards.sort((a,b) => String(a.cardNumber).localeCompare(String(b.cardNumber), undefined, {numeric:true})).forEach(c => {
            const div = document.createElement("div");
            div.className = `card-item ${c.owned ? 'owned' : ''}`;
            div.innerHTML = `<div><strong>#${c.cardNumber}</strong> ${c.baseName}</div><div class="card-meta">${c.printRun ? '/' + c.printRun : ''}</div>`;
            container.appendChild(div);
        });
    }
}

function createFolder(name, emoji, onClick) {
    const div = document.createElement("div");
    div.className = "folder"; div.onclick = onClick;
    div.innerHTML = `<div class="folder-icon">${emoji}</div><div class="folder-name">${name}</div>`;
    document.getElementById("folderContainer").appendChild(div);
}

function updateBreadcrumb(el) {
    el.innerHTML = `<span onclick="resetNav()">Kezdőlap</span>`;
    if (currentPath.team) el.innerHTML += ` / <span onclick="goToLevel('years')">${currentPath.team}</span>`;
    if (currentPath.year) el.innerHTML += ` / <span onclick="goToLevel('brands')">${currentPath.year}</span>`;
    if (currentPath.brand) el.innerHTML += ` / <span onclick="goToLevel('series')">${currentPath.brand}</span>`;
    if (currentPath.series) el.innerHTML += ` / <span class="active">${currentPath.series}</span>`;
}

window.resetNav = () => { currentPath = { team: null, year: null, brand: null, series: null }; currentLevel = 'teams'; renderView(); };
window.goToLevel = (lvl) => { 
    currentLevel = lvl; 
    if(lvl==='years') currentPath.year = currentPath.brand = currentPath.series = null;
    if(lvl==='brands') currentPath.brand = currentPath.series = null;
    renderView(); 
};

// --- KERESÉS ---
document.getElementById("searchInput")?.addEventListener("input", (e) => {
    const term = e.target.value.toLowerCase();
    const container = document.getElementById("folderContainer");
    if (!term) { renderView(); return; }
    
    const filtered = allCards.filter(c => c.baseName.toLowerCase().includes(term) || c.year.toLowerCase().includes(term) || c.brand.toLowerCase().includes(term));
    container.innerHTML = "";
    container.className = "card-grid";
    filtered.forEach(c => {
        const div = document.createElement("div");
        div.className = `card-item ${c.owned ? 'owned' : ''}`;
        div.innerHTML = `<div><strong>#${c.cardNumber}</strong> ${c.baseName} (${c.year})</div><div class="card-meta">${c.printRun ? '/' + c.printRun : ''}</div>`;
        container.appendChild(div);
    });
});

document.addEventListener("DOMContentLoaded", () => {
    loadCollection();
    document.getElementById("csvInput")?.addEventListener("change", handleCSV);
});