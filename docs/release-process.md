## Overview

To start a release, trigger the **Release Automation** workflow (`Actions → Release Automation → Run workflow`) with the target version. The workflow creates a pre-filled tracking issue — use that issue to work through the manual steps.

**Pre-release** (version: `<major.minor.patch>-beta.<number>`): creates the `release/<major.minor>` branch (if it doesn't exist), bumps versions, tags, builds and pushes Docker images, builds and notarizes macOS artifacts, and publishes the GitHub pre-release with all artifacts attached. On the first pre-release of a new minor version it also opens a SNAPSHOT bump PR to `main`.

**Final release** (version: `<major.minor.patch>`): bumps versions on the release branch, generates the NOTICE file, tags, builds and pushes Docker images, builds and notarizes macOS artifacts, and creates the GitHub release draft with all artifacts attached.

---

# Release workflow

## Pre-Release

- [ ] If a SNAPSHOT bump PR was opened, review and merge it to `main`

### Pre-release deployment
- [ ] Create a new branch on DevOps-GitOps:
  - [ ] Update `development` overlays to use this version
- [ ] Open PR for GitOps changes and merge
- [ ] Update `staging` overlays in the `staging` branch in DevOps-GitOps and commit
- [ ] Manually delete `api/chain/notifications` pods of `Development` as needed so they redeploy
- [ ] Verify all services (api/chain/notifications, etc.) are healthy and running this version

---

## Final Release

### Pre-requisites
- [ ] Beta `v<major.minor.patch>-beta.<number>` deployed and stable
- [ ] Run performance tests against `staging`
- [ ] Manual testing issue created from `docs/test-scenarios.md`
- [ ] Manual testing completed and beta approved

### Publish Release
- [ ] Add a short description to the GitHub release draft for `v<major.minor.patch>`
- [ ] Publish the GitHub release draft

### Final deployment
- [ ] Create a new branch on DevOps-GitOps:
  - [ ] Update `development` overlays to use this version
  - [ ] Update `finance` overlays to use this version
  - [ ] Update `devops` overlays to use this version
  - [ ] Update `staging` overlays to use this version
- [ ] Open PR for DevOps-GitOps changes and merge
- [ ] Create a new branch on Hedera-GitOps:
  - [ ] Update `back-end-council` overlays to use this version
  - [ ] Update `back-end-staff` overlays to use this version
- [ ] Open PR for Hedera-GitOps changes and merge
- [ ] Update `staging` overlays in the `staging` branch in DevOps-GitOps and commit
- [ ] In ArgoCD, refresh `Development` (others should auto-refresh)
- [ ] Manually delete `api/chain/notifications` pods of `Development` as needed so they redeploy
- [ ] Verify all services (api/chain/notifications, etc.) are healthy and running this version
