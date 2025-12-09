import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let reflector: Reflector;
  let context: ExecutionContext;

  beforeEach(() => {
    reflector = { get: jest.fn() } as unknown as Reflector;
    context = { getHandler: jest.fn() } as unknown as ExecutionContext;
    guard = new JwtAuthGuard(reflector);
  });

  it('should allow access if IGNORE_CONTROLLER_GUARD is true', () => {
    jest.spyOn(reflector, 'get').mockReturnValue(true);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should call super.canActivate if IGNORE_CONTROLLER_GUARD is false', () => {
    jest.spyOn(reflector, 'get').mockReturnValue(false);

    const parentProto = Object.getPrototypeOf(JwtAuthGuard.prototype) as any;
    jest.spyOn(parentProto, 'canActivate').mockImplementation(() => true);

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should deny access if super.canActivate returns false and IGNORE_CONTROLLER_GUARD is false', () => {
    jest.spyOn(reflector, 'get').mockReturnValue(false);

    const parentProto = Object.getPrototypeOf(JwtAuthGuard.prototype) as any;
    jest.spyOn(parentProto, 'canActivate').mockImplementation(() => false);

    expect(guard.canActivate(context)).toBe(false);
  });
});
