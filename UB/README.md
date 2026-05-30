# Undead Barrage — A Phaser 3 Wave-Based Shooter

A solo arcade shooter where you hold a defensive line against exponentially scaling enemies while upgrading weapons through a mastery system.

## Quick Start

1. Ensure all SVG files exist in `assets/svgs/` (see ASSETS_MANIFEST.md)
2. Open `index.html` in a browser
3. Click DEPLOY to start

## Project Structure

- `index.html` — DOM, modals, loads scripts
- `config.js` — All game balance numbers (weapons, enemies, costs)
- `flavor.js` — All text (dialogue, UI labels, mutation descriptions)
- `game.js` — Game logic (GameScene, entities, event bus)
- `design.md` — Game design doc (hybrid prose + explicit specs)
- `vectors.md` — SVG reference
- `CODE_CONVENTIONS.md` — How code is organized
- `INPUT_MAPPING.md` — Keyboard/control reference
- `ASSETS_MANIFEST.md` — Required SVG files checklist
- `PROJECT_INSTRUCTIONS.md` — Development workflow

## Core Systems

### Game State
Single `GameState` object holds all runtime data (player HP, funds, weapon mastery, mutations, etc.). All changes go through this object, events fire after mutations.

### Event Bus
Custom `EventBus` class routes game events (WAVE_CLEARED, ENEMY_DIED, etc.). No direct coupling between systems; everything talks via events.

### Config-Driven
All numbers live in `config.js` (weapon damage, enemy HP, upgrade costs). Code references config, never hardcodes values. Balance changes don't require touching game logic.

### Flavor-Driven
All text lives in `flavor.js` (tutorial messages, mutation descriptions, UI labels). Easy to adjust tone, translate, or rewrite without touching code.

## Development Workflow

See PROJECT_INSTRUCTIONS.md for detailed workflow.

**TL;DR:** 
1. Claude builds game.js per design spec
2. Test locally (no build step)
3. If broken, ask Claude for surgical fix
4. Save working version, move to next layer

## Build Layers

- **v0.1**: Boot + Player movement + HUD skeleton
- **v0.2**: Enemy spawning + Firing + Collision
- **v0.3**: Shop + Weapon equip + Economy
- **v0.4**: Mastery tracks + Stat scaling
- **v0.5**: Director AI + Bosses + Mutations + Defenses

Expected total: 14-18 hours of development.

## Controls

**Desktop:**
- WASD: Move
- Mouse: Aim
- LMB: Fire
- R: Reload
- F: Grenade
- Q: Swap weapon
- Escape: Pause

**Mobile:**
- Left joystick: Move
- Right buttons: Fire, Dash, Grenade, Swap

See INPUT_MAPPING.md for full details.

## Key Mechanics

### Weapons
15 weapons with 3 upgrade tracks each. Mastery progression (upgrade existing) over replacement (buy new).

### Mutations
Passive bonuses unlocked every 5 waves. Stack for emergent playstyles.

### Economy
Coins drop from kills. Player funds weapon upgrades, defenses, grenades, armor. Venture investments unlock at wave 25 for income generation.

### Defenses
Barricades (walls), Sentry Turrets (AI-fired), Piggy Banks (coin vaults). Built during shop phases.

## Debugging

- Open browser console (F12) for errors
- Check GameState in console: `window.GameState`
- Check config: `window.GameConfig`
- Check events: `window.eventBus.emit('test')`
- Enable dev panel in settings (shows god mode, fund injection, skip wave)

## Design Philosophy

- **No hardcoded values**: Everything pulls from config.js
- **Event-driven**: Systems talk via event bus, not direct calls
- **Flavor external**: Text in flavor.js, code in game.js
- **Semantic structure**: Code organized by responsibility (STATE, SCENE, ENTITIES, MANAGERS)
- **Testable layers**: Each layer builds on previous, completes before next begins

## Next Steps After v0.5

1. Balance pass (tweak config.js for fun/difficulty)
2. Polish (screen effects, audio, juice)
3. Content (more mutations, weapon variants, boss patterns)
4. Platforms (mobile optimization, accessibility)

## License

Open source. Do what you want with it.
