<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import AppCheckBox from '@renderer/components/ui/AppCheckBox.vue';

/* Props */
const props = defineProps<{
  keys: string[];
  selectedKeys: string[];
  fileNames?: string[] | undefined;
  migrating?: boolean;
}>();

/* Emits */
const emit = defineEmits<{
  (event: 'update:selectedKeys', selectedKeys: string[]): void;
}>();

/* State */
const localSelectedKeys = ref<string[]>([]);

/* Computed */
const selectedCount = computed(() => localSelectedKeys.value.length);

const isAllSelected = computed(() => {
  return props.keys.length > 0 && localSelectedKeys.value.length === props.keys.length;
});

/* Handlers */
const handleCheckboxChecked = (key: string, checked: boolean) => {
  if (checked) {
    localSelectedKeys.value = [...localSelectedKeys.value, key];
  } else {
    localSelectedKeys.value = localSelectedKeys.value.filter(k => k !== key);
  }
  emit('update:selectedKeys', localSelectedKeys.value);
};

const handleSelectAll = (checked: boolean) => {
  localSelectedKeys.value = checked ? [...props.keys] : [];
  emit('update:selectedKeys', localSelectedKeys.value);
};

/* Watch */
watch(
  () => props.selectedKeys,
  newKeys => {
    localSelectedKeys.value = [...newKeys];
  },
  { immediate: true },
);
</script>

<template>
  <div v-if="keys.length > 0" class="border rounded p-3 mt-4">
    <ul class="overflow-x-hidden" style="max-height: 30vh">
      <li>
        <AppCheckBox
          :checked="isAllSelected"
          @update:checked="handleSelectAll"
          name="select-all-keys"
          :data-testid="'checkbox-select-all-keys-component'"
          class="cursor-pointer"
          label="Select all"
        />
      </li>
      <li v-for="(key, index) in keys" :key="key">
        <AppCheckBox
          :checked="localSelectedKeys.includes(key)"
          @update:checked="handleCheckboxChecked(key, $event)"
          :name="`checkbox-key-${index}`"
          :label="fileNames ? fileNames[index] : key"
          :data-testid="`checkbox-key-${index}`"
        />
      </li>
    </ul>
  </div>
  <p class="text-end mt-2">
    {{ selectedCount }} of {{ keys.length }} key{{ selectedCount !== 1 ? 's' : '' }} selected
  </p>
</template>
