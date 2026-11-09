<script setup lang="ts">
import type { HederaAccount } from '@prisma/client';

import { computed, onBeforeMount, ref, watch } from 'vue';
import axios from 'axios';

import useUserStore from '@renderer/stores/storeUser';
import useNetworkStore from '@renderer/stores/storeNetwork';

import { ToastManager } from '@renderer/utils/ToastManager';
import { getAll as getAllAccounts } from '@renderer/services/accountsService';
import { getAccountInfo, getContractInfo } from '@renderer/services/mirrorNodeDataService';

import { createRole, type ContractRole } from '@renderer/utils/sdk/contractRoles';
import { sanitizeFunctionArgInput } from '@renderer/utils/sdk/contractFunctionParams';
import {
  decorateAccountId,
  getAccountIdWithChecksum,
  isUserLoggedIn,
  matchAccountId,
  sanitizeAccountId,
} from '@renderer/utils';
import { compareAccountIds } from '@renderer/utils/sortAccounts';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';
import AppAutoComplete from '@renderer/components/ui/AppAutoComplete.vue';

/* Props */
const props = defineProps<{
  show: boolean;
  role: ContractRole | null;
}>();

/* Emits */
const emit = defineEmits<{
  (event: 'update:show', show: boolean): void;
  (event: 'save', role: ContractRole): void;
}>();

/* Stores */
const user = useUserStore();
const network = useNetworkStore();

/* Composables */
const toastManager = ToastManager.inject();

/* State */
const name = ref('');
const holder = ref('');
const note = ref('');
const isSaving = ref(false);
const linkedAccounts = ref<HederaAccount[]>([]);

/* Computed */
const accountItems = computed(() => {
  const ids = new Set<string>([
    ...linkedAccounts.value.map(a => a.account_id),
    ...user.publicKeysToAccountsFlattened,
  ]);
  return [...ids].sort(compareAccountIds);
});

const holderItems = computed(() => accountItems.value.map(id => getAccountIdWithChecksum(id)));

/* Functions */
// Account-id-shaped input (digits/dots, optional checksum) gets the usual account id
// sanitizing; anything else is treated as an EVM address so it can still be typed and
// rejected with a clear message on save.
const sanitizeHolder = (value: string) =>
  /^[0-9.]*(-[a-zA-Z]*)?$/.test(value) || value.includes('.')
    ? sanitizeAccountId(value)
    : sanitizeFunctionArgInput('address', value);

// Checksum ghost text only applies to account IDs
const decorateHolder = (value: string) => (isEntityId(value) ? decorateAccountId(value) : '');

const handleHolderUpdate = (value: string) => {
  holder.value = value.split('-')[0];
};

const isEntityId = (v: string) => /^\d+\.\d+\.\d+$/.test(v);

const ONLY_ACCOUNTS_MESSAGE = 'Only account IDs are currently supported as role holders';

const ignoreNotFound = async <T,>(fn: () => Promise<T | null>): Promise<T | null> => {
  try {
    return await fn();
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) return null;
    throw error;
  }
};

/* Resolves the entered value to an account via the mirror node. Throws a user-facing Error for
 * anything that is not an account (e.g. a contract) - contracts are checked first since the
 * accounts endpoint also serves them. Holder types other than account can be added here later. */
async function resolveAccountHolder(value: string): Promise<string> {
  const contract = await getContractInfo(value, network.mirrorNodeBaseURL);
  if (contract) {
    throw new HolderError(ONLY_ACCOUNTS_MESSAGE);
  }

  const account = await ignoreNotFound(() => getAccountInfo(value, network.mirrorNodeBaseURL));
  if (!account) {
    throw new HolderError('Account was not found on this network');
  }

  return account.accountId.toString();
}

class HolderError extends Error {}

/* Watchers */
watch(
  () => [props.show, props.role] as const,
  ([show, role]) => {
    if (!show) {
      return;
    }
    name.value = role?.name || '';
    holder.value =
      role?.holderType === 'account'
        ? role.holderAccountId || ''
        : role?.holderType === 'contract'
          ? role.holderContractRef || ''
          : '';
    note.value = role?.note || '';
  },
  { immediate: true },
);

/* Handlers */
const handleShowUpdate = (show: boolean) => emit('update:show', show);

const handleSave = async () => {
  if (name.value.trim().length === 0 || isSaving.value) {
    return;
  }

  const value = holder.value.trim();
  let holderAccountId: string | undefined;

  if (value.length > 0) {
    if (!isEntityId(value) && !/^(0x)?[0-9a-f]{40}$/.test(value)) {
      toastManager.error(ONLY_ACCOUNTS_MESSAGE);
      return;
    }
    // An EVM address could still be an account alias, so it goes through the lookup too

    isSaving.value = true;
    try {
      holderAccountId = await resolveAccountHolder(value);
    } catch (error) {
      toastManager.error(
        error instanceof HolderError
          ? error.message
          : 'Could not look up the holder on the mirror node',
      );
      return;
    } finally {
      isSaving.value = false;
    }
  }

  const base = {
    name: name.value.trim(),
    holderType: holderAccountId ? ('account' as const) : ('unassigned' as const),
    holderAccountId,
    holderContractRef: undefined,
    note: note.value.trim().length > 0 ? note.value.trim() : undefined,
  };

  emit('save', props.role ? { ...props.role, ...base } : createRole(base));
  handleShowUpdate(false);
};

/* Hooks */
onBeforeMount(async () => {
  if (!isUserLoggedIn(user.personal)) return;

  linkedAccounts.value = await getAllAccounts({
    where: { user_id: user.personal.id, network: network.network },
  });
});
</script>
<template>
  <AppModal :show="show" @update:show="handleShowUpdate" class="medium-modal">
    <div class="p-4">
      <form @submit.prevent="handleSave">
        <div>
          <i class="bi bi-x-lg cursor-pointer" @click="handleShowUpdate(false)"></i>
        </div>
        <h1 class="text-title text-semi-bold text-center">
          {{ role ? 'Edit role' : 'Add role' }}
        </h1>
        <div class="mt-5">
          <label class="form-label">Role name</label>
          <AppInput v-model="name" filled data-testid="input-role-name" placeholder="SECURITY_ROLE" />
        </div>
        <div class="mt-4">
          <label class="form-label">Holder (optional)</label>
          <AppAutoComplete
            :model-value="holder"
            @update:model-value="handleHolderUpdate"
            :items="holderItems"
            :sanitize="sanitizeHolder"
            :find-match="matchAccountId"
            :decorate="decorateHolder"
            disable-spaces
            tabular-nums
            data-testid="input-role-holder"
          />
          <p class="text-micro text-secondary mt-2">
            Account ID only for now. Leave empty if unassigned.
          </p>
        </div>
        <div class="mt-4">
          <label class="form-label">Note</label>
          <AppInput
            v-model="note"
            filled
            data-testid="input-role-note"
            placeholder="Why this role matters"
          />
        </div>
        <hr class="separator my-5" />
        <div class="flex-between-centered gap-4">
          <AppButton color="borderless" type="button" @click="handleShowUpdate(false)"
            >Cancel</AppButton
          >
          <AppButton
            color="primary"
            data-testid="button-save-role"
            type="submit"
            :disabled="name.trim().length === 0 || isSaving"
            :loading="isSaving"
            >Save</AppButton
          >
        </div>
      </form>
    </div>
  </AppModal>
</template>
