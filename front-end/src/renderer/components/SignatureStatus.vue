<script setup lang="ts">
import { computed } from 'vue';

import { Key, KeyList } from '@hashgraph/sdk';

import { flattenKeyList } from '@renderer/services/keyPairService';

import { ableToSign } from '@renderer/utils';

import SignatureStatusEntities from '@renderer/components/SignatureStatusEntities.vue';

/* Props */
const props = defineProps<{
  signatureKeyObject: {
    signatureKey: KeyList;
    accountsKeys: {
      [accountId: string]: Key;
    };
    receiverAccountsKeys: {
      [accountId: string]: Key;
    };
    newKeys: Key[];
    payerKey: {
      [accountId: string]: Key;
    };
  };
  clean?: boolean;
  publicKeysSigned: string[];
}>();

/* Computed */
const publicKeysInKeyList = computed(() => flattenKeyList(props.signatureKeyObject.signatureKey));
</script>
<template>
  <template v-if="publicKeysInKeyList.length > 1">
    <div>
      <p
        class="text-nowrap"
        :class="{ 'text-success': ableToSign(publicKeysSigned, signatureKeyObject.signatureKey) }"
      >
        <span
          v-if="ableToSign(publicKeysSigned, signatureKeyObject.signatureKey)"
          class="bi bi-check-lg text-success"
        ></span>
        Threshold ({{
          !signatureKeyObject.signatureKey.threshold ||
          signatureKeyObject.signatureKey.threshold ===
            signatureKeyObject.signatureKey.toArray().length
            ? signatureKeyObject.signatureKey.toArray().length
            : signatureKeyObject.signatureKey.threshold
        }}
        of {{ signatureKeyObject.signatureKey.toArray().length }})
      </p>
    </div>
  </template>
  <template v-if="signatureKeyObject.payerKey">
    <SignatureStatusEntities
      :entities="signatureKeyObject.payerKey"
      :public-keys-signed="publicKeysSigned"
      :label="`Payer $entityId Key`"
    />
  </template>
  <template v-if="Object.keys(signatureKeyObject.accountsKeys).length > 0">
    <SignatureStatusEntities
      :entities="signatureKeyObject.accountsKeys"
      :public-keys-signed="publicKeysSigned"
      :label="`$entityId Key`"
    />
  </template>
  <template v-if="Object.keys(signatureKeyObject.receiverAccountsKeys).length > 0">
    <SignatureStatusEntities
      :entities="signatureKeyObject.receiverAccountsKeys"
      :public-keys-signed="publicKeysSigned"
      :label="`Receiver Account $entityId Key`"
    />
  </template>
  <template v-if="signatureKeyObject.newKeys.length > 0">
    <SignatureStatusEntities
      :entities="signatureKeyObject.newKeys"
      :public-keys-signed="publicKeysSigned"
      :label="`New Key${signatureKeyObject.newKeys.length > 1 ? 's' : ''}`"
    />
  </template>
</template>
