import 'reflect-metadata';
import { validate } from 'class-validator';

import { ChangePasswordDto } from './change-password.dto';

const buildDto = (oldPassword: string, newPassword: string) => {
  const dto = new ChangePasswordDto();
  (dto as any).oldPassword = oldPassword;
  (dto as any).newPassword = newPassword;
  return dto;
};

const VALID_PASSWORD = '1234567890';
const OLD_PASSWORD = 'any-value';

describe('ChangePasswordDto', () => {
  it('accepts a password of exactly 10 characters', async () => {
    const errors = await validate(buildDto(OLD_PASSWORD, VALID_PASSWORD));
    expect(errors.filter(e => e.property === 'newPassword')).toHaveLength(0);
  });

  it('accepts a password longer than 10 characters', async () => {
    const errors = await validate(buildDto(OLD_PASSWORD, 'averylongpassword'));
    expect(errors.filter(e => e.property === 'newPassword')).toHaveLength(0);
  });

  it('rejects a password shorter than 10 characters', async () => {
    const errors = await validate(buildDto(OLD_PASSWORD, 'short'));
    expect(errors.find(e => e.property === 'newPassword')).toBeDefined();
  });

  it('carries the updated error message', async () => {
    const errors = await validate(buildDto(OLD_PASSWORD, 'short'));
    const pw = errors.find(e => e.property === 'newPassword');
    const msg = Object.values(pw?.constraints ?? {}).join('');
    expect(msg).toContain('10 characters');
  });

  it('requires oldPassword to be present', async () => {
    const errors = await validate(buildDto('', VALID_PASSWORD));
    expect(errors.find(e => e.property === 'oldPassword')).toBeDefined();
  });
});
