import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

import { MAX_TRANSACTION_COMMENT_LENGTH } from '@entities';

import { CreateCommentDto } from './create-comment.dto';

const toDto = (plain: Record<string, unknown>) =>
  plainToInstance(CreateCommentDto, plain, { enableImplicitConversion: true });

describe('CreateCommentDto', () => {
  test('passes validation for a message within the max length', () => {
    const dto = toDto({ message: 'a'.repeat(MAX_TRANSACTION_COMMENT_LENGTH) });

    const errors = validateSync(dto as object);

    expect(errors).toHaveLength(0);
  });

  test('fails validation when message exceeds the max length', () => {
    const dto = toDto({ message: 'a'.repeat(MAX_TRANSACTION_COMMENT_LENGTH + 1) });

    const errors = validateSync(dto as object);

    expect(errors.length).toBeGreaterThan(0);
    const messageError = errors.find(e => e.property === 'message');
    expect(messageError?.constraints).toHaveProperty('maxLength');
  });
});
