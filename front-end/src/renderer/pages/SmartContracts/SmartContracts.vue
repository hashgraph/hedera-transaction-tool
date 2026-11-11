<script setup lang="ts">
import type { SmartContract } from '@prisma/client';

import { computed, onMounted, ref, watch } from 'vue';

import useUserStore from '@renderer/stores/storeUser';
import useNetworkStore from '@renderer/stores/storeNetwork';

import { ToastManager } from '@renderer/utils/ToastManager';
import useSetDynamicLayout, { LOGGED_IN_LAYOUT } from '@renderer/composables/useSetDynamicLayout';

import { getAll, remove, update } from '@renderer/services/smartContractsService';
import {
  getAbiFunctions,
  getRoleGetterCandidates,
  parseStoredAbi,
  type AbiItem,
} from '@renderer/utils/sdk/abi';
import {
  createRole,
  getFunctionSignature,
  parseRoles,
  type ContractRole,
} from '@renderer/utils/sdk/contractRoles';
import { resolveBytes32Getter } from '@renderer/utils/sdk/contractCall';

import { isUserLoggedIn, getErrorMessage } from '@renderer/utils';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppCustomIcon from '@renderer/components/ui/AppCustomIcon.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';
import RoleModal from './components/RoleModal.vue';
import ViewSourceModal from './components/ViewSourceModal.vue';

/* Stores */
const user = useUserStore();
const network = useNetworkStore();

/* Composables */
const toastManager = ToastManager.inject();
useSetDynamicLayout(LOGGED_IN_LAYOUT);

/* State */
const contracts = ref<SmartContract[]>([]);
const selectedId = ref<string | null>(null);
const isRemoveModalShown = ref(false);
const isNicknameInputShown = ref(false);
const nicknameInputRef = ref<InstanceType<typeof AppInput> | null>(null);
const isRoleModalShown = ref(false);
const editingRole = ref<ContractRole | null>(null);
const isViewSourceModalShown = ref(false);

/* Computed */
const selectedContract = computed(
  () => contracts.value.find(c => c.id === selectedId.value) || null,
);

const selectedAbi = computed<AbiItem[]>(() =>
  selectedContract.value ? parseStoredAbi(selectedContract.value.abi) : [],
);

const selectedFunctions = computed(() => getAbiFunctions(selectedAbi.value));

const roles = computed<ContractRole[]>(() => parseRoles(selectedContract.value?.roles));

const suggestedRoles = computed(() =>
  getRoleGetterCandidates(selectedAbi.value).filter(
    fn => !roles.value.some(r => r.name === fn.name),
  ),
);

const roleGetterCandidateNames = computed(
  () => new Set(getRoleGetterCandidates(selectedAbi.value).map(fn => fn.name)),
);

function canResolveRole(role: ContractRole): boolean {
  return !role.verified && roleGetterCandidateNames.value.has(role.name);
}

async function tryResolveRoleValue(functionName: string): Promise<string | null> {
  if (!selectedContract.value) {
    return null;
  }

  return await resolveBytes32Getter(
    {
      contractId: selectedContract.value.contract_id,
      evmAddress: selectedContract.value.evm_address,
    },
    functionName,
    network.mirrorNodeBaseURL,
  );
}

/* Functions */
async function fetchContracts() {
  if (!isUserLoggedIn(user.personal)) throw new Error('User is not logged in');

  contracts.value = await getAll({
    where: {
      user_id: user.personal.id,
      network: network.network,
    },
    orderBy: { created_at: 'desc' },
  });

  if (!selectedId.value || !contracts.value.some(c => c.id === selectedId.value)) {
    selectedId.value = contracts.value[0]?.id || null;
  }
}

async function persistContract(partial: { roles?: string }) {
  if (!isUserLoggedIn(user.personal) || !selectedContract.value) {
    throw new Error('User is not logged in');
  }

  try {
    await update(selectedContract.value.id, user.personal.id, partial);
    await fetchContracts();
  } catch (error) {
    toastManager.error(getErrorMessage(error, 'Failed to update smart contract'));
  }
}

/* Handlers */
const handleSelect = (id: string) => {
  isNicknameInputShown.value = false;
  selectedId.value = id;
};

const handleRemove = async () => {
  if (!isUserLoggedIn(user.personal) || !selectedContract.value) {
    throw new Error('User is not logged in');
  }

  try {
    await remove(user.personal.id, [selectedContract.value.id]);
    await fetchContracts();
    toastManager.success('Smart contract removed!');
  } catch (error) {
    toastManager.error(getErrorMessage(error, 'Failed to remove smart contract'));
  } finally {
    isRemoveModalShown.value = false;
  }
};

const handleStartNicknameEdit = () => {
  isNicknameInputShown.value = true;

  setTimeout(() => {
    if (nicknameInputRef.value?.inputRef) {
      nicknameInputRef.value.inputRef.value = selectedContract.value?.nickname || '';
    }
    nicknameInputRef.value?.inputRef?.focus();
  }, 100);
};

const handleChangeNickname = async () => {
  if (!isUserLoggedIn(user.personal) || !selectedContract.value) {
    throw new Error('User is not logged in');
  }

  isNicknameInputShown.value = false;

  try {
    await update(selectedContract.value.id, user.personal.id, {
      nickname: nicknameInputRef.value?.inputRef?.value || null,
    });
    await fetchContracts();
  } catch (error) {
    toastManager.error(getErrorMessage(error, 'Failed to update nickname'));
  }
};

const handleOpenAddRole = () => {
  editingRole.value = null;
  isRoleModalShown.value = true;
};

const handleOpenEditRole = (role: ContractRole) => {
  editingRole.value = role;
  isRoleModalShown.value = true;
};

async function autoAddSuggestedRoles() {
  if (suggestedRoles.value.length === 0) {
    return;
  }

  const addedRoles = await Promise.all(
    suggestedRoles.value.map(async fn => {
      const resolved = await tryResolveRoleValue(fn.name);
      const role = createRole({ name: fn.name });
      return resolved ? { ...role, value: resolved, verified: true } : role;
    }),
  );

  const nextRoles = [...roles.value, ...addedRoles];
  await persistContract({ roles: JSON.stringify(nextRoles) });
}

const handleResolveRole = async (role: ContractRole) => {
  const resolved = await tryResolveRoleValue(role.name);

  if (!resolved) {
    toastManager.error(`Could not resolve ${role.name} on-chain`);
    return;
  }

  await handleSaveRole({ ...role, value: resolved, verified: true });
};

const handleSaveRole = async (role: ContractRole) => {
  const exists = roles.value.some(r => r.id === role.id);
  const nextRoles = exists
    ? roles.value.map(r => (r.id === role.id ? role : r))
    : [...roles.value, role];
  await persistContract({ roles: JSON.stringify(nextRoles) });
};

const handleRemoveRole = async (roleId: string) => {
  const nextRoles = roles.value.filter(r => r.id !== roleId);
  await persistContract({ roles: JSON.stringify(nextRoles) });
};

/* Hooks */
watch(selectedId, async id => {
  if (id) {
    await autoAddSuggestedRoles();
  }
});

onMounted(async () => {
  await fetchContracts();
});
</script>
<template>
  <div class="px-4 px-xxl-6 py-5">
    <div class="container-fluid flex-column-100">
      <div class="d-flex justify-content-between align-items-center">
        <h1 class="text-title text-bold">Smart Contracts</h1>
      </div>

      <div class="row g-0 fill-remaining mt-6">
        <div class="col-4 col-xxl-3 flex-column-100 overflow-hidden with-border-end pe-4 ps-0">
          <AppButton
            color="primary"
            size="large"
            data-testid="button-add-new-smart-contract"
            class="w-100 d-flex align-items-center justify-content-center"
            @click="$router.push({ name: 'addSmartContract' })"
            >Add New</AppButton
          >

          <hr class="separator my-5" />

          <div class="fill-remaining pe-3">
            <p v-if="contracts.length === 0" class="text-small text-secondary">
              No smart contracts saved for this network yet.
            </p>
            <template v-for="(contract, index) in contracts" :key="contract.id">
              <div class="d-flex align-items-center mt-3">
                <div
                  class="container-multiple-select activate-on-sibling-hover overflow-hidden w-100 p-4"
                  :class="{ 'is-selected': selectedId === contract.id }"
                  @click="handleSelect(contract.id)"
                >
                  <p
                    class="text-small text-semi-bold overflow-hidden"
                    :data-testid="'p-smart-contract-nickname-' + index"
                  >
                    {{ contract.nickname || 'Unnamed contract' }}
                  </p>
                  <p
                    class="text-micro text-secondary mt-2"
                    :data-testid="'p-smart-contract-id-' + index"
                  >
                    {{ contract.contract_id || contract.evm_address }}
                  </p>
                </div>
              </div>
            </template>
          </div>
        </div>
        <div class="col-8 col-xxl-9 flex-column-100 ps-4">
          <div v-if="selectedContract" class="container-fluid flex-column-100 position-relative">
            <div class="flex-between-centered flex-wrap gap-3">
              <div class="d-flex align-items-center flex-wrap gap-3">
                <AppInput
                  v-show="isNicknameInputShown"
                  ref="nicknameInputRef"
                  @blur="handleChangeNickname"
                  :filled="true"
                  placeholder="Enter Nickname"
                  data-testid="input-smart-contract-nickname"
                />
                <p
                  v-if="!isNicknameInputShown"
                  class="text-title text-semi-bold py-3"
                  @dblclick="handleStartNicknameEdit"
                >
                  <span class="text-truncate">{{
                    selectedContract.nickname || 'Unnamed contract'
                  }}</span>
                  <span
                    class="bi bi-pencil-square text-main text-primary ms-3 cursor-pointer"
                    @click="handleStartNicknameEdit"
                    data-testid="button-edit-smart-contract-nickname"
                  ></span>
                </p>
              </div>
              <AppButton
                class="min-w-unset"
                color="danger"
                data-testid="button-remove-smart-contract"
                @click="isRemoveModalShown = true"
                log-label="remove-smart-contract"
                :log-metadata="{ id: selectedContract.id }"
                ><span class="bi bi-trash"></span> Remove</AppButton
              >
            </div>
            <hr class="separator my-4" />
            <div class="fill-remaining overflow-x-hidden pe-3">
              <div class="row">
                <div class="col-5"><p class="text-small text-semi-bold">Contract ID</p></div>
                <div class="col-7">
                  <div class="d-flex align-items-center gap-3">
                    <p class="text-small text-semi-bold" data-testid="p-smart-contract-data-id">
                      {{ selectedContract.contract_id || 'None' }}
                    </p>
                    <span
                      v-if="selectedContract.verified"
                      class="badge bg-success d-inline-flex align-items-center"
                      data-testid="badge-smart-contract-verified"
                      ><i class="bi bi-patch-check-fill me-1"></i>Verified</span
                    >
                    <span
                      v-if="selectedContract.verified && selectedContract.evm_address"
                      class="text-micro link-primary cursor-pointer"
                      data-testid="button-view-source"
                      @click="isViewSourceModalShown = true"
                      >View source</span
                    >
                  </div>
                </div>
              </div>
              <div class="row mt-4">
                <div class="col-5"><p class="text-small text-semi-bold">EVM Address</p></div>
                <div class="col-7">
                  <p
                    class="text-small text-secondary overflow-x-auto"
                    data-testid="p-smart-contract-data-evm-address"
                  >
                    {{ selectedContract.evm_address || 'None' }}
                  </p>
                </div>
              </div>
              <div class="row mt-4">
                <div class="col-5"><p class="text-small text-semi-bold">Network</p></div>
                <div class="col-7">
                  <p class="text-small text-semi-bold">{{ selectedContract.network }}</p>
                </div>
              </div>
              <hr class="separator my-4" />
              <div class="d-flex justify-content-between align-items-center">
                <p class="text-small text-semi-bold">Roles</p>
                <AppButton
                  color="primary"
                  type="button"
                  size="small"
                  class="text-small min-w-unset"
                  data-testid="button-add-role"
                  @click="handleOpenAddRole"
                  >Add Role</AppButton
                >
              </div>
              <p v-if="roles.length === 0" class="text-small text-secondary mt-2">
                No roles defined yet.
              </p>
              <div
                v-for="role in roles"
                :key="role.id"
                class="d-flex justify-content-between align-items-center mt-3"
              >
                <div>
                  <p class="text-small text-semi-bold">
                    {{ role.name }}
                    <span v-if="role.verified" class="text-micro text-success ms-2"
                      >verified on-chain</span
                    >
                  </p>
                  <p v-if="role.note" class="text-micro text-secondary">{{ role.note }}</p>
                </div>
                <div class="d-flex gap-3 align-items-center">
                  <span
                    v-if="canResolveRole(role)"
                    class="text-micro link-primary cursor-pointer"
                    :data-testid="'button-resolve-role-' + role.name"
                    @click="handleResolveRole(role)"
                    >Resolve on-chain</span
                  >
                  <span
                    class="bi bi-pencil-square cursor-pointer"
                    :data-testid="'button-edit-role-' + role.name"
                    @click="handleOpenEditRole(role)"
                  ></span>
                  <span
                    class="bi bi-trash cursor-pointer"
                    :data-testid="'button-remove-role-' + role.name"
                    @click="handleRemoveRole(role.id)"
                  ></span>
                </div>
              </div>

              <hr class="separator my-4" />
              <div class="row">
                <div class="col-5">
                  <p class="text-small text-semi-bold">
                    Functions ({{ selectedFunctions.length }})
                  </p>
                </div>
              </div>
              <div
                v-for="fn in selectedFunctions"
                :key="getFunctionSignature(fn)"
                class="mt-3"
              >
                <p class="text-small text-secondary">
                  {{ fn.name }}({{ fn.inputs.map(i => `${i.type} ${i.name}`).join(', ') }})
                </p>
              </div>
            </div>
          </div>
          <p v-else class="text-small text-secondary mt-5">
            Select a saved smart contract, or add a new one.
          </p>

          <AppModal v-model:show="isRemoveModalShown" class="common-modal">
            <div class="p-4">
              <div class="text-start">
                <i
                  class="bi bi-x-lg d-inline-block cursor-pointer"
                  style="line-height: 16px"
                  @click="isRemoveModalShown = false"
                ></i>
              </div>
              <div class="text-center">
                <AppCustomIcon :name="'bin'" style="height: 160px" />
              </div>
              <h3 class="text-center text-title text-bold mt-3">Remove smart contract</h3>
              <p class="text-center text-small text-secondary mt-4">
                Are you sure you want to remove this smart contract from your saved list?
              </p>
              <hr class="separator my-5" />
              <div class="flex-between-centered gap-4">
                <AppButton color="borderless" @click="isRemoveModalShown = false">Cancel</AppButton>
                <AppButton
                  color="danger"
                  @click="handleRemove"
                  data-testid="button-confirm-remove-smart-contract"
                  >Remove</AppButton
                >
              </div>
            </div>
          </AppModal>

          <RoleModal v-model:show="isRoleModalShown" :role="editingRole" @save="handleSaveRole" />

          <ViewSourceModal
            v-model:show="isViewSourceModalShown"
            :evm-address="selectedContract?.evm_address ?? null"
          />
        </div>
      </div>
    </div>
  </div>
</template>
