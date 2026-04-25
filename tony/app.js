/**
 * TONY KIOSK ENGINE // V0.2
 * Hardware Target: Raspberry Pi 3 (1GB RAM)
 * Interaction Model: 100% Autonomous (Zero Peripherals)
 */

// --- 1. SYSTEM CONFIGURATION ---
const CONFIG = {
    location: {
        zip: "55426",
        lat: 44.9483,
        lon: -93.3666
    },
    api: {
        weatherProxy: `https://kzick-weather.askozicki.workers.dev?lat=44.9483&lon=-93.3666`,
        weatherInterval: 5 * 60 * 1000, // 5 minutes (Safe for 500/day limit)
        sportsIdleInterval: 6 * 60 * 60 * 1000, // 6 hours
        sportsLiveInterval: 5 * 60 * 1000 // 5 minutes
    },
    teams: {
        pro: [
            { id: '15', league: 'football/nfl', name: 'Vikings', abbreviation: 'MIN' },
            { id: '9', league: 'football/nfl', name: 'Packers', abbreviation: 'GB' },
            { id: '10', league: 'baseball/mlb', name: 'Twins', abbreviation: 'MIN' },
            { id: '8', league: 'baseball/mlb', name: 'Brewers', abbreviation: 'MIL' }
        ],
        college: [
            { id: '275', league: 'football/college-football', name: 'Badgers FB', abbreviation: 'WIS' },
            { id: '135', league: 'football/college-football', name: 'Gophers FB', abbreviation: 'MIN' },
            { id: '275', league: 'basketball/mens-college-basketball', name: 'Badgers MBB', abbreviation: 'WIS' },
            { id: '275', league: 'basketball/womens-college-basketball', name: 'Badgers WBB', abbreviation: 'WIS' }
        ]
    }
};

let sportsIntervalTimer = null;

// --- 2. CACHE & NETWORK ENGINE ---
const CacheEngine = {
    async fetch(key, url, ttlMs) {
        const cached = sessionStorage.getItem(`tony_v02_${key}`);
        if (cached) {
            const parsed = JSON.parse(cached);
            if (Date.now() - parsed.timestamp < ttlMs) {
                return parsed.data;
            }
        }
        
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            
            sessionStorage.setItem(`tony_v02_${key}`, JSON.stringify({
                timestamp: Date.now(),
                data: data
            }));
            
            this.setSystemStatus(true);
            return data;
        } catch (error) {
            console.error(`[Network Error] ${key}:`, error);
            this.setSystemStatus(false);
            
            // Fallback to stale cache if offline
            if (cached) return JSON.parse(cached).data;
            return null;
        }
    },
    
    setSystemStatus(isOnline) {
        const dot = document.getElementById('sys-status-dot');
        const text = document.getElementById('sys-status-text');
        if (isOnline) {
            dot.className = "text-green-500 animate-pulse";
            text.textContent = "ONLINE";
            text.className = "text-slate-300";
        } else {
            dot.className = "text-red-500";
            text.textContent = "OFFLINE";
            text.className = "text-red-500";
        }
    }
};

// --- 3. CHRONOMETER ---
function startClock() {
    const updateTime = () => {
        const now = new Date();
        document.getElementById('comp-time').textContent = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        document.getElementById('comp-date').textContent = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    };
    updateTime();
    setInterval(updateTime, 1000);
}

// --- 4. WEATHER PIPELINE ---
const WeatherPipeline = {
    getIcon(code) {
        const c = parseInt(code);
        // Map Tomorrow.io codes to minimal SVGs
        if ([1000, 1100].includes(c)) return `<svg fill="none" stroke="currentColor" stroke-width="1.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>`;
        if ([1101, 1102].includes(c)) return `<svg fill="none" stroke="currentColor" stroke-width="1.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"></path><path stroke-linecap="round" stroke-linejoin="round" d="M16 5l.01-.01"></path></svg>`;
        if ([4000, 4200, 4201].includes(c)) return `<svg fill="none" stroke="currentColor" stroke-width="1.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 14.99A4 4 0 0015 11H9.5a5.5 5.5 0 00-5.5 5.5v.5h15v-2zM12 21v-4m-4 4v-4m8 4v-4"></path></svg>`;
        if ([5000, 5001, 5100, 5101].includes(c)) return `<svg fill="none" stroke="currentColor" stroke-width="1.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3v18m0-18l-4 4m4-4l4 4m-4 14l-4-4m4 4l4-4M5.636 6.636l12.728 12.728m-12.728 0L18.364 6.636"></path></svg>`;
        return `<svg fill="none" stroke="currentColor" stroke-width="1.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"></path></svg>`;
    },

    processAQI(value) {
        const val = value || 1;
        let desc = 'GOOD'; let color = 'text-green-500'; let stroke = 'stroke-green-500';
        
        if (val > 50) { desc = 'MODERATE'; color = 'text-yellow-500'; stroke = 'stroke-yellow-500'; }
        if (val > 100) { desc = 'SENSITIVE'; color = 'text-orange-500'; stroke = 'stroke-orange-500'; }
        if (val > 150) { desc = 'UNHEALTHY'; color = 'text-red-500'; stroke = 'stroke-red-500'; }

        document.getElementById('aqi-value').textContent = val;
        document.getElementById('aqi-value').className = `font-mono text-2xl text-white font-bold tracking-tighter ${color}`;
        document.getElementById('aqi-desc').textContent = desc;
        document.getElementById('aqi-desc').className = `text-[10px] font-mono text-slate-400 mt-4 text-center uppercase tracking-widest font-bold h-6 ${color}`;

        // Ring Math (Circumference 264)
        const cap = Math.min(val, 200);
        const offset = 264 - ((cap / 200) * 264);
        const ring = document.getElementById('aqi-ring');
        ring.style.strokeDashoffset = offset;
        ring.setAttribute('class', `transition-all duration-1000 ${stroke}`);
    },

    async sync() {
        const data = await CacheEngine.fetch('weather', CONFIG.api.weatherProxy, CONFIG.api.weatherInterval);
        if (!data) return;

        try {
            // Extract Timelines (Account for Proxy structure variations)
            const timelines = data.data?.timelines || data.timelines;
            const current = timelines.minutely?.[0]?.values || timelines.hourly?.[0]?.values || timelines.daily?.[0]?.values;
            const daily = timelines.daily || [];
            const today = daily[0]?.values || current;

            // 1. Complication & Current Card
            const curTemp = Math.round(current.temperature || 0);
            document.getElementById('comp-temp').textContent = `${curTemp}°`;
            document.getElementById('current-temp').textContent = `${curTemp}°`;
            document.getElementById('current-icon').innerHTML = this.getIcon(current.weatherCode);
            document.getElementById('high-temp').textContent = `${Math.round(today.temperatureMax || curTemp)}°`;
            document.getElementById('low-temp').textContent = `${Math.round(today.temperatureMin || curTemp)}°`;
            document.getElementById('weather-desc').textContent = "DATA SYNCED";

            // 2. Atmospherics
            document.getElementById('dew-point').textContent = `${Math.round(current.dewPoint || 0)}°`;
            document.getElementById('humidity').textContent = `${Math.round(current.humidity || 0)}%`;
            document.getElementById('wind-speed').textContent = `${Math.round(current.windSpeed || 0)} mph`;
            document.getElementById('wind-dir-icon').style.transform = `rotate(${current.windDirection || 0}deg)`;

            // 3. AQI & Sun
            const aqi = current.epaPrimaryAQI || current.epaIndex || 25; // Estimate if missing
            this.processAQI(Math.round(aqi));

            if (today.sunriseTime) {
                document.getElementById('sunrise-time').textContent = new Date(today.sunriseTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
                document.getElementById('sunset-time').textContent = new Date(today.sunsetTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
            }

            // 4. 5-Day Horizon
            let forecastHTML = '';
            daily.slice(1, 6).forEach(day => {
                const date = new Date(day.startTime || day.time);
                const dayName = date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
                const v = day.values;
                
                forecastHTML += `
                    <div class="flex flex-col items-center flex-1">
                        <span class="text-[10px] font-mono text-slate-500 tracking-widest mb-3">${dayName}</span>
                        <div class="w-10 h-10 mb-3 text-slate-300">${this.getIcon(v.weatherCodeMax || v.weatherCode)}</div>
                        <div class="flex items-center gap-2 mb-2 font-mono">
                            <span class="text-red-500 font-medium">${Math.round(v.temperatureMax || 0)}°</span>
                            <span class="text-blue-500 font-medium">${Math.round(v.temperatureMin || 0)}°</span>
                        </div>
                        <span class="text-[10px] font-mono text-slate-600 tracking-widest">💧 ${Math.round(v.precipitationProbabilityMax || 0)}%</span>
                    </div>
                `;
            });
            document.getElementById('forecast-container').innerHTML = forecastHTML;

        } catch (e) {
            console.error("Weather Pipeline Parse Error:", e);
        }
    }
};

// --- 5. SPORTS PIPELINE ---
const SportsPipeline = {
    async fetchTeamData(teamConfig) {
        const url = `https://site.api.espn.com/apis/site/v2/sports/${teamConfig.league}/teams/${teamConfig.id}/schedule`;
        // Use the current polling interval as the TTL
        const ttl = (sportsIntervalTimer && sportsIntervalTimer._repeat === CONFIG.api.sportsLiveInterval) ? CONFIG.api.sportsLiveInterval : CONFIG.api.sportsIdleInterval;
        return await CacheEngine.fetch(`sports_${teamConfig.league}_${teamConfig.id}`, url, ttl);
    },

    parseGameEvent(event, teamId) {
        if (!event) return null;
        const comp = event.competitions[0];
        const home = comp.competitors.find(c => c.homeAway === 'home');
        const away = comp.competitors.find(c => c.homeAway === 'away');
        const myTeam = home.team.id === teamId ? home : away;
        const opponent = home.team.id === teamId ? away : home;
        
        return {
            date: new Date(comp.date),
            state: comp.status.type.state, // 'pre', 'in', 'post'
            detail: comp.status.type.shortDetail,
            isPlayoff: event.season?.type === 3,
            myTeam: {
                name: myTeam.team.abbreviation || myTeam.team.shortDisplayName,
                score: myTeam.score?.value || '-',
                record: myTeam.records?.[0]?.summary || '',
                seed: myTeam.curatedRank?.current || null,
                isWinner: myTeam.winner
            },
            opponent: {
                name: opponent.team.abbreviation || opponent.team.shortDisplayName,
                score: opponent.score?.value || '-',
                record: opponent.records?.[0]?.summary || '',
                seed: opponent.curatedRank?.current || null,
                isWinner: opponent.winner
            }
        };
    },

    renderTeamRow(teamConfig, data) {
        if (!data || !data.events || data.events.length === 0) {
            return this.buildHtmlRow(teamConfig.name, 'OFFSEASON', 'text-slate-600', null, null);
        }

        const events = data.events;
        let targetEvent = events.find(e => e.competitions[0].status.type.state === 'in');
        let isLive = !!targetEvent;

        if (!targetEvent) {
            const now = new Date();
            // Find closest next game, or most recent past game
            const futureGames = events.filter(e => new Date(e.competitions[0].date) > now);
            if (futureGames.length > 0) {
                targetEvent = futureGames[0];
            } else {
                targetEvent = events[events.length - 1]; // Last game of season
            }
        }

        const game = this.parseGameEvent(targetEvent, teamConfig.id);
        if (!game) return this.buildHtmlRow(teamConfig.name, 'HIBERNATION', 'text-slate-600', null, null);

        // Detect stale games (Offseason formatting)
        const daysDiff = (game.date - new Date()) / (1000 * 60 * 60 * 24);
        if (game.state === 'post' && daysDiff < -14) {
            return this.buildHtmlRow(teamConfig.name, 'OFFSEASON', 'text-slate-600', null, null);
        }

        // Playoff Pill Logic
        let playoffHtml = '';
        if (game.isPlayoff) {
            const seedText = game.myTeam.seed && game.myTeam.seed < 99 ? `SEED ${game.myTeam.seed}` : 'PLAYOFF';
            playoffHtml = `<span class="bg-blue-900/50 text-blue-400 border border-blue-500/30 px-1.5 py-0.5 rounded text-[9px] ml-2 tracking-widest">${seedText}</span>`;
        }

        // Live vs Pre vs Post formatting
        let statusHtml = '';
        let scoreOrTimeHtml = '';

        if (game.state === 'in') {
            statusHtml = `<span class="bg-red-900/40 text-red-500 border border-red-500/50 px-2 py-0.5 rounded text-[10px] animate-pulse">LIVE: ${game.detail}</span>`;
            scoreOrTimeHtml = `<span class="text-white">${game.myTeam.score} - ${game.opponent.score}</span>`;
        } else if (game.state === 'post') {
            statusHtml = `<span class="text-slate-500 text-[10px]">${game.date.toLocaleDateString('en-US', { month:'short', day:'numeric' })}</span>`;
            const winColor = game.myTeam.isWinner ? 'text-white' : 'text-slate-500';
            scoreOrTimeHtml = `<span class="${winColor}">${game.myTeam.score} - ${game.opponent.score}</span>`;
        } else {
            // Pre-game
            statusHtml = `<span class="text-slate-500 text-[10px]">${game.date.toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' })}</span>`;
            scoreOrTimeHtml = `<span class="text-slate-400">${game.date.toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit' })}</span>`;
        }

        const matchUpText = `vs ${game.opponent.name} <span class="text-slate-600 ml-1">(${game.opponent.record})</span>`;
        
        return this.buildHtmlRow(
            `${teamConfig.name} ${playoffHtml}`, 
            statusHtml, 
            'text-slate-300', 
            matchUpText, 
            scoreOrTimeHtml,
            isLive
        );
    },

    buildHtmlRow(titleHtml, statusHtml, titleColor, matchUpHtml, rightColHtml, isLive = false) {
        const bgClass = isLive ? 'bg-slate-800/80 border-slate-700' : 'bg-slate-900/40 border-slate-800/50';
        return `
            <div class="${bgClass} border rounded-xl p-3 flex justify-between items-center h-16 w-full">
                <div class="flex flex-col justify-center">
                    <div class="font-bold text-sm ${titleColor} flex items-center">${titleHtml}</div>
                    ${matchUpHtml ? `<div class="text-[10px] font-mono text-slate-400 mt-0.5">${matchUpHtml}</div>` : ''}
                </div>
                <div class="flex flex-col items-end justify-center font-mono text-sm">
                    ${rightColHtml ? rightColHtml : ''}
                    ${statusHtml}
                </div>
            </div>
        `;
    },

    async sync() {
        let anyGameLive = false;

        // Process Pro Teams
        const proPromises = CONFIG.teams.pro.map(team => this.fetchTeamData(team));
        const proData = await Promise.all(proPromises);
        let proHtml = '';
        
        CONFIG.teams.pro.forEach((team, idx) => {
            const html = this.renderTeamRow(team, proData[idx]);
            if (html.includes('animate-pulse')) anyGameLive = true;
            proHtml += html;
        });
        document.getElementById('pro-sports-container').innerHTML = proHtml;

        // Process College Teams
        const collegePromises = CONFIG.teams.college.map(team => this.fetchTeamData(team));
        const collegeData = await Promise.all(collegePromises);
        let collegeHtml = '';
        
        CONFIG.teams.college.forEach((team, idx) => {
            const html = this.renderTeamRow(team, collegeData[idx]);
            if (html.includes('animate-pulse')) anyGameLive = true;
            collegeHtml += html;
        });
        document.getElementById('college-sports-container').innerHTML = collegeHtml;

        // Dynamic Polling Engine
        const targetInterval = anyGameLive ? CONFIG.api.sportsLiveInterval : CONFIG.api.sportsIdleInterval;
        
        // If the polling requirement changed, rebuild the interval
        if (!sportsIntervalTimer || sportsIntervalTimer._repeat !== targetInterval) {
            if (sportsIntervalTimer) clearInterval(sportsIntervalTimer);
            sportsIntervalTimer = setInterval(() => this.sync(), targetInterval);
            // Attach property to track interval length
            sportsIntervalTimer._repeat = targetInterval;
            console.log(`[Sports Engine] Interval shifted to ${targetInterval / 1000 / 60} minutes.`);
        }
    }
};

// --- 6. INITIALIZATION SEQUENCE ---
function boot() {
    startClock();
    
    // Immediate first fetches
    WeatherPipeline.sync();
    SportsPipeline.sync();

    // Weather fixed interval
    setInterval(() => WeatherPipeline.sync(), CONFIG.api.weatherInterval);
}

// Start sequence when DOM is ready
document.addEventListener('DOMContentLoaded', boot);
