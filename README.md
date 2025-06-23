# n8n-nodes-duckduckgo

[![npm version](https://img.shields.io/npm/v/n8n-nodes-duckduckgo-search.svg)](https://www.npmjs.com/package/n8n-nodes-duckduckgo-search)
[![npm downloads](https://img.shields.io/npm/dt/n8n-nodes-duckduckgo-search.svg)](https://www.npmjs.com/package/n8n-nodes-duckduckgo-search)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

<img src="nodes/DuckDuckGo/duckduckgo.svg" width="100" alt="DuckDuckGo Logo" />

**Integrate DuckDuckGo search seamlessly into your n8n workflows with advanced pagination, instant answers, and human-like behavior. Get more results without hitting rate limits.**

## Features

- **Multiple Search Types**: Web search, image search, news search, video search, instant answers, dictionary, stocks, and currency
- **Instant Answers**: Get quick answers, definitions, calculations, and summaries using DuckDuckGo's Instant Answer API
- **Dictionary Lookups**: Word definitions, synonyms, antonyms, and usage examples from Wordnik
- **Stock Market Data**: Real-time stock quotes with price, volume, and market statistics from Xignite
- **Currency Conversion**: Live exchange rates for 50+ currencies from XE
- **Advanced Pagination**: Smart pagination to get more results than standard API limits allow
- **Human-like Behavior**: Random delays and rotating user agents to avoid detection and rate limits
- **Customizable Parameters**: Control results with locale, safe search level, and time period filters
- **Privacy-Focused**: Leverages DuckDuckGo's privacy-oriented search engine
- **No Authentication Required**: Works out of the box without API keys
- **Optional API Authentication**: Supports API key for enterprise use cases
- **Rich Response Format**: Well-structured results with titles, URLs, snippets, and more

## What's New in v1.1.0 🎉

### 1. Instant Answer API
Get instant answers, definitions, calculations, and summaries directly from DuckDuckGo's Instant Answer API.

**Example Use Cases:**
- Get word definitions: "define quantum computing"
- Perform calculations: "sqrt(144) + 25^2"
- Get quick facts: "population of Tokyo"
- Unit conversions: "100 miles to kilometers"

### 2. Search Operators
Use advanced search operators to refine your web searches with precision.

**Available Operators:**
- `site:` - Search within a specific website
- `filetype:` - Find specific file types (pdf, doc, xls, etc.)
- `intitle:` - Search for words in page titles
- `inurl:` - Search for words in URLs
- `inbody:` - Search for words in page content
- `exclude` - Exclude specific words from results
- `exact` - Search for exact phrases
- `OR terms` - Search for any of multiple terms
- And many more!

**Example Searches:**
- Find PDFs on a specific site: `machine learning site:arxiv.org filetype:pdf`
- Search for tutorials: `n8n tutorial intitle:beginner -video`
- Find documentation: `"API reference" site:docs.n8n.io`

### 3. Enhanced Pagination with VQD Token
Get more search results with improved pagination that uses VQD tokens efficiently.

**Features:**
- Smart VQD token caching for better performance
- Automatic token refresh on expiration
- Progressive delay to avoid rate limiting
- Fallback to HTML scraping when needed
- Support for up to 100 results per search
- Better error handling and retry logic

### 4. Dictionary Lookups
Get comprehensive word information using Wordnik's dictionary data.

**Features:**
- Multiple definitions per word
- Part of speech identification
- Usage examples
- Synonyms and antonyms
- Attribution links

**Example Use Cases:**
- Vocabulary enrichment in educational workflows
- Content validation and proofreading
- Language learning applications

### 5. Stock Market Data
Real-time stock quotes and market information powered by Xignite.

**Available Data:**
- Current price and price changes
- Daily high/low
- 52-week high/low
- Market capitalization
- P/E ratio
- Trading volume

**Example Use Cases:**
- Portfolio monitoring workflows
- Market alerts and notifications
- Financial reporting automation

### 6. Currency Conversion
Live currency exchange rates from XE supporting 50+ major currencies.

**Supported Currencies Include:**
- Major currencies: USD, EUR, GBP, JPY, CHF, CAD, AUD
- Emerging markets: CNY, INR, BRL, MXN, ZAR
- And many more!

**Example Use Cases:**
- International pricing calculations
- Multi-currency reporting
- Exchange rate monitoring

## Installation

### Manual Installation via Docker Volume

1. Find your n8n Docker volume:
```bash
docker volume ls | grep n8n
```

2. Create a directory for custom nodes:
```bash
mkdir -p /path/to/your/n8n/custom/nodes/n8n-nodes-duckduckgo
```

3. Download and extract this repository to that directory

4. Add the custom nodes directory as a volume to your n8n Docker container:
```bash
docker run -it --rm \
  --name n8n \
  -p 5678:5678 \
  -v /path/to/your/n8n/custom:/home/node/.n8n/custom \
  n8nio/n8n
```

## Usage

### How to Use in a Workflow

1. Add a new node to your workflow
2. Search for "DuckDuckGo" in the node selector
3. Select the DuckDuckGo node
4. Configure the node settings:

### Parameter Setup

#### Required Parameters:
- **Operation**: Choose the type of search:
  - Web Search
  - Image Search
  - News Search
  - Video Search
  - **Instant Answer** (NEW!)
  - **Dictionary** (NEW!)
  - **Stock Quote** (NEW!)
  - **Currency Conversion** (NEW!)
- **Query**: Enter your search terms

#### Optional Parameters:
- **Locale**: Select language and region for search results (default: en-us)
- **Safe Search**: Control filtering of explicit content (Strict, Moderate, Off)
- **Max Results**: Limit number of results (default: 25, can fetch up to 100 with the advanced pagination)
- **Time Period**: Filter by time (All Time, Past Day, Past Week, Past Month, Past Year)

### Example Configuration:

Web Search:
```json
{
  "operation": "search",
  "query": "workflow automation tools",
  "webSearchOptions": {
    "maxResults": 10,
    "region": "en-us",
    "safeSearch": 1,
    "timePeriod": "pastMonth"
  }
}
```

Image Search:
```json
{
  "operation": "searchImages",
  "imageQuery": "automation workflow diagrams",
  "imageSearchOptions": {
    "maxResults": 5,
    "safeSearch": 1
  }
}
```

Instant Answer (NEW!):
```json
{
  "operation": "instantAnswer",
  "instantAnswerQuery": "what is the capital of France",
  "instantAnswerOptions": {
    "noRedirect": true,
    "noHtml": true,
    "skipDisambig": false
  }
}
```

Dictionary (NEW!):
```json
{
  "operation": "dictionary",
  "dictionaryWord": "serendipity"
}
```

Stock Quote (NEW!):
```json
{
  "operation": "stocks",
  "stockSymbol": "AAPL"
}
```

Currency Conversion (NEW!):
```json
{
  "operation": "currency",
  "currencyFrom": "USD",
  "currencyTo": "EUR",
  "currencyAmount": 100
}
```

## Instant Answer Examples

The Instant Answer feature can provide:

- **Direct Answers**: "What is the capital of France?" → "Paris"
- **Calculations**: "sqrt(16)" → "4"
- **Definitions**: "define serendipity" → Full dictionary definition
- **Summaries**: "Node.js" → Wikipedia summary with source link
- **Unit Conversions**: "10 miles to km" → "16.09344 kilometers"

## Development

Want to contribute to this project? Follow these steps to set up your development environment:

1. Clone the repository:
```bash
git clone https://github.com/hapheus/n8n-nodes-duckduckgo.git
```

2. Install dependencies:
```bash
cd n8n-nodes-duckduckgo
npm install
```

3. Build the code:
```bash
npm run build
```

4. Link to your local n8n installation for testing:
```bash
npm link
cd ~/.n8n/custom/
npm link n8n-nodes-duckduckgo
```

5. Run tests:
```bash
npm test
```

6. Make your changes and submit a pull request with a clear description of the improvements

## License

This project is licensed under the [MIT License](LICENSE.md).

## Recent Changes (v1.3.0)

### Proxy Support

- **Multiple Proxy Types**: Support for HTTP, HTTPS, SOCKS4, and SOCKS5 proxies
- **Authentication**: Built-in support for proxy authentication
- **Easy Configuration**: Simple UI to configure proxy settings
- **Universal Application**: Proxy applied to all API requests automatically

### Advanced Search Filters

- **Region Filtering**: Filter results by 50+ countries and regions
- **Language Filtering**: Filter results by content language
- **Date Range Filtering**: Filter by predefined ranges (day, week, month, year) or custom dates
- **Safe Search**: Control adult content filtering (strict, moderate, off)

## Previous Changes (v1.2.0)

### Rate Limiting & Error Handling

- **Smart Rate Limiting**: Automatic rate limit management with configurable limits per operation
- **Request Throttling**: Built-in delays between requests to prevent hitting rate limits
- **Burst Allowance**: Extra requests allowed for short bursts of activity
- **Global Rate Tracking**: Overall request tracking across all operations

- **Enhanced Error Handling**: Custom error classes for better error categorization
- **User-Friendly Messages**: Clear, actionable error messages for users
- **Retryable Errors**: Automatic detection of errors that can be retried
- **Debug Information**: Technical details available in debug mode

## Previous Changes (v1.1.0)

### New Features

- **Instant Answer API Integration**: Access DuckDuckGo's Instant Answer API for quick answers, definitions, and summaries
- **Enhanced Options for Instant Answers**: Control HTML formatting, redirects, and disambiguation
- **Search Operators**: Advanced search operators for precise web searches (site:, filetype:, intitle:, etc.)
- **Flexible Search Refinement**: Exclude terms, search for exact phrases, use OR logic, and more
- **Improved Pagination with VQD Token**: Smart token management for fetching more results efficiently
- **VQD Token Caching**: Reuse tokens across similar queries for better performance
- **Dictionary Operation**: Get word definitions, synonyms, antonyms, and usage examples from Wordnik
- **Stock Market Data**: Real-time stock quotes with comprehensive market data from Xignite
- **Currency Conversion**: Live exchange rates for 50+ major currencies from XE

### Improvements

- **Better Error Handling**: More descriptive error messages for debugging
- **Telemetry Privacy**: Telemetry is now opt-in with no default endpoint
- **Code Organization**: Modular structure for easier maintenance
- **Search Operator Validation**: Built-in validation for operator values
- **Smart Caching**: Cache support for all new operations with configurable TTL

### Technical Notes

- **For Developers**: There is a known security audit warning about axios in development dependencies which does not affect the production build.
- **Version Warning**: If upgrading from v0.2.x, be aware that the pagination behavior has been improved significantly.
