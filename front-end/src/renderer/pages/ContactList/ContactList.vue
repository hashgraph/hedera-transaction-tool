<script setup lang="ts">
import type { HederaAccount } from '@prisma/client';
import { NotificationType, type Contact } from '@shared/interfaces';

import { computed, onBeforeMount, ref } from 'vue';

import useUserStore from '@renderer/stores/storeUser';
import useNetworkStore from '@renderer/stores/storeNetwork';
import useContactsStore from '@renderer/stores/storeContacts';
import useNotifcationsStore from '@renderer/stores/storeNotifications';

import { useToast } from 'vue-toast-notification';
import useRedirectOnOnlyOrganization from '@renderer/composables/useRedirectOnOnlyOrganization';
import useSetDynamicLayout, { LOGGED_IN_LAYOUT } from '@renderer/composables/useSetDynamicLayout';
import useMarkNotifications from '@renderer/composables/useMarkNotifications';

import { deleteUser, elevateUserToAdmin } from '@renderer/services/organization';
import { removeContact } from '@renderer/services/contactsService';
import { getAll } from '@renderer/services/accountsService';

import {
  assertIsLoggedInOrganization,
  assertUserLoggedIn,
  isLoggedInOrganization,
  isUserLoggedIn,
} from '@renderer/utils';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppLoader from '@renderer/components/ui/AppLoader.vue';
import ContactDetails from '@renderer/components/Contacts/ContactDetails.vue';
import DeleteContactModal from '@renderer/components/Contacts/DeleteContactModal.vue';
import ElevateContactModal from '@renderer/components/Contacts/ElevateContactModal.vue';
import { successToastOptions } from '@renderer/utils/toastOptions.ts';

/* Stores */
const user = useUserStore();
const network = useNetworkStore();
const contacts = useContactsStore();
const notifications = useNotifcationsStore();

/* Composables */
const toast = useToast();
useRedirectOnOnlyOrganization();
useSetDynamicLayout(LOGGED_IN_LAYOUT);
const { oldNotifications } = useMarkNotifications([NotificationType.USER_REGISTERED]);

/* State */
const selectedId = ref<number | null>(null);
const isDeleteContactModalShown = ref(false);
const isElevateToAdminModalShown = ref(false);
const linkedAccounts = ref<HederaAccount[]>([]);

/* Computed */
const contact = computed<Contact | null>(
  () => contacts.contacts.find(c => c.user.id === selectedId.value) || null,
);

const isAdmin = computed(
  () => isLoggedInOrganization(user.selectedOrganization) && user.selectedOrganization.admin,
);

const contactList = computed(() =>
  contacts.contacts
    .filter(c =>
      isLoggedInOrganization(user.selectedOrganization) && user.selectedOrganization.admin
        ? true
        : c.userKeys.length > 0,
    )
    .sort((a, b) => {
      const getPriority = (user: typeof a.user) => (user.admin ? 0 : user.status === 'NEW' ? 1 : 2);
      return getPriority(a.user) - getPriority(b.user);
    }),
);

const updateAvailableUserIds = computed(() => {
  const ids = new Set<number>();
  for (const c of contactList.value) {
    if (c.user.updateAvailable) {
      ids.add(c.user.id);
    }
  }
  return ids;
});

const notifiedUserIds = computed(() => {
  const notificationsKey = user.selectedOrganization?.serverUrl || '';
  const result = [];
  for (const notification of notifications.notifications[notificationsKey]?.concat(
    oldNotifications.value,
  ) || []) {
    if (
      notification.notification.type === NotificationType.USER_REGISTERED &&
      notification.notification.entityId
    ) {
      result.push(notification.notification.entityId);
    }
  }
  return result;
});

/* Handlers */
async function handleSelectContact(id: number) {
  selectedId.value = id;
}

async function handleRemove() {
  assertUserLoggedIn(user.personal);
  if (!contact.value) throw new Error('Contact is not selected');

  if (isLoggedInOrganization(user.selectedOrganization) && user.selectedOrganization.admin) {
    await deleteUser(user.selectedOrganization.serverUrl, contact.value.user.id);
    contact.value.nicknameId && (await removeContact(user.personal.id, contact.value.nicknameId));
  }

  toast.success('User removed successfully', successToastOptions);
  selectedId.value = null;
  await contacts.fetch();
}

async function handleElevate() {
  assertUserLoggedIn(user.personal);
  assertIsLoggedInOrganization(user.selectedOrganization);
  if (!contact.value) throw new Error('Contact is not selected');
  if (!user.selectedOrganization.admin) {
    throw new Error('User is not an admin');
  }

  await elevateUserToAdmin(user.selectedOrganization.serverUrl, contact.value.user.id);

  toast.success('User elevate to admin successfully', successToastOptions);
  selectedId.value = null;
  await contacts.fetch();
}

/* Hooks */
onBeforeMount(async () => {
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
</script>

<template>
  <div class="px-4 px-xxl-6 py-5">
    <div class="container-fluid flex-column-100">
      <div class="d-flex justify-content-between">
        <h1 class="text-title text-bold">Contact List</h1>
      </div>

      <div class="row g-0 fill-remaining mt-6">
        <div class="col-4 col-xxl-3 flex-column-100 overflow-hidden with-border-end pe-4 ps-0">
          <template
            v-if="
              isLoggedInOrganization(user.selectedOrganization) && user.selectedOrganization.admin
            "
          >
            <AppButton
              color="primary"
              data-testid="button-add-new-contact"
              size="large"
              class="w-100"
              :disabled="
                !isLoggedInOrganization(user.selectedOrganization) ||
                !user.selectedOrganization.admin
              "
              @click="$router.push({ name: 'signUpUser' })"
            >
              Add New
            </AppButton>

            <hr class="separator my-5" />
          </template>

          <div class="fill-remaining pe-3">
            <template v-if="contacts.fetching">
              <div class="mt-5">
                <AppLoader />
              </div>
            </template>
            <template v-else-if="contactList.length > 0">
              <template v-for="c in contactList" :key="c.user.id">
                <div
                  class="container-multiple-select overflow-hidden p-4 mt-3"
                  :class="{ 'is-selected': c.user.id === selectedId }"
                  @click="handleSelectContact(c.user.id)"
                >
                  <div class="position-relative">
                    <template v-if="notifiedUserIds.includes(c.user.id)">
                      <span
                        class="indicator-circle position-absolute absolute-centered"
                        :style="{
                          left: '-8px',
                          top: '0px',
                          width: '8px',
                          height: '8px',
                        }"
                      ></span>
                    </template>
                    <p
                      class="text-small text-semi-bold overflow-hidden"
                      :data-testid="`p-contact-nickname-${c.nickname}`"
                    >
                      {{ c.nickname }}
                    </p>
                    <div class="d-flex justify-content-between align-items-center">
                      <p
                        class="text-micro text-secondary overflow-hidden mt-2"
                        :data-testid="`p-contact-email-${c.user.email}`"
                      >
                        {{ c.user.email }}
                      </p>
                    </div>
                    <div v-if="c.user.admin || c.user.status === 'NEW' || (isAdmin && updateAvailableUserIds.has(c.user.id))" class="mt-2">
                      <span v-if="c.user.admin" class="badge bg-warning me-2">admin</span>
                      <span v-if="c.user.status === 'NEW'" class="badge bg-info me-2">new</span>
                      <span v-if="isAdmin && updateAvailableUserIds.has(c.user.id)" class="badge bg-success">update available</span>
                    </div>
                  </div>
                </div>
              </template>
            </template>
            <template v-else>
              <p class="text-small text-semi-bold text-center mt-5">No contacts found</p>
            </template>
          </div>
        </div>

        <div class="col-8 col-xxl-9 flex-column-100 ps-4">
          <Transition name="fade" mode="out-in">
            <div v-if="contact" class="container-fluid flex-column-100 position-relative">
              <ContactDetails
                :contact="contact"
                v-model:linked-accounts="linkedAccounts"
                @remove="isDeleteContactModalShown = true"
                @elevate-to-admin="isElevateToAdminModalShown = true"
              />
            </div>
          </Transition>
        </div>

        <DeleteContactModal
          v-model:show="isDeleteContactModalShown"
          @update:delete="handleRemove"
          :contact="contact"
        />

        <ElevateContactModal v-model:show="isElevateToAdminModalShown" @elevate="handleElevate" />
      </div>
    </div>
  </div>
</template>
