import { ipcRenderer } from 'electron';

import { Organization, Prisma } from '@prisma/client';

export default {
  organizations: {
    getOrganizations: (): Promise<Organization[]> =>
      ipcRenderer.invoke('organizations:getOrganizations'),
    addOrganization: (organization: Prisma.OrganizationCreateInput): Promise<Organization> =>
      ipcRenderer.invoke('organizations:addOrganization', organization),
    updateOrganization: (
      id: string,
      organization: Prisma.OrganizationUncheckedUpdateWithoutOrganizationCredentialsInput,
    ): Promise<boolean> => ipcRenderer.invoke('organizations:updateOrganization', id, organization),
    deleteOrganization: (id: string): Promise<boolean> =>
      ipcRenderer.invoke('organizations:deleteOrganization', id),
  },
};
