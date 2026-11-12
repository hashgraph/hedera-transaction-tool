<script setup lang="ts">
import { computed } from 'vue';

import AppAutoComplete from '@renderer/components/ui/AppAutoComplete.vue';

import { accountIdMatchesInput, matchAccountId } from '@renderer/utils';

/* Props */
const props = defineProps<{
  modelValue: string;
  // Saved contracts: `value` is the Contract ID / EVM address, `nickname` is shown beside it
  // in the dropdown and is also searchable.
  items: { value: string; nickname: string }[];
  dataTestid?: string;
}>();

/* Emits */
const emit = defineEmits<{
  (event: 'update:modelValue', value: string): void;
}>();

/* Computed */
const values = computed(() => props.items.map(i => i.value));
const nicknames = computed(() => new Map(props.items.map(i => [i.value, i.nickname])));

/* Handlers */
const sanitize = (value: string) => value.trimStart();

const itemLabel = (item: string) => nicknames.value.get(item) || '';

// Ghost text after the committed value (like AccountIdInput's checksum) so the nickname
// is visible in the field itself once a saved contract is selected.
const decorate = (value: string) => {
  const nickname = nicknames.value.get(value.trim()) || '';
  return nickname ? `  ${nickname}` : '';
};

const nicknameMatches = (item: string, input: string) =>
  itemLabel(item).toLowerCase().includes(input.toLowerCase());

const filterItem = (item: string, input: string) =>
  accountIdMatchesInput(item, input) || nicknameMatches(item, input);

// ID matches get the usual ghost completion; a nickname match highlights its row but
// (alignStart -1) shows no ghost, since the typed text isn't a substring of the ID.
const findMatch = (items: string[], input: string) => {
  const byId = matchAccountId(items, input);
  if (byId) return byId;

  const index = items.findIndex(item => nicknameMatches(item, input));
  return index === -1 ? null : { index, alignStart: -1 };
};
</script>
<template>
  <AppAutoComplete
    :model-value="modelValue"
    @update:model-value="(v: string) => emit('update:modelValue', v)"
    :items="values"
    :sanitize="sanitize"
    :find-match="findMatch"
    :filter-item="filterItem"
    :item-label="itemLabel"
    :decorate="decorate"
    :data-testid="dataTestid"
    tabular-nums
    filled
    :auto-trim="false"
    v-bind="$attrs"
  />
</template>
