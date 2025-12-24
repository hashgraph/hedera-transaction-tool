import { AccountId, AccountUpdateTransaction, Key } from '@hashgraph/sdk';

import { TransactionBaseModel } from './transaction-base.model';
import TransactionFactory from './transaction-factory';

export default class AccountUpdateTransactionModel
  extends TransactionBaseModel<AccountUpdateTransaction> {

  static readonly TRANSACTION_TYPE = 'AccountUpdateTransaction';

  private readonly TREASURY_ACCOUNT = AccountId.fromString('0.0.2');
  private readonly ADMIN_ACCOUNT = AccountId.fromString('0.0.50');
  private readonly MINIMUM_SYSTEM_ACCOUNT = AccountId.fromString('0.0.3');
  private readonly MAXIMUM_SYSTEM_ACCOUNT = AccountId.fromString('0.0.1000');

  // New key is required:
  // https://docs.hedera.com/hedera/sdks-and-apis/sdks/accounts-and-hbar/update-an-account
  // UNLESS waived.
  getNewKeys(): Key[] {
    if (
      this.transaction.key != null &&
      !this.shouldWaiveSigningRequirements(this.transaction.accountId)
    ) {
      return [this.transaction.key];
    }
    return [];
  }

  // According to documentation, if account is between 3 and 1000 inclusive,
  // the key is not required IF the fee payer is 2 or 50. In all other cases, the key is required.
  // https://github.com/hiero-ledger/hiero-consensus-node/blob/main/hedera-node/docs/privileged-transactions.md#waived-signing-requirements-for-crypto-updates
  getSigningAccounts(): Set<string> {
    const set = super.getSigningAccounts();
    const accountId = this.transaction.accountId;
    if (accountId != null && !this.shouldWaiveSigningRequirements(accountId)) {
      set.add(accountId.toString());
    }
    return set;
  }

  private shouldWaiveSigningRequirements(accountId: AccountId): boolean {
    const feePayer = this.getFeePayerAccountId();
    return (
      this.isSystemAccount(accountId) &&
      this.isPrivilegedFeePayer(feePayer)
    );
  }

  private isSystemAccount(accountId: AccountId): boolean {
    return (
      accountId != null &&
      accountId.compare(this.MINIMUM_SYSTEM_ACCOUNT) >= 0 &&
      accountId.compare(this.MAXIMUM_SYSTEM_ACCOUNT) <= 0
    );
  }

  private isPrivilegedFeePayer(feePayer?: AccountId): boolean {
    return (
      feePayer != null &&
      (feePayer.equals(this.TREASURY_ACCOUNT) || feePayer.equals(this.ADMIN_ACCOUNT))
    );
  }
}

TransactionFactory.register(
  AccountUpdateTransactionModel.TRANSACTION_TYPE,
  AccountUpdateTransactionModel
);
