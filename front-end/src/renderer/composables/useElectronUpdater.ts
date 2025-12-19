import { ref, readonly, onBeforeUnmount } from 'vue';
import type { UpdateState, UpdateProgress, UpdateError } from '@shared/interfaces/update';
import type { ProgressInfo, UpdateInfo } from 'electron-updater';

const state = ref<UpdateState>('idle');
const progress = ref<UpdateProgress | null>(null);
const error = ref<UpdateError | null>(null);
const updateInfo = ref<UpdateInfo | null>(null);

export default function useElectronUpdater() {
  const startUpdate = (updateUrl: string) => {
    if (!updateUrl) {
      return;
    }

    state.value = 'checking';
    error.value = null;
    progress.value = null;

    window.electronAPI.local.update.onCheckingForUpdate(() => {
      state.value = 'checking';
    });

    window.electronAPI.local.update.onUpdateAvailable((info: UpdateInfo) => {
      updateInfo.value = info;
      state.value = 'downloading';
    });

    window.electronAPI.local.update.onUpdateNotAvailable(() => {
      state.value = 'idle';
      updateInfo.value = null;
    });

    window.electronAPI.local.update.onDownloadProgress((info: ProgressInfo) => {
      progress.value = info;
      state.value = 'downloading';
    });

    window.electronAPI.local.update.onUpdateDownloaded(() => {
      state.value = 'downloaded';
    });

    window.electronAPI.local.update.onError((err: UpdateError) => {
      state.value = 'error';
      error.value = err;
    });

    window.electronAPI.local.update.startDownload(updateUrl);
  };

  const installUpdate = () => {
    state.value = 'installing';
    window.electronAPI.local.update.install();
  };

  const cancelUpdate = () => {
    window.electronAPI.local.update.cancel();
    window.electronAPI.local.update.removeAllListeners();
    state.value = 'idle';
    progress.value = null;
    error.value = null;
    updateInfo.value = null;
  };

  const reset = () => {
    window.electronAPI.local.update.removeAllListeners();
    state.value = 'idle';
    progress.value = null;
    error.value = null;
    updateInfo.value = null;
  };

  onBeforeUnmount(() => {
    reset();
  });

  return {
    state: readonly(state),
    progress: readonly(progress),
    error: readonly(error),
    updateInfo: readonly(updateInfo),
    startUpdate,
    installUpdate,
    cancelUpdate,
    reset,
  };
}

