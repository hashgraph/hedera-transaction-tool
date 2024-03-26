import { AxiosError } from 'axios';

export * from './auth';
export * from './user';
export * from './ping';

export function throwIfNoResponse(error: AxiosError) {
  if (!error.response) {
    throw new Error('Failed to connect to the server');
  }
}
