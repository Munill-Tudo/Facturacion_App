-- Rediseño operativo v1
-- Objetivo: dejar de depender de conciliaciones 1:1 y habilitar una bandeja de incidencias real.

create table if not exists conciliacion_links (
  id bigserial primary key,
  movimiento_id bigint not null references movimientos(id) on delete cascade,
  documento_tipo text not null,
  documento_id bigint not null,
  relacion_tipo text not null default 'total',
  importe_aplicado numeric(12,2) not null default 0,
  confianza_auto numeric(5,2),
  origen text not null default 'manual',
  observacion text,
  created_at timestamptz not null default now(),
  created_by text
);

create index if not exists idx_conciliacion_links_movimiento on conciliacion_links(movimiento_id);
create index if not exists idx_conciliacion_links_documento on conciliacion_links(documento_tipo, documento_id);

create table if not exists incidencias (
  id bigserial primary key,
  entidad_tipo text not null,
  entidad_id bigint not null,
  movimiento_id bigint,
  tipo text not null,
  prioridad text not null default 'media',
  estado text not null default 'abierta',
  trimestre_fiscal text,
  motivo text not null,
  sugerencia jsonb,
  responsable text,
  fecha_detectada timestamptz not null default now(),
  fecha_resuelta timestamptz,
  resolucion_tipo text,
  resolucion_nota text
);

create index if not exists idx_incidencias_estado on incidencias(estado, prioridad, fecha_detectada desc);
create index if not exists idx_incidencias_entidad on incidencias(entidad_tipo, entidad_id);
create index if not exists idx_incidencias_tipo on incidencias(tipo);

create table if not exists soportes (
  id bigserial primary key,
  owner_tipo text not null,
  owner_id bigint not null,
  storage_url text not null,
  nombre_archivo text,
  mime_type text,
  tamano_bytes bigint,
  hash_archivo text,
  origen text default 'manual',
  es_principal boolean not null default true,
  estado_validacion text not null default 'subido',
  created_at timestamptz not null default now()
);

create index if not exists idx_soportes_owner on soportes(owner_tipo, owner_id);

alter table movimientos
  add column if not exists fecha_operativa date,
  add column if not exists fecha_contable date,
  add column if not exists fecha_dudosa boolean not null default false,
  add column if not exists estado_documental text default 'sin_documento',
  add column if not exists estado_fiscal text default 'no_revisado',
  add column if not exists incidencia_count integer not null default 0,
  add column if not exists ultima_revision_at timestamptz,
  add column if not exists clasificacion_sugerida text,
  add column if not exists clasificacion_final text;

alter table facturas
  add column if not exists estado_documental text default 'sin_documento',
  add column if not exists estado_fiscal text default 'no_revisado',
  add column if not exists fecha_fiscal date,
  add column if not exists fecha_dudosa boolean not null default false,
  add column if not exists incidencia_count integer not null default 0;

alter table facturas_emitidas
  add column if not exists estado_documental text default 'sin_documento',
  add column if not exists estado_fiscal text default 'no_revisado',
  add column if not exists incidencia_count integer not null default 0;

alter table impuestos
  add column if not exists estado_fiscal text default 'no_revisado',
  add column if not exists incidencia_count integer not null default 0;

alter table nominas
  add column if not exists estado_fiscal text default 'no_revisado',
  add column if not exists incidencia_count integer not null default 0;

comment on table conciliacion_links is 'Relaciona movimientos bancarios con uno o varios documentos de soporte.';
comment on table incidencias is 'Bandeja operativa de excepciones y trabajo pendiente.';
comment on table soportes is 'Repositorio lógico de documentos asociados a movimientos y asientos.';
