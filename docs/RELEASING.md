# Releasing

Publishing runs in CI so every release carries **npm provenance** — a signed
attestation that the tarball was built from this repository, by this workflow,
at a specific commit. It also removes the manual `npm login` step, whose token
expired between sessions often enough to be a nuisance.

## One-time setup

Provenance needs npm to trust this repository. Do this once, on npmjs.com:

1. **Register the trusted publisher.**
   Go to the package page → **Settings** → **Trusted publisher** → GitHub Actions, and enter:
   - Organization / user: `samnodehi`
   - Repository: `n8n-nodes-duckduckgo`
   - Workflow filename: `release.yml`

2. **Add a publish token as a repository secret.**
   On npmjs.com create an **Automation** granular access token scoped to
   `n8n-nodes-duckduckgo-search` with read+write. Then in GitHub:
   **Settings → Secrets and variables → Actions → New repository secret**,
   named `NPM_TOKEN`.

   > Automation tokens bypass 2FA prompts, which is what makes an unattended
   > publish possible. Keep it scoped to this one package.

## Cutting a release

1. Land everything on `main` and make sure CI is green.
2. Bump the version and write the notes:
   - `package.json` version
   - a new section at the top of `CHANGELOG.md`
   - a new section at the top of `RELEASE_NOTES.md` (the GitHub release body is
     taken from this file)
3. Merge that to `main`.
4. Tag and push:

   ```bash
   git tag -a vX.Y.Z -m "Release vX.Y.Z - short summary"
   git push origin vX.Y.Z
   ```

The tag push triggers `release.yml`, which installs, checks that the tag matches
`package.json`, runs the production build, publishes to npm **with provenance**,
then packs and attaches the release asset.

Three things about that order matter:

- **Publish runs before the GitHub release is created**, so a failed publish
  cannot leave a release advertising a version that never reached npm.
- **The asset is packed after the production build**, so what is attached to the
  release is the same set of files that was published. Packing after a plain
  `npm run build` produced a 44-file tarball carrying compiled tests and
  `tsbuildinfo`, against the 25 files npm actually publishes.
- **Publishing is skipped when the version already exists on npm**, so a rerun
  after a failure later in the job can still reach the release step. npm refuses
  to republish a version, which would otherwise make every rerun fail.

- **The tag must be a SemVer release tag**, and nothing derived from it is
  interpolated into a shell script. A tag name is attacker-controllable text and
  git accepts refs like `v$(cmd)`, so the version is validated against a strict
  SemVer pattern and passed to later steps through the environment.
- **The tagged commit must be on `main`.** A tag can be pushed at any commit,
  including one that never passed review; publishing from it would bypass branch
  protection, and an npm version cannot be withdrawn once published.

### Prereleases

A tag like `v33.0.0-beta.1` is published under the `next` dist-tag and marked as
a prerelease on GitHub. Without that, an ordinary `npm install` would start
serving the prerelease, because npm defaults to `latest`.

Only the part before a `+` decides this, so `v33.0.0+build-1` is treated as a
stable release — a hyphen inside SemVer build metadata does not make a version a
prerelease.

## Verifying a release

```bash
npm view n8n-nodes-duckduckgo-search version
```

On the npm package page the version should show a **Provenance** section linking
back to the workflow run and commit.

## If the publish step fails

- **`E404` on `PUT`** — npm returns 404 rather than 401 for an unauthorised
  publish. It almost always means the token is missing, expired or out of scope,
  not that the package or version is wrong.
- **Provenance rejected** — check that `id-token: write` is still present in the
  workflow permissions and that the trusted publisher entry still points at
  `release.yml`.
- The tag is already pushed at that point. Fix the cause and re-run the workflow
  from the Actions tab rather than retagging.

## Manual publish (fallback)

Only if CI is unavailable:

```powershell
npm.cmd login
npm.cmd publish
```

Use `npm.cmd`, not `npm` — PowerShell's execution policy blocks the `npm.ps1`
shim on this machine. A manual publish produces **no provenance attestation**.
