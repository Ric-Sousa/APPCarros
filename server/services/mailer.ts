// Envio de email. Com SMTP_URL envia a sério; sem ele (desenvolvimento) guarda cada email em data/mail/
// como .html, para se poder abrir no browser e seguir os links (verificação, recuperação, convites).
import fs from 'fs';
import path from 'path';
import nodemailer, { type Transporter } from 'nodemailer';
import { BRAND } from '@shared/brand';

export interface Mail {
  to: string;
  subject: string;
  /** Parágrafos de texto (o HTML é gerado a partir deles). */
  paragraphs: string[];
  action?: { label: string; url: string };
  /** Linhas pequenas no fim (ex.: link para deixar de receber). */
  footer?: string[];
}

const MAIL_DIR = path.resolve(process.env.DEV_MAIL_DIR || './data/mail');
const FROM = process.env.MAIL_FROM || `${BRAND.name} <nao-responder@logicar.pt>`;

let transport: Transporter | null | undefined;
function getTransport(): Transporter | null {
  if (transport === undefined) transport = process.env.SMTP_URL ? nodemailer.createTransport(process.env.SMTP_URL) : null;
  return transport;
}

export const mailMode = () => (process.env.SMTP_URL ? 'smtp' : 'dev') as 'smtp' | 'dev';

/** URL público da app (links nos emails). */
export const appUrl = (pathname = '/') => new URL(pathname, process.env.APP_URL || `http://localhost:${process.env.PORT || 5000}`).toString();

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export function renderMail(mail: Mail): { html: string; text: string } {
  const p = mail.paragraphs.map((t) => `<p style="margin:0 0 14px;line-height:1.5">${escapeHtml(t)}</p>`).join('');
  const button = mail.action
    ? `<p style="margin:24px 0"><a href="${escapeHtml(mail.action.url)}" style="background:#2563eb;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">${escapeHtml(mail.action.label)}</a></p>
       <p style="margin:0 0 14px;font-size:12px;color:#6b7280">Se o botão não funcionar, copie este endereço: ${escapeHtml(mail.action.url)}</p>`
    : '';
  const footer = (mail.footer ?? []).map((t) => `<p style="margin:4px 0;font-size:12px;color:#6b7280">${escapeHtml(t)}</p>`).join('');
  const html = `<!doctype html><html lang="pt-PT"><head><meta charset="utf-8"><title>${escapeHtml(mail.subject)}</title></head>
<body style="margin:0;background:#f3f4f6;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#111827">
<div style="max-width:560px;margin:0 auto;padding:24px">
<div style="font-size:20px;font-weight:700;margin-bottom:16px;color:#2563eb">${escapeHtml(BRAND.name)}</div>
<div style="background:#fff;border-radius:12px;padding:24px">${p}${button}</div>
<div style="padding:16px 4px">${footer}<p style="margin:4px 0;font-size:12px;color:#6b7280">${escapeHtml(BRAND.name)} · ${escapeHtml(BRAND.supportEmail)}</p></div>
</div></body></html>`;
  const text = [...mail.paragraphs, mail.action ? `${mail.action.label}: ${mail.action.url}` : '', ...(mail.footer ?? [])].filter(Boolean).join('\n\n');
  return { html, text };
}

/** Envia (ou guarda em data/mail em desenvolvimento). Nunca lança: um email falhado não deve partir o pedido. */
export async function sendMail(mail: Mail): Promise<boolean> {
  const { html, text } = renderMail(mail);
  try {
    const t = getTransport();
    if (t) {
      await t.sendMail({ from: FROM, to: mail.to, subject: mail.subject, html, text });
    } else {
      fs.mkdirSync(MAIL_DIR, { recursive: true });
      const file = path.join(MAIL_DIR, `${new Date().toISOString().replace(/[:.]/g, '-')}-${mail.to.replace(/[^a-z0-9@.]/gi, '_')}.html`);
      fs.writeFileSync(file, `<!-- Para: ${escapeHtml(mail.to)} | Assunto: ${escapeHtml(mail.subject)} -->\n${html}`);
      console.log(`✉️  Email (desenvolvimento) para ${mail.to}: "${mail.subject}" → ${file}`);
    }
    return true;
  } catch (error) {
    console.error('Erro ao enviar email:', error instanceof Error ? error.message : error);
    return false;
  }
}
