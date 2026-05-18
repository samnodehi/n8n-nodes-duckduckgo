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
