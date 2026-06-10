// UNDEAD BARRAGE — flavor.js
// Every player-facing string lives here. game.js contains zero literal copy.
// Tone target: fun-dark. The horror is the punchline.

const FLAVOR = {

  TITLE: 'UNDEAD BARRAGE',
  SUBTITLE: 'Hold the road. Harvest the bosses. Try to stay mostly human.',
  START_BUTTON: 'Deploy',
  CONTROLS: [
    'WASD / Arrows — move',
    'Mouse — aim, hold to fire',
    'R — reload · Q — swap weapon · G — grenade',
    'P / Esc — pause'
  ],

  HUD: {
    wave: 'WAVE', gold: 'GOLD', kills: 'KILLS', heat: 'HEAT',
    armor: 'PLATES', grenades: 'GRENADES', reloading: 'RELOADING…',
    venting: 'VENTING…', infinite: 'OVERTIME'
  },

  WEAPONS: {
    ranger: { name: 'The Ranger', desc: 'Semi-auto marksman rifle. One bullet, one opinion.',
      evolvedName: 'RAILSPIKE', evolvedDesc: 'Bullets no longer acknowledge the concept of "stopping." Crits detonate.' },
    hornet: { name: 'The Hornet', desc: 'SMG. Accuracy is a social construct.',
      evolvedName: 'LOCUST SWARM', evolvedDesc: 'Twin streams. Bullets bounce to a second victim out of spite.' },
    judge:  { name: 'The Judge', desc: 'Pump shotgun. Delivers verdicts at conversational distance.',
      evolvedName: 'THE GAVEL', evolvedDesc: 'Every blast carries a shockwave. Court is permanently in session.' },
    mortar: { name: 'The Mortar', desc: 'Lobbed explosives. Solves crowds. Creates different problems.',
      evolvedName: 'DOOMSAYER', evolvedDesc: 'Shells split into cluster bomblets. The forecast is shrapnel.' },
    prism:  { name: 'The Prism', desc: 'Continuous beam. Doesn\u2019t reload. It sulks (overheats) instead.',
      evolvedName: 'SUNLANCE', evolvedDesc: 'A wider, angrier beam that sets the dead on fire. Again.' }
  },
  TRACKS: { dmg: 'Damage', handling: 'Handling', special: 'Special' },
  TRACK_DESC: {
    ranger:  { dmg: 'Bigger holes.', handling: 'Faster cycling, faster reloads.', special: 'Crit chance and pierce.' },
    hornet:  { dmg: 'Each bee stings harder.', handling: 'Faster spray, deeper mags.', special: 'Tighter spread, longer reach.' },
    judge:   { dmg: 'Heavier shot.', handling: 'Faster pumps and reloads.', special: 'More pellets, more shove.' },
    mortar:  { dmg: 'Bigger boom.', handling: 'Faster lobs, faster shells.', special: 'Wider blast radius.' },
    prism:   { dmg: 'Hotter beam.', handling: 'Runs cooler, recovers faster.', special: 'Wider, longer beam.' }
  },

  MUTATIONS: {
    adrenal:   { name: 'Adrenal Glands', desc: '+15% move speed, +10% fire rate.',
      flavor: 'Your heart now beats in double time. It\u2019s probably fine.' },
    chitin:    { name: 'Chitin Plating', desc: '+30 max HP. -5% move speed.',
      flavor: 'Your skin clicks when you walk. Bullets bounce. Hugs are over.' },
    hemovore:  { name: 'Hemovore', desc: 'Kills sometimes restore HP.',
      flavor: 'You don\u2019t drink it. It just... absorbs. Through the skin. Don\u2019t ask.' },
    boneSpurs: { name: 'Bone Spurs', desc: 'Touching enemies wounds and shoves them.',
      flavor: 'You are now your own barbed wire. Handshakes discontinued.' },
    scavenger: { name: 'Scavenger Gut', desc: '+25% gold from kills.',
      flavor: 'A second stomach for valuables. You hear coins digesting. Soothing, honestly.' },
    twitch:    { name: 'Twitch Reflex', desc: '+15% crit chance.',
      flavor: 'Your eyes flick to weak points before you decide to look. Who decided, then?' },
    acidBlood: { name: 'Acid Blood', desc: 'Taking a hit sprays acid at nearby enemies.',
      flavor: 'You bleed lawsuits. Everything near your wounds regrets existing.' },
    howler:    { name: 'Howler Lungs', desc: 'Reloading or venting blasts a fear pulse that shoves and slows.',
      flavor: 'You scream while reloading now. Involuntarily. The dead scream back, but politely, from farther away.' },
    tumor:     { name: 'Tumor Battery', desc: '+40% damage while above 75% HP.',
      flavor: 'Something in your chest stores power. It hums when you\u2019re healthy. It hums a song you almost recognize.' },
    splitter:  { name: 'Splitter Marrow', desc: 'Kills sometimes burst into bone shrapnel.',
      flavor: 'Your victims explode into needles. The needles are technically yours. Legally murky.' },
    predator:  { name: 'Predator Eyes', desc: 'Enemies under 20% HP take double damage.',
      flavor: 'You can see the exact moment a thing gives up. It glows. Delicious— noted. It glows.' },
    graft:     { name: 'Graft Arms', desc: 'Every shot fires +1 projectile.',
      flavor: 'A third arm steadies every weapon. It has opinions about your aim. They\u2019re correct.' },
    halo:      { name: 'Necrotic Halo', desc: 'A decay aura constantly damages nearby enemies.',
      flavor: 'Grass dies where you stand. The dead die where you stand. A theme is emerging.' },
    hiveHeart: { name: 'Hive Heart', desc: 'Getting hit may release a parasite that hunts for you.',
      flavor: 'Your heart has tenants now. They pay rent in violence. Honestly, great tenants.' },
    mitosis:   { name: 'Mitosis', desc: 'Once per wave, cheat death and detonate.',
      flavor: 'You die, briefly. A backup of you disagrees with the outcome. Loudly. Explosively.' },
    apex:      { name: 'Apex Strain', desc: 'Permanent damage per kill this run (caps at +100%).',
      flavor: 'Every kill feeds something that keeps score. You used to keep score in your head. It used to be your head.' },
    cashName: 'Hazard Pay',
    cashDesc: 'Take the money. Stay yourself. For now.',
    cashFlavor: 'The Quartermaster slides the envelope over without making eye contact. Relief? Disappointment? Both.'
  },

  // Quartermaster dialogue, staged by mutation count: 0, 1-2, 3-4, 5-6, 7+
  QM: {
    name: 'QUARTERMASTER ODOM',
    shop: [
      [ 'Inventory\u2019s open. Spend it before you\u2019re dead, that\u2019s the system.',
        'Standard requisitions. Sign nothing, owe nothing.',
        'Ammo\u2019s free. Everything that makes ammo interesting is not.' ],
      [ 'You look... taller? Forget it. Buying or browsing?',
        'Heard you took a souvenir off that boss. Bold. Gross. Mostly gross.',
        'Your vitals came back weird. Lab says "don\u2019t worry." Lab also says "don\u2019t touch him."' ],
      [ 'I\u2019m going to hand you the merchandise from over here, if that\u2019s alright.',
        'Your eyes follow me even when you\u2019re facing the wall. Anyway. Sales.',
        'Command asked if you\u2019re "still viable." I said yes. I didn\u2019t say "as what."' ],
      [ 'Please stop smiling. Whatever that is now, stop doing it.',
        'I counted your fingers while you slept. I got two different numbers.',
        'You\u2019re still the best thing between us and the horde. You\u2019re also rapidly becoming a third thing.' ],
      [ 'Take whatever you want. Please. Just— take it and step back.',
        'There\u2019s a betting pool on whether you remember my name. I bet against you. No offense, sir. Or... whatever.',
        'When this is over, there\u2019s a form I\u2019m supposed to fill out about you. There is no box for you anymore.' ]
    ],
    waveIntro: [
      [ 'Contacts inbound. Light \u2019em up.', 'Movement up the road. Same as always.', 'Here they come. Try to leave some pavement.' ],
      [ 'Sensors are picking up the horde... and also you. Separately. Anyway, inbound.', 'They\u2019re coming. You sound excited. Don\u2019t be excited.' ],
      [ 'Inbound. The horde\u2019s moving around you, you notice that? Like water around a rock.', 'They\u2019re coming. You growled. You definitely growled just now.' ],
      [ 'Contacts inbound. They\u2019re hesitating. The HORDE is hesitating.', 'Movement up the road. Some of them are moving AWAY. From you.' ],
      [ 'Inbound. At this point I\u2019m honestly briefing both sides.', 'They\u2019re coming. Or paying tribute. Hard to tell anymore.' ]
    ],
    bossIntro: [ 'Big signature inbound. That\u2019s a boss. Doctrine says "good luck."',
      'Something heavy is coming down the road. The ground\u2019s complaining about it.',
      'Boss-class contact. Kill it, loot it, and please, PLEASE think twice at the loot part.' ]
  },

  // Post-boss-kill modal: visceral, darkly funny, escalating with mutation count.
  BOSS_MODALS: {
    butcher: {
      title: 'THE BUTCHER FALLS',
      body: 'It comes apart like bad luggage. In the steam and the stink, something glistens in the wreckage — a gland, a nerve, a wet little engine of whatever made it monstrous. Your hand is reaching for it before you vote on the matter.'
    },
    matriarch: {
      title: 'THE MATRIARCH BURSTS',
      body: 'She deflates with a sound you will be describing to therapists, plural. Among the acid and the afterbirth: viable tissue, still pulsing, still inviting. You salivate. You notice you salivate. You file that away very, very deep.'
    },
    colossus: {
      title: 'THE COLOSSUS CRUMBLES',
      body: 'It kneels like a demolished cathedral. Inside the rubble of its chest, the core organ beats a slow, patient rhythm — and your own heart, traitor that it is, syncs up on the second beat. Harvest it. You were always going to.'
    },
    generic: {
      title: 'THE STRAIN FALLS',
      body: 'Another giant, another harvest. The cutting goes faster now. You don\u2019t use the knife anymore. You\u2019re not sure when you stopped needing the knife.'
    },
    qmReact: [
      'Odom, over comms: "Confirmed kill. Recovery team en route. ...You\u2019re recovering it yourself? With your— okay. Okay! Noted."',
      'Odom, over comms: "Great work. The hell are you doing. Why are you kneeling next to it. WHY ARE YOU—" [comms muted]',
      'Odom, over comms: "Kill confirmed. Look, the science team begs you, just ONE sample for the lab before you... do the thing you do."',
      'Odom, over comms: "Target down. I\u2019m not watching this part anymore. I\u2019ve seen this part. I have dreams about this part."',
      'Odom, over comms, very quietly: "Target down. Bon app\u00e9tit, sir."'
    ],
    pickPrompt: 'CHOOSE YOUR HARVEST'
  },

  SHOP: {
    title: 'REQUISITIONS',
    nextWave: 'Next Wave',
    owned: 'OWNED', maxed: 'MAXED',
    evolve: 'EVOLVE',
    evolveLocked: 'Max all 3 tracks to evolve',
    buySecondary: 'Sidearm Locker',
    secondaryHint: 'Pick one secondary. Q swaps in the field.',
    armor: 'Armor Plate', armorDesc: '-1 damage from every hit. Stacks to 5.',
    grenade: 'Frag Grenade', grenadeDesc: 'G to throw. Crowd negotiation device.',
    heal: 'Field Stitches', healDesc: 'Restore 30 HP. Smells like burnt hair. Works.',
    barricade: 'Barricade', barricadeDesc: 'Blocks the road until it doesn\u2019t.',
    turret: 'Sentry Turret', turretDesc: 'Auto-fires for 2 waves, then files for retirement.',
    cantAfford: 'Not enough gold',
    defensesLocked: 'Unlocks after wave 10'
  },

  WAVE_BANNER: { wave: 'WAVE', boss: 'BOSS WAVE', clear: 'WAVE CLEAR', overtime: 'OVERTIME — WAVE' },

  GAMEOVER: {
    title: 'YOU DIED',
    titleMutated: 'IT DIED',
    statsWave: 'Waves survived', statsKills: 'Kills', statsGold: 'Gold earned', statsMutations: 'Mutations harvested',
    epitaphs: [
      'The road is quiet for almost four minutes. Then it isn\u2019t.',
      'Odom files the report. Under "cause of death" he writes: "math."',
      'Your last thought is, surprisingly, about lunch.'
    ],
    epitaphsMutated: [
      'The horde steps over you respectfully. Professional courtesy.',
      'Odom files the report. Under "species" he leaves a long, careful blank.',
      'Something with your face gets up afterward. It is not in the mood.'
    ],
    restart: 'Run It Back'
  },

  PAUSE: { title: 'PAUSED', resume: 'Resume', body: 'The horde waits. Unprofessional of them, but appreciated.' },

  REVIVE_TEXT: 'MITOSIS — A BACKUP OF YOU OBJECTS',

  DEFENSES: { barricadeDown: 'Barricade destroyed', turretExpired: 'Sentry retired' }
};
