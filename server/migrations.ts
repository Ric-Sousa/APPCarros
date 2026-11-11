// Migrações de dados versionadas: cada uma corre uma única vez por base de dados e fica registada em schema_migrations.
// As alterações de estrutura aditivas (tabelas/colunas novas) são feitas por setupDatabase (db.ts);
// aqui ficam as que mudam dados ou exigem passos específicos.
// Regras: nunca alterar uma migração já publicada; acrescentar sempre uma nova no fim da lista.
import type { Kysely } from 'kysely';
import { normalizeFuelType } from '@shared/fuel';
import { db } from './db';

interface Migration {
  id: string;
  up: (db: Kysely<any>) => Promise<void>;
}

const MIGRATIONS: Migration[] = [
  {
    // Valores antigos de combustível ("Gasolina", "Gasóleo", "gasoline", ...) passam aos códigos de shared/fuel.ts
    id: '2026-11-11-normalize-fuel-types',
    up: async (db) => {
      for (const table of ['vehicles', 'fuel_records']) {
        const rows = await db.selectFrom(table).select(['id', 'fuel_type']).where('fuel_type', 'is not', null).execute();
        for (const row of rows) {
          const code = normalizeFuelType(row.fuel_type);
          if (code && code !== row.fuel_type) await db.updateTable(table).set({ fuel_type: code }).where('id', '=', row.id).execute();
        }
      }
    },
  },
  {
    // Contas criadas antes dos planos: Grátis
    id: '2026-11-11-default-plan',
    up: async (db) => {
      await db.updateTable('users').set({ plan: 'free' }).where('plan', 'is', null).execute();
    },
  },
];

export async function runMigrations(log: (msg: string) => void = console.log) {
  const done = new Set((await db.selectFrom('schema_migrations').select('id').execute()).map((r) => r.id as string));
  for (const m of MIGRATIONS) {
    if (done.has(m.id)) continue;
    await db.transaction().execute(async (trx) => {
      await m.up(trx);
      await trx.insertInto('schema_migrations').values({ id: m.id, applied_at: new Date() }).execute();
    });
    log(`  migração aplicada: ${m.id}`);
  }
}
