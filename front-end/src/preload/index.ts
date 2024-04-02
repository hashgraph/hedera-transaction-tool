import { contextBridge } from 'electron';

import localUserAPI from './localUser';

export const electronAPI = {
  local: {
    ...localUserAPI,
  },
};

typeof electronAPI;
contextBridge.exposeInMainWorld('electronAPI', electronAPI);
