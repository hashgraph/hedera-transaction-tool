<script setup lang="ts">
import { computed, ref } from 'vue';

import useContactsStore from '@renderer/stores/storeContacts';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppListItem from '@renderer/components/ui/AppListItem.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';

/* Props */
const props = defineProps<{
  show: boolean;
  alreadyAdded?: number[];
}>();

/* Emits */
const emit = defineEmits<{
  (event: 'update:show', show: boolean): void;
  (event: 'user-selected', userId: number): void;
}>();

/* Stores */
const contacts = useContactsStore();

/* State */
const userId = ref<number | null>(null);

/* Computed */
const listedContacts = computed(() =>
  props.alreadyAdded && props.alreadyAdded.length > 0
    ? contacts.contacts.filter(c => !props.alreadyAdded?.includes(c.user.id))
    : contacts.contacts,
);

/* Handlers */
const handleShowUpdate = show => emit('update:show', show);

const handleInsert = (e: Event) => {
  e.preventDefault();

  if (userId.value === null) return;

  emit('user-selected', userId.value);
  emit('update:show', false);
  userId.value = null;
};
</script>
<template>
  <AppModal :show="show" @update:show="handleShowUpdate" class="medium-modal">
    <div class="p-4">
      <form @submit="handleInsert">
        <div>
          <i class="bi bi-x-lg cursor-pointer" @click="$emit('update:show', false)"></i>
        </div>
        <h1 class="text-title text-semi-bold text-center">Select User</h1>
        <hr class="separator my-5" />
        <div>
          <h3 class="text-small">Contacts</h3>
          <template v-if="listedContacts.length > 0">
            <div class="mt-4 overflow-auto" :style="{ height: '20vh' }">
              <template v-for="contact in listedContacts" :key="contact.user.id">
                <AppListItem
                  class="mt-3"
                  :selected="contact.user.id === userId"
                  @click="userId = contact.user.id"
                >
                  <div class="d-flex flex-nowrap overflow-hidden">
                    <p
                      v-if="contact.nickname.trim().length > 0"
                      class="text-nowrap overflow-hidden me-4"
                      style="max-width: 50%"
                    >
                      <span class="ms-2 text-nowrap">{{ contact.nickname.trim() }}</span>
                    </p>
                    <div :class="[contact.nickname.trim().length > 0 ? 'border-start ps-4' : '']">
                      <span class="text-nowrap">{{ contact.user.email }}</span>
                    </div>
                  </div>
                </AppListItem>
              </template>
            </div>
          </template>
          <template v-else>
            <div class="flex-centered flex-column mt-4" :style="{ height: '20vh' }">
              <p class="text-muted">There are no selectable users</p>
            </div>
          </template>
        </div>

        <hr class="separator my-5" />

        <div class="flex-between-centered gap-4">
          <AppButton color="borderless" type="button" @click="handleShowUpdate(false)"
            >Cancel</AppButton
          >
          <AppButton
            color="primary"
            data-testid="button-add-user"
            type="submit"
            :disabled="userId === null"
            >Select</AppButton
          >
        </div>
      </form>
    </div>
  </AppModal>
</template>
