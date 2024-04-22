<script setup lang="ts">
import { ref } from 'vue';
import AppInput from './ui/AppInput.vue';
import AppButton from './ui/AppButton.vue';
import useContactsStore from '@renderer/stores/storeContacts';
import AddAssociatedAccountModal from './AddAssociatedAccountModal.vue';
import useUserStore from '@renderer/stores/storeUser';

/* Stores */
const contactsStore = useContactsStore();
const userStore = useUserStore();

/* Emits */
const emit = defineEmits(['hideAddNew', 'update:addedContact']);

/* State */
const contact = ref({
  keyName: '',
  email: '',
  publicKey: '',
  organization: '',
  associatedAccounts: new Array<string>(),
});

const isAddAccountModalShown = ref(false);

const accountId = ref('');

/* Handlers */
async function handleAddContact() {
  if (userStore.personal?.isLoggedIn) {
    await contactsStore.add(
      userStore.personal?.id,
      contact.value.keyName,
      contact.value.email,
      null,
      null,
      contact.value.associatedAccounts,
      [contact.value.publicKey],
    );
    contactsStore.fetch();
    emit('update:addedContact');
  }
}

function onUpdateAccountId() {
  contact.value.associatedAccounts.push(accountId.value);
}
</script>

<template>
  <form @submit.prevent="handleAddContact" class="mx-5 col-5">
    <div class="d-flex justify-content-between align-items-center flex-wrap gap-3">
      <div class="d-flex align-items-center">
        <AppButton
          @click="emit('hideAddNew', false)"
          type="button"
          color="alternate"
          class="btn-icon-only me-4"
        >
          <i class="bi bi-arrow-left" style="color: #222444"></i>
        </AppButton>
      </div>
    </div>
    <label class="form-label mt-5">Key Name</label>
    <AppInput v-model="contact.keyName" :filled="true" type="string" placeholder="Enter Key Name" />
    <label class="form-label mt-5">Email</label>
    <AppInput v-model="contact.email" :filled="true" type="string" placeholder="Enter Key Name" />
    <label class="form-label mt-5">Public Key</label>
    <AppInput
      v-model="contact.publicKey"
      :filled="true"
      type="string"
      placeholder="Enter Public Key"
    />
    <div v-if="contact.associatedAccounts.length > 0" class="mt-5">
      <ul v-for="accountId in contact.associatedAccounts" :key="accountId" class="mt-3 d-flex">
        <li class="py-2 px-3 text-center flex-shrink-1 badge text-bg-secondary">
          {{ accountId }}
        </li>
      </ul>
    </div>
    <div class="py-5 border-bottom">
      <AppButton
        color="borderless"
        @click="isAddAccountModalShown = !isAddAccountModalShown"
        size="small"
        >+ Add Associated Accounts</AppButton
      >
    </div>
    <div class="mt-5 d-flex gap-4">
      <AppButton @click="emit('hideAddNew', false)" color="borderless" outline class="w-100"
        >Cancel</AppButton
      >
      <AppButton type="submit" color="secondary" class="w-100">Save</AppButton>
    </div>
  </form>
  <AddAssociatedAccountModal
    v-model:show="isAddAccountModalShown"
    v-model:account="accountId"
    @update:account="onUpdateAccountId"
  />
</template>
