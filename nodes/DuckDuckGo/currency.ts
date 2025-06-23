import { IExecuteFunctions } from 'n8n-workflow';
import { IDuckDuckGoCurrencyResult } from './types';
import { reportEvent } from './telemetry';
import { getCached, setCache } from './cache';
import { getGlobalRateLimiter } from './rateLimiter';
import { handleDuckDuckGoError, DuckDuckGoError, DuckDuckGoErrorType, ValidationError } from './errors';

const DDG = require('duck-duck-scrape');

/**
 * Currency codes supported by DuckDuckGo
 */
export const SUPPORTED_CURRENCIES = [
  'USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD',
  'CNY', 'INR', 'KRW', 'SGD', 'HKD', 'NOK', 'SEK', 'DKK',
  'PLN', 'CZK', 'HUF', 'RON', 'BGN', 'HRK', 'RUB', 'TRY',
  'BRL', 'MXN', 'ARS', 'CLP', 'COP', 'PEN', 'UYU', 'ZAR',
  'THB', 'MYR', 'IDR', 'PHP', 'VND', 'ILS', 'SAR', 'AED',
  'KWD', 'BHD', 'OMR', 'QAR', 'TWD', 'PKR', 'LKR', 'BDT',
  'NGN', 'KES', 'GHS', 'MAD', 'EGP', 'UAH', 'KZT', 'UZS',
];

/**
 * Convert currency using DuckDuckGo's currency API
 */
export async function convertCurrency(
  from: string,
  to: string,
  amount: number,
  context: IExecuteFunctions,
  itemIndex: number
): Promise<IDuckDuckGoCurrencyResult> {
  const cacheKey = `currency:${from}:${to}:${amount}`;
  const cachedData = getCached<IDuckDuckGoCurrencyResult>(cacheKey);

  if (cachedData) {
    context.logger.info(`Using cached currency data for ${amount} ${from} to ${to}`);
    return cachedData;
  }

  try {
    // Validate currency codes
    const fromUpper = from.toUpperCase();
    const toUpper = to.toUpperCase();

    if (!SUPPORTED_CURRENCIES.includes(fromUpper)) {
      throw new ValidationError(
        `Unsupported currency code: ${fromUpper}`,
        {
          field: 'from',
          value: fromUpper,
          validationRule: `Must be one of: ${SUPPORTED_CURRENCIES.join(', ')}`
        }
      );
    }

    if (!SUPPORTED_CURRENCIES.includes(toUpper)) {
      throw new ValidationError(
        `Unsupported currency code: ${toUpper}`,
        {
          field: 'to',
          value: toUpper,
          validationRule: `Must be one of: ${SUPPORTED_CURRENCIES.join(', ')}`
        }
      );
    }

    context.logger.info(`Converting ${amount} ${fromUpper} to ${toUpper}`);

    // Apply rate limiting
    const rateLimiter = getGlobalRateLimiter();
    const canProceed = await rateLimiter.checkAndWait('currency', context, itemIndex);

    if (!canProceed) {
      throw new DuckDuckGoError(
        'Rate limit exceeded for currency conversion',
        DuckDuckGoErrorType.RATE_LIMIT_EXCEEDED,
        {
          userMessage: 'Too many currency conversion requests. Please wait a moment before trying again.',
        }
      );
    }

    const startTime = Date.now();
    const result = await DDG.currency(fromUpper, toUpper, amount);

    await reportEvent(context, 'currency_conversion', {
      operation: 'currency',
      durationMs: Date.now() - startTime,
      resultCount: result ? 1 : 0,
      parameters: { from: fromUpper, to: toUpper, amount }
    });

    if (!result) {
      context.logger.warn(`No currency conversion data found for ${fromUpper} to ${toUpper}`);
      return {
        from: fromUpper,
        to: toUpper,
        amount,
        convertedAmount: null,
        exchangeRate: null,
        fromName: null,
        toName: null,
        lastUpdated: null,
      };
    }

    const formattedResult = formatCurrencyResult(result, fromUpper, toUpper, amount);
    setCache(cacheKey, formattedResult, 300); // Cache for 5 minutes

    return formattedResult;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    context.logger.error(`Currency conversion error (${from} to ${to}): ${errorMessage}`);

    // Use improved error handling
    throw handleDuckDuckGoError(error, 'currency conversion', {
      debugMode: true,
    });
  }
}

/**
 * Format currency result from duck-duck-scrape to our interface
 */
function formatCurrencyResult(data: any, from: string, to: string, amount: number): IDuckDuckGoCurrencyResult {
  // duck-duck-scrape returns a CurrencyResult object with conversion and exchangeRate properties
  const convertedAmount = data.conversion || data.convertedAmount || (data.exchangeRate ? amount * data.exchangeRate : null);

  return {
    from,
    to,
    amount,
    convertedAmount,
    exchangeRate: data.exchangeRate || (convertedAmount && amount ? convertedAmount / amount : null),
    fromName: data.fromCurrencyName || data.from || from,
    toName: data.toCurrencyName || data.to || to,
    lastUpdated: data.lastUpdated || new Date().toISOString(),
  };
}
