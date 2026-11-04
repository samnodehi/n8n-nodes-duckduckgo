/**
 * Example workflow 11 writes a cited research report and, for the sub-questions that have no checked finding, searches once more with a
 * rewritten query. The decisions are made in Code nodes whose source lives in the JSON file, so what they do is pinned here by running
 * their own code on made-up English pages: the grading, the numbering of the sources (ids only ever grow), the check of every quote, the
 * choice of the gaps and of the new queries, the merge of the second round, the citations and the page that ends the form.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { SENTENCE, REQUEST, pageText, prose, result } from './gapReportFixtures';

interface ExampleNode {
  name: string;
  type: string;
  typeVersion: number;
  parameters: Record<string, any> & { jsCode?: string };
  credentials?: unknown;
  onError?: string;
  alwaysOutputData?: boolean;
}

const file = join(__dirname, '../../../docs/examples/11-gap-filling-report.json');
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

/** Runs the Code node `name` on the items `inputs`, with `nodes` standing in for $('Node name'). Returns the json of each output item. */
const runMany = (name: string, inputs: Json[], nodes: Record<string, Json | Json[]> = {}): Json[] => {
  const items = inputs.map((json) => ({ json }));
  const $input = { first: () => items[0], all: () => items, item: items[0] };
  const $ = (node: string) => {
    // n8n throws when a node has not run in this execution
    if (!Object.prototype.hasOwnProperty.call(nodes, node)) throw new Error(`Node '${node}' hasn't been executed`);
    const value = nodes[node];
    const list = (Array.isArray(value) ? value : [value]).map((json) => ({ json }));
    return { first: () => list[0], all: () => list };
  };
  const $now = { toFormat: () => '2026-11-03' };
  // "Check the quotes" runs a second time after "Add the new sources" (the back-edge into the extraction)
  const $runIndex = name === 'Check the quotes' && Object.prototype.hasOwnProperty.call(nodes, 'Add the new sources') ? 1 : 0;
  const out = new Function('$input', '$', '$now', '$runIndex', sourceOf(name))($input, $, $now, $runIndex) as Array<{ json: Json }>;
  return out.map((o) => o.json);
};
const run = (name: string, input: Json, nodes: Record<string, Json | Json[]> = {}): Json[] => runMany(name, [input], nodes);

/** The lines of a helper that several nodes must share: from the line that starts with `start` to the line where its brackets close. */
const block = (name: string, start: string): string => {
  const lines = sourceOf(name).split('\n');
  const from = lines.findIndex((l) => l.startsWith(start));
  if (from < 0) return '';
  let depth = 0;
  let to = from;
  for (; to < lines.length; to += 1) {
    for (const ch of lines[to]) depth += '([{'.includes(ch) ? 1 : ')]}'.includes(ch) ? -1 : 0;
    if (depth <= 0) break;
  }
  return lines.slice(from, to + 1).join('\n');
};

const SETTINGS = { question: REQUEST, depth: 'Standard', subQuestionCount: 4, today: '2026-11-03' };
const sub = (index: number, extra: Json = {}): Json => ({ index, question: `Question ${index}?`, search_query: `query number ${index}`, ...extra });

/** A source as "Grade the evidence" hands it on. */
const src = (host: string, path: string, o: Json = {}): Json => ({
  title: `${host} ${path}`,
  url: `https://${host}/${path}`,
  host,
  site: host.split('.').slice(-2).join('.'),
  published: null,
  kind: 'page',
  text: pageText(),
  ...o,
});
/** One graded sub-question. */
const gradedItem = (index: number, sources: Json[], status = 'ok', o: Json = {}): Json => ({
  index,
  subQuestion: `Question ${index}?`,
  searchQuery: `query number ${index}`,
  status,
  error: null,
  sources,
  ...o,
});
const number = (graded: Json[]): Json => runMany('Number the sources', graded, { 'Research settings': SETTINGS })[0];
const grade = (results: Json[], loop = 'Loop over sub-questions', name = 'Grade the evidence'): Json =>
  runMany(name, results, { [loop]: sub(1) })[0];

const finding = (sourceId: string, subQuestion: number, quote: string, claim = 'The pump trial is described.'): Json => ({ source_id: sourceId, sub_question: subQuestion, claim, quote });
const check = (bundle: Json, findings: Json[], round1?: Json): Json =>
  run('Check the quotes', { output: { findings } }, round1 ? { 'Number the sources': round1, 'Add the new sources': bundle } : { 'Number the sources': bundle })[0];

/** Three sub-questions with two sources each, from six sites; the second sub-question's pages are on a.example and b.example. */
const threeSubs = (): Json[] => [
  gradedItem(1, [src('a.example', 'one'), src('b.example', 'two')]),
  gradedItem(2, [src('c.example', 'three'), src('d.example', 'four')]),
  gradedItem(3, [src('e.example', 'five'), src('f.example', 'six')]),
];

describe('example 11: the workflow file', () => {
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

  it('feeds the model node into the four chains, and a parser into each chain that expects a structured answer', () => {
    const lm = example.connections['OpenRouter model'].ai_languageModel[0].map((c) => c.node).sort();
    expect(lm).toEqual(['Extract quoted findings', 'Plan sub-questions', 'Rewrite the queries', 'Write the report']);
    const parsed = new Set<string>();
    for (const types of Object.values(example.connections)) for (const branch of types.ai_outputParser || []) for (const c of branch) parsed.add(c.node);
    for (const n of example.nodes.filter((x) => x.type.endsWith('chainLlm'))) expect(parsed.has(n.name)).toBe(n.parameters.hasOutputParser);
  });

  it('names no personal identifier, and holds only plain ASCII (the code writes its symbols as escapes)', () => {
    expect(fileText).not.toMatch(/samnodehi|noodehi/i);
    expect(fileText).not.toMatch(/[^\x00-\x7f]/);
  });

  it('keeps the sticky notes within the rules for templates in n8n’s library', () => {
    const words = (t: string) => t.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
    const notes = example.nodes.filter((n) => n.type === 'n8n-nodes-base.stickyNote');
    const overview = notes.filter((n) => n.parameters.color === 1);
    expect(overview).toHaveLength(1);
    expect(overview[0].parameters.content).toContain('### How it works');
    expect(overview[0].parameters.content).toContain('### Setup');
    expect(overview[0].parameters.content).toContain('n8n 2.18 or later');
    expect(overview[0].parameters.content).toContain('32.19.1 or later');
    expect(words(overview[0].parameters.content)).toBeGreaterThanOrEqual(100);
    expect(words(overview[0].parameters.content)).toBeLessThanOrEqual(300);
    for (const note of notes.filter((n) => n.parameters.color !== 1)) expect(words(note.parameters.content)).toBeLessThan(50);
  });

  it('does not say a report was fact-checked or verified (the portal writes its public title from the file)', () => {
    expect(fileText).not.toMatch(/verif|\bfacts?\b|fact-?check/i);
  });

  it('writes no pattern for an address in any Code node (the upload of templates refuses them)', () => {
    for (const n of example.nodes.filter((x) => x.type === 'n8n-nodes-base.code')) {
      const code = n.parameters.jsCode as string;
      expect(code).not.toMatch(/\/\^?https?[:?]/);
      expect(code).not.toMatch(/\\\/\\\//);
      expect(code).not.toMatch(/new RegExp/);
    }
  });

  it('bounds the run: the form sets the number of searches, the second round adds two at most, and every search is paced', () => {
    expect(example.settings.executionTimeout).toBeGreaterThan(0);
    const settings = sourceOf('Research settings');
    expect(settings).toContain('depth.startsWith(\'Thorough\') ? 5');
    expect(sourceOf('Find the gaps')).toContain('const MAX_GAPS = 2;');
    expect(sourceOf('Plan the second round')).toContain('const MAX_QUERIES = 2;');
    expect(sourceOf('Number the sources')).toContain('const MAX_PER_SITE = 2;');
    expect(sourceOf('Add the new sources')).toContain('const MAX_PER_SITE = 2;');
    for (const name of ['Search DuckDuckGo', 'Search again']) {
      const n = nodeOf(name);
      const options = n.parameters.webSearchOptions;
      expect(n.onError).toBe('continueRegularOutput');
      expect(n.alwaysOutputData).toBe(true);
      expect(n.parameters.errorHandling).toBe('continueOnFail');
      expect(options.fetchPageContent).toBe(true);
      expect(options.pageContentMaxResults).toBeLessThanOrEqual(5);
      expect(options.pageContentMaxLength).toBeGreaterThan(0);
      expect(options.pageContentMaxLength).toBeLessThanOrEqual(5000);
      expect(options.pageContentTimeout).toBeLessThanOrEqual(15000);
    }
    expect(nodeOf('Search again').parameters).toEqual(nodeOf('Search DuckDuckGo').parameters);
    expect(nodeOf('Pace the searches').parameters.amount).toBeGreaterThanOrEqual(5);
    expect(nodeOf('Pace round two').parameters).toEqual(nodeOf('Pace the searches').parameters);
  });

  it('keeps the helpers that several nodes share identical in all of them', () => {
    const site = block('Number the sources', 'const siteOf = ');
    expect(site).toContain('parts.slice(-take)');
    for (const name of ['Grade the evidence', 'Grade the new evidence', 'Add the new sources']) expect(block(name, 'const siteOf = ')).toBe(site);
    for (const start of ['const partsOf = ', 'const keyOf = ', 'const fence = ']) {
      const text = block('Number the sources', start);
      expect(text.length).toBeGreaterThan(30);
      expect(block('Add the new sources', start)).toBe(text);
    }
    const esc = sourceOf('Build the page').split('\n').find((l) => l.startsWith('const esc = '));
    expect(esc).toBeDefined();
    for (const name of ['Make the result page', 'Explain why there is no report']) expect(sourceOf(name).split('\n').find((l) => l.startsWith('const esc = '))).toBe(esc);
  });

  it('sends each branch of each decision where the second round expects it', () => {
    const out = (from: string, branch: number) => (example.connections[from].main[branch] || []).map((c) => c.node);
    expect(out('Loop over sub-questions', 0)).toEqual(['Number the sources']);
    expect(out('Loop over sub-questions', 1)).toEqual(['Search DuckDuckGo']);
    expect(out('Enough evidence?', 0)).toEqual(['Extract quoted findings']);
    expect(out('Enough evidence?', 1)).toEqual(['Explain why there is no report']);
    expect(out('Gaps to fill?', 0)).toEqual(['Rewrite the queries']);
    expect(out('Gaps to fill?', 1)).toEqual(['Any checked findings?']);
    expect(out('New queries?', 0)).toEqual(['Loop over the new queries']);
    expect(out('New queries?', 1)).toEqual(['Any checked findings?']);
    expect(out('Loop over the new queries', 0)).toEqual(['Add the new sources']);
    expect(out('Loop over the new queries', 1)).toEqual(['Search again']);
    expect(out('Add the new sources', 0)).toEqual(['Extract quoted findings']);
    expect(out('Any checked findings?', 0)).toEqual(['Write the report']);
    expect(out('Any checked findings?', 1)).toEqual(['Explain why there is no report']);
    expect(out('Explain why there is no report', 0)).toEqual(['Make the result page']);
  });

  it('decides on fields that the node before it produces', () => {
    const condition = (name: string) => nodeOf(name).parameters.conditions.conditions[0].leftValue as string;
    expect(condition('Enough evidence?')).toBe('={{ $json.enough }}');
    expect(condition('Gaps to fill?')).toBe('={{ $json.retry }}');
    expect(condition('New queries?')).toBe('={{ $json.valid }}');
    expect(condition('Any checked findings?')).toBe('={{ $json.enough }}');
    const bundle = number(threeSubs());
    expect(typeof bundle.enough).toBe('boolean');
    const state = run('Find the gaps', check(bundle, []))[0];
    expect([typeof state.retry, typeof state.enough]).toEqual(['boolean', 'boolean']);
    const plan = runMany('Plan the second round', [{ output: {} }], { 'Find the gaps': state });
    expect(typeof plan[0].valid).toBe('boolean');
  });

  it('keeps what the first round found when the model call of an extraction fails, and says so when it is the first', () => {
    expect(nodeOf('Extract quoted findings').onError).toBe('continueRegularOutput');
    expect(nodeOf('Rewrite the queries').onError).toBe('continueRegularOutput');
  });

  it('grades the sources of the second round with the same code as the first, reading its own loop', () => {
    const first = sourceOf('Grade the evidence');
    const second = sourceOf('Grade the new evidence');
    expect(first).toContain("$('Loop over sub-questions')");
    expect(second).toContain("$('Loop over the new queries')");
    expect(second.split("$('Loop over the new queries')").join("$('Loop over sub-questions')")).toBe(first);
  });
});

describe('example 11: Grade the evidence', () => {
  it('returns exactly one item whatever the search did', () => {
    expect(runMany('Grade the evidence', [], { 'Loop over sub-questions': sub(2) })).toHaveLength(1);
    const failed = grade([{ error: 'status code 429' }]);
    expect(failed).toMatchObject({ index: 1, status: 'blocked', sources: [] });
    expect(grade([{ error: 'parse failure' }]).status).toBe('no_evidence');
  });

  it('calls a sub-question ok only when two pages come from two different sites', () => {
    const a = result('https://one.example/a');
    expect(grade([a, result('https://two.example/b')]).status).toBe('ok');
    expect(grade([a, result('https://blog.one.example/b')]).status).toBe('thin');
    expect(grade([result('https://one.co.uk/a'), result('https://two.co.uk/b')]).status).toBe('ok');
    expect(grade([result('https://news.one.co.uk/a'), result('https://www.one.co.uk/b')]).status).toBe('thin');
  });

  it('uses the description of a page that could not be read, and skips what is too short to quote', () => {
    const r = grade([
      result('https://one.example/a', { pageContent: '', pageContentError: 'HTTP 403' }),
      result('https://two.example/b', { pageContent: '', description: 'short' }),
      result('https://three.example/c', { pageContent: 'enable javascript to see this page. ' + prose(80) }),
    ]);
    expect(r.sources.map((s: Json) => [s.host, s.kind])).toEqual([['one.example', 'snippet'], ['three.example', 'snippet']]);
  });

  it('skips addresses with a user name or a backslash, and results without an address', () => {
    const r = grade([result('https://news.example@evil.example/a'), result('https://x.example\\@evil.example/a'), result('ftp://x.example/a'), { title: 'no address' }]);
    expect(r.sources).toEqual([]);
  });

  it('reads the host and site by plain steps', () => {
    const r = grade([result('HTTPS://WWW.Blog.Example.CO.UK.:8080/a?b#c')]);
    expect(r.sources[0]).toMatchObject({ host: 'blog.example.co.uk', site: 'example.co.uk' });
    expect(grade([result('http://203.0.113.5/a')]).sources[0]).toMatchObject({ host: '203.0.113.5', site: '203.0.113.5' });
  });
});

describe('example 11: Number the sources', () => {
  it('numbers the sources in the order of the sub-questions, and a page found twice is one source', () => {
    const b = number([
      gradedItem(2, [src('c.example', 'three'), src('a.example', 'one?utm_source=x')]),
      gradedItem(1, [src('a.example', 'one/'), src('b.example', 'two')]),
    ]);
    expect(b.sources.map((s: Json) => [s.id, s.host])).toEqual([['S1', 'a.example'], ['S2', 'b.example'], ['S3', 'c.example']]);
    expect(b.subQuestions.map((s: Json) => s.sourceIds)).toEqual([['S1', 'S2'], ['S3', 'S1']]);
    expect(b.round).toBe(1);
    expect(b.usedQueries).toEqual(['query number 1', 'query number 2']);
  });

  it('keeps two addresses that differ only by the case of their path or query as two pages, and lower-cases only the host', () => {
    const b = number([gradedItem(1, [src('A.Example', 'Report?id=A'), src('a.example', 'report?id=a'), src('www.a.example', 'Report?id=A')]), gradedItem(2, [src('b.example', 'two')])]);
    expect(b.sources.map((s: Json) => s.url)).toEqual(['https://A.Example/Report?id=A', 'https://a.example/report?id=a', 'https://b.example/two']);
    expect(b.skippedBySite).toBe(0);
    expect(b.subQuestions[0].sourceIds).toEqual(['S1', 'S2']);
  });

  it('lets one site give two sources and no more, and a readable page takes the place before a snippet', () => {
    const b = number([
      gradedItem(1, [src('x.example', 'snip', { kind: 'snippet' }), src('www.x.example', 'a'), src('blog.x.example', 'b'), src('y.example', 'c')]),
      gradedItem(2, [src('news.x.example', 'd'), src('z.example', 'e')]),
    ]);
    const bySite = b.sources.filter((s: Json) => s.site === 'x.example');
    expect(bySite.map((s: Json) => s.url)).toEqual(['https://www.x.example/a', 'https://blog.x.example/b']);
    expect(b.skippedBySite).toBe(2);
    expect(b.subQuestions[1].sourceIds).toHaveLength(1);
  });

  it('stops with fewer than three sources or when half the searches are blocked, and says how many were blocked', () => {
    expect(number([gradedItem(1, [src('a.example', 'one')]), gradedItem(2, [src('b.example', 'two')])]).enough).toBe(false);
    expect(number(threeSubs()).enough).toBe(true);
    const blocked = number([gradedItem(1, [], 'blocked'), gradedItem(2, [src('a.example', 'one'), src('b.example', 'two'), src('c.example', 'three')])]);
    expect(blocked).toMatchObject({ blocked: true, enough: false });
  });

  it('fences each source with a long per-run code that a page cannot forge', () => {
    const b = number(threeSubs());
    expect(b.nonce.length).toBeGreaterThanOrEqual(12);
    expect(b.evidence).toContain(`<<<SOURCE S1 ${b.nonce}>>>`);
    expect(b.evidence).toContain(`<<<END S6 ${b.nonce}>>>`);
    expect(b.plan).toContain('1. Question 1?  [sources: S1, S2]');
    expect(number(threeSubs()).nonce).not.toBe(b.nonce);
  });
});

describe('example 11: Check the quotes', () => {
  const bundle = number(threeSubs());
  const quote = SENTENCE(3);

  it('keeps a finding whose quote is in the source, whatever the case, quote marks and dashes', () => {
    const r = check(bundle, [finding('S1', 1, quote.toUpperCase()), finding('S2', 1, quote)]);
    expect(r).toMatchObject({ round: 1, keptCount: 2, discarded: 0, enough: true });
    expect(r.kept[0]).toMatchObject({ sourceId: 'S1', url: 'https://a.example/one', subQuestion: 1, round: 1 });
  });

  it.each([
    ['a quote that is not in the source', 'This sentence is not on the page at all and was made up by the model.'],
    ['a quote of seven words', 'Sentence number 3 about the pump trial'],
    ['a quote with an ellipsis in the middle', 'Sentence number 3 about the pump ... is stated plainly in this paragraph of the page.'],
    ['a quote that joins two passages with three dots', 'Sentence number 3 about the pump trial... paragraph of the page. Sentence number 4 about the pump trial is stated'],
  ])('discards %s', (_what, text) => {
    expect(check(bundle, [finding('S1', 1, text)])).toMatchObject({ keptCount: 0, discarded: 1 });
  });

  it('trims an ellipsis at either end of a quote', () => {
    const r = check(bundle, [finding('S1', 1, `... ${quote} ...`), finding('S2', 1, `…${quote}…`)]);
    expect(r.keptCount).toBe(2);
    expect(r.kept[0].quote).toBe(quote);
  });

  it('keeps a claim only when every number of it stands in the quote', () => {
    const text = 'The unit delivered 4.0 units of heat for every unit of power in the trial at minus ten degrees.';
    const b = number([gradedItem(1, [src('a.example', 'one', { text: `${prose(40)} ${text} ${prose(40, 1)}` }), src('b.example', 'two')]), gradedItem(2, [src('c.example', 'three')])]);
    expect(check(b, [finding('S1', 1, text, 'It delivered 4.0 units of heat per unit of power.')]).keptCount).toBe(1);
    expect(check(b, [finding('S1', 1, text, 'It delivered 40 units of heat per unit of power.')]).keptCount).toBe(0);
    expect(check(b, [finding('S1', 1, text, 'In 2020 it delivered 4.0 units of heat.')]).keptCount).toBe(0);
    expect(check(b, [finding('S1', 1, text, 'It delivered 4,0 units of heat.')]).keptCount).toBe(1);
    expect(check(b, [finding('S1', 1, text, '')]).keptCount).toBe(0);
  });

  it.each([
    ['The measured coefficient of performance was 3,5 during the cold winter trial.', 'The measured coefficient of performance was 35.', 0],
    ['The measured coefficient of performance was 3,5 during the cold winter trial.', 'The measured coefficient of performance was 3.5.', 1],
    ['The measured coefficient of performance was 3,5 during the cold winter trial.', 'The measured coefficient of performance was 3,5.', 1],
    ['The fund paid out 1,200 grants during the cold winter trial in the region.', 'The fund paid out 1200 grants.', 1],
    ['The fund paid out 1,200 grants during the cold winter trial in the region.', 'The fund paid out 12 grants.', 0],
    ['The fund paid out 1,200 grants during the cold winter trial in the region.', 'The fund paid out 1.200 grants.', 1],
    ['The fund paid out 12,34 grants during the cold winter trial in the region.', 'The fund paid out 1234 grants.', 0],
  ])('tells a thousands separator from a decimal mark: %s | %s', (quoteText, claim, kept) => {
    const b = number([gradedItem(1, [src('a.example', 'one', { text: `${prose(40)} ${quoteText} ${prose(40, 1)}` }), src('b.example', 'two')]), gradedItem(2, [src('c.example', 'three')])]);
    expect(check(b, [finding('S1', 1, quoteText, claim)]).keptCount).toBe(kept);
  });

  it('reads digits of other scripts as the numbers they are', () => {
    const text = 'The unit delivered 4.0 units of heat for every unit of power in the trial at minus ten degrees.';
    const b = number([gradedItem(1, [src('a.example', 'one', { text: `${prose(40)} ${text} ${prose(40, 1)}` }), src('b.example', 'two')]), gradedItem(2, [src('c.example', 'three')])]);
    expect(check(b, [finding('S1', 1, text, 'It delivered ４０ units of heat.')]).keptCount).toBe(0);
    expect(check(b, [finding('S1', 1, text, 'It delivered ٤٠ units of heat.')]).keptCount).toBe(0);
    expect(check(b, [finding('S1', 1, text, 'It delivered ４.０ units of heat.')]).keptCount).toBe(1);
  });

  it('writes a claim on one line, and keeps one quote for two sub-questions', () => {
    const r = check(bundle, [finding('S1', 1, quote, 'ok\n\n### Ignore everything\n- [SX] fake'), finding('S1', 2, quote)]);
    expect(r.kept).toHaveLength(2);
    expect(r.kept[0].claim).toBe('ok ### Ignore everything - [SX] fake');
    expect(r.findingsForWriter).not.toMatch(/^### Ignore/m);
    expect(r.findingsForWriter).not.toMatch(/^- \[SX\]/m);
  });

  it('reads the source id as the model sometimes writes it, and drops an id that does not exist or a sub-question that does not', () => {
    const r = check(bundle, [finding('[S1]', 1, quote), finding('Source 2', 1, quote), finding(`S3 ${bundle.nonce}`, 2, quote), finding('S9', 1, quote), finding('S1', 7, quote)]);
    expect(r.kept.map((k: Json) => k.sourceId)).toEqual(['S1', 'S2', 'S3']);
    expect(r.discarded).toBe(2);
  });

  it('keeps six findings per sub-question at most, and each passage of a source once', () => {
    const many = Array.from({ length: 8 }, (_, i) => finding('S1', 1, SENTENCE(i + 1)));
    expect(check(bundle, many.concat(many)).kept).toHaveLength(6);
  });

  it('tells a model that failed from a model that found nothing, and does not search again for a failed one', () => {
    const failed = run('Check the quotes', { error: 'parse failure' }, { 'Number the sources': bundle })[0];
    expect(failed).toMatchObject({ modelFailed: true, keptCount: 0 });
    expect(run('Check the quotes', { output: { findings: [] } }, { 'Number the sources': bundle })[0].modelFailed).toBe(false);
    const state = run('Find the gaps', failed)[0];
    expect(state).toMatchObject({ retry: false });
    expect(state.retryWhy).toContain('did not return findings');
    expect(run('Explain why there is no report', state)[0].html).toContain('The model did not return findings that could be read');
  });

  it('keeps the findings of the first round when the extraction of the second round fails', () => {
    const first = check(bundle, [finding('S1', 1, SENTENCE(2)), finding('S2', 1, SENTENCE(3))]);
    const state = run('Find the gaps', first)[0];
    const second = runMany('Add the new sources', [gradedItem(2, [src('g.example', 'seven')])], { 'Find the gaps': state })[0];
    const r = run('Check the quotes', { error: 'parse failure' }, { 'Number the sources': bundle, 'Add the new sources': second })[0];
    expect(r).toMatchObject({ round: 2, keptCount: 2, enough: true, modelFailed: true });
  });

  it('writes one block of text per sub-question for the writer, and says when a sub-question has no checked finding', () => {
    const r = check(bundle, [finding('S1', 1, quote), finding('S3', 2, quote)]);
    expect(r.findingsForWriter).toContain('### 1. Question 1? (2 sources read)');
    expect(r.findingsForWriter).toContain('- [S1] The pump trial is described. (quote: "' + quote + '")');
    expect(r.findingsForWriter).toContain('### 3. Question 3? (2 sources read)\n- No checked finding');
    expect(check(bundle, [finding('S1', 1, quote)]).enough).toBe(false);
  });
});

describe('example 11: Find the gaps', () => {
  const bundle = number(threeSubs());
  const gaps = (findings: Json[], b: Json = bundle, prior?: Json) => run('Find the gaps', check(b, findings, prior))[0];

  it('names the sub-questions without a checked finding', () => {
    const r = gaps([finding('S1', 1, SENTENCE(2)), finding('S2', 1, SENTENCE(3))]);
    expect(r.retry).toBe(true);
    expect(r.gaps.map((g: Json) => g.index)).toEqual([2, 3]);
    expect(r.gaps[0]).toMatchObject({ question: 'Question 2?', searchQuery: 'query number 2' });
    expect(r.enough).toBe(true);
  });

  it('does not search again when every sub-question has a finding', () => {
    const r = gaps([finding('S1', 1, SENTENCE(2)), finding('S3', 2, SENTENCE(3)), finding('S5', 3, SENTENCE(4))]);
    expect(r).toMatchObject({ retry: false, gaps: [], gapCount: 0 });
    expect(r.retryWhy).toContain('has a checked finding');
  });

  it('asks for two sub-questions at most, the earliest first', () => {
    const four = number([...threeSubs(), gradedItem(4, [src('g.example', 'seven'), src('h.example', 'eight')])]);
    const r = gaps([finding('S1', 1, SENTENCE(2))], four);
    expect(r.gapCount).toBe(3);
    expect(r.gaps.map((g: Json) => g.index)).toEqual([2, 3]);
  });

  it('sends no more searches after a block, and does not retry a blocked sub-question', () => {
    const blocked = number([...threeSubs(), gradedItem(4, [], 'blocked')]);
    const r = gaps([finding('S1', 1, SENTENCE(2))], blocked);
    expect(r).toMatchObject({ retry: false, gaps: [] });
    expect(r.retryWhy).toContain('blocked');
  });

  it('runs only one extra round', () => {
    const round2 = { ...bundle, round: 2, gapIndexes: [2, 3], previous: { kept: [], discarded: 0 } };
    const r = gaps([finding('S3', 2, SENTENCE(2))], round2, bundle);
    expect(r).toMatchObject({ retry: false, round: 2 });
    expect(r.gapCount).toBe(2);
  });
});

describe('example 11: Plan the second round', () => {
  const bundle = number(threeSubs());
  const state = run('Find the gaps', check(bundle, [finding('S1', 1, SENTENCE(2)), finding('S2', 1, SENTENCE(3))]))[0];
  const plan = (queries: unknown, output: Json | undefined = { queries }) => runMany('Plan the second round', [output === undefined ? {} : { output }], { 'Find the gaps': state });

  it('keeps one new query for each gap', () => {
    const r = plan([{ sub_question: 2, search_query: 'pump efficiency winter study' }, { sub_question: 3, search_query: 'cold climate pump report' }]);
    expect(r.map((i) => [i.valid, i.index, i.search_query])).toEqual([[true, 2, 'pump efficiency winter study'], [true, 3, 'cold climate pump report']]);
  });

  it.each([
    ['repeats a query that was used (whatever the case)', 'QUERY number 2'],
    ['uses a search operator', 'site:gov.example pump winter'],
    ['excludes a word', 'pump winter -news'],
    ['holds an address', 'pump winter https://x.example/a'],
    ['holds a path', 'pump winter docs/report'],
    ['starts with www', 'www.example.org pump winter'],
    ['is one word', 'pumps'],
  ])('drops a query that %s', (_what, text) => {
    const r = plan([{ sub_question: 2, search_query: text }]);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ valid: false, retry: false });
    expect(r[0].bundle.usedQueries).toEqual(['query number 1', 'query number 2', 'query number 3']);
  });

  it.each([
    ['a full-width colon', 'site：example.com pump winter'],
    ['a full-width dash', '－site pump winter'],
    ['a bang', '!g pump winter'],
    ['an uppercase OR', 'pump OR winter study'],
    ['a plus sign', '+pump winter study'],
    ['a bracket', 'pump (winter) study'],
    ['a control character', 'pump\u0000 winter study'],
    ['something that is not text', { a: 1 }],
  ])('drops a query with %s', (_what, text) => {
    const r = plan([{ sub_question: 2, search_query: text }]);
    expect(r[0]).toMatchObject({ valid: false });
  });

  it('keeps plain keywords with a hyphen inside a word, a full stop or a comma', () => {
    const r = plan([{ sub_question: 2, search_query: 'cold-climate heat pump node.js, 2019 audit' }]);
    expect(r[0]).toMatchObject({ valid: true, search_query: 'cold-climate heat pump node.js, 2019 audit' });
  });

  it('removes quotation marks, ignores sub-questions that are not gaps, and takes the first query for a gap', () => {
    const r = plan([
      { sub_question: 1, search_query: 'something else entirely' },
      { sub_question: 2, search_query: '"pump  winter" \'study\'' },
      { sub_question: 2, search_query: 'second try for two' },
    ]);
    expect(r.map((i) => [i.index, i.search_query])).toEqual([[2, 'pump winter study']]);
  });

  it('cuts a query to 120 characters and keeps two queries at most', () => {
    const long = Array.from({ length: 60 }, () => 'word').join(' ');
    const r = plan([{ sub_question: 2, search_query: long }, { sub_question: 3, search_query: 'another new query' }]);
    expect(r[0].search_query.length).toBeLessThanOrEqual(120);
    expect(r).toHaveLength(2);
  });

  it('carries on the state when the model gave nothing usable or failed', () => {
    for (const output of [undefined, {}, { queries: 'x' }, { queries: [] }]) {
      const r = runMany('Plan the second round', [output === undefined ? { error: 'model failed' } : { output }], { 'Find the gaps': state });
      expect(r).toHaveLength(1);
      expect(r[0]).toMatchObject({ valid: false, enough: state.enough, keptCount: 2 });
    }
  });
});

describe('example 11: Add the new sources', () => {
  const round1 = number(threeSubs());
  const state = run('Find the gaps', check(round1, [finding('S1', 1, SENTENCE(2)), finding('S2', 1, SENTENCE(3))]))[0];
  const add = (graded: Json[]): Json => runMany('Add the new sources', graded, { 'Find the gaps': state })[0];

  it('keeps every id of the first round and gives the next numbers to new pages', () => {
    const r = add([
      gradedItem(2, [src('c.example', 'three/'), src('g.example', 'seven')], 'ok', { searchQuery: 'new query two' }),
      gradedItem(3, [src('h.example', 'eight')], 'thin', { searchQuery: 'new query three' }),
    ]);
    expect(r.sources.slice(0, 6).map((s: Json) => [s.id, s.url])).toEqual(round1.sources.map((s: Json) => [s.id, s.url]));
    expect(r.sources.slice(6).map((s: Json) => [s.id, s.url, s.round])).toEqual([['S7', 'https://g.example/seven', 2], ['S8', 'https://h.example/eight', 2]]);
    expect(r.round).toBe(2);
    expect(r.gapIndexes).toEqual([2, 3]);
  });

  it('shows the model only what the new searches found, for the sub-questions that are gaps', () => {
    const r = add([gradedItem(2, [src('c.example', 'three'), src('g.example', 'seven')]), gradedItem(3, [])]);
    expect(r.evidence).toContain(`<<<SOURCE S3 ${r.nonce}>>>`);
    expect(r.evidence).toContain(`<<<SOURCE S7 ${r.nonce}>>>`);
    expect(r.evidence).not.toContain('<<<SOURCE S1 ');
    expect(r.plan).toBe('2. Question 2?  [sources: S3, S7]\n3. Question 3?  [no sources found]');
    expect(r.nonce).not.toBe(round1.nonce);
  });

  it('counts the pages of the first round against the limit of two sources for a site', () => {
    const r = add([gradedItem(2, [src('a.example', 'extra1'), src('a.example', 'extra2')])]);
    expect(r.sources.filter((s: Json) => s.site === 'example')).toHaveLength(0);
    expect(r.sources).toHaveLength(7);
    expect(r.skippedBySite).toBe(1);
  });

  it('notes which sub-questions were searched again, and carries the first round on', () => {
    const r = add([gradedItem(2, [src('g.example', 'seven')], 'ok', { searchQuery: 'new query two' }), gradedItem(3, [], 'blocked', { searchQuery: 'new query three' })]);
    expect(r.subQuestions[0].searchedAgain).toBeUndefined();
    expect(r.subQuestions[1]).toMatchObject({ searchedAgain: true, secondStatus: 'ok', secondQuery: 'new query two' });
    expect(r.subQuestions[2]).toMatchObject({ searchedAgain: true, secondStatus: 'blocked' });
    expect(r.usedQueries).toEqual(['query number 1', 'query number 2', 'query number 3', 'new query two', 'new query three']);
    expect(r.previous.kept).toHaveLength(2);
    expect(r.question).toBe(REQUEST);
  });
});

describe('example 11: the second round of Check the quotes', () => {
  const round1 = number(threeSubs());
  const first = check(round1, [finding('S1', 1, SENTENCE(2)), finding('S2', 1, SENTENCE(3))]);
  const state = run('Find the gaps', first)[0];
  const second = runMany('Add the new sources', [gradedItem(2, [src('g.example', 'seven')]), gradedItem(3, [src('h.example', 'eight')])], { 'Find the gaps': state })[0];
  const again = (findings: Json[]): Json => run('Check the quotes', { output: { findings } }, { 'Number the sources': round1, 'Add the new sources': second })[0];

  it('adds to the findings of the first round and checks the new ones against the page they name', () => {
    const r = again([finding('S7', 2, SENTENCE(5)), finding('S8', 3, SENTENCE(6))]);
    expect(r.round).toBe(2);
    expect(r.kept.map((k: Json) => [k.sourceId, k.url, k.subQuestion, k.round])).toEqual([
      ['S1', 'https://a.example/one', 1, 1],
      ['S2', 'https://b.example/two', 1, 1],
      ['S7', 'https://g.example/seven', 2, 2],
      ['S8', 'https://h.example/eight', 3, 2],
    ]);
    expect(r.keptCount).toBe(4);
    expect(r.bundle.sources.slice(0, 6).map((s: Json) => s.url)).toEqual(round1.sources.map((s: Json) => s.url));
  });

  it('accepts only the sub-questions that were searched again', () => {
    const r = again([finding('S7', 1, SENTENCE(5)), finding('S7', 2, SENTENCE(5))]);
    expect(r.kept.map((k: Json) => k.subQuestion)).toEqual([1, 1, 2]);
    expect(r.discarded).toBe(1);
  });

  it('counts the findings that were discarded in the first round', () => {
    const odd = check(round1, [finding('S1', 1, SENTENCE(2)), finding('S2', 1, SENTENCE(3)), finding('S1', 1, 'a made up quote that is not on the page at all, none of it')]);
    expect(odd.discarded).toBe(1);
    const s = run('Find the gaps', odd)[0];
    const sec = runMany('Add the new sources', [gradedItem(2, [src('g.example', 'seven')])], { 'Find the gaps': s })[0];
    expect(run('Check the quotes', { output: { findings: [] } }, { 'Number the sources': round1, 'Add the new sources': sec })[0].discarded).toBe(1);
  });

  it('does not keep a passage twice', () => {
    const r = again([finding('S7', 2, SENTENCE(5)), finding('S7', 2, SENTENCE(5).toUpperCase())]);
    expect(r.kept.filter((k: Json) => k.sourceId === 'S7')).toHaveLength(1);
  });
});

describe('example 11: Check citations and add sources', () => {
  const sources: Json[] = [
    { ...src('a.example', 'one'), id: 'S1', site: 'a.example' },
    { ...src('b.example', 'two'), id: 'S2', site: 'b.example', kind: 'snippet' },
    { ...src('c.example', 'three'), id: 'S3', site: 'c.example' },
  ];
  const subQuestions = [
    { index: 1, question: 'Question 1?', status: 'ok', sourceIds: ['S1', 'S2'] },
    { index: 2, question: 'Question 2?', status: 'ok', sourceIds: ['S3'], searchedAgain: true, secondStatus: 'ok' },
  ];
  const kept = [
    { sourceId: 'S1', url: sources[0].url, subQuestion: 1, claim: 'c', quote: 'First passage of one.', round: 1 },
    { sourceId: 'S3', url: sources[2].url, subQuestion: 2, claim: 'c', quote: 'Only passage of three.', round: 2 },
  ];
  const checks = (o: Json = {}): Json => ({
    question: 'What is photosynthesis?', today: '2026-11-03', kept, keptCount: kept.length, discarded: 0, enough: true,
    bundle: { sources, subQuestions, skippedBySite: 0, round: 2 }, ...o,
  });
  const report = (text: string, c: Json = checks()): Json => run('Check citations and add sources', { text }, { 'Any checked findings?': c })[0];

  it('cites only sources with a checked finding, and removes the citation of any other id', () => {
    const r = report('## Summary\n\n- Plants make sugar [S1, S2, S9].\n- Light matters [S3].\n- Nothing known [S2].');
    expect(r.report).toContain('Plants make sugar [S1]');
    expect(r.report).toContain('Light matters [S3]');
    expect(r.droppedCitations).toBe(3);
    expect(r.report).toContain('3 citations to unknown sources removed');
    expect(r.report).not.toContain('Nothing known');
  });

  it('leaves out a sentence without a citation, but not one cut by an abbreviation or an initial', () => {
    const r = report('## Summary\n\n- This one has no citation. The U.S. Department of Energy said it works [S1]. Dr. Smith agreed [S3]. Vitamin A. Next it grows [S1].');
    expect(r.report).toContain('The U.S. Department of Energy said it works [S1].');
    expect(r.report).toContain('Dr. Smith agreed [S3].');
    expect(r.report).not.toContain('This one has no citation');
    expect(r.report).toContain('1 sentence without a citation left out');
  });

  it('removes HTML, images, links, addresses and reference definitions that the model wrote', () => {
    const r = report('## Summary\n\n- <img src=x onerror=alert(1)> Sugar [S1] [x](javascript:alert(1)) see https://evil.example/a and www.evil.example [S3]\n- ![p](http://evil.example/p.png) Light [S1]\n\n[ref]: http://evil.example');
    expect(r.report).not.toMatch(/evil|onerror|<img|javascript|\]:/);
    expect(r.report).toContain('Sugar');
  });

  it('shows page text as text: tags, markup and hidden characters in a title, address or quote do nothing', () => {
    const hostile = [{ ...sources[0], title: '<script>alert(1)</script>[x](javascript:y) ‮​**bold**', url: 'https://a.example/x)(y"z' }, sources[1], sources[2]];
    const c = checks({ bundle: { sources: hostile, subQuestions, skippedBySite: 0 }, kept: [{ ...kept[0], quote: 'line one\n- injected item\n# heading <b>x</b>' }, kept[1]] });
    const r = report('## Summary\n\n- Sugar [S1].', c).report as string;
    expect(r).not.toMatch(/<script|<b>|‮|​/);
    expect(r).toContain('https://a.example/x%29%28y%22z');
    expect(r).not.toMatch(/^- injected item/m);
    expect(r).not.toMatch(/^# heading/m);
  });

  it('lists up to four passages under each source, and counts the rest', () => {
    const many = ['a', 'b', 'c', 'd', 'e', 'f'].map((w) => ({ ...kept[0], quote: `Passage ${w} is long enough.` }));
    const r = report('## Summary\n\n- Sugar [S1].', checks({ kept: many.concat(kept[1]) })).report as string;
    expect(r.split('\n').filter((l) => l.startsWith('    - “Passage'))).toHaveLength(4);
    expect(r).toContain('_+2 more checked_');
  });

  it('adds a coverage table with the second search, and counts what the second round found', () => {
    const r = report('## Summary\n\n- Sugar [S1].\n- Light [S3].').report as string;
    expect(r).toContain('| # | Sub-question | Read | Findings used | Searched again |');
    expect(r).toContain('| 1 | Question 1? | 1 page + 1 snippet | 1 | - |');
    expect(r).toContain('| 2 | Question 2? | 1 page | 1 | Yes |');
    expect(r).toContain('from 3 sources on 3 sites');
    expect(r).toContain('A second search with a rewritten query was made for 1 sub-question and found checked findings for 1.');
  });

  it('says so when the search of the second round was blocked, and when pages were left out for their site', () => {
    const blocked = checks({ bundle: { sources, subQuestions: [subQuestions[0], { ...subQuestions[1], secondStatus: 'blocked' }], skippedBySite: 3 } });
    const r = report('## Summary\n\n- Sugar [S1].', blocked).report as string;
    expect(r).toContain('| 2 | Question 2? | 1 page | 1 | Blocked by DuckDuckGo |');
    expect(r).toContain('3 more pages were left out because their site already gave two sources');
  });

  it.each([
    ['spaces between words', 'a' + ' '.repeat(200000) + 'b [S1]'],
    ['opening brackets', '['.repeat(200000)],
    ['unclosed citations', '[S1 '.repeat(50000)],
    ['unclosed tags', '<script '.repeat(25000)],
    ['full stops and spaces', 'x.' + ' '.repeat(200000) + 'Y [S1]'],
  ])('stays fast on a model text made of %s', (_what, text) => {
    const started = Date.now();
    report('## Summary\n\n- ' + text);
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it('leaves no link that can run code, in a sentence or in the Gaps section', () => {
    const r = report('## Summary\n\n- [click](javascript:alert((1))) now [S1]\n- [a][b] and JavaScript:alert(1) and data:text/html;base64,AAA [S3]\n\n## Gaps and limits\n\n- [a]: javascript:alert(1)\n- [S1]: a note').report as string;
    expect(r.split('## Evidence coverage')[0]).not.toMatch(/javascript\s*:|data:text|\]\(|vbscript/i);
    expect(r).toContain('[S1]: a note');
  });

  it('removes a citation written in any other form than [S1] or [S1, S2], and counts it', () => {
    const r = report('## Summary\n\n- Invented [S9; S8].\n- Also invented [S1 and S2].\n- Fine [S1].\n- Odd [S99x] and [S3].');
    expect(r.report).toContain('Fine [S1].');
    expect(r.report).toContain('and [S3].');
    expect(r.report).not.toMatch(/Invented|Also invented|S99x|S9;/);
    expect(r.droppedCitations).toBe(3);
  });

  it('keeps the Gaps section, whatever it holds, and names the question as the title', () => {
    const r = report('# Own title\n\n## Summary\n\n- Sugar [S1].\n\n## Gaps and limits\n\nQuestion 2 could not be answered.').report as string;
    expect(r.startsWith('# What is photosynthesis?')).toBe(true);
    expect(r).not.toContain('Own title');
    expect(r).toContain('Question 2 could not be answered.');
  });
});

describe('example 11: the pages that end the form', () => {
  const html = '<h1>Title</h1><p>Body <a href="#s1">link</a></p>';

  it('builds one complete page with a content policy that allows nothing but its own style', () => {
    const r = run('Build the page', { html }, { 'Any checked findings?': { question: 'A <b>bold</b> question & more?', today: '2026-11-03' } })[0];
    expect(r.html).toContain('default-src &#39;none&#39;');
    expect(r.html).toContain('<title>A &lt;b&gt;bold&lt;/b&gt; question &amp; more?</title>');
    expect(r.html).toContain(html);
    expect(r.html).not.toMatch(/<script/);
    expect(r.filename).toBe('research-report-a-b-bold-b-question-more-2026-11-03.html');
  });

  it('shows the report with a Download link and a sandboxed preview of the same file', () => {
    const page = run('Make the result page', { html: '<p>Report "text"</p>', filename: 'r.html' })[0].page as string;
    expect(page).toContain('download="r.html"');
    expect(page).toContain('href="data:text/html;charset=utf-8;base64,' + Buffer.from('<p>Report "text"</p>').toString('base64'));
    expect(page).toContain('sandbox="allow-popups allow-popups-to-escape-sandbox"');
    expect(page).toContain('srcdoc="&lt;p&gt;Report &quot;text&quot;&lt;/p&gt;"');
  });

  it('says why there is no report when too little was found, and names a blocked search', () => {
    const base = number([gradedItem(1, [src('a.example', 'one')], 'thin'), gradedItem(2, [], 'blocked')]);
    const few = run('Explain why there is no report', base)[0];
    expect(few.notice).toBe(true);
    expect(few.html).toContain('Only 1 usable source was found');
    expect(few.html).toContain('Wait about 30 minutes');
    const none = run('Explain why there is no report', { ...check(number(threeSubs()), []), notice: undefined })[0];
    expect(none.html).toContain('0 findings matched its source');
    expect(none.html).toContain('Try rephrasing');
    const page = run('Make the result page', none)[0].page as string;
    expect(page).not.toContain('Download');
  });

  it('escapes a hostile question in the reasons', () => {
    const bad = { ...number(threeSubs()), subQuestions: [{ index: 1, question: '<img src=x onerror=alert(1)>', status: 'thin', sourceIds: [] }], sources: [] };
    expect(run('Explain why there is no report', bad)[0].html).not.toContain('<img');
  });
});

describe('example 11: the other paths of the chain', () => {
  const round1 = number(threeSubs());

  it('writes the report of the first round when the rewritten queries are not usable', () => {
    const first = check(round1, [finding('S1', 1, SENTENCE(2)), finding('S2', 1, SENTENCE(3))]);
    const state = run('Find the gaps', first)[0];
    expect(state.retry).toBe(true);
    const skipped = runMany('Plan the second round', [{ output: { queries: [{ sub_question: 2, search_query: 'site:example.org pump' }] } }], { 'Find the gaps': state })[0];
    expect(skipped).toMatchObject({ valid: false, enough: true, retry: false });
    const text = run('Check citations and add sources', { text: '## Summary\n\n- The trial is described [S1].' }, { 'Any checked findings?': skipped })[0].report as string;
    expect(text).toContain('| 2 | Question 2? | 2 pages | 0 | - |');
    const built = run('Build the page', { html: '<p>x</p>' }, { 'Any checked findings?': skipped })[0];
    expect(run('Make the result page', built)[0].page).toContain('Download research-report-');
  });

  it('explains why there is no report after a second round that found nothing, and names the searched-again sub-questions', () => {
    const none = check(round1, []);
    const state = run('Find the gaps', none)[0];
    const second = runMany('Add the new sources', [gradedItem(1, [src('g.example', 'seven')]), gradedItem(2, [src('h.example', 'eight')])], { 'Find the gaps': state })[0];
    const again = run('Check the quotes', { output: { findings: [] } }, { 'Number the sources': round1, 'Add the new sources': second })[0];
    const final = run('Find the gaps', again)[0];
    expect(final).toMatchObject({ retry: false, enough: false });
    const page = run('Explain why there is no report', final)[0];
    expect(page.html).toContain('0 findings matched its source');
    expect(page.html).toContain('searched a second time');
  });
});

describe('example 11: the whole chain on made-up search results', () => {
  it('fills a gap with the second round, keeps the ids of the first, and ends in a report that cites the right pages', () => {
    // round one: three sub-questions; the second one finds pages that cannot be quoted
    const q = (n: number) => SENTENCE(n);
    const planned = { sub_questions: [1, 2, 3].map((n) => ({ question: `Question ${n}?`, search_query: `query number ${n}` })) };
    const settings = run('Research settings', { question: REQUEST, depth: 'Standard (4 sub-questions)' })[0];
    expect(settings).toMatchObject({ subQuestionCount: 4, today: '2026-11-03' });
    const items = runMany('Cap the sub-questions', [{ output: planned }], { 'Research settings': settings });
    expect(items.map((i) => i.index)).toEqual([1, 2, 3]);

    const g = (i: number, results: Json[]) => runMany('Grade the evidence', results, { 'Loop over sub-questions': items[i - 1] })[0];
    const graded = [
      g(1, [result('https://a.example/one'), result('https://b.example/two')]),
      g(2, [result('https://c.example/three', { pageContent: prose(100) }), result('https://d.example/four', { pageContent: prose(100, 1) })]),
      g(3, [result('https://e.example/five'), result('https://f.example/six')]),
    ];
    const bundle = runMany('Number the sources', graded, { 'Research settings': settings })[0];
    expect(bundle.enough).toBe(true);

    const checks1 = run('Check the quotes', { output: { findings: [finding('S1', 1, q(2)), finding('S5', 3, q(4)), finding('S6', 3, q(5))] } }, { 'Number the sources': bundle })[0];
    const state = run('Find the gaps', checks1)[0];
    expect(state).toMatchObject({ retry: true, enough: true });
    expect(state.gaps.map((x: Json) => x.index)).toEqual([2]);

    const next = runMany('Plan the second round', [{ output: { queries: [{ sub_question: 2, search_query: 'pump trial winter report' }] } }], { 'Find the gaps': state });
    expect(next).toHaveLength(1);
    const g2 = runMany('Grade the new evidence', [result('https://g.example/seven'), result('https://c.example/three')], { 'Loop over the new queries': next[0] })[0];
    const merged = runMany('Add the new sources', [g2], { 'Find the gaps': state })[0];
    expect(merged.sources.slice(0, 6).map((s: Json) => s.url)).toEqual(bundle.sources.map((s: Json) => s.url));

    const checks2 = run('Check the quotes', { output: { findings: [finding('S7', 2, q(7))] } }, { 'Number the sources': bundle, 'Add the new sources': merged })[0];
    const done = run('Find the gaps', checks2)[0];
    expect(done).toMatchObject({ retry: false, enough: true, keptCount: 4 });

    const text = run('Check citations and add sources', { text: '## Summary\n\n- First [S1].\n- Second [S7].\n- Third [S5, S6].' }, { 'Any checked findings?': done })[0].report as string;
    expect(text).toContain('- **S7** [Page https://g.example/seven](https://g.example/seven)');
    expect(text).toContain('| 2 | Question 2? | 3 pages | 1 | Yes |');
    const built = run('Build the page', { html: '<p>x</p>' }, { 'Any checked findings?': done })[0];
    const page = run('Make the result page', built)[0].page as string;
    expect(page).toContain('Download research-report-');
  });
});
