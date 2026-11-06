# Avaliação do projeto

- **Avaliação inicial:** 2026-11-06, sobre o commit `a5c0df1` ("Estado inicial").
- **Correções:** feitas a seguir, na mesma data. Para ver todas as alterações: `git diff a5c0df1`.

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
