<script setup lang="ts">
import AppCustomIcon from '@renderer/components/ui/AppCustomIcon.vue';
import AppButton from '@renderer/components/ui/AppButton.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';

/* Props */
const show = defineModel<boolean>('show', { required: true });

/* Emits */
const emit = defineEmits(['elevate']);

/* Handlers */
function handleElevate() {
  emit('elevate');
  show.value = false;
}
</script>
<template>
  <AppModal v-model:show="show" class="common-modal">
    <div class="p-4">
      <div class="text-center">
        <AppCustomIcon :name="'bin'" style="height: 160px" />
      </div>
      <h3 class="text-center text-title text-bold mt-3">Elevate Contact to Admin</h3>
      <p class="text-center text-small text-secondary mt-4">
        Are you sure you want to elevate this Contact from to an admin?
      </p>
      <hr class="separator my-5" />
      <div class="row mt-4">
        <div class="col-6">
          <AppButton color="borderless" class="w-100" @click="show = false">Cancel</AppButton>
        </div>
        <div class="col-6 d-grid">
          <AppButton
            color="primary"
            data-testid="button-confirm-removing-contact"
            @click="handleElevate"
            >Elevate</AppButton
          >
        </div>
      </div>
    </div>
  </AppModal>
</template>
