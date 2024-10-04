<script setup lang="ts">
import { ref } from 'vue';
import AppButton from '@renderer/components/ui/AppButton.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';

/* State */
const show = ref(false);

/* Emits */
const emit = defineEmits(['response']);

/* Handlers */
const handleYes = () => {
  emit('response', true);
  show.value = false;
};

const handleNo = () => {
  emit('response', false);
  show.value = false;
};

const openModal = () => {
  show.value = true;
};
</script>

<template>
  <AppModal :show="show" class="common-modal" :close-on-click-outside="false" :close-on-escape="false">
    <div class="p-5">
      <div>
        <i class="bi bi-x-lg cursor-pointer" @click="handleNo"></i>
      </div>
      <div class="text-center">
        <h3 class="text-title text-bold">TransactionTools folder was found.</h3>
        <p class="text-small text-secondary mt-4">Do you want to migrate the data?</p>
      </div>
      <div class="flex-between-centered gap-4 mt-5">
        <AppButton color="borderless" @click="handleNo">No</AppButton>
        <AppButton color="primary" @click="handleYes">Yes</AppButton>
      </div>
    </div>
  </AppModal>
</template>
