/**
 * Example workflow 8 checks the links of a page and looks for replacements of the broken ones. Its logic is in Code nodes whose
 * source lives in the JSON file, and it reads text from web pages, so what the nodes do is pinned here by running their own code
 * on small cases: the request check, the link collection, the two reading steps, the sorting, the saved copy, the comparison, the
 * judging of search results and the report.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

interface ExampleNode {
  name: string;
  type: string;
  parameters: Record<string, unknown> & { jsCode?: string };
  credentials?: unknown;
}

const example = JSON.parse(readFileSync(join(__dirname, '../../../docs/examples/08-broken-links.json'), 'utf8')) as {
  nodes: ExampleNode[];
  settings: { executionTimeout?: number };
  connections: Record<string, { main: Array<Array<{ node: string; index: number }>> }>;
};

const sourceOf = (name: string): string => {
  const found = example.nodes.find((n) => n.name === name);
  if (!found || typeof found.parameters.jsCode !== 'string') throw new Error(`no Code node called ${name}`);
  return found.parameters.jsCode;
};

type Json = Record<string, any>;

/** Runs the Code node `name` on `input`, with `nodes` standing in for $('Node name'). Returns the json of each output item. */
const run = (name: string, input: Json[], nodes: Record<string, Json | Json[]> = {}): Json[] => {
  // An input item may carry `__paired`, the index of the item it answers, the way n8n marks the output of an HTTP Request node.
  const items = input.map((json) => {
    const { __paired, ...rest } = json;
    return __paired === undefined ? { json } : { json: rest, pairedItem: { item: __paired } };
  });
  const $input = { first: () => items[0], all: () => items, item: items[0] };
  const $ = (node: string) => {
    if (!(node in nodes)) throw new Error(`unknown node ${node}`);
    const value = nodes[node];
    const list = (Array.isArray(value) ? value : [value]).map((json) => ({ json }));
    return { first: () => list[0], all: () => list };
  };
  const out = new Function('$input', '$', sourceOf(name))($input, $) as Array<{ json: Json }>;
  return out.map((o) => o.json);
};

const page = (title: string) => `<html><head><title>${title}</title></head><body>x</body></html>`;

/** The first request of every link, as the two reading steps and the sorting node make of it. */
const firstRecords = (answers: Array<Json & { __url: string }>) =>
  run('Read the first answers', answers, {
    'Collect the links': answers.map((a, i) => ({ idx: i, url: a.__url, text: `t${i}` })),
  });
const sort = (records: Json[]) => run('Sort the answers', records);

describe('example 8: the workflow file', () => {
  it('holds no credential and connects every node that is not a note', () => {
    expect(example.nodes.some((n) => n.credentials)).toBe(false);
    const linked = new Set<string>();
    for (const [from, outputs] of Object.entries(example.connections)) {
      linked.add(from);
      for (const branch of outputs.main) for (const c of branch) linked.add(c.node);
    }
    for (const n of example.nodes) {
      if (n.type !== 'n8n-nodes-base.stickyNote') expect(linked.has(n.name)).toBe(true);
    }
  });

  it('sends the answers of both requests to the two inputs of the join', () => {
    const afterTest = example.connections['One more step?'].main;
    expect(afterTest[0].map((c) => c.node)).toEqual(['Check the next step']);
    expect(afterTest[1]).toEqual([{ node: 'Join the answers', type: 'main', index: 0 }]);
    expect(example.connections['Read the next answers'].main[0]).toEqual([{ node: 'Join the answers', type: 'main', index: 1 }]);
  });

  it('keeps the sticky notes within the rules for templates in n8n’s library', () => {
    const words = (text: string) => text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
    const notes = example.nodes.filter((n) => n.type === 'n8n-nodes-base.stickyNote') as Array<
      ExampleNode & { parameters: { content: string; color: number } }
    >;
    const overview = notes.filter((n) => n.parameters.color === 1);
    expect(overview).toHaveLength(1);
    expect(overview[0].parameters.content).toContain('### How it works');
    expect(overview[0].parameters.content).toContain('### Setup');
    expect(words(overview[0].parameters.content)).toBeGreaterThanOrEqual(100);
    expect(words(overview[0].parameters.content)).toBeLessThanOrEqual(300);
    for (const note of notes.filter((n) => n.parameters.color !== 1)) expect(words(note.parameters.content)).toBeLessThan(50);
  });

  it('bounds the run, and asks the archive for the exact address only', () => {
    expect(example.settings.executionTimeout).toBeGreaterThan(0);
    const cdx = example.nodes.find((n) => n.name === 'Find a saved copy')!;
    expect(JSON.stringify(cdx.parameters)).toContain('"matchType"');
  });

  it('asks every link without following redirects', () => {
    for (const name of ['Check each link', 'Check the next step', 'Follow the redirect']) {
      const node = example.nodes.find((n) => n.name === name)!;
      expect(JSON.stringify(node.parameters)).toContain('"followRedirects":false');
    }
  });
});

describe('example 8: the request', () => {
  const request = (form: Json) => run('Check the request', [form])[0];

  it('accepts a public page and caps the number of links', () => {
    expect(request({ address: 'https://example.com/blog/post' })).toEqual({
      ok: true,
      url: 'https://example.com/blog/post',
      max: 30,
    });
    expect(request({ address: 'example.com/blog' }).url).toBe('https://example.com/blog');
    expect(request({ address: 'https://example.com', links: 500 }).max).toBe(50);
    expect(request({ address: 'https://example.com', links: 0 }).max).toBe(30);
  });

  it('accepts a usual web port and a name in other scripts', () => {
    expect(request({ address: 'https://example.com:8443/x' }).ok).toBe(true);
    expect(request({ address: 'https://bücher.de/katalog' }).ok).toBe(true);
    expect(request({ address: 'https://xn--bcher-kva.de/' }).ok).toBe(true);
    expect(request({ address: 'https://example.com./docs' }).ok).toBe(true);
    expect(request({ address: 'https://my_site.example.com/' }).ok).toBe(true);
    expect(request({ address: 'https://مثال.ایران/' }).ok).toBe(true);
  });

  it.each([
    '',
    'ftp://example.com',
    'http://localhost/admin',
    'http://127.0.0.1/',
    'http://192.168.1.1/',
    'http://[::1]/',
    'http://intranet/',
    'http://printer.local/',
    'https://metadata.internal/x',
    'http://169.254.169.254/latest',
    'http://2130706433/',
    'https://exa mple.com',
    'javascript:alert(1)',
    'http://127.0.0.1\\@example.com/',
    'https://example.com\\.evil.example/',
    'http://127.0.0.0x1/',
    'http://127.0.0.1%2e/',
    'http://0x7f.0x1/',
    'http://127.1/',
    'https://example.com:22/',
    'https://printer.svc/',
    'https://service.localdomain/',
    'http://a.ｌｏｃａｌｈｏｓｔ/',
    'http://printer.ｌｏｃａｌ/',
    'http://１２７.０.０.１/',
  ])('refuses %j', (address) => {
    expect(request({ address }).ok).toBe(false);
  });
});

describe('example 8: collecting the links', () => {
  const html = `<html><body>
<a href="/about">About us</a> <a href='https://other.example/page?id=1&amp;x=2#frag'>Other <b>site</b></a>
<a href="docs/guide.html">Guide</a> <a href="../up.html">Up</a> <a href="//cdn.example.net/lib">Protocol relative</a>
<a href="mailto:a@b.c">mail</a> <a href="javascript:void(0)">js</a> <a href="#top">top</a> <a href="tel:123">tel</a>
<a href="https://www.facebook.com/x">fb</a> <a href="http://localhost/x">local</a> <a href="https://other.example/page?id=1&x=2">dup</a>
<a class="x" HREF=unquoted.html>unquoted</a> <a name="anchor">no href</a> <a href="https://example.com/blog/post">self</a>
<a href="/cdn-cgi/l/email-protection#abc">protected mail</a> <a href="http://127.0.0.1\\@evil.example/x">backslash</a> <a href="http://exa&#9;mple.org/t">tab</a> <a href="https://web.archive.org/web/2020/x">archive</a> <a href="https://example.org/a b">space</a>
</body></html>`;
  const collect = (response: Json, max = 30) =>
    run('Collect the links', [response], {
      'Check the request': { url: 'https://example.com/blog/post', max },
    });

  it('resolves, cleans and de-duplicates the links of the page', () => {
    const links = collect({ statusCode: 200, data: html });
    expect(links.map((l) => l.url)).toEqual([
      'https://example.com/about',
      'https://other.example/page?id=1&x=2',
      'https://example.com/blog/docs/guide.html',
      'https://example.com/up.html',
      'https://cdn.example.net/lib',
      'https://example.com/blog/unquoted.html',
      'https://example.org/a%20b',
    ]);
    expect(links[1].text).toBe('Other site');
    expect(links[0]).toMatchObject({ found: 7, skippedPrivate: 1, skippedSocial: 2 });
  });

  it('leaves out what is not a link of the page: comments, scripts, templates and unusual ports', () => {
    const tricky = `<body>
<!-- <a href="/commented-out">old</a> -->
<script>var html = '<a href="' + item.url + '">x</a>'; var b = "<a href='/in-script'>s</a>";</script>
<template><a href="{{ link.href }}">t</a></template>
<style>a[href="/in-style"] { color: red }</style>
<a href="https://example.org:22/ssh">port</a> <a href="https://ok.example/real" title="a>b">real</a>
<A HREF="https://UPPER.example/Page">Upper</A> <a href="https://upper.example/Page/">dup</a> <a href="https://upper.example/page">other case</a>
</body>`;
    const urls = collect({ statusCode: 200, data: tricky }).map((l) => l.url);
    expect(urls).toEqual(['https://ok.example/real', 'https://UPPER.example/Page', 'https://upper.example/page']);
  });

  it('does not lose the links after a "<script" that sits in an attribute and is never closed', () => {
    const urls = collect({
      statusCode: 200,
      data: '<a href="/one" title="use the <script> tag">one</a> <a href="/two">two</a> <scripts-element></scripts-element> <a href="/three">three</a>',
    }).map((l) => l.url);
    expect(urls).toEqual(['https://example.com/one', 'https://example.com/two', 'https://example.com/three']);
  });

  it('finds the tags of a page that has a letter whose lower case is longer, and in capitals', () => {
    const urls = collect({
      statusCode: 200,
      data: '<p>İstanbul</p><SCRIPT>var x = "<a href=\'/from-script\'>s</a>";</SCRIPT><A HREF="/real">real</A>',
    }).map((l) => l.url);
    expect(urls).toEqual(['https://example.com/real']);
  });

  it('reads a <base> tag whatever form its address has', () => {
    for (const [tag, expected] of [
      ['<base href="/docs/">', 'https://example.com/docs/intro.html'],
      ['<base href=/docs/>', 'https://example.com/docs/intro.html'],
      ['<base href="//cdn.example.net/x/">', 'https://cdn.example.net/x/intro.html'],
      ['<base href="https://other.example/a/">', 'https://other.example/a/intro.html'],
    ]) {
      expect(collect({ statusCode: 200, data: `${tag}<a href="intro.html">i</a>` })[0].url).toBe(expected);
    }
  });

  it('resolves relative links against a <base> tag when there is one', () => {
    const links = collect({
      statusCode: 200,
      data: '<base href="https://example.com/docs/"><a href="intro.html">i</a><a href="/top">t</a>',
    });
    expect(links.map((l) => l.url)).toEqual(['https://example.com/docs/intro.html', 'https://example.com/top']);
  });

  it('reads character references of any kind in the text of a link', () => {
    const [link] = collect({ statusCode: 200, data: '<a href="https://a.example/x">It&#39;s &#x27;quoted&#x27; &amp;lt; &#128512;</a>' });
    expect(link.text).toBe("It's 'quoted' &lt; \u{1F600}");
  });

  it('does not take long on a page made to be slow', () => {
    const started = Date.now();
    collect({ statusCode: 200, data: '<a href="/x">' + '<'.repeat(200000) + '</a>' + '<!--'.repeat(20000) + '<script '.repeat(20000) });
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it('keeps at most the number asked for', () => {
    expect(collect({ statusCode: 200, data: html }, 3)).toHaveLength(3);
  });

  it.each([
    [{ statusCode: 404, data: 'x' }],
    [{ error: { message: 'getaddrinfo ENOTFOUND' } }],
    [{ statusCode: 200, data: '<p>no links</p>' }],
    [{ statusCode: 200, data: '' }],
  ])('says there is nothing to check for %j', (response) => {
    expect(collect(response as Json)[0].ok).toBe(false);
  });
});

describe('example 8: reading and sorting the answers', () => {
  it('pairs an answer with its link by the item n8n marks, not by position', () => {
    const records = run(
      'Read the first answers',
      [
        { __paired: 1, statusCode: 404, data: '' },
        { __paired: 0, statusCode: 200, data: page('Fine') },
      ],
      {
        'Collect the links': [
          { idx: 0, url: 'https://a.example/zero', text: 'zero' },
          { idx: 1, url: 'https://a.example/one', text: 'one' },
        ],
      },
    );
    expect(records.map((r) => [r.idx, r.url, r.status])).toEqual([
      [1, 'https://a.example/one', 404],
      [0, 'https://a.example/zero', 200],
    ]);
  });

  it('puts each kind of answer where it belongs', () => {
    const rows = sort(
      firstRecords([
        { __url: 'https://a.example/ok', statusCode: 200, data: page('A page') },
        { __url: 'https://a.example/gone', statusCode: 404, data: 'nope' },
        { __url: 'https://a.example/gone2', statusCode: 410, data: '' },
        {
          __url: 'https://a.example/soft',
          statusCode: 200,
          data: page('Page not found - Example'),
        },
        { __url: 'https://a.example/wall', statusCode: 200, data: page('Just a moment...') },
        { __url: 'https://a.example/priv', statusCode: 403, data: '' },
        {
          __url: 'http://a.example/https',
          statusCode: 301,
          headers: { location: 'https://a.example/https' },
        },
        {
          __url: 'https://a.example/news/2010/article-about-things',
          statusCode: 301,
          headers: { location: 'https://a.example/' },
        },
        {
          __url: 'https://a.example/news/2010/article-about-things-2',
          statusCode: 301,
          headers: { location: '/archive/2010/article-about-things-2' },
        },
        {
          __url: 'https://nope.invalid/',
          error: { message: 'getaddrinfo ENOTFOUND nope.invalid', code: 'ENOTFOUND' },
        },
        {
          __url: 'https://slow.example/',
          error: { message: 'timeout of 12000ms exceeded', code: 'ECONNABORTED' },
        },
        {
          __url: 'https://cert.example/',
          error: { message: 'certificate has expired', code: 'CERT_HAS_EXPIRED' },
        },
        { __url: 'https://boom.example/', statusCode: 503, data: '' },
        { __url: 'https://a.example/redir-nolocation', statusCode: 301, headers: {} },
      ]),
    );
    expect(rows.map((r) => r.kind + (r.look ? '*' : ''))).toEqual([
      'ok',
      'dead*',
      'dead*',
      'dead*',
      'unknown',
      'unknown',
      'ok',
      'redirect*',
      'ok',
      'dead*',
      'unknown',
      'unknown',
      'unknown',
      'unknown',
    ]);
    expect(rows[3].detail).toMatch(/page says/);
    expect(rows[8].detail).toMatch(/^It has moved to https:\/\/a\.example\/archive/);
  });

  it.each([
    ['Page not found - Example', true],
    ['404 Not Found', true],
    ['Error 404 | Acme', true],
    ['Oops! This page isn’t available', true],
    ['Sorry, we couldn’t find that page', true],
    ['This page has been removed', true],
    ['The page you requested could not be found', true],
    ['Module not found: Error: Can’t resolve ‘fs’ - Stack Overflow', false],
    ['ORA-00942: table or view does not exist - Stack Overflow', false],
    ['How to fix "command not found" in bash', false],
    ['The 404 Page Design Handbook', false],
    ['Error handling in Go', false],
    ['A history of the HTTP status codes', false],
    ['404 Media', false],
    ['404 Pages: 10 Best Examples', false],
    ['Page Not Found Errors: How to Fix Them', false],
    ['Not found errors in Rails', false],
    ['Page Not Found Plugin for WordPress', false],
    ['The Page Not Found Podcast', false],
    ['Error: can’t find module - Stack Overflow', false],
    ['410 Sports', false],
    ['Oops! That page can’t be found. - My Company Name', true],
    ['Sorry, page not found | The Very Long Site Name', true],
    ['Sorry, this page does not exist | The Acme Corporation Online Store', true],
    ['The page you are looking for doesn’t exist', true],
    ['404: This page could not be found.', true],
    ['Page Unavailable', true],
    ['Seite nicht gefunden', true],
    ['صفحه یافت نشد', true],
  ])('judges the title %j (broken: %s)', (title, broken) => {
    const row = sort(firstRecords([{ __url: 'https://a.example/t', statusCode: 200, data: page(title) }]))[0];
    expect(row.kind).toBe(broken ? 'dead' : 'ok');
  });

  it('reads a title written in capitals', () => {
    const row = sort(
      firstRecords([{ __url: 'https://a.example/t', statusCode: 200, data: '<HTML><HEAD><TITLE>Page Not Found</TITLE></HEAD></HTML>' }]),
    )[0];
    expect(row.kind).toBe('dead');
  });

  it('calls a redirect that leads back to itself broken, but not one that only adds a closing slash', () => {
    const loops = sort(
      firstRecords([
        { __url: 'https://b.example/y', statusCode: 301, headers: { location: 'https://b.example/y' } },
        { __url: 'https://c.example/z', statusCode: 301, headers: { location: '/z/' } },
      ]),
    );
    expect(loops[0]).toMatchObject({ kind: 'dead', look: true });
    expect(loops[0].detail).toMatch(/circle/);
    expect(loops[1].kind).toBe('ok');
    const records = firstRecords([{ __url: 'http://a.example/x', statusCode: 301, headers: { location: 'https://a.example/x' } }]);
    const back = sort(
      run('Read the next answers', [{ statusCode: 301, headers: { location: 'http://a.example/x' } }], { 'One more step?': records }),
    )[0];
    expect(back).toMatchObject({ kind: 'dead', idx: 0 });
  });

  it('does not call a name that could not be looked up just now a name that does not exist', () => {
    const rows = sort(
      firstRecords([
        { __url: 'https://gone.example/', error: { message: 'getaddrinfo ENOTFOUND gone.example', code: 'ENOTFOUND' } },
        { __url: 'https://busy.example/', error: { message: 'getaddrinfo EAI_AGAIN busy.example', code: 'EAI_AGAIN' } },
      ]),
    );
    expect(rows.map((r) => r.kind)).toEqual(['dead', 'unknown']);
  });

  it('puts the answers back in the order of the page before it picks the links to look into', () => {
    const records = firstRecords([
      { __url: 'https://a.example/0', statusCode: 404 },
      { __url: 'https://a.example/1', statusCode: 404 },
    ]);
    const rows = sort([records[1], records[0]]);
    expect(rows.map((r) => r.idx)).toEqual([0, 1]);
  });

  it('counts a partial answer, and a refused range on an empty page, as a page that is there', () => {
    const rows = sort(
      firstRecords([
        { __url: 'https://a.example/part', statusCode: 206, data: page('A page') },
        { __url: 'https://a.example/empty', statusCode: 416, data: '' },
      ]),
    );
    expect(rows.map((r) => r.kind)).toEqual(['ok', 'ok']);
  });

  it('gives a closer look to at most 12 links, the broken ones first', () => {
    const answers: Array<Json & { __url: string }> = [];
    for (let i = 0; i < 10; i += 1) answers.push({ __url: `https://d.example/dead${i}`, statusCode: 404 });
    for (let i = 0; i < 6; i += 1)
      answers.push({
        __url: `https://r.example/some/page-number-${i}`,
        statusCode: 301,
        headers: { location: 'https://r.example/' },
      });
    const rows = sort(firstRecords(answers));
    expect(rows.filter((r) => r.look)).toHaveLength(12);
    expect(rows.filter((r) => r.kind === 'dead' && r.look)).toHaveLength(10);
    expect(rows.filter((r) => r.kind === 'redirect' && r.look)).toHaveLength(2);
    expect(rows[rows.length - 1].detail).toMatch(/Not looked into/);
  });

  describe('a redirect that only changes the address', () => {
    const first = firstRecords([
      {
        __url: 'http://a.example/gone',
        statusCode: 301,
        headers: { location: 'https://a.example/gone' },
      },
      { __url: 'http://www.a.example/dir', statusCode: 301, headers: { location: '/dir/' } },
      {
        __url: 'http://a.example/moved',
        statusCode: 301,
        headers: { location: 'https://a.example/new-place' },
      },
      { __url: 'http://a.example/fine', statusCode: 200, data: page('Fine') },
    ]);
    const second = (answer: Json, which: number) => sort(run('Read the next answers', [answer], { 'One more step?': [first[which]] }))[0];

    it('gets a second request only when the new address is the old one in other clothes', () => {
      expect(first.map((r) => r.next)).toEqual(['https://a.example/gone', 'http://www.a.example/dir/', '', '']);
    });

    it('is judged by the answer to the second request', () => {
      expect(second({ statusCode: 404, data: 'x' }, 0)).toMatchObject({
        kind: 'dead',
        url: 'http://a.example/gone',
        idx: 0,
      });
      expect(second({ statusCode: 200, data: page('Fine') }, 1).kind).toBe('ok');
      expect(second({ statusCode: 301, headers: { location: 'https://a.example/' } }, 0)).toMatchObject({ kind: 'redirect', look: true });
      expect(second({ error: { message: 'getaddrinfo ENOTFOUND a.example', code: 'ENOTFOUND' } }, 0).kind).toBe('dead');
    });

    it('is not asked a third time', () => {
      expect(second({ statusCode: 301, headers: { location: 'https://www.a.example/gone/' } }, 0).kind).toBe('ok');
    });
  });

  it('does not follow a redirect to a private address', () => {
    const row = sort(
      firstRecords([
        {
          __url: 'http://a.example/p',
          statusCode: 302,
          headers: { location: 'http://127.0.0.1/admin' },
        },
      ]),
    )[0];
    expect(row).toMatchObject({ kind: 'unknown', look: false, target: '' });
    expect(row.detail).toMatch(/private/);
  });

  it('reads where a redirect goes when the address has no path, or dots in it', () => {
    const where = (from: string, location: string) => firstRecords([{ __url: from, statusCode: 302, headers: { location } }])[0].target;
    expect(where('https://example.com?ref=blog', '/en/')).toBe('https://example.com/en/');
    expect(where('https://example.com/a/b/c', './d')).toBe('https://example.com/a/b/d');
    expect(where('https://example.com/a/b/c', '../x')).toBe('https://example.com/a/x');
    expect(where('https://example.com/a/b/c?x=1', '?y=2')).toBe('https://example.com/a/b/c?y=2');
    expect(where('https://example.com/a/b/c', '/a/b/./c')).toBe('https://example.com/a/b/c');
    expect(firstRecords([{ __url: 'https://example.com/a/b/c', statusCode: 302, headers: { location: './c' } }])[0].loop).toBe(true);
  });

  it('judges a redirect by the path of its target, not by a query that repeats the name of the page', () => {
    const row = sort(
      firstRecords([
        { __url: 'http://a.example/post/old-slug', statusCode: 302, headers: { location: 'https://a.example/login?next=/post/old-slug' } },
      ]),
    )[0];
    expect(row.kind).toBe('redirect');
  });

  it('does not follow a redirect whose address hides a host behind a backslash', () => {
    const row = sort(
      firstRecords([{ __url: 'http://a.example/p', statusCode: 302, headers: { location: 'http://127.0.0.1\\@evil.example/x' } }]),
    )[0];
    expect(row).toMatchObject({ kind: 'unknown', look: false, target: '' });
  });
});

describe('example 8: the saved copy and the name of the old page', () => {
  const link = {
    idx: 3,
    url: 'http://www.apple.com/macosx/server/',
    text: 'OS X Server',
    kind: 'dead',
    detail: 'HTTP 404',
    look: true,
  };
  const pick = (answer: Json) => run('Pick the saved copy', [answer], { 'Loop over the links': link })[0];

  it('builds the address of the newest copy and of its replay', () => {
    const hit = pick({
      data: '[["timestamp","original"],["20120608172404","http://www.apple.com/macosx/server/"]]',
    });
    expect(hit).toMatchObject({
      idx: 3,
      copyUrl: 'https://web.archive.org/web/20120608172404id_/http://www.apple.com/macosx/server/',
      replayUrl: 'https://web.archive.org/web/20120608172404/http://www.apple.com/macosx/server/',
      copyDate: '2012-06-08',
    });
  });

  it.each([
    [{ data: '[["timestamp","original"]]' }],
    [{ data: '[]' }],
    [{ data: '' }],
    [{ data: '<html>Too many requests</html>' }],
    [{ error: { message: 'x' } }],
    [{ data: '[["a","b"],["notastamp","javascript:alert(1)"]]' }],
  ])('finds no copy in %j', (answer) => {
    expect(pick(answer as Json).copyUrl).toBe('');
  });

  it('tells an index that has no copy from an index that did not answer', () => {
    expect(pick({ data: '[]' }).copyFailed).toBe(false);
    expect(pick({ data: '[["timestamp","original"]]' }).copyFailed).toBe(false);
    expect(pick({ error: { message: 'timeout of 20000ms exceeded' } }).copyFailed).toBe(true);
    expect(pick({ data: '<html>Too many requests</html>' }).copyFailed).toBe(true);
    expect(pick({ data: '' }).copyFailed).toBe(true);
  });

  const name = (rec: Json, html: string) =>
    run('Name the old page', [{ data: html }], {
      'Pick the saved copy': { copyUrl: 'https://web.archive.org/x', detail: '', text: '', ...rec },
    })[0];

  it('takes the title without the name of the site', () => {
    const r = name(
      { kind: 'dead', url: 'http://a.example/x', text: 'An open letter to Kevin Rose' },
      '<title>An open letter to Kevin Rose - Alexis Ohanian dot com</title><h1>Alexis Ohanian dot com</h1>',
    );
    expect(r.phrase).toBe('An open letter to Kevin Rose');
    const z = name(
      { kind: 'dead', url: 'http://a.example/x', text: 'click here' },
      '<title>Zune HD available for pre-order today | Zune.net</title>',
    );
    expect(z).toMatchObject({ phrase: 'Zune HD available for pre-order today', search: true });
  });

  it('does not let the text of the link choose the name of the site over the name of the page', () => {
    const r = name(
      { kind: 'dead', url: 'http://a.example/x', text: 'A cnet page' },
      "<title>Microsoft drops 'Series' from Windows Phone 7 - CNET</title>",
    );
    expect(r).toMatchObject({
      phrase: "Microsoft drops 'Series' from Windows Phone 7",
      phraseOk: true,
      search: true,
    });
  });

  it.each([
    '<title>Home</title>',
    '<title>Please wait while your request is being verified...</title>',
    '<title>Zune.net | Zune 80GB (Black)</title>',
  ])('does not search for the general title %s', (html) => {
    const r = name({ kind: 'dead', url: 'http://a.example/x', text: '' }, html);
    expect(r).toMatchObject({ phraseOk: false, search: false });
  });

  it('does not take long on a title made of thousands of parts', () => {
    const started = Date.now();
    const parts = Array.from({ length: 20000 }, (_, i) => `part${i}`).join(' | ');
    name({ kind: 'dead', url: 'http://a.example/x', text: '' }, `<title>${parts}</title><h1>${parts}</h1>`);
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it('cuts a long title between words, so that the whole-word match of the judge still holds', () => {
    const long =
      'The long and winding road to understanding the implications of artificial general intelligence for the future of work and society';
    const r = name({ kind: 'dead', url: 'http://a.example/x', text: '' }, `<title>${long}</title>`);
    expect(r.phrase.length).toBeLessThanOrEqual(110);
    expect(long.startsWith(r.phrase)).toBe(true);
    expect(long.charAt(r.phrase.length)).toBe(' ');
  });

  it.each([
    'Oops! That page can’t be found on this server',
    'Welcome to nginx! The web server is running',
    'Buy this domain name at a great price',
    'Future home of something quite cool',
    'Our website has moved to a new address',
    'Sorry, this page is unavailable right now',
  ])('does not search for %j, which names no page', (title) => {
    const r = name({ kind: 'dead', url: 'http://a.example/x', text: '' }, `<title>${title}</title>`);
    expect(r).toMatchObject({ phraseOk: false, search: false, wallTitle: true });
  });

  it('does not take long on a saved copy or a target page made to be slow', () => {
    const started = Date.now();
    const hostile = '<title>' + '<'.repeat(80000) + '</title>' + '<meta '.repeat(66000);
    name({ kind: 'dead', url: 'http://a.example/x', text: '' }, hostile);
    run('Compare the pages', [{ statusCode: 200, data: hostile }], {
      'Name the old page': {
        idx: 1,
        url: 'http://a.example/old/page',
        kind: 'redirect',
        target: 'https://a.example/new/page',
        oldTitle: 'An old page',
        phrase: '',
        phraseOk: false,
      },
    });
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it('reads a title written in capitals and with character references of any kind', () => {
    const r = name(
      { kind: 'dead', url: 'http://a.example/x', text: '' },
      '<TITLE>Tom&#x27;s guide to the cats and mice &amp; more</TITLE>',
    );
    expect(r).toMatchObject({ phrase: "Tom's guide to the cats and mice & more", search: true });
  });

  it('puts no quotation mark into the phrase that is searched for', () => {
    const r = name(
      { kind: 'dead', url: 'http://a.example/x', text: '' },
      '<title>The "Best" Way to Start x" site:evil.example "y a Garden</title>',
    );
    expect(r.phrase).not.toMatch(/["“”]/);
    expect(r.phrase).toContain('Best');
  });

  it('does not search for what the archive kept after the site was gone', () => {
    for (const title of [
      'This domain is for sale on the market',
      'This Account has been suspended for now',
      'Apache2 Ubuntu Default Page: It works',
      'Renew now at the registrar of names',
    ]) {
      expect(name({ kind: 'dead', url: 'http://a.example/x', text: '' }, `<title>${title}</title>`)).toMatchObject({
        phraseOk: false,
        search: false,
      });
    }
  });

  it('searches for a title in another script', () => {
    const r = name({ kind: 'dead', url: 'http://a.example/x', text: '' }, '<title>راهنمای کامل نصب و راه‌اندازی داکر | سایت</title>');
    expect(r).toMatchObject({ phraseOk: true, search: true });
    expect(r.phrase).toBe('راهنمای کامل نصب و راه‌اندازی داکر');
  });

  it('says that a saved copy could not be read, instead of calling the title too general', () => {
    const rec = { kind: 'dead', url: 'http://a.example/x', text: '', copyUrl: 'https://web.archive.org/x', detail: 'HTTP 404' };
    const dead = run('Name the old page', [{ error: { message: 'timeout of 20000ms exceeded' } }], { 'Pick the saved copy': rec })[0];
    expect(dead).toMatchObject({ phraseOk: false, search: false });
    expect(dead.searchNote).toMatch(/could not be read/);
    const moved = run('Name the old page', [{ error: { message: 'timeout' } }], { 'Pick the saved copy': { ...rec, kind: 'redirect' } })[0];
    expect(moved.kind).toBe('redirect-unverified');
    expect(moved.detail).toMatch(/could not be read just now/);
  });

  it('cannot compare a redirect that has no saved copy', () => {
    const r = run('Name the old page', [{}], {
      'Pick the saved copy': {
        kind: 'redirect',
        url: 'http://a.example/x',
        text: '',
        copyUrl: '',
        detail: 'It redirects to https://a.example/',
      },
    })[0];
    expect(r.kind).toBe('redirect-unverified');
    expect(r.detail).toMatch(/check it by hand/);
  });
});

describe('example 8: comparing a redirect', () => {
  const base = {
    idx: 1,
    url: 'http://a.example/old/page',
    kind: 'redirect',
    target: 'https://a.example/',
    oldTitle: 'The history of the example protocol - Site',
    phrase: 'The history of the example protocol',
    phraseOk: true,
    search: false,
    detail: '',
  };
  const compare = (answer: Json) => run('Compare the pages', [answer], { 'Name the old page': base })[0];

  it('calls a redirect to a page with another title a page that is no longer there', () => {
    expect(compare({ statusCode: 200, data: '<title>Welcome to Site</title><h1>Welcome</h1>' })).toMatchObject({
      kind: 'leads-elsewhere',
      search: true,
    });
  });

  it('calls a redirect to a page with the same title a move', () => {
    const moved = run('Compare the pages', [{ statusCode: 200, data: '<title>The history of the example protocol | Site</title>' }], {
      'Name the old page': { ...base, target: 'https://a.example/new/page' },
    })[0];
    expect(moved).toMatchObject({ kind: 'moved', search: false });
  });

  it('does not take the name of the site for the name of the page, and a redirect to a front page loses the page', () => {
    const acme = { ...base, url: 'http://acme-widgets.example/pricing', oldTitle: 'Pricing - Acme Widgets Corporation', phraseOk: false };
    const home = (target: string) =>
      run('Compare the pages', [{ statusCode: 200, data: '<title>Acme Widgets Corporation | Home</title>' }], {
        'Name the old page': { ...acme, target },
      })[0];
    expect(home('https://acme-widgets.example/').kind).toBe('leads-elsewhere');
    // The words of the host are not counted either: "Acme Widgets" is the site, "Pricing" is the page.
    const pricing = { ...acme, oldTitle: 'Pricing - Acme Widgets', target: 'https://acme-widgets.example/start' };
    expect(
      run('Compare the pages', [{ statusCode: 200, data: '<title>Acme Widgets | Start</title>' }], { 'Name the old page': pricing })[0]
        .kind,
    ).toBe('leads-elsewhere');
  });

  it('treats a redirect to a front page as a lost page even when the front page redirects again, is walled or has no title', () => {
    for (const answer of [
      { statusCode: 301, headers: { location: 'https://a.example/en/' }, data: '' },
      { statusCode: 200, data: '<title>Just a moment...</title>' },
      { statusCode: 200, data: '%PDF-1.4 binary' },
    ]) {
      expect(compare(answer)).toMatchObject({ kind: 'leads-elsewhere', search: true });
    }
  });

  it('does not compare a title that has no long words, or an old page that was an error or parking page', () => {
    const deep = (over: Json) => ({ ...base, target: 'https://a.example/new/page', ...over });
    const run1 = (rec: Json, data: string) => run('Compare the pages', [{ statusCode: 200, data }], { 'Name the old page': rec })[0];
    expect(run1(deep({ oldTitle: 'How to use it' }), '<title>How to use it</title>')).toMatchObject({ kind: 'redirect-unverified' });
    expect(run1(deep({ wallTitle: true, oldTitle: 'Just a moment...' }), '<title>Welcome to the new site</title>')).toMatchObject({
      kind: 'redirect-unverified',
    });
  });

  it('does not judge a second redirect, a robot check or a page without a title', () => {
    const deep = { ...base, target: 'https://a.example/new/page' };
    const compare = (answer: Json) => run('Compare the pages', [answer], { 'Name the old page': deep })[0];
    expect(compare({ statusCode: 301, headers: { location: 'https://a.example/x' }, data: '' })).toMatchObject({
      kind: 'redirect-unverified',
      search: false,
    });
    expect(compare({ statusCode: 200, data: '<title>Just a moment...</title>' })).toMatchObject({ kind: 'redirect-unverified' });
    expect(compare({ statusCode: 200, data: '%PDF-1.4 binary' })).toMatchObject({ kind: 'redirect-unverified' });
  });

  it('calls a redirect to a missing page broken', () => {
    expect(compare({ statusCode: 404, data: 'gone' })).toMatchObject({
      kind: 'dead',
      search: true,
    });
    expect(compare({ statusCode: 410, data: '' }).kind).toBe('dead');
    expect(compare({ error: { message: 'getaddrinfo ENOTFOUND x', code: 'ENOTFOUND' } }).kind).toBe('dead');
  });

  it('does not call a refusal, a server error or a timeout broken', () => {
    for (const answer of [
      { statusCode: 403, data: 'no' },
      { statusCode: 503, data: '' },
      { statusCode: 429, data: '' },
      { error: { message: 'timeout of 12000ms exceeded', code: 'ECONNABORTED' } },
    ]) {
      expect(compare(answer)).toMatchObject({ kind: 'redirect-unverified', search: false });
    }
  });
});

describe('example 8: judging the search results', () => {
  const rec = {
    idx: 1,
    url: 'http://www.zune.net/en-us/press/2009/0813-zunehdpreorder.htm',
    text: 'Zune HD',
    kind: 'dead',
    phrase: 'Zune HD available for pre-order today',
    phraseOk: true,
    search: true,
  };
  const judge = (results: Json[], over: Json = {}) =>
    run('Judge the candidates', results, {
      'Worth a search?': { ...rec, ...over },
      'Collect the links': { page: 'https://blog.example/post' },
    })[0];

  it('offers a result whose own title contains the old title, and keeps a mention apart', () => {
    const j = judge([
      {
        title: 'Zune HD available for pre-order today | Microsoft News',
        url: 'https://news.microsoft.com/source/2009/08/13/zune-hd-available-for-pre-order-today/',
        pageContent: '...',
      },
      {
        title: 'Zune HD preorders',
        url: 'https://example.net/a',
        pageContent: 'Zune HD available for pre-order today, says a list',
      },
    ]);
    expect(j.replacement).toMatchObject({ verdict: 'verified', relation: 'another site' });
    expect(j.mentions).toHaveLength(1);
  });

  it('prefers a page on the same site, and calls a near match on the same site "likely"', () => {
    const same = judge([
      {
        title: 'Zune HD available for pre-order today',
        url: 'https://copy.example/zune',
        pageContent: '',
      },
      {
        title: 'Zune HD available for pre-order today - Zune.net',
        url: 'https://www.zune.net/press/zunehd',
        pageContent: '',
      },
    ]);
    expect(same.replacement).toMatchObject({
      url: 'https://www.zune.net/press/zunehd',
      relation: 'same site',
    });
    const likely = judge([
      {
        title: 'Zune HD pre-order available today',
        url: 'https://www.zune.net/press/x',
        pageContent: '',
      },
    ]);
    expect(likely.replacement).toMatchObject({ verdict: 'likely' });
  });

  it('never offers a front page, the old address, the page being checked, an archive or a page that only mentions the title', () => {
    const j = judge([
      {
        title: 'Zune HD available for pre-order today',
        url: 'https://news.example/',
        pageContent: '',
      },
      {
        title: 'Zune HD available for pre-order today',
        url: 'http://zune.net/en-us/press/2009/0813-zunehdpreorder.htm',
        pageContent: '',
      },
      {
        title: 'Zune HD available for pre-order today',
        url: 'https://blog.example/post',
        pageContent: '',
      },
      {
        title: 'Zune HD available for pre-order today',
        url: 'https://web.archive.org/web/2009/http://x',
        pageContent: '',
      },
      {
        title: 'A list of news',
        url: 'https://list.example/news',
        pageContent: 'see: Zune HD available for pre-order today',
      },
    ]);
    expect(j.replacement).toBeNull();
    expect(j.mentions).toHaveLength(1);
    expect(j.searchNote).toMatch(/mention the title/);
  });

  it('does not take the name of a site for the name of a page', () => {
    const j = judge(
      [
        {
          title: 'Windows Phone 7 awards winners announced for the year - Industrial Designers Society of America',
          url: 'https://www.idsa.org/news/x',
          pageContent: '',
        },
      ],
      { phrase: 'Industrial Designers Society of America' },
    );
    expect(j.replacement).toBeNull();
  });

  it('treats a query as a page: a link such as blog.example/?p=73 is not replaced by a front page', () => {
    const results = [
      {
        title: 'DailyBuzz - What the Internet Is Talking About Right Now',
        url: 'https://dailybuzz.example/',
        pageContent: '',
      },
    ];
    const phrase = 'What the Internet is talking about right now';
    expect(judge(results, { url: 'http://blog.example/?p=73', phrase }).replacement).toBeNull();
    expect(judge(results, { url: 'http://blog.example/', phrase }).replacement).not.toBeNull();
  });

  it('matches whole words, and does not take two blogs on one host for one site', () => {
    const protocols = judge([{ title: 'History of the example protocols', url: 'https://other.example/a/b', pageContent: '' }], {
      phrase: 'History of the example protocol',
    });
    expect(protocols.replacement).toBeNull();
    const blogs = judge(
      [{ title: 'Zune HD available for pre-order today - my blog', url: 'https://bob.blogspot.com/2009/zune', pageContent: '' }],
      { url: 'http://alice.blogspot.com/2009/zune.html' },
    );
    expect(blogs.replacement).toMatchObject({ verdict: 'verified', relation: 'another site' });
  });

  it('does not call a same-site page "likely" on a few words, and does not offer a page that did not load', () => {
    const few = judge([{ title: 'World Cup 2022 results', url: 'https://www.zune.net/news/cup', pageContent: '' }], {
      phrase: 'The end of the world',
    });
    expect(few.replacement).toBeNull();
    const broken = judge([
      { title: 'Zune HD available for pre-order today', url: 'https://copy.example/zune', pageContent: '', pageContentError: 'HTTP 404' },
    ]);
    expect(broken.replacement).toBeNull();
  });

  it('says so when the search gave nothing or was refused', () => {
    expect(judge([{}]).searchNote).toMatch(/no pages/);
    expect(
      judge([
        {
          success: false,
          error: 'DuckDuckGo served a bot-detection challenge moments ago, so this request was not sent.',
        },
      ]).searchNote,
    ).toMatch(/did not answer/);
  });
});

describe('example 8: the report and the notice', () => {
  const meta = {
    page: 'https://blog.example/post',
    found: 40,
    checked: 30,
    skippedPrivate: 1,
    skippedSocial: 2,
  };
  const items = [
    { idx: 0, kind: 'ok', url: 'https://ok.example/', text: 'fine', detail: '' },
    {
      idx: 1,
      kind: 'dead',
      url: 'http://www.zune.net/en-us/press/2009/0813-zunehdpreorder.htm',
      text: 'Zune <script>alert(1)</script>',
      detail: 'HTTP 404 (not found)',
      look: true,
      oldTitle: 'Zune HD available for pre-order today | Zune.net',
      phraseOk: true,
      copyUrl: 'https://web.archive.org/web/2009id_/x',
      replayUrl: 'https://web.archive.org/web/2009/http://x',
      copyDate: '2009-08-13',
      replacement: {
        url: 'https://news.microsoft.com/a',
        title: 'Zune HD <b>available</b>',
        verdict: 'verified',
        relation: 'another site',
      },
    },
    {
      idx: 2,
      kind: 'leads-elsewhere',
      url: 'https://old.example/a',
      text: 'Old',
      detail: 'It redirects to https://old.example/, a page called "Welcome".',
      oldTitle: 'The old page',
      copyUrl: 'x',
      replayUrl: 'https://web.archive.org/web/2012/https://old.example/a',
      copyDate: '2012-01-01',
      phraseOk: false,
    },
    {
      idx: 3,
      kind: 'unknown',
      url: 'https://slow.example/',
      text: 'Slow',
      detail: 'No answer within 12 seconds.',
    },
    { idx: 4, kind: 'moved', url: 'https://m.example/', text: 'Moved', detail: '' },
    { idx: 5, kind: 'dead', url: 'javascript:alert(1)', text: 'bad', detail: 'x', look: true, phraseOk: false },
  ];
  const report = (list: Json[]) => run('Build the report', list, { 'Collect the links': meta })[0];

  it('counts the links by kind and shows what is known about each problem', () => {
    const r = report(items);
    expect(r.html).toContain('<strong>2</strong> work');
    expect(r.html).toContain('<strong>2</strong> broken');
    expect(r.html).toContain('Saved 2009-08-13');
    expect(r.html).toContain('On another site, with the same title. It may be a copy of the page or a page about it.');
    expect(r.html).toContain('The page has 40 links');
    expect(r.fixes).toBe(1);
  });

  it('says that the archive did not answer, instead of saying that there is no copy', () => {
    const r = report([
      {
        idx: 0,
        kind: 'dead',
        url: 'https://gone.example/a',
        text: 'A',
        detail: 'HTTP 404 (not found)',
        look: true,
        copyUrl: '',
        copyFailed: true,
        phraseOk: false,
      },
    ]);
    expect(r.html).toContain('The Wayback Machine did not answer');
    expect(r.html).not.toContain('No saved copy found');
  });

  it('marks a same-site near match as Possible and does not count it as verified', () => {
    const r = report([
      {
        idx: 0,
        kind: 'dead',
        url: 'https://site.example/old',
        text: 'Old',
        detail: 'HTTP 404 (not found)',
        look: true,
        copyUrl: 'x',
        phraseOk: true,
        replacement: { url: 'https://site.example/new', title: 'New title', verdict: 'likely', relation: 'same site' },
      },
    ]);
    expect(r.html).toContain('<strong>Possible: </strong>');
    expect(r.html).toContain('shares nearly all the words');
    expect(r.fixes).toBe(0);
  });

  it('escapes text from pages and links only to http and https addresses', () => {
    const r = report(items);
    expect(r.html).not.toMatch(/<script/i);
    expect(r.html).not.toContain('<b>available');
    expect(r.html).not.toContain('href="javascript:');
  });

  it('says that a problem past the limit of 12 was not looked into, instead of claiming there is no copy', () => {
    const r = report([
      {
        idx: 0,
        kind: 'dead',
        url: 'https://gone.example/a',
        text: 'A',
        detail: 'HTTP 404 (not found) (Not looked into: the limit of 12 was reached.)',
        look: false,
      },
    ]);
    expect(r.html).toContain('Not looked into: only the first 12 problems are.');
    expect(r.html).not.toContain('No saved copy found');
    expect(r.html).not.toContain('with no saved copy');
  });

  it('says so when every link works', () => {
    expect(report([items[0]]).html).toContain('Every link that could be checked works.');
  });

  it('escapes the reason in the notice', () => {
    const notice = run('Explain why there is nothing to check', [{ ok: false, error: 'That address <b>is not</b> public.' }])[0];
    expect(notice.html).toContain('&lt;b&gt;is not&lt;/b&gt;');
    expect(notice.html).not.toContain('<b>');
  });
});
