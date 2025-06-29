# 🎉 DuckDuckGo Search Node for n8n - Initial Release

## ✨ **Highlights**

**Multi-Search Capabilities:**
• Perform Web Search, Image Search, News Search, and Video Search – all from a single node.

**Fully Customizable Parameters:**
• Control locale, language, safe search levels, region, time period, and more.

**Privacy-First Approach:**
• Built on DuckDuckGo's privacy-respecting search engine — no personal data tracking.

**Official DuckDuckGo Icon:**
• Supports DuckDuckGo API key for enterprise-grade access (optional).

**Smart Caching System:**
• Intelligent response caching to improve performance and reduce redundant requests.

**Advanced Search Operators:**
• Full support for search operators like `site:`, `intitle:`, `filetype:`, and more.

**Comprehensive Error Handling:**
• Robust error management with detailed logging and fallback mechanisms.

**Rate Limiting & Throttling:**
• Built-in protections against API rate limits with automatic retry logic.

**Multi-Language Support:**
• Search in 50+ languages and regions with automatic locale detection.

**Rich Result Processing:**
• Clean HTML parsing, metadata extraction, and structured data output.

## 🧡 **Improvements**

**Modular Codebase:**
• Clean separation of logic across utilities, processors, types, and constants.

**Enhanced Testing Suite:**
• Comprehensive unit tests for all search types with mocks and cache simulations.

**Optimized Build Process:**
• Only minimal, production-ready code is shipped inside the dist/ directory.

**Developer Friendly:**
• Detailed README, clear typings, and well-documented codebase.

**CI-Ready:**
• GitHub Actions workflow included for future test automation.

## 🐛 **Bug Fixes**

• **Critical**: Fixed `Cannot read properties of null (reading '1')` error in regex matching
• Fixed memory leaks in cache implementation
• Fixed incorrect handling of empty search results
• Improved error messaging for network and rate limit issues
• Proper parsing of non-English content

## 📦 **Installation**

Follow the instructions in the [README](https://github.com/samnodehi/n8n-nodes-duckduckgo/blob/main/README.md) or use manual Docker volume mounting for easy setup.

## 🙏 **Huge Thanks**

Big thanks to the open-source community and the n8n ecosystem for empowering automation everywhere!

## 🛡️ **License**

Licensed under the [MIT License](https://github.com/samnodehi/n8n-nodes-duckduckgo/blob/main/LICENSE.md).

## 🏷️ **Tag**
📍 v24.6.25 
