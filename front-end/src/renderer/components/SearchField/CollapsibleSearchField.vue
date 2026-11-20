<script setup lang="ts">
import { ref, watch } from 'vue';
import SearchField from './SearchField.vue';

/* Models */
const searchText = defineModel<string>('searchText', { required: true });

/* Props */
const props = defineProps<{
  placeholder: string;
}>();

/* State */
const collapsed = ref(true);

/* Handlers */
const expand = () => {
  collapsed.value = false;
};

/* Hooks */
watch(collapsed, () => {
  if (collapsed.value) {
    searchText.value = '';
  }
});
</script>

<template>
  <template v-if="collapsed">
    <span
      class="bi bi-search text-primary text-main cursor-pointer ms-1"
      data-testid="expand-search-field"
      @click="expand"
    ></span>
  </template>
  <template v-else>
    <SearchField
      v-model:searchText="searchText"
      :placeholder="props.placeholder"
      :autofocus="true"
      @blur="collapsed = true"
    />
  </template>
</template>

<style scoped></style>
