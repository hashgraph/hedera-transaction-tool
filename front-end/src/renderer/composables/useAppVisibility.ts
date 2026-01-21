import { onMounted, onUnmounted, ref } from 'vue';

import useUserStore from '@renderer/stores/storeUser';

import { shouldSignInOrganization } from '@renderer/services/organizationCredentials';

import { isUserLoggedIn, isOrganizationActive } from '@renderer/utils';

export interface UseAppVisibilityOptions {
  debounceMs?: number;
  onTokenExpired?: () => Promise<void>;
}

export default function useAppVisibility(options: UseAppVisibilityOptions = {}) {
  const { debounceMs = 2000, onTokenExpired } = options;

  /* Stores */
  const user = useUserStore();

  /* State */
  const isCheckingTokens = ref(false);
  const lastVisibilityCheck = ref<number>(0);

  /* Functions */
  async function checkTokenValidity(): Promise<boolean> {
    if (!isUserLoggedIn(user.personal)) return true;

    const activeOrgs = user.organizations.filter(org => isOrganizationActive(org));

    for (const org of activeOrgs) {
      const shouldSignIn = await shouldSignInOrganization(user.personal.id, org.id);
      if (shouldSignIn) {
        return false;
      }
    }

    return true;
  }

  async function handleVisibilityChange() {
    if (document.visibilityState !== 'visible') return;

    const now = Date.now();
    if (now - lastVisibilityCheck.value < debounceMs) return;
    lastVisibilityCheck.value = now;

    if (isCheckingTokens.value) return;
    if (!isUserLoggedIn(user.personal)) return;

    isCheckingTokens.value = true;

    try {
      const tokensValid = await checkTokenValidity();

      // Always refresh organization tokens to ensure sessionStorage is in sync
      // This handles cases where sessionStorage was cleared but DB tokens are still valid
      if (!tokensValid) {
        if (onTokenExpired) {
          // Delegate token expiry handling to the provided callback to avoid
          // triggering re-authentication flows twice (e.g., via refetchOrganizations watcher)
          await onTokenExpired();
        } else {
          await user.refetchOrganizations();
        }
      } else {
        await user.refetchOrganizationTokens();
      }
    } catch (error) {
      console.error('Error checking token validity on visibility change:', error);
    } finally {
      isCheckingTokens.value = false;
    }
  }

  /* Lifecycle */
  onMounted(() => {
    document.addEventListener('visibilitychange', handleVisibilityChange);
  });

  onUnmounted(() => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  });

  return {
    isCheckingTokens,
    checkTokenValidity,
  };
}
