import type { AccountInfo } from '@shared/interfaces';
import type { HederaAccount } from '@prisma/client';

import { AccountId, Client, Hbar, HbarUnit, Long } from '@hashgraph/sdk';

import useUserStore from '@renderer/stores/storeUser';
import useNetworkStore from '@renderer/stores/storeNetwork';

import { getOne } from '@renderer/services/accountsService';
import { getPublicKeyOwner } from '@renderer/services/organization';

import { getPublicKeyMapping, isUserLoggedIn } from './userStoreHelpers';
import { isAccountId } from './validator';

export * from './dom';
export * from './sdk';
export * from './transactions';
export * from './transferTransactions';
export * from './validator';
export * from './axios';
export * from './ipc';
export * from './notifications';
export * from './safeAwait';
export * from './assertions';
export * from './router';
export * from './userStoreHelpers';
export * from './sdk';
export * from './transactionSignatureModels';
export * from './autoFocus';
export * from './localServices';

export const getDateTimeLocalInputValue = (date: Date) => {
  const tzo = -date.getTimezoneOffset();
  const dif = tzo >= 0 ? '+' : '-';
  const pad = function (num: number) {
    return (num < 10 ? '0' : '') + num;
  };

  const formattedDate =
    date.getFullYear() +
    '-' +
    pad(date.getMonth() + 1) +
    '-' +
    pad(date.getDate()) +
    'T' +
    pad(date.getHours()) +
    ':' +
    pad(date.getMinutes()) +
    ':' +
    pad(date.getSeconds()) +
    dif +
    pad(Math.floor(Math.abs(tzo) / 60)) +
    ':' +
    pad(Math.abs(tzo) % 60);

  return formattedDate.slice(0, 19);
};

export const convertBytes = (
  bytes: number,
  options: { useBinaryUnits?: boolean; decimals?: number } = {},
): string => {
  const { useBinaryUnits = false, decimals = 2 } = options;

  if (decimals < 0) {
    throw new Error(`Invalid decimals ${decimals}`);
  }

  const base = useBinaryUnits ? 1024 : 1000;
  const units = useBinaryUnits
    ? ['Bytes', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB']
    : ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

  const i = Math.floor(Math.log(bytes) / Math.log(base));

  if (bytes <= 0) {
    return `${bytes.toFixed(decimals)} ${units[0]}`;
  }

  return `${(bytes / Math.pow(base, i)).toFixed(decimals)} ${units[i]}`;
};

export const getUInt8ArrayFromBytesString = (bytes: string) => {
  const numberArray = bytes.trim().length === 0 ? [] : bytes.split(',').map(n => Number(n));

  return Uint8Array.from(numberArray);
};

export const uint8ToHex = (uint8: Uint8Array) => {
  return Array.from(uint8)
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
};

export const hexToUint8Array = (hexString: string) => {
  return new Uint8Array(
    (hexString.startsWith('0x') ? hexString.slice(2) : hexString)
      .match(/.{1,2}/g)
      ?.map(byte => parseInt(byte, 16)) || [],
  );
};

export const base64ToUint8Array = (base64String: string) => {
  const binaryString = atob(base64String);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

export const encodeString = (str: string) => {
  return new TextEncoder().encode(str);
};

export function stringToHex(str: string): string {
  return Array.from(str, c => c.charCodeAt(0).toString(16)).join('');
}

export function hexToString(hex: string) {
  return decodeURIComponent(hex.replace(/\s+/g, '').replace(/[0-9a-f]{2}/g, '%$&'));
}

export function getDateString(date: Date, isUtcSelected = true) {
  return isUtcSelected
    ? date.toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        timeZone: 'UTC', // Force UTC time
      })
    : date.toLocaleString();
}

export function getDateStringExtended(date: Date, isUtcSelected = true) {

  const formatter = new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZoneName: 'short',
  });

  return isUtcSelected
    ? date.toUTCString()
    : `${date.toDateString()} ${formatter.format(date)}`;
}

export const throwError = (errorMessage: string) => {
  throw new Error(errorMessage);
};

export const getErrorMessage = (error: unknown, defaultErrorMessage: string) =>
  error instanceof Error ? error.message : defaultErrorMessage;

export function handleFormatAccount(
  allAccounts: HederaAccount[] | undefined,
  accountToCheck: AccountInfo | HederaAccount,
): string {
  if (!allAccounts || !accountToCheck) {
    return '';
  }

  const accountId =
    'account' in accountToCheck ? accountToCheck.account : accountToCheck.account_id;

  if (!accountId) return '';

  const nickname = allAccounts.find(a => a.account_id === accountId)?.nickname || '';

  return nickname
    ? `${nickname} (${getAccountIdWithChecksum(accountId)})`
    : getAccountIdWithChecksum(accountId);
}

export const getAccountNicknameFromId = async (idToCheck: string) => {
  try {
    const user = useUserStore();

    if (!isUserLoggedIn(user.personal)) {
      throw new Error('User is not logged in');
    }

    const existingAcc = await getOne(user.personal.id, idToCheck);

    if (!existingAcc || !existingAcc?.nickname) {
      return null;
    }

    return existingAcc?.nickname;
  } catch {
    return null;
  }
};

export function validateAccountIdChecksum(accountId: string): boolean {
  try {
    const [baseId, checksum] = accountId.split('-');
    const networkStore = useNetworkStore();
    const parsedAccountId = AccountId.fromString(baseId);
    const calculatedChecksum = parsedAccountId
      .toStringWithChecksum(networkStore.client as Client)
      .split('-')[1];

    return checksum === calculatedChecksum;
  } catch {
    return false;
  }
}

export const getAccountIdWithChecksum = (accountId: string): string => {
  try {
    const networkStore = useNetworkStore();
    return AccountId.fromString(accountId).toStringWithChecksum(networkStore.client as Client);
  } catch {
    return accountId;
  }
};

const TINYBAR_THRESHOLD = 1_000_000;

export function stringifyHbarWithFont(hbar: Hbar, fontClass='text-bold text-secondary'): string {
  const amount = hbar.isNegative() ? hbar.toTinybars().negate() : hbar.toTinybars();
  const showTinybars = amount.lessThan(Long.fromNumber(TINYBAR_THRESHOLD));

  const displayAmount = showTinybars
    ? amount.toString()
    : Hbar.fromTinybars(amount).toBigNumber().toString();
  const displayUnit = showTinybars ? HbarUnit.Tinybar._symbol : HbarUnit.Hbar._symbol;

  return `${displayAmount} <span class="${fontClass}">${displayUnit}</span>`;
}

export const splitMultipleAccounts = (input: string, client: Client): string[] => {
  input = input.trim();

  const result: string[] = [];
  if (!input) {
    return result;
  }

  try {
    const accountParts = input.split(',');

    for (const account of accountParts) {
      const accountRange = account.split(/-(?=\s*\d)/);

      if (accountRange.length === 2) {
        const [start, end] = accountRange.map(a => a.trim());

        if (isAccountId(start) && isAccountId(end)) {
          const parsedStart = AccountId.fromString(start);
          const parsedEnd = AccountId.fromString(end);

          const startShard = parsedStart.shard.toNumber();
          const endShard = parsedEnd.shard.toNumber();
          const startRealm = parsedStart.realm.toNumber();
          const endRealm = parsedEnd.realm.toNumber();
          const startNum = parsedStart.num.toNumber();
          const endNum = parsedEnd.num.toNumber();

          if (startShard === endShard && startRealm == endRealm && startNum <= endNum) {
            for (let i = startNum; i <= endNum; i++) {
              result.push(
                AccountId.fromString(`${startShard}.${startRealm}.${i}`).toStringWithChecksum(
                  client,
                ),
              );
            }
          }
        }
      } else if (accountRange.length === 1) {
        const account = accountRange[0].trim();
        if (isAccountId(account)) {
          result.push(AccountId.fromString(account).toStringWithChecksum(client));
        }
      }
    }
  } catch (error) {
    console.log(error);
    throwError('Invalid multiple account input');
  }

  return result;
};

export const formatPublicKey = async (publicKey: string) => {
  const mapping = await getPublicKeyMapping(publicKey);
  if (mapping && mapping.nickname) {
    return `${mapping.nickname} (${mapping.public_key})`;
  }
  const user = useUserStore();
  if (user.selectedOrganization) {
    const owner = await getPublicKeyOwner(user.selectedOrganization!.serverUrl, publicKey);
    if (owner) {
      return `${owner} (${publicKey})`;
    }
  }
  return publicKey;
};

export const findIdentifier = async (publicKey: string) => {
  const mapping = await getPublicKeyMapping(publicKey);
  if (mapping && mapping.nickname) {
    return mapping.nickname as string;
  }
  const user = useUserStore();
  if (user.selectedOrganization) {
    const owner = await getPublicKeyOwner(user.selectedOrganization!.serverUrl, publicKey);
    if (owner) {
      return owner as string;
    }
  }
  return null;
};

export const formatPublicKeyContactList = async (publicKey: string) => {
  const mapping = await getPublicKeyMapping(publicKey);
  if (mapping) {
    return `${mapping.nickname} (${mapping.public_key})`;
  }
  return publicKey;
};

export const extractIdentifier = (formattedString: string) => {
  if (!formattedString) {
    return null;
  }

  const match = formattedString.match(/^(.*?)\s\(([\w]+)\)$/);

  if (match) {
    return { identifier: match[1], pk: match[2] };
  }
  return null;
};

/**
 * Sanitizes and formats an account ID string.
 * This function ensures that the input string adheres to the proper format of an account ID by:
 * - Removing any invalid characters.
 * - Ensuring that every '.' has a number in front of it and limiting to two '.' characters.
 * - Removing leading zeros from each part and validating each part.
 * - Allowing '-' followed by up to 5 letters (case-insensitive) if the 0.0.0 pattern already exists.
 *
 * @param {string} value - The input account ID string to be sanitized.
 * @returns {string} - The sanitized and formatted account ID string.
 */
export function sanitizeAccountId(value: string): string {
  // Ensure that every '.' has a number in front of it and limit to two '.' characters
  value = value
    .replace(/(^|[^0-9])\./g, '$1')
    .split('.')
    .slice(0, 3)
    .join('.');

  // Remove leading zeros from each part and validate each part
  const max8ByteNumber = BigInt('18446744073709551615'); // 2^64 - 1
  value = value.replace(/(^|\.)(0+)(\d+)/g, '$1$3').replace(/(\d+)/g, match => {
    const num = BigInt(match);
    return num > max8ByteNumber ? match.slice(0, -1) : match;
  });

  // Allow '-' followed by up to 5 letters (case-insensitive) if the 0.0.0 pattern already exists
  const pattern = /^(\d+\.\d+\.\d+)(-[a-zA-Z]{0,5})?$/;
  if (!pattern.test(value)) {
    value = value.toLowerCase().replace(/[^0-9.\-a-z]/g, ''); // Convert to lowercase and remove invalid characters
    const [mainPart, suffix] = value.split('-');
    value = mainPart.replace(/[^0-9.]/g, ''); // Ensure no non-digits before '-'
    if (suffix) value += `-${suffix.slice(0, 5).replace(/[^a-z]/g, '')}`; // Allow up to 5 lowercase letters
  }

  return value;
}

export const getNetworkLabel = (network: string) => {
  network = network.toLocaleLowerCase();
  switch (network) {
    case 'mainnet':
      return 'Mainnet';
    case 'testnet':
      return 'Testnet';
    case 'previewnet':
      return 'Previewnet';
    case 'local-node':
      return 'Local Node';
    default:
      return 'Custom';
  }
};
