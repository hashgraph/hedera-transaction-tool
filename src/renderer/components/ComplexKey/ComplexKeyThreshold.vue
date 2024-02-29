<!-- eslint-disable @typescript-eslint/no-unused-vars -->
<script setup lang="ts">
import { ref } from 'vue';
import { KeyList, PublicKey } from '@hashgraph/sdk';

import AppButton from '../ui/AppButton.vue';
import AppPublicKeyInput from '../ui/AppPublicKeyInput.vue';

/* Props */
const props = defineProps<{
  keyList: KeyList;
  isTop: boolean;
  onRemoveKeyList: () => void;
}>();

/* Emits */
const emit = defineEmits(['update:keyList']);

/* State */
const areChildrenShown = ref(true);

/* Handlers */
const handleThresholdChange = (e: Event) => {
  const threshold = Number((e.target as HTMLSelectElement).value);
  emit('update:keyList', props.keyList.setThreshold(threshold));
};

const handleAddPublicKey = () => {
  // Open public key modal
};

const handleRemovePublicKey = (publicKey: PublicKey) => {
  const keys = props.keyList.toArray();
  const index = keys.findIndex(key => key === publicKey);
  keys.splice(index, 1);
  const newKeyList = new KeyList(keys, props.keyList.threshold);
  emit('update:keyList', newKeyList);
};

const handleAddAccount = () => {
  // Open accounts modal
};

const handleAddThreshold = () => {
  const keys = props.keyList.toArray();
  keys.push(new KeyList([]));
  const newKeyList = new KeyList(keys, props.keyList.threshold);
  emit('update:keyList', newKeyList);
};

const handleRemoveThreshold = (i: number) => {
  const keys = props.keyList.toArray();
  keys.splice(i, 1);
  const newKeyList = new KeyList(keys, props.keyList.threshold);
  emit('update:keyList', newKeyList);
};

const handleKeyListUpdate = (index: number, newKeyList: KeyList) => {
  const parentKeyListArray = props.keyList.toArray();
  const newParentKeyList = new KeyList(parentKeyListArray, props.keyList.threshold);
  newParentKeyList.splice(index, 1, newKeyList);

  emit('update:keyList', newParentKeyList);
};
</script>
<template>
  <div class="key-node d-flex justify-content-between bg-secondary text-white rounded py-3 px-4">
    <div class="d-flex align-items-center">
      <Transition name="fade" mode="out-in">
        <span
          v-if="areChildrenShown"
          class="bi bi-chevron-up"
          @click="areChildrenShown = !areChildrenShown"
        ></span>
        <span
          v-else
          class="bi bi-chevron-down"
          @click="areChildrenShown = !areChildrenShown"
        ></span>
      </Transition>
      <p class="text-small ms-3">Threshold</p>
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
            <li class="dropdown-item cursor-pointer" @click="handleAddPublicKey">
              <span class="text-small">Account</span>
            </li>
            <li class="dropdown-item cursor-pointer mt-3" @click="handleAddAccount">
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
                :model-value="key.toStringRaw()"
                filled
                has-cross-icon
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
</template>
