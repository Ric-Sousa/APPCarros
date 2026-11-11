import { randomUUID } from 'crypto';
import { sql } from 'kysely';
import type { Table } from 'drizzle-orm';
import { getTableColumns } from 'drizzle-orm';
import * as schema from '@shared/schema';
import type {
  User, NewUser, Vehicle, NewVehicle, MaintenanceRecord, NewMaintenanceRecord, Alert, FuelRecord, NewFuelRecord,
  MileageTrip, NewMileageTrip, ExpenseRecord, NewExpenseRecord, Document, NewDocument,
  MaintenanceAppointment, NewMaintenanceAppointment, ChargingStationReservation, NewChargingStationReservation,
} from '@shared/schema';
import { db, dbClient, tableName, toRow, fromRow, fromRows, withDefaults, isDuplicateKeyError } from './db';
import { getVehicleImage } from './services/vehicleImage';
import { consumptionL100, monthlyExpenses, dueItems, alertId } from './stats';

/** Utilizador sem segredos (hash da password, segredo TOTP, token do calendário): é o único formato que sai para o cliente. */
export type PublicUser = Omit<User, 'password' | 'totpSecret' | 'calendarToken'>;
export function toPublicUser(user: User): PublicUser {
  const { password: _password, totpSecret: _totp, calendarToken: _cal, ...rest } = user;
  return rest;
}

type Values = Record<string, unknown>;

// ---------- Operações genéricas ----------
const selectAll = (table: Table) => db.selectFrom(tableName(table)).selectAll();

async function byId<T>(table: Table, id: string): Promise<T | undefined> {
  return fromRow<T>(table, await selectAll(table).where('id', '=', id).executeTakeFirst());
}

async function insert<T>(table: Table, values: Values, id: string = randomUUID()): Promise<T> {
  await db.insertInto(tableName(table)).values(toRow(table, withDefaults(table, { ...values, id }))).execute();
  return (await byId<T>(table, id))!;
}

async function update(table: Table, id: string, values: Values): Promise<void> {
  const row = toRow(table, 'updatedAt' in getTableColumns(table) ? { ...values, updatedAt: new Date() } : values);
  if (Object.keys(row).length) await db.updateTable(tableName(table)).set(row).where('id', '=', id).execute();
}

/** LIMIT n em todos os motores (o SQL Server usa TOP). */
const limitRows = <Q extends { limit(n: number): Q; top(n: number): Q }>(query: Q, n: number): Q => (dbClient === 'mssql' ? query.top(n) : query.limit(n));

/** Mínimo de outros veículos iguais para mostrar médias (abaixo disso as médias revelariam dados de pessoas concretas). */
export const MIN_COMPARISON_GROUP = 5;

const remove = (table: Table, id: string) => db.deleteFrom(tableName(table)).where('id', '=', id).execute();

// Subconsulta: veículos a que o utilizador tem acesso (dono ou condutor com convite aceite)
const memberVehicleIds = (userId: string) =>
  db.selectFrom('vehicle_members').select('vehicle_id').where('user_id', '=', userId).where('status', '=', 'active');
const userVehicleIds = (userId: string) =>
  db.selectFrom('vehicles').select('id').where((eb) => eb.or([eb('user_id', '=', userId), eb('id', 'in', memberVehicleIds(userId))]));

/** Veículo com o papel do utilizador: dono ou condutor (veículo partilhado). */
export type VehicleAccess = Vehicle & { role: 'owner' | 'driver'; ownerName?: string };

const displayName = (u: { first_name?: unknown; last_name?: unknown; email?: unknown } | undefined) =>
  u ? ([u.first_name, u.last_name].filter(Boolean).join(' ') || String(u.email ?? '')) : undefined;

// Tabelas com dados de um veículo (apagadas com ele; não há chaves estrangeiras para ser igual em todos os motores)
const VEHICLE_CHILDREN = [
  schema.maintenanceRecords, schema.maintenanceAppointments, schema.alerts, schema.fuelRecords, schema.expenseRecords,
  schema.documents, schema.mileageTrips, schema.chargingStationReservations, schema.routePlans, schema.vehicleMembers,
];

export class Storage {
  // ---------- Utilizadores ----------
  async getUser(id: string): Promise<PublicUser | undefined> {
    const user = await byId<User>(schema.users, id);
    return user && toPublicUser(user);
  }

  /** Inclui o hash da password: usar só para login e verificações internas. */
  async getUserByEmail(email: string): Promise<User | undefined> {
    return fromRow<User>(schema.users, await selectAll(schema.users).where('email', '=', email).executeTakeFirst());
  }

  async createUser(user: Omit<NewUser, 'id'>): Promise<PublicUser> {
    return toPublicUser(await insert<User>(schema.users, user));
  }

  async updateUserProfile(id: string, data: Pick<User, 'firstName' | 'lastName' | 'email' | 'phone' | 'address' | 'bio'>): Promise<PublicUser> {
    await update(schema.users, id, data);
    return (await this.getUser(id))!;
  }

  async updateUserProfileImage(id: string, profileImageUrl: string) {
    await update(schema.users, id, { profileImageUrl });
  }

  async updateUserPassword(id: string, hashedPassword: string) {
    await update(schema.users, id, { password: hashedPassword });
  }

  /** Inclui o hash da password: usar só para verificações internas. */
  async getUserWithPassword(id: string): Promise<User | undefined> {
    return byId<User>(schema.users, id);
  }

  /** Apaga a conta e todos os dados. Devolve os URLs de ficheiros a apagar do disco. */
  async deleteUser(userId: string): Promise<string[]> {
    const user = await byId<User>(schema.users, userId);
    const vehicles = await this.getOwnedVehicles(userId);
    const files = (await Promise.all(vehicles.map((v) => this.vehicleFiles(v)))).flat();
    if (user?.profileImageUrl?.startsWith('/uploads/')) files.push(user.profileImageUrl);
    await db.transaction().execute(async (trx) => {
      for (const v of vehicles) {
        for (const table of VEHICLE_CHILDREN) await trx.deleteFrom(tableName(table)).where('vehicle_id', '=', v.id).execute();
      }
      await trx.deleteFrom('vehicles').where('user_id', '=', userId).execute();
      for (const t of ['route_plans', 'maintenance_appointments', 'charging_station_reservations', 'user_preferences',
        'refresh_tokens', 'user_tokens', 'push_subscriptions', 'notification_log', 'vehicle_members', 'feedback', 'product_events']) {
        await trx.deleteFrom(t).where('user_id', '=', userId).execute();
      }
      await trx.deleteFrom('users').where('id', '=', userId).execute();
    });
    return files;
  }

  async getPreferences(userId: string): Promise<unknown | undefined> {
    const row = await selectAll(schema.userPreferences).where('user_id', '=', userId).executeTakeFirst();
    return fromRow<{ data: unknown }>(schema.userPreferences, row)?.data;
  }

  async setPreferences(userId: string, data: unknown) {
    const row = toRow(schema.userPreferences, { data, updatedAt: new Date() });
    try {
      await db.transaction().execute(async (trx) => {
        const updated = await trx.updateTable('user_preferences').set(row).where('user_id', '=', userId).executeTakeFirst();
        if (Number(updated.numUpdatedRows) === 0) await trx.insertInto('user_preferences').values({ ...row, user_id: userId }).execute();
      });
    } catch (error) {
      // Dois pedidos em simultâneo: o outro criou a linha primeiro; basta atualizar
      if (!isDuplicateKeyError(error)) throw error;
      await db.updateTable('user_preferences').set(row).where('user_id', '=', userId).execute();
    }
  }

  // ---------- Veículos ----------
  /** Veículos do utilizador: os seus e os partilhados com ele (com o papel e o nome do dono). */
  async getUserVehicles(userId: string): Promise<VehicleAccess[]> {
    const vehicles = fromRows<Vehicle>(schema.vehicles, await selectAll(schema.vehicles).where('id', 'in', userVehicleIds(userId)).execute());
    return this.withAccess(userId, vehicles);
  }

  /** Só os veículos de que é dono (limite do plano, eliminação de conta). */
  async getOwnedVehicles(userId: string): Promise<Vehicle[]> {
    return fromRows<Vehicle>(schema.vehicles, await selectAll(schema.vehicles).where('user_id', '=', userId).execute());
  }

  /** Devolve o veículo só se o utilizador lhe tiver acesso (dono ou condutor). */
  async getUserVehicle(userId: string, vehicleId: string): Promise<VehicleAccess | undefined> {
    const vehicle = fromRow<Vehicle>(schema.vehicles, await selectAll(schema.vehicles)
      .where('id', '=', vehicleId).where('id', 'in', userVehicleIds(userId)).executeTakeFirst());
    return vehicle && (await this.withAccess(userId, [vehicle]))[0];
  }

  private async withAccess(userId: string, vehicles: Vehicle[]): Promise<VehicleAccess[]> {
    const shared = vehicles.filter((v) => v.userId !== userId);
    const owners = shared.length
      ? await db.selectFrom('users').select(['id', 'first_name', 'last_name', 'email']).where('id', 'in', [...new Set(shared.map((v) => v.userId))]).execute()
      : [];
    return vehicles.map((v) => v.userId === userId
      ? { ...v, role: 'owner' as const }
      : { ...v, role: 'driver' as const, ownerName: displayName(owners.find((o) => o.id === v.userId)) });
  }

  async createVehicle(vehicle: Omit<NewVehicle, 'id'>): Promise<Vehicle> {
    if (vehicle.imageUrl) return insert<Vehicle>(schema.vehicles, vehicle);
    const image = await getVehicleImage(vehicle);
    return insert<Vehicle>(schema.vehicles, { ...vehicle, imageUrl: image?.url ?? null, imageCredit: image?.credit ?? null, imageCreditUrl: image?.creditUrl ?? null });
  }

  async updateVehicle(id: string, data: Partial<NewVehicle>): Promise<Vehicle> {
    await update(schema.vehicles, id, data);
    return (await byId<Vehicle>(schema.vehicles, id))!;
  }

  /** Ficheiros do veículo em uploads/ (documentos, recibos e foto própria). */
  async vehicleFiles(vehicle: Vehicle): Promise<string[]> {
    const [docs, receipts] = await Promise.all([
      db.selectFrom('documents').select('file_url').where('vehicle_id', '=', vehicle.id).execute(),
      db.selectFrom('expense_records').select('receipt_url').where('vehicle_id', '=', vehicle.id).where('receipt_url', 'is not', null).execute(),
    ]);
    const urls = [...docs.map((d) => d.file_url), ...receipts.map((r) => r.receipt_url), vehicle.imageUrl];
    return urls.filter((u): u is string => typeof u === 'string' && u.startsWith('/uploads/'));
  }

  /** Quantos veículos usam esta foto (as sugestões podem repetir-se; a foto própria só se apaga se ninguém a usar). */
  async photoUsage(imageUrl: string): Promise<number> {
    const rows = await db.selectFrom('vehicles').select('id').where('image_url', '=', imageUrl).execute();
    return rows.length;
  }

  async deleteVehicle(id: string) {
    await db.transaction().execute(async (trx) => {
      for (const table of VEHICLE_CHILDREN) {
        await trx.deleteFrom(tableName(table)).where('vehicle_id', '=', id).execute();
      }
      await trx.deleteFrom('vehicles').where('id', '=', id).execute();
    });
  }

  // ---------- Manutenção ----------
  async getMaintenanceRecords(vehicleId: string) {
    return fromRows<MaintenanceRecord>(schema.maintenanceRecords, await selectAll(schema.maintenanceRecords)
      .where('vehicle_id', '=', vehicleId).orderBy('performed_at', 'desc').execute());
  }

  createMaintenanceRecord(record: Omit<NewMaintenanceRecord, 'id'>) {
    return insert<MaintenanceRecord>(schema.maintenanceRecords, record);
  }

  async getMaintenanceAppointments(vehicleId: string) {
    return fromRows<MaintenanceAppointment>(schema.maintenanceAppointments, await selectAll(schema.maintenanceAppointments)
      .where('vehicle_id', '=', vehicleId).orderBy('scheduled_date', 'desc').execute());
  }

  createMaintenanceAppointment(appointment: Omit<NewMaintenanceAppointment, 'id'>) {
    return insert<MaintenanceAppointment>(schema.maintenanceAppointments, appointment);
  }

  async getUserAppointments(userId: string) {
    return fromRows<MaintenanceAppointment>(schema.maintenanceAppointments, await selectAll(schema.maintenanceAppointments)
      .where('user_id', '=', userId).orderBy('scheduled_date', 'asc').execute());
  }

  /** Últimas manutenções de todos os veículos do utilizador. */
  async getUserMaintenance(userId: string, limit: number) {
    return fromRows<MaintenanceRecord>(schema.maintenanceRecords, await limitRows(selectAll(schema.maintenanceRecords)
      .where('vehicle_id', 'in', userVehicleIds(userId)).orderBy('performed_at', 'desc'), limit).execute());
  }

  /** Devolve undefined se a marcação não existir ou não for do utilizador. */
  async updateMaintenanceAppointment(id: string, userId: string, data: Partial<NewMaintenanceAppointment>) {
    const existing = await selectAll(schema.maintenanceAppointments).where('id', '=', id).where('user_id', '=', userId).executeTakeFirst();
    if (!existing) return undefined;
    await update(schema.maintenanceAppointments, id, data);
    return byId<MaintenanceAppointment>(schema.maintenanceAppointments, id);
  }

  async deleteMaintenanceAppointment(id: string, userId: string): Promise<boolean> {
    const r = await db.deleteFrom('maintenance_appointments').where('id', '=', id).where('user_id', '=', userId).executeTakeFirst();
    return Number(r.numDeletedRows) > 0;
  }

  // ---------- Reservas de carregamento ----------
  async getChargingStationReservations(vehicleId: string) {
    return fromRows<ChargingStationReservation>(schema.chargingStationReservations, await selectAll(schema.chargingStationReservations)
      .where('vehicle_id', '=', vehicleId).orderBy('reservation_date', 'desc').execute());
  }

  createChargingStationReservation(reservation: Omit<NewChargingStationReservation, 'id'>) {
    return insert<ChargingStationReservation>(schema.chargingStationReservations, reservation);
  }

  async getUserReservations(userId: string) {
    return fromRows<ChargingStationReservation>(schema.chargingStationReservations, await selectAll(schema.chargingStationReservations)
      .where('user_id', '=', userId).orderBy('reservation_date', 'asc').execute());
  }

  async updateChargingStationReservation(id: string, userId: string, data: Partial<NewChargingStationReservation>) {
    const existing = await selectAll(schema.chargingStationReservations).where('id', '=', id).where('user_id', '=', userId).executeTakeFirst();
    if (!existing) return undefined;
    await update(schema.chargingStationReservations, id, data);
    return byId<ChargingStationReservation>(schema.chargingStationReservations, id);
  }

  async deleteChargingStationReservation(id: string, userId: string): Promise<boolean> {
    const r = await db.deleteFrom('charging_station_reservations').where('id', '=', id).where('user_id', '=', userId).executeTakeFirst();
    return Number(r.numDeletedRows) > 0;
  }

  // ---------- Alertas ----------
  async getUserAlerts(userId: string) {
    return fromRows<Alert>(schema.alerts, await selectAll(schema.alerts)
      .where('vehicle_id', 'in', userVehicleIds(userId)).where('is_dismissed', '=', false)
      // adiados ('Lembrar mais tarde') só voltam depois da data
      .where((eb) => eb.or([eb('snoozed_until', 'is', null), eb('snoozed_until', '<=', new Date())]))
      .orderBy('created_at', 'desc').execute());
  }

  /**
   * Alertas gerados a partir dos dados de cada veículo (óleo e pneus por km; inspeção, IUC e seguro por data).
   * O id é estável por prazo, por isso um alerta descartado continua descartado até o prazo mudar.
   * ponytail: corre em cada pedido de alertas/estatísticas; passar para uma tarefa periódica se houver muitos veículos
   */
  async syncAlerts(userId: string) {
    const vehicles = await this.getUserVehicles(userId);
    const wanted = new Map<string, Values>();
    for (const v of vehicles) {
      for (const item of dueItems(v)) {
        wanted.set(alertId(v.id, item), {
          vehicleId: v.id, type: item.kind, title: item.title, description: item.description,
          dueDate: item.dueDate, dueMileage: item.dueMileage, priority: item.urgency,
        });
      }
    }
    const existing = new Set((await db.selectFrom('alerts').select('id').where('vehicle_id', 'in', userVehicleIds(userId)).execute()).map((r) => r.id as string));
    const stale = [...existing].filter((id) => !wanted.has(id));
    if (stale.length) await db.deleteFrom('alerts').where('id', 'in', stale).execute();
    for (const [id, alert] of wanted) {
      if (existing.has(id)) {
        // o texto muda com o tempo ("em 9 dias" -> "em 8 dias"); lido/descartado mantém-se
        await db.updateTable('alerts').set(toRow(schema.alerts, { title: alert.title, description: alert.description, priority: alert.priority })).where('id', '=', id).execute();
      } else {
        try {
          await db.insertInto('alerts').values(toRow(schema.alerts, withDefaults(schema.alerts, { ...alert, id }))).execute();
        } catch (error) {
          if (!isDuplicateKeyError(error)) throw error; // outro pedido em paralelo já o criou
        }
      }
    }
  }

  async updateUserAlert(id: string, userId: string, data: { isRead?: boolean; isDismissed?: boolean }): Promise<boolean> {
    const r = await db.updateTable('alerts').set(toRow(schema.alerts, data))
      .where('id', '=', id).where('vehicle_id', 'in', userVehicleIds(userId)).executeTakeFirst();
    return Number(r.numUpdatedRows) > 0;
  }

  // ---------- Combustível ----------
  async getFuelRecords(vehicleId: string) {
    return fromRows<FuelRecord>(schema.fuelRecords, await selectAll(schema.fuelRecords)
      .where('vehicle_id', '=', vehicleId).orderBy('date', 'desc').execute());
  }

  async getUserFuelRecords(userId: string) {
    return fromRows<FuelRecord>(schema.fuelRecords, await selectAll(schema.fuelRecords)
      .where('vehicle_id', 'in', userVehicleIds(userId)).orderBy('date', 'desc').execute());
  }

  /** Registo só se pertencer a um veículo do utilizador. */
  async getUserFuelRecord(id: string, userId: string) {
    return fromRow<FuelRecord>(schema.fuelRecords, await selectAll(schema.fuelRecords)
      .where('id', '=', id).where('vehicle_id', 'in', userVehicleIds(userId)).executeTakeFirst());
  }

  createFuelRecord(record: Omit<NewFuelRecord, 'id'>) {
    return insert<FuelRecord>(schema.fuelRecords, record);
  }

  async updateFuelRecord(id: string, data: Partial<NewFuelRecord>) {
    await update(schema.fuelRecords, id, data);
    return byId<FuelRecord>(schema.fuelRecords, id);
  }

  async deleteFuelRecord(id: string) {
    await remove(schema.fuelRecords, id);
  }

  // ---------- Despesas ----------
  async getUserExpenses(userId: string) {
    return fromRows<ExpenseRecord>(schema.expenseRecords, await selectAll(schema.expenseRecords)
      .where('vehicle_id', 'in', userVehicleIds(userId)).orderBy('date', 'desc').execute());
  }

  async getVehicleExpenses(vehicleId: string) {
    return fromRows<ExpenseRecord>(schema.expenseRecords, await selectAll(schema.expenseRecords)
      .where('vehicle_id', '=', vehicleId).orderBy('date', 'desc').execute());
  }

  createExpense(expense: Omit<NewExpenseRecord, 'id'>) {
    return insert<ExpenseRecord>(schema.expenseRecords, expense);
  }

  // ---------- Documentos ----------
  async getVehicleDocuments(vehicleId: string) {
    return fromRows<Document>(schema.documents, await selectAll(schema.documents).where('vehicle_id', '=', vehicleId).execute());
  }

  async getUserDocument(id: string, userId: string) {
    return fromRow<Document>(schema.documents, await selectAll(schema.documents)
      .where('id', '=', id).where('vehicle_id', 'in', userVehicleIds(userId)).executeTakeFirst());
  }

  createDocument(document: Omit<NewDocument, 'id'>) {
    return insert<Document>(schema.documents, document);
  }

  /** Ficheiro antigo (sem prefixo do utilizador): procura-o nos documentos e recibos do utilizador. */
  async userOwnsUpload(userId: string, fileName: string): Promise<boolean> {
    const url = `/uploads/${fileName}`;
    const doc = await db.selectFrom('documents').select('id')
      .where('file_url', '=', url).where('vehicle_id', 'in', userVehicleIds(userId)).executeTakeFirst();
    if (doc) return true;
    const receipt = await db.selectFrom('expense_records').select('id')
      .where('receipt_url', '=', url).where('vehicle_id', 'in', userVehicleIds(userId)).executeTakeFirst();
    return !!receipt;
  }

  async deleteDocument(id: string) {
    await remove(schema.documents, id);
  }

  // ---------- Viagens (quilometragem) ----------
  async getUserMileageTrips(userId: string, vehicleId?: string, status?: string) {
    let query = selectAll(schema.mileageTrips).where('vehicle_id', 'in', userVehicleIds(userId));
    if (vehicleId) query = query.where('vehicle_id', '=', vehicleId);
    if (status) query = query.where('status', '=', status);
    return fromRows<MileageTrip>(schema.mileageTrips, await query.orderBy('created_at', 'desc').execute());
  }

  async getUserMileageTrip(id: string, userId: string) {
    return fromRow<MileageTrip>(schema.mileageTrips, await selectAll(schema.mileageTrips)
      .where('id', '=', id).where('vehicle_id', 'in', userVehicleIds(userId)).executeTakeFirst());
  }

  createMileageTrip(trip: Omit<NewMileageTrip, 'id'>) {
    return insert<MileageTrip>(schema.mileageTrips, trip);
  }

  async updateMileageTrip(id: string, data: Partial<NewMileageTrip>) {
    await update(schema.mileageTrips, id, data);
    return byId<MileageTrip>(schema.mileageTrips, id);
  }

  async deleteMileageTrip(id: string) {
    await remove(schema.mileageTrips, id);
  }

  // ---------- Planos de rota ----------
  async getRoutePlans(userId: string) {
    type Plan = { id: string; userId: string; vehicleId: string; data: object; createdAt: Date; updatedAt: Date };
    const rows = fromRows<Plan>(schema.routePlans, await selectAll(schema.routePlans).where('user_id', '=', userId).orderBy('created_at', 'desc').execute());
    return rows.map((r) => ({ ...r.data, id: r.id, userId: r.userId, vehicleId: r.vehicleId, createdAt: r.createdAt, updatedAt: r.updatedAt }));
  }

  async createRoutePlan(userId: string, vehicleId: string, data: object): Promise<string> {
    const plan = await insert<{ id: string }>(schema.routePlans, { userId, vehicleId, data });
    return plan.id;
  }

  async updateRoutePlan(id: string, userId: string, data: object): Promise<boolean> {
    const existing = fromRow<{ data: object }>(schema.routePlans, await selectAll(schema.routePlans)
      .where('id', '=', id).where('user_id', '=', userId).executeTakeFirst());
    if (!existing) return false;
    await update(schema.routePlans, id, { data: { ...existing.data, ...data } });
    return true;
  }

  async deleteRoutePlan(id: string, userId: string): Promise<boolean> {
    const r = await db.deleteFrom('route_plans').where('id', '=', id).where('user_id', '=', userId).executeTakeFirst();
    return Number(r.numDeletedRows) > 0;
  }

  // ---------- Comparações ----------
  private async vehicleStats(vehicleId: string) {
    const [fuel, expenses] = await Promise.all([this.getFuelRecords(vehicleId), this.getVehicleExpenses(vehicleId)]);
    return { consumption: consumptionL100(fuel), monthly: monthlyExpenses(expenses) };
  }

  /** Compara o veículo com os veículos da mesma marca/modelo de todos os utilizadores (só médias agregadas). */
  async getVehicleComparison(vehicle: Vehicle) {
    // ponytail: estatísticas veículo a veículo; passar para uma agregação SQL se houver milhares de veículos iguais
    const similar = await limitRows(db.selectFrom('vehicles').select('id')
      .where(sql`lower(brand)`, '=', vehicle.brand.toLowerCase())
      .where(sql`lower(model)`, '=', vehicle.model.toLowerCase())
      .where('id', '!=', vehicle.id), 200).execute();
    const mine = { id: vehicle.id, ...(await this.vehicleStats(vehicle.id)) };
    // Com poucos veículos iguais, as médias revelariam os dados de outras pessoas: não se calculam
    const enough = similar.length >= MIN_COMPARISON_GROUP;
    const others = enough ? await Promise.all(similar.map(async (s) => ({ id: s.id as string, ...(await this.vehicleStats(s.id as string)) }))) : [];
    const stats = [mine, ...others];
    const withConsumption = stats.filter((s) => s.consumption != null);
    const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 100) / 100 : undefined);

    const averageConsumption = enough ? avg(withConsumption.map((s) => s.consumption!)) : undefined;
    const averageExpenses = enough ? avg(stats.map((s) => s.monthly)) : undefined;
    const recommendations: string[] = [];
    if (mine.consumption != null && averageConsumption != null && mine.consumption > averageConsumption * 1.1) {
      recommendations.push('O consumo está mais de 10% acima da média de veículos iguais: verifique pneus, filtros e estilo de condução.');
    }
    if (averageExpenses != null && mine.monthly > averageExpenses * 1.2) {
      recommendations.push('As despesas mensais estão acima da média de veículos iguais.');
    }
    if (mine.consumption == null) {
      recommendations.push('Registe pelo menos dois abastecimentos para calcular o consumo.');
    }

    return {
      vehicleId: vehicle.id,
      userConsumption: mine.consumption ?? undefined,
      averageConsumption,
      userExpenses: mine.monthly,
      averageExpenses,
      rankingPosition: enough && mine.consumption != null
        ? withConsumption.filter((s) => s.consumption! < mine.consumption!).length + 1
        : undefined,
      totalSimilarVehicles: similar.length,
      recommendations,
    };
  }

  async getFleetComparison(userId: string) {
    const vehicles = await this.getUserVehicles(userId);
    const stats = await Promise.all(vehicles.map(async (v) => ({ v, ...(await this.vehicleStats(v.id)) })));
    const withConsumption = stats.filter((s) => s.consumption != null);
    const efficient = [...withConsumption].sort((a, b) => a.consumption! - b.consumption!)[0];
    const expensive = [...stats].sort((a, b) => b.monthly - a.monthly)[0];
    const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

    return {
      userId,
      totalVehicles: vehicles.length,
      averageFuelConsumption: withConsumption.length
        ? Math.round((sum(withConsumption.map((s) => s.consumption!)) / withConsumption.length) * 10) / 10
        : undefined,
      totalMonthlyExpenses: Math.round(sum(stats.map((s) => s.monthly)) * 100) / 100,
      mostEfficientVehicle: efficient
        ? { id: efficient.v.id, brand: efficient.v.brand, model: efficient.v.model, consumption: efficient.consumption! }
        : null,
      mostExpensiveVehicle: expensive && expensive.monthly > 0
        ? { id: expensive.v.id, brand: expensive.v.brand, model: expensive.v.model, monthlyExpenses: expensive.monthly }
        : null,
    };
  }

  // ---------- Alertas: adiar e concluir ----------
  async getUserAlert(id: string, userId: string): Promise<Alert | undefined> {
    return fromRow<Alert>(schema.alerts, await selectAll(schema.alerts)
      .where('id', '=', id).where('vehicle_id', 'in', userVehicleIds(userId)).executeTakeFirst());
  }

  async snoozeAlert(id: string, until: Date) {
    await db.updateTable('alerts').set(toRow(schema.alerts, { snoozedUntil: until })).where('id', '=', id).execute();
  }

  // ---------- Partilha de veículos ----------
  async listMembers(vehicleId: string) {
    const rows = await db.selectFrom('vehicle_members')
      .leftJoin('users', 'users.id', 'vehicle_members.user_id')
      .select(['vehicle_members.id', 'vehicle_members.email', 'vehicle_members.status', 'vehicle_members.role', 'vehicle_members.created_at', 'users.first_name', 'users.last_name'])
      .where('vehicle_members.vehicle_id', '=', vehicleId).execute();
    return rows.map((r) => ({
      id: r.id as string, email: r.email as string, status: r.status as string, role: r.role as string,
      createdAt: new Date(r.created_at), userName: [r.first_name, r.last_name].filter(Boolean).join(' ') || undefined,
    }));
  }

  /** Cria (ou renova) o convite para um email. Devolve o id do membro. */
  async upsertInvite(vehicleId: string, email: string, invitedBy: string, tokenHash: string): Promise<string> {
    const existing = await db.selectFrom('vehicle_members').select(['id', 'status']).where('vehicle_id', '=', vehicleId).where('email', '=', email).executeTakeFirst();
    if (existing) {
      if (existing.status === 'active') throw new Error('ALREADY_MEMBER');
      await db.updateTable('vehicle_members').set({ invite_token_hash: tokenHash }).where('id', '=', existing.id).execute();
      return existing.id as string;
    }
    const id = randomUUID();
    await db.insertInto('vehicle_members').values(toRow(schema.vehicleMembers, withDefaults(schema.vehicleMembers, {
      id, vehicleId, email, invitedBy, inviteTokenHash: tokenHash,
    }))).execute();
    return id;
  }

  async findInvite(tokenHash: string) {
    const row = await db.selectFrom('vehicle_members').selectAll().where('invite_token_hash', '=', tokenHash).where('status', '=', 'pending').executeTakeFirst();
    if (!row) return undefined;
    const vehicle = await byId<Vehicle>(schema.vehicles, row.vehicle_id as string);
    const inviter = await db.selectFrom('users').select(['first_name', 'last_name', 'email']).where('id', '=', row.invited_by).executeTakeFirst();
    return vehicle && { memberId: row.id as string, vehicle, invitedBy: displayName(inviter) ?? '' };
  }

  async acceptInvite(memberId: string, userId: string) {
    await db.updateTable('vehicle_members').set({ user_id: userId, status: 'active', invite_token_hash: null }).where('id', '=', memberId).execute();
  }

  async removeMember(vehicleId: string, memberId: string): Promise<boolean> {
    const r = await db.deleteFrom('vehicle_members').where('id', '=', memberId).where('vehicle_id', '=', vehicleId).executeTakeFirst();
    return Number(r.numDeletedRows) > 0;
  }

  async findMembership(vehicleId: string, userId: string) {
    return db.selectFrom('vehicle_members').select('id').where('vehicle_id', '=', vehicleId).where('user_id', '=', userId).executeTakeFirst();
  }

  // ---------- Push ----------
  async addPushSubscription(userId: string, sub: { endpoint: string; p256dh: string; auth: string }) {
    await db.deleteFrom('push_subscriptions').where('endpoint', '=', sub.endpoint).execute();
    await insert(schema.pushSubscriptions, { userId, ...sub });
  }

  async removePushSubscription(userId: string, endpoint: string) {
    await db.deleteFrom('push_subscriptions').where('user_id', '=', userId).where('endpoint', '=', endpoint).execute();
  }

  async getPushSubscriptions(userId: string) {
    return fromRows<{ id: string; endpoint: string; p256dh: string; auth: string }>(schema.pushSubscriptions,
      await selectAll(schema.pushSubscriptions).where('user_id', '=', userId).execute());
  }

  async deletePushSubscriptionById(id: string) {
    await db.deleteFrom('push_subscriptions').where('id', '=', id).execute();
  }

  // ---------- Registo de notificações ----------
  /** Reserva o envio (id determinístico). Devolve false se já foi enviado (por este ou outro processo). */
  async claimNotification(id: string, userId: string, alertId: string | null, channel: string, stage: string): Promise<boolean> {
    try {
      await db.insertInto('notification_log').values(toRow(schema.notificationLog, withDefaults(schema.notificationLog, { id, userId, alertId, channel, stage }))).execute();
      return true;
    } catch (error) {
      if (isDuplicateKeyError(error)) return false;
      throw error;
    }
  }

  async releaseNotification(id: string) {
    await db.deleteFrom('notification_log').where('id', '=', id).execute();
  }

  /** Utilizadores a considerar na tarefa diária de notificações. */
  async getNotifiableUsers() {
    const rows = await db.selectFrom('users').select(['id', 'email', 'first_name', 'email_verified_at', 'plan', 'plan_expires_at']).execute();
    return rows.map((r) => ({
      id: r.id as string, email: r.email as string | null, firstName: r.first_name as string | null,
      emailVerified: Boolean(r.email_verified_at), plan: r.plan as string | null, planExpiresAt: r.plan_expires_at as Date | string | null,
    }));
  }

  // ---------- Feedback e métricas ----------
  async addFeedback(userId: string | null, message: string, page: string | null) {
    await insert(schema.feedback, { userId, message, page });
  }

  async trackEvent(userId: string | null, name: string) {
    await insert(schema.productEvents, { userId, name }).catch(() => {});
  }

  async adminMetrics() {
    const now = Date.now();
    const users = await db.selectFrom('users').select(['id', 'email_verified_at', 'created_at']).execute();
    const owners = new Set((await db.selectFrom('vehicles').select('user_id').execute()).map((r) => r.user_id as string));
    const prefs = fromRows<{ userId: string; data: any }>(schema.userPreferences, await selectAll(schema.userPreferences).execute());
    const pushUsers = new Set((await db.selectFrom('push_subscriptions').select('user_id').execute()).map((r) => r.user_id as string));
    const withReminders = users.filter((u) => owners.has(u.id as string) && (pushUsers.has(u.id as string)
      || (u.email_verified_at && prefs.find((p) => p.userId === u.id)?.data?.notificationPreferences?.email !== false))).length;
    const events = await db.selectFrom('product_events').select(['user_id', 'name', 'created_at']).execute();
    const activeSince = (ms: number) => new Set(events.filter((e) => now - new Date(e.created_at).getTime() < ms && e.user_id).map((e) => e.user_id)).size;
    // Retenção a 30 dias: registados há 30-60 dias que voltaram (login) nos últimos 30
    const cohort = users.filter((u) => { const age = now - new Date(u.created_at).getTime(); return age >= 30 * 86_400_000 && age < 60 * 86_400_000; });
    const recentLogins = new Set(events.filter((e) => e.name === 'login' && now - new Date(e.created_at).getTime() < 30 * 86_400_000).map((e) => e.user_id));
    const counts: Record<string, number> = {};
    for (const e of events) counts[e.name as string] = (counts[e.name as string] ?? 0) + 1;
    const feedbackRows = await limitRows(db.selectFrom('feedback').leftJoin('users', 'users.id', 'feedback.user_id')
      .select(['feedback.id', 'feedback.message', 'feedback.page', 'feedback.created_at', 'users.email']).orderBy('feedback.created_at', 'desc'), 50).execute();
    return {
      users: users.length,
      verifiedUsers: users.filter((u) => u.email_verified_at).length,
      activeUsers7d: activeSince(7 * 86_400_000),
      activation: { registered: users.length, withVehicle: users.filter((u) => owners.has(u.id as string)).length, withReminders },
      retentionD30: { cohort: cohort.length, retained: cohort.filter((u) => recentLogins.has(u.id)).length },
      events: counts,
      feedback: feedbackRows.map((f) => ({ id: f.id, message: f.message, page: f.page, createdAt: new Date(f.created_at), email: f.email ?? null })),
    };
  }

  // ---------- Exportação de dados (RGPD, art. 20.º) ----------
  async exportUserData(userId: string) {
    const user = await this.getUser(userId);
    const vehicles = await this.getOwnedVehicles(userId);
    const perVehicle = await Promise.all(vehicles.map(async (v) => ({
      vehicle: v,
      maintenance: await this.getMaintenanceRecords(v.id),
      appointments: await this.getMaintenanceAppointments(v.id),
      fuelRecords: await this.getFuelRecords(v.id),
      expenses: await this.getVehicleExpenses(v.id),
      documents: await this.getVehicleDocuments(v.id),
      mileageTrips: await this.getUserMileageTrips(userId, v.id),
      members: await this.listMembers(v.id),
    })));
    const { totpSecret: _t, calendarToken: _c, ...safeUser } = (user ?? {}) as Record<string, unknown>;
    return {
      exportedAt: new Date().toISOString(),
      user: safeUser,
      preferences: await this.getPreferences(userId) ?? null,
      vehicles: perVehicle,
      sharedWithMe: (await this.getUserVehicles(userId)).filter((v) => v.role === 'driver').map((v) => ({ id: v.id, brand: v.brand, model: v.model, licensePlate: v.licensePlate })),
      routePlans: await this.getRoutePlans(userId),
      chargingReservations: await this.getUserReservations(userId),
      notificationsSent: await db.selectFrom('notification_log').select(['channel', 'stage', 'sent_at']).where('user_id', '=', userId).execute(),
    };
  }

  /** Dados do livro de revisões (relatório do veículo). */
  async vehicleReport(vehicle: Vehicle) {
    const [maintenance, fuel, expenses, documents, trips, owner] = await Promise.all([
      this.getMaintenanceRecords(vehicle.id), this.getFuelRecords(vehicle.id), this.getVehicleExpenses(vehicle.id),
      this.getVehicleDocuments(vehicle.id), this.getUserMileageTrips(vehicle.userId, vehicle.id),
      db.selectFrom('users').select(['first_name', 'last_name', 'email']).where('id', '=', vehicle.userId).executeTakeFirst(),
    ]);
    const sum = (xs: (string | number | null | undefined)[]) => Math.round(xs.reduce<number>((a, b) => a + Number(b ?? 0), 0) * 100) / 100;
    return {
      vehicle,
      owner: { name: displayName(owner) ?? '' },
      maintenance, fuel, expenses,
      documents: documents.map((d) => ({ type: d.type, description: d.description, uploadDate: d.uploadDate })),
      totals: {
        maintenanceCost: sum(maintenance.map((m) => m.cost)),
        fuelCost: sum(fuel.map((f) => f.totalCost)),
        fuelLiters: sum(fuel.map((f) => f.liters)),
        expenses: sum(expenses.map((e) => e.amount)),
        consumptionL100: consumptionL100(fuel),
        kmTracked: trips.reduce((a, t) => a + (t.totalDistance ?? 0), 0),
      },
      generatedAt: new Date().toISOString(),
    };
  }

  // ---------- Conta: campos auxiliares ----------
  async setUserFields(userId: string, data: Partial<User>) {
    await update(schema.users, userId, data);
  }

  async findUserByCalendarToken(token: string): Promise<User | undefined> {
    if (!token) return undefined;
    return fromRow<User>(schema.users, await selectAll(schema.users).where('calendar_token', '=', token).executeTakeFirst());
  }

  async findUserByStripeCustomer(customerId: string): Promise<User | undefined> {
    return fromRow<User>(schema.users, await selectAll(schema.users).where('stripe_customer_id', '=', customerId).executeTakeFirst());
  }
}

export const storage = new Storage();
