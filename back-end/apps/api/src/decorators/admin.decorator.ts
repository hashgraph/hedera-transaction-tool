import { SetMetadata } from '@nestjs/common';

export const IS_ADMIN = 'isAdmin';
export const IsAdmin = () => SetMetadata(IS_ADMIN, true);
