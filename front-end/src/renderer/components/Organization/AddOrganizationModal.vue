<script setup lang="ts">
import type { Organization } from '@prisma/client';

import { watch, ref } from 'vue';

import useUserStore from '@renderer/stores/storeUser';

import { useToast } from 'vue-toast-notification';

import { addOrganization } from '@renderer/services/organizationsService';

import { getErrorMessage } from '@renderer/utils';
import { FRONTEND_VERSION } from '@renderer/utils/version';

import useVersionCheck from '@renderer/composables/useVersionCheck';
import { checkVersion } from '@renderer/services/organization';
import {
  checkCompatibilityForNewOrg,
  isVersionBelowMinimum,
  type CompatibilityCheckResult,
} from '@renderer/services/organization/versionCompatibility';
import { setVersionBelowMinimum, setVersionStatusForOrg } from '@renderer/stores/versionState';
import { organizationCompatibilityResults } from '@renderer/stores/versionState';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';
import AppCustomIcon from '@renderer/components/ui/AppCustomIcon.vue';
import CompatibilityWarningModal from '@renderer/components/Organization/CompatibilityWarningModal.vue';
import { healthCheck } from '@renderer/services/organization';
import { errorToastOptions, successToastOptions } from '@renderer/utils/toastOptions.ts';

/* Props */
const props = defineProps<{
  show: boolean;
}>();

/* Emits */
const emit = defineEmits<{
  (event: 'update:show', show: boolean): void;
  (event: 'added', organization: Organization): void;
}>();

/* Stores */
const user = useUserStore();

/* Composables */
const toast = useToast();
const versionCheck = useVersionCheck();
const { storeVersionDataForOrganization, getAllOrganizationVersionData } = versionCheck;

/* State */
const nickname = ref('');
const serverUrl = ref('');
const showCompatibilityWarning = ref(false);
const compatibilityResult = ref<CompatibilityCheckResult | null>(null);
const newOrgNickname = ref<string>('');

/* Handlers */
const handleAdd = async () => {
  try {
    const url = new URL(serverUrl.value);
    serverUrl.value = url.origin;
  } catch {
    throw new Error('Invalid Server URL');
  }
  try {
    const active = await healthCheck(serverUrl.value);

    if (!active) {
      throw new Error('Organization does not exist. Please check the server URL');
    }

    const organization = await addOrganization({
      nickname: nickname.value.trim() || `Organization ${user.organizations.length + 1}`,
      serverUrl: serverUrl.value,
      key: '',
    });

    newOrgNickname.value = organization.nickname || serverUrl.value;

    try {
      const versionResponse = await checkVersion(serverUrl.value, FRONTEND_VERSION);

      storeVersionDataForOrganization(serverUrl.value, versionResponse);

      if (versionResponse.updateUrl) {
        const compatResult = await checkCompatibilityForNewOrg(serverUrl.value, versionResponse);

        organizationCompatibilityResults.value[serverUrl.value] = compatResult;

        if (compatResult.hasConflict) {
          compatibilityResult.value = compatResult;
          showCompatibilityWarning.value = true;
          return;
        }

        if (isVersionBelowMinimum(versionResponse)) {
          setVersionBelowMinimum(serverUrl.value, versionResponse.updateUrl);
        } else {
          setVersionStatusForOrg(serverUrl.value, 'updateAvailable');
        }
      }
    } catch (versionError) {
      console.error('Version check failed for new organization:', versionError);
    }

    toast.success('Organization Added', successToastOptions);
    emit('added', organization);
    emit('update:show', false);
  } catch (error) {
    toast.error(getErrorMessage(error, 'Failed to add organization'), errorToastOptions);
  }
};

const handleCompatibilityProceed = async () => {
  showCompatibilityWarning.value = false;
  const orgServerUrl = serverUrl.value;

  const addedOrg = user.organizations.find(org => org.serverUrl === orgServerUrl);
  if (!addedOrg) {
    console.error('Could not find added organization');
    emit('update:show', false);
    return;
  }

  const allVersionData = getAllOrganizationVersionData();
  const versionData = allVersionData[orgServerUrl];

  if (versionData && versionData.updateUrl) {
    if (isVersionBelowMinimum(versionData)) {
      setVersionBelowMinimum(orgServerUrl, versionData.updateUrl);
    } else {
      setVersionStatusForOrg(orgServerUrl, 'updateAvailable');
    }
  }

  toast.success('Organization Added', successToastOptions);
  emit('added', addedOrg);
  emit('update:show', false);
};

const handleCompatibilityCancel = () => {
  showCompatibilityWarning.value = false;
  const orgServerUrl = serverUrl.value;

  const allVersionData = getAllOrganizationVersionData();
  const versionData = allVersionData[orgServerUrl];

  if (versionData && versionData.updateUrl) {
    if (isVersionBelowMinimum(versionData)) {
      setVersionBelowMinimum(orgServerUrl, versionData.updateUrl);
    } else {
      setVersionStatusForOrg(orgServerUrl, 'updateAvailable');
    }
  }

  emit('update:show', false);
};

/* Watchers */
watch(
  () => props.show,
  () => {
    nickname.value = '';
    serverUrl.value = '';
    showCompatibilityWarning.value = false;
    compatibilityResult.value = null;
    newOrgNickname.value = '';
  },
);
</script>
<template>
  <AppModal
    :show="show"
    :close-on-click-outside="false"
    :close-on-escape="false"
    class="common-modal"
  >
    <form class="p-4" @submit.prevent="handleAdd">
      <div class="text-start">
        <i class="bi bi-x-lg cursor-pointer" @click="$emit('update:show', false)"></i>
      </div>
      <div class="text-center">
        <AppCustomIcon :name="'group'" style="height: 160px" />
      </div>
      <h2 class="text-center text-title text-semi-bold mt-3">Setup Organization</h2>
      <p class="text-center text-small text-secondary mt-3">
        Please Enter Organization Nickname and Server URL
      </p>

      <div class="form-group mt-5">
        <label class="form-label">Nickname</label>
        <AppInput
          size="small"
          data-testid="input-organization-nickname"
          v-model="nickname"
          :filled="true"
          placeholder="Enter nickname"
        />
      </div>
      <div class="form-group mt-5">
        <label class="form-label">Server URL</label>
        <AppInput
          size="small"
          data-testid="input-server-url"
          v-model="serverUrl"
          :filled="true"
          placeholder="Enter Server URL"
        />
      </div>

      <hr class="separator my-5" />

      <div class="flex-between-centered gap-4">
        <AppButton
          data-testid="button-cancel-adding-org"
          color="borderless"
          type="button"
          @click="$emit('update:show', false)"
          >Cancel</AppButton
        >
        <AppButton color="primary" data-testid="button-add-organization-in-modal" type="submit"
          >Add</AppButton
        >
      </div>
    </form>

    <!-- Compatibility Warning Modal -->
    <CompatibilityWarningModal
      :show="showCompatibilityWarning"
      :conflicts="compatibilityResult?.conflicts || []"
      :suggested-version="compatibilityResult?.suggestedVersion || ''"
      :is-optional="compatibilityResult?.isOptional ?? true"
      :triggering-org-name="newOrgNickname"
      @update:show="showCompatibilityWarning = $event"
      @proceed="handleCompatibilityProceed"
      @cancel="handleCompatibilityCancel"
    />
  </AppModal>
</template>
