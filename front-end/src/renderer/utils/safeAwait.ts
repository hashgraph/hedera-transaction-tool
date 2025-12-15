interface ISafeAwaitResultData<T> {
  data: T;
  error?: never;
}
interface ISafeAwaitResultError {
  data?: never;
  error: unknown;
}
export type ISafeAwaitResult<T> = ISafeAwaitResultData<T> | ISafeAwaitResultError;
const nativeExceptions = [
  EvalError,
  RangeError,
  ReferenceError,
  SyntaxError,
  TypeError,
  URIError,
].filter(except => typeof except === 'function');
const throwNative = (error?: Error) => {
  for (const Exception of nativeExceptions) {
    if (error instanceof Exception) {
      throw error;
    }
  }
};
export const safeAwait = async <T>(promise: Promise<T>): Promise<ISafeAwaitResult<T>> => {
  try {
    const data = await promise;
    if (data instanceof Error) {
      throwNative(data);
      return { error: data };
    }
    return { data } as ISafeAwaitResultData<T>;
  } catch (error: unknown) {
    throwNative(error as Error);
    return { error };
  }
};
// export const safeAwaitAll = async <T extends unknown[]>(
//   promises: { [K in keyof T]: Promise<T[K]> },
//   finallyFunc?: () => Promise<void> | void,
// ): Promise<{ [K in keyof T]: ISafeAwaitResult<T[K]> }> => {
//   try {
//     const results = await Promise.all(promises.map(p => safeAwait(p)));
//     return results as { [K in keyof T]: ISafeAwaitResult<T[K]> };
//   } catch (error: unknown) {
//     return promises.map(() => ({ error }) as ISafeAwaitResultError) as {
//       [K in keyof T]: ISafeAwaitResult<T[K]>;
//     };
//   } finally {
//     await finallyFunc?.();
//   }
// };
