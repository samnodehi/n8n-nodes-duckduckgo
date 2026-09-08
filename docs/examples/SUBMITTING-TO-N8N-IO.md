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
  All three templates in this folder already satisfy this.
- **Title format**: `Action verb` + the thing being manipulated +
  `to/on/in/from where`, sentence-style capitalisation, no emoji, no hype. The
  `name` field of each JSON is already written in that form.
- **Description**: around 200 words, Markdown only (no HTML), with the sections
  *Who's it for*, *How it works*, *How to set up*, *Requirements*,
  *How to customize*.
- No hardcoded credentials, no personal identifiers.

## Before submitting

1. Upload the canvas screenshot from `images/` as the first thing in the
   description. The images below were taken from a self-hosted n8n with the
   node installed, on the light theme; retake one if a template changes shape.
2. Run it once so the description matches what actually happens.
3. Submit through the Creator Dashboard at <https://creators.n8n.io/login>.

Suggested order, given the one-at-a-time limit: **1 → 3 → 2**. The first shows
the capability nothing else in the library offers (search results with the
article body already extracted), the news monitor has the broadest recurring
use, and query expansion is the most niche of the three.

---

## Template 1 — Extract full article text from DuckDuckGo web search results

File: `01-research-assistant.json`

> ![Extract full article text from DuckDuckGo web search results](images/01-research-assistant.png)
>
> **Self-hosted n8n only.** This template uses the community node
> `n8n-nodes-duckduckgo-search`, and community nodes cannot be installed on
> n8n Cloud.

### Who's it for

Anyone who needs the *content* of search results rather than the results
themselves: research assistants, RAG pipelines, content and SEO teams, and
anyone feeding a language model something better than a two-line snippet.

### How it works

A single DuckDuckGo node runs a web search with **Fetch Page Content** enabled.
For the top results it downloads each page and extracts the main article text
with Mozilla Readability, so navigation, ads and boilerplate are dropped and
what is left is the piece itself. **Include Page Metadata** adds site name,
author, published date and language to every item, which is enough to filter by
source or to cite properly before anything goes downstream. The node is set to
continue on error, so a single unreachable page cannot end the run.

### How to set up

1. Install `n8n-nodes-duckduckgo-search` under **Settings → Community nodes**.
2. There is nothing to authenticate. DuckDuckGo needs no account and no API key,
   and the node sends no telemetry.
3. Edit the **Query** field and run.

### Requirements

Self-hosted n8n, and the `n8n-nodes-duckduckgo-search` community node. No
credentials, no paid service.

### How to customize

Raise **Max Results** for breadth and **Page Content Max Results** for depth.
Add an AI Agent or Summarize node after the search — the extracted text is clean
enough to answer from directly. DuckDuckGo rate-limits per IP, so on a schedule
keep the searches spaced out.

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
