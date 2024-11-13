<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import AppInput from './AppInput.vue';

/* Props */
const props = defineProps<{
  items: string[];
  modelValue?: string | number;
  filled?: boolean;
  size?: 'small' | 'large' | undefined;
  dataTestid?: string;
}>();

/* Emits */
const emit = defineEmits(['update:modelValue']);

/* State */
const inputRef = ref<InstanceType<typeof AppInput> | null>(null);
const dropdownRef = ref<HTMLDivElement | null>(null);
const hoveredIndex = ref<number>(-1);
const itemRefs = ref<HTMLElement[]>([]);

/* Computed */
const normalizedItems = computed(() => [...new Set<string>(props.items)]);

const selectedIndex = computed(() =>
  normalizedItems.value.indexOf(props.modelValue?.toString() || ''),
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
      hoveredIndex.value = normalizedItems.value.length - 1;
    } else {
      hoveredIndex.value = Math.min(hoveredIndex.value + 1, normalizedItems.value.length - 1);
    }
  } else if (e.key === arrows.Enter) {
    emit('update:modelValue', normalizedItems.value[hoveredIndex.value]);
  }

  if (e.key === arrows.ArrowUp || e.key === arrows.ArrowDown) {
    nextTick(() => {
      itemRefs.value[hoveredIndex.value]?.scrollIntoView({
        block: 'nearest',
      });
    });
  }
};

const handleUpdate = (value: string) => {
  emit('update:modelValue', value);
};

const handleSelectItem = (event: Event, item: string) => {
  event.stopPropagation();

  handleUpdate(item);
  toggleDropdown(false);
};

const handleInputClick = () => {
  toggleDropdown(true);
};

const handleResize = () => {
  if (!inputRef.value?.inputRef || !dropdownRef.value) return;
  dropdownRef.value.style.width = `${inputRef.value.inputRef.offsetWidth}px`;
};

const handleWindowClick = (e: Event) => {
  if (!dropdownRef.value) return;
  if (!inputRef.value?.inputRef) return;

  const target = e.target as HTMLElement;
  if (inputRef.value.inputRef.contains(target) || dropdownRef.value.contains(target)) return;

  toggleDropdown(false);
};

const handleMove = () => {
  if (!inputRef.value?.inputRef || !dropdownRef.value) return;

  const inputRect = inputRef.value?.inputRef.getBoundingClientRect();
  if (!inputRect || !dropdownRef.value) return;

  dropdownRef.value.style.top = `${inputRect.bottom}px`;
  dropdownRef.value.style.left = `${inputRect.left}px`;
  dropdownRef.value.style.width = `${inputRect.width}px`;
};

/* Functions */
function toggleDropdown(show: boolean) {
  if (!dropdownRef.value) return;

  const newVisibility = show ? 'visible' : 'hidden';
  const newOpacity = show ? '1' : '0';

  if (dropdownRef.value.style.visibility === newVisibility) return;
  if (dropdownRef.value.style.opacity === newOpacity) return;

  dropdownRef.value.style.visibility = newVisibility;
  dropdownRef.value.style.opacity = newOpacity;
}

/* Hooks */
onMounted(() => {
  setTimeout(() => {
    handleResize();
  }, 100);

  window.addEventListener('resize', handleResize);
  window.addEventListener('click', handleWindowClick);
  document.addEventListener('scroll', handleMove, true);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize);
  window.removeEventListener('click', handleWindowClick);
  document.removeEventListener('scroll', handleMove, true);
});
</script>

<template>
  <div @click="handleInputClick" @blur="toggleDropdown(false)">
    <AppInput
      ref="inputRef"
      :model-value="modelValue"
      @update:model-value="handleUpdate($event)"
      @keydown="handleKeyDown"
      :filled="filled"
      :size="size"
      :data-testid="dataTestid"
      v-bind="$attrs"
    />
    <div
      ref="dropdownRef"
      class="autocomplete-custom"
      :class="{ 'd-none': normalizedItems.length === 0 }"
    >
      <div>
        <template v-for="(item, i) in normalizedItems" :key="item">
          <div
            class="autocomplete-item-custom"
            :class="{
              selected: i === selectedIndex || i === hoveredIndex,
            }"
            @click="handleSelectItem($event, item)"
            ref="itemRefs"
          >
            {{ item }}
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
