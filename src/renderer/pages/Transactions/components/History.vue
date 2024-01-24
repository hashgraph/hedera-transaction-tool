<script setup lang="ts">
import { onBeforeMount, reactive, ref } from 'vue';
import { Status } from '@hashgraph/sdk';

// import { IStoredTransaction } from '../../../../main/shared/interfaces';

import useUserStore from '../../../stores/storeUser';

import { getTransactions } from '../../../services/transactionService';

import {
  getTransactionDate,
  getTransactionStatus,
  getTransactionId,
} from '../../../utils/transactions';

import AppButton from '../../../components/ui/AppButton.vue';

/* Stores */
const user = useUserStore();

/* State */
const transactions = ref<any[]>([]);
const sort = reactive<{ field: string; direction: 'asc' | 'desc' }>({
  field: 'timestamp',
  direction: 'desc',
});

/* Handlers */
const handleSort = (field: string, direction: 'asc' | 'desc') => {
  sort.field = field;
  sort.direction = direction;

  switch (field) {
    case 'type':
      transactions.value = transactions.value.sort((t1, t2) => {
        if (direction === 'asc') {
          return t1.type.localeCompare(t2.type);
        } else if (direction === 'desc') {
          return t2.type.localeCompare(t1.type);
        } else return 0;
      });
      break;
    case 'status':
      transactions.value = transactions.value.sort((t1, t2) => {
        const status1 = Status._fromCode(t1.status).toString();
        const status2 = Status._fromCode(t2.status).toString();

        if (direction === 'asc') {
          return status1.localeCompare(status2);
        } else if (direction === 'desc') {
          return status2.localeCompare(status1);
        } else return 0;
      });
      break;
    case 'timestamp':
      transactions.value = transactions.value.sort((t1, t2) => {
        if (direction === 'asc') {
          return t1.timestamp - t2.timestamp;
        } else if (direction === 'desc') {
          return t2.timestamp - t1.timestamp;
        } else return 0;
      });
      break;
    case 'payerId':
      transactions.value = transactions.value.sort((t1, t2) => {
        const payerId1 = Number(t1.transactionId.split('@')[0].split('.').join(''));
        const payerId2 = Number(t2.transactionId.split('@')[0].split('.').join(''));

        if (direction === 'asc') {
          return payerId1 - payerId2;
        } else if (direction === 'desc') {
          return payerId2 - payerId1;
        } else return 0;
      });
      break;
    default:
      break;
  }
};

/* Functions */
const getOpositeDirection = () => (sort.direction === 'asc' ? 'desc' : 'asc');

/* Hooks */
onBeforeMount(async () => {
  transactions.value = await getTransactions(user.data.email, user.data.activeServerURL);
  handleSort('timestamp', 'desc');
  transactions.value = transactions.value.sort((t1, t2) => t2.timestamp - t1.timestamp);
});
</script>

<template>
  <table class="table-custom">
    <thead>
      <tr>
        <th class="w-10 text-end">#</th>
        <th>
          <div
            class="table-sort-link"
            @click="handleSort('type', sort.field === 'type' ? getOpositeDirection() : 'asc')"
          >
            <span>Transaction Type</span>
            <i
              v-if="sort.field === 'type'"
              class="bi text-title"
              :class="{
                'bi-arrow-down-short': sort.direction === 'desc',
                'bi-arrow-up-short': sort.direction === 'asc',
              }"
            ></i>
          </div>
        </th>
        <th>
          <div
            class="table-sort-link"
            @click="handleSort('status', sort.field === 'status' ? getOpositeDirection() : 'asc')"
          >
            <span>Status</span>
            <i
              v-if="sort.field === 'status'"
              class="bi text-title"
              :class="{
                'bi-arrow-down-short': sort.direction === 'desc',
                'bi-arrow-up-short': sort.direction === 'asc',
              }"
            ></i>
          </div>
        </th>
        <th>
          <div
            class="table-sort-link"
            @click="handleSort('payerId', sort.field === 'payerId' ? getOpositeDirection() : 'asc')"
          >
            <span>Payer ID</span>
            <i
              v-if="sort.field === 'payerId'"
              class="bi text-title"
              :class="{
                'bi-arrow-down-short': sort.direction === 'desc',
                'bi-arrow-up-short': sort.direction === 'asc',
              }"
            ></i>
          </div>
        </th>
        <th>
          <div
            class="table-sort-link"
            @click="
              handleSort('timestamp', sort.field === 'timestamp' ? getOpositeDirection() : 'asc')
            "
          >
            <span>Timestamp</span>
            <i
              v-if="sort.field === 'timestamp'"
              class="bi text-title"
              :class="{
                'bi-arrow-down-short': sort.direction === 'desc',
                'bi-arrow-up-short': sort.direction === 'asc',
              }"
            ></i>
          </div>
        </th>
        <th>Actions</th>
      </tr>
    </thead>
    <tbody>
      <template v-for="(transaction, i) in transactions" :key="i">
        <tr>
          <td>{{ i + 1 }}</td>
          <td>
            <span class="text-bold">{{ transaction.type }}</span>
          </td>
          <td>
            <span
              class="badge bg-success text-break"
              :class="{ 'bg-danger': ![0, 22].includes(transaction.status) }"
              >{{ getTransactionStatus(transaction) }}</span
            >
          </td>
          <td>
            <span class="text-secondary">{{ getTransactionId(transaction) }}</span>
          </td>
          <td>
            <span class="text-secondary">
              {{ getTransactionDate(transaction) }}
            </span>
          </td>
          <td>
            <AppButton color="primary">Details</AppButton>
          </td>
        </tr>
      </template>
    </tbody>
  </table>
</template>
