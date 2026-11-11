// Sessões: token de acesso curto (JWT, 15 min, guardado só em memória no cliente) + refresh token rotativo
// num cookie httpOnly. Cada login cria uma "família"; cada renovação gasta o token anterior. Se um token já gasto
// voltar a aparecer (roubo/cópia), a família inteira é revogada.
import { createHash, randomBytes, randomUUID } from 'crypto';
import type { Request, Response } from 'express';
import { db, toRow, withDefaults } from './db';
import * as schema from '@shared/schema';
import { signJwt } from './jwtUtils';

export const REFRESH_COOKIE = 'logicar_rt';
const COOKIE_PATH = '/api/auth';
const REMEMBER_DAYS = 30;
const SESSION_HOURS = 24; // sem "manter sessão": dura até fechar o browser, no máximo 24 h

const hash = (token: string) => createHash('sha256').update(token).digest('hex');
const secureCookies = () => process.env.NODE_ENV === 'production' || (process.env.APP_URL ?? '').startsWith('https://');

export function readCookie(req: Request, name: string): string | undefined {
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return undefined;
}

function setRefreshCookie(res: Response, token: string, remember: boolean) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: secureCookies(),
    sameSite: 'strict',
    path: COOKIE_PATH,
    ...(remember ? { maxAge: REMEMBER_DAYS * 86_400_000 } : {}),
  });
}

export function clearRefreshCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE, { httpOnly: true, secure: secureCookies(), sameSite: 'strict', path: COOKIE_PATH });
}

type SessionUser = { id: string; email: string | null; firstName: string | null; lastName: string | null };

/** Cria uma sessão nova (login/registo) ou continua uma família (renovação). Devolve o token de acesso. */
export async function issueSession(req: Request, res: Response, user: SessionUser, remember: boolean, familyId: string = randomUUID()): Promise<string> {
  const token = randomBytes(48).toString('base64url');
  const ttl = remember ? REMEMBER_DAYS * 86_400_000 : SESSION_HOURS * 3_600_000;
  await db.insertInto('refresh_tokens').values(toRow(schema.refreshTokens, withDefaults(schema.refreshTokens, {
    id: randomUUID(),
    userId: user.id,
    familyId,
    tokenHash: hash(token),
    remember,
    userAgent: String(req.headers['user-agent'] ?? '').slice(0, 255) || null,
    expiresAt: new Date(Date.now() + ttl),
  }))).execute();
  setRefreshCookie(res, token, remember);
  return signJwt(user, familyId);
}

/** Renova a sessão a partir do cookie. Devolve o utilizador e o novo token de acesso, ou null. */
export async function rotateSession(req: Request, res: Response): Promise<{ userId: string; accessFor: (u: SessionUser) => Promise<string> } | null> {
  const token = readCookie(req, REFRESH_COOKIE);
  if (!token) return null;
  const row = await db.selectFrom('refresh_tokens').selectAll().where('token_hash', '=', hash(token)).executeTakeFirst();
  if (!row) return null;
  if (row.revoked_at) {
    // Token já usado: alguém tem uma cópia. Termina todas as sessões desta família.
    await db.updateTable('refresh_tokens').set({ revoked_at: new Date() }).where('family_id', '=', row.family_id).where('revoked_at', 'is', null).execute();
    clearRefreshCookie(res);
    return null;
  }
  if (new Date(row.expires_at).getTime() < Date.now()) return null;
  await db.updateTable('refresh_tokens').set({ revoked_at: new Date() }).where('id', '=', row.id).execute();
  const remember = Boolean(Number(row.remember));
  return { userId: row.user_id, accessFor: (u) => issueSession(req, res, u, remember, row.family_id) };
}

/** Família da sessão atual: vem no token de acesso (sid), porque o cookie só é enviado para /api/auth. */
export async function currentFamily(req: Request): Promise<string | undefined> {
  if (req.user?.sid) return req.user.sid;
  const token = readCookie(req, REFRESH_COOKIE);
  if (!token) return undefined;
  const row = await db.selectFrom('refresh_tokens').select('family_id').where('token_hash', '=', hash(token)).executeTakeFirst();
  return row?.family_id;
}

/** Logout: termina a sessão (família) do cookie atual. */
export async function revokeCurrentSession(req: Request) {
  const token = readCookie(req, REFRESH_COOKIE);
  if (!token) return;
  const row = await db.selectFrom('refresh_tokens').select(['user_id', 'family_id']).where('token_hash', '=', hash(token)).executeTakeFirst();
  if (row) await revokeFamily(row.user_id as string, row.family_id as string);
}

export async function revokeFamily(userId: string, familyId: string) {
  await db.updateTable('refresh_tokens').set({ revoked_at: new Date() })
    .where('user_id', '=', userId).where('family_id', '=', familyId).where('revoked_at', 'is', null).execute();
}

/** Termina todas as sessões do utilizador (exceto, opcionalmente, a atual). */
export async function revokeAllSessions(userId: string, exceptFamily?: string) {
  let q = db.updateTable('refresh_tokens').set({ revoked_at: new Date() }).where('user_id', '=', userId).where('revoked_at', 'is', null);
  if (exceptFamily) q = q.where('family_id', '!=', exceptFamily);
  await q.execute();
}

/** Sessões ativas: uma por família (o token mais recente de cada uma). */
export async function listSessions(userId: string, current?: string) {
  const rows = await db.selectFrom('refresh_tokens').select(['family_id', 'user_agent', 'created_at', 'expires_at'])
    .where('user_id', '=', userId).where('revoked_at', 'is', null).execute();
  const now = Date.now();
  return rows
    .filter((r) => new Date(r.expires_at).getTime() > now)
    .map((r) => ({ id: r.family_id as string, userAgent: r.user_agent as string | null, createdAt: new Date(r.created_at), current: r.family_id === current }))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

// ---------- Tokens de uso único (verificar email, recuperar palavra-passe) ----------
export type OneTimeType = 'verify_email' | 'reset_password';

export async function createOneTimeToken(userId: string, type: OneTimeType, ttlMs: number): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  // Um pedido novo invalida os anteriores do mesmo tipo
  await db.updateTable('user_tokens').set({ used_at: new Date() }).where('user_id', '=', userId).where('type', '=', type).where('used_at', 'is', null).execute();
  await db.insertInto('user_tokens').values(toRow(schema.userTokens, withDefaults(schema.userTokens, {
    id: randomUUID(), userId, type, tokenHash: hash(token), expiresAt: new Date(Date.now() + ttlMs),
  }))).execute();
  return token;
}

/** Consome o token (uma só vez). Devolve o userId ou null se inválido/expirado/usado. */
export async function consumeOneTimeToken(token: string, type: OneTimeType): Promise<string | null> {
  if (!token) return null;
  const row = await db.selectFrom('user_tokens').selectAll().where('token_hash', '=', hash(token)).where('type', '=', type).executeTakeFirst();
  if (!row || row.used_at || new Date(row.expires_at).getTime() < Date.now()) return null;
  const r = await db.updateTable('user_tokens').set({ used_at: new Date() }).where('id', '=', row.id).where('used_at', 'is', null).executeTakeFirst();
  return Number(r.numUpdatedRows) > 0 ? (row.user_id as string) : null;
}

export const hashToken = hash;
