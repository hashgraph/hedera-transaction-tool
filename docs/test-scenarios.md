# UI Test Coverage and Release Checklist

This document enumerates all user-facing scenarios in the Hedera Transaction Tool front-end application. Each scenario is assigned a unique identifier and indicates whether it is currently covered by automated UI (E2E) testing. Scenarios that require manual testing include a checkbox for use during release verification.

**Legend:**

- **Automated**: Yes = covered by Playwright E2E tests in the `automation/` folder; No = manual testing required
- **Covered By**: The actual test name from the automation test files that covers this scenario

---

## 1. Registration

### 1.1 First-Time User Registration

| #     | Scenario                                                         | Automated | Covered By                                               |
| ----- | ---------------------------------------------------------------- | --------- | -------------------------------------------------------- |
| 1.1.1 | All registration page elements are displayed correctly           | Yes       | Verify all elements are present on the registration page |
| 1.1.2 | User can register with valid email and strong password           | Yes       | Verify successful registration through "Create New" flow |
| 1.1.3 | Password strength tooltip shows real-time feedback (>= 10 chars) | No        |                                                          |
| 1.1.4 | Registration fails when passwords do not match                   | No        |                                                          |
| 1.1.5 | Registration fails with invalid email format                     | No        |                                                          |
| 1.1.6 | Registration fails with weak password (< 10 characters)          | No        |                                                          |
| 1.1.7 | Register button is disabled until all validations pass           | No        |                                                          |
| 1.1.8 | "Keep me logged in" checkbox is available during registration    | No        |                                                          |

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
| 1.2.12 | User is redirected to transactions after setup completes             | No        |                                                                              |

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
| 2.1.5 | "Keep me logged in" checkbox persists session               | No        |                                                                  |
| 2.1.6 | User is redirected to transactions after successful login   | No        |                                                                  |

### 2.2 Account Reset

| #     | Scenario                                          | Automated | Covered By               |
| ----- | ------------------------------------------------- | --------- | ------------------------ |
| 2.2.1 | "Reset account" link is visible on login screen   | No        |                          |
| 2.2.2 | Reset data modal appears on click                 | No        |                          |
| 2.2.3 | User data is cleared after confirming reset       | Yes       | Verify resetting account |
| 2.2.4 | User is returned to registration mode after reset | No        |                          |

### 2.3 Organization Login

| #     | Scenario                                              | Automated | Covered By                                                    |
| ----- | ----------------------------------------------------- | --------- | ------------------------------------------------------------- |
| 2.3.1 | Organization login page shows org nickname in heading | No        |                                                               |
| 2.3.2 | User can sign in with valid org credentials           | Yes       | Verify user can switch between personal and organization mode |
| 2.3.3 | Login fails with invalid email format                 | No        |                                                               |
| 2.3.4 | Login fails with wrong password                       | No        |                                                               |
| 2.3.5 | Sign in button is disabled until form is valid        | No        |                                                               |
| 2.3.6 | Forgot password modal opens on link click             | No        |                                                               |
| 2.3.7 | Success toast is shown after login                    | No        |                                                               |

---

## 3. Settings

### 3.1 General Tab

#### 3.1.1 Network Settings

| #       | Scenario                                                                             | Automated | Covered By                                            |
| ------- | ------------------------------------------------------------------------------------ | --------- | ----------------------------------------------------- |
| 3.1.1.1 | All network options are displayed (Mainnet, Testnet, Previewnet, Local-Node, Custom) | Yes       | Verify that all elements in settings page are present |
| 3.1.1.2 | User can switch to Testnet                                                           | Yes       | Verify that all elements in settings page are present |
| 3.1.1.3 | User can switch to Previewnet                                                        | Yes       | Verify that all elements in settings page are present |
| 3.1.1.4 | User can switch to Local-Node                                                        | Yes       | Verify that all elements in settings page are present |
| 3.1.1.5 | User can switch to Custom and enter mirror node base URL                             | No        |                                                       |

#### 3.1.2 Appearance Settings

| #       | Scenario                                       | Automated | Covered By                                            |
| ------- | ---------------------------------------------- | --------- | ----------------------------------------------------- |
| 3.1.2.1 | Appearance options are displayed (Light, Dark) | Yes       | Verify that all elements in settings page are present |
| 3.1.2.2 | User can switch to Dark theme                  | No        |                                                       |
| 3.1.2.3 | User can switch to Light theme                 | No        |                                                       |

#### 3.1.3 Default Settings

| #       | Scenario                                                      | Automated | Covered By                            |
| ------- | ------------------------------------------------------------- | --------- | ------------------------------------- |
| 3.1.3.1 | Max transaction fee can be set and persists                   | Yes       | Verify user can set global max tx fee |
| 3.1.3.2 | Max transaction fee is reflected on transaction creation form | Yes       | Verify user can set global max tx fee |
| 3.1.3.3 | Default organization can be selected from dropdown            | No        |                                       |
| 3.1.3.4 | Date/time display format preference can be changed            | No        |                                       |

#### 3.1.4 App Info

| #       | Scenario                      | Automated | Covered By |
| ------- | ----------------------------- | --------- | ---------- |
| 3.1.4.1 | App version info is displayed | No        |            |

### 3.2 Keys Tab

| #      | Scenario                                                                                       | Automated | Covered By                                                             |
| ------ | ---------------------------------------------------------------------------------------------- | --------- | ---------------------------------------------------------------------- |
| 3.2.1  | Keys table displays all user keys (Index, Nickname, Account ID, Type, Public Key, Private Key) | Yes       | Verify that all elements in settings page are present                  |
| 3.2.2  | User can filter keys by: All, Recovery Phrase, Private Key tabs                                | No        |                                                                        |
| 3.2.3  | User can decrypt and view private key via eye icon (password required)                         | Yes       | Verify user can decrypt private key                                    |
| 3.2.4  | User can copy public key to clipboard                                                          | No        |                                                                        |
| 3.2.5  | User can copy private key to clipboard                                                         | No        |                                                                        |
| 3.2.6  | User can edit key nickname                                                                     | Yes       | Verify user can change key nickname                                    |
| 3.2.7  | User can delete a single key pair                                                              | Yes       | Verify user can delete key                                             |
| 3.2.8  | Key row count decreases after deletion                                                         | Yes       | Verify user can delete key                                             |
| 3.2.9  | User can select multiple keys and bulk delete                                                  | No        |                                                                        |
| 3.2.10 | User can generate a new key from recovery phrase (index + nickname flow)                       | Yes       | Verify user can restore key                                            |
| 3.2.11 | Generated key pair is persisted in the database                                                | Yes       | Verify user restored key pair is saved in the local database           |
| 3.2.12 | User can import ECDSA private key with nickname                                                | Yes       | Verify user can import ECDSA key                                       |
| 3.2.13 | User can import ED25519 private key with nickname                                              | Yes       | Verify user can import ED25519 keys                                    |
| 3.2.14 | Imported key shows correct key type                                                            | Yes       | Verify user can import ECDSA key / Verify user can import ED25519 keys |
| 3.2.15 | User can import encrypted private key                                                          | No        |                                                                        |
| 3.2.16 | Missing keys (org only) show restore button                                                    | Yes       | Verify user can restore missing keys when doing account recovery       |
| 3.2.17 | User can restore missing key from recovery phrase                                              | Yes       | Verify user can restore missing keys when doing account recovery       |
| 3.2.18 | User can import external private key for missing key                                           | No        |                                                                        |
| 3.2.19 | Importing a private key that already exists in key store shows `Key pair already exists` error | No        |                                                                        |
| 3.2.20 | Importing a private key that doesn't match the expected public key shows error                 | No        |                                                                        |
| 3.2.21 | Wrong app password when viewing private key shows `Failed to decrypt private key` error        | No        |                                                                        |

### 3.3 Public Keys Tab

| #     | Scenario                                                                        | Automated | Covered By |
| ----- | ------------------------------------------------------------------------------- | --------- | ---------- |
| 3.3.1 | Public keys table displays Nickname, Public Key, and Owner                      | No        |            |
| 3.3.2 | User can add a new public key mapping                                           | No        |            |
| 3.3.3 | User can rename a public key mapping                                            | No        |            |
| 3.3.4 | User can copy a public key to clipboard                                         | No        |            |
| 3.3.5 | User can delete a single public key mapping                                     | No        |            |
| 3.3.6 | User can select multiple and bulk delete public key mappings                    | No        |            |
| 3.3.7 | Import button is disabled when public key field or nickname field is empty      | No        |            |
| 3.3.8 | Submitting an invalid public key string shows `Invalid public key!` error toast | No        |            |

### 3.4 Organizations Tab

| #      | Scenario                                                                            | Automated | Covered By                                                    |
| ------ | ----------------------------------------------------------------------------------- | --------- | ------------------------------------------------------------- |
| 3.4.1  | Empty state shows "There are no connected organizations" message                    | No        |                                                               |
| 3.4.2  | User can add a new organization via modal                                           | Yes       | Setup (organizationSettingsTests beforeAll)                   |
| 3.4.3  | Error message when adding non-existing organization URL                             | Yes       | Verify error message when user adds non-existing organization |
| 3.4.4  | Organization table shows: Nickname, Server URL, Status, Version Info                | No        |                                                               |
| 3.4.5  | Status badge shows connected/disconnected/upgradeRequired                           | No        |                                                               |
| 3.4.6  | Version info shows Update Required/Update Available/Current badges                  | No        |                                                               |
| 3.4.7  | User can edit organization nickname                                                 | Yes       | Verify user can edit organization nickname                    |
| 3.4.8  | User can delete an organization connection                                          | Yes       | Verify user can delete an organization                        |
| 3.4.9  | Organization deletion is verified in the database                                   | Yes       | Verify user can delete an organization                        |
| 3.4.10 | User can switch between personal and organization mode                              | Yes       | Verify user can switch between personal and organization mode |
| 3.4.11 | Saving a blank org nickname shows `Nickname cannot be empty` error                  | No        |                                                               |
| 3.4.12 | Editing org nickname to an already-used name shows `Nickname already exists` error  | No        |                                                               |
| 3.4.13 | Entering a malformed URL in Add Organization modal shows `Invalid Server URL` error | No        |                                                               |

### 3.5 Profile Tab

| #      | Scenario                                                                         | Automated | Covered By                                      |
| ------ | -------------------------------------------------------------------------------- | --------- | ----------------------------------------------- |
| 3.5.1  | Change password form is displayed for email/password users                       | Yes       | Verify user can change password (settingsTests) |
| 3.5.2  | User can change password with valid current and new passwords                    | Yes       | Verify user can change password (settingsTests) |
| 3.5.3  | Password change confirmation modal appears                                       | No        |                                                 |
| 3.5.4  | Success modal appears after password change                                      | No        |                                                 |
| 3.5.5  | User can log in with new password after change                                   | Yes       | Verify user can change password (settingsTests) |
| 3.5.6  | New password must be >= 10 characters (validation)                               | No        |                                                 |
| 3.5.7  | Organization user can change org password                                        | Yes       | Verify organization user can change password    |
| 3.5.8  | Keychain user sees reset application form instead of password change             | No        |                                                 |
| 3.5.9  | User can log out (personal mode)                                                 | Yes       | afterAll (settingsTests / loginTests)           |
| 3.5.10 | User can log out (organization mode)                                             | No        |                                                 |
| 3.5.11 | Logout redirects to login                                                        | No        |                                                 |
| 3.5.12 | Change Password button is disabled when new password fails strength requirements | No        |                                                 |
| 3.5.13 | Inline `Invalid password` error appears under new password field on blur         | No        |                                                 |
| 3.5.14 | `Failed to change password` error toast when current password is wrong           | No        |                                                 |

### 3.6 Notifications Tab (Organization Only)

| #     | Scenario                                                      | Automated | Covered By |
| ----- | ------------------------------------------------------------- | --------- | ---------- |
| 3.6.1 | Notifications tab only shown when logged into an organization | No        |            |
| 3.6.2 | Transaction Threshold Reached toggle works                    | No        |            |
| 3.6.3 | Required Signature toggle works                               | No        |            |
| 3.6.4 | Transaction Cancelled toggle works                            | No        |            |

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
| 4.1.1 | Transactions page shows Drafts and History tabs                       | No        |            |
| 4.1.2 | "Create New" dropdown shows Transaction and Transaction Group options | No        |            |
| 4.1.3 | Selecting "Transaction" opens TransactionSelectionModal               | No        |            |
| 4.1.4 | Selecting "Transaction Group" navigates to create-transaction-group   | No        |            |
| 4.1.5 | "Sign Transactions from File" opens file picker                       | No        |            |

### 4.2 Organization Mode

| #     | Scenario                                                                                                           | Automated | Covered By                                                                                                  |
| ----- | ------------------------------------------------------------------------------------------------------------------ | --------- | ----------------------------------------------------------------------------------------------------------- |
| 4.2.1 | Transaction page shows 6 tabs (Drafts, Ready for Review, Ready to Sign, In Progress, Ready for Execution, History) | Yes       | Verify that tabs on Transaction page are visible                                                            |
| 4.2.2 | Notification badges appear on relevant tabs                                                                        | No        |                                                                                                             |
| 4.2.3 | "Import Signatures from File" option is available (org only)                                                       | No        |                                                                                                             |
| 4.2.4 | User can import .tx2 (V2) signatures                                                                               | Yes       | Verify user can export and import transaction and a large number of signatures for TTv1->TTv2 compatibility |
| 4.2.5 | User can import .zip (V1) signatures                                                                               | Yes       | Verify user can import superfluous signatures from TTv1 format                                              |
| 4.2.6 | Import fails when user lacks transaction visibility                                                                | Yes       | Verify user cannot import signatures without visibility of transaction from TTv1 format                     |
| 4.2.7 | Import succeeds with superfluous signatures                                                                        | Yes       | Verify user can import superfluous signatures from TTv1 format                                              |

### 4.3 Drafts Tab

| #     | Scenario                                                                             | Automated | Covered By                                                                                         |
| ----- | ------------------------------------------------------------------------------------ | --------- | -------------------------------------------------------------------------------------------------- |
| 4.3.1 | Drafts table shows Date Created, Transaction Type, Description, Is Template, Actions | No        |                                                                                                    |
| 4.3.2 | Drafts table is sortable by date, type, description                                  | No        |                                                                                                    |
| 4.3.3 | Drafts table is paginated (10 per page)                                              | No        |                                                                                                    |
| 4.3.4 | User can delete a draft                                                              | Yes       | Verify user can delete a draft transaction                                                         |
| 4.3.5 | User can continue editing a draft                                                    | Yes       | Verify draft transaction contains the saved info for account create tx                             |
| 4.3.6 | "Is Template" checkbox toggles draft template flag                                   | Yes       | Verify draft transaction is visible after we execute the tx and we have template checkbox selected |
| 4.3.7 | Empty state shows EmptyTransactions component                                        | No        |                                                                                                    |

### 4.4 History Tab (Personal)

| #     | Scenario                                                                  | Automated | Covered By                                                                    |
| ----- | ------------------------------------------------------------------------- | --------- | ----------------------------------------------------------------------------- |
| 4.4.1 | History table shows Tx ID, Type, Description, Status, Created At, Actions | No        |                                                                               |
| 4.4.2 | Status badge shows green (success) or red (failed)                        | No        |                                                                               |
| 4.4.3 | History table is sortable                                                 | No        |                                                                               |
| 4.4.4 | History table is paginated                                                | No        |                                                                               |
| 4.4.5 | "Details" button navigates to the transaction details page                | No        |                                                                               |
| 4.4.6 | All 8 transaction types appear correctly in history                       | Yes       | Verify account create tx is displayed in history page (+ other history tests) |

### 4.5 Organization Tabs (TransactionNodeTable)

| #     | Scenario                                                         | Automated | Covered By                                                                        |
| ----- | ---------------------------------------------------------------- | --------- | --------------------------------------------------------------------------------- |
| 4.5.1 | Ready for Review tab shows transactions pending approval         | No        |                                                                                   |
| 4.5.2 | Ready to Sign tab shows transactions needing user's signature    | Yes       | Verify required signers are able to see the transaction in "Ready to Sign" status |
| 4.5.3 | In Progress tab shows transactions still collecting signatures   | Yes       | Verify transaction is shown "In progress" tab after signing                       |
| 4.5.4 | Ready for Execution tab shows transactions ready to execute      | Yes       | Verify transaction is shown "Ready for Execution" and correct stage is displayed  |
| 4.5.5 | History tab shows terminal-state transactions with status filter | Yes       | Verify transaction is shown "History" after it is executed                        |
| 4.5.6 | Inline sign action per row works (SignSingleButton)              | Yes       | Verify the transaction is displayed in the proper status(collecting signatures)   |
| 4.5.7 | Inline sign group action per row works (SignGroupButton)         | Yes       | Verify user can execute group transaction in organization                         |
| 4.5.8 | Filtering by status works on History tab                         | No        |                                                                                   |
| 4.5.9 | Filtering by transaction type works on History tab               | No        |                                                                                   |

---

## 5. Transaction Creation

### 5.1 Transaction Selection Modal

| #     | Scenario                                            | Automated | Covered By |
| ----- | --------------------------------------------------- | --------- | ---------- |
| 5.1.1 | Modal displays all available transaction types      | No        |            |
| 5.1.2 | Selecting a type navigates to transaction type page | No        |            |

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
| 5.2.14 | Sign button is disabled when no owner key is selected                      | No        |                                                                                            |
| 5.2.15 | Invalid format in Staked Account ID field blocks the sign button           | No        |                                                                                            |
| 5.2.16 | Initial balance auto-resets to 0 when it exceeds payer's available balance | No        |                                                                                            |

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
| 5.3.8 | Sign button is disabled when no account ID is entered                        | No        |                                                                                                            |
| 5.3.9 | `Invalid Account ID` error shown when submitting with a malformed account ID | No        |                                                                                                            |

### 5.4 Account Delete Transaction

| #      | Scenario                                                                                       | Automated | Covered By                                                                                                 |
| ------ | ---------------------------------------------------------------------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------- |
| 5.4.1  | Account ID field is pre-filled when navigating from account card                               | Yes       | Verify clicking on "Edit" and "Delete" navigates the user on update account tx page with prefilled account |
| 5.4.2  | Transfer account ID field is available for remaining funds                                     | Yes       | Verify user can execute account delete tx                                                                  |
| 5.4.3  | Confirm delete modal appears                                                                   | Yes       | Verify user can execute account delete tx                                                                  |
| 5.4.4  | Transaction executes and account is deleted on network                                         | Yes       | Verify user can execute account delete tx                                                                  |
| 5.4.5  | Deleted account card shows "Account is deleted" warning                                        | No        |                                                                                                            |
| 5.4.6  | Account is removed from local DB after deletion                                                | Yes       | Verify account is deleted from the db after account delete tx                                              |
| 5.4.7  | User can save account delete as draft                                                          | Yes       | Verify draft transaction contains the saved info for account delete tx                                     |
| 5.4.8  | `Account is already deleted!` inline warning shown when entered account ID resolves to deleted | No        |                                                                                                            |
| 5.4.9  | `Invalid Transfer Account ID` error shown when transfer-to account is empty or invalid         | No        |                                                                                                            |
| 5.4.10 | Submit button blocked when account to delete or transfer-to account is already deleted         | No        |                                                                                                            |

### 5.5 Transfer HBAR Transaction

| #      | Scenario                                                                                  | Automated | Covered By                                                                                             |
| ------ | ----------------------------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------ |
| 5.5.1  | User can fill in "from" account ID (auto-populated from first account)                    | Yes       | Verify user can execute transfer tokens tx                                                             |
| 5.5.2  | User can fill in "to" account ID                                                          | Yes       | Verify user can execute transfer tokens tx                                                             |
| 5.5.3  | User can set transfer amounts for from and to accounts                                    | Yes       | Verify user can execute transfer tokens tx                                                             |
| 5.5.4  | "Add Rest" button auto-calculates remaining amount                                        | Yes       | Verify user can add the rest of remaining hbars to receiver accounts                                   |
| 5.5.5  | Sign button is disabled when amounts don't balance                                        | Yes       | Verify sign button is disabled when receiver amount is higher than payer amount when doing transfer tx |
| 5.5.6  | Transaction executes successfully                                                         | Yes       | Verify user can execute transfer tokens tx                                                             |
| 5.5.7  | `The balance difference must be 0` error shown when from/to amounts do not sum to zero    | No        |                                                                                                        |
| 5.5.8  | `Total balance adjustments must not exceed 10` error when more than 10 accounts are added | No        |                                                                                                        |
| 5.5.9  | `Total balance adjustments must be greater than 0` error when no transfers are added      | No        |                                                                                                        |
| 5.5.10 | Insufficient balance inline error shown per sender row when amount exceeds balance        | No        |                                                                                                        |
| 5.5.11 | Add Transfer button is disabled when 10 adjustments are already added                     | No        |                                                                                                        |

### 5.6 Approve HBAR Allowance Transaction

| #     | Scenario                                                                | Automated | Covered By                                                                |
| ----- | ----------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------- |
| 5.6.1 | Owner account field is auto-populated                                   | Yes       | Verify user can execute approve allowance tx                              |
| 5.6.2 | User can set spender account and amount                                 | Yes       | Verify user can execute approve allowance tx                              |
| 5.6.3 | Transaction executes and is verified in DB                              | Yes       | Verify user can execute approve allowance tx                              |
| 5.6.4 | User can save allowance as draft                                        | Yes       | Verify draft transaction contains the saved info for approve allowance tx |
| 5.6.5 | `Invalid Owner ID` error shown when owner account has no resolvable key | No        |                                                                           |
| 5.6.6 | `Invalid Spender ID` error shown when spender account ID is invalid     | No        |                                                                           |

### 5.7 File Create Transaction

| #     | Scenario                                                                        | Automated | Covered By                                                          |
| ----- | ------------------------------------------------------------------------------- | --------- | ------------------------------------------------------------------- |
| 5.7.1 | All File Create form elements are displayed correctly                           | Yes       | Verify all elements are present on file create tx page              |
| 5.7.2 | User can enter file content                                                     | Yes       | Verify user can execute file create tx                              |
| 5.7.3 | User can set file memo                                                          | Yes       | Verify user can execute file create tx                              |
| 5.7.4 | Transaction executes and file is created on network                             | Yes       | Verify user can execute file create tx                              |
| 5.7.5 | File ID is returned and file exists in DB                                       | Yes       | Verify file is stored in the db after file create tx                |
| 5.7.6 | User can save file create as draft                                              | Yes       | Verify draft transaction contains the saved info for create file tx |
| 5.7.7 | Sign button disabled and `Key is required` error shown when no owner key is set | No        |                                                                     |

### 5.8 File Update Transaction

| #     | Scenario                                                                             | Automated | Covered By                                                              |
| ----- | ------------------------------------------------------------------------------------ | --------- | ----------------------------------------------------------------------- |
| 5.8.1 | File ID field is pre-filled when navigating from file card                           | Yes       | Verify file card update flow leads to update page with prefilled fileid |
| 5.8.2 | User can enter new file content                                                      | Yes       | Verify user can execute file update tx                                  |
| 5.8.3 | Transaction executes and file content is updated                                     | Yes       | Verify user can execute file update tx                                  |
| 5.8.4 | Updated content verified via Mirror Node and local cache                             | Yes       | Verify user can execute file update tx                                  |
| 5.8.5 | User can save file update as draft                                                   | Yes       | Verify draft transaction contains the saved info for update file tx     |
| 5.8.6 | `Invalid File ID` error shown when File ID field contains a malformed format         | No        |                                                                         |
| 5.8.7 | `Signature key is required` error in personal mode when no signature key is selected | No        |                                                                         |

### 5.9 File Append Transaction

| #     | Scenario                                                                             | Automated | Covered By                                                              |
| ----- | ------------------------------------------------------------------------------------ | --------- | ----------------------------------------------------------------------- |
| 5.9.1 | File ID field is pre-filled when navigating from file card                           | Yes       | Verify file card append flow leads to append page with prefilled fileid |
| 5.9.2 | User can enter content to append                                                     | Yes       | Verify user can execute file append tx                                  |
| 5.9.3 | Transaction executes and content is appended                                         | Yes       | Verify user can execute file append tx                                  |
| 5.9.4 | Appended content verified via Mirror Node and local cache                            | Yes       | Verify user can execute file append tx                                  |
| 5.9.5 | User can save file append as draft                                                   | Yes       | Verify draft transaction contains the saved info for append file tx     |
| 5.9.6 | `Invalid File ID` error shown when File ID field contains a malformed format         | No        |                                                                         |
| 5.9.7 | `Signature key is required` error in personal mode when no signature key is selected | No        |                                                                         |

### 5.10 File Read (Contents) Transaction

| #      | Scenario                                                                                                                | Automated | Covered By                           |
| ------ | ----------------------------------------------------------------------------------------------------------------------- | --------- | ------------------------------------ |
| 5.10.1 | User can enter a file ID to read                                                                                        | Yes       | Verify user can execute file read tx |
| 5.10.2 | File content is displayed in textarea                                                                                   | Yes       | Verify user can execute file read tx |
| 5.10.3 | Content matches what was previously written to the file                                                                 | Yes       | Verify user can execute file read tx |
| 5.10.4 | `Unable to execute query, you should use a payer ID with one of your keys` error when payer's key is not in local store | No        |                                      |

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
| 5.13.6 | Adding a duplicate public key at the same threshold level shows `already exists in the key list` error | No        |                                                                                              |

### 5.14 Transaction Common Fields

| #      | Scenario                                                                                                                          | Automated | Covered By                                                                                 |
| ------ | --------------------------------------------------------------------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------ |
| 5.14.1 | Max transaction fee field is pre-filled with default                                                                              | Yes       | Verify user can set global max tx fee                                                      |
| 5.14.2 | User can override max transaction fee                                                                                             | Yes       | Verify user can set global max tx fee                                                      |
| 5.14.3 | Payer account ID can be specified                                                                                                 | Yes       | Verify user can execute create account transaction with single key                         |
| 5.14.4 | Transaction memo field accepts input                                                                                              | Yes       | Verify user can create account with memo                                                   |
| 5.14.5 | Description field accepts input                                                                                                   | Yes       | Verify confirm transaction modal is displayed with valid information for Account Create tx |
| 5.14.6 | `Invalid Payer ID` error shown when payer account ID is invalid on submit                                                         | No        |                                                                                            |
| 5.14.7 | Transaction memo exceeding 100 characters shows `Transaction Memo is limited to 100 characters` toast and marks the field invalid | No        |                                                                                            |
| 5.14.8 | `Max Transaction Fee is required` error shown when fee is set to 0                                                                | No        |                                                                                            |

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
| 6.3.7 | User can cancel a transaction (creator only)                  | No        |                                                                                  |
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
| 7.1.8  | Empty state shows prompt to add transactions                                                         | No        |                                                              |
| 7.1.9  | Saving a transaction group with no description shows `Please enter a group description` error        | No        |                                                              |
| 7.1.10 | Clicking "Sign and Submit" with empty description shows `Group Description Required` error toast     | No        |                                                              |
| 7.1.11 | Saving a group with zero transactions shows `Please add at least one transaction to the group` error | No        |                                                              |
| 7.1.12 | Sign and Submit button is disabled when the group contains no transactions                           | No        |                                                              |

### 7.2 Group Editing

| #     | Scenario                                                                      | Automated | Covered By                                                   |
| ----- | ----------------------------------------------------------------------------- | --------- | ------------------------------------------------------------ |
| 7.2.1 | User can delete a transaction from the group                                  | Yes       | Verify user can delete transaction from the group            |
| 7.2.2 | User can duplicate a transaction in the group                                 | Yes       | Verify user can duplicate transaction in the group           |
| 7.2.3 | User can edit a transaction in the group                                      | Yes       | Verify user can edit transaction in the group                |
| 7.2.4 | User can delete all transactions at once                                      | Yes       | Verify user can delete many transactions at once(delete all) |
| 7.2.5 | Delete group without saving navigates away                                    | Yes       | Verify delete group action does not save the group           |
| 7.2.6 | Continue editing navigation guard modal works                                 | Yes       | Verify continue editing action saves the group               |
| 7.2.7 | Cancelling the "Delete All" confirmation modal leaves all transactions intact | No        |                                                              |

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
| 8.1.2 | User can sort accounts by Account ID (asc/desc)      | No        |                                                                                     |
| 8.1.3 | User can sort accounts by Nickname (A-Z / Z-A)       | No        |                                                                                     |
| 8.1.4 | User can sort accounts by Date Added (asc/desc)      | No        |                                                                                     |
| 8.1.5 | "Add New" dropdown shows Create New and Add Existing | Yes       | Verify clicking on "Create New" button navigates the user on create account tx page |
| 8.1.6 | "Create New" navigates to Account Create transaction | Yes       | Verify clicking on "Create New" button navigates the user on create account tx page |
| 8.1.7 | "Add Existing" navigates to /accounts/link-existing  | Yes       | Verify user can add an existing account                                             |
| 8.1.8 | Select mode enables multi-select checkboxes          | No        |                                                                                     |
| 8.1.9 | Bulk remove works in select mode                     | No        |                                                                                     |

### 8.2 Account Details Panel

| #      | Scenario                                                       | Automated | Covered By                                            |
| ------ | -------------------------------------------------------------- | --------- | ----------------------------------------------------- |
| 8.2.1  | Account ID with checksum and Hashscan link displayed           | Yes       | Verify account card is visible with valid information |
| 8.2.2  | EVM Address displayed                                          | Yes       | Verify account card is visible with valid information |
| 8.2.3  | Balance in HBAR + USD equivalent displayed                     | Yes       | Verify account card is visible with valid information |
| 8.2.4  | Key (simple PublicKey) displayed                               | Yes       | Verify account card is visible with valid information |
| 8.2.5  | Complex key shows "See details" link opening KeyStructureModal | No        |                                                       |
| 8.2.6  | Receiver Sig Required field displayed                          | Yes       | Verify account card is visible with valid information |
| 8.2.7  | Memo field displayed                                           | Yes       | Verify account card is visible with valid information |
| 8.2.8  | Max Auto Association field displayed                           | Yes       | Verify account card is visible with valid information |
| 8.2.9  | Ethereum Nonce displayed                                       | Yes       | Verify account card is visible with valid information |
| 8.2.10 | Created At / Expires At / Auto Renew Period displayed          | Yes       | Verify account card is visible with valid information |
| 8.2.11 | Staked To / Pending Reward / Rewards displayed                 | Yes       | Verify account card is visible with valid information |
| 8.2.12 | "Account is deleted" warning shown for deleted accounts        | No        |                                                       |
| 8.2.13 | Nickname is editable inline (double-click or pencil icon)      | No        |                                                       |

### 8.3 Account Actions

| Check | #     | Scenario                                                          | Automated | Covered By                                                                                                 |
| ----- | ----- | ----------------------------------------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------- |
|       | 8.3.1 | Edit dropdown shows "Delete from Network" and "Update in Network" | Yes       | Verify clicking on "Edit" and "Update" navigates the user on update account tx page with prefilled account |
|       | 8.3.2 | "Delete from Network" navigates to Account Delete transaction     | Yes       | Verify clicking on "Edit" and "Delete" navigates the user on update account tx page with prefilled account |
|       | 8.3.3 | "Update in Network" navigates to Account Update transaction       | Yes       | Verify clicking on "Edit" and "Update" navigates the user on update account tx page with prefilled account |
|       | 8.3.4 | Remove (unlink) opens confirmation modal                          | Yes       | Verify user can unlink accounts                                                                            |
|       | 8.3.5 | Account is removed from list after unlinking                      | Yes       | Verify user can unlink accounts                                                                            |

### 8.4 Link Existing Account

| #     | Scenario                                                                                                   | Automated | Covered By                              |
| ----- | ---------------------------------------------------------------------------------------------------------- | --------- | --------------------------------------- |
| 8.4.1 | Account ID input with checksum validation                                                                  | Yes       | Verify user can add an existing account |
| 8.4.2 | Invalid checksum shows error toast                                                                         | No        |                                         |
| 8.4.3 | Nickname input is available                                                                                | Yes       | Verify user can add an existing account |
| 8.4.4 | "Link Account" navigates to /accounts on success                                                           | Yes       | Verify user can add an existing account |
| 8.4.5 | Linked account appears in account list                                                                     | Yes       | Verify user can add an existing account |
| 8.4.6 | Link Account button is disabled until entered account ID resolves as valid                                 | No        |                                         |
| 8.4.7 | `Account link failed` error toast when attempting to link an already-linked account                        | No        |                                         |
| 8.4.8 | "Account already linked" label shown on transaction details when created account is already in local store | No        |                                         |

---

## 9. Files

### 9.1 File List

| #     | Scenario                                                            | Automated | Covered By                                         |
| ----- | ------------------------------------------------------------------- | --------- | -------------------------------------------------- |
| 9.1.1 | File list is displayed in left panel                                | Yes       | Verify file card is visible with valid information |
| 9.1.2 | User can sort files by File ID (asc/desc)                           | No        |                                                    |
| 9.1.3 | User can sort files by Nickname (A-Z / Z-A)                         | No        |                                                    |
| 9.1.4 | User can sort files by Date Added (asc/desc)                        | No        |                                                    |
| 9.1.5 | "Add New" dropdown shows Create, Update, Append, Read, Add Existing | No        |                                                    |
| 9.1.6 | Select mode enables multi-select checkboxes                         | No        |                                                    |
| 9.1.7 | Bulk unlink works in select mode                                    | No        |                                                    |

### 9.2 File Details Panel

| #      | Scenario                                                      | Automated | Covered By                                         |
| ------ | ------------------------------------------------------------- | --------- | -------------------------------------------------- |
| 9.2.1  | File ID with checksum displayed                               | Yes       | Verify file card is visible with valid information |
| 9.2.2  | File size displayed                                           | Yes       | Verify file card is visible with valid information |
| 9.2.3  | Key (simple or complex with "See details") displayed          | Yes       | Verify file card is visible with valid information |
| 9.2.4  | Memo displayed                                                | Yes       | Verify file card is visible with valid information |
| 9.2.5  | Ledger ID displayed                                           | Yes       | Verify file card is visible with valid information |
| 9.2.6  | Expiration date displayed                                     | Yes       | Verify file card is visible with valid information |
| 9.2.7  | Description is editable (textarea, double-click or pencil)    | No        |                                                    |
| 9.2.8  | File content is displayed or "View" button opens in temp file | No        |                                                    |
| 9.2.9  | "File is deleted" warning shown for deleted files             | No        |                                                    |
| 9.2.10 | Last Viewed timestamp displayed                               | No        |                                                    |
| 9.2.11 | Nickname is editable inline                                   | No        |                                                    |

### 9.3 File Actions

| #     | Scenario                                           | Automated | Covered By |
| ----- | -------------------------------------------------- | --------- | ---------- |
| 9.3.1 | Update button navigates to File Update transaction | No        |            |
| 9.3.2 | Append button navigates to File Append transaction | No        |            |
| 9.3.3 | Read button navigates to File Read transaction     | No        |            |
| 9.3.4 | Remove (unlink) opens confirmation modal           | No        |            |
| 9.3.5 | File is removed from list after unlinking          | No        |            |

### 9.4 Link Existing File

| #     | Scenario                                                                                             | Automated | Covered By |
| ----- | ---------------------------------------------------------------------------------------------------- | --------- | ---------- |
| 9.4.1 | File ID input validates format                                                                       | No        |            |
| 9.4.2 | Nickname input is available                                                                          | No        |            |
| 9.4.3 | Linked file appears in file list                                                                     | No        |            |
| 9.4.4 | Link File button is disabled when entered file ID format is invalid                                  | No        |            |
| 9.4.5 | `File link failed` error toast when attempting to link an already-linked file                        | No        |            |
| 9.4.6 | "File already linked" label shown on transaction details when created file is already in local store | No        |            |

---

## 10. Contact List (Organization Only)

### 10.1 Contact List View

| #      | Scenario                                                        | Automated | Covered By                                         |
| ------ | --------------------------------------------------------------- | --------- | -------------------------------------------------- |
| 10.1.1 | Empty state shows "No contacts found" message                   | No        |                                                    |
| 10.1.2 | Admin sees all contacts; non-admin sees only contacts with keys | No        |                                                    |
| 10.1.3 | Contact email is displayed                                      | Yes       | Verify contact email and public keys are displayed |
| 10.1.4 | Contact public keys are displayed                               | Yes       | Verify contact email and public keys are displayed |
| 10.1.5 | Associated accounts are displayed                               | Yes       | Verify associated accounts are displayed           |
| 10.1.6 | Associated accounts verified against Mirror Node                | Yes       | Verify associated accounts are displayed           |
| 10.1.7 | New user indicator dot shown on contact list items              | No        |                                                    |

### 10.2 Admin Actions

| #       | Scenario                                                                                   | Automated | Covered By                                                            |
| ------- | ------------------------------------------------------------------------------------------ | --------- | --------------------------------------------------------------------- |
| 10.2.1  | "Remove" button is visible for admin role                                                  | Yes       | Verify "Remove" contact list button is visible for an admin role      |
| 10.2.2  | "Remove" button is NOT visible for regular role                                            | Yes       | Verify "Remove" contact list button is not visible for a regular role |
| 10.2.3  | "Add New" button is enabled for admin role                                                 | Yes       | Verify "Add new" button is enabled for an admin role                  |
| 10.2.4  | "Add New" button is NOT visible for regular role                                           | Yes       | Verify "Add new" button is invisible for a regular role               |
| 10.2.5  | Admin can add a new user to the organization                                               | Yes       | Verify admin user can add new user to the organization                |
| 10.2.6  | Admin can add multiple users via comma-separated emails                                    | No        |                                                                       |
| 10.2.7  | Invalid email shows error toast during user creation                                       | No        |                                                                       |
| 10.2.8  | Admin can remove a user from the organization                                              | Yes       | Verify admin user can remove user from the organization               |
| 10.2.9  | Delete contact modal appears on remove click                                               | No        |                                                                       |
| 10.2.10 | Admin can elevate a user to admin role                                                     | No        |                                                                       |
| 10.2.11 | Elevate contact modal appears on click                                                     | No        |                                                                       |
| 10.2.12 | Bulk add fails with `Invalid emails: <list>` error when any email address is malformed     | No        |                                                                       |
| 10.2.13 | Partial bulk add shows `Failed to sign up users with emails: <list>` error toast           | No        |                                                                       |
| 10.2.14 | Adding an email already on org server shows `Failed to sign up user` error toast           | No        |                                                                       |
| 10.2.15 | Adding a duplicate approver to a transaction shows `User already exists in the list` error | No        |                                                                       |

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
| 11.5.1 | Export .tx file, sign offline with 75 users, zip+import, execute | Yes       | Verify user can export and import transaction and a large number of signatures for TTv1->TTv2 compatibility |
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
| 12.1.1 | Notification indicator visible in organization dropdown           | Yes       | Verify notification is visible in the organization dropdown      |
| 12.1.2 | Notification saved in DB with isRead=false, isInAppNotified=true  | Yes       | Verify notification is saved in the db and marked correctly      |
| 12.1.3 | Notification marked isRead=true after viewing transaction details | Yes       | Verify tab notification is cleared after the transaction is seen |
| 12.1.4 | Tab notification number cleared after viewing                     | Yes       | Verify tab notification is cleared after the transaction is seen |
| 12.1.5 | Notification icon visible on specific transaction row             | Yes       | Verify notification element is shown next to the transaction     |
| 12.1.6 | Notification badges on transaction tabs update in real-time       | No        |                                                                  |

### 12.2 Email Notification Preferences

| #      | Scenario                                                    | Automated | Covered By |
| ------ | ----------------------------------------------------------- | --------- | ---------- |
| 12.2.1 | Transaction Threshold Reached email preference toggle works | No        |            |
| 12.2.2 | Required Signature email preference toggle works            | No        |            |
| 12.2.3 | Transaction Cancelled email preference toggle works         | No        |            |
| 12.2.4 | Preference changes are persisted via API immediately        | No        |            |

---

## 13. Navigation and Layout

### 13.1 Sidebar Navigation

| #      | Scenario                                                     | Automated | Covered By                                                    |
| ------ | ------------------------------------------------------------ | --------- | ------------------------------------------------------------- |
| 13.1.1 | Transactions menu item navigates to /transactions            | Yes       | Verify account create tx is displayed in history page         |
| 13.1.2 | Accounts menu item navigates to /accounts                    | Yes       | Verify account card is visible with valid information         |
| 13.1.3 | Files menu item navigates to /files                          | Yes       | Verify file card is visible with valid information            |
| 13.1.4 | Contact List menu item navigates to /contact-list (org only) | No        |                                                               |
| 13.1.5 | Settings menu item navigates to /settings/general            | Yes       | Verify that all elements in settings page are present         |
| 13.1.6 | Contact List hidden when not in organization                 | Yes       | Verify user can switch between personal and organization mode |

### 13.2 Organization Selector

| #      | Scenario                                       | Automated | Covered By                                                    |
| ------ | ---------------------------------------------- | --------- | ------------------------------------------------------------- |
| 13.2.1 | Organization selector shows all connected orgs | No        |                                                               |
| 13.2.2 | Selecting an org triggers login if required    | Yes       | Verify user can switch between personal and organization mode |
| 13.2.3 | Disconnected org shows disconnect reason       | No        |                                                               |
| 13.2.4 | Org requiring upgrade blocks selection         | No        |                                                               |
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
| 14.1.3 | Toast auto-dismisses after timeout             | No        |                                                               |

### 14.2 Password Modal

| #      | Scenario                                               | Automated | Covered By                          |
| ------ | ------------------------------------------------------ | --------- | ----------------------------------- |
| 14.2.1 | Personal password modal appears when decryption needed | Yes       | Verify user can decrypt private key |
| 14.2.2 | Operation retries after correct password entry         | Yes       | Verify user can decrypt private key |
| 14.2.3 | Operation aborts if password modal is cancelled        | No        |                                     |

### 14.3 Loading States

| #      | Scenario                                      | Automated | Covered By |
| ------ | --------------------------------------------- | --------- | ---------- |
| 14.3.1 | Loading spinner shown during long operations  | No        |            |
| 14.3.2 | Global modal loader for long async operations | No        |            |

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
| 14.5.1 | Account ID checksum validation on blur            | No        |            |
| 14.5.2 | File ID format validation                         | No        |            |
| 14.5.3 | Transaction body exceeding 6144 bytes shows error | No        |            |
| 14.5.4 | Expired transaction shows appropriate error       | No        |            |
| 14.5.5 | Duplicate transaction ID shows appropriate error  | No        |            |

---

## 15. Upgrade

### 15.1 Application Update

| #      | Scenario                                                     | Automated | Covered By |
| ------ | ------------------------------------------------------------ | --------- | ---------- |
| 15.1.1 | Update notification is shown when a new version is available | No        |            |
| 15.1.2 | User is blocked from org features when below minimum version | No        |            |
| 15.1.3 | Version check badge shows correct status per org             | No        |            |

---

## Summary

### Coverage by Area

| Area                            | Total Scenarios | Automated | Manual  | Coverage % |
| ------------------------------- | --------------- | --------- | ------- | ---------- |
| 1. Registration                 | 22              | 13        | 9       | 59%        |
| 2. Login                        | 17              | 6         | 11      | 35%        |
| 3. Settings                     | 78              | 35        | 43      | 45%        |
| 4. Transactions List            | 34              | 15        | 19      | 44%        |
| 5. Transaction Creation         | 101             | 65        | 36      | 64%        |
| 6. Transaction Details          | 26              | 23        | 3       | 88%        |
| 7. Transaction Groups           | 39              | 28        | 11      | 72%        |
| 8. Accounts                     | 35              | 23        | 12      | 66%        |
| 9. Files                        | 29              | 7         | 22      | 24%        |
| 10. Contact List                | 23              | 11        | 12      | 48%        |
| 11. Org Transaction Workflows   | 24              | 22        | 2       | 92%        |
| 12. Notifications               | 10              | 5         | 5       | 50%        |
| 13. Navigation and Layout       | 12              | 7         | 5       | 58%        |
| 14. Error Handling / Edge Cases | 17              | 4         | 13      | 24%        |
| 15. Upgrade                     | 3               | 0         | 3       | 0%         |
| **Total**                       | **471**         | **264**   | **207** | **56%**    |

### Release Testing Guide

The following sections highlight the most critical manual tests to perform before each release, organized by priority tier. These are the scenarios that carry the highest risk if missed.

#### Tier 1 - Release Blockers (Must Pass)

These scenarios directly affect user access, data integrity, and core functionality. A failure in any of these should block the release.

| Area                       | Scenarios                | Why Critical                                                          |
| -------------------------- | ------------------------ | --------------------------------------------------------------------- |
| **Login & Auth**           | 2.1.5-2.1.6, 2.3.1-2.3.7 | Users cannot access the application if login/auth is broken           |
| **Registration**           | 1.1.3-1.1.8, 1.2.12      | New users cannot onboard if registration validation or redirect fails |
| **Transaction Validation** | 14.5.3-14.5.5            | Data loss or incorrect transactions if validation fails               |

#### Tier 2 - High Priority (Should Pass)

These scenarios affect important workflows that users rely on regularly. Failures cause significant user friction.

| Area                             | Scenarios                                 | Why Important                                                            |
| -------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------ |
| **Settings Persistence**         | 3.1.1.5, 3.1.3.3-3.1.3.4                  | Settings lost on reload degrade user experience                          |
| **Key Management**               | 3.2.2, 3.2.4-3.2.5, 3.2.9, 3.2.15, 3.2.18 | Key operations are security-critical                                     |
| **Transaction Lists (Personal)** | 4.1.1-4.1.5, 4.3.1-4.3.3                  | Users cannot navigate or find transactions                               |
| **Transaction Lists (Org)**      | 4.2.2-4.2.3, 4.5.8-4.5.9                  | Org workflow visibility and filtering affects collaboration              |
| **Organization Selector**        | 13.2.1, 13.2.3-13.2.4                     | Users cannot switch between org and personal mode                        |
| **Notifications**                | 12.1.6                                    | Missed real-time notifications delay signing workflows                   |
| **Password Change**              | 3.5.3-3.5.4, 3.5.6, 3.5.8, 3.5.10-3.5.11  | Password/logout issues lock users out                                    |
| **Upgrade Enforcement**          | 15.1.2                                    | Org users silently lose access if version enforcement fails after update |

#### Tier 3 - Medium Priority (Verify When Changed)

These scenarios cover secondary workflows. Test when the related feature area has changed.

| Area                    | Scenarios       | When to Test                                                |
| ----------------------- | --------------- | ----------------------------------------------------------- |
| **File Management**     | 9.1.2-9.4.3     | When file list, details, or actions UI is modified          |
| **Public Keys Tab**     | 3.3.1-3.3.6     | When public key management UI is modified                   |
| **Appearance/Theme**    | 3.1.2.2-3.1.2.3 | When theme switching or CSS is modified                     |
| **Contact List Admin**  | 10.2.6-10.2.11  | When contact management flows are modified                  |
| **Group Export**        | 7.5.5           | When signature export formats are modified                  |
| **Transaction Cancel**  | 6.3.7           | When transaction lifecycle management is modified           |
| **Application Upgrade** | 15.1.1, 15.1.3  | When update notification or version badge logic is modified |

#### Tier 4 - Lower Priority (Periodic Verification)

These scenarios cover edge cases and error handling. Verify periodically or after infrastructure changes.

| Area                           | Scenarios     | When to Test                                    |
| ------------------------------ | ------------- | ----------------------------------------------- |
| **Network Errors**             | 14.4.1-14.4.4 | After infrastructure, WebSocket, or API changes |
| **Form Validation Edge Cases** | 14.5.1-14.5.2 | After form or validation logic changes          |
| **Loading States**             | 14.3.1-14.3.2 | After adding new async operations               |
| **Toast Dismissal**            | 14.1.3        | After notification system changes               |
| **Keychain Registration**      | 1.3.1-1.3.2   | After OS integration or auth changes            |

### Priority Areas for Additional Automation

1. **Upgrade (0%)** - Update notifications, version enforcement for org features, version status badges
2. **Error Handling / Edge Cases (24%)** - Network failures, validation edge cases, form limits
3. **Files (24%)** - File list sorting, file details panel, file actions, link existing and already-linked file scenarios
4. **Login (35%)** - Negative cases, session persistence, org login error flows
5. **Transactions List (44%)** - Personal mode options, org tab notification badges, history table features, drafts table sort and pagination
6. **Contact List (48%)** - Bulk user add validation, duplicate email, approver duplicate handling
7. **Notifications (50%)** - Email preference toggles, real-time badge delivery
