<script setup lang="ts">
import { computed } from 'vue';

import { ableToSign, type SignatureAudit } from '@renderer/utils';

import SignatureStatusEntities from '@renderer/components/SignatureStatusEntities.vue';

/* Props */
const props = defineProps<{
  signatureKeyObject: SignatureAudit;
  clean?: boolean;
  publicKeysSigned: string[];
  showExternal: boolean;
}>();

/* Computed */
const hasMultiplePublicKeys = computed(() => props.signatureKeyObject.signatureKeys.length > 1);
const isSignatureKeySatisfied = computed(() =>
  props.signatureKeyObject.signatureKeys.every(key => ableToSign(props.publicKeysSigned, key)),
);
const externalKeysRaw = computed(() => {
  const result = new Set<string>();
  if (props.showExternal) {
    props.signatureKeyObject.externalKeys.forEach(k => result.add(k.toStringRaw()));
  }
  // else we leave result empty => no external badge will appear
  return result;
});
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
        <p class="text-nowrap" :class="{ 'text-success': isSignatureKeySatisfied }">
          Required Keys
        </p>
      </div>
    </template>
    <template v-if="signatureKeyObject.payerKey">
      <div class="ms-4" :class="{ 'ms-5': hasMultiplePublicKeys }">
        <SignatureStatusEntities
          :entities="signatureKeyObject.payerKey"
          :public-keys-signed="publicKeysSigned"
          :label="`Payer $entityId Key`"
          :externalKeys="externalKeysRaw"
        />
      </div>
    </template>
    <template v-if="Object.keys(signatureKeyObject.accountsKeys).length > 0">
      <div class="ms-4" :class="{ 'ms-5': hasMultiplePublicKeys }">
        <SignatureStatusEntities
          :entities="signatureKeyObject.accountsKeys"
          :public-keys-signed="publicKeysSigned"
          :label="`$entityId Key`"
          :externalKeys="externalKeysRaw"
        />
      </div>
    </template>
    <template v-if="Object.keys(signatureKeyObject.receiverAccountsKeys).length > 0">
      <div class="ms-4" :class="{ 'ms-5': hasMultiplePublicKeys }">
        <SignatureStatusEntities
          :entities="signatureKeyObject.receiverAccountsKeys"
          :public-keys-signed="publicKeysSigned"
          :label="`Receiver Account $entityId Key`"
          :externalKeys="externalKeysRaw"
        />
      </div>
    </template>
    <template v-if="Object.keys(signatureKeyObject.nodeAdminKeys).length > 0">
      <div class="ms-4" :class="{ 'ms-5': hasMultiplePublicKeys }">
        <SignatureStatusEntities
          :entities="signatureKeyObject.nodeAdminKeys"
          :public-keys-signed="publicKeysSigned"
          :label="`Node $entityId Admin Key`"
          :externalKeys="externalKeysRaw"
        />
      </div>
    </template>
    <template v-if="signatureKeyObject.newKeys.length > 0">
      <div class="ms-4" :class="{ 'ms-5': hasMultiplePublicKeys }">
        <SignatureStatusEntities
          :entities="signatureKeyObject.newKeys"
          :public-keys-signed="publicKeysSigned"
          :label="`New Key${signatureKeyObject.newKeys.length > 1 ? 's' : ''}`"
          :externalKeys="externalKeysRaw"
        />
      </div>
    </template>
  </div>
</template>
