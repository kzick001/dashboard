import { normalizeRise, riseConfig } from './rise.js';
import { normalizeGreenGoods, greenGoodsConfig } from './greengoods.js';
import { LUCID_MAP } from './dictionary.js';

// ==========================================
// CONFIGURATION & STATE
// ==========================================
const WORKER_URL = "https://dispo.askozicki.workers.dev/watchlist";
const API_EMAIL = "askozicki@gmail.com"; 

let currentData = [];
let watchlist = [];
let currentSort = { column: 'brand', asc: true };

// ==========================================
// DOM ELEMENTS
// ==========================================
const tableBody = document.getElementById('tableBody');
const searchBar = document.getElementById('searchBar');
const filterT1 = document.getElementById('filterT1');
const filterType = document.getElementById('filterType');
const loader = document.getElementById('loader');

const brandSelect = document.getElementById('ghostBrand');
const strainInput = document.getElementById('ghostStrain');
const strainList = document.getElementById('ghostStrainList');
const sizeSelect = document.getElementById('ghostSize');
const addGhostBtn = document.getElementById('addGhostBtn');
const syncCloudBtn = document.getElementById('syncCloudBtn');

// ==========================================
// UTILITIES
// ==========================================
const generateSlug = (brand, strain) => {
    return `${brand}-${strain}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
};

const formatSize = (item) => {
    if (item.t1 === 'Gear') return 'N/A';
    if (item.count > 1 && item.size) return `${item.count}x ${item.size}`;
    return item.size || 'N/A';
};

const calculateValueMetric = (item) => {
    if (!item.priceNum || item.priceNum <= 0 || !item.weight || item.weight <= 0) return { val: 0, display: 'N/A' };
    
    if (['Flower', 'Extract', 'Vape', 'Pre-Roll'].includes(item.t1)) {
        return { val: item.ppgNum, display: `$${item.ppgNum.toFixed(2)} <span class="metric">/g</span>` };
    }
    
    if (item.t1 === 'Edible') {
        const per100mg = item.ppgNum / 10; 
        return { val: per100mg, display: `$${per100mg.toFixed(2)} <span class="metric">/100mg</span>` };
    }
    
    return { val: 0, display: 'N/A' };
};

// ==========================================
// WATCHLIST (COMPOUND KEYS & UI)
// ==========================================
// 1. Populate Brand Dropdown (Exclude Gear)
const brands = new Set();
Object.values(LUCID_MAP).forEach(item => {
    if (item.t1 !== "Gear" && item.brand) brands.add(item.brand);
});
Array.from(brands).sort().forEach(b => {
    brandSelect.innerHTML += `<option value="${b}">${b}</option>`;
});

// 2. Dynamic Strain Datalist
brandSelect.addEventListener('change', (e) => {
    const selectedBrand = e.target.value;
    const strains = new Set();
    Object.values(LUCID_MAP).forEach(item => {
        if (item.brand === selectedBrand && item.strain) strains.add(item.strain);
    });
    strainList.innerHTML = Array.from(strains).sort().map(s => `<option value="${s}">`).join('');
});

async function loadWatchlist() {
    try {
        const res = await fetch(`${WORKER_URL}?email=${encodeURIComponent(API_EMAIL)}`);
        if (res.ok) {
            const data = await res.json();
            watchlist = data.watchlist || [];
            renderTable();
        }
    } catch (err) {
        console.warn("Could not load watchlist from cloud. Running locally.", err);
    }
}

async function syncWatchlist() {
    const originalText = syncCloudBtn.innerText;
    syncCloudBtn.innerText = "Syncing...";
    syncCloudBtn.disabled = true;

    try {
        await fetch(WORKER_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: API_EMAIL, watchlist: watchlist })
        });
        syncCloudBtn.innerText = "Synced! ✓";
        syncCloudBtn.classList.replace('primary', 'success');
    } catch (err) {
        alert("Failed to sync to Cloudflare.");
        syncCloudBtn.innerText = "Sync Failed";
    }

    setTimeout(() => {
        syncCloudBtn.innerText = originalText;
        syncCloudBtn.disabled = false;
        syncCloudBtn.classList.replace('success', 'primary');
    }, 2000);
}

// 3. Track List Toggle (Uses Compound Keys: "slug@size")
window.toggleWatchlist = (compoundKey) => {
    if (watchlist.includes(compoundKey)) {
        watchlist = watchlist.filter(k => k !== compoundKey);
    } else {
        watchlist.push(compoundKey);
    }
    renderTable();
};

// 4. Ghost Add Submit
addGhostBtn.addEventListener('click', () => {
    const brand = brandSelect.value;
    const strain = strainInput.value.trim();
    const size = sizeSelect.value;
    
    if (!brand || !strain || !size) {
        alert("Please fill out Brand, Strain, and Size to track an item.");
        return;
    }
    
    const slug = generateSlug(brand, strain);
    const compoundKey = `${slug}@${size}`;
    
    if (!watchlist.includes(compoundKey)) {
        watchlist.push(compoundKey);
        strainInput.value = ""; // Reset for fast entry
        renderTable();
    }
});

syncCloudBtn.addEventListener('click', syncWatchlist);

// ==========================================
// DATA INGESTION
// ==========================================
async function fetchData(config, normalizerFn) {
    loader.style.display = 'block';
    tableBody.innerHTML = '';
    
    try {
        const response = await fetch(config.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config.payload)
        });
        
        if (!response.ok) throw new Error("API Error");
        const json = await response.json();
        
        currentData = normalizerFn(json);
        renderTable();
    } catch (err) {
        console.error(err);
        tableBody.innerHTML = `<tr><td colspan="9" style="text-align:center; color: var(--danger);">Error fetching data. Check console.</td></tr>`;
    } finally {
        loader.style.display = 'none';
    }
}

document.getElementById('btnRise').addEventListener('click', () => fetchData(riseConfig, normalizeRise));
document.getElementById('btnGreenGoods').addEventListener('click', () => fetchData(greenGoodsConfig, normalizeGreenGoods));

// ==========================================
// TABLE RENDERING & FILTERING
// ==========================================
function renderTable() {
    const search = searchBar.value.toLowerCase();
    const t1Filter = filterT1.value;
    const typeFilter = filterType.value;

    let filtered = currentData.filter(item => {
        let passT1 = (t1Filter === 'All' || item.t1 === t1Filter);
        let passType = (typeFilter === 'All' || item.type === typeFilter);
        let passSearch = true;
        if (search) passSearch = item.omni.includes(search);
        return passT1 && passType && passSearch;
    });

    let mapped = filtered.map(item => {
        const valueData = calculateValueMetric(item);
        return {
            ...item,
            formattedSize: formatSize(item),
            valueMetricDisplay: valueData.display,
            valueMetricSort: valueData.val
        };
    });

    mapped.sort((a, b) => {
        let valA = a[currentSort.column];
        let valB = b[currentSort.column];
        if (currentSort.column === 'ppgNum') { valA = a.valueMetricSort; valB = b.valueMetricSort; }

        if (valA < valB) return currentSort.asc ? -1 : 1;
        if (valA > valB) return currentSort.asc ? 1 : -1;
        return 0;
    });

    let html = '';

    // 5. Ghost Row Injection (Compound Key Extraction)
    if (search === "") {
        const liveKeys = currentData.map(i => `${i.slug}@${i.size}`);
        const missingKeys = watchlist.filter(k => !liveKeys.includes(k));

        missingKeys.forEach(ghostKey => {
            const [ghostSlug, ghostSize] = ghostKey.split('@');
            // Look up the clean name from the dictionary
            const dictItem = LUCID_MAP[ghostSlug] || { brand: "Unknown", strain: ghostSlug };

            html += `
            <tr class="ghost-row">
                <td onclick="toggleWatchlist('${ghostKey}')"><span class="track-btn active">💜</span></td>
                <td class="brand">${dictItem.brand.toUpperCase()}</td>
                <td class="strain">${dictItem.strain} <span class="ghost-badge">OUT OF STOCK</span></td>
                <td>--</td>
                <td>--</td>
                <td style="color:#fff; font-weight:bold;">${ghostSize}</td>
                <td>--</td>
                <td>--</td>
                <td>--</td>
            </tr>`;
        });
    }

    // 6. Live Rows (Compound Key Assignment)
    mapped.forEach(item => {
        const compoundKey = `${item.slug}@${item.size}`;
        const isTracked = watchlist.includes(compoundKey);
        const heartHtml = isTracked ? `<span class="track-btn active">💜</span>` : `<span class="track-btn">🤍</span>`;
        const typeClass = item.type.toLowerCase();

        html += `
        <tr>
            <td onclick="toggleWatchlist('${compoundKey}')">${heartHtml}</td>
            <td class="brand">${item.brand}</td>
            <td class="strain">${item.strain}</td>
            <td><span style="color:var(--text-muted);">${item.t1} &rarr;</span> ${item.t2}</td>
            <td><span class="badge ${typeClass}">${item.type}</span></td>
            <td>${item.formattedSize}</td>
            <td>${item.thcDisplay}</td>
            <td class="price">${item.priceDisplay}</td>
            <td>${item.valueMetricDisplay}</td>
        </tr>`;
    });

    if (mapped.length === 0 && search !== "") {
        html = `<tr><td colspan="9" style="text-align: center; color: #888; padding: 40px;">No matching items found.</td></tr>`;
    }

    tableBody.innerHTML = html;
}

// Event Listeners
searchBar.addEventListener('input', renderTable);
filterT1.addEventListener('change', renderTable);
filterType.addEventListener('change', renderTable);

document.querySelectorAll('th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
        const col = th.getAttribute('data-sort');
        if (currentSort.column === col) {
            currentSort.asc = !currentSort.asc;
        } else {
            currentSort.column = col;
            currentSort.asc = true;
        }
        renderTable();
    });
});

// Boot
loadWatchlist();
