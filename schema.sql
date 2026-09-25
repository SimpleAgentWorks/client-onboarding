-- Private intake store. Run in the selected SimpleAgentWorks Supabase project.
create table if not exists public.client_intakes (
  id text primary key,
  answers jsonb not null,
  status text not null default 'uploading' check (status in ('uploading','complete')),
  drive_url text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
alter table public.client_intakes enable row level security;
grant select, insert, update on public.client_intakes to service_role;
revoke all on public.client_intakes from anon, authenticated;
-- No anon/authenticated policies. Apps Script's server-side secret key bypasses RLS.
insert into storage.buckets (id,name,public,file_size_limit)
values ('client-intake-uploads','client-intake-uploads',false,8388608)
on conflict (id) do nothing;
