import {
  addGroup,
  addGroupItem,
  getGroup,
  getGroups,
  getGroupsCount,
  getGroupItems,
  deleteGroup,
  editGroupItem,
  getGroupItem,
  updateGroup,
  deleteGroupItem,
} from '@main/services/localUser';
import { createIPCChannel } from '@main/utils/electronInfra';

export default () => {
  /* Transaction Groups */
  createIPCChannel('transactionGroups', [
    addGroup,
    addGroupItem,
    getGroups,
    getGroup,
    getGroupItem,
    getGroupItems,
    getGroupsCount,
    updateGroup,
    editGroupItem,
    deleteGroup,
    deleteGroupItem,
  ]);
};
