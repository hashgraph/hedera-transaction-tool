<script setup lang="ts">
import { computed } from 'vue';

import { KeyList, PublicKey } from '@hashgraph/sdk';

import { flattenKeyList } from '@renderer/services/keyPairService';

import { ableToSign } from '@renderer/utils';

import AppPublicKeyNickname from '@renderer/components/ui/AppPublicKeyNickname.vue';

/* Props */
const props = defineProps<{
  keyList: KeyList;
  publicKeysSigned: string[];
  externalKeys: Set<string>;
  depth: number;
}>();

/* Computed */
const publicKeysInKeyList = computed(() => flattenKeyList(props.keyList));
const publicKeysInKeyListRaw = computed(() =>
  flattenKeyList(props.keyList).map(k => k.toStringRaw()),
);

/* Emits */
defineEmits(['update:keyList']);
</script>
<template>
  <template v-if="publicKeysInKeyList.length === 1">
    <div class="d-flex position-relative text-nowrap">
      <span
        v-if="publicKeysSigned.includes(publicKeysInKeyListRaw[0])"
        class="bi bi-check-lg text-success position-absolute"
        :style="{ left: '-15px' }"
        data-testid="span-checkmark-payer-key"
      ></span>
      <AppPublicKeyNickname
        :public-key="publicKeysInKeyListRaw[0]"
        class="me-2"
        :signed="ableToSign(publicKeysSigned, keyList)"
        :external="props.externalKeys.has(publicKeysInKeyListRaw[0])"
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
        <template v-if="item instanceof KeyList && true">
          <div class="ms-5">
            <SignatureStatusKeyStructure
              :key-list="item"
              :public-keys-signed="publicKeysSigned"
              :external-keys="props.externalKeys"
              :depth="depth + 1"
            />
          </div>
        </template>
        <template v-else-if="item instanceof PublicKey && true">
          <div class="d-flex position-relative text-nowrap ms-5 my-3">
            <span
              v-if="publicKeysSigned.includes(item.toStringRaw())"
              class="bi bi-check-lg text-success position-absolute"
              :style="{ left: '-15px' }"
              :data-testid="`span-checkmark-public-key-${depth}-${_index}`"
            ></span>
            <p class="text-nowrap me-2" :data-testid="`span-public-key-${depth}-${_index}`">
              <AppPublicKeyNickname
                :signed="publicKeysSigned.includes(item.toStringRaw())"
                :external="props.externalKeys.has(item.toStringRaw())"
                :public-key="item"
              />
            </p>
          </div>
        </template>
      </template>
    </div>
  </template>
</template>
