<script lang="ts">
export const ITEM_SEPARATOR = '-';
</script>
<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watchEffect } from 'vue';

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
    strictItems?: boolean;
    // Account IDs use tabular (fixed-width) digits so a list of them lines up predictably;
    // plain text values should look like every other input instead. Only affects digit
    // glyphs (font-variant-numeric), not the typeface itself, so it stays legible even
    // mixed into free text (e.g. a nickname alongside an account ID).
    tabularNums?: boolean;
    // Off by default. When true, ArrowUp/ArrowDown wrap around at the ends of the list
    // (pressing Down at the last item jumps to the first, and vice versa). When false,
    // pressing further at a boundary just stays there. Doesn't affect entering the list
    // from no selection — ArrowDown/ArrowUp from "nothing selected" always goes to the
    // first/last item respectively; that's starting navigation, not wrapping it.
    wrapNavigation?: boolean;
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
    // Optional, independent of findMatch/items entirely — a purely decorative annotation
    // appended after the current value, shown as ghost text once editing has stopped
    // (the dropdown is closed): e.g. an account ID's computed checksum. Computed fresh
    // from whatever the literal current value is, whether or not that value is one of
    // the known items — unlike findMatch, which only knows about items and drives the
    // ghost while the dropdown is open. Return '' for no annotation.
    decorate?: (value: string) => string;
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
// Drives which ghost-text source is active (see the watchEffect below): findMatch's
// live suggestion while open/editing, decorate's static annotation once closed/at rest.
const isOpen = ref(false);

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
    const index = skipSeparators(selectedIndex.value, previousIndex);
    setValue(filteredItems.value[index]);
    // 'nearest' here, not 'start' — navigating should keep the list stable and just
    // keep the selection in view, not re-anchor it to the top on every press.
    scrollToItem(index, 'nearest');
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    const index = skipSeparators(selectedIndex.value, nextIndex);
    setValue(filteredItems.value[index]);
    scrollToItem(index, 'nearest');
  } else if (e.key === 'ArrowRight') {
    const inputElement = inputRef.value?.inputRef as HTMLInputElement;
    if (!inputElement) return;
    const cursorPosition = inputElement.selectionStart;
    // Only intercept when there's actually something to complete — otherwise this
    // should behave like a plain input (native cursor movement, which at the end of
    // the text is already a no-op on its own).
    if (cursorPosition === modelValue.value.length && autocompletePostfixSuggestion.value) {
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
  } else if (e.key === 'Enter' && props.modelValue.toString().length > 0) {
    e.preventDefault();
    if (props.strictItems && lastKeyPressed.value !== 'Escape') {
      // Closed list — accepting the highlighted match is the point, same as Tab.
      setValue(
        (
          autocompletePrefixSuggestion.value +
          modelValue.value +
          autocompletePostfixSuggestion.value
        ).trim(),
      );
    } else {
      // Open-ended field — what's typed is already a complete, valid value on its own
      // (e.g. "0.0.2" isn't an in-progress prefix just because it coincidentally
      // matches a longer known account); committing it as-is lets decorate recompute
      // the right annotation for it once the dropdown closes below, instead of keeping
      // whatever a coincidentally-matched different item's ghost text was showing.
      setValue(modelValue.value.trim());
    }
    toggleDropdown(false);
    focusNextElement();
  } else if (e.key === 'Escape') {
    if (props.strictItems) {
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
  if (props.strictItems && value.length > 0 && !props.findMatch(filteredItems.value, value)) {
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
    // Deferred: selectedIndex depends on modelValue, which depends on props.modelValue —
    // setValue above only emitted the change, it hasn't round-tripped back down through
    // the parent yet. Reading selectedIndex.value synchronously here would scroll based
    // on the previous keystroke's match, one step behind.
    nextTick(() => {
      // 'start', not 'nearest' — a fresh match found while typing should be shown
      // prominently at the top, like a search result, not just scrolled minimally into view.
      scrollToItem(selectedIndex.value, 'start');
    });
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
  // already valid and doesn't need to go through sanitize/strictItems again.
  setValue(item);
  toggleDropdown(false);
};

const handleBlur = () => {
  // For a closed-list field, leaving with a partial-but-valid-prefix value (e.g. "trans")
  // should resolve to whatever's currently highlighted ("Transfer") rather than leave the
  // field showing text that was never actually a real selection.
  if (props.strictItems && modelValue.value.length > 0) {
    const match = filteredItems.value[selectedIndex.value];
    if (match) {
      if (match.toLowerCase() !== modelValue.value.toLowerCase()) {
        setValue(match);
      }
    } else {
      // Shouldn't be reachable — handleUpdate rejects keystrokes findMatch wouldn't
      // match — but fall back to the value from before this edit session rather than
      // ever leaving free text sitting in a strictItems field if it somehow is.
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

function previousIndex(index: number): number {
  if (index === -1) return filteredItems.value.length - 1; // entering the list, not a wrap
  if (index > 0) return index - 1;
  // Already at the first item.
  return props.wrapNavigation ? filteredItems.value.length - 1 : index;
}

function nextIndex(index: number): number {
  if (index === -1) return 0; // entering the list, not a wrap
  if (index < filteredItems.value.length - 1) return index + 1;
  // Already at the last item.
  return props.wrapNavigation ? 0 : index;
}

// Steps past separator rows (e.g. the divider AccountIdInput puts between linked and
// owned accounts) so arrow-key navigation never lands on one. `step` is previousIndex
// or nextIndex depending on direction. Bounded by length rather than "until we're back
// where we started" since `from` can be -1 (nothing selected yet), which step() never
// revisits — this still guarantees termination in the degenerate all-separator case.
function skipSeparators(from: number, step: (index: number) => number): number {
  let index = step(from);
  for (let i = 0; i < filteredItems.value.length && isSeparator(filteredItems.value[index]); i++) {
    index = step(index);
  }
  return index;
}

function setValue(value: string) {
  modelValue.value = value;
}

function scrollToItem(index: number, block: ScrollLogicalPosition = 'nearest') {
  nextTick(() => {
    if (index < 0) {
      // Nothing selected — always reset to the top of the list rather than wherever a
      // prior search left it scrolled.
      if (listRef.value) listRef.value.scrollTop = 0;
      return;
    }

    itemRefs.value[index]?.scrollIntoView({ block });
    handleResize();
  });
}

function toggleDropdown(show: boolean) {
  isOpen.value = show;

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
    // Reopening (e.g. re-focusing) doesn't itself change selectedIndex, so nothing else
    // would trigger a scroll — do it explicitly so a reopen always lands on the current
    // selection (or the top, if nothing is selected) instead of wherever it was left.
    // 'nearest' since this isn't a fresh search result, just redisplaying existing state.
    scrollToItem(selectedIndex.value, 'nearest');
  }

  dropdownRef.value.style.visibility = newVisibility;
  dropdownRef.value.style.opacity = newOpacity;
  // Only the prefix ghost (a mid-typing tier-2 match) is tied to the dropdown being
  // open — it's an in-progress editing affordance that stops making sense once you've
  // left the field. The postfix ghost (e.g. a decorative checksum) stays visible either
  // way: it's confirmation for content that's already there, not something you're about
  // to accept, so it should still read correctly at rest.
  prefixSuggestionRef.value?.classList.toggle('d-none', !show);
}

function measureTextWidth(text: string, input: HTMLInputElement): number {
  const tempSpan = document.createElement('span');
  tempSpan.style.visibility = 'hidden';
  tempSpan.style.position = 'absolute';
  tempSpan.style.whiteSpace = 'pre';
  tempSpan.style.fontFamily = getComputedStyle(input).fontFamily;
  tempSpan.style.fontSize = getComputedStyle(input).fontSize;
  // Tabular-nums digits are wider than the default proportional spacing — without
  // copying this, measured width undershoots the real input's rendered width and the
  // postfix ghost ends up positioned underneath the input's own trailing characters.
  tempSpan.style.fontVariantNumeric = getComputedStyle(input).fontVariantNumeric;
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
  setValue(modelValue.value + autocompletePostfixSuggestion.value[0]);
  // Deferred for the same reason as handleUpdate's typing path — selectedIndex won't
  // reflect this setValue until it round-trips back down through the parent.
  nextTick(() => {
    // Normally a no-op — completing toward an already-matched item keeps selectedIndex
    // on that same item, which is already visible (it got scrolled into view when it
    // was first matched). 'start', not 'nearest', for the edge case where it isn't —
    // e.g. the user scrolled the dropdown manually without changing the selection —
    // since re-finding it here is the same "show it prominently" case as typing, not
    // list navigation.
    scrollToItem(selectedIndex.value, 'start');
  });
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
watchEffect(() => {
  // At rest (not actively editing): no in-progress suggestion to show, only the
  // decorative annotation for whatever's actually committed right now.
  if (!isOpen.value) {
    autocompletePrefixSuggestion.value = '';
    autocompletePostfixSuggestion.value = props.decorate?.(modelValue.value) ?? '';
    positionSuggestion();
    return;
  }

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
      @mousedown.prevent
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
