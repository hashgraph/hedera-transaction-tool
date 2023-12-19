import axios from 'axios';

import { AccountId, EvmAddress, Hbar, HbarUnit, Key, PublicKey, Timestamp } from '@hashgraph/sdk';

import { decodeProtobuffKey } from './electronUtilsService';

import { MirrorNodeAllowance } from '../interfaces/MirrorNodeAllowance';
import { MirrorNodeAccountInfo } from '../interfaces/MirrorNodeAccountInfo';

export const getAccountInfo = async (accountId: string, mirrorNodeLink: string) => {
  const { data } = await axios.get(`${mirrorNodeLink}/accounts/${accountId}`);

  let key: Key | undefined;

  switch (data.key._type) {
    case 'ProtobufEncoded':
      key = await decodeProtobuffKey(data.key.key);
      break;
    case 'ED25519':
    case 'ECDSA_SECP256K1':
      key = PublicKey.fromString(data.key.key);
  }

  if (!key) {
    throw Error('No key available');
  }

  const accountInfo: MirrorNodeAccountInfo = {
    accountId: AccountId.fromString(data.account),
    alias: data.alias as string,
    balance: Hbar.from(data.balance.balance, HbarUnit.Tinybar),
    declineReward: Boolean(data.decline_reward),
    deleted: data.deleted,
    ethereumNonce: Number(data.ethereum_nonce),
    evmAddress: EvmAddress.fromString(data.evm_address),
    createdTimestamp: new Timestamp(
      data.created_timestamp.split('.')[0],
      data.created_timestamp.split('.')[1],
    ),
    expiryTimestamp: new Timestamp(
      data.expiry_timestamp.split('.')[0],
      data.expiry_timestamp.split('.')[1],
    ),
    key: key,
    maxAutomaticTokenAssociations: data.max_automatic_token_associations,
    memo: data.memo,
    pendingRewards: Hbar.from(data.pending_reward, HbarUnit.Tinybar),
    receiverSignatureRequired: Boolean(data.receiver_sig_required),
    stakedAccountId: data.staked_account_id ? AccountId.fromString(data.staked_account_id) : null,
    stakedNodeId: Number(data.staked_node_id),
    autoRenewPeriod: data.auto_renew_period,
  };

  return accountInfo;
};

export const getAccountAllowances = async (accountId: string, mirrorNodeLink: string) => {
  const { data } = await axios.get(`${mirrorNodeLink}/accounts/${accountId}/allowances/crypto`);

  const allowances: MirrorNodeAllowance[] = data.allowances;

  return allowances;
};
