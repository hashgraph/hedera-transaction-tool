<script setup lang="ts">
import AppButton from '@renderer/components/ui/AppButton.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';
import AppCustomIcon from '@renderer/components/ui/AppCustomIcon.vue';

type Choice = 'select' | 'add';

/* Props */
defineProps<{
  show: boolean;
}>();

/* Emits */
const emit = defineEmits<{
  (event: 'update:show', show: boolean): void;
  (event: 'onSelected', value: Choice): void;
}>();

/* Handlers */
const handleChoose = (e: Event) => {
  if (
    e instanceof SubmitEvent &&
    e.submitter instanceof HTMLButtonElement &&
    isChoice(e.submitter.value)
  ) {
    emit('update:show', false);
    emit('onSelected', e.submitter.value);
  }
};

/* Functions */
function isChoice(value: string): value is Choice {
  const options: Choice[] = ['select', 'add'];
  return options.includes(value as Choice);
}
</script>
<template>
  <AppModal
    :show="show"
    :close-on-click-outside="false"
    :close-on-escape="false"
    class="common-modal"
  >
    <form class="p-4" @submit.prevent="handleChoose">
      <div class="text-start">
        <i class="bi bi-x-lg cursor-pointer" @click="$emit('update:show', false)"></i>
      </div>
      <div class="text-center">
        <AppCustomIcon :name="'group'" style="height: 160px" />
      </div>
      <h2 class="text-center text-title text-semi-bold mt-3">Organization</h2>
      <p class="text-center text-small text-secondary mt-3">
        Select Already Added or Add a New One
      </p>

      <hr class="separator my-5" />

      <div class="flex-between-centered gap-4">
        <AppButton color="primary" type="submit" value="select">Select</AppButton>
        <AppButton color="secondary" type="submit" value="add">Add</AppButton>
      </div>
    </form>
  </AppModal>
</template>
