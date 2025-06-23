import { getStockInfo } from '../stocks';
import { IExecuteFunctions } from 'n8n-workflow';

// Mock duck-duck-scrape
jest.mock('duck-duck-scrape', () => ({
  stocks: jest.fn(),
}));

// Mock cache
jest.mock('../cache', () => ({
  getCached: jest.fn(() => null),
  setCache: jest.fn(),
}));

// Mock telemetry
jest.mock('../telemetry', () => ({
  reportEvent: jest.fn(() => Promise.resolve()),
}));

import { getCached, setCache } from '../cache';

const mockContext = {
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
} as unknown as IExecuteFunctions;

describe('Stocks', () => {
  const DDG = require('duck-duck-scrape');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getStockInfo', () => {
    it('should get stock information for a symbol', async () => {
      const mockStockData = {
        symbol: 'AAPL',
        name: 'Apple Inc.',
        lastPrice: 185.50,
        change: 2.50,
        changePercent: 1.37,
        openPrice: 183.00,
        dayHigh: 186.00,
        dayLow: 182.50,
        volume: 45000000,
        marketCap: 2850000000000,
        peRatio: 30.5,
        week52High: 199.62,
        week52Low: 124.17,
        asOf: '2024-01-19T16:00:00Z',
      };

      DDG.stocks.mockResolvedValue(mockStockData);

      const result = await getStockInfo('AAPL', mockContext, 0);

      expect(result).toEqual({
        symbol: 'AAPL',
        name: 'Apple Inc.',
        price: 185.50,
        change: 2.50,
        changePercent: 1.37,
        open: 183.00,
        high: 186.00,
        low: 182.50,
        volume: 45000000,
        marketCap: 2850000000000,
        peRatio: 30.5,
        weekHigh52: 199.62,
        weekLow52: 124.17,
        lastUpdated: '2024-01-19T16:00:00Z',
      });

      expect(DDG.stocks).toHaveBeenCalledWith('AAPL');
      expect(setCache).toHaveBeenCalledWith('stock:AAPL', result, 60);
    });

    it('should return empty data when stock not found', async () => {
      DDG.stocks.mockResolvedValue(null);

      const result = await getStockInfo('INVALID', mockContext, 0);

      expect(result).toEqual({
        symbol: 'INVALID',
        name: null,
        price: null,
        change: null,
        changePercent: null,
        open: null,
        high: null,
        low: null,
        volume: null,
        marketCap: null,
        peRatio: null,
        weekHigh52: null,
        weekLow52: null,
        lastUpdated: null,
      });

      expect(mockContext.logger.warn).toHaveBeenCalledWith(
        'No stock data found for symbol: INVALID'
      );
    });

    it('should handle errors gracefully', async () => {
      DDG.stocks.mockRejectedValue(new Error('API Error'));

      await expect(
        getStockInfo('AAPL', mockContext, 0)
      ).rejects.toThrow('API Error');

      expect(mockContext.logger.error).toHaveBeenCalledWith(
        'Stock error for symbol AAPL: API Error'
      );
    });

    it('should use cached data when available', async () => {
      const cachedData = {
        symbol: 'AAPL',
        price: 180.00,
        name: 'Apple Inc. (Cached)',
      };

      (getCached as jest.Mock).mockReturnValue(cachedData);

      const result = await getStockInfo('AAPL', mockContext, 0);

      expect(result).toEqual(cachedData);
      expect(DDG.stocks).not.toHaveBeenCalled();
      expect(mockContext.logger.info).toHaveBeenCalledWith(
        'Using cached stock data for symbol: AAPL'
      );
    });
  });
});
