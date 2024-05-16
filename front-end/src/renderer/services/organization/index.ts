import { AxiosError } from 'axios';

export * from './auth';
export * from './user';
export * from './userKeys';
export * from './health';
export * from './transaction';

export function throwIfNoResponse(error: AxiosError) {
  if (!error.response) {
    throw new Error('Failed to connect to the server');
  }
}
