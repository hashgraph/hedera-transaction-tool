<script setup lang="ts">
import useTransactionGroupStore from '@renderer/stores/storeTransactionGroup';

/* Props */
defineProps<{
  show: boolean;
}>();

/* Emits */
const emit = defineEmits<{
  (event: 'update:show', show: boolean): void;
}>();

/* Stores */
const transactionGroup = useTransactionGroupStore();
</script>
<template>
  <!-- Confirm modal -->
  <AppModal
    :show="show"
    class="large=modal"
    :close-on-click-outside="false"
    :close-on-escape="false"
  >
    <div class="p-5">
      <div>
        <i class="bi bi-x-lg cursor-pointer" @click="emit('update:show', false)"></i>
      </div>
      <div class="text-center">
        <i class="bi bi-arrow-left-right large-icon"></i>
      </div>
      <h3 class="text-center text-title text-bold mt-5">Confirm Transaction Group</h3>
      <hr class="separator my-5" />
      <div
        v-for="(groupItem, index) in transactionGroup.groupItems"
        :key="groupItem.transactionBytes.toString()"
      >
        <div class="d-flex p-4" style="background-color: #edefff">
          <div>{{ index + 1 }}</div>
          <div>{{ groupItem.type }}</div>
        </div>
      </div>

      <hr class="separator my-5" />

      <div class="flex-between-centered gap-4">
        <AppButton type="button" color="borderless" @click="emit('update:show', false)"
          >Cancel</AppButton
        >
        <AppButton color="primary" type="button">Sign All</AppButton>
      </div>
    </div>
  </AppModal>
</template>
