<script setup lang="ts">
import AppCustomIcon from '@renderer/components/ui/AppCustomIcon.vue';
import AppButton from '@renderer/components/ui/AppButton.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';

const show = defineModel<boolean>('show', { required: true });

/* Emits */
const emit = defineEmits(['revoke']);

/* Handlers */
function handleRevoke() {
  emit('revoke');
  show.value = false;
}
</script>
<template>
  <AppModal v-model:show="show" class="common-modal">
    <div class="p-4">
      <div class="text-center">
        <AppCustomIcon :name="'bin'" style="height: 160px" />
      </div>
      <h3 class="text-center text-title text-bold mt-3">Revoke Report Access</h3>
      <p class="text-center text-small text-secondary mt-4">
        This Contact will no longer be able to hold a reports API key. Any existing key they have
        will be revoked immediately.
      </p>
      <hr class="separator my-5" />
      <div class="row mt-4">
        <div class="col-6">
          <AppButton color="borderless" class="w-100" @click="show = false">Cancel</AppButton>
        </div>
        <div class="col-6 d-grid">
          <AppButton
            color="danger"
            data-testid="button-confirm-revoke-view-reports"
            @click="handleRevoke"
            >Revoke</AppButton
          >
        </div>
      </div>
    </div>
  </AppModal>
</template>
