const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

jest.setTimeout(30000);

afterAll(async () => {
  await sleep(50);
});
