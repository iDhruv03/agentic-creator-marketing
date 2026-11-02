import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Single SQLite connection shared by the REST API, the MCP server and the
 * agent runtime. The Infrastructure Core is the only layer that writes here.
 *
 * Set CMI_DB_PATH=":memory:" for ephemeral test databases.
 */
const DEFAULT_DIR = path.resolve(__dirname, '../../data');
const DB_PATH = process.env.CMI_DB_PATH || path.join(DEFAULT_DIR, 'cmi.db');

if (DB_PATH !== ':memory:') {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
}

export const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA busy_timeout = 5000;');

export function initDatabase(): void {
  const schemaPath = path.resolve(__dirname, 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schemaSql);
}

type Param = string | number | null | bigint | Uint8Array;

export function queryAll<T = any>(sql: string, params: Param[] = []): T[] {
  return db.prepare(sql).all(...params) as T[];
}

export function queryOne<T = any>(sql: string, params: Param[] = []): T | undefined {
  return (db.prepare(sql).get(...params) as T) ?? undefined;
}

export function execute(sql: string, params: Param[] = []): { changes: number | bigint } {
  const info = db.prepare(sql).run(...params);
  return { changes: info.changes };
}

/** Run fn inside a transaction; nested calls join the outer transaction. */
let txDepth = 0;
export function transaction<T>(fn: () => T): T {
  if (txDepth > 0) {
    txDepth++;
    try {
      return fn();
    } finally {
      txDepth--;
    }
  }
  db.exec('BEGIN IMMEDIATE;');
  txDepth = 1;
  try {
    const out = fn();
    db.exec('COMMIT;');
    return out;
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  } finally {
    txDepth = 0;
  }
}

export function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string' || value.length === 0) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function nowIso(): string {
  return new Date().toISOString();
}

initDatabase();
