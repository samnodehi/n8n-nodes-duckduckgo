import { IExecuteFunctions } from 'n8n-workflow';
import { reportEvent, setTelemetryEndpoint } from '../telemetry';
import * as https from 'https';

// Mock the https module
jest.mock('https', () => ({
  request: jest.fn(),
}));

describe('Telemetry Module', () => {
  let mockExecuteFunction: IExecuteFunctions;
  let mockNodeStaticData: Record<string, any>;
  let mockTelemetryEnabled: boolean;
  let mockRequest: any;

  beforeEach(() => {
    // Create a mock for the static data
    mockNodeStaticData = {};

    // Set default telemetry to disabled for tests
    mockTelemetryEnabled = false;

    // Mock the execute functions context
    mockExecuteFunction = {
      getNodeParameter: jest.fn().mockImplementation((parameterName: string) => {
        if (parameterName === 'enableTelemetry') {
          return mockTelemetryEnabled;
        }
        return undefined;
      }),
      getWorkflowStaticData: jest.fn().mockImplementation(() => mockNodeStaticData),
    } as unknown as IExecuteFunctions;

    // Mock https.request
    mockRequest = {
      on: jest.fn(),
      write: jest.fn(),
      end: jest.fn(),
    };
    (https.request as jest.Mock).mockReturnValue(mockRequest);

    // Reset all mocks
    jest.clearAllMocks();
  });

  it('should not send telemetry when disabled', async () => {
    // Set telemetry to disabled
    mockTelemetryEnabled = false;

    // Call the reportEvent function
    await reportEvent(mockExecuteFunction, 'test_event', { test: 'data' });

    // Verify no request was made
    expect(https.request).not.toHaveBeenCalled();
  });

  it('should not send telemetry when enabled but no endpoint configured', async () => {
    // Set telemetry to enabled but no endpoint
    mockTelemetryEnabled = true;
    mockNodeStaticData.telemetryEndpoint = '';

    // Call the reportEvent function
    await reportEvent(mockExecuteFunction, 'test_event', { test: 'data' });

    // Verify no request was made (no endpoint configured)
    expect(https.request).not.toHaveBeenCalled();
  });

  it('should send telemetry when enabled and endpoint is configured', async () => {
    // Set telemetry to enabled and configure endpoint
    mockTelemetryEnabled = true;
    mockNodeStaticData.telemetryEndpoint = 'https://telemetry.example.com/collect';

    // Mock successful response
    const mockResponse = {
      statusCode: 200,
      on: jest.fn(),
    };
    (https.request as jest.Mock).mockImplementation((options, callback) => {
      callback(mockResponse);
      return mockRequest;
    });

    // Call the reportEvent function
    await reportEvent(mockExecuteFunction, 'test_event', { test: 'data' });

    // Verify a request was made
    expect(https.request).toHaveBeenCalled();
    expect(mockRequest.write).toHaveBeenCalled();
    expect(mockRequest.end).toHaveBeenCalled();
  });

  it('should generate and reuse a node run ID', async () => {
    // Set telemetry to enabled and configure endpoint
    mockTelemetryEnabled = true;
    mockNodeStaticData.telemetryEndpoint = 'https://telemetry.example.com/collect';

    // Mock successful response
    const mockResponse = {
      statusCode: 200,
      on: jest.fn(),
    };
    (https.request as jest.Mock).mockImplementation((options, callback) => {
      callback(mockResponse);
      return mockRequest;
    });

    // Call the reportEvent function twice
    await reportEvent(mockExecuteFunction, 'test_event1', { test: 'data1' });
    await reportEvent(mockExecuteFunction, 'test_event2', { test: 'data2' });

    // Verify that a nodeRunId was generated and stored
    expect(mockNodeStaticData.nodeRunId).toBeDefined();

    // Verify that the same ID was used for both calls
    const writeCall1 = mockRequest.write.mock.calls[0][0];
    const writeCall2 = mockRequest.write.mock.calls[1][0];

    const data1 = JSON.parse(writeCall1);
    const data2 = JSON.parse(writeCall2);

    expect(data1.nodeRunId).toBe(mockNodeStaticData.nodeRunId);
    expect(data1.nodeRunId).toBe(data2.nodeRunId);
  });

  it('should allow setting a custom telemetry endpoint', async () => {
    // Set telemetry to enabled
    mockTelemetryEnabled = true;

    // Set a custom endpoint
    const customEndpoint = 'https://custom.example.com/telemetry';
    setTelemetryEndpoint(mockExecuteFunction, customEndpoint);

    // Mock successful response
    const mockResponse = {
      statusCode: 200,
      on: jest.fn(),
    };
    (https.request as jest.Mock).mockImplementation((options, callback) => {
      callback(mockResponse);
      return mockRequest;
    });

    // Call the reportEvent function
    await reportEvent(mockExecuteFunction, 'test_event', { test: 'data' });

    // Verify the request was made to the custom endpoint
    const requestCall = (https.request as jest.Mock).mock.calls[0][0];
    expect(requestCall.hostname).toBe('custom.example.com');
    expect(requestCall.path).toBe('/telemetry');
  });
});
