export const guardMock = () => ({
  canActivate: jest.fn(() => {
    return true;
  }),
});
