import type { INode } from 'n8n-workflow';

/**
 * A stand-in for the node the search helpers report failures against.
 *
 * `NodeApiError` and `NodeOperationError` both take an `INode` so the n8n UI can
 * attribute the failure; nothing in the helpers reads it beyond that, so one
 * shared literal is enough for every test.
 */
export const TEST_NODE: INode = {
  id: 'test-node',
  name: 'DuckDuckGo',
  type: 'n8n-nodes-duckduckgo-search.duckDuckGo',
  typeVersion: 1,
  position: [0, 0],
  parameters: {},
};
