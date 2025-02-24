import type { AccountInfo } from '@main/shared/interfaces';
import type { HederaAccount } from '@prisma/client';
import { AccountId, Client } from '@hashgraph/sdk';
import { isUserLoggedIn } from './userStoreHelpers';
import useUserStore from '@renderer/stores/storeUser';
import { getOne } from '@renderer/services/accountsService';
import useNetworkStore from '@renderer/stores/storeNetwork';

export * from './dom';
export * from './sdk';
export * from './transactions';
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

export const encodeString = (str: string) => {
  return new TextEncoder().encode(str);
};

export function stringToHex(str: string): string {
  return Array.from(str, c => c.charCodeAt(0).toString(16)).join('');
}

export function hexToString(hex: string) {
  return decodeURIComponent(hex.replace(/\s+/g, '').replace(/[0-9a-f]{2}/g, '%$&'));
}

export const getDateStringExtended = (date: Date) => {
  return `${date.toDateString()} ${date.toLocaleTimeString()}`;
};

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
