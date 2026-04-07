<script setup lang="ts">
import { ref, computed } from 'vue';
import ActionController from '@renderer/components/ActionController/ActionController.vue';
import { ToastManager } from '@renderer/utils/ToastManager.ts';
import { createLogger, createTransactionId } from '@renderer/utils';
import useTransactionGroupStore from '@renderer/stores/storeTransactionGroup.ts';
import { Hbar, HbarUnit, KeyList, TransferTransaction } from '@hiero-ledger/sdk';
import { AccountByIdCache } from '@renderer/caches/mirrorNode/AccountByIdCache.ts';
import useNetworkStore from '@renderer/stores/storeNetwork.ts';
import useAccountId from '@renderer/composables/useAccountId.ts';
import type { ActionReport } from '@renderer/components/ActionController/ActionReport.ts';

const logger = createLogger('renderer.page.importCSVController');

/* Props */
const props = defineProps<{
  selectedFile?: File;
  callback: () => Promise<void>;
}>();

const activate = defineModel<boolean>('activate', { required: true });
const description = defineModel<string>('description', { required: true });

/* Composables */
const payerData = useAccountId();

/* Injected */
const toastManager = ToastManager.inject();
const accountByIdCache = AccountByIdCache.inject();

/* Stores */
const transactionGroup = useTransactionGroupStore();
const network = useNetworkStore();

const progressText = computed(() =>
  transactionGroup.groupItems.length === 1
    ? 'Imported 1 transaction'
    : `Imported ${transactionGroup.groupItems.length} transactions`,
);

/* Handlers */
async function handleImportCsv(): Promise<ActionReport | null> {
  if (!props.selectedFile) return null;
  try {
    const result = await readFileAsText(props.selectedFile);
    const rows = result.split(/\r?\n|\r|\n/g);
    let senderAccount = '';
    let feePayer = '';
    let sendingTime = '';
    let transactionFee = '';
    let txValidDuration = '';
    let memo = '';
    let validStart: Date | null = null;
    const maxTransactionFee = ref<Hbar>(new Hbar(2));

    for (const row of rows) {
      const rowInfo =
        row
          .match(/(?:"(?:\\"|[^"])*"|[^,]+)(?=,|$)/g)
          ?.map(s => s.trim().replace(/^"|"$/g, '').replace(/\\"/g, '"')) || [];
      const title = rowInfo[0]?.toLowerCase();

      switch (title) {
        case 'transaction description':
          description.value = rowInfo[1];
          break;
        case 'sender account':
          senderAccount = rowInfo[1];
          try {
            await accountByIdCache.lookup(senderAccount, network.mirrorNodeBaseURL);
          } catch (error) {
            toastManager.error(
              `Sender account ${senderAccount} does not exist on network. Review the CSV file.`,
            );
            logger.error('Sender account lookup failed', { senderAccount, error });
            return null;
          }
          break;
        case 'fee payer account':
          feePayer = rowInfo[1];
          try {
            await accountByIdCache.lookup(feePayer, network.mirrorNodeBaseURL);
          } catch (error) {
            toastManager.error(
              `Fee payer account ${feePayer} does not exist on network. Review the CSV file.`,
            );
            logger.error('Fee payer account lookup failed', { feePayer, error });
            return null;
          }
          break;
        case 'sending time':
          sendingTime = rowInfo[1];
          break;
        case 'node ids':
          break;
        case 'transaction fee':
          transactionFee = rowInfo[1];
          break;
        case 'transaction valid duration':
          txValidDuration = rowInfo[1];
          break;
        case 'memo':
          memo = rowInfo[1];
          break;
        case 'accountid':
        case 'account id':
          break;
        default: {
          if (row === '') {
            continue;
          }
          // Create the new validStart value, or add 1 millisecond to the existing one for subsequent transactions
          if (!validStart) {
            const startDate = rowInfo[2];
            validStart = new Date(`${startDate} ${sendingTime}`);
            if (validStart < new Date()) {
              validStart = new Date();
            }
          } else {
            validStart.setMilliseconds(validStart.getMilliseconds() + 1);
          }
          feePayer = feePayer || senderAccount;
          const receiverAccount = rowInfo[0];
          try {
            await accountByIdCache.lookup(receiverAccount, network.mirrorNodeBaseURL);
          } catch (error) {
            toastManager.error(
              `Receiver account ${receiverAccount} does not exist on network. Review the CSV file.`,
            );
            logger.error('Receiver account lookup failed', { receiverAccount, error });
            transactionGroup.clearGroup();
            return null;
          }

          const transaction = new TransferTransaction()
            .setTransactionValidDuration(txValidDuration ? Number.parseInt(txValidDuration) : 180)
            .setMaxTransactionFee(
              (transactionFee
                ? new Hbar(transactionFee, HbarUnit.Tinybar)
                : maxTransactionFee.value) as Hbar,
            );

          transaction.setTransactionId(createTransactionId(feePayer, validStart));
          const transferAmount = rowInfo[1].replace(/,/g, '');
          transaction.addHbarTransfer(receiverAccount, new Hbar(transferAmount, HbarUnit.Tinybar));
          transaction.addHbarTransfer(senderAccount, new Hbar(-transferAmount, HbarUnit.Tinybar));
          // If memo is not provided for the row, use the memo from the header portion
          // otherwise check if the memo is not 'n/a' and set it
          if (rowInfo.length < 4 || !rowInfo[3]?.trim()) {
            transaction.setTransactionMemo(memo);
          } else if (!/^(n\/a)$/i.test(rowInfo[3])) {
            transaction.setTransactionMemo(rowInfo[3]);
          }

          const transactionBytes = transaction.toBytes();
          const keys = new Array<string>();
          if (payerData.key.value instanceof KeyList) {
            for (const key of payerData.key.value.toArray()) {
              keys.push(key.toString());
            }
          }
          transactionGroup.addGroupItem({
            transactionBytes,
            type: 'Transfer Transaction',
            seq: transactionGroup.groupItems.length.toString(),
            keyList: keys,
            observers: [],
            approvers: [],
            payerAccountId: feePayer ? feePayer : senderAccount,
            validStart: new Date(validStart.getTime()),
            description: '',
          });
        }
      }
    }
    toastManager.success('Import complete');
  } catch (error) {
    toastManager.error('Failed to import CSV file');
    logger.error('Failed to import CSV file', { error });
  } finally {
    activate.value = false;
    await props.callback();
  }

  return null;
}

/* Functions */
async function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}
</script>

<template>
  <ActionController
    v-model:activate="activate"
    :actionCallback="handleImportCsv"
    progress-title="Import CSV File"
    :progress-text="progressText"
  />
</template>
