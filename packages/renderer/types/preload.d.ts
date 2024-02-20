import type {electronAPI} from '../../preload/src';

type ElectronAPI = typeof electronAPI;

export default ElectronAPI;

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
