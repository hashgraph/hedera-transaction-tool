<script setup lang="ts">
import { ref } from 'vue';
import { Key, KeyList, PublicKey } from '@hashgraph/sdk';

import { useToast } from 'vue-toast-notification';
import useKeyPairsStore from '@renderer/stores/storeKeyPairs';

import { isPublicKeyInKeyList } from '@renderer/utils/sdk';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppPublicKeyInput from '@renderer/components/ui/AppPublicKeyInput.vue';
import ComplexKeyAddPublicKeyModal from '@renderer/components/ComplexKey/ComplexKeyAddPublicKeyModal.vue';
import ComplexKeySelectAccountModal from '@renderer/components/ComplexKey/ComplexKeySelectAccountModal.vue';

/* Props */
const props = defineProps<{
  keyList: KeyList;
  isTop: boolean;
  onRemoveKeyList: () => void;
}>();

/* Emits */
const emit = defineEmits(['update:keyList']);

/* Stores */
const keyPairs = useKeyPairsStore();

/* Composables */
const toast = useToast();

/* State */
const areChildrenShown = ref(true);
const addPublicKeyModalShown = ref(false);
const selectAccountModalShown = ref(false);

/* Handlers */
const handleThresholdChange = (e: Event) => {
  const threshold = Number((e.target as HTMLSelectElement).value);
  emit('update:keyList', props.keyList.setThreshold(threshold));
};

const handleSelectAccount = (key: Key) => {
  if (key instanceof PublicKey && isPublicKeyInKeyList(key, props.keyList)) {
    toast.error('Public key already exists in the key list');
  } else {
    const keys = props.keyList.toArray();
    keys.push(key);
    emitNewKeyList(keys, props.keyList.threshold);
    selectAccountModalShown.value = false;
  }
};

const handleAddPublicKey = (publicKey: PublicKey) => {
  if (!isPublicKeyInKeyList(publicKey, props.keyList)) {
    const keys = props.keyList.toArray();
    keys.push(publicKey);
    emitNewKeyList(keys, props.keyList.threshold);
  } else {
    toast.error('Public key already exists in the key list');
  }
};

const handleRemovePublicKey = (publicKey: PublicKey) => {
  const keys = props.keyList.toArray();
  const index = keys.findIndex(key => key === publicKey);
  keys.splice(index, 1);
  emitNewKeyList(keys, props.keyList.threshold);
};

const handleAddThreshold = () => {
  const keys = props.keyList.toArray();
  keys.push(new KeyList([]));
  emitNewKeyList(keys, props.keyList.threshold);
};

const handleRemoveThreshold = (i: number) => {
  const keys = props.keyList.toArray();
  keys.splice(i, 1);
  emitNewKeyList(keys, props.keyList.threshold);
};

const handleKeyListUpdate = (index: number, newKeyList: KeyList) => {
  const parentKeyListArray = props.keyList.toArray();
  const newParentKeyList = new KeyList(parentKeyListArray, props.keyList.threshold);
  newParentKeyList.splice(index, 1, newKeyList);

  emit('update:keyList', newParentKeyList);
};

/* Funtions */
function emitNewKeyList(keys: Key[], threshold: number | null) {
  const newKeyList = new KeyList(keys, threshold);
  emit('update:keyList', newKeyList);
}
</script>
<template>
  <div class="key-node d-flex justify-content-between key-threshhold-bg rounded py-3 px-4">
    <div class="d-flex align-items-center">
      <Transition name="fade" mode="out-in">
        <span
          v-if="areChildrenShown"
          class="bi bi-chevron-up cursor-pointer"
          @click="areChildrenShown = !areChildrenShown"
        ></span>
        <span
          v-else
          class="bi bi-chevron-down cursor-pointer"
          @click="areChildrenShown = !areChildrenShown"
        ></span>
      </Transition>
      <p class="text-small text-semi-bold ms-3">Threshold</p>
      <div class="ms-3">
        <select
          class="form-select is-fill"
          :value="keyList.threshold || keyList.toArray().length"
          @change="handleThresholdChange"
        >
          <template
            v-for="num in Array.from(Array(keyList.toArray().length).keys())"
            :key="num + 1"
          >
            <option :value="num + 1">
              {{ num + 1 }}
            </option>
          </template>
        </select>
      </div>
      <p class="text-secondary text-small ms-3">of {{ keyList.toArray().length }}</p>
      <div class="border-start border-secondary-subtle ps-4 ms-4">
        <div class="dropdown">
          <AppButton type="button" color="primary" size="small" data-bs-toggle="dropdown"
            ><span class="bi bi-plus-lg"></span> Add</AppButton
          >
          <ul class="dropdown-menu mt-3">
            <li class="dropdown-item cursor-pointer" @click="selectAccountModalShown = true">
              <span class="text-small">Account</span>
            </li>
            <li class="dropdown-item cursor-pointer mt-3" @click="addPublicKeyModalShown = true">
              <span class="text-small">Public Key</span>
            </li>
            <li class="dropdown-item cursor-pointer mt-3" @click="handleAddThreshold">
              <span class="text-small">Threshold</span>
            </li>
          </ul>
        </div>
      </div>
    </div>

    <div class="d-flex align-items-center">
      <div class="text-small">
        <span class="bi bi-x-lg cursor-pointer" @click="onRemoveKeyList"></span>
      </div>
    </div>
  </div>
  <Transition name="fade" mode="out-in">
    <div v-show="areChildrenShown">
      <template v-for="(key, i) in keyList.toArray()" :key="key.toString()">
        <template v-if="key instanceof PublicKey && true">
          <div class="key-node-wrapper">
            <div class="key-node">
              <AppPublicKeyInput
                class="text-semi-bold"
                :model-value="key.toStringRaw()"
                filled
                readOnly
                has-cross-icon
                :label="keyPairs.getNickname(key.toStringRaw())"
                :on-cross-icon-click="() => handleRemovePublicKey(key)"
              />
            </div>
          </div>
        </template>
        <template v-else-if="key instanceof KeyList && true">
          <div class="key-node-container">
            <ComplexKeyThreshold
              :key-list="key"
              :is-top="false"
              @update:key-list="newKeyList => handleKeyListUpdate(i, newKeyList)"
              :on-remove-key-list="() => handleRemoveThreshold(i)"
            />
          </div>
        </template>
        <template v-else></template>
      </template>
    </div>
  </Transition>
  <ComplexKeyAddPublicKeyModal
    v-if="addPublicKeyModalShown"
    v-model:show="addPublicKeyModalShown"
    :on-public-key-add="handleAddPublicKey"
  />
  <ComplexKeySelectAccountModal
    v-if="selectAccountModalShown"
    v-model:show="selectAccountModalShown"
    :on-select-account="handleSelectAccount"
  />
</template>
