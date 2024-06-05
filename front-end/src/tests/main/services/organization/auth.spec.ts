import { expect, vi } from 'vitest';

import axios from 'axios';

import { login } from '@main/services/organization';

describe('Services Organization Auth', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  const serverUrl = 'http://localhost:3000';
  const email = 'some@email.com';
  const password = 'password';

  test('login: sends a request to the server with the provided credentials', async () => {
    const response = {
      id: 'some-id',
      cookie: 'some-cookie',
    };

    vi.spyOn(axios, 'post').mockResolvedValueOnce({
      data: { id: response.id },
      headers: {
        'set-cookie': response.cookie,
      },
    });

    const result = await login(serverUrl, email, password);

    expect(result).toEqual(response);
  });

  test('login: throws and error when failed to login', async () => {
    vi.spyOn(axios, 'post').mockRejectedValueOnce('');

    expect(login(serverUrl, email, password)).rejects.toThrowError('Failed Sign in Organization');
  });
});
