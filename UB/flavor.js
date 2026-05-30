// ==========================================
// UNDEAD BARRAGE - FLAVOR & TEXT CONTENT
// ==========================================

export const FlavorText = {
    // Tutorial transmissions by wave
    tutorials: {
        1: "Welcome to the apocalypse. Use WASD to move and LMB to blast the horde to pieces! Don't let them through. There are three dozen families huddled in the bunker behind you, and I am not digging any more tiny graves today. (Press [R] to reload.)",
        3: "Watch out for Sprinters! They have lower HP but move 150% faster. Also, look out for flashing white Supply Drops. High risk, high reward.",
        5: "Boom! You've unlocked Frag Grenades! Press F to lob explosive ordnance for massive area damage! If you squint real hard, they kinda look like little green pineapples.",
        8: "We've got Spitters on the scope. They'll hang back and vomit corrosive stomach acid at you. Keep moving or melt.",
        10: "Massive biological signature approaching the perimeter. It's a Boss. Dump everything you have into it.",
        12: "The horde is getting thicker, and they brought Tanks. I've unlocked Barricades in Logistics. Build a killzone. Make them bleed for every inch.",
        15: "Subterranean 'Burrower' signatures detected. They're invulnerable while digging. Watch your flanks behind the barricades.",
        20: "You're getting overrun. I'm authorizing Automated Defenses. Buy a Sentry Turret to cover your blind spots.",
        25: "Looks like you might actually survive the night. Time to start thinking about retirement. I've unlocked my 'Venture' portfolio in the Armory. Invest your funds to earn interest, or die rich. Your call."
    },

    // Mutation flavor
    mutations: {
        "Heavy Boots": {
            title: "Heavy Boots",
            desc: "Cement yourself to the floor. Standing perfectly still violently accelerates your fire rate by 50%.",
            quote: "\"Dig in and become a stationary meat grinder.\""
        },
        "Scavenger": {
            title: "Scavenger",
            desc: "Your greed overrides your fragile biology. Touching loose change violently accelerates your nervous system, giving you a massive speed boost and 1 second of total immunity to dismemberment.",
            quote: "\"Shiny...\""
        },
        "Corpse-a-Cola": {
            title: "Corpse-a-Cola",
            desc: "Your bullets inject enemies' bloodstream with hyper-pressurized gas. When they die, they violently rupture like a meat-balloon filled with explosives, scaling with their max HP.",
            quote: "\"Ah, a refreshing spray of viscera.\""
        },
        "Pay It Forward": {
            title: "Pay It Forward",
            desc: "When a barricade takes damage, your weapon damage temporarily increases by +3.",
            quote: "\"An eye for an eye.\""
        },
        "Bitch Splinters": {
            title: "Bitch Splinters",
            desc: "Critical hits cause the target's internal skeletal structure to violently detonate in a 360-degree spray of razor-sharp bone fragments.",
            quote: "\"Eye protection recommended.\""
        },
        "Spare Change": {
            title: "Spare Change",
            desc: "Turning enemies into chunky salsa with explosives or critical hits shakes loose significantly more loot.",
            quote: "\"Keep the change.\""
        },
        "Chain Reaction": {
            title: "Chain Reaction",
            desc: "Explosions have a 15% chance to catastrophically over-perform, dealing 150% critical damage.",
            quote: "\"Bigger boom.\""
        },
        "Tungsten Core": {
            title: "Tungsten Core",
            desc: "Your kinetic rounds effortlessly punch through biological mass, piercing an additional target standing directly behind them.",
            quote: "\"Efficient.\""
        }
    },

    // NPC Quartermaster quotes
    npcQuotes: [
        "A new chassis changes everything. Keep upgrading.",
        "Compound interest is the eighth wonder of the world. Too bad the world ended.",
        "I highly recommend the Piggy Bank Sentry. Just remember: I don't refund shattered porcelain or eaten cash.",
        "You break it, you bought it. And if they eat you, I'm taking it back.",
        "Upgrades don't fix stupid, but they do make you slightly more lethal."
    ],

    // Boot screen
    boot: {
        title: "UNDEAD BARRAGE",
        subtitle: "TACTICAL DEPLOYMENT",
        deployBtn: "DEPLOY",
        settingsBtn: "SETTINGS / OVERRIDES"
    },

    // Game over screen
    gameOver: {
        titleDead: "YOU DEAD",
        titleBreach: ["BARRICADE", "BREACHED"],
        survived: "SURVIVED:"
    },

    // Pause screen
    pause: {
        title: "PAUSED",
        resumeBtn: "RESUME",
        settingsBtn: "SETTINGS"
    },

    // Settings screen
    settings: {
        title: "SYSTEM SETTINGS",
        virtualGamepad: "Virtual Gamepad (Mobile)",
        impactShake: "Impact Screen Shake",
        enableDev: "Enable Dev Overrides",
        closeBtn: "CLOSE"
    },

    // HUD labels
    hud: {
        wave: "WAVE",
        hp: "HP",
        armor: "ARMOR",
        grenades: "GRENADES",
        funds: "FUNDS",
        combo: "FLAWLESS COMBO"
    },

    // Shop/Armory
    shop: {
        title: "THE ARMORY",
        bioMonitor: "BIO-MONITOR",
        operatorStatus: "OPERATOR STATUS",
        maxHp: "MAX HP",
        armor: "ARMOR",
        baseSpeed: "BASE SPD",
        biologicalHarvest: "BIOLOGICAL HARVEST",
        primarySlot: "PRIMARY SLOT",
        secondarySlot: "SECONDARY SLOT",
        empty: "EMPTY",
        classifiedWeapon: "CLASSIFIED",
        equipPrimary: "EQUIP PRIMARY",
        equipSecondary: "EQUIP SECONDARY",
        chassisConversion: "CHASSIS CONVERSION",
        returnToBattlefield: "RETURN TO BATTLEFIELD"
    },

    // Logistics tab
    logistics: {
        consumables: "CONSUMABLES",
        kevlar: "Kevlar Plates",
        grenades: "Frag Grenades",
        engineering: "ENGINEERING",
        barricade: "Deploy Barricade",
        repair: "Repair Defenses (25%)",
        automation: "AUTOMATION",
        turret: "Deploy Sentry Turret",
        piggy: "Deploy Piggy Bank Sentry"
    },

    // Venture tab
    venture: {
        encrypted: "[ ENCRYPTED UNTIL WAVE 25 ]",
        economic: "ECONOMIC STRATEGY",
        midas: "Midas Touch",
        midasDesc: "Chance to upgrade dropped coin tiers.",
        interest: "Compound Interest",
        interestDesc: "Earn wave-end interest on unspent funds.",
        bounty: "Bounty Hunter",
        bountyDesc: "Periodic marked Grunts drop $500 Gold.",
        inflation: "Inflation Hedge",
        inflationDesc: "Flat base value multiplier for all coins."
    },

    // Harvest screen
    harvest: {
        title: "BIOLOGICAL HARVEST",
        intro: "The monster falls, yet you still feel the thrum of power beating from within its corpse... As black ichor runs down your face, your senses return, replaced by the electric tingle of dark energy coursing through your veins.",
        noMutations: "The corpse yields nothing but a puddle of putrid slime. You scrape $500 out of its ruptured stomach cavity instead. Buy something shiny to distract yourself from the smell."
    },

    // Dev panel
    dev: {
        adminTools: "ADMIN TOOLS",
        godMode: "GOD MODE:",
        funds: "INJECT FUNDS ($10k)",
        unlockWeapons: "UNLOCK ALL WPN",
        skipWave: "KILL ALL (SKIP WAVE)",
        restartWave: "RESTART WAVE",
        close: "CLOSE PANEL"
    },

    // Wave clear message
    waveClear: "WAVE CLEARED"
};
