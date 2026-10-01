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
    // Every caller has different requirements for what's valid input,
    // so that choice should always be explicit.
    sanitize: (value: string) => string;
    // Closed-list mode: a keystroke findMatch can't match against anything is rejected
    // outright instead of left unmatched, and blur/Escape force the value back to a
    // real match — for a fixed set of items (e.g. labels), not open-ended values like
    // account IDs.
    strictItems?: boolean;
    // Fixed-width digits (font-variant-numeric only, not the whole typeface) so a list
    // of account IDs lines up — stays legible if non-numeric text gets mixed in too.
    tabularNums?: boolean;
    // Off by default. When true, Arrow Up/Down wrap at the list's ends instead of
    // stopping there. Doesn't affect entering the list from "nothing selected" — that
    // always goes to the first/last item; it's not a wrap.
    wrapNavigation?: boolean;
    // Caller-defined matching: given the deduplicated items shown in the dropdown,
    // return the matched index and where input aligns within it (alignStart splits the
    // ghost suggestion into prefix/postfix), or null for no match. alignStart: -1 still
    // selects/highlights the item but skips ghost text, for matchers where input isn't
    // literally a substring of the match (e.g. fuzzy matching).
    findMatch: (items: string[], input: string) => { index: number; alignStart: number } | null;
    // Optional, cosmetic ghost text shown after the value once the dropdown is closed
    // (e.g. an account ID's checksum) — computed from the literal value regardless of
    // whether it's in items. Independent of findMatch, which only drives the ghost
    // while the dropdown is open. Return '' for no annotation.
    decorate?: (value: string) => string;
    // Optional, purely presentational — draws a divider line after a real item (e.g.
    // AccountIdInput's boundary between linked and owned accounts). Every entry in
    // `items` stays a real, matchable, selectable value; this never adds a fake entry
    // of its own, so it can't be confused with a match the way a sentinel value mixed
    // into `items` could be.
    groupBreakAfter?: (item: string) => boolean;
    // Optional, off by default — narrows the dropdown down to only items matching the
    // current input (e.g. typing "0.0.5" hides everything that doesn't match), instead
    // of always showing the full list with just the best one highlighted. The rule for
    // "matches" is caller-specific, same reason findMatch is pluggable rather than
    // assumed — pass the same notion of "matches" findMatch itself uses, so the two
    // can't disagree about what's a match.
    filterItem?: (item: string, input: string) => boolean;
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
const inputWrapperRef = ref<HTMLDivElement | null>(null);
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
// What filterItem filters against — deliberately NOT modelValue. modelValue also
// changes from arrow-key navigation, clicking a row, and Tab/Enter committing a match,
// none of which are "typing" and none of which should re-narrow the list (arrowing
// through a filtered list must not filter it down to just the arrowed-to row). Only
// handleUpdate (a real keystroke) and completeNextCharacter (ArrowRight accepting a
// ghost character) touch this; reset to '' every time the dropdown transitions from
// closed to open, so reopening always starts from the full list until typed again.
const filterQuery = ref('');

/* Computed */
const modelValue = computed({
  get: () => props.modelValue?.toString() || '',
  set: (value: string) => {
    emit('update:modelValue', value);
  },
});

const filteredItems = computed(() => {
  const deduped = [...new Set<string>(props.items)];
  if (!props.filterItem || !filterQuery.value) return deduped;

  return deduped.filter(item => props.filterItem!(item, filterQuery.value));
});
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
    // Nothing to move to when the (possibly filterItem-narrowed) list is empty —
    // filteredItems.value[index] would be undefined, and setValue(undefined) breaks
    // consumers that assume modelValue is always a string (e.g. AccountIdInput's
    // handleUpdate calling .split on it).
    if (filteredItems.value.length > 0) {
      const index = previousIndex(selectedIndex.value);
      setValue(filteredItems.value[index]);
      // 'nearest' here, not 'start' — navigating should keep the list stable and just
      // keep the selection in view, not re-anchor it to the top on every press.
      scrollToItem(index, 'nearest');
    }
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (filteredItems.value.length > 0) {
      const index = nextIndex(selectedIndex.value);
      setValue(filteredItems.value[index]);
      scrollToItem(index, 'nearest');
    }
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
      // preventDefault blocked the browser's native caret-advance, so once the v-model
      // round trip lands (completeNextCharacter's own nextTick handles scrolling the
      // dropdown; this is a separate concern), explicitly move the caret to the end —
      // otherwise it'd be left wherever it was before the character was accepted.
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
      // Open-ended field — what's typed is already a complete value on its own, so
      // commit it as-is (not the highlighted match) and let decorate recompute the
      // right annotation once the dropdown closes, rather than keeping some other
      // item's ghost text.
      setValue(modelValue.value.trim());
    }
    toggleDropdown(false);
    focusNextElement();
  } else if (e.key === 'Escape') {
    if (props.strictItems) {
      // Closed list — free text was never valid, so Escape reverts fully to whatever
      // was there before the edit (always empty or a real item).
      setValue(valueOnFocus.value);
    }
    // Open-ended — typed text is already valid on its own, so Escape just dismisses
    // the ghost/dropdown (below) and leaves modelValue untouched.
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
  filterQuery.value = value;

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

  // Select existing text so the next keystroke replaces it outright, like an address
  // bar. Deferred a tick so it runs after the click's own caret placement, which would
  // otherwise collapse the selection right back down.
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

// Click vs. mousedown targets differ whenever the two land on different elements (e.g.
// dragging a text selection from inside the input and releasing past its edge) — the
// browser resolves the click's target to wherever the drag ended, which can be outside
// the control even though the gesture started inside it. Tracked here so
// handleWindowClick can tell "dragged out of" apart from "actually clicked outside".
let mousedownStartedInside = false;

function handleWindowMouseDown(e: Event) {
  const target = e.target as HTMLElement;
  mousedownStartedInside =
    !!inputWrapperRef.value?.contains(target) || !!dropdownRef.value?.contains(target);
}

const handleWindowClick = (e: Event) => {
  if (!dropdownRef.value) return;
  if (!inputWrapperRef.value) return;
  if (mousedownStartedInside) return;

  // The wrapper, not just the <input> itself — it also holds the ghost-suggestion
  // spans and the chevron, none of which should count as "clicked outside" either.
  const target = e.target as HTMLElement;
  if (inputWrapperRef.value.contains(target) || dropdownRef.value.contains(target)) return;

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
    // A fresh open starts from the full list — only typing since *this* open should
    // narrow it. Runs before the keydown handler's own ArrowRight branch (if that's
    // what triggered this open), so completeNextCharacter's assignment below still
    // wins when a character is actually being accepted as part of the same keypress.
    filterQuery.value = '';
    // Position depends on the input's rendered layout, which otherwise is only
    // (re)computed on keydown/resize/the mount-time timeout below — opening via a plain
    // click before any of those have run left the very first open mispositioned.
    handleMove();
    // Nothing else triggers a scroll on reopen — do it here, after the filterQuery
    // reset above (which can itself shift selectedIndex, e.g. widening a filtered
    // subset back out to the full list relocates where the matched item sits) — so
    // reopening always lands on wherever the selection now is (or the top, if nothing's
    // selected). 'nearest' since this redisplays existing state, not a fresh match.
    scrollToItem(selectedIndex.value, 'nearest');
  }

  dropdownRef.value.style.visibility = newVisibility;
  dropdownRef.value.style.opacity = newOpacity;
  // Only the prefix ghost (an in-progress match) hides when the field isn't open — it
  // stops making sense once you've left it. The postfix ghost (e.g. a checksum) stays
  // visible either way since it's confirming content already there, not something to
  // accept.
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
  window[func]('mousedown', handleWindowMouseDown);
  window[func]('click', handleWindowClick);
  document[func]('scroll', handleMove, true);
}

function completeNextCharacter() {
  const newValue = modelValue.value + autocompletePostfixSuggestion.value[0];
  setValue(newValue);
  // Accepting a ghost character is "typing" it, same as a real keystroke — unlike
  // arrow-key navigation or clicking a row, this should narrow filterItem's list too.
  filterQuery.value = newValue;
  // Deferred for the same reason as handleUpdate's typing path — selectedIndex won't
  // reflect this setValue until it round-trips back down through the parent.
  nextTick(() => {
    // Normally a no-op — the already-matched item is already visible. 'start' (not
    // 'nearest') covers the edge case where the user scrolled the dropdown manually
    // without changing selection: that's a "show it prominently" case, same as typing.
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
    <div ref="inputWrapperRef" @click="toggleDropdown(true)" class="input-wrapper">
      <span ref="prefixSuggestionRef" class="autocomplete-suggestion">{{
        autocompletePrefixSuggestion
      }}</span>
      <AppInput
        ref="inputRef"
        class="autocomplete-input"
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
      <i class="bi bi-chevron-down autocomplete-chevron cursor-pointer"></i>
    </div>

    <div
      ref="dropdownRef"
      class="autocomplete-custom"
      :class="{ 'd-none': filteredItems.length === 0 }"
      @mousedown.prevent
    >
      <div ref="listRef">
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
          <div v-if="groupBreakAfter?.(item)" class="autocomplete-item-separator"></div>
        </template>
      </div>
    </div>
  </div>
</template>
