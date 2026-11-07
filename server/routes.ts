import type { Express } from 'express';
import { sql } from 'kysely';
import { db, dbClient } from './db';
import { registerAuthRoutes } from './routes/auth';
import { registerVehicleRoutes } from './routes/vehicles';
import { registerRecordRoutes } from './routes/records';
import { registerMobilityRoutes } from './routes/mobility';

export function registerRoutes(app: Express) {
  // Health check (monitorização / balanceadores): 200 se a base de dados responde
  app.get('/api/health', async (_req, res) => {
    try {
      await sql`select 1`.execute(db);
      res.json({ status: 'ok', database: dbClient });
    } catch {
      res.status(503).json({ status: 'error', database: dbClient });
    }
  });

  registerAuthRoutes(app);
  registerVehicleRoutes(app);
  registerRecordRoutes(app);
  registerMobilityRoutes(app);
}
