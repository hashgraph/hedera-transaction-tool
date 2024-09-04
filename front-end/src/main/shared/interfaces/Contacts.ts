import type { IUser, IUserKey } from './organization';

export interface Contact {
  user: IUser;
  userKeys: IUserKey[];
  nickname: string;
  nicknameId: string | null;
}
[];
