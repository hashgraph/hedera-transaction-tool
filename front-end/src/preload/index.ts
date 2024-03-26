import { contextBridge } from 'electron';

import localUserAPI from './localUser';
import organizationAPI from './organization';

export const electronAPI = {
  ...localUserAPI,
  organization: {
    ...organizationAPI,
  },
};

typeof electronAPI;
contextBridge.exposeInMainWorld('electronAPI', electronAPI);
