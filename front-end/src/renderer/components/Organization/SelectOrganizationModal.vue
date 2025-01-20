<script setup lang="ts">
import type { Organization } from '@prisma/client';

import { onBeforeMount, ref } from 'vue';

import { getOrganizations } from '@renderer/services/organizationsService';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppListItem from '@renderer/components/ui/AppListItem.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';

/* Props */
defineProps<{
  show: boolean;
}>();

/* Emits */
const emit = defineEmits<{
  (event: 'update:show', show: boolean): void;
  (event: 'onSelected', value: Organization): void;
}>();

/* State */
const search = ref<string>('');
const selectedOrganization = ref<Organization | null>(null);
const organizations = ref<Organization[]>([]);

/* Handlers */
const handleShowUpdate = (show: boolean) => emit('update:show', show);

const handleSelect = () => {
  if (selectedOrganization.value) {
    emit('onSelected', selectedOrganization.value);
    handleShowUpdate(false);
  }
};

/* Hooks */
onBeforeMount(async () => {
  organizations.value = await getOrganizations();
});
</script>
<template>
  <AppModal :show="show" @update:show="handleShowUpdate" class="medium-modal">
    <div class="p-4">
      <form @submit.prevent="handleSelect">
        <div>
          <i class="bi bi-x-lg cursor-pointer" @click="$emit('update:show', false)"></i>
        </div>
        <h1 class="text-title text-semi-bold text-center">Select Organization</h1>
        <div class="mt-5">
          <AppInput
            v-model:model-value="search"
            filled
            type="text"
            placeholder="Search organization"
          />
        </div>
        <hr class="separator my-5" />
        <div>
          <!-- <h3 class="text-small">Recent</h3> -->
          <div class="mt-4 overflow-auto" :style="{ height: '158px' }">
            <template
              v-for="organization in organizations.filter(
                org =>
                  org.nickname.toLocaleLowerCase().includes(search) ||
                  org.serverUrl.includes(search),
              )"
              :key="organization.id"
            >
              <AppListItem
                class="mt-3"
                :selected="organization.id === selectedOrganization?.id"
                :value="organization.id"
                @click="selectedOrganization = organization"
              >
                <div class="d-flex overflow-hidden">
                  <p class="text-nowrap">
                    <span class="bi bi-people m-2"></span>
                    <span class="ms-2 text-nowrap">{{ organization.nickname }}</span>
                  </p>
                  <div class="border-start px-4 mx-4">
                    <span class="text-nowrap">{{ organization.serverUrl }}</span>
                  </div>
                </div>
              </AppListItem>
            </template>
          </div>
        </div>

        <hr class="separator my-5" />

        <div class="flex-between-centered gap-4">
          <AppButton color="secondary" type="button" @click="handleShowUpdate(false)"
            >Cancel</AppButton
          >
          <AppButton color="primary" type="submit" :disabled="!selectedOrganization"
            >Select</AppButton
          >
        </div>
      </form>
    </div>
  </AppModal>
</template>
