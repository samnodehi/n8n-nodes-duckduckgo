# DuckDuckGo Node Telemetry

This document explains the telemetry features built into the DuckDuckGo node for n8n.

## Overview

The DuckDuckGo node includes an optional telemetry system that can send anonymous usage data to help improve the functionality and performance of the node. Telemetry is **disabled by default** and must be explicitly enabled by the user.

## Privacy Considerations

- All telemetry data is anonymous
- No personal data or search queries are transmitted without explicit consent
- Telemetry is disabled by default
- All telemetry submissions include only technical information like operation type, result counts, and performance metrics

## Telemetry Data Collected

When enabled, the following types of events are tracked:

### 1. `search_started`
Sent when a search operation begins.
```json
{
  "eventName": "search_started",
  "timestamp": 1656789012345,
  "nodeRunId": "a1b2c3d4-e5f6-g7h8-i9j0-k1l2m3n4o5p6",
  "operation": "search",
  "searchOptions": {
    "safeSearch": 1,
    "locale": "en-us"
  }
}
```

### 2. `search_completed`
Sent when a search operation completes successfully.
```json
{
  "eventName": "search_completed",
  "timestamp": 1656789012445,
  "nodeRunId": "a1b2c3d4-e5f6-g7h8-i9j0-k1l2m3n4o5p6",
  "operation": "search",
  "durationMs": 100,
  "resultCount": 25,
  "fromCache": false
}
```

### 3. `search_failed`
Sent when a search operation fails.
```json
{
  "eventName": "search_failed",
  "timestamp": 1656789012345,
  "nodeRunId": "a1b2c3d4-e5f6-g7h8-i9j0-k1l2m3n4o5p6",
  "operation": "searchImages",
  "durationMs": 1050,
  "error": "Network error",
  "errorType": "Error"
}
```

### 4. `node_error`
Sent when an unexpected error occurs in the node.
```json
{
  "eventName": "node_error",
  "timestamp": 1656789012345,
  "nodeRunId": "a1b2c3d4-e5f6-g7h8-i9j0-k1l2m3n4o5p6",
  "error": "Unexpected error",
  "errorType": "NodeOperationError"
}
```

## How to Enable/Disable Telemetry

Telemetry is controlled by the `Enable Telemetry` parameter in the node settings. This parameter is set to `false` by default, meaning no telemetry data is collected or sent unless the user explicitly enables it.

## Technical Implementation

The telemetry system consists of several components:

1. **Node Run ID**: A unique ID generated for each node execution to correlate related events
2. **Workflow Static Data**: Used to store the Node Run ID between executions
3. **Asynchronous Reporting**: Telemetry is sent asynchronously to avoid impacting node performance
4. **Error Handling**: Telemetry errors are caught and logged but never impact node operation

## Customizing Telemetry

For enterprise deployments, the telemetry endpoint can be customized programmatically:

```typescript
import { setTelemetryEndpoint } from './telemetry';

// Set a custom endpoint
setTelemetryEndpoint(this, 'https://your-telemetry-server.com/collect');
```

## Telemetry Endpoint Format

The telemetry endpoint should accept HTTP POST requests with JSON payload. The expected response is a 200-299 status code for successful submission.

The endpoint URL defaults to `https://telemetry.example.com/collect` and should be replaced with a real endpoint in production builds.

## Telemetry Data Retention

Telemetry data should be retained only as long as necessary for analysis purposes. A retention period of 90 days is recommended for most metrics.

---

For questions about the telemetry implementation, please contact the node maintainers. 
