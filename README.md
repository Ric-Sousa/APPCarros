# LogiCar (AutoCare)

Aplicação web para gestão de veículos particulares: frota pessoal, manutenção, combustível, despesas, documentos, quilometragem, planeamento de rotas, carregamento de veículos elétricos e recomendações. Pensada para Portugal (IUC, inspeção, matrículas PT, pt-PT).

## Funcionalidades

| Área | O que faz | Fonte dos dados |
|---|---|---|
| Autenticação | Registo, login (JWT), perfil, foto de perfil, preferências | BD |
| Veículos | CRUD, consulta de dados por matrícula, foto automática ou à escolha (com o ano certo quando possível), foto própria | BD + serviço de matrículas + Wikimedia Commons + Unsplash |
| Manutenção | Histórico, marcações, alertas, risco preditivo (óleo/pneus/inspeção) | BD |
| Combustível | Abastecimentos (criar/editar/apagar), consumo, comparador de postos | BD + OpenStreetMap |
| Despesas | Registo manual e OCR de recibos (imagem/PDF) | BD + Tesseract/pdf-parse |
| Documentos | Upload, consulta e remoção (acesso só do dono) | BD + disco |
| Quilometragem | Gravação de viagens; atualiza os km do veículo | BD |
| Rotas | Rota, custo, autonomia, paragens sugeridas, planos guardados | OpenRouteService, OpenChargeMap, Overpass |
| Veículos elétricos | Postos de carregamento, reservas, comparação com um VE | OpenChargeMap + valores de referência |
| Comparações | Consumo e despesas vs. veículos iguais e vs. o resto da frota | BD |
| Recomendações | Prazos (óleo, pneus, inspeção, IUC, seguro), meteorologia, preços | Regras sobre a BD + OpenWeather + valores de referência |
| IoT | Dados de sensores em tempo real (MQTT → Socket.IO) | MQTT; a lista de dispositivos é de demonstração |

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

Em desenvolvimento, o Express serve a API e o Vite (em modo middleware) na mesma porta.

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

O build não precisa da base de dados. Em produção, coloque o servidor atrás de HTTPS.

## Variáveis de ambiente

| Variável | Obrigatória | Descrição |
|---|---|---|
| `DB_CLIENT` | Não | `mysql` (por omissão), `postgres`, `mssql` ou `sqlite` |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | Sim, exceto SQLite | Ligação (use um utilizador dedicado, não o `root`/`sa`). `MYSQL_*` continua a funcionar |
| `DB_FILE` | Não | Ficheiro SQLite |
| `DB_SSL` | Não | PostgreSQL com SSL |
| `DB_INSTANCE`, `DB_ENCRYPT`, `DB_TRUST_SERVER_CERTIFICATE` | Não | Opções do SQL Server |
| `JWT_SECRET` | Sim | Segredo dos tokens. Sem ele o servidor não arranca |
| `JWT_EXPIRES_IN` | Não | Validade do token (por omissão `1h`) |
| `PORT` | Não | Porta HTTP (por omissão `5000`) |
| `CORS_ORIGINS` | Não | Origens permitidas, separadas por vírgulas |
| `VEHICLE_API_URL` | Não | URL do `vehicle_api.php` (deve ser HTTPS) |
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
  routes/             auth, vehicles, records (combustível/despesas/viagens/documentos), mobility (EV/rotas/recomendações/IoT)
  db.ts               Ligação ao motor escolhido, criação das tabelas, conversão de tipos
  storage.ts          Acesso a dados (Kysely); as consultas filtram pelo dono
  stats.ts            Cálculos puros: consumo, despesas, risco, recomendações
  iotGateway.ts       MQTT -> Socket.IO (com verificação de dono)
  services/           APIs externas, OCR, specs, fotos (Commons/Unsplash), matrículas
  *.test.ts           Testes
shared/schema.ts        Esquema (única fonte das tabelas) + esquemas zod partilhados
vehicle_api.php         Scraper PHP de dados por matrícula (alojado à parte)
vehicle_api.sql         Tabela de cache do scraper (MySQL do servidor PHP)
uploads/                Ficheiros enviados
```

## Documentação

- [docs/ARQUITETURA.md](docs/ARQUITETURA.md): arquitetura, segurança, fluxos e modelo de dados
- [docs/API.md](docs/API.md): referência de todos os endpoints
- [docs/AVALIACAO.md](docs/AVALIACAO.md): avaliação do projeto e estado das correções
