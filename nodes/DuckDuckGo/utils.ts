/**
 * Utility functions for DuckDuckGo node
 */

const HTML_ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&nbsp;': ' ',
  '&ndash;': '–',
  '&mdash;': '—',
  '&hellip;': '…',
};

export function decodeHtmlEntities(text: string | null | undefined): string | null {
  if (!text) return null;
  return text.replace(/&[#\w]+;/g, (entity) => HTML_ENTITIES[entity] || entity);
}

export function formatDate(timestamp: number | null | undefined): string | null {
  if (!timestamp) return null;
  try {
    return new Date(timestamp * 1000).toISOString();
  } catch {
    return null;
  }
}
