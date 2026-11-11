// Backup da base de dados e dos ficheiros enviados: `npm run backup`
// - SQLite: cópia consistente com VACUUM INTO (pode correr com a app a funcionar)
// - MySQL / PostgreSQL / SQL Server: mostra o comando nativo a agendar (mysqldump / pg_dump / BACKUP DATABASE)
// - uploads/ (disco local): cópia da pasta. Com S3, usar o versionamento/replicação do próprio bucket.
// Mantém os últimos BACKUP_KEEP backups (14 por omissão) em BACKUP_DIR (./backups por omissão).
// ponytail: agendamento (cron/Agendador de Tarefas) e cópia para fora do servidor ficam por configurar na infraestrutura
import 'dotenv/config';
import fs from 'fs';
import path from 'path';

const dir = path.resolve(process.env.BACKUP_DIR || './backups');
const keep = Number(process.env.BACKUP_KEEP || 14);
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 13);
const client = (process.env.DB_CLIENT || 'mysql').toLowerCase();
fs.mkdirSync(dir, { recursive: true });

if (client === 'sqlite') {
  const { DatabaseSync } = await import('node:sqlite');
  const file = path.resolve(process.env.DB_FILE || './data/logicar.db');
  const target = path.join(dir, `logicar-${stamp}.db`);
  const db = new DatabaseSync(file);
  db.exec(`VACUUM INTO '${target.replace(/'/g, "''")}'`);
  db.close();
  console.log(`✅ Base de dados copiada para ${target}`);
} else {
  const host = process.env.DB_HOST ?? process.env.MYSQL_HOST;
  const user = process.env.DB_USER ?? process.env.MYSQL_USER;
  const name = process.env.DB_NAME ?? process.env.MYSQL_DATABASE;
  const commands: Record<string, string> = {
    mysql: `mysqldump --single-transaction --routines -h ${host} -u ${user} -p ${name} > ${path.join(dir, `logicar-${stamp}.sql`)}`,
    postgres: `pg_dump -h ${host} -U ${user} -F c -f ${path.join(dir, `logicar-${stamp}.dump`)} ${name}`,
    mssql: `sqlcmd -S ${host} -U ${user} -Q "BACKUP DATABASE [${name}] TO DISK = N'${path.join(dir, `logicar-${stamp}.bak`)}' WITH COMPRESSION"`,
  };
  console.log(`ℹ️  Para ${client}, agende o backup nativo do motor (cron / Agendador de Tarefas), por exemplo:\n   ${commands[client]}`);
}

const uploads = path.resolve('uploads');
if (!process.env.S3_BUCKET && fs.existsSync(uploads)) {
  const target = path.join(dir, `uploads-${stamp}`);
  fs.cpSync(uploads, target, { recursive: true });
  console.log(`✅ Ficheiros copiados para ${target}`);
}

// Rotação: apaga os mais antigos além de BACKUP_KEEP (por tipo)
for (const prefix of ['logicar-', 'uploads-']) {
  const old = fs.readdirSync(dir).filter((f) => f.startsWith(prefix)).sort().reverse().slice(keep);
  for (const f of old) fs.rmSync(path.join(dir, f), { recursive: true, force: true });
  if (old.length) console.log(`🧹 ${old.length} backup(s) antigo(s) removido(s) (${prefix}*)`);
}
console.log('Restauro: SQLite → parar a app e substituir o ficheiro DB_FILE pela cópia; pasta uploads/ → copiar de volta.');
