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

const DOM = {};
const STATE = {
    network: 'ONLINE',
    nwsAlertActive: false,
    aqiAlertText: null
};

const FORMATTERS = {
    time: new Intl.DateTimeFormat('en-US', { timeZone: CONFIG.TZ, hour: 'numeric', minute: '2-digit', hour12: true }),
    date: new Intl.DateTimeFormat('en-US', { timeZone: CONFIG.TZ, weekday: 'long', month: 'long', day: 'numeric' }),
    sun: new Intl.DateTimeFormat('en-US', { timeZone: CONFIG.TZ, hour: 'numeric', minute: '2-digit', hour12: true })
};

function cacheDOM() {
    const ids = [
        'comp-hour', 'comp-minute', 'comp-ampm', 'comp-date', 'sys-status-dot', 'sys-status-text',
        'current-icon', 'current-temp', 'high-temp', 'low-temp', 'wind-speed',
        'dew-point', 'aqi-value', 'aqi-ring', 'sunrise-time', 'sunset-time',
        'alerts-container', 'alerts-text', 'forecast-container', 'sports-feed-container'
    ];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) DOM[id] = el;
    });
}

function updateClock() {
    const now = new Date();
    const timeParts = FORMATTERS.time.formatToParts(now);
    const hour = timeParts.find(p => p.type === 'hour').value;
    const minute = timeParts.find(p => p.type === 'minute').value;
    const ampm = timeParts.find(p => p.type === 'dayPeriod')?.value || '';
    
    if (DOM['comp-hour'].textContent !== hour) DOM['comp-hour'].textContent = hour;
    if (DOM['comp-minute'].textContent !== minute) DOM['comp-minute'].textContent = minute;
    if (DOM['comp-ampm'] && DOM['comp-ampm'].textContent !== ampm) DOM['comp-ampm'].textContent = ampm;
    
    const dateStr = FORMATTERS.date.format(now).toUpperCase();
    if (DOM['comp-date'].textContent !== dateStr) DOM['comp-date'].textContent = dateStr;
}

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

function getIconSVG(code) {
    const isRain = [4000, 4200, 4001, 4201].includes(code);
    const isCloudy = [1001, 1100, 1101, 1102].includes(code);
    
    if (isRain) return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" class="w-full h-full text-blue-400"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m-4-2l-3 3m14-3l3 3m-9-15a3 3 0 100-6 3 3 0 000 6z"/></svg>`;
    if (isCloudy) return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" class="w-full h-full text-slate-400"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"/></svg>`;
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" class="w-full h-full text-yellow-400"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/></svg>`;
}

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

async function updateWeather() {
    const payload = await fetchWithRetry(CONFIG.WEATHER_URL);
    if (!payload || !payload.data || !payload.data.timelines) return;

    const timelines = payload.data.timelines;
    const current = timelines.find(t => t.timestep === 'current')?.intervals[0]?.values;
    const daily = timelines.find(t => t.timestep === '1d')?.intervals;
    const airnow = payload.airnow;

    const aqiForecastMap = {};
    if (airnow && airnow.forecast) {
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
        DOM['dew-point'].textContent = `${Math.round(current.dewPoint)}°`;
        DOM['wind-speed'].textContent = `${Math.round(current.windSpeed)} MPH`;
        DOM['current-icon'].innerHTML = getIconSVG(current.weatherCode);
    }

    if (airnow) {
        const currentAqi = airnow.primaryAQI || 0;
        DOM['aqi-value'].textContent = currentAqi > 0 ? currentAqi : '--';
        
        if (currentAqi > 0) {
            const fillPercentage = Math.min(currentAqi / 300, 1); 
            const offset = 364 - (364 * fillPercentage);
            DOM['aqi-ring'].style.strokeDashoffset = offset;
            
            DOM['aqi-ring'].className.baseVal = currentAqi > 100 ? 'stroke-red-500 transition-all duration-1000' : 
                                                currentAqi > 50 ? 'stroke-yellow-500 transition-all duration-1000' : 
                                                'stroke-green-500 transition-all duration-1000';
            
            if (currentAqi > 100) {
                STATE.aqiAlertText = `AIR QUALITY ALERT: ${airnow.category.toUpperCase()}`;
            } else {
                STATE.aqiAlertText = null;
            }
        }
        renderAlerts();
    }

    if (daily && daily.length > 0) {
        const today = daily[0].values;
        DOM['high-temp'].textContent = `${Math.round(today.temperatureMax)}°`;
        DOM['low-temp'].textContent = `${Math.round(today.temperatureMin)}°`;
        DOM['sunrise-time'].textContent = FORMATTERS.sun.format(new Date(today.sunriseTime));
        DOM['sunset-time'].textContent = FORMATTERS.sun.format(new Date(today.sunsetTime));

        const frag = document.createDocumentFragment();
        daily.slice(0, 5).forEach(day => {
            const dateObj = new Date(day.startTime);
            const dateKey = dateObj.toISOString().split('T')[0];
            const dayName = new Intl.DateTimeFormat('en-US', { timeZone: CONFIG.TZ, weekday: 'short' }).format(dateObj).toUpperCase();
            
            const vals = day.values;
            const desc = vals.cloudCover > 50 ? 'CLOUDY' : 'CLEAR';
            const dayAqi = aqiForecastMap[dateKey] ? ` | AQI: ${aqiForecastMap[dateKey]}` : '';

            const div = document.createElement('div');
            div.className = 'flex flex-col items-center flex-1';
            div.innerHTML = `
                <span class="text-sm font-mono text-slate-400 mb-2">${dayName}</span>
                <div class="w-12 h-12 mb-2">${getIconSVG(vals.weatherCode)}</div>
                <span class="text-xl font-mono text-white">${Math.round(vals.temperatureMax)}° / ${Math.round(vals.temperatureMin)}°</span>
                <span class="text-[10px] text-slate-500 uppercase mt-1">${desc}</span>
                <span class="text-[10px] font-mono text-blue-400/80 mt-1">💧 ${Math.round(vals.precipitationProbability)}% | UV: ${Math.round(vals.uvIndex)}${dayAqi}</span>
            `;
            frag.appendChild(div);
        });
        DOM['forecast-container'].innerHTML = '';
        DOM['forecast-container'].appendChild(frag);
    }
}

async function updateSports() {
    const data = await fetchWithRetry(CONFIG.SPORTS_URL, 2, 1000);
    if (!data || !data.teams) return;

    const now = Date.now();
    const safeScore = (s) => (typeof s === 'object' && s !== null) ? (s.value || s.displayValue || s.display_value || '?') : s;

    const sorted = Object.values(data.teams).map(team => {
        let weight = 4;
        let state = 'OFFSEASON';
        const hasLive = team.current_game && team.current_game.live_state;
        const nextTime = team._meta.next_game_time_ms;
        const lastFetch = team._meta.last_fetched;

        if (team.status === 'FINAL') {
            const isRecent = (now - lastFetch) < CONFIG.BASK_DURATION_MS;
            const notImminent = nextTime === 0 || (nextTime - now) > CONFIG.BASK_CUTOFF_MS;
            if (isRecent && notImminent) {
                weight = 2;
                state = 'BASK';
            } else if (nextTime !== 0 && (nextTime - now) <= CONFIG.BASK_CUTOFF_MS) {
                weight = 3;
                state = 'UPCOMING';
            } else {
                weight = 4;
                state = 'OFFSEASON';
            }
        } else if (hasLive || team.status === 'LIVE' || team.status === 'IN PROGRESS') {
            weight = 1;
            state = 'LIVE';
        } else if (team.status === 'PRE-GAME' || team.status === 'SCHEDULED') {
            weight = 3;
            state = 'UPCOMING';
        }

        return { ...team, weight, state };
    }).sort((a, b) => a.weight - b.weight);

    const frag = document.createDocumentFragment();
    sorted.forEach(team => {
        const div = document.createElement('div');
        const hasPrev = team.previous_game;
        const hasCur = team.current_game && team.current_game.opponent;

        if (team.state === 'LIVE') {
            div.className = 'py-4 px-4 bg-slate-800/40 border border-slate-700 rounded-xl flex items-center mb-3 justify-between';
            const ls = team.current_game.live_state;
            div.innerHTML = `
                <div class="flex items-center gap-4">
                    <img src="${team.logo_url}" class="w-12 h-12 object-contain bg-slate-800 rounded-full p-1" onerror="this.style.display='none'">
                    <div class="flex flex-col">
                        <span class="font-bold text-white text-lg">${team.team_name.toUpperCase()}</span>
                        <div class="flex items-center gap-2">
                            <span class="text-slate-400 text-xs font-mono">${team.team_record}</span>
                            <span class="text-slate-500 text-[10px]">vs ${team.current_game.opponent} • ${team.current_game.network}</span>
                        </div>
                    </div>
                </div>
                <div class="flex flex-col items-end">
                    <span class="text-2xl font-mono text-white">${ls.away_abbrev} ${safeScore(ls.away_score)} - ${ls.home_abbrev} ${safeScore(ls.home_score)}</span>
                    <span class="text-xs font-mono text-blue-400 animate-pulse mt-1">PERIOD ${ls.period} • ${ls.clock}</span>
                </div>
            `;
        } else if (team.state === 'BASK') {
            div.className = 'py-3 px-4 border-b border-slate-800 flex items-center justify-between';
            div.innerHTML = `
                <div class="flex items-center gap-4">
                    <img src="${team.logo_url}" class="w-10 h-10 object-contain bg-slate-800 rounded-full p-1" onerror="this.style.display='none'">
                    <div class="flex flex-col">
                        <span class="text-slate-200 text-base font-semibold">${team.team_name.toUpperCase()}</span>
                        <span class="text-slate-400 text-xs font-mono">${team.team_record}</span>
                    </div>
                </div>
                <div class="flex flex-col items-end">
                    <span class="text-xl font-mono text-white">${hasPrev ? team.previous_game.result + ' ' + safeScore(team.previous_game.score) : '--'}</span>
                    <span class="text-xs font-mono text-slate-500 mt-1">FINAL ${hasPrev ? 'vs ' + team.previous_game.opponent : ''}</span>
                </div>
            `;
        } else if (team.state === 'UPCOMING') {
            div.className = 'py-3 px-4 border-b border-slate-800 flex items-center justify-between';
            div.innerHTML = `
                <div class="flex items-center gap-4">
                    <img src="${team.logo_url}" class="w-10 h-10 object-contain bg-slate-800 rounded-full p-1" onerror="this.style.display='none'">
                    <div class="flex flex-col">
                        <span class="text-slate-200 text-base font-semibold">${team.team_name.toUpperCase()}</span>
                        <div class="flex items-center gap-2">
                            <span class="text-slate-400 text-xs font-mono">${team.team_record}</span>
                            <span class="text-slate-500 text-[10px]">vs ${hasCur ? team.current_game.opponent + ' • ' + team.current_game.network : 'TBD'}</span>
                        </div>
                    </div>
                </div>
                <div class="flex flex-col items-end">
                    <span class="text-sm font-mono text-slate-400">${hasCur ? team.current_game.display_date + ' • ' + team.current_game.display_time : 'TBD'}</span>
                </div>
            `;
        } else {
            div.className = 'py-2 px-4 border-b border-slate-800/50 flex items-center justify-between opacity-50 grayscale';
            div.innerHTML = `
                <div class="flex items-center gap-3">
                    <img src="${team.logo_url}" class="w-8 h-8 object-contain bg-slate-800 rounded-full p-1" onerror="this.style.display='none'">
                    <div class="flex flex-col">
                        <span class="text-slate-400 text-sm font-semibold">${team.team_name.toUpperCase()}</span>
                        <span class="text-slate-500 text-[10px] font-mono">${team.team_record}</span>
                    </div>
                </div>
                <div class="flex flex-col items-end">
                    <span class="text-xs font-mono text-slate-500">${hasPrev ? 'LAST: ' + team.previous_game.result + ' ' + safeScore(team.previous_game.score) + ' vs ' + team.previous_game.opponent : 'OFFSEASON'}</span>
                </div>
            `;
        }
        frag.appendChild(div);
    });

    DOM['sports-feed-container'].innerHTML = '';
    DOM['sports-feed-container'].appendChild(frag);
}

document.addEventListener('DOMContentLoaded', () => {
    cacheDOM();
    
    updateClock();
    setInterval(updateClock, 1000);
    
    updateWeather();
    updateAlerts();
    updateSports();

    setInterval(updateWeather, CONFIG.POLL_WEATHER_MS);
    setInterval(updateAlerts, CONFIG.POLL_ALERTS_MS);
    setInterval(updateSports, CONFIG.POLL_SPORTS_MS);
});
