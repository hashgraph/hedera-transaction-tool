<script lang="ts">
export const ITEM_SEPARATOR = '-';
</script>
<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, watchEffect } from 'vue';

import AppInput from '@renderer/components/ui/AppInput.vue';

/* Props */
const props = withDefaults(
  defineProps<{
    items: string[];
    disableSpaces?: boolean;
    modelValue?: string | number;
    dataTestid?: string;
    // Required rather than defaulted to sanitizeAccountId — every caller has a different
    // notion of what's valid input, so that choice should always be explicit. If more
    // callers end up wanting sanitizeAccountId, it's already exported from @renderer/utils.
    sanitize: (value: string) => string;
    // When true, a keystroke that would no longer be a prefix of any item is rejected
    // outright instead of just left unmatched — for fields backed by a closed list
    // (e.g. picking one of a fixed set of labels) rather than open-ended values like
    // account IDs.
    restrictToItems?: boolean;
    // Account IDs use tabular (fixed-width) digits so a list of them lines up predictably;
    // plain text values should look like every other input instead. Only affects digit
    // glyphs (font-variant-numeric), not the typeface itself, so it stays legible even
    // mixed into free text (e.g. a nickname alongside an account ID).
    tabularNums?: boolean;
    // Required rather than defaulted, same reasoning as sanitize — what counts as a
    // "match" (e.g. accountId's exact-prefix-then-shard/realm/num-part fallback), and
    // where the typed input aligns within the matched string, are both caller-specific.
    // Called with the deduplicated list shown in the dropdown (i.e. filteredItems, not
    // the raw items prop). Return null when nothing matches. `alignStart` is the offset
    // into the matched item where the ghost-suggestion split happens (prefix = item up
    // to alignStart, postfix = item after alignStart + input.length) — return -1 there
    // if an item matches but input isn't literally alignable within it (e.g. a fuzzy
    // matcher); the item still gets selected/highlighted, just without ghost text.
    findMatch: (items: string[], input: string) => { index: number; alignStart: number } | null;
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
const listRef = ref<HTMLDivElement | null>(null);
const itemRefs = ref<HTMLElement[]>([]);
const lastKeyPressed = ref<string | null>(null);
const autocompletePrefixSuggestion = ref('');
const autocompletePostfixSuggestion = ref('');
// Snapshot of modelValue as of the most recent focus — what Escape reverts to, since
// "back out of this edit" should mean "undo everything typed since I got here", not
// "clear the field" (a field that started on a real selection should return to it).
const valueOnFocus = ref('');

/* Computed */
const modelValue = computed({
  get: () => props.modelValue?.toString() || '',
  set: (value: string) => {
    emit('update:modelValue', value);
  },
});

const filteredItems = computed(() => [...new Set<string>(props.items)]);
const currentMatch = computed(() => {
  if (!modelValue.value) return null;

  return props.findMatch(filteredItems.value, modelValue.value);
});
const selectedIndex = computed(() => currentMatch.value?.index ?? -1);

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
    if (props.restrictToItems) {
      // Closed list — free text was never a valid value here, so backing out of the
      // edit means reverting all the way to whatever was there before it (itself
      // guaranteed to be empty or a real item, never partial text).
      setValue(valueOnFocus.value);
    }
    // Open-ended field — the typed text is already a valid value on its own, so Escape
    // only dismisses the ghost suggestion/dropdown (toggleDropdown below hides it) and
    // leaves modelValue untouched, rather than undoing what was typed.
    toggleDropdown(false);
  } else if (e.code === 'Space' && props.disableSpaces) {
    e.preventDefault();
  }

  lastKeyPressed.value = e.key;
  handleResize();
};

const handleUpdate = (value: string) => {
  value = props.sanitize(value);

  // Same matcher used for selection/highlighting, so "is this keystroke even allowed" and
  // "what's currently matched" can never disagree with each other.
  if (props.restrictToItems && value.length > 0 && !props.findMatch(filteredItems.value, value)) {
    // Reject the keystroke — the browser has already rendered it into the native
    // input, so force it back to the last accepted value.
    if (inputRef.value?.inputRef) {
      inputRef.value.inputRef.value = modelValue.value;
    }
    return;
  }

  setValue(value);

  // Update the input field value
  if (inputRef.value?.inputRef) {
    inputRef.value.inputRef.value = value;
  }

  // Stays open even when backspaced down to empty — the field still has focus and no
  // selection has actually been made ("any"/empty is only a real selection once the field
  // is left; see handleBlur/handleFocus), so the user should still be able to keep browsing.
  if (value.length > 0) {
    scrollToItem(selectedIndex.value);
  }
};

const handleFocus = () => {
  valueOnFocus.value = modelValue.value;

  // Returning to a field that already holds a value should let the very next keystroke
  // replace it outright rather than append to or "smartly" continue the old search —
  // highlighting the text makes that unambiguous, matching how e.g. an address bar behaves.
  // Deferred a tick so it runs after the click's own native caret-placement, which would
  // otherwise immediately collapse the selection right back down.
  setTimeout(() => inputRef.value?.inputRef?.select());
  toggleDropdown(true);
};

const handleSelectItem = (event: Event, item: string) => {
  event.stopPropagation();

  // Straight to setValue, same as every other "accept a known match" path (arrow keys,
  // Tab, Enter, completeNextCharacter) — item came from the items list itself, so it's
  // already valid and doesn't need to go through sanitize/restrictToItems again.
  setValue(item);
  toggleDropdown(false);
};

const handleBlur = () => {
  // For a closed-list field, leaving with a partial-but-valid-prefix value (e.g. "trans")
  // should resolve to whatever's currently highlighted ("Transfer") rather than leave the
  // field showing text that was never actually a real selection.
  if (props.restrictToItems && modelValue.value.length > 0) {
    const match = filteredItems.value[selectedIndex.value];
    if (match) {
      if (match.toLowerCase() !== modelValue.value.toLowerCase()) {
        setValue(match);
      }
    } else {
      // Shouldn't be reachable — handleUpdate rejects keystrokes findMatch wouldn't
      // match — but fall back to the value from before this edit session rather than
      // ever leaving free text sitting in a restrictToItems field if it somehow is.
      setValue(valueOnFocus.value);
    }
  }
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
function isSeparator(item: string): boolean {
  return item === ITEM_SEPARATOR;
}

function setValue(value: string) {
  modelValue.value = value;
}

function scrollToItem(index: number) {
  nextTick(() => {
    if (index < 0) {
      // Nothing selected — always reset to the top of the list rather than wherever a
      // prior search left it scrolled.
      if (listRef.value) listRef.value.scrollTop = 0;
      return;
    }

    // 'start' aligns the item with the top of the list; if there isn't enough content
    // below it to do that, the browser clamps to the max scroll offset on its own —
    // which is exactly "scroll as far down as it can go" for items near the end.
    itemRefs.value[index]?.scrollIntoView({ block: 'start' });
    handleResize();
  });
}

function toggleDropdown(show: boolean) {
  if (!dropdownRef.value) return;

  const newVisibility = show ? 'visible' : 'hidden';
  const newOpacity = show ? '1' : '0';

  if (dropdownRef.value.style.visibility === newVisibility) return;
  if (dropdownRef.value.style.opacity === newOpacity) return;

  if (show) {
    // Position depends on the input's rendered layout, which otherwise is only
    // (re)computed on keydown/resize/the mount-time timeout below — opening via a plain
    // click before any of those have run left the very first open mispositioned.
    handleMove();
    // Reopening (e.g. re-focusing) doesn't itself change selectedIndex, so the watcher
    // below won't fire — scroll explicitly so a reopen always lands on the current
    // selection (or the top, if nothing is selected) instead of wherever it was left.
    scrollToItem(selectedIndex.value);
  }

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
  const result = currentMatch.value;

  if (!result || result.alignStart === -1) {
    autocompletePrefixSuggestion.value = '';
    autocompletePostfixSuggestion.value = '';
    positionSuggestion();
    return;
  }

  const match = filteredItems.value[result.index];
  const input = modelValue.value;
  autocompletePrefixSuggestion.value = match.slice(0, result.alignStart);
  autocompletePostfixSuggestion.value = match.slice(result.alignStart + input.length);

  positionSuggestion();
});
</script>

<template>
  <div class="w-100 autocomplete-container" :class="{ 'is-tabular-nums': tabularNums }">
    <div @click="toggleDropdown(true)" class="input-wrapper">
      <span ref="prefixSuggestionRef" class="autocomplete-suggestion">{{
        autocompletePrefixSuggestion
      }}</span>
      <AppInput
        ref="inputRef"
        class="form-select"
        :model-value="modelValue"
        @update:model-value="handleUpdate"
        @keydown="handleKeyDown"
        @focus="handleFocus"
        @blur="handleBlur"
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
      <div ref="listRef">
        <template v-for="(item, i) in filteredItems">
          <!-- Check if the item is a separator -->
          <div
            v-if="isSeparator(item)"
            class="autocomplete-item-separator"
            :key="'separator-' + i"
          ></div>
          <div
            v-else
            class="autocomplete-item-custom"
            :class="{
              selected: i === selectedIndex,
            }"
            :key="item"
            @mousedown.prevent
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
