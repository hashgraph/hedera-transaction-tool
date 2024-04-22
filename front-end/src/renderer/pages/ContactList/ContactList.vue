<script setup lang="ts">
import AppButton from '@renderer/components/ui/AppButton.vue';
import { ref } from 'vue';
import AddNewContactForm from '@renderer/components/AddNewContactForm.vue';
import ContactDetails from '@renderer/components/ContactDetails.vue';
import useContactsStore from '@renderer/stores/storeContacts';

const contactsStore = useContactsStore();
void contactsStore.fetch();
const addNew = ref(false);
const selectedIndex = ref();

function handleAddNew() {
  addNew.value = true;
  selectedIndex.value = null;
}

function handleSelectContact(index: number) {
  selectedIndex.value = index;
  addNew.value = false;
}

function handleRemove() {
  selectedIndex.value = null;
  contactsStore.fetch();
}

function handleAddedContact() {
  selectedIndex.value = null;
}

function handleHideAddNew() {
  addNew.value = false;
}
</script>

<template>
  <div>
    <div class="d-flex justify-content-between p-4">
      <h1 class="text-title fw-semibold mb-3">Contact List</h1>
      <div class="d-flex align-items-center gap-4">
        <div class="px-5">Export Contact List</div>
        <div class="border py-3 ps-4" style="width: 205px">
          <div>Search Accounts</div>
        </div>
      </div>
    </div>
    <div class="mt-5 d-flex h-100">
      <div class="col-3 px-4 pt-4 border-end">
        <div class="pb-4 border-bottom">
          <AppButton color="primary" class="w-100" @click="handleAddNew"> Add New </AppButton>
        </div>
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
      <div class="col flex-grow-1 mt-3">
        <Transition name="fade" mode="out-in">
          <div v-if="addNew">
            <AddNewContactForm
              @hide-add-new="handleHideAddNew"
              @update:added-contact="handleAddedContact"
            />
          </div>
        </Transition>
        <div v-if="selectedIndex != null && contactsStore.contacts">
          <ContactDetails
            :contact="contactsStore.contacts[selectedIndex]"
            @update:remove="handleRemove"
          />
        </div>
      </div>
    </div>
  </div>
</template>
