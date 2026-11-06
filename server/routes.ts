import type { Express } from 'express';
import { registerAuthRoutes } from './routes/auth';
import { registerVehicleRoutes } from './routes/vehicles';
import { registerRecordRoutes } from './routes/records';
import { registerMobilityRoutes } from './routes/mobility';

export function registerRoutes(app: Express) {
  registerAuthRoutes(app);
  registerVehicleRoutes(app);
  registerRecordRoutes(app);
  registerMobilityRoutes(app);
}
