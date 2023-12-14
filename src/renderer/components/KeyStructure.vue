<script setup lang="ts">
import { KeyList, Key, PublicKey } from '@hashgraph/sdk';
defineProps<{
  keyList: KeyList;
  readonly?: boolean;
}>();
defineEmits(['update:keyList']);
</script>
<template>
  <template v-for="(item, index) in keyList.toArray()" :key="index">
    <div class="mt-2">
      <template v-if="item instanceof KeyList && true">
        <p>
          List ({{
            !item.threshold || item.threshold === item.toArray().length ? 'all' : item.threshold
          }}
          of {{ item.toArray().length }})
        </p>
        <div class="ms-5">
          <KeyStructure :key-list="item" />
        </div>
      </template>
      <template v-else-if="item instanceof Key && true">
        <p class="my-3">
          {{ PublicKey.fromBytesED25519(item._toProtobufKey().ed25519!).toStringRaw() }}
        </p>
      </template>
    </div>
  </template>
</template>
