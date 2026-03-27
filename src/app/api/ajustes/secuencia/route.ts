import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET: returns current sequence value for facturas
export async function GET() {
  try {
    // Get the last used ID
    const { data } = await supabase
      .from('facturas')
      .select('id')
      .order('id', { ascending: false })
      .limit(1);

    const lastId = data?.[0]?.id ?? 0;
    return NextResponse.json({ nextId: lastId + 1, lastId });
  } catch {
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}
