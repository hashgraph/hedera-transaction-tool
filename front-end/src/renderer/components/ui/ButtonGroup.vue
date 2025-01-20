<script setup lang="ts">
import AppButton from '@renderer/components/ui/AppButton.vue';

/* Props */
const props = defineProps<{
  items: { label: string; value: string | number; active?: boolean; id: string }[];
  activeValue: string | number;
  color?: 'primary' | 'secondary' | 'borderless' | 'danger';
}>();

/* Emits */
const emit = defineEmits(['change']);

/* Handlers */
const handleButtonClick = (value: string | number) => {
  if (value !== props.activeValue) {
    emit('change', value);
  }
};
</script>

<template>
  <div class="btn-group-container" role="group">
    <div class="btn-group gap-3 overflow-x-auto w-100">
      <template v-for="item in items" :key="item.value">
        <AppButton
          class="rounded-3"
          :class="{
            active: activeValue === item.value,
            'text-body': activeValue !== item.value,
          }"
          :color="activeValue === item.value ? color : undefined"
          @click="handleButtonClick(item.value)"
          :data-testid="item.id"
        >
          {{ item.label }}
        </AppButton>
      </template>
    </div>
  </div>
</template>
