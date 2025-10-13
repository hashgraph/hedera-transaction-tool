import useUserStore from '@renderer/stores/storeUser';

import { DATE_TIME_PREFERENCE } from '@shared/constants';

import { add, getStoredClaim, update } from '@renderer/services/claimService';

import { isUserLoggedIn, safeAwait } from '@renderer/utils';
import { computed, onBeforeMount, ref } from 'vue';

export enum DateTimeOptions {
  UTC_TIME = 'utc-time',
  LOCAL_TIME = 'local-time',
}

export default function useDateTimeSetting() {
  const DEFAULT_OPTION = DateTimeOptions.UTC_TIME;

  const DATE_TIME_OPTION_LABELS = [
    { value: DateTimeOptions.UTC_TIME, label: 'UTC Time' },
    { value: DateTimeOptions.LOCAL_TIME, label: 'Local Time' },
  ];

  /* Stores */
  const user = useUserStore();

  /* States */
  const dateTimeSetting = ref<DateTimeOptions | null>(null);

  /* Computed */
  const isUtcSelected = computed(() => {
    return dateTimeSetting.value === DateTimeOptions.UTC_TIME;
  });

  const dateTimeSettingLabel = computed(() => {
    return isUtcSelected.value ? 'UTC Time' : 'Local Time';
  });

  /* Hooks */
  onBeforeMount(async () => {
    dateTimeSetting.value = await getDateTimeSetting();
  });

  async function getDateTimeSetting(): Promise<DateTimeOptions> {
    let result: DateTimeOptions;
    if (dateTimeSetting.value === null) {
      result = DEFAULT_OPTION;
      if (isUserLoggedIn(user.personal)) {
        const claimValue = await safeAwait(getStoredClaim(user.personal.id, DATE_TIME_PREFERENCE));
        if (claimValue.data) {
          result = claimValue.data as DateTimeOptions;
        }
      }
    } else {
      result = dateTimeSetting.value;
    }
    return result;
  }

  async function setDateTimeSetting(format: DateTimeOptions) {
    if (isUserLoggedIn(user.personal)) {
      const claimValue = await safeAwait(getStoredClaim(user.personal.id, DATE_TIME_PREFERENCE));
      const addOrUpdate = claimValue.data !== undefined ? update : add;
      await addOrUpdate(user.personal.id, DATE_TIME_PREFERENCE, format);
    }
    dateTimeSetting.value = null; // force a reload of the setting at next use to make sure cache is in sync with DB
  }

  return {
    DATE_TIME_OPTION_LABELS,
    isUtcSelected,
    dateTimeSettingLabel,
    getDateTimeSetting,
    setDateTimeSetting,
  };
}
