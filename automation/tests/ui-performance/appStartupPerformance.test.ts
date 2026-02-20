/**
 * Performance Test: App Startup Time
 *
 * Requirement: TBD (threshold to be confirmed by Hedera)
 * Measures time from app launch to interactive state
 */

import { test, expect, ElectronApplication } from '@playwright/test';
import { _electron as electron } from 'playwright';
import * as dotenv from 'dotenv';
import { resetDbState } from '../../utils/databaseUtil.js';
import { formatDuration } from './performanceUtils.js';
import { SELECTORS } from './selectors.js';

dotenv.config();

// TBD - waiting for Hedera to confirm threshold
const TARGET_STARTUP_TIME_MS = 3000;

test.describe('App Startup Performance', () => {
  test.beforeAll(async () => {
    await resetDbState();
  });

  test.afterAll(async () => {
    await resetDbState();
  });

  test('App startup time should be within threshold', async () => {
    const startTime = Date.now();

    const app: ElectronApplication = await electron.launch({
      executablePath: process.env.EXECUTABLE_PATH,
    });

    const window = await app.firstWindow();
    expect(window).not.toBeNull();

    await window.waitForLoadState('domcontentloaded');

    const startupTime = Date.now() - startTime;
    console.log(`App startup time: ${formatDuration(startupTime)}`);

    await app.close();

    const passed = startupTime <= TARGET_STARTUP_TIME_MS;
    console.log(
      `App Startup: ${formatDuration(startupTime)} - ${passed ? 'PASS' : 'FAIL'} (threshold: ${formatDuration(TARGET_STARTUP_TIME_MS)})`,
    );

    expect(passed).toBe(true);
  });

  test('App reaches interactive state quickly', async () => {
    const startTime = Date.now();

    const app: ElectronApplication = await electron.launch({
      executablePath: process.env.EXECUTABLE_PATH,
    });

    const window = await app.firstWindow();

    await window.waitForLoadState('networkidle');

    const bodyVisible = await window.locator(SELECTORS.BODY).isVisible();
    expect(bodyVisible).toBe(true);

    const interactiveTime = Date.now() - startTime;
    console.log(`Time to interactive: ${formatDuration(interactiveTime)}`);

    await app.close();

    // Should be interactive within reasonable time
    expect(interactiveTime).toBeLessThan(TARGET_STARTUP_TIME_MS + 2000);
  });
});
