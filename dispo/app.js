import { normalizeRise, riseConfig } from './rise.js';
import { normalizeGreenGoods, greenGoodsConfig } from './greengoods.js';

// ==========================================
// CONFIGURATION & STATE
// ==========================================
const WORKER_URL = "https://lucid-sentinel.YOUR-CLOUDFLARE-ACCOUNT.workers.dev/watchlist"; 
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
const ghostItemInput = document.getElementById('ghostItemInput');

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
        // Normalizer outputs weight in grams. 100mg = 0.1g.
        // If an item is $20 for 100mg (0.1g), PPG is $200/g. 
        // Value per 100mg = PPG / 10 = $20.00 / 100mg.
        const per100mg = item.ppgNum / 10; 
        return { val: per100mg, display: `$${per100mg.toFixed(2)} <span class="metric">/100mg</span>` };
    }
    
    return { val: 0, display: 'N/A' };
};

// ==========================================
// WATCHLIST (SERVERLESS BRIDGE)
// ==========================================
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
    const btn = document.getElementById('syncCloudBtn');
    const originalText = btn.innerText;
    btn.innerText = "Syncing...";
    btn.disabled = true;

    try {
        await fetch(WORKER_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: API_EMAIL, watchlist: watchlist })
        });
        btn.innerText = "Synced! ✓";
        btn.classList.replace('primary', 'success');
    } catch (err) {
        alert("Failed to sync to Cloudflare.");
        btn.innerText = "Sync Failed";
    }

    setTimeout(() => {
        btn.innerText = originalText;
        btn.disabled = false;
        btn.classList.replace('success', 'primary');
    }, 2000);
}

// Attach globally for inline HTML onClick handlers
window.toggleWatchlist = (slug) => {
    if (watchlist.includes(slug)) {
        watchlist = watchlist.filter(s => s !== slug);
    } else {
        watchlist.push(slug);
    }
    renderTable();
};

document.getElementById('addGhostBtn').addEventListener('click', () => {
    const raw = ghostItemInput.value.trim();
    if (!raw.includes('-')) {
        alert("Please use the format: Brand - Strain (e.g. Rythm - Animal Face)");
        return;
    }
    const parts = raw.split('-');
    const brand = parts[0].trim();
    const strain = parts.slice(1).join('-').trim();
    const slug = generateSlug(brand, strain);
    
    if (!watchlist.includes(slug)) {
        watchlist.push(slug);
        ghostItemInput.value = "";
        renderTable();
    }
});

document.getElementById('syncCloudBtn').addEventListener('click', syncWatchlist);

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

    // 1. Filter Live Data
    let filtered = currentData.filter(item => {
        let passT1 = (t1Filter === 'All' || item.t1 === t1Filter);
        let passType = (typeFilter === 'All' || item.type === typeFilter);
        let passSearch = true;
        if (search) passSearch = item.omni.includes(search);
        return passT1 && passType && passSearch;
    });

    // 2. Map and Format for Sorting
    let mapped = filtered.map(item => {
        const valueData = calculateValueMetric(item);
        return {
            ...item,
            formattedSize: formatSize(item),
            valueMetricDisplay: valueData.display,
            valueMetricSort: valueData.val
        };
    });

    // 3. Sorting
    mapped.sort((a, b) => {
        let valA = a[currentSort.column];
        let valB = b[currentSort.column];

        // Custom sort routing
        if (currentSort.column === 'ppgNum') { valA = a.valueMetricSort; valB = b.valueMetricSort; }

        if (valA < valB) return currentSort.asc ? -1 : 1;
        if (valA > valB) return currentSort.asc ? 1 : -1;
        return 0;
    });

    let html = '';

    // 4. Ghost Row Injection (Out of Stock)
    // Only inject ghost rows if there is NO active search filter, to prevent clutter
    if (search === "") {
        const liveSlugs = currentData.map(i => i.slug);
        const missingSlugs = watchlist.filter(slug => !liveSlugs.includes(slug));

        missingSlugs.forEach(ghostSlug => {
            const parts = ghostSlug.split('-');
            const displayBrand = parts[0].toUpperCase();
            const displayStrain = parts.slice(1).join(' ').toUpperCase();

            html += `
            <tr class="ghost-row">
                <td onclick="toggleWatchlist('${ghostSlug}')"><span class="track-btn active">💜</span></td>
                <td class="brand">${displayBrand}</td>
                <td class="strain">${displayStrain} <span class="ghost-badge">OUT OF STOCK</span></td>
                <td>--</td>
                <td>--</td>
                <td>--</td>
                <td>--</td>
                <td>--</td>
                <td>--</td>
            </tr>`;
        });
    }

    // 5. Render Live Rows
    mapped.forEach(item => {
        const isTracked = watchlist.includes(item.slug);
        const heartHtml = isTracked ? `<span class="track-btn active">💜</span>` : `<span class="track-btn">🤍</span>`;
        const typeClass = item.type.toLowerCase();

        html += `
        <tr>
            <td onclick="toggleWatchlist('${item.slug}')">${heartHtml}</td>
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
