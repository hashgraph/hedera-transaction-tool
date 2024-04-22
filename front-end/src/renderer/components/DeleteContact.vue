<script setup lang="ts">
import { ref, watch } from 'vue';
import AppModal from '@renderer/components/ui/AppModal.vue';
import AppCustomIcon from './ui/AppCustomIcon.vue';
import AppButton from './ui/AppButton.vue';

const props = defineProps<{
  show: boolean;
}>();

const emit = defineEmits(['update:show', 'update:delete']);

const show = ref(props.show);

watch(
  () => props.show,
  value => {
    show.value = value;
  },
);

async function handleDeleteAccount() {
  emit('update:delete');
  emit('update:show', false);
}
</script>
<template>
  <AppModal v-model:show="show" class="common-modal">
    <div class="modal-body">
      <div class="text-center">
        <AppCustomIcon :name="'bin'" style="height: 160px" />
      </div>
      <h3 class="text-center text-title text-bold mt-3">Delete Contact</h3>
      <p class="text-center text-small text-secondary mt-4">
        Are you sure you want to remove this Contact from your Contact list?
      </p>
      <hr class="separator my-5" />
      <div class="row mt-4">
        <div class="col-6">
          <AppButton color="primary" outline class="w-100" @click="emit('update:show', false)"
            >Cancel</AppButton
          >
        </div>
        <div class="col-6">
          <AppButton
            :outline="true"
            color="primary"
            class="w-100"
            style="color: red; border-color: red"
            @click="handleDeleteAccount"
            >Remove</AppButton
          >
        </div>
      </div>
    </div>
  </AppModal>
</template>
