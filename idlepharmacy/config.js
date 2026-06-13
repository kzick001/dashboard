// config.js — Idle Pharmacy tunable constants. Loaded before main script.
window.GAME_CONFIG = {
  tickMs:        250,
  offlineCapMs:  24 * 60 * 60 * 1000,

  // Asymmetric base seconds-per-rx per active slot. Check fastest, Pack slowest.
  stageSpeed:    { check: 3, fill: 5, pack: 10 },

  staffBase:     { fill: 8, check: 20, pack: 8 },
  staffScale:    1.17,

  stationBase:   40,
  stationScale:  1.9,

  buildingBase:  120,
  buildingScale: 4.0,

  // Marketing
  marketingBase:  140,
  marketingScale: 1.9,
  marketingStep:  0.13,    // +13% income per level

  // Prestige
  prestigeUnlock: 5_000_000,

  // One-time passive upgrades
  upgrades: [
    { id: 'efficientWorkflow', name: 'Efficient Workflow', desc: 'Fill +20% throughput',  cost: 500,   stage: 'fill'  },
    { id: 'peerReview',        name: 'Peer Review',        desc: 'Check +20% throughput', cost: 1_500, stage: 'check' },
    { id: 'betterPackaging',   name: 'Better Packaging',   desc: 'Pack +20% throughput',  cost: 200,   stage: 'pack'  },
    { id: 'expeditedShipping', name: 'Expedited Shipping', desc: 'Income +10% flat',      cost: 5_000, stage: null    },
  ],
  upgradeBuff: 1.20,

  // Achievement definitions
  achievements: [
    { id: 'first_fill',    name: 'First Technician',   desc: 'Hired your first Fill worker',        reward: 50,      trigger: s => totalStaffOfRole('fill')  >= 1 },
    { id: 'first_check',   name: 'First Pharmacist',   desc: 'Hired your first Check worker',       reward: 50,      trigger: s => totalStaffOfRole('check') >= 1 },
    { id: 'first_pack',    name: 'First Packer',       desc: 'Hired your first Pack worker',        reward: 50,      trigger: s => totalStaffOfRole('pack')  >= 1 },
    { id: 'first_station', name: 'Open Floor Plan',    desc: 'Built your first station',            reward: 200,     trigger: s => s.stationsOwned >= 2 },
    { id: 'tier_2',        name: 'Brand Recognition',  desc: 'Unlocked Brand Name drugs',           reward: 1_000,   trigger: s => s.drugTier >= 2 },
    { id: 'tier_3',        name: 'Prior Auth Approved',desc: 'Unlocked Specialty Rx',               reward: 10_000,  trigger: s => s.drugTier >= 3 },
    { id: 'tier_4',        name: 'Biologic License',   desc: 'Unlocked Biologics',                  reward: 100_000, trigger: s => s.drugTier >= 4 },
    { id: 'rx_100',        name: 'Century Mark',       desc: 'Filled 100 prescriptions',            reward: 100,     trigger: s => (s.totalRxFilled || 0) >= 100 },
    { id: 'rx_1k',         name: 'Thousand Strong',    desc: 'Filled 1,000 prescriptions',          reward: 500,     trigger: s => (s.totalRxFilled || 0) >= 1_000 },
    { id: 'rx_10k',        name: 'High Volume',        desc: 'Filled 10,000 prescriptions',         reward: 5_000,   trigger: s => (s.totalRxFilled || 0) >= 10_000 },
    { id: 'rx_100k',       name: 'Industrial Scale',   desc: 'Filled 100,000 prescriptions',        reward: 50_000,  trigger: s => (s.totalRxFilled || 0) >= 100_000 },
    { id: 'earn_1k',       name: 'First Grand',        desc: '$1,000 lifetime earned',              reward: 100,     trigger: s => (s.totalEarned || 0) >= 1_000 },
    { id: 'earn_100k',     name: 'Six Figures',        desc: '$100,000 lifetime earned',            reward: 2_500,   trigger: s => (s.totalEarned || 0) >= 100_000 },
    { id: 'earn_1m',       name: 'Franchise Material', desc: '$1,000,000 lifetime earned',          reward: 25_000,  trigger: s => (s.totalEarned || 0) >= 1_000_000 },
    { id: 'first_prestige',name: 'Sold the Franchise', desc: 'Completed your first prestige reset', reward: 0,       trigger: s => s.prestigeCount >= 1 },
  ],

  tiers: [
    { name: 'Generics',  value: 3,   unlock: 0       },
    { name: 'Brand',     value: 12,  unlock: 400     },
    { name: 'Specialty', value: 48,  unlock: 22_000  },
    { name: 'Biologics', value: 192, unlock: 420_000 },
  ],
  difficultyRamp: { 1: 1, 2: 1.5, 3: 2.6, 4: 4.4 },

  // Per-tier processing modifiers (multiplier on stageSpeed; higher = slower)
  tierSpeedMod: {
    1: { fill: 1.0, check: 1.0, pack: 1.0 },
    2: { fill: 1.0, check: 1.3, pack: 1.0 },
    3: { fill: 1.2, check: 1.6, pack: 1.4 },
    4: { fill: 1.3, check: 2.2, pack: 1.8 },
  },

  // Station capacity
  WORKERS_PER_STATION: 3,

  // Global station upgrade tracks
  globalStationUpgrades: {
    dispensing:   { stage: 'fill',  base: 120, scale: 5, stepPct: 0.15,
                    names: ['Calibrated Counting Trays', 'Automated Tablet Counter', 'Robotic Dispensing Cell'] },
    verification: { stage: 'check', base: 200, scale: 5, stepPct: 0.15,
                    names: ['Dual-Monitor Terminal', 'Barcode Scan-Verify', 'Intelligent DUR Alerts'] },
    fulfillment:  { stage: 'pack',  base: 100, scale: 5, stepPct: 0.15,
                    names: ['Supply Dispensers', 'Automated Label Printer', 'Conveyor Sortation'] },
  },
  globalStationUpgradeMaxLevel: 3,

  // Stats time-series sampler
  statsSampleMs:   30_000,
  statsMaxSamples: 400,

  // Wages (per 300s shift)
  shiftMs:       300_000,
  wages:         { fill: 25, check: 50, pack: 20 }, // Technician, Pharmacist, Packer
  wageTierMult:  { 1: 1, 2: 2.5, 3: 6, 4: 14 },

  // candidatePool populated at runtime via flavor.json (or FLAVOR_FALLBACK)
  candidatePool: null,
};
