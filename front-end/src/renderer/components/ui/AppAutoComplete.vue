<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import AppInput from './AppInput.vue';

/* Props */
const props = withDefaults(
  defineProps<{
    items: string[];
    modelValue?: string | number;
    filled?: boolean;
    size?: 'small' | 'large' | undefined;
    dataTestid?: string;
  }>(),
  {
    modelValue: '',
  },
);

/* Emits */
const emit = defineEmits(['update:modelValue']);

/* State */
const inputRef = ref<InstanceType<typeof AppInput> | null>(null);
const suggestionRef = ref<InstanceType<typeof HTMLSpanElement> | null>(null);
const dropdownRef = ref<HTMLDivElement | null>(null);
const itemRefs = ref<HTMLElement[]>([]);

/* Computed */
const filteredItems = computed(() => [...new Set<string>(props.items)]);

const selectedIndex = computed(() => {
  return filteredItems.value.findIndex(
    item =>
      item.startsWith(props.modelValue.toString()) ||
      item.startsWith(`0.0.${props.modelValue.toString()}`),
  );
});

const autocompleteSuggestion = computed(() => {
  if (!props.modelValue) return '';
  const match = filteredItems.value[selectedIndex.value];
  return match?.slice(props.modelValue.toString().length) || '';
});

/* Handlers */
const handleKeyDown = (e: KeyboardEvent) => {
  toggleDropdown(true);

  const key = {
    ArrowUp: 'ArrowUp',
    ArrowDown: 'ArrowDown',
    Enter: 'Enter',
    Tab: 'Tab',
    Backspace: 'Backspace',
  };

  handleResize();
  handleMove();

  if (e.key === key.ArrowUp) {
    if (e.metaKey || e.ctrlKey) {
      emit('update:modelValue', filteredItems.value[0]);
    } else {
      emit('update:modelValue', filteredItems.value[Math.max(selectedIndex.value - 1, 0)]);
    }
  } else if (e.key === key.ArrowDown) {
    if (e.metaKey || e.ctrlKey) {
      emit('update:modelValue', filteredItems.value[filteredItems.value.length - 1]);
    } else {
      emit(
        'update:modelValue',
        filteredItems.value[Math.min(selectedIndex.value + 1, filteredItems.value.length - 1)],
      );
    }
  } else if (e.key === key.Tab && props.modelValue.toString().length > 0) {
    if (filteredItems.value[selectedIndex.value]) {
      emit('update:modelValue', filteredItems.value[selectedIndex.value]);
    }
    toggleDropdown(false);
  }

  if (e.key === key.ArrowUp || e.key === key.ArrowDown) {
    nextTick(() => {
      itemRefs.value[selectedIndex.value]?.scrollIntoView({
        block: 'nearest',
      });
    });
  }
};

const handleUpdate = (value: string) => {
  if (value.length === 0) {
    toggleDropdown(false);
  }
  emit('update:modelValue', value);

  nextTick(() => {
    itemRefs.value[selectedIndex.value]?.scrollIntoView({
      block: 'nearest',
    });

    handleResize();
    handleMove();
  });
};

const handleSelectItem = (event: Event, item: string) => {
  event.stopPropagation();

  handleUpdate(item);
  toggleDropdown(false);
};

const handleResize = () => {
  setTimeout(() => {
    handleMove();
  }, 200);

  if (!inputRef.value?.inputRef || !dropdownRef.value) return;
  dropdownRef.value.style.width = `${inputRef.value.inputRef.offsetWidth}px`;
  positionSuggestion();
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

function positionSuggestion() {
  if (!inputRef.value?.inputRef || !suggestionRef.value) return;

  const input = inputRef.value.inputRef;
  const suggestion = suggestionRef.value;

  const tempSpan = document.createElement('span');
  tempSpan.style.visibility = 'hidden';
  tempSpan.style.position = 'absolute';
  tempSpan.style.whiteSpace = 'pre';
  tempSpan.style.fontFamily = getComputedStyle(input).fontFamily;
  tempSpan.style.fontSize = getComputedStyle(input).fontSize;
  tempSpan.textContent = input.value;

  document.body.appendChild(tempSpan);
  const inputWidth = tempSpan.getBoundingClientRect().width;
  document.body.removeChild(tempSpan);

  suggestion.style.left = `${inputWidth + 15}px`;
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
  <div @blur="toggleDropdown(false)" class="w-100 autocomplete-container">
    <div @click="toggleDropdown(true)" class="input-wrapper">
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
      <span ref="suggestionRef" class="autocomplete-suggestion">{{ autocompleteSuggestion }}</span>
    </div>

    <div
      ref="dropdownRef"
      class="autocomplete-custom"
      :class="{ 'd-none': filteredItems.length === 0 }"
    >
      <div>
        <template v-for="(item, i) in filteredItems" :key="item">
          <div
            class="autocomplete-item-custom"
            :class="{
              selected: i === selectedIndex,
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
