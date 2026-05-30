# UNDEAD BARRAGE - GAME DESIGN DOCUMENT

## OVERVIEW
Undead Barrage is a wave-based arcade shooter where the player holds a defensive line against exponentially scaling enemies. Progression is driven by weapon mastery (upgrade tracks), strategic mutations, and economic investments.

## CORE LOOP
1. Wave begins
2. Director spawns enemy budget
3. Player kills enemies, earns coins
4. Wave clears
5. Player shops (weapons, upgrades, defenses)
6. Next wave begins

Every 5 waves: Boss + Mutation Harvest instead of shop.

## KEY SYSTEMS

### Waves & Difficulty
- Exponential enemy budget: 15 * (1.15 ^ wave)
- Enemy composition changes per wave (grunts → sprinters → spitters → tanks → burrowers)
- Boss waves at: 10, 20, 30, 40, 50 (and every 5 waves after 50)
- Boss HP/Power scales with wave

### Weapons
- 15 distinct weapons with evolution paths
- Each weapon has 3 upgrade tracks (levels 1-5 each)
- Tracks grant archetype-specific bonuses
- Example: Precision track 1 = +15% damage per level
- Mastery progression over replacement (upgrade existing weapon vs. buy new)

### Mutations
- Appear every 5 waves (wave 5, 10, 15, etc.)
- Player chooses 1 of 3 random mutations
- Passive bonuses that stack
- Examples: +50% fire rate when standing still, enemies explode on death, critical hits spray shrapnel

### Economy
- Coins drop from kills (bronze/silver/gold tiers)
- Player funds purchases: weapons, upgrades, defenses, grenades, armor
- Venture investments unlock at wave 25: Midas Touch, Compound Interest, Bounty Hunter, Inflation Hedge
- Supply drops appear mid-wave with health/grenades/coins

### Progression Gates
- Wave 1: Basic grunts
- Wave 3: Sprinters unlock
- Wave 5: Grenades unlock
- Wave 8: Spitters unlock
- Wave 10: First boss, barricades blueprint
- Wave 12: Barricades available, engineering unlocks
- Wave 15: Burrowers unlock
- Wave 20: Turrets unlock
- Wave 25: Venture portfolio unlocks

## GAME STATE (In-Memory)
```
GameState = {
  // Game Loop
  wave: number
  gameActive: boolean
  isPaused: boolean
  
  // Player
  hp: number (max 5)
  armor: number (max 5)
  funds: number
  primaryWeapon: number (index into weapons array)
  secondaryWeapon: number | null
  activeSlot: 'primary' | 'secondary'
  
  // Combat
  ammo: { [wpnId]: number } — current ammo per weapon
  isReloading: boolean
  combo: number — flawless hits without taking damage
  
  // Progression
  mutations: string[] — array of mutation IDs acquired
  weaponMastery: { 
    [wpnId]: { track1, track2, track3 } 
  } — upgrade level per track
  unlockedWeapons: number[] — indices of acquired weapons
  
  // Defenses
  barricades: [barricade | null] × 6 — slots for defensive structures
  defenses: defense[] — turrets, piggy banks
  
  // Economy
  ventureInvestments: { [key]: level } — venture upgrade levels
  
  // Settings
  godMode: boolean
}
```

## EVENTS
Core events (full contract to be defined in next iteration):
- GAME_START
- WAVE_STARTED
- WAVE_CLEARED
- ENEMY_SPAWNED
- ENEMY_DIED
- PLAYER_HIT
- WEAPON_EQUIPPED
- UPDATE_HUD
- PAUSE_GAME
- RESUME_GAME

## UI FLOW
- Boot Screen → Deploy button
- Game Running (battlefield)
- Mid-wave: HUD with stats, ammo, combo
- Wave Clear: "WAVE CLEARED" animation
- Shop Screen: tabs for Firearms, Logistics, Venture
- Mutation Harvest: choose 1 of 3
- Pause Menu: resume, settings
- Game Over: survived X waves, restart

## MODALS (In-DOM)
- #screen-boot: Initial boot screen
- #screen-pause: Pause menu
- #screen-settings: Settings toggles
- #screen-game-over: Game over stats
- (Others added as needed: shop, harvest, tutorial)

## BUILD LAYERS

### Layer 1 (v0.1): Foundation
- Boot screen with DEPLOY button
- GameScene loads, arena renders
- Player entity spawns at center
- WASD movement, mouse rotation
- Minimal HUD: wave counter, HP icons, funds display
- Update HUD on state changes
- No enemies, no combat

### Layer 2 (v0.2): Combat
- Enemy class: Grunt (moves toward player, dies on hit)
- Director AI spawns 3 grunts per wave (hardcoded for now)
- Player firing: mousedown → projectile spawns, ammo decrements
- Collision: projectile + enemy → damage → floating damage text
- Wave clear detection (all enemies dead → emit WAVE_CLEARED)
- Events: FIRE, ENEMY_DIED, WAVE_CLEARED, PROJECTILE_HIT

### Layer 3 (v0.3): Shop & Economy
- Shop overlay: 3 tabs (Firearms / Logistics / Venture)
- Weapon rack: 15 slots showing locked/unlocked status
- Workbench: upgrade tracks for equipped weapon
- Buy/equip logic, chassis evolution
- Funds earned from kills, wave-end payout
- Return to Battlefield button → next wave

### Layer 4 (v0.4): Mastery Tracks
- getModifiedStats(wpnId) using weaponMastery + archetype formulas
- All 5 archetypes: precision/scatter/auto/explosive/energy scaling
- Chassis conversion: max all 3 tracks → unlock evolution
- Ammo refill on chassis evolution

### Layer 5 (v0.5): Director & Polish
- Session A: DirectorAI full implementation (budget scaling, mob types, bosses)
- Session B: Mutations, defenses, combo meter, virtual gamepad
