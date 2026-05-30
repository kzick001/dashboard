# Assets Manifest - Required SVG Files

All files must exist in `assets/svgs/` before building. This is a checklist.

## Critical (Game Won't Load Without These)
- [ ] player.svg (64x64, player sprite)
- [ ] road-background.svg (arena floor)
- [ ] sidewalk.svg (side decoration)

## Enemies (Required for Layer 2)
- [ ] grunt.svg (48x48)
- [ ] sprinter.svg (48x48)
- [ ] spitter.svg (48x48)
- [ ] tank.svg (64x64)
- [ ] burrower.svg (48x48)
- [ ] boss.svg (96x96)

## Weapons In-Hand (Required for Layer 1 onwards)
- [ ] wpn_0.svg (Pistol)
- [ ] wpn_1.svg (Uzi/SMG)
- [ ] wpn_2.svg (Shotgun)
- [ ] wpn_3.svg (Rifle)
- [ ] wpn_4.svg (Assault rifle)
- [ ] wpn_5.svg (LMG)
- [ ] wpn_6.svg (Explosives)
- [ ] wpn_7.svg (Special/Energy)

## Weapons HUD Display (Required for Layer 3)
- [ ] wpn_side_0.svg (Pistol HUD)
- [ ] wpn_side_1.svg (Uzi/SMG HUD)
- [ ] wpn_side_2.svg (Shotgun HUD)
- [ ] wpn_side_3.svg (Rifle HUD)
- [ ] wpn_side_4.svg (Assault HUD)
- [ ] wpn_side_5.svg (LMG HUD)
- [ ] wpn_side_6.svg (Explosives HUD)
- [ ] wpn_side_7.svg (Special HUD)

## Projectiles (Required for Layer 2)
- [ ] bullet.svg (16x8 projectile)
- [ ] grenade.svg (32x32 grenade projectile)

## Pickups (Required for Layer 2)
- [ ] coin.svg (16x16 currency)
- [ ] crate.svg (32x32 supply drop)
- [ ] grenade_pickup.svg (24x24 ammo icon)

## Defenses (Required for Layer 5)
- [ ] barricade.svg (48x32 wall)

## Total Required
23 unique SVG files (some referenced multiple times in code)

## Optional (Polish)
- Blood splat variants
- Muzzle flash
- Explosion effect
- Impact markers

## Notes
- SVG dimensions are reference only; Phaser scales them
- Naming must match exactly (case-sensitive on Linux/Mac)
- If an SVG is missing, game won't load that asset and will error in console
- Test with incomplete assets by temporarily disabling load calls in game.js preload()
