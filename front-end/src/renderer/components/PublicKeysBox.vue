<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import AppCheckBox from '@renderer/components/ui/AppCheckBox.vue';

/* Props */
const props = defineProps<{
  keys: { publicKey: string; nickname: string }[];
  selectedKeys: { publicKey: string; nickname: string }[];
}>();

/* Emits */
const emit = defineEmits<{
  (event: 'update:selectedKeys', selectedKeys: { publicKey: string; nickname: string }[]): void;
}>();

/* State */
const localSelectedKeys = ref<{ publicKey: string; nickname: string }[]>([]);

/* Computed */
const selectedCount = computed(() => localSelectedKeys.value.length);

const isAllSelected = computed(() => {
  return props.keys.length > 0 && localSelectedKeys.value.length === props.keys.length;
});

/* Handlers */
const handleCheckboxChecked = (key: { publicKey: string; nickname: string }, checked: boolean) => {
  if (checked) {
    localSelectedKeys.value = [...localSelectedKeys.value, key];
  } else {
    localSelectedKeys.value = localSelectedKeys.value.filter(k => k.publicKey !== key.publicKey);
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
    <div class="d-flex flex-row align-items-center gap-3 border-bottom mb-2">
      <AppCheckBox
        :checked="isAllSelected"
        @update:checked="handleSelectAll"
        name="select-all-keys"
        data-testid="checkbox-select-all-public-keys"
        class="cursor-pointer"
      />
      <span>Select all</span>
    </div>
    <ul class="overflow-x-hidden" style="max-height: 30vh">
      <li
        v-for="(key, index) in keys"
        :key="key.publicKey"
        class="d-flex flex-row align-items-center gap-3"
      >
        <AppCheckBox
          :checked="localSelectedKeys.some(k => k.publicKey === key.publicKey)"
          @update:checked="handleCheckboxChecked(key, $event)"
          :name="`checkbox-key-${index}`"
          class="cursor-pointer"
          :data-testid="`checkbox-key-${index}`"
        />
        <div class="overflow-x-auto">
          <strong>{{ key.nickname }}</strong>
          <p class="text-muted small">{{ key.publicKey }}</p>
        </div>
      </li>
    </ul>
  </div>
  <p class="text-end mt-4">
    {{ selectedCount }} of {{ keys.length }} key{{ selectedCount !== 1 ? 's' : '' }} selected
  </p>
</template>
