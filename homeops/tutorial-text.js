// tutorial-text.js
// All tutorial copy, preloaded tasks, and XP values
// Zero logic, pure data export

export const TUTORIAL_DATA = {
  phases: {
    1: {
      day: 'Day 1',
      title: 'Ditch the browser tab.',
      body: 'Chores are relentless enough without hunting for a tab. Put this where it belongs.',
      action: 'install_pwa',
      xp: 100,
      reward: 'Outpost secured. +100 XP.',
      ios: 'Share → Add to Home Screen → Confirm',
      android: 'Menu ⋮ → Install App',
    },
    2: {
      day: 'Day 2',
      title: 'One thing. That\'s it.',
      body: 'Not a whole list. Just the one chore you already do whether you want to or not.',
      action: 'add_task',
      xp: 50,
      reward: 'Anchor set. You\'re already ahead. +50 XP.',
      preloaded: [
        {
          title: 'Dishes',
          frequency: 'daily',
          difficulty: 'easy',
          basePoints: 30,
          flavor: 'The daily ritual',
        },
        {
          title: 'Laundry Load',
          frequency: 'weekly',
          difficulty: 'medium',
          basePoints: 60,
          flavor: 'Keep the spin cycle going',
        },
      ],
      customPrompt: 'That thing you already do',
    },
    3: {
      day: 'Day 3',
      title: 'Done counts, even if it\'s small.',
      body: 'Washed one mug? Moved one pile? That\'s real. Tap Done and get your credit.',
      action: 'complete_task',
      xp: 75,
      reward: 'Streak started. Bonus activated. +15% velocity. Keep going.',
    },
    4: {
      day: 'Day 4',
      title: 'You\'re doing more than you think.',
      body: 'Add one of the heavy hitters — the chore that starts silent arguments. Watch it get tracked.',
      action: 'visit_stats',
      xp: 75,
      reward: 'Pattern engine online. +75 XP.',
      preloaded: [
        {
          title: 'Kitchen Blitzkrieg',
          frequency: 'weekly',
          difficulty: 'hard',
          basePoints: 120,
          flavor: 'The quarterly deep dive',
        },
        {
          title: 'Organize a Closet',
          frequency: 'weekly',
          difficulty: 'medium',
          basePoints: 60,
          flavor: 'Pick a room. Make it stick.',
        },
      ],
      customPrompt: 'That project you\'ve been avoiding',
    },
    5: {
      day: 'Day 5',
      title: 'Stop fighting solo.',
      body: 'Add something for the other half of the team. Shared load, shared credit, no nagging required.',
      action: 'visit_ranks',
      xp: 100,
      reward: 'Team sync active. +100 XP.',
      preloaded: [
        {
          title: 'Yard Work',
          frequency: 'weekly',
          difficulty: 'medium',
          basePoints: 60,
          flavor: 'Keep the outside alive',
        },
        {
          title: 'Plan Next Week',
          frequency: 'weekly',
          difficulty: 'easy',
          basePoints: 30,
          flavor: 'Close the loop',
        },
      ],
      customPrompt: 'Something for your partner',
    },
  },
  levelUp: {
    title: 'LEVEL 2 UNLOCKED',
    body: 'You showed up five days straight.\nThat\'s not nothing. That\'s the whole thing.',
    xp: 500,
    cta: 'Enter the War Room',
  },
};
