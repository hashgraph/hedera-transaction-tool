/**
 * Performance Test: Contacts Page
 *
 * Requirement: 100+ contacts load in ≤ 1s
 * Data source: Backend PostgreSQL (org users appear as contacts)
 */

import { test, expect, Page } from '@playwright/test';
import * as dotenv from 'dotenv';
import { setupApp, closeApp } from '../../utils/runtime/appSession.js';
import {
  resetDbState,
  resetDbStateForTeardown,
  resetPostgresDbState,
  resetPostgresDbStateForTeardown,
} from '../../utils/db/databaseUtil.js';
import { RegistrationPage } from '../../pages/RegistrationPage.js';
import { OrganizationPage } from '../../pages/OrganizationPage.js';
import { ContactListPage } from '../../pages/ContactListPage.js';
import { LoginPage } from '../../pages/LoginPage.js';
import {
  TARGET_LOAD_TIME_MS,
  collectPerformanceSamples,
  formatDuration,
  waitForRowCount,
  DATA_VOLUMES,
  DEBUG,
  TEST_LOCAL_PASSWORD,
} from './performanceUtils.js';
import { SELECTORS } from './selectors.js';
import { createSeededOrganizationSession } from '../../utils/seeding/organizationSeeding.js';

dotenv.config();

// Volume requirement from k6 constants (SSOT)
const DB_ITEM_COUNT = DATA_VOLUMES.CONTACTS;
const MIN_CONTACTS = 50; // Strict: require at least 50 contacts rendered

let app: Awaited<ReturnType<typeof setupApp>>['app'];
let window: Page;
let registrationPage: RegistrationPage;
let organizationPage: OrganizationPage;
let contactListPage: ContactListPage;
let loginPage: LoginPage;

test.describe('Contacts Page Performance', () => {
  test.beforeAll(async () => {
    await resetDbState();
    await resetPostgresDbState();
    ({ app, window } = await setupApp());
    registrationPage = new RegistrationPage(window);
    organizationPage = new OrganizationPage(window);
    contactListPage = new ContactListPage(window);
    loginPage = new LoginPage(window);

    // Create 100+ test users in backend (they will appear as contacts)
    const password = TEST_LOCAL_PASSWORD;
    if (DEBUG) console.log(`Creating ${DB_ITEM_COUNT} users in backend...`);
    await createSeededOrganizationSession(window, loginPage, organizationPage, {
      userCount: DB_ITEM_COUNT,
      localUser: {
        email: `perf-contacts-${Date.now()}@test.com`,
        password,
      },
      signInUserIndex: null,
      setupPersonalTransactions: false,
      setupOrganizationTransactions: false,
    });
    const testUser = organizationPage.getUser(0);
    if (DEBUG) console.log(`Created ${DB_ITEM_COUNT} users`);

    await contactListPage.upgradeUserToAdmin(testUser.email);
    await organizationPage.signInOrganization(testUser.email, testUser.password, password);
  });

  test.afterAll(async () => {
    await closeApp(app);
    await resetDbStateForTeardown();
    await resetPostgresDbStateForTeardown();
  });

  test('Contacts page should load in under 1 second (p95)', async () => {
    await organizationPage.clickOnContactListButton();
    await window.waitForLoadState('networkidle');

    const samples = await collectPerformanceSamples(async () => {
      await window.click(SELECTORS.MENU_TRANSACTIONS);
      await window.waitForLoadState('networkidle');

      const startTime = Date.now();
      await organizationPage.clickOnContactListButton();
      await window.waitForLoadState('networkidle');
      const loadTime = Date.now() - startTime;

      // Verify rows rendered (STRICT: require minimum volume)
      const rowCount = await waitForRowCount(window, SELECTORS.CONTACT_ROW, MIN_CONTACTS, 5000);
      expect(rowCount, `Only ${rowCount} contacts rendered, need >= ${MIN_CONTACTS}`).toBeGreaterThanOrEqual(MIN_CONTACTS);

      return loadTime;
    }, 5);

    console.log(`Contacts p95: ${formatDuration(samples.p95)}, avg: ${formatDuration(samples.avg)}`);
    console.log(`  Samples: ${samples.values.map((v) => formatDuration(v)).join(', ')}`);

    expect(samples.p95).toBeLessThan(TARGET_LOAD_TIME_MS);
  });
});
