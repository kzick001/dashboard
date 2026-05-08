let standingsCache = {};

// 1. Offseason Iron Dome Trap
function isOffseason(leagueId) {
    const deadZones = {
        'nfl': { start: '02-20', end: '07-15' },
        'college-football': { start: '01-20', end: '08-15' },
        'nba': { start: '06-25', end: '09-30' },
        'nhl': { start: '06-25', end: '09-15' },
        'pwhl': { start: '06-01', end: '11-01' },
        'mlb': { start: '11-10', end: '02-15' },
        'wnba': { start: '11-01', end: '04-15' },
        'mens-college-basketball': { start: '04-15', end: '10-15' },
        'womens-college-basketball': { start: '04-15', end: '10-15' },
        'mens-college-hockey': { start: '04-15', end: '09-15' },
        'womens-college-hockey': { start: '04-15', end: '09-15' }
    };

    const range = deadZones[leagueId];
    if (!range) return false;

    const now = new Date();
    const today = String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');

    if (range.start <= range.end) {
        return today >= range.start && today <= range.end;
    } else {
        return today >= range.start || today <= range.end;
    }
}

const safeScore = (s) => (typeof s === 'object' && s !== null) ? (s.value || s.displayValue || '-') : s;

// Fetch standings to patch records missing from schedule endpoint
async function fetchAllStandings() {
    const leagues = [
        { id: 'nfl', sport: 'football' }, { id: 'nba', sport: 'basketball' },
        { id: 'wnba', sport: 'basketball' }, { id: 'mlb', sport: 'baseball' }, 
        { id: 'nhl', sport: 'hockey' }, { id: 'mens-college-basketball', sport: 'basketball' },
        { id: 'womens-college-basketball', sport: 'basketball' }
    ];
    for (const lg of leagues) {
        try {
            const resp = await fetch(`https://site.api.espn.com/apis/v2/sports/${lg.sport}/${lg.id}/standings`);
            standingsCache[lg.id] = await resp.json();
        } catch (e) {}
    }
}

function getRecord(teamData, leagueId) {
    let record = teamData?.records?.[0]?.summary || teamData?.team?.record?.items?.[0]?.summary || teamData?.team?.record?.summary;
    if (record) return record;
    
    const data = standingsCache[leagueId];
    if (!data || !teamData?.team?.id) return '';
    
    function search(obj) {
        if (record) return; 
        if (!obj || typeof obj !== 'object') return;
        if (obj.team && String(obj.team.id) === String(teamData.team.id)) {
            const stats = obj.stats || [];
            const overall = stats.find(s => s.name === 'overall') || stats.find(s => s.type === 'overall') || stats[0];
            if (overall) record = overall.displayValue || overall.summary || '';
            return;
        }
        if (Array.isArray(obj)) { for (let item of obj) search(item); } 
        else { for (let key in obj) search(obj[key]); }
    }
    search(data);
    return record;
}

// 2. Normalizer Adapter & Renderer
function createCupertinoCard(config, rawData) {
    // Check Offseason Trap First
    if (isOffseason(config.league)) {
        return {
            weight: 4,
            html: `
                <div class="glass-card p-5 flex flex-col justify-between h-48 opacity-40 grayscale-[80%] hover:opacity-100 hover:grayscale-0">
                    <div class="flex justify-between items-start mb-2">
                        <div class="flex items-center gap-2">${config.icon} <span class="text-sm font-semibold text-white/80">${config.name}</span></div>
                        <span class="px-2 py-0.5 bg-white/5 border border-white/10 rounded text-[9px] font-mono text-white/40 uppercase tracking-widest">Offseason</span>
                    </div>
                    <div class="flex flex-col mt-auto pt-3 border-t border-white/5">
                        <span class="text-[9px] font-mono text-white/30 uppercase tracking-widest text-center mt-2">Data Dormant</span>
                    </div>
                </div>
            `
        };
    }

    const teamEvents = rawData.events.filter(e => {
        const comps = e?.competitions?.[0]?.competitors || [];
        return comps.length > 0; 
    });

    if (teamEvents.length === 0) return { weight: 5, html: '' };

    const now = new Date();
    let event = teamEvents.find(e => e.status?.type?.state === 'in') || 
                teamEvents.reduce((closest, current) => {
                    const cDate = new Date(current.competitions?.[0]?.date || 0);
                    const clDate = new Date(closest.competitions?.[0]?.date || 0);
                    return Math.abs(cDate - now) < Math.abs(clDate - now) ? current : closest;
                }, teamEvents[0]);

    const comp = event?.competitions?.[0];
    if (!comp) return { weight: 5, html: '' };

    const gameDate = new Date(comp.date);
    const daysDiff = (gameDate - now) / (1000 * 60 * 60 * 24);
    
    const state = comp.status?.type?.state || 'pre';
    const isLive = state === 'in';
    const isFinal = state === 'post';
    
    let weight = 3; // Default Upcoming
    if (isLive) weight = 1;
    else if (isFinal && daysDiff > -2) weight = 2; // Bask (Played within last 48 hrs)
    else if (daysDiff < -2) weight = 4; // Should be offseason trap, fallback catch

    const comps = comp.competitors || [];
    const home = comps.find(c => c?.homeAway === 'home') || comps[0];
    const away = comps.find(c => c?.homeAway === 'away') || comps[1];

    // UI Data Extraction
    const venue = comp.notes?.[0]?.headline || comp.venue?.fullName || 'TBD Venue';
    const displayDate = isLive ? 'LIVE NOW' : gameDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: '2-digit' }).toUpperCase();
    const displayTime = gameDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    
    let statusPill = `<span class="px-2 py-0.5 bg-white/5 border border-white/10 rounded text-[9px] font-mono text-white/60 uppercase tracking-widest">${isFinal ? 'FINAL' : displayTime}</span>`;
    if (isLive) {
        statusPill = `<div class="flex items-center gap-2"><span class="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span><span class="text-[10px] font-mono text-red-400 font-bold tracking-widest uppercase">Live</span></div>`;
    }

    const scoreSize = (config.league.includes('nba') || config.league.includes('basketball')) ? 'text-xl' : 'text-2xl';

    const renderTeamRow = (t) => {
        const logo = t?.team?.logos?.[0]?.href;
        const name = t?.team?.shortDisplayName || t?.team?.displayName || 'TBA';
        const record = getRecord(t, config.league);
        const score = parseScoreLocal(t);
        const isWinner = t?.winner;
        
        return `
            <div class="flex justify-between items-center group/team">
                <div class="flex items-center gap-3">
                    ${logo ? `<img src="${logo}" class="w-7 h-7 object-contain drop-shadow-md">` : `<div class="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center text-[8px] font-bold text-white/50">${t?.team?.abbreviation || '?'}</div>`}
                    <div class="flex flex-col">
                        <span class="text-sm font-bold ${isWinner ? 'text-white' : 'text-white/80'}">${name}</span>
                        <span class="text-[10px] font-mono text-white/40">${record}</span>
                    </div>
                </div>
                <span class="${scoreSize} font-mono ${isWinner ? 'text-white font-bold' : 'text-white/50 font-medium'}">${score}</span>
            </div>
        `;
    };

    function parseScoreLocal(t) {
        if (state === 'pre' || t?.score == null) return '-';
        return safeScore(t.score);
    }

    const html = `
        <div class="glass-card p-5 flex flex-col justify-between h-48 ${isLive ? 'live-border' : ''}">
            <div class="flex justify-between items-start mb-3">
                <div class="flex items-center gap-2">
                    ${config.icon} <span class="text-sm font-semibold text-white/90 tracking-wide">${config.name}</span>
                    ${config.gender === 'W' ? '<span class="px-1 py-[1px] bg-fuchsia-500/20 text-fuchsia-300 rounded text-[8px] font-mono border border-fuchsia-500/30">W</span>' : ''}
                </div>
                ${statusPill}
            </div>
            
            <div class="flex flex-col gap-2.5 mb-auto">
                ${renderTeamRow(away)}
                ${renderTeamRow(home)}
            </div>
            
            <div class="flex justify-between items-center mt-3 pt-3 border-t border-white/5 text-[9px] font-mono uppercase tracking-widest text-white/40">
                <span class="truncate pr-2">${displayDate} <span class="text-white/20 mx-1">|</span> ${venue}</span>
                ${isLive && comp.status?.type?.shortDetail ? `<span class="text-cyan-400 font-bold shrink-0">${comp.status.type.shortDetail}</span>` : ''}
            </div>
        </div>
    `;

    return { weight, html };
}

// 3. Hybrid Fetch Engine
async function fetchFeedGroup(configArray, containerId) {
    const container = document.getElementById(containerId);
    try {
        const results = await Promise.all(configArray.map(async (config) => {
            if (isOffseason(config.league)) return createCupertinoCard(config, null);

            try {
                const resp = await fetch(config.url);
                if (!resp.ok) throw new Error('ESPN fail');
                const data = await resp.json();
                return createCupertinoCard(config, data);
            } catch (e) {
                return { weight: 5, html: '' }; 
            }
        }));

        const valid = results.filter(r => r.html !== '').sort((a, b) => a.weight - b.weight);
        container.innerHTML = valid.map(r => r.html).join('') || '<div class="col-span-full p-12 text-center text-sm font-mono text-white/40 border border-white/5 rounded-2xl border-dashed">No active telemetry</div>';
        
        document.getElementById('last-updated').innerHTML = `<span class="text-white/40">SYNCED: ${new Date().toLocaleTimeString()}</span>`;
    } catch (e) {
        container.innerHTML = '<div class="col-span-full p-12 text-center text-sm font-mono text-red-500/60 bg-red-500/5 rounded-2xl border border-red-500/20">Telemetry failure</div>';
    }
}

// 4. NCAA Bypass Engine
function checkNCAAWindow() {
    const container = document.getElementById('ncaa-container');
    const title = document.getElementById('ncaa-title');
    
    const now = new Date();
    const year = now.getFullYear();
    const activeStart = new Date(year, 2, 10); // March 10
    const activeEnd = new Date(year, 3, 15);   // April 15
    
    if (now < activeStart || now > activeEnd) {
        container.classList.add('opacity-40', 'grayscale-[80%]', 'pointer-events-none');
        if (!title.innerHTML.includes('OFFSEASON')) {
            title.innerHTML += ' <span class="text-[9px] font-mono text-white/40 ml-3 border border-white/10 px-1.5 py-0.5 rounded tracking-widest bg-white/5">OFFSEASON</span>';
        }
        return false;
    }
    return true;
}

async function fetchNCAATournament(gender, containerId) {
    const container = document.getElementById(containerId);
    try {
        const now = new Date();
        const d = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`;
        const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/${gender}-college-basketball/scoreboard?dates=${d}`;
        
        const resp = await fetch(url);
        const data = await resp.json();
        
        if (!data?.events || data.events.length === 0) {
            container.innerHTML = '<div class="p-6 text-center text-xs font-mono text-white/30 border border-white/5 rounded-xl border-dashed">No bracket activity today</div>';
            return;
        }
        
        let targetGames = data.events.sort((a, b) => {
            const sA = a.status?.type?.state; const sB = b.status?.type?.state;
            if (sA === 'in' && sB !== 'in') return -1;
            if (sA !== 'in' && sB === 'in') return 1;
            return new Date(a.date) - new Date(b.date);
        });

        container.innerHTML = targetGames.map(event => {
            const comp = event.competitions?.[0];
            if (!comp) return '';
            const home = comp.competitors?.find(c => c.homeAway === 'home');
            const away = comp.competitors?.find(c => c.homeAway === 'away');
            if (!home || !away) return '';

            const state = comp.status?.type?.state;
            const isLive = state === 'in';
            const isPre = state === 'pre';
            
            const time = new Date(comp.date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
            let statusPill = `<span class="text-[9px] font-mono text-white/50 tracking-widest uppercase">${isPre ? time : comp.status?.type?.shortDetail}</span>`;
            if (isLive) statusPill = `<span class="text-[9px] font-mono text-red-400 font-bold tracking-widest uppercase bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded animate-pulse">Live</span>`;

            const renderTeam = (t) => `
                <div class="flex items-center gap-3">
                    ${t.curatedRank?.current < 26 ? `<span class="text-[9px] text-white/80 font-mono bg-white/10 px-1.5 py-0.5 rounded border border-white/20">${t.curatedRank.current}</span>` : ''}
                    <span class="text-sm font-bold ${t.winner ? 'text-white' : 'text-white/70'}">${t.team?.shortDisplayName || 'TBA'}</span>
                </div>
                <span class="text-lg font-mono ${t.winner ? 'font-bold text-white' : 'font-medium text-white/50'}">${isPre ? '-' : (safeScore(t.score) || '-')}</span>
            `;

            return `
                <div class="glass-card p-4 flex flex-col gap-3 ${isLive ? 'live-border' : ''}">
                    <div class="flex justify-between items-center mb-1">
                        <span class="text-[10px] font-mono text-white/40 uppercase truncate max-w-[200px] tracking-wide">${event.shortName}</span>
                        ${statusPill}
                    </div>
                    <div class="flex flex-col gap-2 w-full">
                        <div class="flex justify-between items-center">${renderTeam(away)}</div>
                        <div class="flex justify-between items-center">${renderTeam(home)}</div>
                    </div>
                </div>
            `;
        }).join('');
    } catch (e) {
        container.innerHTML = '<div class="p-4 text-center text-xs font-mono text-red-500/60 border border-red-500/10 rounded-xl bg-red-500/5">Link failed</div>';
    }
}

// Boot Sequence
async function initializeSports() {
    await fetchAllStandings();
    fetchFeedGroup(proConfig, 'pro-feed');
    fetchFeedGroup(collegeConfig, 'college-feed');
    
    if (checkNCAAWindow()) {
        fetchNCAATournament('mens', 'ncaa-mens-feed');
        fetchNCAATournament('womens', 'ncaa-womens-feed');
    }
}

document.addEventListener("DOMContentLoaded", initializeSports);

setInterval(() => {
    fetchFeedGroup(proConfig, 'pro-feed');
    fetchFeedGroup(collegeConfig, 'college-feed');
    
    if (checkNCAAWindow()) {
        fetchNCAATournament('mens', 'ncaa-mens-feed');
        fetchNCAATournament('womens', 'ncaa-womens-feed');
    }
}, REFRESH_RATE_MS);

setInterval(fetchAllStandings, 3600000);
