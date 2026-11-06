import { randomUUID } from 'crypto';
import type { Table } from 'drizzle-orm';
import { getTableColumns } from 'drizzle-orm';
import * as schema from '@shared/schema';
import type {
  User, NewUser, Vehicle, NewVehicle, MaintenanceRecord, NewMaintenanceRecord, Alert, FuelRecord, NewFuelRecord,
  MileageTrip, NewMileageTrip, ExpenseRecord, NewExpenseRecord, Document, NewDocument,
  MaintenanceAppointment, NewMaintenanceAppointment, ChargingStationReservation, NewChargingStationReservation,
} from '@shared/schema';
import { db, tableName, toRow, fromRow, fromRows, withDefaults } from './db';
import { getVehicleImage } from './services/unsplash';
import { consumptionL100, monthlyExpenses } from './stats';

/** Utilizador sem o hash da password: é o único formato que sai para o cliente. */
export type PublicUser = Omit<User, 'password'>;
export function toPublicUser(user: User): PublicUser {
  const { password: _password, ...rest } = user;
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

const remove = (table: Table, id: string) => db.deleteFrom(tableName(table)).where('id', '=', id).execute();

// Subconsulta: ids dos veículos de um utilizador
const userVehicleIds = (userId: string) => db.selectFrom('vehicles').select('id').where('user_id', '=', userId);

// Tabelas com dados de um veículo (apagadas com ele; não há chaves estrangeiras para ser igual em todos os motores)
const VEHICLE_CHILDREN = [
  schema.maintenanceRecords, schema.maintenanceAppointments, schema.alerts, schema.fuelRecords, schema.expenseRecords,
  schema.documents, schema.mileageTrips, schema.tripRecords, schema.vehicleSpecs, schema.chargingStationReservations, schema.routePlans,
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

  async getPreferences(userId: string): Promise<unknown | undefined> {
    const row = await selectAll(schema.userPreferences).where('user_id', '=', userId).executeTakeFirst();
    return fromRow<{ data: unknown }>(schema.userPreferences, row)?.data;
  }

  async setPreferences(userId: string, data: unknown) {
    const row = toRow(schema.userPreferences, { data, updatedAt: new Date() });
    const updated = await db.updateTable('user_preferences').set(row).where('user_id', '=', userId).executeTakeFirst();
    if (Number(updated.numUpdatedRows) === 0) {
      await db.insertInto('user_preferences').values({ ...row, user_id: userId }).execute();
    }
  }

  // ---------- Veículos ----------
  async getUserVehicles(userId: string): Promise<Vehicle[]> {
    return fromRows<Vehicle>(schema.vehicles, await selectAll(schema.vehicles).where('user_id', '=', userId).execute());
  }

  /** Devolve o veículo só se pertencer ao utilizador. */
  async getUserVehicle(userId: string, vehicleId: string): Promise<Vehicle | undefined> {
    return fromRow<Vehicle>(schema.vehicles, await selectAll(schema.vehicles)
      .where('id', '=', vehicleId).where('user_id', '=', userId).executeTakeFirst());
  }

  async createVehicle(vehicle: Omit<NewVehicle, 'id'>): Promise<Vehicle> {
    const imageUrl = vehicle.imageUrl || await getVehicleImage(`${vehicle.brand} ${vehicle.model}`);
    return insert<Vehicle>(schema.vehicles, { ...vehicle, imageUrl });
  }

  async updateVehicle(id: string, data: Partial<NewVehicle>): Promise<Vehicle> {
    await update(schema.vehicles, id, data);
    return (await byId<Vehicle>(schema.vehicles, id))!;
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
      .orderBy('created_at', 'desc').execute());
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
  async getUserMileageTrips(userId: string, vehicleId?: string) {
    let query = selectAll(schema.mileageTrips).where('vehicle_id', 'in', userVehicleIds(userId));
    if (vehicleId) query = query.where('vehicle_id', '=', vehicleId);
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
    const similar = await db.selectFrom('vehicles').select('id')
      .where('brand', '=', vehicle.brand).where('model', '=', vehicle.model).execute();
    const stats = await Promise.all(similar.map(async (s) => ({ id: s.id as string, ...(await this.vehicleStats(s.id)) })));
    const mine = stats.find((s) => s.id === vehicle.id) ?? { consumption: null, monthly: 0 };
    const withConsumption = stats.filter((s) => s.consumption != null);
    const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 100) / 100 : undefined);

    const averageConsumption = avg(withConsumption.map((s) => s.consumption!));
    const averageExpenses = avg(stats.map((s) => s.monthly));
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
      rankingPosition: mine.consumption != null
        ? withConsumption.filter((s) => s.consumption! < mine.consumption!).length + 1
        : undefined,
      totalSimilarVehicles: stats.length,
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
}

export const storage = new Storage();
