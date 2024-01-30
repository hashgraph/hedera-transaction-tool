export const getMessageFromIPCError = (err: any, msg: string) => {
  return err.message?.split(': Error: ')[1] || msg;
};
