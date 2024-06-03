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
    <div>
      <span
        v-if="publicKeysSigned.includes(publicKeysInKeyListRaw[0])"
        class="bi bi-check-lg text-success"
      ></span>
      <span class="me-2">
        {{ publicKeysInKeyListRaw[0] }}
      </span>
      <AppPublicKeyNickname
        :public-key="publicKeysInKeyListRaw[0]"
        :brackets="true"
        class="text-pink"
      />
    </div>
  </template>
  <template v-else>
    <div>
      <p>
        <span
          v-if="ableToSign(publicKeysSigned, keyList)"
          class="bi bi-check-lg text-success"
        ></span>
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
            <KeyStructureSignatureStatus :key-list="item" :public-keys-signed="publicKeysSigned" />
          </div>
        </template>
        <template v-else-if="item instanceof PublicKey && true">
          <p class="ms-5 my-3">
            <span
              v-if="publicKeysSigned.includes(item.toStringRaw())"
              class="bi bi-check-lg text-success"
            ></span>
            <span class="me-2">
              {{ item.toStringRaw() }}
            </span>
            <AppPublicKeyNickname :public-key="item" :brackets="true" class="text-pink" />
          </p>
        </template>
      </template>
    </div>
  </template>
</template>
