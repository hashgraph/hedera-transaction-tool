<script setup lang="ts">
import { ref } from 'vue';

import AutoLoginInOrganization from '@renderer/components/Organization/AutoLoginInOrganization.vue';
import AppUpdate from './components/AppUpdate.vue';
import ImportantNote from './components/ImportantNote.vue';
import DetectKeychain from './components/DetectKeychain.vue';

/* State */
const importantNoteReady = ref(false);
</script>

<template>
  <AppUpdate />
  <ImportantNote @ready="importantNoteReady = true" />

  <template v-if="importantNoteReady">
    <DetectKeychain />
    <AutoLoginInOrganization />
  </template>
</template>
