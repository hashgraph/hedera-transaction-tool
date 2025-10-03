import useUserStore from '@renderer/stores/storeUser';

import { DATE_TIME_PREFERENCE } from '@shared/constants';

import { add, getStoredClaim, update } from '@renderer/services/claimService';

import { isUserLoggedIn, safeAwait } from '@renderer/utils';

export enum DateTimeOptions {
  UTC_TIME = 'utc-time',
  LOCAL_TIME = 'local-time',
}

export default function useDateTimeSetting() {
  const DEFAULT_OPTION = DateTimeOptions.UTC_TIME;

  const DATE_TIME_OPTIONS = [
    { value: DateTimeOptions.UTC_TIME, label: 'UTC Time' },
    { value: DateTimeOptions.LOCAL_TIME, label: 'Local Time' },
  ];

  /* Stores */
  const user = useUserStore();

  /* Functions */

  const getDateTimeSetting = async () => {
    let result = DEFAULT_OPTION;
    if (isUserLoggedIn(user.personal)) {
      const claimValue = await safeAwait(
        getStoredClaim(user.personal.id, DATE_TIME_PREFERENCE),
      );
      if (claimValue.data) {
        result = claimValue.data as DateTimeOptions;
      }
    }
    return result;
  };

  const setDateTimeSetting = async (format: DateTimeOptions) => {
    if (isUserLoggedIn(user.personal)) {
      const claimValue = await safeAwait(
        getStoredClaim(user.personal.id, DATE_TIME_PREFERENCE),
      );
      const addOrUpdate = claimValue.data !== undefined ? update : add;
      await addOrUpdate(user.personal.id, DATE_TIME_PREFERENCE, format);
    }
  };

  return { DATE_TIME_OPTIONS, getDateTimeSetting, setDateTimeSetting };
}
