import type { IUserKey } from '../userKeys';

export interface IUser {
  id: number;
  email: string;
  status: 'NEW' | 'NONE';
  admin: boolean;
  keys: IUserKey[];
}
