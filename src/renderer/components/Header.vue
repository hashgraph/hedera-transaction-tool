<script setup lang="ts">
import { ref } from 'vue';

import useOrganizationsStore from '../stores/storeOrganizations';
import useUserStore from '../stores/storeUser';
import useKeyPairsStore from '../stores/storeKeyPairs';

import { useRouter } from 'vue-router';

import AppSwitch from './ui/AppSwitch.vue';
import Logo from './Logo.vue';
import LogoText from './LogoText.vue';

/* Stores */
const organizationsStore = useOrganizationsStore();
const user = useUserStore();
const keyPairsStore = useKeyPairsStore();

/* Composables */
const router = useRouter();

/* State */
const organizationsDropDownRef = ref<HTMLSelectElement | null>(null);

/* Handlers */
async function handleThemeChange() {
  const isDark = await window.electronAPI.theme.isDark();
  window.electronAPI.theme.toggle(isDark ? 'light' : 'dark');
}

function handleOrganizationChange(e: Event) {
  const selectElement = e.target as HTMLSelectElement;
  const selectedOption = selectElement.selectedOptions[0];

  switch (selectedOption.value) {
    case 'local':
      user.data.mode = 'personal';
      user.data.activeServerURL = undefined;
      break;
    case 'add-organization':
      if (organizationsDropDownRef.value) {
        organizationsDropDownRef.value.value = user.data.activeServerURL || 'local';
        router.push({ name: 'setupOrganization' });
      }
      return;
    default:
      user.data.mode = 'organization';
      user.data.activeServerURL = selectedOption.value;
      break;
  }

  keyPairsStore.refetch();
}
</script>

<template>
  <div class="container-header">
    <div class="container-logo">
      <Logo />
      <LogoText />
    </div>
    <div class="d-flex align-items-center">
      <div class="me-4">
        <select
          class="form-select form-select-sm"
          name="serverURL"
          @change="handleOrganizationChange"
          ref="organizationsDropDownRef"
        >
          <option value="local" :selected="user.data.mode === 'personal'" default>
            No organization selected
          </option>
          <template
            v-for="organization in organizationsStore.organizations"
            :key="organization.serverUrl"
          >
            <option
              :value="organization.serverUrl"
              :selected="
                user.data.mode === 'organization' &&
                user.data.activeServerURL === organization.serverUrl
              "
            >
              {{ organization.name }}
            </option>
          </template>
          <option value="add-organization">Add Organization</option>
        </select>
      </div>
      <div class="form-check form-switch">
        <AppSwitch
          name="theme-switch"
          @change="handleThemeChange"
          label="Dark Mode"
          label-class="text-primary"
        />
      </div>
    </div>
  </div>
</template>
