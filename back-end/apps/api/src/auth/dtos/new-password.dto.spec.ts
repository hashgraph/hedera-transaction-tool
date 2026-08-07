import 'reflect-metadata';
import { validate } from 'class-validator';

import { NewPasswordDto } from './new-password.dto';

const buildDto = (password: string) => {
  const dto = new NewPasswordDto();
  (dto as any).password = password;
  return dto;
};

describe('NewPasswordDto', () => {
  it('accepts a password of exactly 10 characters', async () => {
    const errors = await validate(buildDto('1234567890'));
    expect(errors).toHaveLength(0);
  });

  it('accepts a password longer than 10 characters', async () => {
    const errors = await validate(buildDto('averylongpassword'));
    expect(errors).toHaveLength(0);
  });

  it('rejects a password shorter than 10 characters', async () => {
    const errors = await validate(buildDto('short'));
    expect(errors.find(e => e.property === 'password')).toBeDefined();
  });

  it('carries the updated error message', async () => {
    const errors = await validate(buildDto('short'));
    const pw = errors.find(e => e.property === 'password');
    const msg = Object.values(pw?.constraints ?? {}).join('');
    expect(msg).toContain('10 characters');
  });
});
