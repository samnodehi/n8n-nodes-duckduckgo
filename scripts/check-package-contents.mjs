/**
 * Assert that the published tarball contains what it should and nothing else.
 *
 * Written after two releases went out wrong. Every GitHub release from v32.7.0
 * attached a 44-file archive carrying compiled tests and `tsbuildinfo` against
 * the 25 files npm received, and nothing noticed until someone compared them by
 * hand. `files: ["dist"]` in package.json is the intent; this is the check that
 * the intent held.
 *
 * Reads `npm pack --dry-run --json` on stdin, so it inspects what npm would
 * actually send rather than what happens to be on disk:
 *
 *     npm pack --dry-run --json | node scripts/check-package-contents.mjs
 *
 * Taking the JSON rather than running npm itself keeps this a pure function of
 * its input — no child process, nothing platform-specific, and the same command
 * works locally and in CI.
 *
 * The `.mjs` extension is deliberate. `@n8n/scan-community-package` lints
 * `**\/*.js`, `**\/*.ts` and `**\/*.json` across the whole repository, and build
 * tooling that legitimately uses `process` and `console` would fail rules meant
 * for node runtime code. This file is neither shipped nor loaded by the node.
 */

/** Files allowed outside `dist/`. npm always includes these three. */
const ALLOWED_ROOT_FILES = new Set(['package.json', 'README.md', 'LICENSE.md']);

/** Patterns that must never reach the published package. */
const FORBIDDEN = [
  { test: (p) => p.includes('__tests__'), why: 'compiled tests' },
  { test: (p) => p.endsWith('.test.js'), why: 'compiled tests' },
  { test: (p) => p.endsWith('.ts'), why: 'TypeScript source' },
  { test: (p) => p.endsWith('.map'), why: 'source maps' },
  { test: (p) => p.endsWith('.tsbuildinfo'), why: 'TypeScript build metadata' },
  { test: (p) => p.startsWith('nodes/'), why: 'unbuilt source tree' },
  { test: (p) => p.startsWith('scripts/'), why: 'build tooling' },
  { test: (p) => p.startsWith('docs/'), why: 'documentation' },
];

/** Files whose absence would ship a node that cannot load. */
const REQUIRED = [
  'dist/nodes/DuckDuckGo/DuckDuckGo.node.js',
  'dist/nodes/DuckDuckGo/duckduckgo.svg',
  'dist/nodes/index.js',
];

const readStdin = async () => {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
};

const raw = await readStdin();
if (!raw.trim()) {
  console.error('No input. Pipe `npm pack --dry-run --json` into this script.');
  process.exit(1);
}

const [pack] = JSON.parse(raw);
const paths = pack.files.map((file) => file.path);
const problems = [];

for (const path of paths) {
  const forbidden = FORBIDDEN.find((rule) => rule.test(path));
  if (forbidden) {
    problems.push(`${path} — ${forbidden.why} must not be published`);
    continue;
  }
  if (!path.startsWith('dist/') && !ALLOWED_ROOT_FILES.has(path)) {
    problems.push(`${path} — unexpected file outside dist/`);
  }
}

for (const required of REQUIRED) {
  if (!paths.includes(required)) {
    problems.push(`${required} — missing; the node would not load`);
  }
}

const summary = `${pack.name}@${pack.version}: ${pack.entryCount} files, ${(
  pack.unpackedSize / 1024
).toFixed(0)} kB unpacked`;

if (problems.length > 0) {
  console.error(`Package contents check FAILED — ${summary}`);
  for (const problem of problems) {
    console.error(`  - ${problem}`);
  }
  process.exit(1);
}

console.log(`Package contents OK — ${summary}`);
