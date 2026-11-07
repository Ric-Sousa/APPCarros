import type { Express } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { storage } from '../storage';
import { signJwt } from '../jwtUtils';
import { requireAuth, uploads, userId, HttpError, limiter, removeUpload, isOwnVehiclePhoto } from '../http';

// Login: só contam as tentativas falhadas (quem entra bem não fica bloqueado)
const loginLimiter = limiter(10, 'tentativas de login', 15 * 60 * 1000, { skipSuccessfulRequests: true });
const registerLimiter = limiter(10, 'tentativas de registo', 60 * 60 * 1000);
const passwordLimiter = limiter(10, 'tentativas', 15 * 60 * 1000, { skipSuccessfulRequests: true });

// Hash de referência: quando o email não existe compara-se na mesma, para o tempo de resposta não revelar quem está registado
const DUMMY_HASH = bcrypt.hashSync('logicar-dummy-password', 10);

const password = z.string().min(6, 'A palavra-passe deve ter pelo menos 6 caracteres').max(200);

const email = z.string().trim().toLowerCase().pipe(z.email('Email inválido'));

const registerSchema = z.object({
  name: z.string().trim().min(1, 'Nome obrigatório').max(200),
  email,
  password,
});

const profileSchema = z.object({
  firstName: z.string().trim().max(100).nullable().optional(),
  lastName: z.string().trim().max(100).nullable().optional(),
  email,
  phone: z.string().trim().max(20).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  bio: z.string().max(2000).nullable().optional(),
});

const DEFAULT_PREFERENCES = {
  theme: 'auto',
  language: 'pt',
  notificationPreferences: { maintenance: true, fuel: true, expenses: false, recommendations: true },
};

const isBcryptHash = (value: string) => /^\$2[aby]\$/.test(value);

export function registerAuthRoutes(app: Express) {
  app.post('/login', loginLimiter, async (req, res) => {
    const { email: rawEmail, password } = req.body ?? {};
    if (typeof rawEmail !== 'string' || typeof password !== 'string' || !rawEmail || !password) {
      return res.status(400).json({ message: 'Email e palavra-passe obrigatórios.' });
    }

    const user = await storage.getUserByEmail(rawEmail.trim().toLowerCase());
    let valid = false;
    if (!user?.password) {
      await bcrypt.compare(password, DUMMY_HASH);
    } else {
      if (isBcryptHash(user.password)) {
        valid = await bcrypt.compare(password, user.password);
      } else if (password === user.password) {
        // Conta antiga com palavra-passe em texto simples: converte para hash no primeiro login.
        // Só se aplica a valores que não são hash, por isso enviar o próprio hash não autentica.
        valid = true;
        await storage.updateUserPassword(user.id, await bcrypt.hash(password, 10));
      }
    }
    if (!user || !valid) {
      return res.status(401).json({ message: 'Credenciais inválidas.' });
    }

    res.json({ token: signJwt(user), user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName } });
  });

  app.post('/api/register', registerLimiter, async (req, res) => {
    const { name, email, password } = registerSchema.parse(req.body);
    if (await storage.getUserByEmail(email)) {
      return res.status(409).json({ message: 'Este email já está registado.' });
    }
    const [firstName, ...rest] = name.split(/\s+/);
    const user = await storage.createUser({
      email,
      password: await bcrypt.hash(password, 10),
      firstName,
      lastName: rest.join(' '),
    });
    res.status(201).json({
      token: signJwt(user),
      user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName },
      message: 'Conta criada com sucesso!',
    });
  });

  app.get('/api/auth/user', requireAuth, async (req, res) => {
    const user = await storage.getUser(userId(req));
    if (!user) return res.status(401).json({ message: 'Token inválido' });
    res.json(user);
  });

  app.put('/api/user/profile', requireAuth, async (req, res) => {
    const data = profileSchema.parse(req.body);
    const existing = await storage.getUserByEmail(data.email);
    if (existing && existing.id !== userId(req)) {
      throw new HttpError(409, 'Este email já está a ser usado por outra conta.');
    }
    res.json(await storage.updateUserProfile(userId(req), {
      firstName: data.firstName ?? null,
      lastName: data.lastName ?? null,
      email: data.email,
      phone: data.phone ?? null,
      address: data.address ?? null,
      bio: data.bio ?? null,
    }));
  });

  app.post('/api/user/profile-image', requireAuth, uploads.profile.single('profileImage'), async (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'Nenhum ficheiro enviado' });
    const profileImageUrl = `/uploads/${req.file.filename}`;
    const previous = (await storage.getUser(userId(req)))?.profileImageUrl;
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
    res.status(204).send();
  });

  app.get('/api/user/preferences', requireAuth, async (req, res) => {
    res.json((await storage.getPreferences(userId(req))) ?? DEFAULT_PREFERENCES);
  });

  app.post('/api/user/preferences', requireAuth, async (req, res) => {
    const prefs = z.record(z.string(), z.unknown()).parse(req.body);
    await storage.setPreferences(userId(req), prefs);
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
