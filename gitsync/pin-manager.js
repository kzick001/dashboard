// ==========================================
// GITSYNC v1.0 — PIN MANAGER
// Cloudflare Worker integration, session management
// ==========================================

'use strict';

class PINManager {
  /**
   * @param {string} workerUrl - Base URL of Cloudflare Worker (no trailing slash)
   */
  constructor(workerUrl) {
    this._workerUrl = workerUrl.replace(/\/$/, '');
    this._sessionToken = null;
    this._sessionExpires = null;
  }

  // ── PRIVATE ──────────────────────────────────────────────────────────────

  /**
   * Build common fetch options for Worker requests.
   * @param {object} body - JSON-serialisable request body
   * @returns {RequestInit}
   */
  _opts(body) {
    return {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    };
  }

  /**
   * Parse Worker response, throwing on non-2xx status.
   * @param {Response} res
   * @returns {Promise<object>}
   */
  async _parse(res) {
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || `Worker error ${res.status}`);
    return json;
  }

  // ── PUBLIC ────────────────────────────────────────────────────────────────

  /**
   * Verify PIN against Cloudflare Worker and store session token in memory.
   * @param {string} pin
   * @returns {Promise<{success:boolean, token?:string, expiresIn?:number, error?:string}>}
   */
  async verify(pin) {
    try {
      const res = await fetch(`${this._workerUrl}/verify`, this._opts({ pin }));
      const data = await this._parse(res);
      // Store in memory only — never persisted
      this._sessionToken = data.sessionToken;
      this._sessionExpires = Date.now() + (data.expiresIn ?? 3600) * 1000;
      return { success: true, token: data.sessionToken, expiresIn: data.expiresIn };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Validate that the current in-memory session is still active.
   * @returns {Promise<boolean>}
   */
  async validateSession() {
    if (!this._sessionToken) return false;
    if (Date.now() >= this._sessionExpires) { this._sessionToken = null; return false; }
    try {
      const res = await fetch(
        `${this._workerUrl}/validate-session?token=${encodeURIComponent(this._sessionToken)}`
      );
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Commit a map of files to the GitHub repo via the Worker.
   * @param {string} branch
   * @param {Object<string,string>} files - { "path/file.js": "content..." }
   * @param {string} [message]
   * @returns {Promise<{filesCommitted:number, totalFiles:number, details:object[]}>}
   */
  async commitFiles(branch, files, message = 'v17-clean: restructure') {
    if (!this._sessionToken) throw new Error('No active session. Please authenticate first.');
    const res = await fetch(
      `${this._workerUrl}/commit`,
      this._opts({ sessionToken: this._sessionToken, branch, files, message })
    );
    return this._parse(res);
  }

  /**
   * Create a GitHub Pull Request via the Worker.
   * @param {string} branch - Head branch
   * @param {string} title
   * @param {string} description
   * @returns {Promise<{pr_number:number, pr_url:string, pr_title:string}>}
   */
  async createPR(branch, title, description) {
    if (!this._sessionToken) throw new Error('No active session. Please authenticate first.');
    const res = await fetch(
      `${this._workerUrl}/create-pr`,
      this._opts({ sessionToken: this._sessionToken, branch, title, description })
    );
    return this._parse(res);
  }

  /**
   * Clear session token from memory (does NOT call Worker).
   */
  logout() {
    this._sessionToken = null;
    this._sessionExpires = null;
  }

  /** @returns {boolean} */
  get isAuthenticated() {
    return !!this._sessionToken && Date.now() < this._sessionExpires;
  }
}

// Usage:
// const pin = new PINManager('https://gitsync.askozicki.workers.dev');
// const result = await pin.verify('1234');
// if (result.success) { ... }
