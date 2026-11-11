# Arquitetura

## Visão geral

```
 Browser (React SPA / PWA: manifest + sw.js com push)
   │  lib/apiUtils.ts: Bearer <JWT 15 min em memória>   cookie httpOnly logicar_rt (refresh)
   ▼                                                    Socket.IO (IoT, opcional)
 Express 5 (server/index.ts, porta 5000)
   ├─ cabeçalhos de segurança (+ HSTS com APP_URL https), CORS, JSON ≤ 1 MB
   ├─ /api/billing/webhook (corpo raw, antes do JSON) → Stripe
   ├─ /login, /api/*    → server/routes/*.ts
   ├─ /uploads/*        → só o dono (exceto profile-*/vehicle-*); disco ou S3
   ├─ dev:  Vite middleware (HMR)  |  prod: dist/public + fallback SPA
   └─ errorHandler      → 400/402/403/404/409/413/500 em JSON (+ Sentry)
        │
        ├─ storage.ts ── Kysely ── MySQL | PostgreSQL | SQL Server | SQLite (DB_CLIENT)
        ├─ migrations.ts ── migrações de dados versionadas (schema_migrations)
        ├─ notifications.ts ── tarefa diária → services/mailer.ts (SMTP) + services/push.ts (Web Push)
        ├─ services/fuelPrices.ts ── DGEG (preços oficiais, cache 6 h)
        ├─ services/externalApis.ts ── OpenRouteService, OpenWeather, Nominatim
        ├─ OpenChargeMap, Overpass (OSM)
        ├─ services/vehicleApi.ts ── VEHICLE_API_URL (vehicle_api.php → Chrome headless)
        ├─ services/ocrService.ts ── tesseract.js / pdf-parse (import dinâmico)
        ├─ files.ts ── S3 / compatível (opcional)
        └─ iotGateway.ts ── broker MQTT (só com FEATURE_IOT)
```

Um único processo Node serve a API, o frontend, a tarefa de lembretes e o Socket.IO.

## Backend

| Ficheiro | Responsabilidade |
|---|---|
| `server/index.ts` | Valida as variáveis obrigatórias antes de importar o resto. Configura CORS, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, log de pedidos (sem corpos), preparação da base de dados, rotas, 404 JSON para `/api`, Vite ou estáticos, Socket.IO |
| `server/http.ts` | `requireAuth` (JWT), `requireVehicle` (carrega `:id`/`:vehicleId` e valida o dono), `ownedVehicle` (para `vehicleId` no corpo/query), `uploads` (multer com tipos e tamanhos), `HttpError`, `errorHandler` |
| `server/routes/auth.ts` | Login (com 2FA), refresh/logout, registo, verificação de email, recuperar palavra-passe, perfil, foto, sessões, 2FA, exportação RGPD, eliminação de conta, preferências |
| `server/routes/vehicles.ts` | Veículos (limite do plano, prazos sugeridos), comparações, matrícula, manutenção, marcações, alertas (adiar/feito), partilha e convites, livro de revisões, CSV da frota |
| `server/routes/records.ts` | `/uploads`, combustível, despesas (incluindo OCR), viagens, documentos (com a validade lida por OCR) |
| `server/routes/mobility.ts` | Postos EV, reservas, comparação EV, planeador e planos de rota, geocoding, recomendações, preços DGEG, IoT (só com `FEATURE_IOT`) |
| `server/routes/account.ts` | `/api/config`, subscrições push, emails de teste, cancelar lembretes, calendário `.ics`, feedback, erros do cliente, administração |
| `server/routes/billing.ts` | Stripe (checkout, portal, webhook) e ativação de planos em desenvolvimento |
| `server/session.ts` | Refresh tokens rotativos (famílias, deteção de reutilização), sessões por dispositivo, tokens de uso único em hash |
| `server/totp.ts` | TOTP (RFC 6238) para a autenticação em dois passos |
| `server/notifications.ts` | Lembretes: em que etapa está cada prazo, envio por email/push sem repetir, resumo semanal, agendador |
| `server/migrations.ts` | Migrações de dados numeradas, cada uma numa transação, registadas em `schema_migrations` |
| `server/files.ts`, `server/monitoring.ts` | S3 opcional para os ficheiros; Sentry opcional |
| `shared/plans.ts`, `shared/deadlines.ts`, `shared/brand.ts` | Planos e limites; regras de IUC e inspeção; nome e contactos da marca (usados no cliente e no servidor) |
| `server/db.ts` | Liga ao motor escolhido (`DB_CLIENT`), cria e completa as tabelas a partir de `shared/schema.ts` e converte tipos entre o JavaScript e cada motor |
| `server/storage.ts` | Consultas (Kysely). As que recebem `userId` filtram pelo dono na própria query (`WHERE ... AND vehicle_id IN (veículos do utilizador)`) |
| `server/stats.ts` | Funções puras e testadas: consumo L/100km, média mensal de despesas, risco, recomendações por regras |

O Express 5 encaminha os erros das rotas `async` para o `errorHandler`. Por isso as rotas não têm `try/catch`: um `ZodError` vira 400, um `HttpError` usa o seu estado, e o resto vira 500 com detalhe só no log.

## Segurança

- **Autenticação:**
  - Token de acesso JWT HS256 (`JWT_SECRET` obrigatório, ≥32 caracteres) com 15 min, guardado só em memória no browser (fora do alcance de XSS persistente).
  - Refresh token aleatório num cookie `httpOnly` + `SameSite=Strict` (+ `Secure` em https), guardado em hash, rodado em cada uso. Reutilizar um refresh já rodado revoga a família inteira (sinal de roubo). "Manter sessão iniciada": 30 dias; sem: 24 h.
  - Mudar ou repor a palavra-passe e ativar a 2FA terminam as outras sessões. O utilizador vê e termina as sessões por dispositivo.
  - 2FA opcional por TOTP (qualquer app autenticadora). O login devolve um desafio de 5 min; o JWT de propósito único não serve como token de acesso.
  - Tokens de email (confirmar email 48 h, repor palavra-passe 1 h) de uso único e guardados em hash. "Esqueci-me" responde sempre igual.
  - As passwords usam bcrypt (10 rondas), mínimo 8 caracteres. Contas antigas com password em texto simples são convertidas para hash no primeiro login (enviar o próprio hash não autentica).
  - O login demora o mesmo quer o email exista quer não.
  - Há rotas para alterar a palavra-passe e para eliminar a conta (pedem a palavra-passe).
- **Autorização:** cada recurso é verificado contra o utilizador do token. Um recurso de outro utilizador responde `404`, para não revelar que existe. Um veículo partilhado é acessível ao dono e aos membros ativos (`userVehicleIds`); apagar, mudar a foto e gerir a partilha são só do dono (`requireOwner`, 403).
- **Planos:** os limites são aplicados no servidor (`requireFeature`, limite de veículos) com `402 PLAN_LIMIT`; o cliente só mostra o convite para mudar de plano.
- **Validação:** esquemas zod em `shared/schema.ts`.
  - Números e datas são validados, e o combustível é normalizado (`shared/fuel.ts`).
  - `id`, `userId`, `createdAt` e `receiptUrl` nunca vêm do cliente.
  - `imageUrl` só aceita fotos próprias (`/uploads/vehicle-<uuid>`) ou `https://`.
  - As atualizações parciais não apagam campos ausentes.
- **Rate limit** (`limiter` em `http.ts`, resposta 429 em JSON), contado por IP (configurar `TRUST_PROXY` atrás de um proxy):
  - login: 10 falhas / 15 min;
  - registo: 10 / hora;
  - matrículas: 20;
  - fotos: 30;
  - OCR: 20;
  - rotas, geocoding e postos: 60 / 15 min.
  - O Nominatim é chamado no máximo 1 vez por segundo.
- **Respostas:** o hash da password, o segredo 2FA e o token do calendário nunca saem do servidor (`toPublicUser`). Os logs não incluem corpos nem headers.
- **Uploads:** tipos permitidos por rota (PDF/JPEG/PNG/WEBP), 5–10 MB, um ficheiro por pedido. O nome é `<userId>-<uuid>.<ext>`, com a extensão derivada do MIME. São servidos com `nosniff` e uma CSP restritiva. O acesso exige o header `Authorization` e ser o dono. Os ficheiros de pedidos falhados são apagados.
- **Socket.IO:** JWT no handshake, a ligação termina quando o token expira, as origens são as mesmas da API, e `subscribe_vehicle` só funciona com veículos do utilizador.
- **Ficheiros apagados:** ao apagar um veículo ou a conta, e ao trocar de foto (a foto própria só é apagada se nenhum veículo a usar).
- **Serviço PHP de matrículas:** segredo partilhado (`X-Api-Key`), rate limit por IP, sem CORS, e registo fora da pasta pública com as matrículas mascaradas.
- **Datas:** o servidor corre com `TZ=UTC`, por isso todos os motores guardam e devolvem as datas da mesma forma.

## Frontend

- **Entrada:** `main.tsx` (QueryClientProvider) → `App.tsx` (rotas wouter com `React.lazy`). Todas as rotas exceto `/`, `/login` e `/register` passam pelo `Protected`, que redireciona para `/login`.
- **Pedidos:** só por `lib/apiUtils.ts` (`get/post/put/patch/del`, FormData suportado). Em `401` apaga o token e redireciona para `/login`. Os erros trazem a mensagem do servidor (`ApiError`). A `queryFn` por omissão do React Query usa o mesmo caminho.
- **Logout:** apaga o token e limpa a cache do React Query.
- **Dados de demonstração:** quando a resposta tem `demo: true`, a interface mostra um badge.
- **Acessibilidade:** `lang="pt-PT"`, navegação com links (`aria-current`), `aria-label` nos botões só com ícone, zoom permitido.

## Fluxos principais

- **Dados por matrícula:** `GET /api/vehicle-data/:plate` (autenticado, limitado a 20 pedidos / 15 min) → `VEHICLE_API_URL` → `vehicle_api.php` abre o Chrome headless em infomatricula.pt e guarda o resultado em cache na tabela `scraped_vehicles`.
- **OCR:** o recibo é guardado → Tesseract (`por+eng`) ou pdf-parse → extração de fornecedor, total (aceita `1.234,56`) e data (DD/MM/AAAA) → cria a despesa.
- **Viagens:** `POST` inicia a viagem e `PUT` termina-a. Se `endMileage` for maior que os km atuais, os km do veículo são atualizados.
- **IoT:** os tópicos `vehicle/{id}/sensor/{nome}` e `vehicle/{id}/device/{nome}` são reemitidos para a sala `vehicle_{id}` como `iot:sensor` / `iot:device`.
- **Lembretes:** a cada 10 min o agendador verifica se já passou a `NOTIFY_HOUR` de hoje; se sim, para cada utilizador com veículos sincroniza os alertas, calcula a etapa de cada prazo (`d30`, `d7`, `d1`, `today`, `overdue`; óleo/pneus por prioridade) e reserva o envio em `notification_log` com um id determinístico (`alerta:etapa:canal`) antes de enviar. Assim, várias instâncias ou um reinício nunca enviam o mesmo lembrete duas vezes. Se o envio falhar, a reserva é libertada para a próxima volta.
- **Prazos sugeridos:** `shared/deadlines.ts`. IUC: último dia do mês da matrícula. Inspeção: ligeiros aos 4 anos, depois de 2 em 2 até aos 8 e depois anual; comerciais aos 2 anos e depois anual; pesados anual; motociclos sem sugestão. O mesmo código corre no cliente (dicas no formulário) e no servidor (criar veículo, "Feito" nos alertas).
- **Preços de combustível:** a DGEG não pesquisa por localização, por isso o servidor descarrega a lista nacional de cada combustível (cache 6 h), ordena por distância (haversine) e devolve os mais baratos no raio, com a data de cada preço e a atribuição.
- **Pagamentos:** o Stripe Checkout cria a subscrição; o webhook (assinado) atualiza `plan`/`planExpiresAt`. O plano efetivo (`effectivePlan`) passa a Grátis quando expira. Faturação certificada pela AT: pendente (ver `PRONTIDAO-COMERCIAL.md`).
- **Comparações:** o consumo é calculado a partir dos abastecimentos (o primeiro só marca o ponto de partida) e as despesas são a média mensal dos últimos 12 meses. A comparação usa veículos da mesma marca e modelo de todos os utilizadores, mas só devolve médias.

## Camada de dados (vários motores)

`shared/schema.ts` descreve as tabelas uma única vez (com tabelas Drizzle, que também geram os tipos TypeScript e as validações zod usadas pelo cliente). A partir dessa descrição, `server/db.ts`:

1. **Liga ao motor escolhido** por `DB_CLIENT`. Os drivers são carregados só quando são usados:

   | `DB_CLIENT` | Driver |
   |---|---|
   | `mysql` | mysql2 |
   | `postgres` | pg |
   | `mssql` | tedious + tarn |
   | `sqlite` | `node:sqlite` |

2. **Prepara a base de dados no arranque** (`setupDatabase`): cria as tabelas que faltam, acrescenta colunas novas (como opcionais), cria índices nas colunas `*_id` e as restrições únicas, e aplica correções de versões antigas. As alterações de estrutura são só aditivas; mudanças de dados vão para `server/migrations.ts` (numeradas, uma transação cada, registadas em `schema_migrations`, aplicadas uma só vez).
3. **Traduz os tipos para cada motor:**

   | Esquema | MySQL | PostgreSQL | SQL Server | SQLite |
   |---|---|---|---|---|
   | varchar(n) | varchar(n) | varchar(n) | nvarchar(n) | varchar(n) |
   | text | text | text | nvarchar(max) | text |
   | boolean | boolean | boolean | bit | integer 0/1 |
   | datetime/timestamp | datetime | timestamp | datetime2 | text ISO 8601 |
   | decimal(p,s) | decimal | decimal | decimal | decimal |
   | json | json | jsonb | nvarchar(max) | text |

4. **Normaliza os valores** (`toRow`/`fromRow`): booleanos, datas, decimais (como texto) e JSON chegam à aplicação iguais em qualquer motor. Os valores por omissão (`created_at`, `status`, ...) são preenchidos pela aplicação e não pela base de dados.

Não há chaves estrangeiras, para que o comportamento seja igual em todos os motores (o SQL Server rejeita alguns caminhos de `ON DELETE CASCADE`). Apagar um veículo apaga os seus dados numa transação (`storage.deleteVehicle`). As consultas usam o Kysely, que gera o SQL do dialeto certo. Por isso não há SQL escrito à mão, exceto uma correção antiga só para MySQL.

**Testado:** a bateria de integração (`server/routes.test.ts`) passou em SQLite, SQL Server 2022 e PostgreSQL (PGlite). O MySQL não foi testado nesta máquina, por falta de servidor.

## Modelo de dados

| Tabela | Conteúdo | Ligação |
|---|---|---|
| `users` | email, password (bcrypt), nome, telefone, morada, bio, foto | — |
| `user_preferences` | preferências (JSON) | `user_id` |
| `vehicles` | matrícula (única por utilizador), marca, modelo, ano, combustível, km, dados da matrícula, óleo/pneus, datas de inspeção/IUC/seguro | `user_id` |
| `maintenance_records` | manutenções realizadas | `vehicle_id` |
| `maintenance_appointments` | marcações | `vehicle_id`, `user_id` |
| `alerts` | alertas gerados a partir dos prazos do veículo (`storage.syncAlerts`, id estável por prazo, estado lido/descartado guardado) | `vehicle_id` |
| `fuel_records` | abastecimentos | `vehicle_id` |
| `expense_records` | despesas (com recibo) | `vehicle_id` |
| `documents` | documentos do veículo | `vehicle_id` |
| `mileage_trips` | viagens | `vehicle_id` |
| `route_plans` | planos de rota (JSON) | `user_id`, `vehicle_id` |
| `charging_station_reservations` | reservas de carregamento | `vehicle_id`, `user_id` |
| `scraped_vehicles` | cache do `vehicle_api.php` | — |
| `refresh_tokens` | sessões por dispositivo (hash do refresh, família, validade, revogação) | `user_id` |
| `user_tokens` | tokens de uso único (confirmar email, repor palavra-passe), em hash | `user_id` |
| `push_subscriptions` | subscrições Web Push dos browsers | `user_id` |
| `notification_log` | lembretes enviados (um por prazo, etapa e canal) | `user_id`, `alert_id` |
| `vehicle_members` | convites e membros de veículos partilhados (papel, estado, hash do convite) | `vehicle_id`, `user_id` |
| `feedback` | mensagens enviadas pela app | `user_id` |
| `product_events` | eventos de produto para as métricas (registo, veículo criado, lembretes ativos, …), sem dados pessoais | `user_id` |
| `schema_migrations` | migrações de dados já aplicadas | — |

Em `users` há também: `email_verified_at`, `terms_accepted_at`, `onboarded_at`, `plan`/`plan_expires_at`/`stripe_customer_id`, `totp_secret`/`totp_enabled`, `calendar_token`. Em `alerts`, `snoozed_until`.

Para alterar o modelo, edite só o `shared/schema.ts`. A cache do `vehicle_api.php` (`scraped_vehicles`) é do servidor PHP e está em `vehicle_api.sql`.

## Build e deploy

- `vite build` → `dist/public` (páginas em chunks separados; o principal tem ~358 kB).
- `esbuild` → `dist/index.js` (ESM, dependências externas; o código de Vite é removido em produção).
- `npm start` → `node dist/index.js`. Ponha um proxy HTTPS à frente e defina `TRUST_PROXY` (ex.: `1`) para o rate limit contar o IP real. `GET /api/health` serve para monitorização. O servidor termina de forma ordenada com SIGTERM.
- **CI** (`.github/workflows/ci.yml`): tipos, testes em SQLite, `npm audit`, build; testes de integração contra MySQL 8.4, PostgreSQL 16 e SQL Server 2022 em contentores; testes ponta a ponta (Playwright, `e2e/`). Dependabot semanal.
- **Backups:** `npm run backup` (SQLite: cópia consistente com `VACUUM INTO`; outros motores: mostra o comando nativo) e cópia de `uploads/`. Agendar no servidor.
