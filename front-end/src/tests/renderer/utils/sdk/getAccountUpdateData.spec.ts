import {
  AccountId,
  AccountUpdateTransaction,
  EvmAddress,
  Hbar,
  PrivateKey,
} from '@hiero-ledger/sdk';
import { getAccountUpdateData } from '@renderer/utils';
import type { IAccountInfoParsed } from '@shared/interfaces';

describe('getAccountUpdateData', () => {
  /*
        // AccountUpdateData
        accountId: string;

        // AccountData
        receiverSignatureRequired: boolean;
        declineStakingReward: boolean;
        maxAutomaticTokenAssociations: number;
        accountMemo: string;
        stakeType: 'Account' | 'Node' | 'None';
        stakedAccountId: string;
        stakedNodeId: number | null;
        ownerKey: Key | null;

   */

  const baseAccountInfo: IAccountInfoParsed = {
    accountId: AccountId.fromString('0.0.42'),
    alias: null,
    balance: new Hbar(2),
    declineReward: true,
    deleted: false,
    ethereumNonce: 7,
    evmAddress: EvmAddress.fromString('0x7df0b4d488e6bff2a598158e36fce9ae4474fe7b'),
    createdTimestamp: null,
    expiryTimestamp: null,
    key: null,
    maxAutomaticTokenAssociations: null,
    memo: null,
    pendingRewards: new Hbar(0),
    receiverSignatureRequired: false,
    stakedAccountId: null,
    stakedNodeId: null,
    autoRenewPeriod: null,
  };

  describe('accountId', () => {
    describe('accountInfo == null', () => {
      test('accountInfo == null + transaction.accountId == null', () => {
        const transaction = new AccountUpdateTransaction();
        const data = getAccountUpdateData(transaction, null);
        expect(data.accountId).toBe('');
      });

      test('accountInfo == null + transaction.accountId != null', () => {
        const transaction = new AccountUpdateTransaction();
        transaction.setAccountId(AccountId.fromString('0.0.42'));
        const data = getAccountUpdateData(transaction, null);
        expect(data.accountId).toBe('0.0.42');
      });
    });

    describe('accountInfo != null', () => {
      test('accountInfo.accountId != null + transaction.accountId == null', () => {
        const accountInfo = { ...baseAccountInfo };
        const transaction = new AccountUpdateTransaction();
        const data = getAccountUpdateData(transaction, accountInfo);
        expect(data.accountId).toBe('');
      });

      test('accountInfo.accountId != null + transaction.accountId != null', () => {
        const accountInfo = { ...baseAccountInfo, accountId: AccountId.fromString('0.0.42') };
        const transaction = new AccountUpdateTransaction();
        transaction.setAccountId(AccountId.fromString('0.0.43'));
        const data = getAccountUpdateData(transaction, accountInfo);
        expect(data.accountId).toBe('0.0.43');
      });
    });
  });

  describe('receiverSignatureRequired', () => {
    describe('accountInfo == null', () => {
      test('transaction.receiverSignatureRequired == null', () => {
        const transaction = new AccountUpdateTransaction();
        const data = getAccountUpdateData(transaction, null);
        expect(data.receiverSignatureRequired).toBe(false);
      });

      test('transaction.receiverSignatureRequired == false', () => {
        const transaction = new AccountUpdateTransaction();
        transaction.setReceiverSignatureRequired(false);
        const data = getAccountUpdateData(transaction, null);
        expect(data.receiverSignatureRequired).toBe(false);
      });

      test('transaction.receiverSignatureRequired == true', () => {
        const transaction = new AccountUpdateTransaction();
        transaction.setReceiverSignatureRequired(true);
        const data = getAccountUpdateData(transaction, null);
        expect(data.receiverSignatureRequired).toBe(true);
      });
    });

    describe('accountInfo != null', () => {
      describe('accountInfo.receiverSignatureRequired == false', () => {
        const accountInfo = { ...baseAccountInfo, receiverSignatureRequired: false };

        test('transaction.receiverSignatureRequired == null', () => {
          const transaction = new AccountUpdateTransaction();
          const data = getAccountUpdateData(transaction, accountInfo);
          expect(data.receiverSignatureRequired).toBe(false);
        });

        test('transaction.receiverSignatureRequired == false', () => {
          const transaction = new AccountUpdateTransaction();
          transaction.setReceiverSignatureRequired(false);
          const data = getAccountUpdateData(transaction, accountInfo);
          expect(data.receiverSignatureRequired).toBe(false);
        });

        test('transaction.receiverSignatureRequired == true', () => {
          const transaction = new AccountUpdateTransaction();
          transaction.setReceiverSignatureRequired(true);
          const data = getAccountUpdateData(transaction, accountInfo);
          expect(data.receiverSignatureRequired).toBe(true);
        });
      });

      describe('accountInfo.receiverSignatureRequired == true', () => {
        const accountInfo = { ...baseAccountInfo, receiverSignatureRequired: true };

        test('transaction.receiverSignatureRequired == null', () => {
          const transaction = new AccountUpdateTransaction();
          const data = getAccountUpdateData(transaction, accountInfo);
          expect(data.receiverSignatureRequired).toBe(true);
        });

        test('transaction.receiverSignatureRequired == false', () => {
          const transaction = new AccountUpdateTransaction();
          transaction.setReceiverSignatureRequired(false);
          const data = getAccountUpdateData(transaction, accountInfo);
          expect(data.receiverSignatureRequired).toBe(false);
        });

        test('transaction.receiverSignatureRequired == true', () => {
          const transaction = new AccountUpdateTransaction();
          transaction.setReceiverSignatureRequired(true);
          const data = getAccountUpdateData(transaction, accountInfo);
          expect(data.receiverSignatureRequired).toBe(true);
        });
      });
    });
  });

  describe('declineStakingReward', () => {
    describe('accountInfo == null', () => {
      test('transaction.declineStakingReward == null', () => {
        const transaction = new AccountUpdateTransaction();
        const data = getAccountUpdateData(transaction, null);
        expect(data.declineStakingReward).toBe(false);
      });

      test('transaction.declineStakingReward == false', () => {
        const transaction = new AccountUpdateTransaction();
        transaction.setDeclineStakingReward(false);
        const data = getAccountUpdateData(transaction, null);
        expect(data.declineStakingReward).toBe(false);
      });

      test('transaction.declineStakingReward == true', () => {
        const transaction = new AccountUpdateTransaction();
        transaction.setDeclineStakingReward(true);
        const data = getAccountUpdateData(transaction, null);
        expect(data.declineStakingReward).toBe(true);
      });
    });

    describe('accountInfo != null', () => {
      describe('accountInfo.declineStakingReward == false', () => {
        const accountInfo = { ...baseAccountInfo, declineReward: false };

        test('transaction.declineStakingReward == null', () => {
          const transaction = new AccountUpdateTransaction();
          const data = getAccountUpdateData(transaction, accountInfo);
          expect(data.declineStakingReward).toBe(false);
        });

        test('transaction.declineStakingReward == false', () => {
          const transaction = new AccountUpdateTransaction();
          transaction.setDeclineStakingReward(false);
          const data = getAccountUpdateData(transaction, accountInfo);
          expect(data.declineStakingReward).toBe(false);
        });

        test('transaction.declineStakingReward == true', () => {
          const transaction = new AccountUpdateTransaction();
          transaction.setDeclineStakingReward(true);
          const data = getAccountUpdateData(transaction, accountInfo);
          expect(data.declineStakingReward).toBe(true);
        });
      });

      describe('accountInfo.declineStakingReward == true', () => {
        const accountInfo = { ...baseAccountInfo, declineReward: true };

        test('transaction.receiverSignatureRequired == null', () => {
          const transaction = new AccountUpdateTransaction();
          const data = getAccountUpdateData(transaction, accountInfo);
          expect(data.declineStakingReward).toBe(true);
        });

        test('transaction.receiverSignatureRequired == false', () => {
          const transaction = new AccountUpdateTransaction();
          transaction.setDeclineStakingReward(false);
          const data = getAccountUpdateData(transaction, accountInfo);
          expect(data.declineStakingReward).toBe(false);
        });

        test('transaction.receiverSignatureRequired == true', () => {
          const transaction = new AccountUpdateTransaction();
          transaction.setDeclineStakingReward(true);
          const data = getAccountUpdateData(transaction, accountInfo);
          expect(data.declineStakingReward).toBe(true);
        });
      });
    });
  });

  describe('maxAutomaticTokenAssociations', () => {
    describe('accountInfo == null', () => {
      test('transaction.maxAutomaticTokenAssociations == null', () => {
        const transaction = new AccountUpdateTransaction();
        const data = getAccountUpdateData(transaction, null);
        expect(data.maxAutomaticTokenAssociations).toBe(0);
      });

      test('transaction.maxAutomaticTokenAssociations == 7', () => {
        const transaction = new AccountUpdateTransaction();
        transaction.setMaxAutomaticTokenAssociations(7);
        const data = getAccountUpdateData(transaction, null);
        expect(data.maxAutomaticTokenAssociations).toBe(7);
      });
    });

    describe('accountInfo != null', () => {
      describe('accountInfo.maxAutomaticTokenAssociations == null', () => {
        const accountInfo = { ...baseAccountInfo, maxAutomaticTokenAssociations: null };

        test('transaction.maxAutomaticTokenAssociations == null', () => {
          const transaction = new AccountUpdateTransaction();
          const data = getAccountUpdateData(transaction, accountInfo);
          expect(data.maxAutomaticTokenAssociations).toBe(0);
        });

        test('transaction.maxAutomaticTokenAssociations == 7', () => {
          const transaction = new AccountUpdateTransaction();
          transaction.setMaxAutomaticTokenAssociations(7);
          const data = getAccountUpdateData(transaction, accountInfo);
          expect(data.maxAutomaticTokenAssociations).toBe(7);
        });
      });

      describe('accountInfo.receiverSignatureRequired == 7', () => {
        const accountInfo = { ...baseAccountInfo, maxAutomaticTokenAssociations: 7 };

        test('transaction.receiverSignatureRequired == null', () => {
          const transaction = new AccountUpdateTransaction();
          const data = getAccountUpdateData(transaction, accountInfo);
          expect(data.maxAutomaticTokenAssociations).toBe(7);
        });

        test('transaction.receiverSignatureRequired == 8', () => {
          const transaction = new AccountUpdateTransaction();
          transaction.setMaxAutomaticTokenAssociations(8);
          const data = getAccountUpdateData(transaction, accountInfo);
          expect(data.maxAutomaticTokenAssociations).toBe(8);
        });
      });
    });
  });

  describe('accountMemo', () => {
    describe('accountInfo == null', () => {
      test('transaction.accountMemo == null', () => {
        const transaction = new AccountUpdateTransaction();
        const data = getAccountUpdateData(transaction, null);
        expect(data.accountMemo).toBe('');
      });

      test('transaction.accountMemo == ""', () => {
        const transaction = new AccountUpdateTransaction();
        transaction.setAccountMemo('');
        const data = getAccountUpdateData(transaction, null);
        expect(data.accountMemo).toBe('');
      });

      test('transaction.accountMemo == "nice memo"', () => {
        const transaction = new AccountUpdateTransaction();
        transaction.setAccountMemo('nice memo');
        const data = getAccountUpdateData(transaction, null);
        expect(data.accountMemo).toBe('nice memo');
      });
    });

    describe('accountInfo != null', () => {
      describe('accountInfo.memo == null', () => {
        const accountInfo = { ...baseAccountInfo, maxAutomaticTokenAssociations: null };

        test('transaction.accountMemo == null', () => {
          const transaction = new AccountUpdateTransaction();
          const data = getAccountUpdateData(transaction, accountInfo);
          expect(data.accountMemo).toBe('');
        });

        test('transaction.accountMemo == ""', () => {
          const transaction = new AccountUpdateTransaction();
          transaction.setAccountMemo('');
          const data = getAccountUpdateData(transaction, accountInfo);
          expect(data.accountMemo).toBe('');
        });

        test('transaction.accountMemo == "nice memo"', () => {
          const transaction = new AccountUpdateTransaction();
          transaction.setAccountMemo('nice memo');
          const data = getAccountUpdateData(transaction, accountInfo);
          expect(data.accountMemo).toBe('nice memo');
        });
      });

      describe('accountInfo.memo == ""', () => {
        const accountInfo = { ...baseAccountInfo, accountMemo: '' };

        test('transaction.accountMemo == null', () => {
          const transaction = new AccountUpdateTransaction();
          const data = getAccountUpdateData(transaction, accountInfo);
          expect(data.accountMemo).toBe('');
        });

        test('transaction.accountMemo == ""', () => {
          const transaction = new AccountUpdateTransaction();
          transaction.setAccountMemo('');
          const data = getAccountUpdateData(transaction, accountInfo);
          expect(data.accountMemo).toBe('');
        });

        test('transaction.accountMemo == "nice memo"', () => {
          const transaction = new AccountUpdateTransaction();
          transaction.setAccountMemo('nice memo');
          const data = getAccountUpdateData(transaction, accountInfo);
          expect(data.accountMemo).toBe('nice memo');
        });
      });

      describe('accountInfo.memo == "nice memo"', () => {
        const accountInfo = { ...baseAccountInfo, memo: 'nice memo' };

        test('transaction.accountMemo == null', () => {
          const transaction = new AccountUpdateTransaction();
          const data = getAccountUpdateData(transaction, accountInfo);
          expect(data.accountMemo).toBe('nice memo');
        });

        test('transaction.accountMemo == ""', () => {
          const transaction = new AccountUpdateTransaction();
          transaction.setAccountMemo('');
          const data = getAccountUpdateData(transaction, accountInfo);
          expect(data.accountMemo).toBe('');
        });

        test('transaction.accountMemo == "very nice memo"', () => {
          const transaction = new AccountUpdateTransaction();
          transaction.setAccountMemo('very nice memo');
          const data = getAccountUpdateData(transaction, accountInfo);
          expect(data.accountMemo).toBe('very nice memo');
        });
      });
    });
  });

  describe('ownerKey', () => {
    describe('accountInfo == null', () => {
      test('accountInfo == null + transaction.key == null', () => {
        const transaction = new AccountUpdateTransaction();
        const data = getAccountUpdateData(transaction, null);
        expect(data.ownerKey).toBe(null);
      });

      test('accountInfo == null + transaction.key != null', () => {
        const transaction = new AccountUpdateTransaction();
        const transactionKey = PrivateKey.generateECDSA().publicKey;
        transaction.setKey(transactionKey);
        const data = getAccountUpdateData(transaction, null);
        expect(data.ownerKey).toBe(transactionKey);
      });
    });

    describe('accountInfo != null', () => {
      test('accountInfo.key == null + transaction.key == null', () => {
        const accountInfo = { ...baseAccountInfo, key: null };
        const transaction = new AccountUpdateTransaction();
        const data = getAccountUpdateData(transaction, accountInfo);
        expect(data.ownerKey).toBe(null);
      });

      test('accountInfo.key != null + transaction.key == null', () => {
        const accountInfoKey = PrivateKey.generateECDSA().publicKey;
        const accountInfo = { ...baseAccountInfo, key: accountInfoKey };
        const transaction = new AccountUpdateTransaction();
        const data = getAccountUpdateData(transaction, accountInfo);
        expect(data.ownerKey).toBe(accountInfoKey);
      });

      test('accountInfo.key != null + transaction.key != null', () => {
        const accountInfo = { ...baseAccountInfo, accountId: AccountId.fromString('0.0.42') };
        const transaction = new AccountUpdateTransaction();
        const transactionKey = PrivateKey.generateECDSA().publicKey;
        transaction.setKey(transactionKey);
        const data = getAccountUpdateData(transaction, accountInfo);
        expect(data.ownerKey).toBe(transactionKey);
      });
    });
  });

  describe('stakeType + stakedAccountId + stakedNodeId', () => {
    describe('accountInfo == null', () => {
      test('accountInfo == null + transaction.stakedAccountId == null + transaction.stakedNodeId == null', () => {
        const transaction = new AccountUpdateTransaction();
        const data = getAccountUpdateData(transaction, null);
        expect(data.stakeType).toBe('None');
        expect(data.stakedAccountId).toBe('');
        expect(data.stakedNodeId).toBe(null);
      });

      test('accountInfo == null + transaction.stakedAccountId == 0.0.0 + transaction.stakedNodeId == null', () => {
        const transaction = new AccountUpdateTransaction();
        const stakedAccountId = AccountId.fromString('0.0.0');
        transaction.setStakedAccountId(stakedAccountId);
        const data = getAccountUpdateData(transaction, null);
        expect(data.stakeType).toBe('None');
        expect(data.stakedAccountId).toBe('');
        expect(data.stakedNodeId).toBe(null);
      });

      test('accountInfo == null + transaction.stakedAccountId == null + transaction.stakedNodeId == -1', () => {
        const transaction = new AccountUpdateTransaction();
        const stakedNodeId = -1;
        transaction.setStakedNodeId(stakedNodeId);
        const data = getAccountUpdateData(transaction, null);
        expect(data.stakeType).toBe('None');
        expect(data.stakedAccountId).toBe('');
        expect(data.stakedNodeId).toBe(null);
      });

      test('accountInfo == null + transaction.stakedAccountId != null + transaction.stakedNodeId == null', () => {
        const transaction = new AccountUpdateTransaction();
        const stakedAccountId = AccountId.fromString('0.0.42');
        transaction.setStakedAccountId(stakedAccountId);
        const data = getAccountUpdateData(transaction, null);
        expect(data.stakeType).toBe('Account');
        expect(data.stakedAccountId).toBe(stakedAccountId.toString());
        expect(data.stakedNodeId).toBe(null);
      });

      test('accountInfo == null + transaction.stakedAccountId == null + transaction.stakedNodeId != null', () => {
        const transaction = new AccountUpdateTransaction();
        const stakedNodeId = 42;
        transaction.setStakedNodeId(stakedNodeId);
        const data = getAccountUpdateData(transaction, null);
        expect(data.stakeType).toBe('Node');
        expect(data.stakedAccountId).toBe('');
        expect(data.stakedNodeId).toBe(stakedNodeId);
      });

      test('accountInfo == null + transaction.stakedAccountId == 0.0.0 + transaction.stakedNodeId != null', () => {
        const transaction = new AccountUpdateTransaction();
        const stakedAccountId = AccountId.fromString('0.0.0');
        transaction.setStakedAccountId(stakedAccountId);
        const stakedNodeId = 42;
        transaction.setStakedNodeId(stakedNodeId);
        const data = getAccountUpdateData(transaction, null);
        expect(data.stakeType).toBe('Node');
        expect(data.stakedAccountId).toBe('');
        expect(data.stakedNodeId).toBe(stakedNodeId);
      });
    });

    describe('accountInfo != null', () => {});
  });
});
