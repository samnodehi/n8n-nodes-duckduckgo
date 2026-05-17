import { IExecuteFunctions } from 'n8n-workflow';
import { reportEvent, setTelemetryEndpoint, ITelemetryEventData } from '../telemetry';
import * as https from 'https';

// Mock the https module so we can assert it is never called
jest.mock('https', () => ({
  request: jest.fn(),
}));

describe('Telemetry Module', () => {
  let mockExecuteFunction: IExecuteFunctions;
  let mockNodeStaticData: Record<string, any>;

  beforeEach(() => {
    mockNodeStaticData = {};
    mockExecuteFunction = {
      getNodeParameter: jest.fn().mockImplementation((parameterName: string) => {
        if (parameterName === 'enableTelemetry') return true; // even when enabled
        return undefined;
      }),
      getWorkflowStaticData: jest.fn().mockImplementation(() => mockNodeStaticData),
    } as unknown as IExecuteFunctions;

    jest.clearAllMocks();
  });

  describe('reportEvent is a no-op', () => {
    it('should never call https.request when enableTelemetry is false', async () => {
      (mockExecuteFunction.getNodeParameter as jest.Mock).mockImplementation(
        (parameterName: string) => (parameterName === 'enableTelemetry' ? false : undefined)
      );

      await reportEvent(mockExecuteFunction, 'test_event', { test: 'data' });

      expect(https.request).not.toHaveBeenCalled();
    });

    it('should never call https.request even when enableTelemetry is true', async () => {
      // This is the critical regression: even with enableTelemetry=true,
      // no outbound network request should occur.
      await reportEvent(mockExecuteFunction, 'test_event', { test: 'data' });

      expect(https.request).not.toHaveBeenCalled();
    });

    it('should return without error for any event name', async () => {
      const events = ['search_started', 'search_completed', 'search_failed', 'node_error'];
      for (const eventName of events) {
        await expect(
          reportEvent(mockExecuteFunction, eventName, { query: 'some user query', resultCount: 5 })
        ).resolves.toBeUndefined();
      }
      expect(https.request).not.toHaveBeenCalled();
    });

    it('should not transmit query strings or error details', async () => {
      const sensitiveData: ITelemetryEventData = {
        query: 'user private search query',
        error: 'user error details',
        operation: 'news search',
        durationMs: 123,
      };

      await reportEvent(mockExecuteFunction, 'search_failed', sensitiveData);

      // No network call means sensitive data was not transmitted
      expect(https.request).not.toHaveBeenCalled();
    });

    it('should be safe to call multiple times without side effects', async () => {
      await reportEvent(mockExecuteFunction, 'event1', {});
      await reportEvent(mockExecuteFunction, 'event2', {});
      await reportEvent(mockExecuteFunction, 'event3', {});

      expect(https.request).not.toHaveBeenCalled();
      // Static data should not be mutated (no nodeRunId written)
      expect(mockNodeStaticData.nodeRunId).toBeUndefined();
    });
  });

  describe('setTelemetryEndpoint is a no-op', () => {
    it('should not store an endpoint in static data', () => {
      setTelemetryEndpoint(mockExecuteFunction, 'https://custom.example.com/telemetry');

      // The no-op implementation must not write to static data
      expect(mockNodeStaticData.telemetryEndpoint).toBeUndefined();
    });
  });
});
