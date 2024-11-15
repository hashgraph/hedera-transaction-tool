<script setup lang="ts">
import useUserStore from '@renderer/stores/storeUser';

import { formatAccountId } from '@renderer/utils';

import AppAutoComplete from '@renderer/components/ui/AppAutoComplete.vue';

/* Props */
defineProps<{
  modelValue: string;
  items?: string[];
}>();

/* Emits */
defineEmits<{
  (event: 'update:modelValue', value: string): void;
}>();

/* Stores */
const user = useUserStore();
</script>
<template>
  <AppAutoComplete
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', formatAccountId($event))"
    :items="items || user.publicKeysToAccountsFlattened"
    v-bind="$attrs"
  />
</template>
