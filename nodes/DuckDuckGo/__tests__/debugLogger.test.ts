import type { Logger } from 'n8n-workflow';
import { createLogEntry, makeDebugLogger, LogLevel } from '../utils';

type MockLogger = Record<'debug' | 'info' | 'warn' | 'error', jest.Mock>;

const makeLogger = (): MockLogger => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const asLogger = (l: MockLogger) => l as unknown as Logger;

describe('makeDebugLogger', () => {
  it('returns nothing when Debug Mode is off, so call sites emit nothing', () => {
    expect(makeDebugLogger(asLogger(makeLogger()), false)).toBeUndefined();
  });

  it('routes each level to the matching logger method', () => {
    const logger = makeLogger();
    const debugLog = makeDebugLogger(asLogger(logger), true)!;

    debugLog(createLogEntry(LogLevel.ERROR, 'boom', 'search'));
    debugLog(createLogEntry(LogLevel.WARN, 'careful', 'search'));
    debugLog(createLogEntry(LogLevel.INFO, 'fyi', 'search'));
    debugLog(createLogEntry(LogLevel.DEBUG, 'detail', 'search'));

    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledTimes(1);
    // INFO and DEBUG both land on debug: an entry only exists because the user
    // asked for debugging, so it should not show up at the instance's info level.
    expect(logger.debug).toHaveBeenCalledTimes(2);
    expect(logger.info).not.toHaveBeenCalled();
  });

  it('passes the message separately and the rest as metadata', () => {
    const logger = makeLogger();
    const debugLog = makeDebugLogger(asLogger(logger), true)!;

    debugLog(createLogEntry(LogLevel.ERROR, 'request failed', 'webSearch', { query: 'cats' }));

    const [message, metadata] = logger.error.mock.calls[0];
    expect(message).toBe('request failed');
    expect(metadata).toMatchObject({
      level: LogLevel.ERROR,
      operation: 'webSearch',
      data: { query: 'cats' },
    });
    // The message must not be duplicated into the metadata bag.
    expect(metadata).not.toHaveProperty('message');
    expect(typeof metadata.timestamp).toBe('string');
  });
});
