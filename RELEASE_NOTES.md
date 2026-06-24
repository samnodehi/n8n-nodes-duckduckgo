# v32.9.1 — Maintenance (dependencies & CI)

**Release Date:** 2026-06-24

A small maintenance release. No user-facing feature or behaviour changes.

---

## Highlights

- **Dependencies:** `axios` bumped 1.13.5 → 1.18.1 (bug and security fixes).
- **CI:** GitHub Actions updated — `actions/checkout` 4→7, `actions/setup-node` 4→6, and `softprops/action-gh-release` 2→3, clearing the deprecated Node 20 runner warnings.

## Compatibility

- No breaking changes; no change to the published node's runtime behaviour.

---

## Installation

```bash
npm install n8n-nodes-duckduckgo-search@32.9.1
```

---

# v32.9.0 — Page Metadata, Extract-from-URL, and Instant Answers

**Release Date:** 2026-06-24

Three free, no-key, no-new-dependency additions that make the node a fuller research toolkit.

---

## Highlights

- **New operation: Extract Page Content** — give the node any URL and it returns the page's main text (`content`) plus optional metadata. A "read any page" tool for AI Agents, using the same three-tier extractor as search.
- **New operation: Instant Answer** — DuckDuckGo's official free, no-key Instant Answer API: direct answers, Wikipedia-style abstracts, definitions, and related topics.
- **Page metadata for Fetch Page Content** — a new **Include Page Metadata** option adds `pageTitle`, `pageAuthor`, `pagePublished`, `pageExcerpt`, and `pageSiteName` to Web and News results when the page is an article.

---

## Notes

- All three are **free, need no API key, and add no paid or external dependencies** (they reuse axios + the existing extractor and DuckDuckGo's own endpoints).
- 🔒 The Extract Page Content operation fetches a third-party URL directly (like the opt-in Fetch Page Content). Instant Answer and search talk only to DuckDuckGo.

## Compatibility

- No breaking changes. The new operations and fields are additive; existing operations are unchanged.

---

## Validation

- `tsc`, ESLint, full suite (249 tests across 12 suites), `npm run build:prod`, and `verify-build` all pass. Verified live in n8n 2.27.3 (both new operations + metadata, against real pages and the Instant Answer API).

---

## Installation

```bash
npm install n8n-nodes-duckduckgo-search@32.9.0
```

---

# v32.8.0 — Page Content Extraction for News Search

**Release Date:** 2026-06-24

Extends the opt-in Fetch Page Content feature (added in 32.7.0 for Web Search) to **News Search**.

---

## Highlights

- **News Search now supports Fetch Page Content** (off by default). When enabled, the node fetches each article's page and extracts its main text into `pageContent`, with the same `pageContentMaxResults` / `pageContentMaxLength` / `pageContentTimeout` controls.
- Uses the same three-tier extractor (Mozilla Readability → linkedom DOM heuristic → regex) and per-result error handling as Web Search. Web and News now share a single enrichment path.

---

## Privacy

- Off by default. When enabled, the node fetches the third-party article pages — the only path that contacts non-DuckDuckGo hosts. Unchanged when off.

## Compatibility

- No breaking changes. The new fields (`pageContent`, `pageContentTruncated`, `pageContentError`) appear on News results only when the option is enabled.

---

## Validation

- `tsc`, ESLint, full suite (242 tests across 11 suites), `npm run build:prod`, and `verify-build` all pass. Verified live in n8n 2.27.3 against real news queries.

---

## Installation

```bash
npm install n8n-nodes-duckduckgo-search@32.8.0
```

---

# v32.7.0 — Optional Page Content Extraction (Web Search)

**Release Date:** 2026-06-23

Adds an opt-in way to get the full text of result pages, not just DuckDuckGo's short snippet.

---

## Highlights

- **New Web Search option: Fetch Page Content (off by default).** When enabled, the node fetches the top-N result pages and extracts their main readable text into a `pageContent` field.
- **Three-tier extraction for clean text:** Mozilla Readability (over a linkedom DOM) for article pages; a DOM heuristic that strips menus by link density when Readability finds no article; and a regex heuristic as a last resort.
- **Controls:** `pageContentMaxResults` (default 3), `pageContentMaxLength` (default 2000 chars, 0 = no limit), `pageContentTimeout` (default 8000 ms).
- **Resilient:** per-page failures (403, timeout, non-HTML) are reported via `pageContentError` and never abort the search; truncation is flagged with `pageContentTruncated`.

---

## Privacy

- The feature is **off by default**. When enabled, the node makes HTTP requests to the third-party result sites — the only path that contacts non-DuckDuckGo hosts. With it off, behaviour is unchanged (DuckDuckGo only).

## New dependencies

- `@mozilla/readability` and `linkedom` (both pure JS; loaded only when the feature runs).

---

## Compatibility

- No breaking changes. Existing workflows are unaffected; the new fields appear only when Fetch Page Content is enabled.

---

## Validation

- `tsc`, ESLint, full suite (242 tests across 11 suites), `npm run build:prod`, and `verify-build` all pass.

---

## Installation

```bash
npm install n8n-nodes-duckduckgo-search@32.7.0
```

---

# v32.6.0 — Dead Code Removal, Locale Cleanup, and Repo Hardening

**Release Date:** 2026-06-23

An internal cleanup pass: a large amount of dead, never-executed code is removed, locale handling is unified and corrected, and the repository is brought up to a professional standard. No new search capabilities are added.

---

## Highlights

- **~2,200 lines of dead, never-executed code removed** — 8 modules unreachable from the node (including an unused third-party SearchAPI.io client path with a hardcoded `demo-key`), their dead tests, and orphaned dependencies.
- **Locale handling unified and corrected.** The Region dropdowns now use only valid DuckDuckGo region codes; the previous default `en-us` was an invalid code that DuckDuckGo ignored. The default is now `wt-wt` (worldwide).
- **Redundant top-level Locale option removed** — locale is set per operation via the Region option.
- **Correct MIT license detection, a working package entry point, current CI actions, and new repo hygiene** (security policy, Dependabot, issue templates).

---

## Removed

- 8 dead modules: `apiClient`, `multiBackendSearch`, `reliabilityManager`, `searchFilters`, `rateLimiter`, `proxy`, `errorHandler`, `telemetry` (and their dead tests). The removed `apiClient`/`multiBackendSearch` contained an unused SearchAPI.io (third-party) path that never executed.
- Unused dependencies: `https-proxy-agent`, `socks-proxy-agent` (production), `uuid`, `@types/uuid`, `@types/express`, `@types/request-promise-native` (dev), and the `semantic-release` toolchain.
- The redundant top-level **Locale** node option (use the per-operation **Region** option instead).

## Changed

- **Default region is now `wt-wt` (worldwide)** instead of the previously invalid `en-us`.
- `main` now points at `dist/nodes/index.js`, so `require()` of the package resolves correctly.

## Fixed

- Restored canonical MIT license text so the license is detected as MIT (was "Other").

## Tests / CI

- Added unit tests for the `cache` and `processors` modules.
- Bumped GitHub Actions (`checkout` v4, `action-gh-release` v2); added Dependabot, a security policy, and issue templates.

---

## Compatibility

- Workflows continue to load and run. Saved values for the removed top-level `locale` option are silently ignored; the per-operation Region (or the `wt-wt` default) is used.
- The default search region changes from an ignored `en-us` to `wt-wt` (worldwide) when no region is explicitly selected.

---

## Validation

- `tsc`, ESLint, full suite (218 tests across 10 suites), `npm run build:prod`, and `verify-build` all pass.

---

## Installation

```bash
npm install n8n-nodes-duckduckgo-search@32.6.0
```

---

# v32.5.2 — News Fallback Quality and Image Source Fix

**Release Date:** 2026-05-18

---

## Highlights

- **News fallback now keeps the user query dominant** instead of using broad hard-coded news-site OR filters
- **News fallback results are now filtered by exact query-token relevance**
- **Short-token false positives are reduced**; `AI` only matches standalone `AI`, not unrelated words like `Taiwan`
- **Image Search now populates the `source` field** with the source page URL
- **Primary News Search failures now emit a diagnostic warning** before fallback

---

## Fixed

- Replaced broken fallback query construction that could return generic BBC/CNN/Reuters results unrelated to the user query
- Added token-level relevance filtering for fallback News results
- Preserved `n8n` as a valid query token for relevance filtering
- Added explicit support for standalone `AI` as a meaningful short token
- Populated Image Search `source` from the direct image result source URL

---

## Compatibility

- No migration required
- News fallback may return fewer results when generic fallback results do not match the user query
- Image Search output now has a more useful `source` value instead of an empty string

---

## Validation

- Targeted tests pass
- Full suite: 257 tests pass
- `npm run build:prod` passes

---

## Installation

```bash
npm install n8n-nodes-duckduckgo-search@32.5.2
```

---

# v32.5.1 — Search Result Quality Hotfix

**Release Date:** 2026-05-17

---

## Highlights

- **Sponsored/ad search results are now filtered** from direct Web Search and fallback parsing
- **DuckDuckGo redirect URLs are normalized** to final destination URLs
- **News fallback output no longer emits broken future dates** — `date` is now `null` when no real publication date exists
- **News fallback descriptions are preserved** when fallback body text exists
- **Inert Telemetry UI removed** — the `Enable Telemetry` option was a no-op; it is no longer shown

---

## Fixed

- `duckduckgo.com/y.js` ad redirects removed from Web Search and fallback output
- `bing.com/aclick` ad trackers removed
- `ad_provider`, `ad_type`, `ad_domain` query param URLs removed
- `/l/?uddg=` redirect wrappers decoded safely to final destination URLs
- Decoded redirect targets re-checked for ads so ads cannot hide inside `uddg`
- No double-decode of `uddg` values, preserving percent-encoded URL content
- No more `https:////duckduckgo.com/...` malformed fallback URLs
- News fallback `date` now `null` when no real publication date exists (was a synthetic millisecond timestamp producing year ~58344)
- News fallback `description` now maps from fallback body text (was `null` even when body was available)

---

## Removed

- `Enable Telemetry` UI option removed — telemetry is a no-op and no analytics are sent

---

## Compatibility

- No migration required for normal workflows
- Stale saved `enableTelemetry` values are silently ignored
- Output quality improves by excluding sponsored/tracker URLs
- News fallback `date` may now be `null` instead of an invalid synthetic future date

---

## Validation

- Targeted tests pass
- Full suite: 242 tests pass
- `npm run build:prod` passes

---

## Installation

```bash
npm install n8n-nodes-duckduckgo-search@32.5.1
```

---

# v32.5.0 — Accuracy, Trust, and Agent Output Cleanup

**Release Date:** 2026-05-17

This release cleans up a significant amount of inert, misleading, and incorrect node behavior that had accumulated over previous major versions. The result is a smaller, more accurate, and more trustworthy package. No new search capabilities are added; existing search capabilities are now correctly documented and reliably wired.

---

## Highlights

- **No API key or credential required or registered.** The fake `DuckDuckGoApi` credential type has been removed from the node entirely. n8n will not prompt for credentials.
- **No outbound telemetry.** The telemetry path is a confirmed no-op. No query data, result data, or execution metadata is sent anywhere except DuckDuckGo's search endpoints.
- **Cleaner AI Agent-ready output.** Web Search results no longer include duplicate or empty fields. Output field names are now correct and consistent across all four operation types.
- **News and video fallback results are now labeled.** When the primary search path fails and the fallback path is used, every result carries `isFallback: true` and a labeled source field (`syndicate` for news, `publisher` for video).
- **Better image and web error handling.** Image VQD token failures, HTTP 403 blocks, and web HTML parser regressions now produce specific, actionable error messages rather than silently failing or returning fake data.
- **Smaller, cleaner package.** Compiled tests and credential files are excluded from the published tarball. Unused production dependencies removed.

---

## Breaking / Migration Notes

> **Stale saved workflow values for all removed options are silently ignored at runtime. No workflow migration is required unless a workflow was depending on these fields having an effect — they did not.**

### Output field changes

| Field | Change | Action |
|-------|--------|--------|
| `snippet` (Web Search) | **Removed** | Use `description` — identical content |
| `favicon` (Web Search) | **Removed** | Was always an empty string; remove any references |

### Removed UI options

The following options appeared in the node UI but had no effect on search execution and have been removed:

| Option | Reason |
|--------|--------|
| `useApiKey` | DuckDuckGo has no public search API; the credential was never read |
| `searchBackend` | Only the direct HTML backend is used; the selector had no dispatch logic |
| `proxySettings` | Exposed in the UI but never read or applied by the runtime |
| `reliabilitySettings` | Manager was initialised but search calls were never wrapped with retry or circuit-breaker logic |
| Separate `searchFilters` collection | Exposed in UI but never read or applied |
| Web Search `timePeriod` | Date filter parameter was not included in the web search request body |
| Image filter options (`size`, `color`, `type`, `layout`) | `i.js` filter behavior is undocumented; smoke testing showed unreliable and silent results |
| Video filter options (`duration`, `resolution`, `publishedTime`) | Removed along with the inert filter/reliability wiring |

### Credential removed

The `DuckDuckGoApi` credential type is no longer registered. `n8n.credentials` is now an empty array. Existing workflows with `useApiKey: true` are unaffected — no credential lookup was ever performed.

### Output field name corrections

Previous README documentation used incorrect field names. The actual processor output has always used the names in the **Correct name** column. Any workflow already reading these fields correctly is unaffected.

| Operation | Incorrect (old docs) | Correct |
|-----------|---------------------|---------|
| News | `publishedDate` | `date` |
| News | `source` | `syndicate` |
| Video | `thumbnail` | `imageUrl` |
| Video | `publishedDate` | `published` |
| Video | `views` | `viewCount` |
| Video | `source` | `publisher` |
| Image | `thumbnail` | `thumbnailUrl` |

---

## Fixed

- **News/video fallback overwrite bug.** When primary news or video search failed and the fallback succeeded, the fallback result was being overwritten by a subsequent error item in the output array. Fixed: fallback success is no longer clobbered.
- **Duck-duck-scrape generic server error.** The `"A server error occurred!"` string from `duck-duck-scrape` is now caught and re-surfaced with a specific, user-readable message identifying the source.
- **Image VQD-missing no longer returns fake image URLs.** When the VQD token could not be extracted, previous behavior produced a result item with an empty or placeholder `imageUrl`. Now produces a named error: `DuckDuckGo image search token (VQD) could not be extracted. Image search may be temporarily unavailable. Please try again later.`
- **Web parser-failure detection.** `directWebSearch` now distinguishes between a genuine no-results response and a structural parser failure (HTTP 200, large body, zero parseable result blocks). A parser failure now throws a specific named error rather than returning an empty array silently.
- **Image HTTP 403 classification.** An HTTP 403 from the `i.js` image endpoint now produces a specific message: `DuckDuckGo image search returned 403 Forbidden. The search token (VQD) may have expired or the request was blocked. Please try again.`
- **Hardcoded year query mutation removed.** Previous versions appended the current year to some query strings before sending to DuckDuckGo. DuckDuckGo now receives the exact query the user entered.

---

## Added / Improved

- **`isFallback: boolean`** field on all News and Video results. `false` for primary results, `true` for fallback results.
- **`syndicate: "DuckDuckGo Fallback"`** on news fallback results.
- **`publisher: "DuckDuckGo Fallback"`** on video fallback results.
- **`position`** field on Web Search results (1-based rank).
- **Per-execution VQD reuse for image search.** When multiple input items in a single n8n execution share the same image query, the VQD token is reused rather than re-fetched. The VQD map is local to the execution and is not persisted.
- **README fully rewritten** to match actual runtime behavior, with correct output field names, accurate error descriptions, and no false reliability claims.

---

## Package / Dependency Cleanup

- **Compiled tests excluded from npm package.** `dist/nodes/DuckDuckGo/__tests__/` is no longer included in the tarball.
- **`dist/credentials/` excluded.** Credential compilation artifacts are excluded from the tarball and cleaned from the build output.
- **`dist/tsconfig.tsbuildinfo` excluded.**
- **`retry` removed from production dependencies.** Zero production imports; had no effect at runtime.
- **`uuid` moved to devDependencies.** Zero production imports; only used in Jest test mocks.
- **Package description updated** to remove false claims about enterprise reliability, adaptive backoff, circuit breaking, and intelligent rate limiting.
- **Packed size reduced** from ~119 kB to ~45 kB.

---

## Deferred

The following items were evaluated but deliberately deferred to a later release:

- **Image filters** — smoke-tested against the live `i.js` endpoint. The `f` parameter is undocumented; `size=Large` appeared to be silently ignored; invalid values return HTTP 200 with no error. Deferred until reliable behavior can be verified.
- **Web Search date filter (`df`)** — parameter name is known but must be verified against the live HTML endpoint before re-exposing in the UI.
- **Full proxy support** — the old `proxySettings` UI was inert (never applied to HTTP requests). Re-enabling requires a dedicated implementation and security/privacy review.
- **Reliability/circuit-breaker** — the old `reliabilitySettings` UI was inert. Re-enabling requires a design decision about which HTTP calls to wrap and how DuckDuckGo blocking behavior interacts with circuit-breaker state.

---

## Installation

```bash
npm install n8n-nodes-duckduckgo-search@32.5.0
```
