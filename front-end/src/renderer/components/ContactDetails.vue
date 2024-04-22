<script setup lang="ts">
import useContactsStore, { Contact } from '@renderer/stores/storeContacts';
import DeleteContact from './DeleteContact.vue';
import AppButton from './ui/AppButton.vue';
import useUserStore from '@renderer/stores/storeUser';
import { ref } from 'vue';
import useThemeStore from '@renderer/stores/storeTheme';

/* Props */
const props = defineProps<{
  contact: Contact | undefined;
}>();

/* Stores */
const contactStore = useContactsStore();
const userStore = useUserStore();
const theme = useThemeStore();

/* State */
const isDeleteContactModalShown = ref(false);

/* Emits */
const emit = defineEmits(['update:remove', 'edit']);

/* Handlers */
async function handleRemove() {
  isDeleteContactModalShown.value = true;
}

async function handleDeleteContact() {
  if (userStore.personal?.isLoggedIn) {
    await contactStore.remove(userStore.personal.id, props.contact.id);
    emit('update:remove');
    contactStore.fetch();
  }
}

async function handleEdit() {
  emit('edit');
}
</script>

<template>
  <div class="mt-5 mx-5" style="font-size: 14px">
    <div class="row col-11">
      <div class="col-4">User Nickname</div>
      <div class="col">{{ contact?.key_name }}</div>
    </div>
    <div v-if="contact != undefined && contact.public_keys.length > 0">
      <div
        class="mt-5 row col-11"
        v-for="(publicKey, index) in contact.public_keys"
        :key="publicKey.public_key"
      >
        <div class="col-4" v-if="index == 0">Public Key</div>
        <div class="col-4" v-else></div>
        <div class="col">
          <div>
            {{ publicKey.public_key.slice(0, 32) }}
          </div>
          <div>{{ publicKey.public_key.slice(32) }}</div>
          <div style="color: #ff66ff">ED25519</div>
        </div>
      </div>
    </div>
    <div class="row mt-3 border-bottom col-11" style="height: 136px">
      <div class="col-4">Associated Accounts</div>
      <div class="col-4">
        <ul
          v-for="associated_account in contact?.associated_accounts"
          :key="associated_account.account_id"
          class="d-flex"
        >
          <li
            class="py-2 px-3 text-center"
            :class="
              associated_account.account_id != contact.associated_accounts[0].account_id
                ? 'mt-3'
                : ''
            "
            style="border-radius: 6px; font-weight: 600"
            :style="theme.isDark ? 'background-color: #333666' : 'background-color: #edefff'"
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
        :disabled="
          userStore.selectedOrganization?.isServerActive &&
          !userStore.selectedOrganization.loginRequired
        "
        >Remove</AppButton
      >
      <AppButton type="button" color="primary" class="w-100" @click="handleEdit">Edit</AppButton>
    </div>
    <DeleteContact v-model:show="isDeleteContactModalShown" @update:delete="handleDeleteContact" />
  </div>
</template>
