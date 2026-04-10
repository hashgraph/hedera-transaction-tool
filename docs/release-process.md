# Release workflow

## Pre-Release

### Planning / Temp Release Branch
- [ ] Create temp release branch from `main`: `v<major.minor.patch>-beta.<number>-temp-release`
- [ ] Verify branch is pushed

### Bump main to next SNAPSHOT
- [ ] Create branch from `main` to bump version to `<next-version>-SNAPSHOT`
- [ ] Update `package.json` (and any other versioned files) to `<next-version>-SNAPSHOT`
- [ ] Open PR to `main` for SNAPSHOT bump
- [ ] Get PR approval and merge to `main`

### Prepare temp release branch
- [ ] Switch back to temp release branch: `v<major.minor.patch>-beta.<number>-temp-release`
- [ ] Update `package.json` version to `<major.minor.patch>-beta.<number>`
- [ ] Run `pnpm i` in `backend/`, `frontend/`, and `automation/` as an extra precaution to ensure lockfiles are updated with correct version
- [ ] Commit version changes
- [ ] Create draft PR for temp release branch to satisfy DCO checks

### Release branch naming / rules
- [ ] Request rule relaxing for `release/` branch naming, changes may take a minute to propagate
- [ ] Rename temp branch to `release/<major.minor>`
- [ ] Request version branch rules to be reinstated

### Apply core release steps for pre-release
- [ ] Build frontend artifacts
- [ ] Notarize frontend artifacts (all .pkg and .dmg files)
- [ ] Build and push backend images with correct tags

### Pre-release tagging and release
- [ ] Create pre-release git tag: `v<major.minor.patch>-beta.<number>`
- [ ] Create GitHub pre-release for `v<major.minor.patch>-beta.<number>` with minimum to no release notes (none should be required)
- [ ] Create a new branch on DevOps-GitOps:
  - [ ] Update `development` overlays to use this version
  - [ ] Update `finance` overlays to use this version (if applicable)
  - [ ] Update `devops` overlays to use this version (if applicable)
  - [ ] Update `staging` overlays to use this version
- [ ] Open PR for GitOps changes and merge
- [ ] Update `staging` overlays in `staging` branch in DevOps-GitOps and commit
- [ ] In ArgoCD, refresh `Development` (others should auto-refresh)
- [ ] Manually delete `api/chain/notifications` pods of `Development` as needed so they redeploy
- [ ] Verify all services (api/chain/notifications, etc.) are healthy and running this version

---

## Final Release

### Pre-requisites
- [ ] Beta `v<major.minor.patch>-beta.<number>` deployed and stable
- [ ] Run performance tests against `staging`
- [ ] Manual testing issue created from `docs/test-scenarios.md`
- [ ] Manual testing completed and beta approved

### Final versioning
- [ ] Update all `package.json` versions to `<major.minor.patch>`
- [ ] Run `pnpm i` in `backend/`, `frontend/`, and `automation/`
- [ ] Commit and open PR with version, lockfile, NOTICE, and other relevant changes
- [ ] Get PR approval and merge

### Apply core release steps for final
- [ ] Build frontend artifacts
- [ ] Notarize frontend artifacts (all .pkg and .dmg files)
- [ ] Build and push backend images with correct tags

### Final tagging and release
- [ ] Create final git tag: `v<major.minor.patch>`
- [ ] Create GitHub release for `v<major.minor.patch>` with final release notes
- [ ] Create a new branch on DevOps-GitOps:
  - [ ] Update `development` overlays to use this version
  - [ ] Update `finance` overlays to use this version (if applicable)
  - [ ] Update `devops` overlays to use this version (if applicable)
  - [ ] Update `staging` overlays to use this version
- [ ] Open PR for GitOps changes and merge
- [ ] Update `staging` overlays in `staging` branch in DevOps-GitOps and commit
- [ ] In ArgoCD, refresh `Development` (others should auto-refresh)
- [ ] Manually delete `api/chain/notifications` pods of `Development` as needed so they redeploy
- [ ] Verify all services (api/chain/notifications, etc.) are healthy and running this version
