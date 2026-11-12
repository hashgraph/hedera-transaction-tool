<script setup lang="ts">
import { ref, watch } from 'vue';

import { createRole, type ContractRole } from '@renderer/utils/sdk/contractRoles';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';

/* Props */
const props = defineProps<{
  show: boolean;
  role: ContractRole | null;
}>();

/* Emits */
const emit = defineEmits<{
  (event: 'update:show', show: boolean): void;
  (event: 'save', role: ContractRole): void;
}>();

/* State */
const name = ref('');
const note = ref('');

/* Watchers */
watch(
  () => [props.show, props.role] as const,
  ([show, role]) => {
    if (!show) {
      return;
    }
    name.value = role?.name || '';
    note.value = role?.note || '';
  },
  { immediate: true },
);

/* Handlers */
const handleShowUpdate = (show: boolean) => emit('update:show', show);

const handleSave = () => {
  if (name.value.trim().length === 0) {
    return;
  }

  const base = {
    name: name.value.trim(),
    note: note.value.trim().length > 0 ? note.value.trim() : undefined,
  };

  emit('save', props.role ? { ...props.role, ...base } : createRole(base));
  handleShowUpdate(false);
};
</script>
<template>
  <AppModal :show="show" @update:show="handleShowUpdate" class="medium-modal">
    <div class="p-4">
      <form @submit.prevent="handleSave">
        <div>
          <i class="bi bi-x-lg cursor-pointer" @click="handleShowUpdate(false)"></i>
        </div>
        <h1 class="text-title text-semi-bold text-center">
          {{ role ? 'Edit role' : 'Add role' }}
        </h1>
        <div class="mt-5">
          <label class="form-label">Role name</label>
          <AppInput v-model="name" filled data-testid="input-role-name" placeholder="SECURITY_ROLE" />
        </div>
        <div class="mt-4">
          <label class="form-label">Note</label>
          <AppInput
            v-model="note"
            filled
            data-testid="input-role-note"
            placeholder="Why this role matters"
          />
        </div>
        <hr class="separator my-5" />
        <div class="flex-between-centered gap-4">
          <AppButton color="borderless" type="button" @click="handleShowUpdate(false)"
            >Cancel</AppButton
          >
          <AppButton
            color="primary"
            data-testid="button-save-role"
            type="submit"
            :disabled="name.trim().length === 0"
            >Save</AppButton
          >
        </div>
      </form>
    </div>
  </AppModal>
</template>
