import { ref, type Ref } from 'vue';
import { defineStore } from 'pinia';
import { decrypt, encrypt } from '@renderer/services/safeStorageService';

export enum SafeStorageStatus {
  notDetermined,
  denied,
  authorized,
}

export interface SafeStorageStore {
  status: Ref<SafeStorageStatus>;
  encryptString(data: string): Promise<string | null>;
  decryptString(data: string, encoding?: BufferEncoding): Promise<string | null>;
}

export default defineStore('safeStorage', (): SafeStorageStore => {
  const status = ref(SafeStorageStatus.notDetermined);

  const deniedMessage = 'Encryption is not available';
  const encryptString = async (data: string): Promise<string | null> => {
    let result: string | null;
    try {
      result = await encrypt(data);
      status.value = SafeStorageStatus.authorized;
    } catch (error) {
      if (error instanceof Error && error.message.includes(deniedMessage)) {
        // User has denied keychain usage
        result = null;
        status.value = SafeStorageStatus.denied;
      } else {
        throw error;
      }
    }
    return Promise.resolve(result);
  };

  const decryptString = async (data: string, encoding?: BufferEncoding): Promise<string | null> => {
    let result: string | null;
    try {
      result = await decrypt(data, encoding);
      status.value = SafeStorageStatus.authorized;
    } catch (error) {
      if (error instanceof Error && error.message.includes(deniedMessage)) {
        // User has denied keychain usage
        result = null;
        status.value = SafeStorageStatus.denied;
      } else {
        throw error;
      }
    }
    return Promise.resolve(result);
  };

  return {
    status,
    encryptString,
    decryptString,
  };
});
