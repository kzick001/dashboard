/* ============================================================ Cookscribe — app.js */

/* ------------------------------------------------------------ constants */
const WORKER      = 'https://cookscribe.askozicki.workers.dev';
const KEY_STORE   = 'cookscribe::key';
const PROMPT_STORE = 'cookscribe::prompt';
const LIMITS_STORE = 'cookscribe::limits';
const CS_TOKEN_STORE = 'cookscribe::cooksmith_token';

const DEFAULT_LIMITS = ['cilantro', 'apple', 'egg yolk', 'cream', 'butter', 'heavy dairy'];

const DEFAULT_FORMAT_PROMPT = `You reformat scraped recipe data into a strict house format. Output ONLY valid JSON, no markdown, no preamble. Schema:
{
  "name": string,
  "ingredients": [string],
  "steps": [string],
  "storage_reheat": string,
  "variations_subs": string,
  "limit_violations": [string]
}
Rules:
- No food-blog intros, no narrative fluff. Steps are imperative and tight.
- Default to mild spice unless the source is explicitly a spicy dish.
- Hard limits to FLAG in limit_violations if the recipe contains them: cilantro, apples, egg yolks, heavy dairy. For each violation also append a one-line substitution suggestion into variations_subs.
- storage_reheat: concise fridge/freezer life + reheat method.
- variations_subs: 2-4 quick swaps, weeknight-friendly, no specialty-store trips.
- Preserve all real ingredient quantities from the source. Do not invent.`;

const ERROR_MESSAGES = {
  AUTH_REQUIRED:    'App key required. Set it in Settings.',
  AUTH_INVALID:     'Invalid app key. Check Settings.',
  EXTRACT_FAILED:   'Could not extract recipe from that page.',
  NO_RECIPE_FOUND:  'No structured recipe data found on that page.',
  FETCH_FAILED:     'Could not fetch that URL. The site may block scrapers.',
  FORMAT_FAILED:    'Formatting service error. Try again.',
  IMPORT_NOT_FOUND: 'Import not found.',
  VALIDATION_ERROR: 'Please check your input and try again.',
  INTERNAL_ERROR:   'Something went wrong. Try again.',
};

/* ------------------------------------------------------------ global state */
const AppState = {
  key:   localStorage.getItem(KEY_STORE) || '',
  view:  null,
  index: [],
};

/* ------------------------------------------------------------ icon helper */
function icon(id, cls = '') {
  return `<svg class="${cls}" aria-hidden="true"><use href="#icon-${id}"/></svg>`;
}

/* ------------------------------------------------------------ api client */
async function api(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (AppState.key) headers['X-Cookscribe-Key'] = AppState.key;
  const res = await fetch(WORKER + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw (data && data.code ? data : { code: 'INTERNAL_ERROR', message: 'Request failed.' });
  }
  return data;
}

/* ------------------------------------------------------------ toast */
function toast(message, type = 'default') {
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = message;
  document.getElementById('toast-container').appendChild(el);
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('show')));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
  }, 3600);
}

/* ------------------------------------------------------------ confirm modal */
function confirm(title, message, okLabel = 'Delete', okClass = 'btn-danger') {
  return new Promise((resolve) => {
    const modal   = document.getElementById('confirm-modal');
    const titleEl = document.getElementById('confirm-title');
    const msgEl   = document.getElementById('confirm-message');
    const okBtn   = document.getElementById('confirm-ok');
    const cancelBtn = document.getElementById('confirm-cancel');
    const closeBtn  = document.getElementById('confirm-close');

    titleEl.textContent = title;
    msgEl.textContent   = message;
    okBtn.textContent   = okLabel;
    okBtn.className     = `btn ${okClass}`;
    modal.classList.remove('hidden');

    function cleanup(result) {
      modal.classList.add('hidden');
      okBtn.onclick = null;
      cancelBtn.onclick = null;
      closeBtn.onclick  = null;
      resolve(result);
    }
    okBtn.onclick     = () => cleanup(true);
    cancelBtn.onclick = () => cleanup(false);
    closeBtn.onclick  = () => cleanup(false);
  });
}

/* ------------------------------------------------------------ nav */
function renderNav() {
  // Desktop nav-links
  document.querySelectorAll('[data-route]').forEach((el) => {
    const r = el.dataset.route;
    el.classList.toggle('active', r === AppState.view);
  });
}

/* ------------------------------------------------------------ relative time */
function relativeTime(ms) {
  const diff = Date.now() - ms;
  const min  = Math.floor(diff / 60000);
  if (min < 1)  return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24)  return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  if (d < 7)    return `${d}d ago`;
  return new Date(ms).toLocaleDateString();
}

/* ------------------------------------------------------------ limit scanner */
function scanLimits(ingredients) {
  const text = ingredients.join(' ').toLowerCase();
  const LIMIT_MAP = [
    { words: ['cilantro'],                       label: 'cilantro' },
    { words: ['apple', 'applesauce'],            label: 'apples' },
    { words: ['egg yolk', 'yolk'],               label: 'egg yolks' },
    { words: ['heavy cream', 'heavy dairy', 'butter', 'cream cheese', 'sour cream', 'half-and-half'], label: 'heavy dairy' },
  ];
  const found = [];
  for (const { words, label } of LIMIT_MAP) {
    if (words.some((w) => text.includes(w)) && !found.includes(label)) {
      found.push(label);
    }
  }
  return found;
}

/* ------------------------------------------------------------ index loader */
async function loadIndex() {
  try {
    const data = await api('GET', '/imports');
    AppState.index = data.items || [];
  } catch {
    AppState.index = [];
  }
}

/* ------------------------------------------------------------ PDF helpers */
const PDFJS_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
const PDFJS_WORKER_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
const TESSERACT_URL = 'https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/5.0.4/tesseract.min.js';

async function loadPdfJs() {
  if (window.pdfjsLib) return window.pdfjsLib;
  await new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = PDFJS_URL;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
  return window.pdfjsLib;
}

async function extractPdfText(file) {
  const pdfjs = await loadPdfJs();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  const pageTexts = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    pageTexts.push(content.items.map((it) => it.str).join(' '));
  }
  return { pageTexts, numPages: pdf.numPages, pdf };
}

async function loadTesseract() {
  if (window.Tesseract) return window.Tesseract;
  await new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = TESSERACT_URL;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
  return window.Tesseract;
}

async function ocrPdf(file, pdf, numPages, onProgress) {
  const Tesseract = await loadTesseract();
  const worker = await Tesseract.createWorker('eng');
  const pageTexts = [];
  for (let i = 1; i <= numPages; i++) {
    onProgress(`OCR page ${i} of ${numPages}…`);
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2.0 });
    const canvas = document.createElement('canvas');
    canvas.width  = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    const { data: { text } } = await worker.recognize(canvas);
    pageTexts.push(text);
  }
  await worker.terminate();
  return pageTexts;
}

async function doPdf(file, setStatus, configPrompt) {
  setStatus('Reading PDF…');
  let pageTexts, numPages, pdfDoc;
  try {
    const result = await extractPdfText(file);
    pageTexts = result.pageTexts;
    numPages  = result.numPages;
    pdfDoc    = result.pdf;
  } catch (e) {
    setStatus('Could not read PDF. File may be corrupted.', 'error');
    return null;
  }

  const totalChars = pageTexts.join('').replace(/\s/g, '').length;
  const avgCharsPerPage = totalChars / Math.max(numPages, 1);

  if (avgCharsPerPage < 40) {
    setStatus('Scanned PDF detected — running OCR (this may take a minute)…');
    try {
      pageTexts = await ocrPdf(file, pdfDoc, numPages, setStatus);
    } catch (e) {
      setStatus('OCR failed. Try a text-based PDF.', 'error');
      return null;
    }
  }

  const fullText = pageTexts.join('\n\n').trim();
  if (!fullText) {
    setStatus('No text extracted from PDF.', 'error');
    return null;
  }

  // PDFs always go through /format — no JSON-LD available
  setStatus('Formatting via Claude…');
  const rawPdf = { name: file.name.replace(/\.pdf$/i, ''), text: fullText,
                   ingredients: [], steps: [], servings: null, total_time: null, image_url: null };
  let formatted;
  try {
    const res = await api('POST', '/format', {
      raw:    rawPdf,
      prompt: configPrompt || undefined,
    });
    formatted = res.formatted;
  } catch (err) {
    const msg = ERROR_MESSAGES[err.code] || err.message || 'Format failed.';
    setStatus(msg, 'error');
    return null;
  }

  return {
    record: {
      name:          formatted.name || file.name.replace(/\.pdf$/i, '') || 'PDF Recipe',
      source_type:   'pdf',
      source_url:    null,
      source_domain: 'PDF',
      mode:          'spec',
      raw:           rawPdf,
      formatted,
    },
  };
}

/* ------------------------------------------------------------ view: Import */
function renderImport() {
  const el = document.getElementById('view-container');
  el.innerHTML = `
    <div class="view-header">
      <h1>Import a Recipe</h1>
    </div>

    <div class="import-modes">
      <button class="import-mode-btn" id="mode-raw" data-mode="raw">
        Raw
        <small>Ingredients &amp; steps as-scraped</small>
      </button>
      <button class="import-mode-btn active" id="mode-spec" data-mode="spec">
        Spec-formatted
        <small>Reformatted via Claude to house format</small>
      </button>
    </div>

    <div style="display:flex;gap:var(--s2);margin-bottom:var(--s4)">
      <input id="url-input" type="url" placeholder="https://example.com/recipe"
        style="flex:1" autocomplete="off" spellcheck="false"/>
      <button class="btn btn-primary" id="fetch-btn">
        ${icon('link')} Fetch
      </button>
    </div>

    <div id="import-status" style="min-height:24px;margin-bottom:var(--s2)"></div>

    <div style="margin:var(--s4) 0">
      <p class="text-sm text-muted" style="margin-bottom:var(--s2)">Or drop a PDF:</p>
      <div class="dropzone" id="pdf-dropzone" tabindex="0" role="button" aria-label="Drop a PDF or click to browse">
        <svg aria-hidden="true"><use href="#icon-file-text"/></svg>
        <div class="text-sm" style="margin-top:var(--s2)">Drop a recipe PDF here, or click to browse</div>
        <div class="text-sm text-muted" style="margin-top:4px">PDFs are always Spec-formatted via Claude</div>
      </div>
      <input type="file" id="pdf-input" accept=".pdf,application/pdf" style="display:none"/>
    </div>

    <div id="recent-section"></div>
  `;

  // mode toggle
  let currentMode = 'spec';
  el.querySelectorAll('.import-mode-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      currentMode = btn.dataset.mode;
      el.querySelectorAll('.import-mode-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // URL submit
  const urlInput  = el.querySelector('#url-input');
  const fetchBtn  = el.querySelector('#fetch-btn');
  const statusEl  = el.querySelector('#import-status');

  function setStatus(msg, type = '') {
    statusEl.innerHTML = msg
      ? `<span class="text-sm ${type === 'error' ? 'text-danger' : 'text-muted'}">${msg}</span>`
      : '';
  }

  async function doFetch() {
    const url = urlInput.value.trim();
    if (!url) { setStatus('Paste a URL first.', 'error'); return; }
    if (!AppState.key) {
      setStatus('No app key set — go to Settings first.', 'error'); return;
    }

    fetchBtn.disabled = true;
    fetchBtn.innerHTML = icon('refresh') + ' Fetching…';
    setStatus('Fetching page…');

    let raw;
    try {
      const res = await api('POST', '/extract/url', { url });
      raw = res.raw;
    } catch (err) {
      const msg = ERROR_MESSAGES[err.code] || err.message || 'Fetch failed.';
      setStatus(msg, 'error');
      fetchBtn.disabled = false;
      fetchBtn.innerHTML = icon('link') + ' Fetch';
      return;
    }

    let formatted;
    if (currentMode === 'spec') {
      setStatus('Formatting via Claude…');
      const configPrompt = localStorage.getItem(PROMPT_STORE) || '';
      try {
        const res = await api('POST', '/format', {
          raw,
          prompt: configPrompt || undefined,
        });
        formatted = res.formatted;
      } catch (err) {
        const msg = ERROR_MESSAGES[err.code] || err.message || 'Format failed.';
        setStatus(msg, 'error');
        fetchBtn.disabled = false;
        fetchBtn.innerHTML = icon('link') + ' Fetch';
        return;
      }
    } else {
      // Raw mode: map raw to house schema client-side
      formatted = {
        name:            raw.name,
        ingredients:     raw.ingredients || [],
        steps:           raw.steps || [],
        storage_reheat:  '',
        variations_subs: '',
        limit_violations: scanLimits(raw.ingredients || []),
      };
    }

    setStatus('Saving…');
    const domain = (() => {
      try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
    })();

    const record = {
      name:         formatted.name || raw.name || 'Untitled recipe',
      source_type:  'url',
      source_url:   url,
      source_domain: domain,
      mode:         currentMode,
      raw,
      formatted,
    };

    let saved;
    try {
      saved = await api('POST', '/imports', record);
    } catch (err) {
      const msg = ERROR_MESSAGES[err.code] || err.message || 'Save failed.';
      setStatus(msg, 'error');
      fetchBtn.disabled = false;
      fetchBtn.innerHTML = icon('link') + ' Fetch';
      return;
    }

    // Refresh index then navigate
    await loadIndex();
    location.hash = `#review/${saved.id}`;
  }

  fetchBtn.addEventListener('click', doFetch);
  urlInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') doFetch(); });

  // PDF dropzone
  const dropzone = el.querySelector('#pdf-dropzone');
  const pdfInput = el.querySelector('#pdf-input');

  async function handlePdfFile(file) {
    if (!file || !file.name.toLowerCase().endsWith('.pdf')) {
      setStatus('Only PDF files are supported.', 'error'); return;
    }
    if (!AppState.key) {
      setStatus('No app key set — go to Settings first.', 'error'); return;
    }
    fetchBtn.disabled = true;
    dropzone.style.pointerEvents = 'none';
    dropzone.style.opacity = '0.5';

    const configPrompt = localStorage.getItem(PROMPT_STORE) || '';
    const result = await doPdf(file, setStatus, configPrompt);

    fetchBtn.disabled = false;
    dropzone.style.pointerEvents = '';
    dropzone.style.opacity = '';

    if (!result) return; // setStatus already set an error

    setStatus('Saving…');
    let saved;
    try {
      saved = await api('POST', '/imports', result.record);
    } catch (err) {
      setStatus(ERROR_MESSAGES[err.code] || err.message || 'Save failed.', 'error'); return;
    }
    await loadIndex();
    location.hash = `#review/${saved.id}`;
  }

  dropzone.addEventListener('click', () => pdfInput.click());
  dropzone.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') pdfInput.click(); });
  pdfInput.addEventListener('change', () => { if (pdfInput.files[0]) handlePdfFile(pdfInput.files[0]); });

  dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) handlePdfFile(file);
  });

  // Render recent imports
  renderRecentImports(el.querySelector('#recent-section'));
}

function renderRecentImports(container) {
  const recent = AppState.index.slice(0, 5);
  if (!recent.length) {
    container.innerHTML = '';
    return;
  }
  container.innerHTML = `
    <p class="text-sm text-muted" style="margin-bottom:var(--s2)">Recent imports</p>
    <div class="recent-list">
      ${recent.map((r) => `
        <a class="recent-card" href="#review/${r.id}">
          <span class="truncate" style="flex:1">${escHtml(r.name)}</span>
          <span class="recent-card-meta">
            <span>${escHtml(r.source_domain || 'PDF')}</span>
            <span class="badge ${r.mode === 'spec' ? 'badge-mode-spec' : 'badge-mode-raw'}">${r.mode}</span>
            <span>${relativeTime(r.imported_at)}</span>
          </span>
        </a>
      `).join('')}
    </div>
  `;
}

/* ------------------------------------------------------------ view: Review */
async function renderReview(id) {
  const el = document.getElementById('view-container');

  if (!id) {
    el.innerHTML = `<div class="empty-state">${icon('book')}<p>No import selected.</p></div>`;
    return;
  }

  el.innerHTML = `<div class="skeleton" style="height:200px;border-radius:var(--r2)"></div>`;

  let record;
  try {
    const res = await api('GET', `/imports/${id}`);
    record = res.record;
  } catch (err) {
    const msg = ERROR_MESSAGES[err.code] || err.message || 'Load failed.';
    el.innerHTML = `<div class="empty-state"><p class="text-danger">${escHtml(msg)}</p></div>`;
    return;
  }

  let dirty = false;

  function buildFormattedPane(f) {
    const violations = f.limit_violations || [];
    const violationHtml = violations.length
      ? `<div style="display:flex;gap:var(--s1);flex-wrap:wrap;margin-bottom:var(--s2)" id="violation-chips">
           ${violations.map((v) => `<span class="limit-flag">${icon('alert')}${escHtml(v)}</span>`).join('')}
         </div>`
      : `<div id="violation-chips"></div>`;

    return `
      <div class="review-pane-header">House format</div>
      <div class="review-pane-body" id="fmt-pane-body">
        <div>
          <label class="text-sm" style="font-weight:600;display:block;margin-bottom:4px">Name</label>
          <input id="f-name" type="text" value="${escHtml(f.name || '')}" style="width:100%"/>
        </div>
        ${violationHtml}
        <div>
          <label class="text-sm" style="font-weight:600;display:block;margin-bottom:4px">Ingredients <span class="text-muted" style="font-weight:400">(one per line)</span></label>
          <textarea id="f-ingredients" rows="8" style="width:100%;resize:vertical">${escHtml((f.ingredients || []).join('\n'))}</textarea>
        </div>
        <div>
          <label class="text-sm" style="font-weight:600;display:block;margin-bottom:4px">Steps <span class="text-muted" style="font-weight:400">(one per line)</span></label>
          <textarea id="f-steps" rows="10" style="width:100%;resize:vertical">${escHtml((f.steps || []).join('\n'))}</textarea>
        </div>
        <div>
          <label class="text-sm" style="font-weight:600;display:block;margin-bottom:4px">Storage &amp; reheat</label>
          <textarea id="f-storage" rows="3" style="width:100%;resize:vertical">${escHtml(f.storage_reheat || '')}</textarea>
        </div>
        <div>
          <label class="text-sm" style="font-weight:600;display:block;margin-bottom:4px">Variations &amp; subs</label>
          <textarea id="f-variations" rows="4" style="width:100%;resize:vertical">${escHtml(f.variations_subs || '')}</textarea>
        </div>
      </div>
    `;
  }

  function readFormFields() {
    return {
      name:            el.querySelector('#f-name').value.trim(),
      ingredients:     el.querySelector('#f-ingredients').value.split('\n').map((s) => s.trim()).filter(Boolean),
      steps:           el.querySelector('#f-steps').value.split('\n').map((s) => s.trim()).filter(Boolean),
      storage_reheat:  el.querySelector('#f-storage').value.trim(),
      variations_subs: el.querySelector('#f-variations').value.trim(),
      limit_violations: (record.formatted || {}).limit_violations || [],
    };
  }

  el.innerHTML = `
    <div class="view-header">
      <div>
        <h1 style="margin-bottom:4px" id="review-title">${escHtml(record.name)}</h1>
        <span class="text-sm text-muted">
          ${escHtml(record.source_domain || 'PDF')} &middot;
          <span class="badge ${record.mode === 'spec' ? 'badge-mode-spec' : 'badge-mode-raw'}">${record.mode}</span> &middot;
          ${relativeTime(record.imported_at)}
        </span>
      </div>
    </div>

    <div class="review-grid">
      <div class="review-pane">
        <div class="review-pane-header">Source extraction</div>
        <div class="review-pane-body raw" style="max-height:70vh;overflow-y:auto">${escHtml(JSON.stringify(record.raw, null, 2))}</div>
      </div>
      <div class="review-pane" id="fmt-pane">
        ${buildFormattedPane(record.formatted || {})}
      </div>
    </div>

    <div class="action-bar">
      <button class="btn btn-primary" id="save-btn">${icon('check')} Save</button>
      <button class="btn btn-ghost-accent" id="rerun-btn">${icon('sparkle')} Re-run Claude</button>
      <button class="btn btn-ghost" id="export-btn">${icon('download')} Export JSON</button>
      <button class="btn btn-ghost" id="cooksmith-btn" title="Send to Cooksmith">${icon('import')} Cooksmith</button>
      <span class="spacer"></span>
      <button class="btn-icon" id="delete-btn" title="Delete import">${icon('trash')}</button>
    </div>
  `;

  // Mark dirty on any field change
  el.querySelector('#fmt-pane').addEventListener('input', () => { dirty = true; });

  // --- Save ---
  el.querySelector('#save-btn').addEventListener('click', async () => {
    const saveBtn = el.querySelector('#save-btn');
    const updated = readFormFields();
    saveBtn.disabled = true;
    saveBtn.innerHTML = icon('refresh') + ' Saving…';
    try {
      await api('PUT', `/imports/${id}`, {
        name:      updated.name || record.name,
        formatted: updated,
        mode:      record.mode,
      });
      record.name      = updated.name || record.name;
      record.formatted = updated;
      el.querySelector('#review-title').textContent = record.name;
      dirty = false;
      await loadIndex();
      toast('Saved.', 'success');
    } catch (err) {
      toast(ERROR_MESSAGES[err.code] || err.message || 'Save failed.', 'error');
    } finally {
      saveBtn.disabled = false;
      saveBtn.innerHTML = icon('check') + ' Save';
    }
  });

  // --- Re-run Claude ---
  el.querySelector('#rerun-btn').addEventListener('click', async () => {
    const rerunBtn = el.querySelector('#rerun-btn');
    rerunBtn.disabled = true;
    rerunBtn.innerHTML = icon('refresh') + ' Running…';
    const configPrompt = localStorage.getItem(PROMPT_STORE) || '';
    try {
      const res = await api('POST', '/format', {
        raw:    record.raw,
        prompt: configPrompt || undefined,
      });
      record.formatted = res.formatted;
      dirty = false;
      // Replace the right pane in-place
      el.querySelector('#fmt-pane').innerHTML = buildFormattedPane(res.formatted);
      el.querySelector('#fmt-pane').addEventListener('input', () => { dirty = true; });
      toast('Re-formatted.', 'success');
    } catch (err) {
      toast(ERROR_MESSAGES[err.code] || err.message || 'Re-run failed.', 'error');
    } finally {
      rerunBtn.disabled = false;
      rerunBtn.innerHTML = icon('sparkle') + ' Re-run Claude';
    }
  });

  // --- Export JSON ---
  el.querySelector('#export-btn').addEventListener('click', () => {
    const f = readFormFields();
    const exportRecord = { ...record, formatted: f };
    const blob = new Blob([JSON.stringify(exportRecord, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${(f.name || record.name || 'recipe').replace(/[^a-z0-9]+/gi, '_').toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  });

  // --- Send to Cooksmith ---
  el.querySelector('#cooksmith-btn').addEventListener('click', async () => {
    const csToken = localStorage.getItem(CS_TOKEN_STORE) || '';
    if (!csToken) {
      toast('No Cooksmith token set — add it in Settings.', 'error');
      return;
    }

    const f = readFormFields();
    if (!f.name) {
      toast('Save a name before exporting.', 'error');
      return;
    }

    // Parse ISO 8601 duration (e.g. PT45M, PT1H30M) → minutes, fallback 30
    function parseDuration(iso) {
      if (!iso) return 30;
      const h = (iso.match(/(\d+)H/) || [])[1] || 0;
      const m = (iso.match(/(\d+)M/) || [])[1] || 0;
      const total = parseInt(h) * 60 + parseInt(m);
      return total > 0 ? total : 30;
    }

    const duration = parseDuration(record.raw && record.raw.total_time);

    const payload = {
      recipe: {
        name:  f.name,
        notes: [f.storage_reheat, f.variations_subs].filter(Boolean).join('\n\n'),
      },
      components: [{
        name:            f.name,
        category:        'other',
        appliance:       'Stovetop',
        duration,
        can_start_anytime: false,
        steps:           f.steps,
        notes:           '',
        sort_order:      0,
      }],
    };

    const csBtn = el.querySelector('#cooksmith-btn');
    csBtn.disabled = true;
    csBtn.innerHTML = icon('refresh') + ' Exporting…';

    try {
      const res = await fetch('https://api.cooksmith.kzick.dev/import', {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${csToken}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `Cooksmith returned ${res.status}.`);
      }

      const data = await res.json();
      const slug = data.recipe && data.recipe.slug;
      const link = slug ? `https://cooksmith.kzick.dev/#recipe/${slug}` : 'https://cooksmith.kzick.dev';
      toast(`Sent to Cooksmith! Opening draft…`, 'success');
      setTimeout(() => window.open(link, '_blank'), 800);
    } catch (err) {
      toast(err.message || 'Cooksmith export failed.', 'error');
    } finally {
      csBtn.disabled = false;
      csBtn.innerHTML = icon('import') + ' Cooksmith';
    }
  });

  // --- Delete ---
  el.querySelector('#delete-btn').addEventListener('click', async () => {
    const ok = await confirm('Delete import', `Delete "${record.name}"? This cannot be undone.`);
    if (!ok) return;
    try {
      await api('DELETE', `/imports/${id}`);
      await loadIndex();
      location.hash = '#library';
    } catch (err) {
      toast(ERROR_MESSAGES[err.code] || err.message || 'Delete failed.', 'error');
    }
  });
}

/* ------------------------------------------------------------ view: Library */
function renderLibrary() {
  const el = document.getElementById('view-container');

  function render(items) {
    if (!items.length) {
      el.querySelector('#lib-grid').innerHTML = `
        <div class="empty-state" style="grid-column:1/-1">
          ${icon('book')}
          <p class="empty-state-title">No imports yet</p>
          <p class="empty-state-body">Head to <a href="#import">Import</a> to pull in your first recipe.</p>
        </div>`;
      return;
    }
    el.querySelector('#lib-grid').innerHTML = items.map((r) => `
      <a class="card" href="#review/${r.id}" style="text-decoration:none;display:block;cursor:pointer">
        <div class="card-body">
          <div style="font-weight:600;margin-bottom:var(--s2);line-height:1.3">${escHtml(r.name)}</div>
          <div class="recipe-card-meta">
            <span>${escHtml(r.source_domain || 'PDF')}</span>
            <span>&middot;</span>
            <span class="badge ${r.mode === 'spec' ? 'badge-mode-spec' : 'badge-mode-raw'}">${r.mode}</span>
            <span>&middot;</span>
            <span>${relativeTime(r.imported_at)}</span>
          </div>
        </div>
      </a>
    `).join('');
  }

  function applyFilters() {
    const q      = (el.querySelector('#lib-search').value || '').toLowerCase().trim();
    const domain = el.querySelector('#lib-domain').value;
    let items = AppState.index;
    if (q)      items = items.filter((r) => r.name.toLowerCase().includes(q));
    if (domain) items = items.filter((r) => (r.source_domain || 'PDF') === domain);
    render(items);
  }

  // Build domain options from current index
  const domains = [...new Set(AppState.index.map((r) => r.source_domain || 'PDF'))].sort();
  const domainOptions = domains.map((d) => `<option value="${escHtml(d)}">${escHtml(d)}</option>`).join('');

  el.innerHTML = `
    <div class="view-header">
      <h1>Library</h1>
      <span class="text-sm text-muted">${AppState.index.length} import${AppState.index.length !== 1 ? 's' : ''}</span>
    </div>

    <div class="filter-row">
      <input id="lib-search" type="search" placeholder="Search by name…" />
      <select id="lib-domain">
        <option value="">All sources</option>
        ${domainOptions}
      </select>
    </div>

    <div class="card-grid" id="lib-grid"></div>
  `;

  el.querySelector('#lib-search').addEventListener('input', applyFilters);
  el.querySelector('#lib-domain').addEventListener('change', applyFilters);

  render(AppState.index);
}

/* ------------------------------------------------------------ view: Settings (stub) */
/* ------------------------------------------------------------ view: Settings */
function renderSettings() {
  const el = document.getElementById('view-container');

  const currentKey    = localStorage.getItem(KEY_STORE) || '';
  const currentPrompt = localStorage.getItem(PROMPT_STORE) || DEFAULT_FORMAT_PROMPT;
  const currentToken  = localStorage.getItem(CS_TOKEN_STORE) || '';
  const storedLimits  = (() => {
    try { return JSON.parse(localStorage.getItem(LIMITS_STORE)) || DEFAULT_LIMITS; }
    catch { return DEFAULT_LIMITS; }
  })();

  el.innerHTML = `
    <div class="view-header">
      <h1>Settings</h1>
    </div>

    <!-- App key -->
    <div class="settings-section">
      <h3>App Key</h3>
      <p class="text-sm text-muted" style="margin-bottom:var(--s3)">
        Shared secret that gates all Worker requests. Set <code>APP_SECRET</code> in the Cloudflare Worker secrets to match.
      </p>
      <div style="display:flex;gap:var(--s2)">
        <input id="s-key" type="password" value="${escHtml(currentKey)}"
          placeholder="Paste your APP_SECRET here" style="flex:1" autocomplete="off"/>
        <button class="btn btn-primary" id="s-key-save">${icon('check')} Save</button>
      </div>
      <div id="s-key-status" style="min-height:20px;margin-top:var(--s2)"></div>
    </div>

    <!-- Cooksmith token -->
    <div class="settings-section">
      <h3>Cooksmith Token</h3>
      <p class="text-sm text-muted" style="margin-bottom:var(--s3)">
        Your Cooksmith JWT for the "Send to Cooksmith" export. Stored locally only — never sent to the Cookscribe Worker.
      </p>
      <div style="display:flex;gap:var(--s2)">
        <input id="s-cstoken" type="password" value="${escHtml(currentToken)}"
          placeholder="Paste your Cooksmith JWT here" style="flex:1" autocomplete="off"/>
        <button class="btn btn-primary" id="s-cstoken-save">${icon('check')} Save</button>
      </div>
      <div id="s-cstoken-status" style="min-height:20px;margin-top:var(--s2)"></div>
    </div>

    <!-- Hard limits -->
    <div class="settings-section">
      <h3>Hard Limits</h3>
      <p class="text-sm text-muted" style="margin-bottom:var(--s3)">
        Ingredients scanned client-side for limit violations. One term per line. Case-insensitive substring match.
      </p>
      <textarea id="s-limits" rows="6" style="width:100%;resize:vertical;font-family:var(--font-mono);font-size:0.82rem">${escHtml(storedLimits.join('\n'))}</textarea>
      <div style="display:flex;gap:var(--s2);margin-top:var(--s2)">
        <button class="btn btn-primary" id="s-limits-save">${icon('check')} Save</button>
        <button class="btn btn-ghost" id="s-limits-reset">Reset to defaults</button>
      </div>
      <div id="s-limits-status" style="min-height:20px;margin-top:var(--s2)"></div>
    </div>

    <!-- Format prompt -->
    <div class="settings-section">
      <h3>Format Prompt</h3>
      <p class="text-sm text-muted" style="margin-bottom:var(--s3)">
        System prompt sent to Claude during Spec-mode formatting. Stored locally.
      </p>
      <textarea id="s-prompt" rows="14" style="width:100%;resize:vertical;font-family:var(--font-mono);font-size:0.8rem">${escHtml(currentPrompt)}</textarea>
      <div style="display:flex;gap:var(--s2);margin-top:var(--s2)">
        <button class="btn btn-primary" id="s-prompt-save">${icon('check')} Save</button>
        <button class="btn btn-ghost" id="s-prompt-reset">Reset to default</button>
      </div>
      <div id="s-prompt-status" style="min-height:20px;margin-top:var(--s2)"></div>
    </div>
  `;

  function setFieldStatus(id, msg, type = '') {
    const statusEl = el.querySelector(id);
    if (!statusEl) return;
    statusEl.innerHTML = msg
      ? `<span class="text-sm ${type === 'error' ? 'text-danger' : 'text-accent'}">${escHtml(msg)}</span>`
      : '';
    if (msg && type !== 'error') setTimeout(() => { statusEl.innerHTML = ''; }, 2500);
  }

  // App key save
  el.querySelector('#s-key-save').addEventListener('click', () => {
    const val = el.querySelector('#s-key').value.trim();
    if (!val) { setFieldStatus('#s-key-status', 'Key cannot be empty.', 'error'); return; }
    localStorage.setItem(KEY_STORE, val);
    AppState.key = val;
    setFieldStatus('#s-key-status', 'App key saved.');
    toast('App key saved.', 'success');
  });

  // Cooksmith token save
  el.querySelector('#s-cstoken-save').addEventListener('click', () => {
    const val = el.querySelector('#s-cstoken').value.trim();
    localStorage.setItem(CS_TOKEN_STORE, val);
    setFieldStatus('#s-cstoken-status', val ? 'Token saved.' : 'Token cleared.');
    toast(val ? 'Cooksmith token saved.' : 'Cooksmith token cleared.', 'success');
  });

  // Hard limits save
  el.querySelector('#s-limits-save').addEventListener('click', () => {
    const lines = el.querySelector('#s-limits').value
      .split('\n').map((s) => s.trim()).filter(Boolean);
    if (!lines.length) { setFieldStatus('#s-limits-status', 'At least one limit required.', 'error'); return; }
    localStorage.setItem(LIMITS_STORE, JSON.stringify(lines));
    setFieldStatus('#s-limits-status', `${lines.length} limits saved.`);
  });

  el.querySelector('#s-limits-reset').addEventListener('click', () => {
    el.querySelector('#s-limits').value = DEFAULT_LIMITS.join('\n');
    localStorage.removeItem(LIMITS_STORE);
    setFieldStatus('#s-limits-status', 'Reset to defaults.');
  });

  // Format prompt save
  el.querySelector('#s-prompt-save').addEventListener('click', () => {
    const val = el.querySelector('#s-prompt').value.trim();
    if (!val) { setFieldStatus('#s-prompt-status', 'Prompt cannot be empty.', 'error'); return; }
    localStorage.setItem(PROMPT_STORE, val);
    setFieldStatus('#s-prompt-status', 'Prompt saved.');
  });

  el.querySelector('#s-prompt-reset').addEventListener('click', () => {
    el.querySelector('#s-prompt').value = DEFAULT_FORMAT_PROMPT;
    localStorage.removeItem(PROMPT_STORE);
    setFieldStatus('#s-prompt-status', 'Reset to default.');
  });
}

/* ------------------------------------------------------------ util */
function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ------------------------------------------------------------ router */
const ROUTES = {
  import:   renderImport,
  review:   renderReview,
  library:  renderLibrary,
  settings: renderSettings,
};

function route(hash) {
  const raw          = (hash || location.hash).slice(1) || 'import';
  const [name, param] = raw.split('/');
  const fn           = ROUTES[name] || renderImport;
  AppState.view      = name;
  renderNav();
  fn(param);
}

window.addEventListener('hashchange', () => route(location.hash));
window.addEventListener('DOMContentLoaded', async () => {
  await loadIndex();
  route(location.hash);
});
