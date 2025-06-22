/**
 * Telemetry reporting module for DuckDuckGo node
 *
 * Handles anonymous usage reporting for improving the node functionality
 */

import { IExecuteFunctions, IDataObject } from 'n8n-workflow';
import { request } from 'https';
import { v4 as uuidv4 } from 'uuid';

// Default telemetry endpoint - should be configurable in production
const DEFAULT_TELEMETRY_ENDPOINT = '';

/**
 * Interface for telemetry event data
 */
export interface ITelemetryEventData extends IDataObject {
  operation?: string;
  timestamp?: number;
  nodeRunId?: string;
  durationMs?: number;
  resultCount?: number;
  error?: string;
  [key: string]: any;
}

/**
 * Reports a telemetry event to the configured endpoint
 *
 * @param executeFunctions - The execute functions context
 * @param eventName - Name of the event being reported
 * @param data - Additional data to include with the event
 * @returns Promise that resolves when the event is reported
 */
export async function reportEvent(
  executeFunctions: IExecuteFunctions,
  eventName: string,
  data: ITelemetryEventData
): Promise<void> {
  try {
    // Get telemetry settings from node parameters - default to false
    const telemetryEnabled = executeFunctions.getNodeParameter('enableTelemetry', 0, false) as boolean;

    // Skip if telemetry is disabled
    if (!telemetryEnabled) {
      return;
    }

    // Get the telemetry endpoint from the static data or use default
    const nodeStaticData = executeFunctions.getWorkflowStaticData('node');
    const telemetryEndpoint = (nodeStaticData.telemetryEndpoint as string) || DEFAULT_TELEMETRY_ENDPOINT;

    // Skip if no endpoint is configured
    if (!telemetryEndpoint) {
      return;
    }

    // Get or generate a unique ID for this node run
    if (!nodeStaticData.nodeRunId) {
      // Generate a random ID for this execution
      nodeStaticData.nodeRunId = uuidv4();
    }

    // Prepare the payload
    const payload = {
      eventName,
      timestamp: Date.now(),
      nodeRunId: nodeStaticData.nodeRunId as string,
      ...data,
    };

    // Send the telemetry data asynchronously (don't await)
    sendTelemetryData(telemetryEndpoint, payload)
      .catch(error => console.error('Telemetry error:', error));

  } catch (error) {
    // Silently fail for telemetry - should not impact node operation
    if (executeFunctions.getNodeParameter('debugMode', 0, false)) {
      console.error('Telemetry reporting error:', error);
    }
  }
}

/**
 * Sends telemetry data to the specified endpoint
 *
 * @param endpoint - The URL to send telemetry data to
 * @param data - The data to send
 * @returns Promise that resolves when the data is sent
 */
function sendTelemetryData(endpoint: string, data: IDataObject): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      // Parse the URL to get hostname, path and port
      const url = new URL(endpoint);

      // Prepare the request payload
      const payload = JSON.stringify(data);

      // Prepare the request options
      const options = {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      };

      // Send the request
      const req = request(options, (res) => {
        // Get the response data
        const statusCode = res.statusCode || 500;

        // Consider 2xx status codes as success
        if (statusCode >= 200 && statusCode < 300) {
          resolve();
        } else {
          reject(new Error(`HTTP error: ${statusCode}`));
        }
      });

      // Handle request errors
      req.on('error', (error) => {
        reject(error);
      });

      // Send the data
      req.write(payload);
      req.end();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Sets a custom telemetry endpoint
 *
 * @param executeFunctions - The execute functions context
 * @param endpoint - The URL to send telemetry data to
 */
export function setTelemetryEndpoint(executeFunctions: IExecuteFunctions, endpoint: string): void {
  const nodeStaticData = executeFunctions.getWorkflowStaticData('node');
  nodeStaticData.telemetryEndpoint = endpoint;
}