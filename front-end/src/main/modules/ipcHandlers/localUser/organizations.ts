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
    renameFunc(addOrganization, 'addOrganization'),
    renameFunc(getOrganizations, 'getOrganizations'),
    renameFunc(updateOrganization, 'updateOrganization'),
    renameFunc(removeOrganization, 'deleteOrganization'),
  ]);
};
