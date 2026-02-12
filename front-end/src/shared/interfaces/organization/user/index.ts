import type { IUserKey } from '../userKeys';

export interface IClient {
  id: number;
  version: string;
  updateAvailable: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface IUser {
  id: number;
  email: string;
  status: 'NEW' | 'NONE';
  admin: boolean;
  keys: IUserKey[];
  clients?: IClient[];
  updateAvailable?: boolean;
}
