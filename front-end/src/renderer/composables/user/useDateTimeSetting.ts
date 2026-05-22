import useUserStore from '@renderer/stores/storeUser';

import { DATE_TIME_PREFERENCE } from '@shared/constants';

import { getStoredClaim, setStoredClaim } from '@renderer/services/claimService';

import { isUserLoggedIn, safeAwait } from '@renderer/utils';
import { computed, onBeforeMount, ref } from 'vue';

export enum DateTimeOptions {
  UTC_TIME = 'utc-time',
  LOCAL_TIME = 'local-time',
}

const DEFAULT_OPTION = DateTimeOptions.UTC_TIME;

// Shared module-level state so every component that calls useDateTimeSetting()
// observes the same value. Otherwise each consumer (e.g. every <DateTimeString>)
// would async-load independently and render with a stale format on first paint,
// and toggling the setting in Settings wouldn't propagate to other components
// until they remounted.
const dateTimeSetting = ref<DateTimeOptions | null>(null);
const timeZoneName = ref<string | null>(null);

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

export default function useDateTimeSetting() {
  /* Stores */
  const user = useUserStore();

  /* Hooks */
  onBeforeMount(async () => {
    if (dateTimeSetting.value !== null) return;
    const setting = await fetchDateTimeSetting();
    const formatter = new Intl.DateTimeFormat(undefined, { timeZoneName: 'long' });
    const parts = formatter.formatToParts(new Date());
    timeZoneName.value = parts.find(part => part.type === 'timeZoneName')?.value ?? null;
    dateTimeSetting.value = setting;
  });

  async function fetchDateTimeSetting(): Promise<DateTimeOptions> {
    if (!isUserLoggedIn(user.personal)) return DEFAULT_OPTION;
    const claimValue = await safeAwait(getStoredClaim(user.personal.id, DATE_TIME_PREFERENCE));
    return (claimValue.data as DateTimeOptions) ?? DEFAULT_OPTION;
  }

  async function getDateTimeSetting(): Promise<DateTimeOptions> {
    if (dateTimeSetting.value !== null) return dateTimeSetting.value;
    return await fetchDateTimeSetting();
  }

  async function setDateTimeSetting(format: DateTimeOptions) {
    if (isUserLoggedIn(user.personal)) {
      await setStoredClaim(user.personal.id, DATE_TIME_PREFERENCE, format);
    }
    dateTimeSetting.value = format;
  }

  return {
    DATE_TIME_OPTION_LABELS,
    isUtcSelected,
    dateTimeSettingLabel,
    getDateTimeSetting,
    setDateTimeSetting,
  };
}
