import type { Organization } from '@prisma/client';

import type { ConnectedOrganization, OrganizationTokens, PersonalUser } from '@renderer/types';

import { nextTick, ref, watchEffect } from 'vue';
import { defineStore } from 'pinia';

import { ACCOUNT_SETUP_STARTED, SELECTED_NETWORK } from '@shared/constants';

import { add, getStoredClaim, remove } from '@renderer/services/claimService';

import useAfterOrganizationSelection from '@renderer/composables/user/useAfterOrganizationSelection';
import useVersionCheck from '@renderer/composables/useVersionCheck';

import { safeAwait } from '@renderer/utils';
import * as ush from '@renderer/utils/userStoreHelpers';
import { getVersionStatusForOrg, resetVersionStatusForOrg } from './versionState';

import useNetworkStore from './storeNetwork';
import useOrganizationConnection from './storeOrganizationConnection';
import { reconnectOrganization } from '@renderer/services/organization';

const useUserStore = defineStore('user', () => {
  /* Stores */
  const network = useNetworkStore();
  const orgConnection = useOrganizationConnection();

  /* Composables */
  const afterOrganizationSelection = useAfterOrganizationSelection();
  const { reset: resetVersionCheck } = useVersionCheck();

  /* State */
  /** Personal */
  const personal = ref<PersonalUser | null>(null);
  const passwordStoreDuration = ref<number>(10 * 60 * 1_000);

  /** Organization */
  const selectedOrganization = ref<ConnectedOrganization | null>(null);
  const organizations = ref<ConnectedOrganization[]>([]);
  const organizationTokens = ref<OrganizationTokens>({});

  /** AccountSetup */
  const accountSetupStarted = ref<boolean | null>(null);

  /* Actions */
  /** Personal */
  const login = async (id: string, email: string, useKeychain: boolean) => {
    personal.value = {
      isLoggedIn: true,
      id,
      email,
      password: null,
      useKeychain: useKeychain,
    };
    const { data } = await safeAwait(getStoredClaim(id, SELECTED_NETWORK));
    await safeAwait(network.setup(data));
    await selectOrganization(null);
  };

  const logout = () => {
    personal.value = {
      isLoggedIn: false,
    };
    selectedOrganization.value = null;
    organizations.value = [];
    resetVersionCheck();
  };

  const getPassword = () => {
    if (!ush.isUserLoggedIn(personal.value)) throw new Error('User is not logged in');
    if (!ush.isLoggedInWithValidPassword(personal.value)) {
      personal.value.password = null;
      return null;
    }

    personal.value.passwordExpiresAt = new Date(Date.now() + passwordStoreDuration.value);
    return personal.value.password;
  };

  const setPassword = (password: string) => {
    if (!ush.isUserLoggedIn(personal.value)) throw new Error('User is not logged in');

    personal.value.password = password;

    if (!ush.isLoggedInWithPassword(personal.value)) throw new Error('Failed to set user password');

    personal.value.passwordExpiresAt = new Date(Date.now() + passwordStoreDuration.value);
  };

  const setPasswordStoreDuration = (durationMs: number) => {
    if (!ush.isUserLoggedIn(personal.value)) throw new Error('User is not logged in');

    const oldDuration = passwordStoreDuration.value;
    passwordStoreDuration.value = durationMs;

    if (ush.isLoggedInWithPassword(personal.value)) {
      const prevSetAt = personal.value.passwordExpiresAt.getTime() - oldDuration;
      personal.value.passwordExpiresAt = new Date(prevSetAt + durationMs);
    }
  };

  /* Organization */
  const selectOrganization = async (organization: Organization | null) => {
    await nextTick();

    if (organization) {
      const connectionStatus = orgConnection.getConnectionStatus(organization.serverUrl);
      const disconnectReason = orgConnection.getDisconnectReason(organization.serverUrl);

      // Prevent selecting organizations that are disconnected due to upgrade requirement
      if (connectionStatus === 'disconnected') {
        if (disconnectReason === 'upgradeRequired') {
          const versionStatus = getVersionStatusForOrg(organization.serverUrl);

          if (versionStatus === 'belowMinimum') {
            return;
          }
        }

        await reconnectOrganization(organization.serverUrl);
      }
    }

    selectedOrganization.value = await ush.getConnectedOrganization(organization, personal.value);
    await afterOrganizationSelection();
  };

  const refetchUserState = async () =>
    (selectedOrganization.value = await ush.refetchUserState(selectedOrganization.value));

  const refetchOrganizationTokens = async () => {
    organizationTokens.value = await ush.getOrganizationJwtTokens(personal.value);
    ush.setSessionStorageTokens(organizations.value, organizationTokens.value);
  };

  const refetchOrganizations = async () => {
    await ush.updateConnectedOrganizations(organizations, personal.value);
    await refetchOrganizationTokens();
  };

  const deleteOrganization = async (organizationId: string) => {
    const removed = organizations.value.find(org => org.id === organizationId);
    organizations.value = organizations.value.filter(org => org.id !== organizationId);
    if (removed) resetVersionStatusForOrg(removed.serverUrl);
    await ush.deleteOrganizationConnection(organizationId, personal.value);
  };

  const getJwtToken = (organizationId?: string): string | null => {
    return organizationTokens.value[organizationId || selectedOrganization.value?.id || ''] || null;
  };

  /* AccountSetup */
  const setAccountSetupStarted = (value: boolean) => {
    accountSetupStarted.value = value;
  };

  watchEffect(async () => {
    const userId = personal.value && 'id' in personal.value ? personal.value.id : undefined;
    const setupStarted = accountSetupStarted.value;
    if (userId) {
      if (setupStarted) {
        await safeAwait(add(userId, ACCOUNT_SETUP_STARTED, 'true'));
      } else {
        await safeAwait(remove(userId, [ACCOUNT_SETUP_STARTED]));
      }
    }
  });

  /* Exports */
  const exports = {
    personal,
    selectedOrganization,
    organizations,
    accountSetupStarted,
    deleteOrganization,
    getJwtToken,
    getPassword,
    login,
    logout,
    refetchOrganizations,
    refetchOrganizationTokens,
    refetchUserState,
    selectOrganization,
    setAccountSetupStarted,
    setPassword,
    setPasswordStoreDuration,
  };

  return exports;
});

export default useUserStore;
