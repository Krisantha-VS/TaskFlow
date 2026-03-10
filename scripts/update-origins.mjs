import { neon } from '@neondatabase/serverless';

const sql = neon('postgresql://neondb_owner:npg_oD2LYtQAxuM7@ep-noisy-bread-a1v5mv5u-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require');

const apps = await sql`SELECT id, "clientId", "allowedOrigins" FROM tenant_apps WHERE "clientId" = 'cmmhrfspn00010ajrue12vt77'`;
if (!apps.length) { console.error('App not found'); process.exit(1); }

const current = apps[0].allowedOrigins ?? [];
const updated = [...new Set([...current, 'https://taskflow-gamma-liard.vercel.app'])];

await sql`UPDATE tenant_apps SET "allowedOrigins" = ${updated}::text[] WHERE "clientId" = 'cmmhrfspn00010ajrue12vt77'`;
console.log('allowedOrigins updated:', updated);
