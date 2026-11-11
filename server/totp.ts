// Autenticação em dois passos: códigos TOTP de 6 dígitos (RFC 6238), compatíveis com Google Authenticator,
// Microsoft Authenticator, 1Password, etc. Implementado com o crypto do Node (sem dependências).
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buf: Buffer): string {
  let bits = 0, value = 0, out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(s: string): Buffer {
  const clean = s.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0, value = 0;
  const out: number[] = [];
  for (const c of clean) {
    value = (value << 5) | ALPHABET.indexOf(c);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export const generateTotpSecret = () => base32Encode(randomBytes(20));

/** Código para um instante (passos de 30 s). */
export function totpCode(secret: string, time = Date.now(), step = 30): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(time / 1000 / step)));
  const hmac = createHmac('sha1', base32Decode(secret)).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const n = (hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return n.toString().padStart(6, '0');
}

/** Aceita o código atual e o anterior/seguinte (relógios ligeiramente desacertados). */
export function verifyTotp(secret: string, code: string, time = Date.now()): boolean {
  const clean = String(code).replace(/\s/g, '');
  if (!/^\d{6}$/.test(clean)) return false;
  return [-1, 0, 1].some((w) => {
    const expected = Buffer.from(totpCode(secret, time + w * 30_000));
    return timingSafeEqual(expected, Buffer.from(clean));
  });
}

export const otpauthUrl = (secret: string, account: string, issuer: string) =>
  `otpauth://totp/${encodeURIComponent(`${issuer}:${account}`)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
