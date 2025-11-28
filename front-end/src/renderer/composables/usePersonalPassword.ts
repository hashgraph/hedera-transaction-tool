import type { USER_PASSWORD_MODAL_TYPE } from '@renderer/providers';

import { inject } from 'vue';

import useUserStore from '@renderer/stores/storeUser';

import { USER_PASSWORD_MODAL_KEY } from '@renderer/providers';

import { assertUserLoggedIn } from '@renderer/utils';

export default function usePersonalPassword() {
  /* Types */
  type PersonalPasswordResult = string | null | false;

  /* Composables */
  const user = useUserStore();

  /* Injected */
  const userPasswordModalRef = inject<USER_PASSWORD_MODAL_TYPE>(USER_PASSWORD_MODAL_KEY);

  /* Actions */
  function getPassword(
    callback: (password: string) => void,
    modalOptions?: {
      heading?: string | null;
      subHeading?: string | null;
    },
  ): PersonalPasswordResult {
    assertUserLoggedIn(user.personal);

    const personalPassword = user.getPassword();

    if (!personalPassword && !user.personal.useKeychain) {
      if (!userPasswordModalRef) throw new Error('User password modal ref is not provided');
      userPasswordModalRef.value?.open(
        modalOptions?.heading || 'Enter your application password',
        modalOptions?.subHeading || null,
        callback,
      );
      return false;
    }

    return personalPassword;
  }

  function getPasswordV2(
    callback: (password: string|null) => void,
    modalOptions?: {
      heading?: string | null;
      subHeading?: string | null;
    },
  ): void {
    assertUserLoggedIn(user.personal);

    if (user.personal.useKeychain) {
      callback(null);
    } else {
      const personalPassword = user.getPassword();
      if (personalPassword) {
        // User is already authenticated
        callback(personalPassword);
      } else {
        if (!userPasswordModalRef?.value) throw new Error('User password modal ref is not provided');
        userPasswordModalRef.value.open(
          modalOptions?.heading || 'Enter your application password',
          modalOptions?.subHeading || null,
          callback,
        );
      }
    }
  }

  function passwordModalOpened(
    personalPasswordResult: PersonalPasswordResult,
  ): personalPasswordResult is false {
    if (personalPasswordResult === false) return true;
    return false;
  }

  return { getPassword, getPasswordV2, passwordModalOpened };
}
