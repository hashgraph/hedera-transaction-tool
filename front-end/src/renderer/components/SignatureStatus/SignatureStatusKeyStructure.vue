<script setup lang="ts">
import { computed } from 'vue';

import { KeyList, PublicKey } from '@hiero-ledger/sdk';

import { ableToSign } from '@renderer/utils';

import SignatureStatusSingleKey from '@renderer/components/SignatureStatus/SignatureStatusSingleKey.vue';
import KeyComponent from '@renderer/components/KeyComponent.vue';

/* Props */
const props = defineProps<{
  keyList: KeyList;
  publicKeysSigned: string[];
  externalKeys: Set<string>;
  depth: number;
}>();

/* Computed */
const singlePublicKey = computed(() => {
  const keys = props.keyList.toArray();
  return keys.length === 1 && keys[0] instanceof PublicKey ? keys[0] : null;
});

/* Emits */
defineEmits(['update:keyList']);
</script>
<template>
  <template v-if="singlePublicKey !== null">
    <div class="d-flex position-relative text-nowrap">
      <SignatureStatusSingleKey
        :public-key="singlePublicKey"
        :signed="publicKeysSigned.includes(singlePublicKey.toStringRaw())"
        :able-to-sign="ableToSign(publicKeysSigned, keyList)"
        :external="props.externalKeys.has(singlePublicKey.toStringRaw())"
      />
    </div>
  </template>
  <template v-else>
    <div>
      <div class="d-flex position-relative">
        <span
          v-if="ableToSign(publicKeysSigned, keyList)"
          class="bi bi-check-lg text-success position-absolute"
          :style="{ left: '-15px' }"
          data-testid="span-checkmark-threshold"
        ></span>
        <p class="text-nowrap" :class="{ 'text-success': ableToSign(publicKeysSigned, keyList) }">
          Threshold ({{
            !keyList.threshold || keyList.threshold === keyList.toArray().length
              ? keyList.toArray().length
              : keyList.threshold
          }}
          of {{ keyList.toArray().length }})
        </p>
      </div>
      <template v-for="(item, _index) in keyList.toArray()" :key="_index">
        <template v-if="item instanceof KeyList">
          <div class="ms-5">
            <SignatureStatusKeyStructure
              :key-list="item"
              :public-keys-signed="publicKeysSigned"
              :external-keys="props.externalKeys"
              :depth="depth + 1"
            />
          </div>
        </template>
        <template v-else-if="item instanceof PublicKey">
          <div class="d-flex position-relative text-nowrap ms-5 my-3">
            <SignatureStatusSingleKey
              :public-key="item"
              :signed="publicKeysSigned.includes(item.toStringRaw())"
              :able-to-sign="ableToSign(publicKeysSigned, keyList)"
              :external="props.externalKeys.has(item.toStringRaw())"
              :depth="depth"
              :index="_index"
            />
          </div>
        </template>
        <div v-else class="text-nowrap ms-5 my-3">
          <KeyComponent :component="item" />
        </div>
      </template>
    </div>
  </template>
</template>
