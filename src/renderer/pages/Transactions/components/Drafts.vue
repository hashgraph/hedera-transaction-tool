<script setup lang="ts">
import { computed, onBeforeMount, reactive, ref } from 'vue';

import { useRouter } from 'vue-router';

import { getDraft, getDrafts, removeDraft } from '@renderer/services/transactionDraftsService';

import { transactionTypeKeys } from '@renderer/pages/CreateTransaction/txTypeComponentMapping';

import AppButton from '@renderer/components/ui/AppButton.vue';

/* State */
const drafts = ref<{ id: string; type: string }[]>([]);
const sort = reactive<{ field: string; direction: 'asc' | 'desc' }>({
  field: 'timestamp',
  direction: 'asc',
});

const generatedClass = computed(() => {
  return sort.direction === 'desc' ? 'bi-arrow-down-short' : 'bi-arrow-up-short';
});

/* Composables */
const router = useRouter();

/* Handlers */
// TODO to be refactored
const handleSort = (field: string, direction: 'asc' | 'desc') => {
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
    case 'timestamp':
      drafts.value = drafts.value.sort((t1, t2) => {
        if (direction === 'asc') {
          return Number(t1.id) - Number(t2.id);
        } else if (direction === 'desc') {
          return Number(t2.id) - Number(t1.id);
        } else return 0;
      });
      break;
    default:
      break;
  }
};

const handleDeleteDraft = (id: string) => {
  removeDraft(id);
  drafts.value = getDrafts();
};

const handleContinueDraft = (id: string) => {
  const draft = getDraft(id);

  router.push({
    name: 'createTransaction',
    params: {
      type: transactionTypeKeys[
        draft?.type.replaceAll(' ', '') as keyof typeof transactionTypeKeys
      ],
    },
    query: {
      draftId: draft?.id,
    },
  });
};

/* Functions */
const getOpositeDirection = () => (sort.direction === 'asc' ? 'desc' : 'asc');

/* Hooks */
onBeforeMount(async () => {
  drafts.value = getDrafts();
});
</script>

<template>
  <table class="table-custom">
    <thead>
      <tr>
        <th class="w-10 text-end">#</th>
        <th>
          <div
            class="table-sort-link"
            @click="
              handleSort('timestamp', sort.field === 'timestamp' ? getOpositeDirection() : 'asc')
            "
          >
            <span>Date</span>
            <i
              v-if="sort.field === 'timestamp'"
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
              {{ new Date(Number(draft.id)).toLocaleString() }}
            </span>
          </td>
          <td>
            <span class="text-bold">{{ draft.type }}</span>
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
</template>
