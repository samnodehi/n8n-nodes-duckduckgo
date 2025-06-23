import { IExecuteFunctions } from 'n8n-workflow';
import { IDuckDuckGoStockResult } from './types';
import { reportEvent } from './telemetry';
import { getCached, setCache } from './cache';
import { getGlobalRateLimiter } from './rateLimiter';
import { handleDuckDuckGoError, DuckDuckGoError, DuckDuckGoErrorType } from './errors';

const DDG = require('duck-duck-scrape');

/**
 * Get stock information for a symbol
 */
export async function getStockInfo(
  symbol: string,
  context: IExecuteFunctions,
  itemIndex: number
): Promise<IDuckDuckGoStockResult> {
  const cacheKey = `stock:${symbol}`;
  const cachedData = getCached<IDuckDuckGoStockResult>(cacheKey);

  if (cachedData) {
    context.logger.info(`Using cached stock data for symbol: ${symbol}`);
    return cachedData;
  }

  try {
    context.logger.info(`Getting stock information for symbol: ${symbol}`);

    // Apply rate limiting
    const rateLimiter = getGlobalRateLimiter();
    const canProceed = await rateLimiter.checkAndWait('stocks', context, itemIndex);

    if (!canProceed) {
      throw new DuckDuckGoError(
        'Rate limit exceeded for stock quotes',
        DuckDuckGoErrorType.RATE_LIMIT_EXCEEDED,
        {
          userMessage: 'Too many stock quote requests. Please wait a moment before trying again.',
        }
      );
    }

    const startTime = Date.now();
    const stockData = await DDG.stocks(symbol);

    await reportEvent(context, 'stock_lookup', {
      operation: 'stocks',
      durationMs: Date.now() - startTime,
      resultCount: stockData ? 1 : 0,
      parameters: { symbol }
    });

    if (!stockData) {
      context.logger.warn(`No stock data found for symbol: ${symbol}`);
      return {
        symbol,
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
      };
    }

    const result = formatStockResult(stockData);
    setCache(cacheKey, result, 60); // Cache for 1 minute (stock data changes frequently)

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    context.logger.error(`Stock error for symbol ${symbol}: ${errorMessage}`);

    // Use improved error handling
    throw handleDuckDuckGoError(error, 'stock lookup', {
      debugMode: true,
    });
  }
}

/**
 * Format stock result from duck-duck-scrape to our interface
 */
function formatStockResult(data: any): IDuckDuckGoStockResult {
  return {
    symbol: data.symbol || null,
    name: data.name || data.company || null,
    price: data.lastPrice || data.price || null,
    change: data.change || null,
    changePercent: data.changePercent || data.percentChange || null,
    open: data.openPrice || data.open || null,
    high: data.dayHigh || data.high || null,
    low: data.dayLow || data.low || null,
    volume: data.volume || null,
    marketCap: data.marketCap || null,
    peRatio: data.peRatio || data.pe || null,
    weekHigh52: data.week52High || data.yearHigh || null,
    weekLow52: data.week52Low || data.yearLow || null,
    lastUpdated: data.asOf || data.lastUpdated || new Date().toISOString(),
  };
}
