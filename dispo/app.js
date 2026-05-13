import { normalizeRise, riseConfig } from './rise.js';
import { normalizeGreenGoods, greenGoodsConfig } from './greengoods.js';
import { LUCID_MAP } from './dictionary.js';

// ==========================================
// CONFIGURATION & STATE
// ==========================================
const BASE_WORKER_URL = "https://dispo.askozicki.workers.dev";
const API_EMAIL = "askozicki@gmail.com"; 

let currentData = [];
let currentStoreContext = "";
let globalVault = {};

// Dual Tracking State
let localFavs = JSON.parse(localStorage.getItem('lucid_favs')) || [];
let cloudAlerts = [];
let currentSort = { column: 'brand', asc: true };

// ==========================================
// DOM ELEMENTS
// ==========================================
const tableBody = document.getElementById('tableBody');
const searchBar = document.getElementById('searchBar');
const loader = document.getElementById('loader');

// Drawer & Filters
const toggleFiltersBtn = document.getElementById('toggleFiltersBtn');
const filterDrawer = document.getElementById('filterDrawer');
const filterT1 = document.getElementById('filterT1');
const filterType = document.getElementById('filterType');
const filterSize = document.getElementById('filterSize');
const filterMinTHC = document.getElementById('filterMinTHC');
const filterMaxPrice = document.getElementById('filterMaxPrice');
const filterDrops = document.getElementById('filterDrops');
const filterOOS = document.getElementById('filterOOS');

// Ghost Add Elements
const brandSelect = document.getElementById('ghostBrand');
const strainInput = document.getElementById('ghostStrain');
const strainList = document.getElementById('ghostStrainList');
const sizeSelect = document.getElementById('ghostSize');
const addGhostBtn = document.getElementById('addGhostBtn');
const syncCloudBtn = document.getElementById('syncCloudBtn');

// ==========================================
// UTILITIES
// ==========================================
const generateSlug = (brand, strain) => `${brand}-${strain}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

const calculateValueMetric = (item) => {
    if (!item.priceNum || item.priceNum <= 0 || !item.weight || item.weight <= 0) return { val: 0, display: 'N/A' };
    if (['Flower', 'Extract', 'Vape', 'Pre-Roll'].includes(item.t1)) return { val: item.ppgNum, display: `$${item.ppgNum.toFixed(2)} <span class="metric">/g</span>` };
    if (item.t1 === 'Edible') return { val: item.ppgNum / 10, display: `$${(item.ppgNum / 10).toFixed(2)} <span class="metric">/100mg</span>` };
    return { val: 0, display: 'N/A' };
};

// ==========================================
// THE FILTER VAULT (UI)
// ==========================================
toggleFiltersBtn.addEventListener('click', () => {
    filterDrawer.classList.toggle('active');
});

// ==========================================
// TRACKING: DUAL SYSTEM (FAVS & ALERTS)
// ==========================================
// Populate Ghost Add Dropdowns
const brands = new Set();
Object.values(LUCID_MAP).forEach(item => { if (item.t1 !== "Gear" && item.brand) brands.add(item.brand); });
Array.from(brands).sort().forEach(b => brandSelect.innerHTML += `<option value="${b}">${b}</option>`);

brandSelect.addEventListener('change', (e) => {
    const strains = new Set();
    Object.values(LUCID_MAP).forEach(item => { if (item.brand === e.target.value && item.strain) strains.add(item.strain); });
    strainList.innerHTML = Array.from(strains).sort().map(s => `<option value="${s}">`).join('');
});

// Load APIs
async function loadCloudState() {
    try {
        const vaultRes = await fetch(`${BASE_WORKER_URL}/vault`);
        if (vaultRes.ok) {
            const vData = await vaultRes.json();
            globalVault = vData.inventory || {};
        }

        const alertRes = await fetch(`${BASE_WORKER_URL}/watchlist?email=${encodeURIComponent(API_EMAIL)}`);
        if (alertRes.ok) {
            const aData = await alertRes.json();
            cloudAlerts = aData.watchlist || [];
        }
    } catch (err) { console.warn("Failed to load cloud state.", err); }
}

async function syncCloudAlerts() {
    const originalText = syncCloudBtn.innerText;
    syncCloudBtn.innerText = "Syncing..."; syncCloudBtn.disabled = true;
    try {
        await fetch(`${BASE_WORKER_URL}/watchlist`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: API_EMAIL, watchlist: cloudAlerts })
        });
        syncCloudBtn.innerText = "Synced! ✓"; syncCloudBtn.classList.replace('primary', 'success');
    } catch (err) { syncCloudBtn.innerText = "Sync Failed"; }
    setTimeout(() => { syncCloudBtn.innerText = originalText; syncCloudBtn.disabled = false; syncCloudBtn.classList.replace('success', 'primary'); }, 2000);
}

// Toggles
window.toggleFav = (key) => {
    if (localFavs.includes(key)) localFavs = localFavs.filter(k => k !== key);
    else localFavs.push(key);
    localStorage.setItem('lucid_favs', JSON.stringify(localFavs));
    renderTable();
};

window.toggleAlert = (key) => {
    if (cloudAlerts.includes(key)) cloudAlerts = cloudAlerts.filter(k => k !== key);
    else cloudAlerts.push(key);
    renderTable();
};

addGhostBtn.addEventListener('click', () => {
    const brand = brandSelect.value;
    const strain = strainInput.value.trim();
    const size = sizeSelect.value;
    if (!brand || !strain || !size) return alert("Fill out Brand, Strain, and Size to add an Alert.");
    
    const compoundKey = `${generateSlug(brand, strain)}@${size}`;
    if (!cloudAlerts.includes(compoundKey)) {
        cloudAlerts.push(compoundKey);
        strainInput.value = ""; 
        renderTable();
    }
});
syncCloudBtn.addEventListener('click', syncCloudAlerts);

// ==========================================
// DATA INGESTION & THE DIFF ENGINE
// ==========================================
async function fetchData(config, normalizerFn, storeName) {
    loader.style.display = 'block';
    tableBody.innerHTML = '';
    currentStoreContext = storeName;
    
    try {
        const response = await fetch(config.url, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(config.payload)
        });
        if (!response.ok) throw new Error("API Error");
        
        const json = await response.json();
        const liveItems = normalizerFn(json);
        const liveKeys = new Set();

        // 1. Process Live Data & Price Drops
        currentData = liveItems.map(item => {
            const compoundKey = `${item.slug}@${item.size}`;
            liveKeys.add(compoundKey);
            const vaultItem = globalVault[compoundKey];
            
            let isPriceDrop = false;
            let oldPrice = 0;
            
            // The Price Drop Sentinel Check
            if (vaultItem && vaultItem.price > item.priceNum) {
                isPriceDrop = true;
                oldPrice = vaultItem.price;
            }

            return { ...item, compoundKey, isPriceDrop, oldPrice, isOOS: false };
        });

        // 2. Process Vault OOS Data (Ghost Rows)
        Object.keys(globalVault).forEach(key => {
            const vItem = globalVault[key];
            if (vItem.store === storeName && !liveKeys.has(key)) {
                const [slug, size] = key.split('@');
                const dictEntry = LUCID_MAP[slug] || {};
                
                currentData.push({
                    compoundKey: key,
                    brand: dictEntry.brand || vItem.brand,
                    strain: dictEntry.strain || vItem.strain,
                    t1: dictEntry.t1 || "Other",
                    t2: dictEntry.t2 || "--",
                    type: dictEntry.type || "Unknown",
                    size: vItem.size, formattedSize: vItem.size,
                    thcNum: 0, thcDisplay: "N/A",
                    priceNum: vItem.price, priceDisplay: `$${vItem.price}`,
                    weight: 0, ppgNum: 0, omni: `${vItem.brand} ${vItem.strain}`.toLowerCase(),
                    isOOS: true, isPriceDrop: false, oldPrice: 0
                });
            }
        });

        renderTable();
    } catch (err) {
        console.error(err);
        tableBody.innerHTML = `<tr><td colspan="10" style="text-align:center; color: var(--danger);">Error fetching data. Check console.</td></tr>`;
    } finally {
        loader.style.display = 'none';
    }
}

document.getElementById('btnRise').addEventListener('click', () => fetchData(riseConfig, normalizeRise, "Rise"));
document.getElementById('btnGreenGoods').addEventListener('click', () => fetchData(greenGoodsConfig, normalizeGreenGoods, "Green Goods"));

// ==========================================
// TABLE RENDERING & FILTERING
// ==========================================
function renderTable() {
    const search = searchBar.value.toLowerCase();
    const t1F = filterT1.value;
    const typeF = filterType.value;
    const sizeF = filterSize.value;
    const minTHC = parseFloat(filterMinTHC.value) || 0;
    const maxPrice = parseFloat(filterMaxPrice.value) || 9999;
    const showDropsOnly = filterDrops.checked;
    const showOOS = filterOOS.checked;

    let filtered = currentData.filter(item => {
        // Advanced Filters
        if (!showOOS && item.isOOS) return false;
        if (showDropsOnly && !item.isPriceDrop) return false;
        if (t1F !== 'All' && item.t1 !== t1F) return false;
        if (typeF !== 'All' && item.type !== typeF) return false;
        if (sizeF !== 'All' && item.size !== sizeF) return false;
        if (item.thcNum < minTHC) return false;
        if (item.priceNum > maxPrice) return false;
        
        // Search Filter
        if (search && !item.omni.includes(search)) return false;
        return true;
    });

    // Formatting & Value Metrics
    let mapped = filtered.map(item => {
        const valData = calculateValueMetric(item);
        let finalPriceHtml = item.priceDisplay;
        
        if (item.isPriceDrop) {
            finalPriceHtml = `<del class="price-old">$${item.oldPrice}</del> <span class="price dropped">$${item.priceNum}</span>`;
        } else if (item.isOOS) {
            finalPriceHtml = `<span style="color:#666;">--</span>`;
        }

        return { ...item, formattedSize: item.size || 'N/A', finalPriceHtml, valueMetricDisplay: item.isOOS ? '--' : valData.display, valueMetricSort: valData.val };
    });

    mapped.sort((a, b) => {
        let valA = a[currentSort.column]; let valB = b[currentSort.column];
        if (currentSort.column === 'ppgNum') { valA = a.valueMetricSort; valB = b.valueMetricSort; }
        if (valA < valB) return currentSort.asc ? -1 : 1;
        if (valA > valB) return currentSort.asc ? 1 : -1;
        return 0;
    });

    let html = '';
    const currentKeys = new Set(currentData.map(i => i.compoundKey));

    // 3. Inject Missing Tracked Items (If search is empty)
    if (search === "") {
        const allTracked = new Set([...localFavs, ...cloudAlerts]);
        allTracked.forEach(key => {
            if (!currentKeys.has(key)) {
                const [slug, size] = key.split('@');
                const dictItem = LUCID_MAP[slug] || { brand: "Unknown", strain: slug };
                const isFav = localFavs.includes(key);
                const isAlert = cloudAlerts.includes(key);

                html += `
                <tr class="ghost-row">
                    <td onclick="toggleFav('${key}')" class="action-btn ${isFav ? 'fav-active' : ''}">★</td>
                    <td onclick="toggleAlert('${key}')" class="action-btn ${isAlert ? 'alert-active' : ''}">🔔</td>
                    <td class="brand">${dictItem.brand.toUpperCase()}</td>
                    <td class="strain">${dictItem.strain} <span class="ghost-badge">NOT LISTED</span></td>
                    <td>--</td><td>--</td>
                    <td style="color:#fff; font-weight:bold;">${size}</td>
                    <td>--</td><td>--</td><td>--</td>
                </tr>`;
            }
        });
    }

    // 4. Render Standard Rows
    mapped.forEach(item => {
        const isFav = localFavs.includes(item.compoundKey);
        const isAlert = cloudAlerts.includes(item.compoundKey);
        const typeClass = item.type.toLowerCase();
        
        let rowClass = item.isOOS ? "ghost-row" : "";
        let strainDisplay = item.strain;
        if (item.isOOS) strainDisplay += ` <span class="ghost-badge">SOLD OUT</span>`;

        html += `
        <tr class="${rowClass}">
            <td onclick="toggleFav('${item.compoundKey}')" class="action-btn ${isFav ? 'fav-active' : ''}">★</td>
            <td onclick="toggleAlert('${item.compoundKey}')" class="action-btn ${isAlert ? 'alert-active' : ''}">🔔</td>
            <td class="brand">${item.brand}</td>
            <td class="strain">${strainDisplay}</td>
            <td><span style="color:var(--text-muted);">${item.t1} &rarr;</span> ${item.t2}</td>
            <td><span class="badge ${typeClass}">${item.type}</span></td>
            <td>${item.formattedSize}</td>
            <td>${item.isOOS ? '--' : item.thcDisplay}</td>
            <td class="price">${item.finalPriceHtml}</td>
            <td>${item.valueMetricDisplay}</td>
        </tr>`;
    });

    if (mapped.length === 0 && search !== "") html = `<tr><td colspan="10" style="text-align: center; color: #888; padding: 40px;">No matching items found.</td></tr>`;
    tableBody.innerHTML = html;
}

// Event Listeners
searchBar.addEventListener('input', renderTable);
[filterT1, filterType, filterSize, filterMinTHC, filterMaxPrice, filterDrops, filterOOS].forEach(el => {
    el.addEventListener('change', renderTable);
});

document.querySelectorAll('th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
        const col = th.getAttribute('data-sort');
        if (currentSort.column === col) currentSort.asc = !currentSort.asc;
        else { currentSort.column = col; currentSort.asc = true; }
        renderTable();
    });
});

// Boot Process
loadCloudState();
