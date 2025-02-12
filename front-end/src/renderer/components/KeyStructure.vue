<script setup lang="ts">
import { KeyList, PublicKey } from '@hashgraph/sdk';

import { decodeKeyList, encodeKey, isUserLoggedIn, normalizePublicKey } from '@renderer/utils';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';
import AppPublicKeyNickname from '@renderer/components/ui/AppPublicKeyNickname.vue';
import { onBeforeMount, ref, toRaw } from 'vue';
import {
  getComplexKey,
  updateComplexKey,
  addComplexKey,
  getComplexKeys,
} from '@renderer/services/complexKeysService';
import useUserStore from '@renderer/stores/storeUser';

/* Props */
const props = defineProps<{
  keyList: KeyList;
}>();

/* State */
const nickname = ref('');
const newNickname = ref('');
const showNicknameTextbox = ref(false);

/* Stores */
const user = useUserStore();

/* Emits */
const emit = defineEmits(['update:keyList']);

function handleOpenInput() {
  newNickname.value = nickname.value ? nickname.value : '';
  showNicknameTextbox.value = true;
}

async function handleAddNickname() {
  if (!isUserLoggedIn(user.personal)) {
    throw new Error('User is not logged in');
  }

  const keyListBytes = encodeKey(props.keyList);
  if (nickname.value) {
    const list = await getComplexKey(user.personal.id, props.keyList);
    await updateComplexKey(list.id, keyListBytes, newNickname.value);
  } else {
    await addComplexKey(user.personal.id, keyListBytes, newNickname.value);
  }

  const keyLists = await getComplexKeys(user.personal.id);

  for (const keyList of keyLists) {
    const list = decodeKeyList(keyList.protobufEncoded).toArray();
    const propList = toRaw(props.keyList).toArray();

    if (JSON.stringify(list) === JSON.stringify(propList)) {
      nickname.value = keyList.nickname;
    }
  }

  emit('update:keyList');
  showNicknameTextbox.value = false;
}

/* Hooks */
onBeforeMount(async () => {
  if (!isUserLoggedIn(user.personal)) {
    throw new Error('User is not logged in');
  }

  const keyLists = await getComplexKeys(user.personal.id);

  for (const keyList of keyLists) {
    const list = decodeKeyList(keyList.protobufEncoded).toArray();
    const propList = toRaw(props.keyList).toArray();

    if (JSON.stringify(list) === JSON.stringify(propList)) {
      nickname.value = keyList.nickname;
    }
  }
});
</script>
<template>
  <div class="text-nowrap">
    <div class="d-flex align-items-center">
      <p v-if="!showNicknameTextbox" :class="{ 'text-pink': nickname }">
        {{ nickname ? `${nickname}` : 'Threshold' }}
      </p>
      <AppInput
        v-else
        v-model="newNickname"
        size="small"
        class="ms-5"
        style="width: 250px"
        placeholder="Threshold"
      />
      <p class="ms-3">
        ({{
          !keyList.threshold || keyList.threshold === keyList.toArray().length
            ? keyList.toArray().length
            : keyList.threshold
        }}
        of {{ keyList.toArray().length }})
      </p>
      <span
        class="bi bi-pencil-square text-primary text-main cursor-pointer ms-5"
        v-if="!showNicknameTextbox"
        @click="handleOpenInput"
      />
      <AppButton
        v-if="showNicknameTextbox"
        type="button"
        @click="handleAddNickname"
        color="primary"
        class="ms-5"
        >Save</AppButton
      >
    </div>
    <template v-for="(item, _index) in keyList.toArray()" :key="_index">
      <template v-if="item instanceof KeyList && true">
        <div class="ms-5">
          <KeyStructure :key-list="item" />
        </div>
      </template>
      <template v-else-if="item instanceof PublicKey && true">
        <p class="text-nowrap ms-5 my-3">
          <AppPublicKeyNickname :public-key="item" />
        </p>
      </template>
    </template>
  </div>
</template>
