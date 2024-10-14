<script setup lang="ts">
import { ref } from 'vue';
import { onBeforeRouteLeave } from 'vue-router';

import { useRoute } from 'vue-router';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';

/* Props */
const props = defineProps<{
  skip?: boolean;
}>();

/* Composables */
const route = useRoute();

/* State */
const isAddToGroupModalShown = ref(false);

/* Emits */
const emit = defineEmits(['addToGroup']);

/* Handlers */
function handleAddToGroup() {
  emit('addToGroup');
}

/* Hooks */
onBeforeRouteLeave(async () => {
  if (route.query.group == 'true' && isAddToGroupModalShown.value == false && !props.skip) {
    isAddToGroupModalShown.value = true;
    return false;
  }
  return true;
});
</script>
<template>
  <AppModal
    :show="isAddToGroupModalShown"
    :close-on-click-outside="false"
    :close-on-escape="false"
    class="small-modal"
  >
    <form class="text-center p-4" @submit.prevent="handleAddToGroup">
      <div class="text-start">
        <i class="bi bi-x-lg cursor-pointer" @click="isAddToGroupModalShown = false"></i>
      </div>
      <h2 class="text-title text-semi-bold mt-3">Add To Group?</h2>

      <hr class="separator my-5" />

      <div class="flex-between-centered gap-4">
        <AppButton
          color="borderless"
          data-testid="button-discard-draft-for-group-modal"
          type="button"
          @click="$router.back()"
          >Discard</AppButton
        >
        <AppButton color="primary" data-testid="button-save-draft-modal" type="submit"
          >Add To Group</AppButton
        >
      </div>
    </form>
  </AppModal>
</template>
