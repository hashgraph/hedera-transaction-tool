<script setup lang="ts">
import type { TransactionGroup } from '@prisma/client';

import { computed, onBeforeMount, reactive, ref, watch } from 'vue';

import { Prisma } from '@prisma/client';

import { useRouter } from 'vue-router';
import { useToast } from 'vue-toast-notification';
import useUserStore from '@renderer/stores/storeUser';

import { isUserLoggedIn } from '@renderer/utils';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppLoader from '@renderer/components/ui/AppLoader.vue';
import AppPager from '@renderer/components/ui/AppPager.vue';
import {
  getGroup,
  getGroups,
  getGroupsCount,
  deleteGroup,
} from '@renderer/services/transactionGroupsService';
import EmptyTransactionGroup from '@renderer/components/EmptyTransactionGroup.vue';
import DateTimeString from '@renderer/components/ui/DateTimeString.vue';
import { successToastOptions } from '@renderer/utils/toastOptions.ts';

/* Store */
const user = useUserStore();

/* State */
const groups = ref<TransactionGroup[]>([]);
const sort = reactive<{
  field: Prisma.TransactionGroupScalarFieldEnum;
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
  field: Prisma.TransactionGroupScalarFieldEnum,
  direction: Prisma.SortOrder,
) => {
  sort.field = field;
  sort.direction = direction;
  groups.value = await getGroups(createFindArgs());
};

// const handleUpdateIsTemplate = async (e: Event, id: string) => {
//   const checkbox = e.currentTarget as HTMLInputElement | null;

//   if (checkbox) {
//     await updateDraft(id, { isTemplate: checkbox.checked });
//   }
// };

const handleDeleteGroup = async (id: string) => {
  await deleteGroup(id);

  await fetchGroups();

  toast.success('Group successfully deleted', successToastOptions);
};

const handleContinueGroup = async (id: string) => {
  const group = await getGroup(id);

  await router.push({
    name: 'createTransactionGroup',
    query: {
      id: group?.id,
    },
  });
};

/* Functions */
function getOpositeDirection() {
  return sort.direction === 'asc' ? 'desc' : 'asc';
}

function createFindArgs(): Prisma.TransactionGroupFindManyArgs {
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
    orderBy: {
      [sort.field]: sort.direction,
    },
    skip: (currentPage.value - 1) * pageSize.value,
    take: pageSize.value,
  };
}

async function fetchGroups() {
  if (!isUserLoggedIn(user.personal)) {
    throw new Error('User is not logged in');
  }

  isLoading.value = true;
  try {
    totalItems.value = await getGroupsCount(user.personal.id);
    groups.value = await getGroups(createFindArgs());
    await handleSort(sort.field, sort.direction);
  } finally {
    isLoading.value = false;
  }
}

/* Hooks */
onBeforeMount(async () => {
  await fetchGroups();
});

/* Watchers */
watch([currentPage, pageSize], async () => {
  await fetchGroups();
});
</script>

<template>
  <div class="fill-remaining overflow-x-auto">
    <template v-if="isLoading">
      <AppLoader />
    </template>
    <template v-else>
      <template v-if="groups.length > 0">
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
                <span>Name</span>
              </th>
              <th class="text-center">
                <span>Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            <template v-for="(group, i) in groups" :key="group.id">
              <tr>
                <td>{{ i + 1 }}</td>
                <td>
                  <span class="text-secondary">
                    <DateTimeString :date="group.created_at" :extended="false" />
                  </span>
                </td>
                <td>
                  <span class="text-bold">{{ group?.description }}</span>
                </td>
                <!-- <td class="text-center">
                  <input
                    class="form-check-input"
                    type="checkbox"
                    :checked="Boolean(draft.isTemplate)"
                    @change="e => handleUpdateIsTemplate(e, draft.id)"
                  />
                </td> -->
                <td class="text-center">
                  <div class="d-flex justify-content-center flex-wrap gap-3">
                    <AppButton color="borderless" @click="handleDeleteGroup(group.id)"
                      >Delete</AppButton
                    >
                    <AppButton color="secondary" @click="handleContinueGroup(group.id)"
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
        <EmptyTransactionGroup class="absolute-centered w-100" />
      </template>
    </template>
  </div>
</template>
