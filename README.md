# Logicar

**Nunca mais pague multa por IUC ou inspeção em atraso.** Aplicação web (PWA) para gestão de veículos particulares e pequenas frotas: frota pessoal, manutenção, combustível, despesas, documentos, quilometragem, planeamento de rotas, carregamento de veículos elétricos e recomendações. Pensada para Portugal (IUC, inspeção, matrículas PT, pt-PT).

## Funcionalidades

| Área | O que faz | Fonte dos dados |
|---|---|---|
| Conta | Registo com aceitação dos termos, confirmação de email, recuperar palavra-passe, sessão de 30 dias ("manter sessão iniciada") com refresh seguro, 2FA (app autenticadora), sessões por dispositivo, exportar os dados (RGPD) e eliminar a conta | BD + email |
| Primeira utilização | Assistente de 3 passos: matrícula → confirmar dados e prazos → quando avisar | BD |
| Lembretes | Email e push (PWA) a 30/7/1 dias, no dia e depois de vencido; resumo semanal; ações "Feito" e "Lembrar mais tarde"; calendário `.ics` para subscrever | Tarefa diária + SMTP + Web Push |
| Prazos | IUC e inspeção calculados a partir da data da matrícula; validade lida dos documentos (seguro, inspeção) por OCR | Regras legais + OCR |
| Partilha | Convidar condutores (família, empresa) para um veículo | BD + email |
| Planos | Grátis (1 veículo), Premium e Empresas, com pagamentos Stripe | Stripe |
| Relatórios | Livro de revisões para imprimir/PDF; relatório da frota em CSV | BD |
| Veículos | CRUD, consulta de dados por matrícula, foto automática ou à escolha (com o ano certo quando possível), foto própria | BD + serviço de matrículas + Wikimedia Commons + Unsplash |
| Manutenção | Histórico, marcações, alertas automáticos (óleo e pneus por km; inspeção, IUC e seguro por data), risco preditivo | BD |
| Combustível | Abastecimentos (criar/editar/apagar), consumo, postos mais baratos por perto com preços oficiais | BD + DGEG |
| Despesas | Registo manual e OCR de recibos (imagem/PDF) | BD + Tesseract/pdf-parse |
| Documentos | Upload, consulta e remoção (acesso só do dono) | BD + disco ou S3 |
| Quilometragem | Gravação de viagens; atualiza os km do veículo | BD |
| Rotas | Rota, custo, autonomia, paragens sugeridas, planos guardados | OpenRouteService, OpenChargeMap, Overpass |
| Veículos elétricos | Postos de carregamento, reservas, comparação com um VE | OpenChargeMap + valores de referência |
| Comparações | Consumo e despesas vs. veículos iguais e vs. o resto da frota | BD |
| Recomendações | Prazos (óleo, pneus, inspeção, IUC, seguro), meteorologia, poupança de combustível | Regras sobre a BD + OpenWeather + DGEG |
| IoT (experimental, `FEATURE_IOT=true`) | Dados de sensores em tempo real (MQTT → Socket.IO) | MQTT; a lista de dispositivos é de demonstração |

Os dados de referência e de demonstração são marcados na interface ("Valores de referência" / "Dados de demonstração").

## Stack

- **Frontend:** React 19, Vite 7, TypeScript, wouter, TanStack Query, Tailwind CSS + shadcn/ui, react-hook-form + zod, lucide-react, Leaflet (CDN)
- **Backend:** Node.js 22.16+, Express 5, TypeScript (tsx em dev, esbuild em produção), JWT, multer, Socket.IO, MQTT
- **Base de dados:** MySQL/MariaDB, PostgreSQL, SQL Server ou SQLite, à escolha (`DB_CLIENT`). Esquema descrito em Drizzle (`shared/schema.ts`) e consultas com Kysely
- **Serviço auxiliar:** `vehicle_api.php` (PHP + Symfony Panther/Chrome headless) para dados por matrícula

## Instalação

```bash
npm ci
cp .env.example .env        # escolher a base de dados (DB_*) e definir JWT_SECRET
npm run dev                 # http://localhost:5000
```

Em desenvolvimento, o Express serve a API e o Vite (em modo middleware) na mesma porta. Sem configurar nada:
- os emails (confirmação, recuperar palavra-passe, lembretes) ficam como ficheiros `.html` em `data/mail/`;
- as chaves de push são geradas em `data/vapid.json`;
- os planos pagos ativam-se em **Planos → Escolher Premium**, de imediato e sem pagamento;
- `ADMIN_EMAILS=o-seu@email` dá acesso à página de administração (`/admin`).

## Base de dados

Escolhe-se no `.env` com `DB_CLIENT`:

| `DB_CLIENT` | Motor | Ligação | Driver |
|---|---|---|---|
| `mysql` (por omissão) | MySQL 8 / MariaDB | `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | mysql2 |
| `postgres` | PostgreSQL | idem + `DB_SSL` | pg |
| `mssql` | SQL Server 2016+ / Azure SQL | idem + `DB_INSTANCE`, `DB_ENCRYPT`, `DB_TRUST_SERVER_CERTIFICATE` | tedious |
| `sqlite` | SQLite (ficheiro, sem servidor) | `DB_FILE` (por omissão `./data/logicar.db`) | `node:sqlite` nativo do Node |

- **A base de dados tem de existir** (exceto no SQLite). As tabelas, as colunas novas e os índices são criados automaticamente em cada arranque, a partir de `shared/schema.ts`.
- **Atualizar uma instalação MySQL antiga** (criada pelo antigo `sql.sql`): basta arrancar a aplicação. Cria as tabelas `user_preferences` e `route_plans`, passa a matrícula a ser única por utilizador e corrige URLs antigos de documentos.
- **SQL Server:** use um login SQL (o driver não suporta autenticação Windows). Para uma instância com nome, defina `DB_INSTANCE` (precisa do serviço SQL Browser) ou use a porta TCP da instância.
- **Mudar de motor não migra os dados:** começa com uma base de dados vazia.
- **Para acrescentar um campo:** altere `shared/schema.ts`. No arranque seguinte, a coluna é criada em qualquer motor. Mudar o tipo de uma coluna ou apagá-la continua a ser manual.

### Produção

```bash
npm run build               # dist/public (cliente) + dist/index.js (servidor)
npm start                   # node dist/index.js
```

O build não precisa da base de dados. O servidor responde em `GET /api/health` (para monitorização) e termina de forma ordenada com SIGTERM/SIGINT. Em produção, coloque o servidor atrás de HTTPS.

## Variáveis de ambiente

| Variável | Obrigatória | Descrição |
|---|---|---|
| `DB_CLIENT` | Não | `mysql` (por omissão), `postgres`, `mssql` ou `sqlite` |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | Sim, exceto SQLite | Ligação (use um utilizador dedicado, não o `root`/`sa`). `MYSQL_*` continua a funcionar |
| `DB_FILE` | Não | Ficheiro SQLite |
| `DB_SSL` | Não | PostgreSQL com SSL |
| `DB_INSTANCE`, `DB_ENCRYPT`, `DB_TRUST_SERVER_CERTIFICATE` | Não | Opções do SQL Server |
| `JWT_SECRET` | Sim | Segredo dos tokens, com pelo menos 32 caracteres. Sem ele o servidor não arranca |
| `JWT_EXPIRES_IN` | Não | Validade do token de acesso (por omissão `15m`; a sessão é renovada pelo cookie de refresh) |
| `APP_URL` | Em produção | Endereço público (links nos emails, calendário, Stripe). Com `https://` ativa HSTS e cookies `Secure` |
| `ADMIN_EMAILS` | Não | Emails com acesso a `/admin` |
| `SMTP_URL`, `MAIL_FROM`, `SUPPORT_EMAIL` | Em produção | Envio de email. Sem `SMTP_URL`, os emails ficam em `DEV_MAIL_DIR` (`./data/mail`) |
| `NOTIFY_HOUR`, `NOTIFICATIONS_ENABLED` | Não | Hora UTC dos lembretes (9) e interruptor do agendador |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Em produção | Web Push (`npx web-push generate-vapid-keys`) |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PREMIUM`, `STRIPE_PRICE_BUSINESS` | Para cobrar | Pagamentos. Webhook em `APP_URL/api/billing/webhook` |
| `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_PREFIX` | Não | Ficheiros num bucket S3/R2/MinIO em vez de `uploads/` |
| `SENTRY_DSN` | Não | Monitorização de erros |
| `BACKUP_DIR`, `BACKUP_KEEP` | Não | Destino e número de backups de `npm run backup` |
| `FEATURE_IOT` | Não | `true` mostra a área IoT (experimental) |
| `PORT` | Não | Porta HTTP (por omissão `5000`) |
| `CORS_ORIGINS` | Não | Origens permitidas, separadas por vírgulas (a própria app é sempre permitida, mesmo por IP na rede local) |
| `TRUST_PROXY` | Em produção atrás de proxy | Número de proxies (ex.: `1`) ou `true`. Sem isto, o limite de tentativas de login trata todos os clientes como um só |
| `VEHICLE_API_URL` | Não | URL do `vehicle_api.php` (deve ser HTTPS). Sem ele, a consulta de matrícula fica desligada |
| `VEHICLE_API_KEY` | Recomendado | Segredo partilhado com o `vehicle_api.php` (definir o mesmo valor no servidor PHP) |
| `UNSPLASH_ACCESS_KEY` | Não | Fotos do Unsplash nas sugestões (o Wikimedia Commons não precisa de chave) |
| `OPENCHARGEMMAP_API_KEY` | Não | Postos de carregamento EV |
| `OPENROUTESERVICE_API_KEY` | Não | Rotas e geocoding (sem chave: linha reta e Nominatim) |
| `OPENWEATHER_API_KEY` | Não | Meteorologia nas recomendações |
| `DEFAULT_LOCATION` | Não | Localização por omissão (por omissão `Lisboa`) |
| `MQTT_URL`, `MQTT_USER`, `MQTT_PASS` | Não | Broker MQTT para IoT |

O cliente aceita `VITE_SOCKET_URL` se o Socket.IO estiver noutra origem.

## Scripts

| Script | Descrição |
|---|---|
| `npm run dev` | Servidor de desenvolvimento (API + Vite) |
| `npm run build` | Build do cliente e do servidor |
| `npm start` | Arranca o build de produção |
| `npm run check` | Type-check (`tsc`) |
| `npm test` | Testes (`server/*.test.ts`). A integração usa SQLite em memória; com `DB_CLIENT`/`DB_*` definidos, corre noutro motor (use uma base de dados de teste vazia) |
| `npm run test:e2e` | Testes no browser (Playwright, `e2e/`), com a app em SQLite em memória. Sem o Chromium do Playwright: `PW_CHANNEL=msedge` |
| `npm run backup` | Backup da base de dados (SQLite) e de `uploads/`, com rotação |

## Estrutura

```
client/src/
  pages/              Uma página por rota (carregadas sob pedido)
  components/         Componentes de funcionalidades
  components/ui/      Componentes shadcn/ui usados
  hooks/              useAuth, useVehicles, useIoT, useVehicleSpecs, ...
  lib/apiUtils.ts     Único caminho para pedidos autenticados (token, 401, erros)
  lib/fuelForm.ts     Esquema e hooks partilhados de combustível
server/
  index.ts            Arranque: validação do ambiente, CORS, cabeçalhos, base de dados, rotas, Vite/estáticos, Socket.IO
  http.ts             Middlewares: requireAuth, requireVehicle (dono), uploads, tratamento de erros
  routes.ts           Regista os módulos de rotas
  routes/             auth, vehicles, records, mobility, account (config/push/calendário/feedback/admin), billing (Stripe)
  session.ts          Refresh tokens rotativos e tokens de uso único
  notifications.ts    Lembretes por email e push (tarefa diária)
  migrations.ts       Migrações de dados versionadas
  db.ts               Ligação ao motor escolhido, criação das tabelas, conversão de tipos
  storage.ts          Acesso a dados (Kysely); as consultas filtram pelo dono
  stats.ts            Cálculos puros: consumo, despesas, risco, recomendações
  iotGateway.ts       MQTT -> Socket.IO (com verificação de dono)
  services/           APIs externas, OCR, specs, fotos (Commons/Unsplash), matrículas
  *.test.ts           Testes
shared/schema.ts        Esquema (única fonte das tabelas) + esquemas zod partilhados
shared/plans.ts, deadlines.ts, brand.ts   Planos, regras de IUC/inspeção, marca
client/public/          PWA: manifesto, ícones, service worker, página offline
e2e/                    Testes Playwright
scripts/backup.ts       Backups
.github/                CI (tipos, testes em 4 motores, build, e2e) e Dependabot
docs/legal/             Modelos de documentos RGPD
vehicle_api.php         Scraper PHP de dados por matrícula (alojado à parte)
vehicle_api.sql         Tabela de cache do scraper (MySQL do servidor PHP)
uploads/                Ficheiros enviados
```

## Documentação

- [docs/ARQUITETURA.md](docs/ARQUITETURA.md): arquitetura, segurança, fluxos e modelo de dados
- [docs/API.md](docs/API.md): referência de todos os endpoints
- [docs/AVALIACAO.md](docs/AVALIACAO.md): avaliação do projeto e estado das correções
- [docs/PRONTIDAO-COMERCIAL.md](docs/PRONTIDAO-COMERCIAL.md): estado da prontidão comercial e **o que falta fora do código** (AT, jurista, contas de produção, ...)
- [docs/legal/REGISTO-TRATAMENTOS.md](docs/legal/REGISTO-TRATAMENTOS.md): registo das atividades de tratamento (RGPD, modelo)
