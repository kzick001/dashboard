/**
 * ATMOS V1.2 - Advanced Logic Controller (Final Polish)
 * Architecture: Vanilla JS Module Pattern
 */

document.addEventListener('DOMContentLoaded', () => {

  // --- 1. CONFIGURATION & STATE ---
  const CONFIG = {
    lat: 44.9483,
    lon: -93.3666,
    endpoints: {
      telemetry: 'https://kzick-weather.askozicki.workers.dev/',
      alerts: `https://api.weather.gov/alerts/active?point=44.9483,-93.3666`
    },
    dom: {
      grid: document.getElementById('dashboard-grid')
    }
  };

  const STATE = {
    weatherCode: 1000,
    isThunderstorm: false,
    radar: { layers: [], timestamps: [], currentFrame: 0, intervalId: null, isPlaying: true, speed: 800 },
    freshness: { timestamp: null, intervalId: null }
  };

  // --- 2. UTILITIES & ICONS ---
  const safeVal = (val) => val != null ? Math.round(val) : '--';
  
  const formatTime = (iso) => new Intl.DateTimeFormat('en-US', { hour: 'numeric', timeZone: 'America/Chicago' }).format(new Date(iso));
  const formatDay = (iso) => new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'America/Chicago' }).format(new Date(iso));
  const formatMonthDay = (iso) => new Intl.DateTimeFormat('en-US', { month: 'short', day: '2-digit', timeZone: 'America/Chicago' }).format(new Date(iso));

  const getIcon = (code) => {
    const sun = `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>`;
    const cloud = `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"></path></svg>`;
    const rain = `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 18v2M8 18v2M16 18v2" stroke="#60A5FA"></path></svg>`;
    const storm = `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 10V3L4 14h7v7l9-11h-7z" stroke="#FBBF24"></path></svg>`;
    const snow = `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 3v18m-9-9h18m-11.36-6.36l12.72 12.72M4.64 17.36l12.72-12.72"></path></svg>`;
    
    if (code === 1000 || code === 1100) return sun;
    if (code === 1001 || code === 1101 || code === 1102 || code === 2000 || code === 2100) return cloud;
    if (code >= 4000 && code < 5000) return rain;
    if (code >= 6000 && code < 7000) return rain;
    if (code >= 5000 && code < 6000) return snow;
    if (code >= 7000 && code < 8000) return snow;
    if (code === 8000) return storm;
    return cloud; 
  };

  const mapDesc = (code) => {
    const map = { 1000: 'Clear', 1100: 'Mostly Clear', 1101: 'Partly Cloudy', 1102: 'Mostly Cloudy', 1001: 'Cloudy', 2000: 'Fog', 2100: 'Light Fog', 4000: 'Drizzle', 4001: 'Rain', 4200: 'Light Rain', 4201: 'Heavy Rain', 5000: 'Snow', 5001: 'Flurries', 5100: 'Light Snow', 5101: 'Heavy Snow', 6000: 'Freezing Drizzle', 6001: 'Freezing Rain', 6200: 'Light Freezing Rain', 6201: 'Heavy Freezing Rain', 7000: 'Ice Pellets', 7101: 'Heavy Ice Pellets', 7102: 'Light Ice Pellets', 8000: 'Thunderstorms' };
    return map[code] || 'Active Conditions';
  };

  // --- 3. STORAGE & SORTABLE ENGINE ---
  const StorageEngine = {
    loadLayout: () => {
      const saved = JSON.parse(localStorage.getItem('atmos_layout'));
      if (!saved || saved.length === 0) return;
      saved.forEach(id => {
        const el = document.getElementById(id);
        if (el) CONFIG.dom.grid.appendChild(el);
      });
    },
    saveLayout: () => {
      const order = Array.from(CONFIG.dom.grid.children).map(el => el.getAttribute('data-id'));
      localStorage.setItem('atmos_layout', JSON.stringify(order));
    },
    initDragAndDrop: () => {
      new Sortable(CONFIG.dom.grid, {
        animation: 200,
        ghostClass: 'sortable-ghost',
        dragClass: 'sortable-drag',
        filter: 'button, details, summary, .leaflet-control, canvas, a', // Prevents UI interaction traps
        preventOnFilter: false,
        delay: L.Browser.mobile ? 200 : 0, 
        delayOnTouchOnly: true,
        onEnd: StorageEngine.saveLayout
      });
    }
  };

  // --- 4. NETWORK & FRESHNESS ENGINE ---
  const NetworkEngine = {
    fetch: async () => {
      const cache = localStorage.getItem('atmos_data');
      if (cache && !STATE.freshness.timestamp) HydrationEngine.render(JSON.parse(cache));

      // Update UI to show fetching state
      const refreshBtn = document.getElementById('manual-refresh-btn');
      refreshBtn.classList.add('animate-spin', 'text-blue-400');

      try {
        const [cfRes, nwsRes] = await Promise.all([
          fetch(CONFIG.endpoints.telemetry),
          fetch(CONFIG.endpoints.alerts).catch(() => ({ ok: false }))
        ]);
        
        if (!cfRes.ok) throw new Error('Telemetry API Failed');
        
        const cfData = await cfRes.json();
        let nwsData = { features: [] };
        if (nwsRes.ok) { try { nwsData = await nwsRes.json(); } catch(e){} }
        
        const payload = { telemetry: cfData.data, alerts: nwsData.features || [] };
        
        // Prevent "Poisoned Cache" scenario
        const hasValidData = payload.telemetry?.timelines?.find(x => x.timestep === 'current');
        if (!hasValidData) throw new Error('Malformed Telemetry Data Payload');
        
        localStorage.setItem('atmos_data', JSON.stringify(payload));
        
        HydrationEngine.render(payload);
        NetworkEngine.updateFreshness(true);

      } catch (err) {
        console.error("Fetch Error:", err);
        if (!cache) document.getElementById('weather-desc').innerText = 'Data offline. Retrying...';
      } finally {
        setTimeout(() => refreshBtn.classList.remove('animate-spin', 'text-blue-400'), 500);
      }
    },
    updateFreshness: (reset = false) => {
      if (reset) {
        STATE.freshness.timestamp = Date.now();
        if (STATE.freshness.intervalId) clearInterval(STATE.freshness.intervalId);
        STATE.freshness.intervalId = setInterval(() => NetworkEngine.updateFreshness(), 60000);
      }
      
      if (!STATE.freshness.timestamp) return;
      
      const diffMins = Math.floor((Date.now() - STATE.freshness.timestamp) / 60000);
      const textEl = document.getElementById('last-updated-text');
      
      if (diffMins === 0) textEl.innerText = "Updated: Just now";
      else textEl.innerText = `Updated: ${diffMins} min${diffMins > 1 ? 's' : ''} ago`;

      // Live Clock
      const clockEl = document.getElementById('live-clock');
      if (clockEl) clockEl.innerText = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date());
    }
  };

  // --- 5. CHART ENGINE ---
  let currentChart = null;
  const ChartEngine = {
    render: (hourlyData) => {
      const ctx = document.getElementById('hourly-chart').getContext('2d');
      if (currentChart) currentChart.destroy(); 

      const next24 = hourlyData.slice(0, 24);
      const labels = next24.map(h => formatTime(h.startTime));
      const temps = next24.map(h => Math.round(h.values.temperature));
      const dews = next24.map(h => Math.round(h.values.dewPoint));
      const precip = next24.map(h => h.values.precipitationProbability || 0);

      // Dynamic styling for the "Current Hour" dot
      const pointRadii = temps.map((_, i) => i === 0 ? 6 : 0);
      const pointBgColors = temps.map((_, i) => i === 0 ? '#ffffff' : 'transparent');
      const pointBorderColors = temps.map((_, i) => i === 0 ? '#60A5FA' : 'transparent');

      currentChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [
            {
              label: 'Temp (°F)', data: temps, borderColor: '#60A5FA', backgroundColor: '#60A5FA',
              pointRadius: pointRadii, pointBackgroundColor: pointBgColors, pointBorderColor: pointBorderColors, pointBorderWidth: 3,
              tension: 0.4, yAxisID: 'y', borderWidth: 2
            },
            {
              label: 'Dew Point', data: dews, borderColor: '#94A3B8', borderDash: [5, 5],
              pointRadius: 0, tension: 0.4, yAxisID: 'y', borderWidth: 2
            },
            {
              type: 'bar', label: 'Precip Chance (%)', data: precip, backgroundColor: 'rgba(56, 189, 248, 0.15)',
              yAxisID: 'y1', barPercentage: 1.0, categoryPercentage: 1.0
            }
          ]
        },
        options: {
          responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
          plugins: { 
            legend: { 
              display: true, 
              position: 'top',
              labels: { color: '#94A3B8', boxWidth: 12, usePointStyle: true, font: { weight: 'bold' } }
            } 
          },
          scales: {
            x: { grid: { display: false }, ticks: { color: '#94A3B8', maxTicksLimit: 8 } },
            y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94A3B8' } },
            y1: { position: 'right', min: 0, max: 100, grid: { display: false }, ticks: { display: false } }
          }
        }
      });
    }
  };

  // --- 6. RADAR ENGINE (IEM + SMOOTHING) ---
  const RadarEngine = {
    init: () => {
      const map = L.map('radar-map', {
        center: [CONFIG.lat, CONFIG.lon], zoom: 7, zoomControl: true,
        scrollWheelZoom: false, dragging: !L.Browser.mobile, tap: !L.Browser.mobile
      });

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(map);
      L.circleMarker([CONFIG.lat, CONFIG.lon], { color: '#38bdf8', radius: 6, weight: 2, fillOpacity: 0.5 }).addTo(map);

      // IEM 5-minute increments (last 50 mins)
      const offsets = ['50', '45', '40', '35', '30', '25', '20', '15', '10', '05'];
      STATE.radar.timestamps = offsets;
      
      STATE.radar.layers = offsets.map(offset => {
        return L.tileLayer(`https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/nexrad-n0q-900913-m${offset}m/{z}/{x}/{y}.png`, {
          opacity: 0, transparent: true, zIndex: 400
        }).addTo(map);
      });

      RadarEngine.startLoop();
      RadarEngine.bindControls();
    },
    startLoop: () => {
      const timeLabel = document.getElementById('radar-time-label');
      
      const tick = () => {
        // Fade out old layer
        STATE.radar.layers[STATE.radar.currentFrame].setOpacity(0);
        // Advance
        STATE.radar.currentFrame = (STATE.radar.currentFrame + 1) % STATE.radar.layers.length;
        // Fade in new layer (CSS handles the smoothing transition)
        STATE.radar.layers[STATE.radar.currentFrame].setOpacity(0.7);
        
        // Update Time UI
        const offsetStr = STATE.radar.timestamps[STATE.radar.currentFrame];
        timeLabel.innerText = `-${offsetStr} mins`;
      };

      if(STATE.radar.intervalId) clearInterval(STATE.radar.intervalId);
      // Run loop (slowed slightly to allow CSS opacity transition to complete)
      STATE.radar.intervalId = setInterval(tick, STATE.radar.speed);
    },
    bindControls: () => {
      const playBtn = document.getElementById('radar-play-btn');
      const speedBtn = document.getElementById('radar-speed-btn');

      playBtn.addEventListener('click', () => {
        STATE.radar.isPlaying = !STATE.radar.isPlaying;
        if (STATE.radar.isPlaying) {
          playBtn.innerHTML = `<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd"></path></svg><span class="text-xs font-bold tracking-widest uppercase">Pause</span>`;
          RadarEngine.startLoop(); 
        } else {
          playBtn.innerHTML = `<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd"></path></svg><span class="text-xs font-bold tracking-widest uppercase">Play</span>`;
          clearInterval(STATE.radar.intervalId);
        }
      });

      speedBtn.addEventListener('click', () => {
        STATE.radar.speed = STATE.radar.speed === 800 ? 400 : 800;
        speedBtn.innerText = STATE.radar.speed === 800 ? '1x Speed' : '2x Speed';
        if(STATE.radar.isPlaying) RadarEngine.startLoop();
      });
    }
  };

  // --- 7. DOM HYDRATION & THEME ENGINE ---
  const HydrationEngine = {
    updateTheme: (code) => {
      const metaTheme = document.getElementById('meta-theme');
      let hex = '#0f172a'; // Default dark slate
      if (code === 1000 || code === 1100) hex = '#0284c7'; // Clear: Sky-600
      else if (code === 1001 || code === 1101 || code === 1102) hex = '#334155'; // Cloudy: Slate-700
      else if (code >= 4000 && code < 5000) hex = '#1e293b'; // Rain: Slate-800
      else if (code >= 5000) hex = '#475569'; // Snow/Ice: Slate-600
      metaTheme.setAttribute('content', hex);
    },
    render: (data) => {
      if (!data || !data.telemetry) return;
      const t = data.telemetry.timelines;
      
      const current = t.find(x => x.timestep === 'current')?.intervals[0]?.values;
      const hourly = t.find(x => x.timestep === '1h')?.intervals;
      const daily = t.find(x => x.timestep === '1d')?.intervals;

      if (!current || !daily) return;

      STATE.weatherCode = current.weatherCode;
      STATE.isThunderstorm = current.weatherCode === 8000;
      
      HydrationEngine.updateTheme(STATE.weatherCode);

      // Hero Mapping
      const dom = (id) => document.getElementById(id);
      dom('weather-desc').innerText = mapDesc(current.weatherCode);
      dom('hero-icon').innerHTML = getIcon(current.weatherCode);
      dom('current-temp').innerHTML = `${safeVal(current.temperature)}&deg;`;
      dom('temp-high').innerHTML = `H: ${safeVal(daily[0].values.temperatureMax)}&deg;`;
      dom('temp-low').innerHTML = `L: ${safeVal(daily[0].values.temperatureMin)}&deg;`;
      
      dom('current-wind').innerText = `${safeVal(current.windSpeed)} mph`;
      dom('current-humidity').innerText = `${safeVal(current.humidity)}%`;
      dom('current-dew').innerHTML = `${safeVal(current.dewPoint)}&deg;`;
      dom('current-pressure').innerText = current.pressureSurfaceLevel ? `${current.pressureSurfaceLevel} inHg` : '--';

      // Alerts Mapping
      const alertMod = dom('module-alerts');
      if (data.alerts && data.alerts.length > 0) {
        alertMod.classList.remove('hidden');
        dom('alert-title').innerHTML = `<svg class="w-6 h-6 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg> ACTIVE ALERTS (${data.alerts.length})`;
        dom('alert-description').innerHTML = data.alerts.map(a => `<div class="mb-3"><strong class="text-white block">${a.properties.event}</strong>${a.properties.description || a.properties.headline}</div>`).join('');
      } else {
        alertMod.classList.add('hidden');
      }

      if (hourly) ChartEngine.render(hourly);

      // Extended Forecast (5-Day Horizontal)
      if (daily) {
        dom('extended-container').innerHTML = daily.slice(1, 6).map(day => {
          const v = day.values;
          const isPrecip = v.precipitationProbability > 20;
          return `
            <div class="flex flex-col items-center justify-between p-4 bg-slate-800/40 rounded-xl border border-slate-700/50 min-w-[85px] flex-1">
              <span class="font-bold text-slate-300 uppercase text-xs">${formatDay(day.startTime)}</span>
              <span class="text-[10px] text-slate-500 mb-2 whitespace-nowrap">${formatMonthDay(day.startTime)}</span>
              <div class="w-10 h-10 text-slate-400 mb-2">${getIcon(v.weatherCode)}</div>
              <div class="flex gap-2 font-bold text-sm">
                <span class="text-slate-100">${Math.round(v.temperatureMax)}&deg;</span>
                <span class="text-slate-500">${Math.round(v.temperatureMin)}&deg;</span>
              </div>
              <span class="text-[10px] font-bold text-blue-400 mt-2">${isPrecip ? Math.round(v.precipitationProbability)+'%' : '--'}</span>
            </div>
          `;
        }).join('');
      }
    }
  };

  // --- 8. MICRO-VIEW CANVAS BACKGROUND ---
  const CanvasEngine = {
    init: () => {
      const canvas = document.getElementById('weather-canvas');
      const ctx = canvas.getContext('2d');
      let particles = [], cw, ch;

      const resize = () => { cw = canvas.width = window.innerWidth; ch = canvas.height = window.innerHeight; };
      window.addEventListener('resize', resize);
      resize(); 

      for (let i = 0; i < 300; i++) particles.push({ x: Math.random() * cw, y: Math.random() * ch, l: Math.random() * 25 + 10, s: Math.random() * 20 + 15 });

      const animate = () => {
        ctx.clearRect(0, 0, cw, ch);
        if (STATE.weatherCode >= 4000) {
          // Tint particles white for snow/ice, blue for rain
          ctx.strokeStyle = (STATE.weatherCode >= 5000 && STATE.weatherCode < 6000) ? 'rgba(255, 255, 255, 0.5)' : 'rgba(147, 197, 253, 0.3)'; 
          ctx.lineWidth = 2; ctx.beginPath();
          for (let p of particles) {
            ctx.moveTo(p.x, p.y); ctx.lineTo(p.x, p.y + p.l);
            p.y += p.s; 
            if (p.y > ch) { 
              p.y = -p.l; 
              p.x = Math.random() * cw; // Device Rotation Fix
            }
          }
          ctx.stroke();
        }
        if (STATE.isThunderstorm && Math.random() > 0.985) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'; ctx.fillRect(0, 0, cw, ch);
        }
        requestAnimationFrame(animate);
      };
      animate();
    }
  };

  // --- BOOTSTRAP ---
  StorageEngine.loadLayout();
  StorageEngine.initDragAndDrop();
  CanvasEngine.init();
  RadarEngine.init();
  
  // Initial Fetch & Bind Manual Refresh
  NetworkEngine.fetch();
  document.getElementById('manual-refresh-btn').addEventListener('click', NetworkEngine.fetch);
  
  // Auto-fetch every 5 minutes
  setInterval(NetworkEngine.fetch, 300000); 

});
