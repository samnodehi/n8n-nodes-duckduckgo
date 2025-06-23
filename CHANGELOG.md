# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.3.0] - 2025-01-20

### Added

#### Proxy Support
- **Multiple Proxy Types**: HTTP, HTTPS, SOCKS4, and SOCKS5 proxy support
- **Proxy Authentication**: Username/password authentication for proxies
- **Automatic Application**: Proxy settings automatically applied to all API requests
- **Connection Testing**: Built-in proxy connection validation
- **Flexible Configuration**: Easy-to-use UI for proxy setup

#### Advanced Search Filters
- **Region Filtering**: 
  - 50+ countries and regions supported
  - Locale-specific search results
  - Examples: United States, United Kingdom, Germany, Japan, etc.
- **Language Filtering**:
  - Filter results by content language
  - Support for 35+ languages
  - Includes major languages like English, Spanish, French, Chinese, Arabic
- **Date Range Filtering**:
  - Predefined ranges: Last day, week, month, year
  - Custom date range support (YYYY-MM-DD format)
  - Historical content search capability
- **Safe Search Enhancement**:
  - Three levels: Strict, Moderate, Off
  - Better control over adult content filtering

### Changed

- Enhanced search filters UI in the node configuration
- Improved parameter organization with proxy and filter collections

### Fixed

- Proxy agent type definitions for better TypeScript support

## [1.2.0] - 2025-01-20

### Added

#### Rate Limiting System
- **Smart Rate Limiter Class**: Configurable rate limits per operation type
  - Web Search: 30 requests/minute with 1s delay
  - Instant Answer: 100 requests/minute with 0.5s delay  
  - Dictionary: 60 requests/minute with 0.5s delay
  - Stocks: 20 requests/minute with 2s delay
  - Currency: 50 requests/minute with 0.5s delay
- **Burst Allowance**: Extra requests allowed for short bursts
- **Global Rate Tracking**: Overall limit of 100 requests/minute across all operations
- **Automatic Retry**: Wait and retry when rate limited
- **Exponential Backoff**: Progressive delays for repeated failures

#### Enhanced Error Handling
- **Custom Error Classes**:
  - `DuckDuckGoError`: Base error class with severity levels
  - `RateLimitError`: Specific handling for rate limit errors
  - `NetworkError`: Network connection issues with auto-detection
  - `ValidationError`: Input validation errors with field details
  - `APIError`: API response errors with status codes
- **Error Type Enum**: 18 different error types for precise categorization
- **User-Friendly Messages**: Clear, actionable error messages
- **Retryable Error Detection**: Automatic detection of errors that can be retried
- **Technical Details**: Debug information available when debug mode is enabled

### Changed

- All operations now apply rate limiting automatically
- Improved error messages across all operations
- Better handling of network timeouts and connection issues

### Fixed

- Prevent rate limit errors from DuckDuckGo API
- Better error recovery and retry logic

## [1.1.0] - 2025-01-19

### Added
- **Instant Answer API Integration**: New operation type that provides access to DuckDuckGo's Instant Answer API
  - Get quick answers, definitions, calculations, and summaries
  - Support for direct answers, Wikipedia abstracts, definitions, and more
  - Configurable options: `noRedirect`, `noHtml`, `skipDisambig`
- **Comprehensive Instant Answer Types**:
  - Direct answers (e.g., "What is the capital of France?")
  - Calculations (e.g., "sqrt(16)")
  - Definitions (e.g., "define serendipity")
  - Wikipedia summaries
  - Unit conversions
  - Related topics and results
- **Search Operators**: Advanced search operators for precise web searches
  - Site-specific searches with `site:` (e.g., `site:github.com`)
  - File type filtering with `filetype:` (pdf, doc, xls, etc.)
  - Title searches with `intitle:`, `allintitle:`
  - URL searches with `inurl:`, `allinurl:`
  - Content searches with `inbody:`, `allintext:`
  - Exclusion with `-` prefix
  - Exact phrase matching with quotes
  - OR logic for alternative terms
  - Location, language, and region operators
  - And many more advanced operators
- **Search Operator Validation**: Built-in validation for operator values
  - Validates file types, region codes, language codes
  - Ensures proper IP address format
  - Checks prefer values (newer/older)
- **Improved Pagination with VQD Token**: Enhanced pagination system with smart token management
  - VQD token caching for reuse across similar queries
  - Automatic token refresh on expiration or error
  - Progressive delays to avoid rate limiting
  - Support for fetching up to 100 results
  - Better error handling with retry logic
  - Fallback to HTML scraping when API limits are reached
- **Enhanced Test Coverage**: Added unit tests for Instant Answer, Search Operators, and VQD Pagination functionality
- **Dictionary Operation**: Get word definitions with comprehensive linguistic information
  - Multiple definitions per word
  - Part of speech identification
  - Usage examples
  - Synonyms and antonyms
  - Attribution to Wordnik
- **Stock Market Data**: Real-time stock quotes with market statistics
  - Current price and price changes
  - Daily high/low and 52-week ranges
  - Market cap and P/E ratio
  - Trading volume
  - Data from Xignite
- **Currency Conversion**: Live exchange rates for international transactions
  - Support for 50+ major currencies
  - Bidirectional conversion
  - Real-time rates from XE
  - Currency name information

### Changed
- **Telemetry Improvements**: 
  - Telemetry is now opt-in by default
  - Removed default telemetry endpoint
  - Better privacy controls
- **Code Organization**: 
  - Modular structure with separate files for Instant Answer, Search Operators, and VQD Pagination functionality
  - Better separation of concerns
- **Web Search Enhancement**:
  - Web search now supports advanced query building with operators
  - Enhanced query validation and error handling
  - Improved debugging for complex search queries
  - Better pagination with VQD token management
  - More efficient result fetching with caching

### Fixed
- Fixed telemetry endpoint configuration issue
- Improved error handling for all operations
- Better debug logging for troubleshooting

## [1.0.0] - Previous version

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

[Unreleased]: https://github.com/hapheus/n8n-nodes-duckduckgo/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/hapheus/n8n-nodes-duckduckgo/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/hapheus/n8n-nodes-duckduckgo/releases/tag/v1.0.0 
