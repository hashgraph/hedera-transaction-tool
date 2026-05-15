import { expect } from '@playwright/test';
import type { TransactionPage } from '../../../pages/TransactionPage.js';
import type { GroupAccountCreateDraftValues } from '../flows/groupTransactionFlow.js';

export class GroupTransactionAssertions {
  constructor(private readonly transactionPage: TransactionPage) {}

  async assertAccountCreateTransactionValues(values: GroupAccountCreateDraftValues) {
    expect(await this.transactionPage.getTransactionTypeHeaderText()).toBe(
      'Account Create Transaction',
    );
    expect(await this.transactionPage.getInitialFundsValue()).toBe(values.initialFunds);
    expect(await this.transactionPage.getFilledMaxAccountAssociations()).toBe(
      values.maxAutoTokenAssociation,
    );
    expect(await this.transactionPage.getTransactionMemoText()).toBe(values.transactionMemo);
    expect(await this.transactionPage.getMemoText()).toBe(values.accountMemo);
  }

  async assertMirrorTransactionResult(txId: string, expectedType: string) {
    const transactionDetails = await this.transactionPage.mirrorGetTransactionResponse(txId);
    expect(transactionDetails?.name).toBe(expectedType);
    expect(transactionDetails?.entity_id).toBeTruthy();
    expect(transactionDetails?.result).toBe('SUCCESS');
  }
}
