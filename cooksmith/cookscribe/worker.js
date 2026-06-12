/**
 * Cookscribe — worker.js
 * Single-file Worker for the Cloudflare Dashboard.
 *
 * Bindings required (Worker Settings → Bindings):
 *   COOKSCRIBE_KV    — KV namespace
 * Secrets required:
 *   ANTHROPIC_API_KEY
 *   APP_SECRET       (shared key, pasted into Settings by the owner)
 */

/* ============================================================ CORS */

function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '';
  const allowed =
    origin === 'https://kzick.dev' ||
    /^http:\/\/localhost(:\d+)?$/.test(origin) ||
    /^http:\/\/127\.0\.0\.1(:\d+)?$/.test(origin);
  return {
    'Access-Control-Allow-Origin': allowed ? origin : 'https://kzick.dev',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Cookscribe-Key',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

/* ============================================================ helpers */

function json(request, data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(request) },
  });
}

function errorResponse(request, code, message, status) {
  return new Response(JSON.stringify({ error: true, code, message, status }), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(request) },
  });
}

function fail(code, message, status) {
  throw { code, message, status };
}

async function parseBody(request) {
  try {
    return await request.json();
  } catch {
    fail('VALIDATION_ERROR', 'Request body must be valid JSON.', 400);
  }
}

function requireString(obj, key, maxLen = 4000) {
  const v = obj && obj[key];
  if (typeof v !== 'string' || !v.trim()) fail('VALIDATION_ERROR', `'${key}' is required.`, 400);
  if (v.length > maxLen) fail('VALIDATION_ERROR', `'${key}' exceeds ${maxLen} chars.`, 400);
  return v.trim();
}

/* ============================================================ auth */

function requireKey(request, env) {
  const key = request.headers.get('X-Cookscribe-Key') || '';
  if (!env.APP_SECRET) fail('INTERNAL_ERROR', 'Server missing APP_SECRET.', 500);
  if (key !== env.APP_SECRET) fail('AUTH_INVALID', 'Invalid or missing app key.', 401);
}

/* ============================================================ JSON-LD extraction */

function asStringArray(val) {
  if (!val) return [];
  if (typeof val === 'string') return val.trim() ? [val.trim()] : [];
  if (Array.isArray(val)) {
    return val.flatMap((v) => {
      if (typeof v === 'string') return v.trim() ? [v.trim()] : [];
      if (v && typeof v === 'object' && typeof v.text === 'string') return v.text.trim() ? [v.text.trim()] : [];
      return [];
    });
  }
  return [];
}

function extractInstructions(val) {
  if (!val) return [];
  if (typeof val === 'string') return val.trim() ? [val.trim()] : [];
  if (Array.isArray(val)) {
    const out = [];
    for (const item of val) {
      if (typeof item === 'string') { if (item.trim()) out.push(item.trim()); continue; }
      if (!item || typeof item !== 'object') continue;
      const t = item['@type'];
      if (t === 'HowToSection' && Array.isArray(item.itemListElement)) {
        for (const sub of item.itemListElement) {
          const text = (sub && (sub.text || sub.name));
          if (typeof text === 'string' && text.trim()) out.push(text.trim());
        }
      } else {
        const text = item.text || item.name;
        if (typeof text === 'string' && text.trim()) out.push(text.trim());
      }
    }
    return out;
  }
  return [];
}

function extractImage(val) {
  if (!val) return null;
  if (typeof val === 'string') return val;
  if (Array.isArray(val)) {
    const first = val[0];
    if (typeof first === 'string') return first;
    if (first && typeof first.url === 'string') return first.url;
    return null;
  }
  if (typeof val === 'object' && typeof val.url === 'string') return val.url;
  return null;
}

function extractJsonLdRecipe(html) {
  const blocks = [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)];
  for (const m of blocks) {
    let data;
    try { data = JSON.parse(m[1].trim()); } catch { continue; }
    const nodes = [];
    const push = (d) => {
      if (!d) return;
      if (Array.isArray(d)) d.forEach(push);
      else { nodes.push(d); if (d['@graph']) push(d['@graph']); }
    };
    push(data);
    const isRecipe = (t) => t && (Array.isArray(t) ? t.includes('Recipe') : t === 'Recipe');
    const node = nodes.find((n) => isRecipe(n['@type']));
    if (!node) continue;
    return {
      name: typeof node.name === 'string' ? node.name : 'Untitled recipe',
      ingredients: asStringArray(node.recipeIngredient),
      steps: extractInstructions(node.recipeInstructions),
      servings: node.recipeYield
        ? String(Array.isArray(node.recipeYield) ? node.recipeYield[0] : node.recipeYield)
        : null,
      total_time: typeof node.totalTime === 'string' ? node.totalTime : null,
      image_url: extractImage(node.image),
    };
  }
  return null;
}

/* ============================================================ format prompt */

const DEFAULT_FORMAT_PROMPT = `You reformat scraped recipe data into a strict house format. Output ONLY valid JSON, no markdown, no preamble. Schema:
{
  "name": string,
  "ingredients": [string],
  "steps": [string],
  "storage_reheat": string,
  "variations_subs": string,
  "limit_violations": [string]
}
Rules:
- No food-blog intros, no narrative fluff. Steps are imperative and tight.
- Default to mild spice unless the source is explicitly a spicy dish.
- Hard limits to FLAG in limit_violations if the recipe contains them: cilantro, apples, egg yolks, heavy dairy. For each violation also append a one-line substitution suggestion into variations_subs.
- storage_reheat: concise fridge/freezer life + reheat method.
- variations_subs: 2-4 quick swaps, weeknight-friendly, no specialty-store trips.
- Preserve all real ingredient quantities from the source. Do not invent.`;

/* ============================================================ KV helpers */

const INDEX_KEY = 'cookscribe::index';

async function readIndex(env) {
  try {
    const raw = await env.COOKSCRIBE_KV.get(INDEX_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function writeIndex(env, index) {
  await env.COOKSCRIBE_KV.put(INDEX_KEY, JSON.stringify(index));
}

/* ============================================================ route handlers */

/** POST /extract/url */
async function handleExtractUrl(request, env) {
  requireKey(request, env);
  const body = await parseBody(request);
  const target = requireString(body, 'url', 2000);
  let u;
  try { u = new URL(target); } catch { fail('VALIDATION_ERROR', 'Not a valid URL.', 400); }
  if (!/^https?:$/.test(u.protocol)) fail('VALIDATION_ERROR', 'URL must be http(s).', 400);

  let html;
  try {
    const res = await fetch(u.href, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Cookscribe/1.0)' },
      cf: { cacheTtl: 0 },
    });
    if (!res.ok) fail('FETCH_FAILED', `Source returned ${res.status}.`, 502);
    html = await res.text();
  } catch (e) {
    if (e && e.code) throw e;
    fail('FETCH_FAILED', 'Could not fetch the source page.', 502);
  }

  const recipe = extractJsonLdRecipe(html);
  if (!recipe) fail('NO_RECIPE_FOUND', 'No structured recipe data found on that page.', 422);

  recipe.source_domain = u.hostname.replace(/^www\./, '');
  return json(request, { raw: recipe, source_domain: recipe.source_domain });
}

/** POST /format */
async function handleFormat(request, env) {
  requireKey(request, env);
  const body = await parseBody(request);
  if (!body.raw || typeof body.raw !== 'object') fail('VALIDATION_ERROR', "Missing 'raw'.", 400);

  const systemPrompt = (typeof body.prompt === 'string' && body.prompt.trim())
    ? body.prompt : DEFAULT_FORMAT_PROMPT;

  let res;
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{ role: 'user', content: JSON.stringify(body.raw) }],
      }),
    });
  } catch {
    fail('FORMAT_FAILED', 'Could not reach the formatting service.', 502);
  }
  if (!res.ok) fail('FORMAT_FAILED', `Formatter returned ${res.status}.`, 502);

  const data = await res.json();
  const text = (data.content || [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n');

  let formatted;
  try {
    formatted = JSON.parse(text.replace(/```json|```/g, '').trim());
  } catch {
    fail('FORMAT_FAILED', 'Formatter returned unparseable output.', 502);
  }
  return json(request, { formatted });
}

/** POST /imports */
async function handleCreateImport(request, env) {
  requireKey(request, env);
  const body = await parseBody(request);
  if (!body.name || !body.source_type) fail('VALIDATION_ERROR', 'Missing required import fields.', 400);

  const id = crypto.randomUUID().slice(0, 8);
  const now = Date.now();
  const record = {
    id,
    name: String(body.name).slice(0, 200),
    source_type: body.source_type === 'pdf' ? 'pdf' : 'url',
    source_url: body.source_url || null,
    source_domain: body.source_domain || null,
    mode: body.mode === 'raw' ? 'raw' : 'spec',
    imported_at: now,
    raw: body.raw || null,
    formatted: body.formatted || null,
  };

  await env.COOKSCRIBE_KV.put(`cookscribe::import::${id}`, JSON.stringify(record));

  const index = await readIndex(env);
  index.unshift({
    id,
    name: record.name,
    source_domain: record.source_domain,
    source_type: record.source_type,
    mode: record.mode,
    imported_at: now,
  });
  await writeIndex(env, index);

  return json(request, { id, record }, 201);
}

/** GET /imports */
async function handleListImports(request, env) {
  requireKey(request, env);
  const index = await readIndex(env);
  return json(request, { items: index });
}

/** GET /imports/:id */
async function handleGetImport(request, env, params) {
  requireKey(request, env);
  const raw = await env.COOKSCRIBE_KV.get(`cookscribe::import::${params.id}`);
  if (!raw) fail('IMPORT_NOT_FOUND', 'Import not found.', 404);
  return json(request, { record: JSON.parse(raw) });
}

/** PUT /imports/:id */
async function handleUpdateImport(request, env, params) {
  requireKey(request, env);
  const existing = await env.COOKSCRIBE_KV.get(`cookscribe::import::${params.id}`);
  if (!existing) fail('IMPORT_NOT_FOUND', 'Import not found.', 404);

  const record = JSON.parse(existing);
  const body = await parseBody(request);

  // Merge updatable fields
  if (typeof body.name === 'string') record.name = body.name.slice(0, 200);
  if (body.formatted !== undefined) record.formatted = body.formatted;
  if (body.raw !== undefined) record.raw = body.raw;
  if (typeof body.mode === 'string') record.mode = body.mode === 'raw' ? 'raw' : 'spec';

  await env.COOKSCRIBE_KV.put(`cookscribe::import::${params.id}`, JSON.stringify(record));

  // Update index entry name/mode if changed
  const index = await readIndex(env);
  const idx = index.findIndex((e) => e.id === params.id);
  if (idx !== -1) {
    index[idx].name = record.name;
    index[idx].mode = record.mode;
    await writeIndex(env, index);
  }

  return json(request, { record });
}

/** DELETE /imports/:id */
async function handleDeleteImport(request, env, params) {
  requireKey(request, env);
  const existing = await env.COOKSCRIBE_KV.get(`cookscribe::import::${params.id}`);
  if (!existing) fail('IMPORT_NOT_FOUND', 'Import not found.', 404);

  await env.COOKSCRIBE_KV.delete(`cookscribe::import::${params.id}`);

  const index = await readIndex(env);
  const updated = index.filter((e) => e.id !== params.id);
  await writeIndex(env, updated);

  return json(request, { ok: true });
}

/* ============================================================ routing */

function matchRoute(pattern, pathname) {
  const pParts = pattern.split('/');
  const uParts = pathname.split('/');
  if (pParts.length !== uParts.length) return null;
  const params = {};
  for (let i = 0; i < pParts.length; i++) {
    if (pParts[i].startsWith(':')) {
      params[pParts[i].slice(1)] = decodeURIComponent(uParts[i]);
    } else if (pParts[i] !== uParts[i]) {
      return null;
    }
  }
  return params;
}

const ROUTES = [
  { method: 'POST',   pattern: '/extract/url',    handler: handleExtractUrl },
  { method: 'POST',   pattern: '/format',          handler: handleFormat },
  { method: 'POST',   pattern: '/imports',         handler: handleCreateImport },
  { method: 'GET',    pattern: '/imports',         handler: handleListImports },
  { method: 'GET',    pattern: '/imports/:id',     handler: handleGetImport },
  { method: 'PUT',    pattern: '/imports/:id',     handler: handleUpdateImport },
  { method: 'DELETE', pattern: '/imports/:id',     handler: handleDeleteImport },
];

/* ============================================================ entry point */

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }

    const url = new URL(request.url);
    const pathname = url.pathname.replace(/\/+$/, '') || '/';

    for (const route of ROUTES) {
      if (route.method !== request.method) continue;
      const params = matchRoute(route.pattern, pathname);
      if (params === null) continue;

      try {
        return await route.handler(request, env, params);
      } catch (err) {
        const isStructured = err && typeof err === 'object' && typeof err.code === 'string';
        const code    = isStructured ? err.code    : 'INTERNAL_ERROR';
        const message = isStructured ? err.message : 'An unexpected error occurred.';
        const status  = isStructured && Number.isInteger(err.status) ? err.status : 500;
        return errorResponse(request, code, message, status);
      }
    }

    return errorResponse(request, 'INTERNAL_ERROR', 'Route not found.', 404);
  },
};
