# Release

## Automated releases (normal flow)

Releases are fully automated via CI. When a release PR is merged, the pipeline:

1. Bumps the version in `package.json` and creates a git tag
2. Builds, signs, and notarizes the macOS artifacts (`.dmg`, `.pkg`, `.zip`)
3. Builds and pushes Docker images
4. Creates the GitHub release and attaches all artifacts

You do not need to run anything locally for a normal release.

---

## Smoke test workflow

The [macOS Smoke Test](.github/workflows/smoke-test-mac.yaml) workflow is a manual `workflow_dispatch` that builds, signs, and notarizes against any branch, tag, or commit without creating a release.

Use it when:
- Rotating or renewing Apple certificates or secrets
- An Apple Developer Agreement update may have invalidated signing
- Validating electron-builder config changes before a real release
- Debugging a CI notarization failure

Trigger it from the **Actions** tab in GitHub — it is not part of the standard release checklist.
