import { NextRequest, NextResponse } from 'next/server';
import { syncMovimientoIncidencias } from '@/lib/operativa';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const movimientoId = body?.movimientoId;

    if (!movimientoId) {
      return NextResponse.json({ ok: false, error: 'movimientoId es obligatorio' }, { status: 400 });
    }

    const result = await syncMovimientoIncidencias(movimientoId);
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: `No se pudo sincronizar la incidencia del movimiento (${result.reason}).`, reason: result.reason },
        { status: 500 }
      );
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || 'No se pudo sincronizar el movimiento' },
      { status: 500 }
    );
  }
}
