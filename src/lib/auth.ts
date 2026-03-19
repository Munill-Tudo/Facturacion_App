import { createSupabaseServerClient } from './supabase-server'

export async function getUser() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function getUserRole(): Promise<'direccion' | 'administracion' | null> {
  const user = await getUser()
  if (!user) return null
  return (user.user_metadata?.role as 'direccion' | 'administracion') ?? null
}

export function isDireccion(role: string | null | undefined) {
  return role === 'direccion'
}
