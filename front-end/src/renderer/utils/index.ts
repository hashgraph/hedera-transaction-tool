import type { ToastPluginApi } from 'vue-toast-notification';

import GlobalModalLoader from '@renderer/components/GlobalModalLoader.vue';

export * from './dom';
export * from './sdk';
export * from './transactions';
export * from './validator';
export * from './axios';
export * from './ipc';
export * from './notifications';

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
  const numberArray = bytes.split(',').map(n => Number(n));

  return Uint8Array.from(numberArray);
};

export const encodeString = (str: string) => {
  return new TextEncoder().encode(str);
};

export const getDateStringExtended = (date: Date) => {
  return `${date.toDateString()} ${date.toLocaleTimeString()}`;
};

export const withLoader = (
  fn: (...args: any[]) => any,
  toast: ToastPluginApi,
  loaderRef: InstanceType<typeof GlobalModalLoader> | null | undefined,
  defaultErrorMessage = 'Failed to perform operation',
) => {
  return async (...args: any[]) => {
    try {
      loaderRef?.open();
      return await fn(...args);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : defaultErrorMessage);
    } finally {
      loaderRef?.close();
      toast.clear();
    }
  };
};
