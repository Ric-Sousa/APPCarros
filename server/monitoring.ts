// Monitorização de erros: com SENTRY_DSN os erros 500 e as exceções não tratadas vão para o Sentry;
// sem ele ficam só no log. (Conta Sentry e alertas: pendente para produção.)
type SentryLike = { captureException: (e: unknown) => void; flush: (ms?: number) => Promise<boolean> };
let sentry: SentryLike | null = null;

export async function initMonitoring() {
  if (!process.env.SENTRY_DSN) return;
  const Sentry = await import('@sentry/node');
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 0, // sem dados pessoais: o Sentry não envia corpos, cookies nem headers por omissão
  });
  sentry = Sentry;
  console.log('📡 Monitorização de erros ativa (Sentry)');
}

export function reportError(error: unknown) {
  sentry?.captureException(error);
}

export async function flushMonitoring() {
  await sentry?.flush(2000);
}
