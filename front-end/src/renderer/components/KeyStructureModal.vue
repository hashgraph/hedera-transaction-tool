<script setup lang="ts">
import { onBeforeMount, ref } from 'vue';
import { Key, KeyList, PublicKey } from '@hashgraph/sdk';
import { formatPublicKey } from '@renderer/utils';

import AppModal from '@renderer/components/ui/AppModal.vue';
import KeyStructure from '@renderer/components/KeyStructure.vue';

/* Props */
const props = defineProps<{
  accountKey: Key | null | undefined;
  show: boolean;
}>();

/* Emits */
const emit = defineEmits(['update:show']);

/* State */
const formattedKey = ref('');

/* Handlers */
const handleShowUpdate = (show: boolean) => emit('update:show', show);

/* Lifecycle hooks */
onBeforeMount(async () => {
  if (props.accountKey && props.accountKey instanceof PublicKey && true) {
    formattedKey.value = await formatPublicKey(props.accountKey.toStringRaw());
  }
});
</script>
<template>
  <AppModal :show="show" @update:show="handleShowUpdate" class="modal-fit-content">
    <div class="p-5">
      <KeyStructure v-if="accountKey instanceof KeyList && true" :key-list="accountKey" />
      <div v-else-if="accountKey instanceof PublicKey && true && formattedKey">
        {{ formattedKey }}
      </div>
    </div>
  </AppModal>
</template>
