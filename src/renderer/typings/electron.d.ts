/**
 * Should match main/preload.ts for typescript support in renderer
 */
export default interface ElectronApi {
  sendMessage: (message: string) => void;
  getNodeEnv: () => string;
}

declare global {
  interface Window {
    electronAPI: ElectronApi;
  }
}
