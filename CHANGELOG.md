# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
