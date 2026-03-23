import { Page } from '@playwright/test';

export interface DialogMockState {
  savePath?: string | null;
  openPaths?: string[];
}

type RendererElectronAPI = typeof globalThis & {
  electronAPI: {
    local: {
      utils: {
        clearDialogMockState: () => Promise<void>;
        setDialogMockState: (state: DialogMockState) => Promise<void>;
      };
    };
  };
};

export async function clearDialogMockState(window: Page): Promise<void> {
  await window.evaluate(async () => {
    await (globalThis as RendererElectronAPI).electronAPI.local.utils.clearDialogMockState();
  });
}

export async function setDialogMockState(
  window: Page,
  dialogMockState: DialogMockState,
): Promise<void> {
  await window.evaluate(async state => {
    await (globalThis as RendererElectronAPI).electronAPI.local.utils.setDialogMockState(state);
  }, dialogMockState);
}
