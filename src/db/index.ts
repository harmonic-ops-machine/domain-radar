import { Pool as NeonPool } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { Pool as PgPool } from "pg";
import * as schema from "./schema";

export type DatabaseDriver = "neon" | "pg";

export function resolveDriver(url: string): DatabaseDriver {
  if (/\.neon\.tech(?:[:/]|$)/i.test(url)) {
    return "neon";
  }
  return "pg";
}

export type Database = ReturnType<typeof drizzlePg<typeof schema>>;

const dbCache = new Map<string, Database>();

export function createDb(options?: {
  url?: string;
  driver?: DatabaseDriver;
}): Database {
  const connectionString =
    options?.url ?? process.env.DATABASE_URL ?? process.env.DATABASE_URL_UNPOOLED;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL or DATABASE_URL_UNPOOLED must be configured before creating a DB connection"
    );
  }
  const driver = options?.driver ?? resolveDriver(connectionString);
  const cacheKey = `${driver}:${connectionString}`;
  const cached = dbCache.get(cacheKey);
  if (cached) return cached;

  let instance: Database;
  if (driver === "neon") {
    const pool = new NeonPool({ connectionString });
    instance = drizzleNeon(pool, { schema }) as unknown as Database;
  } else {
    const pool = new PgPool({ connectionString });
    instance = drizzlePg(pool, { schema });
  }
  dbCache.set(cacheKey, instance);
  return instance;
}
