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

// --- KONFIGURÁCIÓK ---
const teamConfig = {
    "Memphis Grizzlies": { logo: "grizzlies.png" },
    "Milwaukee Bucks": { logo: "bucks.png" },
    "Phoenix Suns": { logo: "suns.png" },
    "Utah Jazz": { logo: "jazz.png" },
    "default": { logo: "nba.png" }
};

const brandConfig = {
    "Panini": "panini_logo.png",
    "Topps": "topps_logo.png",
    "Donruss": "donruss_logo.png",
    "Upper Deck": "upperdeck_logo.png"
};

let allCards = [];
let currentPath = { team: null, year: null, brand: null, series: null };
let currentLevel = 'teams';

async function loadCollection() {
    try {
        const snap = await getDocs(collection(db, "cards"));
        allCards = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        updateDashboard();
        renderView();
    } catch (e) { console.error(e); }
}

// --- R2 FELTÖLTÉS ---
window.uploadImageForCard = async (cardId) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const ext = file.name.split('.').pop();
        const fileName = `${cardId}_${Date.now()}.${ext}`;

        try {
        alert("Feltöltés indul...");
        
        // --- IDE MÁSOLD A SAJÁT WORKER URL-EDET ---
        const workerUrl = `https://grayson-cards.szekeres-szabolcs02.workers.dev`;
        
        const response = await fetch(workerUrl, {
            method: "POST", // <--- EZ A LEGFONTOSABB SOR! Ellenőrizd, hogy nagybetűvel van-e.
            body: file
        });

        if (!response.ok) throw new Error("A Worker nem válaszolt.");

        const imageUrl = await response.text();
            await updateDoc(doc(db, "cards", cardId), { imageUrl: imageUrl, updatedAt: serverTimestamp() });
            alert("Kész!");
            loadCollection();
        } catch (err) { alert("Hiba!"); }
    };
    input.click();
};

// --- NÉZET ÉS SZŰRÉS ---
// --- JAVÍTOTT RENDERVIEW A PONTOS SORRENDDEL ---
function renderView() {
    const container = document.getElementById("folderContainer");
    if (!container) return;
    container.innerHTML = "";
    updateBreadcrumb();

    const filtered = allCards.filter(c => {
        if (currentLevel === 'teams') return true;
        const mTeam = c.team === currentPath.team;
        const mYear = String(c.year) === String(currentPath.year);
        const mBrand = c.brand === currentPath.brand;
        const mSeries = c.series === currentPath.series;

        if (currentLevel === 'years') return mTeam;
        if (currentLevel === 'brands') return mTeam && mYear;
        if (currentLevel === 'series') return mTeam && mYear && mBrand;
        if (currentLevel === 'cards') return mTeam && mYear && mBrand && mSeries;
        return false;
    });

    if (currentLevel === 'teams') {
        [...new Set(allCards.map(c => c.team))].sort().forEach(t => {
            const count = allCards.filter(c => c.team === t).length;
            createFolder(t, true, null, count, null, () => { currentPath.team = t; currentLevel = 'years'; renderView(); });
        });
    } else if (currentLevel === 'years') {
        [...new Set(filtered.map(c => c.year))].sort().reverse().forEach(y => {
            const count = filtered.filter(c => c.year === y).length;
            createFolder(y, false, "📅", count, null, () => { currentPath.year = y; currentLevel = 'brands'; renderView(); });
        });
    } else if (currentLevel === 'brands') {
        [...new Set(filtered.map(c => c.brand))].sort().forEach(b => {
            const count = filtered.filter(c => c.brand === b).length;
            let logo = null;
            for (let k in brandConfig) { if (b.toLowerCase().includes(k.toLowerCase())) { logo = brandConfig[k]; break; } }
            createFolder(b, false, logo ? null : "🏢", count, logo, () => { currentPath.brand = b; currentLevel = 'series'; renderView(); });
        });
    } else if (currentLevel === 'series') {
        [...new Set(filtered.map(c => c.series))].sort().forEach(s => {
            const count = filtered.filter(c => c.series === s).length;
            createFolder(s, false, "🏷️", count, null, () => { currentPath.series = s; currentLevel = 'cards'; renderView(); });
        });
    } else {
        // --- ITT A SORREND JAVÍTÁSA ---
        filtered.sort((a, b) => {
            const isBaseA = !a.printRun || a.printRun === 'x';
            const isBaseB = !b.printRun || b.printRun === 'x';

            // 1. Ha mindkettő Base -> Kártyaszám szerint növekvő
            if (isBaseA && isBaseB) {
                return String(a.cardNumber).localeCompare(String(b.cardNumber), undefined, { numeric: true });
            }

            // 2. Ha az egyik Base, a másik számozott -> A Base kerül előre
            if (isBaseA) return -1;
            if (isBaseB) return 1;

            // 3. Ha mindkettő számozott -> Számozás szerint csökkenő (pl. 299 -> 99 -> 10)
            const valA = parseInt(a.printRun) || 0;
            const valB = parseInt(b.printRun) || 0;

            if (valB !== valA) {
                return valB - valA; 
            }

            // 4. Ha a számozásuk tök ugyanaz -> Kártyaszám dönt
            return String(a.cardNumber).localeCompare(String(b.cardNumber), undefined, { numeric: true });
        });

        filtered.forEach(c => renderSingleCard(c, container));
    }
}
function createFolder(name, isTeam, emoji, count, logoUrl, onClick) {
    const div = document.createElement("div");
    div.className = "folder metal-bg";
    div.onclick = onClick;
    let icon = isTeam ? `<img src="${(teamConfig[name] || teamConfig.default).logo}" class="folder-logo">` : 
               (logoUrl ? `<img src="${logoUrl}" class="folder-logo brand-logo-style">` : `<div style="font-size:40px; margin-bottom:10px;">${emoji}</div>`);
    div.innerHTML = `${icon}<div class="folder-name">${name.toString().toUpperCase()}</div><div class="folder-count">${count} CARDS</div>`;
    document.getElementById("folderContainer").appendChild(div);
}

function renderSingleCard(c, container) {
    const div = document.createElement("div");
    const isNum = (c.printRun && c.printRun !== 'x');
    div.className = `card-item ${c.owned ? 'owned' : ''} ${isNum ? 'numbered-card' : ''}`;
    
    // Képkezelés: ha van kép, egy kis 'edit' réteget teszünk rá
    let imgHtml = "";
    if (c.imageUrl && !c.imageUrl.includes("Not Allowed")) {
        imgHtml = `
            <div class="img-container" style="position: relative; width: 45px; height: 63px;">
                <img src="${c.imageUrl}" class="card-img-preview" onclick="openLightbox(event, '${c.imageUrl}')">
                <div class="edit-overlay" onclick="event.stopPropagation(); uploadImageForCard('${c.id}')" title="Kép cseréje">
                    <i class="fas fa-sync-alt"></i>
                </div>
            </div>`;
    } else {
        // Ha nincs kép, vagy a hibaüzenet mentődött el, marad a "+" gomb
        imgHtml = `<div class="no-img-placeholder" onclick="uploadImageForCard('${c.id}')"><i class="fas fa-plus"></i></div>`;
    }

    div.innerHTML = `
        <div class="card-info" style="display:flex; align-items:center; gap:15px;">
            ${imgHtml}
            <div>
                <input type="checkbox" id="check-${c.id}" ${c.owned ? 'checked' : ''}>
                <label for="check-${c.id}">#${c.cardNumber} ${c.baseName}</label>
            </div>
        </div>
        <div class="card-meta">${isNum ? '/' + c.printRun : ''}</div>`;
    
    div.querySelector('input').addEventListener('change', (e) => toggleOwnedStatus(c.id, e.target.checked, div));
    container.appendChild(div);
}

// --- NAVIGÁCIÓ JAVÍTÁSA (Most már appendChild-ot használunk, hogy ne vesszenek el az események) ---
window.breadcrumbGoTo = (level) => {
    currentLevel = level;
    if (level === 'years') { currentPath.year = null; currentPath.brand = null; currentPath.series = null; }
    else if (level === 'brands') { currentPath.brand = null; currentPath.series = null; }
    else if (level === 'series') { currentPath.series = null; }
    renderView();
};

function updateBreadcrumb() {
    const container = document.getElementById("breadcrumbContainer");
    if (!container) return;
    container.innerHTML = ""; // Tisztítás

    // HOME
    const home = document.createElement("span");
    home.textContent = "HOME";
    home.onclick = () => resetNav();
    container.appendChild(home);

    if (currentPath.team) appendCrumb(container, currentPath.team, () => breadcrumbGoTo('years'));
    if (currentPath.year) appendCrumb(container, currentPath.year, () => breadcrumbGoTo('brands'));
    if (currentPath.brand) appendCrumb(container, currentPath.brand, () => breadcrumbGoTo('series'));
    if (currentPath.series) appendCrumb(container, currentPath.series, null);
}

function appendCrumb(container, text, onClick) {
    const sep = document.createElement("span");
    sep.textContent = " / ";
    sep.className = "separator";
    container.appendChild(sep);

    const span = document.createElement("span");
    span.textContent = text.toString().toUpperCase();
    if (onClick) {
        span.onclick = onClick;
    } else {
        span.className = "active-crumb";
    }
    container.appendChild(span);
}

// --- EGYÉB FUNKCIÓK ---
async function toggleOwnedStatus(cardId, isOwned, element) {
    await updateDoc(doc(db, "cards", cardId), { owned: isOwned, updatedAt: serverTimestamp() });
    const card = allCards.find(c => c.id === cardId);
    if (card) card.owned = isOwned;
    isOwned ? element.classList.add('owned') : element.classList.remove('owned');
    updateDashboard();
}

function updateDashboard() {
    const total = allCards.length;
    const owned = allCards.filter(c => c.owned).length;
    const pct = total === 0 ? 0 : Math.round((owned / total) * 100);
    if(document.getElementById("totalCount")) document.getElementById("totalCount").textContent = total;
    if(document.getElementById("ownedCount")) document.getElementById("ownedCount").textContent = owned;
    if(document.getElementById("percentCount")) document.getElementById("percentCount").textContent = pct + "%";
    if(document.getElementById("globalProgress")) document.getElementById("globalProgress").style.width = pct + "%";
}

window.resetNav = () => { currentPath = { team: null, year: null, brand: null, series: null }; currentLevel = 'teams'; renderView(); };
window.openLightbox = (e, url) => { e.stopPropagation(); document.getElementById("modalImg").src = url; document.getElementById("imgModal").style.display = "flex"; };
window.closeLightbox = () => document.getElementById("imgModal").style.display = "none";
window.toggleAdminMenu = (e) => { e.stopPropagation(); document.getElementById("adminDropdown").classList.toggle("show"); };

document.addEventListener("DOMContentLoaded", loadCollection);