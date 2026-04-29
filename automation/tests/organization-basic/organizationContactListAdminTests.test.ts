import { expect, test } from '@playwright/test';
import { generateRandomEmail } from '../../utils/data/random.js';
import { setupOrganizationContactListSuite } from '../helpers/fixtures/organizationContactListSuite.js';
import { signInOrganizationUser } from '../helpers/support/organizationAuthSupport.js';

test.describe('Organization Contact List admin management tests @organization-basic', () => {
  const suite = setupOrganizationContactListSuite();

  test('Verify admin user can add new user to the organization', async () => {
    await signInOrganizationUser(
      suite.organizationPage,
      suite.adminUser,
      suite.credentials.password,
    );
    const newUserEmail = generateRandomEmail();
    await suite.organizationPage.clickOnContactListButton();
    await suite.contactListPage.addNewUser(newUserEmail);
    const isUserAdded = await suite.contactListPage.verifyUserExistsInOrganization(newUserEmail);
    expect(isUserAdded).toBe(true);
  });

  test('Verify admin user can remove user from the organization', async () => {
    await signInOrganizationUser(
      suite.organizationPage,
      suite.adminUser,
      suite.credentials.password,
    );
    const newUserEmail = generateRandomEmail();
    await suite.organizationPage.clickOnContactListButton();
    await suite.contactListPage.addNewUser(newUserEmail);
    await suite.contactListPage.clickOnAccountInContactListByEmail(newUserEmail);
    await suite.contactListPage.clickOnRemoveContactButton();
    expect(await suite.contactListPage.isConfirmRemoveContactButtonVisible()).toBe(true);
    await suite.contactListPage.clickOnConfirmRemoveContactButton();
    const isUsedDeleted = await suite.contactListPage.isUserDeleted(newUserEmail);
    expect(isUsedDeleted).toBe(true);
  });

  test('Verify adding user with invalid email shows error', async () => {
    await signInOrganizationUser(
      suite.organizationPage,
      suite.adminUser,
      suite.credentials.password,
    );
    const malformedEmail = 'not-a-valid-email';
    await suite.organizationPage.clickOnContactListButton();
    await suite.contactListPage.addNewUser(malformedEmail);

    // The malformed email should not be registered in the organization
    const isUserRegistered =
      await suite.contactListPage.verifyUserExistsInOrganization(malformedEmail);
    expect(isUserRegistered).toBe(false);
  });
});
