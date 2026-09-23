-- Unison — initial schema.
-- A workspace is the account (and later the billing/team unit). It owns brands;
-- each brand holds one Company Brain plus its notes, generations and drafts.
-- Every table is protected by row-level security: people only reach rows of
-- workspaces they belong to.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.unison_workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.unison_workspace_members (
  workspace_id uuid not null references public.unison_workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create index unison_workspace_members_user_id_idx on public.unison_workspace_members (user_id);

create table public.unison_brands (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.unison_workspaces (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  content_language text not null default 'en-US',
  -- Company Brain
  company text not null default '',
  audience text not null default '',
  problem text not null default '',
  positioning text not null default '',
  offer text not null default '',
  proof text not null default '',
  voice_tone text not null default '',
  voice_use text not null default '',
  voice_avoid text not null default '',
  voice_example text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Lets child tables prove their brand belongs to the same workspace.
  unique (id, workspace_id)
);

create index unison_brands_workspace_id_idx on public.unison_brands (workspace_id);

create table public.unison_brand_documents (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null,
  workspace_id uuid not null,
  kind text not null check (kind in ('note', 'file')),
  title text not null check (char_length(title) between 1 and 200),
  content text not null,
  file_name text,
  truncated boolean not null default false,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (brand_id, workspace_id) references public.unison_brands (id, workspace_id) on delete cascade
);

create index unison_brand_documents_brand_id_idx on public.unison_brand_documents (brand_id, created_at desc);

create table public.unison_generations (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null,
  workspace_id uuid not null,
  studio text not null check (studio in ('content', 'campaign', 'sales', 'results')),
  title text not null,
  input jsonb not null default '{}'::jsonb,
  output jsonb not null,
  facts_used text[] not null default '{}',
  language text not null,
  model text not null,
  input_tokens integer,
  cached_tokens integer,
  output_tokens integer,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (brand_id, workspace_id) references public.unison_brands (id, workspace_id) on delete cascade
);

create index unison_generations_brand_id_idx on public.unison_generations (brand_id, created_at desc);
-- Monthly usage counts per workspace (free-plan limit later).
create index unison_generations_workspace_created_idx on public.unison_generations (workspace_id, created_at);

create table public.unison_drafts (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null,
  workspace_id uuid not null,
  generation_id uuid references public.unison_generations (id) on delete set null,
  asset_type text not null,
  title text not null,
  body text not null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (brand_id, workspace_id) references public.unison_brands (id, workspace_id) on delete cascade
);

create index unison_drafts_brand_id_idx on public.unison_drafts (brand_id, updated_at desc);

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------

create function public.unison_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger brands_set_updated_at
  before update on public.unison_brands
  for each row execute function public.unison_set_updated_at();

create trigger drafts_set_updated_at
  before update on public.unison_drafts
  for each row execute function public.unison_set_updated_at();

-- ---------------------------------------------------------------------------
-- Membership helper (security definer so policies don't recurse into RLS)
-- ---------------------------------------------------------------------------

create function public.unison_is_workspace_member(ws uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.unison_workspace_members m
    where m.workspace_id = ws
      and m.user_id = (select auth.uid())
  );
$$;

revoke all on function public.unison_is_workspace_member(uuid) from public, anon;
grant execute on function public.unison_is_workspace_member(uuid) to authenticated;

-- Returns the caller's workspace, creating a personal one on first use.
create function public.unison_ensure_personal_workspace()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  ws uuid;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  -- Serialize concurrent first logins of the same user.
  perform pg_advisory_xact_lock(hashtext(uid::text));

  select m.workspace_id into ws
  from public.unison_workspace_members m
  where m.user_id = uid
  order by m.created_at
  limit 1;

  if ws is null then
    insert into public.unison_workspaces (name, created_by)
    values ('My workspace', uid)
    returning id into ws;

    insert into public.unison_workspace_members (workspace_id, user_id, role)
    values (ws, uid, 'owner');
  end if;

  return ws;
end;
$$;

revoke all on function public.unison_ensure_personal_workspace() from public, anon;
grant execute on function public.unison_ensure_personal_workspace() to authenticated;

-- ---------------------------------------------------------------------------
-- Privileges and row-level security
-- ---------------------------------------------------------------------------

revoke all on public.unison_workspaces, public.unison_workspace_members, public.unison_brands,
  public.unison_brand_documents, public.unison_generations, public.unison_drafts from anon;

grant select on public.unison_workspaces, public.unison_workspace_members to authenticated;
grant select, insert, update, delete on public.unison_brands, public.unison_brand_documents,
  public.unison_generations, public.unison_drafts to authenticated;

alter table public.unison_workspaces enable row level security;
alter table public.unison_workspace_members enable row level security;
alter table public.unison_brands enable row level security;
alter table public.unison_brand_documents enable row level security;
alter table public.unison_generations enable row level security;
alter table public.unison_drafts enable row level security;

create policy "members read their workspaces"
  on public.unison_workspaces for select to authenticated
  using (public.unison_is_workspace_member(id));

create policy "members read their workspace's members"
  on public.unison_workspace_members for select to authenticated
  using (public.unison_is_workspace_member(workspace_id));

create policy "members manage brands"
  on public.unison_brands for all to authenticated
  using (public.unison_is_workspace_member(workspace_id))
  with check (public.unison_is_workspace_member(workspace_id));

create policy "members manage brand documents"
  on public.unison_brand_documents for all to authenticated
  using (public.unison_is_workspace_member(workspace_id))
  with check (public.unison_is_workspace_member(workspace_id));

create policy "members manage generations"
  on public.unison_generations for all to authenticated
  using (public.unison_is_workspace_member(workspace_id))
  with check (public.unison_is_workspace_member(workspace_id));

create policy "members manage drafts"
  on public.unison_drafts for all to authenticated
  using (public.unison_is_workspace_member(workspace_id))
  with check (public.unison_is_workspace_member(workspace_id));
