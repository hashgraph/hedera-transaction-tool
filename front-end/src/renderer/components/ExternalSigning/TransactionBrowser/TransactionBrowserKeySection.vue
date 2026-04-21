<script setup lang="ts">
import type { ITransactionBrowserItem } from '@renderer/components/ExternalSigning/TransactionBrowser/ITransactionBrowserItem.ts';
import SignatureStatus from '@renderer/components/SignatureStatus.vue';
import { computed, ref, watch, type Ref } from 'vue';
import { Transaction } from '@hiero-ledger/sdk';
import {
  computeSignatureKey,
  hexToUint8Array,
  type SignatureAudit,
} from '@renderer/utils';
import useUserStore from '@renderer/stores/storeUser';
import useNetwork from '@renderer/stores/storeNetwork';
import { AppCache } from '@renderer/caches/AppCache.ts';
import { createLogger } from '@renderer/utils/logger';

const logger = createLogger('renderer.component.transactionBrowserKeySection');

/* Props */
const props = defineProps<{
  item: ITransactionBrowserItem;
}>();

/* Stores */
const user = useUserStore();
const network = useNetwork();

/* Injected */
const appCache = AppCache.inject();
const accountByIdCache = appCache.mirrorAccountById;
const nodeByIdCache = appCache.mirrorNodeById;
const publicKeyOwnerCache = appCache.backendPublicKeyOwner;

/* State */
const signatureKeyObject: Ref<SignatureAudit | null> = ref(null);

/* Computed */
const transaction = computed<Transaction | null>(() => {
  let result: Transaction | null;
  try {
    result = Transaction.fromBytes(hexToUint8Array(props.item.transactionBytes));
  } catch (error) {
    logger.error('Failed to parse transaction bytes', { error });
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
        publicKeyOwnerCache,
        user.selectedOrganization,
      );
    } catch (error) {
      logger.error('Failed to compute signature key', { error });
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
