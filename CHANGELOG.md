# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> **Compatibility note:** Earlier changelog entries described reliability modules and UI options (adaptive backoff, circuit breaker, retry logic, reliability settings) that were later found not to affect runtime search execution. In 32.5.0, those inert options are removed and the documentation now reflects actual runtime behavior.

---

## [32.6.0] - 2026-06-23

### Removed

- Removed 8 dead modules never reachable from the node entry point
  (`apiClient`, `multiBackendSearch`, `reliabilityManager`, `searchFilters`,
  `rateLimiter`, `proxy`, `errorHandler`, `telemetry`) and their dead tests.
  The removed `apiClient`/`multiBackendSearch` code contained an unused
  third-party SearchAPI.io client path; it never executed and is now gone.
- Dropped unused dependencies: `https-proxy-agent`, `socks-proxy-agent`
  (production), `uuid`, `@types/uuid`, `@types/express`,
  `@types/request-promise-native` (dev), and the `semantic-release`
  toolchain (with `.releaserc`), which CI no longer used.
- Removed the redundant top-level **Locale** node option; locale is now
  set per operation via the **Region** option (saved `locale` values are
  silently ignored).

### Changed

- **Default locale/region is now `wt-wt` (worldwide).** The global Locale
  dropdown now uses the same correct DuckDuckGo region codes as the
  per-operation Region option; the previous default `en-us` was an invalid
  code that DuckDuckGo silently ignored.
- `main` now points at `dist/nodes/index.js`, so `require()` of the package
  resolves correctly.

### Fixed

- Restored canonical MIT license text so the project license is detected
  as MIT.

### Tests / CI

- Added unit tests for the `cache` and `processors` modules.
- Bumped GitHub Actions (`checkout` v4, `action-gh-release` v2); added
  Dependabot config, a security policy, and issue templates.

---

## [32.5.2] - 2026-05-18

### Fixed

- Improved News fallback query construction by replacing the broken hard-coded `site:` OR chain with a user-query-dominant `${query} news` fallback
- Added exact token-level relevance filtering for News fallback results to prevent unrelated generic BBC/CNN-style results
- Prevented short-token substring false positives, e.g. `AI` no longer matches unrelated words like `Taiwan`, `said`, or `again`
- Preserved meaningful short query token `AI` as an explicit exact-token match
- Populated Image Search `source` from the image source page URL instead of returning an empty string
- Added diagnostic warning when primary News Search fails before fallback is attempted

### Tests

- Added News fallback query-construction tests
- Added News fallback relevance-filter tests for `n8n` and `AI`
- Added Image Search `source` field regression test
- Full suite: 257 tests passing

---

## [32.5.1] - 2026-05-17

### Fixed

- Filter sponsored/ad URLs from direct Web Search results (`duckduckgo.com/y.js`, `bing.com/aclick`, ad query params)
- Normalize DuckDuckGo `/l/?uddg=` redirect URLs to final destination URLs
- Prevent malformed `https:////duckduckgo.com/...` fallback URLs
- Re-filter decoded redirect targets so ads hidden inside `uddg` are dropped
- Fix News fallback dates: use `date: null` instead of synthetic millisecond timestamps
- Fix News fallback descriptions: preserve fallback body text when available

### Removed

- Removed inert `Enable Telemetry` UI option
- Removed telemetry runtime reads/call sites from the node execution path

### Tests

- Added direct web-search ad/redirect normalization coverage
- Added fallback parser ad/redirect normalization coverage
- Added News fallback date/description regression coverage
- Added stale `enableTelemetry` regression coverage
- Full suite: 242 tests passing

---

## [32.5.0] - 2026-05-17

### Breaking / Migration

- `snippet` field removed from Web Search output — use `description` (identical content)
- `favicon` field removed from Web Search output — was always an empty string
- `DuckDuckGoApi` credential type removed from package registration (`n8n.credentials: []`)
- Removed UI options (silently ignored if present in saved workflow JSON — no migration required):
  - `useApiKey` — credential was never read
  - `searchBackend` — dispatch logic was never implemented
  - `proxySettings` — proxy agent was never applied to HTTP requests
  - `reliabilitySettings` — search calls were never wrapped with retry or circuit-breaker logic
  - Separate `searchFilters` collection — never read or applied
  - Web Search `timePeriod` — `df` parameter was not included in the request body
  - Image filter options (`size`, `color`, `type`, `layout`) — `i.js` filter behavior is undocumented and unreliable
  - Video filter options (`duration`, `resolution`, `publishedTime`) — removed with inert filter wiring

### Removed

- `credentials/DuckDuckGoApi.credentials.ts` deleted
- Hardcoded year query mutation removed — DuckDuckGo receives the exact query string entered

### Fixed

- News/video fallback overwrite bug: fallback success was being clobbered by a subsequent error item in the output array
- Duck-duck-scrape generic `"A server error occurred!"` string now caught and re-surfaced with a specific message
- Image VQD-missing: no longer returns fake/empty image URLs; now throws a named error
- Image HTTP 403: classified with a specific, actionable error message
- Web parser-failure: HTTP 200 large-body parse failures now throw a named error instead of returning an empty result silently

### Added

- `isFallback: boolean` field on all News and Video result items
- `syndicate: "DuckDuckGo Fallback"` on news fallback results
- `publisher: "DuckDuckGo Fallback"` on video fallback results
- `position` field on Web Search results (1-based rank)
- Per-execution VQD reuse for repeated same-query image searches (reduces redundant page GETs within one execution)

### Changed

- Package description updated to remove false enterprise reliability claims
- README fully rewritten: correct output field names, accurate error descriptions, no false reliability/filter/backend/credential claims
- All 214 tests passing

### Package

- `retry` removed from production dependencies (zero production imports)
- `uuid` moved to devDependencies (zero production imports; test-only)
- Compiled tests excluded from npm package (`dist/nodes/DuckDuckGo/__tests__/`)
- `dist/credentials/` excluded from npm package
- `dist/tsconfig.tsbuildinfo` excluded from npm package
- Packed size: ~45 kB (reduced from ~119 kB)

### Deferred

- Image filters: `i.js` `f` parameter is undocumented; smoke testing showed silent failures — deferred to a future release
- Web Search date filter (`df`): needs live verification before re-exposing in UI
- Full proxy support: requires dedicated implementation and security/privacy review
- Reliability/circuit-breaker: requires design decision before re-implementation

---



## [32.4.1] - 2026-02-13

### Documentation

- Remove internal docs (RELEASE_CHECKLIST, UPDATE_PLAN_STATUS)
- README: Remove version-specific labels
- Minor cleanup

---

## [32.4.0] - 2026-02-13

### Dependencies

**Upgrades**
- TypeScript 4.8 → 5.4
- Node.js engines: >=16 → >=18
- n8n-core, n8n-workflow: 1.14.1 → ^2.8.0
- axios: ^1.9.0 → ^1.13.0 (resolutions aligned)
- devDependencies: @semantic-release/*, glob, gulp, ts-jest, @types/request-promise-native, etc.
- eslint-plugin-n8n-nodes-base: ^1.16.6

**Documentation**
- README: Search backends section (Web/Image vs News/Video)
- README: Enhanced Empty Results troubleshooting with backend + reliability tips

### Compatibility

- n8n 2.x compatible
- TypeScript 5.x
- Node.js 18+

---

## [31.0.0] - 2025-11-11

### 🚀 **Major Release - Agent-Ready & Production-Grade Reliability**

This is a major upgrade that transforms the DuckDuckGo Search node into a production-grade, AI Agent-ready tool with enterprise-level reliability features.

#### ✨ **New Features:**

**🤖 AI Agent Integration**
- **Agent Tool Support**: Node is now usable as an AI Agent tool in n8n workflows
- **Simplified Interface**: Clean, minimal input contract optimized for LLM consumption
- **Structured Output**: Predictable output format designed for agent consumption
- **Tool Description**: AI-friendly parameter descriptions for better agent understanding
- Enable via environment variable: `N8N_COMMUNITY_PACKAGES_ALLOW_TOOL_USAGE=true`

**🛡️ Advanced Reliability System**
- **Adaptive Backoff**: Automatically backs off when consecutive empty results are detected
- **Jittered Delays**: Random jitter prevents thundering herd problems in parallel execution
- **Circuit Breaker**: Automatic failure detection and recovery mechanism
- **Retry Logic**: Configurable retry attempts with exponential backoff
- **Operational Metrics**: Real-time tracking of requests, failures, and performance

**⚙️ Reliability Configuration**
- Empty Result Threshold: Configure when to trigger adaptive backoff
- Backoff Settings: Control initial delay, maximum delay, and multiplier
- Jitter Range: Set minimum and maximum random delays
- Circuit Breaker: Configure failure threshold and reset timeout
- Retry Behavior: Set maximum retries and delay between attempts

**📊 Observability & Monitoring**
- Circuit state monitoring (CLOSED, OPEN, HALF_OPEN)
- Request and response metrics tracking
- Average response time calculation
- Empty response rate tracking
- Backoff activation counts
- Circuit breaker trip events
- Retry attempt tracking

#### 🔧 **Improvements:**

**Performance**
- Optimized parallel request handling
- Reduced rate limiting issues through intelligent backoff
- Better resource utilization with circuit breaking
- Improved response times under load

**Stability**
- Handles bursty workloads gracefully
- Prevents cascading failures with circuit breaker
- Automatic recovery from transient errors
- Resilient to DuckDuckGo rate limits

**Developer Experience**
- Comprehensive test suite (132 passing tests)
- Production-ready error handling
- Clear operational signals
- Extensive documentation

#### 📚 **Technical Enhancements:**

**New Modules**
- `reliabilityManager.ts`: Complete reliability management system
- Comprehensive test coverage for reliability features
- Global reliability manager for cross-request coordination

**Configuration**
- Backward compatible - all features are opt-in
- Sensible defaults that work out of the box
- Fine-tuning options for advanced use cases

#### 🎯 **Use Cases:**

**AI Agent Workflows**
- Use as a search tool in AI agent workflows
- Reliable search results for agent decision-making
- Structured data perfect for LLM processing

**High-Volume Search**
- Handle parallel searches from multiple workflows
- Automatic rate limit management
- Graceful degradation under load

**Production Workloads**
- Enterprise-grade reliability
- Automatic failure recovery
- Performance monitoring

#### ⚡ **Breaking Changes:**

None - this release maintains full backward compatibility while adding new opt-in features.

#### 🐛 **Bug Fixes:**

- Improved handling of empty result scenarios
- Better error messages for rate limiting
- Enhanced parallel request coordination

#### 📦 **Dependencies:**

No new external dependencies added - all reliability features built with native capabilities.

---

## [30.0.4] - 2025-06-29

### 🎉 **Initial Release - Complete DuckDuckGo Search Integration for n8n**

#### ✨ **Core Features:**

**🔍 Web Search**
- Advanced web search with comprehensive result parsing
- Support for multiple result formats (title, URL, description, hostname)
- Intelligent query enhancement for better search results
- Clean HTML content extraction with proper text normalization

**🖼️ Image Search**
- High-quality image search with thumbnail and full-size URLs
- Rich metadata including dimensions, source, and title
- Support for various image formats and sources
- Efficient image result processing

**📰 News Search**  
- Real-time news search from diverse sources
- Publication date and source information
- News-specific filtering and sorting options
- Clean news content extraction

**🎥 Video Search**
- Comprehensive video search across platforms
- Video metadata including duration, views, and publish date
- Thumbnail extraction and video source information
- Support for various video platforms

#### 🛠️ **Advanced Capabilities:**

**⚙️ Search Configuration**
- Customizable result limits (1-50 results per search)
- Multiple language and region support
- Safe search filtering options
- Search operator support for advanced queries

**🌐 Locale & Region Support**
- 50+ language/region combinations
- Automatic locale detection and handling
- Customizable regional search preferences
- Multi-language result processing

**🔧 Advanced Query Processing**
- Smart query enhancement and optimization  
- Search operator parsing (`site:`, `intitle:`, `filetype:`, etc.)
- Query validation and error handling
- Special character and encoding support

**🚀 Performance & Reliability**
- Built-in rate limiting and retry mechanisms
- Efficient HTTP client with timeout handling
- Comprehensive error handling and recovery
- Memory-efficient result processing

**🔒 Privacy & Security**
- No API keys required - completely free to use
- Direct DuckDuckGo integration without third-party services
- Privacy-focused search without user tracking
- Secure HTTP client configuration

#### 📊 **Technical Specifications:**

**🏗️ Architecture**
- TypeScript implementation with full type safety
- Modular design with separate search modules
- Comprehensive test coverage (97 tests)
- Clean code architecture following n8n standards

**🔌 Integration Features**
- Seamless n8n workflow integration
- Input/output parameter validation
- Error handling with descriptive messages
- Consistent data structure across all search types

**⚡ Performance**
- Optimized HTML parsing algorithms
- Efficient memory usage
- Fast response times
- Minimal dependencies

#### 🎯 **Use Cases:**

- **Content Research**: Gather comprehensive web content for analysis
- **Image Collection**: Build image databases and galleries
- **News Monitoring**: Track news and updates on specific topics  
- **Video Discovery**: Find relevant video content across platforms
- **SEO Research**: Analyze search results and content strategies
- **Market Research**: Gather competitive intelligence and trends
- **Academic Research**: Collect scholarly and reference materials

#### 🚀 **Getting Started:**

1. Install the node package in your n8n instance
2. Add the DuckDuckGo Search node to your workflow
3. Configure your search type and parameters
4. Execute and process the results

**Ready to use immediately - no setup or API keys required!**

---

*This project provides a complete, privacy-focused search solution for n8n workflows using DuckDuckGo's powerful search capabilities.* 
