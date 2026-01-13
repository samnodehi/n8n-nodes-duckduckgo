# DuckDuckGo Search Node for n8n

[![npm version](https://img.shields.io/npm/v/n8n-nodes-duckduckgo-search.svg?v=32.0.0)](https://www.npmjs.com/package/n8n-nodes-duckduckgo-search)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A lightweight and fast n8n community node for DuckDuckGo search. Search the web, find images, discover news, and explore videos with privacy-focused results.

## ✨ Features

### 🔍 **Complete Search Coverage**
- **Web Search**: Comprehensive web search with clean results
- **Image Search**: High-quality image discovery with metadata
- **News Search**: Real-time news from diverse sources worldwide
- **Video Search**: Video content discovery across multiple platforms

### 🚀 **Simple & Fast**
- **Lightweight Design**: Simplified codebase for better performance
- **Essential Parameters**: Only the settings you actually need
- **No Extra Overhead**: Removed complex features for speed
- **Clean Results**: Focused on delivering quality search results

### 🛡️ **Privacy-Focused**
- **No API Keys Required**: Completely free to use without registration
- **Privacy-First**: No user tracking or data collection
- **Direct Integration**: Uses DuckDuckGo's search directly

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

1. **Add Node**: Drag the **DuckDuckGo Search** node into your workflow
2. **Choose Operation**: Select Web, Image, News, or Video search
3. **Enter Query**: Type your search terms
4. **Configure Options**: Set result limits, language, and filters
5. **Execute**: Run your workflow and get results!

## 🔧 Usage Examples

### Web Search
```json
{
  "operation": "search",
  "query": "artificial intelligence trends 2026",
  "locale": "en-us",
  "maxResults": 20,
  "region": "us-en", 
  "safeSearch": -1,
  "timePeriod": ""
}
```

**Sample Output:**
```json
[
  {
    "position": 1,
    "title": "AI Trends 2026: What to Expect",
    "description": "Comprehensive overview of artificial intelligence trends...",
    "url": "https://example.com/ai-trends-2026",
    "hostname": "example.com",
    "sourceType": "web"
  }
]
```

### Image Search
```json
{
  "operation": "searchImages",
  "query": "sunset mountains landscape",
  "locale": "en-us",
  "maxResults": 15,
  "region": "us-en",
  "safeSearch": -1
}
```

**Sample Output:**
```json
[
  {
    "title": "Beautiful Mountain Sunset",
    "url": "https://example.com/page",
    "imageUrl": "https://example.com/mountain-sunset.jpg",
    "thumbnailUrl": "https://example.com/thumb.jpg",
    "height": 1080,
    "width": 1920,
    "source": "example.com",
    "sourceType": "image"
  }
]
```

### News Search
```json
{
  "operation": "searchNews",
  "query": "renewable energy breakthrough",
  "locale": "en-us",
  "maxResults": 10,
  "region": "us-en",
  "safeSearch": -1,
  "timePeriod": "d"
}
```

**Sample Output:**
```json
[
  {
    "title": "Major Breakthrough in Solar Energy Efficiency",
    "description": "Scientists announce 40% efficiency improvement...",
    "url": "https://news.example.com/solar-breakthrough",
    "imageUrl": "https://news.example.com/solar.jpg",
    "date": "2026-01-13T10:30:00.000Z",
    "relativeTime": "2 hours ago",
    "syndicate": "Tech News Daily",
    "sourceType": "news"
  }
]
```

### Video Search
```json
{
  "operation": "searchVideos",
  "query": "machine learning tutorial",
  "locale": "en-us",
  "maxResults": 12,
  "region": "us-en",
  "safeSearch": -1
}
```

**Sample Output:**
```json
[
  {
    "title": "Complete Machine Learning Tutorial",
    "description": "Learn machine learning from scratch...",
    "url": "https://video.example.com/ml-tutorial",
    "imageUrl": "https://video.example.com/thumb.jpg",
    "duration": "15:30",
    "published": "2026-01-10",
    "publisher": "Educational Channel",
    "viewCount": "125000",
    "sourceType": "video"
  }
]
```

## ⚙️ Configuration Options

### Parameters

| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| **Operation** | options | Type of search (search, searchImages, searchNews, searchVideos) | search |
| **Locale** | options | Search language/region locale | en-us |
| **Search Query** | string | Search terms to look for | Required |
| **Maximum Results** | number | Number of results to return (1-50) | 10 |
| **Region** | options | Geographic region for search results | wt-wt |
| **Safe Search** | options | Content filtering level (Strict=0, Moderate=-1, Off=-2) | -1 |
| **Time Period** | options | Time range for results (All Time='', Past Day='d', Week='w', Month='m', Year='y') | '' |

### Search Types

| Operation | Description | Supported Parameters |
|-----------|-------------|---------------------|
| **Web Search** | General web content search | All parameters |
| **Image Search** | Image and visual content discovery | All except Time Period |
| **News Search** | News articles and current events | All parameters |
| **Video Search** | Video content from various platforms | All except Time Period |

## 🌍 Supported Languages & Regions

The node supports 18 locale options:

- **English**: en-us, uk-en
- **Spanish**: es-es
- **French**: fr-fr
- **German**: de-de
- **Italian**: it-it
- **Japanese**: jp-jp
- **Russian**: ru-ru
- **Chinese**: zh-cn
- **Portuguese**: br-pt
- **Dutch**: nl-nl
- **Polish**: pl-pl
- **Swedish**: se-sv
- **Korean**: kr-ko
- **Turkish**: tr-tr
- **Arabic**: sa-ar
- **Hebrew**: il-he
- **Persian**: ir-fa

Region options include 56 geographic regions from worldwide to country-specific.

## 💡 Use Cases

### Content Marketing
- Research trending topics and keywords
- Find images for blog posts and social media
- Monitor news about your industry
- Discover video content for inspiration

### Data Analysis  
- Gather web content for analysis
- Build datasets from search results
- Monitor brand mentions
- Track competitor content

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

## 📊 Performance & Limits

### Result Limits
- **Web Search**: Up to 50 results per request
- **Image Search**: Up to 50 images per request
- **News Search**: Up to 50 articles per request
- **Video Search**: Up to 50 videos per request

### Performance Tips
- Use **specific queries** for better, faster results
- Set **appropriate result limits** for your use case
- Leverage **region settings** for localized results
- Use **time period filters** to narrow results

## 🔒 Privacy & Security

### Privacy-First Design
- **No user tracking** or data collection
- **No API keys required** - completely free
- **Direct DuckDuckGo integration** without third-party services

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

**Configuration Errors**
- Verify all required parameters are provided
- Check parameter data types and formats
- Ensure region codes are valid

## 📚 API Reference

### Node Properties

#### Required Parameters
- `operation`: The search operation to perform
- `query`: The search terms

#### Optional Parameters
- `locale`: Language/region code (default: en-us)
- `maxResults`: Number of results to return 1-50 (default: 10)
- `region`: Geographic region (default: wt-wt)
- `safeSearch`: Safe search filtering level (default: -1)
- `timePeriod`: Time range for results (default: '')

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
