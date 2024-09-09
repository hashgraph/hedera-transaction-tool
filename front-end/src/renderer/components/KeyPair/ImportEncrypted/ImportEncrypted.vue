<script setup lang="ts">
import { ref } from 'vue';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';
import SelectFolderModal from '@renderer/components/KeyPair/ImportEncrypted/components/SelectFolderModal.vue';

/* State */
const isSelectFolderModalShown = ref(false);

/* Functions */
function process() {
  reset();

  isSelectFolderModalShown.value = true;
}

function reset() {
  isSelectFolderModalShown.value = false;
}

/* Expose */
defineExpose({ process });
</script>
<template>
  <div>
    <!-- Step #1: Select zip/folder -->
    <SelectFolderModal v-model:show="isSelectFolderModalShown" />
  </div>
</template>
