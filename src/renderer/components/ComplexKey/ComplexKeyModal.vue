<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import { Key, KeyList } from '@hashgraph/sdk';

import useUserStore from '@renderer/stores/storeUser';

import { useToast } from 'vue-toast-notification';

import { complexKeyExists, addComplexKey } from '@renderer/services/complexKeysService';

import { isKeyListValid, encodeKeyList } from '@renderer/utils/sdk';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';
import AppCustomIcon from '@renderer/components/ui/AppCustomIcon.vue';
import ComplexKey from '@renderer/components/ComplexKey/ComplexKey.vue';
import KeyStructure from '@renderer/components/KeyStructure.vue';

/* Props */
const props = defineProps<{
  modelKey: Key | null;
  show: boolean;
}>();

/* Emits */
const emit = defineEmits(['update:show', 'update:modelKey']);

/* Stores */
const user = useUserStore();

/* Composables */
const toast = useToast();

/* State */
const currentKey = ref<Key | null>(props.modelKey);
const errorModalShow = ref(false);
const saveKeyListModalShown = ref(false);
const summaryMode = ref(false);
const keyListNickname = ref('');

/* Computed */
const currentKeyInvalid = computed(
  () =>
    currentKey.value === null ||
    (currentKey.value instanceof KeyList && !isKeyListValid(currentKey.value)),
);

/* Handlers */
const handleShowUpdate = show => emit('update:show', show);

const handleComplexKeyUpdate = (key: KeyList) => (currentKey.value = key);

const handleSaveButtonClick = e => {
  e.preventDefault();

  if (currentKeyInvalid.value) {
    errorModalShow.value = true;
    return;
  }

  saveKeyListModalShown.value = true;
};

const handleSaveKeyList = async e => {
  e.preventDefault();

  if (currentKeyInvalid.value) {
    errorModalShow.value = true;
    return;
  }

  const keyListBytes = encodeKeyList(currentKey.value as KeyList);

  const exists = await complexKeyExists(user.data.id, keyListBytes);

  if (exists) {
    console.log('Key already exists');
  } else {
    await addComplexKey(user.data.id, keyListBytes, keyListNickname.value);
    toast.success('Key list saved successfully', { position: 'bottom-right' });
  }

  emit('update:modelKey', currentKey.value);
  handleShowUpdate(false);
  saveKeyListModalShown.value = false;
};

const handleClose = () => {
  emit('update:show', false);
};

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
      <form @submit="handleSaveButtonClick" class="h-100">
        <div>
          <i class="bi bi-x-lg cursor-pointer" @click="handleClose"></i>
        </div>
        <h1 class="text-title text-semi-bold text-center">Complex Key</h1>
        <div :style="modalContentContainerStyle">
          <div class="text-end">
            <AppButton type="button" class="text-body" @click="summaryMode = !summaryMode">{{
              summaryMode ? 'Edit Mode' : 'View Summary'
            }}</AppButton>
            <AppButton type="submit" color="primary" class="ms-3">Save</AppButton>
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
        <div class="row justify-content-center mt-4">
          <div class="col-6 d-grid">
            <AppButton type="button" color="secondary" @click="errorModalShow = false"
              >Close</AppButton
            >
          </div>
        </div>
      </div>
    </AppModal>
    <AppModal
      v-model:show="saveKeyListModalShown"
      class="common-modal"
      :close-on-click-outside="false"
      :close-on-escape="false"
    >
      <div class="p-5">
        <div>
          <i class="bi bi-x-lg cursor-pointer" @click="saveKeyListModalShown = false"></i>
        </div>
        <form class="mt-3" @submit="handleSaveKeyList">
          <h3 class="text-center text-title text-bold">Enter your password</h3>
          <div class="form-group mt-5 mb-4">
            <label class="form-label">Nickname</label>
            <AppInput
              v-model:model-value="keyListNickname"
              :filled="true"
              placeholder="Enter Name of Key List"
            />
          </div>
          <hr class="separator" />
          <div class="row mt-4">
            <div class="col-6 d-grid">
              <AppButton color="secondary" type="button" @click="saveKeyListModalShown = false"
                >Cancel</AppButton
              >
            </div>
            <div class="col-6 d-grid">
              <AppButton color="primary" :disabled="keyListNickname.length === 0">Save</AppButton>
            </div>
          </div>
        </form>
      </div>
    </AppModal>
  </AppModal>
</template>
