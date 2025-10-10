<script setup lang="ts">
import useDateTimeSetting from '@renderer/composables/user/useDateTimeSetting.ts';

import type { SystemData, SystemDeleteData } from '@renderer/utils/sdk';

import { getMinimumExpirationTime, getMaximumExpirationTime } from '@renderer/utils';

import AppDatePicker from '@renderer/components/ui/AppDatePicker.vue';
import SystemDataFormData from '@renderer/components/Transaction/Create/SystemData/SystemDataFormData.vue';

/* Props */
const props = defineProps<{
  data: SystemDeleteData;
}>();

/* Emits */
const emit = defineEmits<{
  (event: 'update:data', data: SystemDeleteData): void;
}>();

/* Composables */
const { dateTimeSettingLabel } = useDateTimeSetting();

/* Handlers */
const handleSystemDataUpdate = (data: SystemData) => {
  emit('update:data', {
    ...props.data,
    ...data,
  });
};
</script>
<template>
  <SystemDataFormData :data="data" @update:data="handleSystemDataUpdate" required />

  <div class="row mt-6">
    <div class="form-group col-4 col-xxxl-3">
      <label class="form-label"
        >Expiration <span class="text-muted text-italic">{{ `- ${dateTimeSettingLabel}` }}</span>
        <span class="text-danger">*</span></label
      >
      <AppDatePicker
        :model-value="data.expirationTime ? data.expirationTime : undefined"
        @update:model-value="
          $emit('update:data', {
            ...data,
            expirationTime: $event,
          })
        "
        :minDate="getMinimumExpirationTime()"
        :maxDate="getMaximumExpirationTime()"
        clearable
        placeholder="Select Expiration Time"
        data-testid="input-expiration-time-for-file"
      />
    </div>
  </div>
</template>
