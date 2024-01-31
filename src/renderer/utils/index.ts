export const getMessageFromIPCError = (err: any, msg: string) => {
  return err.message?.split(': Error: ')[1] || msg;
};

export const getDateTimeLocalInputValue = (date: Date) => {
  const tzo = -date.getTimezoneOffset();
  const dif = tzo >= 0 ? '+' : '-';
  const pad = function (num) {
    return (num < 10 ? '0' : '') + num;
  };

  const formattedDate =
    date.getFullYear() +
    '-' +
    pad(date.getMonth() + 1) +
    '-' +
    pad(date.getDate()) +
    'T' +
    pad(date.getHours()) +
    ':' +
    pad(date.getMinutes()) +
    ':' +
    pad(date.getSeconds()) +
    dif +
    pad(Math.floor(Math.abs(tzo) / 60)) +
    ':' +
    pad(Math.abs(tzo) % 60);

  return formattedDate.slice(0, 19);
};
