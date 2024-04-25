<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import AppInput from './AppInput.vue';

/* Props */
const props = defineProps<{
  items: string[];
  modelValue?: string | number;
  filled?: boolean;
  size?: 'small' | 'large' | undefined;
}>();

/* Emits */
const emit = defineEmits(['update:modelValue']);

/* State */
const hoveredIndex = ref<number>(-1);
const itemRefs = ref<HTMLElement[]>([]);

/* Computed */
const filteredItems = computed(() =>
  [...new Set<string>(props.items)].filter(item =>
    item.toLocaleLowerCase().includes((props.modelValue || '')?.toString().toLocaleLowerCase()),
  ),
);

const selectedIndex = computed(() =>
  filteredItems.value.indexOf(props.modelValue?.toString() || ''),
);

/* Handlers */
const handleKeyDown = (e: KeyboardEvent) => {
  const arrows = {
    ArrowUp: 'ArrowUp',
    ArrowDown: 'ArrowDown',
    Enter: 'Enter',
  };

  if (e.key === arrows.ArrowUp) {
    if (e.metaKey || e.ctrlKey) {
      hoveredIndex.value = 0;
    } else {
      hoveredIndex.value = Math.max(hoveredIndex.value - 1, 0);
    }
  } else if (e.key === arrows.ArrowDown) {
    if (e.metaKey || e.ctrlKey) {
      hoveredIndex.value = filteredItems.value.length - 1;
    } else {
      hoveredIndex.value = Math.min(hoveredIndex.value + 1, filteredItems.value.length - 1);
    }
  } else if (e.key === arrows.Enter) {
    emit('update:modelValue', filteredItems.value[hoveredIndex.value]);
  }

  if (e.key === arrows.ArrowUp || e.key === arrows.ArrowDown) {
    nextTick(() => {
      itemRefs.value[hoveredIndex.value]?.scrollIntoView({
        block: 'nearest',
      });
    });
  }
};
</script>

<template>
  <div>
    <AppInput
      :model-value="modelValue"
      @update:model-value="$emit('update:modelValue', $event)"
      :filled="filled"
      :size="size"
      v-bind="$attrs"
      @keydown="handleKeyDown"
    />
    <div v-if="filteredItems.length > 0" class="autocomplete-custom w-100">
      <div>
        <template v-for="(item, i) in filteredItems" :key="item">
          <div
            class="autocomplete-item-custom"
            :class="{
              selected: i === selectedIndex || i === hoveredIndex,
            }"
            @click="$emit('update:modelValue', item)"
            ref="itemRefs"
          >
            {{ item }}
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
