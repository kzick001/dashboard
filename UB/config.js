// ==========================================
// UNDEAD BARRAGE V16.7.2 - GLOBAL CONFIGURATION
// ==========================================
export const GameConfig = {
    
    // 1. DIRECTOR & PACING
    director: {
        budgetBase: 15,
        budgetScaling: 1.15, // Exponential Budget = 15 * (1.15 ^ Wave)
        spawnPauseMin: 1500,
        spawnPauseMax: 3500,
        burstClumpMin: 3,
        burstClumpMax: 12,
        burstDelay: 150,
        supplyDropMin: 45000,
        supplyDropMax: 60000,
        crateHealthChance: 30,
        crateBombChance: 50,
        crateEnergyChance: 20
    },

    // 2. THE ECONOMY (PRICES)
    economy: {
        baseBuyInCosts: {
            0: 0,       // Pistol
            2: 500,     // Shotgun
            4: 800,     // Uzi
            6: 2000,    // AK-47
            9: 5000,    // LMG
            12: 8000    // Grenade Launcher
        },
        chassisConversionCosts: {
            1: 3500,    // Revolver
            3: 5000,    // Sawed-Off
            5: 6000,    // Dual Uzi
            7: 15000,   // M4 Carbine
            8: 30000,   // M7 Carbine
            10: 25000,  // Minigun
            11: 50000,  // Eradicator
            13: 35000,  // Plasma Cannon
            14: 60000   // Arc Welder
        },
        upgradeBaseCosts: {
            grenadeDmg: 500,
            speed: 400,
            turret: 1500
        },
        supplyCosts: {
            grenade: 100,
            armor: 150,
            buildBarricade: 300,
            repairBarricade: 100
        }
    },

    // 3. THE GUNSMITH (WEAPONS, AUDIO & FEEDBACK)
    // 15 Distinct Chassis Evolutions to support "Mastery over Replacement"
    weapons: [
        { // 0: Pistol
            name: "Pistol", archetype: "precision", shape: "slug", pattern: "uniform", evolvesTo: 1, baseUpgradeCost: 150, iconId: 0,
            damage: 25, splashRadius: 0, critChance: 20, critMult: 2.0, speed: 1000, range: 2000, rate: 400, spread: 2, multi: 1, knockback: 5, pierce: false, bloom: false,
            magSize: 12, reloadTime: 1200, audioKey: "sfx_pistol", audioVol: 0.5, pitchVariance: 0.1, camShake: 0.002, recoilPush: 0
        },
        { // 1: Revolver
            name: "Revolver", archetype: "precision", shape: "tracer", pattern: "uniform", baseUpgradeCost: 400, iconId: 0,
            damage: 75, splashRadius: 0, critChance: 20, critMult: 3.0, speed: 1500, range: 2000, rate: 500, spread: 2, multi: 1, knockback: 50, pierce: true, bloom: false,
            magSize: 6, reloadTime: 2500, audioKey: "sfx_pistol", audioVol: 0.8, pitchVariance: -0.2, camShake: 0.008, recoilPush: 5
        },
        { // 2: Shotgun
            name: "Shotgun", archetype: "scatter", shape: "pellet", pattern: "random", evolvesTo: 3, baseUpgradeCost: 250, iconId: 2,
            damage: 15, splashRadius: 0, critChance: 5, critMult: 3.0, speed: 1700, range: 400, rate: 700, spread: 8, multi: 8, knockback: 20, pierce: false, bloom: false,
            magSize: 12, reloadTime: 2000, audioKey: "sfx_shotgun", audioVol: 0.7, pitchVariance: 0.1, camShake: 0.015, recoilPush: 10
        },
        { // 3: Sawed-Off
            name: "Sawed-Off", archetype: "scatter", shape: "pellet", pattern: "random", baseUpgradeCost: 750, iconId: 2,
            damage: 25, splashRadius: 0, critChance: 5, critMult: 3.0, speed: 1600, range: 300, rate: 600, spread: 15, multi: 12, knockback: 35, pierce: false, bloom: false,
            magSize: 8, reloadTime: 2200, audioKey: "sfx_shotgun", audioVol: 0.9, pitchVariance: -0.1, camShake: 0.020, recoilPush: 20
        },
        { // 4: Uzi
            name: "Uzi", archetype: "auto", shape: "pellet", pattern: "uniform", evolvesTo: 5, baseUpgradeCost: 500, iconId: 1,
            damage: 20, splashRadius: 0, critChance: 5, critMult: 2.0, speed: 1200, range: 2000, rate: 75, spread: 5, multi: 1, knockback: 5, pierce: false, bloom: false,
            magSize: 50, reloadTime: 1200, audioKey: "sfx_smg", audioVol: 0.4, pitchVariance: 0.2, camShake: 0.003, recoilPush: 1
        },
        { // 5: Dual Uzi
            name: "Dual Uzi", archetype: "auto", shape: "pellet", pattern: "parallel", baseUpgradeCost: 1200, iconId: 1,
            damage: 25, splashRadius: 0, critChance: 5, critMult: 2.0, speed: 1200, range: 2000, rate: 60, spread: 15, multi: 2, knockback: 5, pierce: false, bloom: false,
            magSize: 100, reloadTime: 1500, audioKey: "sfx_smg", audioVol: 0.5, pitchVariance: 0.3, camShake: 0.005, recoilPush: 2
        },
        { // 6: AK-47
            name: "AK-47", archetype: "auto", shape: "tracer", pattern: "random", evolvesTo: 7, baseUpgradeCost: 500, iconId: 3,
            damage: 40, splashRadius: 0, critChance: 10, critMult: 2.0, speed: 1500, range: 2000, rate: 125, spread: 4, multi: 1, knockback: 15, pierce: false, bloom: true,
            magSize: 40, reloadTime: 1800, audioKey: "sfx_rifle", audioVol: 0.6, pitchVariance: 0.1, camShake: 0.005, recoilPush: 5
        },
        { // 7: M4 Carbine
            name: "M4 Carbine", archetype: "auto", shape: "tracer", pattern: "uniform", evolvesTo: 8, baseUpgradeCost: 1500, iconId: 4,
            damage: 60, splashRadius: 0, critChance: 12, critMult: 2.0, speed: 1800, range: 2500, rate: 100, spread: 2, multi: 1, knockback: 18, pierce: false, bloom: false,
            magSize: 60, reloadTime: 1600, audioKey: "sfx_assault", audioVol: 0.6, pitchVariance: 0.05, camShake: 0.004, recoilPush: 4
        },
        { // 8: M7 Carbine
            name: "M7 Carbine", archetype: "auto", shape: "tracer", pattern: "uniform", baseUpgradeCost: 3000, iconId: 4,
            damage: 110, splashRadius: 0, critChance: 15, critMult: 2.5, speed: 2000, range: 3000, rate: 85, spread: 1, multi: 1, knockback: 25, pierce: true, bloom: false,
            magSize: 80, reloadTime: 1400, audioKey: "sfx_assault", audioVol: 0.8, pitchVariance: -0.1, camShake: 0.006, recoilPush: 6
        },
        { // 9: LMG
            name: "LMG", archetype: "auto", shape: "tracer", pattern: "random", evolvesTo: 10, baseUpgradeCost: 1000, iconId: 5,
            damage: 40, splashRadius: 0, critChance: 10, critMult: 2.0, speed: 1800, range: 3000, rate: 60, spread: 8, multi: 1, knockback: 15, pierce: false, bloom: true,
            magSize: 100, reloadTime: 2500, audioKey: "sfx_lmg", audioVol: 0.8, pitchVariance: 0.15, camShake: 0.008, recoilPush: 8
        },
        { // 10: Minigun
            name: "Minigun", archetype: "auto", shape: "pellet", pattern: "uniform", evolvesTo: 11, baseUpgradeCost: 3000, iconId: 5,
            damage: 65, splashRadius: 0, critChance: 10, critMult: 3.0, speed: 2500, range: 2000, rate: 40, spread: 4, multi: 1, knockback: 15, pierce: true, bloom: true,
            magSize: 200, reloadTime: 4000, audioKey: "sfx_lmg", audioVol: 0.9, pitchVariance: 0.3, camShake: 0.010, recoilPush: 10
        },
        { // 11: Eradicator
            name: "Eradicator", archetype: "auto", shape: "tracer", pattern: "parallel", baseUpgradeCost: 6000, iconId: 7,
            damage: 187, splashRadius: 0, critChance: 10, critMult: 5.0, speed: 3000, range: 1500, rate: 50, spread: 2, multi: 2, knockback: 20, pierce: true, bloom: true,
            magSize: 400, reloadTime: 5000, audioKey: "sfx_eradicator", audioVol: 0.9, pitchVariance: 0.1, camShake: 0.020, recoilPush: 20
        },
        { // 12: Grenade Launcher
            name: "Grenade Launcher", archetype: "explosive", shape: "slug", pattern: "uniform", evolvesTo: 13, baseUpgradeCost: 1500, iconId: 6,
            damage: 200, splashRadius: 100, critChance: 10, critMult: 2.0, speed: 800, range: 2000, rate: 600, spread: 0, multi: 1, knockback: 50, pierce: false, bloom: false,
            magSize: 8, reloadTime: 3000, audioKey: "sfx_shotgun", audioVol: 0.8, pitchVariance: -0.3, camShake: 0.015, recoilPush: 15
        },
        { // 13: Plasma Cannon
            name: "Plasma Cannon", archetype: "energy", shape: "plasma", pattern: "uniform", evolvesTo: 14, baseUpgradeCost: 3500, iconId: 6,
            damage: 350, splashRadius: 150, critChance: 10, critMult: 3.0, speed: 600, range: 1500, rate: 745, spread: 1, multi: 1, knockback: 75, pierce: false, bloom: false,
            magSize: 10, reloadTime: 2900, audioKey: "sfx_cryo", audioVol: 0.7, pitchVariance: -0.2, camShake: 0.018, recoilPush: 10
        },
        { // 14: Arc Welder
            name: "Arc Welder 9000", archetype: "energy", shape: "plasma", pattern: "beam", baseUpgradeCost: 6000, iconId: 6,
            damage: 500, splashRadius: 0, critChance: 15, critMult: 2.0, speed: 2000, range: 1000, rate: 20, spread: 0, multi: 1, knockback: 5, pierce: true, bloom: false,
            magSize: 200, reloadTime: 1500, audioKey: "sfx_cryo", audioVol: 0.5, pitchVariance: 0.5, camShake: 0.005, recoilPush: 2
        }
    ],

    // 4. HORDE MULTIPLIERS (MOBS)
    mobs: {
        grunt:    { baseHp: 3,  baseSpeed: 100, cost: 1, hpPerWave: 1, speedPerWave: 0 },
        sprinter: { baseHp: 2,  baseSpeed: 160, cost: 2, hpPerWave: 1, speedPerWave: 2 },
        spitter:  { baseHp: 4,  baseSpeed: 80,  cost: 3, hpPerWave: 1, speedPerWave: 0 },
        tank:     { baseHp: 12, baseSpeed: 50,  cost: 4, hpPerWave: 2, speedPerWave: 0 },
        burrower: { baseHp: 5,  baseSpeed: 90,  cost: 3, hpPerWave: 1, speedPerWave: 1 }
    },

    // 5. THE PANTHEON (BOSSES)
    bosses: {
        10: { hp: 300,  speed: 55,  power: 15, scale: 4.5 },
        20: { hp: 550,  speed: 65,  power: 25, scale: 5.5 },
        30: { hp: 850,  speed: 75,  power: 35, scale: 6.5 },
        40: { hp: 1200, speed: 85,  power: 45, scale: 7.5 },
        50: { hp: 2000, speed: 100, power: 60, scale: 10.0 }
    },

    // 6. VISCERA & FX
    fx: {
        bloodYieldMin: 3,
        bloodYieldMax: 5,
        arterialSpraySpeed: 300,
        splatScaleMin: 0.8,
        splatScaleMax: 2.5,
        shakeIntensity: 1.0,
        maxBloodParticles: 1500,
        maxCasings: 200,
        maxCorpses: 50 
    },

    // 7. PLAYER & PHYSICS
    player: {
        playerScale: 2.0,
        baseSpeed: 180,
        dashSpeedMult: 2.5,
        dashDuration: 250,
        dashCooldown: 1500,
        coinLifespan: 10000,
        coinDrag: 0.95,
        coinBounce: 0.5,
        magnetRadius: 150
    },

    system: {
        masterVolume: 1.0,
        sfxVolume: 1.0,
        musicVolume: 0.5,
        showHitboxes: false
    },

    // 8. THE WORKBENCH (MASTERY TRACKS)
    // Per-archetype upgrade tracks (levels 1-5). mode "mult" = stat * (1 + perLevel*lvl),
    // mode "add" = stat + perLevel*lvl. Upgrade cost = weapon.baseUpgradeCost * (costScaling ^ totalLevelsBought).
    mastery: {
        maxLevel: 5,
        costScaling: 1.5,
        archetypes: {
            precision: {
                track1: { label: "Caliber",   stat: "damage",       perLevel: 0.15,  mode: "mult" },
                track2: { label: "Marksman",  stat: "critChance",   perLevel: 8,     mode: "add"  },
                track3: { label: "Action",    stat: "rate",         perLevel: -0.10, mode: "mult" }
            },
            scatter: {
                track1: { label: "Choke",     stat: "multi",        perLevel: 1,     mode: "add"  },
                track2: { label: "Buckshot",  stat: "damage",       perLevel: 0.12,  mode: "mult" },
                track3: { label: "Pump",      stat: "reloadTime",   perLevel: -0.10, mode: "mult" }
            },
            auto: {
                track1: { label: "Trigger",   stat: "rate",         perLevel: -0.10, mode: "mult" },
                track2: { label: "Rounds",    stat: "damage",       perLevel: 0.10,  mode: "mult" },
                track3: { label: "Drum",      stat: "magSize",      perLevel: 0.20,  mode: "mult" }
            },
            explosive: {
                track1: { label: "Payload",   stat: "splashRadius", perLevel: 0.15,  mode: "mult" },
                track2: { label: "Warhead",   stat: "damage",       perLevel: 0.12,  mode: "mult" },
                track3: { label: "Loader",    stat: "reloadTime",   perLevel: -0.10, mode: "mult" }
            },
            energy: {
                track1: { label: "Amplitude", stat: "damage",       perLevel: 0.12,  mode: "mult" },
                track2: { label: "Focus",     stat: "critMult",     perLevel: 0.25,  mode: "add"  },
                track3: { label: "Capacitor", stat: "rate",         perLevel: -0.08, mode: "mult" }
            }
        }
    },

    // 9. THE HARVEST (MUTATION MECHANICS)
    // Keyed by mutation NAME to match FlavorText.mutations. Flavor text lives in flavor.js.
    // NOTE (FLAGGED): payItForward, spareChange, tungstenCore are intentional-but-coarse
    //   approximations of the flavor text — tune freely.
    mutations: {
        "Heavy Boots":    { fireRateMult: 0.5 },
        "Scavenger":      { speedMult: 1.6, immunityMs: 1000 },
        "Corpse-a-Cola":  { radius: 70, hpDamageMult: 1.5 },
        "Pay It Forward": { damageBonus: 3 },           // not yet wired (needs barricade-damage hook)
        "Bitch Splinters":{ shards: 8, damageFraction: 0.4, speed: 700, range: 250 },
        "Spare Change":   { bonusCoins: 2 },
        "Chain Reaction": { chance: 15, damageMult: 1.5 },
        "Tungsten Core":  { pierce: true }
    },

    // 10. THE PORTFOLIO (VENTURE / INCOME)
    venture: {
        unlockWave: 25,
        baseCost: 5000,         // cost = baseCost * (level + 1)
        interestRate: 0.05,     // per level, on unspent funds at wave end
        inflationMult: 0.15,    // per level, flat coin-value multiplier
        midasChance: 10,        // per level, % chance to upgrade a coin's value
        midasMult: 3,           // coin value multiplier on Midas proc
        bountyAmount: 500       // not yet wired (needs marked-grunt spawn hook)
    },

    // 11. ENGINEERING (DEFENSES)
    defenses: {
        barricade: { hp: 100 },
        turret:    { range: 400, rate: 300, damage: 30, projectileSpeed: 1500 }
    },

    // 12. COMBAT TIMINGS & MISC
    // (FLAGGED) grenadeDamage/grenadeRadius decouple the thrown frag from the Grenade Launcher weapon.
    combat: {
        hitInvulnMs: 800,
        grenadeFuseMs: 700,
        grenadeSpeed: 500,
        grenadeDamage: 150,
        grenadeRadius: 100,
        burrowerDigMs: 2000,
        comboDisplayMin: 2,
        coinValuePerCost: 25,
        bossCoinValue: 1000,
        bossCoinCount: 10,
        mobCoinMin: 1,
        mobCoinMax: 3
    }
};