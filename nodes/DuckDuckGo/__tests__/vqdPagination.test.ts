import {
  paginateWithVqd,
  clearVqdTokenCache,
  getVqdTokenCacheSize,
  IPaginationOptions,
} from '../vqdPagination';

// Mock duck-duck-scrape
jest.mock('duck-duck-scrape', () => ({
  search: jest.fn(),
}));

import { search } from 'duck-duck-scrape';
const mockSearch = search as jest.Mock;

describe('VQD Pagination', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearVqdTokenCache();
  });

  describe('paginateWithVqd', () => {
    it('should fetch results with VQD token', async () => {
      // Mock initial search response
      mockSearch.mockResolvedValueOnce({
        results: [
          { title: 'Result 1', url: 'https://example1.com' },
          { title: 'Result 2', url: 'https://example2.com' },
        ],
        vqd: 'test-vqd-token-123',
      });

      const options: IPaginationOptions = {
        maxResults: 5,
        pageSize: 10,
        maxPages: 3,
        delayBetweenRequests: 10, // Short delay for tests
        debugMode: false,
      };

      const result = await paginateWithVqd('test query', {}, options);

      expect(result.results).toHaveLength(2);
      expect(result.totalFetched).toBe(2);
      expect(result.pagesProcessed).toBe(1);
      expect(result.vqdToken).toBe('test-vqd-token-123');
      expect(result.hasMore).toBe(false);
    });

    it('should handle pagination with multiple pages', async () => {
      // Mock responses for multiple pages
      mockSearch
        .mockResolvedValueOnce({
          results: Array(10).fill(null).map((_, i) => ({
            title: `Result ${i + 1}`,
            url: `https://example${i + 1}.com`,
          })),
          vqd: 'test-vqd-token-123',
        })
        .mockResolvedValueOnce({
          results: Array(10).fill(null).map((_, i) => ({
            title: `Result ${i + 11}`,
            url: `https://example${i + 11}.com`,
          })),
          vqd: 'test-vqd-token-123', // Same token
        })
        .mockResolvedValueOnce({
          results: Array(5).fill(null).map((_, i) => ({
            title: `Result ${i + 21}`,
            url: `https://example${i + 21}.com`,
          })),
          vqd: 'test-vqd-token-123',
        });

      const options: IPaginationOptions = {
        maxResults: 25,
        pageSize: 10,
        maxPages: 5,
        delayBetweenRequests: 10,
        debugMode: false,
      };

      const result = await paginateWithVqd('test query', {}, options);

      expect(result.results).toHaveLength(25); // Should respect maxResults
      expect(result.totalFetched).toBe(25);
      expect(result.pagesProcessed).toBe(3);
      expect(mockSearch).toHaveBeenCalledTimes(3);
    });

    it('should use cached VQD token for same query', async () => {
      // First call - should fetch VQD token
      mockSearch.mockResolvedValueOnce({
        results: [{ title: 'Result 1', url: 'https://example1.com' }],
        vqd: 'cached-vqd-token',
      });

      await paginateWithVqd('cached query', {}, {
        maxResults: 1,
        pageSize: 10,
        maxPages: 1,
        delayBetweenRequests: 10,
      });

      expect(getVqdTokenCacheSize()).toBe(1);

      // Second call - should use cached token
      mockSearch.mockClear();
      mockSearch.mockResolvedValueOnce({
        results: [{ title: 'Result 2', url: 'https://example2.com' }],
        vqd: 'cached-vqd-token',
      });

      await paginateWithVqd('cached query', {}, {
        maxResults: 1,
        pageSize: 10,
        maxPages: 1,
        delayBetweenRequests: 10,
      });

      // Should use cached token with offset
      expect(mockSearch).toHaveBeenCalledWith(
        'cached query',
        expect.objectContaining({
          vqd: 'cached-vqd-token',
          offset: 0,
        })
      );
    });

    it('should handle VQD token refresh on error', async () => {
      // Initial search with VQD token
      mockSearch.mockResolvedValueOnce({
        results: Array(10).fill(null).map((_, i) => ({
          title: `Result ${i + 1}`,
          url: `https://example${i + 1}.com`,
        })),
        vqd: 'initial-vqd-token',
      });

      // Second page fails with VQD error
      mockSearch.mockRejectedValueOnce(new Error('Invalid vqd token'));

      // Token refresh attempt
      mockSearch.mockResolvedValueOnce({
        results: [],
        vqd: 'refreshed-vqd-token',
      });

      // Retry with new token
      mockSearch.mockResolvedValueOnce({
        results: Array(5).fill(null).map((_, i) => ({
          title: `Result ${i + 11}`,
          url: `https://example${i + 11}.com`,
        })),
        vqd: 'refreshed-vqd-token',
      });

      const options: IPaginationOptions = {
        maxResults: 20,
        pageSize: 10,
        maxPages: 5,
        delayBetweenRequests: 10,
        debugMode: false,
      };

      const result = await paginateWithVqd('test query', {}, options);

      expect(result.results).toHaveLength(15);
      expect(result.vqdToken).toBe('refreshed-vqd-token');
      expect(mockSearch).toHaveBeenCalledTimes(4); // Initial + error + refresh + retry
    });

    it('should handle consecutive errors gracefully', async () => {
      // Initial search succeeds
      mockSearch.mockResolvedValueOnce({
        results: [{ title: 'Result 1', url: 'https://example1.com' }],
        vqd: 'test-vqd-token',
      });

      // Multiple consecutive errors
      mockSearch.mockRejectedValueOnce(new Error('Network error'));
      mockSearch.mockRejectedValueOnce(new Error('Network error'));
      mockSearch.mockRejectedValueOnce(new Error('Network error'));

      const options: IPaginationOptions = {
        maxResults: 50,
        pageSize: 10,
        maxPages: 10,
        delayBetweenRequests: 10,
        debugMode: false,
      };

      const result = await paginateWithVqd('test query', {}, options);

      expect(result.results).toHaveLength(1); // Only initial results
      expect(result.hasMore).toBe(false);
      // Should stop after maxConsecutiveErrors (3)
      expect(mockSearch).toHaveBeenCalledTimes(4); // 1 success + 3 errors
    });

    it('should detect last page when fewer results than page size', async () => {
      mockSearch
        .mockResolvedValueOnce({
          results: Array(10).fill(null).map((_, i) => ({
            title: `Result ${i + 1}`,
            url: `https://example${i + 1}.com`,
          })),
          vqd: 'test-vqd-token',
        })
        .mockResolvedValueOnce({
          results: Array(3).fill(null).map((_, i) => ({
            title: `Result ${i + 11}`,
            url: `https://example${i + 11}.com`,
          })),
          vqd: 'test-vqd-token',
        });

      const options: IPaginationOptions = {
        maxResults: 50,
        pageSize: 10,
        maxPages: 10,
        delayBetweenRequests: 10,
        debugMode: false,
      };

      const result = await paginateWithVqd('test query', {}, options);

      expect(result.results).toHaveLength(13);
      expect(result.hasMore).toBe(false);
      expect(mockSearch).toHaveBeenCalledTimes(2); // Should stop after getting < pageSize results
    });

    it('should respect maxPages limit', async () => {
      // Mock many pages of results
      for (let i = 0; i < 10; i++) {
        mockSearch.mockResolvedValueOnce({
          results: Array(10).fill(null).map((_, j) => ({
            title: `Result ${i * 10 + j + 1}`,
            url: `https://example${i * 10 + j + 1}.com`,
          })),
          vqd: 'test-vqd-token',
        });
      }

      const options: IPaginationOptions = {
        maxResults: 100,
        pageSize: 10,
        maxPages: 3, // Limit to 3 pages
        delayBetweenRequests: 10,
        debugMode: false,
      };

      const result = await paginateWithVqd('test query', {}, options);

      expect(result.results).toHaveLength(30); // 3 pages * 10 results
      expect(result.pagesProcessed).toBe(3);
      expect(mockSearch).toHaveBeenCalledTimes(3);
    });

    it('should add search options to pagination requests', async () => {
      mockSearch.mockResolvedValueOnce({
        results: [{ title: 'Result 1', url: 'https://example1.com' }],
        vqd: 'test-vqd-token',
      });

      const searchOptions = {
        locale: 'de-de',
        safeSearch: 2,
        timePeriod: 'd', // Past day
      };

      const options: IPaginationOptions = {
        maxResults: 5,
        pageSize: 10,
        maxPages: 1,
        delayBetweenRequests: 10,
        debugMode: false,
      };

      await paginateWithVqd('test query', searchOptions as any, options);

      expect(mockSearch).toHaveBeenCalledWith(
        'test query',
        expect.objectContaining({
          locale: 'de-de',
          safeSearch: 2,
          timePeriod: 'd',
        })
      );
    });
  });

  describe('VQD Token Cache', () => {
    it('should clear cache', async () => {
      // Add token to cache
      mockSearch.mockResolvedValueOnce({
        results: [{ title: 'Result 1', url: 'https://example1.com' }],
        vqd: 'test-token',
      });

      await paginateWithVqd('test', {}, {
        maxResults: 1,
        pageSize: 10,
        maxPages: 1,
        delayBetweenRequests: 10,
      });

      expect(getVqdTokenCacheSize()).toBe(1);

      clearVqdTokenCache();
      expect(getVqdTokenCacheSize()).toBe(0);
    });
  });
});
