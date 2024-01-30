export const getNumberArrayFromString = (str: string) => {
  return str.split(',').map(n => Number(n));
};
