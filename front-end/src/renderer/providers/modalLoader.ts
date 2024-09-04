import type { Ref } from 'vue';
import { provide, readonly } from 'vue';

import GlobalModalLoader from '@renderer/components/GlobalModalLoader.vue';

export const GLOBAL_MODAL_LOADER_KEY = 'globalModalLoaderRef';
export type GLOBAL_MODAL_LOADER_TYPE = Ref<InstanceType<typeof GlobalModalLoader> | null>;

export const provideGlobalModalLoaderlRef = (value: GLOBAL_MODAL_LOADER_TYPE) => {
  provide(GLOBAL_MODAL_LOADER_KEY, readonly(value));
};
