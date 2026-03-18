import { Page } from '@playwright/test';
import type { SettingsPage } from '../pages/SettingsPage.js';
import type { TransactionPage } from '../pages/TransactionPage.js';
import { KeyImportNavigator } from './KeyImportNavigator.js';
import { LocalnetPayerProvisioner } from './LocalnetPayerProvisioner.js';
import { TransactionEnvironmentConfig } from './TransactionEnvironmentConfig.js';
import { generateEd25519KeyPair } from '../utils/keyUtil.js';
import { CUSTOM, PAYER_ACCOUNT_NICKNAME, PREVIEWNET, TESTNET } from '../constants/index.js';

type SettingsPageConstructor = new (window: Page) => SettingsPage;
type TransactionPageConstructor = new (window: Page) => TransactionPage;

interface TransactionEnvironmentServiceDependencies {
  config?: TransactionEnvironmentConfig;
  keyImportNavigator?: KeyImportNavigator;
  localnetPayerProvisioner?: LocalnetPayerProvisioner;
  SettingsPage?: SettingsPageConstructor;
  TransactionPage?: TransactionPageConstructor;
  generateEd25519KeyPair?: typeof generateEd25519KeyPair;
}

export class TransactionEnvironmentService {
  private readonly config: TransactionEnvironmentConfig;
  private readonly keyImportNavigator: KeyImportNavigator;
  private readonly localnetPayerProvisioner: LocalnetPayerProvisioner;

  constructor(window: Page, dependencies: TransactionEnvironmentServiceDependencies = {}) {
    this.config = dependencies.config ?? new TransactionEnvironmentConfig();
    this.keyImportNavigator =
      dependencies.keyImportNavigator ??
      new KeyImportNavigator(window, { SettingsPage: dependencies.SettingsPage });
    this.localnetPayerProvisioner =
      dependencies.localnetPayerProvisioner ??
      new LocalnetPayerProvisioner(window, this.keyImportNavigator, {
        TransactionPage: dependencies.TransactionPage,
        generateEd25519KeyPair: dependencies.generateEd25519KeyPair,
      });
  }

  async setupEnvironmentForTransactions(
    privateKey: string | null = this.config.getPrivateKey(),
  ): Promise<string | null> {
    const network = this.config.getNormalizedNetwork();
    let resolvedPrivateKey = privateKey;
    console.log('[setupEnvironmentForTransactions] resolvedPrivateKey:', resolvedPrivateKey
      ? '[configured]'
      : '[missing]');

    if (this.config.isLocalnet()) {
      resolvedPrivateKey = await this.setupLocalnetTransactions(privateKey);
    } else if (network === TESTNET) {
      await this.setupTestnetTransactions(privateKey);
    } else if (network === PREVIEWNET) {
      await this.setupPreviewnetTransactions(privateKey);
    } else {
      await this.setupCustomTransactions(privateKey);
    }

    return resolvedPrivateKey;
  }

  private async setupLocalnetTransactions(privateKey: string | null): Promise<string> {
    await this.keyImportNavigator.openLocalnetEd25519Import();

    if (privateKey === null) {
      // No payer key is configured, so bootstrap one through the localnet operator account first.
      return this.localnetPayerProvisioner.provisionPayerAccount(this.config.getOperatorKey());
    }

    await this.keyImportNavigator.importEd25519PrivateKey(privateKey, PAYER_ACCOUNT_NICKNAME);
    return privateKey;
  }

  private async setupTestnetTransactions(privateKey: string | null): Promise<void> {
    console.log(`[setupEnvironmentForTransactions] branch: ${TESTNET}`);
    await this.keyImportNavigator.openTestnetEcdsaImport();
    await this.keyImportNavigator.importEcdsaPrivateKey(privateKey ?? '', PAYER_ACCOUNT_NICKNAME);
  }

  private async setupPreviewnetTransactions(privateKey: string | null): Promise<void> {
    console.log(`[setupEnvironmentForTransactions] branch: ${PREVIEWNET}`);
    await this.keyImportNavigator.openPreviewnetEcdsaImport();
    await this.keyImportNavigator.importEcdsaPrivateKey(privateKey ?? '', PAYER_ACCOUNT_NICKNAME);
  }

  private async setupCustomTransactions(privateKey: string | null): Promise<void> {
    console.log(`[setupEnvironmentForTransactions] branch: ${CUSTOM}`);
    await this.keyImportNavigator.openCustomEd25519Import(this.config.getCustomMirrorNodeBaseUrl());
    await this.keyImportNavigator.importEd25519PrivateKey(privateKey ?? '', PAYER_ACCOUNT_NICKNAME);
  }
}
