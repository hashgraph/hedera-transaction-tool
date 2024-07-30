const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

afterAll(async () => {
  await sleep(50);
});
