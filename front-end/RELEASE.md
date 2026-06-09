# Release

## Automated releases (normal flow)

Releases are fully automated via CI. When a release PR is merged, the pipeline:

1. Bumps the version in `package.json` and creates a git tag
2. Builds, signs, and notarizes the macOS artifacts (`.dmg`, `.pkg`, `.zip`)
3. Builds and pushes Docker images
4. Creates the GitHub release and attaches all artifacts

You do not need to run anything locally for a normal release.

---

## Local macOS build (signed + notarized)

You'd do this when you want to validate a signed/notarized build on your machine — for example before cutting a release, after changing electron-builder config, or to debug a signing issue.

### 1. Get the credentials

You need two things:
- **Two `.p12` signing certs** — Developer ID Application (signs `.app`, `.dmg`, `.zip`) and Developer ID Installer (signs `.pkg`)
- **An App Store Connect API key** — a `.p8` file plus its Key ID and Issuer ID (used for notarization)

These are stored in the team's shared secrets. Keep the files outside the repo (e.g. `~/.certs/`).

### 2. Set up release.env

```bash
cp front-end/scripts/release.env.example front-end/scripts/release.env
```

Fill in the real values. `release.env` is gitignored — never commit it.

### 3. Build and sign

From the `front-end` directory:

```bash
pnpm run build && pnpm build:mac
```

`pnpm build:mac` calls `scripts/build-mac.sh`, which loads your `release.env` credentials and runs electron-builder. Artifacts land in `front-end/release/`.

### 4. Notarize and staple

```bash
pnpm notarize:mac
```

This calls `scripts/notarize-mac-installers.sh`, which submits the `.dmg` and `.pkg` to Apple and staples the notarization ticket. It filters to the current `package.json` version, so old artifacts in `release/` are ignored.

---

## Smoke test workflow

The [macOS Smoke Test](.github/workflows/smoke-test-mac.yaml) workflow is a manual `workflow_dispatch` that builds, signs, and notarizes against any branch, tag, or commit without creating a release.

Use it when:
- Rotating or renewing Apple certificates or secrets
- An Apple Developer Agreement update may have invalidated signing
- Validating electron-builder config changes before a real release
- Debugging a CI notarization failure

Trigger it from the **Actions** tab in GitHub — it is not part of the standard release checklist.
