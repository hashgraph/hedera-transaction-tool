<script setup lang="ts">
import useUserStore from '@renderer/stores/storeUser';

import { formatAccountId } from '@renderer/utils';

import AppAutoComplete from '@renderer/components/ui/AppAutoComplete.vue';

/* Props */
defineProps<{
  modelValue: string;
  items?: string[];
  dataTestid?: string;
}>();

/* Emits */
const emit = defineEmits<{
  (event: 'update:modelValue', value: string): void;
}>();

/* Stores */
const user = useUserStore();

/* Handlers */
const handleUpdate = (value: string) => {
  emit('update:modelValue', formatAccountId(value));
};
</script>
<template>
  <AppAutoComplete
    :model-value="modelValue"
    @update:model-value="handleUpdate"
    :items="items || user.publicKeysToAccountsFlattened"
    :data-testid="dataTestid"
    disable-spaces
    v-bind="$attrs"
  />
</template>
