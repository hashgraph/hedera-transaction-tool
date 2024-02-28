<script setup lang="ts">
import { ref, watch } from 'vue';

import { Key, PublicKey } from '@hashgraph/sdk';

import AppButton from './ui/AppButton.vue';
import AppPublicKeyInput from './ui/AppPublicKeyInput.vue';
import { isPublicKey } from '@renderer/utils/validator';

/* Props */
const props = defineProps<{
  modelKey: Key | null;
  isRequired?: boolean;
}>();

/* Emits */
const emit = defineEmits(['update:modelKey']);

/* Misc */
enum Tabs {
  SIGNLE = 'Single',
  COMPLEX = 'Complex',
}

/* State */
const currentTab = ref(Tabs.SIGNLE);
const publicKeyInputRef = ref<InstanceType<typeof AppPublicKeyInput> | null>(null);

/* Handlers */
const handleTabChange = (tab: Tabs) => {
  currentTab.value = tab;
};

const handlePublicKeyChange = (value: string) => {
  if (isPublicKey(value.trim())) {
    emit('update:modelKey', PublicKey.fromString(value));
  } else {
    emit('update:modelKey', null);
  }
};

/* Hooks */
watch([() => props.modelKey, currentTab, publicKeyInputRef], value => {
  const [newKey] = value;

  if (
    newKey &&
    currentTab.value === Tabs.SIGNLE &&
    newKey instanceof PublicKey &&
    publicKeyInputRef.value?.inputRef?.inputRef
  ) {
    publicKeyInputRef.value.inputRef.inputRef.value = newKey.toStringRaw();
  }
});
</script>
<template>
  <div class="border rounded p-4">
    <label class="form-label d-block"
      >Keys <span v-if="isRequired" class="text-danger">*</span></label
    >
    <div class="btn-group-container row gx-1" role="group">
      <template v-for="(tab, index) in Object.values(Tabs)" :key="tab">
        <div class="col-6">
          <AppButton
            :color="currentTab === tab ? 'primary' : undefined"
            type="button"
            class="w-100"
            :class="{ active: tab === currentTab, 'ms-3': index !== 0 }"
            @click="handleTabChange(tab)"
          >
            {{ tab }}
          </AppButton>
        </div>
      </template>
    </div>
    <div>
      <template v-if="currentTab === Tabs.SIGNLE">
        <div class="mt-5">
          <AppPublicKeyInput
            ref="publicKeyInputRef"
            :filled="true"
            @update:model-value="handlePublicKeyChange"
          />
        </div>
      </template>
    </div>
  </div>
</template>
