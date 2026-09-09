/**
 * Local re-ranking of results that have already been fetched.
 *
 * A search engine ranks for everybody. A workflow usually wants something
 * narrower — only documentation sites, never content farms, this vendor's blog
 * before the aggregators that copy it. Doing that afterwards in a Filter or Sort
 * node means writing the same expression into every workflow and getting the
 * result count wrong, because discarding after the node has already cut to
 * `maxResults` leaves fewer results than were asked for.
 *
 * Everything here happens on results already in memory. No rule causes a
 * request, contacts a service, or leaves the process — a rule is applied to the
 * list the node just built, and nothing else.
 *
 * The ordering model is deliberately blunt: three buckets, not scores. Boosted
 * results keep their order among themselves and move above everything else,
 * downranked ones likewise below, and everything unmatched stays exactly where
 * DuckDuckGo put it. Weights would invite tuning a number nobody can reason
 * about, and a stable partition is something a user can predict from the rules
 * alone.
 */

import { INodeExecutionData, INodeProperties } from 'n8n-workflow';

/** What a rule does to the results it matches. */
export type RankingEffect = 'boost' | 'downrank' | 'discard';

/** What part of a result a rule is tested against. */
export type RankingMatch = 'domain' | 'urlContains';

export interface IRankingRule {
  match: RankingMatch;
  value: string;
  effect: RankingEffect;
}

/**
 * Does `hostname` belong to `domain`?
 *
 * A bare domain covers its subdomains, because a user writing `pinterest.com`
 * means the site, not the one hostname — `www.pinterest.com` and
 * `in.pinterest.com` are the same site to them. The boundary check on the
 * character before the suffix is what stops `notpinterest.com` matching.
 */
function hostMatchesDomain(hostname: string, domain: string): boolean {
  const host = hostname.toLowerCase();
  // Tolerate a leading "*." or "." so the three spellings a user might reach
  // for all behave the same.
  const suffix = domain.toLowerCase().replace(/^\*?\./, '');
  if (!suffix) {
    return false;
  }
  return host === suffix || host.endsWith(`.${suffix}`);
}

/** The URL a result carries, or an empty string when it has none. */
function urlOf(item: INodeExecutionData): string {
  const url = item.json?.url;
  return typeof url === 'string' ? url : '';
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

function ruleMatches(rule: IRankingRule, url: string, hostname: string): boolean {
  const value = rule.value?.trim();
  if (!value) {
    return false;
  }
  if (rule.match === 'domain') {
    return hostname !== '' && hostMatchesDomain(hostname, value);
  }
  return url.toLowerCase().includes(value.toLowerCase());
}

/**
 * Return the action for a result, or `undefined` when no rule applies.
 *
 * The first matching rule wins, so the order of the rules is the user's to
 * decide: a boost for `docs.example.com` written above a discard for
 * `example.com` keeps the documentation and drops the rest, which is a thing
 * people actually want and which any fixed precedence between actions would
 * make impossible.
 */
function effectFor(rules: IRankingRule[], item: INodeExecutionData): RankingEffect | undefined {
  const url = urlOf(item);
  if (!url) {
    // A result with no URL cannot match anything, and must never be discarded
    // by a rule it had no chance of matching.
    return undefined;
  }
  const hostname = hostnameOf(url);
  return rules.find((rule) => ruleMatches(rule, url, hostname))?.effect;
}

/**
 * Apply ranking rules to processed results.
 *
 * Returns a new array; the input is not modified. With no usable rules the
 * items are returned as they arrived, so the feature costs nothing when it is
 * not configured.
 *
 * `position` is renumbered when present, because a result labelled 1 sitting
 * third in the list is worse than no label at all.
 */
export function applyRankingRules(
  items: INodeExecutionData[],
  rules: IRankingRule[] | undefined,
): INodeExecutionData[] {
  const usable = (rules ?? []).filter((rule) => rule?.value?.trim());
  if (usable.length === 0 || items.length === 0) {
    return items;
  }

  const boosted: INodeExecutionData[] = [];
  const normal: INodeExecutionData[] = [];
  const downranked: INodeExecutionData[] = [];

  for (const item of items) {
    switch (effectFor(usable, item)) {
      case 'discard':
        break;
      case 'boost':
        boosted.push(item);
        break;
      case 'downrank':
        downranked.push(item);
        break;
      default:
        normal.push(item);
    }
  }

  const ranked = [...boosted, ...normal, ...downranked];

  return ranked.map((item, index) =>
    typeof item.json?.position === 'number'
      ? { ...item, json: { ...item.json, position: index + 1 } }
      : item,
  );
}

/**
 * The rules as they arrive from the node parameter.
 *
 * n8n wraps a fixed collection as `{ rule: [...] }`, and a workflow saved
 * before this option existed has no value at all, so the shape is checked
 * rather than assumed. Anything unrecognised yields no rules, which leaves the
 * results exactly as DuckDuckGo ordered them.
 */
export function rulesFromOptions(value: unknown): IRankingRule[] {
  const rules = (value as { rule?: unknown } | undefined)?.rule;
  if (!Array.isArray(rules)) {
    return [];
  }
  return rules.filter(
    (rule): rule is IRankingRule =>
      typeof rule?.value === 'string' &&
      (rule.effect === 'boost' || rule.effect === 'downrank' || rule.effect === 'discard') &&
      (rule.match === 'domain' || rule.match === 'urlContains'),
  );
}

/**
 * The "Ranking Rules" option, shared by every operation that returns ranked
 * results so the three cannot drift apart.
 */
export const rankingRulesProperty: INodeProperties = {
  displayName: 'Ranking Rules',
  name: 'rankingRules',
  type: 'fixedCollection',
  typeOptions: {
    multipleValues: true,
    sortable: true,
  },
  default: {},
  placeholder: 'Add Rule',
  description:
    'Reorder or drop results by where they come from, applied locally to the results already fetched — no extra requests. Rules are checked in order and the first match wins, so put specific rules above broad ones. Applied before Maximum Results, so discarding still returns the number you asked for.',
  options: [
    {
      displayName: 'Rule',
      name: 'rule',
      values: [
        {
          displayName: 'Match',
          name: 'match',
          type: 'options',
          options: [
            {
              name: 'Domain',
              value: 'domain',
              description: 'The result\'s site, subdomains included',
            },
            {
              name: 'URL Contains',
              value: 'urlContains',
              description: 'Any text anywhere in the result URL',
            },
          ],
          default: 'domain',
          description: 'What part of the result to test',
        },
        {
          displayName: 'Value',
          name: 'value',
          type: 'string',
          default: '',
          placeholder: 'example.com',
          description:
            'Domain to match, subdomains included — "example.com" also matches "www.example.com". For URL Contains, any substring such as "/amp/".',
        },
        {
          displayName: 'Effect',
          name: 'effect',
          type: 'options',
          options: [
            {
              name: 'Boost',
              value: 'boost',
              description: 'Move matching results above the others',
            },
            {
              name: 'Discard',
              value: 'discard',
              description: 'Remove matching results entirely',
            },
            {
              name: 'Downrank',
              value: 'downrank',
              description: 'Move matching results below the others',
            },
          ],
          default: 'discard',
          description: 'What to do with a result this rule matches',
        },
      ],
    },
  ],
};
