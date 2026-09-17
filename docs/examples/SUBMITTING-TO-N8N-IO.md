# Submitting these templates to n8n.io/workflows

Notes and ready-to-paste copy for publishing the workflows in this folder on
[n8n.io/workflows](https://n8n.io/workflows/). Rules below were read from the
n8n Creator hub on **2026-09-07**; n8n describe the creator programme as an
ongoing project, so re-check before submitting.

## What n8n requires

From the [Creator hub](https://n8n.notion.site/n8n-Creator-hub-7bd2cbe0fce0449198ecb23ff4a2f76f)
and its [template submission guidelines](https://n8n.notion.site/p/Template-submission-guidelines-9959894476734da3b402c90b124b1f77):

- **A creator account**, registered at <https://creators.n8n.io/register>.
  A new creator may have **one template under review at a time**, and can only
  submit the next after the previous is approved. Three approved templates make
  the account verified, after which templates can be submitted in batches of four.
- **Community-node templates are accepted**, with two additions the guidelines
  call out as a special case:
  - a disclaimer that the template is **self-hosted only**, and
  - a **workflow image at the top of the description**, because the canvas
    preview does not render for community nodes.
- **Sticky notes are mandatory** — per the
  [sticky note guidelines](https://n8n.notion.site/Sticky-note-guidelines-for-templates-2aa5b6e0c94f8058b0aefddd02655887):
  exactly one yellow overview sticky in the top-left corner, 100–300 words,
  containing `### How it works` and `### Setup`; white section stickies (under
  50 words) grouping the nodes of any workflow with four or more of them.
  All four templates in this folder already satisfy this.
- **Title format**: `Action verb` + the thing being manipulated +
  `to/on/in/from where`, sentence-style capitalisation, no emoji, no hype. The
  `name` field of each JSON is already written in that form.
- **Description**: around 200 words, Markdown only (no HTML), with the sections
  *Who's it for*, *How it works*, *How to set up*, *Requirements*,
  *How to customize*.
- No hardcoded credentials, no personal identifiers.

## What the first rejection taught us

Template 1 was submitted on 2026-09-08 and **not published**: *"It is currently
too basic to meet our publishing criteria."* It was two nodes — a trigger and
one DuckDuckGo node — with everything interesting happening inside that node's
options. As a *workflow* that is a configuration sample.

Measured against the live library on 2026-09-11: published "research assistant"
templates carry 4–21 nodes, median about 8. **That number is wrong — see
*The measurement that was wrong* below.** It came from the search API's node
*preview* list, which reports distinct node types rather than node instances. The
real median is **14**. Two nodes was never going to clear it either way.

So a template here has to **do a job end to end**, not demonstrate one option.
Both templates below were rebuilt or written to that bar.

Two more things worth knowing, both measured rather than assumed:

- **Requiring credentials is normal.** Published Telegram + AI agent templates
  commonly need 2–5 (`telegramApi` + an LLM, often plus Sheets or Postgres).
  The only credential rule in the guidelines is not to *hardcode* keys.
- **The portal has no image upload field**, and that is by design — see
  *The canvas does not render* below. The AI review derives the title from the
  workflow's `name` and pre-fills the description form from the sticky notes.

**Diff the AI's rewritten JSON; do not upload it unread.** It has now been seen
twice. On template 1 it was a regression. On template 4 (2026-09-11) it changed
nothing functional at all — identical parameters, identical wiring, same node
ids — and only renamed the nodes, moved them, and rewrote the stickies. Its
stickies dropped the community-node install step and the self-hosted-only line,
which is exactly what a community-node template must carry. What is in the repo
takes its node names, positions and four-section layout, and keeps our overview
text re-keyed to the new names.

## The measurement that was wrong

**Read this before trusting any node-count figure elsewhere in this file.**

Two conclusions here were built on `api.n8n.io`'s template **search** response and
its `nodes[]` field. That field is not the workflow's nodes. It is a *preview*
generated from n8n's own registry of known node types, and it has two properties
that broke both measurements:

- it lists **distinct node types**, not node instances, so it undercounts; and
- a node type n8n's registry does not know is **omitted entirely** rather than
  listed without an icon — so **every community node is invisible in it**.

Proved on 2026-09-17 with published template **3231**, *"Search the web with
MCP-based Brave Search Engine on Telegram"*. Its raw workflow JSON
(`api.n8n.io/api/templates/workflows/3231`) contains
`n8n-nodes-mcp.mcpClient` — a community package. The preview field for that same
template does not mention it at all.

**n8n's own search index is blind to them too.** The search endpoint takes a
`nodes=` filter and reports exact population counts for core types —
`n8n-nodes-base.code` → 7,069, `@n8n/n8n-nodes-langchain.agent` → 4,064. Every
community type returns **0**: `n8n-nodes-mcp.mcpClient`,
`@blotato/n8n-nodes-blotato.blotato`, `n8n-nodes-serpapi.serpApi`. Template 3231
uses the first of those and is published. So a published community-node template
is **undiscoverable by node** in n8n's own library, and no filter or aggregation
there can be used to count them.

**Re-measured against raw JSON**, `workflow.nodes[].type` per template, on the
98 templates that parsed out of the first 100 ids returned by the search endpoint:

| | this batch | community-node ones | ours |
|---|---|---|---|
| use a community node | 24 of 98 | — | — |
| real nodes, median | 14 | 17 (n=24) | 10 (t4), 7 (t1) |
| real nodes, 25th percentile | 10 | 13 | — |
| fewer than 10 real nodes | — | 2 of 24 | both of ours |

**Read those as one batch, not as the library.** The 100 ids came from a single
page of the endpoint's default ordering. That ordering is stable across calls but
it is not random and not representative: **0 of the 98 carry the "AI" category,
which tags 69% of the 12,394 published templates.** Two ids are missing — 15694
failed to download, 6281 returns 404, a stale index entry. The community-node
figures additionally rest on 24 cases. A population share would need a sample
stratified on the category proportions the endpoint itself publishes.

There are **12 distinct community packages** in the batch (15 node types —
`n8n-nodes-serpapi.serpApi` and `.serpApiTool` are two types from one package),
including `n8n-nodes-serpapi`, a **search** node and the closest published
comparison to this one.

**The skew argues against us, not for us.** The missing segment is AI-tagged
workflows, and AI-agent templates tend to carry *more* nodes, not fewer — model,
memory and tool sub-nodes each count. A sample with none of them most likely
**understates** the real median. So "ours is small relative to what gets
published" survives the sampling problem even though the number 14 does not.

**What this overturns:**

- *"No published template uses a community node"* — **false**. About a quarter do.
- *"Published templates run 4–21 nodes, median about 8"* — **false**, and it was
  measured with the same broken field. The batch above puts the median at 14,
  with the caveats above.
- *"The identical rejection sentence cannot be about the workflow"* — **retracted**.
  Templates 1 and 4 sit at or below the 25th percentile of everything published,
  and below the 25th percentile of community-node templates specifically. "Too
  basic" is consistent with what the library actually contains.

The rendering limitation is still real and n8n confirmed it. It is just not
evidence that our submissions failed for that reason, since a quarter of the
library has the same limitation and is published.

## The canvas does not render — link the screenshot yourself

Templates 1 and 4 were both refused with the same sentence, word for word:
*"It is currently too basic to meet our publishing criteria."* Template 4 was
refused a third time on 2026-09-17, after a resubmission carrying the screenshot
link.

A scan on 2026-09-14 appeared to show that **no** published template used a
community node. **That was wrong** — see *The measurement that was wrong* below.
Roughly a quarter of published templates use one.

n8n's creator team, asked directly on 2026-09-14, confirmed the **rendering
limitation and the fix**:

> Templates using community nodes can be published in the library. However,
> you're correct that the canvas preview may not render properly when a workflow
> contains a community node. The reviewer still receives the submitted JSON, but
> the missing visual preview can make the workflow harder to assess.
>
> The workflow image mentioned in the guidelines should be added **at the top of
> the template description** rather than through a separate upload field. Since
> the current submission flow doesn't make that clear, please include a
> **publicly accessible link** to a screenshot of the complete canvas when you
> resubmit. A GitHub-hosted image is fine.

**Read that carefully, and keep the two apart.** What is *confirmed* is that the
preview may not render, that this can make a workflow harder to assess, and that
the image belongs in the description as a link. What is *ours* was the conclusion
that this is why both templates came back — and **that inference is now retracted**.
It rested on a measurement that turned out to be measuring nothing, and about a
quarter of published templates carry a community node and the same rendering
problem while being published anyway. n8n never said the preview caused either
rejection, and they pointed out the reviewer does still receive the JSON.

So do not treat the screenshot as a fix that makes an unchanged resubmission
succeed. It removes a known obstacle; if a template comes back a third time with
the same sentence, the cause is something else and the next step is to ask what,
not to guess again.

**What to do:** put the screenshot at the very top of the description as a
Markdown image, not as a bare URL — the description is Markdown-only, so a bare
URL renders as a link and the reviewer still has no canvas to look at. The images
in `images/` are committed, so each has a stable public URL. Paste one of these
verbatim:

```markdown
![Build a research brief from DuckDuckGo results](https://raw.githubusercontent.com/samnodehi/n8n-nodes-duckduckgo/main/docs/examples/images/01-research-assistant.png)

![Expand one keyword into multiple DuckDuckGo searches](https://raw.githubusercontent.com/samnodehi/n8n-nodes-duckduckgo/main/docs/examples/images/02-query-expansion.png)

![Monitor news from DuckDuckGo on a schedule](https://raw.githubusercontent.com/samnodehi/n8n-nodes-duckduckgo/main/docs/examples/images/03-news-monitor.png)

![Write a daily AI news story to Telegram](https://raw.githubusercontent.com/samnodehi/n8n-nodes-duckduckgo/main/docs/examples/images/04-ai-news-writer.png)
```

If a field strips Markdown or the word counter fights it, fall back to the bare
URL on its own line — that still satisfies what was literally asked for — but try
the image form first.

### On a revision there is no field for it — send it by email

**The "Implement changes" dialog has no description fields at all** (seen
2026-09-15): the workflow JSON, a *Submit for human review* button, and nothing
else. The description written at first submission is not editable there.

So on a revision: **upload the JSON, submit, and reply to the reviewer's email
with the Markdown image line above.** The reviewer asked for the link herself and
is already on that thread, so it reaches a person either way.

**Do not embed the screenshot inside the overview sticky.** It was tried on
2026-09-15 and reverted, for three reasons, the first of which is fatal:

1. **It is self-referential.** The screenshot is a picture of the canvas; putting
   it inside a sticky on that canvas means the next screenshot shows a sticky
   containing the previous screenshot, and every layout edit invalidates the
   image that lives inside the layout.
2. **It only helps in a scenario we cannot verify.** The description was
   pre-filled from the stickies at *first* submission; nothing shows a revision
   re-derives it. And if the canvas does not render for the reviewer, the
   rendered sticky does not reach them either.
3. **It costs real content.** Template 4's overview was at 298 of the 300
   permitted words, so making room meant cutting text that was doing a job.

All four URLs were checked as publicly reachable: HTTP 200, `image/png`, and the
bytes match the committed file. Retake and re-commit whenever a template changes shape —
the URL stays the same, so a stale screenshot would silently mislead a reviewer.

## Before submitting

1. **Put the screenshot at the top of the description, as a Markdown image** —
   see the section above for the exact line. Without it the reviewer has no
   canvas to look at. All four images are current, taken from a self-hosted n8n
   with the node installed, on the light theme.
2. Run it once so the description matches what actually happens.
3. Submit through the Creator Dashboard at <https://creators.n8n.io/login>.

Suggested order, given the one-at-a-time limit: **4 → 1 → 3 → 2**. Template 4
goes first because it is the strongest of the set and the only one run end to
end against the real services; the rebuilt template 1 then goes into the
“Implement changes” slot left by the rejection. The news monitor has the
broadest recurring use after that, and query expansion is the most niche.

---

## Template 1 — Build a research brief from DuckDuckGo results with no API key

File: `01-research-assistant.json` — **rebuilt 2026-09-11** after the rejection
above. Seven nodes, and still no credential of any kind.

> ![Build a research brief from DuckDuckGo results](images/01-research-assistant.png)
>
> **Self-hosted n8n only.** This template uses the community node
> `n8n-nodes-duckduckgo-search`, and community nodes cannot be installed on
> n8n Cloud.

### Who's it for

Anyone who needs the *content* of search results rather than a list of links:
research assistants, analysts, anyone assembling a reading pack on a question.

### How it works

A DuckDuckGo web search runs with **Fetch Page Content** enabled, so each result
arrives with the readable body of its page and with site, author and date
attached — no HTTP Request or HTML node involved. Results whose extraction
returned little or nothing are dropped: a paywall or a timeout would pad the
brief without adding to it. The remainder are ordered by how substantial they
are, capped at five, merged into one item and written out as a Markdown brief
with a quote and a link for each source.

### How to set up

1. Install `n8n-nodes-duckduckgo-search` under **Settings → Community nodes**.
2. Nothing to authenticate — no account, no API key, no credential.
3. Change the **Query** in the search node and run.

### Requirements

Self-hosted n8n and the community node. **No credentials at all**, which is
unusual for a research workflow in this library and is the point of this one.

### How to customize

Raise **Max Results** and **Page Content Max Results** for a wider brief; both
cost extra page fetches, so keep them modest on a schedule. Swap the manual
trigger for a Schedule Trigger and send `brief` to Slack, email or a document.
Add **Ranking Rules** in the search node to drop domains you never want cited.

---

## Template 2 — Expand one keyword into multiple DuckDuckGo searches with autocomplete

File: `02-query-expansion.json`

> ![Expand one keyword into multiple DuckDuckGo searches](images/02-query-expansion.png)
>
> **Self-hosted n8n only.** This template uses the community node
> `n8n-nodes-duckduckgo-search`, and community nodes cannot be installed on
> n8n Cloud.

### Who's it for

SEO and content researchers, keyword analysts, and anyone building a research
agent that should explore a topic rather than answer one narrow question.

### How it works

One seed keyword goes into DuckDuckGo's autocomplete, which returns what people
actually search for around that term. With **Split Into Items** enabled each
suggestion becomes its own item, and a batch loop then runs a real web search
for every one of them. A **Wait** node pauses three seconds between searches:
DuckDuckGo rate-limits per IP and answers a burst with a bot-challenge page
instead of results, and this is what keeps the loop below that line. Each search
is set to continue on error, so one blocked query does not end the run.

### How to set up

1. Install `n8n-nodes-duckduckgo-search` under **Settings → Community nodes**.
2. There is nothing to authenticate — no account, no API key.
3. Replace the seed query in **Get Suggestions** and run.

### Requirements

Self-hosted n8n, and the `n8n-nodes-duckduckgo-search` community node. No
credentials, no paid service.

### How to customize

Lower **Max Results** in Get Suggestions for a shorter, faster run. Raise the
Wait interval if you are running this often from one IP. Feed the collected
results into a Summarize or AI Agent node to merge everything into one answer,
or into a Google Sheet to build a keyword map.

---

## Template 3 — Monitor news from DuckDuckGo on a schedule and handle rate limits

File: `03-news-monitor.json`

> ![Monitor news from DuckDuckGo on a schedule](images/03-news-monitor.png)
>
> **Self-hosted n8n only.** This template uses the community node
> `n8n-nodes-duckduckgo-search`, and community nodes cannot be installed on
> n8n Cloud.

### Who's it for

Anyone running an unattended watch on a topic: competitive intelligence, brand
monitoring, PR, or a daily digest for a team channel.

### How it works

A schedule trigger fires every six hours and searches DuckDuckGo News over the
last day, fetching the readable body of the top stories rather than just their
headlines. The result then passes through an If node that checks for an `error`
field. That branch is the point of the template: DuckDuckGo rate-limits per IP,
and a blocked run should look different from a quiet news day. One output builds
an alert you can send wherever you will see it; the other maps each story to a
`headline` and `articleText` pair, ready for a summariser, a database or a chat
message.

### How to set up

1. Install `n8n-nodes-duckduckgo-search` under **Settings → Community nodes**.
2. There is nothing to authenticate — no account, no API key.
3. Change the query, adjust the schedule, and connect the two outputs to
   wherever you want them.

### Requirements

Self-hosted n8n, and the `n8n-nodes-duckduckgo-search` community node. No
credentials, no paid service.

### How to customize

**Time Period** accepts `d`, `w`, `m` and `y`. Add more queries by duplicating
the news node, or deduplicate against a datastore so a story is only reported
once. Send the error branch somewhere you actually read — a monitor that fails
silently is worse than no monitor.

---

## Template 4 — Write a daily AI news story to Telegram with DuckDuckGo and an AI agent

File: `04-ai-news-writer.json` — ten nodes. The strongest of the set, and the
only one that has been run end to end against the real services.

> ![Write a daily AI news story to Telegram](images/04-ai-news-writer.png)
>
> **Self-hosted n8n only.** This template uses the community node
> `n8n-nodes-duckduckgo-search`, and community nodes cannot be installed on
> n8n Cloud.

### Who's it for

Anyone who wants a written briefing rather than a feed: a team channel that
should get one considered story a day instead of ten headlines nobody opens.

### How it works

A schedule trigger sweeps DuckDuckGo News for the last day. The result passes an
If node that checks for an `error` field first — DuckDuckGo rate-limits per IP
and this runs unattended, so a block is a matter of when; that branch warns you
instead of letting the agent write about nothing. The headlines are then merged
into a single item, which matters: an AI Agent runs **once per input item**, so
without it ten headlines become ten model calls and ten messages.

The agent picks the single most significant story, calls the DuckDuckGo node
**as a tool** for background, and returns JSON. A Code node parses that
defensively — models wrap JSON in code fences, add a preamble, or ignore the
format — escapes it for Telegram and caps the length before it is sent.

### How to set up

1. Install `n8n-nodes-duckduckgo-search` under **Settings → Community nodes**.
2. Add credentials for **OpenRouter** and **Telegram**. DuckDuckGo needs none.
3. Put your chat ID in **both** Telegram nodes and change the query.

### Requirements

Self-hosted n8n, the community node, an OpenRouter account and a Telegram bot.
The search side needs no key.

### How to customize

Change the query to any beat — one topic per copy of the workflow. The agent
searches from the same IP as the sweep, so keep **Max Results** low on the tool
and the schedule no tighter than a few hours. Swap Telegram for Slack or email;
the Code node hands on plain fields.
