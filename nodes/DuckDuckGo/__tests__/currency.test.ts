import { convertCurrency, SUPPORTED_CURRENCIES } from '../currency';
import { IExecuteFunctions } from 'n8n-workflow';

// Mock duck-duck-scrape
jest.mock('duck-duck-scrape', () => ({
  currency: jest.fn(),
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

describe('Currency', () => {
  const DDG = require('duck-duck-scrape');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('convertCurrency', () => {
    it('should convert currency successfully', async () => {
      const mockCurrencyData = {
        conversion: 92.50,
        exchangeRate: 0.925,
        fromCurrencyName: 'US Dollar',
        toCurrencyName: 'Euro',
      };

      DDG.currency.mockResolvedValue(mockCurrencyData);

      const result = await convertCurrency('USD', 'EUR', 100, mockContext, 0);

      expect(result).toEqual({
        from: 'USD',
        to: 'EUR',
        amount: 100,
        convertedAmount: 92.50,
        exchangeRate: 0.925,
        fromName: 'US Dollar',
        toName: 'Euro',
        lastUpdated: expect.any(String),
      });

      expect(DDG.currency).toHaveBeenCalledWith('USD', 'EUR', 100);
      expect(setCache).toHaveBeenCalledWith('currency:USD:EUR:100', result, 300);
    });

    it('should handle exchange rate only response', async () => {
      const mockCurrencyData = {
        exchangeRate: 1.08,
      };

      DDG.currency.mockResolvedValue(mockCurrencyData);

      const result = await convertCurrency('EUR', 'USD', 50, mockContext, 0);

      expect(result).toEqual({
        from: 'EUR',
        to: 'USD',
        amount: 50,
        convertedAmount: 54, // 50 * 1.08
        exchangeRate: 1.08,
        fromName: 'EUR',
        toName: 'USD',
        lastUpdated: expect.any(String),
      });
    });

    it('should validate currency codes', async () => {
      await expect(
        convertCurrency('INVALID', 'USD', 100, mockContext, 0)
      ).rejects.toThrow('Unsupported currency code');

      await expect(
        convertCurrency('USD', 'INVALID', 100, mockContext, 0)
      ).rejects.toThrow('Unsupported currency code');
    });

    it('should handle case-insensitive currency codes', async () => {
      const mockCurrencyData = {
        conversion: 100,
        exchangeRate: 1,
      };

      DDG.currency.mockResolvedValue(mockCurrencyData);

      const result = await convertCurrency('usd', 'eur', 100, mockContext, 0);

      expect(DDG.currency).toHaveBeenCalledWith('USD', 'EUR', 100);
      expect(result.from).toBe('USD');
      expect(result.to).toBe('EUR');
    });

    it('should return empty data when conversion fails', async () => {
      DDG.currency.mockResolvedValue(null);

      const result = await convertCurrency('USD', 'EUR', 100, mockContext, 0);

      expect(result).toEqual({
        from: 'USD',
        to: 'EUR',
        amount: 100,
        convertedAmount: null,
        exchangeRate: null,
        fromName: null,
        toName: null,
        lastUpdated: null,
      });

      expect(mockContext.logger.warn).toHaveBeenCalledWith(
        'No currency conversion data found for USD to EUR'
      );
    });

    it('should use cached data when available', async () => {
      const cachedData = {
        from: 'USD',
        to: 'EUR',
        amount: 100,
        convertedAmount: 90,
        exchangeRate: 0.9,
      };

      (getCached as jest.Mock).mockReturnValue(cachedData);

      const result = await convertCurrency('USD', 'EUR', 100, mockContext, 0);

      expect(result).toEqual(cachedData);
      expect(DDG.currency).not.toHaveBeenCalled();
      expect(mockContext.logger.info).toHaveBeenCalledWith(
        'Using cached currency data for 100 USD to EUR'
      );
    });
  });

  describe('SUPPORTED_CURRENCIES', () => {
    it('should include major currencies', () => {
      expect(SUPPORTED_CURRENCIES).toContain('USD');
      expect(SUPPORTED_CURRENCIES).toContain('EUR');
      expect(SUPPORTED_CURRENCIES).toContain('GBP');
      expect(SUPPORTED_CURRENCIES).toContain('JPY');
      expect(SUPPORTED_CURRENCIES).toContain('CHF');
    });

    it('should have more than 50 currencies', () => {
      expect(SUPPORTED_CURRENCIES.length).toBeGreaterThan(50);
    });
  });
});
