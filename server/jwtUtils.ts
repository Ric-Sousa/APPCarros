import jwt from 'jsonwebtoken';

const secret = process.env.JWT_SECRET;
if (!secret || secret.length < 32) {
  throw new Error('JWT_SECRET não está definido ou tem menos de 32 caracteres. O servidor não arranca sem ele.');
}
const JWT_SECRET: string = secret;
const JWT_EXPIRES_IN = (process.env.JWT_EXPIRES_IN || '1h') as jwt.SignOptions['expiresIn'];

export interface JwtPayload {
  sub: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
}

export function signJwt(user: { id: string; email: string | null; firstName: string | null; lastName: string | null }) {
  const payload: JwtPayload = { sub: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyJwt(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}
