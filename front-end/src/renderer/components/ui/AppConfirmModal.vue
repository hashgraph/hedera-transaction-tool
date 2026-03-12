<script lang="ts" setup>
import AppModal from '@renderer/components/ui/AppModal.vue';
import AppCustomIcon from '@renderer/components/ui/AppCustomIcon.vue';
import AppButton from '@renderer/components/ui/AppButton.vue';

/* Props */
const props = withDefaults(
  defineProps<{
    show?: boolean;
    title: string;
    text: string;
    callback?: ((...args: any[]) => void) | null;
    buttonText?: string;
    loadingText?: string;
    loading?: boolean;
  }>(),
  {
    show: false,
    callback: null,
    buttonText: 'Confirm',
    loadingText: '',
    loading: false,
  },
);

/* Emits */
const emit = defineEmits(['update:show']);

/* Handlers */
const handleConfirm = () => {
  if (props.loading) return;
  props.callback && props.callback();
};
const handleCancel = () => {
  if (props.loading) return;
  emit('update:show', false);
};
</script>
<template>
  <AppModal :show="props.show" :loading="props.loading" class="common-modal" @update:show="emit('update:show')">
    <div class="p-4">
      <i class="bi bi-x-lg d-inline-block cursor-pointer" :class="{ 'opacity-50 pointer-events-none': props.loading }" @click="handleCancel"></i>
      <div class="text-center">
        <AppCustomIcon :name="'questionMark'" style="height: 160px" />
      </div>
      <h3 class="text-center text-title text-bold mt-4">{{ props.title }}</h3>
      <p class="text-center text-small text-secondary mt-4">{{ props.text }}</p>
      <hr class="separator my-5" />
      <div class="flex-between-centered gap-4">
        <AppButton color="borderless" :disabled="props.loading" data-testid="button-modal-cancel" @click="handleCancel"
          >Cancel</AppButton
        >
        <AppButton color="primary" :loading="props.loading" :loading-text="props.loadingText" data-testid="button-modal-confirm" @click="handleConfirm"
          >{{ props.buttonText }}</AppButton
        >
      </div>
    </div>
  </AppModal>
</template>
