export const getNumberArrayFromString = (str: string) => {
  return str.split(',').map(n => Number(n));
};

export const JSONtoUInt8Array = json => {
  const str = JSON.stringify(json, null, 0);
  const ret = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) {
    ret[i] = str.charCodeAt(i);
  }
  return ret;
};
