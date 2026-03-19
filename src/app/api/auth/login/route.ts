import { NextResponse } from 'next/server';
import { encrypt } from '@/lib/jwt';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    const direccionEmails = ['orecio@munilltudoabogados.es', 'mariona@munilltudoabogados.es', 'nmunill@munilltudoabogados.es'];
    const adminEmails = ['secretaria@munilltudoabogados.es'];

    let role: 'direccion' | 'administracion' | null = null;
    let isValid = false;

    if (direccionEmails.includes(email)) {
      if (password === process.env.DIRECCION_PASSWORD) {
        role = 'direccion';
        isValid = true;
      }
    } else if (adminEmails.includes(email)) {
      if (password === process.env.ADMIN_PASSWORD) {
        role = 'administracion';
        isValid = true;
      }
    }

    if (!isValid || !role) {
      return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 });
    }

    const sessionString = await encrypt({ email, role });
    
    // Set cookie
    const cookieStore = await cookies();
    cookieStore.set('auth_session', sessionString, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    return NextResponse.json({ user: { email, role } });
  } catch (error) {
    return NextResponse.json({ error: 'Error processing login' }, { status: 500 });
  }
}
