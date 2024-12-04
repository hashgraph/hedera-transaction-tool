import type { GLOBAL_MODAL_LOADER_TYPE } from '@renderer/providers';

import { inject } from 'vue';

import { useToast } from 'vue-toast-notification';

import { GLOBAL_MODAL_LOADER_KEY } from '@renderer/providers';

export default function useLoader() {
  /* Composables */
  const toast = useToast();

  /* Injected */
  const globalModalLoaderRef = inject<GLOBAL_MODAL_LOADER_TYPE>(GLOBAL_MODAL_LOADER_KEY);

  /* Actions */
  async function withLoader(
    fn: () => any,
    defaultErrorMessage = 'Failed to perform operation',
    timeout = 10000, // default timeout of 10 seconds
  ) {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Operation timed out')), timeout),
    );

    try {
      globalModalLoaderRef?.value?.open();
      return await Promise.race([fn(), timeoutPromise]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : defaultErrorMessage);
    } finally {
      globalModalLoaderRef?.value?.close();
    }
  }

  return withLoader;
}
