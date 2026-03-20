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
window.uploadImageForCard = async (cardId, side) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const ext = file.name.split('.').pop();
        // A fájlnévbe belevesszük, hogy front vagy back
        const fileName = `${cardId}_${side}_${Date.now()}.${ext}`;

        try {
            alert(`${side === 'frontImageUrl' ? 'Előlap' : 'Hátlap'} feltöltése...`);
            
            const workerUrl = `https://grayson-cards.szekeres-szabolcs02.workers.dev/?file=${fileName}`;
            
            const response = await fetch(workerUrl, {
                method: "POST",
                body: file
            });

            if (!response.ok) throw new Error("Feltöltési hiba");

            const imageUrl = await response.text(); 

            // Firestore frissítése a megfelelő mezővel (frontImageUrl vagy backImageUrl)
            const updateData = {};
            updateData[side] = imageUrl;
            updateData.updatedAt = serverTimestamp();

            await updateDoc(doc(db, "cards", cardId), updateData);

            alert("Sikeres feltöltés!");
            loadCollection(); 
        } catch (error) {
            console.error(error);
            alert("Hiba történt a feltöltésnél.");
        }
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
    
    // Képkeret generáló (ugyanaz a logika, de tisztább HTML)
    const getImageSlot = (url, side, label) => {
        const hasImg = url && !url.includes("Not Allowed");
        return `
            <div class="card-img-container ${!hasImg ? 'no-img' : ''}" onclick="${!hasImg ? `uploadImageForCard('${c.id}', '${side}')` : ''}">
                ${hasImg ? `<img src="${url}" class="card-img-preview" onclick="openLightbox(event, '${url}')">` : '<i class="fas fa-plus"></i>'}
                ${hasImg ? `<div class="change-img-btn" onclick="event.stopPropagation(); uploadImageForCard('${c.id}', '${side}')"><i class="fas fa-sync-alt"></i></div>` : ''}
                <span class="side-label">${label}</span>
            </div>`;
    };

    div.innerHTML = `
    <!-- KÉPEK -->
    <div class="card-images-section">
        ${getImageSlot(c.frontImageUrl, 'frontImageUrl', 'F')}
        ${getImageSlot(c.backImageUrl, 'backImageUrl', 'B')}
    </div>

    <!-- CHECKBOX -->
    <input type="checkbox" id="check-${c.id}" ${c.owned ? 'checked' : ''} class="card-checkbox">

    <!-- NÉV + SZÁM -->
    <div class="card-info-section">
        <div class="card-num">#${c.cardNumber}</div>
        <div class="card-name">${c.baseName}</div>
    </div>

    <!-- PRINT RUN -->
    ${isNum ? `<div class="card-meta-line">/${c.printRun}</div>` : ''}
`;

    div.querySelector('input').addEventListener('change', (e) => toggleOwnedStatus(c.id, e.target.checked, div));
    container.appendChild(div);
}

// Új függvény a kép nagyításához
window.openLightbox = (e, url) => {
    e.stopPropagation();
    const modal = document.getElementById("imgModal");
    const modalImg = document.getElementById("modalImg");
    modalImg.src = url;
    modal.style.display = "flex";
};

window.closeLightbox = () => {
    document.getElementById("imgModal").style.display = "none";
};

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

// 1. Eseményfigyelő: Amikor gépelsz a keresőbe
document.getElementById('searchInput')?.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase().trim();
    
    if (term === "") {
        renderView(); 
        return;
    }

    const filtered = allCards.filter(c => {
        // Alapadatok előkészítése a kereséshez
        const name = c.baseName?.toLowerCase() || "";
        const num = c.cardNumber?.toString() || "";
        const series = c.series?.toLowerCase() || "";
        const brand = c.brand?.toLowerCase() || "";
        
        // Számozás kezelése: elkészítjük a "50" és a "/50" verziót is
        const limit = (c.printRun && c.printRun !== 'x') ? c.printRun.toString() : "";
        const limitWithSlash = limit ? "/" + limit : "";

        return (
            name.includes(term) || 
            num.includes(term) || 
            series.includes(term) || 
            brand.includes(term) ||
            limit.includes(term) ||         // Találat, ha csak "50"-et írsz
            limitWithSlash.includes(term)   // Találat, ha "/50"-et írsz
        );
    });

    renderSearchResults(filtered);
});

// Speciális renderelés a keresési találatoknak
function renderSearchResults(results) {
    const container = document.getElementById("folderContainer");
    if (!container) return;
    
    container.innerHTML = ""; // Kiürítjük a mappákat
    
    if (results.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding:50px; color:gray;">Nincs találat erre a keresésre.</div>`;
        return;
    }

    // A találatokat ugyanúgy jelenítjük meg, mint a kártyalistát
    results.forEach(c => {
        renderSingleCard(c, container);
    });
}

window.resetNav = () => { currentPath = { team: null, year: null, brand: null, series: null }; currentLevel = 'teams'; renderView(); };
window.openLightbox = (e, url) => { e.stopPropagation(); document.getElementById("modalImg").src = url; document.getElementById("imgModal").style.display = "flex"; };
window.closeLightbox = () => document.getElementById("imgModal").style.display = "none";
window.toggleAdminMenu = (e) => { e.stopPropagation(); document.getElementById("adminDropdown").classList.toggle("show"); };

document.addEventListener("DOMContentLoaded", loadCollection);