// ==========================================
// GITSYNC v1.0 — APP CONTROLLER
// Orchestrates the 6-step restructuring
// workflow and manages all UI state.
// ==========================================

'use strict';

const APP_CONFIG = {
  repo:         { owner: 'kzick001', name: 'undead-barrage' },
  defaultBranch:'main',
  targetBranch: 'v17-restructure',
  targetFolder: 'UB 17+',
  outputFolder: 'v17-clean',
  workerUrl:    'https://gitsync.askozicki.workers.dev',
};

/** @type {GitSyncApp|null} Singleton */
let _instance = null;

class GitSyncApp {
  constructor() {
    // Instantiate collaborators
    this.pinManager  = null;     // PINManager — set after PIN entry
    this.githubAPI   = new GitHubAPI();
    this.aggregator  = null;
    this.analyzer    = null;
    this.parser      = null;
    this.fixer       = null;
    this.generator   = null;

    // App state
    this.state = {
      authenticated:   false,
      aggregated:      false,
      analyzed:        false,
      restructured:    false,
      validated:       false,
      generatedFiles:  {},      // outputPath → content
      analysisReport:  null,
      validationErrors:[],
    };
  }

  // ─── INIT ────────────────────────────────────────────────────────────────

  /** Wire all DOM event listeners. Called once on DOMContentLoaded. */
  init() {
    // PIN form
    document.getElementById('pinForm').addEventListener('submit', e => {
      e.preventDefault();
      this._onPinSubmit();
    });
    document.getElementById('logoutBtn').addEventListener('click', () => this._onLogout());

    // Workflow buttons
    document.getElementById('aggregateBtn').addEventListener('click', () => this.stepAggregate());
    document.getElementById('analyzeBtn').addEventListener('click', () => this.stepAnalyze());
    document.getElementById('backToAggregateBtn').addEventListener('click', () => this._showSection('none'));
    document.getElementById('restructureBtn').addEventListener('click', () => this.stepRestructure());
    document.getElementById('backToAnalysisBtn').addEventListener('click', () => {
      document.getElementById('restructureSection').style.display = 'none';
      document.getElementById('analysisSection').style.display   = 'block';
    });
    document.getElementById('validateBtn').addEventListener('click', () => this.stepValidate());
    document.getElementById('previewFilesBtn').addEventListener('click', () => this.stepPreview());
    document.getElementById('dryRunBtn').addEventListener('click', () => this._onDryRun());
    document.getElementById('commitBtn').addEventListener('click', () => this.stepCommit());
    document.getElementById('cancelBtn').addEventListener('click', () => {
      document.getElementById('commitSection').style.display = 'none';
    });
    document.getElementById('restartBtn').addEventListener('click', () => location.reload());
    document.getElementById('closePreviewBtn').addEventListener('click', () => {
      document.getElementById('filePreviewModal').style.display = 'none';
    });

    // Source type switcher
    document.getElementById('sourceType').addEventListener('change', e => {
      this._updateSourceInput(e.target.value);
    });

    this.addStatus('info', 'GitSync ready. Enter PIN to begin.');
  }

  // ─── PIN ────────────────────────────────────────────────────────────────

  async _onPinSubmit() {
    const pin       = document.getElementById('pinInput').value.trim();
    const workerUrl = document.getElementById('workerUrl').value.trim() || APP_CONFIG.workerUrl;
    const statusEl  = document.getElementById('pinStatus');

    if (!pin) { this._setPinStatus('error', 'PIN is required.'); return; }

    this._setPinStatus('loading', '<span class="spinner"></span> Verifying…');
    this.pinManager = new PINManager(workerUrl);

    const result = await this.pinManager.verify(pin);
    if (result.success) {
      this._setPinStatus('success', '✓ Authenticated');
      this.state.authenticated = true;
      setTimeout(() => {
        document.getElementById('pinModal').classList.remove('modal-visible');
        document.getElementById('mainApp').style.display = 'block';
        document.getElementById('pinInput').value = ''; // clear immediately
      }, 600);
    } else {
      this._setPinStatus('error', `✗ ${result.error || 'Invalid PIN'}`);
    }
  }

  _onLogout() {
    if (this.pinManager) this.pinManager.logout();
    this.state = { authenticated: false };
    document.getElementById('mainApp').style.display = 'none';
    document.getElementById('pinModal').classList.add('modal-visible');
    document.getElementById('statusArea').innerHTML = '';
  }

  _setPinStatus(type, msg) {
    const el = document.getElementById('pinStatus');
    el.className = type;
    el.innerHTML = msg;
  }

  // ─── WORKFLOW STEPS ──────────────────────────────────────────────────────

  /** Step 1 – Fetch all v16.7 files from GitHub. */
  async stepAggregate() {
    const btn = document.getElementById('aggregateBtn');
    btn.disabled = true;
    this.clearStatus();
    this.addStatus('info', '<span class="spinner"></span> Fetching repository tree…');
    this.updateProgress(0, 1, 'Connecting to GitHub…');
    document.getElementById('progressArea').style.display = 'block';

    try {
      const branch = document.getElementById('branch').value.trim() || APP_CONFIG.defaultBranch;
      this.aggregator = new FileAggregator(this.githubAPI);
      const { fetched, skipped } = await this.aggregator.fetchAllV16Files(
        APP_CONFIG.repo.owner, APP_CONFIG.repo.name, branch
      );
      const stats = this.aggregator.getFileStats();

      this.state.aggregated = true;
      this.updateProgress(1, 1, `${fetched} files fetched`);
      this.addStatus('success', `✓ Fetched ${fetched} files (${skipped} skipped) — ${(stats.totalBytes/1024).toFixed(1)} KB total`);
      this.addStatus('info', `  JS: ${stats.types.js}  HTML: ${stats.types.html}  CSS: ${stats.types.css}`);

      this._renderFileTree(document.getElementById('fileTree'), this.aggregator.buildFileMap());
      document.getElementById('analysisSection').style.display = 'block';
    } catch (err) {
      this.handleError(err);
    } finally {
      btn.disabled = false;
    }
  }

  /** Step 2 – Analyze dependencies and suggest v17-clean module placement. */
  async stepAnalyze() {
    if (!this.state.aggregated) { this.addStatus('warning', 'Aggregate files first.'); return; }
    this.addStatus('info', '<span class="spinner"></span> Analyzing dependencies…');

    try {
      const consolidated = this.aggregator.consolidate();
      this.analyzer  = new CodeAnalyzer(consolidated);
      this.parser    = new CodeParser(consolidated);

      await this.analyzer.analyze();
      await this.parser.parse();

      const report  = this.analyzer.getAnalysisReport();
      this.state.analyzed      = true;
      this.state.analysisReport = report;

      this.addStatus('success', `✓ Analysis complete: ${report.totalFiles} files, ${report.totalImports} imports, ${report.totalExports} exports`);
      if (report.circularDeps.length) {
        report.circularDeps.forEach(c => this.addStatus('warning', `⚠ Circular dep: ${c}`));
      } else {
        this.addStatus('success', '✓ No circular dependencies detected');
      }

      this._renderAnalysisReport(report);
      document.getElementById('restructureSection').style.display = 'block';
    } catch (err) {
      this.handleError(err);
    }
  }

  /** Step 3 – Restructure code into v17-clean modules. */
  async stepRestructure() {
    if (!this.state.analyzed) { this.addStatus('warning', 'Analyze dependencies first.'); return; }
    this.addStatus('info', '<span class="spinner"></span> Restructuring into v17-clean…');

    try {
      const report        = this.state.analysisReport;
      const consolidated  = this.aggregator.consolidate();
      const parsedModules = this.parser.result.modules;

      // Build suggestion map  { origPath → new v17-clean path }
      const suggestionMap = {};
      for (const [origPath, sugFolder] of Object.entries(report.suggestionMap)) {
        const filename = origPath.split('/').pop();
        suggestionMap[origPath] = sugFolder.endsWith('/') ? sugFolder + filename : sugFolder;
      }

      this.fixer = new ImportFixer(parsedModules, suggestionMap);
      const cycles = this.fixer.validateNoDependencyCycles();
      if (cycles.length) cycles.forEach(c => this.addStatus('warning', `⚠ Cycle: ${c}`));

      // Fix imports for every module
      const fixedModules = {};
      let i = 0;
      for (const [origPath, newPath] of Object.entries(suggestionMap)) {
        const raw     = parsedModules[origPath]?.raw || '';
        const fixed   = this.fixer.fixImports(newPath, raw);
        const withMissing = this.fixer.addMissingImports(newPath, fixed);
        fixedModules[newPath] = withMissing;
        this.updateProgress(++i, Object.keys(suggestionMap).length, `Processing ${newPath.split('/').pop()}`);
      }

      this.generator = new FileGenerator(fixedModules, consolidated);
      const { files } = await this.generator.generateAll();
      this.state.generatedFiles = files;
      this.state.restructured   = true;

      this.addStatus('success', `✓ Restructured: ${Object.keys(files).length} files generated`);
      this._renderFileTree(document.getElementById('generatedFileTree'), new Map(Object.entries(files)));
      document.getElementById('previewSection').style.display = 'block';
    } catch (err) {
      this.handleError(err);
    }
  }

  /** Step 4 – Validate generated files. */
  async stepValidate() {
    if (!this.state.restructured) { this.addStatus('warning', 'Restructure first.'); return; }

    const errors = this.generator.validateGeneration();
    this.state.validationErrors = errors;
    this.state.validated        = true;

    const count = Object.keys(this.state.generatedFiles).length;
    document.getElementById('fileCountSummary').textContent = `${count} files ready`;

    const valReport = document.getElementById('validationReport');
    if (errors.length) {
      document.getElementById('validationSummary').textContent = `${errors.length} issue(s) found`;
      errors.forEach(e => {
        const d = document.createElement('div');
        d.className = 'validation-item warning';
        d.textContent = e;
        valReport.appendChild(d);
      });
      this.addStatus('warning', `Validation: ${errors.length} issue(s) — review before committing`);
    } else {
      document.getElementById('validationSummary').textContent = 'All checks passed ✓';
      const d = document.createElement('div');
      d.className = 'validation-item success';
      d.textContent = `✓ ${count} files validated — no issues found`;
      valReport.appendChild(d);
      this.addStatus('success', '✓ Validation passed. Ready to commit.');
    }

    document.getElementById('commitSection').style.display = 'block';
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  }

  /** Step 5 – Preview a sample of generated files. */
  stepPreview() {
    const files   = this.state.generatedFiles;
    const paths   = Object.keys(files).slice(0, 5);
    const modal   = document.getElementById('filePreviewModal');
    const content = document.getElementById('filePreviewContent');
    const title   = document.getElementById('previewFileName');

    if (!paths.length) { this.addStatus('warning', 'No files to preview yet.'); return; }

    let preview = '';
    paths.forEach(p => {
      const snippet = (files[p] || '').slice(0, 600);
      preview += `\n/* ── ${p} ── */\n${snippet}\n...\n`;
    });

    title.textContent   = `Preview (first ${paths.length} files)`;
    content.textContent = preview;
    modal.style.display = 'flex';
  }

  /** Step 6 – Commit generated files to GitHub via the Worker. */
  async stepCommit(dryRun = false) {
    if (!this.state.validated) { this.addStatus('warning', 'Validate before committing.'); return; }
    if (!this.pinManager?.isAuthenticated) { this.addStatus('error', 'Session expired. Please re-authenticate.'); return; }

    const branch      = document.getElementById('branch').value.trim() || APP_CONFIG.targetBranch;
    const prTitle     = document.getElementById('prTitle').value.trim();
    const prDesc      = document.getElementById('prDescription').value.trim();
    const files       = this.state.generatedFiles;
    const fileCount   = Object.keys(files).length;

    if (dryRun) {
      this.addStatus('info', `🧪 Dry run: would commit ${fileCount} files to branch '${branch}'`);
      this.stepPreview();
      return;
    }

    document.getElementById('commitBtn').disabled = true;
    this.addStatus('info', `<span class="spinner"></span> Committing ${fileCount} files to '${branch}'…`);
    this.updateProgress(0, fileCount, 'Starting…');
    document.getElementById('progressArea').style.display = 'block';

    try {
      const commitResult = await this.pinManager.commitFiles(branch, files, `v17-clean: restructure — ${fileCount} files`);
      this.updateProgress(commitResult.filesCommitted, fileCount, `${commitResult.filesCommitted}/${fileCount} committed`);
      this.addStatus('success', `✓ Committed ${commitResult.filesCommitted}/${fileCount} files`);

      this.addStatus('info', '<span class="spinner"></span> Creating Pull Request…');
      const pr = await this.pinManager.createPR(branch, prTitle, prDesc);

      document.getElementById('prLink').href        = pr.pr_url;
      document.getElementById('prLink').textContent = pr.pr_url;
      document.getElementById('successFileCount').textContent = `${commitResult.filesCommitted} files`;
      document.getElementById('commitSection').style.display = 'none';
      document.getElementById('successSection').style.display = 'block';
      this.addStatus('success', `✓ PR #${pr.pr_number} created: ${pr.pr_url}`);
    } catch (err) {
      this.handleError(err);
      document.getElementById('commitBtn').disabled = false;
    }
  }

  // ─── UI HELPERS ──────────────────────────────────────────────────────────

  /** Update the progress bar and label. */
  updateProgress(current, total, message = '') {
    const pct = total > 0 ? Math.round((current / total) * 100) : 0;
    document.getElementById('progressFill').style.width  = pct + '%';
    document.getElementById('progressText').textContent  = message || `${current}/${total}`;
  }

  /**
   * Append a status message to #statusArea.
   * @param {'info'|'success'|'warning'|'error'} type
   * @param {string} message - may contain limited HTML
   */
  addStatus(type, message) {
    const icons = { info: 'ℹ', success: '✓', warning: '⚠', error: '✗' };
    const div   = document.createElement('div');
    div.className = `status ${type}`;
    div.innerHTML = `<span class="status-icon">${icons[type] || 'ℹ'}</span><span>${message}</span>`;
    document.getElementById('statusArea').appendChild(div);
    div.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /** Clear all status messages. */
  clearStatus() {
    document.getElementById('statusArea').innerHTML = '';
  }

  /** Display a full error with stack in the status area. */
  handleError(err) {
    console.error('GitSyncApp error:', err);
    this.addStatus('error', `✗ ${err.message}`);
  }

  _showSection(id) {
    ['analysisSection','restructureSection','previewSection','commitSection','successSection']
      .forEach(s => { document.getElementById(s).style.display = s === id ? 'block' : 'none'; });
  }

  _updateSourceInput(type) {
    const container = document.getElementById('sourceInput');
    container.innerHTML = '';
    if (type === 'upload') {
      container.innerHTML = `<label>Upload ZIP Archive</label>
        <input type="file" id="uploadFile" accept=".zip" style="cursor:pointer;">`;
    } else if (type === 'manual') {
      container.innerHTML = `<label>Paste Source Branch / Commit SHA</label>
        <input type="text" id="manualRef" placeholder="main or commit sha">`;
    }
  }

  _renderFileTree(container, fileMap) {
    container.innerHTML = '';
    const folders = {};
    for (const [path] of fileMap) {
      const parts  = path.split('/');
      const folder = parts.length > 1 ? parts.slice(0, -1).join('/') : '.';
      if (!folders[folder]) folders[folder] = [];
      folders[folder].push(parts.pop());
    }
    for (const [folder, files] of Object.entries(folders)) {
      const fd = document.createElement('div');
      fd.className = 'file-item folder';
      fd.textContent = `📁 ${folder}/`;
      container.appendChild(fd);
      files.sort().forEach(f => {
        const fi = document.createElement('div');
        fi.className = 'file-item';
        fi.textContent = `📄 ${f}`;
        container.appendChild(fi);
      });
    }
  }

  _renderAnalysisReport(report) {
    const el = document.getElementById('analysisReport');
    el.innerHTML = '';
    const summary = document.createElement('div');
    summary.className = 'validation-item success';
    summary.textContent = `${report.totalFiles} files | ${report.totalImports} imports | ${report.totalExports} exports`;
    el.appendChild(summary);

    for (const [orig, dest] of Object.entries(report.suggestionMap || {})) {
      const d = document.createElement('div');
      d.className = 'file-item';
      d.textContent = `${orig.split('/').pop()} → ${dest}`;
      el.appendChild(d);
    }
  }

  _onDryRun() { this.stepCommit(true); }

  /** @returns {GitSyncApp} Singleton */
  static getInstance() {
    if (!_instance) _instance = new GitSyncApp();
    return _instance;
  }
}

// Boot
document.addEventListener('DOMContentLoaded', () => {
  GitSyncApp.getInstance().init();
});
