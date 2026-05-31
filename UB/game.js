// ==========================================
// UNDEAD BARRAGE - GAME ENGINE (v1.0.0)
// Layers 1-5 + v1.0 Polish: VFX, Flow Gating, Director Phases,
//   Mutation/Venture hooks, Spitter/Barricade, Supply Drops, Audio scaffold
// ==========================================

import { GameConfig } from './config.js';
import { FlavorText } from './flavor.js';

// Mastery track definitions now live in GameConfig.mastery (config.js).

// ========== GAME STATE ==========
const GameState = {
    // Game Loop
    wave: 1,
    gameActive: false,
    isPaused: false,
    inShop: false,
    inHarvest: false,
    tutorialPending: false,

    // Player
    maxHp: 5,
    hp: 5,
    maxArmor: 5,
    armor: 0,
    funds: 0,
    grenades: 0,
    primaryWeapon: 0,
    secondaryWeapon: null,
    activeSlot: 'primary',

    // Combat
    ammo: {},
    isReloading: false,
    combo: 0,
    maxCombo: 0,
    kills: 0,

    // Progression
    mutations: [],
    weaponMastery: {},
    unlockedWeapons: [0],

    // Defenses
    barricades: [null, null, null, null, null, null],
    defenses: [],

    // Economy
    ventureInvestments: {},

    // Settings
    godMode: false,
    virtualGamepad: false,
    screenShake: true,
    devOverrides: false
};

// Initialize ammo and mastery for all weapons
GameConfig.weapons.forEach((wpn, idx) => {
    GameState.ammo[idx] = wpn.magSize;
    GameState.weaponMastery[idx] = { track1: 0, track2: 0, track3: 0 };
});

// activeWeaponId() — resolve the weapon id for the currently selected slot
function activeWeaponId() {
    if (GameState.activeSlot === 'secondary' && GameState.secondaryWeapon !== null) {
        return GameState.secondaryWeapon;
    }
    return GameState.primaryWeapon;
}

// getModifiedStats(wpnId) — apply mastery track bonuses to a weapon's base stats
function getModifiedStats(wpnId) {
    const base = GameConfig.weapons[wpnId];
    const stats = Object.assign({}, base);
    const arch = GameConfig.mastery.archetypes[base.archetype];
    const mastery = GameState.weaponMastery[wpnId] || { track1: 0, track2: 0, track3: 0 };
    if (!arch) return stats;

    ['track1', 'track2', 'track3'].forEach(tk => {
        const def = arch[tk];
        const lvl = mastery[tk] || 0;
        if (!def || lvl <= 0) return;
        const cur = stats[def.stat];
        if (def.mode === 'mult') {
            stats[def.stat] = cur * (1 + def.perLevel * lvl);
        } else {
            stats[def.stat] = cur + def.perLevel * lvl;
        }
    });

    // Mutation: Heavy Boots handled at fire-time (standing still). Tungsten Core = pierce.
    if (GameState.mutations.includes('Tungsten Core')) stats.pierce = true;
    return stats;
}

// ========== EVENT BUS ==========
class EventBus extends EventTarget {
    constructor() {
        super();
    }

    emit(eventName, detail) {
        this.dispatchEvent(new CustomEvent(eventName, { detail }));
    }

    on(eventName, handler) {
        this.addEventListener(eventName, e => handler(e.detail));
    }
}

const eventBus = new EventBus();

// ========== GAME SCENE ==========
class GameScene extends Phaser.Scene {
    constructor() {
        super('GameScene');
    }

    preload() {
        // Backgrounds
        this.load.svg('road_bg', 'assets/svgs/road-background.svg');
        this.load.svg('sidewalk_bg', 'assets/svgs/sidewalk.svg');

        this.load.svg('player', 'assets/svgs/player.svg');

        // Enemies
        this.load.svg('grunt', 'assets/svgs/grunt.svg');
        this.load.svg('sprinter', 'assets/svgs/sprinter.svg');
        this.load.svg('spitter', 'assets/svgs/spitter.svg');
        this.load.svg('tank', 'assets/svgs/tank.svg');
        this.load.svg('burrower', 'assets/svgs/burrower.svg');
        this.load.svg('boss', 'assets/svgs/boss.svg');

        // Weapons (in-hand + HUD)
        for (let i = 0; i < 8; i++) {
            this.load.svg(`wpn_${i}`, `assets/svgs/wpn_${i}.svg`);
            this.load.svg(`wpn_side_${i}`, `assets/svgs/wpn_side_${i}.svg`);
        }

        // Projectiles
        this.load.svg('bullet', 'assets/svgs/bullet.svg');
        this.load.svg('grenade_proj', 'assets/svgs/grenade.svg');

        // Items
        this.load.svg('coin', 'assets/svgs/coin.svg');
        this.load.svg('crate', 'assets/svgs/crate.svg');
        this.load.svg('grenade_pickup', 'assets/svgs/grenade_pickup.svg');
        this.load.svg('barricade', 'assets/svgs/barricade.svg');
    }

    create() {
        const cam = this.cameras.main;
        const roadWidth = 500;

        // Background
        this.add.image(cam.centerX, cam.centerY, 'road_bg')
            .setDisplaySize(roadWidth, cam.height)
            .setDepth(1);
        this.add.image(cam.centerX - roadWidth / 2 - 500, cam.centerY, 'sidewalk_bg')
            .setDisplaySize(1000, cam.height)
            .setDepth(0);
        this.add.image(cam.centerX + roadWidth / 2 + 500, cam.centerY, 'sidewalk_bg')
            .setDisplaySize(1000, cam.height)
            .setDepth(0);

        // World bounds = camera bounds (arena is the visible screen)
        this.physics.world.setBounds(0, 0, cam.width, cam.height);

        // ----- Object pools -----
        this.projectilePool = this.physics.add.group({
            classType: Projectile, maxSize: 300, runChildUpdate: true
        });
        this.enemyGroup = this.physics.add.group({
            classType: Enemy, runChildUpdate: true
        });
        this.coinGroup = this.physics.add.group({
            classType: Coin, maxSize: 200, runChildUpdate: true
        });
        this.grenadeGroup = this.physics.add.group({
            classType: GrenadeProj, maxSize: 30, runChildUpdate: true
        });
        this.acidGroup = this.physics.add.group({
            classType: AcidProjectile, maxSize: 60, runChildUpdate: true
        });
        this.crateGroup = this.physics.add.group({
            classType: SupplyCrate, maxSize: 8, runChildUpdate: true
        });
        this.barricadeGroup = this.physics.add.staticGroup();

        // ----- Player -----
        this.player = new Player(this, cam.centerX, cam.height - 120);
        this.add.existing(this.player);
        this.physics.add.existing(this.player);
        this.player.body.setCollideWorldBounds(true);

        // ----- Collisions -----
        this.physics.add.overlap(this.projectilePool, this.enemyGroup, this.onProjectileHitEnemy, null, this);
        this.physics.add.overlap(this.grenadeGroup, this.enemyGroup, this.onGrenadeHitEnemy, null, this);
        this.physics.add.overlap(this.player, this.enemyGroup, this.onPlayerHitByEnemy, null, this);
        this.physics.add.overlap(this.player, this.coinGroup, this.onPlayerCollectCoin, null, this);
        this.physics.add.overlap(this.player, this.acidGroup, this.onPlayerHitByAcid, null, this);
        this.physics.add.overlap(this.player, this.crateGroup, this.onPlayerCollectCrate, null, this);
        this.physics.add.overlap(this.enemyGroup, this.barricadeGroup, this.onEnemyHitBarricade, null, this);

        // ----- Managers -----
        this.audio = new AudioManager(this);
        this.director = new DirectorAI(this);
        this.hud = new HUDManager(this);
        this.shop = new ShopManager(this);
        this.harvest = new HarvestManager(this);

        // ----- Input -----
        this.setupInputHandlers();
        this.setupEventBus();
        this.bindSettingsToggles();

        // Floating text group (plain text objects, manually recycled)
        this.floatTexts = [];
    }

    // ---------- Event wiring ----------
    setupEventBus() {
        eventBus.on('GAME_START', () => this.onGameStart());
        eventBus.on('PAUSE_GAME', () => this.onPauseGame());
        eventBus.on('RESUME_GAME', () => this.onResumeGame());
        eventBus.on('WAVE_CLEARED', (d) => this.onWaveCleared(d));
        eventBus.on('RETURN_TO_BATTLEFIELD', () => this.onReturnToBattlefield());
        eventBus.on('PLAYER_DIED', () => this.onPlayerDied());
        eventBus.on('MUTATION_CHOSEN', () => this.onMutationChosen());
    }

    onGameStart() {
        // Reset run-scoped state
        GameState.gameActive = true;
        GameState.isPaused = false;
        GameState.inShop = false;
        GameState.inHarvest = false;
        GameState.wave = 1;
        GameState.hp = GameState.maxHp;
        GameState.armor = 0;
        GameState.funds = 0;
        GameState.grenades = 0;
        GameState.combo = 0;
        GameState.kills = 0;
        GameState.primaryWeapon = 0;
        GameState.secondaryWeapon = null;
        GameState.activeSlot = 'primary';
        GameConfig.weapons.forEach((wpn, idx) => { GameState.ammo[idx] = wpn.magSize; });

        this.player.respawn();
        this.physics.world.resume();
        this.hud.show();
        // Phase 2: freeze before first wave until the player acknowledges the transmission
        this.showTutorialGate(GameState.wave, () => {
            this.director.startWave(GameState.wave);
        });
    }

    onPauseGame() {
        GameState.isPaused = true;
        this.physics.world.pause();
    }

    onResumeGame() {
        GameState.isPaused = false;
        this.physics.world.resume();
    }

    // onWaveCleared(detail) — director reports all enemies dead
    onWaveCleared(detail) {
        // Wave-end payout + venture interest
        this.applyWaveEndEconomy();
        const isBossWave = GameState.wave % 10 === 0;
        if (isBossWave) {
            this.hud.showTransmission(FlavorText.bossDefeated);
            this.hud.hideBossBar();
        } else {
            this.hud.flashWaveClear();
        }

        const delay = isBossWave ? 3500 : 1400;

        // Every 5 waves => harvest; otherwise => shop
        if (GameState.wave % 5 === 0) {
            this.time.delayedCall(delay, () => {
                GameState.inHarvest = true;
                this.onPauseGame();
                this.harvest.open();
            });
        } else {
            this.time.delayedCall(delay, () => {
                GameState.inShop = true;
                this.onPauseGame();
                this.shop.open();
            });
        }
    }

    onMutationChosen() {
        // After harvest, go to shop unless this was a checkpoint we skip
        GameState.inHarvest = false;
        GameState.inShop = true;
        this.shop.open();
    }

    onReturnToBattlefield() {
        GameState.inShop = false;
        GameState.inHarvest = false;
        GameState.wave += 1;
        eventBus.emit('WAVE_STARTED', { wave: GameState.wave });
        this.onResumeGame();
        // Phase 2: gate the new wave behind tutorial acknowledgment
        this.showTutorialGate(GameState.wave, () => {
            this.director.startWave(GameState.wave);
        });
    }

    onPlayerDied() {
        GameState.gameActive = false;
        this.physics.world.pause();
        this.hud.hide();
        const title = document.getElementById('game-over-title');
        const stats = document.getElementById('game-over-stats');
        if (title) title.textContent = FlavorText.gameOver.titleDead;
        if (stats) stats.textContent = `${FlavorText.gameOver.survived} ${GameState.wave} WAVES`;
        this.showModal('screen-game-over');
    }

    // ---------- Economy ----------
    applyWaveEndEconomy() {
        // Compound Interest venture (unlocks wave 25)
        const interestLvl = GameState.ventureInvestments['interest'] || 0;
        if (interestLvl > 0) {
            const old = GameState.funds;
            const interest = Math.floor(GameState.funds * GameConfig.venture.interestRate * interestLvl);
            GameState.funds += interest;
            eventBus.emit('FUNDS_CHANGED', { new: GameState.funds, old });
        }
    }

    addFunds(amount) {
        const old = GameState.funds;
        GameState.funds += amount;
        eventBus.emit('FUNDS_CHANGED', { new: GameState.funds, old });
    }

    // ---------- Combat callbacks ----------
    onProjectileHitEnemy(proj, enemy) {
        if (!proj.active || !enemy.active || enemy.invulnerable) return;
        const stats = proj.stats;
        let dmg = proj.damage;
        let crit = false;
        if (Phaser.Math.Between(1, 100) <= (stats.critChance || 0)) {
            dmg = dmg * (stats.critMult || 1);
            crit = true;
        }
        enemy.takeDamage(dmg, crit, proj.dirX, proj.dirY);

        // Mutation: Bitch Splinters — crit causes shrapnel burst
        if (crit && GameState.mutations.includes('Bitch Splinters')) {
            this.shrapnelBurst(enemy.x, enemy.y, dmg * GameConfig.mutations['Bitch Splinters'].damageFraction);
        }

        if (!stats.pierce) {
            proj.despawn();
        } else {
            proj.pierceCount = (proj.pierceCount || 0) + 1;
            if (proj.pierceCount > 2) proj.despawn();
        }
    }

    onGrenadeHitEnemy(gren, enemy) {
        if (!gren.active) return;
        gren.detonate();
    }

    onPlayerHitByEnemy(player, enemy) {
        if (!enemy.active || enemy.invulnerable) return;
        if (this.player.invulnTimer > 0) return;

        this.player.takeDamage(enemy.contactDamage);

        // Knock the attacker back rather than deleting it (tanks/bosses survive contact)
        const ang = Phaser.Math.Angle.Between(this.player.x, this.player.y, enemy.x, enemy.y);
        enemy.x += Math.cos(ang) * 30;
        enemy.y += Math.sin(ang) * 30;
    }

    onPlayerCollectCoin(player, coin) {
        if (!coin.active) return;
        // Inflation Hedge venture multiplier
        const inflationLvl = GameState.ventureInvestments['inflation'] || 0;
        const value = Math.floor(coin.value * (1 + GameConfig.venture.inflationMult * inflationLvl));
        this.addFunds(value);

        // Mutation: Scavenger — coin pickup grants speed + brief immunity
        if (GameState.mutations.includes('Scavenger')) {
            this.player.grantScavengerBuff();
        }
        coin.despawn();
    }

    // onPlayerHitByAcid — Phase 5: spitter glob hits the player
    onPlayerHitByAcid(player, acid) {
        if (!acid.active) return;
        acid.splash();
        if (this.player.invulnTimer > 0) return;
        this.player.takeDamage(GameConfig.mobs.spitter.spitDamage);
    }

    // onPlayerCollectCrate — Phase 6: pick up a supply drop mid-horde
    onPlayerCollectCrate(player, crate) {
        if (!crate.active) return;
        crate.open();
    }

    // onEnemyHitBarricade — Phase 5: enemies grind down barricades on contact
    onEnemyHitBarricade(enemy, barricade) {
        if (!enemy.active || !barricade.active) return;
        if (enemy.invulnerable) return;
        barricade.takeDamage(1);
        const ang = Phaser.Math.Angle.Between(barricade.x, barricade.y, enemy.x, enemy.y);
        enemy.x += Math.cos(ang) * 6;
        enemy.y += Math.sin(ang) * 6;
    }

    // ---------- Helpers ----------
    spawnProjectile(x, y, vx, vy, damage, stats, dirX, dirY) {
        const proj = this.projectilePool.get();
        if (!proj) return;
        proj.fire(x, y, vx, vy, damage, stats, dirX, dirY);
    }

    spawnCoin(x, y, value) {
        const coin = this.coinGroup.get();
        if (!coin) return;
        coin.drop(x, y, value);
    }

    shrapnelBurst(x, y, dmg) {
        const cfg = GameConfig.mutations['Bitch Splinters'];
        const stats = { critChance: 0, critMult: 1, pierce: false, range: cfg.range };
        for (let i = 0; i < cfg.shards; i++) {
            const ang = (Math.PI * 2 / cfg.shards) * i;
            this.spawnProjectile(x, y, Math.cos(ang) * cfg.speed, Math.sin(ang) * cfg.speed,
                dmg, stats, Math.cos(ang), Math.sin(ang));
        }
    }

    explode(x, y, radius, damage) {
        // Mutation: Chain Reaction — chance for over-performing explosion
        let dmg = damage;
        const cr = GameConfig.mutations['Chain Reaction'];
        if (GameState.mutations.includes('Chain Reaction') && Phaser.Math.Between(1, 100) <= cr.chance) {
            dmg = damage * cr.damageMult;
        }
        const fx = this.add.circle(x, y, radius, 0xff8a00, 0.5).setDepth(20);
        this.tweens.add({ targets: fx, alpha: 0, scale: 1.3, duration: 250, onComplete: () => fx.destroy() });
        if (GameState.screenShake) this.cameras.main.shake(120, 0.012);
        eventBus.emit('EXPLOSION', { x, y, radius });

        this.enemyGroup.getChildren().forEach(e => {
            if (!e.active || e.invulnerable) return;
            const d = Phaser.Math.Distance.Between(x, y, e.x, e.y);
            if (d <= radius) {
                e.lastDeathWasExplosion = true; // Phase 4: Spare Change explosion-kill gating
                this.floatingText(e.x, e.y - 20, Math.round(dmg), '#ff6b35');
                e.takeDamage(dmg, false, 0, 1);
            }
        });
    }

    floatingText(x, y, msg, color) {
        const t = this.add.text(x, y, msg, {
            fontFamily: 'Share Tech Mono, monospace',
            fontSize: '18px',
            color: color || '#ffffff'
        }).setOrigin(0.5).setDepth(50);
        this.tweens.add({
            targets: t, y: y - 40, alpha: 0, duration: 600,
            onComplete: () => t.destroy()
        });
    }

    // bloodSplat(x, y, dirX, dirY) — Phase 1: directional red spray at enemy center
    bloodSplat(x, y, dirX, dirY) {
        const fx = GameConfig.fx;
        const count = Phaser.Math.Between(fx.bloodYieldMin, fx.bloodYieldMax) || fx.splatCount;
        const hasDir = (dirX !== undefined && dirY !== undefined && (dirX !== 0 || dirY !== 0));
        for (let i = 0; i < count; i++) {
            const scale = Phaser.Math.FloatBetween(fx.splatScaleMin, fx.splatScaleMax);
            const r = (fx.splatRadius || 3) * scale;
            const splat = this.add.circle(x, y, r, 0xaa0000, 0.7).setDepth(19);
            const baseAng = hasDir ? Math.atan2(dirY, dirX) : Phaser.Math.FloatBetween(0, Math.PI * 2);
            const ang = baseAng + Phaser.Math.FloatBetween(-0.6, 0.6);
            const spd = fx.arterialSpraySpeed * Phaser.Math.FloatBetween(0.3, 1.0) / 60;
            const dist = spd * (fx.splatFadeDuration / 16);
            this.tweens.add({
                targets: splat,
                x: x + Math.cos(ang) * dist,
                y: y + Math.sin(ang) * dist,
                alpha: 0, scale: 0.4,
                duration: fx.splatFadeDuration, ease: 'Quad.easeOut',
                onComplete: () => splat.destroy()
            });
        }
    }

    // ejectCasings(x, y, fireAng, dual) — Phase 1: brass to the right (both sides if dual-wield)
    ejectCasings(x, y, fireAng, dual) {
        const fx = GameConfig.fx;
        const sides = dual ? [1, -1] : [1];
        sides.forEach(side => {
            const perp = fireAng + (Math.PI / 2) * side;
            for (let i = 0; i < (fx.casingCount || 2); i++) {
                const casing = this.add.rectangle(x, y, 2, 6, 0xccaa00, 0.9)
                    .setDepth(17).setRotation(Phaser.Math.FloatBetween(0, Math.PI * 2));
                const ejVx = Math.cos(perp) * fx.casingVelocityX * Phaser.Math.FloatBetween(0.6, 1.2);
                const ejVy = Math.sin(perp) * fx.casingVelocityX * Phaser.Math.FloatBetween(0.6, 1.2) + fx.casingVelocityY;
                const dur = fx.casingFadeDuration;
                const landX = x + ejVx * (dur / 1000);
                const landY = y + ejVy * (dur / 1000) + fx.casingGravity * (dur / 100);
                this.tweens.add({
                    targets: casing, x: landX, y: landY,
                    rotation: casing.rotation + Phaser.Math.FloatBetween(-6, 6),
                    duration: dur, ease: 'Quad.easeIn'
                });
                this.tweens.add({
                    targets: casing, alpha: 0, duration: dur * 0.4, delay: dur * 0.6,
                    onComplete: () => casing.destroy()
                });
            }
        });
    }

    showTutorial(wave) {
        const msg = FlavorText.tutorials[wave];
        if (!msg) return;
        this.hud.showTransmission(msg);
    }

    // showTutorialGate(wave, onDismiss) — Phase 2: freeze the wave until the player
    // acknowledges the transmission. No tutorial for this wave => start immediately.
    showTutorialGate(wave, onDismiss) {
        const msg = FlavorText.tutorials[wave];
        if (!msg) { onDismiss(); return; }
        GameState.tutorialPending = true;
        this.hud.showTutorialGate(msg, () => {
            GameState.tutorialPending = false;
            onDismiss();
        });
    }

    // ---------- DOM modal handling ----------
    setupInputHandlers() {
        const click = (id, fn) => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('click', fn);
        };

        click('btn-new-game', () => { this.hideAllModals(); eventBus.emit('GAME_START'); });
        click('btn-restart', () => { this.hideAllModals(); eventBus.emit('GAME_START'); });
        click('btn-resume', () => { this.hideAllModals(); eventBus.emit('RESUME_GAME'); });
        click('btn-open-settings', () => this.showModal('screen-settings'));
        click('btn-settings', () => this.showModal('screen-settings'));
        click('btn-close-settings', () => {
            this.hideAllModals();
            if (GameState.gameActive && !GameState.inShop && !GameState.inHarvest) {
                eventBus.emit('RESUME_GAME');
            } else if (GameState.inShop) {
                this.shop.open();
            } else if (GameState.inHarvest) {
                this.harvest.open();
            }
        });
    }

    bindSettingsToggles() {
        const toggle = (id, key, onLabel, offLabel) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('click', () => {
                GameState[key] = !GameState[key];
                el.textContent = GameState[key] ? (onLabel || 'ON') : (offLabel || 'OFF');
                if (key === 'virtualGamepad') this.hud.setGamepadVisible(GameState[key]);
                if (key === 'devOverrides') this.hud.setDevPanelVisible(GameState[key]);
            });
        };
        toggle('tog-controls', 'virtualGamepad');
        toggle('tog-shake', 'screenShake');
        toggle('tog-dev', 'devOverrides');
    }

    showModal(modalId) {
        this.hideAllModals();
        const el = document.getElementById(modalId);
        if (el) el.classList.add('active');
        if (GameState.gameActive && !GameState.inShop && !GameState.inHarvest) {
            eventBus.emit('PAUSE_GAME');
        }
    }

    hideAllModals() {
        document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
    }

    // ---------- Main loop ----------
    update(time, delta) {
        if (!GameState.gameActive || GameState.isPaused) return;

        this.player.tick(time, delta);
        this.director.tick(time, delta);
        GameState.defenses.forEach(d => d.entity && d.entity.tick && d.entity.tick(time, delta));
    }
}

// ========== ENTITY CLASSES ==========

// ---- Player ----
class Player extends Phaser.GameObjects.Image {
    constructor(scene, x, y) {
        super(scene, x, y, 'player');
        this.scene = scene;
        this.setDepth(30);
        this.setScale(GameConfig.player.playerScale);
        this.invulnTimer = 0;
        this.lastFire = 0;
        this.scavengerTimer = 0;
        this.payItForwardTimer = 0; // Phase 4: Pay It Forward buff window
        this.moveX = 0;
        this.moveY = 0;

        this.keys = scene.input.keyboard.addKeys('W,A,S,D,R,F,Q');
        scene.input.on('pointerdown', (p) => this.onPointerDown(p));
        scene.input.keyboard.on('keydown-R', () => this.reload());
        scene.input.keyboard.on('keydown-F', () => this.throwGrenade());
        scene.input.keyboard.on('keydown-Q', () => this.swapWeapon());
        scene.input.keyboard.on('keydown-ESC', () => this.scene.showModal('screen-pause'));
    }

    respawn() {
        const cam = this.scene.cameras.main;
        this.setPosition(cam.centerX, cam.height - 120);
        this.invulnTimer = 0;
        this.setVisible(true).setActive(true);
        if (this.body) this.body.enable = true;
    }

    grantScavengerBuff() { this.scavengerTimer = GameConfig.mutations['Scavenger'].immunityMs; }

    onPointerDown(pointer) {
        if (!GameState.gameActive || GameState.isPaused) return;
        if (pointer.leftButtonDown && pointer.event && pointer.event.target &&
            pointer.event.target.tagName === 'CANVAS') {
            this.firing = true;
        }
    }

    tick(time, delta) {
        if (this.invulnTimer > 0) this.invulnTimer -= delta;
        if (this.scavengerTimer > 0) this.scavengerTimer -= delta;
        if (this.payItForwardTimer > 0) this.payItForwardTimer -= delta;

        if (GameState.tutorialPending) { this.body.setVelocity(0, 0); return; }

        // --- Movement ---
        let speed = GameConfig.player.baseSpeed;
        if (this.scavengerTimer > 0) speed *= GameConfig.mutations['Scavenger'].speedMult; // Scavenger speed boost
        let dx = 0, dy = 0;
        if (this.keys.A.isDown) dx -= 1;
        if (this.keys.D.isDown) dx += 1;
        if (this.keys.W.isDown) dy -= 1;
        if (this.keys.S.isDown) dy += 1;

        // Virtual gamepad joystick overrides
        if (GameState.virtualGamepad && this.scene.hud.joyVector) {
            dx = this.scene.hud.joyVector.x;
            dy = this.scene.hud.joyVector.y;
        }

        const len = Math.hypot(dx, dy);
        if (len > 0) { dx /= len; dy /= len; }
        this.moveX = dx; this.moveY = dy;
        this.body.setVelocity(dx * speed, dy * speed);

        // --- Aim ---
        if (GameState.virtualGamepad) {
            if (len > 0) this.rotation = Math.atan2(dy, dx) + Math.PI / 2;
        } else {
            const ptr = this.scene.input.activePointer;
            this.rotation = Phaser.Math.Angle.Between(this.x, this.y, ptr.worldX, ptr.worldY) + Math.PI / 2;
        }

        // --- Fire ---
        const ptr = this.scene.input.activePointer;
        const wantFire = (ptr.isDown && ptr.leftButtonDown && this.firing) ||
            (GameState.virtualGamepad && this.scene.hud.firePressed);
        if (wantFire) this.tryFire(time);
        if (!ptr.isDown) this.firing = false;
    }

    tryFire(time) {
        if (GameState.isReloading || GameState.tutorialPending) return;
        const wpnId = activeWeaponId();
        const stats = getModifiedStats(wpnId);

        if (GameState.ammo[wpnId] <= 0) { this.reload(); return; }

        // Phase 4: Pay It Forward — flat damage bonus while the barricade-hit buff is active
        if (GameState.mutations.includes('Pay It Forward') && this.payItForwardTimer > 0) {
            stats.damage = stats.damage + GameConfig.mutations['Pay It Forward'].damageBonus;
        }

        // Mutation: Heavy Boots — accelerated fire rate when standing still
        let rate = stats.rate;
        if (GameState.mutations.includes('Heavy Boots') && this.moveX === 0 && this.moveY === 0) {
            rate *= GameConfig.mutations['Heavy Boots'].fireRateMult;
        }
        if (time - this.lastFire < rate) return;
        this.lastFire = time;

        GameState.ammo[wpnId] -= 1;
        eventBus.emit('AMMO_CHANGED', { wpnId, ammo: GameState.ammo[wpnId] });

        const baseAngle = this.rotation - Math.PI / 2;
        const multi = Math.max(1, Math.round(stats.multi));
        for (let i = 0; i < multi; i++) {
            const spreadRad = Phaser.Math.DegToRad(stats.spread);
            const offset = multi > 1
                ? Phaser.Math.Linear(-spreadRad, spreadRad, i / (multi - 1))
                : Phaser.Math.FloatBetween(-spreadRad / 2, spreadRad / 2);
            const ang = baseAngle + offset;
            const vx = Math.cos(ang) * stats.speed;
            const vy = Math.sin(ang) * stats.speed;
            this.scene.spawnProjectile(this.x, this.y, vx, vy, stats.damage, stats, Math.cos(ang), Math.sin(ang));
        }

        if (GameState.screenShake && stats.camShake) {
            this.scene.cameras.main.shake(60, stats.camShake);
        }

        // Phase 1: shell casings eject to the right (both sides if dual-wield)
        const isDual = stats.pattern === 'parallel';
        this.scene.ejectCasings(this.x, this.y, baseAngle, isDual);

        // Phase 7: audio (silent until .mp3s exist)
        eventBus.emit('WEAPON_FIRED', {
            audioKey: stats.audioKey, audioVol: stats.audioVol, pitchVariance: stats.pitchVariance
        });

        if (GameState.ammo[wpnId] <= 0) this.reload();
    }

    reload() {
        const wpnId = activeWeaponId();
        const stats = getModifiedStats(wpnId);
        if (GameState.isReloading || GameState.ammo[wpnId] >= Math.round(stats.magSize)) return;
        GameState.isReloading = true;
        eventBus.emit('RELOAD_START', { wpnId });
        this.scene.time.delayedCall(stats.reloadTime, () => {
            GameState.ammo[wpnId] = Math.round(stats.magSize);
            GameState.isReloading = false;
            eventBus.emit('AMMO_CHANGED', { wpnId, ammo: GameState.ammo[wpnId] });
        });
    }

    throwGrenade() {
        if (!GameState.gameActive || GameState.isPaused) return;
        if (GameState.grenades <= 0) return;
        GameState.grenades -= 1;
        eventBus.emit('GRENADES_CHANGED', { grenades: GameState.grenades });
        const ang = this.rotation - Math.PI / 2;
        const g = this.scene.grenadeGroup.get();
        if (g) g.launch(this.x, this.y, Math.cos(ang) * GameConfig.combat.grenadeSpeed, Math.sin(ang) * GameConfig.combat.grenadeSpeed);
    }

    swapWeapon() {
        if (GameState.secondaryWeapon === null) return;
        GameState.activeSlot = GameState.activeSlot === 'primary' ? 'secondary' : 'primary';
        eventBus.emit('WEAPON_SWAPPED', { slot: GameState.activeSlot, wpnId: activeWeaponId() });
    }

    takeDamage(power) {
        if (this.invulnTimer > 0 || GameState.godMode) return;
        const old = GameState.hp;

        // Pay It Forward / armor absorbs first
        if (GameState.armor > 0) {
            GameState.armor -= 1;
            eventBus.emit('ARMOR_CHANGED', { new: GameState.armor, old: GameState.armor + 1 });
        } else {
            GameState.hp -= 1;
            eventBus.emit('PLAYER_HIT', { new: GameState.hp, old });
        }

        this.invulnTimer = GameConfig.combat.hitInvulnMs;
        this.scene.tweens.add({ targets: this, alpha: 0.3, duration: 100, yoyo: true, repeat: 3,
            onComplete: () => this.setAlpha(1) });

        if (GameState.hp <= 0) eventBus.emit('PLAYER_DIED');
    }
}

// ---- Projectile ----
class Projectile extends Phaser.GameObjects.Image {
    constructor(scene, x, y) {
        super(scene, x, y, 'bullet');
        this.setDepth(25);
        this.bornAt = 0;
    }

    fire(x, y, vx, vy, damage, stats, dirX, dirY) {
        this.setActive(true).setVisible(true);
        this.setPosition(x, y);
        this.rotation = Math.atan2(vy, vx) + Math.PI / 2;
        this.damage = damage;
        this.stats = stats;
        this.dirX = dirX; this.dirY = dirY;
        this.pierceCount = 0;
        this.maxLife = (stats.range / stats.speed) * 1000;
        this.bornAt = this.scene.time.now;
        if (this.body) {
            this.body.enable = true;
            this.body.setVelocity(vx, vy);
        }
    }

    update(time) {
        if (!this.active) return;
        if (time - this.bornAt > this.maxLife) this.despawn();
        const cam = this.scene.cameras.main;
        if (this.x < -50 || this.x > cam.width + 50 || this.y < -50 || this.y > cam.height + 50) {
            this.despawn();
        }
    }

    despawn() {
        this.setActive(false).setVisible(false);
        if (this.body) { this.body.enable = false; this.body.setVelocity(0, 0); }
    }
}

// ---- Grenade projectile ----
class GrenadeProj extends Phaser.GameObjects.Image {
    constructor(scene, x, y) {
        super(scene, x, y, 'grenade_proj');
        this.setDepth(25);
    }

    launch(x, y, vx, vy) {
        this.setActive(true).setVisible(true).setPosition(x, y);
        if (this.body) { this.body.enable = true; this.body.setVelocity(vx, vy); }
        this.scene.time.delayedCall(GameConfig.combat.grenadeFuseMs, () => { if (this.active) this.detonate(); });
    }

    detonate() {
        if (!this.active) return;
        this.scene.explode(this.x, this.y, GameConfig.combat.grenadeRadius, GameConfig.combat.grenadeDamage);
        this.despawn();
    }

    update() {
        if (this.body) this.body.setVelocity(this.body.velocity.x * 0.96, this.body.velocity.y * 0.96);
    }

    despawn() {
        this.setActive(false).setVisible(false);
        if (this.body) { this.body.enable = false; this.body.setVelocity(0, 0); }
    }
}

// ---- Acid projectile (Spitter ranged attack) ----
class AcidProjectile extends Phaser.GameObjects.Image {
    constructor(scene, x, y) {
        super(scene, x, y, 'bullet'); // reuse bullet sprite, tinted green (no dedicated acid svg)
        this.setDepth(24);
        this.bornAt = 0;
    }

    launch(x, y, vx, vy) {
        this.setActive(true).setVisible(true).setPosition(x, y);
        this.setTint(0x6ee7b7).setScale(1.8);
        this.rotation = Math.atan2(vy, vx);
        this.bornAt = this.scene.time.now;
        this.maxLife = 2500;
        if (this.body) { this.body.enable = true; this.body.setVelocity(vx, vy); }
    }

    update(time) {
        if (!this.active) return;
        if (this.body) {
            const decay = GameConfig.mobs.spitter.spitDecay;
            this.body.setVelocity(this.body.velocity.x * decay, this.body.velocity.y * decay);
        }
        if (time - this.bornAt > this.maxLife) { this.splash(); return; }
        const cam = this.scene.cameras.main;
        if (this.x < -50 || this.x > cam.width + 50 || this.y < -50 || this.y > cam.height + 50) this.despawn();
    }

    splash() {
        const fx = this.scene.add.circle(this.x, this.y, 14, 0x6ee7b7, 0.5).setDepth(16);
        this.scene.tweens.add({ targets: fx, alpha: 0, scale: 1.6, duration: 300, onComplete: () => fx.destroy() });
        this.despawn();
    }

    despawn() {
        this.setActive(false).setVisible(false);
        this.clearTint();
        if (this.body) { this.body.enable = false; this.body.setVelocity(0, 0); }
    }
}

// ---- Enemy ----
class Enemy extends Phaser.GameObjects.Image {
    constructor(scene, x, y) {
        super(scene, x, y, 'grunt');
        this.setDepth(20);
        this.invulnerable = false;
    }

    // spawn(type, wave) — configure from GameConfig.mobs or bosses
    spawn(x, y, type, wave) {
        this.type = type;
        this.isBoss = (type === 'boss');
        this.setActive(true).setVisible(true).setPosition(x, y);
        this.setTexture(this.isBoss ? 'boss' : type);
        this.invulnerable = false;
        // Phase 4: reset pooled death-cause + bounty flags
        this.lastHitWasCrit = false;
        this.lastDeathWasExplosion = false;
        this.isBounty = false;
        this.clearTint();
        // Phase 5: reset spitter cadence
        this.lastSpitAt = 0;

        if (this.isBoss) {
            const def = GameConfig.bosses[wave] || GameConfig.bosses[50];
            this.maxHp = def.hp;
            this.hp = def.hp;
            this.speed = def.speed;
            this.baseSpeed = def.speed;
            this.contactDamage = def.power;
            this.setScale(def.scale * 0.5);
            // Boss phase state
            this.phase = 1;
            this.chargeTimer = 0;
            this.chargeCooldown = 8000;
            this.addTimer = 0;
            this.addInterval = 15000;
            this.isCharging = false;
            this.isTelegraphing = false;
            this.chargeVx = 0;
            this.chargeVy = 0;
            this.chargeTimeLeft = 0;
        } else {
            const def = GameConfig.mobs[type];
            this.maxHp = def.baseHp + def.hpPerWave * (wave - 1);
            this.hp = this.maxHp;
            this.speed = def.baseSpeed + def.speedPerWave * (wave - 1);
            this.contactDamage = 1;
            this.setScale(1);
        }

        if (this.body) { this.body.enable = true; this.body.setVelocity(0, 0); }

        // Burrower: invulnerable while "digging" for first 2s
        if (type === 'burrower') {
            this.invulnerable = true;
            this.setAlpha(0.4);
            this.scene.time.delayedCall(GameConfig.combat.burrowerDigMs, () => {
                if (this.active) { this.invulnerable = false; this.setAlpha(1); }
            });
        }
    }

    update(time, delta) {
        if (!this.active) return;
        const p = this.scene.player;
        if (!p.active) { this.body.setVelocity(0, 0); return; }

        // Boss phase logic
        if (this.isBoss) {
            const hpPct = this.hp / this.maxHp;
            const ang = Phaser.Math.Angle.Between(this.x, this.y, p.x, p.y);

            // Phase transitions
            if (hpPct < 0.3 && this.phase < 3) {
                this.phase = 3;
                this.chargeCooldown = 4000;
                this.addInterval = 8000;
                this.setTint(0xff4444);
                if (GameState.screenShake) this.scene.cameras.main.flash(400, 255, 50, 50);
                this.scene.hud.showTransmission(FlavorText.bossPhase3);
            } else if (hpPct < 0.6 && this.phase < 2) {
                this.phase = 2;
                this.scene.hud.showTransmission(FlavorText.bossPhase2);
            }

            const speedMult = this.phase === 3 ? 1.5 : this.phase >= 2 ? 1.3 : 1.0;

            // Charge attack (phase 2+)
            if (this.isCharging) {
                this.chargeTimeLeft -= delta;
                if (this.chargeTimeLeft <= 0) {
                    this.isCharging = false;
                    this.clearTint();
                    if (this.phase === 3) this.setTint(0xff4444);
                }
            } else if (!this.isTelegraphing) {
                this.chargeTimer += delta;
                if (this.phase >= 2 && this.chargeTimer >= this.chargeCooldown) {
                    this.chargeTimer = 0;
                    this.isTelegraphing = true;
                    this.setTint(0xffff00);
                    this.body.setVelocity(0, 0);
                    this.scene.time.delayedCall(600, () => {
                        if (!this.active) return;
                        this.isTelegraphing = false;
                        this.isCharging = true;
                        this.chargeTimeLeft = 800;
                        const cAng = Phaser.Math.Angle.Between(this.x, this.y, p.x, p.y);
                        this.chargeVx = Math.cos(cAng) * this.baseSpeed * 3;
                        this.chargeVy = Math.sin(cAng) * this.baseSpeed * 3;
                        this.clearTint();
                        if (this.phase === 3) this.setTint(0xff4444);
                    });
                }
            }

            // Add spawning
            this.addTimer += delta;
            if (this.addTimer >= this.addInterval) {
                this.addTimer = 0;
                this.scene.director.spawnAdd('grunt', this.x + Phaser.Math.Between(-60, 60), this.y + Phaser.Math.Between(-60, 60));
                if (this.phase === 3) this.scene.director.spawnAdd('grunt', this.x + Phaser.Math.Between(-60, 60), this.y + Phaser.Math.Between(-60, 60));
            }

            if (this.isCharging) {
                this.body.setVelocity(this.chargeVx, this.chargeVy);
            } else if (this.isTelegraphing) {
                this.body.setVelocity(0, 0);
            } else {
                this.body.setVelocity(Math.cos(ang) * this.speed * speedMult, Math.sin(ang) * this.speed * speedMult);
            }
            this.rotation = ang + Math.PI;
            return;
        }

        // Phase 5: Spitter — ranged kiter. Hold range, back away straight, spit on cd.
        if (this.type === 'spitter') {
            const def = GameConfig.mobs.spitter;
            const dist = Phaser.Math.Distance.Between(this.x, this.y, p.x, p.y);
            const ang = Phaser.Math.Angle.Between(this.x, this.y, p.x, p.y);
            if (dist > def.spitRange + 40) {
                this.body.setVelocity(Math.cos(ang) * this.speed, Math.sin(ang) * this.speed);
            } else if (dist < def.spitRange - 40) {
                this.body.setVelocity(-Math.cos(ang) * this.speed, -Math.sin(ang) * this.speed);
            } else {
                this.body.setVelocity(0, 0);
            }
            this.rotation = ang + Math.PI;
            if (time - (this.lastSpitAt || 0) > def.spitRate && dist <= def.spitRange + 40) {
                this.fireAcid(ang);
                this.lastSpitAt = time;
            }
            return;
        }

        const ang = Phaser.Math.Angle.Between(this.x, this.y, p.x, p.y);
        this.body.setVelocity(Math.cos(ang) * this.speed, Math.sin(ang) * this.speed);
        this.rotation = ang + Math.PI / 2;
    }

    // fireAcid(angle) — Phase 5: launch an acid glob at the player
    fireAcid(angle) {
        const def = GameConfig.mobs.spitter;
        const a = this.scene.acidGroup.get();
        if (!a) return;
        a.launch(this.x, this.y, Math.cos(angle) * def.spitSpeed, Math.sin(angle) * def.spitSpeed);
        eventBus.emit('ACID_SPIT', { x: this.x, y: this.y });
    }

    takeDamage(dmg, crit, dirX, dirY) {
        if (this.invulnerable || !this.active) return;
        this.hp -= dmg;
        this.lastHitWasCrit = !!crit; // Phase 4: Spare Change crit-kill gating
        if (this.isBoss) {
            eventBus.emit('BOSS_HIT', { hpPct: Math.max(0, this.hp / this.maxHp) });
        }
        // Explosion path prints its own orange number in explode(); skip the white one here
        if (!this.lastDeathWasExplosion) {
            this.scene.floatingText(this.x, this.y - 20, Math.round(dmg), crit ? '#ffd43b' : '#ffffff');
        }

        // Phase 1: directional blood spray at enemy center
        this.scene.bloodSplat(this.x, this.y, dirX, dirY);

        // hit flash
        this.setTint(0xff5555);
        this.scene.time.delayedCall(60, () => {
            if (!this.active) return;
            if (this.isBounty) this.setTint(GameConfig.venture.bountyTint);
            else this.clearTint();
        });

        // knockback
        if (dirX !== undefined && this.body) {
            this.x += dirX * 4; this.y += dirY * 4;
        }
        if (this.hp <= 0) this.die();
    }

    die() {
        if (!this.active) return;
        const x = this.x, y = this.y;

        // Mutation: Corpse-a-Cola — rupture on death scaling with max HP
        if (GameState.mutations.includes('Corpse-a-Cola')) {
            const cc = GameConfig.mutations['Corpse-a-Cola'];
            this.scene.explode(x, y, cc.radius, this.maxHp * cc.hpDamageMult);
        }

        // Kill accounting (combo system stubbed for v1.3 shot-accuracy implementation)
        GameState.kills += 1;
        eventBus.emit('ENEMY_DIED', { type: this.type, x, y });

        // Kill milestone popups
        const milestones = [50, 100, 250, 500, 1000];
        if (milestones.includes(GameState.kills)) {
            const msg = FlavorText.milestones[GameState.kills];
            if (msg) this.scene.hud.showTransmission(msg);
        }

        // Coin drop (tiered by enemy value; Spare Change mutation boosts on crit/explosive deaths)
        this.dropLoot(x, y);

        this.setActive(false).setVisible(false);
        if (this.body) this.body.enable = false;
        this.scene.director.notifyKill();
    }

    dropLoot(x, y) {
        const C = GameConfig.combat;

        // Phase 4: Bounty Hunter — marked grunts drop a single gold coin, nothing else
        if (this.isBounty) {
            this.scene.spawnCoin(x, y, GameConfig.venture.bountyAmount);
            return;
        }

        const tierValue = this.isBoss ? C.bossCoinValue : (GameConfig.mobs[this.type].cost * C.coinValuePerCost);
        let count = this.isBoss ? C.bossCoinCount : Phaser.Math.Between(C.mobCoinMin, C.mobCoinMax);

        // Phase 4: Spare Change — bonus coins ONLY on crit or explosion kills
        const killedByCritOrBoom = this.lastHitWasCrit || this.lastDeathWasExplosion;
        if (killedByCritOrBoom && GameState.mutations.includes('Spare Change')) {
            count += GameConfig.mutations['Spare Change'].bonusCoins;
        }

        for (let i = 0; i < count; i++) {
            let v = tierValue;
            const midasLvl = GameState.ventureInvestments['midas'] || 0;
            if (midasLvl > 0 && Phaser.Math.Between(1, 100) <= GameConfig.venture.midasChance * midasLvl) v *= GameConfig.venture.midasMult;
            this.scene.spawnCoin(x + Phaser.Math.Between(-20, 20), y + Phaser.Math.Between(-20, 20), v);
        }
    }
}

// ---- Coin ----
class Coin extends Phaser.GameObjects.Image {
    constructor(scene, x, y) {
        super(scene, x, y, 'coin');
        this.setDepth(15);
    }

    drop(x, y, value) {
        this.value = value;
        this.setActive(true).setVisible(true).setPosition(x, y);
        this.bornAt = this.scene.time.now;
        if (this.body) {
            this.body.enable = true;
            this.body.setVelocity(Phaser.Math.Between(-80, 80), Phaser.Math.Between(-80, 80));
        }
    }

    update(time) {
        if (!this.active) return;
        if (time - this.bornAt > GameConfig.player.coinLifespan) { this.despawn(); return; }
        if (this.body) {
            this.body.setVelocity(this.body.velocity.x * GameConfig.player.coinDrag,
                this.body.velocity.y * GameConfig.player.coinDrag);
        }
        // magnet toward player
        const p = this.scene.player;
        const d = Phaser.Math.Distance.Between(this.x, this.y, p.x, p.y);
        if (d < GameConfig.player.magnetRadius) {
            const ang = Phaser.Math.Angle.Between(this.x, this.y, p.x, p.y);
            this.x += Math.cos(ang) * 6;
            this.y += Math.sin(ang) * 6;
        }
    }

    despawn() {
        this.setActive(false).setVisible(false);
        if (this.body) { this.body.enable = false; this.body.setVelocity(0, 0); }
    }
}

// ---- SupplyCrate (Phase 6) ----
// Falls in, parks, self-despawns after a lifetime. Player walks into it to collect.
// Reward: health or grenades, 50/50 (energy folded into the split per design call).
class SupplyCrate extends Phaser.GameObjects.Image {
    constructor(scene, x, y) {
        super(scene, x, y, 'crate');
        this.scene = scene;
        this.setDepth(16);
    }

    spawn(x, y) {
        this.type = (Phaser.Math.Between(1, 100) <= 50) ? 'health' : 'grenade';
        this.setActive(true).setVisible(true).setPosition(x, y).setScale(1).setAlpha(1);
        this.bornAt = this.scene.time.now;
        this.parked = false;
        this.setTint(this.type === 'health' ? 0xef4444 : 0xfb923c);
        this.restY = this.scene.cameras.main.height - 260;
        if (this.body) { this.body.enable = true; this.body.setVelocity(0, GameConfig.director.crateFallSpeed); }
        eventBus.emit('CRATE_SPAWN', { x, y, type: this.type });
    }

    update(time) {
        if (!this.active) return;
        if (!this.parked && this.y >= this.restY) {
            this.parked = true;
            this.y = this.restY;
            if (this.body) this.body.setVelocity(0, 0);
        }
        const age = time - this.bornAt;
        const life = GameConfig.director.crateLifespanMs;
        if (age > life) { this.despawn(); return; }
        if (age > life - 1500) this.setAlpha(0.4 + 0.6 * Math.abs(Math.sin(age / 120)));
    }

    open() {
        if (!this.active) return;
        if (this.type === 'health') {
            const old = GameState.hp;
            GameState.hp = Math.min(GameState.maxHp, GameState.hp + 2);
            eventBus.emit('PLAYER_HIT', { new: GameState.hp, old });
            this.scene.floatingText(this.x, this.y - 20, '+2 HP', '#ef4444');
        } else {
            GameState.grenades += 3;
            eventBus.emit('GRENADES_CHANGED', { grenades: GameState.grenades });
            this.scene.floatingText(this.x, this.y - 20, '+3 NADES', '#fb923c');
        }
        eventBus.emit('CRATE_PICKUP', { type: this.type });
        this.despawn();
    }

    despawn() {
        this.setActive(false).setVisible(false);
        this.clearTint();
        if (this.body) { this.body.enable = false; this.body.setVelocity(0, 0); }
    }
}

// ---- Barricade (Layer 5 defense) ----
class Barricade extends Phaser.GameObjects.Image {
    constructor(scene, x, y, slot) {
        super(scene, x, y, 'barricade');
        this.scene = scene;
        this.setDepth(18);
        this.hp = GameConfig.defenses.barricade.hp;
        this.maxHp = this.hp;
        this.slot = (slot !== undefined) ? slot : -1;
    }

    // takeDamage(dmg) — Phase 5: lose HP, flash, trigger Pay It Forward, die at 0
    takeDamage(dmg) {
        if (this.hp <= 0) return;
        this.hp -= dmg;
        if (GameState.mutations.includes('Pay It Forward')) {
            this.scene.player.payItForwardTimer = GameConfig.mutations['Pay It Forward'].durationMs;
        }
        this.setTint(0xff5555);
        this.scene.time.delayedCall(100, () => { if (this.active) this.clearTint(); });
        this.setAlpha(0.4 + 0.6 * Math.max(0, this.hp / this.maxHp));
        if (this.hp <= 0) this.die();
    }

    die() {
        if (this.slot >= 0) GameState.barricades[this.slot] = null;
        if (this.scene.barricadeGroup) this.scene.barricadeGroup.remove(this, true, true);
        else this.destroy();
    }

    tick() {}
}

// ---- Turret (Layer 5 defense) ----
class Turret {
    constructor(scene, x, y) {
        this.scene = scene;
        this.sprite = scene.add.image(x, y, 'wpn_side_5').setDepth(19).setScale(1.2);
        this.lastFire = 0;
        const def = GameConfig.defenses.turret;
        this.range = def.range;
        this.rate = def.rate;
        this.damage = def.damage;
        this.projectileSpeed = def.projectileSpeed;
    }

    tick(time) {
        if (time - this.lastFire < this.rate) return;
        // target nearest enemy
        let target = null, best = this.range;
        this.scene.enemyGroup.getChildren().forEach(e => {
            if (!e.active) return;
            const d = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, e.x, e.y);
            if (d < best) { best = d; target = e; }
        });
        if (!target) return;
        this.lastFire = time;
        const ang = Phaser.Math.Angle.Between(this.sprite.x, this.sprite.y, target.x, target.y);
        const stats = { critChance: 0, critMult: 1, pierce: false, range: this.range, speed: this.projectileSpeed, camShake: 0 };
        this.scene.spawnProjectile(this.sprite.x, this.sprite.y,
            Math.cos(ang) * this.projectileSpeed, Math.sin(ang) * this.projectileSpeed, this.damage, stats, Math.cos(ang), Math.sin(ang));
    }
}

// ========== MANAGER CLASSES ==========

// ---- AudioManager (Phase 7) ----
// Wired but silent: events route here, playback stays dormant until .mp3 assets
// exist and `enabled` is flipped true. Keys map to GameConfig weapon audioKeys plus
// the v1.0 stubs: sfx_explosion, sfx_acid_spit, sfx_crate_spawn, sfx_crate_pickup.
class AudioManager {
    constructor(scene) {
        this.scene = scene;
        this.enabled = false;            // flip true once audio files are loaded
        this.masterVolume = GameConfig.system.masterVolume;
        this.sfxVolume = GameConfig.system.sfxVolume;
        this.bindEvents();
    }

    // preload() — call from scene.preload() when assets are ready (no-op for now)
    preload() {
        // Example wiring (left commented until files exist on GitHub Pages):
        // this.scene.load.audio('sfx_explosion', 'assets/audio/explosion.mp3');
        // this.scene.load.audio('sfx_acid_spit', 'assets/audio/acid.mp3');
        // this.scene.load.audio('sfx_crate_spawn', 'assets/audio/crate_spawn.mp3');
        // this.scene.load.audio('sfx_crate_pickup', 'assets/audio/crate_pickup.mp3');
    }

    play(key, options = {}) {
        if (!this.enabled || !key) return;
        const volume = (options.volume != null ? options.volume : 1.0) * this.masterVolume * this.sfxVolume;
        const detune = (options.pitchVariance || 0) * 1200; // semitone-ish mapping
        // Guard against missing cache entries so a partial asset set can't throw
        if (this.scene.cache && this.scene.cache.audio && !this.scene.cache.audio.has(key)) return;
        try { this.scene.sound.play(key, { volume, detune }); } catch (e) { /* dormant */ }
    }

    setMasterVolume(vol) { this.masterVolume = Math.max(0, Math.min(1, vol)); }
    setEnabled(b) { this.enabled = !!b; }

    bindEvents() {
        eventBus.on('WEAPON_FIRED', (d) => this.play(d.audioKey, { volume: d.audioVol, pitchVariance: d.pitchVariance }));
        eventBus.on('EXPLOSION', () => this.play('sfx_explosion', { volume: 0.8 }));
        eventBus.on('ACID_SPIT', () => this.play('sfx_acid_spit', { volume: 0.5 }));
        eventBus.on('CRATE_SPAWN', () => this.play('sfx_crate_spawn', { volume: 0.6 }));
        eventBus.on('CRATE_PICKUP', () => this.play('sfx_crate_pickup', { volume: 0.7 }));
        eventBus.on('ENEMY_DIED', () => this.play('sfx_enemy_die', { volume: 0.4 }));
    }
}

// ---- DirectorAI ----
class DirectorAI {
    constructor(scene) {
        this.scene = scene;
        this.spawning = false;
        this.toSpawn = 0;
        this.alive = 0;
        this.nextSpawnAt = 0;
        this.waveActive = false;
        this.nextSupplyDropAt = 0; // Phase 6: supply-crate cadence
    }

    // mobBudget(wave) — exponential budget from config
    mobBudget(wave) {
        return Math.floor(GameConfig.director.budgetBase *
            Math.pow(GameConfig.director.budgetScaling, wave));
    }

    // availableMobs(wave) — gated by design.md unlock thresholds
    availableMobs(wave) {
        const pool = ['grunt'];
        if (wave >= 3) pool.push('sprinter');
        if (wave >= 8) pool.push('spitter');
        if (wave >= 12) pool.push('tank');
        if (wave >= 15) pool.push('burrower');
        return pool;
    }

    // startWave(wave) — Phase 3: budget split into sequential phases.
    startWave(wave) {
        this.waveActive = true;
        this.alive = 0;
        this.lastPhaseType = null;
        eventBus.emit('WAVE_STARTED', { wave });
        this._previewWave(wave);

        let totalBudget = this.mobBudget(wave);
        if (wave % 10 === 0) {
            this.spawnBoss(wave);
            totalBudget = Math.floor(totalBudget * 0.5);
        }

        const phaseCount = Math.max(1, GameConfig.director.phaseCount);
        this.budgetPerPhase = Math.floor(totalBudget / phaseCount);
        this.phases = [];
        for (let i = 0; i < phaseCount; i++) {
            const pBudget = (i === phaseCount - 1)
                ? totalBudget - this.budgetPerPhase * (phaseCount - 1)
                : this.budgetPerPhase;
            this.phases.push(this.buildPhaseQueue(wave, pBudget));
        }

        this.currentPhase = 0;
        this.queue = this.phases[0].slice();
        this.toSpawn = this.phases.reduce((n, p) => n + p.length, 0);
        this.spawning = true;
        this.nextSpawnAt = this.scene.time.now + 500;
        this.nextPhaseAt = this.scene.time.now + this.phasePauseMs();
        // Phase 6: first crate window opens partway into the wave
        this.nextSupplyDropAt = this.scene.time.now + Phaser.Math.Between(
            GameConfig.director.supplyDropMin, GameConfig.director.supplyDropMax);
    }

    // phasePauseMs() — Phase 3: harder waves wait longer between phases
    phasePauseMs() {
        const d = GameConfig.director;
        const scaled = Math.min(d.phaseScaleCap, (this.budgetPerPhase / d.phaseScalePerBudget) * 1000);
        return d.phaseBasePause + scaled;
    }

    // buildPhaseQueue(wave, budget) — Phase 3: biased away from previous phase's dominant type
    buildPhaseQueue(wave, budget) {
        const pool = this.availableMobs(wave);
        const queue = [];
        const typeCounts = {};
        let spent = 0;
        let guard = 0;
        while (spent < budget && guard < 1000) {
            guard++;
            let type = Phaser.Utils.Array.GetRandom(pool);
            if (this.lastPhaseType && type === this.lastPhaseType && pool.length > 1) {
                type = Phaser.Utils.Array.GetRandom(pool);
            }
            const cost = GameConfig.mobs[type].cost;
            if (spent + cost > budget && queue.length > 0) break;
            queue.push(type);
            spent += cost;
            typeCounts[type] = (typeCounts[type] || 0) + 1;
        }
        let dom = null, domN = -1;
        Object.keys(typeCounts).forEach(t => { if (typeCounts[t] > domN) { domN = typeCounts[t]; dom = t; } });
        this.lastPhaseType = dom;
        return queue;
    }

    buildQueue(wave, budget) {
        const pool = this.availableMobs(wave);
        const queue = [];
        let spent = 0;
        let guard = 0;
        while (spent < budget && guard < 1000) {
            guard++;
            const type = Phaser.Utils.Array.GetRandom(pool);
            const cost = GameConfig.mobs[type].cost;
            if (spent + cost > budget && queue.length > 0) break;
            queue.push(type);
            spent += cost;
        }
        return queue;
    }

    spawnBoss(wave) {
        const cam = this.scene.cameras.main;
        const e = this.scene.enemyGroup.get(cam.centerX, -80);
        if (!e) return;
        e.spawn(cam.centerX, -80, 'boss', wave);
        this.alive += 1;
        if (GameState.screenShake) this.scene.cameras.main.shake(500, 0.03);
        eventBus.emit('BOSS_SPAWNED', { wave, maxHp: e.maxHp });
    }

    spawnAdd(type, x, y) {
        const e = this.scene.enemyGroup.get(x, y);
        if (!e) return;
        e.spawn(x, y, type, GameState.wave);
        this.alive += 1;
    }

    tick(time) {
        // Phase 2: director freezes entirely while paused or while a tutorial gate is up
        if (GameState.isPaused || GameState.tutorialPending) return;
        if (!this.spawning) return;

        // Phase 6: supply crate on cadence (independent of mob spawning)
        if (time >= this.nextSupplyDropAt) {
            this.spawnSupplyCrate();
            this.nextSupplyDropAt = time + Phaser.Math.Between(
                GameConfig.director.supplyDropMin, GameConfig.director.supplyDropMax);
        }

        // Phase 3: advance to next phase when its timer elapses
        if (this.currentPhase < this.phases.length - 1 && time >= this.nextPhaseAt) {
            this.currentPhase++;
            this.queue = this.queue.concat(this.phases[this.currentPhase].slice());
            this.nextPhaseAt = time + this.phasePauseMs();
        }

        // Queue drained but phases remain => idle until next phase
        if (this.queue.length === 0) {
            if (this.currentPhase >= this.phases.length - 1) { this.spawning = false; }
            return;
        }
        if (time < this.nextSpawnAt) return;

        const clump = Phaser.Math.Between(GameConfig.director.burstClumpMin, GameConfig.director.burstClumpMax);
        for (let i = 0; i < clump && this.queue.length > 0; i++) {
            const type = this.queue.shift();
            this.spawnMob(type);
        }
        this.nextSpawnAt = time + Phaser.Math.Between(
            GameConfig.director.spawnPauseMin, GameConfig.director.spawnPauseMax);
    }

    _previewWave(wave) {
        const pool = this.availableMobs(wave);
        const counts = {};
        pool.forEach(t => { counts[t] = 0; });
        const budget = Math.floor(this.mobBudget(wave) * (wave % 10 === 0 ? 0.5 : 1));
        let spent = 0, guard = 0;
        while (spent < budget && guard < 500) {
            guard++;
            const t = Phaser.Utils.Array.GetRandom(pool);
            const cost = GameConfig.mobs[t].cost;
            if (spent + cost > budget && spent > 0) break;
            counts[t] = (counts[t] || 0) + 1;
            spent += cost;
        }
        const parts = Object.entries(counts).filter(([, n]) => n > 0)
            .map(([t, n]) => `${t.toUpperCase()}S ×${n}`);
        if (wave % 10 === 0) parts.unshift('BOSS');
        const msg = `${FlavorText.incoming}: ${parts.join(' · ')}`;
        this.scene.hud.showTransmission(msg);
    }

    // spawnSupplyCrate() — Phase 6: drop a stationary crate at a random road X
    spawnSupplyCrate() {
        const cam = this.scene.cameras.main;
        const roadWidth = 500;
        const x = cam.centerX + Phaser.Math.Between(-roadWidth / 2 + 40, roadWidth / 2 - 40);
        const crate = this.scene.crateGroup.get();
        if (!crate) return;
        crate.spawn(x, -40);
    }

    spawnMob(type) {
        const cam = this.scene.cameras.main;
        const roadWidth = 500;
        const x = cam.centerX + Phaser.Math.Between(-roadWidth / 2 + 30, roadWidth / 2 - 30);
        const y = -40;
        const e = this.scene.enemyGroup.get(x, y);
        if (!e) return;
        e.spawn(x, y, type, GameState.wave);

        // Phase 4: Bounty Hunter venture — mark a fraction of grunts as gold-bearing
        const bountyLvl = GameState.ventureInvestments['bounty'] || 0;
        if (type === 'grunt' && bountyLvl > 0 &&
            Phaser.Math.Between(1, 100) <= GameConfig.venture.bountyChance) {
            e.isBounty = true;
            e.setTint(GameConfig.venture.bountyTint);
        }
        this.alive += 1;
    }

    notifyKill() {
        this.alive -= 1;
        if (this.alive <= 0 && !this.spawning && this.queue.length === 0) {
            this.waveActive = false;
            eventBus.emit('WAVE_CLEARED', { wave: GameState.wave });
        }
    }

    // Dev tool: KILL ALL
    killAll() {
        this.scene.enemyGroup.getChildren().forEach(e => { if (e.active) e.die(); });
        this.queue = [];
        this.spawning = false;
    }
}

// ---- HUDManager (DOM-injected; index.html untouched) ----
class HUDManager {
    constructor(scene) {
        this.scene = scene;
        this.joyVector = null;
        this.firePressed = false;
        this.root = document.getElementById('hud-root');
        this.gamepad = document.getElementById('hud-gamepad');
        this.devPanel = document.getElementById('hud-dev');
        this.wireGamepad();
        this.buildDevButtons();
        this.bindEvents();
    }

    // wireGamepad() — attach touch handlers to the static gamepad markup in index.html
    wireGamepad() {
        const base = document.getElementById('joy-base');
        const stick = document.getElementById('joy-stick');
        const fire = document.getElementById('btn-fire');
        const bomb = document.getElementById('btn-bomb');
        if (!base) return;

        const setJoy = (e) => {
            const r = base.getBoundingClientRect();
            const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
            const t = e.touches ? e.touches[0] : e;
            let dx = t.clientX - cx, dy = t.clientY - cy;
            const max = r.width / 2;
            const d = Math.hypot(dx, dy);
            if (d > max) { dx = dx / d * max; dy = dy / d * max; }
            stick.style.left = (35 + dx) + 'px';
            stick.style.top = (35 + dy) + 'px';
            this.joyVector = { x: dx / max, y: dy / max };
        };
        const resetJoy = () => { this.joyVector = { x: 0, y: 0 }; stick.style.left = '35px'; stick.style.top = '35px'; };
        base.addEventListener('touchstart', setJoy);
        base.addEventListener('touchmove', setJoy);
        base.addEventListener('touchend', resetJoy);
        fire.addEventListener('touchstart', () => { this.firePressed = true; });
        fire.addEventListener('touchend', () => { this.firePressed = false; });
        bomb.addEventListener('touchstart', () => this.scene.player.throwGrenade());
    }

    // buildDevButtons() — inject FlavorText-labelled admin buttons into #hud-dev
    buildDevButtons() {
        const mk = (label, fn) => {
            const b = document.createElement('button');
            b.textContent = label;
            b.addEventListener('click', fn);
            this.devPanel.appendChild(b);
            return b;
        };
        mk(FlavorText.dev.godMode + ' OFF', (e) => {
            GameState.godMode = !GameState.godMode;
            e.target.textContent = FlavorText.dev.godMode + (GameState.godMode ? ' ON' : ' OFF');
        });
        mk(FlavorText.dev.funds, () => this.scene.addFunds(10000));
        mk(FlavorText.dev.unlockWeapons, () => {
            GameConfig.weapons.forEach((w, i) => { if (!GameState.unlockedWeapons.includes(i)) GameState.unlockedWeapons.push(i); });
        });
        mk(FlavorText.dev.skipWave, () => this.scene.director.killAll());
    }

    bindEvents() {
        const $ = (id) => document.getElementById(id);
        eventBus.on('WAVE_STARTED', (d) => {
            $('hud-wave').textContent = `${FlavorText.hud.wave} ${d.wave}`;
            this.refreshAll();
            this.resetWaveProgress();
        });
        eventBus.on('FUNDS_CHANGED', (d) => {
            $('hud-funds').textContent = '$' + d.new.toLocaleString();
        });
        eventBus.on('PLAYER_HIT', () => this.refreshHP());
        eventBus.on('ARMOR_CHANGED', () => this.refreshArmor());
        eventBus.on('GRENADES_CHANGED', () => this.refreshGrenades());
        eventBus.on('AMMO_CHANGED', () => this.refreshWeapon());
        eventBus.on('WEAPON_SWAPPED', () => this.refreshWeapon());
        eventBus.on('WEAPON_EQUIPPED', () => this.refreshWeapon());
        eventBus.on('RELOAD_START', () => {
            $('hud-ammo').textContent = 'RELOAD...';
            const bar = $('hud-reload-bar');
            if (bar) {
                bar.style.animation = 'none';
                bar.style.width = '0%';
                const wpnId = activeWeaponId();
                const ms = getModifiedStats(wpnId).reloadTime;
                requestAnimationFrame(() => {
                    bar.style.animation = `reloadSweep ${ms}ms linear forwards`;
                });
            }
        });
        eventBus.on('ENEMY_DIED', () => this.updateWaveProgress());
        eventBus.on('BOSS_SPAWNED', (d) => this.showBossBar(d));
        eventBus.on('BOSS_HIT', (d) => this.updateBossBar(d));
    }

    refreshAll() {
        this.refreshHP(); this.refreshArmor(); this.refreshGrenades(); this.refreshWeapon();
        document.getElementById('hud-funds').textContent = '$' + GameState.funds.toLocaleString();
    }
    refreshHP() {
        const filled = Math.max(0, GameState.hp);
        const empty = Math.max(0, GameState.maxHp - filled);
        document.getElementById('hud-hp').textContent = '♥'.repeat(filled) + '♡'.repeat(empty);
    }
    refreshArmor() {
        const el = document.getElementById('hud-armor');
        el.textContent = GameState.armor > 0 ? '▮'.repeat(GameState.armor) + '▯'.repeat(Math.max(0, GameState.maxArmor - GameState.armor)) : '';
    }
    refreshGrenades() {
        document.getElementById('hud-grenades').textContent = GameState.grenades > 0 ? `⬡ ×${GameState.grenades}` : '';
    }
    refreshWeapon() {
        const wpnId = activeWeaponId();
        const wpn = GameConfig.weapons[wpnId];
        document.getElementById('hud-wpn-name').textContent = wpn.name;
        document.getElementById('hud-ammo').textContent = GameState.isReloading ? 'RELOAD...' : `${GameState.ammo[wpnId]} / ${Math.round(getModifiedStats(wpnId).magSize)}`;
    }

    resetWaveProgress() {
        const bar = document.getElementById('hud-wave-progress');
        if (bar) bar.style.width = '100%';
        this._waveTotal = this.scene.director ? this.scene.director.toSpawn + this.scene.director.alive : 1;
        this._waveKilled = 0;
    }
    updateWaveProgress() {
        this._waveKilled = (this._waveKilled || 0) + 1;
        const total = Math.max(1, this._waveTotal || 1);
        const pct = Math.max(0, 100 - Math.round((this._waveKilled / total) * 100));
        const bar = document.getElementById('hud-wave-progress');
        if (bar) bar.style.width = pct + '%';
    }

    showBossBar(d) {
        const el = document.getElementById('hud-boss-bar');
        if (el) el.style.display = 'block';
        document.getElementById('hud-boss-hp-fill').style.width = '100%';
    }
    updateBossBar(d) {
        const fill = document.getElementById('hud-boss-hp-fill');
        if (fill) fill.style.width = Math.max(0, Math.round(d.hpPct * 100)) + '%';
    }
    hideBossBar() {
        const el = document.getElementById('hud-boss-bar');
        if (el) el.style.display = 'none';
    }

    showTransmission(msg) {
        const t = document.getElementById('hud-transmission');
        t.textContent = msg;
        t.style.display = 'block';
        clearTimeout(this._txTimer);
        this._txTimer = setTimeout(() => { t.style.display = 'none'; }, 8000);
    }

    // showTutorialGate — full-screen modal that blocks all gameplay until acknowledged
    showTutorialGate(msg, onDismiss) {
        const modal = document.getElementById('screen-tutorial');
        const msgEl = document.getElementById('tutorial-msg');
        const waveEl = document.getElementById('tutorial-wave-label');
        const btn = document.getElementById('btn-tutorial-ack');
        if (!modal) { onDismiss(); return; }

        waveEl.textContent = `WAVE ${this.scene.constructor ? '' : ''}TRANSMISSION`;
        msgEl.textContent = msg;
        modal.classList.add('active');

        this._gateDone = false;
        const dismiss = () => {
            if (this._gateDone) return;
            this._gateDone = true;
            window.removeEventListener('keydown', onKey);
            modal.classList.remove('active');
            onDismiss();
        };
        const onKey = (e) => { if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); dismiss(); } };

        btn.onclick = dismiss;
        window.addEventListener('keydown', onKey);
    }

    flashWaveClear() {
        const t = document.getElementById('hud-transmission');
        t.textContent = FlavorText.waveClear;
        t.style.display = 'block';
        setTimeout(() => { t.style.display = 'none'; }, 1300);
    }

    show() {
        this.root.style.display = 'block';
        this.refreshAll();
        document.getElementById('hud-wave').textContent = `${FlavorText.hud.wave} ${GameState.wave}`;
        this.hideBossBar();
        this._waveTotal = 1; this._waveKilled = 0;
    }
    hide() { this.root.style.display = 'none'; }
    setGamepadVisible(v) { this.gamepad.style.display = v ? 'block' : 'none'; if (v) this.joyVector = { x: 0, y: 0 }; }
    setDevPanelVisible(v) { this.devPanel.style.display = v ? 'flex' : 'none'; }
}

// ---- ShopManager (wires the static #screen-shop modal in index.html) ----
class ShopManager {
    constructor(scene) {
        this.scene = scene;
        this.activeTab = 'firearms';
        this.selectedWeapon = 0;
        this.modal = document.getElementById('screen-shop');
        this.body = document.getElementById('shop-body');
        this.wire();
    }

    wire() {
        this.modal.querySelectorAll('.shop-tab').forEach(b => {
            b.addEventListener('click', () => { this.activeTab = b.dataset.tab; this.render(); });
        });
        document.getElementById('btn-return-battlefield').addEventListener('click', () => {
            this.close();
            eventBus.emit('RETURN_TO_BATTLEFIELD');
        });
    }

    open() { this.scene.hideAllModals(); this.modal.classList.add('active'); this.render(); }
    close() { this.modal.classList.remove('active'); }

    render() {
        const body = this.body;
        body.innerHTML = `<div class="shop-funds">FUNDS: $${GameState.funds.toLocaleString()}</div>`;
        if (this.activeTab === 'firearms') this.renderFirearms(body);
        else if (this.activeTab === 'logistics') this.renderLogistics(body);
        else this.renderVenture(body);
    }

    renderFirearms(body) {
        // Weapon rack: 15 slots
        const rack = document.createElement('div');
        rack.id = 'shop-rack';
        GameConfig.weapons.forEach((w, i) => {
            const unlocked = GameState.unlockedWeapons.includes(i);
            const isEvolution = GameConfig.economy.chassisConversionCosts[i] !== undefined;
            const isSelected = this.selectedWeapon === i;
            const slot = document.createElement('button');
            slot.className = 'rack-slot' + (unlocked ? '' : ' locked') + (isSelected ? ' selected' : '');

            const img = document.createElement('img');
            img.src = `assets/svgs/wpn_side_${w.iconId}.svg`;
            img.alt = w.name;
            slot.appendChild(img);

            const label = document.createElement('span');
            label.textContent = unlocked ? w.name : (isEvolution ? '🔒' : `$${GameConfig.economy.baseBuyInCosts[i] || '—'}`);
            slot.appendChild(label);

            slot.addEventListener('click', () => {
                if (!unlocked) { this.tryBuyWeapon(i); }
                else { this.selectedWeapon = i; this.render(); }
            });
            rack.appendChild(slot);
        });
        body.appendChild(rack);

        // Mastery tracks for selected weapon (Layer 4)
        this.renderMastery(body, this.selectedWeapon);

        // Equip buttons
        const equipP = this._mkBtn(FlavorText.shop.equipPrimary, () => {
            GameState.primaryWeapon = this.selectedWeapon; GameState.activeSlot = 'primary';
            eventBus.emit('WEAPON_EQUIPPED', { slot: 'primary', wpnId: this.selectedWeapon }); this.render();
        });
        const equipS = this._mkBtn(FlavorText.shop.equipSecondary, () => {
            GameState.secondaryWeapon = this.selectedWeapon;
            eventBus.emit('WEAPON_EQUIPPED', { slot: 'secondary', wpnId: this.selectedWeapon }); this.render();
        });
        if (!GameState.unlockedWeapons.includes(this.selectedWeapon)) { equipP.classList.add('locked'); equipS.classList.add('locked'); }
        body.appendChild(equipP); body.appendChild(equipS);
    }

    renderMastery(body, wpnId) {
        const w = GameConfig.weapons[wpnId];
        const arch = GameConfig.mastery.archetypes[w.archetype];
        const mastery = GameState.weaponMastery[wpnId];
        const wrap = document.createElement('div');
        wrap.className = 'mastery-wrap';
        wrap.innerHTML = `<div class="mastery-head">${w.name} — ${w.archetype.toUpperCase()}</div>`;

        ['track1', 'track2', 'track3'].forEach(tk => {
            const def = arch[tk];
            const lvl = mastery[tk];
            const cost = this.upgradeCost(wpnId);
            const row = document.createElement('div');
            row.className = 'mastery-row';
            const maxed = lvl >= GameConfig.mastery.maxLevel;
            row.innerHTML = `<span>${def.label} [${lvl}/${GameConfig.mastery.maxLevel}]</span>`;
            const btn = document.createElement('button');
            btn.className = 'btn' + ((maxed || GameState.funds < cost) ? ' locked' : '');
            btn.textContent = maxed ? 'MAX' : `$${cost}`;
            if (!maxed) btn.addEventListener('click', () => this.tryUpgrade(wpnId, tk));
            row.appendChild(btn);
            wrap.appendChild(row);
        });

        // Chassis conversion (max all tracks => evolve)
        if (w.evolvesTo !== undefined) {
            const allMax = ['track1', 'track2', 'track3'].every(t => mastery[t] >= GameConfig.mastery.maxLevel);
            const cost = GameConfig.economy.chassisConversionCosts[w.evolvesTo];
            const evo = this._mkBtn(`${FlavorText.shop.chassisConversion} → ${GameConfig.weapons[w.evolvesTo].name} ($${cost})`,
                () => this.tryEvolve(wpnId));
            if (!allMax || GameState.funds < cost) evo.classList.add('locked');
            wrap.appendChild(evo);
        }
        body.appendChild(wrap);
    }

    renderLogistics(body) {
        const wave = GameState.wave;
        const sc = GameConfig.economy.supplyCosts;

        const addSection = (label) => {
            const s = document.createElement('div');
            s.className = 'supply-section';
            const h = document.createElement('div');
            h.className = 'supply-section-label';
            h.textContent = label;
            s.appendChild(h);
            body.appendChild(s);
            return s;
        };

        const addBtn = (section, label, cost, fn, enabled = true) => {
            const b = this._mkBtn(`${label} ($${cost})`, fn);
            if (!enabled || GameState.funds < cost) b.classList.add('locked');
            section.appendChild(b);
        };

        // --- MEDICAL ---
        const medSection = addSection('MEDICAL');
        const medCost = sc.medkit;
        addBtn(medSection, `MEDKIT — Restore 1 HP [${GameState.hp}/${GameState.maxHp}]`, medCost, () => {
            if (GameState.funds >= medCost && GameState.hp < GameState.maxHp) {
                this.scene.addFunds(-medCost);
                GameState.hp = Math.min(GameState.hp + 1, GameState.maxHp);
                eventBus.emit('PLAYER_HIT', { new: GameState.hp, old: GameState.hp - 1 });
                this.render();
            }
        }, GameState.hp < GameState.maxHp);

        const hpCost = 400;
        addBtn(medSection, `MAX HP +1 [${GameState.maxHp}/10]`, hpCost, () => {
            if (GameState.funds >= hpCost && GameState.maxHp < 10) {
                this.scene.addFunds(-hpCost);
                GameState.maxHp += 1;
                GameState.hp = Math.min(GameState.hp + 1, GameState.maxHp);
                eventBus.emit('PLAYER_HIT', { new: GameState.hp, old: GameState.hp - 1 });
                this.render();
            }
        }, GameState.maxHp < 10);

        addBtn(medSection, FlavorText.logistics.kevlar, sc.armor, () => {
            if (GameState.funds >= sc.armor && GameState.armor < GameState.maxArmor) {
                this.scene.addFunds(-sc.armor); GameState.armor += 1;
                eventBus.emit('ARMOR_CHANGED', { new: GameState.armor, old: GameState.armor - 1 }); this.render();
            }
        }, GameState.armor < GameState.maxArmor);

        // --- ORDNANCE ---
        const ordSection = addSection('ORDNANCE');
        if (wave >= 5) {
            addBtn(ordSection, FlavorText.logistics.grenades, sc.grenade, () => {
                if (GameState.funds >= sc.grenade) {
                    this.scene.addFunds(-sc.grenade); GameState.grenades += 1;
                    eventBus.emit('GRENADES_CHANGED', { grenades: GameState.grenades }); this.render();
                }
            });
        }

        // --- ENGINEERING ---
        if (wave >= 12 || wave >= 20) {
            const engSection = addSection('ENGINEERING');
            if (wave >= 12) addBtn(engSection, FlavorText.logistics.barricade, sc.buildBarricade, () => this.tryBuildBarricade());
            if (wave >= 20) addBtn(engSection, FlavorText.logistics.turret, GameConfig.economy.upgradeBaseCosts.turret, () => this.tryBuildTurret());
        }
    }

    renderVenture(body) {
        if (GameState.wave < GameConfig.venture.unlockWave) {
            const note = document.createElement('div');
            note.className = 'venture-locked';
            note.textContent = FlavorText.venture.encrypted;
            body.appendChild(note);
            return;
        }
        const v = FlavorText.venture;
        const opts = [
            { key: 'midas', name: v.midas, desc: v.midasDesc },
            { key: 'interest', name: v.interest, desc: v.interestDesc },
            { key: 'bounty', name: v.bounty, desc: v.bountyDesc },
            { key: 'inflation', name: v.inflation, desc: v.inflationDesc }
        ];
        opts.forEach(o => {
            const lvl = GameState.ventureInvestments[o.key] || 0;
            const cost = GameConfig.venture.baseCost * (lvl + 1);
            const b = this._mkBtn(`${o.name} [${lvl}] — ${o.desc} ($${cost})`, () => {
                if (GameState.funds >= cost) {
                    this.scene.addFunds(-cost);
                    GameState.ventureInvestments[o.key] = lvl + 1; this.render();
                }
            });
            if (GameState.funds < cost) b.classList.add('locked');
            body.appendChild(b);
        });
    }

    // ---- shop actions ----
    upgradeCost(wpnId) {
        const m = GameState.weaponMastery[wpnId];
        const bought = m.track1 + m.track2 + m.track3;
        return Math.floor(GameConfig.weapons[wpnId].baseUpgradeCost * Math.pow(GameConfig.mastery.costScaling, bought));
    }

    tryUpgrade(wpnId, track) {
        const cost = this.upgradeCost(wpnId);
        if (GameState.funds < cost) return;
        if (GameState.weaponMastery[wpnId][track] >= GameConfig.mastery.maxLevel) return;
        this.scene.addFunds(-cost);
        GameState.weaponMastery[wpnId][track] += 1;
        eventBus.emit('WEAPON_UPGRADED', { wpnId, track });
        this.render();
    }

    tryBuyWeapon(i) {
        const cost = GameConfig.economy.baseBuyInCosts[i];
        if (cost === undefined) return; // evolution-only weapon, not directly buyable
        if (GameState.funds < cost) return;
        this.scene.addFunds(-cost);
        GameState.unlockedWeapons.push(i);
        this.selectedWeapon = i;
        this.render();
    }

    tryEvolve(wpnId) {
        const w = GameConfig.weapons[wpnId];
        const target = w.evolvesTo;
        const m = GameState.weaponMastery[wpnId];
        const allMax = ['track1', 'track2', 'track3'].every(t => m[t] >= GameConfig.mastery.maxLevel);
        const cost = GameConfig.economy.chassisConversionCosts[target];
        if (!allMax || GameState.funds < cost) return;
        this.scene.addFunds(-cost);
        if (!GameState.unlockedWeapons.includes(target)) GameState.unlockedWeapons.push(target);
        // Previous tier disappears; equip evolution where the old one was equipped
        if (GameState.primaryWeapon === wpnId) GameState.primaryWeapon = target;
        if (GameState.secondaryWeapon === wpnId) GameState.secondaryWeapon = target;
        GameState.unlockedWeapons = GameState.unlockedWeapons.filter(x => x !== wpnId);
        GameState.ammo[target] = Math.round(getModifiedStats(target).magSize); // refill on evolution
        this.selectedWeapon = target;
        eventBus.emit('WEAPON_EVOLVED', { from: wpnId, to: target });
        this.render();
    }

    tryBuildBarricade() {
        const cost = GameConfig.economy.supplyCosts.buildBarricade;
        const slot = GameState.barricades.findIndex(b => b === null);
        if (GameState.funds < cost || slot < 0) return;
        this.scene.addFunds(-cost);
        const cam = this.scene.cameras.main;
        const x = cam.centerX - 200 + slot * 80;
        const y = cam.height - 220;
        const bar = new Barricade(this.scene, x, y, slot);
        this.scene.add.existing(bar);
        this.scene.barricadeGroup.add(bar);
        GameState.barricades[slot] = { hp: bar.hp };
        this.render();
    }

    tryBuildTurret() {
        const cost = GameConfig.economy.upgradeBaseCosts.turret;
        if (GameState.funds < cost) return;
        this.scene.addFunds(-cost);
        const cam = this.scene.cameras.main;
        const t = new Turret(this.scene, cam.centerX + Phaser.Math.Between(-150, 150), cam.height - 200);
        GameState.defenses.push({ type: 'turret', entity: t });
        this.render();
    }

    _mkBtn(label, fn) {
        const b = document.createElement('button');
        b.className = 'btn shop-action';
        b.textContent = label;
        b.addEventListener('click', fn);
        return b;
    }
}

// ---- HarvestManager (wires the static #screen-harvest modal in index.html) ----
class HarvestManager {
    constructor(scene) {
        this.scene = scene;
        this.modal = document.getElementById('screen-harvest');
        this.intro = document.getElementById('harvest-intro');
        this.cardsEl = document.getElementById('harvest-cards');
        this.intro.textContent = FlavorText.harvest.intro;
    }

    open() {
        this.scene.hideAllModals();
        this.modal.classList.add('active');
        const cards = this.cardsEl;
        cards.innerHTML = '';

        const available = Object.keys(FlavorText.mutations).filter(k => !GameState.mutations.includes(k));
        if (available.length === 0) { this.grantConsolation(cards); return; }
        const picks = Phaser.Utils.Array.Shuffle(available.slice()).slice(0, 3);

        picks.forEach(key => {
            const mut = FlavorText.mutations[key];
            const card = document.createElement('button');
            card.className = 'btn';
            card.innerHTML = `<div class="harvest-title">${mut.title}</div>
              <div class="harvest-desc">${mut.desc}</div>
              <div class="harvest-quote">${mut.quote}</div>`;
            card.addEventListener('click', () => this.choose(key));
            cards.appendChild(card);
        });
    }

    grantConsolation(cards) {
        const note = document.createElement('div');
        note.className = 'harvest-consolation';
        note.textContent = FlavorText.harvest.noMutations;
        cards.appendChild(note);
        this.scene.addFunds(500);
        this.scene.time.delayedCall(1500, () => { this.close(); eventBus.emit('MUTATION_CHOSEN'); });
    }

    choose(key) {
        GameState.mutations.push(key);
        eventBus.emit('MUTATION_ACQUIRED', { mutation: key });
        this.close();
        eventBus.emit('MUTATION_CHOSEN');
    }

    close() { this.modal.classList.remove('active'); }
}

// ========== BOOTSTRAP ==========
const config = {
    type: Phaser.AUTO,
    scale: {
        mode: Phaser.Scale.RESIZE,
        parent: 'game-wrapper',
        width: '100%',
        height: '100%'
    },
    physics: {
        default: 'arcade',
        arcade: { debug: false }
    },
    scene: [GameScene],
    pixelArt: false,
    antialias: true
};

window.game = new Phaser.Game(config);
window.GameState = GameState;
window.eventBus = eventBus;
window.GameConfig = GameConfig;
window.FlavorText = FlavorText;
window.getModifiedStats = getModifiedStats;
