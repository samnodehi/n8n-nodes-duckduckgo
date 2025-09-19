# Contributing

Thanks for contributing!

## Workflow
- Please use a fork and open Pull Requests from feature branches.
- Keep PRs small and focused.
- Link the PR to the related issue (e.g., "Fixes #123").

## Coding Guidelines
- TypeScript preferred.
- Keep dependencies minimal.
- Add clear logs when adaptive backoff / cool-off triggers.
- Avoid parallel requests in loops for Web Search.

## Testing
- Include a brief test plan in the PR description.
- If the change affects Web Search behavior, simulate 10+ looped runs.

## Ethics / ToS
- Respect DuckDuckGo ToS.
- Anti-bot bypass features must be opt-in and documented.
