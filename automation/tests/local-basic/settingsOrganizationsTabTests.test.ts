import { Page, expect, test } from '@playwright/test';
import type { TransactionToolApp } from '../../utils/runtime/appSession.js';
import { LoginPage } from '../../pages/LoginPage.js';
import { SettingsPage } from '../../pages/SettingsPage.js';
import { createSeededLocalUserSession } from '../../utils/seeding/localUserSeeding.js';
import {
  setupLocalSuiteApp,
  teardownLocalSuiteApp,
} from '../helpers/bootstrap/localSuiteBootstrap.js';
import type { ActivatedTestIsolationContext } from '../../utils/setup/sharedTestEnvironment.js';
import {
  attemptSelectOrganizationByServerUrl,
  createLocalOnlyOrganizationServerUrl,
  createLocalOrganizationConnectionForTesting,
  deleteLocalOrganizationConnectionForTesting,
  resetOrganizationVersionStateForTesting,
  setOrganizationConnectionStatusForTesting,
  setOrganizationVersionStateForTesting,
} from '../helpers/support/localOrganizationConnectionSupport.js';

let app: TransactionToolApp;
let window: Page;
let loginPage: LoginPage;
let settingsPage: SettingsPage;
let isolationContext: ActivatedTestIsolationContext | null = null;

test.describe('Settings organizations tab tests @local-basic', () => {
  test.beforeAll(async () => {
    ({ app, window, isolationContext } = await setupLocalSuiteApp(test.info()));
  });

  test.afterAll(async () => {
    await teardownLocalSuiteApp(app, isolationContext);
  });

  test.beforeEach(async () => {
    loginPage = new LoginPage(window);
    settingsPage = new SettingsPage(window);
    await createSeededLocalUserSession(window, loginPage);
    await settingsPage.clickOnSettingsButton();
    await settingsPage.clickOnOrganisationsTab();
  });

  // 3.4.4: Organization table shows: Nickname, Server URL, Status, Version Info.
  test('Verify organizations table headers and seeded row are rendered', async ({}, testInfo) => {
    const nickname = 'Org Headers Check';
    const serverUrl = createLocalOnlyOrganizationServerUrl(testInfo);
    await createLocalOrganizationConnectionForTesting(window, nickname, serverUrl);

    try {
      const headers = await settingsPage.getOrganizationsTableHeaders();
      expect(headers).toEqual(
        expect.arrayContaining(['Nickname', 'Server URL', 'Status', 'Version Info']),
      );
      expect(await settingsPage.getOrganizationServerUrlAtIndex(0)).toBe(serverUrl);
    } finally {
      await deleteLocalOrganizationConnectionForTesting(window, serverUrl);
    }
  });

  // 3.4.5: Status badge reflects connected / disconnected / upgradeRequired.
  test('Verify status badge text for each connection state', async ({}, testInfo) => {
    const nickname = 'Org Status Badge';
    const serverUrl = createLocalOnlyOrganizationServerUrl(testInfo);
    await createLocalOrganizationConnectionForTesting(window, nickname, serverUrl);

    try {
      await setOrganizationConnectionStatusForTesting(window, serverUrl, 'connected');
      await expect
        .poll(async () => settingsPage.getOrganizationConnectionStatusBadgeText(0))
        .toBe('Connected');

      await setOrganizationConnectionStatusForTesting(window, serverUrl, 'disconnected', 'manual');
      await expect
        .poll(async () => settingsPage.getOrganizationConnectionStatusBadgeText(0))
        .toBe('Disconnected');

      await setOrganizationConnectionStatusForTesting(window, serverUrl, 'upgradeRequired');
      await expect
        .poll(async () => settingsPage.getOrganizationConnectionStatusBadgeText(0))
        .toBe('Upgrade Required');
    } finally {
      await deleteLocalOrganizationConnectionForTesting(window, serverUrl);
    }
  });

  // 3.4.6: Version info shows Update Required / Update Available / Current.
  test('Verify version info badge text for each version state', async ({}, testInfo) => {
    const nickname = 'Org Version Info';
    const serverUrl = createLocalOnlyOrganizationServerUrl(testInfo);
    await createLocalOrganizationConnectionForTesting(window, nickname, serverUrl);

    try {
      await setOrganizationVersionStateForTesting(window, serverUrl, 'belowMinimum');
      await expect
        .poll(async () => settingsPage.getOrganizationVersionInfoText(0))
        .toContain('Update Required');

      await setOrganizationVersionStateForTesting(window, serverUrl, 'updateAvailable');
      await expect
        .poll(async () => settingsPage.getOrganizationVersionInfoText(0))
        .toContain('Update Available');

      await setOrganizationVersionStateForTesting(window, serverUrl, 'current');
      await expect
        .poll(async () => settingsPage.getOrganizationVersionInfoText(0))
        .toContain('Current');
    } finally {
      await resetOrganizationVersionStateForTesting(window, serverUrl);
      await deleteLocalOrganizationConnectionForTesting(window, serverUrl);
    }
  });

  // 13.2.3: A disconnected org with an upgradeRequired reason renders the inline reason note.
  test('Verify disconnected org shows the upgradeRequired reason note', async ({}, testInfo) => {
    const nickname = 'Org Disconnect Reason';
    const serverUrl = createLocalOnlyOrganizationServerUrl(testInfo);
    await createLocalOrganizationConnectionForTesting(window, nickname, serverUrl);

    try {
      await setOrganizationConnectionStatusForTesting(
        window,
        serverUrl,
        'disconnected',
        'upgradeRequired',
      );
      await expect
        .poll(async () => settingsPage.getOrganizationStatusCellText(0))
        .toContain('Update required to reconnect');
    } finally {
      await deleteLocalOrganizationConnectionForTesting(window, serverUrl);
    }
  });

  // 15.1.1: When at least one org reports updateAvailable, the global Update Available modal shows.
  test('Verify Update Available modal shows when a new version is available', async ({}, testInfo) => {
    const nickname = 'Org Update Banner';
    const serverUrl = createLocalOnlyOrganizationServerUrl(testInfo);
    await createLocalOrganizationConnectionForTesting(window, nickname, serverUrl);

    try {
      await setOrganizationVersionStateForTesting(window, serverUrl, 'updateAvailable');
      await expect
        .poll(async () => settingsPage.isUpdateAvailableModalVisible())
        .toBe(true);
    } finally {
      await resetOrganizationVersionStateForTesting(window, serverUrl);
      await deleteLocalOrganizationConnectionForTesting(window, serverUrl);
    }
  });

  // 13.2.4: An org disconnected because its version is below the minimum cannot be selected.
  test('Verify org requiring upgrade is blocked from selection', async ({}, testInfo) => {
    const nickname = 'Org Upgrade Block';
    const serverUrl = createLocalOnlyOrganizationServerUrl(testInfo);
    await createLocalOrganizationConnectionForTesting(window, nickname, serverUrl);

    try {
      await setOrganizationConnectionStatusForTesting(
        window,
        serverUrl,
        'disconnected',
        'upgradeRequired',
      );
      await setOrganizationVersionStateForTesting(window, serverUrl, 'belowMinimum');

      const result = await attemptSelectOrganizationByServerUrl(window, serverUrl);
      expect(result.selectedServerUrl).toBeNull();
    } finally {
      await resetOrganizationVersionStateForTesting(window, serverUrl);
      await deleteLocalOrganizationConnectionForTesting(window, serverUrl);
    }
  });
});
