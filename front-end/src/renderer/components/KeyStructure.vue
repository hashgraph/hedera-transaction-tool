<script setup lang="ts">
import KeyItem from './KeyItem.vue';
import { KeyList, PublicKey } from '@hiero-ledger/sdk';

import AppPublicKeyNickname from '@renderer/components/ui/AppPublicKeyNickname.vue';

/* Props */
withDefaults(
  defineProps<{
    keyList: KeyList;
    noThreshold?: boolean;
  }>(),
  {
    noThreshold: false,
  },
);

/* Emits */
defineEmits(['update:keyList']);
</script>
<template>
  <div class="text-nowrap">
    <p v-if="noThreshold">Key List of {{ keyList.toArray().length }}</p>
    <p v-else>
      Threshold ({{
        !keyList.threshold || keyList.threshold === keyList.toArray().length
          ? keyList.toArray().length
          : keyList.threshold
      }}
      of {{ keyList.toArray().length }})
    </p>
    <template v-for="(item, _index) in keyList.toArray()" :key="_index">
      <div v-if="item instanceof KeyList" class="ms-5">
        <KeyStructure :key-list="item" />
      </div>
      <p v-else-if="item instanceof PublicKey" class="text-nowrap ms-5 my-3">
        <AppPublicKeyNickname :public-key="item" />
      </p>
      <p v-else class="ms-5 my-3">
        <KeyItem :item="item" />
      </p>
    </template>
  </div>
</template>
