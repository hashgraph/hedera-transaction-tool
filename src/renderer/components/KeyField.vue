<script setup lang="ts">
import { ref, watch } from 'vue';

import { ComplexKey } from '@prisma/client';

import { Key, PublicKey } from '@hashgraph/sdk';

import useKeyPairsStore from '@renderer/stores/storeKeyPairs';

import { isPublicKey } from '@renderer/utils/validator';
import { decodeKeyList } from '@renderer/utils/sdk';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppPublicKeyInput from '@renderer/components/ui/AppPublicKeyInput.vue';
import ComplexKeyModal from '@renderer/components/ComplexKey/ComplexKeyModal.vue';
import ComplexKeyAddPublicKeyModal from '@renderer/components/ComplexKey/ComplexKeyAddPublicKeyModal.vue';
import ComplexKeySelectSavedKey from './ComplexKey/ComplexKeySelectSavedKey.vue';

/* Props */
withDefaults(
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
const selectedComplexKey = ref<ComplexKey | null>(null);
const complexKeyModalShown = ref(false);
const addPublicKeyModalShown = ref(false);
const selectSavedKeyModalShown = ref(false);

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

const handleAddPublicKey = (key: PublicKey) => {
  emit('update:modelKey', key);
  addPublicKeyModalShown.value = false;
};

const handleSelectSavedComplexKey = (complexKey: ComplexKey) => {
  selectedComplexKey.value = complexKey;
  emit('update:modelKey', decodeKeyList(complexKey.protobufEncoded));
  selectSavedKeyModalShown.value = false;
};

const handleDeselectComplexKey = () => {
  selectedComplexKey.value = null;
  emit('update:modelKey', null);
};

const handleEditComplexKey = () => {
  complexKeyModalShown.value = true;
};

const handleComplexKeyUpdate = (complexKey: ComplexKey) => {
  selectedComplexKey.value = complexKey;
  emit('update:modelKey', decodeKeyList(complexKey.protobufEncoded));
};

/* Watchers */
watch(currentTab, tab => {
  if (tab === Tabs.COMPLEX && selectedComplexKey.value) {
    emit('update:modelKey', decodeKeyList(selectedComplexKey.value.protobufEncoded));
  } else {
    emit('update:modelKey', null);
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
        <div class="col-6 d-grid">
          <AppButton
            :color="currentTab === tab ? 'primary' : undefined"
            type="button"
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
      <template v-if="currentTab === Tabs.SIGNLE">
        <div class="mt-5">
          <p class="text-purple cursor-pointer" @click="addPublicKeyModalShown = true">
            <span class="bi bi-plus-lg"></span><span>Select Key</span>
          </p>
        </div>
        <div class="mt-5">
          <AppPublicKeyInput
            ref="publicKeyInputRef"
            :filled="true"
            :label="
              modelKey instanceof PublicKey
                ? keyPairs.getNickname(modelKey.toStringRaw())
                : 'Public Key'
            "
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
          :model-key="selectedComplexKey"
          @update:model-key="handleComplexKeyUpdate"
        />
        <div class="d-flex mt-5">
          <p class="text-purple cursor-pointer" @click="complexKeyModalShown = true">
            <span class="bi bi-plus-lg"></span><span>Create new</span>
          </p>
          <p class="cursor-pointer ms-3" @click="selectSavedKeyModalShown = true">Add Existing</p>
        </div>
        <div
          class="key-node d-flex justify-content-between key-threshhold-bg text-white rounded py-4 px-3 mt-3 cursor-pointer"
          v-if="selectedComplexKey"
        >
          <div class="col-11 d-flex align-items-center text-small">
            <div class="text-semi-bold text-truncate" style="max-width: 35%">
              {{ selectedComplexKey.nickname }}
            </div>

            <div class="d-flex align-items-center border-start border-secondary-subtle ms-4">
              <AppButton
                type="button"
                size="small"
                color="primary"
                class="ms-4"
                @click="handleEditComplexKey"
              >
                <span class="bi bi-pencil"></span>
                <span class="ms-3">Edit</span>
              </AppButton>
              <p class="text-secondary ms-3">
                {{ selectedComplexKey.updated_at.toDateString() }}
              </p>
            </div>
          </div>
          <div class="col-1 flex-centered">
            <span
              class="bi bi-trash text-danger cursor-pointer"
              @click="handleDeselectComplexKey"
            ></span>
          </div>
        </div>
        <ComplexKeySelectSavedKey
          v-if="selectSavedKeyModalShown"
          v-model:show="selectSavedKeyModalShown"
          :on-key-list-select="handleSelectSavedComplexKey"
        />
      </template>
    </div>
  </div>
</template>
