import {
  getOrganizations,
  addOrganization,
  updateOrganization,
  removeOrganization,
} from '@main/services/localUser';
import { createIPCChannel, renameFunc } from '@main/utils/electronInfra';

export default () => {
  /* Organizations */
  createIPCChannel('organizations', [
    addOrganization,
    getOrganizations,
    updateOrganization,
    renameFunc(removeOrganization, 'deleteOrganization'),
  ]);
};
