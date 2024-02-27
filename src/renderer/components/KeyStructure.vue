<script setup lang="ts">
import { KeyList, Key } from '@hashgraph/sdk';

import { normalizePublicKey } from '@renderer/utils/sdk';

/* Props */
const props = withDefaults(
  defineProps<{
    keyList: KeyList;
    readonly?: boolean;
    level?: number;
    path?: any;
    handleClick?: (path: number[], publicKey: string) => void;
  }>(),
  {
    readonly: false,
    level: 0,
    path: [],
  },
);

/* Emits */
defineEmits(['update:keyList']);

/* Handlers */
const handleKeyClick = (index: number, path: number[], publicKey: string) => {
  const clickedPath = [...path, index];
  props.handleClick && props.handleClick(clickedPath, publicKey);
};
</script>
<template>
  <div>
    <p>
      List ({{
        !keyList.threshold || keyList.threshold === keyList.toArray().length
          ? 'all'
          : keyList.threshold
      }}
      of {{ keyList.toArray().length }})
    </p>
    <template v-for="(item, index) in keyList.toArray()" :key="index">
      <template v-if="item instanceof KeyList && true">
        <div class="ms-5">
          <KeyStructure
            :key-list="item"
            :level="level + 1"
            :path="[...path, index]"
            :handleClick="handleClick"
          />
        </div>
      </template>
      <template v-else-if="item instanceof Key && true">
        <p class="ms-5 my-3" @click="handleKeyClick(index, path, normalizePublicKey(item))">
          {{ normalizePublicKey(item) }}
        </p>
      </template>
    </template>
  </div>
</template>
