// ==========================================
// GITSYNC v1.0 — CODE ANALYZER
// Dependency analysis and v17-clean
// module placement suggestions.
// ==========================================

'use strict';

/** Map class/file name patterns → suggested v17-clean paths */
const PLACEMENT_RULES = [
  { pattern: /GameConfig|BalanceConfig|Constants/i,       path: 'js/config/' },
  { pattern: /GameData|DefaultGame|SaveManager|currentRun/i, path: 'js/data/' },
  { pattern: /GameScene|UIManager|Director|SoundManager/i,  path: 'js/managers/' },
  { pattern: /BarricadeManager|DeployableManager|WeaponSystem|ComboSystem|CombatSystem/i, path: 'js/systems/' },
  { pattern: /class Player|class Enemy|class Projectile|class Pickup|FloatingText/i, path: 'js/entities/' },
  { pattern: /ScreenManager|ArmoryUI|HUDManager/i,         path: 'js/ui/' },
];

class CodeAnalyzer {
  /**
   * @param {{ html:Object<string,string>, css:Object<string,string>, js:Object<string,string> }} consolidatedFiles
   */
  constructor(consolidatedFiles) {
    this._files  = consolidatedFiles;
    this._result = null;
  }

  // ── PRIVATE ──────────────────────────────────────────────────────────────

  /**
   * Extract import source strings from JS content.
   * @param {string} content
   * @returns {string[]}
   */
  _extractImportPaths(content) {
    const re = /(?:import|require)\s*(?:\(|[^'"]*from\s*)['"`]([^'"`)]+)['"`]/g;
    const paths = [];
    let m;
    while ((m = re.exec(content)) !== null) paths.push(m[1]);
    return paths;
  }

  /**
   * Extract export identifiers from JS content.
   * @param {string} content
   * @returns {string[]}
   */
  _extractExportNames(content) {
    const re = /export\s+(?:default\s+)?(?:class|function|const|let|var)\s+(\w+)/g;
    const names = [];
    let m;
    while ((m = re.exec(content)) !== null) names.push(m[1]);
    return names;
  }

  // ── PUBLIC ────────────────────────────────────────────────────────────────

  /**
   * Run full analysis on all consolidated JS files.
   * @returns {Promise<{imports:Object, exports:Object, dependencies:Object, suggestions:Object}>}
   */
  async analyze() {
    const imports     = {};
    const exports_    = {};
    const dependencies = {};
    const suggestions = {};

    for (const [path, content] of Object.entries(this._files.js)) {
      imports[path]      = this._extractImportPaths(content);
      exports_[path]     = this._extractExportNames(content);
      dependencies[path] = this.findDependencies(path, content);
      suggestions[path]  = this.suggestModulePlacement(path, content);
    }

    this._result = { imports, exports: exports_, dependencies, suggestions };
    return this._result;
  }

  /**
   * Return dependency records for a single file.
   * @param {string} filePath
   * @param {string} content
   * @returns {Array<{from:string, importPath:string}>}
   */
  findDependencies(filePath, content) {
    return this._extractImportPaths(content).map(importPath => ({
      from: filePath,
      importPath
    }));
  }

  /**
   * Suggest the v17-clean sub-folder for a given file based on its
   * class names, exports, and file path.
   * @param {string} filePath
   * @param {string} [content='']
   * @returns {string} suggested folder path (e.g. 'js/systems/')
   */
  suggestModulePlacement(filePath, content = '') {
    const combined = filePath + '\n' + content;
    for (const rule of PLACEMENT_RULES) {
      if (rule.pattern.test(combined)) return rule.path;
    }
    // Fallback: guess from existing path segments
    if (filePath.includes('manager') || filePath.includes('Manager'))    return 'js/managers/';
    if (filePath.includes('system')  || filePath.includes('System'))     return 'js/systems/';
    if (filePath.includes('entit')   || filePath.includes('entity'))     return 'js/entities/';
    if (filePath.includes('config')  || filePath.includes('Config'))     return 'js/config/';
    if (filePath.includes('data')    || filePath.includes('Data'))       return 'js/data/';
    if (filePath.includes('ui')      || filePath.includes('UI'))         return 'js/ui/';
    return 'js/managers/'; // safe default
  }

  /**
   * Detect circular dependency chains in the analyzed files.
   * Returns an array of circular path strings, e.g. ['a.js → b.js → a.js'].
   * @returns {string[]}
   */
  detectCircularDependencies() {
    if (!this._result) return [];
    const { dependencies } = this._result;
    const cycles = [];

    const resolve = (filePath, importPath) => {
      // Find the actual key in dependencies that matches the import
      return Object.keys(dependencies).find(key =>
        key.endsWith(importPath.replace(/^\.\/|^\.\.\//,'').replace(/^.*\//, ''))
      ) || null;
    };

    const visited  = new Set();
    const inStack  = new Set();

    const dfs = (node, chain) => {
      if (inStack.has(node)) {
        cycles.push(chain.join(' → ') + ' → ' + node);
        return;
      }
      if (visited.has(node)) return;
      visited.add(node);
      inStack.add(node);
      for (const dep of (dependencies[node] || [])) {
        const resolved = resolve(node, dep.importPath);
        if (resolved) dfs(resolved, [...chain, node]);
      }
      inStack.delete(node);
    };

    for (const node of Object.keys(dependencies)) {
      if (!visited.has(node)) dfs(node, []);
    }
    return cycles;
  }

  /**
   * Return a human-readable analysis report object.
   * @returns {{ totalFiles:number, totalImports:number, totalExports:number,
   *             circularDeps:string[], suggestionMap:Object<string,string> }}
   */
  getAnalysisReport() {
    if (!this._result) return { error: 'analyze() not yet called' };
    const { imports, exports: exps, suggestions } = this._result;
    const totalImports = Object.values(imports).reduce((s, a) => s + a.length, 0);
    const totalExports = Object.values(exps).reduce((s, a) => s + a.length, 0);
    const suggestionMap = {};
    for (const [path, dest] of Object.entries(suggestions)) {
      const file = path.split('/').pop();
      suggestionMap[path] = `${dest}${file}`;
    }
    return {
      totalFiles:   Object.keys(imports).length,
      totalImports,
      totalExports,
      circularDeps: this.detectCircularDependencies(),
      suggestionMap
    };
  }
}

// Usage:
// const analyzer = new CodeAnalyzer(consolidatedFiles);
// await analyzer.analyze();
// const report = analyzer.getAnalysisReport();
