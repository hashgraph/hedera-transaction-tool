<script setup lang="ts">
import AppButton from '@renderer/components/ui/AppButton.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';
import AppCustomIcon from '@renderer/components/ui/AppCustomIcon.vue';

/* Props */
defineProps<{
  show: boolean;
  accountId: string;
}>();

/* Emits */
defineEmits<{
  (event: 'update:show', value: boolean): void;
  (event: 'confirm', value: boolean): void;
}>();
</script>
<template>
  <AppModal
    v-if="show"
    class="common-modal"
    :show="show"
    @update:show="$emit('update:show', $event)"
    :close-on-click-outside="false"
    :close-on-escape="false"
  >
    <div class="p-5">
      <div>
        <i class="bi bi-x-lg cursor-pointer" @click="$emit('update:show', false)"></i>
      </div>
      <div class="text-center">
        <AppCustomIcon :name="'error'" style="height: 160px" />
      </div>
      <h3 class="text-center text-title text-bold mt-4">
        Are you sure you want to delete the account
        <span class="text-secondary">{{ accountId }}</span> ?
      </h3>
      <p class="text-center text-small text-secondary mt-3">
        Deleting this account will permanently remove it from the network. The account cannot be
        restored once deleted.
      </p>

      <hr class="separator my-5" />

      <div class="flex-between-centered gap-4">
        <AppButton
          color="borderless"
          @click="
            $emit('update:show', false);
            $emit('confirm', false);
          "
          >Cancel</AppButton
        >
        <AppButton
          type="button"
          color="primary"
          data-testid="button-confirm-delete-account"
          @click="
            $emit('update:show', false);
            $emit('confirm', true);
          "
          >Confirm</AppButton
        >
      </div>
    </div>
  </AppModal>
</template>
