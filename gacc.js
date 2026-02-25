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

async function toggleOwnedStatus(cardId, isOwned, element) {
    try {
        const cardRef = doc(db, "cards", cardId);
        
        // 1. Mentés a Firebase-be
        await updateDoc(cardRef, {
            owned: isOwned,
            updatedAt: serverTimestamp()
        });

        // 2. Helyi adat frissítése (hogy a Dashboard is változzon)
        const cardIndex = allCards.findIndex(c => c.id === cardId);
        if (cardIndex !== -1) {
            allCards[cardIndex].owned = isOwned;
        }

        // 3. UI frissítése (színezés váltása)
        if (isOwned) {
            element.classList.add('owned');
        } else {
            element.classList.remove('owned');
        }

        // 4. Dashboard (százalékok) újraszámolása
        updateDashboard();

        console.log(`Kártya frissítve: ${cardId} -> ${isOwned}`);
    } catch (error) {
        console.error("Hiba a mentés során:", error);
        alert("Nem sikerült a mentés, ellenőrizd az internetkapcsolatot!");
    }
}

// Csapat konfiguráció
const teamConfig = {
    "Memphis Grizzlies": { color: "#5D76A9", logo: "assets/logos/grizzlies.png" },
    "Milwaukee Bucks": { color: "#00471B", logo: "assets/logos/bucks.png" },
    "Phoenix Suns": { color: "#E56020", logo: "assets/logos/suns.png" },
    "Utah Jazz": { color: "#002B5C", logo: "assets/logos/jazz.png" },
    "default": { color: "#334155", logo: "assets/logos/nba.png" }
};



let allCards = [];
let currentPath = { team: null, year: null, brand: null, series: null };
let currentLevel = 'teams';

async function loadCollection() {
    const querySnapshot = await getDocs(collection(db, "cards"));
    allCards = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    updateDashboard();
    renderView();
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

const icons = {
    // Évszám helyett: Kosárlabda (A szezon lüktetése)
    year: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 0 1 0 20M2 12h20"/><path d="M7 3.3a14 14 0 0 0 0 17.4M17 3.3a14 14 0 0 1 0 17.4"/></svg>`,
    
    // Brand helyett: Hobby Box (A kártyás doboz sziluettje)
    brand: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8l-9-5-9 5v8l9 5 9-5V8z"/><path d="M3 8l9 5 9-5M12 22V13"/></svg>`,
    
    // Sorozat helyett: Trading Card (A kártya formája csillogással)
    series: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 7h6M9 11h6M9 15h4"/><path d="M16 19l2 2m0-2l-2 2"/></svg>`
};

function renderView() {
    const container = document.getElementById("folderContainer");
    container.innerHTML = "";
    container.className = "folder-grid";
    updateBreadcrumb();

    if (currentLevel === 'teams') {
        const teams = [...new Set(allCards.map(c => c.team))].filter(Boolean).sort();
        teams.forEach(t => createFolder(t, true));
    } else if (currentLevel === 'years') {
        const years = [...new Set(allCards.filter(c => c.team === currentPath.team).map(c => c.year))].filter(Boolean).sort().reverse();
        years.forEach(y => createFolder(y, false, "📅"));
    } else if (currentLevel === 'brands') {
        const brands = [...new Set(allCards.filter(c => c.team === currentPath.team && c.year === currentPath.year).map(c => c.brand))].sort();
        brands.forEach(b => createFolder(b, false, "🏢"));
    } else if (currentLevel === 'series') {
        const series = [...new Set(allCards.filter(c => c.team === currentPath.team && c.year === currentPath.year && c.brand === currentPath.brand).map(c => c.series))].sort();
        series.forEach(s => createFolder(s, false, "🏷️"));
    } else if (currentLevel === 'cards') {
        renderCards(container);
    }
}

function createFolder(name, isTeam, iconEmoji) {
    const div = document.createElement("div");
    div.className = "folder";
    const config = isTeam ? (teamConfig[name] || teamConfig.default) : teamConfig.default;
    
    div.style.setProperty('--team-color', config.color);
    div.onclick = () => {
        if (currentLevel === 'teams') { currentPath.team = name; currentLevel = 'years'; }
        else if (currentLevel === 'years') { currentPath.year = name; currentLevel = 'brands'; }
        else if (currentLevel === 'brands') { currentPath.brand = name; currentLevel = 'series'; }
        else if (currentLevel === 'series') { currentPath.series = name; currentLevel = 'cards'; }
        renderView();
    };

    div.innerHTML = `<div class="folder-tab"></div>`;
    if (isTeam) {
        div.innerHTML += `<img src="${config.logo}" class="folder-logo" onerror="this.src='https://cdn-icons-png.flaticon.com/512/261/261053.png'"><div class="folder-name">${name}</div>`;
    } else {
        div.innerHTML += `<div style="font-size:40px; margin-bottom:10px;">${iconEmoji}</div><div class="folder-name">${name}</div>`;
    }
    document.getElementById("folderContainer").appendChild(div);
}

function renderCards(container) {
    const cards = allCards.filter(c => 
        c.team === currentPath.team && 
        c.year === currentPath.year && 
        c.brand === currentPath.brand && 
        c.series === currentPath.series
    );
    
    container.className = "card-grid";
    cards.sort((a,b) => String(a.cardNumber).localeCompare(String(b.cardNumber), undefined, {numeric:true})).forEach(c => {
        const div = document.createElement("div");
        div.className = `card-item ${c.owned ? 'owned' : ''}`;
        
        // Egyedi ID a checkboxnak
        const checkboxId = `check-${c.id}`; 
        
        div.innerHTML = `
            <div class="card-info">
                <input type="checkbox" 
                       id="${checkboxId}" 
                       ${c.owned ? 'checked' : ''} 
                       class="card-checkbox">
                <label for="${checkboxId}" class="card-label">
                    <span class="card-num">#${c.cardNumber}</span>
                    <span class="card-name">${c.baseName}</span>
                </label>
            </div>
            <div class="card-meta">${c.printRun ? '/' + c.printRun : ''}</div>
        `;

        // Eseményfigyelő a pipáláshoz
        const checkbox = div.querySelector('input');
        checkbox.addEventListener('change', async (e) => {
            const isChecked = e.target.checked;
            await toggleOwnedStatus(c.id, isChecked, div);
        });

        container.appendChild(div);
    });
}

function updateBreadcrumb() {
    const el = document.getElementById("breadcrumb");
    el.innerHTML = `<span onclick="resetNav()">Gyűjtemény</span>`;
    if (currentPath.team) el.innerHTML += ` / <span onclick="goToLevel('years')">${currentPath.team}</span>`;
    if (currentPath.year) el.innerHTML += ` / <span onclick="goToLevel('brands')">${currentPath.year}</span>`;
}

window.resetNav = () => { currentPath = { team: null, year: null, brand: null, series: null }; currentLevel = 'teams'; renderView(); };
window.goToLevel = (lvl) => { currentLevel = lvl; if(lvl==='years') currentPath.year=null; renderView(); };

// CSV Import
async function handleCSV(e) {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = async (event) => {
        const rows = event.target.result.split(/\r?\n/).slice(1);
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

document.addEventListener("DOMContentLoaded", loadCollection);
document.getElementById("csvInput")?.addEventListener("change", handleCSV);