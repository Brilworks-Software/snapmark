-- Create leads table for Pro upgrades
create table if not exists public.leads (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  name text not null,
  email text not null,
  ip text,
  location text,
  device text,
  url text,
  referrer text
);

-- Enable RLS
alter table public.leads enable row level security;

-- Allow service role (serverless function) to insert
-- Note: Our serverless function uses the service_role/anon key depending on config.
-- For simplicity in this setup, we'll allow anonymous inserts if using the anon key,
-- but ideally, you'd use a service role key for the API.
create policy "Enable insert for all users" on public.leads
  for insert with check (true);
