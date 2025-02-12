<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { Key, KeyList } from '@hashgraph/sdk';

import ComplexKeyThreshold from '@renderer/components/ComplexKey/ComplexKeyThreshold.vue';

/* Props */
const props = defineProps<{
  modelKey: Key | null;
}>();

/* Emits */
const emit = defineEmits(['update:modelKey', 'update:nickname']);

/* State */
const keyList = ref<KeyList>(new KeyList());

/* Handlers */
const handleKeyListChange = (newKeyList: KeyList) => {
  emit('update:modelKey', newKeyList);
};

const handleKeyListRemove = () => {
  keyList.value = new KeyList([]);
  emit('update:modelKey', keyList.value);
};

function handleUpdateNickname(nickname: string, keyId: string, keyList: KeyList) {
  emit('update:nickname', nickname, keyId, keyList);
}

/* Hooks */
onMounted(() => {
  if (props.modelKey instanceof KeyList) {
    keyList.value = props.modelKey;
  }
});
</script>
<template>
  <ComplexKeyThreshold
    v-model:key-list="keyList"
    @update:key-list="handleKeyListChange"
    @update:nickname="handleUpdateNickname"
    :on-remove-key-list="handleKeyListRemove"
    :depth="'0'"
  />
</template>
