import useUserStore from '@renderer/stores/storeUser';

import { SELECTED_ORGANIZATION } from '@main/shared/constants';

import { getOrganizations } from '@renderer/services/organizationsService';
import { getStoredClaim, add, update, remove } from '@renderer/services/claimService';

import { isUserLoggedIn, safeAwait } from '@renderer/utils';

export default function useDefaultOrganization() {
  /* Stores */
  const user = useUserStore();

  /* Functions */
  const get = async () => {
    if (isUserLoggedIn(user.personal)) {
      const { data } = await safeAwait(getStoredClaim(user.personal.id, SELECTED_ORGANIZATION));
      return data;
    }
  };

  const set = async (organizationId: string | null) => {
    if (isUserLoggedIn(user.personal)) {
      if (organizationId === null) {
        await remove(user.personal.id, [SELECTED_ORGANIZATION]);
        return;
      }

      const storedId = await get();
      const addOrUpdate = storedId !== undefined ? update : add;
      await addOrUpdate(user.personal.id, SELECTED_ORGANIZATION, organizationId);
    }
  };

  const select = async () => {
    if (isUserLoggedIn(user.personal)) {
      const organizationId = await get();

      if (organizationId) {
        const organizations = await getOrganizations();
        const organization = organizations.find(org => org.id === organizationId);

        if (organization) {
          await user.selectOrganization(organization);
        }
      }
    }
  };

  return { get, set, select };
}
