import { SetMetadata } from '@nestjs/common';

// Marks a route (or an entire controller) as accepting a GET-only read-only
// API key (X-Api-Key header) as an alternative to a JWT - read by
// JwtOrApiKeyGuard. Routes without this decorator reject an API key outright
// and fall through to ordinary JWT auth, so the default is fail-closed.
export const ALLOW_API_KEY = 'ALLOW_API_KEY';
export const AllowApiKey = () => SetMetadata(ALLOW_API_KEY, true);
