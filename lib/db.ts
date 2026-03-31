import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function sanitizeUrl(url: string): string {
  // channel_binding is a libpq-only param — the WebSocket driver rejects it
  const u = new URL(url);
  u.searchParams.delete('channel_binding');
  return u.toString();
}

function createClient(): PrismaClient {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error('DATABASE_URL is not set');
  const connectionString = sanitizeUrl(raw);
  const adapter = new PrismaNeon({ connectionString });
  return new PrismaClient({ adapter });
}

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db;
}
