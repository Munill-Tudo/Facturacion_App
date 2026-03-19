import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const secretKey = process.env.JWT_SECRET || 'super_secret_jwt_key_mt_abogados_2026_pro';
const key = new TextEncoder().encode(secretKey);

export interface SessionPayload {
  email: string;
  role: 'direccion' | 'administracion';
}

export async function encrypt(payload: SessionPayload) {
  return await new SignJWT(payload as any)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(key);
}

export async function decrypt(input: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(input, key, {
      algorithms: ['HS256'],
    });
    return payload as unknown as SessionPayload;
  } catch (error) {
    return null;
  }
}

export async function getSession() {
  const cookieStore = await cookies();
  const session = cookieStore.get('auth_session')?.value;
  if (!session) return null;
  return await decrypt(session);
}

export async function updateSession(request: any) {
  const session = request.cookies.get('auth_session')?.value;
  if (!session) return;

  const parsed = await decrypt(session);
  if (!parsed) return;

  const res = new Response();
  res.headers.set(
    'Set-Cookie',
    `auth_session=${session}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}`
  );
  return res;
}
