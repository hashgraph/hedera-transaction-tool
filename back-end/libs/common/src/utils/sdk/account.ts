import { AccountInfo, AccountInfoParsed, KeyType, decodeProtobuffKey } from '@app/common';
import {
  AccountId,
  EvmAddress,
  Hbar,
  HbarUnit,
  Key,
  PublicKey,
  Timestamp,
  TransactionId,
} from '@hashgraph/sdk';

export const parseAccountInfo = (accountInfo: AccountInfo) => {
  const accountInfoParsed: AccountInfoParsed = {
    accountId: parseAccountProperty(accountInfo, 'account'),
    alias: accountInfo.alias,
    balance: parseAccountProperty(accountInfo, 'balance'),
    declineReward: parseAccountProperty(accountInfo, 'decline_reward'),
    deleted: parseAccountProperty(accountInfo, 'deleted'),
    ethereumNonce: parseAccountProperty(accountInfo, 'ethereum_nonce'),
    evmAddress: parseAccountProperty(accountInfo, 'evm_address'),
    createdTimestamp: parseAccountProperty(accountInfo, 'created_timestamp'),
    expiryTimestamp: parseAccountProperty(accountInfo, 'expiry_timestamp'),
    key: parseAccountProperty(accountInfo, 'key'),
    maxAutomaticTokenAssociations: parseAccountProperty(
      accountInfo,
      'max_automatic_token_associations',
    ),
    memo: accountInfo.memo,
    pendingRewards: parseAccountProperty(accountInfo, 'pending_reward'),
    receiverSignatureRequired: parseAccountProperty(accountInfo, 'receiver_sig_required'),
    stakedAccountId: parseAccountProperty(accountInfo, 'staked_account_id'),
    stakedNodeId: parseAccountProperty(accountInfo, 'staked_node_id'),
    autoRenewPeriod: accountInfo.auto_renew_period,
  };

  return accountInfoParsed;
};

export function parseAccountProperty(
  accountInfo: AccountInfo,
  property: 'account' | 'staked_account_id',
): AccountId;
export function parseAccountProperty(
  accountInfo: AccountInfo,
  property: 'balance' | 'pending_reward',
): Hbar;
export function parseAccountProperty(
  accountInfo: AccountInfo,
  property: 'created_timestamp' | 'expiry_timestamp',
): Timestamp | null;
export function parseAccountProperty(accountInfo: AccountInfo, property: 'key'): Key | null;
export function parseAccountProperty(
  accountInfo: AccountInfo,
  property: 'decline_reward' | 'deleted' | 'receiver_sig_required',
): boolean;
export function parseAccountProperty(accountInfo: AccountInfo, property: 'evm_address'): EvmAddress;
export function parseAccountProperty(
  accountInfo: AccountInfo,
  property:
    | 'staked_node_id'
    | 'ethereum_nonce'
    | 'max_automatic_token_associations'
    | 'auto_renew_period',
): number | null;
export function parseAccountProperty(
  accountInfo: AccountInfo,
  property: 'stake_period_start' | 'memo' | 'alias',
): string | null;
export function parseAccountProperty(accountInfo: AccountInfo, property: keyof AccountInfo) {
  switch (property) {
    case 'account':
      return AccountId.fromString(accountInfo.account || '');
    case 'balance':
      return Hbar.from(accountInfo.balance?.balance || 0, HbarUnit.Tinybar);
    case 'created_timestamp':
      return accountInfo.created_timestamp
        ? new Timestamp(
            Number(accountInfo.created_timestamp.split('.')[0]),
            Number(accountInfo.created_timestamp.split('.')[1]),
          )
        : null;
    case 'expiry_timestamp':
      return accountInfo.expiry_timestamp
        ? new Timestamp(
            Number(accountInfo.expiry_timestamp.split('.')[0]),
            Number(accountInfo.expiry_timestamp.split('.')[1]),
          )
        : null;
    case 'decline_reward':
      return Boolean(accountInfo.decline_reward);
    case 'deleted':
      return Boolean(accountInfo.deleted);
    case 'ethereum_nonce':
      return accountInfo.ethereum_nonce ? Number(accountInfo.ethereum_nonce) : null;
    case 'evm_address':
      return EvmAddress.fromString(accountInfo.evm_address || '');
    case 'key':
      switch (accountInfo.key._type) {
        case KeyType.ProtobufEncoded:
          return decodeProtobuffKey(accountInfo.key.key);
        case KeyType.ED25519:
          return PublicKey.fromStringED25519(accountInfo.key.key);
        case KeyType.ECDSA_SECP256K1:
          return PublicKey.fromStringECDSA(accountInfo.key.key);
        default:
          return null;
      }
    case 'max_automatic_token_associations':
      return accountInfo.max_automatic_token_associations
        ? Number(accountInfo.max_automatic_token_associations)
        : null;
    case 'pending_reward':
      return Hbar.from(accountInfo.pending_reward || 0, HbarUnit.Tinybar);
    case 'receiver_sig_required':
      return Boolean(accountInfo.receiver_sig_required);
    case 'staked_account_id':
      return accountInfo.staked_account_id
        ? AccountId.fromString(accountInfo.staked_account_id)
        : null;
    case 'staked_node_id':
      return accountInfo.staked_node_id ? Number(accountInfo.staked_node_id) : null;
    case 'auto_renew_period':
      return accountInfo.auto_renew_period ? Number(accountInfo.auto_renew_period) : null;
    case 'memo':
      return accountInfo.memo;
    case 'alias':
      return accountInfo.alias;
    case 'stake_period_start':
      return accountInfo.stake_period_start;
    default:
      throw new Error(`Unknown account info  property: ${property}`);
  }
}

export const isAccountId = (accountId: string) => {
  try {
    AccountId.fromString(accountId);
    return true;
  } catch (error) {
    return false;
  }
};

export const isTransactionId = (transactionId: string) => {
  try {
    TransactionId.fromString(transactionId);
    return true;
  } catch (error) {
    return false;
  }
};
