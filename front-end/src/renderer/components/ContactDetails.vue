<script setup lang="ts">
import useContactsStore, { Contact } from '@renderer/stores/storeContacts';
import DeleteContact from './DeleteContact.vue';
import AppButton from './ui/AppButton.vue';
import useUserStore from '@renderer/stores/storeUser';
import { ref } from 'vue';

const props = defineProps<{
  contact: Contact;
}>();

const isDeleteContactModalShown = ref(false);

const emit = defineEmits(['update:remove']);

const contactStore = useContactsStore();
const userStore = useUserStore();

async function handleRemove() {
  isDeleteContactModalShown.value = true;
}

async function handleDeleteContact() {
  await contactStore.remove(userStore.data.id, props.contact.id);
  emit('update:remove');
}
</script>

<template>
  <div class="mt-5 mx-5" style="font-size: 14px">
    <div class="row col-11">
      <div class="col-4">User Nickname</div>
      <div class="col">{{ contact?.key_name }}</div>
    </div>
    <div class="mt-5 row col-11">
      <div class="col-4">Public Key</div>
      <div class="col">
        <div>
          {{ contact?.public_key.slice(0, 32) }}
        </div>
        <div>{{ contact?.public_key.slice(32) }}</div>
        <div style="color: #ff66ff">ED25519</div>
      </div>
    </div>
    <div class="row mt-3 border-bottom col-11" style="height: 136px">
      <div class="col-4">Associated Accounts</div>
      <div class="col-4">
        <ul
          v-for="associated_account in contact?.associated_accounts"
          :key="associated_account.account_id"
        >
          <li
            class="col-5 py-2 px-3 text-center flex-shrink-1"
            style="background-color: #edefff; border-radius: 6px; font-weight: 600"
          >
            {{ associated_account.account_id }}
          </li>
        </ul>
      </div>
    </div>
    <div class="mt-5 d-flex gap-4 col-5">
      <AppButton
        @click="handleRemove()"
        type="button"
        color="primary"
        outline
        class="w-100"
        style="color: red; border-color: red"
        >Remove</AppButton
      >
      <AppButton type="button" color="primary" class="w-100" disabled>Edit</AppButton>
    </div>
    <DeleteContact v-model:show="isDeleteContactModalShown" @update:delete="handleDeleteContact" />
  </div>
</template>
