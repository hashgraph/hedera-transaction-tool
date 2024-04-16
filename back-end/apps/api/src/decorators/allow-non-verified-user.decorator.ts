import { SetMetadata } from '@nestjs/common';

export const ALLOW_NONE_VERIFIED_USER = 'ALLOW_NONE_VERIFIED_USER';
export const AllowNoneVerifiedUser = () => SetMetadata(ALLOW_NONE_VERIFIED_USER, true);
