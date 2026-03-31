import { PrismaClient } from '@prisma/client';
import { PrismaNeonHttp } from '@prisma/adapter-neon';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function sanitizeUrl(url: string): string {
  // channel_binding is libpq-only — HTTP driver rejects it
  // Pooler endpoint doesn't support HTTP queries — strip -pooler suffix
  const u = new URL(url);
  u.searchParams.delete('channel_binding');
  u.hostname = u.hostname.replace('-pooler', '');
  return u.toString();
}

function createClient(): PrismaClient {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error('DATABASE_URL is not set');
  const connectionString = sanitizeUrl(raw);
  const adapter = new PrismaNeonHttp(connectionString, {});
  return new PrismaClient({ adapter });
}

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db;
}
