<script setup lang="ts">
import { ref } from 'vue';
import AppInput from './ui/AppInput.vue';
import AppButton from './ui/AppButton.vue';
import useContactsStore, { Contact } from '@renderer/stores/storeContacts';
import useUserStore from '@renderer/stores/storeUser';

/* Stores */
const contactsStore = useContactsStore();
const userStore = useUserStore();

/* Props */
const props = defineProps<{
  contact: Contact;
}>();

/* Emits */
const emit = defineEmits(['hideEdit']);

/* State */
const keyName = ref('');

/* Handlers */
async function handleEditContact() {
  if (userStore.personal?.isLoggedIn) {
    await contactsStore.edit(props.contact.id, userStore.personal?.id, keyName.value);
    emit('hideEdit');
  }
}
</script>

<template>
  <form @submit.prevent="handleEditContact" class="mx-5 col-5">
    <div class="d-flex justify-content-between align-items-center flex-wrap gap-3">
      <div class="d-flex align-items-center">
        <AppButton
          @click="emit('hideEdit')"
          type="button"
          color="alternate"
          class="btn-icon-only me-4"
        >
          <i class="bi bi-arrow-left" style="color: #222444"></i>
        </AppButton>
      </div>
    </div>
    <label class="form-label mt-5">Key Name</label>
    <AppInput v-model="keyName" :filled="true" type="string" placeholder="Enter Key Name" />
    <div class="mt-5 d-flex gap-4">
      <AppButton @click="emit('hideEdit')" color="borderless" outline class="w-100"
        >Cancel</AppButton
      >
      <AppButton type="submit" color="secondary" class="w-100">Save</AppButton>
    </div>
  </form>
</template>
