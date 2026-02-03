import { ref, type Ref, watch } from 'vue';
import { defineStore } from 'pinia';
import { isUserLoggedIn, safeAwait } from '@renderer/utils';
import { add, getStoredClaim, update } from '@renderer/services/claimService.ts';
import { DEVELOPER_MODE } from '@shared/constants';
import useUserStore from '@renderer/stores/storeUser.ts';

interface DeveloperModeStore {
  enabled: Ref<boolean>;
  setEnabled: (enabled: boolean) => Promise<void>;
}

const useDeveloperMode = defineStore('developerMode', (): DeveloperModeStore => {
  /* State */
  const enabled = ref<boolean>(false);

  /* Stores */
  const user = useUserStore();

  /* Functions */
  const setEnabled = async (newValue: boolean): Promise<void> => {
    if (isUserLoggedIn(user.personal)) {
      const claimValue = await safeAwait(getStoredClaim(user.personal.id, DEVELOPER_MODE));
      const addOrUpdate = claimValue.data !== undefined ? update : add;
      await addOrUpdate(user.personal.id, DEVELOPER_MODE, newValue.toString());
    }
    enabled.value = newValue;
  };

  /* Watchers */
  watch(
    () => isUserLoggedIn(user.personal),
    async () => {
      if (isUserLoggedIn(user.personal)) {
        const currentValue = await getStoredClaim(user.personal.id, DEVELOPER_MODE);
        enabled.value = currentValue === 'true';
      } else {
        enabled.value = false;
      }
    },
    { immediate: true },
  );

  return {
    enabled,
    setEnabled,
  };
});

export default useDeveloperMode;
