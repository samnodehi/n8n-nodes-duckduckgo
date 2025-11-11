# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
