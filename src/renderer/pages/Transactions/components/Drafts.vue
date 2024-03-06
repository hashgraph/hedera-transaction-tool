<script setup lang="ts">
import { computed, onBeforeMount, reactive, ref } from 'vue';

import { Prisma, TransactionDraft } from '@prisma/client';

import { useRouter } from 'vue-router';
import { useToast } from 'vue-toast-notification';
import useUserStore from '@renderer/stores/storeUser';

import {
  getDraft,
  getDrafts,
  deleteDraft,
  updateDraft,
} from '@renderer/services/transactionDraftsService';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppLoader from '@renderer/components/ui/AppLoader.vue';

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
const page = ref(0);
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
// TODO to be refactored
const handleSort = (field: Prisma.TransactionDraftScalarFieldEnum, direction: Prisma.SortOrder) => {
  sort.field = field;
  sort.direction = direction;

  switch (field) {
    case 'type':
      drafts.value = drafts.value.sort((t1, t2) => {
        if (direction === 'asc') {
          return t1.type.localeCompare(t2.type);
        } else if (direction === 'desc') {
          return t2.type.localeCompare(t1.type);
        } else return 0;
      });
      break;
    case 'created_at':
      drafts.value = drafts.value.sort((t1, t2) => {
        if (direction === 'asc') {
          return t1.created_at.getTime() - t2.created_at.getTime();
        } else if (direction === 'desc') {
          return t2.created_at.getTime() - t1.created_at.getTime();
        } else return 0;
      });
      break;
    default:
      break;
  }
};

const handleLoadMore = async () => {
  page.value += 1;
  const nextPage = await getDrafts(createFindArgs());
  drafts.value = drafts.value.concat(nextPage);
  handleSort(sort.field, sort.direction);
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
      type: draft.type.replaceAll(' ', ''),
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
    skip: page.value * pageSize.value,
    take: pageSize.value,
  };
}

/* Hooks */
onBeforeMount(async () => {
  try {
    drafts.value = await getDrafts(createFindArgs());
    handleSort(sort.field, sort.direction);
  } finally {
    isLoading.value = false;
  }
});
</script>

<template>
  <template v-if="isLoading">
    <AppLoader />
  </template>
  <table v-else class="table-custom">
    <thead>
      <tr>
        <th class="w-10 text-end">#</th>
        <th>
          <div
            class="table-sort-link"
            @click="
              handleSort('created_at', sort.field === 'created_at' ? getOpositeDirection() : 'asc')
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
            <i v-if="sort.field === 'type'" class="bi text-title" :class="[generatedClass]"></i>
          </div>
        </th>
        <th class="text-center">
          <span>Is Template</span>
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
              <AppButton :outline="true" color="secondary" @click="handleDeleteDraft(draft.id)"
                >Delete</AppButton
              >
              <AppButton color="primary" @click="handleContinueDraft(draft.id)">Continue</AppButton>
            </div>
          </td>
        </tr>
      </template>
    </tbody>
  </table>
  <div class="row justify-content-center">
    <div class="col-4 d-grid">
      <AppButton color="primary" @click="handleLoadMore">Load more</AppButton>
    </div>
  </div>
</template>
