export enum RefreshStatus {
  REFRESHED = 'refreshed',
  NOT_MODIFIED = 'not_modified',
  DATA_UNCHANGED = 'data_unchanged',
  NOT_FOUND = 'not_found',
}

export type RefreshResult<T> = {
  status: RefreshStatus;
  data: T | null;
};