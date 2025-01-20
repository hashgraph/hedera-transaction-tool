import useUserStore from '@renderer/stores/storeUser';

import { SELECTED_ORGANIZATION } from '@main/shared/constants';

import { getOrganizations } from '@renderer/services/organizationsService';
import { getStoredClaim, add, update } from '@renderer/services/claimService';

import { isUserLoggedIn, safeAwait } from '@renderer/utils';

export default function useDefaultOrganization() {
  /* Stores */
  const user = useUserStore();

  /* Functions */
  const set = async (organizationId: string) => {
    if (isUserLoggedIn(user.personal)) {
      const selectedNetwork = await getStoredClaim(user.personal.id, SELECTED_ORGANIZATION);
      const addOrUpdate = selectedNetwork !== undefined ? update : add;
      await addOrUpdate(user.personal.id, SELECTED_ORGANIZATION, organizationId);
    }
  };
  const select = async () => {
    if (isUserLoggedIn(user.personal)) {
      const { data } = await safeAwait(getStoredClaim(user.personal.id, SELECTED_ORGANIZATION));

      if (data) {
        const organizations = await getOrganizations();
        const organization = organizations.find(org => org.id === data);

        if (organization) {
          await user.selectOrganization(organization);
        }
      }
    }
  };

  return { set, select };
}
