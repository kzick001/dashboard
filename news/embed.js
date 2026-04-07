const fs = require('fs');
const lancedb = require('vectordb');
const { pipeline } = require('@xenova/transformers');

// Standard math is safer than tensor library exports.
function cosineSimilarity(a, b) {
  let dotProduct = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

(async () => {
  if (!fs.existsSync('categories.json') || !fs.existsSync('sieve_output.json')) {
    console.error("Missing prerequisite JSON files. Pipeline halted.");
    return;
  }

  const categories = JSON.parse(fs.readFileSync('categories.json', 'utf8'));
  const articles = JSON.parse(fs.readFileSync('sieve_output.json', 'utf8'));

  if (articles.length === 0) {
    console.log("No articles survived Phase 1. Halting Phase 2.");
    return;
  }

  console.log("Loading embedding model...");
  const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');

  console.log("Vectorizing seed categories...");
  const categoryVectors = [];
  for (const cat of categories) {
    const out = await extractor(cat.description, { pooling: 'mean', normalize: true });
    categoryVectors.push({
      title: cat.title,
      vector: Array.from(out.data)
    });
  }

  const finalData = [];
  const localRegex = /Minnesota|Twin Cities|Minneapolis|St\. Louis Park/i;

  console.log(`Processing ${articles.length} articles...`);
  for (const article of articles) {
    const out = await extractor(article.summary, { pooling: 'mean', normalize: true });
    const articleVector = Array.from(out.data);

    let bestMatch = null;
    let highestScore = -1;

    for (const cat of categoryVectors) {
      const score = cosineSimilarity(articleVector, cat.vector);
      if (score > highestScore) {
        highestScore = score;
        bestMatch = cat.title;
      }
    }

    if (highestScore < 0.75) continue;

    if (bestMatch === 'Local Infrastructure (MN Specific)' || bestMatch === 'Regional Civic Policy (MN Specific)') {
      if (!localRegex.test(article.summary)) {
        continue;
      }
    }

    finalData.push({
      headline: article.headline,
      summary: article.summary,
      link: article.link,
      category: bestMatch,
      vector: articleVector
    });
  }

  if (finalData.length === 0) {
    console.log("No articles survived Gate 2 and Gate 3.");
    return;
  }

  console.log(`Inserting ${finalData.length} articles into LanceDB...`);
  const db = await lancedb.connect('./data');
  const tables = await db.tableNames();

  if (tables.includes('news_feed')) {
    const table = await db.openTable('news_feed');
    await table.add(finalData);
  } else {
    await db.createTable('news_feed', finalData);
  }

  console.log("Phase 2 complete.");
})();
