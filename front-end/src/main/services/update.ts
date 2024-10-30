import * as fs from 'fs/promises';

import { app, BrowserWindow } from 'electron';

const LATEST_MAY_YML = 'latest-mac.yml';

export type LatestYML = {
  version: string;
  files: string[];
};

export class Updater {
  static async checkForUpdate(location: string) {
    const [window] = BrowserWindow.getAllWindows();
    if (!window) return;

    const updateData = await this.readLatestMacYml(location);

    if (!updateData || !(await this.verifyFiles(location, updateData.files))) {
      return;
    }

    if (this.isNewerVersion(updateData.version, app.getVersion())) {
      const file = this.getFileForPlatform(updateData.files);
      window.webContents.send('update:check-for-update-result', file);
    }
  }

  private static async readLatestMacYml(location: string): Promise<LatestYML | null> {
    try {
      const file = await fs.readFile(`${location}/${LATEST_MAY_YML}`, {
        encoding: 'utf-8',
        flag: 'r',
      });

      const lines = file.split('\n');
      let version: string | null = null;

      const files: string[] = [];
      for (const line of lines) {
        if (line) {
          if (line.startsWith('version:')) {
            version = line.split(': ')[1];
          }
          if (line.startsWith('  - url:')) {
            files.push(line.split(': ')[1]);
          }
        }
      }

      if (!version) {
        return null;
      }

      return { version, files };
    } catch (error) {
      return null;
    }
  }

  private static async verifyFiles(location: string, files: string[]) {
    let fileNames = await fs.readdir(location);
    fileNames = fileNames.map(file => file.replaceAll(' ', '-'));

    for (const file of files) {
      if (!fileNames.includes(file)) {
        return false;
      }
    }

    return true;
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

  private static getFileForPlatform(files: string[]): string | null {
    for (const file of files) {
      if (file.includes(process.arch)) {
        return file;
      }
    }

    return null;
  }
}
