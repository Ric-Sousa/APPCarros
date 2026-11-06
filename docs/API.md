# Referência da API

Base: `http://localhost:5000`. Corpo e resposta em JSON, exceto onde se indica `multipart`.

## Convenções

- **🔒 Auth**: requer `Authorization: Bearer <JWT>`. Sem token: `401 { message: "Token não fornecido" }`. Token inválido ou expirado: `401 { message: "Token inválido" }`.
- **Dono**: todas as rotas com um veículo (`:id` / `:vehicleId` no caminho, ou `vehicleId` no corpo/query) verificam que o veículo pertence ao utilizador. Se não pertencer, respondem `404 { message: "Veículo não encontrado" }`. O mesmo vale para marcações, reservas, alertas, abastecimentos, viagens, documentos e planos de rota.
- **Erros**:

  | Estado | Quando | Corpo |
  |---|---|---|
  | `400` | Validação falhou | `{ message: "Erro de validação", errors: ZodIssue[] }` |
  | `400` | Ficheiro de tipo não permitido ou demasiado grande | `{ message }` |
  | `403` | Origem CORS não permitida | `{ message }` |
  | `404` | Recurso não existe ou não é do utilizador | `{ message }` |
  | `409` | Registo duplicado (por exemplo, a mesma matrícula no mesmo utilizador ou um email já registado) | `{ message }` |
  | `413` | Corpo maior que 1 MB | `{ message }` |
  | `500` | Erro interno | `{ message: "Erro interno do servidor" }` (o detalhe fica só no log) |
- **`demo: true`**: a resposta usa valores de referência ou demonstração, não dados em tempo real. A interface mostra esta indicação.

## Autenticação e utilizador

| Método | Rota | Auth | Corpo / Notas |
|---|---|---|---|
| POST | `/login` | — | `{ email, password }` → `{ token, user }`. Limite: 10 pedidos / 15 min por IP |
| POST | `/api/register` | — | `{ name, email, password (≥6) }` → `201 { token, user, message }`. `409` se o email já existir. Mesmo limite do login |
| GET | `/api/auth/user` | 🔒 | Utilizador atual (sem `password`) |
| PUT | `/api/user/profile` | 🔒 | `{ firstName, lastName, email, phone, address, bio }`. `409` se o email for de outra conta |
| POST | `/api/user/profile-image` | 🔒 | multipart `profileImage` (JPEG/PNG/WEBP, ≤5 MB) → `{ profileImageUrl }` |
| GET | `/api/user/preferences` | 🔒 | Preferências guardadas, ou os valores por omissão |
| POST | `/api/user/preferences` | 🔒 | Objeto JSON de preferências |
| GET | `/api/placeholder/:w/:h?initials=` | — | Avatar SVG (16–512 px) |

## Veículos

| Método | Rota | Auth | Notas |
|---|---|---|---|
| GET | `/api/vehicles` | 🔒 | Veículos do utilizador |
| POST | `/api/vehicles` | 🔒 | Obrigatórios: `licensePlate, brand, model, year, currentMileage` → `201`. Matrícula única por utilizador |
| GET | `/api/vehicles/:id` | 🔒 | |
| PATCH | `/api/vehicles/:id` | 🔒 | Atualização parcial. `id`, `userId` e datas de sistema são ignorados. Campos ausentes não são alterados |
| DELETE | `/api/vehicles/:id` | 🔒 | `204` |
| GET | `/api/vehicles/:id/predictive-status` | 🔒 | `{ oilRisk, tireRisk, inspectionRisk }` (de 0 a 1) |
| GET | `/api/vehicles/:vehicleId/compare` | 🔒 | Consumo e despesas do veículo vs. média de veículos da mesma marca/modelo: `{ userConsumption, averageConsumption, userExpenses, averageExpenses, rankingPosition, totalSimilarVehicles, recommendations[] }` |
| GET | `/api/stats` | 🔒 | `{ totalVehicles, totalAlerts, urgentAlerts }` |
| GET | `/api/stats/fleet-comparison` | 🔒 | `{ totalVehicles, averageFuelConsumption, totalMonthlyExpenses, mostEfficientVehicle, mostExpensiveVehicle }` |
| GET | `/api/vehicle-data/:licensePlate` | 🔒 | Dados por matrícula (serviço externo). Limite: 20 pedidos / 15 min |
| GET | `/api/vehicle-specs/:brand/:model` | 🔒 | Recomendações de óleo e pneus (tabela estática) |
| GET | `/api/autocomplete/:type?q=` | 🔒 | `type`: `oil` \| `tire` \| `both` |
| POST | `/api/oil-interval` | 🔒 | `{ oilBrand, vehicleBrand, vehicleModel }` |

## Manutenção, marcações e alertas

| Método | Rota | Auth | Notas |
|---|---|---|---|
| GET/POST | `/api/vehicles/:id/maintenance` | 🔒 | POST: `{ type, description, performedAt, mileage?, cost?, notes? }` |
| GET/POST | `/api/vehicles/:id/appointments` | 🔒 | POST: `{ type, title, scheduledDate, scheduledTime, ... }` |
| PUT | `/api/appointments/:id` | 🔒 | Atualização parcial validada |
| DELETE | `/api/appointments/:id` | 🔒 | |
| GET | `/api/alerts` | 🔒 | Alertas não descartados dos veículos do utilizador |
| PATCH | `/api/alerts/:id/read` | 🔒 | `204` |
| PATCH | `/api/alerts/:id/dismiss` | 🔒 | `204` |

## Combustível, despesas e viagens

| Método | Rota | Auth | Notas |
|---|---|---|---|
| GET | `/api/fuel-records[?vehicleId=]` | 🔒 | Sem `vehicleId`: todos os veículos do utilizador |
| POST | `/api/fuel-records` | 🔒 | `{ vehicleId, date, mileage, liters, costPerLiter, totalCost, fuelType, ... }` |
| PUT | `/api/fuel-records/:id` | 🔒 | Atualização parcial (sem `vehicleId`) |
| DELETE | `/api/fuel-records/:id` | 🔒 | `204` |
| GET | `/api/expenses[?vehicleId=]` | 🔒 | |
| POST | `/api/expenses` | 🔒 | `{ vehicleId, type, category, amount, date, ... }` |
| POST | `/api/expenses/ocr` | 🔒 | multipart `receipt` (JPEG/PNG/PDF, ≤10 MB) + `vehicleId` → `201 { expense, ocr }`. Tesseract (por+eng) para imagens, pdf-parse para PDF |
| GET | `/api/mileage-trips[?vehicleId=]` | 🔒 | Viagens |
| POST | `/api/mileage-trips` | 🔒 | `{ vehicleId, startTime, startMileage, status, notes? }` |
| PUT | `/api/mileage-trips/:id` | 🔒 | `{ endTime, endMileage, duration, totalDistance, status }`. Se `endMileage` for maior, atualiza os km do veículo |
| DELETE | `/api/mileage-trips/:id` | 🔒 | |

## Documentos e ficheiros

| Método | Rota | Auth | Notas |
|---|---|---|---|
| POST | `/api/vehicles/:vehicleId/documents` | 🔒 | multipart `document` (PDF/JPEG/PNG/WEBP, ≤10 MB) + `type`, `description?`, `notes?` |
| GET | `/api/vehicles/:vehicleId/documents` | 🔒 | |
| DELETE | `/api/documents/:documentId` | 🔒 | Apaga também o ficheiro |
| GET | `/uploads/:file` | 🔒 (só header) | Só o dono. Ficheiros `profile-*` são públicos |

Os ficheiros são guardados como `<userId>-<uuid>.<ext>`, com a extensão derivada do tipo MIME validado.

## Veículos elétricos e rotas

| Método | Rota | Auth | Notas |
|---|---|---|---|
| GET | `/api/charging-stations?lat=&lng=&radius=` | 🔒 | OpenChargeMap (Portugal), raio de 1 a 100 km. `503` sem chave |
| GET/POST | `/api/vehicles/:id/reservations` | 🔒 | Reservas de carregamento |
| PUT/DELETE | `/api/reservations/:id` | 🔒 | |
| POST | `/api/ev-comparison` | 🔒 | `{ vehicleId, monthlyKm?, currentFuelPrice? }` → `{ demo: true, data: { currentVehicle, electricAlternative, paybackPeriod, totalSavings5Years } }`. Usa o consumo real dos abastecimentos e um VE de referência |
| POST | `/api/route-planner` | 🔒 | `{ originLat, originLon, destinationLat, destinationLon, vehicleId, energyType: gasoline\|diesel\|electric, consumption, capacity?, currentLevelPercent? }` → distância, duração, custo, autonomia, paragens sugeridas, geometria |
| GET | `/api/geocode?q=` | 🔒 | `{ results: [{ lat, lng, label }] }` |
| GET/POST | `/api/route-plans` | 🔒 | Planos guardados na BD |
| PUT/DELETE | `/api/route-plans/:id` | 🔒 | O PUT não altera `id`, `userId` nem `vehicleId` |

## Recomendações

| Método | Rota | Auth | Fonte | `demo` |
|---|---|---|---|---|
| GET | `/api/external/fuel-prices` | 🔒 | Tabela de referência | `true` |
| GET | `/api/external/weather-impact?location=` | 🔒 | OpenWeather (com chave) | `false` com chave |
| GET | `/api/external/traffic-optimization?origin=&destination=` | 🔒 | OpenRouteService (com chave) | `false` com chave |
| GET | `/api/external/maintenance-prices/:brand/:model` | 🔒 | Tabela de referência | `true` |
| GET | `/api/external/ai-recommendations/:vehicleId` | 🔒 | Regras sobre os dados do veículo (óleo, pneus, inspeção, IUC, seguro) | `false` |
| GET | `/api/external/enhanced-recommendations/:vehicleId?location=` | 🔒 | Combina as anteriores | `true` (inclui preços de referência) |

## IoT

| Método | Rota | Auth | Notas |
|---|---|---|---|
| GET | `/api/vehicles/:vehicleId/iot-devices` | 🔒 | Lista de demonstração (`demo: true` em cada item) |
| GET | `/api/vehicles/:vehicleId/sensor-data` | 🔒 | Leituras de demonstração |
| POST | `/api/vehicles/:vehicleId/scan-devices` | 🔒 | Devolve um `scanId` (demonstração) |

**Socket.IO** (`path: /socket.io`, origens de `CORS_ORIGINS`): handshake com `auth: { token }`.
- O cliente envia `subscribe_vehicle(vehicleId)` (só entra na sala se for o dono; caso contrário recebe `iot:error`) e `unsubscribe_vehicle(vehicleId)`.
- O servidor envia `iot:sensor { vehicleId, sensor, data }` e `iot:device { vehicleId, device, data }`, a partir dos tópicos MQTT `vehicle/{id}/sensor/{nome}` e `vehicle/{id}/device/{nome}`.
