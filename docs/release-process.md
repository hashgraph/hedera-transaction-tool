# Release workflow

## Pre-Release

### Planning / Release Branch
- [ ] Trigger the Release Automation workflow with version `<major.minor.patch>-beta.<number>`
- [ ] Review and merge the auto-generated SNAPSHOT bump PR to `main`

### Apply core release steps for pre-release
- [ ] Build frontend artifacts
- [ ] Notarize frontend artifacts (all .pkg and .dmg files) - Optional for pre-release, but recommended
- [ ] Build and push backend images with correct tags

### Pre-release deployment
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
- [ ] Trigger the Release Automation workflow with version `<major.minor.patch>`
- [ ] Review and merge the auto-generated final version PR

### Apply core release steps for final
- [ ] Build frontend artifacts
- [ ] Notarize frontend artifacts (all .pkg and .dmg files)
- [ ] Build and push backend images with correct tags

### Final deployment
- [ ] Publish the draft GitHub release for `v<major.minor.patch>`
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