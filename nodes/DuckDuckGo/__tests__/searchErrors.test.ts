import axios from 'axios';
import { NodeApiError, NodeOperationError } from 'n8n-workflow';
import { directWebSearch, directImageSearch } from '../directSearch';
import { TEST_NODE } from './testNode';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const axiosError = (props: Record<string, unknown>) =>
  Object.assign(new Error('underlying failure'), props);

describe('search failures are reported as n8n errors', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('DuckDuckGo answered, so the HTTP context is worth keeping', () => {
    it('reports a 429 as a NodeApiError carrying the status code', async () => {
      mockedAxios.post.mockRejectedValue(
        axiosError({ response: { status: 429, data: 'slow down' } }),
      );

      const error = await directWebSearch(TEST_NODE, 'anything').catch((e) => e);

      expect(error).toBeInstanceOf(NodeApiError);
      expect(error.httpCode).toBe('429');
      // The node's own wording survives; NodeApiError does not overwrite it.
      expect(error.message).toBe('Too many requests. Please wait a moment before trying again.');
    });

    it('reports a 5xx as a NodeApiError carrying the status code', async () => {
      mockedAxios.post.mockRejectedValue(
        axiosError({ response: { status: 503, data: '' } }),
      );

      const error = await directWebSearch(TEST_NODE, 'anything').catch((e) => e);

      expect(error).toBeInstanceOf(NodeApiError);
      expect(error.httpCode).toBe('503');
      expect(error.message).toBe('DuckDuckGo server error. Please try again later.');
    });

    it('attributes the failure to the node it was given', async () => {
      mockedAxios.post.mockRejectedValue(
        axiosError({ response: { status: 429, data: '' } }),
      );

      const error = await directWebSearch(TEST_NODE, 'anything').catch((e) => e);

      expect(error.node).toBe(TEST_NODE);
    });
  });

  describe('the request never got an answer, so there is no HTTP context', () => {
    // NodeApiError would replace the message with its own generic text for these
    // codes, which is why they take NodeOperationError instead.
    it.each([
      ['ECONNABORTED', 'Web search request timed out. Please try again.'],
      ['ENOTFOUND', 'Unable to connect to DuckDuckGo. Please check your internet connection.'],
      ['ECONNREFUSED', 'Unable to connect to DuckDuckGo. Please check your internet connection.'],
    ])('reports %s with the node\'s own wording intact', async (code, message) => {
      mockedAxios.post.mockRejectedValue(axiosError({ code }));

      const error = await directWebSearch(TEST_NODE, 'anything').catch((e) => e);

      expect(error).toBeInstanceOf(NodeOperationError);
      expect(error).not.toBeInstanceOf(NodeApiError);
      expect(error.message).toBe(message);
    });
  });

  describe('image search', () => {
    it('reports a 403 as a NodeApiError with the status code', async () => {
      // First GET returns the page carrying the token, second is the i.js call.
      mockedAxios.get = jest
        .fn()
        .mockResolvedValueOnce({ status: 200, data: 'vqd=3-123456789 rest of page' })
        .mockRejectedValueOnce(axiosError({ response: { status: 403, data: 'denied' } }));

      const error = await directImageSearch(TEST_NODE, 'cats').catch((e) => e);

      expect(error).toBeInstanceOf(NodeApiError);
      expect(error.httpCode).toBe('403');
      expect(error.message).toContain('403 Forbidden');
    });
  });
});
