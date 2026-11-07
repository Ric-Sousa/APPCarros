# Avaliação do projeto

Este documento tem duas avaliações: a **2.ª** (atual, por corrigir) e a **1.ª** (já corrigida, mais abaixo).

---

# 2.ª avaliação (2026-11-06, depois das correções e do suporte a vários motores de BD)

## Estado das correções (2026-11-07)

**Todos os pontos abaixo foram corrigidos**, exceto os assinalados em "Pendente".

| Verificação | Resultado |
|---|---|
| `tsc` (incluindo `--noUnusedLocals --noUnusedParameters`) | ✅ 0 erros |
| `npm test` | ✅ 27 testes. Os 18 de integração passam em **SQLite**, **SQL Server 2022** e **PostgreSQL** (PGlite) |
| `npm audit --omit=dev` | ✅ 0 vulnerabilidades (eram 27); `drizzle-orm` 0.45 |
| `npm run build` | ✅ JS principal com 352 kB |
| Navegação automática no Edge | ✅ Sem erros nem avisos em todas as páginas, separadores e botões; sem transbordo a 390 px; sem fundos claros no modo escuro |
| Fluxos no browser | ✅ Alerta de IUC no Dashboard, marcação visível no Dashboard e na página do veículo, exportação CSV, viagem ativa retomada |

**Resumo do que mudou:**
- **Segurança (S1 a S7):**
  - `receiptUrl` só é definido pelo servidor, e `imageUrl` só aceita `/uploads/vehicle-<uuid>` ou `https://`;
  - fotos apagadas só quando nenhum veículo as usa;
  - dependências atualizadas;
  - `TRUST_PROXY` e limitadores separados (no login só contam as falhas);
  - comparação só com 5 ou mais veículos iguais;
  - PHP com segredo partilhado, rate limit, sem CORS e registo fora da pasta pública;
  - `VEHICLE_API_URL` sem valor por omissão (502/503 quando o serviço falha ou não está configurado).
- **Funcionalidades (F1 a F20):**
  - alertas gerados a partir dos prazos;
  - marcações e reservas listadas;
  - consulta de matrícula com os campos traduzidos;
  - códigos de combustível únicos (`shared/fuel.ts`);
  - IoT e postos de carregamento com o formato certo;
  - validação de números e datas;
  - invalidações de cache;
  - "Depósito cheio" e um único cálculo de consumo (`shared/calc.ts`);
  - gravador de km que retoma a viagem e mostra histórico;
  - despesas com portagens/estacionamento, média real, exportação CSV e análise;
  - calculadora EV para veículos a combustão;
  - mensagens de 429;
  - 404 em ficheiros inexistentes e `/api/health`;
  - ficheiros apagados com o veículo ou a conta;
  - documentos abrem no Safari;
  - CORS para a própria app.
- **Conta:**
  - alterar a palavra-passe e eliminar a conta;
  - login com tempo constante;
  - o socket expira com o token;
  - `JWT_SECRET` com pelo menos 32 caracteres.
- **Interface:**
  - telemóvel sem transbordo;
  - modo escuro com tokens do tema;
  - pt-PT em toda a interface (incluindo a página 404);
  - descrições em todos os diálogos e `aria-label` nos botões só com ícone;
  - fim do `alert()`/`prompt()`;
  - seletores sempre controlados;
  - Leaflet carregado só no Planeador.
- **Operação:**
  - `TZ=UTC` em todos os motores;
  - encerramento ordenado;
  - limites nas rotas pesadas;
  - Nominatim a 1 pedido/s;
  - foto automática com tempo máximo de 8 s;
  - código morto removido (esquemas, relações, tabelas `trip_records`/`vehicle_specs`, rotas `/external/*` sem uso, componentes e contexto não usados).
- **Bugs extra encontrados pelos testes:**
  - a cilindrada "599 cm3" era lida como 5993;
  - os helpers de validação colidiam com os construtores de colunas do Drizzle.

**Pendente:**
1. **No servidor PHP:** definir `VEHICLE_API_KEY` (o mesmo valor no `.env` da app) e pôr HTTPS. Até lá, o `.env` local usa o endereço HTTP antigo e aparece um aviso no arranque.
2. **Testar com o MySQL real:** foi o único motor que não deu para testar aqui.
3. **Opcional:** o `EnhancedRecommendations` (514 linhas) ainda podia ser dividido; não há tabela de dispositivos IoT (a lista continua a ser de demonstração).

## Como foi feita

| Verificação | Resultado |
|---|---|
| `tsc` | ✅ 0 erros |
| `npm test` | ✅ 20 testes (unitários e integração pela API) |
| `vite build` | ✅ JS principal com 358 kB (113 kB gzip) |
| Navegação automática no Edge | ✅ Sem crashes em nenhuma página, separador ou botão (desktop e 390 px) |
| `npm audit --omit=dev` | ❌ 27 vulnerabilidades (1 crítica, 21 altas) |
| Revisão de código | Servidor e cliente, em paralelo e de forma independente. Os achados abaixo foram confirmados no código ou com pedidos reais |

Legenda: 🔴 corrigir já · 🟠 bug funcional · 🟡 UX/qualidade · 🔵 melhoria

## 🔴 Segurança

| # | Problema | Onde | Correção |
|---|---|---|---|
| S1 | **Ler ficheiros de outros utilizadores:** o cliente pode gravar `receiptUrl` numa despesa a apontar para o ficheiro de outra pessoa, e `/uploads` passa a deixá-lo abrir esse ficheiro (confirmado) | `shared/schema.ts` (`createExpenseRecordSchema`), `storage.userOwnsUpload` | Retirar `receiptUrl` do esquema público; só a rota de OCR o define |
| S2 | **Apagar ficheiros de outros utilizadores:** `imageUrl: "/uploads/vehicle-x/../<ficheiro>"`, seguido de troca de foto ou de apagar o veículo, apaga o ficheiro alheio (confirmado) | `http.ts` (`isOwnVehiclePhoto`, `removeUpload`), `routes/vehicles.ts` | Validar `imageUrl` como `/uploads/vehicle-<uuid>.(jpg\|png\|webp)` ou `https://`; só apagar se nenhum outro veículo usar a foto |
| S3 | **Dependências vulneráveis:** 27 no total, incluindo `proxy-addr` (crítica), `jws` (verificação HMAC), `multer` (DoS e contorno do limite de tamanho), `express-rate-limit`, `socket.io`, `axios` e `zod` | `package-lock.json` | `npm audit fix` (sem mudanças de versão maior) e `drizzle-orm` 0.45 |
| S4 | **Atrás de um proxy (nginx/PaaS), todos os clientes partilham o mesmo IP:** 10 logins/registos em 15 min, mesmo com sucesso, bloqueiam toda a gente | `index.ts`, `routes/auth.ts` | `TRUST_PROXY` configurável; limitadores separados; `skipSuccessfulRequests` no login |
| S5 | **A comparação com "veículos iguais" revela dados de outros:** com 2 veículos iguais, a média revela as despesas exatas do outro utilizador; além disso, não tem limite (2 consultas por veículo) | `storage.getVehicleComparison` | Só mostrar médias com 5 ou mais veículos e calcular numa única consulta SQL |
| S6 | **`vehicle_api.php` está aberto a qualquer pessoa:** sem autenticação, com CORS `*`, abre um Chrome por pedido (fácil de usar para DoS) e regista as matrículas num `.txt` dentro da pasta pública | `vehicle_api.php` | Segredo partilhado num header, rate limit e log fora da pasta pública |
| S7 | **Matrículas enviadas sem encriptação:** sem `VEHICLE_API_URL`, o servidor usa um IP fixo por HTTP, e uma falha de rede aparece como "sem dados" (404) | `services/vehicleApi.ts` | Sem valor por omissão (503 se não estiver configurado); 502 em erros de rede |

## 🟠 Bugs funcionais

| # | Problema | Sintoma | Onde |
|---|---|---|---|
| F1 | **Nada gera alertas** | "Alertas Ativos" está sempre a 0, "Próximas Manutenções" está vazio e "Concluir" não serve para nada | servidor (nenhum insert em `alerts`), `UpcomingMaintenance.tsx` |
| F2 | **Marcações e reservas** são gravadas mas não aparecem em lado nenhum | O utilizador agenda e a marcação "desaparece" | `MaintenanceAppointmentModal`, `ChargingStationReservationModal` |
| F3 | **A consulta de matrícula lê os campos com nomes errados** (o PHP devolve `entity`, `category`, `inspectionValidity`) | Apaga campos obrigatórios do formulário; o combustível fica num Select não controlado e o servidor rejeita-o com 400 | `AddVehicleModal.tsx:329-341`, `VehicleRegistrationFields.tsx:94` |
| F4 | **Códigos de combustível diferentes** em cada formulário (`gasoline95`, `gasoline`, `gas`, `gasoline_98`…) | Ao editar, o Select aparece vazio; o cartão mostra "gasoline95" | 5 componentes |
| F5 | **Formato dos dados IoT diferente** entre cliente e servidor | "Desligado", "Invalid Date" e "Atenção necessária" em tudo | `IoTDashboard.tsx` vs `routes/mobility.ts` |
| F6 | **Formato dos postos de carregamento diferente**, e a lista do GPS pode ser substituída pela de Lisboa | Postos "Desconhecido", "€/kWh" vazio | `ElectricVehicleHub.tsx` |
| F7 | **Números e datas sem validação** | `liters:"abc"` é gravado; uma data inválida dá 500 em vez de 400 | `shared/schema.ts` |
| F8 | **Dados desatualizados** (faltam invalidações da cache) | Os km do veículo e o "KMs este mês" não mudam depois de uma viagem; a "Análise" fica antiga | `MileageTracker.tsx`, mutações de combustível e despesas |
| F9 | Ao editar um abastecimento, o total é recalculado e o original perde-se; um `sort()` altera a cache | Valores alterados sem o utilizador mexer | `VehicleFuelManagement.tsx:218, 374` |
| F10 | A marca do óleo faz um POST e mostra um toast **a cada tecla** | Toasts em cascata | `AddVehicleModal.tsx:676` |
| F11 | "Depósito cheio" nunca é perguntado; há 3 fórmulas de consumo diferentes | Consumo médio a 0 ou inconsistente | `FuelConsumption`, `VehicleFuelManagement` |
| F12 | **Gravador de km:** o estado muda antes de o POST terminar; uma viagem em curso perde-se ao recarregar; não há histórico | O "Parar" não faz nada; ficam viagens "active" para sempre | `MileageTracker.tsx` |
| F13 | **Despesas:** faltam as categorias portagem/estacionamento; a "média mensal" é inventada; o botão "Exportar" não faz nada; o separador "Análise" diz "em desenvolvimento" | | `ExpenseManagement.tsx`, `ExpenseListItem.tsx` |
| F14 | A calculadora "Elétrico vs Combustão" só aparece **em veículos que já são elétricos** | Nunca é útil | `VehicleDetails.tsx:298` |
| F15 | Login e registo com demasiadas tentativas (429) mostram "Erro de rede" | Mensagem errada | `Login.tsx`, `Register.tsx` |
| F16 | Um ficheiro inexistente em `/uploads` devolve 200 com o `index.html`; não há health check | É descarregado HTML como se fosse PDF | `routes/records.ts`, `index.ts` |
| F17 | Apagar um veículo deixa os documentos e recibos no disco | Dados pessoais nunca são apagados | `storage.deleteVehicle` |
| F18 | Abrir um documento é bloqueado no Safari/iOS (`window.open` depois de um `await`) | O documento não abre no iPhone | `apiUtils.openProtectedUrl` |
| F19 | `oilBrand: "constructor"` dá 500 (consulta ao protótipo do objeto); coordenadas fora do intervalo são aceites | | `vehicleSpecs.ts:289`, `mobility.ts` |
| F20 | O CORS rejeita pedidos da própria app acedida por outro endereço (127.0.0.1, IP da rede local) | 403 em tudo o que grava | `index.ts` |

## 🟡 UX, idioma e acessibilidade

- **Telemóvel:**
  - O Dashboard tem 121 px a mais de largura (botão "Agendar" e Select de largura fixa em `UpcomingMaintenance`).
  - Os separadores `grid-cols-7`/`grid-cols-5` transbordam (VehicleDetails, FuelConsumption, EnhancedRecommendations).
  - `bg-background/95/90` é uma classe inválida, por isso o cabeçalho do modal fica transparente.
- **Modo escuro:** há cerca de 380 cores fixas (`bg-gray-50`, `bg-white`, `bg-*-100`) e nenhuma variante `dark:`. Há linhas e cartões brancos com texto claro (Login, VehicleFuelManagement, FuelConsumption, MileageTracker, selos).
- **pt-PT:**
  - gerúndios de pt-BR ("Entrando...", "Atualizando...", "Reservando...") e "Gravação salva";
  - página 404 toda em inglês;
  - "Close" para leitores de ecrã;
  - "low/medium/high" e "clouds" mostrados em bruto;
  - `alert()` em inglês.
- **Acessibilidade:**
  - 10 diálogos sem descrição (aviso do Radix);
  - botões só com ícone e sem `aria-label`;
  - `htmlFor` a apontar para ids que não existem;
  - `alert()`/`prompt()` nativos.
- **Detalhes:**
  - "0" solto em vários sítios e "€0.00";
  - datas por omissão em UTC (dia errado entre a meia-noite e a 01:00);
  - classes Tailwind que não existem (`text-xxs`, `lg:flex-2`);
  - progresso falso na consulta de matrícula;
  - o tema "auto" não segue as mudanças do sistema.
- **Pedidos pesados sem limite:** OCR (Tesseract), planeador de rotas, geocoding (o Nominatim só permite 1 pedido/s) e postos de carregamento. A criação de um veículo sem foto espera pela pesquisa de fotos (até cerca de 30 s).
- **Conta:** não há alteração de palavra-passe nem eliminação de conta. O tempo de resposta do login revela se um email existe. O socket não expira com o token. O tamanho do `JWT_SECRET` não é validado.

## 🔵 Melhorias e código

- **Código morto:**
  - Servidor:
    - esquemas zod `insert*`/`select*` e `*Relations` não usados;
    - tabelas `trip_records` e `vehicle_specs` sem uso;
    - 5 rotas `/api/external/*` e `PATCH /alerts/:id/read` que o cliente não chama.
  - Cliente:
    - `ui/skeleton`, `ui/toggle` (e `@radix-ui/react-toggle`) e `use-mobile`;
    - cerca de 150 linhas do `AdaptiveUIContext`;
    - `apiRequest` (um segundo caminho de pedidos);
    - `useVehicleRecommendations`;
    - 54 variáveis e imports sem uso.
- **Duplicações:**
  - formulário de manutenção duplicado;
  - dados de óleo/pneus fixos no `VehicleRecommendationsCard`, que duplicam `/api/vehicle-specs`;
  - `FuelStationComparator` a chamar o Nominatim e o Overpass diretamente;
  - transformações de datas e números copiadas 3 vezes em `schema.ts`.
- **Desempenho:**
  - o Leaflet é carregado em todas as páginas (só o Planeador o usa);
  - `RecentActivity` faz 1 pedido por veículo;
  - `FuelAlerts` descarrega todos os abastecimentos;
  - o IoT pede dados de demonstração a cada 5 s.
- **Componentes ainda grandes:** AddVehicleModal (818 linhas), FuelConsumption (615), ExpenseManagement (594), ElectricVehicleHub (583), VehicleDetailsModal (565).
- **Operação:**
  - sem encerramento ordenado (SIGTERM);
  - fotos de perfil antigas nunca são apagadas;
  - `setPreferences` sem transação;
  - as datas são guardadas de forma diferente consoante o motor, e só estão certas enquanto o fuso horário do servidor não mudar.

## Ordem recomendada

1. **Segurança:** S1 a S5 (poucas linhas cada), mais S6 e S7 no servidor PHP.
2. **Funcionalidades que não funcionam:** F1 a F6, F12 e F13.
3. **Dados corretos:** F7 a F11 e F15 a F20.
4. **Telemóvel, modo escuro, pt-PT e acessibilidade.**
5. **Limpeza e desempenho.**

---

# 1.ª avaliação (corrigida)

- **Avaliação inicial:** 2026-11-06, sobre o commit `a5c0df1` ("Estado inicial"; este histórico foi depois recriado).
- **Correções:** feitas a seguir, na mesma data.

## Verificações

| Verificação | Antes | Depois |
|---|---|---|
| `npm run check` (`tsc`) | ❌ 58 erros | ✅ 0 erros |
| `vite build` | ✅ um JS de 811 kB | ✅ páginas em chunks; o principal tem 358 kB |
| Bundle do servidor | ⚠️ `require` dinâmico (OCR partia em produção) | ✅ sem `require` dinâmico |
| `npm test` | Não existiam testes | ✅ 17 testes: cálculos, OCR, esquema e 11 cenários de integração pela API |
| Controlo de versões | Sem git | ✅ repositório git |
| Dependências (diretas + dev) | 114 | 61 |

**Testes de integração** (`server/routes.test.ts`, 11 cenários pela API) passaram em **SQLite**, **SQL Server 2022** (numa base de dados temporária, já apagada) e **PostgreSQL** (PGlite). O MySQL não foi testado, por não haver servidor nesta máquina. Não houve testes manuais no browser.

## ✅ Pontos fortes (mantidos)

- Âmbito funcional rico e adaptado a Portugal (IUC, inspeção, matrículas, pt-PT).
- Stack moderna: React 19, Vite 7, Express 5, Drizzle, TanStack Query, shadcn/ui, zod partilhado entre cliente e servidor.
- Integrações reais úteis: OpenRouteService, OpenChargeMap, Overpass/OSM, Tesseract em português.
- Formulários com react-hook-form + zod e boa cobertura de `data-testid`.
- Arquitetura IoT MQTT → Socket.IO com salas por veículo.

---

## 🔴 Segurança

| # | Problema | Estado |
|---|---|---|
| C1 | IDOR: qualquer utilizador acedia a veículos, manutenções, marcações, reservas, alertas e abastecimentos de outros | ✅ `requireVehicle`/`ownedVehicle` em todas as rotas. Consultas de storage filtradas por dono. Testado em `routes.test.ts` |
| C2 | `PATCH /api/vehicles/:id` aceitava `userId`/`id` | ✅ `updateVehicleSchema` ignora estes campos. Testado |
| C3 | Hash da password devolvido ao cliente | ✅ `toPublicUser` em todas as respostas. Testado |
| C4 | JWT com segredo por omissão `changeme` | ✅ O servidor não arranca sem `JWT_SECRET` |
| C5 | Login aceitava a password em texto simples, incluindo o próprio hash | ✅ A conversão de contas antigas só se aplica a valores que não são hash bcrypt |
| C6 | `migrate-urls` sem auth; `vehicle-data` sem auth e a registar headers | ✅ Endpoint removido (a correção de URLs passou a ser feita no arranque, em `server/db.ts`). `vehicle-data` com auth, rate limit e sem log de headers |
| C7 | Socket.IO: subscrição de qualquer veículo, CORS aberto | ✅ Verificação de dono e `CORS_ORIGINS` |
| C8 | Uploads sem limites, extensão do cliente, sem verificação de dono | ✅ Tipos e tamanhos por rota, extensão a partir do MIME, nome com o id do utilizador, acesso só do dono, `nosniff` + CSP |
| C9 | Token na query string (`/uploads?token=`) | ✅ Só o header. O cliente abre os ficheiros por blob |
| C10 | Log com corpos de resposta (tokens) | ✅ O log tem só método, caminho, estado e tempo |
| C11 | Serviço de matrículas por HTTP para um IP fixo | ⚠️ URL configurável (`VEHICLE_API_URL`) e aviso no arranque se não for HTTPS. **Falta pôr HTTPS no servidor PHP** |
| C12 | MySQL como `root` e chaves reais no `.env` | ⚠️ **Ação manual:** criar um utilizador de base de dados dedicado e rodar as chaves (OpenAI, ORS, OpenWeather, OCM, Unsplash) se o `.env` foi partilhado. O `.env` está no `.gitignore` |
| — | Extra: rate limit no registo, limite de 1 MB no corpo, cabeçalhos de segurança, `x-powered-by` desligado, validação do ambiente no arranque | ✅ |

## 🟠 Bugs

| # | Problema | Estado |
|---|---|---|
| B1 | OCR partido (`require` em ESM, API do pdf-parse 2.x) | ✅ Import dinâmico e `pdf()`. Também corrigido: a rota rejeitava sempre o próprio payload, as datas DD/MM eram lidas como MM/DD e `1.234,56` era lido como 234,56 |
| B2 | Erros de validação vazios (zod 4) | ✅ `errors: issues` no tratamento central de erros |
| B3 | Quilometragem não guardava | ✅ `GET/POST/PUT/DELETE /api/mileage-trips` (e os km do veículo são atualizados no fim da viagem) |
| B4 | Editar e apagar abastecimentos | ✅ `PUT/DELETE /api/fuel-records/:id` |
| B5 | Reservas, `connect-device` e `diagnose-image` chamavam rotas inexistentes | ✅ As reservas usam `/api/vehicles/:id/reservations`. O botão de ligar dispositivo e o diagnóstico por imagem (sem backend) foram removidos |
| B6 | O servidor não arrancava sem a chave do Unsplash | ✅ A chave é opcional |
| B7 | O IoT nunca autenticava (chave errada, `process.env` no browser) | ✅ |
| B8 | A comparação EV nunca aparecia (formato diferente) | ✅ O servidor devolve o formato que o cliente usa |
| B9 | Redirecionamento em 401 nunca disparava | ✅ Tratamento único em `apiUtils` |
| B10 | Rotas do cliente sem proteção; logout não limpava a cache | ✅ Componente `Protected` e `queryClient.clear()` |
| B11 | `/vehicle/:id` inacessível | ✅ Links no cartão, no modal e no perfil |
| B12 | `/api/route-planner` registado duas vezes | ✅ |
| B13 | O PUT de planos de rota podia mudar o dono | ✅ Campos protegidos e planos guardados na BD |
| B14 | Duas rotas de upload de documentos inconsistentes | ✅ A rota não usada foi removida |
| B15 | Mudar o email para um já existente dava 500 | ✅ `409` com mensagem |
| B16 | Scripts `start`/`build`/`test:mysql` | ✅ `start` multiplataforma, `build` sem BD, `test` real |
| B17 | Erros de BD escondidos como "não encontrado" | ✅ Os erros sobem até ao `errorHandler` |
| B18 | Leaflet não era removido no unmount | ✅ |
| — | **Extra (encontrado pelos testes):** um `PATCH` parcial de veículo apagava as datas de óleo, pneus, inspeção, IUC e seguro | ✅ |
| — | **Extra:** marcações nunca eram criadas (o cliente enviava campos com outros nomes); o Dashboard lia `activeAlerts`; a quilometragem lia `vehicle.make` | ✅ |
| — | **Extra:** o OpenRouteService era lido com o formato errado (a distância saía sempre 0); endereços do Overpass com chaves erradas | ✅ |

## 🟡 Melhorias

| Tema | Estado |
|---|---|
| Dados simulados apresentados como reais | ✅ Valores aleatórios removidos. Comparação EV com o consumo real e um VE de referência. Recomendações por regras sobre os dados do veículo (prazos reais). Comparações calculadas a partir da BD. Tudo o que é referência ou demonstração tem `demo: true` e um badge na UI |
| `routes.ts` com 2045 linhas | ✅ Dividido em `routes/{auth,vehicles,records,mobility}.ts` mais `http.ts` (middlewares) e `stats.ts` (cálculos) |
| Preferências e planos em ficheiros JSON | ✅ Tabelas `user_preferences` e `route_plans` |
| `try/catch` inúteis no storage; verificação de dono repetida | ✅ Removidos. Uma consulta por verificação |
| Três formas de fazer pedidos no cliente | ✅ Só `lib/apiUtils.ts`, com React Query |
| Duplicações (esquema de combustível, `/api/vehicles` em 7 sítios, `Vehicle` redefinido) | ✅ `lib/fuelForm.ts`, `hooks/useVehicles.ts`, tipos de `@shared` |
| Componentes gigantes | ⚠️ Parcial: VehicleDetailsModal 1108 → 565, VehicleFuelManagement 714 → 430, ElectricVehicleHub 770 → 583, FuelConsumption 800 → 615, ExpenseManagement 797 → 594, AddVehicleModal 1109 → 796. **Falta:** separar a lógica da matrícula no AddVehicleModal e unificar o cálculo das estatísticas de combustível (ainda feito de três formas) |
| Código e ficheiros mortos | ✅ Removidos 6 ficheiros do cliente, 26 componentes `ui/` não usados, `routeUtils.ts`, `envCheck.ts`, `serveStatic`, `.local/`, imagens de debug e plugins Replit |
| Dependências não usadas | ✅ 53 removidas; `@types/*` passaram para `devDependencies` |
| Fontes e ícones | ✅ Só a fonte Inter; Font Awesome substituído por lucide |
| Idioma e acessibilidade | ✅ pt-PT em toda a UI, `lang="pt-PT"`, `aria-label`, links de navegação, zoom permitido |
| Botões sem efeito / UI falsa | ✅ Sino, alertas e "Atualizar KMs" funcionam. Sessões "São Paulo", 2FA e botões sem backend no perfil foram removidos |
| Matrícula única global | ✅ Única por utilizador (bases de dados antigas são migradas no arranque) |
| Duas fontes do esquema (`sql.sql` e Drizzle) | ✅ Só `shared/schema.ts`. As tabelas são criadas e completadas no arranque, em qualquer motor. O `sql.sql` e o `setup-db.js` foram removidos |
| Só MySQL | ✅ MySQL/MariaDB, PostgreSQL, SQL Server e SQLite, escolhidos com `DB_CLIENT` |
| Scraping de terceiros (`vehicle_api.php`) | ⚠️ Mantido. Continua frágil e com risco de termos de utilização. Recomenda-se uma fonte oficial, ou manter o preenchimento manual como alternativa |
| IoT | ⚠️ Os dados em tempo real (MQTT) são reais. A lista de dispositivos é de demonstração, porque não existe tabela de dispositivos |

## Pendente (requer decisão ou ação manual)

1. Arrancar a aplicação sobre a base de dados existente: cria as tabelas novas, aplica a unicidade da matrícula e corrige os URLs de documentos. Convém testar primeiro numa cópia, porque este caminho (MySQL antigo) não foi testado aqui.
2. Criar um utilizador de base de dados dedicado e rodar as chaves de API (C12).
3. Pôr HTTPS no servidor do `vehicle_api.php` e definir `VEHICLE_API_URL` (C11).
4. Testar manualmente no browser com a BD real (login, veículo, abastecimento, viagem, documento, OCR).
5. Opcional: terminar a divisão do `AddVehicleModal`, unificar as estatísticas de combustível e criar uma tabela de dispositivos IoT.
