import { Page, test } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage.js';
import { RegistrationPage } from '../../pages/RegistrationPage.js';
import { TransactionPage } from '../../pages/TransactionPage.js';
import type { TransactionToolApp } from '../../utils/runtime/appSession.js';
import { createSeededLocalUserSession } from '../../utils/seeding/localUserSeeding.js';
import {
  setupLocalSuiteApp,
  teardownLocalSuiteApp,
} from '../helpers/bootstrap/localSuiteBootstrap.js';
import type { ActivatedTestIsolationContext } from '../../utils/setup/sharedTestEnvironment.js';

let app: TransactionToolApp;
let window: Page;
let loginPage: LoginPage;
let registrationPage: RegistrationPage;
let transactionPage: TransactionPage;
let isolationContext: ActivatedTestIsolationContext | null = null;
let seededPublicKey: string;

const ROOT_THRESHOLD_DEPTH = '0';

test.describe('Transaction complex key validation tests @local-basic', () => {
  test.beforeAll(async () => {
    ({ app, window, isolationContext } = await setupLocalSuiteApp(test.info()));
  });

  test.afterAll(async () => {
    await teardownLocalSuiteApp(app, isolationContext);
  });

  test.beforeEach(async () => {
    loginPage = new LoginPage(window);
    registrationPage = new RegistrationPage(window);
    transactionPage = new TransactionPage(window);
    const seededUser = await createSeededLocalUserSession(window, loginPage);
    seededPublicKey = seededUser.publicKey;
    await transactionPage.clickOnTransactionsMenuButton();
    await transactionPage.closeDraftModal();
  });

  // 5.13.6: Adding the same public key twice at the same threshold level surfaces a toast.
  test('Verify adding a duplicate public key at the same threshold level shows error toast', async () => {
    await transactionPage.openComplexKeyBuilderFromAccountCreate();
    await transactionPage.addPublicKeyAtDepth(ROOT_THRESHOLD_DEPTH, seededPublicKey);
    await transactionPage.addPublicKeyAtDepth(ROOT_THRESHOLD_DEPTH, seededPublicKey);
    await registrationPage.waitForToastMessageByVariant('error', 'already exists in the key list');
  });
});
