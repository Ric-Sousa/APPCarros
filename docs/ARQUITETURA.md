# Arquitetura

## Visão geral

```
 Browser (React SPA)
   │  lib/apiUtils.ts: Authorization: Bearer <JWT>     Socket.IO (IoT)
   ▼                                                    ▲
 Express 5 (server/index.ts, porta 5000) ───────────────┤
   ├─ cabeçalhos de segurança, CORS (CORS_ORIGINS), JSON ≤ 1 MB
   ├─ /login, /api/*    → server/routes/*.ts
   ├─ /uploads/*        → só o dono (exceto profile-*)
   ├─ dev:  Vite middleware (HMR)  |  prod: dist/public + fallback SPA
   └─ errorHandler      → 400/404/409/413/500 em JSON
        │
        ├─ storage.ts ── Kysely ── MySQL | PostgreSQL | SQL Server | SQLite (DB_CLIENT)
        ├─ services/externalApis.ts ── OpenRouteService, OpenWeather, Nominatim
        ├─ OpenChargeMap, Overpass (OSM)
        ├─ services/vehicleApi.ts ── VEHICLE_API_URL (vehicle_api.php → Chrome headless)
        ├─ services/ocrService.ts ── tesseract.js / pdf-parse (import dinâmico)
        └─ iotGateway.ts ── broker MQTT ─────────────────┘
```

Um único processo Node serve a API, o frontend e o Socket.IO.

## Backend

| Ficheiro | Responsabilidade |
|---|---|
| `server/index.ts` | Valida as variáveis obrigatórias antes de importar o resto. Configura CORS, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, log de pedidos (sem corpos), preparação da base de dados, rotas, 404 JSON para `/api`, Vite ou estáticos, Socket.IO |
| `server/http.ts` | `requireAuth` (JWT), `requireVehicle` (carrega `:id`/`:vehicleId` e valida o dono), `ownedVehicle` (para `vehicleId` no corpo/query), `uploads` (multer com tipos e tamanhos), `HttpError`, `errorHandler` |
| `server/routes/auth.ts` | Login, registo (com rate limit), utilizador, perfil, foto, preferências, avatar SVG |
| `server/routes/vehicles.ts` | Veículos, risco preditivo, comparações, matrícula, especificações, manutenção, marcações, alertas, estatísticas |
| `server/routes/records.ts` | `/uploads`, combustível, despesas (incluindo OCR), viagens, documentos |
| `server/routes/mobility.ts` | Postos EV, reservas, comparação EV, planeador e planos de rota, geocoding, recomendações, IoT |
| `server/db.ts` | Liga ao motor escolhido (`DB_CLIENT`), cria e completa as tabelas a partir de `shared/schema.ts` e converte tipos entre o JavaScript e cada motor |
| `server/storage.ts` | Consultas (Kysely). As que recebem `userId` filtram pelo dono na própria query (`WHERE ... AND vehicle_id IN (veículos do utilizador)`) |
| `server/stats.ts` | Funções puras e testadas: consumo L/100km, média mensal de despesas, risco, recomendações por regras |

O Express 5 encaminha os erros das rotas `async` para o `errorHandler`. Por isso as rotas não têm `try/catch`: um `ZodError` vira 400, um `HttpError` usa o seu estado, e o resto vira 500 com detalhe só no log.

## Segurança

- **Autenticação:** JWT HS256 com `JWT_SECRET` obrigatório, validade de 1h. As passwords usam bcrypt (10 rondas). Contas antigas com password em texto simples são convertidas para hash no primeiro login (enviar o próprio hash não autentica). Login e registo estão limitados a 10 pedidos por IP a cada 15 minutos.
- **Autorização:** cada recurso é verificado contra o utilizador do token. Um recurso de outro utilizador responde `404`, para não revelar que existe.
- **Validação:** esquemas zod em `shared/schema.ts`. O `updateVehicleSchema` ignora `id`/`userId`, e as atualizações parciais não apagam campos ausentes.
- **Respostas:** o hash da password nunca sai do servidor (`toPublicUser`). Os logs não incluem corpos nem headers.
- **Uploads:** tipos permitidos por rota (PDF/JPEG/PNG/WEBP), 5–10 MB, um ficheiro por pedido. O nome é `<userId>-<uuid>.<ext>`, com a extensão derivada do MIME. São servidos com `nosniff` e uma CSP restritiva. O acesso exige o header `Authorization` e ser o dono. Os ficheiros de pedidos falhados são apagados.
- **Socket.IO:** JWT no handshake, CORS restrito, e `subscribe_vehicle` só para veículos do utilizador.

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

2. **Prepara a base de dados no arranque** (`setupDatabase`): cria as tabelas que faltam, acrescenta colunas novas (como opcionais), cria índices nas colunas `*_id` e as restrições únicas, e aplica correções de versões antigas. As alterações são só aditivas.
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
| `alerts` | alertas | `vehicle_id` |
| `fuel_records` | abastecimentos | `vehicle_id` |
| `expense_records` | despesas (com recibo) | `vehicle_id` |
| `documents` | documentos do veículo | `vehicle_id` |
| `mileage_trips` | viagens | `vehicle_id` |
| `route_plans` | planos de rota (JSON) | `user_id`, `vehicle_id` |
| `charging_station_reservations` | reservas de carregamento | `vehicle_id`, `user_id` |
| `trip_records`, `vehicle_specs` | definidas mas ainda sem uso na aplicação | `vehicle_id` |
| `scraped_vehicles` | cache do `vehicle_api.php` | — |

Para alterar o modelo, edite só o `shared/schema.ts`. A cache do `vehicle_api.php` (`scraped_vehicles`) é do servidor PHP e está em `vehicle_api.sql`.

## Build e deploy

- `vite build` → `dist/public` (páginas em chunks separados; o principal tem ~358 kB).
- `esbuild` → `dist/index.js` (ESM, dependências externas; o código de Vite é removido em produção).
- `npm start` → `node dist/index.js`. Ponha um proxy HTTPS à frente. Se o proxy reescrever IPs, configure `app.set('trust proxy', ...)` para o rate limit contar o IP real.
