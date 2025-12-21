import { ref } from 'vue';

export type VersionStatus = 'current' | 'updateAvailable' | 'belowMinimum' | null;

export const versionStatus = ref<VersionStatus>(null);
export const updateUrl = ref<string | null>(null);
export const latestVersion = ref<string | null>(null);

export const setVersionBelowMinimum = (url: string | null): void => {
  versionStatus.value = 'belowMinimum';
  updateUrl.value = url;
};

export const resetVersionState = (): void => {
  versionStatus.value = null;
  updateUrl.value = null;
  latestVersion.value = null;
};
