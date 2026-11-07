// Middlewares partilhados pelas rotas: autenticação, verificação de dono, uploads e erros.
import type { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import { ZodError } from 'zod';
import { verifyJwt, type JwtPayload } from './jwtUtils';
import { storage } from './storage';
import { isDuplicateKeyError } from './db';
import rateLimit from 'express-rate-limit';
import { OWN_VEHICLE_PHOTO, type Vehicle } from '@shared/schema';

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
      vehicle?: Vehicle;
    }
  }
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Utilizador autenticado (usar só depois de requireAuth). */
export const userId = (req: Request) => req.user!.sub;

export function tokenFromHeader(req: Request): JwtPayload | null {
  const header = req.headers.authorization;
  return header?.startsWith('Bearer ') ? verifyJwt(header.slice(7)) : null;
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.headers.authorization?.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Token não fornecido' });
  }
  const payload = tokenFromHeader(req);
  if (!payload) {
    return res.status(401).json({ success: false, message: 'Token inválido' });
  }
  req.user = payload;
  next();
}

/** Carrega o veículo de :id ou :vehicleId e garante que pertence ao utilizador. */
export async function requireVehicle(req: Request, res: Response, next: NextFunction) {
  const vehicleId = String(req.params.vehicleId ?? req.params.id);
  const vehicle = await storage.getUserVehicle(userId(req), vehicleId);
  if (!vehicle) return res.status(404).json({ message: 'Veículo não encontrado' });
  req.vehicle = vehicle;
  next();
}

/** Para vehicleId vindo do corpo ou da query. Lança 404 se não for do utilizador. */
export async function ownedVehicle(req: Request, vehicleId: unknown): Promise<Vehicle> {
  const vehicle = typeof vehicleId === 'string' && vehicleId
    ? await storage.getUserVehicle(userId(req), vehicleId)
    : undefined;
  if (!vehicle) throw new HttpError(404, 'Veículo não encontrado');
  return vehicle;
}

// ---------- Uploads ----------
export const UPLOAD_DIR = path.join(process.cwd(), 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// A extensão vem do tipo MIME validado, nunca do nome enviado pelo cliente.
const EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
};

function uploader(allowed: string[], maxMb: number, prefix: (req: Request) => string) {
  return multer({
    storage: multer.diskStorage({
      destination: UPLOAD_DIR,
      // Prefixo com o id do utilizador: é assim que /uploads verifica o dono
      filename: (req, file, cb) => cb(null, `${prefix(req)}-${randomUUID()}${EXTENSIONS[file.mimetype]}`),
    }),
    limits: { fileSize: maxMb * 1024 * 1024, files: 1 },
    fileFilter: (_req, file, cb) => {
      if (allowed.includes(file.mimetype)) cb(null, true);
      else cb(new HttpError(400, `Tipo de ficheiro não permitido. Aceites: ${allowed.map((t) => EXTENSIONS[t]).join(', ')}`));
    },
  });
}

export const uploads = {
  document: uploader(['application/pdf', 'image/jpeg', 'image/png', 'image/webp'], 10, (req) => userId(req)),
  receipt: uploader(['application/pdf', 'image/jpeg', 'image/png'], 10, (req) => userId(req)),
  // Fotos de perfil e de veículos são públicas (prefixos "profile-" e "vehicle-"; o nome é um UUID)
  profile: uploader(['image/jpeg', 'image/png', 'image/webp'], 5, () => 'profile'),
  vehiclePhoto: uploader(['image/jpeg', 'image/png', 'image/webp'], 5, () => 'vehicle'),
};

/** Apaga um ficheiro de uploads/. Só aceita URLs "/uploads/<nome simples>" (sem pastas nem ".."). */
export function removeUpload(fileUrl: string) {
  const match = /^\/uploads\/([A-Za-z0-9._-]+)$/.exec(fileUrl);
  if (!match || match[1].startsWith('.')) return;
  fs.rm(path.join(UPLOAD_DIR, match[1]), { force: true }, () => {});
}

/** Foto própria de veículo (as sugestões externas não são ficheiros nossos). */
export const isOwnVehiclePhoto = (url?: string | null): url is string => !!url && OWN_VEHICLE_PHOTO.test(url);

// ---------- Rate limit ----------
/** Limite de pedidos por IP numa janela (15 min por omissão), com resposta JSON em pt-PT. */
export function limiter(limit: number, what: string, windowMs = 15 * 60 * 1000, options: { skipSuccessfulRequests?: boolean } = {}) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    ...options,
    message: { message: `Demasiadas ${what}. Tente novamente dentro de alguns minutos.` },
  });
}

// ---------- Erros ----------
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    return res.status(400).json({ message: 'Erro de validação', errors: err.issues });
  }
  if (err instanceof HttpError) {
    return res.status(err.status).json({ message: err.message });
  }
  if (err instanceof multer.MulterError) {
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'Ficheiro demasiado grande' : `Upload inválido: ${err.message}`;
    return res.status(400).json({ message });
  }
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ message: 'Pedido demasiado grande' });
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'JSON inválido' });
  }
  // Erros HTTP de bibliotecas (ex.: express.static devolve 404 quando o ficheiro não existe)
  if (typeof err?.status === 'number' && err.status >= 400 && err.status < 500) {
    return res.status(err.status).json({ message: err.status === 404 ? 'Não encontrado' : 'Pedido inválido' });
  }
  if (isDuplicateKeyError(err)) {
    return res.status(409).json({ message: 'Já existe um registo com estes dados.' });
  }
  console.error('Erro não tratado:', err);
  res.status(500).json({ message: 'Erro interno do servidor' });
};
