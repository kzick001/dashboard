# Code Conventions & Structure

## File Organization (game.js)

game.js is organized into sections marked by comments:

```
// ========== GAME STATE ==========
// ========== EVENT BUS ==========
// ========== GAME SCENE ==========
// ========== ENTITY CLASSES ==========
// ========== MANAGER CLASSES ==========
// ========== BOOTSTRAP ==========
```

Navigate via these markers.

## GameState
- Single source of truth for all runtime data
- All mutations go through GameState object
- Events fire AFTER state changes (not before)
- No private state in classes; all public to GameState

## Naming Conventions

### Variables
- camelCase: `playerPosition`, `enemyCount`
- Constants: UPPER_SNAKE_CASE (rarely used—prefer config.js)
- Booleans: is/has prefix: `isAlive`, `hasArmor`

### Functions/Methods
- camelCase: `fireWeapon()`, `takeDamage()`
- Private methods: _camelCase (convention only, still accessible)
- Event handlers: on[EventName](): `onGameStart()`, `onEnemyDied()`

### Classes
- PascalCase: `Player`, `DirectorAI`, `GameScene`

### CSS/DOM IDs
- kebab-case: `#screen-boot`, `#btn-new-game`, `.modal-overlay`

## Comments

### Section Headers
```javascript
// ========== MAJOR SECTION NAME ==========
```

### Function Docs
```javascript
// fireWeapon(angle, damage) — spawn projectile in direction, cost ammo
fireWeapon(angle, damage) {
    // ...
}
```

### Inline Comments (Minimal)
Only comment WHY, not WHAT:
```javascript
// BAD: Increment ammo counter
this.ammo++;

// GOOD: Reload complete, refill magazine
this.ammo = weaponDef.magSize;
```

## Event Pattern

Events always fired after state mutation:
```javascript
// 1. Change state
GameState.funds += 100;

// 2. Emit event with detail
eventBus.emit('FUNDS_CHANGED', { 
    new: GameState.funds, 
    old: GameState.funds - 100 
});

// 3. UI updates via event listener
eventBus.on('FUNDS_CHANGED', (detail) => {
    updateHUD(detail);
});
```

## Phaser Object Management

### Object Pools
Use Phaser's built-in pooling:
```javascript
this.projectilePool = this.physics.add.group({
    classType: Projectile,
    maxSize: 300,
    runChildUpdate: true
});
```

Spawn from pool:
```javascript
let proj = this.projectilePool.getFirstDead(false);
if (proj) {
    proj.spawn(x, y, vx, vy);
}
```

Despawn:
```javascript
proj.setActive(false).setVisible(false);
```

### Depth Layering
Use numeric z-order:
```javascript
sprite.setDepth(10);  // Higher = on top
```

## Config Usage

All numeric values from GameConfig, never hardcoded:
```javascript
// BAD
let damage = 25;
let speed = 180;

// GOOD
let damage = GameConfig.weapons[wpnId].damage;
let speed = GameConfig.player.baseSpeed;
```

## Error Handling

Try-catch around risky operations:
```javascript
try {
    let config = GameConfig.weapons[wpnId];
    if (!config) throw new Error(`Weapon ${wpnId} not found`);
    // use config
} catch (e) {
    console.error('Weapon error:', e);
}
```

## Testing Notes

Each class should be testable in isolation:
```javascript
let player = new Player(scene, 100, 100);
player.tick(time, delta);  // Should not crash if scene is mock
```

Avoid circular dependencies: Scene → Managers → Entities (not back).

## Version Bumps

- Major.minor.patch: X.Y.Z
- v0.1 = Layer 1 complete
- v0.2 = Layer 2 added
- v0.5 = Full game playable (all 5 layers)
- v1.0 = Balance pass + polish complete

Each version gets a git commit + saved as ub-vX.Y-stable.js
