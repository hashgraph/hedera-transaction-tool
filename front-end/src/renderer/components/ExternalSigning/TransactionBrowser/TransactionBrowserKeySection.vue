<script setup lang="ts">
import type { ITransactionBrowserItem } from '@renderer/components/ExternalSigning/TransactionBrowser/ITransactionBrowserItem.ts';
import SignatureStatus from '@renderer/components/SignatureStatus.vue';
import { computed, ref, watch, type Ref } from 'vue';
import { Transaction } from '@hashgraph/sdk';
import {
  computeSignatureKey,
  hexToUint8Array,
  type SignatureAudit,
} from '@renderer/utils';
import useUserStore from '@renderer/stores/storeUser';
import useNetwork from '@renderer/stores/storeNetwork';
import { AccountByIdCache } from '@renderer/caches/mirrorNode/AccountByIdCache.ts';
import { NodeByIdCache } from '@renderer/caches/mirrorNode/NodeByIdCache.ts';

/* Props */
const props = defineProps<{
  item: ITransactionBrowserItem;
}>();

/* Stores */
const user = useUserStore();
const network = useNetwork();

/* Injected */
const accountByIdCache = AccountByIdCache.inject();
const nodeByIdCache = NodeByIdCache.inject();

/* State */
const signatureKeyObject: Ref<SignatureAudit | null> = ref(null);

/* Computed */
const transaction = computed<Transaction | null>(() => {
  let result: Transaction | null;
  try {
    result = Transaction.fromBytes(hexToUint8Array(props.item.transactionBytes));
  } catch (error) {
    console.log('error=' + error);
    result = null;
  }
  return result;
});
const signersPublicKeys = computed(() => {
  return transaction.value ? [...transaction.value._signerPublicKeys] : [];
});

/* Handlers */
const updateSignatureKeyObject = async () => {
  if (transaction.value !== null) {
    try {
      signatureKeyObject.value = await computeSignatureKey(
        transaction.value,
        network.mirrorNodeBaseURL,
        accountByIdCache,
        nodeByIdCache,
        user.selectedOrganization,
      );
    } catch (error) {
      console.log('error=' + error);
      signatureKeyObject.value = null;
    }
  } else {
    signatureKeyObject.value = null;
  }
};

/* Watchers */
watch(transaction, updateSignatureKeyObject, { immediate: true });
</script>

<template>
  <SignatureStatus
    v-if="signatureKeyObject"
    :signature-key-object="signatureKeyObject"
    :public-keys-signed="signersPublicKeys"
    :show-external="false"
  />
</template>

<style scoped></style>
