<script setup lang="ts" generic="T extends string | number">
import { ref, useId, watch } from 'vue';

// `T` is constrained to a primitive so it can be used directly as Vue's
// `:key` on the chip `v-for` (and so reference equality in `removeId` works
// as value equality). All current and planned strategies use a canonical
// string id (e.g. `"5"` for registered nodes, `"0.0.4-asdfn"` for accounts).
export interface ChipMultiInputStrategy<T extends string | number> {
  sanitize: (raw: string) => string;
  parse: (raw: string) => { ids: T[] } | { error: string };
  format: (ids: T[]) => string;
  display: (id: T) => string;
}

const props = withDefaults(
  defineProps<{
    modelValue: T[];
    strategy: ChipMultiInputStrategy<T>;
    maxIds?: number;
    label?: string;
    placeholder?: string;
  }>(),
  {
    maxIds: 20,
  },
);

const emit = defineEmits<{
  (event: 'update:modelValue', ids: T[]): void;
}>();

const inputId = useId();
const rawInput = ref('');
const errorMsg = ref('');
const isFocused = ref(false);

watch(
  () => props.modelValue,
  ids => {
    // Skip sync while the user is mid-edit. Otherwise an async parent update
    // (e.g. a draft load landing after the user has already started typing)
    // would overwrite their in-progress input. On blur we re-sync via commit().
    if (isFocused.value) return;
    rawInput.value = props.strategy.format(ids);
  },
  { immediate: true, deep: true },
);

function onInput(e: Event) {
  const target = e.target as HTMLInputElement;
  const sanitized = props.strategy.sanitize(target.value);
  if (sanitized !== target.value) {
    target.value = sanitized;
  }
  rawInput.value = sanitized;
  errorMsg.value = '';
}

function commit() {
  const raw = rawInput.value.trim();
  errorMsg.value = '';

  if (!raw) {
    // Normalize the displayed text back to empty too — without this, a
    // whitespace-only input would leave the visible field showing those
    // spaces even though the component treated it as empty (the
    // modelValue watcher only fires when modelValue actually changed,
    // so empty→empty wouldn't re-sync the text).
    rawInput.value = '';
    if (props.modelValue.length > 0) emit('update:modelValue', []);
    return;
  }

  const result = props.strategy.parse(raw);
  if ('error' in result) {
    errorMsg.value = result.error;
    return;
  }

  if (result.ids.length > props.maxIds) {
    errorMsg.value = `Too many IDs (${result.ids.length} — max ${props.maxIds})`;
    return;
  }

  rawInput.value = props.strategy.format(result.ids);
  emit('update:modelValue', result.ids);
}

function removeId(id: T) {
  // `id` is taken directly from `v-for="id of modelValue"`, so it's a
  // reference (or value, for primitive T) into the current `modelValue`.
  // Plain `!==` is enough — no need to round-trip through `keyFor`.
  const next = props.modelValue.filter(v => v !== id);
  rawInput.value = props.strategy.format(next);
  errorMsg.value = '';
  emit('update:modelValue', next);
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault();
    commit();
  }
}

function onFocus() {
  isFocused.value = true;
}

function onBlur() {
  isFocused.value = false;
  commit();
}
</script>

<template>
  <div class="form-group">
    <label v-if="label" :for="inputId" class="form-label">{{ label }}</label>
    <input
      :id="inputId"
      :value="rawInput"
      class="form-control is-fill"
      :placeholder="placeholder"
      @focus="onFocus"
      @input="onInput"
      @keydown="onKeydown"
      @blur="onBlur"
    />

    <div class="d-flex align-items-start mt-3">
      <div
        v-if="modelValue.length > 0"
        class="chip-container d-flex flex-wrap flex-grow-1 me-3"
      >
        <div
          v-for="id of modelValue"
          :key="id"
          class="chip d-inline-flex align-items-center px-2 border rounded lh-1"
        >
          <span class="chip-label text-center">{{ strategy.display(id) }}</span>
          <button
            type="button"
            class="chip-remove ms-1 lh-1"
            :aria-label="`Remove ${strategy.display(id)}`"
            @click="removeId(id)"
          >
            <span aria-hidden="true">&times;</span>
          </button>
        </div>
      </div>

      <p
        class="text-micro mb-0 ms-auto text-nowrap"
        :class="modelValue.length >= maxIds ? 'text-danger' : 'text-muted'"
      >
        {{ modelValue.length }} / {{ maxIds }}
      </p>
    </div>

    <p v-if="errorMsg" class="text-micro text-danger mt-1 mb-0">{{ errorMsg }}</p>
  </div>
</template>
