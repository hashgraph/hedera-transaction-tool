import { expect, test } from '@playwright/test';
import { setupOrganizationSettingsGeneralSuite } from '../helpers/fixtures/organizationSettingsGeneralSuite.js';

test.describe('Organization Settings (General) navigation tests @organization-basic', () => {
  const suite = setupOrganizationSettingsGeneralSuite();

  test('Verify user can switch between personal and organization mode', async () => {
    // Organization selector should list all connected orgs (plus personal mode).
    await suite.organizationPage.clickOnSelectModeDropdown();
    const modeItemCount = await suite.organizationPage.countModeSelectionItems();
    const modeItemTexts: string[] = [];
    for (let i = 0; i < modeItemCount; i++) {
      modeItemTexts.push((await suite.organizationPage.getModeSelectionItemText(i)) ?? '');
    }
    const modeMenuText = modeItemTexts.join(' ');
    expect(modeMenuText).toContain('Personal');
    expect(modeMenuText).toContain(suite.organizationNickname);

    // Switch to personal mode.
    await suite.organizationPage.selectModeByIndex(0);
    const isContactListHidden = await suite.organizationPage.isContactListButtonHidden();
    expect(isContactListHidden).toBe(true);

    // Notifications tab should not be available in personal mode.
    await suite.settingsPage.clickOnSettingsButton();
    expect(await suite.settingsPage.isNotificationsTabVisible()).toBe(false);

    // Delay the first organization-server request so we can reliably observe the global loader.
    await suite.organizationPage.delayFirstOrganizationServerRequest(
      process.env.ORGANIZATION_URL ?? '',
    );

    await suite.organizationPage.selectOrganizationMode();

    expect(await suite.organizationPage.isGlobalLoaderModalVisible(2000)).toBe(true);
    expect(await suite.organizationPage.isGlobalLoaderSpinnerVisible(2000)).toBe(true);
    expect(await suite.organizationPage.isGlobalLoaderModalHidden(15000)).toBe(true);

    await suite.organizationPage.stopDelayingOrganizationServerRequest();
    const isContactListVisibleAfterSwitch =
      await suite.organizationPage.isContactListButtonVisible();
    expect(isContactListVisibleAfterSwitch).toBe(true);

    // Notifications tab should be available in organization mode.
    await suite.settingsPage.clickOnSettingsButton();
    expect(await suite.settingsPage.isNotificationsTabVisible()).toBe(true);
  });

  test('Verify contact list menu item navigates to /contact-list', async () => {
    await suite.organizationPage.clickOnContactListButton();
    await expect.poll(() => suite.window.url()).toContain('/contact-list');
  });

  test('Verify default organization can be selected from dropdown', async () => {
    await suite.organizationPage.selectPersonalMode();
    await suite.settingsPage.clickOnSettingsButton();

    await suite.settingsPage.selectDefaultOrganizationByLabel('None');
    expect(await suite.settingsPage.getSelectedDefaultOrganizationLabel()).toContain('None');

    await suite.settingsPage.selectDefaultOrganizationByLabel(suite.organizationNickname);
    expect(await suite.settingsPage.getSelectedDefaultOrganizationLabel()).toContain(
      suite.organizationNickname,
    );
  });
});
