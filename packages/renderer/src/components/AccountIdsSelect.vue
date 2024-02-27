<script setup lang="ts">
import {computed, onMounted} from 'vue';

import useKeyPairsStore from '@renderer/stores/storeKeyPairs';

/* Props */
const props = defineProps<{
  accountId: string;
  selectDefault?: boolean;
}>();

/* Emits */
const emit = defineEmits(['update:accountId']);

/* Stores */
const keyPairs = useKeyPairsStore();

/* Computed */
const accoundIds = computed(() => keyPairs.accoundIds.map(a => a.accountIds).flat());

/* Handlers */
const handleAccountIdChange = (e: Event) => {
  const selectEl = e.target as HTMLSelectElement;
  emit('update:accountId', selectEl.value);
};

/* Hooks */
onMounted(() => {
  if (props.accountId.length === 0 && props.selectDefault) {
    emit('update:accountId', accoundIds.value[0]);
  }
});
</script>

<template>
  <select
    class="form-select"
    :value="accountId"
    @change="handleAccountIdChange"
  >
    <template
      v-for="accountId in accoundIds"
      :key="accountId"
    >
      <option :value="accountId">{{ accountId }}</option>
    </template>
  </select>
</template>
