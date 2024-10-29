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
      window.webContents.send('update:check-for-update-result', updateData.version);
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
    const currentParts = currentVersion.split('.').map(Number);
    const newParts = newVersion.split('.').map(Number);

    for (let i = 0; i < newParts.length; i++) {
      if (newParts[i] > currentParts[i]) return true;
      if (newParts[i] < currentParts[i]) return false;
    }

    return false;
  }
}
