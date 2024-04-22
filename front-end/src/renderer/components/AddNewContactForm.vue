<script setup lang="ts">
import { ref } from 'vue';
import AppInput from './ui/AppInput.vue';
import AppButton from './ui/AppButton.vue';
import useContactsStore from '@renderer/stores/storeContacts';
import AddAssociatedAccountModal from './AddAssociatedAccountModal.vue';
import useUserStore from '@renderer/stores/storeUser';

const isAddAccountModalShown = ref(false);

const emit = defineEmits(['update:addNew', 'update:addedContact']);

const contact = ref({
  keyName: '',
  publicKey: '',
  organization: '',
  associatedAccounts: new Array<string>(),
});

const contactsStore = useContactsStore();
const userStore = useUserStore();

const accountId = ref('');

async function handleAddContact() {
  await contactsStore.add(
    userStore.data.id,
    contact.value.keyName,
    contact.value.publicKey,
    contact.value.organization,
    contact.value.associatedAccounts,
  );
  contactsStore.fetch();
  emit('update:addedContact');
}
//30582e1e39be8c11c584dfe99ebe959e1c5f475b4c9390b21ce5b81e43821849
function onUpdateAccountId() {
  contact.value.associatedAccounts.push(accountId.value);
}
</script>

<template>
  <form @submit.prevent="handleAddContact" class="mx-5 col-5">
    <div class="d-flex justify-content-between align-items-center flex-wrap gap-3">
      <div class="d-flex align-items-center">
        <AppButton
          @click="emit('update:addNew', false)"
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
    <label class="form-label mt-5">Public Key</label>
    <AppInput
      v-model="contact.publicKey"
      :filled="true"
      type="string"
      placeholder="Enter Public Key"
    />
    <label class="form-label mt-5">Organization</label>
    <AppInput
      v-model="contact.organization"
      :filled="true"
      type="string"
      placeholder="Enter Organization Name"
    />
    <div v-if="contact.associatedAccounts.length > 0" class="mt-5">
      <ul v-for="accountId in contact.associatedAccounts" :key="accountId" class="mt-3">
        <li
          class="col-4 py-2 px-3 text-center"
          style="background-color: #edefff; border-radius: 6px; font-weight: 600"
        >
          {{ accountId }}
        </li>
      </ul>
    </div>
    <div class="py-5 border-bottom">
      <AppButton
        @click="isAddAccountModalShown = !isAddAccountModalShown"
        type="button"
        style="color: #777abb; padding: 0; border: none; font-weight: 700"
        >+ Add Associated Accounts</AppButton
      >
    </div>
    <div class="mt-5 d-flex gap-4">
      <AppButton type="submit" color="primary" class="w-100">Save</AppButton>
      <AppButton
        @click="emit('update:addNew', false)"
        type="button"
        color="primary"
        outline
        class="w-100"
        >Cancel</AppButton
      >
    </div>
  </form>
  <AddAssociatedAccountModal
    v-model:show="isAddAccountModalShown"
    v-model:account="accountId"
    @update:account="onUpdateAccountId"
  />
</template>
