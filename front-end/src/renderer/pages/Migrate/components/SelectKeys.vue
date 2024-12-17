<script setup lang="ts">
import type { DecryptedKeyWithPublic } from '@main/shared/interfaces';
import AppButton from '@renderer/components/ui/AppButton.vue';
import AppCheckBox from '@renderer/components/ui/AppCheckBox.vue';
import { ref } from 'vue';

const props = defineProps<{
  keysToRecover: DecryptedKeyWithPublic[];
}>();

/* Emits */
const emit = defineEmits<{
  (event: 'migration:cancel'): void;
  (event: 'selected-keys', selectedKeys: DecryptedKeyWithPublic[]): void;
}>();

/* State */
const selectAll = ref(false);
const selectedKeys = ref<string[]>([]);

/* Handlers */
const handleCheckBox = (publicKey: string) => {
  selectedKeys.value = selectedKeys.value.includes(publicKey)
    ? selectedKeys.value.filter(id => id !== publicKey)
    : [...selectedKeys.value, publicKey];

  selectAll.value = checkAllKeysSelected();
};

const handleSelectMany = () => {
  selectAll.value = !selectAll.value;
  if (selectAll.value) {
    selectedKeys.value = props.keysToRecover.map(key => key.publicKey);
  } else {
    selectedKeys.value = [];
  }
};

const handleCancel = () => emit('migration:cancel');

const handleContinue = () => {
  const filteredKeys = props.keysToRecover.filter(key =>
    selectedKeys.value.includes(key.publicKey),
  );
  emit('selected-keys', filteredKeys);
};

/* Functions */
const checkAllKeysSelected = () => {
  return selectedKeys.value.length === props.keysToRecover.length ? true : false;
};

const formatKey = (key: string) => {
  return key.length > 12 ? `${key.slice(0, 4)}...${key.slice(key.length - 5, key.length)}` : key;
};
</script>

<template>
  <div class="flex-column-100">
    <div class="pb-2 mt-4 flex-grow-1 overflow-y-auto">
      <table class="table-custom">
        <thead>
          <tr>
            <th>
              <AppCheckBox
                :checked="selectAll"
                @update:checked="handleSelectMany"
                name="select-card"
                :data-testid="'checkbox-select-all-keys'"
                class="cursor-pointer keys-tab"
              />
            </th>
            <th>Nickname</th>
            <th>Public key</th>
          </tr>
        </thead>
        <tbody class="text-secondary" v-if="props.keysToRecover">
          <template v-for="(key, index) in props.keysToRecover" :key="key">
            <tr>
              <td>
                <AppCheckBox
                  :checked="selectedKeys.includes(key.publicKey) || selectAll"
                  @update:checked="handleCheckBox(key.publicKey)"
                  name="select-card"
                  :data-testid="'checkbox-migrate-keys-id-' + index"
                  class="cursor-pointer d-flex justify-content-center"
                />
              </td>
              <td :data-testid="`cell-nickname-${index}`">
                {{ key.fileName ? key.fileName : 'N/A' }}
              </td>

              <td>
                <p class="d-flex text-nowrap">
                  <span
                    :data-testid="`span-public-key-${index}`"
                    class="d-inline-block text-truncate"
                    >{{ formatKey(key.publicKey) }}</span
                  >
                </p>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
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
