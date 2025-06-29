# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [30.0.2] - 2025-06-29

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
