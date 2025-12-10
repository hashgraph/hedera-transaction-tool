<script setup lang="ts">
import type { TransactionApproverDto } from '@shared/interfaces/organization/approvers';

import { ref } from 'vue';

import useContactsStore from '@renderer/stores/storeContacts';

import { useToast } from 'vue-toast-notification';

import AppButton from '@renderer/components/ui/AppButton.vue';
import UserSelectModal from '@renderer/components/Organization/UserSelectModal.vue';
import { errorToastOptions } from '@renderer/utils/toastOptions.ts';

/* Props */
const props = defineProps<{
  approver: TransactionApproverDto;
  onRemoveApprover: () => void;
  depth?: string;
}>();

/* Emits */
const emit = defineEmits<{
  (event: 'update:approver', approver: TransactionApproverDto): void;
}>();

/* Stores */
const contacts = useContactsStore();

/* Composables */
const toast = useToast();

/* State */
const areChildrenShown = ref(true);
const selectUserModalShown = ref(false);

/* Handlers */
const handleThresholdChange = (e: Event) => {
  const threshold = Number((e.target as HTMLSelectElement).value);
  emit('update:approver', { ...props.approver, threshold });
};

const handleUserSelect = (userIds: number[]) => {
  if (props.approver.approvers?.some(approver => approver.userId === userIds[0])) {
    toast.error('User already exists in the list', errorToastOptions);
  } else {
    const newApprovers = [...(props.approver.approvers || []).concat([{ userId: userIds[0] }])];
    const newThreshold = getThreshold(props.approver.threshold, newApprovers);

    emitThresholdUpdate(newApprovers, newThreshold);
  }
};

const handleRemoveUser = (userId: number) => {
  const newApprovers =
    props.approver.approvers?.filter(approver => approver.userId !== userId) || [];
  const newThreshold = getThreshold(props.approver.threshold, newApprovers);

  emitThresholdUpdate(newApprovers, newThreshold);
};

const handleAddThreshold = () => {
  const newApprovers = [...(props.approver.approvers || []), { threshold: 1 }];
  const newThreshold = getThreshold(props.approver.threshold, newApprovers);

  emitThresholdUpdate(newApprovers, newThreshold);
};

const handleRemoveThreshold = (i: number) => {
  const newApprovers = props.approver.approvers?.filter((_, index) => index !== i) || [];
  const newThreshold = getThreshold(props.approver.threshold, newApprovers);

  emitThresholdUpdate(newApprovers, newThreshold);
};

const handleApproverUpdate = (index: number, newApprover: TransactionApproverDto) => {
  const newApprovers =
    props.approver.approvers?.map((approver, i) => (i === index ? newApprover : approver)) || [];
  const newThreshold = getThreshold(props.approver.threshold, newApprovers);

  emitThresholdUpdate(newApprovers, newThreshold);
};

/* Functions */
function getThreshold(oldThreshold: number | undefined, newApprovers: TransactionApproverDto[]) {
  return typeof oldThreshold === 'number'
    ? oldThreshold <= newApprovers.length
      ? oldThreshold
      : newApprovers.length
    : newApprovers.length;
}

function emitThresholdUpdate(newApprovers: TransactionApproverDto[], newThreshold: number) {
  newApprovers = newApprovers.filter(
    app => ![app.approvers, app.threshold, app.userId].every(v => v === undefined),
  );

  const approver: TransactionApproverDto = {
    ...props.approver,
    threshold: getThreshold(newThreshold, newApprovers),
    approvers: newApprovers,
  };
  if (newApprovers.length === 0) {
    delete approver.approvers;
    delete approver.threshold;
  }
  emit('update:approver', approver);
}
</script>
<template>
  <div
    class="key-node d-flex justify-content-between key-threshhold-bg rounded py-3 px-4"
    :path="depth"
  >
    <div class="d-flex align-items-center">
      <Transition name="fade" mode="out-in">
        <span
          v-if="areChildrenShown"
          class="bi bi-chevron-up cursor-pointer"
          @click="areChildrenShown = !areChildrenShown"
        ></span>
        <span
          v-else
          class="bi bi-chevron-down cursor-pointer"
          @click="areChildrenShown = !areChildrenShown"
        ></span>
      </Transition>
      <p class="text-small text-semi-bold ms-3">Threshold</p>
      <div class="ms-3">
        <select
          class="form-select is-fill"
          :value="approver.threshold || (approver.approvers || []).length"
          @change="handleThresholdChange"
          :data-testid="`select-approver-structure-edit-threshold-${depth}`"
        >
          <template
            v-for="num in Array.from(Array((approver.approvers || []).length).keys())"
            :key="num + 1"
          >
            <option :value="num + 1">
              {{ num + 1 }}
            </option>
          </template>
        </select>
      </div>
      <p class="text-secondary text-small ms-3">of {{ (approver.approvers || []).length }}</p>
      <div class="border-start border-secondary-subtle ps-4 ms-4">
        <div class="dropdown">
          <AppButton
            type="button"
            color="primary"
            size="small"
            data-bs-toggle="dropdown"
            :data-testid="`button-approver-structure-edit-add-element-${depth}`"
            class="min-w-unset"
            ><span class="bi bi-plus-lg"></span> Add</AppButton
          >
          <ul class="dropdown-menu mt-3">
            <li
              class="dropdown-item cursor-pointer mt-3"
              @click="selectUserModalShown = true"
              :data-testid="`button-approver-structure-edit-add-element-public-key-${depth}`"
            >
              <span class="text-small">User</span>
            </li>
            <li
              class="dropdown-item cursor-pointer mt-3"
              @click="handleAddThreshold"
              :data-testid="`button-approver-structure-edit-add-element-threshold-${depth}`"
            >
              <span class="text-small">Threshold</span>
            </li>
          </ul>
        </div>
      </div>
    </div>

    <div class="d-flex align-items-center">
      <div class="text-small">
        <span
          class="bi bi-x-lg cursor-pointer"
          @click="onRemoveApprover"
          :data-testid="`button-approver-structure-edit-remove-element-${depth}`"
        ></span>
      </div>
    </div>
  </div>
  <Transition name="fade" mode="out-in">
    <div v-show="areChildrenShown">
      <template v-for="(app, i) in approver.approvers || []" :key="i">
        <template v-if="app.userId">
          <div class="key-node-wrapper">
            <div
              class="key-node d-flex justify-content-between key-threshhold-bg rounded py-3 px-4"
              :path="`${depth || 0}-${i}`"
            >
              <div>
                {{ contacts.getContact(app.userId)?.user.email || `User: ${app.userId}` }}
                <span v-if="contacts.getNickname(app.userId).trim().length > 0">
                  ({{ contacts.getNickname(app.userId) }})
                </span>
              </div>

              <div class="d-flex align-items-center">
                <div class="text-small">
                  <span
                    class="bi bi-x-lg cursor-pointer"
                    @click="handleRemoveUser(app.userId)"
                    :data-testid="`button-approver-structure-edit-remove-element-${depth}`"
                  ></span>
                </div>
              </div>
            </div>
          </div>
        </template>
        <template v-else-if="app.threshold">
          <div class="key-node-container">
            <ApproverThreshold
              :approver="app"
              @update:approver="newApprover => handleApproverUpdate(i, newApprover)"
              :on-remove-approver="() => handleRemoveThreshold(i)"
              :depth="`${depth || 0}-${i}`"
            />
          </div>
        </template>
      </template>
    </div>
  </Transition>
  <UserSelectModal
    v-if="selectUserModalShown"
    v-model:show="selectUserModalShown"
    @users-selected="handleUserSelect"
  />
</template>
