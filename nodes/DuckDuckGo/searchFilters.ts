/**
 * Search Filters for DuckDuckGo
 *
 * This module provides region, language, and date range filtering
 * capabilities for search operations.
 */

import { IExecuteFunctions } from 'n8n-workflow';
import { SearchOptions } from 'duck-duck-scrape';

/**
 * Search filter options interface
 */
export interface ISearchFilters {
  region?: string;
  language?: string;
  dateRange?: {
    type: 'day' | 'week' | 'month' | 'year' | 'custom';
    from?: string;
    to?: string;
  };
  safeSearch?: 'strict' | 'moderate' | 'off';
}

/**
 * Supported regions with their codes
 */
export const SUPPORTED_REGIONS: Record<string, string> = {
  'wt-wt': 'No Region',
  'us-en': 'United States',
  'uk-en': 'United Kingdom',
  'ca-en': 'Canada',
  'au-en': 'Australia',
  'nz-en': 'New Zealand',
  'ie-en': 'Ireland',
  'za-en': 'South Africa',
  'in-en': 'India',
  'sg-en': 'Singapore',
  'ph-en': 'Philippines',
  'my-en': 'Malaysia',
  'id-en': 'Indonesia',
  'th-en': 'Thailand',
  'vn-en': 'Vietnam',
  'de-de': 'Germany',
  'fr-fr': 'France',
  'es-es': 'Spain',
  'it-it': 'Italy',
  'nl-nl': 'Netherlands',
  'be-fr': 'Belgium (French)',
  'be-nl': 'Belgium (Dutch)',
  'ch-de': 'Switzerland (German)',
  'ch-fr': 'Switzerland (French)',
  'ch-it': 'Switzerland (Italian)',
  'at-de': 'Austria',
  'pt-pt': 'Portugal',
  'br-pt': 'Brazil',
  'mx-es': 'Mexico',
  'ar-es': 'Argentina',
  'cl-es': 'Chile',
  'co-es': 'Colombia',
  'pe-es': 'Peru',
  've-es': 'Venezuela',
  'ec-es': 'Ecuador',
  'gt-es': 'Guatemala',
  'cu-es': 'Cuba',
  'bo-es': 'Bolivia',
  'do-es': 'Dominican Republic',
  'hn-es': 'Honduras',
  'py-es': 'Paraguay',
  'sv-es': 'El Salvador',
  'ni-es': 'Nicaragua',
  'cr-es': 'Costa Rica',
  'pa-es': 'Panama',
  'uy-es': 'Uruguay',
  'pr-es': 'Puerto Rico',
  'ru-ru': 'Russia',
  'ua-uk': 'Ukraine',
  'tr-tr': 'Turkey',
  'gr-el': 'Greece',
  'il-he': 'Israel',
  'sa-ar': 'Saudi Arabia',
  'ae-ar': 'United Arab Emirates',
  'eg-ar': 'Egypt',
  'jp-jp': 'Japan',
  'cn-zh': 'China',
  'tw-zh': 'Taiwan',
  'hk-zh': 'Hong Kong',
  'kr-kr': 'South Korea',
};

/**
 * Supported languages
 */
export const SUPPORTED_LANGUAGES: Record<string, string> = {
  '': 'All Languages',
  'en': 'English',
  'es': 'Spanish',
  'fr': 'French',
  'de': 'German',
  'it': 'Italian',
  'pt': 'Portuguese',
  'nl': 'Dutch',
  'sv': 'Swedish',
  'no': 'Norwegian',
  'da': 'Danish',
  'fi': 'Finnish',
  'ru': 'Russian',
  'pl': 'Polish',
  'tr': 'Turkish',
  'cs': 'Czech',
  'hu': 'Hungarian',
  'ro': 'Romanian',
  'el': 'Greek',
  'uk': 'Ukrainian',
  'he': 'Hebrew',
  'ar': 'Arabic',
  'fa': 'Persian',
  'hi': 'Hindi',
  'bn': 'Bengali',
  'ta': 'Tamil',
  'te': 'Telugu',
  'mr': 'Marathi',
  'gu': 'Gujarati',
  'ja': 'Japanese',
  'ko': 'Korean',
  'zh': 'Chinese',
  'id': 'Indonesian',
  'ms': 'Malay',
  'th': 'Thai',
  'vi': 'Vietnamese',
};

/**
 * Date range options
 */
export const DATE_RANGE_OPTIONS = {
  'day': 'd',
  'week': 'w',
  'month': 'm',
  'year': 'y',
};

/**
 * Get search filters from node parameters
 */
export function getSearchFilters(
  context: IExecuteFunctions,
  itemIndex: number
): ISearchFilters {
  const filters: ISearchFilters = {};

  // Region filter
  const useRegionFilter = context.getNodeParameter('useRegionFilter', itemIndex, false) as boolean;
  if (useRegionFilter) {
    const region = context.getNodeParameter('region', itemIndex, 'wt-wt') as string;
    if (region && SUPPORTED_REGIONS[region]) {
      filters.region = region;
    }
  }

  // Language filter
  const useLanguageFilter = context.getNodeParameter('useLanguageFilter', itemIndex, false) as boolean;
  if (useLanguageFilter) {
    const language = context.getNodeParameter('language', itemIndex, '') as string;
    if (language && SUPPORTED_LANGUAGES[language] !== undefined) {
      filters.language = language;
    }
  }

  // Date range filter
  const useDateFilter = context.getNodeParameter('useDateFilter', itemIndex, false) as boolean;
  if (useDateFilter) {
    const dateRangeType = context.getNodeParameter('dateRangeType', itemIndex, 'month') as string;

    filters.dateRange = {
      type: dateRangeType as any,
    };

    if (dateRangeType === 'custom') {
      const dateFrom = context.getNodeParameter('dateFrom', itemIndex, '') as string;
      const dateTo = context.getNodeParameter('dateTo', itemIndex, '') as string;

      if (dateFrom) filters.dateRange.from = dateFrom;
      if (dateTo) filters.dateRange.to = dateTo;
    }
  }

  // Safe search filter
  const safeSearch = context.getNodeParameter('safeSearch', itemIndex, 'moderate') as string;
  filters.safeSearch = safeSearch as 'strict' | 'moderate' | 'off';

  return filters;
}

/**
 * Apply filters to search options
 */
export function applyFiltersToSearch(
  baseOptions: SearchOptions,
  filters: ISearchFilters
): SearchOptions {
  const options = { ...baseOptions };

  // Apply region
  if (filters.region && filters.region !== 'wt-wt') {
    options.locale = filters.region;
  }

    // Apply safe search
  if (filters.safeSearch) {
    (options as any).safeSearch = filters.safeSearch === 'strict' ? 1 :
                                  filters.safeSearch === 'moderate' ? 0 :
                                  -1;
  }

  // Apply date range
  if (filters.dateRange) {
    if (filters.dateRange.type === 'custom' && filters.dateRange.from && filters.dateRange.to) {
      // Custom date range - add to query
      const fromDate = new Date(filters.dateRange.from).toISOString().split('T')[0];
      const toDate = new Date(filters.dateRange.to).toISOString().split('T')[0];
      (options as any).time = `${fromDate}..${toDate}`;
    } else if (filters.dateRange.type !== 'custom' && DATE_RANGE_OPTIONS[filters.dateRange.type]) {
      // Predefined date range
      (options as any).time = DATE_RANGE_OPTIONS[filters.dateRange.type];
    }
  }

  return options;
}

/**
 * Build filter summary for logging
 */
export function buildFilterSummary(filters: ISearchFilters): string {
  const parts: string[] = [];

  if (filters.region && filters.region !== 'wt-wt') {
    parts.push(`Region: ${SUPPORTED_REGIONS[filters.region] || filters.region}`);
  }

  if (filters.language) {
    parts.push(`Language: ${SUPPORTED_LANGUAGES[filters.language] || filters.language}`);
  }

  if (filters.dateRange) {
    if (filters.dateRange.type === 'custom') {
      parts.push(`Date: ${filters.dateRange.from || 'any'} to ${filters.dateRange.to || 'now'}`);
    } else {
      parts.push(`Date: Last ${filters.dateRange.type}`);
    }
  }

  if (filters.safeSearch && filters.safeSearch !== 'moderate') {
    parts.push(`SafeSearch: ${filters.safeSearch}`);
  }

  return parts.length > 0 ? `Filters: ${parts.join(', ')}` : 'No filters applied';
}

/**
 * Validate custom date range
 */
export function validateDateRange(from: string, to: string): void {
  if (!from || !to) {
    throw new Error('Both from and to dates are required for custom date range');
  }

  const fromDate = new Date(from);
  const toDate = new Date(to);

  if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
    throw new Error('Invalid date format. Please use YYYY-MM-DD format');
  }

  if (fromDate > toDate) {
    throw new Error('From date must be before or equal to To date');
  }

  const now = new Date();
  if (toDate > now) {
    throw new Error('To date cannot be in the future');
  }
}

/**
 * Get region options for UI
 */
export function getRegionOptions() {
  return Object.entries(SUPPORTED_REGIONS).map(([value, name]) => ({
    name,
    value,
  }));
}

/**
 * Get language options for UI
 */
export function getLanguageOptions() {
  return Object.entries(SUPPORTED_LANGUAGES).map(([value, name]) => ({
    name,
    value,
  }));
}
