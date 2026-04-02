import { Page } from '@playwright/test';
import {
  launchHederaTransactionTool as defaultLaunchHederaTransactionTool,
  type LaunchHederaTransactionToolOptions,
  type TransactionToolApp,
} from '../utils/electronAppLauncher.js';
import { migrationDataExists as defaultMigrationDataExists } from '../utils/oldTools.js';
import { LoginPage as DefaultLoginPage } from '../pages/LoginPage.js';

export const asciiArt =
  '\n' +
  ' ________ __    __        ________ ______   ______  __               ______  __    __ ________ ______  __       __  ______  ________ ______  ______  __    __ \n' +
  '/        /  |  /  |      /        /      \\ /      \\/  |             /      \\/  |  /  /        /      \\/  \\     /  |/      \\/        /      |/      \\/  \\  /  |\n' +
  '$$$$$$$$/$$ |  $$ |      $$$$$$$$/$$$$$$  /$$$$$$  $$ |            /$$$$$$  $$ |  $$ $$$$$$$$/$$$$$$  $$  \\   /$$ /$$$$$$  $$$$$$$$/$$$$$$//$$$$$$  $$  \\ $$ |\n' +
  '   $$ |  $$  \\/$$/          $$ | $$ |  $$ $$ |  $$ $$ |            $$ |__$$ $$ |  $$ |  $$ | $$ |  $$ $$$  \\ /$$$ $$ |__$$ |  $$ |    $$ | $$ |  $$ $$$  \\$$ |\n' +
  '   $$ |   $$  $$<           $$ | $$ |  $$ $$ |  $$ $$ |            $$    $$ $$ |  $$ |  $$ | $$ |  $$ $$$$  /$$$$ $$    $$ |  $$ |    $$ | $$ |  $$ $$$$  $$ |\n' +
  '   $$ |    $$$$  \\          $$ | $$ |  $$ $$ |  $$ $$ |            $$$$$$$$ $$ |  $$ |  $$ | $$ |  $$ $$ $$ $$/$$ $$$$$$$$ |  $$ |    $$ | $$ |  $$ $$ $$ $$ |\n' +
  '   $$ |   $$ /$$  |         $$ | $$ \\__$$ $$ \\__$$ $$ |_____       $$ |  $$ $$ \\__$$ |  $$ | $$ \\__$$ $$ |$$$/ $$ $$ |  $$ |  $$ |   _$$ |_$$ \\__$$ $$ |$$$$ |\n' +
  '   $$ |  $$ |  $$ |         $$ | $$    $$/$$    $$/$$       |      $$ |  $$ $$    $$/   $$ | $$    $$/$$ | $/  $$ $$ |  $$ |  $$ |  / $$   $$    $$/$$ | $$$ |\n' +
  '   $$/   $$/   $$/          $$/   $$$$$$/  $$$$$$/ $$$$$$$$/       $$/   $$/ $$$$$$/    $$/   $$$$$$/ $$/      $$/$$/   $$/   $$/   $$$$$$/ $$$$$$/ $$/   $$/ \n';

type LoginPageConstructor = new (window: Page) => DefaultLoginPage;

interface AppBootstrapperDependencies {
  launchHederaTransactionTool?: typeof defaultLaunchHederaTransactionTool;
  migrationDataExists?: typeof defaultMigrationDataExists;
  LoginPage?: LoginPageConstructor;
}

export interface SetupAppResult {
  app: TransactionToolApp;
  window: Page;
}

export interface SetupAppOptions extends LaunchHederaTransactionToolOptions {}

export class AppBootstrapper {
  private readonly launchApp: typeof defaultLaunchHederaTransactionTool;
  private readonly canMigrateData: typeof defaultMigrationDataExists;
  private readonly LoginPageClass: LoginPageConstructor;

  constructor({
    launchHederaTransactionTool = defaultLaunchHederaTransactionTool,
    migrationDataExists = defaultMigrationDataExists,
    LoginPage = DefaultLoginPage,
  }: AppBootstrapperDependencies = {}) {
    this.launchApp = launchHederaTransactionTool;
    this.canMigrateData = migrationDataExists;
    this.LoginPageClass = LoginPage;
  }

  async setupApp(options: SetupAppOptions = {}): Promise<SetupAppResult> {
    console.log(asciiArt);

    console.log('[setupApp] Initializing Hedera Transaction Tool session...');
    const app = await this.launchApp(options);

    const window = await app.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    const loginPage = this.createLoginPage(window);

    console.log('[setupApp] Clearing browser storage...');
    await window.evaluate(() => {
      globalThis.localStorage.clear();
      globalThis.sessionStorage.clear();
    });

    console.log('[setupApp] Handling startup modals...');
    await this.dismissStartupPrompts(window, loginPage);

    console.log('[setupApp] Checking if existing user session exists...');
    const isSettingsButtonVisible = await loginPage.isSettingsButtonVisible();
    console.log(`[setupApp] isSettingsButtonVisible: ${isSettingsButtonVisible}`);

    if (isSettingsButtonVisible) {
      console.log('[setupApp] Existing session detected -> resetting app state...');
      await this.resetAppState(window, app);
    }

    console.log('[setupApp] App ready.');

    return { app, window };
  }

  async resetAppState(window: Page, _app: TransactionToolApp): Promise<void> {
    const loginPage = this.createLoginPage(window);
    await loginPage.resetState();
    await this.dismissStartupPrompts(window, loginPage);
  }

  async closeApp(app?: TransactionToolApp | null): Promise<void> {
    if (!app) {
      return;
    }

    await app.close();
  }

  private createLoginPage(window: Page): DefaultLoginPage {
    return new this.LoginPageClass(window);
  }

  private async dismissStartupPrompts(window: Page, loginPage: DefaultLoginPage): Promise<void> {
    const canMigrate = await this.canMigrateData(window);
    console.log(`[setupApp] migrationDataExists: ${canMigrate}`);

    if (process.platform === 'darwin') {
      console.log('[setupApp] macOS detected -> checking Keychain modal...');
    }

    await loginPage.dismissStartupPrompts(canMigrate);
  }
}
