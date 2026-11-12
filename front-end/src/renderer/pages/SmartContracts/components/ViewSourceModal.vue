<script setup lang="ts">
import { ref, watch } from 'vue';

import useNetworkStore from '@renderer/stores/storeNetwork';

import { getVerifiedContract, type VerifiedContract } from '@renderer/services/sourcifyService';

import AppModal from '@renderer/components/ui/AppModal.vue';
import ContractSourceViewer from './ContractSourceViewer.vue';

/* Props */
const props = defineProps<{
  show: boolean;
  evmAddress: string | null;
}>();

/* Emits */
const emit = defineEmits<{
  (event: 'update:show', show: boolean): void;
}>();

/* Stores */
const network = useNetworkStore();

/* State */
// Source is never persisted locally - it's re-fetched from Sourcify every time this opens,
// rather than storing a (potentially large, and redundant with the user's own project) copy.
const loading = ref(false);
const result = ref<VerifiedContract | null>(null);
const failed = ref(false);

// Same abort-the-previous-lookup pattern as AddSmartContract.vue's runLookup/resetLookup - the
// modal is reused for whichever contract is selected (not remounted), so closing/reopening it for
// a different contract before the first lookup finishes must not let that stale response land.
let controller: AbortController | null = null;

/* Handlers */
const handleShowUpdate = (show: boolean) => emit('update:show', show);

/* Watchers */
watch(
  () => [props.show, props.evmAddress] as const,
  async ([show, evmAddress]) => {
    controller?.abort();
    controller = null;

    if (!show) {
      return;
    }
    result.value = null;
    failed.value = false;

    if (!evmAddress) {
      failed.value = true;
      return;
    }

    const thisController = new AbortController();
    controller = thisController;

    loading.value = true;
    const fetched = await getVerifiedContract(network.network, evmAddress, thisController);
    if (thisController.signal.aborted) {
      return;
    }
    loading.value = false;

    if (!fetched) {
      failed.value = true;
      return;
    }
    result.value = fetched;
  },
  { immediate: true },
);
</script>
<template>
  <AppModal :show="show" @update:show="handleShowUpdate" class="full-screen-modal">
    <div class="p-5 h-100 d-flex flex-column">
      <div class="flex-shrink-0">
        <i
          class="bi bi-x-lg cursor-pointer"
          @click="handleShowUpdate(false)"
          data-testid="button-close-view-source"
        ></i>
      </div>
      <h1 class="text-title text-semi-bold text-center flex-shrink-0">
        {{ result?.name || 'Contract' }} source code
      </h1>
      <div class="flex-grow-1 d-flex flex-column mt-4" style="min-height: 0; min-width: 0">
        <p v-if="loading" class="text-secondary text-small" data-testid="text-view-source-loading">
          Fetching source from Sourcify…
        </p>
        <p
          v-else-if="failed"
          class="text-danger text-small"
          data-testid="text-view-source-failed"
        >
          Could not fetch this contract's source from Sourcify. It may no longer be verified, or
          Sourcify may be unreachable right now.
        </p>
        <ContractSourceViewer
          v-else-if="result"
          class="flex-grow-1"
          :contract-name="result.name"
          :sources="result.sources"
        />
      </div>
    </div>
  </AppModal>
</template>
