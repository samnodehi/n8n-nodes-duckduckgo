/** Made-up English pages for the tests of example 11. Nothing here is a real page. */

export const WORDS = [
  'amber', 'harbour', 'meadow', 'lantern', 'orchard', 'quarry', 'ribbon', 'saddle', 'thistle', 'umber', 'velvet', 'willow',
  'anchor', 'bramble', 'cobble', 'drift', 'ember', 'fennel', 'gravel', 'hollow',
];

/** A paragraph of n words that differs from the one made with another seed. */
export const prose = (n: number, seed = 0): string =>
  Array.from({ length: n }, (_, i) => WORDS[(i * 7 + seed * 3) % WORDS.length] + (i % 11 === 10 ? '.' : '')).join(' ');

/** The sentence a test quotes; it holds 17 words. */
export const SENTENCE = (n: number): string => `Sentence number ${n} about the pump trial is stated plainly in this paragraph of the page.`;

/** A page text that contains the sentences 1 to 12, long enough to count as a readable page. */
export const pageText = (extra = ''): string => `${Array.from({ length: 12 }, (_, i) => SENTENCE(i + 1)).join(' ')} ${extra} ${prose(60, 2)}`.trim();

/** One result of the Search node, as it comes back with Fetch Page Content on. */
export const result = (url: string, o: Record<string, unknown> = {}): Record<string, unknown> => ({
  title: 'Result ' + url,
  url,
  description: 'A short description of the result that is long enough to be used as a search snippet when the page was not read.',
  pageContent: pageText(),
  pageTitle: 'Page ' + url,
  ...o,
});

export const REQUEST = 'How do the pumps perform in the cold?';
