import type { DYNAMIC_LAYOUT_TYPE } from '@renderer/providers';

import { inject, onBeforeMount } from 'vue';

import { DYNAMIC_LAYOUT_KEY, setSettings } from '@renderer/providers';

export default function useSetDynamicLayout(settings: DYNAMIC_LAYOUT_TYPE) {
  /* Injected */
  const dynamicLayout = inject<DYNAMIC_LAYOUT_TYPE>(DYNAMIC_LAYOUT_KEY);

  /* Hooks */
  onBeforeMount(() => {
    setSettings(dynamicLayout, settings);
  });
}
