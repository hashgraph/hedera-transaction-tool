import { BrowserWindow } from 'electron';
import {
  autoUpdater,
  MacUpdater,
  NsisUpdater,
  AppImageUpdater,
  type UpdateInfo,
  type ProgressInfo,
} from 'electron-updater';
import { is } from '@electron-toolkit/utils';

import { getAppUpdateLogger } from '@main/modules/logger';
import { categorizeUpdateError } from '@main/utils/updateErrors';

export class ElectronUpdaterService {
  private updater: MacUpdater | NsisUpdater | AppImageUpdater | null = null;
  private logger = getAppUpdateLogger();
  private window: BrowserWindow | null = null;
  private currentUpdateUrl: string | null = null;

  constructor(window: BrowserWindow) {
    this.window = window;
    this.setupLogger();
  }

  private setupLogger(): void {
    autoUpdater.logger = this.logger;
    autoUpdater.autoDownload = false;

    if (is.dev) {
      autoUpdater.forceDevUpdateConfig = true;
    }
  }

  private createUpdater(updateUrl: string): MacUpdater | NsisUpdater | AppImageUpdater {
    const options = {
      provider: 'generic' as const,
      url: updateUrl,
    };

    switch (process.platform) {
      case 'darwin':
        return new MacUpdater(options);
      case 'win32':
        return new NsisUpdater(options);
      default:
        return new AppImageUpdater(options);
    }
  }

  initialize(updateUrl: string): void {
    if (!updateUrl) {
      this.logger.error('Cannot initialize updater: updateUrl is empty');
      return;
    }

    this.currentUpdateUrl = updateUrl;
    this.updater = this.createUpdater(updateUrl);

    this.updater.logger = this.logger;
    this.updater.autoDownload = false;

    this.logger.info(`Updater initialized with URL: ${updateUrl}`);
  }

  private setupEventListeners(): void {
    if (!this.updater || !this.window) {
      return;
    }

    this.removeEventListeners();

    this.updater.on('checking-for-update', () => {
      this.logger.info('Checking for update...');
      this.window?.webContents.send('update:checking-for-update');
    });

    this.updater.on('update-available', (info: UpdateInfo) => {
      this.logger.info(`Update available: ${info.version}`);
      this.window?.webContents.send('update:update-available', info);
    });

    this.updater.on('update-not-available', () => {
      this.logger.info('No update available');
      this.window?.webContents.send('update:update-not-available');
    });

    this.updater.on('download-progress', (info: ProgressInfo) => {
      this.logger.debug(
        `Download progress: ${info.percent.toFixed(2)}% (${info.transferred}/${info.total} bytes)`,
      );
      this.window?.webContents.send('update:download-progress', info);
    });

    this.updater.on('update-downloaded', () => {
      this.logger.info('Update downloaded successfully');
      this.window?.webContents.send('update:update-downloaded');
    });

    this.updater.on('error', (error: Error) => {
      const categorized = categorizeUpdateError(error);
      this.logger.error(`Update error [${categorized.type}]: ${categorized.details}`);

      this.window?.webContents.send('update:error', {
        type: categorized.type,
        message: categorized.message,
        details: categorized.details,
      });
    });
  }

  private removeEventListeners(): void {
    if (!this.updater) {
      return;
    }

    this.updater.removeAllListeners('checking-for-update');
    this.updater.removeAllListeners('update-available');
    this.updater.removeAllListeners('update-not-available');
    this.updater.removeAllListeners('download-progress');
    this.updater.removeAllListeners('update-downloaded');
    this.updater.removeAllListeners('error');
  }

  async checkForUpdates(updateUrl?: string): Promise<void> {
    if (updateUrl) {
      this.initialize(updateUrl);
    }

    if (!this.updater) {
      const error = new Error(
        'Updater not initialized. Call initialize() first or provide updateUrl.',
      );
      const categorized = categorizeUpdateError(error);
      this.window?.webContents.send('update:error', {
        type: categorized.type,
        message: categorized.message,
        details: categorized.details,
      });
      return;
    }

    this.setupEventListeners();
    this.logger.info('Checking for updates...');

    try {
      await this.updater.checkForUpdates();
    } catch (error) {
      const categorized = categorizeUpdateError(error as Error);
      this.logger.error(`Failed to check for updates: ${categorized.details}`);
      this.window?.webContents.send('update:error', {
        type: categorized.type,
        message: categorized.message,
        details: categorized.details,
      });
    }
  }

  async downloadUpdate(): Promise<void> {
    if (!this.updater) {
      const error = new Error('Updater not initialized');
      const categorized = categorizeUpdateError(error);
      this.window?.webContents.send('update:error', {
        type: categorized.type,
        message: categorized.message,
        details: categorized.details,
      });
      return;
    }

    this.logger.info('Starting update download...');

    try {
      await this.updater.downloadUpdate();
    } catch (error) {
      const categorized = categorizeUpdateError(error as Error);
      this.logger.error(`Failed to download update: ${categorized.details}`);
      this.window?.webContents.send('update:error', {
        type: categorized.type,
        message: categorized.message,
        details: categorized.details,
      });
    }
  }

  quitAndInstall(isSilent: boolean = false, isForceRunAfter: boolean = true): void {
    if (!this.updater) {
      this.logger.error('Cannot quit and install: updater not initialized');
      return;
    }

    this.logger.info('Quitting and installing update...');
    this.updater.quitAndInstall(isSilent, isForceRunAfter);
  }

  cancelUpdate(): void {
    if (!this.updater) {
      return;
    }

    this.logger.info('Cancelling update download');
    this.removeEventListeners();
  }

  getUpdateUrl(): string | null {
    return this.currentUpdateUrl;
  }
}
