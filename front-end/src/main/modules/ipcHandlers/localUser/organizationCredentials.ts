import {
  getOrganizationTokens,
  organizationsToSignIn,
  shouldSignInOrganization,
  addOrganizationCredentials,
  updateOrganizationCredentials,
  deleteOrganizationCredentials,
  tryAutoSignIn,
  getOrganizationCredentials,
} from '@main/services/localUser';
import { createIPCChannel, renameFunc } from '@main/utils/electronInfra';

export default () => {
  /* Organization Credentials */
  createIPCChannel('organizationCredentials', [
    renameFunc(getOrganizationTokens, 'getOrganizationTokens'),
    renameFunc(organizationsToSignIn, 'organizationsToSignIn'),
    renameFunc(shouldSignInOrganization, 'shouldSignInOrganization'),
    renameFunc(addOrganizationCredentials, 'addOrganizationCredentials'),
    renameFunc(updateOrganizationCredentials, 'updateOrganizationCredentials'),
    renameFunc(deleteOrganizationCredentials, 'deleteOrganizationCredentials'),
    renameFunc(getOrganizationCredentials, 'getOrganizationCredentials'),
    renameFunc(tryAutoSignIn, 'tryAutoSignIn'),
  ]);
};
