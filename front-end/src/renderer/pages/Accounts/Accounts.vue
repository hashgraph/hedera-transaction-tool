<script setup lang="ts">
import type { HederaAccount } from '@prisma/client';

import { computed, onMounted, ref } from 'vue';
import { KeyList, PublicKey, Hbar } from '@hashgraph/sdk';
import { Prisma } from '@prisma/client';

import useUserStore from '@renderer/stores/storeUser';
import useNetworkStore from '@renderer/stores/storeNetwork';

import { useToast } from 'vue-toast-notification';
import useAccountId from '@renderer/composables/useAccountId';
import useSetDynamicLayout, { LOGGED_IN_LAYOUT } from '@renderer/composables/useSetDynamicLayout';

import { getAll, remove, changeNickname } from '@renderer/services/accountsService';
import { getKeyListLevels } from '@renderer/services/keyPairService';
import { getDollarAmount } from '@renderer/services/mirrorNodeDataService';

import { getFormattedDateFromTimestamp, isUserLoggedIn, stringifyHbar } from '@renderer/utils';

import { transactionTypeKeys } from '@renderer/components/Transaction/Create/txTypeComponentMapping';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppCustomIcon from '@renderer/components/ui/AppCustomIcon.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';
import KeyStructureModal from '@renderer/components/KeyStructureModal.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';
import AppCheckBox from '@renderer/components/ui/AppCheckBox.vue';

/* Stores */
const user = useUserStore();
const network = useNetworkStore();

/* Composables */
const toast = useToast();
const accountData = useAccountId();
useSetDynamicLayout(LOGGED_IN_LAYOUT);

/* State */
const accounts = ref<HederaAccount[]>([]);
const isKeyStructureModalShown = ref(false);
const isUnlinkAccountModalShown = ref(false);
const isNicknameInputShown = ref(false);
const selectedAccountIds = ref<string[]>([]);
const nicknameInputRef = ref<InstanceType<typeof AppInput> | null>(null);
const sorting = ref<{
  [key: string]: Prisma.SortOrder;
}>({
  created_at: 'desc',
});
const selectMany = ref(false);

/* Computed */
const hbarDollarAmount = computed(() => {
  if (!accountData.accountInfo.value) {
    return 0;
  }

  return getDollarAmount(network.currentRate, accountData.accountInfo.value.balance.toBigNumber());
});

const allSelected = computed(() => {
  return (
    selectedAccountIds.value.length > 0 && selectedAccountIds.value.length === accounts.value.length
  );
});

/* Handlers */
const handleSelectAccount = (accountId: string) => {
  isNicknameInputShown.value = false;

  if (selectMany.value) {
    selectedAccountIds.value = selectedAccountIds.value.includes(accountId)
      ? selectedAccountIds.value.filter(i => i !== accountId)
      : [...selectedAccountIds.value, accountId];
  } else {
    accountData.accountId.value = accountId;
    selectedAccountIds.value = [accountId];
  }
};

const handleCheckBoxUpdate = (isChecked: boolean, accountId: string) => {
  if (isChecked) {
    selectedAccountIds.value.push(accountId);
  } else {
    selectedAccountIds.value = selectedAccountIds.value.filter(i => i !== accountId);

    if (accountData.accountId.value === accountId) {
      accountData.accountId.value =
        selectedAccountIds.value.length > 0
          ? selectedAccountIds.value[0]
          : accounts.value[0].account_id || '';
    }
  }
};

const handleUnlinkAccount = async () => {
  if (!isUserLoggedIn(user.personal)) {
    throw new Error('User is not logged in');
  }

  await remove(user.personal.id, [...selectedAccountIds.value]);
  await fetchAccounts();

  resetSelectedAccount();

  isUnlinkAccountModalShown.value = false;

  selectedAccountIds.value = [];
  toast.success('Account Unlinked!');
};

const handleStartNicknameEdit = () => {
  isNicknameInputShown.value = true;

  setTimeout(() => {
    if (nicknameInputRef.value?.inputRef) {
      const currentNickname =
        accounts.value.find(acc => acc.account_id === accountData.accountIdFormatted.value)
          ?.nickname || '';
      nicknameInputRef.value.inputRef.value = currentNickname;
    }

    nicknameInputRef.value?.inputRef?.focus();
  }, 100);
};

const handleChangeNickname = async () => {
  if (!isUserLoggedIn(user.personal)) {
    throw new Error('User is not logged in');
  }

  isNicknameInputShown.value = false;

  await changeNickname(
    user.personal.id,
    accountData.accountIdFormatted.value,
    nicknameInputRef.value?.inputRef?.value,
  );
  await fetchAccounts();
};

const handleSortAccounts = async (
  property: keyof Prisma.HederaAccountOrderByWithRelationInput,
  order: Prisma.SortOrder,
) => {
  if (!isUserLoggedIn(user.personal)) throw new Error('User is not logged in');

  sorting.value = {
    [property]: order,
  };

  await fetchAccounts();
};

const handleSelectAllAccounts = () => {
  if (!allSelected.value) {
    selectedAccountIds.value = accounts.value.map(account => account.account_id);
  } else {
    selectedAccountIds.value = [];
  }
};

const handleToggleSelectMode = () => {
  selectMany.value = !selectMany.value;
  if (selectMany.value === false) {
    selectedAccountIds.value = accounts.value.length > 0 ? [accounts.value[0].account_id] : [];
  } else {
    selectedAccountIds.value = [];
  }
};

/* Functions */
async function fetchAccounts() {
  if (!isUserLoggedIn(user.personal)) throw new Error('User is not logged in');

  accounts.value = await getAll({
    where: {
      user_id: user.personal.id,
      network: network.network,
    },
    orderBy: { ...sorting.value },
  });
}

function resetSelectedAccount() {
  accountData.accountId.value = accounts.value[0]?.account_id || '';
  selectedAccountIds.value = [accountData.accountId.value];
}

/* Hooks */
onMounted(async () => {
  await fetchAccounts();

  resetSelectedAccount();
});
</script>
<template>
  <div class="px-4 px-xxl-6 py-5">
    <div class="container-fluid flex-column-100">
      <div class="d-flex justify-content-between align-items-center">
        <h1 class="text-title text-bold">Accounts</h1>
      </div>

      <div class="row g-0 fill-remaining mt-6">
        <div class="col-4 col-xxl-3 flex-column-100 overflow-hidden with-border-end pe-4 ps-0">
          <div class="dropdown">
            <AppButton
              color="primary"
              size="large"
              data-testid="button-add-new-account"
              class="w-100 d-flex align-items-center justify-content-center"
              data-bs-toggle="dropdown"
              >Add new</AppButton
            >
            <ul class="dropdown-menu">
              <li
                class="dropdown-item cursor-pointer"
                @click="
                  $router.push({
                    name: 'createTransaction',
                    params: {
                      type: transactionTypeKeys.createAccount,
                    },
                  })
                "
              >
                <span class="text-small text-bold" data-testid="link-create-new-account"
                  >Create New</span
                >
              </li>
              <li
                class="dropdown-item cursor-pointer mt-3"
                @click="$router.push('accounts/link-existing')"
              >
                <span class="text-small text-bold" data-testid="link-add-existing-account"
                  >Add Existing</span
                >
              </li>
            </ul>
          </div>
          <div class="d-flex align-items-center justify-content-between my-3">
            <div class="dropdown">
              <AppButton
                class="d-flex align-items-center text-dark-emphasis min-w-unset border-0 p-0"
                data-bs-toggle="dropdown"
                ><i class="bi bi-arrow-down-up me-2"></i> Sort by</AppButton
              >
              <ul class="dropdown-menu text-small">
                <li
                  class="dropdown-item"
                  :selected="sorting.account_id === 'asc' ? true : undefined"
                  @click="handleSortAccounts('account_id', 'asc')"
                >
                  Account ID Asc
                </li>
                <li
                  class="dropdown-item"
                  :selected="sorting.account_id === 'desc' ? true : undefined"
                  @click="handleSortAccounts('account_id', 'desc')"
                >
                  Account ID Dsc
                </li>
                <li
                  class="dropdown-item"
                  :selected="sorting.nickname === 'asc' ? true : undefined"
                  @click="handleSortAccounts('nickname', 'asc')"
                >
                  Nickname A-Z
                </li>
                <li
                  class="dropdown-item"
                  :selected="sorting.nickname === 'desc' ? true : undefined"
                  @click="handleSortAccounts('nickname', 'desc')"
                >
                  Nickname Z-A
                </li>
                <li
                  class="dropdown-item"
                  :selected="sorting.created_at === 'asc' ? true : undefined"
                  @click="handleSortAccounts('created_at', 'asc')"
                >
                  Date Added Asc
                </li>
                <li
                  class="dropdown-item"
                  :selected="sorting.created_at === 'desc' ? true : undefined"
                  @click="handleSortAccounts('created_at', 'desc')"
                >
                  Date Added Dsc
                </li>
              </ul>
            </div>

            <div class="transition-bg rounded px-3" :class="{ 'bg-secondary': selectMany }">
              <AppButton
                class="d-flex align-items-center text-dark-emphasis min-w-unset border-0 p-1"
                data-testid="button-select-many-accounts"
                @click="handleToggleSelectMode"
              >
                <i class="bi bi-check-all text-headline me-2"></i> Select</AppButton
              >
            </div>
          </div>

          <hr class="separator mb-5" />
          <div class="fill-remaining pe-3">
            <div v-if="selectMany" class="d-flex flex-row align-items-center flex-nowrap mb-4">
              <div class="cursor-pointer d-flex" @click="handleSelectAllAccounts">
                <AppCheckBox
                  name="select-card"
                  class="cursor-pointer"
                  type="checkbox"
                  :checked="allSelected"
                />
                <span class="ms-4">Select all</span>
              </div>
              <AppButton
                size="small"
                class="min-w-unset ms-auto"
                color="danger"
                :disabled="selectedAccountIds.length < 1"
                data-testid="button-remove-account-card"
                @click="isUnlinkAccountModalShown = true"
                ><span class="bi bi-trash"></span
              ></AppButton>
            </div>
            <template v-for="(account, index) in accounts" :key="account.account_id">
              <div class="d-flex align-items-center mt-3">
                <div
                  v-if="selectMany"
                  :selected="selectedAccountIds.includes(account.account_id) ? true : undefined"
                >
                  <AppCheckBox
                    :checked="selectedAccountIds.includes(account.account_id)"
                    @update:checked="handleCheckBoxUpdate($event, account.account_id)"
                    name="select-card"
                    :data-testid="'checkbox-multiple-account-id-' + index"
                    class="cursor-pointer"
                  />
                </div>
                <div
                  class="container-multiple-select activate-on-sibling-hover overflow-hidden w-100 p-4"
                  :class="{
                    'is-selected': selectedAccountIds.includes(account.account_id),
                  }"
                  @click="handleSelectAccount(account.account_id)"
                >
                  <p class="text-small text-semi-bold overflow-hidden">{{ account.nickname }}</p>
                  <div class="d-flex justify-content-between align-items-center">
                    <p
                      class="text-micro text-secondary mt-2"
                      :data-testid="'p-account-id-' + index"
                    >
                      {{ account.account_id }}
                    </p>
                  </div>
                </div>
              </div>
            </template>
          </div>
        </div>
        <div class="col-8 col-xxl-9 flex-column-100 ps-4">
          <Transition name="fade" mode="out-in">
            <div
              v-if="accountData.isValid.value"
              class="container-fluid flex-column-100 position-relative"
            >
              <div class="flex-between-centered flex-wrap gap-3">
                <div class="d-flex align-items-center flex-wrap gap-3">
                  <AppInput
                    v-show="isNicknameInputShown"
                    ref="nicknameInputRef"
                    @blur="handleChangeNickname"
                    :filled="true"
                    placeholder="Enter Nickname"
                  />
                  <p
                    v-if="!isNicknameInputShown"
                    class="text-title text-semi-bold py-3"
                    @dblclick="handleStartNicknameEdit"
                  >
                    <span class="text-truncate">
                      {{
                        accounts.find(
                          acc => acc.account_id === accountData.accountIdFormatted.value,
                        )?.nickname || 'None'
                      }}
                    </span>

                    <span
                      class="bi bi-pencil-square text-main text-primary ms-3 cursor-pointer"
                      @click="handleStartNicknameEdit"
                    ></span>
                  </p>
                </div>
                <div class="d-flex gap-3">
                  <AppButton
                    v-if="!selectMany"
                    class="min-w-unset"
                    color="danger"
                    :disabled="selectedAccountIds.length < 1"
                    data-testid="button-remove-account-card"
                    @click="isUnlinkAccountModalShown = true"
                    ><span class="bi bi-trash"></span> Remove</AppButton
                  >
                  <div
                    v-if="!accountData.accountInfo.value?.deleted && !selectMany"
                    class="border-start ps-3"
                  >
                    <div class="dropdown">
                      <AppButton
                        class="min-w-unset"
                        color="borderless"
                        data-testid="button-edit-account"
                        data-bs-toggle="dropdown"
                        ><span class="bi bi-arrow-repeat"></span> Edit</AppButton
                      >
                      <ul class="dropdown-menu mt-3">
                        <li
                          class="dropdown-item cursor-pointer"
                          @click="
                            $router.push({
                              name: 'createTransaction',
                              params: { type: transactionTypeKeys.deleteAccount },
                              query: { accountId: accountData.accountIdFormatted.value },
                            })
                          "
                        >
                          <span
                            class="text-small text-bold"
                            data-testid="button-delete-from-network"
                            >Delete from Network</span
                          >
                        </li>
                        <li
                          class="dropdown-item cursor-pointer mt-3"
                          @click="
                            $router.push({
                              name: 'createTransaction',
                              params: { type: transactionTypeKeys.updateAccount },
                              query: { accountId: accountData.accountIdFormatted.value },
                            })
                          "
                        >
                          <span class="text-small text-bold" data-testid="button-update-in-network"
                            >Update in Network</span
                          >
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
              <hr class="separator my-4" />
              <div class="fill-remaining overflow-x-hidden pe-3">
                <div class="row">
                  <div class="col-5">
                    <p class="text-small text-semi-bold">Account ID</p>
                  </div>
                  <div class="col-7">
                    <p class="text-small text-semi-bold" data-testid="p-account-data-account-id">
                      <template
                        v-if="
                          accountData.accoundIdWithChecksum.value &&
                          Array.isArray(accountData.accoundIdWithChecksum.value)
                        "
                      >
                        <span>{{ accountData.accoundIdWithChecksum.value[0] }}</span>
                        <span class="text-secondary"
                          >-{{ accountData.accoundIdWithChecksum.value[1] }}</span
                        >
                      </template>
                      <template v-else
                        ><span>{{ accountData.accoundIdWithChecksum.value }}</span></template
                      >

                      <i
                        class="bi bi-box-arrow-up-right link-primary cursor-pointer ms-2"
                        @click="accountData.openAccountInHashscan"
                      ></i>
                    </p>
                  </div>
                </div>
                <div class="row mt-4">
                  <div class="col-5">
                    <p class="text-small text-semi-bold">EVM Address</p>
                  </div>
                  <div class="col-7">
                    <p
                      class="text-small text-secondary overflow-hidden"
                      data-testid="p-account-data-evm-address"
                    >
                      0x{{ accountData.accountInfo.value?.evmAddress || 'None' }}
                    </p>
                  </div>
                </div>
                <div class="mt-4 row">
                  <div class="col-5"><p class="text-small text-semi-bold">Balance</p></div>
                  <div class="col-7">
                    <p class="text-small text-semi-bold" data-testid="p-account-data-balance">
                      {{
                        stringifyHbar(
                          (accountData.accountInfo.value?.balance as Hbar) || new Hbar(0),
                        )
                      }}
                      <span class="text-pink">({{ hbarDollarAmount }})</span>
                    </p>
                  </div>
                </div>
                <div class="mt-4 row">
                  <div class="col-5">
                    <p class="text-small text-semi-bold">Key</p>
                  </div>
                  <div class="col-7">
                    <template v-if="accountData.key.value instanceof KeyList && true">
                      Complex Key ({{ getKeyListLevels(accountData.key.value) }} levels)
                      <span
                        class="link-primary cursor-pointer"
                        @click="isKeyStructureModalShown = true"
                        >See details</span
                      >
                    </template>
                    <template v-else-if="accountData.key.value instanceof PublicKey && true">
                      <p
                        class="text-secondary text-small overflow-hidden"
                        data-testid="p-account-data-key"
                      >
                        {{ accountData.key.value.toStringRaw() }}
                      </p>
                      <p
                        class="text-small text-semi-bold text-pink mt-3"
                        data-testid="p-account-data-key-type"
                      >
                        {{ accountData.key.value._key._type }}
                      </p>
                    </template>
                    <template v-else>None</template>
                  </div>
                </div>
                <div class="mt-4 row">
                  <div class="col-5">
                    <p class="text-small text-semi-bold">Receiver Sig. Required</p>
                  </div>
                  <div class="col-7">
                    <p
                      class="text-small text-semi-bold"
                      data-testid="p-account-data-receiver-sig-required"
                    >
                      {{ accountData.accountInfo.value?.receiverSignatureRequired ? 'Yes' : 'No' }}
                    </p>
                  </div>
                </div>
                <div class="mt-4 row">
                  <div class="col-5"><p class="text-small text-semi-bold">Memo</p></div>
                  <div class="col-7">
                    <p class="text-small text-semi-bold" data-testid="p-account-data-memo">
                      {{ accountData.accountInfo.value?.memo || 'None' }}
                    </p>
                  </div>
                </div>
                <div class="mt-4 row">
                  <div class="col-5">
                    <p class="text-small text-semi-bold">Max. Auto. Association</p>
                  </div>
                  <div class="col-7">
                    <p
                      class="text-small text-semi-bold"
                      data-testid="p-account-data-max-auto-association"
                    >
                      {{ accountData.accountInfo.value?.maxAutomaticTokenAssociations }}
                    </p>
                  </div>
                </div>
                <div class="mt-4 row">
                  <div class="col-5"><p class="text-small text-semi-bold">Ethereum Nonce</p></div>
                  <div class="col-7">
                    <p class="text-small text-semi-bold" data-testid="p-account-data-eth-nonce">
                      {{ accountData.accountInfo.value?.ethereumNonce }}
                    </p>
                  </div>
                </div>
                <hr class="separator my-4" />
                <div class="row">
                  <div class="col-5"><p class="text-small text-semi-bold">Created At</p></div>
                  <div class="col-7">
                    <p class="text-small text-semi-bold" data-testid="p-account-data-created-at">
                      {{
                        accountData.accountInfo.value?.createdTimestamp
                          ? getFormattedDateFromTimestamp(
                              accountData.accountInfo.value?.createdTimestamp,
                            )
                          : 'None'
                      }}
                    </p>
                  </div>
                </div>
                <div class="mt-4 row">
                  <div class="col-5"><p class="text-small text-semi-bold">Expires At</p></div>
                  <div class="col-7">
                    <p class="text-small text-semi-bold" data-testid="p-account-data-expires-at">
                      {{
                        accountData.accountInfo.value?.expiryTimestamp
                          ? getFormattedDateFromTimestamp(
                              accountData.accountInfo.value?.expiryTimestamp,
                            )
                          : 'None'
                      }}
                    </p>
                  </div>
                </div>
                <div class="mt-4 row" v-if="accountData.accountInfo.value?.autoRenewPeriod">
                  <div class="col-5">
                    <p class="text-small text-semi-bold">Auto Renew Period</p>
                  </div>
                  <div class="col-7">
                    <p
                      class="text-small text-semi-bold"
                      data-testid="p-account-data-auto-renew-period"
                    >
                      <span>{{ accountData.accountInfo.value?.autoRenewPeriod }}s</span>
                      <span class="ms-4">{{ accountData.autoRenewPeriodInDays.value }} days</span>
                    </p>
                  </div>
                </div>
                <hr class="separator my-4" />
                <div class="row">
                  <div class="col-5"><p class="text-small text-semi-bold">Staked to</p></div>
                  <div class="col-7">
                    <p class="text-small text-semi-bold" data-testid="p-account-data-staked-to">
                      {{ accountData.getStakedToString() }}
                    </p>
                  </div>
                </div>
                <div class="mt-4 row">
                  <div class="col-5"><p class="text-small text-semi-bold">Pending Reward</p></div>
                  <div class="col-7">
                    <p
                      class="text-small text-semi-bold"
                      data-testid="p-account-data-pending-reward"
                    >
                      {{ accountData.getFormattedPendingRewards() }}
                    </p>
                  </div>
                </div>
                <div class="mt-4 row">
                  <div class="col-5"><p class="text-small text-semi-bold">Rewards</p></div>
                  <div class="col-7">
                    <p class="text-small text-semi-bold" data-testid="p-account-data-rewards">
                      {{ accountData.accountInfo.value?.declineReward ? 'Declined' : 'Accepted' }}
                    </p>
                  </div>
                </div>
                <template v-if="accountData.accountInfo.value?.deleted">
                  <hr class="separator my-4" />
                  <p class="text-danger">Account is deleted</p>
                </template>
              </div>
            </div>
          </Transition>

          <KeyStructureModal
            v-if="accountData.isValid.value"
            v-model:show="isKeyStructureModalShown"
            :account-key="accountData.key.value"
          />

          <AppModal v-model:show="isUnlinkAccountModalShown" class="common-modal">
            <div class="p-4">
              <i
                class="bi bi-x-lg d-inline-block cursor-pointer"
                style="line-height: 16px"
                @click="isUnlinkAccountModalShown = false"
              ></i>
              <div class="text-center">
                <AppCustomIcon :name="'bin'" style="height: 160px" />
              </div>
              <h3 class="text-center text-title text-bold mt-3">
                Unlink account{{ selectedAccountIds.length > 1 ? 's' : '' }}
              </h3>
              <p class="text-center text-small text-secondary mt-4">
                Are you sure you want to remove
                {{ selectedAccountIds.length > 1 ? 'these' : 'this' }} Account{{
                  selectedAccountIds.length > 1 ? 's' : ''
                }}
                from your Account list?
              </p>
              <hr class="separator my-5" />
              <div class="flex-between-centered gap-4">
                <AppButton color="borderless" @click="isUnlinkAccountModalShown = false"
                  >Cancel</AppButton
                >
                <AppButton
                  color="danger"
                  @click="handleUnlinkAccount"
                  data-testid="button-confirm-unlink-account"
                  >Unlink</AppButton
                >
              </div>
            </div>
          </AppModal>
        </div>
      </div>
    </div>
  </div>
</template>
