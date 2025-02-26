<script setup lang="ts">
import useUserStore from '@renderer/stores/storeUser';
import { watchEffect } from 'vue';

const user = useUserStore();

watchEffect(() => {
  console.log(user.publicKeysNicknames);
});
</script>
<template>
  <div></div>
</template>
