<script setup lang="ts">
import { useFocus } from '@vueuse/core';
import { onMounted, shallowRef } from 'vue';

/* Models */
const searchText = defineModel<string>('searchText', { required: true });

/* Props */
const props = defineProps<{
  placeholder: string;
  autofocus?: boolean;
}>();

/* Emits */
const emit = defineEmits<{
  (event: 'blur'): void;
}>();

/* State */
const input = shallowRef<HTMLInputElement | null>(null);
const { focused } = useFocus(input);

/* Hooks */
onMounted(() => {
  if (props.autofocus ?? false) {
    focused.value = true;
  }
});
</script>

<template>
  <span class="search-field form-control is-fill">
    <i class="bi bi-search text-secondary"></i>
    <input
      type="search"
      class="form-control is-fill"
      ref="input"
      autocomplete="off"
      spellcheck="false"
      :placeholder="props.placeholder"
      v-model="searchText"
      @blur="emit('blur')"
    />
  </span>
</template>

<style scoped>
.search-field {
  display: inline-flex;
  align-items: center;
  border: none;
  border-radius: 23px;
  gap: 8px;
  width: 100%;
  max-width: 590px;
  padding: 0 10px;
}
.search-field:focus-within {
  background-color: var(--bs-input-fill-focus-bg-color);
}

.search-field input {
  padding: 0 0;
}
</style>
