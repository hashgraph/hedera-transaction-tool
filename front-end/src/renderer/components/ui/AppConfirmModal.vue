<script lang="ts" setup>
import AppModal from '@renderer/components/ui/AppModal.vue';
import AppCustomIcon from '@renderer/components/ui/AppCustomIcon.vue';
import AppButton from '@renderer/components/ui/AppButton.vue';

/* Props */
const props = withDefaults(
  defineProps<{
    show: boolean;
    title: string;
    text: string;
    callback?: ((...args: any[]) => void) | null;
  }>(),
  {
    callback: null,
  },
);

/* Emits */
const emit = defineEmits(['update:show']);

/* Handlers */
const handleConfirm = () => {
  emit('update:show', false);
  props.callback && props.callback();
};
const handleCancel = () => {
  emit('update:show', false);
};
</script>
<template>
  <AppModal :show="show" class="common-modal" @update:show="emit('update:show')">
    <div class="p-4">
      <i class="bi bi-x-lg d-inline-block cursor-pointer" @click="handleCancel"></i>
      <div class="text-center">
        <AppCustomIcon :name="'questionMark'" style="height: 160px" />
      </div>
      <h3 class="text-center text-title text-bold mt-4">{{ props.title }}</h3>
      <p class="text-center text-small text-secondary mt-4">{{ props.text }}</p>
      <hr class="separator my-5" />
      <div class="flex-between-centered gap-4">
        <AppButton color="borderless" data-testid="button-cancel-group-action" @click="handleCancel"
          >Cancel</AppButton
        >
        <AppButton color="primary" data-testid="button-confirm-group-action" @click="handleConfirm"
          >Confirm</AppButton
        >
      </div>
    </div>
  </AppModal>
</template>
