# UI Test Coverage and Release Checklist

This document enumerates all user-facing scenarios in the Hedera Transaction Tool front-end application. Each scenario is assigned a unique identifier and indicates whether it is currently covered by automated UI testing. Scenarios that require manual testing include a checkbox for use during release verification.

**Legend:**

- **Automated**: Yes = covered by enabled Playwright E2E tests in `automation/`; Yes as Component Test = covered by Vitest renderer tests in `front-end/src/tests`; Yes (Backend) = scenario isn't reachable through the renderer UI but is exercised by a backend / API test (counted in Coverage %); No = manual testing required; Skipped = a Playwright test exists but is currently disabled; N/A = not reachable through the renderer UI and not covered at any layer
- **Covered By**: The actual test name from the automation or renderer test files that covers this scenario

---

## 1. Registration

### 1.1 First-Time User Registration

| #     | Scenario                                                         | Automated | Covered By                                               |
| ----- | ---------------------------------------------------------------- | --------- | -------------------------------------------------------- |
| 1.1.1 | All registration page elements are displayed correctly           | Yes       | Verify all elements are present on the registration page |
| 1.1.2 | User can register with valid email and strong password           | Yes       | Verify successful registration through "Create New" flow |
| 1.1.3 | Password strength tooltip shows real-time feedback (>= 10 chars) | Yes as Component Test | shows password strength tooltip hook and disables registration for weak password |
| 1.1.4 | Registration fails when passwords do not match                   | Yes as Component Test | shows invalid email and mismatched password validation |
| 1.1.5 | Registration fails with invalid email format                     | Yes as Component Test | shows invalid email and mismatched password validation |
| 1.1.6 | Registration fails with weak password (< 10 characters)          | Yes as Component Test | shows password strength tooltip hook and disables registration for weak password |
| 1.1.7 | Register button is disabled until all validations pass           | Yes as Component Test | enables registration only after email and passwords are valid |
| 1.1.8 | "Keep me logged in" checkbox is available during registration    | Yes as Component Test | shows and toggles Keep me logged in checkbox during registration |

### 1.2 Account Setup Wizard (Post-Registration)

| #      | Scenario                                                             | Automated | Covered By                                                                   |
| ------ | -------------------------------------------------------------------- | --------- | ---------------------------------------------------------------------------- |
| 1.2.1  | Account setup wizard elements are displayed correctly                | Yes       | Verify elements on account setup page are correct                            |
| 1.2.2  | User can generate a new 24-word recovery phrase via "Create New" tab | Yes       | Verify "Create New" tab elements in account setup are correct                |
| 1.2.3  | User can import an existing recovery phrase via "Import" tab         | Yes       | Verify "Import Existing" tab elements in account setup are correct           |
| 1.2.4  | Regenerating recovery phrase produces different words                | Yes       | Verify re-generate of recovery phrase changes words                          |
| 1.2.5  | "I Understand" checkbox gates the Generate button                    | Yes       | Verify generate button is disabled until "I Understand" checkbox is selected |
| 1.2.6  | Clear button resets all 24 mnemonic fields                           | Yes       | Verify clear button clears the existing mnemonic phrase                      |
| 1.2.7  | Clearing a single word does not affect other filled words            | Yes       | Verify words are persisted after deleting a single word                      |
| 1.2.8  | User can verify recovery phrase by filling missing words             | Yes       | Verify successful registration through "Create New" flow                     |
| 1.2.9  | Final step displays key nickname, type, and public key               | Yes       | Verify final step of account setup has all correct elements                  |
| 1.2.10 | Key pair saved successfully toast appears on completion              | Yes       | Verify successful registration through "Create New" flow                     |
| 1.2.11 | User and key pair are persisted in the database                      | Yes       | Verify user is stored in the database after registration                     |
| 1.2.12 | User is redirected to transactions after setup completes             | Yes       | Covered by existing tests: Verify successful registration through "Create New" flow / Verify successful registration through "Import Existing" flow |

### 1.3 Keychain Registration

| #     | Scenario                                                             | Automated | Covered By |
| ----- | -------------------------------------------------------------------- | --------- | ---------- |
| 1.3.1 | "Sign in with Keychain" button is visible when OS keychain available | No        |            |
| 1.3.2 | User can register using OS keychain                                  | No        |            |

---

## 2. Login

### 2.1 Local User Login

| #     | Scenario                                                    | Automated | Covered By                                                       |
| ----- | ----------------------------------------------------------- | --------- | ---------------------------------------------------------------- |
| 2.1.1 | All login page elements are displayed correctly             | Yes       | Verify all essential elements are present on the login page      |
| 2.1.2 | User can sign in with valid credentials                     | Yes       | Verify successful login                                          |
| 2.1.3 | Login fails with invalid email format (error message shown) | Yes       | Verify that login with incorrect email shows an error message    |
| 2.1.4 | Login fails with wrong password (error message shown)       | Yes       | Verify that login with incorrect password shows an error message |
| 2.1.5 | "Keep me logged in" checkbox persists session               | Yes       | Verify "Keep me logged in" checkbox persists session             |
| 2.1.6 | User is redirected to transactions after successful login   | Yes       | Covered by existing test: Verify successful login                |

### 2.2 Account Reset

| #     | Scenario                                          | Automated | Covered By               |
| ----- | ------------------------------------------------- | --------- | ------------------------ |
| 2.2.1 | "Reset account" link is visible on login screen   | Yes       | "Reset account" link is visible on login screen |
| 2.2.2 | Reset data modal appears on click                 | Yes       | Reset data modal appears on click |
| 2.2.3 | User data is cleared after confirming reset       | Yes       | User data is cleared after confirming reset |
| 2.2.4 | User is returned to registration mode after reset | Yes       | User is returned to registration mode after reset |

### 2.3 Organization Login

| #     | Scenario                                              | Automated | Covered By                                                    |
| ----- | ----------------------------------------------------- | --------- | ------------------------------------------------------------- |
| 2.3.1 | Organization login page shows org nickname in heading | Yes as Component Test | shows organization nickname in the sign-in heading            |
| 2.3.2 | User can sign in with valid org credentials           | Yes       | Verify user can switch between personal and organization mode |
| 2.3.3 | Login fails with invalid email format                 | Yes as Component Test | invalid email format keeps the organization login form active |
| 2.3.4 | Login fails with wrong password                       | Yes       | Verify login fails with wrong password                        |
| 2.3.5 | Sign in button is disabled until form is valid        | Yes as Component Test | keeps sign-in disabled until email and password are valid     |
| 2.3.6 | Forgot password modal opens on link click             | Yes as Component Test | opens forgot password modal from link                         |
| 2.3.7 | Success toast is shown after login                    | Yes       | Verify success toast is shown after login                     |

---

## 3. Settings

### 3.1 General Tab

#### 3.1.1 Network Settings

| #       | Scenario                                                                             | Automated | Covered By                                            |
| ------- | ------------------------------------------------------------------------------------ | --------- | ----------------------------------------------------- |
| 3.1.1.1 | All network options are displayed (Mainnet, Testnet, Previewnet, Local-Node, Custom) | Yes as Component Test | renders network options and switches between common networks |
| 3.1.1.2 | User can switch to Testnet                                                           | Yes as Component Test | renders network options and switches between common networks |
| 3.1.1.3 | User can switch to Previewnet                                                        | Yes as Component Test | renders network options and switches between common networks |
| 3.1.1.4 | User can switch to Local-Node                                                        | Yes as Component Test | renders network options and switches between common networks |
| 3.1.1.5 | User can switch to Custom and enter mirror node base URL                             | Yes       | Verify user can switch to Custom and enter mirror node base URL |

#### 3.1.2 Appearance Settings

| #       | Scenario                                       | Automated | Covered By                                            |
| ------- | ---------------------------------------------- | --------- | ----------------------------------------------------- |
| 3.1.2.1 | Appearance options are displayed (Light, Dark) | Yes as Component Test | renders appearance options and toggles selected theme |
| 3.1.2.2 | User can switch to Dark theme                  | Yes       | Verify user can switch between Dark and Light themes  |
| 3.1.2.3 | User can switch to Light theme                 | Yes       | Verify user can switch between Dark and Light themes  |

#### 3.1.3 Default Settings

| #       | Scenario                                                      | Automated | Covered By                            |
| ------- | ------------------------------------------------------------- | --------- | ------------------------------------- |
| 3.1.3.1 | Max transaction fee can be set and persists                   | Yes as Component Test | updates stored max transaction fee |
| 3.1.3.2 | Max transaction fee is reflected on transaction creation form | Yes       | Verify user can set global max tx fee |
| 3.1.3.3 | Default organization can be selected from dropdown            | Yes       | Verify default organization can be selected from dropdown |
| 3.1.3.4 | Date/time display format preference can be changed            | Yes as Component Test | selects date and time display format |

#### 3.1.4 App Info

| #       | Scenario                      | Automated | Covered By |
| ------- | ----------------------------- | --------- | ---------- |
| 3.1.4.1 | App version info is displayed | Yes as Component Test | shows app version returned by Electron API |

### 3.2 Keys Tab

| #      | Scenario                                                                                       | Automated | Covered By                                                             |
| ------ | ---------------------------------------------------------------------------------------------- | --------- | ---------------------------------------------------------------------- |
| 3.2.1  | Keys table displays all user keys (Index, Nickname, Account ID, Type, Public Key, Private Key) | Yes       | Verify that all elements in settings page are present                  |
| 3.2.2  | User can filter keys by: All, Recovery Phrase, Private Key tabs                                | Yes       | Verify user can filter keys by All, Recovery Phrase, and Private Key  |
| 3.2.3  | User can decrypt and view private key via eye icon (password required)                         | Yes       | Verify user can decrypt private key                                    |
| 3.2.4  | User can copy public key to clipboard                                                          | Yes       | Verify user can copy public key to clipboard                           |
| 3.2.5  | User can copy private key to clipboard                                                         | Yes       | Verify user can copy private key to clipboard                          |
| 3.2.6  | User can edit key nickname                                                                     | Yes       | Verify user can change key nickname                                    |
| 3.2.7  | User can delete a single key pair                                                              | Yes       | Verify user can delete key                                             |
| 3.2.8  | Key row count decreases after deletion                                                         | Yes       | Verify user can delete key                                             |
| 3.2.9  | User can select multiple keys and bulk delete                                                  | Yes       | Verify user can select multiple keys and bulk delete                   |
| 3.2.10 | User can generate a new key from recovery phrase (index + nickname flow)                       | Yes       | Verify user can restore key                                            |
| 3.2.11 | Generated key pair is persisted in the database                                                | Yes       | Verify user restored key pair is saved in the local database           |
| 3.2.12 | User can import ECDSA private key with nickname                                                | Yes       | Verify user can import ECDSA key                                       |
| 3.2.13 | User can import ED25519 private key with nickname                                              | Yes       | Verify user can import ED25519 keys                                    |
| 3.2.14 | Imported key shows correct key type                                                            | Yes       | Verify user can import ECDSA key / Verify user can import ED25519 keys |
| 3.2.15 | User can import encrypted private key                                                          | No        |                                                                        |
| 3.2.16 | Missing keys (org only) show restore button                                                    | Yes       | Verify user can restore missing keys when doing account recovery       |
| 3.2.17 | User can restore missing key from recovery phrase                                              | Yes       | Verify user can restore missing keys when doing account recovery       |
| 3.2.18 | User can import external private key for missing key                                           | No        |                                                                        |
| 3.2.19 | Importing a private key that already exists in key store shows `Key pair already exists` error | Yes       | Verify duplicate private key import shows an error                     |
| 3.2.20 | Importing a private key that doesn't match the expected public key shows error                 | N/A       | Not reachable via UI — the renderer error path lives in `ImportExternalPrivateKeyModal.vue:62`, which is only opened from `KeysTab.handleRestoreMissingKey` when `keyPair.index === undefined`. The org backend stores `UserKey.index` as `nullable: true`, so external missing keys come back over the wire as `index: null`, and the renderer's strict `!== undefined` check sends them to `RESTORE_MISSING_KEYS` (mnemonic flow) instead of the import modal |
| 3.2.21 | Wrong app password when viewing private key shows `Failed to decrypt private key` error        | Yes       | Verify wrong app password blocks private key decryption                |

### 3.3 Public Keys Tab

| #     | Scenario                                                                        | Automated | Covered By |
| ----- | ------------------------------------------------------------------------------- | --------- | ---------- |
| 3.3.1 | Public keys table displays Nickname, Public Key, and Owner                      | Yes       | Verify user can manage public key mappings (import, rename, copy, delete) |
| 3.3.2 | User can add a new public key mapping                                           | Yes       | Verify user can manage public key mappings (import, rename, copy, delete) |
| 3.3.3 | User can rename a public key mapping                                            | Yes       | Verify user can manage public key mappings (import, rename, copy, delete) |
| 3.3.4 | User can copy a public key to clipboard                                         | Yes       | Verify user can manage public key mappings (import, rename, copy, delete) |
| 3.3.5 | User can delete a single public key mapping                                     | Yes       | Verify user can manage public key mappings (import, rename, copy, delete) |
| 3.3.6 | User can select multiple and bulk delete public key mappings                    | Yes       | Verify user can manage public key mappings (import, rename, copy, delete) |
| 3.3.7 | Import button is disabled when public key field or nickname field is empty      | Yes       | Verify user can manage public key mappings (import, rename, copy, delete) |
| 3.3.8 | Submitting an invalid public key string shows `Invalid public key!` error toast | Yes       | Verify user can manage public key mappings (import, rename, copy, delete) |

### 3.4 Organizations Tab

| #      | Scenario                                                                            | Automated | Covered By                                                    |
| ------ | ----------------------------------------------------------------------------------- | --------- | ------------------------------------------------------------- |
| 3.4.1  | Empty state shows "There are no connected organizations" message                    | Yes as Component Test | shows organizations empty state when no organizations are connected |
| 3.4.2  | User can add a new organization via modal                                           | Yes       | Setup (organizationSettingsTests beforeAll)                   |
| 3.4.3  | Error message when adding non-existing organization URL                             | Yes       | Verify error message when user adds non-existing organization |
| 3.4.4  | Organization table shows: Nickname, Server URL, Status, Version Info                | Yes       | Verify organizations table headers and seeded row are rendered |
| 3.4.5  | Status badge shows connected/disconnected/upgradeRequired                           | Yes       | Verify status badge text for each connection state            |
| 3.4.6  | Version info shows Update Required/Update Available/Current badges                  | Yes       | Verify version info badge text for each version state         |
| 3.4.7  | User can edit organization nickname                                                 | Yes       | Verify user can edit organization nickname                    |
| 3.4.8  | User can delete an organization connection                                          | Yes       | Verify user can delete an organization                        |
| 3.4.9  | Organization deletion is verified in the database                                   | Yes       | Verify user can delete an organization                        |
| 3.4.10 | User can switch between personal and organization mode                              | Yes       | Verify user can switch between personal and organization mode |
| 3.4.11 | Saving a blank org nickname shows `Nickname cannot be empty` error                  | Yes       | Verify user can edit organization nickname                    |
| 3.4.12 | Editing org nickname to an already-used name shows `Nickname already exists` error  | Yes       | Verify user can edit organization nickname                    |
| 3.4.13 | Entering a malformed URL in Add Organization modal shows `Invalid Server URL` error | Yes       | Verify organizations empty state and invalid server URL validation |

### 3.5 Profile Tab

| #      | Scenario                                                                         | Automated | Covered By                                      |
| ------ | -------------------------------------------------------------------------------- | --------- | ----------------------------------------------- |
| 3.5.1  | Change password form is displayed for email/password users                       | Yes as Component Test | renders password form for email/password users |
| 3.5.2  | User can change password with valid current and new passwords                    | Yes       | Verify user can change password |
| 3.5.3  | Password change confirmation modal appears                                       | Yes as Component Test | opens confirmation modal when password form is valid |
| 3.5.4  | Success modal appears after password change                                      | Yes       | Verify user can change password                    |
| 3.5.5  | User can log in with new password after change                                   | Yes       | Verify user can change password |
| 3.5.6  | New password must be >= 10 characters (validation)                               | Yes as Component Test | keeps change password disabled for weak new password |
| 3.5.7  | Organization user can change org password                                        | Yes       | Verify organization user can change password    |
| 3.5.8  | Keychain user sees reset application form instead of password change             | No        |                                                 |
| 3.5.9  | User can log out (personal mode)                                                 | Yes       | Verify logout redirects user to sign-in screen  |
| 3.5.10 | User can log out (organization mode)                                             | Yes       | Verify organization login form is visible after logout |
| 3.5.11 | Logout redirects to login                                                        | Yes       | Verify logout redirects user to sign-in screen  |
| 3.5.12 | Change Password button is disabled when new password fails strength requirements | Yes as Component Test | keeps change password disabled for weak new password |
| 3.5.13 | Inline `Invalid password` error appears under new password field on blur         | Yes as Component Test | shows invalid password inline message on blur |
| 3.5.14 | `Failed to change password` error toast when current password is wrong           | Yes       | Verify wrong current password shows error when changing password |

### 3.6 Notifications Tab (Organization Only)

| #     | Scenario                                                      | Automated | Covered By |
| ----- | ------------------------------------------------------------- | --------- | ---------- |
| 3.6.1 | Notifications tab only shown when logged into an organization | Yes       | Verify user can switch between personal and organization mode |
| 3.6.2 | Transaction Threshold Reached toggle works                    | Yes       | Verify Ready to Execute toggle persists state change          |
| 3.6.3 | Required Signature toggle works                               | Yes       | Verify Signature Required toggle persists state change        |
| 3.6.4 | Transaction Cancelled toggle works                            | Yes       | Verify Cancelled toggle persists state change                 |

### 3.7 Account Recovery (Organization)

| #     | Scenario                                                             | Automated | Covered By                                                                                      |
| ----- | -------------------------------------------------------------------- | --------- | ----------------------------------------------------------------------------------------------- |
| 3.7.1 | User is prompted for mnemonic when resetting organization            | Yes       | Verify user is prompted for mnemonic phrase and can recover account when resetting organization |
| 3.7.2 | Additional keys are saved when user restores account                 | Yes       | Verify additional keys are saved when user restores his account                                 |
| 3.7.3 | User can restore missing keys during account recovery                | Yes       | Verify user can restore missing keys when doing account recovery                                |
| 3.7.4 | User can restore account with a new mnemonic phrase                  | Yes       | Verify user can restore account with new mnemonic phrase                                        |
| 3.7.5 | Old key is preserved and new key added after restore with new phrase | Yes       | Verify user can restore account with new mnemonic phrase                                        |

---

## 4. Transactions List

### 4.1 Personal Mode

| #     | Scenario                                                              | Automated | Covered By |
| ----- | --------------------------------------------------------------------- | --------- | ---------- |
| 4.1.1 | Transactions page shows Drafts and History tabs                       | Yes as Component Test | shows personal transaction tabs and Create New dropdown options |
| 4.1.2 | "Create New" dropdown shows Transaction and Transaction Group options | Yes as Component Test | shows personal transaction tabs and Create New dropdown options |
| 4.1.3 | Selecting "Transaction" opens TransactionSelectionModal               | Yes as Component Test | opens transaction selection modal from the Create New menu |
| 4.1.4 | Selecting "Transaction Group" navigates to create-transaction-group   | Yes as Component Test | routes Transaction Group menu item to create-transaction-group |
| 4.1.5 | "Sign Transactions from File" opens file picker                       | Yes as Component Test | opens sign transaction file modal after selecting a transaction file |

### 4.2 Organization Mode

| #     | Scenario                                                                                                           | Automated | Covered By                                                                                                  |
| ----- | ------------------------------------------------------------------------------------------------------------------ | --------- | ----------------------------------------------------------------------------------------------------------- |
| 4.2.1 | Transaction page shows 6 tabs (Drafts, Ready for Review, Ready to Sign, In Progress, Ready for Execution, History) | Yes as Component Test | shows organization transaction tabs and import signatures action in organization mode                       |
| 4.2.2 | Notification badges appear on relevant tabs                                                                        | No        |                                                                                                             |
| 4.2.3 | "Import Signatures from File" option is available (org only)                                                       | Yes as Component Test | shows organization transaction tabs and import signatures action in organization mode                       |
| 4.2.4 | User can import .tx2 (V2) signatures                                                                               | Yes       | Verify user can export and import transaction with 25 signatures for TTv1->TTv2 compatibility               |
| 4.2.5 | User can import .zip (V1) signatures                                                                               | Yes       | Verify user can import superfluous signatures from TTv1 format                                              |
| 4.2.6 | Import fails when user lacks transaction visibility                                                                | Yes       | Verify user cannot import signatures without visibility of transaction from TTv1 format                     |
| 4.2.7 | Import succeeds with superfluous signatures                                                                        | Yes       | Verify user can import superfluous signatures from TTv1 format                                              |

### 4.3 Drafts Tab

| #     | Scenario                                                                             | Automated | Covered By                                                                                         |
| ----- | ------------------------------------------------------------------------------------ | --------- | -------------------------------------------------------------------------------------------------- |
| 4.3.1 | Drafts table shows Date Created, Transaction Type, Description, Is Template, Actions | Yes as Component Test | renders draft table headers, rows, and actions                                                     |
| 4.3.2 | Drafts table is sortable by date, type, description                                  | Yes as Component Test | renders draft table headers, rows, and actions                                                     |
| 4.3.3 | Drafts table is paginated (10 per page)                                              | Yes       | Verify drafts table paginates at 10 items per page                                                 |
| 4.3.4 | User can delete a draft                                                              | Yes       | Verify user can delete a draft transaction                                                         |
| 4.3.5 | User can continue editing a draft                                                    | Yes       | Verify draft transaction contains the saved info for account create tx                             |
| 4.3.6 | "Is Template" checkbox toggles draft template flag                                   | Yes       | Verify draft transaction is visible after we execute the tx and we have template checkbox selected |
| 4.3.7 | Empty state shows EmptyTransactions component                                        | Yes as Component Test | shows EmptyTransactions when no drafts or groups exist |

### 4.4 History Tab (Personal)

| #     | Scenario                                                                  | Automated | Covered By                                                                    |
| ----- | ------------------------------------------------------------------------- | --------- | ----------------------------------------------------------------------------- |
| 4.4.1 | History table shows Tx ID, Type, Description, Status, Created At, Actions | Yes       | Verify account create tx is displayed in history page                         |
| 4.4.2 | Status badge shows green (success) or red (failed)                        | Yes       | Verify account create tx is displayed in history page / Verify history status badge shows danger styling for failed transactions |
| 4.4.3 | History table is sortable                                                 | Yes       | Verify account create tx is displayed in history page                         |
| 4.4.4 | History table is paginated                                                | Yes       | Verify history table paginates at 10 items per page                           |
| 4.4.5 | "Details" button navigates to the transaction details page                | Yes       | Verify transaction details are displayed for account tx                       |
| 4.4.6 | All 8 transaction types appear correctly in history                       | Yes       | Verify account create tx is displayed in history page (+ other history tests) |

### 4.5 Organization Tabs (TransactionNodeTable)

| #     | Scenario                                                         | Automated | Covered By                                                                        |
| ----- | ---------------------------------------------------------------- | --------- | --------------------------------------------------------------------------------- |
| 4.5.1 | Ready for Review tab shows transactions pending approval         | Skipped   | Ready for Review tab shows transactions pending approval                           |
| 4.5.2 | Ready to Sign tab shows transactions needing user's signature    | Yes       | Verify required signers are able to see the transaction in "Ready to Sign" status |
| 4.5.3 | In Progress tab shows transactions still collecting signatures   | Yes       | Verify transaction is shown "In progress" tab after signing                       |
| 4.5.4 | Ready for Execution tab shows transactions ready to execute      | Yes       | Verify transaction is shown "Ready for Execution" and correct stage is displayed  |
| 4.5.5 | History tab shows terminal-state transactions with status filter | Yes       | Verify transaction is shown "History" after it is executed                        |
| 4.5.6 | Inline sign action per row works (SignSingleButton)              | Yes       | Verify the transaction is displayed in the proper status(collecting signatures)   |
| 4.5.7 | Inline sign group action per row works (SignGroupButton)         | Yes       | Verify user can execute group transaction in organization                         |
| 4.5.8 | Filtering by status works on History tab                         | Yes       | Verify organization History filters work for Status and Transaction Type          |
| 4.5.9 | Filtering by transaction type works on History tab               | Yes       | Verify organization History filters work for Status and Transaction Type          |

---

## 5. Transaction Creation

### 5.1 Transaction Selection Modal

| #     | Scenario                                            | Automated | Covered By |
| ----- | --------------------------------------------------- | --------- | ---------- |
| 5.1.1 | Modal displays all available transaction types      | Yes       | Transaction selection modal displays all transaction categories |
| 5.1.2 | Selecting a type navigates to transaction type page | Yes       | Selecting transaction type from modal navigates to type page |

### 5.2 Account Create Transaction

| #      | Scenario                                                                   | Automated | Covered By                                                                                 |
| ------ | -------------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------ |
| 5.2.1  | All Account Create form elements are displayed correctly                   | Yes       | Verify that all elements on account create page are correct                                |
| 5.2.2  | User can create account with single public key                             | Yes       | Verify user can execute create account transaction with single key                         |
| 5.2.3  | User can create account with complex key structure (threshold)             | Yes       | Verify user can execute Account Create tx with complex key                                 |
| 5.2.4  | User can set memo on account creation                                      | Yes       | Verify user can create account with memo                                                   |
| 5.2.5  | User can enable Receiver Sig Required                                      | Yes       | Verify user can create account with receiver sig required                                  |
| 5.2.6  | User can set initial funds                                                 | Yes       | Verify user can create account with initial funds                                          |
| 5.2.7  | User can set max auto associations                                         | Yes       | Verify user can create account with max account associations                               |
| 5.2.8  | User can set transaction description                                       | Yes       | Verify confirm transaction modal is displayed with valid information for Account Create tx |
| 5.2.9  | Confirm modal shows correct transaction information                        | Yes       | Verify confirm transaction modal is displayed with valid information for Account Create tx |
| 5.2.10 | Transaction is executed successfully and verified via Mirror Node          | Yes       | Verify user can execute create account transaction with single key                         |
| 5.2.11 | User can save account create as draft                                      | Yes       | Verify user can save draft and is visible in the draft page                                |
| 5.2.12 | Draft preserves all fields (memo, receiver sig, initial funds, etc.)       | Yes       | Verify draft transaction contains the saved info for account create tx                     |
| 5.2.13 | User can load and continue a saved draft                                   | Yes       | Verify draft transaction contains the saved info for account create tx                     |
| 5.2.14 | Sign button is disabled when no owner key is selected                      | Yes       | Verify sign button is disabled when no owner key is selected                               |
| 5.2.15 | Invalid format in Staked Account ID field blocks the sign button           | Yes       | Verify account create staking validation blocks signing and initial balance resets when exceeding payer balance |
| 5.2.16 | Initial balance auto-resets to 0 when it exceeds payer's available balance | Yes       | Verify account create staking validation blocks signing and initial balance resets when exceeding payer balance |

### 5.3 Account Update Transaction

| #     | Scenario                                                                     | Automated | Covered By                                                                                                 |
| ----- | ---------------------------------------------------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------- |
| 5.3.1 | Account ID field is pre-filled when navigating from account card             | Yes       | Verify clicking on "Edit" and "Update" navigates the user on update account tx page with prefilled account |
| 5.3.2 | User can update account memo                                                 | Yes       | Verify that account is updated after we execute an account update tx                                       |
| 5.3.3 | User can update max auto associations                                        | Yes       | Verify that account is updated after we execute an account update tx                                       |
| 5.3.4 | User can update account key                                                  | Yes       | Verify that account is updated after we execute an account update tx                                       |
| 5.3.5 | Transaction executes and result verified via Mirror Node                     | Yes       | Verify that account is updated after we execute an account update tx                                       |
| 5.3.6 | User can save account update as draft                                        | Yes       | Verify draft transaction contains the saved info for account update tx                                     |
| 5.3.7 | Draft preserves all update fields                                            | Yes       | Verify draft transaction contains the saved info for account update tx                                     |
| 5.3.8 | Sign button is disabled when no account ID is entered                        | Yes       | Verify sign button is disabled when no account ID is entered                                                 |
| 5.3.9 | Malformed Account ID blocks signing                                          | Yes       | Malformed account ID disables signing on account update                                                   |

### 5.4 Account Delete Transaction

| #      | Scenario                                                                                       | Automated | Covered By                                                                                                 |
| ------ | ---------------------------------------------------------------------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------- |
| 5.4.1  | Account ID field is pre-filled when navigating from account card                               | Yes       | Verify clicking on "Edit" and "Delete" navigates the user on update account tx page with prefilled account |
| 5.4.2  | Transfer account ID field is available for remaining funds                                     | Yes       | Verify user can execute account delete tx                                                                  |
| 5.4.3  | Confirm delete modal appears                                                                   | Yes       | Verify user can execute account delete tx                                                                  |
| 5.4.4  | Transaction executes and account is deleted on network                                         | Yes       | Verify user can execute account delete tx                                                                  |
| 5.4.5  | Deleted account card shows "Account is deleted" warning                                        | Yes       | Verify transaction details are displayed for account delete tx                                             |
| 5.4.6  | Account is removed from local DB after deletion                                                | Yes       | Verify account is deleted from the db after account delete tx                                              |
| 5.4.7  | User can save account delete as draft                                                          | Yes       | Verify draft transaction contains the saved info for account delete tx                                     |
| 5.4.8  | `Account is already deleted!` inline warning shown when entered account ID resolves to deleted | Yes       | Account delete validation blocks submit for deleted accounts and malformed transfer account IDs           |
| 5.4.9  | Invalid Transfer Account ID blocks submit                                                     | Yes       | Account delete validation blocks submit for deleted accounts and malformed transfer account IDs           |
| 5.4.10 | Submit button blocked when account to delete or transfer-to account is already deleted         | Yes       | Account delete validation blocks submit for deleted accounts and malformed transfer account IDs           |

### 5.5 Transfer HBAR Transaction

| #      | Scenario                                                                                  | Automated | Covered By                                                                                             |
| ------ | ----------------------------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------ |
| 5.5.1  | User can fill in "from" account ID (auto-populated from first account)                    | Yes       | Verify user can execute transfer tokens tx                                                             |
| 5.5.2  | User can fill in "to" account ID                                                          | Yes       | Verify user can execute transfer tokens tx                                                             |
| 5.5.3  | User can set transfer amounts for from and to accounts                                    | Yes       | Verify user can execute transfer tokens tx                                                             |
| 5.5.4  | "Add Rest" button auto-calculates remaining amount                                        | Yes       | Verify user can add the rest of remaining hbars to receiver accounts                                   |
| 5.5.5  | Sign button is disabled when amounts don't balance                                        | Yes       | Verify sign button is disabled when receiver amount is higher than payer amount when doing transfer tx |
| 5.5.6  | Transaction executes successfully                                                         | Yes       | Verify user can execute transfer tokens tx                                                             |
| 5.5.7  | `The balance difference must be 0` error shown when from/to amounts do not sum to zero    | Yes       | Verify Sign button is disabled when from/to amounts do not sum to zero                                 |
| 5.5.8  | `Total balance adjustments must not exceed 10` error when more than 10 accounts are added | Yes       | Verify Add Transfer buttons are disabled when 10 adjustments are already added                         |
| 5.5.9  | `Total balance adjustments must be greater than 0` error when no transfers are added      | Yes       | Verify Sign button is disabled when no transfers are added                                             |
| 5.5.10 | Insufficient balance inline error shown per sender row when amount exceeds balance        | Yes       | Verify Insufficient balance error is shown when transfer amount exceeds balance                        |
| 5.5.11 | Add Transfer button is disabled when 10 adjustments are already added                     | Yes       | Verify Add Transfer buttons are disabled when 10 adjustments are already added                         |

### 5.6 Approve HBAR Allowance Transaction

| #     | Scenario                                                                | Automated | Covered By                                                                |
| ----- | ----------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------- |
| 5.6.1 | Owner account field is auto-populated                                   | Yes       | Verify user can execute approve allowance tx                              |
| 5.6.2 | User can set spender account and amount                                 | Yes       | Verify user can execute approve allowance tx                              |
| 5.6.3 | Transaction executes and is verified in DB                              | Yes       | Verify user can execute approve allowance tx                              |
| 5.6.4 | User can save allowance as draft                                        | Yes       | Verify draft transaction contains the saved info for approve allowance tx |
| 5.6.5 | `Invalid Owner ID` error shown when owner account has no resolvable key | Yes       | Verify Sign button is disabled when Owner ID has no resolvable key        |
| 5.6.6 | `Invalid Spender ID` error shown when spender account ID is invalid     | Yes       | Verify Sign button is disabled when Spender ID is invalid                 |

### 5.7 File Create Transaction

| #     | Scenario                                                                        | Automated | Covered By                                                          |
| ----- | ------------------------------------------------------------------------------- | --------- | ------------------------------------------------------------------- |
| 5.7.1 | All File Create form elements are displayed correctly                           | Yes       | Verify all elements are present on file create tx page              |
| 5.7.2 | User can enter file content                                                     | Yes       | Verify user can execute file create tx                              |
| 5.7.3 | User can set file memo                                                          | Yes       | Verify user can execute file create tx                              |
| 5.7.4 | Transaction executes and file is created on network                             | Yes       | Verify user can execute file create tx                              |
| 5.7.5 | File ID is returned and file exists in DB                                       | Yes       | Verify file is stored in the db after file create tx                |
| 5.7.6 | User can save file create as draft                                              | Yes       | Verify draft transaction contains the saved info for create file tx |
| 5.7.7 | Sign button disabled and `Key is required` error shown when no owner key is set | Yes       | Verify File Create Sign button is disabled when owner key is not set |

### 5.8 File Update Transaction

| #     | Scenario                                                                             | Automated | Covered By                                                              |
| ----- | ------------------------------------------------------------------------------------ | --------- | ----------------------------------------------------------------------- |
| 5.8.1 | File ID field is pre-filled when navigating from file card                           | Yes       | Verify file card update flow leads to update page with prefilled fileid |
| 5.8.2 | User can enter new file content                                                      | Yes       | Verify user can execute file update tx                                  |
| 5.8.3 | Transaction executes and file content is updated                                     | Yes       | Verify user can execute file update tx                                  |
| 5.8.4 | Updated content verified via Mirror Node and local cache                             | Yes       | Verify user can execute file update tx                                  |
| 5.8.5 | User can save file update as draft                                                   | Yes       | Verify draft transaction contains the saved info for update file tx     |
| 5.8.6 | `Invalid File ID` error shown when File ID field contains a malformed format         | Yes       | Verify File Update shows Invalid File ID error when file ID is malformed |
| 5.8.7 | `Signature key is required` error in personal mode when no signature key is selected | Yes       | Verify File Update Sign button is disabled when signature key is not set |

### 5.9 File Append Transaction

| #     | Scenario                                                                             | Automated | Covered By                                                              |
| ----- | ------------------------------------------------------------------------------------ | --------- | ----------------------------------------------------------------------- |
| 5.9.1 | File ID field is pre-filled when navigating from file card                           | Yes       | Verify file card append flow leads to append page with prefilled fileid |
| 5.9.2 | User can enter content to append                                                     | Yes       | Verify user can execute file append tx                                  |
| 5.9.3 | Transaction executes and content is appended                                         | Yes       | Verify user can execute file append tx                                  |
| 5.9.4 | Appended content verified via Mirror Node and local cache                            | Yes       | Verify user can execute file append tx                                  |
| 5.9.5 | User can save file append as draft                                                   | Yes       | Verify draft transaction contains the saved info for append file tx     |
| 5.9.6 | `Invalid File ID` error shown when File ID field contains a malformed format         | Yes       | Verify File Append shows Invalid File ID error when file ID is malformed |
| 5.9.7 | `Signature key is required` error in personal mode when no signature key is selected | Yes       | Verify File Append Sign button is disabled when signature key is not set |

### 5.10 File Read (Contents) Transaction

| #      | Scenario                                                                                                                | Automated | Covered By                           |
| ------ | ----------------------------------------------------------------------------------------------------------------------- | --------- | ------------------------------------ |
| 5.10.1 | User can enter a file ID to read                                                                                        | Yes       | Verify user can execute file read tx |
| 5.10.2 | File content is displayed in textarea                                                                                   | Yes       | Verify user can execute file read tx |
| 5.10.3 | Content matches what was previously written to the file                                                                 | Yes       | Verify user can execute file read tx |
| 5.10.4 | `Unable to execute query, you should use a payer ID with one of your keys` error when payer's key is not in local store | N/A       | Not reachable via UI — the Payer ID `AccountIdsSelect` dropdown is populated from `flattenAccountIds(user.publicKeyToAccounts)`, and `publicKeyToAccounts` is rebuilt from `user.keyPairs` (`storeUser.refetchAccounts`), so every selectable option always has a matching local KeyPair |

### 5.11 System File Transactions

| #      | Scenario                                                            | Automated | Covered By                                                                                       |
| ------ | ------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------ |
| 5.11.1 | User can update a system file (e.g., fee schedules, exchange rates) | Yes       | Verify that system account can be updated without account key using a superUser as the fee payer |
| 5.11.2 | System file update with superuser (0.0.100) as fee payer            | Yes       | Verify that system account can be updated without account key using a superUser as the fee payer |
| 5.11.3 | System Delete transaction                                           | No        |                                                                                                  |
| 5.11.4 | System Undelete transaction                                         | No        |                                                                                                  |

### 5.12 Node Transactions

| #      | Scenario                                  | Automated | Covered By |
| ------ | ----------------------------------------- | --------- | ---------- |
| 5.12.1 | User can create a Freeze transaction      | No        |            |
| 5.12.2 | User can create a Node Create transaction | No        |            |
| 5.12.3 | User can create a Node Update transaction | No        |            |
| 5.12.4 | User can create a Node Delete transaction | No        |            |

### 5.13 Complex Key Structure

| #      | Scenario                                                                                               | Automated | Covered By                                                                                   |
| ------ | ------------------------------------------------------------------------------------------------------ | --------- | -------------------------------------------------------------------------------------------- |
| 5.13.1 | User can add public keys at various depths                                                             | Yes       | Verify user can execute Account Create tx with complex key                                   |
| 5.13.2 | User can add threshold keys at various depths                                                          | Yes       | Verify user can execute Account Create tx with complex key                                   |
| 5.13.3 | User can add account-based keys at various depths                                                      | No        |                                                                                              |
| 5.13.4 | Complex key structure is correctly encoded in transaction                                              | Yes       | Verify user can execute Account Create tx with complex key                                   |
| 5.13.5 | Nested threshold keys work for council-scale accounts                                                  | Skipped   | Verify user can execute update account tx for complex key account similar to council account |
| 5.13.6 | Adding a duplicate public key at the same threshold level shows `already exists in the key list` error | Yes       | Verify adding a duplicate public key at the same threshold level shows error toast           |

### 5.14 Transaction Common Fields

| #      | Scenario                                                                                                                          | Automated | Covered By                                                                                 |
| ------ | --------------------------------------------------------------------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------ |
| 5.14.1 | Max transaction fee field is pre-filled with default                                                                              | Yes       | Verify user can set global max tx fee                                                      |
| 5.14.2 | User can override max transaction fee                                                                                             | Yes       | Verify user can set global max tx fee                                                      |
| 5.14.3 | Payer account ID can be specified                                                                                                 | Yes       | Verify user can execute create account transaction with single key                         |
| 5.14.4 | Transaction memo field accepts input                                                                                              | Yes       | Verify user can create account with memo                                                   |
| 5.14.5 | Description field accepts input                                                                                                   | Yes       | Verify confirm transaction modal is displayed with valid information for Account Create tx |
| 5.14.6 | `Invalid Payer ID` error shown when payer account ID is invalid on submit                                                         | Yes       | Verify Sign button is disabled when Payer ID is invalid                                    |
| 5.14.7 | Transaction memo exceeding 100 characters shows `Transaction Memo is limited to 100 characters` toast and marks the field invalid | Yes       | Verify memo exceeding 100 characters shows error toast and marks field invalid             |
| 5.14.8 | `Max Transaction Fee is required` error shown when fee is set to 0                                                                | Yes       | Verify Sign button is disabled when Max Transaction Fee is 0                               |

---

## 6. Transaction Details

### 6.1 Transaction Detail View (Personal)

| #     | Scenario                                       | Automated | Covered By                                              |
| ----- | ---------------------------------------------- | --------- | ------------------------------------------------------- |
| 6.1.1 | Transaction ID is displayed with Hashscan link | Yes       | Verify transaction details are displayed for account tx |
| 6.1.2 | Transaction type is displayed correctly        | Yes       | Verify transaction details are displayed for account tx |
| 6.1.3 | Valid start date/time is displayed             | Yes       | Verify transaction details are displayed for account tx |
| 6.1.4 | Payer account with nickname is shown           | Yes       | Verify transaction details are displayed for account tx |
| 6.1.5 | Fee payer is shown                             | Yes       | Verify transaction details are displayed for account tx |
| 6.1.6 | Transaction memo is displayed                  | Yes       | Verify transaction details are displayed for account tx |
| 6.1.7 | Description is displayed                       | Yes       | Verify transaction details are displayed for account tx |
| 6.1.8 | Created at timestamp is displayed              | Yes       | Verify transaction details are displayed for account tx |
| 6.1.9 | Executed at timestamp is displayed             | Yes       | Verify transaction details are displayed for account tx |

### 6.2 Type-Specific Details

| #     | Scenario                                                                                | Automated | Covered By                                                                   |
| ----- | --------------------------------------------------------------------------------------- | --------- | ---------------------------------------------------------------------------- |
| 6.2.1 | Account Create: shows key, memo, staking, accept rewards, receiver sig, initial balance | Yes       | Verify transaction details are displayed for account tx                      |
| 6.2.2 | Account Update: shows account ID being updated                                          | Yes       | Verify transaction details are displayed for account update tx               |
| 6.2.3 | Account Delete: shows deleted account ID and transfer account ID                        | Yes       | Verify account delete tx is displayed in history page                        |
| 6.2.4 | Transfer: shows from/to accounts and amounts                                            | Yes       | Verify transaction details are displayed for transfer tx                     |
| 6.2.5 | Allowance: shows owner, spender, and amount                                             | Yes       | Verify transaction details are displayed for approve allowance tx            |
| 6.2.6 | File Create: shows file ID and expiration                                               | Yes       | Verify transaction details are displayed for file create tx                  |
| 6.2.7 | File Update/Append: shows file ID                                                       | Yes       | Verify transaction details are displayed for file update tx / file append tx |
| 6.2.8 | "View Contents" button visible for file transactions                                    | Yes       | Verify transaction details are displayed for file create tx                  |
| 6.2.9 | "See Key Details" link opens KeyStructureModal for complex keys                         | Yes       | Verify user can execute Account Create tx with complex key                   |

### 6.3 Organization Transaction Details

| #     | Scenario                                                      | Automated | Covered By                                                                       |
| ----- | ------------------------------------------------------------- | --------- | -------------------------------------------------------------------------------- |
| 6.3.1 | Status stepper shows workflow progress                        | Yes       | Verify transaction is shown "Ready for Execution" and correct stage is displayed |
| 6.3.2 | Stage completion indicator for each workflow step             | Yes       | Verify transaction is shown "Ready for Execution" and correct stage is displayed |
| 6.3.3 | Signer checkmark appears after signing                        | Yes       | Verify user is shown as signed by participants                                   |
| 6.3.4 | Signature status panel shows required vs completed signatures | No        |                                                                                  |
| 6.3.5 | Approvers list is shown for org transactions                  | No        |                                                                                  |
| 6.3.6 | User can sign the transaction from detail view                | Yes       | Verify the transaction is displayed in the proper status(collecting signatures)  |
| 6.3.7 | User can cancel a transaction (creator only)                  | Yes       | Verify creator can cancel an in-progress transaction                             |
| 6.3.8 | "Next transaction" button navigates to next in list           | Yes       | Verify next button is visible when user has multiple txs to sign                 |

---

## 7. Transaction Groups

### 7.1 Group Creation (Personal)

| #      | Scenario                                                                                             | Automated | Covered By                                                   |
| ------ | ---------------------------------------------------------------------------------------------------- | --------- | ------------------------------------------------------------ |
| 7.1.1  | Group creation page elements are displayed correctly                                                 | Yes       | Verify group transaction elements                            |
| 7.1.2  | User can add a single transaction to the group                                                       | Yes       | Verify user can add transaction to the group                 |
| 7.1.3  | User can add multiple transactions to the group                                                      | Yes       | Verify user can duplicate transaction in the group           |
| 7.1.4  | User can add mixed transaction types (account create + file create)                                  | Yes       | Verify user can execute different transactions in a group    |
| 7.1.5  | User can set group description                                                                       | Yes       | Verify description is mandatory for saving group transaction |
| 7.1.6  | User can set payer account for the group                                                             | No        |                                                              |
| 7.1.7  | Valid start time picker works with running clock                                                     | No        |                                                              |
| 7.1.8  | Empty state shows prompt to add transactions                                                         | Yes as Component Test | shows empty group state and disables Sign and Submit when no transactions exist |
| 7.1.9  | Saving a transaction group with no description shows `Please enter a group description` error        | Yes as Component Test | throws save validation when group description is blank |
| 7.1.10 | Clicking "Sign and Submit" with empty description shows `Group Description Required` error toast     | Yes as Component Test | shows validation toast when submitting with blank group description |
| 7.1.11 | Saving a group with zero transactions shows `Please add at least one transaction to the group` error | Yes as Component Test | throws save validation when a group has zero transactions |
| 7.1.12 | Sign and Submit button is disabled when the group contains no transactions                           | Yes as Component Test | shows empty group state and disables Sign and Submit when no transactions exist |

### 7.2 Group Editing

| #     | Scenario                                                                      | Automated | Covered By                                                   |
| ----- | ----------------------------------------------------------------------------- | --------- | ------------------------------------------------------------ |
| 7.2.1 | User can delete a transaction from the group                                  | Yes       | Verify user can delete transaction from the group            |
| 7.2.2 | User can duplicate a transaction in the group                                 | Yes       | Verify user can duplicate transaction in the group           |
| 7.2.3 | User can edit a transaction in the group                                      | Yes       | Verify user can edit transaction in the group                |
| 7.2.4 | User can delete all transactions at once                                      | Yes       | Verify user can delete many transactions at once(delete all) |
| 7.2.5 | Delete group without saving navigates away                                    | Yes       | Verify delete group action does not save the group           |
| 7.2.6 | Continue editing navigation guard modal works                                 | Yes       | Verify continue editing action saves the group               |
| 7.2.7 | Cancelling the "Delete All" confirmation modal leaves all transactions intact | Yes       | Verify cancelling "Delete All" keeps all transactions in the group |

### 7.3 Group Saving and Execution (Personal)

| #     | Scenario                                                   | Automated | Covered By                                                                   |
| ----- | ---------------------------------------------------------- | --------- | ---------------------------------------------------------------------------- |
| 7.3.1 | User can save group as draft                               | Yes       | Verify user can save a transaction group                                     |
| 7.3.2 | User can execute a single-transaction group                | Yes       | Verify user can execute group transaction                                    |
| 7.3.3 | User can execute duplicated group transactions (3 of same) | Yes       | Verify user can execute duplicated group transactions                        |
| 7.3.4 | User can execute mixed group (account + file)              | Yes       | Verify user can execute different transactions in a group                    |
| 7.3.5 | Group and items are persisted in database                  | Yes       | Verify transaction and linked group items and transaction group exists in db |

### 7.4 Group CSV Import (Organization)

| #     | Scenario                                                       | Automated | Covered By                                                         |
| ----- | -------------------------------------------------------------- | --------- | ------------------------------------------------------------------ |
| 7.4.1 | User can import CSV with 5 transactions                        | Yes       | Verify user can import csv with 5 transactions                     |
| 7.4.2 | User can import CSV with 100 transactions                      | Yes       | Verify user can import csv with 100 transactions                   |
| 7.4.3 | All imported transactions execute and verified via Mirror Node | Yes       | Verify user can import csv with 100 transactions                   |
| 7.4.4 | Import fails with error for non-existent sender account        | Yes       | Verify import fails if sender account does not exist on network    |
| 7.4.5 | Import fails with error for non-existent fee payer account     | Yes       | Verify import fails if fee payer account does not exist on network |
| 7.4.6 | Import fails with error for non-existent receiver account      | Yes       | Verify import fails if receiver account does not exist on network  |

### 7.5 Group Execution (Organization)

| #     | Scenario                                                | Automated | Covered By                                                |
| ----- | ------------------------------------------------------- | --------- | --------------------------------------------------------- |
| 7.5.1 | User can execute org group transaction (all users sign) | Yes       | Verify user can execute group transaction in organization |
| 7.5.2 | User can cancel all items in a transaction group        | Yes       | Verify user can cancel all items in a transaction group   |
| 7.5.3 | Sign All button signs all transactions in group         | Yes       | Verify user can execute group transaction in organization |
| 7.5.4 | Cancel All button cancels entire group                  | Yes       | Verify user can cancel all items in a transaction group   |
| 7.5.5 | Export group as .tx2 (V2 format)                        | No        |                                                           |

### 7.6 Group Details View

| #     | Scenario                                                 | Automated | Covered By                                                |
| ----- | -------------------------------------------------------- | --------- | --------------------------------------------------------- |
| 7.6.1 | Group details show list of transactions                  | Yes       | Verify user can execute group transaction in organization |
| 7.6.2 | User can navigate between transactions in the group      | No        |                                                           |
| 7.6.3 | User can sign individual transactions from group details | Yes       | Verify user can execute group transaction in organization |
| 7.6.4 | Approval decision state is displayed (org admin)         | No        |                                                           |

---

## 8. Accounts

### 8.1 Account List

| #     | Scenario                                             | Automated | Covered By                                                                          |
| ----- | ---------------------------------------------------- | --------- | ----------------------------------------------------------------------------------- |
| 8.1.1 | Account list is displayed in left panel              | Yes       | Verify account card is visible with valid information                               |
| 8.1.2 | User can sort accounts by Account ID (asc/desc)      | Yes as Component Test | sort menu refetches accounts with selected sort order                               |
| 8.1.3 | User can sort accounts by Nickname (A-Z / Z-A)       | Yes as Component Test | sort menu refetches accounts with selected sort order                               |
| 8.1.4 | User can sort accounts by Date Added (asc/desc)      | Yes as Component Test | sort menu refetches accounts with selected sort order                               |
| 8.1.5 | "Add New" dropdown shows Create New and Add Existing | Yes as Component Test | renders accounts, add-new routes, and account details                              |
| 8.1.6 | "Create New" navigates to Account Create transaction | Yes as Component Test | renders accounts, add-new routes, and account details                              |
| 8.1.7 | "Add Existing" navigates to /accounts/link-existing  | Yes       | Verify user can add an existing account                                             |
| 8.1.8 | Select mode enables multi-select checkboxes          | Yes as Component Test | select mode shows checkboxes and opens unlink modal for selected accounts           |
| 8.1.9 | Bulk remove works in select mode                     | Yes       | Verify user can unlink accounts                                                     |

### 8.2 Account Details Panel

| #      | Scenario                                                       | Automated | Covered By                                            |
| ------ | -------------------------------------------------------------- | --------- | ----------------------------------------------------- |
| 8.2.1  | Account ID with checksum and Hashscan link displayed           | Yes       | Verify account card is visible with valid information |
| 8.2.2  | EVM Address displayed                                          | Yes       | Verify account card is visible with valid information |
| 8.2.3  | Balance in HBAR + USD equivalent displayed                     | Yes       | Verify account card is visible with valid information |
| 8.2.4  | Key (simple PublicKey) displayed                               | Yes       | Verify account card is visible with valid information |
| 8.2.5  | Complex key shows "See details" link opening KeyStructureModal | Yes as Component Test | shows complex key details and deleted account warning |
| 8.2.6  | Receiver Sig Required field displayed                          | Yes       | Verify account card is visible with valid information |
| 8.2.7  | Memo field displayed                                           | Yes       | Verify account card is visible with valid information |
| 8.2.8  | Max Auto Association field displayed                           | Yes       | Verify account card is visible with valid information |
| 8.2.9  | Ethereum Nonce displayed                                       | Yes       | Verify account card is visible with valid information |
| 8.2.10 | Created At / Expires At / Auto Renew Period displayed          | Yes       | Verify account card is visible with valid information |
| 8.2.11 | Staked To / Pending Reward / Rewards displayed                 | Yes       | Verify account card is visible with valid information |
| 8.2.12 | "Account is deleted" warning shown for deleted accounts        | Yes       | Verify transaction details are displayed for account delete tx |
| 8.2.13 | Nickname is editable inline (double-click or pencil icon)      | Yes as Component Test | edits selected account nickname on blur |

### 8.3 Account Actions

| Check | #     | Scenario                                                          | Automated | Covered By                                                                                                 |
| ----- | ----- | ----------------------------------------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------- |
|       | 8.3.1 | Edit dropdown shows "Delete from Network" and "Update in Network" | Yes       | Verify clicking on "Edit" and "Update" navigates the user on update account tx page with prefilled account |
|       | 8.3.2 | "Delete from Network" navigates to Account Delete transaction     | Yes       | Verify clicking on "Edit" and "Delete" navigates the user on update account tx page with prefilled account |
|       | 8.3.3 | "Update in Network" navigates to Account Update transaction       | Yes       | Verify clicking on "Edit" and "Update" navigates the user on update account tx page with prefilled account |
|       | 8.3.4 | Remove (unlink) opens confirmation modal                          | Yes as Component Test | routes account edit actions and opens remove confirmation                                                   |
|       | 8.3.5 | Account is removed from list after unlinking                      | Yes       | Verify user can unlink accounts                                                                            |

### 8.4 Link Existing Account

| #     | Scenario                                                                                                   | Automated | Covered By                              |
| ----- | ---------------------------------------------------------------------------------------------------------- | --------- | --------------------------------------- |
| 8.4.1 | Account ID input with checksum validation                                                                  | Yes as Component Test | renders account id and nickname inputs with disabled link button until account is valid |
| 8.4.2 | Invalid checksum shows error toast                                                                         | Yes as Component Test | shows invalid checksum toast and does not link account |
| 8.4.3 | Nickname input is available                                                                                | Yes as Component Test | renders account id and nickname inputs with disabled link button until account is valid |
| 8.4.4 | "Link Account" navigates to /accounts on success                                                           | Yes       | Verify user can add an existing account |
| 8.4.5 | Linked account appears in account list                                                                     | Yes       | Verify user can add an existing account |
| 8.4.6 | Link Account button is disabled until entered account ID resolves as valid                                 | Yes as Component Test | renders account id and nickname inputs with disabled link button until account is valid |
| 8.4.7 | `Account link failed` error toast when attempting to link an already-linked account                        | Yes       | Verify duplicate account link shows error toast |
| 8.4.8 | "Account already linked" label shown on transaction details when created account is already in local store | Yes       | Verify transaction details are displayed for account tx |

---

## 9. Files

### 9.1 File List

| #     | Scenario                                                            | Automated | Covered By                                         |
| ----- | ------------------------------------------------------------------- | --------- | -------------------------------------------------- |
| 9.1.1 | File list is displayed in left panel                                | Yes       | Verify file card is visible with valid information |
| 9.1.2 | User can sort files by File ID (asc/desc)                           | Yes as Component Test | sort menu refetches files with selected sort order |
| 9.1.3 | User can sort files by Nickname (A-Z / Z-A)                         | Yes as Component Test | sort menu refetches files with selected sort order |
| 9.1.4 | User can sort files by Date Added (asc/desc)                        | Yes as Component Test | sort menu refetches files with selected sort order |
| 9.1.5 | "Add New" dropdown shows Create, Update, Append, Read, Add Existing | Yes as Component Test | renders files, add-new routes, and file details |
| 9.1.6 | Select mode enables multi-select checkboxes                         | Yes as Component Test | select mode shows checkboxes and opens unlink modal for selected files |
| 9.1.7 | Bulk unlink works in select mode                                    | Yes       | Verify user can unlink multiple files |

### 9.2 File Details Panel

| #      | Scenario                                                      | Automated | Covered By                                         |
| ------ | ------------------------------------------------------------- | --------- | -------------------------------------------------- |
| 9.2.1  | File ID with checksum displayed                               | Yes       | Verify file card is visible with valid information |
| 9.2.2  | File size displayed                                           | Yes       | Verify file card is visible with valid information |
| 9.2.3  | Key (simple or complex with "See details") displayed          | Yes       | Verify file card is visible with valid information |
| 9.2.4  | Memo displayed                                                | Yes       | Verify file card is visible with valid information |
| 9.2.5  | Ledger ID displayed                                           | Yes       | Verify file card is visible with valid information |
| 9.2.6  | Expiration date displayed                                     | Yes       | Verify file card is visible with valid information |
| 9.2.7  | Description is editable (textarea, double-click or pencil)    | Yes       | Verify file card is visible with valid information |
| 9.2.8  | File content is displayed or "View" button opens in temp file | Yes       | Verify user can execute file read tx |
| 9.2.9  | "File is deleted" warning shown for deleted files             | Yes       | Verify file card is visible with valid information |
| 9.2.10 | Last Viewed timestamp displayed                               | Yes       | Verify user can execute file read tx |
| 9.2.11 | Nickname is editable inline                                   | Yes       | Verify file card is visible with valid information |

### 9.3 File Actions

| #     | Scenario                                           | Automated | Covered By |
| ----- | -------------------------------------------------- | --------- | ---------- |
| 9.3.1 | Update button navigates to File Update transaction | Yes       | Verify file card update flow leads to update page with prefilled fileid |
| 9.3.2 | Append button navigates to File Append transaction | Yes       | Verify file card append flow leads to append page with prefilled fileid |
| 9.3.3 | Read button navigates to File Read transaction     | Yes       | Verify file card read flow leads to read page with prefilled fileid |
| 9.3.4 | Remove (unlink) opens confirmation modal           | Yes as Component Test | routes file actions and opens remove confirmation |
| 9.3.5 | File is removed from list after unlinking          | Yes       | Verify user can unlink multiple files |

### 9.4 Link Existing File

| #     | Scenario                                                                                             | Automated | Covered By |
| ----- | ---------------------------------------------------------------------------------------------------- | --------- | ---------- |
| 9.4.1 | File ID input validates format                                                                       | Yes as Component Test | renders file id, nickname, and description fields with disabled button for invalid file id |
| 9.4.2 | Nickname input is available                                                                          | Yes as Component Test | renders file id, nickname, and description fields with disabled button for invalid file id |
| 9.4.3 | Linked file appears in file list                                                                     | Yes       | Verify user can add an existing file to files card |
| 9.4.4 | Link File button is disabled when entered file ID format is invalid                                  | Yes as Component Test | renders file id, nickname, and description fields with disabled button for invalid file id |
| 9.4.5 | `File link failed` error toast when attempting to link an already-linked file                        | Yes       | Verify duplicate file link shows error toast |
| 9.4.6 | "File already linked" label shown on transaction details when created file is already in local store | Yes       | Verify transaction details are displayed for file create tx |

---

## 10. Contact List (Organization Only)

### 10.1 Contact List View

| #      | Scenario                                                        | Automated | Covered By                                         |
| ------ | --------------------------------------------------------------- | --------- | -------------------------------------------------- |
| 10.1.1 | Empty state shows "No contacts found" message                   | Yes as Component Test | shows the empty contacts message when the contacts store has no contacts |
| 10.1.2 | Admin sees all contacts; non-admin sees only contacts with keys | Yes as Component Test | filters contacts without keys for non-admin users / shows admin-only add button and all contacts for admins |
| 10.1.3 | Contact email is displayed                                      | Yes as Component Test | renders contact email and public keys |
| 10.1.4 | Contact public keys are displayed                               | Yes as Component Test | renders contact email and public keys |
| 10.1.5 | Associated accounts are displayed                               | Yes       | Verify associated accounts are displayed           |
| 10.1.6 | Associated accounts verified against Mirror Node                | Yes       | Verify associated accounts are displayed           |
| 10.1.7 | New user indicator dot shown on contact list items              | Yes as Component Test | shows registered, admin, and update-available indicators |

### 10.2 Admin Actions

| #       | Scenario                                                                                   | Automated | Covered By                                                            |
| ------- | ------------------------------------------------------------------------------------------ | --------- | --------------------------------------------------------------------- |
| 10.2.1  | "Remove" button is visible for admin role                                                  | Yes as Component Test | shows admin contact actions only for organization admins               |
| 10.2.2  | "Remove" button is NOT visible for regular role                                            | Yes as Component Test | shows admin contact actions only for organization admins               |
| 10.2.3  | "Add New" button is enabled for admin role                                                 | Yes as Component Test | shows admin-only add button and all contacts for admins                |
| 10.2.4  | "Add New" button is NOT visible for regular role                                           | Yes as Component Test | filters contacts without keys for non-admin users                      |
| 10.2.5  | Admin can add a new user to the organization                                               | Yes       | Verify admin user can add new user to the organization                |
| 10.2.6  | Admin can add multiple users via comma-separated emails                                    | Yes       | Verify admin bulk user registration supports comma-separated emails and error states |
| 10.2.7  | Invalid email shows error toast during user creation                                       | Yes       | Verify adding user with invalid email shows error                     |
| 10.2.8  | Admin can remove a user from the organization                                              | Yes       | Verify admin user can remove user from the organization               |
| 10.2.9  | Delete contact modal appears on remove click                                               | Yes       | Verify admin user can remove user from the organization               |
| 10.2.10 | Admin can elevate a user to admin role                                                     | Yes       | Verify admin can elevate a user to admin role                         |
| 10.2.11 | Elevate contact modal appears on click                                                     | Yes       | Verify admin can elevate a user to admin role                         |
| 10.2.12 | Bulk add fails with `Invalid emails: <list>` error when any email address is malformed     | Yes       | Verify admin bulk user registration supports comma-separated emails and error states |
| 10.2.13 | Partial bulk add shows `Failed to sign up users with emails: <list>` error toast           | Yes       | Verify admin bulk user registration supports comma-separated emails and error states |
| 10.2.14 | Adding an email already on org server shows `Failed to sign up user` error toast           | Yes       | Verify admin bulk user registration supports comma-separated emails and error states |
| 10.2.15 | Adding a duplicate approver to a transaction shows `User already exists in the list` error | Skipped   | Verify adding a duplicate approver to a transaction shows `User already exists in the list` error |

### 10.3 Contact Details

| #      | Scenario                         | Automated | Covered By                      |
| ------ | -------------------------------- | --------- | ------------------------------- |
| 10.3.1 | User can change contact nickname | Yes       | Verify user can change nickname |

---

## 11. Organization Transaction Workflows

### 11.1 Multi-User Signing Workflow

| #      | Scenario                                                                       | Automated | Covered By                                                                       |
| ------ | ------------------------------------------------------------------------------ | --------- | -------------------------------------------------------------------------------- |
| 11.1.1 | Transaction moves from Ready to Sign -> In Progress after first signature      | Yes       | Verify transaction is shown "In progress" tab after signing                      |
| 11.1.2 | Transaction moves from In Progress -> Ready for Execution after all signatures | Yes       | Verify transaction is shown "Ready for Execution" and correct stage is displayed |
| 11.1.3 | Transaction moves to History (Executed) after execution                        | Yes       | Verify transaction is shown "History" after it is executed                       |
| 11.1.4 | Transaction status stepper shows correct stage at each step                    | Yes       | Verify transaction is shown "Ready for Execution" and correct stage is displayed |
| 11.1.5 | Second signer checkmark visible after both users sign                          | Yes       | Verify user is shown as signed by participants                                   |
| 11.1.6 | Transaction visibility restricted to signers/observers                         | Yes       | Verify transaction is not visible if user is not an observer                     |

### 11.2 Observer Role

| #      | Scenario                                                | Automated | Covered By                                                                               |
| ------ | ------------------------------------------------------- | --------- | ---------------------------------------------------------------------------------------- |
| 11.2.1 | Observer can see transaction in In Progress tab         | Yes       | Verify transaction is visible for an observer while transaction is "In progress"         |
| 11.2.2 | Observer can see transaction in Ready for Execution tab | Yes       | Verify transaction is visible for an observer while transaction is "Ready for execution" |
| 11.2.3 | Non-observer cannot see the transaction                 | Yes       | Verify transaction is not visible if user is not an observer                             |
| 11.2.4 | Observer email is displayed in transaction details      | Yes       | Verify observer is listed in the transaction details                                     |
| 11.2.5 | Multiple observers can be added per transaction         | Yes       | Verify user can add multiple observers                                                   |
| 11.2.6 | Observer records persist in database                    | Yes       | Verify observer is saved in the db for the correct transaction id                        |

### 11.3 Organization Account Transactions

| #      | Scenario                                                    | Automated | Covered By                                                        |
| ------ | ----------------------------------------------------------- | --------- | ----------------------------------------------------------------- |
| 11.3.1 | Create account with complex key (3-of-3 threshold) succeeds | Yes       | Verify user can execute Account Create tx with complex key        |
| 11.3.2 | Transfer HBAR with complex key account succeeds             | Yes       | Verify user can execute transfer transaction with complex account |
| 11.3.3 | Approve allowance with complex key account succeeds         | Yes       | Verify user can execute approve allowance with complex account    |
| 11.3.4 | Delete account with complex key succeeds                    | Yes       | Verify user can execute account delete with complex account       |

### 11.4 Organization File Transactions

| #      | Scenario                                      | Automated | Covered By                                               |
| ------ | --------------------------------------------- | --------- | -------------------------------------------------------- |
| 11.4.1 | File create with complex key account succeeds | Yes       | Verify user can execute file create with complex account |
| 11.4.2 | File update with complex key account succeeds | Yes       | Verify user can execute file update with complex account |
| 11.4.3 | File append with complex key account succeeds | Yes       | Verify user can execute file append with complex account |

### 11.5 Signature Import/Export (TTv1 <-> TTv2)

| #      | Scenario                                                         | Automated | Covered By                                                                                                  |
| ------ | ---------------------------------------------------------------- | --------- | ----------------------------------------------------------------------------------------------------------- |
| 11.5.1 | Export .tx file, sign offline with 25 users, zip+import, execute | Yes       | Verify user can export and import transaction with 25 signatures for TTv1->TTv2 compatibility               |
| 11.5.2 | Import superfluous signatures from TTv1 format                   | Yes       | Verify user can import superfluous signatures from TTv1 format                                              |
| 11.5.3 | Import blocked when user lacks transaction visibility            | Yes       | Verify user cannot import signatures without visibility of transaction from TTv1 format                     |

### 11.6 Council-Scale Transactions (Regression)

| #      | Scenario                                         | Automated | Covered By                                                                                   |
| ------ | ------------------------------------------------ | --------- | -------------------------------------------------------------------------------------------- |
| 11.6.1 | Update account with 57-user nested threshold key | Skipped   | Verify user can execute update account tx for complex key account similar to council account |
| 11.6.2 | Transfer with 57-user nested threshold key       | Skipped   | Verify user can execute transfer tx for complex key account similar to council account       |

---

## 12. Notifications (Organization Only)

### 12.1 In-App Notifications

| #      | Scenario                                                          | Automated | Covered By                                                       |
| ------ | ----------------------------------------------------------------- | --------- | ---------------------------------------------------------------- |
| 12.1.1 | Notification indicator visible in organization dropdown           | Skipped   | Verify notification is visible in the organization dropdown      |
| 12.1.2 | Notification saved in DB with isRead=false, isInAppNotified=true  | Skipped   | Verify notification is saved in the db and marked correctly      |
| 12.1.3 | Notification marked isRead=true after viewing transaction details | Skipped   | Verify tab notification is cleared after the transaction is seen |
| 12.1.4 | Tab notification number cleared after viewing                     | Skipped   | Verify tab notification is cleared after the transaction is seen |
| 12.1.5 | Notification icon visible on specific transaction row             | Skipped   | Verify notification element is shown next to the transaction     |
| 12.1.6 | Notification badges on transaction tabs update in real-time       | No        |                                                                  |

### 12.2 Email Notification Preferences

| #      | Scenario                                                    | Automated | Covered By |
| ------ | ----------------------------------------------------------- | --------- | ---------- |
| 12.2.1 | Transaction Threshold Reached email preference toggle works | Yes       | Verify Ready to Execute toggle persists state change          |
| 12.2.2 | Required Signature email preference toggle works            | Yes       | Verify Signature Required toggle persists state change        |
| 12.2.3 | Transaction Cancelled email preference toggle works         | Yes       | Verify Cancelled toggle persists state change                 |
| 12.2.4 | Preference changes are persisted via API immediately        | Yes       | Verify Ready to Execute toggle persists state change          |

---

## 13. Navigation and Layout

### 13.1 Sidebar Navigation

| #      | Scenario                                                     | Automated | Covered By                                                    |
| ------ | ------------------------------------------------------------ | --------- | ------------------------------------------------------------- |
| 13.1.1 | Transactions menu item navigates to /transactions            | Yes       | Verify account create tx is displayed in history page         |
| 13.1.2 | Accounts menu item navigates to /accounts                    | Yes       | Verify account card is visible with valid information         |
| 13.1.3 | Files menu item navigates to /files                          | Yes       | Verify file card is visible with valid information            |
| 13.1.4 | Contact List menu item navigates to /contact-list (org only) | Yes       | Verify contact list menu item navigates to /contact-list      |
| 13.1.5 | Settings menu item navigates to /settings/general            | Yes       | Verify that all elements in settings page are present         |
| 13.1.6 | Contact List hidden when not in organization                 | Yes       | Verify user can switch between personal and organization mode |

### 13.2 Organization Selector

| #      | Scenario                                       | Automated | Covered By                                                    |
| ------ | ---------------------------------------------- | --------- | ------------------------------------------------------------- |
| 13.2.1 | Organization selector shows all connected orgs | Yes       | Verify user can switch between personal and organization mode |
| 13.2.2 | Selecting an org triggers login if required    | Yes       | Verify user can switch between personal and organization mode |
| 13.2.3 | Disconnected org shows disconnect reason       | Yes       | Verify disconnected org shows the upgradeRequired reason note |
| 13.2.4 | Org requiring upgrade blocks selection         | Yes       | Verify org requiring upgrade is blocked from selection        |
| 13.2.5 | Personal mode option is available              | Yes       | Verify user can switch between personal and organization mode |

### 13.3 Route Guards

| #      | Scenario                                                | Automated | Covered By |
| ------ | ------------------------------------------------------- | --------- | ---------- |
| 13.3.3 | Account setup in progress forces user to /account-setup | No        |            |

---

## 14. Error Handling and Edge Cases

### 14.1 Toast Notifications

| #      | Scenario                                       | Automated | Covered By                                                    |
| ------ | ---------------------------------------------- | --------- | ------------------------------------------------------------- |
| 14.1.1 | Success toast appears on successful operations | Yes       | Verify successful registration through "Create New" flow      |
| 14.1.2 | Error toast appears on failed operations       | Yes       | Verify error message when user adds non-existing organization |
| 14.1.3 | Toast auto-dismisses after timeout             | Yes       | Verify user can copy public key to clipboard                  |

### 14.2 Password Modal

| #      | Scenario                                               | Automated | Covered By                          |
| ------ | ------------------------------------------------------ | --------- | ----------------------------------- |
| 14.2.1 | Personal password modal appears when decryption needed | Yes       | Verify user can decrypt private key |
| 14.2.2 | Operation retries after correct password entry         | Yes       | Verify user can decrypt private key |
| 14.2.3 | Operation aborts if password modal is cancelled        | Yes       | Verify decrypt private key flow is aborted when password modal is cancelled |

### 14.3 Loading States

| #      | Scenario                                      | Automated | Covered By |
| ------ | --------------------------------------------- | --------- | ---------- |
| 14.3.1 | Loading spinner shown during long operations  | Yes       | Verify user can switch between personal and organization mode |
| 14.3.2 | Global modal loader for long async operations | Yes       | Verify user can switch between personal and organization mode |

### 14.4 Network/Connection Errors

| #      | Scenario                                                       | Automated | Covered By |
| ------ | -------------------------------------------------------------- | --------- | ---------- |
| 14.4.1 | Graceful handling when organization server is unreachable      | No        |            |
| 14.4.2 | WebSocket reconnection after disconnect                        | No        |            |
| 14.4.3 | Error displayed when Mirror Node is unavailable                | No        |            |
| 14.4.4 | Transaction fails gracefully when Hedera network returns error | No        |            |

### 14.5 Form Validation Edge Cases

| #      | Scenario                                          | Automated | Covered By |
| ------ | ------------------------------------------------- | --------- | ---------- |
| 14.5.1 | Account ID checksum validation on blur            | Yes       | Verify Account ID with invalid checksum shows error toast on link |
| 14.5.2 | File ID format validation                         | Yes       | Verify File Update shows Invalid File ID error when file ID is malformed |
| 14.5.3 | Transaction body exceeding 6144 bytes shows error | Yes (Backend) | Not surfaced via UI — `ValidateRequestHandler.validateBigFile` does throw for org-mode FileCreate over `TRANSACTION_MAX_SIZE - SIZE_BUFFER_BYTES`, but `CheckKeySettingHandler.handle` is synchronous and doesn't `await` `nextHandler.handle`, so the rejection is dropped before `withLoader` can render an error toast. Backend-covered: `back-end/apps/api/test/spec/transaction.e2e-spec.ts:382` (rejects creation with `code: TOS` when transaction body is over the size limit) |
| 14.5.4 | Expired transaction shows appropriate error       | Yes (Backend) | Not reachable via UI — `RunningClockDatePicker` auto-bumps `validStart` to `now` every 1s, so a transaction can never be `> 180s` past its valid start at submit time. Backend-covered: `back-end/apps/api/test/spec/transaction.e2e-spec.ts:314` ("(POST) should not create an expired transaction") |
| 14.5.5 | Duplicate transaction ID shows appropriate error  | Yes (Backend) | Not reachable via UI — every Sign press regenerates `validStart`, so the `transactionId` is always fresh. Backend-covered: `back-end/apps/api/test/spec/transaction.e2e-spec.ts:294` ("(POST) should not create a duplicating transaction") |

---

## 15. Upgrade

### 15.1 Application Update

| #      | Scenario                                                     | Automated | Covered By |
| ------ | ------------------------------------------------------------ | --------- | ---------- |
| 15.1.1 | Update notification is shown when a new version is available | Yes       | Verify Update Available modal shows when a new version is available |
| 15.1.2 | User is blocked from org features when below minimum version | Yes       | Verify org requiring upgrade is blocked from selection              |
| 15.1.3 | Version check badge shows correct status per org             | Yes       | Verify version info badge text for each version state               |

---

## Summary

### Coverage by Area

| Area                            | Total Scenarios | Automated E2E | Automated Component Test | Backend | Skipped | Manual   | N/A     | Coverage % | Coverage % with Skipped |
| ------------------------------- | --------------- | ------------- | ------------------------ | ------- | ------- | -------- | ------- | ---------- | ----------------------- |
| 1. Registration                 | 22              | 14            | 6                        | 0       | 0       | 2        | 0       | 91%        | 91%                     |
| 2. Login                        | 17              | 13            | 4                        | 0       | 0       | 0        | 0       | 100%       | 100%                    |
| 3. Settings                     | 78              | 60            | 14                       | 0       | 0       | 3        | 1       | 95%        | 95%                     |
| 4. Transactions List            | 34              | 22            | 10                       | 0       | 1       | 1        | 0       | 94%        | 97%                     |
| 5. Transaction Creation         | 101             | 92            | 0                        | 0       | 1       | 7        | 1       | 91%        | 92%                     |
| 6. Transaction Details          | 26              | 24            | 0                        | 0       | 0       | 2        | 0       | 92%        | 92%                     |
| 7. Transaction Groups           | 39              | 29            | 5                        | 0       | 0       | 5        | 0       | 87%        | 87%                     |
| 8. Accounts                     | 35              | 22            | 13                       | 0       | 0       | 0        | 0       | 100%       | 100%                    |
| 9. Files                        | 29              | 20            | 9                        | 0       | 0       | 0        | 0       | 100%       | 100%                    |
| 10. Contact List                | 23              | 13            | 9                        | 0       | 1       | 0        | 0       | 96%        | 100%                    |
| 11. Org Transaction Workflows   | 24              | 22            | 0                        | 0       | 2       | 0        | 0       | 92%        | 100%                    |
| 12. Notifications               | 10              | 4             | 0                        | 0       | 5       | 1        | 0       | 40%        | 90%                     |
| 13. Navigation and Layout       | 12              | 11            | 0                        | 0       | 0       | 1        | 0       | 92%        | 92%                     |
| 14. Error Handling / Edge Cases | 17              | 10            | 0                        | 3       | 0       | 4        | 0       | 76%        | 76%                     |
| 15. Upgrade                     | 3               | 3             | 0                        | 0       | 0       | 0        | 0       | 100%       | 100%                    |
| **Total**                       | **470**         | **359**       | **70**                   | **3**   | **10**  | **26**   | **2**   | **92%**    | **94%**                 |

The `Automated Component Test` column counts scenarios covered by frontend renderer/component tests.
The migrated frontend package coverage currently comes from 63 Vitest component test cases across 16 spec files.

Coverage % is calculated as `(Automated E2E + Automated Component Test + Backend) / Total Scenarios`, rounded to the nearest whole percentage.
Skipped, Manual, and N/A scenarios are not counted as covered. For the total row: `(359 + 70 + 3) / 470 = 91.91%`, rounded to `92%`.

Coverage % with Skipped is calculated as `(Automated E2E + Automated Component Test + Backend + Skipped) / Total Scenarios`, rounded to the nearest whole percentage.
Manual and N/A scenarios are not counted as covered. For the total row: `(359 + 70 + 3 + 10) / 470 = 94.04%`, rounded to `94%`.

The `Backend` column counts scenarios that the renderer UI cannot reach (UI guards prevent the state) but that ARE exercised by a backend / API test. *Covered By* on those rows points to the matching backend test path. The `N/A` column is reserved for UI-unreachable scenarios that have no equivalent test at any layer.

### Release Testing Guide

The following sections list every scenario that is **not yet automated** (marked `No`), organized by priority tier. All other scenarios are covered by E2E, component, or backend tests and do not require manual verification on every release.

#### Tier 1 - Release Blockers (Must Pass)

These scenarios are security-critical. A failure in any of these should block the release.

| Area               | Scenario # | Description                                            | Why Critical                                               |
| ------------------ | ---------- | ------------------------------------------------------ |------------------------------------------------------------|
| **Key Management** | 3.2.15     | Import encrypted private key                           | Security-critical key operation with no automated coverage |
| **Key Management** | 3.2.18     | Import external private key for a missing key          | Security-critical key operation with no automated coverage |

#### Tier 2 - High Priority (Should Pass)

These scenarios affect core access paths or org collaboration workflows that users rely on regularly. Failures cause significant user friction.

| Area                        | Scenario # | Description                                                  | Why Important                                                                                  |
| --------------------------- | ---------- | ------------------------------------------------------------ |------------------------------------------------------------------------------------------------|
| **Keychain Auth**           | 1.3.1      | "Sign in with Keychain" button visible when OS keychain available | Users relying on OS keychain cannot register if broken                                    |
| **Keychain Auth**           | 1.3.2      | User can register using OS keychain                          | Users relying on OS keychain cannot register if broken                                         |
| **Profile / Auth**          | 3.5.8      | Keychain user sees reset application form instead of password change | Keychain users see a different profile view; breakage leaves them with no auth option  |
| **Org Transaction List**    | 4.2.2      | Notification badges appear on relevant org transaction tabs  | Missing badges cause org users to miss signing obligations                                     |
| **Org Transaction Details** | 6.3.4      | Signature status panel shows required vs completed signatures | Signers cannot see their outstanding obligations in detail view                               |
| **Org Transaction Details** | 6.3.5      | Approvers list is shown for org transactions                 | Approvers cannot verify who needs to approve the transaction                                   |

#### Tier 3 - Medium Priority (Verify When Changed)

These scenarios cover secondary workflows and infrequently used transaction types. Test when the related feature area has changed.

| Area                     | Scenario #     | Description                                                  | When to Test                                        |
| ------------------------ | -------------- | ------------------------------------------------------------ | --------------------------------------------------- |
| **System Transactions**  | 5.11.3, 5.11.4 | System Delete / System Undelete transactions                 | When system file transaction UI is modified         |
| **Node Transactions**    | 5.12.1–5.12.4  | Freeze, Node Create, Node Update, Node Delete transactions   | When node transaction types are modified            |
| **Complex Key Builder**  | 5.13.3         | User can add account-based keys at various depths            | When the complex key builder UI is modified         |
| **Transaction Groups**   | 7.1.6          | User can set a payer account for the group                   | When group creation form is modified                |
| **Transaction Groups**   | 7.1.7          | Valid start time picker works with running clock             | When the date/time picker is modified               |
| **Group Export**         | 7.5.5          | Export group as .tx2 (V2 format)                             | When signature export format is modified            |
| **Group Details**        | 7.6.2          | User can navigate between transactions in group details      | When group detail view is modified                  |
| **Group Details**        | 7.6.4          | Approval decision state is displayed (org admin)             | When org approval flows are modified                |
| **Notifications**        | 12.1.6         | Notification badges on transaction tabs update in real-time  | When WebSocket or notification system is modified   |

#### Tier 4 - Lower Priority (Periodic Verification)

These scenarios cover edge cases and error handling. Verify periodically or after infrastructure changes.

| Area              | Scenario #     | Description                                                     | When to Test                                       |
| ----------------- | -------------- | --------------------------------------------------------------- |----------------------------------------------------|
| **Route Guards**  | 13.3.3         | Account setup in progress forces user to /account-setup         | After auth flow or routing changes                 |
| **Network Errors** | 14.4.1        | Graceful handling when organization server is unreachable       | After infrastructure or org connectivity changes   |
| **Network Errors** | 14.4.2        | WebSocket reconnection after disconnect                         | After WebSocket or real-time system changes        |
| **Network Errors** | 14.4.3        | Error displayed when Mirror Node is unavailable                 | After Mirror Node integration changes              |
| **Network Errors** | 14.4.4        | Transaction fails gracefully when Hedera network returns error  | After Hedera SDK or transaction submission changes |

### Priority Areas for Additional Automation

1. **Notifications (40%)** - Re-enable or replace skipped in-app notification tests (12.1.1-12.1.5); add real-time notification badge coverage (12.1.6)
2. **Error Handling / Edge Cases (65%)** - Network failures (14.4.1-14.4.4), loading-state coverage. Note: 14.5.4 (expired tx) and 14.5.5 (duplicate tx ID) are not reachable through the renderer UI and are covered at the backend layer.
3. **Transactions List (88%)** - Re-enable Ready for Review tab coverage, org tab notification badges, history table pagination, drafts table sort and pagination
4. **Organization Transaction Workflows (92%)** - Re-enable council-scale (57-user) regression coverage
5. **Contact List (96%)** - Approver duplicate handling (skipped; Approvers feature flag disabled)
