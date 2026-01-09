<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import TransactionBrowserTable from './TransactionBrowserTable.vue';
import TransactionBrowserPage from './TransactionBrowserPage.vue';
import type { ITransactionBrowserItem } from './ITransactionBrowserItem.ts';
import AppCheckBox from '@renderer/components/ui/AppCheckBox.vue';
import AppButton from '@renderer/components/ui/AppButton.vue';

/* Props */
const props = defineProps<{
  items: ITransactionBrowserItem[];
}>();

/* State */
const isTabularDisplay = ref<boolean>(false);
const index = ref(0);

/* Watchers */
watch(
  () => props.items,
  () => {
    index.value = 0;
  },
  { immediate: true },
);

/* Handlers */
const handleNavigate = (targetIndex: number) => {
  isTabularDisplay.value = false;
  index.value = targetIndex;
};

onMounted(() => {
  console.log('items=' + JSON.stringify(props.items));
  console.log('index=' + index.value);
});
</script>

<template>
  <div class="d-flex align-items-center mb-3">
    <AppCheckBox v-model:checked="isTabularDisplay" name="Oxebo" label="Tabular" />
    <template v-if="!isTabularDisplay">
      <AppButton :disabled="index === 0" @click.prevent="index -= 1">Previous</AppButton>
      <AppButton :disabled="index === props.items.length - 1" @click.prevent="index += 1"
        >Next</AppButton
      >
    </template>
  </div>

  <template v-if="props.items.length > 1">
    <TransactionBrowserTable
      v-if="isTabularDisplay"
      :items="props.items"
      @navigate="handleNavigate"
    />
    <TransactionBrowserPage v-else :item="props.items[index]" />
  </template>
  <template v-if="props.items.length == 1">
    <TransactionBrowserPage :item="props.items[0]" />
  </template>
  <template>
    <span>No transactions to browser</span>
  </template>
</template>

<style scoped></style>
