# Release Checklist – v32.4.0

Run these commands from the project root. Git is not available in the current environment, so these must be executed locally.

---

## 1. Git Branch & Commit

```bash
git checkout -b chore/updates-2026
git add .
git status   # verify changed files
git commit -m "chore: dependency updates and docs for v32.4.0

- TypeScript 5.x, Node >=18, n8n 2.x
- README: Search backends + troubleshooting
- CHANGELOG: 32.4.0 entry"
```

---

## 2. Manual Test in n8n

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

## 3. Tag & Push

```bash
git tag v32.4.0
git push origin chore/updates-2026
git push origin v32.4.0
```

---

## 4. Publish to npm

```bash
npm publish
```

Requires npm login (`npm login`) if not already authenticated.

---

## 5. GitHub Release

1. Open: `https://github.com/samnodehi/n8n-nodes-duckduckgo/releases/new`
2. **Tag**: `v32.4.0` (select existing tag)
3. **Title**: `v32.4.0 - Dependency updates and n8n 2.x`
4. **Description**: Copy from CHANGELOG `## [32.4.0] - 2026-02-13`
5. Click **Publish release**
