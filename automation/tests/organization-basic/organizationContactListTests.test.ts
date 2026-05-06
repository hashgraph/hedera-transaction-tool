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
    // The contact row testid is derived from the nickname, and the rename has to
    // round-trip the backend + WebSocket before the renderer re-emits the new row.
    // Poll across VERY_LONG_TIMEOUT so CI runs absorb that latency, with each
    // attempt bounded by SHORT_TIMEOUT so the budget translates to ~60 attempts
    // instead of being eaten by getText's default 3s visibility wait.
    await expect
      .poll(() => suite.contactListPage.getContactNicknameText(newNickname), {
        timeout: suite.contactListPage.getLongTimeout() * 2,
        intervals: [suite.contactListPage.getShortTimeout()],
      })
      .toBe(newNickname);
  });
});
