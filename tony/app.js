const CONFIG = {
    WEATHER_URL: 'https://kzick-weather.askozicki.workers.dev/',
    ALERTS_URL: 'https://api.weather.gov/alerts/active?point=44.9483,-93.3666',
    SPORTS_URL: 'https://pi-sports-edge.askozicki.workers.dev',
    POLL_WEATHER_MS: 900000,
    POLL_ALERTS_MS: 300000,
    POLL_SPORTS_MS: 60000,
    TIMEOUT_MS: 5000,
    BASK_DURATION_MS: 86400000,
    BASK_CUTOFF_MS: 28800000,
    TZ: 'America/Chicago'
};

// ── Short team name lookup ────────────────────────────
const SHORT_NAMES = {
    'MLB_MIN':       'Twins',
    'MLB_MIL':       'Brewers',
    'NHL_MIN':       'Wild',
    'NFL_MIN':       'Vikings',
    'NFL_GB':        'Packers',
    'NBA_MIN':       'Timberwolves',
    'WNBA_MIN':      'Lynx',
    'NCAAF_WIS':     'Badgers',
    'NCAAMBB_WIS':   'Badgers',
    'NCAAMHOK_MINN': 'Gophers',
};

// Team abbreviations for offseason pills
const ABBREVS = {
    'MLB_MIN':       'MIN',
    'MLB_MIL':       'MIL',
    'NHL_MIN':       'MIN',
    'NFL_MIN':       'MIN',
    'NFL_GB':        'GB',
    'NBA_MIN':       'MIN',
    'WNBA_MIN':      'MIN',
    'NCAAF_WIS':     'WIS',
    'NCAAMBB_WIS':   'WIS',
    'NCAAMHOK_MINN': 'MINN',
};

// Sport badge colors
const SPORT_COLORS = {
    'NFL':       'bg-amber-900/60 text-amber-400 border-amber-700/40',
    'NBA':       'bg-orange-900/60 text-orange-400 border-orange-700/40',
    'MLB':       'bg-blue-900/60 text-blue-400 border-blue-700/40',
    'NHL':       'bg-cyan-900/60 text-cyan-400 border-cyan-700/40',
    'WNBA':      'bg-pink-900/60 text-pink-400 border-pink-700/40',
    'NCAAF':     'bg-red-900/60 text-red-400 border-red-700/40',
    'NCAAMBB':   'bg-yellow-900/60 text-yellow-400 border-yellow-700/40',
    'NCAAMHOK':  'bg-teal-900/60 text-teal-400 border-teal-700/40',
};

// ── AQI EPA categories ────────────────────────────────
const AQI_CATEGORIES = [
    { max: 50,       label: 'GOOD',                      ring: 'stroke-green-500',   text: 'text-green-400',   alert: false },
    { max: 100,      label: 'MODERATE',                  ring: 'stroke-yellow-400',  text: 'text-yellow-400',  alert: false },
    { max: 150,      label: 'UNHEALTHY FOR SENSITIVE',   ring: 'stroke-orange-500',  text: 'text-orange-400',  alert: true  },
    { max: 200,      label: 'UNHEALTHY',                 ring: 'stroke-red-500',     text: 'text-red-400',     alert: true  },
    { max: 300,      label: 'VERY UNHEALTHY',            ring: 'stroke-purple-500',  text: 'text-purple-400',  alert: true  },
    { max: Infinity, label: 'HAZARDOUS',                 ring: 'stroke-fuchsia-600', text: 'text-fuchsia-400', alert: true  },
];

function getAQICategory(aqi) {
    return AQI_CATEGORIES.find(c => aqi <= c.max) || AQI_CATEGORIES[AQI_CATEGORIES.length - 1];
}

const DOM = {};
const STATE = {
    network: 'ONLINE',
    nwsAlertActive: false,
    aqiAlertText: null
};

const FORMATTERS = {
    time: new Intl.DateTimeFormat('en-US', { timeZone: CONFIG.TZ, hour: 'numeric', minute: '2-digit', hour12: true }),
    date: new Intl.DateTimeFormat('en-US', { timeZone: CONFIG.TZ, weekday: 'long', month: 'long', day: 'numeric' }),
    sun:  new Intl.DateTimeFormat('en-US', { timeZone: CONFIG.TZ, hour: 'numeric', minute: '2-digit', hour12: true })
};

function cacheDOM() {
    const ids = [
        'comp-hour', 'comp-minute', 'comp-ampm', 'comp-date',
        'sys-status-dot', 'sys-status-text',
        'current-icon', 'current-temp', 'high-temp', 'low-temp',
        'wind-speed', 'dew-point', 'aqi-value', 'aqi-ring', 'aqi-label',
        'sunrise-time', 'sunset-time',
        'alerts-container', 'alerts-text',
        'forecast-container',
        'sports-feed-container',
        'sports-offseason-container',
        'wind-dir-icon', 'sync-badge',
    ];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) DOM[id] = el;
    });
}

// ── Clock ─────────────────────────────────────────────
let lastSyncTime = Date.now();

function updateSyncBadge() {
    if (!DOM['sync-badge']) return;
    const elapsed = Math.floor((Date.now() - lastSyncTime) / 1000);
    if (elapsed < 90) {
        DOM['sync-badge'].textContent = '∼ SYNCED';
        DOM['sync-badge'].className = 'text-[8px] font-mono text-slate-700 tracking-widest';
    } else if (elapsed < 3600) {
        const mins = Math.floor(elapsed / 60);
        DOM['sync-badge'].textContent = `∼ SYNCED ${mins}m AGO`;
        DOM['sync-badge'].className = 'text-[8px] font-mono text-slate-600 tracking-widest';
    } else {
        DOM['sync-badge'].textContent = '∼ SYNC STALE';
        DOM['sync-badge'].className = 'text-[8px] font-mono text-red-800 tracking-widest';
    }
}

function updateClock() {
    const now = new Date();
    const parts = FORMATTERS.time.formatToParts(now);
    const hour   = parts.find(p => p.type === 'hour').value;
    const minute = parts.find(p => p.type === 'minute').value;
    const ampm   = parts.find(p => p.type === 'dayPeriod')?.value || '';

    if (DOM['comp-hour'].textContent   !== hour)   DOM['comp-hour'].textContent   = hour;
    if (DOM['comp-minute'].textContent !== minute) DOM['comp-minute'].textContent = minute;
    if (DOM['comp-ampm']  && DOM['comp-ampm'].textContent !== ampm) DOM['comp-ampm'].textContent = ampm;

    const dateStr = FORMATTERS.date.format(now).toUpperCase();
    if (DOM['comp-date'].textContent !== dateStr) DOM['comp-date'].textContent = dateStr;

    updateSyncBadge();
}

// ── Network ───────────────────────────────────────────
async function fetchWithRetry(url, retries = 3, backoff = 3000) {
    const token = localStorage.getItem('WK_BEARER');
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

    for (let i = 0; i < retries; i++) {
        try {
            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), CONFIG.TIMEOUT_MS);
            const response = await fetch(url, { headers, signal: controller.signal });
            clearTimeout(id);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            setNetworkState('ONLINE');
            return await response.json();
        } catch (err) {
            setNetworkState('DEGRADED');
            if (i === retries - 1) return null;
            await new Promise(r => setTimeout(r, backoff * (i + 1)));
        }
    }
}

function setNetworkState(status) {
    if (STATE.network === status) return;
    STATE.network = status;
    if (status === 'ONLINE') {
        DOM['sys-status-dot'].className = 'text-green-500 animate-blink';
        DOM['sys-status-text'].textContent = 'SYSTEM ONLINE';
    } else {
        DOM['sys-status-dot'].className = 'text-red-500';
        DOM['sys-status-text'].textContent = 'NETWORK DEGRADED';
    }
}

// ── Weather helpers ───────────────────────────────────
function getIconSVG(code) {
    const isRain      = [4000, 4200, 4001, 4201].includes(code);
    const isSnow      = [5000, 5001, 5100, 5101].includes(code);
    const isThunder   = [8000, 8001, 8002, 8003].includes(code);
    const isCloudy    = [1001, 1100, 1101, 1102].includes(code);
    const isPartly    = [1100, 1101].includes(code);
    const isFog       = [2000, 2100].includes(code);

    if (isThunder) return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" class="w-full h-full text-yellow-300"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10l-2 4h4l-2 4"/></svg>`;
    if (isRain)    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" class="w-full h-full text-blue-400"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"/><line x1="8" y1="22" x2="7" y2="24" stroke-width="2" stroke-linecap="round"/><line x1="12" y1="22" x2="11" y2="24" stroke-width="2" stroke-linecap="round"/><line x1="16" y1="22" x2="15" y2="24" stroke-width="2" stroke-linecap="round"/></svg>`;
    if (isSnow)    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" class="w-full h-full text-cyan-300"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"/><line x1="8" y1="22" x2="8" y2="24" stroke-width="2" stroke-linecap="round"/><line x1="12" y1="21" x2="12" y2="24" stroke-width="2" stroke-linecap="round"/><line x1="16" y1="22" x2="16" y2="24" stroke-width="2" stroke-linecap="round"/></svg>`;
    if (isFog)     return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" class="w-full h-full text-slate-400"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"/><line x1="3" y1="20" x2="21" y2="20" stroke-width="1.5" stroke-linecap="round"/><line x1="5" y1="22" x2="19" y2="22" stroke-width="1.5" stroke-linecap="round"/></svg>`;
    if (isCloudy)  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" class="w-full h-full text-slate-400"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"/></svg>`;
    // Default: sunny
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" class="w-full h-full text-yellow-400"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/></svg>`;
}

function getWeatherDescription(code, cloudCover) {
    if ([8000, 8001, 8002, 8003].includes(code)) return 'THUNDER';
    if ([4000, 4200, 4001, 4201].includes(code)) return 'RAIN';
    if ([5000, 5001, 5100, 5101].includes(code)) return 'SNOW';
    if ([6000, 6001, 6200, 6201, 7000, 7101, 7102].includes(code)) return 'SLEET';
    if ([2000, 2100].includes(code)) return 'FOG';
    if ([1001].includes(code)) return 'CLOUDY';
    if ([1100, 1101, 1102].includes(code)) return cloudCover > 60 ? 'MOSTLY CLOUDY' : 'PARTLY CLOUDY';
    if ([1000].includes(code)) return 'CLEAR';
    // Fallback: use cloudCover only if no matching code
    return cloudCover > 70 ? 'CLOUDY' : cloudCover > 30 ? 'PARTLY CLOUDY' : 'CLEAR';
}

function getPrecipLabel(probability, precipType) {
    if (!probability || probability < 5) return `💧 0%`;
    const typeMap = { 1: 'RAIN', 2: 'SNOW', 3: 'SLEET', 4: 'SLEET' };
    const label = typeMap[precipType] || 'PRECIP';
    return `💧 ${Math.round(probability)}% ${label}`;
}

// ── Alerts ────────────────────────────────────────────
function renderAlerts() {
    if (STATE.nwsAlertActive) {
        DOM['alerts-container'].classList.remove('hidden');
    } else if (STATE.aqiAlertText) {
        DOM['alerts-text'].textContent = STATE.aqiAlertText;
        DOM['alerts-container'].classList.remove('hidden');
    } else {
        DOM['alerts-container'].classList.add('hidden');
    }
}

async function updateAlerts() {
    const data = await fetchWithRetry(CONFIG.ALERTS_URL);
    if (!data || !data.features) return;
    if (data.features.length > 0) {
        const headline = data.features[0].properties.headline || data.features[0].properties.event;
        DOM['alerts-text'].textContent = `NWS ALERT: ${headline}`;
        STATE.nwsAlertActive = true;
    } else {
        STATE.nwsAlertActive = false;
    }
    renderAlerts();
}

// ── Weather ───────────────────────────────────────────
async function updateWeather() {
    const payload = await fetchWithRetry(CONFIG.WEATHER_URL);
    if (!payload?.data?.timelines) return;
    lastSyncTime = Date.now();

    const timelines = payload.data.timelines;
    const current   = timelines.find(t => t.timestep === 'current')?.intervals[0]?.values;
    const daily     = timelines.find(t => t.timestep === '1d')?.intervals;
    const airnow    = payload.airnow;

    const aqiForecastMap = {};
    if (airnow?.forecast) {
        airnow.forecast.forEach(f => {
            if (f.aqi > 0) {
                if (!aqiForecastMap[f.date] || f.aqi > aqiForecastMap[f.date]) {
                    aqiForecastMap[f.date] = f.aqi;
                }
            }
        });
    }

    if (current) {
        DOM['current-temp'].textContent = `${Math.round(current.temperature)}°`;
        DOM['dew-point'].textContent    = `${Math.round(current.dewPoint)}°`;
        DOM['wind-speed'].textContent   = `${Math.round(current.windSpeed)} MPH`;
        DOM['current-icon'].innerHTML   = getIconSVG(current.weatherCode);
        if (DOM['wind-dir-icon'] && current.windDirection != null) {
            DOM['wind-dir-icon'].style.transform = `rotate(${current.windDirection}deg)`;
        }
    }

    if (airnow) {
        const currentAqi = airnow.primaryAQI || 0;
        DOM['aqi-value'].textContent = currentAqi > 0 ? currentAqi : '--';
        if (currentAqi > 0) {
            const cat = getAQICategory(currentAqi);
            const fillPct = Math.min(currentAqi / 300, 1);
            DOM['aqi-ring'].style.strokeDashoffset = 364 - (364 * fillPct);
            DOM['aqi-ring'].className = `${cat.ring} transition-all duration-1000`;
            if (DOM['aqi-label']) {
                DOM['aqi-label'].textContent = cat.label;
                DOM['aqi-label'].className = `text-[9px] font-mono tracking-widest uppercase mt-2 text-center leading-tight ${cat.text}`;
            }
            if (DOM['aqi-value']) {
                DOM['aqi-value'].className = `text-5xl font-bold tracking-tighter ${cat.text}`;
            }
            STATE.aqiAlertText = cat.alert ? `AIR QUALITY ALERT: ${cat.label}` : null;
        } else {
            if (DOM['aqi-label']) {
                DOM['aqi-label'].textContent = '--';
                DOM['aqi-label'].className = 'text-[9px] font-mono tracking-widest uppercase mt-2 text-slate-600';
            }
            if (DOM['aqi-value']) {
                DOM['aqi-value'].className = 'text-5xl font-bold text-white tracking-tighter';
            }
        }
        renderAlerts();
    }

    if (daily?.length > 0) {
        const today = daily[0].values;
        DOM['high-temp'].textContent    = `${Math.round(today.temperatureMax)}°`;
        DOM['low-temp'].textContent     = `${Math.round(today.temperatureMin)}°`;
        DOM['sunrise-time'].textContent = FORMATTERS.sun.format(new Date(today.sunriseTime));
        DOM['sunset-time'].textContent  = FORMATTERS.sun.format(new Date(today.sunsetTime));

        const frag = document.createDocumentFragment();
        daily.slice(0, 5).forEach(day => {
            const dateObj  = new Date(day.startTime);
            const dateKey  = dateObj.toISOString().split('T')[0];
            const dayName  = new Intl.DateTimeFormat('en-US', { timeZone: CONFIG.TZ, weekday: 'short' }).format(dateObj).toUpperCase();
            const vals     = day.values;
            const desc     = getWeatherDescription(vals.weatherCode, vals.cloudCover);
            const precip   = getPrecipLabel(vals.precipitationProbability, vals.precipitationType);
            const dayAqi   = aqiForecastMap[dateKey] ? ` | AQI: ${aqiForecastMap[dateKey]}` : '';

            const div = document.createElement('div');
            div.className = 'flex flex-col items-center flex-1';
            div.innerHTML = `
                <span class="text-sm font-mono text-slate-400 mb-1">${dayName}</span>
                <div class="w-12 h-12 mb-1">${getIconSVG(vals.weatherCode)}</div>
                <span class="text-lg font-mono text-white leading-tight">${Math.round(vals.temperatureMax)}°</span>
                <span class="text-xs font-mono text-slate-500">${Math.round(vals.temperatureMin)}°</span>
                <span class="text-[9px] text-slate-500 uppercase mt-1 tracking-wide">${desc}</span>
                <span class="text-[9px] font-mono text-blue-400/80 mt-1">${precip} | UV: ${Math.round(vals.uvIndex)}${dayAqi}</span>
            `;
            frag.appendChild(div);
        });
        DOM['forecast-container'].innerHTML = '';
        DOM['forecast-container'].appendChild(frag);
    }
}

// ── Sports helpers ────────────────────────────────────
function isOffseason(sportKey) {
    const deadZones = {
        'NFL':      { start: '02-20', end: '07-15' },
        'NCAAF':    { start: '01-20', end: '08-15' },
        'NBA':      { start: '06-25', end: '09-30' },
        'NHL':      { start: '06-25', end: '09-15' },
        'MLB':      { start: '11-10', end: '02-15' },
        'WNBA':     { start: '11-01', end: '04-15' },
        'NCAAMBB':  { start: '04-15', end: '10-15' },
        'NCAAMHOK': { start: '04-15', end: '09-15' }
    };
    const range = deadZones[sportKey];
    if (!range) return false;
    const now   = new Date();
    const today = String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
    if (range.start <= range.end) return today >= range.start && today <= range.end;
    return today >= range.start || today <= range.end;
}

// Safely coerce a score value to a displayable string
function safeScore(s) {
    if (s === null || s === undefined) return '?';
    if (typeof s === 'object') return s.value ?? s.displayValue ?? s.display_value ?? '?';
    return String(s);
}

// Result color class
function resultClass(result) {
    if (!result) return 'text-slate-300';
    return result.toUpperCase() === 'W' ? 'result-w' : 'result-l';
}

// Sport badge html
function sportBadge(sport, key) {
    const cls = SPORT_COLORS[sport] || 'bg-slate-700/60 text-slate-400 border-slate-600/40';
    const abbr = ABBREVS[key] || sport;
    return `<span class="px-2 py-px border rounded text-[9px] font-mono tracking-wider ${cls}">${sport}</span>`;
}

// ── Sports tile builders ──────────────────────────────

// FINAL / BASK tile
function buildFinalTile(team, key) {
    const shortName = SHORT_NAMES[key] || team.team_name.split(' ').pop();
    const hasPrev   = !!team.previous_game;
    const hasCur    = !!team.current_game?.opponent;
    const res       = hasPrev ? team.previous_game.result : null;
    const rClass    = resultClass(res);
    const nextLine  = hasCur
        ? `<span class="text-[10px] font-mono text-slate-500">Next: vs ${team.current_game.opponent} • ${team.current_game.display_date} ${team.current_game.display_time}</span>`
        : `<span class="text-[10px] font-mono text-slate-600">No upcoming game</span>`;

    const div = document.createElement('div');
    div.className = 'bg-slate-900/40 border border-slate-700/30 rounded-2xl p-3 flex flex-col gap-1.5';
    div.innerHTML = `
        <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
                <img src="${team.logo_url}" class="w-8 h-8 object-contain" onerror="this.style.display='none'">
                <div>
                    <div class="text-sm font-bold text-white tracking-wide leading-tight">${shortName}</div>
                    <div class="text-[10px] font-mono text-slate-400">${team.team_record}</div>
                </div>
            </div>
            <span class="text-[10px] font-mono text-slate-500 tracking-widest uppercase">Final</span>
        </div>
        <div class="border-t border-slate-700/50 pt-2 mt-1 flex flex-col gap-1">
            <div class="flex items-baseline gap-2">
                <span class="text-xl font-mono font-bold ${rClass}">${res || '--'} ${hasPrev ? team.previous_game.score : '--'}</span>
                <span class="text-[10px] font-mono text-slate-500">vs ${hasPrev ? team.previous_game.opponent : '--'} • ${hasPrev ? team.previous_game.display_date : ''}</span>
            </div>
            ${nextLine}
        </div>
    `;
    return div;
}

// UPCOMING / PRE-GAME tile
function buildUpcomingTile(team, key) {
    const shortName = SHORT_NAMES[key] || team.team_name.split(' ').pop();
    const hasPrev   = !!team.previous_game;
    const hasCur    = !!team.current_game?.opponent;
    const res       = hasPrev ? team.previous_game.result : null;
    const rClass    = resultClass(res);
    const networkBadge = hasCur && team.current_game.network
        ? `<span class="px-2 py-px bg-slate-700/50 border border-slate-600 rounded text-[9px] font-mono text-slate-300 tracking-wider ml-1">${team.current_game.network}</span>`
        : '';

    const div = document.createElement('div');
    div.className = 'bg-slate-900/40 border border-slate-700/30 rounded-2xl p-3 flex flex-col gap-1.5';
    div.innerHTML = `
        <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
                <img src="${team.logo_url}" class="w-8 h-8 object-contain" onerror="this.style.display='none'">
                <div>
                    <div class="text-sm font-bold text-white tracking-wide leading-tight">${shortName}</div>
                    <div class="text-[10px] font-mono text-slate-400">${team.team_record}</div>
                </div>
            </div>
            <div class="flex flex-col items-end gap-0.5">
                <span class="text-[10px] font-mono text-slate-400 tracking-wide">${hasCur ? team.current_game.display_date : 'TBD'}</span>
                <div class="flex items-center">
                    <span class="text-[10px] font-mono text-cyan-400">${hasCur ? team.current_game.display_time : ''}</span>
                    ${networkBadge}
                </div>
            </div>
        </div>
        <div class="border-t border-slate-700/50 pt-2 mt-1 flex flex-col gap-1">
            <div class="text-sm font-mono font-semibold text-white tracking-tight">
                vs ${hasCur ? team.current_game.opponent : 'TBD'}
                ${hasCur && team.current_game.location ? `<span class="text-slate-600 font-normal text-[10px] ml-1">• ${team.current_game.location}</span>` : ''}
            </div>
            <div class="flex items-center gap-1.5">
                <span class="text-[10px] font-mono text-slate-500">Last:</span>
                <span class="text-[10px] font-mono ${rClass}">${hasPrev ? res + ' ' + team.previous_game.score : '--'}</span>
                <span class="text-[10px] font-mono text-slate-600">${hasPrev ? 'vs ' + team.previous_game.opponent : ''}</span>
            </div>
        </div>
    `;
    return div;
}

// OFFSEASON pill
function buildOffseasonPill(team, key) {
    const abbr  = ABBREVS[key] || team.sport;
    const sport = team.sport;
    const cls   = SPORT_COLORS[sport] || 'bg-slate-700/60 text-slate-400 border-slate-600/40';

    const pill = document.createElement('div');
    pill.className = 'flex items-center gap-2 px-3 py-1.5 bg-slate-800/40 border border-slate-700/30 rounded-full opacity-50';
    pill.innerHTML = `
        <img src="${team.logo_url}" class="w-5 h-5 object-contain grayscale" onerror="this.style.display='none'">
        <span class="text-[11px] font-mono text-slate-400 tracking-wide">${abbr}</span>
        <span class="px-1.5 py-px border rounded text-[8px] font-mono tracking-wider ${cls}">${sport}</span>
    `;
    return pill;
}

// ── Status classification (no LIVE state) ─────────────
function classifyTeam(team, key, now) {
    // Explicitly offseason: dead-zone date range AND no imminent game
    if (isOffseason(team.sport) && (!team._meta.next_game_time_ms || team._meta.next_game_time_ms === 0)) {
        return 'OFFSEASON';
    }

    // UPCOMING: if there's a scheduled next game coming soon
    const nextMs = team._meta.next_game_time_ms;
    if (nextMs && nextMs > 0) {
        const timeUntil = nextMs - now;
        if (timeUntil > 0) return 'UPCOMING';
    }

    // BASK: recent final game (show result)
    if (team.status === 'FINAL' || team.status === 'LIVE') {
        const isRecent = (now - team._meta.last_fetched) < CONFIG.BASK_DURATION_MS;
        if (isRecent && team.previous_game) return 'BASK';
    }

    return 'OFFSEASON';
}

// Sort weight for active tiles (no LIVE)
const STATE_WEIGHT = { 'BASK': 1, 'UPCOMING': 2 };

// ── Main sports render ────────────────────────────────
async function updateSports() {
    const data = await fetchWithRetry(CONFIG.SPORTS_URL, 2, 1000);
    if (!data?.teams) return;

    const now = Date.now();

    // Classify every team
    const classified = Object.entries(data.teams).map(([key, team]) => ({
        key,
        team,
        state: classifyTeam(team, key, now),
    }));

    // Split: active vs offseason
    const active    = classified.filter(t => t.state !== 'OFFSEASON')
                                .sort((a, b) => (STATE_WEIGHT[a.state] || 9) - (STATE_WEIGHT[b.state] || 9));
    const offseason = classified.filter(t => t.state === 'OFFSEASON');

    // Render active tiles
    const activeFrag = document.createDocumentFragment();
    active.forEach(({ key, team, state }) => {
        let tile;
        if (state === 'BASK')     tile = buildFinalTile(team, key);
        else if (state === 'UPCOMING') tile = buildUpcomingTile(team, key);
        activeFrag.appendChild(tile);
    });

    DOM['sports-feed-container'].innerHTML = '';
    if (active.length === 0) {
        DOM['sports-feed-container'].innerHTML = `<div class="col-span-3 text-xs font-mono text-slate-600 tracking-widest uppercase py-4">No active games</div>`;
    } else {
        DOM['sports-feed-container'].appendChild(activeFrag);
    }

    // Render offseason pills
    const pillFrag = document.createDocumentFragment();
    offseason.forEach(({ key, team }) => {
        pillFrag.appendChild(buildOffseasonPill(team, key));
    });

    DOM['sports-offseason-container'].innerHTML = '';
    if (offseason.length > 0) {
        DOM['sports-offseason-container'].appendChild(pillFrag);
    }
}

// ── Init ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    cacheDOM();

    updateClock();
    setInterval(updateClock, 1000);

    updateWeather();
    updateAlerts();
    updateSports();

    setInterval(updateWeather, CONFIG.POLL_WEATHER_MS);
    setInterval(updateAlerts,  CONFIG.POLL_ALERTS_MS);
    setInterval(updateSports,  CONFIG.POLL_SPORTS_MS);
});
