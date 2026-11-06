import { mysqlTable, varchar, int, timestamp, text, decimal, boolean, datetime, json, unique } from "drizzle-orm/mysql-core";
import { relations } from "drizzle-orm";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

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

// Trip records table
export const tripRecords = mysqlTable("trip_records", {
  id: varchar("id", { length: 255 }).primaryKey(),
  vehicleId: varchar("vehicle_id", { length: 255 }).notNull(),
  startDate: datetime("start_date").notNull(),
  endDate: datetime("end_date"),
  startMileage: int("start_mileage").notNull(),
  endMileage: int("end_mileage"),
  startLocation: varchar("start_location", { length: 255 }),
  endLocation: varchar("end_location", { length: 255 }),
  purpose: varchar("purpose", { length: 50 }).notNull(), // business, personal, vacation
  totalDistance: int("total_distance"),
  fuelCost: decimal("fuel_cost", { precision: 10, scale: 2 }),
  tollCost: decimal("toll_cost", { precision: 10, scale: 2 }),
  parkingCost: decimal("parking_cost", { precision: 10, scale: 2 }),
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

// Vehicle specifications table
export const vehicleSpecs = mysqlTable("vehicle_specs", {
  id: varchar("id", { length: 255 }).primaryKey(),
  vehicleId: varchar("vehicle_id", { length: 255 }).notNull(),
  engineSize: varchar("engine_size", { length: 50 }),
  engineType: varchar("engine_type", { length: 100 }),
  horsePower: int("horse_power"),
  transmission: varchar("transmission", { length: 50 }),
  driveType: varchar("drive_type", { length: 50 }),
  weight: int("weight"), // in kg
  fuelCapacity: int("fuel_capacity"), // in liters
  averageFuelConsumption: decimal("average_fuel_consumption", { precision: 4, scale: 2 }), // l/100km
  co2Emissions: int("co2_emissions"), // g/km
  euroStandard: varchar("euro_standard", { length: 20 }),
  color: varchar("color", { length: 50 }),
  bodyType: varchar("body_type", { length: 50 }),
  doors: int("doors"),
  seats: int("seats"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
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

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  vehicles: many(vehicles),
  maintenanceAppointments: many(maintenanceAppointments),
  chargingStationReservations: many(chargingStationReservations),
}));

export const vehiclesRelations = relations(vehicles, ({ one, many }) => ({
  user: one(users, {
    fields: [vehicles.userId],
    references: [users.id],
  }),
  maintenanceRecords: many(maintenanceRecords),
  alerts: many(alerts),
  fuelRecords: many(fuelRecords),
  tripRecords: many(tripRecords),
  mileageTrips: many(mileageTrips),
  expenseRecords: many(expenseRecords),
  specs: one(vehicleSpecs),
  documents: many(documents),
  maintenanceAppointments: many(maintenanceAppointments),
  chargingStationReservations: many(chargingStationReservations),
}));

export const maintenanceRecordsRelations = relations(maintenanceRecords, ({ one }) => ({
  vehicle: one(vehicles, {
    fields: [maintenanceRecords.vehicleId],
    references: [vehicles.id],
  }),
}));

export const alertsRelations = relations(alerts, ({ one }) => ({
  vehicle: one(vehicles, {
    fields: [alerts.vehicleId],
    references: [vehicles.id],
  }),
}));

export const fuelRecordsRelations = relations(fuelRecords, ({ one }) => ({
  vehicle: one(vehicles, {
    fields: [fuelRecords.vehicleId],
    references: [vehicles.id],
  }),
}));

export const tripRecordsRelations = relations(tripRecords, ({ one }) => ({
  vehicle: one(vehicles, {
    fields: [tripRecords.vehicleId],
    references: [vehicles.id],
  }),
}));

export const mileageTripsRelations = relations(mileageTrips, ({ one }) => ({
  vehicle: one(vehicles, {
    fields: [mileageTrips.vehicleId],
    references: [vehicles.id],
  }),
}));

export const expenseRecordsRelations = relations(expenseRecords, ({ one }) => ({
  vehicle: one(vehicles, {
    fields: [expenseRecords.vehicleId],
    references: [vehicles.id],
  }),
}));

export const vehicleSpecsRelations = relations(vehicleSpecs, ({ one }) => ({
  vehicle: one(vehicles, {
    fields: [vehicleSpecs.vehicleId],
    references: [vehicles.id],
  }),
}));

export const documentsRelations = relations(documents, ({ one }) => ({
  vehicle: one(vehicles, {
    fields: [documents.vehicleId],
    references: [vehicles.id],
  }),
}));

export const maintenanceAppointmentsRelations = relations(maintenanceAppointments, ({ one }) => ({
  vehicle: one(vehicles, {
    fields: [maintenanceAppointments.vehicleId],
    references: [vehicles.id],
  }),
  user: one(users, {
    fields: [maintenanceAppointments.userId],
    references: [users.id],
  }),
}));

export const chargingStationReservationsRelations = relations(chargingStationReservations, ({ one }) => ({
  vehicle: one(vehicles, {
    fields: [chargingStationReservations.vehicleId],
    references: [vehicles.id],
  }),
  user: one(users, {
    fields: [chargingStationReservations.userId],
    references: [users.id],
  }),
}));

// Zod schemas
export const insertUserSchema = createInsertSchema(users);
export const selectUserSchema = createSelectSchema(users);
export const insertVehicleSchema = createInsertSchema(vehicles).extend({
  lastOilChange: z.string().optional().nullable().transform((val) => {
    if (!val || val === '') return null;
    return new Date(val);
  }),
  lastOilChangeMileage: z.union([z.string(), z.number()]).optional().nullable().transform((val) => {
    if (!val || val === '') return null;
    return typeof val === 'string' ? parseInt(val) || null : val;
  }),
  oilChangeInterval: z.union([z.string(), z.number()]).optional().nullable().transform((val) => {
    if (!val || val === '') return null;
    return typeof val === 'string' ? parseInt(val) || null : val;
  }),
  lastTireChange: z.string().optional().nullable().transform((val) => {
    if (!val || val === '') return null;
    return new Date(val);
  }),
  lastTireChangeMileage: z.union([z.string(), z.number()]).optional().nullable().transform((val) => {
    if (!val || val === '') return null;
    return typeof val === 'string' ? parseInt(val) || null : val;
  }),
  tireChangeInterval: z.union([z.string(), z.number()]).optional().nullable().transform((val) => {
    if (!val || val === '') return null;
    return typeof val === 'string' ? parseInt(val) || null : val;
  }),
  inspectionDue: z.string().optional().nullable().transform((val) => {
    if (!val || val === '') return null;
    return new Date(val);
  }),
  iucDue: z.string().optional().nullable().transform((val) => {
    if (!val || val === '') return null;
    return new Date(val);
  }),
  insuranceDue: z.string().optional().nullable().transform((val) => {
    if (!val || val === '') return null;
    return new Date(val);
  }),
  registrationDate: z.string().optional().nullable().transform((val) => {
    if (!val || val === '' || val === 'undefined' || val === 'null' || val === 'Não encontrado') return undefined;
    
    // Handle MM/yyyy format
    const mmYyyyMatch = val.match(/^(\d{2})\/(\d{4})$/);
    if (mmYyyyMatch) {
      const [, month, year] = mmYyyyMatch;
      // Create date with first day of the month
      const date = new Date(parseInt(year), parseInt(month) - 1, 1);
      // Validate the created date
      if (isNaN(date.getTime())) {
        console.warn(`Invalid MM/yyyy date format: ${val}, returning undefined`);
        return undefined;
      }
      return date;
    }
    
    // Handle Portuguese date formats like "dd/mm/yyyy" or "dd-mm-yyyy"
    const ddMmYyyyMatch = val.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
    if (ddMmYyyyMatch) {
      const [, day, month, year] = ddMmYyyyMatch;
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      if (isNaN(date.getTime())) {
        console.warn(`Invalid dd/mm/yyyy date format: ${val}, returning undefined`);
        return undefined;
      }
      return date;
    }
    
    // Handle year only format
    const yearOnlyMatch = val.match(/^(\d{4})$/);
    if (yearOnlyMatch) {
      const year = parseInt(yearOnlyMatch[1]);
      const date = new Date(year, 0, 1); // January 1st of that year
      if (isNaN(date.getTime())) {
        console.warn(`Invalid year format: ${val}, returning undefined`);
        return undefined;
      }
      return date;
    }
    
    // Fallback to regular date parsing
    const date = new Date(val);
    if (isNaN(date.getTime())) {
      console.warn(`Invalid date format: ${val}, returning undefined`);
      return undefined;
    }
    return date;
  }),
});
export const selectVehicleSchema = createSelectSchema(vehicles);

// Update vehicle schema that accepts strings for date fields and transforms them
// id, userId e timestamps nunca vêm do cliente
export const updateVehicleSchema = createSelectSchema(vehicles).partial().omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  lastOilChange: z.string().optional().nullable().transform((val) => {
    if (val === undefined) return undefined; // campo ausente: não mexer
    if (!val) return null;
    return new Date(val);
  }),
  lastTireChange: z.string().optional().nullable().transform((val) => {
    if (val === undefined) return undefined; // campo ausente: não mexer
    if (!val) return null;
    return new Date(val);
  }),
  inspectionDue: z.string().optional().nullable().transform((val) => {
    if (val === undefined) return undefined; // campo ausente: não mexer
    if (!val) return null;
    return new Date(val);
  }),
  iucDue: z.string().optional().nullable().transform((val) => {
    if (val === undefined) return undefined; // campo ausente: não mexer
    if (!val) return null;
    return new Date(val);
  }),
  insuranceDue: z.string().optional().nullable().transform((val) => {
    if (val === undefined) return undefined; // campo ausente: não mexer
    if (!val) return null;
    return new Date(val);
  }),
  registrationDate: z.string().optional().nullable().transform((val) => {
    if (!val || val === '' || val === 'undefined' || val === 'null' || val === 'Não encontrado') return undefined;
    
    // Handle MM/yyyy format
    const mmYyyyMatch = val.match(/^(\d{2})\/(\d{4})$/);
    if (mmYyyyMatch) {
      const [, month, year] = mmYyyyMatch;
      // Create date with first day of the month
      const date = new Date(parseInt(year), parseInt(month) - 1, 1);
      return date;
    }
    
    return new Date(val);
  }),
});

// Custom vehicle creation schema (without id and userId which are set on server)
export const createVehicleSchema = createInsertSchema(vehicles).omit({ 
  id: true, 
  userId: true 
}).extend({
  // Validate fuel type options
  fuelType: z.enum(['gasoline95', 'diesel', 'electric', 'Gasolina', 'Gasóleo', 'Elétrico']).optional(),
  // Transform date strings to Date objects
  lastOilChange: z.string().optional().nullable().transform((val) => {
    if (!val || val === '') return null;
    return new Date(val);
  }),
  lastOilChangeMileage: z.union([z.string(), z.number()]).optional().nullable().transform((val) => {
    if (!val || val === '') return null;
    return typeof val === 'string' ? parseInt(val) || null : val;
  }),
  oilChangeInterval: z.union([z.string(), z.number()]).optional().nullable().transform((val) => {
    if (!val || val === '') return null;
    return typeof val === 'string' ? parseInt(val) || null : val;
  }),
  lastTireChange: z.string().optional().nullable().transform((val) => {
    if (!val || val === '') return null;
    return new Date(val);
  }),
  lastTireChangeMileage: z.union([z.string(), z.number()]).optional().nullable().transform((val) => {
    if (!val || val === '') return null;
    return typeof val === 'string' ? parseInt(val) || null : val;
  }),
  tireChangeInterval: z.union([z.string(), z.number()]).optional().nullable().transform((val) => {
    if (!val || val === '') return null;
    return typeof val === 'string' ? parseInt(val) || null : val;
  }),
  inspectionDue: z.string().optional().nullable().transform((val) => {
    if (!val || val === '') return null;
    return new Date(val);
  }),
  iucDue: z.string().optional().nullable().transform((val) => {
    if (!val || val === '') return null;
    return new Date(val);
  }),
  insuranceDue: z.string().optional().nullable().transform((val) => {
    if (!val || val === '') return null;
    return new Date(val);
  }),
  registrationDate: z.string().optional().nullable().transform((val) => {
    if (!val || val === '' || val === 'undefined' || val === 'null' || val === 'Não encontrado') return undefined;
    
    // Handle MM/yyyy format
    const mmYyyyMatch = val.match(/^(\d{2})\/(\d{4})$/);
    if (mmYyyyMatch) {
      const [, month, year] = mmYyyyMatch;
      // Create date with first day of the month
      const date = new Date(parseInt(year), parseInt(month) - 1, 1);
      // Validate the created date
      if (isNaN(date.getTime())) {
        console.warn(`Invalid MM/yyyy date format: ${val}, returning undefined`);
        return undefined;
      }
      return date;
    }
    
    // Handle Portuguese date formats like "dd/mm/yyyy" or "dd-mm-yyyy"
    const ddMmYyyyMatch = val.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
    if (ddMmYyyyMatch) {
      const [, day, month, year] = ddMmYyyyMatch;
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      if (isNaN(date.getTime())) {
        console.warn(`Invalid dd/mm/yyyy date format: ${val}, returning undefined`);
        return undefined;
      }
      return date;
    }
    
    // Handle year only format
    const yearOnlyMatch = val.match(/^(\d{4})$/);
    if (yearOnlyMatch) {
      const year = parseInt(yearOnlyMatch[1]);
      const date = new Date(year, 0, 1); // January 1st of that year
      if (isNaN(date.getTime())) {
        console.warn(`Invalid year format: ${val}, returning undefined`);
        return undefined;
      }
      return date;
    }
    
    // Fallback to regular date parsing
    const date = new Date(val);
    if (isNaN(date.getTime())) {
      console.warn(`Invalid date format: ${val}, returning undefined`);
      return undefined;
    }
    return date;
  }),
});

// Custom fuel record creation schema (without id)
export const createFuelRecordSchema = createInsertSchema(fuelRecords).omit({ 
  id: true 
}).extend({
  date: z.string().transform((val) => new Date(val)),
  liters: z.union([z.string(), z.number()]).transform((val) => String(val)),
  costPerLiter: z.union([z.string(), z.number()]).transform((val) => String(val)),
  totalCost: z.union([z.string(), z.number()]).transform((val) => String(val)),
});

export const updateFuelRecordSchema = createFuelRecordSchema.omit({ vehicleId: true }).partial();

// Custom mileage trip creation schema (without id)
export const createMileageTripSchema = createInsertSchema(mileageTrips).omit({
  id: true,
  createdAt: true
}).extend({
  startTime: z.coerce.date(),
  endTime: z.coerce.date().nullable().optional(),
});

export const updateMileageTripSchema = createMileageTripSchema.omit({ vehicleId: true }).partial();

// Custom expense record creation schema (without id)
export const createExpenseRecordSchema = createInsertSchema(expenseRecords).omit({ 
  id: true 
}).extend({
  date: z.string().transform((val) => new Date(val)),
  amount: z.union([z.string(), z.number()]).transform((val) => String(val)),
});

// Custom document creation schema (without id)
export const createDocumentSchema = createInsertSchema(documents).omit({ 
  id: true 
});

// Custom maintenance record creation schema (without id)
export const createMaintenanceRecordSchema = createInsertSchema(maintenanceRecords).omit({ 
  id: true 
}).extend({
  performedAt: z.string().transform((val) => new Date(val)),
});

export const createMaintenanceAppointmentSchema = createInsertSchema(maintenanceAppointments).omit({ 
  id: true,
  createdAt: true,
  updatedAt: true
}).extend({
  scheduledDate: z.string().transform((val) => new Date(val)),
  estimatedCost: z.union([z.string(), z.number()]).optional().transform((val) => val ? String(val) : undefined),
  actualCost: z.union([z.string(), z.number()]).optional().transform((val) => val ? String(val) : undefined),
});

export const createChargingStationReservationSchema = createInsertSchema(chargingStationReservations).omit({ 
  id: true,
  createdAt: true,
  updatedAt: true
}).extend({
  reservationDate: z.string().transform((val) => new Date(val)),
  estimatedCost: z.union([z.string(), z.number()]).optional().transform((val) => val ? String(val) : undefined),
  actualCost: z.union([z.string(), z.number()]).optional().transform((val) => val ? String(val) : undefined),
  energyDelivered: z.union([z.string(), z.number()]).optional().transform((val) => val ? String(val) : undefined),
});
export const insertMaintenanceRecordSchema = createInsertSchema(maintenanceRecords).extend({
  performedAt: z.string().transform((val) => new Date(val)),
});
export const selectMaintenanceRecordSchema = createSelectSchema(maintenanceRecords);
export const insertAlertSchema = createInsertSchema(alerts).extend({
  dueDate: z.string().optional().nullable().transform((val) => {
    if (!val || val === '') return null;
    return new Date(val);
  }),
});
export const selectAlertSchema = createSelectSchema(alerts);
export const insertFuelRecordSchema = createInsertSchema(fuelRecords).extend({
  date: z.string().transform((val) => new Date(val)),
});
export const selectFuelRecordSchema = createSelectSchema(fuelRecords);
export const insertTripRecordSchema = createInsertSchema(tripRecords).extend({
  startDate: z.string().transform((val) => new Date(val)),
  endDate: z.string().optional().nullable().transform((val) => {
    if (!val || val === '') return null;
    return new Date(val);
  }),
});
export const selectTripRecordSchema = createSelectSchema(tripRecords);
export const insertMileageTripSchema = createInsertSchema(mileageTrips).extend({
  startTime: z.string().transform((val) => new Date(val)),
  endTime: z.string().optional().nullable().transform((val) => {
    if (!val || val === '') return null;
    return new Date(val);
  }),
});
export const selectMileageTripSchema = createSelectSchema(mileageTrips);
export const insertExpenseRecordSchema = createInsertSchema(expenseRecords).extend({
  date: z.string().transform((val) => new Date(val)),
});
export const selectExpenseRecordSchema = createSelectSchema(expenseRecords);
export const insertVehicleSpecsSchema = createInsertSchema(vehicleSpecs);
export const selectVehicleSpecsSchema = createSelectSchema(vehicleSpecs);
export const insertDocumentSchema = createInsertSchema(documents).extend({
  uploadDate: z.string().transform((val) => new Date(val)),
});
export const selectDocumentSchema = createSelectSchema(documents);
export const insertMaintenanceAppointmentSchema = createInsertSchema(maintenanceAppointments).extend({
  scheduledDate: z.string().transform((val) => new Date(val)),
});
export const selectMaintenanceAppointmentSchema = createSelectSchema(maintenanceAppointments);
export const insertChargingStationReservationSchema = createInsertSchema(chargingStationReservations).extend({
  reservationDate: z.string().transform((val) => new Date(val)),
});
export const selectChargingStationReservationSchema = createSelectSchema(chargingStationReservations);

// Types
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
export type TripRecord = typeof tripRecords.$inferSelect;
export type NewTripRecord = typeof tripRecords.$inferInsert;
export type MileageTrip = typeof mileageTrips.$inferSelect;
export type NewMileageTrip = typeof mileageTrips.$inferInsert;
export type CreateMileageTrip = typeof createMileageTripSchema._output;
export type ExpenseRecord = typeof expenseRecords.$inferSelect;
export type NewExpenseRecord = typeof expenseRecords.$inferInsert;
export type VehicleSpecs = typeof vehicleSpecs.$inferSelect;
export type NewVehicleSpecs = typeof vehicleSpecs.$inferInsert;
export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
export type MaintenanceAppointment = typeof maintenanceAppointments.$inferSelect;
export type NewMaintenanceAppointment = typeof maintenanceAppointments.$inferInsert;
export type ChargingStationReservation = typeof chargingStationReservations.$inferSelect;
export type NewChargingStationReservation = typeof chargingStationReservations.$inferInsert;
