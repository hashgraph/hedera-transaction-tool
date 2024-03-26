import { contextBridge } from 'electron';

import localUserAPI from './localUser';
import organizationAPI from './organization';

export const electronAPI = {
  local: {
    ...localUserAPI,
  },
  organization: {
    ...organizationAPI,
  },
};

typeof electronAPI;
contextBridge.exposeInMainWorld('electronAPI', electronAPI);
