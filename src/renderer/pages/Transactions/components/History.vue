<script setup lang="ts">
import { onBeforeMount, ref } from 'vue';
import { Status, Timestamp } from '@hashgraph/sdk';

import { IStoredTransaction } from 'src/main/shared/interfaces';

import useUserStore from '../../../stores/storeUser';

import { getTransactions } from '../../../services/transactionService';

import AppButton from '../../../components/ui/AppButton.vue';

/* Stores */
const user = useUserStore();

/* State */
const transactions = ref<IStoredTransaction[]>([]);

/* Hooks */
onBeforeMount(async () => {
  transactions.value = await getTransactions(user.data.email, user.data.activeServerURL);
});
</script>
<template>
  <div class="transactions-history-container">
    <table class="user-select-none w-100">
      <thead>
        <tr
          class="d-flex align-items-center row text-center text-small bg-body-secondary rounded-4 py-4"
        >
          <th class="col-1">#</th>
          <th class="col-4 col-xl-3">Transaction Type</th>
          <th class="col-3 col-xl-2">Status</th>
          <th class="col-2">Payer ID</th>
          <th class="d-none d-xl-block col-xl-2">Timestamp</th>
          <th class="col-2">Actions</th>
        </tr>
      </thead>
      <tbody>
        <template v-for="(transaction, i) in transactions" :key="i">
          <tr
            class="d-flex align-items-center row text-center text-small bg-secondary-subtle rounded-4 py-4 my-3"
          >
            <td class="col-1 overflow-hidden">{{ i + 1 }}</td>
            <td class="col-4 col-xl-3 overflow-hidden">{{ transaction.type }}</td>
            <td class="col-3 col-xl-2 overflow-hidden">
              <span
                class="badge bg-success text-break d-inline-block"
                :class="{ 'bg-danger': ![0, 22].includes(transaction.status) }"
                :style="{ whiteSpace: 'normal', maxHeight: 'none' }"
                >{{ Status._fromCode(transaction.status).toString().split('_').join(' ') }}</span
              >
            </td>
            <td class="col-2 overflow-hidden">{{ transaction.transactionId.split('@')[0] }}</td>
            <td class="d-none d-xl-block col-xl-2 overflow-hidden">
              {{
                new Timestamp(
                  transaction.transactionId.split('@')[1].split('.')[0],
                  transaction.transactionId.split('@')[1].split('.')[1],
                )
                  .toDate()
                  .toDateString()
              }}
            </td>
            <td class="col-2 overflow-hidden"><AppButton color="primary">Details</AppButton></td>
          </tr>
        </template>
      </tbody>
    </table>
  </div>
</template>
