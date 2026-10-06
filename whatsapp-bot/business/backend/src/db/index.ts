import { drizzle } from "drizzle-orm/sqlite-proxy";
import { DatabaseSync } from "node:sqlite";
import { AsyncLocalStorage } from "node:async_hooks";
import { fileURLToPath } from "node:url";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { config } from "../config.js";
import * as schema from "./schema.js";

const filename = config.dbPath.startsWith("file://") ? fileURLToPath(new URL(config.dbPath)) : path.resolve(config.dbPath.replace(/^file:/, ""));
mkdirSync(path.dirname(filename), { recursive: true });
const database = new DatabaseSync(filename);
database.exec("PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL;");

// The proxy driver preserves the upstream asynchronous service API. A transaction
// holds the queue for its entire callback, including across awaits, so requests
// cannot accidentally enter another request's SQLite transaction.
const transactionContext = new AsyncLocalStorage<boolean>();
let tail: Promise<unknown> = Promise.resolve();
async function exclusive<T>(operation: () => Promise<T>): Promise<T> {
  const next = tail.catch(() => undefined).then(operation);
  tail = next.then(() => undefined, () => undefined);
  return next;
}
const execute = async (sql: string, params: any[], method: string) => {
  const statement = database.prepare(sql);
  const values = params.map(value => value === undefined ? null : value);
  if (method === "run") {
    const result = statement.run(...values);
    return { rows: [], rowsAffected: Number(result.changes) };
  }
  statement.setReturnArrays(true);
  return { rows: method === "get" ? (statement.get(...values) || []) as any[] : statement.all(...values) as any[] };
};
export const db = drizzle((sql, params, method) => transactionContext.getStore() ? execute(sql, params, method) : exclusive(() => execute(sql, params, method)), { schema });
const baseTransaction = db.transaction.bind(db);
db.transaction = ((callback: any, options: any) => exclusive(() => transactionContext.run(true, () => baseTransaction(callback, options)))) as typeof db.transaction;
export const sqlClient = { async execute(sql: string) { return { rows: database.prepare(sql).all() }; } };
export { schema };
export function closeDatabase() { database.close(); }
