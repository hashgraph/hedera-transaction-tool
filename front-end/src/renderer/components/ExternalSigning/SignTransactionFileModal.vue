<script lang="ts" setup>
import AppModal from '@renderer/components/ui/AppModal.vue';
import AppButton from '@renderer/components/ui/AppButton.vue';
import { ref, watch } from 'vue';
import type { TransactionFile, TransactionFileItem } from '@shared/interfaces';
import { readTransactionFile, writeTransactionFile } from '@renderer/services/transactionFile.ts';
import { collectMissingSignerKeys } from '@shared/utils/transactionFile.ts';
import useUserStore from '@renderer/stores/storeUser.ts';
import useNetworkStore from '@renderer/stores/storeNetwork';
import { AccountByIdCache } from '@renderer/caches/mirrorNode/AccountByIdCache.ts';
import { NodeByIdCache } from '@renderer/caches/mirrorNode/NodeByIdCache.ts';
import { assertUserLoggedIn, getErrorMessage, hexToUint8Array, uint8ToHex } from '@renderer/utils';
import { SignatureMap, Transaction } from '@hashgraph/sdk';
import { signTransaction } from '@renderer/services/transactionService.ts';
import TransactionBrowser from '@renderer/components/ExternalSigning/TransactionBrowser/TransactionBrowser.vue';
import { useToast } from 'vue-toast-notification';
import { errorToastOptions } from '@renderer/utils/toastOptions.ts';
import AppCustomIcon from '@renderer/components/ui/AppCustomIcon.vue';

/* Props */
const props = defineProps<{
  filePath: string | null;
}>();

/* Models */
const show = defineModel<boolean>('show', { required: true });

/* Stores */
const user = useUserStore();
const network = useNetworkStore();

/* Composables */
const toast = useToast();

/* Injected */
const accountInfoCache = AccountByIdCache.inject();
const nodeInfoCache = NodeByIdCache.inject();

/* State */
const transactionFile = ref<TransactionFile | null>(null);
const itemsToBeSigned = ref<TransactionFileItem[]>([]);
const showSuccessModal = ref(false);

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
    try {
      await writeTransactionFile(updatedFile, props.filePath!);
      showSuccessModal.value = true;
    } catch (error) {
      console.log(getErrorMessage(error, 'Failed to update transaction file'));
      toast.error('Failed to update file', errorToastOptions);
    }
  }
}

/* Watchers */
watch(
  show,
  async () => {
    if (show.value && props.filePath) {
      transactionFile.value = await readTransactionFile(props.filePath);
      itemsToBeSigned.value = transactionFile.value.items;
      // itemsToBeSigned.value = await filterTransactionFileItemsToBeSigned(
      //   transactionFile.value.items,
      //   user.publicKeys,
      //   network.getMirrorNodeREST(transactionFile.value.network),
      //   accountInfoCache,
      //   nodeInfoCache,
      // );
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
        <div class="d-flex align-items-center">
          <i class="bi bi-x-lg cursor-pointer me-5" @click="show = false" />
        </div>
        <form @submit.prevent="handleSignAll" class="h-100">
          <h1 class="text-title text-semi-bold text-center mb-5">
            <template v-if="itemsToBeSigned.length == 0"
              >You have no transaction to sign in this file</template
            >
            <template v-if="itemsToBeSigned.length == 1"
              >You have 1 transaction to sign in this file</template
            >
            <template v-else
              >You have {{ itemsToBeSigned.length }} transactions to sign in this file</template
            >
          </h1>

          <div class="d-flex justify-content-end mb-5">
            <AppButton color="primary" data-testid="button-sign-transaction-file" type="submit"
              >Sign and Update File</AppButton
            >
          </div>

          <template v-if="transactionFile">
            <TransactionBrowser :items="itemsToBeSigned" />
          </template>
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

    <AppModal v-model:show="showSuccessModal" class="common-modal">
      <form class="p-5" @submit.prevent="show = false">
        <div>
          <i class="bi bi-x-lg cursor-pointer" @click.prevent="show = false"></i>
        </div>

        <div class="text-center">
          <AppCustomIcon :name="'success'" style="height: 80px" />
        </div>

        <h3 class="text-center text-title text-bold mt-4">Transaction file updated</h3>

        <div class="text-center text-secondary mt-4">
          You have successfully signed {{ itemsToBeSigned.length }}
          {{ itemsToBeSigned.length > 1 ? 'transactions' : 'transaction' }}.
        </div>
        <div class="text-center text-small text-muted mt-4">
          You may now send the file back to the person who sent it to you.
        </div>

        <div class="d-grid mt-5">
          <AppButton color="primary" data-testid="button-close" type="submit">Close</AppButton>
        </div>
      </form>
    </AppModal>
  </AppModal>
</template>
