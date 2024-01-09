<script setup lang="ts">
import { onMounted, ref } from 'vue';

import { Hbar, HbarUnit, KeyList, PublicKey } from '@hashgraph/sdk';

import useUserStateStore from '../../stores/storeUserState';
import useNetworkStore from '../../stores/storeNetwork';

import useAccountId from '@renderer/composables/useAccountId';

import { getAll } from '../../services/accountsService';
import { openExternal } from '../../services/electronUtilsService';

import AppButton from '../../components/ui/AppButton.vue';
import AppModal from '../../components/ui/AppModal.vue';
import KeyStructure from '../../components/KeyStructure.vue';

const userStore = useUserStateStore();
const networkStore = useNetworkStore();

const accountData = useAccountId();

const accounts = ref<
  {
    accountId: string;
    nickname: string;
  }[]
>([]);
const isKeyStructureModalShown = ref(false);

onMounted(async () => {
  if (userStore.userData?.userId) {
    accounts.value = await getAll(userStore.userData?.userId);
    accountData.accountId.value = accounts.value[0]?.accountId || '';
  }
});
</script>
<template>
  <div class="p-10">
    <div class="h-100 d-flex row">
      <div class="col-4 col-xxl-3 border-end pe-4 ps-0">
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
                'bg-primary text-white': account.accountId === accountData.accountIdFormatted.value,
                'bg-dark-blue-700': account.accountId !== accountData.accountIdFormatted.value,
              }"
              @click="accountData.accountId.value = account.accountId"
            >
              <i class="bi bi-person text-headline me-2 lh-1"></i>
              <span>{{ account.nickname || account.accountId }}</span>
            </div>
          </template>
        </div>
      </div>
      <div class="col-8 col-xxl-9 ps-4 pt-0">
        <Transition name="fade" mode="out-in">
          <div v-if="accountData.isValid.value" class="d-flex flex-column">
            <template
              v-if="
                accounts.find(acc => acc.accountId === accountData.accountIdFormatted.value)
                  ?.nickname
              "
            >
              <div class="d-flex row">
                <p class="col-6">Nickname</p>
                <p class="col-6">
                  {{
                    accounts.find(acc => acc.accountId === accountData.accountIdFormatted.value)
                      ?.nickname
                  }}
                </p>
              </div>
              <hr class="my-4" />
            </template>
            <div class="d-flex row">
              <p class="col-6">Account ID</p>
              <p class="col-6">
                {{
                  accountData.accountInfo.value?.accountId.toStringWithChecksum(networkStore.client)
                }}
                <i
                  class="bi bi-box-arrow-up-right link-primary cursor-pointer ms-1"
                  @click="
                    networkStore.network !== 'custom' &&
                      openExternal(`
            https://hashscan.io/${networkStore.network}/account/${accountData.accountIdFormatted.value}`)
                  "
                ></i>
              </p>
            </div>
            <div class="mt-4 d-flex row">
              <p class="col-6">EVM Address</p>
              <p class="col-6 text-break">
                {{ accountData.accountInfo.value?.evmAddress || 'None' }}
              </p>
            </div>
            <div class="mt-4 d-flex row">
              <p class="col-6">Balance</p>
              <p class="col-6">{{ accountData.accountInfo.value?.balance || 'None' }}</p>
            </div>
            <div class="mt-4 d-flex row">
              <p class="col-6">Admin Key</p>
              <p class="text-break col-6">
                <template v-if="accountData.key.value instanceof KeyList && true">
                  Complex Key (levels)
                  <span class="ms-3 link-primary" @click="isKeyStructureModalShown = true"
                    >See details</span
                  >
                </template>
                <template v-else-if="accountData.key.value instanceof PublicKey && true">
                  <span class="text-muted text-small">
                    {{ accountData.key.value.toStringRaw() }}
                  </span>
                  <span class="d-block">{{ accountData.key.value._key._type }}</span>
                </template>
                <template v-else>None</template>
              </p>
            </div>
            <div class="mt-4 d-flex row">
              <p class="col-6">Receiver Sig. Required</p>
              <p class="col-6">
                {{ accountData.accountInfo.value?.receiverSignatureRequired ? 'Yes' : 'No' }}
              </p>
            </div>
            <div class="mt-4 d-flex row">
              <p class="col-6">Memo</p>
              <p class="col-6">{{ accountData.accountInfo.value?.memo || 'None' }}</p>
            </div>
            <div class="mt-4 d-flex row">
              <p class="col-6">Max. Auto. Association</p>
              <p class="col-6">
                {{ accountData.accountInfo.value?.maxAutomaticTokenAssociations }}
              </p>
            </div>
            <div class="mt-4 d-flex row">
              <p class="col-6">Ethereum Nonce</p>
              <p class="col-6">
                {{ accountData.accountInfo.value?.ethereumNonce }}
              </p>
            </div>
            <hr class="my-4" />
            <div class="d-flex row">
              <p class="col-6">Created At</p>
              <p class="col-6">
                {{
                  accountData.accountInfo.value?.createdTimestamp
                    ? new Date(
                        accountData.accountInfo.value?.createdTimestamp.seconds * 1000,
                      ).toDateString()
                    : 'None'
                }}
              </p>
            </div>
            <div class="mt-4 d-flex row">
              <p class="col-6">Expires At</p>
              <p class="col-6">
                {{
                  accountData.accountInfo.value?.expiryTimestamp
                    ? new Date(
                        accountData.accountInfo.value?.expiryTimestamp.seconds * 1000,
                      ).toDateString()
                    : 'None'
                }}
              </p>
            </div>
            <div class="mt-4 d-flex row" v-if="accountData.accountInfo.value?.autoRenewPeriod">
              <p class="col-6">Auto Renew Period</p>
              <p class="col-6">
                <span>{{ accountData.accountInfo.value?.autoRenewPeriod }}s</span>
                <span class="ms-4"
                  >{{
                    (accountData.accountInfo.value?.autoRenewPeriod / 86400).toFixed(0)
                  }}
                  days</span
                >
              </p>
            </div>
            <hr class="my-4" />
            <div class="d-flex row">
              <p class="col-6">Staked to</p>
              <p class="col-6">
                {{
                  accountData.accountInfo.value?.stakedNodeId
                    ? `Node ${accountData.accountInfo.value?.stakedNodeId}`
                    : accountData.accountInfo.value?.stakedAccountId
                }}
              </p>
            </div>
            <div class="mt-4 d-flex row">
              <p class="col-6">Pending Reward</p>
              <p class="col-6">
                <span>
                  {{
                    (
                      accountData.accountInfo.value?.pendingRewards || Hbar.fromString('0')
                    ).toString(HbarUnit.Hbar)
                  }}
                </span>
                <span></span>
              </p>
            </div>
            <div class="mt-4 d-flex row">
              <p class="col-6">Rewards</p>
              <p class="col-6">
                {{ accountData.accountInfo.value?.declineReward ? 'Declined' : 'Accepted' }}
              </p>
            </div>
          </div>
        </Transition>

        <AppModal
          v-model:show="isKeyStructureModalShown"
          v-if="accountData.isValid.value"
          class="modal-fit-content"
        >
          <div class="p-5">
            <KeyStructure
              v-if="accountData.key.value instanceof KeyList && true"
              :key-list="accountData.key.value"
            />
            <div v-else-if="accountData.key.value instanceof PublicKey && true">
              {{ accountData.key.value.toStringRaw() }}
            </div>
          </div>
        </AppModal>
      </div>
    </div>
  </div>
</template>
