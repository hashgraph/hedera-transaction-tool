import type { User } from '@prisma/client';

import { commonIPCHandler } from '@renderer/utils';

export const isKeychainAvailable = async () =>
  commonIPCHandler<boolean>(async () => {
    return await window.electronAPI.local.safeStorage.isKeychainAvailable();
  }, 'Failed to get if keychain is available');

export const initializeUseKeychain = async (useKeychain: boolean) =>
  commonIPCHandler(async () => {
    return await window.electronAPI.local.safeStorage.initializeUseKeychain(useKeychain);
  }, 'Failed to initialize use keychain mode');

export const getUseKeychain = async () =>
  commonIPCHandler<boolean>(async () => {
    return await window.electronAPI.local.safeStorage.getUseKeychain();
  }, 'Failed to get use keychain flag');

export const getStaticUser = async () =>
  commonIPCHandler<User>(async () => {
    return await window.electronAPI.local.safeStorage.getStaticUser();
  }, 'Failed to get static user');

export const encrypt = async (data: string) =>
  commonIPCHandler<string>(async () => {
    return await window.electronAPI.local.safeStorage.encrypt(data);
  }, 'Failed to encrypt data');

export const decrypt = async (data: string, encoding?: BufferEncoding) =>
  commonIPCHandler<string>(async () => {
    return await window.electronAPI.local.safeStorage.decrypt(data, encoding);
  }, 'Failed to decrypt data');
