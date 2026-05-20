<script setup lang="ts">
import ChipMultiInput from '@renderer/components/ui/ChipMultiInput.vue';
import { registeredNodeIdStrategy } from '@renderer/components/Transaction/Create/Node/registeredNodeIdStrategy';

defineProps<{
  modelValue: string[];
}>();

const emit = defineEmits<{
  (event: 'update:modelValue', ids: string[]): void;
}>();
</script>

<template>
  <ChipMultiInput
    :model-value="modelValue"
    :strategy="registeredNodeIdStrategy"
    :max-ids="20"
    label="Associated Registered Nodes"
    placeholder="Comma-separated values or ranges (e.g. 1, 5, 10-15). Max 20."
    @update:model-value="emit('update:modelValue', $event)"
  />
</template>
