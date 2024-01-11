export function isEmail(email: string) {
  if (/^[A-Za-z0-9_!#$%&'*+/=?`{|}~^.-]+@[A-Za-z0-9.-]+$/.test(email)) {
    return true;
  }
  return false;
}
