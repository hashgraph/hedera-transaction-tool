import { safeAwait, safeAwaitAll } from '../../../main/utils/safeAwait';

describe('safeAwait', () => {
  test('should return data when promise resolves', async () => {
    const promise = Promise.resolve('test');
    const result = await safeAwait(promise);
    expect(result).toEqual({ data: 'test' });
  });

  test('should return error when promise rejects', async () => {
    const promise = Promise.reject(new Error('test error'));
    const result = await safeAwait(promise);
    expect(result).toEqual({ error: new Error('test error') });
  });

  test('should throw native exceptions', async () => {
    const promise = Promise.reject(new TypeError('type error'));
    await expect(safeAwait(promise)).rejects.toThrow(TypeError);
  });

  test('should handle native exceptions correctly', async () => {
    const promise = Promise.reject(new TypeError('type error'));
    await expect(safeAwait(promise)).rejects.toThrow(TypeError);
  });

  test('should return error when promise resolves with an Error instance', async () => {
    const promise = Promise.resolve(new Error('resolved error'));
    const result = await safeAwait(promise);
    expect(result).toEqual({ error: new Error('resolved error') });
  });
});

describe('safeAwaitAll', () => {
  test('should return data for all resolved promises', async () => {
    const promises = [Promise.resolve('test1'), Promise.resolve('test2')];
    const result = await safeAwaitAll(promises);
    expect(result).toEqual([{ data: 'test1' }, { data: 'test2' }]);
  });

  test('should return error for all rejected promises', async () => {
    const promises = [Promise.reject(new Error('error1')), Promise.reject(new Error('error2'))];
    const result = await safeAwaitAll(promises);
    expect(result).toEqual([{ error: new Error('error1') }, { error: new Error('error2') }]);
  });

  test('should execute finallyFunc after all promises', async () => {
    const promises = [Promise.resolve('test1'), Promise.resolve('test2')];
    const finallyFunc = vi.fn();
    await safeAwaitAll(promises, finallyFunc);
    expect(finallyFunc).toHaveBeenCalled();
  });

  test('should handle mixed resolved and rejected promises', async () => {
    const promises = [Promise.resolve('test1'), Promise.reject(new Error('error2'))];
    const result = await safeAwaitAll(promises);
    expect(result).toEqual([{ data: 'test1' }, { error: new Error('error2') }]);
  });

  test('should return error for all promises if safeAwait throws', async () => {
    const promises = [Promise.reject(new TypeError('type error'))];
    const result = await safeAwaitAll(promises);
    expect(result).toEqual([{ error: new TypeError('type error') }]);
  });

  test('should handle empty promises array', async () => {
    const promises: Promise<unknown>[] = [];
    const result = await safeAwaitAll(promises);
    expect(result).toEqual([]);
  });
});
