/**
 * TONY KIOSK ENGINE // V0.3.1 (HOTFIX 1)
 * Core Logic: Strict Type Checking & Fault Tolerance
 */

const CONFIG = {
    location: { lat: 44.9483, lon: -93.3666 },
    api: {
        weatherProxy: `https://kzick-weather.askozicki.workers.dev?lat=44.9483&lon=-93.3666`,
        weatherInterval: 5 * 60 * 1000,
        sportsLiveInterval: 5 * 60 * 1000,
        sportsIdleInterval: 6 * 60 * 60 * 1000
    },
    teams: {
        pro: [
            { id: '15', league: 'football/nfl', name: 'Vikings' },
            { id: '9', league: 'football/nfl', name: 'Packers' },
            { id: '10', league: 'baseball/mlb', name: 'Twins' },
            { id: '8', league: 'baseball/mlb', name: 'Brewers' }
        ],
        college: [
            { id: '275', league: 'football/college-football', name: 'Badgers FB' },
            { id: '135', league: 'football/college-football', name: 'Gophers FB' },
            { id: '275', league: 'basketball/mens-college-basketball', name: 'Badgers MBB' },
            { id: '275', league: 'basketball/womens-college-basketball', name: 'Badgers WBB' }
        ]
    }
};

let sportsIntervalTimer = null;

const StorageEngine = {
    get(key) {
        const cached = localStorage.getItem(`tony_v03_${key}`);
        return cached ? JSON.parse(cached) : null;
    },
    set(key, data) {
        try {
            localStorage.setItem(`tony_v03_${key}`, JSON.stringify({ timestamp: Date.now(), data }));
        } catch (e) { console.error("Storage Write Error"); }
    },
    async fetch(key, url, ttl) {
        const cached = this.get(key);
        if (cached && (Date.now() - cached.timestamp < ttl)) return cached.data;
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error("HTTP " + res.status);
            const data = await res.json();
            this.set(key, data);
            return data;
        } catch (e) { 
            console.warn(`[Network] ${key} degraded.`, e);
            return cached ? cached.data : null; 
        }
    }
};

function startClock() {
    const update = () => {
        const now = new Date();
        document.getElementById('comp-hour').textContent = now.toLocaleTimeString('en-US', { hour: '2-digit', hour12: false }).split(':')[0];
        document.getElementById('comp-minute').textContent = now.toLocaleTimeString('en-US', { minute: '2-digit' });
        document.getElementById('comp-date').textContent = now.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    };
    update(); setInterval(update, 1000);
}

const WeatherPipeline = {
    getIcon(code) {
        const c = parseInt(code);
        if ([1000, 1100].includes(c)) return `<svg fill="none" stroke="currentColor" stroke-width="1.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>`;
        if ([1101, 1102].includes(c)) return `<svg fill="none" stroke="currentColor" stroke-width="1.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"></path></svg>`;
        if ([4000, 4200, 4201].includes(c)) return `<svg fill="none" stroke="currentColor" stroke-width="1.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 14.99A4 4 0 0015 11H9.5a5.5 5.5 0 00-5.5 5.5v.5h15v-2zM12 21v-4m-4 4v-4m8 4v-4"></path></svg>`;
        if ([5000, 5001, 5100, 5101].includes(c)) return `<svg fill="none" stroke="currentColor" stroke-width="1.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3v18m0-18l-4 4m4-4l4 4m-4 14l-4-4m4 4l4-4M5.636 6.636l12.728 12.728m-12.728 0L18.364 6.636"></path></svg>`;
        return `<svg fill="none" stroke="currentColor" stroke-width="1.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"></path></svg>`;
    },

    async sync() {
        const data = await StorageEngine.fetch('weather', CONFIG.api.weatherProxy, CONFIG.api.weatherInterval);
        if (!data) return;
        
        try {
            const timelines = data.data?.timelines || data.timelines;
            // Safe traversal: fallback through minutely, hourly, then daily
            const current = timelines.minutely?.[0]?.values || timelines.hourly?.[0]?.values || timelines.daily?.[0]?.values;
            const today = timelines.daily?.[0]?.values;

            if (!current || !today) throw new Error("Malformed Weather Payload");

            document.getElementById('current-temp').textContent = `${Math.round(current.temperature)}°`;
            document.getElementById('high-temp').textContent = `${Math.round(today.temperatureMax)}°`;
            document.getElementById('low-temp').textContent = `${Math.round(today.temperatureMin)}°`;
            document.getElementById('current-icon').innerHTML = this.getIcon(current.weatherCode);
            document.getElementById('dew-point').textContent = `${Math.round(current.dewPoint)}°`;
            document.getElementById('wind-speed').textContent = `${Math.round(current.windSpeed)} mph`;
            document.getElementById('wind-dir-icon').style.transform = `rotate(${current.windDirection}deg)`;
            
            const aqi = Math.round(current.epaPrimaryAQI || 25);
            document.getElementById('aqi-value').textContent = aqi;
            document.getElementById('aqi-ring').style.strokeDashoffset = 364 - (Math.min(aqi, 200) / 200 * 364);

            document.getElementById('sunrise-time').textContent = new Date(today.sunriseTime).toLocaleTimeString([], {hour:'numeric', minute:'2-digit'});
            document.getElementById('sunset-time').textContent = new Date(today.sunsetTime).toLocaleTimeString([], {hour:'numeric', minute:'2-digit'});
            document.getElementById('golden-hour-time').textContent = new Date(new Date(today.sunsetTime).getTime() - 3600000).toLocaleTimeString([], {hour:'numeric', minute:'2-digit'});

            let forecast = '';
            timelines.daily.slice(1, 6).forEach(day => {
                const v = day.values;
                forecast += `
                    <div class="flex flex-col items-center gap-2">
                        <span class="text-[10px] font-mono text-slate-500">${new Date(day.startTime).toLocaleDateString([], {weekday:'short'}).toUpperCase()}</span>
                        <div class="w-10 h-10 text-slate-400">${this.getIcon(v.weatherCodeMax)}</div>
                        <div class="font-mono text-sm"><span class="text-white">${Math.round(v.temperatureMax)}°</span></div>
                        <div class="text-[9px] font-mono text-slate-600">💧${Math.round(v.precipitationProbabilityMax)}%</div>
                    </div>`;
            });
            document.getElementById('forecast-container').innerHTML = forecast;
        } catch (e) {
            console.error("[Weather Pipeline Error]", e);
        }
    }
};

const SportsPipeline = {
    async fetchTeam(team) {
        const url = `https://site.api.espn.com/apis/site/v2/sports/${team.league}/teams/${team.id}/schedule`;
        return await StorageEngine.fetch(`sports_${team.id}`, url, CONFIG.api.sportsIdleInterval);
    },

    renderRow(team, data) {
        try {
            const events = data?.events || [];
            if (events.length === 0) return this.buildHibernation(team.name, "NO DATA");

            const now = new Date();
            const live = events.find(e => e.competitions?.[0]?.status?.type?.state === 'in');
            const past = events.filter(e => new Date(e.competitions?.[0]?.date) < now).sort((a,b) => new Date(b.competitions[0].date) - new Date(a.competitions[0].date));
            const next = events.find(e => new Date(e.competitions?.[0]?.date) > now);

            const target = live || next || past[0];
            if (!target) return this.buildHibernation(team.name, "HIBERNATION");

            const comp = target.competitions[0];
            
            // STRICT ID PATHING FIX
            const myTeam = comp.competitors.find(c => c.team.id === team.id);
            const opp = comp.competitors.find(c => c.team.id !== team.id);
            
            if (!myTeam || !opp) return this.buildHibernation(team.name, "DATA ANOMALY");

            let record = "0-0";
            if (myTeam.record && myTeam.record[0]) record = myTeam.record[0].summary;
            else if (myTeam.records && myTeam.records[0]) record = myTeam.records[0].summary;
            else if (myTeam.team?.standings) record = myTeam.team.standings.summary;

            let lastResult = '';
            if (past.length > 0) {
                const lastGameMyTeam = past[0].competitions[0].competitors.find(c => c.team.id === team.id);
                if (lastGameMyTeam && lastGameMyTeam.winner !== undefined) {
                    lastResult = lastGameMyTeam.winner ? 'W' : 'L';
                }
            }

            if (target.status.type.state === 'post' && (now - new Date(target.date)) > 864000000) {
                 return this.buildHibernation(team.name, `OFFSEASON // ${record}`);
            }

            const isLive = target.status.type.state === 'in';
            const logoHref = myTeam.team.logos?.[0]?.href || '';

            return `
                <div class="${isLive ? 'bg-slate-800/80 border-slate-500' : 'bg-slate-900/40 border-slate-800'} border rounded-2xl p-4 flex justify-between items-center transition-colors duration-500">
                    <div class="flex items-center gap-4">
                        ${logoHref ? `<img src="${logoHref}" class="w-8 h-8 object-contain">` : `<div class="w-8 h-8 bg-slate-800 rounded-full"></div>`}
                        <div>
                            <div class="font-bold text-sm text-slate-200">${team.name} <span class="text-[10px] font-mono text-slate-500 ml-1">${record}</span></div>
                            <div class="text-[10px] text-slate-400">vs ${opp.team.abbreviation} ${lastResult ? `<span class="ml-2 text-slate-600 font-mono">PREV: ${lastResult}</span>` : ''}</div>
                        </div>
                    </div>
                    <div class="text-right font-mono">
                        <div class="text-sm ${isLive ? 'text-red-500 animate-pulse' : 'text-white'}">${isLive ? `${myTeam.score || 0}-${opp.score || 0}` : new Date(target.date).toLocaleTimeString([], {hour:'numeric', minute:'2-digit'})}</div>
                        <div class="text-[9px] text-slate-500 uppercase mt-1">${isLive ? target.status.type.shortDetail : new Date(target.date).toLocaleDateString([], {month:'short', day:'numeric'})}</div>
                    </div>
                </div>`;
        } catch (e) {
            console.error(`[Sports Pipeline Error] ${team.name}:`, e);
            return this.buildHibernation(team.name, "PIPELINE FAULT");
        }
    },
    
    buildHibernation(name, subtext) {
        return `<div class="h-8 flex justify-between items-center px-4 bg-slate-900/20 rounded-lg text-[10px] font-mono text-slate-600 uppercase tracking-widest border border-transparent"><span>${name}</span><span>${subtext}</span></div>`;
    },

    async sync() {
        const render = async (teams, cid) => {
            let h = '';
            for (const t of teams) {
                const d = await this.fetchTeam(t);
                h += this.renderRow(t, d);
            }
            document.getElementById(cid).innerHTML = h;
        };
        await render(CONFIG.teams.pro, 'pro-sports-container');
        await render(CONFIG.teams.college, 'college-sports-container');
    }
};

function boot() {
    startClock();
    WeatherPipeline.sync();
    SportsPipeline.sync();
    setInterval(() => WeatherPipeline.sync(), CONFIG.api.weatherInterval);
}
document.addEventListener('DOMContentLoaded', boot);
