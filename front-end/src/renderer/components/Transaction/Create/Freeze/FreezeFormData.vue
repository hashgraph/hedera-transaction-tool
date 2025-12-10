<script setup lang="ts">
import useDateTimeSetting from '@renderer/composables/user/useDateTimeSetting.ts';

import type { FreezeData } from '@renderer/utils/sdk';

import { formatAccountId } from '@renderer/utils';

import AppInput from '@renderer/components/ui/AppInput.vue';
import RunningClockDatePicker from '@renderer/components/RunningClockDatePicker.vue';
import { computed } from 'vue';

/* Props */
const props = defineProps<{
  data: FreezeData;
}>();

/* Emits */
const emit = defineEmits<{
  (event: 'update:data', data: FreezeData): void;
}>();

/* Composables */
const { dateTimeSettingLabel } = useDateTimeSetting();

/* Computed */
const isStartTimeRequired = computed(() => props.data.freezeType === 1 || props.data.freezeType === 3)
const isFileInfoRequired = computed(() => props.data.freezeType === 2 || props.data.freezeType === 3);

/* Handlers */
function handleOnBlur() {
  emit('update:data', { ...props.data, fileId: formatAccountId(props.data.fileId) });
}

/* Misc */
const columnClass = 'col-4 col-xxxl-3';
</script>
<template>
  <div class="row">
    <div :class="[columnClass]">
      <label class="form-label">Freeze Type<span class="text-danger">*</span></label>
      <select
        class="form-select is-fill"
        :value="data.freezeType"
        @change="
          $emit('update:data', {
            ...data,
            freezeType: Number(($event.target as HTMLSelectElement).value),
          })
        "
      >
        <!-- <option value="0">Unknown Freeze Type</option> -->
        <option value="-1">Select Freeze Type</option>
        <option value="1">Freeze Only</option>
        <option value="2">Prepare Upgrade</option>
        <option value="3">Freeze Upgrade</option>
        <option value="4">Freeze Abort</option>
        <!-- <option value="5">Telemetry Upgrade</option> -->
      </select>
    </div>
  </div>

  <div
    v-if="isStartTimeRequired"
    class="row align-items-end mt-6"
  >
    <div class="form-group" :class="[columnClass]">
      <label class="form-label"
        >Start <span class="text-muted text-italic">{{ `- ${dateTimeSettingLabel}` }}</span
        ><span class="text-danger">*</span></label
      >
      <RunningClockDatePicker
        :model-value="data.startTimestamp"
        @update:model-value="
          $emit('update:data', {
            ...data,
            startTimestamp: $event,
          })
        "
        placeholder="Select Start Time"
        :min-date="new Date()"
        :now-button-visible="true"
      />
    </div>
  </div>

  <div v-if="isFileInfoRequired" class="row align-items-end mt-6">
    <div class="form-group" :class="[columnClass]">
      <label class="form-label">File ID<span class="text-danger">*</span></label>
      <AppInput
        :model-value="data.fileId"
        @update:model-value="
          $emit('update:data', {
            ...data,
            fileId: $event,
          })
        "
        @blur="handleOnBlur"
        :filled="true"
        placeholder="Enter File ID"
      />
    </div>
  </div>

  <div v-if="isFileInfoRequired" class="row align-items-end mt-6">
    <div class="form-group col-8 col-xxxl-6">
      <label class="form-label">File Hash<span class="text-danger">*</span></label>
      <AppInput
        :model-value="data.fileHash"
        @update:model-value="
          $emit('update:data', {
            ...data,
            fileHash: $event,
          })
        "
        :filled="true"
        placeholder="Enter File Hash"
      />
    </div>
  </div>
</template>
