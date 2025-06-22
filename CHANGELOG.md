# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2025-01-18

### 🎉 Added
- **AI Chat Integration**: Private chat with GPT-3.5 Turbo, Claude 3 Haiku, Llama 3 70B, and Mixtral 8x7B models
- **Maps Search**: Search for locations and businesses (simulated implementation)
- **Shopping Search**: Product search with sorting options (simulated implementation)
- **Conversation Support**: Continue AI chat conversations with conversation IDs
- **Advanced Type Definitions**: Comprehensive TypeScript types for all new features
- **Enhanced Caching**: Improved cache system with better performance

### 🔧 Changed
- Updated TypeScript from 4.8.4 to 4.9.5
- Improved error handling and user-friendly error messages
- Enhanced telemetry system (now disabled by default)
- Better organization of code modules
- Updated dependencies to latest versions

### 🐛 Fixed
- Removed insecure telemetry endpoint
- Fixed npm audit vulnerabilities (axios and brace-expansion)
- Improved handling of empty search results
- Better debug logging throughout the application

### 🔒 Security
- Fixed telemetry endpoint security issue
- Updated axios to patch SSRF vulnerability
- Fixed brace-expansion ReDoS vulnerability

## [1.0.0] - Previous Release

## [25.4.27] - 2025-04-27

### Added
- DuckDuckGo search integration with n8n workflows
- Support for multiple search types (Web, Image, News, Video)
- Customizable search parameters including locale and safe search options
- Optional API key authentication for enterprise usage
- Comprehensive result processing for all search types

### Changed
- Improved error handling with detailed debugging information
- Enhanced caching system for better performance
- Response formatting optimized for workflow usage
- Better handling of rate limits and server errors

### Fixed
- Issue with search queries containing special characters
- Memory leak in caching implementation
- Incorrect handling of empty search results
- Parsing errors for non-English content
- Performance bottlenecks in result processing

[Unreleased]: https://github.com/hapheus/n8n-nodes-duckduckgo/compare/v25.4.27...HEAD
[25.4.27]: https://github.com/hapheus/n8n-nodes-duckduckgo/releases/tag/v25.4.27 
