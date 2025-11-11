# v31.0.0 - AI Agent-Ready & Production-Grade Release

## 🚀 Major Release

This is a transformative upgrade that makes the DuckDuckGo Search node **AI Agent-ready** with **enterprise-grade reliability** features.

## ✨ New Features

### 🤖 AI Agent Integration
- **Agent Tool Support**: Use as a tool in n8n AI Agent workflows
- **LLM-Optimized Interface**: Clean, structured output perfect for AI consumption
- **Autonomous Search**: Let AI agents search and process results automatically
- **Enable**: Set `N8N_COMMUNITY_PACKAGES_ALLOW_TOOL_USAGE=true`

### 🛡️ Advanced Reliability System
- **Adaptive Backoff**: Automatically backs off on consecutive empty results
- **Circuit Breaker**: Prevents cascading failures with automatic recovery
- **Jittered Delays**: Prevents thundering herd in parallel execution
- **Retry Logic**: Configurable retries with exponential backoff
- **Metrics Tracking**: Monitor performance, failures, and circuit state

### ⚙️ Configurable Reliability
- Empty Result Threshold (default: 3)
- Backoff Settings (1s initial, 30s max)
- Jitter Range (100-500ms)
- Circuit Breaker (5 failure threshold, 60s reset)
- Retry Behavior (3 max retries, 1s delay)

## 🔧 Improvements

### Performance
- Optimized parallel request handling
- Reduced rate limiting through intelligent backoff
- Better resource utilization
- Improved response times under load

### Stability
- Handles bursty workloads gracefully
- Prevents cascading failures
- Automatic recovery from transient errors
- Resilient to DuckDuckGo rate limits

### Developer Experience
- 132 passing tests (35 new reliability tests)
- Production-ready error handling
- Clear operational signals
- Extensive documentation

## 📊 Technical Details

### New Modules
- `reliabilityManager.ts`: Complete reliability management system
- Comprehensive test coverage
- Global reliability manager for coordination

### Backward Compatibility
✅ **Zero Breaking Changes** - All new features are opt-in with sensible defaults

## 🎯 Use Cases

### AI Agent Workflows
- Use as search tool in AI agent workflows
- Reliable results for agent decision-making
- Structured data for LLM processing

### High-Volume Search
- Handle parallel searches from multiple workflows
- Automatic rate limit management
- Graceful degradation under load

### Production Workloads
- Enterprise-grade reliability
- Automatic failure recovery
- Performance monitoring

## 📦 Installation

```bash
npm install n8n-nodes-duckduckgo-search@31.0.0
```

Or via n8n Community Nodes interface.

## 🚀 Quick Start with AI Agents

1. Set environment variable: `N8N_COMMUNITY_PACKAGES_ALLOW_TOOL_USAGE=true`
2. Create an AI Agent node in your workflow
3. Add DuckDuckGo Search as a tool
4. Let your agent autonomously search!

## 📚 Documentation

- [README](README.md) - Complete usage guide
- [CHANGELOG](CHANGELOG.md) - Detailed changes
- [Reliability Manager Tests](nodes/DuckDuckGo/__tests__/reliabilityManager.test.ts) - Implementation examples

## 🧪 Testing

All 132 tests passing:
- 97 existing tests maintained
- 35 new reliability tests added
- Zero failures, zero errors
- Comprehensive coverage

## 💡 What's Next

Future enhancements may include:
- Enhanced agent tool schemas
- Additional search backends
- Performance optimizations
- Extended metrics

## 🙏 Acknowledgments

This release maintains the privacy-focused, no-API-key approach while adding production-grade reliability for enterprise use.

---

**Ready to use immediately** - Backward compatible, fully tested, production-ready! 🎉
