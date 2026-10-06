/**
 * Extraction in a worker thread, against the compiled worker in dist/.
 *
 * ts-jest runs the .ts sources, and a worker thread can only load compiled
 * JavaScript, so these tests need `npm run build` first. CI builds before it
 * tests; locally the suite is skipped, with a notice, when dist/ is missing.
 */

import * as fs from 'fs';
import * as path from 'path';
import { runExtraction } from '../pageContent';

const workerFile = path.join(__dirname, '../../../dist/nodes/DuckDuckGo/extractWorker.js');
const built = fs.existsSync(workerFile);
if (!built) {
  console.warn(`extractWorker tests skipped: ${workerFile} not found - run npm run build first.`);
}
const describeBuilt = built ? describe : describe.skip;

const article = '<html><body><article><h1>Topic</h1>' +
  '<p>This is a sufficiently long article paragraph about an interesting topic that contains enough words for Readability to treat it as the main content of the page.</p>' +
  '<p>It continues with a second paragraph so the extracted article comfortably exceeds the minimum length threshold used to trust the Readability result.</p>' +
  '</article></body></html>';

describeBuilt('runExtraction in a worker', () => {
  it('extracts an ordinary page', async () => {
    const result = await runExtraction(article, 0, { workerFile });
    expect(result.error).toBeUndefined();
    expect(result.content).toContain('interesting topic');
  });

  it('stops a page built to be slow to parse, without blocking the main thread', async () => {
    // Readability is superlinear in nesting depth: 3,000 nested divs take far
    // longer than the deadline, in a page of about 33 KB.
    const html = '<html><body>' + '<div>'.repeat(3000) + '<p>deep</p>' + '</div>'.repeat(3000) + '</body></html>';
    let ticks = 0;
    const ticker = setInterval(() => { ticks++; }, 50);
    const started = Date.now();
    const result = await runExtraction(html, 0, { workerFile, timeoutMs: 1000 });
    clearInterval(ticker);

    expect(result.error).toBe('Page took too long to process (over 1 s)');
    expect(Date.now() - started).toBeLessThan(3000);
    // The main thread kept running while the worker was busy.
    expect(ticks).toBeGreaterThan(5);
  }, 10000);

  it('stops the regex tier on an unclosed script flood', async () => {
    const html = '<script>'.repeat(80000);
    const result = await runExtraction(html, 0, { workerFile, timeoutMs: 1000 });
    expect(result.error).toBe('Page took too long to process (over 1 s)');
  }, 10000);
});

describe('runExtraction without a worker script', () => {
  it('falls back to extracting on the main thread', async () => {
    const result = await runExtraction(article, 0, { workerFile: path.join(__dirname, 'no-such-worker.js') });
    expect(result.error).toBeUndefined();
    expect(result.content).toContain('interesting topic');
  });
});
