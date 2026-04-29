import { expect, test } from '@playwright/test';
import { generateRandomEmail } from '../../utils/data/random.js';
import { setupOrganizationContactListSuite } from '../helpers/fixtures/organizationContactListSuite.js';
import { signInOrganizationUser } from '../helpers/support/organizationAuthSupport.js';

test.describe('Organization Contact List bulk and role tests @organization-basic', () => {
  const suite = setupOrganizationContactListSuite();

  test('Verify admin bulk user registration supports comma-separated emails and error states', async () => {
    await signInOrganizationUser(
      suite.organizationPage,
      suite.adminUser,
      suite.credentials.password,
    );
    await suite.organizationPage.clickOnContactListButton();

    // 10.2.6: bulk add multiple users
    const bulkUser1 = generateRandomEmail();
    const bulkUser2 = generateRandomEmail();
    await suite.contactListPage.clickOnAddNewContactButton();
    await suite.contactListPage.enableMultipleEmailsMode();
    await suite.contactListPage.fillMultipleEmails(`${bulkUser1}, ${bulkUser2}`);
    await suite.contactListPage.registerUsers();
    expect(await suite.contactListPage.verifyUserExistsInOrganization(bulkUser1)).toBe(true);
    expect(await suite.contactListPage.verifyUserExistsInOrganization(bulkUser2)).toBe(true);

    // 10.2.12: invalid email list yields `Invalid emails: ...` toast and stays on the page
    await suite.organizationPage.clickOnContactListButton();
    await suite.contactListPage.clickOnAddNewContactButton();
    await suite.contactListPage.enableMultipleEmailsMode();
    const invalidEmail = 'not-a-valid-email';
    await suite.contactListPage.fillMultipleEmails(`${generateRandomEmail()}, ${invalidEmail}`);
    await suite.contactListPage.registerUsers();
    await suite.registrationPage.waitForToastMessageByVariant(
      'error',
      `Invalid emails: ${invalidEmail}`,
    );

    // 10.2.13: partial bulk add (existing + new) shows `Failed to sign up users with emails: ...`
    // 10.2.14: single add with existing email shows `Failed to sign up user`
    const partialNewUser = generateRandomEmail();
    await suite.contactListPage.fillMultipleEmails(`${suite.regularUser.email}, ${partialNewUser}`);
    await suite.contactListPage.registerUsers();
    await suite.registrationPage.waitForToastMessageByVariant(
      'error',
      `Failed to sign up users with emails: ${suite.regularUser.email}`,
    );
    expect(await suite.contactListPage.verifyUserExistsInOrganization(partialNewUser)).toBe(true);

    // Single mode "already exists" error
    await suite.organizationPage.clickOnContactListButton();
    await suite.contactListPage.addNewUser(suite.regularUser.email);
    await suite.registrationPage.waitForToastMessageByVariant('error', 'Failed to sign up user');
  });

  test('Verify admin can elevate a user to admin role', async () => {
    await signInOrganizationUser(
      suite.organizationPage,
      suite.adminUser,
      suite.credentials.password,
    );
    const newUserEmail = generateRandomEmail();

    await suite.organizationPage.clickOnContactListButton();
    await suite.contactListPage.addNewUser(newUserEmail);

    await expect.poll(() => suite.contactListPage.isContactVisible(newUserEmail)).toBe(true);
    await suite.contactListPage.clickOnAccountInContactListByEmail(newUserEmail);
    await suite.contactListPage.clickOnElevateContactButton();

    // 10.2.11: elevate modal appears
    expect(await suite.contactListPage.isConfirmElevateContactButtonVisible()).toBe(true);
    await suite.contactListPage.clickOnConfirmElevateContactButton();
    await suite.registrationPage.waitForToastMessageByVariant(
      'success',
      'elevate to admin successfully',
    );

    // 10.2.10: elevated role reflected in backend
    await expect.poll(() => suite.isUserAdmin(newUserEmail)).toBe(true);
  });

  test('Verify adding a duplicate approver to a transaction shows `User already exists in the list` error', async () => {
    test.skip(
      true,
      'Approvers UI is feature-flagged off (FEATURE_APPROVERS_ENABLED=false). Enable it to run this test.',
    );

    await signInOrganizationUser(
      suite.organizationPage,
      suite.adminUser,
      suite.credentials.password,
    );

    await suite.transactionPage.clickOnTransactionsMenuButton();
    await suite.transactionPage.clickOnCreateNewTransactionButton();
    await suite.transactionPage.clickOnCreateAccountTransaction();

    // Open Approvers and create a complex approver structure.
    await suite.transactionPage.clickOnAddApproverButton();
    await suite.transactionPage.clickOnComplexApproverTab();

    // Add a user to the structure, then attempt to add the same user again.
    await suite.transactionPage.addFirstUserToComplexApproverStructure();
    await suite.transactionPage.addFirstUserToComplexApproverStructure();

    const errorToast = await suite.registrationPage.getToastMessageByVariant('error');
    expect(errorToast).toContain('User already exists in the list');
  });
});
