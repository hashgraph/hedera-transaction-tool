export const getMessageFromIPCError = (err: any, msg: string) => {
  console.log(err);
  return err.message?.split(': Error: ')[1] || msg;
};

export const commonIPCHandler = async <T>(callback: () => Promise<T>, defaultMessage: string) => {
  try {
    return await callback();
  } catch (error) {
    throw Error(getMessageFromIPCError(error, defaultMessage));
  }
};
