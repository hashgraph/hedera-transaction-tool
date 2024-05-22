<script setup lang="ts">
import { ref } from 'vue';

import AppModalLoader from '@renderer/components/ui/AppModalLoader.vue';

/* State */
const show = ref(false);

/* Functions */
function open() {
  show.value = true;
}

function close() {
  show.value = false;
}

/* Exposes */
defineExpose({
  open,
  close,
});
</script>
<template>
  <div>
    <AppModalLoader v-model:show="show" :close-on-click-outside="false" :close-on-escape="false" />
  </div>
</template>
