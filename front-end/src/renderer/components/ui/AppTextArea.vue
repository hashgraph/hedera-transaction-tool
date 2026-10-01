<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue';
import useCreateTooltip from '@renderer/composables/useCreateTooltip.ts';

/* Props */
const props = withDefaults(
  defineProps<{
    modelValue?: string | number;
    filled?: boolean;
    limit?: number;
    rows?: number;
    autoExpand?: boolean;
    maxRows?: number;
  }>(),
  {
    rows: 4,
    maxRows: 3,
  },
);

const emit = defineEmits(['update:modelValue']);

/* State */
const inputRef = ref<HTMLTextAreaElement | null>(null);
useCreateTooltip(inputRef);

/* Computed */
const fillClass = computed(() => (props.filled ? 'is-fill' : ''));

/* Functions */
// Growing a textarea with its content via CSS alone needs `field-sizing: content`,
// which only recent Chromium supports. Resetting to 1 row to read the content's
// natural scrollHeight, then converting that back into a row count, grows the
// textarea with plain DOM APIs instead — the textarea's native overflow handles
// scrolling once it's clamped at the max.
const resizeToContent = () => {
  if (!props.autoExpand || !inputRef.value) return;
  const el = inputRef.value;

  // Force the scrollbar away before measuring. The moment content needs more than 1 row,
  // resetting to `rows = 1` makes it overflow — and on platforms with reserved-width
  // (non-overlay) scrollbars, that overflow scrollbar narrows the content box *during
  // measurement only*, which wraps the text earlier than it actually needs to and
  // overshoots the row count. Hiding overflow while measuring keeps the width stable.
  el.style.overflowY = 'hidden';
  el.rows = 1;

  const { lineHeight, fontSize, paddingTop, paddingBottom } = getComputedStyle(el);
  // Bootstrap's `.form-control` sets `line-height: 1.5` as a bare number. Per spec, a
  // unitless line-height's *computed* value is that number itself, not a resolved
  // length — so it must be multiplied by font-size to get an actual line-box height,
  // or this under-counts the line height and overshoots the row count almost
  // immediately.
  const lineHeightPx = lineHeight.endsWith('px')
    ? parseFloat(lineHeight)
    : parseFloat(lineHeight) * parseFloat(fontSize);
  const contentHeight = el.scrollHeight - parseFloat(paddingTop) - parseFloat(paddingBottom);
  const rowCount = Math.max(1, Math.round(contentHeight / lineHeightPx));

  el.rows = Math.min(rowCount, props.maxRows);
  // Only content that still overflows the clamped max needs to scroll internally.
  el.style.overflowY = rowCount > props.maxRows ? 'auto' : '';
};

const handleInput = (event: Event) => {
  emit('update:modelValue', (event.target as HTMLTextAreaElement).value);
  resizeToContent();
};

/* Hooks */
onMounted(() => nextTick(resizeToContent));

/* Exposes */
defineExpose({
  inputRef,
});
</script>
<template>
  <textarea
    ref="inputRef"
    :value="modelValue"
    @input="handleInput"
    :class="['form-control', fillClass]"
    :rows="rows"
    v-bind:maxlength="limit || undefined"
  />
</template>
