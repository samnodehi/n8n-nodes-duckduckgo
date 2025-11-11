# DuckDuckGo Search Node for n8n

[![npm version](https://img.shields.io/npm/v/n8n-nodes-duckduckgo-search.svg?v=31.0.0)](https://www.npmjs.com/package/n8n-nodes-duckduckgo-search)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A powerful and comprehensive n8n community node that seamlessly integrates DuckDuckGo search capabilities into your workflows. Search the web, find images, discover news, and explore videos - all with privacy-focused, reliable results.

## ✨ Features

### 🤖 **AI Agent Integration** (New in v31.0.0)
- **Agent Tool Support**: Use as a tool in n8n AI Agent workflows
- **LLM-Optimized**: Clean interface designed for AI agent consumption
- **Structured Output**: Predictable format perfect for downstream AI processing
- **Production-Ready**: Enterprise-grade reliability for agent workloads
- **Enable**: Set `N8N_COMMUNITY_PACKAGES_ALLOW_TOOL_USAGE=true` environment variable

### 🛡️ **Advanced Reliability System** (New in v31.0.0)
- **Adaptive Backoff**: Automatically backs off on consecutive empty results
- **Jittered Delays**: Prevents thundering herd in parallel execution
- **Circuit Breaker**: Automatic failure detection and recovery
- **Retry Logic**: Configurable retries with exponential backoff
- **Metrics Tracking**: Monitor performance, failures, and circuit state

### 🔍 **Complete Search Coverage**
- **Web Search**: Comprehensive web search with rich content extraction
- **Image Search**: High-quality image discovery with metadata
- **News Search**: Real-time news from diverse sources worldwide
- **Video Search**: Video content discovery across multiple platforms

### 🚀 **Advanced Capabilities**
- **Smart Query Processing**: Intelligent query enhancement and optimization
- **Rich Results**: Complete metadata including titles, descriptions, sources, and dates
- **Multiple Formats**: Support for various content types and file formats
- **Language Support**: 50+ language and region combinations
- **Search Operators**: Advanced search syntax (`site:`, `intitle:`, `filetype:`, etc.)
- **Safe Search**: Configurable content filtering options

### 🛡️ **Privacy & Performance**
- **No API Keys Required**: Completely free to use without registration
- **Privacy-Focused**: No user tracking or data collection
- **High Performance**: Optimized for speed and reliability under load
- **Error Handling**: Robust error recovery and retry mechanisms
- **Rate Limiting**: Intelligent protection against overuse

## 📦 Installation

### Via npm
```bash
npm install n8n-nodes-duckduckgo-search
```

### Via n8n Interface
1. Go to **Settings** → **Community Nodes**
2. Enter: `n8n-nodes-duckduckgo-search` 
3. Click **Install**
4. Restart n8n if required

## 🚀 Quick Start

### Standard Usage

1. **Add Node**: Drag the **DuckDuckGo Search** node into your workflow
2. **Choose Operation**: Select Web, Image, News, or Video search
3. **Enter Query**: Type your search terms
4. **Configure Options**: Set result limits, language, and filters
5. **Execute**: Run your workflow and get results!

### AI Agent Usage

Use DuckDuckGo Search as a tool in AI Agent workflows for intelligent, autonomous search:

1. **Enable Community Tools**: Set environment variable `N8N_COMMUNITY_PACKAGES_ALLOW_TOOL_USAGE=true`
2. **Add AI Agent**: Create an AI Agent node in your workflow
3. **Connect Tool**: Add DuckDuckGo Search node as a tool to your agent
4. **Configure**: The agent will automatically use the search tool when needed
5. **Run**: Let your AI agent autonomously search and process results

The node provides clean, structured output optimized for LLM consumption with automatic handling of parallel requests and rate limits.

## 🔧 Usage Examples

### Web Search
```json
{
  "operation": "search",
  "query": "artificial intelligence trends 2025",
  "webSearchOptions": {
    "maxResults": 20,
    "region": "us-en", 
    "safeSearch": 1
  }
}
```

**Sample Output:**
```json
[
  {
    "title": "AI Trends 2025: What to Expect",
    "url": "https://example.com/ai-trends-2025",
    "description": "Comprehensive overview of artificial intelligence trends...",
    "hostname": "example.com"
  }
]
```

### Image Search
```json
{
  "operation": "searchImages",
  "imageQuery": "sunset mountains landscape",
  "imageSearchOptions": {
    "maxResults": 15,
    "safeSearch": 1,
    "size": "large",
    "color": "color",
    "type": "photo"
  }
}
```

**Sample Output:**
```json
[
  {
    "title": "Beautiful Mountain Sunset",
    "url": "https://example.com/mountain-sunset.jpg",
    "thumbnail": "https://example.com/thumb.jpg",
    "height": 1080,
    "width": 1920,
    "source": "Photography Site"
  }
]
```

### News Search
```json
{
  "operation": "searchNews",
  "newsQuery": "renewable energy breakthrough",
  "newsSearchOptions": {
    "maxResults": 10,
    "region": "us-en",
    "safeSearch": 1,
    "timePeriod": "d"
  }
}
```

**Sample Output:**
```json
[
  {
    "title": "Major Breakthrough in Solar Energy Efficiency",
    "url": "https://news.example.com/solar-breakthrough",
    "description": "Scientists announce 40% efficiency improvement...",
    "publishedDate": "2025-06-29",
    "source": "Tech News Daily"
  }
]
```

### Video Search
```json
{
  "operation": "searchVideos",
  "videoQuery": "machine learning tutorial",
  "videoSearchOptions": {
    "maxResults": 12,
    "safeSearch": 1,
    "duration": "medium",
    "resolution": "high"
  }
}
```

**Sample Output:**
```json
[
  {
    "title": "Complete Machine Learning Tutorial",
    "url": "https://video.example.com/ml-tutorial",
    "thumbnail": "https://video.example.com/thumb.jpg",
    "duration": "15:30",
    "publishedDate": "2025-06-20",
    "views": "125000",
    "source": "Educational Channel"
  }
]
```

## ⚙️ Configuration Options

### Reliability Settings (New in v31.0.0)

Advanced reliability features for production workloads:

| Setting | Default | Description |
|---------|---------|-------------|
| **Enable Reliability** | true | Master switch for all reliability features |
| **Empty Result Threshold** | 3 | Consecutive empty results before backoff |
| **Initial Backoff** | 1000ms | Starting backoff delay |
| **Max Backoff** | 30000ms | Maximum backoff delay |
| **Min Jitter** | 100ms | Minimum random delay |
| **Max Jitter** | 500ms | Maximum random delay |
| **Failure Threshold** | 5 | Failures before circuit opens |
| **Circuit Reset Timeout** | 60000ms | Time before retry after circuit opens |
| **Max Retries** | 3 | Maximum retry attempts |
| **Retry Delay** | 1000ms | Base delay between retries |

### Search Types

| Operation | Description | Max Results |
|-----------|-------------|-------------|
| **Web Search** | General web content search | 1-50 |
| **Image Search** | Image and visual content discovery | 1-50 |
| **News Search** | News articles and current events | 1-50 |
| **Video Search** | Video content from various platforms | 1-50 |

### Common Parameters

| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| `query` | string | Search terms | Required |
| `maxResults` | number | Number of results to return | 10 |
| `region` | string | Language/region code (us-en, de-de, etc.) | us-en |
| `safeSearch` | number | Safe search level (0=off, 1=moderate, 2=strict) | 1 |

### Advanced Options

#### Web Search Options
- **timePeriod**: Filter by time range (d, w, m, y)
- **searchOperators**: Use advanced search operators
- **useSearchOperators**: Enable operator parsing

#### Image Search Options  
- **size**: Image size (small, medium, large, wallpaper)
- **color**: Color filter (color, monochrome, red, orange, etc.)
- **type**: Image type (photo, clipart, gif, transparent)
- **layout**: Image layout (square, tall, wide)

#### News Search Options
- **timePeriod**: Time range for news (d, w, m, y)
- **sortBy**: Sort order (date, relevance)

#### Video Search Options
- **duration**: Video length (short, medium, long)
- **resolution**: Video quality (high, standard)
- **publishedTime**: When published (d, w, m, y)

## 🔍 Advanced Search Operators

Use powerful search operators to refine your results:

| Operator | Example | Description |
|----------|---------|-------------|
| `site:` | `site:github.com` | Search within specific site |
| `filetype:` | `filetype:pdf` | Find specific file types |
| `intitle:` | `intitle:"machine learning"` | Search in page titles |
| `inurl:` | `inurl:tutorial` | Search in URLs |
| `"exact phrase"` | `"artificial intelligence"` | Exact phrase matching |
| `-exclude` | `python -snake` | Exclude specific terms |
| `OR` | `cat OR dog` | Either term |

**Example with operators:**
```json
{
  "query": "site:github.com filetype:md machine learning",
  "useSearchOperators": true
}
```

## 🌍 Supported Languages & Regions

The node supports 50+ language and region combinations:

- **English**: us-en, uk-en, au-en, ca-en, etc.
- **Spanish**: es-es, mx-es, ar-es, etc.  
- **French**: fr-fr, ca-fr, ch-fr
- **German**: de-de, at-de, ch-de
- **And many more**: ja-jp, zh-cn, ru-ru, pt-br, it-it, nl-nl, etc.

## 💡 Use Cases

### Content Marketing
- Research trending topics and keywords
- Find images for blog posts and social media
- Monitor news about your industry
- Discover video content for inspiration

### Data Analysis  
- Gather web content for analysis
- Build datasets from search results
- Monitor brand mentions and sentiment
- Track competitor content strategies

### Research & Development
- Academic research and literature review
- Technical documentation discovery
- Industry trend analysis
- Competitive intelligence gathering

### Automation Workflows
- Automated content curation
- News monitoring and alerts  
- Image collection for projects
- SEO research and optimization

## 🛠️ Workflow Integration

### Input Parameters
All search operations accept standardized input parameters that can be:
- **Hard-coded** in the node configuration
- **Passed dynamically** from previous workflow steps
- **Combined** with expressions and variables

### Output Structure
Results are returned as structured JSON arrays with consistent formatting:
- **Standardized fields** across all search types
- **Rich metadata** for comprehensive analysis
- **Clean, parsed content** ready for further processing

### Error Handling
Robust error handling provides:
- **Descriptive error messages** for troubleshooting
- **Graceful failure handling** to prevent workflow breaks
- **Retry mechanisms** for temporary issues
- **Input validation** to catch configuration errors

## 📊 Performance & Limits

### Advanced Reliability (v31.0.0)
- **Adaptive Backoff**: Automatic delay adjustment based on response patterns
- **Circuit Breaker**: Prevents cascading failures with automatic recovery
- **Jittered Delays**: Randomized timing prevents thundering herd
- **Retry Logic**: Exponential backoff with configurable attempts
- **Metrics Tracking**: Real-time monitoring of performance and failures

### Rate Limiting
- **Built-in protection** against overuse
- **Intelligent delay mechanisms** between requests
- **Configurable retry logic** for failed requests
- **Circuit breaking** for automatic failure handling

### Result Limits
- **Web Search**: Up to 50 results per request
- **Image Search**: Up to 50 images per request
- **News Search**: Up to 50 articles per request
- **Video Search**: Up to 50 videos per request

### Performance Tips
- Use **specific queries** for better, faster results
- Set **appropriate result limits** for your use case
- Leverage **caching** for repeated searches
- Use **search operators** to narrow results efficiently
- Enable **reliability features** for production workloads
- Monitor **circuit breaker state** in high-volume scenarios

## 🔒 Privacy & Security

### Privacy-First Design
- **No user tracking** or data collection
- **No API keys required** - completely free
- **Direct DuckDuckGo integration** without third-party services
- **Secure HTTP client** configuration

### Data Handling
- **Minimal data retention** - results processed and returned immediately
- **No persistent storage** of search queries or results
- **Clean HTTP requests** without unnecessary headers or tracking

## 🆘 Troubleshooting

### Common Issues

**Empty Results**
- Check your search query for typos
- Try broader search terms
- Verify region/language settings
- Ensure safe search settings are appropriate

**Slow Performance**  
- Reduce the number of results requested
- Use more specific search queries
- Check your network connection
- Consider using search operators to narrow results

**Configuration Errors**
- Verify all required parameters are provided
- Check parameter data types and formats
- Ensure region codes are valid
- Validate search operator syntax

## 📚 API Reference

### Node Properties

#### Required Parameters
- `operation`: The search operation to perform
- `query`: The search terms (varies by operation type)

#### Optional Parameters
- `maxResults`: Number of results to return (1-50)
- `region`: Language/region code
- `safeSearch`: Safe search filtering level
- Additional operation-specific options

### Output Format

All operations return an array of result objects with operation-specific fields but consistent structure for easy processing in your workflows.

## 🤝 Support & Contributing

### Getting Help
- **Documentation**: This README covers most use cases
- **GitHub Issues**: Report bugs or request features
- **Community**: Join the n8n community for discussions

### Contributing
This is an open-source project. Contributions are welcome:
- **Bug Reports**: Help us improve reliability
- **Feature Requests**: Suggest new capabilities  
- **Code Contributions**: Submit pull requests
- **Documentation**: Help improve guides and examples

## 📄 License

MIT License - see the [LICENSE](LICENSE.md) file for details.

---

**Ready to get started?** Install the node and begin searching with DuckDuckGo's powerful, privacy-focused search capabilities in your n8n workflows today! 
