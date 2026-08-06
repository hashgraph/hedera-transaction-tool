import { expect, test } from '@playwright/test';
import { setupOrganizationSettingsGeneralSuite } from '../helpers/fixtures/organizationSettingsGeneralSuite.js';
import {
  createLocalOnlyOrganizationServerUrl,
  createLocalOrganizationConnectionForTesting,
  deleteLocalOrganizationConnectionForTesting,
} from '../helpers/support/localOrganizationConnectionSupport.js';

// Unreachable server URL used for test 14.4.1.
const UNREACHABLE_SERVER_URL = 'http://127.0.0.1:19999/';

test.describe('Organization Settings connection tests @organization-basic', () => {
  const suite = setupOrganizationSettingsGeneralSuite();

  test('Verify user can edit organization nickname', async ({}, testInfo) => {
    await suite.settingsPage.clickOnSettingsButton();
    await suite.settingsPage.clickOnOrganisationsTab();

    // 3.4.11: Saving a blank org nickname shows validation toast.
    await suite.organizationPage.updateOrganizationNicknameAtIndex(0, '');
    await suite.registrationPage.waitForToastMessageByVariant('error', 'Nickname cannot be empty');
    await suite.loginPage.waitForToastToDisappear();
    expect((await suite.organizationPage.getOrganizationNicknameText())?.trim()).toBe(
      suite.organizationNickname,
    );

    // 3.4.7: Nickname is editable inline.
    await suite.organizationPage.editOrganizationNickname(suite.updatedOrganizationNickname);
    const orgName = await suite.organizationPage.getOrganizationNicknameText();
    expect(orgName).toBe(suite.updatedOrganizationNickname);
    await suite.organizationPage.editOrganizationNickname(suite.organizationNickname);

    // 3.4.12: Editing org nickname to an already-used name shows validation toast.
    // Seed the second local connection directly because CI provisions only one
    // live organization server, while the UI rejects duplicate server URLs.
    const secondOrganizationNickname = `${suite.organizationNickname} (2)`;
    const secondOrganizationServerUrl = createLocalOnlyOrganizationServerUrl(testInfo);
    await createLocalOrganizationConnectionForTesting(
      suite.window,
      secondOrganizationNickname,
      secondOrganizationServerUrl,
    );
    await suite.organizationPage.waitForElementToBeVisible(
      suite.organizationPage.editNicknameOrganizationButtonSelector,
      suite.organizationPage.getLongTimeout(),
      1,
    );

    try {
      await suite.organizationPage.updateOrganizationNicknameAtIndex(1, suite.organizationNickname);
      await suite.registrationPage.waitForToastMessageByVariant('error', 'Nickname already exists');
    } finally {
      await deleteLocalOrganizationConnectionForTesting(suite.window, secondOrganizationServerUrl);
    }
  });

  test('Verify error message when user adds non-existing organization', async () => {
    await suite.loginPage.waitForToastToDisappear();
    await suite.organizationPage.setupWrongOrganization(suite.invalidOrganizationNickname);
    const toastMessage = await suite.registrationPage.waitForToastMessageByVariant(
      'error',
      'Organization does not exist. Please check the server URL',
    );
    expect(toastMessage).toBe('Organization does not exist. Please check the server URL');
    await suite.organizationPage.clickOnCancelAddingOrganizationButton();
    await suite.loginPage.waitForToastToDisappear();
  });

  test('14.4.1: Verify graceful handling when organization server is unreachable', async () => {
    await suite.loginPage.waitForToastToDisappear();
    await suite.settingsPage.clickOnSettingsButton();
    await suite.settingsPage.clickOnOrganisationsTab();

    // Seed an org whose server URL will always refuse connections.
    // Using createLocalOrganizationConnectionForTesting bypasses the add-org
    // modal so we can observe the status-badge behaviour directly in the table.
    await createLocalOrganizationConnectionForTesting(
      suite.window,
      'Unreachable Server Org',
      UNREACHABLE_SERVER_URL,
    );

    // Wait for the second row's status badge to render.
    await suite.settingsPage.waitForElementToBeVisible(
      suite.settingsPage.organizationConnectionStatusBadgeSelector,
      suite.settingsPage.getVeryLongTimeout(),
      1,
    );

    try {
      // Poll until the badge settles on "Disconnected". A refused-connection
      // attempt resolves quickly; VERY_LONG_TIMEOUT covers slower CI environments.
      // "Disconnected" proves the app attempted the connection, received the
      // failure, and did NOT hang or crash.
      await expect
        .poll(
          async () => await suite.settingsPage.getOrganizationConnectionStatusBadgeText(1),
          { timeout: suite.settingsPage.getVeryLongTimeout() },
        )
        .toBe('Disconnected');

      // The app must still be interactive after the failed connection attempt.
      expect(
        await suite.settingsPage.isElementVisible(
          suite.settingsPage.organisationsTabButtonSelector,
        ),
      ).toBe(true);
    } finally {
      await deleteLocalOrganizationConnectionForTesting(suite.window, UNREACHABLE_SERVER_URL);
    }
  });

  test('Verify user can delete an organization', async () => {
    await suite.organizationPage.selectPersonalMode();
    await suite.settingsPage.clickOnSettingsButton();
    await suite.settingsPage.clickOnOrganisationsTab();
    await suite.loginPage.waitForToastToDisappear();
    await suite.organizationPage.clickOnDeleteFirstOrganization();
    const visibleToasts = suite.window.locator(suite.registrationPage.visibleToastMessageSelector);
    await expect
      .poll(
        async () => {
          const toastTexts = await visibleToasts.allTextContents();
          return toastTexts.map(toast => toast.trim()).includes('Connection deleted successfully');
        },
        {
          timeout: suite.registrationPage.getLongTimeout(),
        },
      )
      .toBe(true);
    const orgName = (await suite.organizationPage.getOrganizationNicknameText()) ?? '';
    const isDeletedFromDb = await suite.organizationPage.verifyOrganizationExists(orgName);
    expect(isDeletedFromDb).toBe(false);
  });
});
