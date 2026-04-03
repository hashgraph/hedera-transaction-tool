<script lang="ts" setup>
import { ref, watch } from 'vue';
import AppModal from '@renderer/components/ui/AppModal.vue';
import AppCustomIcon from '@renderer/components/ui/AppCustomIcon.vue';
import AppButton from '@renderer/components/ui/AppButton.vue';

/* Props */
const props = withDefaults(
  defineProps<{
    title: string;
    text: string;
    callback?: ((...args: any[]) => void) | null;
    buttonText?: string;
    loadingText?: string;
    loading?: boolean;
    cancel?: ((...args: any[]) => void) | null;
    dataTestid: string;
  }>(),
  {
    callback: null,
    buttonText: 'Confirm',
    loadingText: '',
    loading: false,
    cancel: null,
  },
);

/* Model */
const show = defineModel<boolean>('show', { required: true });

/* State */
const confirmed = ref(false);

/* Handlers */
const handleConfirm = () => {
  if (props.loading) return;
  confirmed.value = true;
  show.value = false;
};

const handleCancel = () => {
  if (props.loading) return;
  show.value = false;
};

/* Hooks */
watch(show, () => {
  if (!show.value) {
    const wasConfirmed = confirmed.value;
    confirmed.value = false;

    if (wasConfirmed && props.callback) {
      props.callback();
    } else if (!wasConfirmed && props.cancel) {
      props.cancel();
    }
  }
});
</script>
<template>
  <AppModal v-model:show="show" :loading="props.loading" class="common-modal">
    <div class="p-4">
      <i class="bi bi-x-lg d-inline-block cursor-pointer" :class="{ 'opacity-50 pointer-events-none': props.loading }" @click="handleCancel"></i>
      <div class="text-center">
        <AppCustomIcon :name="'questionMark'" style="height: 160px" />
      </div>
      <h3 class="text-center text-title text-bold mt-4">{{ props.title }}</h3>
      <p class="text-center text-small text-secondary mt-4">{{ props.text }}</p>
      <hr class="separator my-5" />
      <div class="flex-between-centered gap-4">
        <AppButton
          color="borderless"
          :disabled="props.loading"
          :data-testid="`${props.dataTestid}-cancel`"
          @click="handleCancel"
          >Cancel</AppButton
        >
        <AppButton
          color="primary"
          :loading="props.loading"
          :loading-text="props.loadingText"
          :data-testid="`${props.dataTestid}-confirm`"
          @click="handleConfirm"
          >{{ props.buttonText }}</AppButton
        >
      </div>
    </div>
  </AppModal>
</template>
