# Referência da API

Base: `http://localhost:5000`. Corpo e resposta em JSON, exceto onde se indica `multipart`.

## Convenções

- **🔒 Auth**: requer `Authorization: Bearer <JWT>` (validade de 1h). Sem token: `401 { message: "Token não fornecido" }`. Token inválido ou expirado: `401 { message: "Token inválido" }`.
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

## Autenticação e conta

| Método | Rota | Auth | Corpo / Notas |
|---|---|---|---|
| POST | `/login` | — | `{ email, password }` → `{ token, user }`. 10 tentativas falhadas / 15 min por IP |
| POST | `/api/register` | — | `{ name, email, password (≥6) }` → `201 { token, user, message }`. `409` se o email existir. 10 registos / hora por IP |
| GET | `/api/auth/user` | 🔒 | Utilizador atual (sem `password`) |
| PUT | `/api/user/profile` | 🔒 | `{ firstName, lastName, email, phone, address, bio }`. `409` se o email for de outra conta |
| PUT | `/api/user/password` | 🔒 | `{ currentPassword, newPassword (≥6) }` → `204`; `401` se a atual estiver errada |
| DELETE | `/api/user` | 🔒 | `{ password }` → `204`. Apaga a conta, os veículos, todos os registos e os ficheiros |
| POST | `/api/user/profile-image` | 🔒 | multipart `profileImage` (JPEG/PNG/WEBP, ≤5 MB) → `{ profileImageUrl }`. A foto anterior é apagada |
| GET/POST | `/api/user/preferences` | 🔒 | Preferências (objeto JSON) |
| GET | `/api/placeholder/:w/:h?initials=` | — | Avatar SVG (16 a 512 px) |

## Veículos

| Método | Rota | Auth | Notas |
|---|---|---|---|
| GET | `/api/vehicles` | 🔒 | Veículos do utilizador |
| POST | `/api/vehicles` | 🔒 | Obrigatórios: `licensePlate, brand, model, year, currentMileage`. Sem `imageUrl`, escolhe uma foto automaticamente (no máximo 8 s). `409` se a matrícula já existir no utilizador |
| GET | `/api/vehicles/:id` | 🔒 | |
| PATCH | `/api/vehicles/:id` | 🔒 | Atualização parcial; campos ausentes não mudam, `""`/`null` limpam. `imageUrl`: `/uploads/vehicle-<uuid>.(jpg\|png\|webp)` ou `https://…` |
| DELETE | `/api/vehicles/:id` | 🔒 | `204`. Apaga também os registos, documentos, recibos e a foto própria |
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

## Combustível, despesas e viagens

| Método | Rota | Auth | Notas |
|---|---|---|---|
| GET | `/api/fuel-records[?vehicleId=]` | 🔒 | |
| POST | `/api/fuel-records` | 🔒 | `{ vehicleId, date, mileage, liters, costPerLiter, totalCost, fuelType, fullTank?, gasStationName?, notes? }` |
| PUT/DELETE | `/api/fuel-records/:id` | 🔒 | PUT parcial (sem `vehicleId`) |
| GET | `/api/expenses[?vehicleId=]` | 🔒 | |
| POST | `/api/expenses` | 🔒 | `{ vehicleId, type, category, amount, date, description?, vendor?, mileage?, isBusinessExpense? }` (`receiptUrl` só é definido pelo OCR) |
| POST | `/api/expenses/ocr` | 🔒 | multipart `receipt` (JPEG/PNG/PDF, ≤10 MB) + `vehicleId` → `201 { expense, ocr }`. 20 pedidos / 15 min |
| GET | `/api/mileage-trips[?vehicleId=&status=active\|completed]` | 🔒 | Viagens (mais recentes primeiro) |
| POST | `/api/mileage-trips` | 🔒 | `{ vehicleId, startTime, startMileage, status?, notes? }` |
| PUT | `/api/mileage-trips/:id` | 🔒 | `{ endTime, endMileage, duration, totalDistance, status, notes? }`. Se `endMileage` for maior, atualiza os km do veículo |
| DELETE | `/api/mileage-trips/:id` | 🔒 | |

## Documentos e ficheiros

| Método | Rota | Auth | Notas |
|---|---|---|---|
| POST | `/api/vehicles/:vehicleId/documents` | 🔒 | multipart `document` (PDF/JPEG/PNG/WEBP, ≤10 MB) + `type`, `description?`, `notes?` |
| GET | `/api/vehicles/:vehicleId/documents` | 🔒 | |
| DELETE | `/api/documents/:documentId` | 🔒 | Apaga também o ficheiro |
| GET | `/uploads/:file` | 🔒 (só header) | Só o dono. `profile-*` e `vehicle-*` são públicos. Ficheiro inexistente: `404` |

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
| GET | `/api/external/enhanced-recommendations/:vehicleId?location=` | 🔒 | Recomendações por regras sobre os dados do veículo, meteorologia (OpenWeather) e preços de referência (`demo: true`) |

## IoT

| Método | Rota | Auth | Notas |
|---|---|---|---|
| GET | `/api/vehicles/:vehicleId/iot-devices` | 🔒 | `[{ id, name, type: obd2_adapter\|tire_sensor\|battery_monitor, connected, batteryLevel, signalStrength, lastSeen, demo: true }]` |
| GET | `/api/vehicles/:vehicleId/sensor-data` | 🔒 | `[{ id, type: obd2\|tire_pressure\|battery\|temperature\|fuel_level, name, value, unit, status: good\|warning\|critical, lastUpdate, connected, demo: true }]` |
| POST | `/api/vehicles/:vehicleId/scan-devices` | 🔒 | Demonstração |

**Socket.IO** (`path: /socket.io`, mesmas origens que a API): handshake com `auth: { token }`. A ligação termina quando o token expira.
- O cliente envia `subscribe_vehicle(vehicleId)` (só para veículos do utilizador; caso contrário recebe `iot:error`) e `unsubscribe_vehicle(vehicleId)`.
- O servidor envia `iot:sensor { vehicleId, sensor, data }` e `iot:device { vehicleId, device, data }`, a partir dos tópicos MQTT `vehicle/{id}/sensor/{nome}` e `vehicle/{id}/device/{nome}`.

## Serviço de matrículas (`vehicle_api.php`)

`GET vehicle_api.php?license_plate=AA-00-AA` com o header `X-Api-Key: <VEHICLE_API_KEY>`. Variáveis no servidor PHP:

| Variável | Para quê |
|---|---|
| `VEHICLE_API_KEY` | Segredo partilhado; sem ela, o serviço aceita pedidos de qualquer pessoa |
| `VEHICLE_API_RATE_LIMIT` | Pedidos por IP em 15 min (30 por omissão) |
| `VEHICLE_API_LOG` | Ficheiro de registo (por omissão na pasta temporária, fora da pasta pública; as matrículas aparecem mascaradas) |
