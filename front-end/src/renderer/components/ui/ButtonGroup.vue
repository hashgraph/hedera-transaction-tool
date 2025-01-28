<script setup lang="ts">
import AppButton from '@renderer/components/ui/AppButton.vue';

/* Props */
const props = defineProps<{
  items: { label: string; value: string | number; active?: boolean; id: string }[];
  activeValue: string | number;
  color?: 'primary' | 'secondary' | 'borderless' | 'danger';
  notifications?: Record<string, number>;
}>();

/* Emits */
const emit = defineEmits<{
  (event: 'change', value: string | number): void;
}>();

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
          <span
            :class="{
              'network-notification position-relative': notifications && notifications[item.value],
            }"
            :data-notification="notifications?.[item.label.toLowerCase()] || null"
            >{{ item.label }}</span
          >
        </AppButton>
      </template>
    </div>
  </div>
</template>
