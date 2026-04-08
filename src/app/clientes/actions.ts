'use server';

import { supabase } from "@/lib/supabase";
import { revalidatePath } from "next/cache";
import { normalizarNIF, nifRaw } from "@/lib/nif";
import { generarRFCreditorReference } from "@/lib/normalizacion";

export type Cliente = {
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
  referencia_rf: string | null;
  eliminado?: boolean;
  created_at?: string;
};

export async function getClientes() {
  const { data, error } = await supabase
    .from('clientes')
    .select('*')
    .order('nombre', { ascending: true });
    
  if (error) {
    console.error("Error fetching clientes", error);
    return [];
  }
  return data as Cliente[];
}

export async function guardarCliente(cliente: Partial<Cliente>) {
  if (cliente.id) {
    // UPDATE
    const { id, created_at, ...updateData } = cliente;
    const { data, error } = await supabase
      .from('clientes')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) return { error: error.message };
    
    revalidatePath('/clientes');
    revalidatePath('/emitidas');
    return { data };
  } else {
    // INSERT
    if (!cliente.referencia_rf && cliente.nombre) {
      cliente.referencia_rf = generarRFCreditorReference(cliente.nif || cliente.nombre);
    }
    const { data, error } = await supabase
      .from('clientes')
      .insert([cliente])
      .select()
      .single();

    if (error) {
      if (error.code === '23505') return { error: 'Ya existe un cliente con este NIF.' };
      return { error: error.message };
    }
    
    revalidatePath('/clientes');
    revalidatePath('/emitidas');
    return { data };
  }
}

export async function buscarOCrearClientePorNIF(payload: Partial<Cliente>) {
  if (!payload.nif || !payload.nombre) return null;

  const nifNormalizado = normalizarNIF(payload.nif);
  const nifSinGuion = nifRaw(payload.nif);

  const { data: todos } = await supabase
    .from('clientes')
    .select('*');

  const existente = (todos || []).find((c: Cliente) => {
    const cRaw = nifRaw(c.nif);
    return cRaw === nifSinGuion;
  });

  if (existente) {
    if (existente.nif !== nifNormalizado) {
      await supabase.from('clientes').update({ nif: nifNormalizado }).eq('id', existente.id);
    }
    // Asignar RF si no tenía por ser antiguo
    if (!existente.referencia_rf) {
        const nr = generarRFCreditorReference(nifNormalizado);
        await supabase.from('clientes').update({ referencia_rf: nr }).eq('id', existente.id);
        existente.referencia_rf = nr;
    }
    return existente as Cliente;
  }

  // Crear nuevo
  const nr = generarRFCreditorReference(nifNormalizado);
  const { data: nuevo, error } = await supabase
    .from('clientes')
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
      referencia_rf: nr
    }])
    .select()
    .single();

  if (error) {
    console.error("No se pudo auto-crear cliente:", error);
    return null;
  }
  
  revalidatePath('/clientes');
  return nuevo as Cliente;
}

export async function eliminarCliente(id: string) {
  const { error } = await supabase
    .from('clientes')
    .update({ eliminado: true })
    .eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/clientes');
  revalidatePath('/papelera');
  return { ok: true };
}

export async function restaurarCliente(id: string) {
  const { error } = await supabase
    .from('clientes')
    .update({ eliminado: false })
    .eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/clientes');
  revalidatePath('/papelera');
  return { ok: true };
}

export async function eliminarClienteDefinitivo(id: string) {
  const { error } = await supabase.from('clientes').delete().eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/clientes');
  revalidatePath('/papelera');
  return { ok: true };
}

export async function getClientesEliminados() {
  const { data, error } = await supabase
    .from('clientes')
    .select('*')
    .eq('eliminado', true)
    .order('nombre', { ascending: true });
  if (error) return [];
  return data as Cliente[];
}
