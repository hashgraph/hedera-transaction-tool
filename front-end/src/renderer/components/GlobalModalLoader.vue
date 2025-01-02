<script setup lang="ts">
import { ref } from 'vue';

import AppModalLoader from '@renderer/components/ui/AppModalLoader.vue';

/* State */
const show = ref(false);
const showBackground = ref(true);

/* Functions */
function open(background: boolean = true) {
  showBackground.value = background;
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
    <template v-if="show && showBackground">
      <div
        class="position-fixed min-vw-100 h-100 container-main-bg"
        :style="{ top: 0, left: 0 }"
      ></div>
    </template>
  </div>
</template>
