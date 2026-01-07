<script lang="ts" setup>
import AppModal from '@renderer/components/ui/AppModal.vue';
import AppButton from '@renderer/components/ui/AppButton.vue';
import { computed, ref, watch } from 'vue';
import type { TransactionFile, TransactionFileItem } from '@shared/interfaces';
import { readTransactionFile, writeTransactionFile } from '@renderer/services/transactionFile.ts';
import AppPager from '@renderer/components/ui/AppPager.vue';
import SignTransactionFileModalRow from '@renderer/components/ExternalSigning/SignTransactionFileModalRow.vue';
import {
  collectMissingSignerKeys,
  filterTransactionFileItemsToBeSigned,
} from '@shared/utils/transactionFile.ts';
import useUserStore from '@renderer/stores/storeUser.ts';
import useNetworkStore from '@renderer/stores/storeNetwork';
import { AccountByIdCache } from '@renderer/caches/mirrorNode/AccountByIdCache.ts';
import { NodeByIdCache } from '@renderer/caches/mirrorNode/NodeByIdCache.ts';
import { assertUserLoggedIn, hexToUint8Array, uint8ToHex } from '@renderer/utils';
import { SignatureMap, Transaction } from '@hashgraph/sdk';
import { signTransaction } from '@renderer/services/transactionService.ts';

/* Props */
const props = defineProps<{
  filePath: string | null;
}>();

/* Models */
const show = defineModel<boolean>('show', { required: true });

/* Stores */
const user = useUserStore();
const network = useNetworkStore();

/* Injected */
const accountInfoCache = AccountByIdCache.inject();
const nodeInfoCache = NodeByIdCache.inject();

/* State */
const transactionFile = ref<TransactionFile | null>(null);
const itemsToBeSigned = ref<TransactionFileItem[]>([]);
const currentPage = ref(1);
const pageSize = ref(15);

/* Computed */
const pageStart = computed(() => (currentPage.value - 1) * pageSize.value);
const pagedItems = computed(() => {
  return itemsToBeSigned.value.slice(pageStart.value, pageStart.value + pageSize.value);
});

/* Handlers */
async function handleSignAll() {
  assertUserLoggedIn(user.personal);
  const password = user.getPassword();
  if (!password && !user.personal.useKeychain) throw new Error('Password is required to sign');

  if (transactionFile.value) {
    const updatedFile: TransactionFile = {
      network: transactionFile.value!.network,
      items: [],
    };

    for (const item of transactionFile.value!.items) {
      const updatedItem = { ...item };

      if (itemsToBeSigned.value.includes(item)) {
        const transactionBytes = hexToUint8Array(item.transactionBytes);
        const sdkTransaction = Transaction.fromBytes(transactionBytes);
        const missingSignerKeys = await collectMissingSignerKeys(
          sdkTransaction,
          user.publicKeys,
          network.getMirrorNodeREST(transactionFile.value!.network),
          accountInfoCache,
          nodeInfoCache,
        );

        const sigMapBefore = SignatureMap._fromTransaction(sdkTransaction);
        console.log(`SignatureMap before signing`, sigMapBefore.toJSON());

        try {
          const signedBytes = await signTransaction(
            transactionBytes,
            missingSignerKeys,
            user.personal.id,
            password,
            false,
          );
          updatedItem.transactionBytes = uint8ToHex(signedBytes);

          const signedTransaction = Transaction.fromBytes(signedBytes);
          const sigMapAfter = SignatureMap._fromTransaction(signedTransaction);
          console.log(`SignatureMap after signing`, sigMapAfter.toJSON());
        } catch (error) {
          console.log(
            `Error signing one of the transactions in the file (leaving transaction untouched):`,
            error,
          );
        }
      }
      updatedFile.items.push(updatedItem);
    }
    await writeTransactionFile(updatedFile, props.filePath!);
  }
  show.value = false;
}

/* Watchers */
watch(
  show,
  async () => {
    if (show.value && props.filePath) {
      transactionFile.value = await readTransactionFile(props.filePath);
      itemsToBeSigned.value = await filterTransactionFileItemsToBeSigned(
        transactionFile.value.items,
        user.publicKeys,
        network.getMirrorNodeREST(transactionFile.value.network),
        accountInfoCache,
        nodeInfoCache,
      );
    } else {
      transactionFile.value = null;
      itemsToBeSigned.value = [];
    }
  },
  { immediate: true },
);
</script>

<template>
  <AppModal v-model:show="show" :class="{ 'full-screen-modal': itemsToBeSigned.length > 0 }">
    <template v-if="itemsToBeSigned.length > 0">
      <div class="p-5">
        <div class="d-flex align-items-center mb-5">
          <i class="bi bi-x-lg cursor-pointer me-5" @click="show = false" />
          <h3 class="text-subheader fw-medium flex-1">
            Do you want to sign the following transactions?
          </h3>
        </div>
        <form @submit.prevent="handleSignAll">
          <template v-if="transactionFile">
            <table class="table-custom">
              <thead>
                <tr>
                  <th>Transaction ID</th>
                  <th>Transaction Type</th>
                  <th>Description</th>
                  <th>Valid Start</th>
                  <th>Creator email</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <template v-for="(item, index) of pagedItems" :key="pageStart + index">
                  <SignTransactionFileModalRow :index="pageStart + index" :item="item" />
                </template>
              </tbody>
              <tfoot v-if="transactionFile.items.length > pageSize" class="d-table-caption">
                <tr class="d-inline">
                  <AppPager
                    v-model:current-page="currentPage"
                    v-model:per-page="pageSize"
                    :total-items="transactionFile.items.length"
                  />
                </tr>
              </tfoot>
            </table>
          </template>

          <div class="d-flex justify-content-end mt-5">
            <AppButton color="primary" data-testid="button-sign-transaction-file" type="submit"
              >Sign and Update File</AppButton
            >
          </div>
        </form>
      </div>
    </template>
    <template v-else>
      <div class="p-5">
        <div class="d-flex align-items-center mb-5">
          <i class="bi bi-x-lg cursor-pointer me-5" @click="show = false" />
          <h3 class="text-subheader fw-medium flex-1">No transactions to sign.</h3>
        </div>
        <p v-if="transactionFile && transactionFile.items.length > 0" class="text-secondary">
          You do not have any of the keys required to sign the transactions in this file. Make sure
          all your keys are imported in the Settings page and try again.
        </p>
        <p v-else class="text-secondary">This file does not contain any usable transactions.</p>
        <div class="d-flex justify-content-end mt-5">
          <AppButton color="primary" data-testid="button-ok" @click="show = false"> OK</AppButton>
        </div>
      </div>
    </template>
  </AppModal>
</template>
