import * as fs from 'fs/promises';

import { app, BrowserWindow } from 'electron';

export type NewVersion = {
  version: string;
  file: string;
};

export class Updater {
  static async checkForUpdate(location: string) {
    const [window] = BrowserWindow.getAllWindows();
    if (!window) return;

    const updateData = await this.checkLocation(location);

    if (!updateData) {
      return;
    }

    if (this.isNewerVersion(updateData.version, app.getVersion())) {
      window.webContents.send('update:check-for-update-result', updateData.file);
    }
  }

  private static async checkLocation(location: string): Promise<NewVersion | null> {
    try {
      const fileNames = await fs.readdir(location);
      const file = fileNames.find(
        fileName => fileName.startsWith('hedera-transaction-tool-') && fileName.endsWith('.pkg'),
      );
      const version = file?.match(/hedera-transaction-tool-(\d+\.\d+\.\d+)-universal\.pkg/)?.[1];

      if (!file || !version) {
        return null;
      }

      return { version, file };
    } catch {
      return null;
    }
  }

  private static isNewerVersion(newVersion: string, currentVersion: string): boolean {
    const parseVersion = (version: string) => {
      const [main, pre] = version.split('-');
      const mainParts = main.split('.').map(Number);
      const preParts = pre
        ? pre.split('.').map(part => (isNaN(Number(part)) ? part : Number(part)))
        : [];
      return { mainParts, preParts };
    };

    const compareParts = (a: (number | string)[], b: (number | string)[]) => {
      for (let i = 0; i < Math.max(a.length, b.length); i++) {
        const aPart = a[i] !== undefined ? a[i] : 0;
        const bPart = b[i] !== undefined ? b[i] : 0;

        if (typeof aPart === 'number' && typeof bPart === 'number') {
          if (aPart > bPart) return 1;
          if (aPart < bPart) return -1;
        } else {
          if (String(aPart) > String(bPart)) return 1;
          if (String(aPart) < String(bPart)) return -1;
        }
      }
      return 0;
    };

    const current = parseVersion(currentVersion);
    const latest = parseVersion(newVersion);

    const mainComparison = compareParts(latest.mainParts, current.mainParts);
    if (mainComparison !== 0) return mainComparison > 0;

    return compareParts(latest.preParts, current.preParts) > 0;
  }
}
