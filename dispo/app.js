import { riseConfig, normalizeRise } from './rise.js';
import { greenGoodsConfig, normalizeGreenGoods } from './greengoods.js';

const WORKER_URL = "https://dispo.askozicki.workers.dev";
const SECRET = "stoner@4data#7HEIST";

let rawInventory = null; 
let cleanInventory = []; 
let currentSort = { col: 'thc', dir: 'desc' };

function updateTier1Dropdown() {
    const select = document.getElementById('filterTier1');
    select.innerHTML = '<option value="All">All Master Categories</option>';
    const unique = [...new Set(cleanInventory.map(i => i.t1))].sort();
    unique.forEach(c => select.innerHTML += `<option value="${c}">${c}</option>`);
}

function renderTable() {
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = ''; 

    const search = document.getElementById('searchBar').value.toLowerCase();
    const t1F = document.getElementById('filterTier1').value;
    const typeF = document.getElementById('filterType').value;

    let data = cleanInventory.filter(item => {
        return (search === "" || item.omni.includes(search)) &&
               (t1F === "All" || item.t1 === t1F) &&
               (typeF === "All" || item.type === typeF);
    });

    data.sort((a, b) => {
        let valA = a.thcNum, valB = b.thcNum; 
        if(currentSort.col === 'strain') { valA = a.strain; valB = b.strain; }
        if(currentSort.col === 'brand') { valA = a.brand; valB = b.brand; }
        if(currentSort.col === 'subcat') { valA = a.t2; valB = b.t2; }
        if(currentSort.col === 'type') { valA = a.type; valB = b.type; }
        if(currentSort.col === 'thc') { valA = a.thcNum; valB = b.thcNum; }
        if(currentSort.col === 'price') { valA = a.priceNum || 9999; valB = b.priceNum || 9999; }
        if(currentSort.col === 'ppg') { valA = a.ppgNum || 9999; valB = b.ppgNum || 9999; }

        if (valA < valB) return currentSort.dir === 'asc' ? -1 : 1;
        if (valA > valB) return currentSort.dir === 'asc' ? 1 : -1;
        return 0;
    });

    data.forEach((item, index) => {
        const tr = document.createElement('tr');
        tr.className = 'main-row';
        
        const btnHtml = item.deepData.has ? `<button class="btn-expand" data-index="${index}">[+]</button>` : `<button class="btn-expand disabled">[-]</button>`;
        const terpBadges = item.deepData.terps.map(t => `<span class="terp-badge">${t}</span>`).join('');
        
        tr.innerHTML = `
          <td>${btnHtml}</td>
          <td><strong>${item.strain}</strong></td>
          <td class="col-brand muted">${item.brand}</td>
          <td class="col-cat">${item.t2}</td>
          <td class="col-type type-${item.type.toLowerCase()}">${item.type}</td>
          <td class="col-size">${item.size}</td>
          <td class="col-thc">${item.thcDisplay}</td>
          <td class="col-price price-tag">${item.priceDisplay}</td>
          <td class="col-ppg muted">${item.ppgDisplay}</td>
        `;
        tbody.appendChild(tr);

        if (item.deepData.has) {
            const detailRow = document.createElement('tr');
            detailRow.id = `detail-${index}`;
            detailRow.className = 'details-row';
            detailRow.innerHTML = `
                <td colspan="9">
                    <div class="details-content">
                        ${terpBadges ? `<div style="margin-bottom:10px;">${terpBadges}</div>` : ''}
                        <div>${item.deepData.desc.replace(/\n/g, '<br>')}</div>
                    </div>
                </td>
            `;
            tbody.appendChild(detailRow);
        }
    });

    document.querySelectorAll('.btn-expand').forEach(btn => {
        btn.addEventListener('click', (e) => {
            if (e.target.classList.contains('disabled')) return;
            const index = e.target.getAttribute('data-index');
            const row = document.getElementById(`detail-${index}`);
            if (row.classList.contains('open')) {
                row.classList.remove('open');
                e.target.innerText = '[+]';
                e.target.style.color = "var(--text-muted)";
            } else {
                row.classList.add('open');
                e.target.innerText = '[-]';
                e.target.style.color = "var(--accent)";
            }
        });
    });

    document.getElementById('status').innerText = `LUCID ACTIVE | ${data.length} records displayed.`;
    applyColumnVisibility(); 
}

function applyColumnVisibility() {
    document.querySelectorAll('.col-toggle').forEach(checkbox => {
        const className = checkbox.value;
        const elements = document.querySelectorAll(`.${className}`);
        elements.forEach(el => el.style.display = checkbox.checked ? '' : 'none');
    });
}

// Event Listeners
document.querySelectorAll('.col-toggle').forEach(cb => cb.addEventListener('change', applyColumnVisibility));
const viewBtn = document.getElementById('viewBtn');
const colDropdown = document.getElementById('colDropdown');
viewBtn.addEventListener('click', () => colDropdown.style.display = colDropdown.style.display === 'flex' ? 'none' : 'flex');

document.querySelectorAll('th.sortable').forEach(th => {
    th.addEventListener('click', () => {
        const col = th.getAttribute('data-sort');
        if (currentSort.col === col) {
            currentSort.dir = currentSort.dir === 'asc' ? 'desc' : 'asc';
        } else {
            currentSort.col = col;
            currentSort.dir = 'desc'; 
        }
        document.querySelectorAll('th').forEach(h => h.classList.remove('sort-active'));
        th.classList.add('sort-active');
        renderTable();
    });
});

document.getElementById('searchBar').addEventListener('input', renderTable);
document.getElementById('filterTier1').addEventListener('change', renderTable);
document.getElementById('filterType').addEventListener('change', renderTable);

document.getElementById('fetchBtn').addEventListener('click', async (e) => {
    const sel = document.getElementById('dispensary').value;
    const statusDiv = document.getElementById('status');
    const btn = e.target;
    if (!sel) return;

    btn.disabled = true;
    btn.innerText = "Ingesting...";
    statusDiv.innerText = `Establishing connection to ${sel}...`;
    statusDiv.style.color = "var(--text-muted)";
    document.getElementById('tableWrapper').style.display = 'none';
    document.getElementById('filterBar').style.display = 'none';
    
    try {
        const config = sel === 'rise' ? riseConfig : greenGoodsConfig;
        const res = await fetch(`${WORKER_URL}?target=${encodeURIComponent(config.url)}`, {
            method: "POST", headers: { "X-Proxy-Secret": SECRET, "Content-Type": "application/json" },
            body: JSON.stringify(config.payload)
        });
        
        if (!res.ok) throw new Error(`Link Severed [${res.status}]: ` + await res.text());
        
        rawInventory = await res.json();
        statusDiv.innerText = "Data ingested. Running Lossless Taxonomy Engine...";
        
        cleanInventory = sel === 'rise' ? normalizeRise(rawInventory) : normalizeGreenGoods(rawInventory);
        updateTier1Dropdown();
        
        document.getElementById('filterBar').style.display = 'flex';
        document.getElementById('tableWrapper').style.display = 'block';
        
        document.querySelector('th[data-sort="thc"]').classList.add('sort-active');
        renderTable();
        
    } catch (err) {
        statusDiv.innerText = "CRITICAL FAILURE: " + err.message;
        statusDiv.style.color = "#ff453a";
    } finally {
        btn.disabled = false;
        btn.innerText = "Ingest & Normalize";
    }
});

document.getElementById('exportSelect').addEventListener('change', (e) => {
    const mode = e.target.value;
    if (!mode || !rawInventory) { e.target.value = ""; return; }
    
    const dataToExport = mode === 'raw' ? rawInventory : cleanInventory;
    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.setAttribute("href", url);
    anchor.setAttribute("download", `lucid_${document.getElementById('dispensary').value}_${mode}.json`);
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    
    e.target.value = ""; 
});
