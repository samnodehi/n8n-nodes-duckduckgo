# n8n-nodes-duckduckgo

[![npm version](https://img.shields.io/npm/v/n8n-nodes-duckduckgo-search.svg)](https://www.npmjs.com/package/n8n-nodes-duckduckgo-search)
[![npm downloads](https://img.shields.io/npm/dt/n8n-nodes-duckduckgo-search.svg)](https://www.npmjs.com/package/n8n-nodes-duckduckgo-search)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

<img src="nodes/DuckDuckGo/duckduckgo.svg" width="100" alt="DuckDuckGo Logo" />

**Integrate DuckDuckGo search seamlessly into your n8n workflows with advanced pagination, AI chat, maps, shopping, and human-like behavior. Get more results without hitting rate limits.**

## 🚀 Features

- **Multiple Search Types**: 
  - 🌐 Web search
  - 🖼️ Image search
  - 📰 News search
  - 🎥 Video search
  - 🗺️ Maps search (NEW!)
  - 🛍️ Shopping search (NEW!)
  - 🤖 AI Chat with privacy-focused models (NEW!)
- **AI Chat Models**: GPT-3.5 Turbo, Claude 3 Haiku, Llama 3 70B, Mixtral 8x7B
- **Advanced Pagination**: Smart pagination to get more results than standard API limits allow
- **Human-like Behavior**: Random delays and rotating user agents to avoid detection and rate limits
- **Customizable Parameters**: Control results with locale, safe search level, and time period filters
- **Privacy-Focused**: Leverages DuckDuckGo's privacy-oriented search engine
- **No Authentication Required**: Works out of the box without API keys
- **Optional API Authentication**: Supports API key for enterprise use cases
- **Rich Response Format**: Well-structured results with titles, URLs, snippets, and more
- **Intelligent Caching**: Built-in cache system to reduce API calls and improve performance
- **Telemetry Support**: Optional usage analytics to help improve the node

## 📦 Installation

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

### 📋 Parameter Setup

#### Required Parameters:
- **Operation**: Choose the type of search (Web Search, Image Search, News Search, Video Search, Maps Search, Shopping Search, AI Chat)
- **Query**: Enter your search terms

#### Optional Parameters:
- **Locale**: Select language and region for search results (default: en-us)
- **Safe Search**: Control filtering of explicit content (Strict, Moderate, Off)
- **Max Results**: Limit number of results (default: 25, can fetch up to 100 with the advanced pagination)
- **Time Period**: Filter by time (All Time, Past Day, Past Week, Past Month, Past Year)

### 🌟 What's New in v1.1.0

#### 🤖 AI Chat Integration
Chat privately with popular AI models through DuckDuckGo's Duck.ai service:
- **Models**: GPT-3.5 Turbo, Claude 3 Haiku, Llama 3 70B, Mixtral 8x7B
- **Privacy**: No data training on your conversations
- **No Account Required**: Start chatting immediately

```json
{
  "operation": "aiChat",
  "aiChatMessage": "Explain quantum computing in simple terms",
  "aiModel": "gpt-3.5-turbo",
  "aiChatOptions": {
    "conversationId": "conv_123...", // Optional: continue previous conversation
    "returnRawResponse": false
  }
}
```

#### 🗺️ Maps Search
Find locations and businesses:
```json
{
  "operation": "searchMaps",
  "mapsQuery": "coffee shops near me",
  "mapsSearchOptions": {
    "maxResults": 10,
    "region": "us-en"
  }
}
```

#### 🛍️ Shopping Search
Search for products and compare prices:
```json
{
  "operation": "searchShopping", 
  "shoppingQuery": "laptop",
  "shoppingSearchOptions": {
    "maxResults": 20,
    "sortBy": "price_low", // relevance, price_low, price_high, rating
    "region": "us-en"
  }
}
```

## 🛡️ Privacy & Security

- All searches are routed through DuckDuckGo's privacy-focused infrastructure
- AI Chat conversations are anonymized and not used for training
- No personal data is collected or stored
- Optional telemetry can be disabled completely
- Secure caching system stores data locally only

## 📄 License

This project is licensed under the [MIT License](LICENSE.md).

## 🐛 Known Issues

- Maps and Shopping search features are simulated in the current version pending official DuckDuckGo API support
- AI Chat requires internet connection and may have rate limits
- Some locales may not support all search types

## 🚀 Roadmap

- [ ] Real-time Maps integration when API becomes available
- [ ] Shopping price tracking and alerts
- [ ] Enhanced AI Chat with image support
- [ ] Support for more AI models
- [ ] Batch search operations
- [ ] Export results to various formats

## ✨ Recent Changes (v1.1.0)

### New Features

- **AI Chat Integration**: Chat with GPT-3.5, Claude, Llama, and Mixtral models privately
- **Maps Search**: Find locations and businesses (simulated)
- **Shopping Search**: Product search with sorting options (simulated)
- **Improved Error Handling**: Better error messages and debugging support
- **Enhanced TypeScript Support**: Updated to TypeScript 4.9.5
- **Security Updates**: Fixed telemetry endpoint and updated dependencies

### Bug Fixes

- Fixed telemetry endpoint security issue
- Resolved npm audit vulnerabilities
- Improved caching mechanism
- Better handling of empty results

### Technical Improvements

- Updated TypeScript to v4.9.5
- Added comprehensive type definitions for new features
- Improved code organization and modularity
- Enhanced testing coverage

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
