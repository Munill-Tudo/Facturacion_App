import { getSession } from './jwt'

export async function getUser() {
  const session = await getSession()
  return session
}

export async function getUserRole(): Promise<'direccion' | 'administracion' | null> {
  const user = await getUser()
  if (!user) return null
  return user.role
}

export function isDireccion(role: string | null | undefined) {
  return role === 'direccion'
}
