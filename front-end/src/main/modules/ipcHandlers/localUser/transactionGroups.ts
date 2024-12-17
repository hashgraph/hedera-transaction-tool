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
import { createIPCChannel, renameFunc } from '@main/utils/electronInfra';

export default () => {
  /* Transaction Groups */
  createIPCChannel('transactionGroups', [
    renameFunc(addGroup, 'addGroup'),
    renameFunc(addGroupItem, 'addGroupItem'),
    renameFunc(getGroups, 'getGroups'),
    renameFunc(getGroup, 'getGroup'),
    renameFunc(getGroupItem, 'getGroupItem'),
    renameFunc(getGroupItems, 'getGroupItems'),
    renameFunc(getGroupsCount, 'getGroupsCount'),
    renameFunc(updateGroup, 'updateGroup'),
    renameFunc(editGroupItem, 'editGroupItem'),
    renameFunc(deleteGroup, 'deleteGroup'),
    renameFunc(deleteGroupItem, 'deleteGroupItem'),
  ]);
};
