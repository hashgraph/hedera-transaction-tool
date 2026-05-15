import { Page } from '@playwright/test';

type RendererElectronAPI = typeof globalThis & {
  electronAPI: {
    local: {
      dataMigration: {
        locateDataMigrationFiles: () => Promise<boolean>;
      };
    };
  };
};

export async function migrationDataExists(window: Page): Promise<boolean> {
  return await window.evaluate(async () => {
    return await (globalThis as RendererElectronAPI).electronAPI.local.dataMigration.locateDataMigrationFiles();
  });
}
