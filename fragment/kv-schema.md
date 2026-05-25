# Fragment KV Schema Documentation

## Overview

All snippets live in Cloudflare Workers KV under the namespace `FRAGMENT_KV`. Keys follow a hierarchical naming convention. A lightweight index (`index:snippets`) enables fast filtering without fetching all snippet data.

-----

## Key Naming Conventions

### Active Snippets

```
snippet:{id}
```

Example: `snippet:dropdown-menu`

### Archived Snippets

```
snippet:archived:{id}:{timestamp}
```

Example: `snippet:archived:dropdown-menu:2026-05-22T14:30:00Z`

### Metadata Index

```
index:snippets
```

Single key holding a JSON array of snippet metadata (IDs, names, categories, status).

### Lock State (Session)

```
lock:state
```

Tracks write-lock status and unlock session expiration.

-----

## Data Structures

### Active Snippet Value

```json
{
  "id": "dropdown-menu",
  "name": "Custom Dropdown Select",
  "category": "UI Components",
  "description": "A styled custom dropdown component with keyboard support, click-to-close, and smooth animations. Great for replacing native selects with custom designs.",
  "tags": ["html", "css", "javascript", "select", "dropdown", "forms"],
  "author": "andykozicki",
  "created": "2026-05-20",
  "updated": "2026-05-20",
  "htmlContent": "<!DOCTYPE html>\n<html lang=\"en\">...",
  "views": 0,
  "status": "active"
}
```

**Field Definitions:**

- `id` (string, unique): Kebab-case identifier (no spaces, special chars)
- `name` (string): Display name of snippet
- `category` (string): One of: “UI Components”, “Layouts”, “Utilities”, “Forms”, “Animations”, “SVG Icons”, “Other”
- `description` (string): One-liner or short paragraph about what the snippet does
- `tags` (array): Tech stack + feature tags (e.g., “html”, “css”, “javascript”, “react”, “responsive”)
- `author` (string): GitHub username or name
- `created` (ISO 8601 date string): YYYY-MM-DD format (no time)
- `updated` (ISO 8601 date string): YYYY-MM-DD format (no time)
- `htmlContent` (string): Full, valid HTML markup. Can be multiline (newlines preserved as `\n`)
- `views` (number): Optional counter for tracking popularity. Incremented on dashboard load.
- `status` (enum): Always “active” for this key format

**Size Constraint:** Individual snippet values should stay well under 1 MB. HTML with inline CSS/JS typically 10–100 KB.

-----

### Archived Snippet Value

```json
{
  "id": "dropdown-menu",
  "name": "Custom Dropdown Select",
  "category": "UI Components",
  "description": "...",
  "tags": ["html", "css", "javascript"],
  "author": "andykozicki",
  "created": "2026-05-20",
  "updated": "2026-05-21",
  "htmlContent": "<!DOCTYPE html>...",
  "views": 5,
  "status": "archived",
  "archivedAt": "2026-05-22T14:30:00Z",
  "archivedReason": "Replaced by improved version"
}
```

**Additional Fields:**

- `status` (enum): Always “archived”
- `archivedAt` (ISO 8601 timestamp): When snippet was archived. Format: `YYYY-MM-DDTHH:MM:SSZ` (UTC)
- `archivedReason` (string, optional): Human-readable reason for archiving (e.g., “Replaced by v2”, “Broken, needs fix”)

**Archival Workflow:**

1. When user clicks “Archive” on a snippet, the dashboard makes a `POST /api/snippet/:id/archive` request
1. Worker reads current `snippet:{id}`, copies it, adds `archivedAt` + `archivedReason`
1. Writes new key: `snippet:archived:{id}:{timestamp}`
1. **Deletes** the original `snippet:{id}` key (clean removal from active)
1. Updates `index:snippets` to mark as archived

-----

### Metadata Index Value

```json
[
  {
    "id": "dropdown-menu",
    "name": "Custom Dropdown Select",
    "category": "UI Components",
    "status": "active",
    "author": "andykozicki"
  },
  {
    "id": "dark-mode-toggle",
    "name": "Light/Dark Theme Toggle",
    "category": "UI Components",
    "status": "active",
    "author": "andykozicki"
  },
  {
    "id": "drag-and-drop",
    "name": "Drag and Drop File Upload",
    "category": "Forms",
    "status": "active",
    "author": "andykozicki"
  },
  {
    "id": "dropdown-menu",
    "name": "Custom Dropdown Select",
    "category": "UI Components",
    "status": "archived",
    "author": "andykozicki",
    "archivedAt": "2026-05-22T14:30:00Z"
  }
]
```

**Purpose:** Fast filtering and listing without fetching full snippet data.

**Update Logic:**

- Whenever a snippet is created, updated, archived, restored, or deleted, re-write the entire index
- Keep it lightweight: only essential fields
- Index should never exceed 100 KB (even with 500+ snippets)
- Dashboard fetches index on load, caches it in memory

-----

### Lock State Value

```json
{
  "locked": true,
  "unlockedAt": null,
  "unlockedUntil": null
}
```

When unlocked:

```json
{
  "locked": false,
  "unlockedAt": "2026-05-22T15:30:00Z",
  "unlockedUntil": "2026-05-22T16:30:00Z"
}
```

**Fields:**

- `locked` (boolean): If true, all write operations are rejected
- `unlockedAt` (ISO 8601 timestamp | null): When unlock was initiated
- `unlockedUntil` (ISO 8601 timestamp | null): When unlock expires (1 hour after `unlockedAt`)

**Behavior:**

- Default state: `{locked: true, unlockedAt: null, unlockedUntil: null}`
- User enters PIN → Worker validates against `ACCESS_PIN` env var → if correct, sets `unlockedUntil` to now + 1 hour
- Every API call checks if `unlockedUntil` has passed → if yes, re-lock and reject write
- Dashboard UI shows remaining unlock time and auto-updates every 10 seconds

-----

## Categories

Use one of these for the `category` field:

- **UI Components** – Buttons, dropdowns, toggles, modals, cards, etc.
- **Layouts** – Grid systems, flexbox patterns, multi-column layouts
- **Utilities** – Helper functions, formatters, validators, math
- **Forms** – Input fields, form layouts, validation, file uploads
- **Animations** – Transitions, keyframes, scroll effects, loaders
- **SVG Icons** – Icon sets, animated SVGs, symbol libraries
- **Other** – Miscellaneous snippets that don’t fit above

-----

## Common Tags

Use lowercase, hyphenated tags. Common ones:

- **Tech Stack:** html, css, javascript, react, vue, vanilla-js, typescript
- **Features:** responsive, accessible, animation, dark-mode, form, validation, drag-drop
- **UI Elements:** button, card, dropdown, modal, toggle, input, table, grid
- **Utilities:** formatter, validator, async, fetch, storage, debounce, throttle
- **Styling:** flexbox, grid, gradient, shadow, border, radius, transform

-----

## Export/Import Format

When exporting the entire KV database (via `POST /api/export`), the response is a JSON object:

```json
{
  "version": "1",
  "exportedAt": "2026-05-22T15:30:00Z",
  "snippets": [
    { id: "dropdown-menu", name: "...", ... },
    { id: "dark-mode-toggle", name: "...", ... }
  ],
  "archived": [
    { id: "old-dropdown", name: "...", status: "archived", archivedAt: "...", ... }
  ]
}
```

When importing (via `POST /api/import`), send the same structure. Worker validates schema and:

- Creates/updates entries for all snippets in `snippets` array
- Creates entries for all snippets in `archived` array
- Rebuilds `index:snippets` from both arrays
- Returns result: `{ success: true, created: N, updated: M, archived: P, errors: [] }`

-----

## Size & Performance Notes

### KV Quotas

- **Free Plan:** 1,000 keys, 1 GB total storage
- **Paid Plan:** 1 million keys, 100 GB total storage

At ~50 KB per snippet, free plan comfortably holds 20,000 snippets. Paid plan supports 2 million.

### Read Performance

- Index fetch (all metadata): ~20 ms
- Single snippet fetch: ~50 ms
- Dashboard load (index + 12 snippets): ~200 ms

### Write Performance

- Single snippet write: ~100 ms
- Bulk import (100 snippets): ~2–3 seconds
- Archive (delete + create + index update): ~150 ms

-----

## Consistency Guarantees

KV provides **eventual consistency** (typically <1 second). For most dashboard operations, this is invisible. In rare race conditions (two simultaneous writes):

- Last write wins
- Index rebuild is idempotent (safe to re-run)
- No locking mechanism (KV doesn’t support transactions)

**Mitigations:**

- Dashboard uses `unlockedUntil` to prevent simultaneous edits by different users
- Export/import includes version field for future conflict resolution

-----

## Migration Checklist

When moving snippets from GitHub to KV:

- [ ] Export all 8 snippets from `fragments-main/snippets/` as JSON
- [ ] Verify each snippet object has required fields (id, name, category, description, tags, author, created, updated, htmlContent, status)
- [ ] Validate all `created`/`updated` dates are ISO 8601 (YYYY-MM-DD)
- [ ] Ensure all `htmlContent` strings are valid HTML (no syntax errors)
- [ ] Deploy Worker with `wrangler.toml` pointing to `FRAGMENT_KV`
- [ ] Use dashboard import feature to bulk-load JSON
- [ ] Verify all snippets appear in Active tab
- [ ] Export KV and save local backup
- [ ] Archive GitHub `snippets/` folder (don’t delete; keep as reference)

-----

## Example: Full Snippet JSON (Ready to Import)

```json
{
  "id": "dark-mode-toggle",
  "name": "Light/Dark Theme Toggle",
  "category": "UI Components",
  "description": "A persistent light/dark mode toggle with system preference detection and localStorage persistence. Includes smooth transitions and a polished switch component.",
  "tags": ["html", "css", "javascript", "theme", "accessibility"],
  "author": "andykozicki",
  "created": "2026-05-20",
  "updated": "2026-05-20",
  "htmlContent": "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n<meta charset=\"UTF-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n<style>\n  /* ── Reset ─────────────────────────────────────────── */\n  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }\n\n  /* ── Root variables ────────────────────────────────── */\n  :root {\n    --sterling-green: #599b42;\n    --spring-curve: cubic-bezier(0.34, 1.56, 0.64, 1);\n    --bg: #f0f4f8;\n    --surface: #ffffff;\n    --border: #dde3ea;\n    --text-primary: #0f172a;\n    --text-secondary: #64748b;\n  }\n\n  [data-theme=\"dark\"] {\n    --bg: #0a0f1a;\n    --surface: #131d2e;\n    --border: #243044;\n    --text-primary: #e8eef5;\n    --text-secondary: #7a90aa;\n  }\n\n  body {\n    width: 800px;\n    height: 500px;\n    display: flex;\n    align-items: center;\n    justify-content: center;\n    background: var(--bg);\n    color: var(--text-primary);\n    font-family: 'Inter', system-ui, -apple-system, sans-serif;\n    overflow: hidden;\n    transition: background 0.3s, color 0.3s;\n  }\n\n  /* ... rest of CSS ... */\n</style>\n</head>\n<body>\n  <div class=\"demo-container\">\n    <div class=\"demo-label\">Theme Toggle Demo</div>\n    \n    <label class=\"dark-toggle\" title=\"Toggle dark mode\">\n      <span class=\"dark-label\">Dark Mode</span>\n      <div class=\"toggle-switch\">\n        <input type=\"checkbox\" id=\"theme-checkbox\" onchange=\"toggleTheme()\">\n        <div class=\"toggle-track\"></div>\n      </div>\n    </label>\n\n    <div class=\"status-text\">\n      Current: <span class=\"theme-indicator\" id=\"status\">Light</span>\n    </div>\n  </div>\n\n  <script>\n    // ... JavaScript ... \n  </script>\n</body>\n</html>",
  "views": 0,
  "status": "active"
}
```

-----

## Debugging & Inspection

### Via Wrangler CLI

```bash
# List all keys in KV namespace
wrangler kv:key list --namespace-id=YOUR_ID

# Get a specific key
wrangler kv:key get snippet:dropdown-menu --namespace-id=YOUR_ID

# Delete a key (use with caution!)
wrangler kv:key delete snippet:dropdown-menu --namespace-id=YOUR_ID
```

### Via Dashboard Export

Use the “Download KV Backup” feature to inspect all data locally as JSON.

-----

## Future Enhancements

- **Version history:** Store multiple versions per snippet ID (e.g., `snippet:dropdown-menu:v1`, `snippet:dropdown-menu:v2`)
- **Tagging:** Allow custom tags beyond predefined list (may require schema update)
- **Favorites:** Track per-user favorites (would require user auth + separate KV namespace)
- **Usage analytics:** Track snippet views, exports, imports
- **Collaborators:** Support multiple authors with edit history
