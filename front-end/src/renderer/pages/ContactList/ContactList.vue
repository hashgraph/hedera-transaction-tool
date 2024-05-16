<script setup lang="ts">
import { computed, onBeforeMount, ref, watch } from 'vue';

import { HederaAccount } from '@prisma/client';

import { Contact } from '@main/shared/interfaces';

import useUserStore from '@renderer/stores/storeUser';
import useNetworkStore from '@renderer/stores/storeNetwork';
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
const network = useNetworkStore();
const contacts = useContactsStore();

/* Composables */
const toast = useToast();
const router = useRouter();

/* State */
const selectedId = ref<number | null>(null);
const isDeleteContactModalShown = ref(false);
const linkedAccounts = ref<HederaAccount[]>([]);

/* Computed */
const contact = computed<Contact | null>(
  () => contacts.contacts.find(c => c.user.id === selectedId.value) || null,
);

const contactList = computed(() =>
  contacts.contacts.filter(c =>
    isLoggedInOrganization(user.selectedOrganization) && user.selectedOrganization.admin
      ? true
      : !c.user.admin && c.userKeys.length > 0,
  ),
);

/* Handlers */
function handleSelectContact(id: number) {
  selectedId.value = id;
}

async function handleRemove() {
  if (!isUserLoggedIn(user.personal)) throw new Error('User is not logged in');
  if (!contact.value) throw new Error('Contact is not selected');

  if (isLoggedInOrganization(user.selectedOrganization) && user.selectedOrganization.admin) {
    await deleteUser(user.selectedOrganization.serverUrl, contact.value.user.id);
    contact.value.nicknameId && (await removeContact(user.personal.id, contact.value.nicknameId));
  }

  toast.success('User removed successfully');

  selectedId.value = null;
  await contacts.fetch();
}

/* Hooks */
onBeforeMount(async () => {
  await contacts.fetch();

  if (isUserLoggedIn(user.personal)) {
    linkedAccounts.value = await getAll({
      where: {
        user_id: user.personal.id,
        network: network.network,
      },
    });
    selectedId.value = contactList.value[0]?.user?.id || null;
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
            <template v-for="c in contactList" :key="c.user.id">
              <div
                class="container-card-account overflow-hidden p-4 mt-3"
                :class="{
                  'is-selected': c.user.id === selectedId,
                }"
                @click="handleSelectContact(c.user.id)"
              >
                <p class="text-small text-semi-bold overflow-hidden">{{ c.nickname }}</p>
                <div class="d-flex justify-content-between align-items-center">
                  <p class="text-micro text-secondary overflow-hidden mt-2">{{ c.user.email }}</p>
                </div>
              </div>
            </template>
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
