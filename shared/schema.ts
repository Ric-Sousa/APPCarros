import { mysqlTable, varchar, int, timestamp, text, decimal, boolean, datetime, json, unique } from "drizzle-orm/mysql-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { FUEL_CODES, normalizeFuelType } from "./fuel";

// Users table
export const users = mysqlTable("users", {
  id: varchar("id", { length: 255 }).primaryKey(),
  email: varchar("email", { length: 255 }).unique(),
  password: varchar("password", { length: 255 }),
  firstName: varchar("first_name", { length: 100 }),
  lastName: varchar("last_name", { length: 100 }),
  phone: varchar("phone", { length: 20 }),
  address: text("address"),
  bio: text("bio"),
  profileImageUrl: text("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
});

// Vehicles table
export const vehicles = mysqlTable("vehicles", {

  id: varchar("id", { length: 255 }).primaryKey(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  licensePlate: varchar("license_plate", { length: 20 }).notNull(),
  brand: varchar("brand", { length: 100 }).notNull(),
  model: varchar("model", { length: 100 }).notNull(),
  year: int("year").notNull(),
  registrationDate: datetime("registration_date"),
  imageUrl: text("image_url"),
  // Crédito obrigatório das fotos automáticas (Wikimedia Commons / Unsplash)
  imageCredit: text("image_credit"),
  imageCreditUrl: text("image_credit_url"),
  fuelType: varchar("fuel_type", { length: 50 }),
  currentMileage: int("current_mileage").notNull(),
  
  // InformAtrículas data
  originalColor: varchar("original_color", { length: 50 }),
  origin: varchar("origin", { length: 100 }),
  registrationLocation: varchar("registration_location", { length: 100 }),
  iucCategory: varchar("iuc_category", { length: 100 }),
  powerCV: int("power_cv"),
  powerKW: int("power_kw"),
  engineDisplacement: int("engine_displacement"), // in cc
  certifyingEntity: varchar("certifying_entity", { length: 255 }),
  vehicleCategory: varchar("vehicle_category", { length: 100 }),
  
  // Oil information
  oilBrand: varchar("oil_brand", { length: 100 }),
  lastOilChange: datetime("last_oil_change"),
  lastOilChangeMileage: int("last_oil_change_mileage"),
  oilChangeInterval: int("oil_change_interval"),
  
  // Tire information
  tireBrand: varchar("tire_brand", { length: 100 }),
  lastTireChange: datetime("last_tire_change"),
  lastTireChangeMileage: int("last_tire_change_mileage"),
  tireChangeInterval: int("tire_change_interval"),
  
  // Important dates
  inspectionDue: datetime("inspection_due"),
  iucDue: datetime("iuc_due"),
  insuranceDue: datetime("insurance_due"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
}, (t) => [
  // A mesma matrícula pode existir em contas diferentes (por exemplo, após uma venda)
  unique("uq_vehicles_user_plate").on(t.userId, t.licensePlate),
]);

// Maintenance records table
export const maintenanceRecords = mysqlTable("maintenance_records", {
  id: varchar("id", { length: 255 }).primaryKey(),
  vehicleId: varchar("vehicle_id", { length: 255 }).notNull(),
  type: varchar("type", { length: 100 }).notNull(),
  description: text("description").notNull(),
  mileage: int("mileage"),
  cost: decimal("cost", { precision: 10, scale: 2 }),
  performedAt: datetime("performed_at").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Alerts table
export const alerts = mysqlTable("alerts", {
  id: varchar("id", { length: 255 }).primaryKey(),
  vehicleId: varchar("vehicle_id", { length: 255 }).notNull(),
  type: varchar("type", { length: 100 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  dueDate: datetime("due_date"),
  dueMileage: int("due_mileage"),
  priority: varchar("priority", { length: 20 }).notNull().default("normal"), // urgent, normal, low
  isRead: boolean("is_read").notNull().default(false),
  isDismissed: boolean("is_dismissed").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Fuel records table
export const fuelRecords = mysqlTable("fuel_records", {
  id: varchar("id", { length: 255 }).primaryKey(),
  vehicleId: varchar("vehicle_id", { length: 255 }).notNull(),
  date: datetime("date").notNull(),
  mileage: int("mileage").notNull(),
  liters: decimal("liters", { precision: 8, scale: 3 }).notNull(),
  costPerLiter: decimal("cost_per_liter", { precision: 6, scale: 3 }).notNull(),
  totalCost: decimal("total_cost", { precision: 10, scale: 2 }).notNull(),
  fuelType: varchar("fuel_type", { length: 50 }).notNull(),
  gasStationName: varchar("gas_station_name", { length: 255 }),
  gasStationLocation: varchar("gas_station_location", { length: 255 }),
  fullTank: boolean("full_tank").notNull().default(false),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Mileage trip records table (for timer-based tracking)
export const mileageTrips = mysqlTable("mileage_trips", {
  id: varchar("id", { length: 255 }).primaryKey(),
  vehicleId: varchar("vehicle_id", { length: 255 }).notNull(),
  startTime: datetime("start_time").notNull(),
  endTime: datetime("end_time"),
  duration: int("duration").notNull().default(0), // in seconds
  startMileage: int("start_mileage").notNull(),
  endMileage: int("end_mileage"),
  totalDistance: int("total_distance").notNull().default(0),
  status: varchar("status", { length: 20 }).notNull().default("active"), // active, completed, paused
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Expense records table
export const expenseRecords = mysqlTable("expense_records", {
  id: varchar("id", { length: 255 }).primaryKey(),
  vehicleId: varchar("vehicle_id", { length: 255 }).notNull(),
  type: varchar("type", { length: 100 }).notNull(), // fuel, maintenance, insurance, etc.
  category: varchar("category", { length: 100 }).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  date: datetime("date").notNull(),
  description: text("description"),
  receiptUrl: text("receipt_url"),
  vendor: varchar("vendor", { length: 255 }),
  mileage: int("mileage"),
  isBusinessExpense: boolean("is_business_expense").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Documents table
export const documents = mysqlTable("documents", {
  id: varchar("id", { length: 255 }).primaryKey(),
  vehicleId: varchar("vehicle_id", { length: 255 }).notNull(),
  type: varchar("type", { length: 100 }).notNull(), // registration, insurance, inspection, etc.
  description: varchar("description", { length: 200 }),
  fileUrl: varchar("file_url", { length: 500 }).notNull(),
  uploadDate: datetime("upload_date").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Maintenance appointments table
export const maintenanceAppointments = mysqlTable("maintenance_appointments", {
  id: varchar("id", { length: 255 }).primaryKey(),
  vehicleId: varchar("vehicle_id", { length: 255 }).notNull(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  type: varchar("type", { length: 100 }).notNull(), // oil_change, tire_change, inspection, etc.
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  scheduledDate: datetime("scheduled_date").notNull(),
  scheduledTime: varchar("scheduled_time", { length: 10 }).notNull(), // HH:MM format
  estimatedDuration: int("estimated_duration").notNull().default(60), // in minutes
  status: varchar("status", { length: 20 }).notNull().default("scheduled"), // scheduled, confirmed, in_progress, completed, cancelled
  priority: varchar("priority", { length: 20 }).notNull().default("normal"), // urgent, high, normal, low
  serviceProvider: varchar("service_provider", { length: 255 }),
  serviceLocation: text("service_location"),
  estimatedCost: decimal("estimated_cost", { precision: 10, scale: 2 }),
  actualCost: decimal("actual_cost", { precision: 10, scale: 2 }),
  mileageAtAppointment: int("mileage_at_appointment"),
  reminderSent: boolean("reminder_sent").notNull().default(false),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
});

// Charging station reservations table
export const chargingStationReservations = mysqlTable("charging_station_reservations", {
  id: varchar("id", { length: 255 }).primaryKey(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  vehicleId: varchar("vehicle_id", { length: 255 }).notNull(),
  stationId: varchar("station_id", { length: 255 }).notNull(),
  stationName: varchar("station_name", { length: 255 }).notNull(),
  stationAddress: text("station_address").notNull(),
  reservationDate: datetime("reservation_date").notNull(),
  startTime: varchar("start_time", { length: 10 }).notNull(), // HH:MM format
  endTime: varchar("end_time", { length: 10 }).notNull(), // HH:MM format
  estimatedChargingTime: int("estimated_charging_time").notNull(), // in minutes
  chargingType: varchar("charging_type", { length: 50 }).notNull(), // fast, normal, slow
  connectorType: varchar("connector_type", { length: 50 }), // Type2, CCS, CHAdeMO
  status: varchar("status", { length: 20 }).notNull().default("reserved"), // reserved, confirmed, in_use, completed, cancelled
  estimatedCost: decimal("estimated_cost", { precision: 10, scale: 2 }),
  actualCost: decimal("actual_cost", { precision: 10, scale: 2 }),
  batteryLevelStart: int("battery_level_start"), // percentage
  batteryLevelEnd: int("battery_level_end"), // percentage
  energyDelivered: decimal("energy_delivered", { precision: 8, scale: 3 }), // kWh
  reminderSent: boolean("reminder_sent").notNull().default(false),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
});

// Preferências do utilizador
export const userPreferences = mysqlTable("user_preferences", {
  userId: varchar("user_id", { length: 255 }).primaryKey(),
  data: json("data").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
});

// Planos de rota guardados
export const routePlans = mysqlTable("route_plans", {
  id: varchar("id", { length: 255 }).primaryKey(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  vehicleId: varchar("vehicle_id", { length: 255 }).notNull(),
  data: json("data").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
});

// ---------- Validação dos pedidos (zod) ----------
// Regras comuns: números têm de ser números; datas aceitam "AAAA-MM-DD", ISO, "DD/MM/AAAA", "MM/AAAA" e "AAAA";
// campos opcionais aceitam "" e null como "sem valor". Nunca se aceitam do cliente: id, userId, createdAt, updatedAt.

const BLANK = new Set(['', 'null', 'undefined', 'Não encontrado']);
const isBlank = (v: unknown) => v === null || v === undefined || (typeof v === 'string' && BLANK.has(v.trim()));

const utcDate = (y: number, m: number, d: number) => {
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d ? date : new Date(NaN);
};

/** Converte os formatos de data aceites; devolve Invalid Date se não reconhecer (o zod rejeita-a). */
export function parseDateInput(v: unknown): unknown {
  if (v instanceof Date || typeof v !== 'string') return v;
  const s = v.trim();
  let m: RegExpMatchArray | null;
  if ((m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/))) return utcDate(+m[3], +m[2], +m[1]);
  if ((m = s.match(/^(\d{1,2})\/(\d{4})$/))) return utcDate(+m[2], +m[1], 1);
  if ((m = s.match(/^(\d{4})$/))) return utcDate(+m[1], 1, 1);
  if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/))) return utcDate(+m[1], +m[2], +m[3]);
  return /^\d{4}-\d{2}-\d{2}T/.test(s) ? new Date(s) : new Date(NaN);
}

const toNumber = (v: unknown) => (typeof v === 'string' ? Number(v.trim().replace(',', '.')) : v);

const dateSchema = z.date({ error: 'Data inválida' });
/** Data obrigatória. */
const zDate = z.preprocess(parseDateInput, dateSchema);
/** Data opcional na criação. */
const optDate = z.preprocess((v) => (isBlank(v) ? undefined : parseDateInput(v)), dateSchema.optional());
/** Data numa atualização: ausente não mexe; "" ou null limpa. */
const patchDate = z.preprocess((v) => (v === undefined ? undefined : isBlank(v) ? null : parseDateInput(v)), dateSchema.nullable().optional());

const numberSchema = (min: number, max: number, int: boolean) => {
  let n = z.number({ error: 'Número inválido' }).min(min, `Tem de ser ≥ ${min}`).max(max, `Tem de ser ≤ ${max}`);
  if (int) n = n.int('Tem de ser um número inteiro');
  return n;
};
const zInt = (min = 0, max = 10_000_000) => z.preprocess(toNumber, numberSchema(min, max, true));
const optInt = (min = 0, max = 10_000_000) => z.preprocess((v) => (isBlank(v) ? undefined : toNumber(v)), numberSchema(min, max, true).optional());
const patchInt = (min = 0, max = 10_000_000) => z.preprocess((v) => (v === undefined ? undefined : isBlank(v) ? null : toNumber(v)), numberSchema(min, max, true).nullable().optional());
/** Colunas DECIMAL: valida como número e guarda como texto (sem perder precisão). */
const zDecimal = (min = 0, max = 1_000_000) => z.preprocess(toNumber, numberSchema(min, max, false)).transform(String);
const optDecimal = (min = 0, max = 1_000_000) => z.preprocess((v) => (isBlank(v) ? undefined : toNumber(v)), numberSchema(min, max, false).optional()).transform((n) => (n === undefined ? undefined : String(n)));

const zTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Hora inválida (HH:MM)');
const optText = (max: number) => z.preprocess((v) => (isBlank(v) ? undefined : v), z.string().trim().max(max).optional());
const zFuel = z.preprocess(normalizeFuelType, z.enum(FUEL_CODES, { error: 'Combustível inválido' }));
const optFuel = z.preprocess((v) => (isBlank(v) ? undefined : normalizeFuelType(v) ?? v), z.enum(FUEL_CODES, { error: 'Combustível inválido' }).optional());

/** Fotos aceites: as nossas (/uploads/vehicle-<uuid>.ext) ou URLs https (Commons/Unsplash). */
export const OWN_VEHICLE_PHOTO = /^\/uploads\/vehicle-[0-9a-f-]{36}\.(jpg|png|webp)$/;
const httpsUrl = z.string().max(2000).regex(/^https:\/\/[^\s"'<>]+$/, 'URL inválido');
const photoUrl = z.string().max(2000).refine((v) => OWN_VEHICLE_PHOTO.test(v) || /^https:\/\/[^\s"'<>]+$/.test(v), 'URL de foto inválido');

const vehicleFields = (mode: 'create' | 'update') => {
  const d = mode === 'create' ? optDate : patchDate;
  const n = mode === 'create' ? optInt : patchInt;
  const nullable = <T extends z.ZodTypeAny>(s: T) => (mode === 'create' ? s.optional() : s.nullable().optional());
  return {
    licensePlate: z.string().trim().min(1, 'Matrícula obrigatória').max(20).transform((s) => s.toUpperCase()),
    brand: z.string().trim().min(1, 'Marca obrigatória').max(100),
    model: z.string().trim().min(1, 'Modelo obrigatório').max(100),
    year: zInt(1900, 2100),
    currentMileage: zInt(0),
    fuelType: optFuel,
    registrationDate: d, lastOilChange: d, lastTireChange: d, inspectionDue: d, iucDue: d, insuranceDue: d,
    lastOilChangeMileage: n(), oilChangeInterval: n(0, 200_000), lastTireChangeMileage: n(), tireChangeInterval: n(0, 500_000),
    powerCV: n(0, 5000), powerKW: n(0, 5000), engineDisplacement: n(0, 20_000),
    imageUrl: nullable(photoUrl), imageCredit: nullable(z.string().max(500)), imageCreditUrl: nullable(httpsUrl),
  };
};

const SERVER_FIELDS = { id: true, createdAt: true } as const;

export const createVehicleSchema = createInsertSchema(vehicles).omit({ ...SERVER_FIELDS, userId: true, updatedAt: true }).extend(vehicleFields('create'));
export const updateVehicleSchema = createInsertSchema(vehicles).omit({ ...SERVER_FIELDS, userId: true, updatedAt: true }).extend(vehicleFields('update')).partial();

const fuelRecordFields = {
  date: zDate,
  mileage: zInt(0),
  liters: zDecimal(0.01, 10_000),
  costPerLiter: zDecimal(0, 100),
  totalCost: zDecimal(0, 100_000),
  fuelType: zFuel,
  fullTank: z.boolean().optional(),
};
export const createFuelRecordSchema = createInsertSchema(fuelRecords).omit(SERVER_FIELDS).extend(fuelRecordFields);
export const updateFuelRecordSchema = createInsertSchema(fuelRecords).omit({ ...SERVER_FIELDS, vehicleId: true }).extend(fuelRecordFields).partial();

const TRIP_STATUS = z.enum(['active', 'paused', 'completed']);
export const createMileageTripSchema = createInsertSchema(mileageTrips).omit(SERVER_FIELDS).extend({
  startTime: zDate,
  endTime: optDate,
  startMileage: zInt(0),
  endMileage: optInt(0),
  duration: optInt(0),
  totalDistance: optInt(0),
  status: TRIP_STATUS.default('active'),
});
export const updateMileageTripSchema = z.object({
  endTime: optDate,
  endMileage: optInt(0),
  duration: optInt(0),
  totalDistance: optInt(0),
  status: TRIP_STATUS.optional(),
  notes: optText(2000),
});

// receiptUrl só é definido pelo servidor (rota de OCR): aceitá-lo do cliente permitia apontar para ficheiros de outros
export const createExpenseRecordSchema = createInsertSchema(expenseRecords).omit({ ...SERVER_FIELDS, receiptUrl: true }).extend({
  date: zDate,
  amount: zDecimal(0, 1_000_000),
  mileage: optInt(0),
  type: z.string().trim().min(1).max(100),
  category: z.string().trim().min(1).max(100),
});

export const createDocumentSchema = createInsertSchema(documents).omit(SERVER_FIELDS);

export const createMaintenanceRecordSchema = createInsertSchema(maintenanceRecords).omit(SERVER_FIELDS).extend({
  performedAt: zDate,
  mileage: optInt(0),
  cost: optDecimal(0),
});

const appointmentFields = {
  scheduledDate: zDate,
  scheduledTime: zTime,
  estimatedDuration: optInt(1, 10_000),
  estimatedCost: optDecimal(0),
  actualCost: optDecimal(0),
  mileageAtAppointment: optInt(0),
};
export const createMaintenanceAppointmentSchema = createInsertSchema(maintenanceAppointments).omit({ ...SERVER_FIELDS, updatedAt: true }).extend(appointmentFields);
export const updateMaintenanceAppointmentSchema = createInsertSchema(maintenanceAppointments).omit({ ...SERVER_FIELDS, updatedAt: true, vehicleId: true, userId: true }).extend(appointmentFields).partial();

const reservationFields = {
  reservationDate: zDate,
  startTime: zTime,
  endTime: zTime,
  estimatedChargingTime: zInt(1, 10_000),
  estimatedCost: optDecimal(0),
  actualCost: optDecimal(0),
  energyDelivered: optDecimal(0),
  batteryLevelStart: optInt(0, 100),
  batteryLevelEnd: optInt(0, 100),
};
export const createChargingStationReservationSchema = createInsertSchema(chargingStationReservations).omit({ ...SERVER_FIELDS, updatedAt: true }).extend(reservationFields);
export const updateChargingStationReservationSchema = createInsertSchema(chargingStationReservations).omit({ ...SERVER_FIELDS, updatedAt: true, vehicleId: true, userId: true }).extend(reservationFields).partial();

// ---------- Tipos ----------
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Vehicle = typeof vehicles.$inferSelect;
export type NewVehicle = typeof vehicles.$inferInsert;
export type MaintenanceRecord = typeof maintenanceRecords.$inferSelect;
export type NewMaintenanceRecord = typeof maintenanceRecords.$inferInsert;
export type Alert = typeof alerts.$inferSelect;
export type NewAlert = typeof alerts.$inferInsert;
export type FuelRecord = typeof fuelRecords.$inferSelect;
export type NewFuelRecord = typeof fuelRecords.$inferInsert;
export type MileageTrip = typeof mileageTrips.$inferSelect;
export type NewMileageTrip = typeof mileageTrips.$inferInsert;
export type ExpenseRecord = typeof expenseRecords.$inferSelect;
export type NewExpenseRecord = typeof expenseRecords.$inferInsert;
export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
export type MaintenanceAppointment = typeof maintenanceAppointments.$inferSelect;
export type NewMaintenanceAppointment = typeof maintenanceAppointments.$inferInsert;
export type ChargingStationReservation = typeof chargingStationReservations.$inferSelect;
export type NewChargingStationReservation = typeof chargingStationReservations.$inferInsert;
