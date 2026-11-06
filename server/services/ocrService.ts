import fs from 'fs';
import type { NewExpenseRecord } from "@shared/schema";

export type ParsedReceipt = {
  vendor?: string;
  totalAmount?: number;
  date?: Date;
  description?: string;
  rawText: string;
};

/** Datas em formato português (DD/MM/AAAA, DD-MM-AAAA) ou ISO (AAAA-MM-DD). */
export function extractDate(text: string): Date | undefined {
  const build = (y: string, m: string, d: string) => {
    const date = new Date(Date.UTC(+y, +m - 1, +d));
    return date.getUTCMonth() === +m - 1 && date.getUTCDate() === +d ? date : undefined;
  };
  const dmy = text.match(/\b(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})\b/);
  if (dmy) return build(dmy[3], dmy[2], dmy[1]);
  const ymd = text.match(/\b(\d{4})[\/.-](\d{1,2})[\/.-](\d{1,2})\b/);
  if (ymd) return build(ymd[1], ymd[2], ymd[3]);
  return undefined;
}

// Valores como 12,34 | 12.34 | 1.234,56 | 1 234,56
const AMOUNT = /(\d{1,3}(?:[.\s]\d{3})+|\d+)[.,](\d{2})(?!\d)/g;
const toNumber = (m: RegExpMatchArray) => parseFloat(`${m[1].replace(/[.\s]/g, '')}.${m[2]}`);

export function extractTotal(text: string): number | undefined {
  const lines = text.split(/\r?\n/).map(l => l.trim());
  for (const line of lines) {
    if (/total/i.test(line)) {
      const n = [...line.matchAll(AMOUNT)].pop();
      if (n) return toNumber(n);
    }
  }
  // Fallback: último valor monetário do texto
  const last = [...text.matchAll(AMOUNT)].pop();
  return last ? toNumber(last) : undefined;
}

export function extractVendor(text: string): string | undefined {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  // Prefer first non-numeric, non-header line
  for (const line of lines) {
    if (line.length < 2) continue;
    if (/^total|invoice|recibo|receipt|fatura/i.test(line)) continue;
    if (/^[0-9]/.test(line)) continue;
    // Avoid trivial lines
    if (line.replace(/[^A-Za-z]/g, '').length < 3) continue;
    return line.slice(0, 255);
  }
  // Fallback: uppercase word sequences
  const m = text.match(/[A-Z][A-Z \-]{3,}/);
  return m ? m[0].trim().slice(0, 255) : undefined;
}

function buildDescription(vendor?: string, amount?: number, date?: Date): string {
  const parts: string[] = [];
  if (vendor) parts.push(`Recibo: ${vendor}`);
  if (amount !== undefined) parts.push(`Total: ${amount.toFixed(2)}`);
  if (date) parts.push(`Data: ${date.toISOString().split('T')[0]}`);
  return parts.join(' | ');
}

export async function parseImage(filePath: string): Promise<ParsedReceipt> {
  // Import dinâmico: as bibliotecas de OCR são pesadas e só carregam quando são usadas
  const { default: Tesseract } = await import('tesseract.js');
  const result = await Tesseract.recognize(filePath, 'por+eng');
  const text: string = result?.data?.text || '';
  const vendor = extractVendor(text);
  const totalAmount = extractTotal(text);
  const date = extractDate(text);
  return {
    vendor,
    totalAmount,
    date,
    description: buildDescription(vendor, totalAmount, date),
    rawText: text,
  };
}

export async function parsePdf(filePath: string): Promise<ParsedReceipt> {
  const { pdf } = await import('pdf-parse');
  const { text } = await pdf(new Uint8Array(fs.readFileSync(filePath)));
  const vendor = extractVendor(text);
  const totalAmount = extractTotal(text);
  const date = extractDate(text);
  return {
    vendor,
    totalAmount,
    date,
    description: buildDescription(vendor, totalAmount, date),
    rawText: text,
  };
}

export function mapCategory(vendor?: string, text?: string): { type: string; category: string } {
  const content = `${vendor || ''} ${text || ''}`.toLowerCase();
  if (/fuel|gas|posto|combustível|galp|bp|repsol|shell/.test(content)) {
    return { type: 'fuel', category: 'fuel' };
  }
  if (/restaurant|restaurante|cafe|bar|mc ?donald|kfc|burger king|pizza|coffee/.test(content)) {
    return { type: 'meal', category: 'meals' };
  }
  if (/parking|parque|portagem|toll|peaje|estacionamento/.test(content)) {
    return { type: 'parking', category: 'parking' };
  }
  if (/hotel|lodging|alojamento|hospedagem/.test(content)) {
    return { type: 'travel', category: 'accommodation' };
  }
  return { type: 'general', category: 'other' };
}

export function buildExpensePayload(params: {
  vehicleId: string;
  receiptUrl: string;
  parsed: ParsedReceipt;
}): Omit<NewExpenseRecord, 'id'> {
  const { vehicleId, receiptUrl, parsed } = params;
  const { type, category } = mapCategory(parsed.vendor, parsed.rawText);
  const amount = parsed.totalAmount ?? 0;
  const date = parsed.date ?? new Date();
  return {
    vehicleId,
    type,
    category,
    amount: String(amount),
    date,
    description: parsed.description || 'Despesa via OCR',
    receiptUrl,
    vendor: parsed.vendor ?? null,
    mileage: null,
    isBusinessExpense: false,
  };
}