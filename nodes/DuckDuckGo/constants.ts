/**
 * Constants for the DuckDuckGo node
 */

/**
 * Region options for DuckDuckGo search
 */
export const REGIONS = [
  { name: 'Argentina', value: 'ar-es' },
  { name: 'Australia', value: 'au-en' },
  { name: 'Austria', value: 'at-de' },
  { name: 'Belgium (Dutch)', value: 'be-nl' },
  { name: 'Belgium (French)', value: 'be-fr' },
  { name: 'Brazil', value: 'br-pt' },
  { name: 'Bulgaria', value: 'bg-bg' },
  { name: 'Canada (English)', value: 'ca-en' },
  { name: 'Canada (French)', value: 'ca-fr' },
  { name: 'Czech Republic', value: 'cz-cs' },
  { name: 'Denmark', value: 'dk-da' },
  { name: 'Estonia', value: 'ee-et' },
  { name: 'Finland', value: 'fi-fi' },
  { name: 'France', value: 'fr-fr' },
  { name: 'Germany', value: 'de-de' },
  { name: 'Greece', value: 'gr-el' },
  { name: 'Hong Kong', value: 'hk-tzh' },
  { name: 'Hungary', value: 'hu-hu' },
  { name: 'India (English)', value: 'in-en' },
  { name: 'Ireland', value: 'ie-en' },
  { name: 'Israel (English)', value: 'il-en' },
  { name: 'Italy', value: 'it-it' },
  { name: 'Japan', value: 'jp-jp' },
  { name: 'Korea', value: 'kr-kr' },
  { name: 'Latvia', value: 'lv-lv' },
  { name: 'Lithuania', value: 'lt-lt' },
  { name: 'Mexico', value: 'mx-es' },
  { name: 'Netherlands', value: 'nl-nl' },
  { name: 'New Zealand', value: 'nz-en' },
  { name: 'Norway', value: 'no-no' },
  { name: 'Poland', value: 'pl-pl' },
  { name: 'Portugal', value: 'pt-pt' },
  { name: 'Romania', value: 'ro-ro' },
  { name: 'Russia', value: 'ru-ru' },
  { name: 'Singapore', value: 'sg-en' },
  { name: 'Slovakia', value: 'sk-sk' },
  { name: 'Slovenia', value: 'sl-sl' },
  { name: 'Spain', value: 'es-es' },
  { name: 'Sweden', value: 'se-sv' },
  { name: 'Switzerland (French)', value: 'ch-fr' },
  { name: 'Switzerland (German)', value: 'ch-de' },
  { name: 'Taiwan', value: 'tw-tzh' },
  { name: 'United Kingdom', value: 'uk-en' },
  { name: 'United States (English)', value: 'us-en' },
  { name: 'United States (Spanish)', value: 'us-es' },
  { name: 'Vietnam', value: 'vn-vi' },
  { name: 'Worldwide', value: 'wt-wt' },
];

/**
 * Default parameters for the node
 */
export const DEFAULT_PARAMETERS = {
  REGION: 'wt-wt',
  MAX_RESULTS: 10,
  SAFE_SEARCH: 0,
  TIME_PERIOD: 'a', // 'a' is the value for 'all time'
};

/**
 * Node information constants
 */
export const NODE_INFO = {
  DISPLAY_NAME: 'DuckDuckGo',
  NAME: 'duckDuckGo',
  GROUP: 'transform',
  VERSION: 1,
  DESCRIPTION: 'Search using DuckDuckGo',
};

/**
 * Shared browser-like User-Agent to avoid programmatic detection
 */
export const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';
