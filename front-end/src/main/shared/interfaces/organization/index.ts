export * from './userKeys';
export * from './user';
export * from './transactions';
export * from './signers';
export * from './observers';

export type PaginatedResourceDto<T> = {
  totalItems: number;
  items: T[];
  page: number;
  size: number;
};
