import 'dotenv/config';

// Validar o ambiente antes de carregar o resto (jwtUtils e db leem process.env ao importar)
if (!process.env.JWT_SECRET) {
  console.error('❌ JWT_SECRET não está definido. Veja o .env.example.');
  process.exit(1);
}

const { default: express } = await import('express');
const { default: cors } = await import('cors');
const { default: http } = await import('http');
const { default: path } = await import('path');
const { registerRoutes } = await import('./routes');
const { errorHandler, HttpError } = await import('./http');
const { initIoTGateway } = await import('./iotGateway');
const { setupDatabase, dbClient } = await import('./db');

const app = express();
app.disable('x-powered-by');

const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5000,https://www.logicar.pt,https://logicar.pt')
  .split(',').map((o) => o.trim()).filter(Boolean);

app.use(cors({
  // Pedidos sem Origin (mesma origem, curl, apps) são permitidos
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new HttpError(403, 'Origem não permitida'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
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

initIoTGateway({ httpServer: server, allowedOrigins });

const port = parseInt(process.env.PORT || '5000', 10);
server.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Servidor a correr na porta ${port}`);
});
