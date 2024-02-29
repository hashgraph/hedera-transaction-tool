<!-- eslint-disable @typescript-eslint/no-unused-vars -->
<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { KeyList, PublicKey } from '@hashgraph/sdk';

import AppButton from '../ui/AppButton.vue';
import AppPublicKeyInput from '../ui/AppPublicKeyInput.vue';

/* Props */
const props = defineProps<{
  keyList: KeyList;
  isTop: boolean;
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

const handleAddAccount = () => {
  // Open accounts modal
};

const handleAddThreshold = () => {
  // const keys = props.keyList.toArray();
  // keys.push(new KeyList([]));
  // const newKeyList = new KeyList(keys, props.keyList.threshold);
  // emit('update:keyList', newKeyList);
};

const handleKeyListUpdate = () => {
  // emit('update:keyList', newKeyList);
};

onMounted(() => {
  console.log(props.keyList);
});
</script>
<template>
  <div class="key-node d-flex align-items-center bg-secondary text-white rounded py-3 px-4">
    <Transition name="fade" mode="out-in">
      <span
        v-if="areChildrenShown"
        class="bi bi-chevron-up"
        @click="areChildrenShown = !areChildrenShown"
      ></span>
      <span v-else class="bi bi-chevron-down" @click="areChildrenShown = !areChildrenShown"></span>
    </Transition>
    <p class="text-small ms-3">Threshold</p>
    <div class="ms-3">
      <select
        class="form-select is-fill"
        :value="keyList.threshold || keyList.toArray().length"
        @change="handleThresholdChange"
      >
        <template v-for="num in Array.from(Array(keyList.toArray().length).keys())" :key="num + 1">
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
  <Transition name="fade" mode="out-in">
    <div v-show="areChildrenShown">
      <template v-for="key in keyList.toArray()" :key="key.toString()">
        <template v-if="key instanceof PublicKey && true">
          <div class="key-node-wrapper">
            <div class="key-node">
              <AppPublicKeyInput :model-value="key.toStringRaw()" filled has-cross-icon />
            </div>
          </div>
        </template>
        <template v-else-if="key instanceof KeyList && true">
          <div class="key-node-container">
            <ComplexKeyThreshold
              :key-list="key"
              :is-top="false"
              @update:key-list="handleKeyListUpdate"
            />
          </div>
        </template>
        <template v-else></template>
      </template>
    </div>
  </Transition>
</template>
