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
            { id: '15', domId: '15', league: 'nfl', sport: 'football', name: 'Vikings' },
            { id: '9', domId: '9', league: 'nfl', sport: 'football', name: 'Packers' },
            { id: '10', domId: '10', league: 'mlb', sport: 'baseball', name: 'Twins' },
            { id: '8', domId: '8', league: 'mlb', sport: 'baseball', name: 'Brewers' }
        ],
        college: [
            { id: '275', domId: '275-fb', league: 'college-football', sport: 'football', name: 'Badgers FB' },
            { id: '135', domId: '135-fb', league: 'college-football', sport: 'football', name: 'Gophers FB' },
            { id: '275', domId: '275-mbb', league: 'mens-college-basketball', sport: 'basketball', name: 'Badgers MBB' },
            { id: '275', domId: '275-wbb', league: 'womens-college-basketball', sport: 'basketball', name: 'Badgers WBB' }
        ]
    }
};

let sportsIntervalTimer = null;

const StorageEngine = {
    get(key) {
        const cached = localStorage.getItem(`t_v4_${key}`);
        return cached ? JSON.parse(cached) : null;
    },
    set(key, data) {
        try {
            localStorage.setItem(`t_v4_${key}`, JSON.stringify({ timestamp: Date.now(), data }));
        } catch (e) {
            console.error("StorageEngine Write Fault", e);
        }
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
            console.warn(`[Network Degraded] ${key} using cache.`, e);
            return cached ? cached.data : null; 
        }
    }
};

function startClock() {
    const update = () => {
        const now = new Date();
        let hours = now.getHours() % 12 || 12;
        document.getElementById('comp-hour').textContent = hours.toString().padStart(2, '0');
        document.getElementById('comp-minute').textContent = now.getMinutes().toString().padStart(2, '0');
        document.getElementById('comp-date').textContent = now.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    };
    update(); 
    setInterval(update, 1000);
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

    setAqiColors(aqi) {
        const ring = document.getElementById('aqi-ring');
        const skull = document.getElementById('aqi-skull');
        
        ring.classList.remove('stroke-green-400', 'stroke-yellow-400', 'stroke-orange-400', 'stroke-red-400', 'stroke-purple-400', 'stroke-slate-600');
        
        if (aqi <= 50) ring.classList.add('stroke-green-400');
        else if (aqi <= 100) ring.classList.add('stroke-yellow-400');
        else if (aqi <= 150) ring.classList.add('stroke-orange-400');
        else if (aqi <= 200) ring.classList.add('stroke-red-400');
        else ring.classList.add('stroke-purple-400');

        if (aqi >= 200) skull.classList.remove('hidden');
        else skull.classList.add('hidden');
    },

    async sync() {
        const data = await StorageEngine.fetch('weather', CONFIG.api.weatherProxy, CONFIG.api.weatherInterval);
        if (!data) return;
        
        try {
            const timelines = data.data?.timelines || data.timelines;
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
            this.setAqiColors(aqi);

            document.getElementById('sunrise-time').textContent = new Date(today.sunriseTime).toLocaleTimeString([], {hour:'numeric', minute:'2-digit'});
            document.getElementById('sunset-time').textContent = new Date(today.sunsetTime).toLocaleTimeString([], {hour:'numeric', minute:'2-digit'});

            timelines.daily.slice(1, 6).forEach((day, index) => {
                const i = index + 1;
                const v = day.values;
                const rawTime = day.startTime || day.time;
                const dDate = rawTime ? new Date(rawTime) : new Date(Date.now() + (i * 86400000));
                
                let dayName = isNaN(dDate.getTime()) ? '--' : dDate.toLocaleDateString([], {weekday:'short'}).toUpperCase();

                document.getElementById(`forecast-day-${i}-name`).textContent = dayName;
                document.getElementById(`forecast-day-${i}-icon`).innerHTML = this.getIcon(v.weatherCodeMax);
                document.getElementById(`forecast-day-${i}-temp`).textContent = `${Math.round(v.temperatureMax)}°`;
                document.getElementById(`forecast-day-${i}-precip`).textContent = `💧${Math.round(v.precipitationProbabilityMax || 0)}%`;
                document.getElementById(`forecast-day-${i}-cloud`).textContent = `☁️${Math.round(v.cloudCoverMax || 0)}%`;
                document.getElementById(`forecast-day-${i}-uv`).textContent = `UV:${Math.round(v.uvIndexMax || 0)}`;
            });
        } catch (e) {
            console.error("[Weather Pipeline Fault]", e);
        }
    }
};

const SportsPipeline = {
    async fetchTeam(team) {
        const url = `https://site.api.espn.com/apis/site/v2/sports/${team.sport}/${team.league}/teams/${team.id}/schedule`;
        const ttl = (sportsIntervalTimer && sportsIntervalTimer._repeat === CONFIG.api.sportsLiveInterval) ? CONFIG.api.sportsLiveInterval : CONFIG.api.sportsIdleInterval;
        const cacheKey = `sports_${team.domId}`;
        
        const cached = StorageEngine.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp < ttl)) return cached.data;

        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error("HTTP " + res.status);
            const rawData = await res.json();

            // Aggressive Payload Trimmer & Primitive Coercion Enforcer
            const trimmedEvents = (rawData?.events || []).map(e => {
                const comp = e?.competitions?.[0];
                return {
                    date: e?.date,
                    competitions: [{
                        date: comp?.date,
                        status: { 
                            type: { 
                                state: comp?.status?.type?.state, 
                                shortDetail: comp?.status?.type?.shortDetail 
                            } 
                        },
                        broadcasts: [{ names: [comp?.broadcasts?.[0]?.names?.[0]] }],
                        competitors: (comp?.competitors || []).map(c => ({
                            homeAway: c?.homeAway,
                            winner: c?.winner,
                            // Strict Primitive Evaluation to kill [object Object] artifacts
                            score: c?.score?.displayValue ?? c?.score?.value ?? c?.score ?? null,
                            records: [{ summary: c?.records?.[0]?.summary }],
                            team: {
                                id: c?.team?.id,
                                abbreviation: c?.team?.abbreviation,
                                logos: [{ href: c?.team?.logos?.[0]?.href }]
                            }
                        }))
                    }]
                };
            });

            const trimmedData = { events: trimmedEvents };
            StorageEngine.set(cacheKey, trimmedData);
            return trimmedData;
        } catch (e) {
            console.warn(`[Network Degraded] ${team.name} using cache.`, e);
            return cached ? cached.data : null;
        }
    },

    mutateDom(domId, renderData) {
        const card = document.getElementById(`sports-card-${domId}`);
        if (!card) return;

        card.classList.remove('hidden');

        document.getElementById(`sports-name-${domId}`).textContent = renderData.name;
        document.getElementById(`sports-record-${domId}`).textContent = renderData.record;
        document.getElementById(`sports-opp-${domId}`).textContent = renderData.opp;
        document.getElementById(`sports-score-${domId}`).textContent = renderData.score;
        document.getElementById(`sports-status-${domId}`).textContent = renderData.status;

        const scoreEl = document.getElementById(`sports-score-${domId}`);
        if (renderData.isLive) {
            card.classList.replace('bg-slate-900/40', 'bg-slate-800/80');
            card.classList.replace('border-slate-800', 'border-slate-500');
            scoreEl.classList.add('text-red-500', 'animate-pulse');
            scoreEl.classList.remove('text-white');
        } else {
            card.classList.replace('bg-slate-800/80', 'bg-slate-900/40');
            card.classList.replace('border-slate-500', 'border-slate-800');
            scoreEl.classList.remove('text-red-500', 'animate-pulse');
            scoreEl.classList.add('text-white');
        }

        const logoEl = document.getElementById(`sports-logo-${domId}`);
        if (renderData.logoHref) {
            logoEl.src = renderData.logoHref;
            logoEl.classList.remove('hidden');
        } else {
            logoEl.classList.add('hidden');
        }

        const broadcastEl = document.getElementById(`sports-broadcast-${domId}`);
        if (renderData.broadcast && !renderData.isPast) {
            broadcastEl.textContent = renderData.broadcast;
            broadcastEl.classList.remove('hidden');
        } else {
            broadcastEl.classList.add('hidden');
        }

        const prevEl = document.getElementById(`sports-prev-${domId}`);
        if (renderData.prevResult && !renderData.isLive) {
            prevEl.textContent = renderData.prevResult;
        } else {
            prevEl.textContent = '';
        }
    },

    processTeamData(team, data) {
        const payload = {
            name: team.name, record: '', opp: '', score: '--', status: '', isLive: false, isPast: false, logoHref: '', broadcast: '', prevResult: ''
        };

        const events = data?.events || [];
        if (events.length === 0) {
            payload.opp = 'NO DATA';
            this.mutateDom(team.domId, payload);
            return payload.isLive;
        }

        const now = new Date();
        const live = events.find(e => e?.competitions?.[0]?.status?.type?.state === 'in');
        const past = events.filter(e => new Date(e?.competitions?.[0]?.date) < now).sort((a,b) => new Date(b?.competitions?.[0]?.date) - new Date(a?.competitions?.[0]?.date));
        const next = events.find(e => new Date(e?.competitions?.[0]?.date) > now);

        const target = live || next || past[0];
        if (!target) {
            payload.opp = 'HIBERNATION';
            this.mutateDom(team.domId, payload);
            return payload.isLive;
        }

        const comp = target?.competitions?.[0];
        
        let home = comp?.competitors?.find(c => c?.homeAway === 'home');
        let away = comp?.competitors?.find(c => c?.homeAway === 'away');
        if (!home || !away) {
            home = comp?.competitors?.[0];
            away = comp?.competitors?.[1];
        }

        const myTeam = String(home?.team?.id) === String(team.id) ? home : (String(away?.team?.id) === String(team.id) ? away : null);
        const opp = String(home?.team?.id) === String(team.id) ? away : home;
        
        if (!myTeam || !opp) {
            payload.opp = 'DATA ANOMALY';
            this.mutateDom(team.domId, payload);
            return payload.isLive;
        }

        payload.record = myTeam?.records?.[0]?.summary || '';

        if (comp?.status?.type?.state === 'post' && (now - new Date(comp?.date)) > 864000000) {
            payload.opp = `OFFSEASON`;
            this.mutateDom(team.domId, payload);
            return payload.isLive;
        }

        payload.isLive = comp?.status?.type?.state === 'in';
        payload.isPast = comp?.status?.type?.state === 'post';
        payload.logoHref = myTeam?.team?.logos?.[0]?.href || '';
        payload.broadcast = comp?.broadcasts?.[0]?.names?.[0] || '';

        if (past.length > 0) {
            const lastGame = past[0]?.competitions?.[0];
            let lastHome = lastGame?.competitors?.find(c => c?.homeAway === 'home');
            let lastAway = lastGame?.competitors?.find(c => c?.homeAway === 'away');
            if (!lastHome || !lastAway) {
                lastHome = lastGame?.competitors?.[0];
                lastAway = lastGame?.competitors?.[1];
            }

            const lastMyTeam = String(lastHome?.team?.id) === String(team.id) ? lastHome : (String(lastAway?.team?.id) === String(team.id) ? lastAway : null);
            const lastOpp = String(lastHome?.team?.id) === String(team.id) ? lastAway : lastHome;
            
            if (lastMyTeam && lastOpp && lastMyTeam.winner !== undefined) {
                const resStr = lastMyTeam.winner ? 'W' : 'L';
                payload.prevResult = `PREV: ${resStr} ${lastMyTeam.score || 0}-${lastOpp.score || 0}`;
            }
        }

        payload.opp = `vs ${opp?.team?.abbreviation || 'TBA'}`;
        payload.score = payload.isLive || payload.isPast ? `${myTeam?.score || 0}-${opp?.score || 0}` : new Date(comp?.date).toLocaleTimeString([], {hour:'numeric', minute:'2-digit'});
        payload.status = payload.isLive ? comp?.status?.type?.shortDetail : new Date(comp?.date).toLocaleDateString([], {month:'short', day:'numeric'});

        this.mutateDom(team.domId, payload);
        return payload.isLive;
    },

    async sync() {
        let anyGameLive = false;
        const allTeams = [...CONFIG.teams.pro, ...CONFIG.teams.college];

        // Strict sequential fetch loop to bypass HTTP 429 blocks
        for (const t of allTeams) {
            try {
                const d = await this.fetchTeam(t);
                const isLive = this.processTeamData(t, d);
                if (isLive) anyGameLive = true;
            } catch (e) {
                console.error(`[Sports Pipeline Fault] ${t.name}:`, e);
                this.mutateDom(t.domId, { name: t.name, record: '', opp: 'PIPELINE FAULT', score: '--', status: '', isLive: false, isPast: false, logoHref: '', broadcast: '', prevResult: '' });
            }
        }

        const targetInterval = anyGameLive ? CONFIG.api.sportsLiveInterval : CONFIG.api.sportsIdleInterval;
        
        if (!sportsIntervalTimer || sportsIntervalTimer._repeat !== targetInterval) {
            if (sportsIntervalTimer) clearInterval(sportsIntervalTimer);
            sportsIntervalTimer = setInterval(() => this.sync(), targetInterval);
            sportsIntervalTimer._repeat = targetInterval;
        }
    }
};

function boot() {
    // Aggressive garbage collection to free Pi memory on reload
    Object.keys(localStorage).forEach(key => {
        if (key.startsWith('tony_v')) {
            localStorage.removeItem(key);
        }
    });

    startClock();
    WeatherPipeline.sync();
    SportsPipeline.sync();
    
    setInterval(() => WeatherPipeline.sync(), CONFIG.api.weatherInterval);
}

document.addEventListener('DOMContentLoaded', boot);
