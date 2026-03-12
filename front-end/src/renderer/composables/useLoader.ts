import type { GLOBAL_MODAL_LOADER_TYPE } from '@renderer/providers';

import { inject } from 'vue';

import { ToastManager } from '@renderer/utils/ToastManager';

import { GLOBAL_MODAL_LOADER_KEY } from '@renderer/providers';

import { getErrorMessage } from '@renderer/utils';

export default function useLoader() {
  /* Composables */
  const toastManager = ToastManager.inject()

  /* Injected */
  const globalModalLoaderRef = inject<GLOBAL_MODAL_LOADER_TYPE>(GLOBAL_MODAL_LOADER_KEY);

  /* Actions */
  async function withLoader(
    fn: () => any,
    defaultErrorMessage = 'Failed to perform operation',
    timeout = 10000, // default timeout of 10 seconds
    background = true,
  ) {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Operation timed out')), timeout),
    );

    try {
      globalModalLoaderRef?.value?.open(background);
      return await Promise.race([fn(), timeoutPromise]);
    } catch (error) {
      toastManager.error(getErrorMessage(error, defaultErrorMessage));
    } finally {
      globalModalLoaderRef?.value?.close();
    }
  }

  return withLoader;
}
