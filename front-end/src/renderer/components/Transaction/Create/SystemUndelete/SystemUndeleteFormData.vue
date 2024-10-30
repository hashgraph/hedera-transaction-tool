<script setup lang="ts">
import type { SystemData, SystemUndeleteData } from '@renderer/utils/sdk';

import SystemDataFormData from '@renderer/components/Transaction/Create/SystemData/SystemDataFormData.vue';

/* Props */
const props = defineProps<{
  data: SystemUndeleteData;
}>();

/* Emits */
const emit = defineEmits<{
  (event: 'update:data', data: SystemUndeleteData): void;
}>();

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
</template>
