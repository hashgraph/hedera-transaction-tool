import { electronAPI } from '../../main/preload';

type ElectronAPI = typeof electronAPI;

/**
 * Should match main/preload.ts for typescript support in renderer
 */
export default ElectronAPI;

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
