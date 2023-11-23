<script setup lang="ts">
import { reactive } from 'vue';

const transactions = reactive([
  {
    id: 1,
    title: 'Update the keys for account 0.01234 because of new employee',
    account: '0.0.1234(Bobs Account)',
  },
  {
    id: 2,
    title: 'Update the keys for account 0.01234 because of new employee',
    account: '0.0.1224(Bobs Account)',
  },
  {
    id: 3,
    title: 'Update the keys for account 0.01234 because of new employee',
    account: '0.0.12224(Bobs Account)',
  },
]);
</script>
<template>
  <div class="p-10">
    <h1 class="text-huge text-bold">Transactions</h1>

    <div class="mt-7">
      <div
        v-for="(item, index) in transactions"
        :key="index"
        class="rounded bg-dark-blue-800 p-4"
        :class="{ 'mt-4': index !== 0 }"
      >
        <div class="d-flex justify-content-between align-items-start">
          <div>
            <p class="text-main">{{ item.title }}</p>
            <p class="text-micro mt-3">{{ item.account }}</p>
          </div>
          <div>
            <div class="d-flex justify-content-end align-items-center">
              <button class="btn btn-outline-primary me-3">Details</button>
              <button class="btn btn-primary">Sign</button>
            </div>
          </div>
        </div>

        <div class="mt-4">
          <span class="text-micro me-4">Approvers</span>
          <span class="badge text-bg-primary me-2">alice@acme.com</span>
          <span class="badge text-bg-primary">joe@acme.com</span>
        </div>
      </div>
    </div>
  </div>
</template>
