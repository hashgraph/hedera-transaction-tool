<script setup lang="ts">
import { computed } from 'vue';
import { BlockNodeApi } from '@hiero-ledger/sdk';
import { labelForBlockNodeApi } from '@renderer/components/Transaction/Create/RegisteredNodeCreate/BlockNodeApiLabel.ts';

/* Props */
const value = defineModel<number[]>({ required: true });

/* Computed */
const allApis = computed(() => [
  BlockNodeApi.Other,
  BlockNodeApi.Status,
  BlockNodeApi.Publish,
  BlockNodeApi.SubscribeStream,
  BlockNodeApi.StateProof,
]);

/* Helpers */
function isApiSelected(api: BlockNodeApi) {
  return value.value.includes(Number(api));
}
function toggleApi(api: BlockNodeApi, checked: boolean) {
  const current = new Set(value.value);
  if (checked) current.add(Number(api));
  else current.delete(Number(api));
  value.value = Array.from(current);
}
</script>

<template>
  <div class="d-flex flex-wrap gap-3">
    <label
      v-for="api in allApis"
      :key="api.toString()"
      class="d-inline-flex align-items-center gap-2 text-small"
    >
      <input
        type="checkbox"
        :checked="isApiSelected(api)"
        :data-testid="`checkbox-registered-endpoint-api-${Number(api)}`"
        @change="toggleApi(api, ($event.target as HTMLInputElement).checked)"
      />
      {{ labelForBlockNodeApi(api) }}
    </label>
  </div>
</template>
