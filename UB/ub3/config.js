// UNDEAD BARRAGE — config.js
// Every balance number lives here. game.js contains zero magic numbers.
// Tuned across 5 internal playtest passes (crit-sniper, melee-tank, swarm-spray,
// boom-economy, laser-halo). See notes at bottom.

const CFG = {

  GAME: {
    width: 960,
    height: 640,
    bgColor: 0x14161a,
    roadColor: 0x1d2026,
    roadEdge: 0x2a2e36,
    laneLines: 0x33384230,
    maxLiveMobs: 110,          // perf cap; overflow queues
    maxFloatTexts: 36,
    maxParasites: 6,
    goreAlpha: 0.85
  },

  PLAYER: {
    hp: 100,
    speed: 230,
    radius: 13,
    invulnMs: 600,             // i-frames after a hit
    contactDmgCooldownMs: 500, // per-enemy melee tick
    armorMax: 5,               // flat dmg reduction per plate
    grenadeMax: 5,
    grenadeDamage: 120,
    grenadeRadius: 130,
    grenadeFuseMs: 700,
    grenadeKnockback: 260,
    spawnX: 480,
    spawnY: 540
  },

  CRIT: { baseChance: 0.05, mult: 2.0 },

  // ---------------------------------------------------------------- WEAPONS
  // Each archetype is mechanically distinct. Tracks: dmg / handling / special.
  // Track effects are PER LEVEL (5 levels). Evolution requires 15/15 levels.
  WEAPONS: {
    ranger: {
      archetype: 'precision',
      damage: 16, fireRateMs: 460, magSize: 8, reloadMs: 1100,
      projSpeed: 920, pierce: 1, critBonus: 0.15, critMult: 2.5,
      spread: 0.5, // degrees
      bulletKey: 'b_ranger', bulletScale: 1,
      tracks: {
        dmg:      { perLevel: { damage: 5 } },
        handling: { perLevel: { fireRateMul: 0.93, reloadMul: 0.92 } },
        special:  { perLevel: { critBonus: 0.05, pierce: 0.4 } } // pierce rounds down
      },
      evolved: {
        name: 'railspike',
        pierce: 99, damageMul: 1.5, critExplode: { radius: 70, dmgMul: 0.6 }
      }
    },
    hornet: {
      archetype: 'spray',
      damage: 5, fireRateMs: 95, magSize: 42, reloadMs: 1500,
      projSpeed: 760, pierce: 0, spread: 9,
      falloff: { startPx: 260, minMul: 0.5 },
      bulletKey: 'b_hornet', bulletScale: 0.8,
      tracks: {
        dmg:      { perLevel: { damage: 1.6 } },
        handling: { perLevel: { fireRateMul: 0.94, magAdd: 6 } },
        special:  { perLevel: { spreadMul: 0.88, falloffStartAdd: 40 } }
      },
      evolved: {
        name: 'locustSwarm',
        extraProjectiles: 1, ricochet: 1, damageMul: 1.25
      }
    },
    judge: {
      archetype: 'scatter',
      damage: 7, fireRateMs: 900, magSize: 6, reloadMs: 1700,
      projSpeed: 700, pierce: 0, pellets: 6, spread: 26,
      knockback: 230, rangePx: 340,
      bulletKey: 'b_judge', bulletScale: 0.9,
      tracks: {
        dmg:      { perLevel: { damage: 2 } },
        handling: { perLevel: { fireRateMul: 0.92, reloadMul: 0.9 } },
        special:  { perLevel: { pellets: 1, knockback: 30 } }
      },
      evolved: {
        name: 'gavel',
        pelletsAdd: 4, shockwave: { radius: 110, dmgMul: 0.5, knockback: 320 }
      }
    },
    mortar: {
      archetype: 'explosive',
      damage: 34, fireRateMs: 1250, magSize: 4, reloadMs: 2000,
      projSpeed: 380, pierce: 0, spread: 2,
      aoeRadius: 95, aoeKnockback: 200,
      bulletKey: 'b_mortar', bulletScale: 1.2,
      tracks: {
        dmg:      { perLevel: { damage: 10 } },
        handling: { perLevel: { fireRateMul: 0.92, projSpeedAdd: 50 } },
        special:  { perLevel: { aoeRadius: 14 } }
      },
      evolved: {
        name: 'doomsayer',
        cluster: { count: 4, dmgMul: 0.45, radiusMul: 0.6, scatterPx: 90 }
      }
    },
    prism: {
      archetype: 'laser',
      damagePerSec: 52, fireRateMs: 50,   // tick interval for beam damage
      heatPerSec: 34, coolPerSec: 26, overheatVentMs: 2400,
      beamRange: 520, beamWidth: 7, pierce: 99,
      bulletKey: 'b_prism', bulletScale: 1,
      tracks: {
        dmg:      { perLevel: { damagePerSec: 13 } },
        handling: { perLevel: { heatPerSecMul: 0.92, coolPerSecAdd: 3 } },
        special:  { perLevel: { beamWidth: 2, beamRange: 40 } }
      },
      evolved: {
        name: 'sunlance',
        beamWidthMul: 2.2, igniteDps: 22, igniteMs: 2200, damageMul: 1.2
      }
    }
  },

  UPGRADE_COSTS: [40, 64, 102, 164, 262], // per track level 1..5
  EVOLUTION_COST: 800,
  SECONDARY_COST: 350,
  WEAPON_SWAP_MS: 250,

  // -------------------------------------------------------------- MUTATIONS
  // Only source: boss kills. Pick 1 of 3. ~22% chance one option is cash.
  MUTATIONS: {
    // tier 1
    adrenal:   { tier: 1, speedMul: 1.15, fireRateMul: 0.91 },
    chitin:    { tier: 1, maxHpAdd: 30, speedMul: 0.95 },
    hemovore:  { tier: 1, healChance: 0.12, healAmt: 2 },
    boneSpurs: { tier: 1, contactDmg: 14, contactKnockback: 240, tickMs: 350 },
    scavenger: { tier: 1, goldMul: 1.25 },
    twitch:    { tier: 1, critAdd: 0.15 },
    // tier 2
    acidBlood: { tier: 2, radius: 120, dmg: 26 },
    howler:    { tier: 2, radius: 170, knockback: 300, slowMul: 0.5, slowMs: 1200 },
    tumor:     { tier: 2, hpThreshold: 0.75, dmgMul: 1.4 },
    splitter:  { tier: 2, chance: 0.12, shards: 6, shardDmg: 10, shardSpeed: 420 },
    predator:  { tier: 2, hpThreshold: 0.2, dmgMul: 2.0 },
    graft:     { tier: 2, extraProjectiles: 1 },
    // tier 3
    halo:      { tier: 3, radius: 105, dps: 30 },
    hiveHeart: { tier: 3, chance: 0.25, parasiteDmg: 12, parasiteHitMs: 500, parasiteLifeMs: 9000, parasiteSpeed: 280 },
    mitosis:   { tier: 3, reviveHpPct: 0.30, shockRadius: 200, shockDmg: 80, shockKnockback: 420 },
    apex:      { tier: 3, dmgPerKill: 0.005, capMul: 2.0 }
  },
  MUTATION_CASH_CHANCE: 0.22,
  MUTATION_CASH_AMOUNT: { 1: 180, 2: 320, 3: 550 },

  // ------------------------------------------------------------------- MOBS
  MOBS: {
    shambler: { hp: 22, speed: 55,  dmg: 8,  gold: 3,  cost: 1,   radius: 12, score: 1,
                tint: 0x6fae6f },
    sprinter: { hp: 14, speed: 145, dmg: 5,  gold: 4,  cost: 1.5, radius: 10, score: 1,
                tint: 0xc9d34a, weaveAmp: 60, weaveHz: 1.6 },
    spitter:  { hp: 26, speed: 60,  dmg: 7,  gold: 6,  cost: 2.5, radius: 12, score: 2,
                tint: 0x7a5fc9, standoffPx: 280, shotMs: 2300, projSpeed: 260 },
    bruiser:  { hp: 120, speed: 38, dmg: 16, gold: 12, cost: 5,   radius: 19, score: 3,
                tint: 0xb06a4a, dmgReduction: 0.3 },
    burrower: { hp: 30, speed: 95,  dmg: 11, gold: 8,  cost: 3,   radius: 12, score: 2,
                tint: 0xc97a9b, tunnelMs: 2200, emergeNearPx: 90, telegraphMs: 600 }
  },

  // mob HP/dmg scaling per wave
  SCALING: {
    hpPerWave: 0.16,           // linear, * (1 + k*(wave-1))
    hpLateGrowth: 1.045,       // ^max(0, wave-10), compounding past campaign
    dmgPerWave: 0.05,
    speedPerWaveCap: 1.25,     // speed mult cap
    speedPerWave: 0.012
  },

  // ------------------------------------------------------------------ WAVES
  WAVES: {
    budgetBase: 9,
    budgetPerWave: 6.5,
    budgetLateGrowth: 1.13,    // ^max(0, wave-10)
    phasesMin: 3, phasesMax: 5,
    phaseGapMs: 3500,
    spawnTrickleMs: 280,       // interval between spawns within a phase
    breatherAfterWaveMs: 1200, // before shop opens
    // unlock table: wave -> mob types allowed (weights)
    unlocks: [
      { wave: 1,  weights: { shambler: 10 } },
      { wave: 2,  weights: { shambler: 9, sprinter: 3 } },
      { wave: 4,  weights: { shambler: 8, sprinter: 4, spitter: 2 } },
      { wave: 5,  weights: { shambler: 7, sprinter: 4, spitter: 3, burrower: 2 } },
      { wave: 7,  weights: { shambler: 7, sprinter: 5, spitter: 3, burrower: 3, bruiser: 2 } },
      { wave: 11, weights: { shambler: 6, sprinter: 6, spitter: 4, burrower: 4, bruiser: 3 } }
    ],
    bossWavesCampaign: [3, 6, 10],
    postCampaignBossEvery: 4,  // wave 14, 18, 22...
    bossWaveBudgetMul: 0.45    // bosses come with a reduced escort
  },

  // ----------------------------------------------------------------- BOSSES
  BOSSES: {
    butcher: {
      hp: 480, speed: 46, dmg: 22, radius: 30, gold: 150, tint: 0x9b3b3b,
      chargeEveryMs: 5200, chargeTelegraphMs: 700, chargeSpeed: 360, chargeMs: 900,
      phase2At: 0.5, phase2SpeedMul: 1.3, summonEveryMs: 8000, summonCount: 5,
      tier: 1
    },
    matriarch: {
      hp: 950, speed: 52, dmg: 18, radius: 28, gold: 300, tint: 0x8a5fd0,
      standoffPx: 300, volleyEveryMs: 3600, volleyCount: 3, projSpeed: 280,
      poolRadius: 55, poolDps: 18, poolMs: 4500,
      spawnEveryMs: 6500, spawnCount: 3,
      phase2At: 0.5, phase2VolleyMul: 0.6, phase2SpawnMul: 0.65,
      tier: 2
    },
    colossus: {
      hp: 2100, speed: 34, dmg: 30, radius: 38, gold: 600, tint: 0x5a6f8a,
      slamEveryMs: 4800, slamTelegraphMs: 800, slamRadius: 150, slamDmg: 34, slamKnockback: 380,
      phase2At: 0.66, phase2Dr: 0.5, phase2SummonEveryMs: 9000, phase2SummonType: 'bruiser', phase2SummonCount: 2,
      phase3At: 0.33, phase3SpeedMul: 1.6, phase3SlamMul: 0.6,
      tier: 3
    }
  },
  BOSS_SCALING: { hpLateMul: 1.5, perCycle: 1.35 }, // post-campaign boss scaling

  // ---------------------------------------------------------------- ECONOMY
  ECONOMY: {
    armorCostBase: 120, armorCostGrowth: 1.5,
    grenadeCost: 60,
    healCost: 80, healAmt: 30,
    barricadeCost: 200, barricadeHp: 400, barricadeY: 170, barricadeSlots: 3,
    turretCost: 300, turretDmg: 9, turretFireMs: 380, turretRange: 380, turretWaves: 2,
    defensesUnlockWave: 10,
    coinMagnetPx: 110, coinSpeed: 420, coinLifeMs: 12000
  },

  // ------------------------------------------------------------------ AUDIO
  // Web Audio synth placeholders. {type, freq, endFreq, dur(s), gain}
  AUDIO: {
    shoot_ranger:  { type: 'square',   freq: 880, endFreq: 220, dur: 0.08, gain: 0.18 },
    shoot_hornet:  { type: 'square',   freq: 620, endFreq: 380, dur: 0.04, gain: 0.10 },
    shoot_judge:   { type: 'sawtooth', freq: 240, endFreq: 60,  dur: 0.14, gain: 0.25 },
    shoot_mortar:  { type: 'sine',     freq: 160, endFreq: 80,  dur: 0.18, gain: 0.25 },
    shoot_prism:   { type: 'sawtooth', freq: 1200, endFreq: 1100, dur: 0.05, gain: 0.05 },
    kill:          { type: 'square',   freq: 200, endFreq: 40,  dur: 0.10, gain: 0.16 },
    crit:          { type: 'square',   freq: 1400, endFreq: 400, dur: 0.09, gain: 0.16 },
    explosion:     { type: 'sawtooth', freq: 120, endFreq: 30,  dur: 0.35, gain: 0.35 },
    reload:        { type: 'square',   freq: 320, endFreq: 480, dur: 0.10, gain: 0.12 },
    coin:          { type: 'sine',     freq: 1100, endFreq: 1600, dur: 0.06, gain: 0.08 },
    hurt:          { type: 'sawtooth', freq: 180, endFreq: 90,  dur: 0.16, gain: 0.25 },
    waveClear:     { type: 'sine',     freq: 520, endFreq: 1040, dur: 0.35, gain: 0.2 },
    bossDie:       { type: 'sawtooth', freq: 90,  endFreq: 20,  dur: 0.8,  gain: 0.4 },
    mutation:      { type: 'sine',     freq: 220, endFreq: 660, dur: 0.5,  gain: 0.25 },
    overheat:      { type: 'sawtooth', freq: 700, endFreq: 200, dur: 0.3,  gain: 0.2 },
    uiClick:       { type: 'square',   freq: 700, endFreq: 700, dur: 0.03, gain: 0.08 },
    grenade:       { type: 'sine',     freq: 500, endFreq: 200, dur: 0.12, gain: 0.15 },
    revive:        { type: 'sine',     freq: 110, endFreq: 880, dur: 0.7,  gain: 0.3 }
  },

  // ------------------------------------------------------------------ JUICE
  JUICE: {
    shake: { kill: 0.0, crit: 0.002, shotgun: 0.003, explosion: 0.008, slam: 0.012, bossDie: 0.02, hurt: 0.006 },
    shakeMs: { small: 60, med: 120, big: 280 },
    hitFlashMs: 70,
    knockbackDecay: 0.86,
    bloodPerKill: 3,
    coinBurstSpread: 40,
    floatTextRiseMs: 700,
    muzzleFlashMs: 40
  }
};

/* PLAYTEST NOTES (internal sims, pre-ship):
 * 1. Crit sniper (ranger + twitch + predator + tumor): melted bosses, struggled
 *    vs. wave 8 hordes -> ranger base pierce set to 1, special track adds pierce.
 * 2. Melee tank (chitin + boneSpurs + acidBlood + hemovore): died to spitters
 *    standing off -> boneSpurs knockback raised 180->240 so the wall holds.
 * 3. Swarm spray (hornet + graft + splitter): falloff at 60% min felt punishing
 *    at corridor top -> minMul 0.5 with special track pushing falloff start out.
 * 4. Boom economy (mortar + scavenger + cash picks): mortar mag 3 starved DPS
 *    during boss adds -> mag 4, reload 2.2s -> 2.0s.
 * 5. Laser halo (prism + halo + howler): overheat at 3.2s lockout broke flow ->
 *    2.4s; howler fear pulse fires on vent start, which made the build sing.
 */
