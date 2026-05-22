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
// observes the same value and the same load lifecycle. Otherwise each consumer
// (e.g. every <DateTimeString>) would async-load independently and could render
// with a different initial format than its siblings.
const dateTimeSetting = ref<DateTimeOptions | null>(null);
const timeZoneName = ref<string | null>(null);
let loadPromise: Promise<void> | null = null;

const isUtcSelected = computed(() => {
  return dateTimeSetting.value === DateTimeOptions.UTC_TIME;
});

const isLoaded = computed(() => dateTimeSetting.value !== null);

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

  /* Functions */
  function ensureLoaded(): Promise<void> {
    if (dateTimeSetting.value !== null) {
      return Promise.resolve();
    }
    if (loadPromise) {
      return loadPromise;
    }
    loadPromise = (async () => {
      let setting = DEFAULT_OPTION;
      if (isUserLoggedIn(user.personal)) {
        const claimValue = await safeAwait(getStoredClaim(user.personal.id, DATE_TIME_PREFERENCE));
        if (claimValue.data) {
          setting = claimValue.data as DateTimeOptions;
        }
      }
      const formatter = new Intl.DateTimeFormat(undefined, { timeZoneName: 'long' });
      const parts = formatter.formatToParts(new Date());
      timeZoneName.value = parts.find(part => part.type === 'timeZoneName')?.value ?? null;
      dateTimeSetting.value = setting;
    })();
    return loadPromise;
  }

  /* Hooks */
  onBeforeMount(() => {
    void ensureLoaded();
  });

  async function getDateTimeSetting(): Promise<DateTimeOptions> {
    await ensureLoaded();
    return dateTimeSetting.value ?? DEFAULT_OPTION;
  }

  async function setDateTimeSetting(format: DateTimeOptions) {
    if (isUserLoggedIn(user.personal)) {
      await setStoredClaim(user.personal.id, DATE_TIME_PREFERENCE, format);
    }
    dateTimeSetting.value = format;
    loadPromise = Promise.resolve();
  }

  return {
    DATE_TIME_OPTION_LABELS,
    isUtcSelected,
    isLoaded,
    dateTimeSettingLabel,
    getDateTimeSetting,
    setDateTimeSetting,
  };
}
