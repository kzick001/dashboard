// ==========================================
// GITSYNC v1.0 — GITHUB API
// Read-only wrapper (no token required for public repos)
// ==========================================

'use strict';

const GITHUB_API = 'https://api.github.com';

class GitHubAPI {
  constructor() {
    this._cache = new Map(); // simple in-memory cache for tree/file fetches
  }

  // ── PRIVATE ──────────────────────────────────────────────────────────────

  /**
   * Fetch JSON from GitHub API with basic error handling.
   * @param {string} url
   * @returns {Promise<any>}
   */
  async _get(url) {
    if (this._cache.has(url)) return this._cache.get(url);
    const res = await fetch(url, {
      headers: { 'Accept': 'application/vnd.github.v3+json' }
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(`GitHub ${res.status}: ${body.message || res.statusText} — ${url}`);
    }
    const data = await res.json();
    this._cache.set(url, data);
    return data;
  }

  // ── PUBLIC ────────────────────────────────────────────────────────────────

  /**
   * Get a flat list of every file in a repo at the given branch.
   * Uses the Git Trees API (recursive) — one request for the entire repo.
   * @param {string} owner
   * @param {string} repo
   * @param {string} [branch='main']
   * @returns {Promise<Array<{path:string, sha:string, size:number, type:string}>>}
   */
  async getRepoTree(owner, repo, branch = 'main') {
    // First resolve the branch to its tree SHA
    const branchData = await this._get(
      `${GITHUB_API}/repos/${owner}/${repo}/branches/${branch}`
    );
    const treeSha = branchData.commit.commit.tree.sha;

    const treeData = await this._get(
      `${GITHUB_API}/repos/${owner}/${repo}/git/trees/${treeSha}?recursive=1`
    );

    if (treeData.truncated) {
      console.warn('GitHubAPI: repo tree was truncated — some files may be missing.');
    }

    // Return only blobs (files), not trees (folders)
    return (treeData.tree || []).filter(item => item.type === 'blob');
  }

  /**
   * Fetch the decoded text content of a single file.
   * @param {string} owner
   * @param {string} repo
   * @param {string} path - File path relative to repo root
   * @param {string} [branch='main']
   * @returns {Promise<string>}
   */
  async getFileContent(owner, repo, path, branch = 'main') {
    const url = `${GITHUB_API}/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${branch}`;
    const data = await this._get(url);
    if (data.encoding !== 'base64') throw new Error(`Unexpected encoding: ${data.encoding}`);
    return atob(data.content.replace(/\n/g, ''));
  }

  /**
   * List all branches for a repo.
   * @param {string} owner
   * @param {string} repo
   * @returns {Promise<Array<{name:string, protected:boolean}>>}
   */
  async getRepoBranches(owner, repo) {
    const branches = await this._get(
      `${GITHUB_API}/repos/${owner}/${repo}/branches?per_page=100`
    );
    return branches.map(b => ({ name: b.name, protected: b.protected }));
  }

  /**
   * Get the default branch name (usually 'main' or 'master').
   * @param {string} owner
   * @param {string} repo
   * @returns {Promise<string>}
   */
  async getDefaultBranch(owner, repo) {
    const data = await this._get(`${GITHUB_API}/repos/${owner}/${repo}`);
    return data.default_branch;
  }

  /** Clear the internal fetch cache. */
  clearCache() {
    this._cache.clear();
  }
}

// Usage:
// const api = new GitHubAPI();
// const files = await api.getRepoTree('kzick001', 'undead-barrage', 'main');
// const content = await api.getFileContent('kzick001', 'undead-barrage', 'js/main.js');
