import jwt from 'jsonwebtoken';

const secret = process.env.JWT_SECRET;
if (!secret || secret.length < 32) {
  throw new Error('JWT_SECRET não está definido ou tem menos de 32 caracteres. O servidor não arranca sem ele.');
}
const JWT_SECRET: string = secret;
// Token de acesso curto: a sessão é mantida pelo refresh token (cookie httpOnly, ver session.ts)
const JWT_EXPIRES_IN = (process.env.JWT_EXPIRES_IN || '15m') as jwt.SignOptions['expiresIn'];

export interface JwtPayload {
  sub: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  /** Sessão (família de refresh tokens) a que o token pertence */
  sid?: string;
  exp?: number;
}

export function signJwt(user: { id: string; email: string | null; firstName: string | null; lastName: string | null }, sid?: string) {
  const payload: JwtPayload = { sub: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, ...(sid ? { sid } : {}) };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/** Token de acesso: rejeita tokens de propósito específico (2FA, cancelar emails). */
export function verifyJwt(token: string): JwtPayload | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as JwtPayload & { purpose?: string };
    return payload.purpose ? null : payload;
  } catch {
    return null;
  }
}

/** Token com um único propósito (ex.: "2fa", "unsubscribe"); não serve como sessão. */
export function signPurposeToken(sub: string, purpose: string, expiresIn: jwt.SignOptions['expiresIn']) {
  return jwt.sign({ sub, purpose }, JWT_SECRET, { expiresIn });
}

export function verifyPurposeToken(token: string, purpose: string): string | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { sub: string; purpose?: string };
    return payload.purpose === purpose ? payload.sub : null;
  } catch {
    return null;
  }
}
