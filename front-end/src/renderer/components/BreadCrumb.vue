<script lang="ts" setup>
import useNextTransactionV2 from '@renderer/stores/storeNextTransactionV2.ts';
import { computed } from 'vue';
import { useRouter } from 'vue-router';

const TRUNCATE_ITEMS = 50;
const SEPARATOR = '→';

const props = defineProps<{
  leaf?: string;
}>();

/* Composables */
const router = useRouter();

/* Stores */
const nextTransaction = useNextTransactionV2();

/* Computed */
const items = computed(() => {
  return nextTransaction.contextStack.map(item => truncate(item));
});

/* Handlers */
const handleClick = (index: number) => {
  const nbLevelsUp = items.value.length - index;
  nextTransaction.routeUp(router, nbLevelsUp);
};

/* Functions */
const truncate = (item: string) => {
  return item.length > TRUNCATE_ITEMS ? item.slice(0, TRUNCATE_ITEMS) + '…' : item;
};
</script>

<template>
  <nav class="d-flex align-items-center gap-2">
    <template v-for="(item, index) in items" :key="item">
      <a
        :data-testid="`breadcrumb-item-${index}`"
        class="path-item"
        href="#"
        @click="handleClick(index)"
        >{{ item }}</a
      >
      <span v-if="index < items.length - 1 || props.leaf" class="item-separator">{{
        SEPARATOR
      }}</span>
    </template>
    <h2
      :data-testid="`breadcrumb-item-${items.length}`"
      v-if="props.leaf"
      class="text-title text-bold ws-no-wrap"
    >
      {{ props.leaf }}
    </h2>
  </nav>
</template>

<style scoped>
a.path-item {
  text-decoration: none;
}

a.path-item:hover {
  opacity: 0.7;
}

a.path-item:active {
  opacity: 0.5;
}

.item-separator {
  color: var(--bs-breadcrumb-divider-color);
}
</style>
