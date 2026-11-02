# Release Testing Checklist - <major.minor.patch>-beta.<number>

## Tier 1 — Release Blockers (Must Pass)

Failures in any of these will block the release.

**Installation**
- [ ] Install app from asset (`.pkg`) found in the release
- [ ] Upgrade app from a previous version using the in-app upgrade process
- [ ] Install app on signing laptop and verify basic signing workflow

## Tier 2 — High Priority (Should Pass)

**3. Settings**
- [ ] 3.5.8 Keychain user sees reset application form instead of password change

**4. Transactions List**
- [ ] 4.2.2 Notification badges appear on relevant tabs
