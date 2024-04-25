import { SetMetadata } from '@nestjs/common';

export const ALLOW_NON_VERIFIED_USER = 'ALLOW_NON_VERIFIED_USER';
export const AllowNonVerifiedUser = () => SetMetadata(ALLOW_NON_VERIFIED_USER, true);
