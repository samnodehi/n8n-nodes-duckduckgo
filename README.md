# DuckDuckGo Search Node for n8n

[![npm version](https://img.shields.io/npm/v/n8n-nodes-duckduckgo-search.svg)](https://www.npmjs.com/package/n8n-nodes-duckduckgo-search)
[![npm downloads](https://img.shields.io/npm/dw/n8n-nodes-duckduckgo-search.svg)](https://www.npmjs.com/package/n8n-nodes-duckduckgo-search)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub release](https://img.shields.io/github/v/release/samnodehi/n8n-nodes-duckduckgo)](https://github.com/samnodehi/n8n-nodes-duckduckgo/releases/latest)
[![Build](https://github.com/samnodehi/n8n-nodes-duckduckgo/actions/workflows/ci.yml/badge.svg)](https://github.com/samnodehi/n8n-nodes-duckduckgo/actions)

An n8n community node for DuckDuckGo search. Search the web, find images, discover news, and explore videos — no API key required, no outbound telemetry.

## ✨ Features

- **Four search types**: Web, Image, News, Video
- **AI Agent compatible**: Works as a tool in n8n AI Agent workflows (`usableAsTool: true`)
- **No API key required**: Completely free, no registration
- **No outbound telemetry**: No analytics or telemetry data sent anywhere — search requests go only to DuckDuckGo
- **Structured output**: Predictable, consistent field names per operation type
- **Fallback resilience**: News and Video searches fall back to an alternative result path on primary failure, with results clearly labeled
- **Specific error messages**: Named errors for VQD token failures, 403 blocks, and web page parser regressions
- **Search operators**: Advanced query syntax for Web Search (`site:`, `filetype:`, `intitle:`, etc.)
- **Region/locale support**: Configure DuckDuckGo locale codes per operation
- **Safe search**: Configurable per operation
- **Optional page content extraction**: Fetch and extract the main text of result pages (Web and News, opt-in), with optional page metadata
- **Extract Page Content operation**: Give any URL → clean main text + metadata (a "read any page" tool for AI Agents)
- **Instant Answer operation**: Direct answers, abstracts, and definitions from DuckDuckGo's free Instant Answer API

---

## 🤔 Why this node?

- **No API key or paid search API required** — uses DuckDuckGo's public search endpoints directly
- **Works as an n8n AI Agent tool** — attach it to any Agent node; no extra setup needed
- **Four search types in one node** — Web, Image, News, and Video from a single, consistent interface
- **Clean JSON output designed for automation** — predictable field names, no noise, easy to wire into downstream nodes
- **Fallback labels for News and Video** — when results come from the fallback path, `isFallback: true` tells you so

---

## 📦 Installation

### Via n8n Interface (recommended)

1. Go to **Settings** → **Community Nodes**
2. Enter: `n8n-nodes-duckduckgo-search`
3. Click **Install**
4. Restart n8n if required

### Via npm

```bash
npm install n8n-nodes-duckduckgo-search
```

---

## 🚀 Quick Start

1. **Add Node**: Drag the **DuckDuckGo Search** node into your workflow
2. **Choose Operation**: Select Web, Image, News, or Video search
3. **Enter Query**: Type your search terms
4. **Set Limits**: Adjust `maxResults` and `safeSearch` as needed
5. **Execute**: Run your workflow

---

## 🔍 Operations

### Web Search

Searches DuckDuckGo and returns organic web results.

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `query` | string | required | Search terms |
| `maxResults` | number | 10 | Number of results (1–100) |
| `safeSearch` | options | Moderate | `Strict`, `Moderate`, or `Off` |
| `region` | string | wt-wt | Locale code (e.g. `de-de`, `fr-fr`) |
| `useSearchOperators` | boolean | false | Enable advanced operator parsing |
| `searchOperators` | string | — | Operator string appended to query |
| `fetchPageContent` | boolean | false | Fetch each result's page and extract its main text (opt-in; see [Page Content Extraction](#-page-content-extraction)) |
| `pageContentMaxResults` | number | 3 | How many top results to fetch content for (when enabled) |
| `pageContentMaxLength` | number | 2000 | Truncate extracted text to N characters (0 = no limit) |
| `pageContentTimeout` | number | 8000 | Per-page fetch timeout in ms |

**Example:**

```json
{
  "operation": "search",
  "query": "open source AI models 2025",
  "webSearchOptions": {
    "maxResults": 10,
    "safeSearch": "moderate",
    "region": "us-en"
  }
}
```

**Sample output:**

```json
[
  {
    "position": 1,
    "title": "Top Open Source AI Models in 2025",
    "description": "A comprehensive overview of the leading open source AI models...",
    "url": "https://example.com/ai-models-2025",
    "hostname": "example.com",
    "sourceType": "web"
  }
]
```

> **Note:** Web Search output does not include `snippet` (removed; use `description` instead) or `favicon` (removed; was always empty).

---

### Image Search

Searches DuckDuckGo images and returns image metadata.

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `imageQuery` | string | required | Image search terms |
| `maxResults` | number | 10 | Number of results (1–100) |
| `safeSearch` | options | Moderate | `Strict`, `Moderate`, or `Off` |

**Example:**

```json
{
  "operation": "searchImages",
  "imageQuery": "mountain landscape sunset",
  "imageSearchOptions": {
    "maxResults": 10,
    "safeSearch": "moderate"
  }
}
```

**Sample output:**

```json
[
  {
    "title": "Mountain Sunset Over the Rockies",
    "imageUrl": "https://example.com/images/mountain-sunset.jpg",
    "thumbnailUrl": "https://tse1.mm.bing.net/th?id=...",
    "url": "https://example.com/photography/mountain-sunset",
    "width": 1920,
    "height": 1080,
    "source": "https://example.com/photography/mountain-sunset",
    "sourceType": "image"
  }
]
```

> **Field note:** `imageUrl` is the direct image URL. `url` is the source page URL where the image was found. `thumbnailUrl` is the DuckDuckGo-hosted thumbnail.

---

### News Search

Searches DuckDuckGo news results.

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `newsQuery` | string | required | News search terms |
| `maxResults` | number | 10 | Number of results (1–100) |
| `safeSearch` | options | Moderate | `Strict`, `Moderate`, or `Off` |
| `region` | string | wt-wt | Locale code |
| `timePeriod` | string | — | Time filter: `d` (day), `w` (week), `m` (month), `y` (year) |
| `fetchPageContent` | boolean | false | Fetch each article's page and extract its main text (opt-in; see [Page Content Extraction](#-page-content-extraction)) |
| `pageContentMaxResults` | number | 3 | How many top results to fetch content for (when enabled) |
| `pageContentMaxLength` | number | 2000 | Truncate extracted text to N characters (0 = no limit) |
| `pageContentTimeout` | number | 8000 | Per-page fetch timeout in ms |

**Example:**

```json
{
  "operation": "searchNews",
  "newsQuery": "renewable energy breakthrough",
  "newsSearchOptions": {
    "maxResults": 10,
    "safeSearch": "moderate",
    "region": "us-en",
    "timePeriod": "w"
  }
}
```

**Sample output:**

```json
[
  {
    "title": "New Solar Panel Achieves Record Efficiency",
    "description": "Researchers have announced a breakthrough in photovoltaic efficiency...",
    "url": "https://news.example.com/solar-efficiency",
    "imageUrl": "https://news.example.com/images/solar.jpg",
    "date": "2025-05-15T09:00:00.000Z",
    "relativeTime": "2 hours ago",
    "syndicate": "Tech News Daily",
    "isOld": false,
    "isFallback": false,
    "sourceType": "news"
  }
]
```

> **Field note:** `syndicate` is the news source/publisher name. When the fallback path is used, `syndicate` will be `"DuckDuckGo Fallback"` and `isFallback` will be `true`. See [Fallback Behavior](#-fallback-behavior).

---

### Video Search

Searches DuckDuckGo video results.

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `videoQuery` | string | required | Video search terms |
| `maxResults` | number | 10 | Number of results (1–100) |
| `safeSearch` | options | Moderate | `Strict`, `Moderate`, or `Off` |
| `region` | string | wt-wt | Locale code |

**Example:**

```json
{
  "operation": "searchVideos",
  "videoQuery": "machine learning tutorial beginners",
  "videoSearchOptions": {
    "maxResults": 10,
    "safeSearch": "moderate"
  }
}
```

**Sample output:**

```json
[
  {
    "title": "Machine Learning Full Course for Beginners",
    "description": "A complete introduction to machine learning concepts...",
    "url": "https://www.youtube.com/watch?v=...",
    "imageUrl": "https://i.ytimg.com/vi/.../hqdefault.jpg",
    "duration": "2:14:30",
    "published": "2024-11-10T00:00:00.000Z",
    "publishedOn": "YouTube",
    "publisher": "FreeCodeCamp",
    "viewCount": "2100000",
    "isFallback": false,
    "sourceType": "video"
  }
]
```

> **Field note:** When the fallback path is used, `publisher` will be `"DuckDuckGo Fallback"` and `isFallback` will be `true`. See [Fallback Behavior](#-fallback-behavior).

---

### Extract Page Content

Fetches **any URL** (not a search) and extracts its main readable text — useful when an AI Agent already has a URL and needs to read the page.

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `url` | string | required | The page URL to fetch and extract |
| `pageContentMaxLength` | number | 2000 | Truncate extracted text to N characters (0 = no limit) |
| `pageContentTimeout` | number | 8000 | Fetch timeout in ms |
| `includePageMetadata` | boolean | false | Also return title/author/published/excerpt/siteName when the page is an article |

**Sample output:**

```json
{
  "url": "https://example.com/article",
  "content": "Extracted main text of the page…",
  "sourceType": "pageContent",
  "title": "Article Title",
  "siteName": "Example"
}
```

> ⚠️ This operation fetches a third-party URL directly (not DuckDuckGo). See [Privacy & Security](#-privacy--security).

---

### Instant Answer

Returns DuckDuckGo's **Instant Answer** for a query — a direct answer, a Wikipedia-style abstract, a definition, and related topics — via the official **free, no-key** API.

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `instantAnswerQuery` | string | required | The term or question (e.g. a person, place, or concept) |

**Sample output:**

```json
{
  "query": "DuckDuckGo",
  "heading": "DuckDuckGo",
  "abstract": "DuckDuckGo is an internet search engine that emphasizes protecting searchers' privacy…",
  "abstractSource": "Wikipedia",
  "abstractURL": "https://en.wikipedia.org/wiki/DuckDuckGo",
  "relatedTopics": [
    { "text": "…", "url": "https://duckduckgo.com/…" }
  ],
  "type": "A",
  "sourceType": "instantAnswer"
}
```

> **Note:** Instant Answers exist only for some queries (entities, definitions, calculations). For general queries the fields may be empty — use Web Search instead.

---

## ⚙️ Configuration Reference

### Common Parameters (all operations)

| Parameter | Type | Default | Values |
|-----------|------|---------|--------|
| `maxResults` | number | 10 | 1–100 |
| `safeSearch` | options | Moderate | `Strict`, `Moderate`, `Off` |
| `region` | string | `wt-wt` | DuckDuckGo locale code (e.g. `de-de`, `fr-fr`) |

### Operation-specific parameters

| Operation | Extra parameters |
|-----------|-----------------|
| Web Search | `useSearchOperators`, `searchOperators`, `fetchPageContent` (+ `pageContentMaxResults`, `pageContentMaxLength`, `pageContentTimeout`) |
| News Search | `timePeriod` (`d`, `w`, `m`, `y`), `fetchPageContent` (+ `pageContentMaxResults`, `pageContentMaxLength`, `pageContentTimeout`) |
| Image Search | *(none beyond common)* |
| Video Search | *(none beyond common)* |
| Extract Page Content | `url`, `pageContentMaxLength`, `pageContentTimeout`, `includePageMetadata` |
| Instant Answer | `instantAnswerQuery` |

### Cache Settings

Available on all operations via the **Cache Settings** collection:

| Setting | Type | Default | Range | Description |
|---------|------|---------|-------|-------------|
| `enableCache` | boolean | `true` | — | Cache results in memory to avoid repeated requests for the same query |
| `cacheTTL` | number | `300` | 60–86400 | Time-to-live in seconds before cached results expire |

Cache is in-memory only and is not shared across n8n worker processes or restarts. It is scoped to the running n8n process.

---


## 📋 Output Field Reference

### Web Search

| Field | Type | Description |
|-------|------|-------------|
| `position` | number | Result rank (1-based) |
| `title` | string | Page title |
| `description` | string | Page description / snippet |
| `url` | string | Page URL |
| `hostname` | string | Domain name |
| `sourceType` | string | Always `"web"` |
| `pageContent` | string | Extracted main text of the result page (only when **Fetch Page Content** is enabled; empty for results beyond the fetched top-N) |
| `pageContentTruncated` | boolean | Present and `true` when `pageContent` was cut to `pageContentMaxLength` |
| `pageContentError` | string | Present only when the page could not be fetched/parsed (e.g. `HTTP 403`, `Timed out after 8000ms`) |
| `pageTitle` / `pageAuthor` / `pagePublished` / `pageExcerpt` / `pageSiteName` | string | Page metadata — present only when **Include Page Metadata** is enabled and the page is an article |

### Image Search

| Field | Type | Description |
|-------|------|-------------|
| `title` | string | Image title |
| `imageUrl` | string | Direct URL to the image file |
| `thumbnailUrl` | string | DuckDuckGo thumbnail URL |
| `url` | string | Source page where image was found |
| `width` | number | Image width in pixels |
| `height` | number | Image height in pixels |
| `source` | string | Source page URL where the image was found |
| `sourceType` | string | Always `"image"` |

### News Search

| Field | Type | Description |
|-------|------|-------------|
| `title` | string | Article title |
| `description` | string | Article excerpt |
| `url` | string | Article URL |
| `imageUrl` | string | Article thumbnail URL |
| `date` | string | Publication date (ISO 8601) |
| `relativeTime` | string | Human-readable relative time (e.g. "2 hours ago") |
| `syndicate` | string | Publisher/source name; `"DuckDuckGo Fallback"` when fallback path was used |
| `isOld` | boolean | Whether DuckDuckGo considers the article old |
| `isFallback` | boolean | `true` if result came from fallback path |
| `sourceType` | string | Always `"news"` |
| `pageContent` | string | Extracted main text of the article page (only when **Fetch Page Content** is enabled; empty for results beyond the fetched top-N) |
| `pageContentTruncated` | boolean | Present and `true` when `pageContent` was cut to `pageContentMaxLength` |
| `pageContentError` | string | Present only when the page could not be fetched/parsed |
| `pageTitle` / `pageAuthor` / `pagePublished` / `pageExcerpt` / `pageSiteName` | string | Page metadata — present only when **Include Page Metadata** is enabled and the page is an article |

### Video Search

| Field | Type | Description |
|-------|------|-------------|
| `title` | string | Video title |
| `description` | string | Video description |
| `url` | string | Video page URL |
| `imageUrl` | string | Video thumbnail URL |
| `duration` | string | Video duration (e.g. `"15:30"`) |
| `published` | string | Publication date (ISO 8601) |
| `publishedOn` | string | Platform where published (e.g. `"YouTube"`) |
| `publisher` | string | Channel/creator name; `"DuckDuckGo Fallback"` when fallback path was used |
| `viewCount` | string | View count (as string) |
| `isFallback` | boolean | `true` if result came from fallback path |
| `sourceType` | string | Always `"video"` |

---

## 🔄 Fallback Behavior

**News Search** and **Video Search** use `duck-duck-scrape` as their primary result source.

If the primary path fails (e.g. DuckDuckGo returns a server error or no parseable results), the node automatically attempts an alternative HTML-based fallback search.

When fallback results are returned:

- `isFallback` is `true` on every result item
- For News: `syndicate` is set to `"DuckDuckGo Fallback"`
- For Video: `publisher` is set to `"DuckDuckGo Fallback"`

When primary results are returned normally:

- `isFallback` is `false` on every result item

This allows downstream nodes and AI Agents to detect and handle fallback results differently if needed (e.g. flag lower confidence, re-rank, or discard).

**Web Search** and **Image Search** do not use a two-tier fallback; they use a single direct HTML-based search path.

---

## ⚠️ Error Behavior

The node surfaces specific, actionable error messages rather than generic failures.

### Image Search: VQD token missing

If DuckDuckGo's image search page does not return a valid VQD token (a session token required to query image results), the node throws:

> `DuckDuckGo image search token (VQD) could not be extracted. Image search may be temporarily unavailable. Please try again later.`

No fake or placeholder image URLs are produced. The result item carries the error message.

### Image Search: 403 Forbidden

If the image results endpoint (`i.js`) returns HTTP 403, the node throws:

> `DuckDuckGo image search returned 403 Forbidden. The search token (VQD) may have expired or the request was blocked. Please try again.`

This typically indicates a VQD token expiry or a temporary block by DuckDuckGo.

### Web Search: Parser failure

If `directWebSearch` receives an HTTP 200 response with a large body but cannot parse any result blocks from it (indicating DuckDuckGo may have changed its HTML structure), the node throws an error with this message:

> `DuckDuckGo web search response could not be parsed. The page structure may have changed. Please try again later.`

This is distinct from a genuine no-results response, which returns an empty array without an error.

### Empty results

An empty result array (`[]`) is a valid response when DuckDuckGo genuinely finds no results for the query. This is not an error condition.

---

## 🤖 AI Agent Usage

This node supports `usableAsTool: true`, making it available as a tool inside n8n AI Agent workflows.

**Setup:**

1. Create an **AI Agent** node in your workflow
2. Add **DuckDuckGo Search** as a connected tool
3. Configure the default operation and parameters
4. The agent will invoke the tool autonomously when a search is needed

**Notes for AI Agent use:**

- Output fields are consistent and predictable, suitable for LLM processing
- `isFallback: true` on news/video results signals lower-confidence data to downstream logic
- Specific error messages (VQD missing, 403, parser failure) help agents self-diagnose and retry
- Some older n8n versions may require the environment variable `N8N_COMMUNITY_PACKAGES_ALLOW_TOOL_USAGE=true` to expose community nodes as agent tools

---

## 🔍 Search Operators

Advanced query operators are supported for **Web Search** only. Enable `useSearchOperators` and the operator string is appended to the query before being sent to DuckDuckGo.

| Operator | Example | Effect |
|----------|---------|--------|
| `site:` | `site:github.com` | Restrict to a specific site |
| `filetype:` | `filetype:pdf` | Find specific file types |
| `intitle:` | `intitle:"machine learning"` | Match in page titles |
| `inurl:` | `inurl:tutorial` | Match in page URLs |
| `"exact phrase"` | `"transformer architecture"` | Exact phrase match |
| `-exclude` | `python -snake` | Exclude a term |
| `OR` | `cat OR dog` | Either term |

**Example:**

```json
{
  "operation": "search",
  "query": "machine learning",
  "webSearchOptions": {
    "useSearchOperators": true,
    "searchOperators": "site:arxiv.org filetype:pdf"
  }
}
```

---

## 🌍 Supported Regions

Pass a DuckDuckGo locale code as the `region` parameter. The node does not apply a separate language filter — locale code controls both language and region together. Examples:

| Region | Code |
|--------|------|
| United States (English) | `us-en` |
| United Kingdom | `uk-en` |
| Germany | `de-de` |
| France | `fr-fr` |
| Spain | `es-es` |
| Italy | `it-it` |
| Japan | `jp-jp` |
| Brazil (Portuguese) | `br-pt` |
| China | `cn-zh` |
| Russia | `ru-ru` |
| Netherlands | `nl-nl` |

Many locale codes are supported. Use `wt-wt` for no regional bias. Region codes follow the DuckDuckGo `kl` parameter format.

---

## 🔀 Migration Notes

If you are upgrading from an older version of this node, read the following.

### Removed UI options (silently ignored)

The following UI options were removed because they had no effect on execution or were never implemented. **If these fields exist in saved workflow JSON, they are silently ignored at runtime — no workflow changes are required.**

| Removed option | Reason |
|----------------|--------|
| `useApiKey` / API credential | DuckDuckGo has no public Search API; the credential was never read |
| `searchBackend` | Only the direct HTML backend is used; the selector had no dispatch logic |
| `proxySettings` | Proxy configuration was exposed in the UI but never applied at runtime |
| `reliabilitySettings` | The reliability manager was initialised but search calls were never wrapped with retry or circuit-breaker logic |
| Separate `searchFilters` collection | The UI collection was exposed but never read or applied |
| Web Search `timePeriod` | The date-filter parameter was not included in the web search request body |
| Image filter options (`size`, `color`, `type`, `layout`) | The `i.js` filter parameter is undocumented; smoke testing showed unreliable/silent behavior |
| Video filter options (`duration`, `resolution`, `publishedTime`) | Removed with the reliability and filter cleanup |
| Top-level `locale` option | Redundant with each operation's `Region` option; the per-operation Region (or the `wt-wt` default) is used instead |

### Output field changes

| Old field | Status | Replacement |
|-----------|--------|-------------|
| `snippet` (Web Search) | **Removed** | Use `description` — same content |
| `favicon` (Web Search) | **Removed** | Was always an empty string; no replacement needed |

### New output fields

| Field | Operations | Description |
|-------|-----------|-------------|
| `isFallback` | News, Video | `true` when results came from the fallback path |
| `position` | Web | Result rank (1-based) |

### Correct field names (if your workflow used old examples)

The following field names were incorrect in previous documentation. Use the names in the right column:

| Operation | Wrong name (old docs) | Correct name |
|-----------|----------------------|-------------|
| News | `publishedDate` | `date` |
| News | `source` | `syndicate` |
| Video | `thumbnail` | `imageUrl` |
| Video | `publishedDate` | `published` |
| Video | `views` | `viewCount` |
| Video | `source` | `publisher` |
| Image | `thumbnail` | `thumbnailUrl` |

---

## 🆘 Troubleshooting

### Empty results

- Try a broader or simpler query
- Check region/language settings — some queries return fewer results in non-default locales
- Verify safe search settings are not filtering valid results
- DuckDuckGo may temporarily return no results for some queries; retry after a short delay

### Image search fails with VQD error

DuckDuckGo image search requires a session token (VQD) extracted from an initial page load. If this extraction fails, retry the request. This is a temporary DuckDuckGo availability issue.

### Image search fails with 403

The VQD token may have expired or DuckDuckGo has temporarily rate-limited requests from your IP. Wait a short period and retry.

### Web search returns parser failure error

DuckDuckGo may have changed its HTML page structure. This means the node's result extractor cannot parse the page. This is a known fragility of HTML-based scraping. Please open a GitHub issue if this persists.

### News/video results marked `isFallback: true`

The primary search path failed and the fallback HTML path was used. Results are real but may have less metadata (e.g. no relative time or thumbnail). If high-quality metadata is critical, retry or filter on `isFallback: false`.

### Configuration errors

- Verify the query field is not empty
- Ensure `region` uses a valid locale code (e.g. `us-en`, not `en-US`)
- `maxResults` must be between 1 and 50

---

## 📄 Page Content Extraction

By default, Web Search returns DuckDuckGo's short snippet (the `description` field). DuckDuckGo controls that snippet length, and the node already returns all of it.

To get **more text**, enable **Fetch Page Content** (available on **Web Search** and **News Search**, off by default). The node then fetches the actual page behind each of the top results and extracts its main readable text into a `pageContent` field.

| Option | Default | Purpose |
|--------|---------|---------|
| `fetchPageContent` | `false` | Master toggle |
| `pageContentMaxResults` | `3` | Fetch content for the top N results only (controls speed) |
| `pageContentMaxLength` | `2000` | Truncate each `pageContent` to N characters (`0` = no limit) |
| `pageContentTimeout` | `8000` | Per-page fetch timeout in milliseconds |
| `includePageMetadata` | `false` | Also add `pageTitle` / `pageAuthor` / `pagePublished` / `pageExcerpt` / `pageSiteName` (when the page is an article) |

**How it works:** extraction is three-tiered — (1) [Mozilla Readability](https://github.com/mozilla/readability) over a lightweight [linkedom](https://github.com/WebReflection/linkedom) DOM pulls the main article text and drops nav/boilerplate; (2) when Readability finds no article, a DOM heuristic removes boilerplate and high link-density blocks (menus not wrapped in `<nav>`); (3) if DOM parsing fails, a dependency-free regex heuristic is the last resort. The result feeds clean text to downstream nodes or AI agents.

**Important caveats:**

- ⚠️ **Privacy:** when enabled, the node makes HTTP requests to the **third-party result sites** — not only to DuckDuckGo. It is off by default precisely to preserve the DuckDuckGo-only guarantee.
- **Speed:** each fetched result is one extra HTTP request. Keep `pageContentMaxResults` small (default 3) for fast workflows.
- **Resilience:** a page that times out, blocks bots, or returns non-HTML does not fail the search — that result gets an empty `pageContent` and a `pageContentError` instead.
- **JavaScript-rendered sites:** pages that render content client-side return little text from a raw fetch. Extracting those needs a headless browser, which is out of scope for this node.
- **Quality:** Readability handles most article pages cleanly; sites it cannot parse fall back to a DOM/heuristic path that may keep a little navigation text. Page metadata (especially `pageAuthor`) is also extracted heuristically and may occasionally be imprecise. For the highest-quality extraction or summarisation, pipe `pageContent` into a downstream LLM node in your workflow.

**Example:**

```json
{
  "operation": "search",
  "query": "transformer architecture explained",
  "webSearchOptions": {
    "maxResults": 10,
    "fetchPageContent": true,
    "pageContentMaxResults": 3,
    "pageContentMaxLength": 3000
  }
}
```

---

## 🔒 Privacy & Security

- **No API key required**: This node makes direct requests to DuckDuckGo's public search endpoints. No account or API key is needed.
- **No analytics or telemetry**: This node contains no telemetry or analytics code. No query data, result data, or execution metadata is sent to any analytics or telemetry service. Search requests go to DuckDuckGo only.
- **No credentials registered**: The n8n credential registry for this package is empty. n8n will not prompt for any DuckDuckGo credentials.
- **Direct requests only (by default)**: Search requests go directly to DuckDuckGo (`duckduckgo.com`, `html.duckduckgo.com`, `i.js`). No third-party search API, proxy, or intermediary is involved. The one exception is the opt-in Fetch Page Content feature below.
- **Optional page-content fetch (off by default)**: If you enable **Fetch Page Content** (Web or News Search), the node additionally requests each fetched result's page from its own third-party server to extract text. This is the only path that contacts non-DuckDuckGo hosts, and it is disabled unless you turn it on. See [Page Content Extraction](#-page-content-extraction).
- **No disk storage**: The node does not write queries or results to disk. Optional in-memory caching may temporarily keep results for the configured cache TTL (default 5 minutes) within the running n8n process.

---

## 🔌 Backend Architecture

| Operation | Primary path | Fallback path |
|-----------|-------------|---------------|
| Web Search | `directWebSearch` (html.duckduckgo.com POST) | None |
| Image Search | `directImageSearch` (duckduckgo.com + i.js) | None |
| News Search | `duck-duck-scrape` `searchNews` | HTML-based fallback |
| Video Search | `duck-duck-scrape` `searchVideos` | HTML-based fallback |

There is no user-configurable backend selector. Each operation type uses the most reliable path available. Every path — primary and fallback — talks only to DuckDuckGo; no third-party search API is used.

---

## 💡 Use Cases

- **Content research**: Find web pages, images, news, and videos on any topic
- **AI Agent workflows**: Give your AI agent autonomous search capability
- **News monitoring**: Track current events with time-filtered news search
- **Data enrichment**: Add search results to your workflow data
- **Competitive intelligence**: Research competitors, products, or industries
- **Automated content curation**: Build workflows that discover and process fresh content

---

## 🤝 Contributing

This is an open-source project. Contributions are welcome:

- **Bug reports**: Open a GitHub issue with reproduction steps
- **Feature requests**: Describe the use case clearly
- **Pull requests**: Submit against the main branch

---

## 📄 License

MIT License — see the [LICENSE](LICENSE.md) file for details.

---

*Install the node and start searching with DuckDuckGo in your n8n workflows today.*
