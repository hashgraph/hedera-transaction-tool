import useUserStore from '@renderer/stores/storeUser';

import { DEFAULT_ORGANIZATION_OPTION, LAST_SELECTED_ORGANIZATION } from '@main/shared/constants';

import { getOrganizations } from '@renderer/services/organizationsService';
import { getStoredClaim, add, update, remove } from '@renderer/services/claimService';

import { isUserLoggedIn, safeAwait } from '@renderer/utils';

export default function useDefaultOrganization() {
  /* Stores */
  const user = useUserStore();

  /* Functions */
  const get = async (key: string) => {
    if (isUserLoggedIn(user.personal)) {
      const { data } = await safeAwait(getStoredClaim(user.personal.id, key));
      return data;
    }
  };

  const getSelected = async () => {
    const defaultOption = await get(DEFAULT_ORGANIZATION_OPTION);

    if (defaultOption) {
      return defaultOption;
    }

    return await get(LAST_SELECTED_ORGANIZATION);
  };

  const getDefault = async () => {
    return await get(DEFAULT_ORGANIZATION_OPTION);
  };

  const set = async (organizationId: string | null, key: string) => {
    if (isUserLoggedIn(user.personal)) {
      if (organizationId === null) {
        await remove(user.personal.id, [key]);
        return;
      }

      const storedId = await get(key);
      const addOrUpdate = storedId !== undefined ? update : add;
      await addOrUpdate(user.personal.id, key, organizationId);
    }
  };

  const setLast = async (organizationId: string | null) => {
    await set(organizationId, LAST_SELECTED_ORGANIZATION);
  };

  const setDefault = async (organizationId: string | null) => {
    await set(organizationId, DEFAULT_ORGANIZATION_OPTION);
  };

  const select = async () => {
    if (isUserLoggedIn(user.personal)) {
      const organizationId = await getSelected();

      if (organizationId) {
        const organizations = await getOrganizations();
        const organization = organizations.find(org => org.id === organizationId);

        if (organization) {
          await user.selectOrganization(organization);
        }
      }
    }
  };

  return { getDefault, setLast, setDefault, select };
}
