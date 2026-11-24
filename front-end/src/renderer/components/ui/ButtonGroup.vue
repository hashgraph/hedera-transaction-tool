<script setup lang="ts" generic="T extends string | number">
import AppButton from '@renderer/components/ui/AppButton.vue';

/* Types */
export interface ButtonGroupItem<T extends string | number> {
  label: string;
  value: T;
  active?: boolean;
  id: string;
}

/* Props */
const props = defineProps<{
  items: ButtonGroupItem<T>[];
  activeValue: T;
  buttonType?: 'button' | 'submit' | 'reset';
  color?: 'primary' | 'secondary' | 'borderless' | 'danger';
  notifications?: Record<string, number>;
}>();

/* Emits */
const emit = defineEmits<{
  (event: 'change', value: T): void;
}>();

/* Handlers */
const handleButtonClick = (value: T) => {
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
          :type="buttonType"
          :color="activeValue === item.value ? color : undefined"
          @click="handleButtonClick(item.value)"
          :data-testid="item.id"
        >
          <span>{{ item.label }}</span>
        </AppButton>
      </template>
    </div>
  </div>
</template>
