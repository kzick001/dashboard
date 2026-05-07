document.addEventListener('DOMContentLoaded', () => {

  // --- 1. CONFIG & SYSTEM ---
  const CONFIG = {
    coords: { lat: 44.9483, lon: -93.3666 },
    endpoints: {
      telemetry: 'https://kzick-weather.askozicki.workers.dev/',
      alerts: `https://api.weather.gov/alerts/active?point=44.9483,-93.3666`
    },
    cacheThreshold: 5 * 60 * 1000 // 5 minutes
  };

  const STATE = { data: null, map: null, radarInterval: null };

  // Tactile Haptic Engine
  const triggerHaptic = (type = 'light') => {
    if (!navigator.vibrate) return;
    if (type === 'light') navigator.vibrate([30]);
    if (type === 'heavy') navigator.vibrate([60]);
  };

  // --- 2. CACHE & FETCH ENGINE ---
  const fetchData = async () => {
    const cached = localStorage.getItem('atmos_cache');
    const cacheTime = localStorage.getItem('atmos_cache_time');
    const now = Date.now();

    if (cached && cacheTime && (now - parseInt(cacheTime) < CONFIG.cacheThreshold)) {
      document.getElementById('ui-freshness').innerText = 'Synced (Cached)';
      STATE.data = JSON.parse(cached);
      hydrateApp(STATE.data);
      return;
    }

    try {
      document.getElementById('ui-freshness').innerText = 'Fetching...';
      const [telRes, alRes] = await Promise.all([
        fetch(CONFIG.endpoints.telemetry),
        fetch(CONFIG.endpoints.alerts).catch(() => ({ ok: false }))
      ]);

      if (!telRes.ok) throw new Error('Telemetry Error');
      const telData = await telRes.json();
      let alertData = { features: [] };
      if (alRes.ok) { try { alertData = await alRes.json(); } catch(e){} }

      // Validate core data prevents "poisoned cache" bricking
      const hasCurrent = telData.data?.timelines?.find(x => x.timestep === 'current');
      if (!hasCurrent) throw new Error('Malformed Payload');

      const payload = {
        telemetry: telData.data,
        airnow: telData.airnow || { primaryAQI: 0, forecast: [] },
        alerts: alertData.features || []
      };

      localStorage.setItem('atmos_cache', JSON.stringify(payload));
      localStorage.setItem('atmos_cache_time', now.toString());
      
      STATE.data = payload;
      document.getElementById('ui-freshness').innerText = 'Synced Just Now';
      hydrateApp(payload);
    } catch (e) {
      console.error(e);
      document.getElementById('ui-freshness').innerText = 'Offline';
      if (cached) hydrateApp(JSON.parse(cached));
    }
  };

  // --- 3. DOM HYDRATION ---
  const hydrateApp = (data) => {
    const timelines = data.telemetry.timelines;
    const current = timelines.find(t => t.timestep === 'current').intervals[0].values;
    const hourly = timelines.find(t => t.timestep === '1h').intervals;
    const daily = timelines.find(t => t.timestep === '1d').intervals;

    // Safe value fallback to prevent NaN injections
    const safeVal = (val) => val != null ? Math.round(val) : '--';

    // A. Hero UI
    document.getElementById('ui-temp').innerHTML = `${safeVal(current.temperature)}&deg;`;
    document.getElementById('ui-high').innerHTML = `H: ${safeVal(daily[0].values.temperatureMax)}&deg;`;
    document.getElementById('ui-low').innerHTML = `L: ${safeVal(daily[0].values.temperatureMin)}&deg;`;
    document.getElementById('ui-wind').innerText = current.windSpeed != null ? `${safeVal(current.windSpeed)} mph` : '--';
    document.getElementById('ui-humidity').innerText = current.humidity != null ? `${safeVal(current.humidity)}%` : '--';
    document.getElementById('ui-pressure').innerText = current.pressureSurfaceLevel != null ? `${Math.round(current.pressureSurfaceLevel)} inHg` : '--';
    document.getElementById('ui-dew').innerHTML = current.dewPoint != null ? `${safeVal(current.dewPoint)}&deg;` : '--';
    
    // Generic SVG placeholder for weather icon matching spec styling
    document.getElementById('ui-icon').innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="w-full h-full"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>`;

    // B. AQI UI
    const aqi = data.airnow;
    document.getElementById('ui-aqi-val').innerText = aqi.primaryAQI;
    document.getElementById('ui-aqi-cat').innerText = aqi.category || 'Unknown';
    document.getElementById('ui-aqi-area').innerText = aqi.reportingArea || 'St. Louis Park';
    
    let primaryPol = '--';
    if(aqi.pollutants) primaryPol = Object.keys(aqi.pollutants)[0] || '--';
    document.getElementById('ui-aqi-pollutant').innerText = primaryPol;

    const gauge = document.getElementById('aqi-gauge');
    const aqiPercent = Math.min(aqi.primaryAQI / 300, 1);
    gauge.style.strokeDashoffset = 283 - (283 * aqiPercent);
    // EPA Colors
    let aqiColor = '#22c55e'; // Green
    if (aqi.primaryAQI > 50) aqiColor = '#eab308'; // Yellow
    if (aqi.primaryAQI > 100) aqiColor = '#f97316'; // Orange
    if (aqi.primaryAQI > 150) aqiColor = '#ef4444'; // Red
    gauge.style.stroke = aqiColor;

    // C. NWS Alerts
    if (data.alerts.length > 0) {
      document.getElementById('alerts-wrapper').classList.remove('hidden');
      document.getElementById('alerts-content').innerHTML = data.alerts.map(a => `<div class="mb-2"><strong class="text-white">${a.properties.event}</strong>: ${a.properties.headline}</div>`).join('');
    }

    // D. Doom Index Calculation
    let doomScore = 0;
    doomScore += (current.windSpeed > 15 ? 20 : 0);
    doomScore += (current.temperature < 10 || current.temperature > 90 ? 30 : 0);
    doomScore += (hourly[0].values.precipitationProbability > 50 ? 20 : 0);
    doomScore += (data.alerts.length > 0 ? 30 : 0);
    doomScore = Math.min(doomScore, 100);

    document.getElementById('doom-val').innerText = doomScore;
    document.getElementById('doom-gauge').style.strokeDasharray = `${doomScore}, 100`;
    
    const radarMod = document.getElementById('radar-module');
    if (doomScore > 70 || data.alerts.length > 0) {
      document.getElementById('doom-status').innerText = 'Elevated Risk';
      document.getElementById('doom-status').classList.add('text-red-500');
      radarMod.classList.add('radar-pulse'); 
    } else {
      document.getElementById('doom-status').innerText = 'Nominal';
    }

    // E. 24-Hour Chart
    initChart(hourly.slice(0, 24));

    // F. 5-Day Outlook
    initOutlook(daily.slice(1, 6), aqi.forecast);

    // G. Radar
    if (!STATE.map) initMap(data.alerts);
  };

  // --- 4. CHART.JS ENGINE ---
  let chartInstance = null;
  const initChart = (hourly) => {
    const ctx = document.getElementById('hourly-chart').getContext('2d');
    if (chartInstance) chartInstance.destroy();

    const labels = hourly.map(h => new Intl.DateTimeFormat('en-US', {hour:'numeric'}).format(new Date(h.startTime)));
    const temps = hourly.map(h => h.values.temperature);
    const precips = hourly.map(h => Math.max(h.values.precipitationProbability || 0, 1));

    chartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Temp', data: temps, borderColor: '#ef4444', 
            tension: 0.4, yAxisID: 'y', borderWidth: 3, pointRadius: 0
          },
          {
            label: 'Precip', data: precips, borderColor: 'rgba(6, 182, 212, 0)',
            backgroundColor: 'rgba(6, 182, 212, 0.2)', fill: true,
            tension: 0.4, yAxisID: 'y1', pointRadius: 0
          }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { display: false },
          y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } },
          y1: { position: 'right', min: 0, max: 100, display: false }
        }
      }
    });
  };

  // --- 5. 5-DAY OUTLOOK ---
  const initOutlook = (daily, aqiForecast) => {
    const allMins = daily.map(d => d.values.temperatureMin);
    const allMaxs = daily.map(d => d.values.temperatureMax);
    const globalMin = Math.min(...allMins);
    const globalMax = Math.max(...allMaxs);
    const range = globalMax - globalMin;

    document.getElementById('outlook-container').innerHTML = daily.map((day, idx) => {
      const v = day.values;
      const date = new Date(day.startTime);
      const dayName = new Intl.DateTimeFormat('en-US', {weekday:'short'}).format(date);
      
      let aqiBadge = '';
      if (aqiForecast && aqiForecast[idx] && aqiForecast[idx].aqi !== -1) {
        const faqi = aqiForecast[idx].aqi;
        if (faqi > 50) {
          let bg = 'bg-yellow-500';
          if (faqi > 100) bg = 'bg-orange-500';
          if (faqi > 150) bg = 'bg-red-500';
          aqiBadge = `<span class="w-2 h-2 rounded-full ${bg} absolute top-2 right-2"></span>`;
        }
      }

      const leftPct = ((v.temperatureMin - globalMin) / range) * 100;
      const widthPct = ((v.temperatureMax - v.temperatureMin) / range) * 100;

      return `
        <div class="bg-slate-800/40 p-3 rounded-2xl flex flex-col items-center relative border border-slate-700/50">
          ${aqiBadge}
          <span class="text-xs font-bold uppercase text-slate-300">${dayName}</span>
          <div class="text-slate-400 my-2">☁️</div> 
          <div class="flex gap-2 text-sm font-bold w-full justify-center mb-2">
            <span class="text-white">${Math.round(v.temperatureMax)}&deg;</span>
            <span class="text-slate-500">${Math.round(v.temperatureMin)}&deg;</span>
          </div>
          <div class="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden relative">
            <div class="absolute h-full rounded-full bg-gradient-to-r from-cyan-500 to-red-500" 
                 style="left: ${leftPct}%; width: ${widthPct}%;"></div>
          </div>
        </div>
      `;
    }).join('');
  };

  // --- 6. MAPLIBRE WEBGL RADAR ---
  const initMap = (alerts) => {
    STATE.map = new maplibregl.Map({
      container: 'map',
      style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
      center: [CONFIG.coords.lon, CONFIG.coords.lat],
      zoom: 7,
      pitch: 45,
      interactive: false
    });

    STATE.map.on('load', () => {
      // Add NWS Alerts GeoJSON (Rendered first so radar overlays it properly or vice versa based on design)
      if (alerts.length > 0) {
        STATE.map.addSource('alerts', {
          type: 'geojson', data: { type: 'FeatureCollection', features: alerts }
        });
        STATE.map.addLayer({
          id: 'alerts-fill', type: 'fill', source: 'alerts',
          paint: { 'fill-color': '#ef4444', 'fill-opacity': 0.2 }
        });
        STATE.map.addLayer({
          id: 'alerts-line', type: 'line', source: 'alerts',
          paint: { 'line-color': '#ef4444', 'line-width': 2 }
        });
      }

      // Preload all 10 Radar Layers into GPU memory to prevent flashing
      const offsets = [50, 45, 40, 35, 30, 25, 20, 15, 10, 5];
      offsets.forEach((o, i) => {
        STATE.map.addSource(`iem-${o}`, {
          type: 'raster',
          tiles: [`https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/nexrad-n0q-900913-m${o}m/{z}/{x}/{y}.png`],
          tileSize: 256
        });
        STATE.map.addLayer({
          id: `radar-${o}`, type: 'raster', source: `iem-${o}`,
          paint: { 'raster-opacity': i === 0 ? 0.6 : 0, 'raster-fade-duration': 0 } 
        }, alerts.length > 0 ? 'alerts-fill' : undefined);
      });

      // Radar Loop Logic via Opacity Toggling
      let frame = 0;
      const playBtn = document.getElementById('btn-play');
      const timeLbl = document.getElementById('radar-time');

      const tick = () => {
        STATE.map.setPaintProperty(`radar-${offsets[frame]}`, 'raster-opacity', 0);
        frame = (frame + 1) % offsets.length;
        STATE.map.setPaintProperty(`radar-${offsets[frame]}`, 'raster-opacity', 0.6);
        timeLbl.innerText = `-${offsets[frame]} mins`;
      };

      STATE.radarInterval = setInterval(tick, 600);

      playBtn.addEventListener('click', () => {
        triggerHaptic();
        if (STATE.radarInterval) {
          clearInterval(STATE.radarInterval);
          STATE.radarInterval = null;
          playBtn.innerText = '⏸';
        } else {
          STATE.radarInterval = setInterval(tick, 600);
          playBtn.innerText = '▶';
        }
      });
    });
  };

  // --- 7. SORTABLE & HAPTICS HOOKUP ---
  const grid = document.getElementById('dashboard-grid');
  new Sortable(grid, {
    animation: 250,
    ghostClass: 'sortable-ghost',
    dragClass: 'sortable-drag',
    filter: 'button, summary, .haptic-trigger', // Prevent drag trapping on interactive UI
    preventOnFilter: false,
    delay: 150, 
    delayOnTouchOnly: true,
    onStart: () => triggerHaptic('light'),
    onEnd: () => {
      triggerHaptic('heavy');
    }
  });

  // Attach haptics to details accordion
  document.getElementById('alerts-details').addEventListener('toggle', () => triggerHaptic('light'));

  // Init fetch
  fetchData();
});
