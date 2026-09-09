/**
 * Tests for resultRanking.ts.
 *
 * Two things carry most of the risk: a rule discarding something it was never
 * meant to match, and the order of unmatched results drifting. Most of these
 * assert that nothing moved.
 */

import { INodeExecutionData } from 'n8n-workflow';

import { applyRankingRules, rulesFromOptions, IRankingRule } from '../resultRanking';

const result = (url: string, position?: number): INodeExecutionData => ({
  json: { url, ...(position === undefined ? {} : { position }) },
  pairedItem: { item: 0 },
});

const urls = (items: INodeExecutionData[]) => items.map((i) => i.json.url);

const rule = (
  value: string,
  effect: IRankingRule['effect'],
  match: IRankingRule['match'] = 'domain',
): IRankingRule => ({ value, effect, match });

describe('applyRankingRules', () => {
  describe('does nothing without usable rules', () => {
    const items = [result('https://a.com/1'), result('https://b.com/2')];

    it.each([
      ['undefined', undefined],
      ['an empty list', []],
      ['rules with blank values', [rule('', 'discard'), rule('   ', 'boost')]],
    ])('returns the items untouched for %s', (_label, rules) => {
      expect(applyRankingRules(items, rules as IRankingRule[])).toBe(items);
    });

    it('returns an empty list untouched', () => {
      const empty: INodeExecutionData[] = [];
      expect(applyRankingRules(empty, [rule('a.com', 'discard')])).toBe(empty);
    });
  });

  describe('discard', () => {
    it('removes matching results and keeps the rest in order', () => {
      const items = [
        result('https://good.com/1'),
        result('https://spam.com/2'),
        result('https://other.com/3'),
      ];

      expect(urls(applyRankingRules(items, [rule('spam.com', 'discard')]))).toEqual([
        'https://good.com/1',
        'https://other.com/3',
      ]);
    });

    it('covers subdomains, because a domain means the site', () => {
      const items = [result('https://www.spam.com/a'), result('https://in.spam.com/b')];
      expect(applyRankingRules(items, [rule('spam.com', 'discard')])).toHaveLength(0);
    });

    it('does not match a domain that merely ends with the same letters', () => {
      const items = [result('https://notspam.com/a'), result('https://spam.com.evil.net/b')];
      expect(urls(applyRankingRules(items, [rule('spam.com', 'discard')]))).toEqual([
        'https://notspam.com/a',
        'https://spam.com.evil.net/b',
      ]);
    });

    it.each([
      ['a bare domain', 'spam.com'],
      ['a leading dot', '.spam.com'],
      ['a wildcard', '*.spam.com'],
    ])('accepts %s as the same rule', (_label, value) => {
      const items = [result('https://www.spam.com/a'), result('https://keep.com/b')];
      expect(urls(applyRankingRules(items, [rule(value, 'discard')]))).toEqual([
        'https://keep.com/b',
      ]);
    });
  });

  describe('ordering', () => {
    it('moves boosted results up and downranked ones down', () => {
      const items = [
        result('https://mid.com/1'),
        result('https://bad.com/2'),
        result('https://good.com/3'),
        result('https://other.com/4'),
      ];

      const out = applyRankingRules(items, [
        rule('good.com', 'boost'),
        rule('bad.com', 'downrank'),
      ]);

      expect(urls(out)).toEqual([
        'https://good.com/3',
        'https://mid.com/1',
        'https://other.com/4',
        'https://bad.com/2',
      ]);
    });

    it('keeps the original relative order inside each bucket', () => {
      const items = [
        result('https://x.com/1'),
        result('https://y.com/2'),
        result('https://x.com/3'),
        result('https://y.com/4'),
      ];

      const out = applyRankingRules(items, [rule('x.com', 'boost')]);

      expect(urls(out)).toEqual([
        'https://x.com/1',
        'https://x.com/3',
        'https://y.com/2',
        'https://y.com/4',
      ]);
    });

    it('leaves everything alone when a rule matches nothing', () => {
      const items = [result('https://a.com/1'), result('https://b.com/2')];
      expect(urls(applyRankingRules(items, [rule('nowhere.com', 'boost')]))).toEqual([
        'https://a.com/1',
        'https://b.com/2',
      ]);
    });
  });

  describe('rule precedence', () => {
    it('lets an earlier specific rule win over a later broad one', () => {
      // Keeping the documentation while dropping the rest of a site is the
      // reason the first match wins rather than a fixed order between actions.
      const items = [
        result('https://docs.example.com/guide'),
        result('https://blog.example.com/spam'),
      ];

      const out = applyRankingRules(items, [
        rule('docs.example.com', 'boost'),
        rule('example.com', 'discard'),
      ]);

      expect(urls(out)).toEqual(['https://docs.example.com/guide']);
    });

    it('applies only the first matching rule, whichever it is', () => {
      const items = [result('https://a.com/1')];
      const out = applyRankingRules(items, [rule('a.com', 'discard'), rule('a.com', 'boost')]);
      expect(out).toHaveLength(0);
    });
  });

  describe('URL matching', () => {
    it('matches anywhere in the URL', () => {
      const items = [result('https://a.com/amp/page'), result('https://a.com/real/page')];
      expect(urls(applyRankingRules(items, [rule('/amp/', 'discard', 'urlContains')]))).toEqual([
        'https://a.com/real/page',
      ]);
    });

    it('ignores case', () => {
      const items = [result('https://a.com/AMP/page')];
      expect(applyRankingRules(items, [rule('/amp/', 'discard', 'urlContains')])).toHaveLength(0);
    });
  });

  describe('results a rule cannot judge', () => {
    it.each([
      ['no url at all', { json: { title: 'x' } } as INodeExecutionData],
      ['an empty url', result('')],
      ['a url that does not parse', result('not a url')],
    ])('keeps a result with %s rather than discarding it', (_label, item) => {
      // Discarding something because its URL looked odd would lose data over a
      // rule it never had a chance to match.
      const out = applyRankingRules([item], [rule('anything.com', 'discard')]);
      expect(out).toHaveLength(1);
    });

    it('still matches a urlContains rule against an unparseable url', () => {
      const out = applyRankingRules(
        [result('not a url but contains spam')],
        [rule('spam', 'discard', 'urlContains')],
      );
      expect(out).toHaveLength(0);
    });
  });

  describe('position', () => {
    it('renumbers position to match the new order', () => {
      const items = [result('https://a.com/1', 1), result('https://b.com/2', 2)];
      const out = applyRankingRules(items, [rule('b.com', 'boost')]);

      expect(out.map((i) => [i.json.url, i.json.position])).toEqual([
        ['https://b.com/2', 1],
        ['https://a.com/1', 2],
      ]);
    });

    it('renumbers after a discard so the numbers have no gaps', () => {
      const items = [
        result('https://a.com/1', 1),
        result('https://gone.com/2', 2),
        result('https://c.com/3', 3),
      ];
      const out = applyRankingRules(items, [rule('gone.com', 'discard')]);
      expect(out.map((i) => i.json.position)).toEqual([1, 2]);
    });

    it('leaves results without a position alone', () => {
      const items = [result('https://a.com/1'), result('https://b.com/2')];
      const out = applyRankingRules(items, [rule('b.com', 'boost')]);
      expect(out.every((i) => i.json.position === undefined)).toBe(true);
    });

    it('does not modify the items it was given', () => {
      const items = [result('https://a.com/1', 1), result('https://b.com/2', 2)];
      applyRankingRules(items, [rule('b.com', 'boost')]);
      expect(items.map((i) => i.json.position)).toEqual([1, 2]);
    });
  });
});

describe('rulesFromOptions', () => {
  it('reads the rows out of the fixed collection shape n8n produces', () => {
    expect(
      rulesFromOptions({
        rule: [
          { match: 'domain', value: 'a.com', effect: 'discard' },
          { match: 'urlContains', value: '/amp/', effect: 'downrank' },
        ],
      }),
    ).toEqual([
      { match: 'domain', value: 'a.com', effect: 'discard' },
      { match: 'urlContains', value: '/amp/', effect: 'downrank' },
    ]);
  });

  it.each([
    ['undefined, as in a workflow saved before the option existed', undefined],
    ['an empty collection', {}],
    ['a collection with no rows', { rule: [] }],
    ['something that is not a collection', 'nonsense'],
    ['a collection whose rows are not an array', { rule: 'nonsense' }],
  ])('yields no rules for %s', (_label, value) => {
    expect(rulesFromOptions(value)).toEqual([]);
  });

  it.each([
    ['an unknown effect', { match: 'domain', value: 'a.com', effect: 'delete' }],
    ['an unknown match type', { match: 'title', value: 'a.com', effect: 'discard' }],
    ['a missing value', { match: 'domain', effect: 'discard' }],
    ['a non-string value', { match: 'domain', value: 42, effect: 'discard' }],
  ])('drops a row with %s rather than guessing at it', (_label, row) => {
    // A row this function cannot read is a row whose intent is unknown, and
    // guessing wrong could discard results the user wanted.
    expect(rulesFromOptions({ rule: [row] })).toEqual([]);
  });

  it('keeps the good rows when one row is unreadable', () => {
    const rules = rulesFromOptions({
      rule: [
        { match: 'domain', value: 'a.com', effect: 'discard' },
        { match: 'domain', value: 'b.com', effect: 'nonsense' },
      ],
    });
    expect(rules).toHaveLength(1);
    expect(rules[0].value).toBe('a.com');
  });
});
