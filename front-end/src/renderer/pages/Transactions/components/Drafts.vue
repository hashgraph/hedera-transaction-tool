<script setup lang="ts">
import type { TransactionDraft, TransactionGroup } from '@prisma/client';

import { computed, nextTick, onBeforeMount, onUnmounted, ref, watch } from 'vue';

import { Prisma } from '@prisma/client';

import { useRouter } from 'vue-router';
import { useToast } from 'vue-toast-notification';
import useUserStore from '@renderer/stores/storeUser';

import {
  getDraft,
  getDrafts,
  deleteDraft,
  updateDraft,
  getDraftsCount,
} from '@renderer/services/transactionDraftsService';
import {
  deleteGroup,
  getGroup,
  getGroups,
  getGroupsCount,
} from '@renderer/services/transactionGroupsService';

import { isUserLoggedIn } from '@renderer/utils';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppLoader from '@renderer/components/ui/AppLoader.vue';
import AppPager from '@renderer/components/ui/AppPager.vue';
import EmptyTransactions from '@renderer/components/EmptyTransactions.vue';
import DateTimeString from '@renderer/components/ui/DateTimeString.vue';
import { successToastOptions } from '@renderer/utils/toastOptions.ts';
import { getDisplayTransactionType } from '@renderer/utils/sdk/transactions.ts';
import useCreateTooltips from '@renderer/composables/useCreateTooltips';
import Tooltip from 'bootstrap/js/dist/tooltip';

/* Store */
const user = useUserStore();

/* State */
const drafts = ref<TransactionDraft[]>([]);
const totalItems = ref(0);
const currentPage = ref(1);
const pageSize = ref(10);
const isLoading = ref(true);
const groups = ref<TransactionGroup[]>([]);
const list = ref<(TransactionDraft | TransactionGroup)[]>([]);
const sortField = ref<string>('created_at');
const sortDirection = ref<string>('desc');
const descriptionRefs = ref<Map<string, HTMLElement>>(new Map());
const truncationState = ref<Map<string, boolean>>(new Map());
let resizeObserver: ResizeObserver | undefined;

/* Computed */
const generatedClass = computed(() => {
  return sortDirection.value === 'desc' ? 'bi-arrow-down-short' : 'bi-arrow-up-short';
});

/* Composables */
const router = useRouter();
const toast = useToast();
const createTooltips = useCreateTooltips();

/* Handlers */
const handleSort = async (field: string, direction: string) => {
  sortField.value = field;
  sortDirection.value = direction;

  switch (field) {
    case 'created_at': {
      const cmp = (
        a: TransactionDraft | TransactionGroup,
        b: TransactionDraft | TransactionGroup,
      ) =>
        direction == 'desc'
          ? a.created_at.getTime() - b.created_at.getTime()
          : b.created_at.getTime() - a.created_at.getTime();
      list.value?.sort(cmp);
      break;
    }
    case 'type': {
      const cmp = (
        a: TransactionDraft | TransactionGroup,
        b: TransactionDraft | TransactionGroup,
      ) => {
        let typeA = '';
        let typeB = '';
        let returnValue = 0;
        if ((a as TransactionDraft).type) {
          typeA = (a as TransactionDraft).type;
        }
        if ((b as TransactionDraft).type) {
          typeB = (b as TransactionDraft).type;
        }
        if (typeA < typeB) {
          returnValue = -1;
        }
        if (typeA > typeB) {
          returnValue = 1;
        }
        if (direction == 'asc') {
          returnValue *= -1;
        }
        return returnValue;
      };
      list.value?.sort(cmp);
      break;
    }
  }
};

const handleUpdateIsTemplate = async (e: Event, draft: TransactionDraft | TransactionGroup) => {
  if ((draft as TransactionDraft).isTemplate !== undefined) {
    const checkbox = e.currentTarget as HTMLInputElement | null;

    if (checkbox) {
      await updateDraft(draft.id, { isTemplate: checkbox.checked });
    }
  }
};

const handleDeleteDraft = async (draft: TransactionDraft | TransactionGroup) => {
  let toastMessage: string;
  if ((draft as TransactionDraft).type) {
    await deleteDraft(draft.id);
    toastMessage = 'Draft successfully deleted';
  } else {
    await deleteGroup(draft.id);
    toastMessage = 'Group successfully deleted';
  }

  await fetchDrafts();

  toast.success(toastMessage, successToastOptions);
};

const handleContinueDraft = async (draft: TransactionDraft | TransactionGroup) => {
  if ((draft as TransactionDraft).type) {
    const fetchedDraft = await getDraft(draft.id);

    await router.push({
      name: 'createTransaction',
      params: {
        type: fetchedDraft.type.replace(/\s/g, ''),
      },
      query: {
        draftId: draft?.id,
      },
    });
  } else {
    const group = await getGroup(draft.id);

    await router.push({
      name: 'createTransactionGroup',
      query: {
        id: group?.id,
      },
    });
  }
};

/* Functions */
function getOpositeDirection() {
  return sortDirection.value === 'asc' ? 'desc' : 'asc';
}

/**
 * Gets the display transaction type for drafts.
 * For freeze transactions, extracts the specific freeze type from transactionBytes.
 */
function getDraftDisplayType(draft: TransactionDraft): string {
  return getDisplayTransactionType(
    { localType: draft.type, transactionBytes: draft.transactionBytes },
    false,
    true,
  );
}

function createFindArgs(): Prisma.TransactionDraftFindManyArgs {
  if (!isUserLoggedIn(user.personal)) {
    throw new Error('User is not logged in');
  }

  return {
    where: {
      user_id: user.personal.id,
      GroupItem: {
        every: {
          transaction_draft_id: null,
        },
      },
    },
    skip: (currentPage.value - 1) * pageSize.value,
    take: pageSize.value,
  };
}

function createFindGroupArgs(): Prisma.TransactionGroupFindManyArgs {
  if (!isUserLoggedIn(user.personal)) {
    throw new Error('User is not logged in');
  }

  return {
    where: {
      GroupItem: {
        every: {
          transaction_draft: {
            user_id: user.personal.id,
          },
        },
      },
    },
    skip: (currentPage.value - 1) * pageSize.value,
    take: pageSize.value,
  };
}

function clearTruncationState() {
  descriptionRefs.value.forEach((el) => {
    const tooltip = Tooltip.getInstance(el);
    if (tooltip) {
      tooltip.dispose();
    }
    if (resizeObserver) {
      resizeObserver.unobserve(el);
    }
  });
  descriptionRefs.value.clear();
  truncationState.value.clear();
}

async function fetchDrafts() {
  if (!isUserLoggedIn(user.personal)) {
    throw new Error('User is not logged in');
  }

  isLoading.value = true;
  clearTruncationState();
  try {
    const draftsCount = await getDraftsCount(user.personal.id);
    drafts.value = await getDrafts(createFindArgs());
    const groupsCount = await getGroupsCount(user.personal.id);
    groups.value = await getGroups(createFindGroupArgs());
    totalItems.value = draftsCount + groupsCount;
    list.value = [...drafts.value, ...groups.value];
    await handleSort(sortField.value, sortDirection.value);
  } finally {
    isLoading.value = false;
  }
}

function getDraftDescription(draft: TransactionDraft | TransactionGroup): string {
  if ((draft as TransactionDraft).type) {
    return (draft as TransactionDraft).description;
  }
  return (draft as TransactionGroup).description;
}

function getDraftId(draft: TransactionDraft | TransactionGroup): string {
  return draft.id;
}

function setDescriptionRef(el: HTMLElement | null, draft: TransactionDraft | TransactionGroup) {
  const id = getDraftId(draft);

  if (el) {
    descriptionRefs.value.set(id, el);

    if (!resizeObserver) {
      resizeObserver = new ResizeObserver((entries) => {
        entries.forEach((entry) => {
          const element = entry.target as HTMLElement;
          checkTruncation(element);
        });
      });
    }
    resizeObserver.observe(el);

    nextTick(() => checkTruncation(el));
  } else {
    const existingEl = descriptionRefs.value.get(id);
    if (existingEl && resizeObserver) {
      resizeObserver.unobserve(existingEl);
    }

    if (existingEl) {
      const tooltip = Tooltip.getInstance(existingEl);
      if (tooltip) {
        tooltip.dispose();
      }
    }

    descriptionRefs.value.delete(id);
    truncationState.value.delete(id);
  }
}

function checkTruncation(el: HTMLElement) {
  let elementId: string | undefined;
  descriptionRefs.value.forEach((value, key) => {
    if (value === el) {
      elementId = key;
    }
  });

  if (!elementId) {
    return;
  }

  const wasTruncated = truncationState.value.get(elementId) ?? false;
  const isNowTruncated = el.scrollHeight > el.clientHeight;

  if (wasTruncated === isNowTruncated) {
    return;
  }

  truncationState.value.set(elementId, isNowTruncated);

  const tooltip = Tooltip.getInstance(el);

  if (wasTruncated && !isNowTruncated && tooltip) {
    tooltip.dispose();
  } else if (!wasTruncated && isNowTruncated) {
    nextTick(() => createTooltips());
  }
}

function isTruncated(draft: TransactionDraft | TransactionGroup): boolean {
  const id = getDraftId(draft);
  return truncationState.value.get(id) ?? false;
}

/* Hooks */
onBeforeMount(async () => {
  await fetchDrafts();
});

onUnmounted(() => {
  clearTruncationState();
  if (resizeObserver) {
    resizeObserver.disconnect();
  }
});

/* Watchers */
watch([currentPage, pageSize], async () => {
  await fetchDrafts();
});

watch(() => list.value.length, () => {
  nextTick(() => {
    descriptionRefs.value.forEach((el) => checkTruncation(el));
  });
});
</script>

<template>
  <div class="fill-remaining overflow-x-auto">
    <template v-if="isLoading">
      <AppLoader />
    </template>
    <template v-else>
      <template v-if="list.length > 0">
        <table v-show="!isLoading" class="table-custom">
          <thead>
            <tr>
              <th>
                <div
                  class="table-sort-link"
                  @click="
                    handleSort(
                      'created_at',
                      sortField === 'created_at' ? getOpositeDirection() : 'asc',
                    )
                  "
                >
                  <span>Date Created</span>
                  <i
                    v-if="sortField === 'created_at'"
                    class="bi text-title"
                    :class="[generatedClass]"
                  ></i>
                </div>
              </th>
              <th>
                <div
                  class="table-sort-link"
                  @click="handleSort('type', sortField === 'type' ? getOpositeDirection() : 'asc')"
                >
                  <span>Transaction Type</span>
                  <i
                    v-if="sortField === 'type'"
                    class="bi text-title"
                    :class="[generatedClass]"
                  ></i>
                </div>
              </th>
              <th>
                <div
                  class="table-sort-link"
                  @click="handleSort('description', sortField === 'description' ? getOpositeDirection() : 'asc')"
                >
                  <span>Description</span>
                  <i
                    v-if="sortField === 'description'"
                    class="bi text-title"
                    :class="[generatedClass]"
                  ></i>
                </div>
              </th>
              <th>
                <div
                  class="table-sort-link justify-content-center"
                  @click="
                    handleSort(
                      'isTemplate',
                      sortField === 'isTemplate' ? getOpositeDirection() : 'asc',
                    )
                  "
                >
                  <span>Is Template</span>
                  <i
                    v-if="sortField === 'isTemplate'"
                    class="bi text-title"
                    :class="[generatedClass]"
                  ></i>
                </div>
              </th>
              <th class="text-center">
                <span>Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            <template v-for="(draft, i) in list" :key="draft.id">
              <tr>
                <td>
                  <span class="text-secondary" :data-testid="'span-draft-tx-date-' + i">
                    <DateTimeString :date="draft.created_at" compact wrap />
                  </span>
                </td>
                <td>
                  <span class="text-bold" :data-testid="'span-draft-tx-type-' + i">{{
                      (draft as TransactionDraft).type
                        ? getDraftDisplayType(draft as TransactionDraft)
                        : 'Group'
                    }}</span>
                </td>
                <td>
                  <span
                  :ref="(el) => setDescriptionRef(el as HTMLElement, draft)"
                  class="text-wrap-two-line-ellipsis"
                  :data-testid="'span-draft-tx-description-' + i"
                  :data-bs-toggle="isTruncated(draft) ? 'tooltip' : ''"
                  data-bs-trigger="hover"
                  data-bs-placement="bottom"
                  data-bs-custom-class="wide-tooltip"
                  :data-bs-title="isTruncated(draft) ? getDraftDescription(draft) : ''"
                  >
                  {{getDraftDescription(draft)}}
                  </span>
                </td>
                <td class="text-center">
                  <input
                    class="form-check-input"
                    :data-testid="'checkbox-is-template-' + i"
                    type="checkbox"
                    :checked="
                      (draft as TransactionDraft).isTemplate !== undefined
                        ? Boolean((draft as TransactionDraft).isTemplate)
                        : false
                    "
                    @change="e => handleUpdateIsTemplate(e, draft)"
                  />
                </td>
                <td class="text-center">
                  <div class="d-flex justify-content-center flex-wrap gap-3">
                    <AppButton
                      color="borderless"
                      :data-testid="'button-draft-delete-' + i"
                      @click="handleDeleteDraft(draft)"
                      >Delete</AppButton
                    >
                    <AppButton
                      color="secondary"
                      :data-testid="'button-draft-continue-' + i"
                      @click="handleContinueDraft(draft)"
                      >Continue</AppButton
                    >
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
          <tfoot class="d-table-caption">
            <tr class="d-inline">
              <AppPager
                v-show="!isLoading"
                v-model:current-page="currentPage"
                v-model:per-page="pageSize"
                :total-items="totalItems"
              />
            </tr>
          </tfoot>
        </table>
      </template>
      <template v-else>
        <div class="flex-column-100 flex-centered">
          <EmptyTransactions :mode="'transactions-tab'" />
        </div>
      </template>
    </template>
  </div>
</template>
