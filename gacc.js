import { initializeApp } 
from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";

import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBd--_OmOvCXTfuAQ-D96IS6NgRssCMavg",
  authDomain: "grayson-card-collection.firebaseapp.com",
  projectId: "grayson-card-collection",
  storageBucket: "grayson-card-collection.firebasestorage.app",
  messagingSenderId: "868175520778",
  appId: "1:868175520778:web:0cabbf5d88912c35aaabf3"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);   // ← EZ HIÁNYZIK NÁLAD
const db = getFirestore(app);

/*TELJES BETÖLTÉS FIRESTORE*/

import {
    getFirestore,
    doc,
    updateDoc,
    collection,
    onSnapshot,
    addDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";


async function loadAllCardsFromFirestore() {

    const snapshot = await getDocs(collection(db, "cards"));

    const database = {};

    snapshot.forEach(docSnap => {

        const data = docSnap.data();

        const { csapat, ev, brand, sorozat, kartyaSzam, kartya, owned } = data;

        if (!database[csapat]) {
            database[csapat] = {
                name: csapat,
                season: ev,
                brands: {}
            };
        }

        if (!database[csapat].brands[brand]) {
            database[csapat].brands[brand] = {};
        }

        if (!database[csapat].brands[brand][sorozat]) {
            database[csapat].brands[brand][sorozat] = [];
        }

        database[csapat].brands[brand][sorozat].push({
            kartyaSzam,
            kartya,
            owned,
            id: docSnap.id
        });

    });

    Object.values(database).forEach(team =>
    Object.values(team.brands).forEach(brand =>
        Object.values(brand).forEach(series =>
            series.sort((a, b) =>
                a.kartyaSzam.localeCompare(b.kartyaSzam, undefined, {
                    numeric: true,
                    sensitivity: "base"
                })
            )
        )
    )
      );
    console.log("Betöltött dokumentumok:", snapshot.size);

    render(database);
    updateAllCounts();
    updateDashboard();
   
}

  



/*Anonymus login innen*/
let USER_ID = null;

signInAnonymously(auth)
  .then(() => {
    console.log("Anonim login OK");
  })
  .catch((error) => {
    console.error("Anonim login hiba:", error);
  });

let realtimeStarted = false;

onAuthStateChanged(auth, (user) => {

    if (user && !realtimeStarted) {
        realtimeStarted = true;
        enableRealtimeSync();
    }

});
/*idaig-------------------------*/

function updateStyle(cb){
  const card = cb.closest(".kartya");
  if(!card) return;

  if(cb.checked){
    card.classList.add("megvan");
  }else{
    card.classList.remove("megvan");
  }
}


  /* ------------- CSAPAT SZINEK ------------ */
const teamConfig = {
  "Utah Jazz": {
    color1: "#002B5C",
    color2: "#F9A01B",
    logo: "utahjazz.png"
  },
  "Memphis Grizzlies": {
    color1: "#5D76A9",
    color2: "#12173F",
    logo: "Grizzlies.png"
  },
  "Milwaukee Bucks": {
    color1: "#00471B",
    color2: "#EEE1C6",
    logo: "logos/bucks.png"
  },
  "Phoenix Suns": {
    color1: "#1D1160",
    color2: "#E56020",
    logo: "logos/suns.png"
  }
};




document.addEventListener("DOMContentLoaded", () => {

  const csvInput = document.getElementById("csvInput");
  const exportBtn = document.getElementById("exportBtn");
  const searchInput = document.getElementById("searchInput");
  

  if (csvInput) {
    csvInput.addEventListener("change", handleCSV);

  }

  if (exportBtn) {
    exportBtn.addEventListener("click", exportCSV);
  }

  if (searchInput) {
    searchInput.addEventListener("input", handleSearch);
  }
        


  updateDashboard();

});

function handleCSV(e) {

    console.log("CSV handle elindult");

    const file = e.target.files[0];
   
    const reader = new FileReader();

    reader.onload = async function(event) {

        const text = event.target.result.trim();
        const rows = text.split(/\r?\n/);
        rows.shift(); // fejléc törlés

        for (const row of rows) {

            if (!row.trim()) continue;

          const parts = row.split(";");

    if (parts.length !== 7) {
        console.log("HIBÁS SOR:", row);
        continue;
    }

            const [csapat, ev, brand, sorozat, kartyaSzam, kartyaRaw, megvan] = row.split(";");
            const nameParts = kartyaRaw.split(" /");
            const baseName = nameParts[0];
            const printRun = nameParts[1] ? parseInt(nameParts[1]) : null;
            await addDoc(collection(db, "cards"), {
                  csapat,
                  ev,
                  brand,
                  sorozat,
                  kartyaSzam,
                  kartya: baseName,      // már tiszta név
                  printRun: printRun,    // külön mező
                      owned: megvan === "TRUE"
});
        }

        console.log("Import kész");

    };

    reader.readAsText(file);
}

function extractPrintRun(name) {
    if (!name || typeof name !== "string") return null;
    const match = name.match(/\/(\d+)/);
    return match ? match[1] : null;
}



function render(database) {

  const main = document.querySelector("main");
  main.innerHTML = "";

  Object.values(database).forEach(teamData => {

    const teamDetails = document.createElement("details");
    teamDetails.className = "team-mappa";

    teamDetails.dataset.key = `team-${teamData.name}`;

    const config = teamConfig[teamData.name];

const teamSummary = document.createElement("summary");

teamSummary.style.background = config
  ? `linear-gradient(90deg, ${config.color1}, ${config.color2})`
  : "linear-gradient(90deg, #1D428A, #C8102E)";

teamSummary.innerHTML = `
  <div style="display:flex;align-items:center;gap:12px;">
    ${config ? `<img src="${config.logo}" style="height:40px;">` : ""}
    <span>${teamData.name}</span>
  </div>
  <span class="team-season">${teamData.season}</span>
`;
    teamDetails.appendChild(teamSummary);

    Object.entries(teamData.brands).forEach(([brandName, series]) => {

      const brandDetails = document.createElement("details");
      brandDetails.className = "brand-mappa";

      brandDetails.dataset.key = `brand-${teamData.name}-${brandName}`;

      const brandSummary = document.createElement("summary");
      brandSummary.innerHTML = `
        <span>${brandName}</span>
        <span class="brand-count"></span>
      `;

      brandDetails.appendChild(brandSummary);

      Object.entries(series).forEach(([seriesName, cards]) => {

        const seriesDetails = document.createElement("details");
        seriesDetails.className = "sorozat-mappa";

        seriesDetails.dataset.key = `series-${teamData.name}-${brandName}-${seriesName}`;

        const seriesSummary = document.createElement("summary");
        seriesSummary.innerHTML = `
          <span>${seriesName}</span>
          <span class="series-count"></span>
        `;

        seriesDetails.appendChild(seriesSummary);

        const grid = document.createElement("div");
        grid.className = "kartya-grid";

        cards.forEach(card => {

            if (!card.kartya) return;

          const key = `${teamData.name}|${teamData.season}|${brandName}|${seriesName}|${card.kartyaSzam}|${card.kartya}`;
          const cardDiv = document.createElement("div");
          cardDiv.className = "kartya";
          
   const printRun = extractPrintRun(card.kartya);
const cleanName = card.kartya.replace(/\/\d+/, "").trim();

cardDiv.innerHTML = `
<div class="card-name">
    ${card.kartyaSzam}. ${cleanName}
    ${printRun ? `
        <span class="rarity-badge">
           <span class="rarity-total">/ ${printRun}</span>
        </span>
    ` : ""}
</div>
<input type="checkbox" data-key="${card.id}" ${card.owned ? "checked" : ""}>
`;

          grid.appendChild(cardDiv);

        });

        seriesDetails.appendChild(grid);
        brandDetails.appendChild(seriesDetails);

      });

      teamDetails.appendChild(brandDetails);

    });

    main.appendChild(teamDetails);

  });

}

/*Firestore mentes*/
function initCheckboxesFromCSV(database) {

 
    cb.addEventListener("change", async () => {
    await updateDoc(doc(db, "cards", card.id), {
        owned: cb.checked
    });
  });
  }


function updateAllCounts() {

  document.querySelectorAll(".brand-mappa").forEach(brand => {
    const total = brand.querySelectorAll("input[type='checkbox']").length;
    const checked = brand.querySelectorAll("input[type='checkbox']:checked").length;

    const counter = brand.querySelector(".brand-count");
    if (counter) counter.textContent = ` ${checked} / ${total}`;
  });

  document.querySelectorAll(".sorozat-mappa").forEach(series => {
    const total = series.querySelectorAll("input[type='checkbox']").length;
    const checked = series.querySelectorAll("input[type='checkbox']:checked").length;

    const counter = series.querySelector(".series-count");
    if (counter) counter.textContent = ` ${checked} / ${total}`;
  });

}

/* Szamlalo Script */

function updateDashboard() {
  const checkboxes = document.querySelectorAll(".kartya input[type='checkbox']");
  
  const total = checkboxes.length;
  let owned = 0;

  checkboxes.forEach(cb => {
    if (cb.checked) owned++;
  });

  const missing = total - owned;
  const percent = total === 0 ? 0 : Math.round((owned / total) * 100);

  document.getElementById("totalCount").textContent = total;
  document.getElementById("ownedCount").textContent = owned;
  document.getElementById("missingCount").textContent = missing;
  document.getElementById("percentCount").textContent = percent + "%";

  document.getElementById("globalProgress").style.width = percent + "%";
}


function attachCheckboxListeners() {

    document.querySelectorAll("input[type='checkbox']").forEach(cb => {

        cb.addEventListener("change", async () => {

            console.log("Checkbox változott:", cb.dataset.key);

            await updateDoc(doc(db, "cards", cb.dataset.key), {
                owned: cb.checked
            });

        });

    });

}


/*REAL TIME betöltes*/

let unsubscribe = null;

function enableRealtimeSync() {
  
  console.log("RealtimeSync ELINDULT");

    onSnapshot(collection(db, "cards"), (snapshot) => {

        console.log("Snapshot lefutott");

        // 1️⃣ Mappa állapot mentése
        const openDetails = new Set(
            [...document.querySelectorAll("details[open]")]
                .map(d => d.dataset.key)
        );

        const database = {};

        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const { csapat, ev, brand, sorozat, kartyaSzam, kartya, owned } = data;

            if (!database[csapat]) {
                database[csapat] = {
                    name: csapat,
                    season: ev,
                    brands: {}
                };
            }

            if (!database[csapat].brands[brand]) {
                database[csapat].brands[brand] = {};
            }

            if (!database[csapat].brands[brand][sorozat]) {
                database[csapat].brands[brand][sorozat] = [];
            }

            database[csapat].brands[brand][sorozat].push({
                kartyaSzam,
                kartya,
                owned,
                id: docSnap.id
            });

           database[csapat].brands[brand][sorozat].sort((a, b) => {

    function getPriority(name) {
        if (name.includes("Base")) return 1;
        if (name.includes("Silver")) return 2;
        if (name.includes("Green")) return 3;
        if (name.includes("Hyper")) return 4;
        if (name.includes("Choice")) return 5;
        if (name.includes("Fast Break")) return 6;
        if (name.includes("Purple")) return 7;
        if (name.includes("Orange")) return 8;
        if (name.includes("Gold")) return 9;
        if (name.includes("Black")) return 10;
        return 999;
    }

    const aPriority = getPriority(a.kartya);
    const bPriority = getPriority(b.kartya);

    if (aPriority !== bPriority) {
        return aPriority - bPriority;
    }

    // print run rendezés (/5 előbb mint /199)
    const aPrint = extractPrintRun(a.kartya);
    const bPrint = extractPrintRun(b.kartya);

    if (aPrint && bPrint && aPrint !== bPrint) {
        return bPrint - aPrint;
    }

    // végső fallback
    return a.kartyaSzam.localeCompare(
        b.kartyaSzam,
        undefined,
        { numeric: true, sensitivity: "base" }
    );

});      
        

        // 2️⃣ Mappa állapot visszaállítása
        document.querySelectorAll("details").forEach(d => {
            if (openDetails.has(d.dataset.key)) {
                d.open = true;
            }
        });

        attachCheckboxListeners();
        updateAllCounts();
        updateDashboard();
        render(database);
    });
});
}

function exportCSV() {

  let csv = "Csapat;Ev;Brand;Sorozat;KartyaSzam;Kartya;Megvan\n";

  document.querySelectorAll(".kartya").forEach(cardDiv => {

    const checkbox = cardDiv.querySelector("input");
    const key = checkbox.dataset.key;
    const checked = checkbox.checked ? "TRUE" : "FALSE";

    const parts = key.split("|");

    const [csapat, ev, brand, sorozat, kartyaSzam, kartya] = parts;

    csv += `${csapat};${ev};${brand};${sorozat};${kartyaSzam};${kartya};${checked}\n`;

  });

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "card_collection_export.csv";
  a.click();

  URL.revokeObjectURL(url);
}

function handleSearch(e) {

  const term = e.target.value.toLowerCase();

  document.querySelectorAll(".kartya").forEach(card => {

    const text = card.textContent.toLowerCase();

    if (text.includes(term)) {

      card.style.display = "";

      const series = card.closest(".sorozat-mappa");
      const brand = card.closest(".brand-mappa");
      const team = card.closest(".team-mappa");

      if (series) series.open = true;
      if (brand) brand.open = true;
      if (team) team.open = true;

    } else {
      card.style.display = "none";
    }

  });

  if (term === "") {
    document.querySelectorAll(".sorozat-mappa").forEach(el => el.open = false);
    document.querySelectorAll(".brand-mappa").forEach(el => el.open = false);
    document.querySelectorAll(".team-mappa").forEach(el => el.open = false);
  }

}

