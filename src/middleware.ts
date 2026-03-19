import { NextResponse, type NextRequest } from 'next/server'
import { decrypt } from '@/lib/jwt'

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // Exclude public paths
  const isPublicPath = pathname.startsWith('/login') || pathname.startsWith('/api/')
  if (isPublicPath) return NextResponse.next()

  const session = request.cookies.get('auth_session')?.value
  const payload = session ? await decrypt(session) : null

  // Not logged in → redirect to login
  if (!payload) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Role check: administracion cannot access Dashboard (/)
  if (payload.role === 'administracion' && pathname === '/') {
    const url = request.nextUrl.clone()
    url.pathname = '/facturas'
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
