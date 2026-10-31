/**
 * Example workflow 10 finds the earliest reports of a news story: it searches, reads the pages, groups the pages that carry the same text and
 * names the page with the earliest date where the dates settle it. There is no model in it; everything is code in Code nodes whose source
 * lives in the JSON file, so what the nodes do is pinned here by running their own code on made-up English pages: the request check, the
 * search texts, the choice of pages, the comparison, the page that is built and the page that ends the form.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { docs, P, REWRITE, QUOTER } from './newsTraceFixtures';

interface ExampleNode {
  name: string;
  type: string;
  typeVersion: number;
  parameters: Record<string, any> & { jsCode?: string };
  credentials?: unknown;
  onError?: string;
  alwaysOutputData?: boolean;
  executeOnce?: boolean;
}

const file = join(__dirname, '../../../docs/examples/10-news-trace.json');
const fileText = readFileSync(file, 'utf8');
const example = JSON.parse(fileText) as {
  name: string;
  nodes: ExampleNode[];
  settings: { executionTimeout?: number };
  connections: Record<string, Record<string, Array<Array<{ node: string; type: string; index: number }>>>>;
};

const nodeOf = (name: string): ExampleNode => {
  const found = example.nodes.find((n) => n.name === name);
  if (!found) throw new Error(`no node called ${name}`);
  return found;
};
const sourceOf = (name: string): string => {
  const code = nodeOf(name).parameters.jsCode;
  if (typeof code !== 'string') throw new Error(`no code in ${name}`);
  return code;
};

type Json = Record<string, any>;

/** Runs the Code node `name` on `input`, with `nodes` standing in for $('Node name'). Returns the json of each output item. */
const run = (name: string, input: Json, nodes: Record<string, Json | Json[]> = {}): Json[] => {
  const items = [{ json: input }];
  const $input = { first: () => items[0], all: () => items, item: items[0] };
  const $ = (node: string) => {
    // n8n throws when a node has not run in this execution
    if (!Object.prototype.hasOwnProperty.call(nodes, node)) throw new Error(`Node '${node}' hasn't been executed`);
    const value = nodes[node];
    const list = (Array.isArray(value) ? value : [value]).map((json) => ({ json }));
    return { first: () => list[0], all: () => list };
  };
  const out = new Function('$input', '$', sourceOf(name))($input, $) as Array<{ json: Json }>;
  return out.map((o) => o.json);
};

const words = (text: string) => text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
const NOW = '2026-10-28T12:00:00Z';
const story = P.join('\n');

/** A page as "Pick the pages" hands it on. */
const pageRow = (d: { id: string; host: string; text: string; pagePublished?: string | null; date?: string | null; pageContentError?: string }): Json => ({
  url: `https://${d.host}/${d.id}`,
  host: d.host,
  title: d.id,
  site: d.host,
  text: d.text,
  published: d.pagePublished ?? null,
  date: d.date ?? null,
  error: d.pageContentError ?? '',
  from: 'news',
});
const fixtureRows = docs.map(pageRow);
const compare = (pages: Json[], extra: Json = {}): Json =>
  run('Compare the texts', { headline: 'Dock workers walk off the job at the port', period: 'w', nowIso: NOW, found: pages.length, pages, ...extra })[0];
const ids = (list: Json[]) => list.map((p) => p.title).sort();
/** The same story on another site, with the dates that the site shows. */
const twin = (host: string, published: string | null, date: string | null = null, text: string = story): Json =>
  pageRow({ id: host.split('.')[0], host, text, pagePublished: published, date });

describe('example 10: the workflow file', () => {
  it('holds no credential, and every node that is not a note is connected', () => {
    expect(example.nodes.some((n) => n.credentials)).toBe(false);
    const linked = new Set<string>();
    for (const [from, types] of Object.entries(example.connections)) {
      linked.add(from);
      for (const branches of Object.values(types)) for (const branch of branches) for (const c of branch) linked.add(c.node);
    }
    for (const n of example.nodes) {
      if (n.type !== 'n8n-nodes-base.stickyNote') expect(linked.has(n.name)).toBe(true);
    }
    expect(new Set(example.nodes.map((n) => n.name)).size).toBe(example.nodes.length);
    for (const [from, types] of Object.entries(example.connections)) {
      expect(example.nodes.some((n) => n.name === from)).toBe(true);
      for (const branches of Object.values(types)) for (const branch of branches) for (const c of branch) expect(example.nodes.some((n) => n.name === c.node)).toBe(true);
    }
  });

  it('uses no model and no language-model node', () => {
    expect(example.nodes.some((n) => n.type.includes('langchain'))).toBe(false);
  });

  it('names no personal identifier, and holds only plain ASCII (the code writes its symbols as escapes)', () => {
    expect(fileText).not.toMatch(/samnodehi|noodehi/i);
    expect(fileText).not.toMatch(/[^\x00-\x7f]/);
  });

  it('keeps the sticky notes within the rules for templates in n8n’s library', () => {
    const notes = example.nodes.filter((n) => n.type === 'n8n-nodes-base.stickyNote');
    const overview = notes.filter((n) => n.parameters.color === 1);
    expect(overview).toHaveLength(1);
    expect(overview[0].parameters.content).toContain('### How it works');
    expect(overview[0].parameters.content).toContain('### Setup');
    // before n8n 2.18 the form page's sandbox does not let a link of the preview open in a normal tab
    expect(overview[0].parameters.content).toContain('n8n 2.18 or later');
    expect(overview[0].parameters.content).toContain('32.19.1 or later');
    expect(words(overview[0].parameters.content)).toBeGreaterThanOrEqual(100);
    expect(words(overview[0].parameters.content)).toBeLessThanOrEqual(300);
    for (const note of notes.filter((n) => n.parameters.color !== 1)) expect(words(note.parameters.content)).toBeLessThan(50);
  });

  it('claims nothing about who wrote or copied what, in the file or in a page it builds', () => {
    // The portal's reviewer writes the public title and text from what is in the file (an earlier template came back as "fact-checked").
    const banned = /\b(original\w*|originat\w*|republish\w*|copied|copies|copying|copy|plagiar\w*|fakes?|facts?|factual|verif\w*|authentic(?:ity|ated?)?|genuine|misinformation|disinformation|debunk\w*)\b/i;
    expect(fileText).not.toMatch(banned);
    const page = build(compare(fixtureRows)).html as string;
    expect(page).not.toMatch(banned);
  });

  it('bounds the run and the downloads', () => {
    expect(example.settings.executionTimeout).toBeGreaterThan(0);
    const news = nodeOf('Search the news').parameters.newsSearchOptions;
    const web = nodeOf('Search the web').parameters.webSearchOptions;
    expect(news.fetchPageContent).toBe(true);
    expect(web.fetchPageContent).toBe(true);
    expect(news.pageContentMaxResults + web.pageContentMaxResults).toBeLessThanOrEqual(21);
    // "Pick the pages" must know how many results each search fetched: the node leaves the others with an empty text and no error
    expect(sourceOf('Pick the pages')).toContain(`const NEWS_FETCHED = ${news.pageContentMaxResults};`);
    expect(sourceOf('Pick the pages')).toContain(`const WEB_FETCHED = ${web.pageContentMaxResults};`);
    for (const options of [news, web]) {
      expect(options.pageContentMaxLength).toBeGreaterThan(0);
      expect(options.pageContentMaxLength).toBeLessThanOrEqual(40000);
      expect(options.pageContentTimeout).toBeLessThanOrEqual(15000);
      expect(options.includePageMetadata).toBe(true);
    }
    expect(nodeOf('Wait before the web search').parameters.amount).toBeGreaterThanOrEqual(3);
  });

  it('lets a failed search or page fetch end in a page, not in an error', () => {
    for (const name of ['Search the news', 'Search the web']) {
      const n = nodeOf(name);
      expect(n.onError).toBe('continueRegularOutput');
      expect(n.alwaysOutputData).toBe(true);
      expect(n.executeOnce).toBe(true);
      expect(n.parameters.errorHandling).toBe('continueOnFail');
    }
    expect(nodeOf('Read the article').onError).toBe('continueRegularOutput');
  });

  it('searches the news with the window of the form, and the web with the headline in quotes', () => {
    expect(nodeOf('Search the news').parameters.newsSearchOptions.timePeriod).toContain('.period');
    expect(nodeOf('Search the web').parameters.webSearchOptions.timeFilter).toContain('.period');
    expect(nodeOf('Search the news').parameters.newsQuery).toContain('.newsQuery');
    expect(nodeOf('Search the web').parameters.query).toContain('.webQuery');
  });

  it('writes no pattern for an address in any Code node (the upload of templates refuses them)', () => {
    for (const n of example.nodes.filter((x) => x.type === 'n8n-nodes-base.code')) {
      const code = n.parameters.jsCode as string;
      expect(code).not.toMatch(/\/\^?https?[:?]/);
      expect(code).not.toMatch(/\\\/\\\//);
      expect(code).not.toMatch(/new RegExp/);
    }
  });

  it('keeps the helpers that two nodes share identical in both', () => {
    const line = (name: string, start: string) => sourceOf(name).split('\n').find((l) => l.startsWith(start));
    const esc = line('Build the page', 'const esc = ');
    expect(esc).toBeDefined();
    expect(line('Make the result page', 'const esc = ')).toBe(esc);
    expect(line('Explain why there is no report', 'const esc = ')).toBe(esc);
  });
});

describe('example 10: Check the request', () => {
  const check = (form: Json) => run('Check the request', form)[0];

  it('accepts a headline and the default window', () => {
    const r = check({ story: '  Dock workers   walk off the job at the port ' });
    expect(r).toMatchObject({ ok: true, story: 'Dock workers walk off the job at the port', link: '', isLink: false, period: 'w' });
    expect(Number.isFinite(Date.parse(r.nowIso))).toBe(true);
  });

  it.each([
    ['Past day', 'd'],
    ['Past week', 'w'],
    ['Past month', 'm'],
    ['', 'w'],
    ['anything else', 'w'],
  ])('maps the window %p to %p', (picked, period) => {
    expect(check({ story: 'A headline of some length', window: picked }).period).toBe(period);
  });

  it('recognises a link: one word that starts with http://, https:// or www.', () => {
    expect(check({ story: 'https://news.example/a/story?id=3' })).toMatchObject({ ok: true, isLink: true, link: 'https://news.example/a/story?id=3' });
    expect(check({ story: 'HTTP://news.example/a' })).toMatchObject({ isLink: true });
    expect(check({ story: 'www.news.example/a' })).toMatchObject({ isLink: true, link: 'https://www.news.example/a' });
  });

  it('treats text with a space as a headline, even when it starts like a link', () => {
    expect(check({ story: 'https://news.example/a and then some words' })).toMatchObject({ ok: true, isLink: false });
  });

  it('refuses a link with a user name or a backslash in it, and a headline without a real word', () => {
    expect(check({ story: 'https://evil.example\\@bbc.co.uk/x' })).toMatchObject({ ok: false });
    expect(check({ story: 'https://user:secret@news.example/a' })).toMatchObject({ ok: false });
    expect(check({ story: 'Oh no, so it is on' })).toMatchObject({ ok: false });
  });

  it('refuses a link without a site name, and a headline that is too short or too long', () => {
    expect(check({ story: 'https://localhostonly/path' })).toMatchObject({ ok: false });
    expect(check({ story: 'short' })).toMatchObject({ ok: false });
    expect(check({ story: '' })).toMatchObject({ ok: false });
    expect(check({ story: 'x '.repeat(200) }).ok).toBe(false);
  });

  it('replaces control and direction characters', () => {
    expect(check({ story: 'Port\u0000 strike‮ begins​ today' }).story).toBe('Port strike begins today');
  });
});

describe('example 10: Plan the searches', () => {
  const planOf = (check: Json, article?: Json) => run('Plan the searches', article ?? check, { 'Check the request': check })[0];
  const typed = { ok: true, story: 'Dock workers walk off the job at the port', link: '', isLink: false, period: 'm', nowIso: NOW };

  it('searches for the headline, and for the headline in quotes on the web', () => {
    const r = planOf(typed);
    expect(r).toMatchObject({ ok: true, headline: typed.story, newsQuery: typed.story, webQuery: `"${typed.story}"`, period: 'm', nowIso: NOW, seed: null });
  });

  it('removes quotation marks from the quoted query, and cuts long headlines at a word', () => {
    const r = planOf({ ...typed, story: 'He said "no deal" after ' + 'long '.repeat(60) });
    expect(r.webQuery.startsWith('"He said no deal after long')).toBe(true);
    expect(r.webQuery.endsWith('long"')).toBe(true);
    expect(r.webQuery.length).toBeLessThanOrEqual(102);
    expect(r.newsQuery.length).toBeLessThanOrEqual(150);
    expect(r.newsQuery).not.toMatch(/\s$/);
  });

  it('uses the title of the page behind a link, without the name of the site, and keeps that page for the comparison', () => {
    const check = { ...typed, story: 'https://gazette.example/a', link: 'https://gazette.example/a', isLink: true };
    const r = planOf(check, { url: check.link, content: 'Body text', title: 'Dock workers walk off the job at the port | The Gazette', published: '2026-10-27T08:41:00Z', siteName: 'The Gazette' });
    expect(r.ok).toBe(true);
    expect(r.headline).toBe('Dock workers walk off the job at the port');
    expect(r.seed).toMatchObject({ url: check.link, text: 'Body text', published: '2026-10-27T08:41:00Z', site: 'The Gazette' });
  });

  it('keeps a title whose last part is long, and one with few words before the separator', () => {
    const check = { ...typed, story: 'https://gazette.example/a', link: 'https://gazette.example/a', isLink: true };
    expect(planOf(check, { title: 'Dock workers walk off the job - what it means for shops and ports', content: 'x' }).headline).toBe('Dock workers walk off the job - what it means for shops and ports');
    expect(planOf(check, { title: 'Port strike - Gazette', content: 'x' }).headline).toBe('Port strike - Gazette');
  });

  it('asks for a headline when the page behind the link could not be read', () => {
    const check = { ...typed, story: 'https://gazette.example/a', link: 'https://gazette.example/a', isLink: true };
    const r = planOf(check, { url: check.link, content: '', error: 'HTTP 403' });
    expect(r.ok).toBe(false);
    expect(r.error).toContain('HTTP 403');
    expect(r.error).toContain('Type its headline');
  });
});

/** A made-up paragraph of 25 words that no other paragraph shares a run of five words with. */
const para = (i: number) => Array.from({ length: 25 }, (_, k) => `w${i}x${k}`).join(' ');
const pagesOfParas = (host: string, from: number, to: number, published = '2026-10-27T08:00:00Z') =>
  twin(host, published, null, Array.from({ length: to - from + 1 }, (_, k) => para(from + k)).join('\n'));

describe('example 10: the grouping rules', () => {
  it('does not treat story text as site text: two pages of one site that share a story with a copy on another site', () => {
    const story8 = Array.from({ length: 8 }, (_, i) => para(i)).join('\n');
    const a1 = twin('a.example', '2026-10-27T08:00:00Z', null, story8 + '\n' + para(20) + '\n' + para(21));
    const a2 = { ...twin('a.example', '2026-10-27T09:00:00Z', null, story8 + '\n' + para(22) + '\n' + para(23)), url: 'https://a.example/second' };
    const b = twin('b.example', '2026-10-27T10:00:00Z', null, story8);
    const out = compare([a1, a2, b]);
    expect(out.families).toHaveLength(1);
    expect(out.families[0].members).toHaveLength(3);
  });

  it('does not join a page that matches the start of one page with a page that matches its end', () => {
    const out = compare([pagesOfParas('a.example', 0, 9), pagesOfParas('b.example', 0, 4), pagesOfParas('c.example', 5, 9)]);
    const joined = out.families.map((f: Json) => f.members.map((m: Json) => m.host).sort().join(','));
    expect(joined).toHaveLength(1);
    expect(joined[0]).not.toBe('a.example,b.example,c.example');
    expect(joined[0]).toMatch(/^a\.example,(b|c)\.example$/);
  });

  it('does not chain pages that overlap like a sliding window, whatever the order', () => {
    const rows = [pagesOfParas('a.example', 1, 6), pagesOfParas('b.example', 3, 8), pagesOfParas('c.example', 5, 10)];
    const orders = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
    const seen = new Set<string>();
    for (const order of orders) {
      const out = compare(order.map((i) => rows[i]));
      seen.add(out.families.map((f: Json) => f.members.map((m: Json) => m.host).sort().join(',')).sort().join(' | '));
      expect(out.families.every((f: Json) => f.members.length < 3)).toBe(true);
    }
    expect(seen.size).toBe(1);
  });

  it('names the earliest page only if it is ahead of every dated page by more than the uncertainty of both dates', () => {
    const out = compare([twin('a.example', '2026-10-27T08:00:00Z'), twin('b.example', '2026-10-27T10:00:00Z'), twin('c.example', '2026-10-27T11:00:00')]);
    expect(out.families[0].first).toBe('');
    expect(out.families[0].why).toContain('less than the uncertainty of their dates');
    const day = compare([twin('a.example', '2026-10-27T08:00:00Z'), twin('b.example', '2026-10-27T10:00:00Z'), twin('c.example', '2026-10-27')]);
    expect(day.families[0].first).toBe('');
  });

  it('stays fast on a page made of unclosed curly quotation marks', () => {
    const hostile = '\u201c'.repeat(30000);
    const pages = Array.from({ length: 12 }, (_, i) => twin(`site${i}.example`, '2026-10-27T08:00:00Z', null, hostile + '\n' + story));
    const start = Date.now();
    compare(pages);
    expect(Date.now() - start).toBeLessThan(4000);
  });

  it('shows "according to" only from paragraphs that were compared, not from a menu', () => {
    const menu = 'Edited according to our code';
    const withMenu = story + '\n' + menu;
    const out = compare([twin('a.example', '2026-10-27T08:00:00Z', null, withMenu), twin('b.example', '2026-10-27T10:00:00Z', null, withMenu)]);
    expect(out.families[0].attributions).toEqual([]);
  });
});

describe('example 10: Pick the pages', () => {
  const plan = { ok: true, headline: 'Dock workers walk off the job at the port', newsQuery: '', webQuery: '', period: 'w', nowIso: NOW, seed: null as Json | null };
  const body = (extra = '') => `Dock workers at the port walked off the job on Tuesday morning after talks collapsed overnight. ${extra} `.repeat(14);
  const news = (url: string, extra: Json = {}): Json => ({ title: 'Dock workers walk off the job', description: 'Dock workers at the port', url, date: '2026-10-27T09:00:00Z', relativeTime: '1 day ago', syndicate: 'Gazette', pageContent: body(url), ...extra });
  const pick = (newsItems: Json[], webItems: Json[] = [], p: Json = plan) => run('Pick the pages', {}, { 'Plan the searches': p, 'Search the news': newsItems, 'Search the web': webItems })[0];

  it('keeps one entry per address: a trailing slash, www, a fragment and tracking parameters make no difference', () => {
    const r = pick([
      news('https://gazette.example/a/story'),
      news('https://www.gazette.example/a/story/'),
      news('https://gazette.example/a/story?utm_source=feed&fbclid=1#top'),
      news('https://gazette.example/a/story?id=2'),
    ]);
    expect(r.pages.map((p: Json) => p.url)).toEqual(['https://gazette.example/a/story', 'https://gazette.example/a/story?id=2']);
    expect(r.skipped.duplicates).toBe(2);
    expect(r.found).toBe(2);
  });

  it('keeps at most two pages of a site, and twelve in all', () => {
    const three = pick([news('https://a.example/1'), news('https://a.example/2'), news('https://a.example/3')]);
    expect(three.pages).toHaveLength(2);
    expect(three.skipped.sameSite).toBe(1);
    const many = pick(Array.from({ length: 15 }, (_, i) => news(`https://site${i}.example/x`)), [{ title: 'Dock workers walk off the job at the port', url: 'https://web.example/x', description: '', pageContent: body() }]);
    expect(many.pages).toHaveLength(12);
    expect(many.skipped.overLimit).toBe(4);
  });

  it('keeps the readable copy of an address that one search could not read and the other could', () => {
    const failed = news('https://same.example/x', { pageContent: '', pageContentError: 'HTTP 403' });
    const web = [{ title: 'Dock workers walk off the job at the port', url: 'https://same.example/x', description: '', pageContent: body() }];
    const r = pick([failed], web);
    expect(r.pages).toHaveLength(1);
    expect(r.pages[0]).toMatchObject({ host: 'same.example', from: 'web', error: '' });
    expect(r.pages[0].text.length).toBeGreaterThan(100);
    expect(r.skipped.duplicates).toBe(1);
  });

  it('lets pages with text take the places of the twelve before pages that could not be read', () => {
    const empty = Array.from({ length: 12 }, (_, i) => news(`https://empty${i}.example/x`, { pageContent: '', pageContentError: 'HTTP 403' }));
    const good = [1, 2, 3].map((i) => news(`https://good${i}.example/x`));
    const r = pick([...empty, ...good]);
    expect(r.pages).toHaveLength(12);
    expect(r.pages.slice(0, 3).map((p: Json) => p.host)).toEqual(['good1.example', 'good2.example', 'good3.example']);
    expect(r.skipped.overLimit).toBe(3);
    expect(r.full).toBe(3);
  });

  it('leaves out pages that are not about the headline, and results whose page was not fetched', () => {
    const r = pick([
      news('https://a.example/1'),
      news('https://b.example/1', { title: 'Bakery wins award', description: 'Sourdough', pageContent: 'A local bakery won a regional award for its sourdough bread. '.repeat(20) }),
    ]);
    expect(r.pages.map((p: Json) => p.host)).toEqual(['a.example']);
    expect(r.skipped).toMatchObject({ notAboutIt: 1, notFetched: 0 });
  });

  it('knows which results the search nodes fetched: the node gives the others an empty text and no error', () => {
    const fetched = Array.from({ length: 15 }, (_, i) => news(`https://f${i}.example/x`, { pageContent: '', pageContentError: 'HTTP 403' }));
    // the 16th and 17th news results were not fetched; the 17th address is also found, with its text, by the web search
    const unfetched = [news('https://u1.example/x', { pageContent: '' }), news('https://shared.example/x', { pageContent: '' })];
    const web = [{ title: 'Dock workers walk off the job', url: 'https://shared.example/x', description: '', pageContent: body() }];
    const r = pick([...fetched, ...unfetched], web);
    expect(r.skipped.notFetched).toBe(1);
    expect(r.skipped.duplicates).toBe(1);
    expect(r.pages.map((p: Json) => p.host)).toContain('shared.example');
    expect(r.pages.map((p: Json) => p.host)).not.toContain('u1.example');
    expect(r.found).toBe(17);
  });

  it('keeps a page that could not be read, with its error, so that the report can list it', () => {
    const r = pick([news('https://a.example/1', { pageContent: '', pageContentError: 'HTTP 403' })]);
    expect(r.pages[0]).toMatchObject({ host: 'a.example', text: '', error: 'HTTP 403' });
  });

  it('ignores a result that is not an http or https address, and reads the fields of a web result', () => {
    const r = pick(
      [news('ftp://files.example/a'), news('javascript:alert(1)'), news('')],
      [{ title: 'Dock workers walk off the job at the port', url: 'https://web.example/a', description: '', pageContent: body(), pagePublished: '2026-10-27T07:00:00Z', pageSiteName: 'Web Example' }],
    );
    expect(r.pages).toHaveLength(1);
    expect(r.pages[0]).toMatchObject({ host: 'web.example', published: '2026-10-27T07:00:00Z', site: 'Web Example', from: 'web', date: null });
  });

  it('ignores a result whose address hides its real site behind a user name or a backslash', () => {
    const r = pick([news('https://evil.example\\@bbc.co.uk/x'), news('https://user@news.example/x')]);
    expect(r.pages).toEqual([]);
  });

  it('lets nothing through when the headline has no word to look for', () => {
    const r = pick([news('https://a.example/1')], [], { ...plan, headline: 'Oh no, so it is on' });
    expect(r.pages).toEqual([]);
    expect(r.skipped.notAboutIt).toBe(1);
  });

  it('puts the page behind a link first, and does not ask it to be about the headline', () => {
    const seed = { url: 'https://gazette.example/a', title: 'Whatever', text: body('seed'), published: '2026-10-27T08:41:00Z', site: 'Gazette', error: '' };
    const r = pick([news('https://gazette.example/a/')], [], { ...plan, seed });
    expect(r.pages).toHaveLength(1);
    expect(r.pages[0]).toMatchObject({ from: 'link', host: 'gazette.example', published: '2026-10-27T08:41:00Z' });
    expect(r.skipped.duplicates).toBe(1);
  });

  it('stops short of a comparison when fewer than five pages have 150 words', () => {
    const few = pick([1, 2, 3, 4].map((i) => news(`https://s${i}.example/x`)));
    expect(few).toMatchObject({ full: 4, enough: false });
    expect(few.why).toContain('Only 4 pages');
    const enough = pick([1, 2, 3, 4, 5].map((i) => news(`https://s${i}.example/x`)));
    expect(enough).toMatchObject({ full: 5, enough: true });
    const short = pick([1, 2, 3, 4, 5].map((i) => news(`https://s${i}.example/x`, { pageContent: 'Dock workers at the port walked off the job. '.repeat(5) })));
    expect(short.enough).toBe(false);
  });

  it('names a search error in the reason, and survives a search that never ran', () => {
    const r = run('Pick the pages', {}, { 'Plan the searches': plan, 'Search the news': [{ error: 'DuckDuckGo is limiting requests' }], 'Search the web': [{}] })[0];
    expect(r.pages).toEqual([]);
    expect(r.enough).toBe(false);
    expect(r.why).toContain('DuckDuckGo is limiting requests');
    const missing = run('Pick the pages', {}, { 'Plan the searches': plan })[0];
    expect(missing).toMatchObject({ enough: false, found: 0 });
  });
});

describe('example 10: Compare the texts', () => {
  const r = compare(fixtureRows);
  const groupOf = (title: string) => r.families.find((f: Json) => f.members.some((m: Json) => m.title === title));

  it('groups the copies, the light edits and the short and cut-off versions of one article', () => {
    const g = groupOf('orig');
    expect(ids(g.members)).toEqual(['edited', 'orig', 'orig2', 'short2', 'trunc', 'wireB', 'wireC', 'wireD']);
  });

  it('does not join articles that only share a quotation, a rewrite with one quoted line, or the same facts in other words', () => {
    for (const title of ['rewrite', 'indep', 'quoter']) expect(groupOf(title)).toBeUndefined();
    expect(r.alone.map((p: Json) => p.title)).toEqual(expect.arrayContaining(['rewrite', 'indep', 'quoter']));
  });

  it('does not join unrelated articles of one site that share a menu, a notice and a sign-up box', () => {
    for (const title of ['schoolB', 'bankB']) expect(groupOf(title)).toBeUndefined();
    expect(groupOf('wireB').members.some((m: Json) => m.title === 'schoolB')).toBe(false);
  });

  it('keeps two articles that quote the same announcement apart, and names the digest that puts several groups together', () => {
    expect(groupOf('lumenY')).toBeUndefined();
    const lumen = groupOf('lumenX');
    expect(ids(lumen.members)).toEqual(['lumenX', 'lumenXcopy', 'roundup']);
    expect(r.compilations).toHaveLength(1);
    const roundup = lumen.members.find((m: Json) => m.title === 'roundup');
    expect(r.compilations).toEqual([roundup.id]);
    expect(roundup.compilation.length).toBeGreaterThanOrEqual(2);
    expect(groupOf('orig').members.every((m: Json) => m.compilation.length === 0)).toBe(true);
  });

  it('lists the pages that could not be compared, with the reason', () => {
    const reasons = Object.fromEntries(r.notCompared.map((p: Json) => [p.title, p.reason]));
    expect(Object.keys(reasons).sort()).toEqual(['empty', 'errpage', 'legalA', 'legalB', 'trunc30']);
    expect(reasons.empty).toBe('no text could be read');
    expect(reasons.errpage).toBe('HTTP 403');
    expect(reasons.legalA).toContain('only menus, notices');
    expect(reasons.trunc30).toMatch(/too little text to compare \(\d+ words\)/);
  });

  it('counts what was found, compared, grouped and left alone', () => {
    expect(r.counts).toEqual({ found: 24, compared: 19, groups: 2, alone: 8, notCompared: 5 });
  });

  it('names the earliest page of a group when the dates settle it, with the margin', () => {
    const lumen = groupOf('lumenX');
    expect(lumen.first).toBe(lumen.members.find((m: Json) => m.title === 'lumenX').id);
    expect(lumen.margin).toBe(2 * 3600000);
  });

  it('says that the dates do not settle the order when the two earliest pages are minutes apart', () => {
    const g = groupOf('orig');
    expect(g.first).toBe('');
    expect(g.why).toContain('within 10 minutes of each other');
  });

  it('puts the members of a group in the order of their dates', () => {
    const times = groupOf('orig').members.map((m: Json) => m.title);
    expect(times.slice(0, 3)).toEqual(['orig', 'orig2', 'short2']);
  });

  it('shows a passage the pages share, and the words that follow "according to"', () => {
    expect(groupOf('orig').shared.text.startsWith('HARBORVIEW - Dock workers')).toBe(true);
    expect(groupOf('orig').shared.pages).toBeGreaterThanOrEqual(7);
    const withAttribution = compare([
      twin('a.example', '2026-10-27T08:00:00Z', null, story + '\nPrices rose, according to the national statistics office, in the last quarter of the year.'),
      twin('b.example', '2026-10-27T10:00:00Z', null, story + '\nPrices rose, according to the national statistics office, in the last quarter of the year.'),
      twin('c.example', '2026-10-27T11:00:00Z', null, story + '\nIt was reported, according to him, that the figures were final.'),
    ]);
    expect(withAttribution.families[0].attributions).toEqual(['the national statistics office']);
  });

  it('gives the same groups whatever the order of the pages', () => {
    const key = (x: Json) => x.families.map((f: Json) => f.members.map((m: Json) => m.title).sort().join(',')).sort().join(' | ');
    const base = key(r);
    let seed = 7;
    const rnd = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let t = 0; t < 8; t++) {
      const a = fixtureRows.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      expect(key(compare(a))).toBe(base);
    }
  });

  it('compares twelve long pages in well under a second or two', () => {
    const long = Array.from({ length: 80 }, (_, i) => `Paragraph ${i} of the long story has words about harbour number ${i} and cranes ${i * 3} and ships ${i * 7} that were counted on the day.`).join('\n');
    const pages = Array.from({ length: 12 }, (_, i) => twin(`site${i}.example`, `2026-10-27T${String(8 + i).padStart(2, '0')}:00:00Z`, null, long));
    const start = Date.now();
    const out = compare(pages);
    expect(Date.now() - start).toBeLessThan(3000);
    expect(out.families).toHaveLength(1);
    expect(out.families[0].members).toHaveLength(12);
  });

  it('keeps accented letters, and copes with no pages and with an empty page', () => {
    const accented = story.replace(/o/g, 'ó');
    const out = compare([twin('a.example', '2026-10-27T08:00:00Z'), twin('b.example', '2026-10-27T10:00:00Z', null, accented)]);
    expect(out.families).toHaveLength(1);
    expect(compare([]).counts.found).toBe(0);
    expect(compare([twin('a.example', null, null, '')]).notCompared).toHaveLength(1);
  });

  it('leaves out quotations first: a long quotation shared by two different articles joins nothing', () => {
    const quote = '"' + P[2].replace(/^"|"$/g, '').repeat(1) + ' ' + P[3] + ' ' + P[4] + '"';
    const a = ['The union had a different view of the week.', 'Our correspondent watched the pickets form at the gates and spoke to drivers who were turned away at dawn by the stoppage.', quote, 'Local shops said they would wait and see what the next days brought for deliveries.'].join('\n');
    const b = ['Analysts looked at what the port closure could mean for prices.', 'Economists at several consultancies said that the effect on shelves depends on how long the closure lasts and on what rail operators can carry.', quote, 'Retail groups said they had stock to last until the end of the month at least.'].join('\n');
    const out = compare([twin('a.example', '2026-10-27T08:00:00Z', null, a), twin('b.example', '2026-10-27T09:00:00Z', null, b), twin('c.example', '2026-10-27T10:00:00Z', null, story), twin('d.example', '2026-10-27T11:00:00Z', null, story)]);
    expect(out.families).toHaveLength(1);
    expect(out.families[0].members.map((m: Json) => m.title).sort()).toEqual(['c', 'd']);
    // the same two articles without the quotation marks do share their text
    const bare = quote.replace(/"/g, '');
    const out2 = compare([twin('a.example', '2026-10-27T08:00:00Z', null, a.replace(quote, bare)), twin('b.example', '2026-10-27T09:00:00Z', null, b.replace(quote, bare))]);
    expect(out2.families.length + out2.alone.length).toBeGreaterThan(0);
  });

  it('does not strip a quotation mark that never closes', () => {
    const open = ['"' + P[0], P[1], P[3]].join('\n');
    const out = compare([twin('a.example', '2026-10-27T08:00:00Z', null, open), twin('b.example', '2026-10-27T10:00:00Z', null, open)]);
    expect(out.families).toHaveLength(1);
  });

  it('shows what a rewrite shares with its source only as a separate page, never as a group', () => {
    const out = compare([twin('a.example', '2026-10-27T08:00:00Z'), twin('b.example', '2026-10-27T10:00:00Z', null, REWRITE.join('\n')), twin('c.example', '2026-10-28T07:00:00Z', null, QUOTER.join('\n'))]);
    expect(out.families).toHaveLength(0);
    expect(out.alone).toHaveLength(3);
  });

  describe('which page is earliest', () => {
    const first = (pages: Json[]) => {
      const out = compare(pages);
      expect(out.families).toHaveLength(1);
      return out.families[0];
    };

    it('takes the earliest date a page shows, whichever field it is in', () => {
      const g = first([twin('late.example', '2026-10-27T09:00:00Z', '2026-10-27T10:00:00Z'), twin('mid.example', '2026-10-27T11:00:00Z'), twin('end.example', null, '2026-10-27T13:00:00Z')]);
      expect(g.members[0].host).toBe('late.example');
      expect(g.first).toBe(g.members[0].id);
      expect(g.members[0].timeLabel).toBe('2026-10-27 09:00 UTC');
    });

    it('settles nothing in favour of a page whose own date and the search date are far apart: its text may be newer than its date', () => {
      // a live page or an updated article keeps the date it was first posted
      const g = first([twin('live.example', '2026-10-27T05:00:00Z', '2026-10-27T11:00:00Z'), twin('b.example', '2026-10-27T12:00:00Z'), twin('c.example', '2026-10-27T13:00:00Z')]);
      expect(g.first).toBe('');
      expect(g.why).toBe('the earliest date is approximate or disputed');
      expect(g.members[0].host).toBe('live.example');
      expect(g.members[0].timeFlags).toContain('sourcesDisagree');
      // dates two hours apart are an ordinary delay of a search engine
      const ok = first([twin('a.example', '2026-10-27T09:00:00Z', '2026-10-27T11:00:00Z'), twin('b.example', '2026-10-27T12:00:00Z')]);
      expect(ok.first).toBe(ok.members[0].id);
    });

    it('settles nothing when only one page of the group shows a date', () => {
      const g = first([twin('a.example', '2026-10-27T09:00:00Z'), twin('b.example', null), twin('c.example', null)]);
      expect(g.first).toBe('');
      expect(g.why).toBe('fewer than two of its pages show a date');
    });

    it('settles nothing when all the pages are on one site', () => {
      const g = first([twin('a.example', '2026-10-27T09:00:00Z'), twin('a.example', '2026-10-27T12:00:00Z')]);
      expect(g.first).toBe('');
      expect(g.why).toBe('all the pages of this group are on one site');
    });

    it('treats a date without a time as a day, so a page of the next day does not beat it by hours', () => {
      const g = first([twin('a.example', '2026-10-27'), twin('b.example', '2026-10-27T20:00:00Z')]);
      expect(g.first).toBe('');
      expect(g.members.find((m: Json) => m.host === 'a.example').timeLabel).toBe('2026-10-27 (date only)');
    });

    it('treats a time without a zone as approximate', () => {
      const g = first([twin('a.example', '2026-10-27T08:00:00'), twin('b.example', '2026-10-27T20:00:00Z')]);
      expect(g.first).toBe('');
      expect(g.members.find((m: Json) => m.host === 'a.example').timeLabel).toContain('(approximate)');
    });

    it('reads a time with an offset and a mail-style date as exact times', () => {
      const g = first([twin('a.example', '2026-10-27T10:00:00+02:00'), twin('b.example', 'Tue, 27 Oct 2026 09:00:00 GMT')]);
      expect(g.members[0].host).toBe('a.example');
      expect(g.members[0].timeLabel).toBe('2026-10-27 08:00 UTC');
      expect(g.first).toBe(g.members[0].id);
      expect(g.margin).toBe(3600000);
    });

    it('ignores a date in the future, an impossible one, a placeholder and text that is not a date', () => {
      const g = first([twin('a.example', '2027-01-01T00:00:00Z'), twin('b.example', '2026-02-31T08:00:00Z'), twin('c.example', '1970-01-01T00:00:00Z'), twin('d.example', 'yesterday'), twin('e.example', '2026-10-27T09:00:00Z')]);
      expect(g.members[0].host).toBe('e.example');
      expect(g.members.filter((m: Json) => m.timeLabel === 'no date')).toHaveLength(4);
    });

    it('does not trust a date long before the search window, and says that another date was left out', () => {
      const g = first([twin('a.example', '2024-01-15T08:00:00Z', '2026-10-27T05:00:00Z'), twin('b.example', '2026-10-27T12:00:00Z')]);
      expect(g.members[0].host).toBe('a.example');
      expect(g.members[0].timeLabel).toBe('2026-10-27 05:00 UTC');
      expect(g.members[0].timeFlags).toContain('otherDateIgnored');
      expect(g.first).toBe('');
      expect(g.why).toBe('the earliest date is approximate or disputed');
    });

    it('does not take the date that a search engine reports for a page as the moment of posting', () => {
      const g = first([twin('a.example', '2026-10-27T10:00:00Z'), twin('b.example', null, '2026-10-27T12:00:00Z')]);
      expect(g.first).toBe('');
      expect(g.why).toBe('two pages are dated 2 hours apart, which is less than the uncertainty of their dates');
    });

    it('says how many pages of a group show no date', () => {
      const g = first([twin('a.example', '2026-10-27T10:00:00Z'), twin('b.example', '2026-10-27T14:00:00Z'), twin('c.example', null)]);
      expect(g.first).toBe(g.members[0].id);
      expect(g.undated).toBe(1);
      const page = build({ ...compare([twin('a.example', '2026-10-27T10:00:00Z'), twin('b.example', '2026-10-27T14:00:00Z'), twin('c.example', null)]) }).html as string;
      expect(page).toContain('1 page in this group shows no date.');
    });

    it('settles nothing when the only date of a page is long before the window', () => {
      const g = first([twin('a.example', '2024-01-15T08:00:00Z'), twin('b.example', '2026-10-27T12:00:00Z')]);
      expect(g.first).toBe('');
      expect(g.members[0].timeFlags).toContain('beforeWindow');
    });

    it('falls back to "N hours ago" only when a result has no other date, and then settles nothing', () => {
      const a = { ...twin('a.example', null), relativeTime: '3 hours ago' };
      const g = first([a, twin('b.example', '2026-10-28T09:00:00Z')]);
      expect(g.members.find((m: Json) => m.host === 'a.example').timeLabel).toContain('(approximate)');
      expect(g.first).toBe('');
    });
  });
});

const build = (compared: Json): Json => run('Build the page', compared)[0];

describe('example 10: Build the page', () => {
  const compared = compare(fixtureRows);
  const out = build(compared);
  const html = out.html as string;

  it('makes one complete page with a policy that allows inline style and nothing else', () => {
    expect(html.startsWith('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="')).toBe(true);
    expect(html).toContain("default-src &#39;none&#39;; style-src &#39;unsafe-inline&#39;");
    expect(html).toContain('<meta name="referrer" content="no-referrer">');
    expect(html).not.toMatch(/<script|<iframe|<form|<img|javascript:|\son[a-z]+=/i);
    expect(out.filename).toBe('news-trace-dock-workers-walk-off-the-job-at-the-2026-10-28.html');
    expect(out.groups).toBe(2);
  });

  it('shows the fixed sentence about what the page does and does not say', () => {
    expect(html).toContain('This page compares the wording of the pages that the search returned and could read.');
    expect(html).toContain('that says nothing about who wrote the text or how it travelled between sites');
  });

  it('shows the counts, each group with its earliest page or the reason, the pages alone and the pages that were not compared', () => {
    expect(html).toContain('24 results found, 19 with enough text to compare: 2 groups of pages that carry the same text, 8 pages with text of their own, 5 that could not be compared.');
    expect(html).toContain('Group 1 · 8 pages on 8 sites');
    expect(html).toContain('The dates do not settle which of these pages came first: the two earliest pages are dated within 10 minutes of each other.');
    expect(html).toContain('Group 2 · 3 pages on 3 sites');
    expect(html).toContain('Earliest found among the pages read: <strong>techwire.example</strong>, 2026-10-26 15:00 UTC. The next page in this group is dated 2 hours later.');
    expect(html).toContain('<span class="badge">earliest found</span>');
    expect(html).toContain('<h2>Pages with text of their own</h2>');
    expect(html).toContain('<h2>Pages that could not be compared</h2>');
    expect(html).toContain('puts together passages of several groups');
    expect(html).toContain('A passage that 8 pages share:');
  });

  it('links only http and https addresses, with no referrer and no follow', () => {
    const rows = [twin('a.example', '2026-10-27T08:00:00Z'), twin('b.example', '2026-10-27T10:00:00Z')];
    rows[0].url = 'javascript:alert(1)';
    rows[1].url = 'https://b.example/x?a=1&b="2"';
    const page = build(compare(rows)).html as string;
    expect(page).not.toContain('href="javascript');
    expect(page).toContain('href="https://b.example/x?a=1&amp;b=&quot;2&quot;" rel="noopener noreferrer nofollow" target="_blank"');
  });

  it('escapes every text that came from a page, a title, a site or the headline', () => {
    const evil = '<script>alert(1)</script><img src=x onerror=alert(2)>';
    const rows = [twin('a.example', '2026-10-27T08:00:00Z', null, story + '\n' + evil + ' this paragraph shares the words of the story with the rest of the pages here.'), twin('b.example', '2026-10-27T10:00:00Z')];
    rows[0].title = evil;
    rows[0].host = 'a"><b>.example';
    const page = build(compare(rows, { headline: evil })).html as string;
    expect(page).not.toContain('<script');
    expect(page).not.toContain('<img');
    expect(page).not.toContain('<b>.example');
    expect(page).toContain('&lt;script&gt;');
  });

  it('says plainly when no two pages share their text', () => {
    const page = build(compare([twin('a.example', '2026-10-27T08:00:00Z'), twin('b.example', '2026-10-27T10:00:00Z', null, REWRITE.join('\n'))])).html as string;
    expect(page).toContain('No two of the pages that were read share long passages of text, so there is no group and no page to name as earliest.');
    expect(page).not.toContain('<h2>Groups of pages');
  });

  it('says what was left out', () => {
    const page = build(compare(fixtureRows, { skipped: { duplicates: 1, notAboutIt: 2, sameSite: 1, notFetched: 3, overLimit: 0 } })).html as string;
    expect(page).toContain('Left out: 1 repeated address; 2 pages that are not about the headline; 1 further page of a site already shown; 3 results whose pages were not fetched.');
  });
});

describe('example 10: the page that ends the form', () => {
  const report = build(compare(fixtureRows));

  it('shows a report with a Download button that holds the file, and a sandboxed preview', () => {
    const page = run('Make the result page', report)[0].page as string;
    expect(page).toContain('<h1>Your report is ready</h1>');
    const base64 = /href="data:text\/html;charset=utf-8;base64,([A-Za-z0-9+/=]+)"/.exec(page)?.[1] ?? '';
    expect(Buffer.from(base64, 'base64').toString('utf8')).toBe(report.html);
    expect(page).toContain('download="news-trace-dock-workers-walk-off-the-job-at-the-2026-10-28.html"');
    expect(page).toContain('sandbox="allow-popups allow-popups-to-escape-sandbox"');
    expect(page).toContain('referrerpolicy="no-referrer" srcdoc="');
    // nothing inside srcdoc can end the attribute
    const srcdoc = /srcdoc="([^"]*)"/.exec(page)?.[1] ?? '';
    expect(srcdoc).toContain('&lt;!doctype html&gt;');
    expect(srcdoc).not.toContain('<');
  });

  it('refuses to make a page from nothing', () => {
    expect(() => run('Make the result page', {})).toThrow('There is no page to show.');
  });

  it('shows the reason when there is no report: a request that was refused, a plan that failed, or too few pages', () => {
    for (const reason of [{ error: 'Type a headline of at least 8 characters, or the link of an article.' }, { why: 'Only 2 pages about this headline could be read with enough text, and at least 5 are needed to compare them.' }]) {
      const notice = run('Explain why there is no report', reason)[0];
      expect(notice.notice).toBe(true);
      const page = run('Make the result page', notice)[0].page as string;
      expect(page).toContain('<h1>No report this time</h1>');
      expect(page).toContain(Object.values(reason)[0].slice(0, 30));
      expect(page).not.toContain('Download');
      expect(page).not.toContain('<iframe');
    }
  });

  it('escapes the reason and gives a default when there is none', () => {
    expect(run('Explain why there is no report', { error: '<script>x</script>' })[0].html).toContain('&lt;script&gt;');
    expect(run('Explain why there is no report', {})[0].html).toContain('Nothing could be made.');
  });
});

describe('example 10: from the form to the report', () => {
  it('runs the nodes in order on made-up search results', () => {
    const check = run('Check the request', { story: 'Dock workers walk off the job at the port', window: 'Past week' })[0];
    const plan = run('Plan the searches', check, { 'Check the request': check })[0];
    expect(plan.ok).toBe(true);
    const asNews = docs.slice(0, 14).map((d) => ({
      title: d.id, description: 'Dock workers at the port', url: `https://${d.host}/${d.id}`, date: d.date, relativeTime: '1 day ago', syndicate: d.host,
      pageContent: d.text, pagePublished: d.pagePublished ?? undefined, pageContentError: d.pageContentError,
    }));
    const picked = run('Pick the pages', {}, { 'Plan the searches': plan, 'Search the news': asNews, 'Search the web': [{}] })[0];
    expect(picked.enough).toBe(true);
    const compared = run('Compare the texts', { ...picked, nowIso: NOW })[0];
    expect(compared.ok).toBe(true);
    expect(compared.families.length).toBeGreaterThanOrEqual(1);
    const built = run('Build the page', compared)[0];
    const done = run('Make the result page', built)[0];
    expect(done.page).toContain('<h1>Your report is ready</h1>');
  });
});
