// --- System Variables ---
const WORKER_URL = 'https://pi-sports-edge.askozicki.workers.dev/';
const REFRESH_RATE_MS = 60000; 

// --- SVG Assets ---
const svgFootball = `<svg class="w-4 h-4 inline-block text-white/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5.32 18.68A12.04 12.04 0 0 0 18.68 5.32 12.04 12.04 0 0 0 5.32 18.68Z"/><path d="m14.5 10.5-5 5"/><path d="m10.5 9.5-1 1"/><path d="m14.5 13.5-1 1"/></svg>`;
const svgBasketball = `<svg class="w-4 h-4 inline-block text-white/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2v20"/><path d="M5.5 5.5a9.5 9.5 0 0 1 0 13"/><path d="M18.5 5.5a9.5 9.5 0 0 0 0 13"/></svg>`;
const svgBaseball = `<svg class="w-4 h-4 inline-block text-white/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M6.5 4.5a9 9 0 0 1 0 15"/><path d="M17.5 4.5a9 9 0 0 0 0 15"/></svg>`;
const svgHockey = `<svg class="w-4 h-4 inline-block text-white/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 18l11-11 2 2-11 11H4v-2z"/><path d="M7 21h3"/><path d="M20 18l-11-11-2 2 11 11h2v-2z"/><path d="M14 21h3"/><circle cx="12" cy="16" r="2" fill="currentColor" stroke="none"/></svg>`;

// --- Team Configurations ---
const proConfig = [
    { id: 'min-nfl', name: 'Minnesota Vikings', league: 'nfl', icon: svgFootball, gender: 'M', url: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/15/schedule' },
    { id: 'gb-nfl', name: 'Green Bay Packers', league: 'nfl', icon: svgFootball, gender: 'M', url: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/9/schedule' },
    { id: 'min-nba', name: 'Minnesota Timberwolves', league: 'nba', icon: svgBasketball, gender: 'M', url: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/16/schedule' },
    { id: 'min-wnba', name: 'Minnesota Lynx', league: 'wnba', icon: svgBasketball, gender: 'W', url: 'https://site.api.espn.com/apis/site/v2/sports/basketball/wnba/teams/14/schedule' },
    { id: 'min-mlb', name: 'Minnesota Twins', league: 'mlb', icon: svgBaseball, gender: 'M', url: 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/teams/10/schedule' },
    { id: 'min-nhl', name: 'Minnesota Wild', league: 'nhl', icon: svgHockey, gender: 'M', url: 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/teams/30/schedule' },
    { id: 'mil-nba', name: 'Milwaukee Bucks', league: 'nba', icon: svgBasketball, gender: 'M', url: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/15/schedule' },
    { id: 'mil-mlb', name: 'Milwaukee Brewers', league: 'mlb', icon: svgBaseball, gender: 'M', url: 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/teams/8/schedule' },
    { id: 'min-pwhl', name: 'Minnesota Frost', league: 'pwhl', icon: svgHockey, gender: 'W', url: 'https://site.api.espn.com/apis/site/v2/sports/hockey/pwhl/teams/4/schedule' }
];

const collegeConfig = [
    { name: 'Wisconsin Football', league: 'college-football', icon: svgFootball, gender: 'M', url: 'https://site.api.espn.com/apis/site/v2/sports/football/college-football/teams/275/schedule' },
    { name: 'Minnesota Football', league: 'college-football', icon: svgFootball, gender: 'M', url: 'https://site.api.espn.com/apis/site/v2/sports/football/college-football/teams/135/schedule' },
    { name: 'Wisconsin Basketball', league: 'mens-college-basketball', icon: svgBasketball, gender: 'M', url: 'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/teams/275/schedule' },
    { name: 'Minnesota Basketball', league: 'mens-college-basketball', icon: svgBasketball, gender: 'M', url: 'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/teams/135/schedule' },
    { name: 'Wisconsin Basketball', league: 'womens-college-basketball', icon: svgBasketball, gender: 'W', url: 'https://site.api.espn.com/apis/site/v2/sports/basketball/womens-college-basketball/teams/275/schedule' },
    { name: 'Minnesota Basketball', league: 'womens-college-basketball', icon: svgBasketball, gender: 'W', url: 'https://site.api.espn.com/apis/site/v2/sports/basketball/womens-college-basketball/teams/135/schedule' },
    { name: 'Wisconsin Hockey', league: 'mens-college-hockey', icon: svgHockey, gender: 'M', url: 'https://site.api.espn.com/apis/site/v2/sports/hockey/mens-college-hockey/teams/275/schedule' },
    { name: 'Minnesota Hockey', league: 'mens-college-hockey', icon: svgHockey, gender: 'M', url: 'https://site.api.espn.com/apis/site/v2/sports/hockey/mens-college-hockey/teams/135/schedule' }
];
