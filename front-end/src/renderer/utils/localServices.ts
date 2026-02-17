const EXPORT_EXTENSION = 'exportExtension';

export const getLastExportExtension = () => {
  return localStorage.getItem(EXPORT_EXTENSION);
};

export const setLastExportExtension = (ext: string) => {
  localStorage.setItem(EXPORT_EXTENSION, ext);
};
