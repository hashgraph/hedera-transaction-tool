<script setup lang="ts">
import { ref } from 'vue';

import { onBeforeRouteLeave, useRouter, useRoute } from 'vue-router';

import useTransactionGroupStore from '@renderer/stores/storeTransactionGroup';

import { redirectToPrevious } from '@renderer/utils';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';

/* Props */
const props = defineProps<{
  skip?: boolean;
}>();

/* Stores */
const transactionGroup = useTransactionGroupStore();

/* Composables */
const router = useRouter();
const route = useRoute();

/* State */
const isGroupActionModalShown = ref(false);

/* Emits */
const emit = defineEmits(['addToGroup', 'editItem']);

/* Handlers */
function handleAddToGroup() {
  emit('addToGroup');
}

function handleEditItem() {
  emit('editItem');
}

function handleDiscard() {
  if (router.previousPath !== '/create-transaction-group') {
    transactionGroup.clearGroup();
  }
  redirectToPrevious(router, '/transactions');
}

function handleGroupAction() {
  if (!route.params.seq) {
    handleAddToGroup();
  } else {
    handleEditItem();
  }
}

/* Hooks */
onBeforeRouteLeave(async to => {
  if (route.query.group == 'true' && isGroupActionModalShown.value == false && !props.skip) {
    isGroupActionModalShown.value = true;
    router.previousPath = to.path;
    return false;
  }
  return true;
});
</script>
<template>
  <AppModal
    :show="isGroupActionModalShown"
    :close-on-click-outside="false"
    :close-on-escape="false"
    class="small-modal"
  >
    <form class="text-center p-4" @submit.prevent="handleGroupAction">
      <div class="text-start">
        <i class="bi bi-x-lg cursor-pointer" @click="isGroupActionModalShown = false"></i>
      </div>
      <h2 v-if="!route.params.seq" class="text-title text-semi-bold mt-3">Add To Group?</h2>
      <h2 v-else class="text-title text-semi-bold mt-3">Save Edits?</h2>

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
          v-if="!route.params.seq"
          color="primary"
          data-testid="button-save-draft-modal"
          type="submit"
          >Add To Group</AppButton
        >
        <AppButton v-else color="primary" data-testid="button-save-draft-modal" type="submit"
          >Save Edits</AppButton
        >
      </div>
    </form>
  </AppModal>
</template>
