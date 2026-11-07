// Acesso à base de dados para vários motores: MySQL/MariaDB, PostgreSQL, SQL Server e SQLite.
// O esquema está descrito uma única vez em shared/schema.ts (Drizzle); daqui saem:
//   - a criação/atualização das tabelas para o motor escolhido (setupDatabase)
//   - a conversão de valores entre JavaScript e cada motor (toRow/fromRow)
// As consultas usam o Kysely, que gera SQL no dialeto certo.
import fs from 'fs';
import path from 'path';
import { Kysely, MysqlDialect, PostgresDialect, MssqlDialect, SqliteDialect, sql, type Dialect } from 'kysely';
import { getTableColumns, getTableName, type Table } from 'drizzle-orm';
import { getTableConfig, type MySqlTable } from 'drizzle-orm/mysql-core';
import * as schema from '@shared/schema';

export type DbClient = 'mysql' | 'postgres' | 'mssql' | 'sqlite';

const env = (name: string, legacy?: string) => process.env[name] ?? (legacy ? process.env[legacy] : undefined);

export const dbClient = (process.env.DB_CLIENT || 'mysql').toLowerCase() as DbClient;
if (!['mysql', 'postgres', 'mssql', 'sqlite'].includes(dbClient)) {
  throw new Error(`DB_CLIENT inválido: "${dbClient}". Use mysql, postgres, mssql ou sqlite.`);
}

function serverConfig(defaultPort: number) {
  // MYSQL_* continua a funcionar para instalações antigas
  const config = {
    host: env('DB_HOST', 'MYSQL_HOST'),
    port: Number(env('DB_PORT', 'MYSQL_PORT')) || defaultPort,
    user: env('DB_USER', 'MYSQL_USER'),
    password: env('DB_PASSWORD', 'MYSQL_PASSWORD') ?? '',
    database: env('DB_NAME', 'MYSQL_DATABASE'),
  };
  const missing = (['host', 'user', 'database'] as const).filter((k) => !config[k]);
  if (missing.length) {
    throw new Error(`Configuração da base de dados em falta para ${dbClient}: ${missing.map((k) => `DB_${k === 'database' ? 'NAME' : k.toUpperCase()}`).join(', ')}`);
  }
  return config as { host: string; port: number; user: string; password: string; database: string };
}

/** SQLite com o módulo nativo do Node (node:sqlite), sem dependências compiladas. */
async function sqliteDatabase(file: string) {
  const { DatabaseSync } = await import('node:sqlite');
  if (file !== ':memory:') fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  const database = new DatabaseSync(file);
  database.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
  // O SQLite não tem tipos de data nem booleano: datas em ISO 8601, booleanos em 0/1
  const bind = (params: ReadonlyArray<unknown>) => params.map((v) =>
    v instanceof Date ? v.toISOString() : typeof v === 'boolean' ? Number(v) : v === undefined ? null : v) as any[];
  return {
    close: () => database.close(),
    prepare(query: string) {
      const stmt = database.prepare(query);
      return {
        reader: stmt.columns().length > 0,
        all: (p: ReadonlyArray<unknown>) => stmt.all(...bind(p)),
        run: (p: ReadonlyArray<unknown>) => stmt.run(...bind(p)),
        iterate: (p: ReadonlyArray<unknown>) => stmt.iterate(...bind(p)) as unknown as IterableIterator<unknown>,
      };
    },
  };
}

async function createDialect(): Promise<Dialect> {
  switch (dbClient) {
    case 'mysql': {
      const { createPool } = await import('mysql2');
      const c = serverConfig(3306);
      return new MysqlDialect({ pool: createPool({ ...c, connectionLimit: 10, charset: 'utf8mb4' }) });
    }
    case 'postgres': {
      const { default: pg } = await import('pg');
      const c = serverConfig(5432);
      return new PostgresDialect({ pool: new pg.Pool({ ...c, max: 10, ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined }) });
    }
    case 'mssql': {
      const tedious = await import('tedious');
      const tarn = await import('tarn');
      const c = serverConfig(1433);
      const instanceName = process.env.DB_INSTANCE || undefined;
      return new MssqlDialect({
        tarn: { ...tarn, options: { min: 0, max: 10 } },
        tedious: {
          ...tedious,
          connectionFactory: () => new tedious.Connection({
            server: c.host,
            authentication: { type: 'default', options: { userName: c.user, password: c.password } },
            options: {
              database: c.database,
              // Instância com nome (ex.: SQLEXPRESS) usa o SQL Browser em vez da porta
              ...(instanceName ? { instanceName } : { port: c.port }),
              encrypt: process.env.DB_ENCRYPT !== 'false',
              trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true',
            },
          }),
        },
      });
    }
    case 'sqlite':
      return new SqliteDialect({ database: await sqliteDatabase(process.env.DB_FILE || './data/logicar.db') });
  }
}

export const db = new Kysely<any>({ dialect: await createDialect() });

export async function closeDatabase() {
  await db.destroy();
}

// ---------- Conversão de valores ----------
type Column = { name: string; columnType: string; notNull: boolean; primary: boolean; isUnique: boolean; hasDefault: boolean; default: unknown; length?: number; precision?: number; scale?: number };
const columnsOf = (table: Table) => Object.entries(getTableColumns(table)) as unknown as [string, Column][];

export const tableName = (table: Table) => getTableName(table);

/** Objeto da aplicação (camelCase) → linha da BD (nomes reais das colunas). */
export function toRow(table: Table, values: Record<string, unknown>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const [key, col] of columnsOf(table)) {
    const value = values[key];
    if (value === undefined) continue;
    row[col.name] = col.columnType === 'MySqlJson' && value !== null ? JSON.stringify(value) : value;
  }
  return row;
}

/** Linha da BD → objeto da aplicação, com os tipos que o resto do código espera. */
export function fromRow<T>(table: Table, row: Record<string, unknown> | undefined): T | undefined {
  if (!row) return undefined;
  const out: Record<string, unknown> = {};
  for (const [key, col] of columnsOf(table)) {
    const v = row[col.name];
    if (v === undefined) continue;
    if (v === null) { out[key] = null; continue; }
    switch (col.columnType) {
      case 'MySqlBoolean': out[key] = Boolean(Number(v)); break;
      case 'MySqlDateTime':
      case 'MySqlTimestamp': out[key] = v instanceof Date ? v : new Date(v as string); break;
      case 'MySqlDecimal': out[key] = String(v); break;
      case 'MySqlInt': out[key] = Number(v); break;
      case 'MySqlJson': out[key] = typeof v === 'string' ? JSON.parse(v) : v; break;
      default: out[key] = v;
    }
  }
  return out as T;
}

export const fromRows = <T>(table: Table, rows: Record<string, unknown>[]) => rows.map((r) => fromRow<T>(table, r)!);

/** Preenche os valores por omissão do esquema (feito na aplicação para ser igual em todos os motores). */
export function withDefaults(table: Table, values: Record<string, unknown>): Record<string, unknown> {
  const out = { ...values };
  for (const [key, col] of columnsOf(table)) {
    if (out[key] !== undefined || !col.hasDefault) continue;
    out[key] = col.columnType === 'MySqlTimestamp' ? new Date() : col.default;
  }
  return out;
}

// ---------- Criação e atualização das tabelas ----------
function sqlType(col: Column): string {
  const by = (types: Record<DbClient, string>) => types[dbClient];
  switch (col.columnType) {
    case 'MySqlVarChar': return dbClient === 'mssql' ? `nvarchar(${col.length})` : `varchar(${col.length})`;
    case 'MySqlText': return by({ mysql: 'text', postgres: 'text', mssql: 'nvarchar(max)', sqlite: 'text' });
    case 'MySqlInt': return 'integer';
    case 'MySqlDecimal': return `decimal(${col.precision}, ${col.scale})`;
    case 'MySqlBoolean': return by({ mysql: 'boolean', postgres: 'boolean', mssql: 'bit', sqlite: 'integer' });
    case 'MySqlDateTime':
    case 'MySqlTimestamp': return by({ mysql: 'datetime', postgres: 'timestamp', mssql: 'datetime2', sqlite: 'text' });
    case 'MySqlJson': return by({ mysql: 'json', postgres: 'jsonb', mssql: 'nvarchar(max)', sqlite: 'text' });
    default: throw new Error(`Tipo de coluna não suportado: ${col.columnType}`);
  }
}

const TABLES: MySqlTable[] = [
  schema.users, schema.userPreferences, schema.vehicles, schema.maintenanceRecords, schema.maintenanceAppointments,
  schema.alerts, schema.fuelRecords, schema.expenseRecords, schema.documents, schema.mileageTrips,
  schema.routePlans, schema.chargingStationReservations,
];

const alreadyExists = (e: unknown) => /already exists|duplicate key name/i.test(String((e as Error)?.message));

/**
 * Cria as tabelas que faltam e acrescenta colunas novas às existentes. Corre no arranque e é idempotente.
 * ponytail: só faz alterações aditivas; mudar tipos ou apagar colunas continua a ser manual
 */
export async function setupDatabase(log: (msg: string) => void = console.log) {
  const existing = new Map((await db.introspection.getTables()).map((t) => [t.name.toLowerCase(), new Set(t.columns.map((c) => c.name.toLowerCase()))]));

  for (const table of TABLES) {
    const name = getTableName(table);
    const columns = columnsOf(table);
    const current = existing.get(name.toLowerCase());
    const { uniqueConstraints } = getTableConfig(table);

    if (!current) {
      let create = db.schema.createTable(name);
      for (const [, col] of columns) {
        create = create.addColumn(col.name, sql.raw(sqlType(col)), (c) => {
          let def = c;
          if (col.primary) def = def.primaryKey();
          if (col.notNull || col.primary) def = def.notNull();
          if (col.isUnique) def = def.unique();
          return def;
        });
      }
      await create.execute();
      log(`  tabela criada: ${name}`);
    } else {
      for (const [, col] of columns) {
        if (current.has(col.name.toLowerCase())) continue;
        // Em tabelas com dados, uma coluna nova só pode ser opcional
        await db.schema.alterTable(name).addColumn(col.name, sql.raw(sqlType(col))).execute();
        log(`  coluna acrescentada: ${name}.${col.name}`);
      }
    }

    // Índices nas colunas *_id e restrições únicas compostas
    const indexes = [
      ...columns.filter(([key, col]) => key.endsWith('Id') && !col.primary).map(([, col]) => ({ name: `idx_${name}_${col.name}`, cols: [col.name], unique: false })),
      ...uniqueConstraints.map((u) => ({ name: u.name!, cols: u.columns.map((c) => c.name), unique: true })),
    ];
    for (const index of indexes) {
      try {
        let create = db.schema.createIndex(index.name).on(name).columns(index.cols);
        if (index.unique) create = create.unique();
        await create.execute();
      } catch (error) {
        if (!current) throw error;
        if (!alreadyExists(error)) log(`  ⚠️  não foi possível criar ${index.name}: ${(error as Error).message}`);
      }
    }
  }

  await upgradeLegacyData(log);
}

/** Correções de dados de versões antigas da aplicação. */
async function upgradeLegacyData(log: (msg: string) => void) {
  // MySQL antigo (sql.sql): a matrícula era única para todos os utilizadores
  if (dbClient === 'mysql') {
    try {
      await sql`ALTER TABLE vehicles DROP INDEX license_plate`.execute(db);
      log('  índice antigo vehicles.license_plate (único global) removido');
    } catch { /* não existe: nada a fazer */ }
  }

  // Documentos guardados com o caminho absoluto em disco passam a /uploads/<ficheiro>
  const docs = await db.selectFrom('documents').select(['id', 'file_url']).where('file_url', 'not like', '/uploads/%').execute();
  for (const doc of docs) {
    const fileName = String(doc.file_url).split(/[\\/]/).pop();
    await db.updateTable('documents').set({ file_url: `/uploads/${fileName}` }).where('id', '=', doc.id).execute();
  }
  if (docs.length) log(`  ${docs.length} URL(s) de documentos corrigido(s)`);
}

/** Violação de unicidade em qualquer um dos motores. */
export function isDuplicateKeyError(error: any): boolean {
  return error?.code === 'ER_DUP_ENTRY' // MySQL
    || error?.code === '23505' // PostgreSQL
    || error?.number === 2627 || error?.number === 2601 // SQL Server
    || /UNIQUE constraint failed/i.test(error?.message ?? ''); // SQLite
}
