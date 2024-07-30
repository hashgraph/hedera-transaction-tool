import supertest from 'supertest';

export const getCookieRaw = (res: supertest.Response, name: string) => {
  if (Array.isArray(res.headers['set-cookie'])) {
    const cookies = res.headers['set-cookie'];
    return cookies.find(cookie => cookie.startsWith(name));
  } else {
    return res.headers['set-cookie'];
  }
};
