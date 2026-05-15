import { Page } from '@playwright/test';
import { TransactionPage as DefaultTransactionPage } from '../pages/TransactionPage.js';
import { generateEd25519KeyPair as defaultGenerateEd25519KeyPair } from '../utils/crypto/keyUtil.js';
import { KeyImportNavigator } from './KeyImportNavigator.js';
import {
  LOCALNET_OPERATOR_ACCOUNT,
  OPERATOR_ACCOUNT_NICKNAME,
  PAYER_ACCOUNT_NICKNAME,
} from '../constants/index.js';

type TransactionPageConstructor = new (window: Page) => DefaultTransactionPage;

interface LocalnetPayerProvisionerDependencies {
  TransactionPage?: TransactionPageConstructor;
  generateEd25519KeyPair?: typeof defaultGenerateEd25519KeyPair;
}

export class LocalnetPayerProvisioner {
  private readonly transactionPage: DefaultTransactionPage;
  private readonly generateKeyPair: typeof defaultGenerateEd25519KeyPair;

  constructor(
    window: Page,
    private readonly keyImportNavigator: KeyImportNavigator,
    {
      TransactionPage = DefaultTransactionPage,
      generateEd25519KeyPair = defaultGenerateEd25519KeyPair,
    }: LocalnetPayerProvisionerDependencies = {},
  ) {
    this.transactionPage = new TransactionPage(window);
    this.generateKeyPair = generateEd25519KeyPair;
  }

  async provisionPayerAccount(operatorKey: string): Promise<string> {
    await this.keyImportNavigator.importEd25519PrivateKey(operatorKey, OPERATOR_ACCOUNT_NICKNAME);

    const { publicKey, privateKey } = this.generateKeyPair();

    await this.createLocalnetPayerAccount(publicKey);
    await this.keyImportNavigator.deleteKeyPairAtIndex(1);
    await this.keyImportNavigator.reopenEd25519Import();
    await this.keyImportNavigator.importEd25519PrivateKey(privateKey, PAYER_ACCOUNT_NICKNAME);

    return privateKey;
  }

  private async createLocalnetPayerAccount(publicKey: string): Promise<void> {
    await this.transactionPage.clickOnTransactionsMenuButton();
    await this.transactionPage.createNewAccount({
      initialFunds: '10000',
      publicKey,
      payerAccountId: LOCALNET_OPERATOR_ACCOUNT,
    });
  }
}
