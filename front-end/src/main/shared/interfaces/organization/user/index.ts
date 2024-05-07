export interface IUser {
  id: number;
  email: string;
  status: 'NEW' | 'NONE';
  admin: boolean;
}
