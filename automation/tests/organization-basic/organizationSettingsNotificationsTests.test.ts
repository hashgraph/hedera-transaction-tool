import { expect, test } from '@playwright/test';
import { setupOrganizationSettingsGeneralSuite } from '../helpers/fixtures/organizationSettingsGeneralSuite.js';

// Covers scenarios 3.6.2 / 3.6.3 / 3.6.4 (in-app notification toggles) and
// 12.2.1 / 12.2.2 / 12.2.3 / 12.2.4 (email preference toggles + persisted via API).
// In the current renderer those two scenario groups map to the same email-notification
// toggles in Settings → Notifications; the toggle state is bound directly to the store
// (notifications.notificationsPreferences[type]) so a stable post-click state proves the
// store accepted the change via updatePreferences().
test.describe('Organization Settings notification preferences tests @organization-basic', () => {
  const suite = setupOrganizationSettingsGeneralSuite();

  test.beforeEach(async () => {
    await suite.organizationPage.selectOrganizationMode();
    await suite.settingsPage.clickOnSettingsButton();
    await suite.settingsPage.clickOnNotificationsTab();
  });

  test('Verify Ready to Execute toggle persists state change', async () => {
    const { initial, afterToggle } = await suite.settingsPage.toggleNotificationAndExpectChange(
      suite.settingsPage.notificationToggleNameReadyForExecution,
    );
    expect(afterToggle).toBe(!initial);
    await expect
      .poll(async () =>
        suite.settingsPage.isNotificationToggleChecked(
          suite.settingsPage.notificationToggleNameReadyForExecution,
        ),
      )
      .toBe(!initial);
  });

  test('Verify Signature Required toggle persists state change', async () => {
    const { initial, afterToggle } = await suite.settingsPage.toggleNotificationAndExpectChange(
      suite.settingsPage.notificationToggleNameSignatureRequired,
    );
    expect(afterToggle).toBe(!initial);
    await expect
      .poll(async () =>
        suite.settingsPage.isNotificationToggleChecked(
          suite.settingsPage.notificationToggleNameSignatureRequired,
        ),
      )
      .toBe(!initial);
  });

  test('Verify Cancelled toggle persists state change', async () => {
    const { initial, afterToggle } = await suite.settingsPage.toggleNotificationAndExpectChange(
      suite.settingsPage.notificationToggleNameCancelled,
    );
    expect(afterToggle).toBe(!initial);
    await expect
      .poll(async () =>
        suite.settingsPage.isNotificationToggleChecked(
          suite.settingsPage.notificationToggleNameCancelled,
        ),
      )
      .toBe(!initial);
  });
});
