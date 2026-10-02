<script setup lang="ts">
import type { HederaAccount } from '@prisma/client';

import { computed, onBeforeMount, ref } from 'vue';

import useUserStore from '@renderer/stores/storeUser';
import useNetworkStore from '@renderer/stores/storeNetwork';

import { getAll } from '@renderer/services/accountsService';

import {
  decorateAccountId,
  formatAccountId,
  getAccountIdWithChecksum,
  isUserLoggedIn,
  matchAccountId,
  sanitizeAccountId,
} from '@renderer/utils';

import AppAutoComplete from '@renderer/components/ui/AppAutoComplete.vue';
import { compareAccountIds } from '@renderer/utils/sortAccounts';

/* Props */
const props = defineProps<{
  modelValue: string;
  items?: string[];
  dataTestid?: string;
}>();

/* Emits */
const emit = defineEmits<{
  (event: 'update:modelValue', value: string): void;
}>();

/* Stores */
const user = useUserStore();
const network = useNetworkStore();

/* State */
const accountIds = ref<HederaAccount[]>([]);

/* Computed */
// Linked and owned accounts, and (only when both groups are non-empty) which raw id is
// the last linked one — the real item a divider should render after. Computed together
// so the two groups are only sorted once.
const accountGroups = computed(() => {
  if (props.items) return { ids: props.items, lastLinkedAccountId: null as string | null };

  const linkedAccounts = accountIds.value.map(a => a.account_id);
  const ownedAccounts = user.publicKeysToAccountsFlattened;
  linkedAccounts.sort(compareAccountIds);
  ownedAccounts.sort(compareAccountIds);

  const lastLinkedAccountId =
    linkedAccounts.length > 0 && ownedAccounts.length > 0
      ? linkedAccounts[linkedAccounts.length - 1]
      : null;

  return { ids: linkedAccounts.concat(ownedAccounts), lastLinkedAccountId };
});

const formattedAccountIds = computed(() =>
  accountGroups.value.ids.map(id => getAccountIdWithChecksum(id)),
);

// The divider's position has to be found post-checksum, since that's what AppAutoComplete's
// items (and thus groupBreakAfter's argument) actually contain.
const linkedOwnedBoundary = computed(() => {
  const { lastLinkedAccountId } = accountGroups.value;
  return lastLinkedAccountId ? getAccountIdWithChecksum(lastLinkedAccountId) : null;
});

function isLinkedOwnedBoundary(item: string): boolean {
  return item === linkedOwnedBoundary.value;
}

/* Handlers */
const handleUpdate = (value: string) => {
  const idWithoutChecksum = value.split('-')[0];
  emit('update:modelValue', idWithoutChecksum);
};

function handleOnBlur() {
  const idWithoutChecksum = props.modelValue.split('-')[0];
  emit('update:modelValue', formatAccountId(idWithoutChecksum));
}

/* Hooks */
onBeforeMount(async () => {
  if (isUserLoggedIn(user.personal)) {
    accountIds.value = await getAll({
      where: {
        user_id: user.personal.id,
        network: network.network,
      },
    });
  }
});
</script>
<template>
  <AppAutoComplete
    :model-value="modelValue"
    @update:model-value="handleUpdate"
    @blur="handleOnBlur"
    :items="formattedAccountIds"
    :sanitize="sanitizeAccountId"
    :find-match="matchAccountId"
    :decorate="decorateAccountId"
    :group-break-after="isLinkedOwnedBoundary"
    :data-testid="dataTestid"
    disable-spaces
    tabular-nums
    v-bind="$attrs"
  />
</template>
