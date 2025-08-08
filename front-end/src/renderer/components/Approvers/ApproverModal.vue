<script setup lang="ts">
import type { TransactionApproverDto } from '@shared/interfaces/organization/approvers';
import type { TabItem } from '@renderer/components/ui/AppTabs.vue';

import { computed, nextTick, ref, watch } from 'vue';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';
import AppCustomIcon from '@renderer/components/ui/AppCustomIcon.vue';
import AppTabs from '@renderer/components/ui/AppTabs.vue';
import ApproverStructureEdit from '@renderer/components/Approvers/ApproverStructureEdit.vue';
import ApproverSingleEdit from '@renderer/components/Approvers/ApproverSingleEdit.vue';
import ApproverStructure from '@renderer/components/Approvers/ApproverStructure.vue';

/* Props */
const props = defineProps<{
  approver: TransactionApproverDto | null;
  show: boolean;
  onClose?: () => void;
}>();

/* Emits */
const emit = defineEmits(['update:show', 'update:approvers']);

/* Misc */
const singleApproverTitle = 'Single';
const complexApproverTitle = 'Complex';

/* State */
const currentApprover = ref<TransactionApproverDto | null>(props.approver);
const currentSingleApprover = ref<TransactionApproverDto[] | null>(null);
const errorModalShow = ref(false);
const summaryMode = ref(false);
const tabItems = ref<TabItem[]>([{ title: singleApproverTitle }, { title: complexApproverTitle }]);
const activeTabIndex = ref(0);

/* Computed */
const activeTabTitle = computed(() => tabItems.value[activeTabIndex.value].title);
const activeApprover = computed(() =>
  activeTabTitle.value === singleApproverTitle
    ? currentSingleApprover.value
    : currentApprover.value,
);
const currentApproverInvalid = computed(
  () =>
    activeApprover.value === null ||
    Boolean(
      activeTabTitle.value === complexApproverTitle &&
        currentApprover.value &&
        !isApproverValid(currentApprover.value),
    ),
);

/* Handlers */
const handleApproverUpdate = (newApprover: TransactionApproverDto) =>
  (currentApprover.value = newApprover);

const handleSingleApproverUpdate = (newApprover: TransactionApproverDto[]) =>
  (currentSingleApprover.value = newApprover);

const handleDoneClick = async () => {
  if (currentApproverInvalid.value) {
    errorModalShow.value = true;
    return;
  }

  emit(
    'update:approvers',
    Array.isArray(activeApprover.value) ? activeApprover.value : [activeApprover.value],
  );
  emit('update:show', false);
};

const handleAddNew = async () => {
  await nextTick();
  currentApprover.value = null;
  currentSingleApprover.value = null;
  summaryMode.value = false;
  activeTabIndex.value = 0;
  emit('update:show', true);
};

const handleStartEdit = async () => {
  await nextTick();

  currentApprover.value = props.approver;
  currentSingleApprover.value = props.approver?.userId ? [{ userId: props.approver.userId }] : null;
  summaryMode.value = false;
  activeTabIndex.value = props.approver?.userId ? 0 : 1;
  emit('update:show', true);
};

const handleViewSummary = async () => {
  await nextTick();

  summaryMode.value = !summaryMode.value;
};

/* Functions */
function isApproverValid(approver: TransactionApproverDto) {
  if (approver.userId && approver.approvers) return false;

  if (approver.approvers && approver.approvers.length === 0) return false;

  if (approver.threshold && approver.threshold <= 0) return false;

  if (approver.userId && !approver.threshold && !approver.approvers) {
    return true;
  }

  if (!approver.approvers) return false;

  const subApprovers = approver.approvers;

  if (subApprovers.length === 0 || (approver.threshold && approver.threshold > subApprovers.length))
    return false;

  const everyNestedKeyValid = subApprovers.every(approver => {
    if (!isApproverValid(approver)) return false;
    else return true;
  });

  return everyNestedKeyValid;
}

function getApproversFromComplex(
  approver: TransactionApproverDto | null,
): TransactionApproverDto[] {
  const approvers: TransactionApproverDto[] = [];

  if (approver && approver.userId !== undefined) {
    approvers.push({ userId: approver.userId });
  } else if (approver?.approvers) {
    approver.approvers.forEach(approver => {
      approvers.push(...getApproversFromComplex(approver));
    });
  }

  return approvers;
}

function getComplexApproverFromApprovers(
  approvers: TransactionApproverDto[],
): TransactionApproverDto {
  return {
    approvers,
  };
}

/* Watchers */
watch(activeTabTitle, () => {
  if (activeTabTitle.value === singleApproverTitle && currentSingleApprover.value === null) {
    currentSingleApprover.value = getApproversFromComplex(currentApprover.value);
  }
  if (activeTabTitle.value === complexApproverTitle && currentApprover.value === null) {
    currentApprover.value = getComplexApproverFromApprovers(currentSingleApprover.value || []);
  }
});

/* Exposes */
defineExpose({
  addNew: handleAddNew,
  startEdit: handleStartEdit,
  viewSummary: handleViewSummary,
});

/* Misc */
const modalContentContainerStyle = { padding: '0 10%', height: '80%' };
</script>
<template>
  <AppModal :show="show" @update:show="emit('update:show', $event)" class="full-screen-modal">
    <div class="p-5 h-100">
      <form @submit.prevent="handleDoneClick" class="flex-column-100 fill-remaining">
        <div>
          <i class="bi bi-x-lg cursor-pointer" @click="$emit('update:show', false)"></i>
        </div>
        <h1 class="text-title text-semi-bold text-center">Select User Or Create Structure</h1>
        <div :style="modalContentContainerStyle">
          <div class="text-end mt-3">
            <AppButton
              color="borderless"
              type="button"
              class="text-body"
              @click="summaryMode = !summaryMode"
              >{{ summaryMode ? 'Edit Mode' : 'View Summary' }}</AppButton
            >
            <AppButton
              type="submit"
              color="primary"
              class="ms-3"
              :disabled="currentApproverInvalid"
              data-testid="button-complex-key-done"
              >Done</AppButton
            >
          </div>
          <div class="flex-centered mt-4">
            <AppTabs
              :items="tabItems"
              v-model:activeIndex="activeTabIndex"
              class="w-50"
              nav-item-class="flex-1"
              nav-item-button-class="justify-content-center"
            ></AppTabs>
          </div>
          <div v-if="show" class="h-100 overflow-auto mt-6">
            <Transition name="fade" :mode="'out-in'">
              <div v-if="!summaryMode && activeTabTitle === complexApproverTitle">
                <ApproverStructureEdit
                  :model-approver="currentApprover"
                  @update:model-approver="handleApproverUpdate"
                />
              </div>
              <div v-else-if="!summaryMode && activeTabTitle === singleApproverTitle">
                <ApproverSingleEdit
                  :model-approvers="currentSingleApprover"
                  @update:model-approver="handleSingleApproverUpdate"
                />
              </div>
              <div v-else-if="summaryMode">
                <ApproverStructure
                  :approvers="
                    Array.isArray(activeApprover)
                      ? activeApprover
                      : activeApprover
                        ? [activeApprover]
                        : []
                  "
                />
              </div>
            </Transition>
          </div>
        </div>
      </form>
    </div>
    <AppModal
      class="common-modal"
      v-model:show="errorModalShow"
      :close-on-click-outside="false"
      :close-on-escape="false"
    >
      <div class="p-5">
        <div>
          <i class="bi bi-x-lg cursor-pointer" @click="errorModalShow = false"></i>
        </div>
        <div class="text-center">
          <AppCustomIcon :name="'error'" style="height: 160px" />
        </div>
        <h3 class="text-center text-title text-bold mt-4">Error</h3>
        <p class="text-center text-small text-secondary mt-3">
          You cannot save approver with invalid structure
        </p>

        <hr class="separator my-5" />

        <div class="d-grid">
          <AppButton type="button" color="secondary" @click="errorModalShow = false"
            >Close</AppButton
          >
        </div>
      </div>
    </AppModal>
    <slot></slot>
  </AppModal>
</template>
