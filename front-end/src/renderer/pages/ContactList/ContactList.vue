<script setup lang="ts">
import { computed, onBeforeMount, ref, watch } from 'vue';

import { HederaAccount } from '@prisma/client';

import { Contact } from '@main/shared/interfaces';

import useUserStore from '@renderer/stores/storeUser';
import useContactsStore from '@renderer/stores/storeContacts';

import { useToast } from 'vue-toast-notification';
import { useRouter } from 'vue-router';

import { deleteUser } from '@renderer/services/organization';
import { removeContact } from '@renderer/services/contactsService';
import { getAll } from '@renderer/services/accountsService';

import { isLoggedInOrganization, isUserLoggedIn } from '@renderer/utils/userStoreHelpers';

import AppButton from '@renderer/components/ui/AppButton.vue';
import ContactDetails from '@renderer/components/Contacts/ContactDetails.vue';
import DeleteContactModal from '@renderer/components/Contacts/DeleteContactModal.vue';

/* Stores */
const user = useUserStore();
const contacts = useContactsStore();

/* Composables */
const toast = useToast();
const router = useRouter();

/* State */
const selectedIndex = ref<number>(0);
const isDeleteContactModalShown = ref(false);
const linkedAccounts = ref<HederaAccount[]>([]);

/* Computed */
const contact = computed<Contact | null>(() => contacts.contacts[selectedIndex.value] || null);

/* Handlers */
function handleSelectContact(index: number) {
  selectedIndex.value = index;
}

async function handleRemove() {
  if (!isUserLoggedIn(user.personal)) throw new Error('User is not logged in');
  if (!contact.value) throw new Error('Contact is not selected');

  if (isLoggedInOrganization(user.selectedOrganization) && user.selectedOrganization.admin) {
    await deleteUser(user.selectedOrganization.serverUrl, contact.value.user.id);
    contact.value.nicknameId && (await removeContact(user.personal.id, contact.value.nicknameId));
  }

  toast.success('User removed successfully');

  selectedIndex.value = 0;
  await contacts.fetch();
}

/* Hooks */
onBeforeMount(async () => {
  await contacts.fetch();

  if (isUserLoggedIn(user.personal)) {
    linkedAccounts.value = await getAll(user.personal.id);
  }
});

/* Watchers */
watch(
  () => user.selectedOrganization,
  () => {
    if (!isLoggedInOrganization(user.selectedOrganization)) {
      router.push({ name: 'transactions' });
    }
  },
);
</script>

<template>
  <div class="px-6 py-5">
    <div class="container-fluid flex-column-100">
      <div class="d-flex justify-content-between">
        <h1 class="text-title text-bold">Contact List</h1>
      </div>

      <div class="row g-0 fill-remaining mt-6">
        <div class="col-4 col-xxl-3 flex-column-100 overflow-hidden with-border-end pe-4 ps-0">
          <AppButton
            color="primary"
            size="large"
            class="w-100"
            :disabled="
              !isLoggedInOrganization(user.selectedOrganization) || !user.selectedOrganization.admin
            "
            @click="$router.push({ name: 'signUpUser' })"
          >
            Add New
          </AppButton>

          <hr class="separator my-5" />
          <div class="fill-remaining pe-3">
            <div v-for="(contact, i) in contacts.contacts" :key="contact.user.id">
              <div
                class="container-card-account p-4 mt-3"
                :class="{
                  'is-selected': selectedIndex === i,
                }"
                @click="handleSelectContact(i)"
              >
                <div class="d-flex justify-content-between">
                  <p class="text-small text-semi-bold text-truncate">
                    {{ contact.nickname.trim() || contact.user.email }}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="col-8 col-xxl-9 flex-column-100 ps-4">
          <Transition name="fade" mode="out-in">
            <div v-if="contact" class="container-fluid flex-column-100 position-relative">
              <ContactDetails
                :contact="contact"
                :linked-accounts="linkedAccounts"
                @update:remove="isDeleteContactModalShown = true"
              />
            </div>
          </Transition>
        </div>

        <DeleteContactModal
          v-model:show="isDeleteContactModalShown"
          @update:delete="handleRemove"
          :contact="contact"
        />
      </div>
    </div>
  </div>
</template>
