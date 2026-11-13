# Release Testing Checklist - <major.minor.patch>-beta.<number>

## Tier 1 — Release Blockers (Must Pass)

Failures in any of these will block the release.

**Installation**
- [ ] Install app from asset (`.pkg`) found in the release
- [ ] Upgrade app from a previous version using the in-app upgrade process
- [ ] Install app on signing laptop and verify basic signing workflow
