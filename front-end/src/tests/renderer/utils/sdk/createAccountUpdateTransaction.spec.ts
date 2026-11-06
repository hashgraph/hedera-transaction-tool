import type { IAccountInfoParsed } from '@shared/interfaces';
import {
  type AccountUpdateData,
  createAccountUpdateTransaction,
  type TransactionCommonData,
} from '@renderer/utils';
import { AccountId, EvmAddress, Hbar, PrivateKey, Transaction } from '@hiero-ledger/sdk';

describe('createAccountUpdateTransaction', () => {
  const common: TransactionCommonData = {
    payerId: '0.0.2',
    validStart: new Date(Date.now() + 60_000),
    maxTransactionFee: new Hbar(2),
    transactionMemo: '',
  };
  const accountUpdateData: AccountUpdateData = {
    accountId: '',
    receiverSignatureRequired: false,
    declineStakingReward: false,
    maxAutomaticTokenAssociations: 0,
    accountMemo: '',
    stakeType: 'None',
    stakedAccountId: '',
    stakedNodeId: null,
    ownerKey: null,
  };
  const data = {
    ...common,
    ...accountUpdateData,
  };
  const baseAccountInfo: IAccountInfoParsed = {
    accountId: AccountId.fromString('0.0.42'),
    alias: null,
    balance: new Hbar(0),
    declineReward: false,
    deleted: false,
    ethereumNonce: 0,
    evmAddress: EvmAddress.fromString('0x000000000000000000000000000000000000002a'),
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
  function roundtrip<T extends Transaction>(tx: T): T {
    tx.setNodeAccountIds([AccountId.fromString('0.0.3')]);
    tx.freeze();
    return Transaction.fromBytes(tx.toBytes()) as T;
  }

  //
  // =============================================================================================
  //
  describe('accountId', () => {
    describe('accountInfo == null', () => {
      test('accountId == "" ', () => {
        const modifiedData = { ...data, accountId: '' };
        const tx = roundtrip(createAccountUpdateTransaction(modifiedData, null));
        expect(tx.accountId).toBe(null);
      });

      test('accountMemo == 0.0.123', () => {
        const modifiedData = { ...data, accountId: '0.0.123' };
        const tx = roundtrip(createAccountUpdateTransaction(modifiedData, null));
        expect(tx.accountId?.toString()).toBe('0.0.123');
      });
    });

    describe('accountInfo != null', () => {
      describe('accountInfo.accountId == "0.0.123" ', () => {
        const accountInfo = { ...baseAccountInfo, accountId: AccountId.fromString('0.0.123') };

        test('accountId == "" ', () => {
          const modifiedData = { ...data, accountId: '' };
          const tx = roundtrip(createAccountUpdateTransaction(modifiedData, accountInfo));
          expect(tx.accountId).toBe(null);
        });

        test('accountId == 0.0.234', () => {
          const modifiedData = { ...data, accountId: '0.0.234' };
          const tx = roundtrip(createAccountUpdateTransaction(modifiedData, accountInfo));
          expect(tx.accountId?.toString()).toBe('0.0.234');
        });
      });
    });
  });

  //
  // =============================================================================================
  //
  describe('receiverSignatureRequired', () => {
    describe('accountInfo == null', () => {
      test('receiverSignatureRequired == false ', () => {
        const modifiedData = { ...data, receiverSignatureRequired: false };
        const tx = roundtrip(createAccountUpdateTransaction(modifiedData, null));
        expect(tx.receiverSignatureRequired).toBe(null);
      });
      test('receiverSignatureRequired == true ', () => {
        const modifiedData = { ...data, receiverSignatureRequired: true };
        const tx = roundtrip(createAccountUpdateTransaction(modifiedData, null));
        expect(tx.receiverSignatureRequired).toBe(true);
      });
    });

    describe('accountInfo != null', () => {
      describe('accountInfo.receiverSignatureRequired == false', () => {
        const accountInfo = { ...baseAccountInfo, receiverSignatureRequired: false };

        test('data.receiverSignatureRequired == false ', () => {
          const modifiedData = { ...data, receiverSignatureRequired: false };
          const tx = roundtrip(createAccountUpdateTransaction(modifiedData, accountInfo));
          expect(tx.receiverSignatureRequired).toBe(null);
        });

        test('data.receiverSignatureRequired == true', () => {
          const modifiedData = { ...data, receiverSignatureRequired: true };
          const tx = roundtrip(createAccountUpdateTransaction(modifiedData, accountInfo));
          expect(tx.receiverSignatureRequired).toBe(true);
        });
      });

      describe('accountInfo.receiverSignatureRequired == true', () => {
        const accountInfo = { ...baseAccountInfo, receiverSignatureRequired: true };

        test('data.receiverSignatureRequired == false ', () => {
          const modifiedData = { ...data, receiverSignatureRequired: false };
          const tx1 = createAccountUpdateTransaction(modifiedData, accountInfo);
          expect(tx1.receiverSignatureRequired).toBe(false);
          const tx2 = roundtrip(tx1);
          expect(tx2.receiverSignatureRequired).toBe(null); // roundrip() transforms false in null
        });

        test('data.receiverSignatureRequired == true', () => {
          const modifiedData = { ...data, receiverSignatureRequired: true };
          const tx = roundtrip(createAccountUpdateTransaction(modifiedData, accountInfo));
          expect(tx.receiverSignatureRequired).toBe(null);
        });
      });
    });
  });

  //
  // =============================================================================================
  //
  describe('declineStakingReward', () => {
    describe('accountInfo == null', () => {
      test('data.declineStakingReward == false ', () => {
        const modifiedData = { ...data, declineStakingReward: false };
        const tx = roundtrip(createAccountUpdateTransaction(modifiedData, null));
        expect(tx.declineStakingRewards).toBe(null);
      });

      test('data.declineStakingReward == true ', () => {
        const modifiedData = { ...data, declineStakingReward: true };
        const tx = roundtrip(createAccountUpdateTransaction(modifiedData, null));
        expect(tx.declineStakingRewards).toBe(true);
      });
    });

    describe('accountInfo != null', () => {
      describe('accountInfo.declineReward == false', () => {
        const accountInfo = { ...baseAccountInfo, declineReward: false };

        test('data.declineStakingReward == false ', () => {
          const modifiedData = { ...data, declineStakingReward: false };
          const tx = roundtrip(createAccountUpdateTransaction(modifiedData, accountInfo));
          expect(tx.declineStakingRewards).toBe(null);
        });

        test('data.declineStakingReward == true ', () => {
          const modifiedData = { ...data, declineStakingReward: true };
          const tx = roundtrip(createAccountUpdateTransaction(modifiedData, accountInfo));
          expect(tx.declineStakingRewards).toBe(true);
        });
      });

      describe('accountInfo.declineReward == true', () => {
        const accountInfo = { ...baseAccountInfo, declineReward: true };

        test('data.declineStakingReward == false ', () => {
          const modifiedData = { ...data, declineStakingReward: false };
          const tx1 = createAccountUpdateTransaction(modifiedData, accountInfo);
          expect(tx1.declineStakingRewards).toBe(false);
          const tx2 = roundtrip(tx1);
          expect(tx2.declineStakingRewards).toBe(null); // roundTrip() transforms false to null
        });

        test('data.declineStakingReward == true ', () => {
          const modifiedData = { ...data, declineStakingReward: true };
          const tx = roundtrip(createAccountUpdateTransaction(modifiedData, accountInfo));
          expect(tx.declineStakingRewards).toBe(null);
        });
      });
    });
  });

  //
  // =============================================================================================
  //
  describe('maxAutomaticTokenAssociations', () => {
    describe('accountInfo == null', () => {
      test('data.maxAutomaticTokenAssociations == 0 ', () => {
        const modifiedData = { ...data, maxAutomaticTokenAssociations: 0 };
        const tx1 = createAccountUpdateTransaction(modifiedData, null);
        expect(tx1.maxAutomaticTokenAssociations?.toNumber()).toBe(0);
        const tx2 = roundtrip(tx1);
        expect(tx2.maxAutomaticTokenAssociations).toBe(null); // roundTrip() transforms 0 in null
      });

      test('data.maxAutomaticTokenAssociations == 7 ', () => {
        const modifiedData = { ...data, maxAutomaticTokenAssociations: 7 };
        const tx = roundtrip(createAccountUpdateTransaction(modifiedData, null));
        expect(tx.maxAutomaticTokenAssociations?.toNumber()).toBe(7);
      });
    });

    describe('accountInfo != null', () => {
      describe('accountInfo.maxAutomaticTokenAssociations == null', () => {
        const accountInfo = { ...baseAccountInfo, maxAutomaticTokenAssociations: null };

        test('data.maxAutomaticTokenAssociations == 0 ', () => {
          const modifiedData = { ...data, maxAutomaticTokenAssociations: 0 };
          const tx1 = createAccountUpdateTransaction(modifiedData, accountInfo);
          expect(tx1.maxAutomaticTokenAssociations?.toNumber()).toBe(0);
          const tx2 = roundtrip(tx1);
          expect(tx2.maxAutomaticTokenAssociations).toBe(null); // roundTrip() transforms 0 in null
        });

        test('data.maxAutomaticTokenAssociations == 7 ', () => {
          const modifiedData = { ...data, maxAutomaticTokenAssociations: 7 };
          const tx = roundtrip(createAccountUpdateTransaction(modifiedData, accountInfo));
          expect(tx.maxAutomaticTokenAssociations?.toNumber()).toBe(7);
        });
      });

      describe('accountInfo.maxAutomaticTokenAssociations == 0', () => {
        const accountInfo = { ...baseAccountInfo, maxAutomaticTokenAssociations: 0 };

        test('data.maxAutomaticTokenAssociations == 0 ', () => {
          const modifiedData = { ...data, maxAutomaticTokenAssociations: 0 };
          const tx = createAccountUpdateTransaction(modifiedData, accountInfo);
          expect(tx.maxAutomaticTokenAssociations).toBe(null);
        });

        test('data.maxAutomaticTokenAssociations == 7 ', () => {
          const modifiedData = { ...data, maxAutomaticTokenAssociations: 7 };
          const tx = roundtrip(createAccountUpdateTransaction(modifiedData, accountInfo));
          expect(tx.maxAutomaticTokenAssociations?.toNumber()).toBe(7);
        });
      });

      describe('accountInfo.maxAutomaticTokenAssociations == 7', () => {
        const accountInfo = { ...baseAccountInfo, maxAutomaticTokenAssociations: 7 };

        test('data.maxAutomaticTokenAssociations == 0 ', () => {
          const modifiedData = { ...data, maxAutomaticTokenAssociations: 0 };
          const tx1 = createAccountUpdateTransaction(modifiedData, accountInfo);
          expect(tx1.maxAutomaticTokenAssociations?.toNumber()).toBe(0);
          const tx2 = roundtrip(tx1);
          expect(tx2.maxAutomaticTokenAssociations).toBe(null); // roundTrip() transforms 0 in null
        });

        test('data.maxAutomaticTokenAssociations == 7 ', () => {
          const modifiedData = { ...data, maxAutomaticTokenAssociations: 7 };
          const tx = roundtrip(createAccountUpdateTransaction(modifiedData, accountInfo));
          expect(tx.maxAutomaticTokenAssociations).toBe(null);
        });

        test('data.maxAutomaticTokenAssociations == 8 ', () => {
          const modifiedData = { ...data, maxAutomaticTokenAssociations: 8 };
          const tx = roundtrip(createAccountUpdateTransaction(modifiedData, accountInfo));
          expect(tx.maxAutomaticTokenAssociations?.toNumber()).toBe(8);
        });
      });
    });
  });

  //
  // =============================================================================================
  //
  describe('accountMemo', () => {
    describe('accountInfo == null', () => {
      test('accountMemo == "" ', () => {
        const modifiedData = { ...data, accountMemo: '' };
        const tx = roundtrip(createAccountUpdateTransaction(modifiedData, null));
        expect(tx.accountMemo).toBe(null);
      });

      test('accountMemo == abc', () => {
        const modifiedData = { ...data, accountMemo: 'abc' };
        const tx = roundtrip(createAccountUpdateTransaction(modifiedData, null));
        expect(tx.accountMemo).toBe('abc');
      });
    });

    describe('accountInfo != null', () => {
      describe('accountInfo.memo == null', () => {
        const accountInfo = { ...baseAccountInfo, memo: null };

        test('accountMemo == "" ', () => {
          const modifiedData = { ...data, accountMemo: '' };
          const tx = roundtrip(createAccountUpdateTransaction(modifiedData, accountInfo));
          expect(tx.accountMemo).toBe(null);
        });

        test('accountMemo == abc', () => {
          const modifiedData = { ...data, accountMemo: 'abc' };
          const tx = roundtrip(createAccountUpdateTransaction(modifiedData, accountInfo));
          expect(tx.accountMemo).toBe('abc');
        });
      });

      describe('accountInfo.memo == "" ', () => {
        const accountInfo = { ...baseAccountInfo, memo: '' };

        test('accountMemo == "" ', () => {
          const modifiedData = { ...data, accountMemo: '' };
          const tx = roundtrip(createAccountUpdateTransaction(modifiedData, accountInfo));
          expect(tx.accountMemo).toBe(null);
        });

        test('accountMemo == abc', () => {
          const modifiedData = { ...data, accountMemo: 'abc' };
          const tx = roundtrip(createAccountUpdateTransaction(modifiedData, accountInfo));
          expect(tx.accountMemo).toBe('abc');
        });
      });

      describe('accountInfo.memo == abc', () => {
        const accountInfo = { ...baseAccountInfo, memo: 'abc' };

        test('accountMemo == "" ', () => {
          const modifiedData = { ...data, accountMemo: '' };
          const tx1 = createAccountUpdateTransaction(modifiedData, accountInfo);
          expect(tx1.accountMemo).toBe('');
          const tx2 = roundtrip(tx1);
          expect(tx2.accountMemo).toBe(null); // roundtrip() transforms '' into null (?)
        });

        test('accountMemo == abc', () => {
          const modifiedData = { ...data, accountMemo: 'cde' };
          const tx = roundtrip(createAccountUpdateTransaction(modifiedData, accountInfo));
          expect(tx.accountMemo).toBe('cde');
        });
      });
    });
  });

  //
  // =============================================================================================
  //
  describe('stakeType + stakedAccountId + stakedNodeId', () => {
    describe('accountInfo == null', () => {
      test('data.stakeType == None', () => {
        const modifiedData = {
          ...data,
          stakeType: 'None' as 'Account' | 'Node' | 'None',
          stakedAccountId: '0.0.123', // Will be ignored
          stakedNodeId: 42, // Will be ignored
        };
        const tx = roundtrip(createAccountUpdateTransaction(modifiedData, null));
        expect(tx.stakedAccountId).toBe(null);
        expect(tx.stakedNodeId).toBe(null);
      });

      test('data.stakeType == Account + data.stakedAccountId == 0.0.123', () => {
        const modifiedData = {
          ...data,
          stakeType: 'Account' as 'Account' | 'Node' | 'None',
          stakedAccountId: '0.0.123',
          stakedNodeId: 42, // Will be ignored
        };
        const tx = roundtrip(createAccountUpdateTransaction(modifiedData, null));
        expect(tx.stakedAccountId?.toString()).toBe('0.0.123');
        expect(tx.stakedNodeId).toBe(null);
      });

      test('data.stakeType == Node + data.stakedNodeId == 42', () => {
        const modifiedData = {
          ...data,
          stakeType: 'Node' as 'Account' | 'Node' | 'None',
          stakedAccountId: '0.0.123', // Will be ignored
          stakedNodeId: 42,
        };
        const tx = roundtrip(createAccountUpdateTransaction(modifiedData, null));
        expect(tx.stakedAccountId).toBe(null);
        expect(tx.stakedNodeId?.toNumber()).toBe(42);
      });
    });

    describe('accountInfo != null', () => {
      describe('accountInfo.stakedAccountId == null + accountInfo.stakedNodeId == null', () => {
        const accountInfo = {
          ...baseAccountInfo,
          stakedAccountId: null,
          stakedNodeId: null,
        };

        test('data.stakeType == None', () => {
          const modifiedData = {
            ...data,
            stakeType: 'None' as 'Account' | 'Node' | 'None',
            stakedAccountId: '0.0.123', // Should be ignored
            stakedNodeId: 42, // Should be ignored
          };
          const tx = roundtrip(createAccountUpdateTransaction(modifiedData, accountInfo));
          expect(tx.stakedAccountId).toBe(null);
          expect(tx.stakedNodeId).toBe(null);
        });

        test('data.stakeType == Account + data.stakedAccountId == 0.0.123', () => {
          const modifiedData = {
            ...data,
            stakeType: 'Account' as 'Account' | 'Node' | 'None',
            stakedAccountId: '0.0.123',
            stakedNodeId: 42, // Should be ignored
          };
          const tx = roundtrip(createAccountUpdateTransaction(modifiedData, accountInfo));
          expect(tx.stakedAccountId?.toString()).toBe('0.0.123');
          expect(tx.stakedNodeId).toBe(null);
        });

        test('data.stakeType == Node + data.stakedNodeId == 42', () => {
          const modifiedData = {
            ...data,
            stakeType: 'Node' as 'Account' | 'Node' | 'None',
            stakedAccountId: '0.0.123', // Should be ignored
            stakedNodeId: 42,
          };
          const tx = roundtrip(createAccountUpdateTransaction(modifiedData, accountInfo));
          expect(tx.stakedAccountId).toBe(null);
          expect(tx.stakedNodeId?.toNumber()).toBe(42);
        });
      });

      describe('accountInfo.stakedAccountId == 0.0.123 + accountInfo.stakedNodeId == null', () => {
        const accountInfo = {
          ...baseAccountInfo,
          stakedAccountId: AccountId.fromString('0.0.123'),
          stakedNodeId: null,
        };

        test('data.stakeType == None', () => {
          const modifiedData = {
            ...data,
            stakeType: 'None' as 'Account' | 'Node' | 'None',
            stakedAccountId: '0.0.123', // Should be ignored
            stakedNodeId: 42, // Should be ignored
          };
          const tx = roundtrip(createAccountUpdateTransaction(modifiedData, accountInfo));
          expect(tx.stakedAccountId?.toString()).toBe('0.0.0');
          expect(tx.stakedNodeId).toBe(null);
        });

        test('data.stakeType == Account + data.stakedAccountId == 0.0.123', () => {
          const modifiedData = {
            ...data,
            stakeType: 'Account' as 'Account' | 'Node' | 'None',
            stakedAccountId: '0.0.123',
            stakedNodeId: 42, // Should be ignored
          };
          const tx = roundtrip(createAccountUpdateTransaction(modifiedData, accountInfo));
          expect(tx.stakedAccountId).toBe(null);
          expect(tx.stakedNodeId).toBe(null);
        });

        test('data.stakeType == Account + data.stakedAccountId == 0.0.234', () => {
          const modifiedData = {
            ...data,
            stakeType: 'Account' as 'Account' | 'Node' | 'None',
            stakedAccountId: '0.0.234',
            stakedNodeId: 42, // Should be ignored
          };
          const tx = roundtrip(createAccountUpdateTransaction(modifiedData, accountInfo));
          expect(tx.stakedAccountId?.toString()).toBe('0.0.234');
          expect(tx.stakedNodeId).toBe(null);
        });

        test('data.stakeType == Node + data.stakedNodeId == 42', () => {
          const modifiedData = {
            ...data,
            stakeType: 'Node' as 'Account' | 'Node' | 'None',
            stakedAccountId: '0.0.234', // Should be ignored
            stakedNodeId: 42,
          };
          const tx = roundtrip(createAccountUpdateTransaction(modifiedData, accountInfo));
          expect(tx.stakedAccountId).toBe(null);
          expect(tx.stakedNodeId?.toNumber()).toBe(42);
        });
      });

      describe('accountInfo.stakedAccountId == null + accountInfo.stakedNodeId == 42', () => {
        const accountInfo = {
          ...baseAccountInfo,
          stakedAccountId: null,
          stakedNodeId: 42,
        };

        test('data.stakeType == None', () => {
          const modifiedData = {
            ...data,
            stakeType: 'None' as 'Account' | 'Node' | 'None',
            stakedAccountId: '0.0.123', // Should be ignored
            stakedNodeId: 42, // Should be ignored
          };
          const tx = roundtrip(createAccountUpdateTransaction(modifiedData, accountInfo));
          expect(tx.stakedAccountId).toBe(null);
          expect(tx.stakedNodeId?.toNumber()).toBe(-1);
        });

        test('data.stakeType == Account + data.stakedAccountId == 0.0.123', () => {
          const modifiedData = {
            ...data,
            stakeType: 'Account' as 'Account' | 'Node' | 'None',
            stakedAccountId: '0.0.123',
            stakedNodeId: 42, // Should be ignored
          };
          const tx = roundtrip(createAccountUpdateTransaction(modifiedData, accountInfo));
          expect(tx.stakedAccountId?.toString()).toBe('0.0.123'); // roundTrip transform '0.0.123' as null
          expect(tx.stakedNodeId).toBe(null);
        });

        test('data.stakeType == Node + data.stakedNodeId == 42', () => {
          const modifiedData = {
            ...data,
            stakeType: 'Node' as 'Account' | 'Node' | 'None',
            stakedAccountId: '0.0.234', // Should be ignored
            stakedNodeId: 42,
          };
          const tx = roundtrip(createAccountUpdateTransaction(modifiedData, accountInfo));
          expect(tx.stakedAccountId).toBe(null);
          expect(tx.stakedNodeId).toBe(null);
        });

        test('data.stakeType == Node + data.stakedNodeId == 43', () => {
          const modifiedData = {
            ...data,
            stakeType: 'Node' as 'Account' | 'Node' | 'None',
            stakedAccountId: '0.0.234', // Should be ignored
            stakedNodeId: 43,
          };
          const tx = roundtrip(createAccountUpdateTransaction(modifiedData, accountInfo));
          expect(tx.stakedAccountId).toBe(null);
          expect(tx.stakedNodeId?.toNumber()).toBe(43);
        });
      });
    });
  });

  //
  // =============================================================================================
  //
  describe('ownerKey', () => {
    describe('accountInfo == null', () => {
      test('data.ownerKey == null ', () => {
        const modifiedData = { ...data, ownerKey: null };
        const tx = roundtrip(createAccountUpdateTransaction(modifiedData, null));
        expect(tx.key).toBe(null);
      });

      test('data.ownerKey != null ', () => {
        const datakey = PrivateKey.generateECDSA().publicKey;
        const modifiedData = { ...data, ownerKey: datakey };
        const tx = roundtrip(createAccountUpdateTransaction(modifiedData, null));
        expect(tx.key?.toString()).toBe(datakey.toString());
      });
    });

    describe('accountInfo != null', () => {
      describe('accountInfo.key == null', () => {
        const accountInfo = { ...baseAccountInfo, key: null };

        test('data.ownerKey == null ', () => {
          const modifiedData = { ...data, ownerKey: null };
          const tx = roundtrip(createAccountUpdateTransaction(modifiedData, accountInfo));
          expect(tx.key).toBe(null);
        });

        test('data.ownerKey != null ', () => {
          const dataKey = PrivateKey.generateECDSA().publicKey;
          const modifiedData = { ...data, ownerKey: dataKey };
          const tx = roundtrip(createAccountUpdateTransaction(modifiedData, accountInfo));
          expect(tx.key?.toString()).toBe(dataKey.toString());
        });
      });

      describe('accountInfo.key != null', () => {
        const accountInfoKey = PrivateKey.generateECDSA().publicKey;
        const accountInfo = { ...baseAccountInfo, key: accountInfoKey };

        test('data.ownerKey == null ', () => {
          const modifiedData = { ...data, ownerKey: null };
          const tx = roundtrip(createAccountUpdateTransaction(modifiedData, accountInfo));
          expect(tx.key).toBe(null);
        });

        test('data.ownerKey != null ', () => {
          const dataKey = PrivateKey.generateECDSA().publicKey;
          const modifiedData = { ...data, ownerKey: dataKey };
          const tx = roundtrip(createAccountUpdateTransaction(modifiedData, accountInfo));
          expect(tx.key?.toString()).toBe(dataKey.toString());
        });
      });
    });
  });
});

