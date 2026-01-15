import { EntityManager } from 'typeorm';

import { User, UserKey } from '@app/common/database/entities';

export const attachKeys = async (
  user: User,
  entityManager: EntityManager,
  withDeleted: boolean = false,
) => {
  if (!user.keys || user.keys.length === 0) {
    user.keys = await entityManager.find(UserKey, {
      where: { userId: user.id },
      withDeleted,
    });
  }
};
