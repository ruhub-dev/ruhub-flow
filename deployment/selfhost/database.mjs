import {DatabaseSync,backup} from 'node:sqlite';
import {mkdirSync,readdirSync,readFileSync,existsSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
export const persistentTables=['flow_users','local_credentials','projects','project_accounts','account_owned_projects','revisions','flow_library'];
export function openDatabase(root){
 mkdirSync(join(root,'data'),{recursive:true});
 const sqlite=new DatabaseSync(join(root,'data','flow.sqlite'));
 sqlite.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
 sqlite.exec('CREATE TABLE IF NOT EXISTS selfhost_migrations(name TEXT PRIMARY KEY,digest TEXT NOT NULL)');
 for(const name of readdirSync(join(root,'migrations')).filter(x=>x.endsWith('.sql')).sort()){
  const sql=readFileSync(join(root,'migrations',name),'utf8'),digest=createHash('sha256').update(sql).digest('hex');
  const old=sqlite.prepare('SELECT digest FROM selfhost_migrations WHERE name=?').get(name);
  if(old){if(old.digest!==digest)throw Error('Migration checksum changed: '+name);continue;}
  sqlite.exec('BEGIN IMMEDIATE');try{sqlite.exec(sql.replaceAll('--> statement-breakpoint',''));sqlite.prepare('INSERT INTO selfhost_migrations VALUES(?,?)').run(name,digest);sqlite.exec('COMMIT')}catch(e){sqlite.exec('ROLLBACK');throw e}
 }
 const db={sqlite,prepare(sql){let values=[];return {bind(...v){values=v;return this},async first(){return sqlite.prepare(sql).get(...values)||null},async all(){return {results:sqlite.prepare(sql).all(...values)}},execute(){const stmt=sqlite.prepare(sql),returning=stmt.columns().length>0;const results=returning?stmt.all(...values):[];if(!returning)stmt.run(...values);return {results,meta:{changes:Number(sqlite.prepare('SELECT changes() AS n').get().n)}}},async run(){return this.execute()}}},async batch(statements){sqlite.exec('BEGIN IMMEDIATE');try{const out=statements.map(s=>s.execute());sqlite.exec('COMMIT');return out}catch(e){sqlite.exec('ROLLBACK');throw e}}};
 return db;
}
export function importSnapshot(db,snapshot){
 if(snapshot.format!=='ruhub-flow-migration-v1'||!snapshot.tables)throw Error('Unsupported backup format');
 for(const t of persistentTables){if(t==='flow_library'&&!snapshot.tables[t])snapshot.tables[t]=[];if(!Array.isArray(snapshot.tables[t]))throw Error('Missing table: '+t);if(db.sqlite.prepare('SELECT count(*) AS n FROM '+t).get().n)throw Error('Existing data: refusing to overwrite '+t)}
 db.sqlite.exec('BEGIN IMMEDIATE');
 try{for(const t of persistentTables){const columns=db.sqlite.prepare('PRAGMA table_info('+t+')').all().map(c=>c.name);const stmt=db.sqlite.prepare('INSERT INTO '+t+'('+columns.map(c=>'"'+c+'"').join(',')+') VALUES('+columns.map(()=>'?').join(',')+')');for(const row of snapshot.tables[t]){if(t==='projects'||t==='revisions')JSON.parse(row.document);stmt.run(...columns.map(c=>row[c]));}}if(db.sqlite.prepare('PRAGMA foreign_key_check').all().length)throw Error('Foreign key check failed');db.sqlite.exec('COMMIT')}catch(e){db.sqlite.exec('ROLLBACK');throw e}
}
export async function backupDatabase(db,root){mkdirSync(join(root,'backups'),{recursive:true});const name='flow-'+new Date().toISOString().replaceAll(/[:.]/g,'-')+'.sqlite';await backup(db.sqlite,join(root,'backups',name));return name;}
