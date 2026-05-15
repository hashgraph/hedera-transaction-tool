<script setup lang="ts">
import { ActionStatus, type ActionReport } from './ActionReport.ts';
import AppModal from '@renderer/components/ui/AppModal.vue';
import AppCustomIcon, { type CustomIcon } from '@renderer/components/ui/AppCustomIcon.vue';
import { computed } from 'vue';
import AppButton from '@renderer/components/ui/AppButton.vue';

/* Props */
const props = defineProps<{
  report: ActionReport;
}>();
const show = defineModel<boolean>('show', { required: true });

/* Computed */
const customIcon = computed(() => {
  let result: CustomIcon;
  switch (props.report.status) {
    case ActionStatus.Success:
      result = 'success';
      break;
    case ActionStatus.Warning:
      result = 'questionMark'; // A dedicated icon would be better
      break;
    case ActionStatus.Error:
      result = 'error';
      break;
  }
  return result;
});
</script>

<template>
  <AppModal v-model:show="show" class="common-modal">
    <div class="p-4">
      <i class="bi bi-x-lg d-inline-block cursor-pointer" @click="show = false"></i>
      <div class="text-center">
        <AppCustomIcon :name="customIcon" style="height: 160px" />
      </div>
      <h3 class="text-center text-title text-bold mt-4">{{ props.report.title }}</h3>
      <p class="text-center text-small text-secondary mt-4">{{ props.report.what }}</p>
      <p v-if="props.report.why" class="text-center text-small text-body-tertiary mt-4">
        {{ props.report.why }}
      </p>
      <p v-if="props.report.next" class="text-center text-small text-secondary mt-4">
        {{ props.report.next }}
      </p>

      <hr class="separator my-5" />

      <div class="text-center gap-4">
        <AppButton color="primary" @click="show = false">Close</AppButton>
      </div>
    </div>
  </AppModal>
</template>
