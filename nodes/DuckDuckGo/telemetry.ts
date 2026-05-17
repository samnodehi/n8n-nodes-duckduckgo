/**
 * Telemetry reporting module for DuckDuckGo node
 *
 * TELEMETRY DISABLED: This module previously made outbound HTTPS requests
 * to an analytics endpoint, including user search queries and error details.
 * All network activity has been removed to protect user privacy. The README
 * states "No user tracking or data collection" — this module now enforces that.
 *
 * The exported function signatures are preserved so that existing call sites
 * in DuckDuckGo.node.ts do not require changes. All functions are no-ops.
 */

import { IExecuteFunctions, IDataObject } from 'n8n-workflow';

/**
 * Interface for telemetry event data — retained for type compatibility.
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
 * No-op. Previously sent telemetry events to an external endpoint.
 * Disabled to prevent transmission of user search queries and metadata.
 *
 * @param _executeFunctions - unused
 * @param _eventName - unused
 * @param _data - unused
 */
export async function reportEvent(
  _executeFunctions: IExecuteFunctions,
  _eventName: string,
  _data: ITelemetryEventData
): Promise<void> {
  // Intentional no-op. No network request is made. User data is not transmitted.
  return;
}

/**
 * No-op. Previously set a custom telemetry endpoint in workflow static data.
 * Disabled alongside reportEvent.
 *
 * @param _executeFunctions - unused
 * @param _endpoint - unused
 */
export function setTelemetryEndpoint(_executeFunctions: IExecuteFunctions, _endpoint: string): void {
  // Intentional no-op.
}