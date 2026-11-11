// Armazenamento dos ficheiros enviados (documentos, recibos, fotos).
// Sem S3_BUCKET: ficam no disco local (uploads/). Com S3_BUCKET: depois de processados, passam para um
// armazenamento compatível com S3 (AWS S3, Cloudflare R2, Backblaze B2, MinIO), necessário com mais de um servidor.
// O acesso continua a passar pela rota /uploads (verificação do dono), nunca por URLs públicos do bucket.
import fs from 'fs';
import path from 'path';
import type { Response } from 'express';
import type { Readable } from 'stream';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

export const s3Enabled = () => !!process.env.S3_BUCKET;

let client: S3Client | null = null;
const s3 = () => (client ??= new S3Client({
  region: process.env.S3_REGION || 'auto',
  endpoint: process.env.S3_ENDPOINT || undefined,
  forcePathStyle: !!process.env.S3_ENDPOINT,
  credentials: process.env.S3_ACCESS_KEY_ID
    ? { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? '' }
    : undefined,
}));
const key = (name: string) => `${process.env.S3_PREFIX ?? 'uploads/'}${name}`;

/** Depois de processado (OCR, etc.), envia o ficheiro local para o S3 e apaga a cópia local. */
export async function persistUpload(file: { path: string; filename: string; mimetype: string }) {
  if (!s3Enabled()) return;
  await s3().send(new PutObjectCommand({
    Bucket: process.env.S3_BUCKET, Key: key(file.filename), Body: fs.readFileSync(file.path), ContentType: file.mimetype,
  }));
  fs.rm(file.path, { force: true }, () => {});
}

/** Envia o ficheiro do S3 na resposta. Devolve false se não existir. */
export async function streamUpload(name: string, res: Response): Promise<boolean> {
  if (!s3Enabled()) return false;
  try {
    const obj = await s3().send(new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key(path.basename(name)) }));
    res.type(obj.ContentType ?? 'application/octet-stream');
    res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'");
    res.setHeader('X-Content-Type-Options', 'nosniff');
    (obj.Body as Readable).pipe(res);
    return true;
  } catch (error: any) {
    if (error?.name === 'NoSuchKey' || error?.$metadata?.httpStatusCode === 404) return false;
    throw error;
  }
}

export async function deleteRemote(name: string) {
  if (!s3Enabled()) return;
  await s3().send(new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key(name) })).catch((e) => console.error('Erro ao apagar no S3:', e?.message));
}
