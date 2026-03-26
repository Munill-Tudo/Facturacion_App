'use server';

import { supabase } from "@/lib/supabase";
import { revalidatePath } from "next/cache";
import { normalizarNIF, nifRaw } from "@/lib/nif";

export type Proveedor = {
  id: string;
  nif: string;
  nombre: string;
  direccion: string | null;
  cp: string | null;
  poblacion: string | null;
  provincia: string | null;
  email: string | null;
  telefono: string | null;
  iban: string | null;
  tipo_defecto?: string | null;
  created_at?: string;
};

export async function getProveedores() {
  const { data, error } = await supabase
    .from('proveedores')
    .select('*')
    .order('nombre', { ascending: true });
    
  if (error) {
    console.error("Error fetching proveedores", error);
    return [];
  }
  return data as Proveedor[];
}

export async function guardarProveedor(proveedor: Partial<Proveedor>) {
  if (proveedor.id) {
    // UPDATE
    const { id, created_at, ...updateData } = proveedor;
    const { data, error } = await supabase
      .from('proveedores')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) return { error: error.message };
    
    revalidatePath('/proveedores');
    revalidatePath('/facturas');
    return { data };
  } else {
    // INSERT
    const { data, error } = await supabase
      .from('proveedores')
      .insert([proveedor])
      .select()
      .single();

    if (error) {
      if (error.code === '23505') return { error: 'Ya existe un proveedor con este NIF.' };
      return { error: error.message };
    }
    
    revalidatePath('/proveedores');
    revalidatePath('/facturas');
    return { data };
  }
}

export async function buscarOCrearProveedorPorNIF(payload: Partial<Proveedor>) {
  if (!payload.nif || !payload.nombre) return null;

  // Normalizar el NIF al formato estándar (con guión)
  const nifNormalizado = normalizarNIF(payload.nif);
  const nifSinGuion = nifRaw(payload.nif);

  // Buscar por NIF normalizado, sin guión y con guión original para no hacer duplicados
  const { data: todos } = await supabase
    .from('proveedores')
    .select('*');

  const existente = (todos || []).find((p: Proveedor) => {
    const pRaw = nifRaw(p.nif);
    return pRaw === nifSinGuion;
  });

  if (existente) {
    // Si el NIF almacenado no está normalizado, lo actualizamos al formato estándar
    if (existente.nif !== nifNormalizado) {
      await supabase.from('proveedores').update({ nif: nifNormalizado }).eq('id', existente.id);
    }
    return existente as Proveedor;
  }

  // Si no existe, lo creamos con el NIF normalizado
  const { data: nuevo, error } = await supabase
    .from('proveedores')
    .insert([{
      nif: nifNormalizado,
      nombre: payload.nombre,
      direccion: payload.direccion || null,
      cp: payload.cp || null,
      poblacion: payload.poblacion || null,
      provincia: payload.provincia || null,
      email: payload.email || null,
      telefono: payload.telefono || null,
      iban: payload.iban || null,
      tipo_defecto: payload.tipo_defecto || null
    }])
    .select()
    .single();

  if (error) {
    console.error("No se pudo auto-crear proveedor:", error);
    return null;
  }
  
  revalidatePath('/proveedores');
  return nuevo as Proveedor;
}

export async function changeTipoDefectoProveedor(id: string, nuevoTipo: string) {
  const tipo = !nuevoTipo || nuevoTipo === '' ? null : nuevoTipo;
  await supabase.from('proveedores').update({ tipo_defecto: tipo }).eq('id', id);
  revalidatePath('/proveedores');
  revalidatePath('/facturas');
}

export async function eliminarProveedor(id: string) {
  // Soft-delete: marcar como eliminado en lugar de borrar definitivamente
  const { error } = await supabase
    .from('proveedores')
    .update({ eliminado: true })
    .eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/proveedores');
  revalidatePath('/papelera');
  return { ok: true };
}

export async function restaurarProveedor(id: string) {
  const { error } = await supabase
    .from('proveedores')
    .update({ eliminado: false })
    .eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/proveedores');
  revalidatePath('/papelera');
  return { ok: true };
}

export async function eliminarProveedorDefinitivo(id: string) {
  const { error } = await supabase.from('proveedores').delete().eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/proveedores');
  revalidatePath('/papelera');
  return { ok: true };
}

export async function getProveedoresEliminados() {
  const { data, error } = await supabase
    .from('proveedores')
    .select('*')
    .eq('eliminado', true)
    .order('nombre', { ascending: true });
  if (error) return [];
  return data as Proveedor[];
}
