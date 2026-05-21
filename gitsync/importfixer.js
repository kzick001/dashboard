// ==========================================
// GITSYNC v1.0 — IMPORT FIXER
// Rewrites import paths to match the new
// v17-clean folder structure and detects
// circular dependencies.
// ==========================================

'use strict';

class ImportFixer {
  /**
   * @param {Object<string,{raw:string, imports:Array, exports:Array}>} modules
   *   Parsed module map from CodeParser
   * @param {Object<string,string>} suggestionMap
   *   Map of original path → suggested v17-clean path from CodeAnalyzer
   */
  constructor(modules, suggestionMap) {
    this._modules       = modules;
    this._suggestionMap = suggestionMap; // originalPath → 'js/systems/barricades.js'
    // Build reverse lookup: export name → new path
    this._exportIndex   = this._buildExportIndex();
  }

  // ── PRIVATE ──────────────────────────────────────────────────────────────

  /**
   * Build a map from exported name → new file path.
   * @returns {Map<string, string>}
   */
  _buildExportIndex() {
    const index = new Map();
    for (const [origPath, newPath] of Object.entries(this._suggestionMap)) {
      const mod = this._modules[origPath];
      if (!mod) continue;
      for (const exp of mod.exports) {
        index.set(exp.name, newPath);
      }
    }
    return index;
  }

  // ── PUBLIC ────────────────────────────────────────────────────────────────

  /**
   * Rewrite all import statements in `content` so paths are correct
   * relative to `filePath` in the new v17-clean structure.
   * @param {string} filePath - New path (e.g. 'js/systems/barricades.js')
   * @param {string} content
   * @returns {string} Content with fixed imports
   */
  fixImports(filePath, content) {
    // Replace static ES6 imports
    return content.replace(
      /import\s+([\s\S]*?)\s+from\s+['"`]([^'"`)]+)['"`]/g,
      (match, specifiers, source) => {
        const resolved = this.resolveImport(source, filePath);
        if (!resolved) return match; // leave unknown imports alone
        const rel = this.calculateRelativePath(filePath, resolved);
        return `import ${specifiers} from '${rel}'`;
      }
    );
  }

  /**
   * Resolve an import source string to a new v17-clean absolute path.
   * Handles both relative ('./foo') and bare ('GameConfig') references.
   * @param {string} importPath - Raw import source string
   * @param {string} [fromFile]  - File the import appears in (for relative resolution)
   * @returns {string|null} New absolute path or null if unresolvable
   */
  resolveImport(importPath, fromFile = '') {
    // Bare identifier — look up by export name
    if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
      return this._exportIndex.get(importPath) || null;
    }

    // Relative path — find matching original file, then return its new path
    const base  = fromFile.split('/').slice(0, -1).join('/');
    const clean = importPath.replace(/\.js$/, '');
    const filename = clean.split('/').pop();

    const origPath = Object.keys(this._suggestionMap).find(p => {
      const stem = p.replace(/\.js$/, '').split('/').pop();
      return stem === filename;
    });

    return origPath ? this._suggestionMap[origPath] : null;
  }

  /**
   * Calculate the relative import path from one v17-clean file to another.
   * @param {string} fromPath - e.g. 'js/systems/barricades.js'
   * @param {string} toPath   - e.g. 'js/config/gameconfig.js'
   * @returns {string} e.g. '../config/gameconfig.js'
   */
  calculateRelativePath(fromPath, toPath) {
    const fromParts = fromPath.split('/').slice(0, -1); // directory
    const toParts   = toPath.split('/');

    // Find common prefix length
    let common = 0;
    while (
      common < fromParts.length &&
      common < toParts.length - 1 &&
      fromParts[common] === toParts[common]
    ) common++;

    const ups   = fromParts.length - common;
    const downs = toParts.slice(common);
    const rel   = [...Array(ups).fill('..'), ...downs].join('/');
    return rel.startsWith('.') ? rel : './' + rel;
  }

  /**
   * Detect circular dependency cycles in the modules.
   * @returns {string[]} Array of cycle descriptions
   */
  validateNoDependencyCycles() {
    const graph   = {};
    const newPaths = Object.values(this._suggestionMap);

    // Build adjacency using new paths
    for (const [origPath, newPath] of Object.entries(this._suggestionMap)) {
      const mod = this._modules[origPath];
      if (!mod) continue;
      graph[newPath] = (mod.imports || [])
        .map(i => this.resolveImport(i.source, newPath))
        .filter(Boolean);
    }

    const visited   = new Set();
    const stack     = new Set();
    const cycles    = [];

    const dfs = (node, chain) => {
      if (stack.has(node))  { cycles.push([...chain, node].join(' → ')); return; }
      if (visited.has(node)) return;
      visited.add(node);
      stack.add(node);
      for (const dep of (graph[node] || [])) dfs(dep, [...chain, node]);
      stack.delete(node);
    };

    for (const node of Object.keys(graph)) {
      if (!visited.has(node)) dfs(node, []);
    }
    return cycles;
  }

  /**
   * Scan content for class/function names that have known exports elsewhere
   * and whose import is missing. Prepend any needed import statements.
   * @param {string} filePath - New v17-clean path for this file
   * @param {string} content
   * @returns {string} Content with missing imports prepended
   */
  addMissingImports(filePath, content) {
    const toAdd = [];
    for (const [name, sourcePath] of this._exportIndex) {
      if (sourcePath === filePath) continue; // don't import from self
      const alreadyImported = new RegExp(`import[^'"]+['"]([^'"]*${name}[^'"]*)['"]`).test(content);
      if (alreadyImported) continue;
      // Only add if the name actually appears in code (not in comments)
      const noComments = content.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
      if (new RegExp(`\\b${name}\\b`).test(noComments)) {
        const rel = this.calculateRelativePath(filePath, sourcePath);
        toAdd.push(`import { ${name} } from '${rel}';`);
      }
    }
    if (!toAdd.length) return content;
    // Insert after last existing import line
    const lastImport = content.lastIndexOf('import ');
    const lineEnd    = lastImport !== -1 ? content.indexOf('\n', lastImport) : -1;
    if (lineEnd === -1) return toAdd.join('\n') + '\n\n' + content;
    return content.slice(0, lineEnd + 1) + toAdd.join('\n') + '\n' + content.slice(lineEnd + 1);
  }
}

// Usage:
// const fixer = new ImportFixer(parsedModules, suggestionMap);
// const fixed = fixer.fixImports('js/systems/barricades.js', rawContent);
// const cycles = fixer.validateNoDependencyCycles();
