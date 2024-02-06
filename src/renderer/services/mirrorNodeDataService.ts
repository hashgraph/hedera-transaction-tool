import axios from 'axios';

import { AccountId, EvmAddress, Hbar, HbarUnit, Key, PublicKey, Timestamp } from '@hashgraph/sdk';
import { BigNumber } from 'bignumber.js';

import { decodeProtobuffKey } from './electronUtilsService';

import {
  AccountInfo,
  IAccountInfoParsed,
  CryptoAllowance,
  NetworkExchangeRateSetResponse,
} from '../../main/shared/interfaces';

/* Mirror node data service */

/* Get users account id by a public key */
export const getAccountId = async (mirrorNodeURL: string, publicKey: string) => {
  try {
    const { data } = await axios.get(`${mirrorNodeURL}/accounts/?account.publickey=${publicKey}`);
    return data.accounts.map(acc => acc.account);
  } catch (error) {
    console.log(error);
  }
};

/* Gets the account information by account id */
export const getAccountInfo = async (
  accountId: string,
  mirrorNodeLink: string,
  controller?: AbortController,
) => {
  const { data } = await axios.get(`${mirrorNodeLink}/accounts/${accountId}`, {
    signal: controller?.signal,
  });

  const rawAccountInfo: AccountInfo = data;

  let key: Key | null;

  if (!rawAccountInfo.key) {
    key = null;
  } else {
    switch (rawAccountInfo.key._type) {
      case 'ProtobufEncoded':
        key = (await decodeProtobuffKey(rawAccountInfo.key.key || '')) || null;
        break;
      case 'ED25519':
      case 'ECDSA_SECP256K1':
        key = PublicKey.fromString(rawAccountInfo.key.key || '');
        break;
      default:
        key = null;
        break;
    }
  }

  const accountInfo: IAccountInfoParsed = {
    accountId: AccountId.fromString(rawAccountInfo.account || ''),
    alias: rawAccountInfo.alias as string,
    balance: Hbar.from(rawAccountInfo.balance?.balance || 0, HbarUnit.Tinybar),
    declineReward: Boolean(rawAccountInfo.decline_reward),
    deleted: Boolean(rawAccountInfo.deleted),
    ethereumNonce: Number(rawAccountInfo.ethereum_nonce),
    evmAddress: EvmAddress.fromString(rawAccountInfo.evm_address || ''),
    createdTimestamp: rawAccountInfo.created_timestamp
      ? new Timestamp(
          Number(rawAccountInfo.created_timestamp.split('.')[0]),
          Number(rawAccountInfo.created_timestamp.split('.')[1]),
        )
      : null,
    expiryTimestamp: rawAccountInfo.expiry_timestamp
      ? new Timestamp(
          Number(rawAccountInfo.expiry_timestamp.split('.')[0]),
          Number(rawAccountInfo.expiry_timestamp.split('.')[1]),
        )
      : null,
    key: key,
    maxAutomaticTokenAssociations: rawAccountInfo.max_automatic_token_associations,
    memo: rawAccountInfo.memo,
    pendingRewards: Hbar.from(rawAccountInfo.pending_reward || 0, HbarUnit.Tinybar),
    receiverSignatureRequired: Boolean(rawAccountInfo.receiver_sig_required),
    stakedAccountId: rawAccountInfo.staked_account_id
      ? AccountId.fromString(rawAccountInfo.staked_account_id)
      : null,
    stakedNodeId: rawAccountInfo.staked_node_id ? Number(rawAccountInfo.staked_node_id) : null,
    autoRenewPeriod: rawAccountInfo.auto_renew_period,
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

  const allowances: CryptoAllowance[] = data.allowances;

  return allowances;
};

export const getExchangeRateSet = async (mirrorNodeLink: string, controller?: AbortController) => {
  const { data } = await axios.get(`${mirrorNodeLink}/network/exchangerate`, {
    signal: controller?.signal,
  });

  const exchangeRateSet: NetworkExchangeRateSetResponse = data;

  return exchangeRateSet;
};

export const getDollarAmount = (hbarPrice: number, hbarAmount: BigNumber) => {
  const fractionDigits = 5;

  let result: string;

  if (hbarPrice !== null) {
    const resolution = Math.pow(10, -fractionDigits);
    let usdAmount = hbarAmount.times(hbarPrice);
    if (usdAmount.isGreaterThan(0) && usdAmount.isLessThan(+resolution)) {
      usdAmount = new BigNumber(resolution);
    } else if (usdAmount.isGreaterThan(-resolution) && usdAmount.isLessThan(0)) {
      usdAmount = new BigNumber(-resolution);
    }
    result = `$${usdAmount.decimalPlaces(fractionDigits)}`;
  } else {
    result = '';
  }
  return result;
};
