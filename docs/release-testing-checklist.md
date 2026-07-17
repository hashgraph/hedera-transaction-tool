# Release Testing Checklist - <major.minor.patch>-beta.<number>

## Installation

- [ ] Install app from asset (`.pkg`) found in the release
- [ ] Upgrade app from a previous version using the in-app upgrade process
- [ ] Install app on signing laptop and verify basic signing workflow

## Tier 1 — Release Blockers (Must Pass)

Failures in any of these should block the release.

**3. Settings**
- [ ] 3.2.15 User can import encrypted private key
- [ ] 3.2.18 User can import external private key for missing key

## Tier 2 — High Priority (Should Pass)

**1. Registration**
- [ ] 1.3.1 "Sign in with Keychain" button is visible when OS keychain available
- [ ] 1.3.2 User can register using OS keychain

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

**5. Transaction Creation**
- [ ] 5.11.3 System Delete transaction
- [ ] 5.11.4 System Undelete transaction
- [ ] 5.12.1 User can create a Freeze transaction
- [ ] 5.12.2 User can create a Node Create transaction
- [ ] 5.12.3 User can create a Node Update transaction
- [ ] 5.12.4 User can create a Node Delete transaction
- [ ] 5.13.3 User can add account-based keys at various depths

**7. Transaction Groups**
- [ ] 7.1.7 Valid start time picker works with running clock
- [ ] 7.5.5 Export group as .tx (V1 format)
- [ ] 7.6.2 User can navigate between transactions in the group

## Tier 4 — Lower Priority (Periodic Verification)

**13. Navigation and Layout**
- [ ] 13.3.3 Account setup in progress forces user to /account-setup

**14. Error Handling / Edge Cases**
- [ ] 14.4.1 Graceful handling when organization server is unreachable
- [ ] 14.4.2 WebSocket reconnection after disconnect
- [ ] 14.4.3 Error displayed when Mirror Node is unavailable
- [ ] 14.4.4 Transaction fails gracefully when Hedera network returns error
