<script setup lang="ts">
import { computed } from 'vue';

import { Key } from '@hashgraph/sdk';

import { ableToSign } from '@renderer/utils';

import SignatureStatusEntities from '@renderer/components/SignatureStatusEntities.vue';

/* Props */
const props = defineProps<{
  signatureKeyObject: {
    signatureKeys: Key[];
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
    nodeAdminKeys: {
      [accountId: string]: Key;
    };
  };
  clean?: boolean;
  publicKeysSigned: string[];
}>();

/* Computed */
const hasMultiplePublicKeys = computed(() =>
  props.signatureKeyObject.signatureKeys.length > 1
);
const isSignatureKeySatisfied = computed(() =>
  props.signatureKeyObject.signatureKeys.every(key =>
    ableToSign(props.publicKeysSigned, key)
  )
);
</script>
<template>
  <div :class="{ 'ms-4': hasMultiplePublicKeys }">
    <template v-if="hasMultiplePublicKeys">
      <div class="d-flex position-relative text-nowrap">
        <span
          v-if="isSignatureKeySatisfied"
          class="bi bi-check-lg text-success position-absolute"
          :style="{ left: '-15px' }"
        ></span>
        <p
          class="text-nowrap"
          :class="{ 'text-success': isSignatureKeySatisfied }"
        >Required Keys</p>
      </div>
    </template>
    <template v-if="signatureKeyObject.payerKey">
      <div class="ms-4" :class="{ 'ms-5': hasMultiplePublicKeys }">
        <SignatureStatusEntities
          :entities="signatureKeyObject.payerKey"
          :public-keys-signed="publicKeysSigned"
          :label="`Payer $entityId Key`"
        />
      </div>
    </template>
    <template v-if="Object.keys(signatureKeyObject.accountsKeys).length > 0">
      <div class="ms-4" :class="{ 'ms-5': hasMultiplePublicKeys }">
        <SignatureStatusEntities
          :entities="signatureKeyObject.accountsKeys"
          :public-keys-signed="publicKeysSigned"
          :label="`$entityId Key`"
        />
      </div>
    </template>
    <template v-if="Object.keys(signatureKeyObject.receiverAccountsKeys).length > 0">
      <div class="ms-4" :class="{ 'ms-5': hasMultiplePublicKeys }">
        <SignatureStatusEntities
          :entities="signatureKeyObject.receiverAccountsKeys"
          :public-keys-signed="publicKeysSigned"
          :label="`Receiver Account $entityId Key`"
        />
      </div>
    </template>
    <template v-if="Object.keys(signatureKeyObject.nodeAdminKeys).length > 0">
      <div class="ms-4" :class="{ 'ms-5': hasMultiplePublicKeys }">
        <SignatureStatusEntities
          :entities="signatureKeyObject.nodeAdminKeys"
          :public-keys-signed="publicKeysSigned"
          :label="`Node $entityId Admin Key`"
        />
      </div>
    </template>
    <template v-if="signatureKeyObject.newKeys.length > 0">
      <div class="ms-4" :class="{ 'ms-5': hasMultiplePublicKeys }">
        <SignatureStatusEntities
          :entities="signatureKeyObject.newKeys"
          :public-keys-signed="publicKeysSigned"
          :label="`New Key${signatureKeyObject.newKeys.length > 1 ? 's' : ''}`"
        />
      </div>
    </template>
  </div>
</template>
