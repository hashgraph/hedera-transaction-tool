<script setup lang="ts">
import AppCustomIcon from '@renderer/components/ui/AppCustomIcon.vue';
import AppButton from '@renderer/components/ui/AppButton.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';

/* Props */
const show = defineModel<boolean>('show', { required: true });

/* Emits */
const emit = defineEmits(['regenerate']);

/* Handlers */
function handleRegenerate() {
  emit('regenerate');
  show.value = false;
}
</script>
<template>
  <AppModal v-model:show="show" class="common-modal">
    <div class="p-4">
      <div class="text-center">
        <AppCustomIcon :name="'bin'" style="height: 160px" />
      </div>
      <h3 class="text-center text-title text-bold mt-3">Regenerate API Key</h3>
      <p class="text-center text-small text-secondary mt-4">
        Your current key will stop working immediately. Any third-party app using it will need
        the new key to keep working.
      </p>
      <hr class="separator my-5" />
      <div class="row mt-4">
        <div class="col-6">
          <AppButton color="borderless" class="w-100" @click="show = false">Cancel</AppButton>
        </div>
        <div class="col-6 d-grid">
          <AppButton
            color="primary"
            data-testid="button-confirm-regenerate-api-key"
            @click="handleRegenerate"
            >Regenerate</AppButton
          >
        </div>
      </div>
    </div>
  </AppModal>
</template>
