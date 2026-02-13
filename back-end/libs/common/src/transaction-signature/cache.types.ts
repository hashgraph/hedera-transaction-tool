export enum RefreshStatus {
  REFRESHED = 'refreshed',
  NOT_MODIFIED = 'not_modified',
  NOT_FOUND = 'not_found',
}

export type RefreshResult<T> = {
  status: RefreshStatus;
  data: T | null;
};