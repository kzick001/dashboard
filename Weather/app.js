/**
 * ATMOS V1.1 - Logic Controller (Phase 3)
 * Architecture: Vanilla JS Module Pattern
 */

document.addEventListener('DOMContentLoaded', () => {

  // --- 1. CONFIGURATION & STATE ---
  const CONFIG = {
    lat: 44.9483,
    lon: -93.3666,
    endpoints: {
      telemetry: 'https://kzick-weather.askozicki.workers.dev/',
      alerts: `https://api.weather.gov/alerts/active?point=44.9483,-93.3666`,
      rainviewer: 'https://api.rainviewer.com/public/weather-maps.json'
    },
    dom: {
      grid: document.getElementById('dashboard-grid')
    }
  };

  const STATE = {
    weatherCode: 1000,
    isThunderstorm: false,
    radar: { layers: [], currentFrame: 0, intervalId: null, isPlaying: true, speed: 600 }
  };

  // --- 2. UTILITIES & ICONS ---
  const safeVal = (val) => val != null ? Math.round(val) : '--';
  
  const formatTime = (iso) => new Intl.DateTimeFormat('en-US', { hour: 'numeric', timeZone: 'America/Chicago' }).format(new Date(iso));
  
  const formatDay = (iso) => new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'America/Chicago' }).format(new Date(iso));

  const getIcon = (code) => {
    // Map WeatherCodes to simple inline SVGs
    const icons = {
      1000: `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>`, // Clear
      1001: `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"></path></svg>`, // Cloudy
      1100: `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 18v2M8 18v2M16 18v2" stroke="#60A5FA"></path></svg>`, // Rain
      1102: `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 10V3L4 14h7v7l9-11h-7z" stroke="#FBBF24"></path></svg>`, // Thunderstorm
      5000: `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 3v18m-9-9h18m-11.36-6.36l12.72 12.72M4.64 17.36l12.72-12.72"></path></svg>`, // Snow
    };
    return icons[code] || icons[1001]; 
  };

  const mapDesc = (code) => {
    const map = { 1000: 'Clear', 1001: 'Cloudy', 1100: 'Light Rain', 1101: 'Rain', 1102: 'Thunderstorms', 2000: 'Fog', 4000: 'Drizzle', 5000: 'Snow' };
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
        delay: L.Browser.mobile ? 200 : 0, // Delay on mobile to allow normal scrolling
        delayOnTouchOnly: true,
        onEnd: StorageEngine.saveLayout
      });
    }
  };

  // --- 4. NETWORK ENGINE ---
  const NetworkEngine = {
    fetch: async () => {
      const cache = localStorage.getItem('atmos_data');
      if (cache) HydrationEngine.render(JSON.parse(cache));

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
        localStorage.setItem('atmos_data', JSON.stringify(payload));
        HydrationEngine.render(payload);
      } catch (err) {
        console.error("Fetch Error:", err);
      }
    }
  };

  // --- 5. CHART ENGINE ---
  let currentChart = null;
  const ChartEngine = {
    render: (hourlyData) => {
      const ctx = document.getElementById('hourly-chart').getContext('2d');
      if (currentChart) currentChart.destroy(); // Prevent memory leaks on update

      // Extract next 24 hours
      const next24 = hourlyData.slice(0, 24);
      const labels = next24.map(h => formatTime(h.startTime));
      const temps = next24.map(h => Math.round(h.values.temperature));
      const dews = next24.map(h => Math.round(h.values.dewPoint));
      const precip = next24.map(h => h.values.precipitationProbability || 0);

      currentChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [
            {
              label: 'Temperature (°F)',
              data: temps,
              borderColor: '#60A5FA', // Tailwind blue-400
              backgroundColor: '#60A5FA',
              tension: 0.4,
              yAxisID: 'y',
              borderWidth: 2,
              pointRadius: 0
            },
            {
              label: 'Dew Point',
              data: dews,
              borderColor: '#94A3B8', // Tailwind slate-400
              borderDash: [5, 5],
              tension: 0.4,
              yAxisID: 'y',
              borderWidth: 2,
              pointRadius: 0
            },
            {
              type: 'bar',
              label: 'Precip Chance (%)',
              data: precip,
              backgroundColor: 'rgba(56, 189, 248, 0.2)', // Sky-400 translucent
              yAxisID: 'y1',
              barPercentage: 1.0,
              categoryPercentage: 1.0
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { display: false }, ticks: { color: '#94A3B8', maxTicksLimit: 8 } },
            y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94A3B8' } },
            y1: { position: 'right', min: 0, max: 100, grid: { display: false }, ticks: { display: false } }
          }
        }
      });
    }
  };

  // --- 6. RADAR ENGINE (RAINVIEWER) ---
  const RadarEngine = {
    init: async () => {
      const map = L.map('radar-map', {
        center: [CONFIG.lat, CONFIG.lon], zoom: 7, zoomControl: true,
        scrollWheelZoom: false, dragging: !L.Browser.mobile, tap: !L.Browser.mobile
      });

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(map);
      L.circleMarker([CONFIG.lat, CONFIG.lon], { color: '#38bdf8', radius: 6, weight: 2, fillOpacity: 0.5 }).addTo(map);

      try {
        // Fetch valid timestamps from RainViewer
        const res = await fetch(CONFIG.endpoints.rainviewer);
        const meta = await res.json();
        const timestamps = meta.radar.past; // Array of UNIX timestamps

        // Preload Tile Layers
        STATE.radar.layers = timestamps.map(ts => {
          return L.tileLayer(`https://tilecache.rainviewer.com/v2/radar/${ts}/256/{z}/{x}/{y}/2/1_1.png`, {
            opacity: 0, transparent: true, zIndex: 400
          }).addTo(map);
        });

        RadarEngine.startLoop(timestamps);
        RadarEngine.bindControls();

      } catch (e) {
        console.error("Radar Init Failed", e);
      }
    },
    startLoop: (timestamps) => {
      const timeLabel = document.getElementById('radar-time-label');
      
      const tick = () => {
        STATE.radar.layers[STATE.radar.currentFrame].setOpacity(0);
        STATE.radar.currentFrame = (STATE.radar.currentFrame + 1) % STATE.radar.layers.length;
        STATE.radar.layers[STATE.radar.currentFrame].setOpacity(0.7);
        
        // Update UI Time Label
        const date = new Date(timestamps[STATE.radar.currentFrame] * 1000);
        timeLabel.innerText = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(date);
      };

      if(STATE.radar.intervalId) clearInterval(STATE.radar.intervalId);
      STATE.radar.intervalId = setInterval(tick, STATE.radar.speed);
    },
    bindControls: () => {
      const playBtn = document.getElementById('radar-play-btn');
      const speedBtn = document.getElementById('radar-speed-btn');

      playBtn.addEventListener('click', () => {
        STATE.radar.isPlaying = !STATE.radar.isPlaying;
        if (STATE.radar.isPlaying) {
          playBtn.innerHTML = `<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd"></path></svg><span class="text-xs font-bold tracking-widest uppercase">Pause</span>`;
          RadarEngine.startLoop(STATE.radar.layers.map(() => 0)); // Re-start loop
        } else {
          playBtn.innerHTML = `<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd"></path></svg><span class="text-xs font-bold tracking-widest uppercase">Play</span>`;
          clearInterval(STATE.radar.intervalId);
        }
      });

      speedBtn.addEventListener('click', () => {
        STATE.radar.speed = STATE.radar.speed === 600 ? 300 : 600;
        speedBtn.innerText = STATE.radar.speed === 600 ? '1x Speed' : '2x Speed';
        if(STATE.radar.isPlaying) RadarEngine.startLoop(STATE.radar.layers.map(() => 0));
      });
    }
  };

  // --- 7. DOM HYDRATION ENGINE ---
  const HydrationEngine = {
    render: (data) => {
      if (!data || !data.telemetry) return;
      const t = data.telemetry.timelines;
      
      const current = t.find(x => x.timestep === 'current')?.intervals[0]?.values;
      const hourly = t.find(x => x.timestep === '1h')?.intervals;
      const daily = t.find(x => x.timestep === '1d')?.intervals;

      if (!current || !daily) return;

      // Global State Updates
      STATE.weatherCode = current.weatherCode;
      STATE.isThunderstorm = current.weatherCode >= 1101 && current.precipitationIntensity > 0.1;

      // Hydrate Hero
      const dom = (id) => document.getElementById(id);
      dom('weather-desc').innerText = mapDesc(current.weatherCode);
      dom('hero-icon').innerHTML = getIcon(current.weatherCode);
      dom('current-temp').innerHTML = `${safeVal(current.temperature)}&deg;`;
      dom('temp-high').innerHTML = `H: ${safeVal(daily[0].values.temperatureMax)}&deg;`;
      dom('temp-low').innerHTML = `L: ${safeVal(daily[0].values.temperatureMin)}&deg;`;
      dom('current-feels').innerText = safeVal(current.temperatureApparent);
      
      // Hydrate Hero Details
      dom('current-wind').innerText = `${safeVal(current.windSpeed)} mph`;
      dom('current-humidity').innerText = `${safeVal(current.humidity)}%`;
      dom('current-dew').innerHTML = `${safeVal(current.dewPoint)}&deg;`;
      dom('current-pressure').innerText = current.pressureSurfaceLevel ? `${current.pressureSurfaceLevel} inHg` : '--';

      // Hydrate Alerts
      const alertMod = dom('module-alerts');
      if (data.alerts && data.alerts.length > 0) {
        alertMod.classList.remove('hidden');
        dom('alert-title').innerHTML = `<svg class="w-6 h-6 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg> ACTIVE ALERTS (${data.alerts.length})`;
        dom('alert-description').innerHTML = data.alerts.map(a => `<div class="mb-3"><strong class="text-white block">${a.properties.event}</strong>${a.properties.description || a.properties.headline}</div>`).join('');
      } else {
        alertMod.classList.add('hidden');
      }

      // Hydrate Chart
      if (hourly) ChartEngine.render(hourly);

      // Hydrate Extended Forecast
      if (daily) {
        dom('extended-container').innerHTML = daily.slice(1, 8).map(day => {
          const v = day.values;
          const isPrecip = v.precipitationProbability > 20;
          return `
            <div class="flex items-center justify-between py-2 border-b border-slate-700/50 last:border-0">
              <span class="w-12 font-medium text-slate-300">${formatDay(day.startTime)}</span>
              <div class="w-8 h-8 text-slate-400">${getIcon(v.weatherCode)}</div>
              <span class="w-12 text-xs font-bold text-blue-400 text-center">${isPrecip ? Math.round(v.precipitationProbability)+'%' : ''}</span>
              <div class="flex items-center gap-3 w-24 justify-end font-medium">
                <span class="text-slate-400">${Math.round(v.temperatureMin)}&deg;</span>
                <div class="w-16 h-1.5 rounded-full bg-slate-700 relative overflow-hidden">
                  <div class="absolute inset-y-0 bg-gradient-to-r from-blue-500 to-orange-400 rounded-full w-full"></div>
                </div>
                <span class="text-slate-100">${Math.round(v.temperatureMax)}&deg;</span>
              </div>
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

      for (let i = 0; i < 300; i++) particles.push({ x: Math.random() * 2000, y: Math.random() * 2000, l: Math.random() * 25 + 10, s: Math.random() * 20 + 15 });

      const animate = () => {
        ctx.clearRect(0, 0, cw, ch);
        if (STATE.weatherCode >= 1100 && STATE.weatherCode <= 1102) {
          ctx.strokeStyle = 'rgba(147, 197, 253, 0.2)'; ctx.lineWidth = 2; ctx.beginPath();
          for (let p of particles) {
            ctx.moveTo(p.x, p.y); ctx.lineTo(p.x, p.y + p.l);
            p.y += p.s; if (p.y > ch) p.y = -p.l;
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
  NetworkEngine.fetch();

  setInterval(NetworkEngine.fetch, 300000); // 5-minute auto-refresh

});
