# n8n-nodes-duckduckgo

[![npm version](https://img.shields.io/npm/v/n8n-nodes-duckduckgo-search.svg)](https://www.npmjs.com/package/n8n-nodes-duckduckgo-search)
[![npm downloads](https://img.shields.io/npm/dt/n8n-nodes-duckduckgo-search.svg)](https://www.npmjs.com/package/n8n-nodes-duckduckgo-search)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

<img src="nodes/DuckDuckGo/duckduckgo.svg" width="100" alt="DuckDuckGo Logo" />

**Integrate DuckDuckGo search seamlessly into your n8n workflows with advanced pagination and human-like behavior. Get more results without hitting rate limits.**

## Features

- **Multiple Search Types**: Web search, image search, news search, and video search
- **Advanced Pagination**: Smart pagination to get more results than standard API limits allow
- **Human-like Behavior**: Random delays and rotating user agents to avoid detection and rate limits
- **Customizable Parameters**: Control results with locale, safe search level, and time period filters
- **Privacy-Focused**: Leverages DuckDuckGo's privacy-oriented search engine
- **No Authentication Required**: Works out of the box without API keys
- **Optional API Authentication**: Supports API key for enterprise use cases
- **Rich Response Format**: Well-structured results with titles, URLs, snippets, and more

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
- **Operation**: Choose the type of search (Web Search, Image Search, News Search, Video Search)
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

## Recent Changes (v0.3.0)

### Advanced Pagination Features

The latest version includes significant improvements to the search pagination system:

- **Super Pagination**: New algorithm that combines JSON API and HTML scraping for comprehensive results
- **Higher Result Limits**: Get up to 100 search results (depending on query popularity)
- **Intelligent Fallbacks**: Automatically switches between different methods to maximize result gathering
- **Rate Limit Prevention**: Human-like pauses and varying user agents reduce the risk of being blocked

### Technical Notes

- **For Developers**: There is a known security audit warning about axios in development dependencies which does not affect the production build.
- **Version Warning**: If upgrading from v0.2.x, be aware that the pagination behavior has been improved significantly.
