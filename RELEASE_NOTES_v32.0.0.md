# Release Notes v32.0.0 - Major Simplification

## 🚀 Overview

Version 32.0.0 is a **major refactoring release** that dramatically simplifies the DuckDuckGo Search node while improving performance and maintainability. This release follows the "less is more" philosophy - keeping only essential features for a lightweight, fast experience.

## ✨ What's New

### Core Philosophy Change
- **90% Code Reduction**: Main file reduced from 2,944 lines to ~300 lines
- **Essential Parameters Only**: Kept only the 7 parameters users actually need
- **Zero Overhead**: Removed caching, telemetry, and reliability systems
- **Single Dependency**: Only `duck-duck-scrape` - removed 8 other packages

### Parameters Kept (The Essentials)
✅ **Operation** - Search type (web, images, news, videos)  
✅ **Locale** - Language/region setting  
✅ **Search Query** - Your search terms  
✅ **Maximum Results** - Result limit (1-50)  
✅ **Region** - Geographic targeting  
✅ **Safe Search** - Content filtering (Strict/Moderate/Off)  
✅ **Time Period** - Time range filter (All Time/Day/Week/Month/Year)

## 🗑️ What Was Removed

### Features Removed for Simplicity
- ❌ Search Operators (site:, filetype:, intitle:, etc.)
- ❌ Multi-Backend Search (auto, html, lite backends)
- ❌ Proxy Settings (HTTP, HTTPS, SOCKS4, SOCKS5)
- ❌ Cache System (enable cache, TTL)
- ❌ Telemetry (anonymous usage tracking)
- ❌ Reliability Manager (adaptive backoff, circuit breaker, jitter)
- ❌ VQD Pagination (complex pagination)
- ❌ Debug Mode (detailed logging)
- ❌ Error Handling Options (break vs continue)
- ❌ Return Raw Results (raw API responses)
- ❌ API Key Authentication (credentials)
- ❌ Search Backend Selection

### Files Deleted
**19 files removed**, including:
- Complex modules: `apiClient.ts`, `cache.ts`, `reliabilityManager.ts`, `telemetry.ts`
- Support files: `proxy.ts`, `rateLimiter.ts`, `errorHandler.ts`, `errors.ts`
- Advanced features: `searchOperators.ts`, `searchFilters.ts`, `vqdPagination.ts`
- Implementations: `directSearch.ts`, `fallbackSearch.ts`, `multiBackendSearch.ts`, `htmlParser.ts`

### Dependencies Removed
- `axios` - Custom HTTP client
- `https-proxy-agent` - Proxy support
- `socks-proxy-agent` - Proxy support
- `uuid` - Session tracking
- `retry` - Retry logic
- `@types/express`, `@types/request-promise-native`, `@types/uuid`

## 📊 Impact & Benefits

### Performance Improvements
- ⚡ **Faster Execution**: No overhead from caching/telemetry
- 💾 **Lower Memory**: Reduced footprint
- 🚀 **Quick Response**: Simplified error handling
- 📦 **Smaller Package**: 90% less code

### Developer Experience
- 🔍 **Easier to Understand**: Clean, focused codebase
- 🐛 **Easier to Debug**: Simpler logic flow
- 🧪 **Better Testing**: 9 focused tests
- 📝 **Clearer Docs**: No complex features to explain

### User Experience
- ⚙️ **Simpler Config**: Only 7 essential parameters
- 🎯 **Predictable**: Direct use of `duck-duck-scrape`
- 📊 **Clear Results**: No extra metadata overhead
- ✅ **Reliable**: Proven library, no custom layers

## ⚠️ Breaking Changes

### Migration Required For:

1. **Search Operators Users**
   - **Before**: Used `useSearchOperators` parameter
   - **After**: Apply operators directly in query string
   - **Example**: `query: "site:github.com typescript"`

2. **Proxy Users**
   - **Before**: Configured proxy in node settings
   - **After**: Configure proxy at system/network level

3. **Cache Users**
   - **Before**: Used built-in cache system
   - **After**: Implement caching in workflow logic

4. **Reliability Features Users**
   - **Before**: Used adaptive backoff, circuit breaker
   - **After**: Use n8n's built-in retry logic

5. **Debug Mode Users**
   - **Before**: Enabled debug mode for logging
   - **After**: Use n8n's execution logging

## 🎯 Design Philosophy

This release embraces simplicity:
- **Simple**: Only what you need
- **Fast**: No unnecessary overhead
- **Maintainable**: Clean, focused code
- **Reliable**: Direct use of proven library

## 📈 Metrics

- **Code Reduction**: 90% fewer lines (2,944 → ~300)
- **Files Removed**: 19 files deleted
- **Dependencies Removed**: 8 packages removed
- **Package Size**: ~60KB (down from ~200KB)
- **Test Coverage**: 9 essential tests, all passing

## 🔄 Upgrade Guide

### If You're Using:

**Basic Search** ✅ No changes needed  
**Search Operators** → Add to query string  
**Proxy** → Configure at system level  
**Cache** → Implement in workflow  
**Reliability Features** → Use n8n retries  
**Debug Mode** → Use n8n logging  

## 🚀 Getting Started

```bash
# Update to v32.0.0
npm install n8n-nodes-duckduckgo-search@32.0.0

# Or in n8n UI
Settings → Community Nodes → Update
```

## 📝 Full Changelog

See [CHANGELOG.md](./CHANGELOG.md) for complete details.

## 🙏 Thank You

Thank you for using the DuckDuckGo Search node. This major simplification makes the node faster, more maintainable, and easier to use for everyone.

---

**Questions?** Open an issue on [GitHub](https://github.com/samnodehi/n8n-nodes-duckduckgo/issues)
