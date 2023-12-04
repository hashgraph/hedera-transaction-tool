<script setup lang="ts">
import { computed, ref } from 'vue';

defineProps<{ word: string }>();

const isVisible = ref(false);

const inputType = computed(() => (isVisible.value ? 'text' : 'password'));

const handleVisibiltyChange = () => {
  isVisible.value = !isVisible.value;
};
</script>
<template>
  <div class="recovery-phrase-word-readonly position-relative">
    <input class="form-control rounded-4 border" :type="inputType" readonly :value="word" />
    <Transition name="fade" mode="out-in">
      <i v-if="!isVisible" class="bi bi-eye" @click="handleVisibiltyChange"></i>
      <i v-else class="bi bi-eye-slash" @click="handleVisibiltyChange"></i>
    </Transition>
  </div>
</template>
