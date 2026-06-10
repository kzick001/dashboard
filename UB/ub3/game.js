// UNDEAD BARRAGE — game.js
// All balance in CFG (config.js). All text in FLAVOR (flavor.js).
// Phaser 3.80.0, plain globals, no modules, no build tools.

/* ============================================================ HELPERS */
const U = {
  clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
  rand: (a, b) => a + Math.random() * (b - a),
  irand: (a, b) => Math.floor(a + Math.random() * (b - a + 1)),
  choose: (arr) => arr[Math.floor(Math.random() * arr.length)],
  dist: (a, b) => Math.hypot(a.x - b.x, a.y - b.y),
  weightedPick(weights) {
    let total = 0; for (const k in weights) total += weights[k];
    let r = Math.random() * total;
    for (const k in weights) { r -= weights[k]; if (r <= 0) return k; }
    return Object.keys(weights)[0];
  }
};
const D = (id) => document.getElementById(id);

/* ============================================================ AUDIO
   WebAudio synth placeholders. Scaffolded for asset replacement: swap
   Sfx.play's body for real sample playback later; call sites stay put.
   Never breaks gameplay if audio fails — everything is try/caught. */
const Sfx = {
  ctx: null, enabled: true,
  init() {
    if (this.ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
    } catch (e) { this.enabled = false; }
  },
  play(name) {
    if (!this.enabled) return;
    try {
      this.init();
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') this.ctx.resume();
      const def = CFG.AUDIO[name];
      if (!def) return;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = def.type;
      osc.frequency.setValueAtTime(def.freq, t);
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, def.endFreq), t + def.dur);
      g.gain.setValueAtTime(def.gain, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + def.dur);
      osc.connect(g); g.connect(this.ctx.destination);
      osc.start(t); osc.stop(t + def.dur + 0.02);
    } catch (e) { /* audio must never break gameplay */ }
  }
};

/* ============================================================ RUN STATE */
let Run = null;
function newRun() {
  return {
    wave: 0,
    gold: 0,
    kills: 0,
    goldEarned: 0,
    mutations: [],            // ids in pick order
    mutationStage() {
      const n = this.mutations.length;
      if (n === 0) return 0; if (n <= 2) return 1; if (n <= 4) return 2; if (n <= 6) return 3; return 4;
    },
    has(id) { return this.mutations.includes(id); },
    weapons: { primary: makeWeaponState('ranger'), secondary: null },
    active: 'primary',
    armor: 0, grenades: 1,
    armorBought: 0,
    revivedThisWave: false,
    bossCycle: 0,             // post-campaign boss count for scaling
    apexStacks: 0,
    over: false
  };
}
function makeWeaponState(id) {
  return { id, levels: { dmg: 0, handling: 0, special: 0 }, evolved: false, ammo: CFG.WEAPONS[id].magSize || 0, heat: 0, venting: false, reloading: false };
}

/* ====================================================== STAT PIPELINE
   computeWeapon(ws) -> resolved stats from base + tracks + evolution +
   mutations. Recomputed on demand; cheap. */
function computeWeapon(ws) {
  const base = CFG.WEAPONS[ws.id];
  const s = {
    archetype: base.archetype,
    damage: base.damage || 0,
    damagePerSec: base.damagePerSec || 0,
    fireRateMs: base.fireRateMs,
    magSize: base.magSize || 0,
    reloadMs: base.reloadMs || 0,
    projSpeed: base.projSpeed || 0,
    pierce: base.pierce || 0,
    spread: base.spread || 0,
    pellets: base.pellets || 1,
    knockback: base.knockback || 0,
    rangePx: base.rangePx || 0,
    critBonus: base.critBonus || 0,
    critMult: base.critMult || CFG.CRIT.mult,
    aoeRadius: base.aoeRadius || 0,
    aoeKnockback: base.aoeKnockback || 0,
    falloffStart: base.falloff ? base.falloff.startPx : 0,
    falloffMin: base.falloff ? base.falloff.minMul : 1,
    heatPerSec: base.heatPerSec || 0,
    coolPerSec: base.coolPerSec || 0,
    overheatVentMs: base.overheatVentMs || 0,
    beamRange: base.beamRange || 0,
    beamWidth: base.beamWidth || 0,
    extraProjectiles: 0,
    ricochet: 0,
    cluster: null, critExplode: null, shockwave: null, igniteDps: 0, igniteMs: 0,
    bulletKey: base.bulletKey, bulletScale: base.bulletScale || 1
  };
  // tracks
  for (const tk of ['dmg', 'handling', 'special']) {
    const lv = ws.levels[tk];
    const fx = base.tracks[tk].perLevel;
    for (let i = 0; i < lv; i++) {
      if (fx.damage) s.damage += fx.damage;
      if (fx.damagePerSec) s.damagePerSec += fx.damagePerSec;
      if (fx.fireRateMul) s.fireRateMs *= fx.fireRateMul;
      if (fx.reloadMul) s.reloadMs *= fx.reloadMul;
      if (fx.magAdd) s.magSize += fx.magAdd;
      if (fx.critBonus) s.critBonus += fx.critBonus;
      if (fx.pierce) s.pierce += fx.pierce;
      if (fx.spreadMul) s.spread *= fx.spreadMul;
      if (fx.falloffStartAdd) s.falloffStart += fx.falloffStartAdd;
      if (fx.pellets) s.pellets += fx.pellets;
      if (fx.knockback) s.knockback += fx.knockback;
      if (fx.aoeRadius) s.aoeRadius += fx.aoeRadius;
      if (fx.projSpeedAdd) s.projSpeed += fx.projSpeedAdd;
      if (fx.heatPerSecMul) s.heatPerSec *= fx.heatPerSecMul;
      if (fx.coolPerSecAdd) s.coolPerSec += fx.coolPerSecAdd;
      if (fx.beamWidth) s.beamWidth += fx.beamWidth;
      if (fx.beamRange) s.beamRange += fx.beamRange;
    }
  }
  s.pierce = Math.floor(s.pierce);
  // evolution
  if (ws.evolved) {
    const ev = base.evolved;
    if (ev.pierce) s.pierce = ev.pierce;
    if (ev.damageMul) { s.damage *= ev.damageMul; s.damagePerSec *= ev.damageMul; }
    if (ev.critExplode) s.critExplode = ev.critExplode;
    if (ev.extraProjectiles) s.extraProjectiles += ev.extraProjectiles;
    if (ev.ricochet) s.ricochet = ev.ricochet;
    if (ev.pelletsAdd) s.pellets += ev.pelletsAdd;
    if (ev.shockwave) s.shockwave = ev.shockwave;
    if (ev.cluster) s.cluster = ev.cluster;
    if (ev.beamWidthMul) s.beamWidth *= ev.beamWidthMul;
    if (ev.igniteDps) { s.igniteDps = ev.igniteDps; s.igniteMs = ev.igniteMs; }
  }
  // mutations
  if (Run.has('adrenal')) s.fireRateMs *= CFG.MUTATIONS.adrenal.fireRateMul;
  if (Run.has('twitch')) s.critBonus += CFG.MUTATIONS.twitch.critAdd;
  if (Run.has('graft')) s.extraProjectiles += CFG.MUTATIONS.graft.extraProjectiles;
  return s;
}
function playerSpeed() {
  let v = CFG.PLAYER.speed;
  if (Run.has('adrenal')) v *= CFG.MUTATIONS.adrenal.speedMul;
  if (Run.has('chitin')) v *= CFG.MUTATIONS.chitin.speedMul;
  return v;
}
function playerMaxHp() {
  let v = CFG.PLAYER.hp;
  if (Run.has('chitin')) v += CFG.MUTATIONS.chitin.maxHpAdd;
  return v;
}
// global damage multipliers applied at the moment of dealing damage
function damageMul(scene) {
  let m = 1;
  if (Run.has('tumor') && scene.playerHp / playerMaxHp() >= CFG.MUTATIONS.tumor.hpThreshold) m *= CFG.MUTATIONS.tumor.dmgMul;
  if (Run.has('apex')) m *= Math.min(CFG.MUTATIONS.apex.capMul, 1 + Run.apexStacks * CFG.MUTATIONS.apex.dmgPerKill);
  return m;
}
function rollCrit(stats) {
  return Math.random() < (CFG.CRIT.baseChance + stats.critBonus);
}

/* ====================================================== MUTATION ICONS
   Inline SVG glyphs (no emoji). One path per mutation id. */
const MUT_ICONS = {
  adrenal: '<svg viewBox="0 0 24 24" fill="none" stroke="#c9d34a" stroke-width="2"><path d="M13 2 5 14h6l-1 8 8-12h-6z"/></svg>',
  chitin: '<svg viewBox="0 0 24 24" fill="none" stroke="#9acd32" stroke-width="2"><path d="M12 2 4 6v6c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V6z"/></svg>',
  hemovore: '<svg viewBox="0 0 24 24" fill="none" stroke="#c0392b" stroke-width="2"><path d="M12 3c3 4.5 6 7.7 6 11a6 6 0 1 1-12 0c0-3.3 3-6.5 6-11z"/></svg>',
  boneSpurs: '<svg viewBox="0 0 24 24" fill="none" stroke="#d6d9de" stroke-width="2"><path d="M12 4v16M4 12h16M6.5 6.5l11 11M17.5 6.5l-11 11"/></svg>',
  scavenger: '<svg viewBox="0 0 24 24" fill="none" stroke="#e0b341" stroke-width="2"><circle cx="12" cy="12" r="8"/><path d="M12 8v8M9.5 10h4a1.8 1.8 0 0 1 0 3.6h-3a1.8 1.8 0 0 0 0 3.6h4.5"/></svg>',
  twitch: '<svg viewBox="0 0 24 24" fill="none" stroke="#c9d34a" stroke-width="2"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2.5"/><path d="M12 4v3M12 17v3M4 12h3M17 12h3"/></svg>',
  acidBlood: '<svg viewBox="0 0 24 24" fill="none" stroke="#9acd32" stroke-width="2"><path d="M12 3c3 4.5 6 7.7 6 11a6 6 0 1 1-12 0c0-3.3 3-6.5 6-11z"/><path d="M9 14c1 2 5 2 6 0"/></svg>',
  howler: '<svg viewBox="0 0 24 24" fill="none" stroke="#7a5fc9" stroke-width="2"><path d="M8 9v6l-4 3V6zM12 9a4 4 0 0 1 0 6M15.5 7a8 8 0 0 1 0 10M19 5a12 12 0 0 1 0 14"/></svg>',
  tumor: '<svg viewBox="0 0 24 24" fill="none" stroke="#c97a9b" stroke-width="2"><circle cx="10" cy="11" r="6"/><circle cx="16.5" cy="15.5" r="3.5"/><path d="M10 8v6M7 11h6"/></svg>',
  splitter: '<svg viewBox="0 0 24 24" fill="none" stroke="#d6d9de" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 9V3M12 15v6M9 12H3M15 12h6M14.2 9.8 18 6M9.8 14.2 6 18"/></svg>',
  predator: '<svg viewBox="0 0 24 24" fill="none" stroke="#c0392b" stroke-width="2"><path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6-10-6-10-6z"/><path d="M12 9v6"/></svg>',
  graft: '<svg viewBox="0 0 24 24" fill="none" stroke="#9acd32" stroke-width="2"><path d="M7 21V11a5 5 0 0 1 10 0v10M7 15h10M12 6V3"/></svg>',
  halo: '<svg viewBox="0 0 24 24" fill="none" stroke="#7a5fc9" stroke-width="2"><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="9" stroke-dasharray="3 3"/></svg>',
  hiveHeart: '<svg viewBox="0 0 24 24" fill="none" stroke="#c0392b" stroke-width="2"><path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/><path d="M9 11h2l1-2 1 3 1-1h2"/></svg>',
  mitosis: '<svg viewBox="0 0 24 24" fill="none" stroke="#c9d34a" stroke-width="2"><circle cx="8.5" cy="12" r="5"/><circle cx="15.5" cy="12" r="5"/></svg>',
  apex: '<svg viewBox="0 0 24 24" fill="none" stroke="#c0392b" stroke-width="2"><path d="M3 20 12 4l9 16zM12 11v4"/></svg>',
  cash: '<svg viewBox="0 0 24 24" fill="none" stroke="#e0b341" stroke-width="2"><rect x="3" y="7" width="18" height="12" rx="1"/><circle cx="12" cy="13" r="3"/></svg>'
};

/* ============================================================ TEXTURES
   All sprites generated procedurally. Flat colors, distinct silhouettes. */
function makeTextures(scene) {
  const g = scene.add.graphics();
  const gen = (key, w, h, draw) => {
    g.clear(); draw(g); g.generateTexture(key, w, h); 
  };
  // player: pale wedge with gun barrel, points up (rotated at runtime)
  gen('player', 32, 32, (gr) => {
    gr.fillStyle(0xd6d9de); gr.fillTriangle(16, 2, 5, 28, 27, 28);
    gr.fillStyle(0x8a8f99); gr.fillRect(14, 0, 4, 12);
    gr.fillStyle(0x2a2e36); gr.fillCircle(16, 20, 5);
  });
  // mobs: distinct silhouettes, tinted at spawn
  gen('m_shambler', 26, 26, (gr) => {
    gr.fillStyle(0xffffff); gr.fillCircle(13, 13, 11);
    gr.fillStyle(0x000000, 0.35); gr.fillCircle(9, 10, 2.5); gr.fillCircle(17, 10, 2.5);
  });
  gen('m_sprinter', 22, 26, (gr) => {
    gr.fillStyle(0xffffff); gr.fillTriangle(11, 0, 0, 26, 22, 26);
    gr.fillStyle(0x000000, 0.35); gr.fillCircle(11, 14, 2.5);
  });
  gen('m_spitter', 26, 28, (gr) => {
    gr.fillStyle(0xffffff); gr.fillCircle(13, 16, 10);
    gr.fillEllipse(13, 6, 10, 8);
    gr.fillStyle(0x000000, 0.4); gr.fillCircle(13, 6, 3);
  });
  gen('m_bruiser', 42, 42, (gr) => {
    gr.fillStyle(0xffffff); gr.fillRoundedRect(2, 2, 38, 38, 8);
    gr.fillStyle(0x000000, 0.3); gr.fillRect(6, 12, 30, 5);
  });
  gen('m_burrower', 24, 24, (gr) => {
    gr.fillStyle(0xffffff); gr.fillCircle(12, 12, 10);
    gr.fillStyle(0x000000, 0.4);
    gr.fillTriangle(12, 2, 8, 10, 16, 10); gr.fillTriangle(4, 14, 12, 12, 8, 20); gr.fillTriangle(20, 14, 12, 12, 16, 20);
  });
  gen('boss_body', 64, 64, (gr) => {
    gr.fillStyle(0xffffff); gr.fillCircle(32, 32, 30);
    gr.fillStyle(0x000000, 0.3); gr.fillCircle(22, 24, 5); gr.fillCircle(42, 24, 5);
    gr.fillRect(18, 42, 28, 6);
  });
  // bullets
  gen('b_ranger', 12, 4, (gr) => { gr.fillStyle(0xfff2b0); gr.fillRect(0, 0, 12, 4); });
  gen('b_hornet', 8, 3, (gr) => { gr.fillStyle(0xc9d34a); gr.fillRect(0, 0, 8, 3); });
  gen('b_judge', 6, 6, (gr) => { gr.fillStyle(0xe0b341); gr.fillCircle(3, 3, 3); });
  gen('b_mortar', 12, 12, (gr) => { gr.fillStyle(0xb06a4a); gr.fillCircle(6, 6, 6); gr.fillStyle(0x000000, 0.3); gr.fillCircle(6, 6, 3); });
  gen('b_spit', 10, 10, (gr) => { gr.fillStyle(0x9acd32); gr.fillCircle(5, 5, 5); });
  gen('b_shard', 8, 4, (gr) => { gr.fillStyle(0xe8e4d8); gr.fillTriangle(0, 2, 8, 0, 8, 4); });
  gen('coin', 10, 10, (gr) => { gr.fillStyle(0xe0b341); gr.fillCircle(5, 5, 5); gr.fillStyle(0xfff2b0); gr.fillCircle(5, 5, 2); });
  gen('blood', 14, 14, (gr) => { gr.fillStyle(0x8a1f14); gr.fillCircle(7, 7, 6); gr.fillCircle(2, 4, 2); gr.fillCircle(12, 10, 2); });
  gen('acidpool', 110, 110, (gr) => { gr.fillStyle(0x9acd32, 0.35); gr.fillCircle(55, 55, 55); gr.fillStyle(0x9acd32, 0.5); gr.fillCircle(55, 55, 38); });
  gen('barricade', 120, 22, (gr) => { gr.fillStyle(0x6b4f33); gr.fillRect(0, 0, 120, 22); gr.fillStyle(0x000000, 0.3); gr.fillRect(0, 8, 120, 4); });
  gen('turret', 26, 26, (gr) => { gr.fillStyle(0x5a6f8a); gr.fillCircle(13, 13, 11); gr.fillStyle(0x2a2e36); gr.fillRect(11, 0, 4, 13); });
  gen('parasite', 14, 14, (gr) => { gr.fillStyle(0xc0392b); gr.fillCircle(7, 7, 5); gr.fillStyle(0x000000, 0.4); gr.fillCircle(7, 7, 2); });
  gen('dirt', 30, 30, (gr) => { gr.fillStyle(0x4a3b2a, 0.8); gr.fillCircle(15, 15, 14); });
  gen('px', 2, 2, (gr) => { gr.fillStyle(0xffffff); gr.fillRect(0, 0, 2, 2); });
  g.destroy();
}
const MOB_TEXTURE = { shambler: 'm_shambler', sprinter: 'm_sprinter', spitter: 'm_spitter', bruiser: 'm_bruiser', burrower: 'm_burrower' };

/* ============================================================ WAVE DIRECTOR
   Budget-based, sub-wave phases, breathing room between phases. */
class WaveDirector {
  constructor(scene) { this.scene = scene; this.reset(); }
  reset() { this.phases = []; this.phaseIdx = 0; this.queue = []; this.nextSpawnAt = 0; this.phaseGapUntil = 0; this.active = false; this.bossPending = false; }
  weightsFor(wave) {
    let best = CFG.WAVES.unlocks[0].weights;
    for (const u of CFG.WAVES.unlocks) if (wave >= u.wave) best = u.weights;
    return best;
  }
  startWave(wave) {
    this.reset();
    const W = CFG.WAVES;
    let budget = W.budgetBase + wave * W.budgetPerWave;
    if (wave > 10) budget *= Math.pow(W.budgetLateGrowth, wave - 10);
    const isBoss = this.scene.isBossWave(wave);
    if (isBoss) { budget *= W.bossWaveBudgetMul; this.bossPending = true; }
    const weights = this.weightsFor(wave);
    // build the roster
    const roster = [];
    while (budget > 0) {
      const type = U.weightedPick(weights);
      const cost = CFG.MOBS[type].cost;
      if (cost > budget && roster.length > 0) { budget -= 1; continue; }
      roster.push(type); budget -= cost;
    }
    Phaser.Utils.Array.Shuffle(roster);
    // split into phases
    const nPhases = U.irand(W.phasesMin, W.phasesMax);
    this.phases = Array.from({ length: nPhases }, () => []);
    roster.forEach((t, i) => this.phases[i % nPhases].push(t));
    this.phases = this.phases.filter(p => p.length > 0);
    this.phaseIdx = 0;
    this.queue = this.phases.length ? this.phases[0].slice() : [];
    this.active = true;
    this.nextSpawnAt = 0;
    if (this.bossPending) this.scene.spawnBossForWave(wave);
  }
  update(time) {
    if (!this.active) return;
    if (this.queue.length === 0) {
      // advance phase when the field thins out or empties
      const alive = this.scene.mobs.countActive(true);
      if (this.phaseIdx < this.phases.length - 1) {
        if (alive <= 4 || (this.phaseGapUntil && time >= this.phaseGapUntil)) {
          if (!this.phaseGapUntil) { this.phaseGapUntil = time + CFG.WAVES.phaseGapMs; return; }
          this.phaseIdx++;
          this.queue = this.phases[this.phaseIdx].slice();
          this.phaseGapUntil = 0;
        }
        return;
      }
      // last phase exhausted: wave ends when field + boss are clear
      if (alive === 0 && !this.scene.boss) { this.active = false; this.scene.onWaveCleared(); }
      return;
    }
    if (time >= this.nextSpawnAt && this.scene.mobs.countActive(true) < CFG.GAME.maxLiveMobs) {
      const type = this.queue.shift();
      this.scene.spawnMob(type);
      this.nextSpawnAt = time + CFG.WAVES.spawnTrickleMs;
    }
  }
}

/* ============================================================ MAIN SCENE */
class GameScene extends Phaser.Scene {
  constructor() { super('game'); }

  create() {
    makeTextures(this);
    const W = CFG.GAME.width, H = CFG.GAME.height;

    // road corridor backdrop
    const bg = this.add.graphics();
    bg.fillStyle(CFG.GAME.bgColor); bg.fillRect(0, 0, W, H);
    bg.fillStyle(CFG.GAME.roadColor); bg.fillRect(80, 0, W - 160, H);
    bg.fillStyle(CFG.GAME.roadEdge); bg.fillRect(76, 0, 8, H); bg.fillRect(W - 84, 0, 8, H);
    bg.lineStyle(3, 0x383e48, 0.5);
    for (let y = 0; y < H; y += 60) bg.lineBetween(W / 2, y, W / 2, y + 30);

    // persistent gore layer
    this.gore = this.add.renderTexture(0, 0, W, H).setOrigin(0).setAlpha(CFG.GAME.goreAlpha);

    // groups
    this.bullets = this.physics.add.group();        // player projectiles
    this.enemyShots = this.physics.add.group();     // spitter / boss projectiles
    this.mobs = this.physics.add.group();
    this.coins = this.physics.add.group();
    this.parasites = this.physics.add.group();
    this.acidPools = this.add.group();              // hazards (no physics body needed)
    this.turrets = [];
    this.barricades = this.physics.add.staticGroup();

    // player
    this.player = this.physics.add.sprite(CFG.PLAYER.spawnX, CFG.PLAYER.spawnY, 'player');
    this.player.setCircle(CFG.PLAYER.radius, 16 - CFG.PLAYER.radius, 16 - CFG.PLAYER.radius);
    this.player.setCollideWorldBounds(true);
    this.playerHp = playerMaxHp();
    this.invulnUntil = 0;
    this.lastFire = 0;
    this.swapLockUntil = 0;
    this.boss = null;
    this.beam = this.add.graphics().setDepth(5);
    this.fxg = this.add.graphics().setDepth(6);     // transient fx (telegraphs, rings)
    this.rings = [];                                 // expanding ring fx
    this.floatPool = [];
    this.gameState = 'idle';                         // idle | wave | intermission | over
    this.director = new WaveDirector(this);

    // input
    this.keys = this.input.keyboard.addKeys('W,A,S,D,UP,LEFT,DOWN,RIGHT,R,Q,G,P,ESC');
    this.input.keyboard.on('keydown-R', () => this.tryReload());
    this.input.keyboard.on('keydown-Q', () => this.swapWeapon());
    this.input.keyboard.on('keydown-G', () => this.throwGrenade());
    this.input.keyboard.on('keydown-P', () => UI.togglePause());
    this.input.keyboard.on('keydown-ESC', () => UI.togglePause());

    // physics overlaps
    this.physics.add.overlap(this.bullets, this.mobs, (b, m) => this.onBulletHitMob(b, m));
    this.physics.add.overlap(this.player, this.mobs, (p, m) => this.onMobTouchPlayer(m));
    this.physics.add.overlap(this.player, this.enemyShots, (p, s) => this.onEnemyShotHit(s));
    this.physics.add.overlap(this.player, this.coins, (p, c) => this.onCoinPickup(c));
    this.physics.add.overlap(this.parasites, this.mobs, (pa, m) => this.onParasiteHit(pa, m));
    this.physics.add.collider(this.mobs, this.barricades, (m, bar) => this.onMobHitBarricade(m, bar));

    UI.bind(this);
  }

  /* ------------------------------------------------ wave flow */
  isBossWave(w) {
    if (CFG.WAVES.bossWavesCampaign.includes(w)) return true;
    return w > 10 && (w - 10) % CFG.WAVES.postCampaignBossEvery === 0;
  }
  beginNextWave() {
    Run.wave++;
    Run.revivedThisWave = false;
    this.gameState = 'wave';
    // expire turrets
    this.turrets = this.turrets.filter(t => {
      t.wavesLeft--;
      if (t.wavesLeft <= 0) { t.sprite.destroy(); UI.toast(FLAVOR.DEFENSES.turretExpired); return false; }
      return true;
    });
    const boss = this.isBossWave(Run.wave);
    UI.banner(boss ? FLAVOR.WAVE_BANNER.boss : (Run.wave > 10 ? FLAVOR.WAVE_BANNER.overtime + ' ' + Run.wave : FLAVOR.WAVE_BANNER.wave + ' ' + Run.wave), boss);
    UI.qmSay(boss ? U.choose(FLAVOR.QM.bossIntro) : U.choose(FLAVOR.QM.waveIntro[Run.mutationStage()]));
    this.director.startWave(Run.wave);
    UI.refreshHud(this);
  }
  onWaveCleared() {
    if (this.gameState !== 'wave') return;
    this.gameState = 'intermission';
    Sfx.play('waveClear');
    UI.banner(FLAVOR.WAVE_BANNER.clear, false);
    this.time.delayedCall(CFG.WAVES.breatherAfterWaveMs, () => {
      if (Run.over) return;
      if (this.pendingBossReward) { this.pendingBossReward = false; UI.showBossModal(this.lastBossId); }
      else UI.openShop();
    });
  }

  /* ------------------------------------------------ spawning */
  spawnEdgeX() { return U.rand(100, CFG.GAME.width - 100); }
  spawnMob(type, x, y, opts) {
    const def = CFG.MOBS[type];
    const sc = CFG.SCALING;
    const w = Run.wave;
    const hpMul = (1 + sc.hpPerWave * (w - 1)) * Math.pow(sc.hpLateGrowth, Math.max(0, w - 10));
    const dmgMulW = 1 + sc.dmgPerWave * (w - 1);
    const spdMul = Math.min(sc.speedPerWaveCap, 1 + sc.speedPerWave * (w - 1));
    const m = this.mobs.get(x !== undefined ? x : this.spawnEdgeX(), y !== undefined ? y : -20, MOB_TEXTURE[type]);
    if (!m) return null;
    m.setActive(true).setVisible(true).setTint(def.tint).setDepth(2);
    m.body.enable = true;
    m.setCircle(def.radius, m.width / 2 - def.radius, m.height / 2 - def.radius);
    m.mobType = type;
    m.hp = def.hp * hpMul; m.maxHp = m.hp;
    m.dmg = def.dmg * dmgMulW;
    m.speed = def.speed * spdMul;
    m.gold = def.gold;
    m.lastContact = 0; m.lastSpurTick = 0;
    m.kbx = 0; m.kby = 0;
    m.slowUntil = 0; m.igniteUntil = 0; m.lastIgniteTick = 0;
    m.isBoss = false;
    m.spawnT = this.time.now;
    if (type === 'sprinter') m.weaveSeed = Math.random() * 10;
    if (type === 'spitter') m.nextShot = this.time.now + U.rand(800, def.shotMs);
    if (type === 'burrower' && !(opts && opts.noTunnel)) {
      m.tunneling = true; m.emergeAt = this.time.now + def.tunnelMs;
      m.setVisible(false); m.body.enable = false;
      m.dirtMark = this.add.image(m.x, m.y, 'dirt').setDepth(1).setAlpha(0.7);
    }
    return m;
  }

  spawnBossForWave(wave) {
    let id;
    if (wave === 3) id = 'butcher';
    else if (wave === 6) id = 'matriarch';
    else if (wave === 10) id = 'colossus';
    else { id = ['butcher', 'matriarch', 'colossus'][Run.bossCycle % 3]; Run.bossCycle++; }
    const def = CFG.BOSSES[id];
    let hpMul = 1, statMul = 1;
    if (wave > 10) {
      const cycles = Math.floor((wave - 10) / CFG.WAVES.postCampaignBossEvery);
      hpMul = CFG.BOSS_SCALING.hpLateMul * Math.pow(CFG.BOSS_SCALING.perCycle, cycles);
      statMul = 1 + 0.1 * cycles;
    }
    const b = this.physics.add.sprite(CFG.GAME.width / 2, -60, 'boss_body');
    b.setTint(def.tint).setDepth(3);
    b.setCircle(def.radius, 32 - def.radius, 32 - def.radius);
    b.bossId = id; b.isBoss = true;
    b.hp = def.hp * hpMul; b.maxHp = b.hp;
    b.dmg = def.dmg * statMul; b.speed = def.speed;
    b.phase = 1;
    b.nextAbilityAt = this.time.now + 2500;
    b.nextSummonAt = this.time.now + 4000;
    b.charging = false; b.telegraphUntil = 0;
    b.kbx = 0; b.kby = 0; b.lastContact = 0; b.lastSpurTick = 0;
    b.slowUntil = 0; b.igniteUntil = 0; b.lastIgniteTick = 0;
    b.dr = 0;
    const scale = 1 + def.radius / 60;
    b.setScale(scale);
    this.boss = b;
    this.physics.add.overlap(this.bullets, b, (bb, bul) => this.onBulletHitMob(bul.texture ? bul : bb, bul.texture ? bb : bul));
    this.physics.add.overlap(this.player, b, () => this.onMobTouchPlayer(b));
    this.physics.add.overlap(this.parasites, b, (pa) => this.onParasiteHit(pa, b));
  }

  /* ------------------------------------------------ firing */
  activeWeapon() { return Run.weapons[Run.active]; }
  tryReload() {
    const ws = this.activeWeapon();
    const stats = computeWeapon(ws);
    if (stats.archetype === 'laser' || ws.reloading || ws.ammo >= stats.magSize) return;
    ws.reloading = true;
    Sfx.play('reload');
    if (Run.has('howler')) this.fearPulse();
    this.time.delayedCall(stats.reloadMs, () => { ws.reloading = false; ws.ammo = stats.magSize; UI.refreshHud(this); });
    UI.refreshHud(this);
  }
  swapWeapon() {
    if (!Run.weapons.secondary || this.time.now < this.swapLockUntil) return;
    Run.active = Run.active === 'primary' ? 'secondary' : 'primary';
    this.swapLockUntil = this.time.now + CFG.WEAPON_SWAP_MS;
    Sfx.play('uiClick');
    UI.refreshHud(this);
  }
  throwGrenade() {
    if (this.gameState !== 'wave' || Run.grenades <= 0) return;
    Run.grenades--;
    Sfx.play('grenade');
    const P = CFG.PLAYER;
    const ptr = this.input.activePointer;
    const tx = ptr.worldX, ty = ptr.worldY;
    const nade = this.add.image(this.player.x, this.player.y, 'b_mortar').setDepth(4).setScale(1.1);
    this.tweens.add({ targets: nade, x: tx, y: ty, duration: P.grenadeFuseMs, onComplete: () => {
      this.explode(nade.x, nade.y, P.grenadeRadius, P.grenadeDamage * damageMul(this), P.grenadeKnockback, true);
      nade.destroy();
    }});
    UI.refreshHud(this);
  }

  handleFiring(time) {
    const ws = this.activeWeapon();
    const stats = computeWeapon(ws);
    const ptr = this.input.activePointer;
    const firing = ptr.isDown && this.gameState === 'wave' && !UI.anyOverlay();
    // laser is special: heat model, continuous beam
    if (stats.archetype === 'laser') {
      this.beam.clear();
      const dt = this.game.loop.delta / 1000;
      if (ws.venting) {
        ws.heat = Math.max(0, ws.heat - (stats.coolPerSec * 1.6) * dt * (100 / stats.overheatVentMs * 1000) / 100);
      }
      if (firing && !ws.venting) {
        ws.heat += stats.heatPerSec * dt;
        if (ws.heat >= 100) {
          ws.heat = 100; ws.venting = true;
          Sfx.play('overheat');
          if (Run.has('howler')) this.fearPulse();
          this.time.delayedCall(stats.overheatVentMs, () => { ws.venting = false; ws.heat = 0; UI.refreshHud(this); });
        } else {
          this.fireLaser(stats, time);
        }
      } else if (!ws.venting) {
        ws.heat = Math.max(0, ws.heat - stats.coolPerSec * dt);
      }
      UI.refreshAmmo(this);
      return;
    }
    if (!firing || time < this.lastFire + stats.fireRateMs) return;
    if (ws.reloading) return;
    if (ws.ammo <= 0) { this.tryReload(); return; }
    this.lastFire = time;
    ws.ammo--;
    this.fireProjectiles(stats);
    if (ws.ammo <= 0) this.tryReload();
    UI.refreshAmmo(this);
  }

  fireProjectiles(stats) {
    const ptr = this.input.activePointer;
    const baseAngle = Phaser.Math.Angle.Between(this.player.x, this.player.y, ptr.worldX, ptr.worldY);
    Sfx.play('shoot_' + this.activeWeapon().id);
    const count = (stats.pellets > 1 ? stats.pellets : 1) + stats.extraProjectiles;
    for (let i = 0; i < count; i++) {
      let ang = baseAngle;
      if (count > 1 && stats.pellets > 1) ang += Phaser.Math.DegToRad(U.rand(-stats.spread, stats.spread));
      else ang += Phaser.Math.DegToRad(U.rand(-stats.spread, stats.spread) + (i > 0 ? U.rand(-4, 4) : 0));
      const b = this.bullets.get(this.player.x, this.player.y, stats.bulletKey);
      if (!b) continue;
      b.setActive(true).setVisible(true).setDepth(4).setScale(stats.bulletScale);
      b.body.enable = true;
      b.setRotation(ang);
      this.physics.velocityFromRotation(ang, stats.projSpeed, b.body.velocity);
      b.dmg = stats.damage * damageMul(this);
      b.pierce = stats.pierce;
      b.knock = stats.knockback;
      b.crit = rollCrit(stats);
      b.critMult = stats.critMult;
      b.critExplode = stats.critExplode;
      b.aoe = stats.aoeRadius; b.aoeKnock = stats.aoeKnockback;
      b.cluster = stats.cluster;
      b.ricochet = stats.ricochet;
      b.bornX = this.player.x; b.bornY = this.player.y;
      b.falloffStart = stats.falloffStart; b.falloffMin = stats.falloffMin;
      b.rangePx = stats.rangePx;
      b.hitSet = new Set();
      b.born = this.time.now;
    }
    // muzzle + recoil juice
    if (stats.pellets > 1) this.shake(CFG.JUICE.shake.shotgun, CFG.JUICE.shakeMs.small);
    if (stats.shockwave) {
      const sw = stats.shockwave;
      this.explode(this.player.x + Math.cos(baseAngle) * 40, this.player.y + Math.sin(baseAngle) * 40, sw.radius, stats.damage * sw.dmgMul * damageMul(this), sw.knockback, false);
    }
  }

  fireLaser(stats, time) {
    const ptr = this.input.activePointer;
    const ang = Phaser.Math.Angle.Between(this.player.x, this.player.y, ptr.worldX, ptr.worldY);
    const ex = this.player.x + Math.cos(ang) * stats.beamRange;
    const ey = this.player.y + Math.sin(ang) * stats.beamRange;
    this.beam.lineStyle(stats.beamWidth, 0xff7a5f, 0.85).lineBetween(this.player.x, this.player.y, ex, ey);
    this.beam.lineStyle(Math.max(1, stats.beamWidth * 0.4), 0xfff2b0, 1).lineBetween(this.player.x, this.player.y, ex, ey);
    if (!this.lastBeamTick || time >= this.lastBeamTick + stats.fireRateMs) {
      this.lastBeamTick = time;
      Sfx.play('shoot_prism');
      const tickDmg = stats.damagePerSec * (stats.fireRateMs / 1000) * damageMul(this);
      const halfW = stats.beamWidth / 2 + 10;
      const line = new Phaser.Geom.Line(this.player.x, this.player.y, ex, ey);
      const victims = [];
      this.mobs.children.iterate((m) => { if (m && m.active && !m.tunneling) victims.push(m); });
      if (this.boss) victims.push(this.boss);
      for (const m of victims) {
        const pt = Phaser.Geom.Line.GetNearestPoint(line, m, new Phaser.Geom.Point());
        if (Phaser.Math.Distance.Between(pt.x, pt.y, m.x, m.y) < halfW + (m.isBoss ? 30 : CFG.MOBS[m.mobType].radius)) {
          this.damageMob(m, tickDmg, false, 0, ang);
          if (stats.igniteDps) { m.igniteUntil = time + stats.igniteMs; m.igniteDps = stats.igniteDps; }
        }
      }
    }
  }

  /* ------------------------------------------------ damage resolution */
  onBulletHitMob(b, m) {
    if (!b.active || !m.active || (m.tunneling)) return;
    if (b.hitSet && b.hitSet.has(m)) return;
    if (b.hitSet) b.hitSet.add(m);
    let dmg = b.dmg;
    // falloff (hornet)
    if (b.falloffStart) {
      const d = Phaser.Math.Distance.Between(b.bornX, b.bornY, b.x, b.y);
      if (d > b.falloffStart) dmg *= Math.max(b.falloffMin, 1 - (d - b.falloffStart) / 400 * (1 - b.falloffMin));
    }
    const crit = b.crit;
    if (crit) dmg *= b.critMult;
    const ang = Math.atan2(m.y - b.bornY, m.x - b.bornX);
    this.damageMob(m, dmg, crit, b.knock, ang);
    if (crit && b.critExplode) this.explode(m.x, m.y, b.critExplode.radius, b.dmg * b.critExplode.dmgMul, 120, false);
    if (b.aoe) { this.explode(b.x, b.y, b.aoe, dmg, b.aoeKnock, true, b.cluster); this.recycleBullet(b); return; }
    if (b.ricochet && b.ricochet > 0) {
      b.ricochet--;
      const next = this.nearestMob(m.x, m.y, 220, m);
      if (next) {
        const a2 = Phaser.Math.Angle.Between(m.x, m.y, next.x, next.y);
        b.setPosition(m.x, m.y).setRotation(a2);
        this.physics.velocityFromRotation(a2, b.body.speed, b.body.velocity);
        return;
      }
    }
    if (b.pierce > 0) { b.pierce--; return; }
    this.recycleBullet(b);
  }
  recycleBullet(b) { b.setActive(false).setVisible(false); b.body.enable = false; }

  explode(x, y, radius, dmg, knock, big, cluster) {
    Sfx.play('explosion');
    this.shake(CFG.JUICE.shake.explosion, big ? CFG.JUICE.shakeMs.med : CFG.JUICE.shakeMs.small);
    this.ringFx(x, y, radius, 0xe0915a);
    const victims = [];
    this.mobs.children.iterate((m) => { if (m && m.active && !m.tunneling) victims.push(m); });
    if (this.boss) victims.push(this.boss);
    for (const m of victims) {
      const d = Phaser.Math.Distance.Between(x, y, m.x, m.y);
      if (d <= radius + (m.isBoss ? 30 : 12)) {
        const ang = Math.atan2(m.y - y, m.x - x);
        this.damageMob(m, dmg, false, knock, ang);
      }
    }
    if (cluster) {
      for (let i = 0; i < cluster.count; i++) {
        const cx = x + U.rand(-cluster.scatterPx, cluster.scatterPx);
        const cy = y + U.rand(-cluster.scatterPx, cluster.scatterPx);
        this.time.delayedCall(120 + i * 90, () => this.explode(cx, cy, radius * cluster.radiusMul, dmg * cluster.dmgMul, knock * 0.6, false));
      }
    }
  }

  damageMob(m, dmg, crit, knock, ang) {
    if (!m.active) return;
    const def = m.isBoss ? CFG.BOSSES[m.bossId] : CFG.MOBS[m.mobType];
    let dr = (def.dmgReduction || 0) + (m.dr || 0);
    // predator execute
    if (Run.has('predator') && m.hp / m.maxHp <= CFG.MUTATIONS.predator.hpThreshold) dmg *= CFG.MUTATIONS.predator.dmgMul;
    dmg *= (1 - Math.min(0.8, dr));
    m.hp -= dmg;
    // juice
    m.setTintFill(0xffffff);
    this.time.delayedCall(CFG.JUICE.hitFlashMs, () => { if (m.active) m.isBoss ? m.setTint(def.tint) : m.setTint(def.tint); });
    if (knock && !m.isBoss) { m.kbx += Math.cos(ang) * knock; m.kby += Math.sin(ang) * knock; }
    this.floatText(m.x, m.y - 14, Math.round(dmg), crit ? '#ff5a3c' : '#d6d9de', crit);
    if (crit) { Sfx.play('crit'); this.shake(CFG.JUICE.shake.crit, CFG.JUICE.shakeMs.small); }
    if (m.hp <= 0) m.isBoss ? this.killBoss(m) : this.killMob(m);
  }

  killMob(m) {
    if (!m.active) return;
    Sfx.play('kill');
    Run.kills++;
    if (Run.has('apex')) Run.apexStacks++;
    if (Run.has('hemovore') && Math.random() < CFG.MUTATIONS.hemovore.healChance) this.healPlayer(CFG.MUTATIONS.hemovore.healAmt);
    if (Run.has('splitter') && Math.random() < CFG.MUTATIONS.splitter.chance) this.burstShards(m.x, m.y);
    this.splatBlood(m.x, m.y);
    this.dropCoins(m.x, m.y, m.gold);
    if (m.dirtMark) { m.dirtMark.destroy(); m.dirtMark = null; }
    m.setActive(false).setVisible(false); m.body.enable = false;
    UI.refreshHud(this);
  }

  killBoss(b) {
    if (!b.active) return;
    Sfx.play('bossDie');
    this.shake(CFG.JUICE.shake.bossDie, CFG.JUICE.shakeMs.big);
    Run.kills++;
    if (Run.has('apex')) Run.apexStacks++;
    const def = CFG.BOSSES[b.bossId];
    for (let i = 0; i < 6; i++) this.splatBlood(b.x + U.rand(-40, 40), b.y + U.rand(-40, 40));
    this.dropCoins(b.x, b.y, def.gold);
    this.ringFx(b.x, b.y, 160, 0xc0392b);
    this.lastBossId = b.bossId;
    this.lastBossTier = def.tier;
    this.pendingBossReward = true;
    b.destroy();
    this.boss = null;
    UI.refreshHud(this);
  }

  burstShards(x, y) {
    const cfg = CFG.MUTATIONS.splitter;
    for (let i = 0; i < cfg.shards; i++) {
      const ang = (Math.PI * 2 / cfg.shards) * i + U.rand(-0.2, 0.2);
      const s = this.bullets.get(x, y, 'b_shard');
      if (!s) continue;
      s.setActive(true).setVisible(true).setDepth(4).setRotation(ang).setScale(1);
      s.body.enable = true;
      this.physics.velocityFromRotation(ang, cfg.shardSpeed, s.body.velocity);
      s.dmg = cfg.shardDmg * damageMul(this);
      s.pierce = 0; s.knock = 60; s.crit = false; s.critMult = 2;
      s.critExplode = null; s.aoe = 0; s.cluster = null; s.ricochet = 0;
      s.bornX = x; s.bornY = y; s.falloffStart = 0; s.rangePx = 240;
      s.hitSet = new Set(); s.born = this.time.now;
    }
  }

  /* ------------------------------------------------ player damage */
  hurtPlayer(rawDmg, srcX, srcY) {
    if (this.time.now < this.invulnUntil || this.gameState !== 'wave') return;
    let dmg = Math.max(1, Math.round(rawDmg) - Run.armor);
    this.playerHp -= dmg;
    this.invulnUntil = this.time.now + CFG.PLAYER.invulnMs;
    Sfx.play('hurt');
    this.shake(CFG.JUICE.shake.hurt, CFG.JUICE.shakeMs.med);
    this.player.setTintFill(0xff5a3c);
    this.time.delayedCall(CFG.JUICE.hitFlashMs * 2, () => this.player.clearTint());
    this.floatText(this.player.x, this.player.y - 20, '-' + dmg, '#ff5a3c', true);
    // acid blood retaliation
    if (Run.has('acidBlood')) {
      const ab = CFG.MUTATIONS.acidBlood;
      this.ringFx(this.player.x, this.player.y, ab.radius, 0x9acd32);
      this.areaDamage(this.player.x, this.player.y, ab.radius, ab.dmg * damageMul(this), 140);
    }
    // hive heart parasite
    if (Run.has('hiveHeart') && Math.random() < CFG.MUTATIONS.hiveHeart.chance && this.parasites.countActive(true) < CFG.GAME.maxParasites) {
      this.spawnParasite();
    }
    if (this.playerHp <= 0) {
      if (Run.has('mitosis') && !Run.revivedThisWave) {
        Run.revivedThisWave = true;
        const mt = CFG.MUTATIONS.mitosis;
        this.playerHp = Math.ceil(playerMaxHp() * mt.reviveHpPct);
        this.invulnUntil = this.time.now + 1500;
        Sfx.play('revive');
        this.ringFx(this.player.x, this.player.y, mt.shockRadius, 0xc9d34a);
        this.areaDamage(this.player.x, this.player.y, mt.shockRadius, mt.shockDmg * damageMul(this), mt.shockKnockback);
        this.floatText(this.player.x, this.player.y - 30, FLAVOR.REVIVE_TEXT, '#c9d34a', true);
      } else {
        this.gameOver();
      }
    }
    UI.refreshHud(this);
  }
  healPlayer(amt) {
    this.playerHp = Math.min(playerMaxHp(), this.playerHp + amt);
    UI.refreshHud(this);
  }
  areaDamage(x, y, radius, dmg, knock) {
    const victims = [];
    this.mobs.children.iterate((m) => { if (m && m.active && !m.tunneling) victims.push(m); });
    if (this.boss) victims.push(this.boss);
    for (const m of victims) {
      if (Phaser.Math.Distance.Between(x, y, m.x, m.y) <= radius) {
        this.damageMob(m, dmg, false, knock, Math.atan2(m.y - y, m.x - x));
      }
    }
  }
  fearPulse() {
    const h = CFG.MUTATIONS.howler;
    this.ringFx(this.player.x, this.player.y, h.radius, 0x7a5fc9);
    this.mobs.children.iterate((m) => {
      if (!m || !m.active || m.tunneling) return;
      if (Phaser.Math.Distance.Between(this.player.x, this.player.y, m.x, m.y) <= h.radius) {
        const ang = Math.atan2(m.y - this.player.y, m.x - this.player.x);
        m.kbx += Math.cos(ang) * h.knockback; m.kby += Math.sin(ang) * h.knockback;
        m.slowUntil = this.time.now + h.slowMs;
      }
    });
  }
  spawnParasite() {
    const hh = CFG.MUTATIONS.hiveHeart;
    const p = this.parasites.get(this.player.x, this.player.y, 'parasite');
    if (!p) return;
    p.setActive(true).setVisible(true).setDepth(4);
    p.body.enable = true;
    p.dieAt = this.time.now + hh.parasiteLifeMs;
    p.lastHit = 0;
  }
  onParasiteHit(pa, m) {
    const hh = CFG.MUTATIONS.hiveHeart;
    if (!pa.active || !m.active || this.time.now < pa.lastHit + hh.parasiteHitMs) return;
    pa.lastHit = this.time.now;
    this.damageMob(m, hh.parasiteDmg * damageMul(this), false, 40, Math.atan2(m.y - pa.y, m.x - pa.x));
  }

  /* ------------------------------------------------ contact & pickups */
  onMobTouchPlayer(m) {
    if (!m.active || m.tunneling) return;
    const now = this.time.now;
    // bone spurs: the player wounds attackers on contact
    if (Run.has('boneSpurs') && now >= (m.lastSpurTick || 0) + CFG.MUTATIONS.boneSpurs.tickMs) {
      m.lastSpurTick = now;
      const bs = CFG.MUTATIONS.boneSpurs;
      const ang = Math.atan2(m.y - this.player.y, m.x - this.player.x);
      this.damageMob(m, bs.contactDmg * damageMul(this), false, m.isBoss ? 0 : bs.contactKnockback, ang);
      if (!m.active) return;
    }
    if (now < (m.lastContact || 0) + CFG.PLAYER.contactDmgCooldownMs) return;
    m.lastContact = now;
    this.hurtPlayer(m.dmg, m.x, m.y);
  }
  onEnemyShotHit(s) {
    if (!s.active) return;
    this.hurtPlayer(s.dmg, s.x, s.y);
    s.setActive(false).setVisible(false); s.body.enable = false;
  }
  onCoinPickup(c) {
    if (!c.active) return;
    c.setActive(false).setVisible(false); c.body.enable = false;
    Sfx.play('coin');
    let v = c.value;
    if (Run.has('scavenger')) v = Math.round(v * CFG.MUTATIONS.scavenger.goldMul);
    Run.gold += v; Run.goldEarned += v;
    UI.refreshHud(this);
  }
  dropCoins(x, y, total) {
    const n = U.clamp(Math.ceil(total / 3), 1, 6);
    const each = Math.max(1, Math.round(total / n));
    for (let i = 0; i < n; i++) {
      const c = this.coins.get(x + U.rand(-CFG.JUICE.coinBurstSpread, CFG.JUICE.coinBurstSpread), y + U.rand(-CFG.JUICE.coinBurstSpread, CFG.JUICE.coinBurstSpread), 'coin');
      if (!c) continue;
      c.setActive(true).setVisible(true).setDepth(3);
      c.body.enable = true;
      c.value = each;
      c.dieAt = this.time.now + CFG.ECONOMY.coinLifeMs;
      c.setVelocity(U.rand(-60, 60), U.rand(-60, 60));
      c.body.setDrag(140, 140);
    }
  }
  onMobHitBarricade(m, bar) {
    const now = this.time.now;
    if (now < (m.lastBarHit || 0) + 600) return;
    m.lastBarHit = now;
    bar.hp -= m.dmg;
    if (bar.hp <= 0) { bar.destroy(); UI.toast(FLAVOR.DEFENSES.barricadeDown); }
  }

  /* ------------------------------------------------ enemy & boss AI */
  updateMobs(time, dt) {
    const px = this.player.x, py = this.player.y;
    this.mobs.children.iterate((m) => {
      if (!m || !m.active) return;
      const def = CFG.MOBS[m.mobType];
      // burrower tunnel logic
      if (m.tunneling) {
        // glide the dirt mound toward the player, then telegraph + emerge
        const ang = Math.atan2(py - m.y, px - m.x);
        m.x += Math.cos(ang) * m.speed * 1.4 * dt;
        m.y += Math.sin(ang) * m.speed * 1.4 * dt;
        if (m.dirtMark) m.dirtMark.setPosition(m.x, m.y);
        const close = Phaser.Math.Distance.Between(m.x, m.y, px, py) < def.emergeNearPx;
        if ((time >= m.emergeAt || close) && !m.emerging) {
          m.emerging = true;
          if (m.dirtMark) m.dirtMark.setTint(0xc97a9b);
          this.time.delayedCall(def.telegraphMs, () => {
            if (!m.active) return;
            m.tunneling = false; m.emerging = false;
            m.setVisible(true); m.body.enable = true;
            if (m.dirtMark) { m.dirtMark.destroy(); m.dirtMark = null; }
            this.ringFx(m.x, m.y, 30, 0xc97a9b);
          });
        }
        return;
      }
      // ignite DoT (sunlance)
      if (m.igniteUntil > time && time >= m.lastIgniteTick + 400) {
        m.lastIgniteTick = time;
        this.damageMob(m, m.igniteDps * 0.4, false, 0, 0);
        if (!m.active) return;
      }
      const slowMul = m.slowUntil > time ? CFG.MUTATIONS.howler.slowMul : 1;
      let vx = 0, vy = 0;
      const ang = Math.atan2(py - m.y, px - m.x);
      if (m.mobType === 'sprinter') {
        const weave = Math.sin(time / 1000 * def.weaveHz * Math.PI * 2 + m.weaveSeed) * def.weaveAmp;
        const perp = ang + Math.PI / 2;
        vx = Math.cos(ang) * m.speed + Math.cos(perp) * weave;
        vy = Math.sin(ang) * m.speed + Math.sin(perp) * weave;
      } else if (m.mobType === 'spitter') {
        const d = Phaser.Math.Distance.Between(m.x, m.y, px, py);
        if (d > def.standoffPx) { vx = Math.cos(ang) * m.speed; vy = Math.sin(ang) * m.speed; }
        else if (d < def.standoffPx - 60) { vx = -Math.cos(ang) * m.speed * 0.7; vy = -Math.sin(ang) * m.speed * 0.7; }
        if (d < def.standoffPx + 80 && time >= m.nextShot) {
          m.nextShot = time + def.shotMs;
          this.spitAt(m.x, m.y, px, py, def.projSpeed, m.dmg);
        }
      } else {
        vx = Math.cos(ang) * m.speed; vy = Math.sin(ang) * m.speed;
      }
      // knockback decay
      m.kbx *= CFG.JUICE.knockbackDecay; m.kby *= CFG.JUICE.knockbackDecay;
      m.setVelocity(vx * slowMul + m.kbx, vy * slowMul + m.kby);
    });
  }

  spitAt(x, y, tx, ty, speed, dmg) {
    const s = this.enemyShots.get(x, y, 'b_spit');
    if (!s) return;
    s.setActive(true).setVisible(true).setDepth(3);
    s.body.enable = true;
    const ang = Math.atan2(ty - y, tx - x);
    this.physics.velocityFromRotation(ang, speed, s.body.velocity);
    s.dmg = dmg;
    s.dieAt = this.time.now + 5000;
  }

  updateBoss(time, dt) {
    const b = this.boss;
    if (!b || !b.active) return;
    const def = CFG.BOSSES[b.bossId];
    const px = this.player.x, py = this.player.y;
    const ang = Math.atan2(py - b.y, px - b.x);
    const hpPct = b.hp / b.maxHp;
    // phase transitions
    if (b.bossId === 'butcher' && b.phase === 1 && hpPct <= def.phase2At) { b.phase = 2; b.speed *= def.phase2SpeedMul; this.ringFx(b.x, b.y, 80, 0xc0392b); }
    if (b.bossId === 'matriarch' && b.phase === 1 && hpPct <= def.phase2At) { b.phase = 2; this.ringFx(b.x, b.y, 80, 0x8a5fd0); }
    if (b.bossId === 'colossus') {
      if (b.phase === 1 && hpPct <= def.phase2At) { b.phase = 2; b.dr = def.phase2Dr; this.ringFx(b.x, b.y, 100, 0x5a6f8a); }
      if (b.phase === 2 && hpPct <= def.phase3At) { b.phase = 3; b.dr = 0; b.speed *= def.phase3SpeedMul; this.ringFx(b.x, b.y, 120, 0xc0392b); }
    }
    let vx = 0, vy = 0;
    if (b.bossId === 'butcher') {
      if (b.charging) {
        if (time >= b.chargeUntil) b.charging = false;
      } else if (time >= b.telegraphUntil && b.telegraphing) {
        b.telegraphing = false; b.charging = true; b.chargeUntil = time + def.chargeMs;
        b.chargeAng = ang;
      } else if (time >= b.nextAbilityAt && !b.telegraphing) {
        b.telegraphing = true; b.telegraphUntil = time + def.chargeTelegraphMs;
        b.nextAbilityAt = time + def.chargeEveryMs;
        b.setTintFill(0xff5a3c);
        this.time.delayedCall(def.chargeTelegraphMs, () => { if (b.active) b.setTint(def.tint); });
      }
      if (b.charging) { vx = Math.cos(b.chargeAng) * def.chargeSpeed; vy = Math.sin(b.chargeAng) * def.chargeSpeed; }
      else if (!b.telegraphing) { vx = Math.cos(ang) * b.speed; vy = Math.sin(ang) * b.speed; }
      if (b.phase === 2 && time >= b.nextSummonAt) {
        b.nextSummonAt = time + def.summonEveryMs;
        for (let i = 0; i < def.summonCount; i++) this.spawnMob('shambler', b.x + U.rand(-50, 50), b.y + U.rand(-30, 30));
      }
    } else if (b.bossId === 'matriarch') {
      const d = Phaser.Math.Distance.Between(b.x, b.y, px, py);
      if (d > def.standoffPx) { vx = Math.cos(ang) * b.speed; vy = Math.sin(ang) * b.speed; }
      else { vx = Math.cos(ang + Math.PI / 2) * b.speed * 0.7; vy = Math.sin(ang + Math.PI / 2) * b.speed * 0.7; }
      const volleyMs = def.volleyEveryMs * (b.phase === 2 ? def.phase2VolleyMul : 1);
      if (time >= b.nextAbilityAt) {
        b.nextAbilityAt = time + volleyMs;
        for (let i = 0; i < def.volleyCount; i++) {
          this.time.delayedCall(i * 180, () => {
            if (!b.active) return;
            this.spitAt(b.x, b.y, px + U.rand(-60, 60), py + U.rand(-60, 60), def.projSpeed, b.dmg * 0.6);
            this.dropAcidPool(px + U.rand(-90, 90), py + U.rand(-90, 90), def);
          });
        }
      }
      const spawnMs = def.spawnEveryMs * (b.phase === 2 ? def.phase2SpawnMul : 1);
      if (time >= b.nextSummonAt) {
        b.nextSummonAt = time + spawnMs;
        for (let i = 0; i < def.spawnCount; i++) this.spawnMob('sprinter', b.x + U.rand(-40, 40), b.y + 20);
      }
    } else if (b.bossId === 'colossus') {
      vx = Math.cos(ang) * b.speed; vy = Math.sin(ang) * b.speed;
      const slamMs = def.slamEveryMs * (b.phase === 3 ? def.phase3SlamMul : 1);
      const d = Phaser.Math.Distance.Between(b.x, b.y, px, py);
      if (time >= b.nextAbilityAt && d < def.slamRadius + 80 && !b.telegraphing) {
        b.telegraphing = true; b.telegraphUntil = time + def.slamTelegraphMs;
        b.nextAbilityAt = time + slamMs;
        b.slamX = b.x; b.slamY = b.y;
        b.setTintFill(0xfff2b0);
        this.time.delayedCall(def.slamTelegraphMs, () => {
          if (!b.active) return;
          b.setTint(def.tint); b.telegraphing = false;
          Sfx.play('explosion');
          this.shake(CFG.JUICE.shake.slam, CFG.JUICE.shakeMs.big);
          this.ringFx(b.x, b.y, def.slamRadius, 0xfff2b0);
          if (Phaser.Math.Distance.Between(b.x, b.y, this.player.x, this.player.y) <= def.slamRadius) {
            this.hurtPlayer(def.slamDmg, b.x, b.y);
            const ka = Math.atan2(this.player.y - b.y, this.player.x - b.x);
            this.player.body.velocity.x += Math.cos(ka) * def.slamKnockback;
            this.player.body.velocity.y += Math.sin(ka) * def.slamKnockback;
          }
        });
      }
      if (b.telegraphing) { vx = 0; vy = 0; }
      if (b.phase >= 2 && time >= b.nextSummonAt) {
        b.nextSummonAt = time + def.phase2SummonEveryMs;
        for (let i = 0; i < def.phase2SummonCount; i++) this.spawnMob(def.phase2SummonType, b.x + U.rand(-60, 60), b.y);
      }
    }
    b.kbx *= CFG.JUICE.knockbackDecay; b.kby *= CFG.JUICE.knockbackDecay;
    b.setVelocity(vx + b.kbx, vy + b.kby);
  }

  dropAcidPool(x, y, def) {
    const pool = this.add.image(x, y, 'acidpool').setDepth(1).setScale(def.poolRadius / 55);
    pool.dieAt = this.time.now + def.poolMs;
    pool.dps = def.poolDps;
    pool.radius = def.poolRadius;
    this.acidPools.add(pool);
  }

  /* ------------------------------------------------ turrets & defenses */
  placeBarricade() {
    const E = CFG.ECONOMY;
    const slot = this.barricades.countActive(true) % E.barricadeSlots;
    const x = 240 + slot * 240;
    const bar = this.barricades.create(x, E.barricadeY, 'barricade');
    bar.hp = E.barricadeHp;
  }
  placeTurret() {
    const E = CFG.ECONOMY;
    const sprite = this.add.image(this.player.x, this.player.y - 40, 'turret').setDepth(3);
    this.turrets.push({ sprite, wavesLeft: E.turretWaves + 1, lastShot: 0 });
  }
  updateTurrets(time) {
    const E = CFG.ECONOMY;
    for (const t of this.turrets) {
      if (time < t.lastShot + E.turretFireMs) continue;
      const target = this.nearestMob(t.sprite.x, t.sprite.y, E.turretRange) || (this.boss && Phaser.Math.Distance.Between(t.sprite.x, t.sprite.y, this.boss.x, this.boss.y) < E.turretRange ? this.boss : null);
      if (!target) continue;
      t.lastShot = time;
      const ang = Phaser.Math.Angle.Between(t.sprite.x, t.sprite.y, target.x, target.y);
      t.sprite.setRotation(ang + Math.PI / 2);
      const b = this.bullets.get(t.sprite.x, t.sprite.y, 'b_hornet');
      if (!b) continue;
      b.setActive(true).setVisible(true).setDepth(4).setRotation(ang).setScale(0.8);
      b.body.enable = true;
      this.physics.velocityFromRotation(ang, 700, b.body.velocity);
      b.dmg = E.turretDmg; b.pierce = 0; b.knock = 30; b.crit = false; b.critMult = 2;
      b.critExplode = null; b.aoe = 0; b.cluster = null; b.ricochet = 0;
      b.bornX = t.sprite.x; b.bornY = t.sprite.y; b.falloffStart = 0; b.rangePx = E.turretRange;
      b.hitSet = new Set(); b.born = time;
    }
  }
  nearestMob(x, y, range, except) {
    let best = null, bd = range;
    this.mobs.children.iterate((m) => {
      if (!m || !m.active || m === except || m.tunneling) return;
      const d = Phaser.Math.Distance.Between(x, y, m.x, m.y);
      if (d < bd) { bd = d; best = m; }
    });
    return best;
  }

  /* ------------------------------------------------ juice */
  shake(intensity, ms) { if (intensity > 0) this.cameras.main.shake(ms, intensity); }
  splatBlood(x, y) {
    for (let i = 0; i < CFG.JUICE.bloodPerKill; i++) {
      this.gore.draw('blood', x + U.rand(-16, 16) - 7, y + U.rand(-16, 16) - 7);
    }
  }
  ringFx(x, y, radius, color) { this.rings.push({ x, y, r: 8, max: radius, color, a: 0.9 }); }
  floatText(x, y, msg, color, big) {
    let t = this.floatPool.find(ft => !ft.active);
    if (!t) {
      if (this.floatPool.length >= CFG.GAME.maxFloatTexts) return;
      t = this.add.text(0, 0, '', { fontFamily: 'Courier New', fontSize: '14px', fontStyle: 'bold', stroke: '#000', strokeThickness: 3 }).setDepth(8);
      this.floatPool.push(t);
    }
    t.setActive(true).setVisible(true).setPosition(x, y).setText(String(msg)).setColor(color).setAlpha(1);
    t.setFontSize(big ? 17 : 13);
    this.tweens.add({ targets: t, y: y - 34, alpha: 0, duration: CFG.JUICE.floatTextRiseMs, onComplete: () => t.setActive(false).setVisible(false) });
  }

  gameOver() {
    if (Run.over) return;
    Run.over = true;
    this.gameState = 'over';
    UI.showGameOver();
  }

  /* ------------------------------------------------ update loop */
  update(time, delta) {
    if (Run.over || UI.paused) { if (UI.paused) this.physics.world.pause(); return; }
    if (this.physics.world.isPaused) this.physics.world.resume();
    const dt = delta / 1000;

    // player movement
    const k = this.keys;
    let mx = (k.A.isDown || k.LEFT.isDown ? -1 : 0) + (k.D.isDown || k.RIGHT.isDown ? 1 : 0);
    let my = (k.W.isDown || k.UP.isDown ? -1 : 0) + (k.S.isDown || k.DOWN.isDown ? 1 : 0);
    const spd = playerSpeed();
    if (mx || my) {
      const n = Math.hypot(mx, my);
      this.player.setVelocity(mx / n * spd, my / n * spd);
    } else {
      this.player.body.velocity.x *= 0.8; this.player.body.velocity.y *= 0.8;
    }
    const ptr = this.input.activePointer;
    this.player.setRotation(Phaser.Math.Angle.Between(this.player.x, this.player.y, ptr.worldX, ptr.worldY) + Math.PI / 2);

    if (this.gameState === 'wave') {
      this.handleFiring(time);
      this.director.update(time);
      this.updateMobs(time, dt);
      this.updateBoss(time, dt);
      this.updateTurrets(time);
    } else {
      this.beam.clear();
    }

    // necrotic halo
    if (Run.has('halo') && this.gameState === 'wave') {
      const h = CFG.MUTATIONS.halo;
      if (!this.lastHaloTick || time >= this.lastHaloTick + 300) {
        this.lastHaloTick = time;
        this.areaDamage(this.player.x, this.player.y, h.radius, h.dps * 0.3 * damageMul(this), 0);
      }
    }

    // acid pools hurt the player
    this.acidPools.children.iterate((p) => {
      if (!p) return;
      if (time >= p.dieAt) { p.destroy(); return; }
      if (Phaser.Math.Distance.Between(p.x, p.y, this.player.x, this.player.y) < p.radius) {
        if (!p.lastTick || time >= p.lastTick + 500) { p.lastTick = time; this.hurtPlayer(p.dps * 0.5, p.x, p.y); }
      }
    });

    // coin magnet + expiry
    this.coins.children.iterate((c) => {
      if (!c || !c.active) return;
      if (time >= c.dieAt) { c.setActive(false).setVisible(false); c.body.enable = false; return; }
      const d = Phaser.Math.Distance.Between(c.x, c.y, this.player.x, this.player.y);
      if (d < CFG.ECONOMY.coinMagnetPx) {
        const ang = Math.atan2(this.player.y - c.y, this.player.x - c.x);
        c.setVelocity(Math.cos(ang) * CFG.ECONOMY.coinSpeed, Math.sin(ang) * CFG.ECONOMY.coinSpeed);
      }
    });

    // parasites home in
    this.parasites.children.iterate((p) => {
      if (!p || !p.active) return;
      if (time >= p.dieAt) { p.setActive(false).setVisible(false); p.body.enable = false; return; }
      const target = this.nearestMob(p.x, p.y, 600) || this.boss;
      if (target) {
        const ang = Math.atan2(target.y - p.y, target.x - p.x);
        p.setVelocity(Math.cos(ang) * CFG.MUTATIONS.hiveHeart.parasiteSpeed, Math.sin(ang) * CFG.MUTATIONS.hiveHeart.parasiteSpeed);
      }
    });

    // bullet lifetime / bounds / range
    this.bullets.children.iterate((b) => {
      if (!b || !b.active) return;
      const off = b.x < -30 || b.x > CFG.GAME.width + 30 || b.y < -30 || b.y > CFG.GAME.height + 30;
      const ranged = b.rangePx && Phaser.Math.Distance.Between(b.bornX, b.bornY, b.x, b.y) > b.rangePx;
      if (off || ranged || time > b.born + 4000) this.recycleBullet(b);
    });
    this.enemyShots.children.iterate((s) => {
      if (!s || !s.active) return;
      if (time >= s.dieAt || s.y > CFG.GAME.height + 30 || s.y < -30 || s.x < -30 || s.x > CFG.GAME.width + 30) {
        s.setActive(false).setVisible(false); s.body.enable = false;
      }
    });

    // ring fx
    this.fxg.clear();
    this.rings = this.rings.filter(r => {
      r.r += (r.max - r.r) * 0.25 + 2; r.a *= 0.9;
      this.fxg.lineStyle(3, r.color, r.a).strokeCircle(r.x, r.y, r.r);
      return r.a > 0.05 && r.r < r.max * 1.05;
    });

    // boss HP bar (drawn in fxg space)
    if (this.boss && this.boss.active) {
      const b = this.boss;
      const w = 120;
      this.fxg.fillStyle(0x000000, 0.6).fillRect(b.x - w / 2, b.y - 56, w, 8);
      this.fxg.fillStyle(0xc0392b, 1).fillRect(b.x - w / 2, b.y - 56, w * U.clamp(b.hp / b.maxHp, 0, 1), 8);
    }
  }
}

/* ============================================================ UI (DOM)
   HUD, shop, mutation picks, boss modals, pause, game over. */
const UI = {
  scene: null, paused: false, qmTimer: null,

  bind(scene) {
    this.scene = scene;
    // static text from FLAVOR
    D('start-title').textContent = FLAVOR.TITLE;
    D('start-sub').textContent = FLAVOR.SUBTITLE;
    D('start-controls').innerHTML = FLAVOR.CONTROLS.join('<br>');
    D('btn-start').textContent = FLAVOR.START_BUTTON;
    D('shop-title').textContent = FLAVOR.SHOP.title;
    D('btn-next-wave').textContent = FLAVOR.SHOP.nextWave;
    D('mutate-title').textContent = FLAVOR.BOSS_MODALS.pickPrompt;
    D('pause-title').textContent = FLAVOR.PAUSE.title;
    D('pause-body').textContent = FLAVOR.PAUSE.body;
    D('btn-resume').textContent = FLAVOR.PAUSE.resume;
    D('btn-restart').textContent = FLAVOR.GAMEOVER.restart;
    D('hp-label').textContent = 'HP';
    D('wave-label').textContent = FLAVOR.HUD.wave;
    D('gold-label').textContent = FLAVOR.HUD.gold;
    D('kills-label').textContent = FLAVOR.HUD.kills;

    D('btn-start').onclick = () => {
      Sfx.init(); Sfx.play('uiClick');
      D('ov-start').classList.remove('show');
      D('hud').style.display = 'block';
      scene.beginNextWave();
    };
    D('btn-resume').onclick = () => this.togglePause();
    D('btn-restart').onclick = () => {
      Sfx.play('uiClick');
      window.location.reload();
    };
    D('btn-next-wave').onclick = () => {
      Sfx.play('uiClick');
      D('ov-shop').classList.remove('show');
      scene.beginNextWave();
    };
    D('btn-boss-continue').onclick = () => {
      Sfx.play('uiClick');
      D('ov-boss').classList.remove('show');
      this.showMutationPick();
    };
    this.refreshHud(scene);
  },

  anyOverlay() {
    return ['ov-start', 'ov-boss', 'ov-mutate', 'ov-shop', 'ov-pause', 'ov-gameover']
      .some(id => D(id).classList.contains('show'));
  },

  togglePause() {
    if (Run.over || this.anyOverlay() && !this.paused) return;
    this.paused = !this.paused;
    D('ov-pause').classList.toggle('show', this.paused);
  },

  banner(text, isBoss) {
    const b = D('banner');
    b.textContent = text;
    b.classList.toggle('boss', !!isBoss);
    b.style.opacity = 1;
    clearTimeout(this.bannerT);
    this.bannerT = setTimeout(() => { b.style.opacity = 0; }, 1700);
  },
  toast(text) { this.qmSay(text); },
  qmSay(text) {
    const el = D('qm-line');
    el.textContent = FLAVOR.QM.name + ': "' + text + '"';
    el.style.opacity = 1;
    clearTimeout(this.qmTimer);
    this.qmTimer = setTimeout(() => { el.style.opacity = 0; }, 4200);
  },

  refreshHud(scene) {
    if (!Run) return;
    const maxHp = playerMaxHp();
    D('hp-fill').style.width = U.clamp(scene.playerHp / maxHp * 100, 0, 100) + '%';
    D('hp-label').textContent = 'HP ' + Math.max(0, Math.ceil(scene.playerHp)) + '/' + maxHp;
    D('wave-val').textContent = Run.wave;
    D('gold-val').textContent = Run.gold;
    D('kills-val').textContent = Run.kills;
    D('armor-stat').textContent = Run.armor ? FLAVOR.HUD.armor + ' ' + Run.armor : '';
    D('grenade-stat').textContent = FLAVOR.HUD.grenades + ' ' + Run.grenades;
    // mutation tray
    const tray = D('mut-tray');
    tray.innerHTML = '';
    for (const id of Run.mutations) {
      const chip = document.createElement('div');
      chip.className = 'mut-chip';
      chip.title = FLAVOR.MUTATIONS[id].name;
      chip.innerHTML = MUT_ICONS[id] || '';
      tray.appendChild(chip);
    }
    this.refreshAmmo(scene);
  },
  refreshAmmo(scene) {
    const ws = scene.activeWeapon();
    const stats = computeWeapon(ws);
    const fw = FLAVOR.WEAPONS[ws.id];
    D('weapon-name').textContent = ws.evolved ? fw.evolvedName : fw.name;
    if (stats.archetype === 'laser') {
      D('heat-bar').style.display = 'block';
      document.querySelector('#ammo-fill').parentElement.style.display = 'none';
      D('heat-fill').style.width = U.clamp(ws.heat, 0, 100) + '%';
      D('weapon-sub').textContent = ws.venting ? FLAVOR.HUD.venting : FLAVOR.HUD.heat + ' ' + Math.round(ws.heat) + '%';
    } else {
      D('heat-bar').style.display = 'none';
      document.querySelector('#ammo-fill').parentElement.style.display = 'block';
      D('ammo-fill').style.width = U.clamp(ws.ammo / stats.magSize * 100, 0, 100) + '%';
      D('weapon-sub').textContent = ws.reloading ? FLAVOR.HUD.reloading : ws.ammo + ' / ' + stats.magSize;
    }
  },

  /* ---------------- boss modal & mutations ---------------- */
  showBossModal(bossId) {
    const modal = FLAVOR.BOSS_MODALS[bossId] && Run.wave <= 10 ? FLAVOR.BOSS_MODALS[bossId] : (FLAVOR.BOSS_MODALS[bossId] || FLAVOR.BOSS_MODALS.generic);
    const m = Run.wave <= 10 ? FLAVOR.BOSS_MODALS[bossId] : FLAVOR.BOSS_MODALS.generic;
    D('boss-title').textContent = m.title;
    D('boss-body').textContent = m.body;
    D('boss-qm').textContent = FLAVOR.BOSS_MODALS.qmReact[Run.mutationStage()];
    D('btn-boss-continue').textContent = FLAVOR.BOSS_MODALS.pickPrompt;
    D('ov-boss').classList.add('show');
  },

  showMutationPick() {
    Sfx.play('mutation');
    const tier = this.scene.lastBossTier || 1;
    // pool: current tier and below, not already owned
    const pool = Object.keys(CFG.MUTATIONS).filter(id => CFG.MUTATIONS[id].tier <= tier && !Run.has(id));
    Phaser.Utils.Array.Shuffle(pool);
    const picks = pool.slice(0, 3);
    const cashIdx = Math.random() < CFG.MUTATION_CASH_CHANCE && picks.length > 1 ? U.irand(0, picks.length - 1) : -1;
    const wrap = D('mut-cards');
    wrap.innerHTML = '';
    if (picks.length === 0) { // everything owned: cash fallback
      picks.push(null);
    }
    picks.forEach((id, i) => {
      const card = document.createElement('div');
      const isCash = i === cashIdx || id === null;
      card.className = 'mut-card' + (isCash ? ' cash' : '');
      if (isCash) {
        const amt = CFG.MUTATION_CASH_AMOUNT[tier] || 200;
        card.innerHTML = MUT_ICONS.cash +
          '<div class="tier">HAZARD PAY</div>' +
          '<div class="mname">' + FLAVOR.MUTATIONS.cashName + ' — ' + amt + 'g</div>' +
          '<div class="mdesc">' + FLAVOR.MUTATIONS.cashDesc + '</div>' +
          '<div class="mflavor">' + FLAVOR.MUTATIONS.cashFlavor + '</div>';
        card.onclick = () => {
          Sfx.play('coin');
          Run.gold += amt; Run.goldEarned += amt;
          this.afterMutationPick();
        };
      } else {
        const mf = FLAVOR.MUTATIONS[id];
        card.innerHTML = (MUT_ICONS[id] || '') +
          '<div class="tier">TIER ' + CFG.MUTATIONS[id].tier + ' MUTATION</div>' +
          '<div class="mname">' + mf.name + '</div>' +
          '<div class="mdesc">' + mf.desc + '</div>' +
          '<div class="mflavor">' + mf.flavor + '</div>';
        card.onclick = () => {
          Sfx.play('mutation');
          Run.mutations.push(id);
          if (id === 'chitin') this.scene.healPlayer(CFG.MUTATIONS.chitin.maxHpAdd);
          this.afterMutationPick();
        };
      }
      wrap.appendChild(card);
    });
    D('ov-mutate').classList.add('show');
  },
  afterMutationPick() {
    D('ov-mutate').classList.remove('show');
    this.refreshHud(this.scene);
    this.openShop();
  },

  /* ---------------- shop ---------------- */
  openShop() {
    Sfx.play('uiClick');
    D('shop-qm').textContent = FLAVOR.QM.name + ': "' + U.choose(FLAVOR.QM.shop[Run.mutationStage()]) + '"';
    this.renderShop();
    D('ov-shop').classList.add('show');
  },
  renderShop() {
    D('shop-gold').innerHTML = FLAVOR.HUD.gold + ': <span class="cost">' + Run.gold + '</span>';
    const wWrap = D('shop-weapons');
    wWrap.innerHTML = '';
    wWrap.appendChild(this.weaponBlock('primary'));
    if (Run.weapons.secondary) wWrap.appendChild(this.weaponBlock('secondary'));
    else wWrap.appendChild(this.secondaryLocker());
    // consumables / defenses
    const items = D('shop-items');
    items.innerHTML = '';
    const E = CFG.ECONOMY;
    const armorCost = Math.round(E.armorCostBase * Math.pow(E.armorCostGrowth, Run.armorBought));
    items.appendChild(this.shopItem(FLAVOR.SHOP.armor + ' (' + Run.armor + '/' + CFG.PLAYER.armorMax + ')', FLAVOR.SHOP.armorDesc, armorCost,
      Run.armor >= CFG.PLAYER.armorMax, () => { Run.armor++; Run.armorBought++; }));
    items.appendChild(this.shopItem(FLAVOR.SHOP.grenade + ' (' + Run.grenades + '/' + CFG.PLAYER.grenadeMax + ')', FLAVOR.SHOP.grenadeDesc, E.grenadeCost,
      Run.grenades >= CFG.PLAYER.grenadeMax, () => { Run.grenades++; }));
    const fullHp = this.scene.playerHp >= playerMaxHp();
    items.appendChild(this.shopItem(FLAVOR.SHOP.heal, FLAVOR.SHOP.healDesc, E.healCost, fullHp, () => this.scene.healPlayer(E.healAmt)));
    const defLocked = Run.wave < E.defensesUnlockWave;
    items.appendChild(this.shopItem(FLAVOR.SHOP.barricade, defLocked ? FLAVOR.SHOP.defensesLocked : FLAVOR.SHOP.barricadeDesc, E.barricadeCost, defLocked, () => this.scene.placeBarricade()));
    items.appendChild(this.shopItem(FLAVOR.SHOP.turret, defLocked ? FLAVOR.SHOP.defensesLocked : FLAVOR.SHOP.turretDesc, E.turretCost, defLocked, () => this.scene.placeTurret()));
  },
  shopItem(name, desc, cost, disabled, fn) {
    const el = document.createElement('div');
    el.className = 'shop-item';
    const btn = document.createElement('button');
    btn.innerHTML = '<span class="cost">' + cost + 'g</span>';
    btn.disabled = disabled || Run.gold < cost;
    btn.onclick = () => { if (Run.gold < cost) return; Run.gold -= cost; Sfx.play('coin'); fn(); this.renderShop(); this.refreshHud(this.scene); };
    const head = document.createElement('div');
    head.className = 'si-head';
    head.innerHTML = '<span class="si-name">' + name + '</span>';
    head.appendChild(btn);
    el.appendChild(head);
    const d = document.createElement('div');
    d.className = 'si-desc'; d.textContent = desc;
    el.appendChild(d);
    return el;
  },
  weaponBlock(slot) {
    const ws = Run.weapons[slot];
    const base = CFG.WEAPONS[ws.id];
    const fw = FLAVOR.WEAPONS[ws.id];
    const blk = document.createElement('div');
    blk.className = 'weapon-block';
    const h = document.createElement('h3');
    h.textContent = (slot === 'primary' ? 'PRIMARY — ' : 'SECONDARY — ') + (ws.evolved ? fw.evolvedName : fw.name);
    blk.appendChild(h);
    if (ws.evolved) {
      const d = document.createElement('div');
      d.className = 'si-desc'; d.textContent = fw.evolvedDesc;
      blk.appendChild(d);
    }
    for (const tk of ['dmg', 'handling', 'special']) {
      const lv = ws.levels[tk];
      const row = document.createElement('div');
      row.className = 'track-row';
      const pips = '◆'.repeat(lv) + '◇'.repeat(5 - lv);
      row.innerHTML = '<span class="t-name">' + FLAVOR.TRACKS[tk] + '</span>' +
        '<span class="lv-pips">' + pips + '</span>' +
        '<span class="si-desc" style="flex:1">' + FLAVOR.TRACK_DESC[ws.id][tk] + '</span>';
      const btn = document.createElement('button');
      if (lv >= 5) { btn.textContent = FLAVOR.SHOP.maxed; btn.disabled = true; }
      else {
        const cost = CFG.UPGRADE_COSTS[lv];
        btn.innerHTML = '<span class="cost">' + cost + 'g</span>';
        btn.disabled = Run.gold < cost;
        btn.onclick = () => { Run.gold -= cost; Sfx.play('coin'); ws.levels[tk]++; this.renderShop(); this.refreshHud(this.scene); };
      }
      row.appendChild(btn);
      blk.appendChild(row);
    }
    // evolve
    if (!ws.evolved) {
      const total = ws.levels.dmg + ws.levels.handling + ws.levels.special;
      const row = document.createElement('div');
      row.className = 'track-row';
      const ready = total >= 15;
      row.innerHTML = '<span class="t-name" style="color:var(--blood)">' + FLAVOR.SHOP.evolve + '</span>' +
        '<span class="si-desc" style="flex:1">' + (ready ? fw.evolvedName + ' — ' + fw.evolvedDesc : FLAVOR.SHOP.evolveLocked) + '</span>';
      const btn = document.createElement('button');
      btn.className = 'primary';
      btn.innerHTML = '<span class="cost">' + CFG.EVOLUTION_COST + 'g</span>';
      btn.disabled = !ready || Run.gold < CFG.EVOLUTION_COST;
      btn.onclick = () => {
        Run.gold -= CFG.EVOLUTION_COST; Sfx.play('mutation');
        ws.evolved = true;
        const stats = computeWeapon(ws);
        if (stats.magSize) ws.ammo = stats.magSize;
        this.renderShop(); this.refreshHud(this.scene);
      };
      row.appendChild(btn);
      blk.appendChild(row);
    }
    return blk;
  },
  secondaryLocker() {
    const blk = document.createElement('div');
    blk.className = 'weapon-block';
    const h = document.createElement('h3');
    h.textContent = FLAVOR.SHOP.buySecondary;
    blk.appendChild(h);
    const d = document.createElement('div');
    d.className = 'si-desc'; d.textContent = FLAVOR.SHOP.secondaryHint;
    blk.appendChild(d);
    for (const id of Object.keys(CFG.WEAPONS)) {
      if (id === Run.weapons.primary.id) continue;
      const row = document.createElement('div');
      row.className = 'track-row';
      row.innerHTML = '<span class="t-name">' + FLAVOR.WEAPONS[id].name + '</span>' +
        '<span class="si-desc" style="flex:1">' + FLAVOR.WEAPONS[id].desc + '</span>';
      const btn = document.createElement('button');
      btn.innerHTML = '<span class="cost">' + CFG.SECONDARY_COST + 'g</span>';
      btn.disabled = Run.gold < CFG.SECONDARY_COST;
      btn.onclick = () => {
        Run.gold -= CFG.SECONDARY_COST; Sfx.play('coin');
        Run.weapons.secondary = makeWeaponState(id);
        this.renderShop(); this.refreshHud(this.scene);
      };
      row.appendChild(btn);
      blk.appendChild(row);
    }
    return blk;
  },

  /* ---------------- game over ---------------- */
  showGameOver() {
    const mutated = Run.mutations.length >= 5;
    D('go-title').textContent = mutated ? FLAVOR.GAMEOVER.titleMutated : FLAVOR.GAMEOVER.title;
    const G = FLAVOR.GAMEOVER;
    D('go-stats').innerHTML =
      G.statsWave + '<span>' + Math.max(0, Run.wave - 1) + '</span><br>' +
      G.statsKills + '<span>' + Run.kills + '</span><br>' +
      G.statsGold + '<span>' + Run.goldEarned + '</span><br>' +
      G.statsMutations + '<span>' + Run.mutations.length + '</span>';
    D('go-epitaph').textContent = U.choose(mutated ? G.epitaphsMutated : G.epitaphs);
    D('ov-gameover').classList.add('show');
  }
};

/* ============================================================ BOOT */
Run = newRun();
const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game-container',
  width: CFG.GAME.width,
  height: CFG.GAME.height,
  backgroundColor: CFG.GAME.bgColor,
  physics: { default: 'arcade', arcade: { debug: false } },
  scene: [GameScene]
});
