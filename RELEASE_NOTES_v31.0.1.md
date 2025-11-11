# v31.0.1 - CRITICAL FIX: Reliability System Now Functional

## 🚨 CRITICAL PATCH RELEASE

This is a **mandatory update** that fixes a critical bug in v31.0.0 where the entire reliability system was non-functional.

## 🐛 Critical Bug Fixed

### Problem in v31.0.0
The reliability manager was initialized but **never invoked**. All search requests bypassed the reliability system entirely:
- ❌ No adaptive backoff
- ❌ No jitter for parallel requests
- ❌ No circuit breaking
- ❌ No retry logic
- ❌ No metrics tracking

**All reliability features advertised in v31.0.0 were completely non-functional.**

### Solution in v31.0.1
✅ **Reliability manager now properly integrated** into all search operations:
- ✅ All HTTP requests wrapped with `executeWithRetry()`
- ✅ Adaptive backoff triggers on consecutive empty results
- ✅ Jittered delays prevent thundering herd
- ✅ Circuit breaker activates after failures
- ✅ Retry logic with exponential backoff functional
- ✅ Metrics tracking operational

## 🔧 Changes

### Code Integration
- **Web Search**: Wrapped `directWebSearch()` with reliability manager
- **Image Search**: Wrapped `directImageSearch()` with reliability manager
- **News Search**: Wrapped `searchNews()` with reliability manager
- **Video Search**: Wrapped `searchVideos()` with reliability manager

### Metrics & Observability
- Success/failure recording now functional
- Response time tracking operational
- Empty result detection working
- Circuit state properly managed

### Testing
- Added integration tests verifying reliability manager invocation
- Confirmed retry logic works correctly
- Validated metrics tracking functional

## 📊 Impact

### Who Should Upgrade
**EVERYONE** who installed v31.0.0 should immediately upgrade to v31.0.1.

### Breaking Changes
**None** - This is a pure bug fix with zero breaking changes.

### Backward Compatibility
Fully compatible with v31.0.0 configuration. All reliability settings now actually work as documented.

## 🚀 Installation

```bash
npm install n8n-nodes-duckduckgo-search@31.0.1
```

Or update via n8n Community Nodes interface.

## ✅ Verification

After upgrading, the reliability features will automatically activate:

1. **Empty Results**: After 3 consecutive empty results, adaptive backoff applies
2. **Parallel Requests**: Random jitter (100-500ms) prevents simultaneous requests
3. **Failures**: Circuit breaker opens after 5 consecutive failures
4. **Retries**: Failed requests retry up to 3 times with exponential backoff

Enable debug mode to see reliability manager logs:
```
Reliability Manager initialized: Circuit: CLOSED | Requests: 0 | Empty: 0 (0.00%) | ...
```

## 📝 Full Changelog

See [CHANGELOG.md](CHANGELOG.md) for complete details.

## 🙏 Apology

We apologize for this critical oversight in v31.0.0. The reliability system was thoroughly tested in isolation but the integration step was missed during final assembly. We've added integration tests to prevent similar issues in future releases.

---

**This is a critical security and stability patch. Please upgrade immediately.** 🔴
