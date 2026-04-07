const express = require('express');
const lancedb = require('vectordb');

const app = express();
const PORT = 3000;

app.get('/api/news', async (req, res) => {
  try {
    const db = await lancedb.connect('./data');
    const tables = await db.tableNames();
    
    if (!tables.includes('news_feed')) {
      return res.json([]);
    }
    
    const table = await db.openTable('news_feed');
    // Fetch recent articles without executing a vector similarity search
    const results = await table.search().limit(1000).execute();
    
    res.json(results);
  } catch (err) {
    console.error("Database read failed:", err.message);
    res.status(500).json({ error: "Feed offline" });
  }
});

app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>SOVEREIGN FEED</title>
      <style>
        * { box-sizing: border-box; }
        body { background: #fff; color: #000; font-family: 'Courier New', Courier, monospace; margin: 0; padding: 2rem; line-height: 1.4; }
        h1 { font-size: 3rem; text-transform: uppercase; border-bottom: 4px solid #000; padding-bottom: 0.5rem; }
        #feed { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 2rem; margin-top: 2rem; }
        .card { border: 3px solid #000; padding: 1.5rem; background: #fff; box-shadow: 6px 6px 0 #000; display: flex; flex-direction: column; }
        .tag { display: inline-block; background: #000; color: #fff; padding: 0.2rem 0.5rem; font-weight: bold; font-size: 0.8rem; text-transform: uppercase; margin-bottom: 1rem; align-self: flex-start; }
        .headline { font-size: 1.2rem; font-weight: bold; margin: 0 0 1rem 0; text-transform: uppercase; }
        .summary { font-size: 0.95rem; flex-grow: 1; }
        .link { display: inline-block; margin-top: 1.5rem; padding: 0.5rem 1rem; border: 2px solid #000; text-decoration: none; color: #000; font-weight: bold; text-align: center; text-transform: uppercase; transition: all 0.1s; }
        .link:hover { background: #000; color: #fff; }
      </style>
    </head>
    <body>
      <h1>Sovereign Feed</h1>
      <div id="feed">Establishing link...</div>
      <script>
        async function loadFeed() {
          const feed = document.getElementById('feed');
          try {
            const res = await fetch('/api/news');
            const data = await res.json();
            
            if (data.length === 0) {
              feed.innerHTML = '<p>No signal detected. Run ingestion pipeline.</p>';
              return;
            }

            // Group by sorting categories alphabetically
            data.sort((a, b) => a.category.localeCompare(b.category));

            feed.innerHTML = data.map(article => \`
              <div class="card">
                <span class="tag">\${article.category}</span>
                <h2 class="headline">\${article.headline}</h2>
                <p class="summary">\${article.summary}</p>
                <a href="\${article.link}" target="_blank" class="link">Read Data</a>
              </div>
            \`).join('');
          } catch (e) {
            feed.innerHTML = '<p>Connection severed.</p>';
          }
        }
        loadFeed();
      </script>
    </body>
    </html>
  `);
});

app.listen(PORT, () => {
  console.log(\`Sovereign Feed active on http://localhost:\${PORT}\`);
});
