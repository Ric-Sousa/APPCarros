import type { Express, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import QRCode from 'qrcode';
import { z } from 'zod';
import { BRAND } from '@shared/brand';
import { effectivePlan } from '@shared/plans';
import type { User } from '@shared/schema';
import { storage, toPublicUser, type PublicUser } from '../storage';
import { signPurposeToken, verifyPurposeToken } from '../jwtUtils';
import { requireAuth, uploads, userId, HttpError, limiter, removeUpload, isOwnVehiclePhoto } from '../http';
import {
  issueSession, rotateSession, clearRefreshCookie, currentFamily, revokeFamily, revokeAllSessions, listSessions,
  createOneTimeToken, consumeOneTimeToken, revokeCurrentSession,
} from '../session';
import { sendMail, appUrl } from '../services/mailer';
import { generateTotpSecret, verifyTotp, otpauthUrl } from '../totp';
import { DEFAULT_NOTIFICATION_PREFS } from '../notifications';
import { persistUpload } from '../files';

// Login: só contam as tentativas falhadas (quem entra bem não fica bloqueado)
const loginLimiter = limiter(10, 'tentativas de login', 15 * 60 * 1000, { skipSuccessfulRequests: true });
const registerLimiter = limiter(10, 'tentativas de registo', 60 * 60 * 1000);
const passwordLimiter = limiter(10, 'tentativas', 15 * 60 * 1000, { skipSuccessfulRequests: true });
const emailLimiter = limiter(5, 'pedidos de email', 15 * 60 * 1000);

// Hash de referência: quando o email não existe compara-se na mesma, para o tempo de resposta não revelar quem está registado
const DUMMY_HASH = bcrypt.hashSync('logicar-dummy-password', 10);

const password = z.string().min(8, 'A palavra-passe deve ter pelo menos 8 caracteres').max(200);
const email = z.string().trim().toLowerCase().pipe(z.email('Email inválido'));

const registerSchema = z.object({
  name: z.string().trim().min(1, 'Nome obrigatório').max(200),
  email,
  password,
  acceptTerms: z.literal(true, { error: 'Tem de aceitar os termos e a política de privacidade' }),
});

const profileSchema = z.object({
  firstName: z.string().trim().max(100).nullable().optional(),
  lastName: z.string().trim().max(100).nullable().optional(),
  email,
  phone: z.string().trim().max(20).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  bio: z.string().max(2000).nullable().optional(),
});

const preferencesSchema = z.object({
  theme: z.enum(['auto', 'light', 'dark']).optional(),
  language: z.string().max(10).optional(),
  notificationPreferences: z.object({
    email: z.boolean().optional(),
    push: z.boolean().optional(),
    leadDays: z.array(z.union([z.literal(30), z.literal(7), z.literal(1)])).max(3).optional(),
    weeklyDigest: z.boolean().optional(),
  }).loose().optional(),
}).loose();

const DEFAULT_PREFERENCES = { theme: 'auto', language: 'pt', notificationPreferences: DEFAULT_NOTIFICATION_PREFS };

const isBcryptHash = (value: string) => /^\$2[aby]\$/.test(value);
const VERIFY_TTL = 48 * 3_600_000;
const RESET_TTL = 3_600_000;

const adminEmails = () => (process.env.ADMIN_EMAILS ?? '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
export const isAdminEmail = (e: string | null | undefined) => !!e && adminEmails().includes(e.toLowerCase());

/** Utilizador como o cliente o vê: sem segredos, com o plano efetivo e se é administrador. */
export function userView(user: PublicUser | User) {
  const pub = 'password' in user ? toPublicUser(user as User) : user;
  return {
    ...pub,
    plan: effectivePlan(pub.plan, pub.planExpiresAt).id,
    totpEnabled: Boolean(pub.totpEnabled),
    isAdmin: isAdminEmail(pub.email),
  };
}

const shortUser = (u: { id: string; email: string | null; firstName: string | null; lastName: string | null }) =>
  ({ id: u.id, email: u.email, firstName: u.firstName, lastName: u.lastName });

async function sendVerificationEmail(user: { id: string; email: string | null; firstName: string | null }) {
  if (!user.email) return;
  const token = await createOneTimeToken(user.id, 'verify_email', VERIFY_TTL);
  await sendMail({
    to: user.email,
    subject: `Confirme o seu email · ${BRAND.name}`,
    paragraphs: [
      `Olá${user.firstName ? ` ${user.firstName}` : ''},`,
      `Confirme o seu email para receber os lembretes de IUC, inspeção, seguro e manutenção.`,
      'O link é válido durante 48 horas.',
    ],
    action: { label: 'Confirmar email', url: appUrl(`/verificar-email?token=${encodeURIComponent(token)}`) },
    footer: ['Se não criou esta conta, ignore este email.'],
  });
}

/** Termina o login: cria a sessão (cookie) e devolve o token de acesso. */
async function completeLogin(req: Request, res: Response, user: User, remember: boolean) {
  const token = await issueSession(req, res, user, remember);
  await storage.trackEvent(user.id, 'login');
  res.json({ token, user: shortUser(user) });
}

export function registerAuthRoutes(app: Express) {
  app.post('/login', loginLimiter, async (req, res) => {
    const { email: rawEmail, password: pass, remember } = req.body ?? {};
    if (typeof rawEmail !== 'string' || typeof pass !== 'string' || !rawEmail || !pass) {
      return res.status(400).json({ message: 'Email e palavra-passe obrigatórios.' });
    }

    const user = await storage.getUserByEmail(rawEmail.trim().toLowerCase());
    let valid = false;
    if (!user?.password) {
      await bcrypt.compare(pass, DUMMY_HASH);
    } else if (isBcryptHash(user.password)) {
      valid = await bcrypt.compare(pass, user.password);
    } else if (pass === user.password) {
      // Conta antiga com palavra-passe em texto simples: converte para hash no primeiro login.
      // Só se aplica a valores que não são hash, por isso enviar o próprio hash não autentica.
      valid = true;
      await storage.updateUserPassword(user.id, await bcrypt.hash(pass, 10));
    }
    if (!user || !valid) return res.status(401).json({ message: 'Credenciais inválidas.' });

    if (user.totpEnabled && user.totpSecret) {
      // Segundo passo: o cliente envia o código para /api/auth/2fa com este desafio (válido 5 min)
      return res.json({ twoFactorRequired: true, challengeToken: signPurposeToken(user.id, '2fa', '5m') });
    }
    await completeLogin(req, res, user, remember === true);
  });

  app.post('/api/auth/2fa', loginLimiter, async (req, res) => {
    const { challengeToken, code, remember } = z.object({ challengeToken: z.string().min(1), code: z.string().min(6).max(10), remember: z.boolean().optional() }).parse(req.body);
    const id = verifyPurposeToken(challengeToken, '2fa');
    const user = id ? await storage.getUserWithPassword(id) : undefined;
    if (!user?.totpSecret || !verifyTotp(user.totpSecret, code)) throw new HttpError(401, 'Código inválido.');
    await completeLogin(req, res, user, remember === true);
  });

  app.post('/api/auth/refresh', async (req, res) => {
    const rotated = await rotateSession(req, res);
    const user = rotated ? await storage.getUser(rotated.userId) : undefined;
    if (!rotated || !user) {
      clearRefreshCookie(res);
      return res.status(401).json({ message: 'Sessão terminada' });
    }
    const token = await rotated.accessFor(user);
    res.json({ token, user: shortUser(user) });
  });

  app.post('/api/auth/logout', async (req, res) => {
    await revokeCurrentSession(req);
    clearRefreshCookie(res);
    res.status(204).send();
  });

  app.post('/api/register', registerLimiter, async (req, res) => {
    const { name, email: mail, password: pass } = registerSchema.parse(req.body);
    if (await storage.getUserByEmail(mail)) {
      return res.status(409).json({ message: 'Este email já está registado.' });
    }
    const [firstName, ...rest] = name.split(/\s+/);
    const user = await storage.createUser({
      email: mail,
      password: await bcrypt.hash(pass, 10),
      firstName,
      lastName: rest.join(' '),
      termsAcceptedAt: new Date(),
      plan: 'free',
    });
    await storage.trackEvent(user.id, 'register');
    await sendVerificationEmail(user);
    const token = await issueSession(req, res, user, true);
    res.status(201).json({ token, user: shortUser(user), message: 'Conta criada! Enviámos um email para confirmar o endereço.' });
  });

  // ---------- Email: verificação ----------
  app.post('/api/auth/verify-email', async (req, res) => {
    const { token } = z.object({ token: z.string().min(1) }).parse(req.body);
    const id = await consumeOneTimeToken(token, 'verify_email');
    if (!id) throw new HttpError(400, 'O link de confirmação é inválido ou expirou. Peça um novo.');
    await storage.setUserFields(id, { emailVerifiedAt: new Date() });
    await storage.trackEvent(id, 'email_verified');
    res.status(204).send();
  });

  app.post('/api/auth/resend-verification', requireAuth, emailLimiter, async (req, res) => {
    const user = await storage.getUser(userId(req));
    if (!user) throw new HttpError(401, 'Token inválido');
    if (user.emailVerifiedAt) return res.status(204).send();
    await sendVerificationEmail(user);
    res.status(204).send();
  });

  // ---------- Recuperar palavra-passe ----------
  app.post('/api/auth/forgot-password', emailLimiter, async (req, res) => {
    const { email: mail } = z.object({ email }).parse(req.body);
    const user = await storage.getUserByEmail(mail);
    // Resposta igual quer o email exista quer não (não revela quem está registado)
    if (user?.email) {
      const token = await createOneTimeToken(user.id, 'reset_password', RESET_TTL);
      await sendMail({
        to: user.email,
        subject: `Recuperar a palavra-passe · ${BRAND.name}`,
        paragraphs: [
          `Olá${user.firstName ? ` ${user.firstName}` : ''},`,
          'Recebemos um pedido para definir uma nova palavra-passe. O link é válido durante 1 hora e só pode ser usado uma vez.',
        ],
        action: { label: 'Definir nova palavra-passe', url: appUrl(`/repor-palavra-passe?token=${encodeURIComponent(token)}`) },
        footer: ['Se não fez este pedido, ignore este email: a sua palavra-passe não muda.'],
      });
    }
    res.status(204).send();
  });

  app.post('/api/auth/reset-password', passwordLimiter, async (req, res) => {
    const { token, password: pass } = z.object({ token: z.string().min(1), password }).parse(req.body);
    const id = await consumeOneTimeToken(token, 'reset_password');
    if (!id) throw new HttpError(400, 'O link é inválido ou expirou. Peça um novo.');
    await storage.updateUserPassword(id, await bcrypt.hash(pass, 10));
    // Quem recebeu o email controla a caixa de correio: o email fica confirmado
    await storage.setUserFields(id, { emailVerifiedAt: (await storage.getUser(id))?.emailVerifiedAt ?? new Date() });
    await revokeAllSessions(id);
    res.status(204).send();
  });

  // ---------- Conta ----------
  app.get('/api/auth/user', requireAuth, async (req, res) => {
    const user = await storage.getUser(userId(req));
    if (!user) return res.status(401).json({ message: 'Token inválido' });
    res.json(userView(user));
  });

  app.put('/api/user/profile', requireAuth, async (req, res) => {
    const data = profileSchema.parse(req.body);
    const existing = await storage.getUserByEmail(data.email);
    if (existing && existing.id !== userId(req)) throw new HttpError(409, 'Este email já está a ser usado por outra conta.');
    const before = await storage.getUser(userId(req));
    const updated = await storage.updateUserProfile(userId(req), {
      firstName: data.firstName ?? null,
      lastName: data.lastName ?? null,
      email: data.email,
      phone: data.phone ?? null,
      address: data.address ?? null,
      bio: data.bio ?? null,
    });
    // Email novo: tem de ser confirmado outra vez
    if (before?.email !== data.email) {
      await storage.setUserFields(userId(req), { emailVerifiedAt: null });
      await sendVerificationEmail(updated);
    }
    res.json(userView((await storage.getUser(userId(req)))!));
  });

  app.post('/api/user/profile-image', requireAuth, uploads.profile.single('profileImage'), async (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'Nenhum ficheiro enviado' });
    const profileImageUrl = `/uploads/${req.file.filename}`;
    const previous = (await storage.getUser(userId(req)))?.profileImageUrl;
    await persistUpload(req.file);
    await storage.updateUserProfileImage(userId(req), profileImageUrl);
    if (previous) removeUpload(previous);
    res.json({ message: 'Foto de perfil atualizada', profileImageUrl });
  });

  app.put('/api/user/password', requireAuth, passwordLimiter, async (req, res) => {
    const { currentPassword, newPassword } = z.object({ currentPassword: z.string().min(1), newPassword: password }).parse(req.body);
    const user = await storage.getUserWithPassword(userId(req));
    if (!user?.password || !(await bcrypt.compare(currentPassword, user.password))) {
      throw new HttpError(401, 'A palavra-passe atual está errada.');
    }
    await storage.updateUserPassword(user.id, await bcrypt.hash(newPassword, 10));
    // As outras sessões (outros dispositivos) terminam; esta continua
    await revokeAllSessions(user.id, await currentFamily(req));
    res.status(204).send();
  });

  // Elimina a conta e todos os dados (veículos, registos, ficheiros). Pede a palavra-passe para confirmar.
  app.delete('/api/user', requireAuth, passwordLimiter, async (req, res) => {
    const { password: confirm } = z.object({ password: z.string().min(1, 'Indique a palavra-passe') }).parse(req.body ?? {});
    const user = await storage.getUserWithPassword(userId(req));
    if (!user?.password || !(await bcrypt.compare(confirm, user.password))) {
      throw new HttpError(401, 'A palavra-passe está errada.');
    }
    for (const file of await storage.deleteUser(user.id)) {
      // fotos de veículos podem estar a ser usadas noutro veículo: só se apagam se ninguém as usar
      if (!isOwnVehiclePhoto(file) || (await storage.photoUsage(file)) === 0) removeUpload(file);
    }
    clearRefreshCookie(res);
    res.status(204).send();
  });

  // Exportação de todos os dados (RGPD, art. 20.º)
  app.get('/api/user/export', requireAuth, limiter(10, 'exportações', 60 * 60 * 1000), async (req, res) => {
    const data = await storage.exportUserData(userId(req));
    res.setHeader('Content-Disposition', `attachment; filename="${BRAND.name.toLowerCase()}-dados-${new Date().toISOString().slice(0, 10)}.json"`);
    res.type('application/json').send(JSON.stringify(data, null, 2));
  });

  app.post('/api/user/onboarded', requireAuth, async (req, res) => {
    await storage.setUserFields(userId(req), { onboardedAt: new Date() });
    await storage.trackEvent(userId(req), 'onboarded');
    res.status(204).send();
  });

  // ---------- Sessões ----------
  app.get('/api/user/sessions', requireAuth, async (req, res) => {
    res.json(await listSessions(userId(req), await currentFamily(req)));
  });

  app.delete('/api/user/sessions/:id', requireAuth, async (req, res) => {
    await revokeFamily(userId(req), String(req.params.id));
    res.status(204).send();
  });

  app.post('/api/user/sessions/revoke-others', requireAuth, async (req, res) => {
    await revokeAllSessions(userId(req), await currentFamily(req));
    res.status(204).send();
  });

  // ---------- Autenticação em dois passos ----------
  app.post('/api/user/2fa/setup', requireAuth, async (req, res) => {
    const user = await storage.getUserWithPassword(userId(req));
    if (!user) throw new HttpError(401, 'Token inválido');
    if (user.totpEnabled) throw new HttpError(409, 'A autenticação em dois passos já está ativa.');
    const secret = generateTotpSecret();
    await storage.setUserFields(user.id, { totpSecret: secret, totpEnabled: false });
    const url = otpauthUrl(secret, user.email ?? user.id, BRAND.name);
    res.json({ secret, otpauthUrl: url, qrSvg: await QRCode.toString(url, { type: 'svg', margin: 1, width: 200 }) });
  });

  app.post('/api/user/2fa/enable', requireAuth, passwordLimiter, async (req, res) => {
    const { code } = z.object({ code: z.string().min(6).max(10) }).parse(req.body);
    const user = await storage.getUserWithPassword(userId(req));
    if (!user?.totpSecret || !verifyTotp(user.totpSecret, code)) throw new HttpError(400, 'Código inválido. Confirme a hora do telemóvel e tente de novo.');
    await storage.setUserFields(user.id, { totpEnabled: true });
    await revokeAllSessions(user.id, await currentFamily(req));
    res.status(204).send();
  });

  app.post('/api/user/2fa/disable', requireAuth, passwordLimiter, async (req, res) => {
    const { password: pass, code } = z.object({ password: z.string().min(1), code: z.string().min(6).max(10) }).parse(req.body);
    const user = await storage.getUserWithPassword(userId(req));
    if (!user?.password || !(await bcrypt.compare(pass, user.password))) throw new HttpError(401, 'A palavra-passe está errada.');
    if (!user.totpSecret || !verifyTotp(user.totpSecret, code)) throw new HttpError(400, 'Código inválido.');
    await storage.setUserFields(user.id, { totpEnabled: false, totpSecret: null });
    res.status(204).send();
  });

  // ---------- Preferências ----------
  app.get('/api/user/preferences', requireAuth, async (req, res) => {
    const prefs = (await storage.getPreferences(userId(req))) as Record<string, any> | undefined;
    res.json({
      ...DEFAULT_PREFERENCES,
      ...(prefs ?? {}),
      notificationPreferences: { ...DEFAULT_NOTIFICATION_PREFS, ...(prefs?.notificationPreferences ?? {}) },
    });
  });

  app.post('/api/user/preferences', requireAuth, async (req, res) => {
    const prefs = preferencesSchema.parse(req.body);
    await storage.setPreferences(userId(req), prefs);
    if (prefs.notificationPreferences) await storage.trackEvent(userId(req), 'reminders_configured');
    res.json({ success: true });
  });

  // Avatar SVG com iniciais: /api/placeholder/96/96?initials=RS
  app.get('/api/placeholder/:width/:height', (req, res) => {
    const size = (v: string) => Math.min(512, Math.max(16, Number(v) || 96));
    const width = size(req.params.width);
    const height = size(req.params.height);
    const raw = typeof req.query.initials === 'string' ? req.query.initials : '';
    const text = raw.replace(/[^\p{L}\p{N}]/gu, '').slice(0, 2).toUpperCase() || 'U';
    const fontSize = Math.floor(Math.min(width, height) / 2.6);
    res.type('image/svg+xml').set('Cache-Control', 'public, max-age=86400').send(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
      `<rect width="100%" height="100%" fill="#E5E7EB"/>` +
      `<text x="50%" y="50%" dy=".35em" text-anchor="middle" fill="#6B7280" font-family="system-ui, sans-serif" font-size="${fontSize}">${text}</text></svg>`,
    );
  });
}
