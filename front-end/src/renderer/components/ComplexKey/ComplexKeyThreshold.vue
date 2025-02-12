<script setup lang="ts">
import { onBeforeMount, onMounted, ref, toRaw } from 'vue';
import { Key, KeyList, PublicKey } from '@hashgraph/sdk';

import useUserStore from '@renderer/stores/storeUser';
import useContactsStore from '@renderer/stores/storeContacts';
import useNicknamesStore from '@renderer/stores/storeNicknames';

import { useToast } from 'vue-toast-notification';

import { decodeKeyList, isPublicKeyInKeyList, isUserLoggedIn } from '@renderer/utils';
import * as ush from '@renderer/utils/userStoreHelpers';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';
import AppPublicKeyInput from '@renderer/components/ui/AppPublicKeyInput.vue';
import ComplexKeyAddPublicKeyModal from '@renderer/components/ComplexKey/ComplexKeyAddPublicKeyModal.vue';
import ComplexKeySelectAccountModal from '@renderer/components/ComplexKey/ComplexKeySelectAccountModal.vue';
import { getComplexKeys } from '@renderer/services/complexKeysService';
import { acceptHMRUpdate } from 'pinia';

/* Props */
const props = defineProps<{
  keyList: KeyList;
  onRemoveKeyList: () => void;
  depth?: string;
}>();

/* Emits */
const emit = defineEmits(['update:keyList']);

/* Stores */
const user = useUserStore();
const contacts = useContactsStore();
const nicknames = useNicknamesStore();

/* Composables */
const toast = useToast();

/* State */
const areChildrenShown = ref(true);
const addPublicKeyModalShown = ref(false);
const selectAccountModalShown = ref(false);
const nickname = ref('');
const keyId = ref('');

/* Handlers */
const handleThresholdChange = (e: Event) => {
  const threshold = Number((e.target as HTMLSelectElement).value);
  emit('update:keyList', props.keyList.setThreshold(threshold));
};

const handleSelectAccount = (key: Key) => {
  const keys = new KeyList(props.keyList.toArray().filter(key => key instanceof PublicKey));

  if (key instanceof PublicKey && isPublicKeyInKeyList(key, keys)) {
    toast.error('Public key already exists in the key list');
  } else {
    let keys = props.keyList.toArray();
    // keys.push(key);
    keys = [...keys, key];
    emitNewKeyList(keys, props.keyList.threshold);
    selectAccountModalShown.value = false;
  }
};

const handleAddPublicKey = (publicKeys: PublicKey[]) => {
  const publicKeysInKeyList = new KeyList(
    props.keyList.toArray().filter(key => key instanceof PublicKey),
  );
  let keys = props.keyList.toArray();

  for (const publicKey of publicKeys) {
    if (!isPublicKeyInKeyList(publicKey, publicKeysInKeyList)) {
      // keys.push(publicKey);
      keys = [...keys, publicKey];
    } else {
      toast.error(`${publicKey.toStringRaw()} already exists in the key list`);
    }
  }

  emitNewKeyList(keys, props.keyList.threshold);
};

const handleRemovePublicKey = (publicKey: PublicKey) => {
  const keys = props.keyList.toArray();
  const index = keys.findIndex(key => key === publicKey);
  keys.splice(index, 1);
  emitNewKeyList(keys, props.keyList.threshold);
};

const handleAddThreshold = () => {
  let keys = props.keyList.toArray();
  // keys.push(new KeyList([]));
  keys = [...keys, new KeyList([])];
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
  nicknames.updateKey(nickname.value, newParentKeyList, keyId.value);
};

function handleUpdateNickname(value: string) {
  nicknames.updateNickname(value, nickname.value);
  nickname.value = value;
}

/* Funtions */
function emitNewKeyList(keys: Key[], threshold: number | null) {
  const newKeyList = new KeyList(keys, threshold);
  emit('update:keyList', newKeyList);
  nicknames.updateKey(nickname.value, newKeyList, keyId.value);
}

/* Hooks */
onBeforeMount(async () => {
  if (!isUserLoggedIn(user.personal)) {
    throw new Error('User is not logged in');
  }

  [nickname.value, keyId.value] = await nicknames.getNickName(props.keyList);
});
</script>
<template>
  <div
    class="key-node d-flex justify-content-between key-threshhold-bg rounded py-3 px-4"
    :path="depth"
  >
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
      <AppInput
        :model-value="nickname"
        @update:model-value="handleUpdateNickname"
        size="small"
        class="ms-5"
        style="width: 250px"
        placeholder="Threshold"
      />
      <div class="ms-3">
        <select
          class="form-select is-fill"
          :value="keyList.threshold || keyList.toArray().length"
          @change="handleThresholdChange"
          :data-testid="`select-complex-key-threshold-${depth}`"
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
          <AppButton
            type="button"
            color="primary"
            size="small"
            data-bs-toggle="dropdown"
            :data-testid="`button-complex-key-add-element-${depth}`"
            class="min-w-unset"
            ><span class="bi bi-plus-lg"></span> Add</AppButton
          >
          <ul class="dropdown-menu mt-3">
            <li
              class="dropdown-item cursor-pointer"
              @click="selectAccountModalShown = true"
              :data-testid="`button-complex-key-add-element-account-${depth}`"
            >
              <span class="text-small">Account</span>
            </li>
            <li
              class="dropdown-item cursor-pointer mt-3"
              @click="addPublicKeyModalShown = true"
              :data-testid="`button-complex-key-add-element-public-key-${depth}`"
            >
              <span class="text-small">Public Key</span>
            </li>
            <li
              class="dropdown-item cursor-pointer mt-3"
              @click="handleAddThreshold"
              :data-testid="`button-complex-key-add-element-threshold-${depth}`"
            >
              <span class="text-small">Threshold</span>
            </li>
          </ul>
        </div>
      </div>
    </div>

    <div class="d-flex align-items-center">
      <div class="text-small">
        <span
          class="bi bi-x-lg cursor-pointer"
          @click="onRemoveKeyList"
          :data-testid="`button-complex-key-remove-element-${depth}`"
        ></span>
      </div>
    </div>
  </div>
  <Transition name="fade" mode="out-in">
    <div v-show="areChildrenShown">
      <template v-for="(key, i) in keyList.toArray()" :key="`${i} + ${depth || 'top'}`">
        <template v-if="key instanceof PublicKey && true">
          <div class="key-node-wrapper">
            <div class="key-node" :path="`${depth || 0}-${i}`">
              <AppPublicKeyInput
                class="text-semi-bold"
                :model-value="key.toStringRaw()"
                filled
                readOnly
                has-cross-icon
                :label="
                  ush.getNickname(key.toStringRaw(), user.keyPairs) ||
                  contacts.getContactByPublicKey(key)?.nickname.trim() ||
                  contacts.getContactByPublicKey(key)?.user.email
                "
                :on-cross-icon-click="() => handleRemovePublicKey(key)"
                :input-data-test-id="`input-complex-key-public-key-${depth || 0}-${i}`"
                :remove-data-test-id="`input-complex-key-remove-${depth || 0}-${i}`"
              />
            </div>
          </div>
        </template>
        <template v-else-if="key instanceof KeyList && true">
          <div class="key-node-container">
            <ComplexKeyThreshold
              :key-list="key"
              @update:key-list="newKeyList => handleKeyListUpdate(i, newKeyList)"
              :on-remove-key-list="() => handleRemoveThreshold(i)"
              :depth="`${depth || 0}-${i}`"
            />
          </div>
        </template>
      </template>
    </div>
  </Transition>
  <ComplexKeyAddPublicKeyModal
    v-if="addPublicKeyModalShown"
    v-model:show="addPublicKeyModalShown"
    :multiple="true"
    :already-added="
      keyList
        .toArray()
        .filter(key => key instanceof PublicKey)
        .map(key => (key as PublicKey).toStringRaw())
    "
    @selected:multiple="handleAddPublicKey"
  />
  <ComplexKeySelectAccountModal
    v-if="selectAccountModalShown"
    v-model:show="selectAccountModalShown"
    :on-select-account="handleSelectAccount"
  />
</template>
