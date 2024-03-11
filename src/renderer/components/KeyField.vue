<script setup lang="ts">
import { ref, watch } from 'vue';

import { Key, KeyList, PublicKey } from '@hashgraph/sdk';

import useKeyPairsStore from '@renderer/stores/storeKeyPairs';

import { isPublicKey } from '@renderer/utils/validator';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppPublicKeyInput from '@renderer/components/ui/AppPublicKeyInput.vue';
import ComplexKeyModal from '@renderer/components/ComplexKey/ComplexKeyModal.vue';
import ComplexKeyAddPublicKeyModal from '@renderer/components/ComplexKey/ComplexKeyAddPublicKeyModal.vue';
import KeyStructureModal from '@renderer/components/KeyStructureModal.vue';
import { flattenKeyList } from '@renderer/services/keyPairService';

/* Props */
const props = withDefaults(
  defineProps<{
    modelKey: Key | null;
    isRequired?: boolean;
    label?: string;
  }>(),
  {
    label: 'Key',
  },
);

/* Emits */
const emit = defineEmits(['update:modelKey']);

/* Misc */
enum Tabs {
  SIGNLE = 'Single',
  COMPLEX = 'Complex',
}

/* Stores */
const keyPairs = useKeyPairsStore();

/* State */
const currentTab = ref(Tabs.SIGNLE);
const publicKeyInputRef = ref<InstanceType<typeof AppPublicKeyInput> | null>(null);
const complexKeyModalShown = ref(false);
const keyStructureModalShown = ref(false);
const addPublicKeyModalShown = ref(false);

/* Handlers */
const handleTabChange = (tab: Tabs) => {
  currentTab.value = tab;
  complexKeyModalShown.value = tab === Tabs.COMPLEX;
};

const handlePublicKeyChange = (value: string) => {
  if (isPublicKey(value.trim())) {
    emit('update:modelKey', PublicKey.fromString(value));
  } else {
    emit('update:modelKey', null);
  }
};

const handleAddPublicKey = (key: PublicKey) => {
  emit('update:modelKey', key);
  addPublicKeyModalShown.value = false;
};

/* Watchers */
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

watch(currentTab, tab => {
  if (tab === Tabs.SIGNLE && props.modelKey instanceof KeyList) {
    const publicKeys = flattenKeyList(props.modelKey);
    publicKeys.length > 0 && emit('update:modelKey', publicKeys[0]);
  }
});

watch(complexKeyModalShown, show => {
  if (!show && props.modelKey === null) {
    currentTab.value = Tabs.SIGNLE;
  }
});
</script>
<template>
  <div class="border rounded p-4">
    <label class="form-label d-block"
      >{{ label }} <span v-if="isRequired" class="text-danger">*</span></label
    >
    <div class="btn-group-container row gx-1" role="group">
      <template v-for="(tab, index) in Object.values(Tabs)" :key="tab">
        <div class="col-6">
          <AppButton
            :color="currentTab === tab ? 'primary' : undefined"
            type="button"
            class="w-100"
            :class="{
              active: tab === currentTab,
              'text-body': tab !== currentTab,
              'ms-3': index !== 0,
            }"
            @click="handleTabChange(tab)"
          >
            {{ tab }}
          </AppButton>
        </div>
      </template>
    </div>
    <div>
      <template v-if="currentTab === Tabs.SIGNLE && modelKey instanceof PublicKey && true">
        <div class="mt-5">
          <p class="text-purple cursor-pointer" @click="addPublicKeyModalShown = true">
            <span class="bi bi-plus-lg"></span><span>Select Key</span>
          </p>
        </div>
        <div class="mt-5">
          <AppPublicKeyInput
            ref="publicKeyInputRef"
            :filled="true"
            :label="keyPairs.getNickname(modelKey.toStringRaw())"
            @update:model-value="handlePublicKeyChange"
          />
        </div>
        <ComplexKeyAddPublicKeyModal
          v-if="addPublicKeyModalShown"
          v-model:show="addPublicKeyModalShown"
          :on-public-key-add="handleAddPublicKey"
        />
      </template>
      <template v-if="currentTab === Tabs.COMPLEX">
        <ComplexKeyModal
          v-model:show="complexKeyModalShown"
          :model-key="modelKey"
          @update:model-key="key => emit('update:modelKey', key)"
        />
        <div class="d-grid mt-4">
          <AppButton
            v-if="modelKey"
            color="primary"
            type="button"
            @click="keyStructureModalShown = true"
            >Show Key</AppButton
          >
          <KeyStructureModal v-model:show="keyStructureModalShown" :account-key="modelKey" />
        </div>
      </template>
    </div>
  </div>
</template>
