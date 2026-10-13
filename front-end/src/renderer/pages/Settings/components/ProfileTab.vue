<script setup lang="ts">
import { computed, onBeforeMount, ref, watch } from 'vue';

import useUserStore from '@renderer/stores/storeUser';

import { ToastManager } from '@renderer/utils/ToastManager';
import { useRouter } from 'vue-router';

import { HTX_USER } from '@shared/constants';

import usePersonalPassword from '@renderer/composables/usePersonalPassword';
import useLoader from '@renderer/composables/useLoader';
import useDateTimeSetting from '@renderer/composables/user/useDateTimeSetting.ts';

import { changePassword } from '@renderer/services/userService';
import { changePassword as organizationChangePassword } from '@renderer/services/organization/auth';
import {
  encryptOrganizationPassword,
  updateOrganizationCredentials,
} from '@renderer/services/organizationCredentials';
import {
  createApiKey,
  getApiKeyStatus,
  logout,
  regenerateApiKey,
  revokeApiKey,
  type ApiKeyStatus,
} from '@renderer/services/organization';

import {
  assertUserLoggedIn,
  getErrorMessage,
  isLoggedInOrganization,
  isPasswordStrong,
  isUserLoggedIn,
} from '@renderer/utils';
import { formatDateTime } from '@renderer/utils/dateTimeFormat.ts';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppConfirmModal from '@renderer/components/ui/AppConfirmModal.vue';
import AppCustomIcon from '@renderer/components/ui/AppCustomIcon.vue';
import AppLoader from '@renderer/components/ui/AppLoader.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';
import AppPasswordInput from '@renderer/components/ui/AppPasswordInput.vue';
import ResetDataModal from '@renderer/components/modals/ResetDataModal.vue';

/* Stores */
const user = useUserStore();

/* Composables */
const router = useRouter();
const withLoader = useLoader();
const { getPasswordAsync } = usePersonalPassword();
const { isUtcSelected } = useDateTimeSetting();

/* Injected */
const toastManager = ToastManager.inject();

/* State */
const currentPassword = ref('');
const newPassword = ref('');
const currentPasswordInvalid = ref(false);
const newPasswordInvalid = ref(false);

const isConfirmModalShown = ref(false);
const isSuccessModalShown = ref(false);
const isChangingPassword = ref(false);
const isResetDataModalShown = ref(false);

const apiKeyLoading = ref(true);
const apiKeyStatus = ref<ApiKeyStatus | null>(null);
const revealedApiKey = ref<string | null>(null);
const isRegenerateApiKeyModalShown = ref(false);
const isRevokeApiKeyModalShown = ref(false);

/* Computed */
const isApiKeySectionVisible = computed(
  () =>
    isLoggedInOrganization(user.selectedOrganization) &&
    (user.selectedOrganization.admin || user.selectedOrganization.canViewReports),
);

const hasActiveApiKey = computed(() => !!apiKeyStatus.value?.keyId && !apiKeyStatus.value?.revokedAt);

const apiKeyRevokedReasonLabel = computed(() => {
  switch (apiKeyStatus.value?.revokedReason) {
    case 'user':
      return 'Revoked by you';
    case 'permission_removed':
      return 'Revoked — report access permission removed';
    case 'inactivity':
      return `Revoked — unused for ${apiKeyStatus.value?.idleExpiryDays} days`;
    default:
      return 'Revoked';
  }
});

const displayEmail = computed(() => {
  const orgEmail = isLoggedInOrganization(user.selectedOrganization)
    ? user.selectedOrganization.email
    : null;
  if (orgEmail) return orgEmail;
  if (isUserLoggedIn(user.personal)) return user.personal.email;
  return '';
});

const isPrimaryButtonDisabled = computed(() => {
  return (
    currentPassword.value.length === 0 ||
    !isPasswordStrong(newPassword.value).result ||
    isChangingPassword.value
  );
});

/* Handlers */
const handleChangePassword = async () => {
  try {
    isChangingPassword.value = true;

    assertUserLoggedIn(user.personal);

    if (currentPassword.value.length === 0 || newPassword.value.length === 0) {
      throw new Error('Password cannot be empty');
    }

    if (newPasswordInvalid.value) throw new Error('Password must be at least 10 characters long');

    if (isLoggedInOrganization(user.selectedOrganization)) {
      // Linear flow: confirm modal stays open with isChangingPassword = true while the
      // personal-password modal is on top. Loading state is visible end-to-end.
      const personalPassword = await getPasswordAsync({
        subHeading: 'Enter your application password to encrypt your organization credentials',
      });
      if (personalPassword === false) return; // user cancelled the personal-password modal

      // Encrypt before the BE rotation so a keychain / personal-password failure aborts before
      // the backend is touched.
      const encryptedNewPassword = await encryptOrganizationPassword(
        newPassword.value,
        personalPassword || undefined,
      );

      await organizationChangePassword(
        user.selectedOrganization.serverUrl,
        currentPassword.value,
        newPassword.value,
      );

      const isUpdated = await updateOrganizationCredentials(
        user.selectedOrganization.id,
        user.personal.id,
        undefined,
        encryptedNewPassword,
        undefined,
        undefined,
        true,
      );

      if (!isUpdated) {
        throw new Error('Failed to update organization credentials');
      }
    } else {
      await changePassword(user.personal.id, currentPassword.value, newPassword.value);
      user.setPassword(newPassword.value);
      await user.refetchKeys();
    }

    isConfirmModalShown.value = false;
    isSuccessModalShown.value = true;
    currentPassword.value = '';
    newPassword.value = '';

    await user.refetchAccounts();
  } catch (error) {
    toastManager.error(getErrorMessage(error, 'Failed to change password'));
  } finally {
    isChangingPassword.value = false;
  }
};

const handleResetData = async () => router.push({ name: 'login' });

const handleBlur = (inputType: string, value: string) => {
  if (inputType === 'newPassword') {
    newPasswordInvalid.value = value.length !== 0 && !isPasswordStrong(value).result;
  }
};

const handleLogout = async () => {
  if (user.selectedOrganization) {
    if (!isUserLoggedIn(user.personal)) return;

    const { id, nickname, serverUrl, key } = user.selectedOrganization;
    await logout(serverUrl);
    await updateOrganizationCredentials(id, user.personal.id, undefined, '', null);
    await user.selectOrganization({ id, nickname, serverUrl, key });
  } else {
    localStorage.removeItem(HTX_USER);
    user.logout();
    await router.push({ name: 'login' });
  }
};

const formatApiKeyDateTime = (value: string | null) => {
  if (!value) return 'Never';
  const date = new Date(value);
  return formatDateTime(date, isUtcSelected.value, true);
};

const fetchApiKeyStatus = async () => {
  if (!isApiKeySectionVisible.value || !isLoggedInOrganization(user.selectedOrganization)) return;

  const { serverUrl } = user.selectedOrganization;
  apiKeyLoading.value = true;
  try {
    const status = await getApiKeyStatus(serverUrl);
    // The selected organization may have changed while this request was in flight -
    // ignore a response that no longer belongs to the currently selected one.
    if (!isLoggedInOrganization(user.selectedOrganization)) return;
    if (user.selectedOrganization.serverUrl !== serverUrl) return;
    apiKeyStatus.value = status;
  } catch (error) {
    toastManager.error(getErrorMessage(error, 'Failed to load API key status'));
  } finally {
    apiKeyLoading.value = false;
  }
};

const handleGenerateApiKey = async () => {
  if (!isLoggedInOrganization(user.selectedOrganization)) return;

  try {
    const { key } = await createApiKey(user.selectedOrganization.serverUrl);
    revealedApiKey.value = key;
    await fetchApiKeyStatus();
  } catch (error) {
    toastManager.error(getErrorMessage(error, 'Failed to create API key'));
  }
};

const handleRegenerateApiKey = async () => {
  if (!isLoggedInOrganization(user.selectedOrganization)) return;

  try {
    const { key } = await regenerateApiKey(user.selectedOrganization.serverUrl);
    revealedApiKey.value = key;
    await fetchApiKeyStatus();
  } catch (error) {
    toastManager.error(getErrorMessage(error, 'Failed to regenerate API key'));
  }
};

const handleRevokeApiKey = async () => {
  if (!isLoggedInOrganization(user.selectedOrganization)) return;

  try {
    await revokeApiKey(user.selectedOrganization.serverUrl);
    revealedApiKey.value = null;
    toastManager.success('API key revoked successfully');
    await fetchApiKeyStatus();
  } catch (error) {
    toastManager.error(getErrorMessage(error, 'Failed to revoke API key'));
  }
};

const handleCopyApiKey = async () => {
  if (!revealedApiKey.value) return;
  try {
    await navigator.clipboard.writeText(revealedApiKey.value);
    toastManager.success('API key copied to clipboard');
  } catch (error) {
    toastManager.error(getErrorMessage(error, 'Failed to copy API key to clipboard'));
  }
};

const handleDismissRevealedApiKey = () => {
  revealedApiKey.value = null;
};

/* Watchers */
watch(currentPassword, () => {
  currentPasswordInvalid.value = false;
});

watch(newPassword, pass => {
  if (isPasswordStrong(pass).result || pass.length === 0) {
    newPasswordInvalid.value = false;
  }
});

watch(
  () => (isLoggedInOrganization(user.selectedOrganization) ? user.selectedOrganization.serverUrl : null),
  () => {
    revealedApiKey.value = null;
    apiKeyStatus.value = null;
    fetchApiKeyStatus();
  },
);

/* Hooks */
onBeforeMount(fetchApiKeyStatus);
</script>
<template>
  <div
    v-if="
      (isUserLoggedIn(user.personal) && !user.personal.useKeychain) || user.selectedOrganization
    "
  >
    <div class="p-4 border border-2 rounded-3">
      <p>User Info</p>
      <div class="mt-4">
        <h4 class="text-micro text-semi-bold text-dark-blue">Email</h4>
        <p class="text-small overflow-hidden mt-1 mb-0">{{ displayEmail }}</p>
      </div>
      <AppButton
        v-if="
          (isUserLoggedIn(user.personal) && !user.personal.useKeychain && !user.selectedOrganization) ||
          isLoggedInOrganization(user.selectedOrganization)
        "
        color="primary"
        data-testid="button-logout"
        class="mt-4"
        @click="withLoader(handleLogout)"
        >Log Out</AppButton
      >
    </div>
    <form class="p-4 border border-2 rounded-3 mt-5" @submit.prevent="isConfirmModalShown = true">
      <h3 class="text-main">Password</h3>
      <div class="col-sm-5 col-lg-4">
        <div class="form-group mt-4">
          <label class="form-label">Current Password <span class="text-danger">*</span></label>
          <AppPasswordInput
            v-model="currentPassword"
            data-testid="input-current-password"
            placeholder="Enter Current Password"
            :filled="true"
          />
        </div>
        <div class="mt-4 form-group">
          <label class="form-label">New Password <span class="text-danger">*</span></label>
          <AppPasswordInput
            v-model="newPassword"
            :filled="true"
            :class="{ 'is-invalid': newPasswordInvalid }"
            data-testid="input-new-password"
            placeholder="Enter New Password"
            @blur="handleBlur('newPassword', $event.target.value)"
          />
          <div v-if="newPasswordInvalid" class="invalid-feedback">Invalid password</div>
        </div>
      </div>
      <div class="mt-4">
        <AppButton
          color="primary"
          data-testid="button-change-password"
          type="submit"
          :disabled="isPrimaryButtonDisabled"
          >Change Password</AppButton
        >
      </div>
    </form>
    <AppModal v-model:show="isConfirmModalShown" class="common-modal">
      <div class="p-4">
        <i
          class="bi bi-x-lg d-inline-block cursor-pointer"
          @click="isConfirmModalShown = false"
        ></i>
        <div class="text-center">
          <AppCustomIcon :name="'questionMark'" style="height: 160px" />
        </div>
        <h3 class="text-center text-title text-bold mt-4">Change Password?</h3>
        <p class="text-center text-small text-secondary mt-4">
          Are you sure you want to change your password
        </p>
        <hr class="separator my-5" />
        <div class="flex-between-centered gap-4">
          <AppButton color="borderless" @click="isConfirmModalShown = false">Cancel</AppButton>
          <AppButton
            color="primary"
            data-testid="button-confirm-change-password"
            @click="handleChangePassword"
            :disabled="isChangingPassword"
            :loading="isChangingPassword"
            loading-text="Changing..."
            >Change</AppButton
          >
        </div>
      </div>
    </AppModal>
    <AppModal v-model:show="isSuccessModalShown" class="common-modal">
      <form class="p-5" @submit.prevent="isSuccessModalShown = false">
        <div>
          <i class="bi bi-x-lg cursor-pointer" @click="isSuccessModalShown = false"></i>
        </div>

        <div class="text-center">
          <AppCustomIcon :name="'success'" style="height: 130px" />
        </div>

        <h3 class="text-center text-title text-bold mt-3">Password Changed Successfully</h3>
        <div class="d-grid mt-5">
          <AppButton color="primary" data-testid="button-close" type="submit">Close</AppButton>
        </div>
      </form>
    </AppModal>

    <div v-if="isApiKeySectionVisible" class="p-4 border border-2 rounded-3 mt-5">
      <h3 class="text-main">API Key</h3>
      <p class="text-small text-secondary mt-3">
        Use an API key to give a third-party tool read-only access to reports, instead of
        sharing your account password. A key can only make GET requests against the signing
        report endpoint.
      </p>

      <template v-if="apiKeyLoading">
        <div class="mt-5">
          <AppLoader />
        </div>
      </template>

      <template v-else>
        <template v-if="revealedApiKey">
          <div class="container p-4 border rounded mt-4">
            <p class="text-small text-semi-bold text-warning">
              Copy this key now — it will not be shown again.
            </p>
            <div class="d-flex align-items-center gap-3 mt-3">
              <span
                class="d-inline-block text-truncate font-monospace"
                data-testid="span-revealed-api-key"
                style="max-width: 60vw"
                >{{ revealedApiKey }}</span
              >
              <button
                type="button"
                class="bi bi-copy cursor-pointer"
                style="background: transparent; border: none; padding: 0; color: inherit"
                aria-label="Copy API key"
                data-testid="button-copy-api-key"
                @click="handleCopyApiKey"
              ></button>
            </div>
            <div class="mt-4">
              <AppButton
                color="primary"
                data-testid="button-dismiss-revealed-api-key"
                @click="handleDismissRevealedApiKey"
                >Done</AppButton
              >
            </div>
          </div>
        </template>

        <template v-else-if="hasActiveApiKey && apiKeyStatus">
          <div class="mt-4 row">
            <div class="col-5">
              <p class="text-main text-semi-bold">Created</p>
            </div>
            <div class="col-7">
              <p class="text-secondary" data-testid="p-api-key-created-at">
                {{ formatApiKeyDateTime(apiKeyStatus.createdAt) }}
              </p>
            </div>
          </div>
          <div class="mt-3 row">
            <div class="col-5">
              <p class="text-main text-semi-bold">Last used</p>
            </div>
            <div class="col-7">
              <p class="text-secondary" data-testid="p-api-key-last-used-at">
                {{ formatApiKeyDateTime(apiKeyStatus.lastUsedAt) }}
              </p>
            </div>
          </div>
          <div class="mt-3 row">
            <div class="col-5">
              <p class="text-main text-semi-bold">Key Reference</p>
            </div>
            <div class="col-7">
              <p class="text-secondary" data-testid="p-api-key-id">{{ apiKeyStatus.keyId }}</p>
            </div>
          </div>
          <div class="mt-4 d-flex gap-3">
            <AppButton
              color="secondary"
              data-testid="button-regenerate-api-key"
              @click="isRegenerateApiKeyModalShown = true"
              >Regenerate</AppButton
            >
            <AppButton
              color="danger"
              data-testid="button-revoke-api-key"
              @click="isRevokeApiKeyModalShown = true"
              >Revoke</AppButton
            >
          </div>
        </template>

        <template v-else>
          <div class="mt-4">
            <p
              v-if="apiKeyStatus?.revokedAt"
              class="text-small text-secondary"
              data-testid="p-api-key-revoked-reason"
            >
              {{ apiKeyRevokedReasonLabel }}
            </p>
            <p v-else class="text-small text-secondary" data-testid="p-no-api-key">
              You don't have an API key yet.
            </p>
            <AppButton
              color="primary"
              class="mt-3"
              data-testid="button-generate-api-key"
              @click="handleGenerateApiKey"
              >Generate</AppButton
            >
          </div>
        </template>
      </template>

      <AppConfirmModal
        v-model:show="isRegenerateApiKeyModalShown"
        icon="bin"
        title="Regenerate API Key"
        text="Your current key will stop working immediately. Any third-party app using it will need
          the new key to keep working."
        button-text="Regenerate"
        data-testid="regenerate-api-key"
        :callback="handleRegenerateApiKey"
      />
      <AppConfirmModal
        v-model:show="isRevokeApiKeyModalShown"
        icon="bin"
        title="Revoke API Key"
        text="Are you sure you want to revoke this API key? Any third-party app using it will stop
          working immediately. This cannot be undone."
        button-text="Revoke"
        button-color="danger"
        data-testid="revoke-api-key"
        :callback="handleRevokeApiKey"
      />
    </div>
  </div>

  <div
    v-if="isUserLoggedIn(user.personal) && user.personal.useKeychain && !user.selectedOrganization"
  >
    <form class="w-50 p-4 border rounded" @submit.prevent="isResetDataModalShown = true">
      <h3 class="text-main">Reset Application</h3>

      <div class="d-grid">
        <AppButton color="primary" data-testid="button-change-password" type="submit" class="mt-4"
          >Reset</AppButton
        >
      </div>
    </form>
    <ResetDataModal v-model:show="isResetDataModalShown" @data:reset="handleResetData" />
  </div>

</template>
