'use server'

import { supabase } from "@/lib/supabase";
import { revalidatePath } from "next/cache";

export async function moverEmitidaAPapeleraClient(id: number) {
  await supabase.from('facturas_emitidas').update({ estado: 'Eliminada' }).eq('id', id);
  revalidatePath('/emitidas');
  revalidatePath('/papelera');
}

export async function bulkUpdateEmitidaEstado(ids: number[], estado: string) {
  if (!ids.length) return;
  await supabase.from('facturas_emitidas').update({ estado }).in('id', ids);
  revalidatePath('/');
  revalidatePath('/emitidas');
}

export async function updateEmitidaField(id: number, field: string, value: string) {
  const allowedFields = ['numero', 'cliente', 'estado', 'concepto'];
  if (!allowedFields.includes(field)) return;
  await supabase.from('facturas_emitidas').update({ [field]: value }).eq('id', id);
  revalidatePath('/emitidas');
}
