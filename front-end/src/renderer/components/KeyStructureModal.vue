<script setup lang="ts">
import { Key, KeyList, PublicKey } from '@hashgraph/sdk';

import AppModal from '@renderer/components/ui/AppModal.vue';
import KeyStructure from '@renderer/components/KeyStructure.vue';

/* Props */
defineProps<{
  accountKey: Key | null | undefined;
  show: boolean;
}>();

/* Emits */
const emit = defineEmits(['update:show']);

/* Handlers */
const handleShowUpdate = (show: boolean) => emit('update:show', show);
</script>
<template>
  <AppModal :show="show" @update:show="handleShowUpdate" class="modal-fit-content">
    <div class="p-5">
      <KeyStructure v-if="accountKey instanceof KeyList && true" :key-list="accountKey" />
      <div v-else-if="accountKey instanceof PublicKey && true">
        {{ accountKey.toStringRaw() }}
      </div>
    </div>
  </AppModal>
</template>
