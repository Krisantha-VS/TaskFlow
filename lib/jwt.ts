import { jwtVerify, errors as joseErrors } from 'jose';

const secret = new TextEncoder().encode(process.env.JWT_ACCESS_SECRET);

export async function verifyJWT(token: string): Promise<{ sub: string; name?: string; email?: string }> {
  try {
    const { payload } = await jwtVerify(token, secret);
    if (!payload.sub) throw new Error('Invalid token: missing sub');
    return payload as { sub: string; name?: string; email?: string };
  } catch (e) {
    if (e instanceof joseErrors.JWTExpired) throw new Error('Token expired');
    if (e instanceof joseErrors.JWTInvalid) throw new Error('Invalid token');
    throw e;
  }
}

export function extractBearer(authHeader: string | null): string {
  if (!authHeader?.startsWith('Bearer ')) throw new Error('Missing token');
  return authHeader.slice(7);
}
