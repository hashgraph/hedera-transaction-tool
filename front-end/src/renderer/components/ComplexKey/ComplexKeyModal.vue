<script setup lang="ts">
import { computed, onBeforeMount, ref, watch } from 'vue';

import { Key, KeyList } from '@hashgraph/sdk';

import { isKeyListValid } from '@renderer/utils';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';
import AppCustomIcon from '@renderer/components/ui/AppCustomIcon.vue';
import ComplexKey from '@renderer/components/ComplexKey/ComplexKey.vue';
import KeyStructure from '@renderer/components/KeyStructure.vue';
import useNicknamesStore from '@renderer/stores/storeNicknames';

/* Props */
const props = defineProps<{
  modelKey: Key | null;
  show: boolean;
  onSaveComplexKey?: () => void;
}>();

const nicknames = useNicknamesStore();

/* Emits */
const emit = defineEmits(['update:show', 'update:modelKey']);

/* State */
const currentKey = ref<Key | null>(props.modelKey);
const errorModalShow = ref(false);
const summaryMode = ref(false);

/* Computed */
const currentKeyInvalid = computed(
  () =>
    currentKey.value === null ||
    (currentKey.value instanceof KeyList && !isKeyListValid(currentKey.value)),
);

/* Handlers */
const handleShowUpdate = (show: boolean) => emit('update:show', show);

const handleComplexKeyUpdate = (key: KeyList) => (currentKey.value = key);

const handleSaveComplexKeyButtonClick = () => {
  if (currentKeyInvalid.value) {
    errorModalShow.value = true;
    return;
  }

  emit('update:modelKey', currentKey.value);

  if (props.onSaveComplexKey) {
    props.onSaveComplexKey();
  }
};

const handleDoneButtonClick = async () => {
  if (currentKeyInvalid.value) {
    errorModalShow.value = true;
    return;
  }

  emit('update:modelKey', currentKey.value);
  emit('update:show', false);
};

async function handleExit() {
  await nicknames.clearNicknames();
  emit('update:show', false);
}

function handleSummaryEdit() {
  summaryMode.value = !summaryMode.value;

  if (summaryMode.value) {
    if (currentKeyInvalid.value) {
      errorModalShow.value = true;
      return;
    }

    emit('update:modelKey', currentKey.value);
  }
}

/* Watchers */
watch(
  () => props.show,
  () => {
    currentKey.value = props.modelKey;
  },
);

/* Misc */
const modalContentContainerStyle = { padding: '0 10%', height: '80%' };
</script>
<template>
  <AppModal :show="show" @update:show="handleShowUpdate" class="full-screen-modal">
    <div class="p-5 h-100">
      <form @submit.prevent="handleDoneButtonClick" class="h-100">
        <div>
          <i class="bi bi-x-lg cursor-pointer" @click="handleExit"></i>
        </div>
        <h1 class="text-title text-semi-bold text-center">Complex Key</h1>
        <div :style="modalContentContainerStyle">
          <div class="text-end">
            <AppButton
              color="borderless"
              type="button"
              class="text-body"
              @click="handleSummaryEdit"
              >{{ summaryMode ? 'Edit Mode' : 'View Summary' }}</AppButton
            >
            <AppButton
              v-if="onSaveComplexKey && !currentKeyInvalid"
              type="button"
              color="primary"
              class="ms-3"
              @click="handleSaveComplexKeyButtonClick"
              data-testid="button-complex-key-save"
              >Save Complex Key</AppButton
            >
            <AppButton
              type="submit"
              color="primary"
              class="ms-3"
              data-testid="button-complex-key-done"
              >Done</AppButton
            >
          </div>
          <div v-if="show" class="mt-5 h-100 overflow-auto">
            <Transition name="fade" :mode="'out-in'">
              <div v-if="!summaryMode">
                <ComplexKey :model-key="currentKey" @update:model-key="handleComplexKeyUpdate" />
              </div>
              <div v-else>
                <KeyStructure
                  :key-list="currentKey instanceof KeyList ? currentKey : new KeyList([])"
                />
              </div>
            </Transition>
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
          You cannot save key list with invalid structure
        </p>

        <hr class="separator my-5" />

        <div class="d-grid">
          <AppButton type="button" color="secondary" @click="errorModalShow = false"
            >Close</AppButton
          >
        </div>
      </div>
    </AppModal>
    <slot></slot>
  </AppModal>
</template>
