import { ipcRenderer } from 'electron';

import { Organization } from '@prisma/client';

export default {
  organizationCredentials: {
    getConnectedOrganizations: (user_id: string): Promise<Organization[]> =>
      ipcRenderer.invoke('organizationCredentials:getConnectedOrganizations', user_id),
    organizationsToSignIn: (
      user_id: string,
    ): Promise<{ credential_id?: string; email?: string; organization: Organization }[]> =>
      ipcRenderer.invoke('organizationCredentials:organizationsToSignIn', user_id),
    shouldSignInOrganization: (user_id: string, organization_id: string): Promise<boolean> =>
      ipcRenderer.invoke(
        'organizationCredentials:shouldSignInOrganization',
        user_id,
        organization_id,
      ),
    addOrganizationCredentials: (
      email: string,
      password: string,
      organization_id: string,
      user_id: string,
      jwtToken: string,
      encryptPassword: string,
      updateIfExists: boolean = false,
    ): Promise<boolean> =>
      ipcRenderer.invoke(
        'organizationCredentials:addOrganizationCredentials',
        email,
        password,
        organization_id,
        user_id,
        jwtToken,
        encryptPassword,
        updateIfExists,
      ),
    updateOrganizationCredentials: (
      organization_id: string,
      user_id: string,
      email?: string,
      password?: string,
      jwtToken?: string,
      encryptPassword?: string,
    ): Promise<boolean> =>
      ipcRenderer.invoke(
        'organizationCredentials:updateOrganizationCredentials',
        organization_id,
        user_id,
        email,
        password,
        jwtToken,
        encryptPassword,
      ),
    deleteOrganizationCredentials: (organization_id: string, user_id: string): Promise<boolean> =>
      ipcRenderer.invoke(
        'organizationCredentials:deleteOrganizationCredentials',
        organization_id,
        user_id,
      ),
    tryAutoSignIn: (user_id: string, decryptPassword: string): Promise<Organization[]> =>
      ipcRenderer.invoke('organizationCredentials:tryAutoSignIn', user_id, decryptPassword),
  },
};
