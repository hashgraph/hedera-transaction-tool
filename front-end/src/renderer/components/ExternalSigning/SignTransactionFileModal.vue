<script lang="ts" setup>
import AppModal from '@renderer/components/ui/AppModal.vue';
import AppButton from '@renderer/components/ui/AppButton.vue';
import AppLoader from '@renderer/components/ui/AppLoader.vue';
import { ref, watch } from 'vue';
import type { TransactionFile, TransactionFileItem } from '@shared/interfaces';
import {
  readTransactionFile,
  writeTransactionFile,
} from '@renderer/services/transactionFileService.ts';
import {
  collectMissingSignerKeys,
  filterTransactionFileItemsToBeSigned,
} from '@renderer/utils/transactionFileSigning.ts';
import useUserStore from '@renderer/stores/storeUser.ts';
import useNetworkStore from '@renderer/stores/storeNetwork';
import { AppCache } from '@renderer/caches/AppCache.ts';
import { SignatureMap, Transaction } from '@hiero-ledger/sdk';
import { assertUserLoggedIn, hexToUint8Array, uint8ToHex } from '@renderer/utils';
import { signTransaction } from '@renderer/services/transactionService.ts';
import TransactionBrowser from '@renderer/components/ExternalSigning/TransactionBrowser/TransactionBrowser.vue';
import { ToastManager } from '@renderer/utils/ToastManager';
import AppCustomIcon from '@renderer/components/ui/AppCustomIcon.vue';
import { createLogger } from '@renderer/utils/logger';
import { CommonNetwork, CommonNetworkNames } from '@shared/enums';

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
const toastManager = ToastManager.inject();

/* Injected */
const appCache = AppCache.inject();
const logger = createLogger('renderer.externalSigning.signTransactionFile');
const commonNetworks = new Set<string>(Object.values(CommonNetwork));

/* State */
const transactionFile = ref<TransactionFile | null>(null);
const itemsToBeSigned = ref<TransactionFileItem[]>([]);
const itemsFullySigned = ref<TransactionFileItem[]>([]);
const itemsSignable = ref<TransactionFileItem[]>([]);
const showSuccessModal = ref(false);
const isAuditing = ref(false);
const networkLabel = (networkName: string) =>
  CommonNetworkNames[networkName as keyof typeof CommonNetworkNames] ?? networkName;

async function auditFile() {
  if (!transactionFile.value) return;
  isAuditing.value = true;
  try {
    const mirrorNodeLink = network.getMirrorNodeREST(network.network);
    const status = await filterTransactionFileItemsToBeSigned(
      transactionFile.value.items,
      user.publicKeys,
      mirrorNodeLink,
      appCache,
    );
    itemsToBeSigned.value = status.needSigning;
    itemsFullySigned.value = status.fullySigned;
    itemsSignable.value = status.needSigning.concat(status.fullySigned);
  } catch (error) {
    logger.error('Failed to analyze transactions in file', { error });
    toastManager.error('Failed to analyze transactions. Try again later.');
    show.value = false;
  } finally {
    isAuditing.value = false;
  }
}

/* Handlers */
async function handleSignAll() {
  assertUserLoggedIn(user.personal);
  const password = user.getPassword();
  if (!password && !user.personal.useKeychain) throw new Error('Password is required to sign');

  if (transactionFile.value) {
    const updatedFile: TransactionFile = {
      network: transactionFile.value.network,
      items: [],
    };

    for (const item of transactionFile.value.items) {
      const updatedItem = { ...item };

      if (itemsToBeSigned.value.includes(item)) {
        const transactionBytes = hexToUint8Array(item.transactionBytes);
        const sdkTransaction = Transaction.fromBytes(transactionBytes);
        const missingSignerKeys = await collectMissingSignerKeys(
          sdkTransaction,
          user.publicKeys,
          network.getMirrorNodeREST(network.network),
          appCache,
        );

        const sigMapBefore = SignatureMap._fromTransaction(sdkTransaction);
        logger.debug('Signing transaction file entry', {
          missingSignerCount: missingSignerKeys.length,
          signatureCountBefore: sigMapBefore.getFlatSignatureList().length,
        });

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
          logger.debug('Transaction file entry signed', {
            signatureCountAfter: sigMapAfter.getFlatSignatureList().length,
          });
        } catch (error) {
          logger.error('Failed to sign transaction file entry', { error });
          const reason = error instanceof Error ? `${error.message} ` : '';
          toastManager.error(
            `${reason}Please delete the private key and re-add it. For more help, contact your administrator.`,
          );
          return;
        }
      }
      updatedFile.items.push(updatedItem);
    }

    try {
      await writeTransactionFile(updatedFile, props.filePath!);
      showSuccessModal.value = true;
    } catch (error) {
      logger.error('Failed to update transaction file', { error });
      toastManager.error('Failed to update file');
    }
  }
}

/* Watchers */
watch(
  show,
  async () => {
    if (show.value && props.filePath) {
      transactionFile.value = null;
      isAuditing.value = false;
      itemsToBeSigned.value = [];
      itemsFullySigned.value = [];
      itemsSignable.value = [];
      try {
        transactionFile.value = await readTransactionFile(props.filePath);
        if (
          !network.isCurrentNetwork(transactionFile.value.network) &&
          !commonNetworks.has(transactionFile.value.network)
        ) {
          throw new Error('Transaction file uses an unknown network');
        }
        if (network.isCurrentNetwork(transactionFile.value.network)) {
          await auditFile();
        }
      } catch (error) {
        logger.error('Invalid transaction file', {
          error,
        });
        const validationMessage = error instanceof Error ? error.message : '';
        toastManager.error(
          validationMessage.includes('HTTPS is required')
            ? 'Transaction file network must use HTTPS.'
            : validationMessage === 'Transaction file uses an unknown network'
              ? 'Unknown network in transaction file.'
              : 'Invalid transaction file',
        );
        transactionFile.value = null;
        isAuditing.value = false;
        itemsToBeSigned.value = [];
        show.value = false;
      }
    } else {
      transactionFile.value = null;
      isAuditing.value = false;
      itemsToBeSigned.value = [];
      show.value = false;
    }
  },
  { immediate: true },
);
</script>

<template>
  <AppModal
    v-if="transactionFile && !network.isCurrentNetwork(transactionFile.network)"
    v-model:show="show"
    class="modal-fit-content"
  >
    <form class="p-5" @submit.prevent="show = false">
      <div>
        <i class="bi bi-x-lg cursor-pointer" @click.prevent="show = false"></i>
      </div>

      <div class="text-center">
        <AppCustomIcon :name="'error'" style="height: 80px" />
      </div>

      <h3 class="text-center text-title text-bold mt-4">Network mismatch</h3>

      <div class="text-center text-secondary mt-4">
        <p>
          This file is for {{ networkLabel(transactionFile.network) }}, but the app is currently set
          to {{ networkLabel(network.network) }}.
        </p>
        <p>You cannot sign this file while the app is using a different network.</p>
        <p>Switch to {{ networkLabel(transactionFile.network) }} in Settings, then try again.</p>
      </div>

      <div class="d-grid mt-5">
        <AppButton color="primary" data-testid="button-close-network-mismatch" type="submit">
          Close
        </AppButton>
      </div>
    </form>
  </AppModal>

  <AppModal v-else-if="isAuditing" v-model:show="show" class="medium-modal">
    <div class="p-5 d-flex justify-content-center"><AppLoader /></div>
  </AppModal>

  <template v-else-if="itemsSignable.length > 0">
    <AppModal v-model:show="show" class="full-screen-modal">
      <div class="p-5">
        <div class="d-flex align-items-center">
          <i class="bi bi-x-lg cursor-pointer me-5" @click="show = false" />
        </div>
        <form class="h-100" @submit.prevent="handleSignAll">
          <p class="text-center text-secondary">
            Signing transactions for network: {{ networkLabel(network.network) }}
          </p>
          <h1 class="text-title text-semi-bold text-center mb-5">
            <template v-if="itemsToBeSigned.length === 0 && itemsFullySigned.length === 1">
              You have already signed this transaction
            </template>
            <template v-else-if="itemsToBeSigned.length === 0">
              You have already signed these transactions
            </template>
            <template v-else-if="itemsToBeSigned.length === 1">
              You have 1 transaction to sign
            </template>
            <template v-else> You have {{ itemsToBeSigned.length }} transactions to sign </template>
          </h1>
          <div class="d-flex justify-content-end mb-5">
            <AppButton :disabled="itemsToBeSigned.length === 0" color="primary" type="submit"
              >Sign and Update File
            </AppButton>
          </div>
          <TransactionBrowser :items="itemsSignable" />
        </form>
      </div>
    </AppModal>

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
  </template>

  <template v-else>
    <AppModal v-if="transactionFile && !isAuditing" v-model:show="show" class="medium-modal">
      <div class="p-5">
        <div class="d-flex align-items-center mb-5">
          <i class="bi bi-x-lg cursor-pointer" @click.prevent="show = false"></i>
        </div>
        <div class="text-center">
          <AppCustomIcon :name="'error'" style="height: 80px" />
        </div>
        <h3 class="text-center text-title text-bold mt-4">No transaction to sign.</h3>
        <div
          v-if="transactionFile && transactionFile.items.length > 0"
          class="text-center text-secondary mt-4"
        >
          You do not have any of the keys required to sign the transactions in this file. Make sure
          to imports all needed keys in the Settings page and try again.
        </div>
        <div v-else class="text-center text-secondary mt-4">
          This file is empty or does not contain any usable transaction.
        </div>
        <div class="d-grid mt-5">
          <AppButton color="primary" data-testid="button-ok" @click="show = false">OK</AppButton>
        </div>
      </div>
    </AppModal>
  </template>
</template>
