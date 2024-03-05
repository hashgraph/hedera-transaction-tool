<script setup lang="ts">
import { KeyList, Key } from '@hashgraph/sdk';

import useKeyPairsStore from '@renderer/stores/storeKeyPairs';

import { normalizePublicKey } from '@renderer/utils/sdk';

/* Props */
defineProps<{
  keyList: KeyList;
}>();

/* Emits */
defineEmits(['update:keyList']);

/* Stores */
const keyPairs = useKeyPairsStore();
</script>
<template>
  <div>
    <p>
      Threshold ({{
        !keyList.threshold || keyList.threshold === keyList.toArray().length
          ? keyList.toArray().length
          : keyList.threshold
      }}
      of {{ keyList.toArray().length }})
    </p>
    <template v-for="(item, _index) in keyList.toArray()" :key="_index">
      <template v-if="item instanceof KeyList && true">
        <div class="ms-5">
          <KeyStructure :key-list="item" />
        </div>
      </template>
      <template v-else-if="item instanceof Key && true">
        <p class="ms-5 my-3">
          <span v-if="keyPairs.getNickname(normalizePublicKey(item))" class="text-pink"
            >({{ keyPairs.getNickname(normalizePublicKey(item)) }}) </span
          >{{ normalizePublicKey(item) }}
        </p>
      </template>
    </template>
  </div>
</template>
