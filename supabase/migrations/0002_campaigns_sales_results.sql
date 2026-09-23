-- Phase 2: Campaign Studio, Sales and Results & analysis.
-- Same rules as 0001: every row carries workspace_id, child rows reference
-- their parent with (id, workspace_id), and row-level security limits access
-- to members of the workspace.

-- ---------------------------------------------------------------------------
-- Campaigns (planned in the Campaign Studio, or logged for results only)
-- ---------------------------------------------------------------------------

create table public.unison_campaigns (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null,
  workspace_id uuid not null,
  name text not null check (char_length(name) between 1 and 200),
  goal text not null,
  status text not null default 'planned' check (status in ('planned', 'running', 'done')),
  variant_a text not null default '',
  variant_b text not null default '',
  conversion_label text not null default '',
  -- { a: {reached, clicks, conversions, spend}, b: {...}, notes }
  metrics jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  foreign key (brand_id, workspace_id) references public.unison_brands (id, workspace_id) on delete cascade
);

create index unison_campaigns_brand_id_idx on public.unison_campaigns (brand_id, created_at desc);

create trigger campaigns_set_updated_at
  before update on public.unison_campaigns
  for each row execute function public.unison_set_updated_at();

-- ---------------------------------------------------------------------------
-- Sales opportunities and their running notes
-- ---------------------------------------------------------------------------

create table public.unison_opportunities (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null,
  workspace_id uuid not null,
  company_name text not null check (char_length(company_name) between 1 and 200),
  contact_name text not null default '',
  contact_role text not null default '',
  stage text not null default 'new'
    check (stage in ('new', 'contacted', 'meeting', 'proposal', 'won', 'lost')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  foreign key (brand_id, workspace_id) references public.unison_brands (id, workspace_id) on delete cascade
);

create index unison_opportunities_brand_id_idx on public.unison_opportunities (brand_id, updated_at desc);

create trigger opportunities_set_updated_at
  before update on public.unison_opportunities
  for each row execute function public.unison_set_updated_at();

create table public.unison_opportunity_notes (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null,
  workspace_id uuid not null,
  content text not null check (char_length(content) between 1 and 20000),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (opportunity_id, workspace_id)
    references public.unison_opportunities (id, workspace_id) on delete cascade
);

create index unison_opportunity_notes_opportunity_id_idx
  on public.unison_opportunity_notes (opportunity_id, created_at desc);

-- A new note counts as activity on the opportunity (keeps the list sorted by recency).
create function public.unison_touch_opportunity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.unison_opportunities set updated_at = now() where id = new.opportunity_id;
  return new;
end;
$$;

create trigger opportunity_notes_touch_opportunity
  after insert on public.unison_opportunity_notes
  for each row execute function public.unison_touch_opportunity();

-- ---------------------------------------------------------------------------
-- Link generations to the campaign or opportunity they were written for
-- ---------------------------------------------------------------------------

alter table public.unison_generations
  add column campaign_id uuid,
  add column opportunity_id uuid,
  add constraint generations_campaign_fk
    foreign key (campaign_id, workspace_id)
    references public.unison_campaigns (id, workspace_id) on delete cascade,
  add constraint generations_opportunity_fk
    foreign key (opportunity_id, workspace_id)
    references public.unison_opportunities (id, workspace_id) on delete cascade;

create index unison_generations_campaign_id_idx
  on public.unison_generations (campaign_id, created_at desc) where campaign_id is not null;
create index unison_generations_opportunity_id_idx
  on public.unison_generations (opportunity_id, created_at desc) where opportunity_id is not null;

-- ---------------------------------------------------------------------------
-- Privileges and row-level security
-- ---------------------------------------------------------------------------

revoke all on public.unison_campaigns, public.unison_opportunities, public.unison_opportunity_notes from anon;
grant select, insert, update, delete on public.unison_campaigns, public.unison_opportunities,
  public.unison_opportunity_notes to authenticated;

alter table public.unison_campaigns enable row level security;
alter table public.unison_opportunities enable row level security;
alter table public.unison_opportunity_notes enable row level security;

create policy "members manage campaigns"
  on public.unison_campaigns for all to authenticated
  using (public.unison_is_workspace_member(workspace_id))
  with check (public.unison_is_workspace_member(workspace_id));

create policy "members manage opportunities"
  on public.unison_opportunities for all to authenticated
  using (public.unison_is_workspace_member(workspace_id))
  with check (public.unison_is_workspace_member(workspace_id));

create policy "members manage opportunity notes"
  on public.unison_opportunity_notes for all to authenticated
  using (public.unison_is_workspace_member(workspace_id))
  with check (public.unison_is_workspace_member(workspace_id));
