<script setup lang="ts">
import { computed, onBeforeMount, reactive, ref, watch } from 'vue';

import { Prisma, TransactionDraft } from '@prisma/client';

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

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppLoader from '@renderer/components/ui/AppLoader.vue';
import AppPager from '@renderer/components/ui/AppPager.vue';
import EmptyTransactions from '@renderer/components/EmptyTransactions.vue';

/* Store */
const user = useUserStore();

/* State */
const drafts = ref<TransactionDraft[]>([]);
const sort = reactive<{
  field: Prisma.TransactionDraftScalarFieldEnum;
  direction: Prisma.SortOrder;
}>({
  field: 'created_at',
  direction: 'desc',
});
const totalItems = ref(0);
const currentPage = ref(1);
const pageSize = ref(10);
const isLoading = ref(true);

/* Computed */
const generatedClass = computed(() => {
  return sort.direction === 'desc' ? 'bi-arrow-down-short' : 'bi-arrow-up-short';
});

/* Composables */
const router = useRouter();
const toast = useToast();

/* Handlers */
const handleSort = async (
  field: Prisma.TransactionDraftScalarFieldEnum,
  direction: Prisma.SortOrder,
) => {
  sort.field = field;
  sort.direction = direction;
  drafts.value = await getDrafts(createFindArgs());
};

const handleUpdateIsTemplate = async (e: Event, id: string) => {
  const checkbox = e.currentTarget as HTMLInputElement | null;

  if (checkbox) {
    await updateDraft(id, { isTemplate: checkbox.checked });
  }
};

const handleDeleteDraft = async (id: string) => {
  await deleteDraft(id);

  drafts.value = drafts.value.filter(d => d.id !== id);

  toast.success('Draft successfully deleted', { position: 'bottom-right' });
};

const handleContinueDraft = async (id: string) => {
  const draft = await getDraft(id);

  router.push({
    name: 'createTransaction',
    params: {
      type: draft.type.replace(/\s/g, ''),
    },
    query: {
      draftId: draft?.id,
    },
  });
};

/* Functions */
function getOpositeDirection() {
  return sort.direction === 'asc' ? 'desc' : 'asc';
}

function createFindArgs(): Prisma.TransactionDraftFindManyArgs {
  return {
    where: {
      user_id: user.data.id,
    },
    orderBy: {
      [sort.field]: sort.direction,
    },
    skip: (currentPage.value - 1) * pageSize.value,
    take: pageSize.value,
  };
}

/* Hooks */
onBeforeMount(async () => {
  try {
    totalItems.value = await getDraftsCount(user.data.id);
    drafts.value = await getDrafts(createFindArgs());
    handleSort(sort.field, sort.direction);
  } finally {
    isLoading.value = false;
  }
});

/* Watchers */
watch([currentPage, pageSize], async () => {
  isLoading.value = true;
  try {
    drafts.value = await getDrafts(createFindArgs());
    handleSort(sort.field, sort.direction);
  } finally {
    isLoading.value = false;
  }
});
</script>

<template>
  <div class="fill-remaining overflow-x-auto">
    <template v-if="isLoading">
      <AppLoader />
    </template>
    <template v-else>
      <template v-if="drafts.length > 0">
        <table v-show="!isLoading" class="table-custom">
          <thead>
            <tr>
              <th class="w-10 text-end">#</th>
              <th>
                <div
                  class="table-sort-link"
                  @click="
                    handleSort(
                      'created_at',
                      sort.field === 'created_at' ? getOpositeDirection() : 'asc',
                    )
                  "
                >
                  <span>Date</span>
                  <i
                    v-if="sort.field === 'created_at'"
                    class="bi text-title"
                    :class="[generatedClass]"
                  ></i>
                </div>
              </th>
              <th>
                <div
                  class="table-sort-link"
                  @click="handleSort('type', sort.field === 'type' ? getOpositeDirection() : 'asc')"
                >
                  <span>Transaction Type</span>
                  <i
                    v-if="sort.field === 'type'"
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
                      sort.field === 'isTemplate' ? getOpositeDirection() : 'asc',
                    )
                  "
                >
                  <span>Is Template</span>
                  <i
                    v-if="sort.field === 'isTemplate'"
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
            <template v-for="(draft, i) in drafts" :key="draft.id">
              <tr>
                <td>{{ i + 1 }}</td>
                <td>
                  <span class="text-secondary">
                    {{ draft.created_at.toLocaleString() }}
                  </span>
                </td>
                <td>
                  <span class="text-bold">{{ draft.type }}</span>
                </td>
                <td class="text-center">
                  <input
                    class="form-check-input"
                    type="checkbox"
                    :checked="Boolean(draft.isTemplate)"
                    @change="e => handleUpdateIsTemplate(e, draft.id)"
                  />
                </td>
                <td class="text-center">
                  <div class="d-flex justify-content-center flex-wrap gap-3">
                    <AppButton color="borderless" @click="handleDeleteDraft(draft.id)"
                      >Delete</AppButton
                    >
                    <AppButton color="secondary" @click="handleContinueDraft(draft.id)"
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
        <EmptyTransactions class="absolute-centered w-100" />
      </template>
    </template>
  </div>
</template>
