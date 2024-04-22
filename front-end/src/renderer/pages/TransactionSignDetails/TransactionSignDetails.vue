<script setup lang="ts">
import { onBeforeMount } from 'vue';
import { useRoute } from 'vue-router';

/* Composables */
const route = useRoute();

/* Hooks */
onBeforeMount(async () => {
  console.log(route.params.id);
});
</script>
<template>
  <div>Hello guy</div>
</template>
