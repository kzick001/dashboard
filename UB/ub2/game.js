// ==========================================
// UNDEAD BARRAGE - GAME ENGINE v2.0.0
// Plain globals. No ES modules. Phaser 3.80.0 (CDN).
// Balance numbers live in config.js. Text lives in flavor.js.
// ==========================================

var GameConfig = window.GameConfig;
var FlavorText = window.FlavorText;

// ========== GAME STATE ==========
var GameState = {
    // Loop
    wave: 1,
    gameActive: false,
    isPaused: false,
    inShop: false,
    inHarvest: false,
    tutorialPending: false,

    // Player vitals
    maxHp: 5,
    hp: 5,
    maxArmor: 5,
    armor: 0,
    funds: 0,
    grenades: 0,

    // Weapons
    primaryWeapon: 0,
    secondaryWeapon: null,
    activeSlot: 'primary',
    ammo: {},
    isReloading: false,

    // Stats
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

    // Settings (persisted via localStorage)
    godMode: false,
    screenShake: true,
    devOverrides: false
};

// Initialize ammo and mastery for all weapons
GameConfig.weapons.forEach(function (wpn, idx) {
    GameState.ammo[idx] = wpn.magSize;
    GameState.weaponMastery[idx] = { track1: 0, track2: 0, track3: 0 };
});

// ========== SETTINGS PERSISTENCE (localStorage) ==========
var SETTINGS_KEY = 'undeadBarrage_settings';

function loadSettings() {
    try {
        var raw = localStorage.getItem(SETTINGS_KEY);
        if (!raw) return;
        var s = JSON.parse(raw);
        if (typeof s.screenShake === 'boolean') GameState.screenShake = s.screenShake;
        if (typeof s.devOverrides === 'boolean') GameState.devOverrides = s.devOverrides;
        if (typeof s.masterVolume === 'number') GameConfig.system.masterVolume = s.masterVolume;
        if (typeof s.sfxVolume === 'number') GameConfig.system.sfxVolume = s.sfxVolume;
    } catch (e) { /* corrupt or unavailable storage — fall back to defaults */ }
}

function saveSettings() {
    try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify({
            screenShake: GameState.screenShake,
            devOverrides: GameState.devOverrides,
            masterVolume: GameConfig.system.masterVolume,
            sfxVolume: GameConfig.system.sfxVolume
        }));
    } catch (e) { /* storage unavailable — settings stay session-only */ }
}

// ========== WEAPON HELPERS ==========

// activeWeaponId() — resolve the weapon id for the currently selected slot
function activeWeaponId() {
    if (GameState.activeSlot === 'secondary' && GameState.secondaryWeapon !== null) {
        return GameState.secondaryWeapon;
    }
    return GameState.primaryWeapon;
}

// getModifiedStats(wpnId) — pure: copy of base stats with mastery + mutations applied
function getModifiedStats(wpnId) {
    var base = GameConfig.weapons[wpnId];
    var stats = Object.assign({}, base);
    var arch = GameConfig.mastery.archetypes[base.archetype];
    var mastery = GameState.weaponMastery[wpnId] || { track1: 0, track2: 0, track3: 0 };
    if (!arch) return stats;

    ['track1', 'track2', 'track3'].forEach(function (tk) {
        var def = arch[tk];
        var lvl = mastery[tk] || 0;
        if (!def || lvl <= 0) return;
        var cur = stats[def.stat];
        if (def.mode === 'mult') {
            stats[def.stat] = cur * (1 + def.perLevel * lvl);
        } else {
            stats[def.stat] = cur + def.perLevel * lvl;
        }
    });

    // Mutation: Tungsten Core — all projectiles pierce
    if (GameState.mutations.indexOf('Tungsten Core') !== -1) stats.pierce = true;
    return stats;
}

// ========== EVENT BUS ==========
class EventBus extends EventTarget {
    emit(eventName, detail) {
        this.dispatchEvent(new CustomEvent(eventName, { detail: detail }));
    }
    on(eventName, handler) {
        this.addEventListener(eventName, function (e) { handler(e.detail); });
    }
}

var eventBus = new EventBus();

// ========== GAME SCENE ==========
class GameScene extends Phaser.Scene {
    constructor() {
        super('GameScene');
    }

    // ---------- Arena geometry ----------
    roadLeft() { return this.cameras.main.centerX - GameConfig.arena.roadWidth / 2; }
    roadRight() { return this.cameras.main.centerX + GameConfig.arena.roadWidth / 2; }

    preload() {
        // Backgrounds
        this.load.svg('road_bg', 'assets/svgs/road_bg.svg');
        this.load.svg('sidewalk_bg', 'assets/svgs/sidewalk_bg.svg');

        this.load.svg('player', 'assets/svgs/player.svg');

        // Enemies
        this.load.svg('grunt', 'assets/svgs/grunt.svg');
        this.load.svg('sprinter', 'assets/svgs/sprinter.svg');
        this.load.svg('spitter', 'assets/svgs/spitter.svg');
        this.load.svg('tank', 'assets/svgs/tank.svg');
        this.load.svg('burrower', 'assets/svgs/burrower.svg');
        this.load.svg('boss', 'assets/svgs/boss.svg');

        // Weapons (in-hand + HUD side views)
        for (var i = 0; i < 8; i++) {
            this.load.svg('wpn_' + i, 'assets/svgs/wpn_' + i + '.svg');
            this.load.svg('wpn_side_' + i, 'assets/svgs/wpn_side_' + i + '.svg');
        }

        // Projectiles & items
        this.load.svg('bullet', 'assets/svgs/bullet.svg');
        this.load.svg('grenade_proj', 'assets/svgs/grenade.svg');
        this.load.svg('coin', 'assets/svgs/coin.svg');
        this.load.svg('crate', 'assets/svgs/crate.svg');
        this.load.svg('grenade_pickup', 'assets/svgs/grenade_pickup.svg');
        this.load.svg('barricade', 'assets/svgs/barricade.svg');

        // Audio (live — silent fallback in AudioManager if a key fails to load)
        if (GameConfig.system.audioEnabled) {
            var manifest = AudioManager.MANIFEST;
            for (var key in manifest) {
                this.load.audio(key, 'assets/audio/' + manifest[key] + '.wav');
            }
        }
    }

    create() {
        var cam = this.cameras.main;
        var roadWidth = GameConfig.arena.roadWidth;
        var self = this;

        // Background
        this.bgRoad = this.add.image(cam.centerX, cam.centerY, 'road_bg')
            .setDisplaySize(roadWidth, cam.height).setDepth(1);
        this.bgLeft = this.add.image(cam.centerX - roadWidth / 2 - 500, cam.centerY, 'sidewalk_bg')
            .setDisplaySize(1000, cam.height).setDepth(0);
        this.bgRight = this.add.image(cam.centerX + roadWidth / 2 + 500, cam.centerY, 'sidewalk_bg')
            .setDisplaySize(1000, cam.height).setDepth(0);

        // Reposition backgrounds if the window resizes (Scale.RESIZE mode)
        this.scale.on('resize', function () {
            var c = self.cameras.main;
            self.bgRoad.setPosition(c.centerX, c.centerY).setDisplaySize(roadWidth, c.height);
            self.bgLeft.setPosition(c.centerX - roadWidth / 2 - 500, c.centerY).setDisplaySize(1000, c.height);
            self.bgRight.setPosition(c.centerX + roadWidth / 2 + 500, c.centerY).setDisplaySize(1000, c.height);
            self.physics.world.setBounds(0, 0, c.width, c.height);
        });

        // World bounds = camera viewport
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
        this.player = new Player(this, cam.centerX, cam.height - GameConfig.arena.playerStartOffsetY);
        this.add.existing(this.player);
        this.physics.add.existing(this.player);
        this.player.body.setCollideWorldBounds(true);

        // ----- Boss HP bar (depth 60) -----
        this.bossRef = null;
        this.bossBarBg = this.add.rectangle(0, 0, 96, 9, 0x000000, 0.75)
            .setDepth(60).setVisible(false).setStrokeStyle(1, 0x7f1d1d);
        this.bossBarFill = this.add.rectangle(0, 0, 92, 5, 0xef4444, 1)
            .setDepth(60).setVisible(false).setOrigin(0, 0.5);

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

        // ----- Input & wiring -----
        this.setupInputHandlers();
        this.setupEventBus();
        this.bindSettingsControls();
    }

    // ---------- Event wiring ----------
    setupEventBus() {
        var self = this;
        eventBus.on('GAME_START', function () { self.onGameStart(); });
        eventBus.on('PAUSE_GAME', function () { self.onPauseGame(); });
        eventBus.on('RESUME_GAME', function () { self.onResumeGame(); });
        eventBus.on('WAVE_CLEARED', function (d) { self.onWaveCleared(d); });
        eventBus.on('RETURN_TO_BATTLEFIELD', function () { self.onReturnToBattlefield(); });
        eventBus.on('PLAYER_DIED', function () { self.onPlayerDied(); });
        eventBus.on('MUTATION_CHOSEN', function () { self.onMutationChosen(); });
    }

    // resetRun() — wipe every piece of live run state. Settings survive.
    resetRun() {
        GameState.gameActive = true;
        GameState.isPaused = false;
        GameState.inShop = false;
        GameState.inHarvest = false;
        GameState.tutorialPending = false;
        GameState.wave = 1;
        GameState.maxHp = 5;
        GameState.hp = GameState.maxHp;
        GameState.armor = 0;
        GameState.funds = 0;
        GameState.grenades = 0;
        GameState.combo = 0;
        GameState.maxCombo = 0;
        GameState.kills = 0;
        GameState.primaryWeapon = 0;
        GameState.secondaryWeapon = null;
        GameState.activeSlot = 'primary';
        GameState.isReloading = false;
        GameState.mutations = [];
        GameState.unlockedWeapons = [0];
        GameState.ventureInvestments = {};
        GameConfig.weapons.forEach(function (wpn, idx) {
            GameState.ammo[idx] = wpn.magSize;
            GameState.weaponMastery[idx] = { track1: 0, track2: 0, track3: 0 };
        });

        // Despawn all pooled actives
        [this.projectilePool, this.enemyGroup, this.coinGroup,
         this.grenadeGroup, this.acidGroup, this.crateGroup].forEach(function (group) {
            group.getChildren().forEach(function (o) {
                if (o.active && o.despawn) o.despawn();
            });
        });

        // Tear down defenses
        this.barricadeGroup.clear(true, true);
        GameState.barricades = [null, null, null, null, null, null];
        GameState.defenses.forEach(function (d) {
            if (d.entity && d.entity.sprite) d.entity.sprite.destroy();
        });
        GameState.defenses = [];

        // Director + HUD bits
        this.director.reset();
        this.hideBossBar();
        this.shop.selectedWeapon = 0;
        this.shop.activeTab = 'firearms';
    }

    onGameStart() {
        this.resetRun();
        this.player.respawn();
        this.player.setGunTexture();
        this.physics.world.resume();
        this.hud.show();
        var self = this;
        // Freeze before the first wave until the player acknowledges the transmission
        this.showTutorialGate(GameState.wave, function () {
            self.director.startWave(GameState.wave);
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

    // onWaveCleared — director reports all enemies dead
    onWaveCleared(detail) {
        this.applyWaveEndEconomy();
        this.hud.flashWaveClear();

        var self = this;
        // Every 5 waves => harvest; otherwise => shop
        if (GameState.wave % 5 === 0) {
            this.time.delayedCall(1400, function () {
                GameState.inHarvest = true;
                self.onPauseGame();
                self.harvest.open();
            });
        } else {
            this.time.delayedCall(1400, function () {
                GameState.inShop = true;
                self.onPauseGame();
                self.shop.open();
            });
        }
    }

    onMutationChosen() {
        GameState.inHarvest = false;
        GameState.inShop = true;
        this.shop.open();
    }

    onReturnToBattlefield() {
        GameState.inShop = false;
        GameState.inHarvest = false;
        GameState.wave += 1;
        this.onResumeGame();
        var self = this;
        this.showTutorialGate(GameState.wave, function () {
            self.director.startWave(GameState.wave);
        });
    }

    onPlayerDied() {
        GameState.gameActive = false;
        this.physics.world.pause();
        this.hud.hide();
        this.hideBossBar();
        var title = document.getElementById('game-over-title');
        var stats = document.getElementById('game-over-stats');
        if (title) title.textContent = FlavorText.gameOver.titleDead;
        if (stats) {
            stats.textContent = FlavorText.gameOver.survived + ' ' + GameState.wave + ' WAVES | ' +
                'KILLS: ' + GameState.kills + ' | MAX COMBO: ' + GameState.maxCombo;
        }
        this.showModal('screen-game-over');
    }

    // ---------- Economy ----------
    applyWaveEndEconomy() {
        // Compound Interest venture (unlocks wave 25)
        var interestLvl = GameState.ventureInvestments['interest'] || 0;
        if (interestLvl > 0) {
            var interest = Math.floor(GameState.funds * GameConfig.venture.interestRate * interestLvl);
            this.addFunds(interest);
        }
    }

    addFunds(amount) {
        var old = GameState.funds;
        GameState.funds = Math.max(0, GameState.funds + amount);
        eventBus.emit('FUNDS_CHANGED', { new: GameState.funds, old: old });
    }

    // ---------- Boss HP bar ----------
    showBossBar(boss) {
        this.bossRef = boss;
        this.bossBarBg.setVisible(true);
        this.bossBarFill.setVisible(true);
        this.updateBossBar();
    }

    updateBossBar() {
        var b = this.bossRef;
        if (!b || !b.active) { this.hideBossBar(); return; }
        var y = b.y - b.displayHeight / 2 - 16;
        this.bossBarBg.setPosition(b.x, y);
        this.bossBarFill.setPosition(b.x - 46, y);
        this.bossBarFill.width = 92 * Math.max(0, b.hp / b.maxHp);
    }

    hideBossBar() {
        this.bossRef = null;
        if (this.bossBarBg) this.bossBarBg.setVisible(false);
        if (this.bossBarFill) this.bossBarFill.setVisible(false);
    }

    // ---------- Combat callbacks ----------
    onProjectileHitEnemy(proj, enemy) {
        if (!proj.active || !enemy.active || enemy.invulnerable) return;
        var stats = proj.stats;

        // Splash weapons explode on hit instead of dealing direct damage
        if (stats.splashRadius > 0) {
            this.explode(proj.x, proj.y, stats.splashRadius, proj.damage);
            proj.despawn();
            return;
        }

        var dmg = proj.damage;
        var crit = false;
        if (Phaser.Math.Between(1, 100) <= (stats.critChance || 0)) {
            dmg = dmg * (stats.critMult || 1);
            crit = true;
        }
        enemy.takeDamage(dmg, crit, proj.dirX, proj.dirY, stats.knockback || 0);

        // Mutation: Bitch Splinters — crit causes shrapnel burst
        if (crit && GameState.mutations.indexOf('Bitch Splinters') !== -1) {
            this.shrapnelBurst(enemy.x, enemy.y,
                dmg * GameConfig.mutations['Bitch Splinters'].damageFraction);
        }

        if (!stats.pierce) {
            proj.despawn();
        } else {
            proj.pierceCount = (proj.pierceCount || 0) + 1;
            if (proj.pierceCount >= GameConfig.combat.pierceMaxHits) proj.despawn();
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
        var ang = Phaser.Math.Angle.Between(this.player.x, this.player.y, enemy.x, enemy.y);
        enemy.x += Math.cos(ang) * 30;
        enemy.y += Math.sin(ang) * 30;
    }

    onPlayerCollectCoin(player, coin) {
        if (!coin.active) return;
        // Inflation Hedge venture multiplier
        var inflationLvl = GameState.ventureInvestments['inflation'] || 0;
        var value = Math.floor(coin.value * (1 + GameConfig.venture.inflationMult * inflationLvl));
        this.addFunds(value);

        // Mutation: Scavenger — coin pickup grants speed + brief immunity
        if (GameState.mutations.indexOf('Scavenger') !== -1) {
            this.player.grantScavengerBuff();
        }
        coin.despawn();
    }

    onPlayerHitByAcid(player, acid) {
        if (!acid.active) return;
        acid.splash();
        if (this.player.invulnTimer > 0) return;
        this.player.takeDamage(GameConfig.mobs.spitter.spitDamage);
    }

    onPlayerCollectCrate(player, crate) {
        if (!crate.active) return;
        crate.open();
    }

    onEnemyHitBarricade(enemy, barricade) {
        if (!enemy.active || !barricade.active) return;
        if (enemy.invulnerable) return;
        barricade.takeDamage(1);
        var ang = Phaser.Math.Angle.Between(barricade.x, barricade.y, enemy.x, enemy.y);
        enemy.x += Math.cos(ang) * 6;
        enemy.y += Math.sin(ang) * 6;
    }

    // ---------- Spawning helpers ----------
    spawnProjectile(x, y, vx, vy, damage, stats, dirX, dirY) {
        var proj = this.projectilePool.get();
        if (!proj) return;
        proj.fire(x, y, vx, vy, damage, stats, dirX, dirY);
    }

    spawnCoin(x, y, value) {
        var coin = this.coinGroup.get();
        if (!coin) return;
        coin.drop(x, y, value);
    }

    shrapnelBurst(x, y, dmg) {
        var cfg = GameConfig.mutations['Bitch Splinters'];
        var stats = { critChance: 0, critMult: 1, pierce: false, splashRadius: 0,
                      range: cfg.range, speed: cfg.speed, knockback: 0 };
        for (var i = 0; i < cfg.shards; i++) {
            var ang = (Math.PI * 2 / cfg.shards) * i;
            this.spawnProjectile(x, y, Math.cos(ang) * cfg.speed, Math.sin(ang) * cfg.speed,
                dmg, stats, Math.cos(ang), Math.sin(ang));
        }
    }

    explode(x, y, radius, damage) {
        // Mutation: Chain Reaction — chance for over-performing explosion
        var dmg = damage;
        var cr = GameConfig.mutations['Chain Reaction'];
        if (GameState.mutations.indexOf('Chain Reaction') !== -1 &&
            Phaser.Math.Between(1, 100) <= cr.chance) {
            dmg = damage * cr.damageMult;
        }
        var fx = this.add.circle(x, y, radius, 0xff8a00, 0.5).setDepth(25);
        this.tweens.add({ targets: fx, alpha: 0, scale: 1.3, duration: 250,
            onComplete: function () { fx.destroy(); } });
        if (GameState.screenShake) this.cameras.main.shake(120, 0.012);
        eventBus.emit('EXPLOSION', { x: x, y: y, radius: radius });

        var self = this;
        this.enemyGroup.getChildren().forEach(function (e) {
            if (!e.active || e.invulnerable) return;
            var d = Phaser.Math.Distance.Between(x, y, e.x, e.y);
            if (d <= radius) {
                e.lastDeathWasExplosion = true; // Spare Change explosion-kill gating
                self.floatingText(e.x, e.y - 20, Math.round(dmg), '#ff6b35');
                e.takeDamage(dmg, false, 0, 1, 0);
            }
        });
    }

    floatingText(x, y, msg, color) {
        var t = this.add.text(x, y, msg, {
            fontFamily: 'Share Tech Mono, monospace',
            fontSize: '18px',
            color: color || '#ffffff'
        }).setOrigin(0.5).setDepth(50);
        this.tweens.add({
            targets: t, y: y - 40, alpha: 0, duration: 600,
            onComplete: function () { t.destroy(); }
        });
    }

    // bloodSplat — directional red spray at enemy center (depth 40)
    bloodSplat(x, y, dirX, dirY) {
        var fx = GameConfig.fx;
        var count = Phaser.Math.Between(fx.bloodYieldMin, fx.bloodYieldMax) || fx.splatCount;
        var hasDir = (dirX !== undefined && dirY !== undefined && (dirX !== 0 || dirY !== 0));
        var self = this;
        for (var i = 0; i < count; i++) {
            (function () {
                var scale = Phaser.Math.FloatBetween(fx.splatScaleMin, fx.splatScaleMax);
                var r = (fx.splatRadius || 3) * scale;
                var splat = self.add.circle(x, y, r, 0xaa0000, 0.7).setDepth(40);
                var baseAng = hasDir ? Math.atan2(dirY, dirX) : Phaser.Math.FloatBetween(0, Math.PI * 2);
                var ang = baseAng + Phaser.Math.FloatBetween(-0.6, 0.6);
                var spd = fx.arterialSpraySpeed * Phaser.Math.FloatBetween(0.3, 1.0) / 60;
                var dist = spd * (fx.splatFadeDuration / 16);
                self.tweens.add({
                    targets: splat,
                    x: x + Math.cos(ang) * dist,
                    y: y + Math.sin(ang) * dist,
                    alpha: 0, scale: 0.4,
                    duration: fx.splatFadeDuration, ease: 'Quad.easeOut',
                    onComplete: function () { splat.destroy(); }
                });
            })();
        }
    }

    // ejectCasings — brass to the right of the barrel (both sides if dual-wield)
    ejectCasings(x, y, fireAng, dual) {
        var fx = GameConfig.fx;
        var sides = dual ? [1, -1] : [1];
        var self = this;
        sides.forEach(function (side) {
            var perp = fireAng + (Math.PI / 2) * side;
            for (var i = 0; i < (fx.casingCount || 2); i++) {
                (function () {
                    var casing = self.add.rectangle(x, y, 2, 6, 0xccaa00, 0.9)
                        .setDepth(17).setRotation(Phaser.Math.FloatBetween(0, Math.PI * 2));
                    var ejVx = Math.cos(perp) * fx.casingVelocityX * Phaser.Math.FloatBetween(0.6, 1.2);
                    var ejVy = Math.sin(perp) * fx.casingVelocityX * Phaser.Math.FloatBetween(0.6, 1.2) + fx.casingVelocityY;
                    var dur = fx.casingFadeDuration;
                    var landX = x + ejVx * (dur / 1000);
                    var landY = y + ejVy * (dur / 1000) + fx.casingGravity * (dur / 100);
                    self.tweens.add({
                        targets: casing, x: landX, y: landY,
                        rotation: casing.rotation + Phaser.Math.FloatBetween(-6, 6),
                        duration: dur, ease: 'Quad.easeIn'
                    });
                    self.tweens.add({
                        targets: casing, alpha: 0, duration: dur * 0.4, delay: dur * 0.6,
                        onComplete: function () { casing.destroy(); }
                    });
                })();
            }
        });
    }

    // showTutorialGate — freeze the wave until the player acknowledges the transmission
    showTutorialGate(wave, onDismiss) {
        var msg = FlavorText.tutorials[wave];
        if (!msg) { onDismiss(); return; }
        GameState.tutorialPending = true;
        this.hud.showTutorialGate(msg, function () {
            GameState.tutorialPending = false;
            onDismiss();
        });
    }

    // ---------- DOM modal handling ----------
    setupInputHandlers() {
        var self = this;
        var click = function (id, fn) {
            var el = document.getElementById(id);
            if (el) el.addEventListener('click', fn);
        };

        click('btn-new-game', function () { self.hideAllModals(); eventBus.emit('GAME_START'); });
        click('btn-restart', function () { self.hideAllModals(); eventBus.emit('GAME_START'); });
        click('btn-resume', function () { self.hideAllModals(); eventBus.emit('RESUME_GAME'); });
        click('btn-open-settings', function () { self.showModal('screen-settings'); });
        click('btn-settings', function () { self.showModal('screen-settings'); });
        click('btn-close-settings', function () {
            self.hideAllModals();
            if (GameState.gameActive && !GameState.inShop && !GameState.inHarvest) {
                eventBus.emit('RESUME_GAME');
            } else if (GameState.inShop) {
                self.shop.open();
            } else if (GameState.inHarvest) {
                self.harvest.open();
            } else if (!GameState.gameActive) {
                var boot = document.getElementById('screen-boot');
                if (boot) boot.classList.add('active');
            }
        });
    }

    bindSettingsControls() {
        var self = this;
        var toggle = function (id, key, onChange) {
            var el = document.getElementById(id);
            if (!el) return;
            el.textContent = GameState[key] ? 'ON' : 'OFF';
            el.addEventListener('click', function () {
                GameState[key] = !GameState[key];
                el.textContent = GameState[key] ? 'ON' : 'OFF';
                saveSettings();
                if (onChange) onChange(GameState[key]);
            });
        };
        toggle('tog-shake', 'screenShake');
        toggle('tog-dev', 'devOverrides', function (v) { self.hud.setDevPanelVisible(v); });

        var slider = function (id, key) {
            var el = document.getElementById(id);
            if (!el) return;
            el.value = Math.round(GameConfig.system[key] * 100);
            el.addEventListener('input', function () {
                GameConfig.system[key] = el.value / 100;
                saveSettings();
            });
        };
        slider('vol-master', 'masterVolume');
        slider('vol-sfx', 'sfxVolume');
    }

    showModal(modalId) {
        this.hideAllModals();
        var el = document.getElementById(modalId);
        if (el) el.classList.add('active');
        if (GameState.gameActive && !GameState.inShop && !GameState.inHarvest) {
            eventBus.emit('PAUSE_GAME');
        }
    }

    hideAllModals() {
        document.querySelectorAll('.modal-overlay').forEach(function (m) {
            m.classList.remove('active');
        });
    }

    // ---------- Main loop ----------
    update(time, delta) {
        if (!GameState.gameActive || GameState.isPaused) return;

        this.player.tick(time, delta);
        this.director.tick(time, delta);
        GameState.defenses.forEach(function (d) {
            if (d.entity && d.entity.tick) d.entity.tick(time, delta);
        });
        if (this.bossRef) this.updateBossBar();
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
        this.payItForwardTimer = 0;
        this.recoil = 0;
        this.moveX = 0;
        this.moveY = 0;

        // Weapon overlay sprite (depth 26, under the player body)
        this.gun = scene.add.image(x, y, 'wpn_0').setDepth(26);

        this.keys = scene.input.keyboard.addKeys('W,A,S,D,R,F,Q');
        var self = this;
        scene.input.on('pointerdown', function (p) { self.onPointerDown(p); });
        scene.input.keyboard.on('keydown-R', function () { self.reload(); });
        scene.input.keyboard.on('keydown-F', function () { self.throwGrenade(); });
        scene.input.keyboard.on('keydown-Q', function () { self.swapWeapon(); });
        scene.input.keyboard.on('keydown-ESC', function () {
            if (GameState.gameActive && !GameState.inShop && !GameState.inHarvest) {
                self.scene.showModal('screen-pause');
            }
        });

        // Keep the overlay texture current
        eventBus.on('WEAPON_SWAPPED', function () { self.setGunTexture(); });
        eventBus.on('WEAPON_EQUIPPED', function () { self.setGunTexture(); });
        eventBus.on('WEAPON_EVOLVED', function () { self.setGunTexture(); });
    }

    setGunTexture() {
        var iconId = GameConfig.weapons[activeWeaponId()].iconId;
        this.gun.setTexture('wpn_' + iconId);
    }

    respawn() {
        var cam = this.scene.cameras.main;
        this.setPosition(cam.centerX, cam.height - GameConfig.arena.playerStartOffsetY);
        this.invulnTimer = 0;
        this.scavengerTimer = 0;
        this.payItForwardTimer = 0;
        this.recoil = 0;
        this.setAlpha(1).setVisible(true).setActive(true);
        this.gun.setVisible(true);
        if (this.body) this.body.enable = true;
    }

    grantScavengerBuff() {
        this.scavengerTimer = GameConfig.mutations['Scavenger'].immunityMs;
    }

    onPointerDown(pointer) {
        if (!GameState.gameActive || GameState.isPaused) return;
        if (pointer.leftButtonDown() && pointer.event && pointer.event.target &&
            pointer.event.target.tagName === 'CANVAS') {
            this.firing = true;
        }
    }

    tick(time, delta) {
        if (this.invulnTimer > 0) this.invulnTimer -= delta;
        if (this.scavengerTimer > 0) this.scavengerTimer -= delta;
        if (this.payItForwardTimer > 0) this.payItForwardTimer -= delta;
        if (this.recoil > 0) this.recoil = Math.max(0, this.recoil - delta * 0.08);

        // --- Movement (normalized WASD) ---
        var speed = GameConfig.player.baseSpeed;
        if (this.scavengerTimer > 0) speed *= GameConfig.mutations['Scavenger'].speedMult;
        var dx = 0, dy = 0;
        if (this.keys.A.isDown) dx -= 1;
        if (this.keys.D.isDown) dx += 1;
        if (this.keys.W.isDown) dy -= 1;
        if (this.keys.S.isDown) dy += 1;

        var len = Math.hypot(dx, dy);
        if (len > 0) { dx /= len; dy /= len; }
        this.moveX = dx; this.moveY = dy;
        this.body.setVelocity(dx * speed, dy * speed);

        // Clamp to road bounds
        var margin = GameConfig.arena.edgeMargin;
        this.x = Phaser.Math.Clamp(this.x, this.scene.roadLeft() + margin, this.scene.roadRight() - margin);

        // --- Aim at cursor ---
        var ptr = this.scene.input.activePointer;
        this.rotation = Phaser.Math.Angle.Between(this.x, this.y, ptr.worldX, ptr.worldY) + Math.PI / 2;

        // --- Weapon overlay follows aim, with cosmetic recoil pull-back ---
        var aimAng = this.rotation - Math.PI / 2;
        var dist = 26 - this.recoil;
        this.gun.setPosition(this.x + Math.cos(aimAng) * dist, this.y + Math.sin(aimAng) * dist);
        this.gun.rotation = this.rotation;

        // --- Fire ---
        var wantFire = ptr.isDown && ptr.leftButtonDown() && this.firing;
        if (wantFire) this.tryFire(time);
        if (!ptr.isDown) this.firing = false;
    }

    tryFire(time) {
        if (GameState.isReloading) return;
        var wpnId = activeWeaponId();
        var stats = getModifiedStats(wpnId);

        if (GameState.ammo[wpnId] <= 0) { this.reload(); return; }

        // Mutation: Pay It Forward — flat damage bonus while the barricade-hit buff is active
        if (GameState.mutations.indexOf('Pay It Forward') !== -1 && this.payItForwardTimer > 0) {
            stats.damage = stats.damage + GameConfig.mutations['Pay It Forward'].damageBonus;
        }

        // Mutation: Heavy Boots — accelerated fire rate when standing still
        var rate = stats.rate;
        if (GameState.mutations.indexOf('Heavy Boots') !== -1 &&
            this.moveX === 0 && this.moveY === 0) {
            rate *= GameConfig.mutations['Heavy Boots'].fireRateMult;
        }
        if (time - this.lastFire < rate) return;
        this.lastFire = time;

        GameState.ammo[wpnId] -= 1;
        eventBus.emit('AMMO_CHANGED', { wpnId: wpnId, ammo: GameState.ammo[wpnId] });

        var baseAngle = this.rotation - Math.PI / 2;
        var multi = Math.max(1, Math.round(stats.multi));
        for (var i = 0; i < multi; i++) {
            var spreadRad = Phaser.Math.DegToRad(stats.spread);
            var offset = multi > 1
                ? Phaser.Math.Linear(-spreadRad, spreadRad, i / (multi - 1))
                : Phaser.Math.FloatBetween(-spreadRad / 2, spreadRad / 2);
            var ang = baseAngle + offset;
            var vx = Math.cos(ang) * stats.speed;
            var vy = Math.sin(ang) * stats.speed;
            // Parallel pattern: offset barrel positions perpendicular to aim
            var ox = 0, oy = 0;
            if (stats.pattern === 'parallel' && multi > 1) {
                var perp = baseAngle + Math.PI / 2;
                var side = (i % 2 === 0) ? -8 : 8;
                ox = Math.cos(perp) * side;
                oy = Math.sin(perp) * side;
            }
            this.scene.spawnProjectile(this.x + ox, this.y + oy, vx, vy, stats.damage, stats,
                Math.cos(ang), Math.sin(ang));
        }

        // Cosmetic recoil + shake
        this.recoil = stats.recoilPush || 0;
        if (GameState.screenShake && stats.camShake) {
            this.scene.cameras.main.shake(60, stats.camShake);
        }

        // Shell casings eject to the right (both sides if dual-wield)
        var isDual = stats.pattern === 'parallel';
        this.scene.ejectCasings(this.x, this.y, baseAngle, isDual);

        eventBus.emit('WEAPON_FIRED', {
            audioKey: stats.audioKey, audioVol: stats.audioVol, pitchVariance: stats.pitchVariance
        });

        if (GameState.ammo[wpnId] <= 0) this.reload();
    }

    reload() {
        var wpnId = activeWeaponId();
        var stats = getModifiedStats(wpnId);
        if (GameState.isReloading || GameState.ammo[wpnId] >= Math.round(stats.magSize)) return;
        GameState.isReloading = true;
        eventBus.emit('RELOAD_START', { wpnId: wpnId });
        this.scene.time.delayedCall(stats.reloadTime, function () {
            GameState.ammo[wpnId] = Math.round(stats.magSize);
            GameState.isReloading = false;
            eventBus.emit('AMMO_CHANGED', { wpnId: wpnId, ammo: GameState.ammo[wpnId] });
        });
    }

    throwGrenade() {
        if (!GameState.gameActive || GameState.isPaused) return;
        if (GameState.grenades <= 0) return;
        GameState.grenades -= 1;
        eventBus.emit('GRENADES_CHANGED', { grenades: GameState.grenades });
        var ang = this.rotation - Math.PI / 2;
        var g = this.scene.grenadeGroup.get();
        if (g) {
            g.launch(this.x, this.y,
                Math.cos(ang) * GameConfig.combat.grenadeSpeed,
                Math.sin(ang) * GameConfig.combat.grenadeSpeed);
        }
    }

    swapWeapon() {
        if (GameState.secondaryWeapon === null) return;
        GameState.activeSlot = GameState.activeSlot === 'primary' ? 'secondary' : 'primary';
        eventBus.emit('WEAPON_SWAPPED', { slot: GameState.activeSlot, wpnId: activeWeaponId() });
    }

    takeDamage(power) {
        if (this.invulnTimer > 0 || GameState.godMode) return;
        var old = GameState.hp;

        // Armor absorbs first
        if (GameState.armor > 0) {
            GameState.armor -= 1;
            eventBus.emit('ARMOR_CHANGED', { new: GameState.armor, old: GameState.armor + 1 });
        } else {
            GameState.hp -= 1;
            eventBus.emit('PLAYER_HIT', { new: GameState.hp, old: old });
        }

        // Taking a hit breaks the flawless combo
        GameState.combo = 0;
        eventBus.emit('COMBO_CHANGED', { combo: 0 });

        this.invulnTimer = GameConfig.combat.hitInvulnMs;
        if (GameState.screenShake) this.scene.cameras.main.shake(150, 0.02);
        var self = this;
        this.scene.tweens.add({
            targets: this, alpha: 0.3, duration: 100, yoyo: true, repeat: 3,
            onComplete: function () { self.setAlpha(1); }
        });

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
        this.rotation = Math.atan2(vy, vx);
        this.damage = damage;
        this.stats = stats;
        this.dirX = dirX; this.dirY = dirY;
        this.pierceCount = 0;
        this.maxLife = (stats.range / stats.speed) * 1000;
        this.bornAt = this.scene.time.now;
        // Plasma shapes read bigger and green-white
        if (stats.shape === 'plasma') { this.setTint(0x7dd3fc).setScale(2.2); }
        else { this.clearTint(); this.setScale(1); }
        if (this.body) {
            this.body.enable = true;
            this.body.setVelocity(vx, vy);
        }
    }

    update(time) {
        if (!this.active) return;
        if (time - this.bornAt > this.maxLife) { this.despawn(); return; }
        var cam = this.scene.cameras.main;
        if (this.x < -50 || this.x > cam.width + 50 || this.y < -50 || this.y > cam.height + 50) {
            this.despawn();
        }
    }

    despawn() {
        this.setActive(false).setVisible(false);
        this.clearTint();
        this.setScale(1);
        if (this.body) { this.body.enable = false; this.body.setVelocity(0, 0); }
    }
}

// ---- Grenade projectile (thrown frag, key F) ----
class GrenadeProj extends Phaser.GameObjects.Image {
    constructor(scene, x, y) {
        super(scene, x, y, 'grenade_proj');
        this.setDepth(25);
    }

    launch(x, y, vx, vy) {
        this.setActive(true).setVisible(true).setPosition(x, y);
        if (this.body) { this.body.enable = true; this.body.setVelocity(vx, vy); }
        var self = this;
        this.scene.time.delayedCall(GameConfig.combat.grenadeFuseMs, function () {
            if (self.active) self.detonate();
        });
    }

    detonate() {
        if (!this.active) return;
        this.scene.explode(this.x, this.y, GameConfig.combat.grenadeRadius, GameConfig.combat.grenadeDamage);
        this.despawn();
    }

    update() {
        if (this.body) {
            this.body.setVelocity(this.body.velocity.x * 0.96, this.body.velocity.y * 0.96);
        }
    }

    despawn() {
        this.setActive(false).setVisible(false);
        if (this.body) { this.body.enable = false; this.body.setVelocity(0, 0); }
    }
}

// ---- Acid projectile (Spitter ranged attack; reuses bullet sprite, tinted green) ----
class AcidProjectile extends Phaser.GameObjects.Image {
    constructor(scene, x, y) {
        super(scene, x, y, 'bullet');
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
            var decay = GameConfig.mobs.spitter.spitDecay;
            this.body.setVelocity(this.body.velocity.x * decay, this.body.velocity.y * decay);
        }
        if (time - this.bornAt > this.maxLife) { this.splash(); return; }
        var cam = this.scene.cameras.main;
        if (this.x < -50 || this.x > cam.width + 50 || this.y < -50 || this.y > cam.height + 50) {
            this.despawn();
        }
    }

    splash() {
        var fx = this.scene.add.circle(this.x, this.y, 14, 0x6ee7b7, 0.5).setDepth(16);
        this.scene.tweens.add({ targets: fx, alpha: 0, scale: 1.6, duration: 300,
            onComplete: function () { fx.destroy(); } });
        this.despawn();
    }

    despawn() {
        this.setActive(false).setVisible(false);
        this.clearTint();
        this.setScale(1);
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

    // spawn(x, y, type, wave) — configure from GameConfig.mobs or bosses
    spawn(x, y, type, wave) {
        this.type = type;
        this.isBoss = (type === 'boss');
        this.setActive(true).setVisible(true).setPosition(x, y);
        this.setTexture(this.isBoss ? 'boss' : type);
        this.invulnerable = false;
        this.lastHitWasCrit = false;
        this.lastDeathWasExplosion = false;
        this.isBounty = false;
        this.clearTint();
        this.setAlpha(1);
        this.lastSpitAt = 0;

        if (this.isBoss) {
            var def = GameConfig.bosses[wave] || GameConfig.bosses[50];
            this.maxHp = def.hp;
            this.hp = def.hp;
            this.speed = def.speed;
            this.contactDamage = def.power;
            this.setScale(def.scale * 0.5);
        } else {
            var mdef = GameConfig.mobs[type];
            this.maxHp = mdef.baseHp + mdef.hpPerWave * (wave - 1);
            this.hp = this.maxHp;
            this.speed = mdef.baseSpeed + mdef.speedPerWave * (wave - 1);
            this.contactDamage = 1;
            this.setScale(GameConfig.arena.mobScale);
        }

        if (this.body) {
            this.body.enable = true;
            this.body.setVelocity(0, 0);
            this.body.setMaxVelocity(this.speed * 1.5, this.speed * 1.5);
        }

        // Burrower: invulnerable while "digging", then charges
        if (type === 'burrower') {
            this.invulnerable = true;
            this.setAlpha(0.4);
            var self = this;
            this.scene.time.delayedCall(GameConfig.combat.burrowerDigMs, function () {
                if (self.active) { self.invulnerable = false; self.setAlpha(1); }
            });
        }
    }

    update(time, delta) {
        if (!this.active) return;
        var p = this.scene.player;
        if (!p.active) { this.body.setVelocity(0, 0); return; }

        // Clamp to road bounds
        var margin = GameConfig.arena.edgeMargin;
        this.x = Phaser.Math.Clamp(this.x, this.scene.roadLeft() + margin, this.scene.roadRight() - margin);

        // Spitter — ranged kiter: hold range, back away, spit on cooldown
        if (this.type === 'spitter') {
            var def = GameConfig.mobs.spitter;
            var dist = Phaser.Math.Distance.Between(this.x, this.y, p.x, p.y);
            var sAng = Phaser.Math.Angle.Between(this.x, this.y, p.x, p.y);
            if (dist > def.spitRange + 40) {
                this.body.setVelocity(Math.cos(sAng) * this.speed, Math.sin(sAng) * this.speed);
            } else if (dist < def.spitRange - 40) {
                this.body.setVelocity(-Math.cos(sAng) * this.speed, -Math.sin(sAng) * this.speed);
            } else {
                this.body.setVelocity(0, 0);
            }
            this.rotation = sAng + Math.PI / 2;
            if (time - (this.lastSpitAt || 0) > def.spitRate && dist <= def.spitRange + 40) {
                this.fireAcid(sAng);
                this.lastSpitAt = time;
            }
            return;
        }

        var ang = Phaser.Math.Angle.Between(this.x, this.y, p.x, p.y);
        this.body.setVelocity(Math.cos(ang) * this.speed, Math.sin(ang) * this.speed);
        this.rotation = ang + Math.PI / 2;
    }

    fireAcid(angle) {
        var def = GameConfig.mobs.spitter;
        var a = this.scene.acidGroup.get();
        if (!a) return;
        a.launch(this.x, this.y, Math.cos(angle) * def.spitSpeed, Math.sin(angle) * def.spitSpeed);
        eventBus.emit('ACID_SPIT', { x: this.x, y: this.y });
    }

    takeDamage(dmg, crit, dirX, dirY, knockback) {
        if (this.invulnerable || !this.active) return;
        this.hp -= dmg;
        this.lastHitWasCrit = !!crit; // Spare Change crit-kill gating
        // Explosion path prints its own orange number in explode(); skip the white one here
        if (!this.lastDeathWasExplosion) {
            this.scene.floatingText(this.x, this.y - 20, Math.round(dmg), crit ? '#ffd43b' : '#ffffff');
        }

        // Directional blood spray
        this.scene.bloodSplat(this.x, this.y, dirX, dirY);

        // Hit flash
        this.setTint(0xff5555);
        var self = this;
        this.scene.time.delayedCall(60, function () {
            if (!self.active) return;
            if (self.isBounty) self.setTint(GameConfig.venture.bountyTint);
            else self.clearTint();
        });

        // Knockback (bosses heavily resist)
        if (dirX !== undefined && this.body && knockback) {
            var factor = this.isBoss ? GameConfig.combat.bossKnockbackFactor
                                     : GameConfig.combat.knockbackFactor;
            this.x += dirX * knockback * factor;
            this.y += dirY * knockback * factor;
        }

        if (this.isBoss) this.scene.updateBossBar();
        if (this.hp <= 0) this.die();
    }

    die() {
        if (!this.active) return;
        var x = this.x, y = this.y;

        // Mutation: Corpse-a-Cola — rupture on death scaling with max HP
        if (GameState.mutations.indexOf('Corpse-a-Cola') !== -1) {
            var cc = GameConfig.mutations['Corpse-a-Cola'];
            this.scene.explode(x, y, cc.radius, this.maxHp * cc.hpDamageMult);
        }

        // Combo + kill accounting
        GameState.kills += 1;
        GameState.combo += 1;
        if (GameState.combo > GameState.maxCombo) GameState.maxCombo = GameState.combo;
        eventBus.emit('COMBO_CHANGED', { combo: GameState.combo });
        eventBus.emit('ENEMY_DIED', { type: this.type, x: x, y: y });

        this.dropLoot(x, y);

        if (this.isBoss) this.scene.hideBossBar();
        this.setActive(false).setVisible(false);
        if (this.body) this.body.enable = false;
        this.scene.director.notifyKill();
    }

    // despawn() — silent removal (run reset), no loot, no kill credit
    despawn() {
        if (this.isBoss) this.scene.hideBossBar();
        this.setActive(false).setVisible(false);
        this.clearTint();
        if (this.body) { this.body.enable = false; this.body.setVelocity(0, 0); }
    }

    dropLoot(x, y) {
        var C = GameConfig.combat;

        // Bounty Hunter — marked grunts drop a single gold coin, nothing else
        if (this.isBounty) {
            this.scene.spawnCoin(x, y, GameConfig.venture.bountyAmount);
            return;
        }

        var tierValue = this.isBoss ? C.bossCoinValue
                                    : (GameConfig.mobs[this.type].cost * C.coinValuePerCost);
        var count = this.isBoss ? C.bossCoinCount : Phaser.Math.Between(C.mobCoinMin, C.mobCoinMax);

        // Spare Change — bonus coins ONLY on crit or explosion kills
        var killedByCritOrBoom = this.lastHitWasCrit || this.lastDeathWasExplosion;
        if (killedByCritOrBoom && GameState.mutations.indexOf('Spare Change') !== -1) {
            count += GameConfig.mutations['Spare Change'].bonusCoins;
        }

        for (var i = 0; i < count; i++) {
            var v = tierValue;
            var midasLvl = GameState.ventureInvestments['midas'] || 0;
            if (midasLvl > 0 &&
                Phaser.Math.Between(1, 100) <= GameConfig.venture.midasChance * midasLvl) {
                v *= GameConfig.venture.midasMult;
            }
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
        // Magnet toward player
        var p = this.scene.player;
        var d = Phaser.Math.Distance.Between(this.x, this.y, p.x, p.y);
        if (d < GameConfig.player.magnetRadius) {
            var ang = Phaser.Math.Angle.Between(this.x, this.y, p.x, p.y);
            this.x += Math.cos(ang) * 6;
            this.y += Math.sin(ang) * 6;
        }
    }

    despawn() {
        this.setActive(false).setVisible(false);
        if (this.body) { this.body.enable = false; this.body.setVelocity(0, 0); }
    }
}

// ---- SupplyCrate ----
// Falls in, parks, self-despawns after a lifetime. Player walks into it to collect.
// Reward: health or grenades, 50/50.
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
        this.restY = this.scene.cameras.main.height + GameConfig.arena.crateRestY;
        if (this.body) {
            this.body.enable = true;
            this.body.setVelocity(0, GameConfig.director.crateFallSpeed);
        }
        eventBus.emit('CRATE_SPAWN', { x: x, y: y, type: this.type });
    }

    update(time) {
        if (!this.active) return;
        if (!this.parked && this.y >= this.restY) {
            this.parked = true;
            this.y = this.restY;
            if (this.body) this.body.setVelocity(0, 0);
        }
        var age = time - this.bornAt;
        var life = GameConfig.director.crateLifespanMs;
        if (age > life) { this.despawn(); return; }
        if (age > life - 1500) this.setAlpha(0.4 + 0.6 * Math.abs(Math.sin(age / 120)));
    }

    open() {
        if (!this.active) return;
        if (this.type === 'health') {
            var old = GameState.hp;
            GameState.hp = Math.min(GameState.maxHp, GameState.hp + 2);
            eventBus.emit('PLAYER_HIT', { new: GameState.hp, old: old });
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

// ---- Barricade ----
class Barricade extends Phaser.GameObjects.Image {
    constructor(scene, x, y, slot) {
        super(scene, x, y, 'barricade');
        this.scene = scene;
        this.setDepth(18);
        this.hp = GameConfig.defenses.barricade.hp;
        this.maxHp = this.hp;
        this.slot = (slot !== undefined) ? slot : -1;
    }

    takeDamage(dmg) {
        if (this.hp <= 0) return;
        this.hp -= dmg;
        // Mutation: Pay It Forward — barricade damage buffs the player
        if (GameState.mutations.indexOf('Pay It Forward') !== -1) {
            this.scene.player.payItForwardTimer = GameConfig.mutations['Pay It Forward'].durationMs;
        }
        this.setTint(0xff5555);
        var self = this;
        this.scene.time.delayedCall(100, function () { if (self.active) self.clearTint(); });
        this.refreshAlpha();
        if (this.hp <= 0) this.die();
    }

    repair(amount) {
        if (this.hp <= 0) return;
        this.hp = Math.min(this.maxHp, this.hp + amount);
        this.refreshAlpha();
    }

    refreshAlpha() {
        this.setAlpha(0.4 + 0.6 * Math.max(0, this.hp / this.maxHp));
    }

    die() {
        if (this.slot >= 0) GameState.barricades[this.slot] = null;
        if (this.scene.barricadeGroup) this.scene.barricadeGroup.remove(this, true, true);
        else this.destroy();
    }

    tick() {}
}

// ---- Turret ----
class Turret {
    constructor(scene, x, y) {
        this.scene = scene;
        this.sprite = scene.add.image(x, y, 'wpn_side_5').setDepth(19).setScale(1.2);
        this.lastFire = 0;
        var def = GameConfig.defenses.turret;
        this.range = def.range;
        this.rate = def.rate;
        this.damage = def.damage;
        this.projectileSpeed = def.projectileSpeed;
    }

    tick(time) {
        if (time - this.lastFire < this.rate) return;
        // Target nearest enemy in range
        var target = null, best = this.range;
        var self = this;
        this.scene.enemyGroup.getChildren().forEach(function (e) {
            if (!e.active || e.invulnerable) return;
            var d = Phaser.Math.Distance.Between(self.sprite.x, self.sprite.y, e.x, e.y);
            if (d < best) { best = d; target = e; }
        });
        if (!target) return;
        this.lastFire = time;
        var ang = Phaser.Math.Angle.Between(this.sprite.x, this.sprite.y, target.x, target.y);
        this.sprite.rotation = ang;
        var stats = { critChance: 0, critMult: 1, pierce: false, splashRadius: 0,
                      range: this.range, speed: this.projectileSpeed, knockback: 0, camShake: 0 };
        this.scene.spawnProjectile(this.sprite.x, this.sprite.y,
            Math.cos(ang) * this.projectileSpeed, Math.sin(ang) * this.projectileSpeed,
            this.damage, stats, Math.cos(ang), Math.sin(ang));
    }
}

// ========== MANAGER CLASSES ==========

// ---- AudioManager (live; silent fallback if a key is missing from cache) ----
class AudioManager {
    constructor(scene) {
        this.scene = scene;
        this.bindEvents();
    }

    play(key, options) {
        options = options || {};
        if (!GameConfig.system.audioEnabled || !key) return;
        // Silent fallback: skip without error if the asset never loaded
        if (!this.scene.cache.audio.has(key)) return;
        var volume = (options.volume != null ? options.volume : 1.0) *
            GameConfig.system.masterVolume * GameConfig.system.sfxVolume;
        if (volume <= 0) return;
        var pv = options.pitchVariance || 0;
        var detune = pv * 1200 + Phaser.Math.FloatBetween(-120, 120);
        try {
            this.scene.sound.play(key, { volume: volume, detune: detune });
        } catch (e) { /* audio context not ready — skip silently */ }
    }

    bindEvents() {
        var self = this;
        eventBus.on('WEAPON_FIRED', function (d) {
            self.play(d.audioKey, { volume: d.audioVol, pitchVariance: d.pitchVariance });
        });
        eventBus.on('EXPLOSION', function () { self.play('sfx_explosion', { volume: 0.8 }); });
        eventBus.on('ACID_SPIT', function () { self.play('sfx_acid_spit', { volume: 0.5 }); });
        eventBus.on('CRATE_SPAWN', function () { self.play('sfx_crate_spawn', { volume: 0.6 }); });
        eventBus.on('CRATE_PICKUP', function () { self.play('sfx_crate_pickup', { volume: 0.7 }); });
        eventBus.on('ENEMY_DIED', function () { self.play('sfx_enemy_die', { volume: 0.4 }); });
    }
}

// SFX key → filename (assets/audio/<file>.wav)
AudioManager.MANIFEST = {
    sfx_pistol: 'pistol',
    sfx_shotgun: 'shotgun',
    sfx_smg: 'smg',
    sfx_rifle: 'rifle',
    sfx_assault: 'assault',
    sfx_lmg: 'lmg',
    sfx_eradicator: 'eradicator',
    sfx_cryo: 'cryo',
    sfx_explosion: 'explosion',
    sfx_acid_spit: 'acid',
    sfx_crate_spawn: 'crate_spawn',
    sfx_crate_pickup: 'crate_pickup',
    sfx_enemy_die: 'enemy_die'
};

// ---- DirectorAI ----
class DirectorAI {
    constructor(scene) {
        this.scene = scene;
        this.reset();
    }

    reset() {
        this.spawning = false;
        this.toSpawn = 0;
        this.alive = 0;
        this.nextSpawnAt = 0;
        this.waveActive = false;
        this.nextSupplyDropAt = 0;
        this.phases = [];
        this.queue = [];
        this.currentPhase = 0;
        this.lastPhaseType = null;
        this.budgetPerPhase = 0;
    }

    // mobBudget(wave) — exponential budget from config
    mobBudget(wave) {
        return Math.floor(GameConfig.director.budgetBase *
            Math.pow(GameConfig.director.budgetScaling, wave));
    }

    // availableMobs(wave) — unlock gates
    availableMobs(wave) {
        var pool = ['grunt'];
        if (wave >= 3) pool.push('sprinter');
        if (wave >= 8) pool.push('spitter');
        if (wave >= 12) pool.push('tank');
        if (wave >= 15) pool.push('burrower');
        return pool;
    }

    // startWave(wave) — budget split into sequential phases
    startWave(wave) {
        this.waveActive = true;
        this.alive = 0;
        this.lastPhaseType = null;
        eventBus.emit('WAVE_STARTED', { wave: wave });

        var totalBudget = this.mobBudget(wave);
        if (wave % 10 === 0) {
            this.spawnBoss(wave);
            totalBudget = Math.floor(totalBudget * 0.5);
        }

        var phaseCount = Math.max(1, GameConfig.director.phaseCount);
        this.budgetPerPhase = Math.floor(totalBudget / phaseCount);
        this.phases = [];
        for (var i = 0; i < phaseCount; i++) {
            var pBudget = (i === phaseCount - 1)
                ? totalBudget - this.budgetPerPhase * (phaseCount - 1)
                : this.budgetPerPhase;
            this.phases.push(this.buildPhaseQueue(wave, pBudget));
        }

        this.currentPhase = 0;
        this.queue = this.phases[0].slice();
        this.toSpawn = this.phases.reduce(function (n, p) { return n + p.length; }, 0);
        this.spawning = true;
        this.nextSpawnAt = this.scene.time.now + 500;
        this.nextPhaseAt = this.scene.time.now + this.phasePauseMs();
        // First crate window opens partway into the wave
        this.nextSupplyDropAt = this.scene.time.now + Phaser.Math.Between(
            GameConfig.director.supplyDropMin, GameConfig.director.supplyDropMax);
    }

    // phasePauseMs() — harder waves wait longer between phases
    phasePauseMs() {
        var d = GameConfig.director;
        var scaled = Math.min(d.phaseScaleCap, (this.budgetPerPhase / d.phaseScalePerBudget) * 1000);
        return d.phaseBasePause + scaled;
    }

    // buildPhaseQueue(wave, budget) — biased away from previous phase's dominant type
    buildPhaseQueue(wave, budget) {
        var pool = this.availableMobs(wave);
        var queue = [];
        var typeCounts = {};
        var spent = 0;
        var guard = 0;
        while (spent < budget && guard < 1000) {
            guard++;
            var type = Phaser.Utils.Array.GetRandom(pool);
            if (this.lastPhaseType && type === this.lastPhaseType && pool.length > 1) {
                type = Phaser.Utils.Array.GetRandom(pool); // one re-roll to bias away
            }
            var cost = GameConfig.mobs[type].cost;
            if (spent + cost > budget && queue.length > 0) break;
            queue.push(type);
            spent += cost;
            typeCounts[type] = (typeCounts[type] || 0) + 1;
        }
        var dom = null, domN = -1;
        Object.keys(typeCounts).forEach(function (t) {
            if (typeCounts[t] > domN) { domN = typeCounts[t]; dom = t; }
        });
        this.lastPhaseType = dom;
        return queue;
    }

    spawnBoss(wave) {
        var cam = this.scene.cameras.main;
        var e = this.scene.enemyGroup.get(cam.centerX, GameConfig.arena.enemySpawnY);
        if (!e) return;
        e.spawn(cam.centerX, GameConfig.arena.enemySpawnY, 'boss', wave);
        this.scene.showBossBar(e);
        this.alive += 1;
    }

    tick(time) {
        // Director freezes entirely while paused or while a tutorial gate is up
        if (GameState.isPaused || GameState.tutorialPending) return;
        if (!this.waveActive) return;

        // Supply crate on cadence (independent of mob spawning)
        if (this.nextSupplyDropAt && time >= this.nextSupplyDropAt) {
            this.spawnSupplyCrate();
            this.nextSupplyDropAt = time + Phaser.Math.Between(
                GameConfig.director.supplyDropMin, GameConfig.director.supplyDropMax);
        }

        if (!this.spawning) return;

        // Advance to next phase when its timer elapses
        if (this.currentPhase < this.phases.length - 1 && time >= this.nextPhaseAt) {
            this.currentPhase++;
            this.queue = this.queue.concat(this.phases[this.currentPhase].slice());
            this.nextPhaseAt = time + this.phasePauseMs();
        }

        // Queue drained but phases remain => idle until next phase
        if (this.queue.length === 0) {
            if (this.currentPhase >= this.phases.length - 1) {
                this.spawning = false;
                // Edge case: last spawn died before queue emptied — recheck clear
                if (this.alive <= 0) this.notifyKill0();
            }
            return;
        }
        if (time < this.nextSpawnAt) return;

        var clump = Phaser.Math.Between(GameConfig.director.burstClumpMin, GameConfig.director.burstClumpMax);
        for (var i = 0; i < clump && this.queue.length > 0; i++) {
            this.spawnMob(this.queue.shift());
        }
        this.nextSpawnAt = time + Phaser.Math.Between(
            GameConfig.director.spawnPauseMin, GameConfig.director.spawnPauseMax);
    }

    // spawnSupplyCrate() — drop a stationary crate at a random road X
    spawnSupplyCrate() {
        var cam = this.scene.cameras.main;
        var half = GameConfig.arena.roadWidth / 2;
        var x = cam.centerX + Phaser.Math.Between(-half + 40, half - 40);
        var crate = this.scene.crateGroup.get();
        if (!crate) return;
        crate.spawn(x, GameConfig.arena.enemySpawnY);
    }

    spawnMob(type) {
        var cam = this.scene.cameras.main;
        var half = GameConfig.arena.roadWidth / 2;
        var margin = GameConfig.arena.edgeMargin;
        var x = cam.centerX + Phaser.Math.Between(-half + margin, half - margin);
        var y = GameConfig.arena.enemySpawnY; // off the top edge — always >200px from the player
        var e = this.scene.enemyGroup.get(x, y);
        if (!e) return;
        e.spawn(x, y, type, GameState.wave);

        // Bounty Hunter venture — mark a fraction of grunts as gold-bearing
        var bountyLvl = GameState.ventureInvestments['bounty'] || 0;
        if (type === 'grunt' && bountyLvl > 0 &&
            Phaser.Math.Between(1, 100) <= GameConfig.venture.bountyChance) {
            e.isBounty = true;
            e.setTint(GameConfig.venture.bountyTint);
        }
        this.alive += 1;
    }

    notifyKill() {
        this.alive -= 1;
        if (this.alive < 0) this.alive = 0;
        this.notifyKill0();
    }

    notifyKill0() {
        if (this.alive <= 0 && !this.spawning && this.queue.length === 0 && this.waveActive) {
            this.waveActive = false;
            eventBus.emit('WAVE_CLEARED', { wave: GameState.wave });
        }
    }

    // Dev tool: KILL ALL
    killAll() {
        this.queue = [];
        this.phases = [];
        this.currentPhase = 0;
        this.spawning = false;
        this.scene.enemyGroup.getChildren().forEach(function (e) { if (e.active) e.die(); });
        this.notifyKill0();
    }
}

// ---- HUDManager (wires the static DOM HUD in index.html) ----
class HUDManager {
    constructor(scene) {
        this.scene = scene;
        this.root = document.getElementById('hud-root');
        this.devPanel = document.getElementById('hud-dev');
        this.buildDevButtons();
        this.bindEvents();
        this.setDevPanelVisible(GameState.devOverrides);
    }

    buildDevButtons() {
        var scene = this.scene;
        var panel = this.devPanel;
        var mk = function (label, fn) {
            var b = document.createElement('button');
            b.textContent = label;
            b.addEventListener('click', fn);
            panel.appendChild(b);
            return b;
        };
        mk(FlavorText.dev.godMode + ' OFF', function (e) {
            GameState.godMode = !GameState.godMode;
            e.target.textContent = FlavorText.dev.godMode + (GameState.godMode ? ' ON' : ' OFF');
        });
        mk(FlavorText.dev.funds, function () { scene.addFunds(10000); });
        mk(FlavorText.dev.unlockWeapons, function () {
            GameConfig.weapons.forEach(function (w, i) {
                if (GameState.unlockedWeapons.indexOf(i) === -1) GameState.unlockedWeapons.push(i);
            });
        });
        mk(FlavorText.dev.skipWave, function () { scene.director.killAll(); });
    }

    bindEvents() {
        var self = this;
        var $ = function (id) { return document.getElementById(id); };
        eventBus.on('WAVE_STARTED', function (d) {
            $('hud-wave').textContent = FlavorText.hud.wave + ' ' + d.wave;
            self.refreshAll();
        });
        eventBus.on('FUNDS_CHANGED', function (d) { $('hud-funds').textContent = '$' + d.new; });
        eventBus.on('PLAYER_HIT', function () { self.refreshHP(); });
        eventBus.on('ARMOR_CHANGED', function () { self.refreshArmor(); });
        eventBus.on('GRENADES_CHANGED', function () { self.refreshGrenades(); });
        eventBus.on('AMMO_CHANGED', function () { self.refreshWeapon(); });
        eventBus.on('WEAPON_SWAPPED', function () { self.refreshWeapon(); });
        eventBus.on('WEAPON_EQUIPPED', function () { self.refreshWeapon(); });
        eventBus.on('WEAPON_EVOLVED', function () { self.refreshWeapon(); });
        eventBus.on('RELOAD_START', function () { $('hud-ammo').textContent = 'RELOAD...'; });
        eventBus.on('COMBO_CHANGED', function (d) {
            $('hud-combo').textContent = d.combo > GameConfig.hud.comboDisplayMin
                ? FlavorText.hud.combo + ' x' + d.combo : '';
        });
    }

    refreshAll() {
        this.refreshHP(); this.refreshArmor(); this.refreshGrenades(); this.refreshWeapon();
        document.getElementById('hud-funds').textContent = '$' + GameState.funds;
        document.getElementById('hud-combo').textContent = '';
    }
    refreshHP() {
        document.getElementById('hud-hp').textContent =
            FlavorText.hud.hp + ' ' + Array(Math.max(0, GameState.hp) + 1).join('\u2665');
    }
    refreshArmor() {
        document.getElementById('hud-armor').textContent = GameState.armor > 0
            ? FlavorText.hud.armor + ' ' + Array(GameState.armor + 1).join('\u25AE') : '';
    }
    refreshGrenades() {
        document.getElementById('hud-grenades').textContent = GameState.grenades > 0
            ? FlavorText.hud.grenades + ' ' + GameState.grenades : '';
    }
    refreshWeapon() {
        var wpnId = activeWeaponId();
        var wpn = GameConfig.weapons[wpnId];
        document.getElementById('hud-wpn-name').textContent = wpn.name;
        document.getElementById('hud-ammo').textContent = GameState.isReloading
            ? 'RELOAD...'
            : GameState.ammo[wpnId] + ' / ' + Math.round(getModifiedStats(wpnId).magSize);
    }

    showTransmission(msg) {
        var t = document.getElementById('hud-transmission');
        t.textContent = msg;
        t.style.display = 'block';
        clearTimeout(this._txTimer);
        this._txTimer = setTimeout(function () { t.style.display = 'none'; },
            GameConfig.hud.transmissionAutoHideMs);
    }

    // showTutorialGate(msg, onDismiss) — persistent transmission with an ACKNOWLEDGE
    // button. No auto-dismiss; click or SPACE/ENTER resumes the wave.
    showTutorialGate(msg, onDismiss) {
        var t = document.getElementById('hud-transmission');
        clearTimeout(this._txTimer);
        t.style.display = 'block';
        t.innerHTML = '';

        var body = document.createElement('div');
        body.textContent = msg;
        body.style.marginBottom = '12px';
        t.appendChild(body);

        var btn = document.createElement('button');
        btn.className = 'btn';
        btn.textContent = '[ ACKNOWLEDGE ]';
        btn.style.margin = '0';
        btn.style.padding = '8px 16px';
        btn.style.fontSize = '0.9em';
        btn.style.pointerEvents = 'auto';
        t.appendChild(btn);

        var prevPE = t.style.pointerEvents;
        t.style.pointerEvents = 'auto';

        this._gateDone = false;
        var self = this;
        var dismiss = function () {
            if (self._gateDone) return;
            self._gateDone = true;
            window.removeEventListener('keydown', onKey);
            t.style.pointerEvents = prevPE;
            t.style.display = 'none';
            t.innerHTML = '';
            onDismiss();
        };
        var onKey = function (e) {
            if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); dismiss(); }
        };

        btn.addEventListener('click', dismiss);
        window.addEventListener('keydown', onKey);
    }

    flashWaveClear() {
        var t = document.getElementById('hud-transmission');
        t.textContent = FlavorText.waveClear;
        t.style.display = 'block';
        setTimeout(function () { t.style.display = 'none'; }, GameConfig.hud.waveClearFlashMs);
    }

    show() {
        this.root.style.display = 'block';
        this.refreshAll();
        document.getElementById('hud-wave').textContent = FlavorText.hud.wave + ' ' + GameState.wave;
    }
    hide() { this.root.style.display = 'none'; }
    setDevPanelVisible(v) { this.devPanel.style.display = v ? 'flex' : 'none'; }
}

// ---- ShopManager (wires the static #screen-shop modal) ----
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
        var self = this;
        this.modal.querySelectorAll('.shop-tab').forEach(function (b) {
            b.addEventListener('click', function () {
                self.activeTab = b.dataset.tab;
                self.render();
            });
        });
        document.getElementById('btn-return-battlefield').addEventListener('click', function () {
            self.close();
            eventBus.emit('RETURN_TO_BATTLEFIELD');
        });
    }

    open() { this.scene.hideAllModals(); this.modal.classList.add('active'); this.render(); }
    close() { this.modal.classList.remove('active'); }

    render() {
        var body = this.body;
        body.innerHTML = '';
        body.appendChild(this.buildBioMonitor());
        var funds = document.createElement('div');
        funds.className = 'shop-funds';
        funds.textContent = 'FUNDS: $' + GameState.funds;
        body.appendChild(funds);
        if (this.activeTab === 'firearms') this.renderFirearms(body);
        else if (this.activeTab === 'logistics') this.renderLogistics(body);
        else this.renderVenture(body);
    }

    // Operator bio-monitor header: HP / Armor / Speed
    buildBioMonitor() {
        var s = FlavorText.shop;
        var bio = document.createElement('div');
        bio.className = 'bio-monitor';
        bio.innerHTML =
            '<div class="bio-head">' + s.operatorStatus + ' \u2014 ' + s.bioMonitor + '</div>' +
            '<div class="bio-row"><span>' + s.maxHp + '</span><span>' + GameState.hp + ' / ' + GameState.maxHp + '</span></div>' +
            '<div class="bio-row"><span>' + s.armor + '</span><span>' + GameState.armor + ' / ' + GameState.maxArmor + '</span></div>' +
            '<div class="bio-row"><span>' + s.baseSpeed + '</span><span>' + GameConfig.player.baseSpeed + '</span></div>';
        return bio;
    }

    renderFirearms(body) {
        var self = this;
        // Weapon rack: 15 slots
        var rack = document.createElement('div');
        rack.id = 'shop-rack';
        GameConfig.weapons.forEach(function (w, i) {
            var unlocked = GameState.unlockedWeapons.indexOf(i) !== -1;
            var isEvolution = GameConfig.economy.chassisConversionCosts[i] !== undefined;
            var slot = document.createElement('button');
            slot.className = 'btn' + (unlocked ? '' : ' locked');
            if (unlocked) {
                var img = document.createElement('img');
                img.src = 'assets/svgs/wpn_side_' + w.iconId + '.svg';
                img.alt = w.name;
                slot.appendChild(img);
                var label = document.createElement('span');
                label.textContent = w.name;
                slot.appendChild(label);
            } else if (isEvolution) {
                slot.textContent = FlavorText.shop.classifiedWeapon;
            } else {
                slot.textContent = w.name + ' $' + GameConfig.economy.baseBuyInCosts[i];
            }
            slot.addEventListener('click', function () {
                if (!unlocked) { self.tryBuyWeapon(i); }
                else { self.selectedWeapon = i; self.render(); }
            });
            rack.appendChild(slot);
        });
        body.appendChild(rack);

        // Keep selection valid (evolution removes the old weapon)
        if (GameState.unlockedWeapons.indexOf(this.selectedWeapon) === -1) {
            this.selectedWeapon = GameState.unlockedWeapons[0];
        }

        // Mastery tracks for selected weapon
        this.renderMastery(body, this.selectedWeapon);

        // Equip buttons
        var equipP = this._mkBtn(FlavorText.shop.equipPrimary, function () {
            GameState.primaryWeapon = self.selectedWeapon;
            GameState.activeSlot = 'primary';
            eventBus.emit('WEAPON_EQUIPPED', { slot: 'primary', wpnId: self.selectedWeapon });
            self.render();
        });
        var equipS = this._mkBtn(FlavorText.shop.equipSecondary, function () {
            GameState.secondaryWeapon = self.selectedWeapon;
            eventBus.emit('WEAPON_EQUIPPED', { slot: 'secondary', wpnId: self.selectedWeapon });
            self.render();
        });
        if (GameState.unlockedWeapons.indexOf(this.selectedWeapon) === -1) {
            equipP.classList.add('locked');
            equipS.classList.add('locked');
        }
        body.appendChild(equipP);
        body.appendChild(equipS);
    }

    renderMastery(body, wpnId) {
        var self = this;
        var w = GameConfig.weapons[wpnId];
        var arch = GameConfig.mastery.archetypes[w.archetype];
        var mastery = GameState.weaponMastery[wpnId];
        var wrap = document.createElement('div');
        wrap.className = 'mastery-wrap';
        wrap.innerHTML = '<div class="mastery-head">' + w.name + ' \u2014 ' + w.archetype.toUpperCase() + '</div>';

        ['track1', 'track2', 'track3'].forEach(function (tk) {
            var def = arch[tk];
            var lvl = mastery[tk];
            var cost = self.upgradeCost(wpnId);
            var row = document.createElement('div');
            row.className = 'mastery-row';
            var maxed = lvl >= GameConfig.mastery.maxLevel;
            row.innerHTML = '<span>' + def.label + ' [' + lvl + '/' + GameConfig.mastery.maxLevel + ']</span>';
            var btn = document.createElement('button');
            btn.className = 'btn' + ((maxed || GameState.funds < cost) ? ' locked' : '');
            btn.textContent = maxed ? 'MAX' : '$' + cost;
            if (!maxed) btn.addEventListener('click', function () { self.tryUpgrade(wpnId, tk); });
            row.appendChild(btn);
            wrap.appendChild(row);
        });

        // Chassis conversion (max all tracks => evolve)
        if (w.evolvesTo !== undefined) {
            var allMax = ['track1', 'track2', 'track3'].every(function (t) {
                return mastery[t] >= GameConfig.mastery.maxLevel;
            });
            var cost = GameConfig.economy.chassisConversionCosts[w.evolvesTo];
            var evo = this._mkBtn(FlavorText.shop.chassisConversion + ' \u2192 ' +
                GameConfig.weapons[w.evolvesTo].name + ' ($' + cost + ')',
                function () { self.tryEvolve(wpnId); });
            if (!allMax || GameState.funds < cost) evo.classList.add('locked');
            wrap.appendChild(evo);
        }
        body.appendChild(wrap);
    }

    renderLogistics(body) {
        var self = this;
        var wave = GameState.wave;
        var sc = GameConfig.economy.supplyCosts;
        // Gated items are hidden entirely until their wave is reached
        var add = function (label, cost, fn, visible) {
            if (visible === false) return;
            var b = self._mkBtn(label + ' ($' + cost + ')', fn);
            if (GameState.funds < cost) b.classList.add('locked');
            body.appendChild(b);
        };
        add(FlavorText.logistics.kevlar, sc.armor, function () {
            if (GameState.funds >= sc.armor && GameState.armor < GameState.maxArmor) {
                self.scene.addFunds(-sc.armor);
                GameState.armor += 1;
                eventBus.emit('ARMOR_CHANGED', { new: GameState.armor, old: GameState.armor - 1 });
                self.render();
            }
        });
        add(FlavorText.logistics.grenades, sc.grenade, function () {
            if (GameState.funds >= sc.grenade) {
                self.scene.addFunds(-sc.grenade);
                GameState.grenades += 1;
                eventBus.emit('GRENADES_CHANGED', { grenades: GameState.grenades });
                self.render();
            }
        }, wave >= 5);
        add(FlavorText.logistics.barricade, sc.buildBarricade,
            function () { self.tryBuildBarricade(); }, wave >= 12);
        add(FlavorText.logistics.repair, sc.repairBarricade,
            function () { self.tryRepair(); }, wave >= 12);
        add(FlavorText.logistics.turret, GameConfig.economy.upgradeBaseCosts.turret,
            function () { self.tryBuildTurret(); }, wave >= 20);
    }

    renderVenture(body) {
        var self = this;
        if (GameState.wave < GameConfig.venture.unlockWave) {
            var note = document.createElement('div');
            note.className = 'venture-locked';
            note.textContent = FlavorText.venture.encrypted;
            body.appendChild(note);
            return;
        }
        var v = FlavorText.venture;
        var opts = [
            { key: 'midas', name: v.midas, desc: v.midasDesc },
            { key: 'interest', name: v.interest, desc: v.interestDesc },
            { key: 'bounty', name: v.bounty, desc: v.bountyDesc },
            { key: 'inflation', name: v.inflation, desc: v.inflationDesc }
        ];
        opts.forEach(function (o) {
            var lvl = GameState.ventureInvestments[o.key] || 0;
            var cost = GameConfig.venture.baseCost * (lvl + 1);
            var b = self._mkBtn(o.name + ' [' + lvl + '] \u2014 ' + o.desc + ' ($' + cost + ')',
                function () {
                    if (GameState.funds >= cost) {
                        self.scene.addFunds(-cost);
                        GameState.ventureInvestments[o.key] = lvl + 1;
                        self.render();
                    }
                });
            if (GameState.funds < cost) b.classList.add('locked');
            body.appendChild(b);
        });
    }

    // ---- shop actions ----
    upgradeCost(wpnId) {
        var m = GameState.weaponMastery[wpnId];
        var bought = m.track1 + m.track2 + m.track3;
        return Math.floor(GameConfig.weapons[wpnId].baseUpgradeCost *
            Math.pow(GameConfig.mastery.costScaling, bought));
    }

    tryUpgrade(wpnId, track) {
        var cost = this.upgradeCost(wpnId);
        if (GameState.funds < cost) return;
        if (GameState.weaponMastery[wpnId][track] >= GameConfig.mastery.maxLevel) return;
        this.scene.addFunds(-cost);
        GameState.weaponMastery[wpnId][track] += 1;
        eventBus.emit('WEAPON_UPGRADED', { wpnId: wpnId, track: track });
        this.render();
    }

    tryBuyWeapon(i) {
        var cost = GameConfig.economy.baseBuyInCosts[i];
        if (cost === undefined) return; // evolution-only weapon, not directly buyable
        if (GameState.funds < cost) return;
        this.scene.addFunds(-cost);
        GameState.unlockedWeapons.push(i);
        this.selectedWeapon = i;
        this.render();
    }

    tryEvolve(wpnId) {
        var w = GameConfig.weapons[wpnId];
        var target = w.evolvesTo;
        var m = GameState.weaponMastery[wpnId];
        var allMax = ['track1', 'track2', 'track3'].every(function (t) {
            return m[t] >= GameConfig.mastery.maxLevel;
        });
        var cost = GameConfig.economy.chassisConversionCosts[target];
        if (!allMax || GameState.funds < cost) return;
        this.scene.addFunds(-cost);
        if (GameState.unlockedWeapons.indexOf(target) === -1) GameState.unlockedWeapons.push(target);
        // Previous tier disappears; equip evolution where the old one was equipped
        if (GameState.primaryWeapon === wpnId) GameState.primaryWeapon = target;
        if (GameState.secondaryWeapon === wpnId) GameState.secondaryWeapon = target;
        GameState.unlockedWeapons = GameState.unlockedWeapons.filter(function (x) { return x !== wpnId; });
        GameState.ammo[target] = Math.round(getModifiedStats(target).magSize); // refill on evolution
        this.selectedWeapon = target;
        eventBus.emit('WEAPON_EVOLVED', { from: wpnId, to: target });
        this.render();
    }

    tryBuildBarricade() {
        var cost = GameConfig.economy.supplyCosts.buildBarricade;
        var slot = GameState.barricades.findIndex(function (b) { return b === null; });
        if (GameState.funds < cost || slot < 0) return;
        this.scene.addFunds(-cost);
        var cam = this.scene.cameras.main;
        var slots = GameConfig.defenses.barricade.slots;
        var roadWidth = GameConfig.arena.roadWidth;
        // Evenly spaced across the road width
        var x = this.scene.roadLeft() + (slot + 0.5) * (roadWidth / slots);
        var y = cam.height + GameConfig.arena.barricadeY;
        var bar = new Barricade(this.scene, x, y, slot);
        this.scene.add.existing(bar);
        this.scene.barricadeGroup.add(bar);
        GameState.barricades[slot] = { hp: bar.hp };
        this.render();
    }

    tryRepair() {
        var cost = GameConfig.economy.supplyCosts.repairBarricade;
        var bars = this.scene.barricadeGroup.getChildren().filter(function (b) { return b.active; });
        if (GameState.funds < cost || bars.length === 0) return;
        this.scene.addFunds(-cost);
        var frac = GameConfig.defenses.barricade.repairFraction;
        bars.forEach(function (b) { b.repair(Math.floor(b.maxHp * frac)); });
        this.render();
    }

    tryBuildTurret() {
        var cost = GameConfig.economy.upgradeBaseCosts.turret;
        if (GameState.funds < cost) return;
        this.scene.addFunds(-cost);
        var cam = this.scene.cameras.main;
        var t = new Turret(this.scene,
            cam.centerX + Phaser.Math.Between(-150, 150),
            cam.height + GameConfig.arena.turretY);
        GameState.defenses.push({ type: 'turret', entity: t });
        this.render();
    }

    _mkBtn(label, fn) {
        var b = document.createElement('button');
        b.className = 'btn shop-action';
        b.textContent = label;
        b.addEventListener('click', fn);
        return b;
    }
}

// ---- HarvestManager (wires the static #screen-harvest modal) ----
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
        var cards = this.cardsEl;
        cards.innerHTML = '';
        var self = this;

        var available = Object.keys(FlavorText.mutations).filter(function (k) {
            return GameState.mutations.indexOf(k) === -1;
        });
        if (available.length === 0) { this.grantConsolation(cards); return; }
        var picks = Phaser.Utils.Array.Shuffle(available.slice()).slice(0, 3);

        picks.forEach(function (key) {
            var mut = FlavorText.mutations[key];
            var card = document.createElement('button');
            card.className = 'btn';
            card.innerHTML = '<div class="harvest-title">' + mut.title + '</div>' +
                '<div class="harvest-desc">' + mut.desc + '</div>' +
                '<div class="harvest-quote">' + mut.quote + '</div>';
            card.addEventListener('click', function () { self.choose(key); });
            cards.appendChild(card);
        });
    }

    grantConsolation(cards) {
        var note = document.createElement('div');
        note.className = 'harvest-consolation';
        note.textContent = FlavorText.harvest.noMutations;
        cards.appendChild(note);
        this.scene.addFunds(500);
        var self = this;
        this.scene.time.delayedCall(1500, function () {
            self.close();
            eventBus.emit('MUTATION_CHOSEN');
        });
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
loadSettings();

var config = {
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
window.getModifiedStats = getModifiedStats;
window.activeWeaponId = activeWeaponId;

// ======== CLOUDFLARE KV SYNC (STUB — NOT ACTIVE) ========
// To activate: deploy a Cloudflare Worker at /api/kv that proxies to a KV namespace.
// Replace the localStorage calls in loadSettings/saveSettings with these once live.
//
// async function saveToKV(key, value) {
//   await fetch(`/api/kv/${key}`, {
//     method: 'PUT',
//     headers: { 'Content-Type': 'application/json' },
//     body: JSON.stringify(value)
//   });
// }
//
// async function loadFromKV(key) {
//   const r = await fetch(`/api/kv/${key}`);
//   if (!r.ok) return null;
//   return r.json();
// }
