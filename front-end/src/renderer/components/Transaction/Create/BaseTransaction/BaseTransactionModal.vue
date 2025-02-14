<script setup lang="ts">
import {
  FileAppendTransaction,
  FileCreateTransaction,
  FileUpdateTransaction,
  type Transaction,
} from '@hashgraph/sdk';

import { computed, ref } from 'vue';

import { onBeforeRouteLeave, useRouter, useRoute } from 'vue-router';

import useUserStore from '@renderer/stores/storeUser';
import { useToast } from 'vue-toast-notification';
import {
  addDraft,
  draftExists,
  getDraft,
  updateDraft,
} from '@renderer/services/transactionDraftsService';
import { getTransactionFromBytes, isUserLoggedIn } from '@renderer/utils';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';
import AppCustomIcon from '@renderer/components/ui/AppCustomIcon.vue';

/* Props */
const props = defineProps<{
  skip?: boolean;
  getTransaction: () => Transaction;
  description: string;
  hasDataChanged: boolean;
}>();

/* Stores */
const user = useUserStore();

/* Composables */
const router = useRouter();
const route = useRoute();
const toast = useToast();

/* State */
const isActionModalShown = ref(false);
const isDiscardFromScratch = ref(false);
const redirectPath = ref('');

/* Emits */
const emit = defineEmits<{
  (event: 'addToGroup', path: string): void;
  (event: 'editGroupItem', path: string): void;
}>();

/* Computed */
const isFromSingleTransaction = computed(() =>
  Boolean(route.query.draftId && route.query.group != 'true'),
);

const isFromScratch = computed(() => Boolean(!route.query.draftId && route.query.group !== 'true'));
const isFromScratchGroup = computed(() =>
  Boolean(!route.query.groupIndex && !props.skip && route.query.group === 'true'),
);

/* Handlers */
function handleAddToGroup() {
  emit('addToGroup', redirectPath.value);
}

function handleEditGroupItem() {
  emit('editGroupItem', redirectPath.value);
}

function getTransactionBytes() {
  if (!props.getTransaction) return;
  const transaction = props.getTransaction();
  if (
    transaction instanceof FileCreateTransaction ||
    transaction instanceof FileUpdateTransaction ||
    transaction instanceof FileAppendTransaction
  ) {
    //@ts-expect-error - contents should be null
    transaction.setContents(null);
  }
  return transaction.toBytes();
}

const handleSingleTransaction = async () => {
  if (!isUserLoggedIn(user.personal)) {
    throw new Error('User is not logged in');
  }
  const transactionBytes = getTransactionBytes();
  if (!transactionBytes) return;

  try {
    if (route.query.draftId) {
      const loadedDraft = await getDraft(route.query.draftId.toString());

      if (getTransactionFromBytes(loadedDraft.transactionBytes).toBytes() != transactionBytes) {
        await updateDraft(loadedDraft.id, {
          transactionBytes: transactionBytes.toString(),
          description: props.description,
        });
        toast.success('Draft updated');
        router.push(redirectPath.value);
      }
    } else {
      await sendAddDraft(user.personal.id, transactionBytes);
    }
  } catch (error) {
    console.log(error);
  }
};

async function sendAddDraft(userId: string, transactionBytes: Uint8Array) {
  await addDraft(userId, transactionBytes, props.description);
  router.push(redirectPath.value);
  toast.success('Draft saved');
}

async function handleDiscard() {
  if (isFromScratch.value || isFromScratchGroup.value) {
    isDiscardFromScratch.value = true;
  }
  await router.push(redirectPath.value);
}

function handleGroupAction() {
  if (!route.params.seq) {
    handleAddToGroup();
  } else {
    handleEditGroupItem();
  }
}

async function handleSubmit() {
  if (isFromSingleTransaction.value || isFromScratch.value) {
    return await handleSingleTransaction();
  }
  return handleGroupAction();
}

/* Hooks */
onBeforeRouteLeave(async to => {
  redirectPath.value = to.path;
  if (to.name?.toString().toLocaleLowerCase().includes('login')) return true;
  if (isDiscardFromScratch.value) return true;
  const transactionBytes = getTransactionBytes();
  if (!transactionBytes) return true;
  if ((await draftExists(transactionBytes)) && isFromScratch.value) {
    return true;
  }

  if (isFromScratchGroup.value) {
    isActionModalShown.value = true;
    return false;
  }

  if (!props.skip && isFromScratch.value && !(await draftExists(transactionBytes))) {
    isActionModalShown.value = true;
    return false;
  }

  if (!props.skip && isActionModalShown.value === false && props.hasDataChanged) {
    isActionModalShown.value = true;
    return false;
  }

  return true;
});
</script>
<template>
  <AppModal
    :show="isActionModalShown"
    :close-on-click-outside="false"
    :close-on-escape="false"
    class="small-modal"
  >
    <form class="text-center p-4" @submit.prevent="handleSubmit">
      <div class="text-start">
        <i class="bi bi-x-lg cursor-pointer" @click="isActionModalShown = false"></i>
      </div>
      <div>
        <AppCustomIcon :name="'lock'" style="height: 160px" />
      </div>
      <h2
        v-if="!route.params.seq && !route.query.draftId && !isFromScratch"
        class="text-title text-semi-bold mt-3"
      >
        Add To Group?
      </h2>
      <h2 v-else class="text-title text-semi-bold mt-3">Save Edits?</h2>
      <p class="text-small text-secondary mt-3">
        Pick up exactly where you left off, without compromising your flow or losing valuable time.
      </p>

      <hr class="separator my-5" />

      <div class="flex-between-centered gap-4">
        <AppButton
          color="borderless"
          data-testid="button-discard-draft-for-group-modal"
          type="button"
          @click="handleDiscard"
          >Discard</AppButton
        >
        <AppButton
          v-if="!route.params.seq && !route.query.draftId && !isFromScratch"
          color="primary"
          data-testid="button-save-draft-modal"
          type="submit"
          >Add To Group</AppButton
        >
        <AppButton v-else color="primary" data-testid="button-save-draft-modal" type="submit"
          >Save</AppButton
        >
      </div>
    </form>
  </AppModal>
</template>
