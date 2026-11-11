# Referência da API

Base: `http://localhost:5000`. Corpo e resposta em JSON, exceto onde se indica `multipart`.

## Convenções

- **🔒 Auth**: requer `Authorization: Bearer <JWT>` (token de acesso, validade de 15 min). O cliente guarda-o só em memória e renova-o com `POST /api/auth/refresh`, que usa o cookie `httpOnly` `logicar_rt` (path `/api/auth`, `SameSite=Strict`, rotativo; reutilizar um refresh antigo termina a sessão nesse dispositivo). Sem token: `401 { message: "Token não fornecido" }`. Token inválido ou expirado: `401 { message: "Token inválido" }`.
- **Plano**: as funcionalidades pagas respondem `402 { message, code: "PLAN_LIMIT", feature }` (2.º veículo no plano Grátis, partilha, OCR, push, relatórios).
- **Dono**: as rotas com um veículo (`:id` / `:vehicleId` no caminho, ou `vehicleId` no corpo/query) só funcionam com veículos do utilizador. O mesmo vale para marcações, reservas, alertas, abastecimentos, viagens, documentos e planos de rota. Um recurso de outro utilizador responde `404`, como se não existisse.
- **Validação**:
  - Números têm de ser números; aceita-se vírgula decimal ("20,5").
  - Datas aceitam `AAAA-MM-DD`, ISO 8601, `DD/MM/AAAA`, `MM/AAAA` e `AAAA`.
  - Combustível: `gasoline95`, `gasoline98`, `diesel`, `electric`, `hybrid` ou `lpg`. Valores antigos ("Gasóleo", "Gasolina", "gasoline"…) são convertidos.
  - `id`, `userId`, `createdAt` e `updatedAt` nunca são aceites do cliente.
- **Datas devolvidas** em ISO 8601 UTC (o servidor corre com `TZ=UTC`); as datas sem hora vêm como `AAAA-MM-DDT00:00:00.000Z`.
- **Erros**:

  | Estado | Quando | Corpo |
  |---|---|---|
  | `400` | Validação | `{ message: "Erro de validação", errors: [{ path, message }] }` |
  | `400` | Ficheiro de tipo não permitido ou demasiado grande | `{ message }` |
  | `401` | Sem token ou palavra-passe errada | `{ message }` |
  | `403` | Origem CORS não permitida | `{ message }` |
  | `402` | Limite do plano | `{ message, code: "PLAN_LIMIT", feature }` |
  | `403` | Ação reservada ao dono do veículo (condutor convidado) ou ao admin | `{ message }` |
  | `404` | Não existe ou não é do utilizador | `{ message }` |
  | `409` | Duplicado (email registado, matrícula repetida no mesmo utilizador) | `{ message }` |
  | `413` | Corpo maior que 1 MB | `{ message }` |
  | `429` | Demasiados pedidos | `{ message: "Demasiadas … Tente novamente dentro de alguns minutos." }` |
  | `502`/`503` | Serviço externo falhou / não configurado | `{ message }` |
  | `500` | Erro interno | `{ message: "Erro interno do servidor" }` (o detalhe fica só no log) |
- **`demo: true`**: valores de referência ou de demonstração, não dados em tempo real. A interface mostra esta indicação.

## Sistema

| Método | Rota | Auth | Notas |
|---|---|---|---|
| GET | `/api/health` | — | `{ status: "ok", database }`, ou `503` se a base de dados não responder |
| GET | `/api/config` | — | `{ appName, features: { plateLookup, iot, push, payments, fuelPrices, email }, vapidPublicKey, plans, attributions }`: o que está ligado neste servidor |
| POST | `/api/client-errors` | — | `{ message, stack?, url? }` → `204`. Erros do browser, escritos no log do servidor. 30 / 15 min |

## Autenticação e conta

| Método | Rota | Auth | Corpo / Notas |
|---|---|---|---|
| POST | `/login` | — | `{ email, password, remember? }` → `{ token, user }` + cookie de refresh (30 dias com `remember`, 24 h sem). Com 2FA ativa: `{ twoFactorRequired: true, challengeToken }` (válido 5 min). 10 tentativas falhadas / 15 min por IP |
| POST | `/api/auth/2fa` | — | `{ challengeToken, code, remember? }` → `{ token, user }`. `401` com código errado |
| POST | `/api/auth/refresh` | cookie | → `{ token, user }` e roda o cookie. `401` se a sessão terminou |
| POST | `/api/auth/logout` | cookie | `204`. Termina esta sessão e apaga o cookie |
| POST | `/api/register` | — | `{ name, email, password (≥8), acceptTerms: true }` → `201 { token, user, message }` + cookie. Envia o email de confirmação. `409` se o email existir. 10 registos / hora por IP |
| POST | `/api/auth/verify-email` | — | `{ token }` (link do email, 48 h, uso único) → `204` |
| POST | `/api/auth/resend-verification` | 🔒 | `204` |
| POST | `/api/auth/forgot-password` | — | `{ email }` → sempre `204` (não revela se o email existe). Link válido 1 h, uso único |
| POST | `/api/auth/reset-password` | — | `{ token, password (≥8) }` → `204`. Termina todas as sessões |
| GET | `/api/auth/user` | 🔒 | Utilizador atual (sem `password`, segredo 2FA nem token do calendário), com o `plan` efetivo, `emailVerifiedAt`, `onboardedAt`, `totpEnabled` e `isAdmin` |
| PUT | `/api/user/profile` | 🔒 | `{ firstName, lastName, email, phone, address, bio }`. `409` se o email for de outra conta. Um email novo tem de ser confirmado outra vez |
| PUT | `/api/user/password` | 🔒 | `{ currentPassword, newPassword (≥8) }` → `204` e termina as outras sessões; `401` se a atual estiver errada |
| DELETE | `/api/user` | 🔒 | `{ password }` → `204`. Apaga a conta, os veículos de que é dono, todos os registos, sessões e ficheiros |
| GET | `/api/user/export` | 🔒 | Todos os dados do utilizador em JSON (RGPD, art. 20.º). 10 / hora |
| POST | `/api/user/onboarded` | 🔒 | `204`. Marca o assistente inicial como concluído |
| GET | `/api/user/sessions` | 🔒 | `[{ id, userAgent, createdAt, current }]`: dispositivos com sessão iniciada |
| DELETE | `/api/user/sessions/:id` | 🔒 | `204`. Termina a sessão desse dispositivo |
| POST | `/api/user/sessions/revoke-others` | 🔒 | `204`. Termina todas as outras sessões |
| POST | `/api/user/2fa/setup` | 🔒 | → `{ secret, otpauthUrl, qrSvg }`. `409` se já estiver ativa |
| POST | `/api/user/2fa/enable` | 🔒 | `{ code }` → `204` e termina as outras sessões |
| POST | `/api/user/2fa/disable` | 🔒 | `{ password, code }` → `204` |
| POST | `/api/user/profile-image` | 🔒 | multipart `profileImage` (JPEG/PNG/WEBP, ≤5 MB) → `{ profileImageUrl }`. A foto anterior é apagada |
| GET/POST | `/api/user/preferences` | 🔒 | Preferências. `notificationPreferences: { email, push, leadDays ⊆ [30, 7, 1], weeklyDigest }` (por omissão: email e push ligados, 30/7/1 dias, sem resumo semanal) |
| GET | `/api/placeholder/:w/:h?initials=` | — | Avatar SVG (16 a 512 px) |

## Veículos

| Método | Rota | Auth | Notas |
|---|---|---|---|
| GET | `/api/vehicles` | 🔒 | Veículos do utilizador (próprios e partilhados com ele), cada um com `role: owner\|driver` e `ownerName` quando é partilhado |
| POST | `/api/vehicles` | 🔒 | Obrigatórios: `licensePlate, brand, model, year, currentMileage`. Sem `imageUrl`, escolhe uma foto automaticamente (no máximo 8 s). `409` se a matrícula já existir no utilizador. `402` acima do limite de veículos do plano. Com `registrationDate` e sem prazos, sugere `iucDue` (fim do mês da matrícula) e `inspectionDue` (periodicidade legal pelo tipo de veículo) |
| GET | `/api/vehicles/:id` | 🔒 | |
| PATCH | `/api/vehicles/:id` | 🔒 | Atualização parcial; campos ausentes não mudam, `""`/`null` limpam. `imageUrl`: `/uploads/vehicle-<uuid>.(jpg\|png\|webp)` ou `https://…` |
| DELETE | `/api/vehicles/:id` | 🔒 dono | `204`. Apaga também os registos, documentos, recibos e a foto própria |
| GET | `/api/vehicles/:id/predictive-status` | 🔒 | `{ oilRisk, tireRisk, inspectionRisk }` (de 0 a 1) |
| GET | `/api/vehicles/:vehicleId/compare` | 🔒 | `{ userConsumption, userExpenses, totalSimilarVehicles, averageConsumption?, averageExpenses?, rankingPosition?, recommendations[] }`. As médias só aparecem com ≥5 outros veículos iguais |
| GET | `/api/stats` | 🔒 | `{ totalVehicles, totalAlerts, urgentAlerts, monthlyKms }` |
| GET | `/api/stats/fleet-comparison` | 🔒 | Comparação entre os veículos do utilizador |
| GET | `/api/vehicle-data/:licensePlate` | 🔒 | Dados por matrícula com os nomes do formulário: `{ licensePlate, brand?, model?, year?, registrationDate?, fuelType?, powerCV?, powerKW?, engineDisplacement?, iucCategory?, certifyingEntity?, vehicleCategory?, origin?, inspectionDue?, insuranceDue? }`. `404` sem dados, `502` se o serviço falhar, `503` sem `VEHICLE_API_URL`. 20 pedidos / 15 min |
| GET | `/api/vehicle-specs/:brand/:model` | 🔒 | Recomendações de óleo e pneus |
| GET | `/api/autocomplete/:type?q=` | 🔒 | `type`: `oil` \| `tire` \| `both` |
| POST | `/api/oil-interval` | 🔒 | `{ oilBrand, vehicleBrand, vehicleModel }` |

## Fotos de veículos

| Método | Rota | Auth | Notas |
|---|---|---|---|
| GET | `/api/vehicle-photos/suggestions?brand=&model=&year=&engineDisplacement=&vehicleCategory=&iucCategory=` | 🔒 | Até 8 fotos do Wikimedia Commons (ordenadas por modelo, ano e cilindrada no título) e até 4 do Unsplash: `[{ url, thumbUrl, credit, creditUrl, source, trackUrl? }]`. 30 pedidos / 15 min |
| POST | `/api/vehicle-photos` | 🔒 | multipart `image` (JPEG/PNG/WEBP, ≤5 MB) → `201 { url }` (`/uploads/vehicle-<uuid>.<ext>`, público) |
| POST | `/api/vehicle-photos/track` | 🔒 | `{ trackUrl }`: avisa o Unsplash de que a foto foi usada |

O crédito (`imageCredit`/`imageCreditUrl`) tem de ser mostrado junto da foto (licenças CC BY-SA e regras do Unsplash). Uma foto própria que deixa de ser usada é apagada do disco.

## Manutenção, marcações e alertas

| Método | Rota | Auth | Notas |
|---|---|---|---|
| GET | `/api/maintenance?limit=20` | 🔒 | Últimas manutenções de todos os veículos (1 a 100) |
| GET/POST | `/api/vehicles/:id/maintenance` | 🔒 | POST: `{ type, description, performedAt, mileage?, cost?, notes? }` |
| GET | `/api/appointments` | 🔒 | Marcações de todos os veículos, por data |
| GET/POST | `/api/vehicles/:id/appointments` | 🔒 | POST: `{ type, title, scheduledDate, scheduledTime (HH:MM), description?, serviceProvider?, serviceLocation?, estimatedCost?, mileageAtAppointment?, notes? }` |
| PUT/DELETE | `/api/appointments/:id` | 🔒 | PUT parcial (ex.: `{ status: "completed" }`) |
| GET | `/api/alerts` | 🔒 | Alertas gerados a partir dos dados de cada veículo: `type` = `oil_change` / `tire_change` (por km) ou `inspection` / `iuc` / `insurance` (≤30 dias ou vencidos); `priority` = `urgent` (vencido) / `high` / `normal`. O `id` é estável por prazo |
| PATCH | `/api/alerts/:id/read`, `/api/alerts/:id/dismiss` | 🔒 | `204`. Um alerta descartado continua descartado até o prazo mudar |
| POST | `/api/alerts/:id/snooze` | 🔒 | `{ days: 1..30 }` → `204`. Esconde o alerta até lá |
| POST | `/api/alerts/:id/done` | 🔒 | → `{ vehicle }`. IUC e seguro: +1 ano; inspeção: próximo prazo pela periodicidade legal; óleo e pneus: atualiza km/data e cria o registo de manutenção |

## Combustível, despesas e viagens

| Método | Rota | Auth | Notas |
|---|---|---|---|
| GET | `/api/fuel-records[?vehicleId=]` | 🔒 | |
| POST | `/api/fuel-records` | 🔒 | `{ vehicleId, date, mileage, liters, costPerLiter, totalCost, fuelType, fullTank?, gasStationName?, notes? }` |
| PUT/DELETE | `/api/fuel-records/:id` | 🔒 | PUT parcial (sem `vehicleId`) |
| GET | `/api/expenses[?vehicleId=]` | 🔒 | |
| POST | `/api/expenses` | 🔒 | `{ vehicleId, type, category, amount, date, description?, vendor?, mileage?, isBusinessExpense? }` (`receiptUrl` só é definido pelo OCR) |
| POST | `/api/expenses/ocr` | 🔒 Premium | multipart `receipt` (JPEG/PNG/PDF, ≤10 MB) + `vehicleId` → `201 { expense, ocr }`. 20 pedidos / 15 min |
| GET | `/api/mileage-trips[?vehicleId=&status=active\|completed]` | 🔒 | Viagens (mais recentes primeiro) |
| POST | `/api/mileage-trips` | 🔒 | `{ vehicleId, startTime, startMileage, status?, notes? }` |
| PUT | `/api/mileage-trips/:id` | 🔒 | `{ endTime, endMileage, duration, totalDistance, status, notes? }`. Se `endMileage` for maior, atualiza os km do veículo |
| DELETE | `/api/mileage-trips/:id` | 🔒 | |

## Documentos e ficheiros

| Método | Rota | Auth | Notas |
|---|---|---|---|
| POST | `/api/vehicles/:vehicleId/documents` | 🔒 | multipart `document` (PDF/JPEG/PNG/WEBP, ≤10 MB) + `type`, `description?`, `notes?`. Devolve o documento e `suggestion: { field, date } \| null`: para `insurance` e `inspection_report`, a data de validade lida no documento (o cliente pergunta antes de a aplicar) |
| GET | `/api/vehicles/:vehicleId/documents` | 🔒 | |
| DELETE | `/api/documents/:documentId` | 🔒 | Apaga também o ficheiro |
| GET | `/uploads/:file` | 🔒 (só header) | Só o dono. `profile-*` e `vehicle-*` são públicos. Com `S3_BUCKET` os ficheiros vêm do bucket. Ficheiro inexistente: `404` |

## Veículos elétricos e rotas

| Método | Rota | Auth | Notas |
|---|---|---|---|
| GET | `/api/charging-stations?lat=&lng=&radius=` | 🔒 | OpenChargeMap (Portugal), raio de 1 a 100 km: `[{ id, name, address, lat, lng, distance, connectorTypes, power, available, total, price: null, network, status, usageCost, access24Hours }]`. `503` sem chave. 60 pedidos / 15 min |
| GET | `/api/reservations` | 🔒 | Reservas de todos os veículos |
| GET/POST | `/api/vehicles/:id/reservations` | 🔒 | POST: `{ stationId, stationName, stationAddress, reservationDate, startTime, endTime, estimatedChargingTime, chargingType, … }`. É um registo/lembrete do utilizador; o operador do posto não é contactado |
| PUT/DELETE | `/api/reservations/:id` | 🔒 | |
| POST | `/api/ev-comparison` | 🔒 | `{ vehicleId, monthlyKm?, currentFuelPrice? }` → `{ demo: true, data: { currentVehicle, electricAlternative, paybackPeriod, totalSavings5Years } }` |
| POST | `/api/route-planner` | 🔒 | `{ originLat, originLon, destinationLat, destinationLon, vehicleId, energyType: gasoline\|diesel\|electric, consumption, capacity?, currentLevelPercent? }`. 60 pedidos / 15 min |
| GET | `/api/geocode?q=` | 🔒 | `{ results: [{ lat, lng, label }] }` (OpenRouteService ou Nominatim, com 1 pedido/s) |
| GET/POST | `/api/route-plans` | 🔒 | Planos guardados |
| PUT/DELETE | `/api/route-plans/:id` | 🔒 | O PUT não altera `id`, `userId` nem `vehicleId` |
| GET | `/api/external/enhanced-recommendations/:vehicleId?location=&lat=&lng=` | 🔒 | Recomendações por regras sobre os dados do veículo e a meteorologia (OpenWeather). Com `lat`/`lng`, a poupança de combustível usa os preços reais da DGEG (`fuelSource: "DGEG"`); sem eles, valores de referência (`demo: true`) |
| GET | `/api/fuel-prices?lat=&lng=&fuel=&radius=` | 🔒 | Postos mais baratos perto: `{ source: "DGEG", attribution, fetchedAt, average, stations[] }` (cada posto com nome, marca, morada, distância, preço e data de atualização). `fuel`: `diesel` \| `gasoline95` \| `gasoline98` \| `lpg`. Lista nacional em cache 6 h. `502` se a DGEG falhar |

## IoT

Só com `FEATURE_IOT=true` (experimental); caso contrário estas rotas respondem `404`.

| Método | Rota | Auth | Notas |
|---|---|---|---|
| GET | `/api/vehicles/:vehicleId/iot-devices` | 🔒 | `[{ id, name, type: obd2_adapter\|tire_sensor\|battery_monitor, connected, batteryLevel, signalStrength, lastSeen, demo: true }]` |
| GET | `/api/vehicles/:vehicleId/sensor-data` | 🔒 | `[{ id, type: obd2\|tire_pressure\|battery\|temperature\|fuel_level, name, value, unit, status: good\|warning\|critical, lastUpdate, connected, demo: true }]` |
| POST | `/api/vehicles/:vehicleId/scan-devices` | 🔒 | Demonstração |

**Socket.IO** (`path: /socket.io`, mesmas origens que a API): handshake com `auth: { token }`. A ligação termina quando o token expira.
- O cliente envia `subscribe_vehicle(vehicleId)` (só para veículos do utilizador; caso contrário recebe `iot:error`) e `unsubscribe_vehicle(vehicleId)`.
- O servidor envia `iot:sensor { vehicleId, sensor, data }` e `iot:device { vehicleId, device, data }`, a partir dos tópicos MQTT `vehicle/{id}/sensor/{nome}` e `vehicle/{id}/device/{nome}`.

## Partilha de veículos

| Método | Rota | Auth | Notas |
|---|---|---|---|
| GET | `/api/vehicles/:id/members` | 🔒 dono | `[{ id, email, role, status: pending\|active, userName?, createdAt }]` |
| POST | `/api/vehicles/:id/members` | 🔒 dono, Premium | `{ email }` → `201 { id }` e envia o convite por email (link de uso único). `409` se já tiver acesso. 20 / hora |
| DELETE | `/api/vehicles/:id/members/:memberId` | 🔒 | O dono remove qualquer membro; o condutor só a si próprio (`memberId = me`) |
| GET | `/api/invites/:token` | 🔒 | `{ vehicle: { brand, model, licensePlate }, invitedBy }`. `404` se inválido ou já usado |
| POST | `/api/invites/accept` | 🔒 | `{ token }` → `{ vehicleId }` |

O condutor vê o veículo, regista abastecimentos, despesas, viagens e manutenções e recebe os lembretes. Não pode apagar o veículo, mudar a foto nem gerir a partilha.

## Relatórios e calendário

| Método | Rota | Auth | Notas |
|---|---|---|---|
| GET | `/api/vehicles/:id/report` | 🔒 Premium | Dados do livro de revisões (veículo, manutenções, despesas, totais). O cliente imprime-o em PDF |
| GET | `/api/reports/fleet.csv` | 🔒 Empresas | CSV (`;`, vírgula decimal, UTF-8 com BOM; abre no Excel) com km, consumo, custos dos últimos 12 meses e prazos por veículo |
| GET | `/api/calendar.ics` | 🔒 | Prazos (IUC, inspeção, seguro) e marcações em iCalendar |
| GET/POST | `/api/user/calendar` | 🔒 | Endereço secreto para subscrever no Google/Apple/Outlook: `{ url }`. O POST gera um novo (o anterior deixa de funcionar) |
| GET | `/api/calendar/:token.ics` | — | O mesmo calendário, pelo endereço secreto |

## Lembretes e notificações

Tarefa diária às `NOTIFY_HOUR` (UTC). Para cada prazo envia email e/ou push a 30, 7 e 1 dia(s) (configurável), no próprio dia e depois de vencido; para óleo e pneus, quando a prioridade sobe. Cada envio fica em `notification_log` e nunca se repete. Resumo semanal à segunda-feira (opcional). Os emails têm um link para deixar de os receber.

| Método | Rota | Auth | Notas |
|---|---|---|---|
| POST | `/api/push/subscribe` | 🔒 Premium | `{ endpoint, keys: { p256dh, auth } }` (subscrição do browser) → `201` |
| POST | `/api/push/unsubscribe` | 🔒 | `{ endpoint }` → `204` |
| POST | `/api/push/test` | 🔒 | Notificação de teste para os dispositivos do utilizador |
| POST | `/api/notifications/test-email` | 🔒 | Email de teste |
| GET | `/api/notifications/unsubscribe?token=` | — | Página HTML que desliga os emails de lembrete (token do email, 400 dias) |

## Planos e pagamentos

| Método | Rota | Auth | Notas |
|---|---|---|---|
| GET | `/api/billing` | 🔒 | `{ plan, planExpiresAt, provider: stripe\|dev\|none, canManage }` |
| POST | `/api/billing/checkout` | 🔒 | `{ plan: premium\|business, quantity? }` → `{ url }` (Stripe Checkout). Só com `STRIPE_SECRET_KEY` |
| POST | `/api/billing/portal` | 🔒 | → `{ url }` (portal do cliente Stripe: cartão, faturas, cancelar) |
| POST | `/api/billing/webhook` | assinatura Stripe | `checkout.session.completed`, `customer.subscription.updated/deleted` → atualiza `plan` e `planExpiresAt` |
| POST | `/api/billing/dev-activate` | 🔒 | `{ plan }` → `204`, 30 dias. Só em desenvolvimento e sem Stripe (`404` caso contrário) |

Planos (`shared/plans.ts`): **Grátis**, 1 veículo e lembretes por email; **Premium**, veículos ilimitados, push, OCR, livro de revisões e partilha; **Empresas**, tudo mais o relatório da frota.

## Feedback e administração

| Método | Rota | Auth | Notas |
|---|---|---|---|
| POST | `/api/feedback` | 🔒 | `{ message, page? }` → `201`. Guardado e enviado para `SUPPORT_EMAIL`. 10 / hora |
| GET | `/api/admin/metrics` | 🔒 admin | Utilizadores, verificados, ativos 7 dias, ativação, retenção a 30 dias, contagem de eventos e feedback recente. Admin = email em `ADMIN_EMAILS` |
| POST | `/api/admin/run-notifications` | 🔒 admin | Corre já a tarefa de lembretes → `{ users, emails, pushes }` |

## Serviço de matrículas (`vehicle_api.php`)

`GET vehicle_api.php?license_plate=AA-00-AA` com o header `X-Api-Key: <VEHICLE_API_KEY>`. Variáveis no servidor PHP:

| Variável | Para quê |
|---|---|
| `VEHICLE_API_KEY` | Segredo partilhado; sem ela, o serviço aceita pedidos de qualquer pessoa |
| `VEHICLE_API_RATE_LIMIT` | Pedidos por IP em 15 min (30 por omissão) |
| `VEHICLE_API_LOG` | Ficheiro de registo (por omissão na pasta temporária, fora da pasta pública; as matrículas aparecem mascaradas) |
