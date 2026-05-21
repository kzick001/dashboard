// ==========================================
// GITSYNC v1.0 — FILE AGGREGATOR
// Fetch all v16.7 source files from GitHub
// and consolidate into a structured map.
// ==========================================

'use strict';

const AGGREGATOR_CONFIG = {
  extensions:  ['.js', '.html', '.css'],
  // Ignore paths that contain any of these segments
  ignorePaths: ['node_modules', '.git', 'dist', 'build', 'UB 17+', 'v17-clean'],
  // How many files to fetch in parallel
  concurrency: 8
};

class FileAggregator {
  /**
   * @param {GitHubAPI} githubAPI - Instance of GitHubAPI
   */
  constructor(githubAPI) {
    this._api = githubAPI;
    /** @type {Map<string, string>} path → decoded content */
    this._fileMap = new Map();
    this._owner  = null;
    this._repo   = null;
    this._branch = null;
  }

  // ── PRIVATE ──────────────────────────────────────────────────────────────

  /**
   * Return true if a tree entry should be fetched.
   * @param {{path:string}} entry
   */
  _shouldFetch(entry) {
    const ext = entry.path.slice(entry.path.lastIndexOf('.'));
    if (!AGGREGATOR_CONFIG.extensions.includes(ext)) return false;
    return !AGGREGATOR_CONFIG.ignorePaths.some(seg => entry.path.includes(seg));
  }

  /**
   * Run async tasks with bounded concurrency.
   * @param {Array<()=>Promise>} tasks
   * @param {number} limit
   */
  async _parallel(tasks, limit) {
    const results = [];
    let idx = 0;
    const workers = Array.from({ length: Math.min(limit, tasks.length) }, async () => {
      while (idx < tasks.length) {
        const i = idx++;
        results[i] = await tasks[i]();
      }
    });
    await Promise.all(workers);
    return results;
  }

  // ── PUBLIC ────────────────────────────────────────────────────────────────

  /**
   * Fetch all relevant source files from the GitHub repo.
   * Populates internal file map. Call this first.
   * @param {string} owner
   * @param {string} repo
   * @param {string} [branch='main']
   * @returns {Promise<{fetched:number, skipped:number}>}
   */
  async fetchAllV16Files(owner, repo, branch = 'main') {
    this._owner  = owner;
    this._repo   = repo;
    this._branch = branch;
    this._fileMap.clear();

    const tree = await this._api.getRepoTree(owner, repo, branch);
    const eligible = tree.filter(entry => this._shouldFetch(entry));
    const skipped  = tree.length - eligible.length;

    const tasks = eligible.map(entry => async () => {
      try {
        const content = await this._api.getFileContent(owner, repo, entry.path, branch);
        this._fileMap.set(entry.path, content);
      } catch (err) {
        console.warn(`Aggregator: skipping ${entry.path} — ${err.message}`);
      }
    });

    await this._parallel(tasks, AGGREGATOR_CONFIG.concurrency);
    return { fetched: this._fileMap.size, skipped };
  }

  /**
   * Consolidate fetched files into typed buckets.
   * @returns {{ html: Object<string,string>, css: Object<string,string>, js: Object<string,string> }}
   */
  consolidate() {
    const result = { html: {}, css: {}, js: {} };
    for (const [path, content] of this._fileMap) {
      if (path.endsWith('.html')) result.html[path] = content;
      else if (path.endsWith('.css')) result.css[path]  = content;
      else if (path.endsWith('.js'))  result.js[path]   = content;
    }
    return result;
  }

  /**
   * Return the internal file map (path → content).
   * @returns {Map<string,string>}
   */
  buildFileMap() {
    return new Map(this._fileMap);
  }

  /**
   * Return summary statistics about the aggregated files.
   * @returns {{ count:number, totalBytes:number, types: Object<string,number> }}
   */
  getFileStats() {
    const types = { html: 0, css: 0, js: 0 };
    let totalBytes = 0;
    for (const [path, content] of this._fileMap) {
      totalBytes += content.length;
      if (path.endsWith('.html')) types.html++;
      else if (path.endsWith('.css')) types.css++;
      else if (path.endsWith('.js'))  types.js++;
    }
    return { count: this._fileMap.size, totalBytes, types };
  }
}

// Usage:
// const agg = new FileAggregator(new GitHubAPI());
// await agg.fetchAllV16Files('kzick001', 'undead-barrage');
// const { js } = agg.consolidate();
// console.log(agg.getFileStats());
