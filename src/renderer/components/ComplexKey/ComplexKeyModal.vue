<script setup lang="ts">
import { ref } from 'vue';

import { Key, KeyList } from '@hashgraph/sdk';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';
import AppCustomIcon from '@renderer/components/ui/AppCustomIcon.vue';
import ComplexKey from '@renderer/components/ComplexKey/ComplexKey.vue';

/* Props */
defineProps<{
  modelKey: Key | null;
  show: boolean;
}>();

/* Emits */
const emit = defineEmits(['update:show', 'update:modelKey']);

/* State */
const currentKey = ref<Key | null>(null);
const errorModalShow = ref(false);

/* Handlers */
const handleShowUpdate = show => emit('update:show', show);

const handleComplexKeyUpdate = (key: KeyList) => (currentKey.value = key);

const handleSave = e => {
  e.preventDefault();

  if (
    currentKey.value === null ||
    (currentKey.value instanceof KeyList && currentKey.value.toArray().length === 0)
  ) {
    errorModalShow.value = true;
    return;
  }

  emit('update:modelKey', currentKey.value);
  handleShowUpdate(false);
};

/* Misc */
const modalContentContainerStyle = { padding: '0 10%', height: '80%' };
</script>
<template>
  <AppModal :show="show" @update:show="handleShowUpdate" class="full-screen-modal">
    <div class="p-5 h-100">
      <form @submit="handleSave" class="h-100">
        <div>
          <i class="bi bi-x-lg cursor-pointer" @click="$emit('update:show', false)"></i>
        </div>
        <h1 class="text-title text-center">Complex Key</h1>
        <div :style="modalContentContainerStyle">
          <div class="text-end">
            <AppButton type="submit" color="primary">Save</AppButton>
          </div>
          <div class="mt-5 h-100 overflow-auto">
            <ComplexKey :model-key="modelKey" @update:model-key="handleComplexKeyUpdate" />
          </div>
        </div>
      </form>
    </div>
    <AppModal
      class="common-modal"
      v-model:show="errorModalShow"
      :close-on-click-outside="false"
      :close-on-escape="false"
    >
      <div class="p-5">
        <div>
          <i class="bi bi-x-lg cursor-pointer" @click="errorModalShow = false"></i>
        </div>
        <div class="text-center">
          <AppCustomIcon :name="'error'" style="height: 160px" />
        </div>
        <h3 class="text-center text-title text-bold mt-4">Error</h3>
        <p class="text-center text-small text-secondary mt-3">
          You cannot save this structure with empty list
        </p>
        <hr class="separator my-5" />
        <div class="row justify-content-center mt-4">
          <div class="col-6 d-grid">
            <AppButton type="button" color="secondary" @click="errorModalShow = false"
              >Close</AppButton
            >
          </div>
        </div>
      </div>
    </AppModal>
  </AppModal>
</template>
