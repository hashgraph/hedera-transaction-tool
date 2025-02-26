<script setup lang="ts">
import { computed, ref } from 'vue';

import useUserStore from '@renderer/stores/storeUser';

import { useToast } from 'vue-toast-notification';

import { getErrorMessage } from '@renderer/utils';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppCustomIcon from '@renderer/components/ui/AppCustomIcon.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';

/* Props */
const props = defineProps<{
  show: boolean;
  allSelected: boolean;
  selectedIds: string[];
  selectedSingleId: string | null;
}>();

/* Emits */
const emit = defineEmits<{
  (e: 'update:show', value: boolean): void;
  (e: 'update:selectedIds', value: string[]): void;
  (e: 'update:selectedSingleId', value: string | null): void;
}>();

/* Stores */
const user = useUserStore();

/* Composables */
const toast = useToast();

/* State */
const isDeletingKey = ref(false);

/* Computed */
const modalMessage = computed(() => {
  if (props.allSelected) {
    return 'You are about to delete all imported public key mappings. Do you wish to continue?';
  }

  return 'You are about to delete the selected public key mapping(s). Do you wish to continue?';
});

/* Handlers */
const handleDelete = async () => {
  const idsToDeleteArray = props.selectedSingleId ? [props.selectedSingleId] : props.selectedIds;
  try {
    isDeletingKey.value = true;

    if (idsToDeleteArray.length > 0) {
      for (const id of idsToDeleteArray) {
        try {
          await user.deletePublicKeyMapping(id);
        } catch (error) {
          toast.error(getErrorMessage(error, 'Unable to delete one or more public key mapping(s)'));
        }
      }
    }

    toast.success('Public key mapping(s) deleted successfully', { position: 'bottom-right' });
  } catch (error) {
    toast.error(getErrorMessage(error, 'Failed to delete public key mapping(s)'));
  } finally {
    resetSelection();
    isDeletingKey.value = false;
    emit('update:show', false);
  }
};

const handleCloseModal = () => {
  emit('update:show', false);
};

/* Functions */
function resetSelection() {
  emit('update:selectedIds', []);
  emit('update:selectedSingleId', null);
}
</script>
<template>
  <AppModal :show="show" @update:show="$emit('update:show', $event)" class="common-modal">
    <div class="p-5">
      <div>
        <i class="bi bi-x-lg cursor-pointer" @click="handleCloseModal"></i>
      </div>
      <div class="text-center">
        <AppCustomIcon :name="'bin'" style="height: 160px" />
      </div>
      <form @submit.prevent="handleDelete">
        <h3 class="text-center text-title text-bold mt-3">
          Delete key
          {{ selectedIds.length > 1 ? 'pairs' : 'pair' }}
        </h3>
        <p class="text-center mt-4">
          {{ modalMessage }}
        </p>
        <div class="d-grid mt-5">
          <AppButton
            type="submit"
            data-testid="button-delete-public-key-mapping"
            color="danger"
            :disabled="isDeletingKey"
            :loading="isDeletingKey"
            loading-text="Deleting..."
            >Delete</AppButton
          >
        </div>
      </form>
    </div>
  </AppModal>
</template>
