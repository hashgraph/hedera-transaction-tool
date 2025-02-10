<script setup lang="ts">
import type { HederaAccount } from '@prisma/client';
import type { AccountInfo } from '@main/shared/interfaces';

import { computed, ref } from 'vue';
import { handleFormatAccount } from '@renderer/utils';

/* Props */
const props = defineProps<{
  publicKey: string;
  accounts?: AccountInfo[];
  allLinkedAccounts?: HederaAccount[];
}>();

/* State */
const isCollapsed = ref(false);

/* Computed */
const linkedAccounts = computed(
  () =>
    props.allLinkedAccounts?.filter(linkedAccount =>
      props.accounts?.some(account => linkedAccount.account_id === account.account),
    ) || [],
);
</script>
<template>
  <Transition name="fade" mode="out-in">
    <div v-if="linkedAccounts.length > 0" class="row">
      <div class="col-5 d-flex gap-2 flex-grow-1">
        <span
          v-if="isCollapsed"
          class="bi bi-chevron-up cursor-pointer"
          @click="isCollapsed = !isCollapsed"
        ></span>
        <span
          v-else
          class="bi bi-chevron-down cursor-pointer"
          @click="isCollapsed = !isCollapsed"
        ></span>
        <p class="text-small text-semi-bold">
          Linked Accounts
          <span class="text-secondary">({{ linkedAccounts.length }})</span>
        </p>
      </div>
      <Transition name="fade" mode="out-in">
        <div v-show="isCollapsed" class="col-7">
          <ul class="d-flex flex-wrap gap-3">
            <template v-for="account in linkedAccounts" :key="`${publicKey}${account.account}`">
              <li class="flex-centered text-center badge-bg rounded py-2 px-3">
                <p class="text-small text-secondary">
                  {{ handleFormatAccount(linkedAccounts, account) }}
                </p>
              </li>
            </template>
          </ul>
        </div>
      </Transition>
    </div>
  </Transition>
</template>
