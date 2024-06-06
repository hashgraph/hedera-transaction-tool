<script setup lang="ts">
import { computed, ref } from 'vue';

import useContactsStore from '@renderer/stores/storeContacts';

import AppButton from '@renderer/components/ui/AppButton.vue';
import UserSelectModal from '@renderer/components/Organization/UserSelectModal.vue';

/* Props */
const props = defineProps<{
  addable: boolean;
  editable: boolean;
  userIds: number[];
}>();

/* Emits */
const emit = defineEmits(['update:userIds']);

/* Stores */
const contacts = useContactsStore();

/* State */
const selectUserModalShown = ref(false);

/* Computed */
const users = computed(() =>
  contacts.contacts.filter(contact => props.userIds.includes(contact.user.id)),
);

/* Handlers */
const handleSelectUser = (userIds: number[]) => {
  const oldUserIds = new Set<number>(props.userIds);
  userIds.forEach(id => oldUserIds.add(id));
  emit('update:userIds', [...userIds]);
};

const handleRemoveObserver = (userId: number) => {
  emit(
    'update:userIds',
    props.userIds.filter(id => id !== userId),
  );
};
</script>
<template>
  <div>
    <div v-if="addable">
      <AppButton
        :color="'borderless'"
        :size="'small'"
        type="button"
        class="text-small min-w-unset"
        @click="selectUserModalShown = true"
        ><span class="bi bi-plus-lg"></span> Add</AppButton
      >
    </div>
    <div class="mt-3">
      <ul class="d-flex flex-wrap gap-3">
        <template v-for="{ user, nickname } in users" :key="user.email">
          <li class="text-center badge-bg rounded py-2 px-3">
            <p class="text-small text-nowrap">
              <span
                v-if="editable"
                class="bi bi-x-lg text-micro cursor-pointer me-2"
                @click="handleRemoveObserver(user.id)"
              ></span>
              <span>
                {{ user.email }}
              </span>
              <span v-if="nickname.trim().length > 0"> ({{ nickname }})</span>
            </p>
          </li>
        </template>
      </ul>
    </div>
    <UserSelectModal
      v-model:show="selectUserModalShown"
      :alreadyAdded="userIds"
      :mulitple="true"
      @users-selected="handleSelectUser"
    />
  </div>
</template>
