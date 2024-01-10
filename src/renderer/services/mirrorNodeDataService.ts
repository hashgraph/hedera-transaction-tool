import axios from 'axios';

import { AccountId, EvmAddress, Hbar, HbarUnit, Key, PublicKey, Timestamp } from '@hashgraph/sdk';

import { decodeProtobuffKey } from './electronUtilsService';

import {
  IMirrorNodeAccountInfo,
  IMirrorNodeAllowance,
  NetworkExchangeRateSetResponse,
} from '../../main/shared/interfaces';

/* Mirror node data service */

/* Gets the account information by account id */
export const getAccountInfo = async (
  accountId: string,
  mirrorNodeLink: string,
  controller?: AbortController,
) => {
  const { data } = await axios.get(`${mirrorNodeLink}/accounts/${accountId}`, {
    signal: controller?.signal,
  });

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

  const accountInfo: IMirrorNodeAccountInfo = {
    accountId: AccountId.fromString(data.account),
    alias: data.alias as string,
    balance: Hbar.from(data.balance.balance, HbarUnit.Tinybar),
    declineReward: Boolean(data.decline_reward),
    deleted: data.deleted,
    ethereumNonce: Number(data.ethereum_nonce),
    evmAddress: EvmAddress.fromString(data.evm_address),
    createdTimestamp: data.created_timestamp
      ? new Timestamp(data.created_timestamp.split('.')[0], data.created_timestamp.split('.')[1])
      : null,
    expiryTimestamp: data.expiry_timestamp
      ? new Timestamp(data.expiry_timestamp.split('.')[0], data.expiry_timestamp.split('.')[1])
      : null,
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

/* Gets the account allowances by account id */
export const getAccountAllowances = async (
  accountId: string,
  mirrorNodeLink: string,
  controller?: AbortController,
) => {
  const { data } = await axios.get(`${mirrorNodeLink}/accounts/${accountId}/allowances/crypto`, {
    signal: controller?.signal,
  });

  const allowances: IMirrorNodeAllowance[] = data.allowances;

  return allowances;
};

export const getExchangeRateSet = async (mirrorNodeLink: string, controller?: AbortController) => {
  const { data } = await axios.get(`${mirrorNodeLink}/network/exchangerate`, {
    signal: controller?.signal,
  });

  const exchangeRateSet: NetworkExchangeRateSetResponse = data;

  return exchangeRateSet;
};

export const getDollarAmount = (hbarPrice: number, hbarAmount: number) => {
  const fractionDigits = 5;

  const dollarFormatting = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });

  let result: string;

  if (hbarPrice !== null) {
    const resolution = Math.pow(10, -fractionDigits);
    let usdAmount = hbarAmount * hbarPrice;
    if (0 < usdAmount && usdAmount < +resolution) {
      usdAmount = resolution;
    } else if (-resolution < usdAmount && usdAmount < 0) {
      usdAmount = -resolution;
    }
    result = dollarFormatting.format(usdAmount);
  } else {
    result = '';
  }
  return result;
};
