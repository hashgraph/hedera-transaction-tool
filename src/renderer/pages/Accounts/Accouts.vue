<script setup lang="ts">
import { onMounted, ref } from 'vue';

import useUserStateStore from '../../stores/storeUserState';

import { getAll } from '../../services/accountsService';

import AppButton from '../../components/ui/AppButton.vue';

const userStore = useUserStateStore();

const accounts = ref<
  {
    accountId: string;
    nickname: string;
  }[]
>([]);
const selectedAccount = ref<string>('');

onMounted(async () => {
  if (userStore.userData?.userId) {
    accounts.value = await getAll(userStore.userData?.userId);
    selectedAccount.value = accounts.value[0]?.accountId || '';
  }
});
</script>
<template>
  <div class="p-10">
    <div class="h-100 d-flex row">
      <div class="col-4 col-xl-3 border-end pe-4 ps-0">
        <div class="dropdown">
          <AppButton
            color="secondary"
            size="large"
            class="w-100 d-flex align-items-center justify-content-center"
            data-bs-toggle="dropdown"
            ><i class="bi bi-plus-lg text-subheader"></i> Add Account</AppButton
          >
          <ul class="dropdown-menu text-small">
            <li class="dropdown-item">
              <RouterLink to="create-transaction/createAccount" class="dropdown-item"
                ><i class="bi bi-plus-lg"></i>
                Create New
              </RouterLink>
            </li>
            <li class="dropdown-item">
              <RouterLink to="accounts/link-existing" class="dropdown-item"
                ><i class="bi bi-plus-lg"></i>
                Link Existing Account
              </RouterLink>
            </li>
          </ul>
        </div>
        <div class="mt-5">
          <div class="dropdown">
            <AppButton
              class="w-100 d-flex text-dark-emphasis align-items-center justify-content-start border-0"
              data-bs-toggle="dropdown"
              ><i class="bi bi-filter text-headline me-2"></i> Sort by</AppButton
            >
            <ul class="dropdown-menu text-small">
              <li class="dropdown-item">Account ID A-Z</li>
              <li class="dropdown-item">Account ID Z-A</li>
              <li class="dropdown-item">Nickname A-Z</li>
              <li class="dropdown-item">Nickname Z-A</li>
            </ul>
          </div>
        </div>
        <hr class="my-5" />
        <div>
          <template v-for="account in accounts" :key="account.accountId">
            <div
              class="mt-3 px-5 py-4 rounded-4 d-flex align-items-center justify-content-start cursor-pointer"
              :class="{
                'bg-primary text-white': account.accountId === selectedAccount,
                'bg-dark-blue-700': account.accountId !== selectedAccount,
              }"
              @click="selectedAccount = account.accountId"
            >
              <i class="bi bi-person text-headline me-2 lh-1"></i>
              <span>{{ account.nickname || account.accountId }}</span>
            </div>
          </template>
        </div>
      </div>
      <div class="col-8 col-xl-9"></div>
    </div>
  </div>
</template>
