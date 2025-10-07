<script lang="ts" setup>
import type { DateTimeOptions } from '@renderer/utils';

import { onBeforeMount, ref } from 'vue';
import useDateTimeSetting from '@renderer/composables/user/useDateTimeSetting.ts';
import AppSelect from '@renderer/components/ui/AppSelect.vue';

/* Composables */
const { DATE_TIME_OPTIONS, getDateTimeSetting, setDateTimeSetting } = useDateTimeSetting();

/* State */
const currentSetting = ref<DateTimeOptions>();

const handleUpdateSetting = async (selection: DateTimeOptions | undefined) => {
  if (selection) {
    await setDateTimeSetting(selection);
    currentSetting.value = selection;
  }
};

/* Hooks */
onBeforeMount(async () => {
  currentSetting.value = await getDateTimeSetting();
});
</script>

<template>
  <div class="mt-4">
    <div class="col-sm-5 col-lg-4">
      <label class="form-label me-3">Date/Time Format</label>
      <AppSelect
        :color="'secondary'"
        :items="DATE_TIME_OPTIONS"
        :value="currentSetting"
        button-class="w-100"
        toggle-text="Select Format"
        toggler-icon
        @update:value="handleUpdateSetting"
      />
    </div>
  </div>
</template>
