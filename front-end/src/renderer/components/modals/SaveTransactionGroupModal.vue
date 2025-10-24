<script setup lang="ts">
import { ref } from 'vue';

import { onBeforeRouteLeave, useRouter } from 'vue-router';

import useTransactionGroupStore from '@renderer/stores/storeTransactionGroup';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppCustomIcon from '@renderer/components/ui/AppCustomIcon.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';

/* Props */
const props = defineProps<{ saveTransactionGroup: () => void }>();

/* Stores */
const transactionGroup = useTransactionGroupStore();

/* Composables */
const router = useRouter();

/* State */
const show = ref(false);
const routeTo = ref<string | null>(null);

/* Handlers */
async function handleDiscard() {
  transactionGroup.clearGroup();
  await router.push(routeTo.value || '/transactions');
}

async function handleSaveGroup() {
  await props.saveTransactionGroup();
  await router.push(routeTo.value || '/transactions');
}

/* Hooks */
onBeforeRouteLeave(async to => {
  if (to.fullPath.startsWith('/create-transaction/')) {
    return true;
  }

  if (transactionGroup.isModified()) {
    show.value = true;
    routeTo.value = to.fullPath;
    return false;
  } else {
    transactionGroup.clearGroup();
  }

  return true;
});
</script>
<template>
  <AppModal
    v-if="show"
    v-model:show="show"
    :close-on-click-outside="false"
    :close-on-escape="false"
    class="small-modal"
  >
    <form class="text-center p-4" @submit.prevent="handleSaveGroup">
      <div class="text-start">
        <i class="bi bi-x-lg cursor-pointer" @click="show = false"></i>
      </div>
      <div>
        <AppCustomIcon :name="'lock'" style="height: 160px" />
      </div>
      <h2 class="text-title text-semi-bold mt-3">Save Group?</h2>
      <p class="text-small text-secondary mt-3">
        Pick up exactly where you left off, without compromising your flow or losing valuable time.
      </p>

      <hr class="separator my-5" />

      <div class="flex-between-centered gap-4">
        <AppButton
          color="borderless"
          data-testid="button-discard-group-modal"
          type="button"
          @click="handleDiscard"
          >Discard</AppButton
        >
        <AppButton color="primary" data-testid="button-save-draft-modal" type="submit"
          >Save</AppButton
        >
      </div>
    </form>
  </AppModal>
</template>
