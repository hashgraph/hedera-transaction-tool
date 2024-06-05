import axios from 'axios';

import { AccountId, EvmAddress, Hbar, HbarUnit, Key, PublicKey, Timestamp } from '@hashgraph/sdk';
import { BigNumber } from 'bignumber.js';

import { decodeProtobuffKey } from './electronUtilsService';

import {
  AccountInfo,
  IAccountInfoParsed,
  CryptoAllowance,
  NetworkExchangeRateSetResponse,
  Transaction,
} from '../../main/shared/interfaces';

/* Mirror node data service */

/* Get users account id by a public key */
export const getAccountId = async (mirrorNodeURL: string, publicKey: string): Promise<string[]> => {
  try {
    const { data } = await axios.get(`${mirrorNodeURL}/accounts/?account.publickey=${publicKey}`);
    return data.accounts.map(acc => acc.account);
  } catch (error) {
    console.log(error);
    return [];
  }
};

/* Get users account id by a public key */
export const getAccountsByPublicKey = async (
  mirrorNodeURL: string,
  publicKey: string,
): Promise<AccountInfo[]> => {
  let accounts: AccountInfo[] = [];

  try {
    let nextUrl: string | null =
      `${mirrorNodeURL}/accounts/?account.publickey=${publicKey}&limit=25&order=asc`;

    while (nextUrl) {
      const { data } = await axios.get(nextUrl);
      accounts = accounts.concat(data.accounts);

      if (data.links?.next) {
        nextUrl = `${mirrorNodeURL}${data.links.next.slice(data.links.next.indexOf('/accounts'))}`;
      } else {
        nextUrl = null;
      }
    }

    return accounts;
  } catch (error) {
    console.log(error);
    return accounts;
  }
};

/* Get accounts by public keys */
export const getAccountsByPublicKeys = async (
  mirrorNodeURL: string,
  publicKeys: string[],
): Promise<{ [key: string]: AccountInfo[] }> => {
  try {
    const accountsByPublicKeys: { [key: string]: AccountInfo[] } = {};

    for (const publicKey of [...new Set<string>(publicKeys)]) {
      accountsByPublicKeys[publicKey] = await getAccountsByPublicKey(mirrorNodeURL, publicKey);
    }

    return accountsByPublicKeys;
  } catch (error) {
    console.log(error);
    return {};
  }
};

/* Get accounts by public keys */
export const getAccountsByPublicKeysParallel = async (
  mirrorNodeURL: string,
  publicKeys: string[],
): Promise<{ [key: string]: AccountInfo[] }> => {
  try {
    const uniquePublicKeys = [...new Set<string>(publicKeys)];
    const publicKeyToAccounts: { [key: string]: AccountInfo[] } = {};

    const results = await Promise.allSettled(
      uniquePublicKeys.map(pk => getAccountsByPublicKey(mirrorNodeURL, pk)),
    );

    results.forEach((result, i) => {
      if (result.status === 'fulfilled') {
        publicKeyToAccounts[uniquePublicKeys[i]] = result.value;
      }
    });

    return publicKeyToAccounts;
  } catch (error) {
    console.log(error);
    return {};
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

/* Gets the exchange rate set */
export const getExchangeRateSet = async (mirrorNodeLink: string, controller?: AbortController) => {
  try {
    const { data } = await axios.get(`${mirrorNodeLink}/network/exchangerate`, {
      signal: controller?.signal,
    });

    const exchangeRateSet: NetworkExchangeRateSetResponse = data;

    return exchangeRateSet;
  } catch (error) {
    throw new Error('Failed to fetch exchange rate');
  }
};

/* Gets the dollar value for given hbars */
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

/* Gets the transaction information by transaction id */
export const getTransactionInfo = async (
  transactionId: string,
  mirrorNodeLink: string,
  controller?: AbortController,
) => {
  const { data } = await axios.get<{ transactions: Transaction[] }>(
    `${mirrorNodeLink}/transactions/${transactionId}`,
    {
      signal: controller?.signal,
    },
  );

  return data;
};
