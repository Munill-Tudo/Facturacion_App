'use server'

import { supabase } from "@/lib/supabase";
import { revalidatePath } from "next/cache";

export async function changeTipoFactura(id: number, nuevoTipo: string) {
  await supabase.from('facturas').update({ tipo: nuevoTipo }).eq('id', id);
  revalidatePath('/facturas');
  revalidatePath('/');
  revalidatePath('/suplidos');
}

export async function updateFacturaField(id: number, field: string, value: string) {
  const allowedFields = ['num_expediente', 'cliente_expediente', 'tipo', 'estado'];
  if (!allowedFields.includes(field)) return;
  await supabase.from('facturas').update({ [field]: value }).eq('id', id);
  revalidatePath('/facturas');
  revalidatePath('/suplidos');
}

export async function moverAPapeleraClient(id: number) {
  await supabase.from('facturas').update({ estado: 'Eliminada' }).eq('id', id);
  revalidatePath('/facturas');
  revalidatePath('/papelera');
}

