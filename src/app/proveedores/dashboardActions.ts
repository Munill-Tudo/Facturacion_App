'use server';

import { supabase } from "@/lib/supabase";

export async function getFacturasDeProveedor(nif: string, nombre: string) {
  if (!nif && !nombre) return [];

  const query = supabase.from('facturas').select('*');
  
  // Buscar por NIF principalmente o por coincidencia exacta de nombre si no hay NIF
  if (nif) {
    query.eq('nif_proveedor', nif);
  } else if (nombre) {
    query.eq('nombre_proveedor', nombre);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) {
    console.error("Error trayendo facturas del proveedor", error);
    return [];
  }
  
  return data || [];
}
