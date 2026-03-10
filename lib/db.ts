import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

let _db: PrismaClient | undefined;

export function getDb(): PrismaClient {
  if (!_db) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error('DATABASE_URL is not set');
    const adapter = new PrismaNeon({ connectionString });
    _db = new PrismaClient({ adapter });
  }
  return _db;
}

export const db = new Proxy({} as PrismaClient, {
  get(_, prop: string) {
    return (getDb() as unknown as Record<string, unknown>)[prop];
  },
});
