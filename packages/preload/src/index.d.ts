import type {electronAPI} from './';

type ElectronAPI = typeof electronAPI;

export default ElectronAPI;

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
