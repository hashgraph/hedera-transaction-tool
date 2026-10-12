import type { IUserKey } from '../userKeys';
import type { IApiKeyStatus } from '../apiKeys';

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
  canViewReports: boolean;
  keys: IUserKey[];
  clients?: IClient[];
  updateAvailable?: boolean;
  /* Only populated for admin requesters */
  apiKeyStatus?: IApiKeyStatus;
}
