/**
 * Catálogo de Tipos de Gasto y Subtipos.
 * Para añadir más tipos o subtipos, simplemente añade entradas a este array.
 */
export interface SubtipoGasto {
  valor: string;
  etiqueta: string;
}

export interface TipoGasto {
  valor: string;
  etiqueta: string;
  subtipos: SubtipoGasto[];
}

export const TIPOS_GASTO: TipoGasto[] = [
  {
    valor: 'gasto_oficina',
    etiqueta: 'Gasto Oficina',
    subtipos: [
      { valor: 'alquiler',        etiqueta: 'Alquiler' },
      { valor: 'seguros',         etiqueta: 'Seguros' },
      { valor: 'comunicaciones',  etiqueta: 'Comunicaciones' },
      { valor: 'limpieza',        etiqueta: 'Limpieza' },
      { valor: 'material',        etiqueta: 'Material de Oficina' },
      { valor: 'mantenimiento',   etiqueta: 'Mantenimiento' },
    ],
  },
  {
    valor: 'suministros',
    etiqueta: 'Suministros',
    subtipos: [
      { valor: 'electricidad',   etiqueta: 'Electricidad' },
      { valor: 'agua',           etiqueta: 'Agua' },
      { valor: 'gas',            etiqueta: 'Gas' },
      { valor: 'internet',       etiqueta: 'Internet / Teléfono' },
    ],
  },
  {
    valor: 'servicios_profesionales',
    etiqueta: 'Servicios Profesionales',
    subtipos: [
      { valor: 'asesoria',       etiqueta: 'Asesoría / Gestoría' },
      { valor: 'informatica',    etiqueta: 'Informática / TI' },
      { valor: 'marketing',      etiqueta: 'Marketing / Publicidad' },
      { valor: 'otros',          etiqueta: 'Otros Servicios' },
    ],
  },
  {
    valor: 'personal',
    etiqueta: 'Personal',
    subtipos: [
      { valor: 'nominas',        etiqueta: 'Nóminas' },
      { valor: 'formacion',      etiqueta: 'Formación' },
      { valor: 'dietas',         etiqueta: 'Dietas y Desplazamientos' },
    ],
  },
  {
    valor: 'impuestos',
    etiqueta: 'Impuestos y Tasas',
    subtipos: [
      { valor: 'impuesto_local', etiqueta: 'Impuesto Local / IBI' },
      { valor: 'tasas',          etiqueta: 'Tasas y Licencias' },
    ],
  },
];
