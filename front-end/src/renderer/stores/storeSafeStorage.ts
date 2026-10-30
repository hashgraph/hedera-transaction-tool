import { ref, type Ref } from 'vue';
import { defineStore } from 'pinia';
import { checkKeychain as probeKeychain } from '@renderer/services/safeStorageService';

export enum SafeStorageStatus {
  notDetermined,
  denied,
  authorized,
}

export interface SafeStorageStore {
  status: Ref<SafeStorageStatus>;
  keychainUnavailable: Ref<boolean>;
  checkKeychain(): Promise<boolean>;
}

export default defineStore('safeStorage', (): SafeStorageStore => {
  const status = ref(SafeStorageStatus.notDetermined);
  const keychainUnavailable = ref(false);

  const checkKeychain = async (): Promise<boolean> => {
    const usable = await probeKeychain();
    status.value = usable ? SafeStorageStatus.authorized : SafeStorageStatus.denied;
    return usable;
  };

  return {
    status,
    keychainUnavailable,
    checkKeychain,
  };
});
