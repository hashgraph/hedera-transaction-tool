<script setup lang="ts">
import { ref } from 'vue';

import AutoLoginInOrganization from '@renderer/components/Organization/AutoLoginInOrganization.vue';
import AppUpdate from './components/AppUpdate.vue';
import ImportantNote from './components/ImportantNote.vue';

/* State */
const importantNoteAccepted = ref(false);
</script>

<template>
  <ImportantNote @accept="importantNoteAccepted = true" />
  <template v-if="importantNoteAccepted">
    <AutoLoginInOrganization />
    <AppUpdate />
  </template>
</template>
