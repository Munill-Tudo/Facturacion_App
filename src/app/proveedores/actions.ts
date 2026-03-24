'use server';

import { supabase } from "@/lib/supabase";
import { revalidatePath } from "next/cache";

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

  // Buscar por NIF
  const { data: existente } = await supabase
    .from('proveedores')
    .select('*')
    .eq('nif', payload.nif)
    .single();

  if (existente) {
    return existente as Proveedor;
  }

  // Si no existe, lo creamos
  const { data: nuevo, error } = await supabase
    .from('proveedores')
    .insert([{
      nif: payload.nif,
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
