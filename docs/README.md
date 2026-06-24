# Hedera Transaction Tool Docs

## release-process.md

Step-by-step checklist for executing a release. To start a release, trigger the [**Release Automation**](https://github.com/hashgraph/hedera-transaction-tool/actions/workflows/release-automation.yaml) workflow (`Actions → Release Automation → Run workflow`) with the target version. The workflow creates a pre-filled tracking issue — use that issue to work through the manual steps.

**Pre-release** (version: `<major.minor.patch>-beta.<number>`): creates the `release/<major.minor>` branch (if it doesn't exist), bumps versions, tags, builds and pushes Docker images, builds and notarizes macOS artifacts, and publishes the GitHub pre-release with all artifacts attached. On the first pre-release of a new minor version it also opens a SNAPSHOT bump PR to `main`.

**Final release** (version: `<major.minor.patch>`): bumps versions on the release branch, generates the NOTICE file, tags, builds and pushes Docker images, builds and notarizes macOS artifacts, and creates the GitHub release draft with all artifacts attached.

## release-testing-checklist.md

A tiered checklist of manual test cases to verify before approving a release. Cases are grouped by priority — Tier 1 items are release blockers; lower tiers cover areas to verify when relevant code has changed.

## test-scenarios.md

Full catalog of test scenarios used to create manual testing issues. Referenced during the Final Release pre-requisites step.

## API

Coming soon.

## Database

Coming soon.
