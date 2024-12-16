import {
  getOrganizationTokens,
  organizationsToSignIn,
  shouldSignInOrganization,
  addOrganizationCredentials,
  updateOrganizationCredentials,
  deleteOrganizationCredentials,
  tryAutoSignIn,
} from '@main/services/localUser';
import { createIPCChannel } from '@main/utils/electronInfra';

export default () => {
  /* Organization Credentials */
  createIPCChannel('organizationCredentials', [
    getOrganizationTokens,
    organizationsToSignIn,
    shouldSignInOrganization,
    addOrganizationCredentials,
    updateOrganizationCredentials,
    deleteOrganizationCredentials,
    tryAutoSignIn,
  ]);
};
