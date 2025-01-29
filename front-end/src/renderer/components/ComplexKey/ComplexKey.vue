<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { Key, KeyList } from '@hashgraph/sdk';

import ComplexKeyThreshold from '@renderer/components/ComplexKey/ComplexKeyThreshold.vue';

/* Props */
const props = defineProps<{
  modelKey: Key | null;
}>();

/* Emits */
const emit = defineEmits(['update:modelKey', 'update:nickname', 'listLoaded']);

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

function handleNicknameChange(nickname: string) {
  emit('update:nickname', nickname);
}

function handleListLoaded(listId: string) {
  emit('listLoaded', listId);
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
    @update:nickname="handleNicknameChange"
    @list-loaded="handleListLoaded"
    :on-remove-key-list="handleKeyListRemove"
    :depth="'0'"
  />
</template>
