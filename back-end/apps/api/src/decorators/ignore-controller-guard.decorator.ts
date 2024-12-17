import { SetMetadata } from '@nestjs/common';

export const IGNORE_CONTROLLER_GUARD = 'ignoreControllerGuard';
export const IgnoreControllerGuard = () => SetMetadata(IGNORE_CONTROLLER_GUARD, true);
