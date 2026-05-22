import useUserStore from '@renderer/stores/storeUser';

import { DATE_TIME_PREFERENCE } from '@shared/constants';

import { getStoredClaim, setStoredClaim } from '@renderer/services/claimService';

import { isUserLoggedIn, safeAwait } from '@renderer/utils';
import { computed, onBeforeMount, ref } from 'vue';

export enum DateTimeOptions {
  UTC_TIME = 'utc-time',
  LOCAL_TIME = 'local-time',
}

export default function useDateTimeSetting() {
  const DEFAULT_OPTION = DateTimeOptions.UTC_TIME;

  /* Stores */
  const user = useUserStore();

  /* States */
  const dateTimeSetting = ref<DateTimeOptions | null>(null);
  const timeZoneName = ref<string | null>(null);

  /* Computed */
  const isUtcSelected = computed(() => {
    return dateTimeSetting.value === DateTimeOptions.UTC_TIME;
  });

  const dateTimeSettingLabel = computed(() => {
    return isUtcSelected.value ? 'UTC Time' : 'Local Time';
  });

  const DATE_TIME_OPTION_LABELS = computed(() => [
    { value: DateTimeOptions.UTC_TIME, label: 'UTC Time' },
    {
      value: DateTimeOptions.LOCAL_TIME,
      label: `Local Time (${timeZoneName.value})`,
    },
  ]);

  /* Hooks */
  onBeforeMount(async () => {
    dateTimeSetting.value = await getDateTimeSetting();
    const formatter = new Intl.DateTimeFormat(undefined, { timeZoneName: 'long' });
    const parts = formatter.formatToParts(new Date());
    timeZoneName.value = parts.find(part => part.type === 'timeZoneName')?.value ?? null;
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
      await setStoredClaim(user.personal.id, DATE_TIME_PREFERENCE, format);
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
