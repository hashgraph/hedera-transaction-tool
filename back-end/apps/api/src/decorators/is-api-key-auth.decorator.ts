import { createParamDecorator, ExecutionContext } from '@nestjs/common';

// Whether the current request was authenticated via the read-only report API
// key (set by JwtOrApiKeyGuard) rather than a JWT. Lets handlers withhold
// data that's fine for a live admin session but too broad for a narrowly
// scoped, easily-shared API key - e.g. other users' API key metadata.
export const IsApiKeyAuthFactory = (_data: unknown, context: ExecutionContext): boolean => {
  const request = context.switchToHttp().getRequest();
  return !!request.authViaApiKey;
};

export const IsApiKeyAuth = createParamDecorator(IsApiKeyAuthFactory);
