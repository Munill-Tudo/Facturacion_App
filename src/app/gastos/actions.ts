'use server';

import { supabase } from "@/lib/supabase";
import { revalidatePath } from "next/cache";

export async function getTiposGastoFromDB() {
  const { data, error } = await supabase
    .from('tipos_gasto')
    .select('*')
    .order('etiqueta', { ascending: true });

  if (error) return [];
  
  // Pivot to hierarchical structure
  const parents = data.filter(t => !t.parent_id);
  return parents.map(p => ({
    id: p.id,
    valor: p.valor,
    etiqueta: p.etiqueta,
    subtipos: data
      .filter(s => s.parent_id === p.id)
      .map(s => ({ id: s.id, valor: s.valor, etiqueta: s.etiqueta }))
  }));
}

export async function addTipoGasto(etiqueta: string, parentId: string | null = null) {
  const valor = etiqueta.toLowerCase().replace(/\s+/g, '_').normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  
  const { error } = await supabase
    .from('tipos_gasto')
    .insert([{ etiqueta, valor, parent_id: parentId }]);

  if (!error) revalidatePath('/gastos');
  return { error };
}

export async function deleteTipoGasto(id: string) {
  const { error } = await supabase
    .from('tipos_gasto')
    .delete()
    .eq('id', id);

  if (!error) revalidatePath('/gastos');
  return { error };
}
