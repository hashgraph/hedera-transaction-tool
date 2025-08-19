<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, watchEffect } from 'vue';

import AppInput from '@renderer/components/ui/AppInput.vue';

import { sanitizeAccountId } from '@renderer/utils';

/* Props */
const props = withDefaults(
  defineProps<{
    items: string[];
    disableSpaces?: boolean;
    modelValue?: string | number;
    dataTestid?: string;
  }>(),
  {
    modelValue: '',
  },
);

/* Emits */
const emit = defineEmits<{
  (event: 'update:modelValue', value: string): void;
}>();

/* State */
const inputRef = ref<InstanceType<typeof AppInput> | null>(null);
const prefixSuggestionRef = ref<HTMLSpanElement | null>(null);
const postfixSuggestionRef = ref<HTMLSpanElement | null>(null);
const dropdownRef = ref<HTMLDivElement | null>(null);
const itemRefs = ref<HTMLElement[]>([]);
const lastKeyPressed = ref<string | null>(null);
const autocompletePrefixSuggestion = ref('');
const autocompletePostfixSuggestion = ref('');

/* Computed */
const modelValue = computed({
  get: () => props.modelValue?.toString() || '',
  set: (value: string) => {
    emit('update:modelValue', value);
  },
});

const filteredItems = computed(() => [...new Set<string>(props.items)]);
const selectedIndex = computed(() => {
  const input = modelValue.value;

  if (!input) return -1;

  // Exact match
  const exactMatchIndex = props.items.findIndex(item => item.startsWith(input));
  if (exactMatchIndex !== -1) return exactMatchIndex;

  // Partial match
  const partialMatchIndex = props.items.findIndex(item =>
    item.split('.').some(part => part.startsWith(input)),
  );
  if (partialMatchIndex !== -1) return partialMatchIndex;

  return -1;
});

/* Handlers */
const handleKeyDown = (e: KeyboardEvent) => {
  toggleDropdown(true);

  if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (selectedIndex.value > 0) {
      setValue(filteredItems.value[selectedIndex.value - 1]);
    } else {
      setValue(filteredItems.value[filteredItems.value.length - 1]);
    }
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (selectedIndex.value < filteredItems.value.length - 1) {
      setValue(filteredItems.value[selectedIndex.value + 1]);
    } else {
      setValue(filteredItems.value[0]);
    }
  } else if (e.key === 'ArrowRight') {
    const inputElement = inputRef.value?.inputRef as HTMLInputElement;
    if (!inputElement) return;
    const cursorPosition = inputElement.selectionStart;
    if (cursorPosition === modelValue.value.length) {
      e.preventDefault();
      completeNextCharacter();
      nextTick(() => {
        inputElement.setSelectionRange(modelValue.value.length, modelValue.value.length);
      });
    }
  } else if (e.key === 'Tab' && props.modelValue.toString().length > 0) {
    if (filteredItems.value[selectedIndex.value] && lastKeyPressed.value !== 'Escape') {
      setValue(filteredItems.value[selectedIndex.value]);
    }
    toggleDropdown(false);
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (lastKeyPressed.value !== 'Escape') {
      setValue(
        (
          autocompletePrefixSuggestion.value +
          modelValue.value +
          autocompletePostfixSuggestion.value
        ).trim(),
      );
    }
    toggleDropdown(false);
    focusNextElement();
  } else if (e.key === 'Escape') {
    setValue(autocompletePrefixSuggestion.value + modelValue.value);
    toggleDropdown(false);
  } else if (e.code === 'Space' && props.disableSpaces) {
    e.preventDefault();
  }

  lastKeyPressed.value = e.key;
  handleResize();
};

const handleUpdate = (value: string) => {
  value = sanitizeAccountId(value);

  setValue(value);

  // Update the input field value
  if (inputRef.value?.inputRef) {
    inputRef.value.inputRef.value = value;
  }

  if (value.length === 0) {
    toggleDropdown(false);
  } else {
    scrollToItem(selectedIndex.value);
  }
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
function setValue(value: string) {
  modelValue.value = value;
}

function scrollToItem(index: number) {
  const indexToScrollTo = index >= 0 ? index : 0;
  nextTick(() => {
    itemRefs.value[indexToScrollTo]?.scrollIntoView({
      block: 'nearest',
    });
    handleResize();
  });
}

function toggleDropdown(show: boolean) {
  if (!dropdownRef.value) return;

  const newVisibility = show ? 'visible' : 'hidden';
  const newOpacity = show ? '1' : '0';

  if (dropdownRef.value.style.visibility === newVisibility) return;
  if (dropdownRef.value.style.opacity === newOpacity) return;

  dropdownRef.value.style.visibility = newVisibility;
  dropdownRef.value.style.opacity = newOpacity;
  prefixSuggestionRef.value?.classList.toggle('d-none', !show);
  postfixSuggestionRef.value?.classList.toggle('d-none', !show);
}

function measureTextWidth(text: string, input: HTMLInputElement): number {
  const tempSpan = document.createElement('span');
  tempSpan.style.visibility = 'hidden';
  tempSpan.style.position = 'absolute';
  tempSpan.style.whiteSpace = 'pre';
  tempSpan.style.fontFamily = getComputedStyle(input).fontFamily;
  tempSpan.style.fontSize = getComputedStyle(input).fontSize;
  tempSpan.textContent = text;

  document.body.appendChild(tempSpan);
  const width = tempSpan.getBoundingClientRect().width;
  document.body.removeChild(tempSpan);

  return width;
}

async function positionSuggestion() {
  if (!inputRef.value?.inputRef || !prefixSuggestionRef.value || !postfixSuggestionRef.value)
    return;

  const input = inputRef.value.inputRef;
  const prefixSuggestion = prefixSuggestionRef.value;
  const postfixSuggestion = postfixSuggestionRef.value;

  // Reset paddingLeft first
  input.style.paddingLeft = '';
  await nextTick();

  const prefixWidth = measureTextWidth(prefixSuggestion.textContent || '', input);
  const computedStyle = getComputedStyle(input) || '0px';
  const paddingLeft = computedStyle.paddingLeft;
  const leftValue = parseFloat(paddingLeft);

  if (autocompletePrefixSuggestion.value) {
    prefixSuggestion.style.left = `${leftValue}px`;
    input.style.paddingLeft = `${prefixWidth + leftValue}px`;
  }

  if (autocompletePostfixSuggestion.value) {
    const inputWidth = measureTextWidth(input.value, input);
    postfixSuggestion.style.left = `${prefixWidth + inputWidth + leftValue + 2}px`;
  }
}

function handleGlobalEvents(add: boolean) {
  const func = add ? 'addEventListener' : 'removeEventListener';
  window[func]('resize', handleResize);
  window[func]('click', handleWindowClick);
  document[func]('scroll', handleMove, true);
}

function completeNextCharacter() {
  if (!autocompletePostfixSuggestion.value || autocompletePostfixSuggestion.value.length === 0) {
    toggleDropdown(false);
    focusNextElement();
    return;
  }
  setValue(modelValue.value + autocompletePostfixSuggestion.value[0]);
}

function focusNextElement() {
  const focusableElements = Array.from(
    document.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    ),
  );

  const currentIndex = focusableElements.indexOf(document.activeElement as HTMLElement);

  if (currentIndex !== -1 && focusableElements[currentIndex + 1]) {
    focusableElements[currentIndex + 1].focus();
  }
}

function setItemRef(el: HTMLElement | null, index: number) {
  if (el) {
    itemRefs.value[index] = el;
  }
}

/* Hooks */
onMounted(() => {
  setTimeout(() => {
    handleResize();
  }, 100);
  handleGlobalEvents(true);
});

onBeforeUnmount(() => handleGlobalEvents(false));

/* Watchers */
watch(
  () => selectedIndex.value,
  newValue => {
    scrollToItem(newValue);
  },
);

watchEffect(() => {
  if (!modelValue.value || !filteredItems.value || selectedIndex.value === -1) {
    autocompletePrefixSuggestion.value = '';
    autocompletePostfixSuggestion.value = '';
    positionSuggestion();
    return;
  }

  const match = filteredItems.value[selectedIndex.value];
  if (match) {
    const input = modelValue.value;
    const matchIndex = match.indexOf(input);
    if (matchIndex !== -1) {
      autocompletePrefixSuggestion.value = match.slice(0, matchIndex);
      autocompletePostfixSuggestion.value = match.slice(matchIndex + input.length);
    }
  } else {
    autocompletePrefixSuggestion.value = '';
    autocompletePostfixSuggestion.value = '';
  }

  positionSuggestion();
});
</script>

<template>
  <div @blur="toggleDropdown(false)" class="w-100 autocomplete-container">
    <div @click="toggleDropdown(true)" class="input-wrapper">
      <span ref="prefixSuggestionRef" class="autocomplete-suggestion">{{
        autocompletePrefixSuggestion
      }}</span>
      <AppInput
        ref="inputRef"
        :model-value="modelValue"
        @update:model-value="handleUpdate"
        @keydown="handleKeyDown"
        :data-testid="dataTestid"
        v-bind="$attrs"
      />
      <span ref="postfixSuggestionRef" class="autocomplete-suggestion">{{
        autocompletePostfixSuggestion
      }}</span>
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
            :ref="el => setItemRef(el as HTMLElement, i)"
          >
            {{ item }}
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
