<script setup lang="ts">
import { KeyList, PublicKey } from '@hashgraph/sdk';

import AppPublicKeyNickname from '@renderer/components/ui/AppPublicKeyNickname.vue';

/* Props */
defineProps<{
  keyList: KeyList;
}>();

/* Emits */
defineEmits(['update:keyList']);
</script>
<template>
  <div class="text-nowrap">
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
      <template v-else-if="item instanceof PublicKey && true">
        <p class="text-nowrap ms-5 my-3">
          <AppPublicKeyNickname :public-key="item" />
        </p>
      </template>
    </template>
  </div>
</template>
