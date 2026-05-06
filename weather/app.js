<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Atmos</title>
  
  <meta name="theme-color" id="meta-theme" content="#0f172a">

  <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>⚡</text></svg>">

  <script src="https://cdn.tailwindcss.com"></script>
  
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>

  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>

  <script src="https://cdn.jsdelivr.net/npm/sortablejs@latest/Sortable.min.js"></script>

  <link rel="stylesheet" href="styles.css">

  <style>
    /* Forces native crossfading when JS updates Leaflet layer opacities */
    .leaflet-layer {
      transition: opacity 0.6s ease-in-out;
    }
  </style>
</head>
<body class="p-4 md:p-6 min-h-screen flex flex-col items-center bg-slate-900 text-slate-50 antialiased overflow-x-hidden relative">

  <canvas id="weather-canvas"></canvas>

  <header class="w-full max-w-6xl flex justify-between items-center mb-6 relative z-10 glass-panel px-5 py-3 sm:px-6 sm:py-4">
    <div class="flex items-center gap-2 sm:gap-3">
      <svg class="w-5 h-5 sm:w-6 sm:h-6 text-yellow-400" fill="currentColor" viewBox="0 0 20 20"><path d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z"></path></svg>
      <h1 class="text-lg sm:text-xl font-bold tracking-widest uppercase">Atmos</h1>
    </div>
    <div class="flex flex-col sm:flex-row items-end sm:items-center gap-1 sm:gap-4 text-[10px] sm:text-xs font-bold text-slate-400 tracking-widest uppercase text-right">
      <span id="live-clock" class="hidden sm:block">--:--</span>
      <span id="last-updated-text" class="text-blue-300">Updated: Just now</span>
      <button id="manual-refresh-btn" class="hover:text-white transition-colors cursor-pointer focus:outline-none p-2 -mr-2 sm:-my-2" aria-label="Refresh Data">
        <svg class="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
      </button>
    </div>
  </header>

  <main id="dashboard-grid" class="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-3 gap-6 relative z-10 flex-grow">
    
    <section data-id="module-alerts" id="module-alerts" class="col-span-1 lg:col-span-3 hidden cursor-pointer">
      <details class="glass-panel group transition-all w-full">
        <summary class="p-4 font-bold text-red-400 list-none flex justify-between items-center outline-none">
          <span id="alert-title" class="flex items-center gap-3">
            <svg class="w-6 h-6 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
            Loading Alerts...
          </span>
          <span class="text-sm text-slate-400 group-open:rotate-180 transition-transform duration-300">▼</span>
        </summary>
        <div id="alert-description" class="p-4 pt-0 text-sm text-slate-300 border-t border-red-500/30 mt-2 leading-relaxed whitespace-pre-wrap break-words"></div>
      </details>
    </section>

    <section data-id="module-hero" id="module-hero" class="glass-panel p-6 col-span-1 min-h-[350px] flex flex-col justify-between">
      <div class="grid grid-cols-2 gap-4 h-full">
        <div class="flex flex-col justify-between">
          <div>
            <h2 class="text-[10px] font-bold text-slate-400 tracking-widest uppercase">St. Louis Park, MN</h2>
            <div class="mt-2 inline-block px-2 py-1 rounded bg-blue-500/20 border border-blue-500/30 text-blue-300 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap" id="weather-desc">Initializing</div>
          </div>
          <div class="mt-4">
            <div class="text-7xl xl:text-8xl font-bold tracking-tighter" id="current-temp">--&deg;</div>
            <div class="flex gap-3 text-sm font-bold text-slate-400 mt-2">
              <span id="temp-high" class="text-slate-200">H: --&deg;</span>
              <span id="temp-low">L: --&deg;</span>
            </div>
          </div>
        </div>

        <div class="flex flex-col justify-between items-end">
          <div id="hero-icon" class="w-24 h-24 text-slate-100 drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]">
            </div>
          
          <div class="grid grid-cols-2 gap-2 w-full mt-4">
            <div class="bg-slate-800/50 p-2 rounded-lg border border-slate-700/50 flex flex-col justify-center">
              <p class="text-[9px] text-slate-400 uppercase font-bold tracking-wider">Wind</p>
              <p class="text-sm font-bold mt-0.5" id="current-wind">--</p>
            </div>
            <div class="bg-slate-800/50 p-2 rounded-lg border border-slate-700/50 flex flex-col justify-center">
              <p class="text-[9px] text-slate-400 uppercase font-bold tracking-wider">Humidity</p>
              <p class="text-sm font-bold mt-0.5" id="current-humidity">--</p>
            </div>
            <div class="bg-slate-800/50 p-2 rounded-lg border border-slate-700/50 flex flex-col justify-center">
              <p class="text-[9px] text-slate-400 uppercase font-bold tracking-wider">Pressure</p>
              <p class="text-sm font-bold mt-0.5" id="current-pressure">--</p>
            </div>
            <div class="bg-slate-800/50 p-2 rounded-lg border border-slate-700/50 flex flex-col justify-center">
              <p class="text-[9px] text-slate-400 uppercase font-bold tracking-wider">Dew Pt</p>
              <p class="text-sm font-bold mt-0.5" id="current-dew">--</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section data-id="module-radar" id="module-radar" class="glass-panel col-span-1 lg:col-span-2 relative overflow-hidden flex flex-col p-1 min-h-[350px]">
      <div class="radar-controls absolute bottom-4 left-4 z-[1000] bg-slate-900/80 backdrop-blur-md px-4 py-2 rounded-full border border-slate-700 flex items-center gap-4 shadow-lg shadow-black/50">
        <button id="radar-play-btn" class="text-slate-200 hover:text-white focus:outline-none flex items-center gap-2">
          <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd"></path></svg>
          <span class="text-xs font-bold tracking-widest uppercase">Pause</span>
        </button>
        <div class="w-px h-4 bg-slate-600"></div>
        <button id="radar-speed-btn" class="text-xs font-bold tracking-widest uppercase text-slate-400 hover:text-white transition-colors focus:outline-none">
          1x Speed
        </button>
        <span id="radar-time-label" class="text-xs font-mono text-blue-300 ml-2">--:--</span>
      </div>
      <div id="radar-map" class="flex-grow rounded-[14px] bg-slate-800"></div>
    </section>

    <section data-id="module-hourly" id="module-hourly" class="glass-panel p-6 col-span-1 lg:col-span-3 min-h-[300px] flex flex-col">
      <h2 class="text-xs font-bold tracking-widest text-slate-400 mb-4 uppercase">Hourly Trends</h2>
      <div class="relative flex-grow w-full h-full">
        <canvas id="hourly-chart"></canvas>
      </div>
    </section>

    <section data-id="module-extended" id="module-extended" class="glass-panel p-6 col-span-1 lg:col-span-3">
      <h2 class="text-xs font-bold tracking-widest text-slate-400 mb-6 uppercase">5-Day Outlook</h2>
      <div id="extended-container" class="flex gap-4 overflow-x-auto no-scrollbar pb-2">
        </div>
    </section>

  </main>

  <footer class="w-full max-w-6xl mt-8 text-center text-[10px] font-bold tracking-widest uppercase text-slate-500 relative z-10 pb-4">
    <p>Data provided by <a href="https://www.weather.gov/" class="text-slate-400 hover:text-white" target="_blank">NWS</a> &middot; Telemetry by Cloudflare &middot; Radar by IEM</p>
  </footer>

  <script src="app.js" defer></script>
</body>
</html>
