<script setup lang="ts">
import { ref, watch } from 'vue';
import AppInput from './ui/AppInput.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';
import AppButton from './ui/AppButton.vue';

/* Props */
const props = defineProps<{
  show: boolean;
}>();

/* Emits */
const emit = defineEmits(['update:show', 'update:account']);

/* State */
const show = ref(props.show);
const accountId = ref('');

/* Watches */
watch(
  () => props.show,
  value => {
    show.value = value;
  },
);

/* Handlers */
function handleAddAccount() {
  emit('update:account', accountId.value);
  emit('update:show', false);
  accountId.value = '';
}
</script>
<template>
  <AppModal v-model:show="show" @update:show="emit('update:show', show)" class="medium-modal">
    <div class="p-5" style="height: 330px">
      <form @submit.prevent="handleAddAccount">
        <label class="form-label">Accounts</label>
        <div class="pb-5 border-bottom">
          <AppInput
            v-model="accountId"
            :filled="true"
            type="string"
            placeholder="Enter Account ID"
          />
        </div>
        <div style="height: 125px" />
        <div class="d-flex pt-5 border-top">
          <AppButton
            type="button"
            color="borderless"
            class="w-100"
            @click="emit('update:show', false)"
            >Cancel</AppButton
          >
          <div class="col-3" />
          <AppButton type="submit" color="primary" class="w-100">Insert</AppButton>
        </div>
      </form>
    </div>
  </AppModal>
</template>
