import useUserStore from '@renderer/stores/storeUser';

import { DATE_TIME_PREFERENCE } from '@shared/constants';

import { add, getStoredClaim, update } from '@renderer/services/claimService';

import { DateTimeOptions, isUserLoggedIn, safeAwait } from '@renderer/utils';
import { ref } from 'vue';

export default function useDateTimeSetting() {
  const DEFAULT_OPTION = DateTimeOptions.UTC_TIME;

  const DATE_TIME_OPTIONS = [
    { value: DateTimeOptions.UTC_TIME, label: 'UTC Time' },
    { value: DateTimeOptions.LOCAL_TIME, label: 'Local Time' },
  ];

  /* Stores */
  const user = useUserStore();

  /* States */
  const dateTimeSetting = ref<DateTimeOptions | null>(null);

  /* Functions */

  const getDateTimeSetting = async () => {
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
  };

  const setDateTimeSetting = async (format: DateTimeOptions) => {
    if (isUserLoggedIn(user.personal)) {
      const claimValue = await safeAwait(getStoredClaim(user.personal.id, DATE_TIME_PREFERENCE));
      const addOrUpdate = claimValue.data !== undefined ? update : add;
      await addOrUpdate(user.personal.id, DATE_TIME_PREFERENCE, format);
    }
    dateTimeSetting.value = null; // force a reload of the setting at next use to make sure cache is in sync with DB
  };

  return { DATE_TIME_OPTIONS, getDateTimeSetting, setDateTimeSetting };
}
