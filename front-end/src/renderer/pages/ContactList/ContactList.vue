<script setup lang="ts">
import AppButton from '@renderer/components/ui/AppButton.vue';
import { onBeforeMount, ref } from 'vue';
import AddNewContactForm from '@renderer/components/AddNewContactForm.vue';
import ContactDetails from '@renderer/components/ContactDetails.vue';
import useContactsStore from '@renderer/stores/storeContacts';
import useUserStore from '@renderer/stores/storeUser';
import EditContactForm from '@renderer/components/EditContactForm.vue';

/* Stores */
const contactsStore = useContactsStore();
const userStore = useUserStore();

/* State */
onBeforeMount(async () => {
  await contactsStore.fetch();
});
const addNew = ref(false);
const edit = ref(false);
const selectedIndex = ref();

/* Handlers */
async function handleAddNew() {
  addNew.value = true;
  selectedIndex.value = null;
}

function handleSelectContact(index: number) {
  selectedIndex.value = index;
  addNew.value = false;
}

async function handleRemove() {
  selectedIndex.value = null;
  await contactsStore.fetch();
}

async function handleAddedContact() {
  selectedIndex.value = null;
  await contactsStore.fetch();
}

function handleHideAddNew() {
  addNew.value = false;
}

function handleEdit() {
  edit.value = true;
}

async function handleHideEdit() {
  edit.value = false;
  await contactsStore.fetch();
}
</script>

<template>
  <div class="px-6 py-5">
    <div class="container-fluid flex-column-100">
      <div class="d-flex justify-content-between">
        <h1 class="text-title text-bold">Contact List</h1>
        <!-- <div class="d-flex align-items-center justify-content-end gap-4">
          <span class="px-5 link-primary text-small cursor-pointer ws-no-wrap"
            >Export Contact List</span
          >
          <input class="form-control" placeholder="Search Accounts" />
        </div> -->
      </div>

      <div class="row g-0 fill-remaining mt-6">
        <div class="col-4 col-xxl-3 flex-column-100 overflow-hidden with-border-end pe-4 ps-0">
          <div class="pb-5">
            <AppButton
              color="primary"
              size="large"
              class="w-100"
              @click="handleAddNew"
              :disabled="
                userStore.selectedOrganization?.isServerActive &&
                !userStore.selectedOrganization.loginRequired
              "
            >
              Add New
            </AppButton>
          </div>

          <hr class="separator my-5" />
          <div class="fill-remaining pe-3" v-if="contactsStore.contacts">
            <div v-for="contact in contactsStore.contacts" :key="contact.id">
              <div
                class="container-card-account p-4 mt-3"
                :class="{
                  'is-selected': selectedIndex === contactsStore.contacts?.indexOf(contact),
                }"
                @click="handleSelectContact(contactsStore.contacts!.indexOf(contact))"
              >
                <div class="d-flex justify-content-between">
                  <p class="text-small text-semi-bold text-truncate">{{ contact?.key_name }}</p>
                  <p
                    class="text-small py-1 px-3 text-truncate"
                    style="background-color: #e5ccff; border-radius: 4px; color: black"
                  >
                    {{ contact?.organization }}
                  </p>
                </div>
                <div class="d-flex justify-content-between align-items-center">
                  <p class="text-micro text-secondary mt-2 text-truncate">
                    {{ contact?.associated_accounts[0]?.account_id }}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="col-8 col-xxl-9 flex-column-100 ps-4">
          <Transition name="fade" mode="out-in">
            <div v-if="addNew">
              <AddNewContactForm
                @hide-add-new="handleHideAddNew"
                @update:added-contact="handleAddedContact"
              />
            </div>
          </Transition>
          <div v-if="selectedIndex != null && contactsStore.contacts && !edit">
            <ContactDetails
              :contact="contactsStore.contacts[selectedIndex]"
              @update:remove="handleRemove"
              @edit="handleEdit"
            />
          </div>
          <div v-if="selectedIndex != null && contactsStore.contacts && edit">
            <EditContactForm
              :contact="contactsStore.contacts[selectedIndex]"
              @hide-edit="handleHideEdit"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
