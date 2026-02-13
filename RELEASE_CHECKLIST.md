# Release Checklist – v32.4.0

---

## Status

| Step | Status | Notes |
|------|--------|-------|
| Git push to main | Done | e5922aa, 40566ec |
| Tag v32.4.0 | Done | Pushed to origin |
| GitHub Release | Done | Auto-created by workflow on tag push |
| npm publish | **You do this** | See below |

---

## 1. Manual Test in n8n

1. Open n8n (local or cloud).
2. **Settings** → **Community Nodes** → Install `n8n-nodes-duckduckgo-search` (or use local path).
3. Create a workflow and add **DuckDuckGo Search**.
4. Test each operation:
   - **Web Search**: simple query
   - **Image Search**: simple image query
   - **News Search**: recent topic
   - **Video Search**: simple video query
5. Confirm results or expected errors (e.g. rate limits).

---

## 2. Publish to npm (required)

```bash
cd C:\samnodehi\n8n-nodes-duckduckgo
npm login    # if not logged in
npm publish
```

After publish, v32.4.0 will be on https://www.npmjs.com/package/n8n-nodes-duckduckgo-search
