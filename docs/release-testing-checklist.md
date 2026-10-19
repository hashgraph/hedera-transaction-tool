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

**User Migration (TTv1 → TTv2)**
- [ ] Run the TTv1-to-TTv2 migration workflow and verify keys and accounts transfer correctly
- [ ] Migrated user can connect to the organization and operate normally

**6. Transaction Details**
- [ ] 6.3.4 Signature status panel shows required vs completed signatures

## Tier 3 — Medium Priority (Verify When Changed)

**7. Transaction Groups**
- [ ] 7.6.2 User can navigate between transactions in the group
