<script setup lang="ts">
import {KeyList, Key, PublicKey} from '@hashgraph/sdk';

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

/* Misc */
const normalizePublicKey = (key: Key) => {
  const protoBuffKey = key._toProtobufKey();

  if (protoBuffKey.ed25519) {
    return PublicKey.fromBytesED25519(protoBuffKey.ed25519).toStringRaw();
  } else if (protoBuffKey.ECDSASecp256k1) {
    return PublicKey.fromBytesECDSA(protoBuffKey.ECDSASecp256k1).toStringRaw();
  }
  return '';
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
    <template
      v-for="(item, index) in keyList.toArray()"
      :key="index"
    >
      <template v-if="item instanceof KeyList && true">
        <div class="ms-5">
          <KeyStructure
            :key-list="item"
            :level="level + 1"
            :path="[...path, index]"
            :handle-click="handleClick"
          />
        </div>
      </template>
      <template v-else-if="item instanceof Key && true">
        <p
          class="ms-5 my-3"
          @click="handleKeyClick(index, path, normalizePublicKey(item))"
        >
          {{ normalizePublicKey(item) }}
        </p>
      </template>
    </template>
  </div>
</template>
