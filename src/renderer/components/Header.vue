<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import useOrganizationsStore from '../stores/storeOrganizations';
import useUserStateStore from '../stores/storeUserState';

import Logo from './Logo.vue';
import LogoText from './LogoText.vue';

const router = useRouter();
const organizationsStore = useOrganizationsStore();
const userStateStore = useUserStateStore();

const organizationsDropDownRef = ref<HTMLSelectElement | null>(null);

async function handleThemeChange() {
  const isDark = await window.electronAPI.theme.isDark();

  window.electronAPI.theme.toggle(isDark ? 'light' : 'dark');
}

function handleOrganizationChange(e: Event) {
  const selectElement = e.target as HTMLSelectElement;

  const selectedOption = selectElement.selectedOptions[0];

  switch (selectedOption.value) {
    case 'local':
      userStateStore.setUserRole('personal');
      organizationsStore.currentOrganization = null;
      break;
    case 'add-organization':
      organizationsDropDownRef.value!.value =
        userStateStore.role === 'personal'
          ? 'local'
          : organizationsStore.currentOrganization!.serverUrl;
      router.push({ name: 'setupOrganization' });
      return;
    default:
      userStateStore.setUserRole('organization');
      organizationsStore.setCurrentOrganization(selectedOption.value);
      userStateStore.setServerUrl(selectedOption.value);
      break;
  }

  userStateStore.logoutUser();

  router.push({ name: 'welcome' });
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
          <option value="local" :selected="userStateStore.role === 'personal'" default>
            No organization selected
          </option>
          <template
            v-for="organization in organizationsStore.organizations"
            :key="organization.serverUrl"
          >
            <option
              :value="organization.serverUrl"
              :selected="
                userStateStore.role === 'organization' &&
                organizationsStore.currentOrganization?.serverUrl === organization.serverUrl
              "
            >
              {{ organization.name }}
            </option>
          </template>
          <option value="add-organization">Add Organization</option>
        </select>
      </div>
      <div class="form-check form-switch">
        <input
          @change="handleThemeChange"
          class="form-check-input"
          type="checkbox"
          role="switch"
          id="flexSwitchCheckDefault"
          checked
        />
        <label class="text-main text-primary" for="flexSwitchCheckDefault">Dark mode</label>
      </div>
    </div>
  </div>
</template>
