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
  if (driver === "neon") {
    const pool = new NeonPool({ connectionString });
    return drizzleNeon(pool, { schema }) as unknown as Database;
  }
  const pool = new PgPool({ connectionString });
  return drizzlePg(pool, { schema });
}
