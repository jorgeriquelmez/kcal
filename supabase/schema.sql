-- Kcal · esquema de base de datos (pegar en Supabase > SQL Editor > Run)

create table if not exists public.registros (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  creado_en   timestamptz not null default now(),
  tipo        text not null check (tipo in ('comida', 'snack')),
  descripcion text,
  calorias    integer not null check (calorias >= 0),
  miniatura   text,   -- JPEG 160x160 en base64 (data URL, ~10 KB)
  detalle     jsonb   -- respuesta completa de la IA
);

create index if not exists registros_usuario_fecha on public.registros (user_id, creado_en desc);

create table if not exists public.snacks (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  creado_en  timestamptz not null default now(),
  nombre     text not null,
  calorias   integer not null check (calorias >= 0),
  porcion    text,
  miniatura  text
);

-- Seguridad: cada usuario solo ve y modifica sus propios datos
alter table public.registros enable row level security;
alter table public.snacks    enable row level security;

drop policy if exists "registros propios" on public.registros;
create policy "registros propios" on public.registros
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "snacks propios" on public.snacks;
create policy "snacks propios" on public.snacks
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
