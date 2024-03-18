import { electronAPI } from '../preload';

type ElectronAPI = typeof electronAPI;

export default ElectronAPI;

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
