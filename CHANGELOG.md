# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> **Compatibility note:** Earlier changelog entries described reliability modules and UI options (adaptive backoff, circuit breaker, retry logic, reliability settings) that were later found not to affect runtime search execution. In 32.5.0, those inert options are removed and the documentation now reflects actual runtime behavior.

---

## [32.16.0] - 2026-09-25

### Added

- **News and Video fetch more than one page.** Asking for more results than DuckDuckGo's first page holds now fetches further pages, up to five in all. They are requested the way DuckDuckGo's own results page requests them — a same-origin request with a Referer — which is what a live test found DuckDuckGo serves; the navigation-style requests duck-duck-scrape sent were refused for later pages in our tests, most clearly when page 1 had just been served and page 2 was asked for at DuckDuckGo's own next-page URL. Each next page is the one DuckDuckGo names itself: News stepped in fixed pages of 30 whatever a page held (Video, checked after release, by 60), so counting results would drift. Results DuckDuckGo repeats across pages are dropped (a live second page repeated 12 of its 22). A request the first page already satisfies costs what it did before: one request for the token and one for the page.

  Checked live with this code at the node's defaults — Strict and all time, sent as `p=1` and `df=a`: a request for 45 News results fetched three pages (`s=0`, `30`, `60`) and returned 45 results, none repeated, with no fallback and no warning. Video's first page alone held 45 or more, so Video's second page had not been exercised live when this was released; a check made after the release, with this code, fetched 100 videos over two pages, none repeated.

  Only the offset is taken from DuckDuckGo's next-page pointer. The request itself is always rebuilt from the node's own settings, so a later page cannot come back under a different Safe Search level, region or time filter, and nothing is fetched from a URL DuckDuckGo supplied.

### Changed

- **News and Video no longer use duck-duck-scrape.** The library could not page with DuckDuckGo's current tokens ([Snazzah/duck-duck-scrape#149](https://github.com/Snazzah/duck-duck-scrape/issues/149)) and in our tests DuckDuckGo refused its style of request for later pages, so the node now makes these requests itself, as it already did for Web and Image search. Results keep exactly the shape they had: a test runs the library's own mapping on the same answer and requires the two to match, entity decoding included, which is now done by `html-entities` — the same package the library used, now a direct dependency. duck-duck-scrape is no longer installed with the node.

- **A block on the News or Video request is now recognised where it happens.** The page is checked for DuckDuckGo's challenge before its status or JSON is trusted, so a block starts the local back-off at once instead of first sending a fallback request into it.

---

## [32.15.3] - 2026-09-24

### Fixed

- **Safe Search was never applied when News or Video fell back to the HTML page.** That path put the setting in `s` — the parameter DuckDuckGo's search endpoints use for the result offset — and not in `kp`, where DuckDuckGo reads safe search and where Web Search already sent it. So no level took effect there, and Strict — the node's default — went out as `s=moderate`. It now sends `kp`: 1 for Strict, -1 for Moderate, -2 for Off.

- **The README gave Moderate as the Safe Search default; it is Strict**, on all four search operations, and has been since the first release. The README now says so, and the Moderate option's description in the node no longer calls it the default level. The default itself is unchanged: changing it would quietly loosen filtering for everyone who left the option alone.

- **News and Video cannot fetch a second page with DuckDuckGo's current tokens, and the warning about it made no sense.** Asking for more results than DuckDuckGo's first page holds returned the first page with a warning ending in `4-1429… is an invalid VQD!`. The cause, established live: DuckDuckGo's tokens now have one dash, and duck-duck-scrape 2.2.7 — the latest release — checks for two before using one, so every later page is refused locally and never sent. Reported upstream as [Snazzah/duck-duck-scrape#149](https://github.com/Snazzah/duck-duck-scrape/issues/149). Requested directly with the library's headers, bypassing its check, later pages were refused by DuckDuckGo with 403 four times out of four, including once at DuckDuckGo's own next-page URL. A request shaped like the one DuckDuckGo's own page sends for the next page — a same-origin XHR with a Referer — did succeed, found after this release was prepared. So for now News and Video return one page. For News that held 26 to 30 results in our tests; Video's page size has not been measured.

  The warning now says that plainly and names the upstream issue. Because every run would stop in the same place, the answer is cached like any other, instead of fetching page 1 again on each run only to be refused page 2 again.

- **The paging itself is corrected for when it becomes possible.** Both loops asked for page 2 at offset 10 whatever page 1 held. The next page is now requested at the number of results received so far. That is not always DuckDuckGo's own figure — after a 28-result page it named 30. If a page never holds more than DuckDuckGo's step, as both samples suggest, the count can fall short of its offset but not pass it, and falling short is the safe way to be wrong: a result or two is fetched again and dropped as a repeat, where an offset past DuckDuckGo's would skip results unseen. Repeats are compared by URL with tracking parameters removed, the way the output shows them. None of this runs until a second page can be fetched — and the live test that later fetched one showed the offset rule still needs changing: DuckDuckGo stepped by 30 after pages of 26 and 22, and its second page repeated 12 results of the first.

- **The troubleshooting note in the README gave the wrong range for `maxResults`.** It said 1 to 50; the four search operations accept 1 to 100. Fifty is the limit for Search Suggestions.

### Changed

- **How many pages are fetched follows the page size DuckDuckGo actually returned**, never more than five in all, rather than assuming ten per page.

- **A result set cut short by the page limit says so**, on the canvas and in the log, like one cut short by a failure. The limit is at most five pages, fewer when each page is large. The answer is still cached, because every run would stop at the same place — and a cache hit repeats the warning, so a short list served from the cache is not silent either. A page that brings nothing new is reported too, and not cached.

- **Return Raw Results** for News and Video returns the collected pages with repeats removed.

---

## [32.15.2] - 2026-09-23

### Fixed

- **News and Video returned a short result set without saying why.** When Maximum Results is set higher than DuckDuckGo's first page holds, the node fetches further pages one at a time. If a later page failed - the request threw, or DuckDuckGo answered without the token needed to continue - the node kept the pages it already had and returned them with nothing said: no error, no log line, nothing on the canvas. Asking for thirty and getting ten looked exactly like DuckDuckGo having only ten.

  That is the same shape as the worst bug this node has had. DuckDuckGo's HTTP 202 challenge page returned *empty* results silently until 32.12.0; this returned *partial* results silently.

  Partial results are still returned - ten real results beat none - but now the node logs a warning and, on n8n versions that support execution hints, shows one on the canvas: how many it asked for, how many it got, and what stopped it. Genuine exhaustion, where DuckDuckGo simply has no more results, is not a failure and is still reported as nothing at all.

  A truncated answer is also no longer written to the cache. Caching it would have served the shortfall for the whole TTL without a request, and without the failure left to explain it.

- **Video search did not log a failure of its primary path.** News logs `Primary news search failed: ...` before falling back; Video did not. When the fallback then succeeded, nothing reached the workflow and there was no record that the primary path had failed at all.

### Changed

- **All four cache keys now include `maxResults`.** None of them did, so a cached ten-result answer was served to a later request for fifty and came back short with nothing to say so. On News and Video the cache hit skipped the pagination loop entirely; on Web and Image the results had already been cut to ten before being stored. The four operations behaved the same way and are fixed the same way.

- **The `Maximum Results` tooltip no longer reads as a promise.** All four operations now say "Maximum number of ... to return; DuckDuckGo may return fewer", matching the README.

---

## [32.15.1] - 2026-09-17

### Fixed

- **Security: an IPv6 spelling of a private address could get past the page-fetch guard.** `Extract Page Content` and `Fetch Page Content` refuse to fetch loopback, private and link-local addresses, because the node is usable as an AI Agent tool and the URL it is asked for is untrusted input. That guard judged IPv4-mapped IPv6 literals by matching the dotted form, `::ffff:127.0.0.1` — but `new URL()` normalises every IPv6 literal before the hostname is read, and the normal form is compressed hex: `[::ffff:169.254.169.254]` arrives as `::ffff:a9fe:a9fe`. The pattern was matching a string the URL parser never produces, so that branch had never once fired.

  In 32.15.0 and earlier, `http://[::ffff:169.254.169.254]/latest/meta-data/` — the cloud instance-credentials endpoint — and `http://[::ffff:127.0.0.1]/` were both accepted. An agent that could be steered into calling Extract Page Content with such a URL, including by text arriving inside search results, could have had the response handed back to it.

  The guard now parses the literal into its eight groups and compares numbers, so no spelling can step around it. IPv4-mapped (`::ffff:a.b.c.d`), IPv4-compatible (`::a.b.c.d`) and NAT64 (`64:ff9b::a.b.c.d`) forms are all judged on the address they carry. Link-local and unique-local are matched by range rather than by prefix text, which also closes `feb0::1` and the rest of `fe80::/10` above `fe80:`.

  **Redirects carried the same bypass and are fixed by the same change.** The guard already re-ran on every redirect target before following it, but the target reached it through the same URL parser and so arrived in the same compressed form — a page answering `302 → http://[::ffff:169.254.169.254]/` would have been followed. There is now a regression test for that path as well.

  Dotted IPv4, decimal (`http://2130706433/`) and hex (`http://0x7f000001/`) forms were never affected: the URL parser converts those to dotted-quad before the guard sees them. DNS names that resolve to private addresses remain out of scope, as documented.


### Removed

- **Dead pagination code.** `vqdPagination.ts`, `htmlParser.ts` and the private `_webSearchWithSuperPagination` method were never reachable: the method was marked `@ts-ignore - kept for potential future use` and carried its own note that it was unused, and nothing called it. Web Search has gone through `directWebSearch` for a long time. Together they were about 680 lines, and `vqdPagination.ts` was the file keeping a `duck-duck-scrape` import alive for no running code.

  Its test file went with them. Worth recording why it gave no cover: of the four tests it declared, **only two ever ran** — the `paginateWithVqd` block was commented out, with a note saying the pagination logic was "difficult to test accurately with mocks" and "works correctly in production", for a function production never called.

  Nothing about the node's behaviour changes. The published package is two files and 18 kB smaller.

---

## [32.15.0] - 2026-09-12

### Changed

- **CI now fails on a package that would ship the wrong files.** Every GitHub release from v32.7.0 attached an archive carrying compiled tests, and nothing noticed until the two were compared by hand. `npm run check-package` reads `npm pack --dry-run` and asserts that nothing outside `dist/` ships beyond the three files npm always includes, that no compiled test, source map or TypeScript file is present, and that the node entry point and icon are. The release workflow runs the same check after its production build and before publishing, because a tag can be pushed before CI finishes or at a commit whose CI failed, and an npm version cannot be taken back.
- **CI reports what actually ran.** The test and suite counts and the coverage table are written to the run summary, so a claim about the suite can be checked against the run that produced it rather than a README that may have drifted.
- **CI steps have timeouts.** There were none, so a hung step would have held a runner for the six-hour default.
- **A failed search now reports the status code DuckDuckGo returned.** The search helpers used to catch an HTTP failure and throw a plain `Error` carrying only a sentence, so the status code and the response body were discarded before anything could show them. A rate-limited run said "Too many requests" and nothing else. Those failures are now `NodeApiError`, which keeps the status code and the response alongside the same wording, and the node no longer re-wraps them on the way out — re-wrapping would have kept the message and dropped everything else.

  A failure where the request never got an answer at all — a timeout, an unresolvable host, a refused connection — has no HTTP context to keep, and `NodeApiError` would have replaced the node's wording with its own generic text for those codes. They are `NodeOperationError` instead, so "Web search request timed out. Please try again." still reads exactly as it did.

  Four re-throws are deliberately left as they are: two carry an already-worded error (a parser failure, a bot-challenge message) whose guidance is the point of it, and two are the image-search retry, which inspects the original error's status to decide whether to refetch the token. Wrapping either kind would cost more than it gained.

- **Debug output goes to the n8n log instead of the server console.** Debug Mode used to print JSON lines to standard output, which put them in the host's log with no execution context attached, and n8n Cloud does not permit console output from a community node at all. The same entries now go through n8n's own logger: errors as errors, warnings as warnings, everything else as debug. Turning Debug Mode on and off behaves exactly as before.

  Three diagnostics that were **not** gated by Debug Mode — a primary news search failing before a fallback, and either fallback failing after it — were deliberately always-on so the cause stays visible when the fallback succeeds and no error reaches the workflow. They still are, now as warnings on the n8n logger rather than console lines.

  Console calls in the fallback and direct-search modules were removed outright rather than rerouted: each one duplicated a message the function was already returning or throwing, so nothing is lost.
- **Timers use n8n's `sleep` helper.** `setTimeout` is unavailable to community nodes on n8n Cloud. Behaviour is unchanged.
- **`inputs`/`outputs` use `NodeConnectionTypes.Main`** rather than the `'main'` string literal.
- **`package.json` declares `peerDependencies: { "n8n-workflow": "*" }`** and no longer carries a `resolutions` field. The field was yarn-only boilerplate; npm never applied it, and the lockfile records no override from it.

  Taken together these cut the violations reported by `@n8n/scan-community-package` against the published package from 57 to 10 — and all 10 that remain are the runtime dependencies, which is a separate piece of work.

---

## [32.14.0] - 2026-09-09

### Added

- **New option: Ranking Rules.** Reorder or drop results by where they came from, applied locally to results the node has already fetched — no extra requests, no service, nothing leaves the process. Available on Web, News and Video Search. Each rule matches a **Domain** (subdomains included) or a **URL Contains** substring, and **Boosts**, **Downranks** or **Discards** what it matches.

  Rules are checked in order and the first match wins, so a boost for `docs.example.com` above a discard for `example.com` keeps the documentation and drops the rest — something no fixed precedence between effects could express. Ordering is three stable buckets rather than a score, so there is no weight to tune and unmatched results stay exactly where DuckDuckGo put them. Rules run **before** the cut to `maxResults`, not after, which is the point of doing this in the node at all. On Web Search, which fetches everything the request returned and cuts afterwards, a discard is backfilled and you still get the number you asked for; News and Video fetch about as many as you asked for, so a discard there can leave you short and Maximum Results has to be raised to compensate. `position` is renumbered to match, where results carry one. A result with no URL, or one that does not parse, is never discarded by a rule it had no chance to match.

---

## [32.13.0] - 2026-09-09

### Added

- **Image search now sends one request instead of two.** The VQD token DuckDuckGo requires is only handed out in a search page, so each image search fetched that page purely to read the token before making the request that returns results. The token is reusable, so it is now kept for up to an hour, per query and per client, and the page fetch is skipped while one is held — the rate limit that gets an IP blocked counts requests rather than searches, so halving them is the cheapest protection available. Previously a token was reused only between input items of a single execution and discarded when the execution ended.

  A token DuckDuckGo has stopped accepting no longer surfaces as an error: `directImageSearch` fetches a fresh one and retries once, and returns whichever token worked. A 403 that turns out to be a bot-detection block rather than a stale token is reported and starts the back-off instead of being retried. The stored token is also taken as it is used and written back only after the request it served succeeded, so a failed run cannot leave a bad token behind for the next one. Nothing is configurable and nothing is written to disk; the token lives in memory for the life of the n8n process.

- **Result URLs now have advertising click identifiers removed.** `utm_*`, `fbclid`, `gclid`, `msclkid`, `mc_cid` and the rest of that family are stripped from `url` on Web, News and Video results. Deduplicating results across runs compares URLs, and the same article carrying a different `utm_campaign` each time compared as a different page; it also keeps tracking strings out of what an AI Agent writes downstream. The rule is narrow on purpose: the path, the fragment, the order of the surviving parameters and every unrecognised parameter are untouched, names that sites use for real (`ref`, `source`, `id`) are never removed, and every byte that survives is the byte DuckDuckGo returned - only the matching segments are cut out of the query rather than the query being rebuilt, which would re-encode what remains (`?q=a%20b` into `?q=a+b`, `~` into `%7E`) and produce a different URL for a server that signs its query. A URL carrying an AWS, Google Cloud Storage or CloudFront signature is returned whole, since removing any parameter would invalidate it. A URL that does not parse, or is not `http(s)`, is passed through rather than dropped. Image results are not normalised at all, because a query string on an asset URL is often a CDN signature.

### Fixed

- **The in-memory cache no longer grows without bound.** Expiry was only noticed when the same key was read again, and `pruneExpiredEntries()` had no caller, so keys written once and never read back were kept for the life of the process. A write now sweeps out anything expired once the store passes 256 entries, and at most once a minute - size alone would make every write walk a full store of still-live entries.

- **Image Search now reports a bot-detection challenge instead of returning nothing.** The challenge check ran only on the page fetched to obtain the VQD token, not on the `i.js` request that actually carries the results — and it was skipped entirely when a caller supplied a token, as pagination does. A challenge arriving there is HTML in place of JSON, which has no `results` property and so parsed to an empty set: the exact silent failure 32.10.0 was written to end, still live on one path. It now raises the challenge error and starts the local back-off like every other search path, whether the block arrives as HTTP 202 or as 403. **Upgrade note:** an image search blocked this way now returns an error item where it previously returned success with an empty result list, so a workflow branching on `success` or on an empty list will take a different branch.

### Changed

- **The README leads with the rate-limit behaviour** rather than explaining it 500 lines in, so the first thing a reader learns is what an empty result set does and does not mean.

---

## [32.12.2] - 2026-09-07

No functional changes to the node. Release, documentation and example-workflow work only.

### Changed

- **Releases now publish from CI with npm provenance.** The tag-triggered workflow publishes the package itself, attaching a signed attestation that the tarball was built from this repository at a known commit. It refuses to publish if the tag and `package.json` disagree, publishes before creating the GitHub release so a failed publish cannot leave a release advertising a version that never reached npm, and skips publishing when the version already exists so a rerun can still reach the release step. Prerelease tags go to the `next` dist-tag rather than `latest`, and a stable tag takes `latest` only if it is newer than the version `latest` already points at. Setup and troubleshooting are documented in `docs/RELEASING.md`.
- **The example workflows now carry sticky notes** explaining what each one does and how to adapt it, and their titles were rewritten to the form n8n's template library expects. `docs/examples/SUBMITTING-TO-N8N-IO.md` records the submission requirements.

### Fixed

- **The release asset now matches what is published.** The workflow packed the tarball after a plain `npm run build`, so every GitHub release since v32.7.0 attached a 44-file archive containing compiled test files and `tsbuildinfo`, while npm received the 25-file production build. The asset is now packed after `build:prod`.
- **The GitHub release body is now this version's notes only.** `RELEASE_NOTES.md` is a cumulative history and the whole file was attached, so v32.12.1 went out with 623 lines opening on the v32.12.0 heading. The release now uses the section matching the tag, and fails if that section is missing rather than publishing another version's notes.
- **A tag npm would rewrite is now rejected.** npm canonicalises the manifest version before publishing, so a tag carrying build metadata (`v33.0.0+build-1` → `33.0.0`) or a non-canonical prerelease identifier (`v33.0.0-01` → `33.0.0-1`) would have reached the registry under a different version than the tag and the release asset claimed.

---

## [32.12.1] - 2026-09-07

### Fixed

- **The back-off now gates the News and Video primaries too.** 32.12.0 refused requests during the back-off on the Web, Image and fallback paths, but News and Video call `duck-duck-scrape` first — so every execution still sent one request from an IP DuckDuckGo had already blocked, which is exactly what the back-off exists to prevent.
- **A challenge reported by the fallback now reaches the user.** The News and Video error item was built from the earlier primary failure, so the bot-challenge message and its countdown were replaced by a generic error. The challenge message is now preferred, and the remaining-seconds text survives the typed error instead of being overwritten by its canned wording.

### Documentation

- Corrected the news-monitor example: it advertised `retryOnFail`, which never fires for News or Video because those operations emit an error item rather than failing the execution. It now branches on the `error` field, and the README says so.

---

## [32.12.0] - 2026-09-07

### Changed

- **The node now backs off after a bot-detection challenge.** Once DuckDuckGo serves a challenge, further search requests are refused locally for about a minute instead of being sent, with an error stating how many seconds remain. Every request made during a block is wasted, adds load to a service that has just said stop, and prolongs the block for everyone sharing that outbound IP — which on n8n Cloud means other tenants. The window is deliberately far shorter than the block itself, so the node throttles rather than stops: roughly one probe per minute goes out, and normal operation resumes within a minute of the block lifting.

  This completes the fallback-amplification fix started in 32.10.0. A challenge seen by Web Search now also holds back the News/Video fallback, which previously could not tell a challenge from any other failure because its primary path (`duck-duck-scrape`) fails opaquely.

---

## [32.11.0] - 2026-09-06

### Added

- **New operation: Search Suggestions (autocomplete).** Returns DuckDuckGo's query suggestions for a partial search term via its public suggestion endpoint — no VQD token, no key, and a very small payload. Options: `maxResults` (default 10), `region`, and `splitIntoItems` to emit one n8n item per suggestion instead of a single item holding the list. Useful for query expansion, keyword research, and offering an AI Agent alternative phrasings before it commits to a search.

  This endpoint was **the surface least affected by rate limiting** during endpoint testing, so it often still answers when Web Search is temporarily blocked — a deliberate companion to the challenge detection added in 32.10.0. Both response shapes DuckDuckGo has returned (the `type=list` pair form and the `{ phrase }` object form) are handled, and an unfamiliar shape degrades to an empty list rather than throwing.

---

## [32.10.0] - 2026-09-06

### Fixed

- **Bot-detection challenges are no longer reported as "no results".** DuckDuckGo answers a client it considers automated with a human-verification page served as **HTTP 202**. Because 2xx is a success status, that page was parsed, no result blocks were found, and an **empty array was returned with no error**. `directSearch.ts` also encoded the assumption that "HTTP 202 = genuine no-results page", which is what silently swallowed it — DuckDuckGo uses 202 for both, so the response body is now inspected before the status is trusted. This is the root cause behind the long-standing "web search returns nothing" and "empty results after 2 or 3 executions" reports. The node now throws a named, non-retryable `BOT_CHALLENGE` error explaining that the instance's IP is temporarily blocked. Detection runs only where parsing already produced zero results, so text inside a real result can never trigger it.
- **The News/Video fallback no longer masks a challenge.** It reports `challenged: true` instead of `success: true, noResults: true`, so an IP-level block is no longer indistinguishable from an empty result set.
- **VQD extraction no longer depends on a single pattern.** Image search matched only `vqd=<digits>` and could not match the JSON form `"vqd":"…"` DuckDuckGo has been moving toward. Every known shape is now tried.

### Security

- **Page fetching refuses addresses that are not publicly routable.** `fetchPageContent` previously retrieved any caller-supplied URL with no scheme or host validation. Because the node is exposed to AI agents (`usableAsTool`), and an agent can be steered by text arriving inside the search results the node itself returns, that URL is untrusted input. It could be used to make the n8n host read its own API (`127.0.0.1:5678`), cloud instance metadata (`169.254.169.254`) or internal services, and return the contents to the model. Non-`http(s)` schemes and loopback, `.localhost`, `0.0.0.0`, `127.0.0.0/8`, `169.254.0.0/16`, RFC 1918, CGNAT and IPv6 loopback/link-local/unique-local addresses are now refused, and **every redirect hop is re-checked**. Known residual risk: DNS rebinding is not covered, because the checks are literal-address based and do not resolve DNS.

### Documentation

- README documents the bot-detection challenge, what triggers it, how to reduce it, and the refused-address behaviour.

---

## [32.9.2] - 2026-06-25

### Changed

- **Dependencies:** updated `@mozilla/readability` 0.5.0 → 0.6.0, the engine behind Fetch Page Content and the Extract Page Content operation.
- **Tooling:** migrated ESLint to the flat-config format (`eslint.config.js`, ESLint 9), and the main node file is now linted. This tidied parameter descriptions (consistent final periods, a "Whether" boolean description) and the node input/output declarations — no runtime behaviour change.
- **Dev dependencies:** glob 13.0.6, n8n-core 2.16.1, prettier 3.8.4, rimraf 6.1.3, ts-jest 29.4.11.

---

## [32.9.1] - 2026-06-24

### Changed

- **Dependencies:** bumped `axios` from 1.13.5 to 1.18.1 (bug and security fixes).
- **CI:** updated GitHub Actions — `actions/checkout` 4→7, `actions/setup-node` 4→6, and `softprops/action-gh-release` 2→3 (clears the deprecated Node 20 runner warnings). No change to the published package or runtime behaviour.

---

## [32.9.0] - 2026-06-24

### Added

- **New operation: Extract Page Content.** Give the node any URL and it fetches the page and returns the main text (`content`) plus optional metadata, using the same three-tier extractor (Readability → DOM heuristic → regex) as search. Turns the node into a "read any page" tool for AI agents.
- **New operation: Instant Answer.** Queries DuckDuckGo's official, free, no-key Instant Answer API and returns a direct `answer`, `abstract` (Wikipedia-style summary), `definition`, `relatedTopics`, image, source, and type.
- **Page metadata for Fetch Page Content.** A new **Include Page Metadata** sub-option adds `pageTitle`, `pageAuthor`, `pagePublished`, `pageExcerpt`, and `pageSiteName` (from Readability) to Web and News results when the page is an article.

All three are free, require no API key, and add no paid or external dependencies (they reuse axios + the existing extractor / DuckDuckGo's own endpoints).

---

## [32.8.0] - 2026-06-24

### Added

- **Page content extraction now also works for News Search.** The opt-in **Fetch Page Content** option (and its `pageContentMaxResults` / `pageContentMaxLength` / `pageContentTimeout` controls) is now available on News Search, fetching each article's page and extracting its main text into `pageContent`. The same three-tier extractor (Readability → DOM heuristic → regex) and per-result error handling apply. Web and News now share a single enrichment path.

---

## [32.7.0] - 2026-06-23

### Added

- **Optional page content extraction for Web Search.** A new opt-in **Fetch Page Content** option fetches the top-N result pages and extracts their main readable text into a `pageContent` field, with `pageContentMaxResults` (default 3), `pageContentMaxLength` (default 2000), and `pageContentTimeout` (default 8000 ms) controls. Extraction is three-tiered: Mozilla Readability (over a linkedom DOM) for clean article text, a DOM heuristic that drops menus by link density when Readability finds no article, and a regex heuristic as a last resort (adds the `@mozilla/readability` and `linkedom` dependencies). It is off by default; when enabled it makes HTTP requests to third-party result sites (the only path that contacts non-DuckDuckGo hosts). Per-page failures are reported via `pageContentError` / `pageContentTruncated` and never abort the search.

---

## [32.6.0] - 2026-06-23

### Removed

- Removed 8 dead modules never reachable from the node entry point
  (`apiClient`, `multiBackendSearch`, `reliabilityManager`, `searchFilters`,
  `rateLimiter`, `proxy`, `errorHandler`, `telemetry`) and their dead tests.
  The removed `apiClient`/`multiBackendSearch` code contained an unused
  third-party SearchAPI.io client path; it never executed and is now gone.
- Dropped unused dependencies: `https-proxy-agent`, `socks-proxy-agent`
  (production), `uuid`, `@types/uuid`, `@types/express`,
  `@types/request-promise-native` (dev), and the `semantic-release`
  toolchain (with `.releaserc`), which CI no longer used.
- Removed the redundant top-level **Locale** node option; locale is now
  set per operation via the **Region** option (saved `locale` values are
  silently ignored).

### Changed

- **Default locale/region is now `wt-wt` (worldwide).** The global Locale
  dropdown now uses the same correct DuckDuckGo region codes as the
  per-operation Region option; the previous default `en-us` was an invalid
  code that DuckDuckGo silently ignored.
- `main` now points at `dist/nodes/index.js`, so `require()` of the package
  resolves correctly.

### Fixed

- Restored canonical MIT license text so the project license is detected
  as MIT.

### Tests / CI

- Added unit tests for the `cache` and `processors` modules.
- Bumped GitHub Actions (`checkout` v4, `action-gh-release` v2); added
  Dependabot config, a security policy, and issue templates.

---

## [32.5.2] - 2026-05-18

### Fixed

- Improved News fallback query construction by replacing the broken hard-coded `site:` OR chain with a user-query-dominant `${query} news` fallback
- Added exact token-level relevance filtering for News fallback results to prevent unrelated generic BBC/CNN-style results
- Prevented short-token substring false positives, e.g. `AI` no longer matches unrelated words like `Taiwan`, `said`, or `again`
- Preserved meaningful short query token `AI` as an explicit exact-token match
- Populated Image Search `source` from the image source page URL instead of returning an empty string
- Added diagnostic warning when primary News Search fails before fallback is attempted

### Tests

- Added News fallback query-construction tests
- Added News fallback relevance-filter tests for `n8n` and `AI`
- Added Image Search `source` field regression test
- Full suite: 257 tests passing

---

## [32.5.1] - 2026-05-17

### Fixed

- Filter sponsored/ad URLs from direct Web Search results (`duckduckgo.com/y.js`, `bing.com/aclick`, ad query params)
- Normalize DuckDuckGo `/l/?uddg=` redirect URLs to final destination URLs
- Prevent malformed `https:////duckduckgo.com/...` fallback URLs
- Re-filter decoded redirect targets so ads hidden inside `uddg` are dropped
- Fix News fallback dates: use `date: null` instead of synthetic millisecond timestamps
- Fix News fallback descriptions: preserve fallback body text when available

### Removed

- Removed inert `Enable Telemetry` UI option
- Removed telemetry runtime reads/call sites from the node execution path

### Tests

- Added direct web-search ad/redirect normalization coverage
- Added fallback parser ad/redirect normalization coverage
- Added News fallback date/description regression coverage
- Added stale `enableTelemetry` regression coverage
- Full suite: 242 tests passing

---

## [32.5.0] - 2026-05-17

### Breaking / Migration

- `snippet` field removed from Web Search output — use `description` (identical content)
- `favicon` field removed from Web Search output — was always an empty string
- `DuckDuckGoApi` credential type removed from package registration (`n8n.credentials: []`)
- Removed UI options (silently ignored if present in saved workflow JSON — no migration required):
  - `useApiKey` — credential was never read
  - `searchBackend` — dispatch logic was never implemented
  - `proxySettings` — proxy agent was never applied to HTTP requests
  - `reliabilitySettings` — search calls were never wrapped with retry or circuit-breaker logic
  - Separate `searchFilters` collection — never read or applied
  - Web Search `timePeriod` — `df` parameter was not included in the request body
  - Image filter options (`size`, `color`, `type`, `layout`) — `i.js` filter behavior is undocumented and unreliable
  - Video filter options (`duration`, `resolution`, `publishedTime`) — removed with inert filter wiring

### Removed

- `credentials/DuckDuckGoApi.credentials.ts` deleted
- Hardcoded year query mutation removed — DuckDuckGo receives the exact query string entered

### Fixed

- News/video fallback overwrite bug: fallback success was being clobbered by a subsequent error item in the output array
- Duck-duck-scrape generic `"A server error occurred!"` string now caught and re-surfaced with a specific message
- Image VQD-missing: no longer returns fake/empty image URLs; now throws a named error
- Image HTTP 403: classified with a specific, actionable error message
- Web parser-failure: HTTP 200 large-body parse failures now throw a named error instead of returning an empty result silently

### Added

- `isFallback: boolean` field on all News and Video result items
- `syndicate: "DuckDuckGo Fallback"` on news fallback results
- `publisher: "DuckDuckGo Fallback"` on video fallback results
- `position` field on Web Search results (1-based rank)
- Per-execution VQD reuse for repeated same-query image searches (reduces redundant page GETs within one execution)

### Changed

- Package description updated to remove false enterprise reliability claims
- README fully rewritten: correct output field names, accurate error descriptions, no false reliability/filter/backend/credential claims
- All 214 tests passing

### Package

- `retry` removed from production dependencies (zero production imports)
- `uuid` moved to devDependencies (zero production imports; test-only)
- Compiled tests excluded from npm package (`dist/nodes/DuckDuckGo/__tests__/`)
- `dist/credentials/` excluded from npm package
- `dist/tsconfig.tsbuildinfo` excluded from npm package
- Packed size: ~45 kB (reduced from ~119 kB)

### Deferred

- Image filters: `i.js` `f` parameter is undocumented; smoke testing showed silent failures — deferred to a future release
- Web Search date filter (`df`): needs live verification before re-exposing in UI
- Full proxy support: requires dedicated implementation and security/privacy review
- Reliability/circuit-breaker: requires design decision before re-implementation

---



## [32.4.1] - 2026-02-13

### Documentation

- Remove internal docs (RELEASE_CHECKLIST, UPDATE_PLAN_STATUS)
- README: Remove version-specific labels
- Minor cleanup

---

## [32.4.0] - 2026-02-13

### Dependencies

**Upgrades**
- TypeScript 4.8 → 5.4
- Node.js engines: >=16 → >=18
- n8n-core, n8n-workflow: 1.14.1 → ^2.8.0
- axios: ^1.9.0 → ^1.13.0 (resolutions aligned)
- devDependencies: @semantic-release/*, glob, gulp, ts-jest, @types/request-promise-native, etc.
- eslint-plugin-n8n-nodes-base: ^1.16.6

**Documentation**
- README: Search backends section (Web/Image vs News/Video)
- README: Enhanced Empty Results troubleshooting with backend + reliability tips

### Compatibility

- n8n 2.x compatible
- TypeScript 5.x
- Node.js 18+

---

## [31.0.0] - 2025-11-11

### 🚀 **Major Release - Agent-Ready & Production-Grade Reliability**

This is a major upgrade that transforms the DuckDuckGo Search node into a production-grade, AI Agent-ready tool with enterprise-level reliability features.

#### ✨ **New Features:**

**🤖 AI Agent Integration**
- **Agent Tool Support**: Node is now usable as an AI Agent tool in n8n workflows
- **Simplified Interface**: Clean, minimal input contract optimized for LLM consumption
- **Structured Output**: Predictable output format designed for agent consumption
- **Tool Description**: AI-friendly parameter descriptions for better agent understanding
- Enable via environment variable: `N8N_COMMUNITY_PACKAGES_ALLOW_TOOL_USAGE=true`

**🛡️ Advanced Reliability System**
- **Adaptive Backoff**: Automatically backs off when consecutive empty results are detected
- **Jittered Delays**: Random jitter prevents thundering herd problems in parallel execution
- **Circuit Breaker**: Automatic failure detection and recovery mechanism
- **Retry Logic**: Configurable retry attempts with exponential backoff
- **Operational Metrics**: Real-time tracking of requests, failures, and performance

**⚙️ Reliability Configuration**
- Empty Result Threshold: Configure when to trigger adaptive backoff
- Backoff Settings: Control initial delay, maximum delay, and multiplier
- Jitter Range: Set minimum and maximum random delays
- Circuit Breaker: Configure failure threshold and reset timeout
- Retry Behavior: Set maximum retries and delay between attempts

**📊 Observability & Monitoring**
- Circuit state monitoring (CLOSED, OPEN, HALF_OPEN)
- Request and response metrics tracking
- Average response time calculation
- Empty response rate tracking
- Backoff activation counts
- Circuit breaker trip events
- Retry attempt tracking

#### 🔧 **Improvements:**

**Performance**
- Optimized parallel request handling
- Reduced rate limiting issues through intelligent backoff
- Better resource utilization with circuit breaking
- Improved response times under load

**Stability**
- Handles bursty workloads gracefully
- Prevents cascading failures with circuit breaker
- Automatic recovery from transient errors
- Resilient to DuckDuckGo rate limits

**Developer Experience**
- Comprehensive test suite (132 passing tests)
- Production-ready error handling
- Clear operational signals
- Extensive documentation

#### 📚 **Technical Enhancements:**

**New Modules**
- `reliabilityManager.ts`: Complete reliability management system
- Comprehensive test coverage for reliability features
- Global reliability manager for cross-request coordination

**Configuration**
- Backward compatible - all features are opt-in
- Sensible defaults that work out of the box
- Fine-tuning options for advanced use cases

#### 🎯 **Use Cases:**

**AI Agent Workflows**
- Use as a search tool in AI agent workflows
- Reliable search results for agent decision-making
- Structured data perfect for LLM processing

**High-Volume Search**
- Handle parallel searches from multiple workflows
- Automatic rate limit management
- Graceful degradation under load

**Production Workloads**
- Enterprise-grade reliability
- Automatic failure recovery
- Performance monitoring

#### ⚡ **Breaking Changes:**

None - this release maintains full backward compatibility while adding new opt-in features.

#### 🐛 **Bug Fixes:**

- Improved handling of empty result scenarios
- Better error messages for rate limiting
- Enhanced parallel request coordination

#### 📦 **Dependencies:**

No new external dependencies added - all reliability features built with native capabilities.

---

## [30.0.4] - 2025-06-29

### 🎉 **Initial Release - Complete DuckDuckGo Search Integration for n8n**

#### ✨ **Core Features:**

**🔍 Web Search**
- Advanced web search with comprehensive result parsing
- Support for multiple result formats (title, URL, description, hostname)
- Intelligent query enhancement for better search results
- Clean HTML content extraction with proper text normalization

**🖼️ Image Search**
- High-quality image search with thumbnail and full-size URLs
- Rich metadata including dimensions, source, and title
- Support for various image formats and sources
- Efficient image result processing

**📰 News Search**  
- Real-time news search from diverse sources
- Publication date and source information
- News-specific filtering and sorting options
- Clean news content extraction

**🎥 Video Search**
- Comprehensive video search across platforms
- Video metadata including duration, views, and publish date
- Thumbnail extraction and video source information
- Support for various video platforms

#### 🛠️ **Advanced Capabilities:**

**⚙️ Search Configuration**
- Customizable result limits (1-50 results per search)
- Multiple language and region support
- Safe search filtering options
- Search operator support for advanced queries

**🌐 Locale & Region Support**
- 50+ language/region combinations
- Automatic locale detection and handling
- Customizable regional search preferences
- Multi-language result processing

**🔧 Advanced Query Processing**
- Smart query enhancement and optimization  
- Search operator parsing (`site:`, `intitle:`, `filetype:`, etc.)
- Query validation and error handling
- Special character and encoding support

**🚀 Performance & Reliability**
- Built-in rate limiting and retry mechanisms
- Efficient HTTP client with timeout handling
- Comprehensive error handling and recovery
- Memory-efficient result processing

**🔒 Privacy & Security**
- No API keys required - completely free to use
- Direct DuckDuckGo integration without third-party services
- Privacy-focused search without user tracking
- Secure HTTP client configuration

#### 📊 **Technical Specifications:**

**🏗️ Architecture**
- TypeScript implementation with full type safety
- Modular design with separate search modules
- Comprehensive test coverage (97 tests)
- Clean code architecture following n8n standards

**🔌 Integration Features**
- Seamless n8n workflow integration
- Input/output parameter validation
- Error handling with descriptive messages
- Consistent data structure across all search types

**⚡ Performance**
- Optimized HTML parsing algorithms
- Efficient memory usage
- Fast response times
- Minimal dependencies

#### 🎯 **Use Cases:**

- **Content Research**: Gather comprehensive web content for analysis
- **Image Collection**: Build image databases and galleries
- **News Monitoring**: Track news and updates on specific topics  
- **Video Discovery**: Find relevant video content across platforms
- **SEO Research**: Analyze search results and content strategies
- **Market Research**: Gather competitive intelligence and trends
- **Academic Research**: Collect scholarly and reference materials

#### 🚀 **Getting Started:**

1. Install the node package in your n8n instance
2. Add the DuckDuckGo Search node to your workflow
3. Configure your search type and parameters
4. Execute and process the results

**Ready to use immediately - no setup or API keys required!**

---

*This project provides a complete, privacy-focused search solution for n8n workflows using DuckDuckGo's powerful search capabilities.* 
