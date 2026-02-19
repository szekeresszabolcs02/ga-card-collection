import { initializeApp } 
from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";

import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

import { 
  getFirestore, 
  doc, 
  setDoc, 
  onSnapshot 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

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
    getDocs,
    collection,
    addDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

async function loadAllCardsFromFirestore() {

  const snapshot = await getDocs(collection(db, "cards"));
  const database = {};

  snapshot.forEach(docSnap => {

    const data = docSnap.data();

    if (!database[data.csapat]) {
      database[data.csapat] = {
        name: data.csapat,
        season: data.ev,
        brands: {}
      };
    }

    if (!database[data.csapat].brands[data.brand]) {
      database[data.csapat].brands[data.brand] = {};
    }

    if (!database[data.csapat].brands[data.brand][data.sorozat]) {
      database[data.csapat].brands[data.brand][data.sorozat] = [];
    }

    database[data.csapat]
      .brands[data.brand][data.sorozat]
      .push({
        number: data.kartyaSzam,
        name: data.kartya,
        owned: data.owned
      });

  });

  render(database);
  updateAllCounts();
  updateDashboard();
  enableRealtimeSync();
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

onAuthStateChanged(auth, (user) => {
  if (user) {
    USER_ID = user.uid;
    console.log("User ID:", USER_ID);
  }
});
/*idaig-------------------------*/

onAuthStateChanged(auth, (user) => {
  if (user) {
    USER_ID = user.uid;
    console.log("User ID:", USER_ID);
    loadAllCardsFromFirestore();
  }
});




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
    logo: "logos/utahjazz.png"
  },
  "Memphis Grizzlies": {
    color1: "#5D76A9",
    color2: "#12173F",
    logo: "logos/memphis.png"
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

    const file = e.target.files[0];
    const reader = new FileReader();

    reader.onload = async function(event) {

        const text = event.target.result.trim();
        const rows = text.split("\n");
        rows.shift(); // fejléc törlés

        for (const row of rows) {

            if (!row.trim()) continue;

            const [csapat, ev, brand, sorozat, kartyaSzam, kartya, megvan] = row.split(";");

            await addDoc(
                collection(db, "cards"),
                {
                    csapat,
                    ev,
                    brand,
                    sorozat,
                    kartyaSzam,
                    kartya,
                    owned: megvan === "TRUE"
                }
            );
        }

        console.log("Import kész");

        await loadAllCardsFromFirestore();
    };

    reader.readAsText(file);
}

function extractPrintRun(name) {
    const match = name.match(/\/(\d+)/);
    return match ? match[1] : null;
}



function render(database) {

  const main = document.querySelector("main");
  main.innerHTML = "";

  Object.values(database).forEach(teamData => {

    const teamDetails = document.createElement("details");
    teamDetails.className = "team-mappa";

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

      const brandSummary = document.createElement("summary");
      brandSummary.innerHTML = `
        <span>${brandName}</span>
        <span class="brand-count"></span>
      `;

      brandDetails.appendChild(brandSummary);

      Object.entries(series).forEach(([seriesName, cards]) => {

        const seriesDetails = document.createElement("details");
        seriesDetails.className = "sorozat-mappa";

        const seriesSummary = document.createElement("summary");
        seriesSummary.innerHTML = `
          <span>${seriesName}</span>
          <span class="series-count"></span>
        `;

        seriesDetails.appendChild(seriesSummary);

        const grid = document.createElement("div");
        grid.className = "kartya-grid";

        cards.forEach(card => {

          const key = `${teamData.name}|${teamData.season}|${brandName}|${seriesName}|${card.number}|${card.name}`;

          const cardDiv = document.createElement("div");
          cardDiv.className = "kartya";

          
            const printRun = extractPrintRun(card.name);
const cleanName = card.name.replace(/\/\d+/, "").trim();

cardDiv.innerHTML = `
    <div class="card-name">
        ${card.number}. ${cleanName}
        ${printRun ? `<span class="print-run">#1 of ${printRun}</span>` : ""}
    </div>
    <input type="checkbox" data-key="${key}">
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

  document.querySelectorAll("input[type='checkbox']").forEach(cb => {

    const key = cb.dataset.key;
    const parts = key.split("|");

    const [csapat, ev, brand, sorozat, kartyaSzam, kartya] = parts;

    const owned =
      database[csapat]
      ?.brands[brand]
      ?.[sorozat]
      ?.find(c => c.number === kartyaSzam && c.name === kartya)
      ?.owned;

    cb.checked = owned === true;

    const card = cb.closest(".kartya");
    if (card) {
      card.classList.toggle("megvan", cb.checked);
    }

    cb.addEventListener("change", async () => {

  const key = cb.dataset.key;
  const docRef = doc(db, "cards", key);

  await setDoc(docRef, {
    owned: cb.checked
  });

  const card = cb.closest(".kartya");
  if (card) {
    card.classList.toggle("megvan", cb.checked);
  }

  updateAllCounts();
  updateDashboard();
});

  });
}


function initCheckboxes() {

  cb.addEventListener("change", async () => {

  if(!USER_ID) return;

  const key = cb.dataset.key;

  await setDoc(
    doc(db, "users", USER_ID, "cards", key),
    {
      owned: cb.checked,
      updated: new Date()
    }
  );

  cb.closest(".kartya")
    .classList.toggle("megvan", cb.checked);

  updateAllCounts();
  updateDashboard();
 
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

/*REAL TIME betöltes*/
function enableRealtimeSync() {
  
  document.querySelectorAll("input[type='checkbox']").forEach(cb => {

    const key = cb.dataset.key;
    const docRef = doc(db, "cards", key);

    onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        cb.checked = docSnap.data().owned;

        const card = cb.closest(".kartya");
        if (card) {
          card.classList.toggle("megvan", cb.checked);
        }

        updateAllCounts();
        updateDashboard();
      }
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

