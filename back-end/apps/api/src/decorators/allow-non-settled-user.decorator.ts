import { SetMetadata } from '@nestjs/common';

export const ALLOW_NOT_SETTLED_USER = 'allow_not_settled_user';
export const AllowNotSettledUser = () => SetMetadata(ALLOW_NOT_SETTLED_USER, true);
