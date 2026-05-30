# VECTOR REFERENCE - Undead Barrage

## Directory Structure
All SVGs stored in `assets/svgs/`

## Player & Combat
- player.svg: Player sprite, 64x64, facing up
- bullet.svg: Projectile, 16x8
- grenade.svg: Grenade projectile, 32x32

## Enemies
- grunt.svg: Basic zombie, 48x48
- sprinter.svg: Fast zombie, 48x48
- spitter.svg: Acid spitter, 48x48
- tank.svg: Armored zombie, 64x64
- burrower.svg: Burrowing zombie, 48x48
- boss.svg: Boss sprite, 96x96

## Weapons (In-Hand)
- wpn_0.svg through wpn_7.svg: Weapon sprites held by player
  - 0: Pistol
  - 1: Uzi/SMG variants
  - 2: Shotgun
  - 3: Rifle/AK variants
  - 4: Assault rifle
  - 5: LMG
  - 6: Explosives
  - 7: Special (Eradicator/Energy)

## Weapons (HUD/Shop Display)
- wpn_side_0.svg through wpn_side_7.svg: Side view for HUD/shop

## UI Elements
- coin.svg: Currency pickup, 16x16
- crate.svg: Supply drop crate, 32x32
- grenade_pickup.svg: Grenade ammo icon, 24x24
- barricade.svg: Defensive structure, 48x32

## Backgrounds
- road_bg.svg: Main game arena road, 500px wide
- sidewalk_bg.svg: Left/right sidewalk decorations

## Loading in Preload
All loaded via:
```javascript
this.load.svg(key, `assets/svgs/${filename}.svg`);
```

Reference in code by key:
```javascript
sprite.setTexture('player');
```

## Asset Naming Convention
- Player/enemies: `[type].svg`
- Weapons in-hand: `wpn_[index].svg`
- Weapons display: `wpn_side_[index].svg`
- Pickups: `[type]_pickup.svg` or `[type].svg`
- UI: descriptive names (`coin`, `barricade`, etc.)
