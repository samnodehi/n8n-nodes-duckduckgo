/**
 * Search Operators for DuckDuckGo
 * Provides advanced search functionality through operator syntax
 */

/**
 * Supported search operators
 */
export enum SearchOperator {
  Site = 'site:',
  Filetype = 'filetype:',
  Intitle = 'intitle:',
  Inurl = 'inurl:',
  InBody = 'inbody:',
  Cache = 'cache:',
  Define = 'define:',
  Related = 'related:',
  Link = 'link:',
  Ext = 'ext:',
  Location = 'location:',
  Region = 'region:',
  Language = 'language:',
  Feed = 'feed:',
  HasFeed = 'hasfeed:',
  IPAddress = 'ip:',
  Prefer = 'prefer:',
  AllInTitle = 'allintitle:',
  AllInUrl = 'allinurl:',
  AllInText = 'allintext:',
  AllInAnchor = 'allinanchor:',
}

/**
 * Search operator configuration
 */
export interface ISearchOperatorConfig {
  operator: SearchOperator;
  value: string;
  description?: string;
}

/**
 * Search operators input interface
 */
export interface ISearchOperators {
  site?: string;
  filetype?: string;
  intitle?: string;
  inurl?: string;
  inbody?: string;
  cache?: string;
  define?: string;
  related?: string;
  link?: string;
  ext?: string;
  location?: string;
  region?: string;
  language?: string;
  feed?: string;
  hasfeed?: string;
  ip?: string;
  prefer?: string;
  allintitle?: string;
  allinurl?: string;
  allintext?: string;
  allinanchor?: string;
  exclude?: string;
  exact?: string;
  or?: string[];
}

/**
 * Operator info for UI display
 */
export const OPERATOR_INFO: Record<string, { description: string; example: string; placeholder: string }> = {
  site: {
    description: 'Search within a specific website or domain',
    example: 'site:example.com',
    placeholder: 'example.com',
  },
  filetype: {
    description: 'Search for specific file types',
    example: 'filetype:pdf',
    placeholder: 'pdf, doc, xls, ppt, etc.',
  },
  intitle: {
    description: 'Search for pages with specific words in the title',
    example: 'intitle:important',
    placeholder: 'words to find in title',
  },
  inurl: {
    description: 'Search for pages with specific words in the URL',
    example: 'inurl:api',
    placeholder: 'words to find in URL',
  },
  inbody: {
    description: 'Search for pages with specific words in the body text',
    example: 'inbody:content',
    placeholder: 'words to find in body',
  },
  cache: {
    description: 'View the cached version of a webpage',
    example: 'cache:example.com',
    placeholder: 'example.com',
  },
  define: {
    description: 'Get definitions for a word or phrase',
    example: 'define:quantum',
    placeholder: 'word to define',
  },
  related: {
    description: 'Find websites related to a specific URL',
    example: 'related:example.com',
    placeholder: 'example.com',
  },
  link: {
    description: 'Find pages that link to a specific URL',
    example: 'link:example.com',
    placeholder: 'example.com',
  },
  ext: {
    description: 'Search for specific file extensions (alias for filetype)',
    example: 'ext:pdf',
    placeholder: 'pdf, doc, etc.',
  },
  location: {
    description: 'Search for results from a specific location',
    example: 'location:"New York"',
    placeholder: 'city or country',
  },
  region: {
    description: 'Search for results from a specific region',
    example: 'region:us',
    placeholder: 'country code',
  },
  language: {
    description: 'Search for results in a specific language',
    example: 'language:en',
    placeholder: 'language code',
  },
  feed: {
    description: 'Find RSS or Atom feeds',
    example: 'feed:blog',
    placeholder: 'feed keyword',
  },
  hasfeed: {
    description: 'Find pages that have RSS or Atom feeds',
    example: 'hasfeed:news',
    placeholder: 'keyword',
  },
  ip: {
    description: 'Search for information about an IP address',
    example: 'ip:192.168.1.1',
    placeholder: 'IP address',
  },
  prefer: {
    description: 'Prefer newer or older results',
    example: 'prefer:newer',
    placeholder: 'newer or older',
  },
  allintitle: {
    description: 'All words must appear in the title',
    example: 'allintitle:important news',
    placeholder: 'all words for title',
  },
  allinurl: {
    description: 'All words must appear in the URL',
    example: 'allinurl:api docs',
    placeholder: 'all words for URL',
  },
  allintext: {
    description: 'All words must appear in the text',
    example: 'allintext:complete guide',
    placeholder: 'all words for text',
  },
  allinanchor: {
    description: 'All words must appear in anchor text',
    example: 'allinanchor:click here',
    placeholder: 'all words for anchors',
  },
  exclude: {
    description: 'Exclude results containing specific words (use - prefix)',
    example: '-unwanted',
    placeholder: 'words to exclude',
  },
  exact: {
    description: 'Search for exact phrase (use quotes)',
    example: '"exact phrase"',
    placeholder: 'exact phrase to match',
  },
  or: {
    description: 'Search for any of the specified terms (use OR)',
    example: 'term1 OR term2',
    placeholder: 'alternative terms',
  },
};

/**
 * Build search query with operators
 * @param baseQuery The base search query
 * @param operators The search operators to apply
 * @returns The enhanced search query
 */
export function buildSearchQuery(baseQuery: string, operators?: ISearchOperators): string {
  if (!operators || Object.keys(operators).length === 0) {
    return baseQuery;
  }

  const queryParts: string[] = [];

  // Add base query if provided
  if (baseQuery.trim()) {
    queryParts.push(baseQuery);
  }

  // Process standard operators
  if (operators.site) {
    queryParts.push(`site:${operators.site}`);
  }

  if (operators.filetype) {
    queryParts.push(`filetype:${operators.filetype}`);
  }

  if (operators.intitle) {
    queryParts.push(`intitle:${operators.intitle}`);
  }

  if (operators.inurl) {
    queryParts.push(`inurl:${operators.inurl}`);
  }

  if (operators.inbody) {
    queryParts.push(`inbody:${operators.inbody}`);
  }

  if (operators.cache) {
    queryParts.push(`cache:${operators.cache}`);
  }

  if (operators.define) {
    queryParts.push(`define:${operators.define}`);
  }

  if (operators.related) {
    queryParts.push(`related:${operators.related}`);
  }

  if (operators.link) {
    queryParts.push(`link:${operators.link}`);
  }

  if (operators.ext) {
    queryParts.push(`ext:${operators.ext}`);
  }

  if (operators.location) {
    // Quote location if it contains spaces
    const location = operators.location.includes(' ') ? `"${operators.location}"` : operators.location;
    queryParts.push(`location:${location}`);
  }

  if (operators.region) {
    queryParts.push(`region:${operators.region}`);
  }

  if (operators.language) {
    queryParts.push(`language:${operators.language}`);
  }

  if (operators.feed) {
    queryParts.push(`feed:${operators.feed}`);
  }

  if (operators.hasfeed) {
    queryParts.push(`hasfeed:${operators.hasfeed}`);
  }

  if (operators.ip) {
    queryParts.push(`ip:${operators.ip}`);
  }

  if (operators.prefer) {
    queryParts.push(`prefer:${operators.prefer}`);
  }

  if (operators.allintitle) {
    queryParts.push(`allintitle:${operators.allintitle}`);
  }

  if (operators.allinurl) {
    queryParts.push(`allinurl:${operators.allinurl}`);
  }

  if (operators.allintext) {
    queryParts.push(`allintext:${operators.allintext}`);
  }

  if (operators.allinanchor) {
    queryParts.push(`allinanchor:${operators.allinanchor}`);
  }

  // Process special operators
  if (operators.exclude) {
    // Split by comma for multiple exclusions
    const exclusions = operators.exclude.split(',').map(e => e.trim());
    exclusions.forEach(exclusion => {
      if (exclusion && !exclusion.startsWith('-')) {
        queryParts.push(`-${exclusion}`);
      } else if (exclusion) {
        queryParts.push(exclusion);
      }
    });
  }

  if (operators.exact) {
    // Ensure the exact phrase is quoted
    const exactPhrase = operators.exact.trim();
    if (exactPhrase && !exactPhrase.startsWith('"')) {
      queryParts.push(`"${exactPhrase}"`);
    } else if (exactPhrase) {
      queryParts.push(exactPhrase);
    }
  }

  if (operators.or && operators.or.length > 0) {
    // Join OR terms
    const orQuery = operators.or.filter(term => term.trim()).join(' OR ');
    if (orQuery) {
      queryParts.push(`(${orQuery})`);
    }
  }

  return queryParts.join(' ');
}

/**
 * Parse search operators from a query string
 * @param query The query string that may contain operators
 * @returns An object with the base query and detected operators
 */
export function parseSearchOperators(query: string): { baseQuery: string; operators: ISearchOperators } {
  const operators: ISearchOperators = {};
  const removals: Array<{ start: number; end: number }> = [];

  // Helper function to mark text for removal
  const markForRemoval = (startIndex: number, length: number) => {
    removals.push({ start: startIndex, end: startIndex + length });
  };

  // Parse operators with format operator:value or operator:"quoted value"
  const operatorRegex = /(\w+):("(?:[^"\\]|\\.)*"|\S+)/g;
  let match;

  while ((match = operatorRegex.exec(query)) !== null) {
    if (!match || !match[1] || !match[2]) continue;
    const [fullMatch, operator, value] = match;
    const cleanValue = value.replace(/^"|"$/g, ''); // Remove quotes if present

    switch (operator.toLowerCase()) {
      case 'site':
        operators.site = cleanValue;
        break;
      case 'filetype':
        operators.filetype = cleanValue;
        break;
      case 'intitle':
        operators.intitle = cleanValue;
        break;
      case 'inurl':
        operators.inurl = cleanValue;
        break;
      case 'inbody':
        operators.inbody = cleanValue;
        break;
      case 'cache':
        operators.cache = cleanValue;
        break;
      case 'define':
        operators.define = cleanValue;
        break;
      case 'related':
        operators.related = cleanValue;
        break;
      case 'link':
        operators.link = cleanValue;
        break;
      case 'ext':
        operators.ext = cleanValue;
        break;
      case 'location':
        operators.location = cleanValue;
        break;
      case 'region':
        operators.region = cleanValue;
        break;
      case 'language':
        operators.language = cleanValue;
        break;
      case 'feed':
        operators.feed = cleanValue;
        break;
      case 'hasfeed':
        operators.hasfeed = cleanValue;
        break;
      case 'ip':
        operators.ip = cleanValue;
        break;
      case 'prefer':
        operators.prefer = cleanValue;
        break;
      case 'allintitle':
        operators.allintitle = cleanValue;
        break;
      case 'allinurl':
        operators.allinurl = cleanValue;
        break;
      case 'allintext':
        operators.allintext = cleanValue;
        break;
      case 'allinanchor':
        operators.allinanchor = cleanValue;
        break;
    }

    if (match.index !== undefined) {
      markForRemoval(match.index, fullMatch.length);
    }
  }

  // Parse exclusions (words starting with -)
  const exclusions: string[] = [];
  const exclusionRegex = /(?:^|\s)-(\w+)(?=\s|$)/g;

  while ((match = exclusionRegex.exec(query)) !== null) {
    if (match && match[1] && match.index !== undefined) {
      exclusions.push(match[1]);
      markForRemoval(match.index, match[0].length);
    }
  }

  if (exclusions.length > 0) {
    operators.exclude = exclusions.join(', ');
  }

  // Parse exact phrases (quoted strings not part of operators)
  const exactPhrases: string[] = [];
  const exactRegex = /"([^"]+)"/g;

  while ((match = exactRegex.exec(query)) !== null) {
    if (match && match[1] && match.index !== undefined) {
      // Check if this quoted string is part of an operator (preceded by :)
      const beforeIndex = match.index - 1;
      if (beforeIndex < 0 || query[beforeIndex] !== ':') {
        exactPhrases.push(match[1]);
        markForRemoval(match.index, match[0].length);
      }
    }
  }

  if (exactPhrases.length > 0) {
    operators.exact = exactPhrases.join(' ');
  }

  // Parse OR operators
  const orTerms: string[] = [];
  const orRegex = /(\w+)\s+OR\s+(\w+)/g;

  while ((match = orRegex.exec(query)) !== null) {
    if (match && match[1] && match[2] && match.index !== undefined) {
      orTerms.push(match[1], match[2]);
      markForRemoval(match.index, match[0].length);
    }
  }

  if (orTerms.length > 0) {
    operators.or = [...new Set(orTerms)]; // Remove duplicates
  }

  // Remove all marked sections from the query
  // Sort removals by start position in reverse order
  removals.sort((a, b) => b.start - a.start);

  // Convert query to array for easier manipulation
  const queryChars = query.split('');

  // Remove marked sections
  removals.forEach(removal => {
    queryChars.splice(removal.start, removal.end - removal.start);
  });

  // Reconstruct the base query
  let baseQuery = queryChars.join('');

  // Clean up extra spaces
  baseQuery = baseQuery.replace(/\s+/g, ' ').trim();

  return { baseQuery, operators };
}

/**
 * Validate search operators
 * @param operators The search operators to validate
 * @returns An array of validation errors, empty if valid
 */
export function validateSearchOperators(operators: ISearchOperators): string[] {
  const errors: string[] = [];

  // Validate file types
  if (operators.filetype) {
    const validFileTypes = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'rtf', 'odt', 'html', 'htm', 'xml', 'json', 'csv', 'zip', 'rar', '7z', 'tar', 'gz'];
    if (!validFileTypes.includes(operators.filetype.toLowerCase())) {
      errors.push(`Invalid filetype: ${operators.filetype}. Valid types: ${validFileTypes.join(', ')}`);
    }
  }

  // Validate region codes
  if (operators.region) {
    const validRegions = ['us', 'uk', 'ca', 'au', 'de', 'fr', 'es', 'it', 'nl', 'br', 'mx', 'ar', 'in', 'jp', 'cn', 'kr', 'ru'];
    if (!validRegions.includes(operators.region.toLowerCase())) {
      errors.push(`Invalid region: ${operators.region}. Valid regions: ${validRegions.join(', ')}`);
    }
  }

  // Validate language codes
  if (operators.language) {
    const validLanguages = ['en', 'es', 'fr', 'de', 'it', 'pt', 'nl', 'ru', 'ja', 'zh', 'ko', 'ar', 'hi', 'tr', 'pl', 'sv', 'da', 'no', 'fi'];
    if (!validLanguages.includes(operators.language.toLowerCase())) {
      errors.push(`Invalid language: ${operators.language}. Valid languages: ${validLanguages.join(', ')}`);
    }
  }

  // Validate prefer value
  if (operators.prefer && !['newer', 'older'].includes(operators.prefer.toLowerCase())) {
    errors.push(`Invalid prefer value: ${operators.prefer}. Use 'newer' or 'older'`);
  }

  // Validate IP address format
  if (operators.ip) {
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipRegex.test(operators.ip)) {
      errors.push(`Invalid IP address format: ${operators.ip}`);
    } else {
      // Additional validation for IP octets
      const octets = operators.ip.split('.');
      const invalidOctets = octets.filter(octet => {
        const num = parseInt(octet, 10);
        return num > 255;
      });
      if (invalidOctets.length > 0) {
        errors.push(`Invalid IP address format: ${operators.ip}`);
      }
    }
  }

  return errors;
}