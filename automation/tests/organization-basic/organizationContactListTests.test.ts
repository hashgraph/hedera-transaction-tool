import { expect, test } from '@playwright/test';
import { setupOrganizationContactListSuite } from '../helpers/fixtures/organizationContactListSuite.js';
import { signInOrganizationUser } from '../helpers/support/organizationAuthSupport.js';

test.describe('Organization Contact List member view tests @organization-basic', () => {
  const suite = setupOrganizationContactListSuite();

  test('Verify associated accounts are displayed', async () => {
    await signInOrganizationUser(
      suite.organizationPage,
      suite.regularUser,
      suite.credentials.password,
    );
    await suite.organizationPage.clickOnContactListButton();
    await suite.contactListPage.clickOnAccountInContactListByEmail(suite.adminUser.email);
    const result = await suite.contactListPage.verifyAssociatedAccounts();
    expect(result).toBe(true);
  });

  test('Verify user can change nickname', async () => {
    await signInOrganizationUser(
      suite.organizationPage,
      suite.regularUser,
      suite.credentials.password,
    );
    const newNickname = 'Test-Nickname';
    await suite.organizationPage.clickOnContactListButton();
    await suite.contactListPage.clickOnAccountInContactListByEmail(suite.adminUser.email);
    await suite.contactListPage.clickOnChangeNicknameButton();
    await suite.contactListPage.fillInContactNickname(newNickname);
    await suite.contactListPage.clickOnAccountInContactListByEmail(suite.adminUser.email);
    const nickNameText = await suite.contactListPage.getContactNicknameText(newNickname);
    expect(nickNameText).toBe(newNickname);
  });
});
