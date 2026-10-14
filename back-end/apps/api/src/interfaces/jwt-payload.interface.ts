export interface JwtPayload {
  userId: number;
  email: string;
  // Standard JWT claim, added by jwt.sign() itself rather than set explicitly -
  // optional here only because this type also describes the payload passed
  // into sign(), where it isn't provided yet; it's always present once decoded.
  iat?: number;
  // could add admin here
  // admin: boolean;
}
