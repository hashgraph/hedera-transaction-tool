import { Page } from '@playwright/test';
import { SettingsPage as DefaultSettingsPage } from '../pages/SettingsPage.js';

type SettingsPageConstructor = new (window: Page) => DefaultSettingsPage;

interface KeyImportNavigatorDependencies {
  SettingsPage?: SettingsPageConstructor;
}

export class KeyImportNavigator {
  private readonly settingsPage: DefaultSettingsPage;

  constructor(window: Page, { SettingsPage = DefaultSettingsPage }: KeyImportNavigatorDependencies = {}) {
    this.settingsPage = new SettingsPage(window);
  }

  async openLocalnetEd25519Import(): Promise<void> {
    await this.openKeyImport(
      () => this.settingsPage.clickOnLocalNodeTab(),
      () => this.settingsPage.clickOnED25519DropDown(),
    );
  }

  async openTestnetEcdsaImport(): Promise<void> {
    await this.openKeyImport(
      () => this.settingsPage.clickOnTestnetTab(),
      () => this.settingsPage.clickOnECDSADropDown(),
    );
  }

  async openPreviewnetEcdsaImport(): Promise<void> {
    await this.openKeyImport(
      () => this.settingsPage.clickOnPreviewnetTab(),
      () => this.settingsPage.clickOnECDSADropDown(),
    );
  }

  async openCustomEd25519Import(mirrorNodeBaseUrl: string): Promise<void> {
    await this.openKeyImport(
      () => this.settingsPage.clickOnCustomNodeTab(),
      () => this.settingsPage.clickOnED25519DropDown(),
      mirrorNodeBaseUrl,
    );
  }

  async importEd25519PrivateKey(privateKey: string, nickname: string): Promise<void> {
    await this.settingsPage.importED25519PrivateKey(privateKey, nickname);
  }

  async importEcdsaPrivateKey(privateKey: string, nickname: string): Promise<void> {
    await this.settingsPage.importECDSAPrivateKey(privateKey, nickname);
  }

  async deleteKeyPairAtIndex(index: number): Promise<void> {
    await this.settingsPage.clickOnSettingsButton();
    await this.settingsPage.clickOnKeysTab();
    await this.settingsPage.clickOnDeleteButtonAtIndex(index);
    await this.settingsPage.clickOnDeleteKeyPairButton();
  }

  async reopenEd25519Import(): Promise<void> {
    await this.settingsPage.clickOnImportButton();
    await this.settingsPage.clickOnED25519DropDown();
  }

  private async openKeyImport(
    openNetworkTab: () => Promise<void>,
    openKeyTypeDropdown: () => Promise<void>,
    mirrorNodeBaseUrl?: string,
  ): Promise<void> {
    await this.settingsPage.clickOnSettingsButton();
    await openNetworkTab();

    if (mirrorNodeBaseUrl !== undefined) {
      await this.settingsPage.fillInMirrorNodeBaseURL(mirrorNodeBaseUrl);
    }

    await this.settingsPage.clickOnKeysTab();
    await this.settingsPage.clickOnImportButton();
    await openKeyTypeDropdown();
  }
}
