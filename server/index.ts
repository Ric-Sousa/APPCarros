import 'dotenv/config';

// Todas as datas em UTC, em todos os motores de BD (mysql2 e pg usam a hora local do processo)
process.env.TZ = 'UTC';

// Validar o ambiente antes de carregar o resto (jwtUtils e db leem process.env ao importar)
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error('❌ JWT_SECRET não está definido ou tem menos de 32 caracteres. Veja o .env.example.');
  process.exit(1);
}

const { default: express } = await import('express');
const { default: cors } = await import('cors');
const { default: http } = await import('http');
const { default: path } = await import('path');
const { registerRoutes } = await import('./routes');
const { errorHandler, HttpError } = await import('./http');
const { initIoTGateway } = await import('./iotGateway');
const { setupDatabase, closeDatabase, dbClient } = await import('./db');

const app = express();
app.disable('x-powered-by');
// Atrás de um proxy (nginx, plataforma de alojamento), o IP real vem no X-Forwarded-For.
// Sem isto, o rate limit trata todos os clientes como um só. Valores: true, número de proxies, ou lista de IPs.
const trustProxy = process.env.TRUST_PROXY;
if (trustProxy) app.set('trust proxy', /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy === 'true' ? true : trustProxy);

const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5000,https://www.logicar.pt,https://logicar.pt')
  .split(',').map((o) => o.trim()).filter(Boolean);

/** Origem permitida: sem Origin (curl, apps), na lista CORS_ORIGINS, ou a própria app (ex.: acesso por IP na rede local). */
const isAllowedOrigin = (origin: string | undefined, host: string | undefined) => {
  if (!origin || allowedOrigins.includes(origin)) return true;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
};

app.use(cors((req, callback) => {
  if (!isAllowedOrigin(req.headers.origin, req.headers.host)) return callback(new HttpError(403, 'Origem não permitida'));
  callback(null, {
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  });
}));

app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

// Log de pedidos /api (sem corpo: as respostas podem conter tokens e dados pessoais)
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    if (req.path.startsWith('/api') || req.path === '/login') {
      console.log(`${req.method} ${req.path} ${res.statusCode} in ${Date.now() - start}ms`);
    }
  });
  next();
});

try {
  console.log(`🗄️  Base de dados: ${dbClient}`);
  await setupDatabase();
} catch (error) {
  console.error('❌ Erro ao ligar/preparar a base de dados:', error instanceof Error ? error.message : error);
  process.exit(1);
}

registerRoutes(app);
app.use('/api', (_req, res) => { res.status(404).json({ message: 'Rota não encontrada' }); });

const server = http.createServer(app);

if (process.env.NODE_ENV === 'production') {
  const publicDir = path.resolve('dist', 'public');
  app.use(express.static(publicDir));
  // SPA: qualquer rota que não seja /api devolve o index.html
  app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(publicDir, 'index.html')));
} else {
  const { setupVite } = await import('./vite');
  await setupVite(app, server);
}

app.use(errorHandler);

const iot = initIoTGateway({ httpServer: server, isAllowedOrigin });

const port = parseInt(process.env.PORT || '5000', 10);
server.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Servidor a correr na porta ${port}`);
});

// Encerramento ordenado (deploys, Ctrl+C): deixa terminar os pedidos e fecha as ligações
let closing = false;
async function shutdown(signal: string) {
  if (closing) return;
  closing = true;
  console.log(`${signal} recebido: a encerrar...`);
  setTimeout(() => process.exit(1), 10_000).unref();
  iot.mqttClient?.end();
  await new Promise((resolve) => iot.io.close(() => resolve(null)));
  await new Promise((resolve) => server.close(() => resolve(null)));
  await closeDatabase().catch(() => {});
  process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
