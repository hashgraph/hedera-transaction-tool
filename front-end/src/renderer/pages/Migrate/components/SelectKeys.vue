<script setup lang="ts">
import type { KeyPathWithName } from '@main/shared/interfaces';
import EncryptedKeysBox from '@renderer/components/KeyPair/ImportEncrypted/components/EncryptedKeysBox.vue';
import AppButton from '@renderer/components/ui/AppButton.vue';
import { ref } from 'vue';

const props = defineProps<{
  keysToRecover: KeyPathWithName[];
}>();

/* Emits */
const emit = defineEmits<{
  (event: 'migration:cancel'): void;
  (event: 'selected-keys', selectedKeys: KeyPathWithName[]): void;
}>();

/* State */
const selectedKeys = ref<string[]>([]);

/* Handlers */
const handleCancel = () => emit('migration:cancel');

const handleContinue = () => {
  const filteredKeys = props.keysToRecover.filter(key => selectedKeys.value.includes(key.fileName));
  emit('selected-keys', filteredKeys);
};
</script>

<template>
  <div class="flex-column-100">
    <div class="pb-2 mt-4 flex-grow-1 overflow-y-auto">
      <EncryptedKeysBox
        :keys="keysToRecover.map(key => key.fileName)"
        :fileNames="keysToRecover.map(key => key.fileName)"
        :selectedKeys="selectedKeys"
        :migrating="true"
        @update:selectedKeys="selectedKeys = $event"
      />
    </div>
    <div class="d-flex justify-content-between align-items-end mt-5">
      <div>
        <AppButton
          color="secondary"
          type="button"
          data-testid="button-migration-cancel"
          @click="handleCancel"
          >Cancel</AppButton
        >
      </div>
      <div>
        <AppButton
          color="primary"
          type="button"
          data-testid="button-migration-select-keys"
          :disabled="selectedKeys.length === 0"
          @click="handleContinue"
          >Continue</AppButton
        >
      </div>
    </div>
  </div>
</template>
