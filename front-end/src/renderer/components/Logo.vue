<script setup lang="ts">
const imageUrl = new URL(`../assets/logo.png`, import.meta.url).href;
</script>

<template>
  <img width="36" v-bind="$attrs" :src="imageUrl" alt="App logo" />
</template>
