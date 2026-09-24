/**
 * What the node assumes about duck-duck-scrape, checked against the real
 * library rather than a mock. Every other suite mocks it, so without this a
 * library upgrade that changed either assumption would pass CI and misbehave
 * in production.
 *
 * `needle` is replaced so that nothing here can reach the network: a call that
 * gets as far as a request fails with a recognisable error instead.
 */

jest.mock('needle', () => {
  const needle = jest.fn(() => Promise.reject(new Error('network is off in this test')));
  return { __esModule: true, default: needle };
});

import { searchNews, searchVideos } from 'duck-duck-scrape';

// The shape of DuckDuckGo's tokens as of September 2026: one dash.
const CURRENT_TOKEN = '4-142907716215351487660642192699445978524';
const OLD_TOKEN = '3-123456789-98765432109876543210';

describe.each([
  ['searchNews', searchNews],
  ['searchVideos', searchVideos],
] as const)('%s', (_name, search) => {
  it('refuses a current one-dash token before sending anything, with the wording the node recognises', async () => {
    // explainPagingFailure in DuckDuckGo.node.ts matches this suffix. If this
    // fails because the library now accepts the token, paging may work again:
    // re-test it live and update the node, its docs and this test.
    await expect(search('solar power', { offset: 30, vqd: CURRENT_TOKEN } as any))
      .rejects.toThrow(new RegExp(`^${CURRENT_TOKEN} is an invalid VQD!$`));
  });

  it('lets a two-dash token through to the request', async () => {
    // Proves it is the token check, not something else, that refuses the one above.
    await expect(search('solar power', { offset: 30, vqd: OLD_TOKEN } as any))
      .rejects.toThrow('network is off in this test');
  });
});
