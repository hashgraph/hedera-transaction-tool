import type { ProgressInfo } from 'electron-updater';

export type UpdateErrorType = 'network' | 'connection-refused' | 'invalid-url' | 'generic';

export interface UpdateError {
  type: UpdateErrorType;
  message: string;
  details: string;
}

export type UpdateProgress = ProgressInfo;

export type UpdateState = 'idle' | 'checking' | 'downloading' | 'downloaded' | 'installing' | 'error';

