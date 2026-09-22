<script setup lang="ts">
import KeyComponent from './KeyComponent.vue';
import { onBeforeMount, ref } from 'vue';
import { Key, KeyList, PublicKey } from '@hiero-ledger/sdk';
import { formatPublicKey } from '@renderer/utils';

import AppModal from '@renderer/components/ui/AppModal.vue';
import KeyStructure from '@renderer/components/KeyStructure.vue';
import { AppCache } from '@renderer/caches/AppCache.ts';

/* Props */
const props = defineProps<{
  accountKey: Key | null | undefined;
  show: boolean;
}>();

/* Emits */
const emit = defineEmits(['update:show']);

/* Injected */
const publicKeyOwnerCache = AppCache.inject().backendPublicKeyOwner;

/* State */
const formattedKey = ref('');

/* Handlers */
const handleShowUpdate = (show: boolean) => emit('update:show', show);

/* Lifecycle hooks */
onBeforeMount(async () => {
  if (props.accountKey && props.accountKey instanceof PublicKey) {
    formattedKey.value = await formatPublicKey(props.accountKey.toStringRaw(), publicKeyOwnerCache);
  }
});
</script>
<template>
  <AppModal
    :show="show"
    @update:show="handleShowUpdate"
    class="modal-fit-content key-structure-modal"
  >
    <div class="p-4">
      <div class="d-flex align-items-center gap-3 mb-4">
        <i class="bi bi-x-lg cursor-pointer" @click="handleShowUpdate(false)"></i>
        <h5 class="text-title text-bold text-center flex-grow-1 m-0">Key Structure</h5>
        <span class="flex-shrink-0" style="width: 1em"></span>
      </div>
      <KeyStructure v-if="accountKey instanceof KeyList" :key-list="accountKey" />
      <div v-else-if="accountKey instanceof PublicKey">
        {{ formattedKey || accountKey.toStringRaw() }}
      </div>
      <KeyComponent v-else-if="accountKey != null" :component="accountKey" />
    </div>
  </AppModal>
</template>

<style>
.key-structure-modal {
  min-width: min(360px, calc(100vw - 2rem));
}
</style>
